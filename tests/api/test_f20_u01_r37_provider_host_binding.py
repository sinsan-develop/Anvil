"""R37 registration-only host wiring; no Provider network or real DB evidence."""

import json
import socket
from datetime import datetime, timezone

from fastapi import FastAPI
import pytest
import sqlalchemy as sa

from apps.api.anvil_api import oidc_process
from packages.persistence.operations_run_read import ScopedRunSource
from packages.persistence.operations_agent_owner_read import ScopedAgentOwnerSource
from tests.api.test_oidc_process import _environment, _trust
from tests.api.test_f20_u01_r10_dashboard_api import client, PATH
from tests.observability.test_f13_operations import RecordingRepository
from tests.observability.test_f20_u01_r9_queue_host import QueueSource


IDS = ("cerebras", "groq", "mistral", "openrouter", "upstage", "gemini",
       "anthropic", "openai", "ollama")
FIELDS = {"observed_at", "health", "queue", "quarantine", "worker", "budget",
          "reservations", "providers", "deployments", "source_gaps", "alerts",
          "next_actions", "run_summary"}


@pytest.fixture
def bound(tmp_path, monkeypatch):
    trust, _, _ = _trust(tmp_path)
    environment = _environment(trust)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_k: engine)
    repository = RecordingRepository()
    monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", lambda _dsn: repository)
    calls = []

    def queue(actual_engine, project, env):
        assert actual_engine is engine
        calls.append((project, env))
        return QueueSource("job-1")

    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", queue)
    at = datetime(2026, 10, 3, tzinfo=timezone.utc)
    monkeypatch.setattr(oidc_process, "load_scoped_run_source",
                        lambda *_a: ScopedRunSource((), at, {}))
    monkeypatch.setattr(oidc_process, "load_scoped_agent_owner_source",
                        lambda *_a: ScopedAgentOwnerSource((), at))
    captured = []

    def host(**kwargs):
        captured.append(kwargs)
        return FastAPI()

    oidc_process.create_oidc_process_app(environment, host)
    assert calls == []
    try:
        yield captured[0]["operations_owner"], environment, calls, repository
    finally:
        engine.dispose()


def assert_registration(data, configured=()):
    assert tuple(row["provider_id"] for row in data["providers"]) == IDS
    for row in data["providers"]:
        registered = row["provider_id"] in configured
        assert row == {"provider_id": row["provider_id"],
            "status": "DEGRADED" if registered else "NOT_CONFIGURED",
            "credential_status": "REGISTERED" if registered else "MISSING",
            "health_status": "NOT_CHECKED"}
    assert data["health"]["provider"]["state"] == "UNKNOWN"
    assert "provider" in data["source_gaps"]


def test_no_configuration_still_projects_nine_registration_rows(bound, monkeypatch):
    owner, _, calls, repository = bound
    monkeypatch.setattr(socket, "create_connection", lambda *_a, **_k: pytest.fail("network"))
    monkeypatch.setattr(socket, "getaddrinfo", lambda *_a, **_k: pytest.fail("DNS"))
    data = owner.snapshot()
    assert_registration(data)
    assert data["queue"][0]["job_id"] == "job-1"
    assert owner.alerts() == owner.audit() == []
    assert repository.load("project-1", "wsl-qa") == ()
    assert calls == [("project-1", "wsl-qa")]
    assert owner.run_summary().observed_total == 0
    assert owner.agent_owner_summary().observed_total == 0
    assert calls == [("project-1", "wsl-qa")]


def test_each_read_observes_registration_changes_without_secret_alias(bound):
    owner, environment, _, _ = bound
    before = owner.snapshot()
    environment.update(UPSTAGE_API_KEY="R37_SYNTHETIC_ONLY", OLLAMA_BASE_URL="http://private.invalid:11434")
    registered = owner.snapshot()
    assert_registration(registered, ("upstage", "ollama"))
    assert_registration(before)
    assert "R37_SYNTHETIC_ONLY" not in json.dumps(registered)
    assert "private.invalid" not in json.dumps(registered)
    registered["providers"][0]["status"] = "HEALTHY"
    environment.pop("UPSTAGE_API_KEY")
    environment.pop("OLLAMA_BASE_URL")
    assert_registration(owner.snapshot())


