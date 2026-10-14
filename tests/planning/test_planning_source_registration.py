"""등록 경계의 builtin-only capture·권위/원본 분리."""
from dataclasses import replace
from datetime import timedelta, tzinfo

import pytest

from tests.persistence.test_planning_source_repository import inputs, api, setup, rows


@pytest.mark.parametrize("field,value", [
    ("actor_id", "reader"), ("permission", "dashboard:read"),
    ("project_id", "foreign"), ("environment_id", "foreign"),
    ("repository_url", "https://foreign.invalid/repo"),
])
def test_registration_policy_is_not_reader_or_foreign_authority(field, value):
    policy, _, _ = inputs()
    with pytest.raises(ValueError): replace(policy, **{field: value})


def test_policy_time_and_detached_input_boundaries():
    policy, command, sources = inputs()
    s, _ = api()
    with pytest.raises(ValueError): replace(policy, expires_at=policy.expires_at + timedelta(seconds=1))
    with pytest.raises(ValueError): replace(policy, issued_at=policy.issued_at.replace(tzinfo=None))
    p, c, _ = s.admission(policy, command, sources)
    assert p is not policy and c is not command and c.plan is not command.plan
    object.__setattr__(policy, "actor_id", "reader")
    object.__setattr__(command.plan, "plan_id", "tampered")
    assert p.actor_id == s.ACTOR and c.plan.plan_id != "tampered"


@pytest.mark.parametrize("where", ["policy", "policy_scalar", "command", "source_map", "source_value", "grant", "clock"])
def test_untrusted_callbacks_never_run(where, monkeypatch):
    engine, p, c, sources, _, service, grant = setup(monkeypatch)
    called = []
    class Hostile:
        def __deepcopy__(self, memo): called.append("deepcopy"); return "unsafe"
        def __str__(self): called.append("str"); return "unsafe"
        def __eq__(self, other): called.append("eq"); return True
    class Mapping(dict):
        def __iter__(self): called.append("iter"); return super().__iter__()
    class Clock(tzinfo):
        def utcoffset(self, value): called.append("offset"); return timedelta(0)
    try:
        if where == "policy": p = Hostile()
        if where == "policy_scalar": object.__setattr__(p, "actor_id", Hostile())
        if where == "command": c = Hostile()
        if where == "source_map": sources = Mapping(sources)
        if where == "source_value": sources[next(iter(sources))] = Hostile()
        if where == "grant": grant = Hostile()
        if where == "clock": object.__setattr__(p, "issued_at", p.issued_at.replace(tzinfo=Clock()))
        with pytest.raises(ValueError): service.register(p, c, sources, grant)
        assert called == [] and rows(engine, "tasks") == []
    finally: engine.dispose()


def test_return_alias_and_journal_hash_tamper_fail_closed(monkeypatch):
    import sqlalchemy as sa
    engine, p, c, sources, _, service, grant = setup(monkeypatch)
    try:
        receipt = service.register(p, c, sources, grant)
        original_id = receipt.receipt_id
        object.__setattr__(receipt, "task_id", "foreign")
        replay = service.register(p, c, sources, grant)
        assert replay.task_id == p.task_id and replay.receipt_id == original_id
        with engine.begin() as db:
            db.execute(sa.text("UPDATE design_artifacts SET content_hash='tampered' WHERE artifact_id=:id"), {"id": grant.grant_id})
        with pytest.raises(ValueError, match="SOURCE_JOURNAL_INVALID"): service.register(p, c, sources, grant)
        assert len(rows(engine, "tasks")) == 1
    finally: engine.dispose()
