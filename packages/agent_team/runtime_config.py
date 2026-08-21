"""Runtime configuration references without secret disclosure."""

from __future__ import annotations

import os
from collections.abc import Mapping

from .provider_catalog import ProviderCatalogEntry, PROVIDER_CREDENTIAL_KEYS, SUPPORTED_PROVIDERS


def runtime_catalog(environ: Mapping[str, str] | None = None) -> tuple[ProviderCatalogEntry, ...]:
    """Return provider configuration presence, never credential values."""
    source = os.environ if environ is None else environ
    return tuple(
        ProviderCatalogEntry(provider, PROVIDER_CREDENTIAL_KEYS[provider], bool(source.get(PROVIDER_CREDENTIAL_KEYS[provider])))
        for provider in SUPPORTED_PROVIDERS
    )


def credential_reference(provider: str) -> str:
    """Return the configured environment-variable name for a provider."""
    try:
        return PROVIDER_CREDENTIAL_KEYS[provider]
    except KeyError as error:
        raise ValueError("unsupported provider") from error


__all__ = ["credential_reference", "runtime_catalog"]
