"""실제 typed 계획과 로컬 transaction을 사용한 승인 요청 계약."""
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import importlib.util
import pytest
import sqlalchemy as sa
from sqlalchemy.pool import StaticPool

from packages.planning.planner import (analyze_request, ExecutionStep, StepKind,
    build_execution_plan, generate_work_instruction)
from packages.planning.models import WorkPlan, IterationPlan

H = "sha256:" + "a" * 64
NOW = datetime(2026, 10, 14, tzinfo=timezone.utc)


def api():
    assert importlib.util.find_spec("packages.planning.approval_requests") is not None, "계획 확정 producer 미구현"
    from packages.planning import approval_requests as a
    from packages.persistence import approval_request_repository as r
    return a, r


def plan(plan_id="plan-1"):
    analysis = analyze_request("analysis-1", "검증된 계획", scope=("feature",),
        completion_conditions=("tests",), allowed_paths=("src",),
        prohibited_actions=("network", "secret"), risk=("low",),
        baseline_hash=H, egress_snapshot_hash=H)
    work = WorkPlan.create(artifact_id="work-1", revision=1, design_baseline_id="baseline-1",
        design_baseline_hash=H, scope=frozenset({"feature"}), created_at=NOW)
    iteration = IterationPlan.create(artifact_id="iteration-1", revision=1,
        work_plan=work, sequence=1, created_at=NOW)
    wi = generate_work_instruction(iteration, analysis=analysis, allowed_actions=("read",),
        validation_contract=("tests",), created_at=NOW)
    return build_execution_plan(analysis, (ExecutionStep("step-1", StepKind.READ, "확인", (),
        ("src",), ("tests",), egress_snapshot_hash=H),), plan_id=plan_id,
        permission_snapshot_hash=H, created_at=NOW, work_plan=work,
        source_work_instruction=wi, source_iteration_plan=iteration)


