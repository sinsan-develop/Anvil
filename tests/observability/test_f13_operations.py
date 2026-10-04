"""F-13 owner-backed Operations projections and alert lifecycle."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from threading import RLock

import pytest

from packages.budget.models import BudgetLimit, BudgetRequest, ProviderOutcome
from packages.budget.service import BudgetService
from packages.leases.service import LeaseService
from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository
from packages.queue.models import QueueJob, QueueStatus
from packages.queue.service import DurableQueue


NOW = datetime(2026, 9, 24, 0, 0, tzinfo=timezone.utc)
HASH = "sha256:" + "a" * 64


class RecordingRepository:
    """Test owner with atomic append and read across service instances."""

    def __init__(self):
        self._events = {}
        self._lock = RLock()

    def load(self, project_id, environment_id):
        with self._lock:
            return tuple(self._events.get((project_id, environment_id), ()))

    def append(self, project_id, environment_id, expected_sequence, event):
        with self._lock:
            key = (project_id, environment_id)
            current = self._events.get(key, ())
            if len(current) != expected_sequence:
                raise ValueError("AUDIT_SEQUENCE_CONFLICT")
            self._events[key] = current + (dict(event),)


def sources():
    from packages.observability.projection import OperationsSources
    queue = DurableQueue(token_factory=lambda: "sentinel-queue-token")
    queue.enqueue(QueueJob("job-0", "run-1", "payload", NOW, 1, status=QueueStatus.SUCCEEDED))
    queue.enqueue(QueueJob("job-1", "run-1", "payload", NOW, 2, dependency_ids=("job-0",)))
    leases = LeaseService(token_factory=lambda: "sentinel-lease-token")
    worker = leases.issue_worker("run-1", "worker-1", NOW, timedelta(minutes=5))
    leases.issue_write(worker, "src/critical.py", NOW, timedelta(minutes=5))
    budget = BudgetService(InMemoryInterventionBudgetRepository())
    budget.create_budget(BudgetLimit("budget-1", Decimal("10"), 1000, 2))
    budget.reserve(BudgetRequest("reservation-1", "budget-1", "run-1", "step-1", "req-1",
                                 "openai", "model", "v1", Decimal("2"), 100))
    return OperationsSources(queue=queue, queue_job_ids=("job-1",), leases=leases,
                             lease_run_ids=("run-1",), budget=budget,
                             budget_ids=("budget-1",), reservation_ids=("reservation-1",))


def test_missing_sources_remain_unknown_with_source_gaps():
    from packages.observability.projection import OperationsSources, project_operations
    result = project_operations(OperationsSources(), observed_at=NOW)
    assert set(result["health"]) == {
        "database", "queue", "worker", "provider", "backend", "artifact_store"}
    assert all(signal["state"] == "UNKNOWN" for signal in result["health"].values())
    assert result["source_gaps"] == [
        "artifact_store", "backend", "database", "deployment", "provider", "queue", "worker"]


def test_artifact_store_signal_removes_only_its_gap_and_preserves_health_evidence():
    from packages.observability.models import HealthSignal
    from packages.observability.projection import OperationsSources, project_operations
    signal = HealthSignal("artifact_store", "UNKNOWN", NOW, timedelta(minutes=10),
                          2, HASH, "/operations/artifacts")
    result = project_operations(OperationsSources(health_signals=(signal,)),
                                observed_at=NOW + timedelta(minutes=1))
    assert result["source_gaps"] == [
        "backend", "database", "deployment", "provider", "queue", "worker"]
    assert result["health"]["artifact_store"] == {
        "state": "UNKNOWN", "observed_at": NOW.isoformat(),
        "stale_after_seconds": 600, "last_check": NOW.isoformat(),
        "error_count": 2, "detail_path": "/operations/artifacts", "evidence_ref": HASH}
    assert all(result["health"][key]["state"] == "UNKNOWN" for key in
               ("database", "queue", "worker", "provider", "backend"))


def test_owner_projection_masks_tokens_and_exposes_queue_worker_budget_state():
    from packages.observability.projection import project_operations
    result = project_operations(sources(), observed_at=NOW + timedelta(minutes=1))
    assert result["queue"][0]["dependency_ids"] == ["job-0"]
    assert result["queue"][0]["attempts"] == 0
    assert result["queue"][0]["max_attempts"] == 2
    assert result["queue"][0]["priority"] == "UNKNOWN"
    assert result["queue"][0]["required_capability"] == "UNKNOWN"
    assert result["worker"][0]["lease_epoch"] == 1
    assert result["worker"][0]["health"] == "HEALTHY"
    assert result["worker"][0]["write_scopes"] == ["src/critical.py"]
    assert result["worker"][0]["drain_state"] == "UNKNOWN"
    assert result["budget"][0]["reserved_cost"] == "2"
    assert result["reservations"][0]["lifecycle"] == "RESERVED"
    assert "sentinel-queue-token" not in str(result)
    assert "sentinel-lease-token" not in str(result)


def test_expired_worker_and_quarantine_are_not_healthy():
    from packages.observability.projection import project_operations
    view = sources()
    claim = view.queue.claim("worker-1", NOW, visibility_timeout=timedelta(seconds=10))
    view.queue.fail(claim.job_id, claim.execution_fencing_token, NOW, "retry")
    claim = view.queue.claim("worker-1", NOW, visibility_timeout=timedelta(seconds=10))
    view.queue.fail(claim.job_id, claim.execution_fencing_token, NOW, "poison")
    result = project_operations(view, observed_at=NOW + timedelta(minutes=6))
    assert result["queue"][0]["state"] == "QUARANTINED"
    assert result["quarantine"][0]["reason"] == "OWNER_REPORTED"
    assert result["worker"][0]["health"] == "EXPIRED"


def test_health_staleness_and_deployment_monitoring_are_explicit():
    from packages.observability.models import HealthSignal, DeploymentSignal
    from packages.observability.projection import OperationsSources, project_operations
    view = OperationsSources(health_signals=(HealthSignal("database", "HEALTHY", NOW,
        timedelta(minutes=2), 0, HASH, "/operations/database"),),
        deployments=(DeploymentSignal("deploy-1", "MONITORING", NOW, HASH,
            smoke_passed=True, monitoring_completed=False, owner_confirmed=False,
            critical_alerts=0),))
    result = project_operations(view, observed_at=NOW + timedelta(minutes=3))
    assert result["health"]["database"]["state"] == "EXPIRED"
    assert result["deployments"][0]["state"] == "MONITORING"
    assert result["deployments"][0]["release_ready"] is False


def test_alert_detection_dedupes_and_ack_resolve_are_distinct_audited_transitions():
    from packages.observability.service import OperationsService, OperationsError
    repository = RecordingRepository()
    service = OperationsService("project-1", "env-1", sources(), repository=repository,
                                clock=lambda: NOW + timedelta(minutes=6))
    service.detect()
    first = service.alerts()
    service.detect()
    again = service.alerts()
    expired = [a for a in first if a["code"] == "WORKER_LEASE_EXPIRED"]
    assert len(expired) == 1
    assert len(again) == len(first)
    alert_id = expired[0]["alert_id"]
    acknowledged = service.acknowledge(alert_id, actor_id="operator", approval_id="approval-1",
                                       evidence_hash=HASH)
    assert acknowledged["status"] == "acknowledged"
    assert service.alerts()[0]["status"] != "resolved"
    with pytest.raises(OperationsError, match="RESOLUTION_EVIDENCE_REQUIRED"):
        service.resolve(alert_id, actor_id="operator", approval_id="approval-1", evidence_hash="")
    resolved = service.resolve(alert_id, actor_id="operator", approval_id="approval-1",
                               evidence_hash=HASH)
    assert resolved["status"] == "resolved"
    assert [e["action"] for e in service.audit() if e["alert_id"] == alert_id] == [
        "DETECTED", "ACKNOWLEDGED", "RESOLVED"]
    assert all(e["actor_id"] and e["at"] and e["evidence_hash"] for e in service.audit())
    restored = OperationsService("project-1", "env-1", sources(), repository=repository,
                                 clock=lambda: NOW + timedelta(minutes=6))
    assert restored.alerts()[0]["status"] == "resolved"
    assert restored.audit() == service.audit()


def test_forecast_and_unknown_usage_never_become_zero_cost_success():
    from packages.observability.projection import project_operations
    view = sources()
    result = project_operations(view, observed_at=NOW)
    assert result["reservations"][0]["actual_cost"] is None
    assert result["reservations"][0]["lifecycle"] == "RESERVED"
    assert result["budget"][0]["consumed_cost"] == "0"


def test_unconfirmed_provider_usage_stays_unknown_and_quota_pause_is_detected():
    from packages.observability.projection import OperationsSources, project_operations
    from packages.observability.service import OperationsService
    budget = BudgetService(InMemoryInterventionBudgetRepository())
    budget.create_budget(BudgetLimit("budget-2", Decimal("10"), 1000, 2))
    request = BudgetRequest("reservation-2", "budget-2", "run-2", "step-2", "req-2",
                            "openai", "model", "v1", Decimal("2"), 100)
    budget.dispatch(request, admission_hash=HASH,
        sender=lambda _: ProviderOutcome("req-2", "openai", "model", "UNKNOWN", None, None,
                                         "UNKNOWN", None, None, "QUOTA_EXHAUSTED"))
    view = OperationsSources(budget=budget, budget_ids=("budget-2",),
                             reservation_ids=("reservation-2",), request_ids=("req-2",))
    result = project_operations(view, observed_at=NOW)
    assert result["reservations"][0]["actual_cost"] is None
    assert result["reservations"][0]["lifecycle"] == "PAUSED_QUOTA"
    assert result["budget"][0]["new_action_allowed"] is False
    service = OperationsService("project-1", "env-1", view, repository=RecordingRepository(), clock=lambda: NOW)
    service.detect()
    assert any(a["code"] == "BUDGET_RECONCILIATION_REQUIRED" for a in service.alerts())


def test_untrusted_health_evidence_or_internal_detail_link_is_rejected():
    from packages.observability.models import HealthSignal, DeploymentSignal
    with pytest.raises(ValueError):
        HealthSignal("database", "HEALTHY", NOW, timedelta(minutes=1), 0,
                     "http://127.0.0.1:8200?token=secret", "/operations/database")
    with pytest.raises(ValueError):
        HealthSignal("database", "HEALTHY", NOW, timedelta(minutes=1), 0, HASH,
                     "/operations/database?token=secret")
    with pytest.raises(ValueError):
        HealthSignal("database", "HEALTHY", NOW, timedelta(minutes=1), 0, HASH,
                     "//evil-host/path")
    with pytest.raises(ValueError):
        DeploymentSignal("deploy-1", "RELEASED", NOW, HASH, smoke_passed=True)


def test_detector_observes_unknown_late_and_error_count_with_evidence():
    from packages.observability.models import HealthSignal
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    view = OperationsSources(health_signals=(
        HealthSignal("database", "UNKNOWN", NOW, timedelta(minutes=10), 0, HASH, "/operations/database"),
        HealthSignal("provider", "HEALTHY", NOW, timedelta(minutes=10), 3, HASH, "/operations/providers"),
        HealthSignal("backend", "HEALTHY", NOW, timedelta(minutes=2), 0, HASH, "/operations/backends"),
    ))
    service = OperationsService("project-1", "env-1", view, repository=RecordingRepository(),
                                clock=lambda: NOW + timedelta(minutes=2))
    service.detect()
    affected = {(a["code"], a["related_entity_id"]) for a in service.alerts()}
    assert ("HEALTH_SIGNAL_UNKNOWN", "database") in affected
    assert ("HEALTH_ERROR_COUNT", "provider") in affected
    assert ("HEALTH_SIGNAL_LATE", "backend") in affected
    assert all(a["evidence_hash"] == HASH and a["deep_link"].startswith("/operations/") for a in service.alerts())


def test_actor_and_evidence_hash_cannot_embed_secret_or_endpoint():
    from packages.observability.service import OperationsService, OperationsError
    service = OperationsService("project-1", "env-1", sources(), repository=RecordingRepository(),
                                clock=lambda: NOW + timedelta(minutes=6))
    service.detect()
    alert_id = service.alerts()[0]["alert_id"]
    for actor, digest in (("https://127.0.0.1/secret", HASH), ("operator", "sha256:secret")):
        with pytest.raises(OperationsError):
            service.acknowledge(alert_id, actor_id=actor, approval_id="approval-1", evidence_hash=digest)
    with pytest.raises(OperationsError, match="ACK_EVIDENCE_REQUIRED"):
        service.acknowledge(alert_id, actor_id="operator", evidence_hash=HASH)
    assert service.alerts()[0]["status"] == "open"


def test_repository_is_required_and_audit_is_bounded():
    from packages.observability.service import OperationsService, OperationsError
    with pytest.raises(OperationsError, match="AUDIT_OWNER_REQUIRED"):
        OperationsService("project-1", "env-1", sources(), clock=lambda: NOW)
    repository = RecordingRepository()
    service = OperationsService("project-1", "env-1", sources(), repository=repository,
                                clock=lambda: NOW + timedelta(minutes=6))
    service.detect()
    for index in range(110):
        repository.append("project-1", "env-1", len(repository.load("project-1", "env-1")),
                          {"action": "CHECK", "alert_id": f"alert-{index}", "actor_id": "system:detector",
                           "at": NOW.isoformat(), "approval_id": None, "evidence_hash": HASH})
    assert len(service.audit()) == 100
