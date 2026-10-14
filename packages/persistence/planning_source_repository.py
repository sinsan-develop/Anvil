"""정상 source 등록 adapter. journal은 adapter INSERT-only이며 DB trigger 보장이 아니다."""
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
import hmac
import json
import secrets
from threading import RLock
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.orm import Session

# 기존 Task adapter는 packages.api bootstrap 뒤에 가져온다.
from packages.api.task_bootstrap import TaskBootstrapCommand, canonical_task_authority_hash
from packages.persistence.task_bootstrap_repository import SqlAlchemyTaskBootstrapRepository
from packages.planning.source_registration import (
    ACTOR, APPROVAL_ID, SOURCE_HASHES, PlanningSourceGrant, PlanningSourceReceipt,
    admission, deny, digest, grant_snapshot, policy_payload, policy_snapshot,
)

_LOCAL_LOCK = RLock()
_KINDS = ("PLANNING_SOURCE_GRANT_ISSUED", "PLANNING_SOURCE_REGISTERED", "PLANNING_SOURCE_GRANT_REVOKED")


def _db_time(c):
    if c.dialect.name == "postgresql": return c.exec_driver_sql("SELECT clock_timestamp()").scalar_one().astimezone(timezone.utc)
    return datetime.now(timezone.utc)


def _json(value):
    if isinstance(value, datetime):
        if value.tzinfo is None: value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if type(value) in (tuple, list): return [_json(x) for x in value]
    if type(value) is dict: return {k: _json(v) for k, v in value.items()}
    return value


def _table(c, name):
    return sa.Table(name, sa.MetaData(), autoload_with=c)


def _journal(c, p):
    table = _table(c, "design_artifacts")
    prefix = "psj-" + sha256(p.task_id.encode()).hexdigest()[:32] + "-"
    rows = c.execute(sa.select(table).where(table.c.artifact_id.like(prefix + "%")).order_by(table.c.revision).limit(101)).mappings().all()
    if len(rows) > 100: deny("SOURCE_JOURNAL_INVALID")
    previous = None
    result = []
    for seq, row in enumerate(rows, 1):
        data = row["source_refs"]
        if type(data) is str: data = json.loads(data)
        if (type(data) is not dict or set(data) != {"schema", "task_id", "sequence", "previous_hash", "kind", "at", "payload"}
                or data["schema"] != "planning_source_journal/v1" or data["task_id"] != p.task_id
                or data["sequence"] != seq or row["revision"] != seq or data["previous_hash"] != previous
                or data["kind"] not in _KINDS or row["artifact_type"] != data["kind"]
                or row["actor_type"] != "agent" or row["actor_id"] != ACTOR
                or row["artifact_id"] != prefix + str(seq) or digest(data) != row["content_hash"]
                or _json(row["created_at"]) != data["at"]): deny("SOURCE_JOURNAL_INVALID")
        previous = row["content_hash"]
        result.append((row["artifact_id"], data, previous))
    return result


def _append(c, p, kind, payload, now, history):
    seq = len(history) + 1
    if seq > 100: deny("SOURCE_JOURNAL_INVALID")
    key = "psj-" + sha256(p.task_id.encode()).hexdigest()[:32] + "-" + str(seq)
    data = dict(schema="planning_source_journal/v1", task_id=p.task_id, sequence=seq,
        previous_hash=history[-1][2] if history else None, kind=kind, at=_json(now), payload=_json(payload))
    table = _table(c, "design_artifacts")
    c.execute(table.insert().values(artifact_id=key, revision=seq, content_hash=digest(data),
        actor_type="agent", actor_id=ACTOR, created_at=now, artifact_type=kind, source_refs=data))
    return key


def _window(p, now):
    if not p.issued_at <= now < p.expires_at: deny("SOURCE_GRANT_EXPIRED")


