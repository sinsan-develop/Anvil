"""F-17 bounded start projection for WSL PG15/PG18 live validation."""

from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import subprocess

BASE = "3460d9768b039568022fd43e24577cc0e2402dea"
FEATURE_PREDECESSOR = "183b1d5b82779dcd79d196185b699cfbb4cb9cf7"
BRANCH = "codex/f17-wsl-pg18-rc"
MODE = "F17_START_EXACT13_PRODUCT_EXACT5"
FINAL_MODE = "F17_FINAL_ACCEPTANCE_EXACT13_PRODUCT_EXACT5"
FINAL_SEQUENCE = 1491
PRODUCT_HEAD = "7083e2aa90ced5bb109fd268cf22e34de34ff6d9"
FINAL_AT = "2026-09-24T15:57:00+09:00"
AT = "2026-09-24T14:23:00+09:00"
EXPIRES = "2026-09-25T02:23:00+09:00"
ACTOR = "developer-primary-f17-r1"
WORKER = "worker-lease-f17-r1-20260924-001"
WRITE = "write-lease-f17-r1-20260924-001"
EXECUTION_TOKEN = "f17-r1-execution-fence-epoch-1-3460d9768b039568"
WRITE_TOKEN = "f17-r1-write-fence-epoch-1-022fd43e24577cc0"
WI = "docs/work_orders/F-17_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-17_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f17.json"
MANIFEST = "docs/evidence/manifests/F-17_PROGRESS_MANIFEST.json"
RC_MANIFEST = "docs/evidence/manifests/F-17_RC_EVIDENCE_MANIFEST.json"
WSL_REPORT = "docs/04_test_reports/F-17_WSL_TEST_REPORT.md"


def product_paths():
    return sorted(["deploy/wsl/f17_validation.py", "deploy/wsl/compose.f17.yml",
        "tests/deploy/test_f17_validation.py", "tests/integration/test_f17_runtime_e2e.py",
        "docs/04_test_reports/F-17_COMPLETION_REPORT.md"])


def control_paths():
    return sorted([WI, PROMPT, RC_MANIFEST, WSL_REPORT, "docs/WORK_STATUS.md",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json", DIGEST, MANIFEST,
        "scripts/f17_progress_overlay.py", "scripts/check_project_progress.py",
        "tests/tooling/test_f17_progress_overlay.py"])


def validate_changed_scope(changed):
    return set(control_paths()) <= set(changed) <= set(control_paths()) | set(product_paths())


def validate_start_git_facts(*, branch, upstream, head, remote_head, staged,
                             dirty, changed, base_is_ancestor, remote_is_ancestor):
    common = branch == BRANCH and upstream == f"development/{BRANCH}" and not staged
    pre = (head == BASE and remote_head == BASE and not changed
           and set(dirty) == set(control_paths()))
    post = (head != BASE and base_is_ancestor and validate_changed_scope(changed)
            and (remote_head in {BASE, head} or remote_is_ancestor)
            and set(dirty) <= set(product_paths()))
    return [] if common and (pre or post) else ["F17_START_GIT_INVALID"]


def validate_final_git_facts(*, branch, upstream, remote_head, head, staged,
                             dirty, changed, parents, base_is_ancestor,
                             first_parent_contains_base,
                             merge_tree_matches_feature):
    clean = (not staged and not dirty and base_is_ancestor
             and set(changed) == set(control_paths()) | set(product_paths()))
    feature = (branch == BRANCH and upstream == f"development/{BRANCH}"
               and remote_head == head and clean)
    merged = (branch == "main" and upstream == "development/main"
              and remote_head == head and len(parents) == 2
              and first_parent_contains_base and merge_tree_matches_feature
              and clean)
    return [] if feature or merged else ["F17_FINAL_GIT_INVALID"]


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)
            + "\n").encode("utf-8")


def _sha(raw):
    return sha256(raw).hexdigest().upper()


def _append(events, event_type, details, *, step="START", at=AT):
    sequence = events[-1]["sequence"] + 1
    event = {"sequence": sequence,
        "event_id": f"evt_f17_{sequence}_{event_type.lower()}",
        "event_type": event_type, "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul", "actor_type": "AGENT",
        "project_id": "anvil", "work_package_id": "F-17", "run_id": None,
        "step_id": step, "subject_ref": f"F-17/{step}", "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": _sha(_canonical(events[-1])), "details": details}
    events.append(event)
    return event


