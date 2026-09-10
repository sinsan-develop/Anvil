"""Production-safe FastAPI construction for the durable Telegram ingress.

This module is intentionally an adapter, not a secret store.  It resolves only
the names and values required to construct the process and never exposes the
credential values through application state or responses.
"""

from __future__ import annotations

from ipaddress import ip_address
import os
from urllib.parse import urlsplit
from collections.abc import Mapping
from typing import Any, Callable

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.responses import Response

from packages.agent_team.provider_catalog import PRIMARY_PROVIDER
from packages.agent_team.runtime_config import runtime_catalog
from packages.agent_team.telegram_adapter import TelegramAdapter
from packages.persistence.config import DatabaseSettings

from .common import SessionPrincipal
from .fastapi_app import ApiPorts, AuthorizationScope, create_app
from .local_session import LocalTestSessionConfig, LocalTestSessionService
from .provider_status import ProviderStatusPort
from .run_creation import RunCreationPort
from .task_bootstrap import TaskBootstrapPort
from .telegram_webhook import TelegramWebhook, TelegramWebhookConfig
from .security import WebSecurityConfig
from .sse import PostgresEventStream
from packages.persistence.run_creation_repository import SqlAlchemyRunCreationRepository


class RuntimeConfigurationError(ValueError):
    """Raised when the production boundary cannot be safely constructed."""


_TEST_SESSION_REQUIRED = (
    "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN",
    "ANVIL_TEST_SESSION_ACTOR_ID",
    "ANVIL_TEST_SESSION_PROJECT_ID",
    "ANVIL_TEST_SESSION_ENVIRONMENT_ID",
    "ANVIL_TEST_SESSION_RUN_IDS",
)
_TEST_SESSION_OPTIONAL = (
    "ANVIL_TEST_SESSION_TTL_SECONDS",
    "ANVIL_TEST_SESSION_PERMISSION_SCOPES",
)
_ALLOWED_TEST_SESSION_PERMISSION_SCOPES = frozenset(
    {"tasks:write", "tasks:read", "run:events:read", "provider:read"}
)
_PROVIDER_TRAILING_SLASH_PATHS = (
    "/api/providers/",
    "/api/providers/{providerId}/",
    "/api/providers/{providerId}/models/",
)
_WSL_ACCEPTANCE_MODE = "WSL_ACCEPTANCE"
_WSL_RUNTIME_ENVIRONMENT = "WSL_SERVER_TEST_STAGING"


def _provider_trailing_slash_denied() -> Response:
    return Response(status_code=404)


def _required(environment: Mapping[str, str], name: str) -> str:
    value = environment.get(name)
    if not isinstance(value, str) or not value.strip():
        raise RuntimeConfigurationError(f"{name} is required")
    return value.strip()


