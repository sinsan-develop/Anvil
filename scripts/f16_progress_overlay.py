"""F-16 start projection and bounded single-writer gate."""

from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import subprocess

BASE = "f2b124a4c8dfdcf15a61261912aab93728fc757c"
BRANCH = "codex/f16-wsl-staging-release-manifest"
MODE = "F16_START_EXACT11_PRODUCT_EXACT8"
AT = "2026-09-24T12:37:00+09:00"
EXPIRES = "2026-09-25T00:37:00+09:00"
ACTOR = "developer-primary-f16-r1"
WORKER = "worker-lease-f16-r1-20260924-001"
WRITE = "write-lease-f16-r1-20260924-001"
EXECUTION_TOKEN = "f16-r1-execution-fence-epoch-1-f2b124a4c8dfdcf1"
WRITE_TOKEN = "f16-r1-write-fence-epoch-1-5a61261912aab937"
WI = "docs/work_orders/F-16_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-16_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f16.json"
MANIFEST = "docs/evidence/manifests/F-16_PROGRESS_MANIFEST.json"


def product_paths():
    return sorted([
        "packages/deployment/__init__.py",
        "packages/deployment/release_manifest.py",
        "deploy/wsl/f16_staging.py",
        "deploy/wsl/compose.f16.yml",
        "tests/deploy/test_f16_release_manifest.py",
        "tests/deploy/test_f16_staging_git.py",
        "tests/deploy/test_f16_staging_compose.py",
        "docs/04_test_reports/F-16_COMPLETION_REPORT.md",
    ])


def control_paths():
    return sorted([
        WI, PROMPT, "docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        DIGEST, MANIFEST, "scripts/f16_progress_overlay.py",
        "scripts/check_project_progress.py", "tests/tooling/test_f16_progress_overlay.py",
    ])


def validate_changed_scope(changed):
    controls = set(control_paths())
    return controls <= set(changed) <= controls | set(product_paths())


def validate_start_git_facts(*, branch, upstream, head, remote_head, staged,
                             dirty, changed, base_is_ancestor, remote_is_ancestor):
    common = branch == BRANCH and upstream == f"development/{BRANCH}" and not staged
    pre = (head == BASE and remote_head == BASE and not changed
           and set(dirty) == set(control_paths()))
    post = (head != BASE and base_is_ancestor and validate_changed_scope(changed)
            and (remote_head in {BASE, head} or remote_is_ancestor)
            and set(dirty) <= set(product_paths()))
    return [] if common and (pre or post) else ["F16_START_GIT_INVALID"]


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2,
                       allow_nan=False) + "\n").encode("utf-8")


def _sha(raw):
    return sha256(raw).hexdigest().upper()


def _append(events, event_type, details):
    sequence = events[-1]["sequence"] + 1
    event = {
        "sequence": sequence, "event_id": f"evt_f16_{sequence}_{event_type.lower()}",
        "event_type": event_type, "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul", "actor_type": "AGENT",
        "project_id": "anvil", "work_package_id": "F-16", "run_id": None,
        "step_id": "START", "subject_ref": "F-16/START", "occurred_at": AT,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": _sha(_canonical(events[-1])), "details": details,
    }
    events.append(event)
    return event


def _lease(kind):
    lease = {
        "lease_id": WORKER if kind == "worker" else WRITE,
        "actor_id": ACTOR, "subject_ref": "F-16", "status": "ACTIVE",
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
    remote_head = run("rev-parse", f"development/{BRANCH}")
    staged = set(filter(None, run("diff", "--cached", "--name-only").splitlines()))
    changed = set(filter(None, run("diff", "--name-only", f"{BASE}..{head}").splitlines()))
    status = subprocess.check_output(["git", "-c", "core.excludesFile=", "status",
                                      "--porcelain=v1", "--untracked-files=all"],
                                     cwd=root, text=True)
    dirty = {line[3:].replace("\\", "/") for line in status.splitlines() if line}
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head],
                              cwd=root).returncode == 0
    remote_ancestor = subprocess.run(["git", "merge-base", "--is-ancestor",
                                     remote_head, head], cwd=root).returncode == 0
    return validate_start_git_facts(branch=branch, upstream=upstream, head=head,
        remote_head=remote_head, staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=ancestor, remote_is_ancestor=remote_ancestor)


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    errors = []
    if (progress.get("repository", {}).get("projection_mode") != MODE
            or progress.get("event_sequence") != 1477
            or ledger.get("last_sequence") != 1477
            or progress.get("current_work_package") != "F-16"
            or progress.get("status") != "ACTIVE"
            or progress.get("active_agent") != ACTOR
            or progress.get("worker_lease", {}).get("lease_id") != WORKER
            or progress.get("write_lease", {}).get("lease_id") != WRITE
            or progress.get("write_lease", {}).get("worker_lease_id") != WORKER
            or progress.get("write_lease", {}).get("path_scope") != product_paths()):
        errors.append("F16_START_STATE_INVALID")
    events = ledger["events"]
    for before, after in zip(events[-5:], events[-4:]):
        if after.get("previous_event_sha256") != _sha(_canonical(before)):
            errors.append("F16_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F16_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not False
            or manifest.get("exact_allowed_paths") != control_paths()
            or manifest.get("product_write_scope") != product_paths()):
        errors.append("F16_MANIFEST_INVALID")
    for row in manifest.get("raw_checksums", []):
        raw = (root / row["path"]).read_bytes()
        if (len(raw), _sha(raw)) != (row["bytes"], row["sha256"]):
            errors.append("F16_RAW_CHECKSUM_INVALID")
            break
    errors.extend(collect_git(root))
    return sorted(set(errors))


