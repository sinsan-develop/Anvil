import json
import re
from decimal import Decimal

import pytest

from packages.budget.models import BudgetLimit
from packages.llm_gateway import (
    CapabilityProbe,
    DeterministicFakeAdapter,
    GatewayRequest,
    NativeAgentAdapter,
    UsageProvenance,
)
from packages.orchestration import MainAgentKernel, StepBudget
from packages.budget.service import BudgetService
from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository


def _kernel(adapter, *, tokens=100):
    budget = BudgetService(InMemoryInterventionBudgetRepository())
    budget.create_budget(BudgetLimit("b1", Decimal("10"), tokens, 1))
    return MainAgentKernel(adapter, budget), budget


def test_gateway_request_has_identity_and_fake_response_has_final_usage():
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    result = adapter.generate(GatewayRequest(provider="UPSTAGE", model="m", input_text="hello"))
    assert result.request_id
    assert result.provider == "UPSTAGE"
    assert result.final_usage.total_tokens == 3
    assert result.usage_provenance is UsageProvenance.PROVIDER_FINAL


def test_gateway_request_default_identity_is_canonical_and_unique_per_call():
    first = GatewayRequest(provider="UPSTAGE", model="m", input_text="one")
    second = GatewayRequest(provider="UPSTAGE", model="m", input_text="two")

    assert re.fullmatch(r"request:[0-9a-f]{32}", first.request_id)
    assert re.fullmatch(r"request:[0-9a-f]{32}", second.request_id)
    assert first.request_id != second.request_id


def test_capability_probe_reports_supported_and_reason_for_unsupported():
    probe = DeterministicFakeAdapter(capabilities={"text_generation"}).probe()
    assert probe.supported is True
    assert probe.unsupported_reasons == ()
    missing = DeterministicFakeAdapter(capabilities=set()).probe(required={"tool_use"})
    assert missing.supported is False
    assert missing.capabilities == frozenset()
    assert missing.unsupported_reasons == ("missing capability: tool_use",)


def test_kernel_reserves_budget_before_call_and_reconciles_usage():
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    kernel, budget = _kernel(adapter)
    result = kernel.run_step(
        run_id="run-1", step_id="step-1", budget_id="b1", provider="UPSTAGE",
        model="m", input_text="hello", forecast_tokens=10, forecast_cost=Decimal("1"),
    )
    assert result.observation == "fake:hello"
    assert result.action == "generate"
    assert result.response.final_usage.total_tokens == 3
    assert budget.reservation("reservation:run-1:step-1").status.value == "CONSUMED"


def test_kernel_returns_ordered_secret_free_budget_and_usage_evidence():
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    budget = BudgetService(InMemoryInterventionBudgetRepository())
    budget.create_budget(BudgetLimit("b1", Decimal("10"), 100, 1))
    kernel = MainAgentKernel(
        adapter,
        budget,
        request_id_factory=lambda: "request:" + "a" * 32,
    )

    result = kernel.run_step(
        run_id="run-1", step_id="step-1", budget_id="b1", provider="UPSTAGE",
        model="m", input_text="secret-shaped prompt", forecast_tokens=10,
        forecast_cost=Decimal("1"),
    )
    evidence = [event.to_dict() for event in result.evidence]

    assert evidence == [
        {
            "sequence": 1,
            "event_type": "BUDGET_RESERVED",
            "request_id": "request:" + "a" * 32,
            "reservation_id": "reservation:run-1:step-1",
            "run_id": "run-1",
            "step_id": "step-1",
            "status": "RESERVED",
            "tokens": 10,
            "cost": "1",
            "abort_status": None,
            "usage_provenance": None,
        },
        {
            "sequence": 2,
            "event_type": "USAGE_RECONCILED",
            "request_id": "request:" + "a" * 32,
            "reservation_id": "reservation:run-1:step-1",
            "run_id": "run-1",
            "step_id": "step-1",
            "status": "CONSUMED",
            "tokens": 3,
            "cost": "0.03",
            "abort_status": "COMPLETED",
            "usage_provenance": "PROVIDER_FINAL",
        },
    ]
    assert "secret-shaped prompt" not in json.dumps(evidence)


def test_kernel_abort_returns_final_reconciliation_evidence():
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    budget = BudgetService(InMemoryInterventionBudgetRepository())
    budget.create_budget(BudgetLimit("b1", Decimal("10"), 100, 1))
    kernel = MainAgentKernel(
        adapter,
        budget,
        request_id_factory=lambda: "request:" + "b" * 32,
    )

    result = kernel.run_step(
        run_id="run-1", step_id="step-abort", budget_id="b1", provider="UPSTAGE",
        model="m", input_text="stop", forecast_tokens=10,
        forecast_cost=Decimal("1"), abort_signal=lambda: True,
    )

    assert [event.event_type for event in result.evidence] == [
        "BUDGET_RESERVED", "USAGE_RECONCILED",
    ]
    assert result.evidence[-1].abort_status == "ABORTED"
    assert result.evidence[-1].usage_provenance == "ABORT_CONFIRMED"


def test_kernel_distinct_calls_get_unique_canonical_request_ids():
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    kernel, _ = _kernel(adapter)

    first = kernel.run_step(
        run_id="run-1", step_id="step-1", budget_id="b1", provider="UPSTAGE",
        model="m", input_text="one", forecast_tokens=10, forecast_cost=Decimal("1"),
    )
    second = kernel.run_step(
        run_id="run-1", step_id="step-2", budget_id="b1", provider="UPSTAGE",
        model="m", input_text="two", forecast_tokens=10, forecast_cost=Decimal("1"),
    )

    assert re.fullmatch(r"request:[0-9a-f]{32}", first.response.request_id)
    assert re.fullmatch(r"request:[0-9a-f]{32}", second.response.request_id)
    assert first.response.request_id != second.response.request_id


def test_kernel_duplicate_same_step_is_denied_before_second_provider_call():
    fake = DeterministicFakeAdapter()
    kernel, _ = _kernel(NativeAgentAdapter(fake))
    kwargs = dict(
        run_id="run-1", step_id="step-1", budget_id="b1", provider="UPSTAGE",
        model="m", input_text="same", forecast_tokens=10, forecast_cost=Decimal("1"),
    )

    kernel.run_step(**kwargs)
    with pytest.raises(Exception, match="BUDGET_RESERVATION_FAILED"):
        kernel.run_step(**kwargs)

    assert fake.calls == 1


def test_kernel_budget_denial_does_not_call_adapter():
    fake = DeterministicFakeAdapter()
    kernel, _ = _kernel(NativeAgentAdapter(fake), tokens=5)
    with pytest.raises(Exception, match="BUDGET_RESERVATION_FAILED"):
        kernel.run_step(
            run_id="run-1", step_id="step-1", budget_id="b1", provider="UPSTAGE",
            model="m", input_text="hello", forecast_tokens=10, forecast_cost=Decimal("1"),
        )
    assert fake.calls == 0


def test_abort_and_retry_after_are_preserved():
    signal = lambda: True
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    request = GatewayRequest(provider="UPSTAGE", model="m", input_text="x", abort_signal=signal, retry_after="12")
    result = adapter.generate(request)
    assert result.abort_status == "ABORTED"
    assert result.retry_after == "12"


def test_abort_response_allows_empty_output_observation():
    adapter = NativeAgentAdapter(DeterministicFakeAdapter())
    result = adapter.generate(
        GatewayRequest(provider="UPSTAGE", model="m", input_text="x", abort_signal=lambda: True)
    )
    assert result.output_text == ""
    assert result.abort_status == "ABORTED"
