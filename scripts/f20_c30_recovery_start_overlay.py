"""Issue a fenced C30 recovery verifier writer without trusting the tainted ledger."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r38b_close_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r38b_close_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 2040, 2044
BASE = "f1e992d85c08fabbec69db271dbf70bed7dc0fce"
MODE = "F20_C30_RECOVERY_V2_VERIFIER_START"
ACTOR = "developer-primary-f20-c30-recovery-v2"
SUBJECT = "F-20/C30-RECOVERY-V2"
WI = "docs/work_orders/F-20_C30_EVENT_RECOVERY_V2_WORK_INSTRUCTION.md"
DESIGN = "docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_DESIGN.md"
PLAN = "docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_PLAN.md"
APPROVAL = "docs/approvals/APPROVAL-20261004-C30-NONDESTRUCTIVE-LEDGER-RECOVERY-001.md"
REPORT = "docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_DEVELOPER_RESULT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-c30-recovery-v2-start.json"
MANIFEST = "docs/evidence/manifests/F-20_C30_RECOVERY_V2_VERIFIER_START_MANIFEST.json"
SCOPE = ["scripts/f20_c30_recovery_v2.py",
         "tests/tooling/test_f20_c30_recovery_v2.py", REPORT]
KINDS = ("WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED",
         "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED")
CONTROL_SCOPE = prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST, WI, DESIGN, PLAN, APPROVAL,
    "docs/WORK_STATUS.md", "scripts/check_project_progress.py",
    "scripts/f20_c30_recovery_start_overlay.py",
    "tests/tooling/test_f20_c30_recovery_start_projection.py",
    *SCOPE,
}
FROZEN = (WI, DESIGN, PLAN, APPROVAL)


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _base(root: Path) -> tuple[bytes, dict, dict]:
    raw = _git(root, "show", f"{BASE}:{EVENTS}")
    return raw, json.loads(raw), json.loads(_git(root, "show", f"{BASE}:{PROGRESS}"))


def _frozen(root: Path) -> bool:
    try:
        return all((root / path).read_bytes() == _git(root, "show", f"{BASE}:{path}")
                   for path in FROZEN)
    except (OSError, subprocess.CalledProcessError):
        return False


def _append(raw: bytes, old: dict, rows: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "' + old["last_event_id"].encode() + b'"'
    seq = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or raw.count(marker) != 1 or raw.count(seq) != 1
            or len(rows) != END - START):
        raise ValueError("C30_RECOVERY_START_RAW_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in rows)
    new_end = b'\n  ],\n  "last_event_id": "' + rows[-1]["event_id"].encode() + b'"'
    return raw.replace(marker, insertion + new_end).replace(
        seq, f'"last_sequence": {END}'.encode(), 1)


def _rows(events: list[dict], at: datetime, nonce: str, wi_hash: str,
          approval_hash: str) -> list[dict]:
    stamp = at.isoformat(timespec="seconds")
    expiry = (at + timedelta(hours=24)).isoformat(timespec="seconds")
    execution = f"f20-c30v2-execution-fence-epoch-55-{nonce}"
    write_token = f"f20-c30v2-write-fence-epoch-55-{nonce}"
    worker = {"lease_id": f"worker-lease-f20-c30v2-{nonce}",
              "actor_id": ACTOR, "subject_ref": SUBJECT, "status": "ACTIVE",
              "issued_at": stamp, "expires_at": expiry, "lease_epoch": 55,
              "fencing_token": execution, "execution_fencing_token": execution,
              "baseline_git_commit": BASE, "dispatch_head": BASE,
              "path_scope": SCOPE}
    write = {**worker, "lease_id": f"write-lease-f20-c30v2-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 55,
             "fencing_token": write_token, "write_fencing_token": write_token}
    details = (
        {"path": WI, "sha256": wi_hash, "classification": "C30_RECOVERY_APPROVED_DIRECTION",
         "approval_path": APPROVAL, "approval_sha256": approval_hash,
         "product_write_scope": SCOPE},
        worker, write,
        {"resume_event_ref": events[-1]["event_id"],
         "worker_lease_id": worker["lease_id"],
         "write_lease_id": write["lease_id"],
         "work_instruction_sha256": wi_hash,
         "package_status": "REWORK_IN_PROGRESS", "accepted": False},
    )
    rows = []
    for kind, detail in zip(KINDS, details):
        predecessor = rows[-1] if rows else events[-1]
        number = predecessor["sequence"] + 1
        rows.append({"sequence": number,
                     "event_id": f"evt_f20_{number}_{kind.lower()}",
                     "event_type": kind, "actor": "main-agent-eoul",
                     "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                     "project_id": "anvil", "work_package_id": "F-20",
                     "run_id": None, "step_id": MODE, "subject_ref": SUBJECT,
                     "occurred_at": stamp,
                     "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                     "previous_event_sha256": r1._sha(r1._canonical(predecessor)),
                     "details": detail})
    return rows


def _build(root: Path, at: datetime, nonce: str) -> dict[str, bytes]:
    raw, stream, old = _base(root)
    if (at.tzinfo is None or stream["last_sequence"] != START
            or len(stream["events"]) != START or old["event_sequence"] != START
            or old["worker_lease"] is not None or old["write_lease"] is not None
            or old["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
            or old["scope_revision_binding"]["release_decision"] != "DEFER"
            or not re.fullmatch(r"[a-z0-9]{4,32}", nonce) or not _frozen(root)):
        raise ValueError("C30_RECOVERY_START_BASE_INVALID")
    wi_hash, approval_hash = (r1._sha((root / p).read_bytes()) for p in (WI, APPROVAL))
    rows = _rows(stream["events"], at, nonce, wi_hash, approval_hash)
    event_raw = _append(raw, stream, rows)
    worker, write = rows[1]["details"], rows[2]["details"]
    updated = deepcopy(old)
    updated.update({
        "snapshot_id": "snapshot-f20-c30-recovery-v2-verifier-start-seq2044",
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "updated_at": rows[0]["occurred_at"], "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "f20_overall_status": "REWORK_IN_PROGRESS",
        "next_safe_action": "C30_V2_VERIFIER_EXACT_SCOPE_IMPLEMENTATION",
        "runtime_next_action": "C30_V2_VERIFIER_EXACT_SCOPE_IMPLEMENTATION",
        "active_work_instruction": {
            "artifact_id": "WI-F-20-C30-RECOVERY-V2-20261004-001",
            "path": WI, "sha256": wi_hash,
            "result_status": "REWORK_IN_PROGRESS",
            "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "C30_RECOVERY_APPROVED_DIRECTION",
            "parent_approval_id": "APPROVAL-20261004-C30-NONDESTRUCTIVE-LEDGER-RECOVERY-001"},
        "c30_recovery_approval_binding": {"path": APPROVAL,
                                           "sha256": approval_hash,
                                           "scope": "NONDESTRUCTIVE_LEDGER_RECOVERY_ONLY"},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE, "validated_base_commit": BASE,
        "projection_mode": MODE,
        "worktree_status": "F20_C30_RECOVERY_V2_VERIFIER_ACTIVE",
        "product_write_scope": SCOPE, "commit_status": "PENDING",
        "push_status": "PENDING"})
    updated["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(updated)
    snapshot.pop("snapshot_hash", None)
    updated["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(updated)
    summary = {"event_sequence": END, "last_event_id": rows[-1]["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": ACTOR, "worker_lease": worker, "write_lease": write,
               "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
               "incident_blocking": True,
               "next_safe_action": "C30_V2_VERIFIER_EXACT_SCOPE_IMPLEMENTATION",
               "repository_head": BASE,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": updated["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20 C30 recovery v2 verifier start handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- Exact3 verifier write lease only; C30 OPEN_BLOCKING; "
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
        "product_write_scope": SCOPE, "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(raw),
        "approval_path": APPROVAL, "approval_sha256": approval_hash,
        "work_instruction_path": WI, "work_instruction_sha256": wi_hash,
        "design_path": DESIGN, "design_sha256": r1._sha((root / DESIGN).read_bytes()),
        "plan_path": PLAN, "plan_sha256": r1._sha((root / PLAN).read_bytes()),
        "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": True, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw}


def project(root: Path, at: datetime, nonce: str) -> dict[str, bytes]:
    return _build(Path(root), at, nonce)


def validate_outputs(root: Path, outputs: dict[str, bytes], now: datetime) -> list[str]:
    try:
        stream = json.loads(outputs[EVENTS])
        rows = stream["events"]
        worker = rows[START + 1]["details"]
        nonce = worker["lease_id"].removeprefix("worker-lease-f20-c30v2-")
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        expected = _build(Path(root), at, nonce)
        if (now.tzinfo is None or at > now or now >= datetime.fromisoformat(worker["expires_at"])
                or set(outputs) != set(expected)):
            return ["C30_RECOVERY_START_STATE_INVALID"]
        return [f"C30_RECOVERY_START_{path.split('/')[-1].upper()}_INVALID"
                for path, raw in expected.items() if outputs[path] != raw]
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["C30_RECOVERY_START_STATE_INVALID"]


def materialize(root: Path, at: datetime, nonce: str) -> None:
    root = Path(root)
    if (_git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or (root / EVENTS).read_bytes() != _base(root)[0]
            or (root / PROGRESS).read_bytes() != _git(root, "show", f"{BASE}:{PROGRESS}")
            or not _frozen(root)):
        raise RuntimeError("C30_RECOVERY_START_PREDECESSOR_INVALID")
    outputs = _build(root, at, nonce)
    if validate_outputs(root, outputs, at):
        raise RuntimeError("C30_RECOVERY_START_PROJECTION_INVALID")
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        outputs = {path: (root / path).read_bytes()
                   for path in (EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST)}
        errors = validate_outputs(root, outputs, now)
        if bundle["events"] != json.loads(outputs[EVENTS]) or bundle["progress"] != json.loads(outputs[PROGRESS]):
            errors.append("C30_RECOVERY_START_BUNDLE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError):
        return ["C30_RECOVERY_START_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        dirty = prior.prior._dirty(root)
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
        return [] if good else ["C30_RECOVERY_START_GIT_INVALID"]
    except (OSError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["C30_RECOVERY_START_GIT_INVALID"]
