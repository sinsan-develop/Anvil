from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from re import fullmatch
from typing import Callable
from uuid import uuid4

from packages.budget.models import BudgetRequest, UsageReceipt
from packages.budget.service import BudgetReservationFailed, BudgetService
from packages.llm_gateway import (
    GatewayRequest,
    GatewayResponse,
    NativeAgentAdapter,
    UsageProvenance,
)


class BudgetDenied(RuntimeError):
    code = "BUDGET_RESERVATION_FAILED"


@dataclass(frozen=True, slots=True)
class StepBudget:
    forecast_tokens: int
    forecast_cost: Decimal


@dataclass(frozen=True, slots=True)
class BudgetUsageEvent:
    sequence: int
    event_type: str
    request_id: str
    reservation_id: str
    run_id: str
    step_id: str
    status: str
    tokens: int
    cost: Decimal
    abort_status: str | None = None
    usage_provenance: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "sequence": self.sequence,
            "event_type": self.event_type,
            "request_id": self.request_id,
            "reservation_id": self.reservation_id,
            "run_id": self.run_id,
            "step_id": self.step_id,
            "status": self.status,
            "tokens": self.tokens,
            "cost": str(self.cost),
            "abort_status": self.abort_status,
            "usage_provenance": self.usage_provenance,
        }


@dataclass(frozen=True, slots=True)
class StepResult:
    action: str
    observation: str
    response: GatewayResponse
    evidence: tuple[BudgetUsageEvent, ...]


class MainAgentKernel:
    def __init__(
        self,
        adapter: NativeAgentAdapter,
        budget: BudgetService,
        *,
        request_id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._adapter = adapter
        self._budget = budget
        self._request_id_factory = request_id_factory or (
            lambda: f"request:{uuid4().hex}"
        )
        self._issued_request_ids: set[str] = set()

    def _next_request_id(self) -> str:
        request_id = self._request_id_factory()
        if not isinstance(request_id, str) or fullmatch(
            r"request:[0-9a-f]{32}", request_id
        ) is None:
            raise ValueError("request_id_factory must return canonical request:<32 lowercase hex>")
        if request_id in self._issued_request_ids:
            raise ValueError("request_id_factory returned a duplicate request id")
        self._issued_request_ids.add(request_id)
        return request_id

    def run_step(
        self, *, run_id: str, step_id: str, budget_id: str, provider: str,
        model: str, input_text: str, forecast_tokens: int, forecast_cost: Decimal,
        pricing_version: str = "unpriced-v1", abort_signal: object | None = None,
        retry_after: str | None = None,
    ) -> StepResult:
        request_id = self._next_request_id()
        reservation_id = f"reservation:{run_id}:{step_id}"
        request = BudgetRequest(
            reservation_id, budget_id, run_id, step_id, request_id, provider, model,
            pricing_version, forecast_cost, forecast_tokens,
        )
        try:
            reservation = self._budget.reserve(request)
        except BudgetReservationFailed as error:
            raise BudgetDenied(f"{BudgetDenied.code}: {error}") from error
        reservation_event = BudgetUsageEvent(
            1,
            "BUDGET_RESERVED",
            request_id,
            reservation_id,
            run_id,
            step_id,
            reservation.status.value,
            reservation.reserved_tokens,
            reservation.reserved_cost,
        )
        response = self._adapter.generate(
            GatewayRequest(provider, model, input_text, request_id, abort_signal, retry_after)
        )
        usage = response.final_usage
        usage_is_unknown = response.usage_provenance is UsageProvenance.UNKNOWN
        receipt = UsageReceipt(
            f"usage:{request_id}", reservation_id, request_id, response.abort_status,
            None if usage_is_unknown else Decimal(usage.total_tokens) / Decimal(100),
            None if usage_is_unknown else usage.total_tokens,
            response.retry_after, None, response.usage_provenance.value,
        )
        reconciliation = self._budget.reconcile(receipt)
        reconciliation_event = BudgetUsageEvent(
            2,
            "USAGE_RECONCILED",
            request_id,
            reservation_id,
            run_id,
            step_id,
            "CONSUMED",
            reconciliation.consumed_tokens,
            reconciliation.consumed_cost,
            reconciliation.abort_status,
            reconciliation.provenance,
        )
        return StepResult(
            "generate",
            response.output_text,
            response,
            (reservation_event, reconciliation_event),
        )
