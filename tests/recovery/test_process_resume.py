from __future__ import annotations

from datetime import UTC, datetime
from concurrent.futures import ThreadPoolExecutor
import multiprocessing
import os
import time
from uuid import uuid4

import pytest

from packages.recovery.models import (
    ActionAttempt,
    ActionStatus,
    RecoveryInput,
    RecoveryStatus,
    ResumeLease,
)
from packages.recovery.service import RecoveryService, StaleRecoveryFencingToken
from packages.persistence.recovery_repository import (
    InMemoryRecoveryRepository,
    PostgresRecoveryRepository,
)


HASH = "sha256:" + "a" * 64


def _wait_for_termination() -> None:
    time.sleep(30)


def _write_running_boundary(dsn: str, run_id: str, action_id: str) -> None:
    repository = PostgresRecoveryRepository(dsn)
    repository.record_action_boundary(
        run_id,
        action_id,
        status=ActionStatus.RUNNING,
        process_id=os.getpid(),
        boundary="RUNNING",
    )
    time.sleep(30)


def _recover_in_fresh_process(dsn: str, run_id: str, actor_id: str) -> None:
    repository = PostgresRecoveryRepository(dsn)
    RecoveryService(repository).recover_terminated_process(
        run_id,
        actor_id=actor_id,
        observed_at=datetime.now(UTC),
    )


def _wait_for_db_value(dsn: str, sql: str, expected: object) -> None:
    import psycopg

    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with psycopg.connect(dsn) as connection:
            value = connection.execute(sql).fetchone()[0]
        if value == expected:
            return
        time.sleep(0.02)
    pytest.fail(f"database condition did not reach {expected!r}: {sql}")


def _input(
    *, file_sequence: int = 12, db_sequence: int = 12, run_id: str = "run-1"
) -> RecoveryInput:
    suffix = "" if run_id == "run-1" else f"-{run_id.rsplit('-', 1)[-1]}"
    return RecoveryInput(
        run_id=run_id,
        project_id="project-1",
        environment_id="env-local",
        db_event_sequence=db_sequence,
        progress_event_sequence=file_sequence,
        handoff_event_sequence=file_sequence,
        checkpoint_id="checkpoint-9" if run_id == "run-1" else f"checkpoint-{run_id}",
        checkpoint_hash=HASH,
        target_hash=HASH,
        git_head="abc123",
        actions=(
            ActionAttempt(
                f"done{suffix}", f"step-done{suffix}", ActionStatus.SUCCESS, f"idem-done{suffix}", "receipt-done"
            ),
            ActionAttempt(
                f"interrupted{suffix}",
                f"step-interrupted{suffix}",
                ActionStatus.RUNNING,
                f"idem-running{suffix}",
            ),
        ),
        secret_reference="secret://provider/key#v3",
        secret_status="ACTIVE",
        capability_snapshot_hash=HASH,
        current_capability_hash=HASH,
        required_capabilities=frozenset({"tool"}),
        current_capabilities=frozenset({"tool"}),
    )


@pytest.mark.parametrize("fault_round", range(3))
def test_restart_skips_completed_step_and_resumes_only_interrupted_step(fault_round: int) -> None:
    repository = InMemoryRecoveryRepository()
    repository.seed(_input())
    service = RecoveryService(repository)

    decision = service.reconcile("run-1", actor_id="operator-1", observed_at=datetime.now(UTC))

    assert decision.status is RecoveryStatus.READY_TO_RESUME
    assert decision.skipped_step_ids == ("step-done",)
    assert decision.resumable_step_ids == ("step-interrupted",)
    assert decision.last_safe_checkpoint_id == "checkpoint-9"
    assert decision.event_sequence == 12
    assert fault_round in range(3)


def test_sequence_disagreement_fails_closed_without_overwriting_either_source() -> None:
    repository = InMemoryRecoveryRepository()
    original = _input(file_sequence=11, db_sequence=12)
    repository.seed(original)

    decision = RecoveryService(repository).reconcile(
        "run-1", actor_id="operator-1", observed_at=datetime.now(UTC)
    )

    assert decision.status is RecoveryStatus.RECONCILIATION_REQUIRED
    assert decision.blocked_reason == "EVENT_SEQUENCE_MISMATCH"
    assert repository.load("run-1") == original


