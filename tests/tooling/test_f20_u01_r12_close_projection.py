"""R12 close releases only its exact dual lease after same-SHA QA."""

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r12_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
AT = datetime(2026, 9, 30, 1, 0, tzinfo=timezone.utc)


def _inputs():
    raw, stream, progress = overlay._historical(ROOT)
    rows = overlay._make_rows(stream["events"], AT)
    return raw, stream, progress, rows


def test_close_revokes_exact_write_then_worker():
    _, stream, progress, rows = _inputs()
    assert stream["last_sequence"] == 1864
    assert [row["sequence"] for row in rows] == [1865, 1866]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert rows[0]["details"]["lease_id"] == progress["write_lease"]["lease_id"]
    assert rows[1]["details"]["lease_id"] == progress["worker_lease"]["lease_id"]
    assert rows[0]["details"]["write_fencing_token"] == progress["write_lease"]["write_fencing_token"]
    assert rows[1]["details"]["execution_fencing_token"] == progress["worker_lease"]["execution_fencing_token"]


def test_close_preserves_prefix_and_blocking_state():
    raw, stream, progress, rows = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    prefix = raw.split(b'"events": [\n', 1)[1].split(b'\n  ],\n  "last_event_id"', 1)[0]
    assert outputs[overlay.EVENTS].split(b'"events": [\n', 1)[1].startswith(prefix)
    new_stream = json.loads(outputs[overlay.EVENTS])
    new = json.loads(outputs[overlay.PROGRESS])
    assert new_stream["last_sequence"] == 1866
    assert new["worker_lease"] is None and new["write_lease"] is None
    assert new["repository"]["product_write_scope"] == []
    assert new["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in new["completed_packages"]


def test_close_rejects_forged_write_fence():
    raw, stream, progress, rows = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    forged = deepcopy(json.loads(outputs[overlay.EVENTS]))
    forged["events"][1864]["details"]["write_fencing_token"] = "wrong-token"
    assert "F20_U01_R12_CLOSE_EVENT_INVALID" in overlay.validate_control(
        ROOT, {"events": forged}, datetime.now(timezone.utc))


def test_close_scope_excludes_product():
    assert overlay.CONTROL_SCOPE.isdisjoint(overlay.prior.SCOPE)
