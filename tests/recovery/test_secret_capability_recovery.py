from __future__ import annotations

from datetime import UTC, datetime

from packages.persistence.recovery_repository import InMemoryRecoveryRepository
from packages.recovery.models import ActionAttempt, ActionStatus, RecoveryInput, RecoveryStatus
from packages.recovery.service import RecoveryService


HASH_A = "sha256:" + "a" * 64
HASH_B = "sha256:" + "b" * 64


def _input(*, secret_status: str = "ACTIVE", capability_hash: str = HASH_A) -> RecoveryInput:
    return RecoveryInput(
        run_id="run-1",
        project_id="project-1",
        environment_id="env-local",
        db_event_sequence=7,
        progress_event_sequence=7,
        handoff_event_sequence=7,
        checkpoint_id="checkpoint-1",
        checkpoint_hash=HASH_A,
        target_hash=HASH_A,
        git_head="abc123",
        actions=(ActionAttempt("action-1", "step-1", ActionStatus.RUNNING, "idem-1"),),
        secret_reference="secret://provider/key#v4",
        secret_status=secret_status,
        capability_snapshot_hash=HASH_A,
        current_capability_hash=capability_hash,
        required_capabilities=frozenset({"tool", "json"}),
        current_capabilities=frozenset({"tool", "json"}),
    )


def test_revoked_secret_blocks_before_secret_read_or_provider_call_and_audits_reference_only() -> None:
    repository = InMemoryRecoveryRepository()
    repository.seed(_input(secret_status="REVOKED"))
    calls: list[str] = []
    service = RecoveryService(
        repository,
        read_secret=lambda reference: calls.append(f"secret:{reference}"),
        call_provider=lambda: calls.append("provider"),
    )

    decision = service.reconcile("run-1", actor_id="operator-1", observed_at=datetime.now(UTC))

    assert decision.status is RecoveryStatus.BLOCKED_SECRET_REVOKED
    assert calls == []
    audit = repository.audit_events("run-1")[-1]
    assert audit.event_type == "RECOVERY_SECRET_REVOKED"
    assert audit.secret_reference == "secret://provider/key#v4"
    assert "value" not in audit.as_public_dict()


def test_capability_hash_drift_blocks_without_automatic_fallback() -> None:
    repository = InMemoryRecoveryRepository()
    repository.seed(_input(capability_hash=HASH_B))

    decision = RecoveryService(repository).reconcile(
        "run-1", actor_id="operator-1", observed_at=datetime.now(UTC)
    )

    assert decision.status is RecoveryStatus.BLOCKED_CAPABILITY_DRIFT
    assert decision.blocked_reason == "CAPABILITY_SNAPSHOT_DRIFT"
    assert decision.next_action == "CREATE_NEW_RUN_OR_REPLAN"

