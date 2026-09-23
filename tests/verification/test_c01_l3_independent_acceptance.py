from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from copy import deepcopy
from hashlib import sha256
import importlib
import inspect
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from packages.execution.run_creation import RunCreationCommand
from packages.llm_gateway.contracts import CapabilityProbe, GatewayRequest, GatewayResponse, TokenUsage, UsageProvenance
from packages.llm_gateway.native import NativeAgentAdapter
from packages.persistence.run_creation_repository import SqlAlchemyRunCreationRepository


ROOT = Path(__file__).resolve().parents[2]
EXECUTE_PATH = "/api/runs/{id}/steps/{stepId}:execute"
EXECUTE_KEY = f"POST {EXECUTE_PATH}"
PROMPT_SENTINEL = "C01-L3-PROMPT-MUST-NOT-PERSIST"
CREDENTIAL_SENTINEL = "sk-c01-l3-credential-must-not-leak"
FINAL_MODE = os.environ.get("ANVIL_C01_L3_FINAL") == "1"
PARENT_OPENAPI_SHA256 = "b28a72c34253627b1d7c43ae39b1167aa0b50aa4ffbf6aa9a732346297fca2ba"

EXECUTE_REQUEST_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["requestId", "reservationId", "budgetId", "backend", "provider", "model", "pricingVersion", "forecastCost", "forecastTokens", "prompt", "expectedStateVersion", "reason"],
    "properties": {
        "requestId": {"type": "string"}, "reservationId": {"type": "string"},
        "budgetId": {"type": "string"}, "backend": {"type": "string", "enum": ["CLAUDE", "CODEX", "LOCAL"]},
        "provider": {"type": "string"}, "model": {"type": "string"},
        "pricingVersion": {"type": "string"}, "forecastCost": {"type": "string"},
        "forecastTokens": {"type": "integer", "minimum": 0}, "prompt": {"type": "string"},
        "expectedStateVersion": {"type": "integer", "minimum": 0}, "reason": {"type": "string"},
    },
}
EVENT_RECEIPT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["eventId", "type", "sequence", "timestamp", "actor", "correlationId", "causationId", "idempotencyKey"],
    "properties": {
        "eventId": {"type": "string"}, "type": {"type": "string"},
        "sequence": {"type": "integer", "minimum": 1}, "timestamp": {"type": "string", "format": "date-time"},
        "actor": {"type": "object", "additionalProperties": False, "required": ["type", "id"],
                  "properties": {"type": {"type": "string"}, "id": {"type": "string"}}},
        "correlationId": {"type": "string"}, "causationId": {"type": ["string", "null"]},
        "idempotencyKey": {"type": "string"},
    },
}
EXECUTE_200_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["runId", "stepId", "requestId", "reservationId", "backend", "result", "finalUsage", "provenance", "eventReceipts"],
    "properties": {
        "runId": {"type": "string"}, "stepId": {"type": "string"}, "requestId": {"type": "string"},
        "reservationId": {"type": "string"}, "backend": {"type": "string", "enum": ["CLAUDE", "CODEX", "LOCAL"]},
        "result": {"type": "object"},
        "finalUsage": {"type": "object", "additionalProperties": False, "required": ["inputTokens", "outputTokens", "totalTokens"],
                       "properties": {"inputTokens": {"type": "integer", "minimum": 0}, "outputTokens": {"type": "integer", "minimum": 0}, "totalTokens": {"type": "integer", "minimum": 0}}},
        "provenance": {"type": "string"}, "eventReceipts": {"type": "array", "minItems": 1, "items": EVENT_RECEIPT_SCHEMA},
    },
}
EXECUTE_409_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["code", "requestId", "reservationId", "eventReceipts"],
    "properties": {
        "code": {"type": "string"}, "requestId": {"type": "string"}, "reservationId": {"type": "string"},
        "eventReceipts": {"type": "array", "items": EVENT_RECEIPT_SCHEMA},
    },
}

