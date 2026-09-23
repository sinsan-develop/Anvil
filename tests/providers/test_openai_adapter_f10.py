"""F-10 host-only OpenAI Chat/Responses boundary tests."""

import pytest

from packages.llm_gateway.contracts import GatewayRequest, UsageProvenance
from packages.providers.openai_adapter import OpenAIAdapter
from packages.providers.openai_errors import OpenAIAdapterError
from packages.providers.openai_models import REGISTERED_MODELS, TransportResponse


class Host:
    def __init__(self, answer=None, error=None):
        self.answer = answer
        self.error = error
        self.calls = []

    def request(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.answer


def wire(body, status=200, headers=(), authenticated=False):
    return TransportResponse(status, tuple(headers), body, authenticated)


def ask(id="f10:1", model="gpt-4o", signal=None, text="hello"):
    return GatewayRequest("openai", model, text, id, signal)


def chat_body(model="gpt-4o", content="answer", finish="stop", usage=None):
    return {"id": "chatcmpl_abc", "object": "chat.completion", "model": model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content},
                         "finish_reason": finish}],
            "usage": usage or {"prompt_tokens": 3, "completion_tokens": 5, "total_tokens": 8}}


def responses_body(model="gpt-5.5-pro", text="answer", status="completed", usage=None):
    return {"id": "resp_abc", "object": "response", "model": model, "status": status,
            "output": [{"id": "msg_abc", "type": "message", "role": "assistant", "status": "completed",
                        "content": [{"type": "output_text", "text": text}]}],
            "usage": usage or {"input_tokens": 3, "output_tokens": 5, "total_tokens": 8}}


def chat_frames():
    return [
        {"id": "chatcmpl_abc", "object": "chat.completion.chunk", "model": "gpt-4o",
         "choices": [{"index": 0, "delta": {"role": "assistant", "content": "ans"}, "finish_reason": None}]},
        {"id": "chatcmpl_abc", "object": "chat.completion.chunk", "model": "gpt-4o",
         "choices": [{"index": 0, "delta": {"content": "wer"}, "finish_reason": "stop"}]},
        {"id": "chatcmpl_abc", "object": "chat.completion.chunk", "model": "gpt-4o",
         "choices": [], "usage": {"prompt_tokens": 3, "completion_tokens": 5, "total_tokens": 8}},
        "[DONE]",
    ]


def response_frames():
    body = responses_body()
    return [
        {"type": "response.created", "response": {"id": "resp_abc", "model": "gpt-5.5-pro", "status": "in_progress"}},
        {"type": "response.output_text.delta", "response_id": "resp_abc", "output_index": 0,
         "content_index": 0, "delta": "ans"},
        {"type": "response.output_text.delta", "response_id": "resp_abc", "output_index": 0,
         "content_index": 0, "delta": "wer"},
        {"type": "response.completed", "response": body},
    ]


def test_chat_generate_native_wire_usage_and_receipt():
    host = Host(wire(chat_body()))
    adapter = OpenAIAdapter(host)
    result = adapter.generate(ask())
    assert host.calls == [{"operation": "generate", "endpoint": "https://api.openai.com/v1/chat/completions",
                           "payload": {"model": "gpt-4o", "messages": [{"role": "user", "content": "hello"}],
                                       "stream": False}, "request_id": "f10:1", "stream": False}]
    assert (result.output_text, result.final_usage.input_tokens, result.final_usage.output_tokens) == ("answer", 3, 5)
    assert result.usage_provenance == UsageProvenance.PROVIDER_FINAL
    assert adapter.receipt("f10:1").to_dict()["response_id"] == "chatcmpl_abc"


def test_pro_generate_uses_responses_not_chat_and_allows_serving_alias():
    body = responses_body(model="gpt-5.5-pro-2026-01-01")
    host = Host(wire(body))
    adapter = OpenAIAdapter(host)
    result = adapter.generate(ask(model="gpt-5.5-pro"))
    assert host.calls[0]["endpoint"] == "https://api.openai.com/v1/responses"
    assert host.calls[0]["payload"] == {"model": "gpt-5.5-pro", "input": [{"role": "user", "content": "hello"}],
                                          "stream": False, "store": False}
    assert result.model == "gpt-5.5-pro"
    assert adapter.receipt("f10:1").to_dict()["serving_model"] == "gpt-5.5-pro-2026-01-01"


