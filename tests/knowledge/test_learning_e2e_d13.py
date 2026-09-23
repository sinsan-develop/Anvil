"""D13 owner API composition; no OS/Provider/DB execution."""
from datetime import timedelta
import importlib
import json
import pytest
from packages.knowledge.memory import _hash, to_primitive
from tests.knowledge.test_candidates_d06 import setup as candidate_setup, snapshot, proof, start_boundary, NOW
from tests.knowledge.test_patterns_d04 import reference_chain, payload as pattern_payload, evidence, attest, extract
from tests.knowledge.test_reviews_d05 import payload as review_payload, attest as review_attest, evidence as review_evidence,provenance,terminal


@pytest.fixture
def m():
    try: return importlib.import_module("packages.knowledge.learning_e2e")
    except ModuleNotFoundError: pytest.fail("D13_LEARNING_E2E_MISSING")


def setup(m,kind="SKILL",owners=True):
    c,ctx,proposal,sources,snaps=candidate_setup(importlib.import_module("packages.knowledge.candidates"),kind)
    patterns=c._reviews._patterns; source=sources.get(ctx,"s1",now=NOW)
    pattern,reference=reference_chain(patterns,ctx,source)
    # Final delivered diff is the reviewed target, not an unrelated valid hash.
    prior=c._reviews.get(ctx,proposal["review_ref"]["review_id"],now=NOW)
    review_data=review_payload(review_id="bound-review",subject_ref=dict(kind="RUN",subject_id="completed-origin"),
                             no_change_reason=None,candidate_actions=to_primitive(prior.candidate_actions),user_corrections=to_primitive(prior.user_corrections))
    evidence_data=review_evidence(provenance=to_primitive(prior.provenance))
    # D05 provenance proof expects reference DTOs, not stored inherited wrappers.
    evidence_data["provenance"]=[to_primitive(p["reference"]) for p in prior.provenance]
    for check in evidence_data["verification"].values(): check["target_hash"]=source.record.content_hash
    c._reviews.attest(ctx,review_data,terminal(review_data,target_hash=source.record.content_hash),evidence_data,now=NOW,expires_at=NOW+timedelta(hours=1))
    review=c._reviews.create(ctx,review_data,expected_version=0,request_id="bound-review",now=NOW)
    proposal["review_ref"]=dict(review_id=review.review_id,version=1,content_hash=review.content_hash)
    if kind=="USER": c.capture_user_confirmation(ctx,proposal,evidence_ref="user-confirmed",now=NOW,expires_at=NOW+timedelta(hours=1))
    unrelated=pattern_payload(source,"EXAMPLE_REFERENCE",artifact_id="unused")
    attest(patterns,ctx,unrelated,evidence(source)); extract(patterns,ctx,unrelated,request="unused")
    current=snapshot(snaps,run="current",instant=NOW)
    no_change=review_payload(review_id="nochange",subject_ref=dict(kind="RUN",subject_id="next-run"))
    journey_mod=importlib.import_module("packages.knowledge.learning_journey")
    journey=journey_mod.LearningJourney(c,ctx,journey_mod.LearningJourneyAuthority())
    owner_args={}
    if owners:
        sm=importlib.import_module("packages.knowledge.skills")
        hm=importlib.import_module("packages.knowledge.hooks")
        rm=importlib.import_module("packages.knowledge.hook_runtime")
        mm=importlib.import_module("packages.knowledge.model_registry")
        hooks=hm.HookRegistry(c)
        owner_args=dict(memory=c._reviews._memory,skills=sm.SkillRepository(c),hooks=hooks,
                        runtime=rm.HookRuntime(hooks,rm.FakeSandboxExecutor(),rm.HookRuntimeAuthority()),
                        models=mm.ModelRegistry(c,mm.ModelRegistryAuthority(),roles=("developer",)))
    h=m.LearningE2E(c,ctx,m.LearningE2EAuthority(),journey,**owner_args)
    fixture=dict(proposal=proposal,current_snapshot=current,source_ref=dict(source_id="s1",version=1,record_hash=source.record.record_hash),
                 final_diff_hash=source.record.content_hash,pattern_ref=dict(artifact_id=pattern.artifact_id,version=pattern.version,record_hash=pattern.record_hash),
                 needed_refs=[dict(artifact_id=reference.artifact_id,version=reference.version,record_hash=reference.record_hash)],no_change=no_change,
                 similarity=dict(intent="safe retry",language="python"))
    h.capture_scenario(ctx,"scenario",fixture,now=NOW,expires_at=NOW+timedelta(hours=1))
    return h,ctx,c,proposal,sources,snaps


