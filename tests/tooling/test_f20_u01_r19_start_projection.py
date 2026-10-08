"""R19 must issue one new UI-only lease and preserve the closed R18 event prefix."""

from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r19_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r19_epoch33_exact3_and_prefix():
    at = datetime.now(timezone.utc).replace(microsecond=0)
    raw, stream, progress = overlay._historical(ROOT)
    rows = overlay._make_rows(stream["events"], "a" * 64, "b" * 64, at, "r19test")
    assert stream["last_sequence"] == 1908
    assert [row["sequence"] for row in rows] == [1909, 1910, 1911, 1912]
    worker, write = rows[1]["details"], rows[2]["details"]
    assert worker["lease_epoch"] == write["write_epoch"] == 33
    assert worker["path_scope"] == write["path_scope"] == overlay.SCOPE
    assert worker["execution_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert write["write_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    outputs = overlay._projection(ROOT, progress, raw, rows, "a" * 64, "b" * 64)
    event = json.loads(outputs[overlay.EVENTS])
    projected = json.loads(outputs[overlay.PROGRESS])
    assert event["events"][:1908] == stream["events"]
    assert projected["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert projected["scope_revision_binding"]["release_decision"] == "DEFER"
    assert projected["repository"]["product_write_scope"] == overlay.SCOPE
    assert "F-20" not in projected["completed_packages"]


def test_r19_scope_is_only_existing_ui_exact3():
    assert overlay.SCOPE == [
        "apps/web/src/console/App.tsx",
        "apps/web/tests/f15-console.test.mjs",
        "docs/04_test_reports/F-20_U01_R19_NEXT_ACTIONS_UI_RESULT.md",
    ]
    assert overlay.CONTROL_SCOPE.isdisjoint(overlay.SCOPE)
