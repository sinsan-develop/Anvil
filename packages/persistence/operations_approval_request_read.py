"""인가 이후에만 호출하는 원장 조회. 쓰기/승인/Run 전이는 수행하지 않는다."""
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
import sqlalchemy as sa

from packages.planning.approval_requests import (ExecutionModeSnapshot, identity, checked_hash,
    digest, ACTOR, ROLE, PERMISSION, deny)
from .approval_request_repository import (approval_requests, approval_request_events,
    task_planning_authorities, task_planning_authority_events, verified_history, db_time, at)


@dataclass(frozen=True, slots=True)
class ApprovalRequestItem:
    request_id: str
    task_id: str
    run_id: str | None
    request_kind: str
    plan_id: str
    plan_hash: str
    requested_at: datetime
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ScopedApprovalRequestSource:
    project_id: str
    environment_id: str
    observed_at: datetime
    items: tuple[ApprovalRequestItem, ...]
    states: tuple[tuple[str, str], ...]


def _state(c, row, now):
    for k in ("request_id", "task_id", "project_id", "environment_id", "plan_id", "wi_id", "mode_id", "authority_id", "idempotency_key"):
        identity(row[k])
    for k in ("plan_hash", "wi_hash", "mode_hash", "request_hash"): checked_hash(row[k])
    if row["run_id"] is not None: identity(row["run_id"])
    requested, expires = at(row["requested_at"]), at(row["expires_at"])
    if requested > now or expires - requested != timedelta(hours=1) or row["request_kind"] != "EXECUTION_PLAN" or row["requested_by"] != ACTOR: deny()
    if row["status"] not in ("PENDING", "SUPERSEDED", "CANCELLED", "INVALIDATED"): deny()
    verified_history(c, approval_request_events, "request_id", row["request_id"], row, "REQUESTED")
    mode = row["mode_snapshot"]
    if type(mode) is not dict or set(mode) != {"snapshot_id", "control_mode", "strategy", "failure_policy", "max_parallel_agents", "approval_points", "stop_on"}: deny()
    mode = dict(mode)
    for key in ("approval_points", "stop_on"):
        if type(mode[key]) is not list or any(type(v) is not str for v in mode[key]): deny()
        mode[key] = tuple(mode[key])
    mode = ExecutionModeSnapshot(**mode)
    if mode.snapshot_id != row["mode_id"] or mode.content_hash != row["mode_hash"]: deny()
    sealed = {k: row[k] for k in ("task_id", "project_id", "environment_id", "plan_id", "plan_hash", "wi_id", "wi_hash", "mode_id", "mode_hash")}
    if digest(dict(**sealed, mode=mode.payload(), run_id=row["run_id"])) != row["request_hash"]: deny()
    task = c.execute(sa.text("""SELECT t.project_id,t.target_environment FROM tasks t
        JOIN project_repositories m ON m.project_id=t.project_id AND m.repository_id=t.repository_id AND m.target_environment=t.target_environment AND m.active=true
        JOIN registered_projects p ON p.project_id=t.project_id AND p.active=true
        JOIN registered_environments e ON e.project_id=t.project_id AND e.environment_id=t.target_environment AND e.active=true
        WHERE t.task_id=:task"""), {"task": row["task_id"]}).mappings().one_or_none()
    if task is None or (task["project_id"], task["target_environment"]) != (row["project_id"], row["environment_id"]): deny()
    original = c.execute(sa.text("""SELECT ep.plan_hash,ep.source_work_instruction_hash,wi.content_hash AS wi_hash,
        db.project_id, ep.status FROM execution_plans ep
        JOIN work_instructions wi ON wi.artifact_id=ep.source_work_instruction_id
        JOIN iteration_plans ip ON ip.artifact_id=wi.iteration_plan_id AND ip.content_hash=wi.iteration_plan_hash
        JOIN work_plans wp ON wp.artifact_id=ip.work_plan_id AND wp.content_hash=ip.work_plan_hash
        JOIN design_baselines db ON db.artifact_id=wp.design_baseline_id AND db.content_hash=wp.design_baseline_hash
        WHERE ep.plan_id=:plan AND wi.artifact_id=:wi"""), dict(plan=row["plan_id"], wi=row["wi_id"])).mappings().one_or_none()
    if original is None: deny()
    if original["project_id"] != row["project_id"]: deny()
    authority = c.execute(sa.select(task_planning_authorities).where(task_planning_authorities.c.authority_id == row["authority_id"])).mappings().one_or_none()
    if authority is None: deny()
    verified_history(c, task_planning_authority_events, "authority_id", row["authority_id"], authority, "ISSUED")
    if (any(authority[k] != v for k, v in sealed.items()) or (authority["actor_id"], authority["role"], authority["permission"]) != (ACTOR, ROLE, PERMISSION)
        or not at(authority["issued_at"]) <= requested < at(authority["expires_at"])): deny()
    if row["status"] != "PENDING": return row["status"]
    if (original["plan_hash"] != row["plan_hash"] or original["wi_hash"] != row["wi_hash"]
        or original["source_work_instruction_hash"] != row["wi_hash"] or original["status"] == "RETIRED"
        or authority["revoked_at"] is not None): return "INVALIDATED"
    if now >= expires: return "EXPIRED"
    approvals = c.execute(sa.text("""SELECT approval_type,subject_id,subject_hash,authenticated_human,status,approved_at,expires_at
        FROM approval_records WHERE (approval_type='EXECUTION_PLAN' AND subject_id=:plan)
        OR (approval_type='EXECUTION_MODE' AND subject_id=:mode)"""), dict(plan=row["plan_id"], mode=row["mode_id"])).mappings().all()
    kinds = set()
    for a in approvals:
        if (a["authenticated_human"] in (True, 1) and a["status"] == "ACTIVE" and at(a["approved_at"]) <= now < at(a["expires_at"])
            and a["subject_hash"] == row["plan_hash" if a["approval_type"] == "EXECUTION_PLAN" else "mode_hash"]):
            kinds.add(a["approval_type"])
    return "SATISFIED" if kinds == {"EXECUTION_PLAN", "EXECUTION_MODE"} else "PENDING"


def load_scoped_approval_request_source(engine, project_id, environment_id):
    identity(project_id); identity(environment_id)
    try:
        with engine.connect() as c:
            if c.dialect.name == "postgresql": c = c.execution_options(isolation_level="REPEATABLE READ")
            with c.begin():
                if c.dialect.name == "postgresql": c.execute(sa.text("SET TRANSACTION READ ONLY"))
                now = db_time(c)
                rows = c.execute(sa.select(approval_requests).where(approval_requests.c.project_id == project_id,
                    approval_requests.c.environment_id == environment_id,
                    approval_requests.c.status == "PENDING", approval_requests.c.expires_at > now
                    ).order_by(approval_requests.c.request_id)).yield_per(100).mappings()
                items, states, subjects = [], [], set()
                for row in rows:
                    state = _state(c, row, now)
                    states.append((row["request_id"], state))
                    if state == "PENDING":
                        subject = (row["task_id"], row["request_kind"])
                        if subject in subjects: deny()
                        subjects.add(subject)
                        items.append(ApprovalRequestItem(row["request_id"], row["task_id"], row["run_id"], row["request_kind"],
                            row["plan_id"], row["plan_hash"], at(row["requested_at"]), at(row["expires_at"])))
                        if len(items) > 100: deny()
                return ScopedApprovalRequestSource(project_id, environment_id, now, tuple(items), tuple(states))
    except Exception:
        raise ValueError("APPROVAL_SOURCE_UNAVAILABLE") from None
