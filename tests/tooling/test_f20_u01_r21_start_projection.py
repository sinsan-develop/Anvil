"""R21 loading-state dual lease must preserve the closed R20 evidence."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r21_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r21_start_preserves_r20_close_and_bounded_writer():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], "a" * 64, "b" * 64, at, "r21load1001")
    outputs = overlay._projection(ROOT, progress, raw, rows, "a" * 64, "b" * 64)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1920] == stream["events"]
    assert [row["sequence"] for row in rows] == [1921, 1922, 1923, 1924]
    assert [row["event_type"] for row in rows] == [
        "WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED",
        "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert final["worker_lease"]["lease_epoch"] == 35
    assert final["write_lease"]["write_epoch"] == 35
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["repository"]["product_write_scope"] == overlay.SCOPE
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
