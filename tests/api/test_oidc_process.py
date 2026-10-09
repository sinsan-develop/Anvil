"""Server-owned OIDC process configuration and ASGI selection."""

import json
import os
from pathlib import Path
import subprocess
import sys
import socket
import threading
import time

import psycopg
from psycopg.waiting import WAIT_R

import pytest
import sqlalchemy as sa
from sqlalchemy.pool import NullPool
from fastapi import FastAPI

from packages.api.oidc_runtime_factory import OidcRuntimeRejected


ROOT = Path(__file__).resolve().parents[2]
ISSUER = "https://issuer.example.test/realms/anvil"


def _environment(path):
    return {
        "ANVIL_AUTH_MODE": "OIDC",
        "ANVIL_F18_OIDC_TRUST_FILE": str(path),
        "ANVIL_OIDC_ISSUER": ISSUER,
        "ANVIL_OIDC_CLIENT_ID": "anvil-web",
        "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil.example.test",
        "ANVIL_PUBLIC_HOST": "anvil.example.test",
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
    }


def _trust(tmp_path):
    ca = tmp_path / "ca.pem"
    secret = tmp_path / "secret"
    ca.write_text("synthetic CA")
    secret.write_text("synthetic-client-secret")
    payload = {
        "pinned_jwks_json": '{"keys":[]}',
        "allowed_roles": ["operator"],
        "allowed_permissions": ["provider:read"],
        "allowed_project_ids": ["project-1"],
        "allowed_environment_ids": ["wsl-qa"],
        "scope_roles": ["operator"],
        "scope_project_id": "project-1",
        "scope_environment_id": "wsl-qa",
        "ca_bundle_file": str(ca),
        "client_secret_file": str(secret),
    }
    path = tmp_path / "trust.json"
    path.write_text(json.dumps(payload))
    return path, payload, secret


def _rejected(environment):
    from apps.api.anvil_api.oidc_process import load_oidc_process_inputs

    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        load_oidc_process_inputs(environment)
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_oidc_module_import_fails_closed_without_trust():
    env = os.environ.copy()
    for key in tuple(env):
        if key.startswith("ANVIL_") or key.startswith("TELEGRAM_"):
            env.pop(key)
    env["ANVIL_AUTH_MODE"] = "OIDC"
    run = subprocess.run(
        [sys.executable, "-B", "-c", "import apps.api.anvil_api.asgi"],
        cwd=ROOT, env=env, capture_output=True, text=True, timeout=30,
    )
    assert run.returncode != 0
    assert "OIDC_RUNTIME_NOT_CONFIGURED" in run.stderr


def test_loader_accepts_exact_trust_and_reads_secret_lazily(tmp_path, monkeypatch):
    from apps.api.anvil_api.oidc_process import load_oidc_process_inputs

    path, _, secret = _trust(tmp_path)
    original = Path.read_text

    def guarded_read(self, *args, **kwargs):
        if self == secret:
            pytest.fail("secret read during startup")
        return original(self, *args, **kwargs)

    with monkeypatch.context() as patch:
        patch.setattr(Path, "read_text", guarded_read)
        inputs = load_oidc_process_inputs(_environment(path))
    assert inputs.principal_policy.issuer == ISSUER
    assert inputs.authorization_scope.project_id == "project-1"
    assert inputs.authorization_scope.allowed_actor_roles == frozenset({"operator"})
    assert inputs.ca_bundle == str(tmp_path / "ca.pem")
    assert inputs.client_secret() == "synthetic-client-secret"
    assert "synthetic-client-secret" not in repr(inputs)


@pytest.mark.parametrize("change", [
    {"allowed_roles": []},
    {"allowed_roles": ["*"]},
    {"allowed_roles": ["operator", "operator"]},
    {"scope_roles": ["other"]},
    {"scope_project_id": "other"},
    {"scope_environment_id": "other"},
    {"extra": "unknown"},
    {"allowed_permissions": None},
])
def test_loader_rejects_invalid_policy_or_unknown_key(tmp_path, change):
    path, payload, _ = _trust(tmp_path)
    payload.update(change)
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))


def test_loader_rejects_missing_key_duplicate_key_and_oversize(tmp_path):
    path, payload, _ = _trust(tmp_path)
    del payload["allowed_roles"]
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))
    path.write_text('{"x":1,"x":2}')
    _rejected(_environment(path))
    path.write_text(" " * (65536 + 1))
    _rejected(_environment(path))


def test_loader_rejects_relative_and_symlink_paths(tmp_path):
    path, payload, secret = _trust(tmp_path)
    _rejected(_environment(Path("relative.json")))
    link = tmp_path / "link"
    link.symlink_to(path)
    _rejected(_environment(link))
    payload["client_secret_file"] = "relative.secret"
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))
    payload["client_secret_file"] = str(tmp_path / "secret-link")
    (tmp_path / "secret-link").symlink_to(secret)
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))


