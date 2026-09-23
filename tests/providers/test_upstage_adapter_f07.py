"""F-07 host-only Upstage contract tests; all responses are deterministic fixtures."""
from __future__ import annotations

import pytest

from packages.llm_gateway.contracts import GatewayRequest, UsageProvenance
from packages.providers.upstage_adapter import UpstageAdapter
from packages.providers.upstage_errors import UpstageAdapterError
from packages.providers.upstage_models import TransportResponse


class FakeHost:
    def __init__(self, response: TransportResponse | None = None) -> None:
        self.response = response
        self.calls: list[tuple[str, dict, str, bool]] = []
        self.after_send = None

    def request(self, *, operation, payload, request_id, stream):
        self.calls.append((operation, payload, request_id, stream))
        if self.after_send:
            self.after_send()
        return self.response


def ok(body, *, headers=()):
    return TransportResponse(200, headers, body)


def request(request_id="f07:1", *, model="solar-pro3", text="hello", abort=None):
    return GatewayRequest("upstage", model, text, request_id, abort)


def completion(*, usage=None):
    return {"id": "cmpl-1", "object": "chat.completion", "model": "solar-pro3",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "answer"},
                         "finish_reason": "stop"}],
            "usage": usage or {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5}}


def chunk(delta, finish=None, usage=None, *, cid="cmpl-1"):
    return {"id": cid, "object": "chat.completion.chunk", "model": "solar-pro3",
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}], "usage": usage}


def final_chunk(*, cid="cmpl-1", usage=None):
    return {"id": cid, "object": "chat.completion.chunk", "model": "solar-pro3",
            "choices": [], "usage": usage or {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5}}


