"""F-18 R45C rollback rework close control."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha

MODE="F18_WSL_OPS_R45C_REWORK_CLOSE"; PREVIOUS_MODE="F18_WSL_OPS_R45C_REWORK_START"; WORKER="worker-lease-f18-wsl-ops-r45c-rework-20260927-001"; BRANCH="codex/f18-wsl-ops"; REPORT="docs/04_test_reports/F-18_R45C_REWORK_REPORT.md"; PLAN="docs/work_orders/F-18_WSL_OPS_R45C_REWORK_PLAN.md"; WI="docs/work_orders/F-18_WSL_OPS_R45C_REWORK_WORK_INSTRUCTION.md"; INVOCATION="docs/work_orders/F-18_WSL_OPS_R45C_REWORK_INVOCATION.md"; SELF="scripts/f18_wsl_ops_r45c_rework_close_overlay.py"; TEST="tests/tooling/test_f18_wsl_ops_r45c_rework_overlay.py"; START="docs/evidence/manifests/F-18_WSL_OPS_R45C_REWORK_START_MANIFEST.json"; CLOSE="docs/evidence/manifests/F-18_WSL_OPS_R45C_REWORK_CLOSE_MANIFEST.json"; DIGEST="docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r45c-rework.json"

def _git(root,*args):
 import subprocess; return subprocess.check_output(["git",*args],cwd=root,text=True).strip()
def control_paths(): return sorted({PLAN,WI,INVOCATION,REPORT,SELF,TEST,START,CLOSE,DIGEST,"docs/WORK_STATUS.md","docs/progress/build-progress.json","docs/progress/progress-events.json","docs/progress/BUILD_HANDOFF.md","scripts/check_project_progress.py"})
def materialize(root):
 root=Path(root); p=json.loads((root/"docs/progress/build-progress.json").read_text()); ledger=json.loads((root/"docs/progress/progress-events.json").read_text());
 if p.get("event_sequence")!=1683 or p.get("repository",{}).get("projection_mode")!=PREVIOUS_MODE or (p.get("worker_lease") or {}).get("lease_id")!=WORKER: raise RuntimeError("F18_R45C_REWORK_CLOSE_PRECONDITION_INVALID")
 at=datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds"); rows=ledger["events"]; last=_event(rows,"WORKER_LEASE_REVOKED",{"lease_id":WORKER,"reason":"R45C_REWORK_QA_RESIDUE_ZERO_ROLLBACK_REVIEW","resource_residue":0,"rollback_code_container":"REWORK_RECORDED"},at=at,step="WSL_OPS_R45C_REWORK_CLOSE"); event_raw=_append_events_raw((root/"docs/progress/progress-events.json").read_bytes(),p["last_event_id"],1683,rows[-1:]); p.update({"event_sequence":1684,"last_event_id":last["event_id"],"updated_at":at,"recorded_at":at,"worker_lease":None,"write_lease":None,"next_safe_action":"REVIEW_F18_R45C_REWORK","runtime_next_action":"REVIEW_F18_R45C_REWORK"}); p["repository"].update({"projection_mode":MODE,"worktree_status":"F18_WSL_OPS_R45C_REWORK_CLOSED"}); p["registry_refs"]["progress_events"]={"path":"docs/progress/progress-events.json","sha256":_sha(event_raw)}; p["snapshot_hash"]=""; p["snapshot_hash"]=_sha(_canonical(p)); p_raw=_pretty(p); (root/"docs/progress/build-progress.json").write_bytes(p_raw); (root/"docs/progress/progress-events.json").write_bytes(event_raw); handoff=_pretty({"event_sequence":1684,"last_event_id":last["event_id"],"status":"ACTIVE","current_work_package":"F-18","active_agent":"main-agent-eoul","worker_lease":None,"write_lease":None,"next_safe_action":"REVIEW_F18_R45C_REWORK","runtime_next_action":"REVIEW_F18_R45C_REWORK"}); (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(b"# F-18 R45C rollback rehearsal rework closed\n\n"+handoff+b"\n");
 checks=[]
 for rel in control_paths():
  if rel in {"docs/progress/build-progress.json","docs/progress/progress-events.json","docs/progress/BUILD_HANDOFF.md",DIGEST,CLOSE}: continue
  raw=(root/rel).read_bytes(); checks.append({"path":rel,"bytes":len(raw),"sha256":_sha(raw)})
 (root/CLOSE).write_bytes(_pretty({"schema_version":"1.0.0","package_id":"F-18","event_sequence":1684,"accepted":False,"projection_mode":MODE,"product_write_scope":[],"raw_checksums":checks,"production":"NOT_EXECUTED"}))
if __name__=="__main__":
 import sys; materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
