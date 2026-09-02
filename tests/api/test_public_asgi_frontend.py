from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from packages.api.fastapi_app import mount_frontend


def test_public_asgi_serves_frontend_from_same_listener() -> None:
    directory = __file__.split("tests", 1)[0] + "apps/web"
    app = FastAPI()
    app.get("/health/live")(lambda: {"status": "ok"})
    mount_frontend(app, directory)

    client = TestClient(app)
    assert client.get("/health/live").json() == {"status": "ok"}
    response = client.get("/")
    assert response.status_code == 200
    assert "Anvil" in response.text
