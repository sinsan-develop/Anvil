"""E02 synthetic host adapter contracts; never an external/runtime PASS."""
import copy
import hashlib
import json
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace
import pytest

from tests.agent_team.test_role_contracts_e01 import fixture, NOW, TARGET, CONTEXT
from packages.artifacts import EvidenceManifest, RawArtifactChecksum, AcquisitionMode, ArtifactMetadata
from packages.orchestration import DeveloperLifecycleService, RawResultEnvelope, LifecycleStatus
from packages.orchestration.result_envelope import ResultEnvelope, EvidenceReference, ResultTest
from packages.execution.models import ResultStatus
from packages.agent_team.role_results import RoleResultService, RoleResult


def digest(raw): return "sha256:"+hashlib.sha256(raw).hexdigest()


class MemoryStore:
    def __init__(self): self.values={}; self.reads=0
    def put(self,request,content): raise AssertionError("handoff may not write artifacts")
    def read(self,metadata):
        self.reads+=1
        return self.values[metadata.artifact_id]


def setup(toolchain=None):
    from packages.agent_team.handoff import RoleHandoffService
    _,policy,reviewer,_,packet=fixture("REVIEWER")
    _,_,_,td,tp=fixture("TESTER")
    tp=replace(tp,delegation_id="dt",workspace_id="tester-workspace",context_snapshot_hash="sha256:"+"e"*64)
    tester=policy.register(assignment_id="tester",definition=td,packet=tp,actor_id="independent-tester",context_id="tester-context",
        thread_id="tester-thread",workspace_id="tester-workspace",session_id="session",context_snapshot_hash=tp.context_snapshot_hash,
        issued_at=NOW,expires_at=NOW+timedelta(hours=1),execution_fence="tester-fence")
    dp=replace(packet,delegation_id="developer",workspace_id="dev-workspace",context_snapshot_hash=policy.implementation_context_hash,
        expected_result_schema="subagent_result/v1",parent_permission_snapshot_hash=packet.permission_snapshot.snapshot_hash)
    log=b"synthetic test observations"; loghash=digest(log)
    envelope=ResultEnvelope("subagent_result/v1","dev-result","developer","attempt",1,"lineage",ResultStatus.COMPLETED,TARGET,"Two tests observed",
        evidence_refs=(EvidenceReference("dev-log",loghash),),tests=(ResultTest("pytest tests/x.py","PASS",0),))
    raw=RawResultEnvelope("developer-session",LifecycleStatus.COMPLETED,{"result":envelope.to_dict(),"raw_transcript":"PRIVATE RAW TRANSCRIPT"})
    class Runner:
        def start(self,*args): pass
        def poll(self,*args): return raw
    lifecycle=DeveloperLifecycleService(Runner())
    lifecycle.start(dp,session_id="developer-session",baseline_hash=TARGET,context_snapshot_hash=dp.context_snapshot_hash,
        parent_permission_snapshot=dp.permission_snapshot,parent_egress_profile=dp.data_egress_profile)
    lifecycle.wait("developer-session")
    store=MemoryStore(); results=RoleResultService(policy)
    service=RoleHandoffService(policy,results,lifecycle,store,project_id="project",session_id="session",developer_session_id="developer-session",
        developer_packet=dp,developer_actor="developer",developer_context="dev-context",developer_fence="developer-fence",
        target_hash=TARGET,baseline_hash=TARGET,work_plan_hash=TARGET,work_instruction_hash=TARGET,environment_id="env-fixture",
        toolchain_versions=toolchain if toolchain is not None else {"python":"fixture-version"})
    def metadata(ident,content,actor):
        store.values[ident]=content
        return ArtifactMetadata(ident,"evidence",digest(content),len(content),"application/json" if ident.endswith("transcript") else "text/plain",
            "sha256/"+digest(content)[7:],"project",dp.parent_run_id,dp.step_id,actor,NOW,())
    metas=(metadata("dev-log",log,"developer"),metadata("dev-transcript",raw.artifact.content,"developer"))
    def manifest(ident,items,actor,role,mode=AcquisitionMode.FIXTURE):
        return EvidenceManifest(ident,"manifests/"+ident,TARGET,TARGET,TARGET,"a"*40,"status-before","status-after",TARGET,TARGET,
            TARGET,"fixture-migration",TARGET,TARGET,TARGET,"env-fixture",{"python":"fixture-version"},("pytest tests/x.py",),NOW,NOW,
            actor,role,mode,tuple(RawArtifactChecksum(m.storage_ref,m.byte_size,m.content_hash,TARGET,"env-fixture") for m in items),(),("actual runtime",))
    m=manifest("dev-manifest",metas,"developer","developer")
    source=service.capture_developer(source_id="dev-source",manifest=m,metadata=metas,now=NOW,expires_at=NOW+timedelta(minutes=30))
    auth=dict(actor_id=reviewer.actor_id,context_id=reviewer.context_id,session_id="session",target_hash=TARGET,execution_fence=reviewer.execution_fence,now=NOW)
    create=dict(handoff_id="handoff1",request_id="request1",source_id=source.source_id,source_hash=source.content_hash,recipient_id=reviewer.assignment_id,
        predecessor_id=None,predecessor_hash=None,expires_at=NOW+timedelta(minutes=20),**auth)
    return SimpleNamespace(**locals())


