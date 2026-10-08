"""R24 browser-QA lease preserves R23 close and the exact test-only scope."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r24_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r24_start_inspects_real_dirty_paths_before_lease():
    assert isinstance(overlay._dirty(ROOT), set)


def test_r24_start_preserves_r23_close_and_bounded_writer():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], "a" * 64, "b" * 64, at, "r24empty1001")
    outputs = overlay._projection(ROOT, progress, raw, rows, "a" * 64, "b" * 64)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1938] == stream["events"]
    assert [row["sequence"] for row in rows] == [1939, 1940, 1941, 1942]
    assert [row["event_type"] for row in rows] == [
        "WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED",
        "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert final["worker_lease"]["lease_epoch"] == 38
    assert final["write_lease"]["write_epoch"] == 38
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["repository"]["product_write_scope"] == overlay.SCOPE
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
