"""Fail-closed R34 OIDC session-coordinator writer revocation after same-SHA WSL QA."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from scripts.wsl_scope_overlay import _is_ancestor, _run
    from scripts import f18_wsl_ops_r34_session_coordinator_overlay as r34
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from wsl_scope_overlay import _is_ancestor, _run
    import f18_wsl_ops_r34_session_coordinator_overlay as r34

BASE = r34.BASE
BRANCH = r34.BRANCH
MODE = "F18_WSL_OPS_R34_SESSION_COORDINATOR_CHECKPOINT"
PRODUCT = "03c2509ef5dfce09ebb54b0bdc09e1d60cbeb5b4"
PLAN = "docs/work_orders/F-18_WSL_OPS_R34_CLOSE_PLAN.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r34-close.json"
MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R34_CLOSE_MANIFEST.json"
SELF = "scripts/f18_wsl_ops_r34_close_overlay.py"
TEST = "tests/tooling/test_f18_wsl_ops_r34_close_overlay.py"


def control_paths():
    return sorted(set(r34.control_paths()) | {PLAN, DIGEST, MANIFEST, SELF, TEST})


def evidence_paths():
    return set(r34.evidence_paths()) | {
        "docs/WORK_STATUS.md", "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}


def _historical(root):
    return (json.loads(_run(root, "show", f"{PRODUCT}:docs/progress/build-progress.json")),
            json.loads(_run(root, "show", f"{PRODUCT}:docs/progress/progress-events.json"))["events"])


def collect_git(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    qa = progress.get("repository", {}).get("control_qa_head", "")
    head = _run(root, "rev-parse", "HEAD")
    changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines()))
    old_product = (set(r34.previous.r33.previous.r32.previous.r31.previous.r30.previous.r29.previous.r18.all_product_paths())
                   | set(r34.previous.r33.previous.r32.previous.r31.previous.r30.previous.r29.write_paths())
                   | set(r34.previous.r33.previous.r32.previous.r31.previous.r30.write_paths())
                   | set(r34.previous.r33.previous.r32.previous.r31.write_paths())
                   | set(r34.previous.r33.previous.r32.write_paths())
                   | set(r34.previous.r33.write_paths()))
    errors = validate_start_git_facts(
        branch=_run(root, "branch", "--show-current"),
        upstream=_run(root, "rev-parse", "--abbrev-ref", "@{upstream}"),
        head=head, remote_head=_run(root, "rev-parse", f"development/{BRANCH}"),
        staged=set(filter(None, _run(root, "diff", "--cached", "--name-only").splitlines())),
        dirty=r34.previous.r33.previous.r32.previous.r31.previous.r30.previous.r29.previous.r18.GIT_HELPERS._porcelain(root),
        changed=changed, base_is_ancestor=_is_ancestor(root, BASE, head), expected_branch=BRANCH,
        required_control_paths=control_paths(),
        allowed_product_paths=sorted(old_product | set(r34.write_paths())), require_clean_feature=True)
    if _run(root, "rev-parse", "development/main") != BASE:
        errors.append("F18_R34_CLOSE_MAIN_DRIFT")
    if not qa or not _is_ancestor(root, PRODUCT, qa) or not _is_ancestor(root, qa, head):
        errors.append("F18_R34_CLOSE_QA_HEAD_INVALID")
    elif set(filter(None, _run(root, "diff", "--name-only", f"{qa}..{head}").splitlines())) - evidence_paths():
        errors.append("F18_R34_CLOSE_POST_QA_SCOPE_INVALID")
    return sorted(set(errors))


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    old_progress, old_events = _historical(root)
    rows = ledger.get("events", [])
    repo = progress.get("repository") or {}
    qa = repo.get("control_qa_head", "")
    errors = []
    if (old_progress.get("event_sequence") != 1601
            or old_progress.get("repository", {}).get("projection_mode") != r34.MODE
            or (old_progress.get("worker_lease") or {}).get("lease_id") != r34.WORKER
            or (old_progress.get("write_lease") or {}).get("lease_id") != r34.WRITE
            or rows[:1601] != old_events):
        errors.append("F18_R34_CLOSE_PREDECESSOR_INVALID")
    if (progress.get("event_sequence") != 1603 or progress.get("status") != "ACTIVE"
            or progress.get("current_work_package") != "F-18"
            or progress.get("f18_overall_status") != "IN_PROGRESS_WSL_OPS"
            or progress.get("active_agent") != "main-agent-eoul"
            or progress.get("worker_lease") is not None or progress.get("write_lease") is not None
            or progress.get("next_work_package") != {"package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
            or repo.get("projection_mode") != MODE or repo.get("branch") != BRANCH
            or repo.get("validated_base_commit") != BASE
            or repo.get("exact_allowed_paths") != control_paths()
            or repo.get("product_write_scope") != []
            or progress.get("scope_revision_binding", {}).get("approval_id") != "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"
            or progress.get("scope_revision_binding", {}).get("production") != "NOT_EXECUTED"
            or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"):
        errors.append("F18_R34_CLOSE_STATE_INVALID")
    if len(rows) != 1603 or ledger.get("last_sequence") != 1603 or rows[-1].get("event_id") != progress.get("last_event_id"):
        errors.append("F18_R34_CLOSE_EVENTS_INVALID")
    else:
        for index, kind, lease in ((1601, "WRITE_LEASE_REVOKED", r34.WRITE),
                                   (1602, "WORKER_LEASE_REVOKED", r34.WORKER)):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("event_type") != kind
                    or row.get("actor_id") != "main-agent-eoul"
                    or row.get("previous_event_sha256") != _sha(_canonical(rows[index - 1]))
                    or row.get("details") != {"lease_id": lease,
                        "reason": "R34_SESSION_COORDINATOR_WSL_QA_COMPLETE", "product_head": PRODUCT,
                        "control_qa_head": qa}):
                errors.append("F18_R34_CLOSE_REVOCATION_INVALID")
    event_raw = (root / "docs/progress/progress-events.json").read_bytes()
    if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(event_raw):
        errors.append("F18_R34_CLOSE_EVENT_HASH_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("F18_R34_CLOSE_SNAPSHOT_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest.get(key, {}).get("bytes"), digest.get(key, {}).get("file_sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_R34_CLOSE_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    raw_scope = set(control_paths()) - {"docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}
    if (manifest.get("event_sequence") != 1603 or manifest.get("projection_mode") != MODE
            or manifest.get("validated_base_commit") != BASE
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != [] or manifest.get("accepted") is not False
            or manifest.get("production") != "NOT_EXECUTED"
            or {item.get("path") for item in manifest.get("raw_checksums", [])} != raw_scope):
        errors.append("F18_R34_CLOSE_MANIFEST_INVALID")
    for item in manifest.get("raw_checksums", []):
        raw = (root / item["path"]).read_bytes()
        if (item.get("bytes"), item.get("sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_R34_CLOSE_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    old_progress, old_events = _historical(root)
    if (progress != old_progress or ledger.get("events") != old_events or ledger.get("last_sequence") != 1601
            or (progress.get("worker_lease") or {}).get("lease_id") != r34.WORKER
            or (progress.get("write_lease") or {}).get("lease_id") != r34.WRITE):
        raise RuntimeError("F18_R34_CLOSE_PREDECESSOR_INVALID")
    head = _run(root, "rev-parse", "HEAD")
    if (_run(root, "branch", "--show-current") != BRANCH
            or _run(root, "rev-parse", f"development/{BRANCH}") != head
            or _run(root, "rev-parse", "development/main") != BASE
            or not _is_ancestor(root, PRODUCT, head)
            or r34.previous.r33.previous.r32.previous.r31.previous.r30.previous.r29.previous.r18.GIT_HELPERS._porcelain(root)):
        raise RuntimeError("F18_R34_CLOSE_GIT_INVALID")
    qa = head
    at = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    rows, old_id = ledger["events"], progress["last_event_id"]
    for kind, lease in (("WRITE_LEASE_REVOKED", r34.WRITE), ("WORKER_LEASE_REVOKED", r34.WORKER)):
        last = _event(rows, kind, {"lease_id": lease, "reason": "R34_SESSION_COORDINATOR_WSL_QA_COMPLETE",
                                   "product_head": PRODUCT, "control_qa_head": qa},
                      at=at, step="WSL_OPS_R34_CLOSE")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(), old_id, 1601, rows[-2:])
    progress.update({"snapshot_id": "snapshot-f18-wsl-ops-r34-close-seq1603",
        "event_sequence": 1603, "last_event_id": last["event_id"],
        "updated_at": at, "recorded_at": at, "status": "ACTIVE",
        "active_agent": "main-agent-eoul", "worker_lease": None, "write_lease": None,
        "next_safe_action": "PREPARE_F18_OIDC_SAME_ORIGIN_API_STAGE",
        "runtime_next_action": "PREPARE_F18_OIDC_SAME_ORIGIN_API_STAGE"})
    progress["repository"].update({"branch": BRANCH, "upstream": f"development/{BRANCH}",
        "local_head": BASE, "remote_head": qa, "control_qa_head": qa,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": [], "projection_mode": MODE,
        "worktree_status": "F18_WSL_OPS_R34_SESSION_COORDINATOR_CHECKPOINT",
        "commit_status": "PENDING", "push_status": "PENDING"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 WSL R34 OIDC session-coordinator checkpoint\n\n```json anvil-recovery-summary\n" +
        _pretty({key: deepcopy(progress.get(key)) for key in (
            "event_sequence", "last_event_id", "status", "current_phase", "current_work_package",
            "active_agent", "worker_lease", "write_lease", "next_work_package",
            "next_safe_action", "runtime_next_action")}) + b"```\n\n"
        b"- R34 leases revoked after same-SHA WSL OIDC session-coordinator QA; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1603, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw), "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw), "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0", "package_id": "F-18",
        "event_sequence": 1603, "accepted": False, "projection_mode": MODE,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": [], "raw_checksums": checksums,
        "self_reference": False, "production": "NOT_EXECUTED"}))
