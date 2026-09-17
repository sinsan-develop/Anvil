"""Manual, in-memory external verification contract. No real provider execution."""
import base64
import copy
import json
from dataclasses import replace
from datetime import timedelta
import pytest
from tests.agent_team.test_handoff_e02 import setup, NOW, TARGET, digest
from packages.orchestration.result_envelope import EvidenceReference

DESIGN=b"# Design\n## 1 Authority\nOnly a human can approve changes.\n## 2 Evidence\nPreserve exact evidence.\n"
QUOTE="## 1 Authority\nOnly a human can approve changes."


def fixture(backend="CLAUDE",requirements=None):
    from packages.agent_team.external_verifier import ExternalVerifierAdapter
    x=setup(); h=x.service.create(**x.create)
    requirements=requirements if requirements is not None else ({"validation_id":"AV-AGT-002","severity":"MAJOR","clause":None,"quote":None},
        {"validation_id":"AV-SAFE-022","severity":"CRITICAL","clause":"1","quote":QUOTE})
    adapter=ExternalVerifierAdapter(x.service,design_bytes=DESIGN,design_hash=digest(DESIGN),requirements=requirements,native_backend=backend)
    args=dict(bundle_id="bundle",handoff_id=h.handoff_id,expires_at=NOW+timedelta(minutes=10),**x.auth)
    raw=adapter.export_bundle(**args)
    return x,adapter,args,raw


def response(x,raw,backend="CLAUDE"):
    export=json.loads(raw); transcript=b"Independent manual review observation, fixture only."
    native=replace(x.envelope,result_id="external-result",delegation_id=x.reviewer.packet.delegation_id,
        evidence_refs=(EvidenceReference("external-transcript",digest(transcript)),),summary="Manual review claim")
    value={"schema_version":"external_verification_response/v1","bundle_id":export["bundle_id"],"bundle_hash":digest(raw),
        "target_hash":TARGET,"assignment_hash":x.reviewer.content_hash,"native_backend":backend,
        "provider":"ANTHROPIC",
        "verifier":{"actor_id":x.reviewer.actor_id,"context_id":x.reviewer.context_id,"workspace_id":x.reviewer.workspace_id},
        "limitations":["Manual fixture; provider authenticity unverified"],"result":native.to_dict(),
        "artifacts":[{"artifact_id":"external-transcript","checksum":digest(transcript),"byte_size":len(transcript),"media_type":"text/plain",
            "data_base64":base64.b64encode(transcript).decode()}]}
    return json.dumps(value,sort_keys=True,separators=(",",":")).encode()


def capture(x,a,data):
    return a.capture_import(authorization_id="manual-proof",bundle_id="bundle",response_bytes=data,
        verifier_assignment_id=x.reviewer.assignment_id,now=NOW,expires_at=NOW+timedelta(minutes=5))


@pytest.mark.parametrize("backend",["CLAUDE","CODEX","LOCAL"])
def test_backend_neutral_manual_roundtrip_preserves_owner_contracts_and_refs(backend):
    x,a,args,raw=fixture(backend); exported=json.loads(raw)
    assert exported["packet"]["schema_version"]=="delegation_packet/v1"
    assert exported["native_result"]["schema_version"]=="subagent_result/v1"
    assert exported["packet"]["permission_snapshot"]==x.dp.to_dict()["permission_snapshot"]
    assert exported["packet"]==x.dp.to_dict() and exported["native_result"]==x.envelope.to_dict()
    view=a.project("bundle",**x.auth)
    assert "PRIVATE RAW TRANSCRIPT" not in json.dumps(view)
    assert a.resolve_artifact("bundle","dev-transcript",**x.auth)==x.raw.artifact.content
    data=response(x,raw,backend); proof=capture(x,a,data)
    result=a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    assert result["status"]=="IMPORTED_MANUAL_RESULT" and result["accepted"] is False and result["state_transitions"]==[]
    assert result["provider_authenticity"]=="UNVERIFIED" and result["declared_status"]=="COMPLETED"
    assert result["native_backend"]==backend and "Manual fixture" in result["limitations"][0]
    assert a.resolve_artifact("bundle","external-transcript",**x.auth)==b"Independent manual review observation, fixture only."
    assert a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)==result
    assert a.export_bundle(**args)==raw