def review_source(x,mode="real",status="PASS",now=NOW,evidence_at=None,manifest_at=None,metadata_at=None):
    data=b"independent reviewer evidence"; md=replace(x.metadata("review-log",data,x.reviewer.actor_id),created_at=metadata_at or now)
    e=x.results.capture_evidence(assignment=x.reviewer,evidence_id=md.artifact_id,kind="diff_review",source="independent_review",mode=mode,status=status,
        raw_hash=md.content_hash,command="pytest tests/x.py",exit_code=0 if status=="PASS" else 1,expected="review target",observed="reviewed",now=evidence_at or now)
    env=replace(x.envelope,result_id="review-result",delegation_id=x.reviewer.packet.delegation_id,evidence_refs=(EvidenceReference(md.artifact_id,md.content_hash),))
    result=RoleResult("reviewer_result/v1",x.reviewer.assignment_id,x.reviewer.content_hash,"REVIEWER",x.reviewer.actor_id,x.reviewer.context_id,TARGET,env,"completed",(),None,(e,))
    m=replace(x.manifest("review-manifest",(md,),x.reviewer.actor_id,"reviewer",AcquisitionMode.REAL),started_at=manifest_at or now,finished_at=manifest_at or now)
    return x.service.capture_reviewer(source_id="review-source",result=result,assignment=x.reviewer,manifest=m,metadata=(md,),now=now,expires_at=NOW+timedelta(minutes=30))


def test_normal_chain_is_bounded_and_exact_artifact_recovery_is_explicit():
    x=setup(); h=x.service.create(**x.create); view=x.service.project(h.handoff_id,**x.auth)
    assert h.stage=="DEVELOPER_TO_REVIEWER" and view["status"]=="DELIVERED_NOT_VERIFIED"
    assert "PRIVATE RAW TRANSCRIPT" not in json.dumps(view)
    assert x.service.resolve(h.handoff_id,"dev-transcript",**x.auth)==x.raw.artifact.content
    source=review_source(x)
    second=x.service.create(**{**x.create,"handoff_id":"handoff2","request_id":"request2","source_id":source.source_id,"source_hash":source.content_hash,
        "recipient_id":x.tester.assignment_id,"predecessor_id":h.handoff_id,"predecessor_hash":h.content_hash,
        "actor_id":x.tester.actor_id,"context_id":x.tester.context_id,"execution_fence":x.tester.execution_fence})
    assert second.stage=="REVIEWER_TO_TESTER" and second.predecessor_hash==h.content_hash
    assert view["accepted"] is False and view["state_transitions"]==[]


