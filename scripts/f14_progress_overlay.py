"""F-14 start and acceptance projections with scoped Git/progress gates."""

from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import subprocess

BASE = "1584523ccca71bae4b3be01f592c7eb79c11935f"
BRANCH = "codex/f14-postgres-recovery"
MODE = "F14_START_EXACT11_PRODUCT_EXACT12"
FINAL_MODE = "F14_FINAL_ACCEPTANCE_EXACT23"
PRODUCT_HEAD = "82fb71310025c547bae7be05b7701f8aea0666e1"
ACTOR = "developer-primary-f14-r1"
WORKER = "worker-lease-f14-r1-20260924-001"
WRITE = "write-lease-f14-r1-20260924-001"
EXECUTION_TOKEN = "f14-r1-execution-fence-epoch-1-1584523ccca71bae"
WRITE_TOKEN = "f14-r1-write-fence-epoch-1-4b3be01f592c7eb7"
AT = "2026-09-24T08:39:00+09:00"
FINAL_AT = "2026-09-24T09:53:00+09:00"
EXPIRES = "2026-09-24T20:39:00+09:00"
WI = "docs/work_orders/F-14_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-14_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f14.json"
MANIFEST = "docs/evidence/manifests/F-14_PROGRESS_MANIFEST.json"


def product_paths():
    return sorted([
        "migrations/versions/0016_operations_recovery.py",
        "packages/persistence/operations_repository.py",
        "packages/recovery/disaster.py", "packages/recovery/retention.py",
        "packages/recovery/runbook.py", "packages/recovery/__init__.py",
        "tests/persistence/test_f14_operations_repository.py",
        "tests/recovery/test_f14_disaster.py",
        "tests/recovery/test_f14_retention.py",
        "tests/recovery/test_f14_runbook.py",
        "tests/integration/test_f14_postgres_compat.py",
        "docs/04_test_reports/F-14_COMPLETION_REPORT.md",
    ])


def control_paths():
    return sorted([
        WI, PROMPT, "docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        DIGEST, MANIFEST, "scripts/f14_progress_overlay.py",
        "scripts/check_project_progress.py", "tests/tooling/test_f14_progress_overlay.py",
    ])


def final_paths():
    return sorted(set(control_paths()) | set(product_paths()))


def validate_final_git_facts(*, head, branch, upstream, remote_head, staged,
                             dirty, parents, feature_paths, base_is_ancestor,
                             merge_tree_matches_feature):
    clean = (not staged and not dirty and base_is_ancestor
             and set(feature_paths) == set(final_paths()))
    feature = (branch == BRANCH and upstream == f"development/{BRANCH}"
               and remote_head in {BASE, head, *parents} and clean)
    merged = (branch == "main" and upstream == "development/main"
              and remote_head == head and len(parents) == 2
              and parents[0] == BASE and merge_tree_matches_feature and clean)
    return [] if feature or merged else ["F14_FINAL_GIT_INVALID"]


def validate_start_git_facts(*, head, branch, upstream, remote_head, staged,
                             dirty, changed, base_is_ancestor=True,
                             remote_is_ancestor=False):
    common = branch == BRANCH and upstream == f"development/{BRANCH}" and not staged
    pre = head == BASE and remote_head == BASE and not changed and set(dirty) == set(control_paths())
    expected_changes = {frozenset(control_paths()),
                        frozenset(control_paths()) | frozenset(product_paths())}
    post = (head != BASE and base_is_ancestor
            and (remote_head in {BASE, head} or remote_is_ancestor)
            and frozenset(changed) in expected_changes
            and set(dirty) <= set(product_paths()))
    return [] if common and (pre or post) else ["F14_START_GIT_INVALID"]


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def _pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def _sha(raw):
    return sha256(raw).hexdigest().upper()


def _append(events, event_type, details, *, step="START", at=AT):
    sequence = events[-1]["sequence"] + 1
    event = {
        "sequence": sequence, "event_id": f"evt_f14_{sequence}_{event_type.lower()}",
        "event_type": event_type, "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul", "actor_type": "AGENT",
        "project_id": "anvil", "work_package_id": "F-14", "run_id": None,
        "step_id": step, "subject_ref": f"F-14/{step}", "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": _sha(_canonical(events[-1])), "details": details,
    }
    events.append(event)
    return event


