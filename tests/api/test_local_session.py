from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier, Lock
from time import sleep

from fastapi.testclient import TestClient
import pytest

from packages.api.common import ApiContractError
from packages.api.runtime import RuntimeConfigurationError, create_runtime_app
from packages.api.sse import InMemoryEventJournal, StreamEvent


BOOTSTRAP_TOKEN = "c21-test-bootstrap-token-that-is-at-least-32-bytes"


class _FakeSession:
    pass


def _environment() -> dict[str, str]:
    return {
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
        "TELEGRAM_WEBHOOK_SECRET": "telegram-secret",
        "TELEGRAM_INTERNAL_SIGNING_SECRET": "internal-secret",
        "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil.sinsan.kr",
        "ANVIL_PUBLIC_HOST": "anvil.sinsan.kr",
        "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN": BOOTSTRAP_TOKEN,
        "ANVIL_TEST_SESSION_ACTOR_ID": "c21-tester",
        "ANVIL_TEST_SESSION_PROJECT_ID": "project-c21",
        "ANVIL_TEST_SESSION_ENVIRONMENT_ID": "ysna-validation",
        "ANVIL_TEST_SESSION_RUN_IDS": "run-c21",
        "ANVIL_TEST_SESSION_TTL_SECONDS": "900",
    }


def _journal() -> InMemoryEventJournal:
    return InMemoryEventJournal(
        (
            StreamEvent("evt-c21-1", "run-c21", 1, "RUN_CREATED", {"version": 1}),
            StreamEvent("evt-c21-2", "run-c21", 2, "RUN_STARTED", {"version": 2}),
            StreamEvent("evt-other-1", "run-other", 1, "RUN_CREATED", {"version": 1}),
        )
    )


def _client(*, journal: InMemoryEventJournal | None = None) -> TestClient:
    app = create_runtime_app(
        environment=_environment(),
        session_factory=lambda: _FakeSession(),
        event_stream=journal or _journal(),
    )
    return TestClient(app, base_url="https://anvil.sinsan.kr")


def _issue(client: TestClient, credential: str = BOOTSTRAP_TOKEN):
    return client.post(
        "/auth/session",
        headers={
            "host": "anvil.sinsan.kr",
            "origin": "https://anvil.sinsan.kr",
            "authorization": f"Bearer {credential}",
        },
    )


def _event_ids(body: str) -> list[str]:
    return [line[4:] for line in body.splitlines() if line.startswith("id: ")]


def test_runtime_issues_short_lived_opaque_cookie_then_resumes_sse() -> None:
    """Missing issuance or wiring the bootstrap credential directly as the cookie must fail."""
    journal = _journal()
    client = _client(journal=journal)

    issued = _issue(client)

    assert issued.status_code == 201
    assert issued.json()["data"]["expires_in"] == 900
    assert issued.json()["data"]["csrf_token"]
    assert BOOTSTRAP_TOKEN not in issued.text
    cookie = issued.headers["set-cookie"]
    assert "anvil_session=" in cookie
    assert BOOTSTRAP_TOKEN not in cookie
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie
    assert "Max-Age=900" in cookie

    initial = client.get(
        "/api/runs/run-c21/events",
        headers={"host": "anvil.sinsan.kr"},
    )
    resumed = client.get(
        "/api/runs/run-c21/events",
        headers={"host": "anvil.sinsan.kr", "last-event-id": "evt-c21-1"},
    )

    assert initial.status_code == 200
    assert _event_ids(initial.text) == ["evt-c21-1", "evt-c21-2"]
    assert resumed.status_code == 200
    assert _event_ids(resumed.text) == ["evt-c21-2"]
    assert journal.run_creation_count == 0


