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


def _text(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


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
    encoded = json.dumps(
        value, ensure_ascii=False, allow_nan=False,
        sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True, slots=True)
class DelegationPacket:
    """Frozen minimum envelope passed from Main Agent to a Developer.

    Snapshot hashes are supplied by the caller and are compared again at the
    worker boundary by :func:`validate_packet`; this prevents a stale packet
    from silently inheriting a changed permission, context, or egress policy.
    """

    delegation_id: str
    parent_run_id: str
    parent_agent_id: str
    work_instruction_id: str
    plan_revision: int
    step_id: str
    objective: str
    allowed_paths: tuple[str, ...]
    prohibited_actions: tuple[str, ...]
    completion_conditions: tuple[str, ...]
    baseline_hash: str
    permission_snapshot_hash: str
    context_snapshot_hash: str
    egress_snapshot_hash: str
    schema_version: str = "delegation_packet/v1"

    def __post_init__(self) -> None:
        for value, field in (
            (self.delegation_id, "delegation_id"),
            (self.parent_run_id, "parent_run_id"),
            (self.parent_agent_id, "parent_agent_id"),
            (self.work_instruction_id, "work_instruction_id"),
            (self.step_id, "step_id"),
            (self.objective, "objective"),
        ):
            _text(value, field)
        if self.schema_version != "delegation_packet/v1":
            raise ValueError("unsupported schema_version")
        if type(self.plan_revision) is not int or self.plan_revision < 1:
            raise ValueError("plan_revision must be a positive integer")
        _paths(self.allowed_paths, "allowed_paths")
        _texts(self.prohibited_actions, "prohibited_actions")
        _texts(self.completion_conditions, "completion_conditions")
        if frozenset(self.allowed_paths) & frozenset(self.prohibited_actions):
            raise ValueError("allowed_paths and prohibited_actions must not overlap")
        for value, field in (
            (self.baseline_hash, "baseline_hash"),
            (self.permission_snapshot_hash, "permission_snapshot_hash"),
            (self.context_snapshot_hash, "context_snapshot_hash"),
            (self.egress_snapshot_hash, "egress_snapshot_hash"),
        ):
            _hash(value, field)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "delegation_id": self.delegation_id,
            "parent_run_id": self.parent_run_id,
            "parent_agent_id": self.parent_agent_id,
            "work_instruction_id": self.work_instruction_id,
            "plan_revision": self.plan_revision,
            "step_id": self.step_id,
            "objective": self.objective,
            "allowed_paths": list(self.allowed_paths),
            "prohibited_actions": list(self.prohibited_actions),
            "completion_conditions": list(self.completion_conditions),
            "baseline_hash": self.baseline_hash,
            "permission_snapshot_hash": self.permission_snapshot_hash,
            "context_snapshot_hash": self.context_snapshot_hash,
            "egress_snapshot_hash": self.egress_snapshot_hash,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":"))

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "DelegationPacket":
        if not isinstance(value, Mapping):
            raise TypeError("packet must be a mapping")
        required = {
            "delegation_id", "parent_run_id", "parent_agent_id", "work_instruction_id",
            "plan_revision", "step_id", "objective", "allowed_paths", "prohibited_actions",
            "completion_conditions", "baseline_hash", "permission_snapshot_hash",
            "context_snapshot_hash", "egress_snapshot_hash",
        }
        missing = required - set(value)
        if missing:
            raise ValueError(f"required fields missing: {', '.join(sorted(missing))}")
        return cls(
            delegation_id=value["delegation_id"], parent_run_id=value["parent_run_id"],
            parent_agent_id=value["parent_agent_id"], work_instruction_id=value["work_instruction_id"],
            plan_revision=value["plan_revision"], step_id=value["step_id"], objective=value["objective"],
            allowed_paths=tuple(value["allowed_paths"]), prohibited_actions=tuple(value["prohibited_actions"]),
            completion_conditions=tuple(value["completion_conditions"]), baseline_hash=value["baseline_hash"],
            permission_snapshot_hash=value["permission_snapshot_hash"],
            context_snapshot_hash=value["context_snapshot_hash"], egress_snapshot_hash=value["egress_snapshot_hash"],
            schema_version=value.get("schema_version", "delegation_packet/v1"),
        )

    @classmethod
    def from_json(cls, value: str) -> "DelegationPacket":
        try:
            decoded = json.loads(value)
        except (TypeError, json.JSONDecodeError) as error:
            raise ValueError("packet JSON is invalid") from error
        return cls.from_dict(decoded)

    @property
    def packet_hash(self) -> str:
        return _canonical_hash(self.to_dict())


@dataclass(frozen=True, slots=True)
class PacketValidationResult:
    valid: bool
    reason_codes: tuple[str, ...] = ()
    fields: tuple[str, ...] = ()


def validate_packet(
    packet: DelegationPacket | Mapping[str, Any] | None,
    *,
    baseline_hash: str,
    permission_snapshot_hash: str,
    context_snapshot_hash: str,
    egress_snapshot_hash: str,
) -> PacketValidationResult:
    """Validate an immutable packet against the snapshots at the start boundary."""

    if packet is None:
        return PacketValidationResult(False, ("PACKET_REQUIRED",), ())
    try:
        candidate = packet if isinstance(packet, DelegationPacket) else DelegationPacket.from_dict(packet)
    except (TypeError, ValueError) as error:
        message = str(error)
        if "required fields missing" in message:
            return PacketValidationResult(False, ("REQUIRED_FIELD_MISSING",), ())
        if "must not overlap" in message:
            return PacketValidationResult(False, ("PATH_SCOPE_CONFLICT",), ())
        if "path" in message:
            return PacketValidationResult(False, ("PATH_NOT_CANONICAL",), ())
        if "hash" in message:
            return PacketValidationResult(False, ("INVALID_HASH",), ())
        return PacketValidationResult(False, ("INVALID_FIELD",), ())

    expected = (
        ("baseline_hash", baseline_hash, "BASELINE_SNAPSHOT_MISMATCH"),
        ("permission_snapshot_hash", permission_snapshot_hash, "PERMISSION_SNAPSHOT_MISMATCH"),
        ("context_snapshot_hash", context_snapshot_hash, "CONTEXT_SNAPSHOT_MISMATCH"),
        ("egress_snapshot_hash", egress_snapshot_hash, "EGRESS_SNAPSHOT_MISMATCH"),
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
    return PacketValidationResult(not reasons, tuple(dict.fromkeys(reasons)), tuple(fields))


__all__ = ["DelegationPacket", "PacketValidationResult", "validate_packet"]
