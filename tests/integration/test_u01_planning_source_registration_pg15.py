"""Main 전용0021/빈 PG15: source seed 없이 실제 등록→Task→C20 요청→인가GET.

외부 OIDC/Provider/브라우저 검증이 아니다. 감사 보존을 위해 개별 row를
지우지 않으며 Main이 등록한 일회 DB 수명을 끝내는 방식으로 정리한다.
"""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta, timezone
from hashlib import sha256
import os
import threading
import time

import pytest
import sqlalchemy as sa


def _target(environment):
    dsn, flag = environment.get("ANVIL_U01_C21_PG_DSN"), environment.get("ANVIL_U01_C21_PG_ISOLATED")
    if dsn is None and flag is None: pytest.skip("C21 격리 PG15 미구성; 실제 등록/DB 잠금 NOT_EXECUTED")
    try:
        url = sa.engine.make_url(dsn)
        valid = (flag == "1" and url.drivername == "postgresql+psycopg"
            and url.host == "127.0.0.1" and url.port == 5555
            and url.username == url.database == "anvil_u01_c21" and not url.query)
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError): valid = False
    if not valid: raise ValueError("C21_PG_TARGET_REJECTED") from None
    return url


@pytest.mark.parametrize("dsn,flag", [(None, "1"), ("sqlite://", "1"),
    ("postgresql+psycopg://anvil_u01_c21@127.0.0.1:5555/anvil_u01_c21", "0"),
    ("postgresql+psycopg://anvil_u01_c21@localhost:5555/anvil_u01_c21", "1"),
    ("postgresql+psycopg://anvil_u01_c21@127.0.0.1:5432/anvil_u01_c21", "1"),
    ("postgresql+psycopg://other@127.0.0.1:5555/anvil_u01_c21", "1"),
    ("postgresql+psycopg://anvil_u01_c21@127.0.0.1:5555/shared", "1"),
    ("postgresql+psycopg://anvil_u01_c21@127.0.0.1:5555/anvil_u01_c21?x=bad", "1")])
def test_target_rejects_before_connection(dsn, flag, monkeypatch):
    monkeypatch.setattr(sa, "create_engine", lambda *a, **k: pytest.fail("연결0"))
    with pytest.raises(ValueError, match="^C21_PG_TARGET_REJECTED$"):
        _target({"ANVIL_U01_C21_PG_DSN": dsn, "ANVIL_U01_C21_PG_ISOLATED": flag})


def test_target_optin_not_database_evidence():
    with pytest.raises(pytest.skip.Exception): _target({})
    assert _target({"ANVIL_U01_C21_PG_DSN": "postgresql+psycopg://anvil_u01_c21@127.0.0.1:5555/anvil_u01_c21",
        "ANVIL_U01_C21_PG_ISOLATED": "1"}).database == "anvil_u01_c21"


def _pair(engine):
    # 정상 registry port용 합성 로그인/등록 관리자만 격리DB에 공급한다.
    # baseline/WorkPlan/Iteration/WI/mapping/Task/요청 직접 INSERT0.
    import packages.api
    from sqlalchemy.orm import sessionmaker
    from packages.persistence.oidc_principal_directory import users, roles, user_roles
    from packages.persistence.f19a_registration_repository import F19ARegistrationRepository
    from packages.planning.source_registration import PROJECT, ENVIRONMENT
    with engine.begin() as c:
        c.execute(users.insert(), [{"actor_id": actor, "active": True} for actor in ("c21-admin", "c21-reader", "c21-denied")])
        c.execute(roles.insert(), [{"role_code": "c21-admin", "permissions": ["projects:register", "pair-grants:manage"]},
            {"role_code": "c21-reader", "permissions": ["dashboard:read"]}])
        c.execute(user_roles.insert(), [{"actor_id": actor, "role_code": role, "project_id": "host", "environment_id": "host",
            "step_up_required": False, "active": True} for actor, role in
            (("c21-admin", "c21-admin"), ("c21-reader", "c21-reader"), ("c21-denied", "c21-reader"))])
    repo = F19ARegistrationRepository(sessionmaker(bind=engine, expire_on_commit=False))
    repo.register_project("c21-admin", PROJECT, "C21 격리 등록 검증")
    repo.register_environment("c21-admin", PROJECT, ENVIRONMENT, "C21 격리 환경")
    repo.set_pair_grant("c21-admin", "c21-reader", PROJECT, ENVIRONMENT, "dashboard:read", True)
    return repo


