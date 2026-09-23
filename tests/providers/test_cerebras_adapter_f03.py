"""F03 CEREBRAS host adapter contract tests; no network or credential I/O."""
from dataclasses import FrozenInstanceError
import json

import pytest

from packages.llm_gateway.contracts import GatewayRequest, ProviderAdapter, UsageProvenance
from packages.providers.cerebras_adapter import CerebrasAdapter
from packages.providers.cerebras_errors import CerebrasAdapterError
from packages.providers.cerebras_models import TransportResponse, canonical, detached


class FakeTransport:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, *, operation, payload, request_id, stream):
        self.calls.append((operation, payload, request_id, stream))
        if not self.responses:
            raise AssertionError("unexpected transport call")
        return self.responses.pop(0)


class RaisingTransport:
    def request(self, *, operation, payload, request_id, stream):
        raise RuntimeError("transport detail must stay private")


def response(body, *, status=200, headers=()):
    return TransportResponse(status, tuple(headers), body)


def request(**changes):
    values = dict(provider="CEREBRAS", model="llama-3.3-70b", input_text="hello", request_id="request-1")
    values.update(changes)
    return GatewayRequest(**values)


def test_generate_maps_request_id_final_usage_and_detached_receipt():
    body = {"id": "upstream-1", "choices": [{"message": {"content": "answer"}}],
            "usage": {"prompt_tokens": 2, "completion_tokens": 3}}
    transport = FakeTransport(response(body, headers=(("x-request-id", "upstream-1"),)))
    adapter = CerebrasAdapter(transport)

    result = adapter.generate(request())
    receipt = adapter.receipt("request-1")
    mutated = receipt.to_dict(); mutated["output_text"] = "forged"

    assert (result.request_id, result.provider, result.output_text) == ("request-1", "CEREBRAS", "answer")
    assert (result.final_usage.input_tokens, result.final_usage.output_tokens) == (2, 3)
    assert result.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert receipt.to_dict()["upstream_request_id"] == "upstream-1"
    assert adapter.receipt("request-1").to_dict()["output_text"] == "answer"
    assert transport.calls == [("generate", {"model": "llama-3.3-70b", "input": "hello"}, "request-1", False)]
    with pytest.raises(FrozenInstanceError): receipt.content_hash = "forged"


def test_identical_generate_histories_have_deterministic_receipts():
    body = {"id": "upstream-1", "choices": [{"message": {"content": "answer"}}],
            "usage": {"prompt_tokens": 2, "completion_tokens": 3}}
    a = CerebrasAdapter(FakeTransport(response(body)))
    b = CerebrasAdapter(FakeTransport(response(body)))
    a.generate(request()); b.generate(request())
    assert a.receipt("request-1").content_hash == b.receipt("request-1").content_hash


def test_stream_collects_chunks_and_requires_provider_final_usage():
    frames = [
        {"id": "upstream-2", "choices": [{"delta": {"content": "hel"}}]},
        {"id": "upstream-2", "choices": [{"delta": {"content": "lo"}}]},
        {"id": "upstream-2", "choices": [{"delta": {}, "finish_reason": "stop"}],
         "usage": {"prompt_tokens": 4, "completion_tokens": 2}},
    ]
    adapter = CerebrasAdapter(FakeTransport(response(frames)))
    result = adapter.stream(request(request_id="stream-1"))
    assert result.chunks == ("hel", "lo")
    assert result.response.output_text == "hello"
    assert result.response.final_usage.total_tokens == 6
    assert result.receipt.content_hash == adapter.receipt("stream-1").content_hash


def test_abort_before_send_has_no_transport_call_and_confirmed_zero_usage():
    transport = FakeTransport()
    adapter = CerebrasAdapter(transport)
    result = adapter.generate(request(request_id="abort-1", abort_signal=lambda: True))
    assert transport.calls == []
    assert result.abort_status == "ABORTED"
    assert result.usage_provenance is UsageProvenance.ABORT_CONFIRMED
    assert result.final_usage.total_tokens == 0
    assert adapter.receipt("abort-1").to_dict()["transport_sent"] is False