def test_generate_wire_usage_replay_and_conflict():
    host = FakeHost(ok(completion()))
    adapter = UpstageAdapter(host)
    first = adapter.generate(request())
    assert first.output_text == "answer"
    assert first.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert first.final_usage.total_tokens == 5
    assert adapter.generate(request()) == first
    assert len(host.calls) == 1
    assert host.calls[0] == ("generate", {"model": "solar-pro3", "messages": [
        {"role": "user", "content": "hello"}]}, "f07:1", False)
    with pytest.raises(UpstageAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(request(text="changed"))
    with pytest.raises(UpstageAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.stream(request())
    assert len(host.calls) == 1


def test_failed_id_can_retry_same_input_but_cannot_change_it():
    host = FakeHost(TransportResponse(500, (), {"error": {"code": "server_error"}}))
    adapter = UpstageAdapter(host)
    with pytest.raises(UpstageAdapterError, match="TEMPORARY_5XX"):
        adapter.generate(request())
    with pytest.raises(UpstageAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(request(text="different"))
    host.response = ok(completion())
    assert adapter.generate(request()).output_text == "answer"
    assert len(host.calls) == 2


def test_stream_role_null_usage_final_usage_and_id_consistency():
    frames = [chunk({"role": "assistant"}), chunk({"content": "ans"}),
              chunk({"content": "wer"}, "stop"), final_chunk()]
    host = FakeHost(ok(frames))
    adapter = UpstageAdapter(host)
    result = adapter.stream(request())
    assert result.chunks == ("ans", "wer")
    assert result.response.final_usage.total_tokens == 5
    assert result.receipt.to_dict()["completion_id"] == "cmpl-1"
    assert adapter.stream(request()) == result
    assert len(host.calls) == 1
    assert host.calls[0][3] is True
    assert host.calls[0][1]["stream"] is True


@pytest.mark.parametrize("frames", [
    [chunk({"content": "answer"}, "stop")],
    [chunk({"content": "answer"}, "stop"), final_chunk(cid="other")],
    [chunk({"content": "answer"}, "stop"), final_chunk(usage=None), final_chunk()],
])
def test_stream_rejects_missing_or_inconsistent_final_usage(frames):
    if len(frames) == 1:
        frames[0]["usage"] = None
    with pytest.raises(UpstageAdapterError, match="RESPONSE_MALFORMED"):
        UpstageAdapter(FakeHost(ok(frames))).stream(request())


def test_pre_and_post_send_abort_provenance():
    pre = FakeHost(ok(completion()))
    stopped = UpstageAdapter(pre).generate(request(abort=lambda: True))
    assert stopped.abort_status == "ABORTED"
    assert stopped.usage_provenance is UsageProvenance.ABORT_CONFIRMED
    assert not pre.calls
    state = {"aborted": False}
    post = FakeHost(ok(completion()))
    post.after_send = lambda: state.update(aborted=True)
    result = UpstageAdapter(post).generate(request(abort=lambda: state["aborted"]))
    assert result.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert result.usage_provenance is UsageProvenance.PROVIDER_FINAL


def test_static_discovery_is_not_live_health():
    host = FakeHost(ok({"status": "ok", "authenticated": True}))
    adapter = UpstageAdapter(host)
    discovered = adapter.discover(request_id="discovery-1").to_dict()
    assert discovered["models"] == ["solar-pro3", "solar-mini"]
    assert discovered["source"] == "OmniRoute release/v3.8.51 20f39008892b683a639063fb8aed8c07782fb0c3"
    assert discovered["status"] == "STATIC_REGISTRY"
    assert discovered["format"] == "openai"
    assert discovered["executor"] == "default"
    assert discovered["auth_header"] == "bearer"
    assert discovered["chat_base_url"] == "https://api.upstage.ai/v1/chat/completions"
    assert not host.calls
    health = adapter.health(request_id="health-1").to_dict()
    assert health["status"] == "AVAILABLE"
    assert health["authenticated_probe"] is True
    assert len(host.calls) == 1


@pytest.mark.parametrize("status,code,expected", [
    (400, "invalid_request", "INVALID_REQUEST"),
    (401, "invalid_api_key", "AUTHENTICATION_FAILED"),
    (403, None, "ACCESS_OR_BILLING_AMBIGUOUS"),
    (403, "insufficient_credits", "QUOTA_EXHAUSTED"),
    (403, "ip_not_allowed", "IP_POLICY_DENIED"),
    (404, None, "ENDPOINT_OR_METHOD_INVALID"),
    (405, None, "ENDPOINT_OR_METHOD_INVALID"),
    (429, None, "PROVIDER_429_AMBIGUOUS"),
    (429, "too_many_requests", "RATE_LIMIT"),
    (429, "insufficient_quota", "QUOTA_EXHAUSTED"),
    (429, "usage_limit_exceeded", "QUOTA_EXHAUSTED"),
    (408, None, "TIMEOUT"),
    (503, None, "TEMPORARY_5XX"),
    (418, None, "PROVIDER_ERROR_UNMAPPED"),
])
def test_error_mapping(status, code, expected):
    body = {"error": {"code": code}} if code else {"error": {"message": "unavailable"}}
    host = FakeHost(TransportResponse(status, (), body))
    with pytest.raises(UpstageAdapterError) as error:
        UpstageAdapter(host).generate(request())
    assert error.value.code == expected


def test_retry_after_cap_and_credential_fail_closed():
    host = FakeHost(TransportResponse(429, (("retry-after", "7"),), {"error": {"code": "rate_limit"}}))
    with pytest.raises(UpstageAdapterError) as error:
        UpstageAdapter(host, max_retry_after_seconds=10).generate(request())
    assert error.value.retryable and error.value.retry_after_seconds == 7
    host.response = TransportResponse(429, (("retry-after", "11"),), {})
    with pytest.raises(UpstageAdapterError, match="RETRY_AFTER_INVALID"):
        UpstageAdapter(host, max_retry_after_seconds=10).generate(request())
    host.response = ok({**completion(), "api_key": "sensitive"})
    with pytest.raises(UpstageAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        UpstageAdapter(host).generate(request())


@pytest.mark.parametrize("code,header,expected,retryable,delay", [
    ("insufficient_quota", "7", "QUOTA_EXHAUSTED", False, None),
    ("rate_limit_exceeded", "7", "RATE_LIMIT", True, 7),
    ("too_many_requests", None, "RATE_LIMIT", True, None),
    (None, None, "PROVIDER_429_AMBIGUOUS", False, None),
    (None, "7", "PROVIDER_429_AMBIGUOUS", False, None),
    ("unrecognized_error", "7", "PROVIDER_429_AMBIGUOUS", False, None),
])
def test_429_code_controls_cause_not_retry_after(code, header, expected, retryable, delay):
    body = {"error": {"code": code}} if code else {"error": {"message": "opaque"}}
    headers = (("retry-after", header),) if header is not None else ()
    host = FakeHost(TransportResponse(429, headers, body))
    with pytest.raises(UpstageAdapterError) as error:
        UpstageAdapter(host).generate(request())
    assert error.value.code == expected
    assert error.value.retryable is retryable
    assert error.value.retry_after_seconds == delay


def test_health_requires_authenticated_host_probe_and_credential_headers_rejected():
    for body in ({"status": "ok"}, {"status": "ok", "authenticated": False}):
        with pytest.raises(UpstageAdapterError, match="HEALTH_EVIDENCE_INSUFFICIENT"):
            UpstageAdapter(FakeHost(ok(body))).health(request_id="health")
    secret_header = ok(completion(), headers=(("Authorization", "Bearer hidden"),))
    with pytest.raises(UpstageAdapterError, match="CREDENTIAL_MATERIAL_DETECTED"):
        UpstageAdapter(FakeHost(secret_header)).generate(request())


def test_stream_post_send_abort_uses_actual_final_usage():
    state = {"aborted": False}
    host = FakeHost(ok([chunk({"content": "answer"}, "stop"), final_chunk()]))
    host.after_send = lambda: state.update(aborted=True)
    result = UpstageAdapter(host).stream(request(abort=lambda: state["aborted"]))
    assert result.response.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert result.response.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert result.receipt.to_dict()["transport_sent"] is True
