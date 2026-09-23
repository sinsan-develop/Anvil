"""F-09 host-only Anthropic native boundary contracts."""
import traceback

import pytest

from packages.llm_gateway.contracts import GatewayRequest, UsageProvenance
from packages.providers.anthropic_adapter import AnthropicAdapter
from packages.providers.anthropic_errors import AnthropicAdapterError
from packages.providers.anthropic_models import REGISTERED_MODELS, TransportResponse


MODEL = "claude-sonnet-4.6"
USAGE = {"input_tokens": 3, "output_tokens": 5, "cache_read_input_tokens": 2,
         "output_tokens_details": {"thinking_tokens": 1}}


class Host:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def request(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result


def response(body, status=200, headers=(), authenticated=False):
    return TransportResponse(status, tuple(headers), body, authenticated)


def request(id="f09:1", model=MODEL, signal=None):
    return GatewayRequest("anthropic", model, "hello", id, signal)


def message(*, content=None, usage=None, model=MODEL, stop="end_turn", id="msg_01ABC"):
    return {"id": id, "type": "message", "role": "assistant", "model": model,
            "content": [{"type": "text", "text": "answer"}] if content is None else content,
            "stop_reason": stop, "usage": USAGE if usage is None else usage}


def events(*, model=MODEL, id="msg_01ABC", text="answer", final_usage=None):
    first = message(content=[], usage={"input_tokens": 3, "output_tokens": 1}, model=model, stop=None, id=id)
    return [
        {"type": "message_start", "message": first},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "ping"},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}},
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn"},
         "usage": {"output_tokens": 3}},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn"},
         "usage": {"output_tokens": 5, "cache_read_input_tokens": 2} if final_usage is None else final_usage},
        {"type": "message_stop"},
    ]


def test_generate_native_messages_wire_and_final_usage_receipt():
    host = Host(response(message()))
    adapter = AnthropicAdapter(host)
    result = adapter.generate(request())
    assert host.calls == [{"operation": "generate", "endpoint": "https://api.anthropic.com/v1/messages?beta=true",
                           "payload": {"model": MODEL, "max_tokens": 1024,
                                       "messages": [{"role": "user", "content": "hello"}], "stream": False},
                           "request_id": "f09:1", "stream": False}]
    assert (result.output_text, result.final_usage.input_tokens, result.final_usage.output_tokens) == ("answer", 5, 5)
    assert result.usage_provenance == UsageProvenance.PROVIDER_FINAL
    assert adapter.receipt("f09:1").to_dict()["usage_metadata"] == USAGE


def test_alias_serving_model_may_differ_but_receipt_records_it():
    adapter = AnthropicAdapter(Host(response(message(model="claude-sonnet-4.5"))))
    result = adapter.generate(request())
    assert result.model == MODEL
    assert adapter.receipt("f09:1").to_dict()["serving_model"] == "claude-sonnet-4.5"


def test_stream_uses_last_cumulative_usage_and_replays_once():
    host = Host(response(events()))
    adapter = AnthropicAdapter(host)
    first = adapter.stream(request())
    assert first.chunks == ("answer",)
    assert (first.response.final_usage.input_tokens, first.response.final_usage.output_tokens) == (5, 5)
    assert adapter.stream(request()) is first
    assert len(host.calls) == 1


def test_stream_allows_intermediate_usage_delta_without_stop_reason():
    frames = events()
    frames[5]["delta"] = {}
    result = AnthropicAdapter(Host(response(frames))).stream(request())
    assert result.response.final_usage.output_tokens == 5


def test_stream_final_delta_requires_explicit_cumulative_output_tokens():
    frames = events()
    frames[6]["usage"] = {"cache_read_input_tokens": 2}
    with pytest.raises(AnthropicAdapterError, match="RESPONSE_MALFORMED"):
        AnthropicAdapter(Host(response(frames))).stream(request())


def test_stream_cumulative_output_must_not_decrease():
    frames = events()
    frames[6]["usage"] = {"output_tokens": 2}
    with pytest.raises(AnthropicAdapterError, match="RESPONSE_MALFORMED"):
        AnthropicAdapter(Host(response(frames))).stream(request())


def test_stream_requires_input_start_evidence_and_non_decreasing_input():
    frames = events()
    del frames[0]["message"]["usage"]["input_tokens"]
    with pytest.raises(AnthropicAdapterError, match="RESPONSE_MALFORMED"):
        AnthropicAdapter(Host(response(frames))).stream(request())
    frames = events()
    frames[6]["usage"]["input_tokens"] = 2
    with pytest.raises(AnthropicAdapterError, match="RESPONSE_MALFORMED"):
        AnthropicAdapter(Host(response(frames))).stream(request())


def test_stream_ignores_ping_and_unknown_event_but_rejects_midstream_error():
    frames = events()
    frames.insert(3, {"type": "new_future_event", "new": True})
    assert AnthropicAdapter(Host(response(frames))).stream(request()).response.output_text == "answer"
    frames.insert(4, {"type": "error", "error": {"type": "overloaded_error", "message": "busy"}})
    with pytest.raises(AnthropicAdapterError, match="STREAM_PROVIDER_ERROR"):
        AnthropicAdapter(Host(response(frames))).stream(request())


