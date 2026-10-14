"""Task 행 잠금으로 직렬화하는 내부 승인 요청/권위 원장. 승인 결정 쓰기 없음."""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
import json
import secrets
from uuid import uuid4
import sqlalchemy as sa

from packages.planning.approval_requests import (ACTOR, ROLE, PERMISSION,
    TaskPlanningAuthority, ApprovalRequestReceipt, capture, binding, detached,
    digest, checked_hash, identity, deny, utc, ApprovalRequestRejected)

LEDGER_METADATA = sa.MetaData()


def _binding_columns():
    return [sa.Column(k, sa.String(128 if not k.endswith("hash") else 71), nullable=False)
        for k in ("task_id", "project_id", "environment_id", "plan_id", "plan_hash", "wi_id", "wi_hash", "mode_id", "mode_hash")]


task_planning_authorities = sa.Table("task_planning_authorities", LEDGER_METADATA,
    sa.Column("authority_id", sa.String(36), primary_key=True), *_binding_columns(),
    sa.Column("actor_id", sa.String(128), nullable=False),
    sa.Column("role", sa.String(32), nullable=False), sa.Column("permission", sa.String(64), nullable=False),
    sa.Column("capability_hash", sa.String(71), nullable=False),
    sa.Column("authority_event_hash", sa.String(71), nullable=False),
    sa.Column("epoch", sa.Integer, nullable=False),
    sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("revoked_at", sa.DateTime(timezone=True)),
    sa.UniqueConstraint("task_id", "epoch", name="uq_task_planning_authority_epoch"),
    sa.CheckConstraint("epoch > 0 AND expires_at > issued_at", name="ck_task_planning_lifetime"),
    sa.CheckConstraint("actor_id='anvil-internal-planning-main' AND role='INTERNAL_MAIN' AND permission='approval-requests:create'", name="ck_task_planning_role"))

approval_requests = sa.Table("approval_requests", LEDGER_METADATA,
    sa.Column("request_id", sa.String(36), primary_key=True), *_binding_columns(),
    sa.Column("request_kind", sa.String(32), nullable=False),
    sa.Column("run_id", sa.String(128)),
    sa.Column("authority_id", sa.String(36), sa.ForeignKey("task_planning_authorities.authority_id"), nullable=False),
    sa.Column("requested_by", sa.String(128), nullable=False),
    sa.Column("mode_snapshot", sa.JSON, nullable=False),
    sa.Column("idempotency_key", sa.String(128), nullable=False),
    sa.Column("idempotency_keys", sa.JSON, nullable=False),
    sa.Column("request_hash", sa.String(71), nullable=False),
    sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("status", sa.String(32), nullable=False),
    sa.UniqueConstraint("task_id", "idempotency_key", name="uq_approval_request_retry"),
    sa.CheckConstraint("request_kind='EXECUTION_PLAN'", name="ck_approval_request_kind"),
    sa.CheckConstraint("status IN ('PENDING','SUPERSEDED','CANCELLED','INVALIDATED')", name="ck_approval_request_status"),
    sa.CheckConstraint("expires_at > requested_at", name="ck_approval_request_lifetime"))
sa.Index("uq_approval_request_pending_subject", approval_requests.c.task_id,
    approval_requests.c.project_id, approval_requests.c.environment_id, approval_requests.c.request_kind,
    unique=True, postgresql_where=sa.text("status='PENDING'"), sqlite_where=sa.text("status='PENDING'"))


def _events(name, owner, key):
    return sa.Table(name, LEDGER_METADATA,
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column(key, sa.String(36), sa.ForeignKey(f"{owner}.{key}"), nullable=False),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False),
        sa.Column("content_hash", sa.String(71), nullable=False),
        sa.UniqueConstraint(key, "sequence", name=f"uq_{name}_sequence"),
        sa.CheckConstraint("sequence > 0", name=f"ck_{name}_sequence"))


task_planning_authority_events = _events("task_planning_authority_events", "task_planning_authorities", "authority_id")
approval_request_events = _events("approval_request_events", "approval_requests", "request_id")


