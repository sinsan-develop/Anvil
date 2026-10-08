"""R20 QA completion revokes epoch34 leases without accepting F-20."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r20_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r20_post_close_review_is_bounded_control_path():
    path = "docs/04_test_reports/F-20_U01_POST_R20_COVERAGE_REVIEW.md"
    assert path in overlay.CONTROL_SCOPE
    assert path in overlay.prior.CONTROL_SCOPE
    assert not any(item.endswith("/") for item in overlay.CONTROL_SCOPE)


def test_r21_preparation_is_exact_document_scope_only():
    paths = {
        "docs/04_test_reports/F-20_U01_R21_LOADING_STATE_PLAN.md",
        "docs/work_orders/F-20_U01_R21_LOADING_STATE_WORK_INSTRUCTION.md",
        "docs/work_orders/F-20_U01_R21_LOADING_STATE_INVOCATION.md",
    }
    assert paths <= overlay.CONTROL_SCOPE
    assert paths <= overlay.prior.CONTROL_SCOPE
    assert "apps/web/src/console/App.tsx" not in overlay.CONTROL_SCOPE
    assert "apps/web/tests/f15-console.test.mjs" not in overlay.CONTROL_SCOPE


def test_r20_close_preserves_prefix_and_block():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], at)
    assert stream["last_sequence"] == 1918
    assert [row["sequence"] for row in rows] == [1919, 1920]
    assert [row["event_type"] for row in rows] == ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1918] == stream["events"]
    assert final["worker_lease"] is final["write_lease"] is None
    assert final["completed_f20_u01_r20_worker_lease"]["lease_id"] == stream["events"][1915]["details"]["lease_id"]
    assert final["completed_f20_u01_r20_write_lease"]["lease_id"] == stream["events"][1916]["details"]["lease_id"]
    assert final["repository"]["product_write_scope"] == []
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
