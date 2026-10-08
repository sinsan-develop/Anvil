"""Record U-10 Operations scoped acceptance and advance to U-11."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
try:
 from scripts.f18_progress_overlay import _append_events_raw,_canonical,_pretty,_sha
except ModuleNotFoundError:
 from f18_progress_overlay import _append_events_raw,_canonical,_pretty,_sha
REPORT="docs/04_test_reports/U-10_OPERATIONS_REPORT.md"; MANIFEST="docs/evidence/manifests/U-10_OPERATIONS_MANIFEST.json"
def add(rows,seq,kind,details,prev,at):
 row={"sequence":seq,"event_id":f"evt_u10_{seq}_{kind.lower()}","event_type":kind,"actor":"main-agent-eoul","actor_id":"main-agent-eoul","actor_type":"AGENT","project_id":"anvil","work_package_id":"U-10","run_id":None,"step_id":"U-10_ACCEPTANCE","subject_ref":"U-10","occurred_at":at,"occurred_at_source":"PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME","previous_event_sha256":_sha(_canonical(prev)),"details":details}; rows.append(row); return row
def materialize(root:Path):
 pp=root/"docs/progress/build-progress.json"; lp=root/"docs/progress/progress-events.json"; p=json.loads(pp.read_text(encoding="utf-8")); l=json.loads(lp.read_text(encoding="utf-8"))
 if p.get("event_sequence")!=1706 or p.get("next_work_package",{}).get("package_id")!="U-10": raise RuntimeError("U10_PRECONDITION_INVALID")
 at=datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"); rows=l["events"]; s=add(rows,1707,"PACKAGE_STARTED",{"status":"ACTIVE","work_instruction":"docs/work_orders/U-10_OPERATIONS_WORK_INSTRUCTION.md"},rows[-1],at); d=add(rows,1708,"PACKAGE_COMPLETED",{"result_status":"ACCEPTED_U10_LOCAL_CONTRACT_SCOPED","report":REPORT,"manifest":MANIFEST,"next_action":"U-11_WORK_INSTRUCTION"},s,at); raw=_append_events_raw(lp.read_bytes(),p["last_event_id"],1706,rows[-2:]); p.update({"event_sequence":1708,"last_event_id":d["event_id"],"updated_at":at,"recorded_at":at,"current_work_package":"U-10","completed_packages":list(dict.fromkeys(p.get("completed_packages",[])+["U-10"])),"next_work_package":{"package_id":"U-11","status":"READY_FOR_WORK_INSTRUCTION"},"next_successor_work_package":{"package_id":"U-11","status":"READY_FOR_WORK_INSTRUCTION"},"next_safe_action":"U-11_WORK_INSTRUCTION","runtime_next_action":"U-11_WORK_INSTRUCTION"}); p["repository"].update({"projection_mode":"U10_ACCEPTANCE_REVIEW","worktree_status":"U10_ACCEPTED_LOCAL_CONTRACT_SCOPED"}); p["registry_refs"]["progress_events"]={"path":"docs/progress/progress-events.json","sha256":_sha(raw)}; q=dict(p); q.pop("snapshot_hash",None); p["snapshot_hash"]=_sha(_canonical(q)); pp.write_bytes(_pretty(p)); lp.write_bytes(raw); h={"event_sequence":1708,"last_event_id":d["event_id"],"status":"ACTIVE","current_work_package":"U-11","worker_lease":None,"write_lease":None,"next_work_package":p["next_work_package"],"next_safe_action":"U-11_WORK_INSTRUCTION"}; (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(("# U-10 Operations accepted scoped contract\n\n```json anvil-recovery-summary\n"+json.dumps(h,ensure_ascii=False,indent=2)+"\n```\n").encode())
if __name__=="__main__":
 import sys; materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
