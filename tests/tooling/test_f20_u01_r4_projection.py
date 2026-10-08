"""R4 must grant exact-three UI work without rewriting R3b/C30 history."""

from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]

def test_r4_public_history_rejects_authority_forgery(tmp_path):
    """Clock isolation must never mask token, actor, predecessor or hash forgery."""
    import copy
    import importlib
    checker = importlib.import_module("scripts.check_project_progress")
    overlay = importlib.import_module("scripts.f20_u01_r4_overlay")
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT, "reviewtest")
    bundle = checker.load_bundle(root)

    def public(candidate):
        real_validate = overlay.validate_control
        with mock.patch.object(overlay, "validate_control", side_effect=
                lambda root, incoming, wall_now: real_validate(root, incoming, AT + timedelta(seconds=1))):
            errors = checker.validate_bundle(candidate)
        assert overlay.validate_control is real_validate
        return errors

    assert public(bundle) == []
    for event_type, field, replacement in (
        ("WORKER_LEASE_ISSUED", "execution_fencing_token", "forged-execution"),
        ("WRITE_LEASE_ISSUED", "write_fencing_token", "forged-write"),
        ("WORKER_LEASE_ISSUED", "actor_id", "foreign-actor"),
        ("WORKER_LEASE_ISSUED", "baseline_git_commit", "0" * 40),
        ("WORK_INSTRUCTION_ISSUED", "sha256", "0" * 64),
    ):
        forged = copy.deepcopy(bundle)
        row = next(row for row in reversed(forged["events"]["events"])
                   if row["event_type"] == event_type)
        assert field in row["details"]
        row["details"][field] = replacement
        assert public(forged) == ["F20_U01_R4_TRANSITION_INVALID"], field
    forged = copy.deepcopy(bundle)
    forged["events"]["events"][0]["event_id"] = "forged-predecessor"
    assert public(forged) == ["F20_U01_R4_PREDECESSOR_INVALID"]
    forged = copy.deepcopy(bundle)
    forged["progress"]["snapshot_hash"] = "0" * 64
    assert "PRG_SNAPSHOT_HASH_MISMATCH" in public(forged)
    assert public(bundle) == []
BASE = "2c37dd780fd72ad7dd7fda3ed6f447ccec8d8a44"
AT = datetime(2026, 9, 28, 19, 30, tzinfo=timezone.utc)


def _overlay():
    return importlib.import_module("scripts.f20_u01_r4_overlay")


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


def test_r4_exact3_append_only_transition_and_blocking_hold(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    raw = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, BASE, AT, "r4test")
    bundle = _bundle(root, overlay)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == overlay.END == 1810
    assert (root / overlay.EVENTS).read_bytes() == overlay._append_raw(raw, rows[1804:])
    assert [row["event_type"] for row in rows[1804:]] == list(overlay.TYPES)
    assert progress["completed_f20_u01_r3b_write_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r3b_worker_lease"]["status"] == "REVOKED"
    assert progress["worker_lease"]["lease_epoch"] == 16
    assert progress["write_lease"]["path_scope"] == overlay.SCOPE
    assert progress["worker_lease"]["execution_fencing_token"] != rows[1801]["details"]["execution_fencing_token"]
    assert progress["write_lease"]["write_fencing_token"] != rows[1802]["details"]["write_fencing_token"]
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []

    events_path = root / overlay.EVENTS
    events_path.write_bytes(events_path.read_bytes().replace(
        b'"event_id": "evt_f20_1804_package_resumed"',
        b'"event_id": "evt_f20_1804_package_changed"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events_path.write_bytes(overlay._append_raw(raw, rows[1804:]))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(hours=12)) == [
        "F20_U01_R4_TRANSITION_INVALID"]
    unrelated = root / "unrelated-plan.md"
    unrelated.write_text("out of scope", encoding="utf-8")
    assert overlay.collect_git(root, progress) == ["F20_U01_R4_GIT_INVALID"]


def test_r4_rejects_projection_tampering(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT, "r4test")
    progress_path = root / overlay.PROGRESS
    progress = json.loads(progress_path.read_bytes())
    progress["repository"]["projection_mode"] = overlay.prior.MODE
    progress_path.write_text(json.dumps(progress), encoding="utf-8")
    assert "F20_U01_R4_PROGRESS_INVALID" in overlay.validate_control(
        root, _bundle(root, overlay), AT + timedelta(seconds=1))


def test_r4_public_validator_keeps_f20_hold(tmp_path):
    overlay = _overlay()
    checker = importlib.import_module("scripts.check_project_progress")
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT, "r4test")
    bundle = checker.load_bundle(root)
    assert bundle["progress"]["repository"]["projection_mode"] == overlay.MODE
    assert _public_at(checker, overlay, bundle, AT + timedelta(seconds=1)) == []
    for at in (AT - timedelta(microseconds=1), AT + timedelta(hours=12),
               AT + timedelta(hours=12, seconds=1)):
        assert "F20_U01_R4_TRANSITION_INVALID" in _public_at(
            checker, overlay, bundle, at)
    bundle["progress"]["next_safe_action"] = "forged"
    bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])
    assert "F20_U01_R4_PROGRESS_INVALID" in _public_at(
        checker, overlay, bundle, AT + timedelta(seconds=1))