def _lease(kind):
    lease = {"lease_id": WORKER if kind == "worker" else WRITE,
        "actor_id": ACTOR, "subject_ref": "F-17", "status": "ACTIVE",
        "issued_at": AT, "expires_at": EXPIRES, "lease_epoch": 1,
        "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
        "execution_fencing_token": EXECUTION_TOKEN,
        "baseline_git_commit": BASE, "dispatch_head": BASE,
        "path_scope": product_paths()}
    if kind == "write":
        lease.update({"worker_lease_id": WORKER, "write_epoch": 1,
                      "write_fencing_token": WRITE_TOKEN})
    return lease


def collect_git(root):
    root = Path(root)

    def run(*args):
        return subprocess.check_output(["git", "-c", "core.excludesFile=", *args],
                                       cwd=root, text=True).strip()

    branch, head = run("branch", "--show-current"), run("rev-parse", "HEAD")
    upstream = run("rev-parse", "--abbrev-ref", "@{upstream}")
    mode = json.loads((root / "docs/progress/build-progress.json").read_text(
        encoding="utf-8"))["repository"]["projection_mode"]
    remote_head = run("rev-parse", "development/main" if branch == "main"
                      else f"development/{BRANCH}")
    staged = set(filter(None, run("diff", "--cached", "--name-only").splitlines()))
    changed = set(filter(None, run("diff", "--name-only", f"{BASE}..{head}").splitlines()))
    status = subprocess.check_output(["git", "-c", "core.excludesFile=", "status",
                                      "--porcelain=v1", "--untracked-files=all"],
                                     cwd=root, text=True)
    dirty = {line[3:].replace("\\", "/") for line in status.splitlines() if line}
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head],
                              cwd=root).returncode == 0
    if mode == FINAL_MODE:
        parents = run("show", "-s", "--format=%P", head).split()
        feature_paths = changed
        first_parent_contains_base = False
        tree_match = False
        if branch == "main" and len(parents) == 2:
            feature_paths = set(filter(None, run("diff", "--name-only",
                                                 f"{BASE}..{parents[1]}").splitlines()))
            first_parent_contains_base = subprocess.run(
                ["git", "merge-base", "--is-ancestor", BASE, parents[0]],
                cwd=root).returncode == 0
            tree_match = (run("rev-parse", f"{head}^{{tree}}")
                          == run("rev-parse", f"{parents[1]}^{{tree}}"))
        return validate_final_git_facts(branch=branch, upstream=upstream,
            remote_head=remote_head, head=head, staged=staged, dirty=dirty,
            changed=feature_paths, parents=parents, base_is_ancestor=ancestor,
            first_parent_contains_base=first_parent_contains_base,
            merge_tree_matches_feature=tree_match)
    remote_ancestor = subprocess.run(["git", "merge-base", "--is-ancestor",
                                     remote_head, head], cwd=root).returncode == 0
    return validate_start_git_facts(branch=branch, upstream=upstream, head=head,
        remote_head=remote_head, staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=ancestor, remote_is_ancestor=remote_ancestor)


