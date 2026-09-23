"""MISTRAL adapter over an injected host transport; this module performs no I/O itself."""
from __future__ import annotations

from threading import RLock
from typing import Protocol, runtime_checkable

from packages.llm_gateway.contracts import (CapabilityProbe, GatewayRequest, GatewayResponse,
                                            TokenUsage, UsageProvenance)

from .mistral_errors import (MistralAdapterError, map_error, reject,
                          reject_credential_headers, reject_credential_material)
from .mistral_models import (AdapterReceipt, StreamResult, TransportResponse,
                          canonical_text, detached, digest, receipt)


@runtime_checkable
class MistralTransport(Protocol):
    def request(self, *, operation: str, payload: dict[str, object], request_id: str,
                stream: bool) -> TransportResponse: ...


class MistralAdapter:
    """Fail-closed mapping layer. Credential injection and network I/O stay host-owned."""

    def __init__(self, transport: MistralTransport, *, max_retry_after_seconds: int = 86400) -> None:
        if not isinstance(transport, MistralTransport):
            raise TypeError("TRANSPORT_REQUIRED")
        if type(max_retry_after_seconds) is not int or not 0 <= max_retry_after_seconds <= 86400:
            raise ValueError("RETRY_AFTER_LIMIT_INVALID")
        self._transport = transport
        self._max_retry_after = max_retry_after_seconds
        self._lock = RLock()
        self._request_signatures: dict[str, str] = {}
        self._requests: dict[str, tuple[str, object, AdapterReceipt]] = {}

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        if not isinstance(required, (set, frozenset)) or any(type(value) is not str for value in required):
            reject("CAPABILITY_INPUT_INVALID")
        capabilities = frozenset({"text_generation", "streaming", "health", "discovery"})
        missing = tuple(f"missing capability: {name}" for name in sorted(required - capabilities))
        return CapabilityProbe(not missing, capabilities, missing)

    def receipt(self, request_id: str) -> AdapterReceipt:
        self._validate_request_id(request_id)
        with self._lock:
            record = self._requests.get(request_id)
            if record is None:
                reject("RECEIPT_NOT_FOUND")
            return record[2]

    @staticmethod
    def _validate_request_id(request_id: str) -> None:
        try:
            canonical_text(request_id, field="request_id", maximum=128)
        except ValueError:
            reject("REQUEST_ID_INVALID")

    @staticmethod
    def _validate_request(request: GatewayRequest) -> None:
        if not isinstance(request, GatewayRequest):
            reject("REQUEST_INVALID")
        if request.provider != "mistral":
            reject("PROVIDER_MISMATCH")
        MistralAdapter._validate_request_id(request.request_id)

    def _replay(self, operation: str, request_id: str, signature: object) -> object | None:
        fingerprint = digest([operation, signature])
        bound = self._request_signatures.get(request_id)
        if bound is not None and bound != fingerprint:
            reject("REQUEST_ID_CONFLICT")
        self._request_signatures[request_id] = fingerprint
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
        except MistralAdapterError:
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
            try:
                canonical_text(header, field="upstream_request_id", maximum=256)
            except ValueError:
                reject("RESPONSE_MALFORMED")
        if body_id is not None:
            try:
                canonical_text(body_id, field="upstream_request_id", maximum=256)
            except ValueError:
                reject("RESPONSE_MALFORMED")
        result = header or body_id
        if required and result is None:
            reject("RESPONSE_MALFORMED")
        return result

    @staticmethod
    def _usage(body: dict[str, object]) -> TokenUsage:
        usage = body.get("usage")
        required = {"prompt_tokens", "completion_tokens", "total_tokens"}
        if type(usage) is not dict or not required <= set(usage):
            reject("RESPONSE_MALFORMED")
        first, second, total = usage["prompt_tokens"], usage["completion_tokens"], usage["total_tokens"]
        if (type(first) is not int or type(second) is not int or type(total) is not int
                or first < 0 or second < 0 or total != first + second):
            reject("RESPONSE_MALFORMED")
        return TokenUsage(first, second)

    @staticmethod
    def _request_payload(request: GatewayRequest, *, stream: bool = False) -> dict[str, object]:
        payload: dict[str, object] = {
            "model": request.model,
            "messages": [{"role": "user", "content": request.input_text}],
        }
        if stream:
            payload["stream_options"] = {"include_usage": True}
        return payload

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
            response = self._send(operation="generate", payload=self._request_payload(request),
                                  request_id=request.request_id, stream=False)
            body = response.body
            required = {"id", "object", "choices", "usage"}
            if type(body) is not dict or not required <= set(body):
                reject("RESPONSE_MALFORMED")
            if body["object"] != "chat.completion":
                reject("RESPONSE_MALFORMED")
            upstream = self._upstream_id(response, body, required=True)
            choices = body.get("choices")
            if type(choices) is not list or len(choices) != 1 or type(choices[0]) is not dict:
                reject("RESPONSE_MALFORMED")
            choice = choices[0]
            required_choice = {"index", "message", "finish_reason"}
            if not required_choice <= set(choice) or choice["index"] != 0 or choice["finish_reason"] != "stop":
                reject("RESPONSE_MALFORMED")
            message = choice["message"]
            if (type(message) is not dict or not {"role", "content"} <= set(message)
                    or message["role"] != "assistant" or type(message["content"]) is not str
                    or not message["content"]):
                reject("RESPONSE_MALFORMED")
            usage = self._usage(body)
            status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if request.is_aborted() else "COMPLETED"
            result = GatewayResponse(request.request_id, request.provider, request.model, message["content"],
                                     usage, UsageProvenance.PROVIDER_FINAL, status)
            evidence = receipt("GENERATE", request.request_id, dict(
                operation="generate", request_id=request.request_id, upstream_request_id=upstream,
                provider=request.provider, model=request.model, output_text=message["content"],
                input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
                usage_provenance="PROVIDER_FINAL", abort_status=status,
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
            raw = self._send(operation="stream", payload=self._request_payload(request, stream=True),
                             request_id=request.request_id, stream=True)
            if type(raw.body) is not list or not raw.body:
                reject("RESPONSE_MALFORMED")
            chunks: list[str] = []
            upstream: str | None = None
            completion_id: str | None = None
            usage: TokenUsage | None = None
            finish_seen = False
            role_seen = False
            aborted = False
            for index, frame in enumerate(raw.body):
                if usage is not None:
                    reject("RESPONSE_MALFORMED")
                required_frame = {"id", "object", "choices"}
                if type(frame) is not dict or not required_frame <= set(frame):
                    reject("RESPONSE_MALFORMED")
                if frame.get("object") != "chat.completion.chunk":
                    reject("RESPONSE_MALFORMED")
                current = self._upstream_id(raw, frame, required=True)
                if completion_id is not None and frame["id"] != completion_id:
                    reject("RESPONSE_MALFORMED")
                completion_id = frame["id"]
                if upstream is not None and current != upstream:
                    reject("RESPONSE_MALFORMED")
                upstream = current
                choices = frame.get("choices")
                if type(choices) is not list or len(choices) not in {0, 1}:
                    reject("RESPONSE_MALFORMED")
                if not choices:
                    if (not finish_seen or frame.get("usage") is None
                            or index != len(raw.body) - 1):
                        reject("RESPONSE_MALFORMED")
                    usage = self._usage(frame)
                    if request.is_aborted():
                        aborted = True
                    continue
                if finish_seen or type(choices[0]) is not dict:
                    reject("RESPONSE_MALFORMED")
                choice = choices[0]
                required_choice = {"index", "delta", "finish_reason"}
                if (not required_choice <= set(choice) or choice["index"] != 0
                        or type(choice["delta"]) is not dict):
                    reject("RESPONSE_MALFORMED")
                delta = choice["delta"]
                if set(delta) - {"role", "content"}:
                    reject("RESPONSE_MALFORMED")
                if "role" in delta:
                    if delta["role"] != "assistant" or role_seen or chunks:
                        reject("RESPONSE_MALFORMED")
                    role_seen = True
                if "content" in delta:
                    content = delta["content"]
                    if type(content) is not str or not content and "role" not in delta:
                        reject("RESPONSE_MALFORMED")
                    if content:
                        chunks.append(content)
                if choice["finish_reason"] is not None:
                    if choice["finish_reason"] != "stop":
                        reject("RESPONSE_MALFORMED")
                    finish_seen = True
                if frame.get("usage") is not None:
                    if not finish_seen:
                        reject("RESPONSE_MALFORMED")
                    usage = self._usage(frame)
                if usage is not None and index != len(raw.body) - 1:
                    reject("RESPONSE_MALFORMED")
                if request.is_aborted():
                    aborted = True
            if not finish_seen or usage is None:
                reject("RESPONSE_MALFORMED")
            output = "".join(chunks)
            if not output and not aborted:
                reject("RESPONSE_MALFORMED")
            status = ("ABORTED" if not output else "ABORT_REQUESTED_UPSTREAM_COMPLETED") if aborted else "COMPLETED"
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
        self._validate_request_id(request_id)
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
                               provider="mistral", status="AVAILABLE", transport_sent=True)
            else:
                if "object" in body and body["object"] != "list":
                    reject("RESPONSE_MALFORMED")
                if ("data" in body) == ("models" in body):
                    reject("RESPONSE_MALFORMED")
                rows = body.get("data", body.get("models"))
                if type(rows) is not list:
                    reject("RESPONSE_MALFORMED")
                models: list[str] = []
                for row in rows:
                    if (type(row) is not dict or not {"id", "object"} <= set(row)
                            or row["object"] != "model"):
                        reject("RESPONSE_MALFORMED")
                    try:
                        models.append(canonical_text(row["id"], field="model_id", maximum=256))
                    except ValueError:
                        reject("RESPONSE_MALFORMED")
                if not models or len(models) != len(set(models)):
                    reject("RESPONSE_MALFORMED")
                payload = dict(operation=operation, request_id=request_id, upstream_request_id=upstream,
                               provider="mistral", models=sorted(models), transport_sent=True)
            evidence = receipt(operation.upper(), request_id, payload)
            return self._save(operation, request_id, signature, evidence, evidence)  # type: ignore[return-value]
