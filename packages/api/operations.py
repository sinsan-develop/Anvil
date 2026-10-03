"""Authenticated F-13 Operations read port over a trusted scoped owner."""

from packages.observability.service import OperationsService
from packages.observability.run_status_summary import ScopedRunStatusSummary
from packages.persistence.operations_repository import _safe_event, _safe_identifier
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import re

from .common import ApiContractError, ApplicationRequest


class OperationsPort:
    _ALERTS = "GET /api/operations/alerts"
    _AUDIT = "GET /api/operations/audit"
    _DASHBOARD = "GET /api/dashboard/operations"
    _SNAPSHOT_FIELDS = frozenset({"observed_at", "health", "queue", "quarantine",
        "worker", "budget", "reservations", "providers", "deployments",
        "source_gaps", "alerts", "next_actions"})
    _ALERT_FIELDS = frozenset({"alert_id", "level", "source", "category", "code",
        "related_entity_id", "dedupe_key", "detector_rule_revision", "cause",
        "impact", "next_action", "deep_link", "evidence_hash", "status",
        "owner_id", "observed_at", "project_id", "environment_id", "sequence"})

    def __init__(self, owner: OperationsService):
        if type(owner) is not OperationsService:
            raise ValueError("TRUSTED_OPERATIONS_OWNER_REQUIRED")
        self._owner = owner

    def query_ports(self):
        return {self._ALERTS: self, self._AUDIT: self, self._DASHBOARD: self}

    def _run_summary(self):
        fields = ("observed_total", "active_runs", "waiting_approval_runs", "blocked_runs")
        unavailable = {"status": "UNAVAILABLE", "observed_at": None,
                       **{key: None for key in fields}}
        try:
            summary = self._owner.run_summary()
            if type(summary) is not ScopedRunStatusSummary:
                return unavailable
            at = summary.observed_at
            counts = [getattr(summary, key) for key in fields]
            # Reject custom datetime/tz callbacks before comparisons/serialization.
            if (type(at) is not datetime or type(at.tzinfo) not in (timezone, ZoneInfo)
                    or at > datetime.now(timezone.utc)
                    or any(type(value) is not int or not 0 <= value <= 100 for value in counts)
                    or sum(counts[1:]) > counts[0]):
                return unavailable
            return {"status": "AVAILABLE", "observed_at": at.isoformat(),
                    **dict(zip(fields, counts))}
        except Exception:
            return unavailable

    def __call__(self, request: ApplicationRequest):
        if (request.authorized_project_id != self._owner.project_id
                or request.authorized_environment_id != self._owner.environment_id
                or self._owner.project_id not in request.principal.project_ids
                or self._owner.environment_id not in request.principal.environment_ids):
            raise ApiContractError("AUTHORIZATION_SCOPE_MISMATCH", "The Operations scope is not allowed.", 403)
        if request.endpoint_key == self._DASHBOARD:
            try:
                result = self._owner.snapshot()
                if type(result) is not dict or set(result) != self._SNAPSHOT_FIELDS:
                    raise ValueError("DASHBOARD_SNAPSHOT_INVALID")
                if type(result["alerts"]) is not list:
                    raise ValueError("DASHBOARD_ALERTS_INVALID")
                alerts = []
                for alert in result["alerts"]:
                    if type(alert) is not dict:
                        raise ValueError("DASHBOARD_ALERT_INVALID")
                    safe = {key: alert[key] for key in self._ALERT_FIELDS if key in alert}
                    if (set(safe) != self._ALERT_FIELDS
                            or type(safe["sequence"]) is not int or safe["sequence"] < 1
                            or safe["status"] not in {"open", "acknowledged", "resolved"}
                            or (safe["status"] == "open" and safe["owner_id"] is not None)
                            or (safe["status"] != "open" and not _safe_identifier(safe["owner_id"]))):
                        raise ValueError("DASHBOARD_ALERT_INVALID")
                    initial = {key: value for key, value in safe.items() if key != "sequence"}
                    initial["status"] = "open"
                    initial["owner_id"] = None
                    _safe_event({"action": "DETECTED", "alert_id": safe["alert_id"],
                        "actor_id": "system:detector", "at": safe["observed_at"],
                        "approval_id": None, "evidence_hash": safe["evidence_hash"],
                        "alert": initial}, self._owner.project_id, self._owner.environment_id)
                    alerts.append(safe)
                result["alerts"] = alerts
                result["next_actions"] = [{"priority": alert["level"],
                    "reason": alert["cause"], "target": alert["related_entity_id"],
                    "action": alert["next_action"], "deep_link": alert["deep_link"]}
                    for alert in alerts if alert["status"] != "resolved"]
                result["run_summary"] = self._run_summary()
                return result
            except Exception:
                raise ApiContractError("DASHBOARD_SOURCE_UNAVAILABLE",
                    "The Dashboard source is unavailable.", 503) from None
        if request.endpoint_key == self._ALERTS:
            before = request.headers.get("x-alert-before-sequence")
            if before is not None and not re.fullmatch(r"[1-9][0-9]{0,17}", before):
                raise ApiContractError("ALERT_CURSOR_INVALID", "The alert cursor is invalid.", 400)
            return self._owner.alert_page(before_sequence=int(before) if before is not None else None)
        if request.endpoint_key == self._AUDIT:
            before = request.headers.get("x-audit-before-sequence")
            if before is not None and not re.fullmatch(r"[1-9][0-9]{0,17}", before):
                raise ApiContractError("AUDIT_CURSOR_INVALID", "The audit cursor is invalid.", 400)
            events = self._owner.audit(before_sequence=int(before) if before is not None else None)
            return {"events": events, "next_before_sequence": events[0]["sequence"]
                if events and events[0]["sequence"] > 1 else None}
        raise ApiContractError("CAPABILITY_NOT_AVAILABLE", "This API capability is not available.", 501)
