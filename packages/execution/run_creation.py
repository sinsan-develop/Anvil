"""Normal Run creation command and authority-safe receipt."""

from __future__ import annotations
from dataclasses import dataclass
import re
from typing import Protocol

_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")

def _text(value: str, name: str, limit: int = 128) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip() or len(value) > limit:
        raise ValueError(f"{name} is invalid")

@dataclass(frozen=True, slots=True)
class RunCreationCommand:
    run_id: None
    task_id: str
    work_instruction_id: str
    execution_plan_id: str
    expected_task_version: int
    project_id: str
    environment_id: str
    permission_snapshot_hash: str
    prior_run_id: str | None
    resume_checkpoint_id: str | None
    actor_id: str
    correlation_id: str
    idempotency_key: str
    target_hash: str
    reason: str
    def __post_init__(self):
        if self.run_id is not None: raise ValueError("run_id must be server generated")
        for value, name in ((self.task_id,"task_id"),(self.work_instruction_id,"work_instruction_id"),(self.execution_plan_id,"execution_plan_id"),(self.project_id,"project_id"),(self.environment_id,"environment_id"),(self.actor_id,"actor_id"),(self.correlation_id,"correlation_id"),(self.idempotency_key,"idempotency_key"),(self.reason,"reason")): _text(value,name,200 if name in {"actor_id","reason"} else 128)
        if type(self.expected_task_version) is not int or self.expected_task_version < 1: raise ValueError("expected_task_version is invalid")
        if not _HASH.fullmatch(self.target_hash): raise ValueError("target_hash is invalid")
        if not _HASH.fullmatch(self.permission_snapshot_hash): raise ValueError("permission_snapshot_hash is invalid")
        if (self.prior_run_id is None) != (self.resume_checkpoint_id is None): raise ValueError("priorRunId and resumeCheckpointId must be supplied together")
        for value, name in ((self.prior_run_id,"prior_run_id"),(self.resume_checkpoint_id,"resume_checkpoint_id")):
            if value is not None: _text(value,name)

@dataclass(frozen=True, slots=True)
class RunCreationReceipt:
    run_id: str; task_id: str; phase: str; status: str; event_ids: tuple[str, ...]; duplicate: bool

class RunCreationService(Protocol):
    def create(self, command: RunCreationCommand) -> RunCreationReceipt: ...
class RunCreationError(ValueError): pass
class AuthorityMismatch(RunCreationError): pass
class TaskNotFound(RunCreationError): pass
class TaskVersionConflict(RunCreationError): pass
class TaskNotReady(RunCreationError): pass
class ActiveRunConflict(RunCreationError): pass
