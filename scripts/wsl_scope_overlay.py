"""Fail-closed G-05 projection for the owner-directed Local/WSL scope revision."""

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
except ModuleNotFoundError:  # direct check_project_progress.py invocation
    from f18_progress_overlay import (
        _append_events_raw, _canonical, _event, _pretty, _sha,
        parse_git_porcelain_paths, validate_start_git_facts,
    )

BASE = "c2c62cd011f47db8cbd524f97b3dae494a5672b5"
BRANCH = "codex/wsl-operational-scope-plan"
MODE = "F18_F20_LOCAL_WSL_SCOPE_REVISION"
APPROVAL = "docs/approvals/APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001.md"
APPROVAL_ID = "APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"
DIGEST = "docs/progress/progress-handoff-detached-digest-wsl-scope.json"
MANIFEST = "docs/evidence/manifests/WSL_SCOPE_REVISION_MANIFEST.json"
REPORT = "docs/04_test_reports/WSL_OPERATIONAL_SCOPE_REVISION_REPORT.md"
AUTHORITY = (
    "Anvil_설계서_v2.md", "Anvil_작업계획서_v1.md",
    "Anvil_통합검증매트릭스_v1.md", "Anvil_테스트계획서_v1.md",
)


def control_paths():
    return sorted({
        *AUTHORITY, "AGENTS.md", "docs/DEVELOPMENT_ENVIRONMENT.md",
        "docs/governance/ANVIL_OPERATING_RULES.md", APPROVAL, REPORT,
        "docs/WORK_STATUS.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json", "docs/progress/BUILD_HANDOFF.md",
        DIGEST, MANIFEST, "scripts/check_project_progress.py",
        "scripts/wsl_scope_overlay.py", "tests/tooling/test_wsl_scope_overlay.py",
    })


def evidence_paths():
    return {REPORT, "docs/WORK_STATUS.md", "docs/progress/build-progress.json",
            "docs/progress/progress-events.json", "docs/progress/BUILD_HANDOFF.md",
            DIGEST, MANIFEST}


def validate_git_facts(**facts):
    return validate_start_git_facts(
        **facts, expected_branch=BRANCH, required_control_paths=control_paths(),
        allowed_product_paths=[], post_qa_allowed_paths=evidence_paths(),
        allow_merged_main=True, require_clean_feature=True,
        require_qa_binding=True)


def validate_state(progress, hashes, approval_sha):
    repo = progress.get("repository") or {}
    binding = progress.get("scope_revision_binding") or {}
    approval = progress.get("root_human_approval_binding") or {}
    good = (
        repo.get("projection_mode") == MODE
        and repo.get("validated_base_commit") == BASE
        and repo.get("branch") == BRANCH
        and repo.get("exact_allowed_paths") == control_paths()
        and repo.get("product_write_scope") == []
        and progress.get("event_sequence") == 1512
        and progress.get("status") == "PAUSED"
        and progress.get("current_work_package") == "F-18"
        and progress.get("f18_overall_status") == "PARTIAL_LOCAL_WSL_VERIFIED"
        and progress.get("next_work_package") == {
            "package_id": "F-19", "status": "BLOCKED_PENDING_F18_ACCEPTANCE"}
        and progress.get("active_agent") is None
        and progress.get("worker_lease") is None
        and progress.get("write_lease") is None
        and progress.get("plan_version") == "1.7"
        and progress.get("work_plan_hash") == hashes["Anvil_작업계획서_v1.md"]
        and progress.get("design_baseline_hash") == hashes["Anvil_설계서_v2.md"]
        and binding.get("artifact_sha256") == hashes
        and binding.get("production") == "NOT_EXECUTED"
        and binding.get("release_decision") == "DEFER"
        and approval.get("approval_id") == APPROVAL_ID
        and approval.get("path") == APPROVAL
        and approval.get("sha256") == approval_sha
    )
    return [] if good else ["WSL_SCOPE_STATE_INVALID"]


def _run(root, *args):
    return subprocess.check_output(
        ["git", "-c", "core.excludesFile=", *args], cwd=root, text=True).strip()


def _is_ancestor(root, before, after):
    return subprocess.run(["git", "merge-base", "--is-ancestor", before, after],
                          cwd=root, capture_output=True).returncode == 0


