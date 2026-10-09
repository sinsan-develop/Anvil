"""Fail-closed server-only OIDC process bootstrap."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import re
import stat
import time

from fastapi import FastAPI
import psycopg
from psycopg.conninfo import make_conninfo
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from packages.api.fastapi_app import AuthorizationScope, _f19a_db_deadline
from packages.api.scoped_dashboard import read_scoped_dashboard
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.oidc_runtime_factory import OidcRuntimeRejected
from packages.agent_team.provider_status import ProviderStatusService
from packages.persistence.config import DatabaseSettings
from packages.persistence.operations_repository import PostgresOperationsRepository
from packages.persistence.operations_queue_read import load_scoped_queue_source
from packages.persistence.operations_budget_read import load_scoped_budget_source
from packages.persistence.operations_run_read import load_scoped_run_source
from packages.persistence.operations_agent_owner_read import load_scoped_agent_owner_source
from packages.observability.agent_owner_summary import (
    ScopedAgentOwnerSummary, summarize_scoped_agent_owners,
)
from packages.observability.projection import OperationsSources
from packages.observability.models import HealthSignal
from packages.observability.run_status_summary import ScopedRunStatusSummary, summarize_scoped_runs
from packages.observability.service import OperationsService


_KEYS = frozenset({
    "pinned_jwks_json", "allowed_roles", "allowed_permissions",
    "allowed_project_ids", "allowed_environment_ids", "scope_roles",
    "scope_project_id", "scope_environment_id", "ca_bundle_file",
    "client_secret_file",
})
_POLICY = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z", re.ASCII)


class _F19ABoundedConnection(psycopg.Connection):
    """End a stalled libpq read by closing this request's own connection."""

    def wait(self, gen, interval: float = 0.05):
        deadline = _f19a_db_deadline.get()
        if deadline is None:
            return super().wait(gen, interval=interval)

        def bounded():
            try:
                state = next(gen)
                while True:
                    if time.monotonic() >= deadline:
                        # A COMMIT already sent to the server has an unknown outcome.
                        self.close()
                        raise psycopg.OperationalError("F19A_DB_DEADLINE_EXCEEDED")
                    ready = yield state
                    if time.monotonic() >= deadline:
                        self.close()
                        raise psycopg.OperationalError("F19A_DB_DEADLINE_EXCEEDED")
                    state = gen.send(ready)
            except StopIteration as finished:
                return finished.value

        return psycopg.Connection.wait(self, bounded(), interval=interval)


def _f19a_connect(dsn: str):
    deadline = _f19a_db_deadline.get()
    remaining = None if deadline is None else deadline - time.monotonic()
    if remaining is not None and remaining <= 0:
        raise psycopg.OperationalError("F19A_DB_DEADLINE_EXCEEDED")
    timeout = 3 if remaining is None else min(3, max(1, math.ceil(remaining)))
    return _F19ABoundedConnection.connect(make_conninfo(dsn, connect_timeout=timeout))


class _F19ABoundedOperationsRepository(PostgresOperationsRepository):
    def _connect(self):
        return _f19a_connect(self._dsn)


def _reject() -> OidcRuntimeRejected:
    return OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")


def _regular_path(value: object) -> Path:
    if type(value) is not str or not value or "\x00" in value:
        raise _reject()
    path = Path(value)
    if not path.is_absolute() or not stat.S_ISREG(path.lstat().st_mode):
        raise _reject()
    return path


def _read_bounded(path: Path, limit: int) -> bytes:
    if path.stat().st_size > limit:
        raise _reject()
    # O_NOFOLLOW closes the final-component replacement window on POSIX.
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise _reject()
        contents = os.read(descriptor, limit + 1)
        if len(contents) > limit:
            raise _reject()
        return contents
    finally:
        os.close(descriptor)


def _set(value: object) -> frozenset[str]:
    if (type(value) is not list or not value
            or any(type(item) is not str or _POLICY.fullmatch(item) is None for item in value)
            or len(set(value)) != len(value)):
        raise _reject()
    return frozenset(value)


def _value(value: object) -> str:
    if type(value) is not str or _POLICY.fullmatch(value) is None:
        raise _reject()
    return value


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise _reject()
        result[key] = value
    return result