@pytest.mark.parametrize("mutate",["schema","target","bundle_hash","assignment","backend","provider","actor","context","workspace","result_schema","result_target","result_evidence","artifact_hash","artifact_size","artifact_media","artifact_path","limitations","extra"])
def test_manual_response_mismatch_never_registers_authority_or_import(mutate):
    x,a,args,raw=fixture(); value=json.loads(response(x,raw))
    if mutate in {"schema","target","bundle_hash","assignment","backend","provider"}:
        field={"schema":"schema_version","target":"target_hash","assignment":"assignment_hash","backend":"native_backend"}.get(mutate,mutate)
        value[field]="foreign"
    elif mutate in {"actor","context","workspace"}: value["verifier"][mutate+"_id"]="foreign"
    elif mutate.startswith("result_"):
        field={"result_schema":"schema_version","result_target":"target_hash","result_evidence":"evidence_refs"}[mutate]
        value["result"][field]=[] if field=="evidence_refs" else "foreign"
    elif mutate.startswith("artifact_"):
        field={"artifact_hash":"checksum","artifact_size":"byte_size","artifact_media":"media_type","artifact_path":"artifact_id"}[mutate]
        value["artifacts"][0][field]=0 if field=="byte_size" else "../foreign"
    elif mutate=="limitations":value["limitations"]=[]
    else:value["approve"]=True
    with pytest.raises(ValueError):capture(x,a,json.dumps(value).encode())
    assert a.import_count==0 and a.authorization_count==0


@pytest.mark.parametrize("field,value",[("actor_id","foreign"),("context_id","foreign"),("session_id","foreign"),("target_hash","sha256:"+"f"*64),("execution_fence","old"),("now",NOW+timedelta(hours=1))])
def test_current_authority_is_required_even_for_replay(field,value):
    x,a,args,raw=fixture(); data=response(x,raw); proof=capture(x,a,data)
    with pytest.raises(ValueError):a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**{**x.auth,field:value})
    assert a.import_count==0


def test_self_mint_and_same_key_different_response_are_denied():
    x,a,args,raw=fixture(); data=response(x,raw)
    with pytest.raises(ValueError):a.import_bundle(authorization_id="unknown",response_bytes=data,**x.auth)
    proof=capture(x,a,data); different=json.loads(data);different["result"]["summary"]="Different"
    with pytest.raises(ValueError):a.import_bundle(authorization_id=proof.authorization_id,response_bytes=json.dumps(different).encode(),**x.auth)
    with pytest.raises(ValueError):capture(x,a,json.dumps(different).encode())
    assert a.import_count==0


@pytest.mark.parametrize("quote,clause",[(None,"1"),("fabricated","1"),(QUOTE,"2"),(QUOTE,None)])
def test_critical_input_requires_exact_canonical_clause_and_document_hash(quote,clause):
    with pytest.raises(ValueError):fixture(requirements=({"validation_id":"AV-SAFE-022","severity":"CRITICAL","quote":quote,"clause":clause},))


def test_critical_quote_hash_and_raw_document_are_bound_and_detached():
    x,a,args,raw=fixture(); value=json.loads(raw); clause=value["requirements"][1]
    assert value["design_document_hash"]==digest(DESIGN) and clause["quote"]==QUOTE and clause["quote_hash"]==digest(QUOTE.encode())
    value["requirements"][1]["quote"]="mutated"
    assert json.loads(a.export_bundle(**args))["requirements"][1]["quote"]==QUOTE


@pytest.mark.parametrize("secret",["token=FAKE_TEST_ONLY","api key=FAKE_TEST_ONLY","postgresql://admin:FAKE_TEST_ONLY@db/app",'API\\tKEY=FAKE_TEST_ONLY'])
def test_secret_like_manual_response_is_rejected_without_value_disclosure(secret):
    x,a,args,raw=fixture(); value=json.loads(response(x,raw)); value["limitations"]=[secret]
    with pytest.raises(ValueError) as error:capture(x,a,json.dumps(value).encode())
    assert "FAKE_TEST_ONLY" not in str(error.value) and a.authorization_count==0


def test_revoked_assignment_blocks_export_import_and_resolve():
    x,a,args,raw=fixture(); data=response(x,raw);proof=capture(x,a,data); x.policy.revoke(x.reviewer.assignment_id)
    for action in (lambda:a.export_bundle(**args),lambda:a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth),lambda:a.resolve_artifact("bundle","dev-transcript",**x.auth)):
        with pytest.raises(ValueError):action()


