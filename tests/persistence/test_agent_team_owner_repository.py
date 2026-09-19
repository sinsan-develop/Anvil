"""C30R2 local SQL contracts are NOT PostgreSQL/runtime acceptance evidence."""
from contextlib import contextmanager
from dataclasses import fields, replace
from datetime import datetime, timedelta, timezone
import hashlib
import importlib
import importlib.util
import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import Session
from alembic.migration import MigrationContext
from alembic.operations import Operations

ROOT = Path(__file__).resolve().parents[2]
MODULE = "packages.persistence.agent_team_owner_repository"


def product():
    assert importlib.util.find_spec(MODULE), "C30R2_REPOSITORY_NOT_IMPLEMENTED"
    return importlib.import_module(MODULE)


def migration():
    path = ROOT / "migrations/versions/0015_agent_team_owner.py"
    assert path.is_file(), "C30R2_MIGRATION_NOT_IMPLEMENTED"
    spec = importlib.util.spec_from_file_location("c30r2_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def primitive(value):
    if type(value) is datetime:
        return value.isoformat(timespec="microseconds")
    if type(value) is tuple:
        return [primitive(item) for item in value]
    if hasattr(type(value), "__dataclass_fields__"):
        return {f.name: primitive(getattr(value, f.name)) for f in fields(value)}
    return value


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return "sha256:" + hashlib.sha256(value.encode()).hexdigest()


def sealed(value, field="content_hash"):
    data = primitive(value)
    del data[field]
    return replace(value, **{field: digest(canonical(data))})


def sample(*, generation=1, version=1, execution="execution-1"):
    m = product()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    binding = m.OwnerBinding("project", "local", "session", "assignment", generation,
        "reader", "context", "workspace", digest("baseline"), digest("target"),
        digest("assignment"), execution, None)
    principal = sealed(m.PrincipalMapping(binding, digest("auth-session"), generation,
        "reader", "TESTER", ("tasks:read",), now-timedelta(minutes=1),
        now+timedelta(hours=1), ""), "mapping_hash")
    def component(kind):
        body = canonical({"schema": kind.lower()+"/v1", "records": []})
        return m.OwnerComponent(kind, 1, body, digest(body))
    snapshot = sealed(m.OwnerSnapshot(binding, version, component("ROLE_POLICY"),
        component("ROLE_RESULTS"), component("TEAM"), None, (principal,),
        now-timedelta(minutes=1), now+timedelta(hours=1), ""))
    return snapshot, principal


def receipt(snapshot, principal, *, request="request", response='{"count":0}'):
    m = product()
    return sealed(m.ProjectionReceipt("receipt-"+request, request, digest("query-"+request),
        snapshot.binding, snapshot.owner_version, snapshot.content_hash,
        principal.mapping_hash, "team", response, digest(response),
        datetime.now(timezone.utc).replace(microsecond=0), ""))


@contextmanager
def database():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    # Real BEGIN is required: sqlite3 legacy savepoints otherwise commit outside
    # SQLAlchemy's logical outer transaction. This is local SQL evidence only.
    @event.listens_for(engine, "connect")
    def configured(dbapi_connection, _):
        dbapi_connection.isolation_level = None
    @event.listens_for(engine, "begin")
    def begun(connection):
        connection.exec_driver_sql("BEGIN")
    m = migration()
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            m.upgrade()
    try:
        yield engine
    finally:
        engine.dispose()


def test_local_sql_roundtrip_restart_detached_and_caller_rollback():
    m = product()
    snapshot, principal = sample()
    with database() as engine:
        with Session(engine) as s, s.begin():
            out = m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
                s, snapshot=snapshot, expected_version=0, request_id="create")
            assert out == snapshot and out is not snapshot
        object.__setattr__(out.binding, "actor_id", "mutated")
        with Session(engine) as s, s.begin():
            repo = m.SqlAlchemyAgentTeamOwnerRepository()
            loaded = repo.load_current_owner(s, binding=snapshot.binding, principal=principal)
            assert loaded.binding.actor_id == "reader"
            saved = repo.save_receipt(s, binding=snapshot.binding, principal=principal,
                receipt=receipt(snapshot, principal), expected_version=1)
            object.__setattr__(saved, "response_json", "mutated")
        with Session(engine) as s, s.begin():
            repo = m.SqlAlchemyAgentTeamOwnerRepository()
            assert repo.load_receipt(s, binding=snapshot.binding, principal=principal,
                request_id="request").response_json == '{"count":0}'
        with Session(engine) as s:
            with pytest.raises(RuntimeError):
                with s.begin():
                    repo.revoke_generation(s, binding=snapshot.binding, expected_version=1,
                        request_id="revoke-rolled-back", reason="OWNER_REVOKED")
                    raise RuntimeError("caller rollback")
        with Session(engine) as s, s.begin():
            assert repo.load_current_owner(s, binding=snapshot.binding, principal=principal)


