"""R8 queue read owner lease cannot alter earlier event authority or acceptance."""

from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]
BASE = "989b7a38c927f925c5d3d882ade1d381c930b85a"
AT = datetime(2026, 9, 29, 11, 25, tzinfo=timezone.utc)


def _overlay():
    try:
        return importlib.import_module("scripts.f20_u01_r8_overlay")
    except ModuleNotFoundError:
        pytest.fail("R8 queue source lease overlay is missing")


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


def test_r8_issues_exact_three_scoped_leases_without_acceptance(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    original = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, AT, "testnonce")
    bundle = _bundle(root, overlay)
    events, progress = bundle["events"], bundle["progress"]
    assert len(events["events"]) == 1840
    assert [row["event_type"] for row in events["events"][1836:]] == [
        "WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"]
    assert (root / overlay.EVENTS).read_bytes().replace(
        b'"last_sequence": 1840', b'"last_sequence": 1836', 1
    ).startswith(original.split(b'\n  ],\n  "last_event_id"')[0])
    assert progress["worker_lease"]["lease_epoch"] == 21
    assert progress["write_lease"]["write_epoch"] == 21
    assert progress["repository"]["product_write_scope"] == [
        "packages/persistence/operations_queue_read.py",
        "tests/persistence/test_f20_u01_r8_queue_read.py",
        "docs/04_test_reports/F-20_U01_R8_QUEUE_READ_RESULT.md"]
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert overlay.validate_control(root, bundle, AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []


def test_r8_rejects_forged_event_and_acceptance(tmp_path):
    overlay = _overlay()
    root = _fixture(tmp_path)
    overlay.materialize(root, AT, "testnonce")
    events = root / overlay.EVENTS
    original = events.read_bytes()
    events.write_bytes(original.replace(b'"event_id": "evt_f20_1837_work_instruction_issued"',
                                        b'"event_id": "evt_f20_1837_forged"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events.write_bytes(original)
    progress = root / overlay.PROGRESS
    document = json.loads(progress.read_bytes())
    document["completed_packages"].append("F-20")
    progress.write_text(json.dumps(document), encoding="utf-8")
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))


def test_r8_public_g05_route(tmp_path):
    overlay = _overlay()
    checker = importlib.import_module("scripts.check_project_progress")
    root = _fixture(tmp_path)
    overlay.materialize(root, AT, "testnonce")
    assert checker.validate_bundle(checker.load_bundle(root)) == []
