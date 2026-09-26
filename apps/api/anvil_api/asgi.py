"""ASGI entrypoint for the unified public runtime; secrets stay in process env."""
import os
from collections.abc import Callable, Mapping
from urllib.parse import urlsplit

import httpx

from fastapi import Response
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from fastapi import FastAPI
from packages.api.runtime import create_runtime_app
from packages.api.fastapi_app import AuthorizationResolver
from packages.api.oidc_runtime_factory import (
    OidcRuntimeConfig, OidcRuntimeRejected, build_oidc_session_coordinator,
)
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.fastapi_app import mount_frontend
from pathlib import Path
from apps.api.anvil_api.routes.agent_console import create_agent_console_app


def _oidc_host_origin(
    value: object, *, allow_path: bool = False,
) -> tuple[str, str, int | None] | None:
    if (not isinstance(value, str) or value != value.strip()
            or not all(32 < ord(char) < 127 for char in value)):
        return None
    try:
        parts = urlsplit(value)
        if (parts.scheme != "https" or not parts.hostname or parts.username is not None
                or parts.password is not None or parts.query or parts.fragment
                or (not allow_path and parts.path not in {"", "/"})
                or parts.netloc.endswith(":")):
            return None
        return parts.scheme, parts.hostname, parts.port
    except ValueError:
        return None


def _oidc_same_database(engine: object, session_factory: object) -> bool:
    if not isinstance(engine, Engine) or not callable(session_factory):
        return False
    try:
        session = session_factory()
        if not isinstance(session, Session):
            return False
        try:
            return session.get_bind() is engine
        finally:
            session.close()
    except Exception:
        return False


def create_configured_oidc_asgi_app(
    *,
    environment: Mapping[str, str],
    engine: Engine,
    session_factory: Callable,
    authorization_resolver: AuthorizationResolver,
    principal_policy: OidcPrincipalPolicy,
    pinned_jwks_json: str,
    client_secret: Callable[[], str] | None = None,
    ca_bundle: str | None = None,
    transport: httpx.BaseTransport | None = None,
    operational_shell: bool = False,
    frontend_directory: Path | None = None,
) -> FastAPI:
    """Assemble nonsecret server settings before binding trusted OIDC material."""
    allowed = {
        "ANVIL_OIDC_ISSUER", "ANVIL_OIDC_CLIENT_ID", "ANVIL_OIDC_STEP_UP_ACR",
    }
    if (not isinstance(environment, Mapping)
            or any(isinstance(name, str) and name.startswith("ANVIL_OIDC_")
                   and name not in allowed for name in environment)):
        raise OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")
    values = [environment.get(name) for name in (
        "ANVIL_OIDC_ISSUER", "ANVIL_OIDC_CLIENT_ID", "ANVIL_OIDC_STEP_UP_ACR",
    )]
    if any(type(value) is not str or not value
           or value != value.strip() or not all(32 < ord(char) < 127 for char in value)
           for value in values):
        raise OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")
    console = environment.get("ANVIL_CONSOLE_BASE_URL")
    if _oidc_host_origin(console) is None:
        raise OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")
    config = OidcRuntimeConfig(
        issuer=values[0], client_id=values[1],
        redirect_uri=console.rstrip("/") + "/auth/oidc/callback",
        jwks_json=pinned_jwks_json, step_up_acr=values[2],
        principal_policy=principal_policy, ca_bundle=ca_bundle,
        client_secret=client_secret,
    )
    return create_oidc_asgi_app(
        oidc_config=config, engine=engine, session_factory=session_factory,
        authorization_resolver=authorization_resolver, environment=environment,
        transport=transport, operational_shell=operational_shell,
        frontend_directory=frontend_directory,
    )