def test_local_generation_revocation_restart_never_revives():
    m = product()
    first, principal = sample()
    second, principal2 = sample(generation=2, version=3, execution="execution-2")
    with database() as engine:
        with Session(engine) as s, s.begin():
            repo = m.SqlAlchemyAgentTeamOwnerRepository()
            repo.save_owner_snapshot(s, snapshot=first, expected_version=0, request_id="first")
            revoked = repo.revoke_generation(s, binding=first.binding, expected_version=1,
                request_id="revoke", reason="OWNER_REVOKED")
            assert revoked.revoked_through_generation == 1 and revoked.owner_version == 2
            assert repo.revoke_generation(s, binding=first.binding, expected_version=1,
                request_id="revoke", reason="OWNER_REVOKED") == revoked
        with Session(engine) as s, s.begin():
            repo = m.SqlAlchemyAgentTeamOwnerRepository()
            with pytest.raises(m.OwnerContractError, match="OWNER_REVOKED"):
                repo.load_current_owner(s, binding=first.binding, principal=principal)
            repo.save_owner_snapshot(s, snapshot=second, expected_version=2, request_id="second")
            with pytest.raises(m.OwnerContractError):
                repo.save_owner_snapshot(s, snapshot=first, expected_version=0, request_id="first")
            assert repo.load_current_owner(s, binding=second.binding, principal=principal2) == second


@pytest.mark.parametrize("field,value", [
    ("actor_id", "foreign"), ("context_id", "foreign"), ("workspace_id", "foreign"),
    ("target_hash", "sha256:"+"f"*64), ("baseline_hash", "sha256:"+"e"*64),
    ("execution_fence", "stale"), ("write_fence", "forged"), ("generation", 2),
])
def test_binding_mismatch_denies_without_projection(field, value):
    m = product()
    snapshot, principal = sample()
    with database() as engine, Session(engine) as s, s.begin():
        repo = m.SqlAlchemyAgentTeamOwnerRepository()
        repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="first")
        with pytest.raises(m.OwnerContractError):
            repo.load_current_owner(s, binding=replace(snapshot.binding, **{field:value}), principal=principal)


def test_receipt_replay_conflict_stale_version_and_superseded_generation():
    m = product()
    snapshot, principal = sample()
    with database() as engine, Session(engine) as s, s.begin():
        repo = m.SqlAlchemyAgentTeamOwnerRepository()
        repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="first")
        r = receipt(snapshot, principal)
        assert repo.save_receipt(s, binding=snapshot.binding, principal=principal, receipt=r, expected_version=1) == r
        assert repo.save_receipt(s, binding=snapshot.binding, principal=principal, receipt=r, expected_version=1) == r
        conflict = receipt(snapshot, principal, response='{"count":1}')
        with pytest.raises(m.OwnerContractError, match="RECEIPT_REPLAY_CONFLICT"):
            repo.save_receipt(s, binding=snapshot.binding, principal=principal, receipt=conflict, expected_version=1)
        next_snapshot = sealed(replace(snapshot, owner_version=2))
        repo.save_owner_snapshot(s, snapshot=next_snapshot, expected_version=1, request_id="next")
        with pytest.raises(m.OwnerContractError):
            repo.load_receipt(s, binding=snapshot.binding, principal=principal, request_id="request")


