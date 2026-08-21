from __future__ import annotations

from datetime import UTC, datetime
import multiprocessing
import os
import time
from uuid import uuid4

import pytest

from packages.persistence.recovery_repository import PostgresRecoveryRepository
from packages.recovery.models import (
    ActionAttempt,
    ActionStatus,
    ReconciliationClass,
    RecoveryInput,
)
from packages.recovery.service import RecoveryService, reconcile_action


HASH = "sha256:" + "b" * 64


def _fault_input(run_id: str, action_id: str, status: ActionStatus) -> RecoveryInput:
    return RecoveryInput(
        run_id=run_id,
        project_id="project-fi",
        environment_id="env-local",
        db_event_sequence=7,
        progress_event_sequence=7,
        handoff_event_sequence=7,
        checkpoint_id=f"checkpoint-{run_id}",
        checkpoint_hash=HASH,
        target_hash=HASH,
        git_head="abc123",
        actions=(ActionAttempt(action_id, f"step-{action_id}", status, f"idem-{action_id}"),),
        secret_reference="secret://provider/key#v3",
        secret_status="ACTIVE",
        capability_snapshot_hash=HASH,
        current_capability_hash=HASH,
        required_capabilities=frozenset({"provider.send"}),
        current_capabilities=frozenset({"provider.send"}),
    )


def _fault_worker(dsn: str, run_id: str, action_id: str, boundary: str) -> None:
    repository = PostgresRecoveryRepository(dsn)
    if boundary == "BEFORE_SEND":
        repository.record_action_boundary(
            run_id,
            action_id,
            status=ActionStatus.REQUEST_PREPARED,
            process_id=os.getpid(),
            boundary=boundary,
        )
    else:
        repository.record_provider_send(
            run_id,
            action_id,
            process_id=os.getpid(),
            receipt_ref=f"provider://receipt/{action_id}",
        )
    time.sleep(30)


def _recovery_worker(dsn: str, run_id: str) -> None:
    repository = PostgresRecoveryRepository(dsn)
    RecoveryService(repository).recover_terminated_process(
        run_id,
        actor_id="recovery-worker",
        observed_at=datetime.now(UTC),
    )


def _wait_for_counter(dsn: str, action_id: str, column: str, expected: int) -> None:
    import psycopg

    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with psycopg.connect(dsn) as connection:
            value = connection.execute(
                f"SELECT {column} FROM recovery_action_attempts WHERE action_id=%s",
                (action_id,),
            ).fetchone()[0]
        if value == expected:
            return
        time.sleep(0.02)
    pytest.fail(f"{action_id}.{column} did not reach {expected}")


def test_success_and_authoritative_receipt_are_confirmed_without_retry() -> None:
    completed = ActionAttempt("action-1", "step-1", ActionStatus.SUCCESS, "idem-1", "receipt-1")
    sent = ActionAttempt("action-2", "step-2", ActionStatus.REQUEST_SENT, "idem-2")

    assert reconcile_action(completed).classification is ReconciliationClass.CONFIRMED_SUCCESS
    received = reconcile_action(sent, authoritative_receipt_ref="receipt-2")
    assert received.classification is ReconciliationClass.CONFIRMED_SUCCESS
    assert received.retry_allowed is False


@pytest.mark.parametrize("fault_round", range(3))
def test_before_send_is_safe_retry_but_after_send_without_receipt_requires_review(
    fault_round: int,
) -> None:
    prepared = ActionAttempt("action-1", "step-1", ActionStatus.REQUEST_PREPARED, "idem-1")
    sent = ActionAttempt("action-2", "step-2", ActionStatus.REQUEST_SENT, "idem-2")

    before = reconcile_action(prepared)
    after = reconcile_action(sent)

    assert before.classification is ReconciliationClass.SAFE_RETRY
    assert before.retry_allowed is True
    assert after.classification is ReconciliationClass.MANUAL_REVIEW
    assert after.retry_allowed is False
    assert fault_round in range(3)


@pytest.mark.parametrize("fault_round", range(3))
@pytest.mark.parametrize("boundary", ["BEFORE_SEND", "AFTER_SEND_BEFORE_RESPONSE"])
def test_actual_terminated_send_boundary_recovers_without_duplicate_side_effect(
    fault_round: int, boundary: str
) -> None:
    dsn = os.environ.get("ANVIL_B12_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("ANVIL_B12_TEST_DATABASE_URL is required for FI-05/FI-06")
    case = "fi05" if boundary == "BEFORE_SEND" else "fi06"
    token = uuid4().hex[:8]
    run_id = f"run-{case}-{fault_round}-{token}"
    action_id = f"action-{case}-{fault_round}-{token}"
    initial = (
        ActionStatus.REQUEST_PREPARED
        if boundary == "BEFORE_SEND"
        else ActionStatus.REQUEST_SENT
    )
    repository = PostgresRecoveryRepository(dsn)
    repository.persist_recovery_lineage(_fault_input(run_id, action_id, initial))

    process = multiprocessing.get_context("spawn").Process(
        target=_fault_worker,
        args=(dsn, run_id, action_id, boundary),
    )
    process.start()
    _wait_for_counter(
        dsn,
        action_id,
        "boundary_count" if boundary == "BEFORE_SEND" else "send_count",
        1,
    )
    process.terminate()
    process.join(timeout=5)
    assert process.exitcode is not None and process.exitcode != 0

    recovery = multiprocessing.get_context("spawn").Process(
        target=_recovery_worker,
        args=(dsn, run_id),
    )
    recovery.start()
    recovery.join(timeout=10)
    assert recovery.exitcode == 0

    fresh = PostgresRecoveryRepository(dsn)
    counters = fresh.fault_counters(run_id, action_id)
    assert counters.send_count == (0 if boundary == "BEFORE_SEND" else 1)
    assert counters.receipt_lookup_count == (0 if boundary == "BEFORE_SEND" else 1)
    assert counters.automatic_retry_count == (1 if boundary == "BEFORE_SEND" else 0)
    assert counters.duplicate_request_count == 0
    decision = fresh.decision(run_id)
    assert decision is not None
    if boundary == "BEFORE_SEND":
        assert decision.resumable_step_ids == (f"step-{action_id}",)
    else:
        assert decision.skipped_step_ids == (f"step-{action_id}",)
        assert decision.action_reconciliations[0].authoritative_receipt_ref == (
            f"provider://receipt/{action_id}"
        )
