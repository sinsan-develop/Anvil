"""Main 소유 전용 PG15 opt-in. 운영/공유 DB와 실제 사람 승인 증거가 아니다."""
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta
from pathlib import Path
import threading
import time

import pytest
import sqlalchemy as sa


def _target(environment):
    dsn, flag = environment.get("ANVIL_U01_C20_PG_DSN"), environment.get("ANVIL_U01_C20_PG_ISOLATED")
    if dsn is None and flag is None:
        pytest.skip("C20 전용 PG15 미구성; Main 실제 QA 전까지 NOT_EXECUTED")
    try:
        url = sa.engine.make_url(dsn)
        valid = (flag == "1" and url.drivername == "postgresql+psycopg"
            and url.host == "127.0.0.1" and url.port == 5554
            and url.username == url.database == "anvil_u01_c20" and not url.query)
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid: raise ValueError("C20_PG_TARGET_REJECTED") from None
    return url


@pytest.mark.parametrize("dsn,flag", [(None, "1"), ("sqlite://", "1"),
    ("postgresql+psycopg://anvil_u01_c20@127.0.0.1:5554/anvil_u01_c20", "0"),
    ("postgresql+psycopg://anvil_u01_c20@localhost:5554/anvil_u01_c20", "1"),
    ("postgresql+psycopg://anvil_u01_c20@127.0.0.1:5432/anvil_u01_c20", "1"),
    ("postgresql+psycopg://other@127.0.0.1:5554/anvil_u01_c20", "1"),
    ("postgresql+psycopg://anvil_u01_c20@127.0.0.1:5554/shared", "1"),
    ("postgresql+psycopg://anvil_u01_c20@127.0.0.1:5554/anvil_u01_c20?x=bad", "1")])
def test_optin_denies_unregistered_target_before_engine(dsn, flag, monkeypatch):
    monkeypatch.setattr(sa, "create_engine", lambda *a, **k: pytest.fail("DB 연결 금지"))
    with pytest.raises(ValueError, match="^C20_PG_TARGET_REJECTED$"):
        _target({"ANVIL_U01_C20_PG_DSN": dsn, "ANVIL_U01_C20_PG_ISOLATED": flag})


def test_optin_exact_target_and_missing_optin_are_not_database_pass():
    with pytest.raises(pytest.skip.Exception): _target({})
    url = _target({"ANVIL_U01_C20_PG_DSN":
        "postgresql+psycopg://anvil_u01_c20:synthetic@127.0.0.1:5554/anvil_u01_c20",
        "ANVIL_U01_C20_PG_ISOLATED": "1"})
    assert url.database == "anvil_u01_c20" and "synthetic" not in repr(url)


def _seed(engine):
    """격리 DB에만 상위 계획/Task fixture. 요청·권위·감사는 실제 producer가 생성."""
    from sqlalchemy.orm import sessionmaker
    from packages.persistence.f19a_registration_repository import F19ARegistrationRepository
    from packages.persistence.oidc_principal_directory import users, roles, user_roles
    from tests.persistence.test_approval_request_repository import plan, H
    from packages.planning.approval_requests import FinalizeExecutionPlan, ExecutionModeSnapshot
    with engine.begin() as c:
        c.execute(users.insert(), [{"actor_id": actor, "active": True} for actor in ("c20-admin", "c20-reader", "c20-denied")])
        c.execute(roles.insert(), [{"role_code": "c20-admin", "permissions": ["projects:register", "pair-grants:manage"]},
            {"role_code": "c20-reader", "permissions": ["dashboard:read"]}])
        c.execute(user_roles.insert(), [{"actor_id": actor, "role_code": role, "project_id": "host",
            "environment_id": "env-1", "step_up_required": False, "active": True}
            for actor, role in (("c20-admin", "c20-admin"), ("c20-reader", "c20-reader"), ("c20-denied", "c20-reader"))])
    registration = F19ARegistrationRepository(sessionmaker(bind=engine, expire_on_commit=False))
    registration.register_project("c20-admin", "project-1", "C20 격리 계획")
    registration.register_environment("c20-admin", "project-1", "env-1", "C20 격리 환경")
    registration.set_pair_grant("c20-admin", "c20-reader", "project-1", "env-1", "dashboard:read", True)
    p = plan()
    md = sa.MetaData()
    names = ("project_repositories", "tasks", "design_baselines", "work_plans", "iteration_plans", "work_instructions")
    tables = {name: sa.Table(name, md, autoload_with=engine) for name in names}
    with engine.begin() as c:
        c.execute(tables["project_repositories"].insert().values(project_id="project-1", repository_id="repo-1",
            target_environment="env-1", active=True, version=1))
        for task in ("task-1", "task-lock", "task-fault"):
            c.execute(tables["tasks"].insert().values(task_id=task, project_id="project-1", repository_id="repo-1",
                title="C20 격리", objective="승인 요청 계약", requested_by="c20-reader", status="CONFIRMED",
                target_environment="env-1", repository_mapping_version=1, conversation_message="QA",
                idempotency_key=task, creation_request_hash=H))
        c.execute(tables["design_baselines"].insert().values(artifact_id="baseline-1", revision=1, content_hash=H,
            actor_type="HUMAN", actor_id="c20-fixture", specification_id="c20-spec", root_human_approval_id="c20-fixture-approval",
            approval_mode="HUMAN", scope=["feature"], project_id="project-1"))
        c.execute(tables["work_plans"].insert().values(artifact_id=p.work_plan_id, revision=1, content_hash=p.work_plan_hash,
            design_baseline_id="baseline-1", design_baseline_hash=H, scope=["feature"]))
        ip, wi = p.source_iteration_plan, p.source_work_instruction
        c.execute(tables["iteration_plans"].insert().values(artifact_id=ip.artifact_id, revision=1,
            content_hash=ip.content_hash, work_plan_id=p.work_plan_id, work_plan_hash=p.work_plan_hash, sequence=1))
        c.execute(tables["work_instructions"].insert().values(artifact_id=wi.artifact_id, revision=1,
            content_hash=wi.content_hash, iteration_plan_id=ip.artifact_id, iteration_plan_hash=ip.content_hash,
            allowed_paths=list(wi.allowed_paths), allowed_actions=list(wi.allowed_actions), completion_conditions=list(wi.completion_conditions)))
    return FinalizeExecutionPlan("task-1", "project-1", "env-1", p,
        ExecutionModeSnapshot("mode-1", "controlled"), "key-1"), registration