@pytest.mark.parametrize("kind", ["expired", "hash", "component", "principal", "version", "generation"])
def test_invalid_snapshot_never_publishes(kind):
    m = product()
    snapshot, principal = sample()
    if kind == "expired":
        snapshot = sealed(replace(snapshot, expires_at=snapshot.created_at+timedelta(seconds=1), principal_mappings=()))
    elif kind == "hash":
        snapshot = replace(snapshot, content_hash="sha256:"+"0"*64)
    elif kind == "component":
        snapshot = sealed(replace(snapshot, team=None))
    elif kind == "principal":
        altered = sealed(replace(principal, principal_actor_id="foreign"), "mapping_hash")
        snapshot = sealed(replace(snapshot, principal_mappings=(altered,)))
    elif kind == "version":
        snapshot = sealed(replace(snapshot, owner_version=3))
    else:
        snapshot, _ = sample(generation=3)
    with database() as engine, Session(engine) as s, s.begin():
        repo = m.SqlAlchemyAgentTeamOwnerRepository()
        with pytest.raises(m.OwnerContractError):
            repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="bad")
        assert s.execute(text("SELECT count(*) FROM agent_owner_heads")).scalar_one() == 0


def test_public_input_callbacks_zero_before_sql():
    m = product()
    calls = []
    class Hostile:
        def __getattribute__(self, name):
            calls.append(name)
            raise AssertionError("callback")
    repo = m.SqlAlchemyAgentTeamOwnerRepository()
    with pytest.raises(m.OwnerContractError, match="OWNER_INPUT_INVALID"):
        repo.save_owner_snapshot(None, snapshot=Hostile(), expected_version=0, request_id="x")
    snapshot, _ = sample()
    object.__setattr__(snapshot.binding, "target_hash", Hostile())
    with pytest.raises(m.OwnerContractError, match="OWNER_INPUT_INVALID"):
        repo.save_owner_snapshot(None, snapshot=snapshot, expected_version=0, request_id="x")
    assert calls == []


def test_transaction_required_no_implicit_commit():
    m = product()
    snapshot, _ = sample()
    with database() as engine, Session(engine) as s:
        with pytest.raises(m.OwnerContractError, match="TRANSACTION_REQUIRED"):
            m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
                s, snapshot=snapshot, expected_version=0, request_id="first")


def test_legacy_sqlite_logical_transaction_is_not_a_safe_savepoint_boundary():
    m = product()
    snapshot, _ = sample()
    engine = create_engine("sqlite://")
    try:
        with Session(engine) as s, s.begin():
            with pytest.raises(m.OwnerContractError, match="TRANSACTION_REQUIRED"):
                m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
                    s, snapshot=snapshot, expected_version=0, request_id="first")
    finally:
        engine.dispose()


def test_driver_failure_rolls_back_snapshot_and_request_atomically():
    m = product()
    snapshot, _ = sample()
    with database() as engine, Session(engine) as s, s.begin():
        repo = m.SqlAlchemyAgentTeamOwnerRepository()
        def failure(conn, cursor, statement, parameters, context, executemany):
            if "INSERT INTO agent_owner_requests" in statement:
                raise RuntimeError("injected driver fault")
        event.listen(engine, "before_cursor_execute", failure)
        try:
            with pytest.raises(RuntimeError, match="injected"):
                repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="first")
        finally:
            event.remove(engine, "before_cursor_execute", failure)
        assert s.execute(text("SELECT count(*) FROM agent_owner_heads")).scalar_one() == 0
        assert s.execute(text("SELECT count(*) FROM agent_owner_history")).scalar_one() == 0
        assert repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="first") == snapshot


def test_migration_roundtrip_and_release_target_not_changed():
    m = migration()
    assert m.revision == "0015_agent_team_owner"
    assert m.down_revision == "0014_dag_queue"
    with database() as engine:
        with engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                m.downgrade()
            assert not connection.dialect.has_table(connection, "agent_owner_heads")


@pytest.mark.parametrize("field,value", [
    ("auth_session_hash", "sha256:"+"b"*64), ("auth_generation", 2),
    ("principal_role", "HUMAN"), ("permissions", ("approve", "tasks:read")),
])
def test_host_mapping_membership_not_self_signed_hash(field, value):
    m = product()
    snapshot, principal = sample()
    forged = sealed(replace(principal, **{field:value}), "mapping_hash")
    with database() as engine, Session(engine) as s, s.begin():
        repo = m.SqlAlchemyAgentTeamOwnerRepository()
        repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="create")
        with pytest.raises(m.OwnerContractError, match="PRINCIPAL_BINDING_MISMATCH"):
            repo.load_current_owner(s, binding=snapshot.binding, principal=forged)


