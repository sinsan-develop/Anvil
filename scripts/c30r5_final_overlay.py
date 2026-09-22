from __future__ import annotations
import hashlib,json,subprocess,sys
from copy import deepcopy
from pathlib import Path

MODE="C30R5_FINAL_ACCEPTANCE_EXACT15"; BASE="760e47ce250e8181fe1b8ee821123d49140c3e11"
ACCEPTED="f3eeb4c88cceb10c919242e4b0db1843aac8c699"
BRANCH="codex/c09-execution-backends-r1"; UPSTREAM="development/codex/c09-execution-backends-r1"; AT="2026-09-23T03:30:00+09:00"
WI1="docs/work_orders/C-30R5_MATRIX_CORRECTION_WORK_INSTRUCTION.md"; WI2="docs/work_orders/C-30R5_MATRIX_CORRECTION_WORK_INSTRUCTION_R2.md"; INV2="docs/work_orders/C-30R5_MATRIX_CORRECTION_INVOCATION_R2.md"
WI1H="4E215B4437E67B92F536A54D66B70893BEBAFA1F29FEA060794B6FB007D512A9"; WI2H="B14F3A0A253F5BE74194F2B4BC38483E855B62B0C7070D6614F061D19234B000"; INV2H="AAF9EAB6A74ECE89EEA12813E627C5E203E85C4131D6FFED2CF1A8156C7C9BAB"
PRODUCT="tests/integration/test_c30_contract_matrix.py"; PRODUCTH="02C99791E43DBFFEEECA823A6725EBE32C17BFDDCA8B347FF510F4A094855E3E"
WORKER="worker-lease-c30-final-gate-matrix-r1-20260923-001"; WRITE="write-lease-c30-final-gate-matrix-r1-20260923-001"
DIGEST="docs/progress/progress-handoff-detached-digest-c30r5-final.json"; MANIFEST="docs/evidence/manifests/C-30R5_FINAL_ACCEPTANCE_MANIFEST.json"
DEV="docs/04_test_reports/C-30R5_DEVELOPER_TEST_REPORT.md"; SPEC="docs/04_test_reports/C-30R5_SPEC_REVIEW.md"; QUALITY="docs/04_test_reports/C-30R5_QUALITY_REVIEW.md"
UNVERIFIED=["PROVIDER","PRODUCTION_AUTH","PG18","ACTUAL_SERVER_GENERATED_400","ORACLE"]

def controls(): return sorted(["docs/WORK_STATUS.md",DEV,SPEC,QUALITY,MANIFEST,"docs/progress/BUILD_HANDOFF.md","docs/progress/build-progress.json","docs/progress/progress-events.json",DIGEST,WI2,INV2,"scripts/check_project_progress.py","scripts/c30r5_final_overlay.py","tests/tooling/test_c30r5_final_overlay.py"])
def paths(): return sorted(controls()+[PRODUCT])
def recon_paths(): return sorted(["docs/WORK_STATUS.md",MANIFEST,"docs/progress/BUILD_HANDOFF.md","docs/progress/build-progress.json","docs/progress/progress-events.json",DIGEST,"scripts/c30r5_final_overlay.py",PRODUCT])
def canon(v): return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
def pretty(v): return (json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+"\n").encode()
def sha(raw): return hashlib.sha256(raw).hexdigest().upper()
def fsha(root,rel): return sha((root/rel).read_bytes())
def esha(e): return sha(canon(e))
def append(events,kind,details,subject="C-30R5"):
    seq=events[-1]["sequence"]+1
    events.append({"sequence":seq,"event_id":f"evt_c30r5_final_{seq}_{kind.lower()}","event_type":kind,"actor":"main-agent-eoul-takeover","actor_id":"main-agent-eoul-takeover","actor_type":"AGENT","project_id":"anvil","work_package_id":subject,"run_id":None,"step_id":"FINAL_ACCEPTANCE","subject_ref":subject,"occurred_at":AT,"previous_event_sha256":esha(events[-1]),"details":details})

