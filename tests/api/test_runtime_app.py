from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from packages.api.runtime import RuntimeConfigurationError, create_runtime_app
from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import AuthorizationScope
from packages.api.sse import PostgresEventStream
from packages.api.sse import InMemoryEventJournal, StreamEvent


def _env() -> dict[str, str]:
    return {
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "telegram-secret",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "internal-secret",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil.sinsan.kr",
        "ANVIL_PUBLIC_HOST": "anvil.sinsan.kr",
        "UPSTAGE_API_KEY": "redacted-test-presence",
    }


def _wsl_acceptance_env() -> dict[str, str]:
    env = _env()
    env.update(
        {
            "ANVIL_AUTH_MODE": "WSL_ACCEPTANCE",
            "ANVIL_RUNTIME_ENVIRONMENT": "WSL_SERVER_TEST_STAGING",
            "ANVIL_CONSOLE_BASE_URL": "http://172.27.253.53:3770",
            "ANVIL_PUBLIC_HOST": "172.27.253.53",
            "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN": "wsl-acceptance-bootstrap-token-at-least-32-bytes",
            "ANVIL_TEST_SESSION_ACTOR_ID": "ignored-cookie-actor",
            "ANVIL_TEST_SESSION_PROJECT_ID": "project-c21",
            "ANVIL_TEST_SESSION_ENVIRONMENT_ID": "wsl-test-staging",
            "ANVIL_TEST_SESSION_RUN_IDS": "run-c21",
        }
    )
    return env


class _FakeSession:
    pass


def test_runtime_app_requires_database_and_telegram_references() -> None:
    with pytest.raises(RuntimeConfigurationError, match="ANVIL_DATABASE_URL"):
        create_runtime_app(environment={})
    env = _env()
    env.pop("TELEGRAM_WEBHOOK_SECRET")
    with pytest.raises(RuntimeConfigurationError, match="TELEGRAM_WEBHOOK_SECRET"):
        create_runtime_app(environment=env, session_factory=lambda: _FakeSession())


def test_runtime_app_injects_durable_session_store_and_preserves_provider_metadata() -> None:
    env = _env()
    app = create_runtime_app(environment=env, session_factory=lambda: _FakeSession())
    assert app.state.primary_provider == "UPSTAGE"
    assert all(not entry.credential_key.endswith("redacted-test-presence") for entry in app.state.provider_catalog)
    assert app.state.runtime_database_configured is True
    assert any(route.path == "/integrations/telegram/webhook" for route in app.routes)
    assert isinstance(app.state.event_stream, PostgresEventStream)


def test_runtime_app_rejects_non_callable_session_factory() -> None:
    with pytest.raises(RuntimeConfigurationError, match="session factory"):
        create_runtime_app(environment=_env(), session_factory=object())  # type: ignore[arg-type]


def test_runtime_app_allows_public_host_and_console_origin_without_relaxing_defaults() -> None:
    app = create_runtime_app(environment=_env(), session_factory=lambda: _FakeSession())
    client = TestClient(app)

    host_allowed = client.get("/api/providers", headers={"host": "anvil.sinsan.kr"})
    local_default_still_allowed = client.get("/api/providers", headers={"host": "anvil.local"})
    preflight_allowed = client.options(
        "/api/providers",
        headers={
            "host": "anvil.sinsan.kr",
            "origin": "https://anvil.sinsan.kr",
            "access-control-request-method": "GET",
        },
    )

    assert host_allowed.status_code == 401
    assert local_default_still_allowed.status_code == 401
    assert preflight_allowed.status_code == 204
    assert preflight_allowed.headers["access-control-allow-origin"] == "https://anvil.sinsan.kr"
    assert preflight_allowed.headers["access-control-allow-credentials"] == "true"


