"""Epoch and token fencing for worker and file write ownership."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import Callable, Iterator
from threading import RLock, local
from pathlib import Path
import os
import stat
from hashlib import sha256
import json
import re
from packages.paths.identity import RepositoryPathMapping

from .models import WorkerLease, WriteLease


class LeaseError(ValueError):
    pass


class StaleFencingToken(LeaseError):
    code = "STALE_FENCING_TOKEN"


@dataclass(frozen=True, slots=True)
class LeaseTakeoverSnapshot:
    """Exact, immutable run lease state used only for takeover compensation."""

    run_id: str
    worker: WorkerLease
    writes: tuple[WriteLease, ...]
    terminal: bool


@dataclass(frozen=True, slots=True)
class RepositoryWriteGrant:
    """E06 identity projection; LeaseService remains the sole lease owner."""
    repository_id: str
    source_root: str
    case_policy: str
    workspace_id: str
    workspace_root: str
    scopes: tuple[str, ...]
    write: WriteLease

    @property
    def content_hash(self):
        return sha256(repr(self).encode()).hexdigest()


def repository_scopes(mapping, paths):
    if type(mapping) is not RepositoryPathMapping or type(paths) is not tuple or not paths:
        raise LeaseError('REPOSITORY_SCOPE_INVALID')
    result=[]
    for value in paths:
        if type(value) is not str or not value or value!=value.strip():raise LeaseError('REPOSITORY_SCOPE_INVALID')
        parts=value.replace('\\','/').split('/')
        if '..' in parts or value.startswith(('//','\\\\','~')):raise LeaseError('REPOSITORY_SCOPE_INVALID')
        try:
            try:relative=mapping.identity.canonical_relative(value)
            except ValueError:relative=mapping.identity.canonical_relative(mapping.workspace_to_source(value))
        except (ValueError,OSError) as exc:raise LeaseError('REPOSITORY_SCOPE_INVALID') from exc
        if relative=='.' or any(p in ('','.git','.env') or p.endswith(('.', ' ')) or ':' in p or '~' in p or re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?',p,re.I) for p in relative.split('/')):
            raise LeaseError('REPOSITORY_SCOPE_INVALID')
        result.append(relative)
    return tuple(sorted(set(result)))


def _scope_overlap(a,b):
    return a==b or a.startswith(b+'/') or b.startswith(a+'/')


_repository_token_context = local()


def _physical_directory(path):
    try:
        resolved=Path(path).resolve(strict=True);value=resolved.stat()
        if not stat.S_ISDIR(value.st_mode) or not value.st_ino:raise OSError()
        return value.st_dev,value.st_ino
    except (OSError,ValueError,RuntimeError) as exc:
        raise LeaseError('REPOSITORY_PHYSICAL_IDENTITY_INVALID') from exc


class LeaseService:
    def __init__(self, *, token_factory: Callable[[], str] = lambda: token_urlsafe(32)) -> None:
        self._token_factory = token_factory
        self._workers: dict[str, WorkerLease] = {}
        self._writes: dict[tuple[str, str], WriteLease] = {}
        self._worker_epochs: dict[str, int] = {}
        self._write_epochs: dict[tuple[str, str], int] = {}
        self._takeover_guards: set[str] = set()
        self._takeover_terminal: set[str] = set()
        self._lock = RLock()
        self._repository_claims: dict[str, tuple[RepositoryWriteGrant,str]] = {}
        self._repository_roots: dict[str, tuple[str,str]] = {}
        self._repository_physical={};self._repository_sources={}
        self._repository_stale=set();self._repository_now=None
        self._repository_preparing=None

    def acquire_repository_write(self, worker, mapping, paths, now, ttl):
        """Atomic cross-run/workspace overlap check on the existing owner lock.

        This local reference seam is not a PostgreSQL-time/multiprocess adapter.
        """
        scopes=repository_scopes(mapping,paths)
        if os.name=='nt':scopes=tuple(sorted({p.casefold() for p in scopes}))
        if type(worker) is not WorkerLease or now.tzinfo is None or ttl<=timedelta(0):raise LeaseError('REPOSITORY_AUTHORITY_INVALID')
        outer=getattr(_repository_token_context,'active',None)
        if outer is not None:
            outer['tainted']=True
            raise LeaseError('REPOSITORY_ACQUIRE_REENTRANCY')
        marker={'tainted':False}
        with self._lock:
            if self._repository_preparing is not None:
                raise LeaseError('REPOSITORY_ACQUIRE_IN_FLIGHT')
            self._repository_preparing=marker
        _repository_token_context.active=marker
        try:token=self._new_token()
        finally:
            _repository_token_context.active=None
            with self._lock:self._repository_preparing=None
        with self._lock:
            if marker['tainted']:raise LeaseError('REPOSITORY_ACQUIRE_REENTRANCY')
            self._reject_guarded_issue(worker.run_id)
            current=self._require_worker(worker.run_id,worker.execution_fencing_token,now)
            if current!=worker or now>=current.expires_at:raise StaleFencingToken('STALE_FENCING_TOKEN')
            identity=mapping.identity;root=identity.source_root
            source_key=_physical_directory(root);workspace_key=_physical_directory(mapping.workspace_root)
            if source_key==workspace_key:raise LeaseError('REPOSITORY_PHYSICAL_IDENTITY_INVALID')
            authority=(identity.repository_id,identity.case_policy)
            if source_key in self._repository_sources and self._repository_sources[source_key]!=authority:raise LeaseError('REPOSITORY_IDENTITY_REBIND')
            if root in self._repository_roots and self._repository_roots[root]!=(identity.repository_id,identity.case_policy):raise LeaseError('REPOSITORY_IDENTITY_REBIND')
            if any(other!=root and value[0]==identity.repository_id for other,value in self._repository_roots.items()):raise LeaseError('REPOSITORY_IDENTITY_REBIND')
            for old,_ in self._repository_claims.values():
                try:self._check_repository_write(old,now,observe=False)
                except StaleFencingToken:continue
                if (old.workspace_root,old.repository_id,old.scopes,old.write.execution_fencing_token)==(mapping.workspace_root,identity.repository_id,scopes,current.execution_fencing_token):return replace(old,write=replace(old.write))
                old_source,old_workspace,_=self._repository_physical[old.write.write_fencing_token]
                if old_workspace==workspace_key:raise LeaseError('WORKSPACE_WRITE_CONFLICT')
                if old_source==source_key and any(_scope_overlap(a,b) for a in old.scopes for b in scopes):raise LeaseError('REPOSITORY_WRITE_CONFLICT')
            if token in self._repository_claims:raise LeaseError('REPOSITORY_TOKEN_REUSE')
            keytext='repository:'+sha256(json.dumps([identity.repository_id,scopes,identity.case_policy]).encode()).hexdigest()
            key=(worker.run_id,keytext);epoch=self._write_epochs.get(key,0)+1
            write=WriteLease(worker.run_id,keytext,epoch,token,worker.execution_fencing_token,min(now+ttl,worker.expires_at))
            grant=RepositoryWriteGrant(identity.repository_id,root,identity.case_policy,mapping.workspace_id,mapping.workspace_root,scopes,write)
            self._observe_repository_time(now)
            self._writes[key]=write;self._write_epochs[key]=epoch
            self._repository_roots[root]=(identity.repository_id,identity.case_policy)
            self._repository_claims[token]=(grant,grant.content_hash)
            self._repository_sources[source_key]=authority
            self._repository_physical[token]=(source_key,workspace_key,now)
            return replace(grant,write=replace(write))

    def _observe_repository_time(self,now):
        if self._repository_now is not None and now<self._repository_now:raise StaleFencingToken('STALE_FENCING_TOKEN')
        self._repository_now=now

    def require_repository_write(self, grant, now):
        with self._lock:
            return self._check_repository_write(grant,now,observe=True)

    def _check_repository_write(self,grant,now,*,observe):
            if type(grant) is not RepositoryWriteGrant:raise StaleFencingToken('STALE_FENCING_TOKEN')
            token=grant.write.write_fencing_token
            if token in self._repository_stale:raise StaleFencingToken('STALE_FENCING_TOKEN')
            stored=self._repository_claims.get(grant.write.write_fencing_token)
            if stored is None or stored[0]!=grant or stored[1]!=grant.content_hash or stored[0].content_hash!=stored[1]:raise StaleFencingToken('STALE_FENCING_TOKEN')
            worker=self._workers.get(grant.write.run_id)
            if worker is None or worker.execution_fencing_token!=grant.write.execution_fencing_token or self._writes.get((grant.write.run_id,grant.write.conflict_scope_key))!=grant.write:raise StaleFencingToken('STALE_FENCING_TOKEN')
            source,workspace,issued=self._repository_physical[token]
            if now.tzinfo is None or now<issued or now>grant.write.expires_at+timedelta(minutes=5):raise StaleFencingToken('CLOCK_OBSERVATION_OUT_OF_RANGE')
            if self._repository_now is not None and now<self._repository_now:raise StaleFencingToken('STALE_FENCING_TOKEN')
            try:
                self._require_current(grant.write.run_id,grant.write.execution_fencing_token,token,now)
                if now<issued or now>=grant.write.expires_at:raise StaleFencingToken('STALE_FENCING_TOKEN')
                if (_physical_directory(grant.source_root),_physical_directory(grant.workspace_root))!=(source,workspace):raise LeaseError('REPOSITORY_PHYSICAL_IDENTITY_CHANGED')
            except (LeaseError,KeyError):
                if observe:
                    if now>=grant.write.expires_at:self._observe_repository_time(now)
                    self._repository_stale.add(token)
                raise
            if observe:self._observe_repository_time(now)

    def issue_worker(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        with self._lock:
            self._reject_guarded_issue(run_id)
            return self._issue_worker(run_id, worker_id, now, ttl)

    def _issue_worker(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        current = self._workers.get(run_id)
        if current is not None and current.expires_at >= now:
            raise LeaseError("active worker lease already exists")
        return self._new_worker(run_id, worker_id, now, ttl)

    def take_over_expired(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        with self._lock:
            self._reject_guarded_issue(run_id)
            return self._take_over_expired(run_id, worker_id, now, ttl)

    def _take_over_expired(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        current = self._workers.get(run_id)
        if current is None or current.expires_at >= now:
            raise LeaseError("worker lease is not expired")
        return self._new_worker(run_id, worker_id, now, ttl)

    def issue_write(self, worker: WorkerLease, scope: str, now: datetime, ttl: timedelta) -> WriteLease:
        with self._lock:
            self._reject_guarded_issue(worker.run_id)
            return self._issue_write(worker, scope, now, ttl)

    def _issue_write(self, worker: WorkerLease, scope: str, now: datetime, ttl: timedelta) -> WriteLease:
        self._require_worker(worker.run_id, worker.execution_fencing_token, now)
        key = (worker.run_id, scope)
        current = self._writes.get(key)
        if current is not None and current.expires_at >= now:
            raise LeaseError("active write lease already exists for conflict scope")
        epoch = self._write_epochs.get(key, 0) + 1
        token = self._new_token()
        lease = WriteLease(worker.run_id, scope, epoch, token, worker.execution_fencing_token, now + ttl)
        self._writes[key] = lease
        self._write_epochs[key] = epoch
        return lease

    def require_current(self, run_id: str, execution_token: str, write_token: str, now: datetime) -> None:
        with self._lock:
            return self._require_current(run_id, execution_token, write_token, now)

    def _require_current(self, run_id: str, execution_token: str, write_token: str, now: datetime) -> None:
        worker = self._require_worker(run_id, execution_token, now)
        matches = [lease for (lease_run, _), lease in self._writes.items() if lease_run == run_id and lease.write_fencing_token == write_token]
        if len(matches) != 1 or matches[0].execution_fencing_token != worker.execution_fencing_token or matches[0].expires_at < now:
            raise StaleFencingToken("current write fencing token is required")

    def revoke_run(self, run_id: str, *, execution_token: str | None = None) -> tuple[WorkerLease | None, tuple[WriteLease, ...]]:
        """Atomically revoke a worker and every write lease owned by ``run_id``.

        A supplied token is checked before mutation; stale callers therefore
        cannot revoke a newer worker's leases.
        """
        with self._lock:
            worker = self._workers.get(run_id)
            if execution_token is not None and (worker is None or worker.execution_fencing_token != execution_token):
                raise StaleFencingToken("current execution fencing token is required")
            writes = tuple(lease for (lease_run, _), lease in self._writes.items() if lease_run == run_id)
            for key in tuple(self._writes):
                if key[0] == run_id:
                    del self._writes[key]
            self._workers.pop(run_id, None)
            return worker, writes

    def takeover_snapshot(
        self, run_id: str, *, execution_token: str,
    ) -> LeaseTakeoverSnapshot:
        """Capture the exact current run state before a coordinated revoke."""
        with self._lock:
            worker = self._workers.get(run_id)
            if worker is None or worker.execution_fencing_token != execution_token:
                raise StaleFencingToken("current execution fencing token is required")
            writes = tuple(
                lease for (lease_run, _), lease in self._writes.items()
                if lease_run == run_id
            )
            return LeaseTakeoverSnapshot(
                run_id, worker, writes, run_id in self._takeover_terminal,
            )

    @contextmanager
    def takeover_transaction(
        self, run_id: str, *, execution_token: str,
    ) -> Iterator[None]:
        """Fence lease issue/takeover until a coordinated takeover commits."""
        with self._lock:
            worker = self._workers.get(run_id)
            if worker is None or worker.execution_fencing_token != execution_token:
                raise StaleFencingToken("current execution fencing token is required")
            if run_id in self._takeover_guards:
                raise LeaseError("takeover transaction is already active")
            self._takeover_guards.add(run_id)
            try:
                yield
            finally:
                self._takeover_guards.remove(run_id)

    def complete_takeover(self, run_id: str) -> None:
        """Leave a terminal fence before the transaction lock is released."""
        with self._lock:
            if run_id not in self._takeover_guards:
                raise LeaseError("takeover transaction is required")
            if self._workers.get(run_id) is not None or any(
                lease_run == run_id for lease_run, _ in self._writes
            ):
                raise LeaseError("lease capability remains active")
            self._takeover_terminal.add(run_id)

    def restore_takeover(self, snapshot: LeaseTakeoverSnapshot) -> None:
        """Restore a prior snapshot without overwriting a newer lease owner."""
        if type(snapshot) is not LeaseTakeoverSnapshot:
            raise LeaseError("valid takeover lease snapshot is required")
        with self._lock:
            current_worker = self._workers.get(snapshot.run_id)
            current_writes = tuple(
                lease for (lease_run, _), lease in self._writes.items()
                if lease_run == snapshot.run_id
            )
            if current_worker not in (None, snapshot.worker):
                raise LeaseError("cannot overwrite a newer worker lease")
            if current_writes and current_writes != snapshot.writes:
                raise LeaseError("cannot overwrite newer write leases")
            for key in tuple(self._writes):
                if key[0] == snapshot.run_id:
                    del self._writes[key]
            self._workers[snapshot.run_id] = snapshot.worker
            for lease in snapshot.writes:
                self._writes[(lease.run_id, lease.conflict_scope_key)] = lease
            if snapshot.terminal:
                self._takeover_terminal.add(snapshot.run_id)
            else:
                self._takeover_terminal.discard(snapshot.run_id)

    def active_writes(self, run_id: str | None = None) -> tuple[WriteLease, ...]:
        with self._lock:
            values = tuple(self._writes.values())
            return values if run_id is None else tuple(item for item in values if item.run_id == run_id)

    def active_worker(self, run_id: str) -> WorkerLease | None:
        with self._lock:
            return self._workers.get(run_id)

    def _reject_guarded_issue(self, run_id: str) -> None:
        if run_id in self._takeover_terminal:
            raise LeaseError("lease issue is fenced by completed takeover")
        if run_id in self._takeover_guards:
            raise LeaseError("lease issue is fenced by active takeover transaction")

    def _new_worker(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        if not run_id or not worker_id or ttl <= timedelta(0):
            raise ValueError("run_id, worker_id and a positive ttl are required")
        epoch = self._worker_epochs.get(run_id, 0) + 1
        lease = WorkerLease(run_id, worker_id, epoch, self._new_token(), now + ttl)
        self._workers[run_id] = lease
        self._worker_epochs[run_id] = epoch
        return lease

    def _require_worker(self, run_id: str, token: str, now: datetime) -> WorkerLease:
        worker = self._workers.get(run_id)
        if worker is None or worker.execution_fencing_token != token or worker.expires_at < now:
            raise StaleFencingToken("current execution fencing token is required")
        return worker

    def _new_token(self) -> str:
        token = self._token_factory()
        if not token:
            raise LeaseError("fencing token must be non-empty")
        return token
