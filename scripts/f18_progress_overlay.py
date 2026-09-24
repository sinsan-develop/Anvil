"""F-18 local/WSL preflight start; production remains unverified."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import subprocess

BASE = "b6b3ff047b311cedabecdd745e8ef0cccac2f92e"
BRANCH = "codex/f18-local-wsl-preflight"
MODE = "F18_LOCAL_WSL_START_EXACT11_PRODUCT_EXACT5"
FINAL_MODE = "F18_LOCAL_WSL_CHECKPOINT_EXACT11_PRODUCT_EXACT5"
R2_MODE = "F18_LOCAL_WSL_R2_START_EXACT3"
R2_FINAL_MODE = "F18_LOCAL_WSL_R2_CHECKPOINT_EXACT3"
R3_MODE = "F18_LOCAL_WSL_R3_START_EXACT3"
R3_FINAL_MODE = "F18_LOCAL_WSL_R3_CHECKPOINT_EXACT3"
AT = "2026-09-24T19:20:00+09:00"
FINAL_AT = "2026-09-24T19:48:00+09:00"
EXPIRES = "2026-09-25T07:20:00+09:00"
ACTOR = "developer-primary-f18-local-r1"
WORKER = "worker-lease-f18-local-r1-20260924-001"
WRITE = "write-lease-f18-local-r1-20260924-001"
EXECUTION_TOKEN = "f18-local-execution-fence-epoch-1-b6b3ff047b311ced"
WRITE_TOKEN = "f18-local-write-fence-epoch-1-abecdd745e8ef0cc"
R2_AT = "2026-09-24T20:30:00+09:00"
R2_EXPIRES = "2026-09-25T08:30:00+09:00"
R2_ACTOR = "developer-primary-f18-local-r2"
R2_WORKER = "worker-lease-f18-local-r2-20260924-001"
R2_WRITE = "write-lease-f18-local-r2-20260924-001"
R2_EXECUTION_TOKEN = "f18-local-execution-fence-epoch-2-0889fe4137048494"
R2_WRITE_TOKEN = "f18-local-write-fence-epoch-2-0889fe4137048494"
R3_AT = "2026-09-24T21:00:00+09:00"
R3_EXPIRES = "2026-09-25T09:20:00+09:00"
R3_ACTOR = "developer-primary-f18-local-r3"
R3_WORKER = "worker-lease-f18-local-r3-20260924-001"
R3_WRITE = "write-lease-f18-local-r3-20260924-001"
R3_EXECUTION_TOKEN = "f18-local-execution-fence-epoch-3-21617d772cd4ba8f"
R3_WRITE_TOKEN = "f18-local-write-fence-epoch-3-21617d772cd4ba8f"
WI = "docs/work_orders/F-18_LOCAL_WSL_PREFLIGHT_PLAN.md"
PROMPT = "docs/work_orders/F-18_LOCAL_WSL_INVOCATION.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-local.json"
MANIFEST = "docs/evidence/manifests/F-18_LOCAL_START_MANIFEST.json"


def product_paths():
    return sorted([
        "packages/deployment/deploy_approval.py",
        "packages/deployment/promotion_preflight.py",
        "tests/deploy/test_f18_deploy_approval.py",
        "tests/deploy/test_f18_promotion_preflight.py",
        "docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md",
    ])


def r2_product_paths():
    return sorted([
        "packages/deployment/promotion_preflight.py",
        "tests/deploy/test_f18_promotion_preflight.py",
        "docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md",
    ])


def r3_product_paths():
    return sorted([
        "packages/deployment/production_preflight_cli.py",
        "tests/deploy/test_f18_production_preflight_cli.py",
        "docs/04_test_reports/F-18_LOCAL_WSL_PREFLIGHT_REPORT.md",
    ])


def r3_all_product_paths():
    return sorted(set(product_paths()) | set(r3_product_paths()))


def control_paths():
    return sorted([
        WI, PROMPT, "docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        DIGEST, MANIFEST, "scripts/f18_progress_overlay.py",
        "scripts/check_project_progress.py", "tests/tooling/test_f18_progress_overlay.py",
    ])


def validate_start_git_facts(*, branch, upstream, head, remote_head, staged,
                             dirty, changed, base_is_ancestor, allowed_product_paths=None,
                             allow_merged_main=False, parents=(),
                             first_parent_contains_base=False,
                             merge_tree_matches_feature=False,
                             feature_contains_checkpoint=False):
    scope = set(control_paths())
    allowed = set(product_paths() if allowed_product_paths is None else allowed_product_paths)
    common = (base_is_ancestor and not staged and remote_head == head
              and scope <= set(changed) <= scope | allowed)
    feature = (branch == BRANCH and upstream == f"development/{BRANCH}"
               and set(dirty) <= allowed)
    merged = (allow_merged_main and branch == "main" and upstream == "development/main"
              and not dirty and len(parents) == 2 and first_parent_contains_base
              and merge_tree_matches_feature and feature_contains_checkpoint)
    return [] if common and (feature or merged) else ["F18_LOCAL_START_GIT_INVALID"]


def validate_start_state(progress):
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    good = (progress.get("repository", {}).get("projection_mode") == MODE
            and progress.get("event_sequence") == 1495
            and progress.get("current_work_package") == "F-18"
            and progress.get("status") == "ACTIVE"
            and progress.get("f18_overall_status") == "IN_PROGRESS_LOCAL_WSL_ONLY"
            and progress.get("next_work_package") == {
                "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
            and worker.get("lease_id") == WORKER and worker.get("status") == "ACTIVE"
            and write.get("lease_id") == WRITE and write.get("status") == "ACTIVE"
            and write.get("worker_lease_id") == WORKER
            and write.get("path_scope") == product_paths())
    return [] if good else ["F18_LOCAL_START_STATE_INVALID"]


def validate_final_state(progress):
    good = (progress.get("repository", {}).get("projection_mode") == FINAL_MODE
            and progress.get("event_sequence") == 1498
            and progress.get("current_work_package") == "F-18"
            and progress.get("status") == "PAUSED"
            and progress.get("f18_overall_status") == "PARTIAL_LOCAL_WSL_VERIFIED"
            and progress.get("active_agent") is None
            and progress.get("worker_lease") is None
            and progress.get("write_lease") is None
            and progress.get("next_work_package") == {
                "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"})
    return [] if good else ["F18_LOCAL_CHECKPOINT_STATE_INVALID"]


def validate_r2_start_state(progress):
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    good = (progress.get("repository", {}).get("projection_mode") == R2_MODE
            and progress.get("event_sequence") == 1501
            and progress.get("current_work_package") == "F-18"
            and progress.get("status") == "ACTIVE"
            and progress.get("f18_overall_status") == "IN_PROGRESS_LOCAL_WSL_ONLY"
            and progress.get("next_work_package") == {
                "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
            and worker.get("lease_id") == R2_WORKER and worker.get("status") == "ACTIVE"
            and write.get("lease_id") == R2_WRITE and write.get("status") == "ACTIVE"
            and write.get("worker_lease_id") == R2_WORKER
            and write.get("path_scope") == r2_product_paths())
    return [] if good else ["F18_LOCAL_R2_START_STATE_INVALID"]


def validate_r2_final_state(progress):
    good = (progress.get("repository", {}).get("projection_mode") == R2_FINAL_MODE
            and progress.get("event_sequence") == 1504
            and progress.get("current_work_package") == "F-18"
            and progress.get("status") == "PAUSED"
            and progress.get("f18_overall_status") == "PARTIAL_LOCAL_WSL_VERIFIED"
            and progress.get("active_agent") is None
            and progress.get("worker_lease") is None
            and progress.get("write_lease") is None
            and progress.get("next_work_package") == {
                "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"})
    return [] if good else ["F18_LOCAL_R2_CHECKPOINT_STATE_INVALID"]


def validate_r3_start_state(progress):
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    good = (progress.get("repository", {}).get("projection_mode") == R3_MODE
            and progress.get("event_sequence") == 1507
            and progress.get("current_work_package") == "F-18"
            and progress.get("status") == "ACTIVE"
            and progress.get("f18_overall_status") == "IN_PROGRESS_LOCAL_WSL_ONLY"
            and progress.get("next_work_package") == {
                "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
            and worker.get("lease_id") == R3_WORKER and worker.get("status") == "ACTIVE"
            and write.get("lease_id") == R3_WRITE and write.get("status") == "ACTIVE"
            and write.get("worker_lease_id") == R3_WORKER
            and write.get("path_scope") == r3_product_paths())
    return [] if good else ["F18_LOCAL_R3_START_STATE_INVALID"]


def validate_r3_final_state(progress):
    good = (progress.get("repository", {}).get("projection_mode") == R3_FINAL_MODE
            and progress.get("event_sequence") == 1510
            and progress.get("current_work_package") == "F-18"
            and progress.get("status") == "PAUSED"
            and progress.get("f18_overall_status") == "PARTIAL_LOCAL_WSL_VERIFIED"
            and progress.get("active_agent") is None
            and progress.get("worker_lease") is None
            and progress.get("write_lease") is None
            and progress.get("next_work_package") == {
                "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"})
    return [] if good else ["F18_LOCAL_R3_CHECKPOINT_STATE_INVALID"]


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)
            + "\n").encode("utf-8")


def _sha(raw):
    return sha256(raw).hexdigest().upper()


def _event(events, kind, details, *, at=AT, step="LOCAL_WSL_START"):
    seq = events[-1]["sequence"] + 1
    row = {"sequence": seq, "event_id": f"evt_f18_local_{seq}_{kind.lower()}",
           "event_type": kind, "actor": "main-agent-eoul",
           "actor_id": "main-agent-eoul", "actor_type": "AGENT",
           "project_id": "anvil", "work_package_id": "F-18", "run_id": None,
           "step_id": step, "subject_ref": f"F-18/{step}",
           "occurred_at": at,
           "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
           "previous_event_sha256": _sha(_canonical(events[-1])), "details": details}
    events.append(row)
    return row


def _lease(kind):
    row = {"lease_id": WORKER if kind == "worker" else WRITE,
           "actor_id": ACTOR, "subject_ref": "F-18/LOCAL_WSL_PREFLIGHT",
           "status": "ACTIVE", "issued_at": AT, "expires_at": EXPIRES,
           "lease_epoch": 1,
           "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
           "execution_fencing_token": EXECUTION_TOKEN,
           "baseline_git_commit": BASE, "dispatch_head": BASE,
           "path_scope": product_paths()}
    if kind == "write":
        row.update({"worker_lease_id": WORKER, "write_epoch": 1,
                    "write_fencing_token": WRITE_TOKEN})
    return row


def _r2_lease(kind, dispatch_head):
    row = {"lease_id": R2_WORKER if kind == "worker" else R2_WRITE,
           "actor_id": R2_ACTOR, "subject_ref": "F-18/LOCAL_WSL_GIT_GUARD",
           "status": "ACTIVE", "issued_at": R2_AT, "expires_at": R2_EXPIRES,
           "lease_epoch": 2,
           "fencing_token": R2_EXECUTION_TOKEN if kind == "worker" else R2_WRITE_TOKEN,
           "execution_fencing_token": R2_EXECUTION_TOKEN,
           "baseline_git_commit": dispatch_head, "dispatch_head": dispatch_head,
           "path_scope": r2_product_paths()}
    if kind == "write":
        row.update({"worker_lease_id": R2_WORKER, "write_epoch": 2,
                    "write_fencing_token": R2_WRITE_TOKEN})
    return row


def _r3_lease(kind, dispatch_head):
    row = {"lease_id": R3_WORKER if kind == "worker" else R3_WRITE,
           "actor_id": R3_ACTOR, "subject_ref": "F-18/LOCAL_WSL_SIGNED_CLI",
           "status": "ACTIVE", "issued_at": R3_AT, "expires_at": R3_EXPIRES,
           "lease_epoch": 3,
           "fencing_token": R3_EXECUTION_TOKEN if kind == "worker" else R3_WRITE_TOKEN,
           "execution_fencing_token": R3_EXECUTION_TOKEN,
           "baseline_git_commit": dispatch_head, "dispatch_head": dispatch_head,
           "path_scope": r3_product_paths()}
    if kind == "write":
        row.update({"worker_lease_id": R3_WORKER, "write_epoch": 3,
                    "write_fencing_token": R3_WRITE_TOKEN})
    return row


def _append_events_raw(original, old_id, old_sequence, new_events):
    marker = b'\n  ],\n  "last_event_id": "' + old_id.encode() + b'"'
    if original.count(marker) != 1:
        raise RuntimeError("F18_LOCAL_EVENT_BYTES_INVALID")
    return original.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in new_events)
        + marker.replace(old_id.encode(), new_events[-1]["event_id"].encode())
    ).replace(f'"last_sequence": {old_sequence}'.encode(),
              f'"last_sequence": {old_sequence + len(new_events)}'.encode(), 1)


def _write_r2_projection(root, progress, event_raw, *, mode, sequence, handoff_title):
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = ((f"# {handoff_title}; Production NOT_EXECUTED\n\n"
                    "```json anvil-recovery-summary\n").encode("utf-8") +
                   _pretty({key: deepcopy(progress.get(key)) for key in (
                       "event_sequence", "last_event_id", "status", "current_phase",
                       "current_work_package", "active_agent", "worker_lease",
                       "write_lease", "next_work_package", "next_safe_action",
                       "runtime_next_action")}) + b"```\n\n"
                   b"- F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.\n"
                   b"- Branch retained until F-18 acceptance.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "algorithm": "SHA-256", "event_sequence": sequence, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json",
                     "bytes": len(progress_raw), "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md",
                    "bytes": len(handoff_raw), "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md",
            DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    product_scope = r3_all_product_paths() if mode in {R3_MODE, R3_FINAL_MODE} else product_paths()
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "package_id": "F-18", "event_sequence": sequence, "accepted": False,
        "projection_mode": mode, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": product_scope,
        "raw_checksums": checksums, "self_reference": False,
        "production": "NOT_EXECUTED"}))


def materialize_r2(root):
    """Issue exact-three writer lease from the published, clean F-18 checkpoint."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if validate_final_state(progress) or ledger.get("last_sequence") != 1498:
        raise RuntimeError("F18_LOCAL_R2_CHECKPOINT_REQUIRED")
    if collect_git(root):
        raise RuntimeError("F18_LOCAL_R2_PUBLISHED_CLEAN_GIT_REQUIRED")
    source_head = subprocess.check_output(["git", "rev-parse", "HEAD"],
                                          cwd=root, text=True).strip()
    events = ledger["events"]
    old_id = progress["last_event_id"]
    _event(events, "PACKAGE_RESUMED", {"package_id": "F-18", "task": "TASK_4_GIT_GUARD",
        "source_head": source_head, "production": "NOT_EXECUTED"},
        at=R2_AT, step="LOCAL_WSL_R2_START")
    _event(events, "WORKER_LEASE_ISSUED", {"lease_id": R2_WORKER,
        "actor_id": R2_ACTOR, "execution_fencing_token": R2_EXECUTION_TOKEN},
        at=R2_AT, step="LOCAL_WSL_R2_START")
    last = _event(events, "WRITE_LEASE_ISSUED", {"lease_id": R2_WRITE,
        "worker_lease_id": R2_WORKER, "write_fencing_token": R2_WRITE_TOKEN,
        "path_scope": r2_product_paths()}, at=R2_AT, step="LOCAL_WSL_R2_START")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1498, events[-3:])
    progress.update({"snapshot_id": "snapshot-f18-local-r2-start-seq1501",
        "event_sequence": 1501, "last_event_id": last["event_id"],
        "updated_at": R2_AT, "recorded_at": R2_AT,
        "status": "ACTIVE", "f18_overall_status": "IN_PROGRESS_LOCAL_WSL_ONLY",
        "active_agent": R2_ACTOR, "worker_lease": _r2_lease("worker", source_head),
        "write_lease": _r2_lease("write", source_head),
        "active_work_instruction": {"artifact_id": "WI-F-18-LOCAL-R2-20260924-001",
            "path": WI, "sha256": _sha((root / WI).read_bytes()),
            "invocation_path": PROMPT, "invocation_sha256": _sha((root / PROMPT).read_bytes()),
            "assigned_verification_ids": ["AV-OPS-013", "AV-OPS-016", "AV-OPS-020", "AV-OPS-021"],
            "verification_scope": "LOCAL_WSL_GIT_GUARD_ONLY"},
        "next_safe_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_GIT_GUARD_EXACT3",
        "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_GIT_GUARD_EXACT3",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F18_APPROVED_LOCAL_WSL_SCOPE"],
            "stop_before_dialogue_report": False}})
    progress["repository"].update({"projection_mode": R2_MODE,
        "local_head": source_head, "remote_head": source_head,
        "worktree_status": "F18_LOCAL_R2_ACTIVE", "commit_status": "PENDING",
        "push_status": "PENDING"})
    _write_r2_projection(root, progress, event_raw, mode=R2_MODE, sequence=1501,
                         handoff_title="F-18 local/WSL Task 4 Git guard start")


