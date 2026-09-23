"""F-06 host-only OpenRouter adapter contract tests."""
import pytest

from packages.llm_gateway.contracts import GatewayRequest, UsageProvenance
from packages.providers.openrouter_adapter import OpenRouterAdapter
from packages.providers.openrouter_errors import OpenRouterAdapterError
from packages.providers.openrouter_models import TransportResponse


class FakeTransport:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, *, operation, payload, request_id, stream):
        self.calls.append((operation, payload, request_id, stream))
        return self.responses.pop(0)


def wire(body, status=200, headers=()):
    return TransportResponse(status, tuple(headers), body)


def request(**changes):
    values = dict(provider="openrouter", model="author/model", input_text="hello", request_id="r1")
    values.update(changes)
    return GatewayRequest(**values)


def completion(**changes):
    body = dict(id="gen-1", object="chat.completion", model="served/model",
                choices=[dict(index=0, message=dict(role="assistant", content="answer"), finish_reason="stop")],
                usage=dict(prompt_tokens=2, completion_tokens=3, total_tokens=5))
    body.update(changes)
    return body


def frame(choices, **extra):
    return dict(id="gen-1", object="chat.completion.chunk", model="served/model", choices=choices, **extra)


def delta(content=None, finish=None):
    return [dict(index=0, delta={} if content is None else dict(content=content), finish_reason=finish)]


def test_generate_retains_requested_served_and_unverified_upstream():
    transport = FakeTransport(wire(completion()))
    adapter = OpenRouterAdapter(transport)
    response = adapter.generate(request())
    evidence = adapter.receipt("r1").to_dict()
    assert (response.provider, response.model, response.output_text) == ("openrouter", "author/model", "answer")
    assert response.final_usage.total_tokens == 5 and response.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert (evidence["requested_model"], evidence["served_model"], evidence["generation_id"]) == ("author/model", "served/model", "gen-1")
    assert evidence["upstream_provider"] == "UNVERIFIED" and evidence["billed_cost_usd"] is None
    assert transport.calls == [("generate", {"model":"author/model","messages":[{"role":"user","content":"hello"}]}, "r1", False)]


def test_generation_metadata_proves_upstream_and_billed_cost():
    body = completion(generation=dict(provider_name="Nvidia", model="nvidia/actual", upstream_id="up-1", total_cost="0.00012"))
    evidence = OpenRouterAdapter(FakeTransport(wire(body))).generate(request())
    assert evidence.output_text == "answer"
    # A fresh adapter preserves the evidence separately from GatewayResponse.
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    adapter.generate(request())
    receipt = adapter.receipt("r1").to_dict()
    assert (receipt["upstream_provider"], receipt["upstream_model"], receipt["upstream_id"]) == ("Nvidia", "nvidia/actual", "up-1")
    assert receipt["billed_cost_usd"] == "0.00012" and receipt["billed_cost_source"] == "generation.total_cost"


def test_stream_role_only_null_usage_and_terminal_empty_choices():
    usage = dict(prompt_tokens=2, completion_tokens=1, total_tokens=3)
    frames = [frame([dict(index=0, delta=dict(role="assistant"), finish_reason=None)], usage=None),
              frame(delta("answer"), usage=None), frame(delta(finish="stop"), usage=None),
              frame([], usage=usage)]
    transport = FakeTransport(wire(frames))
    adapter = OpenRouterAdapter(transport)
    result = adapter.stream(request())
    assert result.chunks == ("answer",) and result.response.final_usage.total_tokens == 3
    assert transport.calls[0][1]["stream_options"] == {"include_usage": True}
    assert adapter.receipt("r1") == result.receipt


def test_terminal_stream_metadata_supplies_authoritative_lineage():
    usage = dict(prompt_tokens=2, completion_tokens=1, total_tokens=3)
    frames = [frame(delta("answer")), frame(delta(finish="stop")),
              frame([], usage=usage, generation={"provider_name":"Nvidia", "model":"actual-model",
                                                   "upstream_id":"up-1", "total_cost":"0.0003"})]
    adapter = OpenRouterAdapter(FakeTransport(wire(frames)))
    adapter.stream(request())
    evidence = adapter.receipt("r1").to_dict()
    assert (evidence["upstream_provider"], evidence["upstream_model"], evidence["upstream_id"]) == ("Nvidia", "actual-model", "up-1")
    assert evidence["billed_cost_usd"] == "0.0003"


