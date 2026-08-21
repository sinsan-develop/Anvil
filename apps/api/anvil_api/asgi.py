"""ASGI entrypoint for the internal runtime; secrets stay in process env."""
from fastapi import Response
from packages.api.runtime import create_runtime_app

app = create_runtime_app()

@app.get("/health/live", include_in_schema=False)
async def liveness() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/health/ready", include_in_schema=False)
async def readiness() -> Response:
    return Response('{"status":"ready"}', media_type="application/json")

__all__ = ["app"]