def db_time(c):
    # Task 잠금 대기 이전 transaction start가 아닌, 잠금 획득 뒤 실제 DB 시각.
    clock = sa.func.clock_timestamp() if c.dialect.name == "postgresql" else sa.func.current_timestamp()
    v = c.execute(sa.select(clock)).scalar_one()
    if type(v) is str: v = datetime.fromisoformat(v)
    if type(v) is not datetime: deny("LEDGER_UNAVAILABLE")
    if v.tzinfo is None:
        if c.dialect.name != "sqlite": deny("LEDGER_UNAVAILABLE")
        v = v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc)


def at(v):
    # SQLAlchemy SQLite의 timezone 소거만 복원. 외부 입력에는 사용하지 않는다.
    if type(v) is str: v = datetime.fromisoformat(v)
    if type(v) is not datetime: deny("LEDGER_UNAVAILABLE")
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)


def _json(v):
    if type(v) is datetime: return at(v).isoformat()
    if type(v) is dict: return {k: _json(x) for k, x in v.items()}
    if type(v) in (tuple, list): return [_json(x) for x in v]
    return v


def _audit(c, table, key, owner_id, kind, now, row):
    previous = c.execute(sa.select(sa.func.max(table.c.sequence)).where(table.c[key] == owner_id)).scalar_one() or 0
    payload = _json(dict(row))
    event = dict(event_id=str(uuid4()), **{key: owner_id}, sequence=previous + 1,
        event_type=kind, occurred_at=now, payload=payload)
    event["content_hash"] = digest(_json(event))
    c.execute(table.insert().values(**event))


def verified_history(c, table, key, owner_id, row, first_kind):
    events = c.execute(sa.select(table).where(table.c[key] == owner_id).order_by(table.c.sequence).limit(101)).mappings().all()
    if not events or len(events) > 100: deny("LEDGER_UNAVAILABLE")
    previous = None
    for i, event in enumerate(events, 1):
        data = dict(event); seal = data.pop("content_hash")
        if event["sequence"] != i or digest(_json(data)) != seal: deny("LEDGER_UNAVAILABLE")
        if i == 1 and event["event_type"] != first_kind: deny("LEDGER_UNAVAILABLE")
        if previous is not None and at(event["occurred_at"]) < previous: deny("LEDGER_UNAVAILABLE")
        previous = at(event["occurred_at"])
    if events[-1]["payload"] != _json(dict(row)): deny("LEDGER_UNAVAILABLE")


def _task(c, command):
    suffix = " FOR UPDATE" if c.dialect.name == "postgresql" else ""
    task = c.execute(sa.text("SELECT task_id,project_id,repository_id,target_environment FROM tasks WHERE task_id=:task" + suffix), {"task": command.task_id}).mappings().one_or_none()
    if task is None or (task["project_id"], task["target_environment"]) != (command.project_id, command.environment_id): deny("TASK_SCOPE_DENIED")
    row = c.execute(sa.text("""SELECT m.repository_id FROM project_repositories m
        JOIN registered_projects p ON p.project_id=m.project_id AND p.active=true
        JOIN registered_environments e ON e.project_id=p.project_id AND e.environment_id=m.target_environment AND e.active=true
        WHERE m.project_id=:project AND m.target_environment=:env AND m.repository_id=:repo AND m.active=true"""),
        dict(project=command.project_id, env=command.environment_id, repo=task["repository_id"])).one_or_none()
    if row is None: deny("TASK_SCOPE_DENIED")


