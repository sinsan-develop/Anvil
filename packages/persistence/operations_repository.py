"""PostgreSQL F-13 audit owner with transaction-serialized project/environment CAS."""

from __future__ import annotations

from copy import deepcopy
import re


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9:._-]{0,127}\Z")
_ACTIONS = frozenset({"DETECTED", "ACKNOWLEDGED", "RESOLVED"})
_FIELDS = frozenset({"action", "alert_id", "actor_id", "at", "approval_id", "evidence_hash", "alert"})
_ALERT_FIELDS = frozenset({"alert_id", "level", "source", "category", "code", "related_entity_id",
                           "dedupe_key", "detector_rule_revision", "cause", "impact", "next_action",
                           "deep_link", "evidence_hash", "status", "owner_id", "observed_at",
                           "project_id", "environment_id"})


def _safe_event(event: dict, project_id: str, environment_id: str) -> dict:
    if type(event) is not dict or set(event) - _FIELDS or not {"action", "alert_id", "actor_id", "at", "approval_id", "evidence_hash"}.issubset(event):
        raise ValueError("AUDIT_EVENT_INVALID")
    if (type(event["action"]) is not str or event["action"] not in _ACTIONS or type(event["alert_id"]) is not str
            or _ID.fullmatch(event["alert_id"]) is None or type(event["actor_id"]) is not str
            or _ID.fullmatch(event["actor_id"]) is None or type(event["evidence_hash"]) is not str
            or _HASH.fullmatch(event["evidence_hash"]) is None):
        raise ValueError("AUDIT_EVENT_INVALID")
    from datetime import datetime
    try:
        at = datetime.fromisoformat(event["at"])
    except (TypeError, ValueError):
        raise ValueError("AUDIT_EVENT_INVALID") from None
    if at.tzinfo is None or (event["approval_id"] is not None and
            (type(event["approval_id"]) is not str or _ID.fullmatch(event["approval_id"]) is None)):
        raise ValueError("AUDIT_EVENT_INVALID")
    if event["action"] == "DETECTED":
        alert = event.get("alert")
        if (type(alert) is not dict or set(alert) != _ALERT_FIELDS
                or alert["alert_id"] != event["alert_id"]
                or alert["project_id"] != project_id or alert["environment_id"] != environment_id
                or type(alert["evidence_hash"]) is not str
                or _HASH.fullmatch(alert["evidence_hash"]) is None
                or type(alert["deep_link"]) is not str
                or not alert["deep_link"].startswith("/") or alert["deep_link"].startswith("//")
                or "?" in alert["deep_link"] or "#" in alert["deep_link"]):
            raise ValueError("AUDIT_EVENT_INVALID")
        for key, value in alert.items():
            if type(value) not in (str, type(None)):
                raise ValueError("AUDIT_EVENT_INVALID")
            if type(value) is str and (len(value) > 512 or any(marker in value.lower() for marker in
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
