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


def test_fresh_asgi_route_order_keeps_health_routes_ahead_of_static_mount(monkeypatch) -> None:
    env = {
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "telegram-secret",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "internal-secret",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil.sinsan.kr",
        "ANVIL_PUBLIC_HOST": "anvil.sinsan.kr",
    }
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    import importlib

    module = importlib.import_module("apps.api.anvil_api.asgi")
    app = module.app
    client = TestClient(app)

    assert client.get("/health/live").status_code == 200
    assert client.get("/health/ready").status_code != 404
    paths = [route.path for route in app.routes]
    assert paths.index("/health/live") < paths.index("")