@pytest.mark.parametrize("provider", IDS)
def test_each_canonical_credential_maps_only_to_its_registration(bound, provider):
    owner, environment, _, _ = bound
    key = "OLLAMA_BASE_URL" if provider == "ollama" else provider.upper() + "_API_KEY"
    environment[key] = "R37_SYNTHETIC_PRESENCE_ONLY"
    data = owner.snapshot()
    assert_registration(data, (provider,))
    assert "R37_SYNTHETIC_PRESENCE_ONLY" not in json.dumps(data)
    environment[key] = ""
    assert_registration(owner.snapshot())


@pytest.mark.parametrize("project,environment", [("other", "wsl-qa"), ("project-1", "other"),
                                                (None, "wsl-qa"), ([], "wsl-qa")])
def test_foreign_scope_denied_before_queue_and_provider(bound, monkeypatch, project, environment):
    owner, _, calls, _ = bound
    monkeypatch.setattr(oidc_process, "ProviderStatusService",
        lambda *_a: pytest.fail("Provider constructed for invalid scope"), raising=False)
    with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
        owner._source_loader(project, environment)
    assert calls == []


def test_hostile_scope_cannot_override_equality(bound):
    owner, _, calls, _ = bound
    class Equal(str):
        def __eq__(self, other):
            pytest.fail("untrusted equality callback")
    with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
        owner._source_loader(Equal("project-1"), "wsl-qa")
    assert calls == []


def test_dashboard_keeps_exact_contract_permission_and_scope(bound):
    owner, environment, calls, _ = bound
    environment["UPSTAGE_API_KEY"] = "R37_SYNTHETIC_ONLY"
    with client(operations_owner=owner, scope=("project-1", "wsl-qa"),
                principal_scope=("project-1", "wsl-qa")) as api:
        response = api.get(PATH)
    assert response.status_code == 200
    data = response.json()["data"]
    assert set(data) == FIELDS
    assert_registration(data, ("upstage",))
    count = len(calls)
    for permissions, principal_scope in ((frozenset(), ("project-1", "wsl-qa")),
            (frozenset({"dashboard:read"}), ("other", "wsl-qa"))):
        with client(operations_owner=owner, permissions=permissions,
                    scope=("project-1", "wsl-qa"), principal_scope=principal_scope) as api:
            assert api.get(PATH).status_code == 403
    assert len(calls) == count


def test_queue_failure_remains_unavailable_not_provider_success(bound, monkeypatch):
    owner, _, _, _ = bound
    def failed(*_args):
        raise RuntimeError("R37_SYNTHETIC_SECRET")
    monkeypatch.setattr(oidc_process, "load_scoped_queue_source", failed)
    with client(operations_owner=owner, scope=("project-1", "wsl-qa"),
                principal_scope=("project-1", "wsl-qa")) as api:
        response = api.get(PATH)
    assert response.status_code == 503
    assert "R37_SYNTHETIC_SECRET" not in response.text


def test_provider_construction_failure_is_generic_unavailable(bound, monkeypatch):
    owner, _, _, _ = bound
    def failed(*_args):
        raise RuntimeError("R37_SYNTHETIC_SECRET")
    monkeypatch.setattr(oidc_process, "ProviderStatusService", failed)
    with client(operations_owner=owner, scope=("project-1", "wsl-qa"),
                principal_scope=("project-1", "wsl-qa")) as api:
        response = api.get(PATH)
    assert response.status_code == 503
    assert "R37_SYNTHETIC_SECRET" not in response.text
