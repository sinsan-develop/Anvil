"""Atomically revoke incomplete R27 leases and issue R28 evidence-contract leases."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r27_start_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r27_start_overlay as prior

r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 1960, 1966
BASE = "91bfe15667368c7cb2e4f0be6716dffd82d53f8f"
MODE = "F20_U01_R28_BROWSER_EVIDENCE_CONTRACT_START"
ACTOR = "developer-primary-f20-u01-r28"
SUBJECT = "F-20/U01-R28"
NEXT = "F20_U01_R28_BROWSER_EVIDENCE_CONTRACT_REWORK"
PLAN = "docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_PLAN.md"
WI = "docs/work_orders/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_INVOCATION.md"
REPORT = "docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_RESULT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r28-start.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_START_MANIFEST.json"
SCOPE = ["tests/integration/test_f20_u01_oidc_browser_pg15.py", REPORT]
CONTROL_SCOPE = {EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST, PLAN, WI, INVOCATION,
                 REPORT, prior.PLAN, prior.WI, prior.INVOCATION,
                 "docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_RESULT.md",
                 "scripts/f20_u01_r27_start_overlay.py", "scripts/f20_u01_r28_start_overlay.py",
                 "tests/tooling/test_f20_u01_r27_start_projection.py",
                 "tests/tooling/test_f20_u01_r28_start_projection.py",
                 "scripts/f20_u01_r28_close_overlay.py",
                 "tests/tooling/test_f20_u01_r28_close_projection.py",
                 "docs/progress/progress-handoff-detached-digest-f20-u01-r28-close.json",
                 "docs/evidence/manifests/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_CLOSE_MANIFEST.json",
                 "scripts/check_project_progress.py", "docs/WORK_STATUS.md"}
KINDS = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORK_INSTRUCTION_ISSUED",
         "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED")


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _historical(root: Path) -> tuple[bytes, dict, dict]:
    raw = _git(root, "show", f"{BASE}:{EVENTS}")
    return raw, json.loads(raw), json.loads(_git(root, "show", f"{BASE}:{PROGRESS}"))


def _append_raw(raw: bytes, old: dict, additions: list[dict]) -> bytes:
    marker = (b'\n  ],\n  "last_event_id": "' + old["last_event_id"].encode() + b'"')
    sequence = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or len(additions) != len(KINDS)
            or raw.count(marker) != 1 or raw.count(sequence) != 1):
        raise ValueError("F20_U01_R28_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    replacement = (b'\n  ],\n  "last_event_id": "' + additions[-1]["event_id"].encode() + b'"')
    return raw.replace(marker, insertion + replacement).replace(
        sequence, f'"last_sequence": {END}'.encode(), 1)


def _make_rows(old: list[dict], old_progress: dict, wi_sha: str,
               invocation_sha: str, at: datetime, nonce: str) -> list[dict]:
    stamp = at.isoformat(timespec="seconds")
    expiry = (at + timedelta(hours=12)).isoformat(timespec="seconds")
    old_worker, old_write = old_progress["worker_lease"], old_progress["write_lease"]
    execution = f"f20-u01-r28-execution-fence-epoch-42-{nonce}"
    write_token = f"f20-u01-r28-write-fence-epoch-42-{nonce}"
    worker = {"lease_id": f"worker-lease-f20-u01-r28-{nonce}",
              "actor_id": ACTOR, "subject_ref": SUBJECT, "status": "ACTIVE",
              "issued_at": stamp, "expires_at": expiry, "lease_epoch": 42,
              "fencing_token": execution, "execution_fencing_token": execution,
              "baseline_git_commit": BASE, "dispatch_head": BASE,
              "path_scope": SCOPE}
    write = {**worker, "lease_id": f"write-lease-f20-u01-r28-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 42,
             "fencing_token": write_token, "write_fencing_token": write_token}
    details = (
        {"lease_id": old_write["lease_id"],
         "write_fencing_token": old_write["write_fencing_token"],
         "reason": "R27_INCOMPLETE_BROWSER_EVIDENCE_CONTRACT_REWORK",
         "evidence_head": BASE},
        {"lease_id": old_worker["lease_id"],
         "execution_fencing_token": old_worker["execution_fencing_token"],
         "reason": "R27_INCOMPLETE_BROWSER_EVIDENCE_CONTRACT_REWORK",
         "evidence_head": BASE},
        {"path": WI, "sha256": wi_sha, "invocation_path": INVOCATION,
         "invocation_sha256": invocation_sha,
         "classification": "MAIN_INTERNAL_APPROVED_SCOPE",
         "parent_work_instruction": prior.WI,
         "revision_reason": "R27_BROWSER_EVIDENCE_CONTRACT_GAP"},
        worker, write,
        {"worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
         "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
         "package_status": "REWORK_IN_PROGRESS", "accepted": False},
    )
    rows = []
    for kind, detail in zip(KINDS, details):
        previous = rows[-1] if rows else old[-1]
        sequence = previous["sequence"] + 1
        rows.append({"sequence": sequence,
                     "event_id": f"evt_f20_{sequence}_{kind.lower()}",
                     "event_type": kind, "actor": "main-agent-eoul",
                     "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                     "project_id": "anvil", "work_package_id": "F-20",
                     "run_id": None, "step_id": MODE, "subject_ref": SUBJECT,
                     "occurred_at": stamp,
                     "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                     "previous_event_sha256": r1._sha(r1._canonical(previous)),
                     "details": detail})
    return rows


def _projection(root: Path, old_progress: dict, old_raw: bytes,
                old_stream: dict, additions: list[dict], wi_sha: str,
                invocation_sha: str) -> dict[str, bytes]:
    event_raw = _append_raw(old_raw, old_stream, additions)
    stamp = additions[0]["occurred_at"]
    old_worker, old_write = old_progress["worker_lease"], old_progress["write_lease"]
    worker, write = additions[3]["details"], additions[4]["details"]
    progress = deepcopy(old_progress)
    progress.update({
        "snapshot_id": "snapshot-f20-u01-r28-browser-evidence-contract-start-seq1966",
        "event_sequence": END, "last_event_id": additions[-1]["event_id"],
        "updated_at": stamp, "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "completed_f20_u01_r27_worker_lease": {
            **old_worker, "status": "REVOKED", "revoked_at": stamp},
        "completed_f20_u01_r27_write_lease": {
            **old_write, "status": "REVOKED", "revoked_at": stamp},
        "f20_overall_status": "REWORK_IN_PROGRESS", "next_safe_action": NEXT,
        "runtime_next_action": NEXT,
        "active_work_instruction": {
            "artifact_id": "WI-F-20-U01-R28-20261002-001", "path": WI,
            "sha256": wi_sha, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_sha,
            "result_status": "REWORK_IN_PROGRESS",
            "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_INTERNAL_APPROVED_SCOPE"},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["repository"].update({
        "local_head": BASE, "remote_head": BASE, "local_wsl_qa_head": BASE,
        "validated_base_commit": BASE, "projection_mode": MODE,
        "worktree_status": "F20_U01_R28_BROWSER_EVIDENCE_CONTRACT_ACTIVE",
        "product_write_scope": SCOPE, "commit_status": "PENDING",
        "push_status": "PENDING"})
    progress["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(progress)
    summary = {"event_sequence": END, "last_event_id": additions[-1]["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": ACTOR, "worker_lease": worker, "write_lease": write,
               "incident_event_id": old_progress["f20_c30_event_integrity_incident"]["event_id"],
               "incident_blocking": True, "next_safe_action": NEXT,
               "repository_head": BASE,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": progress["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20/U-01 R28 Browser Evidence Contract handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- R27 lease revoked incomplete; R28 evidence-contract rework only; "
                     b"C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": END,
        "self_reference": False,
        "progress": {"path": PROGRESS, "bytes": len(progress_raw),
                     "file_sha256": r1._sha(progress_raw)},
        "handoff": {"path": HANDOFF, "bytes": len(handoff_raw),
                    "file_sha256": r1._sha(handoff_raw)}})
    manifest_raw = r1._pretty({
        "schema_version": "1.0.0", "package_id": "F-20", "event_sequence": END,
        "accepted": False, "projection_mode": MODE, "previous_event_sequence": START,
        "product_write_scope": SCOPE, "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(old_raw),
        "plan_path": PLAN, "plan_sha256": r1._sha(r1._lf((root / PLAN).read_bytes())),
        "work_instruction_sha256": wi_sha, "invocation_sha256": invocation_sha,
        "incident_event_id": old_progress["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def materialize(root: Path, at: datetime, nonce: str) -> None:
    root = Path(root)
    raw, stream, progress = _historical(root)
    worker, write = progress["worker_lease"], progress["write_lease"]
    if (at.tzinfo is None or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
            or not datetime.fromisoformat(worker["issued_at"]) <= at
                   < datetime.fromisoformat(worker["expires_at"])
            or worker["status"] != "ACTIVE" or write["status"] != "ACTIVE"
            or write["worker_lease_id"] != worker["lease_id"]
            or stream["last_sequence"] != START or len(stream["events"]) != START
            or progress["event_sequence"] != START
            or progress["repository"]["projection_mode"] != prior.MODE
            or progress["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
            or progress["scope_revision_binding"]["release_decision"] != "DEFER"
            or (root / EVENTS).read_bytes() != raw
            or (root / PROGRESS).read_bytes() != _git(root, "show", f"{BASE}:{PROGRESS}")
            or any((root / path).read_bytes() != _git(root, "show", f"{BASE}:{path}")
                   for path in (PLAN, WI, INVOCATION, REPORT))
            or _git(root, "branch", "--show-current").decode().strip()
                   != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                   != "development/codex/f18-wsl-ops"
            or _git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
                   != BASE
            or not prior._dirty(root) <= CONTROL_SCOPE
            or prior.validate_control(root, {"_root": root, "progress": progress,
                                            "events": stream}, at)):
        raise RuntimeError("F20_U01_R28_PREDECESSOR_INVALID")
    wi_sha = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_sha = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    additions = _make_rows(stream["events"], progress, wi_sha, invocation_sha, at, nonce)
    outputs = _projection(root, progress, raw, stream, additions, wi_sha, invocation_sha)
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        raw, old_stream, old_progress = _historical(root)
        rows = bundle["events"]["events"]
        worker, write = rows[1963]["details"], rows[1964]["details"]
        nonce = worker["lease_id"].removeprefix("worker-lease-f20-u01-r28-")
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        wi_sha = r1._sha(r1._lf(_git(root, "show", f"{BASE}:{WI}")))
        invocation_sha = r1._sha(r1._lf(_git(root, "show", f"{BASE}:{INVOCATION}")))
        if (now.tzinfo is None or at.tzinfo is None or not at <= now
                < datetime.fromisoformat(worker["expires_at"])
                or datetime.fromisoformat(worker["expires_at"]) - at != timedelta(hours=12)
                or not re.fullmatch(r"[a-z0-9]{4,32}", nonce)
                or len(rows) != END or rows[:START] != old_stream["events"]
                or bundle["events"]["last_sequence"] != END
                or [row["event_type"] for row in rows[START:]] != list(KINDS)
                or rows[START:] != _make_rows(old_stream["events"], old_progress,
                                              wi_sha, invocation_sha, at, nonce)
                or worker["execution_fencing_token"] in r1._historical_fencing_tokens(
                    old_stream["events"])
                or write["write_fencing_token"] in r1._historical_fencing_tokens(
                    old_stream["events"])
                or any((root / path).read_bytes() != _git(root, "show", f"{BASE}:{path}")
                       for path in (PLAN, WI, INVOCATION))):
            return ["F20_U01_R28_TRANSITION_INVALID"]
        expected = _projection(root, old_progress, raw, old_stream, rows[START:],
                               wi_sha, invocation_sha)
        errors = [f"F20_U01_R28_{path.split('/')[-1].upper()}_INVALID"
                  for path, content in expected.items()
                  if (root / path).read_bytes() != content]
        if (bundle["progress"] != json.loads(expected[PROGRESS])
                or bundle["events"] != json.loads(expected[EVENTS])
                or bundle.get("detached_digest", json.loads(expected[DIGEST]))
                   != json.loads(expected[DIGEST])
                or bundle.get("_detached_digest_path", DIGEST) != DIGEST):
            errors.append("F20_U01_R28_PROJECTION_INVALID")
        if (bundle["progress"].get("f20_c30_event_integrity_incident", {}).get("status")
                != "OPEN_BLOCKING" or bundle["progress"].get(
                    "scope_revision_binding", {}).get("release_decision") != "DEFER"
                or "F-20" in bundle["progress"].get("completed_packages", [])):
            errors.append("F20_U01_R28_BLOCKING_STATE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["F20_U01_R28_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        good = (_git(root, "branch", "--show-current").decode().strip()
                == "codex/f18-wsl-ops"
                and _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                    == "development/codex/f18-wsl-ops"
                and all(re.fullmatch(r"[0-9a-f]{40}", value or "")
                        for value in (head, remote))
                and all(subprocess.run(["git", "merge-base", "--is-ancestor", BASE, value],
                                       cwd=root, capture_output=True).returncode == 0
                        for value in (head, remote))
                and subprocess.run(["git", "merge-base", "--is-ancestor", remote, head],
                                   cwd=root, capture_output=True).returncode == 0
                and changed <= CONTROL_SCOPE | set(SCOPE)
                and prior._dirty(root) <= CONTROL_SCOPE | set(SCOPE)
                and progress["repository"]["projection_mode"] == MODE)
        return [] if good else ["F20_U01_R28_GIT_INVALID"]
    except (OSError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["F20_U01_R28_GIT_INVALID"]
