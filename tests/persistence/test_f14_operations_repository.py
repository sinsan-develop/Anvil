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
            "alert": {"alert_id": "alert-1", "level": "warning", "source": "worker",
                      "category": "availability", "code": "WORKER_LEASE_EXPIRED",
                      "related_entity_id": "run-1", "dedupe_key": "f13:p:e:worker:run-1",
                      "detector_rule_revision": "f13-r2", "cause": "lease expired",
                      "impact": "ownership unknown", "next_action": "REVIEW_WORKER_TAKEOVER",
                      "deep_link": "/operations/workers", "evidence_hash": "sha256:" + "a" * 64,
                      "status": "open", "owner_id": None, "observed_at": "2026-09-24T00:00:00+00:00",
                      "project_id": "project-1", "environment_id": "test"}}
    assert _safe_event(base, "project-1", "test") == base
    for changed in ({**base, "token": "raw"},
                    {**base, "alert": {**base["alert"], "secret": "raw"}},
                    {**base, "alert": {**base["alert"], "project_id": "other"}},
                    {**base, "alert": {**base["alert"], "cause": "secret://vault/key"}},
                    {**base, "alert": {**base["alert"], "impact": "token=raw"}}):
        with pytest.raises(ValueError, match="AUDIT_EVENT_INVALID"):
            _safe_event(changed, "project-1", "test")


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
