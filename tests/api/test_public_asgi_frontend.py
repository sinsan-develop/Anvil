from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from packages.api.fastapi_app import mount_frontend


class _Connection:
    def __init__(self, migration_head: str) -> None:
        self.migration_head = migration_head

    def __enter__(self) -> "_Connection":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, statement: object):
        class _Result:
            def __init__(self, value: str | None = None) -> None:
                self.value = value

            def scalar_one_or_none(self) -> str | None:
                return self.value

        return _Result(self.migration_head if "alembic_version" in str(statement) else None)


class _Engine:
    def __init__(self, migration_head: str) -> None:
        self.migration_head = migration_head

    def connect(self) -> _Connection:
        return _Connection(self.migration_head)


def test_public_asgi_serves_frontend_from_same_listener() -> None:
    directory = __file__.split("tests", 1)[0] + "apps/web"
    app = FastAPI()
    app.get("/health/live")(lambda: {"status": "ok"})
    mount_frontend(app, directory)

    client = TestClient(app)
    assert client.get("/health/live").json() == {"status": "ok"}
    response = client.get("/")
    assert response.status_code == 200
    assert "data-production-workbench" in response.text
    assert "FIXTURE BROWSER RUNTIME" not in response.text
    fixture = client.get("/fixture-workbench.html")
    assert fixture.status_code == 200
    assert "FIXTURE BROWSER RUNTIME" in fixture.text


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


def test_readiness_requires_the_c21_0013_authority_head() -> None:
    from apps.api.anvil_api.asgi import create_asgi_app

    app = FastAPI()
    app.state.database_engine = _Engine("0013_task_bootstrap_authority")
    app.state.migration_head = "0013_task_bootstrap_authority"
    app.state.runtime_database_configured = True
    app.state.provider_catalog = object()

    response = TestClient(create_asgi_app(app)).get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "migration_head": "0013_task_bootstrap_authority",
    }


def test_readiness_rejects_a_runtime_that_still_declares_0012() -> None:
    from apps.api.anvil_api.asgi import create_asgi_app

    app = FastAPI()
    app.state.database_engine = _Engine("0012_run_authority")
    app.state.migration_head = "0012_run_authority"
    app.state.runtime_database_configured = True
    app.state.provider_catalog = object()

    response = TestClient(create_asgi_app(app)).get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "reason": "migration_head_mismatch",
    }
