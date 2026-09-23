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
from dataclasses import fields, replace
from datetime import datetime, timezone
from hashlib import sha256
import json

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
from .step_execution import EXECUTE_KEY, SqlAlchemyStepExecutionPort
from packages.llm_gateway import NativeAgentAdapter


class RuntimeConfigurationError(ValueError):
    """Raised when the production boundary cannot be safely constructed."""


class RuntimeConsoleNotIntegrated(RuntimeError):
    """Persisted reference projections are not a typed owner export."""


class RuntimeConsoleOwner:
    """Host-only authenticated typed restore, with a legacy materializer seam.

    No mapping is minted from request authority fields. Repository authority is
    checked twice, while host callbacks execute outside its row-lock transaction.
    The materializer must return real existing owners, never a generic JSON proxy.
    """
    def __init__(self, *, session_factory, authenticate, resolve_mapping, materialize=None, clock=None):
        if not all(callable(v) for v in (session_factory,authenticate,resolve_mapping)):
            raise RuntimeConfigurationError('CONSOLE_OWNER_DEPENDENCIES_REQUIRED')
        if materialize is not None and not callable(materialize):
            raise RuntimeConfigurationError('CONSOLE_OWNER_DEPENDENCIES_REQUIRED')
        if clock is not None and not callable(clock):
            raise RuntimeConfigurationError('CONSOLE_CLOCK_REQUIRED')
        self._sessions=session_factory
        self._authenticate=authenticate
        self._mapping=resolve_mapping
        self._materialize=materialize
        self._clock=clock or (lambda:datetime.now(timezone.utc))

    @staticmethod
    def _detached(value):
        from packages.persistence.agent_team_owner_repository import OwnerBinding, PrincipalMapping, OwnerSnapshot, OwnerComponent
        classes=(SessionPrincipal,OwnerBinding,PrincipalMapping,OwnerSnapshot,OwnerComponent)
        if any(type(value) is cls for cls in classes):
            try:
                values={f.name:RuntimeConsoleOwner._detached(object.__getattribute__(value,f.name)) for f in fields(type(value))}
            except AttributeError:
                raise ValueError('AUTHORITY_DENIED') from None
            return type(value)(**values)
        if type(value) is str:
            if len(value.encode('utf-8'))>1048576: raise ValueError('AUTHORITY_DENIED')
            return value
        if type(value) is int or value is None:return value
        if type(value) is tuple or type(value) is frozenset:
            if len(value)>64:raise ValueError('AUTHORITY_DENIED')
            return type(value)(RuntimeConsoleOwner._detached(v) for v in value)
        if type(value) is datetime and value.tzinfo is timezone.utc:
            return datetime(value.year,value.month,value.day,value.hour,value.minute,value.second,value.microsecond,tzinfo=timezone.utc)
        raise ValueError('AUTHORITY_DENIED')

    def _credentials(self, token):
        from packages.persistence.agent_team_owner_repository import PrincipalMapping, OwnerBinding
        principal=self._authenticate(token)
        if type(principal) is not SessionPrincipal:raise ValueError('AUTHORITY_REQUIRED')
        principal=self._detached(principal)
        if (type(principal.actor_id) is not str or type(principal.actor_role) is not str
            or type(principal.permissions) is not frozenset or type(principal.project_ids) is not frozenset
            or type(principal.environment_ids) is not frozenset):raise ValueError('AUTHORITY_DENIED')
        for values in (principal.permissions,principal.project_ids,principal.environment_ids):
            if any(type(v) is not str for v in values):raise ValueError('AUTHORITY_DENIED')
        token_hash='sha256:'+sha256(token.encode()).hexdigest()
        mapping=self._mapping(self._detached(principal),token_hash)
        if type(mapping) is not PrincipalMapping:raise ValueError('AUTHORITY_DENIED')
        mapping=self._detached(mapping)
        if type(mapping.binding) is not OwnerBinding or type(mapping.permissions) is not tuple:
            raise ValueError('AUTHORITY_DENIED')
        b=mapping.binding
        if (mapping.auth_session_hash!=token_hash or mapping.principal_actor_id!=principal.actor_id
            or mapping.principal_role!=principal.actor_role or b.actor_id!=principal.actor_id
            or b.project_id not in principal.project_ids or b.environment_id not in principal.environment_ids
            or 'tasks:read' not in principal.permissions or not set(mapping.permissions)<=principal.permissions):
            raise ValueError('AUTHORITY_DENIED')
        return principal,mapping

    def read_request(self, menu, request):
        from packages.persistence.agent_team_owner_repository import SqlAlchemyAgentTeamOwnerRepository, ProjectionReceipt
        from apps.api.anvil_api.routes.agent_console import ConsoleAuthority, ConsoleProjectionService, MENUS
        if type(menu) is not str or menu not in MENUS:raise ValueError('MENU_INVALID')
        if request.query_params:raise ValueError('AUTHORITY_DENIED')
        if any(name in request.headers for name in ('x-actor-id','x-context-id','x-session-id','x-target-hash',
            'x-assignment-id','x-execution-fence','x-write-fence','x-owner-snapshot',
            'x-owner-components','x-principal-mapping')):raise ValueError('AUTHORITY_DENIED')
        token=request.cookies.get('anvil_session')
        if type(token) is not str or not 1<=len(token)<=256 or not token.isascii():raise ValueError('AUTHORITY_REQUIRED')
        principal,mapping=self._credentials(token)
        now=self._detached(self._clock())
        if type(now) is not datetime:raise ValueError('UTC_REQUIRED')
        repo=SqlAlchemyAgentTeamOwnerRepository()
        with self._sessions() as session,session.begin():
            snapshot=repo.load_current_owner(session,binding=mapping.binding,principal=mapping)
        if snapshot is None:raise ValueError('AUTHORITY_DENIED')
        if self._materialize is None:
            from packages.agent_team.owner_component_restore import restore_owner_components
            # This marker distinguishes historical public references from exports;
            # the typed codec still verifies every field/hash after this check.
            for component in (snapshot.policy,snapshot.results,snapshot.team,snapshot.moa):
                if component is None or json.loads(component.canonical_json).get('schema_version')!='owner-component/v1':
                    raise RuntimeConsoleNotIntegrated('OWNER_EXPORT_NOT_AVAILABLE')
            bundle=restore_owner_components(snapshot,mapping,session_factory=self._sessions,now=now)
            service=ConsoleProjectionService.from_owner_bundle(bundle)
        else:
            # Legacy host callback receives a detached validation snapshot.
            service=self._materialize(self._detached(snapshot))
        if type(service) is not ConsoleProjectionService:raise ValueError('OWNER_REQUIRED')
        b=snapshot.binding
        authority=ConsoleAuthority(b.assignment_id,b.actor_id,b.context_id,b.session_id,b.target_hash,b.execution_fence)
        service.verify_owner_snapshot(snapshot,authority,now=now)
        response=service.read(menu,authority,now=now)
        body=json.dumps(response,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
        if len(body.encode())>65536:raise ValueError('PROJECTION_BOUND_EXCEEDED')
        request_hash='sha256:'+sha256(json.dumps(dict(owner=snapshot.content_hash,
            mapping=mapping.mapping_hash,menu=menu,query={}),sort_keys=True,separators=(',',':')).encode()).hexdigest()
        request_id='console-'+request_hash[7:]
        current_principal,current_mapping=self._credentials(token)
        if current_principal!=principal or current_mapping!=mapping:raise ValueError('AUTHORITY_DENIED')
        with self._sessions() as session,session.begin():
            current=repo.load_current_owner(session,binding=b,principal=mapping,expected_version=snapshot.owner_version)
            if current!=snapshot:raise ValueError('PROJECTION_CHANGED')
            service.verify_owner_snapshot(current,authority,now=now)
            stored=repo.load_receipt(session,binding=b,principal=mapping,request_id=request_id)
            response_hash='sha256:'+sha256(body.encode()).hexdigest()
            if stored is not None:
                if stored.response_hash!=response_hash or stored.request_hash!=request_hash:raise ValueError('PROJECTION_CHANGED')
                return json.loads(stored.response_json)
            # Receipt fields are built only from checked server values, not request headers.
            receipt=ProjectionReceipt('receipt-'+request_hash[7:],request_id,request_hash,b,
                current.owner_version,current.content_hash,mapping.mapping_hash,menu,body,response_hash,now,'')
            def primitive(value):
                if type(value) is datetime:return value.isoformat(timespec='microseconds')
                if type(value) is tuple:return [primitive(x) for x in value]
                if type(value) in (ProjectionReceipt,type(b)):
                    return {f.name:primitive(getattr(value,f.name)) for f in fields(type(value))}
                return value
            payload=primitive(receipt);del payload['content_hash']
            seal='sha256:'+sha256(json.dumps(payload,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
            repo.save_receipt(session,binding=b,principal=mapping,receipt=replace(receipt,content_hash=seal),expected_version=current.owner_version)
        return response


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
    step_adapters: Mapping[str, NativeAgentAdapter] | None = None,
    console_mapping_resolver=None,
    console_materializer=None,
    console_clock=None,
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
    step_commands = {}
    if step_adapters is not None:
        if EXECUTE_KEY in base_ports.commands:
            raise RuntimeConfigurationError("runtime Step execution port cannot replace an injected port")
        try:
            step_commands[EXECUTE_KEY] = SqlAlchemyStepExecutionPort(session_factory, step_adapters)
        except ValueError as error:
            raise RuntimeConfigurationError(str(error)) from error
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
            **step_commands,
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
    app.state.agent_console_runtime = None
    app.state.agent_console_restore_status = "NOT_INTEGRATED"
    if console_mapping_resolver is not None or console_materializer is not None:
        app.state.agent_console_runtime = RuntimeConsoleOwner(
            session_factory=session_factory,authenticate=app_kwargs.get("authenticate"),
            resolve_mapping=console_mapping_resolver,materialize=console_materializer,clock=console_clock,
        )
        if console_materializer is None:
            # Configuration is not evidence of a successful restore or readiness.
            app.state.agent_console_restore_status = "TYPED_OWNER_RESTORE_CONFIGURED"
    return app


__all__ = ["RuntimeConfigurationError", "RuntimeConsoleOwner", "create_runtime_app"]
