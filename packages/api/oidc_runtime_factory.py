"""Compose existing OIDC boundaries from trusted, explicit server configuration."""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx

from packages.api.oidc_code_flow import OidcCodeFlow
from packages.api.oidc_identity import OidcIdTokenVerifier
from packages.api.oidc_issuer_transport import OidcIssuerTransport
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.oidc_session_coordinator import OidcSessionCoordinator
from packages.persistence.oidc_pending_auth import SqlAlchemyPendingAuthStore
from packages.persistence.oidc_principal_directory import SqlAlchemyOidcPrincipalResolver
from packages.persistence.oidc_session_store import SqlAlchemyOidcSessionStore


_SCOPE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z", re.ASCII)


def _clock() -> datetime:
    # Keep issued TTLs within the stores' second-resolution SQLite clock.
    return datetime.now(timezone.utc).replace(microsecond=0)


class OidcRuntimeRejected(ValueError):
    """Stable configuration rejection without trust material or endpoint payload."""


def _reject() -> OidcRuntimeRejected:
    return OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")


def _canonical(value: object) -> bool:
    return type(value) is str and bool(value) and value == value.strip() and all(
        32 < ord(char) < 127 for char in value
    )


def _https(value: object) -> bool:
    if not _canonical(value):
        return False
    try:
        parts = urlsplit(value)
        return (parts.scheme == "https" and bool(parts.hostname)
                and parts.username is None and parts.password is None
                and not parts.query and not parts.fragment
                and parts.path.startswith("/"))
    except Exception:
        return False


def _policy_valid(policy: object, issuer: str) -> bool:
    return (isinstance(policy, OidcPrincipalPolicy) and policy.issuer == issuer
            and all(isinstance(values, frozenset) and bool(values)
                    and all(type(value) is str and _SCOPE.fullmatch(value)
                            for value in values)
                    for values in (
                        policy.allowed_roles, policy.allowed_permissions,
                        policy.allowed_project_ids, policy.allowed_environment_ids,
                    )))


@dataclass(frozen=True)
class OidcRuntimeConfig:
    issuer: str
    client_id: str
    redirect_uri: str
    jwks_json: str = field(repr=False)
    step_up_acr: str
    principal_policy: OidcPrincipalPolicy
    ca_bundle: str | None = None
    client_secret: Callable[[], str] | None = field(default=None, repr=False)


def build_oidc_session_coordinator(
    config: OidcRuntimeConfig,
    session_factory: Callable,
    *,
    transport: httpx.BaseTransport | None = None,
) -> OidcSessionCoordinator:
    """Build a DB-backed coordinator; network occurs only during code exchange."""
    try:
        if (not isinstance(config, OidcRuntimeConfig)
                or not _https(config.issuer) or not _https(config.redirect_uri)
                or not _canonical(config.client_id) or not _canonical(config.step_up_acr)
                or not _policy_valid(config.principal_policy, config.issuer)
                or (config.ca_bundle is not None and not _canonical(config.ca_bundle))
                or (config.client_secret is not None and not callable(config.client_secret))
                or not callable(session_factory)
                or (transport is not None and not isinstance(transport, httpx.BaseTransport))):
            raise _reject()
        verifier = OidcIdTokenVerifier(
            config.jwks_json, issuer=config.issuer, client_id=config.client_id,
            step_up_acr=config.step_up_acr, clock=_clock,
        )
        token_transport = OidcIssuerTransport(
            issuer=config.issuer,
            token_endpoint=config.issuer.rstrip("/") + "/protocol/openid-connect/token",
            client_id=config.client_id, redirect_uri=config.redirect_uri,
            ca_bundle=config.ca_bundle, client_secret=config.client_secret,
            transport=transport,
        )
        flow = OidcCodeFlow(
            config.issuer.rstrip("/") + "/protocol/openid-connect/auth",
            client_id=config.client_id, redirect_uri=config.redirect_uri,
            verifier=verifier, pending_store=SqlAlchemyPendingAuthStore(session_factory),
            exchange_code=token_transport.exchange_code, clock=_clock,
        )
        return OidcSessionCoordinator(
            flow, SqlAlchemyOidcPrincipalResolver(session_factory),
            config.principal_policy, SqlAlchemyOidcSessionStore(session_factory),
            clock=_clock,
        )
    except Exception:
        raise _reject() from None


__all__ = ["OidcRuntimeConfig", "OidcRuntimeRejected", "build_oidc_session_coordinator"]
