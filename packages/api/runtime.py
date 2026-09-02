"""Production-safe FastAPI construction for the durable Telegram ingress.

This module is intentionally an adapter, not a secret store.  It resolves only
the names and values required to construct the process and never exposes the
credential values through application state or responses.
"""

from __future__ import annotations

import os
from urllib.parse import urlsplit
from collections.abc import Mapping
from typing import Any, Callable

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from packages.agent_team.provider_catalog import PRIMARY_PROVIDER
from packages.agent_team.runtime_config import runtime_catalog
from packages.agent_team.telegram_adapter import TelegramAdapter
from packages.persistence.config import DatabaseSettings

from .fastapi_app import AuthorizationScope, create_app
from .local_session import LocalTestSessionConfig, LocalTestSessionService
from .telegram_webhook import TelegramWebhook, TelegramWebhookConfig
from .security import WebSecurityConfig


class RuntimeConfigurationError(ValueError):
    """Raised when the production boundary cannot be safely constructed."""


_TEST_SESSION_REQUIRED = (
    "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN",
    "ANVIL_TEST_SESSION_ACTOR_ID",
    "ANVIL_TEST_SESSION_PROJECT_ID",
    "ANVIL_TEST_SESSION_ENVIRONMENT_ID",
    "ANVIL_TEST_SESSION_RUN_IDS",
)
_TEST_SESSION_OPTIONAL = ("ANVIL_TEST_SESSION_TTL_SECONDS",)


def _required(environment: Mapping[str, str], name: str) -> str:
    value = environment.get(name)
    if not isinstance(value, str) or not value.strip():
        raise RuntimeConfigurationError(f"{name} is required")
    return value.strip()


def _allowlisted_identities(environment: Mapping[str, str]) -> frozenset[tuple[str, str]]:
    raw = _required(environment, "TELEGRAM_ALLOWED_IDENTITIES")
    identities: set[tuple[str, str]] = set()
    for item in raw.split(","):
        parts = item.strip().split(":", 1)
        if len(parts) != 2 or not all(parts) or any("\n" in part or "\r" in part for part in parts):
            raise RuntimeConfigurationError("TELEGRAM_ALLOWED_IDENTITIES is invalid")
        identities.add((parts[0], parts[1]))
    if not identities:
        raise RuntimeConfigurationError("TELEGRAM_ALLOWED_IDENTITIES is required")
    return frozenset(identities)


def _local_test_session_config(
    environment: Mapping[str, str],
) -> LocalTestSessionConfig | None:
    names = _TEST_SESSION_REQUIRED + _TEST_SESSION_OPTIONAL
    if not any(name in environment for name in names):
        return None
    values = {name: _required(environment, name) for name in _TEST_SESSION_REQUIRED}
    run_ids = frozenset(
        run_id.strip()
        for run_id in values["ANVIL_TEST_SESSION_RUN_IDS"].split(",")
        if run_id.strip()
    )
    raw_ttl = environment.get("ANVIL_TEST_SESSION_TTL_SECONDS", "900")
    try:
        ttl_seconds = int(raw_ttl)
    except (TypeError, ValueError) as error:
        raise RuntimeConfigurationError("ANVIL_TEST_SESSION_TTL_SECONDS is invalid") from error
    try:
        return LocalTestSessionConfig(
            bootstrap_token=values["ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN"],
            actor_id=values["ANVIL_TEST_SESSION_ACTOR_ID"],
            project_id=values["ANVIL_TEST_SESSION_PROJECT_ID"],
            environment_id=values["ANVIL_TEST_SESSION_ENVIRONMENT_ID"],
            run_ids=run_ids,
            ttl_seconds=ttl_seconds,
        )
    except ValueError as error:
        raise RuntimeConfigurationError(str(error)) from error


def create_runtime_app(
    *,
    environment: Mapping[str, str] | None = None,
    session_factory: Callable[[], Any] | None = None,
    engine: Any | None = None,
    adapter: TelegramAdapter | None = None,
    **app_kwargs: Any,
):
    """Construct the application with durable Telegram state.

    Tests may inject an isolated ``session_factory`` (and optionally an
    adapter). Production callers must provide a PostgreSQL DSN and the
    environment-backed Telegram boundary references. Missing dependencies
    fail before a route is exposed; the in-memory state store is never used.
    """
    source = os.environ if environment is None else environment
    try:
        settings = DatabaseSettings.from_environment(source)
    except ValueError as error:
        raise RuntimeConfigurationError(str(error)) from error

    if session_factory is None:
        if engine is None:
            try:
                engine = create_engine(settings.dsn, pool_pre_ping=True)
            except Exception as error:
                raise RuntimeConfigurationError("database engine could not be created") from error
        session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    if not callable(session_factory):
        raise RuntimeConfigurationError("a database session factory is required")

    secret_token = _required(source, "TELEGRAM_WEBHOOK_SECRET")
    signing_secret = _required(source, "TELEGRAM_INTERNAL_SIGNING_SECRET")
    console_base_url = _required(source, "ANVIL_CONSOLE_BASE_URL")
    public_host = (source.get("ANVIL_PUBLIC_HOST") or urlsplit(console_base_url).hostname or "anvil.local").strip()
    config = TelegramWebhookConfig(
        secret_token=secret_token,
        hmac_secret=signing_secret,
        allowed_hosts=(public_host,),
    )
    telegram_adapter = adapter or TelegramAdapter(
        allowlisted_identities=_allowlisted_identities(source),
        signing_secret=signing_secret,
        console_base_url=console_base_url,
    )
    webhook = TelegramWebhook.from_session_factory(
        telegram_adapter, config, session_factory=session_factory,
    )
    web_security = WebSecurityConfig(
        allowed_hosts=frozenset({public_host, "anvil.local"}),
        allowed_origins=frozenset({console_base_url.rstrip("/"), "https://anvil.local"}),
    )
    local_session_config = _local_test_session_config(source)
    local_session = (
        LocalTestSessionService(local_session_config)
        if local_session_config is not None
        else None
    )
    if local_session is not None:
        conflicts = {"authenticate", "authorization_resolver", "session_issuer"} & set(app_kwargs)
        if conflicts:
            raise RuntimeConfigurationError(
                "environment test session cannot replace injected authentication ports"
            )

        def resolve_test_scope(endpoint, path_parameters):
            if endpoint.key != "GET /api/runs/{id}/events" or not local_session.allows_run(
                path_parameters.get("id")
            ):
                return None
            return AuthorizationScope(
                local_session.config.project_id,
                local_session.config.environment_id,
                frozenset({"tester"}),
            )

        app_kwargs.update(
            authenticate=local_session.authenticate,
            authorization_resolver=resolve_test_scope,
            session_issuer=local_session,
        )
    app = create_app(telegram_webhook=webhook, security_config=web_security, **app_kwargs)
    # Metadata is deliberately credential-free and useful to health/readiness
    # consumers without turning provider secrets into API data.
    app.state.provider_catalog = runtime_catalog(source)
    app.state.primary_provider = PRIMARY_PROVIDER
    app.state.database_engine = engine
    app.state.migration_head = "0011_telegram_webhook_state"
    app.state.runtime_database_configured = True
    app.state.local_test_session_enabled = local_session is not None
    return app


__all__ = ["RuntimeConfigurationError", "create_runtime_app"]
