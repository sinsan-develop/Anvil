"""R3a must append its exact5 lease without rewriting the R2b/C30 history."""

from datetime import datetime, timezone, timedelta
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
BASE = "a0410cc5a4b2233d928ea746f2dd5e6eb3168a98"
AT = datetime(2026, 9, 28, 15, 0, tzinfo=timezone.utc)


def _overlay():
    try:
        return importlib.import_module("scripts.f20_u01_r3a_overlay")
    except ModuleNotFoundError:
        raise AssertionError("R3A_OVERLAY_MISSING") from None


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


def test_r3a_exact5_append_only_transition_and_blocking_hold(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    raw = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, BASE, AT, "r3atest")
    bundle = _bundle(root, overlay)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == overlay.END == 1798
    assert (root / overlay.EVENTS).read_bytes() == overlay._append_raw(raw, rows[1792:])
    assert [row["event_type"] for row in rows[1792:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert progress["completed_f20_u01_r2b_write_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r2b_worker_lease"]["status"] == "REVOKED"
    assert progress["worker_lease"]["lease_epoch"] == 14
    assert progress["write_lease"]["path_scope"] == overlay.SCOPE
    assert progress["worker_lease"]["execution_fencing_token"] != rows[1789]["details"]["execution_fencing_token"]
    assert progress["write_lease"]["write_fencing_token"] != rows[1790]["details"]["write_fencing_token"]
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []
    events_path = root / overlay.EVENTS
    events_path.write_bytes(events_path.read_bytes().replace(
        b'"event_id": "evt_f20_1792_package_resumed"',
        b'"event_id": "evt_f20_1792_package_changed"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events_path.write_bytes(overlay._append_raw(raw, rows[1792:]))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(hours=12)) == [
        "F20_U01_R3A_TRANSITION_INVALID"]
    unrelated = root / "unrelated-plan.md"
    unrelated.write_text("out of scope", encoding="utf-8")
    assert overlay.collect_git(root, progress) == ["F20_U01_R3A_GIT_INVALID"]