def test_secret_read_failure_is_stable_and_nonreflective(tmp_path):
    from apps.api.anvil_api.oidc_process import load_oidc_process_inputs

    path, _, secret = _trust(tmp_path)
    inputs = load_oidc_process_inputs(_environment(path))
    secret.unlink()
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        inputs.client_secret()
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_process_factory_binds_one_engine_and_disposes_on_host_failure(tmp_path, monkeypatch):
    from apps.api.anvil_api import oidc_process

    path, _, _ = _trust(tmp_path)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    made = []
    disposed = []
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_kw: made.append(engine) or engine)
    monkeypatch.setattr(engine, "dispose", lambda: disposed.append(True))

    def host(**kwargs):
        assert kwargs["engine"] is engine
        with kwargs["session_factory"]() as session:
            assert session.get_bind() is engine
        assert kwargs["authorization_resolver"](None, {}).project_id == "project-1"
        return FastAPI()

    assert isinstance(oidc_process.create_oidc_process_app(_environment(path), host), FastAPI)
    assert made == [engine] and disposed == []

    def failing_host(**_kwargs):
        raise RuntimeError("sensitive path and DSN")

    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        oidc_process.create_oidc_process_app(_environment(path), failing_host)
    assert error.value.__cause__ is None and error.value.__context__ is None
    assert made == [engine, engine] and disposed == [True]


def test_f19a_reader_creates_fresh_pair_owner_only_when_called(tmp_path, monkeypatch):
    from datetime import datetime, timezone
    from types import SimpleNamespace
    from apps.api.anvil_api import oidc_process

    path, _, _ = _trust(tmp_path)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    made = []
    scoped_reads = []
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_args, **_kwargs: engine)
    for loader_name in ("load_scoped_run_source", "load_scoped_queue_source",
                        "load_scoped_agent_owner_source"):
        monkeypatch.setattr(oidc_process, loader_name,
            lambda _engine, project_id, environment_id, label=loader_name:
                scoped_reads.append((label, project_id, environment_id)) or
                SimpleNamespace(observed_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
                    run_ids=(), job_ids=(), agents=(), legacy_unscoped_present=False))

    class Owner:
        def __init__(self, dsn):
            made.append(dsn)

        def load_complete(self, project_id, environment_id):
            made.append((project_id, environment_id))
            return ()

        def load(self, _project_id, _environment_id):
            return ()

        def append(self, *_args):
            raise AssertionError("read-only fixture")

    monkeypatch.setattr(oidc_process, "_F19ABoundedOperationsRepository", Owner)
    captured = {}

    def host(**kwargs):
        captured.update(kwargs)
        return FastAPI()

    oidc_process.create_oidc_process_app(_environment(path), host, f19a_enabled=True)
    assert callable(captured["scoped_dashboard_reader"])
    assert len(made) == 1  # existing fixed Operations owner, no pair reader yet
    captured["scoped_dashboard_reader"]("other-project", "test", "1d",
        datetime(2024, 3, 1, tzinfo=timezone.utc))
    assert made[-2:] == [made[0], ("other-project", "test")]
    assert {name for name, project, environment in scoped_reads
            if (project, environment) == ("other-project", "test")} == {
                "load_scoped_run_source", "load_scoped_queue_source",
                "load_scoped_agent_owner_source"}
    engine.dispose()