def test_abort_after_send_keeps_provider_final_usage_and_request_id():
    checks = iter((False, True, True, True))
    frames = [
        {"id": "upstream-abort", "choices": [{"delta": {"content": "partial"}}]},
        {"id": "upstream-abort", "choices": [{"delta": {}, "finish_reason": "stop"}],
         "usage": {"prompt_tokens": 5, "completion_tokens": 1}},
    ]
    adapter = CerebrasAdapter(FakeTransport(response(frames)))
    result = adapter.stream(request(request_id="abort-stream", abort_signal=lambda: next(checks)))
    assert result.response.abort_status == "ABORT_REQUESTED_UPSTREAM_COMPLETED"
    assert result.response.final_usage.total_tokens == 6
    assert result.response.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert result.receipt.to_dict()["upstream_request_id"] == "upstream-abort"


def test_health_and_discovery_are_detached_deterministic_receipts():
    transport = FakeTransport(
        response({"status": "ok"}, headers=(("x-request-id", "health-up"),)),
        response({"data": [{"id": "z-model"}, {"id": "a-model"}]}),
    )
    adapter = CerebrasAdapter(transport)
    health = adapter.health(request_id="health-1")
    models = adapter.discover(request_id="discover-1")
    assert health.to_dict()["status"] == "AVAILABLE"
    assert models.to_dict()["models"] == ["a-model", "z-model"]
    detached = models.to_dict(); detached["models"].append("forged")
    assert adapter.receipt("discover-1").to_dict()["models"] == ["a-model", "z-model"]


def test_adapter_preserves_provider_neutral_probe_contract_without_io():
    adapter = CerebrasAdapter(FakeTransport())
    assert isinstance(adapter, ProviderAdapter)
    supported = adapter.probe({"text_generation", "streaming"})
    missing = adapter.probe({"image_generation"})
    assert supported.supported and supported.unsupported_reasons == ()
    assert missing.supported is False
    assert missing.unsupported_reasons == ("missing capability: image_generation",)


