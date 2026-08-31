"""Small, provider-neutral contracts; no provider or credential I/O occurs here."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol, runtime_checkable
from uuid import uuid4


def _text(value: str, field_name: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field_name} must be a canonical non-empty string")


class UsageProvenance(str, Enum):
    PROVIDER_FINAL = "PROVIDER_FINAL"
    ABORT_CONFIRMED = "ABORT_CONFIRMED"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True, slots=True)
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0

    def __post_init__(self) -> None:
        if type(self.input_tokens) is not int or self.input_tokens < 0:
            raise ValueError("input_tokens must be non-negative")
        if type(self.output_tokens) is not int or self.output_tokens < 0:
            raise ValueError("output_tokens must be non-negative")

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass(frozen=True, slots=True)
class GatewayRequest:
    provider: str
    model: str
    input_text: str
    request_id: str = field(default_factory=lambda: f"req-{uuid4().hex}")
    abort_signal: object | None = None
    retry_after: str | None = None

    def __post_init__(self) -> None:
        for value, name in ((self.provider, "provider"), (self.model, "model"),
                            (self.input_text, "input_text"), (self.request_id, "request_id")):
            _text(value, name)
        if self.retry_after is not None:
            _text(self.retry_after, "retry_after")

    def is_aborted(self) -> bool:
        signal = self.abort_signal
        if signal is None:
            return False
        if callable(signal):
            return bool(signal())
        return bool(getattr(signal, "is_set", lambda: False)())


@dataclass(frozen=True, slots=True)
class GatewayResponse:
    request_id: str
    provider: str
    model: str
    output_text: str
    final_usage: TokenUsage
    usage_provenance: UsageProvenance
    abort_status: str = "COMPLETED"
    retry_after: str | None = None

    def __post_init__(self) -> None:
        for value, name in ((self.request_id, "request_id"), (self.provider, "provider"),
                            (self.model, "model"), (self.abort_status, "abort_status")):
            _text(value, name)
        if not (self.output_text == "" and self.abort_status == "ABORTED"):
            _text(self.output_text, "output_text")
        if not isinstance(self.final_usage, TokenUsage):
            raise TypeError("final_usage must be TokenUsage")
        if not isinstance(self.usage_provenance, UsageProvenance):
            raise TypeError("usage_provenance must be UsageProvenance")


@dataclass(frozen=True, slots=True)
class CapabilityProbe:
    supported: bool
    capabilities: frozenset[str]
    unsupported_reasons: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if type(self.supported) is not bool:
            raise TypeError("supported must be bool")
        if not isinstance(self.capabilities, frozenset):
            raise TypeError("capabilities must be frozenset")
        if not isinstance(self.unsupported_reasons, tuple):
            raise TypeError("unsupported_reasons must be tuple")


@runtime_checkable
class ProviderAdapter(Protocol):
    def generate(self, request: GatewayRequest) -> GatewayResponse: ...
    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe: ...


class DeterministicFakeAdapter:
    """Test adapter which never performs network I/O."""

    def __init__(self, capabilities: set[str] | frozenset[str] | None = None) -> None:
        self.capabilities = frozenset(capabilities or {"text_generation"})
        self.calls = 0

    def probe(self, required: set[str] | frozenset[str] = frozenset()) -> CapabilityProbe:
        missing = tuple(f"missing capability: {name}" for name in sorted(set(required) - self.capabilities))
        return CapabilityProbe(not missing, self.capabilities, missing)

    def generate(self, request: GatewayRequest) -> GatewayResponse:
        self.calls += 1
        aborted = request.is_aborted()
        return GatewayResponse(
            request.request_id, request.provider, request.model,
            "" if aborted else f"fake:{request.input_text}",
            TokenUsage(1, 0 if aborted else 2),
            UsageProvenance.ABORT_CONFIRMED if aborted else UsageProvenance.PROVIDER_FINAL,
            "ABORTED" if aborted else "COMPLETED", request.retry_after,
        )
