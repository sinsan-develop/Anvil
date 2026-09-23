"""F-08 Gemini host boundary contracts, without network or credentials."""
import pytest
import traceback

from packages.llm_gateway.contracts import GatewayRequest, UsageProvenance
from packages.providers.gemini_adapter import GeminiAdapter
from packages.providers.gemini_errors import GeminiAdapterError
from packages.providers.gemini_models import TransportResponse


class FakeHost:
    def __init__(self, response=None):
        self.response = response
        self.calls = []
        self.after_send = None

    def request(self, *, operation, endpoint, payload, request_id, stream):
        self.calls.append((operation, endpoint, payload, request_id, stream))
        if self.after_send:
            self.after_send()
        return self.response


def response(body, status=200, headers=(), authenticated_probe=False):
    return TransportResponse(status, headers, body, authenticated_probe)


def req(rid="f08:1", model="gemini-2.5-flash", text="hello", abort=None):
    return GatewayRequest("gemini", model, text, rid, abort)


def frame(text="answer", *, rid="response-1", model="gemini-2.5-flash", finish="STOP", usage=None):
    result = {"responseId": rid, "modelVersion": model,
              "candidates": [{"content": {"role": "model", "parts": [{"text": text}]},
                              "finishReason": finish}]}
    if usage is not None:
        result["usageMetadata"] = usage
    return result


USAGE = {"promptTokenCount": 2, "candidatesTokenCount": 3,
         "thoughtsTokenCount": 4, "totalTokenCount": 9}


