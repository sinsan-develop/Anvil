"""Bounded, scope-bound read-only observations of the B10 budget ledger.

This owner neither reserves funds nor infers provider usage/health. Unknown
usage keeps its existing reconciliation exposure; dispatch evidence is absent.
"""
from dataclasses import dataclass, fields
from decimal import Decimal, localcontext
import re

from sqlalchemy import text

from packages.budget.models import BudgetLimit, BudgetReservation, BudgetSnapshot, ReservationStatus


_SCOPE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z", re.ASCII)
_LEDGERS = """SELECT l.budget_id, l.run_id, l.hard_cost_limit, l.hard_token_limit,
 l.max_concurrent_requests, l.new_action_allowed,
 tasks.project_id, runs.environment_id
 FROM budget_ledgers l JOIN runs ON runs.run_id = l.run_id
 JOIN tasks ON tasks.task_id = runs.task_id
 WHERE tasks.project_id = :project_id
 AND (runs.environment_id = :environment_id OR runs.environment_id IS NULL)
 ORDER BY l.budget_id LIMIT 101"""
_RESERVATIONS = """SELECT b.reservation_id, b.budget_id, b.run_id, b.step_id,
 b.request_id, b.provider, b.model, b.pricing_version, b.reserved_cost,
 b.reserved_tokens, b.consumed_cost, b.consumed_tokens, b.released_cost,
 b.released_tokens, b.status, b.provider_receipt_ref,
 l.run_id AS ledger_run_id, tasks.project_id, runs.environment_id,
 rt.project_id AS reservation_project_id, rr.environment_id AS reservation_environment_id
 FROM budget_reservations b
 JOIN budget_ledgers l ON l.budget_id = b.budget_id
 JOIN runs ON runs.run_id = l.run_id JOIN tasks ON tasks.task_id = runs.task_id
 JOIN runs rr ON rr.run_id = b.run_id JOIN tasks rt ON rt.task_id = rr.task_id
 WHERE (tasks.project_id = :project_id AND
 (runs.environment_id = :environment_id OR runs.environment_id IS NULL))
 OR (rt.project_id = :project_id AND
 (rr.environment_id = :environment_id OR rr.environment_id IS NULL))
 ORDER BY b.reservation_id LIMIT 101"""
_RESERVATION_FIELDS = tuple(field.name for field in fields(BudgetReservation))


def _string(value):
    if (type(value) is not str or not 0 < len(value) <= 256
            or value != value.strip() or any(ord(char) < 32 for char in value)):
        raise ValueError("invalid value")
    return value


def _integer(value):
    if type(value) is not int or not 0 <= value <= 10**18:
        raise ValueError("invalid value")
    return value


def _money(value):
    if (type(value) is not Decimal or not value.is_finite() or value < 0
            or len(value.as_tuple().digits) > 64 or abs(value.as_tuple().exponent) > 64):
        raise ValueError("invalid value")
    return value


@dataclass(frozen=True, slots=True)
class ScopedBudgetSource:
    # Canonical storage consists only of immutable scalar tuples, not caller DTOs.
    _snapshots: tuple[tuple, ...]
    _reservations: tuple[tuple, ...]

    @property
    def budget_ids(self):
        return tuple(row[0] for row in self._snapshots)

    @property
    def reservation_ids(self):
        return tuple(row[0] for row in self._reservations)

    def snapshot(self, budget_id):
        if type(budget_id) is str:
            for row in self._snapshots:
                if row[0] == budget_id:
                    return BudgetSnapshot(*row)
        raise KeyError("BUDGET_NOT_OBSERVED")

    def reservation(self, reservation_id):
        if type(reservation_id) is str:
            for row in self._reservations:
                if row[0] == reservation_id:
                    return BudgetReservation(*row)
        raise KeyError("RESERVATION_NOT_OBSERVED")


def _materialize(ledgers, reservations, project_id, environment_id):
    if len(ledgers) > 100 or len(reservations) > 100:
        raise ValueError("overflow")
    limits = {}
    for row in ledgers:
        if (row["project_id"], row["environment_id"]) != (project_id, environment_id):
            raise ValueError("scope")
        budget_id, run_id = _string(row["budget_id"]), _string(row["run_id"])
        if budget_id in limits or type(row["new_action_allowed"]) is not bool:
            raise ValueError("duplicate or malformed ledger")
        limit = BudgetLimit(budget_id, _money(row["hard_cost_limit"]),
                            _integer(row["hard_token_limit"]), _integer(row["max_concurrent_requests"]))
        limits[budget_id] = (limit, run_id, row["new_action_allowed"])
    receipts, requests = {}, set()
    for row in reservations:
        values = {}
        for name in _RESERVATION_FIELDS:
            value = row[name]
            if name.endswith("_cost"):
                value = _money(value)
            elif name.endswith("_tokens"):
                value = _integer(value)
            elif name == "status":
                value = ReservationStatus(_string(value))
            elif name != "provider_receipt_ref" or value is not None:
                value = _string(value)
            values[name] = value
        if (row["project_id"], row["environment_id"], row["reservation_project_id"],
                row["reservation_environment_id"]) != (project_id, environment_id, project_id, environment_id):
            raise ValueError("scope")
        budget_id = values["budget_id"]
        if (budget_id not in limits or values["run_id"] != limits[budget_id][1]
                or row["ledger_run_id"] != limits[budget_id][1]):
            raise ValueError("run identity mismatch")
        identity = values["reservation_id"]
        if identity in receipts or values["request_id"] in requests:
            raise ValueError("duplicate")
        requests.add(values["request_id"])
        receipts[identity] = BudgetReservation(**values)
    snapshots = []
    with localcontext() as context:
        context.prec = 200
        for budget_id, (limit, _, allowed) in sorted(limits.items()):
            rows = [r for r in receipts.values() if r.budget_id == budget_id]
            active = [r for r in rows if r.status in
                      (ReservationStatus.RESERVED, ReservationStatus.RECONCILIATION_REQUIRED)]
            snapshots.append((budget_id, limit.hard_cost_limit, limit.hard_token_limit,
                _money(sum((r.reserved_cost for r in active), Decimal(0))),
                _integer(sum(r.reserved_tokens for r in active)),
                _money(sum((r.consumed_cost for r in rows), Decimal(0))),
                _integer(sum(r.consumed_tokens for r in rows)), len(active), allowed))
    return ScopedBudgetSource(tuple(snapshots), tuple(
        tuple(getattr(receipts[key], name) for name in _RESERVATION_FIELDS) for key in sorted(receipts)))


def load_scoped_budget_source(engine, project_id: str, environment_id: str) -> ScopedBudgetSource:
    """Read both ledger and reservations from one bounded PostgreSQL snapshot."""
    if any(type(value) is not str or _SCOPE.fullmatch(value) is None
           for value in (project_id, environment_id)):
        raise ValueError("BUDGET_SOURCE_SCOPE_INVALID")
    try:
        with engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                connection.execute(text("SET TRANSACTION READ ONLY"))
                params = {"project_id": project_id, "environment_id": environment_id}
                ledgers = connection.execute(text(_LEDGERS), params).mappings().all()
                reservations = connection.execute(text(_RESERVATIONS), params).mappings().all()
                return _materialize(ledgers, reservations, project_id, environment_id)
    except Exception:
        raise RuntimeError("BUDGET_SOURCE_UNAVAILABLE") from None
