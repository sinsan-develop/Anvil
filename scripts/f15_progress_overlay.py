"""F-15 start projection: one branch, one fenced product writer."""

from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import subprocess

BASE = "41e7e06cb0f4e76a0d8be31cab24120a4b530420"
BRANCH = "codex/f15-common-shell-local-stack"
MODE = "F15_START_EXACT11_PRODUCT_EXACT19"
FINAL_MODE = "F15_FINAL_ACCEPTANCE_EXACT29"
PRODUCT_HEAD = "1d1fe19f7ba6d5492b3555ad5c4f809a6c60a7cd"
FINAL_AT = "2026-09-24T11:31:00+09:00"
AT = "2026-09-24T10:18:00+09:00"
EXPIRES = "2026-09-24T22:18:00+09:00"
ACTOR = "developer-primary-f15-r1"
WORKER = "worker-lease-f15-r1-20260924-001"
WRITE = "write-lease-f15-r1-20260924-001"
EXECUTION_TOKEN = "f15-r1-execution-fence-epoch-1-41e7e06cb0f4e76a"
WRITE_TOKEN = "f15-r1-write-fence-epoch-1-d8be31cab24120a4"
WI = "docs/work_orders/F-15_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-15_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f15.json"
MANIFEST = "docs/evidence/manifests/F-15_PROGRESS_MANIFEST.json"


def product_paths():
    return sorted([
        "package.json", "package-lock.json", "apps/web/package.json",
        "apps/web/tsconfig.json", "apps/web/vite.config.ts",
        "apps/web/console/index.html", "apps/web/src/console/main.tsx",
        "apps/web/src/console/App.tsx", "apps/web/src/console/app-shell.css",
        "apps/api/anvil_api/asgi.py", "packages/api/fastapi_app.py",
        "apps/worker/anvil_worker/main.py", "docker-compose.local.yml",
        "deploy/local/Dockerfile.runtime", "deploy/local/nginx.conf",
        "apps/web/tests/f15-console.test.mjs",
        "tests/integration/test_f15_local_stack.py",
        "tests/api/test_f15_web_security.py",
        "docs/04_test_reports/F-15_COMPLETION_REPORT.md",
    ])


def control_paths():
    return sorted([
        WI, PROMPT, "docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        DIGEST, MANIFEST, "scripts/f15_progress_overlay.py",
        "scripts/check_project_progress.py", "tests/tooling/test_f15_progress_overlay.py",
    ])


def final_paths():
    # fastapi_app was deliberately unchanged; the other eighteen product paths are exact.
    return sorted(set(control_paths()) | (set(product_paths()) - {"packages/api/fastapi_app.py"}))


def validate_final_git_facts(*, branch, upstream, remote_head, head, staged,
                             dirty, changed, parents, base_is_ancestor,
                             merge_tree_matches_feature):
    clean = (not staged and not dirty and base_is_ancestor
             and set(changed) == set(final_paths()))
    feature = (branch == BRANCH and upstream == f"development/{BRANCH}"
               and remote_head in {BASE, head, *parents} and clean)
    merged = (branch == "main" and upstream == "development/main"
              and remote_head == head and len(parents) == 2
              and parents[0] == BASE and merge_tree_matches_feature and clean)
    return [] if feature or merged else ["F15_FINAL_GIT_INVALID"]


def validate_changed_scope(changed):
    """Control projection is exact; product paths are a bounded write allowance."""
    controls = set(control_paths())
    return controls <= changed <= controls | set(product_paths())


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2,
                       allow_nan=False) + "\n").encode("utf-8")


def _sha(raw):
    return sha256(raw).hexdigest().upper()


def _append(events, event_type, details, *, step="START", at=AT):
    sequence = events[-1]["sequence"] + 1
    event = {
        "sequence": sequence, "event_id": f"evt_f15_{sequence}_{event_type.lower()}",
        "event_type": event_type, "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul", "actor_type": "AGENT",
        "project_id": "anvil", "work_package_id": "F-15", "run_id": None,
        "step_id": step, "subject_ref": f"F-15/{step}", "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": _sha(_canonical(events[-1])), "details": details,
    }
    events.append(event)
    return event