def _lineage(c, command):
    p = command.plan; wi = p.source_work_instruction; ip = p.source_iteration_plan
    row = c.execute(sa.text("""SELECT wi.content_hash AS wi_hash,wi.allowed_paths,wi.allowed_actions,wi.completion_conditions,
        ip.artifact_id AS ip_id,ip.content_hash AS ip_hash,wp.artifact_id AS wp_id,wp.content_hash AS wp_hash,
        db.artifact_id AS db_id,db.content_hash AS db_hash FROM work_instructions wi
        JOIN iteration_plans ip ON ip.artifact_id=wi.iteration_plan_id AND ip.content_hash=wi.iteration_plan_hash
        JOIN work_plans wp ON wp.artifact_id=ip.work_plan_id AND wp.content_hash=ip.work_plan_hash
        JOIN design_baselines db ON db.artifact_id=wp.design_baseline_id AND db.content_hash=wp.design_baseline_hash
        WHERE wi.artifact_id=:wi AND db.project_id=:project"""),
        dict(wi=p.source_work_instruction_id, project=command.project_id)).mappings().one_or_none()
    expected = dict(wi_hash=p.source_work_instruction_hash, ip_id=ip.artifact_id, ip_hash=ip.content_hash,
        wp_id=p.work_plan_id, wp_hash=p.work_plan_hash, db_id=p.design_baseline_id, db_hash=p.design_baseline_hash)
    if row is None or any(row[k] != v for k, v in expected.items()): deny("PLAN_LINEAGE_MISMATCH")
    for key in ("allowed_paths", "allowed_actions", "completion_conditions"):
        values = row[key]
        if type(values) is str: values = json.loads(values)
        if type(values) is not list or values != list(getattr(wi, key)): deny("PLAN_LINEAGE_MISMATCH")


def _principal(authority):
    if type(authority) is not TaskPlanningAuthority: deny("AUTHORITY_DENIED")
    try:
        a = detached(authority)
        identity(a.authority_id)
        if ((a.actor_id, a.role, a.permission) != (ACTOR, ROLE, PERMISSION)
            or type(a.capability) is not str or not __import__('re').fullmatch('[0-9a-f]{64}', a.capability)
            or type(a.epoch) is not int or a.epoch < 1): deny("AUTHORITY_DENIED")
        return a
    except Exception: deny("AUTHORITY_DENIED")


def _authority(c, command, principal, now):
    a = _principal(principal)
    table = task_planning_authorities
    row = c.execute(sa.select(table).where(table.c.authority_id == a.authority_id)).mappings().one_or_none()
    latest = c.execute(sa.select(sa.func.max(table.c.epoch)).where(table.c.task_id == command.task_id)).scalar_one()
    if (row is None or row["epoch"] != a.epoch or a.epoch != latest or row["revoked_at"] is not None
        or not at(row["issued_at"]) <= now < at(row["expires_at"])
        or at(row["expires_at"]) - at(row["issued_at"]) > timedelta(hours=1)
        or any(row[k] != v for k, v in binding(command).items())
        or (row["actor_id"], row["role"], row["permission"]) != (ACTOR, ROLE, PERMISSION)
        or not hmac.compare_digest(row["capability_hash"], "sha256:" + sha256(a.capability.encode()).hexdigest())): deny("AUTHORITY_DENIED")
    verified_history(c, task_planning_authority_events, "authority_id", a.authority_id, row, "ISSUED")
    if command.run_id is not None:
        run = c.execute(sa.text("SELECT task_id,environment_id FROM runs WHERE run_id=:run"), {"run": command.run_id}).mappings().one_or_none()
        worker = c.execute(sa.text("SELECT worker_id,execution_fencing_token,issued_at,expires_at FROM worker_leases WHERE run_id=:run ORDER BY lease_epoch DESC LIMIT 1"), {"run": command.run_id}).mappings().one_or_none()
        if (run is None or worker is None or run["task_id"] != command.task_id or run["environment_id"] != command.environment_id
            or worker["worker_id"] != command.worker_id or worker["execution_fencing_token"] != command.execution_fence
            or not at(worker["issued_at"]) <= now < at(worker["expires_at"])): deny("RUN_FENCE_DENIED")
    return a


