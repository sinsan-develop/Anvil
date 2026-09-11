"""Immutable Main-to-Developer delegation contract (C-02).

This module only validates a delegation envelope.  It deliberately does not
launch a worker, access credentials, or perform any external I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any, Mapping


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
_REASON_CODES = frozenset(
    {
        "PACKET_REQUIRED",
        "REQUIRED_FIELD_MISSING",
        "INVALID_FIELD",
        "INVALID_HASH",
        "BASELINE_SNAPSHOT_MISMATCH",
        "PERMISSION_SNAPSHOT_MISMATCH",
        "CONTEXT_SNAPSHOT_MISMATCH",
        "EGRESS_SNAPSHOT_MISMATCH",
        "PATH_NOT_CANONICAL",
        "PATH_SCOPE_CONFLICT",
    }
)


class _ContractValidationError(ValueError):
    """Typed internal validation failure; never infer contract data from text."""

    def __init__(self, reason: str, field: str) -> None:
        self.reason = reason
        self.field = field
        super().__init__(f"{reason}:{field}")


def _is_utf8_encodable(value: str) -> bool:
    try:
        value.encode("utf-8", errors="strict")
    except UnicodeEncodeError:
        return False
    return True


_UNKNOWN_KEY_ESCAPE_PREFIX = "<unknown_key_codepoints:"


def _unknown_field_identity(value: str, prefix: str = "") -> str:
    component = value
    if not _is_utf8_encodable(value) or value.startswith(_UNKNOWN_KEY_ESCAPE_PREFIX):
        encoded = "".join(f"{ord(character):06x}" for character in value)
        component = f"{_UNKNOWN_KEY_ESCAPE_PREFIX}{encoded}>"
    return f"{prefix}.{component}" if prefix else component


def _text(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")
    if not _is_utf8_encodable(value):
        raise _ContractValidationError("INVALID_TEXT_ENCODING", field)


def _hash(value: Any, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def _paths(values: Any, field: str) -> tuple[str, ...]:
    if not isinstance(values, tuple) or not values:
        raise ValueError(f"{field} must be a non-empty tuple")
    if len(values) != len(set(values)):
        raise ValueError(f"{field} must not contain duplicates")
    for value in values:
        _text(value, f"{field} item")
        # Packet paths are repository-relative, slash-normalized identities.
        if (
            value.startswith(("/", "\\"))
            or value.startswith("./")
            or value.endswith("/")
            or "\\" in value
            or any(part in {"", ".", ".."} for part in value.split("/"))
        ):
            raise ValueError(f"{field} contains a non-canonical path")
    return values


def _texts(values: Any, field: str) -> tuple[str, ...]:
    if not isinstance(values, tuple) or not values:
        raise ValueError(f"{field} must be a non-empty tuple")
    if len(values) != len(set(values)):
        raise ValueError(f"{field} must not contain duplicates")
    for value in values:
        _text(value, f"{field} item")
    return values


def _canonical_hash(value: Mapping[str, Any]) -> str:
    try:
        encoded = json.dumps(
            value, ensure_ascii=False, allow_nan=False,
            sort_keys=True, separators=(",", ":"),
        ).encode("utf-8", errors="strict")
    except (TypeError, ValueError, UnicodeEncodeError) as error:
        raise _ContractValidationError("CANONICAL_HASH_ERROR", "canonical_hash") from error
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"DUPLICATE_JSON_KEY:{key}")
        value[key] = item
    return value


def _reject_non_finite(value: str) -> None:
    raise ValueError(f"NON_FINITE_NUMBER:{value}")


def _tuple_of_text(value: Any, field: str, *, paths: bool = False) -> tuple[str, ...]:
    if not isinstance(value, tuple):
        raise TypeError(f"{field} must be a tuple")
    if len(value) != len(set(value)):
        raise ValueError(f"DUPLICATE_VALUE:{field}")
    for item in value:
        _text(item, f"{field} item")
        if paths:
            _validate_repository_path(item, field)
    return value


def _validate_repository_path(value: str, field: str) -> None:
    if (
        value.startswith(("/", "\\"))
        or re.match(r"^[A-Za-z]:", value)
        or value.startswith("./")
        or value.endswith("/")
        or "\\" in value
        or any(part in {"", ".", ".."} for part in value.split("/"))
        or ("*" in value and not value.endswith("/**"))
        or value.count("*") not in {0, 2}
        or any(marker in value for marker in ("?", "[", "]"))
    ):
        raise ValueError(f"PATH_NOT_CANONICAL:{field}")


def _path_scopes_overlap(left: tuple[str, ...], right: tuple[str, ...]) -> bool:
    return any(
        _path_scope_covers(left_path, right_path) or _path_scope_covers(right_path, left_path)
        for left_path in left for right_path in right
    )


def _mapping_schema_error(
    value: Any, *, required: set[str], arrays: tuple[str, ...], prefix: str,
    path_fields: tuple[str, ...] = (), text_fields: tuple[str, ...] = (),
    exact_values: Mapping[str, tuple[tuple[str, ...], str]] | None = None,
    path_overlaps: tuple[tuple[str, str, str], ...] = (),
    set_overlaps: tuple[tuple[str, str, str], ...] = (),
) -> tuple[str, tuple[str, ...]] | None:
    if not isinstance(value, Mapping):
        return "INVALID_FIELD_TYPE", (prefix,)
    keys = tuple(value.keys())
    if any(not isinstance(key, str) for key in keys):
        return "UNKNOWN_FIELD", (f"{prefix}.<non_string_key>",)
    present = set(keys)
    missing = tuple(f"{prefix}.{field}" for field in sorted(required - present))
    if missing:
        return "REQUIRED_FIELD_MISSING", missing
    unknown = tuple(sorted(
        _unknown_field_identity(field, prefix) for field in present - required
    ))
    if unknown:
        return "UNKNOWN_FIELD", unknown
    for field in text_fields:
        qualified = f"{prefix}.{field}"
        item = value[field]
        if not isinstance(item, str):
            return "INVALID_FIELD_TYPE", (qualified,)
        if not item or item != item.strip():
            return "EMPTY_FIELD", (qualified,)
        if not _is_utf8_encodable(item):
            return "INVALID_TEXT_ENCODING", (qualified,)
    if exact_values is not None:
        for field, (allowed, reason) in exact_values.items():
            if value[field] not in allowed:
                return reason, (f"{prefix}.{field}",)
    for field in arrays:
        qualified = f"{prefix}.{field}"
        items = value[field]
        if not isinstance(items, list):
            return "INVALID_FIELD_TYPE", (qualified,)
        if any(not isinstance(item, str) for item in items):
            return "INVALID_FIELD_TYPE", (qualified,)
        if any(not item or item != item.strip() for item in items):
            return "EMPTY_FIELD", (qualified,)
        if any(not _is_utf8_encodable(item) for item in items):
            return "INVALID_TEXT_ENCODING", (qualified,)
        if len(items) != len(set(items)):
            return "DUPLICATE_VALUE", (qualified,)
        if field in path_fields:
            try:
                for item in items:
                    _validate_repository_path(item, field)
            except ValueError:
                return "PATH_NOT_CANONICAL", (qualified,)
    for allowed_field, denied_field, error_field in path_overlaps:
        if _path_scopes_overlap(tuple(value[allowed_field]), tuple(value[denied_field])):
            return "ALLOW_DENY_OVERLAP", (f"{prefix}.{error_field}",)
    for allowed_field, denied_field, error_field in set_overlaps:
        if set(value[allowed_field]) & set(value[denied_field]):
            return "ALLOW_DENY_OVERLAP", (f"{prefix}.{error_field}",)
    return None


def _json_string_tuple(value: Any, field: str) -> tuple[str, ...]:
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise TypeError(f"INVALID_FIELD_TYPE:{field}")
    return tuple(value)


@dataclass(frozen=True, slots=True)
class PermissionSnapshot:
    """Immutable child or parent permission content used at delegation time."""

    allowed_paths: tuple[str, ...]
    allowed_actions: tuple[str, ...]
    allowed_tools: tuple[str, ...]
    allowed_backends: tuple[str, ...]
    prohibited_paths: tuple[str, ...]
    protected_paths: tuple[str, ...]
    prohibited_actions: tuple[str, ...]
    schema_version: str = "permission_snapshot/v1"

    def __post_init__(self) -> None:
        _text(self.schema_version, "schema_version")
        if self.schema_version != "permission_snapshot/v1":
            raise _ContractValidationError("UNSUPPORTED_SCHEMA_VERSION", "schema_version")
        for field in ("allowed_paths", "prohibited_paths", "protected_paths"):
            _tuple_of_text(getattr(self, field), field, paths=True)
        for field in ("allowed_actions", "allowed_tools", "allowed_backends", "prohibited_actions"):
            _tuple_of_text(getattr(self, field), field)
        if _path_scopes_overlap(self.allowed_paths, self.prohibited_paths + self.protected_paths):
            raise _ContractValidationError("ALLOW_DENY_OVERLAP", "allowed_paths")
        if set(self.allowed_actions) & set(self.prohibited_actions):
            raise _ContractValidationError("ALLOW_DENY_OVERLAP", "allowed_actions")

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "allowed_paths": list(self.allowed_paths),
            "allowed_actions": list(self.allowed_actions),
            "allowed_tools": list(self.allowed_tools),
            "allowed_backends": list(self.allowed_backends),
            "prohibited_paths": list(self.prohibited_paths),
            "protected_paths": list(self.protected_paths),
            "prohibited_actions": list(self.prohibited_actions),
        }

    @property
    def snapshot_hash(self) -> str:
        return _canonical_hash(self.to_dict())

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "PermissionSnapshot":
        if not isinstance(value, Mapping):
            raise TypeError("permission snapshot must be a mapping")
        fields = {
            "schema_version", "allowed_paths", "allowed_actions", "allowed_tools",
            "allowed_backends", "prohibited_paths", "protected_paths", "prohibited_actions",
        }
        if set(value) != fields:
            raise ValueError("permission snapshot fields are incomplete or unknown")
        return cls(
            allowed_paths=_json_string_tuple(value["allowed_paths"], "permission_snapshot.allowed_paths"),
            allowed_actions=_json_string_tuple(value["allowed_actions"], "permission_snapshot.allowed_actions"),
            allowed_tools=_json_string_tuple(value["allowed_tools"], "permission_snapshot.allowed_tools"),
            allowed_backends=_json_string_tuple(value["allowed_backends"], "permission_snapshot.allowed_backends"),
            prohibited_paths=_json_string_tuple(value["prohibited_paths"], "permission_snapshot.prohibited_paths"),
            protected_paths=_json_string_tuple(value["protected_paths"], "permission_snapshot.protected_paths"),
            prohibited_actions=_json_string_tuple(value["prohibited_actions"], "permission_snapshot.prohibited_actions"),
            schema_version=value["schema_version"],
        )


@dataclass(frozen=True, slots=True)
class DataEgressProfile:
    """Immutable DataEgressProfile content snapshot."""

    mode: str
    provider_allowlist: tuple[str, ...]
    approved_paths: tuple[str, ...]
    excluded_paths: tuple[str, ...]
    schema_version: str = "data_egress_profile/v1"

    def __post_init__(self) -> None:
        _text(self.schema_version, "schema_version")
        if self.schema_version != "data_egress_profile/v1":
            raise _ContractValidationError("UNSUPPORTED_SCHEMA_VERSION", "schema_version")
        _text(self.mode, "mode")
        if self.mode not in {"local_only", "metadata_only", "approved_paths", "masked_content"}:
            raise _ContractValidationError("UNSUPPORTED_EGRESS_MODE", "mode")
        _tuple_of_text(self.provider_allowlist, "provider_allowlist")
        _tuple_of_text(self.approved_paths, "approved_paths", paths=True)
        _tuple_of_text(self.excluded_paths, "excluded_paths", paths=True)
        if _path_scopes_overlap(self.approved_paths, self.excluded_paths):
            raise _ContractValidationError("ALLOW_DENY_OVERLAP", "approved_paths")

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "mode": self.mode,
            "provider_allowlist": list(self.provider_allowlist),
            "approved_paths": list(self.approved_paths),
            "excluded_paths": list(self.excluded_paths),
        }

    @property
    def snapshot_hash(self) -> str:
        return _canonical_hash(self.to_dict())

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "DataEgressProfile":
        if not isinstance(value, Mapping):
            raise TypeError("egress profile must be a mapping")
        fields = {"schema_version", "mode", "provider_allowlist", "approved_paths", "excluded_paths"}
        if set(value) != fields:
            raise ValueError("egress profile fields are incomplete or unknown")
        return cls(
            mode=value["mode"],
            provider_allowlist=_json_string_tuple(value["provider_allowlist"], "data_egress_profile.provider_allowlist"),
            approved_paths=_json_string_tuple(value["approved_paths"], "data_egress_profile.approved_paths"),
            excluded_paths=_json_string_tuple(value["excluded_paths"], "data_egress_profile.excluded_paths"),
            schema_version=value["schema_version"],
        )


DataEgressSnapshot = DataEgressProfile
PermissionProfileSnapshot = PermissionSnapshot


def _path_scope_covers(outer: str, inner: str) -> bool:
    if outer == inner:
        return True
    if not outer.endswith("/**"):
        return False
    base = outer[:-3]
    return inner.startswith(base + "/")


def _all_paths_narrower(child: tuple[str, ...], parent: tuple[str, ...]) -> bool:
    return all(any(_path_scope_covers(parent_path, child_path) for parent_path in parent)
               for child_path in child)


def _all_parent_denials_preserved(child: tuple[str, ...], parent: tuple[str, ...]) -> bool:
    return all(any(_path_scope_covers(child_path, parent_path) for child_path in child)
               for parent_path in parent)


@dataclass(frozen=True, slots=True)
class DelegationPacket:
    """Frozen complete envelope passed from Main Agent to a Developer."""

    delegation_id: str
    parent_run_id: str
    parent_agent_id: str
    work_instruction_id: str
    plan_revision: int
    step_id: str
    workspace_id: str
    objective: str
    in_scope: tuple[str, ...]
    out_of_scope: tuple[str, ...]
    allowed_paths: tuple[str, ...]
    prohibited_actions: tuple[str, ...]
    permission_profile_id: str
    expected_result_schema: str
    required_evidence: tuple[str, ...]
    budget_ref: str
    completion_conditions: tuple[str, ...]
    baseline_hash: str
    context_snapshot_hash: str
    permission_snapshot: PermissionSnapshot
    permission_snapshot_hash: str
    parent_permission_snapshot_hash: str
    data_egress_profile: DataEgressProfile
    egress_snapshot_hash: str
    parent_egress_snapshot_hash: str
    schema_version: str = "delegation_packet/v1"

    def __post_init__(self) -> None:
        for value, field in (
            (self.delegation_id, "delegation_id"),
            (self.parent_run_id, "parent_run_id"),
            (self.parent_agent_id, "parent_agent_id"),
            (self.work_instruction_id, "work_instruction_id"),
            (self.step_id, "step_id"),
            (self.workspace_id, "workspace_id"),
            (self.objective, "objective"),
            (self.permission_profile_id, "permission_profile_id"),
            (self.expected_result_schema, "expected_result_schema"),
            (self.budget_ref, "budget_ref"),
        ):
            _text(value, field)
        _text(self.schema_version, "schema_version")
        if self.schema_version != "delegation_packet/v1":
            raise _ContractValidationError("UNSUPPORTED_SCHEMA_VERSION", "schema_version")
        if type(self.plan_revision) is not int or self.plan_revision < 1:
            raise ValueError("plan_revision must be a positive integer")
        _paths(self.allowed_paths, "allowed_paths")
        _texts(self.in_scope, "in_scope")
        _texts(self.out_of_scope, "out_of_scope")
        _texts(self.prohibited_actions, "prohibited_actions")
        _texts(self.required_evidence, "required_evidence")
        _texts(self.completion_conditions, "completion_conditions")
        if not isinstance(self.permission_snapshot, PermissionSnapshot):
            raise TypeError("permission_snapshot must be PermissionSnapshot")
        if not isinstance(self.data_egress_profile, DataEgressProfile):
            raise TypeError("data_egress_profile must be DataEgressProfile")
        if self.allowed_paths != self.permission_snapshot.allowed_paths:
            raise _ContractValidationError("PERMISSION_SNAPSHOT_MISMATCH", "allowed_paths")
        if self.prohibited_actions != self.permission_snapshot.prohibited_actions:
            raise _ContractValidationError("PERMISSION_SNAPSHOT_MISMATCH", "prohibited_actions")
        for value, field in (
            (self.baseline_hash, "baseline_hash"),
            (self.context_snapshot_hash, "context_snapshot_hash"),
            (self.permission_snapshot_hash, "permission_snapshot_hash"),
            (self.parent_permission_snapshot_hash, "parent_permission_snapshot_hash"),
            (self.egress_snapshot_hash, "egress_snapshot_hash"),
            (self.parent_egress_snapshot_hash, "parent_egress_snapshot_hash"),
        ):
            _hash(value, field)
        if self.permission_snapshot_hash != self.permission_snapshot.snapshot_hash:
            raise _ContractValidationError(
                "PERMISSION_SNAPSHOT_MISMATCH", "permission_snapshot_hash",
            )
        if self.egress_snapshot_hash != self.data_egress_profile.snapshot_hash:
            raise _ContractValidationError("EGRESS_SNAPSHOT_MISMATCH", "egress_snapshot_hash")

    def _payload_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "delegation_id": self.delegation_id,
            "parent_run_id": self.parent_run_id,
            "parent_agent_id": self.parent_agent_id,
            "work_instruction_id": self.work_instruction_id,
            "plan_revision": self.plan_revision,
            "step_id": self.step_id,
            "workspace_id": self.workspace_id,
            "objective": self.objective,
            "in_scope": list(self.in_scope),
            "out_of_scope": list(self.out_of_scope),
            "allowed_paths": list(self.allowed_paths),
            "prohibited_actions": list(self.prohibited_actions),
            "permission_profile_id": self.permission_profile_id,
            "expected_result_schema": self.expected_result_schema,
            "required_evidence": list(self.required_evidence),
            "budget_ref": self.budget_ref,
            "completion_conditions": list(self.completion_conditions),
            "baseline_hash": self.baseline_hash,
            "context_snapshot_hash": self.context_snapshot_hash,
            "permission_snapshot": self.permission_snapshot.to_dict(),
            "permission_snapshot_hash": self.permission_snapshot_hash,
            "parent_permission_snapshot_hash": self.parent_permission_snapshot_hash,
            "data_egress_profile": self.data_egress_profile.to_dict(),
            "egress_snapshot_hash": self.egress_snapshot_hash,
            "parent_egress_snapshot_hash": self.parent_egress_snapshot_hash,
        }

    def to_dict(self) -> dict[str, Any]:
        value = self._payload_dict()
        value["packet_hash"] = self.packet_hash
        return value

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":"))

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "DelegationPacket":
        if not isinstance(value, Mapping):
            raise TypeError("packet must be a mapping")
        required = {
            "delegation_id", "parent_run_id", "parent_agent_id", "work_instruction_id",
            "plan_revision", "step_id", "workspace_id", "objective", "in_scope",
            "out_of_scope", "allowed_paths", "prohibited_actions", "permission_profile_id",
            "expected_result_schema", "required_evidence", "budget_ref",
            "completion_conditions", "baseline_hash", "context_snapshot_hash",
            "permission_snapshot", "permission_snapshot_hash", "parent_permission_snapshot_hash",
            "data_egress_profile", "egress_snapshot_hash", "parent_egress_snapshot_hash",
            "schema_version", "packet_hash",
        }
        missing = required - set(value)
        if missing:
            raise ValueError(f"required fields missing: {', '.join(sorted(missing))}")
        unknown = set(value) - required
        if unknown:
            raise ValueError("UNKNOWN_FIELD:" + ",".join(sorted(unknown)))
        for field in (
            "in_scope", "out_of_scope", "allowed_paths", "prohibited_actions",
            "required_evidence", "completion_conditions",
        ):
            if not isinstance(value[field], list):
                raise TypeError(f"{field} must be a JSON array")
        candidate = cls(
            delegation_id=value["delegation_id"], parent_run_id=value["parent_run_id"],
            parent_agent_id=value["parent_agent_id"], work_instruction_id=value["work_instruction_id"],
            plan_revision=value["plan_revision"], step_id=value["step_id"], workspace_id=value["workspace_id"],
            objective=value["objective"], in_scope=tuple(value["in_scope"]), out_of_scope=tuple(value["out_of_scope"]),
            allowed_paths=tuple(value["allowed_paths"]), prohibited_actions=tuple(value["prohibited_actions"]),
            permission_profile_id=value["permission_profile_id"],
            expected_result_schema=value["expected_result_schema"],
            required_evidence=tuple(value["required_evidence"]), budget_ref=value["budget_ref"],
            completion_conditions=tuple(value["completion_conditions"]),
            baseline_hash=value["baseline_hash"], context_snapshot_hash=value["context_snapshot_hash"],
            permission_snapshot=PermissionSnapshot.from_dict(value["permission_snapshot"]),
            permission_snapshot_hash=value["permission_snapshot_hash"],
            parent_permission_snapshot_hash=value["parent_permission_snapshot_hash"],
            data_egress_profile=DataEgressProfile.from_dict(value["data_egress_profile"]),
            egress_snapshot_hash=value["egress_snapshot_hash"],
            parent_egress_snapshot_hash=value["parent_egress_snapshot_hash"],
            schema_version=value["schema_version"],
        )
        _hash(value["packet_hash"], "packet_hash")
        if value["packet_hash"] != candidate.packet_hash:
            raise _ContractValidationError("PACKET_HASH_MISMATCH", "packet_hash")
        return candidate

    @classmethod
    def from_json(cls, value: str) -> "DelegationPacket":
        try:
            decoded = json.loads(
                value, object_pairs_hook=_unique_json_object,
                parse_constant=_reject_non_finite,
            )
        except (TypeError, json.JSONDecodeError) as error:
            raise ValueError("packet JSON is invalid") from error
        return cls.from_dict(decoded)

    @property
    def packet_hash(self) -> str:
        return _canonical_hash(self._payload_dict())


@dataclass(frozen=True, slots=True)
class PacketValidationResult:
    valid: bool
    reason_codes: tuple[str, ...] = ()
    fields: tuple[str, ...] = ()
    packet_hash: str | None = None
    parent_permission_snapshot_hash: str | None = None
    child_permission_snapshot_hash: str | None = None
    parent_egress_snapshot_hash: str | None = None
    child_egress_snapshot_hash: str | None = None
    submitted_delegation_id: str | None = None
    submitted_packet_hash: str | None = None
    submitted_parent_permission_snapshot_hash: str | None = None
    submitted_child_permission_snapshot_hash: str | None = None
    submitted_parent_egress_snapshot_hash: str | None = None
    submitted_child_egress_snapshot_hash: str | None = None

    @property
    def verdict(self) -> str:
        return "ACCEPT" if self.valid else "REJECT"

    @property
    def verified_packet_hash(self) -> str | None:
        return self.packet_hash

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": "delegation_validation_receipt/v2",
            "submitted_delegation_id": self.submitted_delegation_id,
            "submitted_packet_hash": self.submitted_packet_hash,
            "verified_packet_hash": self.verified_packet_hash,
            "submitted_parent_permission_snapshot_hash": self.submitted_parent_permission_snapshot_hash,
            "submitted_child_permission_snapshot_hash": self.submitted_child_permission_snapshot_hash,
            "submitted_parent_egress_snapshot_hash": self.submitted_parent_egress_snapshot_hash,
            "submitted_child_egress_snapshot_hash": self.submitted_child_egress_snapshot_hash,
            "verified_parent_permission_snapshot_hash": self.parent_permission_snapshot_hash,
            "verified_child_permission_snapshot_hash": self.child_permission_snapshot_hash,
            "verified_parent_egress_snapshot_hash": self.parent_egress_snapshot_hash,
            "verified_child_egress_snapshot_hash": self.child_egress_snapshot_hash,
            "verdict": self.verdict,
            "reason_codes": list(self.reason_codes),
            "fields": list(self.fields),
        }

    def to_json(self) -> str:
        return json.dumps(
            self.to_dict(), ensure_ascii=False, allow_nan=False,
            sort_keys=True, separators=(",", ":"),
        )


DelegationValidationReceipt = PacketValidationResult
ValidationReceipt = PacketValidationResult


def _submitted_text(value: Mapping[str, Any] | None, field: str) -> str | None:
    if value is None:
        return None
    item = value.get(field)
    return (
        item if isinstance(item, str) and item and item == item.strip()
        and _is_utf8_encodable(item) else None
    )


def _submitted_hash(value: Mapping[str, Any] | None, field: str) -> str | None:
    if value is None:
        return None
    item = value.get(field)
    return item if isinstance(item, str) and _HASH.fullmatch(item) is not None else None


def _verified_snapshot_hash(value: Any, snapshot_type: type[Any]) -> str | None:
    """Return a content hash only after strict, exception-contained parsing."""

    try:
        snapshot = value if isinstance(value, snapshot_type) else snapshot_type.from_dict(value)
        return snapshot.snapshot_hash
    except (TypeError, ValueError, KeyError, UnicodeError):
        return None


def _verified_submitted_snapshot_hash(
    value: Mapping[str, Any] | None, *, content_field: str, hash_field: str,
    snapshot_type: type[Any],
) -> str | None:
    if value is None:
        return None
    verified = _verified_snapshot_hash(value.get(content_field), snapshot_type)
    submitted = _submitted_hash(value, hash_field)
    return verified if verified is not None and verified == submitted else None


def validate_packet(
    packet: DelegationPacket | Mapping[str, Any] | None,
    *,
    baseline_hash: str,
    context_snapshot_hash: str,
    parent_permission_snapshot: PermissionSnapshot | Mapping[str, Any] | None = None,
    parent_egress_profile: DataEgressProfile | Mapping[str, Any] | None = None,
) -> PacketValidationResult:
    """Validate an immutable packet against the snapshots at the start boundary."""

    submitted = (
        packet.to_dict() if isinstance(packet, DelegationPacket)
        else packet if isinstance(packet, Mapping)
        else None
    )
    submitted_delegation_id = _submitted_text(submitted, "delegation_id")
    submitted_packet_hash = _submitted_hash(submitted, "packet_hash")
    submitted_parent_permission_hash = _submitted_hash(submitted, "parent_permission_snapshot_hash")
    submitted_child_permission_hash = _submitted_hash(submitted, "permission_snapshot_hash")
    submitted_parent_egress_hash = _submitted_hash(submitted, "parent_egress_snapshot_hash")
    submitted_child_egress_hash = _submitted_hash(submitted, "egress_snapshot_hash")
    verified_parent_permission_hash = _verified_snapshot_hash(
        parent_permission_snapshot, PermissionSnapshot,
    )
    verified_child_permission_hash = _verified_submitted_snapshot_hash(
        submitted, content_field="permission_snapshot", hash_field="permission_snapshot_hash",
        snapshot_type=PermissionSnapshot,
    )
    verified_parent_egress_hash = _verified_snapshot_hash(
        parent_egress_profile, DataEgressProfile,
    )
    verified_child_egress_hash = _verified_submitted_snapshot_hash(
        submitted, content_field="data_egress_profile", hash_field="egress_snapshot_hash",
        snapshot_type=DataEgressProfile,
    )

    def reject(
        reason: str, fields: tuple[str, ...], *, verified_packet_hash: str | None = None,
    ) -> PacketValidationResult:
        return PacketValidationResult(
            False, (reason,), fields, verified_packet_hash,
            verified_parent_permission_hash, verified_child_permission_hash,
            verified_parent_egress_hash, verified_child_egress_hash,
            submitted_delegation_id, submitted_packet_hash,
            submitted_parent_permission_hash, submitted_child_permission_hash,
            submitted_parent_egress_hash, submitted_child_egress_hash,
        )

    if packet is None:
        return reject("PACKET_REQUIRED", ())
    if isinstance(packet, Mapping):
        required = {
            "delegation_id", "parent_run_id", "parent_agent_id", "work_instruction_id",
            "plan_revision", "step_id", "workspace_id", "objective", "in_scope",
            "out_of_scope", "allowed_paths", "prohibited_actions", "permission_profile_id",
            "expected_result_schema", "required_evidence", "budget_ref",
            "completion_conditions", "baseline_hash", "context_snapshot_hash",
            "permission_snapshot", "permission_snapshot_hash", "parent_permission_snapshot_hash",
            "data_egress_profile", "egress_snapshot_hash", "parent_egress_snapshot_hash",
            "schema_version", "packet_hash",
        }
        keys = tuple(packet.keys())
        if any(not isinstance(key, str) for key in keys):
            return reject("UNKNOWN_FIELD", ("<non_string_key>",))
        present = set(keys)
        missing = tuple(sorted(required - present))
        if missing:
            return reject("REQUIRED_FIELD_MISSING", missing)
        unknown = tuple(sorted(
            _unknown_field_identity(field) for field in present - required
        ))
        if unknown:
            return reject("UNKNOWN_FIELD", unknown)
        text_fields = (
            "delegation_id", "parent_run_id", "parent_agent_id", "work_instruction_id",
            "step_id", "workspace_id", "objective", "permission_profile_id",
            "expected_result_schema", "budget_ref", "schema_version",
        )
        for field in text_fields:
            value = packet[field]
            if not isinstance(value, str):
                return reject("INVALID_FIELD_TYPE", (field,))
            if not value or value != value.strip():
                return reject("EMPTY_FIELD", (field,))
            if not _is_utf8_encodable(value):
                return reject("INVALID_TEXT_ENCODING", (field,))
        if packet["schema_version"] != "delegation_packet/v1":
            return reject("UNSUPPORTED_SCHEMA_VERSION", ("schema_version",))
        if type(packet["plan_revision"]) is not int:
            return reject("INVALID_FIELD_TYPE", ("plan_revision",))
        if packet["plan_revision"] < 1:
            return reject("INVALID_FIELD_VALUE", ("plan_revision",))
        array_fields = (
            "in_scope", "out_of_scope", "allowed_paths", "prohibited_actions",
            "required_evidence", "completion_conditions",
        )
        for field in array_fields:
            if not isinstance(packet[field], list):
                return reject("INVALID_FIELD_TYPE", (field,))
            if not packet[field]:
                return reject("EMPTY_FIELD", (field,))
            if any(not isinstance(item, str) for item in packet[field]):
                return reject("INVALID_FIELD_TYPE", (field,))
            if any(not item or item != item.strip() for item in packet[field]):
                return reject("EMPTY_FIELD", (field,))
            if any(not _is_utf8_encodable(item) for item in packet[field]):
                return reject("INVALID_TEXT_ENCODING", (field,))
            if len(packet[field]) != len(set(packet[field])):
                return reject("DUPLICATE_VALUE", (field,))
        try:
            raw_paths = packet["allowed_paths"]
            if len(raw_paths) != len(set(raw_paths)):
                return reject("DUPLICATE_VALUE", ("allowed_paths",))
            for raw_path in raw_paths:
                if not isinstance(raw_path, str):
                    return reject("INVALID_FIELD_TYPE", ("allowed_paths",))
                _validate_repository_path(raw_path, "allowed_paths")
        except ValueError:
            return reject("PATH_NOT_CANONICAL", ("allowed_paths",))
        permission_error = _mapping_schema_error(
            packet["permission_snapshot"],
            required={
                "schema_version", "allowed_paths", "allowed_actions", "allowed_tools",
                "allowed_backends", "prohibited_paths", "protected_paths", "prohibited_actions",
            },
            arrays=("allowed_paths", "allowed_actions", "allowed_tools", "allowed_backends",
                    "prohibited_paths", "protected_paths", "prohibited_actions"),
            prefix="permission_snapshot",
            path_fields=("allowed_paths", "prohibited_paths", "protected_paths"),
            text_fields=("schema_version",),
            exact_values={
                "schema_version": (("permission_snapshot/v1",), "UNSUPPORTED_SCHEMA_VERSION"),
            },
            path_overlaps=(
                ("allowed_paths", "prohibited_paths", "prohibited_paths"),
                ("allowed_paths", "protected_paths", "protected_paths"),
            ),
            set_overlaps=(("allowed_actions", "prohibited_actions", "allowed_actions"),),
        )
        if permission_error is not None:
            reason, fields = permission_error
            return reject(reason, fields)
        egress_error = _mapping_schema_error(
            packet["data_egress_profile"],
            required={"schema_version", "mode", "provider_allowlist", "approved_paths", "excluded_paths"},
            arrays=("provider_allowlist", "approved_paths", "excluded_paths"),
            prefix="data_egress_profile",
            path_fields=("approved_paths", "excluded_paths"),
            text_fields=("schema_version", "mode"),
            exact_values={
                "schema_version": (("data_egress_profile/v1",), "UNSUPPORTED_SCHEMA_VERSION"),
                "mode": (("local_only", "metadata_only", "approved_paths", "masked_content"),
                         "UNSUPPORTED_EGRESS_MODE"),
            },
            path_overlaps=(("approved_paths", "excluded_paths", "excluded_paths"),),
        )
        if egress_error is not None:
            reason, fields = egress_error
            return reject(reason, fields)
        hash_fields = (
            "baseline_hash", "context_snapshot_hash", "permission_snapshot_hash",
            "parent_permission_snapshot_hash", "egress_snapshot_hash",
            "parent_egress_snapshot_hash", "packet_hash",
        )
        for field in hash_fields:
            if not isinstance(packet[field], str) or _HASH.fullmatch(packet[field]) is None:
                return reject("INVALID_HASH", (field,))
    try:
        candidate = packet if isinstance(packet, DelegationPacket) else DelegationPacket.from_dict(packet)
    except _ContractValidationError as error:
        return reject(error.reason, (error.field,))
    except (TypeError, ValueError):
        return reject("INVALID_FIELD", ())

    missing_validation_inputs = tuple(
        field for field, value in (
            ("parent_permission_snapshot", parent_permission_snapshot),
            ("parent_egress_profile", parent_egress_profile),
        ) if value is None
    )
    if missing_validation_inputs:
        return reject(
            "VALIDATION_INPUT_REQUIRED", missing_validation_inputs,
            verified_packet_hash=candidate.packet_hash,
        )

    if not isinstance(parent_permission_snapshot, PermissionSnapshot):
        parent_permission_error = _mapping_schema_error(
            parent_permission_snapshot,
            required={
                "schema_version", "allowed_paths", "allowed_actions", "allowed_tools",
                "allowed_backends", "prohibited_paths", "protected_paths", "prohibited_actions",
            },
            arrays=("allowed_paths", "allowed_actions", "allowed_tools", "allowed_backends",
                    "prohibited_paths", "protected_paths", "prohibited_actions"),
            prefix="parent_permission_snapshot",
            path_fields=("allowed_paths", "prohibited_paths", "protected_paths"),
            text_fields=("schema_version",),
            exact_values={
                "schema_version": (("permission_snapshot/v1",), "UNSUPPORTED_SCHEMA_VERSION"),
            },
            path_overlaps=(
                ("allowed_paths", "prohibited_paths", "allowed_paths"),
                ("allowed_paths", "protected_paths", "allowed_paths"),
            ),
            set_overlaps=(("allowed_actions", "prohibited_actions", "allowed_actions"),),
        )
        if parent_permission_error is not None:
            reason, fields = parent_permission_error
            return reject(reason, fields, verified_packet_hash=candidate.packet_hash)
    if not isinstance(parent_egress_profile, DataEgressProfile):
        parent_egress_error = _mapping_schema_error(
            parent_egress_profile,
            required={"schema_version", "mode", "provider_allowlist", "approved_paths", "excluded_paths"},
            arrays=("provider_allowlist", "approved_paths", "excluded_paths"),
            prefix="parent_egress_profile",
            path_fields=("approved_paths", "excluded_paths"),
            text_fields=("schema_version", "mode"),
            exact_values={
                "schema_version": (("data_egress_profile/v1",), "UNSUPPORTED_SCHEMA_VERSION"),
                "mode": (("local_only", "metadata_only", "approved_paths", "masked_content"),
                         "UNSUPPORTED_EGRESS_MODE"),
            },
            path_overlaps=(("approved_paths", "excluded_paths", "approved_paths"),),
        )
        if parent_egress_error is not None:
            reason, fields = parent_egress_error
            return reject(reason, fields, verified_packet_hash=candidate.packet_hash)

    try:
        parent_permission = (
            parent_permission_snapshot if isinstance(parent_permission_snapshot, PermissionSnapshot)
            else PermissionSnapshot.from_dict(parent_permission_snapshot)
        )
    except _ContractValidationError as error:
        return reject(
            error.reason, (f"parent_permission_snapshot.{error.field}",),
            verified_packet_hash=candidate.packet_hash,
        )
    except (TypeError, ValueError):
        return reject("INVALID_FIELD", (), verified_packet_hash=candidate.packet_hash)
    try:
        parent_egress = (
            parent_egress_profile if isinstance(parent_egress_profile, DataEgressProfile)
            else DataEgressProfile.from_dict(parent_egress_profile)
        )
    except _ContractValidationError as error:
        return reject(
            error.reason, (f"parent_egress_profile.{error.field}",),
            verified_packet_hash=candidate.packet_hash,
        )
    except (TypeError, ValueError):
        return reject("INVALID_FIELD", (), verified_packet_hash=candidate.packet_hash)

    expected = (
        ("baseline_hash", baseline_hash, "BASELINE_SNAPSHOT_MISMATCH"),
        ("context_snapshot_hash", context_snapshot_hash, "CONTEXT_SNAPSHOT_MISMATCH"),
    )
    reasons: list[str] = []
    fields: list[str] = []
    for field, value, reason in expected:
        try:
            _hash(value, field)
        except ValueError:
            reasons.append("INVALID_HASH")
            fields.append(field)
            continue
        if getattr(candidate, field) != value:
            reasons.append(reason)
            fields.append(field)
    if parent_permission is not None and candidate.parent_permission_snapshot_hash != parent_permission.snapshot_hash:
        reasons.append("PARENT_PERMISSION_SNAPSHOT_MISMATCH")
        fields.append("parent_permission_snapshot_hash")
    if parent_permission is not None:
        child = candidate.permission_snapshot
        permission_checks = (
            (_all_paths_narrower(child.allowed_paths, parent_permission.allowed_paths),
             "CHILD_PATH_SCOPE_EXPANSION", "permission_snapshot.allowed_paths"),
            (set(child.allowed_actions) <= set(parent_permission.allowed_actions),
             "CHILD_ACTION_SCOPE_EXPANSION", "permission_snapshot.allowed_actions"),
            (set(child.allowed_tools) <= set(parent_permission.allowed_tools),
             "CHILD_TOOL_SCOPE_EXPANSION", "permission_snapshot.allowed_tools"),
            (set(child.allowed_backends) <= set(parent_permission.allowed_backends),
             "CHILD_BACKEND_SCOPE_EXPANSION", "permission_snapshot.allowed_backends"),
            (_all_parent_denials_preserved(child.prohibited_paths, parent_permission.prohibited_paths),
             "CHILD_PROHIBITED_PATH_RELAXATION", "permission_snapshot.prohibited_paths"),
            (_all_parent_denials_preserved(child.protected_paths, parent_permission.protected_paths),
             "CHILD_PROTECTED_PATH_RELAXATION", "permission_snapshot.protected_paths"),
            (set(parent_permission.prohibited_actions) <= set(child.prohibited_actions),
             "CHILD_PROHIBITED_ACTION_RELAXATION", "permission_snapshot.prohibited_actions"),
        )
        for accepted, reason, field in permission_checks:
            if not accepted:
                reasons.append(reason)
                fields.append(field)
    if parent_egress is not None and candidate.parent_egress_snapshot_hash != parent_egress.snapshot_hash:
        reasons.append("PARENT_EGRESS_SNAPSHOT_MISMATCH")
        fields.append("parent_egress_snapshot_hash")
    if parent_egress is not None:
        child_egress = candidate.data_egress_profile
        egress_checks = (
            (child_egress.mode == parent_egress.mode,
             "EGRESS_MODE_MISMATCH", "data_egress_profile.mode"),
            (set(child_egress.provider_allowlist) <= set(parent_egress.provider_allowlist),
             "EGRESS_PROVIDER_EXPANSION", "data_egress_profile.provider_allowlist"),
            (_all_paths_narrower(child_egress.approved_paths, parent_egress.approved_paths),
             "EGRESS_APPROVED_PATH_EXPANSION", "data_egress_profile.approved_paths"),
            (_all_parent_denials_preserved(child_egress.excluded_paths, parent_egress.excluded_paths),
             "EGRESS_EXCLUDED_PATH_RELAXATION", "data_egress_profile.excluded_paths"),
        )
        for accepted, reason, field in egress_checks:
            if not accepted:
                reasons.append(reason)
                fields.append(field)
    return PacketValidationResult(
        not reasons, tuple(dict.fromkeys(reasons)), tuple(fields),
        candidate.packet_hash,
        None if parent_permission is None else parent_permission.snapshot_hash,
        candidate.permission_snapshot.snapshot_hash,
        None if parent_egress is None else parent_egress.snapshot_hash,
        candidate.data_egress_profile.snapshot_hash,
        submitted_delegation_id, submitted_packet_hash,
        submitted_parent_permission_hash, submitted_child_permission_hash,
        submitted_parent_egress_hash, submitted_child_egress_hash,
    )


__all__ = [
    "DataEgressProfile", "DataEgressSnapshot", "PermissionSnapshot",
    "PermissionProfileSnapshot", "DelegationPacket", "PacketValidationResult",
    "DelegationValidationReceipt", "ValidationReceipt", "validate_packet",
]
