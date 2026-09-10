"""Persistence ports and deterministic in-memory atomic budget adapter."""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal
from threading import RLock
from typing import Protocol, runtime_checkable

from packages.budget.models import (
    BudgetLimit,
    BudgetReservation,
    BudgetRequest,
    BudgetSnapshot,
    ReconciliationReceipt,
    ReservationStatus,
    UsageReceipt,
)


class AtomicReservationRejected(ValueError):
    pass


class ReconciliationConflict(ValueError):
    pass


class SqlAlchemyInterventionBudgetRepository:
    """0009 함수를 재사용하며 commit은 실행 포트의 트랜잭션이 소유한다."""

    def __init__(self, session):
        self.session = session

    def reserve(self, request: BudgetRequest) -> BudgetReservation:
        from sqlalchemy import text
        from dataclasses import asdict
        row = self.session.execute(text(
            "SELECT * FROM anvil_budget_reserve(:reservation_id,:budget_id,:run_id,:step_id,"
            ":request_id,:provider,:model,:pricing_version,:forecast_cost,:forecast_tokens)"
        ), asdict(request)).mappings().one()
        if row["reservation_id"] is None:
            raise AtomicReservationRejected("budget reservation denied")
        return self._reservation(row)

    def lock_execution_identity(self, request: BudgetRequest) -> tuple[BudgetReservation, ...]:
        """예약 함수와 같은 ledger lock 아래 기존 reservation/request를 확인한다."""
        from sqlalchemy import text

        self.session.execute(text(
            "SELECT budget_id FROM budget_ledgers WHERE budget_id=:budget_id FOR UPDATE"
        ), {"budget_id": request.budget_id}).scalar_one_or_none()
        rows = self.session.execute(text(
            "SELECT * FROM budget_reservations "
            "WHERE reservation_id=:reservation_id OR request_id=:request_id "
            "ORDER BY reservation_id FOR UPDATE"
        ), {"reservation_id": request.reservation_id,
            "request_id": request.request_id}).mappings().all()
        return tuple(self._reservation(row) for row in rows)

    @staticmethod
    def _reservation(row) -> BudgetReservation:
        from dataclasses import fields
        values = {field.name: row[field.name] for field in fields(BudgetReservation)}
        values["status"] = ReservationStatus(values["status"])
        return BudgetReservation(**values)

    def reservation(self, reservation_id: str) -> BudgetReservation:
        from sqlalchemy import text
        row = self.session.execute(text(
            "SELECT * FROM budget_reservations WHERE reservation_id=:id FOR UPDATE"
        ), {"id": reservation_id}).mappings().one()
        return self._reservation(row)

    def reconcile(self, receipt: UsageReceipt) -> ReconciliationReceipt:
        from dataclasses import asdict
        from hashlib import sha256
        import json
        from sqlalchemy import text

        reserved = self.reservation(receipt.reservation_id)
        if receipt.request_id != reserved.request_id:
            raise ReconciliationConflict("usage request does not match reservation")
        if (receipt.provenance == "UNKNOWN" or receipt.actual_cost is None or receipt.actual_tokens is None
                or receipt.actual_cost > reserved.reserved_cost or receipt.actual_tokens > reserved.reserved_tokens):
            raise ReconciliationConflict("authoritative final usage is unavailable")
        released_cost = reserved.reserved_cost - receipt.actual_cost
        released_tokens = reserved.reserved_tokens - receipt.actual_tokens
        values = asdict(receipt)
        values.update(released_cost=released_cost, released_tokens=released_tokens,
                      payload_hash="sha256:" + sha256(json.dumps(asdict(receipt), default=str,
                          sort_keys=True, separators=(",", ":")).encode()).hexdigest())
        row = self.session.execute(text(
            "SELECT * FROM anvil_budget_reconcile(:usage_receipt_id,:reservation_id,:request_id,"
            ":abort_status,:actual_cost,:actual_tokens,:released_cost,:released_tokens,"
            ":payload_hash,:retry_after,:rate_bucket,:provenance)"
        ), values).mappings().one()
        if row["usage_receipt_id"] is None:
            raise ReconciliationConflict("usage finalization conflicts with persisted receipt")
        return ReconciliationReceipt(receipt.usage_receipt_id, receipt.reservation_id, receipt.request_id,
            receipt.abort_status, receipt.actual_cost, receipt.actual_tokens, released_cost,
            released_tokens, receipt.retry_after, receipt.rate_bucket, receipt.provenance)

    def require_reconciliation(self, receipt: UsageReceipt) -> None:
        """불확실한 사용량은 0으로 확정하지 않고 NULL 영수증으로 유지한다."""
        from sqlalchemy import text
        reserved = self.reservation(receipt.reservation_id)
        if reserved.request_id != receipt.request_id or reserved.status is ReservationStatus.CONSUMED:
            raise ReconciliationConflict("cannot replace an authoritative reservation")
        self.session.execute(text(
            "INSERT INTO budget_usage_receipts (usage_receipt_id,reservation_id,request_id,abort_status,"
            "actual_cost,actual_tokens,is_authoritative_final,provenance) "
            "VALUES (:id,:reservation,:request,:abort,NULL,NULL,false,'UNKNOWN')"
        ), {"id": receipt.usage_receipt_id, "reservation": receipt.reservation_id,
            "request": receipt.request_id, "abort": receipt.abort_status})
        self.session.execute(text(
            "UPDATE budget_reservations SET status='RECONCILIATION_REQUIRED' WHERE reservation_id=:id"
        ), {"id": receipt.reservation_id})


