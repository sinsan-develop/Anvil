"""Issue one exact5 R42 known-menu navigation writer after R39 closure."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import subprocess

try:
    from scripts import f20_u01_r39_close_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r39_close_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF, CHECKER = (
    prior.EVENTS, prior.PROGRESS, prior.HANDOFF, prior.CHECKER)
START, END = 2054, 2058
BASE = "97a917cc9cfb765e9adfd2546715a31a050ddab1"
MODE = "F20_U01_R42_KNOWN_MENU_NAVIGATION_START"
NEXT = "F20_U01_R42_KNOWN_MENU_NAVIGATION_IMPLEMENTATION"
ACTOR = "developer-primary-f20-u01-r42"
SUBJECT = "F-20/U01-R42"
PLAN = "docs/04_test_reports/F-20_U01_R42_KNOWN_MENU_NAVIGATION_PLAN.md"
WI = "docs/work_orders/F-20_U01_R42_KNOWN_MENU_NAVIGATION_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-20_U01_R42_KNOWN_MENU_NAVIGATION_INVOCATION.md"
REPORT = "docs/04_test_reports/F-20_U01_R42_KNOWN_MENU_NAVIGATION_RESULT.md"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-u01-r42-start.json"
MANIFEST = "docs/evidence/manifests/F-20_U01_R42_KNOWN_MENU_NAVIGATION_START_MANIFEST.json"
SCOPE = [
    "packages/api/fastapi_app.py",
    "apps/web/server.mjs",
    "tests/api/test_public_asgi_frontend.py",
    "apps/web/tests/ui-preview-runtime.test.mjs",
    REPORT,
]
KINDS = ("WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED",
         "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED")
FROZEN = (PLAN, WI, INVOCATION, prior.MANIFEST, prior.DIGEST)
CONTROL_SCOPE = (prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST, CHECKER,
    "docs/WORK_STATUS.md", "scripts/f20_u01_r42_start_overlay.py",
    "tests/tooling/test_f20_u01_r42_start_projection.py",
    "scripts/f20_u01_r42_close_overlay.py",
    "tests/tooling/test_f20_u01_r42_close_projection.py",
}) - set(FROZEN) - set(SCOPE)
CHECKER_ANCHOR = (
    b'def validate_bundle(bundle):\n'
    b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R39_ARTIFACT_HEALTH_GAP_CLOSE":\n'
)
CHECKER_ROUTE = (
    b'def validate_bundle(bundle):\n'
    b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R42_KNOWN_MENU_NAVIGATION_START":\n'
    b'        from datetime import datetime, timezone\n'
    b'        try:\n'
    b'            from scripts.f20_u01_r42_start_overlay import collect_git, validate_control\n'
    b'        except ModuleNotFoundError:\n'
    b'            from f20_u01_r42_start_overlay import collect_git, validate_control\n'
    b'        errors = validate_control(Path(bundle["_root"]), bundle, datetime.now(timezone.utc))\n'
    b'        if all(key in bundle for key in (\n'
    b'            "handoff", "failure_ledger", "nonsemantic", "dir_registry", "event_contract",\n'
    b'        )):\n'
    b'            errors.extend(_validate_f20_common_invariants(bundle))\n'
    b'        else:\n'
    b'            errors.append("F20_REWORK_BUNDLE_INCOMPLETE")\n'
    b'        errors.extend(collect_git(Path(bundle["_root"]), bundle["progress"]))\n'
    b'        return sorted(set(errors))\n'
    b'    if bundle.get("progress", {}).get("repository", {}).get("projection_mode") == "F20_U01_R39_ARTIFACT_HEALTH_GAP_CLOSE":\n'
)


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _frozen(root: Path, path: str) -> bytes:
    return _git(root, "show", f"{BASE}:{path}")


def _dirty(root: Path) -> set[str]:
    return prior.prior._dirty(root)


def _predecessor(root: Path) -> tuple[bytes, bytes, dict, dict]:
    raw = _frozen(root, EVENTS)
    progress_raw = _frozen(root, PROGRESS)
    stream, progress = json.loads(raw), json.loads(progress_raw)
    if (stream["last_sequence"] != START or len(stream["events"]) != START
            or progress["event_sequence"] != START
            or progress["repository"]["projection_mode"] != prior.MODE
            or progress["worker_lease"] is not None or progress["write_lease"] is not None
            or progress["f20_c30_event_integrity_incident"]["status"]
               != "RECOVERED_WITH_QUARANTINED_HISTORY"
            or progress["f20_c30_event_integrity_incident"]["blocking"] is not False
            or progress["c30_event_generation"]["authority_active"] is not True
            or progress["c30_event_generation"]["accepted"] is not False
            or progress["scope_revision_binding"]["release_decision"] != "DEFER"
            or "F-20" in progress["completed_packages"]):
        raise ValueError("R42_PREDECESSOR_STATE_INVALID")
    return raw, progress_raw, stream, progress


def _frozen_match(root: Path) -> bool:
    try:
        return all((root / path).read_bytes() == _frozen(root, path) for path in FROZEN)
    except (OSError, subprocess.CalledProcessError):
        return False


def _checker_successor(root: Path) -> bytes:
    old = _frozen(root, CHECKER)
    if old.count(CHECKER_ANCHOR) != 1:
        raise ValueError("R42_CHECKER_ANCHOR_INVALID")
    return old.replace(CHECKER_ANCHOR, CHECKER_ROUTE, 1)


def _rows(events: list[dict], wi_hash: str, invocation_hash: str,
          at: datetime, nonce: str) -> list[dict]:
    if at.tzinfo is None or not re.fullmatch(r"[a-z0-9]{4,32}", nonce):
        raise ValueError("R42_CLOCK_OR_NONCE_INVALID")
    stamp = at.isoformat(timespec="seconds")
    expiry = (at + timedelta(hours=24)).isoformat(timespec="seconds")
    execution = f"f20-u01-r42-execution-fence-epoch-57-{nonce}"
    write_token = f"f20-u01-r42-write-fence-epoch-57-{nonce}"
    worker = {
        "lease_id": f"worker-lease-f20-u01-r42-{nonce}",
        "actor_id": ACTOR, "subject_ref": SUBJECT, "status": "ACTIVE",
        "issued_at": stamp, "expires_at": expiry, "lease_epoch": 57,
        "fencing_token": execution, "execution_fencing_token": execution,
        "baseline_git_commit": BASE, "dispatch_head": BASE, "path_scope": SCOPE,
    }
    write = {**worker, "lease_id": f"write-lease-f20-u01-r42-{nonce}",
             "worker_lease_id": worker["lease_id"], "write_epoch": 57,
             "fencing_token": write_token, "write_fencing_token": write_token}
    details = (
        {"path": WI, "sha256": wi_hash, "invocation_path": INVOCATION,
         "invocation_sha256": invocation_hash,
         "classification": "MAIN_INTERNAL_APPROVED_SCOPE",
         "parent_work_instruction": prior.prior.REPORT,
         "revision_reason": "U01_R42_KNOWN_MENU_DIRECT_NAVIGATION"},
        worker, write,
        {"worker_lease_id": worker["lease_id"], "write_lease_id": write["lease_id"],
         "work_instruction_sha256": wi_hash, "invocation_sha256": invocation_hash,
         "package_status": "REWORK_IN_PROGRESS", "accepted": False},
    )
    rows = []
    for kind, detail in zip(KINDS, details):
        previous = rows[-1] if rows else events[-1]
        sequence = previous["sequence"] + 1
        rows.append({
            "sequence": sequence, "event_id": f"evt_f20_{sequence}_{kind.lower()}",
            "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
            "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
            "run_id": None, "step_id": MODE, "subject_ref": SUBJECT,
            "occurred_at": stamp,
            "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
            "previous_event_sha256": r1._sha(r1._canonical(previous)),
            "details": detail,
        })
    return rows


def _append(raw: bytes, stream: dict, rows: list[dict]) -> bytes:
    marker = b'\n  ],\n  "last_event_id": "' + stream["last_event_id"].encode() + b'"'
    sequence = f'"last_sequence": {START}'.encode()
    if (raw != r1._lf(raw) or len(rows) != len(KINDS)
            or raw.count(marker) != 1 or raw.count(sequence) != 1):
        raise ValueError("R42_EVENT_BYTES_INVALID")
    insertion = b",\n" + b",\n".join(r1._pretty(row).rstrip() for row in rows)
    replacement = b'\n  ],\n  "last_event_id": "' + rows[-1]["event_id"].encode() + b'"'
    return raw.replace(marker, insertion + replacement).replace(
        sequence, f'"last_sequence": {END}'.encode(), 1)


def project(root: Path, at: datetime, nonce: str) -> dict[str, bytes]:
    root = Path(root)
    raw, _, stream, old = _predecessor(root)
    if not _frozen_match(root):
        raise ValueError("R42_FROZEN_AUTHORITY_INVALID")
    wi_hash = r1._sha(r1._lf((root / WI).read_bytes()))
    invocation_hash = r1._sha(r1._lf((root / INVOCATION).read_bytes()))
    rows = _rows(stream["events"], wi_hash, invocation_hash, at, nonce)
    event_raw = _append(raw, stream, rows)
    worker, write = rows[1]["details"], rows[2]["details"]
    stamp = rows[0]["occurred_at"]
    updated = deepcopy(old)
    updated.update({
        "snapshot_id": "snapshot-f20-u01-r42-known-menu-start-seq2058",
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "updated_at": stamp, "status": "ACTIVE", "active_agent": ACTOR,
        "worker_lease": worker, "write_lease": write,
        "f20_overall_status": "REWORK_IN_PROGRESS",
        "next_safe_action": NEXT, "runtime_next_action": NEXT,
        "active_work_instruction": {
            "artifact_id": "WI-F-20-U01-R42-20261004-001", "path": WI,
            "sha256": wi_hash, "invocation_path": INVOCATION,
            "invocation_sha256": invocation_hash,
            "result_status": "REWORK_IN_PROGRESS",
            "package_status": "REWORK_IN_PROGRESS",
            "approval_classification": "MAIN_INTERNAL_APPROVED_SCOPE",
        },
        "current_progress_evidence_ref": {
            "package_id": "F-20", "path": DIGEST, "manifest_path": MANIFEST},
    })
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE,
        "validated_base_commit": BASE, "projection_mode": MODE,
        "worktree_status": "F20_U01_R42_KNOWN_MENU_NAVIGATION_ACTIVE",
        "product_write_scope": SCOPE, "commit_status": "PENDING", "push_status": "PENDING",
    })
    updated["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    snapshot = deepcopy(updated)
    snapshot.pop("snapshot_hash", None)
    updated["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(updated)
    summary = {
        "event_sequence": END, "last_event_id": rows[-1]["event_id"],
        "status": "ACTIVE", "current_work_package": "F-20",
        "active_agent": ACTOR, "worker_lease": worker, "write_lease": write,
        "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
        "incident_blocking": False, "next_safe_action": NEXT,
        "repository_head": BASE,
        "repository_upstream": "development/codex/f18-wsl-ops",
        "reporting_decision": updated["reporting_decision"]["decision"],
    }
    handoff_raw = (b"# F-20/U-01 R42 known menu start handoff\n\n"
                   b"\x60\x60\x60json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"\x60\x60\x60\n\n- Exact menu HTML navigation only; C30 quarantined "
                     b"history retained; F-20 unaccepted; Release DEFER; "
                     b"Production NOT_EXECUTED.\n")
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
        "product_write_scope": SCOPE, "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(raw), "plan_path": PLAN,
        "plan_sha256": r1._sha(r1._lf((root / PLAN).read_bytes())),
        "work_instruction_sha256": wi_hash, "invocation_sha256": invocation_hash,
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
        nonce = rows[START + 1]["details"]["lease_id"].removeprefix(
            "worker-lease-f20-u01-r42-")
        expected = project(root, at, nonce)
        if set(outputs) != set(expected):
            return ["R42_OUTPUT_SET_INVALID"]
        return [f"R42_{path.split('/')[-1].upper()}_INVALID"
                for path, content in expected.items() if outputs[path] != content]
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["R42_STATE_INVALID"]


def materialize(root: Path, at: datetime, nonce: str) -> None:
    root = Path(root)
    raw, progress_raw, _, old = _predecessor(root)
    frozen = (EVENTS, PROGRESS, HANDOFF, CHECKER, prior.MANIFEST, prior.DIGEST)
    if (_git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or _git(root, "branch", "--show-current").decode().strip()
               != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or (root / EVENTS).read_bytes() != raw
            or (root / PROGRESS).read_bytes() != progress_raw
            or any((root / path).read_bytes() != _frozen(root, path) for path in frozen)
            or any((root / path).exists() for path in (DIGEST, MANIFEST))
            or not _frozen_match(root)
            or not _dirty(root) <= CONTROL_SCOPE
            or prior.validate_control(root, {
                "_root": root, "events": json.loads(raw), "progress": old,
                "detached_digest": json.loads((root / prior.DIGEST).read_bytes()),
            }, at)):
        raise RuntimeError("R42_PREDECESSOR_INVALID")
    outputs = project(root, at, nonce)
    if validate_outputs(root, outputs):
        raise RuntimeError("R42_PROJECTION_INVALID")
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
        expiry = datetime.fromisoformat(rows[START + 1]["details"]["expires_at"])
        if (now.tzinfo is None or not at <= now < expiry
                or expiry - at != timedelta(hours=24)
                or [row["event_type"] for row in rows[START:]] != list(KINDS)
                or rows[START + 1]["details"]["execution_fencing_token"]
                   in r1._historical_fencing_tokens(rows[:START])
                or rows[START + 2]["details"]["write_fencing_token"]
                   in r1._historical_fencing_tokens(rows[:START])):
            errors.append("R42_LEASE_OR_TRANSITION_INVALID")
        if (root / CHECKER).read_bytes() != _checker_successor(root):
            errors.append("R42_CHECKER_INVALID")
        if (bundle["events"] != json.loads(outputs[EVENTS])
                or bundle["progress"] != json.loads(outputs[PROGRESS])
                or bundle.get("detached_digest", json.loads(outputs[DIGEST]))
                   != json.loads(outputs[DIGEST])):
            errors.append("R42_BUNDLE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["R42_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        good = (_git(root, "branch", "--show-current").decode().strip() == "codex/f18-wsl-ops"
                and _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
                    == "development/codex/f18-wsl-ops"
                and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, head],
                                   cwd=root, capture_output=True).returncode == 0
                and subprocess.run(["git", "merge-base", "--is-ancestor", BASE, remote],
                                   cwd=root, capture_output=True).returncode == 0
                and subprocess.run(["git", "merge-base", "--is-ancestor", remote, head],
                                   cwd=root, capture_output=True).returncode == 0
                and changed <= CONTROL_SCOPE | set(SCOPE)
                and _dirty(root) <= CONTROL_SCOPE | set(SCOPE)
                and progress["repository"]["projection_mode"] == MODE)
        return [] if good else ["R42_GIT_INVALID"]
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["R42_GIT_INVALID"]
