"""F-13 start projection and scoped Git/progress gate."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys

BASE = "a612fdac2c7eabbb381e8da9d3111d797460f9bf"
START_COMMIT = "a386011646b406535bfe4a5f2937493b6d510d88"
BRANCH = "codex/f13-operations-read-model"
MODE = "F13_START_EXACT11_PRODUCT_EXACT9"
FINAL_MODE = "F13_FINAL_ACCEPTANCE_EXACT21"
ACTOR = "developer-primary-f13-r1"
WORKER = "worker-lease-f13-r1-20260924-001"
WRITE = "write-lease-f13-r1-20260924-001"
EXECUTION_TOKEN = "f13-r1-execution-fence-epoch-1-a612fdac2c7eabbb"
WRITE_TOKEN = "f13-r1-write-fence-epoch-1-381e8da9d3111d79"
AT = "2026-09-24T07:45:00+09:00"
EXPIRES = "2026-09-24T19:45:00+09:00"
FINAL_AT = "2026-09-24T08:29:00+09:00"
WI = "docs/work_orders/F-13_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-13_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f13.json"
MANIFEST = "docs/evidence/manifests/F-13_PROGRESS_MANIFEST.json"
REVIEW = "docs/04_test_reports/F-13_INDEPENDENT_REVIEW.md"


def product_paths():
    return sorted([
        "packages/observability/models.py", "packages/observability/projection.py",
        "packages/observability/service.py", "packages/api/operations.py",
        "packages/api/registry.py", "packages/api/runtime.py",
        "tests/observability/test_f13_operations.py", "tests/api/test_f13_operations_api.py",
        "docs/04_test_reports/F-13_COMPLETION_REPORT.md",
    ])


def control_paths():
    return sorted([
        "docs/work_orders/F-13_WORK_INSTRUCTION.md",
        "docs/work_orders/F-13_INVOCATION_PROMPT.md",
        "docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-f13.json",
        "docs/evidence/manifests/F-13_PROGRESS_MANIFEST.json",
        "scripts/f13_progress_overlay.py", "scripts/check_project_progress.py",
        "tests/tooling/test_f13_progress_overlay.py",
    ])


def final_paths():
    return sorted(set(control_paths()) | set(product_paths()) | {REVIEW})


def validate_final_git_facts(*, head, branch, upstream, remote_head, staged, dirty,
                             parents, feature_paths, base_is_ancestor,
                             merge_tree_matches_feature):
    exact = set(final_paths())
    clean = not staged and not dirty and base_is_ancestor and set(feature_paths) == exact
    feature = (branch == BRANCH and upstream == f"development/{BRANCH}"
               and remote_head in {BASE, head, *parents} and clean)
    merged = (branch == "main" and upstream == "development/main" and remote_head == head
              and len(parents) == 2 and parents[0] == BASE
              and merge_tree_matches_feature and clean)
    return [] if feature or merged else ["F13_FINAL_GIT_INVALID"]


def validate_start_git_facts(*, head, branch, upstream, remote_head, staged, dirty,
                             changed, base_is_ancestor=True):
    common = branch == BRANCH and upstream == f"development/{BRANCH}" and not staged
    pre = head == BASE and remote_head == BASE and not changed and set(dirty) == set(control_paths())
    post = (head != BASE and base_is_ancestor and remote_head in {BASE, head}
            and set(changed) == set(control_paths()) and set(dirty) <= set(product_paths()))
    return [] if common and (pre or post) else ["F13_START_GIT_INVALID"]


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def _pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def _sha(raw):
    return sha256(raw).hexdigest().upper()


def _event_sha(event):
    return _sha(_canonical(event))


def _append(events, kind, details, *, step="START", at=AT):
    sequence = events[-1]["sequence"] + 1
    event = {
        "sequence": sequence,
        "event_id": f"evt_f13_{sequence}_{kind.lower()}",
        "event_type": kind,
        "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
        "project_id": "anvil", "work_package_id": "F-13", "run_id": None,
        "step_id": step, "subject_ref": f"F-13/{step}", "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": _event_sha(events[-1]), "details": details,
    }
    events.append(event)
    return event


def _lease(kind):
    lease = {
        "lease_id": WORKER if kind == "worker" else WRITE,
        "actor_id": ACTOR, "subject_ref": "F-13", "status": "ACTIVE",
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


def _summary(progress):
    return {key: deepcopy(progress.get(key)) for key in (
        "event_sequence", "last_event_id", "status", "current_phase",
        "current_work_package", "active_agent", "worker_lease", "write_lease",
        "next_work_package", "next_safe_action", "runtime_next_action",
    )}


def materialize(root):
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1447 or ledger.get("last_sequence") != 1447
            or progress.get("status") != "ACCEPTED" or progress.get("current_work_package") != "F-12"):
        raise RuntimeError("F13_BASE_PROGRESS_INVALID")
    events = ledger["events"]
    if events[-1]["event_id"] != progress["last_event_id"]:
        raise RuntimeError("F13_BASE_EVENT_INVALID")
    _append(events, "PACKAGE_STARTED", {"package_id": "F-13", "branch": BRANCH,
            "base_commit": BASE, "work_instruction": WI, "product_paths": product_paths()})
    _append(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER,
            "execution_fencing_token": EXECUTION_TOKEN, "actor_id": ACTOR})
    last = _append(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
            "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
            "path_scope": product_paths()})
    ledger.update({"last_sequence": last["sequence"], "last_event_id": last["event_id"]})
    base_event_raw = subprocess.check_output(["git", "show", f"{BASE}:docs/progress/progress-events.json"], cwd=root)
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if base_event_raw.count(marker) != 1:
        raise RuntimeError("F13_BASE_EVENT_BYTES_INVALID")
    event_raw = base_event_raw.replace(
        marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-3:])
        + marker.replace(old_id, last["event_id"].encode()),
    ).replace(b'"last_sequence": 1447', b'"last_sequence": 1450', 1)
    wi_raw = (root / WI).read_bytes()
    prompt_raw = (root / PROMPT).read_bytes()
    progress.update({
        "snapshot_id": "snapshot-f13-start-seq1450", "event_sequence": 1450,
        "last_event_id": last["event_id"], "updated_at": AT, "recorded_at": AT,
        "current_phase": "F", "current_work_package": "F-13", "status": "ACTIVE",
        "active_agent": ACTOR, "worker_lease": _lease("worker"), "write_lease": _lease("write"),
        "active_work_instruction": {"artifact_id": "WI-F-13-20260924-001", "path": WI,
            "sha256": _sha(wi_raw), "invocation_path": PROMPT,
            "invocation_sha256": _sha(prompt_raw),
            "assigned_verification_ids": [f"AV-OPS-00{i}" for i in range(1, 7)]},
        "repository": {"branch": BRANCH, "local_head": BASE,
            "upstream": f"development/{BRANCH}", "remote_head": BASE,
            "projection_mode": MODE, "validated_base_commit": BASE,
            "head_relation": "BASE_OR_FEATURE_DESCENDANT", "exact_allowed_paths": control_paths(),
            "product_write_scope": product_paths(), "worktree_status": "F13_ACTIVE",
            "commit_status": "PENDING", "push_status": "BRANCH_PUBLISHED"},
        "next_work_package": {"package_id": "F-14", "status": "BLOCKED_PENDING_F13_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "F-14", "status": "BLOCKED_PENDING_F13_ACCEPTANCE"},
        "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F13_EXACT9",
        "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F13_EXACT9",
        "reporting_decision": {"decision": "AUTO_CONTINUE", "reason_codes": ["F13_APPROVED_SCOPE"],
                               "stop_before_dialogue_report": False},
        "current_progress_evidence_ref": {"package_id": "F-13", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-13 Operations read model/API start\n\n```json anvil-recovery-summary\n"
                   + _pretty(_summary(progress)) + b"```\n")
    previous_status = subprocess.check_output(["git", "show", f"{BASE}:docs/WORK_STATUS.md"], cwd=root)
    status_raw = ("# F-13 Operations read model/API 시작\n\n"
                  "- 판정: ACTIVE; F-12 merged main a612fda에서 F-13 단일 branch를 시작했다.\n"
                  "- 담당: Main 어울 통제, developer-primary-f13-r1 제품 exact9 write lease.\n"
                  "- 기준선: Queue/Lease/Budget/API 관련 Windows 회귀 637 PASS, 6 SKIP. "
                  "최초 Python 경로 2회, D:/tmp 권한 1회 실패는 환경 오류이며 "
                  "허용된 Temp 경로로 해결했다. 정식 제품 FAILURE_REPORT 0회.\n"
                  "- 설계 §16.2의 alert/audit 조회 경로만 사용하고 미정 command 경로는 "
                  "추가하지 않는다. 실제 UI/U-01·U-10, DB/F-14, release/F-20은 미검증.\n"
                  "- 다음: G-05 start gate 후 developer TDD 구현·독립 검증.\n\n").encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1450,
              "self_reference": False,
              "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                           "file_sha256": _sha(progress_raw)},
              "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                          "file_sha256": _sha(handoff_raw)}}
    (root / DIGEST).write_bytes(_pretty(digest))
    checksum_paths = [WI, PROMPT, "docs/WORK_STATUS.md", "docs/progress/progress-events.json",
                      "scripts/check_project_progress.py", "scripts/f13_progress_overlay.py",
                      "tests/tooling/test_f13_progress_overlay.py"]
    checksums = []
    for relative in sorted(checksum_paths):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest = {"schema_version": "1.0.0", "package_id": "F-13", "event_sequence": 1450,
                "accepted": False, "projection_mode": MODE, "validated_base_commit": BASE,
                "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
                "raw_checksums": checksums, "self_reference": False,
                "runtime_boundary": {"database": "NOT_EXECUTED", "browser": "NOT_EXECUTED",
                                     "provider": "NOT_EXECUTED", "deployment": "NOT_EXECUTED"}}
    (root / MANIFEST).write_bytes(_pretty(manifest))


def finalize(root):
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    if progress.get("repository", {}).get("projection_mode") == FINAL_MODE:
        def start_raw(relative):
            return subprocess.check_output(["git", "show", f"{START_COMMIT}:{relative}"], cwd=root)
        progress = json.loads(start_raw("docs/progress/build-progress.json"))
        ledger = json.loads(start_raw("docs/progress/progress-events.json"))
        old_raw = start_raw("docs/progress/progress-events.json")
        previous_status = start_raw("docs/WORK_STATUS.md")
    else:
        ledger = json.loads(event_path.read_text(encoding="utf-8"))
        old_raw = event_path.read_bytes()
        previous_status = (root / "docs/WORK_STATUS.md").read_bytes()
    if (progress.get("event_sequence") != 1450 or ledger.get("last_sequence") != 1450
            or progress.get("status") != "ACTIVE"
            or progress.get("repository", {}).get("projection_mode") != MODE):
        raise RuntimeError("F13_FINAL_BASE_INVALID")
    events = ledger["events"]
    product_head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    if product_head != "772ab8deea508ff217dc89c6b45e453f157af018":
        raise RuntimeError("F13_PRODUCT_HEAD_INVALID")
    old_worker, old_write = deepcopy(progress["worker_lease"]), deepcopy(progress["write_lease"])
    _append(events, "PACKAGE_COMPLETED", {"package_id": "F-13", "product_head": product_head,
            "product_paths": product_paths(), "windows_related": "656_PASS_6_SKIP",
            "wsl_isolated": "652_PASS_10_SKIP"}, step="FINAL", at=FINAL_AT)
    _append(events, "INDEPENDENT_TEST_JUDGMENT_RECORDED", {"verdict": "SPEC_PASS_QUALITY_APPROVED",
            "critical": 0, "important": 0, "review": REVIEW}, step="FINAL", at=FINAL_AT)
    _append(events, "WRITE_LEASE_REVOKED", {"lease_id": WRITE,
            "reason": "F13_CONTRACT_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    _append(events, "WORKER_LEASE_REVOKED", {"lease_id": WORKER,
            "reason": "F13_CONTRACT_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    last = _append(events, "MAIN_PACKAGE_ACCEPTED", {"package_id": "F-13",
            "decision": "ACCEPTED_LOCAL_CONTRACT_SCOPE", "next_work_package": "F-14",
            "unverified": ["LIVE_ASGI_OWNER_BINDING", "POSTGRES_DURABILITY", "HOST_DETECTOR",
                           "BROWSER_UI", "PROVIDER", "DEPLOYMENT", "PG18"]},
            step="FINAL", at=FINAL_AT)
    ledger.update({"last_sequence": 1455, "last_event_id": last["event_id"]})
    marker = b'\n  ],\n  "last_event_id": "' + progress["last_event_id"].encode() + b'"'
    if old_raw.count(marker) != 1:
        raise RuntimeError("F13_FINAL_EVENT_BYTES_INVALID")
    event_raw = old_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-5:])
        + marker.replace(progress["last_event_id"].encode(), last["event_id"].encode()),
    ).replace(b'"last_sequence": 1450', b'"last_sequence": 1455', 1)
    old_worker.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    old_write.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    completed = list(progress.get("completed_packages", []))
    if "F-13" not in completed:
        completed.append("F-13")
    repository = deepcopy(progress["repository"])
    repository.update({"projection_mode": FINAL_MODE, "exact_allowed_paths": final_paths(),
                       "worktree_status": "F13_ACCEPTED_PENDING_MERGE",
                       "commit_status": "FINAL_PENDING_OR_COMPLETE", "product_head": product_head})
    progress.update({
        "snapshot_id": "snapshot-f13-final-seq1455", "event_sequence": 1455,
        "last_event_id": last["event_id"], "updated_at": FINAL_AT, "recorded_at": FINAL_AT,
        "status": "ACCEPTED", "completed_packages": completed, "active_agent": None,
        "worker_lease": None, "write_lease": None,
        "completed_f13_worker_lease": old_worker, "completed_f13_write_lease": old_write,
        "last_accepted_work_instruction": deepcopy(progress.get("active_work_instruction")),
        "active_work_instruction": None, "repository": repository,
        "f13_acceptance": {"status": "ACCEPTED_LOCAL_CONTRACT_SCOPE",
            "independent_review": "SPEC_PASS_QUALITY_APPROVED_C0_I0",
            "product_head": product_head, "windows_related": "656_PASS_6_SKIP",
            "wsl_isolated": "652_PASS_10_SKIP",
            "unverified": ["LIVE_ASGI_OWNER_BINDING", "POSTGRES_DURABILITY", "HOST_DETECTOR",
                           "BROWSER_UI", "PROVIDER", "DEPLOYMENT", "PG18"]},
        "next_work_package": {"package_id": "F-14", "status": "READY_AFTER_F13_MERGE_CLEANUP"},
        "next_successor_work_package": {"package_id": "F-14", "status": "READY_AFTER_F13_MERGE_CLEANUP"},
        "next_safe_action": "MERGE_F13_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "runtime_next_action": "MERGE_F13_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
                               "reason_codes": ["F13_LOCAL_CONTRACT_ACCEPTED", "F13_APPROVED_SCOPE"],
                               "stop_before_dialogue_report": False},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-13 Operations read model/API local contract accepted\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty(_summary(progress)) + b"```\n")
    status_raw = ("# F-13 Operations read model/API 로컬 계약 인수\n\n"
                  "- 판정: `ACCEPTED_LOCAL_CONTRACT_SCOPE`; 제품 commit 772ab8d exact9, 독립 SPEC PASS / QUALITY APPROVED, 미해결 Critical 0/Important 0.\n"
                  "- Main Windows 관련 회귀 656 PASS/6 SKIP; WSL-server 격리 Git checkout 동일 SHA 652 PASS/10 SKIP. "
                  "WSL 최초 시스템 Python 의존성 누락 23 collection ERROR는 lockfile 오프라인 venv로 해결. 임시 checkout/pytest 정리 잔여 0.\n"
                  "- 실제 기본 ASGI operations owner 미주입으로 GET 501, 실제 PostgreSQL 영속 adapter·주기 detector·브라우저/UI·Provider·배포·PG18은 미검증. "
                  "F-14 및 F-15~19, U-01/U-10, F Gate의 후속 결선·검증 조건으로 남긴다.\n"
                  "- developer 정식 FAILURE_REPORT 0회. 독립 review C1/I4 및 추가 Important 1을 같은 WI에서 수정했다.\n"
                  "- 담당: Main 어울 인수·lease 회수. 다음: F-13 PR 병합, merged-main smoke, branch/worktree 정리 후 F-14 시작.\n\n"
                 ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1455,
              "self_reference": False,
              "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                           "file_sha256": _sha(progress_raw)},
              "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                          "file_sha256": _sha(handoff_raw)}}
    (root / DIGEST).write_bytes(_pretty(digest))
    checksum_paths = sorted((set(final_paths())
                             - {"docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md",
                                DIGEST, MANIFEST}))
    checksums = []
    for relative in checksum_paths:
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest = {"schema_version": "1.0.0", "package_id": "F-13", "event_sequence": 1455,
                "accepted": True, "acceptance_scope": "LOCAL_READ_MODEL_API_CONTRACT",
                "projection_mode": FINAL_MODE, "validated_base_commit": BASE,
                "exact_allowed_paths": final_paths(), "product_write_scope": product_paths(),
                "product_head": product_head, "raw_checksums": checksums, "self_reference": False,
                "runtime_boundary": {"wsl_isolated_contract": "652_PASS_10_SKIP",
                    "live_asgi_owner": "NOT_INTEGRATED_501", "database": "NOT_EXECUTED",
                    "browser": "NOT_EXECUTED", "provider": "NOT_EXECUTED",
                    "deployment": "NOT_EXECUTED", "pg18": "NOT_EXECUTED"}}
    (root / MANIFEST).write_bytes(_pretty(manifest))


def collect_git(root):
    root = Path(root)
    def run(*args):
        return subprocess.check_output(["git", "-c", "core.excludesFile=", *args],
                                       cwd=root, text=True).strip()
    head = run("rev-parse", "HEAD")
    branch = run("branch", "--show-current")
    upstream = run("rev-parse", "--abbrev-ref", "@{upstream}")
    mode = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))["repository"]["projection_mode"]
    remote_head = run("rev-parse", "development/main" if branch == "main" else f"development/{BRANCH}")
    staged = set(filter(None, run("diff", "--cached", "--name-only").splitlines()))
    status = subprocess.check_output(["git", "-c", "core.excludesFile=", "status",
                                      "--porcelain=v1", "--untracked-files=all"], cwd=root, text=True)
    dirty = {line[3:].replace("\\", "/") for line in status.splitlines() if line}
    changed = set(filter(None, run("diff", "--name-only", f"{BASE}..{head}").splitlines()))
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head], cwd=root).returncode == 0
    if mode == FINAL_MODE:
        parents = run("show", "-s", "--format=%P", head).split()
        feature_paths = changed
        tree_match = False
        if branch == "main" and len(parents) == 2:
            feature = parents[1]
            feature_paths = set(filter(None, run("diff", "--name-only", f"{BASE}..{feature}").splitlines()))
            tree_match = run("rev-parse", f"{head}^{{tree}}") == run("rev-parse", f"{feature}^{{tree}}")
        return validate_final_git_facts(head=head, branch=branch, upstream=upstream,
            remote_head=remote_head, staged=staged, dirty=dirty, parents=parents,
            feature_paths=feature_paths, base_is_ancestor=ancestor,
            merge_tree_matches_feature=tree_match)
    return validate_start_git_facts(head=head, branch=branch, upstream=upstream,
        remote_head=remote_head, staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=ancestor)


def validate(root, bundle):
    root = Path(root)
    progress = bundle["progress"]
    ledger = bundle["events"]
    errors = []
    final = progress.get("repository", {}).get("projection_mode") == FINAL_MODE
    sequence = 1455 if final else 1450
    status = "ACCEPTED" if final else "ACTIVE"
    if (progress.get("repository", {}).get("projection_mode") not in {MODE, FINAL_MODE}
            or progress.get("event_sequence") != sequence or ledger.get("last_sequence") != sequence
            or progress.get("current_work_package") != "F-13" or progress.get("status") != status):
        errors.append("F13_START_STATE_INVALID")
    if final:
        if (progress.get("active_agent") is not None or progress.get("worker_lease") is not None
                or progress.get("write_lease") is not None
                or "F-13" not in progress.get("completed_packages", [])
                or progress.get("next_work_package", {}).get("package_id") != "F-14"):
            errors.append("F13_FINAL_STATE_INVALID")
    elif (progress.get("active_agent") != ACTOR
          or progress.get("worker_lease", {}).get("lease_id") != WORKER
          or progress.get("write_lease", {}).get("lease_id") != WRITE
          or progress.get("write_lease", {}).get("worker_lease_id") != WORKER
          or progress.get("write_lease", {}).get("path_scope") != product_paths()):
        errors.append("F13_LEASE_INVALID")
    events = ledger["events"]
    for before, after in zip(events[-(6 if final else 4):], events[-(5 if final else 3):]):
        if after.get("previous_event_sha256") != _event_sha(before):
            errors.append("F13_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F13_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not final
            or manifest.get("exact_allowed_paths") != (final_paths() if final else control_paths())
            or manifest.get("product_write_scope") != product_paths()):
        errors.append("F13_MANIFEST_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (len(raw), _sha(raw)) != (row["bytes"], row["sha256"]):
            errors.append("F13_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


if __name__ == "__main__":
    materialize(Path(__file__).resolve().parents[1])