@dataclass(frozen=True)
class OidcProcessInputs:
    principal_policy: OidcPrincipalPolicy
    authorization_scope: AuthorizationScope
    pinned_jwks_json: str = field(repr=False)
    ca_bundle: str
    client_secret: Callable[[], str] = field(repr=False)


def _load_oidc_process_inputs(environment: Mapping[str, str]) -> OidcProcessInputs:
    try:
        if not isinstance(environment, Mapping):
            raise _reject()
        path = _regular_path(environment.get("ANVIL_F18_OIDC_TRUST_FILE"))
        document = json.loads(_read_bounded(path, 65536).decode("utf-8"),
                              object_pairs_hook=_unique_pairs)
        if type(document) is not dict or set(document) != _KEYS:
            raise _reject()
        if type(document["pinned_jwks_json"]) is not str or not document["pinned_jwks_json"]:
            raise _reject()
        roles = _set(document["allowed_roles"])
        permissions = _set(document["allowed_permissions"])
        projects = _set(document["allowed_project_ids"])
        environments = _set(document["allowed_environment_ids"])
        scope_roles = _set(document["scope_roles"])
        scope_project = _value(document["scope_project_id"])
        scope_environment = _value(document["scope_environment_id"])
        if (not scope_roles <= roles or scope_project not in projects
                or scope_environment not in environments):
            raise _reject()
        ca = _regular_path(document["ca_bundle_file"])
        secret_path = _regular_path(document["client_secret_file"])
        issuer = environment.get("ANVIL_OIDC_ISSUER")
        if type(issuer) is not str or not issuer:
            raise _reject()

        def client_secret() -> str:
            try:
                _regular_path(str(secret_path))
                value = _read_bounded(secret_path, 4096).decode("utf-8")
                if not value or value != value.strip() or any(ord(ch) < 33 for ch in value):
                    raise _reject()
            except Exception:
                value = None
            if value is None:
                raise _reject()
            return value

        return OidcProcessInputs(
            OidcPrincipalPolicy(issuer, roles, permissions, projects, environments),
            AuthorizationScope(scope_project, scope_environment, scope_roles),
            document["pinned_jwks_json"], str(ca), client_secret,
        )
    except Exception:
        return None


def load_oidc_process_inputs(environment: Mapping[str, str]) -> OidcProcessInputs:
    """Load exact server trust without reading the code-exchange secret."""
    inputs = _load_oidc_process_inputs(environment)
    if inputs is None:
        raise _reject()
    return inputs