# Immutable normalized operation baseline from parent-approved pre-C-01 HEAD
# a34d12da5f504a5d2694fc04f0924082cb1fc1d9. This is deliberately not built
# from the current registry/OpenAPI at test runtime.
BASELINE_OPENAPI_OPERATIONS = frozenset("""
GET /api/code-patterns
GET /api/code-patterns/{id}
GET /api/design-intent-reviews/{id}
GET /api/evidence-manifests/{id}
GET /api/execution-plans/{id}/graph
GET /api/learning-candidates
GET /api/learning-candidates/{id}/diff
GET /api/learning-sources/{id}/candidates
GET /api/learning-sources/{id}/revocation-impact
GET /api/projects/{id}/data-egress-profile
GET /api/projects/{id}/lineage
GET /api/projects/{id}/progress
GET /api/projects/{id}/timeline
GET /api/provider-routing
GET /api/providers
GET /api/providers/{providerId}
GET /api/providers/{providerId}/models
GET /api/runs/{id}/budget
GET /api/runs/{id}/events
GET /api/runs/{id}/exceptions
GET /api/runs/{id}/learning-review
GET /api/runs/{id}/progress
GET /api/runs/{id}/progress-export
GET /api/tasks/{id}/learning-snapshot
GET /api/tasks/{taskId}
POST /api/brainstorming-decision-sets/{id}:approve
POST /api/completion-reports/{id}/decisions
POST /api/defects
POST /api/defects/{id}:accept
POST /api/defects/{id}:close
POST /api/defects/{id}:ready-for-retest
POST /api/deploy-approvals
POST /api/deployments
POST /api/deployments/{id}:rollback
POST /api/design-baselines/{id}:reopen
POST /api/design-intent-reviews/{id}:continue
POST /api/design-intent-reviews/{id}:report
POST /api/design-specifications/{id}:approve
POST /api/exceptions/{id}/decision
POST /api/execution-plans/{id}:activate
POST /api/execution-plans/{id}:validate
POST /api/execution-plans:generate
POST /api/iterations/{id}/work-instructions
POST /api/learning-activations/{id}:rollback
POST /api/learning-candidates/{id}:approve
POST /api/learning-candidates/{id}:reject
POST /api/learning-sources
POST /api/learning-sources/{id}:extract
POST /api/learning-sources/{id}:revoke
POST /api/learning-sources/{id}:scan
POST /api/product-validations
POST /api/projects/{id}/brainstorming-decision-sets
POST /api/projects/{id}/data-egress-profile:revise
POST /api/projects/{id}/design-intent-reviews
POST /api/projects/{id}/design-specifications
POST /api/projects/{id}/intents
POST /api/projects/{id}/proposal-sets:generate
POST /api/projects/{id}/work-plans
POST /api/projects/{projectId}/tasks
POST /api/proposal-sets/{id}/decisions
POST /api/provider-routing:activate
POST /api/provider-routing:validate
POST /api/providers/{providerId}:configure
POST /api/providers/{providerId}:refresh-models
POST /api/providers/{providerId}:test
POST /api/release-decisions
POST /api/release-manifests
POST /api/release-manifests/{id}:verify
POST /api/runs/{id}/budget:revise
POST /api/runs/{id}/completion-reports
POST /api/runs/{id}/interventions
POST /api/runs/{id}/priorities
POST /api/runs/{id}:cancel
POST /api/runs/{id}:pause
POST /api/runs/{id}:reconcile
POST /api/runs/{id}:resume
POST /api/secrets/{id}:revoke
POST /api/secrets/{id}:rotate
POST /api/tasks/{taskId}/runs
POST /api/technical-test-runs
POST /api/work-instructions/{id}/invocation-prompt
POST /api/work-instructions/{id}:approve
POST /api/work-plans/{id}/iteration-plans
POST /api/work-plans/{id}:approve
POST /api/work-plans/{id}:reopen
""".strip().splitlines())

# C-01's immutable acceptance compares the schema that existed at the C-01
# boundary.  Later accepted packages may add routes without changing that
# historical contract; project those explicitly approved successor routes out
# before checking the C-01 semantic delta.
APPROVED_SUCCESSOR_OPENAPI_OPERATIONS = frozenset({
    "GET /api/delegations/{id}",
    "POST /api/delegations/{id}:cancel",
    "POST /api/delegations/{id}:resume",
    "POST /api/delegations/{id}:steer",
})


