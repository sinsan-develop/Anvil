"""R10 Dashboard read route: explicit permission, scoped owner and safe failure."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.operations import OperationsPort
from packages.api.registry import canonical_api_registry
from packages.observability.projection import OperationsSources
from packages.observability.service import OperationsService
from packages.queue.models import QueueJob
from packages.queue.service import DurableQueue
from tests.observability.test_f13_operations import HASH, RecordingRepository
from tests.observability.test_f20_u01_r9_queue_host import QueueSource


PATH = "/api/dashboard/operations"
NOW = datetime(2026, 9, 30, tzinfo=timezone.utc)


def canonical_alert():
    return {"alert_id": "alert-1", "level": "critical", "source": "orchestrator",
        "category": "backlog", "code": "QUEUE_JOB_QUARANTINED",
        "related_entity_id": "job-1",
        "dedupe_key": "f13-r2:project-1:env-1:QUEUE_JOB_QUARANTINED:job-1",
        "detector_rule_revision": "f13-r2", "cause": "Queue job reached quarantine",
        "impact": "Run cannot advance automatically", "next_action": "REVIEW_QUARANTINE",
        "deep_link": "/operations/queue", "evidence_hash": HASH, "status": "open",
        "owner_id": None, "observed_at": NOW.isoformat(), "project_id": "project-1",
        "environment_id": "env-1"}


def persist_alert(repository, alert):
    repository.append("project-1", "env-1", 0, {"action": "DETECTED",
        "alert_id": alert["alert_id"], "alert": alert})


def owner(*, source_loader=None, repository=None):
    return OperationsService("project-1", "env-1", OperationsSources(),
        repository=repository or RecordingRepository(), clock=lambda: NOW,
        source_loader=source_loader)


def client(*, operations_owner=None, permissions=frozenset({"dashboard:read"}),
           scope=("project-1", "env-1"), principal_scope=("project-1", "env-1")):
    principal = SessionPrincipal("operator", "operator", "csrf", permissions,
        frozenset({principal_scope[0]}), frozenset({principal_scope[1]}))
    app = create_app(
        ports=ApiPorts(queries=OperationsPort(operations_owner).query_ports()
                       if operations_owner is not None else {}),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _params:
            AuthorizationScope(*scope, frozenset({"operator"})))
    result = TestClient(app, base_url="https://anvil.local")
    result.cookies.set("anvil_session", "session")
    return result


def test_dashboard_registry_requires_its_own_permission():
    endpoint = canonical_api_registry().by_key("GET " + PATH)
    assert (endpoint.method, endpoint.path, endpoint.permission) == (
        "GET", PATH, "dashboard:read")


def test_dashboard_read_is_scoped_snapshot_with_unknown_gaps_and_no_mutation():
    repository = RecordingRepository()
    dashboard = owner(repository=repository)
    response = client(operations_owner=dashboard).get(PATH)
    assert response.status_code == 200
    data = response.json()["data"]
    assert set(data) == {"observed_at", "health", "queue", "quarantine", "worker",
        "budget", "reservations", "providers", "deployments", "source_gaps",
        "alerts", "next_actions"}
    assert data["queue"] == [] and data["health"]["queue"]["state"] == "UNKNOWN"
    assert "queue" in data["source_gaps"]
    assert repository.load("project-1", "env-1") == ()
    assert client().get(PATH).status_code == 501


def test_dashboard_denies_existing_alert_audit_permissions_and_foreign_scope():
    dashboard = owner()
    old = client(operations_owner=dashboard,
                 permissions=frozenset({"operations:alerts:read", "operations:audit:read"}))
    denied = old.get(PATH)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"
    for scope, principal_scope in [(("other", "env-1"), ("project-1", "env-1")),
                                   (("project-1", "other"), ("project-1", "env-1")),
                                   (("project-1", "env-1"), ("other", "env-1"))]:
        assert client(operations_owner=dashboard, scope=scope,
            principal_scope=principal_scope).get(PATH).status_code == 403


def test_dashboard_source_failure_is_stable_503_without_secret():
    for failure in (ValueError("QUEUE_SOURCE_LIMIT_EXCEEDED"),
                    ValueError("QUEUE_SOURCE_LEGACY_UNSCOPED"),
                    RuntimeError("postgresql://secret:credential@host/payload")):
        def broken(_project, _environment):
            raise failure
        response = client(operations_owner=owner(source_loader=broken)).get(PATH)
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "DASHBOARD_SOURCE_UNAVAILABLE"
        assert "secret" not in response.text and "credential" not in response.text


def test_dashboard_reloads_scoped_queue_on_each_get_and_rejects_legacy_rows():
    seen = []

    def loader(project_id, environment_id):
        seen.append((project_id, environment_id))
        job_id = f"job-{len(seen)}"
        return OperationsSources(queue=QueueSource(job_id, legacy=len(seen) == 3),
                                 queue_job_ids=(job_id,))

    repository = RecordingRepository()
    session = client(operations_owner=owner(source_loader=loader, repository=repository))
    first = session.get(PATH)
    second = session.get(PATH)
    assert first.status_code == second.status_code == 200
    assert first.json()["data"]["queue"][0]["job_id"] == "job-1"
    assert second.json()["data"]["queue"][0]["job_id"] == "job-2"
    assert session.get(PATH).status_code == 503
    assert seen == [("project-1", "env-1")] * 3
    assert repository.load("project-1", "env-1") == ()


def test_dashboard_omits_unknown_fields_from_persisted_alerts_on_success():
    repository = RecordingRepository()
    persist_alert(repository, {**canonical_alert(),
        "credential": "sentinel-private-credential",
        "payload": {"token": "sentinel-private-payload"}})
    response = client(operations_owner=owner(repository=repository)).get(PATH)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["alerts"][0]["alert_id"] == "alert-1"
    assert data["next_actions"][0]["action"] == "REVIEW_QUARANTINE"
    assert "credential" not in data["alerts"][0]
    assert "payload" not in data["alerts"][0]
    assert "sentinel-private" not in response.text


def test_dashboard_rejects_101_jobs_from_real_queue_owner():
    queue = DurableQueue(token_factory=lambda: "private-queue-fence")
    job_ids = tuple(f"job-{index:03}" for index in range(101))
    for job_id in job_ids:
        queue.enqueue(QueueJob(job_id, "run-1", "private-payload", NOW, 1))

    def loader(project_id, environment_id):
        assert (project_id, environment_id) == ("project-1", "env-1")
        return OperationsSources(queue=queue, queue_job_ids=job_ids)

    response = client(operations_owner=owner(source_loader=loader)).get(PATH)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DASHBOARD_SOURCE_UNAVAILABLE"
    assert "private-payload" not in response.text


def test_dashboard_rejects_nested_unknown_data_in_alert_text_field():
    repository = RecordingRepository()
    persist_alert(repository, {**canonical_alert(),
        "cause": {"credential": "sentinel-private-credential"}})
    response = client(operations_owner=owner(repository=repository)).get(PATH)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DASHBOARD_SOURCE_UNAVAILABLE"
    assert "sentinel-private" not in response.text


def test_dashboard_rejects_noncanonical_secret_string_in_allowlisted_cause():
    repository = RecordingRepository()
    persist_alert(repository, {**canonical_alert(),
        "cause": "postgresql://secret:credential@host/db"})
    response = client(operations_owner=owner(repository=repository)).get(PATH)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DASHBOARD_SOURCE_UNAVAILABLE"
    assert "secret:credential" not in response.text


def test_dashboard_preserves_canonical_acknowledged_and_resolved_alerts():
    repository = RecordingRepository()
    persist_alert(repository, canonical_alert())
    session = client(operations_owner=owner(repository=repository))
    acknowledged = {"action": "ACKNOWLEDGED", "alert_id": "alert-1",
        "actor_id": "operator-1", "at": NOW.isoformat(),
        "approval_id": "approval-1", "evidence_hash": HASH}
    repository.append("project-1", "env-1", 1, acknowledged)
    response = session.get(PATH)
    assert response.status_code == 200
    assert response.json()["data"]["alerts"][0]["status"] == "acknowledged"
    assert response.json()["data"]["alerts"][0]["owner_id"] == "operator-1"
    assert len(response.json()["data"]["next_actions"]) == 1
    repository.append("project-1", "env-1", 2, {**acknowledged, "action": "RESOLVED"})
    response = session.get(PATH)
    assert response.status_code == 200
    assert response.json()["data"]["alerts"][0]["status"] == "resolved"
    assert response.json()["data"]["next_actions"] == []
