"""Append-only F-20/U-01 R1 exact-path handoff while C30 remains blocking."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_rework_r5e_overlay as r5e
except ModuleNotFoundError:  # direct project-progress invocation
    import f20_rework_r5e_overlay as r5e


r1 = r5e.r1
MODE = "F20_U01_R1_READINESS_START"
ACTOR = "developer-primary-f20-u01-r1"
WI = "docs/work_orders/F-20_U01_R1_READINESS_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_U01_R1_READINESS_INVOCATION.md"
REPORT = "docs/04_test_reports/F-20_REWORK_R5E_RESULT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r1-start.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R1_READINESS_START_MANIFEST.json"
EVENTS, PROGRESS, HANDOFF = r5e.EVENTS, r5e.PROGRESS, r5e.HANDOFF
INCIDENT_ID = r5e.INCIDENT_ID
SCOPE = ["apps/web/src/console/App.tsx", "apps/web/tests/f15-console.test.mjs",
         "docs/04_test_reports/F-20_U01_R1_READINESS_RESULT.md"]
CONTROL_SCOPE = r5e.CONTROL_SCOPE | {
    DIGEST, MANIFEST, "scripts/f20_u01_r1_overlay.py",
    "tests/tooling/test_f20_u01_r1_projection.py",
    "docs/work_orders/F-20_U01_R1B_HISTORY_WORK_INSTRUCTION.md",
    "docs/work_orders/F-20_U01_R1B_HISTORY_INVOCATION.md",
    "scripts/f20_u01_r1b_overlay.py",
    "tests/tooling/test_f20_u01_r1b_projection.py",
}
START = 1768
TYPES = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
         "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED")
END = START + len(TYPES)
REASON = "F20_R5E_DONE_U01_R1_READINESS"


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _append_raw(raw: bytes, additions: list[dict]) -> bytes:
    if raw != r1._lf(raw) or len(additions) != len(TYPES):
        raise ValueError("F20_U01_R1_EVENT_BYTES_INVALID")
    marker = b'\n  ],\n  "last_event_id": "evt_f20_1768_package_resumed"'
    if raw.count(marker) != 1 or raw.count(b'"last_sequence": 1768') != 1:
        raise ValueError("F20_U01_R1_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    return raw.replace(marker, insertion + marker.replace(
        b"evt_f20_1768_package_resumed", additions[-1]["event_id"].encode()
    )).replace(b'"last_sequence": 1768', b'"last_sequence": 1774', 1)


def _event(previous: dict, kind: str, details: dict, at: str) -> dict:
    sequence = previous["sequence"] + 1
    return {
        "sequence": sequence, "event_id": f"evt_f20_{sequence}_{kind.lower()}",
        "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
        "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
        "run_id": None, "step_id": "F-20_U01_R1_READINESS_START",
        "subject_ref": "F-20/U01-R1", "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": r1._sha(r1._canonical(previous)), "details": details,
    }


def validate_transition(rows: object, wi_sha: str, invocation_sha: str,
                        now: datetime) -> list[str]:
    if not isinstance(rows, list) or len(rows) != END or not all(isinstance(row, dict) for row in rows):
        return ["F20_U01_R1_TRANSITION_INVALID"]
    try:
        prior_worker, prior_write = rows[1765]["details"], rows[1766]["details"]
        prior_issued = datetime.fromisoformat(prior_worker["issued_at"])
        if r5e.validate_transition(
            rows[:START], rows[1764]["details"]["sha256"],
            rows[1764]["details"]["invocation_sha256"], prior_issued,
        ):
            return ["F20_U01_R1_TRANSITION_INVALID"]
        tail = rows[START:]
        for offset, (row, kind) in enumerate(zip(tail, TYPES)):
            if (row.get("sequence") != START + offset + 1
                    or row.get("event_id") != f"evt_f20_{START + offset + 1}_{kind.lower()}"
                    or row.get("event_type") != kind
                    or row.get("actor") != "main-agent-eoul"
                    or row.get("actor_id") != "main-agent-eoul"
                    or row.get("actor_type") != "AGENT"
                    or row.get("project_id") != "anvil"
                    or row.get("work_package_id") != "F-20"
                    or row.get("run_id") is not None
                    or row.get("step_id") != "F-20_U01_R1_READINESS_START"
                    or row.get("subject_ref") != "F-20/U01-R1"
                    or row.get("occurred_at_source") != "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME"
                    or row.get("occurred_at") != tail[0].get("occurred_at")
                    or row.get("previous_event_sha256") != r1._sha(r1._canonical(rows[START - 1 + offset]))
                    or not isinstance(row.get("details"), dict)):
                return ["F20_U01_R1_TRANSITION_INVALID"]
        revoked_write, revoked_worker, instruction, worker, write, resume = [
            row["details"] for row in tail]
        at = datetime.fromisoformat(tail[0]["occurred_at"])
        expires = datetime.fromisoformat(worker["expires_at"])
        execution = worker.get("execution_fencing_token")
        write_token = write.get("write_fencing_token")
        previous_tokens = r1._historical_fencing_tokens(rows[:START])
        valid = (
            revoked_write == {"lease_id": prior_write["lease_id"],
                              "write_fencing_token": prior_write["write_fencing_token"],
                              "reason": REASON}
            and revoked_worker == {"lease_id": prior_worker["lease_id"],
                                   "execution_fencing_token": prior_worker["execution_fencing_token"],
                                   "reason": REASON}
            and instruction == {"path": WI, "sha256": wi_sha,
                                "invocation_path": INVOCATION,
                                "invocation_sha256": invocation_sha,
                                "classification": "MAIN_INTERNAL_REWORK"}
            and worker.get("actor_id") == ACTOR and write.get("actor_id") == ACTOR
            and worker.get("subject_ref") == "F-20/U01-R1"
            and write.get("subject_ref") == "F-20/U01-R1"
            and worker.get("status") == "ACTIVE" and write.get("status") == "ACTIVE"
            and worker.get("path_scope") == SCOPE and write.get("path_scope") == SCOPE
            and worker.get("lease_epoch") == 10 and write.get("lease_epoch") == 10
            and write.get("write_epoch") == 10
            and write.get("worker_lease_id") == worker.get("lease_id")
            and worker.get("lease_id", "").startswith("worker-lease-f20-u01-r1-")
            and write.get("lease_id", "").startswith("write-lease-f20-u01-r1-")
            and worker.get("issued_at") == tail[0]["occurred_at"]
            and write.get("issued_at") == worker.get("issued_at")
            and write.get("expires_at") == worker.get("expires_at")
            and at.tzinfo is not None and expires.tzinfo is not None
            and prior_issued <= at
            and at <= now < expires and timedelta(0) < expires - at <= timedelta(hours=12)
            and worker.get("dispatch_head") == write.get("dispatch_head")
            and worker.get("baseline_git_commit") == worker.get("dispatch_head")
            and write.get("baseline_git_commit") == worker.get("dispatch_head")
            and isinstance(execution, str)
            and re.fullmatch(r"f20-u01-r1-execution-fence-epoch-10-[a-z0-9]{4,32}", execution)
                is not None
            and execution not in previous_tokens
            and isinstance(write_token, str)
            and re.fullmatch(r"f20-u01-r1-write-fence-epoch-10-[a-z0-9]{4,32}", write_token)
                is not None
            and write_token not in previous_tokens
            and execution.removeprefix("f20-u01-r1-execution-fence-epoch-10-")
                == write_token.removeprefix("f20-u01-r1-write-fence-epoch-10-")
            and execution != write_token
            and worker.get("fencing_token") == execution
            and write.get("fencing_token") == write_token
            and resume == {"worker_lease_id": worker["lease_id"],
                           "write_lease_id": write["lease_id"],
                           "work_instruction_sha256": wi_sha,
                           "invocation_sha256": invocation_sha,
                           "package_status": "REWORK_IN_PROGRESS", "accepted": False}
        )
        return [] if valid else ["F20_U01_R1_TRANSITION_INVALID"]
    except (KeyError, TypeError, ValueError, OverflowError):
        return ["F20_U01_R1_TRANSITION_INVALID"]


def materialize(root: Path, dispatch_head: str, at: datetime, nonce: str) -> None:
    root = Path(root)
    raw = (root / EVENTS).read_bytes()
    stream = json.loads(raw)
    rows = stream["events"]
    progress = json.loads((root / PROGRESS).read_bytes())
    if (len(rows) != START or stream.get("last_sequence") != START
            or progress.get("event_sequence") != START
            or progress.get("repository", {}).get("projection_mode") != r5e.MODE
            or progress.get("worker_lease") != rows[1765]["details"]
            or progress.get("write_lease") != rows[1766]["details"]
            or at.tzinfo is None or not re.fullmatch(r"[0-9a-f]{40}", dispatch_head)
            or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
            or _git(root, "rev-parse", "--abbrev-ref", "HEAD").decode().strip()
                != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                != "development/codex/f18-wsl-ops"
            or _git(root, "rev-parse", "HEAD").decode().strip() != dispatch_head
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
                != dispatch_head
            or _git(root, "show", f"{dispatch_head}:{EVENTS}") != raw
            or _git(root, "show", f"{dispatch_head}:{REPORT}") != (root / REPORT).read_bytes()
            or _git(root, "show", f"{dispatch_head}:{r5e.DIGEST}")
                != (root / r5e.DIGEST).read_bytes()
            or _git(root, "show", f"{dispatch_head}:{r5e.MANIFEST}")
                != (root / r5e.MANIFEST).read_bytes()):
        raise RuntimeError("F20_U01_R1_PREDECESSOR_INVALID")
    old_worker, old_write = progress["worker_lease"], progress["write_lease"]
    prior_issued = datetime.fromisoformat(old_worker["issued_at"])
    if r5e.validate_control(root, {"_root": root, "progress": progress,
                                   "events": stream}, prior_issued):
        raise RuntimeError("F20_U01_R1_PREDECESSOR_INVALID")
    at_text = at.isoformat(timespec="seconds")
    expires = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    execution = f"f20-u01-r1-execution-fence-epoch-10-{nonce}"
    write_token = f"f20-u01-r1-write-fence-epoch-10-{nonce}"
    worker = {"lease_id": f"worker-lease-f20-u01-r1-{nonce}", "actor_id": ACTOR,
              "subject_ref": "F-20/U01-R1", "status": "ACTIVE", "issued_at": at_text,
              "expires_at": expires, "lease_epoch": 10, "fencing_token": execution,
              "execution_fencing_token": execution, "baseline_git_commit": dispatch_head,
              "dispatch_head": dispatch_head, "path_scope": SCOPE}
    write = {**worker, "lease_id": f"write-lease-f20-u01-r1-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 10,
             "fencing_token": write_token, "write_fencing_token": write_token}
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    details = (
        {"lease_id": old_write["lease_id"],
         "write_fencing_token": old_write["write_fencing_token"], "reason": REASON},
        {"lease_id": old_worker["lease_id"],
         "execution_fencing_token": old_worker["execution_fencing_token"], "reason": REASON},
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
        raise RuntimeError("F20_U01_R1_TRANSITION_INVALID")
    event_raw = _append_raw(raw, additions)
    progress = deepcopy(progress)
    progress.update({
        "snapshot_id": "snapshot-f20-u01-r1-readiness-start-seq1774",
        "event_sequence": END, "last_event_id": additions[-1]["event_id"],
        "updated_at": at_text, "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "completed_f20_r5e_worker_lease": {**old_worker, "status": "REVOKED", "revoked_at": at_text},
        "completed_f20_r5e_write_lease": {**old_write, "status": "REVOKED", "revoked_at": at_text},
        "f20_overall_status": "REWORK_IN_PROGRESS",
        "next_safe_action": "F20_U01_R1_READINESS_REWORK",
        "runtime_next_action": "F20_U01_R1_READINESS_REWORK",
        "active_work_instruction": {
            "artifact_id": "WI-F-20-U01-R1-20260928-001", "path": WI, "sha256": wi_sha,
            "invocation_path": INVOCATION, "invocation_sha256": invocation_sha,
            "result_status": "REWORK_IN_PROGRESS", "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_INTERNAL_REWORK"},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["repository"].update({
        "local_head": dispatch_head, "remote_head": dispatch_head,
        "validated_base_commit": dispatch_head, "projection_mode": MODE,
        "worktree_status": "F20_U01_R1_READINESS_ACTIVE", "product_write_scope": SCOPE,
        "commit_status": "PENDING", "push_status": "PENDING",
    })
    progress["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(progress)
    summary = {"event_sequence": END, "last_event_id": additions[-1]["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20", "active_agent": ACTOR,
               "worker_lease": worker, "write_lease": write,
               "incident_event_id": INCIDENT_ID, "incident_blocking": True,
               "next_safe_action": progress["next_safe_action"],
               "repository_head": dispatch_head,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": progress["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20/U-01 R1 Database readiness handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- C30 CRITICAL OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": END,
        "self_reference": False,
        "progress": {"path": PROGRESS, "bytes": len(progress_raw),
                     "file_sha256": r1._sha(progress_raw)},
        "handoff": {"path": HANDOFF, "bytes": len(handoff_raw),
                    "file_sha256": r1._sha(handoff_raw)},
    })
    manifest_raw = r1._pretty({
        "schema_version": "1.0.0", "package_id": "F-20", "event_sequence": END,
        "accepted": False, "projection_mode": MODE, "previous_event_sequence": START,
        "product_write_scope": SCOPE, "predecessor_commit": dispatch_head,
        "predecessor_events_sha256": r1._sha(raw),
        "predecessor_report_sha256": r1._sha((root / REPORT).read_bytes()),
        "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
        "incident_event_id": INCIDENT_ID, "incident_blocking": True,
        "release_decision": "DEFER", "production": "NOT_EXECUTED", "self_reference": False,
    })
    for relative, content in {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
                              DIGEST: digest_raw, MANIFEST: manifest_raw}.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    progress, stream = bundle.get("progress") or {}, bundle.get("events") or {}
    rows = stream.get("events") or []
    if not isinstance(rows, list) or len(rows) != END:
        return ["F20_U01_R1_TRANSITION_INVALID"]
    try:
        raw = (root / EVENTS).read_bytes()
        progress_raw = (root / PROGRESS).read_bytes()
        handoff_raw = (root / HANDOFF).read_bytes()
        wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
        invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
        digest = json.loads((root / DIGEST).read_bytes())
        manifest = json.loads((root / MANIFEST).read_bytes())
        report_raw = (root / REPORT).read_bytes()
        predecessor_digest_raw = (root / r5e.DIGEST).read_bytes()
        predecessor_manifest_raw = (root / r5e.MANIFEST).read_bytes()
    except (OSError, TypeError, ValueError):
        return ["F20_U01_R1_CONTROL_MISSING"]
    errors = validate_transition(rows, wi_sha, invocation_sha, now)
    if errors:
        return errors
    try:
        base = rows[1771]["details"]["dispatch_head"]
        old_raw = _git(root, "show", f"{base}:{EVENTS}")
        old_progress = json.loads(_git(root, "show", f"{base}:{PROGRESS}"))
        old_report = _git(root, "show", f"{base}:{REPORT}")
        old_wi = _git(root, "show", f"{base}:{WI}")
        old_invocation = _git(root, "show", f"{base}:{INVOCATION}")
        old_digest = _git(root, "show", f"{base}:{r5e.DIGEST}")
        old_manifest = _git(root, "show", f"{base}:{r5e.MANIFEST}")
    except (OSError, KeyError, TypeError, ValueError, subprocess.CalledProcessError):
        return ["F20_U01_R1_CONTROL_MISSING"]
    if (report_raw != old_report or (root / WI).read_bytes() != old_wi
            or (root / INVOCATION).read_bytes() != old_invocation
            or predecessor_digest_raw != old_digest
            or predecessor_manifest_raw != old_manifest):
        errors.append("F20_U01_R1_PREDECESSOR_INVALID")
    try:
        if (json.loads(raw) != stream or stream.get("last_sequence") != END
                or stream.get("last_event_id") != rows[-1]["event_id"]
                or json.loads(old_raw).get("events") != rows[:START]
                or raw != _append_raw(old_raw, rows[START:])
                or old_progress.get("event_sequence") != START
                or old_progress.get("f20_c30_event_integrity_incident", {}).get("status")
                    != "OPEN_BLOCKING"
                or progress.get("registry_refs", {}).get("progress_events", {}).get("sha256")
                    != r1._sha(raw)):
            errors.append("F20_U01_R1_HISTORY_MUTATED")
    except (KeyError, TypeError, ValueError):
        errors.append("F20_U01_R1_HISTORY_MUTATED")
    changed_keys = {"snapshot_id", "event_sequence", "last_event_id", "updated_at", "status",
                    "active_agent", "worker_lease", "write_lease",
                    "completed_f20_r5e_worker_lease", "completed_f20_r5e_write_lease",
                    "f20_overall_status", "next_safe_action", "runtime_next_action",
                    "active_work_instruction", "current_progress_evidence_ref", "repository",
                    "registry_refs", "snapshot_hash"}
    changed_repo = {"local_head", "remote_head", "validated_base_commit", "projection_mode",
                    "worktree_status", "product_write_scope", "commit_status", "push_status"}
    inherited_valid = all(progress.get(key) == old_progress.get(key)
                          for key in set(progress) | set(old_progress) if key not in changed_keys)
    inherited_valid = inherited_valid and all(
        progress.get("repository", {}).get(key) == old_progress.get("repository", {}).get(key)
        for key in set(progress.get("repository", {})) | set(old_progress.get("repository", {}))
        if key not in changed_repo)
    old_registry = deepcopy(old_progress.get("registry_refs"))
    if isinstance(old_registry, dict) and isinstance(old_registry.get("progress_events"), dict):
        old_registry["progress_events"]["sha256"] = r1._sha(raw)
    inherited_valid = inherited_valid and progress.get("registry_refs") == old_registry
    worker, write = rows[1771]["details"], rows[1772]["details"]
    old_worker, old_write = rows[1765]["details"], rows[1766]["details"]
    incident = {"event_id": INCIDENT_ID, "status": "OPEN_BLOCKING",
                "defect_ref": r5e.DEFECT["defect_ref"], "severity": "CRITICAL", "blocking": True}
    instruction = {"artifact_id": "WI-F-20-U01-R1-20260928-001", "path": WI,
                   "sha256": wi_sha, "invocation_path": INVOCATION,
                   "invocation_sha256": invocation_sha, "result_status": "REWORK_IN_PROGRESS",
                   "package_status": "REWORK_IN_PROGRESS",
                   "approval_classification": "MAIN_INTERNAL_REWORK"}
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    repo = progress.get("repository") or {}
    if (not inherited_valid or json.loads(progress_raw) != progress
            or progress.get("snapshot_hash") != r1._sha(r1._canonical(snapshot))
            or progress.get("snapshot_id") != "snapshot-f20-u01-r1-readiness-start-seq1774"
            or progress.get("event_sequence") != END
            or progress.get("last_event_id") != rows[-1]["event_id"]
            or progress.get("updated_at") != rows[1768]["occurred_at"]
            or progress.get("status") != "ACTIVE" or progress.get("current_work_package") != "F-20"
            or progress.get("active_agent") != ACTOR
            or progress.get("worker_lease") != worker or progress.get("write_lease") != write
            or progress.get("completed_f20_r5e_worker_lease")
                != {**old_worker, "status": "REVOKED", "revoked_at": rows[1769]["occurred_at"]}
            or progress.get("completed_f20_r5e_write_lease")
                != {**old_write, "status": "REVOKED", "revoked_at": rows[1768]["occurred_at"]}
            or progress.get("f20_c30_event_integrity_incident") != incident
            or "F-20" in progress.get("completed_packages", [])
            or progress.get("f20_overall_status") != "REWORK_IN_PROGRESS"
            or progress.get("wsl_full_suite") == "PASS"
            or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"
            or progress.get("active_work_instruction") != instruction
            or repo.get("projection_mode") != MODE or repo.get("product_write_scope") != SCOPE
            or repo.get("branch") != "codex/f18-wsl-ops"
            or repo.get("upstream") != "development/codex/f18-wsl-ops"
            or repo.get("validated_base_commit") != base
            or repo.get("local_head") != base or repo.get("remote_head") != base
            or repo.get("commit_status") != "PENDING" or repo.get("push_status") != "PENDING"
            or repo.get("worktree_status") != "F20_U01_R1_READINESS_ACTIVE"
            or progress.get("next_safe_action") != "F20_U01_R1_READINESS_REWORK"
            or progress.get("runtime_next_action") != "F20_U01_R1_READINESS_REWORK"
            or progress.get("next_work_package")
                != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
            or progress.get("next_successor_work_package")
                != {"package_id": "HUMAN_RELEASE_DECISION", "status": "BLOCKED_PENDING_F20_ACCEPTANCE"}
            or progress.get("current_progress_evidence_ref")
                != {"package_id": "F-20", "path": DIGEST, "manifest_path": MANIFEST}):
        errors.append("F20_U01_R1_PROGRESS_INVALID")
    if (digest.get("schema_version") != "1.0.0" or digest.get("algorithm") != "SHA-256"
            or digest.get("event_sequence") != END or digest.get("self_reference") is not False
            or digest.get("progress", {}).get("path") != PROGRESS
            or digest.get("progress", {}).get("file_sha256") != r1._sha(progress_raw)
            or digest.get("progress", {}).get("bytes") != len(progress_raw)
            or digest.get("handoff", {}).get("path") != HANDOFF
            or digest.get("handoff", {}).get("file_sha256") != r1._sha(handoff_raw)
            or digest.get("handoff", {}).get("bytes") != len(handoff_raw)):
        errors.append("F20_U01_R1_DIGEST_INVALID")
    if (("detached_digest" in bundle and bundle["detached_digest"] != digest)
            or ("_detached_digest_path" in bundle and bundle["_detached_digest_path"] != DIGEST)):
        errors.append("F20_U01_R1_DIGEST_INVALID")
    try:
        match = re.search(r"```json anvil-recovery-summary\s*(\{.*?\})\s*```",
                          handoff_raw.decode("utf-8"), re.DOTALL)
        summary = json.loads(match.group(1)) if match else {}
        if (summary.get("event_sequence") != END or summary.get("last_event_id") != rows[-1]["event_id"]
                or summary.get("worker_lease") != worker or summary.get("write_lease") != write
                or summary.get("incident_event_id") != INCIDENT_ID
                or summary.get("incident_blocking") is not True
                or summary.get("next_safe_action") != progress.get("next_safe_action")
                or ("handoff" in bundle and bundle["handoff"] != summary)
                or ("handoff_text" in bundle and bundle["handoff_text"] != handoff_raw.decode("utf-8"))):
            errors.append("F20_U01_R1_HANDOFF_INVALID")
    except (UnicodeDecodeError, ValueError, TypeError):
        errors.append("F20_U01_R1_HANDOFF_INVALID")
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
            or manifest.get("incident_event_id") != INCIDENT_ID
            or manifest.get("incident_blocking") is not True
            or manifest.get("release_decision") != "DEFER"
            or manifest.get("production") != "NOT_EXECUTED"):
        errors.append("F20_U01_R1_MANIFEST_INVALID")
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
        allowed = CONTROL_SCOPE | set(SCOPE)
        valid = (branch == "codex/f18-wsl-ops" and upstream == "development/codex/f18-wsl-ops"
                 and all(re.fullmatch(r"[0-9a-f]{40}", value or "") for value in (base, head, remote))
                 and all(subprocess.run(["git", "merge-base", "--is-ancestor", base, target],
                                        cwd=root, capture_output=True, check=False).returncode == 0
                         for target in (head, remote))
                 and changed <= allowed and dirty <= allowed)
        return [] if valid else ["F20_U01_R1_GIT_INVALID"]
    except (OSError, subprocess.CalledProcessError, KeyError, TypeError, UnicodeDecodeError):
        return ["F20_U01_R1_GIT_INVALID"]
