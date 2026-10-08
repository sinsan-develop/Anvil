"""R36 internal observation, not Agent health or public Dashboard evidence."""

from dataclasses import asdict, fields, replace
from datetime import datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo

import pytest

from packages.persistence.operations_agent_owner_read import (
    AgentOwnerObservation, ScopedAgentOwnerSource,
)


NOW = datetime(2026, 9, 30, tzinfo=timezone.utc)


def row(index=0, **changes):
    return replace(AgentOwnerObservation(f"session-{index}", f"assignment-{index}",
                                        1, 1, "ACTIVE", NOW), **changes)


def summary(source):
    from packages.observability.agent_owner_summary import summarize_scoped_agent_owners
    return summarize_scoped_agent_owners(source)


@pytest.mark.parametrize("count", [0, 100])
def test_exact_bounded_observation_counts_and_no_identity_disclosure(count):
    source = ScopedAgentOwnerSource(tuple(row(i) for i in range(count)), NOW)
    before = asdict(source)
    result = summary(source)
    assert asdict(result) == dict(observed_at=NOW, observed_total=count,
                                 active_owners=count, revoked_owners=0, expired_owners=0)
    assert asdict(source) == before
    assert {field.name for field in fields(result)} == {
        "observed_at", "observed_total", "active_owners", "revoked_owners", "expired_owners"}
    assert "session-" not in repr(result) and "assignment-" not in repr(result)
    with pytest.raises(AttributeError):
        result.active_owners = 900


def test_mixed_states_and_shared_session_distinct_assignment_are_valid():
    source = ScopedAgentOwnerSource((row(), row(1, session_id="session-0", status="REVOKED"),
                                    row(2, status="EXPIRED")), NOW)
    result = summary(source)
    assert (result.observed_total, result.active_owners,
            result.revoked_owners, result.expired_owners) == (3, 1, 1, 1)


@pytest.mark.parametrize("source", [
    None, {}, ScopedAgentOwnerSource([], NOW),
    ScopedAgentOwnerSource(tuple(row(i) for i in range(101)), NOW),
    ScopedAgentOwnerSource((row(), row(owner_version=2)), NOW),
    ScopedAgentOwnerSource((object(),), NOW),
    ScopedAgentOwnerSource((), NOW.replace(tzinfo=None)),
    ScopedAgentOwnerSource((row(observed_at=NOW + timedelta(seconds=1)),), NOW),
    *[ScopedAgentOwnerSource((row(**{field: value}),), NOW)
      for field, values in {
          "session_id": [None, "", " x", "x\n", "x" * 129, "한" * 100],
          "assignment_id": [None, "", [], True],
          "generation": [0, -1, True, "1"],
          "owner_version": [0, -1, True, "1"],
          "status": ["UNKNOWN", "active", [], 0],
      }.items() for value in values],
])
def test_invalid_or_partial_source_fails_without_sensitive_details(source):
    with pytest.raises(RuntimeError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
        summary(source)


def test_safe_timezone_detached_and_source_alias_does_not_change_result():
    at = NOW.astimezone(ZoneInfo("Asia/Seoul"))
    source = ScopedAgentOwnerSource((row(observed_at=at),), at)
    result = summary(source)
    assert result.observed_at == NOW and result.observed_at.tzinfo is timezone.utc
    object.__setattr__(source, "observed_at", NOW + timedelta(days=3))
    object.__setattr__(source.agents[0], "status", "REVOKED")
    assert asdict(result) == dict(observed_at=NOW, observed_total=1,
                                 active_owners=1, revoked_owners=0, expired_owners=0)


def test_db_observation_is_authoritative_not_the_application_wall_clock():
    at = datetime(2099, 1, 1, tzinfo=timezone.utc)
    result = summary(ScopedAgentOwnerSource((row(observed_at=at),), at))
    assert result.observed_at == at and result.active_owners == 1


def test_hostile_scalar_datetime_and_timezone_callbacks_are_not_called():
    calls = []

    class Hostile(str):
        def __hash__(self):
            calls.append("hash")
            raise AssertionError

        def __eq__(self, other):
            calls.append("eq")
            raise AssertionError

    class Clock(tzinfo):
        def utcoffset(self, dt):
            calls.append("tz")
            return timedelta(0)

    class Date(datetime):
        def utcoffset(self):
            calls.append("dt")
            return timedelta(0)

    for source in (ScopedAgentOwnerSource((row(status=Hostile("ACTIVE")),), NOW),
                   ScopedAgentOwnerSource((), NOW.replace(tzinfo=Clock())),
                   ScopedAgentOwnerSource((), Date(2026, 9, 30, tzinfo=timezone.utc))):
        with pytest.raises(RuntimeError, match="^AGENT_OWNER_SUMMARY_UNAVAILABLE$"):
            summary(source)
    assert calls == []
