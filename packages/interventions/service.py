"""Human-priority intervention, safe pause/resume, and ordered cancellation."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from heapq import heappop, heappush
from itertools import count
from threading import RLock
from typing import Iterable, Mapping
from uuid import uuid4

from .models import (
    CANCEL_SEQUENCE,
    RESUMABLE_RUN_STATUSES,
    TERMINAL_RUN_STATUSES,
    CancelStep,
    HumanInterventionReceipt,
    InterventionKind,
    InterventionState,
    PrioritizedEvent,
    RunControlRecord,
    RunControlStatus,
)


class InterventionError(ValueError):
    pass


class AmbiguousIntervention(InterventionError):
    pass


class ReceiptTransitionError(InterventionError):
    pass


class RunTerminalImmutable(InterventionError):
    code = "RUN_TERMINAL_IMMUTABLE"


class BindingDriftRequiresReapproval(InterventionError):
    code = "APPROVAL_SUBJECT_CHANGED"


class CancelSequenceError(InterventionError):
    pass


class HumanInterventionService:
    HUMAN_PRIORITY = 0
    SYSTEM_PRIORITY = 100

    def __init__(self) -> None:
        self._states: dict[str, InterventionState] = {}
        self._receipts: dict[str, HumanInterventionReceipt] = {}
        self._queues: dict[str, list[tuple[int, datetime, int, PrioritizedEvent]]] = {}
        self._sequence = count()
        self._lock = RLock()

    def request(
        self,
        run_id: str,
        kind: InterventionKind | Iterable[InterventionKind],
        *,
        requested_at: datetime,
    ) -> HumanInterventionReceipt:
        kinds = (kind,) if isinstance(kind, InterventionKind) else tuple(kind)
        if len(kinds) != 1 or not isinstance(kinds[0], InterventionKind):
            with self._lock:
                self._states[run_id] = InterventionState.WAITING_DECISION
            raise AmbiguousIntervention("ambiguous intervention requires a human decision")
        selected = kinds[0]
        receipt = HumanInterventionReceipt(f"intervention-{uuid4().hex}", run_id, selected, requested_at)
        event = PrioritizedEvent(
            "HUMAN_INTERVENTION", run_id, requested_at, self.HUMAN_PRIORITY, selected, receipt.receipt_id
        )
        with self._lock:
            self._receipts[receipt.receipt_id] = receipt
            if selected is InterventionKind.STOP:
                self._states[run_id] = InterventionState.PAUSE_REQUESTED
            elif selected is InterventionKind.CANCEL:
                self._states[run_id] = InterventionState.CANCEL_REQUESTED
            else:
                self._states.setdefault(run_id, InterventionState.ACTIVE)
            self._push(event)
        return receipt

    def enqueue_system_event(self, run_id: str, event_type: str, *, requested_at: datetime) -> None:
        with self._lock:
            self._push(PrioritizedEvent(event_type, run_id, requested_at, self.SYSTEM_PRIORITY))

    def next_event(self, run_id: str) -> PrioritizedEvent:
        with self._lock:
            return heappop(self._queues[run_id])[3]

    def acknowledge(self, run_id: str, receipt_id: str, *, acknowledged_at: datetime) -> HumanInterventionReceipt:
        receipt = self._get(run_id, receipt_id)
        if receipt.acknowledged_at is not None:
            raise ReceiptTransitionError("receipt is already acknowledged")
        return self._replace(receipt, acknowledged_at=acknowledged_at)

    def block_new_actions(self, run_id: str, receipt_id: str, *, blocked_at: datetime) -> HumanInterventionReceipt:
        receipt = self._get(run_id, receipt_id)
        if receipt.acknowledged_at is None or receipt.new_action_blocked_at is not None:
            raise ReceiptTransitionError("acknowledgement must precede one action block receipt")
        return self._replace(receipt, new_action_blocked_at=blocked_at)

    def mark_effective(
        self,
        run_id: str,
        receipt_id: str,
        *,
        effective_at: datetime,
        target_action_status: str,
        irreversible_receipt_ref: str,
    ) -> HumanInterventionReceipt:
        receipt = self._get(run_id, receipt_id)
        if receipt.new_action_blocked_at is None or receipt.effective_at is not None:
            raise ReceiptTransitionError("action block must precede one effective receipt")
        updated = self._replace(
            receipt,
            effective_at=effective_at,
            target_action_status=target_action_status,
            irreversible_receipt_ref=irreversible_receipt_ref,
        )
        with self._lock:
            if receipt.kind is InterventionKind.STOP:
                self._states[run_id] = InterventionState.PAUSED_USER
        return updated

    def state_for(self, run_id: str) -> InterventionState:
        return self._states.get(run_id, InterventionState.ACTIVE)

    def can_schedule_new_action(self, run_id: str) -> bool:
        return self.state_for(run_id) is InterventionState.ACTIVE

    def _push(self, event: PrioritizedEvent) -> None:
        heappush(
            self._queues.setdefault(event.run_id, []),
            (event.priority, event.requested_at, next(self._sequence), event),
        )

    def _get(self, run_id: str, receipt_id: str) -> HumanInterventionReceipt:
        receipt = self._receipts[receipt_id]
        if receipt.run_id != run_id:
            raise ReceiptTransitionError("receipt belongs to another run")
        return receipt

    def _replace(self, receipt: HumanInterventionReceipt, **changes: object) -> HumanInterventionReceipt:
        updated = replace(receipt, **changes)
        with self._lock:
            self._receipts[receipt.receipt_id] = updated
        return updated


class RunControlService:
    def __init__(self) -> None:
        self._runs: dict[str, RunControlRecord] = {}
        self._lock = RLock()

    def register_run(self, run_id: str, status: RunControlStatus, bindings: Mapping[str, str]) -> RunControlRecord:
        record = RunControlRecord(run_id, status, bindings)
        with self._lock:
            if run_id in self._runs:
                raise InterventionError("run is already registered")
            self._runs[run_id] = record
        return record

    def status_for(self, run_id: str) -> RunControlStatus:
        return self._runs[run_id].status

    def request_pause(self, run_id: str, *, requested_at: datetime) -> RunControlRecord:
        del requested_at
        return self._transition_nonterminal(run_id, RunControlStatus.PAUSE_REQUESTED)

    def complete_pause(self, run_id: str, *, effective_at: datetime) -> RunControlRecord:
        del effective_at
        current = self._runs[run_id]
        if current.status is not RunControlStatus.PAUSE_REQUESTED:
            raise InterventionError("pause was not requested")
        return self._save(replace(current, status=RunControlStatus.PAUSED_USER))

    def resume(
        self,
        run_id: str,
        bindings: Mapping[str, str],
        *,
        reapproval_ref: str | None,
    ) -> RunControlRecord:
        current = self._runs[run_id]
        if current.status not in RESUMABLE_RUN_STATUSES:
            raise RunTerminalImmutable("only resumable nonterminal statuses can resume")
        if dict(current.bindings) != dict(bindings) and not reapproval_ref:
            raise BindingDriftRequiresReapproval("plan, baseline, or policy binding changed")
        return self._save(replace(current, status=RunControlStatus.ACTIVE, bindings=bindings))

    def advance_cancel(self, run_id: str, step: CancelStep, occurred_at: datetime) -> RunControlRecord:
        current = self._runs[run_id]
        if current.status in TERMINAL_RUN_STATUSES:
            raise RunTerminalImmutable("terminal Run cannot transition")
        expected = CANCEL_SEQUENCE[len(current.cancel_steps)]
        if step is not expected:
            raise CancelSequenceError(f"expected cancel step {expected.value}")
        status = RunControlStatus.CANCEL_REQUESTED
        if step is CancelStep.CANCELLED:
            status = RunControlStatus.CANCELLED
        return self._save(
            replace(
                current,
                status=status,
                cancel_steps=current.cancel_steps + (step,),
                cancel_timestamps=current.cancel_timestamps + (occurred_at,),
            )
        )

    def cancel_history(self, run_id: str) -> tuple[CancelStep, ...]:
        return self._runs[run_id].cancel_steps

    def can_schedule_new_action(self, run_id: str) -> bool:
        return self._runs[run_id].status is RunControlStatus.ACTIVE

    def set_status(self, run_id: str, status: RunControlStatus) -> RunControlRecord:
        current = self._runs[run_id]
        if current.status in TERMINAL_RUN_STATUSES:
            raise RunTerminalImmutable("terminal Run cannot transition")
        return self._save(replace(current, status=status))

    def create_continuation_run(
        self,
        run_id: str,
        *,
        prior_run_id: str,
        checkpoint_refs: tuple[str, ...],
        artifact_refs: tuple[str, ...],
        bindings: Mapping[str, str],
    ) -> RunControlRecord:
        prior = self._runs[prior_run_id]
        if prior.status not in TERMINAL_RUN_STATUSES:
            raise RunTerminalImmutable("prior_run_id must identify a terminal Run")
        if not checkpoint_refs and not artifact_refs:
            raise InterventionError("a reusable checkpoint or artifact reference is required")
        record = RunControlRecord(
            run_id,
            RunControlStatus.ACTIVE,
            bindings,
            prior_run_id,
            checkpoint_refs,
            artifact_refs,
        )
        with self._lock:
            if run_id in self._runs:
                raise InterventionError("run is already registered")
            self._runs[run_id] = record
        return record

    def _transition_nonterminal(self, run_id: str, status: RunControlStatus) -> RunControlRecord:
        current = self._runs[run_id]
        if current.status in TERMINAL_RUN_STATUSES:
            raise RunTerminalImmutable("terminal Run cannot transition")
        return self._save(replace(current, status=status))

    def _save(self, record: RunControlRecord) -> RunControlRecord:
        with self._lock:
            self._runs[record.run_id] = record
        return record
