from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from packages.budget.models import BudgetRequest, UsageReceipt
from packages.budget.service import BudgetReservationFailed, BudgetService
from packages.llm_gateway import GatewayRequest, GatewayResponse, NativeAgentAdapter


class BudgetDenied(RuntimeError):
    code = "BUDGET_RESERVATION_FAILED"


@dataclass(frozen=True, slots=True)
class StepBudget:
    forecast_tokens: int
    forecast_cost: Decimal


@dataclass(frozen=True, slots=True)
class StepResult:
    action: str
    observation: str
    response: GatewayResponse


class MainAgentKernel:
    def __init__(self, adapter: NativeAgentAdapter, budget: BudgetService) -> None:
        self._adapter = adapter
        self._budget = budget

    def run_step(
        self, *, run_id: str, step_id: str, budget_id: str, provider: str,
        model: str, input_text: str, forecast_tokens: int, forecast_cost: Decimal,
        pricing_version: str = "unpriced-v1", abort_signal: object | None = None,
        retry_after: str | None = None,
    ) -> StepResult:
        request_id = f"request:{run_id}:{step_id}"
        reservation_id = f"reservation:{run_id}:{step_id}"
        request = BudgetRequest(
            reservation_id, budget_id, run_id, step_id, request_id, provider, model,
            pricing_version, forecast_cost, forecast_tokens,
        )
        try:
            self._budget.reserve(request)
        except BudgetReservationFailed as error:
            raise BudgetDenied(f"{BudgetDenied.code}: {error}") from error
        response = self._adapter.generate(
            GatewayRequest(provider, model, input_text, request_id, abort_signal, retry_after)
        )
        usage = response.final_usage
        receipt = UsageReceipt(
            f"usage:{request_id}", reservation_id, request_id, response.abort_status,
            Decimal(usage.total_tokens) / Decimal(100), usage.total_tokens,
            response.retry_after, None, response.usage_provenance.value,
        )
        self._budget.reconcile(receipt)
        return StepResult("generate", response.output_text, response)
