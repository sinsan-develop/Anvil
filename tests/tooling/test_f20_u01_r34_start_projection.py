"""R34 control grants only the historical repair and scoped Run-card writer."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from scripts import f20_u01_r34_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _candidate():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi_sha, invocation_sha,
                              at, "r34run1003")
    outputs = overlay._projection(ROOT, progress, raw, stream, rows,
                                  wi_sha, invocation_sha)
    return stream, progress, rows, outputs


def test_r34_start_preserves_event_prefix_and_issues_exact8_epoch49():
    stream, old, rows, outputs = _candidate()
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert stream["last_sequence"] == 2004
    assert old["worker_lease"] is old["write_lease"] is None
    assert events["events"][:2004] == stream["events"]
    assert [row["sequence"] for row in rows] == [2005, 2006, 2007, 2008]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert len(overlay.SCOPE) == 8
    assert final["worker_lease"]["lease_epoch"] == 49
    assert final["write_lease"]["write_epoch"] == 49
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["repository"]["local_wsl_qa_head"] == overlay.prior.QA_HEAD
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]


def test_r34_start_rejects_wrong_prefix_and_bounds_scope():
    stream, _, rows, _ = _candidate()
    raw, _, _ = overlay._historical(ROOT)
    assert set(overlay.SCOPE).isdisjoint(overlay.CONTROL_SCOPE - {overlay.REPORT})
    assert "docs/progress/progress-events.json" not in overlay.SCOPE
    assert "docs/progress/build-progress.json" not in overlay.SCOPE
    assert "scripts/check_project_progress.py" not in overlay.SCOPE
    assert overlay._authority_bytes_match(ROOT)
    changed = raw.replace(b'"last_sequence": 2004', b'"last_sequence": 2003')
    try:
        overlay._append_raw(changed, stream, rows)
    except ValueError as error:
        assert str(error) == "F20_U01_R34_EVENT_BYTES_INVALID"
    else:
        raise AssertionError("forged prefix accepted")
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    at = datetime.fromisoformat(rows[0]["occurred_at"])
    later = overlay._make_rows(stream["events"], wi_sha, invocation_sha,
                               at + timedelta(hours=12), "r34run1003")
    assert later[1]["details"]["expires_at"] != rows[1]["details"]["expires_at"]


def test_r34_base_has_frozen_instruction_and_predecessor():
    for path in overlay.AUTHORITY_FILES:
        assert overlay._git(ROOT, "cat-file", "-e", f"{overlay.BASE}:{path}") == b""
    assert overlay._git(ROOT, "rev-parse", overlay.BASE).decode().strip() == overlay.BASE