def approve(env):
    h,ctx,c,_,_,_=env
    h.execute(ctx,"scenario","propose",now=NOW)
    target=h.query(ctx,"scenario",now=NOW)["candidate_ref"]
    c.capture_evaluation(ctx,to_primitive(target),proof(target),now=NOW,expires_at=NOW+timedelta(hours=1))
    h.execute(ctx,"scenario","evaluate",now=NOW)
    h.execute(ctx,"scenario","request-approval",now=NOW)
    c.capture_human_decision(ctx,to_primitive(target),decision="APPROVE",evidence_ref="human-event",now=NOW,expires_at=NOW+timedelta(hours=1))
    h.execute(ctx,"scenario","approve",now=NOW)
    return h.execute(ctx,"scenario","activate",now=NOW)


def next_task(env):
    h,ctx,c,_,_,snaps=env
    active=h.query(ctx,"scenario",now=NOW)["activation_ref"] or approve(env)["activation_ref"]
    actual=next(json.loads(raw) for raw in c._activations.values() if json.loads(raw)["activation_id"]==active["activation_id"])
    sr=snapshot(snaps,instant=NOW+timedelta(seconds=1))
    boundary=start_boundary(c,ctx,[actual],sr)
    h.bind_next_task(ctx,"scenario",sr,boundary,now=NOW+timedelta(seconds=1))
    return h.execute(ctx,"scenario","next-task",now=NOW+timedelta(seconds=1))


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT","USER"])
def test_candidate_approval_next_task_revoke_isolation_and_nochange(m,kind):
    env=setup(m,kind); h,ctx,c,_,sources,snaps=env
    baseline=h.query(ctx,"scenario",now=NOW)
    h.execute(ctx,"scenario","propose",now=NOW)
    assert h.query(ctx,"scenario",now=NOW)["current_snapshot_hash"]==baseline["current_snapshot_hash"]
    assert h.query(ctx,"scenario",now=NOW)["context_projection_hash"]==baseline["context_projection_hash"]
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","activate",now=NOW)
    if kind=="USER": applied=next_task(env)
    else: applied,_=owner_selected(env,kind,prepare_owner(env,kind))
    assert applied["uses"] and applied["application_status"]=="APPLIED"
    assert applied["selected_revision"] is None if kind=="USER" else applied["selected_revision"]["kind"]==kind
    assert applied["current_snapshot_hash"]==baseline["current_snapshot_hash"]
    assert applied["context_projection_hash"]!=baseline["context_projection_hash"]
    loaded=h.execute(ctx,"scenario","load-references",now=NOW+timedelta(seconds=1))
    assert [r["artifact_id"] for r in loaded["loaded_references"]]==["ref1"]
    revoked=h.execute(ctx,"scenario","revoke",now=NOW+timedelta(seconds=2))
    assert revoked["status"]=="QUARANTINED" and revoked["affected_runs"]==("next-run",)
    assert revoked["current_snapshot_hash"]==baseline["current_snapshot_hash"]
    assert revoked["context_projection_hash"]==baseline["context_projection_hash"]
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","load-references",now=NOW+timedelta(seconds=2))
    capture_terminal(env)
    finished=h.execute(ctx,"scenario","no-change",now=NOW+timedelta(seconds=2))
    assert finished["no_change_review_hash"] and len(c._records)==1
    assert finished["journey_hash"] and finished["runtime_consumer"]=="NOT_INTEGRATED"


def test_explicit_rollback_returns_baseline_and_preserves_affected_run(m):
    env=setup(m); h,ctx,*_=env; baseline=h.query(ctx,"scenario",now=NOW)["context_projection_hash"]
    owner_selected(env,"SKILL",prepare_owner(env,"SKILL"))
    result=h.execute(ctx,"scenario","rollback",now=NOW+timedelta(seconds=2))
    assert result["status"]=="ROLLED_BACK" and result["context_projection_hash"]==baseline
    assert result["affected_runs"]==("next-run",)


def test_host_authority_not_payload_and_duplicate_stage_is_idempotent(m):
    h,ctx,c,*_=setup(m)
    first=h.execute(ctx,"scenario","propose",now=NOW)
    assert h.execute(ctx,"scenario","propose",now=NOW)==first and len(c._records)==1
    with pytest.raises(m.LearningE2EError): h.execute(object(),"scenario","propose",now=NOW)
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","human-approve",now=NOW)
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","evaluate",now=NOW)


@pytest.mark.parametrize("changes,trigger",[({},True),({"check_id":"AV-LRN-013"},False),({"target_hash":"b"*64},False),
    ({"severity":"MAJOR"},False),({"confirmed":False},False),({"status":"PASS"},False)])