def _current(history, p, grant, now, fingerprint=None, allow_revoked=False):
    issued = [(key, data["payload"]) for key, data, _ in history if data["kind"] == _KINDS[0]]
    if not issued: deny("SOURCE_GRANT_DENIED")
    key, row = issued[-1]
    if (set(row) != {"epoch", "policy", "fingerprint", "capability_hash", "expires_at"}
            or grant.grant_id != key or grant.epoch != row["epoch"] or row["epoch"] != len(issued)
            or row["policy"] != policy_payload(p)
            or row["expires_at"] != p.expires_at.isoformat()
            or not hmac.compare_digest(row["capability_hash"], "sha256:" + sha256(grant.capability.encode()).hexdigest())
            or (fingerprint is not None and row["fingerprint"] != fingerprint)):
        deny("SOURCE_GRANT_DENIED")
    revoked = any(data["kind"] == _KINDS[2] and data["payload"] == {"grant_id": key, "epoch": grant.epoch} for _, data, _ in history)
    if revoked and not allow_revoked: deny("SOURCE_GRANT_REVOKED")
    if not allow_revoked: _window(p, now)
    return revoked


def _existing(c, table, key, value):
    return c.execute(sa.select(table).where(table.c[key] == value)).mappings().one_or_none()


def _exact(c, name, key, data, *, insert):
    table = _table(c, name)
    old = _existing(c, table, key, data[key])
    if old is None:
        if not insert: deny("SOURCE_PARTIAL_CONFLICT")
        c.execute(table.insert().values(**data))
    elif any(_json(old[k]) != _json(v) for k, v in data.items()):
        deny("SOURCE_ROW_CONFLICT")


