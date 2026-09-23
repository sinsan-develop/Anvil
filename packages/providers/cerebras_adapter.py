"""CEREBRAS adapter over an injected host transport; this module performs no I/O itself."""
from __future__ import annotations

from threading import RLock
from typing import Protocol, runtime_checkable

from packages.llm_gateway.contracts import (CapabilityProbe, GatewayRequest, GatewayResponse,
                                            TokenUsage, UsageProvenance)

from .cerebras_errors import (CerebrasAdapterError, map_error, reject,
                              reject_credential_headers, reject_credential_material)
from .cerebras_models import (AdapterReceipt, StreamResult, TransportResponse,
                              canonical_text, detached, digest, receipt)


@runtime_checkable
class CerebrasTransport(Protocol):
    def request(self, *, operation: str, payload: dict[str, object], request_id: str,
                stream: bool) -> TransportResponse: ...


class CerebrasAdapter:
    """Fail-closed mapping layer. Credential injection and network I/O stay host-owned."""

    def __init__(self, transport: CerebrasTransport, *, max_retry_after_seconds: int = 86400) -> None:
        if not isinstance(transport, CerebrasTransport):
            raise TypeError("TRANSPORT_REQUIRED")
        if type(max_retry_after_seconds) is not int or not 0 <= max_retry_after_seconds <= 86400:
            raise ValueError("RETRY_AFTER_LIMIT_INVALID")
        self._transport = transport
        self._max_retry_after = max_retry_after_seconds
        self._lock = RLock()
        self._requests: dict[str, tuple[str, object, AdapterReceipt]] = {}

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        if not isinstance(required, (set, frozenset)) or any(type(value) is not str for value in required):
            reject("CAPABILITY_INPUT_INVALID")
        capabilities = frozenset({"text_generation", "streaming", "health", "discovery"})
        missing = tuple(f"missing capability: {name}" for name in sorted(required - capabilities))
        return CapabilityProbe(not missing, capabilities, missing)

    def receipt(self, request_id: str) -> AdapterReceipt:
        canonical_text(request_id, field="request_id", maximum=128)
        with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                reject("RECEIPT_NOT_FOUND")
            return record[2]

    @staticmethod
    def _validate_request(request: GatewayRequest) -> None:
        if not isinstance(request, GatewayRequest):
            reject("REQUEST_INVALID")
        if request.provider not in {"CEREBRAS", "cerebras"}:
            reject("PROVIDER_MISMATCH")

    def _replay(self, operation: str, request_id: str, signature: object) -> object | None:
        fingerprint = digest([operation, signature])
        old = self._requests.get(request_id)
        if old is None:
            return None
        if old[0] != fingerprint:
            reject("REQUEST_ID_CONFLICT")
        return old[1]

    def _save(self, operation: str, request_id: str, signature: object,
              result: object, evidence: AdapterReceipt) -> object:
        fingerprint = digest([operation, signature])
        old = self._requests.get(request_id)
        if old is not None:
            if old[0] != fingerprint:
                reject("REQUEST_ID_CONFLICT")
            return old[1]
        self._requests[request_id] = (fingerprint, result, evidence)
        return result

    def _send(self, *, operation: str, payload: dict[str, object], request_id: str,
              stream: bool) -> TransportResponse:
        try:
            value = self._transport.request(operation=operation, payload=detached(payload),
                                            request_id=request_id, stream=stream)
        except CerebrasAdapterError:
            raise
        except Exception:
            reject("TRANSPORT_FAILURE")
        if not isinstance(value, TransportResponse):
            reject("RESPONSE_MALFORMED")
        reject_credential_headers(value.headers)
        reject_credential_material([value.headers, value.body])
        if not 200 <= value.status_code <= 299:
            map_error(value, max_retry_after=self._max_retry_after)
        return value

    @staticmethod
    def _upstream_id(response: TransportResponse, body: dict[str, object], *, required: bool) -> str | None:
        header = response.header("x-request-id")
        body_id = body.get("id")
        if header is not None:
            try: canonical_text(header, field="upstream_request_id", maximum=256)
            except ValueError: reject("RESPONSE_MALFORMED")
        if body_id is not None:
            try: canonical_text(body_id, field="upstream_request_id", maximum=256)
            except ValueError: reject("RESPONSE_MALFORMED")
        if header is not None and body_id is not None and header != body_id:
            reject("RESPONSE_MALFORMED")
        result = header or body_id
        if required and result is None:
            reject("RESPONSE_MALFORMED")
        return result

    @staticmethod
    def _usage(body: dict[str, object]) -> TokenUsage:
        usage = body.get("usage")
        if type(usage) is not dict or set(usage) != {"prompt_tokens", "completion_tokens"}:
            reject("RESPONSE_MALFORMED")
        first, second = usage["prompt_tokens"], usage["completion_tokens"]
        if type(first) is not int or type(second) is not int or first < 0 or second < 0:
            reject("RESPONSE_MALFORMED")
        return TokenUsage(first, second)

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self._validate_request(request)
        signature = [request.provider, request.model, request.input_text, "generate"]
        with self._lock:
            prior = self._replay("generate", request.request_id, signature)
            if prior is not None:
                return prior  # type: ignore[return-value]
            if request.is_aborted():
                result = GatewayResponse(request.request_id, request.provider, request.model, "",
                    TokenUsage(), UsageProvenance.ABORT_CONFIRMED, "ABORTED")
                evidence = receipt("GENERATE", request.request_id, dict(
                    operation="generate", request_id=request.request_id, upstream_request_id=None,
                    provider=request.provider, model=request.model, output_text="", input_tokens=0,
                    output_tokens=0, usage_provenance="ABORT_CONFIRMED", abort_status="ABORTED",
                    retry_after=None, transport_sent=False))
                return self._save("generate", request.request_id, signature, result, evidence)  # type: ignore[return-value]
            response = self._send(operation="generate", payload={"model": request.model, "input": request.input_text},
                                  request_id=request.request_id, stream=False)
            body = response.body
            if type(body) is not dict or set(body) - {"id", "choices", "usage"}:
                reject("RESPONSE_MALFORMED")
            upstream = self._upstream_id(response, body, required=True)
            choices = body.get("choices")
            if type(choices) is not list or len(choices) != 1 or type(choices[0]) is not dict:
                reject("RESPONSE_MALFORMED")
            message = choices[0].get("message")
            if type(message) is not dict or set(message) != {"content"} or type(message["content"]) is not str or not message["content"]:
                reject("RESPONSE_MALFORMED")
            usage = self._usage(body)
            result = GatewayResponse(request.request_id, request.provider, request.model, message["content"],
                                     usage, UsageProvenance.PROVIDER_FINAL)
            evidence = receipt("GENERATE", request.request_id, dict(
                operation="generate", request_id=request.request_id, upstream_request_id=upstream,
                provider=request.provider, model=request.model, output_text=message["content"],
                input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_provenance="PROVIDER_FINAL", abort_status="COMPLETED",
                retry_after=None, transport_sent=True))
            return self._save("generate", request.request_id, signature, result, evidence)  # type: ignore[return-value]

    def stream(self, request: GatewayRequest) -> StreamResult:
        self._validate_request(request)
        signature = [request.provider, request.model, request.input_text, "stream"]
        with self._lock:
            prior = self._replay("stream", request.request_id, signature)
            if prior is not None:
                return prior  # type: ignore[return-value]
            if request.is_aborted():
                response = GatewayResponse(request.request_id, request.provider, request.model, "",
                    TokenUsage(), UsageProvenance.ABORT_CONFIRMED, "ABORTED")
                evidence = receipt("STREAM", request.request_id, dict(operation="stream", request_id=request.request_id,
                    upstream_request_id=None, provider=request.provider, model=request.model, chunks=[], output_text="",
                    input_tokens=0, output_tokens=0, usage_provenance="ABORT_CONFIRMED", abort_status="ABORTED",
                    retry_after=None, transport_sent=False))
                result = StreamResult((), response, evidence)
                return self._save("stream", request.request_id, signature, result, evidence)  # type: ignore[return-value]
            raw = self._send(operation="stream", payload={"model": request.model, "input": request.input_text},
                             request_id=request.request_id, stream=True)
            if type(raw.body) is not list or not raw.body:
                reject("RESPONSE_MALFORMED")
            chunks: list[str] = []; upstream: str | None = None; usage: TokenUsage | None = None
            finished = False; aborted = False
            for index, frame in enumerate(raw.body):
                if finished or usage is not None:
                    reject("RESPONSE_MALFORMED")
                if type(frame) is not dict or set(frame) - {"id", "choices", "usage"}:
                    reject("RESPONSE_MALFORMED")
                current = self._upstream_id(raw, frame, required=True)
                if upstream is not None and current != upstream:
                    reject("RESPONSE_MALFORMED")
                upstream = current
                choices = frame.get("choices")
                if type(choices) is not list or len(choices) != 1 or type(choices[0]) is not dict:
                    reject("RESPONSE_MALFORMED")
                choice = choices[0]
                if set(choice) - {"delta", "finish_reason"} or type(choice.get("delta")) is not dict:
                    reject("RESPONSE_MALFORMED")
                delta = choice["delta"]
                if set(delta) - {"content"} or "content" in delta and (type(delta["content"]) is not str or not delta["content"]):
                    reject("RESPONSE_MALFORMED")
                if "content" in delta and not aborted:
                    chunks.append(delta["content"])
                if choice.get("finish_reason") is not None:
                    if choice["finish_reason"] != "stop" or finished:
                        reject("RESPONSE_MALFORMED")
                    finished = True
                if "usage" in frame:
                    if usage is not None: reject("RESPONSE_MALFORMED")
                    usage = self._usage(frame)
                if finished != (usage is not None) or finished and index != len(raw.body) - 1:
                    reject("RESPONSE_MALFORMED")
                if request.is_aborted():
                    aborted = True
            if not finished or usage is None:
                reject("RESPONSE_MALFORMED")
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if aborted else "COMPLETED"
            output = "".join(chunks)
            if not output and not aborted:
                reject("RESPONSE_MALFORMED")
            response = GatewayResponse(request.request_id, request.provider, request.model, output, usage,
                                       UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("STREAM", request.request_id, dict(operation="stream", request_id=request.request_id,
                upstream_request_id=upstream, provider=request.provider, model=request.model, chunks=chunks,
                output_text=output, input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_provenance="PROVIDER_FINAL", abort_status=status, retry_after=None, transport_sent=True))
            result = StreamResult(tuple(chunks), response, evidence)
            return self._save("stream", request.request_id, signature, result, evidence)  # type: ignore[return-value]

    def health(self, *, request_id: str) -> AdapterReceipt:
        return self._simple("health", request_id)

    def discover(self, *, request_id: str) -> AdapterReceipt:
        return self._simple("discovery", request_id)

    def _simple(self, operation: str, request_id: str) -> AdapterReceipt:
        canonical_text(request_id, field="request_id", maximum=128)
        signature = [operation]
        with self._lock:
            prior = self._replay(operation, request_id, signature)
            if prior is not None:
                return prior  # type: ignore[return-value]
            response = self._send(operation=operation, payload={}, request_id=request_id, stream=False)
            body = response.body
            if type(body) is not dict:
                reject("RESPONSE_MALFORMED")
            upstream = self._upstream_id(response, body, required=False)
            if operation == "health":
                if body != {"status": "ok"}:
                    reject("RESPONSE_MALFORMED")
                payload = dict(operation=operation, request_id=request_id, upstream_request_id=upstream,
                               provider="cerebras", status="AVAILABLE", transport_sent=True)
            else:
                if set(body) != {"data"} or type(body["data"]) is not list:
                    reject("RESPONSE_MALFORMED")
                models: list[str] = []
                for row in body["data"]:
                    if type(row) is not dict or set(row) != {"id"}:
                        reject("RESPONSE_MALFORMED")
                    try: models.append(canonical_text(row["id"], field="model_id", maximum=256))
                    except ValueError: reject("RESPONSE_MALFORMED")
                if not models or len(models) != len(set(models)):
                    reject("RESPONSE_MALFORMED")
                payload = dict(operation=operation, request_id=request_id, upstream_request_id=upstream,
                               provider="cerebras", models=sorted(models), transport_sent=True)
            evidence = receipt(operation.upper(), request_id, payload)
            return self._save(operation, request_id, signature, evidence, evidence)  # type: ignore[return-value]
