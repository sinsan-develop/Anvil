"""Close the verified C30 preflight writer; do not resolve the incident."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import subprocess

try:
    from scripts import f20_c30_recovery_start_overlay as prior
    from scripts.f20_c30_recovery_v2 import (
        APPROVAL_PATH, RECOVERY_APPROVAL_PATH, RECOVERY_DESIGN_PATH,
        RECOVERY_MANIFEST_PATH, RECOVERY_PLAN_PATH, RECOVERY_WI_PATH,
        REVISION_BINDING_PATH, SCOPE_ARTIFACT_SHA256, verify_repository,
    )
except ModuleNotFoundError:
    import f20_c30_recovery_start_overlay as prior
    from f20_c30_recovery_v2 import (
        APPROVAL_PATH, RECOVERY_APPROVAL_PATH, RECOVERY_DESIGN_PATH,
        RECOVERY_MANIFEST_PATH, RECOVERY_PLAN_PATH, RECOVERY_WI_PATH,
        REVISION_BINDING_PATH, SCOPE_ARTIFACT_SHA256, verify_repository,
    )


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 2044, 2046
BASE = "b58b389e3c9f2ae6d9b37937a83a1709535b0cc7"
MODE = "F20_C30_RECOVERY_V2_VERIFIER_CLOSE"
NEXT = "C30_V2_LEDGER_GENERATION_START_PENDING_INDEPENDENT_CONTROL"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-c30-recovery-v2-close.json"
MANIFEST = "docs/evidence/manifests/F-20_C30_RECOVERY_V2_VERIFIER_CLOSE_MANIFEST.json"
KINDS = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED")
CONTROL_SCOPE = prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST,
    "docs/WORK_STATUS.md", "scripts/check_project_progress.py",
    "scripts/f20_c30_recovery_close_overlay.py",
    "tests/tooling/test_f20_c30_recovery_close_projection.py",
    "scripts/f20_c30_generation_start_overlay.py",
    "tests/tooling/test_f20_c30_generation_start_projection.py",
}
FROZEN_CONTROL = (
    "scripts/f20_c30_recovery_v2.py", APPROVAL_PATH,
    RECOVERY_APPROVAL_PATH, RECOVERY_DESIGN_PATH, RECOVERY_PLAN_PATH,
    RECOVERY_WI_PATH, RECOVERY_MANIFEST_PATH, REVISION_BINDING_PATH,
    *SCOPE_ARTIFACT_SHA256,
)


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _base(root: Path) -> tuple[bytes, dict, dict]:
    raw = _git(root, "show", f"{BASE}:{EVENTS}")
    return raw, json.loads(raw), json.loads(_git(root, "show", f"{BASE}:{PROGRESS}"))


def _preflight(root: Path) -> bool:
    evidence = verify_repository(
        root, file_reader=lambda path: _git(root, "show", f"{BASE}:{path}"))
    return evidence.eligible and evidence.errors == []


def _frozen_control(root: Path) -> bool:
    """The executed verifier and every approval input must match pinned BASE."""
    try:
        return all((root / path).read_bytes() == _git(root, "show", f"{BASE}:{path}")
                   for path in FROZEN_CONTROL)
    except (OSError, subprocess.CalledProcessError):
        return False


def _rows(events: list[dict], progress: dict, at: datetime) -> list[dict]:
    stamp = at.isoformat(timespec="seconds")
    worker, write = progress["worker_lease"], progress["write_lease"]
    details = (
        {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
         "reason": "C30_V2_PREFLIGHT_LOCAL_WSL_REVIEW_ACCEPT_EXACT_SCOPE"},
        {"lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
         "reason": "C30_V2_PREFLIGHT_LOCAL_WSL_REVIEW_ACCEPT_EXACT_SCOPE"},
    )
    rows = []
    for kind, detail in zip(KINDS, details):
        predecessor = rows[-1] if rows else events[-1]
        number = predecessor["sequence"] + 1
        rows.append({"sequence": number, "event_id": f"evt_f20_{number}_{kind.lower()}",
                     "event_type": kind, "actor": "main-agent-eoul",
                     "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                     "project_id": "anvil", "work_package_id": "F-20",
                     "run_id": None, "step_id": MODE, "subject_ref": prior.SUBJECT,
                     "occurred_at": stamp,
                     "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                     "previous_event_sha256": r1._sha(r1._canonical(predecessor)),
                     "details": detail})
    return rows


def _append(raw: bytes, old: dict, rows: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "' + old["last_event_id"].encode() + b'"'
    seq = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or len(rows) != 2
            or raw.count(marker) != 1 or raw.count(seq) != 1):
        raise ValueError("C30_V2_CLOSE_RAW_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in rows)
    new_end = b'\n  ],\n  "last_event_id": "' + rows[-1]["event_id"].encode() + b'"'
    return raw.replace(marker, insertion + new_end).replace(
        seq, f'"last_sequence": {END}'.encode(), 1)


def _build(root: Path, at: datetime) -> dict[str, bytes]:
    raw, stream, old = _base(root)
    worker, write = old["worker_lease"], old["write_lease"]
    if (at.tzinfo is None or stream["last_sequence"] != START
            or len(stream["events"]) != START or old["event_sequence"] != START
            or old["repository"]["projection_mode"] != prior.MODE
            or not isinstance(worker, dict) or not isinstance(write, dict)
            or worker.get("lease_epoch") != 55 or write.get("write_epoch") != 55
            or worker.get("status") != "ACTIVE" or write.get("status") != "ACTIVE"
            or write.get("worker_lease_id") != worker.get("lease_id")
            or not datetime.fromisoformat(worker["issued_at"]) <= at
                   < datetime.fromisoformat(worker["expires_at"])
            or old["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
            or old["scope_revision_binding"]["release_decision"] != "DEFER"
            or not _frozen_control(root) or not _preflight(root)):
        raise ValueError("C30_V2_CLOSE_BASE_INVALID")
    rows = _rows(stream["events"], old, at)
    event_raw = _append(raw, stream, rows)
    updated = deepcopy(old)
    updated.update({
        "snapshot_id": "snapshot-f20-c30-recovery-v2-verifier-close-seq2046",
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "updated_at": rows[0]["occurred_at"], "active_agent": "main-agent-eoul",
        "worker_lease": None, "write_lease": None,
        "completed_f20_c30_v2_worker_lease": {**worker, "status": "REVOKED",
                                                 "revoked_at": rows[-1]["occurred_at"]},
        "completed_f20_c30_v2_write_lease": {**write, "status": "REVOKED",
                                                "revoked_at": rows[0]["occurred_at"]},
        "next_safe_action": NEXT, "runtime_next_action": NEXT,
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    updated["active_work_instruction"].update(
        result_status="COMPLETED_C30_V2_PREFLIGHT_WSL_ONLY",
        package_status="REWORK_IN_PROGRESS")
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE, "validated_base_commit": BASE,
        "projection_mode": MODE,
        "worktree_status": "F20_C30_RECOVERY_V2_VERIFIER_COMPLETE_LEASE_CLOSED",
        "product_write_scope": [], "commit_status": "PENDING", "push_status": "PENDING"})
    updated["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(updated)
    snapshot.pop("snapshot_hash", None)
    updated["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(updated)
    summary = {"event_sequence": END, "last_event_id": rows[-1]["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": "main-agent-eoul", "worker_lease": None,
               "write_lease": None,
               "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
               "incident_blocking": True, "next_safe_action": NEXT,
               "repository_head": BASE,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": updated["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20 C30 recovery v2 verifier close handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- Local and WSL preflight only; C30 OPEN_BLOCKING; "
                     b"F-20 unaccepted; Release DEFER; Production NOT_EXECUTED.\n")
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
        "product_write_scope": [], "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(raw),
        "preflight_eligible": True, "preflight_result_scope": "SEQ2044_ONLY",
        "preflight_verifier_path": "scripts/f20_c30_recovery_v2.py",
        "preflight_verifier_sha256": r1._sha(_git(root, "show", f"{BASE}:scripts/f20_c30_recovery_v2.py")),
        "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def project(root: Path, at: datetime) -> dict[str, bytes]:
    return _build(Path(root), at)


def validate_outputs(root: Path, outputs: dict[str, bytes]) -> list[str]:
    try:
        rows = json.loads(outputs[EVENTS])["events"]
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        expected = _build(Path(root), at)
        if set(outputs) != set(expected):
            return ["C30_V2_CLOSE_OUTPUT_SET_INVALID"]
        return [f"C30_V2_CLOSE_{path.split('/')[-1].upper()}_INVALID"
                for path, raw in expected.items() if outputs[path] != raw]
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["C30_V2_CLOSE_STATE_INVALID"]


def materialize(root: Path, at: datetime) -> None:
    root = Path(root)
    if (_git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or (root / EVENTS).read_bytes() != _base(root)[0]
            or (root / PROGRESS).read_bytes() != _git(root, "show", f"{BASE}:{PROGRESS}")):
        raise RuntimeError("C30_V2_CLOSE_PREDECESSOR_INVALID")
    outputs = _build(root, at)
    if validate_outputs(root, outputs):
        raise RuntimeError("C30_V2_CLOSE_PROJECTION_INVALID")
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        outputs = {path: (root / path).read_bytes()
                   for path in (EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST)}
        errors = validate_outputs(root, outputs)
        if (now.tzinfo is None
                or datetime.fromisoformat(json.loads(outputs[EVENTS])["events"][START]["occurred_at"]) > now):
            errors.append("C30_V2_CLOSE_TIME_INVALID")
        if bundle["events"] != json.loads(outputs[EVENTS]) or bundle["progress"] != json.loads(outputs[PROGRESS]):
            errors.append("C30_V2_CLOSE_BUNDLE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        return ["C30_V2_CLOSE_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        dirty = prior.prior.prior._dirty(root)
        good = (_git(root, "branch", "--show-current").decode().strip() == "codex/f18-wsl-ops"
                and _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                    == "development/codex/f18-wsl-ops"
                and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head],
                                   cwd=root, capture_output=True).returncode == 0
                and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, remote],
                                   cwd=root, capture_output=True).returncode == 0
                and subprocess.run(["git", "merge-base", "--is-ancestor", remote, head],
                                   cwd=root, capture_output=True).returncode == 0
                and changed <= CONTROL_SCOPE and dirty <= CONTROL_SCOPE
                and progress["repository"]["projection_mode"] == MODE)
        return [] if good else ["C30_V2_CLOSE_GIT_INVALID"]
    except (OSError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["C30_V2_CLOSE_GIT_INVALID"]
