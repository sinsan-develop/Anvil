"""Close the R43 exact-five writer after same-SHA local and WSL QA."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

try:
    from scripts import f20_u01_r43_start_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r43_start_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF, CHECKER = prior.EVENTS, prior.PROGRESS, prior.HANDOFF, prior.CHECKER
START, END = 2064, 2066
BASE = "8c22fab17b7e31090b5c78fc62209d3356b116dc"
QA_HEAD = "911d4af0b431472eeb904641303797328f4c68fa"
MODE = "F20_U01_R43_NEXT_ACTION_DETAIL_CLOSE"
NEXT = "F20_U01_REMAINING_APPROVED_SCOPE_REVIEW"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r43-close.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R43_NEXT_ACTION_DETAIL_CLOSE_MANIFEST.json"
KINDS = ("WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED")
AUTHORITY_FILES = tuple(dict.fromkeys((
    *prior.FROZEN, *prior.SCOPE, prior.DIGEST, prior.MANIFEST,
    "scripts/f20_u01_r43_start_overlay.py",
)))
CONTROL_SCOPE = prior.CONTROL_SCOPE | {DIGEST, MANIFEST}
CHECKER_ANCHOR = (
    b'def validate_bundle(bundle):\n'
    b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R43_NEXT_ACTION_DETAIL_START":\n'
)
CHECKER_ROUTE = (
    b'def validate_bundle(bundle):\n'
    b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R43_NEXT_ACTION_DETAIL_CLOSE":\n'
    b'        from datetime import datetime, timezone\n'
    b'        try:\n'
    b'            from scripts.f20_u01_r43_close_overlay import collect_git, validate_control\n'
    b'        except ModuleNotFoundError:\n'
    b'            from f20_u01_r43_close_overlay import collect_git, validate_control\n'
    b'        errors = validate_control(Path(bundle["_root"]), bundle, datetime.now(timezone.utc))\n'
    b'        if all(key in bundle for key in (\n'
    b'            "handoff", "failure_ledger", "nonsemantic", "dir_registry", "event_contract",\n'
    b'        )):\n'
    b'            errors.extend(_validate_f20_common_invariants(bundle))\n'
    b'        else:\n'
    b'            errors.append("F20_REWORK_BUNDLE_INCOMPLETE")\n'
    b'        errors.extend(collect_git(Path(bundle["_root"]), bundle["progress"]))\n'
    b'        return sorted(set(errors))\n'
    b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R43_NEXT_ACTION_DETAIL_START":\n'
)


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _frozen(root: Path, path: str) -> bytes:
    return _git(root, "show", f"{BASE}:{path}")


def _authority_match(root: Path) -> bool:
    try:
        return all((root / path).read_bytes() == _frozen(root, path)
                   for path in AUTHORITY_FILES)
    except (OSError, subprocess.CalledProcessError):
        return False


def _checker_successor(root: Path) -> bytes:
    old = _frozen(root, CHECKER)
    if old.count(CHECKER_ANCHOR) != 1:
        raise ValueError("R43_CLOSE_CHECKER_ANCHOR_INVALID")
    return old.replace(CHECKER_ANCHOR, CHECKER_ROUTE, 1)


def _predecessor(root: Path) -> tuple[bytes, dict, dict]:
    raw = _frozen(root, EVENTS)
    stream, progress = json.loads(raw), json.loads(_frozen(root, PROGRESS))
    worker, write = progress.get("worker_lease"), progress.get("write_lease")
    if (stream["last_sequence"] != START or len(stream["events"]) != START
            or progress["event_sequence"] != START
            or progress["repository"]["projection_mode"] != prior.MODE
            or not isinstance(worker, dict) or not isinstance(write, dict)
            or worker.get("status") != "ACTIVE" or write.get("status") != "ACTIVE"
            or worker.get("lease_epoch") != 58 or write.get("write_epoch") != 58
            or worker.get("path_scope") != prior.SCOPE
            or write.get("path_scope") != prior.SCOPE
            or write.get("worker_lease_id") != worker.get("lease_id")
            or write.get("execution_fencing_token") != worker.get("execution_fencing_token")
            or progress["f20_c30_event_integrity_incident"]["status"]
               != "RECOVERED_WITH_QUARANTINED_HISTORY"
            or progress["f20_c30_event_integrity_incident"]["blocking"] is not False
            or progress["c30_event_generation"]["accepted"] is not False
            or progress["scope_revision_binding"]["release_decision"] != "DEFER"
            or "F-20" in progress["completed_packages"]):
        raise ValueError("R43_CLOSE_BASE_INVALID")
    return raw, stream, progress


def _rows(events: list[dict], progress: dict, at: datetime) -> list[dict]:
    if at.tzinfo is None:
        raise ValueError("R43_CLOSE_CLOCK_INVALID")
    worker, write = progress["worker_lease"], progress["write_lease"]
    details = (
        {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
         "reason": "R43_EXACT_DETAIL_EXACT_SHA_WSL_GREEN_TEMP_ZERO", "evidence_head": QA_HEAD},
        {"lease_id": worker["lease_id"],
         "execution_fencing_token": worker["execution_fencing_token"],
         "reason": "R43_EXACT_DETAIL_EXACT_SHA_WSL_GREEN_TEMP_ZERO", "evidence_head": QA_HEAD},
    )
    rows = []
    for kind, detail in zip(KINDS, details):
        previous = rows[-1] if rows else events[-1]
        sequence = previous["sequence"] + 1
        rows.append({
            "sequence": sequence, "event_id": f"evt_f20_{sequence}_{kind.lower()}",
            "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
            "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
            "run_id": None, "step_id": MODE, "subject_ref": prior.SUBJECT,
            "occurred_at": at.isoformat(timespec="seconds"),
            "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
            "previous_event_sha256": r1._sha(r1._canonical(previous)), "details": detail,
        })
    return rows


def _append(raw: bytes, stream: dict, rows: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "' + stream["last_event_id"].encode() + b'"'
    sequence = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or len(rows) != len(KINDS)
            or raw.count(marker) != 1 or raw.count(sequence) != 1):
        raise ValueError("R43_CLOSE_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in rows)
    replacement = b'\n  ],\n  "last_event_id": "' + rows[-1]["event_id"].encode() + b'"'
    return raw.replace(marker, insertion + replacement).replace(
        sequence, f'"last_sequence": {END}'.encode(), 1)


def project(root: Path, at: datetime) -> dict[str, bytes]:
    root = Path(root)
    raw, stream, old = _predecessor(root)
    if not _authority_match(root):
        raise ValueError("R43_CLOSE_AUTHORITY_INVALID")
    worker, write = old["worker_lease"], old["write_lease"]
    if (at < datetime.fromisoformat(worker["issued_at"])
            or at >= datetime.fromisoformat(worker["expires_at"])):
        raise ValueError("R43_CLOSE_LEASE_EXPIRED")
    rows = _rows(stream["events"], old, at)
    event_raw = _append(raw, stream, rows)
    stamp = rows[0]["occurred_at"]
    updated = deepcopy(old)
    updated.update({
        "snapshot_id": "snapshot-f20-u01-r43-next-action-detail-close-seq2066",
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "updated_at": stamp, "status": "ACTIVE", "active_agent": "main-agent-eoul",
        "worker_lease": None, "write_lease": None,
        "completed_f20_u01_r43_worker_lease": {**worker, "status": "REVOKED", "revoked_at": stamp},
        "completed_f20_u01_r43_write_lease": {**write, "status": "REVOKED", "revoked_at": stamp},
        "f20_overall_status": "REWORK_IN_PROGRESS",
        "next_safe_action": NEXT, "runtime_next_action": NEXT,
        "current_progress_evidence_ref": {
            "package_id": "F-20", "path": DIGEST, "manifest_path": MANIFEST},
    })
    updated["active_work_instruction"] = {
        **updated["active_work_instruction"],
        "result_status": "COMPLETED_R43_NEXT_ACTION_DETAIL_WSL_QA_ONLY",
        "package_status": "REWORK_IN_PROGRESS",
    }
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE, "local_wsl_qa_head": QA_HEAD,
        "validated_base_commit": BASE, "projection_mode": MODE,
        "worktree_status": "F20_U01_R43_NEXT_ACTION_DETAIL_LEASE_CLOSED",
        "product_write_scope": [], "commit_status": "PENDING", "push_status": "PENDING",
    })
    updated["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(updated)
    snapshot.pop("snapshot_hash", None)
    updated["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(updated)
    summary = {
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "status": "ACTIVE", "current_work_package": "F-20",
        "active_agent": "main-agent-eoul", "worker_lease": None, "write_lease": None,
        "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": False, "next_safe_action": NEXT,
        "repository_head": BASE,
        "repository_upstream": "development/codex/f18-wsl-ops",
        "reporting_decision": updated["reporting_decision"]["decision"],
    }
    handoff_raw = (b"# F-20/U-01 R43 next action detail close handoff\n\n"
                   b"\x60\x60\x60json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"\x60\x60\x60\n\n- R43 same-SHA WSL QA " + QA_HEAD.encode()
                   + b" passed, temp residue zero; first transient response read failure retained; "
                     b"C30 quarantined history retained; F-20/U-01 unaccepted; "
                     b"Release DEFER; Production NOT_EXECUTED.\n")
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
        "predecessor_events_sha256": r1._sha(raw), "plan_path": prior.PLAN,
        "plan_sha256": r1._sha(r1._lf((root / prior.PLAN).read_bytes())),
        "work_instruction_sha256": r1._sha(r1._lf((root / prior.WI).read_bytes())),
        "result_path": prior.REPORT,
        "result_sha256": r1._sha(r1._lf((root / prior.REPORT).read_bytes())),
        "qa_head": QA_HEAD,
        "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": False, "release_decision": "DEFER",
        "production": "NOT_EXECUTED", "self_reference": False,
    })
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw,
            CHECKER: _checker_successor(root)}


def validate_outputs(root: Path, outputs: dict[str, bytes]) -> list[str]:
    try:
        rows = json.loads(outputs[EVENTS])["events"]
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        expected = project(root, at)
        if set(outputs) != set(expected):
            return ["R43_CLOSE_OUTPUT_SET_INVALID"]
        return [f"R43_CLOSE_{path.split('/')[-1].upper()}_INVALID"
                for path, content in expected.items() if outputs[path] != content]
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["R43_CLOSE_STATE_INVALID"]


def materialize(root: Path, at: datetime) -> None:
    root = Path(root)
    raw, _, old = _predecessor(root)
    actual_now = datetime.now(timezone.utc)
    leases = (old["worker_lease"], old["write_lease"])
    if (at.tzinfo is None or abs((actual_now - at).total_seconds()) > 60
            or any(not (datetime.fromisoformat(lease["issued_at"]) <= actual_now
                            < datetime.fromisoformat(lease["expires_at"]))
                   for lease in leases)):
        raise RuntimeError("R43_CLOSE_CLOCK_OR_LEASE_INVALID")
    frozen = (EVENTS, PROGRESS, HANDOFF, CHECKER, prior.DIGEST, prior.MANIFEST)
    if (_git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or _git(root, "branch", "--show-current").decode().strip()
               != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or (root / EVENTS).read_bytes() != raw
            or (root / PROGRESS).read_bytes() != _frozen(root, PROGRESS)
            or any((root / path).read_bytes() != _frozen(root, path) for path in frozen)
            or any((root / path).exists() for path in (DIGEST, MANIFEST))
            or not _authority_match(root)
            or subprocess.run(["git", "merge-base", "--is-ancestor", QA_HEAD, BASE],
                              cwd=root, capture_output=True).returncode != 0
            or not prior._dirty(root) <= CONTROL_SCOPE
            or prior.validate_control(root, {
                "_root": root, "events": json.loads(raw), "progress": old,
                "detached_digest": json.loads((root / prior.DIGEST).read_bytes()),
            }, at)):
        raise RuntimeError("R43_CLOSE_PREDECESSOR_INVALID")
    outputs = project(root, at)
    if validate_outputs(root, outputs):
        raise RuntimeError("R43_CLOSE_PROJECTION_INVALID")
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        outputs = {path: (root / path).read_bytes()
                   for path in (EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST, CHECKER)}
        errors = validate_outputs(root, outputs)
        rows = json.loads(outputs[EVENTS])["events"]
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        if (now.tzinfo is None or at > now
                or [row["event_type"] for row in rows[START:]] != list(KINDS)
                or bundle["events"] != json.loads(outputs[EVENTS])
                or bundle["progress"] != json.loads(outputs[PROGRESS])
                or bundle.get("detached_digest", json.loads(outputs[DIGEST]))
                   != json.loads(outputs[DIGEST])):
            errors.append("R43_CLOSE_TRANSITION_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["R43_CLOSE_CONTROL_MISSING"]


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
                and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head],
                                   cwd=root, capture_output=True).returncode == 0
                and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, remote],
                                   cwd=root, capture_output=True).returncode == 0
                and subprocess.run(["git", "merge-base", "--is-ancestor", remote, head],
                                   cwd=root, capture_output=True).returncode == 0
                and changed <= CONTROL_SCOPE and prior._dirty(root) <= CONTROL_SCOPE
                and progress["repository"]["projection_mode"] == MODE)
        return [] if good else ["R43_CLOSE_GIT_INVALID"]
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["R43_CLOSE_GIT_INVALID"]