def _require_wsl_acceptance_authority(environment: Mapping[str, str]) -> None:
    public_host = _required(environment, "ANVIL_PUBLIC_HOST")
    console_base_url = _required(environment, "ANVIL_CONSOLE_BASE_URL")
    parsed = urlsplit(console_base_url)
    try:
        address = ip_address(public_host)
    except ValueError as error:
        raise RuntimeConfigurationError(
            "WSL_ACCEPTANCE requires a private or loopback IP authority"
        ) from error
    if parsed.hostname != public_host or not (address.is_private or address.is_loopback):
        raise RuntimeConfigurationError(
            "WSL_ACCEPTANCE requires a matching private or loopback IP authority"
        )


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
    raw_permission_scopes = environment.get("ANVIL_TEST_SESSION_PERMISSION_SCOPES")
    if raw_permission_scopes is None:
        permission_scopes = frozenset({"run:events:read"})
    else:
        if not isinstance(raw_permission_scopes, str) or not raw_permission_scopes:
            raise RuntimeConfigurationError(
                "ANVIL_TEST_SESSION_PERMISSION_SCOPES is invalid"
            )
        parsed_scopes = raw_permission_scopes.split(",")
        if (
            any(not item or item != item.strip() for item in parsed_scopes)
            or len(parsed_scopes) != len(set(parsed_scopes))
            or not set(parsed_scopes) <= _ALLOWED_TEST_SESSION_PERMISSION_SCOPES
        ):
            raise RuntimeConfigurationError(
                "ANVIL_TEST_SESSION_PERMISSION_SCOPES is invalid"
            )
        permission_scopes = frozenset(parsed_scopes)
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
            permission_scopes=permission_scopes,
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
    configured_auth_mode = source.get("ANVIL_AUTH_MODE", "")
    if configured_auth_mode not in {"", "COOKIE", _WSL_ACCEPTANCE_MODE}:
        raise RuntimeConfigurationError("ANVIL_AUTH_MODE is invalid")
    auth_mode = configured_auth_mode or "COOKIE"
    if (
        auth_mode == _WSL_ACCEPTANCE_MODE
        and source.get("ANVIL_RUNTIME_ENVIRONMENT") != _WSL_RUNTIME_ENVIRONMENT
    ):
        raise RuntimeConfigurationError(
            "WSL_ACCEPTANCE requires exact ANVIL_RUNTIME_ENVIRONMENT=WSL_SERVER_TEST_STAGING"
        )
    if auth_mode == _WSL_ACCEPTANCE_MODE:
        _require_wsl_acceptance_authority(source)
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
    base_ports = app_kwargs.pop("ports", ApiPorts())
    run_key = "POST /api/tasks/{taskId}/runs"
    task_create_key = "POST /api/projects/{projectId}/tasks"
    task_read_key = "GET /api/tasks/{taskId}"
    provider_status_port = ProviderStatusPort(source)
    provider_query_ports = provider_status_port.query_ports()
    if run_key in base_ports.commands:
        raise RuntimeConfigurationError("runtime Run creation port cannot replace an injected port")
    if task_create_key in base_ports.commands or task_read_key in base_ports.queries:
        raise RuntimeConfigurationError("runtime Task bootstrap ports cannot replace injected ports")
    if set(provider_query_ports) & set(base_ports.queries):
        raise RuntimeConfigurationError("runtime Provider status ports cannot replace injected ports")
    from packages.persistence.task_bootstrap_repository import SqlAlchemyTaskBootstrapRepository

    task_repository = SqlAlchemyTaskBootstrapRepository(session_factory)
    app_kwargs["ports"] = ApiPorts(
        commands={
            **base_ports.commands,
            run_key: RunCreationPort(SqlAlchemyRunCreationRepository(session_factory)),
            task_create_key: TaskBootstrapPort(task_repository),
        },
        queries={
            **base_ports.queries,
            task_read_key: TaskBootstrapPort(task_repository),
            **provider_query_ports,
        },
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
    trusted_read_principal = None
    if auth_mode == _WSL_ACCEPTANCE_MODE:
        if local_session is None:
            raise RuntimeConfigurationError(
                "WSL_ACCEPTANCE requires manifest-bound ANVIL_TEST_SESSION configuration"
            )
        trusted_read_principal = SessionPrincipal(
            actor_id="server:wsl-acceptance",
            actor_role="wsl_acceptance_reader",
            csrf_token="server-read-only-no-csrf",
            permissions=frozenset({"provider:read", "run:events:read"}),
            project_ids=frozenset({local_session.config.project_id}),
            environment_ids=frozenset({local_session.config.environment_id}),
        )
    if local_session is not None:
        conflicts = {"authenticate", "authorization_resolver", "session_issuer"} & set(app_kwargs)
        if conflicts:
            raise RuntimeConfigurationError(
                "environment test session cannot replace injected authentication ports"
            )

        provider_read_keys = frozenset(
            {
                "GET /api/providers",
                "GET /api/providers/{providerId}",
                "GET /api/providers/{providerId}/models",
            }
        )

        def resolve_test_scope(endpoint, path_parameters):
            if endpoint.key == task_create_key:
                authorized = (
                    path_parameters.get("projectId")
                    == local_session.config.project_id
                    and path_parameters.get("targetEnvironment")
                    == local_session.config.environment_id
                )
            elif endpoint.key in {task_read_key, run_key}:
                authority = task_repository.resolve_task_authority(
                    path_parameters.get("taskId", "")
                )
                authorized = (
                    authority is not None
                    and authority.project_id == local_session.config.project_id
                    and authority.target_environment
                    == local_session.config.environment_id
                )
            elif endpoint.key == "GET /api/runs/{id}/events":
                authorized = local_session.allows_run(path_parameters.get("id"))
            elif endpoint.key in provider_read_keys:
                authorized = True
            else:
                authorized = False
            if not authorized:
                return None
            allowed_roles = (
                frozenset({"tester", "wsl_acceptance_reader"})
                if endpoint.key == "GET /api/runs/{id}/events" or endpoint.key in provider_read_keys
                else frozenset({"tester"})
            )
            return AuthorizationScope(
                local_session.config.project_id,
                local_session.config.environment_id,
                allowed_roles,
            )

        app_kwargs.update(
            authenticate=local_session.authenticate,
            authorization_resolver=resolve_test_scope,
            session_issuer=local_session,
            trusted_read_principal=trusted_read_principal,
            auth_mode=auth_mode,
        )
    else:
        injected_scope_resolver = app_kwargs.get("authorization_resolver")

        def resolve_runtime_scope(endpoint, path_parameters):
            if injected_scope_resolver is None:
                return None
            scope = injected_scope_resolver(endpoint, path_parameters)
            if endpoint.key == task_create_key:
                return scope
            elif endpoint.key == task_read_key:
                authority = task_repository.resolve_task_authority(path_parameters.get("taskId", ""))
            else:
                return scope
            if authority is None or scope is None:
                return None
            if (
                scope.project_id != authority.project_id
                or scope.environment_id != authority.target_environment
            ):
                return None
            return scope

        app_kwargs["authorization_resolver"] = resolve_runtime_scope
    app_kwargs.setdefault("event_stream", PostgresEventStream(session_factory))
    app = create_app(telegram_webhook=webhook, security_config=web_security, **app_kwargs)
    for path in _PROVIDER_TRAILING_SLASH_PATHS:
        app.add_api_route(
            path,
            _provider_trailing_slash_denied,
            methods=["GET"],
            include_in_schema=False,
        )
    # Metadata is deliberately credential-free and useful to health/readiness
    # consumers without turning provider secrets into API data.
    app.state.provider_catalog = runtime_catalog(source)
    app.state.primary_provider = PRIMARY_PROVIDER
    app.state.database_engine = engine
    app.state.migration_head = "0013_task_bootstrap_authority"
    app.state.runtime_database_configured = True
    app.state.event_stream = app_kwargs["event_stream"]
    app.state.local_test_session_enabled = local_session is not None
    app.state.auth_mode = auth_mode
    return app


__all__ = ["RuntimeConfigurationError", "create_runtime_app"]
