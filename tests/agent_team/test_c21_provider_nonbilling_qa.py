"""C-21 credential-free Provider/MoA development QA.

These tests intentionally use recorded model metadata only.  They must never
open a provider connection or resolve a real credential value.
"""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from packages.agent_team.moa import (
    CapabilityProfile,
    CapabilityRouter,
    ProviderModelCatalog,
    ProviderModelEntry,
)
from packages.agent_team.provider_catalog import (
    PRIMARY_PROVIDER,
    PROVIDER_CREDENTIAL_KEYS,
    SUPPORTED_PROVIDERS,
    ordered_candidates,
)
from packages.agent_team.runtime_config import runtime_catalog
from packages.llm_gateway import (
    DeterministicFakeAdapter,
    GatewayRequest,
    NativeAgentAdapter,
    ProviderAdapter,
    UsageProvenance,
)
from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import AuthorizationScope, create_app


EXPECTED_PROVIDERS = (
    "CEREBRAS",
    "GROQ",
    "MISTRAL",
    "OPENROUTER",
    "UPSTAGE",
    "GEMINI",
    "ANTHROPIC",
    "OPENAI",
    "OLLAMA",
)


def _recorded_catalog() -> ProviderModelCatalog:
    entries = tuple(
        ProviderModelEntry(
            provider=provider,
            model=f"recorded-{provider.lower()}",
            capabilities=frozenset({"coding", "writing", "design"}),
            healthy=True,
            cost=0.0,
            quality=1.0 if provider == "UPSTAGE" else 0.5,
            latency=0.1,
            probe_at="2026-09-05T00:00:00+00:00",
            probe_ttl_seconds=86400,
        )
        for provider in EXPECTED_PROVIDERS
    )
    return ProviderModelCatalog(entries=entries, revision=1)


def test_canonical_nine_provider_config_is_presence_only_and_upstage_first() -> None:
    secret_sentinels = {key: f"sentinel-{index}" for index, key in enumerate(PROVIDER_CREDENTIAL_KEYS.values())}

    entries = runtime_catalog(secret_sentinels)

    assert SUPPORTED_PROVIDERS == EXPECTED_PROVIDERS
    assert tuple(entry.provider_id for entry in entries) == EXPECTED_PROVIDERS
    assert all(entry.configured for entry in entries)
    assert PRIMARY_PROVIDER == "UPSTAGE"
    assert ordered_candidates(list(reversed(EXPECTED_PROVIDERS)))[0] == "UPSTAGE"
    rendered = repr(entries)
    assert all(value not in rendered for value in secret_sentinels.values())


def test_recorded_fixture_routes_each_capability_without_provider_io(monkeypatch) -> None:
    import socket

    def deny_network(*_args, **_kwargs):
        raise AssertionError("provider QA attempted network I/O")

    monkeypatch.setattr(socket, "create_connection", deny_network)
    catalog = _recorded_catalog()
    router = CapabilityRouter()

    for capability in ("coding", "writing", "design"):
        result = router.route(
            CapabilityProfile(capability=capability, catalog_revision=1),
            catalog,
            now=datetime(2026, 9, 5, 1, tzinfo=timezone.utc),
        )
        assert result.selected.provider == "UPSTAGE"
        assert result.snapshot_hash == catalog.snapshot_hash
        assert len(result.considered) == 9


def test_runtime_provider_status_port_remains_explicitly_unavailable() -> None:
    principal = SessionPrincipal(
        "tester-1",
        "tester",
        "csrf-unused",
        frozenset({"provider:read"}),
        frozenset({"project-1"}),
        frozenset({"env-wsl"}),
    )
    app = create_app(
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _params: AuthorizationScope(
            "project-1", "env-wsl", frozenset({"tester"})
        ),
    )
    client = TestClient(app, base_url="https://anvil.local")
    client.cookies.set("anvil_session", "session")

    response = client.get("/api/providers", headers={"host": "anvil.local"})

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "CAPABILITY_NOT_AVAILABLE"


def test_provider_adapter_and_native_boundary_execute_only_the_network_denied_fake(monkeypatch) -> None:
    import socket

    def deny_network(*_args, **_kwargs):
        raise AssertionError("ProviderAdapter QA attempted network I/O")

    monkeypatch.setattr(socket, "socket", deny_network)
    monkeypatch.setattr(socket, "create_connection", deny_network)
    fake = DeterministicFakeAdapter(capabilities={"text_generation", "tool_use"})
    assert isinstance(fake, ProviderAdapter)
    native = NativeAgentAdapter(fake)

    probe = native.probe({"text_generation"})
    response = native.generate(
        GatewayRequest(
            provider="UPSTAGE",
            model="recorded-upstage",
            input_text="recorded fixture prompt",
            request_id="c21-provider-fixture-request",
        )
    )

    assert probe.supported is True
    assert response.request_id == "c21-provider-fixture-request"
    assert response.output_text == "fake:recorded fixture prompt"
    assert response.usage_provenance is UsageProvenance.PROVIDER_FINAL
    assert fake.calls == 1
