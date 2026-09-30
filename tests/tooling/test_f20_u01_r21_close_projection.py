"""R21 close revokes the exact epoch35 leases without accepting F-20."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r21_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r21_close_preserves_prefix_and_block():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], at)
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1924] == stream["events"]
    assert [row["sequence"] for row in rows] == [1925, 1926]
    assert [row["event_type"] for row in rows] == ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    assert final["worker_lease"] is final["write_lease"] is None
    assert final["completed_f20_u01_r21_worker_lease"]["lease_id"] == stream["events"][1921]["details"]["lease_id"]
    assert final["completed_f20_u01_r21_write_lease"]["lease_id"] == stream["events"][1922]["details"]["lease_id"]
    assert final["repository"]["product_write_scope"] == []
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
