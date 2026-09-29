"""R7 dual lease is bound to the old raw event prefix and exact-four scope."""

from datetime import datetime, timedelta, timezone
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
BASE = "0c4d08d908aca48ea7a7024ce5f10685b472af52"
AT = datetime(2026, 9, 29, 8, 0, tzinfo=timezone.utc)


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


def test_r7_issues_bound_exact_four_leases_and_preserves_blocking(tmp_path):
    overlay = importlib.import_module("scripts.f20_u01_r7_overlay")
    root = _fixture(tmp_path)
    original = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, AT, "testnonce")
    bundle = _bundle(root, overlay)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == 1834
    assert [row["event_type"] for row in rows[1830:]] == list(overlay.KINDS)
    assert (root / overlay.EVENTS).read_bytes().replace(
        b'"last_sequence": 1834', b'"last_sequence": 1830', 1
    ).startswith(original.split(b'\n  ],\n  "last_event_id"')[0])
    assert progress["worker_lease"]["lease_epoch"] == 20
    assert progress["write_lease"]["write_epoch"] == 20
    assert progress["repository"]["product_write_scope"] == overlay.SCOPE
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert overlay.validate_control(root, bundle, AT + timedelta(seconds=1)) == []
    assert overlay.collect_git(root, progress) == []


def test_r7_rejects_event_and_acceptance_forgery(tmp_path):
    overlay = importlib.import_module("scripts.f20_u01_r7_overlay")
    root = _fixture(tmp_path)
    overlay.materialize(root, AT, "testnonce")
    events = root / overlay.EVENTS
    original = events.read_bytes()
    events.write_bytes(original.replace(b'"event_id": "evt_f20_1831_work_instruction_issued"',
                                        b'"event_id": "evt_f20_1831_forged"', 1))
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))
    events.write_bytes(original)
    progress = root / overlay.PROGRESS
    document = json.loads(progress.read_bytes())
    document["completed_packages"].append("F-20")
    progress.write_text(json.dumps(document), encoding="utf-8")
    assert overlay.validate_control(root, _bundle(root, overlay), AT + timedelta(seconds=1))


def test_r7_public_g05_route(tmp_path):
    overlay = importlib.import_module("scripts.f20_u01_r7_overlay")
    checker = importlib.import_module("scripts.check_project_progress")
    root = _fixture(tmp_path)
    overlay.materialize(root, AT, "testnonce")
    assert checker.validate_bundle(checker.load_bundle(root)) == []


def test_r7_evidence_scope_accepts_only_four_named_artifacts(tmp_path):
    overlay = importlib.import_module("scripts.f20_u01_r7_overlay")
    root = _fixture(tmp_path)
    overlay.materialize(root, AT, "testnonce")
    progress = json.loads((root / overlay.PROGRESS).read_bytes())
    evidence = "docs/test_reports/U-01/evidence/r7-14694e5"
    for name in ("page-requests.json", "pre-auth-error.png", "revoked-blocked.png",
                 "stored-critical.png"):
        relative = f"{evidence}/{name}"
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((ROOT / relative).read_bytes())
    assert overlay.collect_git(root, progress) == []
    (root / evidence / "unexpected.txt").write_text("not scoped", encoding="utf-8")
    assert overlay.collect_git(root, progress) == ["F20_U01_R7_GIT_INVALID"]