def test_default_view_and_import_receipt_do_not_alias_registry():
    x,a,args,raw=fixture(); data=response(x,raw);proof=capture(x,a,data)
    result=a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth);result["limitations"].clear()
    view=a.project("bundle",**x.auth);view["artifact_refs"].clear()
    assert a.project("bundle",**x.auth)["artifact_refs"]
    assert a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)["limitations"]


def test_manual_claude_can_review_codex_native_result_without_relabelling_its_source():
    x,a,args,raw=fixture("CODEX"); value=json.loads(response(x,raw,"CODEX"));value["provider"]="ANTHROPIC"
    data=json.dumps(value).encode();proof=capture(x,a,data)
    result=a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    assert result["native_backend"]=="CODEX" and result["native_provider"]=="OPENAI"
    assert result["verifier_provider"]=="ANTHROPIC"


def test_artifact_callback_cannot_tamper_import_authorization_after_initial_check():
    x,a,args,raw=fixture();data=response(x,raw);proof=capture(x,a,data);original=x.store.read
    def mutate(metadata):
        object.__setattr__(a._authorizations[proof.authorization_id],"response_hash",TARGET)
        return original(metadata)
    x.store.read=mutate
    with pytest.raises(ValueError):a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    assert a.import_count==0


@pytest.mark.parametrize("field",["target_hash","packet","requirements","artifacts"])
def test_export_bundle_bytes_tamper_is_not_self_authorizing(field):
    x,a,args,raw=fixture();value=json.loads(raw);value[field]="forged";a._bundles["bundle"]=json.dumps(value).encode()
    with pytest.raises(ValueError):a.project("bundle",**x.auth)


def test_duplicate_json_fields_nonfinite_and_oversized_response_are_rejected():
    x,a,args,raw=fixture()
    for data in (b'{"x":1,"x":2}',b'{"x":NaN}',b"x"*(2*1024*1024+1)):
        with pytest.raises(ValueError):capture(x,a,data)
    assert a.authorization_count==0


def test_authorization_expiry_blocks_previously_imported_result_replay():
    x,a,args,raw=fixture();data=response(x,raw);proof=capture(x,a,data)
    a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    with pytest.raises(ValueError):a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**{**x.auth,"now":NOW+timedelta(minutes=5)})


@pytest.mark.parametrize("secret",["token=FAKE_TEST_ONLY",'API\tKEY=FAKE_TEST_ONLY','{"nested":[{"client secret":"FAKE_TEST_ONLY"}]}'])
def test_export_refuses_secret_in_actual_handoff_transcript(secret):
    from packages.agent_team.external_verifier import ExternalVerifierAdapter
    from packages.orchestration import RawResultEnvelope,LifecycleStatus
    x=setup();raw=RawResultEnvelope("developer-session",LifecycleStatus.COMPLETED,{"result":x.envelope.to_dict(),"raw_transcript":secret})
    x.lifecycle._sessions["developer-session"]=replace(x.lifecycle.session("developer-session"),raw_result=raw)
    meta=x.metadata("secret-transcript",raw.artifact.content,"developer");metas=(x.metas[0],meta)
    manifest=x.manifest("new",metas,"developer","developer")
    source=x.service.capture_developer(source_id="new",manifest=manifest,metadata=metas,now=NOW,expires_at=NOW+timedelta(minutes=30))
    h=x.service.create(**{**x.create,"source_id":source.source_id,"source_hash":source.content_hash})
    a=ExternalVerifierAdapter(x.service,design_bytes=DESIGN,design_hash=digest(DESIGN),requirements=({"validation_id":"AV-SAFE-022","severity":"CRITICAL","clause":"1","quote":QUOTE},),native_backend="CLAUDE")
    with pytest.raises(ValueError) as error:a.export_bundle(bundle_id="secret",handoff_id=h.handoff_id,expires_at=NOW+timedelta(minutes=10),**x.auth)
    assert "FAKE_TEST_ONLY" not in str(error.value) and a._bundles=={}


def test_design_document_hash_cannot_be_supplied_as_an_unchecked_claim():
    from packages.agent_team.external_verifier import ExternalVerifierAdapter
    x=setup()
    with pytest.raises(ValueError):ExternalVerifierAdapter(x.service,design_bytes=DESIGN,design_hash=TARGET,
        requirements=({"validation_id":"AV-SAFE-022","severity":"CRITICAL","clause":"1","quote":QUOTE},),native_backend="CLAUDE")


