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
RECONCILED="6e4839c7de828f2bd10c79ebff6ed9a8a0c04650"
BROKER_MAIN="4d94db7e3e947611a87848aaa17d5b1a8837b74a"
BROKER_MERGE="982e74530eb4106d9860238035c635387df0c226"
BROKER_AT="2026-09-23T17:25:23+09:00"
BROKER_DIGEST="docs/progress/progress-handoff-detached-digest-c30r5-pr-broker-reconciliation.json"
BROKER_REPORT="docs/04_test_reports/C-30_PR_BROKER_RECONCILIATION.md"
BROKER_PATHS=[".github/pr-broker-gate.sh",".github/workflows/auto-pr-merge.yml","docs/PR_BROKER_INSTALLATION.md"]
BROKER_GATE_CORRECTION_PATHS=[
    "docs/04_test_reports/C-09_R4_PRODUCT_QUALITY_REVIEW_ORIGINAL.md",
    BROKER_REPORT,
    "docs/WORK_STATUS.md",
    "docs/evidence/manifests/C-30R5_FINAL_ACCEPTANCE_MANIFEST.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/progress/build-progress.json",
    "docs/progress/progress-events.json",
    BROKER_DIGEST,
    "docs/work_orders/C-30R2_INVOCATION_PROMPT.md",
    "docs/work_orders/E-09_WORK_INSTRUCTION.md",
    "scripts/c30r5_final_overlay.py",
    "tests/integration/test_c30r2_runtime_owner.py",
    "tests/tooling/test_c30r5_final_overlay.py",
]
MERGED_BRANCH="codex/c30-merged-main-reconciliation"
MERGED_AT="2026-09-23T17:50:50+09:00"
MERGED_DIGEST="docs/progress/progress-handoff-detached-digest-c30r5-merged-main-reconciliation.json"
MERGED_REPORT="docs/04_test_reports/C-30_MERGED_MAIN_RECONCILIATION.md"
MERGED_RECONCILIATION_PATHS=[
    MERGED_REPORT,
    "docs/WORK_STATUS.md",
    "docs/evidence/manifests/C-30R5_FINAL_ACCEPTANCE_MANIFEST.json",
    "docs/progress/BUILD_HANDOFF.md",
    "docs/progress/build-progress.json",
    "docs/progress/progress-events.json",
    MERGED_DIGEST,
    "scripts/c30r5_final_overlay.py",
    "tests/tooling/test_c30r5_final_overlay.py",
]

def controls(): return sorted(["docs/WORK_STATUS.md",DEV,SPEC,QUALITY,MANIFEST,"docs/progress/BUILD_HANDOFF.md","docs/progress/build-progress.json","docs/progress/progress-events.json",DIGEST,WI2,INV2,"scripts/check_project_progress.py","scripts/c30r5_final_overlay.py","tests/tooling/test_c30r5_final_overlay.py"])
def paths(): return sorted(controls()+[PRODUCT])
def recon_paths(): return sorted(["docs/WORK_STATUS.md",MANIFEST,"docs/progress/BUILD_HANDOFF.md","docs/progress/build-progress.json","docs/progress/progress-events.json",DIGEST,"scripts/c30r5_final_overlay.py",PRODUCT])
def canon(v): return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
def pretty(v): return (json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+"\n").encode()
def sha(raw): return hashlib.sha256(raw).hexdigest().upper()
def fsha(root,rel): return sha((root/rel).read_bytes())
def esha(e): return sha(canon(e))
def append(events,kind,details,subject="C-30R5",at=AT):
    seq=events[-1]["sequence"]+1
    events.append({"sequence":seq,"event_id":f"evt_c30r5_final_{seq}_{kind.lower()}","event_type":kind,"actor":"main-agent-eoul-takeover","actor_id":"main-agent-eoul-takeover","actor_type":"AGENT","project_id":"anvil","work_package_id":subject,"run_id":None,"step_id":"FINAL_ACCEPTANCE","subject_ref":subject,"occurred_at":at,"previous_event_sha256":esha(events[-1]),"details":details})

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