@pytest.mark.parametrize("mutation", [
    lambda e: e.pop(),
    lambda e: (e.pop(-2), e.pop(-2)),
    lambda e: e.__setitem__(0, {"type": "message_start", "message": message(content=[], model="other")}),
    lambda e: e.__setitem__(3, {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": "x"}}),
])
def test_stream_malformed_sequence_fails_closed(mutation):
    frames = events()
    mutation(frames)
    with pytest.raises(AnthropicAdapterError):
        AnthropicAdapter(Host(response(frames))).stream(request())


@pytest.mark.parametrize("content,stop", [
    ([{"type": "tool_use", "id": "tool_1", "name": "x", "input": {}}], "tool_use"),
    ([{"type": "thinking", "thinking": "hidden"}], "end_turn"),
    ([{"type": "text", "text": "answer"}], "max_tokens"),
])
def test_generate_rejects_non_text_or_nonfinal_stop(content, stop):
    with pytest.raises(AnthropicAdapterError):
        AnthropicAdapter(Host(response(message(content=content, stop=stop)))).generate(request())


def test_generic_429_is_ambiguous_with_or_without_retry_after():
    body = {"type": "error", "error": {"type": "rate_limit_error", "message": "limit"}}
    with pytest.raises(AnthropicAdapterError) as caught:
        AnthropicAdapter(Host(response(body, 429))).generate(request())
    assert caught.value.code == "PROVIDER_429_AMBIGUOUS" and caught.value.retryable is False
    with pytest.raises(AnthropicAdapterError) as caught:
        AnthropicAdapter(Host(response(body, 429, (("Retry-After", "4"),)))).generate(request())
    assert (caught.value.code, caught.value.retryable, caught.value.retry_after_seconds) == ("PROVIDER_429_AMBIGUOUS", False, None)


def test_invalid_retry_after_and_secret_response_fail_closed():
    body = {"type": "error", "error": {"type": "rate_limit_error"}}
    with pytest.raises(AnthropicAdapterError, match="RETRY_AFTER_INVALID"):
        AnthropicAdapter(Host(response(body, 429, (("Retry-After", "90000"),)))).generate(request())
    with pytest.raises(AnthropicAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        AnthropicAdapter(Host(response(message(), headers=(("x-api-key", "secret"),)))).generate(request())


@pytest.mark.parametrize("stream", [False, True])
def test_joined_text_secret_and_boundary_whitespace_rejected(stream):
    if stream:
        frames = events(text="api_")
        frames.insert(4, {"type": "content_block_delta", "index": 0,
                          "delta": {"type": "text_delta", "text": "key=synthetic-marker"}})
        raw = frames
    else:
        raw = message(content=[{"type": "text", "text": "api_"},
                               {"type": "text", "text": "key=synthetic-marker"}])
    adapter = AnthropicAdapter(Host(response(raw)))
    with pytest.raises(AnthropicAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        (adapter.stream if stream else adapter.generate)(request())
    with pytest.raises(AnthropicAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("f09:1")
    raw = events(text="answer ") if stream else message(content=[{"type": "text", "text": "answer "}])
    with pytest.raises(AnthropicAdapterError, match="OUTPUT_TEXT_NON_CANONICAL"):
        (AnthropicAdapter(Host(response(raw))).stream if stream else
         AnthropicAdapter(Host(response(raw))).generate)(request())


def test_host_exception_traceback_has_no_secret():
    host = Host(error=RuntimeError("api_key=synthetic-marker"))
    with pytest.raises(AnthropicAdapterError) as caught:
        AnthropicAdapter(host).generate(request())
    assert caught.value.code == "TRANSPORT_FAILURE"
    assert "synthetic-marker" not in "".join(traceback.format_exception(caught.value))


def test_request_id_conflict_retry_after_failure_and_pre_send_abort():
    from threading import Event
    signal = Event()
    signal.set()
    host = Host(response(message()))
    adapter = AnthropicAdapter(host)
    aborted = adapter.generate(request(signal=signal))
    assert aborted.abort_status == "ABORTED" and not host.calls
    with pytest.raises(AnthropicAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(GatewayRequest("anthropic", MODEL, "different", "f09:1"))
    flaky = Host(response(message()))
    flaky.error = RuntimeError("offline")
    retry_adapter = AnthropicAdapter(flaky)
    with pytest.raises(AnthropicAdapterError, match="TRANSPORT_FAILURE"):
        retry_adapter.generate(request())
    flaky.error = None
    assert retry_adapter.generate(request()).output_text == "answer"


def test_discovery_static_and_health_requires_host_attestation():
    host = Host(response({"type": "model", "id": MODEL}))
    adapter = AnthropicAdapter(host)
    info = adapter.discover(request_id="f09:discovery").to_dict()
    assert info["models"] == list(REGISTERED_MODELS) and info["live_freshness"] == "UNVERIFIED"
    assert not host.calls
    with pytest.raises(AnthropicAdapterError, match="HEALTH_EVIDENCE_INSUFFICIENT"):
        adapter.health(request_id="f09:health")
    host.result = response({"type": "model", "id": MODEL}, authenticated=True)
    healthy = adapter.health(request_id="f09:health").to_dict()
    assert healthy["status"] == "AVAILABLE"
    assert host.calls[-1]["endpoint"] == f"https://api.anthropic.com/v1/models/{MODEL}"


def test_health_accepts_concrete_model_from_alias_and_records_resolution():
    adapter = AnthropicAdapter(Host(response({"type": "model", "id": "claude-sonnet-4-6-20260901"},
                                               authenticated=True)))
    evidence = adapter.health(request_id="f09:health").to_dict()
    assert evidence["requested_model"] == MODEL
    assert evidence["resolved_model"] == "claude-sonnet-4-6-20260901"


def test_health_rejects_authenticated_unrelated_family_model():
    adapter = AnthropicAdapter(Host(response({"type": "model", "id": "claude-opus-5"}, authenticated=True)))
    with pytest.raises(AnthropicAdapterError, match="HEALTH_EVIDENCE_INSUFFICIENT"):
        adapter.health(request_id="f09:health")


def test_stream_rejects_conflicting_identity_in_later_frame():
    frames = events()
    frames[5]["model"] = "claude-haiku-4.5"
    with pytest.raises(AnthropicAdapterError, match="RESPONSE_MALFORMED"):
        AnthropicAdapter(Host(response(frames))).stream(request())


def test_post_send_abort_retains_provider_final_usage():
    from threading import Event
    signal = Event()

    class AbortingHost(Host):
        def request(self, **kwargs):
            signal.set()
            return super().request(**kwargs)

    result = AnthropicAdapter(AbortingHost(response(message()))).generate(request(signal=signal))
    assert result.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert result.usage_provenance == UsageProvenance.PROVIDER_FINAL
    assert result.final_usage.output_tokens == 5


@pytest.mark.parametrize("status,kind,code,retryable", [
    (400, "invalid_request_error", "INVALID_REQUEST", False),
    (401, "authentication_error", "AUTHENTICATION_FAILED", False),
    (403, "permission_error", "AUTHORIZATION_DENIED", False),
    (404, "not_found_error", "MODEL_OR_PATH_NOT_FOUND", False),
    (500, "api_error", "TEMPORARY_5XX", True),
    (529, "overloaded_error", "OVERLOADED", True),
])
def test_http_error_mapping_uses_status_and_type(status, kind, code, retryable):
    body = {"type": "error", "error": {"type": kind, "message": "synthetic"}}
    with pytest.raises(AnthropicAdapterError) as caught:
        AnthropicAdapter(Host(response(body, status))).generate(request())
    assert (caught.value.code, caught.value.retryable) == (code, retryable)


@pytest.mark.parametrize("message", [
    "You have reached your specified API usage limits; access resumes tomorrow",
    "You have reached your specified workspace API usage limits; access resumes tomorrow",
])
def test_400_user_spend_limit_not_mapped_to_bad_request(message):
    body = {"type": "error", "error": {"type": "invalid_request_error", "message": message}}
    with pytest.raises(AnthropicAdapterError) as caught:
        AnthropicAdapter(Host(response(body, 400))).generate(request())
    assert caught.value.code == "SPEND_LIMIT_REACHED" and caught.value.retryable is False


def test_429_tier_spend_code_overrides_retry_after_header():
    body = {"type": "error", "error": {"type": "rate_limit_error", "message": "spend limit",
                                      "details": {"error_code": "enforced_spend_limit_reached"}}}
    with pytest.raises(AnthropicAdapterError) as caught:
        AnthropicAdapter(Host(response(body, 429, (("Retry-After", "3"),)))).generate(request())
    assert caught.value.code == "SPEND_LIMIT_REACHED" and caught.value.retryable is False


def test_429_workspace_spend_phrase_with_retry_after_is_not_retryable():
    body = {"type": "error", "error": {"type": "rate_limit_error",
                                      "message": "You have reached your specified workspace API usage limits; access resumes tomorrow"}}
    with pytest.raises(AnthropicAdapterError) as caught:
        AnthropicAdapter(Host(response(body, 429, (("Retry-After", "3"),)))).generate(request())
    assert caught.value.code == "SPEND_LIMIT_REACHED" and caught.value.retryable is False


def test_cache_creation_and_read_count_as_total_input_not_double_counted():
    raw = {"input_tokens": 3, "cache_read_input_tokens": 2,
           "cache_creation_input_tokens": 4, "output_tokens": 5}
    result = AnthropicAdapter(Host(response(message(usage=raw)))).generate(request())
    assert result.final_usage.input_tokens == 9
