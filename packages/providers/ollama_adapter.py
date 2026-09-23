"""Ollama native adapter over a host-injected, peer-verified transport.

Host contract: connect opens a socket only; request cannot send until this
adapter has compared connection.peer_ip with the pinned DNS permit. The host
must disable redirects and proxies and use that same connection. F-12 verifies
the host's real socket implementation and egress behavior.
"""
from __future__ import annotations

import json
from threading import RLock
from typing import Protocol

from packages.llm_gateway.contracts import CapabilityProbe, GatewayRequest, GatewayResponse, TokenUsage, UsageProvenance

from .ollama_endpoint import EndpointPolicy, Resolver, canonical_ip
from .ollama_errors import OllamaAdapterError, guard_material, map_status, reject
from .ollama_models import AdapterReceipt, ProbeResult, StreamResult, TransportResponse, canonical, detached, digest, receipt, text

PROVIDER_ID = "ollama"


class ConnectedPeer(Protocol):
    peer_ip: str

    def request(self, *, method: str, path: str, payload: dict[str, object] | None,
                request_id: str, stream: bool, allow_redirects: bool, use_proxy: bool) -> TransportResponse: ...

    def close(self) -> None: ...


class OllamaTransport(Protocol):
    def connect(self, *, scheme: str, host: str, port: int, pinned_ip: str,
                allow_proxy: bool) -> ConnectedPeer: ...


