"""Main-only disposable PG15 QA. Synthetic rows are not production evidence."""
from contextlib import contextmanager
from decimal import Decimal
import os

from fastapi.testclient import TestClient
import pytest
import sqlalchemy as sa

from packages.persistence.operations_budget_read import load_scoped_budget_source
from packages.execution.models import RunPhase
from tests.integration.test_f20_u01_r37_provider_host_pg15 import (
    _build_host, _host_environment, _synthetic_auth_rows, _auth_rows, AUTH_TABLES,
    TABLES, ORIGIN, roles,
)
from tests.api.test_f20_u01_r10_dashboard_api import PATH
from tests.api.test_f20_u01_r37_provider_host_binding import FIELDS, assert_registration


_TABLES = TABLES + ("budget_ledgers", "budget_reservations", "budget_usage_receipts",
    "quota_pauses", "work_instructions", "execution_plans")
_HASH = "sha256:" + "3" * 64


def _target(environment):
    dsn, isolated = environment.get("ANVIL_U01_R38_PG_DSN"), environment.get("ANVIL_U01_R38_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R38 isolated PostgreSQL 15 opt-in absent; Main-owned QA")
    try:
        url = sa.engine.make_url(dsn)
        valid = (isolated == "1" and url.drivername == "postgresql+psycopg"
                 and url.host == "127.0.0.1" and url.port == 5551
                 and url.username == url.database == "anvil_u01_r38" and not url.query)
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        raise ValueError("R38_PG_TARGET_REJECTED") from None
    return url


@pytest.mark.parametrize("dsn,isolated", [(None, "1"), ("sqlite://", "1"),
    ("postgresql+psycopg://anvil_u01_r38@127.0.0.1:5551/anvil_u01_r38", None),
    ("postgresql+psycopg://anvil_u01_r38@127.0.0.1:5551/anvil_u01_r38", "0"),
    ("postgresql+psycopg://anvil_u01_r38@127.0.0.1:5432/anvil_u01_r38", "1"),
    ("postgresql+psycopg://anvil_u01_r38@localhost:5551/anvil_u01_r38", "1"),
    ("postgresql+psycopg://shared@127.0.0.1:5551/anvil_u01_r38", "1"),
    ("postgresql+psycopg://anvil_u01_r38@127.0.0.1:5551/shared", "1"),
    ("postgresql+psycopg://anvil_u01_r38@127.0.0.1:5551/anvil_u01_r38?x=secret", "1")])
def test_opt_in_rejects_shared_partial_or_unapproved_before_db(dsn, isolated, monkeypatch):
    monkeypatch.setattr(sa, "create_engine", lambda *_a, **_k: pytest.fail("DB reached"))
    with pytest.raises(ValueError, match="^R38_PG_TARGET_REJECTED$"):
        _target({"ANVIL_U01_R38_PG_DSN": dsn, "ANVIL_U01_R38_PG_ISOLATED": isolated})


def test_opt_in_accepts_only_exact_target_without_credential_reflection():
    url = _target({"ANVIL_U01_R38_PG_DSN":
        "postgresql+psycopg://anvil_u01_r38:synthetic@127.0.0.1:5551/anvil_u01_r38",
        "ANVIL_U01_R38_PG_ISOLATED": "1"})
    assert (url.host, url.port, url.database, url.username) == (
        "127.0.0.1", 5551, "anvil_u01_r38", "anvil_u01_r38")
    assert "synthetic" not in repr(url)


def _rows(engine):
    with engine.connect() as db:
        # Exact full row comparison, not counts alone, around each read.
        return tuple(tuple(sorted((dict(row) for row in db.execute(sa.text(f"SELECT * FROM {name}")).mappings()),
                                  key=repr)) for name in _TABLES)


