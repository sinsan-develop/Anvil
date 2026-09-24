"""F-15 operational shell boundary; historical injected ASGI tests remain separate."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _synthetic_runtime_environment(monkeypatch):
    for name, value in {
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "synthetic-webhook",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil.local",
        "ANVIL_PUBLIC_HOST": "anvil.local",
    }.items():
        monkeypatch.setenv(name, value)


class _Rows:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _Connection:
    def __init__(self, head):
        self.head = head

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, statement):
        return _Rows(self.head if "alembic_version" in str(statement) else 1)


class _Engine:
    def __init__(self, head):
        self.head = head

    def connect(self):
        return _Connection(self.head)


def test_operational_readiness_requires_0016_and_bff_alias(monkeypatch):
    from apps.api.anvil_api.asgi import create_asgi_app

    app = FastAPI()
    app.state.database_engine = _Engine("0016_operations_recovery")
    app.state.migration_head = "0016_operations_recovery"
    app.state.runtime_database_configured = True
    app.state.provider_catalog = object()
    client = TestClient(create_asgi_app(app, operational_shell=True))

    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "migration_head": "0016_operations_recovery"}


def test_operational_readiness_rejects_old_or_missing_database_head():
    from apps.api.anvil_api.asgi import create_asgi_app

    for head in ("0013_task_bootstrap_authority", None):
        app = FastAPI()
        app.state.database_engine = _Engine(head)
        app.state.migration_head = "0016_operations_recovery"
        app.state.runtime_database_configured = True
        app.state.provider_catalog = object()
        response = TestClient(create_asgi_app(app, operational_shell=True)).get("/api/health/ready")
        assert response.status_code == 503
        assert response.json()["reason"] == "migration_head_mismatch"


def test_operational_host_rebinds_legacy_runtime_declared_head_not_database_fact():
    from apps.api.anvil_api.asgi import create_asgi_app

    app = FastAPI()
    app.state.database_engine = _Engine("0016_operations_recovery")
    app.state.migration_head = "0013_task_bootstrap_authority"
    app.state.runtime_database_configured = True
    app.state.provider_catalog = object()
    response = TestClient(create_asgi_app(app, operational_shell=True)).get("/api/health/ready")
    assert response.status_code == 200
    assert response.json()["migration_head"] == "0016_operations_recovery"


def test_operational_frontend_serves_built_bundle_not_legacy_shell(tmp_path):
    from apps.api.anvil_api.asgi import create_asgi_app

    (tmp_path / "index.html").write_text("<html>F15-REACT-BUNDLE</html>", encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("const f15 = true;", encoding="utf-8")
    client = TestClient(create_asgi_app(FastAPI(), operational_shell=True, frontend_directory=tmp_path))

    assert "F15-REACT-BUNDLE" in client.get("/").text
    assert "const f15 = true" in client.get("/assets/app.js").text
    assert client.get("/fixture-workbench").status_code == 404


def test_operational_frontend_missing_build_fails_closed_not_legacy(tmp_path):
    from apps.api.anvil_api.asgi import create_asgi_app

    client = TestClient(create_asgi_app(FastAPI(), operational_shell=True, frontend_directory=tmp_path))
    assert client.get("/").status_code == 404


def test_worker_probe_reports_only_process_database_contract():
    from apps.worker.anvil_worker.main import probe_worker_database

    assert probe_worker_database(_Engine("0016_operations_recovery")) == {
        "component": "worker_process", "status": "ready", "migration_head": "0016_operations_recovery",
    }
    for head in ("0013_task_bootstrap_authority", None):
        assert probe_worker_database(_Engine(head)) == {
            "component": "worker_process", "status": "not_ready", "reason": "migration_head_mismatch",
        }


def test_worker_probe_masks_database_failure():
    from apps.worker.anvil_worker.main import probe_worker_database

    class BrokenEngine:
        def connect(self):
            raise RuntimeError("synthetic-credential-must-not-leak")

    result = probe_worker_database(BrokenEngine())
    assert result == {"component": "worker_process", "status": "not_ready", "reason": "database_unavailable"}


def test_local_compose_is_loopback_web_only_and_external_database():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    compose = (root / "docker-compose.local.yml").read_text(encoding="utf-8")
    assert '"127.0.0.1:8300:8080"' in compose
    assert compose.count('ANVIL_DATABASE_URL: "${ANVIL_F15_QA_DATABASE_URL:?required}"') == 2
    assert 'ANVIL_F15_OPERATIONAL_SHELL: "1"' in compose
    assert "network_mode: host" not in compose
    assert "anvil-db:" not in compose
    assert compose.count('"host.docker.internal:host-gateway"') == 2
    nginx = (root / "deploy/local/nginx.conf").read_text(encoding="utf-8")
    assert "proxy_pass http://anvil-api:8301" in nginx
    assert "location /api/" in nginx


def test_nginx_web_stage_runs_as_unprivileged_image_owner_for_read_only_compose():
    from pathlib import Path

    dockerfile = (
        Path(__file__).resolve().parents[2] / "deploy/local/Dockerfile.runtime"
    ).read_text(encoding="utf-8")
    web_stage = dockerfile.split("FROM nginx@", 1)[1].split("FROM python:", 1)[0]
    assert "USER 101:101" in web_stage
    assert web_stage.index("USER 101:101") > web_stage.index("COPY --from=web-build")