def materialize(root):
    ep=root/"docs/progress/progress-events.json"; pp=root/"docs/progress/build-progress.json"
    base_events_raw=subprocess.check_output(["git","show",f"{BASE}:docs/progress/progress-events.json"],cwd=root)
    ledger=json.loads(base_events_raw); events=ledger["events"]
    p=json.loads(subprocess.check_output(["git","show",f"{BASE}:docs/progress/build-progress.json"],cwd=root))
    if p.get("event_sequence")!=1349 or events[-1].get("sequence")!=1349: raise RuntimeError("BASE_SEQUENCE")
    if (fsha(root,WI1),fsha(root,WI2),fsha(root,INV2),fsha(root,PRODUCT))!=(WI1H,WI2H,INV2H,PRODUCTH): raise RuntimeError("BOUND_HASH")
    append(events,"WORK_INSTRUCTION_REVISED",{"classification":"MAIN_RECONFIRMED_NON_SEMANTIC","scope_expansion":False,"parent_path":WI1,"parent_sha256":WI1H,"revised_path":WI2,"revised_sha256":WI2H,"invocation_path":INV2,"invocation_sha256":INV2H,"correction":"MATRIX_COUNT_18_TO_14_ONLY"})
    append(events,"PACKAGE_COMPLETED",{"result_status":"COMPLETED","product_path":PRODUCT,"product_sha256":PRODUCTH,"developer_report":DEV,"developer_report_sha256":fsha(root,DEV),"verification":{"focused":2,"matrix":14,"python_related":159,"web":88,"diff_check":"PASS"}})
    append(events,"INDEPENDENT_TEST_JUDGMENT_RECORDED",{"verdict":"ACCEPT","critical":0,"important":0,"minor":0,"spec_report":SPEC,"spec_report_sha256":fsha(root,SPEC),"quality_report":QUALITY,"quality_report_sha256":fsha(root,QUALITY)})
    append(events,"WRITE_LEASE_REVOKED",{"lease_id":WRITE,"reason":"C30R5_INDEPENDENT_ACCEPTANCE"}); append(events,"WORKER_LEASE_REVOKED",{"lease_id":WORKER,"reason":"C30R5_INDEPENDENT_ACCEPTANCE"})
    append(events,"MAIN_PACKAGE_ACCEPTED",{"decision":"ACCEPTED","package_id":"C-30R5","product_sha256":PRODUCTH,"unverified":UNVERIFIED})
    append(events,"PHASE_GATE_DECIDED",{"decision":"ACCEPTED","gate":"C30_FINAL_GATE","overall_c30_accepted":True,"scope":"CONTRACT_MATRIX_AND_RECORDED_EVIDENCE_ONLY","unverified":UNVERIFIED},"C-30")
    ow,ox=deepcopy(p["worker_lease"]),deepcopy(p["write_lease"]); ow["status"]="REVOKED"; ox["status"]="REVOKED"
    p.update({"event_sequence":1356,"last_event_id":events[-1]["event_id"],"updated_at":AT,"recorded_at":AT,"status":"ACCEPTED","current_work_package":"C-30","active_agent":None,"worker_lease":None,"write_lease":None,"active_work_instruction":None,"completed_c30r5_worker_lease":ow,"completed_c30r5_write_lease":ox,"c30_overall_status":"ACCEPTED","next_work_package":{"package_id":"C-30","status":"ACCEPTED"},"next_successor_work_package":None,"next_safe_action":"C30_FINAL_CHECKPOINT_COMMIT_PUSH","runtime_next_action":"C30_FINAL_CHECKPOINT_COMMIT_PUSH","pending_approvals":[],"c30_final_gate":{"decision":"ACCEPTED","event_sequence":1356,"scope":"CONTRACT_MATRIX_AND_RECORDED_EVIDENCE_ONLY","unverified":UNVERIFIED},"last_completed_work_instruction":{"work_package_id":"C-30R5","artifact_path":WI2,"artifact_sha256":WI2H,"invocation_path":INV2,"invocation_sha256":INV2H,"status":"ACCEPTED","result_status":"COMPLETED","accepted":True}})
    if "C-30R5" not in p["completed_packages"]: p["completed_packages"].append("C-30R5")
    p["repository"].update({"local_head":BASE,"remote_head":BASE,"control_head":BASE,"projection_mode":MODE,"validated_base_commit":BASE,"head_relation":"PRECOMMIT_OR_SOLE_DIRECT_CHILD","exact_allowed_paths":paths(),"product_write_scope":[PRODUCT],"worktree_status":"UNSTAGED_C30R5_FINAL_EXACT15","commit_status":"NOT_EXECUTED","push_status":"NOT_EXECUTED","remote_evidence":"LIVE_REMOTE_BASE_VERIFIED"})
    p["latest_evidence_refs"]=[{"path":WI2,"sha256":WI2H},{"path":INV2,"sha256":INV2H}]+[{"path":x,"sha256":fsha(root,x)} for x in (DEV,SPEC,QUALITY)]
    p["current_progress_evidence_ref"]={"package_id":"C-30R5","path":DIGEST,"manifest_path":MANIFEST}; p["latest_evidence_manifest_ref"]={"path":MANIFEST,"artifact_id":"C30R5-FINAL-20260923"}
    m=dict(p); m.pop("snapshot_hash",None); p["snapshot_hash"]=sha(canon(m)); praw=pretty(p)
    new_raw=b",\n"+b",\n".join(pretty(x).rstrip(b"\n") for x in events[-7:])
    marker=b'\n  ],\n  "last_event_id": "evt_c30r5_1349_package_started"'
    assert base_events_raw.count(marker)==1
    eraw=base_events_raw.replace(marker,new_raw+marker.replace(b"evt_c30r5_1349_package_started",events[-1]["event_id"].encode()))
    eraw=eraw.replace(b'"last_sequence": 1349',b'"last_sequence": 1356',1)
    summary={k:p.get(k) for k in ("event_sequence","last_event_id","status","current_phase","current_work_package","active_agent","worker_lease","write_lease","next_work_package","next_successor_work_package","next_safe_action","runtime_next_action")}; summary.update({"c30_overall_status":"ACCEPTED","repository_head":BASE,"repository_upstream":UPSTREAM,"unverified":UNVERIFIED})
    hraw=("# C30R5 final acceptance\n\n```json anvil-recovery-summary\n"+pretty(summary).decode()+"```\n").encode()
    digest={"schema_version":"1.0.0","algorithm":"SHA-256","event_sequence":1356,"self_reference":False,"progress":{"path":"docs/progress/build-progress.json","bytes":len(praw),"file_sha256":sha(praw),"canonical_json_sha256":sha(canon(p))},"handoff":{"path":"docs/progress/BUILD_HANDOFF.md","bytes":len(hraw),"file_sha256":sha(hraw),"machine_summary_canonical_sha256":sha(canon(summary))}}
    ws=("# C-30R5 final acceptance / 2026-09-23\n\n- 판정: `ACCEPTED`; C30 contract matrix와 기록된 evidence 범위의 final gate를 통과했다.\n- R2는 matrix 수량 오기 `18→14`만 비의미 정정했고, spec/quality C0/I0/M0이다.\n- 미검증 경계: Provider, production auth, PG18, actual server-generated 400, Oracle.\n- 다음 조치: exact15 checkpoint commit/push 후 remote SHA와 clean worktree를 재확인한다.\n\n").encode()+subprocess.check_output(["git","show",f"{BASE}:docs/WORK_STATUS.md"],cwd=root)
    pp.write_bytes(praw); ep.write_bytes(eraw); (root/"docs/progress/BUILD_HANDOFF.md").write_bytes(hraw); (root/DIGEST).write_bytes(pretty(digest)); (root/"docs/WORK_STATUS.md").write_bytes(ws)
    checks=[]
    for rel in paths():
        if rel!=MANIFEST:
            raw=(root/rel).read_bytes(); checks.append({"path":rel,"bytes":len(raw),"sha256":sha(raw)})
    manifest={"schema_version":"1.0.0","manifest_type":"C30R5_FINAL_ACCEPTANCE","artifact_id":"C30R5-FINAL-20260923","package_id":"C-30R5","event_sequence":1356,"historical_event_sequence":1349,"appended_event_count":7,"accepted":True,"status":"ACCEPTED","projection_mode":MODE,"validated_base_commit":BASE,"exact_allowed_paths":paths(),"control_paths":controls(),"product_write_scope":[PRODUCT],"authority":{WI1:WI1H,WI2:WI2H,INV2:INV2H},"verification":{"focused":2,"matrix":14,"python_related":159,"web":88,"spec":"ACCEPT_C0_I0_M0","quality":"ACCEPT_C0_I0_M0"},"unverified":UNVERIFIED,"raw_checksums":checks,"self_reference":False}
    (root/MANIFEST).write_bytes(pretty(manifest))