def test_reviewer_export_binds_reviewer_packet_and_result_not_developer_permissions():
    from tests.agent_team.test_handoff_e02 import review_source
    from packages.agent_team.role_contracts import contract_hash
    x,a,args,raw=fixture(); first=x.service._handoffs[args["handoff_id"]]; s=review_source(x)
    auth={**x.auth,"actor_id":x.tester.actor_id,"context_id":x.tester.context_id,"execution_fence":x.tester.execution_fence}
    h=x.service.create(**{**x.create,**auth,"handoff_id":"review-handoff","request_id":"review-request","source_id":s.source_id,"source_hash":s.content_hash,
        "recipient_id":x.tester.assignment_id,"predecessor_id":first.handoff_id,"predecessor_hash":first.content_hash})
    value=json.loads(a.export_bundle(bundle_id="review-bundle",handoff_id=h.handoff_id,expires_at=NOW+timedelta(minutes=10),**auth))
    assert value["packet"]==x.reviewer.packet.to_dict()
    assert value["source_role"]=="REVIEWER"
    assert value["source_packet_hash"]==x.reviewer.packet.packet_hash
    assert value["source_result_hash"]==contract_hash(x.service._sources[s.source_id].result)
    assert value["native_result"]["delegation_id"]==value["packet"]["delegation_id"]


@pytest.mark.parametrize("operation",["capture","import","project","resolve"])
@pytest.mark.parametrize("mutation",["bytes","seal"])
def test_adapter_callback_cannot_change_bundle_snapshot(operation,mutation):
    x,a,args,raw=fixture();data=response(x,raw);proof=capture(x,a,data);original=x.store.read
    def mutate(metadata):
        result=original(metadata)
        if mutation=="bytes":a._bundles["bundle"]=raw+b" "
        else:a._seals["bundle"]=TARGET
        return result
    x.store.read=mutate
    with pytest.raises(ValueError):
        if operation=="capture":capture(x,a,data)
        elif operation=="import":a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
        elif operation=="project":a.project("bundle",**x.auth)
        else:a.resolve_artifact("bundle","dev-transcript",**x.auth)
    assert a.import_count==0


@pytest.mark.parametrize("secret",["ａｐｉ＿ｋｅｙ=FAKE_TEST_ONLY","api\u200b_key=FAKE_TEST_ONLY","api\\u200b_key=FAKE_TEST_ONLY","ａｐｉ%EF%BC%BFｋｅｙ=FAKE_TEST_ONLY"])
@pytest.mark.parametrize("location",["transcript","response","structured"])
def test_unicode_credentials_are_rejected_before_export_or_import(secret,location):
    if location=="transcript":
        test_export_refuses_secret_in_actual_handoff_transcript(secret)
        return
    x,a,args,raw=fixture();value=json.loads(response(x,raw))
    if location=="response":value["limitations"]=[secret]
    else:
        artifact=value["artifacts"][0]; payload=json.dumps({secret.split("=")[0]:"FAKE_TEST_ONLY"}).encode()
        artifact.update(checksum=digest(payload),byte_size=len(payload),media_type="application/json",data_base64=base64.b64encode(payload).decode())
        value["result"]["evidence_refs"][0]["checksum"]=digest(payload)
    with pytest.raises(ValueError) as error:capture(x,a,json.dumps(value).encode())
    assert "FAKE_TEST_ONLY" not in str(error.value) and a.authorization_count==0 and a.import_count==0


@pytest.mark.parametrize("mutation",["bytes","seal"])
def test_last_store_callback_cannot_publish_import_from_changed_bundle(mutation):
    x,a,args,raw=fixture();data=response(x,raw);proof=capture(x,a,data);original=x.store.read;calls=[]
    def count(metadata):calls.append(metadata.artifact_id);return original(metadata)
    x.store.read=count
    a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    total=len(calls)
    x,a,args,raw=fixture();data=response(x,raw);proof=capture(x,a,data);original=x.store.read;calls=[]
    def mutate(metadata):
        result=original(metadata);calls.append(metadata.artifact_id)
        if len(calls)==total:
            if mutation=="bytes":a._bundles["bundle"]=raw+b" "
            else:a._seals["bundle"]=TARGET
        return result
    x.store.read=mutate
    with pytest.raises(ValueError):a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    assert len(calls)==total and a.import_count==0