@contextmanager
def _budget_rows(engine):
    """Valid persisted schema fixtures, NOT approvals or real execution receipts.

    No run_events or audit rows are fabricated/deleted. All inserted IDs are
    literal r38-only IDs in a preflight-empty, disposable database.
    """
    baseline = _rows(engine)
    assert baseline == ((),) * len(_TABLES), "R38_PG_NOT_EMPTY"
    metadata = sa.MetaData()
    tables = {name: sa.Table(name, metadata, autoload_with=engine)
              for name in ("work_instructions", "execution_plans", "tasks", "runs",
                           "budget_ledgers", "budget_reservations")}
    try:
        with engine.begin() as db:
            db.execute(tables["work_instructions"].insert().values(artifact_id="r38-wi", revision=1,
                content_hash=_HASH, iteration_plan_id="r38-fixture-parent", iteration_plan_hash=_HASH,
                allowed_paths=[], allowed_actions=[], completion_conditions=[]))
            db.execute(tables["execution_plans"].insert().values(plan_id="r38-plan", plan_hash=_HASH,
                source_work_instruction_id="r38-wi", source_work_instruction_hash=_HASH,
                baseline_analysis_hash=_HASH, impact_analysis_hash=_HASH, status="APPROVED"))
            for index, (project, env) in enumerate((("project-1", "wsl-qa"),
                    ("project-1", "other-env"), ("other-project", "wsl-qa"))):
                db.execute(tables["tasks"].insert().values(task_id=f"r38-task-{index}", project_id=project,
                    repository_id="r38-fixture-repository", title="R38 QA", objective="Budget read QA",
                    requested_by="r38-fixture", status="CONFIRMED"))
                db.execute(tables["runs"].insert().values(run_id=f"r38-run-{index}", task_id=f"r38-task-{index}",
                    baseline_id="r38-fixture-baseline", phase=RunPhase.IMPLEMENTING.value, status="ACTIVE", version=1,
                    work_instruction_id="r38-wi", execution_plan_id="r38-plan", idempotency_key=f"r38-run-key-{index}",
                    creation_request_hash=_HASH, environment_id=env, permission_snapshot_hash=_HASH))
                db.execute(tables["budget_ledgers"].insert().values(budget_id=f"r38-budget-{index}",
                    run_id=f"r38-run-{index}", hard_cost_limit=Decimal("20"), hard_token_limit=1000,
                    max_concurrent_requests=10, new_action_allowed=index != 0))
            for index, (budget, state) in enumerate(((0, "RESERVED"), (0, "RECONCILIATION_REQUIRED"),
                    (0, "CONSUMED"), (1, "RESERVED"), (2, "RESERVED"))):
                db.execute(tables["budget_reservations"].insert().values(reservation_id=f"r38-res-{index}",
                    budget_id=f"r38-budget-{budget}", run_id=f"r38-run-{budget}", step_id="r38-step",
                    request_id=f"r38-request-{index}", provider="local", model="r38-fixture",
                    pricing_version="r38-v1", reserved_cost=Decimal("2.1"), reserved_tokens=21,
                    consumed_cost=Decimal("0.2"), consumed_tokens=2, status=state))
        yield tables
    finally:
        with engine.begin() as db:
            for name, column, ids in (
                ("budget_reservations", "reservation_id", [f"r38-res-{i}" for i in range(5)]),
                ("budget_ledgers", "budget_id", [f"r38-budget-{i}" for i in range(3)]),
                ("runs", "run_id", [f"r38-run-{i}" for i in range(3)]),
                ("tasks", "task_id", [f"r38-task-{i}" for i in range(3)]),
                ("execution_plans", "plan_id", ["r38-plan"]),
                ("work_instructions", "artifact_id", ["r38-wi"])):
                db.execute(tables[name].delete().where(tables[name].c[column].in_(ids)))
        assert _rows(engine) == baseline, "R38_BUDGET_CLEANUP_RESIDUE"


