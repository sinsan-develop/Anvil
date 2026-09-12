"""구조화된 Developer Result 계약과 결정론적 validator (C-05).

이 모듈은 runner가 반환한 결과를 집계하거나 상태를 전이하지 않는다. 입력을
불변 구조로 정규화하고, 계약을 만족하는지 fail-closed로 판정하는 책임만 가진다.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import hashlib
import json
import math
import re
from types import MappingProxyType
from typing import Any, Mapping

from packages.execution.models import ResultStatus
from .delegation import _text as _validate_c02_text


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


class ResultReasonCode(StrEnum):
    REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING"
    INVALID_FIELD = "INVALID_FIELD"
    INVALID_STATUS = "INVALID_STATUS"
    INVALID_HASH = "INVALID_HASH"
    INVALID_EVIDENCE = "INVALID_EVIDENCE"
    EVIDENCE_REQUIRED = "EVIDENCE_REQUIRED"
    STATUS_CONDITION_FAILED = "STATUS_CONDITION_FAILED"
    UNKNOWN_FIELD = "UNKNOWN_FIELD"


class ResultDomainReasonCode(StrEnum):
    RESULT_CONTRACT_INCOMPLETE = "RESULT_CONTRACT_INCOMPLETE"
    TRANSIENT_EXECUTION_ERROR = "TRANSIENT_EXECUTION_ERROR"
    CHECKPOINTED_INTERRUPTION = "CHECKPOINTED_INTERRUPTION"
    DECISION_REQUIRED = "DECISION_REQUIRED"
    POLICY_BLOCKED = "POLICY_BLOCKED"
    ENVIRONMENT_BLOCKED = "ENVIRONMENT_BLOCKED"
    PERMISSION_BLOCKED = "PERMISSION_BLOCKED"
    DELEGATION_REASSIGN = "DELEGATION_REASSIGN"
    RUN_CANCEL_REQUESTED = "RUN_CANCEL_REQUESTED"


_REASON_CODES_BY_STATUS = {
    ResultStatus.COMPLETED: frozenset(),
    ResultStatus.FAILURE_REPORT: frozenset(),
    ResultStatus.INCOMPLETE: frozenset(
        {
            ResultDomainReasonCode.RESULT_CONTRACT_INCOMPLETE,
            ResultDomainReasonCode.TRANSIENT_EXECUTION_ERROR,
            ResultDomainReasonCode.CHECKPOINTED_INTERRUPTION,
        }
    ),
    ResultStatus.BLOCKED: frozenset(
        {
            ResultDomainReasonCode.DECISION_REQUIRED,
            ResultDomainReasonCode.POLICY_BLOCKED,
            ResultDomainReasonCode.ENVIRONMENT_BLOCKED,
            ResultDomainReasonCode.PERMISSION_BLOCKED,
        }
    ),
    ResultStatus.CANCELLED: frozenset(
        {
            ResultDomainReasonCode.DELEGATION_REASSIGN,
            ResultDomainReasonCode.RUN_CANCEL_REQUESTED,
        }
    ),
}

_HANDOFF_MAX_CANONICAL_BYTES = 65_536
_HANDOFF_MAX_DEPTH = 8
_HANDOFF_MAX_OBJECT_KEYS = 128
_HANDOFF_MAX_ARRAY_ITEMS = 256
_HANDOFF_MAX_STRING_BYTES = 16_384
_FORBIDDEN_HANDOFF_KEYS = frozenset(
    {
        "transcript",
        "transcripts",
        "stdout",
        "stderr",
        "rawlog",
        "rawlogs",
        "rawtranscript",
        "rawtranscripts",
    }
)


class _ResultContractError(ValueError):
    def __init__(self, reason: ResultReasonCode, field: str) -> None:
        self.reason = reason
        self.field = field
        super().__init__(f"{reason.value}:{field}")


def _invalid(reason: ResultReasonCode, field: str) -> None:
    raise _ResultContractError(reason, field)


def _text(value: Any, field: str) -> None:
    try:
        _validate_c02_text(value, field)
    except (TypeError, ValueError, UnicodeError) as error:
        raise _ResultContractError(ResultReasonCode.INVALID_FIELD, field) from error


def _hash(value: Any, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        _invalid(ResultReasonCode.INVALID_HASH, field)


def _texts(values: Any, field: str, *, allow_empty: bool = True) -> tuple[str, ...]:
    if not isinstance(values, (list, tuple)):
        _invalid(ResultReasonCode.INVALID_FIELD, field)
    result = tuple(values)
    if not allow_empty and not result:
        _invalid(ResultReasonCode.INVALID_FIELD, field)
    for value in result:
        _text(value, f"{field} item")
    if len(result) != len(set(result)):
        _invalid(ResultReasonCode.INVALID_FIELD, field)
    return result


def _snapshot_mapping(value: Mapping[Any, Any], field: str) -> dict[str, Any]:
    try:
        items = list(value.items())
    except Exception as error:
        raise _ResultContractError(ResultReasonCode.INVALID_FIELD, field) from error
    snapshot: dict[str, Any] = {}
    for key, item in items:
        if not isinstance(key, str) or key in snapshot:
            _invalid(ResultReasonCode.INVALID_FIELD, field)
        snapshot[key] = item
    return snapshot


def _json_text(value: str, field: str) -> None:
    try:
        size = len(value.encode("utf-8", errors="strict"))
    except UnicodeEncodeError as error:
        raise _ResultContractError(ResultReasonCode.INVALID_FIELD, field) from error
    if size > _HANDOFF_MAX_STRING_BYTES:
        _invalid(ResultReasonCode.INVALID_FIELD, field)


def _normalized_handoff_key(value: str) -> str:
    return "".join(
        character
        for character in value.casefold()
        if character not in "_-" and not character.isspace()
    )


def _freeze_json_value(
    value: Any,
    field: str,
    *,
    depth: int = 0,
    seen: set[int] | None = None,
    handoff_keys: bool = False,
    allow_frozen_tuple: bool = False,
) -> Any:
    if depth > _HANDOFF_MAX_DEPTH:
        _invalid(ResultReasonCode.INVALID_FIELD, field)
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            _invalid(ResultReasonCode.INVALID_FIELD, field)
        return value
    if isinstance(value, str):
        _json_text(value, field)
        return value

    active = seen if seen is not None else set()
    identity = id(value)
    if identity in active:
        _invalid(ResultReasonCode.INVALID_FIELD, field)

    if isinstance(value, Mapping):
        active.add(identity)
        try:
            snapshot = _snapshot_mapping(value, field)
            if len(snapshot) > _HANDOFF_MAX_OBJECT_KEYS:
                _invalid(ResultReasonCode.INVALID_FIELD, field)
            frozen: dict[str, Any] = {}
            for key, item in snapshot.items():
                _json_text(key, field)
                normalized = _normalized_handoff_key(key)
                if handoff_keys and (
                    any(token in normalized for token in _FORBIDDEN_HANDOFF_KEYS)
                ):
                    _invalid(ResultReasonCode.INVALID_FIELD, "handoff")
                frozen[key] = _freeze_json_value(
                    item,
                    f"{field}.{key}",
                    depth=depth + 1,
                    seen=active,
                    handoff_keys=handoff_keys,
                    allow_frozen_tuple=allow_frozen_tuple,
                )
        finally:
            active.discard(identity)
        return MappingProxyType(frozen)

    if isinstance(value, list) or (allow_frozen_tuple and isinstance(value, tuple)):
        active.add(identity)
        try:
            snapshot = list(value)
            if len(snapshot) > _HANDOFF_MAX_ARRAY_ITEMS:
                _invalid(ResultReasonCode.INVALID_FIELD, field)
            frozen_items = []
            for index, item in enumerate(snapshot):
                frozen_items.append(_freeze_json_value(
                    item,
                    f"{field}[{index}]",
                    depth=depth + 1,
                    seen=active,
                    handoff_keys=handoff_keys,
                    allow_frozen_tuple=allow_frozen_tuple,
                ))
        finally:
            active.discard(identity)
        return tuple(frozen_items)

    _invalid(ResultReasonCode.INVALID_FIELD, field)


@dataclass(frozen=True, slots=True)
class EvidenceReference:
    """Immutable pointer to evidence; a reference without a checksum is invalid."""

    evidence_id: str
    checksum: str
    kind: str = "artifact"

    def __post_init__(self) -> None:
        _text(self.evidence_id, "evidence_id")
        _hash(self.checksum, "checksum")
        _text(self.kind, "kind")

    def to_dict(self) -> dict[str, str]:
        return {"evidence_id": self.evidence_id, "checksum": self.checksum, "kind": self.kind}

    @classmethod
    def from_dict(cls, value: Mapping[str, Any] | str) -> "EvidenceReference":
        if not isinstance(value, Mapping):
            _invalid(ResultReasonCode.INVALID_EVIDENCE, "evidence_refs")
        try:
            value = _snapshot_mapping(value, "evidence_refs")
        except _ResultContractError as error:
            raise _ResultContractError(ResultReasonCode.INVALID_EVIDENCE, "evidence_refs") from error
        required = {"evidence_id", "checksum"}
        if required - set(value):
            _invalid(ResultReasonCode.INVALID_EVIDENCE, "evidence_refs")
        unknown = set(value) - {"evidence_id", "checksum", "kind"}
        if unknown:
            _invalid(ResultReasonCode.INVALID_EVIDENCE, "evidence_refs")
        try:
            return cls(value["evidence_id"], value["checksum"], value.get("kind", "artifact"))
        except _ResultContractError as error:
            raise _ResultContractError(ResultReasonCode.INVALID_EVIDENCE, "evidence_refs") from error


@dataclass(frozen=True, slots=True)
class ResultTest:
    command: str
    status: str
    exit_code: int | None = None

    def __post_init__(self) -> None:
        _text(self.command, "tests.command")
        _text(self.status, "tests.status")
        if self.exit_code is not None and type(self.exit_code) is not int:
            raise ValueError("tests.exit_code must be an integer or null")

    def to_dict(self) -> dict[str, Any]:
        return {"command": self.command, "status": self.status, "exit_code": self.exit_code}

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "ResultTest":
        if not isinstance(value, Mapping):
            _invalid(ResultReasonCode.INVALID_FIELD, "tests")
        value = _snapshot_mapping(value, "tests")
        if {"command", "status"} - set(value):
            _invalid(ResultReasonCode.INVALID_FIELD, "tests")
        if set(value) - {"command", "status", "exit_code"}:
            _invalid(ResultReasonCode.INVALID_FIELD, "tests")
        return cls(value["command"], value["status"], value.get("exit_code"))


def _thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: _thaw(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [_thaw(v) for v in value]
    return value


@dataclass(frozen=True, slots=True)
class ResultEnvelope:
    schema_version: str
    result_id: str
    delegation_id: str
    attempt_id: str
    attempt_number: int
    step_lineage_id: str
    status: ResultStatus
    target_hash: str
    summary: str
    actions_taken: tuple[str, ...] = ()
    changed_paths: tuple[str, ...] = ()
    evidence_refs: tuple[EvidenceReference, ...] = ()
    tests: tuple[ResultTest, ...] = ()
    issue_id: str | None = None
    failure_fingerprint: str | None = None
    assumptions: tuple[str, ...] = ()
    unresolved: tuple[str, ...] = ()
    decision_needed: str | None = None
    checkpoint_ref: str | None = None
    handoff: Mapping[str, Any] = MappingProxyType({})
    reason_code: ResultDomainReasonCode | None = None

    def __post_init__(self) -> None:
        if self.schema_version != "subagent_result/v1":
            _invalid(ResultReasonCode.INVALID_FIELD, "schema_version")
        for value, field in ((self.result_id, "result_id"), (self.delegation_id, "delegation_id"),
                             (self.attempt_id, "attempt_id"), (self.step_lineage_id, "step_lineage_id"),
                             (self.summary, "summary")):
            _text(value, field)
        if not isinstance(self.status, ResultStatus):
            _invalid(ResultReasonCode.INVALID_STATUS, "status")
        if type(self.attempt_number) is not int or self.attempt_number < 1:
            _invalid(ResultReasonCode.INVALID_FIELD, "attempt_number")
        _hash(self.target_hash, "target_hash")
        for value, field in ((self.actions_taken, "actions_taken"), (self.changed_paths, "changed_paths"),
                             (self.assumptions, "assumptions"), (self.unresolved, "unresolved")):
            object.__setattr__(self, field, _texts(value, field))
        if not isinstance(self.evidence_refs, (list, tuple)) or any(
            not isinstance(item, EvidenceReference) for item in self.evidence_refs
        ):
            _invalid(ResultReasonCode.INVALID_EVIDENCE, "evidence_refs")
        object.__setattr__(self, "evidence_refs", tuple(self.evidence_refs))
        if len({item.evidence_id for item in self.evidence_refs}) != len(self.evidence_refs):
            _invalid(ResultReasonCode.INVALID_EVIDENCE, "evidence_refs")
        if not isinstance(self.tests, (list, tuple)) or any(
            not isinstance(item, ResultTest) for item in self.tests
        ):
            _invalid(ResultReasonCode.INVALID_FIELD, "tests")
        object.__setattr__(self, "tests", tuple(self.tests))
        for value, field in ((self.issue_id, "issue_id"), (self.failure_fingerprint, "failure_fingerprint"),
                             (self.decision_needed, "decision_needed"), (self.checkpoint_ref, "checkpoint_ref")):
            if value is not None:
                _text(value, field)
        if not isinstance(self.handoff, Mapping):
            _invalid(ResultReasonCode.INVALID_FIELD, "handoff")
        frozen_handoff = _freeze_json_value(
            self.handoff,
            "handoff",
            handoff_keys=True,
            # Mapping input is checked by from_dict with list-only JSON arrays.
            # Direct typed construction keeps the pre-C05 tuple contract.
            allow_frozen_tuple=True,
        )
        try:
            encoded_handoff = canonical_json(_thaw(frozen_handoff)).encode("utf-8", errors="strict")
        except (TypeError, ValueError, UnicodeError, RecursionError) as error:
            raise _ResultContractError(ResultReasonCode.INVALID_FIELD, "handoff") from error
        if len(encoded_handoff) > _HANDOFF_MAX_CANONICAL_BYTES:
            _invalid(ResultReasonCode.INVALID_FIELD, "handoff")
        object.__setattr__(self, "handoff", frozen_handoff)
        if self.reason_code is not None and not isinstance(self.reason_code, ResultDomainReasonCode):
            try:
                object.__setattr__(self, "reason_code", ResultDomainReasonCode(self.reason_code))
            except (TypeError, ValueError) as error:
                raise _ResultContractError(ResultReasonCode.INVALID_FIELD, "reason_code") from error

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version, "result_id": self.result_id,
            "delegation_id": self.delegation_id, "attempt_id": self.attempt_id,
            "attempt_number": self.attempt_number, "step_lineage_id": self.step_lineage_id,
            "status": self.status.value, "target_hash": self.target_hash, "summary": self.summary,
            "actions_taken": list(self.actions_taken), "changed_paths": list(self.changed_paths),
            "evidence_refs": [item.to_dict() for item in self.evidence_refs],
            "tests": [item.to_dict() for item in self.tests], "issue_id": self.issue_id,
            "failure_fingerprint": self.failure_fingerprint, "assumptions": list(self.assumptions),
            "unresolved": list(self.unresolved), "decision_needed": self.decision_needed,
            "checkpoint_ref": self.checkpoint_ref, "handoff": _thaw(self.handoff),
            "reason_code": self.reason_code.value if self.reason_code is not None else None,
        }

    def to_json(self) -> str:
        return canonical_json(self.to_dict())

    @property
    def canonical_hash(self) -> str:
        return canonical_hash(self.to_dict())

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "ResultEnvelope":
        if not isinstance(value, Mapping):
            _invalid(ResultReasonCode.INVALID_FIELD, "result")
        value = _snapshot_mapping(value, "result")
        required = {"schema_version", "result_id", "delegation_id", "attempt_id", "attempt_number",
                    "step_lineage_id", "status", "target_hash", "summary", "actions_taken", "changed_paths",
                    "evidence_refs", "tests", "assumptions", "unresolved", "handoff"}
        missing = required - set(value)
        if missing:
            _invalid(ResultReasonCode.REQUIRED_FIELD_MISSING, sorted(missing)[0])
        unknown = set(value) - set(cls.__dataclass_fields__)
        if unknown:
            _invalid(ResultReasonCode.UNKNOWN_FIELD, sorted(unknown)[0])
        for field in ("actions_taken", "changed_paths", "evidence_refs", "tests", "assumptions", "unresolved"):
            if not isinstance(value[field], list):
                _invalid(ResultReasonCode.INVALID_FIELD, field)
        if not isinstance(value["handoff"], Mapping):
            _invalid(ResultReasonCode.INVALID_FIELD, "handoff")
        try:
            frozen_handoff = _freeze_json_value(value["handoff"], "handoff", handoff_keys=True)
        except _ResultContractError as error:
            raise _ResultContractError(ResultReasonCode.INVALID_FIELD, "handoff") from error
        try:
            status = ResultStatus(value["status"])
        except (TypeError, ValueError) as error:
            raise _ResultContractError(ResultReasonCode.INVALID_STATUS, "status") from error
        return cls(schema_version=value["schema_version"], result_id=value["result_id"],
                   delegation_id=value["delegation_id"], attempt_id=value["attempt_id"],
                   attempt_number=value["attempt_number"], step_lineage_id=value["step_lineage_id"], status=status,
                   target_hash=value["target_hash"], summary=value["summary"],
                   actions_taken=tuple(value["actions_taken"]), changed_paths=tuple(value["changed_paths"]),
                   evidence_refs=tuple(EvidenceReference.from_dict(item) for item in value["evidence_refs"]),
                   tests=tuple(ResultTest.from_dict(item) for item in value["tests"]),
                   issue_id=value.get("issue_id"), failure_fingerprint=value.get("failure_fingerprint"),
                   assumptions=tuple(value["assumptions"]), unresolved=tuple(value["unresolved"]),
                   decision_needed=value.get("decision_needed"), checkpoint_ref=value.get("checkpoint_ref"),
                   handoff=frozen_handoff, reason_code=value.get("reason_code"))


@dataclass(frozen=True, slots=True)
class ResultValidationResult:
    valid: bool
    reason_codes: tuple[str, ...] = ()
    fields: tuple[str, ...] = ()


def validate_result(result: ResultEnvelope | Mapping[str, Any] | None) -> ResultValidationResult:
    if result is None:
        return ResultValidationResult(False, (ResultReasonCode.REQUIRED_FIELD_MISSING.value,), ("result",))
    try:
        candidate = result if isinstance(result, ResultEnvelope) else ResultEnvelope.from_dict(result)
    except _ResultContractError as error:
        return ResultValidationResult(False, (error.reason.value,), (error.field,))
    except Exception:
        # Validation is a trust boundary: malformed Mapping implementations
        # and unsupported user objects must not leak implementation exceptions.
        return ResultValidationResult(False, (ResultReasonCode.INVALID_FIELD.value,), ())
    reasons: list[str] = []
    fields: list[str] = []
    if not candidate.evidence_refs:
        reasons.append(ResultReasonCode.EVIDENCE_REQUIRED.value); fields.append("evidence_refs")
    if candidate.status is ResultStatus.COMPLETED and (not candidate.tests or candidate.unresolved):
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("tests/unresolved")
    if candidate.status is ResultStatus.BLOCKED and not candidate.decision_needed:
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("decision_needed")
    if candidate.status is ResultStatus.CANCELLED and not candidate.unresolved:
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("unresolved")
    allowed = _REASON_CODES_BY_STATUS[candidate.status]
    if not allowed:
        if candidate.reason_code is not None:
            reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("reason_code")
    elif candidate.reason_code not in allowed:
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("reason_code")
    if (
        candidate.reason_code is ResultDomainReasonCode.CHECKPOINTED_INTERRUPTION
        and candidate.checkpoint_ref is None
    ):
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("checkpoint_ref")
    return ResultValidationResult(not reasons, tuple(dict.fromkeys(reasons)), tuple(dict.fromkeys(fields)))


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))


def canonical_hash(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


__all__ = ["EvidenceReference", "ResultTest", "ResultEnvelope", "ResultReasonCode", "ResultDomainReasonCode",
           "ResultValidationResult", "validate_result", "canonical_json", "canonical_hash"]
