"""R2 handoff must bind the exact Dashboard scope without clearing C30."""

from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import subprocess
from unittest import mock

from scripts import f20_u01_r2_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
BASE = "3553e6c78056ddd07feac6e3d4e36b40ae15eaea"
# Inside the immutable predecessor lease; never use today's clock for history.
NOW = datetime(2026, 9, 28, 8, 0, tzinfo=timezone.utc)


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


def test_r2_transition_exact3_history_and_blocking_hold(tmp_path):
    from scripts.check_project_progress import load_bundle, validate_bundle
    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    old_raw = (root / overlay.EVENTS).read_bytes()
    overlay.materialize(root, base, NOW, "r2test")
    bundle = _bundle(root)
    rows, progress = bundle["events"]["events"], bundle["progress"]
    assert len(rows) == overlay.END == 1786
    assert (root / overlay.EVENTS).read_bytes() == overlay._append_raw(old_raw, rows[1780:])
    assert progress["completed_f20_u01_r1b_worker_lease"]["status"] == "REVOKED"
    assert progress["completed_f20_u01_r1b_write_lease"]["status"] == "REVOKED"
    assert progress["worker_lease"]["lease_epoch"] == 12
    assert progress["write_lease"]["path_scope"] == overlay.SCOPE
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / overlay.MANIFEST).read_bytes())["accepted"] is False
    assert overlay.validate_control(root, bundle, NOW) == []
    assert overlay.collect_git(root, progress) == []
    real_validate = overlay.validate_control
    for checked_at, expected in (
        (NOW, []),
        (NOW - timedelta(microseconds=1), ["F20_U01_R2_TRANSITION_INVALID"]),
        (NOW + timedelta(hours=12), ["F20_U01_R2_TRANSITION_INVALID"]),
        (NOW + timedelta(hours=12, seconds=1), ["F20_U01_R2_TRANSITION_INVALID"]),
    ):
        # Only substitute this historical route's clock; execute its real checks.
        with mock.patch.object(overlay, "validate_control", side_effect=
                lambda root, bundle, wall_now, at=checked_at:
                    real_validate(root, bundle, at)):
            assert validate_bundle(load_bundle(root)) == expected
    assert overlay.validate_control is real_validate


def test_r2_rejects_forged_lease_and_acceptance(tmp_path):
    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    overlay.materialize(root, base, NOW, "r2test")
    original = {path: (root / path).read_bytes() for path in (
        overlay.EVENTS, overlay.PROGRESS, overlay.DIGEST, overlay.MANIFEST)}
    for path, mutate, code in (
        (overlay.EVENTS, lambda doc: doc["events"][1784]["details"].update(
            {"path_scope": ["packages/api/runtime.py"]}), "F20_U01_R2_TRANSITION_INVALID"),
        (overlay.PROGRESS, lambda doc: doc.update({"completed_packages": ["F-20"]}),
         "F20_U01_R2_PROGRESS_INVALID"),
        (overlay.DIGEST, lambda doc: doc["progress"].update({"file_sha256": "0" * 64}),
         "F20_U01_R2_DIGEST_INVALID"),
        (overlay.MANIFEST, lambda doc: doc.update({"accepted": True}),
         "F20_U01_R2_MANIFEST_INVALID"),
    ):
        doc = json.loads(original[path])
        mutate(doc)
        (root / path).write_bytes(overlay.r1._pretty(doc))
        assert code in overlay.validate_control(root, _bundle(root), NOW)
        (root / path).write_bytes(original[path])


def test_r2_rejects_predecessor_and_expiry(tmp_path):
    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    overlay.materialize(root, base, NOW, "r2test")
    assert "F20_U01_R2_TRANSITION_INVALID" in overlay.validate_control(
        root, _bundle(root), NOW + timedelta(hours=12))
    for path in (overlay.prior.REPORT, overlay.prior.WI, overlay.prior.DIGEST):
        old = (root / path).read_bytes()
        (root / path).write_bytes(old + b"\n")
        assert "F20_U01_R2_PREDECESSOR_INVALID" in overlay.validate_control(
            root, _bundle(root), NOW)
        (root / path).write_bytes(old)
    (root / "unscoped.txt").write_text("unscoped", encoding="utf-8")
    assert "F20_U01_R2_GIT_INVALID" in overlay.collect_git(root, _bundle(root)["progress"])


def test_r2_rejects_prior_allowed_path_mutation(tmp_path):
    root = _fixture(tmp_path)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    overlay.materialize(root, base, NOW, "r2test")
    old_path = root / "scripts/f20_u01_r1_overlay.py"
    old_path.write_bytes(old_path.read_bytes() + b"\n")
    assert "F20_U01_R2_GIT_INVALID" in overlay.collect_git(root, _bundle(root)["progress"])


def test_r2_rejects_forged_predecessor_commit_even_if_projection_matches(tmp_path):
    root = _fixture(tmp_path)
    old_raw = (root / overlay.EVENTS).read_bytes()
    forged_raw = old_raw.replace(b'"sequence": 1,', b'"sequence": 1 ,', 1)
    assert forged_raw != old_raw
    (root / overlay.EVENTS).write_bytes(forged_raw)
    subprocess.run(["git", "add", "--", overlay.EVENTS], cwd=root, check=True)
    subprocess.run(["git", "-c", "user.name=Anvil Test", "-c",
                    "user.email=test@example.invalid", "commit", "-qm", "forged predecessor"],
                   cwd=root, check=True)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", base],
                   cwd=root, check=True)
    old_progress = json.loads((root / overlay.PROGRESS).read_bytes())
    old_rows = json.loads(forged_raw)["events"]
    wi_sha = overlay.r1._sha(overlay.r1._lf((root / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((root / overlay.INVOCATION).read_bytes()))
    additions = overlay._make_rows(old_rows, wi_sha, invocation_sha, base, NOW, "r2test")
    outputs = overlay._projection(old_progress, forged_raw, old_rows, additions, base,
                                  wi_sha, invocation_sha, (root / overlay.REPORT).read_bytes())
    for path, content in outputs.items():
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    assert "F20_U01_R2_PREDECESSOR_INVALID" in overlay.validate_control(
        root, _bundle(root), NOW)


def test_r2_rejects_forged_instruction_commit_even_if_binding_matches(tmp_path):
    root = _fixture(tmp_path)
    wi = root / overlay.WI
    wi.write_bytes(wi.read_bytes() + b"\n")
    subprocess.run(["git", "add", "--", overlay.WI], cwd=root, check=True)
    subprocess.run(["git", "-c", "user.name=Anvil Test", "-c",
                    "user.email=test@example.invalid", "commit", "-qm", "forged instruction"],
                   cwd=root, check=True)
    base = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", base],
                   cwd=root, check=True)
    old_raw = (root / overlay.EVENTS).read_bytes()
    old_rows = json.loads(old_raw)["events"]
    old_progress = json.loads((root / overlay.PROGRESS).read_bytes())
    wi_sha = overlay.r1._sha(overlay.r1._lf(wi.read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((root / overlay.INVOCATION).read_bytes()))
    additions = overlay._make_rows(old_rows, wi_sha, invocation_sha, base, NOW, "r2test")
    outputs = overlay._projection(old_progress, old_raw, old_rows, additions, base,
                                  wi_sha, invocation_sha, (root / overlay.REPORT).read_bytes())
    for path, content in outputs.items():
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    assert "F20_U01_R2_PREDECESSOR_INVALID" in overlay.validate_control(
        root, _bundle(root), NOW)