def test_dirx_exact_target_confirmed_critical_only_and_dedupe(m,changes,trigger):
    h,ctx,c,proposal,*_=setup(m); target=c._reviews.get(ctx,proposal["review_ref"]["review_id"],now=NOW).target_hash
    finding=dict(check_id="AV-LRN-003",target_hash=target,severity="CRITICAL",confirmed=True,status="FAIL",evidence_hash="e"*64)
    finding.update(changes)
    h.capture_gate_verification(ctx,"scenario",target,[finding],now=NOW,expires_at=NOW+timedelta(hours=1))
    result=h.dir_x(ctx,"scenario",now=NOW)
    assert (result["trigger"]=="DIRX-LRN-CRITICAL")==trigger
    assert h.dir_x(ctx,"scenario",now=NOW)["trigger"] is None
    assert result["control_event_emitted"] is False


def test_missing_or_foreign_gate_authority_cannot_trigger(m):
    h,ctx,*_=setup(m)
    with pytest.raises(m.LearningE2EError): h.dir_x(ctx,"scenario",now=NOW)
    with pytest.raises(m.LearningE2EError): h.capture_gate_verification(object(),"scenario","a"*64,[],now=NOW,expires_at=NOW+timedelta(hours=1))


def fixture_data(h,ctx): return json.loads(h._authority.fixtures[(id(ctx),"scenario")][1])["data"]


def capture_terminal(env,**changes):
    h,ctx,*_=env; f=fixture_data(h,ctx); instant=NOW+timedelta(seconds=2)
    t=terminal(f["no_change"],target_hash=f["final_diff_hash"],ended_at=instant); t.update(changes)
    proof=review_evidence()
    for check in proof["verification"].values(): check["target_hash"]=f["final_diff_hash"]
    h.capture_terminal_evidence(ctx,"scenario",t,proof,now=instant,expires_at=NOW+timedelta(hours=1))


@pytest.mark.parametrize("change",["final_hash","source_hash","pattern_hash","unrelated_ref","review_target"])
def test_fixture_exact_diff_review_source_and_selected_reference_binding(m,change):
    h,ctx,c,proposal,*_=setup(m); f=fixture_data(h,ctx)
    if change=="final_hash": f["final_diff_hash"]="f"*64
    elif change=="source_hash": f["source_ref"]["record_hash"]="f"*64
    elif change=="pattern_hash": f["pattern_ref"]["record_hash"]="f"*64
    elif change=="unrelated_ref": f["needed_refs"]=[dict(artifact_id="unused",version=1,record_hash="f"*64)]
    else:
        old=c._reviews.get(ctx,"review1",now=NOW)
        f["proposal"]["review_ref"]=dict(review_id=old.review_id,version=1,content_hash=old.content_hash)
    with pytest.raises(m.LearningE2EError): h.capture_scenario(ctx,"forged",f,now=NOW,expires_at=NOW+timedelta(hours=1))


@pytest.mark.parametrize("change",["expiry","hash","foreign_context"])
def test_sealed_fixture_stale_tamper_and_foreign_context_rejected(m,change):
    h,ctx,*_=setup(m)
    if change=="expiry":
        with pytest.raises(m.LearningE2EError): h.query(ctx,"scenario",now=NOW+timedelta(hours=2))
    elif change=="foreign_context":
        with pytest.raises(m.LearningE2EError): h.query(object(),"scenario",now=NOW)
    else:
        key=(id(ctx),"scenario"); owner,raw=h._authority.fixtures[key]; value=json.loads(raw)
        value["data"]["proposal"]["target_id"]="different"
        h._authority.fixtures[key]=(owner,json.dumps(value))
        with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","propose",now=NOW)


def test_missing_human_approval_and_nonpass_evaluation_cannot_activate(m):
    h,ctx,c,*_=setup(m); h.execute(ctx,"scenario","propose",now=NOW)
    target=to_primitive(h.query(ctx,"scenario",now=NOW)["candidate_ref"])
    c.capture_evaluation(ctx,target,proof(target,"FAIL"),now=NOW,expires_at=NOW+timedelta(hours=1))
    h.execute(ctx,"scenario","evaluate",now=NOW)
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","request-approval",now=NOW)
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","approve",now=NOW)
    assert not c._activations


def test_next_task_boundary_cannot_use_current_snapshot_or_forged_capability(m):
    env=setup(m); h,ctx,c,*_=env; approve(env)
    with pytest.raises(m.LearningE2EError): h.bind_next_task(ctx,"scenario",fixture_data(h,ctx)["current_snapshot"],object(),now=NOW)
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","next-task",now=NOW)


