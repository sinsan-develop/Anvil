"""Record the scoped F-18 acceptance review and unblock the next planned package."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha

MODE="F18_ACCEPTANCE_REVIEW"; REVIEW="docs/04_test_reports/F-18_ACCEPTANCE_REVIEW.md"; SELF="scripts/f18_acceptance_materialize.py"; MANIFEST="docs/evidence/manifests/F-18_ACCEPTANCE_MANIFEST.json"
def collect_git(root):
 import subprocess
 return ["F18_ACCEPTANCE_DIRTY"] if subprocess.check_output(["git","status","--porcelain=v1","--untracked-files=all"],cwd=root,text=True).strip() else []
def validate(root,bundle):
 root=Path(root); p=bundle["progress"]; e=[]
 if p.get("event_sequence")!=1685 or p.get("f18_overall_status")!="ACCEPTED_F18_WSL_SCOPED_QA" or p.get("next_work_package",{}).get("status")!="READY_FOR_WORK_INSTRUCTION": e.append("F18_ACCEPTANCE_STATE_INVALID")
 if not (root/MANIFEST).is_file(): e.append("F18_ACCEPTANCE_MANIFEST_MISSING")
 e.extend(collect_git(root)); return sorted(set(e))
def materialize(root):
    root=Path(root); p=json.loads((root/"docs/progress/build-progress.json").read_text(encoding="utf-8")); ledger=json.loads((root/"docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if p.get("event_sequence")!=1684 or p.get("repository",{}).get("projection_mode")!="F18_WSL_OPS_R45C_REWORK_CLOSE" or p.get("worker_lease") is not None: raise RuntimeError("F18_ACCEPTANCE_PRECONDITION_INVALID")
    at=datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"); rows=ledger["events"]; last=_event(rows,"PACKAGE_COMPLETED",{"package_id":"F-18","result_status":"COMPLETED","package_status":"ACCEPTED_F18_WSL_SCOPED_QA","acceptance_review":REVIEW,"next_action":"ISSUE_F19_WORK_INSTRUCTION"},at=at,step="F18_ACCEPTANCE_REVIEW"); event_raw=_append_events_raw((root/"docs/progress/progress-events.json").read_bytes(),p["last_event_id"],1684,rows[-1:]); p.update({"event_sequence":1685,"last_event_id":last["event_id"],"updated_at":at,"recorded_at":at,"f18_overall_status":"ACCEPTED_F18_WSL_SCOPED_QA","completed_packages":list(dict.fromkeys(p.get("completed_packages",[])+["F-18"])),"next_work_package":{"package_id":"F-19","status":"READY_FOR_WORK_INSTRUCTION"},"next_successor_work_package":{"package_id":"F-19","status":"READY_FOR_WORK_INSTRUCTION"},"next_safe_action":"ISSUE_F19_WORK_INSTRUCTION","runtime_next_action":"ISSUE_F19_WORK_INSTRUCTION"}); p["repository"].update({"projection_mode":MODE,"worktree_status":"F18_ACCEPTED_WSL_SCOPED_QA"}); p["registry_refs"]["progress_events"]={"path":"docs/progress/progress-events.json","sha256":_sha(event_raw)}; p["snapshot_hash"]=""; p["snapshot_hash"]=_sha(_canonical(p)); p_raw=_pretty(p); (root/"docs/progress/build-progress.json").write_bytes(p_raw); (root/"docs/progress/progress-events.json").write_bytes(event_raw); handoff=_pretty({"event_sequence":1685,"last_event_id":last["event_id"],"status":"ACTIVE","current_work_package":"F-18","active_agent":"main-agent-eoul","worker_lease":None,"write_lease":None,"next_work_package":p["next_work_package"],"next_safe_action":"ISSUE_F19_WORK_INSTRUCTION","runtime_next_action":"ISSUE_F19_WORK_INSTRUCTION"}); (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(b"# F-18 accepted; F-19 ready\n\n```json anvil-recovery-summary\n"+handoff+b"```\n"); checks=[]
    for rel in [REVIEW,SELF,"docs/WORK_STATUS.md"]:
        raw=(root/rel).read_bytes(); checks.append({"path":rel,"bytes":len(raw),"sha256":_sha(raw)})
    (root/MANIFEST).write_bytes(_pretty({"schema_version":"1.0.0","package_id":"F-18","event_sequence":1685,"accepted":True,"projection_mode":MODE,"next_work_package":"F-19","raw_checksums":checks,"production":"NOT_EXECUTED"}))
if __name__=="__main__":
 import sys; materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
