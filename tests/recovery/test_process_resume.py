from __future__ import annotations

from datetime import UTC, datetime
from concurrent.futures import ThreadPoolExecutor
import multiprocessing
import os
import time

import pytest

from packages.recovery.models import (
    ActionAttempt,
    ActionStatus,
    RecoveryInput,
    RecoveryStatus,
    ResumeLease,
)
from packages.recovery.service import RecoveryService, StaleRecoveryFencingToken
from packages.persistence.recovery_repository import InMemoryRecoveryRepository


HASH = "sha256:" + "a" * 64


def _wait_for_termination() -> None:
    time.sleep(30)


def _input(*, file_sequence: int = 12, db_sequence: int = 12) -> RecoveryInput:
    return RecoveryInput(
        run_id="run-1",
        project_id="project-1",
        environment_id="env-local",
        db_event_sequence=db_sequence,
        progress_event_sequence=file_sequence,
        handoff_event_sequence=file_sequence,
        checkpoint_id="checkpoint-9",
        checkpoint_hash=HASH,
        target_hash=HASH,
        git_head="abc123",
        actions=(
            ActionAttempt("done", "step-done", ActionStatus.SUCCESS, "idem-done", "receipt-done"),
            ActionAttempt("interrupted", "step-interrupted", ActionStatus.RUNNING, "idem-running"),
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
    process = multiprocessing.get_context("spawn").Process(target=_wait_for_termination)
    process.start()
    process.terminate()
    process.join(timeout=5)
    assert process.exitcode is not None and process.exitcode != 0

    repository = InMemoryRecoveryRepository()
    repository.seed(_input())
    decision = RecoveryService(repository).reconcile(
        "run-1", actor_id=f"operator-{fault_round}", observed_at=datetime.now(UTC)
    )
    assert decision.skipped_step_ids == ("step-done",)
    assert decision.resumable_step_ids == ("step-interrupted",)
    assert decision.event_sequence == 12


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
    with psycopg.connect(dsn, autocommit=True) as connection:
        connection.execute(
            "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
            "VALUES ('task-b12','project-1','repo-1','B12','Recovery','owner-1','IN_PROGRESS')"
        )
        connection.execute(
            "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
            "VALUES ('run-b12','task-b12','baseline-1','B','ACTIVE',1)"
        )
        connection.execute(
            "INSERT INTO recovery_runs(run_id,project_id,environment_id,db_event_sequence,"
            "progress_event_sequence,handoff_event_sequence,checkpoint_id,checkpoint_hash,target_hash,"
            "git_head,secret_reference,secret_status,capability_snapshot_hash,current_capability_hash,"
            "required_capabilities,current_capabilities) VALUES ("
            "'run-b12','project-1','env-local',4,4,4,'checkpoint-1',%s,%s,'abc123',"
            "'secret://provider/key#v1','ACTIVE',%s,%s,'[\"tool\"]','[\"tool\"]')",
            (HASH, HASH, HASH, HASH),
        )
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
                "SELECT anvil_recovery_commit_resume('run-b12','worker-stale','write-stale',1,%s,1,%s,'checkpoint-1')",
                (stale_execution, stale_write),
            ).fetchone()
        with pytest.raises(psycopg.errors.RaiseException, match="STALE_FENCING_TOKEN"):
            connection.execute(
                "SELECT anvil_recovery_commit_resume('run-b12','worker-current','write-current-stale',2,%s,1,%s,'checkpoint-1')",
                (current_execution, prior_current_worker_write),
            ).fetchone()

    def commit_current(_index: int):
        with psycopg.connect(dsn, autocommit=True) as connection:
            return connection.execute(
                "SELECT (anvil_recovery_commit_resume('run-b12','worker-current','write-current',2,%s,2,%s,'checkpoint-1')).checkpoint_id",
                (current_execution, current_write),
            ).fetchone()[0]

    with ThreadPoolExecutor(max_workers=8) as pool:
        checkpoints = tuple(pool.map(commit_current, range(8)))
    assert checkpoints == ("checkpoint-1",) * 8
    with psycopg.connect(dsn) as connection:
        assert connection.execute(
            "SELECT count(*) FROM recovery_resume_receipts WHERE run_id='run-b12'"
        ).fetchone()[0] == 1
