"""F-13 scoped detector over a host-supplied append/load audit owner."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import re
from threading import RLock
from typing import Callable, Protocol

from .projection import OperationsSources, project_operations
from .agent_owner_summary import ScopedAgentOwnerSummary, _checked_summary
from .run_status_summary import ScopedRunStatusSummary


class OperationsError(ValueError):
    pass


class OperationsRepository(Protocol):
    """Host owner must atomically enforce expected_sequence in append."""

    def load(self, project_id: str, environment_id: str) -> tuple[dict, ...]: ...

    def append(self, project_id: str, environment_id: str, expected_sequence: int,
               event: dict) -> None: ...


_REVISION = "f13-r2"
_EVIDENCE = re.compile(r"sha256:[0-9a-f]{64}\Z")
_ACTOR = re.compile(r"[A-Za-z0-9][A-Za-z0-9:._-]{0,127}\Z")
_MAX_READ = 100


class OperationsService:
    def __init__(self, project_id: str, environment_id: str, sources: OperationsSources,
                 *, repository: OperationsRepository | None = None, clock=None,
                 source_loader: Callable[[str, str], OperationsSources] | None = None,
                 run_summary_loader: Callable[[str, str], ScopedRunStatusSummary] | None = None,
                 agent_owner_summary_loader: Callable[[str, str], ScopedAgentOwnerSummary] | None = None):
        if not project_id or not environment_id or type(sources) is not OperationsSources:
            raise OperationsError("OPERATIONS_OWNER_INVALID")
        if repository is None or not all(callable(getattr(repository, name, None))
                                         for name in ("load", "append")):
            raise OperationsError("AUDIT_OWNER_REQUIRED")
        if source_loader is not None and not callable(source_loader):
            raise OperationsError("OPERATIONS_SOURCE_LOADER_INVALID")
        if run_summary_loader is not None and not callable(run_summary_loader):
            raise OperationsError("RUN_SUMMARY_UNAVAILABLE")
        if agent_owner_summary_loader is not None and not callable(agent_owner_summary_loader):
            raise OperationsError("AGENT_OWNER_SUMMARY_UNAVAILABLE")
        self.project_id = project_id
        self.environment_id = environment_id
        self._sources = sources
        self._source_loader = source_loader
        self._run_summary_loader = run_summary_loader
        self._agent_owner_summary_loader = agent_owner_summary_loader
        self._repository = repository
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._lock = RLock()

    def agent_owner_summary(self) -> ScopedAgentOwnerSummary:
        """Explicit internal read only; never called by the public snapshot/detector."""
        if self._agent_owner_summary_loader is None:
            raise OperationsError("AGENT_OWNER_SUMMARY_UNAVAILABLE")
        try:
            return _checked_summary(self._agent_owner_summary_loader(
                self.project_id, self.environment_id))
        except Exception:
            raise OperationsError("AGENT_OWNER_SUMMARY_UNAVAILABLE") from None

    def run_summary(self) -> ScopedRunStatusSummary:
        """Read the optional scoped Run owner without altering Queue projections."""
        if self._run_summary_loader is None:
            raise OperationsError("RUN_SUMMARY_UNAVAILABLE")
        try:
            result = self._run_summary_loader(self.project_id, self.environment_id)
            if type(result) is not ScopedRunStatusSummary:
                raise ValueError("invalid Run summary")
            return result
        except Exception:
            raise OperationsError("RUN_SUMMARY_UNAVAILABLE") from None

    def _fresh_sources(self) -> OperationsSources:
        if self._source_loader is None:
            return self._sources
        try:
            sources = self._source_loader(self.project_id, self.environment_id)
        except ValueError as exc:
            if str(exc) == "QUEUE_SOURCE_LIMIT_EXCEEDED":
                raise OperationsError("QUEUE_SOURCE_LIMIT_EXCEEDED") from None
            raise OperationsError("QUEUE_SOURCE_UNAVAILABLE") from None
        except Exception:
            raise OperationsError("QUEUE_SOURCE_UNAVAILABLE") from None
        try:
            if type(sources) is not OperationsSources or sources.queue is None:
                raise OperationsError("QUEUE_SOURCE_INVALID")
            if getattr(sources.queue, "legacy_unscoped_present", False):
                raise OperationsError("QUEUE_SOURCE_LEGACY_UNSCOPED")
            if type(sources.queue_job_ids) is not tuple or len(sources.queue_job_ids) > 100:
                raise OperationsError("QUEUE_SOURCE_INVALID")
        except OperationsError:
            raise
        except Exception:
            raise OperationsError("QUEUE_SOURCE_INVALID") from None
        return sources

    def _projection(self, now: str) -> dict:
        sources = self._fresh_sources()
        if self._source_loader is None:
            return project_operations(sources, observed_at=datetime.fromisoformat(now))
        try:
            return project_operations(sources, observed_at=datetime.fromisoformat(now))
        except Exception:
            raise OperationsError("QUEUE_SOURCE_UNAVAILABLE") from None

    def _at(self) -> str:
        value = self._clock()
        if type(value) is not datetime or value.tzinfo is None:
            raise OperationsError("CLOCK_INVALID")
        return value.isoformat()

    def _events(self) -> tuple[dict, ...]:
        events = self._repository.load(self.project_id, self.environment_id)
        if type(events) is not tuple:
            raise OperationsError("AUDIT_OWNER_INVALID")
        return events

    def _append(self, events: tuple[dict, ...], event: dict) -> tuple[dict, ...]:
        self._repository.append(self.project_id, self.environment_id, len(events), event)
        return events + (event,)

    @staticmethod
    def _state(events: tuple[dict, ...]) -> dict[str, dict]:
        alerts = {}
        for sequence, event in enumerate(events, start=1):
            action = event["action"]
            alert_id = event["alert_id"]
            if action == "DETECTED":
                alerts[alert_id] = {**event["alert"], "sequence": sequence}
            elif action == "ACKNOWLEDGED" and alert_id in alerts:
                alerts[alert_id]["status"] = "acknowledged"
                alerts[alert_id]["owner_id"] = event["actor_id"]
            elif action == "RESOLVED" and alert_id in alerts:
                alerts[alert_id]["status"] = "resolved"
                alerts[alert_id]["owner_id"] = event["actor_id"]
        return alerts

    def _detect(self, events: tuple[dict, ...], *, code: str, source: str, category: str,
                entity_id: str, cause: str, impact: str, next_action: str,
                deep_link: str, evidence_hash: str, now: str) -> tuple[dict, ...]:
        key = f"{_REVISION}:{self.project_id}:{self.environment_id}:{code}:{entity_id}"
        if any(a["dedupe_key"] == key and a["status"] != "resolved"
               for a in self._state(events).values()):
            return events
        alert_id = "alert-" + sha256((key + now).encode()).hexdigest()[:20]
        alert = {"alert_id": alert_id,
            "level": "critical" if "EXPIRED" in code or "QUARANTINED" in code else "warning",
            "source": source, "category": category, "code": code, "related_entity_id": entity_id,
            "dedupe_key": key, "detector_rule_revision": _REVISION, "cause": cause,
            "impact": impact, "next_action": next_action, "deep_link": deep_link,
            "evidence_hash": evidence_hash, "status": "open", "owner_id": None,
            "observed_at": now, "project_id": self.project_id, "environment_id": self.environment_id}
        event = {"action": "DETECTED", "alert_id": alert_id, "actor_id": "system:detector",
            "approval_id": None, "evidence_hash": evidence_hash, "at": now, "alert": alert}
        return self._append(events, event)

    def detect(self) -> int:
        """Host calls this before reads/on source events; HTTP GET never runs it."""
        with self._lock:
            now = self._at()
            snapshot = self._projection(now)
            events = self._events()
            before = len(events)
            for worker in snapshot["worker"]:
                if worker["health"] == "EXPIRED":
                    evidence = "sha256:" + sha256(f'{worker["run_id"]}:{worker["lease_epoch"]}:{worker["expires_at"]}'.encode()).hexdigest()
                    events = self._detect(events, code="WORKER_LEASE_EXPIRED", source="worker",
                        category="availability", entity_id=worker["run_id"],
                        cause="Worker lease expiry observed", impact="Run ownership cannot be trusted",
                        next_action="REVIEW_WORKER_TAKEOVER", deep_link="/operations/workers",
                        evidence_hash=evidence, now=now)
            for row in snapshot["quarantine"]:
                evidence = "sha256:" + sha256(f'{row["job_id"]}:{row["attempts"]}:{row["quarantined_at"]}'.encode()).hexdigest()
                events = self._detect(events, code="QUEUE_JOB_QUARANTINED", source="orchestrator",
                    category="backlog", entity_id=row["job_id"], cause="Queue job reached quarantine",
                    impact="Run cannot advance automatically", next_action="REVIEW_QUARANTINE",
                    deep_link="/operations/queue", evidence_hash=evidence, now=now)
            for component, row in snapshot["health"].items():
                if row["evidence_ref"] is None:
                    continue
                if row["error_count"] > 0:
                    code = "HEALTH_ERROR_COUNT"
                elif row["state"] in {"UNKNOWN", "LATE", "EXPIRED"}:
                    code = "HEALTH_SIGNAL_" + row["state"]
                else:
                    continue
                events = self._detect(events, code=code, source="environment",
                    category="availability", entity_id=component,
                    cause="Health observation requires attention",
                    impact="Current service health requires review", next_action="CHECK_SOURCE_HEALTH",
                    deep_link=row["detail_path"], evidence_hash=row["evidence_ref"], now=now)
            for row in snapshot["reservations"]:
                if row["quota_paused"] or row["lifecycle"] == "USAGE_UNKNOWN":
                    evidence = "sha256:" + sha256(f'{row["reservation_id"]}:{row["lifecycle"]}'.encode()).hexdigest()
                    events = self._detect(events, code="BUDGET_RECONCILIATION_REQUIRED",
                        source="provider", category="cost", entity_id=row["reservation_id"],
                        cause="Usage is not finalized", impact="Budget exposure remains reserved",
                        next_action="RECONCILE_USAGE", deep_link="/operations/cost",
                        evidence_hash=evidence, now=now)
            return len(events) - before

    def snapshot(self) -> dict:
        """Host dashboard projection; does not mutate audit or source owners."""
        result = self._projection(self._at())
        result["alerts"] = self.alerts()
        result["next_actions"] = [{"priority": a["level"], "reason": a["cause"],
            "target": a["related_entity_id"], "action": a["next_action"],
            "deep_link": a["deep_link"]} for a in result["alerts"] if a["status"] != "resolved"]
        return result

    def alerts(self) -> list[dict]:
        return self.alert_page()["alerts"]

    def alert_page(self, *, before_sequence: int | None = None) -> dict:
        """Bounded alert page ordered by detection sequence; older open alerts remain reachable."""
        if before_sequence is not None and (type(before_sequence) is not int or before_sequence < 1):
            raise OperationsError("ALERT_CURSOR_INVALID")
        rows = list(self._state(self._events()).values())
        if before_sequence is not None:
            rows = [row for row in rows if row["sequence"] < before_sequence]
        page = rows[-_MAX_READ:]
        return {"alerts": page,
            "next_before_sequence": page[0]["sequence"] if len(rows) > len(page) else None}

    def audit(self, *, before_sequence: int | None = None) -> list[dict]:
        """Most recent 100 entries before an exclusive sequence; older pages remain reachable."""
        events = self._events()
        if before_sequence is not None:
            if type(before_sequence) is not int or before_sequence < 1:
                raise OperationsError("AUDIT_CURSOR_INVALID")
            events = events[:before_sequence - 1]
        start = max(0, len(events) - _MAX_READ)
        return [{"sequence": index + 1, **{key: event.get(key) for key in
            ("action", "alert_id", "actor_id", "at", "approval_id", "evidence_hash")}}
            for index, event in enumerate(events[start:], start=start)]

    def _transition(self, alert_id, *, actor_id, approval_id, evidence_hash, target):
        code = "RESOLUTION_EVIDENCE_REQUIRED" if target == "resolved" else "ACK_EVIDENCE_REQUIRED"
        if (type(actor_id) is not str or not _ACTOR.fullmatch(actor_id)
                or type(evidence_hash) is not str or not _EVIDENCE.fullmatch(evidence_hash)
                or type(approval_id) is not str or not _ACTOR.fullmatch(approval_id)):
            raise OperationsError(code)
        with self._lock:
            events = self._events()
            alert = self._state(events).get(alert_id)
            if alert is None:
                raise OperationsError("ALERT_NOT_FOUND")
            if alert["status"] == target:
                return dict(alert)
            if alert["status"] == "resolved" or target == "resolved" and alert["status"] != "acknowledged":
                raise OperationsError("ALERT_TRANSITION_INVALID")
            event = {"action": "RESOLVED" if target == "resolved" else "ACKNOWLEDGED",
                "alert_id": alert_id, "actor_id": actor_id, "approval_id": approval_id,
                "evidence_hash": evidence_hash, "at": self._at()}
            self._append(events, event)
            alert = dict(alert)
            alert["status"] = target
            alert["owner_id"] = actor_id
            return alert

    def acknowledge(self, alert_id, *, actor_id, approval_id=None, evidence_hash):
        return self._transition(alert_id, actor_id=actor_id, approval_id=approval_id,
                                evidence_hash=evidence_hash, target="acknowledged")

    def resolve(self, alert_id, *, actor_id, approval_id=None, evidence_hash):
        return self._transition(alert_id, actor_id=actor_id, approval_id=approval_id,
                                evidence_hash=evidence_hash, target="resolved")
