"""Append-only R6B exact-five browser response repair lease; F-20 stays blocked."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r6_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r6_overlay as prior

r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
MODE = "F20_U01_R6B_ERROR_BODY_REWORK_START"
ACTOR = "developer-primary-f20-u01-r6b"
SUBJECT = "F-20/U01-R6B"
NEXT = "F20_U01_R6B_ERROR_BODY_REWORK"
WI = "docs/work_orders/F-20_U01_R6B_ERROR_BODY_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_U01_R6B_ERROR_BODY_INVOCATION.md"
PLAN = "docs/04_test_reports/F-20_U01_R6B_ERROR_BODY_BINDING_PLAN.md"
REPORT = prior.REPORT
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r6b-start.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R6B_ERROR_BODY_START_MANIFEST.json"
SCOPE = [
    "apps/web/src/console/App.tsx",
    "apps/web/tests/f15-console.test.mjs",
    "tests/integration/test_f20_u01_oidc_browser_pg15.py",
    "tests/browser/f20-u01-oidc-browser-pg15.mjs",
    REPORT,
]
CONTROL_SCOPE = prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST,
    WI, INVOCATION, PLAN,
    "scripts/f20_u01_r6b_overlay.py", "scripts/check_project_progress.py",
    "tests/tooling/test_f20_u01_r6b_projection.py",
}
START, END = 1822, 1828
PREP_ANCHOR = "cec01570ea3ea738564c6e50741114941e513a1f"
TYPES = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
         "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED")


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _append_raw(raw: bytes, additions: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "evt_f20_1822_package_resumed"'
    if (raw != r1._lf(raw) or len(additions) != 6 or raw.count(marker) != 1
            or raw.count(b'"last_sequence": 1822') != 1):
        raise ValueError("F20_U01_R6B_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    return raw.replace(marker, insertion + marker.replace(
        b"evt_f20_1822_package_resumed", additions[-1]["event_id"].encode()
    )).replace(b'"last_sequence": 1822', b'"last_sequence": 1828', 1)


def _make_rows(old_rows: list[dict], wi_sha: str, invocation_sha: str,
               dispatch_head: str, at: datetime, nonce: str) -> list[dict]:
    at_text = at.isoformat(timespec="seconds")
    expires = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    old_worker, old_write = old_rows[1819]["details"], old_rows[1820]["details"]
    execution = f"f20-u01-r6b-execution-fence-epoch-19-{nonce}"
    write_token = f"f20-u01-r6b-write-fence-epoch-19-{nonce}"
    worker = {"lease_id": f"worker-lease-f20-u01-r6b-{nonce}", "actor_id": ACTOR,
              "subject_ref": SUBJECT, "status": "ACTIVE", "issued_at": at_text,
              "expires_at": expires, "lease_epoch": 19, "fencing_token": execution,
              "execution_fencing_token": execution, "baseline_git_commit": dispatch_head,
              "dispatch_head": dispatch_head, "path_scope": SCOPE}
    write = {**worker, "lease_id": f"write-lease-f20-u01-r6b-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 19,
             "fencing_token": write_token, "write_fencing_token": write_token}
    details = (
        {"lease_id": old_write["lease_id"],
         "write_fencing_token": old_write["write_fencing_token"],
         "reason": "F20_U01_R6_BROWSER_BODY_UNREADABLE_R6B_REWORK"},
        {"lease_id": old_worker["lease_id"],
         "execution_fencing_token": old_worker["execution_fencing_token"],
         "reason": "F20_U01_R6_BROWSER_BODY_UNREADABLE_R6B_REWORK"},
        {"path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
         "invocation_sha256": invocation_sha,
         "classification": "MAIN_INTERNAL_REWORK"},
        worker, write,
        {"worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
         "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
         "package_status": "REWORK_IN_PROGRESS", "accepted": False},
    )
    additions = []
    for kind, detail in zip(TYPES, details):
        previous = additions[-1] if additions else old_rows[-1]
        sequence = previous["sequence"] + 1
        additions.append({"sequence": sequence,
                          "event_id": f"evt_f20_{sequence}_{kind.lower()}",
                          "event_type": kind, "actor": "main-agent-eoul",
                          "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                          "project_id": "anvil", "work_package_id": "F-20",
                          "run_id": None, "step_id": MODE, "subject_ref": SUBJECT,
                          "occurred_at": at_text,
                          "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                          "previous_event_sha256": r1._sha(r1._canonical(previous)),
                          "details": detail})
    return additions


def _projection(old_progress: dict, old_raw: bytes, old_rows: list[dict],
                additions: list[dict], dispatch_head: str, wi_sha: str,
                invocation_sha: str) -> dict[str, bytes]:
    event_raw = _append_raw(old_raw, additions)
    worker, write = additions[3]["details"], additions[4]["details"]
    old_worker, old_write = old_rows[1819]["details"], old_rows[1820]["details"]
    at_text = additions[0]["occurred_at"]
    progress = deepcopy(old_progress)
    progress.update({
        "snapshot_id": "snapshot-f20-u01-r6b-error-body-start-seq1828",
        "event_sequence": END, "last_event_id": additions[-1]["event_id"],
        "updated_at": at_text, "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "completed_f20_u01_r6_worker_lease": {**old_worker, "status": "REVOKED",
                                               "revoked_at": at_text},
        "completed_f20_u01_r6_write_lease": {**old_write, "status": "REVOKED",
                                              "revoked_at": at_text},
        "f20_overall_status": "REWORK_IN_PROGRESS", "next_safe_action": NEXT,
        "runtime_next_action": NEXT,
        "active_work_instruction": {
            "artifact_id": "WI-F-20-U01-R6B-20260929-001", "path": WI,
            "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
            "result_status": "REWORK_IN_PROGRESS",
            "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_INTERNAL_REWORK"},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["repository"].update({
        "local_head": dispatch_head, "remote_head": dispatch_head,
        "validated_base_commit": dispatch_head, "projection_mode": MODE,
        "worktree_status": "F20_U01_R6B_ERROR_BODY_ACTIVE",
        "product_write_scope": SCOPE, "commit_status": "PENDING", "push_status": "PENDING",
    })
    progress["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(progress)
    summary = {"event_sequence": END, "last_event_id": additions[-1]["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": ACTOR, "worker_lease": worker, "write_lease": write,
               "incident_event_id": prior.prior.prior.prior.prior.prior.prior.prior.prior.INCIDENT_ID,
               "incident_blocking": True, "next_safe_action": NEXT,
               "repository_head": dispatch_head,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": progress["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20/U-01 R6B Error Body handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- C30 CRITICAL OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({"schema_version": "1.0.0", "algorithm": "SHA-256",
                             "event_sequence": END, "self_reference": False,
                             "progress": {"path": PROGRESS, "bytes": len(progress_raw),
                                          "file_sha256": r1._sha(progress_raw)},
                             "handoff": {"path": HANDOFF, "bytes": len(handoff_raw),
                                         "file_sha256": r1._sha(handoff_raw)}})
    manifest_raw = r1._pretty({
        "schema_version": "1.0.0", "package_id": "F-20", "event_sequence": END,
        "accepted": False, "projection_mode": MODE, "previous_event_sequence": START,
        "product_write_scope": SCOPE, "predecessor_commit": dispatch_head,
        "predecessor_events_sha256": r1._sha(old_raw),
        "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
        "incident_event_id": prior.prior.prior.prior.prior.prior.prior.prior.prior.INCIDENT_ID,
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def materialize(root: Path, dispatch_head: str, at: datetime, nonce: str) -> None:
    root = Path(root)
    raw = (root / EVENTS).read_bytes()
    stream = json.loads(raw)
    rows = stream["events"]
    progress = json.loads((root / PROGRESS).read_bytes())
    if (len(rows) != START or stream.get("last_sequence") != START
            or progress.get("event_sequence") != START
            or progress.get("repository", {}).get("projection_mode") != prior.MODE
            or progress.get("worker_lease") != rows[1819]["details"]
            or progress.get("write_lease") != rows[1820]["details"]
            or at.tzinfo is None or not re.fullmatch(r"[0-9a-f]{40}", dispatch_head)
            or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                != "development/codex/f18-wsl-ops"
            or _git(root, "rev-parse", "HEAD").decode().strip() != dispatch_head
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
                != dispatch_head
            or _git(root, "show", f"{dispatch_head}:{EVENTS}") != raw
            or any(_git(root, "show", f"{PREP_ANCHOR}:{path}")
                   != _git(root, "show", f"{dispatch_head}:{path}")
                   or _git(root, "show", f"{PREP_ANCHOR}:{path}") != (root / path).read_bytes()
                   for path in (WI, INVOCATION, PLAN))):
        raise RuntimeError("F20_U01_R6B_PREDECESSOR_INVALID")
    issued = datetime.fromisoformat(rows[1819]["details"]["issued_at"])
    if (at < issued or at >= datetime.fromisoformat(rows[1819]["details"]["expires_at"])
            or prior.validate_control(root, {"_root": root, "progress": progress,
                                             "events": stream}, at)):
        raise RuntimeError("F20_U01_R6B_PREDECESSOR_INVALID")
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    additions = _make_rows(rows, wi_sha, invocation_sha, dispatch_head, at, nonce)
    outputs = _projection(progress, raw, rows, additions, dispatch_head, wi_sha, invocation_sha)
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    progress, stream = bundle.get("progress") or {}, bundle.get("events") or {}
    rows = stream.get("events") or []
    if not isinstance(rows, list) or len(rows) != END:
        return ["F20_U01_R6B_TRANSITION_INVALID"]
    try:
        worker = rows[1825]["details"]
        dispatch_head = worker["dispatch_head"]
        nonce = worker["lease_id"].removeprefix("worker-lease-f20-u01-r6b-")
        at = datetime.fromisoformat(rows[1822]["occurred_at"])
        expiry = datetime.fromisoformat(worker["expires_at"])
        if (not re.fullmatch(r"[0-9a-f]{40}", dispatch_head)
                or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
                or at.tzinfo is None or expiry.tzinfo is None
                or not at <= now < expiry or expiry - at != timedelta(hours=12)):
            return ["F20_U01_R6B_TRANSITION_INVALID"]
        old_raw = _git(root, "show", f"{dispatch_head}:{EVENTS}")
        old_stream = json.loads(old_raw)
        old_rows = old_stream["events"]
        old_progress = json.loads(_git(root, "show", f"{dispatch_head}:{PROGRESS}"))
        wi_raw = _git(root, "show", f"{dispatch_head}:{WI}")
        invocation_raw = _git(root, "show", f"{dispatch_head}:{INVOCATION}")
        wi_sha = r1._sha(r1._lf(wi_raw))
        invocation_sha = r1._sha(r1._lf(invocation_raw))
        if (len(old_rows) != START or old_stream["last_sequence"] != START
                or old_progress.get("repository", {}).get("projection_mode") != prior.MODE
                or old_progress.get("event_sequence") != START
                or old_progress.get("worker_lease") != old_rows[1819]["details"]
                or old_progress.get("write_lease") != old_rows[1820]["details"]
                or rows[:START] != old_rows
                or (root / WI).read_bytes() != wi_raw
                or (root / INVOCATION).read_bytes() != invocation_raw
                or any(_git(root, "show", f"{PREP_ANCHOR}:{path}")
                       != _git(root, "show", f"{dispatch_head}:{path}")
                       or _git(root, "show", f"{PREP_ANCHOR}:{path}") != (root / path).read_bytes()
                       for path in (WI, INVOCATION, PLAN))):
            return ["F20_U01_R6B_PREDECESSOR_INVALID"]
        expected_rows = _make_rows(old_rows, wi_sha, invocation_sha, dispatch_head, at, nonce)
        previous_tokens = r1._historical_fencing_tokens(old_rows)
        if (rows[START:] != expected_rows
                or worker["execution_fencing_token"] in previous_tokens
                or rows[1826]["details"]["write_fencing_token"] in previous_tokens):
            return ["F20_U01_R6B_TRANSITION_INVALID"]
        expected = _projection(old_progress, old_raw, old_rows, expected_rows,
                               dispatch_head, wi_sha, invocation_sha)
        current = {path: (root / path).read_bytes() for path in expected}
        errors = []
        for path, name in ((EVENTS, "HISTORY_MUTATED"), (PROGRESS, "PROGRESS_INVALID"),
                           (HANDOFF, "HANDOFF_INVALID"), (DIGEST, "DIGEST_INVALID"),
                           (MANIFEST, "MANIFEST_INVALID")):
            if current[path] != expected[path]:
                errors.append(f"F20_U01_R6B_{name}")
        if json.loads(current[EVENTS]) != stream or json.loads(current[PROGRESS]) != progress:
            errors.append("F20_U01_R6B_PROGRESS_INVALID")
        if (progress.get("f20_c30_event_integrity_incident", {}).get("status") != "OPEN_BLOCKING"
                or progress.get("scope_revision_binding", {}).get("release_decision") != "DEFER"
                or "F-20" in progress.get("completed_packages", [])):
            errors.append("F20_U01_R6B_PROGRESS_INVALID")
        if bundle.get("detached_digest", json.loads(current[DIGEST])) != json.loads(current[DIGEST]):
            errors.append("F20_U01_R6B_DIGEST_INVALID")
        if bundle.get("_detached_digest_path", DIGEST) != DIGEST:
            errors.append("F20_U01_R6B_DIGEST_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.CalledProcessError):
        return ["F20_U01_R6B_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        base = progress["repository"]["validated_base_commit"]
        branch = _git(root, "branch", "--show-current").decode().strip()
        upstream = _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{base}..HEAD").decode().splitlines()))
        dirty = set(filter(None, _git(root, "diff", "--no-renames", "--name-only").decode().splitlines()))
        dirty.update(filter(None, _git(root, "diff", "--cached", "--no-renames",
                                       "--name-only").decode().splitlines()))
        dirty.update(filter(None, _git(root, "ls-files", "--others", "--exclude-standard").decode().splitlines()))
        valid = (branch == "codex/f18-wsl-ops"
                 and upstream == "development/codex/f18-wsl-ops"
                 and all(re.fullmatch(r"[0-9a-f]{40}", x or "") for x in (base, head, remote))
                 and all(subprocess.run(["git", "merge-base", "--is-ancestor", base, target],
                                        cwd=root, capture_output=True).returncode == 0
                         for target in (head, remote))
                 and changed <= CONTROL_SCOPE | set(SCOPE)
                 and dirty <= CONTROL_SCOPE | set(SCOPE))
        return [] if valid else ["F20_U01_R6B_GIT_INVALID"]
    except (OSError, subprocess.CalledProcessError, KeyError, TypeError, UnicodeDecodeError):
        return ["F20_U01_R6B_GIT_INVALID"]