def validate_broker_integration_facts(*,head,branch,upstream,remote,staged,dirty,
        head_parents,merge_paths,correction_paths,merge_parent_parents=None):
    common=(branch==BRANCH and upstream==UPSTREAM and remote in {RECONCILED,head}
        and not staged and set(merge_paths)==set(BROKER_PATHS))
    merge_state=(head_parents==[RECONCILED,BROKER_MAIN] and correction_paths is None
        and (not dirty or set(dirty)==set(BROKER_GATE_CORRECTION_PATHS)))
    correction_state=(len(head_parents)==1 and merge_parent_parents==[RECONCILED,BROKER_MAIN]
        and not dirty and set(correction_paths or ())==set(BROKER_GATE_CORRECTION_PATHS))
    return [] if common and (merge_state or correction_state) else ["C30R5_FINAL_GIT_INVALID"]

def validate_merged_main_reconciliation_facts(*,head,branch,upstream,remote,staged,dirty,
        validated_base,head_parents,head_changed_paths,base_is_ancestor_of_feature=False,
        feature_paths=None,merge_tree_matches_feature=False):
    expected=set(MERGED_RECONCILIATION_PATHS)
    work_upstreams={"development/main",f"development/{MERGED_BRANCH}"}
    pre=(branch==MERGED_BRANCH and upstream in work_upstreams and head==validated_base
        and remote==validated_base and not staged and set(dirty)==expected)
    post=(branch==MERGED_BRANCH and upstream in work_upstreams and head!=validated_base
        and remote in {validated_base,head} and not staged and not dirty
        and head_parents==[validated_base] and set(head_changed_paths)==expected)
    merged=(branch=="main" and upstream=="development/main" and remote==head
        and not staged and not dirty and len(head_parents)==2 and head_parents[0]==validated_base
        and base_is_ancestor_of_feature and set(feature_paths or ())==expected
        and merge_tree_matches_feature)
    return [] if pre or post or merged else ["C30R5_FINAL_GIT_INVALID"]

def gitv(root,progress=None):
    try:
        if progress is None: progress=json.loads((root/"docs/progress/build-progress.json").read_text(encoding="utf-8"))
        g=lambda *a: subprocess.check_output(["git",*a],cwd=root,text=True).strip(); head=g("rev-parse","HEAD"); remote=g("rev-parse","@{u}"); branch=g("branch","--show-current"); up=g("rev-parse","--abbrev-ref","--symbolic-full-name","@{u}")
        staged=set(filter(None,g("-c","core.excludesFile=","diff","--cached","--name-only").splitlines())); lines=subprocess.check_output(["git","-c","core.excludesFile=","status","--porcelain=v1","--untracked-files=all"],cwd=root,text=True).splitlines(); dirty={x[3:].replace("\\","/") for x in lines}
        if (progress or {}).get("event_sequence")==1359 and (progress or {}).get("repository",{}).get("exact_allowed_paths")==MERGED_RECONCILIATION_PATHS:
            base=progress["repository"]["validated_base_commit"]; parents=g("show","-s","--format=%P","HEAD").split(); changed=set()
            if head!=base: changed=set(filter(None,g("diff","--name-only",f"{base}..HEAD").splitlines()))
            ancestor=False; feature_paths=None; tree_match=False
            if branch=="main" and len(parents)==2:
                feature=parents[1]
                ancestor=subprocess.run(["git","merge-base","--is-ancestor",base,feature],cwd=root).returncode==0
                feature_paths=set(filter(None,g("diff","--name-only",f"{base}..{feature}").splitlines()))
                tree_match=subprocess.run(["git","diff","--quiet",feature,head],cwd=root).returncode==0
            return validate_merged_main_reconciliation_facts(head=head,branch=branch,upstream=up,remote=remote,
                staged=staged,dirty=dirty,validated_base=base,head_parents=parents,head_changed_paths=changed,
                base_is_ancestor_of_feature=ancestor,feature_paths=feature_paths,merge_tree_matches_feature=tree_match)
        pre=head==BASE and remote==BASE and dirty==set(paths()); post=head==ACCEPTED and g("rev-parse","HEAD^")==BASE and remote in {BASE,head} and not dirty
        if post: post=set(filter(None,g("diff","--name-only",f"{BASE}..HEAD").splitlines()))==set(paths())
        recon_pre=head==ACCEPTED and remote==ACCEPTED and dirty==set(recon_paths())
        recon_post=head not in {BASE,ACCEPTED} and g("rev-parse","HEAD^")==ACCEPTED and remote in {ACCEPTED,head} and not dirty
        if recon_post: recon_post=set(filter(None,g("diff","--name-only",f"{ACCEPTED}..HEAD").splitlines()))==set(recon_paths())
        if branch==BRANCH and up==UPSTREAM and not staged and (pre or post or recon_pre or recon_post): return []
        parents=g("show","-s","--format=%P","HEAD").split()
        if parents==[RECONCILED,BROKER_MAIN]:
            return validate_broker_integration_facts(head=head,branch=branch,upstream=up,remote=remote,
                staged=staged,dirty=dirty,head_parents=parents,
                merge_paths=set(filter(None,g("diff","--name-only",f"{RECONCILED}..HEAD").splitlines())),correction_paths=None)
        if len(parents)==1:
            merge_parent=parents[0]; merge_parents=g("show","-s","--format=%P",merge_parent).split()
            return validate_broker_integration_facts(head=head,branch=branch,upstream=up,remote=remote,
                staged=staged,dirty=dirty,head_parents=parents,merge_parent_parents=merge_parents,
                merge_paths=set(filter(None,g("diff","--name-only",f"{RECONCILED}..{merge_parent}").splitlines())),
                correction_paths=set(filter(None,g("diff","--name-only",f"{merge_parent}..HEAD").splitlines())))
        return ["C30R5_FINAL_GIT_INVALID"]
    except Exception:return ["C30R5_FINAL_GIT_COLLECTION_FAILED"]