@pytest.mark.parametrize("check",["AV-LRN-003","AV-LRN-004","AV-LRN-005"])
def test_dirx_all_canonical_ids_duplicate_findings_emit_once(m,check):
    h,ctx,c,proposal,*_=setup(m)
    target=c._reviews.get(ctx,proposal["review_ref"]["review_id"],now=NOW).target_hash
    finding=dict(check_id=check,target_hash=target,severity="CRITICAL",confirmed=True,status="FAIL",evidence_hash="e"*64)
    h.capture_gate_verification(ctx,"scenario",target,[finding,finding],now=NOW,expires_at=NOW+timedelta(hours=1))
    first=h.dir_x(ctx,"scenario",now=NOW)
    assert first["checks"]==(check,) and first["trigger"]=="DIRX-LRN-CRITICAL"
    assert h.dir_x(ctx,"scenario",now=NOW)["trigger"] is None


@pytest.mark.parametrize("change",["hash","foreign_actor","expired"])
def test_gate_seal_hash_authority_and_half_open_expiry(m,change):
    h,ctx,c,proposal,*_=setup(m)
    target=c._reviews.get(ctx,proposal["review_ref"]["review_id"],now=NOW).target_hash
    h.capture_gate_verification(ctx,"scenario",target,[],now=NOW,expires_at=NOW+timedelta(minutes=1))
    key=(id(ctx),"scenario"); owner,raw=h._authority.gates[key]; value=json.loads(raw)
    instant=NOW
    if change=="expired": instant=NOW+timedelta(minutes=1)
    elif change=="hash": value["target_hash"]="f"*64
    else:
        value["actor"]="other"; value["content_hash"]=_hash({k:v for k,v in value.items() if k!="content_hash"})
    if change!="expired": h._authority.gates[key]=(owner,json.dumps(value))
    with pytest.raises(m.LearningE2EError): h.dir_x(ctx,"scenario",now=instant)


def test_concurrent_duplicate_propose_alias_and_no_raw_fixture_leak(m):
    from concurrent.futures import ThreadPoolExecutor
    h,ctx,c,*_=setup(m)
    with ThreadPoolExecutor(max_workers=2) as pool:
        values=list(pool.map(lambda _:h.execute(ctx,"scenario","propose",now=NOW),range(2)))
    assert values[0]==values[1] and len(c._records)==1
    changed=to_primitive(values[0]); changed["events"].clear(); changed["candidate_ref"]["content_hash"]="f"*64
    assert h.query(ctx,"scenario",now=NOW)==values[0]
    assert "bounded retry" not in str(values[0]) and "src/main.py" not in str(values[0])


@pytest.mark.parametrize("result",["FAILED","REJECTED"])
def test_unapproved_or_failed_diff_never_becomes_positive_example(m,result):
    h,ctx,c,_,sources,*_=setup(m)
    source=sources.get(ctx,"s1",now=NOW); patterns=c._reviews._patterns
    data=pattern_payload(source,"EXAMPLE_REFERENCE",artifact_id="not-approved")
    bad=evidence(source,result=result,approved_artifact_hash="f"*64)
    attest(patterns,ctx,data,bad)
    with pytest.raises(Exception) as error: extract(patterns,ctx,data,request="bad-exemplar")
    assert getattr(error.value,"reason",None)=="POSITIVE_EVIDENCE_REQUIRED"
    assert all(x.artifact_id!="not-approved" for x in patterns.search(ctx,{"kind":"EXAMPLE_REFERENCE"},now=NOW))


def test_r2_generic_candidate_kind_is_not_an_owner_revision(m):
    env=setup(m); h,ctx,*_=env
    next_task(env)
    value=h.query(ctx,"scenario",now=NOW+timedelta(seconds=1))
    assert value["selected_revision"] is None
    assert value["owner_evidence_status"]=="NOT_CAPTURED"


def test_r2_same_task_new_run_is_not_next_task(m):
    env=setup(m); h,ctx,c,_,_,snaps=env; active=approve(env)["activation_ref"]
    current=fixture_data(h,ctx)["current_snapshot"]
    scope=importlib.import_module("packages.knowledge.memory").MemoryScope("u1","project","p1")
    actual=snaps.create_task_run(current["session_id"],current["task_id"],"same-task-new-run","revision1",scope,now=NOW+timedelta(seconds=1),request_id="same-task")
    sr={k:getattr(actual,k) for k in ("session_id","task_id","run_id","snapshot_id","content_hash")}
    activation=next(json.loads(raw) for raw in c._activations.values())
    cap=start_boundary(c,ctx,[activation],sr)
    with pytest.raises(m.LearningE2EError,match="E2E_NEXT_TASK_REQUIRED"): h.bind_next_task(ctx,"scenario",sr,cap,now=NOW+timedelta(seconds=1))