def _actual_get(engine, registration, receipt):
    from fastapi.testclient import TestClient
    from packages.api.common import SessionPrincipal
    from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
    from packages.api.scoped_dashboard import read_scoped_dashboard
    from packages.persistence.operations_approval_request_read import load_scoped_approval_request_source
    from packages.planning.source_registration import PROJECT, ENVIRONMENT
    class Audit:
        def load_complete(self, *args): return ()
    calls = []
    def reader(project, env, period, at):
        calls.append((project, env))
        return read_scoped_dashboard(project, env, period, at, Audit(),
            {"approvalPending": load_scoped_approval_request_source(engine, project, env)})
    def authenticate(token):
        if token not in {"c21-reader", "c21-denied"}: return None
        return SessionPrincipal(token, "reader", "synthetic", frozenset({"dashboard:read"}),
            frozenset({PROJECT}), frozenset({ENVIRONMENT}))
    app = create_app(ports=ApiPorts(), authenticate=authenticate, registration_repository=registration,
        scoped_dashboard_reader=reader, f19a_pair_guard_required=True,
        authorization_resolver=lambda *_: AuthorizationScope(PROJECT, ENVIRONMENT, frozenset({"reader"})))
    path = f"/api/projects/{PROJECT}/environments/{ENVIRONMENT}/dashboard"
    with TestClient(app, base_url="https://anvil.local") as client:
        client.cookies.set("anvil_session", "c21-denied")
        assert client.get(path + "?period=1d").status_code == 403 and calls == []
        client.cookies.set("anvil_session", "c21-reader")
        for period in ("1d", "7d", "30d"):
            response = client.get(path + "?period=" + period)
            assert response.status_code == 200
            card = response.json()["data"]["current"]["approvalPending"]
            assert card["count"] == 1 and card["items"][0]["requestId"] == receipt.request_id
            assert card["items"][0]["taskId"] == receipt.task_id and card["items"][0]["runId"] is None
            assert "capability" not in response.text and "source_refs" not in response.text