def test_f19a_process_bounds_psycopg_engine_and_operations_connections(tmp_path, monkeypatch):
    from psycopg.conninfo import conninfo_to_dict
    from apps.api.anvil_api import oidc_process

    path, _, _ = _trust(tmp_path)
    environment = _environment(path)
    environment["ANVIL_DATABASE_URL"] = (
        "postgresql://synthetic:p%40ssword@isolated.invalid/anvil"
        "?application_name=f19a-qa&sslmode=require"
    )
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    engine_calls = []
    operations_dsns = []

    def engine_factory(dsn, **kwargs):
        engine_calls.append((dsn, kwargs))
        return engine

    class RecordingOperationsRepository:
        def __init__(self, dsn):
            operations_dsns.append(dsn)

        def load(self, _project_id, _environment_id):
            return ()

        def append(self, *_args):
            raise AssertionError("read-only fixture")

    monkeypatch.setattr(oidc_process, "create_engine", engine_factory)
    monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", RecordingOperationsRepository)
    monkeypatch.setattr(oidc_process, "_F19ABoundedOperationsRepository", RecordingOperationsRepository)
    try:
        for enabled in (False, True):
            assert isinstance(oidc_process.create_oidc_process_app(
                environment, lambda **_kwargs: FastAPI(), f19a_enabled=enabled
            ), FastAPI)
        legacy_dsn, legacy_kwargs = engine_calls[0]
        assert legacy_dsn.startswith("postgresql+psycopg://")
        assert legacy_kwargs == {"pool_pre_ping": True}
        assert conninfo_to_dict(operations_dsns[0]) == {
            "user": "synthetic", "password": "p@ssword",
            "host": "isolated.invalid", "dbname": "anvil", "application_name": "f19a-qa",
            "sslmode": "require",
        }

        f19a_dsn, f19a_kwargs = engine_calls[1]
        assert f19a_dsn == legacy_dsn
        assert f19a_kwargs["poolclass"] is NullPool
        assert f19a_kwargs["pool_pre_ping"] is True
        assert callable(f19a_kwargs["creator"])
        assert conninfo_to_dict(operations_dsns[1]) == {
            "user": "synthetic", "password": "p@ssword",
            "host": "isolated.invalid", "dbname": "anvil", "application_name": "f19a-qa",
            "sslmode": "require",
            "connect_timeout": "3", "tcp_user_timeout": "4000",
        }
    finally:
        engine.dispose()


def test_f19a_connected_read_deadline_closes_connection_without_background_wait():
    from apps.api.anvil_api import oidc_process

    reader, writer = socket.socketpair()
    class StalledConnection:
        def __init__(self):
            self.pgconn = type("PGconn", (), {"socket": reader.fileno()})()
            self.closed = False
            self.rollback_calls = 0

        def close(self):
            self.closed = True

        def rollback(self):
            self.rollback_calls += 1

    connection = StalledConnection()
    def stalled_read():
        while True:
            yield WAIT_R

    started = time.monotonic()
    token = oidc_process._f19a_db_deadline.set(started + 0.05)
    try:
        with pytest.raises(psycopg.OperationalError, match="F19A_DB_DEADLINE_EXCEEDED"):
            oidc_process._F19ABoundedConnection.wait(connection, stalled_read())
        psycopg.Connection.__exit__(connection, psycopg.OperationalError,
            psycopg.OperationalError("deadline"), None)
        assert connection.closed is True
        assert connection.rollback_calls == 0
        assert time.monotonic() - started < 0.5
    finally:
        oidc_process._f19a_db_deadline.reset(token)
        reader.close()
        writer.close()


def test_f19a_late_readiness_cannot_succeed_after_deadline():
    from apps.api.anvil_api import oidc_process

    reader, writer = socket.socketpair()
    class Connection:
        pgconn = type("PGconn", (), {"socket": reader.fileno()})()
        closed = False
        def close(self):
            self.closed = True

    connection = Connection()
    def late_success():
        yield WAIT_R
        return "should-not-succeed"

    timer = threading.Timer(0.04, lambda: writer.send(b"ready"))
    token = oidc_process._f19a_db_deadline.set(time.monotonic() + 0.02)
    try:
        timer.start()
        with pytest.raises(psycopg.OperationalError, match="F19A_DB_DEADLINE_EXCEEDED"):
            oidc_process._F19ABoundedConnection.wait(connection, late_success(), interval=0.2)
        assert connection.closed is True
    finally:
        timer.join(timeout=1)
        oidc_process._f19a_db_deadline.reset(token)
        reader.close()
        writer.close()


def test_f19a_ready_read_completes_before_deadline_without_closing():
    from apps.api.anvil_api import oidc_process

    reader, writer = socket.socketpair()
    class Connection:
        pgconn = type("PGconn", (), {"socket": reader.fileno()})()
        closed = False
        def close(self):
            self.closed = True

    def ready_read():
        yield WAIT_R
        return "ready"

    connection = Connection()
    token = oidc_process._f19a_db_deadline.set(time.monotonic() + 1)
    try:
        writer.send(b"ready")
        assert oidc_process._F19ABoundedConnection.wait(connection, ready_read()) == "ready"
        assert connection.closed is False
    finally:
        oidc_process._f19a_db_deadline.reset(token)
        reader.close()
        writer.close()


def test_f19a_engine_and_operations_use_same_bounded_connection(tmp_path, monkeypatch):
    from apps.api.anvil_api import oidc_process

    path, _, _ = _trust(tmp_path)
    environment = _environment(path)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    engine_calls = []
    host_calls = []
    connects = []
    sentinel = object()
    monkeypatch.setattr(oidc_process, "create_engine", lambda dsn, **kwargs:
        engine_calls.append(kwargs) or engine)
    monkeypatch.setattr(oidc_process._F19ABoundedConnection, "connect",
        lambda dsn: connects.append(dsn) or sentinel)
    try:
        oidc_process.create_oidc_process_app(environment,
            lambda **kwargs: host_calls.append(kwargs) or FastAPI(), f19a_enabled=True)
        assert engine_calls[0]["creator"]() is sentinel
        assert host_calls[0]["operations_owner"]._repository._connect() is sentinel
        assert len(connects) == 2
        assert all("connect_timeout=3" in dsn and "tcp_user_timeout=4000" in dsn
                   for dsn in connects)
    finally:
        engine.dispose()