def finalize_r2(root):
    """Revoke Task 4 writer after published local/WSL verification; never accept F-18."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if validate_r2_start_state(progress) or ledger.get("last_sequence") != 1501:
        raise RuntimeError("F18_LOCAL_R2_START_REQUIRED")
    if collect_git(root):
        raise RuntimeError("F18_LOCAL_R2_PUBLISHED_CLEAN_GIT_REQUIRED")
    source_head = subprocess.check_output(["git", "rev-parse", "HEAD"],
                                          cwd=root, text=True).strip()
    at = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    events = ledger["events"]
    old_id = progress["last_event_id"]
    _event(events, "WRITE_LEASE_REVOKED", {"lease_id": R2_WRITE,
        "reason": "LOCAL_WSL_GIT_GUARD_VERIFIED"}, at=at, step="LOCAL_WSL_R2_CHECKPOINT")
    _event(events, "WORKER_LEASE_REVOKED", {"lease_id": R2_WORKER,
        "reason": "LOCAL_WSL_GIT_GUARD_VERIFIED"}, at=at, step="LOCAL_WSL_R2_CHECKPOINT")
    last = _event(events, "PACKAGE_PAUSED", {"accepted": False,
        "production": "NOT_EXECUTED", "f19": "BLOCKED_PENDING_F18_ACCEPTANCE",
        "published_source_head": source_head,
        "reason": "USER_SCOPE_LOCAL_AND_WSL_ONLY"},
        at=at, step="LOCAL_WSL_R2_CHECKPOINT")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1501, events[-3:])
    progress.update({"snapshot_id": "snapshot-f18-local-r2-checkpoint-seq1504",
        "event_sequence": 1504, "last_event_id": last["event_id"],
        "updated_at": at, "recorded_at": at,
        "status": "PAUSED", "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
        "active_agent": None, "worker_lease": None, "write_lease": None,
        "next_safe_action": "F18_PRODUCTION_OWNER_EVIDENCE_REQUIRED_OUTSIDE_MAIN_SCOPE",
        "runtime_next_action": "F18_PRODUCTION_OWNER_EVIDENCE_REQUIRED_OUTSIDE_MAIN_SCOPE",
        "reporting_decision": {"decision": "SCOPE_BOUNDARY_REPORT",
            "reason_codes": ["F18_PRODUCTION_TARGET_EXCLUDED_BY_USER"],
            "stop_before_dialogue_report": True}})
    progress["active_work_instruction"]["result_status"] = "PARTIAL_LOCAL_WSL_VERIFIED"
    progress["repository"].update({"projection_mode": R2_FINAL_MODE,
        "local_head": source_head, "remote_head": source_head,
        "worktree_status": "F18_PAUSED_SCOPE_BOUNDARY",
        "commit_status": "PUBLISHED_CHECKPOINT", "push_status": "PUBLISHED_CHECKPOINT"})
    _write_r2_projection(root, progress, event_raw, mode=R2_FINAL_MODE, sequence=1504,
                         handoff_title="F-18 local/WSL Task 4 Git guard checkpoint")


def materialize_r3(root):
    """Issue exact-three CLI writer lease from the published R2 checkpoint."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if validate_r2_final_state(progress) or ledger.get("last_sequence") != 1504:
        raise RuntimeError("F18_LOCAL_R3_CHECKPOINT_REQUIRED")
    if collect_git(root):
        raise RuntimeError("F18_LOCAL_R3_PUBLISHED_CLEAN_GIT_REQUIRED")
    source_head = subprocess.check_output(["git", "rev-parse", "HEAD"],
                                          cwd=root, text=True).strip()
    events = ledger["events"]
    old_id = progress["last_event_id"]
    _event(events, "PACKAGE_RESUMED", {"package_id": "F-18", "task": "TASK_5_SIGNED_CLI",
        "source_head": source_head, "production": "NOT_EXECUTED"},
        at=R3_AT, step="LOCAL_WSL_R3_START")
    _event(events, "WORKER_LEASE_ISSUED", {"lease_id": R3_WORKER,
        "actor_id": R3_ACTOR, "execution_fencing_token": R3_EXECUTION_TOKEN},
        at=R3_AT, step="LOCAL_WSL_R3_START")
    last = _event(events, "WRITE_LEASE_ISSUED", {"lease_id": R3_WRITE,
        "worker_lease_id": R3_WORKER, "write_fencing_token": R3_WRITE_TOKEN,
        "path_scope": r3_product_paths()}, at=R3_AT, step="LOCAL_WSL_R3_START")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1504, events[-3:])
    progress.update({"snapshot_id": "snapshot-f18-local-r3-start-seq1507",
        "event_sequence": 1507, "last_event_id": last["event_id"],
        "updated_at": R3_AT, "recorded_at": R3_AT,
        "status": "ACTIVE", "f18_overall_status": "IN_PROGRESS_LOCAL_WSL_ONLY",
        "active_agent": R3_ACTOR, "worker_lease": _r3_lease("worker", source_head),
        "write_lease": _r3_lease("write", source_head),
        "active_work_instruction": {"artifact_id": "WI-F-18-LOCAL-R3-20260924-001",
            "path": WI, "sha256": _sha((root / WI).read_bytes()),
            "invocation_path": PROMPT, "invocation_sha256": _sha((root / PROMPT).read_bytes()),
            "assigned_verification_ids": ["AV-OPS-013", "AV-OPS-016", "AV-OPS-020", "AV-OPS-021"],
            "verification_scope": "LOCAL_WSL_SIGNED_CLI_ONLY"},
        "next_safe_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_SIGNED_CLI_EXACT3",
        "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_SIGNED_CLI_EXACT3",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F18_APPROVED_LOCAL_WSL_SCOPE"],
            "stop_before_dialogue_report": False}})
    progress["repository"].update({"projection_mode": R3_MODE,
        "local_head": source_head, "remote_head": source_head,
        "product_write_scope": r3_all_product_paths(),
        "worktree_status": "F18_LOCAL_R3_ACTIVE", "commit_status": "PENDING",
        "push_status": "PENDING"})
    _write_r2_projection(root, progress, event_raw, mode=R3_MODE, sequence=1507,
                         handoff_title="F-18 local/WSL Task 5 signed CLI start")