def _hash(char: str) -> str:
    return "sha256:" + char * 64


def _database_url() -> str:
    raw = os.environ.get("ANVIL_TEST_DATABASE_URL")
    issue = None
    if not raw:
        issue = "ANVIL_TEST_DATABASE_URL is not set"
    else:
        try:
            parsed = make_url(raw)
            if parsed.get_backend_name() != "postgresql" or not parsed.database:
                issue = "ANVIL_TEST_DATABASE_URL must identify PostgreSQL"
        except Exception:
            issue = "ANVIL_TEST_DATABASE_URL is invalid"
    if issue:
        if FINAL_MODE:
            pytest.fail(f"C01_L3_FINAL_DATABASE_REQUIRED: {issue}", pytrace=False)
        pytest.skip(f"local authoring only: {issue}")
    return raw


def _fastapi_module():
    try:
        return importlib.import_module("packages.api.fastapi_app")
    except ModuleNotFoundError as exc:
        pytest.fail(f"C01_L3_MISSING_FASTAPI_APP: {exc}", pytrace=False)


def _app(**overrides: object) -> FastAPI:
    module = _fastapi_module()
    factory = getattr(module, "create_app", None)
    assert callable(factory), "C01_L3_MISSING_FASTAPI_APP: create_app"
    app = factory(**overrides)
    assert isinstance(app, FastAPI)
    return app


def _normalized_operations(schema: dict) -> frozenset[str]:
    methods = {"get", "post", "put", "patch", "delete", "options", "head"}
    return frozenset(
        f"{method.upper()} {path}"
        for path, path_item in schema.get("paths", {}).items()
        for method in path_item if method.lower() in methods
    )


def _c01_historical_schema(current_schema: dict) -> dict:
    projection = deepcopy(current_schema)
    paths = projection.get("paths", {})
    for operation in APPROVED_SUCCESSOR_OPENAPI_OPERATIONS:
        method, path = operation.split(" ", 1)
        path_item = paths.get(path)
        assert isinstance(path_item, dict) and method.lower() in path_item, f"C01_L3_SUCCESSOR_ROUTE_MISSING: {operation}"
        path_item.pop(method.lower())
        if not path_item:
            paths.pop(path)
    return projection


