"""Append-only F-20 R1-to-R2 write-lease handoff for WSL suite recovery."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_rework_overlay as r1
except ModuleNotFoundError:  # direct `python scripts/check_project_progress.py`
    import f20_rework_overlay as r1


MODE = "F20_R2_REWORK_START"
ACTOR = "developer-primary-f20-r2"
WI = "docs/work_orders/F-20_REWORK_R2_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_REWORK_R2_INVOCATION.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-r2-rework-start.json"
MANIFEST = "docs/evidence/manifests/F-20_R2_REWORK_START_MANIFEST.json"
SCOPE = [
    "docs/04_test_reports/F-20_REWORK_R2_RESULT.md",
    "packages/paths/identity.py",
    "tests/paths/test_conflict_scope_identity.py",
    "tests/deploy/test_wsl_staging_harness.py",
    "tests/tooling/test_a14_workbench_prototype.py",
    "tests/execution_backends/test_git_worktree.py",
    "tests/persistence/test_oidc_pending_auth.py",
    "tests/integration/test_c30r3_formal_entity.py",
]
OLD_RAW_PREFIX_BYTES = 4425584
OLD_RAW_PREFIX_SHA256 = "7070DC3E9C8BC2E66DFF7FAEFB44E5A8018280ACF649CD43B460F5D4D4DFA518"
OLD_EVENTS_SHA256 = "38F6ED13A9C16FDAB37391FC551DFA2D05647AD376CB5F58EC768C97D7EA2A0E"
OLD_LAST = "evt_f20_1719_package_resumed"
TYPES = (
    "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
    "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
)
CONTROL_SCOPE = r1.CONTROL_SCOPE | {
    WI, INVOCATION, DIGEST, MANIFEST,
    "scripts/f20_rework_r2_overlay.py",
    "tests/tooling/test_f20_rework_r2_projection.py",
}


def _old_prefix_valid(raw: bytes, rows: list[dict]) -> bool:
    raw = r1._lf(raw)
    prefix = raw[:OLD_RAW_PREFIX_BYTES].replace(
        b'"last_sequence": 1725', b'"last_sequence": 1719', 1)
    return (
        len(raw) >= OLD_RAW_PREFIX_BYTES
        and r1._sha(prefix) == OLD_RAW_PREFIX_SHA256
        and len(rows) >= 1719
        and r1._sha(r1._canonical(rows[:1719])) == OLD_EVENTS_SHA256
    )


def _event(previous: dict, event_type: str, details: dict, at: str) -> dict:
    sequence = previous["sequence"] + 1
    return {
        "sequence": sequence, "event_id": f"evt_f20_{sequence}_{event_type.lower()}",
        "event_type": event_type, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
        "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
        "run_id": None, "step_id": "F-20_R2_REWORK_START", "subject_ref": "F-20/R2",
        "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": r1._sha(r1._canonical(previous)), "details": details,
    }


def _active(row: object, now: datetime) -> bool:
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
            and row.get("subject_ref") == "F-20/R2"
            and row.get("path_scope") == SCOPE
            and row.get("lease_epoch") == 2
        )
    except (KeyError, ValueError, TypeError, OverflowError):
        return False


def validate_transition(rows: object, wi_sha: str, invocation_sha: str,
                        now: datetime) -> list[str]:
    if not isinstance(rows, list) or len(rows) != 1725 or not all(isinstance(row, dict) for row in rows):
        return ["F20_R2_TRANSITION_INVALID"]
    if r1._sha(r1._canonical(rows[:1719])) != OLD_EVENTS_SHA256:
        return ["F20_R2_TRANSITION_INVALID"]
    old_worker = rows[1716]["details"]
    old_write = rows[1717]["details"]
    old_issued = datetime.fromisoformat(old_worker["issued_at"])
    old_instruction = rows[1715]["details"]
    if r1.validate_transition(rows[:1719], old_instruction["sha256"],
                              old_instruction["invocation_sha256"], old_issued):
        return ["F20_R2_TRANSITION_INVALID"]
    tail = rows[1719:]
    for index, (row, event_type) in enumerate(zip(tail, TYPES)):
        if (
            row.get("sequence") != 1720 + index
            or row.get("event_id") != f"evt_f20_{1720 + index}_{event_type.lower()}"
            or row.get("event_type") != event_type
            or row.get("actor") != "main-agent-eoul"
            or row.get("actor_id") != "main-agent-eoul"
            or row.get("actor_type") != "AGENT"
            or row.get("project_id") != "anvil"
            or row.get("work_package_id") != "F-20"
            or row.get("run_id") is not None
            or row.get("step_id") != "F-20_R2_REWORK_START"
            or row.get("subject_ref") != "F-20/R2"
            or row.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"
            or row.get("occurred_at") != tail[0].get("occurred_at")
            or row.get("previous_event_sha256") != r1._sha(r1._canonical(rows[1718 + index]))
            or not isinstance(row.get("details"), dict)
        ):
            return ["F20_R2_TRANSITION_INVALID"]
    revoke_write, revoke_worker, instruction, worker, write, resumed = [row["details"] for row in tail]
    prior_tokens = r1._historical_fencing_tokens(rows[:1719])
    execution_token = worker.get("execution_fencing_token")
    write_token = write.get("write_fencing_token")
    valid = (
        revoke_write.get("lease_id") == old_write.get("lease_id")
        and revoke_write.get("write_fencing_token") == old_write.get("write_fencing_token")
        and revoke_write.get("reason") == "F20_R1_EXACT3_DONE_R2_WSL_SUITE_RECOVERY"
        and revoke_worker.get("lease_id") == old_worker.get("lease_id")
        and revoke_worker.get("execution_fencing_token") == old_worker.get("execution_fencing_token")
        and revoke_worker.get("reason") == "F20_R1_EXACT3_DONE_R2_WSL_SUITE_RECOVERY"
        and instruction.get("path") == WI and instruction.get("sha256") == wi_sha
        and instruction.get("invocation_path") == INVOCATION
        and instruction.get("invocation_sha256") == invocation_sha
        and _active(worker, now) and _active(write, now)
        and worker.get("lease_id", "").startswith("worker-lease-f20-r2-")
        and write.get("lease_id", "").startswith("write-lease-f20-r2-")
        and write.get("worker_lease_id") == worker.get("lease_id")
        and write.get("write_epoch") == 2
        and worker.get("issued_at") == write.get("issued_at")
        and worker.get("expires_at") == write.get("expires_at")
        and worker.get("dispatch_head") == write.get("dispatch_head")
        and worker.get("baseline_git_commit") == worker.get("dispatch_head")
        and write.get("baseline_git_commit") == write.get("dispatch_head")
        and isinstance(execution_token, str) and bool(execution_token)
        and isinstance(write_token, str) and bool(write_token)
        and execution_token not in prior_tokens and write_token not in prior_tokens
        and execution_token != write_token
        and worker.get("fencing_token") == execution_token
        and write.get("execution_fencing_token") == execution_token
        and write.get("fencing_token") == write_token
        and resumed.get("worker_lease_id") == worker.get("lease_id")
        and resumed.get("write_lease_id") == write.get("lease_id")
        and resumed.get("work_instruction_sha256") == wi_sha
        and resumed.get("invocation_sha256") == invocation_sha
        and resumed.get("package_status") == "REWORK_IN_PROGRESS"
        and resumed.get("accepted") is False
    )
    return [] if valid else ["F20_R2_TRANSITION_INVALID"]


def _append_raw(raw: bytes, additions: list[dict]) -> bytes:
    raw = r1._lf(raw)
    marker = b'\n  ],\n  "last_event_id": "' + OLD_LAST.encode() + b'"'
    if raw.count(marker) != 1 or raw.count(b'"last_sequence": 1719') != 1:
        raise RuntimeError("F20_R2_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    return raw.replace(marker, insertion + marker.replace(OLD_LAST.encode(), additions[-1]["event_id"].encode())).replace(
        b'"last_sequence": 1719', b'"last_sequence": 1725', 1)


def materialize(root: Path, dispatch_head: str, at: datetime, nonce: str) -> None:
    root = Path(root)
    event_path = root / "docs/progress/progress-events.json"
    progress_path = root / "docs/progress/build-progress.json"
    raw = event_path.read_bytes()
    stream = json.loads(raw)
    rows = stream.get("events", [])
    progress = json.loads(progress_path.read_bytes())
    if (
        not _old_prefix_valid(raw, rows)
        or len(rows) != 1719 or stream.get("last_sequence") != 1719
        or progress.get("event_sequence") != 1719
        or progress.get("repository", {}).get("projection_mode") != r1.MODE
        or progress.get("worker_lease") != rows[1716].get("details")
        or progress.get("write_lease") != rows[1717].get("details")
        or at.tzinfo is None
        or not re.fullmatch(r"[0-9a-f]{40}", dispatch_head)
        or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
    ):
        raise RuntimeError("F20_R2_PREDECESSOR_INVALID")
    old_worker = progress["worker_lease"]
    old_write = progress["write_lease"]
    at_text = at.isoformat(timespec="seconds")
    expires = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    execution = f"f20-r2-execution-fence-epoch-2-{nonce}"
    write_token = f"f20-r2-write-fence-epoch-2-{nonce}"
    worker = {
        "lease_id": f"worker-lease-f20-r2-{nonce}", "actor_id": ACTOR,
        "subject_ref": "F-20/R2", "status": "ACTIVE", "issued_at": at_text,
        "expires_at": expires, "lease_epoch": 2, "fencing_token": execution,
        "execution_fencing_token": execution, "baseline_git_commit": dispatch_head,
        "dispatch_head": dispatch_head, "path_scope": SCOPE,
    }
    write = {
        **worker, "lease_id": f"write-lease-f20-r2-{nonce}",
        "worker_lease_id": worker["lease_id"], "write_epoch": 2,
        "fencing_token": write_token, "write_fencing_token": write_token,
    }
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    details = (
        {"lease_id": old_write["lease_id"], "write_fencing_token": old_write["write_fencing_token"],
         "reason": "F20_R1_EXACT3_DONE_R2_WSL_SUITE_RECOVERY"},
        {"lease_id": old_worker["lease_id"], "execution_fencing_token": old_worker["execution_fencing_token"],
         "reason": "F20_R1_EXACT3_DONE_R2_WSL_SUITE_RECOVERY"},
        {"path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
         "invocation_sha256": invocation_sha, "classification": "MAIN_INTERNAL_REWORK"},
        worker, write,
        {"worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
         "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
         "package_status": "REWORK_IN_PROGRESS", "accepted": False},
    )
    additions = []
    for event_type, detail in zip(TYPES, details):
        additions.append(_event(additions[-1] if additions else rows[-1], event_type, detail, at_text))
    new_rows = rows + additions
    if validate_transition(new_rows, wi_sha, invocation_sha, at):
        raise RuntimeError("F20_R2_TRANSITION_INVALID")
    event_raw = _append_raw(raw, additions)
    progress = deepcopy(progress)
    progress.update({
        "snapshot_id": "snapshot-f20-r2-rework-start-seq1725", "event_sequence": 1725,
        "last_event_id": additions[-1]["event_id"], "updated_at": at_text,
        "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "completed_f20_r1_worker_lease": {**old_worker, "status": "REVOKED", "revoked_at": at_text},
        "completed_f20_r1_write_lease": {**old_write, "status": "REVOKED", "revoked_at": at_text},
        "f20_overall_status": "REWORK_IN_PROGRESS", "wsl_full_suite": "FAIL_261_OF_8264_PRE_R2",
        "next_safe_action": "F20_R2_WSL_SUITE_PORTABILITY_REWORK",
        "runtime_next_action": "F20_R2_WSL_SUITE_PORTABILITY_REWORK",
        "active_work_instruction": {
            "artifact_id": "WI-F-20-REWORK-R2-20260928-001", "path": WI,
            "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
            "result_status": "REWORK_IN_PROGRESS", "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_INTERNAL_REWORK",
        },
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["repository"].update({
        "local_head": dispatch_head, "remote_head": dispatch_head,
        "validated_base_commit": dispatch_head, "projection_mode": MODE,
        "worktree_status": "F20_R2_REWORK_ACTIVE", "product_write_scope": SCOPE,
        "commit_status": "PENDING", "push_status": "PENDING",
    })
    progress["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(progress)
    summary = {
        "event_sequence": 1725, "last_event_id": additions[-1]["event_id"],
        "status": "ACTIVE", "current_work_package": "F-20", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "next_safe_action": progress["next_safe_action"], "repository_head": dispatch_head,
        "repository_upstream": "development/codex/f18-wsl-ops",
        "reporting_decision": progress["reporting_decision"]["decision"],
    }
    handoff_raw = (b"# F-20 R2 append-only lease handoff and WSL suite rework\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary) +
                   b"```\n\n- F-20 incomplete; Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": 1725,
        "self_reference": False,
        "progress": {"path": "docs/progress/build-progress.json", "bytes": len(progress_raw),
                     "file_sha256": r1._sha(progress_raw)},
        "handoff": {"path": "docs/progress/BUILD_HANDOFF.md", "bytes": len(handoff_raw),
                    "file_sha256": r1._sha(handoff_raw)},
    })
    manifest_raw = r1._pretty({
        "schema_version": "1.0.0", "package_id": "F-20", "event_sequence": 1725,
        "accepted": False, "projection_mode": MODE,
        "historical_event_prefix_sha256": OLD_RAW_PREFIX_SHA256,
        "previous_event_sequence": 1719, "product_write_scope": SCOPE,
        "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
        "production": "NOT_EXECUTED", "self_reference": False,
    })
    outputs = {
        "docs/progress/progress-events.json": event_raw,
        "docs/progress/build-progress.json": progress_raw,
        "docs/progress/BUILD_HANDOFF.md": handoff_raw,
        DIGEST: digest_raw, MANIFEST: manifest_raw,
    }
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    progress = bundle.get("progress") or {}
    stream = bundle.get("events") or {}
    rows = stream.get("events") or []
    if not isinstance(rows, list) or len(rows) != 1725:
        return ["F20_R2_TRANSITION_INVALID"]
    try:
        event_raw = (root / "docs/progress/progress-events.json").read_bytes()
        progress_raw = (root / "docs/progress/build-progress.json").read_bytes()
        handoff_raw = (root / "docs/progress/BUILD_HANDOFF.md").read_bytes()
        wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
        invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
        old_wi_sha = r1._sha(r1._lf((root / r1.WI).read_bytes()))
        old_invocation_sha = r1._sha(r1._lf((root / r1.INVOCATION).read_bytes()))
        old_manifest_sha = r1._sha(r1._lf((root / r1.OLD_MANIFEST).read_bytes()))
        old_report_sha = r1._sha(r1._lf((root / r1.OLD_REPORT).read_bytes()))
        digest = json.loads((root / DIGEST).read_bytes())
        manifest = json.loads((root / MANIFEST).read_bytes())
    except (OSError, ValueError, TypeError):
        return ["F20_R2_CONTROL_MISSING"]
    errors = validate_transition(rows, wi_sha, invocation_sha, now)
    if (old_wi_sha != rows[1715]["details"].get("sha256")
            or old_invocation_sha != rows[1715]["details"].get("invocation_sha256")
            or old_manifest_sha != rows[1714]["details"].get("manifest_sha256")
            or old_manifest_sha != rows[1714]["details"].get("actual_manifest_sha256")
            or old_report_sha != rows[1714]["details"].get("actual_test_report_sha256")
            or rows[1714]["details"].get("test_report_ref") != r1.OLD_REPORT):
        errors.append("F20_R2_HISTORY_MUTATED")
    if not _old_prefix_valid(event_raw, rows):
        errors.append("F20_R2_HISTORY_MUTATED")
    if (json.loads(event_raw) != stream or stream.get("last_sequence") != 1725
            or stream.get("last_event_id") != rows[-1].get("event_id")
            or progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != r1._sha(event_raw)):
        errors.append("F20_R2_EVENT_PROJECTION_INVALID")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    worker = rows[-3]["details"]
    write = rows[-2]["details"]
    repo = progress.get("repository") or {}
    instruction = progress.get("active_work_instruction") or {}
    if (
        progress.get("snapshot_hash") != r1._sha(r1._canonical(snapshot))
        or progress.get("event_sequence") != 1725
        or progress.get("last_event_id") != rows[-1].get("event_id")
        or progress.get("status") != "ACTIVE"
        or progress.get("current_work_package") != "F-20"
        or progress.get("active_agent") != ACTOR
        or progress.get("worker_lease") != worker
        or progress.get("write_lease") != write
        or progress.get("completed_f20_r1_worker_lease", {}).get("status") != "REVOKED"
        or progress.get("completed_f20_r1_write_lease", {}).get("status") != "REVOKED"
        or progress.get("completed_f20_r1_worker_lease", {}).get("revoked_at") != rows[1720]["occurred_at"]
        or progress.get("completed_f20_r1_write_lease", {}).get("revoked_at") != rows[1719]["occurred_at"]
        or {key: value for key, value in progress.get("completed_f20_r1_worker_lease", {}).items()
            if key not in {"status", "revoked_at"}} !=
            {key: value for key, value in rows[1716]["details"].items() if key != "status"}
        or {key: value for key, value in progress.get("completed_f20_r1_write_lease", {}).items()
            if key not in {"status", "revoked_at"}} !=
            {key: value for key, value in rows[1717]["details"].items() if key != "status"}
        or "F-20" in progress.get("completed_packages", [])
        or progress.get("f20_overall_status") in {"ACCEPTED", "COMPLETED"}
        or progress.get("wsl_full_suite") == "PASS"
        or instruction.get("path") != WI or instruction.get("sha256") != wi_sha
        or instruction.get("invocation_path") != INVOCATION
        or instruction.get("invocation_sha256") != invocation_sha
        or instruction.get("package_status") != "REWORK_IN_PROGRESS"
        or repo.get("projection_mode") != MODE or repo.get("product_write_scope") != SCOPE
        or repo.get("branch") != "codex/f18-wsl-ops"
        or repo.get("upstream") != "development/codex/f18-wsl-ops"
        or repo.get("validated_base_commit") != worker.get("dispatch_head")
        or repo.get("validated_base_commit") != write.get("dispatch_head")
        or progress.get("next_safe_action") != "F20_R2_WSL_SUITE_PORTABILITY_REWORK"
        or progress.get("runtime_next_action") != "F20_R2_WSL_SUITE_PORTABILITY_REWORK"
        or progress.get("next_work_package") != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
        or progress.get("next_successor_work_package") != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
        or progress.get("current_progress_evidence_ref") != {"package_id": "F-20", "path": DIGEST, "manifest_path": MANIFEST}
    ):
        errors.append("F20_R2_PROGRESS_INVALID")
    if (digest.get("event_sequence") != 1725 or digest.get("self_reference") is not False
            or digest.get("progress", {}).get("file_sha256") != r1._sha(progress_raw)
            or digest.get("progress", {}).get("bytes") != len(progress_raw)
            or digest.get("handoff", {}).get("file_sha256") != r1._sha(handoff_raw)
            or digest.get("handoff", {}).get("bytes") != len(handoff_raw)):
        errors.append("F20_R2_DIGEST_INVALID")
    try:
        match = re.search(r"```json anvil-recovery-summary\s*(\{.*?\})\s*```",
                          handoff_raw.decode("utf-8"), re.DOTALL)
        summary = json.loads(match.group(1)) if match else {}
        if (summary.get("event_sequence") != 1725
                or summary.get("last_event_id") != rows[-1].get("event_id")
                or summary.get("worker_lease") != worker or summary.get("write_lease") != write
                or summary.get("next_safe_action") != progress.get("next_safe_action")):
            errors.append("F20_R2_HANDOFF_INVALID")
    except (UnicodeDecodeError, ValueError, TypeError):
        errors.append("F20_R2_HANDOFF_INVALID")
    if (manifest.get("schema_version") != "1.0.0"
            or manifest.get("self_reference") is not False
            or manifest.get("previous_event_sequence") != 1719
            or manifest.get("package_id") != "F-20" or manifest.get("event_sequence") != 1725
            or manifest.get("accepted") is not False or manifest.get("projection_mode") != MODE
            or manifest.get("historical_event_prefix_sha256") != OLD_RAW_PREFIX_SHA256
            or manifest.get("product_write_scope") != SCOPE
            or manifest.get("work_instruction_sha256") != wi_sha
            or manifest.get("invocation_sha256") != invocation_sha
            or manifest.get("production") != "NOT_EXECUTED"):
        errors.append("F20_R2_MANIFEST_INVALID")
    return sorted(set(errors))


def collect_git(root: Path, progress: dict) -> list[str]:
    root = Path(root)

    def git(*args: str) -> str:
        return subprocess.run(
            ["git", "-c", "core.excludesFile=", "-c", "core.quotepath=false", *args],
            cwd=root, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout.strip()

    try:
        base = progress["repository"]["validated_base_commit"]
        branch = git("branch", "--show-current")
        upstream = git("rev-parse", "--abbrev-ref", "@{upstream}")
        head = git("rev-parse", "HEAD")
        remote = git("rev-parse", "development/codex/f18-wsl-ops")
        changed = set(filter(None, git("diff", "--no-renames", "--name-only", f"{base}..HEAD").splitlines()))
        dirty = set(filter(None, git("diff", "--no-renames", "--name-only").splitlines()))
        dirty.update(filter(None, git("diff", "--cached", "--no-renames", "--name-only").splitlines()))
        dirty.update(filter(None, git("ls-files", "--others", "--exclude-standard").splitlines()))
        ancestor = lambda target: subprocess.run(
            ["git", "merge-base", "--is-ancestor", base, target], cwd=root,
            capture_output=True, check=False,
        ).returncode == 0
        valid = (
            branch == "codex/f18-wsl-ops" and upstream == "development/codex/f18-wsl-ops"
            and all(re.fullmatch(r"[0-9a-f]{40}", value or "") for value in (base, head, remote))
            and ancestor(head) and ancestor(remote)
            and changed <= CONTROL_SCOPE | set(SCOPE)
            and dirty <= CONTROL_SCOPE | set(SCOPE)
        )
        return [] if valid else ["F20_R2_GIT_INVALID"]
    except (OSError, subprocess.CalledProcessError, KeyError, TypeError):
        return ["F20_R2_GIT_INVALID"]
