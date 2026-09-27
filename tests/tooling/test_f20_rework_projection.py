"""The rejected F-20 acceptance may resume only through a bounded new lease."""

from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import shutil

import pytest


ROOT = Path(__file__).resolve().parents[2]
OLD_MANIFEST = "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json"
WI = "docs/work_orders/F-20_REWORK_R1_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_REWORK_R1_INVOCATION.md"
SCOPE = [
    "docs/04_test_reports/F-20_REWORK_R1_RESULT.md",
    "packages/agent_team/worktree_writes.py",
    "tests/agent_team/test_worktree_writes_e06.py",
]
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _sha(value):
    return hashlib.sha256(value).hexdigest().upper()


def _history():
    rows = json.loads((ROOT / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    assert len(rows) == 1714
    assert _sha(_canonical(rows)) == "AED3D00DF31948AED95781A21FCD52EAB10EFFD2247321EB6A6BBEA5CD92714F"
    return rows


def _transition():
    rows = _history()
    wi_sha = _sha((ROOT / WI).read_bytes())
    invocation_sha = _sha((ROOT / INVOCATION).read_bytes())
    worker = {
        "lease_id": "worker-lease-f20-r1-test", "actor_id": "developer-primary-f20-r1",
        "subject_ref": "F-20/R1", "status": "ACTIVE", "lease_epoch": 1,
        "fencing_token": "f20-r1-execution-test", "execution_fencing_token": "f20-r1-execution-test",
        "issued_at": (NOW - timedelta(hours=1)).isoformat(),
        "expires_at": (NOW + timedelta(hours=11)).isoformat(),
        "path_scope": SCOPE,
    }
    write = {
        **worker, "lease_id": "write-lease-f20-r1-test", "worker_lease_id": worker["lease_id"],
        "fencing_token": "f20-r1-write-test", "write_fencing_token": "f20-r1-write-test",
        "write_epoch": 1,
    }
    for event_type, details in [
        ("EVIDENCE_MANIFEST_INVALIDATED", {
            "manifest_ref": OLD_MANIFEST, "reason": "F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH",
            "invalidated_event_id": "evt_f20_1714_main_package_accepted", "invalidated_event_sequence": 1714,
            "historical_bytes_mutated": False,
        }),
        ("WORK_INSTRUCTION_ISSUED", {
            "path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
        }),
        ("WORKER_LEASE_ISSUED", worker),
        ("WRITE_LEASE_ISSUED", write),
        ("PACKAGE_RESUMED", {
            "resume_event_ref": "evt_f20_1715_evidence_manifest_invalidated",
            "worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
            "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
            "package_status": "REWORK_IN_PROGRESS", "accepted": False,
        }),
    ]:
        sequence = len(rows) + 1
        rows.append({
            "sequence": sequence, "event_id": f"evt_f20_{sequence}_{event_type.lower()}",
            "event_type": event_type, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
            "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
            "run_id": None, "step_id": "F-20_R1_REWORK_START", "subject_ref": "F-20/R1",
            "occurred_at": NOW.isoformat(),
            "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
            "previous_event_sha256": _sha(_canonical(rows[-1])), "details": details,
        })
    return rows, wi_sha, invocation_sha


def _validate(rows, wi_sha, invocation_sha):
    from scripts.f20_rework_overlay import validate_transition

    return validate_transition(rows, wi_sha, invocation_sha, NOW)


def test_f20_rework_transition_accepts_only_bounded_append():
    rows, wi_sha, invocation_sha = _transition()
    assert _validate(rows, wi_sha, invocation_sha) == []


def test_f20_rework_rejects_wrong_invalidation_target():
    rows, wi_sha, invocation_sha = _transition()
    rows[-5]["details"]["manifest_ref"] = "docs/evidence/manifests/OTHER.json"
    assert "F20_REWORK_TRANSITION_INVALID" in _validate(rows, wi_sha, invocation_sha)


def test_f20_rework_rejects_reused_fencing_token():
    rows, wi_sha, invocation_sha = _transition()
    rows[-2]["details"]["write_fencing_token"] = rows[-3]["details"]["execution_fencing_token"]
    rows[-2]["details"]["fencing_token"] = rows[-3]["details"]["execution_fencing_token"]
    assert "F20_REWORK_TRANSITION_INVALID" in _validate(rows, wi_sha, invocation_sha)


def test_f20_rework_rejects_forged_main_actor():
    rows, wi_sha, invocation_sha = _transition()
    rows[-5]["actor_id"] = "untrusted-agent"
    for index in range(1715, len(rows)):
        rows[index]["previous_event_sha256"] = _sha(_canonical(rows[index - 1]))
    assert "F20_REWORK_TRANSITION_INVALID" in _validate(rows, wi_sha, invocation_sha)


def test_f20_rework_rejects_historical_event_mutation():
    rows, wi_sha, invocation_sha = _transition()
    rows[1713] = copy.deepcopy(rows[1713])
    rows[1713]["details"]["decision"] = "REWORK"
    assert "F20_REWORK_HISTORY_MUTATED" in _validate(rows, wi_sha, invocation_sha)


def test_f20_rework_rejects_false_wsl_pass_projection():
    from scripts.f20_rework_overlay import validate_rework_progress

    rows, wi_sha, invocation_sha = _transition()
    progress = {
        "event_sequence": 1719, "status": "ACTIVE", "current_work_package": "F-20",
        "worker_lease": rows[-3]["details"], "write_lease": rows[-2]["details"],
        "active_work_instruction": {"path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
                                    "invocation_sha256": invocation_sha, "result_status": "REWORK_IN_PROGRESS"},
        "completed_packages": ["F-20"], "wsl_full_suite": "PASS",
        "repository": {"projection_mode": "F20_R1_REWORK_START"},
    }
    assert "F20_REWORK_FALSE_ACCEPTANCE" in validate_rework_progress(progress, rows, wi_sha, invocation_sha, NOW)


def test_f20_rework_materialization_preserves_history_and_never_claims_completion(tmp_path):
    from scripts.f20_rework_overlay import materialize

    paths = [
        "docs/progress/progress-events.json", "docs/progress/build-progress.json",
        "docs/progress/BUILD_HANDOFF.md", OLD_MANIFEST,
        "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md", WI, INVOCATION,
    ]
    for relative in paths:
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, destination)
    old_events = (tmp_path / paths[0]).read_bytes()
    old_report = (tmp_path / paths[4]).read_bytes()
    old_manifest = (tmp_path / OLD_MANIFEST).read_bytes()

    materialize(tmp_path, "a" * 40, NOW, "test")
    events_raw = (tmp_path / paths[0]).read_bytes()
    rows = json.loads(events_raw)["events"]
    progress = json.loads((tmp_path / paths[1]).read_bytes())
    assert rows[:1714] == json.loads(old_events)["events"]
    assert b"\r\n" not in events_raw
    marker = b'\n  ],\n  "last_event_id"'
    canonical_old = old_events.replace(b"\r\n", b"\n")
    assert canonical_old.count(marker) == 1
    old_prefix = canonical_old.split(marker, 1)[0].replace(b'"last_sequence": 1714', b'"last_sequence": 1719', 1)
    assert events_raw.split(marker, 1)[0].startswith(old_prefix)
    assert (tmp_path / paths[4]).read_bytes() == old_report
    assert (tmp_path / OLD_MANIFEST).read_bytes() == old_manifest
    assert progress["event_sequence"] == 1719
    assert "F-20" not in progress["completed_packages"]
    assert progress["write_lease"]["path_scope"] == SCOPE
    assert progress["active_work_instruction"]["result_status"] == "REWORK_IN_PROGRESS"
    assert progress["repository"]["projection_mode"] == "F20_R1_REWORK_START"
    new_manifest = json.loads((tmp_path / "docs/evidence/manifests/F-20_R1_REWORK_START_MANIFEST.json").read_bytes())
    old_manifest_row = next(row for row in new_manifest["raw_checksums"] if row["path"] == OLD_MANIFEST)
    assert old_manifest_row["sha256"] == _sha(old_manifest.replace(b"\r\n", b"\n"))
    assert _validate(rows, _sha((tmp_path / WI).read_bytes()), _sha((tmp_path / INVOCATION).read_bytes())) == []
    with pytest.raises(RuntimeError, match="F20_REWORK_PREDECESSOR_INVALID"):
        materialize(tmp_path, "a" * 40, NOW, "test")


def test_f20_rework_control_rejects_digest_or_historical_evidence_tampering(tmp_path):
    from scripts.f20_rework_overlay import DIGEST, materialize, validate_control

    paths = [
        "docs/progress/progress-events.json", "docs/progress/build-progress.json",
        "docs/progress/BUILD_HANDOFF.md", OLD_MANIFEST,
        "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md", WI, INVOCATION,
    ]
    for relative in paths:
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, destination)
    materialize(tmp_path, "a" * 40, NOW, "test")

    def bundle():
        return {
            "progress": json.loads((tmp_path / paths[1]).read_bytes()),
            "events": json.loads((tmp_path / paths[0]).read_bytes()),
        }

    assert validate_control(tmp_path, bundle(), NOW) == []
    digest = tmp_path / DIGEST
    original_digest = digest.read_bytes()
    digest.write_bytes(original_digest.replace(b'"file_sha256": "', b'"file_sha256": "0', 1))
    assert "F20_REWORK_DIGEST_INVALID" in validate_control(tmp_path, bundle(), NOW)
    digest.write_bytes(original_digest)
    forged_event = bundle()
    forged_event["events"]["events"][1714]["details"]["manifest_sha256"] = "0" * 64
    assert "F20_REWORK_INVALIDATION_EVIDENCE_MISMATCH" in validate_control(tmp_path, forged_event, NOW)
    report = tmp_path / paths[4]
    report.write_bytes(report.read_bytes() + b"tampered")
    assert "F20_REWORK_MANIFEST_INVALID" in validate_control(tmp_path, bundle(), NOW)