def _parent_openapi_hash(current_schema: dict) -> str:
    parent_projection = deepcopy(current_schema)
    removed = parent_projection.get("paths", {}).pop(EXECUTE_PATH, None)
    assert isinstance(removed, dict) and set(removed) == {"post"}, "C01_L3_EXECUTE_PATH_MUST_BE_AN_ISOLATED_ADDITION"
    raw = json.dumps(parent_projection, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return sha256(raw).hexdigest()


def test_registry_and_openapi_have_only_the_approved_execute_semantic_diff() -> None:
    _assert_network_guard_contract()
    registry = importlib.import_module("packages.api.registry").canonical_api_registry()
    matches = [endpoint for endpoint in registry.endpoints if endpoint.key == EXECUTE_KEY]
    assert len(matches) == 1, f"C01_L3_MISSING_EXECUTE_ROUTE: registry {EXECUTE_KEY}"
    assert matches[0].permission == "run:execute", "C01_L3_MISSING_PERMISSION: run:execute"
    schema = _app().openapi()
    historical_schema = _c01_historical_schema(schema)
    assert _normalized_operations(historical_schema) == BASELINE_OPENAPI_OPERATIONS | {EXECUTE_KEY}, "C01_L3_UNAPPROVED_OPENAPI_PATH_DIFF"
    assert _parent_openapi_hash(historical_schema) == PARENT_OPENAPI_SHA256, "C01_L3_PARENT_OPENAPI_SCHEMA_DRIFT"
    operation = schema["paths"][EXECUTE_PATH]["post"]
    assert operation.get("x-anvil-permission") == "run:execute", "C01_L3_MISSING_PERMISSION: OpenAPI"
    request_schema = operation.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema")
    assert request_schema == EXECUTE_REQUEST_SCHEMA, "C01_L3_EXECUTE_REQUEST_SCHEMA_MISMATCH"
    assert set(operation.get("responses", {})) == {"200", "409"}, "C01_L3_UNAPPROVED_RESPONSE_SHAPE_DIFF"
    assert operation["responses"]["200"].get("content", {}).get("application/json", {}).get("schema") == EXECUTE_200_SCHEMA, "C01_L3_EXECUTE_200_SCHEMA_MISMATCH"
    assert operation["responses"]["409"].get("content", {}).get("application/json", {}).get("schema") == EXECUTE_409_SCHEMA, "C01_L3_EXECUTE_409_SCHEMA_MISMATCH"


class DeterministicProvider:
    def __init__(self, *, known_usage: bool = True) -> None:
        self.known_usage = known_usage
        self.calls: list[GatewayRequest] = []

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        capabilities = frozenset({"text_generation", "final_usage"})
        missing = tuple(f"missing capability: {item}" for item in sorted(set(required) - capabilities))
        return CapabilityProbe(not missing, capabilities, missing)

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self.calls.append(request)
        return GatewayResponse(
            request.request_id, request.provider, request.model, "deterministic-result",
            TokenUsage(10, 15) if self.known_usage else TokenUsage(0, 0),
            UsageProvenance.PROVIDER_FINAL if self.known_usage else UsageProvenance.UNKNOWN,
            "COMPLETED", None,
        )


@contextmanager
def _deny_network(database_url: str):
    """Allow only in-process loopback and this test's exact PostgreSQL endpoint."""
    parsed = make_url(database_url)
    database_host = (parsed.host or "").casefold()
    database_port = parsed.port or 5432
    database_endpoints = {(database_host, database_port)}
    for family, socket_type, protocol, canonical_name, address in socket.getaddrinfo(
        database_host, database_port, type=socket.SOCK_STREAM
    ):
        del family, socket_type, protocol, canonical_name
        database_endpoints.add((str(address[0]).split("%", 1)[0].casefold(), int(address[1])))

    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex

    def allowed(address: object) -> bool:
        if not isinstance(address, tuple) or len(address) < 2:
            return False
        host = str(address[0]).split("%", 1)[0].casefold()
        try:
            port = int(address[1])
        except (TypeError, ValueError):
            return False
        return (host, port) in database_endpoints

    def guarded_connect(self, address):  # noqa: ANN001
        if not allowed(address):
            raise AssertionError(f"C01_L3_EXTERNAL_NETWORK_CALL: {address!r}")
        return original_connect(self, address)

    def guarded_connect_ex(self, address):  # noqa: ANN001
        if not allowed(address):
            raise AssertionError(f"C01_L3_EXTERNAL_NETWORK_CALL: {address!r}")
        return original_connect_ex(self, address)

    socket.socket.connect = guarded_connect
    socket.socket.connect_ex = guarded_connect_ex
    try:
        yield
    finally:
        socket.socket.connect = original_connect
        socket.socket.connect_ex = original_connect_ex


def _assert_network_guard_contract() -> None:
    """Exercise allow/deny decisions without opening a real network connection."""
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex
    delegated: list[tuple[str, object]] = []

    def fake_connect(self, address):  # noqa: ANN001
        delegated.append(("connect", address))
        return None

    def fake_connect_ex(self, address):  # noqa: ANN001
        delegated.append(("connect_ex", address))
        return 0

    socket.socket.connect = fake_connect
    socket.socket.connect_ex = fake_connect_ex
    try:
        endpoint = ("127.0.0.1", 6543)
        with _deny_network("postgresql://tester:secret@127.0.0.1:6543/anvil_test"):
            connection = socket.socket()
            try:
                assert connection.connect(endpoint) is None
                assert connection.connect_ex(endpoint) == 0
                with pytest.raises(AssertionError, match="C01_L3_EXTERNAL_NETWORK_CALL"):
                    connection.connect(("127.0.0.1", 8080))
                with pytest.raises(AssertionError, match="C01_L3_EXTERNAL_NETWORK_CALL"):
                    connection.connect(("::1", 8081, 0, 0))
            finally:
                connection.close()
    finally:
        socket.socket.connect = original_connect
        socket.socket.connect_ex = original_connect_ex
    assert delegated == [("connect", endpoint), ("connect_ex", endpoint)]


@contextmanager
def _scratch_database():
    source = make_url(_database_url())
    name = f"anvil_c01_l3_{uuid4().hex}"
    admin = create_engine(source.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    dsn = source.set(database=name).render_as_string(hide_password=False)
    try:
        env = os.environ.copy()
        env.update(ANVIL_DATABASE_URL=dsn, PYTHONPATH=str(ROOT))
        result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=ROOT, env=env, capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
        yield dsn
    finally:
        with admin.connect() as connection:
            connection.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=:name AND pid<>pg_backend_pid()"), {"name": name})
            connection.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()


@dataclass(frozen=True)
class Authority:
    run_id: str
    step_id: str
    budget_id: str
    run_version: int


def _seed_authority(dsn: str, *, cost_limit: str = "10.00000000", token_limit: int = 1000) -> Authority:
    """Seed approved Task authority, create/replay Run canonically, then seed Step/Budget."""
    suffix = uuid4().hex
    ids = {key: f"{key}-{suffix}" for key in ("task", "spec", "baseline", "workplan", "iteration", "instruction", "plan")}
    now = datetime.now(timezone.utc)
    engine = create_engine(dsn, pool_pre_ping=True)
    with engine.begin() as c:
        c.execute(text("INSERT INTO design_artifacts (artifact_id,revision,content_hash,actor_type,actor_id,artifact_type,source_refs) VALUES (:id,1,:hash,'AGENT','eoul','DESIGN_SPECIFICATION',CAST('[]' AS json))"), {"id": ids["spec"], "hash": _hash("9")})
        c.execute(text("INSERT INTO design_baselines (artifact_id,revision,content_hash,actor_type,actor_id,specification_id,root_human_approval_id,approval_mode,scope,project_id) VALUES (:id,1,:hash,'HUMAN','owner',:spec,:approval,'HUMAN_APPROVED',CAST('{}' AS json),'project-1')"), {"id": ids["baseline"], "hash": _hash("a"), "spec": ids["spec"], "approval": f"approval-DESIGN_SPECIFICATION-{suffix}"})
        c.execute(text("INSERT INTO work_plans (artifact_id,revision,content_hash,design_baseline_id,design_baseline_hash,scope) VALUES (:id,1,:hash,:baseline,:baseline_hash,CAST('{}' AS json))"), {"id": ids["workplan"], "hash": _hash("b"), "baseline": ids["baseline"], "baseline_hash": _hash("a")})
        c.execute(text("INSERT INTO iteration_plans (artifact_id,revision,content_hash,work_plan_id,work_plan_hash,sequence) VALUES (:id,1,:hash,:workplan,:workplan_hash,1)"), {"id": ids["iteration"], "hash": _hash("c"), "workplan": ids["workplan"], "workplan_hash": _hash("b")})
        c.execute(text("INSERT INTO work_instructions (artifact_id,revision,content_hash,iteration_plan_id,iteration_plan_hash,allowed_paths,allowed_actions,completion_conditions) VALUES (:id,1,:hash,:iteration,:iteration_hash,CAST('[]' AS json),CAST('[]' AS json),CAST('[]' AS json))"), {"id": ids["instruction"], "hash": _hash("d"), "iteration": ids["iteration"], "iteration_hash": _hash("c")})
        c.execute(text("INSERT INTO execution_plans (plan_id,plan_hash,source_work_instruction_id,source_work_instruction_hash,baseline_analysis_hash,impact_analysis_hash,status) VALUES (:id,:hash,:instruction,:instruction_hash,:baseline_hash,:impact_hash,'APPROVED')"), {"id": ids["plan"], "hash": _hash("e"), "instruction": ids["instruction"], "instruction_hash": _hash("d"), "baseline_hash": _hash("f"), "impact_hash": _hash("1")})
        for kind, subject, subject_hash in (("DESIGN_SPECIFICATION", ids["spec"], _hash("9")), ("WORK_PLAN", ids["workplan"], _hash("b")), ("WORK_INSTRUCTION", ids["instruction"], _hash("d")), ("EXECUTION_PLAN", ids["plan"], _hash("e"))):
            c.execute(text("INSERT INTO approval_records (approval_id,approval_type,subject_id,subject_hash,approved_by,authenticated_human,approved_at,expires_at,status) VALUES (:id,:kind,:subject,:hash,'owner',true,:now,:expires,'ACTIVE')"), {"id": f"approval-{kind}-{suffix}", "kind": kind, "subject": subject, "hash": subject_hash, "now": now, "expires": now + timedelta(hours=1)})
        c.execute(text("INSERT INTO tasks (task_id,project_id,repository_id,title,objective,requested_by,status,version) VALUES (:id,'project-1','repo-1','C01','C01','owner','CONFIRMED',3)"), {"id": ids["task"]})
    repository = SqlAlchemyRunCreationRepository(sessionmaker(bind=engine, expire_on_commit=False))
    command = RunCreationCommand(None, ids["task"], ids["instruction"], ids["plan"], 3, "project-1", "env-1", _hash("8"), None, None, "owner-1", f"correlation-{suffix}", f"create-{suffix}", _hash("e"), "C-01 L3")
    first, replay = repository.create(command), repository.create(command)
    assert replay.duplicate and replay.run_id == first.run_id, "C01_L3_AUTHORITY_SEED_NOT_IDEMPOTENT"
    step_id, budget_id = f"step-{suffix}", f"budget-{suffix}"
    with engine.begin() as c:
        c.execute(text("INSERT INTO plan_steps (step_id,run_id,step_lineage_id,sequence) VALUES (:step,:run,:lineage,1)"), {"step": step_id, "run": first.run_id, "lineage": f"lineage-{suffix}"})
        c.execute(text("INSERT INTO budget_ledgers (budget_id,run_id,hard_cost_limit,hard_token_limit,max_concurrent_requests,new_action_allowed) VALUES (:budget,:run,:cost,:tokens,1,true)"), {"budget": budget_id, "run": first.run_id, "cost": cost_limit, "tokens": token_limit})
        version = c.execute(text("SELECT version FROM runs WHERE run_id=:run"), {"run": first.run_id}).scalar_one()
    engine.dispose()
    return Authority(first.run_id, step_id, budget_id, int(version))


def _request(authority: Authority, key: str, *, backend: str = "LOCAL"):
    body = {"requestId": f"request-{key}", "reservationId": f"reservation-{key}", "budgetId": authority.budget_id, "backend": backend, "provider": "LOCAL", "model": "deterministic-test-model", "pricingVersion": "test-v1", "forecastCost": "1.00000000", "forecastTokens": 100, "prompt": PROMPT_SENTINEL, "expectedStateVersion": authority.run_version, "reason": "C-01 independent L3"}
    headers = {"host": "anvil.local", "origin": "https://anvil.local", "x-csrf-token": "csrf-1", "idempotency-key": key, "if-match": f'"{authority.run_version}"', "x-target-hash": _hash("7"), "x-permission-scope": "run:execute", "x-reason": "C-01 independent L3", "x-credential-reference": CREDENTIAL_SENTINEL}
    return f"/api/runs/{authority.run_id}/steps/{authority.step_id}:execute", body, headers


def _client(dsn: str, provider: DeterministicProvider) -> TestClient:
    common, api = importlib.import_module("packages.api.common"), _fastapi_module()
    principal = common.SessionPrincipal("owner-1", "owner", "csrf-1", frozenset({"run:execute"}), frozenset({"project-1"}), frozenset({"env-1"}))
    engine = create_engine(dsn, pool_pre_ping=True)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    module = importlib.import_module("packages.api.step_execution")
    constructor = getattr(module, "SqlAlchemyStepExecutionPort", None) or getattr(module, "create_step_execution_port", None)
    assert callable(constructor), "C01_L3_MISSING_STEP_EXECUTION_PORT"
    adapters = {backend: NativeAgentAdapter(provider) for backend in ("CLAUDE", "CODEX", "LOCAL")}
    step_port = constructor(sessions, adapters)
    assert callable(step_port), "C01_L3_STEP_EXECUTION_PORT_NOT_CALLABLE"
    ports = api.ApiPorts(commands={EXECUTE_KEY: step_port})
    app = _app(ports=ports, authenticate=lambda token: principal if token == "session-1" else None, authorization_resolver=lambda _endpoint, _path: api.AuthorizationScope("project-1", "env-1", frozenset({"owner"})))
    app.state.c01_l3_engine = engine
    client = TestClient(app)
    client.cookies.set("anvil_session", "session-1")
    return client


def _events(dsn: str, run_id: str) -> list[dict]:
    engine = create_engine(dsn)
    try:
        with engine.connect() as c:
            return [dict(row) for row in c.execute(text("SELECT event_id,event_type,sequence_no,created_at,actor_type,actor_id,correlation_id,causation_event_id,idempotency_key,payload FROM run_events WHERE run_id=:run ORDER BY sequence_no"), {"run": run_id}).mappings()]
    finally:
        engine.dispose()


def _assert_receipts_match(payload: dict, persisted: list[dict]) -> None:
    receipts = payload.get("eventReceipts")
    assert isinstance(receipts, list) and receipts, "C01_L3_EMPTY_OR_SYNTHETIC_EVENT_RECEIPTS"
    assert len(receipts) == len(persisted), "C01_L3_EVENT_RECEIPT_COUNT_MISMATCH"
    assert [receipt.get("sequence") for receipt in receipts] == [row["sequence_no"] for row in persisted], "C01_L3_EVENT_RECEIPT_ORDER_MISMATCH"
    for receipt, row in zip(receipts, persisted, strict=True):
        assert set(receipt) == {"eventId", "type", "sequence", "timestamp", "actor", "correlationId", "causationId", "idempotencyKey"}
        assert receipt["eventId"] == row["event_id"]
        assert receipt["type"] == row["event_type"]
        assert receipt["sequence"] == row["sequence_no"]
        timestamp = datetime.fromisoformat(receipt["timestamp"].replace("Z", "+00:00"))
        assert timestamp == row["created_at"]
        assert receipt["actor"] == {"type": row["actor_type"], "id": row["actor_id"]}
        assert receipt["correlationId"] == row["correlation_id"]
        assert receipt["causationId"] == row["causation_event_id"]
        assert receipt["idempotencyKey"] == row["idempotency_key"]


@pytest.mark.parametrize("backend", ["CLAUDE", "CODEX", "LOCAL"])
def test_authorized_boundary_correlates_backend_usage_and_persisted_receipts(backend: str) -> None:
    with _scratch_database() as dsn:
        authority, provider, key = _seed_authority(dsn), DeterministicProvider(), f"idem-{uuid4().hex}"
        path, body, headers = _request(authority, key, backend=backend)
        before = _events(dsn, authority.run_id)
        with _client(dsn, provider) as client, _deny_network(dsn):
            response = client.post(path, json=body, headers=headers)
        assert response.status_code == 200, response.text
        payload = response.json()
        assert (payload["runId"], payload["stepId"], payload["requestId"], payload["reservationId"], payload["backend"]) == (authority.run_id, authority.step_id, body["requestId"], body["reservationId"], backend)
        assert payload["finalUsage"]["totalTokens"] == 25 and payload["provenance"] == "PROVIDER_FINAL" and payload["eventReceipts"]
        rows = _events(dsn, authority.run_id)
        assert [row["sequence_no"] for row in rows] == list(range(1, len(rows) + 1))
        _assert_receipts_match(payload, rows[len(before):])


def test_budget_denial_precedes_adapter_and_has_no_false_success_event() -> None:
    with _scratch_database() as dsn:
        authority, provider = _seed_authority(dsn, cost_limit="0.10000000", token_limit=10), DeterministicProvider()
        path, body, headers = _request(authority, f"idem-{uuid4().hex}")
        before = _events(dsn, authority.run_id)
        with _client(dsn, provider) as client, _deny_network(dsn):
            response = client.post(path, json=body, headers=headers)
        assert response.status_code == 409 and provider.calls == []
        rows = _events(dsn, authority.run_id)
        assert all("SUCCESS" not in row["event_type"] for row in rows)
        _assert_receipts_match(response.json(), rows[len(before):])


def test_unknown_usage_is_409_with_active_reservation_and_structured_event() -> None:
    with _scratch_database() as dsn:
        authority, provider = _seed_authority(dsn), DeterministicProvider(known_usage=False)
        path, body, headers = _request(authority, f"idem-{uuid4().hex}")
        before = _events(dsn, authority.run_id)
        with _client(dsn, provider) as client, _deny_network(dsn):
            response = client.post(path, json=body, headers=headers)
        assert response.status_code == 409 and response.json()["code"] == "USAGE_RECONCILIATION_REQUIRED"
        engine = create_engine(dsn)
        with engine.connect() as c:
            reservation = c.execute(text("SELECT status,reserved_cost,reserved_tokens FROM budget_reservations WHERE reservation_id=:id"), {"id": body["reservationId"]}).mappings().one()
        engine.dispose()
        assert reservation["status"] == "RECONCILIATION_REQUIRED" and reservation["reserved_cost"] > 0 and reservation["reserved_tokens"] > 0
        event = [row for row in _events(dsn, authority.run_id) if row["event_type"] == "USAGE_RECONCILIATION_REQUIRED"]
        assert len(event) == 1 and all(event[0].get(field) is not None for field in ("event_id", "sequence_no", "created_at", "actor_type", "actor_id", "correlation_id", "causation_event_id", "idempotency_key"))
        _assert_receipts_match(response.json(), _events(dsn, authority.run_id)[len(before):])


def test_authoritative_usage_reconciles_after_reservation() -> None:
    with _scratch_database() as dsn:
        authority, provider = _seed_authority(dsn), DeterministicProvider()
        path, body, headers = _request(authority, f"idem-{uuid4().hex}")
        before = _events(dsn, authority.run_id)
        with _client(dsn, provider) as client, _deny_network(dsn):
            response = client.post(path, json=body, headers=headers)
        assert response.status_code == 200
        _assert_receipts_match(response.json(), _events(dsn, authority.run_id)[len(before):])
        engine = create_engine(dsn)
        with engine.connect() as c:
            row = c.execute(text("SELECT r.status,r.reserved_tokens,r.consumed_tokens,r.released_tokens,u.is_authoritative_final,u.provenance FROM budget_reservations r JOIN budget_usage_receipts u USING (reservation_id) WHERE r.reservation_id=:id"), {"id": body["reservationId"]}).mappings().one()
        engine.dispose()
        assert row["status"] == "CONSUMED" and row["is_authoritative_final"] is True
        assert row["consumed_tokens"] == 25 and row["released_tokens"] == row["reserved_tokens"] - 25 and row["provenance"] == "PROVIDER_FINAL"


def test_payloads_exclude_prompt_and_credential_values() -> None:
    with _scratch_database() as dsn:
        authority, provider = _seed_authority(dsn), DeterministicProvider()
        path, body, headers = _request(authority, f"idem-{uuid4().hex}")
        before = _events(dsn, authority.run_id)
        with _client(dsn, provider) as client, _deny_network(dsn):
            response = client.post(path, json=body, headers=headers)
        rows = _events(dsn, authority.run_id)
        _assert_receipts_match(response.json(), rows[len(before):])
        serialized = response.text + json.dumps(rows, default=str, sort_keys=True)
        assert PROMPT_SENTINEL not in serialized and CREDENTIAL_SENTINEL not in serialized


def test_idempotent_replay_reuses_receipts_and_conflicting_payload_is_rejected() -> None:
    with _scratch_database() as dsn:
        authority, provider = _seed_authority(dsn), DeterministicProvider()
        path, body, headers = _request(authority, f"idem-{uuid4().hex}")
        initial = _events(dsn, authority.run_id)
        with _client(dsn, provider) as client, _deny_network(dsn):
            first = client.post(path, json=body, headers=headers)
            before = _events(dsn, authority.run_id)
            replay = client.post(path, json=body, headers=headers)
            conflict = client.post(path, json={**body, "prompt": "different canonical payload"}, headers=headers)
        assert first.status_code == replay.status_code == 200 and replay.json()["eventReceipts"] == first.json()["eventReceipts"]
        persisted = before[len(initial):]
        _assert_receipts_match(first.json(), persisted)
        _assert_receipts_match(replay.json(), persisted)
        assert len(provider.calls) == 1 and _events(dsn, authority.run_id) == before
        assert conflict.status_code == 409 and _events(dsn, authority.run_id) == before
        _assert_receipts_match(conflict.json(), persisted)