def test_r2_early_nochange_attestation_cannot_complete_selected_run(m):
    env=setup(m); h,ctx,c,*_=env
    # Reproduce the old illegal fixture: terminal was captured before RunStart.
    review_attest(c._reviews,ctx,fixture_data(h,ctx)["no_change"])
    owner_selected(env,"SKILL",prepare_owner(env,"SKILL"))
    with pytest.raises(m.LearningE2EError,match="E2E_TERMINAL_CAPTURE_REQUIRED"):
        h.execute(ctx,"scenario","no-change",now=NOW+timedelta(seconds=2))


def test_r2_reference_search_receipt_binds_similarity_source_and_diff(m):
    env=setup(m); h,ctx,*_=env; owner_selected(env,"SKILL",prepare_owner(env,"SKILL"))
    value=h.execute(ctx,"scenario","load-references",now=NOW+timedelta(seconds=1))
    facts=value["search_receipt"]["query_facts"]
    f=fixture_data(h,ctx)
    assert facts["source_ref"]==f["source_ref"] and facts["final_diff_hash"]==f["final_diff_hash"]
    assert facts["target_hash"]==f["final_diff_hash"] and facts["similarity"]=={"intent":"safe retry","language":"python"}
    assert value["search_receipt"]["matched_pattern_hashes"]==[f["pattern_ref"]["record_hash"]] or tuple(value["search_receipt"]["matched_pattern_hashes"])==(f["pattern_ref"]["record_hash"],)


def prepare_owner(env,kind):
    h,ctx,c,*_=env; active=approve(env); target=to_primitive(active["candidate_ref"])
    if kind=="MEMORY":
        from tests.knowledge.test_memory_d01 import payload
        f=fixture_data(h,ctx)
        value=h._memory.add(payload(entry_id="catalog-item",evidence=[dict(type="verification",ref=x) for x in
                            (target["content_hash"],f["source_ref"]["record_hash"],active["activation_ref"]["content_hash"])]),now=NOW)
        return dict(entry_id=value.entry_id,version=value.version,content_hash=value.content_hash)
    if kind=="HOOK":
        from tests.knowledge.test_hooks_d09 import definition,program,register
        from tests.knowledge.test_hook_runtime_d10 import ready
        hm=importlib.import_module("packages.knowledge.hooks")
        data=dict(proposal_id="owner-hook",candidate_ref=target,action="create_program_and_rule",before=[],after=[definition(hm)],programs=[program()])
        result=register(h._hooks,ctx,data); reference=to_primitive(result["hook_refs"][0])
        h._runtime.track(ctx,reference,now=NOW)
        ready(h._runtime,ctx,reference,h._runtime._executor)
        return reference
    if kind=="PROMPT":
        from tests.knowledge.test_model_registry_d11 import publish_prompt,publish_model,benchmark,bench_data,route_data,activate,reference
        prompt=publish_prompt(h._models,ctx,target); model=publish_model(h._models,ctx)
        bench=benchmark(h._models,ctx,bench_data(prompt,model))
        route=h._models.create_routing(ctx,route_data(prompt,model,bench),now=NOW); activate(h._models,ctx,route)
        return reference(prompt)
    return None


def owner_reference(env,kind,reference):
    h,ctx,*_=env; next_task(env); now=NOW+timedelta(seconds=1)
    if kind=="SKILL":
        from tests.knowledge.test_skills_d07 import payload
        state=h._states["scenario"]; active=state["activation"]; selected=state["selection"]
        reference=to_primitive(h._skills.capture_materialization(ctx,{k:active[k] for k in ("activation_id","version","content_hash")},
                        {k:selected[k] for k in ("selection_id","content_hash")},payload(active),evidence_ref="host-materialization",now=now,expires_at=NOW+timedelta(hours=1)))
    return reference