def test_generate_native_wire_thinking_usage_replay_and_conflict():
    host = FakeHost(response(frame(usage=USAGE)))
    adapter = GeminiAdapter(host)
    first = adapter.generate(req())
    assert first.output_text == "answer"
    assert first.final_usage.input_tokens == 2
    assert first.final_usage.output_tokens == 7
    assert first.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert host.calls == [("generate", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                           {"contents": [{"role": "user", "parts": [{"text": "hello"}]}]}, "f08:1", False)]
    assert adapter.generate(req()) == first
    assert len(host.calls) == 1
    assert adapter.receipt("f08:1").to_dict()["usage_metadata"] == USAGE
    for changed in (req(text="other"), req(model="gemini-2.5-pro")):
        with pytest.raises(GeminiAdapterError, match="REQUEST_ID_CONFLICT"):
            adapter.generate(changed)
    with pytest.raises(GeminiAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.stream(req())


def test_failed_id_retries_same_input_only():
    host = FakeHost(response({"error": {"status": "UNAVAILABLE"}}, 503))
    adapter = GeminiAdapter(host)
    with pytest.raises(GeminiAdapterError, match="TEMPORARY_5XX"):
        adapter.generate(req())
    with pytest.raises(GeminiAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(req(text="changed"))
    host.response = response(frame(usage=USAGE))
    assert adapter.generate(req()).output_text == "answer"
    assert len(host.calls) == 2


def test_stream_native_final_usage_and_identity():
    frames = [frame("ans", finish=None), frame("wer", usage=USAGE)]
    host = FakeHost(response(frames))
    adapter = GeminiAdapter(host)
    result = adapter.stream(req())
    assert result.chunks == ("ans", "wer")
    assert result.response.output_text == "answer"
    assert result.response.final_usage.total_tokens == 9
    assert result.receipt.to_dict()["response_id"] == "response-1"
    assert host.calls[0] == ("stream", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
                             {"contents": [{"role": "user", "parts": [{"text": "hello"}]}]}, "f08:1", True)
    assert adapter.stream(req()) == result
    assert len(host.calls) == 1


@pytest.mark.parametrize("frames", [
    [frame("ans")],
    [frame("ans"), frame("wer", rid="other", usage=USAGE)],
    [frame("ans"), frame("wer", model="gemini-2.5-pro", usage=USAGE)],
    [frame("ans", finish=None, usage=USAGE), frame("wer")],
    [frame("ans"), frame("wer", usage=USAGE)],
    [frame("ans"), frame("wer", usage={"promptTokenCount": 2, "candidatesTokenCount": 3, "totalTokenCount": 4})],
])
def test_stream_rejects_incomplete_or_inconsistent_final(frames):
    with pytest.raises(GeminiAdapterError):
        GeminiAdapter(FakeHost(response(frames))).stream(req())


@pytest.mark.parametrize("bad", [
    frame("", usage=USAGE),
    frame("answer", finish="SAFETY", usage=USAGE),
    {"responseId": "response-1", "modelVersion": "gemini-2.5-flash", "promptFeedback": {"blockReason": "SAFETY"}, "candidates": [], "usageMetadata": USAGE},
    frame("answer"),
    frame("answer", usage={"promptTokenCount": 2, "candidatesTokenCount": 3}),
    frame("answer", model="", usage=USAGE),
])
def test_generate_rejects_blocked_missing_usage_or_wrong_model(bad):
    with pytest.raises(GeminiAdapterError):
        GeminiAdapter(FakeHost(response(bad))).generate(req())


def test_served_version_may_differ_from_requested_alias_but_is_recorded():
    served = "gemini-2.5-flash-2026-09"
    adapter = GeminiAdapter(FakeHost(response(frame(model=served, usage=USAGE))))
    assert adapter.generate(req()).output_text == "answer"
    assert adapter.receipt("f08:1").to_dict()["model_version"] == served


def test_usage_must_include_reported_thinking_tokens():
    inconsistent = {"promptTokenCount": 2, "candidatesTokenCount": 3,
                    "thoughtsTokenCount": 4, "totalTokenCount": 5}
    with pytest.raises(GeminiAdapterError, match="RESPONSE_MALFORMED"):
        GeminiAdapter(FakeHost(response(frame(usage=inconsistent)))).generate(req())


def test_intermediate_usage_never_replaces_final_usage():
    frames = [frame("ans", finish=None, usage=USAGE), frame("wer", usage=USAGE)]
    result = GeminiAdapter(FakeHost(response(frames))).stream(req())
    assert result.response.final_usage.total_tokens == 9


def test_tts_is_discoverable_but_rejected_before_send():
    host = FakeHost()
    adapter = GeminiAdapter(host)
    listing = adapter.discover(request_id="list:1").to_dict()
    assert "gemini-3.1-flash-tts-preview" in listing["models"]
    assert len(listing["models"]) == 8
    assert listing["status"] == "STATIC_REGISTRY"
    assert listing["credential_health"] == "UNVERIFIED"
    assert listing["transport_sent"] is False
    with pytest.raises(GeminiAdapterError, match="MODEL_CAPABILITY_UNSUPPORTED"):
        adapter.generate(req(model="gemini-3.1-flash-tts-preview"))
    with pytest.raises(GeminiAdapterError, match="MODEL_CAPABILITY_UNSUPPORTED"):
        adapter.stream(req(model="gemini-3.1-flash-tts-preview"))
    with pytest.raises(GeminiAdapterError, match="MODEL_NOT_REGISTERED"):
        adapter.generate(req(model="../../other"))
    assert host.calls == []


def test_health_requires_authenticated_model_probe_and_method():
    host = FakeHost(response({"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]}, authenticated_probe=True))
    adapter = GeminiAdapter(host)
    result = adapter.health(request_id="health:1").to_dict()
    assert result["status"] == "AVAILABLE"
    assert host.calls[0][1] == "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash"
    for bad, attested in (({"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]}, False),
                          ({"name": "models/other", "supportedGenerationMethods": ["generateContent"]}, True),
                          ({"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["countTokens"]}, True)):
        with pytest.raises(GeminiAdapterError, match="HEALTH_EVIDENCE_INSUFFICIENT"):
            GeminiAdapter(FakeHost(response(bad, authenticated_probe=attested))).health(request_id="health:2")


def test_pre_and_post_send_abort():
    pre = FakeHost()
    stopped = GeminiAdapter(pre).generate(req(abort=lambda: True))
    assert stopped.abort_status == "ABORTED"
    assert stopped.usage_provenance is UsageProvenance.ABORT_CONFIRMED
    assert pre.calls == []
    state = {"aborted": False}
    post = FakeHost(response(frame(usage=USAGE)))
    post.after_send = lambda: state.update(aborted=True)
    completed = GeminiAdapter(post).generate(req(abort=lambda: state["aborted"]))
    assert completed.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert completed.usage_provenance is UsageProvenance.PROVIDER_FINAL


@pytest.mark.parametrize("status,body,want,retry", [
    (400, {"error": {"status": "INVALID_ARGUMENT", "details": [{"reason": "API_KEY_INVALID"}]}}, "API_KEY_INVALID", False),
    (400, {"error": {"status": "INVALID_ARGUMENT"}}, "INVALID_REQUEST", False),
    (401, {"error": {"status": "UNAUTHENTICATED"}}, "AUTHENTICATION_FAILED", False),
    (402, {"error": {"status": "RESOURCE_EXHAUSTED"}}, "CREDIT_DEPLETED", False),
    (403, {"error": {"status": "PERMISSION_DENIED"}}, "AUTHORIZATION_DENIED", False),
    (404, {"error": {"status": "NOT_FOUND"}}, "MODEL_OR_PATH_NOT_FOUND", False),
    (429, {"error": {"status": "RESOURCE_EXHAUSTED"}}, "PROVIDER_429_AMBIGUOUS", False),
    (429, {"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"reason": "RATE_LIMIT_EXCEEDED"}]}}, "RATE_LIMIT", True),
    (408, {"error": {"status": "DEADLINE_EXCEEDED"}}, "TIMEOUT", True),
    (503, {"error": {"status": "UNAVAILABLE"}}, "TEMPORARY_5XX", True),
    (418, {"error": {"status": "TEAPOT"}}, "PROVIDER_ERROR_UNMAPPED", False),
])
def test_http_error_classification(status, body, want, retry):
    with pytest.raises(GeminiAdapterError) as caught:
        GeminiAdapter(FakeHost(response(body, status))).generate(req())
    assert caught.value.code == want
    assert caught.value.retryable is retry


def test_retry_after_is_bounded_and_never_implies_rate_cause():
    body = {"error": {"status": "RESOURCE_EXHAUSTED"}}
    with pytest.raises(GeminiAdapterError) as caught:
        GeminiAdapter(FakeHost(response(body, 429, (("Retry-After", "4"),)))).generate(req())
    assert caught.value.code == "PROVIDER_429_AMBIGUOUS"
    assert caught.value.retryable is False
    for value in ("-1", "999999", "tomorrow"):
        with pytest.raises(GeminiAdapterError, match="RETRY_AFTER_INVALID"):
            GeminiAdapter(FakeHost(response(body, 429, (("Retry-After", value),))), max_retry_after_seconds=60).generate(req())


def test_spend_limit_429_is_not_automatically_retryable():
    body = {"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"reason": "SPEND_LIMIT_EXCEEDED"}]}}
    with pytest.raises(GeminiAdapterError) as caught:
        GeminiAdapter(FakeHost(response(body, 429))).generate(req())
    assert caught.value.code == "PROVIDER_429_AMBIGUOUS"
    assert caught.value.retryable is False


def test_health_and_discovery_share_request_id_collision_boundary():
    adapter = GeminiAdapter(FakeHost())
    adapter.discover(request_id="shared:1")
    with pytest.raises(GeminiAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.health(request_id="shared:1")


def test_response_credential_header_is_rejected():
    with pytest.raises(GeminiAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        GeminiAdapter(FakeHost(response(frame(usage=USAGE), headers=(("x-goog-api-key", "secret"),)))).generate(req())


def test_response_credential_material_is_rejected_without_echo():
    with pytest.raises(GeminiAdapterError) as caught:
        GeminiAdapter(FakeHost(response({"error": {"message": "api_key=very-secret"}}, 400))).generate(req())
    assert caught.value.code == "CREDENTIAL_MATERIAL_DETECTED"
    assert "very-secret" not in str(caught.value)


@pytest.mark.parametrize("stream", [False, True])
def test_joined_text_cannot_reconstruct_credential_in_response_or_receipt(stream):
    if stream:
        body = [frame("api_", finish=None), frame("key=very-secret", usage=USAGE)]
    else:
        body = frame(usage=USAGE)
        body["candidates"][0]["content"]["parts"] = [{"text": "api_"}, {"text": "key=very-secret"}]
    adapter = GeminiAdapter(FakeHost(response(body)))
    with pytest.raises(GeminiAdapterError, match="CREDENTIAL_MATERIAL_DETECTED") as caught:
        (adapter.stream if stream else adapter.generate)(req())
    assert "very-secret" not in str(caught.value)
    with pytest.raises(GeminiAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("f08:1")


@pytest.mark.parametrize("host_error", [GeminiAdapterError("api_key=very-secret"), ValueError("api_key=very-secret")])
def test_host_exception_is_redacted_without_chained_secret(host_error):
    class RaisingHost:
        def request(self, **_):
            raise host_error

    with pytest.raises(GeminiAdapterError) as caught:
        GeminiAdapter(RaisingHost()).generate(req())
    assert caught.value.code == "TRANSPORT_FAILURE"
    assert caught.value.__suppress_context__ is True
    assert "very-secret" not in "".join(traceback.format_exception(caught.value))


def test_stream_accepts_empty_stop_frame_with_final_usage_after_text():
    final = frame("", usage=USAGE)
    final["candidates"][0]["content"]["parts"] = []
    result = GeminiAdapter(FakeHost(response([frame("answer", finish=None), final]))).stream(req())
    assert result.chunks == ("answer",)
    assert result.response.output_text == "answer"
    assert result.response.final_usage.total_tokens == 9


def test_stream_rejects_only_empty_stop_frame_even_with_final_usage():
    final = frame("", usage=USAGE)
    final["candidates"][0]["content"]["parts"] = []
    with pytest.raises(GeminiAdapterError, match="RESPONSE_MALFORMED"):
        GeminiAdapter(FakeHost(response([final]))).stream(req())


@pytest.mark.parametrize("content", [{"role": "model"}, {}])
def test_stream_accepts_protojson_omitted_parts_on_final_stop_only(content):
    final = frame("", usage=USAGE)
    final["candidates"][0]["content"] = content
    result = GeminiAdapter(FakeHost(response([frame("answer", finish=None), final]))).stream(req())
    assert result.chunks == ("answer",)
    assert result.response.final_usage.total_tokens == 9


@pytest.mark.parametrize("content", [{"role": "model"}, {}])
def test_stream_rejects_protojson_empty_final_without_prior_text(content):
    final = frame("", usage=USAGE)
    final["candidates"][0]["content"] = content
    with pytest.raises(GeminiAdapterError, match="RESPONSE_MALFORMED"):
        GeminiAdapter(FakeHost(response([final]))).stream(req())


@pytest.mark.parametrize("stream", [False, True])
def test_noncanonical_provider_text_fails_with_stable_adapter_code(stream):
    body = ([frame("answer ", usage=USAGE)] if stream else frame("answer ", usage=USAGE))
    with pytest.raises(GeminiAdapterError, match="OUTPUT_TEXT_NON_CANONICAL"):
        (GeminiAdapter(FakeHost(response(body))).stream if stream else
         GeminiAdapter(FakeHost(response(body))).generate)(req())
