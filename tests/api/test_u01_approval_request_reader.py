"""생성된 원장의 detached scoped projection, 부분 자료/상태 경계."""
from dataclasses import replace
from datetime import timedelta
import importlib.util
import pytest
import sqlalchemy as sa
from tests.persistence.test_approval_request_repository import setup_db, api, H


def test_database_observation_may_follow_http_clock_within_existing_five_second_window():
    from packages.api.scoped_dashboard import read_scoped_dashboard
    engine, command, authority, _, service = setup_db()
    class Empty:
        def load_complete(self, *args): return ()
    try:
        service.finalize_execution_plan(command, authority)
        source = reader()(engine, "project-1", "env-1")
        for delta, expected in ((-1, "AVAILABLE"), (-6, "UNAVAILABLE"), (301, "UNAVAILABLE")):
            value = read_scoped_dashboard("project-1", "env-1", "1d", source.observed_at+timedelta(seconds=delta),
                Empty(), {"approvalPending": source})
            assert value["current"]["approvalPending"]["status"] == expected
    finally: engine.dispose()


def test_existing_public_pair_guard_denies_before_approval_source_read():
    from tests.api.test_u01_scoped_dashboard_api import api as fixture, _get, PATH
    generator = fixture.__wrapped__()
    client, client_for, repository, _ = next(generator)
    reads = []
    def source(*args):
        reads.append(args)
        return {"period": {"key": args[2]}, "current": {}, "occurrences": {}, "sourceCompleteness": {}}
    scoped = client_for(source)
    try:
        assert _get(scoped, PATH + "?period=1d", actor="other").status_code == 403
        assert _get(scoped, PATH + "?period=1d", actor="no-read").status_code == 403
        assert reads == []
        assert _get(scoped, PATH + "?period=1d").status_code == 200 and len(reads) == 1
        repository.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", False)
        assert _get(scoped, PATH + "?period=1d").status_code == 403 and len(reads) == 1
    finally:
        scoped.close()
        with pytest.raises(StopIteration): next(generator)


def reader():
    assert importlib.util.find_spec("packages.persistence.operations_approval_request_read") is not None, "실제 요청 reader 미구현"
    from packages.persistence.operations_approval_request_read import load_scoped_approval_request_source
    return load_scoped_approval_request_source


def test_producer_to_scoped_read_preserves_current_population_across_periods():
    engine, command, authority, _, service = setup_db()
    try:
        receipt = service.finalize_execution_plan(command, authority)
        source = reader()(engine, "project-1", "env-1")
        assert len(source.items) == 1 and source.items[0].request_id == receipt.request_id
        from packages.api.scoped_dashboard import read_scoped_dashboard
        class EmptyAudit:
            def load_complete(self, project_id, environment_id): return ()
        for period in ("1d", "7d", "30d"):
            result = read_scoped_dashboard("project-1", "env-1", period, source.observed_at,
                EmptyAudit(), {"approvalPending": source})
            metric = result["current"]["approvalPending"]
            assert metric["status"] == "AVAILABLE" and metric["count"] == 1
            assert metric["source"] == "approval_request_ledger"
            assert set(metric["items"][0]) == {"requestId", "taskId", "runId", "requestKind", "planId", "planHash", "requestedAt", "expiresAt"}
            assert result["sourceCompleteness"]["current"]["approvalPending"]["eventTimeBasis"] == "CURRENT_OBSERVATION"
        assert reader()(engine, "project-1", "foreign").items == ()
    finally: engine.dispose()


def test_exact_human_plan_and_mode_approvals_only_satisfy_without_writes():
    engine, command, authority, _, service = setup_db()
    try:
        receipt = service.finalize_execution_plan(command, authority)
        for n, (kind, subject, seal) in enumerate((("EXECUTION_PLAN", command.plan.plan_id, command.plan.content_hash),
                                                 ("EXECUTION_MODE", command.mode.snapshot_id, command.mode.content_hash))):
            with engine.begin() as c:
                c.execute(sa.text("INSERT INTO approval_records VALUES (:id,:kind,:subject,:hash,true,'ACTIVE',:now,:expires)"),
                    dict(id=str(n),kind=kind,subject=subject,hash=seal,now=receipt.requested_at,expires=receipt.expires_at))
            source = reader()(engine, "project-1", "env-1")
            assert len(source.items) == (1 if n == 0 else 0)
        with engine.connect() as c:
            assert c.exec_driver_sql("SELECT count(*) FROM runs").scalar_one() == 0
            assert c.exec_driver_sql("SELECT count(*) FROM approval_request_events").scalar_one() == 1
    finally: engine.dispose()