def validate_final_contract(progress, ledger, manifest):
    final_events = [item.get("event_type") for item in ledger.get("events", [])[-5:]]
    expected_events = ["PACKAGE_COMPLETED", "INDEPENDENT_TEST_JUDGMENT_RECORDED",
                       "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED",
                       "MAIN_PACKAGE_ACCEPTED"]
    runtime = manifest.get("runtime_boundary", {})
    if (progress.get("repository", {}).get("projection_mode") != FINAL_MODE
            or progress.get("event_sequence") != FINAL_SEQUENCE
            or ledger.get("last_sequence") != FINAL_SEQUENCE
            or progress.get("current_work_package") != "F-17"
            or progress.get("status") != "ACCEPTED"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None
            or progress.get("active_agent") is not None
            or "F-17" not in progress.get("completed_packages", [])
            or final_events != expected_events
            or manifest.get("accepted") is not True
            or manifest.get("projection_mode") != FINAL_MODE
            or manifest.get("product_head") != PRODUCT_HEAD
            or runtime != {"shared_pg15": "PASS_F17_SCOPE",
                           "isolated_pg18": "PASS_F17_SCOPE",
                           "actual_e2e": "PASS_SAME_GIT_IMAGE",
                           "browser": "PASS_DASHBOARD_NETWORK_SCOPE",
                           "production": "NOT_EXECUTED"}):
        return ["F17_FINAL_STATE_INVALID"]
    return []


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    errors = []
    final = progress.get("repository", {}).get("projection_mode") == FINAL_MODE
    if not final and (progress.get("repository", {}).get("projection_mode") != MODE
            or progress.get("event_sequence") != 1486
            or ledger.get("last_sequence") != 1486
            or progress.get("current_work_package") != "F-17"
            or progress.get("status") != "ACTIVE"
            or progress.get("active_agent") != ACTOR
            or progress.get("worker_lease", {}).get("lease_id") != WORKER
            or progress.get("write_lease", {}).get("lease_id") != WRITE
            or progress.get("write_lease", {}).get("worker_lease_id") != WORKER
            or progress.get("write_lease", {}).get("path_scope") != product_paths()):
        errors.append("F17_START_STATE_INVALID")
    events = ledger["events"]
    for before, after in zip(events[-5:], events[-4:]):
        if after.get("previous_event_sha256") != _sha(_canonical(before)):
            errors.append("F17_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F17_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not final
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != product_paths()):
        errors.append("F17_MANIFEST_INVALID")
    if final:
        errors.extend(validate_final_contract(progress, ledger, manifest))
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (len(raw), _sha(raw)) != (row["bytes"], row["sha256"]):
            errors.append("F17_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root):
    root = Path(root)
    progress_path, event_path = (root / "docs/progress/build-progress.json",
                                 root / "docs/progress/progress-events.json")
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1482 or ledger.get("last_sequence") != 1482
            or progress.get("status") != "ACCEPTED"
            or progress.get("current_work_package") != "F-16"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None):
        raise RuntimeError("F17_BASE_PROGRESS_INVALID")
    if ledger["events"][-1]["event_id"] != progress["last_event_id"]:
        raise RuntimeError("F17_BASE_EVENT_INVALID")
    events = ledger["events"]
    _append(events, "F16_MERGED_MAIN_VERIFIED", {"merge_commit": BASE,
        "pull_request": "https://github.com/sinsan-develop/Anvil/pull/32",
        "feature_commit": FEATURE_PREDECESSOR, "feature_ancestor": True,
        "merge_tree_matches_feature": True, "merged_main_g05": "PASS_1482",
        "local_remote_branch_deleted": True, "git_worktree_removed": True})
    _append(events, "PACKAGE_STARTED", {"package_id": "F-17", "branch": BRANCH,
        "base_commit": BASE, "work_instruction": WI,
        "product_paths": product_paths()})
    _append(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER,
        "execution_fencing_token": EXECUTION_TOKEN, "actor_id": ACTOR})
    last = _append(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
        "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
        "path_scope": product_paths()})
    old_event_raw = subprocess.check_output(["git", "show",
        f"{BASE}:docs/progress/progress-events.json"], cwd=root)
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if old_event_raw.count(marker) != 1:
        raise RuntimeError("F17_BASE_EVENT_BYTES_INVALID")
    event_raw = old_event_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-4:])
        + marker.replace(old_id, last["event_id"].encode())
    ).replace(b'"last_sequence": 1482', b'"last_sequence": 1486', 1)
    wi_raw, prompt_raw = (root / WI).read_bytes(), (root / PROMPT).read_bytes()
    progress.update({"snapshot_id": "snapshot-f17-start-seq1486",
        "event_sequence": 1486, "last_event_id": last["event_id"],
        "updated_at": AT, "recorded_at": AT,
        "current_phase": "F", "current_work_package": "F-17", "status": "ACTIVE",
        "active_agent": ACTOR, "worker_lease": _lease("worker"),
        "write_lease": _lease("write"),
        "active_work_instruction": {"artifact_id": "WI-F-17-20260924-001",
            "path": WI, "sha256": _sha(wi_raw), "invocation_path": PROMPT,
            "invocation_sha256": _sha(prompt_raw),
            "assigned_verification_ids": ["AV-OPS-015", "AV-OPS-025"]},
        "repository": {"branch": BRANCH, "local_head": BASE,
            "upstream": f"development/{BRANCH}", "remote_head": BASE,
            "projection_mode": MODE, "validated_base_commit": BASE,
            "head_relation": "BASE_OR_FEATURE_DESCENDANT",
            "exact_allowed_paths": control_paths(),
            "product_write_scope": product_paths(), "worktree_status": "F17_ACTIVE",
            "commit_status": "PENDING", "push_status": "BRANCH_PUBLISHED"},
        "next_work_package": {"package_id": "F-18",
                              "status": "BLOCKED_PENDING_F17_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "F-18",
                                        "status": "BLOCKED_PENDING_F17_ACCEPTANCE"},
        "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F17_EXACT5",
        "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F17_EXACT5",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F17_APPROVED_SCOPE"], "stop_before_dialogue_report": False},
        "current_progress_evidence_ref": {"package_id": "F-17", "path": DIGEST,
                                          "manifest_path": MANIFEST}})
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-17 WSL PG15 integration and isolated PG18 RC start\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease",
                               "write_lease", "next_work_package", "next_safe_action",
                               "runtime_next_action")}) + b"```\n")
    previous_status = subprocess.check_output(["git", "show", f"{BASE}:docs/WORK_STATUS.md"],
                                              cwd=root)
    status_raw = ("# F-17 WSL 실제 기능·격리 PG18 RC 착수\n\n"
        "- 판정: `ACTIVE`. F-16 PR #32 merged main 3460d97, feature ancestry/tree·merged-main G-05 PASS, F-16 remote/local branch 및 worktree 삭제 확인. F-17 branch는 clean main에서 생성. 담당 Main 어울 통제, developer-primary-f17-r1 exact5 write lease, 정식 FAILURE_REPORT 0회.\n"
        "- F-17은 기존 local-postgres PG15의 전용 임시 Anvil DB/비-superuser role 일반 경로와 별도 PG18 격리 instance를 구분한다. 전역 bind/pg_hba/network나 기존 DB·role은 변경하지 않고 WSL host loopback/SSH tunnel만 쓴다. WSL 실제 자원은 생성 전 exact inventory·cleanup 방법을 기록한다.\n"
        "- F-14 과거 PG15/18 백업·복원 실측 및 F-16 staging/browser PASS를 F-17 새 exact Git/image E2E로 재사용하지 않는다. 현재 ProductValidation 공개 API는 501 미결선이므로 실제 API·DB 관측에 결박된 criterion별 검증 기록을 F-17 범위로 두며 API/DB 지속화 PASS는 주장하지 않는다.\n"
        "- 다음: G-05 start gate→Developer TDD exact5→Main 독립 검토→WSL PG15 일반/PG18 격리 동일 E2E·migration/backup/restore/rollback·브라우저/ProductValidation 실측→정확한 자원 정리. ysna/Production·사용자 인수 미실행.\n\n"
    ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "algorithm": "SHA-256", "event_sequence": 1486, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md",
            DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "package_id": "F-17", "event_sequence": 1486, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
        "raw_checksums": checksums, "self_reference": False,
        "runtime_boundary": {"shared_pg15": "NOT_EXECUTED",
            "isolated_pg18": "NOT_EXECUTED", "actual_e2e": "NOT_EXECUTED",
            "browser": "NOT_EXECUTED", "production": "NOT_EXECUTED"}}))