def _lease(kind):
    lease = {"lease_id": WORKER if kind == "worker" else WRITE,
        "actor_id": ACTOR, "subject_ref": "F-14", "status": "ACTIVE",
        "issued_at": AT, "expires_at": EXPIRES, "lease_epoch": 1,
        "fencing_token": EXECUTION_TOKEN if kind == "worker" else WRITE_TOKEN,
        "execution_fencing_token": EXECUTION_TOKEN,
        "baseline_git_commit": BASE, "dispatch_head": BASE,
        "path_scope": product_paths()}
    if kind == "write":
        lease.update({"worker_lease_id": WORKER, "write_epoch": 1,
                      "write_fencing_token": WRITE_TOKEN})
    return lease


def _summary(progress):
    return {key: deepcopy(progress.get(key)) for key in (
        "event_sequence", "last_event_id", "status", "current_phase",
        "current_work_package", "active_agent", "worker_lease", "write_lease",
        "next_work_package", "next_safe_action", "runtime_next_action")}


def materialize(root):
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1455 or ledger.get("last_sequence") != 1455
            or progress.get("status") != "ACCEPTED"
            or progress.get("current_work_package") != "F-13"):
        raise RuntimeError("F14_BASE_PROGRESS_INVALID")
    events = ledger["events"]
    if events[-1]["event_id"] != progress["last_event_id"]:
        raise RuntimeError("F14_BASE_EVENT_INVALID")
    _append(events, "F13_MERGED_MAIN_VERIFIED", {"merge_commit": BASE,
        "pull_request": "https://github.com/sinsan-develop/Anvil/pull/29",
        "feature_commit": "8ec3cdaa96053dba3acbc53d94853870487ec0bd",
        "feature_ancestor": True, "merged_main_related": "659_PASS_6_SKIP",
        "branch_worktree_cleaned": True})
    _append(events, "PACKAGE_STARTED", {"package_id": "F-14", "branch": BRANCH,
        "base_commit": BASE, "work_instruction": WI, "product_paths": product_paths()})
    _append(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER,
        "execution_fencing_token": EXECUTION_TOKEN, "actor_id": ACTOR})
    last = _append(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
        "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
        "path_scope": product_paths()})
    ledger.update({"last_sequence": 1459, "last_event_id": last["event_id"]})
    base_raw = subprocess.check_output(["git", "show", f"{BASE}:docs/progress/progress-events.json"], cwd=root)
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if base_raw.count(marker) != 1:
        raise RuntimeError("F14_BASE_EVENT_BYTES_INVALID")
    event_raw = base_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-4:])
        + marker.replace(old_id, last["event_id"].encode()),
    ).replace(b'"last_sequence": 1455', b'"last_sequence": 1459', 1)
    wi_raw, prompt_raw = (root / WI).read_bytes(), (root / PROMPT).read_bytes()
    progress.update({
        "snapshot_id": "snapshot-f14-start-seq1459", "event_sequence": 1459,
        "last_event_id": last["event_id"], "updated_at": AT, "recorded_at": AT,
        "current_phase": "F", "current_work_package": "F-14", "status": "ACTIVE",
        "active_agent": ACTOR, "worker_lease": _lease("worker"), "write_lease": _lease("write"),
        "active_work_instruction": {"artifact_id": "WI-F-14-20260924-001", "path": WI,
            "sha256": _sha(wi_raw), "invocation_path": PROMPT,
            "invocation_sha256": _sha(prompt_raw),
            "assigned_verification_ids": [f"AV-OPS-00{i}" for i in range(7, 10)] + ["AV-OPS-022"]},
        "repository": {"branch": BRANCH, "local_head": BASE,
            "upstream": f"development/{BRANCH}", "remote_head": BASE,
            "projection_mode": MODE, "validated_base_commit": BASE,
            "head_relation": "BASE_OR_FEATURE_DESCENDANT",
            "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
            "worktree_status": "F14_ACTIVE", "commit_status": "PENDING",
            "push_status": "BRANCH_PUBLISHED"},
        "next_work_package": {"package_id": "F-15", "status": "BLOCKED_PENDING_F14_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "F-15", "status": "BLOCKED_PENDING_F14_ACCEPTANCE"},
        "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F14_EXACT12",
        "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F14_EXACT12",
        "reporting_decision": {"decision": "AUTO_CONTINUE", "reason_codes": ["F14_APPROVED_SCOPE"],
                               "stop_before_dialogue_report": False},
        "current_progress_evidence_ref": {"package_id": "F-14", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-14 PostgreSQL recovery start\n\n```json anvil-recovery-summary\n"
                   + _pretty(_summary(progress)) + b"```\n")
    previous_status = subprocess.check_output(["git", "show", f"{BASE}:docs/WORK_STATUS.md"], cwd=root)
    status_raw = ("# F-14 PostgreSQL migration·backup/restore 착수\n\n"
        "- 판정: ACTIVE; F-13 PR #29 merged main 1584523, feature ancestry/tree, merged-main G-05/659 PASS 6 SKIP, branch/worktree 정리 확인.\n"
        "- 담당: Main 어울 통제, developer-primary-f14-r1 제품 exact12 write lease. 기준 문서 hash 일치, F-14 branch clean.\n"
        "- 기존 migration head 0015, artifact/checkpoint/recovery table 존재. 실제 backup restore·retention·operations PostgreSQL adapter는 미구현.\n"
        "- WSL-server 기존 local-postgres·타 프로젝트 컨테이너와 ysna 운영 DB 변경 금지. PG15/PG18 별도 격리 자원으로 검증 후 정리.\n"
        "- 다음: G-05 start gate 후 developer TDD 구현·독립 검토·Main WSL 격리 DB 훈련. 현재 정식 FAILURE_REPORT 0회.\n\n"
    ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1459,
        "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}
    (root / DIGEST).write_bytes(_pretty(digest))
    checksums = []
    for relative in sorted([WI, PROMPT, "docs/WORK_STATUS.md",
                            "docs/progress/progress-events.json",
                            "scripts/check_project_progress.py", "scripts/f14_progress_overlay.py",
                            "tests/tooling/test_f14_progress_overlay.py"]):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest = {"schema_version": "1.0.0", "package_id": "F-14", "event_sequence": 1459,
        "accepted": False, "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
        "raw_checksums": checksums, "self_reference": False,
        "runtime_boundary": {"database": "NOT_EXECUTED", "pg18": "NOT_EXECUTED",
                             "browser": "NOT_EXECUTED", "deployment": "NOT_EXECUTED"}}
    (root / MANIFEST).write_bytes(_pretty(manifest))


def finalize(root):
    """Accept only the verified exact-scope product checkpoint; never deploy here."""
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1459 or ledger.get("last_sequence") != 1459
            or progress.get("status") != "ACTIVE"
            or progress.get("repository", {}).get("projection_mode") != MODE):
        raise RuntimeError("F14_FINAL_BASE_INVALID")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    if subprocess.run(["git", "merge-base", "--is-ancestor", PRODUCT_HEAD, head],
                      cwd=root).returncode != 0:
        raise RuntimeError("F14_PRODUCT_HEAD_INVALID")
    since_product = set(filter(None, subprocess.check_output(
        ["git", "diff", "--name-only", f"{PRODUCT_HEAD}..{head}"],
        cwd=root, text=True).splitlines()))
    if not since_product <= set(control_paths()):
        raise RuntimeError("F14_POST_PRODUCT_SCOPE_INVALID")
    if subprocess.check_output(["git", "status", "--porcelain=v1"], cwd=root).strip():
        raise RuntimeError("F14_PRODUCT_DIRTY")
    events = ledger["events"]
    old_event_raw = event_path.read_bytes()
    previous_status = (root / "docs/WORK_STATUS.md").read_bytes()
    old_worker = deepcopy(progress["worker_lease"])
    old_write = deepcopy(progress["write_lease"])
    _append(events, "PACKAGE_COMPLETED", {"package_id": "F-14", "product_head": PRODUCT_HEAD,
        "product_paths": product_paths(), "windows_related": "71_PASS_17_SKIP",
        "wsl_pg15_related": "75_PASS_13_SKIP", "wsl_pg18_related": "75_PASS_13_SKIP",
        "six_lineage_restore": "PG15_AND_PG18_PASS"}, step="FINAL", at=FINAL_AT)
    _append(events, "INDEPENDENT_TEST_JUDGMENT_RECORDED", {
        "verdict": "SPEC_PASS_QUALITY_APPROVED", "critical": 0, "important": 0,
        "scope": "F14_EXACT12_ISOLATED_POSTGRES_REHEARSAL"}, step="FINAL", at=FINAL_AT)
    _append(events, "WRITE_LEASE_REVOKED", {"lease_id": WRITE,
        "reason": "F14_ISOLATED_CONTRACT_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    _append(events, "WORKER_LEASE_REVOKED", {"lease_id": WORKER,
        "reason": "F14_ISOLATED_CONTRACT_ACCEPTED"}, step="FINAL", at=FINAL_AT)
    last = _append(events, "MAIN_PACKAGE_ACCEPTED", {"package_id": "F-14",
        "decision": "ACCEPTED_ISOLATED_PG15_PG18_REHEARSAL", "next_work_package": "F-15",
        "unverified": ["DEFAULT_HOST_BINDING", "BROWSER_UI", "PROVIDER",
                       "WSL_STAGING_DEPLOYMENT", "PG18_FORMAL_RC", "YSNA_PRODUCTION"]},
        step="FINAL", at=FINAL_AT)
    ledger.update({"last_sequence": 1464, "last_event_id": last["event_id"]})
    marker = b'\n  ],\n  "last_event_id": "' + progress["last_event_id"].encode() + b'"'
    if old_event_raw.count(marker) != 1:
        raise RuntimeError("F14_FINAL_EVENT_BYTES_INVALID")
    event_raw = old_event_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-5:])
        + marker.replace(progress["last_event_id"].encode(), last["event_id"].encode()),
    ).replace(b'"last_sequence": 1459', b'"last_sequence": 1464', 1)
    old_worker.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    old_write.update({"status": "REVOKED", "revoked_at": FINAL_AT})
    completed = list(progress.get("completed_packages", []))
    if "F-14" not in completed:
        completed.append("F-14")
    repository = deepcopy(progress["repository"])
    repository.update({"projection_mode": FINAL_MODE, "exact_allowed_paths": final_paths(),
        "worktree_status": "F14_ACCEPTED_PENDING_MERGE", "commit_status": "FINAL_PENDING_OR_COMPLETE",
        "product_head": PRODUCT_HEAD})
    progress.update({
        "snapshot_id": "snapshot-f14-final-seq1464", "event_sequence": 1464,
        "last_event_id": last["event_id"], "updated_at": FINAL_AT, "recorded_at": FINAL_AT,
        "status": "ACCEPTED", "completed_packages": completed, "active_agent": None,
        "worker_lease": None, "write_lease": None,
        "completed_f14_worker_lease": old_worker, "completed_f14_write_lease": old_write,
        "last_accepted_work_instruction": deepcopy(progress.get("active_work_instruction")),
        "active_work_instruction": None, "repository": repository,
        "f14_acceptance": {"status": "ACCEPTED_ISOLATED_PG15_PG18_REHEARSAL",
            "independent_review": "SPEC_PASS_QUALITY_APPROVED_C0_I0", "product_head": PRODUCT_HEAD,
            "windows_related": "71_PASS_17_SKIP", "wsl_pg15_related": "75_PASS_13_SKIP",
            "wsl_pg18_related": "75_PASS_13_SKIP", "six_lineage_restore": "PG15_AND_PG18_PASS",
            "temporary_resource_residue": 0,
            "unverified": ["DEFAULT_HOST_BINDING", "BROWSER_UI", "PROVIDER",
                           "WSL_STAGING_DEPLOYMENT", "PG18_FORMAL_RC", "YSNA_PRODUCTION"]},
        "next_work_package": {"package_id": "F-15", "status": "READY_AFTER_F14_MERGE_CLEANUP"},
        "next_successor_work_package": {"package_id": "F-15", "status": "READY_AFTER_F14_MERGE_CLEANUP"},
        "next_safe_action": "MERGE_F14_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "runtime_next_action": "MERGE_F14_PR_THEN_DELETE_BRANCH_AND_WORKTREE",
        "reporting_decision": {"decision": "AUTO_CONTINUE",
            "reason_codes": ["F14_ISOLATED_CONTRACT_ACCEPTED", "F14_APPROVED_SCOPE"],
            "stop_before_dialogue_report": False},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-14 PostgreSQL isolated recovery accepted\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty(_summary(progress)) + b"```\n")
    status_raw = ("# F-14 PostgreSQL 15/18 격리 복구 인수\n\n"
        "- 판정: `ACCEPTED_ISOLATED_PG15_PG18_REHEARSAL`; 제품 checkpoint 82fb713 exact12, 독립 SPEC PASS / QUALITY APPROVED, Critical 0/Important 0.\n"
        "- Main Windows 관련 71 PASS/17 SKIP, G-05 PASS. WSL-server Git-only commit 3baf8e4에서 격리 PG15·PG18 각 관련 75 PASS/13 SKIP, 6종 lineage backup/restore 2 PASS, CAS 각 6 PASS, Alembic 0016/vector 확인. 유자료 downgrade는 두 버전 모두 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 차단되고 0016·audit 2행 보존.\n"
        "- PG15·PG18 전용 tmpfs 컨테이너 2개, UUID 임시 DB, Git checkout, dump, pytest 산출물 정리 잔여 0. 기존 local-postgres·타 프로젝트·ysna 미변경.\n"
        "- 첫 opt-in 테스트는 test DSN URL 오류로 migration 전 실패했고 UUID DB 잔류 0; 수정 후 PASS. 전체 pytest 기본 수집 충돌 및 선택 yaml/httpx 의존성 누락, 지원 범위 장기 시도 중단·출력 미회수는 PASS가 아니다. Alembic 경고 14건은 설정 deprecation이며 해당 테스트 성공과 분리 기록.\n"
        "- 기본 host owner 결선·브라우저/UI·Provider·WSL staging 배포·PG18 formal RC·ysna Production은 미검증. F-15~20 후속 조건이며 본 결과를 release/운영 PASS로 승격하지 않는다.\n"
        "- Main이 두 lease를 회수. 다음: F-14 PR 병합·merged-main smoke·branch/worktree 정리 후 F-15.\n\n"
    ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    digest = {"schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1464,
        "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}
    (root / DIGEST).write_bytes(_pretty(digest))
    checksum_paths = sorted(set(final_paths()) - {
        "docs/progress/build-progress.json", "docs/progress/BUILD_HANDOFF.md", DIGEST, MANIFEST})
    checksums = []
    for relative in checksum_paths:
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest = {"schema_version": "1.0.0", "package_id": "F-14", "event_sequence": 1464,
        "accepted": True, "acceptance_scope": "ISOLATED_PG15_PG18_RECOVERY_REHEARSAL",
        "projection_mode": FINAL_MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": final_paths(), "product_write_scope": product_paths(),
        "product_head": PRODUCT_HEAD, "raw_checksums": checksums, "self_reference": False,
        "runtime_boundary": {"wsl_pg15_related": "75_PASS_13_SKIP",
            "wsl_pg18_related": "75_PASS_13_SKIP", "six_lineage_restore": "PG15_AND_PG18_PASS",
            "database": "ISOLATED_SYNTHETIC_ONLY", "browser": "NOT_EXECUTED",
            "provider": "NOT_EXECUTED", "deployment": "NOT_EXECUTED",
            "pg18_formal_rc": "NOT_EXECUTED", "production": "NOT_EXECUTED"}}
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
    remote_ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", remote_head, head],
                                     cwd=root).returncode == 0
    return validate_start_git_facts(head=head, branch=branch, upstream=upstream,
        remote_head=remote_head, staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=ancestor, remote_is_ancestor=remote_ancestor)


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    errors = []
    final = progress.get("repository", {}).get("projection_mode") == FINAL_MODE
    sequence = 1464 if final else 1459
    status = "ACCEPTED" if final else "ACTIVE"
    if (progress.get("repository", {}).get("projection_mode") not in {MODE, FINAL_MODE}
            or progress.get("event_sequence") != sequence or ledger.get("last_sequence") != sequence
            or progress.get("current_work_package") != "F-14" or progress.get("status") != status):
        errors.append("F14_START_STATE_INVALID")
    if final:
        if (progress.get("active_agent") is not None or progress.get("worker_lease") is not None
                or progress.get("write_lease") is not None
                or "F-14" not in progress.get("completed_packages", [])
                or progress.get("next_work_package", {}).get("package_id") != "F-15"):
            errors.append("F14_FINAL_STATE_INVALID")
    elif (progress.get("active_agent") != ACTOR
          or progress.get("worker_lease", {}).get("lease_id") != WORKER
          or progress.get("write_lease", {}).get("lease_id") != WRITE
          or progress.get("write_lease", {}).get("worker_lease_id") != WORKER
          or progress.get("write_lease", {}).get("path_scope") != product_paths()):
        errors.append("F14_LEASE_INVALID")
    events = ledger["events"]
    for before, after in zip(events[-(6 if final else 5):], events[-(5 if final else 4):]):
        if after.get("previous_event_sha256") != _sha(_canonical(before)):
            errors.append("F14_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F14_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not final
            or manifest.get("exact_allowed_paths") != (final_paths() if final else control_paths())
            or manifest.get("product_write_scope") != product_paths()):
        errors.append("F14_MANIFEST_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (len(raw), _sha(raw)) != (row["bytes"], row["sha256"]):
            errors.append("F14_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


if __name__ == "__main__":
    materialize(Path(__file__).resolve().parents[1])
