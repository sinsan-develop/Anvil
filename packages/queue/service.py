"""At-least-once durable queue reference service.

The persistence adapter owns the production DB-time conditional claim; this
small implementation preserves the same state and fencing contract for tests.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import Callable
from functools import wraps
from hashlib import sha256
from threading import RLock, local

from .models import QueueClaim, QueueJob, QueueStatus, QuarantinedJob


class QueueError(ValueError):
    pass


class QueueTokenError(QueueError):
    code = "STALE_FENCING_TOKEN"


_CALLBACK = local()


def reject_callback_reentry():
    """A swallowed reentrant denial still poisons the outer preparation."""
    if getattr(_CALLBACK,'active',False):
        _CALLBACK.tainted=True
        raise QueueError('QUEUE_CALLBACK_REENTRANCY')


def _outside_callback(callback):
    reject_callback_reentry()
    _CALLBACK.active=True;_CALLBACK.tainted=False
    try:
        value=callback()
        if _CALLBACK.tainted:raise QueueError('QUEUE_CALLBACK_REENTRANCY')
        return value
    finally:_CALLBACK.active=False


def _locked(method):
    @wraps(method)
    def call(self, *args, **kwargs):
        if method.__name__ not in ('get','quarantine','state_stamp'):reject_callback_reentry()
        with self._lock:
            return method(self, *args, **kwargs)
    return call


class DurableQueue:
    def __init__(self, *, token_factory: Callable[[], str] = lambda: token_urlsafe(32)) -> None:
        self._token_factory = token_factory
        self._jobs: dict[str, QueueJob] = {}
        self._quarantine: list[QuarantinedJob] = []
        self._lock = RLock()
        self._claim_policies: dict[str, object] = {}

    @_locked
    def enqueue(self, job: QueueJob) -> None:
        if job.job_id in self._jobs:
            raise QueueError("duplicate queue job")
        self._jobs[job.job_id] = job

    @_locked
    def enqueue_many(self, jobs: tuple[QueueJob, ...]) -> None:
        identities = [job.job_id for job in jobs]
        if len(identities) != len(set(identities)) or set(identities) & self._jobs.keys():
            raise QueueError("duplicate queue job")
        self._jobs.update({job.job_id: job for job in jobs})

    @_locked
    def get(self, job_id: str) -> QueueJob:
        return self._jobs[job_id]

    def claim(self, worker_id: str, now: datetime, *, visibility_timeout: timedelta) -> QueueClaim | None:
        reject_callback_reentry()
        if not worker_id or visibility_timeout <= timedelta(0):
            raise ValueError("worker_id and a positive visibility timeout are required")
        with self._lock:
            self.recover_expired(now)
            candidates=sorted((j for key,j in self._jobs.items() if key not in self._claim_policies and self._ready(j,now,())),key=lambda j:(j.available_at,j.job_id))
            if not candidates:return None
            job=candidates[0];stamp=self.state_stamp()
        tokens=self.prepare_claim_tokens(1)
        with self._lock:
            # A concurrent winner is not an error for the legacy polling API.
            if stamp!=self.state_stamp():return None
            return self._publish_selected(((job.job_id,worker_id),),now,visibility_timeout,tokens,None)[0]

    @_locked
    def state_stamp(self):
        return (tuple(sorted((k,repr(v)) for k,v in self._jobs.items())),
                tuple(sorted((k,id(v)) for k,v in self._claim_policies.items())))

    def prepare_claim_tokens(self,count):
        """Run injected token generation outside every caller-owned lock."""
        reject_callback_reentry()
        if type(count) is not int or not 1<=count<=16:raise QueueError('BATCH_SELECTION_INVALID')
        tokens=tuple(_outside_callback(self._token_factory) for _ in range(count))
        if any(type(t) is not str or not t for t in tokens) or len(set(tokens))!=len(tokens):raise QueueError('BATCH_TOKEN_INVALID')
        return tokens

    def _ready(self,job,now,prepared):
        return (job is not None and job.status is QueueStatus.PENDING and job.available_at<=now
                and job.attempts<job.max_attempts and job.input_verified
                and all(d in self._jobs and self._jobs[d].status is QueueStatus.SUCCEEDED
                        and (self._jobs[d].run_id,self._jobs[d].graph_id,self._jobs[d].graph_hash)==(job.run_id,job.graph_id,job.graph_hash) for d in job.dependency_ids)
                and not any(set(job.conflict_keys)&set(other.conflict_keys) for other in tuple(self._jobs.values())+tuple(prepared) if other.status is QueueStatus.CLAIMED))

    @_locked
    def heartbeat(self, job_id: str, token: str, now: datetime, *, visibility_timeout: timedelta) -> QueueJob:
        if visibility_timeout <= timedelta(0):
            raise ValueError("positive visibility timeout required")
        job = self._require_current(job_id, token, now)
        renewed = job.replace(lease_expires_at=now + visibility_timeout)
        self._jobs[job_id] = renewed
        return renewed

    @_locked
    def bind_claim_policy(self, job_ids: tuple[str, ...], owner: object) -> None:
        """Host-only opaque owner capability, immutable for each registered job.

        E04 jobs without a policy retain the legacy single-claim behavior.
        E05 registers jobs and this policy while holding this same queue lock.
        """
        if (type(owner) is not object or type(job_ids) is not tuple or not job_ids
                or len(set(job_ids))!=len(job_ids)
                or any(j not in self._jobs or self._jobs[j].status is not QueueStatus.PENDING
                       or j in self._claim_policies and self._claim_policies[j] is not owner for j in job_ids)):
            raise QueueError('CLAIM_POLICY_INVALID')
        self._claim_policies.update({j:owner for j in job_ids})

    def claim_selected(self, selections: tuple[tuple[str, str], ...], *, now: datetime,
                       visibility_timeout: timedelta, final_guard=None, owner=None,
                       prepared_tokens=None, expected_stamp=None) -> tuple[QueueClaim, ...]:
        """Prepare arbitrary callbacks outside the lock, then callback-free CAS.

        E05 passes pre-generated tokens/stamp while holding its owner fences;
        no injected callbacks run in that atomic publication path.
        """
        reject_callback_reentry()
        if (type(selections) is not tuple or not 1 <= len(selections) <= 16
                or any(type(p) is not tuple or len(p) != 2 or any(type(x) is not str or not x for x in p) for p in selections)
                or len({p[0] for p in selections}) != len(selections)
                or len({p[1] for p in selections}) != len(selections)
                or now.tzinfo is None or visibility_timeout <= timedelta(0)):
            raise QueueError('BATCH_SELECTION_INVALID')
        with self._lock:
            stamp=self.state_stamp() if expected_stamp is None else expected_stamp
            if any(j in self._claim_policies and owner is not self._claim_policies[j] for j,_ in selections):raise QueueError('CLAIM_OWNER_REQUIRED')
        if prepared_tokens is not None and final_guard is not None:raise QueueError('CALLBACK_FORBIDDEN_IN_PUBLICATION')
        tokens=self.prepare_claim_tokens(len(selections)) if prepared_tokens is None else prepared_tokens
        if type(tokens) is not tuple or len(tokens)!=len(selections) or len(set(tokens))!=len(tokens) or any(type(t) is not str or not t for t in tokens):raise QueueError('BATCH_TOKEN_INVALID')
        if final_guard is not None:_outside_callback(final_guard)
        with self._lock:
            if stamp!=self.state_stamp():raise QueueError('BATCH_QUEUE_DRIFT')
            return self._publish_selected(selections,now,visibility_timeout,tokens,owner)

    def _publish_selected(self,selections,now,visibility_timeout,tokens,owner):
        prepared={};claims=[]
        for (job_id,worker_id),token in zip(sorted(selections),tokens):
            if job_id in self._claim_policies and owner is not self._claim_policies[job_id]:raise QueueError('CLAIM_OWNER_REQUIRED')
            job = self._jobs.get(job_id)
            if not self._ready(job,now,prepared.values()):raise QueueError('BATCH_NOT_READY')
            updated = job.replace(status=QueueStatus.CLAIMED,attempts=job.attempts+1,
                                  lease_epoch=job.lease_epoch+1,execution_fencing_token=token,
                                  lease_expires_at=now+visibility_timeout)
            prepared[job_id] = updated
            claims.append(QueueClaim(job_id,worker_id,updated.lease_epoch,token,updated.lease_expires_at))
        self._jobs.update(prepared)
        return tuple(claims)

    @_locked
    def complete(self, job_id: str, token: str, now: datetime) -> QueueJob:
        current = self._jobs[job_id]
        token_hash = sha256(token.encode()).hexdigest()
        if current.status is QueueStatus.SUCCEEDED and current.completed_token_hash == token_hash:
            return current
        job = self._require_current(job_id, token, now)
        completed = job.replace(status=QueueStatus.SUCCEEDED, execution_fencing_token=None, lease_expires_at=None, completed_token_hash=token_hash)
        self._jobs[job_id] = completed
        return completed

    @_locked
    def fail(self, job_id: str, token: str, now: datetime, reason: str) -> QueueJob:
        if not reason:
            raise ValueError("failure reason is required")
        job = self._require_current(job_id, token, now)
        if job.attempts >= job.max_attempts:
            quarantined = job.replace(status=QueueStatus.QUARANTINED, execution_fencing_token=None, lease_expires_at=None)
            self._jobs[job_id] = quarantined
            self._quarantine.append(QuarantinedJob(job_id, job.attempts, reason, now))
            return quarantined
        retried = job.replace(status=QueueStatus.PENDING, available_at=now, execution_fencing_token=None, lease_expires_at=None)
        self._jobs[job_id] = retried
        return retried

    @_locked
    def recover_expired(self, now: datetime) -> tuple[str, ...]:
        recovered: list[str] = []
        for job in tuple(self._jobs.values()):
            if job.status is QueueStatus.CLAIMED and job.lease_expires_at is not None and job.lease_expires_at < now:
                if job.attempts >= job.max_attempts:
                    self._jobs[job.job_id] = job.replace(
                        status=QueueStatus.QUARANTINED,
                        execution_fencing_token=None,
                        lease_expires_at=None,
                    )
                    self._quarantine.append(
                        QuarantinedJob(job.job_id, job.attempts, "VISIBILITY_TIMEOUT_MAX_ATTEMPTS", now)
                    )
                else:
                    self._jobs[job.job_id] = job.replace(
                        status=QueueStatus.PENDING,
                        available_at=now,
                        execution_fencing_token=None,
                        lease_expires_at=None,
                    )
                recovered.append(job.job_id)
        return tuple(recovered)

    @_locked
    def quarantine(self) -> tuple[QuarantinedJob, ...]:
        return tuple(self._quarantine)

    def _require_current(self, job_id: str, token: str, now: datetime) -> QueueJob:
        job = self._jobs[job_id]
        if (
            job.status is not QueueStatus.CLAIMED
            or job.execution_fencing_token != token
            or job.lease_expires_at is None
            or job.lease_expires_at < now
        ):
            raise QueueTokenError("current execution fencing token is required")
        return job
