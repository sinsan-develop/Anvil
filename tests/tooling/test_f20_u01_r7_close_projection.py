"""R7 scoped QA close revokes both leases without F-20 acceptance."""

from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]
BASE = "880b087d5ad0b8ce112c561f41c446f8348f666f"
AT = datetime(2026, 9, 29, 8, 42, tzinfo=timezone.utc)


def _overlay():
    try:
        return importlib.import_module("scripts.f20_u01_r7_close_overlay")
    except ModuleNotFoundError:
        pytest.fail("R7 close projection is missing")


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


def test_r7_close_revokes_write_then_worker_without_acceptance(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    original = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, BASE, AT)
    bundle = _bundle(root, overlay)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == 1836
    assert [row["event_type"] for row in rows[1834:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED"]
    assert (root / overlay.EVENTS).read_bytes().replace(
        b'"last_sequence": 1836', b'"last_sequence": 1834', 1
    ).startswith(original.split(b'\n  ],\n  "last_event_id"')[0])
    assert progress["worker_lease"] is None and progress["write_lease"] is None
    assert progress["active_agent"] == "main-agent-eoul"
    assert progress["repository"]["product_write_scope"] == []
    assert progress["completed_f20_u01_r7_write_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r7_worker_lease"]["status"] == "REVOKED"
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []


def test_r7_close_rejects_event_and_acceptance_forgery(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT)
    events = root / overlay.EVENTS
    original = events.read_bytes()
    events.write_bytes(original.replace(b'"event_id": "evt_f20_1835_write_lease_revoked"',
                                        b'"event_id": "evt_f20_1835_forged"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events.write_bytes(original)
    progress = root / overlay.PROGRESS
    document = json.loads(progress.read_bytes())
    document["completed_packages"].append("F-20")
    progress.write_text(json.dumps(document), encoding="utf-8")
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))


def test_r7_close_public_g05_route(tmp_path):
    overlay = _overlay()
    checker = importlib.import_module("scripts.check_project_progress")
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, AT)
    assert checker.validate_bundle(checker.load_bundle(root)) == []