def gitv(root):
    try:
        g=lambda *a: subprocess.check_output(["git",*a],cwd=root,text=True).strip(); head=g("rev-parse","HEAD"); remote=g("rev-parse","@{u}"); branch=g("branch","--show-current"); up=g("rev-parse","--abbrev-ref","--symbolic-full-name","@{u}")
        staged=set(filter(None,g("-c","core.excludesFile=","diff","--cached","--name-only").splitlines())); lines=subprocess.check_output(["git","-c","core.excludesFile=","status","--porcelain=v1","--untracked-files=all"],cwd=root,text=True).splitlines(); dirty={x[3:].replace("\\","/") for x in lines}
        pre=head==BASE and remote==BASE and dirty==set(paths()); post=head==ACCEPTED and g("rev-parse","HEAD^")==BASE and remote in {BASE,head} and not dirty
        if post: post=set(filter(None,g("diff","--name-only",f"{BASE}..HEAD").splitlines()))==set(paths())
        recon_pre=head==ACCEPTED and remote==ACCEPTED and dirty==set(recon_paths())
        recon_post=head not in {BASE,ACCEPTED} and g("rev-parse","HEAD^")==ACCEPTED and remote in {ACCEPTED,head} and not dirty
        if recon_post: recon_post=set(filter(None,g("diff","--name-only",f"{ACCEPTED}..HEAD").splitlines()))==set(recon_paths())
        return [] if branch==BRANCH and up==UPSTREAM and not staged and (pre or post or recon_pre or recon_post) else ["C30R5_FINAL_GIT_INVALID"]
    except Exception:return ["C30R5_FINAL_GIT_COLLECTION_FAILED"]

