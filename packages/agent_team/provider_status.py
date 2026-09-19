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


class QuotaObservations:
    """Authenticated host observation seam only; never estimates/reserves quota."""
    def __init__(self):
        from threading import RLock
        self._lock=RLock();self._current={};self._records={}

    def observe(self,observation_id,*,provider_id,model_id,catalog_hash,remaining_requests,evidence_hash,now,expires_at):
        from .provider_catalog import _c24_text,_c24_hash,_utc,_snapshot,_digest
        _c24_text(observation_id,128);_c24_text(provider_id,128);_c24_text(model_id,128)
        _c24_hash(catalog_hash);_c24_hash(evidence_hash)
        now=_utc(now);expires_at=_utc(expires_at)
        if provider_id not in CANONICAL_PROVIDER_IDS or type(remaining_requests) is not int or not 0<=remaining_requests<=10**9:raise ValueError('QUOTA_INVALID')
        if not now<expires_at:raise ValueError('QUOTA_EXPIRED')
        row=dict(provider_id=provider_id,model_id=model_id,catalog_hash=catalog_hash,remaining_requests=remaining_requests,
            evidence_hash=evidence_hash,observed_at=now.isoformat(),expires_at=expires_at.isoformat())
        receipt=_snapshot('QUOTA_OBSERVATION',observation_id,row)
        with self._lock:
            old=self._records.get(observation_id);current=self._current.get((provider_id,model_id))
            if old is not None:
                if old!=receipt.payload_json:raise ValueError('REPLAY_CONFLICT')
                return receipt
            if current and row['observed_at']<=current['observed_at']:raise ValueError('STALE_QUOTA_OBSERVATION')
            if len(self._records)>=256:raise ValueError('RECORD_BOUND_EXCEEDED')
            self._current[(provider_id,model_id)]=row;self._records[observation_id]=receipt.payload_json
            return receipt

    def status(self,provider_id,model_id,*,catalog_hash,now):
        from .provider_catalog import _c24_text,_c24_hash,_utc,_snapshot
        _c24_text(provider_id,128);_c24_text(model_id,128);_c24_hash(catalog_hash);instant=_utc(now).isoformat()
        with self._lock:
            row=self._current.get((provider_id,model_id))
            valid=row is not None and row['catalog_hash']==catalog_hash and row['observed_at']<=instant<row['expires_at']
            remaining=row['remaining_requests'] if valid else None
            return _snapshot('QUOTA_STATUS',provider_id+':'+model_id,dict(provider_id=provider_id,model_id=model_id,
                display='Quota not reported' if remaining is None else 'Host-observed quota',remaining_requests=remaining,
                eligible=remaining is not None and remaining>0,reason='QUOTA_NOT_REPORTED' if remaining is None else
                ('QUOTA_EXHAUSTED' if remaining==0 else 'QUOTA_OBSERVED'),evidence_hash=row['evidence_hash'] if valid else None,
                catalog_hash=catalog_hash,io_count=0))


__all__ += ['QuotaObservations']
