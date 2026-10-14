"""승인 원본 등록 전용 host 계약. 사람 승인·공개 API·Run 실행 권위가 아니다."""
from dataclasses import dataclass, field, fields
from datetime import datetime, timedelta
from hashlib import sha256
import re
from types import MappingProxyType

from .approval_requests import capture, digest, identity, utc

ACTOR = "anvil-internal-planning-main"
PERMISSION = "planning-sources:register"
PROJECT = "anvil-wsl-development"
ENVIRONMENT = "wsl-development"
REPOSITORY_URL = "git@github-sinsan-develop:sinsan-develop/Anvil.git"
APPROVAL_ID = "APPROVAL-20261014-U01-PLANNING-SOURCE-REGISTRATION-001"
SOURCE_HASHES = MappingProxyType({
    "Anvil_설계서_v2.md": "2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7",
    "Anvil_작업계획서_v1.md": "19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4",
    "docs/approvals/APPROVAL-20261014-U01-APPROVAL-REQUEST-LEDGER-001.md": "E9C0B7A0927C104A4EC4D14B788C06C340179512CA7C9CB24887B879B2F6E4B6",
    "docs/approvals/APPROVAL-20261014-U01-TASK-PLANNING-AUTHORITY-001.md": "F9966B488C7F0A088ED79EA0319E19726706A3FFA829CEE811ADD84F5FE9E06A",
    "docs/approvals/APPROVAL-20261014-U01-PLANNING-SOURCE-REGISTRATION-001.md": "9E036B629FDAC21089CACFEA215BC489FA3C5A0C3E6A4D529F18F84ECA707A9E",
})


class PlanningSourceRejected(ValueError):
    """원본·capability·SQL을 포함하지 않는 안정 오류."""


def deny(code="SOURCE_REGISTRATION_INVALID"):
    raise PlanningSourceRejected(code)


@dataclass(frozen=True, slots=True)
class PlanningSourcePolicy:
    task_id: str
    repository_id: str
    issued_at: datetime
    expires_at: datetime
    project_id: str = PROJECT
    environment_id: str = ENVIRONMENT
    repository_url: str = REPOSITORY_URL
    actor_id: str = ACTOR
    permission: str = PERMISSION

    def __post_init__(self):
        identity(self.task_id); identity(self.repository_id)
        if len(self.task_id) > 64: deny()
        for name, expected in (("project_id", PROJECT), ("environment_id", ENVIRONMENT),
                ("repository_url", REPOSITORY_URL), ("actor_id", ACTOR), ("permission", PERMISSION)):
            value = getattr(self, name)
            if type(value) is not str or value != expected: deny("SOURCE_POLICY_DENIED")
        start, end = utc(self.issued_at), utc(self.expires_at)
        if not timedelta(0) < end - start <= timedelta(hours=1): deny("SOURCE_POLICY_DENIED")
        object.__setattr__(self, "issued_at", start)
        object.__setattr__(self, "expires_at", end)


@dataclass(frozen=True, slots=True)
class PlanningSourceGrant:
    grant_id: str
    capability: str = field(repr=False)
    epoch: int


@dataclass(frozen=True, slots=True)
class PlanningSourceReceipt:
    receipt_id: str
    task_id: str
    plan_id: str
    plan_hash: str
    registered_at: datetime
    status: str = "REGISTERED"


def policy_snapshot(policy):
    if type(policy) is not PlanningSourcePolicy: deny("SOURCE_POLICY_DENIED")
    return PlanningSourcePolicy(**{f.name: object.__getattribute__(policy, f.name) for f in fields(policy)})


def policy_payload(policy):
    p = policy_snapshot(policy)
    return {f.name: getattr(p, f.name).isoformat() if f.name.endswith("_at") else getattr(p, f.name) for f in fields(p)}


def source_baseline_hash(policy):
    p = policy_snapshot(policy)
    return digest(dict(schema="registered_approval_source/v1", project_id=p.project_id,
        repository_id=p.repository_id, repository_url=p.repository_url, task_id=p.task_id,
        approval_id=APPROVAL_ID, source_hashes=dict(SOURCE_HASHES)))


def admission(policy, command, sources):
    p = policy_snapshot(policy)
    if type(sources) is not dict or len(sources) != len(SOURCE_HASHES): deny("SOURCE_BYTES_MISMATCH")
    if any(type(k) is not str for k in sources) or set(sources) != set(SOURCE_HASHES): deny("SOURCE_BYTES_MISMATCH")
    for path, expected in SOURCE_HASHES.items():
        raw = sources[path]
        if type(raw) is not bytes or len(raw) > 8_000_000 or sha256(raw).hexdigest().upper() != expected:
            deny("SOURCE_BYTES_MISMATCH")
    try:
        c = capture(command)
    except Exception:
        deny("SOURCE_PLAN_INVALID")
    if ((c.task_id, c.project_id, c.environment_id) != (p.task_id, p.project_id, p.environment_id)
            or c.run_id is not None or c.plan.design_baseline_hash != source_baseline_hash(p)
            or c.plan.baseline_hash != source_baseline_hash(p)):
        deny("SOURCE_PLAN_INVALID")
    fingerprint = digest(dict(policy=policy_payload(p), source_hashes=dict(SOURCE_HASHES),
        plan_hash=c.plan.content_hash, mode_hash=c.mode.content_hash, idempotency_key=c.idempotency_key))
    return p, c, fingerprint


def grant_snapshot(grant):
    if type(grant) is not PlanningSourceGrant: deny("SOURCE_GRANT_DENIED")
    if (type(grant.grant_id) is not str or type(grant.capability) is not str
            or not re.fullmatch(r"[0-9a-f]{64}", grant.capability)
            or type(grant.epoch) is not int or grant.epoch < 1): deny("SOURCE_GRANT_DENIED")
    identity(grant.grant_id)
    return PlanningSourceGrant(grant.grant_id, grant.capability, grant.epoch)


class PlanningSourceRegistrar:
    def __init__(self, repository):
        from packages.persistence.planning_source_repository import PlanningSourceRepository
        if type(repository) is not PlanningSourceRepository: deny()
        self.__repository = repository

    def issue(self, policy, command, source_bytes):
        return self.__repository.issue(policy, command, source_bytes)

    def revoke(self, policy, grant):
        return self.__repository.revoke(policy, grant)


class PlanningSourceRegistrationService:
    def __init__(self, repository):
        from packages.persistence.planning_source_repository import PlanningSourceRepository
        if type(repository) is not PlanningSourceRepository: deny()
        self.__repository = repository

    def register(self, policy, command, source_bytes, grant):
        return self.__repository.register(policy, command, source_bytes, grant)
