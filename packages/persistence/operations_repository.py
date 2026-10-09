"""PostgreSQL F-13 audit owner with transaction-serialized project/environment CAS."""

from __future__ import annotations

from copy import deepcopy
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9:._-]{0,127}\Z")
_CREDENTIAL_MARKER = re.compile(r"(?<![A-Za-z0-9])sk-", re.IGNORECASE)
_ACTIONS = frozenset({"DETECTED", "ACKNOWLEDGED", "RESOLVED"})
_FIELDS = frozenset({"action", "alert_id", "actor_id", "at", "approval_id", "evidence_hash", "alert"})
_ALERT_FIELDS = frozenset({"alert_id", "level", "source", "category", "code", "related_entity_id",
                           "dedupe_key", "detector_rule_revision", "cause", "impact", "next_action",
                           "deep_link", "evidence_hash", "status", "owner_id", "observed_at",
                           "project_id", "environment_id"})
_RULES = {
    "WORKER_LEASE_EXPIRED": ("worker", "availability", "Worker lease expiry observed",
                             "Run ownership cannot be trusted", "REVIEW_WORKER_TAKEOVER", "/operations/workers"),
    "QUEUE_JOB_QUARANTINED": ("orchestrator", "backlog", "Queue job reached quarantine",
                              "Run cannot advance automatically", "REVIEW_QUARANTINE", "/operations/queue"),
    "BUDGET_RECONCILIATION_REQUIRED": ("provider", "cost", "Usage is not finalized",
                                       "Budget exposure remains reserved", "RECONCILE_USAGE", "/operations/cost"),
    "HEALTH_ERROR_COUNT": ("environment", "availability", "Health observation requires attention",
                           "Current service health requires review", "CHECK_SOURCE_HEALTH", None),
    "HEALTH_SIGNAL_UNKNOWN": ("environment", "availability", "Health observation requires attention",
                              "Current service health requires review", "CHECK_SOURCE_HEALTH", None),
    "HEALTH_SIGNAL_LATE": ("environment", "availability", "Health observation requires attention",
                           "Current service health requires review", "CHECK_SOURCE_HEALTH", None),
    "HEALTH_SIGNAL_EXPIRED": ("environment", "availability", "Health observation requires attention",
                              "Current service health requires review", "CHECK_SOURCE_HEALTH", None),
}


def _safe_identifier(value: object) -> bool:
    return type(value) is str and _ID.fullmatch(value) is not None and _CREDENTIAL_MARKER.search(value) is None


def _safe_event(event: dict, project_id: str, environment_id: str) -> dict:
    if type(event) is not dict or set(event) - _FIELDS or not {"action", "alert_id", "actor_id", "at", "approval_id", "evidence_hash"}.issubset(event):
        raise ValueError("AUDIT_EVENT_INVALID")
    if (type(event["action"]) is not str or event["action"] not in _ACTIONS
            or not _safe_identifier(project_id) or not _safe_identifier(environment_id)
            or not _safe_identifier(event["alert_id"]) or not _safe_identifier(event["actor_id"])
            or type(event["evidence_hash"]) is not str
            or _HASH.fullmatch(event["evidence_hash"]) is None):
        raise ValueError("AUDIT_EVENT_INVALID")
    from datetime import datetime
    try:
        at = datetime.fromisoformat(event["at"])
    except (TypeError, ValueError):
        raise ValueError("AUDIT_EVENT_INVALID") from None
    if at.tzinfo is None or (event["approval_id"] is not None and
            not _safe_identifier(event["approval_id"])):
        raise ValueError("AUDIT_EVENT_INVALID")
    if event["action"] == "DETECTED":
        alert = event.get("alert")
        if (type(alert) is not dict or set(alert) != _ALERT_FIELDS
                or alert["alert_id"] != event["alert_id"]
                or alert["project_id"] != project_id or alert["environment_id"] != environment_id
                or not _safe_identifier(alert["related_entity_id"])
                or alert["detector_rule_revision"] != "f13-r2"
                or alert["dedupe_key"] !=
                    f'f13-r2:{project_id}:{environment_id}:{alert["code"]}:{alert["related_entity_id"]}'
                or type(alert["evidence_hash"]) is not str
                or _HASH.fullmatch(alert["evidence_hash"]) is None
                or alert["evidence_hash"] != event["evidence_hash"]
                or type(alert["deep_link"]) is not str
                or not alert["deep_link"].startswith("/") or alert["deep_link"].startswith("//")
                or "?" in alert["deep_link"] or "#" in alert["deep_link"]
                or alert["observed_at"] != event["at"] or alert["status"] != "open"
                or alert["owner_id"] is not None):
            raise ValueError("AUDIT_EVENT_INVALID")
        rule = _RULES.get(alert["code"]) if type(alert["code"]) is str else None
        if (rule is None or tuple(alert[key] for key in
                ("source", "category", "cause", "impact", "next_action")) != rule[:5]
                or rule[5] is not None and alert["deep_link"] != rule[5]
                or alert["level"] != ("critical" if "EXPIRED" in alert["code"] or "QUARANTINED" in alert["code"] else "warning")):
            raise ValueError("AUDIT_EVENT_INVALID")
        for key, value in alert.items():
            if type(value) not in (str, type(None)):
                raise ValueError("AUDIT_EVENT_INVALID")
            if type(value) is str and (len(value) > 512 or _CREDENTIAL_MARKER.search(value) is not None
                    or any(marker in value.lower() for marker in
                    ("secret://", "token=", "bearer ", "http://", "https://", "127.0.0.1", "localhost"))):
                raise ValueError("AUDIT_EVENT_INVALID")
    elif "alert" in event or event["approval_id"] is None:
        raise ValueError("AUDIT_EVENT_INVALID")
    return deepcopy(event)


