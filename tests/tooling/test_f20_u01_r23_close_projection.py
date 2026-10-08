"""R23 close revokes epoch37 leases without accepting F-20."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r23_close_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r23_close_allows_only_the_next_r24_plan_document():
    assert "docs/04_test_reports/F-20_U01_R24_EMPTY_ERROR_BROWSER_QA_PLAN.md" in overlay.CONTROL_SCOPE
    assert "tests/browser/f20-u01-oidc-browser-pg15.mjs" not in overlay.CONTROL_SCOPE


def test_r23_close_allows_r24_instruction_without_product_write():
    assert "docs/work_orders/F-20_U01_R24_EMPTY_ERROR_BROWSER_QA_WORK_INSTRUCTION.md" in overlay.CONTROL_SCOPE
    assert "docs/work_orders/F-20_U01_R24_EMPTY_ERROR_BROWSER_QA_INVOCATION.md" in overlay.CONTROL_SCOPE
    assert "apps/web/src/console/App.tsx" not in overlay.CONTROL_SCOPE


def test_r23_close_allows_r24_start_control_without_product_write():
    assert "scripts/f20_u01_r24_start_overlay.py" in overlay.CONTROL_SCOPE
    assert "tests/tooling/test_f20_u01_r24_start_projection.py" in overlay.CONTROL_SCOPE
    assert "tests/browser/f20-u01-oidc-browser-pg15.mjs" not in overlay.CONTROL_SCOPE


def test_r23_close_preserves_prefix_and_block():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], at)
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1936] == stream["events"]
    assert [row["sequence"] for row in rows] == [1937, 1938]
    assert [row["event_type"] for row in rows] == ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    assert final["worker_lease"] is final["write_lease"] is None
    assert final["completed_f20_u01_r23_worker_lease"]["lease_id"] == stream["events"][1933]["details"]["lease_id"]
    assert final["completed_f20_u01_r23_write_lease"]["lease_id"] == stream["events"][1934]["details"]["lease_id"]
    assert final["repository"]["product_write_scope"] == []
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