@pytest.mark.parametrize("field,value", [
    ("snapshot_hash", "sha256:"+"0"*64), ("owner_version", 5),
    ("generation", 9), ("project_id", "foreign"),
])
def test_corrupted_head_is_not_current_authority(field, value):
    m = product()
    snapshot, principal = sample()
    with database() as engine, Session(engine) as s, s.begin():
        repo = m.SqlAlchemyAgentTeamOwnerRepository()
        repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="create")
        s.execute(text("UPDATE agent_owner_heads SET "+field+"=:value"), {"value":value})
        with pytest.raises(m.OwnerContractError, match="OWNER_HASH_MISMATCH"):
            repo.load_current_owner(s, binding=snapshot.binding, principal=principal)


@pytest.mark.parametrize("body", ['{"a":1,"a":2}', '{"n":NaN}', '{"n":Infinity}', '['*26+'0'+']'*26])
def test_noncanonical_or_unbounded_component_json_denies_before_sql(body):
    m = product()
    snapshot, _ = sample()
    snapshot = sealed(replace(snapshot, team=m.OwnerComponent("TEAM",1,body,digest(body))))
    with pytest.raises(m.OwnerContractError):
        m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
            None, snapshot=snapshot, expected_version=0, request_id="bad")


def test_slot_deletion_is_structured_denial_without_callback():
    m = product()
    snapshot, _ = sample()
    object.__delattr__(snapshot.binding, "actor_id")
    with pytest.raises(m.OwnerContractError, match="OWNER_INPUT_INVALID"):
        m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
            None, snapshot=snapshot, expected_version=0, request_id="bad")


def test_mutable_timezone_and_datetime_subclass_have_no_callbacks():
    from datetime import tzinfo
    m = product()
    snapshot, _ = sample()
    calls = []
    class HostileZone(tzinfo):
        def utcoffset(self, dt):
            calls.append("offset")
            return timedelta(0)
    class HostileTime(datetime):
        def isoformat(self, *args, **kwargs):
            calls.append("isoformat")
            raise AssertionError("callback")
    for value in (datetime(2026,1,1,tzinfo=HostileZone()), HostileTime(2026,1,1,tzinfo=timezone.utc)):
        altered = replace(snapshot, created_at=value)
        with pytest.raises(m.OwnerContractError, match="OWNER_INPUT_INVALID"):
            m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
                None, snapshot=altered, expected_version=0, request_id="bad")
    assert calls == []


def test_snapshot_exact_replay_conflict_and_detachment():
    m = product()
    snapshot, principal = sample()
    with database() as engine, Session(engine) as s, s.begin():
        repo = m.SqlAlchemyAgentTeamOwnerRepository()
        repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="create")
        replay = repo.save_owner_snapshot(s, snapshot=snapshot, expected_version=0, request_id="create")
        assert replay == snapshot and replay.binding is not snapshot.binding
        altered = sealed(replace(snapshot, expires_at=snapshot.expires_at+timedelta(minutes=1)))
        with pytest.raises(m.OwnerContractError, match="RECEIPT_REPLAY_CONFLICT"):
            repo.save_owner_snapshot(s, snapshot=altered, expected_version=0, request_id="create")
        with pytest.raises(m.OwnerContractError, match="OWNER_VERSION_CONFLICT"):
            repo.save_owner_snapshot(s, snapshot=sealed(replace(snapshot,owner_version=2)),
                expected_version=0, request_id="stale")
        assert repo.load_current_owner(s,binding=snapshot.binding,principal=principal) == snapshot


def test_downgrade_refuses_existing_owner_data_without_dropping_tables():
    m = product()
    snapshot, _ = sample()
    with database() as engine:
        with Session(engine) as s, s.begin():
            m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
                s,snapshot=snapshot,expected_version=0,request_id="create")
        with engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                with pytest.raises(RuntimeError, match="OWNER_DATA_PRESENT"):
                    migration().downgrade()
            assert connection.execute(text("SELECT count(*) FROM agent_owner_heads")).scalar_one() == 1