@pytest.mark.parametrize("field,value",[("actor_id","foreign"),("context_id","foreign"),("session_id","foreign"),("target_hash","sha256:"+"f"*64),
    ("execution_fence","stale"),("now",NOW+timedelta(hours=1)),("source_hash","sha256:"+"f"*64),("source_id","unknown"),("recipient_id",[])])
def test_foreign_stale_and_malformed_delivery_fails_without_partial_publication(field,value):
    x=setup()
    with pytest.raises(ValueError): x.service.create(**{**x.create,field:value})
    assert x.service.handoff_count==0


def test_replay_and_id_rebind_are_atomic_and_current_authority_precedes_replay():
    x=setup(); first=x.service.create(**x.create)
    assert x.service.create(**x.create)==first
    with pytest.raises(ValueError,match="REPLAY_CONFLICT"): x.service.create(**{**x.create,"handoff_id":"other"})
    with pytest.raises(ValueError,match="HANDOFF_REBIND"): x.service.create(**{**x.create,"request_id":"other","expires_at":NOW+timedelta(minutes=10)})
    x.policy.revoke(x.reviewer.assignment_id)
    with pytest.raises(ValueError): x.service.create(**x.create)
    assert x.service.handoff_count==1


@pytest.mark.parametrize("ref",["unknown","../dev-log","https://example.test/raw","C:/raw"])
def test_explicit_resolve_rejects_nonmember_or_path_ref(ref):
    x=setup(); h=x.service.create(**x.create)
    with pytest.raises(ValueError): x.service.resolve(h.handoff_id,ref,**x.auth)


def test_artifact_tamper_missing_and_external_failure_never_publish():
    x=setup(); x.store.values["dev-log"]=b"changed"
    with pytest.raises(ValueError,match="ARTIFACT_INTEGRITY"): x.service.create(**x.create)
    assert x.service.handoff_count==0
    x=setup(); h=x.service.create(**x.create); del x.store.values["dev-transcript"]
    with pytest.raises(ValueError): x.service.resolve(h.handoff_id,"dev-transcript",**x.auth)


@pytest.mark.parametrize("field,value",[("environment_id","foreign"),("toolchain_versions",{}),("target_hash","sha256:"+"f"*64),
    ("delivered_artifact_hash","sha256:"+"f"*64),("actor_id","foreign"),("raw_artifact_checksums",()),("container_image_digest",None)])
def test_host_manifest_capture_rejects_missing_mismatch_and_forced_alias(field,value):
    x=setup(); object.__setattr__(x.m,field,value)
    with pytest.raises(ValueError): x.service.capture_developer(source_id="forged",manifest=x.m,metadata=x.metas,now=NOW,expires_at=NOW+timedelta(minutes=30))
    assert x.service.create(**x.create).source_id=="dev-source"


def test_metadata_media_and_manifest_bytes_must_match_current_store():
    x=setup(); md=replace(x.metas[1],media_type="text/plain")
    with pytest.raises(ValueError): x.service.capture_developer(source_id="other",manifest=x.m,metadata=(x.metas[0],md),now=NOW,expires_at=NOW+timedelta(minutes=30))


@pytest.mark.parametrize("mode,status",[("mock","PASS"),("fixture","PASS"),("static","PASS"),("build","PASS"),("real","SKIPPED"),("real","BLOCKED")])
def test_reviewer_nonindependent_pass_cannot_advance_to_tester(mode,status):
    x=setup()
    with pytest.raises(ValueError): review_source(x,mode,status)
    assert x.service.handoff_count==0


def test_reviewer_stage_skip_or_wrong_predecessor_cannot_publish():
    x=setup(); s=review_source(x)
    args={**x.create,"source_id":s.source_id,"source_hash":s.content_hash,"recipient_id":x.tester.assignment_id,
          "actor_id":x.tester.actor_id,"context_id":x.tester.context_id,"execution_fence":x.tester.execution_fence}
    with pytest.raises(ValueError,match="PREDECESSOR"): x.service.create(**args)
    h=x.service.create(**x.create)
    with pytest.raises(ValueError,match="PREDECESSOR"): x.service.create(**{**args,"handoff_id":"h2","request_id":"q2","predecessor_id":h.handoff_id,"predecessor_hash":TARGET})


