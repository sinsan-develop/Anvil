"""Record scoped F-19 acceptance and advance to the Phase F gate."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha

MODE="F19_ACCEPTANCE_REVIEW"; REVIEW="docs/04_test_reports/F-19_ACCEPTANCE_REVIEW.md"; MANIFEST="docs/evidence/manifests/F-19_PROVIDER_SECURITY_MANIFEST.json"; SELF="scripts/f19_acceptance_materialize.py"
def collect_git(root):
 import subprocess
 return ["F19_ACCEPTANCE_DIRTY"] if subprocess.check_output(["git","status","--porcelain=v1","--untracked-files=all"],cwd=root,text=True).strip() else []
def validate(root,bundle):
 p=bundle["progress"]; e=[]
 if p.get("event_sequence")!=1686 or p.get("next_work_package",{}).get("package_id")!="PHASE_F_GATE": e.append("F19_ACCEPTANCE_STATE_INVALID")
 if not (Path(root)/MANIFEST).is_file(): e.append("F19_ACCEPTANCE_MANIFEST_MISSING")
 e.extend(collect_git(Path(root))); return sorted(set(e))
def materialize(root):
 root=Path(root); p=json.loads((root/"docs/progress/build-progress.json").read_text(encoding="utf-8")); ledger=json.loads((root/"docs/progress/progress-events.json").read_text(encoding="utf-8"))
 if p.get("event_sequence")!=1685 or p.get("repository",{}).get("projection_mode")!="F18_ACCEPTANCE_REVIEW" or p.get("worker_lease") is not None: raise RuntimeError("F19_ACCEPTANCE_PRECONDITION_INVALID")
 at=datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"); rows=ledger["events"]; last=_event(rows,"PACKAGE_COMPLETED",{"package_id":"F-19","result_status":"COMPLETED","package_status":"ACCEPTED_F19_SCOPED_SECURITY_QA","acceptance_review":REVIEW,"next_action":"PHASE_F_GATE_REVIEW"},at=at,step="F19_ACCEPTANCE_REVIEW"); event_raw=_append_events_raw((root/"docs/progress/progress-events.json").read_bytes(),p["last_event_id"],1685,rows[-1:]); p.update({"event_sequence":1686,"last_event_id":last["event_id"],"updated_at":at,"recorded_at":at,"completed_packages":list(dict.fromkeys(p.get("completed_packages",[])+["F-19"])),"next_work_package":{"package_id":"PHASE_F_GATE","status":"READY_FOR_GATE_REVIEW"},"next_successor_work_package":{"package_id":"PHASE_F_GATE","status":"READY_FOR_GATE_REVIEW"},"next_safe_action":"PHASE_F_GATE_REVIEW","runtime_next_action":"PHASE_F_GATE_REVIEW"}); p["repository"].update({"projection_mode":MODE,"worktree_status":"F19_ACCEPTED_SCOPED_SECURITY_QA"}); p["registry_refs"]["progress_events"]={"path":"docs/progress/progress-events.json","sha256":_sha(event_raw)}; p["snapshot_hash"]=""; p["snapshot_hash"]=_sha(_canonical(p)); p_raw=_pretty(p); (root/"docs/progress/build-progress.json").write_bytes(p_raw); (root/"docs/progress/progress-events.json").write_bytes(event_raw); h=_pretty({"event_sequence":1686,"last_event_id":last["event_id"],"status":"ACTIVE","current_work_package":"F-19","worker_lease":None,"write_lease":None,"next_work_package":p["next_work_package"],"next_safe_action":"PHASE_F_GATE_REVIEW","runtime_next_action":"PHASE_F_GATE_REVIEW"}); (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(b"# F-19 accepted scoped security QA\n\n```json anvil-recovery-summary\n"+h+b"```\n")
if __name__=="__main__":
 import sys; materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