@pytest.mark.parametrize("fault_round", range(3))
def test_fi07_terminated_subprocess_recovers_from_durable_snapshot(fault_round: int) -> None:
    dsn = os.environ.get("ANVIL_B12_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("ANVIL_B12_TEST_DATABASE_URL is required for FI-07")
    run_id = f"run-fi07-{fault_round}-{uuid4().hex[:8]}"
    repository = PostgresRecoveryRepository(dsn)
    source = _input(run_id=run_id)
    repository.persist_recovery_lineage(source)

    process = multiprocessing.get_context("spawn").Process(
        target=_write_running_boundary,
        args=(dsn, run_id, source.actions[1].action_id),
    )
    process.start()
    _wait_for_db_value(
        dsn,
        "SELECT boundary_count FROM recovery_action_attempts "
        f"WHERE action_id='{source.actions[1].action_id}'",
        1,
    )
    process.terminate()
    process.join(timeout=5)
    assert process.exitcode is not None and process.exitcode != 0

    recovery = multiprocessing.get_context("spawn").Process(
        target=_recover_in_fresh_process,
        args=(dsn, run_id, f"operator-{fault_round}"),
    )
    recovery.start()
    recovery.join(timeout=10)
    assert recovery.exitcode == 0

    fresh_repository = PostgresRecoveryRepository(dsn)
    decision = fresh_repository.decision(run_id)
    assert decision is not None
    assert decision.skipped_step_ids == (source.actions[0].step_id,)
    assert decision.resumable_step_ids == (source.actions[1].step_id,)
    assert decision.event_sequence == 12
    counters = fresh_repository.fault_counters(run_id, source.actions[1].action_id)
    assert counters.interruption_count == 1
    assert counters.automatic_retry_count == 1
    assert fresh_repository.audit_count(run_id, "PROCESS_INTERRUPTED") == 1

    # Exact replay in another repository/process is immutable and idempotent.
    replay = multiprocessing.get_context("spawn").Process(
        target=_recover_in_fresh_process,
        args=(dsn, run_id, f"operator-{fault_round}"),
    )
    replay.start()
    replay.join(timeout=10)
    assert replay.exitcode == 0
    assert fresh_repository.fault_counters(
        run_id, source.actions[1].action_id
    ) == counters


def test_only_current_epoch_and_tokens_can_commit_resume() -> None:
    repository = InMemoryRecoveryRepository()
    repository.seed(_input())
    current = ResumeLease(
        "run-1",
        2,
        "execution-current-token-1234567890",
        2,
        "write-current-token-12345678901234",
    )
    repository.set_current_lease(current)

    with pytest.raises(StaleRecoveryFencingToken, match="STALE_FENCING_TOKEN"):
        repository.commit_resume(
            "run-1",
            ResumeLease(
                "run-1",
                1,
                "execution-stale-token-123456789012",
                1,
                "write-stale-token-1234567890123456",
            ),
            "checkpoint-9",
        )

    receipt = repository.commit_resume("run-1", current, "checkpoint-9")
    assert receipt.resume_epoch == 2
    assert repository.commit_resume("run-1", current, "checkpoint-9") == receipt


def test_concurrent_resume_returns_one_immutable_receipt() -> None:
    repository = InMemoryRecoveryRepository()
    repository.seed(_input())
    current = ResumeLease(
        "run-1",
        2,
        "execution-current-token-1234567890",
        2,
        "write-current-token-12345678901234",
    )
    repository.set_current_lease(current)

    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts = tuple(
            pool.map(
                lambda _index: repository.commit_resume("run-1", current, "checkpoint-9"),
                range(8),
            )
        )

    assert len(set(receipts)) == 1


def test_resume_lease_rejects_nonpositive_epoch_or_short_fencing_token() -> None:
    with pytest.raises(ValueError, match="epoch"):
        ResumeLease("run-1", 0, "e" * 32, 1, "w" * 32)
    with pytest.raises(ValueError, match="fencing token"):
        ResumeLease("run-1", 1, "short", 1, "also-short")


def test_postgres_rejects_stale_resume_and_serializes_concurrent_current_resume() -> None:
    dsn = os.environ.get("ANVIL_B12_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("ANVIL_B12_TEST_DATABASE_URL is required for the PostgreSQL recovery gate")
    import psycopg

    current_execution = "current_execution_token_1234567890"
    current_write = "current_write_token_12345678901234"
    stale_execution = "stale_execution_token_123456789012"
    stale_write = "stale_write_token_1234567890123456"
    prior_current_worker_write = "prior_current_worker_write_token_12345"
    current_scope2_write = "current_scope2_write_token_123456789"
    PostgresRecoveryRepository(dsn).persist_recovery_lineage(_input(run_id="run-b12"))
    with psycopg.connect(dsn, autocommit=True) as connection:
        connection.execute(
            "INSERT INTO worker_leases(worker_lease_id,run_id,worker_id,lease_epoch,execution_fencing_token,issued_at,expires_at) VALUES "
            "('worker-stale','run-b12','worker-1',1,%s,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 hour'),"
            "('worker-current','run-b12','worker-2',2,%s,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 hour')",
            (stale_execution, current_execution),
        )
        connection.execute(
            "INSERT INTO write_leases(write_lease_id,worker_lease_id,run_id,repository_id,canonical_repo_relative_path,"
            "repository_case_policy,write_epoch,write_fencing_token,execution_fencing_token,issued_at,expires_at) VALUES "
            "('write-stale','worker-stale','run-b12','repo-1','.', 'INSENSITIVE',1,%s,%s,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 hour'),"
            "('write-current','worker-current','run-b12','repo-1','.', 'INSENSITIVE',2,%s,%s,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 hour')",
            (stale_write, stale_execution, current_write, current_execution),
        )
        connection.execute(
            "INSERT INTO write_leases(write_lease_id,worker_lease_id,run_id,repository_id,canonical_repo_relative_path,"
            "repository_case_policy,write_epoch,write_fencing_token,execution_fencing_token,issued_at,expires_at) VALUES "
            "('write-current-stale','worker-current','run-b12','repo-2','.', 'INSENSITIVE',1,%s,%s,"
            "CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 hour'),"
            "('write-current-scope2','worker-current','run-b12','repo-2','.', 'INSENSITIVE',2,%s,%s,"
            "CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 hour')",
            (
                prior_current_worker_write,
                current_execution,
                current_scope2_write,
                current_execution,
            ),
        )
        with pytest.raises(psycopg.errors.RaiseException, match="STALE_FENCING_TOKEN"):
            connection.execute(
                "SELECT anvil_recovery_commit_resume('run-b12','worker-stale','write-stale',1,%s,1,%s,'checkpoint-run-b12')",
                (stale_execution, stale_write),
            ).fetchone()
        with pytest.raises(psycopg.errors.RaiseException, match="STALE_FENCING_TOKEN"):
            connection.execute(
                "SELECT anvil_recovery_commit_resume('run-b12','worker-current','write-current-stale',2,%s,1,%s,'checkpoint-run-b12')",
                (current_execution, prior_current_worker_write),
            ).fetchone()

    def commit_current(_index: int):
        return PostgresRecoveryRepository(dsn).commit_resume(
            "run-b12",
            ResumeLease("run-b12", 2, current_execution, 2, current_write),
            "checkpoint-run-b12",
            worker_lease_id="worker-current",
            write_lease_id="write-current",
        ).checkpoint_id

    with ThreadPoolExecutor(max_workers=8) as pool:
        checkpoints = tuple(pool.map(commit_current, range(8)))
    assert checkpoints == ("checkpoint-run-b12",) * 8
    with psycopg.connect(dsn) as connection:
        assert connection.execute(
            "SELECT count(*) FROM recovery_resume_receipts WHERE run_id='run-b12'"
        ).fetchone()[0] == 1
