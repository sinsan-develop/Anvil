"""정상 Task repository를 사용하는 로컬 등록 원자성; PG 잠금 증거와 별개."""
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import importlib.util
import json
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy.pool import StaticPool


ROOT = Path(__file__).resolve().parents[2]
PROJECT, ENV = "anvil-wsl-development", "wsl-development"
NOW = datetime(2026, 10, 14, 10, tzinfo=timezone.utc)


def api():
    assert importlib.util.find_spec("packages.planning.source_registration") is not None, "정상 source 등록 서비스 미구현"
    from packages.planning import source_registration as s
    from packages.persistence import planning_source_repository as r
    return s, r


def inputs(task="c21-registration-task", at=NOW):
    s, _ = api()
    from packages.planning.approval_requests import FinalizeExecutionPlan, ExecutionModeSnapshot
    from packages.planning.models import WorkPlan, IterationPlan
    from packages.planning.planner import analyze_request, generate_work_instruction, build_execution_plan, ExecutionStep, StepKind
    sources = {path: (ROOT / path).read_bytes() for path in s.SOURCE_HASHES}
    policy = s.PlanningSourcePolicy(task, "anvil-private", at, at + timedelta(hours=1))
    baseline_hash = s.source_baseline_hash(policy)
    analysis = analyze_request("analysis-" + task, "실제 승인 요청 표시 검증", scope=("approval-read",),
        completion_conditions=("request-visible",), allowed_paths=("packages/planning",),
        prohibited_actions=("run", "network"), risk=("low",),
        baseline_hash=baseline_hash, egress_snapshot_hash=baseline_hash)
    work = WorkPlan.create(artifact_id="work-" + task, revision=1, design_baseline_id="baseline-" + task,
        design_baseline_hash=baseline_hash, scope=frozenset({"approval-read"}), created_at=at)
    iteration = IterationPlan.create(artifact_id="iteration-" + task, revision=1, work_plan=work, sequence=1, created_at=at)
    wi = generate_work_instruction(iteration, analysis=analysis, allowed_actions=("read",),
        validation_contract=("request-visible",), created_at=at)
    plan = build_execution_plan(analysis, (ExecutionStep("inspect", StepKind.READ, "조회", (),
        ("packages/planning",), ("request-visible",), egress_snapshot_hash=baseline_hash),),
        plan_id="plan-" + task, permission_snapshot_hash=baseline_hash, created_at=at,
        work_plan=work, source_iteration_plan=iteration, source_work_instruction=wi)
    command = FinalizeExecutionPlan(task, PROJECT, ENV, plan, ExecutionModeSnapshot("mode-" + task, "controlled"), "register-" + task)
    return policy, command, sources


def database():
    engine = sa.create_engine("sqlite://", poolclass=StaticPool)
    # 기존 Task adapter의 PG SELECT FOR UPDATE만 SQLite parser에서 제거한다.
    # Task SQL/서비스·트랜잭션은 실제 코드; 동시성은 PG opt-in만 증명한다.
    @sa.event.listens_for(engine, "before_cursor_execute", retval=True)
    def sqlite_lock_syntax(conn, cursor, statement, parameters, context, many):
        return statement.replace(" FOR UPDATE", ""), parameters
    schema = {
        "design_artifacts": "artifact_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, content_hash TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL, artifact_type TEXT NOT NULL, source_refs JSON NOT NULL",
        "project_repositories": "project_id TEXT PRIMARY KEY, repository_id TEXT, target_environment TEXT, active BOOLEAN, version INTEGER",
        "tasks": "task_id TEXT PRIMARY KEY, project_id TEXT, repository_id TEXT, title TEXT, objective TEXT, requested_by TEXT, status TEXT, version INTEGER, target_environment TEXT, repository_mapping_version INTEGER, conversation_message TEXT, idempotency_key TEXT, creation_request_hash TEXT, UNIQUE(project_id,idempotency_key)",
        "registered_projects": "project_id TEXT PRIMARY KEY, active BOOLEAN",
        "registered_environments": "project_id TEXT, environment_id TEXT, active BOOLEAN",
        "design_baselines": "artifact_id TEXT PRIMARY KEY, revision INTEGER, content_hash TEXT, actor_type TEXT, actor_id TEXT, created_at TIMESTAMP, specification_id TEXT, root_human_approval_id TEXT, parent_baseline_id TEXT, approval_mode TEXT, scope JSON, project_id TEXT",
        "work_plans": "artifact_id TEXT PRIMARY KEY, revision INTEGER, content_hash TEXT, created_at TIMESTAMP, design_baseline_id TEXT, design_baseline_hash TEXT, scope JSON",
        "iteration_plans": "artifact_id TEXT PRIMARY KEY, revision INTEGER, content_hash TEXT, created_at TIMESTAMP, work_plan_id TEXT, work_plan_hash TEXT, sequence INTEGER",
        "work_instructions": "artifact_id TEXT PRIMARY KEY, revision INTEGER, content_hash TEXT, created_at TIMESTAMP, iteration_plan_id TEXT, iteration_plan_hash TEXT, allowed_paths JSON, allowed_actions JSON, completion_conditions JSON",
        "execution_plans": "plan_id TEXT PRIMARY KEY, plan_hash TEXT, source_work_instruction_id TEXT, source_work_instruction_hash TEXT, baseline_analysis_hash TEXT, impact_analysis_hash TEXT, status TEXT, created_at TIMESTAMP",
        "approval_records": "approval_id TEXT PRIMARY KEY, approval_type TEXT, subject_id TEXT, subject_hash TEXT, authenticated_human BOOLEAN, status TEXT, approved_at TIMESTAMP, expires_at TIMESTAMP",
        "runs": "run_id TEXT PRIMARY KEY, task_id TEXT, environment_id TEXT",
    }
    with engine.begin() as c:
        for name, columns in schema.items(): c.exec_driver_sql(f"CREATE TABLE {name} ({columns})")
        c.execute(sa.text("INSERT INTO registered_projects VALUES (:p,true)"), {"p": PROJECT})
        c.execute(sa.text("INSERT INTO registered_environments VALUES (:p,:e,true)"), {"p": PROJECT, "e": ENV})
    return engine


