"""R2b must preserve R2 evidence while issuing only the current-history exact2."""

from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import subprocess

from scripts import f20_u01_r2b_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
BASE = "e57ba12c92209663261b2d36bedb97a05477f795"
NOW = datetime.now(timezone.utc).replace(microsecond=0)


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


def _bundle(root: Path) -> dict:
    return {"_root": root, "events": json.loads((root / overlay.EVENTS).read_bytes()),
            "progress": json.loads((root / overlay.PROGRESS).read_bytes())}


def test_r2b_transition_exact2_prefix_and_blocking_hold(tmp_path):
    from scripts.check_project_progress import load_bundle, validate_bundle

    root = _fixture(tmp_path)
    raw = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, BASE, NOW, "r2btest")
    bundle = _bundle(root)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == overlay.END == 1792
    assert (root / overlay.EVENTS).read_bytes() == overlay._append_raw(raw, rows[1786:])
    assert progress["completed_f20_u01_r2_worker_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r2_write_lease"]["status"] == "REVOKED"
    assert progress["worker_lease"]["lease_epoch"] == 13
    assert progress["write_lease"]["path_scope"] == overlay.SCOPE
    assert progress["repository"]["projection_mode"] == overlay.MODE
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, NOW) == []
    assert overlay.collect_git(root, progress) == []
    assert validate_bundle(load_bundle(root)) == []


def test_r2b_rejects_forged_lease_progress_digest_manifest(tmp_path):
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, NOW, "r2btest")
    original = {path: (root / path).read_bytes() for path in (
        overlay.EVENTS, overlay.PROGRESS, overlay.DIGEST, overlay.MANIFEST)}
    for path, mutate, code in (
        (overlay.EVENTS, lambda doc: doc["events"][1790]["details"].update(
            {"path_scope": ["packages/api/runtime.py"]}), "F20_U01_R2B_TRANSITION_INVALID"),
        (overlay.PROGRESS, lambda doc: doc.update({"completed_packages": ["F-20"]}),
         "F20_U01_R2B_PROGRESS_INVALID"),
        (overlay.DIGEST, lambda doc: doc["progress"].update({"file_sha256": "0" * 64}),
         "F20_U01_R2B_DIGEST_INVALID"),
        (overlay.MANIFEST, lambda doc: doc.update({"accepted": True}),
         "F20_U01_R2B_MANIFEST_INVALID"),
    ):
        doc = json.loads(original[path])
        mutate(doc)
        (root / path).write_bytes(overlay.r1._pretty(doc))
        assert code in overlay.validate_control(root, _bundle(root), NOW)
        (root / path).write_bytes(original[path])


def test_r2b_rejects_predecessor_or_prep_anchor_drift(tmp_path):
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, NOW, "r2btest")
    assert "F20_U01_R2B_TRANSITION_INVALID" in overlay.validate_control(
        root, _bundle(root), NOW + timedelta(hours=12))
    for path in (overlay.REPORT, overlay.WI, overlay.INVOCATION,
                 "scripts/f20_u01_r2_overlay.py"):
        target = root / path
        old = target.read_bytes()
        target.write_bytes(old + b"\n")
        assert "F20_U01_R2B_PREDECESSOR_INVALID" in overlay.validate_control(
            root, _bundle(root), NOW)
        target.write_bytes(old)
    (root / "unscoped.txt").write_text("unscoped", encoding="utf-8")
    assert "F20_U01_R2B_GIT_INVALID" in overlay.collect_git(root, _bundle(root)["progress"])


def test_r2b_rejects_forged_predecessor_commit(tmp_path):
    root = _fixture(tmp_path)
    raw = (root / overlay.EVENTS).read_bytes()
    target = root / overlay.EVENTS
    target.write_bytes(raw.replace(b'"sequence": 1,', b'"sequence": 1 ,', 1))
    subprocess.run(["git", "add", "--", overlay.EVENTS], cwd=root, check=True)
    subprocess.run(["git", "-c", "user.name=Anvil Test", "-c",
                    "user.email=test@example.invalid", "commit", "-qm", "forged predecessor"],
                   cwd=root, check=True)
    forged = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", forged],
                   cwd=root, check=True)
    try:
        overlay.materialize(root, forged, NOW, "r2btest")
    except RuntimeError as error:
        assert "F20_U01_R2B_PREDECESSOR_INVALID" in str(error)
    else:
        raise AssertionError("forged predecessor was accepted")


def test_r2b_rejects_forged_prepared_instruction_commit(tmp_path):
    root = _fixture(tmp_path)
    target = root / overlay.WI
    target.write_bytes(target.read_bytes() + b"\n")
    subprocess.run(["git", "add", "--", overlay.WI], cwd=root, check=True)
    subprocess.run(["git", "-c", "user.name=Anvil Test", "-c",
                    "user.email=test@example.invalid", "commit", "-qm", "forged instruction"],
                   cwd=root, check=True)
    forged = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", forged],
                   cwd=root, check=True)
    try:
        overlay.materialize(root, forged, NOW, "r2btest")
    except RuntimeError as error:
        assert "F20_U01_R2B_PREDECESSOR_INVALID" in str(error)
    else:
        raise AssertionError("forged prepared instruction was accepted")


def test_r2b_allows_only_named_r3a_control_preparation(tmp_path):
    root = _fixture(tmp_path)
    overlay.materialize(root, BASE, NOW, "r2btest")
    plan = root / "docs/04_test_reports/F-20_U01_R3A_OPERATIONS_ALERTS_BINDING_PLAN.md"
    plan.write_text("R3a draft", encoding="utf-8")
    assert overlay.collect_git(root, _bundle(root)["progress"]) == []
    (root / "docs/04_test_reports/unrelated-plan.md").write_text("unrelated", encoding="utf-8")
    assert "F20_U01_R2B_GIT_INVALID" in overlay.collect_git(root, _bundle(root)["progress"])
