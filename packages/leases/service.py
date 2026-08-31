"""Epoch and token fencing for worker and file write ownership."""

from __future__ import annotations

from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import Callable
from threading import RLock

from .models import WorkerLease, WriteLease


class LeaseError(ValueError):
    pass


class StaleFencingToken(LeaseError):
    code = "STALE_FENCING_TOKEN"


class LeaseService:
    def __init__(self, *, token_factory: Callable[[], str] = lambda: token_urlsafe(32)) -> None:
        self._token_factory = token_factory
        self._workers: dict[str, WorkerLease] = {}
        self._writes: dict[tuple[str, str], WriteLease] = {}
        self._worker_epochs: dict[str, int] = {}
        self._write_epochs: dict[tuple[str, str], int] = {}
        self._lock = RLock()

    def issue_worker(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        with self._lock:
            return self._issue_worker(run_id, worker_id, now, ttl)

    def _issue_worker(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        current = self._workers.get(run_id)
        if current is not None and current.expires_at >= now:
            raise LeaseError("active worker lease already exists")
        return self._new_worker(run_id, worker_id, now, ttl)

    def take_over_expired(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        with self._lock:
            return self._take_over_expired(run_id, worker_id, now, ttl)

    def _take_over_expired(self, run_id: str, worker_id: str, now: datetime, ttl: timedelta) -> WorkerLease:
        current = self._workers.get(run_id)
        if current is None or current.expires_at >= now:
            raise LeaseError("worker lease is not expired")
        return self._new_worker(run_id, worker_id, now, ttl)

    def issue_write(self, worker: WorkerLease, scope: str, now: datetime, ttl: timedelta) -> WriteLease:
        with self._lock:
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

    def active_writes(self, run_id: str | None = None) -> tuple[WriteLease, ...]:
        with self._lock:
            values = tuple(self._writes.values())
            return values if run_id is None else tuple(item for item in values if item.run_id == run_id)

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
