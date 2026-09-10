"""실행 API의 입력 검증과 의존성 실패 차단 계약."""
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
import importlib

import pytest

from packages.api.common import ApiContractError, ApplicationRequest, SessionPrincipal
from packages.api.registry import canonical_api_registry
from packages.budget.models import BudgetReservation, ReservationStatus
from packages.llm_gateway import DeterministicFakeAdapter, NativeAgentAdapter


KEY = "POST /api/runs/{id}/steps/{stepId}:execute"


def constructor():
    module = importlib.import_module("packages.api.step_execution")
    return module.SqlAlchemyStepExecutionPort


def request(**changes):
    body = dict(requestId="request-1", reservationId="reservation-1", budgetId="budget-1",
                backend="LOCAL", provider="LOCAL", model="m", pricingVersion="test-v1",
                forecastCost="1.00000000", forecastTokens=100, prompt="private prompt",
                expectedStateVersion=2, reason="승인된 실행")
    body.update(changes)
    return ApplicationRequest(KEY, "run-1", {"id": "run-1", "stepId": "step-1"}, body,
                              {"idempotency-key": "key-1"},
                              SessionPrincipal("owner", "owner", "csrf", frozenset({"run:execute"}),
                                               frozenset({"p"}), frozenset({"e"})),
                              "correlation-1", 2, "sha256:" + "a" * 64, "승인된 실행", "p", "e")


def test_execute_has_its_own_run_permission():
    assert canonical_api_registry().by_key(KEY).permission == "run:execute"


def test_execute_dependencies_fail_closed():
    port_type = constructor()
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    for sessions, adapters in ((None, {"LOCAL": adapter}), (lambda: None, {}),
                               (lambda: None, {"LOCAL": object()})):
        with pytest.raises(ValueError):
            port_type(sessions, adapters)


@pytest.mark.parametrize("changes", [
    {"forecastCost": "NaN"}, {"forecastCost": "Infinity"}, {"forecastCost": "-1"},
    {"forecastTokens": True}, {"forecastTokens": -1}, {"unexpected": "value"},
    {"prompt": ""}, {"backend": "REMOTE"}, {"requestId": "x" * 129},
])
def test_invalid_input_never_opens_a_database_session(changes):
    def sessions():
        pytest.fail("검증되지 않은 입력이 DB에 도달함")
    port = constructor()(sessions, {"LOCAL": NativeAgentAdapter(DeterministicFakeAdapter())})
    with pytest.raises(ApiContractError) as caught:
        port(request(**changes))
    assert caught.value.status_code == 400


def test_unconfigured_backend_never_opens_a_database_session():
    def sessions():
        pytest.fail("구성되지 않은 backend가 DB에 도달함")
    port = constructor()(sessions, {"LOCAL": NativeAgentAdapter(DeterministicFakeAdapter())})
    with pytest.raises(ApiContractError) as caught:
        port(request(backend="CODEX"))
    assert caught.value.status_code == 501


@pytest.mark.parametrize("status", list(ReservationStatus))
def test_existing_reservation_under_a_new_http_key_never_reexecutes(monkeypatch, status):
    module = importlib.import_module("packages.api.step_execution")
    adapter = DeterministicFakeAdapter()
    existing = BudgetReservation(
        "reservation-1", "budget-1", "run-1", "step-1", "request-1",
        "LOCAL", "m", "test-v1", Decimal("1.00000000"), 100, status=status,
    )

    class ExistingReservationRepository:
        def __init__(self, _session):
            pass

        def lock_execution_identity(self, _request):
            return (existing,)

        def reserve(self, _request):
            return existing

        def reconcile(self, _receipt):
            return None

    class FakeResult:
        def scalar_one(self):
            return 3

    class FakeSession:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        @contextmanager
        def begin(self):
            yield

        def execute(self, *_args, **_kwargs):
            return FakeResult()

    class FakeEventWriter:
        appends = 0

        def __init__(self, _session):
            pass

        def by_key(self, _run_id, _key):
            return None

        def append(self, **arguments):
            type(self).appends += 1
            sequence = type(self).appends
            return {
                "event_id": f"event-{sequence}", "event_type": arguments["event_type"],
                "sequence_no": sequence, "created_at": datetime.now(timezone.utc),
                "actor_type": "HUMAN", "actor_id": "owner",
                "correlation_id": "request-1", "causation_event_id": arguments["causation_id"],
                "idempotency_key": arguments["key"], "payload": arguments["payload"],
            }

        @staticmethod
        def receipt(row):
            return {
                "eventId": row["event_id"], "type": row["event_type"],
                "sequence": row["sequence_no"], "timestamp": row["created_at"].isoformat(),
                "actor": {"type": row["actor_type"], "id": row["actor_id"]},
                "correlationId": row["correlation_id"], "causationId": row["causation_event_id"],
                "idempotencyKey": row["idempotency_key"],
            }

    monkeypatch.setattr(module, "SqlAlchemyInterventionBudgetRepository", ExistingReservationRepository)
    monkeypatch.setattr(module, "SqlAlchemyEventWriter", FakeEventWriter)
    monkeypatch.setattr(module.SqlAlchemyStepExecutionPort, "_authority", staticmethod(
        lambda _session, _request, _budget_request: {"version": 2, "status": "ACTIVE"}
    ))

    response = module.SqlAlchemyStepExecutionPort(
        FakeSession, {"LOCAL": NativeAgentAdapter(adapter)}
    )(request())

    assert response.status_code == 409
    assert response.body["code"] == "IDEMPOTENCY_CONFLICT"
    assert adapter.calls == 0
    assert FakeEventWriter.appends == 0
