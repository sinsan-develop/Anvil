"""Upstage OpenAI-format adapter over an injected, host-owned transport."""
from __future__ import annotations

from threading import RLock
from typing import Protocol, runtime_checkable

from packages.llm_gateway.contracts import CapabilityProbe, GatewayRequest, GatewayResponse, TokenUsage, UsageProvenance

from .upstage_errors import UpstageAdapterError, guard_headers, guard_material, map_error, reject
from .upstage_models import (AUTH_HEADER, CHAT_BASE_URL, EXECUTOR, FORMAT, AdapterReceipt,
                             PROVIDER_ID, REGISTERED_MODELS, REGISTRY_SOURCE,
                             StreamResult, TransportResponse, detached, digest, receipt, text)


@runtime_checkable
class UpstageTransport(Protocol):
    def request(self, *, operation: str, payload: dict[str, object], request_id: str,
                stream: bool) -> TransportResponse: ...


class UpstageAdapter:
    def __init__(self, transport: UpstageTransport, *, max_retry_after_seconds: int = 86400) -> None:
        if not isinstance(transport, UpstageTransport):
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

    def _reserve(self, operation: str, request_id: str, input_signature: object) -> object | None:
        fingerprint = digest([operation, input_signature])
        prior = self._bound.get(request_id)
        if prior is not None and prior != fingerprint:
            reject("REQUEST_ID_CONFLICT")
        self._bound[request_id] = fingerprint
        done = self._done.get(request_id)
        return done[0] if done is not None else None

    def _save(self, request_id: str, result: object, evidence: AdapterReceipt) -> object:
        self._done[request_id] = (result, evidence)
        return result

    def receipt(self, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            if request_id not in self._done:
                reject("RECEIPT_NOT_FOUND")
            return self._done[request_id][1]

    def _send(self, operation: str, payload: dict[str, object], request_id: str,
              *, stream: bool = False) -> TransportResponse:
        try:
            result = self._transport.request(operation=operation, payload=detached(payload),
                                             request_id=request_id, stream=stream)
        except UpstageAdapterError:
            raise
        except Exception:
            reject("TRANSPORT_FAILURE")
        if not isinstance(result, TransportResponse):
            reject("RESPONSE_MALFORMED")
        guard_headers(result.headers)
        guard_material([result.headers, result.body])
        if not 200 <= result.status_code <= 299:
            map_error(result, maximum=self._maximum)
        return result

    @staticmethod
    def _usage(body: dict) -> TokenUsage:
        usage = body.get("usage")
        if type(usage) is not dict or not {"prompt_tokens", "completion_tokens", "total_tokens"} <= usage.keys():
            reject("RESPONSE_MALFORMED")
        first, second, total = (usage[key] for key in ("prompt_tokens", "completion_tokens", "total_tokens"))
        if (any(type(value) is not int or value < 0 for value in (first, second, total))
                or total != first + second):
            reject("RESPONSE_MALFORMED")
        return TokenUsage(first, second)

    @staticmethod
    def _completion_id(body: dict, model: str) -> str:
        try:
            completion_id = text(body.get("id"))
            served_model = text(body.get("model"))
        except ValueError:
            reject("RESPONSE_MALFORMED")
        if served_model != model:
            reject("SERVED_MODEL_MISMATCH")
        return completion_id

    @staticmethod
    def _payload(request: GatewayRequest, *, stream: bool) -> dict[str, object]:
        payload: dict[str, object] = {"model": request.model,
            "messages": [{"role": "user", "content": request.input_text}]}
        if stream:
            payload["stream"] = True
            # The Upstage reference only establishes stream_options as an object.
            # Final usage is accepted solely when actually present in host frames.
        return payload

    @staticmethod
    def _aborted(request: GatewayRequest, operation: str) -> tuple[GatewayResponse, AdapterReceipt]:
        result = GatewayResponse(request.request_id, PROVIDER_ID, request.model, "", TokenUsage(),
                                 UsageProvenance.ABORT_CONFIRMED, "ABORTED")
        evidence = receipt(operation.upper(), request.request_id, dict(
            operation=operation, request_id=request.request_id, provider=PROVIDER_ID,
            requested_model=request.model, completion_id=None, output_text="",
            input_tokens=0, output_tokens=0, usage_provenance="ABORT_CONFIRMED",
            abort_status="ABORTED", transport_sent=False))
        return result, evidence

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self._validate(request)
        with self._lock:
            old = self._reserve("generate", request.request_id,
                                [request.provider, request.model, request.input_text])
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                result, evidence = self._aborted(request, "generate")
                return self._save(request.request_id, result, evidence)  # type: ignore[return-value]
            raw = self._send("generate", self._payload(request, stream=False), request.request_id)
            body = raw.body
            if type(body) is not dict or body.get("object") != "chat.completion":
                reject("RESPONSE_MALFORMED")
            completion_id = self._completion_id(body, request.model)
            choices = body.get("choices")
            if type(choices) is not list or len(choices) != 1 or type(choices[0]) is not dict:
                reject("RESPONSE_MALFORMED")
            choice = choices[0]
            message = choice.get("message")
            if (choice.get("index") != 0 or choice.get("finish_reason") != "stop"
                    or type(message) is not dict or message.get("role") != "assistant"
                    or type(message.get("content")) is not str or not message["content"]):
                reject("RESPONSE_MALFORMED")
            usage = self._usage(body)
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if request.is_aborted() else "COMPLETED"
            result = GatewayResponse(request.request_id, PROVIDER_ID, request.model, message["content"],
                                     usage, UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("GENERATE", request.request_id, dict(operation="generate",
                request_id=request.request_id, provider=PROVIDER_ID, requested_model=request.model,
                completion_id=completion_id, output_text=message["content"],
                input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_provenance="PROVIDER_FINAL", abort_status=status, transport_sent=True))
            return self._save(request.request_id, result, evidence)  # type: ignore[return-value]

    def stream(self, request: GatewayRequest) -> StreamResult:
        self._validate(request)
        with self._lock:
            old = self._reserve("stream", request.request_id,
                                [request.provider, request.model, request.input_text])
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                response, evidence = self._aborted(request, "stream")
                result = StreamResult((), response, evidence)
                return self._save(request.request_id, result, evidence)  # type: ignore[return-value]
            raw = self._send("stream", self._payload(request, stream=True), request.request_id, stream=True)
            if type(raw.body) is not list or not raw.body:
                reject("RESPONSE_MALFORMED")
            chunks: list[str] = []
            completion_id = None
            usage = None
            finished = False
            role_seen = False
            aborted = False
            for index, frame in enumerate(raw.body):
                if type(frame) is not dict or usage is not None or frame.get("object") != "chat.completion.chunk":
                    reject("RESPONSE_MALFORMED")
                current_id = self._completion_id(frame, request.model)
                if completion_id is not None and completion_id != current_id:
                    reject("RESPONSE_MALFORMED")
                completion_id = current_id
                choices = frame.get("choices")
                if type(choices) is not list or len(choices) not in {0, 1}:
                    reject("RESPONSE_MALFORMED")
                if not choices:
                    if not finished or index != len(raw.body)-1:
                        reject("RESPONSE_MALFORMED")
                    usage = self._usage(frame)
                else:
                    if finished or type(choices[0]) is not dict:
                        reject("RESPONSE_MALFORMED")
                    choice = choices[0]
                    delta = choice.get("delta")
                    if choice.get("index") != 0 or type(delta) is not dict or set(delta)-{"role", "content"}:
                        reject("RESPONSE_MALFORMED")
                    if "role" in delta:
                        if delta["role"] != "assistant" or role_seen or chunks:
                            reject("RESPONSE_MALFORMED")
                        role_seen = True
                    if "content" in delta:
                        if type(delta["content"]) is not str:
                            reject("RESPONSE_MALFORMED")
                        if delta["content"]:
                            chunks.append(delta["content"])
                    if choice.get("finish_reason") is not None:
                        if choice["finish_reason"] != "stop":
                            reject("RESPONSE_MALFORMED")
                        finished = True
                    if frame.get("usage") is not None:
                        if not finished or index != len(raw.body)-1:
                            reject("RESPONSE_MALFORMED")
                        usage = self._usage(frame)
                if request.is_aborted():
                    aborted = True
            if not finished or usage is None or completion_id is None or not chunks and not aborted:
                reject("RESPONSE_MALFORMED")
            output = "".join(chunks)
            status = ("ABORT_REQUESTED_UPSTREAM_COMPLETED" if output else "ABORTED") if aborted else "COMPLETED"
            result_response = GatewayResponse(request.request_id, PROVIDER_ID, request.model, output,
                                              usage, UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("STREAM", request.request_id, dict(operation="stream",
                request_id=request.request_id, provider=PROVIDER_ID, requested_model=request.model,
                completion_id=completion_id, chunks=chunks, output_text=output,
                input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_provenance="PROVIDER_FINAL", abort_status=status, transport_sent=True))
            result = StreamResult(tuple(chunks), result_response, evidence)
            return self._save(request.request_id, result, evidence)  # type: ignore[return-value]

    def health(self, *, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve("health", request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            raw = self._send("health", {}, request_id)
            if raw.body != {"status": "ok", "authenticated": True}:
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            evidence = receipt("HEALTH", request_id, dict(operation="health", request_id=request_id,
                provider=PROVIDER_ID, status="AVAILABLE", authenticated_probe=True, transport_sent=True))
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]

    def discover(self, *, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve("discovery", request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            evidence = receipt("DISCOVERY", request_id, dict(operation="discovery", request_id=request_id,
                provider=PROVIDER_ID, models=list(REGISTERED_MODELS), source=REGISTRY_SOURCE,
                format=FORMAT, executor=EXECUTOR, auth_header=AUTH_HEADER, chat_base_url=CHAT_BASE_URL,
                status="STATIC_REGISTRY", credential_health="UNVERIFIED", live_freshness="UNVERIFIED",
                transport_sent=False))
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]