def setup_db():
    a, r = api()
    engine = sa.create_engine("sqlite://", poolclass=StaticPool)
    # 기존 테이블의 실제 소비 열만 사용하는 로컬 DB. PG migration 증거 아님.
    schema = {
        "tasks": "task_id TEXT PRIMARY KEY, project_id TEXT, repository_id TEXT, target_environment TEXT",
        "project_repositories": "project_id TEXT PRIMARY KEY, repository_id TEXT, target_environment TEXT, active BOOLEAN",
        "registered_projects": "project_id TEXT PRIMARY KEY, active BOOLEAN",
        "registered_environments": "project_id TEXT, environment_id TEXT, active BOOLEAN",
        "design_baselines": "artifact_id TEXT PRIMARY KEY, content_hash TEXT, project_id TEXT",
        "work_plans": "artifact_id TEXT PRIMARY KEY, content_hash TEXT, design_baseline_id TEXT, design_baseline_hash TEXT",
        "iteration_plans": "artifact_id TEXT PRIMARY KEY, content_hash TEXT, work_plan_id TEXT, work_plan_hash TEXT",
        "work_instructions": "artifact_id TEXT PRIMARY KEY, content_hash TEXT, iteration_plan_id TEXT, iteration_plan_hash TEXT, allowed_paths JSON, allowed_actions JSON, completion_conditions JSON",
        "execution_plans": "plan_id TEXT PRIMARY KEY, plan_hash TEXT, source_work_instruction_id TEXT, source_work_instruction_hash TEXT, baseline_analysis_hash TEXT, impact_analysis_hash TEXT, status TEXT, created_at TIMESTAMP",
        "approval_records": "approval_id TEXT PRIMARY KEY, approval_type TEXT, subject_id TEXT, subject_hash TEXT, authenticated_human BOOLEAN, status TEXT, approved_at TIMESTAMP, expires_at TIMESTAMP",
        "runs": "run_id TEXT PRIMARY KEY, task_id TEXT, environment_id TEXT",
        "worker_leases": "worker_lease_id TEXT PRIMARY KEY, run_id TEXT, worker_id TEXT, lease_epoch INTEGER, execution_fencing_token TEXT, issued_at TIMESTAMP, expires_at TIMESTAMP",
    }
    with engine.begin() as c:
        for name, columns in schema.items():
            c.exec_driver_sql(f"CREATE TABLE {name} ({columns})")
    r.LEDGER_METADATA.create_all(engine)
    p = plan()
    import json
    rows = {
        "tasks": dict(task_id="task-1", project_id="project-1", repository_id="repo-1", target_environment="env-1"),
        "project_repositories": dict(project_id="project-1", repository_id="repo-1", target_environment="env-1", active=True),
        "registered_projects": dict(project_id="project-1", active=True),
        "registered_environments": dict(project_id="project-1", environment_id="env-1", active=True),
        "design_baselines": dict(artifact_id="baseline-1", content_hash=H, project_id="project-1"),
        "work_plans": dict(artifact_id=p.work_plan_id, content_hash=p.work_plan_hash, design_baseline_id="baseline-1", design_baseline_hash=H),
        "iteration_plans": dict(artifact_id=p.source_iteration_plan.artifact_id, content_hash=p.source_iteration_plan.content_hash, work_plan_id=p.work_plan_id, work_plan_hash=p.work_plan_hash),
        "work_instructions": dict(artifact_id=p.source_work_instruction_id, content_hash=p.source_work_instruction_hash,
            iteration_plan_id=p.source_iteration_plan.artifact_id, iteration_plan_hash=p.source_iteration_plan.content_hash,
            allowed_paths=json.dumps(["src"]), allowed_actions=json.dumps(["read"]), completion_conditions=json.dumps(["tests"])),
    }
    with engine.begin() as c:
        for name, row in rows.items():
            c.execute(sa.text(f"INSERT INTO {name} ({','.join(row)}) VALUES ({','.join(':'+k for k in row)})"), row)
    command = a.FinalizeExecutionPlan("task-1", "project-1", "env-1", p,
        a.ExecutionModeSnapshot("mode-1", "controlled"), "key-1")
    registrar = r.TaskPlanningAuthorityRegistrar(engine)
    authority = registrar.issue(command, authority_event_hash=H)
    service = a.ApprovalRequestService(r.ApprovalRequestRepository(engine))
    return engine, command, authority, registrar, service


def counts(engine):
    with engine.connect() as c:
        return tuple(c.exec_driver_sql(f"SELECT count(*) FROM {t}").scalar_one()
            for t in ("approval_requests", "approval_request_events", "execution_plans"))


def test_real_plan_finalization_is_atomic_idempotent_and_pre_run():
    engine, command, authority, registrar, service = setup_db()
    try:
        result = service.finalize_execution_plan(command, authority)
        assert result.status == "PENDING" and result.run_id is None
        assert result.expires_at - result.requested_at == timedelta(hours=1)
        assert counts(engine) == (1, 1, 1)
        assert service.finalize_execution_plan(command, authority) == result
        assert counts(engine) == (1, 1, 1)
        with engine.connect() as c:
            assert c.exec_driver_sql("SELECT status FROM execution_plans").scalar_one() == "VALIDATED"
            assert c.exec_driver_sql("SELECT count(*) FROM approval_records").scalar_one() == 0
        assert not hasattr(service, "issue") and not hasattr(service, "revoke")
    finally:
        engine.dispose()


