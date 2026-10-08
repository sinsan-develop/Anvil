"""R38 SQL contract; doubles do not claim PostgreSQL execution."""
from copy import deepcopy
from decimal import Decimal
import importlib

import pytest


def ledger(**updates):
    row = dict(budget_id="b1", run_id="r1", project_id="p1", environment_id="e1",
               hard_cost_limit=Decimal("20"), hard_token_limit=1000,
               max_concurrent_requests=5, new_action_allowed=False)
    row.update(updates)
    return row


def reservation(**updates):
    row = dict(reservation_id="z1", budget_id="b1", run_id="r1", step_id="s1",
               request_id="req1", provider="local", model="model", pricing_version="v1",
               reserved_cost=Decimal("2.1"), reserved_tokens=21,
               consumed_cost=Decimal("0.2"), consumed_tokens=2,
               released_cost=Decimal("0"), released_tokens=0, status="RESERVED",
               provider_receipt_ref=None, ledger_run_id="r1", project_id="p1",
               environment_id="e1", reservation_project_id="p1", reservation_environment_id="e1")
    row.update(updates)
    return row


class Rows:
    def __init__(self, rows): self.rows = rows
    def mappings(self): return self
    def all(self): return self.rows


class Engine:
    def __init__(self, ledgers=None, reservations=None, fail=False):
        self.ledgers = ledgers if ledgers is not None else [ledger()]
        self.reservations = reservations if reservations is not None else [reservation()]
        self.calls = []
        self.fail = fail
        self.readonly = False
        self.isolation = None
    def connect(self):
        self.calls.append("connect")
        return self
    def execution_options(self, *, isolation_level):
        self.isolation = isolation_level
        return self
    def begin(self):
        assert self.isolation == "REPEATABLE READ"
        self.calls.append("begin")
        return self
    def __enter__(self): return self
    def __exit__(self, *_): return False
    def execute(self, statement, params=None):
        sql = str(statement)
        self.calls.append(sql)
        if sql == "SET TRANSACTION READ ONLY":
            self.readonly = True
            return Rows([])
        assert self.readonly
        assert sql.lstrip().startswith("SELECT ")
        assert "LIMIT 101" in sql and "ORDER BY" in sql
        assert params == {"project_id": "p1", "environment_id": "e1"}
        assert ":project_id" in sql and ":environment_id" in sql
        assert "JOIN runs" in sql and "JOIN tasks" in sql
        assert "IS NULL" in sql
        if self.fail: raise RuntimeError("postgresql://secret-sensitive")
        return Rows(deepcopy(self.reservations if "FROM budget_reservations" in sql else self.ledgers))


def load(engine, project="p1", environment="e1"):
    module = importlib.import_module("packages.persistence.operations_budget_read")
    return module.load_scoped_budget_source(engine, project, environment)


def test_empty_is_explicit_bounded_readonly_observation():
    engine = Engine([], [])
    source = load(engine)
    assert source.budget_ids == source.reservation_ids == ()
    assert engine.calls.count("begin") == 1
    assert engine.isolation == "REPEATABLE READ" and engine.readonly
    with pytest.raises(KeyError): source.snapshot("foreign")
    with pytest.raises(KeyError): source.reservation("foreign")


def test_active_reconciliation_and_consumed_have_existing_literal_semantics():
    rows = [reservation(), reservation(reservation_id="a", request_id="req2",
            reserved_cost=Decimal("3.2"), reserved_tokens=32, consumed_cost=Decimal("0.3"),
            consumed_tokens=3, status="RECONCILIATION_REQUIRED"),
            reservation(reservation_id="c", request_id="req3", reserved_cost=Decimal("8"),
            consumed_cost=Decimal("1.4"), consumed_tokens=14, status="CONSUMED")]
    source = load(Engine(reservations=rows))
    value = source.snapshot("b1")
    assert (value.reserved_cost, value.reserved_tokens, value.consumed_cost,
            value.consumed_tokens, value.active_requests, value.new_action_allowed) == (
                Decimal("5.3"), 53, Decimal("1.9"), 19, 2, False)
    assert source.reservation_ids == ("a", "c", "z1")
    assert value.hard_cost_limit == Decimal("20") and value.hard_token_limit == 1000
    object.__setattr__(value, "reserved_cost", Decimal("999"))
    receipt = source.reservation("z1")
    object.__setattr__(receipt, "reserved_cost", Decimal("999"))
    assert source.snapshot("b1").reserved_cost == Decimal("5.3")
    assert source.reservation("z1").reserved_cost == Decimal("2.1")


@pytest.mark.parametrize("field,value", [("project_id", "p2"), ("environment_id", "e2"),
    ("environment_id", None), ("budget_id", ""), ("new_action_allowed", 1),
    ("hard_cost_limit", None), ("hard_cost_limit", Decimal("NaN")),
    ("hard_cost_limit", Decimal("-1")), ("hard_token_limit", True),
    ("hard_token_limit", 10**19), ("max_concurrent_requests", 0)])
def test_ledger_corruption_scope_legacy_all_fail_closed(field, value):
    with pytest.raises(RuntimeError, match="^BUDGET_SOURCE_UNAVAILABLE$"):
        load(Engine([ledger(**{field: value})]))