def finalize_r3(root):
    """Revoke Task 5 writer after published local/WSL QA, not F-18 acceptance."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if validate_r3_start_state(progress) or ledger.get("last_sequence") != 1507:
        raise RuntimeError("F18_LOCAL_R3_START_REQUIRED")
    if collect_git(root):
        raise RuntimeError("F18_LOCAL_R3_PUBLISHED_CLEAN_GIT_REQUIRED")
    source_head = subprocess.check_output(["git", "rev-parse", "HEAD"],
                                          cwd=root, text=True).strip()
    at = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    events = ledger["events"]
    old_id = progress["last_event_id"]
    _event(events, "WRITE_LEASE_REVOKED", {"lease_id": R3_WRITE,
        "reason": "LOCAL_WSL_SIGNED_CLI_VERIFIED"}, at=at, step="LOCAL_WSL_R3_CHECKPOINT")
    _event(events, "WORKER_LEASE_REVOKED", {"lease_id": R3_WORKER,
        "reason": "LOCAL_WSL_SIGNED_CLI_VERIFIED"}, at=at, step="LOCAL_WSL_R3_CHECKPOINT")
    last = _event(events, "PACKAGE_PAUSED", {"accepted": False,
        "production": "NOT_EXECUTED", "f19": "BLOCKED_PENDING_F18_ACCEPTANCE",
        "published_source_head": source_head,
        "reason": "USER_SCOPE_LOCAL_AND_WSL_ONLY"},
        at=at, step="LOCAL_WSL_R3_CHECKPOINT")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1507, events[-3:])
    progress.update({"snapshot_id": "snapshot-f18-local-r3-checkpoint-seq1510",
        "event_sequence": 1510, "last_event_id": last["event_id"],
        "updated_at": at, "recorded_at": at,
        "status": "PAUSED", "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
        "active_agent": None, "worker_lease": None, "write_lease": None,
        "next_safe_action": "F18_PRODUCTION_OWNER_EVIDENCE_REQUIRED_OUTSIDE_MAIN_SCOPE",
        "runtime_next_action": "F18_PRODUCTION_OWNER_EVIDENCE_REQUIRED_OUTSIDE_MAIN_SCOPE",
        "reporting_decision": {"decision": "SCOPE_BOUNDARY_REPORT",
            "reason_codes": ["F18_PRODUCTION_TARGET_EXCLUDED_BY_USER"],
            "stop_before_dialogue_report": True}})
    progress["active_work_instruction"]["result_status"] = "PARTIAL_LOCAL_WSL_VERIFIED"
    progress["repository"].update({"projection_mode": R3_FINAL_MODE,
        "local_head": source_head, "remote_head": source_head,
        "worktree_status": "F18_PAUSED_SCOPE_BOUNDARY",
        "commit_status": "PUBLISHED_CHECKPOINT", "push_status": "PUBLISHED_CHECKPOINT"})
    _write_r2_projection(root, progress, event_raw, mode=R3_FINAL_MODE, sequence=1510,
                         handoff_title="F-18 local/WSL Task 5 signed CLI checkpoint")


def collect_git(root):
    root = Path(root)

    def run(*args):
        return subprocess.check_output(["git", "-c", "core.excludesFile=", *args],
                                       cwd=root, text=True).strip()

    branch, head = run("branch", "--show-current"), run("rev-parse", "HEAD")
    upstream = run("rev-parse", "--abbrev-ref", "@{upstream}")
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    mode = progress.get("repository", {}).get("projection_mode")
    allow_merged_main = mode == R3_FINAL_MODE
    remote_ref = "development/main" if branch == "main" and allow_merged_main else f"development/{BRANCH}"
    remote_head = run("rev-parse", remote_ref)
    staged = set(filter(None, run("diff", "--cached", "--name-only").splitlines()))
    changed = set(filter(None, run("diff", "--name-only", f"{BASE}..{head}").splitlines()))
    status = subprocess.check_output(["git", "-c", "core.excludesFile=", "status",
                                      "--porcelain=v1", "--untracked-files=all"],
                                     cwd=root, text=True)
    dirty = {row[3:].replace("\\", "/") for row in status.splitlines() if row}
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head],
                              cwd=root).returncode == 0
    parents = tuple(run("rev-list", "--parents", "-n", "1", "HEAD").split()[1:])
    first_parent_contains_base = (len(parents) == 2 and subprocess.run(
        ["git", "merge-base", "--is-ancestor", BASE, parents[0]], cwd=root
    ).returncode == 0)
    merge_tree_matches_feature = (len(parents) == 2 and run("rev-parse", "HEAD^{tree}")
                                  == run("rev-parse", f"{parents[1]}^{{tree}}"))
    checkpoint = progress.get("repository", {}).get("local_head")
    feature_contains_checkpoint = (len(parents) == 2 and isinstance(checkpoint, str)
        and re.fullmatch(r"[0-9a-f]{40}", checkpoint) is not None and subprocess.run(
            ["git", "merge-base", "--is-ancestor", checkpoint, parents[1]], cwd=root
        ).returncode == 0)
    allowed = r3_all_product_paths() if mode in {R3_MODE, R3_FINAL_MODE} else product_paths()
    return validate_start_git_facts(branch=branch, upstream=upstream, head=head,
        remote_head=remote_head, staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=ancestor, allowed_product_paths=allowed,
        allow_merged_main=allow_merged_main, parents=parents,
        first_parent_contains_base=first_parent_contains_base,
        merge_tree_matches_feature=merge_tree_matches_feature,
        feature_contains_checkpoint=feature_contains_checkpoint)


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    mode = progress.get("repository", {}).get("projection_mode")
    states = {MODE: (validate_start_state, 1495),
              FINAL_MODE: (validate_final_state, 1498),
              R2_MODE: (validate_r2_start_state, 1501),
              R2_FINAL_MODE: (validate_r2_final_state, 1504),
              R3_MODE: (validate_r3_start_state, 1507),
              R3_FINAL_MODE: (validate_r3_final_state, 1510)}
    if mode not in states:
        return ["F18_LOCAL_PROJECTION_MODE_INVALID"]
    validator, expected_sequence = states[mode]
    errors = validator(progress)
    if ledger.get("last_sequence") != expected_sequence or ledger["events"][-1]["event_id"] != progress.get("last_event_id"):
        errors.append("F18_LOCAL_EVENT_INVALID")
    for before, after in zip(ledger["events"][-4:], ledger["events"][-3:]):
        if after.get("previous_event_sha256") != _sha(_canonical(before)):
            errors.append("F18_LOCAL_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F18_LOCAL_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not False
            or manifest.get("event_sequence") != expected_sequence
            or manifest.get("projection_mode") != mode
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != (
                r3_all_product_paths() if mode in {R3_MODE, R3_FINAL_MODE} else product_paths())
            or manifest.get("production") != "NOT_EXECUTED"):
        errors.append("F18_LOCAL_MANIFEST_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (len(raw), _sha(raw)) != (row["bytes"], row["sha256"]):
            errors.append("F18_LOCAL_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def finalize(root):
    """Record a published local/WSL checkpoint; never accept F-18 Production."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if validate_start_state(progress) or ledger.get("last_sequence") != 1495:
        raise RuntimeError("F18_LOCAL_START_STATE_REQUIRED")
    if (root / MANIFEST).is_file() is False:
        raise RuntimeError("F18_LOCAL_START_MANIFEST_REQUIRED")
    if collect_git(root):
        raise RuntimeError("F18_LOCAL_PUBLISHED_CLEAN_GIT_REQUIRED")
    source_head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root,
                                          text=True).strip()
    events = ledger["events"]
    _event(events, "WRITE_LEASE_REVOKED", {"lease_id": WRITE,
        "reason": "LOCAL_WSL_SLICE_RECORDED"}, at=FINAL_AT,
        step="LOCAL_WSL_CHECKPOINT")
    _event(events, "WORKER_LEASE_REVOKED", {"lease_id": WORKER,
        "reason": "LOCAL_WSL_SLICE_RECORDED"}, at=FINAL_AT,
        step="LOCAL_WSL_CHECKPOINT")
    last = _event(events, "PACKAGE_PAUSED", {
        "accepted": False, "production": "NOT_EXECUTED",
        "f19": "BLOCKED_PENDING_F18_ACCEPTANCE", "published_source_head": source_head,
        "reason": "USER_SCOPE_LOCAL_AND_WSL_ONLY"}, at=FINAL_AT,
        step="LOCAL_WSL_CHECKPOINT")
    original = (root / "docs/progress/progress-events.json").read_bytes()
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if original.count(marker) != 1:
        raise RuntimeError("F18_LOCAL_EVENT_BYTES_INVALID")
    event_raw = original.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-3:])
        + marker.replace(old_id, last["event_id"].encode())
    ).replace(b'"last_sequence": 1495', b'"last_sequence": 1498', 1)
    progress.update({"snapshot_id": "snapshot-f18-local-checkpoint-seq1498",
        "event_sequence": 1498, "last_event_id": last["event_id"],
        "updated_at": FINAL_AT, "recorded_at": FINAL_AT,
        "status": "PAUSED", "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
        "active_agent": None, "worker_lease": None, "write_lease": None,
        "next_safe_action": "F18_PRODUCTION_OWNER_EVIDENCE_REQUIRED_OUTSIDE_MAIN_SCOPE",
        "runtime_next_action": "F18_PRODUCTION_OWNER_EVIDENCE_REQUIRED_OUTSIDE_MAIN_SCOPE",
        "reporting_decision": {"decision": "SCOPE_BOUNDARY_REPORT",
            "reason_codes": ["F18_PRODUCTION_TARGET_EXCLUDED_BY_USER"],
            "stop_before_dialogue_report": True}})
    progress["active_work_instruction"]["result_status"] = "PARTIAL_LOCAL_WSL_VERIFIED"
    progress["repository"].update({"projection_mode": FINAL_MODE,
        "local_head": source_head, "remote_head": source_head,
        "worktree_status": "F18_PAUSED_SCOPE_BOUNDARY",
        "commit_status": "PUBLISHED_CHECKPOINT", "push_status": "PUBLISHED_CHECKPOINT"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 Local/WSL checkpoint; Production NOT_EXECUTED\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n\n"
                   b"- Local/WSL evidence: Windows 79 PASS; WSL F-18/F-16 67 PASS.\n"
                   b"- WSL F-17 12 tests NOT_RUN (SQLAlchemy absent); Production NOT_EXECUTED.\n"
                   b"- F-18 accepted=false; F-19 blocked. Branch retained, no further branch.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "algorithm": "SHA-256", "event_sequence": 1498, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json",
                     "bytes": len(progress_raw), "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md",
                    "bytes": len(handoff_raw), "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md",
            DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "package_id": "F-18", "event_sequence": 1498, "accepted": False,
        "projection_mode": FINAL_MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(),
        "product_write_scope": product_paths(), "raw_checksums": checksums,
        "self_reference": False, "production": "NOT_EXECUTED"}))