def test_opt_in_real_pg15_returned_oidc_host_budget_scope_readonly(tmp_path, monkeypatch):
    url = _target(os.environ)
    engine = sa.create_engine(url, pool_pre_ping=True)
    host_engine = None
    try:
        with engine.connect() as db:
            facts = db.execute(sa.text("SELECT current_database(),current_user,"
                "current_setting('server_version_num')::integer,"
                "(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)")).one()
            assert (facts[0], facts[1], facts[2] // 10000, facts[3]) == (
                "anvil_u01_r38", "anvil_u01_r38", 15, False), "R38_PG_PREFLIGHT_REJECTED"
            assert db.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all() == ["0019_oidc_sessions"]
        assert _rows(engine) == ((),) * len(_TABLES)
        assert _auth_rows(engine) == ((),) * len(AUTH_TABLES)
        environment = _host_environment(tmp_path, url.render_as_string(hide_password=False))
        app, owner, host_engine = _build_host(environment, monkeypatch)
        assert app.state.auth_mode == "OIDC" and app.state.operations_bound
        assert app.state.database_engine is host_engine and not app.state.local_test_session_enabled
        empty = load_scoped_budget_source(host_engine, "project-1", "wsl-qa")
        assert empty.budget_ids == empty.reservation_ids == ()
        with _budget_rows(engine) as tables, _synthetic_auth_rows(engine) as token, TestClient(app, base_url=ORIGIN) as api:
            before, auth_before = _rows(engine), _auth_rows(engine)
            assert api.get(PATH).status_code == 401
            api.cookies.set("anvil_session", token)
            assert api.get("/health/ready").status_code == 200
            response = api.get(PATH)
            assert response.status_code == 200
            data = response.json()["data"]
            assert set(data) == FIELDS
            assert [row["budget_id"] for row in data["budget"]] == ["r38-budget-0"]
            budget = data["budget"][0]
            assert (Decimal(budget["reserved_cost"]), budget["reserved_tokens"], Decimal(budget["consumed_cost"]),
                    budget["consumed_tokens"], budget["active_requests"], budget["new_action_allowed"]) == (
                        Decimal("4.2"), 42, Decimal("0.6"), 6, 2, False)
            assert [row["reservation_id"] for row in data["reservations"]] == [f"r38-res-{i}" for i in range(3)]
            assert [row["lifecycle"] for row in data["reservations"]] == ["RESERVED", "USAGE_UNKNOWN", "RECONCILED"]
            assert all(row["actual_cost"] is row["actual_tokens"] is None for row in data["reservations"])
            assert_registration(data)
            assert data["queue"] == data["alerts"] == []
            assert data["run_summary"]["active_runs"] == 1
            assert _rows(engine) == before and _auth_rows(engine) == auth_before
            assert all(secret not in response.text for secret in (token, "r38-budget-1", "r38-budget-2", "postgresql"))
            # SQL read-only mode really applies on the adapter's own transaction.
            observed = []
            def readonly(connection, cursor, statement, parameters, context, executemany):
                if "FROM budget_" in statement:
                    observed.append(connection.exec_driver_sql("SHOW transaction_read_only").scalar_one())
            sa.event.listen(host_engine, "before_cursor_execute", readonly)
            try:
                assert load_scoped_budget_source(host_engine, "project-1", "wsl-qa").budget_ids == ("r38-budget-0",)
            finally:
                sa.event.remove(host_engine, "before_cursor_execute", readonly)
            assert observed == ["on", "on"]
            assert _rows(engine) == before
            # A cross-scope reservation incorrectly attached to an owned ledger
            # must close the whole snapshot; never silently drop the mismatch.
            with engine.begin() as db:
                db.execute(tables["budget_reservations"].update().where(
                    tables["budget_reservations"].c.reservation_id == "r38-res-0").values(run_id="r38-run-1"))
            mismatch_before = _rows(engine)
            assert api.get(PATH).status_code == 503 and _rows(engine) == mismatch_before
            with engine.begin() as db:
                db.execute(tables["budget_reservations"].update().where(
                    tables["budget_reservations"].c.reservation_id == "r38-res-0").values(run_id="r38-run-0"))
                db.execute(roles.update().where(roles.c.role_code == "operator").values(permissions=["provider:read"]))
            denied_before = _auth_rows(engine)
            assert api.get(PATH).status_code == 403
            assert _rows(engine) == before and _auth_rows(engine) == denied_before
            with monkeypatch.context() as patch:
                patch.setattr(host_engine, "connect", lambda: pytest.fail("foreign scope accessed DB"))
                with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
                    owner._source_loader("other-project", "wsl-qa")
        assert _rows(engine) == ((),) * len(_TABLES)
        assert _auth_rows(engine) == ((),) * len(AUTH_TABLES)
    finally:
        if host_engine is not None: host_engine.dispose()
        engine.dispose()