@runtime_checkable
class InterventionBudgetRepository(Protocol):
    def create_budget(self, limit: BudgetLimit) -> None: ...
    def reserve(self, request: BudgetRequest) -> BudgetReservation: ...
    def reservation(self, reservation_id: str) -> BudgetReservation: ...
    def snapshot(self, budget_id: str) -> BudgetSnapshot: ...
    def bind_provider_receipt(self, reservation_id: str, receipt_ref: str) -> BudgetReservation: ...
    def reconcile(self, receipt: UsageReceipt) -> ReconciliationReceipt: ...
    def set_new_action_allowed(self, budget_id: str, allowed: bool) -> BudgetSnapshot: ...


class InMemoryInterventionBudgetRepository:
    def __init__(self) -> None:
        self._limits: dict[str, BudgetLimit] = {}
        self._reservations: dict[str, BudgetReservation] = {}
        self._usage: dict[str, tuple[UsageReceipt, ReconciliationReceipt]] = {}
        self._finalizations: dict[str, tuple[UsageReceipt, ReconciliationReceipt]] = {}
        self._allowed: dict[str, bool] = {}
        self._lock = RLock()

    def create_budget(self, limit: BudgetLimit) -> None:
        with self._lock:
            if limit.budget_id in self._limits:
                raise ValueError("budget already exists")
            self._limits[limit.budget_id] = limit
            self._allowed[limit.budget_id] = True

    def reserve(self, request: BudgetRequest) -> BudgetReservation:
        with self._lock:
            existing = self._reservations.get(request.reservation_id)
            if existing is not None:
                canonical_existing = (
                    existing.budget_id,
                    existing.run_id,
                    existing.step_id,
                    existing.request_id,
                    existing.provider,
                    existing.model,
                    existing.pricing_version,
                    existing.reserved_cost,
                    existing.reserved_tokens,
                )
                canonical_request = (
                    request.budget_id,
                    request.run_id,
                    request.step_id,
                    request.request_id,
                    request.provider,
                    request.model,
                    request.pricing_version,
                    request.forecast_cost,
                    request.forecast_tokens,
                )
                if canonical_existing != canonical_request:
                    raise AtomicReservationRejected("reservation id is bound to another request")
                return existing
            snapshot = self._snapshot_unlocked(request.budget_id)
            limit = self._limits[request.budget_id]
            if not snapshot.new_action_allowed:
                raise AtomicReservationRejected("new budget actions are paused")
            if snapshot.active_requests >= limit.max_concurrent_requests:
                raise AtomicReservationRejected("concurrency hard limit exceeded")
            if snapshot.reserved_cost + snapshot.consumed_cost + request.forecast_cost > limit.hard_cost_limit:
                raise AtomicReservationRejected("cost hard limit exceeded")
            if snapshot.reserved_tokens + snapshot.consumed_tokens + request.forecast_tokens > limit.hard_token_limit:
                raise AtomicReservationRejected("token hard limit exceeded")
            reservation = BudgetReservation(
                request.reservation_id,
                request.budget_id,
                request.run_id,
                request.step_id,
                request.request_id,
                request.provider,
                request.model,
                request.pricing_version,
                request.forecast_cost,
                request.forecast_tokens,
            )
            self._reservations[request.reservation_id] = reservation
            return reservation

    def reservation(self, reservation_id: str) -> BudgetReservation:
        with self._lock:
            return self._reservations[reservation_id]

    def snapshot(self, budget_id: str) -> BudgetSnapshot:
        with self._lock:
            return self._snapshot_unlocked(budget_id)

    def bind_provider_receipt(self, reservation_id: str, receipt_ref: str) -> BudgetReservation:
        with self._lock:
            current = self._reservations[reservation_id]
            updated = replace(current, provider_receipt_ref=receipt_ref)
            self._reservations[reservation_id] = updated
            return updated

    def reconcile(self, receipt: UsageReceipt) -> ReconciliationReceipt:
        with self._lock:
            previous = self._usage.get(receipt.usage_receipt_id)
            if previous is not None:
                if previous[0] != receipt:
                    raise ReconciliationConflict("usage receipt id is bound to different content")
                return previous[1]
            finalization = self._finalizations.get(receipt.reservation_id)
            if finalization is not None:
                if finalization[0] != receipt:
                    raise ReconciliationConflict("reservation is bound to another authoritative final receipt")
                return finalization[1]
            reservation = self._reservations[receipt.reservation_id]
            if reservation.request_id != receipt.request_id:
                raise ReconciliationConflict("usage receipt request does not match reservation")
            if reservation.status is ReservationStatus.CONSUMED:
                raise ReconciliationConflict("consumed reservation has no mutable final state")
            if receipt.actual_cost is None or receipt.actual_tokens is None:
                self._reservations[receipt.reservation_id] = replace(
                    reservation, status=ReservationStatus.RECONCILIATION_REQUIRED
                )
                raise ReconciliationConflict("final usage is unknown")
            if receipt.actual_cost > reservation.reserved_cost or receipt.actual_tokens > reservation.reserved_tokens:
                self._reservations[receipt.reservation_id] = replace(
                    reservation, status=ReservationStatus.RECONCILIATION_REQUIRED
                )
                raise ReconciliationConflict("actual usage exceeds forecast maximum")
            released_cost = reservation.reserved_cost - receipt.actual_cost
            released_tokens = reservation.reserved_tokens - receipt.actual_tokens
            updated = replace(
                reservation,
                consumed_cost=receipt.actual_cost,
                consumed_tokens=receipt.actual_tokens,
                released_cost=released_cost,
                released_tokens=released_tokens,
                status=ReservationStatus.CONSUMED,
            )
            result = ReconciliationReceipt(
                receipt.usage_receipt_id,
                receipt.reservation_id,
                receipt.request_id,
                receipt.abort_status,
                receipt.actual_cost,
                receipt.actual_tokens,
                released_cost,
                released_tokens,
                receipt.retry_after,
                receipt.rate_bucket,
                receipt.provenance,
            )
            self._reservations[receipt.reservation_id] = updated
            self._usage[receipt.usage_receipt_id] = (receipt, result)
            self._finalizations[receipt.reservation_id] = (receipt, result)
            return result

    def set_new_action_allowed(self, budget_id: str, allowed: bool) -> BudgetSnapshot:
        with self._lock:
            self._allowed[budget_id] = allowed
            return self._snapshot_unlocked(budget_id)

    def _snapshot_unlocked(self, budget_id: str) -> BudgetSnapshot:
        limit = self._limits[budget_id]
        reservations = tuple(item for item in self._reservations.values() if item.budget_id == budget_id)
        active_statuses = {ReservationStatus.RESERVED, ReservationStatus.RECONCILIATION_REQUIRED}
        active = tuple(item for item in reservations if item.status in active_statuses)
        return BudgetSnapshot(
            budget_id,
            limit.hard_cost_limit,
            limit.hard_token_limit,
            sum((item.reserved_cost for item in active), Decimal("0")),
            sum(item.reserved_tokens for item in active),
            sum((item.consumed_cost for item in reservations), Decimal("0")),
            sum(item.consumed_tokens for item in reservations),
            len(active),
            self._allowed[budget_id],
        )
