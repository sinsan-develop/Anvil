"""R3b must append exact-two authority without rewriting R3a/C30 history."""

from datetime import datetime, timezone, timedelta
import importlib
import json
from pathlib import Path
import subprocess
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
BASE = "0ab54e7768a7870854377baee26b22f95448baca"
AT = datetime(2026, 9, 28, 17, 25, tzinfo=timezone.utc)


def _overlay():
    return importlib.import_module("scripts.f20_u01_r3b_overlay")


def _public_at(checker, overlay, bundle, at):
    """Fix only this historical route's clock, retaining its real authority checks."""
    real_validate = overlay.validate_control
    with mock.patch.object(overlay, "validate_control", side_effect=
            lambda root, candidate, wall_now: real_validate(root, candidate, at)):
        errors = checker.validate_bundle(bundle)
    assert overlay.validate_control is real_validate
    return errors


def _fixture(tmp_path: Path) -> Path:
    root = tmp_path / "repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", str(ROOT), str(root)], check=True)
    subprocess.run(["git", "checkout", "--quiet", "-B", "codex/f18-wsl-ops", BASE],
                   cwd=root, check=True)
    subprocess.run(["git", "remote", "add", "development", str(ROOT)], cwd=root, check=True)
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", BASE],
                   cwd=root, check=True)
    subprocess.run(["git", "branch", "--set-upstream-to=development/codex/f18-wsl-ops"],
                   cwd=root, check=True, capture_output=True)
    return root


def _bundle(root: Path, overlay) -> dict:
    return {"_root": root, "events": json.loads((root / overlay.EVENTS).read_bytes()),
            "progress": json.loads((root / overlay.PROGRESS).read_bytes())}


def test_r3b_exact2_append_only_transition_and_blocking_hold(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    raw = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, BASE, AT, "r3btest")
    bundle = _bundle(root, overlay)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == overlay.END == 1804
    assert (root / overlay.EVENTS).read_bytes() == overlay._append_raw(raw, rows[1798:])
    assert [row["event_type"] for row in rows[1798:]] == list(overlay.TYPES)
    assert progress["completed_f20_u01_r3a_write_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r3a_worker_lease"]["status"] == "REVOKED"
    assert progress["worker_lease"]["lease_epoch"] == 15
    assert progress["write_lease"]["path_scope"] == overlay.SCOPE
    assert progress["worker_lease"]["execution_fencing_token"] != rows[1795]["details"]["execution_fencing_token"]
    assert progress["write_lease"]["write_fencing_token"] != rows[1796]["details"]["write_fencing_token"]
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []

    events_path = root / overlay.EVENTS
    events_path.write_bytes(events_path.read_bytes().replace(
        b'"event_id": "evt_f20_1798_package_resumed"',
        b'"event_id": "evt_f20_1798_package_changed"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events_path.write_bytes(overlay._append_raw(raw, rows[1798:]))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(hours=12)) == [
        "F20_U01_R3B_TRANSITION_INVALID"]
    unrelated = root / "unrelated-plan.md"
    unrelated.write_text("out of scope", encoding="utf-8")
    assert overlay.collect_git(root, progress) == ["F20_U01_R3B_GIT_INVALID"]


def test_r3b_rejects_lease_and_projection_tampering(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT, "r3btest")
    bundle = _bundle(root, overlay)
    progress_path = root / overlay.PROGRESS
    progress = json.loads(progress_path.read_bytes())
    progress["repository"]["projection_mode"] = overlay.prior.MODE
    progress_path.write_text(json.dumps(progress), encoding="utf-8")
    assert "F20_U01_R3B_PROGRESS_INVALID" in overlay.validate_control(
        root, _bundle(root, overlay), AT + timedelta(seconds=1))


def test_r3b_public_validator_keeps_f20_hold(tmp_path):
    overlay = _overlay()
    checker = importlib.import_module("scripts.check_project_progress")
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT, "r3btest")
    bundle = checker.load_bundle(root)
    assert bundle["progress"]["repository"]["projection_mode"] == overlay.MODE
    assert _public_at(checker, overlay, bundle, AT + timedelta(seconds=1)) == []
    for at in (AT - timedelta(microseconds=1), AT + timedelta(hours=12),
               AT + timedelta(hours=12, seconds=1)):
        assert "F20_U01_R3B_TRANSITION_INVALID" in _public_at(
            checker, overlay, bundle, at)
    bundle["progress"]["next_safe_action"] = "forged"
    bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])
    assert "F20_U01_R3B_PROGRESS_INVALID" in _public_at(
        checker, overlay, bundle, AT + timedelta(seconds=1))
