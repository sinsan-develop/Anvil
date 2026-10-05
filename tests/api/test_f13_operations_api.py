"""F-13 canonical read routes, authorization and host binding."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.registry import canonical_api_registry
from packages.api.runtime import create_runtime_app
from tests.api.test_runtime_app import _env, _FakeSession
from tests.observability.test_f13_operations import RecordingRepository


NOW = datetime(2026, 9, 24, tzinfo=timezone.utc)


def _owner():
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    return OperationsService("project-1", "env-1", OperationsSources(),
                             repository=RecordingRepository(), clock=lambda: NOW)


def _client(*, owner=None, scope=("project-1", "env-1"), permissions=None, runtime=False):
    from packages.api.operations import OperationsPort
    principal = SessionPrincipal("operator", "operator", "csrf", frozenset(permissions or {
        "operations:alerts:read", "operations:audit:read"}),
        frozenset({"project-1"}), frozenset({"env-1"}))
    auth = lambda token: principal if token == "session" else None
    resolve = lambda _endpoint, _params: AuthorizationScope(*scope, frozenset({"operator"}))
    if runtime:
        app = create_runtime_app(environment=_env(), session_factory=lambda: _FakeSession(),
                                 authenticate=auth, authorization_resolver=resolve, operations_owner=owner)
    else:
        app = create_app(ports=ApiPorts(queries=OperationsPort(owner).query_ports() if owner else {}),
                         authenticate=auth, authorization_resolver=resolve)
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")
    return client


def test_canonical_operations_routes_keep_reads_and_add_scoped_ack_command():
    routes = [e for e in canonical_api_registry().endpoints if e.path.startswith("/api/operations/")]
    assert [(e.method, e.path, e.permission) for e in routes] == [
        ("GET", "/api/operations/alerts", "operations:alerts:read"),
        ("POST", "/api/operations/alerts/{alertId}:acknowledge", "operations:alerts:acknowledge"),
        ("GET", "/api/operations/audit", "operations:audit:read")]


def test_unbound_route_fails_501_and_bound_reads_have_same_origin_paths():
    assert _client().get("/api/operations/alerts").status_code == 501
    client = _client(owner=_owner())
    alert = client.get("/api/operations/alerts")
    audit = client.get("/api/operations/audit")
    assert alert.status_code == audit.status_code == 200
    assert alert.json()["data"] == {"alerts": [], "next_before_sequence": None}
    assert audit.json()["data"] == {"events": [], "next_before_sequence": None}
    assert "http://" not in alert.text and "127.0.0.1" not in alert.text


def test_foreign_project_environment_and_wrong_role_are_denied():
    owner = _owner()
    assert _client(owner=owner, scope=("foreign", "env-1")).get("/api/operations/alerts").status_code == 403
    assert _client(owner=owner, scope=("project-1", "foreign")).get("/api/operations/audit").status_code == 403
    assert _client(owner=owner, permissions={"operations:alerts:read"}).get("/api/operations/audit").status_code == 403


def test_runtime_binds_only_explicit_owner_and_no_owner_is_501():
    assert _client(runtime=True).get("/api/operations/alerts").status_code == 501
    assert _client(runtime=True, owner=_owner()).get("/api/operations/alerts").status_code == 200


def test_critical_ack_requires_exact_permission_and_returns_audited_sequence():
    from datetime import timedelta
    from packages.observability.service import OperationsService
    from tests.observability.test_f13_operations import RecordingRepository, sources
    owner = OperationsService("project-1", "env-1", sources(), repository=RecordingRepository(),
                              clock=lambda: NOW + timedelta(minutes=6))
    owner.detect()
    alert = next(row for row in owner.alerts() if row["level"] == "critical")
    path = f'/api/operations/alerts/{alert["alert_id"]}:acknowledge'
    headers = {"origin": "https://anvil.local", "x-csrf-token": "csrf",
        "idempotency-key": "ack-first", "if-match": str(alert["sequence"]),
        "x-target-hash": alert["evidence_hash"],
        "x-permission-scope": "operations:alerts:acknowledge", "x-reason": "reviewed"}
    denied = _client(owner=owner, runtime=True, permissions={"dashboard:read"})
    assert denied.post(path, headers=headers, json={}).status_code == 403
    client = _client(owner=owner, runtime=True, permissions={
        "operations:alerts:acknowledge", "operations:audit:read"})
    accepted = client.post(path, headers=headers, json={})
    assert accepted.status_code == 200
    result = accepted.json()["data"]
    assert result["alert_id"] == alert["alert_id"]
    assert result["ack_sequence"] == len(owner.audit())
    assert result["receipt"].startswith("ack:")
    audit = client.get("/api/operations/audit").json()["data"]["events"][-1]
    assert (audit["sequence"], audit["approval_id"], audit["evidence_hash"]) == (
        result["ack_sequence"], result["receipt"], alert["evidence_hash"])
    assert client.post(path, headers=headers, json={}).status_code == 409


def test_critical_ack_denies_foreign_scope_before_lookup_and_rejects_precondition_and_origin():
    from datetime import timedelta
    from packages.observability.service import OperationsService
    from tests.observability.test_f13_operations import RecordingRepository, sources
    owner = OperationsService("project-1", "env-1", sources(), repository=RecordingRepository(),
                              clock=lambda: NOW + timedelta(minutes=6))
    owner.detect()
    alert = next(row for row in owner.alerts() if row["level"] == "critical")
    path = f'/api/operations/alerts/{alert["alert_id"]}:acknowledge'
    headers = {"origin": "https://anvil.local", "x-csrf-token": "csrf",
        "idempotency-key": "ack-first", "if-match": str(alert["sequence"]),
        "x-target-hash": alert["evidence_hash"],
        "x-permission-scope": "operations:alerts:acknowledge", "x-reason": "reviewed"}
    permissions = {"operations:alerts:acknowledge"}
    foreign = _client(owner=owner, runtime=True, scope=("other", "env-1"), permissions=permissions)
    assert foreign.post(path, headers=headers, json={}).status_code == 403
    client = _client(owner=owner, runtime=True, permissions=permissions)
    assert client.post('/api/operations/alerts/missing:acknowledge', headers=headers,
                       json={}).status_code == 404
    assert client.post(path, headers={**headers, "if-match": "999"}, json={}).status_code == 409
    assert client.post(path, headers={**headers, "x-target-hash": "sha256:" + "b" * 64},
                       json={}).status_code == 409
    assert client.post(path, headers={**headers, "origin": "https://other.invalid"},
                       json={}).status_code == 403
    assert client.post(path, headers={**headers, "x-csrf-token": "wrong"},
                       json={}).status_code == 403
    assert client.post(path, headers=headers, json={"actor_id": "forged"}).status_code == 400
    assert not any(row["action"] == "ACKNOWLEDGED" for row in owner.audit())


def test_raw_fencing_token_and_secret_never_appear_in_api_response():
    from packages.leases.service import LeaseService
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    from datetime import timedelta
    leases = LeaseService(token_factory=lambda: "sentinel-secret-fencing-token")
    worker = leases.issue_worker("run-1", "worker-1", NOW, timedelta(minutes=5))
    leases.issue_write(worker, "src/file.py", NOW, timedelta(minutes=5))
    owner = OperationsService("project-1", "env-1", OperationsSources(leases=leases,
        lease_run_ids=("run-1",)), repository=RecordingRepository(), clock=lambda: NOW)
    response = _client(owner=owner).get("/api/operations/alerts")
    assert response.status_code == 200
    assert "sentinel-secret" not in response.text
    assert response.json()["data"] == {"alerts": [], "next_before_sequence": None}


def test_alerts_get_is_pure_read_and_never_returns_worker_budget_or_health_snapshot():
    from datetime import timedelta
    from packages.leases.service import LeaseService
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    leases = LeaseService(token_factory=lambda: "private-fence")
    leases.issue_worker("run-1", "worker-1", NOW - timedelta(minutes=10), timedelta(minutes=1))
    repository = RecordingRepository()
    owner = OperationsService("project-1", "env-1", OperationsSources(leases=leases,
        lease_run_ids=("run-1",)), repository=repository, clock=lambda: NOW)
    client = _client(owner=owner, permissions={"operations:alerts:read"})
    before = repository.load("project-1", "env-1")
    empty = client.get("/api/operations/alerts")
    assert empty.status_code == 200 and empty.json()["data"] == {"alerts": [], "next_before_sequence": None}
    assert repository.load("project-1", "env-1") == before
    owner.detect()  # Host calls detector independently of the GET route.
    event_count = len(repository.load("project-1", "env-1"))
    response = client.get("/api/operations/alerts")
    assert response.status_code == 200 and response.json()["data"]["alerts"][0]["code"] == "WORKER_LEASE_EXPIRED"
    assert all(k not in response.json()["data"]["alerts"][0] for k in ("worker", "budget", "health", "queue"))
    assert len(repository.load("project-1", "env-1")) == event_count


def test_audit_query_is_bounded_and_pages_older_events_by_sequence_header():
    from tests.observability.test_f13_operations import HASH
    repository = RecordingRepository()
    for index in range(112):
        repository.append("project-1", "env-1", index, {"action": "CHECK", "alert_id": f"alert-{index}",
            "actor_id": "system:detector", "at": NOW.isoformat(), "approval_id": None,
            "evidence_hash": HASH})
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    owner = OperationsService("project-1", "env-1", OperationsSources(),
        repository=repository, clock=lambda: NOW)
    client = _client(owner=owner, permissions={"operations:audit:read"})
    page = client.get("/api/operations/audit")
    assert page.status_code == 200
    assert len(page.json()["data"]["events"]) == 100
    assert page.json()["data"]["next_before_sequence"] == 13
    older = client.get("/api/operations/audit", headers={"x-audit-before-sequence": "13"})
    assert older.status_code == 200
    assert [e["sequence"] for e in older.json()["data"]["events"]] == list(range(1, 13))
    assert older.json()["data"]["next_before_sequence"] is None
    assert client.get("/api/operations/audit", headers={"x-audit-before-sequence": "-1"}).status_code == 400


def test_alert_pages_reach_all_101_unresolved_critical_alerts_without_mutating_owner():
    from datetime import timedelta
    from packages.leases.service import LeaseService
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    leases = LeaseService(token_factory=lambda: "private-fencing-token")
    run_ids = tuple(f"run-{index:03}" for index in range(101))
    for run_id in run_ids:
        leases.issue_worker(run_id, "worker", NOW - timedelta(minutes=10), timedelta(minutes=1))
    repository = RecordingRepository()
    owner = OperationsService("project-1", "env-1",
        OperationsSources(leases=leases, lease_run_ids=run_ids),
        repository=repository, clock=lambda: NOW)
    assert owner.detect() == 101
    client = _client(owner=owner, permissions={"operations:alerts:read"})
    before = repository.load("project-1", "env-1")
    first = client.get("/api/operations/alerts")
    assert first.status_code == 200
    page1 = first.json()["data"]
    assert len(page1["alerts"]) == 100
    assert page1["next_before_sequence"] == 2
    second = client.get("/api/operations/alerts",
        headers={"x-alert-before-sequence": str(page1["next_before_sequence"])})
    assert second.status_code == 200
    page2 = second.json()["data"]
    assert len(page2["alerts"]) == 1 and page2["next_before_sequence"] is None
    rows = page1["alerts"] + page2["alerts"]
    assert len({row["alert_id"] for row in rows}) == 101
    assert all(row["status"] == "open" and row["level"] == "critical" for row in rows)
    assert "private-fencing-token" not in first.text + second.text
    assert repository.load("project-1", "env-1") == before
    assert client.get("/api/operations/alerts", headers={"x-alert-before-sequence": "0"}).status_code == 400
