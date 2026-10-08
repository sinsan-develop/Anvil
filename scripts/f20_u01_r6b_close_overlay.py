"""Append-only close of R6B's scoped browser QA, without F-20 acceptance."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r6b_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r6b_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 1828, 1830
BASE = "9ddbb65a251f9b9a07979d09b777d7ec2678db6c"
MODE = "F20_U01_R6B_SCOPED_QA_CLOSE"
NEXT = "F20_U01_DASHBOARD_GAP_WORK_INSTRUCTION"
PLAN = "docs/04_test_reports/F-20_U01_R6B_CLOSE_PLAN.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r6b-close.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R6B_CLOSE_MANIFEST.json"
CONTROL_SCOPE = {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST, PLAN,
    "scripts/f20_u01_r6b_close_overlay.py", "scripts/check_project_progress.py",
    "tests/tooling/test_f20_u01_r6b_close_projection.py", "docs/WORK_STATUS.md",
}
KINDS = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED")


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _historical(root: Path) -> tuple[bytes, dict, dict]:
    raw = _git(root, "show", f"{BASE}:{EVENTS}")
    return raw, json.loads(raw), json.loads(_git(root, "show", f"{BASE}:{PROGRESS}"))


def _append_raw(raw: bytes, additions: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "evt_f20_1828_package_resumed"'
    if (raw != r1._lf(raw) or raw.count(marker) != 1 or len(additions) != 2
            or raw.count(b'"last_sequence": 1828') != 1):
        raise ValueError("F20_U01_R6B_CLOSE_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in additions)
    return raw.replace(marker, insertion + marker.replace(
        b"evt_f20_1828_package_resumed", additions[-1]["event_id"].encode()
    )).replace(b'"last_sequence": 1828', b'"last_sequence": 1830', 1)


def _make_rows(old: list[dict], at: datetime) -> list[dict]:
    old_write = old[1826]["details"]
    old_worker = old[1825]["details"]
    details = (
        {"lease_id": old_write["lease_id"],
         "write_fencing_token": old_write["write_fencing_token"],
         "reason": "R6B_SCOPED_QA_VERIFIED_F20_STILL_BLOCKED", "evidence_head": BASE},
        {"lease_id": old_worker["lease_id"],
         "execution_fencing_token": old_worker["execution_fencing_token"],
         "reason": "R6B_SCOPED_QA_VERIFIED_F20_STILL_BLOCKED", "evidence_head": BASE},
    )
    result = []
    for kind, detail in zip(KINDS, details):
        previous = result[-1] if result else old[-1]
        sequence = previous["sequence"] + 1
        result.append({
            "sequence": sequence, "event_id": f"evt_f20_{sequence}_{kind.lower()}",
            "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
            "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
            "run_id": None, "step_id": MODE, "subject_ref": "F-20/U01-R6B",
            "occurred_at": at.isoformat(timespec="seconds"),
            "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
            "previous_event_sha256": r1._sha(r1._canonical(previous)), "details": detail,
        })
    return result


def _projection(root: Path, old_progress: dict, old_raw: bytes, old_rows: list[dict],
                additions: list[dict]) -> dict[str, bytes]:
    event_raw = _append_raw(old_raw, additions)
    at_text = additions[0]["occurred_at"]
    old_worker, old_write = old_rows[1825]["details"], old_rows[1826]["details"]
    progress = deepcopy(old_progress)
    progress.update({
        "snapshot_id": "snapshot-f20-u01-r6b-scoped-qa-close-seq1830",
        "event_sequence": END, "last_event_id": additions[-1]["event_id"],
        "updated_at": at_text, "status": "ACTIVE", "active_agent": "main-agent-eoul",
        "worker_lease": None, "write_lease": None,
        "completed_f20_u01_r6b_worker_lease": {**old_worker, "status": "REVOKED",
                                                 "revoked_at": at_text},
        "completed_f20_u01_r6b_write_lease": {**old_write, "status": "REVOKED",
                                                "revoked_at": at_text},
        "f20_overall_status": "REWORK_IN_PROGRESS", "next_safe_action": NEXT,
        "runtime_next_action": NEXT,
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    progress["active_work_instruction"] = {
        **progress["active_work_instruction"], "result_status": "COMPLETED_SCOPED_QA",
        "package_status": "REWORK_IN_PROGRESS"}
    progress["repository"].update({
        "local_head": BASE, "remote_head": BASE, "local_wsl_qa_head": BASE,
        "validated_base_commit": BASE, "projection_mode": MODE,
        "worktree_status": "F20_U01_R6B_SCOPED_QA_CLOSED",
        "product_write_scope": [], "commit_status": "PENDING", "push_status": "PENDING",
    })
    progress["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(progress)
    snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(progress)
    summary = {
        "event_sequence": END, "last_event_id": additions[-1]["event_id"],
        "status": "ACTIVE", "current_work_package": "F-20",
        "active_agent": "main-agent-eoul", "worker_lease": None, "write_lease": None,
        "incident_event_id": old_progress["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "next_safe_action": NEXT,
        "repository_head": BASE,
        "repository_upstream": "development/codex/f18-wsl-ops",
        "reporting_decision": progress["reporting_decision"]["decision"],
    }
    handoff_raw = (b"# F-20/U-01 R6B scoped QA close handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- R6B scoped QA only; C30 OPEN_BLOCKING; F-20 incomplete; Production NOT_EXECUTED.\n")
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
        "product_write_scope": [], "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(old_raw),
        "plan_path": PLAN, "plan_sha256": r1._sha(r1._lf((root / PLAN).read_bytes())),
        "incident_event_id": old_progress["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False,
    })
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def materialize(root: Path, dispatch_head: str, at: datetime) -> None:
    root = Path(root)
    old_raw, old_stream, old_progress = _historical(root)
    old_worker, old_write = old_progress["worker_lease"], old_progress["write_lease"]
    if (dispatch_head != BASE or at.tzinfo is None
            or not datetime.fromisoformat(old_worker["issued_at"]) <= at
                   < datetime.fromisoformat(old_worker["expires_at"])
            or old_worker["status"] != "ACTIVE" or old_write["status"] != "ACTIVE"
            or old_write["worker_lease_id"] != old_worker["lease_id"]
            or old_stream["last_sequence"] != START or len(old_stream["events"]) != START
            or old_progress["event_sequence"] != START
            or old_progress["repository"]["projection_mode"] != prior.MODE
            or (root / EVENTS).read_bytes() != old_raw
            or (root / PROGRESS).read_bytes() != _git(root, "show", f"{BASE}:{PROGRESS}")
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or prior.validate_control(root, {"_root": root, "progress": old_progress,
                                             "events": old_stream}, at)):
        raise RuntimeError("F20_U01_R6B_CLOSE_PREDECESSOR_INVALID")
    additions = _make_rows(old_stream["events"], at)
    outputs = _projection(root, old_progress, old_raw, old_stream["events"], additions)
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        old_raw, old_stream, old_progress = _historical(root)
        rows = bundle["events"]["events"]
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        if (now.tzinfo is None or at.tzinfo is None or now < at
                or at < datetime.fromisoformat(old_progress["worker_lease"]["issued_at"])
                or at >= datetime.fromisoformat(old_progress["worker_lease"]["expires_at"])
                or len(rows) != END or rows[:START] != old_stream["events"]
                or bundle["events"]["last_sequence"] != END
                or [row["event_type"] for row in rows[START:]] != list(KINDS)
                or rows[START:] != _make_rows(old_stream["events"], at)
                or old_progress["repository"]["projection_mode"] != prior.MODE):
            return ["F20_U01_R6B_CLOSE_EVENT_INVALID"]
        expected = _projection(root, old_progress, old_raw, old_stream["events"], rows[START:])
        errors = [f"F20_U01_R6B_CLOSE_{path.split('/')[-1].upper()}_INVALID"
                  for path, content in expected.items() if (root / path).read_bytes() != content]
        if (bundle["progress"] != json.loads(expected[PROGRESS])
                or bundle["events"] != json.loads(expected[EVENTS])
                or bundle.get("detached_digest", json.loads(expected[DIGEST]))
                   != json.loads(expected[DIGEST])
                or bundle.get("_detached_digest_path", DIGEST) != DIGEST):
            errors.append("F20_U01_R6B_CLOSE_PROJECTION_INVALID")
        if (bundle["progress"].get("f20_c30_event_integrity_incident", {}).get("status")
                != "OPEN_BLOCKING" or bundle["progress"].get("scope_revision_binding", {}).get(
                    "release_decision") != "DEFER" or "F-20" in bundle["progress"].get(
                    "completed_packages", [])):
            errors.append("F20_U01_R6B_CLOSE_BLOCKING_STATE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.CalledProcessError):
        return ["F20_U01_R6B_CLOSE_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        branch = _git(root, "branch", "--show-current").decode().strip()
        upstream = _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--name-only", f"{BASE}..HEAD").decode().splitlines()))
        dirty = set(filter(None, _git(root, "diff", "--name-only").decode().splitlines()))
        dirty.update(filter(None, _git(root, "diff", "--cached", "--name-only").decode().splitlines()))
        dirty.update(filter(None, _git(root, "ls-files", "--others", "--exclude-standard").decode().splitlines()))
        good = (branch == "codex/f18-wsl-ops"
                and upstream == "development/codex/f18-wsl-ops"
                and all(re.fullmatch(r"[0-9a-f]{40}", value or "") for value in (head, remote))
                and all(subprocess.run(["git", "merge-base", "--is-ancestor", BASE, value],
                                        cwd=root, capture_output=True).returncode == 0
                        for value in (head, remote))
                and changed <= CONTROL_SCOPE and dirty <= CONTROL_SCOPE
                and progress["repository"]["projection_mode"] == MODE)
        return [] if good else ["F20_U01_R6B_CLOSE_GIT_INVALID"]
    except (OSError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["F20_U01_R6B_CLOSE_GIT_INVALID"]
