"""Verify C30 generation 2 while preserving quarantined history and F-20 DEFER."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import subprocess

try:
    from scripts import f20_c30_generation_start_overlay as prior
except ModuleNotFoundError:
    import f20_c30_generation_start_overlay as prior


r1 = prior.r1
EVENTS, PROGRESS, HANDOFF, CONTRACT = (
    prior.EVENTS, prior.PROGRESS, prior.HANDOFF, prior.CONTRACT)
START, END = 2047, 2048
BASE = "18580166e3d1eee42d8180e5c3f930532e358f75"
MODE = "F20_C30_RECOVERY_V2_VERIFIED"
NEXT = "F20_U01_REMAINING_APPROVED_SCOPE_REVIEW"
REPORT = "docs/04_test_reports/F-20_C30_EVENT_RECOVERY_V2_INDEPENDENT_TEST_REPORT.md"
MANIFEST = "docs/evidence/manifests/F-20_C30_RECOVERY_V2_VERIFIED_MANIFEST.json"
DIGEST = "docs/progress/progress-handoff-detached-digest-f20-c30-recovery-v2-verified.json"
WSL_SHA = "d58d95f121e24bd5cb199617e1afbcac8cafa80a"
WSL_STATUS_SHA = "6b95360dce80904a064a636404a794074568ae9e"
WSL_STATUS_DIGEST = "7A6F211B346F49781A10A3199DBE58D7395DF1D40B5EBB4D3E1E9E3DFAF4A255"
FROZEN_VERIFICATION_INPUTS = (
    "scripts/f20_c30_generation_start_overlay.py",
    "scripts/f20_c30_recovery_close_overlay.py",
    "scripts/f20_c30_recovery_start_overlay.py",
    "scripts/f20_c30_recovery_v2.py", REPORT,
    "scripts/f20_rework_overlay.py",
    "scripts/check_project_progress.py",
)
CONTROL_SCOPE = prior.CONTROL_SCOPE | {
    EVENTS, PROGRESS, HANDOFF, CONTRACT, MANIFEST, DIGEST, REPORT,
    "docs/WORK_STATUS.md", "scripts/check_project_progress.py",
    "scripts/f20_c30_recovery_verified_overlay.py",
    "tests/tooling/test_f20_c30_recovery_verified_projection.py",
}


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _frozen(root: Path, path: str) -> bytes:
    return _git(root, "show", f"{BASE}:{path}")


def _test_report(root: Path) -> bytes:
    raw = (root / REPORT).read_bytes()
    required = (
        b"ELIGIBLE", b"Critical/Important 0", b"6b95360d",
        WSL_SHA.encode(), b"Ran 7 tests in 23.107s", b"G-05 project progress contract: PASS sequence=2047",
        b"Tester", b"DEFER",
    )
    if any(item not in raw for item in required):
        raise ValueError("C30_VERIFIED_TEST_REPORT_INCOMPLETE")
    return raw


def _predecessor(root: Path) -> tuple[bytes, dict, dict, bytes, bytes]:
    if any((root / path).read_bytes() != _frozen(root, path)
           for path in FROZEN_VERIFICATION_INPUTS):
        raise ValueError("C30_VERIFIED_EXECUTED_INPUT_NOT_FROZEN")
    frozen_paths = (EVENTS, PROGRESS, HANDOFF, CONTRACT, prior.MANIFEST, prior.DIGEST)
    outputs = {path: _frozen(root, path) for path in frozen_paths}
    if prior.validate_outputs(root, outputs):
        raise ValueError("C30_VERIFIED_GENERATION_START_INVALID")
    stream, progress = json.loads(outputs[EVENTS]), json.loads(outputs[PROGRESS])
    if (stream["last_sequence"] != START or len(stream["events"]) != START
            or progress["event_sequence"] != START
            or progress["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
            or progress["c30_event_generation"]["authority_active"] is not False
            or progress["scope_revision_binding"]["release_decision"] != "DEFER"
            or progress["worker_lease"] is not None or progress["write_lease"] is not None
            or "F-20" in progress["completed_packages"]):
        raise ValueError("C30_VERIFIED_PREDECESSOR_STATE_INVALID")
    return outputs[EVENTS], stream, progress, outputs[CONTRACT], outputs[prior.MANIFEST]


def _contract(raw: bytes) -> bytes:
    value = json.loads(raw)
    kind = "EVENT_LEDGER_RECOVERY_VERIFIED"
    if kind in value["event_types"] or kind in value["payload_contracts"]:
        raise ValueError("C30_VERIFIED_CONTRACT_ALREADY_EXTENDED")
    value["event_types"].append(kind)
    value["payload_contracts"][kind] = {
        "required_details": [
            "generation", "generation_start_event_id", "generation_manifest_sha256",
            "independent_test_report_path", "independent_test_report_sha256",
            "independent_verdict", "wsl_qa_commit", "wsl_evidence_commit",
            "quarantined_event_sequences", "audit_only_event_sequences",
            "package_accepted", "release_decision", "authority_active",
            "verification_manifest_path", "verification_manifest_sha256",
        ],
        "effect": "activate_verified_generation_with_quarantined_history_only",
    }
    return r1._pretty(value)


def _build(root: Path, at: datetime) -> dict[str, bytes]:
    root = Path(root)
    if at.tzinfo is None:
        raise ValueError("C30_VERIFIED_TIME_INVALID")
    raw, stream, old, contract_raw, start_manifest_raw = _predecessor(root)
    report_raw = _test_report(root)
    if old["repository"]["projection_mode"] != prior.MODE:
        raise ValueError("C30_VERIFIED_PREDECESSOR_MODE_INVALID")
    if (r1._sha(_git(root, "show", f"{WSL_STATUS_SHA}:docs/WORK_STATUS.md"))
            != WSL_STATUS_DIGEST
            or subprocess.run(["git", "merge-base", "--is-ancestor", WSL_STATUS_SHA, BASE],
                              cwd=root, capture_output=True).returncode != 0):
        raise ValueError("C30_VERIFIED_WSL_STATUS_INVALID")
    generation = old["c30_event_generation"]
    if (generation["manifest_path"] != prior.MANIFEST
            or generation["manifest_sha256"] != r1._sha(start_manifest_raw)
            or generation["started_event_id"] != stream["events"][-1]["event_id"]
            or generation["status"] != "PENDING_INDEPENDENT_VERIFICATION"
            or generation["accepted"] is not False):
        raise ValueError("C30_VERIFIED_GENERATION_BINDING_INVALID")
    manifest = {
        "schema_version": "1.0.0", "package_id": "F-20", "generation": 2,
        "accepted": False, "authority_active": True,
        "predecessor_commit": BASE, "predecessor_event_sequence": START,
        "predecessor_events_sha256": r1._sha(raw),
        "generation_start_event_id": generation["started_event_id"],
        "generation_manifest_path": prior.MANIFEST,
        "generation_manifest_sha256": r1._sha(start_manifest_raw),
        "independent_test_report_path": REPORT,
        "independent_test_report_sha256": r1._sha(report_raw),
        "independent_verdict": "ELIGIBLE_C0_I0",
        "wsl_qa_commit": WSL_SHA, "wsl_evidence_commit": WSL_STATUS_SHA,
        "wsl_evidence_status_sha256": WSL_STATUS_DIGEST,
        "quarantined_event_sequences": [1689, 1714],
        "audit_only_event_sequences": [1715, START],
        "incident_status": "RECOVERED_WITH_QUARANTINED_HISTORY",
        "release_decision": "DEFER", "production": "NOT_EXECUTED",
        "self_reference": False,
    }
    manifest_raw = r1._pretty(manifest)
    details = {
        "generation": 2, "generation_start_event_id": generation["started_event_id"],
        "generation_manifest_sha256": r1._sha(start_manifest_raw),
        "independent_test_report_path": REPORT,
        "independent_test_report_sha256": r1._sha(report_raw),
        "independent_verdict": "ELIGIBLE_C0_I0",
        "wsl_qa_commit": WSL_SHA, "wsl_evidence_commit": WSL_STATUS_SHA,
        "quarantined_event_sequences": [1689, 1714],
        "audit_only_event_sequences": [1715, START],
        "package_accepted": False, "release_decision": "DEFER",
        "authority_active": True,
        "verification_manifest_path": MANIFEST,
        "verification_manifest_sha256": r1._sha(manifest_raw),
    }
    predecessor = stream["events"][-1]
    stamp = at.isoformat(timespec="seconds")
    row = {"sequence": END, "event_id": "evt_f20_2048_event_ledger_recovery_verified",
           "event_type": "EVENT_LEDGER_RECOVERY_VERIFIED",
           "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
           "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-20",
           "run_id": None, "step_id": MODE, "subject_ref": "F-20/C30-RECOVERY-V2",
           "occurred_at": stamp,
           "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
           "previous_event_sha256": r1._sha(r1._canonical(predecessor)),
           "details": details}
    marker = b'\n  ],\n  "last_event_id": "' + stream["last_event_id"].encode() + b'"'
    seq = f'"last_sequence": {START}'.encode()
    if raw != r1._lf(raw) or raw.count(marker) != 1 or raw.count(seq) != 1:
        raise ValueError("C30_VERIFIED_RAW_INVALID")
    event_raw = raw.replace(marker, b",\n" + r1._pretty(row).rstrip()
                            + b'\n  ],\n  "last_event_id": "' + row["event_id"].encode() + b'"')
    event_raw = event_raw.replace(seq, f'"last_sequence": {END}'.encode(), 1)
    if prior._event_prefix(event_raw)[:len(prior._event_prefix(raw))] != prior._event_prefix(raw):
        raise ValueError("C30_VERIFIED_PREFIX_CHANGED")
    contract_new = _contract(contract_raw)
    updated = deepcopy(old)
    updated.update({
        "snapshot_id": "snapshot-f20-c30-recovery-v2-verified-seq2048",
        "event_sequence": END, "last_event_id": row["event_id"],
        "updated_at": stamp, "active_agent": "main-agent-eoul",
        "next_safe_action": NEXT, "runtime_next_action": NEXT,
        "current_progress_evidence_ref": {"package_id": "F-20", "path": DIGEST,
                                          "manifest_path": MANIFEST},
    })
    updated["f20_c30_event_integrity_incident"].update({
        "status": "RECOVERED_WITH_QUARANTINED_HISTORY", "blocking": False,
        "recovery_event_id": row["event_id"],
        "recovery_manifest_path": MANIFEST,
        "quarantined_event_sequences": [1689, 1714]})
    updated["c30_event_generation"].update({
        "status": "VERIFIED_WITH_QUARANTINED_HISTORY", "authority_active": True,
        "verified_event_id": row["event_id"],
        "verification_manifest_path": MANIFEST,
        "verification_manifest_sha256": r1._sha(manifest_raw),
        "independent_test_report_path": REPORT,
        "independent_test_report_sha256": r1._sha(report_raw)})
    updated["repository"].update({
        "local_head": BASE, "remote_head": BASE, "validated_base_commit": BASE,
        "projection_mode": MODE,
        "worktree_status": "F20_C30_RECOVERED_WITH_QUARANTINED_HISTORY",
        "product_write_scope": [], "commit_status": "PENDING", "push_status": "PENDING"})
    updated["registry_refs"]["progress_events"]["sha256"] = r1._sha(event_raw)
    updated["registry_refs"]["progress_event_contract"]["sha256"] = r1._sha(contract_new)
    snapshot = deepcopy(updated)
    snapshot.pop("snapshot_hash", None)
    updated["snapshot_hash"] = r1._sha(r1._canonical(snapshot))
    progress_raw = r1._pretty(updated)
    summary = {"event_sequence": END, "last_event_id": row["event_id"],
               "status": "ACTIVE", "current_work_package": "F-20",
               "active_agent": "main-agent-eoul", "worker_lease": None,
               "write_lease": None,
               "incident_event_id": old["f20_c30_event_integrity_incident"]["event_id"],
               "incident_blocking": False, "next_safe_action": NEXT,
               "repository_head": BASE,
               "repository_upstream": "development/codex/f18-wsl-ops",
               "reporting_decision": updated["reporting_decision"]["decision"]}
    handoff_raw = (b"# F-20 C30 recovery v2 verified handoff\n\n"
                   b"```json anvil-recovery-summary\n" + r1._pretty(summary)
                   + b"```\n\n- C30 RECOVERED_WITH_QUARANTINED_HISTORY; F-20 unaccepted; "
                     b"Release DEFER; Production NOT_EXECUTED.\n")
    digest_raw = r1._pretty({
        "schema_version": "1.0.0", "algorithm": "SHA-256", "event_sequence": END,
        "self_reference": False,
        "progress": {"path": PROGRESS, "bytes": len(progress_raw),
                     "file_sha256": r1._sha(progress_raw)},
        "handoff": {"path": HANDOFF, "bytes": len(handoff_raw),
                    "file_sha256": r1._sha(handoff_raw)}})
    return {EVENTS: event_raw, PROGRESS: progress_raw, HANDOFF: handoff_raw,
            DIGEST: digest_raw, MANIFEST: manifest_raw, CONTRACT: contract_new}


def project(root: Path, at: datetime) -> dict[str, bytes]:
    return _build(Path(root), at)


def validate_outputs(root: Path, outputs: dict[str, bytes]) -> list[str]:
    try:
        rows = json.loads(outputs[EVENTS])["events"]
        at = datetime.fromisoformat(rows[START]["occurred_at"])
        expected = _build(Path(root), at)
        if set(outputs) != set(expected):
            return ["C30_VERIFIED_OUTPUT_SET_INVALID"]
        return [f"C30_VERIFIED_{path.split('/')[-1].upper()}_INVALID"
                for path, raw in expected.items() if outputs[path] != raw]
    except (OSError, ValueError, KeyError, TypeError, IndexError,
            subprocess.CalledProcessError):
        return ["C30_VERIFIED_STATE_INVALID"]


def materialize(root: Path, at: datetime) -> None:
    root = Path(root)
    frozen = (EVENTS, PROGRESS, HANDOFF, CONTRACT, prior.MANIFEST, prior.DIGEST, REPORT)
    if (_git(root, "rev-parse", "HEAD").decode().strip() != BASE
            or _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip() != BASE
            or _git(root, "branch", "--show-current").decode().strip() != "codex/f18-wsl-ops"
            or _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
               != "development/codex/f18-wsl-ops"
            or any((root / path).read_bytes() != _frozen(root, path) for path in frozen)):
        raise RuntimeError("C30_VERIFIED_PREDECESSOR_INVALID")
    outputs = _build(root, at)
    if validate_outputs(root, outputs):
        raise RuntimeError("C30_VERIFIED_PROJECTION_INVALID")
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
            errors.append("C30_VERIFIED_TIME_INVALID")
        if bundle["events"] != json.loads(outputs[EVENTS]) or bundle["progress"] != json.loads(outputs[PROGRESS]):
            errors.append("C30_VERIFIED_BUNDLE_INVALID")
        return sorted(set(errors))
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        return ["C30_VERIFIED_CONTROL_MISSING"]


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        dirty = prior.prior.prior.prior.prior._dirty(root)
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
        return [] if good else ["C30_VERIFIED_GIT_INVALID"]
    except (OSError, KeyError, AttributeError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["C30_VERIFIED_GIT_INVALID"]
