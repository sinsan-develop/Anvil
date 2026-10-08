"""Record scoped Phase U gate and advance to F-20."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
try:
 from scripts.f18_progress_overlay import _append_events_raw,_canonical,_pretty,_sha
except ModuleNotFoundError:
 from f18_progress_overlay import _append_events_raw,_canonical,_pretty,_sha
REPORT="docs/04_test_reports/PHASE_U_GATE_REVIEW.md"
def materialize(root:Path):
 pp=root/"docs/progress/build-progress.json"; lp=root/"docs/progress/progress-events.json"; p=json.loads(pp.read_text(encoding="utf-8")); l=json.loads(lp.read_text(encoding="utf-8"))
 if p.get("event_sequence")!=1710 or p.get("next_work_package",{}).get("package_id")!="PHASE_U_GATE": raise RuntimeError("PHASE_U_PRECONDITION_INVALID")
 at=datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"); rows=l["events"]; prev=rows[-1]; row={"sequence":1711,"event_id":"evt_phase_u_gate_1711_phase_gate_completed","event_type":"PHASE_GATE_COMPLETED","actor":"main-agent-eoul","actor_id":"main-agent-eoul","actor_type":"AGENT","project_id":"anvil","work_package_id":"PHASE_U_GATE","run_id":None,"step_id":"PHASE_U_GATE_REVIEW","subject_ref":"PHASE_U_GATE","occurred_at":at,"occurred_at_source":"PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME","previous_event_sha256":_sha(_canonical(prev)),"details":{"result_status":"ACCEPTED_PHASE_U_SCOPED_CONTRACT_QA","report":REPORT,"next_action":"F-20_WORK_INSTRUCTION"}}; rows.append(row); raw=_append_events_raw(lp.read_bytes(),p["last_event_id"],1710,rows[-1:]); p.update({"event_sequence":1711,"last_event_id":row["event_id"],"updated_at":at,"recorded_at":at,"current_phase":"F","current_work_package":"PHASE_U_GATE","completed_packages":list(dict.fromkeys(p.get("completed_packages",[])+["PHASE_U_GATE"])),"next_work_package":{"package_id":"F-20","status":"READY_FOR_WORK_INSTRUCTION"},"next_successor_work_package":{"package_id":"F-20","status":"READY_FOR_WORK_INSTRUCTION"},"next_safe_action":"F-20_WORK_INSTRUCTION","runtime_next_action":"F-20_WORK_INSTRUCTION"}); p["repository"].update({"projection_mode":"PHASE_U_GATE_REVIEW","worktree_status":"PHASE_U_ACCEPTED_SCOPED_CONTRACT_QA"}); p["registry_refs"]["progress_events"]={"path":"docs/progress/progress-events.json","sha256":_sha(raw)}; q=dict(p); q.pop("snapshot_hash",None); p["snapshot_hash"]=_sha(_canonical(q)); pp.write_bytes(_pretty(p)); lp.write_bytes(raw); h={"event_sequence":1711,"last_event_id":row["event_id"],"status":"ACTIVE","current_work_package":"F-20","worker_lease":None,"write_lease":None,"next_work_package":p["next_work_package"],"next_safe_action":"F-20_WORK_INSTRUCTION"}; (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(("# Phase U gate accepted scoped contract QA\n\n```json anvil-recovery-summary\n"+json.dumps(h,ensure_ascii=False,indent=2)+"\n```\n").encode())
if __name__=="__main__":
 import sys; materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
