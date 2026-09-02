"""ASGI entrypoint for the internal runtime; secrets stay in process env."""
from fastapi import Response
from sqlalchemy import text
from fastapi import FastAPI
from packages.api.runtime import create_runtime_app
from packages.api.fastapi_app import mount_frontend
from pathlib import Path

def create_asgi_app(app: FastAPI) -> FastAPI:
    @app.get("/health/live", include_in_schema=False)
    async def liveness() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", include_in_schema=False)
    async def readiness() -> Response:
        engine = getattr(app.state, "database_engine", None)
        expected_head = getattr(app.state, "migration_head", "0012_run_authority")
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                current_head = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one_or_none()
        except Exception:
            return Response('{"status":"not_ready","reason":"database_unavailable"}', status_code=503, media_type="application/json")
        if current_head != expected_head:
            return Response('{"status":"not_ready","reason":"migration_head_mismatch"}', status_code=503, media_type="application/json")
        if not getattr(app.state, "runtime_database_configured", False) or not getattr(app.state, "provider_catalog", None):
            return Response('{"status":"not_ready","reason":"runtime_refs_missing"}', status_code=503, media_type="application/json")
        return Response(
            '{"status":"ready","migration_head":"0012_run_authority"}',
            media_type="application/json",
        )

    # Mount only after every explicit API route so StaticFiles cannot shadow health.
    mount_frontend(app, str(Path(__file__).resolve().parents[3] / "apps" / "web"))
    return app


app = create_asgi_app(create_runtime_app())

__all__ = ["app"]
