"""R1b exact2 handoff preserves history and C30/release hold."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

from scripts import f20_u01_r1b_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
BASE = "ac69a78"  # pinned R1b prep/status checkpoint
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


def test_r1b_exact2_transition_preserves_event_bytes_and_hold(tmp_path):
    from scripts.check_project_progress import load_bundle, validate_bundle
    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    old_raw = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, base, NOW, "r1btest")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    progress = bundle["progress"]
    assert len(rows) == overlay.END == 1780
    assert (root / overlay.EVENTS).read_bytes() == overlay._append_raw(old_raw, rows[1774:])
    assert progress["completed_f20_u01_r1_worker_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r1_write_lease"]["status"] == "REVOKED"
    assert progress["worker_lease"]["lease_epoch"] == 11
    assert progress["write_lease"]["path_scope"] == overlay.SCOPE
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, NOW) == []
    assert overlay.collect_git(root, progress) == []
    assert validate_bundle(load_bundle(root)) == []


def test_r1b_rejects_forged_transition_progress_digest_manifest(tmp_path):
    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    overlay.materialize(root, base, NOW, "r1btest")
    original = {path: (root / path).read_bytes() for path in (
        overlay.EVENTS, overlay.PROGRESS, overlay.DIGEST, overlay.MANIFEST)}
    for path, mutate, code in (
        (overlay.EVENTS, lambda doc: doc["events"][1778]["details"].update(
            {"path_scope": ["packages/api/runtime.py"]}), "F20_U01_R1B_TRANSITION_INVALID"),
        (overlay.PROGRESS, lambda doc: doc.update({"completed_packages": ["F-20"]}),
         "F20_U01_R1B_PROGRESS_INVALID"),
        (overlay.DIGEST, lambda doc: doc["progress"].update({"file_sha256": "0" * 64}),
         "F20_U01_R1B_DIGEST_INVALID"),
        (overlay.MANIFEST, lambda doc: doc.update({"accepted": True}),
         "F20_U01_R1B_MANIFEST_INVALID"),
    ):
        doc = json.loads(original[path])
        mutate(doc)
        (root / path).write_bytes(overlay.r1._pretty(doc))
        assert code in overlay.validate_control(root, _bundle(root), NOW)
        (root / path).write_bytes(original[path])


def test_r1b_rejects_handoff_and_predecessor_tampering(tmp_path):
    from scripts.check_project_progress import load_bundle, validate_bundle

    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    overlay.materialize(root, base, NOW, "r1btest")
    handoff = (root / overlay.HANDOFF).read_bytes()
    (root / overlay.HANDOFF).write_bytes(handoff.replace(
        overlay.NEXT.encode(), b"F20_U01_R1B_FORGED_ACTION"))
    errors = validate_bundle(load_bundle(root))
    assert "HANDOFF_NEXT_ACTION_MISMATCH" in errors
    (root / overlay.HANDOFF).write_bytes(handoff)

    for path in (overlay.REPORT, overlay.prior.DIGEST, overlay.prior.MANIFEST,
                 overlay.prior.WI):
        old = (root / path).read_bytes()
        (root / path).write_bytes(old + b"\n")
        assert "F20_U01_R1B_PREDECESSOR_INVALID" in overlay.validate_control(
            root, _bundle(root), NOW)
        (root / path).write_bytes(old)


def test_r1b_rejects_reused_token_expiry_and_unscoped_git(tmp_path):
    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    overlay.materialize(root, base, NOW, "r1btest")
    raw = (root / overlay.EVENTS).read_bytes()
    forged = json.loads(raw)
    forged["events"][1777]["details"]["execution_fencing_token"] = (
        forged["events"][1771]["details"]["execution_fencing_token"])
    (root / overlay.EVENTS).write_bytes(overlay.r1._pretty(forged))
    assert "F20_U01_R1B_TRANSITION_INVALID" in overlay.validate_control(
        root, _bundle(root), NOW)
    (root / overlay.EVENTS).write_bytes(raw)
    assert "F20_U01_R1B_TRANSITION_INVALID" in overlay.validate_control(
        root, _bundle(root), NOW + overlay.timedelta(hours=12))
    (root / "unscoped.txt").write_text("unscoped", encoding="utf-8")
    assert "F20_U01_R1B_GIT_INVALID" in overlay.collect_git(
        root, _bundle(root)["progress"])
