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


def test_capability_probe_reports_supported_and_reason_for_unsupported():
    probe = DeterministicFakeAdapter(capabilities={"text_generation"}).probe()
    assert probe.supported is True
    assert probe.unsupported_reasons == ()
    missing = DeterministicFakeAdapter(capabilities=set()).probe(required={"tool_use"})
    assert missing.supported is False
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
