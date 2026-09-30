"""R17 start must issue only the scoped Run host binding writer scope."""

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r17_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _inputs():
    at = datetime.now(timezone.utc).replace(microsecond=0)
    raw, stream, progress = overlay._historical(ROOT)
    wi = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi, invocation, at, "r17test01")
    return raw, stream, progress, wi, invocation, rows, at


def test_r17_fresh_epoch30_exact4_dual_lease():
    _, stream, progress, _, _, rows, _ = _inputs()
    assert stream["last_sequence"] == 1890
    assert [row["sequence"] for row in rows] == [1891, 1892, 1893, 1894]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    worker, write = rows[1]["details"], rows[2]["details"]
    assert worker["lease_epoch"] == write["write_epoch"] == 30
    assert worker["path_scope"] == write["path_scope"] == overlay.SCOPE
    assert write["worker_lease_id"] == worker["lease_id"]
    assert worker["execution_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert write["write_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert progress["worker_lease"] is progress["write_lease"] is None


def test_r17_projection_preserves_event_prefix_and_c30_block():
    raw, _, progress, wi, invocation, rows, _ = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    prefix = raw.split(b'"events": [\n', 1)[1].split(b'\n  ],\n  "last_event_id"', 1)[0]
    assert outputs[overlay.EVENTS].split(b'"events": [\n', 1)[1].startswith(prefix)
    new_stream = json.loads(outputs[overlay.EVENTS])
    new = json.loads(outputs[overlay.PROGRESS])
    assert new_stream["last_sequence"] == 1894
    assert new["repository"]["product_write_scope"] == overlay.SCOPE
    assert new["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in new["completed_packages"]


def test_r17_scope_and_predecessor_control_only():
    assert overlay.SCOPE == [
        "packages/observability/service.py",
        "apps/api/anvil_api/oidc_process.py",
        "tests/observability/test_f20_u01_r17_run_host_binding.py",
        "docs/04_test_reports/F-20_U01_R17_SCOPED_RUN_HOST_BINDING_RESULT.md",
    ]
    assert overlay.CONTROL_SCOPE.isdisjoint(overlay.SCOPE)
    assert {"scripts/f20_u01_r17_start_overlay.py",
            "tests/tooling/test_f20_u01_r17_start_projection.py"} <= overlay.prior.CONTROL_SCOPE


def test_r17_rejects_forged_write_fence():
    raw, _, progress, wi, invocation, rows, at = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    tampered = {"events": deepcopy(json.loads(outputs[overlay.EVENTS])),
                "progress": json.loads(outputs[overlay.PROGRESS])}
    tampered["events"]["events"][1892]["details"]["write_fencing_token"] = "forged"
    assert "F20_U01_R17_TRANSITION_INVALID" in overlay.validate_control(ROOT, tampered, at)