def collect_git(root):
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    branch = _run(root, "branch", "--show-current")
    head = _run(root, "rev-parse", "HEAD")
    upstream = _run(root, "rev-parse", "--abbrev-ref", "@{upstream}")
    remote = "development/main" if branch == "main" else f"development/{BRANCH}"
    remote_head = _run(root, "rev-parse", remote)
    changed = set(filter(None, _run(root, "diff", "--name-only", f"{BASE}..{head}").splitlines()))
    staged = set(filter(None, _run(root, "diff", "--cached", "--name-only").splitlines()))
    status = subprocess.check_output(
        ["git", "-c", "core.excludesFile=", "status", "--porcelain=v1",
         "--untracked-files=all"], cwd=root, text=True)
    dirty = parse_git_porcelain_paths(status)
    parents = tuple(_run(root, "rev-list", "--parents", "-n", "1", "HEAD").split()[1:])
    two_parent = len(parents) == 2
    feature_head = parents[1] if branch == "main" and two_parent else head
    qa = progress.get("repository", {}).get("local_wsl_qa_head")
    qa_bound = (
        isinstance(qa, str) and re.fullmatch(r"[0-9a-f]{40}", qa) is not None
        and _is_ancestor(root, BASE, qa) and _is_ancestor(root, qa, feature_head)
    )
    post_qa = (set(filter(None, _run(root, "diff", "--name-only",
                                      f"{qa}..{head}").splitlines())) if qa_bound else set())
    return validate_git_facts(
        branch=branch, upstream=upstream, head=head, remote_head=remote_head,
        staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=_is_ancestor(root, BASE, head), parents=parents,
        first_parent_contains_base=two_parent and _is_ancestor(root, BASE, parents[0]),
        first_parent_is_base=two_parent and parents[0] == BASE,
        merge_tree_matches_feature=two_parent and
            _run(root, "rev-parse", "HEAD^{tree}") ==
            _run(root, "rev-parse", f"{parents[1]}^{{tree}}"),
        feature_contains_checkpoint=two_parent and _is_ancestor(root, BASE, parents[1]),
        qa_head_bound=qa_bound, post_qa_changed=post_qa)