def validate(root,b):
    e=[]
    try:
        p=b["progress"]; event_value=b["events"]; events=event_value["events"] if isinstance(event_value,dict) else event_value; man=json.loads((root/MANIFEST).read_text(encoding="utf-8")); d=json.loads((root/DIGEST).read_text(encoding="utf-8"))
        reconciled=events[-1].get("event_type")=="REPOSITORY_RECONCILED"; final_events=events[-8:-1] if reconciled else events[-7:]; types=[x.get("event_type") for x in final_events]
        if types!=["WORK_INSTRUCTION_REVISED","PACKAGE_COMPLETED","INDEPENDENT_TEST_JUDGMENT_RECORDED","WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","MAIN_PACKAGE_ACCEPTED","PHASE_GATE_DECIDED"]:e.append("C30R5_FINAL_EVENT_TAIL_INVALID")
        r=final_events[0].get("details",{}); state=(p.get("event_sequence") in {1356,1357} and p.get("status")=="ACCEPTED" and p.get("c30_overall_status")=="ACCEPTED" and p.get("worker_lease") is None and p.get("write_lease") is None and p.get("active_work_instruction") is None and "C-30R5" in p.get("completed_packages",[]) and man.get("accepted") is True and man.get("exact_allowed_paths")==paths() and man.get("unverified")==UNVERIFIED)
        if (r.get("parent_sha256"),r.get("revised_sha256"),r.get("invocation_sha256"))!=(WI1H,WI2H,INV2H):e.append("C30R5_FINAL_REVISION_BINDING_INVALID")
        if not state:e.append("C30R5_FINAL_STATE_INVALID")
        for row in man.get("raw_checksums",[]):
            raw=(root/row["path"]).read_bytes()
            if (len(raw),sha(raw))!=(row["bytes"],row["sha256"]):e.append("C30R5_FINAL_RAW_CHECKSUM_INVALID");break
        pr=(root/"docs/progress/build-progress.json").read_bytes(); hr=(root/"docs/progress/BUILD_HANDOFF.md").read_bytes()
        if (len(pr),sha(pr))!=(d["progress"]["bytes"],d["progress"]["file_sha256"]):e.append("C30R5_FINAL_PROGRESS_DIGEST_INVALID")
        if (len(hr),sha(hr))!=(d["handoff"]["bytes"],d["handoff"]["file_sha256"]):e.append("C30R5_FINAL_HANDOFF_DIGEST_INVALID")
        e+=gitv(root)
    except Exception:e.append("C30R5_FINAL_INPUT_INVALID")
    return sorted(set(e))