def test_projection_and_returned_handoff_do_not_alias_canonical_state():
    x=setup(); h=x.service.create(**x.create); expected=h.content_hash
    object.__setattr__(h,"target_hash","sha256:"+"f"*64)
    view=x.service.project("handoff1",**x.auth); view["artifact_refs"].clear()
    assert x.service.create(**x.create).content_hash==expected
    assert len(x.service.project("handoff1",**x.auth)["artifact_refs"])==2


def test_raw_source_and_summary_size_are_bounded_on_capture():
    x=setup(); huge=replace(x.envelope,summary="x"*2049)
    raw=RawResultEnvelope("developer-session",LifecycleStatus.COMPLETED,{"result":huge.to_dict()})
    x.lifecycle._sessions["developer-session"]=replace(x.lifecycle.session("developer-session"),raw_result=raw)
    with pytest.raises(ValueError): x.service.capture_developer(source_id="huge",manifest=x.m,metadata=x.metas,now=NOW,expires_at=NOW+timedelta(minutes=30))


def test_registered_source_forced_mutation_is_rechecked():
    x=setup(); object.__setattr__(x.service._sources["dev-source"].manifest,"environment_id","forged")
    with pytest.raises(ValueError): x.service.create(**x.create)
    assert x.service.handoff_count==0


def test_lifecycle_payload_cannot_drift_behind_unchanged_raw_artifact_hash():
    x=setup(); raw=x.lifecycle.session("developer-session").raw_result
    changed=raw.to_dict()["payload"]; changed["result"]["summary"]="forged summary"
    object.__setattr__(raw,"payload",changed)
    with pytest.raises(ValueError,match="SOURCE_RESULT_DRIFT"):
        x.service.capture_developer(source_id="forged",manifest=x.m,metadata=x.metas,now=NOW,expires_at=NOW+timedelta(minutes=30))
    with pytest.raises(ValueError,match="SOURCE_RESULT_DRIFT"): x.service.create(**x.create)


@pytest.mark.parametrize("field,value",[("parent_run_id","foreign-run"),("step_id","foreign-step")])
def test_recipient_packet_must_share_exact_run_and_step_lineage(field,value):
    x=setup(); a=x.reviewer; packet=replace(a.packet,**{field:value})
    foreign=x.policy.register(assignment_id="foreign-assignment",definition=a.definition,packet=packet,actor_id=a.actor_id,context_id=a.context_id,
        thread_id=a.thread_id,workspace_id=a.workspace_id,session_id=a.session_id,context_snapshot_hash=packet.context_snapshot_hash,
        issued_at=NOW,expires_at=a.expires_at,execution_fence=a.execution_fence)
    with pytest.raises(ValueError,match="LINEAGE"): x.service.create(**{**x.create,"recipient_id":foreign.assignment_id})
    assert x.service.handoff_count==0


def test_tester_resolve_rechecks_exact_predecessor_and_developer_source():
    x=setup(); first=x.service.create(**x.create); source=review_source(x)
    auth={**x.auth,"actor_id":x.tester.actor_id,"context_id":x.tester.context_id,"execution_fence":x.tester.execution_fence}
    second=x.service.create(**{**x.create,**auth,"handoff_id":"h2","request_id":"q2","source_id":source.source_id,"source_hash":source.content_hash,
        "recipient_id":x.tester.assignment_id,"predecessor_id":first.handoff_id,"predecessor_hash":first.content_hash})
    object.__setattr__(x.service._handoffs[first.handoff_id],"target_hash","sha256:"+"f"*64)
    with pytest.raises(ValueError,match="PREDECESSOR"): x.service.resolve(second.handoff_id,"review-log",**auth)


