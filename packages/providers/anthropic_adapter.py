"""Anthropic-native Messages adapter over host-owned transport."""
from __future__ import annotations

from threading import RLock
import re
from typing import Protocol, runtime_checkable

from packages.llm_gateway.contracts import CapabilityProbe, GatewayRequest, GatewayResponse, TokenUsage, UsageProvenance

from .anthropic_errors import AnthropicAdapterError, guard_headers, guard_material, map_error, reject
from .anthropic_models import (AUTH_HEADER, BASE_URL, EXECUTOR, FORMAT, HEALTH_MODEL, MAX_TOKENS,
                               MODELS_URL, PROVIDER_ID, REGISTERED_MODELS, REGISTRY_SOURCE, URL_SUFFIX,
                               VERSION_HEADER, AdapterReceipt, StreamResult, TransportResponse,
                               detached, digest, receipt, text)


@runtime_checkable
class AnthropicTransport(Protocol):
    def request(self, *, operation: str, endpoint: str, payload: dict[str, object], request_id: str,
                stream: bool) -> TransportResponse: ...


class AnthropicAdapter:
    def __init__(self, transport: AnthropicTransport, *, max_retry_after_seconds: int = 86400) -> None:
        if not isinstance(transport, AnthropicTransport):
            raise TypeError("TRANSPORT_REQUIRED")
        if type(max_retry_after_seconds) is not int or not 0 <= max_retry_after_seconds <= 86400:
            raise ValueError("RETRY_AFTER_LIMIT_INVALID")
        self._transport = transport
        self._maximum = max_retry_after_seconds
        self._lock = RLock()
        self._bound: dict[str, str] = {}
        self._done: dict[str, tuple[object, AdapterReceipt]] = {}

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        if not isinstance(required, (set, frozenset)) or any(type(x) is not str for x in required):
            reject("CAPABILITY_INPUT_INVALID")
        supported = frozenset({"text_generation", "streaming", "health", "discovery"})
        missing = tuple(f"missing capability: {x}" for x in sorted(required - supported))
        return CapabilityProbe(not missing, supported, missing)

    @staticmethod
    def _request_id(value: str) -> None:
        try:
            text(value, maximum=128)
        except ValueError:
            reject("REQUEST_ID_INVALID")

    @classmethod
    def _validate(cls, request: GatewayRequest) -> None:
        if not isinstance(request, GatewayRequest):
            reject("REQUEST_INVALID")
        if request.provider != PROVIDER_ID:
            reject("PROVIDER_MISMATCH")
        cls._request_id(request.request_id)
        if request.model not in REGISTERED_MODELS:
            reject("MODEL_NOT_REGISTERED")

    def _reserve(self, operation: str, request_id: str, signature: object) -> object | None:
        fingerprint = digest([operation, signature])
        old = self._bound.get(request_id)
        if old is not None and old != fingerprint:
            reject("REQUEST_ID_CONFLICT")
        self._bound[request_id] = fingerprint
        done = self._done.get(request_id)
        return done[0] if done is not None else None

    def _save(self, request_id: str, value: object, evidence: AdapterReceipt) -> object:
        self._done[request_id] = (value, evidence)
        return value

    def receipt(self, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            if request_id not in self._done:
                reject("RECEIPT_NOT_FOUND")
            return self._done[request_id][1]

    def _send(self, operation: str, url: str, payload: dict[str, object], request_id: str,
              *, stream: bool = False) -> TransportResponse:
        try:
            result = self._transport.request(operation=operation, endpoint=url, payload=detached(payload),
                                             request_id=request_id, stream=stream)
        except Exception:
            raise AnthropicAdapterError("TRANSPORT_FAILURE") from None
        if not isinstance(result, TransportResponse):
            reject("RESPONSE_MALFORMED")
        guard_headers(result.headers)
        guard_material([result.headers, result.body])
        if not 200 <= result.status_code <= 299:
            map_error(result, maximum=self._maximum)
        return result

    @staticmethod
    def _usage(raw: object, *, allow_partial: bool = False) -> tuple[TokenUsage, dict]:
        if type(raw) is not dict or (not allow_partial and not {"input_tokens", "output_tokens"} <= raw.keys()):
            reject("RESPONSE_MALFORMED")
        inp, out = raw.get("input_tokens"), raw.get("output_tokens")
        cache_read = raw.get("cache_read_input_tokens", 0)
        cache_create = raw.get("cache_creation_input_tokens", 0)
        if (inp is not None and (type(inp) is not int or inp < 0)
                or out is not None and (type(out) is not int or out < 0)
                or type(cache_read) is not int or cache_read < 0
                or type(cache_create) is not int or cache_create < 0):
            reject("RESPONSE_MALFORMED")
        return TokenUsage((inp or 0) + cache_read + cache_create, out or 0), detached(raw)

    @staticmethod
    def _safe_output(output: str) -> None:
        guard_material(output)
        if not output or output != output.strip():
            reject("OUTPUT_TEXT_NON_CANONICAL")

    @staticmethod
    def _payload(request: GatewayRequest, *, stream: bool) -> dict[str, object]:
        return {"model": request.model, "max_tokens": MAX_TOKENS,
                "messages": [{"role": "user", "content": request.input_text}], "stream": stream}

    @staticmethod
    def _aborted(request: GatewayRequest, operation: str) -> tuple[GatewayResponse, AdapterReceipt]:
        result = GatewayResponse(request.request_id, PROVIDER_ID, request.model, "", TokenUsage(),
                                 UsageProvenance.ABORT_CONFIRMED, "ABORTED")
        evidence = receipt(operation.upper(), request.request_id, dict(operation=operation,
            request_id=request.request_id, provider=PROVIDER_ID, requested_model=request.model,
            response_id=None, output_text="", input_tokens=0, output_tokens=0,
            usage_provenance="ABORT_CONFIRMED", abort_status="ABORTED", transport_sent=False))
        return result, evidence

    @staticmethod
    def _identity(body: object) -> tuple[str, str]:
        if type(body) is not dict or body.get("type") != "message" or body.get("role") != "assistant":
            reject("RESPONSE_MALFORMED")
        try:
            return text(body.get("id")), text(body.get("model"))
        except ValueError:
            reject("RESPONSE_MALFORMED")

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self._validate(request)
        with self._lock:
            old = self._reserve("generate", request.request_id, [request.provider, request.model, request.input_text])
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                value, evidence = self._aborted(request, "generate")
                return self._save(request.request_id, value, evidence)  # type: ignore[return-value]
            body = self._send("generate", BASE_URL + URL_SUFFIX, self._payload(request, stream=False), request.request_id).body
            response_id, serving_model = self._identity(body)
            if body.get("stop_reason") not in {"end_turn", "stop_sequence"}:
                reject("CONTENT_BLOCKED")
            blocks = body.get("content")
            if type(blocks) is not list or not blocks or any(type(b) is not dict or b.get("type") != "text"
                                                             or type(b.get("text")) is not str for b in blocks):
                reject("RESPONSE_MALFORMED")
            output = "".join(block["text"] for block in blocks)
            self._safe_output(output)
            usage, metadata = self._usage(body.get("usage"))
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if request.is_aborted() else "COMPLETED"
            value = GatewayResponse(request.request_id, PROVIDER_ID, request.model, output, usage,
                                    UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("GENERATE", request.request_id, dict(operation="generate", request_id=request.request_id,
                provider=PROVIDER_ID, requested_model=request.model, serving_model=serving_model,
                response_id=response_id, output_text=output, input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens, usage_metadata=metadata,
                usage_provenance="PROVIDER_FINAL", abort_status=status, transport_sent=True))
            return self._save(request.request_id, value, evidence)  # type: ignore[return-value]

    def stream(self, request: GatewayRequest) -> StreamResult:
        self._validate(request)
        with self._lock:
            old = self._reserve("stream", request.request_id, [request.provider, request.model, request.input_text])
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                response, evidence = self._aborted(request, "stream")
                return self._save(request.request_id, StreamResult((), response, evidence), evidence)  # type: ignore[return-value]
            frames = self._send("stream", BASE_URL + URL_SUFFIX, self._payload(request, stream=True),
                                request.request_id, stream=True).body
            if type(frames) is not list or not frames:
                reject("RESPONSE_MALFORMED")
            response_id = serving_model = None
            blocks: dict[int, str] = {}
            chunks: list[str] = []
            usage_start = None
            usage_final = None
            previous_output = None
            previous_input = None
            final_delta_has_output = False
            stopped = False
            stop_reason = None
            aborted = False
            for position, frame in enumerate(frames):
                if type(frame) is not dict or type(frame.get("type")) is not str:
                    reject("RESPONSE_MALFORMED")
                kind = frame["type"]
                if kind == "error":
                    reject("STREAM_PROVIDER_ERROR")
                if kind == "ping" or kind not in {"message_start", "content_block_start", "content_block_delta",
                                                    "content_block_stop", "message_delta", "message_stop"}:
                    continue
                if stopped or (response_id is None and kind != "message_start"):
                    reject("RESPONSE_MALFORMED")
                if (("id" in frame and frame["id"] != response_id)
                        or ("model" in frame and frame["model"] != serving_model)):
                    reject("RESPONSE_MALFORMED")
                if kind == "message_start":
                    if response_id is not None:
                        reject("RESPONSE_MALFORMED")
                    body = frame.get("message")
                    response_id, serving_model = self._identity(body)
                    if body.get("content") != [] or body.get("stop_reason") is not None:
                        reject("RESPONSE_MALFORMED")
                    usage_start = body.get("usage")
                    self._usage(usage_start, allow_partial=True)
                    if (type(usage_start) is not dict or type(usage_start.get("input_tokens")) is not int
                            or type(usage_start.get("output_tokens")) is not int):
                        reject("RESPONSE_MALFORMED")
                    previous_output = usage_start["output_tokens"]
                    previous_input = usage_start["input_tokens"]
                elif kind == "content_block_start":
                    index = frame.get("index")
                    block = frame.get("content_block")
                    if (type(index) is not int or index != len(blocks) or type(block) is not dict
                            or block.get("type") != "text" or type(block.get("text")) is not str
                            or stop_reason is not None):
                        reject("RESPONSE_MALFORMED")
                    blocks[index] = "open"
                    if block["text"]:
                        chunks.append(block["text"])
                elif kind == "content_block_delta":
                    index, delta = frame.get("index"), frame.get("delta")
                    if (type(index) is not int or blocks.get(index) != "open" or type(delta) is not dict
                            or delta.get("type") != "text_delta" or type(delta.get("text")) is not str
                            or stop_reason is not None):
                        reject("RESPONSE_MALFORMED")
                    chunks.append(delta["text"])
                elif kind == "content_block_stop":
                    index = frame.get("index")
                    if type(index) is not int or blocks.get(index) != "open":
                        reject("RESPONSE_MALFORMED")
                    blocks[index] = "closed"
                elif kind == "message_delta":
                    delta = frame.get("delta")
                    if type(delta) is not dict:
                        reject("RESPONSE_MALFORMED")
                    reason = delta.get("stop_reason")
                    if reason is not None and reason not in {"end_turn", "stop_sequence"}:
                        reject("CONTENT_BLOCKED")
                    if any(state != "closed" for state in blocks.values()):
                        reject("RESPONSE_MALFORMED")
                    if reason is not None:
                        stop_reason = reason
                    final_delta_has_output = False
                    if "usage" in frame:
                        self._usage(frame["usage"], allow_partial=True)
                        usage_final = frame["usage"]
                        if "input_tokens" in usage_final:
                            if usage_final["input_tokens"] < previous_input:
                                reject("RESPONSE_MALFORMED")
                            previous_input = usage_final["input_tokens"]
                        if "output_tokens" in usage_final:
                            if usage_final["output_tokens"] < previous_output:
                                reject("RESPONSE_MALFORMED")
                            previous_output = usage_final["output_tokens"]
                            final_delta_has_output = True
                elif kind == "message_stop":
                    if stop_reason is None or position != len(frames) - 1 or not final_delta_has_output:
                        reject("RESPONSE_MALFORMED")
                    stopped = True
                if request.is_aborted():
                    aborted = True
            if not stopped or not blocks or any(state != "closed" for state in blocks.values()) or usage_final is None:
                reject("RESPONSE_MALFORMED")
            merged_usage = dict(usage_start or {})
            merged_usage.update(usage_final)
            usage, metadata = self._usage(merged_usage)
            output = "".join(chunks)
            self._safe_output(output)
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if aborted else "COMPLETED"
            value = GatewayResponse(request.request_id, PROVIDER_ID, request.model, output, usage,
                                    UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("STREAM", request.request_id, dict(operation="stream", request_id=request.request_id,
                provider=PROVIDER_ID, requested_model=request.model, serving_model=serving_model,
                response_id=response_id, chunks=chunks, output_text=output,
                input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_metadata=metadata, usage_provenance="PROVIDER_FINAL", abort_status=status, transport_sent=True))
            return self._save(request.request_id, StreamResult(tuple(chunks), value, evidence), evidence)  # type: ignore[return-value]

    def health(self, *, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve("health", request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            raw = self._send("health", f"{MODELS_URL}/{HEALTH_MODEL}", {}, request_id)
            body = raw.body
            if type(body) is not dict or raw.authenticated_probe is not True or body.get("type") != "model":
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            try:
                resolved = text(body.get("id"))
            except ValueError:
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            if (resolved != HEALTH_MODEL
                    and re.fullmatch(r"claude-sonnet-4-6-[A-Za-z0-9-]+", resolved) is None):
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            evidence = receipt("HEALTH", request_id, dict(operation="health", request_id=request_id,
                provider=PROVIDER_ID, requested_model=HEALTH_MODEL, resolved_model=resolved,
                status="AVAILABLE", authenticated_probe=True, transport_sent=True))
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]

    def discover(self, *, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve("discovery", request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            evidence = receipt("DISCOVERY", request_id, dict(operation="discovery", request_id=request_id,
                provider=PROVIDER_ID, models=list(REGISTERED_MODELS), source=REGISTRY_SOURCE,
                format=FORMAT, executor=EXECUTOR, auth_header=AUTH_HEADER,
                anthropic_version=VERSION_HEADER, base_url=BASE_URL, url_suffix=URL_SUFFIX,
                status="STATIC_REGISTRY", credential_health="UNVERIFIED", live_freshness="UNVERIFIED",
                transport_sent=False))
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]
