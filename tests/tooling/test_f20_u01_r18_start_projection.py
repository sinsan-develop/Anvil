"""R18 start must issue only the isolated PG15 Run host QA writer scope."""

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r18_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _inputs():
    at = datetime.now(timezone.utc).replace(microsecond=0)
    raw, stream, progress = overlay._historical(ROOT)
    wi = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi, invocation, at, "r18test01")
    return raw, stream, progress, wi, invocation, rows, at


def test_r18_fresh_epoch31_exact2_dual_lease():
    _, stream, progress, _, _, rows, _ = _inputs()
    assert stream["last_sequence"] == 1896
    assert [row["sequence"] for row in rows] == [1897, 1898, 1899, 1900]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    worker, write = rows[1]["details"], rows[2]["details"]
    assert worker["lease_epoch"] == write["write_epoch"] == 31
    assert worker["path_scope"] == write["path_scope"] == overlay.SCOPE
    assert write["worker_lease_id"] == worker["lease_id"]
    assert worker["execution_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert write["write_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert progress["worker_lease"] is progress["write_lease"] is None


def test_r18_projection_preserves_event_prefix_and_c30_block():
    raw, _, progress, wi, invocation, rows, _ = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    prefix = raw.split(b'"events": [\n', 1)[1].split(b'\n  ],\n  "last_event_id"', 1)[0]
    assert outputs[overlay.EVENTS].split(b'"events": [\n', 1)[1].startswith(prefix)
    new_stream = json.loads(outputs[overlay.EVENTS])
    new = json.loads(outputs[overlay.PROGRESS])
    assert new_stream["last_sequence"] == 1900
    assert new["repository"]["product_write_scope"] == overlay.SCOPE
    assert new["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in new["completed_packages"]


def test_r18_scope_and_predecessor_control_only():
    assert overlay.SCOPE == [
        "tests/api/test_f20_u01_r18_run_host_pg15.py",
        "docs/04_test_reports/F-20_U01_R18_RUN_HOST_PG15_QA_RESULT.md",
    ]
    assert overlay.CONTROL_SCOPE.isdisjoint(overlay.SCOPE)
    assert {"scripts/f20_u01_r18_start_overlay.py",
            "tests/tooling/test_f20_u01_r18_start_projection.py"} <= overlay.prior.CONTROL_SCOPE


def test_r18_rejects_forged_write_fence():
    raw, _, progress, wi, invocation, rows, at = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    tampered = {"events": deepcopy(json.loads(outputs[overlay.EVENTS])),
                "progress": json.loads(outputs[overlay.PROGRESS])}
    tampered["events"]["events"][1898]["details"]["write_fencing_token"] = "forged"
    assert "F20_U01_R18_TRANSITION_INVALID" in overlay.validate_control(ROOT, tampered, at)
