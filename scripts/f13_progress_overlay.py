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
BRANCH = "codex/f13-operations-read-model"
MODE = "F13_START_EXACT11_PRODUCT_EXACT9"
ACTOR = "developer-primary-f13-r1"
WORKER = "worker-lease-f13-r1-20260924-001"
WRITE = "write-lease-f13-r1-20260924-001"
EXECUTION_TOKEN = "f13-r1-execution-fence-epoch-1-a612fdac2c7eabbb"
WRITE_TOKEN = "f13-r1-write-fence-epoch-1-381e8da9d3111d79"
AT = "2026-09-24T07:45:00+09:00"
EXPIRES = "2026-09-24T19:45:00+09:00"
WI = "docs/work_orders/F-13_WORK_INSTRUCTION.md"
PROMPT = "docs/work_orders/F-13_INVOCATION_PROMPT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f13.json"
MANIFEST = "docs/evidence/manifests/F-13_PROGRESS_MANIFEST.json"


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


def _append(events, kind, details):
    sequence = events[-1]["sequence"] + 1
    event = {
        "sequence": sequence,
        "event_id": f"evt_f13_{sequence}_{kind.lower()}",
        "event_type": kind,
        "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
        "project_id": "anvil", "work_package_id": "F-13", "run_id": None,
        "step_id": "START", "subject_ref": "F-13/START", "occurred_at": AT,
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
    return validate_start_git_facts(head=head, branch=branch, upstream=upstream,
        remote_head=remote_head, staged=staged, dirty=dirty, changed=changed,
        base_is_ancestor=ancestor)


def validate(root, bundle):
    root = Path(root)
    progress = bundle["progress"]
    ledger = bundle["events"]
    errors = []
    if (progress.get("repository", {}).get("projection_mode") != MODE
            or progress.get("event_sequence") != 1450 or ledger.get("last_sequence") != 1450
            or progress.get("current_work_package") != "F-13" or progress.get("status") != "ACTIVE"):
        errors.append("F13_START_STATE_INVALID")
    if (progress.get("active_agent") != ACTOR
            or progress.get("worker_lease", {}).get("lease_id") != WORKER
            or progress.get("write_lease", {}).get("lease_id") != WRITE
            or progress.get("write_lease", {}).get("worker_lease_id") != WORKER
            or progress.get("write_lease", {}).get("path_scope") != product_paths()):
        errors.append("F13_LEASE_INVALID")
    events = ledger["events"]
    for before, after in zip(events[-4:], events[-3:]):
        if after.get("previous_event_sha256") != _event_sha(before):
            errors.append("F13_EVENT_CHAIN_INVALID")
    digest = json.loads((root / DIGEST).read_text(encoding="utf-8"))
    for key, relative in (("progress", "docs/progress/build-progress.json"),
                          ("handoff", "docs/progress/BUILD_HANDOFF.md")):
        raw = (root / relative).read_bytes()
        if (digest[key]["bytes"], digest[key]["file_sha256"]) != (len(raw), _sha(raw)):
            errors.append("F13_DIGEST_INVALID")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (manifest.get("accepted") is not False or manifest.get("exact_allowed_paths") != control_paths()
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
