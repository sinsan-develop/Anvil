"""R6B scoped QA completion must revoke both leases without accepting F-20."""

from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]
BASE = "9ddbb65a251f9b9a07979d09b777d7ec2678db6c"
AT = datetime(2026, 9, 29, 7, 31, tzinfo=timezone.utc)


def _overlay():
    try:
        return importlib.import_module("scripts.f20_u01_r6b_close_overlay")
    except ModuleNotFoundError:
        pytest.fail("R6B close projection is missing")


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
    relative = "docs/04_test_reports/F-20_U01_R6B_CLOSE_PLAN.md"
    (root / relative).write_bytes((ROOT / relative).read_bytes())
    return root


def _bundle(root: Path, overlay) -> dict:
    return {"_root": root, "events": json.loads((root / overlay.EVENTS).read_bytes()),
            "progress": json.loads((root / overlay.PROGRESS).read_bytes())}


def test_r6b_close_revokes_write_then_worker_and_preserves_blocking_state(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    original = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, BASE, AT)
    current = (root / overlay.EVENTS).read_bytes()
    rows, progress = _bundle(root, overlay)["events"]["events"], _bundle(root, overlay)["progress"]
    historical_prefix = original.split(b'\n  ],\n  "last_event_id"')[0]
    assert current.replace(b'"last_sequence": 1830', b'"last_sequence": 1828', 1).startswith(
        historical_prefix)
    assert len(rows) == 1830
    assert [row["event_type"] for row in rows[1828:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    assert progress["worker_lease"] is None and progress["write_lease"] is None
    assert progress["active_agent"] == "main-agent-eoul"
    assert progress["repository"]["product_write_scope"] == []
    assert progress["completed_f20_u01_r6b_write_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r6b_worker_lease"]["status"] == "REVOKED"
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []


def test_r6b_close_rejects_event_and_acceptance_forgery(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT)
    event_path = root / overlay.EVENTS
    original = event_path.read_bytes()
    event_path.write_bytes(original.replace(b'"event_id": "evt_f20_1829_write_lease_revoked"',
                                            b'"event_id": "evt_f20_1829_forged"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    event_path.write_bytes(original)
    progress_path = root / overlay.PROGRESS
    progress = json.loads(progress_path.read_bytes())
    progress["completed_packages"].append("F-20")
    progress_path.write_text(json.dumps(progress), encoding="utf-8")
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))


def test_r6b_close_public_g05_route_accepts_only_bounded_projection(tmp_path):
    overlay = _overlay()
    checker = importlib.import_module("scripts.check_project_progress")
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT)
    assert checker.validate_bundle(checker.load_bundle(root)) == []
