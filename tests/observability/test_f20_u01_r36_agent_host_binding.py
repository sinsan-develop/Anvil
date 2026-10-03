"""R36 internal loader is lazy, scoped, isolated from public operations reads."""

from dataclasses import asdict, replace
from datetime import datetime, timezone

from fastapi import FastAPI
import pytest
import sqlalchemy as sa

from apps.api.anvil_api import oidc_process
from packages.observability.agent_owner_summary import ScopedAgentOwnerSummary
from packages.observability.projection import OperationsSources
from packages.observability.run_status_summary import ScopedRunStatusSummary
from packages.observability.service import OperationsError, OperationsService
from packages.persistence.operations_agent_owner_read import AgentOwnerObservation, ScopedAgentOwnerSource
from tests.api.test_oidc_process import _environment, _trust
from tests.observability.test_f13_operations import RecordingRepository
from tests.observability.test_f20_u01_r9_queue_host import QueueSource

NOW = datetime(2026, 9, 30, tzinfo=timezone.utc)
ZERO = ScopedAgentOwnerSummary(NOW, 0, 0, 0, 0)


def owner(loader=None):
    return OperationsService("project-1", "wsl-qa", OperationsSources(),
        repository=RecordingRepository(), clock=lambda: NOW,
        run_summary_loader=lambda *_: ScopedRunStatusSummary(NOW, 1, 1, 0, 0),
        agent_owner_summary_loader=loader)


@pytest.mark.parametrize("result", [None, {},
    replace(ZERO, observed_total=1), replace(ZERO, active_owners=-1),
    replace(ZERO, observed_total=True), replace(ZERO, observed_at=NOW.replace(tzinfo=None)),
    replace(ZERO, observed_total=101, active_owners=101)])