def setup(monkeypatch):
    s, r = api()
    engine = database()
    monkeypatch.setattr(r, "_db_time", lambda c: NOW)
    policy, command, sources = inputs()
    registrar = s.PlanningSourceRegistrar(r.PlanningSourceRepository(engine))
    service = s.PlanningSourceRegistrationService(r.PlanningSourceRepository(engine))
    grant = registrar.issue(policy, command, sources)
    return engine, policy, command, sources, registrar, service, grant


def rows(engine, name):
    with engine.connect() as c: return c.exec_driver_sql(f"SELECT * FROM {name}").mappings().all()


def test_register_real_source_creates_task_and_lineage_atomically(monkeypatch):
    engine, policy, command, sources, registrar, service, grant = setup(monkeypatch)
    try:
        receipt = service.register(policy, command, sources, grant)
        assert receipt.task_id == policy.task_id and receipt.status == "REGISTERED"
        assert [(r["task_id"], r["status"], r["version"]) for r in rows(engine, "tasks")] == [(policy.task_id, "DRAFT", 1)]
        assert len(rows(engine, "work_plans")) == len(rows(engine, "iteration_plans")) == len(rows(engine, "work_instructions")) == 1
        baseline = rows(engine, "design_baselines")[0]
        assert baseline["actor_type"] == "agent" and baseline["approval_mode"] == "REGISTERED_APPROVAL_SOURCE_REFERENCE"
        assert baseline["root_human_approval_id"] == "APPROVAL-20261014-U01-PLANNING-SOURCE-REGISTRATION-001"
        assert rows(engine, "approval_records") == rows(engine, "runs") == []
        assert service.register(policy, command, sources, grant) == receipt
        assert len(rows(engine, "design_artifacts")) == 3  # grant, specification reference, receipt
        raw = str(rows(engine, "design_artifacts"))
        assert grant.capability not in raw and "등록 권한과 기능 추가까지 승인" not in raw
    finally: engine.dispose()


def test_receipt_failure_restores_task_mapping_and_all_sources(monkeypatch):
    engine, policy, command, sources, _, service, grant = setup(monkeypatch)
    _, r = api()
    original = r._append
    def fail(c, *args, **kwargs):
        if args[1] == "PLANNING_SOURCE_REGISTERED": raise RuntimeError("RECEIPT_FAULT")
        return original(c, *args, **kwargs)
    try:
        with monkeypatch.context() as patch:
            patch.setattr(r, "_append", fail)
            with pytest.raises(RuntimeError, match="RECEIPT_FAULT"):
                service.register(policy, command, sources, grant)
        for name in ("tasks", "project_repositories", "design_baselines", "work_plans", "iteration_plans", "work_instructions"):
            assert rows(engine, name) == []
        assert len(rows(engine, "design_artifacts")) == 1
        assert service.register(policy, command, sources, grant).task_id == policy.task_id
    finally: engine.dispose()


