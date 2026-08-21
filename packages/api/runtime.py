"""Production-safe FastAPI construction for the durable Telegram ingress.

This module is intentionally an adapter, not a secret store.  It resolves only
the names and values required to construct the process and never exposes the
credential values through application state or responses.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Callable

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from packages.agent_team.provider_catalog import PRIMARY_PROVIDER
from packages.agent_team.runtime_config import runtime_catalog
from packages.agent_team.telegram_adapter import TelegramAdapter
from packages.persistence.config import DatabaseSettings

from .fastapi_app import create_app
from .telegram_webhook import TelegramWebhook, TelegramWebhookConfig


class RuntimeConfigurationError(ValueError):
    """Raised when the production boundary cannot be safely constructed."""


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
    config = TelegramWebhookConfig(
        secret_token=secret_token,
        hmac_secret=signing_secret,
        allowed_hosts=(source.get("ANVIL_PUBLIC_HOST", "anvil.sinsan.kr").strip(),),
    )
    telegram_adapter = adapter or TelegramAdapter(
        allowlisted_identities=_allowlisted_identities(source),
        signing_secret=signing_secret,
        console_base_url=console_base_url,
    )
    webhook = TelegramWebhook.from_session_factory(
        telegram_adapter, config, session_factory=session_factory,
    )
    app = create_app(telegram_webhook=webhook, **app_kwargs)
    # Metadata is deliberately credential-free and useful to health/readiness
    # consumers without turning provider secrets into API data.
    app.state.provider_catalog = runtime_catalog(source)
    app.state.primary_provider = PRIMARY_PROVIDER
    app.state.database_engine = engine
    app.state.migration_head = "0011_telegram_webhook_state"
    app.state.runtime_database_configured = True
    return app


__all__ = ["RuntimeConfigurationError", "create_runtime_app"]
