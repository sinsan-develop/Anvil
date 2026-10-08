"""Record the scoped Phase F capability gate and advance to U-01."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _pretty, _sha

REPORT = "docs/04_test_reports/PHASE_F_GATE_REVIEW.md"

def event(rows, at):
    previous = rows[-1]
    seq = previous["sequence"] + 1
    row = {
        "sequence": seq,
        "event_id": "evt_phase_f_gate_1687",
        "event_type": "PHASE_GATE_COMPLETED",
        "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
        "actor_type": "AGENT", "project_id": "anvil",
        "work_package_id": "PHASE_F_GATE", "run_id": None,
        "step_id": "PHASE_F_GATE_REVIEW", "subject_ref": "PHASE_F_GATE",
        "occurred_at": at,
        "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
        "previous_event_sha256": _sha(_canonical(previous)),
        "details": {"result_status": "ACCEPTED_PHASE_F_SCOPED_CAPABILITY_QA", "report": REPORT,
                     "next_action": "U-01_WORK_INSTRUCTION"},
    }
    rows.append(row)
    return row

def materialize(root: Path) -> None:
    progress_path = root / "docs/progress/build-progress.json"
    ledger_path = root / "docs/progress/progress-events.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    if progress.get("event_sequence") != 1686 or progress.get("next_work_package", {}).get("package_id") != "PHASE_F_GATE":
        raise RuntimeError("PHASE_F_GATE_PRECONDITION_INVALID")
    if progress.get("worker_lease") is not None or progress.get("write_lease") is not None:
        raise RuntimeError("PHASE_F_GATE_LEASE_NOT_CLEAR")
    at = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    rows = ledger["events"]
    row = event(rows, at)
    event_raw = _append_events_raw(ledger_path.read_bytes(), progress["last_event_id"], 1686, rows[-1:])
    progress.update({
        "event_sequence": 1687, "last_event_id": row["event_id"], "updated_at": at,
        "recorded_at": at, "current_phase": "U", "current_work_package": "U-01",
        "completed_packages": list(dict.fromkeys(progress.get("completed_packages", []) + ["PHASE_F_GATE"])),
        "next_work_package": {"package_id": "U-01", "status": "READY_FOR_WORK_INSTRUCTION"},
        "next_successor_work_package": {"package_id": "U-01", "status": "READY_FOR_WORK_INSTRUCTION"},
        "next_safe_action": "U-01_WORK_INSTRUCTION", "runtime_next_action": "U-01_WORK_INSTRUCTION",
    })
    progress["repository"].update({"projection_mode": "PHASE_F_GATE_REVIEW", "worktree_status": "PHASE_F_ACCEPTED_SCOPED_CAPABILITY_QA"})
    progress["registry_refs"]["progress_events"] = {"path": "docs/progress/progress-events.json", "sha256": _sha(event_raw)}
    snapshot = dict(progress); snapshot.pop("snapshot_hash", None)
    progress["snapshot_hash"] = _sha(_canonical(snapshot))
    progress_path.write_bytes(_pretty(progress))
    ledger_path.write_bytes(event_raw)
    handoff = {"event_sequence": 1687, "last_event_id": row["event_id"], "status": "ACTIVE",
               "current_work_package": "U-01", "worker_lease": None, "write_lease": None,
               "next_work_package": progress["next_work_package"], "next_safe_action": "U-01_WORK_INSTRUCTION"}
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(
        ("# Phase F gate accepted scoped capability QA\n\n```json anvil-recovery-summary\n" +
         json.dumps(handoff, ensure_ascii=False, indent=2) + "\n```\n").encode("utf-8"))

if __name__ == "__main__":
    import sys
    materialize(Path(sys.argv[1] if len(sys.argv) > 1 else "."))