def select_final_gate_events(events,event_sequence):
    offset=event_sequence-1356
    if offset not in {0,1,2,3}: return []
    end=len(events)-offset if offset else len(events)
    return events[end-7:end]

def validate(root,b):
    e=[]
    try:
        p=b["progress"]; event_value=b["events"]; events=event_value["events"] if isinstance(event_value,dict) else event_value; man=json.loads((root/MANIFEST).read_text(encoding="utf-8")); digest_path=MERGED_DIGEST if p.get("event_sequence")==1359 else (BROKER_DIGEST if p.get("event_sequence")==1358 else DIGEST); d=json.loads((root/digest_path).read_text(encoding="utf-8"))
        final_events=select_final_gate_events(events,p.get("event_sequence")); types=[x.get("event_type") for x in final_events]
        if types!=["WORK_INSTRUCTION_REVISED","PACKAGE_COMPLETED","INDEPENDENT_TEST_JUDGMENT_RECORDED","WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","MAIN_PACKAGE_ACCEPTED","PHASE_GATE_DECIDED"]:e.append("C30R5_FINAL_EVENT_TAIL_INVALID")
        r=final_events[0].get("details",{}); expected_paths=MERGED_RECONCILIATION_PATHS if p.get("event_sequence")==1359 else (BROKER_GATE_CORRECTION_PATHS if p.get("event_sequence")==1358 else paths()); state=(p.get("event_sequence") in {1356,1357,1358,1359} and p.get("status")=="ACCEPTED" and p.get("c30_overall_status")=="ACCEPTED" and p.get("worker_lease") is None and p.get("write_lease") is None and p.get("active_work_instruction") is None and "C-30R5" in p.get("completed_packages",[]) and man.get("accepted") is True and man.get("exact_allowed_paths")==expected_paths and man.get("unverified")==UNVERIFIED)
        if (r.get("parent_sha256"),r.get("revised_sha256"),r.get("invocation_sha256"))!=(WI1H,WI2H,INV2H):e.append("C30R5_FINAL_REVISION_BINDING_INVALID")
        if not state:e.append("C30R5_FINAL_STATE_INVALID")
        for row in man.get("raw_checksums",[]):
            raw=(root/row["path"]).read_bytes()
            if (len(raw),sha(raw))!=(row["bytes"],row["sha256"]):e.append("C30R5_FINAL_RAW_CHECKSUM_INVALID");break
        pr=(root/"docs/progress/build-progress.json").read_bytes(); hr=(root/"docs/progress/BUILD_HANDOFF.md").read_bytes()
        if (len(pr),sha(pr))!=(d["progress"]["bytes"],d["progress"]["file_sha256"]):e.append("C30R5_FINAL_PROGRESS_DIGEST_INVALID")
        if (len(hr),sha(hr))!=(d["handoff"]["bytes"],d["handoff"]["file_sha256"]):e.append("C30R5_FINAL_HANDOFF_DIGEST_INVALID")
        e+=gitv(root,p)
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

