"""F-20 R5b append-only handoff must restrict the current-contract writer."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
PREDECESSOR = "ebc8e3459a9992298e3b29b96e46e32ddb1fd5ab"
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def _fixture(tmp_path: Path) -> Path:
    root = tmp_path / "repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", str(ROOT), str(root)], check=True)
    subprocess.run(["git", "checkout", "--quiet", "-B", "codex/f18-wsl-ops", PREDECESSOR],
                   cwd=root, check=True)
    subprocess.run(["git", "remote", "add", "development", str(ROOT)], cwd=root, check=True)
    subprocess.run(["git", "fetch", "--quiet", "development", "codex/f18-wsl-ops"], cwd=root, check=True)
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", PREDECESSOR],
                   cwd=root, check=True)
    subprocess.run(["git", "branch", "--set-upstream-to=development/codex/f18-wsl-ops"],
                   cwd=root, check=True, capture_output=True)
    for relative in ("docs/work_orders/F-20_REWORK_R5B_WORK_INSTRUCTION.md",
                     "docs/work_orders/F-20_REWORK_R5B_INVOCATION.md"):
        target = root / relative
        target.write_bytes((ROOT / relative).read_bytes())
    return root


def _bundle(root: Path) -> dict:
    from scripts.f20_rework_r5b_overlay import EVENTS, PROGRESS

    return {"_root": root, "events": json.loads((root / EVENTS).read_bytes()),
            "progress": json.loads((root / PROGRESS).read_bytes())}


def test_r5b_revokes_r5a_before_exact2_grant_and_preserves_prefix(tmp_path):
    from scripts.f20_rework_r5b_overlay import (
        INVOCATION, SCOPE, WI, materialize, validate_control, validate_transition,
    )

    root = _fixture(tmp_path)
    old_raw = (root / "docs/progress/progress-events.json").read_bytes()
    prior = subprocess.check_output(["git", "rev-parse", f"{PREDECESSOR}^"], cwd=root).decode().strip()
    upstream = "refs/remotes/development/codex/f18-wsl-ops"
    subprocess.run(["git", "update-ref", upstream, prior], cwd=root, check=True)
    try:
        try:
            materialize(root, PREDECESSOR, NOW, "r5btest")
        except RuntimeError as exc:
            assert "PREDECESSOR_INVALID" in str(exc)
        else:
            raise AssertionError("remote SHA drift was accepted")
    finally:
        subprocess.run(["git", "update-ref", upstream, PREDECESSOR], cwd=root, check=True)
    materialize(root, PREDECESSOR, NOW, "r5btest")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    assert rows[:1743] == json.loads(old_raw)["events"]
    assert [row["event_type"] for row in rows[1743:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert bundle["progress"]["write_lease"]["path_scope"] == SCOPE
    assert "F-20" not in bundle["progress"]["completed_packages"]
    assert validate_control(root, bundle, NOW) == []
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    for field, forged in (("lease_epoch", 5), ("execution_fencing_token", "invalid"),
                          ("path_scope", ["tests/forged.py"])):
        changed = deepcopy(rows)
        changed[1746]["details"][field] = forged
        assert validate_transition(changed, wi_sha, invocation_sha, NOW), field
    raw = (root / "docs/progress/progress-events.json").read_bytes()
    old_event_bytes = old_raw.split(b'"events": [', 1)[1].split(
        b'\n  ],\n  "last_event_id"', 1)[0]
    assert old_event_bytes in raw


def test_r5b_still_refuses_forged_current_progress(tmp_path):
    from scripts.f20_rework_r5b_overlay import materialize
    from scripts.check_project_progress import validate_bundle, load_bundle

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r5btest")
    bundle = load_bundle(root)
    assert validate_bundle(bundle) == []
    old_digest = bundle["detached_digest"]["progress"]["file_sha256"]
    bundle["detached_digest"]["progress"]["file_sha256"] = "0" * 64
    assert validate_bundle(bundle)
    bundle["detached_digest"]["progress"]["file_sha256"] = old_digest
    old_commit_status = bundle["progress"]["repository"]["commit_status"]
    bundle["progress"]["repository"]["commit_status"] = "VERIFIED"
    bundle["progress"]["snapshot_hash"] = r1._sha(r1._canonical(
        {key: value for key, value in bundle["progress"].items() if key != "snapshot_hash"}))
    assert "F20_R5B_PROGRESS_INVALID" in validate_bundle(bundle)
    bundle["progress"]["repository"]["commit_status"] = old_commit_status
    bundle["progress"]["next_safe_action"] = "FORGED"
    bundle["progress"]["snapshot_hash"] = r1._sha(r1._canonical(
        {key: value for key, value in bundle["progress"].items() if key != "snapshot_hash"}))
    assert validate_bundle(bundle)


def test_r5b_rejects_tampered_predecessor_and_current_artifacts(tmp_path):
    from scripts import f20_rework_r5a_overlay as r5a
    from scripts.f20_rework_r5b_overlay import (
        DIGEST, EVENTS, HANDOFF, MANIFEST, REPORT, WI, materialize, validate_control,
    )

    root = _fixture(tmp_path)
    report = root / REPORT
    report_raw = report.read_bytes()
    report.write_bytes(report_raw + b"\nforged\n")
    try:
        try:
            materialize(root, PREDECESSOR, NOW, "r5btest")
        except RuntimeError as exc:
            assert "PREDECESSOR_INVALID" in str(exc)
        else:
            raise AssertionError("forged R5a report was accepted")
    finally:
        report.write_bytes(report_raw)

    materialize(root, PREDECESSOR, NOW, "r5btest")
    for relative in (r5a.WI, r5a.INVOCATION, r5a.DIGEST, r5a.MANIFEST,
                     DIGEST, HANDOFF, MANIFEST, EVENTS, WI, REPORT):
        path = root / relative
        original = path.read_bytes()
        forged = (original.replace(b'"last_sequence": 1749', b'"last_sequence": 1748', 1)
                  if relative == EVENTS else original + b"\nforged\n")
        path.write_bytes(forged)
        try:
            errors = validate_control(root, _bundle(root), NOW)
            assert errors, relative
            if relative in (r5a.WI, r5a.INVOCATION, r5a.DIGEST, r5a.MANIFEST):
                assert "F20_R5B_PREDECESSOR_INVALID" in errors, relative
        finally:
            path.write_bytes(original)


def test_r5b_rejects_rehashed_inherited_progress_mutation(tmp_path):
    from scripts.f20_rework_r5b_overlay import DIGEST, PROGRESS, materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r5btest")
    progress = json.loads((root / PROGRESS).read_bytes())
    assert "completed_f20_r4_worker_lease" in progress
    progress["completed_f20_r4_worker_lease"]["actor_id"] = "forged"
    progress["snapshot_hash"] = r1._sha(r1._canonical(
        {key: value for key, value in progress.items() if key != "snapshot_hash"}))
    progress_raw = r1._pretty(progress)
    (root / PROGRESS).write_bytes(progress_raw)
    digest = json.loads((root / DIGEST).read_bytes())
    digest["progress"]["bytes"] = len(progress_raw)
    digest["progress"]["file_sha256"] = r1._sha(progress_raw)
    (root / DIGEST).write_bytes(r1._pretty(digest))
    assert "F20_R5B_PROGRESS_INVALID" in validate_control(root, _bundle(root), NOW)
