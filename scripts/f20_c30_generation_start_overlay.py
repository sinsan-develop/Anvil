"""Start an independently pinned, non-authoritative C30 Event generation."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import subprocess

try:
    from scripts import f20_c30_recovery_close_overlay as prior
    from scripts.f20_c30_recovery_v2 import (
        ANCHOR_BLOB, ANCHOR_COMMIT, ANCHOR_SHA256, CUTOVER_BLOB,
        CUTOVER_COMMIT, CUTOVER_SHA256, INCIDENT_COMMIT, verify_repository,
    )
except ModuleNotFoundError:
    import f20_c30_recovery_close_overlay as prior
    from f20_c30_recovery_v2 import (
        ANCHOR_BLOB, ANCHOR_COMMIT, ANCHOR_SHA256, CUTOVER_BLOB,
        CUTOVER_COMMIT, CUTOVER_SHA256, INCIDENT_COMMIT, verify_repository,
    )


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF = prior.EVENTS, prior.PROGRESS, prior.HANDOFF
START, END = 2046, 2047
BASE = "2bc1a4a2b011609dd9cd0da5bf94dce280e1dbe2"
MODE = "F20_C30_RECOVERY_V2_GENERATION_START"
NEXT = "C30_V2_GENERATION_INDEPENDENT_READ_ONLY_REVIEW"
MANIFEST = "docs/evidence/manifests/F-20_C30_RECOVERY_V2_GENERATION_START_MANIFEST.json"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-c30-recovery-v2-generation-start.json"
CONTRACT = "docs/progress/progress-event-contract.json"
CONTROL_SCOPE = prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, MANIFEST, DIGEST, CONTRACT,
    "docs/WORK_STATUS.md", "scripts/check_project_progress.py",
    "scripts/f20_c30_generation_start_overlay.py",
    "tests/tooling/test_f20_c30_generation_start_projection.py",
}


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _frozen(root: Path, path: str) -> bytes:
    return _git(root, "show", f"{BASE}:{path}")


def _preflight(root: Path) -> dict:
    """The existing verifier is frozen at seq2044, never run on a later projection."""
    evidence = verify_repository(
        root, file_reader=lambda path: _git(root, "show", f"{prior.BASE}:{path}"))
    if not evidence.eligible or evidence.errors:
        raise ValueError("C30_GENERATION_PINNED_PREFLIGHT_INVALID")
    # The seq2046 close is a deterministic, independently reviewable successor.
    outputs = {path: _frozen(root, path)
               for path in (EVENTS, PROGRESS, HANDOFF, prior.DIGEST, prior.MANIFEST)}
    if prior.validate_outputs(root, outputs):
        raise ValueError("C30_GENERATION_PREDECESSOR_CLOSE_INVALID")
    return evidence.evidence


def _event_prefix(raw: bytes) -> bytes:
    start_marker = b'"events": ['
    end_marker = b'\n  ],\n  "last_event_id": '
    if raw.count(start_marker) != 1 or raw.count(end_marker) != 1:
        raise ValueError("C30_GENERATION_EVENT_BYTES_INVALID")
    start = raw.index(start_marker) + len(start_marker)
    end = raw.index(end_marker)
    return raw[start:end].rstrip(b" \r\n\t")


def _contract(root: Path) -> bytes:
    raw = _frozen(root, CONTRACT)
    value = json.loads(raw)
    event = "EVENT_LEDGER_GENERATION_STARTED"
    if event in value["event_types"] or event in value["payload_contracts"]:
        raise ValueError("C30_GENERATION_CONTRACT_ALREADY_EXTENDED")
    value["event_types"].append(event)
    value["payload_contracts"][event] = {
        "required_details": [
            "generation", "anchor_commit", "anchor_blob", "anchor_sha256",
            "cutover_commit", "cutover_blob", "cutover_sha256",
            "predecessor_commit", "predecessor_events_sha256",
            "predecessor_event_prefix_sha256", "quarantined_event_sequences",
            "audit_only_event_sequences", "preflight_manifest_path",
            "preflight_manifest_sha256", "accepted", "authority_active",
        ],
        "effect": "begin_quarantined_generation_pending_independent_verification",
    }
    return r1._pretty(value)


def _build(root: Path, at: datetime) -> dict[str, bytes]:
    raw, old_raw = _frozen(root, EVENTS), _frozen(root, PROGRESS)
    stream, old = json.loads(raw), json.loads(old_raw)
    if (at.tzinfo is None or stream["last_sequence"] != START
            or len(stream["events"]) != START or old["event_sequence"] != START
            or old["worker_lease"] is not None or old["write_lease"] is not None
            or old["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
            or old["scope_revision_binding"]["release_decision"] != "DEFER"
            or "F-20" in old["completed_packages"]
            or old["repository"]["projection_mode"] != prior.MODE):
        raise ValueError("C30_GENERATION_BASE_INVALID")
    preflight = _preflight(root)
    prefix_sha = r1._sha(_event_prefix(raw))
    pinned_manifest = r1._sha(_frozen(root, prior.MANIFEST))
    manifest = {
        "schema_version": "1.0.0", "package_id": "F-20", "generation": 2,
        "accepted": False, "authority_active": False, "incident_blocking": True,
        "predecessor_commit": BASE, "predecessor_event_sequence": START,
        "predecessor_events_sha256": r1._sha(raw),
        "predecessor_event_prefix_sha256": prefix_sha,
        "anchor_commit": ANCHOR_COMMIT, "anchor_blob": ANCHOR_BLOB,
        "anchor_sha256": ANCHOR_SHA256, "cutover_commit": CUTOVER_COMMIT,
        "cutover_blob": CUTOVER_BLOB, "cutover_sha256": CUTOVER_SHA256,
        "incident_commit": INCIDENT_COMMIT,
        "semantic_changed_sequences": preflight["changed_sequences"],
        "incident_added_sequences": preflight["added_sequences"],
        "false_acceptance_sequences": preflight["false_acceptance_sequences"],
        "quarantined_event_sequences": [1689, 1714],
        "audit_only_event_sequences": [1715, START],
        "verified_followup_events_through_cutover": preflight["validated_followup_events"],
        "verified_historical_lease_pairs": preflight["validated_lease_pairs"],
        "preflight_manifest_path": prior.MANIFEST,
        "preflight_manifest_sha256": pinned_manifest,
        "preflight_source_commit": prior.BASE,
        "release_decision": "DEFER", "production": "NOT_EXECUTED",
        "self_reference": False,
    }
    manifest_raw = r1._pretty(manifest)
    detail = {
        "generation": 2, "anchor_commit": ANCHOR_COMMIT,
        "anchor_blob": ANCHOR_BLOB, "anchor_sha256": ANCHOR_SHA256,
        "cutover_commit": CUTOVER_COMMIT, "cutover_blob": CUTOVER_BLOB,
        "cutover_sha256": CUTOVER_SHA256, "predecessor_commit": BASE,
        "predecessor_events_sha256": r1._sha(raw),
        "predecessor_event_prefix_sha256": prefix_sha,
        "quarantined_event_sequences": [1689, 1714],
        "audit_only_event_sequences": [1715, START],
        "preflight_manifest_path": MANIFEST,
        "preflight_manifest_sha256": r1._sha(manifest_raw),
        "accepted": False, "authority_active": False,
    }
    predecessor = stream["events"][-1]
    stamp = at.isoformat(timespec="seconds")
    row = {"sequence": END, "event_id": "evt_f20_2047_event_ledger_generation_started",
           "event_type": "EVENT_LEDGER_GENERATION_STARTED",
           "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
           "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
           "run_id": None, "step_id": MODE, "subject_ref": "F-20/C30-RECOVERY-V2",
           "occurred_at": stamp,
           "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
           "previous_event_sha256": r1._sha(r1._canonical(predecessor)),
           "details": detail}
    marker = b'\n  ],\n  "last_event_id": "' + stream["last_event_id"].encode() + b'"'
    seq = f'"last_sequence": {START}'.encode()
    if raw != r1._lf(raw) or raw.count(marker) != 1 or raw.count(seq) != 1:
        raise ValueError("C30_GENERATION_RAW_INVALID")
    event_raw = raw.replace(marker, b",\n" + r1._pretty(row).rstrip()
                            + b'\n  ],\n  "last_event_id": "' + row["event_id"].encode() + b'"')
    event_raw = event_raw.replace(seq, f'"last_sequence": {END}'.encode(), 1)
    if _event_prefix(event_raw)[:len(_event_prefix(raw))] != _event_prefix(raw):
        raise ValueError("C30_GENERATION_PREFIX_CHANGED")
    contract_raw = _contract(root)
    updated = deepcopy(old)
    updated.update({
        "snapshot_id": "snapshot-f20-c30-recovery-v2-generation-start-seq2047",
        "event_sequence": END, "last_event_id": row["event_id"],
        "updated_at": stamp, "active_agent": "main-agent-eoul",
        "next_safe_action": NEXT, "runtime_next_action": NEXT,
        "c30_event_generation": {
            "generation": 2, "status": "PENDING_INDEPENDENT_VERIFICATION",
            "started_event_id": row["event_id"], "manifest_path": MANIFEST,
            "manifest_sha256": r1._sha(manifest_raw),
            "authority_active": False, "accepted": False},
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE, "validated_base_commit": BASE,
        "projection_mode": MODE,
        "worktree_status": "F20_C30_GENERATION_2_PENDING_INDEPENDENT_REVIEW",
        "product_write_scope": [], "commit_status": "PENDING", "push_status": "PENDING"})
    updated["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    updated["registry_refs"]["progress_event_contract"]["sha256"] = r1._sha(contract_raw)
    snapshot = deepcopy(updated)
    snapshot.pop("snapshot_hash", None)
    updated["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(updated)
    summary = {"event_sequence": END, "last_event_id": row["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": "main-agent-eoul", "worker_lease": None,
               "write_lease": None,
               "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
               "incident_blocking": True, "next_safe_action": NEXT,
               "repository_head": BASE,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": updated["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20 C30 recovery v2 generation start handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- Generation 2 pending independent review; C30 OPEN_BLOCKING; "
                     b"F-20 unaccepted; Release DEFER; Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": END,
        "self_reference": False,
        "progress": {"path": PROGRESS, "bytes": len(progress_raw),
                     "file_sha256": r1._sha(progress_raw)},
        "handoff": {"path": HANDOFF, "bytes": len(handoff_raw),
                    "file_sha256": r1._sha(handoff_raw)}})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw, CONTRACT: contract_raw}


def project(root: Path, at: datetime) -> dict[str, bytes]:
    return _build(Path(root), at)


def validate_outputs(root: Path, outputs: dict[str, bytes]) -> list[str]:
    try:
        rows = json.loads(outputs[EVENTS])["events"]
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        expected = _build(Path(root), at)
        if set(outputs) != set(expected):
            return ["C30_GENERATION_OUTPUT_SET_INVALID"]
        return [f"C30_GENERATION_{path.split('/')[-1].upper()}_INVALID"
                for path, raw in expected.items() if outputs[path] != raw]
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["C30_GENERATION_STATE_INVALID"]


def materialize(root: Path, at: datetime) -> None:
    root = Path(root)
    frozen = (EVENTS, PROGRESS, HANDOFF, CONTRACT, prior.MANIFEST, prior.DIGEST)
    if (_git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or any((root / path).read_bytes() != _frozen(root, path) for path in frozen)):
        raise RuntimeError("C30_GENERATION_PREDECESSOR_INVALID")
    outputs = _build(root, at)
    if validate_outputs(root, outputs):
        raise RuntimeError("C30_GENERATION_PROJECTION_INVALID")
    for relative, content in outputs.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    root = Path(root)
    try:
        outputs = {path: (root / path).read_bytes()
                   for path in (EVENTS, PROGRESS, HANDOFF, DIGEST, MANIFEST, CONTRACT)}
        errors = validate_outputs(root, outputs)
        at = datetime.fromisoformat(json.loads(outputs[EVENTS])["events"][START]["occurred_at"])
        if now.tzinfo is None or at > now:
            errors.append("C30_GENERATION_TIME_INVALID")
        if bundle["events"] != json.loads(outputs[EVENTS]) or bundle["progress"] != json.loads(outputs[PROGRESS]):
            errors.append("C30_GENERATION_BUNDLE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        return ["C30_GENERATION_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        dirty = prior.prior.prior.prior._dirty(root)
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
        return [] if good else ["C30_GENERATION_GIT_INVALID"]
    except (OSError, KeyError, AttributeError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["C30_GENERATION_GIT_INVALID"]