def test_same_content_new_key_is_durably_bound_before_different_body_retry():
    engine, command, authority, registrar, service = setup_db()
    a, r = api()
    try:
        first = service.finalize_execution_plan(command, authority)
        alias = replace(command, idempotency_key="key-alias")
        assert service.finalize_execution_plan(alias, authority) == first
        changed = replace(alias, mode=a.ExecutionModeSnapshot("mode-2", "standard"))
        newer = registrar.issue(changed, authority_event_hash=H)
        before = counts(engine)
        with pytest.raises(ValueError, match="IDEMPOTENCY_CONFLICT"):
            service.finalize_execution_plan(changed, newer)
        assert counts(engine) == before
        # 새 repository/service도 원장의 키 결박을 읽는다.
        recreated = a.ApprovalRequestService(r.ApprovalRequestRepository(engine))
        with pytest.raises(ValueError, match="IDEMPOTENCY_CONFLICT"):
            recreated.finalize_execution_plan(changed, newer)
    finally:
        engine.dispose()


def test_alias_key_audit_failure_rolls_back_and_retry_converges(monkeypatch):
    engine, command, authority, _, service = setup_db()
    _, r = api()
    try:
        first = service.finalize_execution_plan(command, authority)
        alias = replace(command, idempotency_key="key-alias")
        with monkeypatch.context() as patch:
            patch.setattr(r, "_audit", lambda *args: (_ for _ in ()).throw(RuntimeError("AUDIT_FAULT")))
            with pytest.raises(RuntimeError, match="AUDIT_FAULT"):
                service.finalize_execution_plan(alias, authority)
        assert counts(engine) == (1, 1, 1)
        with engine.connect() as c:
            assert c.execute(sa.select(r.approval_requests.c.idempotency_keys)).scalar_one() == ["key-1"]
        assert service.finalize_execution_plan(alias, authority) == first
        assert service.finalize_execution_plan(alias, authority) == first
        assert counts(engine) == (1, 2, 1)
    finally:
        engine.dispose()


@pytest.mark.parametrize("field,value", [("actor_id", "reader"), ("permission", "dashboard:read"),
    ("role", "HUMAN"), ("capability", "x" * 64), ("epoch", 999)])
def test_forged_authority_has_zero_partial_publication(field, value):
    engine, command, authority, _, service = setup_db()
    try:
        with pytest.raises(ValueError, match="AUTHORITY_DENIED"):
            service.finalize_execution_plan(command, replace(authority, **{field: value}))
        assert counts(engine) == (0, 0, 0)
    finally:
        engine.dispose()


def test_revoke_and_new_epoch_reject_old_capability():
    engine, command, authority, registrar, service = setup_db()
    try:
        registrar.revoke(authority.authority_id, authority_event_hash=H)
        with pytest.raises(ValueError, match="AUTHORITY_DENIED"):
            service.finalize_execution_plan(command, authority)
        newer = registrar.issue(command, authority_event_hash=H)
        assert newer.epoch == authority.epoch + 1
        with pytest.raises(ValueError, match="AUTHORITY_DENIED"):
            service.finalize_execution_plan(command, authority)
        service.finalize_execution_plan(command, newer)
        assert counts(engine) == (1, 1, 1)
    finally:
        engine.dispose()


def test_same_key_conflict_new_plan_supersedes_and_mode_only_replaces():
    engine, command, authority, registrar, service = setup_db()
    a, r = api()
    try:
        first = service.finalize_execution_plan(command, authority)
        changed = replace(command, plan=plan("plan-2"))
        grant = registrar.issue(changed, authority_event_hash=H)
        with pytest.raises(ValueError, match="IDEMPOTENCY_CONFLICT"):
            service.finalize_execution_plan(changed, grant)
        second = service.finalize_execution_plan(replace(changed, idempotency_key="key-2"), grant)
        mode = replace(changed.mode, snapshot_id="mode-2", control_mode="standard")
        changed = replace(changed, mode=mode, idempotency_key="key-3")
        grant = registrar.issue(changed, authority_event_hash=H)
        third = service.finalize_execution_plan(changed, grant)
        assert len({first.request_id, second.request_id, third.request_id}) == 3
        assert counts(engine) == (3, 5, 2)
    finally: engine.dispose()