def test_runtime_app_binds_provider_reads_without_exposing_credential_values() -> None:
    """Leaving production Provider queries unbound or reflecting a secret must fail."""
    principal = SessionPrincipal(
        "tester-1", "tester", "unused", frozenset({"provider:read"}),
        frozenset({"project-1"}), frozenset({"env-local"}),
    )
    app = create_runtime_app(
        environment=_env(),
        session_factory=lambda: _FakeSession(),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _params: AuthorizationScope(
            "project-1", "env-local", frozenset({"tester"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.sinsan.kr")
    client.cookies.set("anvil_session", "session")

    response = client.get("/api/providers/upstage", headers={"host": "anvil.sinsan.kr"})

    assert response.status_code == 200
    assert response.json()["data"]["credential_status"] == "REGISTERED"
    assert "redacted-test-presence" not in response.text


def test_wsl_acceptance_mode_uses_one_server_trusted_read_only_principal() -> None:
    journal = InMemoryEventJournal(
        (StreamEvent("evt-1", "run-c21", 1, "RUN_CREATED", {}),)
    )
    app = create_runtime_app(
        environment=_wsl_acceptance_env(),
        session_factory=lambda: _FakeSession(),
        event_stream=journal,
    )
    with TestClient(app, base_url="http://172.27.253.53:3770") as client:
        status = client.get(
            "/auth/session/status?actor_role=owner&token=hostile",
            headers={"host": "172.27.253.53", "x-actor-id": "hostile"},
        )
        assert status.status_code == 200
        assert status.json() == {
            "authenticated": True,
            "mode": "WSL_ACCEPTANCE",
            "actor_role": "wsl_acceptance_reader",
        }
        assert all(
            word not in status.text.lower() for word in ("secret", "scope", "token")
        )

        providers = client.get("/api/providers", headers={"host": "172.27.253.53"})
        assert providers.status_code == 200

        denied_run = client.get(
            "/api/runs/run-other/events", headers={"host": "172.27.253.53"}
        )
        assert denied_run.status_code == 403
        assert denied_run.json()["error"]["code"] == "AUTHORIZATION_SCOPE_UNRESOLVED"

        mutation = client.post(
            "/api/providers/upstage:configure",
            headers={"host": "172.27.253.53"},
            json={},
        )
        assert mutation.status_code == 401
        assert mutation.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

        allowed_run = client.get(
            "/api/runs/run-c21/events?actor=owner&token=hostile",
            headers={"host": "172.27.253.53", "x-actor-role": "owner"},
        )
        assert allowed_run.status_code == 200


@pytest.mark.parametrize(
    "runtime_environment",
    ("PRODUCTION", "ORACLE_CLOUD_ACCEPTANCE", "", "WSL_SERVER_TEST_STAGING "),
)
def test_wsl_acceptance_mode_fails_startup_outside_exact_wsl_runtime(
    runtime_environment: str,
) -> None:
    env = _wsl_acceptance_env()
    env["ANVIL_RUNTIME_ENVIRONMENT"] = runtime_environment

    with pytest.raises(RuntimeConfigurationError, match="WSL_SERVER_TEST_STAGING"):
        create_runtime_app(environment=env, session_factory=lambda: _FakeSession())


@pytest.mark.parametrize(
    ("public_host", "console_base_url"),
    (
        ("anvil.sinsan.kr", "https://anvil.sinsan.kr"),
        ("172.27.253.53", "https://anvil.sinsan.kr"),
        ("wsl-server", "http://wsl-server:3770"),
    ),
)
def test_wsl_acceptance_mode_rejects_public_mismatched_or_dns_authority(
    public_host: str, console_base_url: str
) -> None:
    env = _wsl_acceptance_env()
    env["ANVIL_PUBLIC_HOST"] = public_host
    env["ANVIL_CONSOLE_BASE_URL"] = console_base_url

    with pytest.raises(RuntimeConfigurationError, match="private or loopback"):
        create_runtime_app(environment=env, session_factory=lambda: _FakeSession())


def test_default_auth_mode_preserves_cookie_authentication() -> None:
    app = create_runtime_app(environment=_env(), session_factory=lambda: _FakeSession())
    with TestClient(app, base_url="https://anvil.sinsan.kr") as client:
        status = client.get(
            "/auth/session/status", headers={"host": "anvil.sinsan.kr"}
        )
        providers = client.get(
            "/api/providers", headers={"host": "anvil.sinsan.kr"}
        )

        assert status.json() == {
            "authenticated": False,
            "mode": "COOKIE",
            "actor_role": None,
        }
        assert providers.status_code == 401
        assert providers.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