@pytest.mark.parametrize(
    "headers",
    [
        {"host": "evil.invalid", "origin": "https://anvil.sinsan.kr"},
        {"host": "anvil.sinsan.kr", "origin": "https://evil.invalid"},
    ],
)
def test_session_issuance_rejects_wrong_host_or_origin_without_cookie(
    headers: dict[str, str],
) -> None:
    """Relaxing either pre-authentication same-origin check must fail closed."""
    client = _client()
    response = client.post(
        "/auth/session",
        headers={**headers, "authorization": f"Bearer {BOOTSTRAP_TOKEN}"},
    )

    assert response.status_code == 403
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    "host, origin",
    (
        ("anvil.local", "https://anvil.sinsan.kr"),
        ("anvil.sinsan.kr:9999", "https://anvil.sinsan.kr"),
    ),
)
def test_session_issuance_rejects_individually_allowed_but_crossed_host_and_origin(
    host: str,
    origin: str,
) -> None:
    """Checking two independent allowlists instead of actual same-origin must fail."""
    client = _client()

    response = client.post(
        "/auth/session",
        headers={
            "host": host,
            "origin": origin,
            "authorization": f"Bearer {BOOTSTRAP_TOKEN}",
        },
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_VALIDATION_FAILED"
    assert "set-cookie" not in response.headers


def test_session_issuance_rejects_bad_bootstrap_credential_without_reflection() -> None:
    """Accepting or reflecting a wrong bootstrap credential must fail."""
    client = _client()
    hostile = "wrong-secret-must-not-be-reflected"

    response = _issue(client, hostile)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert hostile not in response.text
    assert "set-cookie" not in response.headers


def test_authenticated_session_cannot_read_a_run_outside_the_explicit_allowlist() -> None:
    """Replacing run-specific authorization with a blanket project grant must fail."""
    journal = _journal()
    client = _client(journal=journal)
    assert _issue(client).status_code == 201

    response = client.get(
        "/api/runs/run-other/events",
        headers={"host": "anvil.sinsan.kr"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "AUTHORIZATION_SCOPE_UNRESOLVED"
    assert journal.read_count == 0


@pytest.mark.parametrize(
    "origin",
    ("https://evil.invalid", "https://anvil.local"),
)
def test_authenticated_sse_rejects_cross_origin_requests(origin: str) -> None:
    """A cookie-authenticated SSE response must not cross an Origin boundary."""
    client = _client()
    assert _issue(client).status_code == 201

    response = client.get(
        "/api/runs/run-c21/events",
        headers={"host": "anvil.sinsan.kr", "origin": origin},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_VALIDATION_FAILED"


def test_partial_or_weak_test_session_configuration_fails_before_route_exposure() -> None:
    """Silently enabling a partial or weak bootstrap configuration must fail startup."""
    partial = _environment()
    partial.pop("ANVIL_TEST_SESSION_RUN_IDS")
    with pytest.raises(RuntimeConfigurationError, match="ANVIL_TEST_SESSION_RUN_IDS"):
        create_runtime_app(environment=partial, session_factory=lambda: _FakeSession())

    weak = _environment()
    weak["ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN"] = "too-short"
    with pytest.raises(RuntimeConfigurationError, match="32"):
        create_runtime_app(environment=weak, session_factory=lambda: _FakeSession())


def test_test_session_route_is_absent_when_not_explicitly_configured() -> None:
    """A local test login surface appearing by default must fail this boundary."""
    environment = _environment()
    for name in tuple(environment):
        if name.startswith("ANVIL_TEST_SESSION_"):
            environment.pop(name)
    app = create_runtime_app(environment=environment, session_factory=lambda: _FakeSession())
    client = TestClient(app, base_url="https://anvil.sinsan.kr")

    response = client.post(
        "/auth/session",
        headers={
            "host": "anvil.sinsan.kr",
            "origin": "https://anvil.sinsan.kr",
            "authorization": f"Bearer {BOOTSTRAP_TOKEN}",
        },
    )

    assert response.status_code == 404


def test_expired_session_is_rejected_and_failed_login_attempts_are_rate_limited() -> None:
    """Removing expiry or the authentication attempt limit must fail."""
    from packages.api.local_session import LocalTestSessionConfig, LocalTestSessionService

    current = datetime(2026, 9, 2, tzinfo=timezone.utc)
    config = LocalTestSessionConfig(
        bootstrap_token=BOOTSTRAP_TOKEN,
        actor_id="c21-tester",
        project_id="project-c21",
        environment_id="ysna-validation",
        run_ids=frozenset({"run-c21"}),
        ttl_seconds=60,
        max_failed_attempts=2,
        failed_attempt_window_seconds=60,
    )
    service = LocalTestSessionService(
        config,
        clock=lambda: current,
        token_factory=iter(("s" * 43, "c" * 43)).__next__,
    )
    with pytest.raises(ApiContractError) as malformed:
        service.issue("잘못된-자격증명", client_key="client-malformed")
    assert malformed.value.status_code == 401

    issued = service.issue(BOOTSTRAP_TOKEN, client_key="client-1")
    assert service.authenticate(issued.session_token) is not None

    current += timedelta(seconds=61)
    assert service.authenticate(issued.session_token) is None

    with pytest.raises(ApiContractError) as first:
        service.issue("wrong-1", client_key="client-2")
    assert first.value.status_code == 401
    with pytest.raises(ApiContractError) as second:
        service.issue("wrong-2", client_key="client-2")
    assert second.value.status_code == 401
    with pytest.raises(ApiContractError) as limited:
        service.issue(BOOTSTRAP_TOKEN, client_key="client-2")
    assert limited.value.status_code == 429


def test_session_state_access_is_serialized_across_concurrent_issuance() -> None:
    """Concurrent issuers entering mutable session state together must fail."""
    from packages.api.local_session import LocalTestSessionConfig, LocalTestSessionService

    tracker_lock = Lock()
    start = Barrier(2)
    active = 0
    maximum_active = 0
    sequence = 0

    def token_factory() -> str:
        nonlocal active, maximum_active, sequence
        with tracker_lock:
            active += 1
            maximum_active = max(maximum_active, active)
            sequence += 1
            token = f"{sequence:04d}" + "x" * 39
        sleep(0.05)
        with tracker_lock:
            active -= 1
        return token

    service = LocalTestSessionService(
        LocalTestSessionConfig(
            bootstrap_token=BOOTSTRAP_TOKEN,
            actor_id="c21-tester",
            project_id="project-c21",
            environment_id="ysna-validation",
            run_ids=frozenset({"run-c21"}),
        ),
        token_factory=token_factory,
    )

    def issue(client_key: str):
        start.wait()
        return service.issue(BOOTSTRAP_TOKEN, client_key=client_key)

    with ThreadPoolExecutor(max_workers=2) as executor:
        issued = list(executor.map(issue, ("client-1", "client-2")))

    assert maximum_active == 1
    assert sum(service.authenticate(value.session_token) is not None for value in issued) == 1
