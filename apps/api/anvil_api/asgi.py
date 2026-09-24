"""ASGI entrypoint for the unified public runtime; secrets stay in process env."""
import os

from fastapi import Response
from sqlalchemy import text
from fastapi import FastAPI
from packages.api.runtime import create_runtime_app
from packages.api.fastapi_app import mount_frontend
from pathlib import Path
from apps.api.anvil_api.routes.agent_console import create_agent_console_app

def create_asgi_app(
    app: FastAPI, *, operational_shell: bool = False, frontend_directory: Path | None = None
) -> FastAPI:
    # The injected legacy seam preserves historical C-21 regression contracts.
    # F-15 operational hosting requires the F-14 migration head.
    required_migration_head = (
        "0016_operations_recovery" if operational_shell else "0013_task_bootstrap_authority"
    )
    if operational_shell:
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


app = create_asgi_app(
    create_runtime_app(), operational_shell=os.environ.get("ANVIL_F15_OPERATIONAL_SHELL") == "1"
)

__all__ = ["app"]
