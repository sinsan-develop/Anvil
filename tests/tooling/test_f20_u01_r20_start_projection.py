"""R20 must issue one test-only lease and preserve the closed R19 prefix."""

from datetime import datetime, timezone
from importlib import import_module
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_r20_epoch34_exact3_and_prior_event_prefix():
    overlay = import_module("scripts.f20_u01_r20_start_overlay")
    at = datetime.now(timezone.utc).replace(microsecond=0)
    raw, stream, progress = overlay._historical(ROOT)
    rows = overlay._make_rows(stream["events"], "a" * 64, "b" * 64, at, "r20test")
    assert stream["last_sequence"] == 1914
    assert [row["sequence"] for row in rows] == [1915, 1916, 1917, 1918]
    worker, write = rows[1]["details"], rows[2]["details"]
    assert worker["lease_epoch"] == write["write_epoch"] == 34
    assert worker["path_scope"] == write["path_scope"] == [
        "tests/browser/f20-u01-oidc-browser-pg15.mjs",
        "tests/integration/test_f20_u01_oidc_browser_pg15.py",
        "docs/04_test_reports/F-20_U01_R20_NEXT_ACTIONS_BROWSER_RESULT.md",
    ]
    assert worker["execution_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert write["write_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    outputs = overlay._projection(ROOT, progress, raw, rows, "a" * 64, "b" * 64)
    event = json.loads(outputs[overlay.EVENTS])
    projected = json.loads(outputs[overlay.PROGRESS])
    assert event["events"][:1914] == stream["events"]
    assert projected["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert projected["scope_revision_binding"]["release_decision"] == "DEFER"
    assert projected["repository"]["product_write_scope"] == worker["path_scope"]
    assert "F-20" not in projected["completed_packages"]


def test_r20_start_reads_actual_clean_git_scope():
    overlay = import_module("scripts.f20_u01_r20_start_overlay")
    assert overlay._dirty(ROOT) <= overlay.CONTROL_SCOPE
