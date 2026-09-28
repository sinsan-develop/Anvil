"""R5e records the C30 raw-Event incident without rewriting history."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from unittest import mock

from scripts import f20_rework_overlay as r1


ROOT = Path(__file__).resolve().parents[2]
PREDECESSOR = "0a0d50b866d627b2169b0a7f2df1b70ac2885c1b"
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
    from scripts.f20_rework_r5e_overlay import EVENTS, PROGRESS

    return {"_root": root, "events": json.loads((root / EVENTS).read_bytes()),
            "progress": json.loads((root / PROGRESS).read_bytes())}


def test_r5e_appends_blocking_incident_and_preserves_raw_prefix(tmp_path):
    from scripts.f20_rework_r5e_overlay import (
        DEFECT, END, EVENTS, INCIDENT_ID, MANIFEST, PROGRESS, SCOPE, _append_raw,
        materialize, validate_control,
    )

    root = _fixture(tmp_path)
    old_raw = (root / EVENTS).read_bytes()
    materialize(root, PREDECESSOR, NOW, "r5etest")
    bundle = _bundle(root)
    rows = bundle["events"]["events"]
    assert bundle["events"]["last_sequence"] == END
    assert [row["event_type"] for row in rows[1761:]] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "DEFECT_RECORDED",
        "WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED",
        "PACKAGE_RESUMED",
    ]
    assert rows[1763]["details"] == DEFECT
    assert rows[1763]["event_id"] == INCIDENT_ID
    assert DEFECT["severity"] == "CRITICAL" and DEFECT["blocking"] is True
    assert bundle["progress"]["f20_c30_event_integrity_incident"]["event_id"] == INCIDENT_ID
    assert bundle["progress"]["write_lease"]["path_scope"] == SCOPE
    assert bundle["progress"]["f20_overall_status"] == "REWORK_IN_PROGRESS"
    assert bundle["progress"]["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in bundle["progress"]["completed_packages"]
    assert json.loads((root / MANIFEST).read_bytes())["accepted"] is False
    assert (root / EVENTS).read_bytes() == _append_raw(old_raw, rows[1761:])
    assert validate_control(root, bundle, NOW) == []


def test_r5e_rejects_forged_incident_and_acceptance(tmp_path):
    from scripts.f20_rework_r5e_overlay import (
        DIGEST, EVENTS, MANIFEST, PROGRESS, materialize, validate_control,
    )

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r5etest")
    assert validate_control(root, _bundle(root), NOW) == []
    original_event = (root / EVENTS).read_bytes()
    stream = json.loads(original_event)
    stream["events"][1763]["details"]["blocking"] = False
    (root / EVENTS).write_bytes(r1._pretty(stream))
    assert validate_control(root, _bundle(root), NOW)
    (root / EVENTS).write_bytes(original_event)

    original_progress = json.loads((root / PROGRESS).read_bytes())
    original_digest = json.loads((root / DIGEST).read_bytes())
    for forged in ("RESOLVED", "NOT_BLOCKING"):
        progress = deepcopy(original_progress)
        progress["f20_c30_event_integrity_incident"]["status"] = forged
        progress["snapshot_hash"] = r1._sha(r1._canonical(
            {key: value for key, value in progress.items() if key != "snapshot_hash"}))
        raw = r1._pretty(progress)
        (root / PROGRESS).write_bytes(raw)
        digest = deepcopy(original_digest)
        digest["progress"]["bytes"] = len(raw)
        digest["progress"]["file_sha256"] = r1._sha(raw)
        (root / DIGEST).write_bytes(r1._pretty(digest))
        assert "F20_R5E_PROGRESS_INVALID" in validate_control(root, _bundle(root), NOW)
    (root / PROGRESS).write_bytes(r1._pretty(original_progress))
    (root / DIGEST).write_bytes(r1._pretty(original_digest))

    manifest = (root / MANIFEST).read_bytes()
    forged_manifest = json.loads(manifest)
    forged_manifest["accepted"] = True
    (root / MANIFEST).write_bytes(r1._pretty(forged_manifest))
    assert "F20_R5E_MANIFEST_INVALID" in validate_control(root, _bundle(root), NOW)


def test_r5e_public_route_rejects_missing_incident(tmp_path):
    from scripts.f20_rework_r5e_overlay import EVENTS, materialize
    from scripts.check_project_progress import load_bundle, validate_bundle

    root = _fixture(tmp_path)
    materialize(root, PREDECESSOR, NOW, "r5etest")
    bundle = load_bundle(root)
    assert validate_bundle(bundle) == []
    original = (root / EVENTS).read_bytes()
    forged = json.loads(original)
    forged["events"][1763]["event_type"] = "PRODUCT_VALIDATION_RECORDED"
    (root / EVENTS).write_bytes(r1._pretty(forged))
    assert validate_bundle(load_bundle(root))


def test_r5e_rejects_missing_or_forged_historical_sources_and_current_bytes(tmp_path):
    from scripts import check_project_progress as checker
    from scripts import f20_rework_r5e_overlay as r5e

    root = _fixture(tmp_path)
    raw = (root / r5e.EVENTS).read_bytes()
    assert r5e._incident_source(root, raw)
    changed_raw = raw.replace(b'"event_id":', b'"event_id" :', 1)
    assert changed_raw != raw
    assert not r5e._incident_source(root, changed_raw)

    with mock.patch.object(checker, "c30_canonical_projection_from_root",
                           return_value={r5e.EVENTS: raw}):
        assert not r5e._incident_source(root, raw)
    with mock.patch.object(checker, "c30_canonical_projection_from_root",
                           side_effect=subprocess.CalledProcessError(128, "git show")):
        assert not r5e._incident_source(root, raw)

    original_git = r5e._git
    cause_path = f"{r5e.DEFECT['cause_commit']}:{r5e.EVENTS}"
    parent_path = f"{r5e.DEFECT['cause_parent_commit']}:{r5e.EVENTS}"

    def missing_cause(path, *args):
        if args == ("show", cause_path):
            raise subprocess.CalledProcessError(128, "git show")
        return original_git(path, *args)

    with mock.patch.object(r5e, "_git", side_effect=missing_cause):
        assert not r5e._incident_source(root, raw)

    def forged_cause(path, *args):
        content = original_git(path, *args)
        if args == ("show", cause_path):
            return content.replace(b'"event_id":', b'"event_id" :', 1)
        return content

    with mock.patch.object(r5e, "_git", side_effect=forged_cause):
        assert not r5e._incident_source(root, raw)

    def forged_parent(path, *args):
        content = original_git(path, *args)
        if args == ("show", parent_path):
            parent = json.loads(content)
            parent["events"][0]["details"]["forged"] = True
            return r1._pretty(parent)
        return content

    with mock.patch.object(r5e, "_git", side_effect=forged_parent):
        assert not r5e._incident_source(root, raw)