@pytest.mark.parametrize("field,value",[("manifest_id","m"*10000),("unverified_scope",("u"*10000,)),("skipped_or_blocked",("s"*10000,))])
def test_manifest_projection_text_is_bounded_without_silent_truncation(field,value):
    x=setup(); manifest=replace(x.m,**{field:value})
    with pytest.raises(ValueError): x.service.capture_developer(source_id="oversized",manifest=manifest,metadata=x.metas,now=NOW,expires_at=NOW+timedelta(minutes=30))


def test_projection_preserves_source_status_and_honest_unverified_scope():
    x=setup(); h=x.service.create(**x.create); view=x.service.project(h.handoff_id,**x.auth)
    assert view["source_status"]=="COMPLETED"
    assert view["unverified_scope"]==["actual runtime"] and view["skipped_or_blocked"]==[]
    assert view["acquisition_mode"]=="fixture" and view["status"]=="DELIVERED_NOT_VERIFIED"


@pytest.mark.parametrize("phase",["capture","check","resolve"])
@pytest.mark.parametrize("field",["bytes","artifact_id","media_type","storage_ref","project_id","run_id","step_id","actor_id"])
def test_store_metadata_toctou_cannot_change_expected_bytes_or_authority(phase,field):
    x=setup(); h=x.service.create(**x.create); source=x.service._sources["dev-source"]
    before=tuple(replace(m) for m in source.metadata); original=x.store.read; calls=0
    def malicious(metadata):
        nonlocal calls
        calls+=1; raw=original(metadata)
        # resolve performs two evidence checks before its final explicit read.
        if phase!="resolve" or calls==3:
            if field=="bytes":
                raw=b"attacker replacement"; object.__setattr__(metadata,"content_hash",digest(raw)); object.__setattr__(metadata,"byte_size",len(raw))
            else: object.__setattr__(metadata,field,"foreign")
        return raw
    x.store.read=malicious
    with pytest.raises(ValueError,match="ARTIFACT_INTEGRITY"):
        if phase=="capture": x.service.capture_developer(source_id="new",manifest=x.m,metadata=x.metas,now=NOW,expires_at=NOW+timedelta(minutes=30))
        elif phase=="check": x.service.project(h.handoff_id,**x.auth)
        else: x.service.resolve(h.handoff_id,"dev-log",**x.auth)
    assert source.metadata==before and x.service.handoff_count==1
    assert "new" not in x.service._sources


def test_final_store_read_cannot_mutate_source_manifest_behind_published_ref():
    x=setup(); h=x.service.create(**x.create); original=x.store.read; calls=0
    def malicious(metadata):
        nonlocal calls
        calls+=1
        if calls==3: object.__setattr__(x.service._sources["dev-source"].manifest,"environment_id","foreign")
        return original(metadata)
    x.store.read=malicious
    with pytest.raises(ValueError,match="SOURCE_UNKNOWN_OR_TAMPERED"):
        x.service.resolve(h.handoff_id,"dev-log",**x.auth)


@pytest.mark.parametrize("toolchain",[
    {"python":"x"*1000000},{"k"*65:"v"},{"k":"v"*257},
    {str(i):"v" for i in range(33)},{str(i):"v"*256 for i in range(17)}, {"k":"한"*86}],
    ids=["million","key","value","count","aggregate","utf8"])
def test_toolchain_context_bounds_are_enforced_before_capture(toolchain):
    with pytest.raises(ValueError,match="TOOLCHAIN_TOO_LARGE"): setup(toolchain)


def test_projection_aggregate_bound_fails_before_publication():
    x=setup(); extras=tuple(x.metadata("extra"+str(i)+"x"*115,str(i).encode(),"developer") for i in range(62))
    metadata=x.metas+extras
    manifest=replace(x.manifest("bounded",metadata,"developer","developer"),
        skipped_or_blocked=tuple("s"*256 for _ in range(32)),unverified_scope=tuple("u"*256 for _ in range(32)))
    source=x.service.capture_developer(source_id="large",manifest=manifest,metadata=metadata,now=NOW,expires_at=NOW+timedelta(minutes=30))
    with pytest.raises(ValueError,match="PROJECTION_TOO_LARGE"):
        x.service.create_projection(**{**x.create,"source_id":source.source_id,"source_hash":source.content_hash})
    assert x.service.handoff_count==0


