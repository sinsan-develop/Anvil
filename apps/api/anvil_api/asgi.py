"""ASGI entrypoint for the unified public runtime; secrets stay in process env."""
import os

from fastapi import Response
from sqlalchemy import text
from fastapi import FastAPI
from packages.api.runtime import create_runtime_app
from packages.api.fastapi_app import mount_frontend
from pathlib import Path
from apps.api.anvil_api.routes.agent_console import create_agent_console_app

def create_asgi_app(app: FastAPI) -> FastAPI:
    required_migration_head = "0013_task_bootstrap_authority"

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
            '{"status":"ready","migration_head":"0013_task_bootstrap_authority"}',
            media_type="application/json",
        )

    # Reuse the console's already-prefixed routes without a second mount prefix.
    # The factory owns authenticated typed restore (or the explicit legacy seam).
    # Missing host auth/export retains 503; configuration is not formal readiness.
    app.router.routes.extend(create_agent_console_app(
        runtime_owner=getattr(app.state, "agent_console_runtime", None),
    ).router.routes)

    # Mount only after every explicit API route so StaticFiles cannot shadow APIs.
    mount_frontend(
        app,
        str(Path(__file__).resolve().parents[3] / "apps" / "web"),
        fixture_enabled=os.environ.get("ANVIL_FIXTURE_WORKBENCH_ENABLED") == "true",
    )
    return app


app = create_asgi_app(create_runtime_app())

__all__ = ["app"]