class PostgresOperationsRepository:
    """Host injects this adapter; never instantiated by default ASGI runtime."""

    def __init__(self, dsn: str):
        if type(dsn) is not str or not dsn.strip():
            raise ValueError("OPERATIONS_DSN_REQUIRED")
        self._dsn = dsn

    def _connect(self):
        import psycopg
        return psycopg.connect(self._dsn)

    def load(self, project_id: str, environment_id: str) -> tuple[dict, ...]:
        if not project_id or not environment_id:
            raise ValueError("OPERATIONS_SCOPE_REQUIRED")
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT payload FROM operations_audit_events WHERE project_id=%s AND environment_id=%s ORDER BY sequence_no",
                (project_id, environment_id)).fetchall()
        return tuple(deepcopy(row[0]) for row in rows)

    def load_complete(self, project_id: str, environment_id: str) -> tuple[tuple[int, dict], ...]:
        """Read one scoped, repeatable snapshot and reject missing audit sequences."""
        if not _safe_identifier(project_id) or not _safe_identifier(environment_id):
            raise ValueError("OPERATIONS_SCOPE_REQUIRED")
        with self._connect() as connection:
            connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            head = connection.execute(
                "SELECT next_sequence FROM operations_audit_heads "
                "WHERE project_id=%s AND environment_id=%s", (project_id, environment_id)).fetchone()
            rows = connection.execute(
                "SELECT sequence_no,payload FROM operations_audit_events "
                "WHERE project_id=%s AND environment_id=%s ORDER BY sequence_no",
                (project_id, environment_id)).fetchall()
        result = tuple((sequence, deepcopy(payload)) for sequence, payload in rows)
        expected_count = 0 if head is None else head[0] - 1
        if (type(expected_count) is not int or expected_count < 0
                or len(result) != expected_count
                or any(type(sequence) is not int or sequence != index
                       for index, (sequence, _payload) in enumerate(result, 1))):
            raise ValueError("AUDIT_SEQUENCE_INCOMPLETE")
        return result

    def append(self, project_id: str, environment_id: str, expected_sequence: int,
               event: dict) -> None:
        if not project_id or not environment_id or type(expected_sequence) is not int or expected_sequence < 0:
            raise ValueError("AUDIT_SEQUENCE_CONFLICT")
        payload = _safe_event(event, project_id, environment_id)
        from psycopg.types.json import Jsonb
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO operations_audit_heads(project_id,environment_id,next_sequence) VALUES (%s,%s,1) "
                "ON CONFLICT (project_id,environment_id) DO NOTHING", (project_id, environment_id))
            row = connection.execute(
                "SELECT next_sequence FROM operations_audit_heads WHERE project_id=%s AND environment_id=%s FOR UPDATE",
                (project_id, environment_id)).fetchone()
            if row is None or row[0] != expected_sequence + 1:
                raise ValueError("AUDIT_SEQUENCE_CONFLICT")
            connection.execute(
                "INSERT INTO operations_audit_events(project_id,environment_id,sequence_no,payload) VALUES (%s,%s,%s,%s)",
                (project_id, environment_id, expected_sequence + 1, Jsonb(payload)))
            connection.execute(
                "UPDATE operations_audit_heads SET next_sequence=next_sequence+1 "
                "WHERE project_id=%s AND environment_id=%s", (project_id, environment_id))