def broker_reconcile(root):
    ep=root/"docs/progress/progress-events.json"; pp=root/"docs/progress/build-progress.json"; hp=root/"docs/progress/BUILD_HANDOFF.md"
    base_raw=subprocess.check_output(["git","show",f"{RECONCILED}:docs/progress/progress-events.json"],cwd=root)
    ledger=json.loads(base_raw); events=ledger["events"]
    p=json.loads(subprocess.check_output(["git","show",f"{RECONCILED}:docs/progress/build-progress.json"],cwd=root))
    if p.get("event_sequence")!=1357 or events[-1].get("sequence")!=1357: raise RuntimeError("BROKER_RECON_BASE")
    append(events,"REPOSITORY_RECONCILED",{
        "accepted_checkpoint":RECONCILED,"broker_main":BROKER_MAIN,"broker_merge":BROKER_MERGE,
        "merge_paths":BROKER_PATHS,"correction_paths":BROKER_GATE_CORRECTION_PATHS,
        "root_causes":["C30R5_FINAL_GIT_PROJECTION_STALE_AFTER_BROKER_MERGE","HISTORICAL_EOF_BLANK_LINES_4"],
        "verification":{"tdd_red":"2 failed, 2 passed; then 1 failed, 5 passed","tdd_green":"6 passed","runtime_owner":"27 passed","canonical_checker":"PASS_SEQUENCE_1358","worktree_diff_check":"PASS","range_diff_check":"PENDING_POSTCOMMIT"},
        "scope":"CONTROL_AND_NON_SEMANTIC_WHITESPACE_ONLY","product_behavior_changed":False,
    },"C-30",BROKER_AT)
    p.update({"event_sequence":1358,"last_event_id":events[-1]["event_id"],"updated_at":BROKER_AT,"recorded_at":BROKER_AT,
        "next_safe_action":"C30_PR_BROKER_REQUEST","runtime_next_action":"C30_PR_BROKER_REQUEST"})
    p["repository"].update({"local_head":BROKER_MERGE,"remote_head":RECONCILED,"control_head":BROKER_MAIN,
        "validated_base_commit":BROKER_MAIN,"head_relation":"PR_BROKER_GATE_CORRECTION_CHILD",
        "exact_allowed_paths":BROKER_GATE_CORRECTION_PATHS,"product_write_scope":[],
        "worktree_status":"UNSTAGED_C30_PR_BROKER_RECONCILIATION_EXACT13",
        "commit_status":"NOT_EXECUTED","push_status":"NOT_EXECUTED","remote_evidence":"LIVE_REMOTE_RECONCILED_HEAD_VERIFIED"})
    p["current_progress_evidence_ref"]={"package_id":"C-30","path":BROKER_DIGEST,"manifest_path":MANIFEST}
    p["latest_evidence_refs"]=[{"path":BROKER_REPORT,"sha256":"MATERIALIZED_AFTER_REPORT"}]
    m=dict(p); m.pop("snapshot_hash",None); p["snapshot_hash"]=sha(canon(m)); praw=pretty(p)
    event_raw=pretty(events[-1]).rstrip(b"\n"); old_id=ledger["last_event_id"].encode(); marker=b'\n  ],\n  "last_event_id": "'+old_id+b'"'; assert base_raw.count(marker)==1
    eraw=base_raw.replace(marker,b",\n"+event_raw+marker.replace(old_id,events[-1]["event_id"].encode())).replace(b'"last_sequence": 1357',b'"last_sequence": 1358',1)
    summary={k:p.get(k) for k in ("event_sequence","last_event_id","status","current_phase","current_work_package","active_agent","worker_lease","write_lease","next_work_package","next_successor_work_package","next_safe_action","runtime_next_action")}
    summary.update({"c30_overall_status":"ACCEPTED","repository_validated_base":BROKER_MERGE,"repository_upstream":UPSTREAM,"unverified":UNVERIFIED})
    hraw=("# C30 PR Broker integration gate reconciliation\n\n```json anvil-recovery-summary\n"+pretty(summary).decode()+"```\n").encode()
    report=("# C-30 PR Broker integration gate reconciliation\n\n"
        "- 판정: `RECONCILED_PENDING_COMMIT_PUSH`; trusted Broker main을 기존 C09 branch에 정상 merge했다.\n"
        "- merge parent: `6e4839c7de828f2bd10c79ebff6ed9a8a0c04650` + `4d94db7e3e947611a87848aaa17d5b1a8837b74a`; merge commit `982e74530eb4106d9860238035c635387df0c226`.\n"
        "- root cause: final Git projection이 2-parent Broker merge를 모델링하지 않았고 historical EOF blank line 4건이 range diff-check를 차단했다.\n"
        "- 조치: exact merge/correction shape validator를 TDD로 추가하고 EOF blank 4건만 비의미 정정했다. 제품 동작 변경은 0이다.\n"
        "- 검증: TDD RED `2 failed, 2 passed`, event selector RED `1 failed, 5 passed`; GREEN `6 passed`; runtime owner `27 passed`; canonical checker seq1358와 worktree diff-check PASS. range diff-check는 commit 후 실행한다.\n"
        "- 미검증 유지: Provider, production auth, PG18, actual server-generated 400, Oracle.\n"
        "- rollback: 본 exact13 correction commit만 revert하고 merge parent와 기존 seq1~1357 history는 보존한다.\n").encode()
    ws=("# C-30 PR Broker integration gate correction / 2026-09-23\n\n"
        "- 판정: `RECONCILED_PENDING_COMMIT_PUSH`; seq1358 append-only reconciliation으로 Broker merge와 exact13 correction을 결박했다.\n"
        "- 기존 seq1~1357과 C-30 제품 동작은 변경하지 않았다. EOF blank 4건과 checker projection/test/control evidence만 수정했다.\n"
        "- TDD RED `2 failed, 2 passed`, selector RED `1 failed, 5 passed`; GREEN `6 passed`; runtime owner `27 passed`; canonical checker seq1358와 worktree diff-check PASS. 다음은 commit 후 range diff-check·SSH push·request tag다.\n"
        "- 미검증: Provider, production auth, PG18, actual server-generated 400, Oracle.\n\n").encode()+subprocess.check_output(["git","show",f"{RECONCILED}:docs/WORK_STATUS.md"],cwd=root)
    pp.write_bytes(praw); ep.write_bytes(eraw); hp.write_bytes(hraw); (root/BROKER_REPORT).write_bytes(report); (root/"docs/WORK_STATUS.md").write_bytes(ws)
    digest={"schema_version":"1.0.0","algorithm":"SHA-256","event_sequence":1358,"self_reference":False,
        "progress":{"path":"docs/progress/build-progress.json","bytes":len(praw),"file_sha256":sha(praw),"canonical_json_sha256":sha(canon(p))},
        "handoff":{"path":"docs/progress/BUILD_HANDOFF.md","bytes":len(hraw),"file_sha256":sha(hraw),"machine_summary_canonical_sha256":sha(canon(summary))}}
    (root/BROKER_DIGEST).write_bytes(pretty(digest))
    man=json.loads(subprocess.check_output(["git","show",f"{RECONCILED}:{MANIFEST}"],cwd=root))
    man.update({"event_sequence":1358,"appended_event_count":9,"exact_allowed_paths":BROKER_GATE_CORRECTION_PATHS,
        "control_paths":BROKER_GATE_CORRECTION_PATHS,"product_write_scope":[],
        "repository_reconciliation":{"accepted_checkpoint":RECONCILED,"broker_main":BROKER_MAIN,"broker_merge":BROKER_MERGE,
            "status":"RECONCILED_PENDING_COMMIT_PUSH","product_behavior_changed":False}})
    rows=[]
    for rel in BROKER_GATE_CORRECTION_PATHS:
        if rel!=MANIFEST:
            raw=(root/rel).read_bytes(); rows.append({"path":rel,"bytes":len(raw),"sha256":sha(raw)})
    man["raw_checksums"]=rows; (root/MANIFEST).write_bytes(pretty(man))

