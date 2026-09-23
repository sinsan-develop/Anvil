"""Immutable atomic budget, quota, and usage reconciliation values."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class ReservationStatus(str, Enum):
    RESERVED = "RESERVED"
    CONSUMED = "CONSUMED"
    RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"


def _text(value: str, field: str) -> None:
    if type(value) is not str or not value or len(value) > 256 or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _money(value: Decimal, field: str) -> None:
    if (type(value) is not Decimal or not value.is_finite() or value < Decimal("0")
            or len(value.as_tuple().digits) > 64 or abs(value.as_tuple().exponent) > 64):
        raise ValueError(f"{field} must be a non-negative Decimal")


@dataclass(frozen=True, slots=True)
class BudgetLimit:
    budget_id: str
    hard_cost_limit: Decimal
    hard_token_limit: int
    max_concurrent_requests: int

    def __post_init__(self) -> None:
        _text(self.budget_id, "budget_id")
        _money(self.hard_cost_limit, "hard_cost_limit")
        if type(self.hard_token_limit) is not int or not 0 <= self.hard_token_limit <= 10**18:
            raise ValueError("hard_token_limit must be non-negative")
        if type(self.max_concurrent_requests) is not int or not 1 <= self.max_concurrent_requests <= 10**18:
            raise ValueError("max_concurrent_requests must be positive")


@dataclass(frozen=True, slots=True)
class BudgetRequest:
    reservation_id: str
    budget_id: str
    run_id: str
    step_id: str
    request_id: str
    provider: str
    model: str
    pricing_version: str
    forecast_cost: Decimal
    forecast_tokens: int

    def __post_init__(self) -> None:
        for value, field in (
            (self.reservation_id, "reservation_id"),
            (self.budget_id, "budget_id"),
            (self.run_id, "run_id"),
            (self.step_id, "step_id"),
            (self.request_id, "request_id"),
            (self.provider, "provider"),
            (self.model, "model"),
            (self.pricing_version, "pricing_version"),
        ):
            _text(value, field)
        _money(self.forecast_cost, "forecast_cost")
        if type(self.forecast_tokens) is not int or not 0 <= self.forecast_tokens <= 10**18:
            raise ValueError("forecast_tokens must be non-negative")


@dataclass(frozen=True, slots=True)
class BudgetReservation:
    reservation_id: str
    budget_id: str
    run_id: str
    step_id: str
    request_id: str
    provider: str
    model: str
    pricing_version: str
    reserved_cost: Decimal
    reserved_tokens: int
    consumed_cost: Decimal = Decimal("0")
    consumed_tokens: int = 0
    released_cost: Decimal = Decimal("0")
    released_tokens: int = 0
    status: ReservationStatus = ReservationStatus.RESERVED
    provider_receipt_ref: str | None = None


@dataclass(frozen=True, slots=True)
class BudgetSnapshot:
    budget_id: str
    hard_cost_limit: Decimal
    hard_token_limit: int
    reserved_cost: Decimal
    reserved_tokens: int
    consumed_cost: Decimal
    consumed_tokens: int
    active_requests: int
    new_action_allowed: bool = True


@dataclass(frozen=True, slots=True)
class UsageReceipt:
    usage_receipt_id: str
    reservation_id: str
    request_id: str
    abort_status: str
    actual_cost: Decimal | None
    actual_tokens: int | None
    retry_after: str | None
    rate_bucket: str | None
    provenance: str

    def __post_init__(self) -> None:
        for value, field in (
            (self.usage_receipt_id, "usage_receipt_id"),
            (self.reservation_id, "reservation_id"),
            (self.request_id, "request_id"),
            (self.abort_status, "abort_status"),
            (self.provenance, "provenance"),
        ):
            _text(value, field)
        if self.actual_cost is not None:
            _money(self.actual_cost, "actual_cost")
        if self.actual_tokens is not None and (type(self.actual_tokens) is not int or not 0 <= self.actual_tokens <= 10**18):
            raise ValueError("actual_tokens must be non-negative")
        for value, field in ((self.retry_after, 'retry_after'), (self.rate_bucket, 'rate_bucket')):
            if value is not None:
                _text(value, field)


@dataclass(frozen=True, slots=True)
class ReconciliationReceipt:
    usage_receipt_id: str
    reservation_id: str
    request_id: str
    abort_status: str
    consumed_cost: Decimal
    consumed_tokens: int
    released_cost: Decimal
    released_tokens: int
    retry_after: str | None
    rate_bucket: str | None
    provenance: str


@dataclass(frozen=True, slots=True)
class QuotaWarning:
    budget_id: str
    checkpoint_ref: str
    next_safe_action: str
    new_action_allowed: bool = False
    checkpoint_required: bool = True


@dataclass(frozen=True, slots=True)
class QuotaPause:
    budget_id: str
    status: str
    incomplete_step_id: str
    checkpoint_ref: str
    reset_hint: str
    next_safe_action: str


@dataclass(frozen=True, slots=True)
class ProviderOutcome:
    """Host adapter observation, never an agent-issued usage authority."""
    request_id: str
    provider: str
    model: str
    abort_status: str
    actual_cost: Decimal | None
    actual_tokens: int | None
    provenance: str
    retry_after: str | None
    rate_bucket: str | None
    failure_code: str | None


@dataclass(frozen=True, slots=True)
class BudgetDispatch:
    request: BudgetRequest
    admission_hash: str
    status: str
    send_count: int
    reservation: BudgetReservation | None = None
    usage: UsageReceipt | None = None
    reconciliation: ReconciliationReceipt | None = None
    pause: QuotaPause | None = None
    failure_code: str | None = None
    checkpoint_ref: str | None = None
    reset_hint: str | None = None