def test_chat_stream_requires_terminal_usage_and_replays():
    host = Host(wire(chat_frames()))
    adapter = OpenAIAdapter(host)
    first = adapter.stream(ask())
    assert first.chunks == ("ans", "wer")
    assert first.response.final_usage.total_tokens == 8
    assert adapter.stream(ask()) is first and len(host.calls) == 1
    assert host.calls[0]["payload"]["stream_options"] == {"include_usage": True}


def test_responses_stream_requires_completed_final_usage():
    host = Host(wire(response_frames()))
    result = OpenAIAdapter(host).stream(ask(model="gpt-5.5-pro"))
    assert result.chunks == ("ans", "wer")
    assert result.response.final_usage.total_tokens == 8
    assert host.calls[0]["endpoint"].endswith("/responses")
    frames = response_frames()[:-1]
    with pytest.raises(OpenAIAdapterError, match="RESPONSE_MALFORMED"):
        OpenAIAdapter(Host(wire(frames))).stream(ask(model="gpt-5.5-pro"))


@pytest.mark.parametrize("body", [
    chat_body(finish="tool_calls"), chat_body(content=None),
    chat_body(usage={"prompt_tokens": 3, "completion_tokens": 5, "total_tokens": 9}),
    responses_body(status="incomplete"),
    {**responses_body(), "output": [{"type": "function_call", "name": "tool"}]},
])
def test_nonfinal_nontext_or_inconsistent_usage_rejected(body):
    model = "gpt-5.5-pro" if body.get("object") == "response" else "gpt-4o"
    with pytest.raises(OpenAIAdapterError):
        OpenAIAdapter(Host(wire(body))).generate(ask(model=model))


@pytest.mark.parametrize("frames,model", [
    (chat_frames()[:-2] + ["[DONE]"], "gpt-4o"),
    (chat_frames()[:-1], "gpt-4o"),
    (response_frames()[:2] + [{"type": "response.failed", "response": {"id": "resp_abc"}}], "gpt-5.5-pro"),
    (response_frames()[:2] + [{"type": "error", "message": "secret=synthetic"}], "gpt-5.5-pro"),
])
def test_stream_missing_final_or_error_rejected(frames, model):
    with pytest.raises(OpenAIAdapterError):
        OpenAIAdapter(Host(wire(frames))).stream(ask(model=model))


