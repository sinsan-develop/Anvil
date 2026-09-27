"""Open U-03 Projects work package after U-02 acceptance."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _pretty, _sha

def materialize(root: Path):
    pp=root/"docs/progress/build-progress.json"; lp=root/"docs/progress/progress-events.json"; p=json.loads(pp.read_text(encoding="utf-8")); l=json.loads(lp.read_text(encoding="utf-8"))
    if p.get("event_sequence")!=1691 or p.get("next_work_package",{}).get("package_id")!="U-03": raise RuntimeError("U03_START_PRECONDITION_INVALID")
    at=datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"); rows=l["events"]; prev=rows[-1]; row={"sequence":1692,"event_id":"evt_u03_1692_package_started","event_type":"PACKAGE_STARTED","actor":"main-agent-eoul","actor_id":"main-agent-eoul","actor_type":"AGENT","project_id":"anvil","work_package_id":"U-03","run_id":None,"step_id":"U-03_START","subject_ref":"U-03","occurred_at":at,"occurred_at_source":"PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME","previous_event_sha256":_sha(_canonical(prev)),"details":{"status":"ACTIVE","work_instruction":"docs/work_orders/U-03_PROJECTS_WORK_INSTRUCTION.md"}}; rows.append(row); raw=_append_events_raw(lp.read_bytes(),p["last_event_id"],1691,rows[-1:]); p.update({"event_sequence":1692,"last_event_id":row["event_id"],"updated_at":at,"recorded_at":at,"current_work_package":"U-03","active_agent":"main-agent-eoul","next_safe_action":"U-03_IMPLEMENT_AND_VERIFY","runtime_next_action":"U-03_IMPLEMENT_AND_VERIFY"}); p["repository"].update({"projection_mode":"U03_START","worktree_status":"U03_ACTIVE"}); p["registry_refs"]["progress_events"]={"path":"docs/progress/progress-events.json","sha256":_sha(raw)}; s=dict(p); s.pop("snapshot_hash",None); p["snapshot_hash"]=_sha(_canonical(s)); pp.write_bytes(_pretty(p)); lp.write_bytes(raw); (root/"docs/progress/BUILD_HANDOFF.md").write_text("# U-03 Projects active\n\nU-03 implementation and local→WSL-server verification are active.\n",encoding="utf-8")
if __name__=="__main__":
    import sys; materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