def materialize(root):
    root = Path(root)
    if subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root,
                               text=True).strip() != BASE:
        raise RuntimeError("F18_LOCAL_BASE_GIT_INVALID")
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1491 or ledger.get("last_sequence") != 1491
            or progress.get("current_work_package") != "F-17"
            or progress.get("status") != "ACCEPTED"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None):
        raise RuntimeError("F18_LOCAL_BASE_PROGRESS_INVALID")
    events = ledger["events"]
    _event(events, "F17_MERGED_MAIN_VERIFIED", {"merge_commit": BASE,
        "pull_request": "https://github.com/sinsan-develop/Anvil/pull/34",
        "merged_main_g05": "PASS_1491", "branch_worktree_removed": True})
    _event(events, "PACKAGE_STARTED", {"package_id": "F-18",
        "scope": "LOCAL_WSL_PREFLIGHT_ONLY", "branch": BRANCH,
        "base_commit": BASE, "work_instruction": WI,
        "production": "NOT_EXECUTED"})
    _event(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER,
        "actor_id": ACTOR, "execution_fencing_token": EXECUTION_TOKEN})
    last = _event(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
        "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
        "path_scope": product_paths()})
    original = subprocess.check_output(["git", "show",
        f"{BASE}:docs/progress/progress-events.json"], cwd=root)
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if original.count(marker) != 1:
        raise RuntimeError("F18_LOCAL_EVENT_BYTES_INVALID")
    event_raw = original.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-4:])
        + marker.replace(old_id, last["event_id"].encode())
    ).replace(b'"last_sequence": 1491', b'"last_sequence": 1495', 1)
    wi_raw, prompt_raw = (root / WI).read_bytes(), (root / PROMPT).read_bytes()
    progress.update({"snapshot_id": "snapshot-f18-local-start-seq1495",
        "event_sequence": 1495, "last_event_id": last["event_id"],
        "updated_at": AT, "recorded_at": AT, "current_phase": "F",
        "current_work_package": "F-18", "status": "ACTIVE",
        "f18_overall_status": "IN_PROGRESS_LOCAL_WSL_ONLY",
        "active_agent": ACTOR, "worker_lease": _lease("worker"),
        "write_lease": _lease("write"),
        "active_work_instruction": {"artifact_id": "WI-F-18-LOCAL-20260924-001",
            "path": WI, "sha256": _sha(wi_raw), "invocation_path": PROMPT,
            "invocation_sha256": _sha(prompt_raw),
            "assigned_verification_ids": ["AV-OPS-013", "AV-OPS-016",
                                          "AV-OPS-020", "AV-OPS-021"],
            "verification_scope": "LOCAL_WSL_PREFLIGHT_ONLY"},
        "repository": {"branch": BRANCH, "local_head": BASE,
            "upstream": f"development/{BRANCH}", "remote_head": BASE,
            "projection_mode": MODE, "validated_base_commit": BASE,
            "head_relation": "BASE_OR_FEATURE_DESCENDANT",
            "exact_allowed_paths": control_paths(),
            "product_write_scope": product_paths(),
            "worktree_status": "F18_LOCAL_ACTIVE", "commit_status": "PENDING",
            "push_status": "PENDING"},
        "next_work_package": {"package_id": "F-19",
                              "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "F-19",
                                        "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
        "next_safe_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_PREFLIGHT_EXACT5",
        "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_LOCAL_PREFLIGHT_EXACT5",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F18_APPROVED_LOCAL_WSL_SCOPE"],
            "stop_before_dialogue_report": False},
        "current_progress_evidence_ref": {"package_id": "F-18", "path": DIGEST,
                                          "manifest_path": MANIFEST}})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 Local/WSL preflight start; Production NOT_EXECUTED\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n\n"
                   b"- F-18 overall acceptance and F-19 remain blocked on Production evidence.\n"
                   b"- This worker may modify only local product paths and use WSL-server for QA.\n")
    previous = subprocess.check_output(["git", "show", f"{BASE}:docs/WORK_STATUS.md"], cwd=root)
    status_raw = ("# F-18 Local/WSL preflight start / 2026-09-24\n\n"
        "- 판정: ACTIVE, F-18 전체 합격 아님. 신산님 최신 직접 지시에 따라 작업 대상은 로컬과 WSL-server뿐이며 ysna-server 접근·변경·검증은 금지한다. F-19 및 U Gate는 F-18 최종 미충족으로 대기한다.\n"
        "- Main 기준 main b6b3ff0, F-17 PR #34 merged-main G-05 PASS/관련 19 PASS·2 opt-in SKIP, F-17 작업 branch/worktree 삭제. 단일 branch codex/f18-local-wsl-preflight, Developer exact5 lease, 정식 실패 0회.\n"
        "- 현재 작업은 DeployApprovalSubject와 WSL→target artifact mismatch의 로컬 순수 계약 및 WSL 격리 재현뿐이다. Production checkout, shared-db, OIDC/object storage/network, envil.sinsan.kr, 실제 DeployApproval/ReleaseDecision은 NOT_EXECUTED.\n"
        "- 다음: G-05 start gate→Developer TDD exact5→Main 로컬/WSL 독립 검증→미검증 경계와 서버 담당자 인수 증거를 기록. F-18 전체 acceptance·PR merge·후속 branch는 수행하지 않는다.\n\n"
    ).encode("utf-8") + previous
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "algorithm": "SHA-256", "event_sequence": 1495, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json",
                     "bytes": len(progress_raw), "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md",
                    "bytes": len(handoff_raw), "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md",
            DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "package_id": "F-18", "event_sequence": 1495, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(),
        "product_write_scope": product_paths(), "raw_checksums": checksums,
        "self_reference": False, "production": "NOT_EXECUTED"}))
