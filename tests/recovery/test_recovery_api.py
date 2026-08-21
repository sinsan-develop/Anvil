from __future__ import annotations

from datetime import UTC, datetime
import subprocess
import sys

from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import AuthorizationScope, create_app
from packages.persistence.recovery_repository import InMemoryRecoveryRepository
from packages.recovery.api import RecoveryApi
from packages.recovery.models import ActionAttempt, ActionStatus, RecoveryInput
from packages.recovery.service import RecoveryService


HASH = "sha256:" + "c" * 64


def test_repository_imports_first_in_a_fresh_runtime_process() -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import packages.persistence.recovery_repository"],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def _client(*, secret_status: str = "ACTIVE") -> tuple[TestClient, InMemoryRecoveryRepository]:
    repository = InMemoryRecoveryRepository()
    repository.seed(
        RecoveryInput(
            run_id="run-1",
            project_id="project-1",
            environment_id="env-local",
            db_event_sequence=4,
            progress_event_sequence=4,
            handoff_event_sequence=4,
            checkpoint_id="checkpoint-2",
            checkpoint_hash=HASH,
            target_hash=HASH,
            git_head="abc123",
            actions=(ActionAttempt("a1", "s1", ActionStatus.SUCCESS, "idem", "receipt"),),
            secret_reference="secret://provider/key#v1",
            secret_status=secret_status,
            capability_snapshot_hash=HASH,
            current_capability_hash=HASH,
            required_capabilities=frozenset({"tool"}),
            current_capabilities=frozenset({"tool"}),
        )
    )
    api = RecoveryApi(RecoveryService(repository), observed_at=lambda: datetime.now(UTC))
    principal = SessionPrincipal(
        "owner-1",
        "owner",
        "csrf-1",
        frozenset({"runs:read", "runs:reconcile"}),
        frozenset({"project-1"}),
        frozenset({"env-local"}),
    )
    app = create_app(
        recovery_ports=api.ports(),
        authenticate=lambda token: principal if token == "session-1" else None,
        authorization_resolver=lambda _endpoint, _path: AuthorizationScope(
            "project-1", "env-local", frozenset({"owner"})
        ),
    )
    client = TestClient(app)
    client.cookies.set("anvil_session", "session-1")
    return client, repository


def runtime_app():
    """Create the same recovery app for loopback uvicorn evidence."""
    client, _repository = _client()
    return client.app


def test_recovery_read_model_exposes_hash_checkpoint_reason_and_next_action() -> None:
    client, _ = _client()

    response = client.get(
        "/api/runs/run-1/progress",
        headers={"host": "anvil.local", "x-request-id": "req-recovery-1"},
    )

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "req-recovery-1"
    data = response.json()["data"]
    assert data["target_hash"] == HASH
    assert data["last_safe_checkpoint"]["checkpoint_id"] == "checkpoint-2"
    assert data["blocked_reason"] is None
    assert data["next_action"] == "RESUME_INTERRUPTED_STEPS"
    assert "secret_reference" not in data


def test_reconcile_mutation_preserves_b11_auth_scope_and_target_hash_guards() -> None:
    client, _ = _client()
    headers = {
        "host": "anvil.local",
        "origin": "https://anvil.local",
        "x-csrf-token": "csrf-1",
        "idempotency-key": "reconcile-1",
        "if-match": '"4"',
        "x-target-hash": HASH,
        "x-permission-scope": "runs:reconcile",
        "x-reason": "recover after process exit",
    }

    denied = client.post(
        "/api/runs/run-1:reconcile",
        headers={**headers, "x-target-hash": "sha256:" + "d" * 64},
        json={"expected_state_version": 4},
    )
    allowed = client.post(
        "/api/runs/run-1:reconcile",
        headers=headers,
        json={"expected_state_version": 4},
    )

    assert denied.status_code == 409
    assert denied.json()["error"]["code"] == "RECOVERY_TARGET_HASH_MISMATCH"
    assert allowed.status_code == 200
    assert allowed.json()["data"]["event_sequence"] == 4


def test_target_hash_mismatch_is_rejected_before_recovery_audit_side_effect() -> None:
    client, repository = _client(secret_status="REVOKED")
    response = client.post(
        "/api/runs/run-1:reconcile",
        headers={
            "host": "anvil.local",
            "origin": "https://anvil.local",
            "x-csrf-token": "csrf-1",
            "idempotency-key": "reconcile-hostile",
            "if-match": '"4"',
            "x-target-hash": "sha256:" + "d" * 64,
            "x-permission-scope": "runs:reconcile",
            "x-reason": "hostile stale target",
        },
        json={"expected_state_version": 4},
    )
    assert response.status_code == 409
    assert repository.audit_events("run-1") == ()