def finalize(root):
    """Record only the measured F17 PG15/PG18 scope, then release both leases."""
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    evidence = json.loads((root / RC_MANIFEST).read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1486 or ledger.get("last_sequence") != 1486
            or progress.get("status") != "ACTIVE"
            or progress.get("repository", {}).get("projection_mode") != MODE
            or progress.get("worker_lease", {}).get("lease_id") != WORKER
            or progress.get("write_lease", {}).get("lease_id") != WRITE
            or evidence.get("status") != "F17_SCOPED_PASS"
            or evidence.get("git_commit") != PRODUCT_HEAD
            or evidence.get("cleanup") != "PASS_ZERO_F17_TEMP_RESIDUE"
            or {row.get("criterion_id") for row in evidence.get("product_validation", {}).get("records", [])}
            != {"AV-OPS-015", "AV-OPS-025"}
            or any(row.get("verdict") != "SUITABLE" for row in evidence["product_validation"]["records"])):
        raise RuntimeError("F17_FINAL_BASE_OR_EVIDENCE_INVALID")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root,
                                   text=True).strip()
    if subprocess.run(["git", "merge-base", "--is-ancestor", PRODUCT_HEAD, head],
                      cwd=root).returncode != 0:
        raise RuntimeError("F17_PRODUCT_HEAD_INVALID")
    since_product = set(filter(None, subprocess.check_output(
        ["git", "diff", "--name-only", f"{PRODUCT_HEAD}..{head}"],
        cwd=root, text=True).splitlines()))
    if not since_product <= set(control_paths()):
        raise RuntimeError("F17_POST_PRODUCT_SCOPE_INVALID")
    staged = subprocess.check_output(["git", "diff", "--cached", "--name-only"],
                                     cwd=root, text=True).strip()
    status = subprocess.check_output(["git", "-c", "core.excludesFile=", "status",
                                      "--porcelain=v1", "--untracked-files=all"],
                                     cwd=root, text=True)
    dirty = {line[3:].replace("\\", "/") for line in status.splitlines() if line}
    if staged or not dirty <= set(control_paths()):
        raise RuntimeError("F17_FINAL_DIRTY_SCOPE_INVALID")
    old_event_raw = event_path.read_bytes()
    previous_status = (root / "docs/WORK_STATUS.md").read_bytes()
    old_worker = deepcopy(progress["worker_lease"])
    old_write = deepcopy(progress["write_lease"])
    events = ledger["events"]
    _append(events, "PACKAGE_COMPLETED", {"package_id": "F-17",
        "product_head": PRODUCT_HEAD, "exact_tag": "f17-rc-7083e2a",
        "runtime_image_digest": evidence["runtime_image_digest"],
        "pg15": "REAL_HTTP_DB_RESTART_ROLLBACK_PASS",
        "pg18": "ISOLATED_RC_REAL_HTTP_DB_RESTART_RESTORE_ROLLBACK_PASS",
        "browser": "PLAYWRIGHT_DASHBOARD_SAME_ORIGIN_PASS",
        "temporary_resource_residue": 0}, step="FINAL", at=FINAL_AT)
    _append(events, "INDEPENDENT_TEST_JUDGMENT_RECORDED", {
        "verdict": "F17_SCOPED_ACCEPTED", "critical": 0, "important": 0,
        "criterion_ids": ["AV-OPS-015", "AV-OPS-025"],
        "evidence_manifest": RC_MANIFEST,
        "web_only_auth": "NOT_VERIFIED_F18_PROXY_DEPENDENCY"},
        step="FINAL", at=FINAL_AT)
    _append(events, "WRITE_LEASE_REVOKED", {"lease_id": WRITE,
        "reason": "F17_SCOPED_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    _append(events, "WORKER_LEASE_REVOKED", {"lease_id": WORKER,
        "reason": "F17_SCOPED_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    unverified = ["WEB_ONLY_DIRECT_AUTH_PROXY", "FULL_UI_WORKFLOW", "PRODUCT_VALIDATION_API_501",
                  "REAL_PROVIDER", "F18_YSNA_PRODUCTION", "HUMAN_RELEASE_DECISION"]
    last = _append(events, "MAIN_PACKAGE_ACCEPTED", {"package_id": "F-17",
        "decision": "ACCEPTED_F17_PG15_PG18_SCOPED", "next_work_package": "F-18",
        "unverified": unverified}, step="FINAL", at=FINAL_AT)
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if old_event_raw.count(marker) != 1:
        raise RuntimeError("F17_FINAL_EVENT_BYTES_INVALID")
    event_raw = old_event_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-5:])
        + marker.replace(old_id, last["event_id"].encode())
    ).replace(b'"last_sequence": 1486', b'"last_sequence": 1491', 1)
    old_worker.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    old_write.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    completed = list(progress.get("completed_packages", []))
    if "F-17" not in completed:
        completed.append("F-17")
    repository = deepcopy(progress["repository"])
    repository.update({"projection_mode": FINAL_MODE,
        "exact_allowed_paths": control_paths(), "worktree_status": "F17_ACCEPTED_PENDING_MERGE",
        "commit_status": "FINAL_PENDING_OR_COMPLETE", "product_head": PRODUCT_HEAD})
    progress.update({
        "snapshot_id": "snapshot-f17-final-seq1491", "event_sequence": 1491,
        "last_event_id": last["event_id"], "updated_at": FINAL_AT,
        "recorded_at": FINAL_AT, "status": "ACCEPTED",
        "completed_packages": completed, "active_agent": None,
        "worker_lease": None, "write_lease": None,
        "completed_f17_worker_lease": old_worker,
        "completed_f17_write_lease": old_write,
        "last_accepted_work_instruction": deepcopy(progress.get("active_work_instruction")),
        "active_work_instruction": None, "repository": repository,
        "f17_acceptance": {"status": "ACCEPTED_F17_PG15_PG18_SCOPED",
            "product_head": PRODUCT_HEAD,
            "runtime_image_digest": evidence["runtime_image_digest"],
            "criteria": ["AV-OPS-015", "AV-OPS-025"],
            "pg15": "PASS", "pg18": "PASS", "browser": "DASHBOARD_NETWORK_PASS",
            "temporary_resource_residue": 0, "unverified": unverified},
        "next_work_package": {"package_id": "F-18", "status": "READY_AFTER_F17_MERGE_CLEANUP"},
        "next_successor_work_package": {"package_id": "F-18", "status": "READY_AFTER_F17_MERGE_CLEANUP"},
        "next_safe_action": "MERGE_F17_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "runtime_next_action": "MERGE_F17_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F17_SCOPED_ACCEPTED", "F17_APPROVED_SCOPE"],
            "stop_before_dialogue_report": False},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_note = (
                   "- 판정: F-17 범위 ACCEPTED. AV-OPS-015/025의 최종 Main ProductValidation SUITABLE은 실제 WSL PG15/PG18 동일 Git/image, 핵심 E2E·restart·backup/restore·rollback, 브라우저 Network 및 잔류 0에 한정한다.\n"
                   "- Web-only /auth/session 경로와 전체 UI·ProductValidation API·Provider·ysna/운영·사용자 ReleaseDecision은 미검증. F18 proxy/auth 라우팅 재확인 필수.\n"
                   "- 두 lease를 회수했다. 다음: F17 PR 병합→merged-main smoke→branch/worktree 정리 후 F18.\n").encode("utf-8")
    handoff_raw = (b"# F-17 WSL PG15/PG18 scoped acceptance\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease", "write_lease",
                               "next_work_package", "next_safe_action", "runtime_next_action")})
                   + b"```\n\n" + handoff_note)
    status_raw = ("# F-17 WSL PG15/PG18 범위 인수\n\n"
        "- 판정: `ACCEPTED_F17_PG15_PG18_SCOPED`; seq1491. 동일 Git 7083e2a·runtime image f6c481의 PG15/PG18 실측과 AV-OPS-015/025 ProductValidation SUITABLE. 브라우저 dashboard same-origin만 PASS, Web-only auth/전체 UI/운영 배포는 미검증.\n"
        "- Main이 worker/write lease를 모두 회수했다. 임시 자원 잔류 0. 다음은 F17 PR 병합·merged-main smoke·branch/worktree 정리이며 그 전 F18 branch 금지.\n\n"
    ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "algorithm": "SHA-256", "event_sequence": FINAL_SEQUENCE, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted(set(control_paths()) - {
            "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md",
            DIGEST, MANIFEST}):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "package_id": "F-17", "event_sequence": FINAL_SEQUENCE, "accepted": True,
        "acceptance_scope": "PG15_PG18_SCOPED", "projection_mode": FINAL_MODE,
        "validated_base_commit": BASE, "exact_allowed_paths": control_paths(),
        "product_write_scope": product_paths(), "product_head": PRODUCT_HEAD,
        "raw_checksums": checksums, "self_reference": False,
        "runtime_boundary": {"shared_pg15": "PASS_F17_SCOPE",
            "isolated_pg18": "PASS_F17_SCOPE", "actual_e2e": "PASS_SAME_GIT_IMAGE",
            "browser": "PASS_DASHBOARD_NETWORK_SCOPE", "production": "NOT_EXECUTED"}}))


if __name__ == "__main__":
    import sys
    (finalize if "--finalize" in sys.argv else materialize)(Path(__file__).resolve().parents[1])