class OllamaAdapter:
    def __init__(self, endpoint: str, policy: EndpointPolicy, resolver: Resolver,
                 transport: OllamaTransport) -> None:
        if not isinstance(policy, EndpointPolicy) or resolver is None or transport is None:
            raise TypeError("HOST_DEPENDENCIES_REQUIRED")
        # Syntax and host allowlist are checked now; DNS is deliberately fresh on every request.
        from .ollama_endpoint import _origin
        _origin(endpoint)
        self._endpoint = endpoint
        self.policy = policy
        self._resolver = resolver
        self._transport = transport
        self._lock = RLock()
        self._bound: dict[str, str] = {}
        self._done: dict[str, tuple[object, AdapterReceipt]] = {}
        self._stream_verified_models: set[str] = set()

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        if not isinstance(required, (set, frozenset)) or any(type(x) is not str for x in required):
            reject("CAPABILITY_INPUT_INVALID")
        supported = frozenset({"text_generation", "streaming", "health", "discovery"})
        missing = tuple(f"missing capability: {x}" for x in sorted(required - supported))
        return CapabilityProbe(not missing, supported, missing)

    @staticmethod
    def _request_id(value: str) -> None:
        try:
            text(value, 128)
        except ValueError:
            reject("REQUEST_ID_INVALID")

    @classmethod
    def _validate(cls, request: GatewayRequest) -> None:
        if not isinstance(request, GatewayRequest):
            reject("REQUEST_INVALID")
        if request.provider != PROVIDER_ID:
            reject("PROVIDER_MISMATCH")
        cls._request_id(request.request_id)
        try:
            text(request.model, 256)
        except ValueError:
            reject("MODEL_INVALID")

    def _reserve(self, operation: str, request: GatewayRequest) -> object | None:
        fingerprint = digest([operation, request.provider, request.model, request.input_text])
        existing = self._bound.get(request.request_id)
        if existing is not None and existing != fingerprint:
            reject("REQUEST_ID_CONFLICT")
        self._bound[request.request_id] = fingerprint
        done = self._done.get(request.request_id)
        return done[0] if done else None

    def _save(self, request_id: str, value: object, evidence: AdapterReceipt) -> object:
        self._done[request_id] = (value, evidence)
        return value

    def receipt(self, request_id: str) -> AdapterReceipt:
        self._request_id(request_id)
        with self._lock:
            if request_id not in self._done:
                reject("RECEIPT_NOT_FOUND")
            return self._done[request_id][1]

    def _send(self, method: str, path: str, payload: dict[str, object] | None,
              request_id: str, *, stream: bool = False) -> TransportResponse:
        # No user-controlled path or absolute URL reaches the transport.
        if path not in {"/api/chat", "/api/version", "/api/tags", "/api/ps"}:
            reject("PATH_NOT_ALLOWED")
        target = self.policy.authorize(self._endpoint, self._resolver)
        try:
            connection = self._transport.connect(scheme=target.scheme, host=target.host,
                port=target.port, pinned_ip=target.pinned_ip, allow_proxy=False)
        except Exception:
            raise OllamaAdapterError("TRANSPORT_CONNECT_FAILURE", retryable=True) from None
        try:
            try:
                peer = canonical_ip(connection.peer_ip)
            except Exception:
                reject("ENDPOINT_PEER_MISMATCH")
            if peer != target.pinned_ip:
                reject("ENDPOINT_PEER_MISMATCH")
            try:
                response = connection.request(method=method, path=path, payload=detached(payload),
                    request_id=request_id, stream=stream, allow_redirects=False, use_proxy=False)
            except Exception:
                raise OllamaAdapterError("TRANSPORT_FAILURE", retryable=True) from None
            if not isinstance(response, TransportResponse):
                reject("RESPONSE_MALFORMED")
            guard_material([list(response.headers), response.body])
            if not 200 <= response.status_code <= 299:
                map_status(response.status_code)
            return response
        finally:
            try:
                connection.close()
            except Exception:
                pass

    @staticmethod
    def _usage(body: dict) -> TokenUsage:
        a, b = body.get("prompt_eval_count"), body.get("eval_count")
        if any(type(value) is not int or value < 0 for value in (a, b)):
            reject("USAGE_MISSING")
        return TokenUsage(a, b)

    @staticmethod
    def _message(frame: dict, *, final: bool) -> str:
        if frame.get("done") is not final:
            reject("RESPONSE_INCOMPLETE")
        if final and frame.get("done_reason") not in (None, "stop"):
            reject("CONTENT_BLOCKED")
        if any(frame.get(key) is not None for key in ("error", "tool_calls", "images", "thinking")):
            reject("CONTENT_BLOCKED")
        # Ollama's native NDJSON terminal record may contain only done/usage.
        # A present message is allowed only when its assistant text is empty.
        if final and "message" not in frame:
            return ""
        message = frame.get("message")
        if (type(message) is not dict or message.get("role") != "assistant"
                or type(message.get("content")) is not str
                or any(message.get(key) is not None for key in ("tool_calls", "images", "thinking"))):
            reject("CONTENT_BLOCKED")
        return message["content"]

    @staticmethod
    def _output(value: str) -> None:
        guard_material(value)
        if not value or value != value.strip():
            reject("OUTPUT_TEXT_NON_CANONICAL")

    @staticmethod
    def _frames(body: object) -> list[dict]:
        if type(body) is not str or not body.endswith("\n"):
            reject("STREAM_MALFORMED")
        lines = body.splitlines()
        if not lines or any(not line for line in lines):
            reject("STREAM_MALFORMED")
        frames = []
        for line in lines:
            try:
                frame = json.loads(line)
            except (ValueError, TypeError):
                reject("STREAM_MALFORMED")
            if type(frame) is not dict:
                reject("STREAM_MALFORMED")
            frames.append(frame)
        return frames

    def _finish(self, request: GatewayRequest, operation: str, output: str,
                usage: TokenUsage, *, chunks: tuple[str, ...] | None = None) -> tuple[GatewayResponse, AdapterReceipt]:
        self._output(output)
        status = "ABORT_REQUESTED_UPSTREAM_COMPLETED" if request.is_aborted() else "COMPLETED"
        result = GatewayResponse(request.request_id, PROVIDER_ID, request.model, output, usage,
                                 UsageProvenance.PROVIDER_FINAL, status)
        data = dict(operation=operation, request_id=request.request_id, provider=PROVIDER_ID,
                    requested_model=request.model, output_text=output, input_tokens=usage.input_tokens,
                    output_tokens=usage.output_tokens, usage_provenance="PROVIDER_FINAL",
                    abort_status=status, transport_sent=True)
        if chunks is not None:
            data["chunks"] = list(chunks)
        return result, receipt(operation.upper(), request.request_id, data)

    @staticmethod
    def _aborted(request: GatewayRequest, operation: str) -> tuple[GatewayResponse, AdapterReceipt]:
        value = GatewayResponse(request.request_id, PROVIDER_ID, request.model, "", TokenUsage(),
                                UsageProvenance.ABORT_CONFIRMED, "ABORTED")
        evidence = receipt(operation.upper(), request.request_id,
            dict(operation=operation, request_id=request.request_id, provider=PROVIDER_ID,
                 requested_model=request.model, output_text="", input_tokens=0, output_tokens=0,
                 usage_provenance="ABORT_CONFIRMED", abort_status="ABORTED", transport_sent=False))
        return value, evidence

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self._validate(request)
        with self._lock:
            old = self._reserve("generate", request)
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                value, evidence = self._aborted(request, "generate")
                return self._save(request.request_id, value, evidence)  # type: ignore[return-value]
            body = self._send("POST", "/api/chat", {"model": request.model,
                "messages": [{"role": "user", "content": request.input_text}], "stream": False},
                request.request_id).body
            if type(body) is not dict or body.get("model") != request.model:
                reject("RESPONSE_MALFORMED")
            output = self._message(body, final=True)
            value, evidence = self._finish(request, "generate", output, self._usage(body))
            return self._save(request.request_id, value, evidence)  # type: ignore[return-value]

    def stream(self, request: GatewayRequest) -> StreamResult:
        self._validate(request)
        with self._lock:
            old = self._reserve("stream", request)
            if old is not None:
                return old  # type: ignore[return-value]
            if request.is_aborted():
                response, evidence = self._aborted(request, "stream")
                value = StreamResult((), response, evidence)
                return self._save(request.request_id, value, evidence)  # type: ignore[return-value]
            body = self._send("POST", "/api/chat", {"model": request.model,
                "messages": [{"role": "user", "content": request.input_text}], "stream": True},
                request.request_id, stream=True).body
            frames = self._frames(body)
            chunks = []
            for frame in frames[:-1]:
                if frame.get("model") != request.model:
                    reject("STREAM_MALFORMED")
                chunks.append(self._message(frame, final=False))
            final = frames[-1]
            if final.get("model") != request.model or self._message(final, final=True):
                reject("STREAM_MALFORMED")
            value, evidence = self._finish(request, "stream", "".join(chunks),
                                           self._usage(final), chunks=tuple(chunks))
            result = StreamResult(tuple(chunks), value, evidence)
            self._stream_verified_models.add(request.model)
            return self._save(request.request_id, result, evidence)  # type: ignore[return-value]

    def health(self, model: str, *, request_id: str) -> ProbeResult:
        self._request_id(request_id)
        try:
            text(model)
        except ValueError:
            reject("MODEL_INVALID")
        installation_status = getattr(self._transport, "installation_status", None)
        if callable(installation_status):
            try:
                installed = installation_status()
            except Exception:
                installed = None
            if installed is False:
                return ProbeResult(canonical({"status": "NOT_INSTALLED", "stream_status": "STREAM_UNVERIFIED"}))
        try:
            version = self._send("GET", "/api/version", None, request_id).body
        except OllamaAdapterError as error:
            return self._probe_failure(error)
        if type(version) is not dict or type(version.get("version")) is not str or not version["version"]:
            return self._probe_failure(OllamaAdapterError("HEALTH_EVIDENCE_INSUFFICIENT"))
        try:
            tags = self._send("GET", "/api/tags", None, request_id).body
        except OllamaAdapterError as error:
            return self._probe_failure(error)
        try:
            names = self._tag_names(tags)
        except OllamaAdapterError as error:
            return self._probe_failure(error)
        if model not in names:
            return ProbeResult(canonical({"status": "MODEL_NOT_PULLED", "stream_status": "STREAM_UNVERIFIED"}))
        try:
            ps = self._send("GET", "/api/ps", None, request_id).body
        except OllamaAdapterError as error:
            if error.code != "MODEL_OR_PATH_NOT_FOUND":
                return self._probe_failure(error)
            ps = None
        try:
            loaded_names = self._tag_names(ps) if ps is not None else None
        except OllamaAdapterError as error:
            return self._probe_failure(error)
        return ProbeResult(canonical({"status": "AVAILABLE", "stream_status":
                                      "READY" if model in self._stream_verified_models else "STREAM_UNVERIFIED",
                                      "model_loaded": None if loaded_names is None else model in loaded_names}))

    @staticmethod
    def _probe_failure(error: OllamaAdapterError) -> ProbeResult:
        status = "OFFLINE" if error.code in {"TRANSPORT_CONNECT_FAILURE", "TRANSPORT_FAILURE"} else "UNAVAILABLE"
        return ProbeResult(canonical({"status": status, "stream_status": "STREAM_UNVERIFIED"}))

    @staticmethod
    def _tag_names(tags: object) -> list[str]:
        if type(tags) is not dict or type(tags.get("models")) is not list:
            reject("HEALTH_EVIDENCE_INSUFFICIENT")
        names: list[str] = []
        for entry in tags["models"]:
            if type(entry) is not dict:
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            try:
                name = text(entry.get("name"))
            except ValueError:
                reject("HEALTH_EVIDENCE_INSUFFICIENT")
            if name not in names:
                names.append(name)
        return names

    def discover(self, *, request_id: str) -> ProbeResult:
        self._request_id(request_id)
        version = self._send("GET", "/api/version", None, request_id).body
        if type(version) is not dict or type(version.get("version")) is not str or not version["version"]:
            reject("HEALTH_EVIDENCE_INSUFFICIENT")
        models = self._tag_names(self._send("GET", "/api/tags", None, request_id).body)
        return ProbeResult(canonical({"provider": PROVIDER_ID, "models": models,
                                      "status": "AVAILABLE", "stream_status": "STREAM_UNVERIFIED"}))
