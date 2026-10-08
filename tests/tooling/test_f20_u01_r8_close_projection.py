"""R8 Queue source closure is append-only and never accepts F-20."""

from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]
BASE = "b0752d89cfb5a7d8583eea6294f2fc3fd38878ca"
AT = datetime(2026, 9, 29, 12, 4, tzinfo=timezone.utc)


def _overlay():
    try:
        return importlib.import_module("scripts.f20_u01_r8_close_overlay")
    except ModuleNotFoundError:
        pytest.fail("R8 close projection is missing")


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


def test_close_revokes_exact_r8_write_then_worker_without_acceptance(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    original = (root / overlay.EVENTS).read_bytes()
    old = json.loads((root / overlay.PROGRESS).read_bytes())
    overlay.materialize(root, BASE, AT)
    bundle = _bundle(root, overlay)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == 1842
    assert [row["event_type"] for row in rows[1840:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    assert rows[1840]["details"]["lease_id"] == old["write_lease"]["lease_id"]
    assert rows[1841]["details"]["lease_id"] == old["worker_lease"]["lease_id"]
    assert rows[1840]["details"]["write_fencing_token"] == old["write_lease"]["write_fencing_token"]
    assert rows[1841]["details"]["execution_fencing_token"] == old["worker_lease"]["execution_fencing_token"]
    assert rows[:1840] == json.loads(original)["events"]
    assert progress["worker_lease"] is None and progress["write_lease"] is None
    assert progress["active_agent"] == "main-agent-eoul"
    assert progress["repository"]["product_write_scope"] == []
    assert progress["completed_f20_u01_r8_write_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r8_worker_lease"]["status"] == "REVOKED"
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []


def test_close_rejects_token_event_and_acceptance_forgery(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT)
    events = root / overlay.EVENTS
    original = events.read_bytes()
    events.write_bytes(original.replace(b'"event_id": "evt_f20_1841_write_lease_revoked"',
                                        b'"event_id": "evt_f20_1841_forged"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events.write_bytes(original.replace(b'"write_fencing_token": "f20-u01-r8-write-fence',
                                        b'"write_fencing_token": "forged-f20-u01-r8', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events.write_bytes(original)
    progress = root / overlay.PROGRESS
    document = json.loads(progress.read_bytes())
    document["completed_packages"].append("F-20")
    progress.write_text(json.dumps(document), encoding="utf-8")
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))


def test_close_rejects_expired_lease_and_out_of_scope_git(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    with pytest.raises(RuntimeError, match="PREDECESSOR_INVALID"):
        overlay.materialize(root, BASE, datetime(2026, 9, 30, 0, 0, tzinfo=timezone.utc))
    overlay.materialize(root, BASE, AT)
    (root / "unrelated-user-file.txt").write_text("preserve", encoding="utf-8")
    assert overlay.collect_git(root, _bundle(root, overlay)["progress"])


def test_close_preflight_rejects_dirty_product_before_control_write(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    events, progress = (root / overlay.EVENTS).read_bytes(), (root / overlay.PROGRESS).read_bytes()
    product = root / "packages/persistence/operations_queue_read.py"
    product.write_bytes(product.read_bytes() + b"\n# unverified user work\n")
    with pytest.raises(RuntimeError, match="PREDECESSOR_INVALID"):
        overlay.materialize(root, BASE, AT)
    assert (root / overlay.EVENTS).read_bytes() == events
    assert (root / overlay.PROGRESS).read_bytes() == progress
    assert not (root / overlay.DIGEST).exists()
    assert not (root / overlay.MANIFEST).exists()


def test_close_git_rejects_remote_descendant_diverged_from_local_head(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT)
    tree = subprocess.check_output(["git", "rev-parse", f"{BASE}^{{tree}}"], cwd=root,
                                   text=True).strip()
    fork = subprocess.check_output([
        "git", "-c", "user.name=QA", "-c", "user.email=qa@example.invalid",
        "commit-tree", tree, "-p", BASE, "-m", "divergent remote"],
        cwd=root, text=True).strip()
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops",
                    fork], cwd=root, check=True)
    assert overlay.collect_git(root, _bundle(root, overlay)["progress"]) == [
        "F20_U01_R8_CLOSE_GIT_INVALID"]


def test_close_public_g05_route(tmp_path):
    overlay = _overlay()
    checker = importlib.import_module("scripts.check_project_progress")
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT)
    assert checker.validate_bundle(checker.load_bundle(root)) == []
