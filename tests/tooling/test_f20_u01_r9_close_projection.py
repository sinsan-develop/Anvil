"""R9 close revokes only the verified epoch22 leases."""

from datetime import datetime, timezone
from pathlib import Path
from copy import deepcopy
import json

from scripts import f20_u01_r9_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
AT = datetime(2026, 9, 29, 14, 10, tzinfo=timezone.utc)


def _inputs():
    raw, stream, progress = overlay._historical(ROOT)
    rows = overlay._make_rows(stream["events"], AT)
    return raw, stream, progress, rows


def test_close_events_revoke_exact_r9_write_then_worker():
    _, stream, progress, rows = _inputs()
    assert [r["sequence"] for r in rows] == [1847, 1848]
    assert [r["event_type"] for r in rows] == list(overlay.KINDS)
    assert rows[0]["details"]["lease_id"] == progress["write_lease"]["lease_id"]
    assert rows[1]["details"]["lease_id"] == progress["worker_lease"]["lease_id"]
    assert rows[0]["details"]["write_fencing_token"] == progress["write_lease"]["write_fencing_token"]
    assert rows[1]["details"]["execution_fencing_token"] == progress["worker_lease"]["execution_fencing_token"]
    assert stream["last_sequence"] == 1846


def test_close_projection_preserves_event_bytes_and_blocking_state():
    raw, stream, progress, rows = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    prior_events = raw.split(b'"events": [\n', 1)[1].split(b'\n  ],\n  "last_event_id"', 1)[0]
    new_events = outputs[overlay.EVENTS].split(b'"events": [\n', 1)[1]
    assert new_events.startswith(prior_events)
    new_stream = json.loads(outputs[overlay.EVENTS])
    new = json.loads(outputs[overlay.PROGRESS])
    assert new_stream["last_sequence"] == 1848
    assert new["worker_lease"] is None and new["write_lease"] is None
    assert new["repository"]["product_write_scope"] == []
    assert new["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in new["completed_packages"]


def test_close_scope_is_control_only():
    raw, stream, progress, rows = _inputs()
    assert overlay._append_raw(raw, rows) != raw
    assert overlay.SCOPE == overlay.prior.SCOPE
    assert overlay.CONTROL_SCOPE.isdisjoint(overlay.SCOPE)


def test_close_rejects_wrong_write_fencing_token():
    current = json.loads((ROOT / overlay.EVENTS).read_text(encoding="utf-8"))
    forged = deepcopy(current)
    forged["events"][1846]["details"]["write_fencing_token"] = "wrong-token"
    assert "F20_U01_R9_CLOSE_EVENT_INVALID" in overlay.validate_control(
        ROOT, {"events": forged}, datetime.now(timezone.utc))