def _get_actual_route(engine, registration, receipt):
    """실제 FastAPI/F19A 인가+PG reader. 외부 OIDC login/브라우저 증거는 아님."""
    from fastapi.testclient import TestClient
    from packages.api.common import SessionPrincipal
    from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
    from packages.api.scoped_dashboard import read_scoped_dashboard
    from packages.persistence.operations_approval_request_read import load_scoped_approval_request_source
    class EmptyAudit:
        def load_complete(self, *args): return ()
    calls = []
    def reader(project, env, period, at):
        calls.append((project, env))
        source = load_scoped_approval_request_source(engine, project, env)
        return read_scoped_dashboard(project, env, period, at, EmptyAudit(), {"approvalPending": source})
    def authenticate(token):
        if token not in {"c20-reader", "c20-denied"}: return None
        return SessionPrincipal(token, "reader", "synthetic-csrf", frozenset({"dashboard:read"}),
            frozenset({"project-1"}), frozenset({"env-1"}))
    app = create_app(ports=ApiPorts(), authenticate=authenticate, registration_repository=registration,
        scoped_dashboard_reader=reader, f19a_pair_guard_required=True,
        authorization_resolver=lambda *_: AuthorizationScope("project-1", "env-1", frozenset({"reader"})))
    path = "/api/projects/project-1/environments/env-1/dashboard"
    with TestClient(app, base_url="https://anvil.local") as client:
        client.cookies.set("anvil_session", "c20-denied")
        assert client.get(path + "?period=1d").status_code == 403 and calls == []
        client.cookies.set("anvil_session", "c20-reader")
        for period in ("1d", "7d", "30d"):
            response = client.get(path + "?period=" + period)
            assert response.status_code == 200
            metric = response.json()["data"]["current"]["approvalPending"]
            assert metric["count"] == 1 and metric["items"][0]["requestId"] == receipt.request_id
            assert metric["items"][0]["runId"] is None
        before = len(calls)
        registration.set_pair_grant("c20-admin", "c20-reader", "project-1", "env-1", "dashboard:read", False)
        assert client.get(path + "?period=1d").status_code == 403 and len(calls) == before


