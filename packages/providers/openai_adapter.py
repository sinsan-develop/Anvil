"""OpenAI native Chat/Responses adapter over host-owned transport."""
from __future__ import annotations

from threading import RLock
from typing import Protocol, runtime_checkable

from packages.llm_gateway.contracts import CapabilityProbe, GatewayRequest, GatewayResponse, TokenUsage, UsageProvenance

from .openai_errors import OpenAIAdapterError, guard_headers, guard_material, map_error, reject
from .openai_models import (AUTH_HEADER, CHAT_URL, EXECUTOR, FORMAT, HEALTH_MODEL, MODELS_URL, PROVIDER_ID,
                            REASONING_TRANSPORT, REGISTERED_MODELS, REGISTRY_SOURCE, RESPONSES_ONLY_MODELS,
                            RESPONSES_URL, AdapterReceipt, StreamResult, TransportResponse, detached, digest,
                            receipt, text)


@runtime_checkable
class OpenAITransport(Protocol):
    def request(self, *, operation: str, endpoint: str, payload: dict[str, object], request_id: str,
                stream: bool) -> TransportResponse: ...


class OpenAIAdapter:
    def __init__(self, transport: OpenAITransport, *, max_retry_after_seconds: int = 86400) -> None:
        if not isinstance(transport, OpenAITransport):
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
            raise OpenAIAdapterError("TRANSPORT_FAILURE") from None
        if not isinstance(result, TransportResponse):
            reject("RESPONSE_MALFORMED")
        guard_headers(result.headers)
        guard_material([result.headers, result.body])
        if not 200 <= result.status_code <= 299:
            map_error(result, maximum=self._maximum)
        return result

    @staticmethod
    def _usage(raw: object, *, responses: bool) -> tuple[TokenUsage, dict]:
        first, second = (("input_tokens", "output_tokens") if responses else
                         ("prompt_tokens", "completion_tokens"))
        if type(raw) is not dict or not {first, second, "total_tokens"} <= raw.keys():
            reject("RESPONSE_MALFORMED")
        a, b, total = raw[first], raw[second], raw["total_tokens"]
        if any(type(x) is not int or x < 0 for x in (a, b, total)) or a + b != total:
            reject("RESPONSE_MALFORMED")
        return TokenUsage(a, b), detached(raw)

    @staticmethod
    def _safe_output(output: str) -> None:
        guard_material(output)
        if not output or output != output.strip():
            reject("OUTPUT_TEXT_NON_CANONICAL")

    @staticmethod
    def _identity(body: object, *, responses: bool) -> tuple[str, str]:
        if type(body) is not dict or body.get("object") != ("response" if responses else "chat.completion"):
            reject("RESPONSE_MALFORMED")
        try:
            return text(body.get("id")), text(body.get("model"))
        except ValueError:
            reject("RESPONSE_MALFORMED")

    @staticmethod
    def _payload(request: GatewayRequest, *, stream: bool, responses: bool) -> dict[str, object]:
        if responses:
            return {"model": request.model, "input": [{"role": "user", "content": request.input_text}],
                    "stream": stream, "store": False}
        payload: dict[str, object] = {"model": request.model,
                                      "messages": [{"role": "user", "content": request.input_text}],
                                      "stream": stream}
        if stream:
            payload["stream_options"] = {"include_usage": True}
        return payload

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
    def _chat_text(body: dict) -> str:
        choices = body.get("choices")
        if (type(choices) is not list or len(choices) != 1 or type(choices[0]) is not dict
                or choices[0].get("index") != 0 or choices[0].get("finish_reason") != "stop"):
            reject("CONTENT_BLOCKED")
        message = choices[0].get("message")
        if (type(message) is not dict or message.get("role") != "assistant"
                or type(message.get("content")) is not str or message.get("tool_calls")
                or message.get("function_call") or message.get("refusal")):
            reject("RESPONSE_MALFORMED")
        return message["content"]

    @staticmethod
    def _responses_text(body: dict) -> str:
        if body.get("status") != "completed" or body.get("error") or body.get("incomplete_details"):
            reject("CONTENT_BLOCKED")
        output = body.get("output")
        if type(output) is not list or not output:
            reject("RESPONSE_MALFORMED")
        pieces = []
        for item in output:
            if (type(item) is not dict or item.get("type") != "message" or item.get("role") != "assistant"
                    or item.get("status") != "completed" or type(item.get("content")) is not list):
                reject("CONTENT_BLOCKED")
            for content in item["content"]:
                if type(content) is not dict or content.get("type") != "output_text" or type(content.get("text")) is not str:
                    reject("CONTENT_BLOCKED")
                pieces.append(content["text"])
        return "".join(pieces)

    def _finish(self, request: GatewayRequest, operation: str, response_id: str, serving_model: str,
                output: str, usage_raw: object, *, responses: bool, chunks: tuple[str, ...] | None = None,
                aborted: bool = False) -> tuple[GatewayResponse, AdapterReceipt]:
        self._safe_output(output)
        usage, metadata = self._usage(usage_raw, responses=responses)
        status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if aborted or request.is_aborted() else "COMPLETED"
        value = GatewayResponse(request.request_id, PROVIDER_ID, request.model, output, usage,
                                UsageProvenance.PROVIDER_FINAL, status)
        payload = dict(operation=operation, request_id=request.request_id, provider=PROVIDER_ID,
                       requested_model=request.model, serving_model=serving_model, response_id=response_id,
                       output_text=output, input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                       usage_metadata=metadata, usage_provenance="PROVIDER_FINAL", abort_status=status,
                       transport_sent=True, wire_format="responses" if responses else "chat")
        if chunks is not None:
            payload["chunks"] = list(chunks)
        return value, receipt(operation.upper(), request.request_id, payload)

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self._validate(request)
        with self._lock:
            old = self._reserve("generate", request.request_id, [request.provider, request.model, request.input_text])
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                value, evidence = self._aborted(request, "generate")
                return self._save(request.request_id, value, evidence)  # type: ignore[return-value]
            responses = request.model in RESPONSES_ONLY_MODELS
            body = self._send("generate", RESPONSES_URL if responses else CHAT_URL,
                              self._payload(request, stream=False, responses=responses), request.request_id).body
            response_id, serving_model = self._identity(body, responses=responses)
            output = self._responses_text(body) if responses else self._chat_text(body)
            value, evidence = self._finish(request, "generate", response_id, serving_model, output,
                                           body.get("usage"), responses=responses)
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
            responses = request.model in RESPONSES_ONLY_MODELS
            frames = self._send("stream", RESPONSES_URL if responses else CHAT_URL,
                                self._payload(request, stream=True, responses=responses), request.request_id,
                                stream=True).body
            if type(frames) is not list or not frames:
                reject("RESPONSE_MALFORMED")
            parsed = (self._stream_responses(frames, request) if responses
                      else self._stream_chat(frames, request))
            response_id, serving_model, chunks, usage_raw, aborted = parsed
            value, evidence = self._finish(request, "stream", response_id, serving_model, "".join(chunks),
                                           usage_raw, responses=responses, chunks=tuple(chunks), aborted=aborted)
            return self._save(request.request_id, StreamResult(tuple(chunks), value, evidence), evidence)  # type: ignore[return-value]

    @staticmethod
    def _stream_chat(frames: list, request: GatewayRequest) -> tuple[str, str, list[str], object, bool]:
        response_id = serving_model = None
        chunks: list[str] = []
        stopped = done = aborted = False
        usage = None
        for pos, frame in enumerate(frames):
            if frame == "[DONE]":
                if pos != len(frames) - 1 or not stopped or usage is None:
                    reject("RESPONSE_MALFORMED")
                done = True
                continue
            if type(frame) is not dict or frame.get("object") != "chat.completion.chunk" or done:
                reject("RESPONSE_MALFORMED")
            try:
                ident, model = text(frame.get("id")), text(frame.get("model"))
            except ValueError:
                reject("RESPONSE_MALFORMED")
            if response_id is None:
                response_id, serving_model = ident, model
            elif (ident, model) != (response_id, serving_model):
                reject("RESPONSE_MALFORMED")
            choices = frame.get("choices")
            if type(choices) is not list:
                reject("RESPONSE_MALFORMED")
            if choices == []:
                if not stopped or usage is not None or pos != len(frames) - 2:
                    reject("RESPONSE_MALFORMED")
                usage = frame.get("usage")
                OpenAIAdapter._usage(usage, responses=False)
            else:
                if len(choices) != 1 or type(choices[0]) is not dict or choices[0].get("index") != 0 or stopped:
                    reject("RESPONSE_MALFORMED")
                choice = choices[0]
                delta = choice.get("delta")
                if type(delta) is not dict or delta.get("tool_calls") or delta.get("function_call") or delta.get("refusal"):
                    reject("CONTENT_BLOCKED")
                if delta.get("role") not in (None, "assistant"):
                    reject("RESPONSE_MALFORMED")
                content = delta.get("content")
                if content is not None:
                    if type(content) is not str:
                        reject("RESPONSE_MALFORMED")
                    chunks.append(content)
                finish = choice.get("finish_reason")
                if finish is not None:
                    if finish != "stop":
                        reject("CONTENT_BLOCKED")
                    stopped = True
            if request.is_aborted():
                aborted = True
        if not done or response_id is None or serving_model is None:
            reject("RESPONSE_MALFORMED")
        return response_id, serving_model, chunks, usage, aborted

    @staticmethod
    def _stream_responses(frames: list, request: GatewayRequest) -> tuple[str, str, list[str], object, bool]:
        response_id = serving_model = None
        chunks: list[str] = []
        final = None
        aborted = False
        for pos, frame in enumerate(frames):
            if type(frame) is not dict or type(frame.get("type")) is not str:
                reject("RESPONSE_MALFORMED")
            kind = frame["type"]
            if kind in {"error", "response.failed", "response.incomplete"}:
                reject("STREAM_PROVIDER_ERROR")
            if kind == "response.created":
                body = frame.get("response")
                if response_id is not None or type(body) is not dict:
                    reject("RESPONSE_MALFORMED")
                try:
                    response_id, serving_model = text(body.get("id")), text(body.get("model"))
                except ValueError:
                    reject("RESPONSE_MALFORMED")
                if body.get("status") != "in_progress":
                    reject("RESPONSE_MALFORMED")
            elif kind == "response.in_progress":
                body = frame.get("response")
                if (response_id is None or final is not None or type(body) is not dict
                        or body.get("id") != response_id or body.get("status") != "in_progress"
                        or ("model" in body and body["model"] != serving_model)):
                    reject("RESPONSE_MALFORMED")
            elif kind in {"response.output_item.added", "response.output_item.done"}:
                item = frame.get("item")
                if type(item) is not dict or item.get("type") != "message" or item.get("role") != "assistant":
                    reject("CONTENT_BLOCKED")
                if (response_id is None or final is not None or frame.get("output_index") != 0
                        or item.get("status") not in {"in_progress", "completed"}):
                    reject("RESPONSE_MALFORMED")
                if kind == "response.output_item.done" and item.get("status") != "completed":
                    reject("RESPONSE_MALFORMED")
            elif kind in {"response.content_part.added", "response.content_part.done"}:
                part = frame.get("part")
                if type(part) is not dict or part.get("type") != "output_text" or type(part.get("text")) is not str:
                    reject("CONTENT_BLOCKED")
                if (response_id is None or final is not None or frame.get("output_index") != 0
                        or frame.get("content_index") != 0):
                    reject("RESPONSE_MALFORMED")
                if kind == "response.content_part.done" and part["text"] != "".join(chunks):
                    reject("RESPONSE_MALFORMED")
            elif kind == "response.output_text.delta":
                if (response_id is None or final is not None or frame.get("response_id") != response_id
                        or frame.get("output_index") != 0 or frame.get("content_index") != 0
                        or type(frame.get("delta")) is not str):
                    reject("RESPONSE_MALFORMED")
                chunks.append(frame["delta"])
            elif kind == "response.output_text.done":
                if (response_id is None or final is not None or frame.get("output_index") != 0
                        or frame.get("content_index") != 0 or frame.get("text") != "".join(chunks)):
                    reject("RESPONSE_MALFORMED")
            elif kind == "response.completed":
                if response_id is None or final is not None or pos != len(frames) - 1:
                    reject("RESPONSE_MALFORMED")
                final = frame.get("response")
                ident, model = OpenAIAdapter._identity(final, responses=True)
                if (ident, model) != (response_id, serving_model):
                    reject("RESPONSE_MALFORMED")
                if OpenAIAdapter._responses_text(final) != "".join(chunks):
                    reject("RESPONSE_MALFORMED")
            else:
                # Unknown semantic events may carry refusal, tool or non-text output.
                reject("CONTENT_BLOCKED")
            if request.is_aborted():
                aborted = True
        if final is None:
            reject("RESPONSE_MALFORMED")
        return response_id, serving_model, chunks, final.get("usage"), aborted

    def health(self, *, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve("health", request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            raw = self._send("health", f"{MODELS_URL}/{HEALTH_MODEL}", {}, request_id)
            body = raw.body
            if (type(body) is not dict or raw.authenticated_probe is not True
                    or body.get("object") != "model" or body.get("id") != HEALTH_MODEL):
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            evidence = receipt("HEALTH", request_id, dict(operation="health", request_id=request_id,
                provider=PROVIDER_ID, requested_model=HEALTH_MODEL, resolved_model=HEALTH_MODEL,
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
                responses_only_models=list(RESPONSES_ONLY_MODELS), format=FORMAT, executor=EXECUTOR,
                auth_header=AUTH_HEADER, reasoning_transport=REASONING_TRANSPORT,
                status="STATIC_REGISTRY", credential_health="UNVERIFIED", live_freshness="UNVERIFIED",
                transport_sent=False))
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]