def materialize(root):
    root = Path(root)
    progress_path = root / "docs/progress/build-progress.json"
    event_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(event_path.read_text(encoding="utf-8"))
    if (progress.get("event_sequence") != 1473 or ledger.get("last_sequence") != 1473
            or progress.get("status") != "ACCEPTED"
            or progress.get("current_work_package") != "F-15"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None):
        raise RuntimeError("F16_BASE_PROGRESS_INVALID")
    events = ledger["events"]
    if events[-1]["event_id"] != progress["last_event_id"]:
        raise RuntimeError("F16_BASE_EVENT_INVALID")
    _append(events, "F15_MERGED_MAIN_VERIFIED", {
        "merge_commit": BASE, "pull_request": "https://github.com/sinsan-develop/Anvil/pull/31",
        "feature_commit": "8a5fec19365c6b47a6700228e59315f6f833549a",
        "feature_ancestor": True, "merge_tree_matches_feature": True,
        "merged_main_related": "49_PASS", "local_remote_branch_deleted": True,
        "git_worktree_unregistered": True,
        "protected_orphan_cache": "F15_PYTEST_CACHE_ACL_DENIED"})
    _append(events, "PACKAGE_STARTED", {"package_id": "F-16", "branch": BRANCH,
        "base_commit": BASE, "work_instruction": WI, "product_paths": product_paths()})
    _append(events, "WORKER_LEASE_ISSUED", {"lease_id": WORKER,
        "execution_fencing_token": EXECUTION_TOKEN, "actor_id": ACTOR})
    last = _append(events, "WRITE_LEASE_ISSUED", {"lease_id": WRITE,
        "worker_lease_id": WORKER, "write_fencing_token": WRITE_TOKEN,
        "path_scope": product_paths()})
    ledger.update({"last_sequence": 1477, "last_event_id": last["event_id"]})
    base_raw = subprocess.check_output(
        ["git", "show", f"{BASE}:docs/progress/progress-events.json"], cwd=root)
    old_id = progress["last_event_id"].encode()
    marker = b'\n  ],\n  "last_event_id": "' + old_id + b'"'
    if base_raw.count(marker) != 1:
        raise RuntimeError("F16_BASE_EVENT_BYTES_INVALID")
    event_raw = base_raw.replace(marker,
        b",\n" + b",\n".join(_pretty(row).rstrip() for row in events[-4:])
        + marker.replace(old_id, last["event_id"].encode()),
    ).replace(b'"last_sequence": 1473', b'"last_sequence": 1477', 1)
    wi_raw, prompt_raw = (root / WI).read_bytes(), (root / PROMPT).read_bytes()
    progress.update({
        "snapshot_id": "snapshot-f16-start-seq1477", "event_sequence": 1477,
        "last_event_id": last["event_id"], "updated_at": AT, "recorded_at": AT,
        "current_phase": "F", "current_work_package": "F-16", "status": "ACTIVE",
        "active_agent": ACTOR, "worker_lease": _lease("worker"), "write_lease": _lease("write"),
        "active_work_instruction": {"artifact_id": "WI-F-16-20260924-001", "path": WI,
            "sha256": _sha(wi_raw), "invocation_path": PROMPT,
            "invocation_sha256": _sha(prompt_raw),
            "assigned_verification_ids": ["AV-OPS-013", "AV-OPS-015", "AV-OPS-021"]},
        "repository": {"branch": BRANCH, "local_head": BASE,
            "upstream": f"development/{BRANCH}", "remote_head": BASE,
            "projection_mode": MODE, "validated_base_commit": BASE,
            "head_relation": "BASE_OR_FEATURE_DESCENDANT",
            "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
            "worktree_status": "F16_ACTIVE", "commit_status": "PENDING",
            "push_status": "BRANCH_PUBLISHED"},
        "next_work_package": {"package_id": "F-17", "status": "BLOCKED_PENDING_F16_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "F-17", "status": "BLOCKED_PENDING_F16_ACCEPTANCE"},
        "next_safe_action": "DEVELOPER_PRIMARY_IMPLEMENT_F16_EXACT8",
        "runtime_next_action": "DEVELOPER_PRIMARY_IMPLEMENT_F16_EXACT8",
        "reporting_decision": {"decision": "AUTO_CONTINUE", "reason_codes": ["F16_APPROVED_SCOPE"],
                               "stop_before_dialogue_report": False},
        "current_progress_evidence_ref": {"package_id": "F-16", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["registry_refs"]["progress_events"] = {
        "path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    handoff_raw = (b"# F-16 Git-only WSL staging and ReleaseManifest start\n\n"
                   b"```json anvil-recovery-summary\n" + _pretty({key: deepcopy(progress.get(key))
                   for key in ("event_sequence", "last_event_id", "status", "current_phase",
                               "current_work_package", "active_agent", "worker_lease", "write_lease",
                               "next_work_package", "next_safe_action", "runtime_next_action")})
                   + b"```\n")
    previous_status = subprocess.check_output(["git", "show", f"{BASE}:docs/WORK_STATUS.md"],
                                              cwd=root)
    status_raw = ("# F-16 Git-only WSL Test/Staging 착수\n\n"
        "- 판정: ACTIVE. F-15 PR #31 merged main f2b124a, feature ancestry/tree 및 merged-main G-05·49 PASS, 원격/로컬 F-15 branch 삭제와 Git worktree 등록 제거 확인. F-15 작업 디렉터리에는 ACL 거부된 .pytest_cache 하나만 고아 잔류하며 다른 자료는 정리했다. ACL 변경은 임의 수행하지 않았다.\n"
        "- 담당: Main 어울 통제, developer-primary-f16-r1 제품 exact8 write lease. 기준 문서 hash 일치, F-16 branch main f2b124a에서 생성·원격 게시 후 clean 시작. 정식 FAILURE_REPORT 0회.\n"
        "- 기존 WSL /srv/anvil-wsl/repo는 root-owned clean detached a681e0c, anvil-web 컨테이너 OCI revision bb2ff437로 F-16 exact target이 아니다. 기존 C21/C01 스크립트도 고정 SHA 계약이라 수정·재사용하지 않는다. F-16 별도 경로·Compose/DB/서명 QA 자원은 생성 전 이름·수명·정리 방법을 기록한다.\n"
        "- 다음: G-05 start gate 후 Developer TDD 구현, Main 독립 검토, 원격 exact SHA WSL 격리 정식 staging에서 서명/checkout/migration/health/rollback 준비 검증 및 임시 자원 정리. F-17 PG18 RC·ysna/Oracle 미실행.\n\n"
    ).encode("utf-8") + previous_status
    progress_path.write_bytes(progress_raw)
    event_path.write_bytes(event_raw)
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(handoff_raw)
    (root / "docs/WORK_STATUS.md").write_bytes(status_raw)
    (root / DIGEST).write_bytes(_pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
        "event_sequence": 1477, "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": _sha(handoff_raw)}}))
    checksums = []
    for relative in sorted([WI, PROMPT, "docs/WORK_STATUS.md",
                            "docs/progress/progress-events.json",
                            "scripts/check_project_progress.py", "scripts/f16_progress_overlay.py",
                            "tests/tooling/test_f16_progress_overlay.py"]):
        raw = (root / relative).read_bytes()
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    (root / MANIFEST).write_bytes(_pretty({"schema_version": "1.0.0",
        "package_id": "F-16", "event_sequence": 1477, "accepted": False,
        "projection_mode": MODE, "validated_base_commit": BASE,
        "exact_allowed_paths": control_paths(), "product_write_scope": product_paths(),
        "raw_checksums": checksums, "self_reference": False,
        "runtime_boundary": {"database": "NOT_EXECUTED", "signature": "NOT_EXECUTED",
                             "browser": "NOT_EXECUTED", "docker": "NOT_EXECUTED",
                             "deployment": "NOT_EXECUTED"}}))


if __name__ == "__main__":
    materialize(Path(__file__).resolve().parents[1])
