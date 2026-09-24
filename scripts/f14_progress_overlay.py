"""F-14 start projection and scoped Git/progress gate."""

from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import subprocess

BASE = "1584523ccca71bae4b3be01f592c7eb79c11935f"
BRANCH = "codex/f14-postgres-recovery"
MODE = "F14_START_EXACT11_PRODUCT_EXACT12"
ACTOR = "developer-primary-f14-r1"
WORKER = "worker-lease-f14-r1-20260924-001"
WRITE = "write-lease-f14-r1-20260924-001"
EXECUTION_TOKEN = "f14-r1-execution-fence-epoch-1-1584523ccca71bae"
WRITE_TOKEN = "f14-r1-write-fence-epoch-1-4b3be01f592c7eb7"
AT = "2026-09-24T08:39:00+09:00"
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


def _append(events, event_type, details):
    sequence = events[-1]["sequence"] + 1
    event = {
        "sequence": sequence, "event_id": f"evt_f14_{sequence}_{event_type.lower()}",
        "event_type": event_type, "actor": "main-agent-eoul",
        "actor_id": "main-agent-eoul", "actor_type": "AGENT",
        "project_id": "anvil", "work_package_id": "F-14", "run_id": None,
        "step_id": "START", "subject_ref": "F-14/START", "occurred_at": AT,
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


def collect_git(root):
    root = Path(root)
    def run(*args):
        return subprocess.check_output(["git", "-c", "core.excludesFile=", *args],
                                       cwd=root, text=True).strip()
    head = run("rev-parse", "HEAD")
    branch = run("branch", "--show-current")
    upstream = run("rev-parse", "--abbrev-ref", "@{upstream}")
    remote_head = run("rev-parse", f"development/{BRANCH}")
    staged = set(filter(None, run("diff", "--cached", "--name-only").splitlines()))
    status = subprocess.check_output(["git", "-c", "core.excludesFile=", "status",
                                      "--porcelain=v1", "--untracked-files=all"], cwd=root, text=True)
    dirty = {line[3:].replace("\\", "/") for line in status.splitlines() if line}
    changed = set(filter(None, run("diff", "--name-only", f"{BASE}..{head}").splitlines()))
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head], cwd=root).returncode == 0
    remote_ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", remote_head, head],
                                     cwd=root).returncode == 0
    return validate_start_git_facts(head=head, branch=branch, upstream=upstream,
        remote_head=remote_head, staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=ancestor, remote_is_ancestor=remote_ancestor)


def validate(root, bundle):
    root = Path(root)
    progress, ledger = bundle["progress"], bundle["events"]
    errors = []
    if (progress.get("repository", {}).get("projection_mode") != MODE
            or progress.get("event_sequence") != 1459 or ledger.get("last_sequence") != 1459
            or progress.get("current_work_package") != "F-14" or progress.get("status") != "ACTIVE"):
        errors.append("F14_START_STATE_INVALID")
    if (progress.get("active_agent") != ACTOR
            or progress.get("worker_lease", {}).get("lease_id") != WORKER
            or progress.get("write_lease", {}).get("lease_id") != WRITE
            or progress.get("write_lease", {}).get("worker_lease_id") != WORKER
            or progress.get("write_lease", {}).get("path_scope") != product_paths()):
        errors.append("F14_LEASE_INVALID")
    events = ledger["events"]
    for before, after in zip(events[-5:], events[-4:]):
        if after.get("previous_event_sha256") != _sha(_canonical(before)):
            errors.append("F14_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F14_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not False
            or manifest.get("exact_allowed_paths") != control_paths()
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
