"""R17 binds the internal Run summary lazily to one authorized scope."""

from datetime import datetime, timezone

from fastapi import FastAPI
import pytest
import sqlalchemy as sa

from apps.api.anvil_api import oidc_process
from packages.execution.models import RunPhase, RunStatus
from packages.observability.projection import OperationsSources
from packages.observability.run_status_summary import ScopedRunStatusSummary
from packages.observability.service import OperationsError, OperationsService
from packages.persistence.operations_run_read import RunObservation, ScopedRunSource
from packages.persistence.operations_budget_read import ScopedBudgetSource
from tests.api.test_oidc_process import _environment, _trust
from tests.observability.test_f13_operations import RecordingRepository
from tests.observability.test_f20_u01_r9_queue_host import QueueSource


NOW = datetime(2026, 9, 30, tzinfo=timezone.utc)


def _owner(loader=None):
    return OperationsService("project-1", "wsl-qa", OperationsSources(),
                             repository=RecordingRepository(), clock=lambda: NOW,
                             run_summary_loader=loader)


def test_run_summary_missing_invalid_and_exception_are_safe():
    with pytest.raises(OperationsError, match="^RUN_SUMMARY_UNAVAILABLE$"):
        _owner().run_summary()
    for loader in (lambda *_: None,
                   lambda *_: {"observed_total": 0},
                   lambda *_: (_ for _ in ()).throw(RuntimeError("DSN secret"))):
        with pytest.raises(OperationsError, match="^RUN_SUMMARY_UNAVAILABLE$") as error:
            _owner(loader).run_summary()
        assert "secret" not in str(error.value)


def test_run_summary_is_lazy_and_separate_from_queue_snapshot_and_detector():
    calls = []

    def loader(*scope):
        calls.append(scope)
        return ScopedRunStatusSummary(NOW, 0, 0, 0, 0)

    owner = _owner(loader)
    assert owner.snapshot()["queue"] == []
    assert owner.detect() == 0
    assert owner.alerts() == [] and owner.audit() == []
    assert calls == []
    assert owner.run_summary().observed_total == 0
    assert calls == [("project-1", "wsl-qa")]


def test_oidc_host_uses_fixed_scope_and_loads_only_on_run_summary(tmp_path, monkeypatch):
    path, _, _ = _trust(tmp_path)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_kw: engine)
    calls = []

    def load_run(actual_engine, project_id, environment_id):
        calls.append((actual_engine, project_id, environment_id))
        runs = () if len(calls) == 1 else (
            RunObservation("r1", "task-1", RunPhase.IMPLEMENTING, RunStatus.ACTIVE, 1),
            RunObservation("r2", "task-2", RunPhase.IMPLEMENTING, RunStatus.BLOCKED, 1),
            RunObservation("r3", "task-3", RunPhase.IMPLEMENTING, RunStatus.WAITING_APPROVAL, 1),
        )
        return ScopedRunSource(tuple(row.run_id for row in runs), NOW,
                               {row.run_id: row for row in runs})

    monkeypatch.setattr(oidc_process, "load_scoped_run_source", load_run, raising=False)
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source",
                        lambda *_args: QueueSource("job-1"))

    def load_budget(actual_engine, project_id, environment_id):
        assert actual_engine is engine
        assert (project_id, environment_id) == ("project-1", "wsl-qa")
        return ScopedBudgetSource((), ())

    monkeypatch.setattr(oidc_process, "load_scoped_budget_source", load_budget)

    class Repository:
        def __init__(self, _dsn):
            pass

        def load(self, *_scope):
            return ()

        def append(self, *_args):
            raise AssertionError("read must not append")

    monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", Repository)
    observed = []

    def host(**kwargs):
        observed.append(kwargs)
        return FastAPI()

    try:
        oidc_process.create_oidc_process_app(_environment(path), host)
        owner = observed[0]["operations_owner"]
        assert calls == []
        assert owner.snapshot()["queue"][0]["job_id"] == "job-1"
        assert calls == []
        assert owner.run_summary().observed_total == 0
        mixed = owner.run_summary()
        assert (mixed.observed_total, mixed.active_runs, mixed.blocked_runs,
                mixed.waiting_approval_runs) == (3, 1, 1, 1)
        assert calls == [(engine, "project-1", "wsl-qa")] * 2
        with pytest.raises(ValueError, match="^RUN_SOURCE_SCOPE_INVALID$"):
            owner._run_summary_loader("foreign", "wsl-qa")
        assert len(calls) == 2
    finally:
        engine.dispose()