def test_g05_routes_f20_rework_to_the_new_validator(tmp_path):
    from scripts.check_project_progress import validate_bundle
    from scripts.f20_rework_overlay import materialize

    paths = [
        "docs/progress/progress-events.json", "docs/progress/build-progress.json",
        "docs/progress/BUILD_HANDOFF.md", OLD_MANIFEST,
        "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md", WI, INVOCATION,
    ]
    for relative in paths:
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, destination)
    materialize(tmp_path, "a" * 40, NOW, "test")
    bundle = {
        "_root": tmp_path,
        "progress": json.loads((tmp_path / paths[1]).read_bytes()),
        "events": json.loads((tmp_path / paths[0]).read_bytes()),
    }
    assert "F20_REWORK_GIT_INVALID" in validate_bundle(bundle)


def test_f20_rework_git_guard_rejects_foreign_mutation_or_wrong_branch():
    from scripts.f20_rework_overlay import validate_git_facts

    valid = {
        "branch": "codex/f18-wsl-ops", "upstream": "development/codex/f18-wsl-ops",
        "base": "a" * 40, "head": "a" * 40, "remote_head": "a" * 40,
        "base_ancestor_head": True, "base_ancestor_remote": True,
        "dirty": {"docs/progress/build-progress.json"}, "changed": set(),
    }
    assert validate_git_facts(**valid) == []
    assert "F20_REWORK_GIT_INVALID" in validate_git_facts(**{**valid, "branch": "main"})
    assert "F20_REWORK_GIT_INVALID" in validate_git_facts(**{**valid, "dirty": {"packages/agent_team/other.py"}})
