"""F-18 R45C rollback rework start control."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
try:
    from scripts.f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha
except ModuleNotFoundError:
    from f18_progress_overlay import _append_events_raw, _canonical, _event, _pretty, _sha

BRANCH = "codex/f18-wsl-ops"
BASE = "462c2e5b27823de2c1184f56f0fa9908a2cea328"
PREDECESSOR = "a3af6e6373ab4f2ad41cf7f25e93b76819f36b1b"
MODE = "F18_WSL_OPS_R45C_REWORK_START"
ACTOR = "main-agent-eoul"
WORKER = "worker-lease-f18-wsl-ops-r45c-rework-20260927-001"
TOKEN = "f18-wsl-ops-execution-fence-epoch-37-r45c-rework"
PLAN = "docs/work_orders/F-18_WSL_OPS_R45C_REWORK_PLAN.md"
WI = "docs/work_orders/F-18_WSL_OPS_R45C_REWORK_WORK_INSTRUCTION.md"
INVOCATION = "docs/work_orders/F-18_WSL_OPS_R45C_REWORK_INVOCATION.md"
REPORT = "docs/04_test_reports/F-18_R45C_REWORK_REPORT.md"
SELF = "scripts/f18_wsl_ops_r45c_rework_overlay.py"
TEST = "tests/tooling/test_f18_wsl_ops_r45c_rework_overlay.py"
DIGEST = "docs/progress/progress-handoff-detached-digest-f18-wsl-ops-r45c-rework.json"
MANIFEST = "docs/evidence/manifests/F-18_WSL_OPS_R45C_REWORK_START_MANIFEST.json"

def control_paths():
    return sorted({PLAN, WI, INVOCATION, REPORT, SELF, TEST, DIGEST, MANIFEST,
        "docs/WORK_STATUS.md", "docs/progress/build-progress.json", "docs/progress/progress-events.json",
        "docs/progress/BUILD_HANDOFF.md", "scripts/check_project_progress.py"})

def _git(root, *args):
    import subprocess
    return subprocess.check_output(["git", *args], cwd=root, text=True).strip()

def collect_git(root):
    root = Path(root); errors=[]
    if _git(root,"branch","--show-current") != BRANCH: errors.append("F18_R45C_REWORK_BRANCH_INVALID")
    if _git(root,"status","--porcelain=v1","--untracked-files=all"): errors.append("F18_R45C_REWORK_DIRTY")
    if _git(root,"rev-parse","development/main") != BASE: errors.append("F18_R45C_REWORK_BASE_INVALID")
    return errors

def validate(root, bundle):
    root=Path(root); p=bundle["progress"]; repo=p.get("repository",{}); errors=[]
    if p.get("event_sequence") != 1683 or p.get("worker_lease",{}).get("lease_id") != WORKER or p.get("write_lease") is not None: errors.append("F18_R45C_REWORK_STATE_INVALID")
    if repo.get("projection_mode") != MODE or repo.get("product_write_scope") != []: errors.append("F18_R45C_REWORK_PROJECTION_INVALID")
    if not (root/MANIFEST).is_file(): errors.append("F18_R45C_REWORK_MANIFEST_MISSING")
    else:
        m=json.loads((root/MANIFEST).read_text(encoding="utf-8"))
        if m.get("event_sequence") != 1683 or m.get("projection_mode") != MODE or m.get("accepted") is not False: errors.append("F18_R45C_REWORK_MANIFEST_INVALID")
    errors.extend(collect_git(root)); return sorted(set(errors))

def materialize(root):
    root=Path(root); p=json.loads((root/"docs/progress/build-progress.json").read_text(encoding="utf-8")); ledger=json.loads((root/"docs/progress/progress-events.json").read_text(encoding="utf-8"))
    if p.get("event_sequence") != 1681 or p.get("repository",{}).get("projection_mode") != "F18_WSL_OPS_R45C_ROLLBACK_REHEARSAL_CLOSE" or p.get("worker_lease") is not None or p.get("write_lease") is not None:
        raise RuntimeError("F18_R45C_REWORK_PRECONDITION_INVALID")
    at=datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds"); rows=ledger["events"]; old=p["last_event_id"]
    wi_sha, inv_sha=_sha((root/WI).read_bytes()), _sha((root/INVOCATION).read_bytes())
    _event(rows,"WORK_INSTRUCTION_ISSUED",{"path":WI,"sha256":wi_sha,"invocation_path":INVOCATION,"invocation_sha256":inv_sha},at=at,step="WSL_OPS_R45C_REWORK")
    lease={"lease_id":WORKER,"actor_id":ACTOR,"subject_ref":"F-18/WSL_OPS_R45C_REWORK","status":"ACTIVE","issued_at":at,"expires_at":(datetime.now(timezone.utc)+timedelta(hours=12)).isoformat(timespec="seconds"),"lease_epoch":37,"fencing_token":TOKEN,"execution_fencing_token":TOKEN,"baseline_git_commit":_git(root,"rev-parse","HEAD"),"dispatch_head":_git(root,"rev-parse","HEAD"),"path_scope":[]}
    last=_event(rows,"WORKER_LEASE_ISSUED",{"lease_id":WORKER,"execution_fencing_token":TOKEN},at=at,step="WSL_OPS_R45C_REWORK")
    event_raw=_append_events_raw((root/"docs/progress/progress-events.json").read_bytes(),old,1681,rows[-2:]); p.update({"event_sequence":1683,"last_event_id":last["event_id"],"updated_at":at,"recorded_at":at,"worker_lease":lease,"write_lease":None,"next_safe_action":"MAIN_VERIFY_F18_R45C_REWORK","runtime_next_action":"MAIN_VERIFY_F18_R45C_REWORK"}); p["active_work_instruction"]={"artifact_id":"WI-F-18-WSL-OPS-R45C-REWORK-20260927-001","path":WI,"sha256":wi_sha,"invocation_path":INVOCATION,"invocation_sha256":inv_sha,"revision_classification":"MAIN_RECONFIRMED_NON_SEMANTIC","parent_approval_id":"APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001"}; p["repository"].update({"projection_mode":MODE,"worktree_status":"F18_WSL_OPS_R45C_REWORK_ACTIVE","control_qa_head":_git(root,"rev-parse","HEAD"),"product_write_scope":[]}); p["snapshot_hash"]=""; snap=deepcopy(p); p["snapshot_hash"]=_sha(_canonical(snap)); p_raw=_pretty(p); (root/"docs/progress/build-progress.json").write_bytes(p_raw); (root/"docs/progress/progress-events.json").write_bytes(event_raw)
    handoff=_pretty({"event_sequence":1683,"last_event_id":last["event_id"],"status":"ACTIVE","current_work_package":"F-18","active_agent":ACTOR,"worker_lease":lease,"write_lease":None,"next_safe_action":"MAIN_VERIFY_F18_R45C_REWORK","runtime_next_action":"MAIN_VERIFY_F18_R45C_REWORK"})
    (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(b"# F-18 R45C rollback rehearsal rework active\n\n```json anvil-recovery-summary\n"+handoff+b"```\n")
    (root/DIGEST).write_bytes(_pretty({"progress":{"path":"docs/progress/build-progress.json","bytes":len(p_raw),"file_sha256":_sha(p_raw)},"handoff":{"path":"docs/progress/BUILD_HANDOFF.md","bytes":len(handoff)+len(b"# F-18 R45C rollback rehearsal rework active\n\n")+1,"file_sha256":_sha((root/"docs/progress/BUILD_HANDOFF.md").read_bytes())}}))
    checks=[]
    for rel in control_paths():
        if rel in {"docs/progress/build-progress.json","docs/progress/progress-events.json","docs/progress/BUILD_HANDOFF.md",DIGEST,MANIFEST}: continue
        raw=(root/rel).read_bytes(); checks.append({"path":rel,"bytes":len(raw),"sha256":_sha(raw)})
    (root/MANIFEST).write_bytes(_pretty({"schema_version":"1.0.0","package_id":"F-18","event_sequence":1683,"accepted":False,"projection_mode":MODE,"product_write_scope":[],"raw_checksums":checks,"production":"NOT_EXECUTED"}))

if __name__ == "__main__":
    import sys
    materialize(Path(sys.argv[1] if len(sys.argv)>1 else "."))