def _lease(kind):
    lease = {
        "lease_id": WORKER if kind == "worker" else WRITE,
        "actor_id": ACTOR, "subject_ref": "F-15", "status": "ACTIVE",
        "issued_at": AT, "expires_at": EXPIRES, "lease_epoch": 1,
        "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
        "execution_fencing_token": EXECUTION_TOKEN,
        "baseline_git_commit": BASE, "dispatch_head": BASE,
        "path_scope": product_paths(),
    }
    if kind == "write":
        lease.update({"worker_lease_id": WORKER, "write_epoch": 1,
                      "write_fencing_token": WRITE_TOKEN})
    return lease


def collect_git(root):
    root = Path(root)
    def run(*args):
        return subprocess.check_output(["git", "-c", "core.excludesFile=", *args],
                                       cwd=root, text=True).strip()
    branch = run("branch", "--show-current")
    head = run("rev-parse", "HEAD")
    upstream = run("rev-parse", "--abbrev-ref", "@{upstream}")
    mode = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))["repository"]["projection_mode"]
    remote_head = run("rev-parse", "development/main" if branch == "main" else f"development/{BRANCH}")
    staged = run("diff", "--cached", "--name-only")
    changed = set(filter(None, run("diff", "--name-only", f"{BASE}..{head}").splitlines()))
    status = subprocess.check_output(["git", "-c", "core.excludesFile=", "status",
                                      "--porcelain=v1", "--untracked-files=all"], cwd=root, text=True)
    dirty = {line[3:].replace("\\", "/") for line in status.splitlines() if line}
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head],
                              cwd=root).returncode == 0
    if mode == FINAL_MODE:
        parents = run("show", "-s", "--format=%P", head).split()
        feature_paths = changed
        tree_match = False
        if branch == "main" and len(parents) == 2:
            feature_paths = set(filter(None, run("diff", "--name-only", f"{BASE}..{parents[1]}").splitlines()))
            tree_match = run("rev-parse", f"{head}^{{tree}}") == run("rev-parse", f"{parents[1]}^{{tree}}")
        return validate_final_git_facts(branch=branch, upstream=upstream,
            remote_head=remote_head, head=head, staged=staged, dirty=dirty,
            changed=feature_paths, parents=parents, base_is_ancestor=ancestor,
            merge_tree_matches_feature=tree_match)
    remote_ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", remote_head, head],
                                     cwd=root).returncode == 0
    common = (branch == BRANCH and upstream == f"development/{BRANCH}"
              and not staged and ancestor and remote_ancestor)
    pre = (head == BASE and remote_head == BASE and not changed
           and dirty == set(control_paths()))
    post = (head != BASE and validate_changed_scope(changed)
            and dirty <= set(product_paths()))
    return [] if common and (pre or post) else ["F15_START_GIT_INVALID"]


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    errors = []
    final = progress.get("repository", {}).get("projection_mode") == FINAL_MODE
    sequence = 1473 if final else 1468
    if (progress.get("repository", {}).get("projection_mode") not in {MODE, FINAL_MODE}
            or progress.get("event_sequence") != sequence
            or ledger.get("last_sequence") != sequence
            or progress.get("current_work_package") != "F-15"
            or progress.get("status") != ("ACCEPTED" if final else "ACTIVE")):
        errors.append("F15_START_STATE_INVALID")
    if final:
        if (progress.get("active_agent") is not None or progress.get("worker_lease") is not None
                or progress.get("write_lease") is not None
                or "F-15" not in progress.get("completed_packages", [])
                or progress.get("next_work_package", {}).get("package_id") != "F-16"):
            errors.append("F15_FINAL_STATE_INVALID")
    elif (progress.get("active_agent") != ACTOR
          or progress.get("worker_lease", {}).get("lease_id") != WORKER
          or progress.get("write_lease", {}).get("lease_id") != WRITE
          or progress.get("write_lease", {}).get("worker_lease_id") != WORKER
          or progress.get("write_lease", {}).get("path_scope") != product_paths()):
        errors.append("F15_LEASE_INVALID")
    events = ledger["events"]
    for before, after in zip(events[-(6 if final else 5):], events[-(5 if final else 4):]):
        if after.get("previous_event_sha256") != _sha(_canonical(before)):
            errors.append("F15_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F15_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not final
            or manifest.get("exact_allowed_paths") != (final_paths() if final else control_paths())
            or manifest.get("product_write_scope") != product_paths()):
        errors.append("F15_MANIFEST_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (len(raw), _sha(raw)) != (row["bytes"], row["sha256"]):
            errors.append("F15_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root):
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1464 or ledger.get("last_sequence") != 1464
            or progress.get("status") != "ACCEPTED"
            or progress.get("current_work_package") != "F-14"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None):
        raise RuntimeError("F15_BASE_PROGRESS_INVALID")
    events = ledger["events"]
    if events[-1]["event_id"] != progress["last_event_id"]:
        raise RuntimeError("F15_BASE_EVENT_INVALID")
    _append(events, "F14_MERGED_MAIN_VERIFIED", {
        "merge_commit": BASE, "pull_request": "https://github.com/sinsan-develop/Anvil/pull/30",
        "feature_commit": "47f2b986b7446083efbe827c5379b42133bac49e",
        "feature_ancestor": True, "merged_main_related": "74_PASS_17_SKIP",
        "branch_worktree_cleaned": True})
    _append(events, "PACKAGE_STARTED", {"package_id": "F-15", "branch": BRANCH,
        "base_commit": BASE, "work_instruction": WI, "product_paths": product_paths()})
    _append(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER,
        "execution_fencing_token": EXECUTION_TOKEN, "actor_id": ACTOR})
    last = _append(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
        "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
        "path_scope": product_paths()})
    ledger.update({"last_sequence": 1468, "last_event_id": last["event_id"]})
    base_raw = subprocess.check_output(["git", "show", f"{BASE}:docs/progress/progress-events.json"], cwd=root)
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if base_raw.count(marker) != 1:
        raise RuntimeError("F15_BASE_EVENT_BYTES_INVALID")
    event_raw = base_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-4:])
        + marker.replace(old_id, last["event_id"].encode()),
    ).replace(b'"last_sequence": 1464', b'"last_sequence": 1468', 1)
    wi_raw, prompt_raw = (root / WI).read_bytes(), (root / PROMPT).read_bytes()
    progress.update({
        "snapshot_id": "snapshot-f15-start-seq1468", "event_sequence": 1468,
        "last_event_id": last["event_id"], "updated_at": AT, "recorded_at": AT,
        "current_phase": "F", "current_work_package": "F-15", "status": "ACTIVE",
        "active_agent": ACTOR, "worker_lease": _lease("worker"), "write_lease": _lease("write"),
        "active_work_instruction": {"artifact_id": "WI-F-15-20260924-001", "path": WI,
            "sha256": _sha(wi_raw), "invocation_path": PROMPT,
            "invocation_sha256": _sha(prompt_raw),
            "assigned_verification_ids": ["AV-OPS-014", "AV-SAFE-029", "AV-UI-010", "AV-UI-012"]},
        "repository": {"branch": BRANCH, "local_head": BASE,
            "upstream": f"development/{BRANCH}", "remote_head": BASE,
            "projection_mode": MODE, "validated_base_commit": BASE,
            "head_relation": "BASE_OR_FEATURE_DESCENDANT",
            "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
            "worktree_status": "F15_ACTIVE", "commit_status": "PENDING",
            "push_status": "BRANCH_PUBLISHED"},
        "next_work_package": {"package_id": "F-16", "status": "BLOCKED_PENDING_F15_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "F-16", "status": "BLOCKED_PENDING_F15_ACCEPTANCE"},
        "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F15_EXACT19",
        "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F15_EXACT19",
        "reporting_decision": {"decision": "AUTO_CONTINUE", "reason_codes": ["F15_APPROVED_SCOPE"],
                               "stop_before_dialogue_report": False},
        "current_progress_evidence_ref": {"package_id": "F-15", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-15 common Web shell and local stack start\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease", "write_lease",
                               "next_work_package", "next_safe_action", "runtime_next_action")})
                   + b"```\n")
    previous_status = subprocess.check_output(["git", "show", f"{BASE}:docs/WORK_STATUS.md"], cwd=root)
    status_raw = ("# F-15 공통 운영 셸·Local stack 착수\n\n"
        "- 판정: ACTIVE. F-14 PR #30 merged main 41e7e06, feature ancestry/tree와 merged-main G-05·74 PASS/17 SKIP, branch/worktree 정리 확인.\n"
        "- 담당: Main 어울 통제, developer-primary-f15-r1 제품 exact19 write lease. 기준 문서 hash 일치, F-15 branch clean에서 시작. 정식 FAILURE_REPORT 0회.\n"
        "- 설계 D4 React/TypeScript/Vite 운영 셸은 신규 구현; 기존 정적 Node shell과 fixture는 회귀 보존. Local Web/API/Worker와 WSL-server PG15 전용 DB/role, Docker/브라우저 실제 검증은 아직 NOT_EXECUTED.\n"
        "- 계획 QA 자원: WSL-server SSH-only, F-15 이름의 격리 PG15 DB/role·container·브라우저 profile을 필요 시 생성하고 F-15 검증 종료 후 정확한 대상만 삭제·잔류 0 확인. 기존 local-postgres/타 프로젝트·ysna 미변경.\n"
        "- 다음: G-05 start gate 후 developer TDD, Main 독립 검토, exact Git SHA WSL 격리 QA와 실제 브라우저 Network 검증. F-16 staging/PG18 RC/ysna는 별도.\n\n"
    ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1468,
        "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}
    (root / DIGEST).write_bytes(_pretty(digest))
    checksums = []
    for relative in sorted([WI, PROMPT, "docs/WORK_STATUS.md",
                            "docs/progress/progress-events.json",
                            "scripts/check_project_progress.py", "scripts/f15_progress_overlay.py",
                            "tests/tooling/test_f15_progress_overlay.py"]):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest = {"schema_version": "1.0.0", "package_id": "F-15", "event_sequence": 1468,
        "accepted": False, "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
        "raw_checksums": checksums, "self_reference": False,
        "runtime_boundary": {"database": "NOT_EXECUTED", "browser": "NOT_EXECUTED",
                             "docker": "NOT_EXECUTED", "deployment": "NOT_EXECUTED"}}
    (root / MANIFEST).write_bytes(_pretty(manifest))


def finalize(root):
    """Revoke F-15 leases after bounded Local acceptance; staging remains F-16."""
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1468 or ledger.get("last_sequence") != 1468
            or progress.get("status") != "ACTIVE"
            or progress.get("repository", {}).get("projection_mode") != MODE):
        raise RuntimeError("F15_FINAL_BASE_INVALID")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    if subprocess.run(["git", "merge-base", "--is-ancestor", PRODUCT_HEAD, head],
                      cwd=root).returncode != 0:
        raise RuntimeError("F15_PRODUCT_HEAD_INVALID")
    since_product = set(filter(None, subprocess.check_output(
        ["git", "diff", "--name-only", f"{PRODUCT_HEAD}..{head}"],
        cwd=root, text=True).splitlines()))
    if not since_product <= set(control_paths()) | {"docs/04_test_reports/F-15_COMPLETION_REPORT.md"}:
        raise RuntimeError("F15_POST_PRODUCT_SCOPE_INVALID")
    if subprocess.check_output(["git", "-c", "core.excludesFile=", "status", "--porcelain=v1"],
                               cwd=root).strip():
        raise RuntimeError("F15_PRODUCT_DIRTY")
    events = ledger["events"]
    old_event_raw = event_path.read_bytes()
    previous_status = (root / "docs/WORK_STATUS.md").read_bytes()
    old_worker = deepcopy(progress["worker_lease"])
    old_write = deepcopy(progress["write_lease"])
    _append(events, "PACKAGE_COMPLETED", {"package_id": "F-15", "product_head": PRODUCT_HEAD,
        "windows_related": "49_PASS", "wsl_compose": "WEB_API_WORKER_HTTP_PASS",
        "browser": "PLAYWRIGHT_NETWORK_PASS", "windows_tunnel": "ALEMBIC_API_WORKER_VITE_PASS",
        "temporary_resource_residue": 0}, step="FINAL", at=FINAL_AT)
    _append(events, "INDEPENDENT_TEST_JUDGMENT_RECORDED", {
        "verdict": "LOCAL_CONTRACT_ACCEPTED", "critical": 0, "important": 0,
        "scope": "F15_LOCAL_STACK_BROWSER_AND_TUNNEL"}, step="FINAL", at=FINAL_AT)
    _append(events, "WRITE_LEASE_REVOKED", {"lease_id": WRITE,
        "reason": "F15_LOCAL_CONTRACT_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    _append(events, "WORKER_LEASE_REVOKED", {"lease_id": WORKER,
        "reason": "F15_LOCAL_CONTRACT_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    unverified = ["WSL_COMPOSE_DB_TUNNEL", "EXISTING_SHARED_PG_EXTERNAL_FIREWALL",
                  "AUTHENTICATED_THROUGH_NGINX_MUTATION", "PIXEL_SCREENSHOT_REVIEW",
                  "F16_STAGING", "F17_PG18_RC", "F18_YSNA_PRODUCTION"]
    last = _append(events, "MAIN_PACKAGE_ACCEPTED", {"package_id": "F-15",
        "decision": "ACCEPTED_LOCAL_BROWSER_WINDOWS_SSH_TUNNEL",
        "next_work_package": "F-16", "unverified": unverified},
        step="FINAL", at=FINAL_AT)
    ledger.update({"last_sequence": 1473, "last_event_id": last["event_id"]})
    marker = b'\n  ],\n  "last_event_id": "' + progress["last_event_id"].encode() + b'"'
    if old_event_raw.count(marker) != 1:
        raise RuntimeError("F15_FINAL_EVENT_BYTES_INVALID")
    event_raw = old_event_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-5:])
        + marker.replace(progress["last_event_id"].encode(), last["event_id"].encode()),
    ).replace(b'"last_sequence": 1468', b'"last_sequence": 1473', 1)
    old_worker.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    old_write.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    completed = list(progress.get("completed_packages", []))
    if "F-15" not in completed:
        completed.append("F-15")
    repository = deepcopy(progress["repository"])
    repository.update({"projection_mode": FINAL_MODE, "exact_allowed_paths": final_paths(),
        "worktree_status": "F15_ACCEPTED_PENDING_MERGE",
        "commit_status": "FINAL_PENDING_OR_COMPLETE", "product_head": PRODUCT_HEAD})
    progress.update({
        "snapshot_id": "snapshot-f15-final-seq1473", "event_sequence": 1473,
        "last_event_id": last["event_id"], "updated_at": FINAL_AT, "recorded_at": FINAL_AT,
        "status": "ACCEPTED", "completed_packages": completed, "active_agent": None,
        "worker_lease": None, "write_lease": None,
        "completed_f15_worker_lease": old_worker, "completed_f15_write_lease": old_write,
        "last_accepted_work_instruction": deepcopy(progress.get("active_work_instruction")),
        "active_work_instruction": None, "repository": repository,
        "f15_acceptance": {"status": "ACCEPTED_LOCAL_BROWSER_WINDOWS_SSH_TUNNEL",
            "product_head": PRODUCT_HEAD, "windows_related": "49_PASS",
            "wsl_compose": "WEB_API_WORKER_HTTP_PASS",
            "browser": "PLAYWRIGHT_NETWORK_PASS",
            "windows_tunnel": "ALEMBIC_API_WORKER_VITE_PASS",
            "temporary_resource_residue": 0, "unverified": unverified},
        "next_work_package": {"package_id": "F-16", "status": "READY_AFTER_F15_MERGE_CLEANUP"},
        "next_successor_work_package": {"package_id": "F-16", "status": "READY_AFTER_F15_MERGE_CLEANUP"},
        "next_safe_action": "MERGE_F15_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "runtime_next_action": "MERGE_F15_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F15_LOCAL_CONTRACT_ACCEPTED", "F15_APPROVED_SCOPE"],
            "stop_before_dialogue_report": False},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-15 Local shell and SSH-tunneled stack accepted\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease", "write_lease",
                               "next_work_package", "next_safe_action", "runtime_next_action")})
                   + b"```\n")
    status_raw = ("# F-15 Local 운영 셸·SSH tunnel 인수\n\n"
        "- 판정: `ACCEPTED_LOCAL_BROWSER_WINDOWS_SSH_TUNNEL`; 제품 HEAD 1d1fe19, Windows 관련 49 PASS, Web Node 3·기존 Node 3 PASS, lint/typecheck/build PASS. Main 통합 최초 Nginx tmpfs chown 실패 1회는 R2 USER 101:101 수정 후 실제 Web Up/HTTP 200으로 재검증했다. 정식 Developer FAILURE_REPORT 0회.\n"
        "- WSL-server 격리 PG15 QA DB/role migration 0016, Git exact SHA Compose Web/API/Worker Up, API ready 200, Worker ready, Playwright 1920/390 브라우저 same-origin Network 4건·내부 직접주소 0·secret 0·오류 0. WSL Compose의 host-gateway DB 직결은 SSH tunnel 보안 합격 증거로 사용하지 않는다.\n"
        "- 별도 Windows Local 실측은 WSL-server SSH loopback tunnel 127.0.0.1:15432를 통해 전용 DB/role migration 0016, Worker --check 및 장기 프로세스 ready, API 8301 ready, Vite Web 8300 same-origin /api ready 200을 확인했다. Windows API fixture 404; 개발 Vite의 일반 SPA fallback은 해당 경로 200이므로 운영 fixture 차단 증거는 WSL Nginx 404만 사용한다.\n"
        "- 초기 WSL QA DB/role/Compose/이미지/브라우저 산출물과 이후 Windows Web/API/Worker/SSH 프로세스·전용 DB/role/credential/log를 정확히 정리해 잔류 0. 기존 shared PostgreSQL 0.0.0.0:5432 바인딩은 선행 위험이며 F-15에서 변경하지 않았다. 인증 세션의 through-Nginx mutation, screenshot 픽셀 육안 검토, WSL Compose DB tunnel, shared PG 외부 방화벽은 미검증이다. F-16 staging, F-17 PG18 RC, F-18 ysna도 후속이다.\n"
        "- Main이 두 lease를 회수. 다음: F-15 PR 병합·merged-main smoke·branch/worktree 정리 후 F-16.\n\n"
    ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1473, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}))
    checksum_paths = sorted(set(final_paths()) - {
        "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST})
    checksums = []
    for relative in checksum_paths:
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0", "package_id": "F-15",
        "event_sequence": 1473, "accepted": True,
        "acceptance_scope": "LOCAL_BROWSER_WINDOWS_SSH_TUNNEL",
        "projection_mode": FINAL_MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": final_paths(), "product_write_scope": product_paths(),
        "product_head": PRODUCT_HEAD, "raw_checksums": checksums, "self_reference": False,
        "runtime_boundary": {"database": "ISOLATED_PG15_SYNTHETIC_ONLY",
            "browser": "PLAYWRIGHT_NETWORK_PASS", "windows_local": "SSH_TUNNEL_PASS",
            "docker": "COMPOSE_HTTP_PASS_DB_DIRECT_NOT_TUNNEL_PROOF",
            "deployment": "NOT_EXECUTED", "production": "NOT_EXECUTED"}}))


if __name__ == "__main__":
    materialize(Path(__file__).resolve().parents[1])
