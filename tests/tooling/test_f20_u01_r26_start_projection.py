"""R26 starts epoch40 only on the committed R25 close checkpoint."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r26_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r26_scope_is_exactly_four_observation_time_files():
    assert overlay.SCOPE == [
        "apps/web/src/console/App.tsx",
        "apps/web/tests/f15-console.test.mjs",
        "tests/browser/f20-u01-oidc-browser-pg15.mjs",
        "docs/04_test_reports/F-20_U01_R26_DASHBOARD_OBSERVATION_TIME_RESULT.md",
    ]
    assert "apps/web/src/console/App.tsx" not in overlay.CONTROL_SCOPE
    assert "apps/web/tests/f15-console.test.mjs" not in overlay.CONTROL_SCOPE
    assert "tests/browser/f20-u01-oidc-browser-pg15.mjs" not in overlay.CONTROL_SCOPE


def test_r26_projection_preserves_r25_close_and_c30_block():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi_sha, invocation_sha, at, "r26observe1001")
    outputs = overlay._projection(ROOT, progress, raw, rows, wi_sha, invocation_sha)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1950] == stream["events"]
    assert [row["sequence"] for row in rows] == [1951, 1952, 1953, 1954]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert final["worker_lease"]["lease_epoch"] == 40
    assert final["write_lease"]["write_epoch"] == 40
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