def owner_selected(env,kind,reference):
    h,ctx,*_=env; reference=owner_reference(env,kind,reference)
    return h.capture_owner_selection(ctx,"scenario",reference,now=NOW+timedelta(seconds=1)),reference


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
def test_r2_actual_owner_revision_and_selection_not_generic_kind(m,kind):
    env=setup(m,kind,owners=True); h,ctx,*_=env
    reference=prepare_owner(env,kind); value,reference=owner_selected(env,kind,reference)
    revision=value["selected_revision"]
    assert revision["revision_ref"]==reference and revision["kind"]==kind
    assert revision["receipt_hash"] and revision["candidate_ref"]==value["candidate_ref"]
    assert value["owner_evidence_status"]=="RECORDED_NOT_EXECUTED"
    assert value["runtime_consumer"]=="NOT_INTEGRATED" and value["io_count"]==0
    before=value["context_projection_hash"]
    revoked=h.execute(ctx,"scenario","revoke",now=NOW+timedelta(seconds=2))
    assert revoked["context_projection_hash"]!=before and revoked["affected_runs"]==("next-run",)
    with pytest.raises(m.LearningE2EError): h.capture_owner_selection(ctx,"scenario",reference,now=NOW+timedelta(seconds=2))
    capture_terminal(env)
    assert h.execute(ctx,"scenario","no-change",now=NOW+timedelta(seconds=2))["no_change_review_hash"]


@pytest.mark.parametrize("kind",["SKILL","HOOK","PROMPT"])
def test_r2_owner_canonical_hash_drift_cannot_remain_valid_projection(m,kind):
    env=setup(m,kind,owners=True); h,ctx,*_=env
    reference=prepare_owner(env,kind); owner_selected(env,kind,reference)
    if kind=="SKILL":
        key=next(iter(h._skills._materials)); value=json.loads(h._skills._materials[key]); value["data"]["description"]="changed"
        h._skills._materials[key]=json.dumps(value)
    elif kind=="HOOK":
        key=next(iter(h._hooks._hooks)); value=json.loads(h._hooks._hooks[key]); value["definition"]["timeout_ms"]=99
        h._hooks._hooks[key]=json.dumps(value)
    else: next(iter(h._models._state["prompts"].values()))["data"]["body"]="changed"
    with pytest.raises(m.LearningE2EError): h.query(ctx,"scenario",now=NOW+timedelta(seconds=1))


def test_r2_user_correction_is_provenance_not_materialized_user_revision(m):
    env=setup(m,"USER"); h,ctx,*_=env; value=next_task(env)
    assert value["selected_revision"] is None
    assert value["user_correction_provenance"]["source_ref"]==fixture_data(h,ctx)["proposal"]["user_source_ref"]
    assert value["user_correction_provenance"]["candidate_ref"]==value["candidate_ref"]


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
def test_r2_revoke_blocks_direct_owner_new_selection_or_resolution(m,kind):
    env=setup(m,kind,owners=True); h,ctx,c,_,_,snaps=env
    reference=prepare_owner(env,kind); _,reference=owner_selected(env,kind,reference)
    h.execute(ctx,"scenario","revoke",now=NOW+timedelta(seconds=2))
    now=NOW+timedelta(seconds=3)
    if kind=="MEMORY":
        scope=importlib.import_module("packages.knowledge.memory").MemoryScope("u1","project","p1")
        resolved=h._memory.resolve_context("MEMORY",scope,instructions=[],now=now)
        assert all(x.entry_id!="catalog-item" for x in resolved.entries)
    elif kind=="SKILL":
        selected=h._states["scenario"]["selection"]; sr={k:selected[k] for k in ("selection_id","content_hash")}
        with pytest.raises(Exception): h._skills.select(ctx,sr,reference,task="safe retry",mode="explicit",request_id="after-revoke",now=now)
    else:
        sr=snapshot(snaps,run="after-revoke",instant=now); c._run_clock.advance(now)
        if kind=="HOOK":
            with pytest.raises(Exception,match="CANDIDATE_QUARANTINED"): h._runtime.capture_run_start(ctx,sr,now=now)
        else: assert h._models.run_guard(ctx,sr,now=now)["status"]=="BLOCKED_CAPABILITY_DRIFT"


@pytest.mark.parametrize("change",["before_start","future","wrong_run","wrong_target"])
def test_r2_terminal_capture_binds_actual_run_start_subject_and_target(m,change):
    env=setup(m); h,ctx,*_=env; owner_selected(env,"SKILL",prepare_owner(env,"SKILL"))
    modifications={"before_start":dict(ended_at=NOW),"future":dict(ended_at=NOW+timedelta(minutes=1)),
                   "wrong_run":dict(subject_ref=dict(kind="RUN",subject_id="other")),"wrong_target":dict(target_hash="e"*64)}
    with pytest.raises(m.LearningE2EError,match="E2E_TERMINAL_BOUNDARY_MISMATCH"): capture_terminal(env,**modifications[change])