def reconcile(root):
    ep=root/"docs/progress/progress-events.json"; pp=root/"docs/progress/build-progress.json"; hp=root/"docs/progress/BUILD_HANDOFF.md"
    base_raw=subprocess.check_output(["git","show",f"{ACCEPTED}:docs/progress/progress-events.json"],cwd=root); ledger=json.loads(base_raw); events=ledger["events"]
    p=json.loads(subprocess.check_output(["git","show",f"{ACCEPTED}:docs/progress/build-progress.json"],cwd=root))
    if p.get("event_sequence")!=1356 or events[-1].get("sequence")!=1356: raise RuntimeError("RECON_BASE")
    append(events,"REPOSITORY_RECONCILED",{"accepted_checkpoint":ACCEPTED,"branch":BRANCH,"upstream":UPSTREAM,"push":"PASS","remote_sha":"MATCH","worktree":"CLEAN"},"C-30")
    p.update({"event_sequence":1357,"last_event_id":events[-1]["event_id"],"updated_at":"2026-09-23T03:50:00+09:00","recorded_at":"2026-09-23T03:50:00+09:00","next_safe_action":"C30_WORK_PLAN_COMPLETE","runtime_next_action":"C30_WORK_PLAN_COMPLETE"})
    p["repository"].update({"local_head":ACCEPTED,"remote_head":ACCEPTED,"control_head":ACCEPTED,"head_relation":"POSTCOMMIT_RECONCILIATION_CHILD","worktree_status":"CLEAN","commit_status":"PASS","push_status":"PASS","remote_evidence":"LIVE_REMOTE_SHA_MATCH"})
    m=dict(p); m.pop("snapshot_hash",None); p["snapshot_hash"]=sha(canon(m)); praw=pretty(p)
    event_raw=pretty(events[-1]).rstrip(b"\n"); old_id=json.loads(base_raw)["last_event_id"].encode(); marker=b'\n  ],\n  "last_event_id": "'+old_id+b'"'; assert base_raw.count(marker)==1
    eraw=base_raw.replace(marker,b",\n"+event_raw+marker.replace(old_id,events[-1]["event_id"].encode())).replace(b'"last_sequence": 1356',b'"last_sequence": 1357',1)
    summary={k:p.get(k) for k in ("event_sequence","last_event_id","status","current_phase","current_work_package","active_agent","worker_lease","write_lease","next_work_package","next_successor_work_package","next_safe_action","runtime_next_action")}; summary.update({"c30_overall_status":"ACCEPTED","repository_head":ACCEPTED,"repository_upstream":UPSTREAM,"unverified":UNVERIFIED})
    hraw=("# C30R5 final acceptance — remote checkpoint reconciled\n\n```json anvil-recovery-summary\n"+pretty(summary).decode()+"```\n").encode()
    d={"schema_version":"1.0.0","algorithm":"SHA-256","event_sequence":1357,"self_reference":False,"progress":{"path":"docs/progress/build-progress.json","bytes":len(praw),"file_sha256":sha(praw),"canonical_json_sha256":sha(canon(p))},"handoff":{"path":"docs/progress/BUILD_HANDOFF.md","bytes":len(hraw),"file_sha256":sha(hraw),"machine_summary_canonical_sha256":sha(canon(summary))}}
    ws=("# C-30R5 remote checkpoint reconciliation / 2026-09-23\n\n- 판정: `PASS`; accepted checkpoint `f3eeb4c88cceb10c919242e4b0db1843aac8c699`와 원격 branch SHA가 일치한다.\n- worktree는 checkpoint 직후 clean이며 C30 작업계획은 완료 상태다.\n\n").encode()+subprocess.check_output(["git","show",f"{ACCEPTED}:docs/WORK_STATUS.md"],cwd=root)
    pp.write_bytes(praw); ep.write_bytes(eraw); hp.write_bytes(hraw); (root/DIGEST).write_bytes(pretty(d)); (root/"docs/WORK_STATUS.md").write_bytes(ws)
    man=json.loads(subprocess.check_output(["git","show",f"{ACCEPTED}:{MANIFEST}"],cwd=root)); man.update({"event_sequence":1357,"appended_event_count":8,"repository_reconciliation":{"accepted_checkpoint":ACCEPTED,"push":"PASS","remote_sha":"MATCH","worktree":"CLEAN"}})
    rows=[]
    for rel in paths():
        if rel!=MANIFEST:
            raw=(root/rel).read_bytes(); rows.append({"path":rel,"bytes":len(raw),"sha256":sha(raw)})
    man["raw_checksums"]=rows; (root/MANIFEST).write_bytes(pretty(man))

if __name__=="__main__":
    root=Path(__file__).resolve().parents[1]
    reconcile(root) if "--reconcile" in sys.argv else materialize(root)