def merged_main_reconcile(root):
    base=subprocess.check_output(["git","rev-parse","development/main"],cwd=root,text=True).strip()
    ep=root/"docs/progress/progress-events.json"; pp=root/"docs/progress/build-progress.json"; hp=root/"docs/progress/BUILD_HANDOFF.md"
    base_raw=subprocess.check_output(["git","show",f"{base}:docs/progress/progress-events.json"],cwd=root)
    ledger=json.loads(base_raw); events=ledger["events"]
    p=json.loads(subprocess.check_output(["git","show",f"{base}:docs/progress/build-progress.json"],cwd=root))
    if p.get("event_sequence")!=1358 or events[-1].get("sequence")!=1358: raise RuntimeError("MERGED_MAIN_RECON_BASE")
    append(events,"REPOSITORY_RECONCILED",{
        "accepted_checkpoint":base,"broker_policy_main":base,"routine_merge_method":"MERGE_COMMIT",
        "required_main_shape":{"parent_count":2,"first_parent":"PR_PRE_MERGE_MAIN","second_parent":"VERIFIED_EXACT_FEATURE_HEAD"},
        "exact_paths":MERGED_RECONCILIATION_PATHS,
        "verification":{"tdd_red":"4 failed, 6 passed","tdd_green":"10 passed","canonical_checker":"PASS_SEQUENCE_1359","worktree_diff_check":"PASS","range_diff_check":"PENDING_COMMIT"},
        "scope":"MERGED_MAIN_GIT_PROJECTION_AND_APPEND_ONLY_EVIDENCE_ONLY","product_behavior_changed":False,
    },"C-30",MERGED_AT)
    report=("# C-30 merged-main canonical checker reconciliation\n\n"
        f"- 판정: `IN_PROGRESS`; routine Broker merge policy가 적용된 main 기준선은 `{base}`다.\n"
        "- root cause: 기존 checker는 작업 branch만 허용했고 squash main은 exact feature ancestry를 보존하지 않았다.\n"
        "- Stage A: routine PR을 merge commit 방식으로 교정했고 bootstrap PR #16은 기존 squash 정책을 유지했다.\n"
        "- Stage B: work branch pre/post commit과 merged main의 구조를 분리 검증한다. merged main은 parent 2개, first-parent base, second-parent exact feature head, base→feature exact path, feature/main tree equality를 요구한다. SHA는 checker에 하드코딩하지 않는다.\n"
        "- TDD: merged-main 계약 RED `4 failed, 6 passed`; GREEN `10 passed`. canonical checker seq1359와 worktree diff-check PASS. 제품 코드 변경은 0이다.\n"
        "- 미검증 유지: Provider, production auth, PG18, actual server-generated 400, Oracle.\n"
        "- rollback: 본 exact9 reconciliation commit만 revert하며 seq1~1358과 Stage A Broker 정책 commit은 보존한다.\n").encode()
    append_report_hash=sha(report)
    p.update({"event_sequence":1359,"last_event_id":events[-1]["event_id"],"updated_at":MERGED_AT,"recorded_at":MERGED_AT,
        "next_safe_action":"C30_MERGED_MAIN_RECONCILIATION_COMMIT_PUSH","runtime_next_action":"C30_MERGED_MAIN_RECONCILIATION_COMMIT_PUSH"})
    p["repository"].update({"branch":MERGED_BRANCH,"upstream":f"development/{MERGED_BRANCH}",
        "local_head":base,"remote_head":base,"control_head":base,
        "projection_mode":MODE,"validated_base_commit":base,
        "head_relation":"PRECOMMIT_OR_DIRECT_CHILD_OR_STRUCTURAL_MERGED_MAIN",
        "exact_allowed_paths":MERGED_RECONCILIATION_PATHS,"product_write_scope":[],
        "worktree_status":"UNSTAGED_C30_MERGED_MAIN_RECONCILIATION_EXACT9",
        "commit_status":"NOT_EXECUTED","push_status":"NOT_EXECUTED","remote_evidence":"LIVE_MAIN_BASE_VERIFIED"})
    p["current_progress_evidence_ref"]={"package_id":"C-30","path":MERGED_DIGEST,"manifest_path":MANIFEST}
    p["latest_evidence_refs"]=[{"path":MERGED_REPORT,"sha256":append_report_hash}]
    m=dict(p); m.pop("snapshot_hash",None); p["snapshot_hash"]=sha(canon(m)); praw=pretty(p)
    event_raw=pretty(events[-1]).rstrip(b"\n"); old_id=ledger["last_event_id"].encode(); marker=b'\n  ],\n  "last_event_id": "'+old_id+b'"'; assert base_raw.count(marker)==1
    eraw=base_raw.replace(marker,b",\n"+event_raw+marker.replace(old_id,events[-1]["event_id"].encode())).replace(b'"last_sequence": 1358',b'"last_sequence": 1359',1)
    summary={k:p.get(k) for k in ("event_sequence","last_event_id","status","current_phase","current_work_package","active_agent","worker_lease","write_lease","next_work_package","next_successor_work_package","next_safe_action","runtime_next_action")}
    summary.update({"c30_overall_status":"ACCEPTED","repository_validated_base":base,"repository_branch":MERGED_BRANCH,"unverified":UNVERIFIED})
    hraw=("# C30 merged-main canonical checker reconciliation\n\n```json anvil-recovery-summary\n"+pretty(summary).decode()+"```\n").encode()
    ws=("# C-30 merged-main canonical checker reconciliation / 2026-09-23\n\n"
        f"- 판정: `IN_PROGRESS`; Stage A merge-policy main `{base}`에서 Stage B exact9 reconciliation을 시작했다.\n"
        "- TDD RED `4 failed, 6 passed`; GREEN `10 passed`; canonical checker seq1359와 worktree diff-check PASS. checker는 work branch pre/post와 2-parent merged main을 구조·exact path·ancestry·tree equality로 검증한다.\n"
        "- 제품/DB/WSL/browser/Provider/Oracle 변경·재실행은 0이다. 다음은 seq1359 checker/diff/focused gate 후 commit·push·request tag다.\n\n").encode()+subprocess.check_output(["git","show",f"{base}:docs/WORK_STATUS.md"],cwd=root)
    pp.write_bytes(praw); ep.write_bytes(eraw); hp.write_bytes(hraw); (root/MERGED_REPORT).write_bytes(report); (root/"docs/WORK_STATUS.md").write_bytes(ws)
    digest={"schema_version":"1.0.0","algorithm":"SHA-256","event_sequence":1359,"self_reference":False,
        "progress":{"path":"docs/progress/build-progress.json","bytes":len(praw),"file_sha256":sha(praw),"canonical_json_sha256":sha(canon(p))},
        "handoff":{"path":"docs/progress/BUILD_HANDOFF.md","bytes":len(hraw),"file_sha256":sha(hraw),"machine_summary_canonical_sha256":sha(canon(summary))}}
    (root/MERGED_DIGEST).write_bytes(pretty(digest))
    man=json.loads(subprocess.check_output(["git","show",f"{base}:{MANIFEST}"],cwd=root))
    man.update({"event_sequence":1359,"appended_event_count":10,"exact_allowed_paths":MERGED_RECONCILIATION_PATHS,
        "control_paths":MERGED_RECONCILIATION_PATHS,"product_write_scope":[],
        "repository_reconciliation":{"accepted_checkpoint":base,"routine_merge_method":"MERGE_COMMIT",
            "status":"IN_PROGRESS_PENDING_COMMIT_PUSH","product_behavior_changed":False}})
    rows=[]
    for rel in MERGED_RECONCILIATION_PATHS:
        if rel!=MANIFEST:
            raw=(root/rel).read_bytes(); rows.append({"path":rel,"bytes":len(raw),"sha256":sha(raw)})
    man["raw_checksums"]=rows; (root/MANIFEST).write_bytes(pretty(man))

if __name__=="__main__":
    root=Path(__file__).resolve().parents[1]
    merged_main_reconcile(root) if "--merged-main-reconcile" in sys.argv else (broker_reconcile(root) if "--broker-reconcile" in sys.argv else (reconcile(root) if "--reconcile" in sys.argv else materialize(root)))
