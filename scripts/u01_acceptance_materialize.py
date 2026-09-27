"""Record U-01 local Dashboard acceptance and advance to U-02."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _pretty, _sha

REPORT = "docs/04_test_reports/U-01_DASHBOARD_REPORT.md"
MANIFEST = "docs/evidence/manifests/U-01_DASHBOARD_MANIFEST.json"

def append(rows, kind, details, seq, previous, at):
    row = {"sequence": seq, "event_id": f"evt_u01_{seq}_{kind.lower()}", "event_type": kind,
           "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
           "project_id": "anvil", "work_package_id": "U-01", "run_id": None,
           "step_id": "U-01_ACCEPTANCE", "subject_ref": "U-01", "occurred_at": at,
           "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
           "previous_event_sha256": _sha(_canonical(previous)), "details": details}
    rows.append(row)
    return row

def materialize(root: Path) -> None:
    pp = root / "docs/progress/build-progress.json"; lp = root / "docs/progress/progress-events.json"
    progress = json.loads(pp.read_text(encoding="utf-8")); ledger = json.loads(lp.read_text(encoding="utf-8"))
    if progress.get("event_sequence") != 1687 or progress.get("next_work_package", {}).get("package_id") != "U-01":
        raise RuntimeError("U01_PRECONDITION_INVALID")
    if not (root / REPORT).is_file() or not (root / MANIFEST).is_file(): raise RuntimeError("U01_EVIDENCE_MISSING")
    at = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"); rows = ledger["events"]; previous = rows[-1]
    start = append(rows, "PACKAGE_STARTED", {"status": "ACTIVE", "work_instruction": "docs/work_orders/U-01_DASHBOARD_WORK_INSTRUCTION.md"}, 1688, previous, at)
    done = append(rows, "PACKAGE_COMPLETED", {"result_status": "ACCEPTED_U01_LOCAL_WEB_SCOPED", "report": REPORT, "manifest": MANIFEST, "next_action": "U-02_WORK_INSTRUCTION"}, 1689, start, at)
    raw = _append_events_raw(lp.read_bytes(), progress["last_event_id"], 1687, rows[-2:])
    progress.update({"event_sequence": 1689, "last_event_id": done["event_id"], "updated_at": at, "recorded_at": at,
                     "current_work_package": "U-01", "completed_packages": list(dict.fromkeys(progress.get("completed_packages", []) + ["U-01"])),
                     "next_work_package": {"package_id": "U-02", "status": "READY_FOR_WORK_INSTRUCTION"},
                     "next_successor_work_package": {"package_id": "U-02", "status": "READY_FOR_WORK_INSTRUCTION"},
                     "next_safe_action": "U-02_WORK_INSTRUCTION", "runtime_next_action": "U-02_WORK_INSTRUCTION"})
    progress["repository"].update({"projection_mode": "U01_ACCEPTANCE_REVIEW", "worktree_status": "U01_ACCEPTED_LOCAL_WEB_SCOPED"})
    progress["registry_refs"]["progress_events"] = {"path": "docs/progress/progress-events.json", "sha256": _sha(raw)}
    snap = dict(progress); snap.pop("snapshot_hash", None); progress["snapshot_hash"] = _sha(_canonical(snap))
    pp.write_bytes(_pretty(progress)); lp.write_bytes(raw)
    handoff = {"event_sequence": 1689, "last_event_id": done["event_id"], "status": "ACTIVE", "current_work_package": "U-02", "worker_lease": None, "write_lease": None, "next_work_package": progress["next_work_package"], "next_safe_action": "U-02_WORK_INSTRUCTION"}
    (root / "docs/progress/BUILD_HANDOFF.md").write_bytes(("# U-01 Dashboard accepted local web scope\n\n```json anvil-recovery-summary\n" + json.dumps(handoff, ensure_ascii=False, indent=2) + "\n```\n").encode("utf-8"))

if __name__ == "__main__":
    import sys
    materialize(Path(sys.argv[1] if len(sys.argv) > 1 else "."))