def test_cancel_requires_current_bound_authority_and_appends_once():
    engine, command, authority, _, service = setup_db()
    _, r = api()
    try:
        first = service.finalize_execution_plan(command, authority)
        repo = r.ApprovalRequestRepository(engine)
        with pytest.raises(ValueError, match="AUTHORITY_DENIED"):
            repo.cancel(command, replace(authority, capability="0" * 64), first.request_id)
        assert counts(engine) == (1, 1, 1)
        assert repo.cancel(command, authority, first.request_id).status == "CANCELLED"
        assert repo.cancel(command, authority, first.request_id).status == "CANCELLED"
        assert counts(engine) == (1, 2, 1)
    finally: engine.dispose()


def test_audit_failure_rolls_back_plan_request_and_supersession(monkeypatch):
    engine, command, authority, _, service = setup_db()
    _, r = api()
    try:
        def fail(*args, **kwargs): raise RuntimeError("synthetic publication failure")
        monkeypatch.setattr(r, "_audit", fail)
        with pytest.raises(RuntimeError): service.finalize_execution_plan(command, authority)
        assert counts(engine) == (0, 0, 0)
    finally: engine.dispose()


@pytest.mark.parametrize("change", ["task", "pair", "wi", "expiry", "issued", "audit", "run"])
def test_scope_lineage_expiry_and_missing_audit_close_before_write(change, monkeypatch):
    engine, command, authority, _, service = setup_db()
    _, r = api()
    try:
        with engine.begin() as c:
            if change == "task": c.exec_driver_sql("UPDATE tasks SET project_id='foreign'")
            if change == "pair": c.exec_driver_sql("UPDATE registered_environments SET active=false")
            if change == "wi": c.exec_driver_sql("UPDATE work_instructions SET content_hash='bad'")
            if change in ("expiry", "issued"):
                row = c.execute(sa.select(r.task_planning_authorities)).mappings().one()
                clock = r.at(row["expires_at"]) if change == "expiry" else r.at(row["issued_at"]) - timedelta(seconds=1)
                monkeypatch.setattr(r, "db_time", lambda _c: clock)
            if change == "audit": c.execute(r.task_planning_authority_events.delete())
        if change == "run": command = replace(command, run_id="missing", worker_id="worker", execution_fence="fence")
        with pytest.raises(ValueError): service.finalize_execution_plan(command, authority)
        assert counts(engine) == (0, 0, 0)
    finally: engine.dispose()


def test_migration_installs_append_only_audit_and_refuses_destructive_downgrade():
    from pathlib import Path
    path = Path(__file__).resolve().parents[2] / "migrations/versions/0021_approval_requests.py"
    assert path.exists(), "원장 migration 미구현"
    spec = importlib.util.spec_from_file_location("c20_migration", path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    engine, command, authority, _, service = setup_db()
    try:
        _, r = api()
        r.LEDGER_METADATA.drop_all(engine)
        with engine.begin() as c:
            module.op = Operations(MigrationContext.configure(c))
            module.upgrade()
        registrar = r.TaskPlanningAuthorityRegistrar(engine)
        authority = registrar.issue(command, authority_event_hash=H)
        service.finalize_execution_plan(command, authority)
        for table in ("approval_request_events", "task_planning_authority_events"):
            for statement in (f"DELETE FROM {table}", f"UPDATE {table} SET event_type='FAKE'"):
                with pytest.raises(sa.exc.DatabaseError):
                    with engine.begin() as c: c.exec_driver_sql(statement)
        with pytest.raises(RuntimeError, match="PRESERVE"):
            module.downgrade()
        assert counts(engine) == (1, 1, 1)
    finally: engine.dispose()
def test_postgres_authority_clock_is_wall_time_not_transaction_start():
    _, repo = api()
    class Connection:
        dialect = type("Dialect", (), {"name": "postgresql"})()
        def execute(self, statement):
            assert "clock_timestamp()" in str(statement)
            return type("Result", (), {"scalar_one": lambda self: NOW})()
    assert repo.db_time(Connection()) == NOW
