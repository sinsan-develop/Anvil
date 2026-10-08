"""Bounded internal observation of owners in an already authorized scope.

The caller supplies a trusted PostgreSQL Engine and authorized scope IDs.
This port does not establish authorization or publish a Dashboard response.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.engine import Engine

from packages.persistence.agent_team_owner_repository import SqlAlchemyAgentTeamOwnerRepository


_MAX_ROWS = 100


@dataclass(frozen=True, slots=True)
class AgentOwnerObservation:
    session_id: str
    assignment_id: str
    generation: int
    owner_version: int
    status: str
    observed_at: datetime


@dataclass(frozen=True)
class ScopedAgentOwnerSource:
    agents: tuple[AgentOwnerObservation, ...]
    observed_at: datetime


_HEADS_SQL = text("""SELECT scope_key, project_id, environment_id, session_id,
    assignment_id, generation, owner_version, revoked_through, snapshot_hash,
    snapshot_json
FROM agent_owner_heads
WHERE project_id = :project_id AND environment_id = :environment_id
ORDER BY scope_key LIMIT 101""")


def _scope_id(value: object) -> bool:
    if type(value) is not str or not value or value != value.strip():
        return False
    try:
        return len(value.encode("utf-8")) <= 128 and value.isprintable()
    except UnicodeError:
        return False


def _db_time(value: object) -> datetime:
    if type(value) is not datetime or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("malformed DB time")
    return value.astimezone(timezone.utc)


def load_scoped_agent_owner_source(
    engine: Engine, project_id: str, environment_id: str,
) -> ScopedAgentOwnerSource:
    """Read up to 100 validated heads in one repeatable-read, read-only transaction.

    Any overflow, malformed row, snapshot integrity failure, or DB error is
    converted to a single non-sensitive unavailable code.
    """
    if not _scope_id(project_id) or not _scope_id(environment_id):
        raise ValueError("AGENT_SOURCE_SCOPE_INVALID")
    params = {"project_id": project_id, "environment_id": environment_id}
    try:
        with engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                connection.execute(text("SET TRANSACTION READ ONLY"))
                observed_at = _db_time(connection.execute(
                    text("SELECT CURRENT_TIMESTAMP AS observed_at")
                ).mappings().one()["observed_at"])
                rows = connection.execute(_HEADS_SQL, params).mappings().all()
                if len(rows) > _MAX_ROWS:
                    raise ValueError("overflow")
                agents = []
                seen = set()
                repository = SqlAlchemyAgentTeamOwnerRepository()
                for row in rows:
                    key = row["scope_key"]
                    generation = row["generation"]
                    version = row["owner_version"]
                    revoked = row["revoked_through"]
                    if (type(key) is not str or key in seen
                            or row["project_id"] != project_id
                            or row["environment_id"] != environment_id
                            or type(generation) is not int or generation < 1
                            or type(version) is not int or version < 1
                            or type(revoked) is not int or not 0 <= revoked <= generation):
                        raise ValueError("malformed owner head")
                    seen.add(key)
                    snapshot = repository._stored(row)
                    if observed_at < snapshot.created_at:
                        raise ValueError("owner not yet valid at DB time")
                    if revoked >= generation:
                        status = "REVOKED"
                    elif observed_at >= snapshot.expires_at:
                        status = "EXPIRED"
                    else:
                        status = "ACTIVE"
                    agents.append(AgentOwnerObservation(
                        session_id=snapshot.binding.session_id,
                        assignment_id=snapshot.binding.assignment_id,
                        generation=generation, owner_version=version,
                        status=status, observed_at=observed_at,
                    ))
        return ScopedAgentOwnerSource(agents=tuple(agents), observed_at=observed_at)
    except Exception:
        raise RuntimeError("AGENT_SOURCE_UNAVAILABLE") from None