def test_r2_similarity_conditions_are_executed_not_known_pattern_lookup(m):
    env=setup(m); h,ctx,*_=env; f=fixture_data(h,ctx); f["similarity"]["language"]="ruby"
    h.capture_scenario(ctx,"different-query",f,now=NOW,expires_at=NOW+timedelta(hours=1))
    owner_selected(env,"SKILL",prepare_owner(env,"SKILL"))
    # The second host-admitted query shares the actual selection, not its known pattern result.
    h._states["different-query"]=dict(h._states["scenario"])
    with pytest.raises(m.LearningE2EError,match="E2E_PATTERN_MISMATCH"):
        h.execute(ctx,"different-query","load-references",now=NOW+timedelta(seconds=1))


@pytest.mark.parametrize("owner",["memory","skills","hooks","runtime","models"])
def test_r2_duck_typed_or_foreign_owner_injection_is_rejected(m,owner):
    env=setup(m); h,ctx,c,*_=env
    with pytest.raises(m.LearningE2EError,match="E2E_OWNER_AUTHORITY_MISMATCH"):
        m.LearningE2E(c,ctx,m.LearningE2EAuthority(),h._journey,**{owner:object()})


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
def test_r2_owner_receipt_replay_foreign_context_rebind_and_snapshot_alias(m,kind):
    env=setup(m,kind,owners=True); h,ctx,*_=env
    reference=prepare_owner(env,kind); value,reference=owner_selected(env,kind,reference); instant=NOW+timedelta(seconds=1)
    assert h.capture_owner_selection(ctx,"scenario",reference,now=instant)==value
    changed=to_primitive(value); changed["selected_revision"]["revision_ref"]["content_hash"]="e"*64
    assert h.query(ctx,"scenario",now=instant)==value
    forged=dict(reference,content_hash="e"*64)
    with pytest.raises(m.LearningE2EError,match="E2E_OWNER_REBIND"): h.capture_owner_selection(ctx,"scenario",forged,now=instant)
    with pytest.raises(m.LearningE2EError,match="E2E_AUTHORITY_MISMATCH"): h.capture_owner_selection(object(),"scenario",reference,now=instant)


def test_r2_terminal_attestation_replacement_cannot_complete(m):
    env=setup(m); h,ctx,c,*_=env; owner_selected(env,"SKILL",prepare_owner(env,"SKILL")); capture_terminal(env)
    key=next(k for k in c._reviews._attestations if k[-1]=="next-run")
    value=json.loads(c._reviews._attestations[key]); value["terminal"]["target_hash"]="e"*64
    c._reviews._attestations[key]=json.dumps(value)
    with pytest.raises(m.LearningE2EError,match="E2E_TERMINAL_BOUNDARY_MISMATCH"):
        h.execute(ctx,"scenario","no-change",now=NOW+timedelta(seconds=2))


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
def test_r3_missing_owner_injection_cannot_begin_candidate_workflow(m,kind):
    h,ctx,c,*_=setup(m,kind,owners=False)
    with pytest.raises(m.LearningE2EError,match="E2E_OWNER_AUTHORITY_REQUIRED"):
        h.execute(ctx,"scenario","propose",now=NOW)
    assert not c._records


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
def test_r3_candidate_selection_without_owner_receipt_remains_not_applied(m,kind):
    env=setup(m,kind,owners=True); h,ctx,c,*_=env; baseline=h.query(ctx,"scenario",now=NOW)
    value=next_task(env)
    assert value["status"]=="PENDING_OWNER_EVIDENCE" and value["application_status"]=="NOT_APPLIED"
    assert value["context_projection_hash"]==baseline["context_projection_hash"]
    assert not value["uses"] and not c._uses and not value["affected_runs"]
    for stage in ("load-references","revoke","rollback","no-change"):
        with pytest.raises(m.LearningE2EError,match="E2E_OWNER_EVIDENCE_REQUIRED"):
            h.execute(ctx,"scenario",stage,now=NOW+timedelta(seconds=2))
    with pytest.raises(m.LearningE2EError,match="E2E_OWNER_EVIDENCE_REQUIRED"): capture_terminal(env)
    assert not h._states["scenario"]["loaded"] and h._states["scenario"]["no_change"] is None
    assert c._reviews._sources.get(ctx,"s1",now=NOW+timedelta(seconds=2)).status=="REGISTERED"