class PlanningSourceRepository:
    def __init__(self, engine): self.__engine = engine

    @contextmanager
    def _transaction(self, p):
        # PG의 모든 grant/register/revoke가 mapping→Task aggregate 순서로 직렬화된다.
        with _LOCAL_LOCK:
            with self.__engine.begin() as c:
                if c.dialect.name == "postgresql":
                    lock = int.from_bytes(sha256(p.project_id.encode()).digest()[:8], "big", signed=True)
                    c.execute(sa.text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
                yield c

    def issue(self, policy, command, sources):
        p, command, fingerprint = admission(policy, command, sources)
        capability = secrets.token_hex(32)
        with self._transaction(p) as c:
            now = _db_time(c); _window(p, now)
            self._pair(c, p)
            history = _journal(c, p)
            issues = [data for _, data, _ in history if data["kind"] == _KINDS[0]]
            epoch = len(issues) + 1
            key = _append(c, p, _KINDS[0], dict(epoch=epoch, policy=policy_payload(p), fingerprint=fingerprint,
                capability_hash="sha256:" + sha256(capability.encode()).hexdigest(), expires_at=p.expires_at.isoformat()), now, history)
            result = PlanningSourceGrant(key, capability, epoch)
        return result

    def revoke(self, policy, grant):
        p, grant = policy_snapshot(policy), grant_snapshot(grant)
        with self._transaction(p) as c:
            history = _journal(c, p); now = _db_time(c)
            revoked = _current(history, p, grant, now, allow_revoked=True)
            if not revoked:
                _append(c, p, _KINDS[2], dict(grant_id=grant.grant_id, epoch=grant.epoch), now, history)

    @staticmethod
    def _pair(c, p):
        row = c.execute(sa.text("""SELECT p.project_id FROM registered_projects p
            JOIN registered_environments e ON e.project_id=p.project_id
            WHERE p.project_id=:p AND e.environment_id=:e AND p.active=true AND e.active=true"""),
            dict(p=p.project_id, e=p.environment_id)).one_or_none()
        if row is None: deny("SOURCE_PAIR_DENIED")

    def register(self, policy, command, sources, grant):
        p, command, fingerprint = admission(policy, command, sources)
        grant = grant_snapshot(grant)
        with self._transaction(p) as c:
            now = _db_time(c); history = _journal(c, p)
            _current(history, p, grant, now, fingerprint)
            self._pair(c, p)
            registered = [(key, data) for key, data, _ in history if data["kind"] == _KINDS[1]]
            if len(registered) > 1: deny("SOURCE_JOURNAL_INVALID")
            if registered and registered[0][1]["payload"] != {"fingerprint": fingerprint,
                    "task_id": p.task_id, "plan_id": command.plan.plan_id, "plan_hash": command.plan.content_hash}:
                deny("SOURCE_IDEMPOTENCY_CONFLICT")
            self._sources(c, p, command, bool(registered))
            target_hash = canonical_task_authority_hash(project_id=p.project_id, repository_id=p.repository_id,
                target_environment=p.environment_id, mapping_version=1)
            task_command = TaskBootstrapCommand(None, p.project_id, command.plan.analysis.objective,
                p.environment_id, "승인 원본 등록 기반 검증 Task", ACTOR, 0,
                command.idempotency_key, target_hash, "등록 승인 범위의 별도 Task")
            # rollback_only: Session.commit/close는 바깥 connection transaction을 commit하지 않는다.
            repository = SqlAlchemyTaskBootstrapRepository(lambda: Session(bind=c, join_transaction_mode="rollback_only"),
                task_id_factory=lambda: p.task_id)
            task = repository.create(task_command)
            if task.task_id != p.task_id: deny("SOURCE_TASK_CONFLICT")
            _window(p, _db_time(c))
            if registered:
                key, data = registered[0]
                result = PlanningSourceReceipt(key, p.task_id, command.plan.plan_id, command.plan.content_hash,
                    datetime.fromisoformat(data["at"]))
            else:
                key = _append(c, p, _KINDS[1], dict(fingerprint=fingerprint, task_id=p.task_id,
                    plan_id=command.plan.plan_id, plan_hash=command.plan.content_hash), now, history)
                result = PlanningSourceReceipt(key, p.task_id, command.plan.plan_id, command.plan.content_hash, now)
        return result

    @staticmethod
    def _sources(c, p, command, replay):
        plan = command.plan; work = plan.source_work_plan; iteration = plan.source_iteration_plan; wi = plan.source_work_instruction
        spec_id = "registered-spec-" + p.task_id
        spec_payload = dict(schema="registered_source_reference/v1", source_hashes=dict(SOURCE_HASHES),
            approval_id=APPROVAL_ID, repository_url=p.repository_url, task_id=p.task_id)
        sources = [
            ("design_artifacts", dict(artifact_id=spec_id, revision=1, content_hash=digest(spec_payload),
                actor_type="agent", actor_id=ACTOR, created_at=work.created_at,
                artifact_type="REGISTERED_SOURCE_REFERENCE", source_refs=spec_payload)),
            ("design_baselines", dict(artifact_id=plan.design_baseline_id, revision=1, content_hash=plan.design_baseline_hash,
                actor_type="agent", actor_id=ACTOR, created_at=work.created_at, specification_id=spec_id,
                root_human_approval_id=APPROVAL_ID, parent_baseline_id=None,
                approval_mode="REGISTERED_APPROVAL_SOURCE_REFERENCE", scope=sorted(work.scope), project_id=p.project_id)),
            ("work_plans", dict(artifact_id=work.artifact_id, revision=work.revision, content_hash=work.content_hash,
                created_at=work.created_at, design_baseline_id=work.design_baseline_id,
                design_baseline_hash=work.design_baseline_hash, scope=sorted(work.scope))),
            ("iteration_plans", dict(artifact_id=iteration.artifact_id, revision=iteration.revision,
                content_hash=iteration.content_hash, created_at=iteration.created_at,
                work_plan_id=iteration.work_plan_id, work_plan_hash=iteration.work_plan_hash, sequence=iteration.sequence)),
            ("work_instructions", dict(artifact_id=wi.artifact_id, revision=wi.revision, content_hash=wi.content_hash,
                created_at=wi.created_at, iteration_plan_id=wi.iteration_plan_id, iteration_plan_hash=wi.iteration_plan_hash,
                allowed_paths=list(wi.allowed_paths), allowed_actions=list(wi.allowed_actions), completion_conditions=list(wi.completion_conditions))),
        ]
        exists = [_existing(c, _table(c, name), "artifact_id", data["artifact_id"]) is not None for name, data in sources]
        task = c.execute(sa.text("SELECT task_id FROM tasks WHERE task_id=:task"), {"task": p.task_id}).one_or_none()
        if (not replay and (any(exists) or task is not None)) or (replay and (not all(exists) or task is None)):
            deny("SOURCE_PARTIAL_CONFLICT")
        _exact(c, "project_repositories", "project_id", dict(project_id=p.project_id, repository_id=p.repository_id,
            target_environment=p.environment_id, active=True, version=1), insert=not replay)
        for name, data in sources: _exact(c, name, "artifact_id", data, insert=not replay)
