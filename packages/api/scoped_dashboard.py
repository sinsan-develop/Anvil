"""Read-only, request-scoped Dashboard projection from complete Operations audit."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from packages.persistence.operations_repository import _safe_event


class DashboardSourceUnavailable(ValueError):
    """A scoped source cannot prove a complete Dashboard read."""


_DAYS = {"1d": 1, "7d": 7, "30d": 30}
_SEOUL = ZoneInfo("Asia/Seoul")


def _utc_string(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _metric(source: str, observed_at: str | None, *, count: int | None = None,
            reason: str | None = None) -> dict:
    return {"status": "AVAILABLE" if count is not None else "UNAVAILABLE", "count": count,
            "source": source, "observedAt": observed_at, "reason": reason}


def _complete_events(owner, project_id: str, environment_id: str) -> tuple[dict, ...]:
    try:
        rows = owner.load_complete(project_id, environment_id)
        if type(rows) is not tuple:
            raise ValueError("audit rows are incomplete")
        events = []
        for expected, row in enumerate(rows, 1):
            if (type(row) is not tuple or len(row) != 2 or type(row[0]) is not int
                    or row[0] != expected or type(row[1]) is not dict):
                raise ValueError("audit sequence is incomplete")
            events.append(row[1])
        return tuple(events)
    except Exception:
        raise DashboardSourceUnavailable("DASHBOARD_SOURCE_UNAVAILABLE") from None


def read_scoped_dashboard(project_id: str, environment_id: str, period_key: str,
                          observed_at: datetime, operations_owner,
                          current_sources: dict | None = None) -> dict:
    """Never infer period counts from a current snapshot or a bounded alert page."""
    if (period_key not in _DAYS or type(observed_at) is not datetime
            or observed_at.tzinfo is None or observed_at.utcoffset() != timedelta(0)):
        raise ValueError("SCOPED_DASHBOARD_INVALID_PERIOD")
    if type(project_id) is not str or not project_id or type(environment_id) is not str or not environment_id:
        raise ValueError("SCOPED_DASHBOARD_INVALID_SCOPE")
    observed_at = observed_at.astimezone(timezone.utc)
    local_today = observed_at.astimezone(_SEOUL).date()
    start_local = datetime.combine(local_today - timedelta(days=_DAYS[period_key] - 1), time.min, _SEOUL)
    end_local = datetime.combine(local_today + timedelta(days=1), time.min, _SEOUL)
    start = start_local.astimezone(timezone.utc)
    end = end_local.astimezone(timezone.utc)
    observed_text = _utc_string(observed_at)
    events = _complete_events(operations_owner, project_id, environment_id)
    latest: dict[str, dict] = {}
    detected: set[str] = set()
    try:
        for event in events:
            _safe_event(event, project_id, environment_id)
            action, alert_id = event["action"], event["alert_id"]
            at = datetime.fromisoformat(event["at"])
            if (type(alert_id) is not str or not alert_id or at.tzinfo is None
                    or at.utcoffset() is None or action not in {"DETECTED", "ACKNOWLEDGED", "RESOLVED"}):
                raise ValueError("invalid audit event")
            at = at.astimezone(timezone.utc)
            if at > observed_at:
                continue
            if action == "DETECTED":
                alert = event["alert"]
                if (type(alert) is not dict or alert.get("alert_id") != alert_id
                        or alert.get("project_id") != project_id
                        or alert.get("environment_id") != environment_id
                        or alert.get("level") not in {"critical", "warning"}
                        or type(alert.get("next_action")) is not str
                        or alert.get("observed_at") != event["at"]):
                    raise ValueError("invalid scoped alert")
                latest[alert_id] = {"alertId": alert_id, "status": "open",
                                    "level": alert["level"], "nextAction": alert["next_action"],
                                    "observedAt": _utc_string(at)}
                if alert["level"] == "critical" and start <= at < min(end, observed_at):
                    detected.add(alert_id)
            else:
                if alert_id not in latest:
                    raise ValueError("missing detected alert")
                if action == "ACKNOWLEDGED" and latest[alert_id]["status"] != "open":
                    raise ValueError("invalid acknowledge transition")
                if action == "RESOLVED" and latest[alert_id]["status"] != "acknowledged":
                    raise ValueError("invalid resolve transition")
                latest[alert_id]["status"] = "acknowledged" if action == "ACKNOWLEDGED" else "resolved"
    except Exception:
        raise DashboardSourceUnavailable("DASHBOARD_SOURCE_UNAVAILABLE") from None
    unresolved = [row for row in latest.values()
                  if row["level"] == "critical" and row["status"] != "resolved"]
    actionable = [row for row in latest.values() if row["status"] != "resolved"]
    unsupported = ("runStarted", "gateFailed", "costExceeded", "baselineConflict")
    occurrences = {"criticalDetected": _metric("operations_audit_events", observed_text,
                                                 count=len(detected))}
    occurrences.update({name: _metric("NO_COMPLETE_PERIOD_SOURCE", None,
                                      reason="SOURCE_UNAVAILABLE") for name in unsupported})
    pair = {"projectId": project_id, "environmentId": environment_id}
    current_gaps = ("health", "run", "queue", "agent", "provider", "approvalPending",
                    "blocked", "gate", "cost", "baseline")
    def completeness(source: str, complete: bool, reason: str | None) -> dict:
        return {"source": source, "pair": pair, "complete": complete,
                "eventTimeBasis": "DETECTED.at" if complete else None,
                "observedAt": observed_text if complete else None, "reason": reason}
    source_cards = {}
    source_evidence = {}
    for name in ("run", "queue", "agent"):
        source = (current_sources or {}).get(name)
        try:
            source_time = source.observed_at
            if (type(source_time) is not datetime or source_time.tzinfo is None
                    or source_time.utcoffset() is None
                    or source_time > datetime.now(timezone.utc) + timedelta(seconds=5)):
                raise ValueError("unverified observation time")
            if name == "run":
                items = [{"runId": row.run_id, "status": row.status.value,
                          "phase": row.phase.value} for row in
                         (source.get(run_id) for run_id in source.run_ids)]
            elif name == "queue":
                if source.legacy_unscoped_present:
                    raise ValueError("legacy unscoped queue")
                items = [{"jobId": row.job_id, "status": row.status.value} for row in
                         (source.get(job_id) for job_id in source.job_ids)]
            else:
                items = [{"sessionId": row.session_id, "status": row.status}
                         for row in source.agents]
            source_cards[name] = {**_metric(f"scoped_{name}_owner", _utc_string(source_time),
                                              count=len(items)), "items": items}
            source_evidence[name] = {**completeness(f"scoped_{name}_owner", True, None),
                                     "observedAt": _utc_string(source_time),
                                     "eventTimeBasis": "CURRENT_OBSERVATION"}
        except Exception:
            pass
    return {
        "period": {"key": period_key, "timeZone": "Asia/Seoul", "startUtc": _utc_string(start),
                   "endUtc": _utc_string(end), "observedAt": observed_text},
        "current": {"health": {name: {"status": "UNAVAILABLE", "reason": "SOURCE_UNAVAILABLE"}
                               for name in ("database", "queue", "worker", "provider", "backend",
                                            "artifact_store")},
                    "run": source_cards.get("run", _metric("NO_VERIFIED_CURRENT_SOURCE", None,
                                                            reason="SOURCE_UNAVAILABLE")),
                    "queue": source_cards.get("queue", _metric("NO_VERIFIED_CURRENT_SOURCE", None,
                                                                reason="SOURCE_UNAVAILABLE")),
                    "agent": source_cards.get("agent", _metric("NO_VERIFIED_CURRENT_SOURCE", None,
                                                                reason="SOURCE_UNAVAILABLE")),
                    "provider": _metric("NO_VERIFIED_CURRENT_SOURCE", None, reason="SOURCE_UNAVAILABLE"),
                    "approvalPending": _metric("NO_VERIFIED_CURRENT_SOURCE", None, reason="SOURCE_UNAVAILABLE"),
                    "blocked": _metric("NO_VERIFIED_CURRENT_SOURCE", None, reason="SOURCE_UNAVAILABLE"),
                    "gate": _metric("NO_VERIFIED_CURRENT_SOURCE", None, reason="SOURCE_UNAVAILABLE"),
                    "cost": _metric("NO_VERIFIED_CURRENT_SOURCE", None, reason="SOURCE_UNAVAILABLE"),
                    "baseline": _metric("NO_VERIFIED_CURRENT_SOURCE", None, reason="SOURCE_UNAVAILABLE"),
                    "unresolvedCritical": unresolved,
                    "nextActions": [{"alertId": row["alertId"], "action": row["nextAction"]}
                                    for row in actionable]},
        "occurrences": occurrences,
        "sourceCompleteness": {"current": {
            **{name: completeness("NO_VERIFIED_CURRENT_SOURCE", False, "SOURCE_UNAVAILABLE")
               for name in current_gaps},
            **source_evidence,
            "unresolvedCritical": completeness("operations_audit_events", True, None),
            "nextActions": completeness("operations_audit_events", True, None)},
            "occurrences": {name: {**completeness(metric["source"],
                metric["status"] == "AVAILABLE", metric["reason"]),
                "observedAt": metric["observedAt"]}
                for name, metric in occurrences.items()}},
    }
