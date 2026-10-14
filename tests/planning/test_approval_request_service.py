"""producer의 untrusted typed 경계: callback/alias/계획 위조."""
from dataclasses import replace
import pytest
from tests.persistence.test_approval_request_repository import setup_db, counts


def test_caller_mutation_cannot_change_stored_request():
    engine, command, authority, _, service = setup_db()
    try:
        receipt = service.finalize_execution_plan(command, authority)
        original = replace(receipt)
        object.__setattr__(receipt, "plan_hash", "bad")
        assert service.finalize_execution_plan(command, authority) == original
        assert "capability=" not in repr(authority)
    finally: engine.dispose()


@pytest.mark.parametrize("field", ["plan", "mode", "task_id", "idempotency_key"])
def test_hostile_object_is_rejected_without_callback(field):
    engine, command, authority, _, service = setup_db()
    seen = []
    class Hostile:
        def __deepcopy__(self, memo): seen.append("copy"); return "task-1"
        def __str__(self): seen.append("str"); return "task-1"
    try:
        object.__setattr__(command, field, Hostile())
        with pytest.raises(ValueError): service.finalize_execution_plan(command, authority)
        assert seen == [] and counts(engine) == (0, 0, 0)
    finally: engine.dispose()


def test_forged_nested_plan_hash_has_no_publication():
    engine, command, authority, _, service = setup_db()
    try:
        object.__setattr__(command.plan, "content_hash", "sha256:" + "b" * 64)
        with pytest.raises(ValueError, match="PLAN_HASH_MISMATCH"):
            service.finalize_execution_plan(command, authority)
        assert counts(engine) == (0, 0, 0)
    finally: engine.dispose()