def test_postgresql_migration_compiles_offline_without_connecting():
    from io import StringIO
    buffer = StringIO()
    context = MigrationContext.configure(dialect_name="postgresql",
        opts={"as_sql":True,"output_buffer":buffer})
    with Operations.context(context):
        migration().upgrade()
    sql = buffer.getvalue()
    assert "CREATE TABLE agent_owner_heads" in sql
    assert "uq_agent_owner_identity" in sql and "uq_agent_owner_receipt" in sql
    assert "CREATE TABLE agent_owner_history" in sql
    assert "ALTER TABLE tasks" not in sql


def test_real_postgres_current_generation_restart_atomic_cas_and_rollback():
    """Opt-in on an explicitly disposable DB only; never uses C30 release0013."""
    import os
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from uuid import uuid4
    from sqlalchemy.engine import make_url
    if os.environ.get("C30R2_ISOLATED_PG_APPROVED") != "1":
        pytest.skip("C30R2_REAL_PG_NOT_EXECUTED: separate isolated execution approval required")
    raw = os.environ.get("C30R2_TEST_DATABASE_URL")
    if not raw:
        pytest.fail("C30R2_ISOLATED_DSN_REQUIRED")
    url = make_url(raw)
    assert url.get_backend_name() == "postgresql"
    assert url.database and url.database.startswith("anvil_c30r2_scratch_")
    schema = "c30r2_" + uuid4().hex
    admin = create_engine(url)
    engine = None
    try:
        with admin.begin() as c:
            c.exec_driver_sql('CREATE SCHEMA "'+schema+'"')
        engine = create_engine(url, connect_args={"options":"-csearch_path="+schema+" -cstatement_timeout=10000"})
        with engine.begin() as c:
            with Operations.context(MigrationContext.configure(c)):
                migration().upgrade()
        m = product()
        snapshot, principal = sample()
        barrier = Barrier(2)
        def create(request):
            try:
                with Session(engine) as s, s.begin():
                    barrier.wait(timeout=5)
                    m.SqlAlchemyAgentTeamOwnerRepository().save_owner_snapshot(
                        s,snapshot=snapshot,expected_version=0,request_id=request)
                return "WON"
            except m.OwnerContractError as exc:
                return exc.code
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(create,"one"),pool.submit(create,"two")]
            results = [f.result(timeout=20) for f in futures]
        assert sorted(results) == ["OWNER_VERSION_CONFLICT","WON"]
        with Session(engine) as s, s.begin():
            repo = m.SqlAlchemyAgentTeamOwnerRepository()
            assert repo.load_current_owner(s,binding=snapshot.binding,principal=principal) == snapshot
            r = receipt(snapshot,principal)
            repo.save_receipt(s,binding=snapshot.binding,principal=principal,receipt=r,expected_version=1)
        engine.dispose()  # New connections/repository must not rely on process cache.
        with Session(engine) as s, s.begin():
            repo = m.SqlAlchemyAgentTeamOwnerRepository()
            assert repo.load_receipt(s,binding=snapshot.binding,principal=principal,request_id="request") == r
            assert repo.save_receipt(s,binding=snapshot.binding,principal=principal,receipt=r,expected_version=1) == r
        with Session(engine) as s:
            with pytest.raises(RuntimeError):
                with s.begin():
                    repo.revoke_generation(s,binding=snapshot.binding,expected_version=1,
                        request_id="rollback",reason="OWNER_REVOKED")
                    raise RuntimeError("rollback")
        with Session(engine) as s, s.begin():
            assert repo.load_current_owner(s,binding=snapshot.binding,principal=principal) == snapshot
            repo.revoke_generation(s,binding=snapshot.binding,expected_version=1,
                request_id="revoke",reason="OWNER_REVOKED")
        with Session(engine) as s, s.begin():
            with pytest.raises(m.OwnerContractError,match="OWNER_REVOKED"):
                m.SqlAlchemyAgentTeamOwnerRepository().load_current_owner(
                    s,binding=snapshot.binding,principal=principal)
    finally:
        if engine is not None:
            engine.dispose()
        try:
            with admin.begin() as c:
                c.exec_driver_sql('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE')
        finally:
            admin.dispose()