@pytest.mark.parametrize("sql", ["DELETE FROM approval_request_events", "UPDATE approval_requests SET plan_hash='bad'",
    "UPDATE tasks SET target_environment='foreign'", "DELETE FROM work_instructions",
    "UPDATE approval_requests SET mode_snapshot='{}'"])
def test_incomplete_or_corrupt_source_is_unavailable_not_zero(sql):
    engine, command, authority, _, service = setup_db()
    try:
        service.finalize_execution_plan(command, authority)
        with engine.begin() as c: c.exec_driver_sql(sql)
        with pytest.raises(ValueError, match="APPROVAL_SOURCE_UNAVAILABLE"):
            reader()(engine, "project-1", "env-1")
    finally: engine.dispose()


@pytest.mark.parametrize("current", [0, 2, 101])
def test_current_limit_does_not_count_105_terminal_or_expired_rows(current):
    engine, command, authority, registrar, service = setup_db()
    _, repo = api()
    try:
        receipt = service.finalize_execution_plan(command, authority)
        repo.ApprovalRequestRepository(engine).cancel(command, authority, receipt.request_id)
        with engine.begin() as c:
            archived = dict(c.execute(sa.select(repo.approval_requests)).mappings().one())
            for n in range(105):
                row = dict(archived, request_id=f"archived-{n}", idempotency_key=f"archived-{n}")
                if n % 2:
                    row.update(status="PENDING", task_id=f"expired-{n}",
                        requested_at=receipt.requested_at-timedelta(days=2), expires_at=receipt.expires_at-timedelta(days=2))
                c.execute(repo.approval_requests.insert().values(**row))
        for n in range(current):
            with engine.begin() as c:
                c.execute(sa.text("INSERT INTO tasks SELECT :id,project_id,repository_id,target_environment FROM tasks WHERE task_id='task-1'"), {"id": f"current-{n}"})
            cmd = replace(command, task_id=f"current-{n}", idempotency_key=f"current-{n}")
            auth = registrar.issue(cmd, authority_event_hash=H)
            service.finalize_execution_plan(cmd, auth)
        if current > 100:
            with pytest.raises(ValueError, match="APPROVAL_SOURCE_UNAVAILABLE"):
                reader()(engine, "project-1", "env-1")
        else:
            assert len(reader()(engine, "project-1", "env-1").items) == current
            if current:
                with engine.begin() as c:
                    c.execute(repo.approval_request_events.delete().where(repo.approval_request_events.c.request_id ==
                        sa.select(repo.approval_requests.c.request_id).where(repo.approval_requests.c.task_id == "current-1").scalar_subquery()))
                with pytest.raises(ValueError, match="APPROVAL_SOURCE_UNAVAILABLE"):
                    reader()(engine, "project-1", "env-1")
    finally: engine.dispose()


@pytest.mark.parametrize("kind", ["SATISFIED", "INVALIDATED"])
def test_classification_precedes_pending_limit_and_late_corruption_is_not_a_partial_zero(kind):
    engine, command, _, registrar, service = setup_db()
    _, repo = api()
    try:
        for n in range(102):
            with engine.begin() as c:
                c.execute(sa.text("INSERT INTO tasks SELECT :id,project_id,repository_id,target_environment FROM tasks WHERE task_id='task-1'"), {"id": f"resolved-{n}"})
            cmd = replace(command, task_id=f"resolved-{n}", idempotency_key=f"resolved-{n}")
            receipt = service.finalize_execution_plan(cmd, registrar.issue(cmd, authority_event_hash=H))
        with engine.begin() as c:
            if kind == "SATISFIED":
                for n, (approval, subject, seal) in enumerate((("EXECUTION_PLAN", command.plan.plan_id, command.plan.content_hash),
                        ("EXECUTION_MODE", command.mode.snapshot_id, command.mode.content_hash))):
                    c.execute(sa.text("INSERT INTO approval_records VALUES (:id,:kind,:subject,:hash,true,'ACTIVE',:now,:expires)"),
                        dict(id=str(n), kind=approval, subject=subject, hash=seal, now=receipt.requested_at, expires=receipt.expires_at))
            else:
                c.exec_driver_sql("UPDATE execution_plans SET status='RETIRED'")
        source = reader()(engine, "project-1", "env-1")
        assert source.items == () and len(source.states) == 102
        assert {state for _, state in source.states} == {kind}
        with engine.begin() as c:
            last = c.execute(sa.select(repo.approval_requests.c.request_id).order_by(repo.approval_requests.c.request_id.desc()).limit(1)).scalar_one()
            c.execute(repo.approval_request_events.delete().where(repo.approval_request_events.c.request_id == last))
        with pytest.raises(ValueError, match="APPROVAL_SOURCE_UNAVAILABLE"):
            reader()(engine, "project-1", "env-1")
    finally: engine.dispose()
