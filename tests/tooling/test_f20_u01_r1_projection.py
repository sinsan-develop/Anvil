"""F-20/U-01 R1 grants one exact-path writer without weakening the C30 hold."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import pytest

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
PREDECESSOR = "a74a1a50dcec64705bb2bed3f8ed3d4a44f79a8d"
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
    return root


def _bundle(root: Path) -> dict:
    from scripts.f20_u01_r1_overlay import EVENTS, PROGRESS
    return {"_root": root, "events": json.loads((root / EVENTS).read_bytes()),
            "progress": json.loads((root / PROGRESS).read_bytes())}


def test_u01_r1_revokes_r5e_and_grants_exact3_without_rewriting_events(tmp_path):
    from scripts.f20_u01_r1_overlay import (
        END, EVENTS, INCIDENT_ID, MANIFEST, SCOPE, _append_raw, materialize,
        validate_control, collect_git,
    )

    root = _fixture(tmp_path)
    old_raw = (root / EVENTS).read_bytes()
    materialize(root, PREDECESSOR, NOW, "u01r1test")
    bundle = _bundle(root)
    progress = bundle["progress"]
    rows = bundle["events"]["events"]
    assert bundle["events"]["last_sequence"] == END == 1774
    assert [row["event_type"] for row in rows[1768:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]
    assert (root / EVENTS).read_bytes() == _append_raw(old_raw, rows[1768:])
    assert progress["worker_lease"]["lease_epoch"] == 10
    assert progress["write_lease"]["path_scope"] == SCOPE
    assert progress["completed_f20_r5e_write_lease"]["status"] == "REVOKED"
    assert progress["f20_c30_event_integrity_incident"]["event_id"] == INCIDENT_ID
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in progress["completed_packages"]
    assert json.loads((root / MANIFEST).read_bytes())["accepted"] is False
    assert validate_control(root, bundle, NOW) == []
    assert collect_git(root, progress) == []


def test_u01_r1_rejects_forged_scope_incident_and_acceptance(tmp_path):
    from scripts.f20_u01_r1_overlay import (
        DIGEST, EVENTS, MANIFEST, PROGRESS, SCOPE, materialize, validate_control,
    )

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "u01r1test")
    original_raw = (root / EVENTS).read_bytes()
    forged = json.loads(original_raw)
    forged["events"][1772]["details"]["path_scope"] = ["apps/web/src/console/App.tsx", "packages/api/runtime.py"]
    (root / EVENTS).write_bytes(r1._pretty(forged))
    assert validate_control(root, _bundle(root), NOW)
    (root / EVENTS).write_bytes(original_raw)

    original_progress = json.loads((root / PROGRESS).read_bytes())
    original_digest = json.loads((root / DIGEST).read_bytes())
    for key, value in (("f20_c30_event_integrity_incident", {"status": "RESOLVED"}),
                       ("completed_packages", original_progress["completed_packages"] + ["F-20"])):
        progress = deepcopy(original_progress)
        progress[key] = value
        progress["snapshot_hash"] = r1._sha(r1._canonical(
            {name: item for name, item in progress.items() if name != "snapshot_hash"}))
        raw = r1._pretty(progress)
        (root / PROGRESS).write_bytes(raw)
        digest = deepcopy(original_digest)
        digest["progress"]["bytes"] = len(raw)
        digest["progress"]["file_sha256"] = r1._sha(raw)
        (root / DIGEST).write_bytes(r1._pretty(digest))
        assert validate_control(root, _bundle(root), NOW)
    (root / PROGRESS).write_bytes(r1._pretty(original_progress))
    (root / DIGEST).write_bytes(r1._pretty(original_digest))
    manifest = json.loads((root / MANIFEST).read_bytes())
    manifest["accepted"] = True
    (root / MANIFEST).write_bytes(r1._pretty(manifest))
    assert validate_control(root, _bundle(root), NOW)
    assert SCOPE == [
        "apps/web/src/console/App.tsx", "apps/web/tests/f15-console.test.mjs",
        "docs/04_test_reports/F-20_U01_R1_READINESS_RESULT.md",
    ]


def test_u01_r1_current_public_checker_accepts_only_valid_transition(tmp_path):
    from scripts.f20_u01_r1_overlay import EVENTS, materialize
    from scripts.check_project_progress import load_bundle, validate_bundle

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "u01r1test")
    assert validate_bundle(load_bundle(root)) == []
    raw = (root / EVENTS).read_bytes()
    forged = json.loads(raw)
    forged["events"][1768]["event_type"] = "PACKAGE_ACCEPTED"
    (root / EVENTS).write_bytes(r1._pretty(forged))
    assert validate_bundle(load_bundle(root))


def test_u01_r1_rejects_mutated_predecessor_digest_and_incident_manifest(tmp_path):
    from scripts import f20_rework_r5e_overlay as r5e
    from scripts.f20_u01_r1_overlay import materialize, validate_control

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "u01r1test")
    assert validate_control(root, _bundle(root), NOW) == []
    for path, mutate in (
        (r5e.DIGEST, lambda value: value["progress"].update({"file_sha256": "0" * 64})),
        (r5e.MANIFEST, lambda value: value.update({"accepted": True, "incident_blocking": False})),
    ):
        target = root / path
        original = target.read_bytes()
        changed = json.loads(original)
        mutate(changed)
        target.write_bytes(r1._pretty(changed))
        assert validate_control(root, _bundle(root), NOW), path
        target.write_bytes(original)


def test_u01_r1_rejects_backdated_handoff_before_r5e_lease(tmp_path):
    from scripts.f20_u01_r1_overlay import PROGRESS, materialize

    root = _fixture(tmp_path)
    progress = json.loads((root / PROGRESS).read_bytes())
    prior_issued = datetime.fromisoformat(progress["worker_lease"]["issued_at"])
    backdated = prior_issued - timedelta(minutes=1)
    with pytest.raises(RuntimeError, match="F20_U01_R1_TRANSITION_INVALID"):
        materialize(root, PREDECESSOR, backdated, "u01r1test")


def test_u01_r1_can_revoke_expired_r5e_lease_without_backdating(tmp_path):
    from scripts.f20_u01_r1_overlay import PROGRESS, materialize, validate_control

    root = _fixture(tmp_path)
    progress = json.loads((root / PROGRESS).read_bytes())
    prior_expires = datetime.fromisoformat(progress["worker_lease"]["expires_at"])
    after_expiry = prior_expires + timedelta(minutes=1)
    materialize(root, PREDECESSOR, after_expiry, "u01r1test")
    assert validate_control(root, _bundle(root), after_expiry) == []


def test_u01_r1_preflight_rejects_predecessor_byte_edits_before_event_write(tmp_path):
    from scripts import f20_rework_r5e_overlay as r5e
    from scripts.f20_u01_r1_overlay import EVENTS, PROGRESS, materialize

    root = _fixture(tmp_path)
    before_events = (root / EVENTS).read_bytes()
    before_progress = (root / PROGRESS).read_bytes()
    for path in (r5e.DIGEST, r5e.MANIFEST):
        target = root / path
        original = target.read_bytes()
        target.write_bytes(original + b" ")
        with pytest.raises(RuntimeError, match="F20_U01_R1_PREDECESSOR_INVALID"):
            materialize(root, PREDECESSOR, NOW, "u01r1test")
        assert (root / EVENTS).read_bytes() == before_events
        assert (root / PROGRESS).read_bytes() == before_progress
        target.write_bytes(original)
