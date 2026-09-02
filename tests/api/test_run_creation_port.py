from __future__ import annotations

from dataclasses import dataclass

from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.run_creation import RunCreationPort
from packages.execution.run_creation import RunCreationReceipt


@dataclass
class _Service:
    calls: list = None

    def __post_init__(self):
        self.calls = []

    def create(self, command):
        self.calls.append(command)
        return RunCreationReceipt("run-server-1", "task-1", "ANALYZING", "ACTIVE", ("evt-1",), False)


def _client(service, permissions=frozenset({"tasks:write"})):
    principal = SessionPrincipal("operator-1", "operator", "csrf", permissions, frozenset({"project-1"}), frozenset({"env-1"}))
    app = create_app(
        ports=ApiPorts(commands={"POST /api/tasks/{taskId}/runs": RunCreationPort(service)}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda endpoint, params: AuthorizationScope("project-1", "env-1", frozenset({"operator"})),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")
    return client


def _post(client):
    return client.post(
        "/api/tasks/task-1/runs",
        headers={
            "host": "anvil.local", "origin": "https://anvil.local", "x-csrf-token": "csrf",
            "idempotency-key": "task-1-run-1", "if-match": '"3"',
            "x-target-hash": "sha256:" + "a" * 64, "x-permission-scope": "tasks:write",
            "x-reason": "start approved run",
        },
        json={
            "workInstructionId": "wi-1", "executionPlanId": "plan-1", "expectedStateVersion": 3,
            "priorRunId": None, "resumeCheckpointId": None,
        },
    )


def test_canonical_run_start_is_server_identified_and_returns_202():
    service = _Service()
    response = _post(_client(service))
    assert response.status_code == 202
    assert response.json() == {
        "runId": "run-server-1", "phase": "ANALYZING", "status": "ACTIVE",
        "eventStreamUrl": "/api/runs/run-server-1/events",
    }
    command = service.calls[0]
    assert command.run_id is None
    assert command.work_instruction_id == "wi-1"
    assert command.execution_plan_id == "plan-1"
    assert command.expected_task_version == 3
    assert command.project_id == "project-1"
    assert command.environment_id == "env-1"
    assert command.permission_snapshot_hash == "sha256:df6276cdcb5f47a7600977849fbdcf8cc53044dd8b41934eeed71b0d4efe4565"


def test_snake_case_or_client_run_id_is_rejected():
    service = _Service()
    client = _client(service)
    response = client.post(
        "/api/tasks/task-1/runs",
        headers={
            "host": "anvil.local", "origin": "https://anvil.local", "x-csrf-token": "csrf",
            "idempotency-key": "task-1-run-1", "if-match": '"3"',
            "x-target-hash": "sha256:" + "a" * 64, "x-permission-scope": "tasks:write", "x-reason": "start",
        },
        json={"run_id": "client-run", "work_instruction_id": "wi-1", "execution_plan_id": "plan-1", "expected_state_version": 3},
    )
    assert response.status_code == 400
    assert service.calls == []


def test_read_only_test_session_cannot_start_run():
    service = _Service()
    response = _post(_client(service, frozenset({"run:events:read"})))
    assert response.status_code == 403
    assert service.calls == []


def test_blank_or_oversized_authority_ids_are_rejected_as_4xx():
    service = _Service()
    client = _client(service)
    for key, value in (("workInstructionId", "x" * 129), ("executionPlanId", " "), ("priorRunId", "")):
        body = {
            "workInstructionId": "wi-1", "executionPlanId": "plan-1", "expectedStateVersion": 3,
            "priorRunId": None, "resumeCheckpointId": None,
        }
        body[key] = value
        if key == "priorRunId":
            body["resumeCheckpointId"] = "checkpoint-1"
        response = client.post(
            "/api/tasks/task-1/runs",
            headers={
                "host": "anvil.local", "origin": "https://anvil.local", "x-csrf-token": "csrf",
                "idempotency-key": "task-1-run-1", "if-match": '"3"',
                "x-target-hash": "sha256:" + "a" * 64, "x-permission-scope": "tasks:write",
                "x-reason": "start approved run",
            },
            json=body,
        )
        assert 400 <= response.status_code < 500
    assert service.calls == []
