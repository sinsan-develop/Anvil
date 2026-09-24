"""Fail-closed F-18 R3 QA anchor checkpoint; no product writer is active."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import subprocess

try:
    from scripts.f18_progress_overlay import (
        _append_events_raw, _canonical, _event, _pretty, _sha,
        parse_git_porcelain_paths, validate_start_git_facts,
    )
    from scripts.wsl_scope_overlay import _is_ancestor, _run
    from scripts import f18_wsl_ops_r3_overlay as r3
except ModuleNotFoundError:
    from f18_progress_overlay import (
        _append_events_raw, _canonical, _event, _pretty, _sha,
        parse_git_porcelain_paths, validate_start_git_facts,
    )
    from wsl_scope_overlay import _is_ancestor, _run
    import f18_wsl_ops_r3_overlay as r3

BASE = r3.BASE
BRANCH = r3.BRANCH
MODE = "F18_WSL_OPS_R4_CONTROL_ANCHOR_CHECKPOINT"
PREDECESSOR_HEAD = "d27c5264a56c80ccf4f96571fcca15ec50ca93e7"
PLAN = "docs/work_orders/F-18_WSL_OPS_R4_CONTROL_ANCHOR_PLAN.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r4.json"
MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R4_CHECKPOINT_MANIFEST.json"
SELF = "scripts/f18_wsl_ops_r4_overlay.py"


def control_paths():
    return sorted(set(r3.control_paths()) | {
        PLAN, DIGEST, MANIFEST, SELF,
        "tests/tooling/test_f18_wsl_ops_r4_overlay.py"})


def evidence_paths():
    return {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            DIGEST, MANIFEST}


def git_added_commit(root, path):
    rows = _run(root, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines()
    return rows[0] if len(rows) == 1 else None


def validate_predecessor_anchor(root, progress, rows):
    """The R3 dispatch must point to the Git commit that introduced its WI."""
    qa = r3.CONTROL_QA_HEAD
    worker, write = progress.get("worker_lease") or {}, progress.get("write_lease") or {}
    instruction = rows[1522] if len(rows) > 1522 else {}
    good = (
        git_added_commit(root, r3.WI) == qa
        and progress.get("repository", {}).get("control_qa_head") == qa
        and worker.get("baseline_git_commit") == qa
        and worker.get("dispatch_head") == qa
        and write.get("baseline_git_commit") == qa
        and write.get("dispatch_head") == qa
        and instruction.get("sequence") == 1523
        and instruction.get("event_type") == "WORK_INSTRUCTION_ISSUED"
        and instruction.get("details", {}).get("control_qa_head") == qa
        and not r3.validate_transition_events(
            rows[1519:1525], _sha((Path(root) / r3.WI).read_bytes()),
            _sha((Path(root) / r3.INVOCATION).read_bytes()), qa)
    )
    return [] if good else ["F18_WSL_OPS_R3_QA_REBOUND"]


def validate_state(progress, qa_head):
    repo = progress.get("repository") or {}
    scope = progress.get("scope_revision_binding") or {}
    good = (
        progress.get("event_sequence") == 1527
        and progress.get("status") == "ACTIVE"
        and progress.get("current_work_package") == "F-18"
        and progress.get("f18_overall_status") == "IN_PROGRESS_WSL_OPS"
        and progress.get("active_agent") == "main-agent-eoul"
        and progress.get("worker_lease") is None
        and progress.get("write_lease") is None
        and progress.get("next_work_package") == {
            "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
        and repo.get("projection_mode") == MODE
        and repo.get("validated_base_commit") == BASE
        and repo.get("branch") == BRANCH
        and repo.get("control_qa_head") == qa_head
        and repo.get("exact_allowed_paths") == control_paths()
        and repo.get("product_write_scope") == []
        and scope.get("approval_id") == r3.APPROVAL_ID
        and scope.get("production") == "NOT_EXECUTED"
        and scope.get("release_decision") == "DEFER"
    )
    return [] if good else ["F18_WSL_OPS_R4_STATE_INVALID"]


def _porcelain(root):
    raw = subprocess.check_output(
        ["git", "-c", "core.excludesFile=", "-c", "core.quotePath=false",
         "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=root, text=True, encoding="utf-8")
    return parse_git_porcelain_paths(raw)


def collect_git(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    head = _run(root, "rev-parse", "HEAD")
    qa = git_added_commit(root, SELF)
    changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines()))
    errors = validate_start_git_facts(
        branch=_run(root, "branch", "--show-current"),
        upstream=_run(root, "rev-parse", "--abbrev-ref", "@{upstream}"),
        head=head, remote_head=_run(root, "rev-parse", f"development/{BRANCH}"),
        staged=set(filter(None, _run(root, "diff", "--cached", "--name-only").splitlines())),
        dirty=_porcelain(root), changed=changed,
        base_is_ancestor=_is_ancestor(root, BASE, head),
        expected_branch=BRANCH, required_control_paths=control_paths(),
        allowed_product_paths=r3.all_product_paths(), require_clean_feature=True)
    if _run(root, "rev-parse", "development/main") != BASE:
        errors.append("F18_WSL_OPS_R4_MAIN_DRIFT")
    if not (qa and progress.get("repository", {}).get("control_qa_head") == qa
            and _is_ancestor(root, r3.CONTROL_QA_HEAD, qa)
            and _is_ancestor(root, qa, head)):
        errors.append("F18_WSL_OPS_R4_QA_HEAD_INVALID")
    else:
        post_qa = set(filter(None, _run(root, "diff", "--name-only", f"{qa}..{head}").splitlines()))
        if post_qa - evidence_paths():
            errors.append("F18_WSL_OPS_R4_POST_QA_SCOPE_INVALID")
    return sorted(set(errors))


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    qa = git_added_commit(root, SELF)
    errors = validate_state(progress, qa)
    rows = ledger.get("events", [])
    try:
        historical_progress = json.loads(_run(root, "show", f"{PREDECESSOR_HEAD}:docs/progress/build-progress.json"))
        historical_events = json.loads(_run(root, "show", f"{PREDECESSOR_HEAD}:docs/progress/progress-events.json"))["events"]
    except (ValueError, KeyError, subprocess.CalledProcessError):
        errors.append("F18_WSL_OPS_R4_PREDECESSOR_MISSING")
    else:
        if rows[:1525] != historical_events:
            errors.append("F18_WSL_OPS_R4_HISTORY_REWRITTEN")
        errors.extend(validate_predecessor_anchor(root, historical_progress, historical_events))
    if (len(rows) != 1527 or ledger.get("last_sequence") != 1527
            or rows[-1].get("event_id") != progress.get("last_event_id")):
        errors.append("F18_WSL_OPS_R4_EVENT_INVALID")
    else:
        for index, (kind, lease_id) in enumerate((("WRITE_LEASE_REVOKED", r3.WRITE),
                                                   ("WORKER_LEASE_REVOKED", r3.WORKER)), 1525):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("event_type") != kind
                    or row.get("event_id") != f"evt_f18_local_{index + 1}_{kind.lower()}"
                    or row.get("actor_id") != "main-agent-eoul"
                    or row.get("details", {}).get("lease_id") != lease_id
                    or row.get("previous_event_sha256") != _sha(_canonical(rows[index - 1]))):
                errors.append("F18_WSL_OPS_R4_REVOKE_INVALID")
    if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(
            (root / "docs/progress/progress-events.json").read_bytes()):
        errors.append("F18_WSL_OPS_R4_EVENT_HASH_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("F18_WSL_OPS_R4_SNAPSHOT_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest.get(key, {}).get("bytes"), digest.get(key, {}).get("file_sha256")) != (
                len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_R4_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    raw_scope = set(control_paths()) - {
        "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}
    if (manifest.get("event_sequence") != 1527 or manifest.get("projection_mode") != MODE
            or manifest.get("validated_base_commit") != BASE
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != []
            or manifest.get("accepted") is not False
            or manifest.get("production") != "NOT_EXECUTED"
            or {row.get("path") for row in manifest.get("raw_checksums", [])} != raw_scope):
        errors.append("F18_WSL_OPS_R4_MANIFEST_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (row.get("bytes"), row.get("sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_R4_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root):
    """Record R3 writer revocation after R4 control code passed QA and was pushed."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    rows = ledger["events"]
    if (progress.get("event_sequence") != 1525 or ledger.get("last_sequence") != 1525
            or r3.validate_state(progress, _sha((root / r3.WI).read_bytes()),
                                 _sha((root / r3.INVOCATION).read_bytes()))
            or validate_predecessor_anchor(root, progress, rows)):
        raise RuntimeError("F18_WSL_OPS_R4_PREDECESSOR_INVALID")
    head = _run(root, "rev-parse", "HEAD")
    if (_run(root, "branch", "--show-current") != BRANCH
            or _run(root, "rev-parse", "development/main") != BASE
            or _run(root, "rev-parse", f"development/{BRANCH}") != head
            or git_added_commit(root, SELF) != head
            or _porcelain(root) - evidence_paths()):
        raise RuntimeError("F18_WSL_OPS_R4_GIT_INVALID")
    at = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    old_id = progress["last_event_id"]
    _event(rows, "WRITE_LEASE_REVOKED", {"lease_id": r3.WRITE,
        "reason": "R3_RUNTIME_VERIFIED_CONTROL_ANCHOR_HARDENED"}, at=at, step="WSL_OPS_R4_ANCHOR")
    last = _event(rows, "WORKER_LEASE_REVOKED", {"lease_id": r3.WORKER,
        "reason": "R3_RUNTIME_VERIFIED_CONTROL_ANCHOR_HARDENED"}, at=at, step="WSL_OPS_R4_ANCHOR")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1525, rows[-2:])
    progress.update({"snapshot_id": "snapshot-f18-wsl-ops-r4-seq1527",
        "event_sequence": 1527, "last_event_id": last["event_id"],
        "updated_at": at, "recorded_at": at, "status": "ACTIVE",
        "active_agent": "main-agent-eoul", "worker_lease": None, "write_lease": None,
        "active_work_instruction": None,
        "next_safe_action": "PREPARE_F18_WSL_OIDC_OBJECT_STORAGE_NETWORK_STAGE",
        "runtime_next_action": "PREPARE_F18_WSL_OIDC_OBJECT_STORAGE_NETWORK_STAGE",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F18_APPROVED_WSL_OPS_SCOPE"], "stop_before_dialogue_report": False}})
    progress["repository"].update({"branch": BRANCH, "upstream": f"development/{BRANCH}",
        "local_head": BASE, "remote_head": head, "control_qa_head": head,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": [], "projection_mode": MODE,
        "worktree_status": "F18_WSL_OPS_R4_CONTROL_ANCHOR_CHECKPOINT",
        "commit_status": "PENDING", "push_status": "PENDING"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 WSL R4 independent QA anchor checkpoint\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n\n"
                   b"- R3 writer leases revoked; R4 QA Git anchor fixed; F-18 accepted=false; Production NOT_EXECUTED.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1527, "self_reference": False,
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
        "package_id": "F-18", "event_sequence": 1527, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": [],
        "raw_checksums": checksums, "self_reference": False,
        "production": "NOT_EXECUTED"}))
