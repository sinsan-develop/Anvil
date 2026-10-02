"""R30 starts only a bounded Dashboard request-cancel writer from closed R29 control."""

from datetime import datetime, timezone
import json
from pathlib import Path
import re

from scripts import f20_u01_r30_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r30_scope_is_exact_five_without_public_api():
    assert overlay.SCOPE == [
        "apps/web/src/console/App.tsx",
        "apps/web/tests/f15-console.test.mjs",
        "tests/browser/f20-u01-oidc-browser-pg15.mjs",
        "tests/integration/test_f20_u01_oidc_browser_pg15.py",
        "docs/04_test_reports/F-20_U01_R30_DASHBOARD_CANCEL_STATE_RESULT.md",
    ]
    assert re.fullmatch(r"[0-9a-f]{40}", overlay.BASE)
    assert not any(path.startswith("packages/api/") for path in overlay.SCOPE)


def test_r30_projection_issues_epoch44_without_acceptance():
    raw, stream, progress = overlay._historical(ROOT)
    assert stream["last_sequence"] == overlay.START == 1974
    assert progress["worker_lease"] is progress["write_lease"] is None
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi_sha, invocation_sha,
                              at, "r30cancel1003")
    outputs = overlay._projection(ROOT, progress, raw, stream, rows,
                                  wi_sha, invocation_sha)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1974] == stream["events"]
    assert [row["sequence"] for row in rows] == [1975, 1976, 1977, 1978]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert final["worker_lease"]["lease_epoch"] == 44
    assert final["write_lease"]["write_epoch"] == 44
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
    assert final["repository"]["product_write_scope"] == overlay.SCOPE