def test_real_pg15_source_task_request_get_rollback_revoke_and_wait_expiry(monkeypatch):
    url = _target(os.environ)
    import packages.api  # 실제 API bootstrap 순서; 저장소 직접 import의 baseline 순환 회피.
    from packages.planning import source_registration as s
    from packages.persistence import planning_source_repository as r
    from packages.persistence.approval_request_repository import TaskPlanningAuthorityRegistrar, ApprovalRequestRepository
    from packages.planning.approval_requests import ApprovalRequestService
    from tests.persistence.test_planning_source_repository import inputs
    engine = sa.create_engine(url, connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"})
    try:
        with engine.connect() as c:
            assert int(c.exec_driver_sql("SHOW server_version_num").scalar_one()) // 10000 == 15
            assert c.exec_driver_sql("SELECT current_database()").scalar_one() == "anvil_u01_c21"
            assert not c.exec_driver_sql("SELECT rolsuper FROM pg_roles WHERE rolname=current_user").scalar_one()
            assert c.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "0021_approval_requests"
            for name in ("tasks", "runs", "design_artifacts", "design_baselines", "work_plans", "iteration_plans",
                    "work_instructions", "execution_plans", "approval_records", "approval_requests", "registered_projects", "users"):
                assert c.exec_driver_sql(f"SELECT count(*) FROM {name}").scalar_one() == 0, "C21_PG_NOT_EMPTY"
        registration = _pair(engine)
        with engine.connect() as c: at = r._db_time(c)
        p, command, sources = inputs("c21-optin-source", at)
        registrar = s.PlanningSourceRegistrar(r.PlanningSourceRepository(engine))
        service = s.PlanningSourceRegistrationService(r.PlanningSourceRepository(engine))
        grant = registrar.issue(p, command, sources)
        source_receipt = service.register(p, command, sources, grant)
        assert service.register(p, command, sources, grant) == source_receipt
        authority = TaskPlanningAuthorityRegistrar(engine).issue(command, authority_event_hash=s.digest({"registration_receipt": source_receipt.receipt_id}))
        producer = ApprovalRequestService(ApprovalRequestRepository(engine))
        receipt = producer.finalize_execution_plan(command, authority)
        assert producer.finalize_execution_plan(command, authority) == receipt
        _actual_get(engine, registration, receipt)
        with engine.connect() as c:
            for name in ("tasks", "approval_requests", "approval_request_events", "execution_plans"):
                assert c.exec_driver_sql(f"SELECT count(*) FROM {name}").scalar_one() == 1
            assert c.exec_driver_sql("SELECT status FROM tasks").scalar_one() == "DRAFT"
            assert c.exec_driver_sql("SELECT count(*) FROM runs").scalar_one() == 0
            assert c.exec_driver_sql("SELECT count(*) FROM approval_records").scalar_one() == 0
            assert c.exec_driver_sql("SELECT actor_type FROM design_baselines").scalar_one() == "agent"
        registrar.revoke(p, grant)
        with pytest.raises(ValueError, match="SOURCE_GRANT_REVOKED"): service.register(p, command, sources, grant)
        # receipt 직전 실패는 실제 Task 및 계보와 동일 transaction rollback.
        with engine.connect() as c: at = r._db_time(c)
        fp, fc, fs = inputs("c21-optin-fault", at)
        fg = registrar.issue(fp, fc, fs)
        original = r._append
        def fault(c, *args, **kwargs):
            if args[1] == "PLANNING_SOURCE_REGISTERED": raise RuntimeError("C21_RECEIPT_FAULT")
            return original(c, *args, **kwargs)
        with monkeypatch.context() as patch:
            patch.setattr(r, "_append", fault)
            with pytest.raises(RuntimeError, match="C21_RECEIPT_FAULT"): service.register(fp, fc, fs, fg)
        with engine.connect() as c:
            assert c.exec_driver_sql("SELECT count(*) FROM tasks").scalar_one() == 1
            assert c.exec_driver_sql("SELECT count(*) FROM design_baselines").scalar_one() == 1
        registrar.revoke(fp, fg)
        # advisory lock 대기 후 wall clock으로 만료 판단 (트랜잭션 시작시각 금지).
        with engine.connect() as c: at = r._db_time(c)
        lp, lc, ls = inputs("c21-optin-lock", at)
        lp = replace(lp, expires_at=at + timedelta(seconds=3))
        lg = registrar.issue(lp, lc, ls)
        blocker = engine.connect(); transaction = blocker.begin()
        reached = threading.Event()
        def before(c, cursor, statement, parameters, context, many):
            if threading.current_thread().name.startswith("c21-lock") and "pg_advisory_xact_lock" in statement: reached.set()
        sa.event.listen(engine, "before_cursor_execute", before)
        pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="c21-lock")
        try:
            key = int.from_bytes(sha256(lp.project_id.encode()).digest()[:8], "big", signed=True)
            blocker.execute(sa.text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})
            future = pool.submit(service.register, lp, lc, ls, lg)
            assert reached.wait(5) and not future.done()
            with engine.connect() as monitor:
                deadline = time.monotonic() + 8
                while r._db_time(monitor) < lp.expires_at:
                    assert time.monotonic() < deadline
                    monitor.commit(); time.sleep(.05)
                assert monitor.exec_driver_sql("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'").scalar_one() >= 1
            transaction.commit()
            with pytest.raises(ValueError, match="SOURCE_GRANT_EXPIRED"): future.result(timeout=8)
        finally:
            if transaction.is_active: transaction.rollback()
            blocker.close(); pool.shutdown(wait=True); sa.event.remove(engine, "before_cursor_execute", before)
        registrar.revoke(lp, lg)
        with engine.connect() as c:
            assert c.exec_driver_sql("SELECT count(*) FROM tasks").scalar_one() == 1
            assert c.exec_driver_sql("SELECT count(*) FROM approval_requests").scalar_one() == 1
    finally: engine.dispose()
