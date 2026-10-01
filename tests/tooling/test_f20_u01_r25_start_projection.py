"""R25 start issues bounded epoch39 leases without accepting U-01/F-20."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r25_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r25_scope_is_exactly_the_three_qa_files():
    assert overlay.SCOPE == [
        "tests/browser/f20-u01-oidc-browser-pg15.mjs",
        "tests/integration/test_f20_u01_oidc_browser_pg15.py",
        "docs/04_test_reports/F-20_U01_R25_DASHBOARD_ACCESSIBILITY_BROWSER_QA_RESULT.md",
    ]
    assert "apps/web/src/console/App.tsx" not in overlay.CONTROL_SCOPE


def test_r25_start_preserves_r24_close_and_bounded_writer():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi_sha, invocation_sha, at, "r25access1001")
    outputs = overlay._projection(ROOT, progress, raw, rows, wi_sha, invocation_sha)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1944] == stream["events"]
    assert [row["sequence"] for row in rows] == [1945, 1946, 1947, 1948]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert final["worker_lease"]["lease_epoch"] == 39
    assert final["write_lease"]["write_epoch"] == 39
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
