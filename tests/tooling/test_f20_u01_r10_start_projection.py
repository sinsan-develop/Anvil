"""R10 Dashboard read API writer transition contract."""

from datetime import datetime, timezone
from pathlib import Path
from copy import deepcopy
import json

from scripts import f20_u01_r10_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
AT = datetime(2026, 9, 30, 6, 0, tzinfo=timezone.utc)


def test_r10_issues_exact_scoped_fresh_dual_lease():
    raw, stream, progress = overlay._historical(ROOT)
    wi = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi, invocation, AT, "r10test01")
    assert [row["sequence"] for row in rows] == [1849, 1850, 1851, 1852]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    worker, write = rows[1]["details"], rows[2]["details"]
    assert worker["lease_epoch"] == write["write_epoch"] == 23
    assert worker["path_scope"] == write["path_scope"] == overlay.SCOPE
    assert write["worker_lease_id"] == worker["lease_id"]
    assert worker["execution_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert write["write_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert progress["worker_lease"] is progress["write_lease"] is None
    assert stream["last_sequence"] == 1848


def test_r10_projection_preserves_prefix_and_blocking_state():
    raw, stream, progress = overlay._historical(ROOT)
    wi = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi, invocation, AT, "r10test01")
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    prior_events = raw.split(b'"events": [\n', 1)[1].split(b'\n  ],\n  "last_event_id"', 1)[0]
    new_events = outputs[overlay.EVENTS].split(b'"events": [\n', 1)[1]
    assert new_events.startswith(prior_events)
    assert json.loads(outputs[overlay.EVENTS])["last_sequence"] == 1852
    new = json.loads(outputs[overlay.PROGRESS])
    assert new["repository"]["product_write_scope"] == overlay.SCOPE
    assert new["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in new["completed_packages"]


def test_r10_scope_is_only_dashboard_api_slice():
    assert overlay.SCOPE == [
        "packages/api/registry.py",
        "packages/api/operations.py",
        "tests/api/test_f20_u01_r10_dashboard_api.py",
        "tests/api/test_f20_u01_r10_oidc_dashboard.py",
        "docs/04_test_reports/F-20_U01_R10_DASHBOARD_READ_API_RESULT.md",
    ]


def test_r10_rejects_mutated_write_fence():
    bundle = {
        "events": json.loads((ROOT / overlay.EVENTS).read_bytes()),
        "progress": json.loads((ROOT / overlay.PROGRESS).read_bytes()),
    }
    tampered = deepcopy(bundle)
    tampered["events"]["events"][1850]["details"]["write_fencing_token"] = "forged"
    assert "F20_U01_R10_TRANSITION_INVALID" in overlay.validate_control(
        ROOT, tampered, datetime.now(timezone.utc))
