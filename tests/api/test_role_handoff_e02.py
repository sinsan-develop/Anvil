"""Framework-neutral API fixture, no HTTP/UI/server execution."""
import pytest
from tests.agent_team.test_handoff_e02 import setup, NOW


def api_fixture():
    from packages.api.role_handoff import RoleHandoffAPI
    x=setup(); api=RoleHandoffAPI(x.service,**{k:v for k,v in x.auth.items() if k!="now"})
    payload={k:v for k,v in x.create.items() if k not in x.auth}
    return x,api,payload


def test_api_create_projection_and_explicit_resolve_are_separate():
    x,api,payload=api_fixture()
    created=api.request("create",payload,now=NOW)
    assert created["status"]==201 and created["body"]["status"]=="DELIVERED_NOT_VERIFIED"
    view=api.request("project",{"handoff_id":"handoff1"},now=NOW)
    assert view["status"]==200 and "PRIVATE RAW TRANSCRIPT" not in str(view)
    resolved=api.request("resolve",{"handoff_id":"handoff1","artifact_id":"dev-transcript"},now=NOW)
    assert resolved["status"]==200 and resolved["body"]["bytes"]==x.raw.artifact.content


@pytest.mark.parametrize("extra",["manifest","source_result","actor_id","context_id","execution_fence","raw_transcript","stdout","body","content","log"])
def test_api_rejects_authority_mint_and_raw_payload_fields(extra):
    x,api,payload=api_fixture(); result=api.request("create",{**payload,extra:"PRIVATE"},now=NOW)
    assert result["status"]==400 and "PRIVATE" not in str(result)
    assert x.service.handoff_count==0


@pytest.mark.parametrize("operation",["capture_developer","capture_reviewer","approve","launch","release","apply"])
def test_api_does_not_expose_host_authority_or_downstream_execution(operation):
    x,api,payload=api_fixture(); result=api.request(operation,{},now=NOW)
    assert result["status"]==400 and x.service.handoff_count==0


def test_api_foreign_reader_cannot_resolve_and_errors_are_value_safe():
    from packages.api.role_handoff import RoleHandoffAPI
    x,api,payload=api_fixture(); api.request("create",payload,now=NOW)
    foreign=RoleHandoffAPI(x.service,**{**{k:v for k,v in x.auth.items() if k!="now"},"actor_id":"foreign"})
    result=foreign.request("resolve",{"handoff_id":"handoff1","artifact_id":"dev-transcript"},now=NOW)
    assert result["status"]==400 and "PRIVATE" not in str(result)


def test_create_api_does_not_reread_store_after_publishing_handoff():
    x,api,payload=api_fixture(); original=x.store.read
    def fail_after_publish(metadata):
        if x.service.handoff_count: raise OSError("late storage fault")
        return original(metadata)
    x.store.read=fail_after_publish
    result=api.request("create",payload,now=NOW)
    assert result["status"]==201 and x.service.handoff_count==1
