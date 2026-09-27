"""F-20 R5c append-only handoff must restrict the current-contract writer."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from unittest import mock

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
PREDECESSOR = "9c41643420e8d833660781a2571cd67a750eaa02"
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def _fixture(tmp_path: Path) -> Path:
    root = tmp_path / "repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", str(ROOT), str(root)], check=True)
    subprocess.run(["git", "checkout", "--quiet", "-B", "codex/f18-wsl-ops", PREDECESSOR],
                   cwd=root, check=True)
    instructions = ("docs/work_orders/F-20_REWORK_R5C_WORK_INSTRUCTION.md",
                    "docs/work_orders/F-20_REWORK_R5C_INVOCATION.md")
    for relative in instructions:
        target = root / relative
        target.write_bytes((ROOT / relative).read_bytes())
    subprocess.run(["git", "add", "--", *instructions], cwd=root, check=True)
    subprocess.run(["git", "-c", "user.name=Anvil Fixture", "-c", "user.email=fixture@example.invalid",
                    "commit", "--quiet", "-m", "R5c instruction dispatch fixture"], cwd=root, check=True)
    dispatch = _dispatch(root)
    subprocess.run(["git", "remote", "add", "development", str(ROOT)], cwd=root, check=True)
    subprocess.run(["git", "fetch", "--quiet", "development", "codex/f18-wsl-ops"], cwd=root, check=True)
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", dispatch],
                   cwd=root, check=True)
    subprocess.run(["git", "branch", "--set-upstream-to=development/codex/f18-wsl-ops"],
                   cwd=root, check=True, capture_output=True)
    return root


def _dispatch(root: Path) -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip()


def _bundle(root: Path) -> dict:
    from scripts.f20_rework_r5c_overlay import EVENTS, PROGRESS

    return {"_root": root, "events": json.loads((root / EVENTS).read_bytes()),
            "progress": json.loads((root / PROGRESS).read_bytes())}


def test_r5c_revokes_r5b_before_exact2_grant_and_preserves_prefix(tmp_path):
    from scripts.f20_rework_r5c_overlay import (
        INVOCATION, SCOPE, WI, _append_raw, materialize, validate_control, validate_transition,
    )

    root = _fixture(tmp_path)
    old_raw = (root / "docs/progress/progress-events.json").read_bytes()
    try:
        _append_raw(old_raw.replace(b"\n", b"\r\n"), [])
    except ValueError as exc:
        assert "F20_R5C_EVENT_BYTES_INVALID" in str(exc)
    else:
        raise AssertionError("CRLF Event history was normalized")
    dispatch = _dispatch(root)
    prior = subprocess.check_output(["git", "rev-parse", f"{dispatch}^"], cwd=root).decode().strip()
    upstream = "refs/remotes/development/codex/f18-wsl-ops"
    subprocess.run(["git", "update-ref", upstream, prior], cwd=root, check=True)
    try:
        try:
            materialize(root, dispatch, NOW, "r5ctest")
        except RuntimeError as exc:
            assert "PREDECESSOR_INVALID" in str(exc)
        else:
            raise AssertionError("remote SHA drift was accepted")
    finally:
        subprocess.run(["git", "update-ref", upstream, dispatch], cwd=root, check=True)
    materialize(root, dispatch, NOW, "r5ctest")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    assert rows[:1749] == json.loads(old_raw)["events"]
    assert [row["event_type"] for row in rows[1749:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert bundle["progress"]["write_lease"]["path_scope"] == SCOPE
    assert "F-20" not in bundle["progress"]["completed_packages"]
    assert validate_control(root, bundle, NOW) == []
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    for field, forged in (("lease_epoch", 6), ("execution_fencing_token", "invalid"),
                          ("path_scope", ["tests/forged.py"])):
        changed = deepcopy(rows)
        changed[1752]["details"][field] = forged
        assert validate_transition(changed, wi_sha, invocation_sha, NOW), field
    raw = (root / "docs/progress/progress-events.json").read_bytes()
    old_event_bytes = old_raw.split(b'"events": [', 1)[1].split(
        b'\n  ],\n  "last_event_id"', 1)[0]
    assert old_event_bytes in raw


def test_r5c_still_refuses_forged_current_progress(tmp_path):
    from scripts.f20_rework_r5c_overlay import materialize
    from scripts.check_project_progress import validate_bundle, load_bundle

    root = _fixture(tmp_path)
    materialize(root, _dispatch(root), NOW, "r5ctest")
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
    assert "F20_R5C_PROGRESS_INVALID" in validate_bundle(bundle)
    bundle["progress"]["repository"]["commit_status"] = old_commit_status
    bundle["progress"]["next_safe_action"] = "FORGED"
    bundle["progress"]["snapshot_hash"] = r1._sha(r1._canonical(
        {key: value for key, value in bundle["progress"].items() if key != "snapshot_hash"}))
    assert validate_bundle(bundle)


def test_r5c_rejects_tampered_predecessor_and_current_artifacts(tmp_path):
    from scripts import f20_rework_r5b_overlay as r5b
    from scripts import f20_rework_r5c_overlay as r5c
    from scripts.f20_rework_r5c_overlay import (
        DIGEST, EVENTS, HANDOFF, MANIFEST, REPORT, WI, materialize, validate_control,
    )

    root = _fixture(tmp_path)
    report = root / REPORT
    report_raw = report.read_bytes()
    report.write_bytes(report_raw + b"\nforged\n")
    try:
        try:
            materialize(root, _dispatch(root), NOW, "r5ctest")
        except RuntimeError as exc:
            assert "PREDECESSOR_INVALID" in str(exc)
        else:
            raise AssertionError("forged R5a report was accepted")
    finally:
        report.write_bytes(report_raw)

    materialize(root, _dispatch(root), NOW, "r5ctest")
    for relative in (r5b.r5a.WI, r5b.r5a.INVOCATION, r5b.r5a.DIGEST,
                     r5b.r5a.MANIFEST, r5b.r5a.REPORT, r5b.WI,
                     r5b.INVOCATION, r5b.DIGEST, r5b.MANIFEST, r5b.REPORT,
                     DIGEST, HANDOFF, MANIFEST, EVENTS, WI, REPORT):
        path = root / relative
        original = path.read_bytes()
        forged = (original.replace(b'"last_sequence": 1755', b'"last_sequence": 1754', 1)
                  if relative == EVENTS else original + b"\nforged\n")
        path.write_bytes(forged)
        try:
            errors = validate_control(root, _bundle(root), NOW)
            assert errors, relative
            if relative in (r5b.r5a.WI, r5b.r5a.INVOCATION, r5b.r5a.DIGEST,
                            r5b.r5a.MANIFEST, r5b.r5a.REPORT, r5b.WI,
                            r5b.INVOCATION, r5b.DIGEST, r5b.MANIFEST, r5b.REPORT):
                assert "F20_R5C_PREDECESSOR_INVALID" in errors, relative
        finally:
            path.write_bytes(original)
    base = _dispatch(root)
    original_git = r5c._git
    for relative in (WI, r5c.INVOCATION):
        def forged_git(path, *args):
            return b"forged Git instruction" if args == ("show", f"{base}:{relative}") else original_git(path, *args)
        with mock.patch.object(r5c, "_git", side_effect=forged_git):
            assert "F20_R5C_PREDECESSOR_INVALID" in validate_control(root, _bundle(root), NOW)


def test_r5c_rejects_rehashed_inherited_progress_mutation(tmp_path):
    from scripts.f20_rework_r5c_overlay import DIGEST, PROGRESS, materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, _dispatch(root), NOW, "r5ctest")
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
    assert "F20_R5C_PROGRESS_INVALID" in validate_control(root, _bundle(root), NOW)


def test_r5c_rejects_rehashed_current_status_fields(tmp_path):
    from scripts.f20_rework_r5c_overlay import DIGEST, PROGRESS, materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, _dispatch(root), NOW, "r5ctest")
    original = json.loads((root / PROGRESS).read_bytes())
    original_digest = json.loads((root / DIGEST).read_bytes())
    for field, forged in (
        ("f20_overall_status", "PENDING"),
        ("repository.local_head", "0" * 40),
        ("repository.remote_head", "0" * 40),
        ("repository.commit_status", "VERIFIED"),
        ("repository.push_status", "VERIFIED"),
        ("repository.worktree_status", "FORGED"),
    ):
        progress = deepcopy(original)
        if field.startswith("repository."):
            progress["repository"][field.split(".", 1)[1]] = forged
        else:
            progress[field] = forged
        progress["snapshot_hash"] = r1._sha(r1._canonical(
            {key: value for key, value in progress.items() if key != "snapshot_hash"}))
        progress_raw = r1._pretty(progress)
        (root / PROGRESS).write_bytes(progress_raw)
        digest = deepcopy(original_digest)
        digest["progress"]["bytes"] = len(progress_raw)
        digest["progress"]["file_sha256"] = r1._sha(progress_raw)
        (root / DIGEST).write_bytes(r1._pretty(digest))
        assert "F20_R5C_PROGRESS_INVALID" in validate_control(root, _bundle(root), NOW), field
