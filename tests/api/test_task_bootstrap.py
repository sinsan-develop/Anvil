from __future__ import annotations

from dataclasses import dataclass, field
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from packages.api.common import (
    ApiContractError,
    ApplicationRequest,
    ApplicationResponse,
    SessionPrincipal,
)
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.security import WebSecurityConfig
from packages.api.task_bootstrap import (
    TaskBootstrapAuthorityMismatch,
    ProjectRepositoryUnresolved,
    canonical_task_authority_hash,
    TaskBootstrapIdempotencyMismatch,
    TaskBootstrapPort,
    TaskBootstrapReceipt,
)


@dataclass
class _TaskService:
    mappings: dict[tuple[str, str], str] = field(default_factory=dict)
    creates: list = field(default_factory=list)
    records: dict[str, TaskBootstrapReceipt] = field(default_factory=dict)
    reject_mismatch: bool = False
    expected_target_hash: str | None = None

    def create(self, command):
        if self.reject_mismatch:
            raise TaskBootstrapIdempotencyMismatch(command.idempotency_key)
        if self.expected_target_hash is not None and command.target_hash != self.expected_target_hash:
            raise TaskBootstrapAuthorityMismatch(command.target_hash)
        repository_id = self.mappings.get((command.project_id, command.target_environment))
        if repository_id is None:
            raise ProjectRepositoryUnresolved(command.project_id)
        self.creates.append(command)
        receipt = self.records.setdefault(
            "task-server-1",
            TaskBootstrapReceipt(
                task_id="task-server-1",
                project_id=command.project_id,
                repository_id=repository_id,
                objective=command.objective,
                target_environment=command.target_environment,
                conversation_message=command.conversation_message,
                requested_by=command.requested_by,
                status="DRAFT",
                version=1,
                duplicate=False,
            ),
        )
        return receipt

    def get(self, task_id, *, project_id, environment_id):
        receipt = self.records.get(task_id)
        if receipt is None or receipt.project_id != project_id or receipt.target_environment != environment_id:
            return None
        return receipt