def test_missing_malformed_or_failure_is_unavailable_without_affecting_other_sources(result):
    service = owner(lambda *_: result)
    baseline = service.snapshot()
    with pytest.raises(OperationsError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
        service.agent_owner_summary()
    assert service.snapshot() == baseline
    assert service.run_summary().active_runs == 1
    assert service.detect() == 0 and service.alerts() == service.audit() == []


def test_optional_absent_noncallable_and_raising_loader_are_redacted():
    def raising(*_):
        raise RuntimeError("DSN password=synthetic-secret")

    for loader in (None, raising):
        with pytest.raises(OperationsError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$") as error:
            owner(loader).agent_owner_summary()
        assert "synthetic-secret" not in str(error.value) and error.value.__cause__ is None
    with pytest.raises(OperationsError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
        owner(5)


def test_only_explicit_internal_read_calls_loader_and_detaches_result():
    calls = []
    loaded = replace(ZERO)

    def loader(*scope):
        calls.append(scope)
        return loaded

    service = owner(loader)
    baseline = service.snapshot()
    service.detect()
    service.alerts()
    service.audit()
    service.run_summary()
    assert calls == []
    first = service.agent_owner_summary()
    assert calls == [("project-1", "wsl-qa")]
    object.__setattr__(first, "active_owners", 99)
    assert asdict(service.agent_owner_summary()) == asdict(ZERO)
    assert service.snapshot() == baseline
    assert set(baseline) == {"observed_at", "queue", "worker", "quarantine",
        "budget", "reservations", "providers", "health", "source_gaps",
        "deployments", "alerts", "next_actions"}


def test_oidc_host_pins_scope_engine_and_never_eagerly_reads_agents(tmp_path, monkeypatch):
    path, _, _ = _trust(tmp_path)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_kw: engine)
    agent_calls, queue_calls, run_calls = [], [], []

    def load_agents(actual_engine, project, environment):
        agent_calls.append((actual_engine, project, environment))
        rows = () if len(agent_calls) == 1 else tuple(
            AgentOwnerObservation("shared-session", f"assignment-{i}", 1, 1, status, NOW)
            for i, status in enumerate(("ACTIVE", "REVOKED", "EXPIRED")))
        return ScopedAgentOwnerSource(rows, NOW)

    def load_queue(*scope):
        queue_calls.append(scope)
        return QueueSource("job-1")

    def load_runs(*scope):
        from packages.persistence.operations_run_read import ScopedRunSource
        run_calls.append(scope)
        return ScopedRunSource((), NOW, {})

    monkeypatch.setattr(oidc_process, "load_scoped_agent_owner_source", load_agents, raising=False)
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", load_queue)
    monkeypatch.setattr(oidc_process, "load_scoped_run_source", load_runs)
    monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", lambda _: RecordingRepository())
    captured = []

    def host(**kwargs):
        captured.append(kwargs)
        return FastAPI()

    try:
        oidc_process.create_oidc_process_app(_environment(path), host)
        service = captured[0]["operations_owner"]
        assert agent_calls == queue_calls == run_calls == []
        assert service.snapshot()["queue"][0]["job_id"] == "job-1"
        assert service.run_summary().observed_total == 0
        service.detect()
        service.alerts()
        service.audit()
        assert agent_calls == []
        assert service.agent_owner_summary().observed_total == 0
        assert asdict(service.agent_owner_summary()) == dict(observed_at=NOW,
            observed_total=3, active_owners=1, revoked_owners=1, expired_owners=1)
        assert agent_calls == [(engine, "project-1", "wsl-qa")] * 2
        for scope in (("foreign", "wsl-qa"), ("project-1", "foreign"), ([], "wsl-qa")):
            with pytest.raises(ValueError, match="^AGENT_SOURCE_SCOPE_INVALID$"):
                service._agent_owner_summary_loader(*scope)
        assert len(agent_calls) == 2
        class Foreign(str):
            def __eq__(self, other):
                pytest.fail("untrusted scope comparison callback")
        with pytest.raises(ValueError, match="^AGENT_SOURCE_SCOPE_INVALID$"):
            service._agent_owner_summary_loader(Foreign("project-1"), "wsl-qa")
        with monkeypatch.context() as patch:
            def unavailable(*_):
                raise RuntimeError("postgresql://secret-internal-host")
            patch.setattr(oidc_process, "load_scoped_agent_owner_source", unavailable)
            with pytest.raises(OperationsError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
                service.agent_owner_summary()
            assert service.snapshot()["queue"][0]["job_id"] == "job-1"
            assert service.run_summary().observed_total == 0
        assert service.agent_owner_summary().observed_total == 3
    finally:
        engine.dispose()


def test_public_dashboard_get_does_not_expose_or_query_agent_owner_summary():
    from tests.api.test_f20_u01_r10_dashboard_api import client, PATH
    calls = []
    service = OperationsService("project-1", "env-1", OperationsSources(),
        repository=RecordingRepository(), clock=lambda: NOW,
        agent_owner_summary_loader=lambda *_: calls.append("unexpected"))
    http = client(operations_owner=service)
    response = http.get(PATH)
    assert response.status_code == 200
    assert set(response.json()["data"]) == {"observed_at", "health", "queue", "quarantine",
        "worker", "budget", "reservations", "providers", "deployments", "source_gaps",
        "alerts", "next_actions", "run_summary"}
    assert calls == []
    assert client(operations_owner=service, permissions=frozenset()).get(PATH).status_code == 403
    assert calls == []


def test_untrusted_loader_dto_callback_and_alias_cannot_cross_service_boundary():
    calls = []

    class Hostile:
        @property
        def observed_at(self):
            calls.append("property")
            raise AssertionError

    class Count(int):
        def __lt__(self, other):
            calls.append("comparison")
            raise AssertionError

    for value in (Hostile(), replace(ZERO, observed_total=Count(0))):
        with pytest.raises(OperationsError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
            owner(lambda *_: value).agent_owner_summary()
    assert calls == []
    result = replace(ZERO)
    service = owner(lambda *_: result)
    captured = service.agent_owner_summary()
    object.__setattr__(result, "observed_total", 99)
    assert captured.observed_total == 0
    with pytest.raises(OperationsError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
        service.agent_owner_summary()
