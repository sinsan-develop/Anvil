"""Append-only F-20 R4-to-R5a handoff for current progress contracts."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_rework_r4_overlay as r4
except ModuleNotFoundError:  # direct project-progress invocation
    import f20_rework_r4_overlay as r4


r1 = r4.r1
MODE = "F20_R5A_REWORK_START"
ACTOR = "developer-primary-f20-r5a"
WI = "docs/work_orders/F-20_REWORK_R5A_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_REWORK_R5A_INVOCATION.md"
REPORT = "docs/04_test_reports/F-20_REWORK_R4_RESULT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-r5a-rework-start.json"
MANIFEST = "docs/evidence/manifests/F-20_R5A_REWORK_START_MANIFEST.json"
EVENTS, PROGRESS, HANDOFF = r4.EVENTS, r4.PROGRESS, r4.HANDOFF
SCOPE = [
    "docs/04_test_reports/F-20_REWORK_R5A_RESULT.md",
    "tests/tooling/test_project_progress.py",
]
CONTROL_SCOPE = r4.CONTROL_SCOPE | {
    WI, INVOCATION, DIGEST, MANIFEST,
    "scripts/f20_rework_r5a_overlay.py",
    "tests/tooling/test_f20_rework_r5a_projection.py",
}
TYPES = r4.TYPES
LAST = "evt_f20_1737_package_resumed"
START = 1737
END = START + len(TYPES)


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _append_raw(raw: bytes, additions: list[dict]) -> bytes:
    raw = r1._lf(raw)
    marker = b'\n  ],\n  "last_event_id": "' + LAST.encode() + b'"'
    if raw.count(marker) != 1 or raw.count(b'"last_sequence": 1737') != 1:
        raise ValueError("F20_R5A_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    return raw.replace(marker, insertion + marker.replace(LAST.encode(), additions[-1]["event_id"].encode())).replace(
        b'"last_sequence": 1737', b'"last_sequence": 1743', 1)


def _event(previous: dict, event_type: str, details: dict, at: str) -> dict:
    sequence = previous["sequence"] + 1
    return {
        "sequence": sequence, "event_id": f"evt_f20_{sequence}_{event_type.lower()}",
        "event_type": event_type, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
        "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
        "run_id": None, "step_id": "F-20_R5A_REWORK_START", "subject_ref": "F-20/R5a",
        "occurred_at": at, "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": r1._sha(r1._canonical(previous)), "details": details,
    }


def validate_transition(rows: object, wi_sha: str, invocation_sha: str,
                        now: datetime) -> list[str]:
    if not isinstance(rows, list) or len(rows) != END or not all(isinstance(row, dict) for row in rows):
        return ["F20_R5A_TRANSITION_INVALID"]
    try:
        old_worker, old_write = rows[1734]["details"], rows[1735]["details"]
        prior_issued = datetime.fromisoformat(old_worker["issued_at"])
        if r4.validate_transition(rows[:START], rows[1733]["details"]["sha256"],
                                  rows[1733]["details"]["invocation_sha256"], prior_issued):
            return ["F20_R5A_TRANSITION_INVALID"]
        tail = rows[START:]
        for offset, (row, kind) in enumerate(zip(tail, TYPES)):
            if (row.get("sequence") != START + 1 + offset
                    or row.get("event_id") != f"evt_f20_{START + 1 + offset}_{kind.lower()}"
                    or row.get("event_type") != kind
                    or row.get("actor") != "main-agent-eoul"
                    or row.get("actor_id") != "main-agent-eoul"
                    or row.get("actor_type") != "AGENT"
                    or row.get("project_id") != "anvil"
                    or row.get("work_package_id") != "F-20"
                    or row.get("run_id") is not None
                    or row.get("step_id") != "F-20_R5A_REWORK_START"
                    or row.get("subject_ref") != "F-20/R5a"
                    or row.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"
                    or row.get("occurred_at") != tail[0].get("occurred_at")
                    or row.get("previous_event_sha256") != r1._sha(r1._canonical(rows[START - 1 + offset]))
                    or not isinstance(row.get("details"), dict)):
                return ["F20_R5A_TRANSITION_INVALID"]
        revoke_write, revoke_worker, instruction, worker, write, resume = [row["details"] for row in tail]
        prior_tokens = r1._historical_fencing_tokens(rows[:START])
        execution = worker.get("execution_fencing_token")
        write_token = write.get("write_fencing_token")
        at = datetime.fromisoformat(tail[0]["occurred_at"])
        expires = datetime.fromisoformat(worker["expires_at"])
        valid = (
            revoke_write == {"lease_id": old_write["lease_id"],
                             "write_fencing_token": old_write["write_fencing_token"],
                             "reason": "F20_R4_EXACT6_DONE_R5A_CURRENT_PROGRESS_REWORK"}
            and revoke_worker == {"lease_id": old_worker["lease_id"],
                                  "execution_fencing_token": old_worker["execution_fencing_token"],
                                  "reason": "F20_R4_EXACT6_DONE_R5A_CURRENT_PROGRESS_REWORK"}
            and instruction == {"path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
                                "invocation_sha256": invocation_sha,
                                "classification": "MAIN_INTERNAL_REWORK"}
            and worker.get("actor_id") == ACTOR and write.get("actor_id") == ACTOR
            and worker.get("subject_ref") == "F-20/R5a" and write.get("subject_ref") == "F-20/R5a"
            and worker.get("status") == "ACTIVE" and write.get("status") == "ACTIVE"
            and worker.get("path_scope") == SCOPE and write.get("path_scope") == SCOPE
            and worker.get("lease_epoch") == 5 and write.get("lease_epoch") == 5
            and write.get("write_epoch") == 5
            and worker.get("lease_id", "").startswith("worker-lease-f20-r5a-")
            and write.get("lease_id", "").startswith("write-lease-f20-r5a-")
            and write.get("worker_lease_id") == worker.get("lease_id")
            and worker.get("issued_at") == tail[0]["occurred_at"]
            and write.get("issued_at") == worker.get("issued_at")
            and write.get("expires_at") == worker.get("expires_at")
            and at.tzinfo is not None and expires.tzinfo is not None
            and at <= now < expires and timedelta(0) < expires - at <= timedelta(hours=12)
            and worker.get("dispatch_head") == write.get("dispatch_head")
            and worker.get("baseline_git_commit") == worker.get("dispatch_head")
            and write.get("baseline_git_commit") == worker.get("dispatch_head")
            and isinstance(execution, str)
            and re.fullmatch(r"f20-r5a-execution-fence-epoch-5-[a-z0-9]{4,32}", execution) is not None
            and execution not in prior_tokens
            and isinstance(write_token, str)
            and re.fullmatch(r"f20-r5a-write-fence-epoch-5-[a-z0-9]{4,32}", write_token) is not None
            and write_token not in prior_tokens
            and execution.removeprefix("f20-r5a-execution-fence-epoch-5-")
                == write_token.removeprefix("f20-r5a-write-fence-epoch-5-")
            and execution != write_token
            and worker.get("fencing_token") == execution
            and write.get("execution_fencing_token") == execution
            and write.get("fencing_token") == write_token
            and resume == {"worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
                           "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
                           "package_status": "REWORK_IN_PROGRESS", "accepted": False}
        )
        return [] if valid else ["F20_R5A_TRANSITION_INVALID"]
    except (KeyError, TypeError, ValueError, OverflowError):
        return ["F20_R5A_TRANSITION_INVALID"]


def materialize(root: Path, dispatch_head: str, at: datetime, nonce: str) -> None:
    root = Path(root)
    raw = (root / EVENTS).read_bytes()
    stream = json.loads(raw)
    rows = stream["events"]
    progress = json.loads((root / PROGRESS).read_bytes())
    if (len(rows) != START or stream.get("last_sequence") != START
            or progress.get("event_sequence") != START
            or progress.get("repository", {}).get("projection_mode") != r4.MODE
            or progress.get("worker_lease") != rows[1734]["details"]
            or progress.get("write_lease") != rows[1735]["details"]
            or at.tzinfo is None or not re.fullmatch(r"[0-9a-f]{40}", dispatch_head)
            or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
            or _git(root, "rev-parse", "--abbrev-ref", "HEAD").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                != "development/codex/f18-wsl-ops"
            or _git(root, "rev-parse", "HEAD").decode().strip() != dispatch_head
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != dispatch_head
            or r1._lf(_git(root, "show", f"{dispatch_head}:{EVENTS}")) != r1._lf(raw)
            or (root / REPORT).read_bytes() != _git(root, "show", f"{dispatch_head}:{REPORT}")):
        raise RuntimeError("F20_R5A_PREDECESSOR_INVALID")
    prior_issued = datetime.fromisoformat(progress["worker_lease"]["issued_at"])
    prior_bundle = {"_root": root, "progress": progress, "events": stream}
    if r4.validate_control(root, prior_bundle, prior_issued):
        raise RuntimeError("F20_R5A_PREDECESSOR_INVALID")
    old_worker, old_write = progress["worker_lease"], progress["write_lease"]
    at_text = at.isoformat(timespec="seconds")
    expires = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    execution = f"f20-r5a-execution-fence-epoch-5-{nonce}"
    write_token = f"f20-r5a-write-fence-epoch-5-{nonce}"
    worker = {
        "lease_id": f"worker-lease-f20-r5a-{nonce}", "actor_id": ACTOR,
        "subject_ref": "F-20/R5a", "status": "ACTIVE", "issued_at": at_text,
        "expires_at": expires, "lease_epoch": 5, "fencing_token": execution,
        "execution_fencing_token": execution, "baseline_git_commit": dispatch_head,
        "dispatch_head": dispatch_head, "path_scope": SCOPE,
    }
    write = {**worker, "lease_id": f"write-lease-f20-r5a-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 5,
             "fencing_token": write_token, "write_fencing_token": write_token}
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    reason = "F20_R4_EXACT6_DONE_R5A_CURRENT_PROGRESS_REWORK"
    details = (
        {"lease_id": old_write["lease_id"], "write_fencing_token": old_write["write_fencing_token"], "reason": reason},
        {"lease_id": old_worker["lease_id"], "execution_fencing_token": old_worker["execution_fencing_token"], "reason": reason},
        {"path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
         "invocation_sha256": invocation_sha, "classification": "MAIN_INTERNAL_REWORK"},
        worker, write,
        {"worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
         "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
         "package_status": "REWORK_IN_PROGRESS", "accepted": False},
    )
    additions = []
    for kind, detail in zip(TYPES, details):
        additions.append(_event(additions[-1] if additions else rows[-1], kind, detail, at_text))
    if validate_transition(rows + additions, wi_sha, invocation_sha, at):
        raise RuntimeError("F20_R5A_TRANSITION_INVALID")
    event_raw = _append_raw(raw, additions)
    progress = deepcopy(progress)
    progress.update({
        "snapshot_id": "snapshot-f20-r5a-rework-start-seq1743", "event_sequence": END,
        "last_event_id": additions[-1]["event_id"], "updated_at": at_text,
        "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "completed_f20_r4_worker_lease": {**old_worker, "status": "REVOKED", "revoked_at": at_text},
        "completed_f20_r4_write_lease": {**old_write, "status": "REVOKED", "revoked_at": at_text},
        "f20_overall_status": "REWORK_IN_PROGRESS",
        "next_safe_action": "F20_R5A_CURRENT_PROGRESS_REWORK",
        "runtime_next_action": "F20_R5A_CURRENT_PROGRESS_REWORK",
        "active_work_instruction": {
            "artifact_id": "WI-F-20-REWORK-R5A-20260928-001", "path": WI,
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
        "worktree_status": "F20_R5A_REWORK_ACTIVE", "product_write_scope": SCOPE,
        "commit_status": "PENDING", "push_status": "PENDING",
    })
    progress["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(progress)
    summary = {
        "event_sequence": END, "last_event_id": additions[-1]["event_id"],
        "status": "ACTIVE", "current_work_package": "F-20", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "next_safe_action": progress["next_safe_action"], "repository_head": dispatch_head,
        "repository_upstream": "development/codex/f18-wsl-ops",
        "reporting_decision": progress["reporting_decision"]["decision"],
    }
    handoff_raw = (b"# F-20 R5a append-only lease handoff and current progress rework\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary) +
                   b"```\n\n- F-20 incomplete; Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": END,
        "self_reference": False,
        "progress": {"path": PROGRESS, "bytes": len(progress_raw), "file_sha256": r1._sha(progress_raw)},
        "handoff": {"path": HANDOFF, "bytes": len(handoff_raw), "file_sha256": r1._sha(handoff_raw)},
    })
    manifest_raw = r1._pretty({
        "schema_version": "1.0.0", "package_id": "F-20", "event_sequence": END,
        "accepted": False, "projection_mode": MODE,
        "previous_event_sequence": START, "product_write_scope": SCOPE,
        "predecessor_commit": dispatch_head,
        "predecessor_events_sha256": r1._sha(raw),
        "predecessor_report_sha256": r1._sha((root / REPORT).read_bytes()),
        "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
        "production": "NOT_EXECUTED", "self_reference": False,
    })
    for relative, content in {
        EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
        DIGEST: digest_raw, MANIFEST: manifest_raw,
    }.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    progress, stream = bundle.get("progress") or {}, bundle.get("events") or {}
    rows = stream.get("events") or []
    if not isinstance(rows, list) or len(rows) != END:
        return ["F20_R5A_TRANSITION_INVALID"]
    try:
        raw = (root / EVENTS).read_bytes()
        progress_raw = (root / PROGRESS).read_bytes()
        handoff_raw = (root / HANDOFF).read_bytes()
        wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
        invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
        digest = json.loads((root / DIGEST).read_bytes())
        manifest = json.loads((root / MANIFEST).read_bytes())
        report_raw = (root / REPORT).read_bytes()
    except (OSError, KeyError, TypeError, ValueError, subprocess.CalledProcessError):
        return ["F20_R5A_CONTROL_MISSING"]
    errors = validate_transition(rows, wi_sha, invocation_sha, now)
    if errors:
        return errors
    try:
        base = rows[1740]["details"]["dispatch_head"]
        old_raw = r1._lf(_git(root, "show", f"{base}:{EVENTS}"))
        old_report = _git(root, "show", f"{base}:{REPORT}")
    except (OSError, KeyError, TypeError, ValueError, subprocess.CalledProcessError):
        return ["F20_R5A_CONTROL_MISSING"]
    if (json.loads(raw) != stream or stream.get("last_sequence") != END
            or stream.get("last_event_id") != rows[-1]["event_id"]
            or json.loads(old_raw).get("events") != rows[:START]
            or raw != _append_raw(old_raw, rows[START:])
            or progress.get("registry_refs", {}).get("progress_events", {}).get("sha256") != r1._sha(raw)):
        errors.append("F20_R5A_HISTORY_MUTATED")
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    worker, write = rows[1740]["details"], rows[1741]["details"]
    old_worker, old_write = rows[1734]["details"], rows[1735]["details"]
    instruction = progress.get("active_work_instruction") or {}
    repo = progress.get("repository") or {}
    if (progress.get("snapshot_hash") != r1._sha(r1._canonical(snapshot))
            or progress.get("event_sequence") != END
            or progress.get("last_event_id") != rows[-1]["event_id"]
            or progress.get("status") != "ACTIVE" or progress.get("current_work_package") != "F-20"
            or progress.get("active_agent") != ACTOR
            or progress.get("worker_lease") != worker or progress.get("write_lease") != write
            or progress.get("completed_f20_r4_worker_lease") != {**old_worker, "status": "REVOKED", "revoked_at": rows[1738]["occurred_at"]}
            or progress.get("completed_f20_r4_write_lease") != {**old_write, "status": "REVOKED", "revoked_at": rows[1737]["occurred_at"]}
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
            or repo.get("validated_base_commit") != base
            or progress.get("next_safe_action") != "F20_R5A_CURRENT_PROGRESS_REWORK"
            or progress.get("runtime_next_action") != "F20_R5A_CURRENT_PROGRESS_REWORK"
            or progress.get("next_work_package") != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
            or progress.get("next_successor_work_package") != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
            or progress.get("current_progress_evidence_ref") != {"package_id": "F-20", "path": DIGEST, "manifest_path": MANIFEST}):
        errors.append("F20_R5A_PROGRESS_INVALID")
    if (digest.get("event_sequence") != END or digest.get("self_reference") is not False
            or digest.get("progress", {}).get("file_sha256") != r1._sha(progress_raw)
            or digest.get("progress", {}).get("bytes") != len(progress_raw)
            or digest.get("handoff", {}).get("file_sha256") != r1._sha(handoff_raw)
            or digest.get("handoff", {}).get("bytes") != len(handoff_raw)):
        errors.append("F20_R5A_DIGEST_INVALID")
    try:
        match = re.search(r"```json anvil-recovery-summary\s*(\{.*?\})\s*```",
                          handoff_raw.decode("utf-8"), re.DOTALL)
        summary = json.loads(match.group(1)) if match else {}
        if (summary.get("event_sequence") != END
                or summary.get("last_event_id") != rows[-1]["event_id"]
                or summary.get("worker_lease") != worker or summary.get("write_lease") != write
                or summary.get("next_safe_action") != progress.get("next_safe_action")):
            errors.append("F20_R5A_HANDOFF_INVALID")
    except (UnicodeDecodeError, ValueError, TypeError):
        errors.append("F20_R5A_HANDOFF_INVALID")
    if (manifest.get("schema_version") != "1.0.0" or manifest.get("self_reference") is not False
            or manifest.get("previous_event_sequence") != START
            or manifest.get("package_id") != "F-20" or manifest.get("event_sequence") != END
            or manifest.get("accepted") is not False or manifest.get("projection_mode") != MODE
            or manifest.get("product_write_scope") != SCOPE
            or manifest.get("predecessor_commit") != base
            or manifest.get("predecessor_events_sha256") != r1._sha(old_raw)
            or manifest.get("predecessor_report_sha256") != r1._sha(old_report)
            or r1._sha(report_raw) != r1._sha(old_report)
            or manifest.get("work_instruction_sha256") != wi_sha
            or manifest.get("invocation_sha256") != invocation_sha
            or manifest.get("production") != "NOT_EXECUTED"):
        errors.append("F20_R5A_MANIFEST_INVALID")
    return sorted(set(errors))


def collect_git(root: Path, progress: dict) -> list[str]:
    root = Path(root)
    try:
        def git(*args: str) -> str:
            return _git(root, *args).decode("utf-8").strip()
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
        valid = (branch == "codex/f18-wsl-ops" and upstream == "development/codex/f18-wsl-ops"
                 and all(re.fullmatch(r"[0-9a-f]{40}", value or "") for value in (base, head, remote))
                 and ancestor(head) and ancestor(remote)
                 and changed <= CONTROL_SCOPE | set(SCOPE)
                 and dirty <= CONTROL_SCOPE | set(SCOPE))
        return [] if valid else ["F20_R5A_GIT_INVALID"]
    except (OSError, subprocess.CalledProcessError, KeyError, TypeError, UnicodeDecodeError):
        return ["F20_R5A_GIT_INVALID"]
