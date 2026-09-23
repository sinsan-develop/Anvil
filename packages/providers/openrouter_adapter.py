"""OpenRouter wire mapping over a host-owned injected transport; no network or key I/O."""
from __future__ import annotations

from decimal import Decimal
from threading import RLock
from typing import Protocol, runtime_checkable

from packages.llm_gateway.contracts import CapabilityProbe, GatewayRequest, GatewayResponse, TokenUsage, UsageProvenance

from .openrouter_errors import OpenRouterAdapterError, guard_headers, guard_material, map_error, reject
from .openrouter_models import AdapterReceipt, StreamResult, TransportResponse, detached, digest, receipt, text, usd


@runtime_checkable
class OpenRouterTransport(Protocol):
    def request(self, *, operation: str, payload: dict[str, object], request_id: str,
                stream: bool) -> TransportResponse: ...


class OpenRouterAdapter:
    def __init__(self, transport: OpenRouterTransport, *, max_retry_after_seconds: int = 86400) -> None:
        if not isinstance(transport, OpenRouterTransport):
            raise TypeError("TRANSPORT_REQUIRED")
        if type(max_retry_after_seconds) is not int or not 0 <= max_retry_after_seconds <= 86400:
            raise ValueError("RETRY_AFTER_LIMIT_INVALID")
        self._transport = transport
        self._max_retry_after = max_retry_after_seconds
        self._lock = RLock()
        self._bound: dict[str, str] = {}
        self._done: dict[str, tuple[object, AdapterReceipt]] = {}

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        if not isinstance(required, (set, frozenset)) or any(type(item) is not str for item in required):
            reject("CAPABILITY_INPUT_INVALID")
        supported = frozenset({"text_generation", "streaming", "health", "discovery"})
        missing = tuple(f"missing capability: {item}" for item in sorted(required - supported))
        return CapabilityProbe(not missing, supported, missing)

    def receipt(self, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            if request_id not in self._done:
                reject("RECEIPT_NOT_FOUND")
            return self._done[request_id][1]

    @staticmethod
    def _request_id(value: str) -> None:
        try:
            text(value, maximum=128)
        except ValueError:
            reject("REQUEST_ID_INVALID")

    @staticmethod
    def _validate(request: GatewayRequest) -> None:
        if not isinstance(request, GatewayRequest):
            reject("REQUEST_INVALID")
        if request.provider != "openrouter":
            reject("PROVIDER_MISMATCH")
        OpenRouterAdapter._request_id(request.request_id)

    def _reserve(self, operation: str, request_id: str, signature: object) -> object | None:
        fingerprint = digest([operation, signature])
        previous = self._bound.get(request_id)
        if previous is not None and previous != fingerprint:
            reject("REQUEST_ID_CONFLICT")
        self._bound[request_id] = fingerprint
        result = self._done.get(request_id)
        return result[0] if result is not None else None

    def _save(self, request_id: str, result: object, evidence: AdapterReceipt) -> object:
        self._done[request_id] = (result, evidence)
        return result

    def _send(self, operation: str, payload: dict[str, object], request_id: str,
              *, stream: bool = False) -> TransportResponse:
        try:
            result = self._transport.request(operation=operation, payload=detached(payload),
                                             request_id=request_id, stream=stream)
        except OpenRouterAdapterError:
            raise
        except Exception:
            reject("TRANSPORT_FAILURE")
        if not isinstance(result, TransportResponse):
            reject("RESPONSE_MALFORMED")
        guard_headers(result.headers)
        guard_material([result.headers, result.body])
        if not 200 <= result.status_code <= 299:
            map_error(result.status_code, result.body, retry_after=result.header("retry-after"),
                      maximum=self._max_retry_after, model_operation=operation in {"generate", "stream"})
        return result

    @staticmethod
    def _usage(body: dict) -> tuple[TokenUsage, str | None]:
        value = body.get("usage")
        if type(value) is not dict or not {"prompt_tokens", "completion_tokens", "total_tokens"} <= value.keys():
            reject("RESPONSE_MALFORMED")
        first, last, total = (value[name] for name in ("prompt_tokens", "completion_tokens", "total_tokens"))
        if any(type(item) is not int or item < 0 for item in (first, last, total)) or total != first + last:
            reject("RESPONSE_MALFORMED")
        cost = value.get("cost")
        if cost is not None:
            try:
                cost = usd(cost)
            except ValueError:
                reject("RESPONSE_MALFORMED")
        return TokenUsage(first, last), cost

    @staticmethod
    def _lineage(body: dict, requested_model: str, *, stream: bool = False) -> dict[str, object]:
        try:
            generation_id = text(body.get("id"))
            served = text(body.get("model"))
        except ValueError:
            reject("RESPONSE_MALFORMED")
        result: dict[str, object] = dict(requested_model=requested_model, served_model=served,
                                         generation_id=generation_id, upstream_provider="UNVERIFIED",
                                         upstream_model=None, upstream_id=None, routing_source="UNVERIFIED",
                                         billed_cost_usd=None, billed_cost_source="UNVERIFIED")
        generation = body.get("generation")
        if generation is not None:
            if type(generation) is not dict:
                reject("RESPONSE_MALFORMED")
            for key, target in (("provider_name", "upstream_provider"), ("model", "upstream_model"),
                                ("upstream_id", "upstream_id")):
                if key in generation:
                    try:
                        result[target] = text(generation[key])
                    except ValueError:
                        reject("RESPONSE_MALFORMED")
            if result["upstream_provider"] != "UNVERIFIED":
                result["routing_source"] = "generation"
            if "total_cost" in generation:
                try:
                    result["billed_cost_usd"] = usd(generation["total_cost"])
                except ValueError:
                    reject("RESPONSE_MALFORMED")
                result["billed_cost_source"] = "generation.total_cost"
        routing = body.get("openrouter_metadata")
        if routing is not None:
            if type(routing) is not dict or type(routing.get("endpoints")) is not dict:
                reject("RESPONSE_MALFORMED")
            available = routing["endpoints"].get("available")
            if type(available) is not list:
                reject("RESPONSE_MALFORMED")
            selected = [item for item in available if type(item) is dict and item.get("selected") is True]
            if len(selected) > 1:
                reject("RESPONSE_MALFORMED")
            if selected:
                try:
                    provider = text(selected[0]["provider"])
                    model = text(selected[0]["model"])
                except (ValueError, KeyError):
                    reject("RESPONSE_MALFORMED")
                if (result["upstream_provider"] not in {"UNVERIFIED", provider}
                        or result["upstream_model"] not in {None, model}):
                    reject("ROUTING_METADATA_CONFLICT")
                if result["upstream_provider"] == "UNVERIFIED":
                    result["upstream_provider"] = provider
                    result["routing_source"] = "openrouter_metadata"
                if result["upstream_model"] is None:
                    result["upstream_model"] = model
        return result

    @staticmethod
    def _payload(request: GatewayRequest, *, stream: bool) -> dict[str, object]:
        value: dict[str, object] = {"model": request.model, "messages": [{"role": "user", "content": request.input_text}]}
        if stream:
            value["stream_options"] = {"include_usage": True}
        return value

    def _aborted(self, request: GatewayRequest, operation: str) -> tuple[GatewayResponse, AdapterReceipt]:
        result = GatewayResponse(request.request_id, "openrouter", request.model, "", TokenUsage(),
                                 UsageProvenance.ABORT_CONFIRMED, "ABORTED")
        evidence = receipt(operation.upper(), request.request_id, dict(operation=operation,
            request_id=request.request_id, requested_model=request.model, served_model=None,
            generation_id=None, upstream_provider="UNVERIFIED", upstream_model=None, upstream_id=None,
            routing_source="UNVERIFIED", billed_cost_usd=None, billed_cost_source="UNVERIFIED",
            input_tokens=0, output_tokens=0, usage_provenance="ABORT_CONFIRMED",
            abort_status="ABORTED", transport_sent=False))
        return result, evidence

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self._validate(request)
        with self._lock:
            old = self._reserve("generate", request.request_id, [request.provider, request.model, request.input_text])
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                result, evidence = self._aborted(request, "generate")
                return self._save(request.request_id, result, evidence)  # type: ignore[return-value]
            response = self._send("generate", self._payload(request, stream=False), request.request_id)
            body = response.body
            if type(body) is dict and type(body.get("error")) is dict:
                code = body["error"].get("code")
                if type(code) is int and 100 <= code <= 599:
                    map_error(code, body)
                reject("PROVIDER_ERROR_UNMAPPED")
            if type(body) is not dict or body.get("object") != "chat.completion":
                reject("RESPONSE_MALFORMED")
            lineage = self._lineage(body, request.model)
            choices = body.get("choices")
            if type(choices) is not list or len(choices) != 1 or type(choices[0]) is not dict:
                reject("RESPONSE_MALFORMED")
            choice = choices[0]
            message = choice.get("message")
            if (choice.get("index") != 0 or choice.get("finish_reason") != "stop" or type(message) is not dict
                    or message.get("role") != "assistant" or type(message.get("content")) is not str
                    or not message["content"]):
                reject("RESPONSE_MALFORMED")
            usage, usage_cost = self._usage(body)
            if usage_cost is not None:
                if lineage["billed_cost_usd"] is not None and Decimal(lineage["billed_cost_usd"]) != Decimal(usage_cost):
                    reject("BILLED_COST_CONFLICT")
                lineage["billed_cost_usd"] = usage_cost
                lineage["billed_cost_source"] = "usage.cost"
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if request.is_aborted() else "COMPLETED"
            result = GatewayResponse(request.request_id, "openrouter", request.model, message["content"],
                                     usage, UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("GENERATE", request.request_id, dict(operation="generate", request_id=request.request_id,
                **lineage, output_text=message["content"], input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens, usage_provenance="PROVIDER_FINAL", abort_status=status,
                transport_sent=True))
            return self._save(request.request_id, result, evidence)  # type: ignore[return-value]

    def stream(self, request: GatewayRequest) -> StreamResult:
        self._validate(request)
        with self._lock:
            old = self._reserve("stream", request.request_id, [request.provider, request.model, request.input_text])
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
            lineage = None
            usage = None
            usage_cost = None
            finished = False
            aborted = False
            role_seen = False
            for index, frame in enumerate(raw.body):
                if type(frame) is not dict or usage is not None:
                    reject("RESPONSE_MALFORMED")
                if frame.get("error") is not None:
                    error = frame["error"]
                    code = error.get("code") if type(error) is dict else None
                    map_error(code if type(code) is int and 100 <= code <= 599 else 500,
                              {"error": error})
                if frame.get("object") != "chat.completion.chunk":
                    reject("RESPONSE_MALFORMED")
                current = self._lineage(frame, request.model, stream=True)
                if lineage is None:
                    lineage = current
                else:
                    if (current["generation_id"] != lineage["generation_id"] or
                            current["served_model"] != lineage["served_model"]):
                        reject("RESPONSE_MALFORMED")
                    for key in ("upstream_provider", "upstream_model", "upstream_id"):
                        new = current[key]
                        old = lineage[key]
                        absent = "UNVERIFIED" if key == "upstream_provider" else None
                        if new != absent:
                            if old != absent and old != new:
                                reject("ROUTING_METADATA_CONFLICT")
                            lineage[key] = new
                            lineage["routing_source"] = current["routing_source"]
                    new_cost = current["billed_cost_usd"]
                    if new_cost is not None:
                        old_cost = lineage["billed_cost_usd"]
                        if old_cost is not None and Decimal(old_cost) != Decimal(new_cost):
                            reject("BILLED_COST_CONFLICT")
                        lineage["billed_cost_usd"] = new_cost
                        lineage["billed_cost_source"] = current["billed_cost_source"]
                choices = frame.get("choices")
                if type(choices) is not list or len(choices) not in {0, 1}:
                    reject("RESPONSE_MALFORMED")
                if not choices:
                    if not finished or index != len(raw.body)-1:
                        reject("RESPONSE_MALFORMED")
                    usage, usage_cost = self._usage(frame)
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
                        usage, usage_cost = self._usage(frame)
                if request.is_aborted():
                    aborted = True
            if not finished or usage is None or lineage is None or not chunks and not aborted:
                reject("RESPONSE_MALFORMED")
            if usage_cost is not None:
                if lineage["billed_cost_usd"] is not None and Decimal(lineage["billed_cost_usd"]) != Decimal(usage_cost):
                    reject("BILLED_COST_CONFLICT")
                lineage["billed_cost_usd"] = usage_cost
                lineage["billed_cost_source"] = "usage.cost"
            status = ("ABORT_REQUESTED_UPSTREAM_COMPLETED" if chunks else "ABORTED") if aborted else "COMPLETED"
            output = "".join(chunks)
            response = GatewayResponse(request.request_id, "openrouter", request.model, output, usage,
                                       UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("STREAM", request.request_id, dict(operation="stream", request_id=request.request_id,
                **lineage, chunks=chunks, output_text=output, input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens, usage_provenance="PROVIDER_FINAL", abort_status=status,
                transport_sent=True))
            result = StreamResult(tuple(chunks), response, evidence)
            return self._save(request.request_id, result, evidence)  # type: ignore[return-value]

    def health(self, *, request_id: str) -> AdapterReceipt:
        return self._simple("health", request_id)

    def discover(self, *, request_id: str) -> AdapterReceipt:
        return self._simple("discovery", request_id)

    def _simple(self, operation: str, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            old = self._reserve(operation, request_id, [])
            if old is not None:
                return old  # type: ignore[return-value]
            raw = self._send(operation, {}, request_id)
            body = raw.body
            if type(body) is not dict:
                reject("RESPONSE_MALFORMED")
            if operation == "health":
                data = body.get("data")
                if type(data) is not dict or type(data.get("is_free_tier")) is not bool:
                    reject("RESPONSE_MALFORMED")
                for key in ("limit", "limit_remaining"):
                    if key in data and data[key] is not None:
                        try:
                            usd(data[key])
                        except ValueError:
                            reject("RESPONSE_MALFORMED")
                payload = dict(operation=operation, request_id=request_id, provider="openrouter",
                               status="AVAILABLE", credential_health="VERIFIED", transport_sent=True)
            else:
                rows = body.get("data")
                if type(rows) is not list or not rows:
                    reject("RESPONSE_MALFORMED")
                models = []
                for row in rows:
                    if type(row) is not dict:
                        reject("RESPONSE_MALFORMED")
                    try:
                        model = text(row.get("id"))
                    except ValueError:
                        reject("RESPONSE_MALFORMED")
                    quoted = dict(id=model, quoted_prompt_usd_per_token=None,
                                  quoted_completion_usd_per_token=None)
                    if "pricing" in row:
                        pricing = row["pricing"]
                        if type(pricing) is not dict:
                            reject("RESPONSE_MALFORMED")
                        for name, target in (("prompt", "quoted_prompt_usd_per_token"),
                                             ("completion", "quoted_completion_usd_per_token")):
                            if name in pricing:
                                if type(pricing[name]) is not str:
                                    reject("RESPONSE_MALFORMED")
                                try:
                                    quoted[target] = usd(pricing[name])
                                except ValueError:
                                    reject("RESPONSE_MALFORMED")
                    models.append(quoted)
                if len({model["id"] for model in models}) != len(models):
                    reject("RESPONSE_MALFORMED")
                payload = dict(operation=operation, request_id=request_id, provider="openrouter",
                               models=sorted(models, key=lambda item: item["id"]),
                               credential_health="UNVERIFIED", transport_sent=True)
            evidence = receipt(operation.upper(), request_id, payload)
            return self._save(request_id, evidence, evidence)  # type: ignore[return-value]