def test_r3_user_correction_does_not_require_memory_skill_hook_prompt_owners(m):
    env=setup(m,"USER",owners=False); h,ctx,*_=env
    selected=next_task(env)
    assert selected["application_status"]=="APPLIED" and selected["user_correction_provenance"]
    h.execute(ctx,"scenario","load-references",now=NOW+timedelta(seconds=1))
    capture_terminal(env)
    assert h.execute(ctx,"scenario","no-change",now=NOW+timedelta(seconds=2))["no_change_review_hash"]


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
def test_r3_real_owner_capture_is_the_only_pending_to_applied_transition(m,kind):
    env=setup(m,kind); h,ctx,c,*_=env; baseline=h.query(ctx,"scenario",now=NOW)["context_projection_hash"]
    reference=prepare_owner(env,kind)
    value,reference=owner_selected(env,kind,reference)
    assert value["status"]=="ACTIVE" and value["application_status"]=="APPLIED" and value["uses"]
    assert value["context_projection_hash"]!=baseline and value["selected_revision"]["receipt_hash"]
    loaded=h.execute(ctx,"scenario","load-references",now=NOW+timedelta(seconds=1))
    assert len(loaded["loaded_references"])==1
    result=h.execute(ctx,"scenario","rollback",now=NOW+timedelta(seconds=2))
    assert result["application_status"]=="NOT_APPLIED" and result["context_projection_hash"]==baseline
    assert result["affected_runs"]==("next-run",)
    capture_terminal(env)
    assert h.execute(ctx,"scenario","no-change",now=NOW+timedelta(seconds=2))["no_change_review_hash"]


@pytest.mark.parametrize("kind",["MEMORY","SKILL","HOOK","PROMPT"])
@pytest.mark.parametrize("after_use",[False,True])
def test_r4_register_use_failure_never_publishes_partial_applied_and_retry_recovers(m,monkeypatch,kind,after_use):
    from copy import deepcopy
    env=setup(m,kind); h,ctx,c,*_=env
    reference=owner_reference(env,kind,prepare_owner(env,kind)); instant=NOW+timedelta(seconds=1)
    before=deepcopy(h._states); original=h._register_use
    def fail(*args):
        if after_use: original(*args)
        raise m.LearningE2EError("INJECTED_USE_FAILURE")
    monkeypatch.setattr(h,"_register_use",fail)
    with pytest.raises(m.LearningE2EError,match="INJECTED_USE_FAILURE"):
        h.capture_owner_selection(ctx,"scenario",reference,now=instant)
    assert h._states==before
    pending=h.query(ctx,"scenario",now=instant)
    assert pending["status"]=="PENDING_OWNER_EVIDENCE" and pending["application_status"]=="NOT_APPLIED"
    assert not pending["uses"] and pending["selected_revision"] is None
    # Owner receipt preparation is not a cross-repository rollback claim.
    if kind=="HOOK": assert h._runtime._state["selections"]
    elif kind=="PROMPT": assert h._models._state["runs"]
    elif kind=="SKILL": assert h._skills._l1
    monkeypatch.setattr(h,"_register_use",original)
    value=h.capture_owner_selection(ctx,"scenario",reference,now=instant)
    assert value["application_status"]=="APPLIED" and len(value["uses"])==1
    assert value["selected_revision"]["use_hash"]==value["uses"][0]
    assert h.capture_owner_selection(ctx,"scenario",reference,now=instant)==value


@pytest.mark.parametrize("missing",["local_use","canonical_use"])
def test_r4_revision_alone_does_not_mean_applied_and_retry_repairs_use(m,missing):
    env=setup(m); h,ctx,c,*_=env; _,reference=owner_selected(env,"SKILL",prepare_owner(env,"SKILL"))
    state=h._states["scenario"]
    if missing=="local_use": state["uses"]=[]
    else: c._uses.clear()
    pending=h.query(ctx,"scenario",now=NOW+timedelta(seconds=1))
    assert pending["application_status"]=="NOT_APPLIED" and pending["status"]=="PENDING_OWNER_EVIDENCE"
    with pytest.raises(m.LearningE2EError): h.execute(ctx,"scenario","load-references",now=NOW+timedelta(seconds=1))
    recovered=h.capture_owner_selection(ctx,"scenario",reference,now=NOW+timedelta(seconds=1))
    assert recovered["application_status"]=="APPLIED" and recovered["uses"]


@pytest.mark.parametrize("field",["selection_hash","activation_hash","run_id","snapshot_hash"])
def test_r4_rehashed_wrong_use_binding_cannot_claim_idempotent_success(m,field):
    env=setup(m); h,ctx,c,*_=env; _,reference=owner_selected(env,"SKILL",prepare_owner(env,"SKILL"))
    key=next(iter(c._uses)); use=json.loads(c._uses[key]); use[field]="other-run" if field=="run_id" else "f"*64
    use["content_hash"]=_hash({k:v for k,v in use.items() if k!="content_hash"}); c._uses[key]=json.dumps(use)
    with pytest.raises(m.LearningE2EError): h.query(ctx,"scenario",now=NOW+timedelta(seconds=1))
    with pytest.raises(m.LearningE2EError): h.capture_owner_selection(ctx,"scenario",reference,now=NOW+timedelta(seconds=1))
