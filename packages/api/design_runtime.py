"""Local-only executable bridge to the real B-03 design domain service."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import sys

from packages.design.models import Actor, DecisionDisposition
from packages.design.service import DesignLineageService, DesignServiceError


def execute(payload: dict) -> tuple[int, dict]:
    service = DesignLineageService()
    now = datetime.now(timezone.utc)
    try:
        intent = service.record_intent("intent-runtime", payload.get("intent"), True, Actor("user", "sinsan", True), now)
        proposals = service.propose("proposals-runtime", intent, tuple(payload.get("proposals") or ()), Actor("agent", "eoul", True), now)
        if payload.get("action") == "baseline":
            try:
                service.approve("baseline-runtime", service.specify("spec-runtime", proposals, frozenset({"approval"}), Actor("agent", "eoul", True), now), "approval-runtime", Actor("user", "sinsan", True), now)
            except DesignServiceError as error:
                return 3, _response("BLOCKED", service, str(error))
        actor_data = payload.get("actor") or {}
        actor = Actor("user", actor_data.get("id", "sinsan"), actor_data.get("authenticated", False))
        service.decide("decision-runtime", proposals, payload.get("selected"), DecisionDisposition.CONFIRMED, "runtime choice", actor, now)
        spec = service.specify("spec-runtime", proposals, frozenset({"approval"}), Actor("agent", "eoul", True), now)
        baseline = service.approve("baseline-runtime", spec, "approval-runtime", actor, now)
        body = _response("NORMAL", service, "Design baseline created")
        body["baseline_id"] = baseline.envelope.artifact_id
        return 0, body
    except (DesignServiceError, TypeError, ValueError) as error:
        return 2, _response("ERROR", service, str(error))


def _response(state: str, service: DesignLineageService, message: str) -> dict:
    events = []
    for event in service.audit_events():
        events.append({
            "event_id": f"evt-b03-{event.sequence:04d}",
            "sequence": event.sequence,
            "type": event.action,
            "occurred_at": event.occurred_at.isoformat(),
            "actor": {"type": event.actor.actor_type, "id": event.actor.actor_id},
            "artifact_id": event.artifact_id,
        })
    return {"ok": state == "NORMAL", "state": state, "service": "DesignLineageService", "runtime_boundary": "LOCAL_VERIFICATION_ONLY", "message": message, "events": events}


def main() -> int:
    try:
        payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("request must be an object")
        code, response = execute(payload)
    except (json.JSONDecodeError, ValueError) as error:
        code, response = 2, {"ok": False, "state": "ERROR", "service": "DesignLineageService", "runtime_boundary": "LOCAL_VERIFICATION_ONLY", "message": str(error), "events": []}
    print(json.dumps(response, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
