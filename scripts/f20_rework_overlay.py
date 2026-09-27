"""Validate the append-only F-20 R1 rework transition."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import subprocess


HISTORICAL_COUNT = 1714
HISTORICAL_SHA256 = "AED3D00DF31948AED95781A21FCD52EAB10EFFD2247321EB6A6BBEA5CD92714F"
HISTORICAL_RAW_PREFIX_BYTES = 4419645
HISTORICAL_RAW_PREFIX_SHA256 = "A6819BD667C4BB3A48888AC9674131CCF782AC81D6636F7E97CF7008E9D19D75"
OLD_MANIFEST = "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json"
OLD_REPORT = "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md"
WI = "docs/work_orders/F-20_REWORK_R1_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_REWORK_R1_INVOCATION.md"
MODE = "F20_R1_REWORK_START"
ACTOR = "developer-primary-f20-r1"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-r1-rework-start.json"
MANIFEST = "docs/evidence/manifests/F-20_R1_REWORK_START_MANIFEST.json"
SCOPE = [
    "docs/04_test_reports/F-20_REWORK_R1_RESULT.md",
    "packages/agent_team/worktree_writes.py",
    "tests/agent_team/test_worktree_writes_e06.py",
]
CONTROL_SCOPE = {
    "docs/WORK_STATUS.md",
    "docs/04_test_reports/F-20_CONTROL_REWORK_PLAN.md",
    "docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md",
    "docs/progress/progress-events.json",
    "docs/progress/build-progress.json",
    "docs/progress/BUILD_HANDOFF.md",
    DIGEST, MANIFEST,
    "docs/work_orders/F-20_REWORK_R1_WORK_INSTRUCTION.md",
    "docs/work_orders/F-20_REWORK_R1_INVOCATION.md",
    "scripts/f20_rework_overlay.py",
    "scripts/check_project_progress.py",
    "tests/tooling/test_f20_rework_projection.py",
}
EVENT_TYPES = [
    "EVIDENCE_MANIFEST_INVALIDATED",
    "WORK_INSTRUCTION_ISSUED",
    "WORKER_LEASE_ISSUED",
    "WRITE_LEASE_ISSUED",
    "PACKAGE_RESUMED",
]


def _sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest().upper()


def _lf(value: bytes) -> bytes:
    """Use the repository's declared LF representation, not Windows checkout EOLs."""
    return value.replace(b"\r\n", b"\n")


def _canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _active_lease(row: object, now: datetime) -> bool:
    if not isinstance(row, dict):
        return False
    try:
        issued = datetime.fromisoformat(row["issued_at"])
        expires = datetime.fromisoformat(row["expires_at"])
        return (
            issued.tzinfo is not None and expires.tzinfo is not None
            and issued <= now < expires
            and timedelta(0) < expires - issued <= timedelta(hours=12)
            and row.get("status") == "ACTIVE"
            and row.get("actor_id") == ACTOR
            and row.get("subject_ref") == "F-20/R1"
            and row.get("path_scope") == SCOPE
        )
    except (KeyError, ValueError, TypeError, OverflowError):
        return False


def _historical_fencing_tokens(events: list[dict]) -> set[str]:
    tokens: set[str] = set()
    stack: list[object] = [event.get("details") for event in events]
    while stack:
        value = stack.pop()
        if isinstance(value, dict):
            for key, item in value.items():
                if key in {"fencing_token", "execution_fencing_token", "write_fencing_token"} and isinstance(item, str):
                    tokens.add(item)
                elif isinstance(item, (dict, list)):
                    stack.append(item)
        elif isinstance(value, list):
            stack.extend(value)
    return tokens