@pytest.mark.parametrize("mutation", ["bytes", "extra", "task", "pair", "capability", "epoch", "planhash", "key"])
def test_foreign_or_forged_input_never_registers(monkeypatch, mutation):
    engine, policy, command, sources, _, service, grant = setup(monkeypatch)
    try:
        if mutation == "bytes": sources[next(iter(sources))] += b"!"
        if mutation == "extra": sources["foreign"] = b"x"
        if mutation == "task": command = replace(command, task_id="foreign")
        if mutation == "pair": command = replace(command, environment_id="foreign")
        if mutation == "capability": grant = replace(grant, capability="0" * 64)
        if mutation == "epoch": grant = replace(grant, epoch=2)
        if mutation == "planhash": object.__setattr__(command.plan, "content_hash", "sha256:" + "0" * 64)
        if mutation == "key": command = replace(command, idempotency_key="foreign")
        with pytest.raises(ValueError): service.register(policy, command, sources, grant)
        assert rows(engine, "tasks") == [] and len(rows(engine, "design_artifacts")) == 1
    finally: engine.dispose()


def test_revoke_expiry_and_new_epoch_do_not_revive_old_grant(monkeypatch):
    engine, policy, command, sources, registrar, service, grant = setup(monkeypatch)
    _, r = api()
    try:
        registrar.revoke(policy, grant)
        with pytest.raises(ValueError): service.register(policy, command, sources, grant)
        newer = registrar.issue(policy, command, sources)
        assert newer.epoch == 2
        with pytest.raises(ValueError): service.register(policy, command, sources, grant)
        monkeypatch.setattr(r, "_db_time", lambda c: policy.expires_at)
        with pytest.raises(ValueError): service.register(policy, command, sources, newer)
        assert rows(engine, "tasks") == []
    finally: engine.dispose()


def test_mapping_conflict_and_partial_lineage_are_preserved(monkeypatch):
    engine, policy, command, sources, _, service, grant = setup(monkeypatch)
    try:
        with engine.begin() as c:
            c.execute(sa.text("INSERT INTO project_repositories VALUES (:p,'foreign',:e,true,1)"), {"p": PROJECT, "e": ENV})
        with pytest.raises(ValueError, match="CONFLICT"): service.register(policy, command, sources, grant)
        assert rows(engine, "project_repositories")[0]["repository_id"] == "foreign"
        assert rows(engine, "tasks") == []
    finally: engine.dispose()


def test_registered_real_task_is_consumed_by_existing_c20_producer(monkeypatch):
    from packages.persistence import approval_request_repository as ledger
    from packages.planning.approval_requests import ApprovalRequestService
    s, _ = api()
    engine, policy, command, sources, registrar, service, grant = setup(monkeypatch)
    ledger.LEDGER_METADATA.create_all(engine)
    monkeypatch.setattr(ledger, "db_time", lambda c: NOW)
    try:
        registered = service.register(policy, command, sources, grant)
        authority = ledger.TaskPlanningAuthorityRegistrar(engine).issue(command,
            authority_event_hash=s.digest({"registration_receipt": registered.receipt_id}))
        producer = ApprovalRequestService(ledger.ApprovalRequestRepository(engine))
        receipt = producer.finalize_execution_plan(command, authority)
        assert producer.finalize_execution_plan(command, authority) == receipt
        assert receipt.task_id == policy.task_id and receipt.status == "PENDING" and receipt.run_id is None
        for name in ("approval_requests", "approval_request_events", "execution_plans"):
            assert len(rows(engine, name)) == 1
        assert rows(engine, "runs") == rows(engine, "approval_records") == []
        registrar.revoke(policy, grant)
        # 등록 권위 회수는 별도 C20 authority나 이미 보존한 요청을 지우지 않는다.
        assert len(rows(engine, "approval_requests")) == 1
    finally: engine.dispose()


def test_expiry_during_task_creation_rolls_back_all_registered_rows(monkeypatch):
    engine, p, c, sources, _, service, grant = setup(monkeypatch)
    _, r = api()
    clocks = iter((NOW, p.expires_at))
    monkeypatch.setattr(r, "_db_time", lambda db: next(clocks))
    try:
        with pytest.raises(ValueError, match="SOURCE_GRANT_EXPIRED"): service.register(p, c, sources, grant)
        for name in ("tasks", "project_repositories", "design_baselines", "work_plans", "iteration_plans", "work_instructions"):
            assert rows(engine, name) == []
        assert len(rows(engine, "design_artifacts")) == 1
    finally: engine.dispose()