def test_f19a_connect_uses_remaining_request_budget_and_rejects_expired(monkeypatch):
    from psycopg.conninfo import conninfo_to_dict
    from apps.api.anvil_api import oidc_process

    captured = []
    sentinel = object()
    monkeypatch.setattr(oidc_process._F19ABoundedConnection, "connect",
        lambda dsn: captured.append(conninfo_to_dict(dsn)) or sentinel)
    dsn = "postgresql://synthetic:p%40ssword@isolated.invalid/anvil?application_name=f19a-qa"
    token = oidc_process._f19a_db_deadline.set(time.monotonic() + 0.2)
    try:
        assert oidc_process._f19a_connect(dsn) is sentinel
        assert captured[0]["connect_timeout"] == "1"
        assert captured[0]["password"] == "p@ssword"
    finally:
        oidc_process._f19a_db_deadline.reset(token)
    token = oidc_process._f19a_db_deadline.set(time.monotonic() - 1)
    try:
        with pytest.raises(psycopg.OperationalError, match="F19A_DB_DEADLINE_EXCEEDED"):
            oidc_process._f19a_connect(dsn)
        assert len(captured) == 1
    finally:
        oidc_process._f19a_db_deadline.reset(token)


@pytest.mark.parametrize("flag,expected", [("1", True), ("0", False), ("true", False)])
def test_process_factory_preserves_operational_shell_flag(tmp_path, monkeypatch, flag, expected):
    from apps.api.anvil_api import oidc_process

    path, _, _ = _trust(tmp_path)
    environment = _environment(path)
    environment["ANVIL_F15_OPERATIONAL_SHELL"] = flag
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_kw: engine)
    observed = []

    def host(**kwargs):
        observed.append(kwargs.get("operational_shell"))
        return FastAPI()

    try:
        oidc_process.create_oidc_process_app(environment, host)
        assert observed == [expected]
    finally:
        engine.dispose()


@pytest.mark.parametrize("dsn,expected", [
    ("postgresql://user:password@isolated.invalid/anvil", "postgresql://user:password@isolated.invalid/anvil"),
    ("postgresql+psycopg://user:password@isolated.invalid/anvil", "postgresql://user:password@isolated.invalid/anvil"),
    ("postgresql+psycopg2://user:password@isolated.invalid/anvil", "postgresql://user:password@isolated.invalid/anvil"),
])
def test_process_binds_scoped_operations_owner_with_psycopg_dsn(tmp_path, monkeypatch, dsn, expected):
    from apps.api.anvil_api import oidc_process
    from packages.observability.service import OperationsService

    path, _, _ = _trust(tmp_path)
    environment = _environment(path)
    environment["ANVIL_DATABASE_URL"] = dsn
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_args, **_kwargs: engine)
    supplied = []

    class RecordingPostgresRepository:
        def __init__(self, value):
            supplied.append(value)

        def load(self, project_id, environment_id):
            return ()

        def append(self, project_id, environment_id, expected_sequence, event):
            raise AssertionError("GET must not append")

    monkeypatch.setattr(oidc_process, "PostgresOperationsRepository", RecordingPostgresRepository, raising=False)
    observed = []

    def host(**kwargs):
        observed.append(kwargs)
        return FastAPI()

    try:
        assert isinstance(oidc_process.create_oidc_process_app(environment, host), FastAPI)
        owner = observed[0]["operations_owner"]
        assert type(owner) is OperationsService
        assert (owner.project_id, owner.environment_id) == ("project-1", "wsl-qa")
        assert owner.alert_page() == {"alerts": [], "next_before_sequence": None}
        assert supplied == [expected]
    finally:
        engine.dispose()


def test_process_rejects_non_postgresql_operations_dsn_without_reflection(tmp_path):
    from apps.api.anvil_api.oidc_process import create_oidc_process_app

    path, _, _ = _trust(tmp_path)
    environment = _environment(path)
    environment["ANVIL_DATABASE_URL"] = "mysql://secret@isolated.invalid/anvil"
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        create_oidc_process_app(environment, lambda **_kwargs: pytest.fail("host must not start"))
    assert error.value.__cause__ is None and error.value.__context__ is None