def validate_transition(events: list[dict], wi_sha: str, invocation_sha: str, now: datetime) -> list[str]:
    if not isinstance(events, list) or len(events) != HISTORICAL_COUNT + len(EVENT_TYPES):
        return ["F20_REWORK_TRANSITION_INVALID"]
    if _sha(_canonical(events[:HISTORICAL_COUNT])) != HISTORICAL_SHA256:
        return ["F20_REWORK_HISTORY_MUTATED"]

    tail = events[HISTORICAL_COUNT:]
    for index, (event, event_type) in enumerate(zip(tail, EVENT_TYPES)):
        sequence = HISTORICAL_COUNT + index + 1
        if (
            event.get("sequence") != sequence
            or event.get("event_type") != event_type
            or event.get("event_id") != f"evt_f20_{sequence}_{event_type.lower()}"
            or event.get("actor") != "main-agent-eoul"
            or event.get("actor_id") != "main-agent-eoul"
            or event.get("actor_type") != "AGENT"
            or event.get("project_id") != "anvil"
            or event.get("work_package_id") != "F-20"
            or event.get("run_id") is not None
            or event.get("step_id") != "F-20_R1_REWORK_START"
            or event.get("subject_ref") != "F-20/R1"
            or event.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"
            or event.get("previous_event_sha256") != _sha(_canonical(events[sequence - 2]))
            or not isinstance(event.get("details"), dict)
        ):
            return ["F20_REWORK_TRANSITION_INVALID"]

    invalidation, instruction, worker_event, write_event, resumed = [event["details"] for event in tail]
    worker, write = worker_event, write_event
    prior_tokens = _historical_fencing_tokens(events[:HISTORICAL_COUNT])
    execution_token = worker.get("execution_fencing_token")
    write_token = write.get("write_fencing_token")
    valid = (
        invalidation.get("manifest_ref") == OLD_MANIFEST
        and invalidation.get("reason") == "F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH"
        and invalidation.get("invalidated_event_id") == "evt_f20_1714_main_package_accepted"
        and invalidation.get("invalidated_event_sequence") == 1714
        and invalidation.get("historical_bytes_mutated") is False
        and instruction.get("path") == WI
        and instruction.get("sha256") == wi_sha
        and instruction.get("invocation_path") == INVOCATION
        and instruction.get("invocation_sha256") == invocation_sha
        and _active_lease(worker, now)
        and _active_lease(write, now)
        and worker.get("lease_epoch") == 1
        and write.get("write_epoch") == 1
        and isinstance(worker.get("lease_id"), str)
        and worker.get("lease_id", "").startswith("worker-lease-f20-r1-")
        and isinstance(write.get("lease_id"), str)
        and write.get("lease_id", "").startswith("write-lease-f20-r1-")
        and write.get("worker_lease_id") == worker.get("lease_id")
        and isinstance(execution_token, str) and bool(execution_token)
        and isinstance(write_token, str) and bool(write_token)
        and execution_token not in prior_tokens
        and write_token not in prior_tokens
        and worker.get("execution_fencing_token") == worker.get("fencing_token")
        and write.get("execution_fencing_token") == worker.get("execution_fencing_token")
        and write.get("write_fencing_token") == write.get("fencing_token")
        and worker.get("execution_fencing_token") != write.get("write_fencing_token")
        and worker.get("issued_at") == write.get("issued_at")
        and worker.get("expires_at") == write.get("expires_at")
        and resumed.get("resume_event_ref") == tail[0]["event_id"]
        and resumed.get("worker_lease_id") == worker.get("lease_id")
        and resumed.get("write_lease_id") == write.get("lease_id")
        and resumed.get("work_instruction_sha256") == wi_sha
        and resumed.get("invocation_sha256") == invocation_sha
        and resumed.get("package_status") == "REWORK_IN_PROGRESS"
        and resumed.get("accepted") is False
    )
    return [] if valid else ["F20_REWORK_TRANSITION_INVALID"]


def validate_rework_progress(progress: dict, events: list[dict], wi_sha: str, invocation_sha: str, now: datetime) -> list[str]:
    errors = validate_transition(events, wi_sha, invocation_sha, now)
    if not isinstance(progress, dict):
        return sorted(set(errors + ["F20_REWORK_PROGRESS_INVALID"]))
    if (
        "F-20" in progress.get("completed_packages", [])
        or progress.get("wsl_full_suite") == "PASS"
        or progress.get("f20_overall_status") in {"ACCEPTED", "COMPLETED"}
    ):
        errors.append("F20_REWORK_FALSE_ACCEPTANCE")
    wi = progress.get("active_work_instruction") or {}
    repo = progress.get("repository") or {}
    if (
        progress.get("event_sequence") != 1719
        or progress.get("last_event_id") != events[-1].get("event_id")
        or progress.get("status") != "ACTIVE"
        or progress.get("current_work_package") != "F-20"
        or progress.get("active_agent") != ACTOR
        or progress.get("worker_lease") != events[-3].get("details")
        or progress.get("write_lease") != events[-2].get("details")
        or wi.get("path") != WI
        or wi.get("sha256") != wi_sha
        or wi.get("invocation_path") != INVOCATION
        or wi.get("invocation_sha256") != invocation_sha
        or wi.get("result_status") != "REWORK_IN_PROGRESS"
        or wi.get("package_status") != "REWORK_IN_PROGRESS"
        or repo.get("projection_mode") != MODE
        or repo.get("branch") != "codex/f18-wsl-ops"
        or repo.get("upstream") != "development/codex/f18-wsl-ops"
        or repo.get("validated_base_commit") != (progress.get("worker_lease") or {}).get("dispatch_head")
        or repo.get("validated_base_commit") != (progress.get("write_lease") or {}).get("dispatch_head")
        or repo.get("product_write_scope") != SCOPE
        or progress.get("next_safe_action") != "F20_R1_GIT_WRITE_ERROR_REWORK"
        or progress.get("runtime_next_action") != "F20_R1_GIT_WRITE_ERROR_REWORK"
        or progress.get("next_work_package") != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
        or progress.get("next_successor_work_package") != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
    ):
        errors.append("F20_REWORK_PROGRESS_INVALID")
    return sorted(set(errors))


