"""R37 control grants only Provider registration source host binding."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from unittest import mock

from scripts import f20_u01_r37_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def _candidate():
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi_sha, invocation_sha,
                              at, "r37prov1004")
    outputs = overlay._projection(ROOT, progress, raw, stream, rows,
                                  wi_sha, invocation_sha)
    return raw, stream, progress, rows, outputs


def test_r37_start_preserves_prefix_and_issues_exact4_epoch52():
    _, stream, old, rows, outputs = _candidate()
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert stream["last_sequence"] == 2022
    assert old["worker_lease"] is old["write_lease"] is None
    assert events["events"][:2022] == stream["events"]
    assert [row["sequence"] for row in rows] == [2023, 2024, 2025, 2026]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert len(overlay.SCOPE) == 4
    assert final["worker_lease"]["lease_epoch"] == 52
    assert final["write_lease"]["write_epoch"] == 52
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["repository"]["local_wsl_qa_head"] == overlay.prior.QA_HEAD
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]


def test_r37_start_bounds_scope_and_rejects_forged_prefix():
    raw, stream, _, rows, _ = _candidate()
    assert overlay.REPORT in overlay.SCOPE
    assert overlay.REPORT not in overlay.CONTROL_SCOPE
    assert set(overlay.SCOPE).isdisjoint(overlay.CONTROL_SCOPE)
    assert "packages/api/operations.py" not in overlay.SCOPE
    assert "packages/api/registry.py" not in overlay.SCOPE
    assert "apps/web/src/console/App.tsx" not in overlay.SCOPE
    assert "docs/progress/progress-events.json" not in overlay.SCOPE
    assert overlay._frozen_prior_match(ROOT)
    assert all(path not in overlay.CONTROL_SCOPE for path in
               (overlay.PLAN, overlay.WI, overlay.INVOCATION))
    changed = raw.replace(b'"last_sequence": 2022', b'"last_sequence": 2021')
    try:
        overlay._append_raw(changed, stream, rows)
    except ValueError as error:
        assert str(error) == "F20_U01_R37_EVENT_BYTES_INVALID"
    else:
        raise AssertionError("forged prefix accepted")
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    at = datetime.fromisoformat(rows[0]["occurred_at"])
    later = overlay._make_rows(stream["events"], wi_sha, invocation_sha,
                               at + timedelta(hours=12), "r37prov1004")
    assert later[1]["details"]["expires_at"] != rows[1]["details"]["expires_at"]


def test_r37_base_has_frozen_predecessor_and_prior_evidence():
    for path in overlay.FROZEN_PRIOR:
        assert overlay._git(ROOT, "cat-file", "-e", f"{overlay.BASE}:{path}") == b""
    assert overlay._git(ROOT, "cat-file", "-e",
                        f"{overlay.BASE}:scripts/f20_u01_r37_start_overlay.py") == b""
    assert overlay._git(ROOT, "rev-parse", overlay.BASE).decode().strip() == overlay.BASE


def test_r37_frozen_work_instruction_tamper_is_rejected():
    original = Path.read_bytes
    target = ROOT / overlay.WI

    def changed(path: Path) -> bytes:
        content = original(path)
        return content + b"\n" if path == target else content

    with mock.patch.object(Path, "read_bytes", changed):
        assert not overlay._frozen_prior_match(ROOT)
