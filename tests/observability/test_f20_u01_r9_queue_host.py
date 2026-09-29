"""R9 host reads a fresh trusted Queue observation and fails closed."""

from datetime import datetime, timezone

import pytest

from packages.observability.projection import OperationsSources
from packages.observability.service import OperationsError, OperationsService
from tests.observability.test_f13_operations import RecordingRepository


NOW = datetime(2026, 9, 29, tzinfo=timezone.utc)


class QueueSource:
    def __init__(self, job_id="job-1", *, legacy=False, quarantined=False):
        self.job_ids = (job_id,)
        self.legacy_unscoped_present = legacy
        self._job_id = job_id
        self._quarantined = quarantined

    def get(self, job_id):
        assert job_id == self._job_id

        class Job:
            status = type("Status", (), {"value": "PENDING"})()
            run_id = "run-1"
            available_at = NOW
            attempts = 0
            max_attempts = 2
            lease_epoch = 0
            lease_expires_at = None
            dependency_ids = ()
            conflict_keys = ()
            input_verified = True

        job = Job()
        job.job_id = job_id
        return job

    def quarantine(self):
        if not self._quarantined:
            return ()
        return (type("Quarantine", (), {"job_id": self._job_id, "attempts": 2,
                "reason": "OWNER_REPORTED", "quarantined_at": NOW})(),)


def _service(loader):
    return OperationsService("project-1", "env-1", OperationsSources(),
                             source_loader=loader, repository=RecordingRepository(),
                             clock=lambda: NOW)


def test_snapshot_and_explicit_detect_each_reload_fresh_queue_without_get_side_effects():
    calls = []

    def loader(project_id, environment_id):
        calls.append((project_id, environment_id))
        job_id = f"job-{len(calls)}"
        return OperationsSources(queue=QueueSource(job_id, quarantined=len(calls) == 3),
                                 queue_job_ids=(job_id,))

    service = _service(loader)
    assert service.alerts() == [] and service.audit() == []
    assert calls == []
    assert service.snapshot()["queue"][0]["job_id"] == "job-1"
    assert service.snapshot()["queue"][0]["job_id"] == "job-2"
    assert all(call == ("project-1", "env-1") for call in calls)
    assert service.detect() == 1
    assert service.alerts()[0]["code"] == "QUEUE_JOB_QUARANTINED"
    assert len(calls) == 3
    assert service.snapshot()["health"]["queue"]["state"] == "UNKNOWN"


@pytest.mark.parametrize("failure,expected", [
    (RuntimeError("SQL: password=secret"), "QUEUE_SOURCE_UNAVAILABLE"),
    (ValueError("QUEUE_SOURCE_LIMIT_EXCEEDED"), "QUEUE_SOURCE_LIMIT_EXCEEDED"),
    (None, "QUEUE_SOURCE_INVALID"),
    (OperationsSources(queue=QueueSource(legacy=True), queue_job_ids=("job-1",)),
     "QUEUE_SOURCE_LEGACY_UNSCOPED"),
])
def test_loader_failures_never_project_complete_empty_queue_or_leak_details(failure, expected):
    def loader(_project_id, _environment_id):
        if isinstance(failure, Exception):
            raise failure
        return failure

    service = _service(loader)
    for read in (service.snapshot, service.detect):
        with pytest.raises(OperationsError, match=f"^{expected}$") as error:
            read()
        assert "secret" not in str(error.value)
    assert service.alerts() == [] and service.audit() == []


def test_loader_must_be_callable_and_static_sources_remain_compatible():
    with pytest.raises(OperationsError, match="OPERATIONS_SOURCE_LOADER_INVALID"):
        _service("untrusted")
    fixed = OperationsService("project-1", "env-1", OperationsSources(),
                              repository=RecordingRepository(), clock=lambda: NOW)
    assert fixed.snapshot()["queue"] == []
    assert fixed.detect() == 0


def test_api_alert_and_audit_get_do_not_invoke_queue_loader_or_detector():
    from tests.api.test_f13_operations_api import _client

    calls = []

    def loader(*_scope):
        calls.append("queue")
        raise AssertionError("GET must not touch queue")

    owner = _service(loader)
    client = _client(owner=owner)
    assert client.get("/api/operations/alerts").status_code == 200
    assert client.get("/api/operations/audit").status_code == 200
    assert calls == []
    assert owner.audit() == []
