"""R32 close revokes epoch46 without accepting U-01/F-20."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r32_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r32_close_preserves_history_and_block():
    assert overlay._git(
        ROOT, "cat-file", "-e", f"{overlay.BASE}:scripts/f20_u01_r32_close_overlay.py",
    ) == b""
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], at)
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1990] == stream["events"]
    assert [row["sequence"] for row in rows] == [1991, 1992]
    assert [row["event_type"] for row in rows] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED",
    ]
    assert final["worker_lease"] is final["write_lease"] is None
    assert final["completed_f20_u01_r32_worker_lease"]["lease_id"] == (
        stream["events"][1987]["details"]["lease_id"]
    )
    assert final["completed_f20_u01_r32_write_lease"]["lease_id"] == (
        stream["events"][1988]["details"]["lease_id"]
    )
    assert final["repository"]["product_write_scope"] == []
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
