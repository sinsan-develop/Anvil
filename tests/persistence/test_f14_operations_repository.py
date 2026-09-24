import os

import pytest

from packages.persistence.operations_repository import PostgresOperationsRepository


DSN = os.environ.get("ANVIL_TEST_POSTGRES_DSN")
requires_postgres = pytest.mark.skipif(not DSN, reason="ANVIL_TEST_POSTGRES_DSN not configured")


def test_operations_repository_requires_explicit_postgres_owner():
    with pytest.raises(ValueError):
        PostgresOperationsRepository("")


def test_operations_event_rejects_token_secret_and_cross_scope_before_connection():
    from packages.persistence.operations_repository import _safe_event
    base = {"action": "DETECTED", "alert_id": "alert-1", "actor_id": "system:detector",
            "at": "2026-09-24T00:00:00+00:00", "approval_id": None,
            "evidence_hash": "sha256:" + "a" * 64,
            "alert": {"alert_id": "alert-1", "level": "critical", "source": "worker",
                      "category": "availability", "code": "WORKER_LEASE_EXPIRED",
                      "related_entity_id": "run-1", "dedupe_key": "f13-r2:project-1:test:WORKER_LEASE_EXPIRED:run-1",
                      "detector_rule_revision": "f13-r2", "cause": "Worker lease expiry observed",
                      "impact": "Run ownership cannot be trusted", "next_action": "REVIEW_WORKER_TAKEOVER",
                      "deep_link": "/operations/workers", "evidence_hash": "sha256:" + "a" * 64,
                      "status": "open", "owner_id": None, "observed_at": "2026-09-24T00:00:00+00:00",
                      "project_id": "project-1", "environment_id": "test"}}
    assert _safe_event(base, "project-1", "test") == base
    for changed in ({**base, "token": "raw"},
                    {**base, "alert": {**base["alert"], "secret": "raw"}},
                    {**base, "alert": {**base["alert"], "project_id": "other"}},
                    {**base, "alert": {**base["alert"], "cause": "secret://vault/key"}},
                    {**base, "alert": {**base["alert"], "impact": "token=raw"}},
                    {**base, "alert": {**base["alert"], "cause": "sk-synthetic-credential"}}):
        with pytest.raises(ValueError, match="AUDIT_EVENT_INVALID"):
            _safe_event(changed, "project-1", "test")


def test_existing_f13_detector_event_is_accepted_by_strict_owner_boundary():
    from datetime import datetime, timedelta, timezone
    from packages.observability.models import HealthSignal
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    from packages.persistence.operations_repository import _safe_event
    now = datetime(2026, 9, 24, tzinfo=timezone.utc)
    class ValidatingOwner:
        def __init__(self):
            self.events = ()
        def load(self, _project, _environment):
            return self.events
        def append(self, project, environment, expected_sequence, event):
            assert expected_sequence == len(self.events)
            self.events += (_safe_event(event, project, environment),)
    owner = ValidatingOwner()
    sources = OperationsSources(health_signals=(HealthSignal("database", "UNKNOWN", now,
        timedelta(minutes=5), 0, "sha256:" + "a" * 64, "/operations/database"),))
    service = OperationsService("project-1", "test", sources, repository=owner, clock=lambda: now)
    assert service.detect() == 1
    assert service.alerts()[0]["code"] == "HEALTH_SIGNAL_UNKNOWN"


def test_queue_quarantine_task_id_reaches_audit_owner_without_token_false_positive():
    from datetime import datetime, timedelta, timezone
    from packages.observability.projection import OperationsSources
    from packages.observability.service import OperationsService
    from packages.persistence.operations_repository import _safe_event, _safe_identifier
    from packages.queue.models import QueueJob
    from packages.queue.service import DurableQueue
    now = datetime(2026, 9, 24, tzinfo=timezone.utc)
    queue = DurableQueue(token_factory=lambda: "synthetic-fence")
    queue.enqueue(QueueJob("task-1", "run-1", "payload", now, 1))
    claim = queue.claim("worker-1", now, visibility_timeout=timedelta(seconds=10))
    queue.fail(claim.job_id, claim.execution_fencing_token, now, "poison")
    class ValidatingOwner:
        def __init__(self):
            self.events = ()
        def load(self, _project, _environment):
            return self.events
        def append(self, project, environment, expected_sequence, event):
            assert expected_sequence == len(self.events)
            self.events += (_safe_event(event, project, environment),)
    owner = ValidatingOwner()
    service = OperationsService("project-1", "test",
        OperationsSources(queue=queue, queue_job_ids=("task-1",)), repository=owner,
        clock=lambda: now)
    assert service.detect() == 1
    assert service.alerts()[0]["code"] == "QUEUE_JOB_QUARANTINED"
    assert service.alerts()[0]["related_entity_id"] == "task-1"
    assert not _safe_identifier("sk-synthetic-credential")


@requires_postgres
def test_operations_cas_and_cross_instance_restore():
    from uuid import uuid4
    project = f"f14-{uuid4()}"
    first = PostgresOperationsRepository(DSN)
    second = PostgresOperationsRepository(DSN)
    event = {"action": "ACKNOWLEDGED", "alert_id": "alert-1", "actor_id": "operator",
             "at": "2026-09-24T00:00:00+00:00", "approval_id": "approval-1",
             "evidence_hash": "sha256:" + "a" * 64}
    first.append(project, "test", 0, event)
    assert second.load(project, "test") == (event,)
    with pytest.raises(ValueError, match="AUDIT_SEQUENCE_CONFLICT"):
        second.append(project, "test", 0, event)


@requires_postgres
def test_two_concurrent_writers_cannot_append_the_same_sequence():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from uuid import uuid4
    project = f"f14-{uuid4()}"
    barrier = Barrier(2)
    def send(index):
        repository = PostgresOperationsRepository(DSN)
        barrier.wait()
        try:
            repository.append(project, "test", 0, {"action": "ACKNOWLEDGED",
                "alert_id": "alert-1", "actor_id": "operator", "at": "2026-09-24T00:00:00+00:00",
                "approval_id": "approval-1", "evidence_hash": "sha256:" + "a" * 64})
            return "committed"
        except ValueError as exc:
            return str(exc)
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(send, range(2)))
    assert sorted(outcomes) == ["AUDIT_SEQUENCE_CONFLICT", "committed"]
    assert len(PostgresOperationsRepository(DSN).load(project, "test")) == 1