def validate_git_facts(*, branch: str, upstream: str, base: str, head: str,
                       remote_head: str, base_ancestor_head: bool,
                       base_ancestor_remote: bool, dirty: set[str],
                       changed: set[str]) -> list[str]:
    valid = (
        branch == "codex/f18-wsl-ops"
        and upstream == "development/codex/f18-wsl-ops"
        and all(re.fullmatch(r"[0-9a-f]{40}", value or "") for value in (base, head, remote_head))
        and base_ancestor_head and base_ancestor_remote
        and dirty <= CONTROL_SCOPE | set(SCOPE)
        and changed <= CONTROL_SCOPE | set(SCOPE)
    )
    return [] if valid else ["F20_REWORK_GIT_INVALID"]


def collect_git(root: Path, progress: dict) -> list[str]:
    root = Path(root)

    def git(*args: str) -> str:
        return subprocess.run(
            ["git", "-c", "core.excludesFile=", "-c", "core.quotepath=false", *args],
            cwd=root, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout.strip()

    def ancestor(base: str, target: str) -> bool:
        return subprocess.run(
            ["git", "merge-base", "--is-ancestor", base, target],
            cwd=root, capture_output=True, check=False,
        ).returncode == 0

    try:
        base = (progress.get("repository") or {})["validated_base_commit"]
        branch = git("branch", "--show-current")
        upstream = git("rev-parse", "--abbrev-ref", "@{upstream}")
        head = git("rev-parse", "HEAD")
        remote_head = git("rev-parse", "development/codex/f18-wsl-ops")
        changed = set(filter(None, git("diff", "--no-renames", "--name-only", f"{base}..HEAD").splitlines()))
        dirty = set(filter(None, git("diff", "--no-renames", "--name-only").splitlines()))
        dirty.update(filter(None, git("diff", "--cached", "--no-renames", "--name-only").splitlines()))
        dirty.update(filter(None, git("ls-files", "--others", "--exclude-standard").splitlines()))
        return validate_git_facts(
            branch=branch, upstream=upstream, base=base, head=head, remote_head=remote_head,
            base_ancestor_head=ancestor(base, head), base_ancestor_remote=ancestor(base, remote_head),
            dirty=dirty, changed=changed,
        )
    except (OSError, subprocess.CalledProcessError, KeyError, TypeError):
        return ["F20_REWORK_GIT_INVALID"]


def _pretty(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def _append_events_raw(original: bytes, old_event_id: str, additions: list[dict]) -> bytes:
    original = _lf(original)
    marker = b'\n  ],\n  "last_event_id": "' + old_event_id.encode() + b'"'
    if original.count(marker) != 1 or original.count(b'"last_sequence": 1714') != 1:
        raise RuntimeError("F20_REWORK_EVENT_BYTES_INVALID")
    new_marker = marker.replace(old_event_id.encode(), additions[-1]["event_id"].encode())
    inserted = b",\n" + b",\n".join(_pretty(row).rstrip() for row in additions)
    return original.replace(marker, inserted + new_marker).replace(
        b'"last_sequence": 1714', b'"last_sequence": 1719', 1
    )


def materialize(root: Path, dispatch_head: str, at: datetime, nonce: str) -> None:
    """Build a new control projection; never rewrite historical event entries."""
    root = Path(root)
    events_path = root / "docs/progress/progress-events.json"
    progress_path = root / "docs/progress/build-progress.json"
    handoff_path = root / "docs/progress/BUILD_HANDOFF.md"
    original = events_path.read_bytes()
    stream = json.loads(original)
    rows = stream.get("events", [])
    progress = json.loads(progress_path.read_bytes())
    if (
        len(rows) != HISTORICAL_COUNT
        or _sha(_canonical(rows)) != HISTORICAL_SHA256
        or stream.get("last_sequence") != HISTORICAL_COUNT
        or progress.get("event_sequence") != HISTORICAL_COUNT
        or progress.get("current_work_package") != "F-20"
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or not re.fullmatch(r"[0-9a-f]{40}", dispatch_head)
        or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
        or at.tzinfo is None
    ):
        raise RuntimeError("F20_REWORK_PREDECESSOR_INVALID")
    old_details = rows[-1]["details"]
    report_ref = old_details["test_report_ref"]
    old_report_raw = _lf((root / report_ref).read_bytes())
    old_manifest_raw = _lf((root / OLD_MANIFEST).read_bytes())
    if (
        old_details.get("manifest_ref") != OLD_MANIFEST
        or old_details.get("test_report_sha256") == _sha(old_report_raw)
        and old_details.get("manifest_sha256") == _sha(old_manifest_raw)
    ):
        raise RuntimeError("F20_REWORK_PREDECESSOR_INVALID")
    wi_raw = _lf((root / WI).read_bytes())
    invocation_raw = _lf((root / INVOCATION).read_bytes())
    wi_sha, invocation_sha = _sha(wi_raw), _sha(invocation_raw)
    at_text = at.isoformat(timespec="seconds")
    expires = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    worker_id = f"worker-lease-f20-r1-{nonce}"
    write_id = f"write-lease-f20-r1-{nonce}"
    execution_token = f"f20-r1-execution-fence-epoch-1-{nonce}"
    write_token = f"f20-r1-write-fence-epoch-1-{nonce}"
    worker = {
        "lease_id": worker_id, "actor_id": ACTOR, "subject_ref": "F-20/R1", "status": "ACTIVE",
        "issued_at": at_text, "expires_at": expires, "lease_epoch": 1,
        "fencing_token": execution_token, "execution_fencing_token": execution_token,
        "baseline_git_commit": dispatch_head, "dispatch_head": dispatch_head,
        "path_scope": SCOPE,
    }
    write = {
        **worker, "lease_id": write_id, "worker_lease_id": worker_id, "write_epoch": 1,
        "fencing_token": write_token, "write_fencing_token": write_token,
    }
    additions = []
    for event_type, details in [
        ("EVIDENCE_MANIFEST_INVALIDATED", {
            "manifest_ref": OLD_MANIFEST, "manifest_sha256": _sha(old_manifest_raw),
            "reason": "F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH",
            "invalidated_event_id": rows[-1]["event_id"], "invalidated_event_sequence": 1714,
            "historical_bytes_mutated": False,
            "test_report_ref": report_ref, "actual_test_report_sha256": _sha(old_report_raw),
            "actual_manifest_sha256": _sha(old_manifest_raw),
        }),
        ("WORK_INSTRUCTION_ISSUED", {
            "path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha, "classification": "MAIN_INTERNAL_REWORK",
        }),
        ("WORKER_LEASE_ISSUED", worker),
        ("WRITE_LEASE_ISSUED", write),
        ("PACKAGE_RESUMED", {
            "resume_event_ref": "evt_f20_1715_evidence_manifest_invalidated",
            "worker_lease_id": worker_id, "write_lease_id": write_id,
            "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
            "package_status": "REWORK_IN_PROGRESS", "accepted": False,
        }),
    ]:
        sequence = HISTORICAL_COUNT + len(additions) + 1
        previous = additions[-1] if additions else rows[-1]
        additions.append({
            "sequence": sequence, "event_id": f"evt_f20_{sequence}_{event_type.lower()}",
            "event_type": event_type, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
            "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
            "run_id": None, "step_id": "F-20_R1_REWORK_START", "subject_ref": "F-20/R1",
            "occurred_at": at_text,
            "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
            "previous_event_sha256": _sha(_canonical(previous)), "details": details,
        })
    new_events = rows + additions
    if validate_transition(new_events, wi_sha, invocation_sha, at):
        raise RuntimeError("F20_REWORK_TRANSITION_INVALID")
    event_raw = _append_events_raw(original, rows[-1]["event_id"], additions)

    progress = deepcopy(progress)
    progress.update({
        "snapshot_id": "snapshot-f20-r1-rework-start-seq1719", "event_sequence": 1719,
        "last_event_id": additions[-1]["event_id"], "updated_at": at_text,
        "status": "ACTIVE", "current_work_package": "F-20", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "f20_overall_status": "REWORK_IN_PROGRESS",
        "wsl_full_suite": "FAIL_1080_PASSED_1_FAILED_PRE_REWORK",
        "next_safe_action": "F20_R1_GIT_WRITE_ERROR_REWORK",
        "runtime_next_action": "F20_R1_GIT_WRITE_ERROR_REWORK",
        "active_work_instruction": {
            "artifact_id": "WI-F-20-REWORK-R1-20260927-001", "path": WI, "sha256": wi_sha,
            "invocation_path": INVOCATION, "invocation_sha256": invocation_sha,
            "result_status": "REWORK_IN_PROGRESS", "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_INTERNAL_REWORK",
        },
        "next_work_package": {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"},
        "next_successor_work_package": {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST, "manifest_path": MANIFEST},
        "f20_invalidated_acceptance": {"event_id": rows[-1]["event_id"], "invalidation_event_id": additions[0]["event_id"]},
    })
    progress["completed_packages"] = [item for item in progress["completed_packages"] if item != "F-20"]
    progress["repository"].update({
        "branch": "codex/f18-wsl-ops", "upstream": "development/codex/f18-wsl-ops",
        "local_head": dispatch_head, "remote_head": dispatch_head,
        "validated_base_commit": dispatch_head, "projection_mode": MODE,
        "head_relation": "BASE_OR_FEATURE_DESCENDANT", "worktree_status": "F20_R1_REWORK_ACTIVE",
        "product_write_scope": SCOPE, "commit_status": "PENDING", "push_status": "PENDING",
    })
    progress["registry_refs"]["progress_events"]["sha256"] = _sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_raw = _pretty(progress)
    summary = {
        "event_sequence": 1719, "last_event_id": additions[-1]["event_id"],
        "status": "ACTIVE", "current_work_package": "F-20", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "next_safe_action": "F20_R1_GIT_WRITE_ERROR_REWORK",
        "repository_head": dispatch_head,
        "repository_upstream": "development/codex/f18-wsl-ops",
        "reporting_decision": progress["reporting_decision"]["decision"],
    }
    handoff_raw = b"# F-20 R1 append-only evidence invalidation and bounded rework\n\n```json anvil-recovery-summary\n" + _pretty(summary) + b"```\n\n- Historical acceptance invalidated; F-20 incomplete; Production NOT_EXECUTED.\n"
    digest_raw = _pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1719,
        "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw), "file_sha256": _sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw), "file_sha256": _sha(handoff_raw)},
    })
    checksums = []
    for relative, raw in ((WI, wi_raw), (INVOCATION, invocation_raw),
                          (report_ref, old_report_raw), (OLD_MANIFEST, old_manifest_raw)):
        checksums.append({"path": relative, "bytes": len(raw), "sha256": _sha(raw)})
    manifest_raw = _pretty({
        "schema_version": "1.0.0", "package_id": "F-20", "event_sequence": 1719,
        "accepted": False, "projection_mode": MODE,
        "historical_event_prefix_sha256": HISTORICAL_SHA256,
        "invalidated_acceptance_event_id": rows[-1]["event_id"],
        "product_write_scope": SCOPE, "raw_checksums": checksums,
        "self_reference": False, "production": "NOT_EXECUTED",
    })
    outputs = {
        DIGEST: digest_raw, MANIFEST: manifest_raw,
        "docs/progress/BUILD_HANDOFF.md": handoff_raw,
        "docs/progress/progress-events.json": event_raw,
        "docs/progress/build-progress.json": progress_raw,
    }
    for relative, raw in outputs.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    """Check the new projection without treating old accepted evidence as valid."""
    root = Path(root)
    progress = bundle.get("progress") or {}
    stream = bundle.get("events") or {}
    rows = stream.get("events") or []
    if not isinstance(rows, list) or len(rows) != HISTORICAL_COUNT + len(EVENT_TYPES):
        return ["F20_REWORK_TRANSITION_INVALID"]
    try:
        wi_sha = _sha(_lf((root / WI).read_bytes()))
        invocation_sha = _sha(_lf((root / INVOCATION).read_bytes()))
        events_raw = (root / "docs/progress/progress-events.json").read_bytes()
        progress_raw = (root / "docs/progress/build-progress.json").read_bytes()
        handoff_raw = (root / "docs/progress/BUILD_HANDOFF.md").read_bytes()
        old_manifest_raw = _lf((root / OLD_MANIFEST).read_bytes())
        old_report_raw = _lf((root / OLD_REPORT).read_bytes())
        digest = json.loads((root / DIGEST).read_bytes())
        manifest = json.loads((root / MANIFEST).read_bytes())
    except (OSError, ValueError, TypeError):
        return ["F20_REWORK_CONTROL_MISSING"]

    errors = validate_rework_progress(progress, rows, wi_sha, invocation_sha, now)
    historical_prefix = _lf(events_raw)[:HISTORICAL_RAW_PREFIX_BYTES]
    historical_prefix = historical_prefix.replace(b'"last_sequence": 1719', b'"last_sequence": 1714', 1)
    if _sha(historical_prefix) != HISTORICAL_RAW_PREFIX_SHA256:
        errors.append("F20_REWORK_HISTORY_BYTES_MUTATED")
    invalidation = rows[HISTORICAL_COUNT].get("details") or {}
    if (
        invalidation.get("manifest_sha256") != _sha(old_manifest_raw)
        or invalidation.get("actual_manifest_sha256") != _sha(old_manifest_raw)
        or invalidation.get("test_report_ref") != OLD_REPORT
        or invalidation.get("actual_test_report_sha256") != _sha(old_report_raw)
    ):
        errors.append("F20_REWORK_INVALIDATION_EVIDENCE_MISMATCH")
    if (
        stream.get("last_sequence") != 1719
        or stream.get("last_event_id") != rows[-1].get("event_id")
        or progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != _sha(events_raw)
        or json.loads(events_raw).get("events") != rows
    ):
        errors.append("F20_REWORK_EVENT_PROJECTION_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    if progress.get("snapshot_hash") != _sha(_canonical(snapshot)):
        errors.append("F20_REWORK_SNAPSHOT_INVALID")

    if (
        progress.get("current_progress_evidence_ref") !=
        {"package_id": "F-20", "path": DIGEST, "manifest_path": MANIFEST}
        or digest.get("event_sequence") != 1719
        or digest.get("self_reference") is not False
        or digest.get("progress", {}).get("file_sha256") != _sha(progress_raw)
        or digest.get("progress", {}).get("bytes") != len(progress_raw)
        or digest.get("handoff", {}).get("file_sha256") != _sha(handoff_raw)
        or digest.get("handoff", {}).get("bytes") != len(handoff_raw)
    ):
        errors.append("F20_REWORK_DIGEST_INVALID")
    try:
        handoff_text = handoff_raw.decode("utf-8")
        match = re.search(r"```json anvil-recovery-summary\s*(\{.*?\})\s*```", handoff_text, re.DOTALL)
        summary = json.loads(match.group(1)) if match else {}
        if (
            summary.get("event_sequence") != 1719
            or summary.get("last_event_id") != rows[-1].get("event_id")
            or summary.get("worker_lease") != progress.get("worker_lease")
            or summary.get("write_lease") != progress.get("write_lease")
            or summary.get("next_safe_action") != progress.get("next_safe_action")
        ):
            errors.append("F20_REWORK_HANDOFF_INVALID")
    except (UnicodeDecodeError, ValueError, TypeError):
        errors.append("F20_REWORK_HANDOFF_INVALID")

    expected_paths = {
        WI, INVOCATION, OLD_MANIFEST,
        "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md",
    }
    manifest_rows = manifest.get("raw_checksums") or []
    if (
        manifest.get("package_id") != "F-20"
        or manifest.get("event_sequence") != 1719
        or manifest.get("accepted") is not False
        or manifest.get("projection_mode") != MODE
        or manifest.get("historical_event_prefix_sha256") != HISTORICAL_SHA256
        or manifest.get("invalidated_acceptance_event_id") != rows[HISTORICAL_COUNT - 1].get("event_id")
        or manifest.get("product_write_scope") != SCOPE
        or manifest.get("production") != "NOT_EXECUTED"
        or {entry.get("path") for entry in manifest_rows} != expected_paths
    ):
        errors.append("F20_REWORK_MANIFEST_INVALID")
    else:
        for entry in manifest_rows:
            path = root / entry["path"]
            if not path.is_file():
                errors.append("F20_REWORK_MANIFEST_INVALID")
                break
            raw = _lf(path.read_bytes())
            if (entry.get("bytes"), entry.get("sha256")) != (len(raw), _sha(raw)):
                errors.append("F20_REWORK_MANIFEST_INVALID")
                break
    return sorted(set(errors))