def test_real_pg15_migration_producer_concurrency_lock_expiry_atomicity_and_read(monkeypatch):
    from alembic import command as migration
    from alembic.config import Config
    from packages.persistence import approval_request_repository as r
    from packages.persistence.operations_approval_request_read import load_scoped_approval_request_source
    from packages.planning.approval_requests import ApprovalRequestService
    from tests.persistence.test_approval_request_repository import H, counts, plan
    url = _target(os.environ)
    engine = sa.create_engine(url, connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"})
    try:
        with engine.connect() as c:
            assert int(c.exec_driver_sql("SHOW server_version_num").scalar_one()) // 10000 == 15
            assert c.exec_driver_sql("SELECT current_database()").scalar_one() == "anvil_u01_c20"
            assert not c.exec_driver_sql("SELECT rolsuper FROM pg_roles WHERE rolname=current_user").scalar_one()
            assert c.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "0020_f19a_pair_grants"
            for name in ("tasks", "runs", "execution_plans", "work_instructions", "registered_projects", "users"):
                assert c.exec_driver_sql(f"SELECT count(*) FROM {name}").scalar_one() == 0, "C20_PG_NOT_EMPTY"
        root = Path(__file__).resolve().parents[2]
        config = Config(str(root / "alembic.ini"))
        config.set_main_option("script_location", str(root / "migrations"))
        with monkeypatch.context() as patch:
            patch.setenv("ANVIL_DATABASE_URL", url.render_as_string(hide_password=False))
            migration.upgrade(config, "0021_approval_requests")
        command, registration = _seed(engine)
        registrar = r.TaskPlanningAuthorityRegistrar(engine)
        service = ApprovalRequestService(r.ApprovalRequestRepository(engine))
        authority = registrar.issue(command, authority_event_hash=H)
        with ThreadPoolExecutor(max_workers=8) as workers:
            receipts = list(workers.map(lambda _: service.finalize_execution_plan(command, authority), range(8)))
        assert len({item.request_id for item in receipts}) == 1 and counts(engine) == (1, 1, 1)
        _get_actual_route(engine, registration, receipts[0])
        assert counts(engine) == (1, 1, 1)
        # DB trigger로 두 감사 테이블의 UPDATE/DELETE 불변성.
        for name in ("approval_request_events", "task_planning_authority_events"):
            for verb in ("UPDATE", "DELETE"):
                with pytest.raises(sa.exc.DBAPIError):
                    with engine.begin() as c:
                        c.exec_driver_sql(f"UPDATE {name} SET sequence=sequence" if verb == "UPDATE" else f"DELETE FROM {name}")
        fault_command = replace(command, task_id="task-fault", plan=plan("plan-fault"), idempotency_key="fault")
        fault_auth = registrar.issue(fault_command, authority_event_hash=H)
        audit = r._audit
        def failed_audit(c, table, *args):
            if table.name == "approval_request_events": raise RuntimeError("INJECTED_AUDIT_FAULT")
            return audit(c, table, *args)
        with monkeypatch.context() as patch:
            patch.setattr(r, "_audit", failed_audit)
            with pytest.raises(RuntimeError, match="INJECTED_AUDIT_FAULT"):
                service.finalize_execution_plan(fault_command, fault_auth)
        assert counts(engine) == (1, 1, 1)
        # 실제 Task 잠금 대기 중 권위 만료. fixture 발급시각만 3597초 이전,
        # 생산 호출은 실제 clock_timestamp를 사용하고 대기 후 재검증한다.
        lock_command = replace(command, task_id="task-lock", idempotency_key="lock")
        clock = r.db_time
        with monkeypatch.context() as patch:
            patch.setattr(r, "db_time", lambda c: clock(c) - timedelta(seconds=3597))
            lock_auth = registrar.issue(lock_command, authority_event_hash=H)
        with engine.connect() as c:
            expires = c.execute(sa.select(r.task_planning_authorities.c.expires_at).where(
                r.task_planning_authorities.c.authority_id == lock_auth.authority_id)).scalar_one()
        reached = threading.Event()
        def before_cursor(c, cursor, statement, parameters, context, many):
            if threading.current_thread().name.startswith("c20-lock") and "FOR UPDATE" in statement:
                reached.set()
        sa.event.listen(engine, "before_cursor_execute", before_cursor)
        blocker = engine.connect(); transaction = blocker.begin()
        pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="c20-lock")
        try:
            blocker.execute(sa.text("SELECT task_id FROM tasks WHERE task_id='task-lock' FOR UPDATE"))
            future = pool.submit(service.finalize_execution_plan, lock_command, lock_auth)
            assert reached.wait(5)
            with engine.connect() as monitor:
                deadline = time.monotonic() + 6
                while time.monotonic() < deadline:
                    waiting = monitor.exec_driver_sql("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'").scalar_one()
                    monitor.commit()
                    if waiting: break
                    time.sleep(.05)
                assert waiting > 0 and not future.done()
                while clock(monitor) < expires:
                    assert time.monotonic() < deadline
                    monitor.commit(); time.sleep(.05)
            transaction.commit()
            with pytest.raises(ValueError, match="AUTHORITY_DENIED"): future.result(timeout=8)
        finally:
            if transaction.is_active: transaction.rollback()
            blocker.close(); pool.shutdown(wait=True)
            sa.event.remove(engine, "before_cursor_execute", before_cursor)
        assert counts(engine) == (1, 1, 1)
        registrar.revoke(authority.authority_id, authority_event_hash=H)
        with pytest.raises(ValueError, match="AUTHORITY_DENIED"):
            service.finalize_execution_plan(command, authority)
        source = load_scoped_approval_request_source(engine, "project-1", "env-1")
        assert source.items == () and source.states == ((receipts[0].request_id, "INVALIDATED"),)
        with engine.connect() as c:
            assert c.exec_driver_sql("SELECT count(*) FROM runs").scalar_one() == 0
            assert c.exec_driver_sql("SELECT count(*) FROM approval_records").scalar_one() == 0
            assert c.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "0021_approval_requests"
        # append-only 감사를 지우지 않는다. Main이 등록한 전용 DB 전체 수명으로 정리.
    finally:
        engine.dispose()
