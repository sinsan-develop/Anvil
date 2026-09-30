"""R19 completion closes only epoch33 leases and never accepts F-20."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r19_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r19_close_preserves_prefix_and_block():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], at)
    assert stream["last_sequence"] == 1912
    assert [row["sequence"] for row in rows] == [1913, 1914]
    assert [row["event_type"] for row in rows] == ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1912] == stream["events"]
    assert final["worker_lease"] is final["write_lease"] is None
    assert final["completed_f20_u01_r19_worker_lease"]["lease_id"] == stream["events"][1909]["details"]["lease_id"]
    assert final["completed_f20_u01_r19_write_lease"]["lease_id"] == stream["events"][1910]["details"]["lease_id"]
    assert final["completed_f20_u01_r18_r1_worker_lease"] == progress["completed_f20_u01_r18_r1_worker_lease"]
    assert final["repository"]["product_write_scope"] == []
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]


def test_r19_close_exact_prior_leases():
    _, stream, _ = overlay._historical(ROOT)
    rows = overlay._make_rows(stream["events"], datetime.now(timezone.utc).replace(microsecond=0))
    assert rows[0]["details"]["lease_id"] == stream["events"][1910]["details"]["lease_id"]
    assert rows[1]["details"]["lease_id"] == stream["events"][1909]["details"]["lease_id"]