def _client(service: _TaskService, *, permissions=frozenset({"tasks:read", "tasks:write"})):
    principal = SessionPrincipal(
        "operator-1",
        "operator",
        "csrf-token",
        permissions,
        frozenset({"project-1"}),
        frozenset({"env-local"}),
    )

    def resolve_scope(endpoint, parameters):
        if endpoint.key == "POST /api/projects/{projectId}/tasks":
            return AuthorizationScope(
                parameters["projectId"],
                parameters.get("targetEnvironment", ""),
                frozenset({"operator"}),
            )
        return AuthorizationScope("project-1", "env-local", frozenset({"operator"}))

    app = create_app(
        ports=ApiPorts(
            commands={"POST /api/projects/{projectId}/tasks": TaskBootstrapPort(service)},
            queries={"GET /api/tasks/{taskId}": TaskBootstrapPort(service)},
        ),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=resolve_scope,
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")
    return client


def _create_headers(
    *,
    project_id: str = "project-1",
    repository_id: str = "repository-1",
    target_environment: str = "env-local",
    mapping_version: int = 1,
):
    return {
        "host": "anvil.local",
        "origin": "https://anvil.local",
        "x-csrf-token": "csrf-token",
        "idempotency-key": "task-create-1",
        "if-match": '"0"',
        "x-target-hash": canonical_task_authority_hash(
            project_id=project_id,
            repository_id=repository_id,
            target_environment=target_environment,
            mapping_version=mapping_version,
        ),
        "x-permission-scope": "tasks:write",
        "x-reason": "create an approved task draft",
    }


def _create_body():
    return {
        "objective": "Reject an unknown member id with 404.",
        "targetEnvironment": "env-local",
        "conversationMessage": "Preserve the existing member response contract.",
    }


def test_task_create_persists_server_owned_draft_with_authenticated_actor():
    """Dropping Task bootstrap routing or actor propagation must fail this contract."""
    service = _TaskService({("project-1", "env-local"): "repository-1"})

    response = _client(service).post(
        "/api/projects/project-1/tasks",
        headers=_create_headers(),
        json=_create_body(),
    )

    assert response.status_code == 201
    assert response.json() == {"taskId": "task-server-1", "status": "draft"}
    assert service.creates[0].task_id is None
    assert service.creates[0].requested_by == "operator-1"
    assert service.creates[0].expected_version == 0
    assert service.creates[0].target_hash == canonical_task_authority_hash(
        project_id="project-1",
        repository_id="repository-1",
        target_environment="env-local",
        mapping_version=1,
    )


def test_task_post_rejects_invalid_injected_application_responses():
    """Passing malformed Task port output through the HTTP adapter must fail closed."""
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    invalid = (
        ApplicationResponse({"taskId": "task-1", "status": "DRAFT"}, 201),
        ApplicationResponse({"taskId": "task-1", "status": "draft", "extra": True}, 201),
        ApplicationResponse({"taskId": 1, "status": "draft"}, 201),
        ApplicationResponse({"taskId": "task-1", "status": "draft"}, 200),
    )
    for response in invalid:
        app = create_app(
            ports=ApiPorts(commands={"POST /api/projects/{projectId}/tasks": lambda _request, item=response: item}),
            authenticate=lambda token: principal if token == "session" else None,
            authorization_resolver=lambda _endpoint, parameters: AuthorizationScope(
                parameters["projectId"], parameters["targetEnvironment"], frozenset({"operator"})
            ),
        )
        client = TestClient(app, base_url="https://anvil.local")
        client.cookies.set("anvil_session", "session")
        actual = client.post("/api/projects/project-1/tasks", headers=_create_headers(), json=_create_body())
        assert actual.status_code == 500
        assert actual.json()["error"]["code"] == "API_RESPONSE_CONTRACT_INVALID"


def test_task_post_rejects_a_raw_mapping_before_serialization():
    """Allowing a raw mapping to bypass the Task response contract must fail closed."""
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    app = create_app(
        ports=ApiPorts(commands={"POST /api/projects/{projectId}/tasks": lambda _request: {"taskId": "task-1", "status": "draft"}}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, parameters: AuthorizationScope(
            parameters["projectId"], parameters["targetEnvironment"], frozenset({"operator"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.post(
        "/api/projects/project-1/tasks", headers=_create_headers(), json=_create_body()
    )

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "API_RESPONSE_CONTRACT_INVALID"


def test_task_get_rejects_a_raw_mapping_before_serialization():
    """Allowing a raw mapping to bypass the Task read contract must fail closed."""
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    body = {
        "taskId": "task-1", "projectId": "project-1", "repositoryId": "repository-1",
        "objective": "Read the task.", "targetEnvironment": "env-local", "status": "draft",
        "version": 1, "requirements": [], "questions": [],
    }
    app = create_app(
        ports=ApiPorts(queries={"GET /api/tasks/{taskId}": lambda _request: body}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _parameters: AuthorizationScope(
            "project-1", "env-local", frozenset({"operator"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.get("/api/tasks/task-1", headers={"host": "anvil.local"})

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "API_RESPONSE_CONTRACT_INVALID"


def test_task_get_rejects_scalar_requirements_and_questions():
    """Replacing either canonical collection with a scalar must fail closed."""
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    base_body = {
        "taskId": "task-1", "projectId": "project-1", "repositoryId": "repository-1",
        "objective": "Read the task.", "targetEnvironment": "env-local", "status": "draft",
        "version": 1, "requirements": [], "questions": [],
    }
    for field in ("requirements", "questions"):
        invalid_body = {**base_body, field: "not-a-list"}
        app = create_app(
            ports=ApiPorts(
                queries={
                    "GET /api/tasks/{taskId}": lambda _request, item=invalid_body: ApplicationResponse(item, 200)
                }
            ),
            authenticate=lambda token: principal if token == "session" else None,
            authorization_resolver=lambda _endpoint, _parameters: AuthorizationScope(
                "project-1", "env-local", frozenset({"operator"})
            ),
        )
        client = TestClient(app, base_url="https://anvil.local")
        client.cookies.set("anvil_session", "session")

        response = client.get("/api/tasks/task-1", headers={"host": "anvil.local"})

        assert response.status_code == 500
        assert response.json()["error"]["code"] == "API_RESPONSE_CONTRACT_INVALID"


def test_task_create_fails_closed_before_port_without_tasks_write_permission():
    """Replacing authorization with a permissive path must fail before persistence is reached."""
    service = _TaskService()

    response = _client(service, permissions=frozenset({"tasks:read"})).post(
        "/api/projects/project-1/tasks",
        headers=_create_headers(),
        json=_create_body(),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"
    assert service.creates == []


def test_task_create_rejects_same_key_with_different_persistence_fingerprint():
    """Treating a mismatched idempotency retry as success must remain observable."""
    service = _TaskService({("project-1", "env-local"): "repository-1"}, reject_mismatch=True)

    response = _client(service).post(
        "/api/projects/project-1/tasks",
        headers=_create_headers(),
        json=_create_body(),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TASK_IDEMPOTENCY_MISMATCH"


def test_task_create_fails_closed_when_no_authoritative_repository_mapping_exists():
    """Replacing a missing mapping with an implicit repository identity must fail closed."""
    response = _client(_TaskService()).post(
        "/api/projects/project-1/tasks", headers=_create_headers(), json=_create_body()
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PROJECT_REPOSITORY_UNRESOLVED"


def test_mutation_rejects_a_different_allowed_origin_than_the_request_host():
    """Dropping the Host-Origin authority comparison must reject a cross-origin mutation."""
    service = _TaskService({("project-1", "env-local"): "repository-1"})
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    app = create_app(
        ports=ApiPorts(commands={"POST /api/projects/{projectId}/tasks": TaskBootstrapPort(service)}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, parameters: AuthorizationScope(
            parameters["projectId"], parameters["targetEnvironment"], frozenset({"operator"})
        ),
        security_config=WebSecurityConfig(
            allowed_hosts=frozenset({"one.anvil.local", "two.anvil.local"}),
            allowed_origins=frozenset({"https://one.anvil.local", "https://two.anvil.local"}),
        ),
    )
    client = TestClient(app, base_url="https://one.anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.post(
        "/api/projects/project-1/tasks",
        headers={
            **_create_headers(),
            "host": "one.anvil.local",
            "origin": "https://two.anvil.local",
        },
        json=_create_body(),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_VALIDATION_FAILED"
    assert service.creates == []


def test_mutation_rejects_allowlisted_http_origin_for_an_https_request():
    """Dropping request-scheme comparison must not permit an http Origin on HTTPS."""
    service = _TaskService({("project-1", "env-local"): "repository-1"})
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    app = create_app(
        ports=ApiPorts(commands={"POST /api/projects/{projectId}/tasks": TaskBootstrapPort(service)}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, parameters: AuthorizationScope(
            parameters["projectId"], parameters["targetEnvironment"], frozenset({"operator"})
        ),
        security_config=WebSecurityConfig(
            allowed_hosts=frozenset({"anvil.local"}),
            allowed_origins=frozenset({"http://anvil.local", "https://anvil.local"}),
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.post(
        "/api/projects/project-1/tasks",
        headers={**_create_headers(), "host": "anvil.local", "origin": "http://anvil.local"},
        json=_create_body(),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_VALIDATION_FAILED"
    assert service.creates == []


def test_mutation_accepts_https_origin_at_an_http_tls_termination_backend():
    """Requiring the backend scheme to equal an HTTPS Origin must not break TLS termination."""
    service = _TaskService({("project-1", "env-local"): "repository-1"})
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    app = create_app(
        ports=ApiPorts(commands={"POST /api/projects/{projectId}/tasks": TaskBootstrapPort(service)}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, parameters: AuthorizationScope(
            parameters["projectId"], parameters["targetEnvironment"], frozenset({"operator"})
        ),
        security_config=WebSecurityConfig(
            allowed_hosts=frozenset({"anvil.local"}),
            allowed_origins=frozenset({"https://anvil.local"}),
        ),
    )
    client = TestClient(app, base_url="http://anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.post(
        "/api/projects/project-1/tasks",
        headers={**_create_headers(), "host": "anvil.local", "origin": "https://anvil.local"},
        json=_create_body(),
    )

    assert response.status_code == 201
    assert len(service.creates) == 1


def test_mutation_rejects_an_origin_port_that_differs_from_request_authority():
    """Ignoring an explicit authority port must not permit a cross-origin mutation."""
    from packages.api.fastapi_app import _origin

    request = Request(
        {
            "type": "http",
            "scheme": "https",
            "server": ("anvil.local", 8443),
            "client": ("10.0.0.10", 50000),
            "method": "POST",
            "path": "/api/projects/project-1/tasks",
            "raw_path": b"/api/projects/project-1/tasks",
            "query_string": b"",
            "headers": [
                (b"host", b"anvil.local:8443"),
                (b"origin", b"https://anvil.local"),
            ],
        }
    )
    config = WebSecurityConfig(
        allowed_hosts=frozenset({"anvil.local"}),
        allowed_origins=frozenset({"https://anvil.local"}),
    )

    with pytest.raises(ApiContractError) as raised:
        _origin(request, config, required=True)

    assert raised.value.code == "ORIGIN_VALIDATION_FAILED"


def test_task_create_rejects_path_project_scope_mismatch_before_calling_port():
    """Passing a different authorized project to the port must fail before any side effect."""
    calls = []
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1", "project-2"}), frozenset({"env-local"}),
    )

    def port(request):
        calls.append(request)
        return ApplicationResponse({"taskId": "task-1", "status": "draft"}, 201)

    app = create_app(
        ports=ApiPorts(commands={"POST /api/projects/{projectId}/tasks": port}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _parameters: AuthorizationScope(
            "project-2", "env-local", frozenset({"operator"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.post(
        "/api/projects/project-1/tasks", headers=_create_headers(), json=_create_body()
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "AUTHORIZATION_PROJECT_DENIED"
    assert calls == []


def test_task_create_rejects_body_environment_scope_mismatch_before_calling_port():
    """Passing a different authorized environment to the port must fail before any side effect."""
    calls = []
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1"}), frozenset({"env-local", "env-other"}),
    )

    def port(request):
        calls.append(request)
        return ApplicationResponse({"taskId": "task-1", "status": "draft"}, 201)

    app = create_app(
        ports=ApiPorts(commands={"POST /api/projects/{projectId}/tasks": port}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _parameters: AuthorizationScope(
            "project-1", "env-other", frozenset({"operator"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.post(
        "/api/projects/project-1/tasks", headers=_create_headers(), json=_create_body()
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "AUTHORIZATION_ENVIRONMENT_DENIED"
    assert calls == []


def test_task_port_preserves_environment_authorization_error_before_repository_create():
    """Catching ApiContractError as ValueError must not shadow the direct-port 403 contract."""
    service = _TaskService({("project-1", "env-local"): "repository-1"})
    principal = SessionPrincipal(
        "operator-1", "operator", "csrf-token", frozenset({"tasks:write"}),
        frozenset({"project-1"}), frozenset({"env-local", "env-other"}),
    )
    request = ApplicationRequest(
        endpoint_key="POST /api/projects/{projectId}/tasks",
        resource_id=None,
        path_parameters={"projectId": "project-1"},
        body=_create_body(),
        headers={key.lower(): value for key, value in _create_headers().items()},
        principal=principal,
        request_id="request-direct-port-1",
        expected_version=0,
        target_hash=_create_headers()["x-target-hash"],
        reason="create an approved task draft",
        authorized_project_id="project-1",
        authorized_environment_id="env-other",
    )

    with pytest.raises(ApiContractError) as raised:
        TaskBootstrapPort(service)(request)

    assert raised.value.code == "AUTHORIZATION_ENVIRONMENT_DENIED"
    assert raised.value.status_code == 403
    assert service.creates == []


def test_mutation_compares_origin_with_actual_request_host_not_forwarded_host():
    """Trusting an X-Forwarded-Host at this boundary must not replace request authority."""
    from packages.api.fastapi_app import _origin

    request = Request(
        {
            "type": "http",
            "scheme": "https",
            "server": ("anvil.local", 443),
            "client": ("10.0.0.10", 50000),
            "method": "POST",
            "path": "/api/projects/project-1/tasks",
            "raw_path": b"/api/projects/project-1/tasks",
            "query_string": b"",
            "headers": [
                (b"host", b"anvil.local"),
                (b"origin", b"https://anvil.local"),
                (b"x-forwarded-host", b"evil.invalid"),
            ],
        }
    )
    config = WebSecurityConfig(
        allowed_hosts=frozenset({"anvil.local"}),
        allowed_origins=frozenset({"https://anvil.local"}),
        trusted_proxy_ips=frozenset({"10.0.0.10"}),
    )

    _origin(request, config, required=True)


def test_task_authority_hash_is_a_stable_public_contract():
    """Changing the authority fields or canonical encoding must change the published hash."""
    assert canonical_task_authority_hash(
        project_id="project-1",
        repository_id="repository-1",
        target_environment="env-local",
        mapping_version=7,
    ) == "sha256:de8c0a8f42b919c7c814beb9245ad877f70a6d9bc40fa3f8c536ada1efc6aeed"


def test_task_create_rejects_a_target_hash_that_does_not_match_mapping_authority():
    """Accepting an arbitrary canonical hash must fail before a Task is persisted."""
    expected = canonical_task_authority_hash(
        project_id="project-1",
        repository_id="repository-1",
        target_environment="env-local",
        mapping_version=1,
    )
    service = _TaskService(
        {("project-1", "env-local"): "repository-1"}, expected_target_hash=expected
    )
    headers = {**_create_headers(), "x-target-hash": "sha256:" + "b" * 64}

    response = _client(service).post(
        "/api/projects/project-1/tasks", headers=headers, json=_create_body()
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TASK_TARGET_HASH_MISMATCH"
    assert service.creates == []


def test_task_read_returns_the_canonical_task_projection():
    """Removing the canonical read route or omitting project/task fields must fail."""
    service = _TaskService({("project-1", "env-local"): "repository-1"})
    created = _client(service).post(
        "/api/projects/project-1/tasks", headers=_create_headers(), json=_create_body()
    )
    assert created.status_code == 201

    response = _client(service).get("/api/tasks/task-server-1", headers={"host": "anvil.local"})

    assert response.status_code == 200
    assert response.json() == {
        "taskId": "task-server-1",
        "projectId": "project-1",
        "repositoryId": "repository-1",
        "objective": "Reject an unknown member id with 404.",
        "targetEnvironment": "env-local",
        "status": "draft",
        "version": 1,
        "requirements": [],
        "questions": [],
    }


@pytest.mark.parametrize(
    ("stored_status", "version", "public_status"),
    (("CONFIRMED", 2, "confirmed"), ("IN_PROGRESS", 3, "in_progress")),
)
def test_task_read_accepts_canonical_post_draft_lifecycle_statuses(
    stored_status, version, public_status
):
    """Restricting GET to draft must not hide a Task after its lifecycle advances."""
    service = _TaskService({("project-1", "env-local"): "repository-1"})
    service.records["task-server-1"] = TaskBootstrapReceipt(
        task_id="task-server-1",
        project_id="project-1",
        repository_id="repository-1",
        objective="Advance the canonical Task lifecycle.",
        target_environment="env-local",
        conversation_message="Read the current lifecycle projection.",
        requested_by="operator-1",
        status=stored_status,
        version=version,
        duplicate=False,
    )

    response = _client(service).get(
        "/api/tasks/task-server-1", headers={"host": "anvil.local"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == public_status
    assert response.json()["version"] == version


def test_task_bootstrap_routes_are_exposed_by_the_canonical_registry_and_openapi():
    """Removing either Task route from the registry must change the exposed contract."""
    registry = __import__("packages.api.registry", fromlist=["canonical_api_registry"])
    entries = {(endpoint.method, endpoint.path) for endpoint in registry.canonical_api_registry().endpoints}
    assert ("POST", "/api/projects/{projectId}/tasks") in entries
    assert ("GET", "/api/tasks/{taskId}") in entries
    openapi = create_app(registry=registry.canonical_api_registry()).openapi()
    create = openapi["paths"]["/api/projects/{projectId}/tasks"]["post"]
    read = openapi["paths"]["/api/tasks/{taskId}"]["get"]
    assert create["requestBody"]["content"]["application/json"]["schema"] == {
        "type": "object",
        "additionalProperties": False,
        "required": ["objective", "targetEnvironment", "conversationMessage"],
        "properties": {
            "objective": {"type": "string", "minLength": 1},
            "targetEnvironment": {"type": "string", "minLength": 1},
            "conversationMessage": {"type": "string", "minLength": 1},
        },
    }
    assert create["responses"]["201"]["content"]["application/json"]["schema"] == {
        "type": "object",
        "additionalProperties": False,
        "required": ["taskId", "status"],
        "properties": {
            "taskId": {"type": "string"},
            "status": {"type": "string", "enum": ["draft"]},
        },
    }
    assert read["responses"]["200"]["content"]["application/json"]["schema"] == {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "taskId", "projectId", "repositoryId", "objective", "targetEnvironment",
            "status", "version", "requirements", "questions",
        ],
        "properties": {
            "taskId": {"type": "string"},
            "projectId": {"type": "string"},
            "repositoryId": {"type": "string"},
            "objective": {"type": "string"},
            "targetEnvironment": {"type": "string"},
            "status": {
                "type": "string",
                "enum": ["draft", "confirmed", "in_progress", "completed", "cancelled"],
            },
            "version": {"type": "integer", "minimum": 1},
            "requirements": {"type": "array", "items": {"type": "object"}},
            "questions": {"type": "array", "items": {"type": "object"}},
        },
    }


def test_task_bootstrap_migration_renders_offline_upgrade_and_downgrade_sql():
    """Changing Alembic constraint call signatures must render both offline directions."""
    root = Path(__file__).resolve().parents[2]
    environment = {
        **os.environ,
        "ANVIL_DATABASE_URL": "postgresql://offline:offline@localhost/anvil",
    }

    upgrade = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "0013_task_bootstrap_authority", "--sql"],
        cwd=root,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    downgrade = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "downgrade",
            "0013_task_bootstrap_authority:0012_run_authority",
            "--sql",
        ],
        cwd=root,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )

    assert upgrade.returncode == 0, upgrade.stderr
    assert "CREATE TABLE project_repositories" in upgrade.stdout
    assert "ck_tasks_creation_request_hash" in upgrade.stdout
    assert downgrade.returncode == 0, downgrade.stderr
    assert "DROP CONSTRAINT ck_tasks_creation_request_hash" in downgrade.stdout
    assert "DROP CONSTRAINT ck_tasks_repository_mapping_version" in downgrade.stdout
    assert "DROP COLUMN repository_mapping_version" in downgrade.stdout


def test_runtime_factory_binds_task_create_and_read_ports(monkeypatch):
    """Removing either runtime Task port must turn the canonical route into fail-closed 501."""
    from packages.api import runtime
    from packages.persistence import task_bootstrap_repository

    class _RuntimeTaskRepository(_TaskService):
        def __init__(self, _session_factory):
            super().__init__({("project-1", "env-local"): "repository-1"})

        def resolve_create_authority(self, project_id, environment_id):
            repository_id = self.mappings.get((project_id, environment_id))
            return (
                SimpleNamespace(
                    project_id=project_id,
                    repository_id=repository_id,
                    target_environment=environment_id,
                )
                if repository_id
                else None
            )

        def resolve_task_authority(self, task_id):
            receipt = self.records.get(task_id)
            return (
                SimpleNamespace(
                    project_id=receipt.project_id,
                    repository_id=receipt.repository_id,
                    target_environment=receipt.target_environment,
                )
                if receipt
                else None
            )

    monkeypatch.setattr(task_bootstrap_repository, "SqlAlchemyTaskBootstrapRepository", _RuntimeTaskRepository)
    principal = SessionPrincipal(
        "operator-1",
        "operator",
        "csrf-token",
        frozenset({"tasks:read", "tasks:write"}),
        frozenset({"project-1"}),
        frozenset({"env-local"}),
    )
    environment = {
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "telegram-secret",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "internal-secret",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil.sinsan.kr",
        "ANVIL_PUBLIC_HOST": "anvil.sinsan.kr",
    }
    app = runtime.create_runtime_app(
        environment=environment,
        session_factory=lambda: object(),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, parameters: AuthorizationScope(
            "project-1", parameters.get("targetEnvironment", "env-local"), frozenset({"operator"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.sinsan.kr")
    client.cookies.set("anvil_session", "session")

    created = client.post(
        "/api/projects/project-1/tasks", headers={**_create_headers(), "host": "anvil.sinsan.kr", "origin": "https://anvil.sinsan.kr"}, json=_create_body()
    )
    read = client.get("/api/tasks/task-server-1", headers={"host": "anvil.sinsan.kr"})

    assert created.status_code == 201
    assert read.status_code == 200
