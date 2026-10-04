"""R9 OIDC process binds a trusted scoped Queue loader, not a startup snapshot."""

from fastapi import FastAPI
import pytest
import sqlalchemy as sa

from apps.api.anvil_api import oidc_process
from packages.persistence.operations_budget_read import ScopedBudgetSource
from tests.api.test_oidc_process import _environment, _trust
from tests.observability.test_f20_u01_r9_queue_host import QueueSource


def test_oidc_process_loads_queue_on_each_owner_read_with_fixed_scope(tmp_path, monkeypatch):
    path, _, _ = _trust(tmp_path)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_kw: engine)
    calls = []

    def load_queue(actual_engine, project_id, environment_id):
        calls.append((actual_engine, project_id, environment_id))
        return QueueSource(f"job-{len(calls)}")

    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", load_queue, raising=False)

    def load_budget(actual_engine, project_id, environment_id):
        assert actual_engine is engine
        assert (project_id, environment_id) == ("project-1", "wsl-qa")
        return ScopedBudgetSource((), ())

    monkeypatch.setattr(oidc_process, "load_scoped_budget_source", load_budget)
    class Repository:
        def __init__(self, _dsn):
            pass

        def load(self, _project_id, _environment_id):
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
        assert calls == []
        owner = observed[0]["operations_owner"]
        assert owner.snapshot()["queue"][0]["job_id"] == "job-1"
        assert owner.snapshot()["queue"][0]["job_id"] == "job-2"
        assert calls == [(engine, "project-1", "wsl-qa")] * 2
        assert owner.alerts() == [] and owner.audit() == []
        assert len(calls) == 2
        with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
            owner._source_loader("foreign-project", "wsl-qa")
        assert len(calls) == 2
    finally:
        engine.dispose()
