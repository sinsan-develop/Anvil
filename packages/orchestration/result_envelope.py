"""구조화된 Developer Result 계약과 결정론적 validator (C-05).

이 모듈은 runner가 반환한 결과를 집계하거나 상태를 전이하지 않는다. 입력을
불변 구조로 정규화하고, 계약을 만족하는지 fail-closed로 판정하는 책임만 가진다.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import hashlib
import json
import re
from types import MappingProxyType
from typing import Any, Mapping

from packages.execution.models import ResultStatus


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


def _text(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: Any, field: str) -> None:
    if not isinstance(value, str) or _HASH.fullmatch(value) is None:
        raise ValueError(f"{field} must be a canonical lowercase sha256 hash")


def _texts(values: Any, field: str, *, allow_empty: bool = True) -> tuple[str, ...]:
    if not isinstance(values, (list, tuple)):
        raise ValueError(f"{field} must be an array")
    result = tuple(values)
    if not allow_empty and not result:
        raise ValueError(f"{field} must not be empty")
    for value in result:
        _text(value, f"{field} item")
    if len(result) != len(set(result)):
        raise ValueError(f"{field} must not contain duplicates")
    return result


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
        if isinstance(value, str):
            raise ValueError("evidence reference must include checksum")
        if not isinstance(value, Mapping):
            raise TypeError("evidence reference must be an object")
        required = {"evidence_id", "checksum"}
        if required - set(value):
            raise ValueError("evidence reference required fields missing")
        return cls(str(value["evidence_id"]), str(value["checksum"]), str(value.get("kind", "artifact")))


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


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(k): _freeze(v) for k, v in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(v) for v in value)
    return value


def _thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(k): _thaw(v) for k, v in value.items()}
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

    def __post_init__(self) -> None:
        if self.schema_version != "subagent_result/v1":
            raise ValueError("unsupported schema_version")
        for value, field in ((self.result_id, "result_id"), (self.delegation_id, "delegation_id"),
                             (self.attempt_id, "attempt_id"), (self.step_lineage_id, "step_lineage_id"),
                             (self.summary, "summary")):
            _text(value, field)
        if not isinstance(self.status, ResultStatus):
            raise TypeError("status must be ResultStatus")
        if type(self.attempt_number) is not int or self.attempt_number < 1:
            raise ValueError("attempt_number must be a positive integer")
        _hash(self.target_hash, "target_hash")
        for value, field in ((self.actions_taken, "actions_taken"), (self.changed_paths, "changed_paths"),
                             (self.assumptions, "assumptions"), (self.unresolved, "unresolved")):
            object.__setattr__(self, field, _texts(value, field))
        if any(not isinstance(item, EvidenceReference) for item in self.evidence_refs):
            raise TypeError("evidence_refs must contain EvidenceReference values")
        object.__setattr__(self, "evidence_refs", tuple(self.evidence_refs))
        if len({item.evidence_id for item in self.evidence_refs}) != len(self.evidence_refs):
            raise ValueError("evidence_refs must not contain duplicates")
        if any(not isinstance(item, ResultTest) for item in self.tests):
            raise TypeError("tests must contain ResultTest values")
        object.__setattr__(self, "tests", tuple(self.tests))
        for value, field in ((self.issue_id, "issue_id"), (self.failure_fingerprint, "failure_fingerprint"),
                             (self.decision_needed, "decision_needed"), (self.checkpoint_ref, "checkpoint_ref")):
            if value is not None:
                _text(value, field)
        if not isinstance(self.handoff, Mapping):
            raise TypeError("handoff must be an object")
        object.__setattr__(self, "handoff", _freeze(self.handoff))

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
        }

    def to_json(self) -> str:
        return canonical_json(self.to_dict())

    @property
    def canonical_hash(self) -> str:
        return canonical_hash(self.to_dict())

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "ResultEnvelope":
        if not isinstance(value, Mapping):
            raise TypeError("result must be an object")
        required = {"schema_version", "result_id", "delegation_id", "attempt_id", "attempt_number",
                    "step_lineage_id", "status", "target_hash", "summary", "actions_taken", "changed_paths",
                    "evidence_refs", "tests", "assumptions", "unresolved", "handoff"}
        missing = required - set(value)
        if missing:
            raise ValueError("required fields missing: " + ", ".join(sorted(missing)))
        unknown = set(value) - set(cls.__dataclass_fields__)
        if unknown:
            raise ValueError("unknown fields: " + ", ".join(sorted(unknown)))
        try:
            status = ResultStatus(value["status"])
        except (TypeError, ValueError) as error:
            raise ValueError("invalid status") from error
        return cls(schema_version=value["schema_version"], result_id=value["result_id"],
                   delegation_id=value["delegation_id"], attempt_id=value["attempt_id"],
                   attempt_number=value["attempt_number"], step_lineage_id=value["step_lineage_id"], status=status,
                   target_hash=value["target_hash"], summary=value["summary"],
                   actions_taken=tuple(value["actions_taken"]), changed_paths=tuple(value["changed_paths"]),
                   evidence_refs=tuple(EvidenceReference.from_dict(item) for item in value["evidence_refs"]),
                   tests=tuple(ResultTest(item["command"], item["status"], item.get("exit_code")) for item in value["tests"]),
                   issue_id=value.get("issue_id"), failure_fingerprint=value.get("failure_fingerprint"),
                   assumptions=tuple(value["assumptions"]), unresolved=tuple(value["unresolved"]),
                   decision_needed=value.get("decision_needed"), checkpoint_ref=value.get("checkpoint_ref"),
                   handoff=value["handoff"])


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
    except (TypeError, ValueError) as error:
        message = str(error)
        reason = ResultReasonCode.REQUIRED_FIELD_MISSING if "required fields missing" in message else ResultReasonCode.INVALID_FIELD
        if "status" in message and "invalid" in message: reason = ResultReasonCode.INVALID_STATUS
        if "hash" in message: reason = ResultReasonCode.INVALID_HASH
        if "evidence" in message: reason = ResultReasonCode.INVALID_EVIDENCE
        return ResultValidationResult(False, (reason.value,), ())
    reasons: list[str] = []
    fields: list[str] = []
    if not candidate.evidence_refs:
        reasons.append(ResultReasonCode.EVIDENCE_REQUIRED.value); fields.append("evidence_refs")
    if candidate.status is ResultStatus.COMPLETED and (not candidate.tests or candidate.unresolved):
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("tests/unresolved")
    if candidate.status is ResultStatus.FAILURE_REPORT and (not candidate.failure_fingerprint or not candidate.unresolved):
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("failure_fingerprint/unresolved")
    if candidate.status is ResultStatus.BLOCKED and not candidate.decision_needed:
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("decision_needed")
    if candidate.status is ResultStatus.CANCELLED and not candidate.unresolved:
        reasons.append(ResultReasonCode.STATUS_CONDITION_FAILED.value); fields.append("unresolved")
    return ResultValidationResult(not reasons, tuple(dict.fromkeys(reasons)), tuple(dict.fromkeys(fields)))


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))


def canonical_hash(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


__all__ = ["EvidenceReference", "ResultTest", "ResultEnvelope", "ResultReasonCode",
           "ResultValidationResult", "validate_result", "canonical_json", "canonical_hash"]
