"""Fail-closed F-18 WSL operational rehearsal dispatch projection."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts.f18_progress_overlay import (
        _append_events_raw, _canonical, _event, _pretty, _sha,
        parse_git_porcelain_paths, validate_start_git_facts,
    )
    from scripts.wsl_scope_overlay import _is_ancestor, _run
except ModuleNotFoundError:
    from f18_progress_overlay import (
        _append_events_raw, _canonical, _event, _pretty, _sha,
        parse_git_porcelain_paths, validate_start_git_facts,
    )
    from wsl_scope_overlay import _is_ancestor, _run

BASE = "69247977e4e51781401e45348fd3a290d8393c36"
BRANCH = "codex/f18-wsl-ops"
MODE = "F18_WSL_OPS_R1_START"
APPROVAL_ID = "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"
ACTOR = "developer-primary-f18-wsl-ops-r1"
WORKER = "worker-lease-f18-wsl-ops-r1-20260925-001"
WRITE = "write-lease-f18-wsl-ops-r1-20260925-001"
EXECUTION_TOKEN = "f18-wsl-ops-execution-fence-epoch-1-69247977e4e51781"
WRITE_TOKEN = "f18-wsl-ops-write-fence-epoch-1-69247977e4e51781"
WI = "docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-18_WSL_OPS_INVOCATION.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops.json"
MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_START_MANIFEST.json"


def product_paths():
    return sorted(("packages/deployment/wsl_operational.py",
                   "tests/deploy/test_f18_wsl_operational.py",
                   "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def control_paths():
    return sorted((WI, INVOCATION, "docs/WORK_STATUS.md",
                   "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
                   "docs/progress/progress-events.json", DIGEST, MANIFEST,
                   "scripts/check_project_progress.py", "scripts/f18_wsl_ops_overlay.py",
                   "tests/tooling/test_f18_wsl_ops_overlay.py"))


def evidence_paths():
    return {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            DIGEST, MANIFEST}


def validate_git_facts(**facts):
    return validate_start_git_facts(
        **facts, expected_branch=BRANCH, required_control_paths=control_paths(),
        allowed_product_paths=product_paths(), require_clean_feature=True)


def validate_state(progress, wi_sha, invocation_sha):
    repo = progress.get("repository") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    scope = progress.get("scope_revision_binding") or {}
    good = (
        progress.get("event_sequence") == 1515
        and progress.get("status") == "ACTIVE"
        and progress.get("current_work_package") == "F-18"
        and progress.get("f18_overall_status") == "IN_PROGRESS_WSL_OPS"
        and progress.get("active_agent") == ACTOR
        and progress.get("next_work_package") == {
            "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
        and repo.get("projection_mode") == MODE
        and repo.get("validated_base_commit") == BASE
        and repo.get("branch") == BRANCH
        and repo.get("exact_allowed_paths") == control_paths()
        and repo.get("product_write_scope") == product_paths()
        and worker.get("lease_id") == WORKER
        and worker.get("actor_id") == ACTOR
        and worker.get("status") == "ACTIVE"
        and worker.get("execution_fencing_token") == EXECUTION_TOKEN
        and worker.get("path_scope") == product_paths()
        and write.get("lease_id") == WRITE
        and write.get("actor_id") == ACTOR
        and write.get("status") == "ACTIVE"
        and write.get("worker_lease_id") == WORKER
        and write.get("execution_fencing_token") == EXECUTION_TOKEN
        and write.get("write_fencing_token") == WRITE_TOKEN
        and write.get("path_scope") == product_paths()
        and instruction.get("path") == WI
        and instruction.get("sha256") == wi_sha
        and instruction.get("invocation_path") == INVOCATION
        and instruction.get("invocation_sha256") == invocation_sha
        and scope.get("production") == "NOT_EXECUTED"
        and scope.get("approval_id") == APPROVAL_ID
        and scope.get("release_decision") == "DEFER"
    )
    return [] if good else ["F18_WSL_OPS_START_STATE_INVALID"]


def collect_git(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    branch = _run(root, "branch", "--show-current")
    head = _run(root, "rev-parse", "HEAD")
    upstream = _run(root, "rev-parse", "--abbrev-ref", "@{upstream}")
    remote_head = _run(root, "rev-parse", f"development/{BRANCH}")
    changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines()))
    staged = set(filter(None, _run(root, "diff", "--cached", "--name-only").splitlines()))
    status = subprocess.check_output(
        ["git", "-c", "core.excludesFile=", "-c", "core.quotePath=false",
         "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=root, text=True, encoding="utf-8")
    dirty = parse_git_porcelain_paths(status)
    errors = validate_git_facts(
        branch=branch, upstream=upstream, head=head, remote_head=remote_head,
        staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=_is_ancestor(root, BASE, head))
    if _run(root, "rev-parse", "development/main") != BASE:
        errors.append("F18_WSL_OPS_MAIN_DRIFT")
    qa = progress.get("repository", {}).get("control_qa_head")
    qa_bound = isinstance(qa, str) and re.fullmatch(r"[0-9a-f]{40}", qa) and (
        _is_ancestor(root, BASE, qa) and _is_ancestor(root, qa, head))
    if not qa_bound:
        errors.append("F18_WSL_OPS_QA_HEAD_INVALID")
    else:
        post_qa = set(filter(None, _run(root, "diff", "--name-only", f"{qa}..{head}").splitlines()))
        if post_qa - (evidence_paths() | set(product_paths())):
            errors.append("F18_WSL_OPS_POST_QA_SCOPE_INVALID")
    return sorted(set(errors))


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    errors = validate_state(progress, _sha((root / WI).read_bytes()),
                            _sha((root / INVOCATION).read_bytes()))
    if (ledger.get("last_sequence") != 1515 or
            ledger["events"][-1]["event_id"] != progress.get("last_event_id") or
            ledger["events"][-1].get("previous_event_sha256") !=
            _sha(_canonical(ledger["events"][-2]))):
        errors.append("F18_WSL_OPS_EVENT_INVALID")
    if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(
            (root / "docs/progress/progress-events.json").read_bytes()):
        errors.append("F18_WSL_OPS_EVENT_HASH_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("F18_WSL_OPS_SNAPSHOT_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest.get(key, {}).get("bytes"), digest.get(key, {}).get("file_sha256")) != (
                len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    raw_scope = set(control_paths()) - {
        "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}
    if (manifest.get("event_sequence") != 1515 or manifest.get("projection_mode") != MODE
            or manifest.get("validated_base_commit") != BASE
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != product_paths()
            or manifest.get("accepted") is not False
            or manifest.get("production") != "NOT_EXECUTED"
            or {row.get("path") for row in manifest.get("raw_checksums", [])} != raw_scope):
        errors.append("F18_WSL_OPS_MANIFEST_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (row.get("bytes"), row.get("sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def _lease(kind, at, expires, dispatch_head):
    row = {"lease_id": WORKER if kind == "worker" else WRITE,
           "actor_id": ACTOR, "subject_ref": "F-18/WSL_OPS_R1", "status": "ACTIVE",
           "issued_at": at, "expires_at": expires, "lease_epoch": 1,
           "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
           "execution_fencing_token": EXECUTION_TOKEN,
           "baseline_git_commit": dispatch_head, "dispatch_head": dispatch_head,
           "path_scope": product_paths()}
    if kind == "write":
        row.update({"worker_lease_id": WORKER, "write_epoch": 1,
                    "write_fencing_token": WRITE_TOKEN})
    return row


def materialize(root, qa_head):
    """Issue one exact writer only after the published control code passed WSL QA."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1512 or ledger.get("last_sequence") != 1512
            or progress.get("status") != "PAUSED"
            or progress.get("worker_lease") is not None or progress.get("write_lease") is not None):
        raise RuntimeError("F18_WSL_OPS_PREDECESSOR_INVALID")
    head = _run(root, "rev-parse", "HEAD")
    if (_run(root, "branch", "--show-current") != BRANCH
            or _run(root, "rev-parse", "development/main") != BASE
            or _run(root, "rev-parse", f"development/{BRANCH}") != head
            or not re.fullmatch(r"[0-9a-f]{40}", qa_head)
            or not _is_ancestor(root, BASE, qa_head)
            or not _is_ancestor(root, qa_head, head)
            or set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines())) -
                (set(control_paths()) | set(product_paths()))):
        raise RuntimeError("F18_WSL_OPS_GIT_INVALID")
    status = subprocess.check_output(
        ["git", "-c", "core.excludesFile=", "-c", "core.quotePath=false",
         "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=root, text=True, encoding="utf-8")
    dirty = parse_git_porcelain_paths(status)
    if not dirty or dirty - evidence_paths():
        raise RuntimeError("F18_WSL_OPS_EVIDENCE_DIRTY_INVALID")
    wi_sha, invocation_sha = _sha((root / WI).read_bytes()), _sha((root / INVOCATION).read_bytes())
    at_dt = datetime.now(timezone(timedelta(hours=9)))
    at, expires = at_dt.isoformat(timespec="seconds"), (at_dt + timedelta(hours=12)).isoformat(timespec="seconds")
    events = ledger["events"]
    old_id = progress["last_event_id"]
    _event(events, "WORK_INSTRUCTION_ISSUED", {"path": WI, "sha256": wi_sha,
        "invocation_path": INVOCATION, "invocation_sha256": invocation_sha,
        "control_qa_head": qa_head}, at=at, step="WSL_OPS_R1_START")
    _event(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER, "actor_id": ACTOR,
        "execution_fencing_token": EXECUTION_TOKEN}, at=at, step="WSL_OPS_R1_START")
    last = _event(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
        "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
        "path_scope": product_paths()}, at=at, step="WSL_OPS_R1_START")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1512, events[-3:])
    progress.update({"snapshot_id": "snapshot-f18-wsl-ops-r1-seq1515",
        "event_sequence": 1515, "last_event_id": last["event_id"],
        "updated_at": at, "recorded_at": at, "status": "ACTIVE",
        "f18_overall_status": "IN_PROGRESS_WSL_OPS", "active_agent": ACTOR,
        "worker_lease": _lease("worker", at, expires, qa_head),
        "write_lease": _lease("write", at, expires, qa_head),
        "active_work_instruction": {"artifact_id": "WI-F-18-WSL-OPS-R1-20260925-001",
            "path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
            "assigned_verification_ids": ["AV-OPS-013", "AV-OPS-016", "AV-OPS-020", "AV-OPS-021"],
            "verification_scope": "WSL_OPS_PREFLIGHT_R1_ONLY"},
        "next_safe_action": "DEVELOPER_IMPLEMENT_F18_WSL_OPS_PREFLIGHT_EXACT3",
        "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_WSL_OPS_PREFLIGHT_EXACT3",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F18_APPROVED_WSL_OPS_SCOPE"], "stop_before_dialogue_report": False}})
    progress["repository"].update({"branch": BRANCH, "upstream": f"development/{BRANCH}",
        "local_head": BASE, "remote_head": head, "control_qa_head": qa_head,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": product_paths(), "projection_mode": MODE,
        "worktree_status": "F18_WSL_OPS_R1_ACTIVE", "commit_status": "PENDING",
        "push_status": "PENDING"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 WSL operational rehearsal R1 writer start\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n\n"
                   b"- Product write lease exact3; Production NOT_EXECUTED; F-19 blocked.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1515, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "package_id": "F-18", "event_sequence": 1515, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
        "raw_checksums": checksums, "self_reference": False,
        "production": "NOT_EXECUTED"}))
