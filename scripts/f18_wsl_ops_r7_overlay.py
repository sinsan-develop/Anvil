"""Fail-closed F-18 R7 ID Token writer transition from R6 closeout."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from scripts.wsl_scope_overlay import _is_ancestor, _run
    from scripts import f18_wsl_ops_r6_close_overlay as r6
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha, validate_start_git_facts
    from wsl_scope_overlay import _is_ancestor, _run
    import f18_wsl_ops_r6_close_overlay as r6

BASE = r6.BASE
BRANCH = r6.BRANCH
MODE = "F18_WSL_OPS_R7_ID_TOKEN_START"
R6_HEAD = "dd12b4566204b447339da137b175b7fb0a902f73"
R6_QA = "efb6ce5518c61e976bab2210e4b077280669d0d7"
ACTOR = "developer-primary-f18-wsl-ops-r7-id-token"
WORKER = "worker-lease-f18-wsl-ops-r7-20260925-001"
WRITE = "write-lease-f18-wsl-ops-r7-20260925-001"
EXECUTION_TOKEN = "f18-wsl-ops-execution-fence-epoch-5-69247977e4e51781"
WRITE_TOKEN = "f18-wsl-ops-write-fence-epoch-5-69247977e4e51781"
PLAN = "docs/work_orders/F-18_WSL_OPS_R7_ID_TOKEN_PLAN.md"
WI = "docs/work_orders/F-18_WSL_OPS_R7_ID_TOKEN_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-18_WSL_OPS_R7_ID_TOKEN_INVOCATION.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r7.json"
MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R7_START_MANIFEST.json"
SELF = "scripts/f18_wsl_ops_r7_overlay.py"


def write_paths():
    return sorted(("packages/api/oidc_identity.py", "tests/api/test_oidc_identity.py",
                   "pyproject.toml", "uv.lock", "deploy/wsl/requirements-runtime.txt",
                   "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def all_product_paths():
    return sorted(set(r6.r6.all_product_paths()) | set(write_paths()))


def control_paths():
    return sorted(set(r6.control_paths()) | {PLAN, WI, INVOCATION, DIGEST, MANIFEST, SELF,
                   "tests/tooling/test_f18_wsl_ops_r7_overlay.py"})


def evidence_paths():
    return {"docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json", "docs/progress/progress-events.json",
            DIGEST, MANIFEST}


def validate_predecessor_ancestry(root, qa_head):
    return [] if (_is_ancestor(root, R6_HEAD, qa_head)
                  and _is_ancestor(root, R6_QA, R6_HEAD)) else [
                      "F18_WSL_OPS_R7_PREDECESSOR_ANCESTRY_INVALID"]


def validate_state(progress, wi_sha, invocation_sha, qa_head):
    repo = progress.get("repository") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    scope = progress.get("scope_revision_binding") or {}
    now = datetime.now(timezone.utc)
    valid_lease = r6.r6.r5.r4.r3.r2._valid_active_lease
    good = (
        progress.get("event_sequence") == 1536
        and progress.get("status") == "ACTIVE"
        and progress.get("current_work_package") == "F-18"
        and progress.get("f18_overall_status") == "IN_PROGRESS_WSL_OPS"
        and progress.get("active_agent") == ACTOR
        and progress.get("next_work_package") == {"package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
        and repo.get("projection_mode") == MODE
        and repo.get("validated_base_commit") == BASE
        and repo.get("branch") == BRANCH
        and repo.get("control_qa_head") == qa_head
        and repo.get("exact_allowed_paths") == control_paths()
        and repo.get("product_write_scope") == write_paths()
        and worker.get("lease_id") == WORKER
        and worker.get("actor_id") == ACTOR
        and worker.get("status") == "ACTIVE"
        and worker.get("execution_fencing_token") == EXECUTION_TOKEN
        and worker.get("path_scope") == write_paths()
        and valid_lease(worker, 5, now, qa_head)
        and write.get("lease_id") == WRITE
        and write.get("actor_id") == ACTOR
        and write.get("status") == "ACTIVE"
        and write.get("worker_lease_id") == WORKER
        and write.get("execution_fencing_token") == EXECUTION_TOKEN
        and write.get("write_fencing_token") == WRITE_TOKEN
        and write.get("path_scope") == write_paths()
        and write.get("write_epoch") == 5
        and valid_lease(write, 5, now, qa_head)
        and worker.get("issued_at") == write.get("issued_at")
        and worker.get("expires_at") == write.get("expires_at")
        and instruction.get("path") == WI
        and instruction.get("sha256") == wi_sha
        and instruction.get("invocation_path") == INVOCATION
        and instruction.get("invocation_sha256") == invocation_sha
        and scope.get("approval_id") == r6.r6.APPROVAL_ID
        and scope.get("production") == "NOT_EXECUTED"
        and scope.get("release_decision") == "DEFER")
    return [] if good else ["F18_WSL_OPS_R7_STATE_INVALID"]


def _historical(root):
    return (json.loads(_run(root, "show", f"{R6_HEAD}:docs/progress/build-progress.json")),
            json.loads(_run(root, "show", f"{R6_HEAD}:docs/progress/progress-events.json"))["events"])


def collect_git(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    head, qa = _run(root, "rev-parse", "HEAD"), r6.r6.r5.r4.git_added_commit(root, SELF)
    changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines()))
    errors = validate_start_git_facts(
        branch=_run(root, "branch", "--show-current"),
        upstream=_run(root, "rev-parse", "--abbrev-ref", "@{upstream}"),
        head=head, remote_head=_run(root, "rev-parse", f"development/{BRANCH}"),
        staged=set(filter(None, _run(root, "diff", "--cached", "--name-only").splitlines())),
        dirty=r6.r6.r5.r4._porcelain(root), changed=changed,
        base_is_ancestor=_is_ancestor(root, BASE, head), expected_branch=BRANCH,
        required_control_paths=control_paths(), allowed_product_paths=all_product_paths(),
        require_clean_feature=True)
    if _run(root, "rev-parse", "development/main") != BASE:
        errors.append("F18_WSL_OPS_R7_MAIN_DRIFT")
    if not (qa and progress.get("repository", {}).get("control_qa_head") == qa
            and not validate_predecessor_ancestry(root, qa)
            and _is_ancestor(root, qa, head)):
        errors.append("F18_WSL_OPS_R7_QA_HEAD_INVALID")
    else:
        post_qa = set(filter(None, _run(root, "diff", "--name-only", f"{qa}..{head}").splitlines()))
        if post_qa - (evidence_paths() | set(write_paths())):
            errors.append("F18_WSL_OPS_R7_POST_QA_SCOPE_INVALID")
    return sorted(set(errors))


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    qa = r6.r6.r5.r4.git_added_commit(root, SELF)
    wi_sha, invocation_sha = _sha((root / WI).read_bytes()), _sha((root / INVOCATION).read_bytes())
    errors = validate_state(progress, wi_sha, invocation_sha, qa)
    rows, (old_progress, old_events) = ledger.get("events", []), _historical(root)
    if r6.validate_state(old_progress, R6_QA) or rows[:1533] != old_events:
        errors.append("F18_WSL_OPS_R7_HISTORY_INVALID")
    if len(rows) != 1536 or ledger.get("last_sequence") != 1536 or rows[-1].get("event_id") != progress.get("last_event_id"):
        errors.append("F18_WSL_OPS_R7_EVENT_INVALID")
    else:
        kinds = ("WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED")
        for index, kind in enumerate(kinds, 1533):
            row = rows[index]
            if (row.get("sequence") != index + 1 or row.get("event_type") != kind
                    or row.get("actor_id") != "main-agent-eoul"
                    or row.get("event_id") != f"evt_f18_local_{index + 1}_{kind.lower()}"
                    or row.get("previous_event_sha256") != _sha(_canonical(rows[index - 1]))):
                errors.append("F18_WSL_OPS_R7_TRANSITION_INVALID")
        issued, worker, write = (row.get("details") or {} for row in rows[-3:])
        if (issued != {"path": WI, "sha256": wi_sha,
                       "invocation_path": INVOCATION, "invocation_sha256": invocation_sha,
                       "control_qa_head": qa}
                or worker.get("lease_id") != WORKER or worker.get("actor_id") != ACTOR
                or worker.get("execution_fencing_token") != EXECUTION_TOKEN
                or write.get("lease_id") != WRITE or write.get("worker_lease_id") != WORKER
                or write.get("write_fencing_token") != WRITE_TOKEN
                or write.get("path_scope") != write_paths()):
            errors.append("F18_WSL_OPS_R7_LEASE_EVENT_INVALID")
    if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(
            (root / "docs/progress/progress-events.json").read_bytes()):
        errors.append("F18_WSL_OPS_R7_EVENT_HASH_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("F18_WSL_OPS_R7_SNAPSHOT_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest.get(key, {}).get("bytes"), digest.get(key, {}).get("file_sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_R7_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    raw_scope = set(control_paths()) - {"docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}
    if (manifest.get("event_sequence") != 1536 or manifest.get("projection_mode") != MODE
            or manifest.get("validated_base_commit") != BASE
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != write_paths()
            or manifest.get("accepted") is not False or manifest.get("production") != "NOT_EXECUTED"
            or {row.get("path") for row in manifest.get("raw_checksums", [])} != raw_scope):
        errors.append("F18_WSL_OPS_R7_MANIFEST_INVALID")
    for item in manifest.get("raw_checksums", []):
        raw = (root / item["path"]).read_bytes()
        if (item.get("bytes"), item.get("sha256")) != (len(raw), _sha(raw)):
            errors.append("F18_WSL_OPS_R7_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def _lease(kind, at, expires, qa):
    row = {"lease_id": WORKER if kind == "worker" else WRITE,
           "actor_id": ACTOR, "subject_ref": "F-18/WSL_OPS_R7_ID_TOKEN", "status": "ACTIVE",
           "issued_at": at, "expires_at": expires, "lease_epoch": 5,
           "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
           "execution_fencing_token": EXECUTION_TOKEN,
           "baseline_git_commit": qa, "dispatch_head": qa, "path_scope": write_paths()}
    if kind == "write":
        row.update({"worker_lease_id": WORKER, "write_epoch": 5, "write_fencing_token": WRITE_TOKEN})
    return row


def materialize(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    old_progress, old_events = _historical(root)
    if (progress != old_progress or ledger.get("events") != old_events
            or progress.get("event_sequence") != 1533 or ledger.get("last_sequence") != 1533
            or r6.validate_state(progress, R6_QA)):
        raise RuntimeError("F18_WSL_OPS_R7_PREDECESSOR_INVALID")
    head = _run(root, "rev-parse", "HEAD")
    if (_run(root, "branch", "--show-current") != BRANCH
            or _run(root, "rev-parse", "development/main") != BASE
            or _run(root, "rev-parse", f"development/{BRANCH}") != head
            or r6.r6.r5.r4.git_added_commit(root, SELF) != head
            or validate_predecessor_ancestry(root, head)
            or r6.r6.r5.r4._porcelain(root) - evidence_paths()):
        raise RuntimeError("F18_WSL_OPS_R7_GIT_INVALID")
    at_dt = datetime.now(timezone(timedelta(hours=9)))
    at, expires = at_dt.isoformat(timespec="seconds"), (at_dt + timedelta(hours=12)).isoformat(timespec="seconds")
    wi_sha, invocation_sha = _sha((root / WI).read_bytes()), _sha((root / INVOCATION).read_bytes())
    rows, old_id = ledger["events"], progress["last_event_id"]
    _event(rows, "WORK_INSTRUCTION_ISSUED", {"path": WI, "sha256": wi_sha,
        "invocation_path": INVOCATION, "invocation_sha256": invocation_sha,
        "control_qa_head": head}, at=at, step="WSL_OPS_R7_ID_TOKEN")
    _event(rows, "WORKER_LEASE_ISSUED", {"lease_id": WORKER, "actor_id": ACTOR,
        "execution_fencing_token": EXECUTION_TOKEN}, at=at, step="WSL_OPS_R7_ID_TOKEN")
    last = _event(rows, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
        "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
        "path_scope": write_paths()}, at=at, step="WSL_OPS_R7_ID_TOKEN")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1533, rows[-3:])
    progress.update({"snapshot_id": "snapshot-f18-wsl-ops-r7-seq1536",
        "event_sequence": 1536, "last_event_id": last["event_id"],
        "updated_at": at, "recorded_at": at, "status": "ACTIVE",
        "active_agent": ACTOR, "worker_lease": _lease("worker", at, expires, head),
        "write_lease": _lease("write", at, expires, head),
        "active_work_instruction": {"artifact_id": "WI-F-18-WSL-OPS-R7-20260925-001",
            "path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
            "assigned_verification_ids": ["AV-OPS-013", "AV-OPS-016", "AV-OPS-020", "AV-OPS-021"],
            "verification_scope": "WSL_OPS_ID_TOKEN_R7_ONLY"},
        "next_safe_action": "DEVELOPER_BUILD_F18_OIDC_ID_TOKEN_EXACT6",
        "runtime_next_action": "DEVELOPER_BUILD_F18_OIDC_ID_TOKEN_EXACT6"})
    progress["repository"].update({"branch": BRANCH, "upstream": f"development/{BRANCH}",
        "local_head": BASE, "remote_head": head, "control_qa_head": head,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": write_paths(), "projection_mode": MODE,
        "worktree_status": "F18_WSL_OPS_R7_ID_TOKEN_ACTIVE",
        "commit_status": "PENDING", "push_status": "PENDING"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-18 WSL R7 ID Token verifier writer start\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n\n"
                   b"- R7 exact6 verifier only; F-18 accepted=false; Production NOT_EXECUTED; F-19 blocked.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1536, "self_reference": False,
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
        "package_id": "F-18", "event_sequence": 1536, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": write_paths(),
        "raw_checksums": checksums, "self_reference": False,
        "production": "NOT_EXECUTED"}))