class TaskPlanningAuthorityRegistrar:
    """신뢰 embedding host 전용. 생성 service/HTTP reader가 이 객체를 받지 않는다."""
    def __init__(self, engine): self.__engine = engine

    def issue(self, command, *, authority_event_hash):
        command = capture(command); checked_hash(authority_event_hash)
        capability = secrets.token_hex(32)
        with self.__engine.begin() as c:
            _task(c, command); _lineage(c, command); now = db_time(c)
            epoch = (c.execute(sa.select(sa.func.max(task_planning_authorities.c.epoch)).where(
                task_planning_authorities.c.task_id == command.task_id)).scalar_one() or 0) + 1
            row = dict(authority_id=str(uuid4()), **binding(command), actor_id=ACTOR, role=ROLE,
                permission=PERMISSION, capability_hash="sha256:" + sha256(capability.encode()).hexdigest(),
                authority_event_hash=authority_event_hash, epoch=epoch, issued_at=now,
                expires_at=now + timedelta(hours=1), revoked_at=None)
            c.execute(task_planning_authorities.insert().values(**row))
            _audit(c, task_planning_authority_events, "authority_id", row["authority_id"], "ISSUED", now, row)
            result = TaskPlanningAuthority(row["authority_id"], capability, epoch)
        return result

    def revoke(self, authority_id, *, authority_event_hash):
        identity(authority_id); checked_hash(authority_event_hash)
        with self.__engine.begin() as c:
            row = c.execute(sa.select(task_planning_authorities).where(task_planning_authorities.c.authority_id == authority_id)).mappings().one_or_none()
            if row is None: deny("AUTHORITY_DENIED")
            # issue/create와 같은 Task→권위 잠금 순서.
            c.execute(sa.text("SELECT task_id FROM tasks WHERE task_id=:task" + (" FOR UPDATE" if c.dialect.name == "postgresql" else "")), {"task": row["task_id"]}).one()
            row = dict(c.execute(sa.select(task_planning_authorities).where(task_planning_authorities.c.authority_id == authority_id)).mappings().one())
            verified_history(c, task_planning_authority_events, "authority_id", authority_id, row, "ISSUED")
            if row["revoked_at"] is not None: return
            now = db_time(c); row["revoked_at"] = now
            c.execute(task_planning_authorities.update().where(task_planning_authorities.c.authority_id == authority_id).values(revoked_at=now))
            _audit(c, task_planning_authority_events, "authority_id", authority_id, "REVOKED", now, row)


def _receipt(row, now):
    status = "EXPIRED" if row["status"] == "PENDING" and now >= at(row["expires_at"]) else row["status"]
    return ApprovalRequestReceipt(row["request_id"], row["task_id"], row["plan_id"], row["plan_hash"],
        row["run_id"], at(row["requested_at"]), at(row["expires_at"]), status)


def _retry_keys(row):
    keys = row["idempotency_keys"]
    if type(keys) is not list or not 1 <= len(keys) <= 64: deny("LEDGER_UNAVAILABLE")
    for key in keys: identity(key)
    if len(set(keys)) != len(keys) or keys[0] != row["idempotency_key"]: deny("LEDGER_UNAVAILABLE")
    return keys


