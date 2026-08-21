from __future__ import annotations

import pytest

from packages.api.runtime import RuntimeConfigurationError, create_runtime_app


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


def test_runtime_app_rejects_non_callable_session_factory() -> None:
    with pytest.raises(RuntimeConfigurationError, match="session factory"):
        create_runtime_app(environment=_env(), session_factory=object())  # type: ignore[arg-type]
