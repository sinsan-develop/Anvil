"""R33T issues one bounded test-only writer without accepting F-20."""

from datetime import datetime, timezone
import importlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_r33t_projection_issues_exact13_epoch48_dual_lease():
    overlay = importlib.import_module("scripts.f20_u01_r33t_start_overlay")
    raw, stream, progress = overlay._historical(ROOT)
    assert stream["last_sequence"] == 1998
    assert progress["worker_lease"] is progress["write_lease"] is None
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi_sha, invocation_sha,
                              at, "r33thistory1003")
    outputs = overlay._projection(ROOT, progress, raw, stream, rows,
                                  wi_sha, invocation_sha)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1998] == stream["events"]
    assert [row["sequence"] for row in rows] == [1999, 2000, 2001, 2002]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert len(overlay.SCOPE) == 13
    assert final["worker_lease"]["lease_epoch"] == 48
    assert final["write_lease"]["write_epoch"] == 48
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]


def test_r33t_start_rejects_scope_and_expiry_tampering():
    overlay = importlib.import_module("scripts.f20_u01_r33t_start_overlay")
    checker = importlib.import_module("scripts.check_project_progress")
    bundle = checker.load_bundle(ROOT)
    at = datetime.fromisoformat(bundle["events"]["events"][1998]["occurred_at"])
    assert overlay.validate_control(ROOT, bundle, at) == []
    assert "F20_U01_R33T_TRANSITION_INVALID" in overlay.validate_control(
        ROOT, bundle, at.replace(year=2027))
    bundle["events"]["events"][2000]["details"]["path_scope"] = ["packages/api/runtime.py"]
    assert "F20_U01_R33T_TRANSITION_INVALID" in overlay.validate_control(ROOT, bundle, at)


def test_r33t_public_g05_keeps_f20_blocked():
    checker = importlib.import_module("scripts.check_project_progress")
    bundle = checker.load_bundle(ROOT)
    assert bundle["progress"]["repository"]["projection_mode"] == (
        "F20_U01_R33T_HISTORY_SUITE_REPAIR_START")
    assert checker.validate_bundle(bundle) == []
    assert bundle["progress"]["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert bundle["progress"]["scope_revision_binding"]["release_decision"] == "DEFER"