def current_hashes(root):
    return {relative: _sha((Path(root) / relative).read_bytes()) for relative in AUTHORITY}


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    hashes = current_hashes(root)
    approval_sha = _sha((root / APPROVAL).read_bytes())
    errors = validate_state(progress, hashes, approval_sha)
    if (ledger.get("last_sequence") != 1512 or
            ledger["events"][-1]["event_id"] != progress.get("last_event_id") or
            ledger["events"][-1].get("previous_event_sha256") !=
            _sha(_canonical(ledger["events"][-2]))):
        errors.append("WSL_SCOPE_EVENT_INVALID")
    if progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(
            (root / "docs/progress/progress-events.json").read_bytes()):
        errors.append("WSL_SCOPE_EVENT_HASH_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("WSL_SCOPE_SNAPSHOT_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest.get(key, {}).get("bytes"), digest.get(key, {}).get("file_sha256")) != (
                len(raw), _sha(raw)):
            errors.append("WSL_SCOPE_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("event_sequence") != 1512 or manifest.get("projection_mode") != MODE
            or manifest.get("validated_base_commit") != BASE
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("accepted") is not False
            or manifest.get("production") != "NOT_EXECUTED"):
        errors.append("WSL_SCOPE_MANIFEST_INVALID")
    expected_checksums = set(control_paths()) - {
        "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST}
    if {row.get("path") for row in manifest.get("raw_checksums", [])} != expected_checksums:
        errors.append("WSL_SCOPE_CHECKSUM_SCOPE_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (row.get("bytes"), row.get("sha256")) != (len(raw), _sha(raw)):
            errors.append("WSL_SCOPE_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root, qa_head):
    """Record exact WSL code QA; afterwards only evidence files may change."""
    root = Path(root)
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    ledger = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1511 or ledger.get("last_sequence") != 1511
            or progress.get("status") != "PAUSED"
            or progress.get("f18_overall_status") != "PARTIAL_LOCAL_WSL_VERIFIED"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None):
        raise RuntimeError("WSL_SCOPE_PREDECESSOR_INVALID")
    head = _run(root, "rev-parse", "HEAD")
    if (_run(root, "branch", "--show-current") != BRANCH
            or _run(root, "rev-parse", "development/main") != BASE
            or _run(root, "rev-parse", f"development/{BRANCH}") != head
            or not re.fullmatch(r"[0-9a-f]{40}", qa_head)
            or not _is_ancestor(root, BASE, qa_head)
            or not _is_ancestor(root, qa_head, head)
            or set(filter(None, _run(root, "diff", "--name-only",
                                          f"{qa_head}..{head}").splitlines())) - evidence_paths()
            or set(filter(None, _run(root, "diff", "--name-only",
                                          f"{BASE}..{head}").splitlines())) - set(control_paths())):
        raise RuntimeError("WSL_SCOPE_GIT_INVALID")
    status = subprocess.check_output(
        ["git", "-c", "core.excludesFile=", "status", "--porcelain=v1",
         "--untracked-files=all"], cwd=root, text=True)
    dirty = parse_git_porcelain_paths(status)
    if not dirty or dirty - evidence_paths():
        raise RuntimeError("WSL_SCOPE_EVIDENCE_DIRTY_INVALID")
    hashes = current_hashes(root)
    approval_sha = _sha((root / APPROVAL).read_bytes())
    events = ledger["events"]
    old_id = progress["last_event_id"]
    at = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")
    last = _event(events, "HANDOFF_RECORDED", {
        "classification": "HUMAN_APPROVED_FUNCTION_SCOPE_AND_IMPORTANT_RISK_CHANGE",
        "approval_id": APPROVAL_ID, "qa_head": qa_head, "production": "NOT_EXECUTED",
        "release_decision": "DEFER", "artifact_sha256": hashes},
        at=at, step="WSL_OPERATIONAL_SCOPE_REVISION")
    event_raw = _append_events_raw((root / "docs/progress/progress-events.json").read_bytes(),
                                   old_id, 1511, events[-1:])
    progress.update({"snapshot_id": "snapshot-wsl-scope-revision-seq1512",
        "event_sequence": 1512, "last_event_id": last["event_id"],
        "updated_at": at, "recorded_at": at, "plan_version": "1.7",
        "work_plan_hash": hashes["Anvil_작업계획서_v1.md"],
        "design_baseline_hash": hashes["Anvil_설계서_v2.md"],
        "next_safe_action": "PREPARE_F18_WSL_OPS_WORK_INSTRUCTION",
        "runtime_next_action": "PREPARE_F18_WSL_OPS_WORK_INSTRUCTION"})
    progress["previous_root_human_approval_binding"] = deepcopy(
        progress["root_human_approval_binding"])
    progress["root_human_approval_binding"] = {
        "approval_id": APPROVAL_ID, "path": APPROVAL, "sha256": approval_sha,
        "approval_subject_hash": _sha(_canonical(hashes))}
    progress["scope_revision_binding"] = {
        "artifact_sha256": hashes, "approval_id": APPROVAL_ID,
        "production": "NOT_EXECUTED", "release_decision": "DEFER",
        "source_code_qa_head": qa_head}
    progress["repository"].update({
        "branch": BRANCH, "upstream": f"development/{BRANCH}",
        "local_head": BASE, "remote_head": head, "local_wsl_qa_head": qa_head,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": [], "projection_mode": MODE,
        "worktree_status": "WSL_SCOPE_REVISION_CHECKPOINT",
        "commit_status": "EVIDENCE_COMMIT_PENDING", "push_status": "EVIDENCE_PUSH_PENDING"})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# Local/WSL operational-scope revision; Production NOT_EXECUTED\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n\n"
                   b"- F-18 remains partial; F-19 remains blocked pending revised F-18 WSL acceptance.\n"
                   b"- Production/ysna-server NOT_EXECUTED; ReleaseDecision DEFER.\n")
    (root / "docs/progress/build-progress.json").write_bytes(progress_raw)
    (root / "docs/progress/progress-events.json").write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1512, "self_reference": False,
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
        "package_id": "F-18", "event_sequence": 1512, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": [],
        "raw_checksums": checksums, "self_reference": False,
        "production": "NOT_EXECUTED"}))
