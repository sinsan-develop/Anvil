"""Open F-20 WSL final validation."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
try:
 from scripts.f18_progress_overlay import _append_events_raw,_canonical,_pretty,_sha
except ModuleNotFoundError:
 from f18_progress_overlay import _append_events_raw,_canonical,_pretty,_sha
def materialize(root:Path):
 pp=root/"docs/progress/build-progress.json"; lp=root/"docs/progress/progress-events.json"; p=json.loads(pp.read_text(encoding="utf-8")); l=json.loads(lp.read_text(encoding="utf-8"))
 if p.get("event_sequence")!=1711 or p.get("next_work_package",{}).get("package_id")!="F-20": raise RuntimeError("F20_START_PRECONDITION_INVALID")
 at=datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"); rows=l["events"]; prev=rows[-1]; row={"sequence":1712,"event_id":"evt_f20_1712_package_started","event_type":"PACKAGE_STARTED","actor":"main-agent-eoul","actor_id":"main-agent-eoul","actor_type":"AGENT","project_id":"anvil","work_package_id":"F-20","run_id":None,"step_id":"F-20_START","subject_ref":"F-20","occurred_at":at,"occurred_at_source":"PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME","previous_event_sha256":_sha(_canonical(prev)),"details":{"status":"ACTIVE","work_instruction":"docs/work_orders/F-20_WSL_FINAL_VALIDATION_WORK_INSTRUCTION.md"}}; rows.append(row); raw=_append_events_raw(lp.read_bytes(),p["last_event_id"],1711,rows[-1:]); p.update({"event_sequence":1712,"last_event_id":row["event_id"],"updated_at":at,"recorded_at":at,"current_phase":"F","current_work_package":"F-20","active_agent":"main-agent-eoul","next_safe_action":"F20_WSL_RUNTIME_VALIDATION","runtime_next_action":"F20_WSL_RUNTIME_VALIDATION"}); p["repository"].update({"projection_mode":"F20_START","worktree_status":"F20_ACTIVE"}); p["registry_refs"]["progress_events"]={"path":"docs/progress/progress-events.json","sha256":_sha(raw)}; q=dict(p); q.pop("snapshot_hash",None); p["snapshot_hash"]=_sha(_canonical(q)); pp.write_bytes(_pretty(p)); lp.write_bytes(raw); (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(("# F-20 WSL final validation active\n\n```json anvil-recovery-summary\n"+json.dumps({"event_sequence":1712,"last_event_id":row["event_id"],"status":"ACTIVE","current_work_package":"F-20","worker_lease":None,"write_lease":None,"next_safe_action":"F20_WSL_RUNTIME_VALIDATION"},ensure_ascii=False,indent=2)+"\n```\n").encode())
if __name__=="__main__":
 import sys; materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
