"""C-12 결정론적 FAILURE_REPORT 원장.

원장은 C-06의 정식 보고 판정 뒤에만 실패를 누적한다. 이 모듈은
lease/tool 회수나 상태 전이를 수행하지 않으며, 세 번째 유효 보고에는
후속 C-13이 처리할 takeover 후보 신호만 반환한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import StrEnum
from threading import RLock
from typing import Any, Callable, Mapping

from .failure_report import validate_failure_report
from .result_envelope import ResultEnvelope, canonical_hash


class FailureLedgerReasonCode(StrEnum):
    INVALID_FAILURE_REPORT = "INVALID_FAILURE_REPORT"
    DUPLICATE_RESULT = "DUPLICATE_RESULT"
    CONFLICTING_REPLAY = "CONFLICTING_REPLAY"
    TAKEOVER_ALREADY_REQUIRED = "TAKEOVER_ALREADY_REQUIRED"


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
    attempt_id: str = ""
    attempt_number: int = 0

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
    _prepared: object | None = field(default=None, repr=False, compare=False)


@dataclass(frozen=True, slots=True)
class _FailureLedgerState:
    counts: dict[str, FailureLedgerProjection]
    results: dict[str, tuple[str, FailureLedgerEntry]]
    attempt_ids: dict[str, FailureLedgerEntry]
    attempt_numbers: dict[tuple[str, int], FailureLedgerEntry]
    entries: tuple[FailureLedgerEntry, ...]


@dataclass(frozen=True, slots=True)
class _PreparedFailureLedgerCommit:
    base_state: _FailureLedgerState
    next_state: _FailureLedgerState
    entry: FailureLedgerEntry


class FailureLedger:
    """유효한 failure key별 횟수를 원자적으로 누적하는 결정론적 원장."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._state = _FailureLedgerState({}, {}, {}, {}, ())
        self._prepared_commits: dict[
            object, tuple[FailureLedgerReceipt, _PreparedFailureLedgerCommit]
        ] = {}

    @property
    def _results(self) -> dict[str, tuple[str, FailureLedgerEntry]]:
        return self._state.results

    @_results.setter
    def _results(self, value: dict[str, tuple[str, FailureLedgerEntry]]) -> None:
        self._state = replace(self._state, results=value)

    @property
    def entries(self) -> tuple[FailureLedgerEntry, ...]:
        with self._lock:
            return self._state.entries

    @property
    def valid_failure_count(self) -> int:
        with self._lock:
            return sum(item.valid_failure_count for item in self._state.counts.values())

    @property
    def takeover_candidates(self) -> tuple[FailureLedgerProjection, ...]:
        with self._lock:
            return tuple(
                self._state.counts[key]
                for key in sorted(self._state.counts)
                if self._state.counts[key].takeover_required
            )

    def projection(self) -> tuple[FailureLedgerProjection, ...]:
        with self._lock:
            return tuple(self._state.counts[key] for key in sorted(self._state.counts))

    def get(self, failure_key: str) -> FailureLedgerProjection | None:
        with self._lock:
            return self._state.counts.get(failure_key)

    def takeover_candidate_receipt(
        self, failure_key: str,
    ) -> FailureLedgerReceipt | None:
        """Return the committed canonical count-3 receipt for C-13.

        Online third-commit receipts identify the triggering arrival. C-13 must
        instead consume this projection-aligned receipt so its immutable entry
        names the canonical ``latest_result_id`` for the failure key.
        """

        if not isinstance(failure_key, str):
            return None
        with self._lock:
            projection = self._state.counts.get(failure_key)
            if (
                projection is None
                or projection.valid_failure_count != 3
                or not projection.takeover_required
            ):
                return None
            stored = self._state.results.get(projection.latest_result_id)
            if stored is None:
                return None
            entry = stored[1]
            if (
                entry.failure_key != failure_key
                or entry.valid_failure_count != 3
                or not entry.takeover_required
            ):
                return None
            return FailureLedgerReceipt(
                True,
                valid_failure_count=3,
                takeover_required=True,
                failure_key=failure_key,
                entry=entry,
            )

    def record(self, result: ResultEnvelope | Mapping[str, Any]) -> FailureLedgerReceipt:
        """검증된 결과를 standalone 원장 transaction으로 한 번만 집계한다.

        동일 ``result_id``와 canonical hash는 duplicate receipt이며 원장을
        다시 증가시키지 않는다. 같은 id의 다른 payload는 fail-closed다.
        반환 receipt는 이미 commit되었으므로 C-07의 cross-component transaction에
        재사용할 수 없다. C-07은 ``prepare`` receipt를 소비해야 한다.
        """
        with self._lock:
            receipt = self.prepare(result)
            if not receipt.accepted or receipt.duplicate:
                return receipt
            if not self.commit_prepared(receipt):  # pragma: no cover - protected by this lock
                return FailureLedgerReceipt(
                    False,
                    reason_codes=(FailureLedgerReasonCode.CONFLICTING_REPLAY.value,),
                    failure_key=receipt.failure_key,
                )
            return replace(receipt, _prepared=None)

    def prepare(self, result: ResultEnvelope | Mapping[str, Any]) -> FailureLedgerReceipt:
        """C-07 transaction용 다음 state를 내부에 준비하고 publish하지 않는다."""

        candidate, result_hash = self._normalize(result)
        if candidate is None:
            return FailureLedgerReceipt(False, reason_codes=(FailureLedgerReasonCode.INVALID_FAILURE_REPORT.value,))

        with self._lock:
            state = self._state
            previous = state.results.get(candidate.result_id)
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

            prior_attempt = state.attempt_ids.get(candidate.attempt_id)
            if prior_attempt is None:
                prior_attempt = state.attempt_numbers.get(
                    (candidate.step_lineage_id, candidate.attempt_number)
                )
            if prior_attempt is not None:
                return FailureLedgerReceipt(
                    False, reason_codes=(FailureLedgerReasonCode.CONFLICTING_REPLAY.value,),
                    failure_key=prior_attempt.failure_key, entry=prior_attempt,
                )

            validation = validate_failure_report(candidate)
            if not validation.valid:
                return FailureLedgerReceipt(False, reason_codes=validation.reason_codes)

            key = f"{candidate.step_lineage_id}|{candidate.failure_fingerprint}"
            prior = state.counts.get(key)
            if prior is not None and prior.takeover_required:
                return FailureLedgerReceipt(
                    False,
                    valid_failure_count=prior.valid_failure_count,
                    takeover_required=True,
                    failure_key=key,
                    reason_codes=(FailureLedgerReasonCode.TAKEOVER_ALREADY_REQUIRED.value,),
                )
            draft = FailureLedgerEntry(
                sequence=0, result_id=candidate.result_id,
                result_hash=result_hash, step_lineage_id=candidate.step_lineage_id,
                failure_fingerprint=candidate.failure_fingerprint, accepted=True,
                valid_failure_count=0, takeover_required=False,
                attempt_id=candidate.attempt_id, attempt_number=candidate.attempt_number,
            )
            next_entries = self._canonical_entries((*state.entries, draft))

            # Every potentially failing allocation/mutation happens on local copies.
            next_counts = state.counts.copy()
            next_counts.clear()
            next_results = state.results.copy()
            next_attempt_ids = state.attempt_ids.copy()
            next_attempt_numbers = state.attempt_numbers.copy()
            latest_by_key: dict[str, FailureLedgerEntry] = {}
            for entry in next_entries:
                entry_key = entry.failure_key
                if entry_key is None:  # pragma: no cover - accepted entries always have a fingerprint
                    raise ValueError("accepted failure entry must have a failure key")
                latest_by_key[entry_key] = entry
                next_results[entry.result_id] = (entry.result_hash, entry)
                next_attempt_ids[entry.attempt_id] = entry
                next_attempt_numbers[(entry.step_lineage_id, entry.attempt_number)] = entry
            for entry_key, latest in latest_by_key.items():
                next_counts[entry_key] = FailureLedgerProjection(
                    failure_key=entry_key,
                    step_lineage_id=latest.step_lineage_id,
                    failure_fingerprint=latest.failure_fingerprint or "",
                    valid_failure_count=latest.valid_failure_count,
                    takeover_required=latest.takeover_required,
                    latest_result_id=latest.result_id,
                )

            canonical_entry = next_results[candidate.result_id][1]
            aggregate_count = next_counts[key].valid_failure_count
            receipt_entry = replace(
                canonical_entry,
                valid_failure_count=aggregate_count,
                takeover_required=aggregate_count == 3,
            )
            next_state = _FailureLedgerState(
                next_counts, next_results, next_attempt_ids,
                next_attempt_numbers, next_entries,
            )
            prepared = _PreparedFailureLedgerCommit(
                state, next_state, receipt_entry,
            )
            token = object()
            receipt = FailureLedgerReceipt(
                True,
                valid_failure_count=aggregate_count,
                takeover_required=aggregate_count == 3,
                failure_key=receipt_entry.failure_key,
                entry=receipt_entry,
                _prepared=token,
            )
            self._prepared_commits[token] = (receipt, prepared)
            return receipt

    def verify_prepared(self, receipt: FailureLedgerReceipt) -> bool:
        with self._lock:
            return self._verified_prepared(receipt) is not None

    def commit_prepared(self, receipt: FailureLedgerReceipt) -> bool:
        """Publish a prepared receipt as a standalone ledger transaction."""

        return self._commit_prepared(receipt)

    def _commit_prepared(
        self, receipt: FailureLedgerReceipt, *,
        publish: Callable[[], None] | None = None,
        rollback: Callable[[], None] | None = None,
    ) -> bool:
        """Publish an enlisted C-07 state and ledger state under both locks.

        ``publish`` must perform only the pre-built C-07 state-reference swap. If
        it raises, the ledger state remains unchanged.
        """

        with self._lock:
            prepared = self._verified_prepared(receipt)
            if prepared is None:
                return False
            compensation_required = publish is not None and rollback is not None
            try:
                if publish is not None:
                    publish()
                self._state = prepared.next_state
            except BaseException:
                # The assignment above may have swapped the reference before a
                # custom __setattr__ raises. Restore the exact registered base
                # without re-entering that fallible override.
                object.__setattr__(self, "_state", prepared.base_state)
                if compensation_required:
                    rollback()
                raise
            self._prepared_commits.clear()
            return True

    def _verified_prepared(
        self, receipt: FailureLedgerReceipt,
    ) -> _PreparedFailureLedgerCommit | None:
        token = receipt._prepared
        try:
            registered = self._prepared_commits.get(token)
        except TypeError:
            return None
        if registered is None or registered[0] is not receipt:
            return None
        prepared = registered[1]
        entry = prepared.entry
        if (
            prepared.base_state is not self._state
            or receipt.entry is not entry
            or type(receipt.accepted) is not bool
            or type(receipt.duplicate) is not bool
            or not receipt.accepted
            or receipt.duplicate
            or receipt.reason_codes
            or receipt.valid_failure_count != entry.valid_failure_count
            or receipt.takeover_required != entry.takeover_required
            or receipt.failure_key != entry.failure_key
        ):
            return None
        return prepared

    @staticmethod
    def _canonical_entries(
        entries: tuple[FailureLedgerEntry, ...],
    ) -> tuple[FailureLedgerEntry, ...]:
        ordered = sorted(
            entries,
            key=lambda item: (
                item.failure_key or "", item.attempt_number,
                item.attempt_id, item.result_id, item.result_hash,
            ),
        )
        counts: dict[str, int] = {}
        result: list[FailureLedgerEntry] = []
        for sequence, entry in enumerate(ordered, 1):
            key = entry.failure_key or ""
            count = counts.get(key, 0) + 1
            counts[key] = count
            result.append(replace(
                entry,
                sequence=sequence,
                valid_failure_count=count,
                takeover_required=count == 3,
            ))
        return tuple(result)

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
