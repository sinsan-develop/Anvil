"""Framework-neutral manual API; no HTTP or external provider execution."""
import pytest
from tests.agent_team.test_external_verifier_e03 import fixture,response,capture,NOW


def api_fixture():
    from packages.api.external_verification import ExternalVerificationAPI
    x,a,args,raw=fixture(); api=ExternalVerificationAPI(a,**{k:v for k,v in x.auth.items() if k!="now"})
    return x,a,raw,api


def test_api_manual_import_and_explicit_raw_resolution_are_separate():
    x,a,raw,api=api_fixture();data=response(x,raw);proof=capture(x,a,data)
    result=api.request("import",{"authorization_id":proof.authorization_id,"response_bytes":data},now=NOW)
    assert result["status"]==200 and result["body"]["accepted"] is False
    view=api.request("project",{"bundle_id":"bundle"},now=NOW)
    assert view["status"]==200 and "PRIVATE RAW TRANSCRIPT" not in str(view)
    raw_result=api.request("resolve",{"bundle_id":"bundle","artifact_id":"dev-transcript"},now=NOW)
    assert raw_result["body"]["bytes"]==x.raw.artifact.content


@pytest.mark.parametrize("operation",["capture_import","approve","launch","send_claude","connect","accept","deploy"])
def test_api_cannot_mint_authority_or_connect_external_backend(operation):
    x,a,raw,api=api_fixture(); result=api.request(operation,{},now=NOW)
    assert result["status"]==400 and a.import_count==0


@pytest.mark.parametrize("field",["actor_id","execution_fence","provider","accepted","native_result"])
def test_api_rejects_payload_authority_fields(field):
    x,a,raw,api=api_fixture()
    result=api.request("project",{"bundle_id":"bundle",field:"FAKE_TEST_ONLY"},now=NOW)
    assert result["status"]==400 and "FAKE_TEST_ONLY" not in str(result)


@pytest.mark.parametrize("secret",["ａｐｉ＿ｋｅｙ=FAKE_TEST_ONLY","api\u200b_key=FAKE_TEST_ONLY"])
def test_api_rechecks_legacy_capture_unicode_before_import(monkeypatch,secret):
    import json
    import packages.agent_team.external_verifier as module
    x,a,raw,api=api_fixture();value=json.loads(response(x,raw));value["limitations"]=[secret];data=json.dumps(value).encode()
    with monkeypatch.context() as legacy:
        legacy.setattr(module,"_safe",lambda value:None)
        proof=capture(x,a,data)
    result=api.request("import",{"authorization_id":proof.authorization_id,"response_bytes":data},now=NOW)
    assert result["status"]==400 and "FAKE_TEST_ONLY" not in str(result) and a.import_count==0


@pytest.mark.parametrize("operation",["export","project","resolve"])
def test_r2_api_encoded_lifecycle_transcript_is_never_returned(monkeypatch,operation):
    from dataclasses import replace
    from datetime import timedelta
    from tests.agent_team.test_external_verifier_e03 import setup,DESIGN,QUOTE,digest,r2_encoded_key
    from packages.orchestration import RawResultEnvelope,LifecycleStatus
    from packages.api.external_verification import ExternalVerificationAPI
    import packages.agent_team.external_verifier as module
    x=setup();raw=RawResultEnvelope("developer-session",LifecycleStatus.COMPLETED,{"result":x.envelope.to_dict(),"raw_transcript":r2_encoded_key()})
    x.lifecycle._sessions["developer-session"]=replace(x.lifecycle.session("developer-session"),raw_result=raw)
    metadata=(x.metas[0],x.metadata("encoded-transcript",raw.artifact.content,"developer"))
    source=x.service.capture_developer(source_id="encoded-source",manifest=x.manifest("encoded-manifest",metadata,"developer","developer"),metadata=metadata,now=NOW,expires_at=NOW+timedelta(minutes=30))
    h=x.service.create(**{**x.create,"source_id":source.source_id,"source_hash":source.content_hash})
    a=module.ExternalVerifierAdapter(x.service,design_bytes=DESIGN,design_hash=digest(DESIGN),requirements=({"validation_id":"AV-SAFE-022","severity":"CRITICAL","clause":"1","quote":QUOTE},),native_backend="CLAUDE")
    api=ExternalVerificationAPI(a,**{k:v for k,v in x.auth.items() if k!="now"})
    request={"bundle_id":"encoded","handoff_id":h.handoff_id,"expires_at":NOW+timedelta(minutes=10)}
    if operation!="export":
        with monkeypatch.context() as legacy:
            legacy.setattr(module,"_safe",lambda value:None)
            a.export_bundle(**request,**x.auth)
        request={"bundle_id":"encoded"}
        if operation=="resolve":request["artifact_id"]="encoded-transcript"
    result=api.request(operation,request,now=NOW)
    assert result["status"]==400 and "FAKE_TEST_ONLY" not in str(result)
    assert a.import_count==0