@pytest.mark.parametrize("early",["source","evidence","manifest","metadata"])
def test_predecessor_causality_rejects_review_captured_before_delivery(early):
    x=setup(); delivered=NOW+timedelta(seconds=10); later=NOW+timedelta(seconds=20)
    h=x.service.create(**{**x.create,"now":delivered})
    kwargs={"now":later}
    if early=="source": kwargs["now"]=NOW
    else: kwargs[early+"_at"]=NOW
    s=review_source(x,**kwargs)
    with pytest.raises(ValueError,match="PREDECESSOR_CAUSALITY_MISMATCH"):
        x.service.create(**{**x.create,"handoff_id":"h2","request_id":"q2","source_id":s.source_id,"source_hash":s.content_hash,
            "recipient_id":x.tester.assignment_id,"predecessor_id":h.handoff_id,"predecessor_hash":h.content_hash,
            "actor_id":x.tester.actor_id,"context_id":x.tester.context_id,"execution_fence":x.tester.execution_fence,"now":later})
    assert x.service.handoff_count==1


@pytest.mark.parametrize("mutation",["revoke","source","evidence","predecessor","developer"])
def test_store_callback_cannot_invalidate_source_authority_before_publication(mutation):
    x=setup(); h=x.service.create(**x.create); s=review_source(x); original=x.store.read
    def change_authority(metadata):
        raw=original(metadata)
        if metadata.artifact_id=="review-log":
            if mutation=="revoke": x.policy.revoke(x.reviewer.assignment_id)
            elif mutation=="source": object.__setattr__(x.service._sources[s.source_id],"execution_fence","wrong")
            elif mutation=="evidence": object.__setattr__(x.results._captures["review-log"],"raw_hash",TARGET)
            elif mutation=="predecessor": object.__setattr__(x.service._handoffs[h.handoff_id],"summary","wrong")
            else:
                raw_result=x.lifecycle.session("developer-session").raw_result
                object.__setattr__(raw_result,"payload",{"wrong":True})
        return raw
    x.store.read=change_authority
    with pytest.raises(ValueError):
        x.service.create(**{**x.create,"handoff_id":"h2","request_id":"q2","source_id":s.source_id,"source_hash":s.content_hash,
            "recipient_id":x.tester.assignment_id,"predecessor_id":h.handoff_id,"predecessor_hash":h.content_hash,
            "actor_id":x.tester.actor_id,"context_id":x.tester.context_id,"execution_fence":x.tester.execution_fence})
    assert x.service.handoff_count==1


@pytest.mark.parametrize("mutation",["predecessor","handoff"])
def test_last_predecessor_artifact_read_cannot_change_projection_seals(mutation):
    x=setup(); first=x.service.create(**x.create); s=review_source(x)
    auth={**x.auth,"actor_id":x.tester.actor_id,"context_id":x.tester.context_id,"execution_fence":x.tester.execution_fence}
    h=x.service.create(**{**x.create,**auth,"handoff_id":"h2","request_id":"q2","source_id":s.source_id,"source_hash":s.content_hash,
        "recipient_id":x.tester.assignment_id,"predecessor_id":first.handoff_id,"predecessor_hash":first.content_hash})
    original=x.store.read
    def malicious(metadata):
        if metadata.artifact_id=="dev-transcript":
            target=first.handoff_id if mutation=="predecessor" else h.handoff_id
            object.__setattr__(x.service._handoffs[target],"summary","forged")
        return original(metadata)
    x.store.read=malicious
    with pytest.raises(ValueError): x.service.project(h.handoff_id,**auth)