class ApprovalRequestRepository:
    def __init__(self, engine): self.__engine = engine

    def cancel(self, command, trusted_authority, request_id):
        command = capture(command); identity(request_id)
        with self.__engine.begin() as c:
            _task(c, command); now = db_time(c)
            _authority(c, command, trusted_authority, now)
            row = c.execute(sa.select(approval_requests).where(approval_requests.c.request_id == request_id)).mappings().one_or_none()
            if row is None or any(row[k] != v for k, v in binding(command).items()): deny("AUTHORITY_DENIED")
            verified_history(c, approval_request_events, "request_id", request_id, row, "REQUESTED")
            if row["status"] == "CANCELLED": return _receipt(row, now)
            if row["status"] != "PENDING": deny("REQUEST_TERMINAL")
            row = dict(row); row["status"] = "CANCELLED"
            c.execute(approval_requests.update().where(approval_requests.c.request_id == request_id).values(status="CANCELLED"))
            _audit(c, approval_request_events, "request_id", request_id, "CANCELLED", now, row)
            result = _receipt(row, now)
        return result

    def create_execution_plan_request(self, command, trusted_authority):
        command = capture(command); principal = _principal(trusted_authority)
        fingerprint = digest(dict(**binding(command), mode=command.mode.payload(), run_id=command.run_id))
        with self.__engine.begin() as c:
            _task(c, command); _lineage(c, command); now = db_time(c)
            _authority(c, command, principal, now)
            replay = None
            for previous in c.execute(sa.select(approval_requests).where(
                    approval_requests.c.task_id == command.task_id)).mappings():
                if command.idempotency_key in _retry_keys(previous):
                    if replay is not None: deny("LEDGER_UNAVAILABLE")
                    replay = previous
            if replay is not None:
                if replay["request_hash"] != fingerprint: deny("IDEMPOTENCY_CONFLICT")
                verified_history(c, approval_request_events, "request_id", replay["request_id"], replay, "REQUESTED")
                return _receipt(replay, now)
            old = c.execute(sa.select(approval_requests).where(approval_requests.c.task_id == command.task_id,
                approval_requests.c.project_id == command.project_id, approval_requests.c.environment_id == command.environment_id,
                approval_requests.c.status == "PENDING")).mappings().one_or_none()
            if old is not None:
                verified_history(c, approval_request_events, "request_id", old["request_id"], old, "REQUESTED")
                if old["request_hash"] == fingerprint and now < at(old["expires_at"]):
                    keys = _retry_keys(old)
                    if len(keys) >= 64: deny("IDEMPOTENCY_BOUND_EXCEEDED")
                    old = dict(old, idempotency_keys=[*keys, command.idempotency_key])
                    c.execute(approval_requests.update().where(approval_requests.c.request_id == old["request_id"])
                        .values(idempotency_keys=old["idempotency_keys"]))
                    _audit(c, approval_request_events, "request_id", old["request_id"], "RETRY_BOUND", now, old)
                    return _receipt(old, now)
            p = command.plan
            stored = c.execute(sa.text("SELECT plan_hash,source_work_instruction_id,source_work_instruction_hash,baseline_analysis_hash,impact_analysis_hash FROM execution_plans WHERE plan_id=:id"), {"id": p.plan_id}).mappings().one_or_none()
            metadata = dict(plan_hash=p.content_hash, source_work_instruction_id=p.source_work_instruction_id,
                source_work_instruction_hash=p.source_work_instruction_hash, baseline_analysis_hash=p.baseline_hash,
                impact_analysis_hash=p.request_analysis_hash)
            if stored is not None and dict(stored) != metadata: deny("PLAN_ID_CONFLICT")
            if stored is None:
                c.execute(sa.text("""INSERT INTO execution_plans (plan_id,plan_hash,source_work_instruction_id,
                    source_work_instruction_hash,baseline_analysis_hash,impact_analysis_hash,status,created_at)
                    VALUES (:plan_id,:plan_hash,:source_work_instruction_id,:source_work_instruction_hash,
                    :baseline_analysis_hash,:impact_analysis_hash,'VALIDATED',:at)"""), dict(**metadata, plan_id=p.plan_id, at=now))
            if old is not None:
                old = dict(old); old["status"] = "SUPERSEDED"
                c.execute(approval_requests.update().where(approval_requests.c.request_id == old["request_id"]).values(status="SUPERSEDED"))
                _audit(c, approval_request_events, "request_id", old["request_id"], "SUPERSEDED", now, old)
            row = dict(request_id=str(uuid4()), **binding(command), request_kind="EXECUTION_PLAN",
                run_id=command.run_id, authority_id=principal.authority_id, requested_by=ACTOR,
                mode_snapshot=_json(command.mode.payload()), idempotency_key=command.idempotency_key,
                idempotency_keys=[command.idempotency_key],
                request_hash=fingerprint, requested_at=now, expires_at=now + timedelta(hours=1), status="PENDING")
            c.execute(approval_requests.insert().values(**row))
            _audit(c, approval_request_events, "request_id", row["request_id"], "REQUESTED", now, row)
            result = _receipt(row, now)
        return result
