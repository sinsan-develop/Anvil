"""Internal bounded owner counts; never a Worker/Provider health judgment."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from packages.persistence.operations_agent_owner_read import (
    AgentOwnerObservation, ScopedAgentOwnerSource,
)


@dataclass(frozen=True, slots=True)
class ScopedAgentOwnerSummary:
    observed_at: datetime
    observed_total: int
    active_owners: int
    revoked_owners: int
    expired_owners: int


def _time(value: object) -> datetime:
    # Reject user-defined datetime/tzinfo callbacks before comparison/conversion.
    if type(value) is not datetime or type(value.tzinfo) not in (timezone, ZoneInfo):
        raise ValueError
    utc = value.astimezone(timezone.utc)
    # R13's DB observation is the clock authority; do not compare two hosts' clocks.
    return datetime(utc.year, utc.month, utc.day, utc.hour, utc.minute,
                    utc.second, utc.microsecond, tzinfo=timezone.utc)


def _identity(value: object) -> bool:
    return (type(value) is str and bool(value) and value == value.strip()
            and len(value.encode("utf-8")) <= 128 and value.isprintable())


def summarize_scoped_agent_owners(source: ScopedAgentOwnerSource) -> ScopedAgentOwnerSummary:
    """Count only an exact R13 observation, without returning sensitive identities."""
    try:
        if type(source) is not ScopedAgentOwnerSource:
            raise ValueError
        at = _time(source.observed_at)
        rows = source.agents
        if type(rows) is not tuple or len(rows) > 100:
            raise ValueError
        seen = set()
        counts = {"ACTIVE": 0, "REVOKED": 0, "EXPIRED": 0}
        for row in rows:
            if (type(row) is not AgentOwnerObservation
                    or not _identity(row.session_id) or not _identity(row.assignment_id)
                    or type(row.generation) is not int or row.generation < 1
                    or type(row.owner_version) is not int or row.owner_version < 1
                    or type(row.status) is not str or row.status not in counts
                    or _time(row.observed_at) != at):
                raise ValueError
            identity = (row.session_id, row.assignment_id)
            if identity in seen:
                raise ValueError
            seen.add(identity)
            counts[row.status] += 1
        return ScopedAgentOwnerSummary(at, len(rows), counts["ACTIVE"],
                                       counts["REVOKED"], counts["EXPIRED"])
    except Exception:
        raise RuntimeError("AGENT_OWNER_SUMMARY_UNAVAILABLE") from None


def _checked_summary(value: ScopedAgentOwnerSummary) -> ScopedAgentOwnerSummary:
    """Detach and validate a host loader result before exposing it to its caller."""
    if type(value) is not ScopedAgentOwnerSummary:
        raise ValueError
    at = _time(value.observed_at)
    counts = (value.observed_total, value.active_owners,
              value.revoked_owners, value.expired_owners)
    if (any(type(count) is not int or not 0 <= count <= 100 for count in counts)
            or sum(counts[1:]) != counts[0]):
        raise ValueError
    return ScopedAgentOwnerSummary(at, *counts)