@pytest.mark.parametrize("field,value", [("run_id", "r2"), ("ledger_run_id", "r2"),
    ("project_id", "p2"), ("environment_id", None), ("reservation_project_id", "p2"),
    ("reservation_environment_id", "e2"), ("reservation_environment_id", None),
    ("budget_id", "foreign"), ("reserved_cost", 2.1), ("consumed_cost", Decimal("Infinity")),
    ("released_cost", Decimal("-1")), ("reserved_tokens", True), ("consumed_tokens", -1),
    ("released_tokens", None), ("status", "unknown"), ("request_id", " "),
    ("provider_receipt_ref", []), ("model", "x" * 257)])
def test_reservation_corruption_never_partial(field, value):
    with pytest.raises(RuntimeError, match="^BUDGET_SOURCE_UNAVAILABLE$"):
        load(Engine(reservations=[reservation(**{field: value})]))


@pytest.mark.parametrize("kind", ["ledger", "reservation", "request", "budget_overflow", "reservation_overflow"])
def test_duplicate_and_overflow_fail_closed(kind):
    ledgers, rows = [ledger()], [reservation()]
    if kind == "ledger": ledgers *= 2
    if kind == "reservation": rows *= 2
    if kind == "request": rows.append(reservation(reservation_id="z2"))
    if kind == "budget_overflow": ledgers = [ledger(budget_id=f"b{i}") for i in range(101)]
    if kind == "reservation_overflow": rows = [reservation(reservation_id=f"z{i}", request_id=f"q{i}") for i in range(101)]
    with pytest.raises(RuntimeError, match="^BUDGET_SOURCE_UNAVAILABLE$"): load(Engine(ledgers, rows))


@pytest.mark.parametrize("scope", [None, "", " p1", [], "x" * 129])
def test_scope_invalid_before_any_connection(scope):
    engine = Engine()
    with pytest.raises(ValueError, match="^BUDGET_SOURCE_SCOPE_INVALID$"): load(engine, scope)
    assert engine.calls == []


def test_database_error_is_redacted_and_never_empty_success():
    with pytest.raises(RuntimeError, match="^BUDGET_SOURCE_UNAVAILABLE$") as error:
        load(Engine(fail=True))
    assert error.value.__cause__ is None


def test_untrusted_scalar_callbacks_never_run():
    class Hostile:
        def __str__(self): pytest.fail("str callback")
        def __deepcopy__(self, _): pytest.fail("deepcopy callback")
    engine = Engine()
    with pytest.raises(ValueError): load(engine, Hostile())
    assert engine.calls == []


@pytest.mark.parametrize("case", ["clean", "incoming_mismatch", "outgoing_mismatch", "legacy"])
def test_actual_selector_sql_filters_scopes_but_preserves_corruption_for_rejection(case):
    # SQLite executes the SELECT predicates only. This does NOT validate the
    # PostgreSQL isolation/read-only transaction; the opt-in gate owns that.
    import sqlite3
    from packages.persistence.operations_budget_read import _LEDGERS, _RESERVATIONS
    with sqlite3.connect(":memory:") as db:
        db.row_factory = sqlite3.Row
        db.execute("CREATE TABLE tasks (task_id TEXT, project_id TEXT)")
        db.execute("CREATE TABLE runs (run_id TEXT, task_id TEXT, environment_id TEXT)")
        db.executemany("INSERT INTO tasks VALUES (?,?)", [("t1", "p1"), ("t2", "p1"), ("t3", "p2")])
        db.executemany("INSERT INTO runs VALUES (?,?,?)", [("r1", "t1", "e1"), ("r2", "t2", "e2"), ("r3", "t3", "e1")])
        for table, sample, extras in (("budget_ledgers", ledger(), {"project_id", "environment_id"}),
                ("budget_reservations", reservation(), {"ledger_run_id", "project_id", "environment_id",
                    "reservation_project_id", "reservation_environment_id"})):
            keys = tuple(key for key in sample if key not in extras)
            db.execute(f"CREATE TABLE {table} (" + ",".join(key + " TEXT" for key in keys) + ")")
            for index in (1, 2, 3):
                row = dict(sample, budget_id=f"b{index}", run_id=f"r{index}")
                if table == "budget_reservations": row.update(reservation_id=f"z{index}", request_id=f"q{index}")
                db.execute(f"INSERT INTO {table} VALUES (" + ",".join("?" for _ in keys) + ")",
                           tuple(None if row[key] is None else str(row[key]) for key in keys))
        if case == "incoming_mismatch": db.execute("UPDATE budget_reservations SET run_id='r1' WHERE reservation_id='z2'")
        if case == "outgoing_mismatch": db.execute("UPDATE budget_reservations SET run_id='r2' WHERE reservation_id='z1'")
        if case == "legacy": db.execute("UPDATE runs SET environment_id=NULL WHERE run_id='r2'")
        params = {"project_id": "p1", "environment_id": "e1"}
        ledgers = [dict(row) for row in db.execute(_LEDGERS, params)]
        receipts = [dict(row) for row in db.execute(_RESERVATIONS, params)]
        assert [row["budget_id"] for row in ledgers] == (["b1", "b2"] if case == "legacy" else ["b1"])
        assert [row["reservation_id"] for row in receipts] == (["z1", "z2"] if case in ("incoming_mismatch", "legacy") else ["z1"])
        assert all(row["budget_id"] != "b3" for row in ledgers + receipts)
        if case == "outgoing_mismatch": assert receipts[0]["reservation_environment_id"] == "e2"
        if case == "incoming_mismatch": assert receipts[1]["environment_id"] == "e2"
        if case == "legacy": assert ledgers[1]["environment_id"] is None