def test_request_identity_abort_and_retry_after_failure():
    host = Host(wire(chat_body()))
    adapter = OpenAIAdapter(host)
    assert adapter.generate(ask()) is adapter.generate(ask())
    with pytest.raises(OpenAIAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(ask(text="other"))
    aborted = OpenAIAdapter(Host())
    result = aborted.generate(ask(signal=lambda: True))
    assert result.abort_status == "ABORTED" and result.final_usage.total_tokens == 0
    assert aborted.receipt("f10:1").to_dict()["transport_sent"] is False
    host = Host(wire({"error": {"type": "rate_limit_error", "code": "rate_limit_exceeded"}}, 429,
                     (("Retry-After", "3"),)))
    adapter = OpenAIAdapter(host)
    with pytest.raises(OpenAIAdapterError, match="RATE_LIMITED") as caught:
        adapter.generate(ask())
    assert caught.value.retryable and caught.value.retry_after_seconds == 3
    host.answer = wire(chat_body())
    assert adapter.generate(ask()).output_text == "answer" and len(host.calls) == 2


@pytest.mark.parametrize("code,expected", [
    ("organization_spend_limit_exceeded", "SPEND_LIMIT_REACHED"),
    ("project_spend_limit_exceeded", "SPEND_LIMIT_REACHED"),
    ("organization_usage_limit_exceeded", "USAGE_LIMIT_REACHED"),
    ("credit_balance_exhausted", "CREDIT_BALANCE_EXHAUSTED"),
])
def test_nonretryable_quota_classification_ignores_retry_after(code, expected):
    host = Host(wire({"error": {"type": "insufficient_quota", "code": code}}, 429,
                     (("Retry-After", "4"),)))
    with pytest.raises(OpenAIAdapterError) as caught:
        OpenAIAdapter(host).generate(ask())
    assert caught.value.code == expected and not caught.value.retryable
    assert caught.value.retry_after_seconds is None


def test_unknown_429_is_ambiguous_and_no_retry_claim():
    with pytest.raises(OpenAIAdapterError) as caught:
        OpenAIAdapter(Host(wire({"error": {"type": "other"}}, 429))).generate(ask())
    assert caught.value.code == "PROVIDER_429_AMBIGUOUS" and not caught.value.retryable


def test_discovery_is_pinned_deduplicated_and_live_unverified():
    adapter = OpenAIAdapter(Host())
    record = adapter.discover(request_id="f10:disc").to_dict()
    assert record["models"] == list(REGISTERED_MODELS)
    assert len(record["models"]) == len(set(record["models"])) == 20
    assert record["credential_health"] == record["live_freshness"] == "UNVERIFIED"
    assert record["responses_only_models"] == ["gpt-5.5-pro", "gpt-5.4-pro"]


def test_health_requires_authenticated_matching_model_evidence():
    body = {"id": "gpt-4o", "object": "model", "owned_by": "openai"}
    host = Host(wire(body, authenticated=True))
    adapter = OpenAIAdapter(host)
    assert adapter.health(request_id="f10:health").to_dict()["status"] == "AVAILABLE"
    assert host.calls[0]["endpoint"] == "https://api.openai.com/v1/models/gpt-4o"
    for altered in (wire(body), wire({**body, "id": "other"}, authenticated=True)):
        with pytest.raises(OpenAIAdapterError, match="HEALTH_EVIDENCE_INSUFFICIENT"):
            OpenAIAdapter(Host(altered)).health(request_id="f10:h2")


def test_secrets_in_response_and_transport_exception_never_leak():
    secret = "synthetic-marker"
    with pytest.raises(OpenAIAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        OpenAIAdapter(Host(wire(chat_body(content=f"api_key={secret}")))).generate(ask())
    with pytest.raises(OpenAIAdapterError, match="TRANSPORT_FAILURE") as caught:
        OpenAIAdapter(Host(error=RuntimeError(f"Authorization: Bearer {secret}"))).generate(ask())
    assert secret not in str(caught.value)


def test_chat_terminal_usage_cannot_be_duplicated_or_reordered():
    frames = chat_frames()
    frames.insert(-1, frames[-2])
    with pytest.raises(OpenAIAdapterError, match="RESPONSE_MALFORMED"):
        OpenAIAdapter(Host(wire(frames))).stream(ask())
    frames = chat_frames()
    frames[1], frames[2] = frames[2], frames[1]
    with pytest.raises(OpenAIAdapterError, match="RESPONSE_MALFORMED"):
        OpenAIAdapter(Host(wire(frames))).stream(ask())


def test_response_completed_requires_final_status_usage_and_matching_text():
    for break_final in (
        lambda frame: frame["response"].pop("usage"),
        lambda frame: frame["response"].update(status="incomplete"),
        lambda frame: frame["response"]["output"][0]["content"][0].update(text="different"),
    ):
        frames = response_frames()
        break_final(frames[-1])
        with pytest.raises(OpenAIAdapterError):
            OpenAIAdapter(Host(wire(frames))).stream(ask(model="gpt-5.5-pro"))


def test_responses_stream_tool_event_never_becomes_text_success():
    frames = response_frames()
    frames.insert(-1, {"type": "response.output_item.added", "output_index": 1,
                       "item": {"type": "function_call", "name": "external"}})
    with pytest.raises(OpenAIAdapterError, match="CONTENT_BLOCKED"):
        OpenAIAdapter(Host(wire(frames))).stream(ask(model="gpt-5.5-pro"))


def test_503_overload_honors_retry_after_and_post_send_abort_keeps_final_usage():
    host = Host(wire({"error": {"type": "service_unavailable_error", "code": "server_is_overloaded"}},
                     503, (("Retry-After", "7"),)))
    with pytest.raises(OpenAIAdapterError, match="OVERLOADED") as caught:
        OpenAIAdapter(host).generate(ask())
    assert caught.value.retryable and caught.value.retry_after_seconds == 7

    signal = {"aborted": False}

    class PostSend(Host):
        def request(self, **kwargs):
            signal["aborted"] = True
            return wire(chat_body())

    result = OpenAIAdapter(PostSend()).generate(ask(signal=lambda: signal["aborted"]))
    assert result.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert result.final_usage.total_tokens == 8


def test_stream_joined_secret_rejected():
    frames = chat_frames()
    frames[0]["choices"][0]["delta"]["content"] = "api_"
    frames[1]["choices"][0]["delta"]["content"] = "key=synthetic-marker"
    with pytest.raises(OpenAIAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        OpenAIAdapter(Host(wire(frames))).stream(ask())


@pytest.mark.parametrize("code,expected", [
    ("organization_spend_limit_exceeded", "SPEND_LIMIT_REACHED"),
    ("project_spend_limit_exceeded", "SPEND_LIMIT_REACHED"),
    ("organization_usage_limit_exceeded", "USAGE_LIMIT_REACHED"),
    ("credit_balance_exhausted", "CREDIT_BALANCE_EXHAUSTED"),
])
def test_malformed_retry_after_does_not_mask_nonretryable_quota(code, expected):
    host = Host(wire({"error": {"code": code}}, 429, (("Retry-After", "not-a-delay"),)))
    with pytest.raises(OpenAIAdapterError) as caught:
        OpenAIAdapter(host).generate(ask())
    assert caught.value.code == expected
    assert caught.value.retryable is False and caught.value.retry_after_seconds is None


def test_malformed_retry_after_on_retryable_rate_limit_still_rejected():
    host = Host(wire({"error": {"code": "rate_limit_exceeded"}}, 429,
                     (("Retry-After", "not-a-delay"),)))
    with pytest.raises(OpenAIAdapterError, match="RETRY_AFTER_INVALID"):
        OpenAIAdapter(host).generate(ask())


@pytest.mark.parametrize("extra", [
    {"type": "response.future_unknown", "opaque": "future"},
    {"type": "response.refusal.delta", "delta": "no"},
    {"type": "response.content_part.added", "output_index": 0, "content_index": 0,
     "part": {"type": "output_audio", "data": "synthetic"}},
])
def test_unknown_refusal_or_nontext_responses_event_fails_closed(extra):
    frames = response_frames()
    frames.insert(-1, extra)
    with pytest.raises(OpenAIAdapterError, match="CONTENT_BLOCKED"):
        OpenAIAdapter(Host(wire(frames))).stream(ask(model="gpt-5.5-pro"))


def test_known_text_lifecycle_events_preserve_final_output():
    frames = response_frames()
    frames.insert(1, {"type": "response.in_progress", "response": {"id": "resp_abc", "status": "in_progress"}})
    frames.insert(2, {"type": "response.output_item.added", "output_index": 0,
                      "item": {"id": "msg_abc", "type": "message", "role": "assistant", "status": "in_progress"}})
    frames.insert(3, {"type": "response.content_part.added", "output_index": 0, "content_index": 0,
                      "part": {"type": "output_text", "text": ""}})
    frames.insert(-1, {"type": "response.output_text.done", "output_index": 0,
                       "content_index": 0, "text": "answer"})
    frames.insert(-1, {"type": "response.content_part.done", "output_index": 0, "content_index": 0,
                       "part": {"type": "output_text", "text": "answer"}})
    frames.insert(-1, {"type": "response.output_item.done", "output_index": 0,
                       "item": responses_body()["output"][0]})
    result = OpenAIAdapter(Host(wire(frames))).stream(ask(model="gpt-5.5-pro"))
    assert result.response.output_text == "answer"
    assert result.response.final_usage.total_tokens == 8