def create_oidc_process_app(
    environment: Mapping[str, str], host_factory: Callable[..., FastAPI],
    *, f19a_enabled: bool = False,
) -> FastAPI:
    """Bind one Engine and session factory to the existing OIDC ASGI host."""
    if type(f19a_enabled) is not bool:
        raise _reject()
    inputs = load_oidc_process_inputs(environment)
    engine = None
    try:
        settings = DatabaseSettings.from_environment(environment)
        engine_options = {"pool_pre_ping": True}
        if f19a_enabled:
            engine_options["poolclass"] = NullPool
        operations_dsn = settings.dsn
        if operations_dsn.startswith("postgresql+psycopg://"):
            operations_dsn = "postgresql://" + operations_dsn[len("postgresql+psycopg://"):]
        if f19a_enabled:
            operations_dsn = make_conninfo(
                operations_dsn, connect_timeout=3, tcp_user_timeout=4000
            )
            engine_options["creator"] = lambda: _f19a_connect(operations_dsn)
        engine = create_engine(settings.dsn, **engine_options)
        sessions = sessionmaker(bind=engine, expire_on_commit=False)
        scope = inputs.authorization_scope

        snapshot_started_at: ContextVar[datetime | None] = ContextVar(
            "anvil_database_health_snapshot_started_at", default=None)
        required_head = "0020_f19a_pair_grants" if f19a_enabled else "0019_oidc_sessions"

        def operations_clock() -> datetime:
            now = datetime.now(timezone.utc)
            snapshot_started_at.set(now)
            return now

        def database_signal(observed_at: datetime | None) -> HealthSignal | None:
            if observed_at is None or observed_at.tzinfo is None:
                return None
            try:
                with engine.connect() as connection:
                    query_result = connection.execute(text("SELECT 1")).scalar_one()
                    heads = connection.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
                completed_at = datetime.now(timezone.utc)
                if (query_result != 1 or heads != [required_head]
                        or completed_at < observed_at
                        or completed_at - observed_at > timedelta(seconds=5)):
                    return None
            except Exception:
                return None
            fingerprint = json.dumps({"component": "database", "project_id": scope.project_id,
                "environment_id": scope.environment_id, "observed_at": observed_at.isoformat(),
                "migration_head": heads[0], "query_result": query_result},
                sort_keys=True, separators=(",", ":"))
            return HealthSignal("database", "HEALTHY", observed_at, timedelta(minutes=5), 0,
                                "sha256:" + sha256(fingerprint.encode()).hexdigest(),
                                "/operations/health")

        def load_queue_sources(project_id: str, environment_id: str) -> OperationsSources:
            if (type(project_id) is not str or type(environment_id) is not str
                    or (project_id, environment_id) != (scope.project_id, scope.environment_id)):
                raise ValueError("QUEUE_SOURCE_SCOPE_INVALID")
            observed_at = snapshot_started_at.get()
            snapshot_started_at.set(None)
            queue = load_scoped_queue_source(engine, scope.project_id, scope.environment_id)
            budget = load_scoped_budget_source(engine, scope.project_id, scope.environment_id)
            signal = database_signal(observed_at)
            return OperationsSources(queue=queue, queue_job_ids=queue.job_ids,
                                     budget=budget, budget_ids=budget.budget_ids,
                                     reservation_ids=budget.reservation_ids,
                                     provider=ProviderStatusService(environment),
                                     health_signals=(signal,) if signal is not None else ())

        def load_run_summary(project_id: str, environment_id: str) -> ScopedRunStatusSummary:
            if (project_id, environment_id) != (scope.project_id, scope.environment_id):
                raise ValueError("RUN_SOURCE_SCOPE_INVALID")
            return summarize_scoped_runs(
                load_scoped_run_source(engine, scope.project_id, scope.environment_id)
            )

        def load_agent_owner_summary(project_id: str, environment_id: str) -> ScopedAgentOwnerSummary:
            if (type(project_id) is not str or type(environment_id) is not str
                    or (project_id, environment_id) != (scope.project_id, scope.environment_id)):
                raise ValueError("AGENT_SOURCE_SCOPE_INVALID")
            return summarize_scoped_agent_owners(
                load_scoped_agent_owner_source(engine, scope.project_id, scope.environment_id)
            )

        operations_owner = OperationsService(
            scope.project_id, scope.environment_id, OperationsSources(),
            repository=(_F19ABoundedOperationsRepository(operations_dsn) if f19a_enabled
                        else PostgresOperationsRepository(operations_dsn)),
            clock=operations_clock,
            source_loader=load_queue_sources,
            run_summary_loader=load_run_summary,
            agent_owner_summary_loader=load_agent_owner_summary,
        )

        def scoped_dashboard_reader(project_id: str, environment_id: str,
                                    period_key: str, observed_at: datetime) -> dict:
            # The API calls this only after exact-pair authorization. Never reuse the
            # fixed host Operations owner or an owner from another request/pair.
            owner = _F19ABoundedOperationsRepository(operations_dsn)
            current_sources = {}
            for name, loader in (("run", load_scoped_run_source),
                                 ("queue", load_scoped_queue_source),
                                 ("agent", load_scoped_agent_owner_source)):
                try:
                    current_sources[name] = loader(engine, project_id, environment_id)
                except Exception:
                    # Each optional card remains explicitly unavailable; the audit
                    # itself is mandatory and fails the entire read if incomplete.
                    pass
            return read_scoped_dashboard(project_id, environment_id, period_key,
                                         observed_at, owner, current_sources)

        return host_factory(
            environment=environment, engine=engine, session_factory=sessions,
            authorization_resolver=lambda _endpoint, _params: scope,
            principal_policy=inputs.principal_policy,
            pinned_jwks_json=inputs.pinned_jwks_json,
            client_secret=inputs.client_secret, ca_bundle=inputs.ca_bundle,
            operational_shell=environment.get("ANVIL_F15_OPERATIONAL_SHELL") == "1",
            operations_owner=operations_owner,
            **({"scoped_dashboard_reader": scoped_dashboard_reader} if f19a_enabled else {}),
            **({"f19a_enabled": True} if f19a_enabled else {}),
        )
    except Exception:
        if engine is not None:
            engine.dispose()
    raise _reject()
