"""Gemini-native adapter over a host-owned, injected transport."""
from __future__ import annotations

from threading import RLock
from typing import Protocol, runtime_checkable

from packages.llm_gateway.contracts import CapabilityProbe, GatewayRequest, GatewayResponse, TokenUsage, UsageProvenance

from .gemini_errors import GeminiAdapterError, guard_headers, guard_material, map_error, reject
from .gemini_models import (AUTH_HEADER, BASE_URL, EXECUTOR, FORMAT, HEALTH_MODEL, PROVIDER_ID,
                            REGISTERED_MODELS, REGISTRY_SOURCE, TTS_ONLY_MODELS, AdapterReceipt,
                            StreamResult, TransportResponse, detached, digest, endpoint, receipt, text)


@runtime_checkable
class GeminiTransport(Protocol):
    def request(self, *, operation: str, endpoint: str, payload: dict[str, object], request_id: str,
                stream: bool) -> TransportResponse: ...


class GeminiAdapter:
    def __init__(self, transport: GeminiTransport, *, max_retry_after_seconds: int = 86400) -> None:
        if not isinstance(transport, GeminiTransport):
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
        if request.model in TTS_ONLY_MODELS:
            reject("MODEL_CAPABILITY_UNSUPPORTED")

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
            # The host may include credential material even in an adapter-shaped error.
            raise GeminiAdapterError("TRANSPORT_FAILURE") from None
        if not isinstance(result, TransportResponse):
            reject("RESPONSE_MALFORMED")
        guard_headers(result.headers)
        guard_material([result.headers, result.body])
        if not 200 <= result.status_code <= 299:
            map_error(result, maximum=self._maximum)
        return result

    @staticmethod
    def _usage(body: dict) -> tuple[TokenUsage, dict]:
        raw = body.get("usageMetadata")
        if type(raw) is not dict or not {"promptTokenCount", "candidatesTokenCount", "totalTokenCount"} <= raw.keys():
            reject("RESPONSE_MALFORMED")
        prompt, candidate, total = (raw[key] for key in ("promptTokenCount", "candidatesTokenCount", "totalTokenCount"))
        if any(type(n) is not int or n < 0 for n in (prompt, candidate, total)) or total < prompt + candidate:
            reject("RESPONSE_MALFORMED")
        for field in ("thoughtsTokenCount", "cachedContentTokenCount"):
            if field in raw and (type(raw[field]) is not int or raw[field] < 0):
                reject("RESPONSE_MALFORMED")
        if total < prompt + candidate + raw.get("thoughtsTokenCount", 0):
            reject("RESPONSE_MALFORMED")
        return TokenUsage(prompt, total - prompt), detached(raw)

    @staticmethod
    def _parse_frame(body: object, model: str, *, allow_empty: bool = False) -> tuple[str, str, str]:
        if type(body) is not dict:
            reject("RESPONSE_MALFORMED")
        try:
            response_id = text(body.get("responseId"))
            version = text(body.get("modelVersion"))
        except ValueError:
            reject("RESPONSE_MALFORMED")
        feedback = body.get("promptFeedback")
        if type(feedback) is dict and feedback.get("blockReason"):
            reject("CONTENT_BLOCKED")
        candidates = body.get("candidates")
        if type(candidates) is not list or len(candidates) != 1 or type(candidates[0]) is not dict:
            reject("RESPONSE_MALFORMED")
        candidate = candidates[0]
        if candidate.get("finishReason") not in {None, "STOP"}:
            reject("CONTENT_BLOCKED")
        content = candidate.get("content")
        if content is None and allow_empty and candidate.get("finishReason") == "STOP":
            return response_id, version, ""
        if type(content) is not dict:
            reject("RESPONSE_MALFORMED")
        if (allow_empty and candidate.get("finishReason") == "STOP" and "parts" not in content
                and content.get("role") in {None, "model"}):
            return response_id, version, ""
        if content.get("role") != "model":
            reject("RESPONSE_MALFORMED")
        parts = content.get("parts")
        if type(parts) is not list or any(type(part) is not dict or type(part.get("text")) is not str
                                          for part in parts):
            reject("RESPONSE_MALFORMED")
        output = "".join(part["text"] for part in parts)
        if not output and not (allow_empty and candidate.get("finishReason") == "STOP"):
            reject("RESPONSE_MALFORMED")
        return response_id, version, output

    @staticmethod
    def _safe_output(output: str) -> None:
        guard_material(output)
        if not output or output != output.strip():
            reject("OUTPUT_TEXT_NON_CANONICAL")

    @staticmethod
    def _payload(request: GatewayRequest, *, stream: bool) -> dict[str, object]:
        return {"contents": [{"role": "user", "parts": [{"text": request.input_text}]}]}

    @staticmethod
    def _aborted(request: GatewayRequest, operation: str) -> tuple[GatewayResponse, AdapterReceipt]:
        result = GatewayResponse(request.request_id, PROVIDER_ID, request.model, "", TokenUsage(),
                                 UsageProvenance.ABORT_CONFIRMED, "ABORTED")
        evidence = receipt(operation.upper(), request.request_id, dict(operation=operation,
            request_id=request.request_id, provider=PROVIDER_ID, requested_model=request.model,
            response_id=None, output_text="", input_tokens=0, output_tokens=0,
            usage_provenance="ABORT_CONFIRMED", abort_status="ABORTED", transport_sent=False))
        return result, evidence

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self._validate(request)
        with self._lock:
            old = self._reserve("generate", request.request_id, [request.provider, request.model, request.input_text])
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                value, evidence = self._aborted(request, "generate")
                return self._save(request.request_id, value, evidence)  # type: ignore[return-value]
            body = self._send("generate", endpoint(request.model), self._payload(request, stream=False), request.request_id).body
            response_id, version, output = self._parse_frame(body, request.model)
            if body["candidates"][0].get("finishReason") != "STOP":
                reject("RESPONSE_MALFORMED")
            usage, metadata = self._usage(body)
            self._safe_output(output)
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if request.is_aborted() else "COMPLETED"
            value = GatewayResponse(request.request_id, PROVIDER_ID, request.model, output,
                                    usage, UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("GENERATE", request.request_id, dict(operation="generate",
                request_id=request.request_id, provider=PROVIDER_ID, requested_model=request.model,
                response_id=response_id, model_version=version, output_text=output,
                input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_metadata=metadata, usage_provenance="PROVIDER_FINAL", abort_status=status,
                transport_sent=True))
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
            bodies = self._send("stream", endpoint(request.model, stream=True), self._payload(request, stream=True), request.request_id, stream=True).body
            if type(bodies) is not list or not bodies:
                reject("RESPONSE_MALFORMED")
            chunks: list[str] = []
            response_id = None
            version = None
            usage = None
            metadata = None
            aborted = False
            for index, body in enumerate(bodies):
                current_id, current_version, output = self._parse_frame(
                    body, request.model, allow_empty=index == len(bodies) - 1)
                if response_id is not None and (current_id != response_id or current_version != version):
                    reject("RESPONSE_MALFORMED")
                response_id, version = current_id, current_version
                if output:
                    chunks.append(output)
                if "usageMetadata" in body:
                    if index == len(bodies) - 1:
                        usage, metadata = self._usage(body)
                if index != len(bodies) - 1 and body["candidates"][0].get("finishReason") is not None:
                    reject("RESPONSE_MALFORMED")
                if index == len(bodies) - 1 and body["candidates"][0].get("finishReason") != "STOP":
                    reject("RESPONSE_MALFORMED")
                if request.is_aborted():
                    aborted = True
            if usage is None or not chunks:
                reject("RESPONSE_MALFORMED")
            output = "".join(chunks)
            self._safe_output(output)
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if aborted else "COMPLETED"
            response = GatewayResponse(request.request_id, PROVIDER_ID, request.model, output,
                                       usage, UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("STREAM", request.request_id, dict(operation="stream",
                request_id=request.request_id, provider=PROVIDER_ID, requested_model=request.model,
                response_id=response_id, model_version=version, chunks=chunks, output_text=output,
                input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_metadata=metadata, usage_provenance="PROVIDER_FINAL", abort_status=status,
                transport_sent=True))
            return self._save(request.request_id, StreamResult(tuple(chunks), response, evidence), evidence)  # type: ignore[return-value]

    def health(self, *, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve("health", request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            raw = self._send("health", f"{BASE_URL}/{HEALTH_MODEL}", {}, request_id)
            body = raw.body
            if (type(body) is not dict or raw.authenticated_probe is not True
                    or body.get("name") != f"models/{HEALTH_MODEL}"
                    or type(body.get("supportedGenerationMethods")) is not list
                    or "generateContent" not in body["supportedGenerationMethods"]):
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            evidence = receipt("HEALTH", request_id, dict(operation="health", request_id=request_id,
                provider=PROVIDER_ID, model=HEALTH_MODEL, status="AVAILABLE",
                authenticated_probe=True, transport_sent=True))
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]

    def discover(self, *, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve("discovery", request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            evidence = receipt("DISCOVERY", request_id, dict(operation="discovery", request_id=request_id,
                provider=PROVIDER_ID, models=list(REGISTERED_MODELS), tts_only_models=sorted(TTS_ONLY_MODELS),
                source=REGISTRY_SOURCE, format=FORMAT, executor=EXECUTOR, auth_header=AUTH_HEADER,
                base_url=BASE_URL, status="STATIC_REGISTRY", credential_health="UNVERIFIED",
                live_freshness="UNVERIFIED", transport_sent=False))
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]
