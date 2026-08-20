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
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _money(value: Decimal, field: str) -> None:
    if not isinstance(value, Decimal) or value < Decimal("0"):
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
        if type(self.hard_token_limit) is not int or self.hard_token_limit < 0:
            raise ValueError("hard_token_limit must be non-negative")
        if type(self.max_concurrent_requests) is not int or self.max_concurrent_requests < 1:
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
        if type(self.forecast_tokens) is not int or self.forecast_tokens < 0:
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
        if self.actual_tokens is not None and (type(self.actual_tokens) is not int or self.actual_tokens < 0):
            raise ValueError("actual_tokens must be non-negative")


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
