"""Read-only projection of public owner methods into Operations views."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
import re

from packages.budget.models import ReservationStatus
from packages.observability.models import DeploymentSignal, HealthSignal


@dataclass(frozen=True, slots=True)
class OperationsSources:
    queue: Any = None
    queue_job_ids: tuple[str, ...] = ()
    leases: Any = None
    lease_run_ids: tuple[str, ...] = ()
    budget: Any = None
    budget_ids: tuple[str, ...] = ()
    reservation_ids: tuple[str, ...] = ()
    request_ids: tuple[str, ...] = ()
    provider: Any = None
    health_signals: tuple[HealthSignal, ...] = ()
    deployments: tuple[DeploymentSignal, ...] = ()


def _health(signal: HealthSignal | None, now: datetime) -> dict:
    if signal is None:
        return {"state": "UNKNOWN", "observed_at": None, "stale_after_seconds": None,
                "last_check": None, "error_count": None, "detail_path": None, "evidence_ref": None}
    age = now - signal.observed_at
    state = "EXPIRED" if age > signal.stale_after else "LATE" if age >= signal.stale_after / 2 else signal.state
    if state == "HEALTHY" and signal.error_count:
        state = "LATE"
    return {"state": state, "observed_at": signal.observed_at.isoformat(),
            "stale_after_seconds": int(signal.stale_after.total_seconds()),
            "last_check": signal.observed_at.isoformat(), "error_count": signal.error_count,
            "detail_path": signal.detail_path, "evidence_ref": signal.evidence_ref}


def _reservation_lifecycle(reservation, dispatch) -> str:
    if dispatch is not None:
        if dispatch.status == "PAUSED_QUOTA":
            return "PAUSED_QUOTA"
        if dispatch.status == "SEND_STARTED" and dispatch.usage is None:
            return "PROVIDER_REQUESTED"
        if dispatch.usage is not None and dispatch.reconciliation is None:
            return "FINAL_USAGE_RECORDED" if dispatch.usage.actual_cost is not None else "USAGE_UNKNOWN"
        if dispatch.reconciliation is not None:
            return "REMAINDER_RELEASED" if reservation.released_cost or reservation.released_tokens else "RECONCILED"
    if reservation.status is ReservationStatus.RECONCILIATION_REQUIRED:
        return "USAGE_UNKNOWN"
    if reservation.status is ReservationStatus.CONSUMED:
        return "RECONCILED"
    return "RESERVED"


def project_operations(sources: OperationsSources, *, observed_at: datetime) -> dict:
    """Call only documented owner reads; missing owners never imply healthy state."""
    if type(sources) is not OperationsSources or observed_at.tzinfo is None:
        raise ValueError("OPERATIONS_SOURCES_INVALID")
    signals = {s.component: s for s in sources.health_signals}
    health = {key: _health(signals.get(key), observed_at) for key in
              ("database", "queue", "worker", "provider", "backend", "artifact_store")}
    gaps = {key for key in ("database", "queue", "worker", "provider", "backend") if key not in signals}
    queue_rows, quarantine_rows, worker_rows, budget_rows, reservation_rows, provider_rows = [], [], [], [], [], []
    if sources.queue is not None:
        for job_id in sources.queue_job_ids:
            job = sources.queue.get(job_id)
            queue_rows.append({"job_id": job.job_id, "run_id": job.run_id, "state": job.status.value,
                "available_at": job.available_at.isoformat(), "attempts": job.attempts,
                "max_attempts": job.max_attempts, "lease_epoch": job.lease_epoch,
                "lease_expires_at": job.lease_expires_at.isoformat() if job.lease_expires_at else None,
                "dependency_ids": list(job.dependency_ids), "conflict_keys": list(job.conflict_keys),
                "priority": "UNKNOWN", "required_capability": "UNKNOWN",
                "input_verified": job.input_verified, "backoff_until": job.available_at.isoformat()})
        quarantine_rows = [{"job_id": row.job_id, "attempts": row.attempts,
                            "reason": row.reason if re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", row.reason) else "OWNER_REPORTED",
                            "quarantined_at": row.quarantined_at.isoformat()}
                           for row in sources.queue.quarantine()]
    if sources.leases is not None:
        for run_id in sources.lease_run_ids:
            worker = sources.leases.active_worker(run_id)
            if worker is None:
                continue
            writes = sources.leases.active_writes(run_id)
            worker_rows.append({"run_id": worker.run_id, "worker_id": worker.worker_id,
                "lease_epoch": worker.lease_epoch, "expires_at": worker.expires_at.isoformat(),
                "health": "EXPIRED" if observed_at > worker.expires_at else "LATE" if worker.expires_at - observed_at <= timedelta(seconds=30) else "HEALTHY",
                "write_scopes": sorted(w.conflict_scope_key for w in writes),
                "write_epochs": sorted(w.write_epoch for w in writes),
                "drain_state": "UNKNOWN", "heartbeat_at": None})
    if sources.budget is not None:
        for budget_id in sources.budget_ids:
            snap = sources.budget.snapshot(budget_id)
            budget_rows.append({"budget_id": snap.budget_id, "hard_cost_limit": str(snap.hard_cost_limit),
                "hard_token_limit": snap.hard_token_limit, "reserved_cost": str(snap.reserved_cost),
                "reserved_tokens": snap.reserved_tokens, "consumed_cost": str(snap.consumed_cost),
                "consumed_tokens": snap.consumed_tokens, "active_requests": snap.active_requests,
                "new_action_allowed": snap.new_action_allowed})
        dispatches = {}
        for request_id in sources.request_ids:
            dispatch = sources.budget.dispatch_receipt(request_id)
            dispatches[dispatch.request.reservation_id] = dispatch
        for reservation_id in sources.reservation_ids:
            reservation = sources.budget.reservation(reservation_id)
            dispatch = dispatches.get(reservation_id)
            usage = dispatch.usage if dispatch is not None else None
            reservation_rows.append({"reservation_id": reservation.reservation_id,
                "budget_id": reservation.budget_id, "run_id": reservation.run_id,
                "forecast_cost": str(reservation.reserved_cost), "forecast_tokens": reservation.reserved_tokens,
                "reserved_cost": str(reservation.reserved_cost), "consumed_cost": str(reservation.consumed_cost),
                "released_cost": str(reservation.released_cost), "actual_cost": str(usage.actual_cost) if usage and usage.actual_cost is not None else None,
                "actual_tokens": usage.actual_tokens if usage else None,
                "lifecycle": _reservation_lifecycle(reservation, dispatch),
                "quota_paused": bool(dispatch and dispatch.pause)})
    if sources.provider is not None:
        provider_rows = [{"provider_id": p.provider_id, "status": p.status,
                          "health_status": p.health_status, "credential_status": p.credential_status}
                         for p in sources.provider.list()]
    deployments = [{"deployment_id": d.deployment_id, "state": d.state,
        "observed_at": d.observed_at.isoformat(), "evidence_ref": d.evidence_ref,
        "smoke_passed": d.smoke_passed, "monitoring_completed": d.monitoring_completed,
        "owner_confirmed": d.owner_confirmed, "critical_alerts": d.critical_alerts,
        "release_ready": bool(d.smoke_passed and d.monitoring_completed and d.owner_confirmed and d.critical_alerts == 0)}
        for d in sources.deployments]
    if not deployments:
        gaps.add("deployment")
    return {"observed_at": observed_at.isoformat(), "health": health,
        "queue": queue_rows, "quarantine": quarantine_rows, "worker": worker_rows,
        "budget": budget_rows, "reservations": reservation_rows, "providers": provider_rows,
        "deployments": deployments, "source_gaps": sorted(gaps)}