def create_oidc_asgi_app(
    *,
    oidc_config: OidcRuntimeConfig,
    engine: Engine,
    session_factory: Callable,
    authorization_resolver: AuthorizationResolver,
    environment: Mapping[str, str],
    transport: httpx.BaseTransport | None = None,
    operational_shell: bool = False,
    frontend_directory: Path | None = None,
) -> FastAPI:
    """Bind trusted OIDC inputs to one coordinator before exposing host routes."""
    if not isinstance(environment, Mapping):
        raise OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")
    console = environment.get("ANVIL_CONSOLE_BASE_URL")
    redirect = oidc_config.redirect_uri if isinstance(oidc_config, OidcRuntimeConfig) else None
    console_origin = _oidc_host_origin(console)
    redirect_origin = _oidc_host_origin(redirect, allow_path=True)
    if (environment.get("ANVIL_AUTH_MODE") != "OIDC"
            or console_origin is None or redirect_origin is None
            or console_origin != redirect_origin
            or environment.get("ANVIL_PUBLIC_HOST") != redirect_origin[1]
            or any(name.startswith("ANVIL_TEST_SESSION_") for name in environment)
            or not _oidc_same_database(engine, session_factory)):
        raise OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")
    coordinator = build_oidc_session_coordinator(
        oidc_config, session_factory, transport=transport,
    )
    runtime = create_runtime_app(
        environment=environment, session_factory=session_factory, engine=engine,
        oidc_session_coordinator=coordinator,
        authorization_resolver=authorization_resolver,
    )
    return create_asgi_app(
        runtime, operational_shell=operational_shell, frontend_directory=frontend_directory,
        required_migration_head="0019_oidc_sessions",
    )

def create_asgi_app(
    app: FastAPI, *, operational_shell: bool = False, frontend_directory: Path | None = None,
    required_migration_head: str | None = None,
) -> FastAPI:
    # The injected legacy seam preserves historical C-21 regression contracts.
    # F-15 operational hosting requires the F-14 migration head.
    if required_migration_head is None:
        required_migration_head = (
            "0016_operations_recovery" if operational_shell else "0013_task_bootstrap_authority"
        )
    if operational_shell or required_migration_head == "0019_oidc_sessions":
        # Runtime's historical 0013 declaration is not the operational contract.
        # Readiness still checks the independent database alembic_version below.
        app.state.migration_head = required_migration_head

    @app.get("/health/live", include_in_schema=False)
    async def liveness() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", include_in_schema=False)
    async def readiness() -> Response:
        engine = getattr(app.state, "database_engine", None)
        expected_head = getattr(app.state, "migration_head", None)
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                current_head = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one_or_none()
        except Exception:
            return Response('{"status":"not_ready","reason":"database_unavailable"}', status_code=503, media_type="application/json")
        if expected_head != required_migration_head or current_head != required_migration_head:
            return Response('{"status":"not_ready","reason":"migration_head_mismatch"}', status_code=503, media_type="application/json")
        if not getattr(app.state, "runtime_database_configured", False) or not getattr(app.state, "provider_catalog", None):
            return Response('{"status":"not_ready","reason":"runtime_refs_missing"}', status_code=503, media_type="application/json")
        return Response(
            '{"status":"ready","migration_head":"' + required_migration_head + '"}',
            media_type="application/json",
        )

    if operational_shell:
        app.add_api_route("/api/health/ready", readiness, methods=["GET"], include_in_schema=False)

    # Reuse the console's already-prefixed routes without a second mount prefix.
    # The factory owns authenticated typed restore (or the explicit legacy seam).
    # Missing host auth/export retains 503; configuration is not formal readiness.
    app.router.routes.extend(create_agent_console_app(
        runtime_owner=getattr(app.state, "agent_console_runtime", None),
    ).router.routes)

    # Mount only after every explicit API route so StaticFiles cannot shadow APIs.
    web_root = Path(__file__).resolve().parents[3] / "apps" / "web"
    if operational_shell:
        bundle = frontend_directory if frontend_directory is not None else web_root / "dist"
        if (bundle / "index.html").is_file():
            mount_frontend(app, str(bundle), fixture_enabled=False)
    else:
        mount_frontend(
            app,
            str(web_root),
            fixture_enabled=os.environ.get("ANVIL_FIXTURE_WORKBENCH_ENABLED") == "true",
        )
    return app


if os.environ.get("ANVIL_AUTH_MODE") == "OIDC":
    from apps.api.anvil_api.oidc_process import create_oidc_process_app

    app = create_oidc_process_app(os.environ, create_configured_oidc_asgi_app)
else:
    app = create_asgi_app(
        create_runtime_app(), operational_shell=os.environ.get("ANVIL_F15_OPERATIONAL_SHELL") == "1"
    )

__all__ = ["app"]