@pytest.mark.parametrize("text",["한국어 검증 결과입니다.","ＡＢＣ Unicode prose","api key documentation without assignment"])
def test_inspection_normalization_preserves_safe_original_content(text):
    x,a,args,raw=fixture();value=json.loads(response(x,raw));value["limitations"]=[text]
    data=json.dumps(value).encode();proof=capture(x,a,data)
    assert a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)["limitations"]==[text]


@pytest.mark.parametrize("empty",[None,"",[],{}])
def test_normalized_empty_credential_keys_preserve_d03_semantics(empty):
    from packages.agent_team.external_verifier import _safe
    _safe({"ａｐｉ＿ｋｅｙ":empty})


@pytest.mark.parametrize("secret",["ａｐｉ＿ｋｅｙ=FAKE_TEST_ONLY","api\u200b_key=FAKE_TEST_ONLY"])
def test_legacy_imported_unicode_artifact_cannot_be_resolved(monkeypatch,secret):
    import packages.agent_team.external_verifier as module
    x,a,args,raw=fixture();value=json.loads(response(x,raw));payload=secret.encode();artifact=value["artifacts"][0]
    artifact.update(checksum=digest(payload),byte_size=len(payload),data_base64=base64.b64encode(payload).decode())
    value["result"]["evidence_refs"][0]["checksum"]=digest(payload);data=json.dumps(value).encode()
    # Simulate a bundle accepted by the previous scanner, not public self-mint.
    with monkeypatch.context() as legacy:
        legacy.setattr(module,"_safe",lambda value:None)
        proof=capture(x,a,data);a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    with pytest.raises(ValueError) as error:a.resolve_artifact("bundle",artifact["artifact_id"],**x.auth)
    assert "FAKE_TEST_ONLY" not in str(error.value)


def r2_encoded_key(depth=1):
    from urllib.parse import quote
    text="ａｐｉ＿ｋｅｙ"
    for _ in range(depth):text=quote(text,safe="").replace("%","％")
    return text+"=FAKE_TEST_ONLY"


@pytest.mark.parametrize("depth",[1,2,4,5])
def test_r2_normalization_exposes_encoded_credentials_before_export(depth):
    test_export_refuses_secret_in_actual_handoff_transcript(r2_encoded_key(depth))


def r2_response_artifact(x,raw,payload,media="application/json"):
    value=json.loads(response(x,raw));artifact=value["artifacts"][0]
    artifact.update(checksum=digest(payload),byte_size=len(payload),media_type=media,data_base64=base64.b64encode(payload).decode())
    value["result"]["evidence_refs"][0]["checksum"]=digest(payload)
    return json.dumps(value).encode()


@pytest.mark.parametrize("empty",["",None,[],{}])
def test_r2_json_artifact_empty_credentials_survive_import_and_exact_resolution(empty):
    x,a,args,raw=fixture();payload=json.dumps({"nested":[{"api key":empty}],"text":"안전한 ＡＢＣ 문구"},ensure_ascii=False).encode()
    data=r2_response_artifact(x,raw,payload);proof=capture(x,a,data)
    assert a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)["accepted"] is False
    assert a.resolve_artifact("bundle","external-transcript",**x.auth)==payload


@pytest.mark.parametrize("operation",["import","resolve"])
@pytest.mark.parametrize("depth",[1,2,4,5])
def test_r2_legacy_encoded_response_fails_current_consumption(monkeypatch,operation,depth):
    import packages.agent_team.external_verifier as module
    x,a,args,raw=fixture();data=r2_response_artifact(x,raw,r2_encoded_key(depth).encode(),"text/plain")
    with monkeypatch.context() as legacy:
        legacy.setattr(module,"_safe",lambda value:None)
        proof=capture(x,a,data)
        if operation=="resolve":a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
    with pytest.raises(ValueError) as error:
        if operation=="import":a.import_bundle(authorization_id=proof.authorization_id,response_bytes=data,**x.auth)
        else:a.resolve_artifact("bundle","external-transcript",**x.auth)
    assert "FAKE_TEST_ONLY" not in str(error.value)


@pytest.mark.parametrize("value",["FAKE_TEST_ONLY",["FAKE_TEST_ONLY"],{"nested":"FAKE_TEST_ONLY"},0,False])
def test_r2_json_artifact_nonempty_credential_semantics_still_rejected(value):
    x,a,args,raw=fixture();payload=json.dumps({"nested":[{"api key":value}]}).encode()
    with pytest.raises(ValueError):capture(x,a,r2_response_artifact(x,raw,payload))
    assert a.authorization_count==0