@pytest.mark.parametrize("body", [
    {}, {"choices": []}, {"choices": [{"message": {"content": "ok"}}]},
    {"id": "x", "choices": [{"message": {"content": 1}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}},
    {"id": "x", "choices": [{"message": {"content": "ok"}}], "usage": {"prompt_tokens": -1, "completion_tokens": 1}},
])
def test_unknown_or_malformed_success_response_fails_closed_without_receipt(body):
    adapter = CerebrasAdapter(FakeTransport(response(body)))
    with pytest.raises(CerebrasAdapterError, match="RESPONSE_MALFORMED"):
        adapter.generate(request())
    with pytest.raises(CerebrasAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("request-1")


@pytest.mark.parametrize("status,body,headers,code,retryable,retry_after", [
    (401, {"error": {"code": "invalid_api_key"}}, (), "AUTHENTICATION_FAILED", False, None),
    (403, {"error": {"code": "permission_denied"}}, (), "AUTHORIZATION_DENIED", False, None),
    (429, {"error": {"code": "rate_limit_exceeded"}}, (("retry-after", "12"),), "RATE_LIMIT", True, 12),
    (429, {"error": {"code": "insufficient_quota"}}, (), "QUOTA_EXHAUSTED", False, None),
    (503, {"error": {"code": "service_unavailable"}}, (("retry-after", "3"),), "TEMPORARY_5XX", True, 3),
])
def test_error_mapping_is_deterministic(status, body, headers, code, retryable, retry_after):
    adapter = CerebrasAdapter(FakeTransport(response(body, status=status, headers=headers)))
    with pytest.raises(CerebrasAdapterError) as caught:
        adapter.generate(request())
    assert (caught.value.code, caught.value.retryable, caught.value.retry_after_seconds) == (code, retryable, retry_after)
    assert str(caught.value) == code


@pytest.mark.parametrize("body", [
    {"error": {}}, {"error": {"code": "unknown"}}, {"error": "rate limit"},
])
def test_quota_rate_limit_ambiguity_fails_closed(body):
    adapter = CerebrasAdapter(FakeTransport(response(body, status=429)))
    with pytest.raises(CerebrasAdapterError, match="RATE_LIMIT_OR_QUOTA_AMBIGUOUS") as caught:
        adapter.generate(request())
    assert caught.value.retryable is False


@pytest.mark.parametrize("value", ["", "-1", "86401", "999999999999999999999999", "tomorrow", "1.5"])
def test_retry_after_malformed_or_overflow_fails_closed(value):
    body = {"error": {"code": "rate_limit_exceeded"}}
    adapter = CerebrasAdapter(FakeTransport(response(body, status=429, headers=(("retry-after", value),))))
    with pytest.raises(CerebrasAdapterError, match="RETRY_AFTER_INVALID"):
        adapter.generate(request())


@pytest.mark.parametrize("body,headers", [
    ({"error": {"code": "bad", "detail": "Authorization: Bearer abcdefghijklmnop"}}, ()),
    ({"id": "x", "choices": [{"message": {"content": "ok"}}],
      "usage": {"prompt_tokens": 1, "completion_tokens": 1}}, (("x-debug", "api_key=FAKE_TEST_ONLY"),)),
])
def test_credential_material_is_rejected_without_leaking_it(body, headers):
    material = json.dumps([body, headers])
    adapter = CerebrasAdapter(FakeTransport(response(body, status=400 if not headers else 200, headers=headers)))
    with pytest.raises(CerebrasAdapterError, match="CREDENTIAL_MATERIAL_DETECTED") as caught:
        adapter.generate(request())
    assert all(fragment not in str(caught.value) for fragment in ("FAKE_TEST_ONLY", "abcdefghijklmnop"))
    assert material not in str(caught.value)


@pytest.mark.parametrize("header", [
    "authorization", "proxy-authorization", "x-api-key", "api-key",
    "x-auth-token", "access-token", "x-client-secret", "secret",
])
def test_credential_bearing_header_name_is_rejected_regardless_of_value(header):
    body = {"id": "upstream", "choices": [{"message": {"content": "ok"}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1}}
    value = "innocent-looking-value"
    adapter = CerebrasAdapter(FakeTransport(response(body, headers=((header, value),))))
    with pytest.raises(CerebrasAdapterError, match="CREDENTIAL_MATERIAL_DETECTED") as caught:
        adapter.generate(request())
    assert value not in str(caught.value)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_numbers_are_not_canonical_json(value):
    with pytest.raises(ValueError, match="VALUE_NOT_PLAIN"):
        canonical({"x": value})
    with pytest.raises(ValueError, match="VALUE_NOT_PLAIN"):
        detached([value])


def test_replay_same_request_is_stable_but_changed_request_is_rejected_before_send():
    body = {"id": "upstream", "choices": [{"message": {"content": "ok"}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1}}
    transport = FakeTransport(response(body))
    adapter = CerebrasAdapter(transport)
    first = adapter.generate(request())
    second = adapter.generate(request())
    assert first == second and len(transport.calls) == 1
    with pytest.raises(CerebrasAdapterError, match="REQUEST_ID_CONFLICT"):
        adapter.generate(request(input_text="changed"))
    assert len(transport.calls) == 1


def test_unknown_transport_failure_is_nonretryable_and_sanitized():
    adapter = CerebrasAdapter(RaisingTransport())
    with pytest.raises(CerebrasAdapterError, match="TRANSPORT_FAILURE") as caught:
        adapter.generate(request())
    assert caught.value.retryable is False
    assert "transport detail" not in str(caught.value)


@pytest.mark.parametrize("frames", [
    [
        {"id": "up", "choices": [{"delta": {"content": "ok"}}]},
        {"id": "up", "choices": [{"delta": {}, "finish_reason": "stop"}],
         "usage": {"prompt_tokens": 1, "completion_tokens": 1}},
        {"id": "up", "choices": [{"delta": {"content": "late"}}]},
    ],
    [
        {"id": "up", "choices": [{"delta": {"content": "ok"}}],
         "usage": {"prompt_tokens": 1, "completion_tokens": 1}},
        {"id": "up", "choices": [{"delta": {}, "finish_reason": "stop"}]},
    ],
    [
        {"id": "up", "choices": [{"delta": {"content": "ok"}}]},
        {"id": "up", "choices": [{"delta": {}, "finish_reason": "stop"}]},
        {"id": "up", "choices": [{"delta": {}}],
         "usage": {"prompt_tokens": 1, "completion_tokens": 1}},
    ],
    [
        {"id": "up", "choices": [{"delta": {"content": "ok"}}]},
        {"id": "up", "choices": [{"delta": {}, "finish_reason": "stop"}],
         "usage": {"prompt_tokens": 1, "completion_tokens": 1}},
        {"id": "up", "choices": [{"delta": {}}]},
    ],
])
def test_stream_rejects_frames_outside_single_terminal_usage_frame(frames):
    adapter = CerebrasAdapter(FakeTransport(response(frames)))
    with pytest.raises(CerebrasAdapterError, match="RESPONSE_MALFORMED"):
        adapter.stream(request(request_id="hostile-stream"))
    with pytest.raises(CerebrasAdapterError, match="RECEIPT_NOT_FOUND"):
        adapter.receipt("hostile-stream")
