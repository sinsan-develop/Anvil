"""Fail-closed in-memory domain guard for execution-attempt integrity."""

from __future__ import annotations

from .models import Delegation, ExecutorKind, Result, StepAttempt


class AttemptIntegrityService:
    def __init__(self) -> None:
        self._attempts: dict[str, StepAttempt] = {}
        self._active_attempt_by_step: dict[str, str] = {}
        self._delegations: dict[str, Delegation] = {}
        self._results: dict[str, Result] = {}

    def register_attempt(
        self,
        attempt: StepAttempt,
        *,
        delegation: Delegation | None = None,
        takeover_reference: str | None = None,
    ) -> None:
        if attempt.attempt_id in self._attempts:
            raise ValueError("attempt_id already exists")
        if attempt.step_id in self._active_attempt_by_step:
            raise ValueError("an active attempt already exists for this step")
        if attempt.executor_kind is ExecutorKind.SUBAGENT:
            if delegation is None:
                raise ValueError("delegation is required for SUBAGENT attempt")
            if takeover_reference is not None:
                raise ValueError("SUBAGENT attempt must not have a takeover reference")
        elif attempt.executor_kind is ExecutorKind.MAIN_TAKEOVER:
            if delegation is not None:
                raise ValueError("MAIN_TAKEOVER attempt must not have a delegation")
            if not isinstance(takeover_reference, str) or not takeover_reference.strip():
                raise ValueError("takeover reference is required for MAIN_TAKEOVER attempt")
        if delegation is not None:
            if delegation.attempt_id != attempt.attempt_id:
                raise ValueError("delegation must reference its source attempt")
            if delegation.attempt_id in self._delegations:
                raise ValueError("attempt already has a delegation")
            self._delegations[delegation.attempt_id] = delegation
        self._attempts[attempt.attempt_id] = attempt
        self._active_attempt_by_step[attempt.step_id] = attempt.attempt_id

    def record_result(self, result: Result) -> None:
        attempt = self._attempts.get(result.attempt_id)
        if attempt is None:
            raise ValueError("source attempt does not exist")
        if result.attempt_id in self._results:
            raise ValueError("terminal result already exists for this attempt")
        if result.target_hash != attempt.target_hash:
            raise ValueError("result target hash does not match source attempt")
        self._results[result.attempt_id] = result
        self._active_attempt_by_step.pop(attempt.step_id, None)

    def active_attempt(self, step_id: str) -> StepAttempt | None:
        attempt_id = self._active_attempt_by_step.get(step_id)
        return None if attempt_id is None else self._attempts[attempt_id]

    def delegation_for(self, attempt_id: str) -> Delegation | None:
        return self._delegations.get(attempt_id)
