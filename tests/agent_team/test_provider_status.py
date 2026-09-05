from __future__ import annotations

import socket

import pytest

from packages.agent_team.moa import CapabilityProfile, CapabilityRouter, ProviderModelCatalog
from packages.agent_team.provider_catalog import (
    CANONICAL_PROVIDER_IDS,
    PRIMARY_PROVIDER_ID,
    provider_definitions,
)
from packages.agent_team.provider_status import ProviderStatusService


EXPECTED_IDS = (
    "cerebras",
    "groq",
    "mistral",
    "openrouter",
    "upstage",
    "gemini",
    "anthropic",
    "openai",
    "ollama",
)


def test_catalog_exposes_lowercase_ids_uppercase_labels_and_upstage_primary() -> None:
    """Uppercase IDs or a different primary provider must break the public catalog."""
    definitions = provider_definitions()

    assert CANONICAL_PROVIDER_IDS == EXPECTED_IDS
    assert tuple(item.provider_id for item in definitions) == EXPECTED_IDS
    assert tuple(item.display_name for item in definitions) == tuple(
        item.upper() for item in EXPECTED_IDS
    )
    assert PRIMARY_PROVIDER_ID == "upstage"
    assert [item.provider_id for item in definitions if item.primary] == ["upstage"]


@pytest.mark.parametrize(
    "environment,provider_id,expected",
    (
        (
            {},
            "cerebras",
            {
                "provider_id": "cerebras",
                "display_name": "CEREBRAS",
                "primary": False,
                "status": "NOT_CONFIGURED",
                "credential_status": "MISSING",
                "health_status": "NOT_CHECKED",
                "latency_ms": None,
                "last_error": None,
                "models": [],
                "moa_eligible": False,
            },
        ),
        (
            {"UPSTAGE_API_KEY": "sentinel-upstage-secret"},
            "upstage",
            {
                "provider_id": "upstage",
                "display_name": "UPSTAGE",
                "primary": True,
                "status": "DEGRADED",
                "credential_status": "REGISTERED",
                "health_status": "NOT_CHECKED",
                "latency_ms": None,
                "last_error": None,
                "models": [],
                "moa_eligible": False,
            },
        ),
    ),
)
def test_unprobed_status_is_honest_and_contains_no_secret(
    environment: dict[str, str], provider_id: str, expected: dict[str, object]
) -> None:
    """Treating credential presence as health or model eligibility must fail."""
    status = ProviderStatusService(environment).get(provider_id)

    assert status.as_public_dict() == expected
    assert all(value not in repr(status) for value in environment.values())


def test_provider_status_reads_presence_without_dns_or_socket_calls(monkeypatch) -> None:
    """Any network probe in this read-only slice must fail the test."""
    def denied(*_args, **_kwargs):
        raise AssertionError("provider status read attempted network I/O")

    monkeypatch.setattr(socket, "socket", denied)
    monkeypatch.setattr(socket, "create_connection", denied)
    monkeypatch.setattr(socket, "getaddrinfo", denied)

    statuses = ProviderStatusService({"GROQ_API_KEY": "sentinel"}).list()

    assert len(statuses) == 9
    assert sum(item.credential_status == "REGISTERED" for item in statuses) == 1
    assert all(not item.moa_eligible and item.models == () for item in statuses)


@pytest.mark.parametrize("provider_id", ("UPSTAGE", "Upstage", "unknown", " upstage"))
def test_noncanonical_provider_id_is_rejected(provider_id: str) -> None:
    """Normalizing mixed or unknown IDs would make an unintended provider addressable."""
    with pytest.raises(LookupError):
        ProviderStatusService({}).get(provider_id)


def test_unprobed_empty_model_catalog_fails_closed_for_moa() -> None:
    """Selecting a Provider from credential presence without an eligible model must fail."""
    with pytest.raises(LookupError, match="no eligible provider/model route"):
        CapabilityRouter().route(
            CapabilityProfile(capability="coding", catalog_revision=1),
            ProviderModelCatalog(entries=(), revision=1),
        )
