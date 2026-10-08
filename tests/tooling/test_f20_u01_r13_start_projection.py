"""R13 scoped Agent owner receives only its exact persistence writer scope."""

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path

from scripts import f20_u01_r13_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
AT = datetime(2026, 9, 29, 22, 55, tzinfo=timezone.utc)


def _inputs():
    raw, stream, progress = overlay._historical(ROOT)
    wi = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi, invocation, AT, "r13test01")
    return raw, stream, progress, wi, invocation, rows


def test_r13_fresh_epoch26_exact3_dual_lease():
    _, stream, progress, _, _, rows = _inputs()
    assert stream["last_sequence"] == 1866
    assert [row["sequence"] for row in rows] == [1867, 1868, 1869, 1870]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    worker, write = rows[1]["details"], rows[2]["details"]
    assert worker["lease_epoch"] == write["write_epoch"] == 26
    assert worker["path_scope"] == write["path_scope"] == overlay.SCOPE
    assert write["worker_lease_id"] == worker["lease_id"]
    assert worker["execution_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert write["write_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert progress["worker_lease"] is progress["write_lease"] is None


def test_r13_projection_preserves_history_and_c30_block():
    raw, stream, progress, wi, invocation, rows = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    prefix = raw.split(b'"events": [\n', 1)[1].split(b'\n  ],\n  "last_event_id"', 1)[0]
    assert outputs[overlay.EVENTS].split(b'"events": [\n', 1)[1].startswith(prefix)
    new_stream = json.loads(outputs[overlay.EVENTS])
    new = json.loads(outputs[overlay.PROGRESS])
    assert new_stream["last_sequence"] == 1870
    assert new["repository"]["product_write_scope"] == overlay.SCOPE
    assert new["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in new["completed_packages"]


def test_r13_scope_is_only_scoped_agent_owner_read():
    assert overlay.SCOPE == [
        "packages/persistence/operations_agent_owner_read.py",
        "tests/persistence/test_f20_u01_agent_owner_read.py",
        "docs/04_test_reports/F-20_U01_R13_SCOPED_AGENT_OWNER_RESULT.md",
    ]
    assert overlay.CONTROL_SCOPE.isdisjoint(overlay.SCOPE)


def test_r13_dirty_resolves_to_existing_git_reader():
    assert overlay._dirty(ROOT) == overlay.prior.prior._dirty(ROOT)


def test_predecessor_allows_only_r13_control_transition():
    assert {
        "scripts/f20_u01_r13_start_overlay.py",
        "tests/tooling/test_f20_u01_r13_start_projection.py",
    } <= overlay.prior.CONTROL_SCOPE
    assert overlay.prior.CONTROL_SCOPE.isdisjoint(overlay.SCOPE)


def test_r13_rejects_forged_write_fence():
    raw, _, progress, wi, invocation, rows = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    tampered = {"events": deepcopy(json.loads(outputs[overlay.EVENTS])),
                "progress": json.loads(outputs[overlay.PROGRESS])}
    tampered["events"]["events"][1868]["details"]["write_fencing_token"] = "forged"
    assert "F20_U01_R13_TRANSITION_INVALID" in overlay.validate_control(
        ROOT, tampered, datetime.now(timezone.utc))