def test_conflicting_stream_routing_metadata_has_no_receipt():
    usage = dict(prompt_tokens=2, completion_tokens=1, total_tokens=3)
    frames = [frame(delta("answer"), generation={"provider_name":"Nvidia"}),
              frame(delta(finish="stop"), generation={"provider_name":"Other"}),
              frame([], usage=usage)]
    adapter = OpenRouterAdapter(FakeTransport(wire(frames)))
    with pytest.raises(OpenRouterAdapterError, match="ROUTING_METADATA_CONFLICT"):
        adapter.stream(request())
    with pytest.raises(OpenRouterAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("r1")


@pytest.mark.parametrize("error, expected", [
    ({"code":502,"message":"secret upstream text","metadata":{"error_type":"provider_unavailable"}}, "TEMPORARY_5XX"),
    ({"code":429,"message":"rate limited","metadata":{"error_type":"rate_limited"}}, "RATE_LIMIT"),
])
def test_midstream_error_chunk_fails_closed_without_receipt(error, expected):
    frames = [frame(delta("partial")), {"choices": [], "error": error, "provider": "Nvidia"}]
    adapter = OpenRouterAdapter(FakeTransport(wire(frames)))
    with pytest.raises(OpenRouterAdapterError, match=expected):
        adapter.stream(request())
    with pytest.raises(OpenRouterAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("r1")


def test_missing_final_usage_is_not_success():
    adapter = OpenRouterAdapter(FakeTransport(wire([frame(delta("answer")), frame(delta(finish="stop"))])))
    with pytest.raises(OpenRouterAdapterError, match="RESPONSE_MALFORMED"):
        adapter.stream(request())


def test_discovery_prices_are_quotes_and_not_health():
    body = {"data":[{"id":"author/model", "pricing":{"prompt":"0.000001", "completion":"0.000002"}}]}
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    item = adapter.discover(request_id="catalog").to_dict()
    assert item["models"] == [{"id":"author/model","quoted_prompt_usd_per_token":"0.000001","quoted_completion_usd_per_token":"0.000002"}]
    assert item["credential_health"] == "UNVERIFIED"


def test_catalog_numeric_price_is_not_silently_treated_as_quoted_string():
    body = {"data":[{"id":"author/model", "pricing":{"prompt":0.000001,"completion":"0.000002"}}]}
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    with pytest.raises(OpenRouterAdapterError, match="RESPONSE_MALFORMED"):
        adapter.discover(request_id="catalog")


def test_402_connection_quota_and_404_model_scope():
    for status, code, scope in [(402,"QUOTA_EXHAUSTED","connection"),(404,"MODEL_UNAVAILABLE","model")]:
        adapter = OpenRouterAdapter(FakeTransport(wire({"error":{"message":"private"}}, status=status)))
        with pytest.raises(OpenRouterAdapterError) as caught:
            adapter.generate(request())
        assert (caught.value.code, caught.value.scope) == (code, scope)


@pytest.mark.parametrize("operation", ["health", "discover"])
def test_nonmodel_operation_404_is_not_model_unavailable(operation):
    adapter = OpenRouterAdapter(FakeTransport(wire({"error":{"message":"endpoint absent"}}, status=404)))
    with pytest.raises(OpenRouterAdapterError) as caught:
        getattr(adapter, operation)(request_id="not-model")
    assert caught.value.code == "PROVIDER_ERROR_UNMAPPED" and caught.value.scope == "request"


def test_request_id_replay_and_failed_same_input_retry():
    transport = FakeTransport(wire({"error":{}}, status=503), wire(completion()))
    adapter = OpenRouterAdapter(transport)
    with pytest.raises(OpenRouterAdapterError): adapter.generate(request())
    assert adapter.generate(request()).output_text == "answer"
    assert adapter.generate(request()).output_text == "answer"
    with pytest.raises(OpenRouterAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(request(input_text="changed"))
    assert len(transport.calls) == 2


def test_pre_send_abort_and_post_send_usage_provenance():
    transport = FakeTransport()
    adapter = OpenRouterAdapter(transport)
    aborted = adapter.generate(request(abort_signal=lambda: True))
    assert aborted.abort_status == "ABORTED" and aborted.usage_provenance is UsageProvenance.ABORT_CONFIRMED
    assert not transport.calls
    state = {"aborted": False}
    class Aborting(FakeTransport):
        def request(self, **kwargs):
            state["aborted"] = True
            return super().request(**kwargs)
    adapter = OpenRouterAdapter(Aborting(wire(completion())))
    result = adapter.generate(request(abort_signal=lambda: state["aborted"]))
    assert result.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert result.usage_provenance is UsageProvenance.PROVIDER_FINAL


@pytest.mark.parametrize("body", [completion(usage=dict(prompt_tokens=1, completion_tokens=1, total_tokens=3)),
                                  completion(model=""), completion(choices=[])])
def test_malformed_success_has_no_receipt(body):
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    with pytest.raises(OpenRouterAdapterError): adapter.generate(request())
    with pytest.raises(OpenRouterAdapterError, match="RECEIPT_NOT_FOUND"): adapter.receipt("r1")


def test_nonfinite_json_is_rejected_before_credential_or_transport_use():
    with pytest.raises(ValueError, match="VALUE_NOT_PLAIN"):
        wire(completion(usage=dict(prompt_tokens=1, completion_tokens=1, total_tokens=2, cost=float("nan"))))


def test_unselected_available_provider_is_not_serving_proof():
    body = completion(openrouter_metadata={"endpoints":{"available":[{"provider":"Nvidia","model":"x"}]}})
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    adapter.generate(request())
    assert adapter.receipt("r1").to_dict()["upstream_provider"] == "UNVERIFIED"


def test_explicit_selected_endpoint_is_serving_proof():
    body = completion(openrouter_metadata={"endpoints":{"available":[{"selected":True,"provider":"Nvidia","model":"x"}]}})
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    adapter.generate(request())
    assert adapter.receipt("r1").to_dict()["upstream_provider"] == "Nvidia"


def test_conflicting_generation_and_selected_endpoint_fail_closed():
    body = completion(generation={"provider_name":"Nvidia", "model":"actual-model"},
        openrouter_metadata={"endpoints":{"available":[{"selected":True,"provider":"Other","model":"actual-model"}]}})
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    with pytest.raises(OpenRouterAdapterError, match="ROUTING_METADATA_CONFLICT"):
        adapter.generate(request())
    with pytest.raises(OpenRouterAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("r1")


def test_health_requires_host_authenticated_operation():
    transport = FakeTransport(wire({"data":{"limit":100,"limit_remaining":42.5,"is_free_tier":False}}))
    adapter = OpenRouterAdapter(transport)
    evidence = adapter.health(request_id="health-1").to_dict()
    assert evidence["credential_health"] == "VERIFIED"
    assert transport.calls == [("health", {}, "health-1", False)]


def test_auth_key_health_accepts_valid_response_without_quota_fields():
    transport = FakeTransport(wire({"data":{"label":"ok", "is_free_tier":False}}))
    adapter = OpenRouterAdapter(transport)
    evidence = adapter.health(request_id="auth-key").to_dict()
    assert evidence["credential_health"] == "VERIFIED"
    assert transport.calls == [("health", {}, "auth-key", False)]


@pytest.mark.parametrize("field,value", [("limit",-1),("limit_remaining",float("inf"))])
def test_present_auth_key_quota_fields_must_be_valid(field, value):
    if value == float("inf"):
        with pytest.raises(ValueError, match="VALUE_NOT_PLAIN"):
            wire({"data":{"label":"ok", "is_free_tier":False, field:value}})
        return
    adapter = OpenRouterAdapter(FakeTransport(wire({"data":{"label":"ok", "is_free_tier":False, field:value}})))
    with pytest.raises(OpenRouterAdapterError, match="RESPONSE_MALFORMED"):
        adapter.health(request_id="auth-key")


def test_public_catalog_does_not_substitute_for_authenticated_key_health():
    adapter = OpenRouterAdapter(FakeTransport(wire({"data":[{"id":"author/model"}]})))
    with pytest.raises(OpenRouterAdapterError, match="RESPONSE_MALFORMED"):
        adapter.health(request_id="h1")


def test_usage_cost_does_not_become_catalog_quote():
    body = completion(usage={"prompt_tokens":2,"completion_tokens":3,"total_tokens":5,"cost":0.00012})
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    adapter.generate(request())
    evidence = adapter.receipt("r1").to_dict()
    assert evidence["billed_cost_usd"] == "0.00012" and evidence["billed_cost_source"] == "usage.cost"


def test_conflicting_billed_sources_fail_closed():
    body = completion(generation={"total_cost":"0.01"}, usage={"prompt_tokens":2,"completion_tokens":3,"total_tokens":5,"cost":0.02})
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    with pytest.raises(OpenRouterAdapterError, match="BILLED_COST_CONFLICT"):
        adapter.generate(request())


def test_in_band_nonstream_error_has_no_receipt():
    adapter = OpenRouterAdapter(FakeTransport(wire({"error":{"code":402,"message":"insufficient credits"}})))
    with pytest.raises(OpenRouterAdapterError, match="QUOTA_EXHAUSTED"):
        adapter.generate(request())
    with pytest.raises(OpenRouterAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("r1")


def test_retry_after_bad_value_is_fail_closed():
    adapter = OpenRouterAdapter(FakeTransport(wire({"error":{}}, status=429, headers=(("retry-after","tomorrow"),))))
    with pytest.raises(OpenRouterAdapterError, match="RETRY_AFTER_INVALID"):
        adapter.generate(request())


def test_response_credential_text_is_not_persisted():
    body = completion()
    body["warning"] = "api_key=private-value"
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    with pytest.raises(OpenRouterAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        adapter.generate(request())


@pytest.mark.parametrize("sensitive", [{"api_key":"private-value"},
                                          {"meta":{"authorization":"Bearer private-value"}}])
def test_nested_credential_keys_are_rejected_before_receipt(sensitive):
    body = completion()
    body["metadata"] = sensitive
    adapter = OpenRouterAdapter(FakeTransport(wire(body)))
    with pytest.raises(OpenRouterAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        adapter.generate(request())
    with pytest.raises(OpenRouterAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("r1")


def test_operation_conflict_is_rejected_before_send():
    transport = FakeTransport(wire(completion()))
    adapter = OpenRouterAdapter(transport)
    adapter.generate(request())
    with pytest.raises(OpenRouterAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.discover(request_id="r1")
    assert len(transport.calls) == 1
