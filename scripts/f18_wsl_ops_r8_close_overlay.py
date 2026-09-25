"""Fail-closed R8 code-flow writer revocation after same-SHA WSL QA."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from scripts.wsl_scope_overlay import _is_ancestor, _run
    from scripts import f18_wsl_ops_r8_overlay as r8
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from wsl_scope_overlay import _is_ancestor, _run
    import f18_wsl_ops_r8_overlay as r8

BASE = r8.BASE
BRANCH = r8.BRANCH
MODE = "F18_WSL_OPS_R8_CODE_FLOW_CHECKPOINT"
PRODUCT = "e6a6c9b9b0f642e51d4dffbc0d8f803ed6b90c2b"
PLAN = "docs/work_orders/F-18_WSL_OPS_R8_CLOSE_PLAN.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r8-close.json"
MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R8_CLOSE_MANIFEST.json"
SELF = "scripts/f18_wsl_ops_r8_close_overlay.py"


def control_paths():
    return sorted(set(r8.control_paths()) | {PLAN, DIGEST, MANIFEST, SELF,
            "tests/tooling/test_f18_wsl_ops_r8_close_overlay.py"})


def evidence_paths():
    return {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            DIGEST, MANIFEST}


def _historical(root):
    return (json.loads(_run(root, "show", f"{PRODUCT}:docs/progress/build-progress.json")),
            json.loads(_run(root, "show", f"{PRODUCT}:docs/progress/progress-events.json"))["events"])


def validate_predecessor(root, progress):
    try:
        published, _ = _historical(root)
        worker, write = published.get("worker_lease") or {}, published.get("write_lease") or {}
        good = (progress == published
                and published.get("event_sequence") == 1541
                and published.get("status") == "ACTIVE"
                and published.get("active_agent") == r8.ACTOR
                and published.get("f18_overall_status") == "IN_PROGRESS_WSL_OPS"
                and worker.get("lease_id") == r8.WORKER and worker.get("status") == "ACTIVE"
                and worker.get("execution_fencing_token") == r8.EXECUTION_TOKEN
                and write.get("lease_id") == r8.WRITE and write.get("status") == "ACTIVE"
                and write.get("worker_lease_id") == r8.WORKER
                and write.get("write_fencing_token") == r8.WRITE_TOKEN
                and published.get("repository", {}).get("projection_mode") == r8.MODE
                and published.get("repository", {}).get("product_write_scope") == r8.write_paths()
                and _is_ancestor(root, r8.R7_CLOSE_HEAD, PRODUCT))
    except (KeyError, ValueError, OSError):
        good = False
    return [] if good else ["F18_WSL_OPS_R8_CLOSE_PREDECESSOR_INVALID"]


def validate_state(progress, qa_head):
    repo = progress.get("repository") or {}
    scope = progress.get("scope_revision_binding") or {}
    good = (progress.get("event_sequence") == 1543
            and progress.get("status") == "ACTIVE"
            and progress.get("current_work_package") == "F-18"
            and progress.get("f18_overall_status") == "IN_PROGRESS_WSL_OPS"
            and progress.get("active_agent") == "main-agent-eoul"
            and progress.get("worker_lease") is None and progress.get("write_lease") is None
            and progress.get("next_work_package") == {"package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
            and repo.get("projection_mode") == MODE and repo.get("validated_base_commit") == BASE
            and repo.get("branch") == BRANCH and repo.get("control_qa_head") == qa_head
            and repo.get("exact_allowed_paths") == control_paths()
            and repo.get("product_write_scope") == []
            and scope.get("approval_id") == r8.r7_close.r7.r6.r6.APPROVAL_ID
            and scope.get("production") == "NOT_EXECUTED"
            and scope.get("release_decision") == "DEFER")
    return [] if good else ["F18_WSL_OPS_R8_CLOSE_STATE_INVALID"]


def collect_git(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    head, qa = _run(root, "rev-parse", "HEAD"), r8.GIT_HELPERS.git_added_commit(root, SELF)
    changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines()))
    errors = validate_start_git_facts(
        branch=_run(root, "branch", "--show-current"),
        upstream=_run(root, "rev-parse", "--abbrev-ref", "@{upstream}"),
        head=head, remote_head=_run(root, "rev-parse", f"development/{BRANCH}"),
        staged=set(filter(None, _run(root, "diff", "--cached", "--name-only").splitlines())),
        dirty=r8.GIT_HELPERS._porcelain(root), changed=changed,
        base_is_ancestor=_is_ancestor(root, BASE, head), expected_branch=BRANCH,
        required_control_paths=control_paths(), allowed_product_paths=r8.all_product_paths(),
        require_clean_feature=True)
    if _run(root, "rev-parse", "development/main") != BASE:
        errors.append("F18_WSL_OPS_R8_CLOSE_MAIN_DRIFT")
    if not (qa and progress.get("repository", {}).get("control_qa_head") == qa
            and _is_ancestor(root, PRODUCT, qa) and _is_ancestor(root, qa, head)):
        errors.append("F18_WSL_OPS_R8_CLOSE_QA_HEAD_INVALID")
    else:
        post_qa = set(filter(None, _run(root, "diff", "--name-only", f"{qa}..{head}").splitlines()))
        if post_qa - evidence_paths():
            errors.append("F18_WSL_OPS_R8_CLOSE_POST_QA_SCOPE_INVALID")
    return sorted(set(errors))


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    rows, qa = ledger.get("events", []), r8.GIT_HELPERS.git_added_commit(root, SELF)
    old_progress, old_events = _historical(root)
    errors = validate_state(progress, qa) + validate_predecessor(root, old_progress)
    if rows[:1541] != old_events:
        errors.append("F18_WSL_OPS_R8_CLOSE_HISTORY_INVALID")
    if len(rows) != 1543 or ledger.get("last_sequence") != 1543 or rows[-1].get("event_id") != progress.get("last_event_id"):
        errors.append("F18_WSL_OPS_R8_CLOSE_EVENT_INVALID")
    else:
        for index, kind, lease in ((1541, "WRITE_LEASE_REVOKED", r8.WRITE),
                                   (1542, "WORKER_LEASE_REVOKED", r8.WORKER)):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("event_type") != kind
                    or row.get("actor_id") != "main-agent-eoul"
                    or row.get("previous_event_sha256") != _sha(_canonical(rows[index - 1]))
                    or row.get("details") != {"lease_id": lease, "reason": "R8_CODE_FLOW_WSL_QA_COMPLETE",
                                               "product_head": PRODUCT, "control_qa_head": qa}):
                errors.append("F18_WSL_OPS_R8_CLOSE_REVOCATION_INVALID")
    if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(
            (root / "docs/progress/progress-events.json").read_bytes()):
        errors.append("F18_WSL_OPS_R8_CLOSE_EVENT_HASH_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("F18_WSL_OPS_R8_CLOSE_SNAPSHOT_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest.get(key, {}).get("bytes"), digest.get(key, {}).get("file_sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_R8_CLOSE_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    raw_scope = set(control_paths()) - {"docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}
    if (manifest.get("event_sequence") != 1543 or manifest.get("projection_mode") != MODE
            or manifest.get("validated_base_commit") != BASE
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != [] or manifest.get("accepted") is not False
            or manifest.get("production") != "NOT_EXECUTED"
            or {row.get("path") for row in manifest.get("raw_checksums", [])} != raw_scope):
        errors.append("F18_WSL_OPS_R8_CLOSE_MANIFEST_INVALID")
    for item in manifest.get("raw_checksums", []):
        raw = (root / item["path"]).read_bytes()
        if (item.get("bytes"), item.get("sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_R8_CLOSE_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    old_progress, old_events = _historical(root)
    if (progress != old_progress or ledger.get("events") != old_events
            or ledger.get("last_sequence") != 1541 or validate_predecessor(root, progress)):
        raise RuntimeError("F18_WSL_OPS_R8_CLOSE_PREDECESSOR_INVALID")
    head = _run(root, "rev-parse", "HEAD")
    if (_run(root, "branch", "--show-current") != BRANCH
            or _run(root, "rev-parse", "development/main") != BASE
            or _run(root, "rev-parse", f"development/{BRANCH}") != head
            or r8.GIT_HELPERS.git_added_commit(root, SELF) != head
            or r8.GIT_HELPERS._porcelain(root) - evidence_paths()):
        raise RuntimeError("F18_WSL_OPS_R8_CLOSE_GIT_INVALID")
    at = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    rows, old_id = ledger["events"], progress["last_event_id"]
    for kind, lease in (("WRITE_LEASE_REVOKED", r8.WRITE), ("WORKER_LEASE_REVOKED", r8.WORKER)):
        last = _event(rows, kind, {"lease_id": lease, "reason": "R8_CODE_FLOW_WSL_QA_COMPLETE",
                                   "product_head": PRODUCT, "control_qa_head": head},
                      at=at, step="WSL_OPS_R8_CLOSE")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(), old_id, 1541, rows[-2:])
    progress.update({"snapshot_id": "snapshot-f18-wsl-ops-r8-close-seq1543",
                     "event_sequence": 1543, "last_event_id": last["event_id"],
                     "updated_at": at, "recorded_at": at, "status": "ACTIVE",
                     "active_agent": "main-agent-eoul", "worker_lease": None, "write_lease": None,
                     "next_safe_action": "PREPARE_F18_WSL_OIDC_ISSUER_API_STAGE",
                     "runtime_next_action": "PREPARE_F18_WSL_OIDC_ISSUER_API_STAGE"})
    progress["repository"].update({"branch": BRANCH, "upstream": f"development/{BRANCH}",
        "local_head": BASE, "remote_head": head, "control_qa_head": head,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": [], "projection_mode": MODE,
        "worktree_status": "F18_WSL_OPS_R8_CODE_FLOW_CHECKPOINT",
        "commit_status": "PENDING", "push_status": "PENDING"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 WSL R8 code-flow checkpoint\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n\n"
                   b"- R8 writer revoked; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1543, "self_reference": False,
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
        "package_id": "F-18", "event_sequence": 1543, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": [],
        "raw_checksums": checksums, "self_reference": False,
        "production": "NOT_EXECUTED"}))
