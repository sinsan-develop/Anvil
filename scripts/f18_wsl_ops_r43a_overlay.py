"""Fail-closed R43A OIDC formal host writer transition."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from scripts.f18_wsl_ops_r2_overlay import _valid_active_lease
    from scripts.wsl_scope_overlay import _is_ancestor, _run
    from scripts import f18_wsl_ops_r42_close_overlay as previous
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from f18_wsl_ops_r2_overlay import _valid_active_lease
    from wsl_scope_overlay import _is_ancestor, _run
    import f18_wsl_ops_r42_close_overlay as previous


BASE = previous.BASE
BRANCH = previous.BRANCH
PREDECESSOR = "955102978eb5c68735980fb98b0b65c268bb0884"
MODE = "F18_WSL_OPS_R43A_OIDC_FORMAL_HOST_START"
ACTOR = "developer-primary-f18-wsl-ops-r43a-oidc-formal-host"
WORKER = "worker-lease-f18-wsl-ops-r43a-20260927-001"
WRITE = "write-lease-f18-wsl-ops-r43a-20260927-001"
EXECUTION_TOKEN = "f18-wsl-ops-execution-fence-epoch-27-955102978eb5c687"
WRITE_TOKEN = "f18-wsl-ops-write-fence-epoch-27-955102978eb5c687"
PLAN = "docs/work_orders/F-18_WSL_OPS_R43_OIDC_FORMAL_HOST_PLAN.md"
WI = "docs/work_orders/F-18_WSL_OPS_R43A_OIDC_FORMAL_HOST_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-18_WSL_OPS_R43A_OIDC_FORMAL_HOST_INVOCATION.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r43a.json"
MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R43A_START_MANIFEST.json"
SELF = "scripts/f18_wsl_ops_r43a_overlay.py"
TEST = "tests/tooling/test_f18_wsl_ops_r43a_overlay.py"


def write_paths():
    return sorted(("deploy/wsl/compose.f18.oidc.yml", "deploy/wsl/nginx-f18-oidc.conf",
                   "tests/deploy/test_f18_oidc_formal_host_contract.py",
                   "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def control_paths():
    return sorted(set(previous.control_paths()) | {PLAN, WI, INVOCATION, DIGEST, MANIFEST, SELF, TEST})


def evidence_paths():
    return set(previous.evidence_paths()) | {
        "docs/WORK_STATUS.md", "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST, SELF, "scripts/check_project_progress.py"}


def _historical(root):
    return (json.loads(_run(root, "show", f"{PREDECESSOR}:docs/progress/build-progress.json")),
            json.loads(_run(root, "show", f"{PREDECESSOR}:docs/progress/progress-events.json"))["events"])


def _lease(kind, at, expires, qa):
    row = {"lease_id": WORKER if kind == "worker" else WRITE,
           "actor_id": ACTOR, "subject_ref": "F-18/WSL_OPS_R43A_OIDC_FORMAL_HOST",
           "status": "ACTIVE", "issued_at": at, "expires_at": expires,
           "lease_epoch": 27, "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
           "execution_fencing_token": EXECUTION_TOKEN,
           "baseline_git_commit": qa, "dispatch_head": qa, "path_scope": write_paths()}
    if kind == "write":
        row.update({"worker_lease_id": WORKER, "write_epoch": 27,
                    "write_fencing_token": WRITE_TOKEN})
    return row


def collect_git(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    qa = progress.get("repository", {}).get("control_qa_head", "")
    head = _run(root, "rev-parse", "HEAD")
    changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines()))
    prior_changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{PREDECESSOR}").splitlines()))
    old_product = prior_changed - set(previous.control_paths())
    errors = validate_start_git_facts(
        branch=_run(root, "branch", "--show-current"),
        upstream=_run(root, "rev-parse", "--abbrev-ref", "@{upstream}"),
        head=head, remote_head=_run(root, "rev-parse", f"development/{BRANCH}"),
        staged=set(filter(None, _run(root, "diff", "--cached", "--name-only").splitlines())),
        dirty=set(filter(None, _run(root, "status", "--porcelain=v1", "--untracked-files=all").splitlines())),
        changed=changed, base_is_ancestor=_is_ancestor(root, BASE, head), expected_branch=BRANCH,
        required_control_paths=control_paths(),
        allowed_product_paths=sorted(old_product | set(write_paths())), require_clean_feature=True)
    if _run(root, "rev-parse", "development/main") != BASE:
        errors.append("F18_R43A_MAIN_DRIFT")
    if not qa or not _is_ancestor(root, PREDECESSOR, qa) or not _is_ancestor(root, qa, head):
        errors.append("F18_R43A_QA_HEAD_INVALID")
    elif set(filter(None, _run(root, "diff", "--name-only", f"{qa}..{head}").splitlines())) - (
            evidence_paths() | set(write_paths())):
        errors.append("F18_R43A_POST_QA_SCOPE_INVALID")
    return sorted(set(errors))


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    old_progress, old_events = _historical(root)
    rows = ledger.get("events", [])
    repo = progress.get("repository") or {}
    worker, write = progress.get("worker_lease") or {}, progress.get("write_lease") or {}
    qa = repo.get("control_qa_head", "")
    instruction = progress.get("active_work_instruction") or {}
    errors = []
    if (old_progress.get("event_sequence") != 1643 or old_progress.get("worker_lease") is not None
            or old_progress.get("write_lease") is not None
            or old_progress.get("repository", {}).get("projection_mode") != previous.MODE
            or rows[:1643] != old_events):
        errors.append("F18_R43A_PREDECESSOR_INVALID")
    if (progress.get("event_sequence") != 1646 or progress.get("status") != "ACTIVE"
            or progress.get("current_work_package") != "F-18"
            or progress.get("f18_overall_status") != "IN_PROGRESS_WSL_OPS"
            or progress.get("active_agent") != ACTOR
            or progress.get("next_work_package") != {"package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
            or repo.get("projection_mode") != MODE or repo.get("branch") != BRANCH
            or repo.get("validated_base_commit") != BASE
            or repo.get("exact_allowed_paths") != control_paths()
            or repo.get("product_write_scope") != write_paths()
            or progress.get("scope_revision_binding", {}).get("approval_id") != "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"
            or progress.get("scope_revision_binding", {}).get("production") != "NOT_EXECUTED"
            or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"):
        errors.append("F18_R43A_STATE_INVALID")
    for lease, lease_id, token in ((worker, WORKER, EXECUTION_TOKEN), (write, WRITE, WRITE_TOKEN)):
        if (lease.get("lease_id") != lease_id or lease.get("actor_id") != ACTOR
                or lease.get("status") != "ACTIVE" or lease.get("execution_fencing_token") != EXECUTION_TOKEN
                or lease.get("fencing_token") != token or lease.get("path_scope") != write_paths()
                or not _valid_active_lease(lease, 27, datetime.now(timezone.utc), qa)):
            errors.append("F18_R43A_LEASE_INVALID")
    if (write.get("worker_lease_id") != WORKER or write.get("write_fencing_token") != WRITE_TOKEN
            or worker.get("issued_at") != write.get("issued_at")
            or worker.get("expires_at") != write.get("expires_at")):
        errors.append("F18_R43A_LEASE_LINK_INVALID")
    if (instruction.get("path") != WI or instruction.get("sha256") != _sha((root / WI).read_bytes())
            or instruction.get("invocation_path") != INVOCATION
            or instruction.get("invocation_sha256") != _sha((root / INVOCATION).read_bytes())
            or instruction.get("parent_approval_id") != "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"
            or instruction.get("revision_classification") != "MAIN_RECONFIRMED_NON_SEMANTIC"):
        errors.append("F18_R43A_INSTRUCTION_INVALID")
    if len(rows) != 1646 or ledger.get("last_sequence") != 1646 or rows[-1].get("event_id") != progress.get("last_event_id"):
        errors.append("F18_R43A_EVENTS_INVALID")
    else:
        for index, kind in enumerate(("WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED"), 1643):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("event_type") != kind
                    or row.get("previous_event_sha256") != _sha(_canonical(rows[index - 1]))):
                errors.append("F18_R43A_EVENT_CHAIN_INVALID")
    event_raw = (root / "docs/progress/progress-events.json").read_bytes()
    if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(event_raw):
        errors.append("F18_R43A_EVENT_HASH_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("F18_R43A_SNAPSHOT_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest.get(key, {}).get("bytes"), digest.get(key, {}).get("file_sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_R43A_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    raw_scope = set(control_paths()) - {"docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}
    if (manifest.get("event_sequence") != 1646 or manifest.get("projection_mode") != MODE
            or manifest.get("validated_base_commit") != BASE or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != write_paths() or manifest.get("accepted") is not False
            or manifest.get("production") != "NOT_EXECUTED"
            or {item.get("path") for item in manifest.get("raw_checksums", [])} != raw_scope):
        errors.append("F18_R43A_MANIFEST_INVALID")
    for item in manifest.get("raw_checksums", []):
        raw = (root / item["path"]).read_bytes()
        if (item.get("bytes"), item.get("sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_R43A_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    old_progress, old_events = _historical(root)
    if (progress != old_progress or ledger.get("events") != old_events
            or ledger.get("last_sequence") != 1643 or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None):
        raise RuntimeError("F18_R43A_PREDECESSOR_INVALID")
    head = _run(root, "rev-parse", "HEAD")
    if (_run(root, "branch", "--show-current") != BRANCH
            or _run(root, "rev-parse", f"development/{BRANCH}") != head
            or _run(root, "rev-parse", "development/main") != BASE
            or not _is_ancestor(root, PREDECESSOR, head)
            or _run(root, "status", "--porcelain=v1", "--untracked-files=all")):
        raise RuntimeError("F18_R43A_GIT_INVALID")
    qa = head
    at_dt = datetime.now(timezone(timedelta(hours=9)))
    at, expires = at_dt.isoformat(timespec="seconds"), (at_dt + timedelta(hours=12)).isoformat(timespec="seconds")
    wi_sha, invocation_sha = _sha((root / WI).read_bytes()), _sha((root / INVOCATION).read_bytes())
    rows, old_id = ledger["events"], progress["last_event_id"]
    _event(rows, "WORK_INSTRUCTION_ISSUED", {"path": WI, "sha256": wi_sha,
        "invocation_path": INVOCATION, "invocation_sha256": invocation_sha,
        "control_qa_head": qa}, at=at, step="WSL_OPS_R43A_OIDC_FORMAL_HOST")
    _event(rows, "WORKER_LEASE_ISSUED", {"lease_id": WORKER, "actor_id": ACTOR,
        "execution_fencing_token": EXECUTION_TOKEN}, at=at, step="WSL_OPS_R43A_OIDC_FORMAL_HOST")
    last = _event(rows, "WRITE_LEASE_ISSUED", {"lease_id": WRITE, "worker_lease_id": WORKER,
        "write_fencing_token": WRITE_TOKEN, "path_scope": write_paths()},
        at=at, step="WSL_OPS_R43A_OIDC_FORMAL_HOST")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(), old_id, 1643, rows[-3:])
    progress.update({"snapshot_id": "snapshot-f18-wsl-ops-r43a-seq1646", "event_sequence": 1646,
        "last_event_id": last["event_id"], "updated_at": at, "recorded_at": at,
        "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": _lease("worker", at, expires, qa), "write_lease": _lease("write", at, expires, qa),
        "active_work_instruction": {"artifact_id": "WI-F-18-WSL-OPS-R43A-20260927-001",
            "path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha, "revision_classification": "MAIN_RECONFIRMED_NON_SEMANTIC",
            "parent_approval_id": "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001",
            "assigned_verification_ids": ["AV-OPS-013", "AV-OPS-016", "AV-OPS-020", "AV-OPS-021"],
            "verification_scope": "WSL_OPS_OIDC_FORMAL_HOST_R43A_STATIC_ONLY"},
        "next_safe_action": "DEVELOPER_IMPLEMENT_F18_OIDC_FORMAL_HOST_R43A_EXACT4",
        "runtime_next_action": "DEVELOPER_IMPLEMENT_F18_OIDC_FORMAL_HOST_R43A_EXACT4"})
    progress["repository"].update({"branch": BRANCH, "upstream": f"development/{BRANCH}",
        "local_head": BASE, "remote_head": qa, "control_qa_head": qa,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": write_paths(), "projection_mode": MODE,
        "worktree_status": "F18_WSL_OPS_R43A_OIDC_FORMAL_HOST_ACTIVE",
        "commit_status": "PENDING", "push_status": "PENDING"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 WSL R43A OIDC formal host static contract active\n\n```json anvil-recovery-summary\n" +
        _pretty({key: deepcopy(progress.get(key)) for key in (
            "event_sequence", "last_event_id", "status", "current_phase", "current_work_package",
            "active_agent", "worker_lease", "write_lease", "next_work_package",
            "next_safe_action", "runtime_next_action")}) + b"```\n\n"
        b"- R43A exact4 static host contract only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1646, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw), "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw), "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0", "package_id": "F-18",
        "event_sequence": 1646, "accepted": False, "projection_mode": MODE,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": write_paths(), "raw_checksums": checksums,
        "self_reference": False, "production": "NOT_EXECUTED"}))
