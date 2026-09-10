"""Canonical, credential-free provider catalog for successor MoA routing.

This module contains identifiers and configuration-key names only.  It never
reads or emits secret values and never performs provider/network I/O.
"""

from __future__ import annotations

from dataclasses import dataclass


CANONICAL_PROVIDER_IDS: tuple[str, ...] = (
    "cerebras", "groq", "mistral", "openrouter", "upstage",
    "gemini", "anthropic", "openai", "ollama",
)
PRIMARY_PROVIDER_ID = "upstage"

SUPPORTED_PROVIDERS: tuple[str, ...] = (
    "CEREBRAS", "GROQ", "MISTRAL", "OPENROUTER", "UPSTAGE",
    "GEMINI", "ANTHROPIC", "OPENAI", "OLLAMA",
)
PRIMARY_PROVIDER = "UPSTAGE"

# Names are placeholders for a later Secret Broker/config implementation.
# Values must never be placed in source, reports, logs, or browser payloads.
PROVIDER_CREDENTIAL_KEYS: dict[str, str] = {
    "CEREBRAS": "CEREBRAS_API_KEY",
    "GROQ": "GROQ_API_KEY",
    "MISTRAL": "MISTRAL_API_KEY",
    "OPENROUTER": "OPENROUTER_API_KEY",
    "UPSTAGE": "UPSTAGE_API_KEY",
    "GEMINI": "GEMINI_API_KEY",
    "ANTHROPIC": "ANTHROPIC_API_KEY",
    "OPENAI": "OPENAI_API_KEY",
    "OLLAMA": "OLLAMA_BASE_URL",
}


@dataclass(frozen=True, slots=True)
class ProviderCatalogEntry:
    provider_id: str
    credential_key: str
    configured: bool = False


@dataclass(frozen=True, slots=True)
class ProviderDefinition:
    provider_id: str
    display_name: str
    primary: bool


def provider_definitions() -> tuple[ProviderDefinition, ...]:
    """Return the public canonical provider catalog in stable display order."""
    return tuple(
        ProviderDefinition(provider_id, provider_id.upper(), provider_id == PRIMARY_PROVIDER_ID)
        for provider_id in CANONICAL_PROVIDER_IDS
    )


def catalog_entries() -> tuple[ProviderCatalogEntry, ...]:
    """Return stable display order without resolving credentials."""
    return tuple(
        ProviderCatalogEntry(provider, PROVIDER_CREDENTIAL_KEYS[provider])
        for provider in SUPPORTED_PROVIDERS
    )


def ordered_candidates(
    eligible: tuple[str, ...] | list[str],
    *,
    explicit_provider: str | None = None,
) -> tuple[str, ...]:
    """Return a deterministic route order with explicit override support.

    UPSTAGE is preferred when eligible. An explicit provider is placed first,
    but must itself be eligible; no implicit provider is forced over the
    capability/privacy/egress eligibility result supplied by the caller.
    """
    eligible_set = set(eligible)
    if not eligible_set.issubset(set(SUPPORTED_PROVIDERS)):
        raise ValueError("eligible contains unsupported provider")
    if explicit_provider is not None:
        if explicit_provider not in eligible_set:
            raise LookupError("explicit provider is not eligible")
        first = (explicit_provider,)
    elif PRIMARY_PROVIDER in eligible_set:
        first = (PRIMARY_PROVIDER,)
    else:
        first = ()
    remainder = tuple(provider for provider in SUPPORTED_PROVIDERS if provider in eligible_set and provider not in first)
    return first + remainder


__all__ = [
    "CANONICAL_PROVIDER_IDS", "PRIMARY_PROVIDER", "PRIMARY_PROVIDER_ID",
    "PROVIDER_CREDENTIAL_KEYS", "ProviderCatalogEntry", "ProviderDefinition",
    "SUPPORTED_PROVIDERS", "catalog_entries", "ordered_candidates",
    "provider_definitions",
]
