"""R22 initial independent loading-state lease preserves the closed R21 evidence."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r22_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r22_start_allows_exact_close_control_paths():
    assert "scripts/f20_u01_r22_close_overlay.py" in overlay.CONTROL_SCOPE
    assert "tests/tooling/test_f20_u01_r22_close_projection.py" in overlay.CONTROL_SCOPE
    assert "apps/web/src/console/App.tsx" not in overlay.CONTROL_SCOPE


def test_r22_start_preserves_r21_close_and_bounded_writer():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], "a" * 64, "b" * 64, at, "r22load1001")
    outputs = overlay._projection(ROOT, progress, raw, rows, "a" * 64, "b" * 64)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1926] == stream["events"]
    assert [row["sequence"] for row in rows] == [1927, 1928, 1929, 1930]
    assert [row["event_type"] for row in rows] == [
        "WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED",
        "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert final["worker_lease"]["lease_epoch"] == 36
    assert final["write_lease"]["write_epoch"] == 36
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["repository"]["product_write_scope"] == overlay.SCOPE
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
