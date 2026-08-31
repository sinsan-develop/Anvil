"""C-12 결정론적 FAILURE_REPORT 원장.

원장은 C-06의 정식 보고 판정 뒤에만 실패를 누적한다. 이 모듈은
lease/tool 회수나 상태 전이를 수행하지 않으며, 세 번째 유효 보고에는
후속 C-13이 처리할 takeover 후보 신호만 반환한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from threading import RLock
from typing import Any, Mapping

from .failure_report import validate_failure_report
from .result_envelope import ResultEnvelope, canonical_hash


class FailureLedgerReasonCode(StrEnum):
    INVALID_FAILURE_REPORT = "INVALID_FAILURE_REPORT"
    DUPLICATE_RESULT = "DUPLICATE_RESULT"
    CONFLICTING_REPLAY = "CONFLICTING_REPLAY"


@dataclass(frozen=True, slots=True)
class FailureLedgerEntry:
    """원장에 기록된 한 결과 receipt의 불변 표현."""

    sequence: int
    result_id: str
    result_hash: str
    step_lineage_id: str
    failure_fingerprint: str | None
    accepted: bool
    valid_failure_count: int
    takeover_required: bool
    reason_codes: tuple[str, ...] = ()

    @property
    def failure_key(self) -> str | None:
        if self.failure_fingerprint is None:
            return None
        return f"{self.step_lineage_id}|{self.failure_fingerprint}"


@dataclass(frozen=True, slots=True)
class FailureLedgerProjection:
    failure_key: str
    step_lineage_id: str
    failure_fingerprint: str
    valid_failure_count: int
    takeover_required: bool
    latest_result_id: str


@dataclass(frozen=True, slots=True)
class FailureLedgerReceipt:
    accepted: bool
    duplicate: bool = False
    valid_failure_count: int = 0
    takeover_required: bool = False
    failure_key: str | None = None
    reason_codes: tuple[str, ...] = ()
    entry: FailureLedgerEntry | None = None


class FailureLedger:
    """유효한 failure key별 횟수를 원자적으로 누적하는 결정론적 원장."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._counts: dict[str, FailureLedgerProjection] = {}
        self._results: dict[str, tuple[str, FailureLedgerEntry]] = {}
        self._entries: list[FailureLedgerEntry] = []

    @property
    def entries(self) -> tuple[FailureLedgerEntry, ...]:
        with self._lock:
            return tuple(self._entries)

    @property
    def valid_failure_count(self) -> int:
        with self._lock:
            return sum(item.valid_failure_count for item in self._counts.values())

    @property
    def takeover_candidates(self) -> tuple[FailureLedgerProjection, ...]:
        with self._lock:
            return tuple(item for item in self._counts.values() if item.takeover_required)

    def projection(self) -> tuple[FailureLedgerProjection, ...]:
        with self._lock:
            return tuple(self._counts.values())

    def get(self, failure_key: str) -> FailureLedgerProjection | None:
        with self._lock:
            return self._counts.get(failure_key)

    def record(self, result: ResultEnvelope | Mapping[str, Any]) -> FailureLedgerReceipt:
        """검증된 결과를 한 번만 집계한다.

        동일 ``result_id``와 canonical hash는 duplicate receipt이며 원장을
        다시 증가시키지 않는다. 같은 id의 다른 payload는 fail-closed다.
        """
        candidate, result_hash = self._normalize(result)
        if candidate is None:
            # 입력 identity를 신뢰하지 않으므로 별도 원장 항목을 만들지 않는다.
            return FailureLedgerReceipt(False, reason_codes=(FailureLedgerReasonCode.INVALID_FAILURE_REPORT.value,))

        with self._lock:
            previous = self._results.get(candidate.result_id)
            if previous is not None:
                prior_hash, prior_entry = previous
                if prior_hash == result_hash:
                    return FailureLedgerReceipt(
                        True, duplicate=True,
                        valid_failure_count=prior_entry.valid_failure_count,
                        takeover_required=prior_entry.takeover_required,
                        failure_key=prior_entry.failure_key, entry=prior_entry,
                    )
                return FailureLedgerReceipt(
                    False, reason_codes=(FailureLedgerReasonCode.CONFLICTING_REPLAY.value,),
                    failure_key=prior_entry.failure_key, entry=prior_entry,
                )

            validation = validate_failure_report(candidate)
            if not validation.valid:
                entry = FailureLedgerEntry(
                    sequence=len(self._entries) + 1, result_id=candidate.result_id,
                    result_hash=result_hash, step_lineage_id=candidate.step_lineage_id,
                    failure_fingerprint=candidate.failure_fingerprint, accepted=False,
                    valid_failure_count=0, takeover_required=False,
                    reason_codes=validation.reason_codes,
                )
                self._entries.append(entry)
                self._results[candidate.result_id] = (result_hash, entry)
                return FailureLedgerReceipt(False, failure_key=entry.failure_key,
                                            reason_codes=validation.reason_codes, entry=entry)

            key = f"{candidate.step_lineage_id}|{candidate.failure_fingerprint}"
            prior = self._counts.get(key)
            count = 1 if prior is None else prior.valid_failure_count + 1
            takeover = count >= 3
            projection = FailureLedgerProjection(
                failure_key=key, step_lineage_id=candidate.step_lineage_id,
                failure_fingerprint=candidate.failure_fingerprint or "",
                valid_failure_count=count, takeover_required=takeover,
                latest_result_id=candidate.result_id,
            )
            entry = FailureLedgerEntry(
                sequence=len(self._entries) + 1, result_id=candidate.result_id,
                result_hash=result_hash, step_lineage_id=candidate.step_lineage_id,
                failure_fingerprint=candidate.failure_fingerprint, accepted=True,
                valid_failure_count=count, takeover_required=takeover,
            )
            self._counts[key] = projection
            self._entries.append(entry)
            self._results[candidate.result_id] = (result_hash, entry)
            return FailureLedgerReceipt(True, valid_failure_count=count,
                                        takeover_required=takeover, failure_key=key, entry=entry)

    append = record
    accept = record

    @staticmethod
    def _normalize(result: ResultEnvelope | Mapping[str, Any]) -> tuple[ResultEnvelope | None, str | None]:
        try:
            candidate = result if isinstance(result, ResultEnvelope) else ResultEnvelope.from_dict(result)
            return candidate, canonical_hash(candidate.to_dict())
        except (TypeError, ValueError, KeyError, AttributeError):
            return None, None


__all__ = [
    "FailureLedgerReasonCode", "FailureLedgerEntry", "FailureLedgerProjection",
    "FailureLedgerReceipt", "FailureLedger",
]
