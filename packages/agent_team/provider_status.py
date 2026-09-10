"""Credential-safe, network-free Provider status projection."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from .provider_catalog import (
    CANONICAL_PROVIDER_IDS,
    PRIMARY_PROVIDER_ID,
    PROVIDER_CREDENTIAL_KEYS,
)


@dataclass(frozen=True, slots=True)
class ProviderStatus:
    provider_id: str
    display_name: str
    primary: bool
    status: str
    credential_status: str
    health_status: str = "NOT_CHECKED"
    latency_ms: int | None = None
    last_error: str | None = None
    models: tuple[str, ...] = ()
    moa_eligible: bool = False

    def as_public_dict(self) -> dict[str, Any]:
        return {
            "provider_id": self.provider_id,
            "display_name": self.display_name,
            "primary": self.primary,
            "status": self.status,
            "credential_status": self.credential_status,
            "health_status": self.health_status,
            "latency_ms": self.latency_ms,
            "last_error": self.last_error,
            "models": list(self.models),
            "moa_eligible": self.moa_eligible,
        }


class ProviderStatusService:
    """Snapshot configuration presence without retaining credentials or doing I/O."""

    __slots__ = ("_configured",)

    def __init__(self, environment: Mapping[str, str]) -> None:
        self._configured = frozenset(
            provider_id
            for provider_id in CANONICAL_PROVIDER_IDS
            if bool(environment.get(PROVIDER_CREDENTIAL_KEYS[provider_id.upper()]))
        )

    def _status(self, provider_id: str) -> ProviderStatus:
        if provider_id not in CANONICAL_PROVIDER_IDS:
            raise LookupError("provider is not in the canonical catalog")
        configured = provider_id in self._configured
        return ProviderStatus(
            provider_id=provider_id,
            display_name=provider_id.upper(),
            primary=provider_id == PRIMARY_PROVIDER_ID,
            status="DEGRADED" if configured else "NOT_CONFIGURED",
            credential_status="REGISTERED" if configured else "MISSING",
        )

    def list(self) -> tuple[ProviderStatus, ...]:
        return tuple(self._status(provider_id) for provider_id in CANONICAL_PROVIDER_IDS)

    def get(self, provider_id: str) -> ProviderStatus:
        return self._status(provider_id)


__all__ = ["ProviderStatus", "ProviderStatusService"]
