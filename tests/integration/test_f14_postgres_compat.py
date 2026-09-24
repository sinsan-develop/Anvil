import pytest
from importlib import util
from pathlib import Path
import os
import re
import json
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from urllib.parse import urlsplit

from packages.recovery.disaster import (
    check_migration_compatibility, RecoveryMismatch, RecoveryManifest,
    RestoreObservation, encode_manifest, read_manifest, verify_backup, verify_restore,
)


def _isolated_target(major: int, environ: dict[str, str]) -> tuple[str, str]:
    container = environ.get(f"ANVIL_F14_PG{major}_CONTAINER", "")
    dsn = environ.get(f"ANVIL_F14_PG{major}_ADMIN_DSN", "")
    expected_port = {15: 32768, 18: 32769}.get(major)
    try:
        parsed = urlsplit(dsn)
        safe = (environ.get("ANVIL_F14_ISOLATED_QA") == "1"
                and re.fullmatch(r"[0-9a-f]{40}", environ.get("ANVIL_F14_EXPECTED_GIT_SHA", ""))
                and re.fullmatch(rf"anvil-f14-pg{major}-[0-9a-f]{{7,40}}", container)
                and parsed.scheme in ("postgresql", "postgres")
                and parsed.hostname == "127.0.0.1" and parsed.port == expected_port
                and parsed.path == "/postgres" and not parsed.query and not parsed.fragment)
    except ValueError:
        safe = False
    if not safe:
        raise ValueError("F14_ISOLATION_REQUIRED")
    return container, dsn


def _inspect_isolated_container(container: str, host_port: int, expected_image: str = "") -> str:
    result = subprocess.run(["docker", "inspect", container], capture_output=True, text=True,
                            check=False, timeout=20)
    try:
        documents = json.loads(result.stdout) if result.returncode == 0 else None
        if type(documents) is not list or len(documents) != 1:
            raise ValueError
        item = documents[0]
        image = item["Image"]
        name = item["Name"]
        labels = item["Config"]["Labels"]
        env = item["Config"]["Env"]
        tmpfs = item["HostConfig"]["Tmpfs"]
        ports = item["NetworkSettings"]["Ports"]["5432/tcp"]
        pgdata = [entry[7:] for entry in env if entry.startswith("PGDATA=")]
        guarded = (name == "/" + container
                   and re.fullmatch(r"[0-9a-f]{64}", item["Id"])
                   and re.fullmatch(r"sha256:[0-9a-f]{64}", image)
                   and (not expected_image or image == expected_image)
                   and item["State"]["Running"] is True
                   and labels.get("com.anvil.cleanup-scope") == "F14_ISOLATED_TEST"
                   and item["Mounts"] == []
                   and ports == [{"HostIp": "127.0.0.1", "HostPort": str(host_port)}]
                   and len(pgdata) == 1 and isinstance(tmpfs, dict)
                   and any(pgdata[0] == path or pgdata[0].startswith(path.rstrip("/") + "/")
                           for path in tmpfs if path == "/var/lib/postgresql"
                           or path.startswith("/var/lib/postgresql/")))
    except (KeyError, TypeError, ValueError, IndexError, AttributeError):
        guarded = False
    if not guarded:
        raise AssertionError("F14_CONTAINER_ISOLATION_INVALID")
    return image


def _digest(value: bytes) -> str:
    return "sha256:" + sha256(value).hexdigest()


def _database_url(admin_dsn: str, database_name: str) -> str:
    from sqlalchemy.engine import make_url
    return make_url(admin_dsn).set(drivername="postgresql", database=database_name).render_as_string(
        hide_password=False)


def _container_command(container: str, tool: str, *args: str, content: bytes | None = None) -> bytes:
    result = subprocess.run(["docker", "exec", "-i", "--user", "postgres", container, tool, *args],
                            input=content, capture_output=True, check=False, timeout=120)
    if result.returncode:
        # Never render stderr: libpq may echo a DSN or other environment details.
        raise AssertionError(f"F14_{tool.upper()}_FAILED")
    return result.stdout


def _cleanup_created_databases(admin, created: list[str], primary_error: BaseException | None = None) -> None:
    from psycopg import sql
    failed = []
    try:
        for name in reversed(created):
            try:
                admin.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)))
            except Exception:
                failed.append(name)
    finally:
        try:
            admin.close()
        except Exception:
            failed.append("<admin-close>")
    if failed:
        cleanup_error = AssertionError("F14_CLEANUP_FAILED:" + ",".join(failed))
        if primary_error is not None:
            group = ExceptionGroup if isinstance(primary_error, Exception) else BaseExceptionGroup
            raise group("F14_PRIMARY_AND_CLEANUP_FAILED", [primary_error, cleanup_error])
        raise cleanup_error


def _alembic_revision(dsn: str, command: str, revision: str, monkeypatch) -> None:
    from alembic import command as alembic_command
    from alembic.config import Config
    cfg = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    with monkeypatch.context() as patch:
        patch.setenv("ANVIL_DATABASE_URL", dsn)
        getattr(alembic_command, command)(cfg, revision)


def _lineage(conn, ids: dict[str, str]) -> dict[str, str]:
    from psycopg import sql
    definitions = {
        "project": ("tasks", "task_id", ids["task"]),
        "run": ("runs", "run_id", ids["run"]),
        "approval": ("approval_records", "approval_id", ids["approval"]),
        "progress": ("progress_export_outbox", "outbox_id", ids["progress"]),
        "terminal_learning": ("run_events", "event_id", ids["event"]),
        "audit": ("operations_audit_events", "project_id", ids["project"]),
    }
    result = {}
    for kind, (table, key, identifier) in definitions.items():
        query = sql.SQL("SELECT row_to_json(t)::text FROM {} AS t WHERE {} = %s").format(
            sql.Identifier(table), sql.Identifier(key))
        if kind == "audit":
            query += sql.SQL(" AND environment_id = %s AND sequence_no = 1")
            params = (identifier, ids["environment"])
        else:
            params = (identifier,)
        rows = conn.execute(query, params).fetchall()
        assert len(rows) == 1, f"F14_{kind.upper()}_ROW_MISSING"
        result[kind] = _digest(json.dumps(json.loads(rows[0][0]), sort_keys=True,
                                         separators=(",", ":")).encode())
    return result


def _observation(conn, ids: dict[str, str], *, image: str, backup: str,
                 database_id: str) -> RestoreObservation:
    lineage = _lineage(conn, ids)
    head = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    git_sha = conn.execute("SELECT value FROM anvil_metadata WHERE key = 'f14_git_sha'").fetchone()[0]
    columns = conn.execute("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns "
                           "WHERE table_schema = 'public' ORDER BY table_name,ordinal_position").fetchall()
    version = int(conn.execute("SHOW server_version_num").fetchone()[0])
    extension = conn.execute("SELECT extversion FROM pg_extension WHERE extname='vector'").fetchone()[0]
    sequence = conn.execute("SELECT sequence_no FROM run_events WHERE event_id=%s", (ids["event"],)).fetchone()[0]
    artifact_rows = conn.execute("SELECT artifact_id,content_hash FROM artifacts WHERE artifact_id=%s",
                                 (ids["artifact"],)).fetchall()
    assert len(artifact_rows) == 1, "F14_ARTIFACT_ROW_MISSING"
    return RestoreObservation(target_database_id=database_id, restored_from_digest=backup,
                              git_sha=git_sha, migration_head=head, pg_major=version // 10000,
                              image_digest=image, extension_version=extension,
                              schema_hash=_digest(json.dumps(columns).encode()), event_sequence=sequence,
                              artifact_checksums=dict(artifact_rows), lineage_hashes=lineage, replayed=True,
                              project_id=ids["project"], environment_id=ids["environment"])


def test_f14_real_db_opt_in_rejects_nonisolated_target():
    safe = {"ANVIL_F14_ISOLATED_QA": "1", "ANVIL_F14_EXPECTED_GIT_SHA": "a" * 40,
            "ANVIL_F14_PG15_CONTAINER": "anvil-f14-pg15-1b8211f",
            "ANVIL_F14_PG15_ADMIN_DSN": "postgresql://postgres@127.0.0.1:32768/postgres"}
    assert _isolated_target(15, safe)[0] == "anvil-f14-pg15-1b8211f"
    for changed in ({**safe, "ANVIL_F14_ISOLATED_QA": ""},
                    {**safe, "ANVIL_F14_PG15_ADMIN_DSN": "postgresql://postgres@127.0.0.1:5432/postgres"},
                    {**safe, "ANVIL_F14_PG15_CONTAINER": "shared-db"}):
        with pytest.raises(ValueError, match="F14_ISOLATION_REQUIRED"):
            _isolated_target(15, changed)


def test_f14_container_inspection_binds_port_and_ephemeral_storage(monkeypatch):
    import copy
    from types import SimpleNamespace
    document = {
        "Name": "/anvil-f14-pg15-1b8211f", "Id": "a" * 64, "Image": "sha256:" + "b" * 64,
        "State": {"Running": True},
        "Config": {"Labels": {"com.anvil.cleanup-scope": "F14_ISOLATED_TEST"},
                   "Env": ["PGDATA=/var/lib/postgresql/data/pgdata"]},
        "HostConfig": {"Tmpfs": {"/var/lib/postgresql/data": "rw,noexec,nosuid"}},
        "Mounts": [],
        "NetworkSettings": {"Ports": {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "32768"}]}},
    }
    def stub(value):
        monkeypatch.setattr(subprocess, "run", lambda *_a, **_kw:
                            SimpleNamespace(returncode=0, stdout=json.dumps([value]), stderr=""))
    stub(document)
    assert _inspect_isolated_container("anvil-f14-pg15-1b8211f", 32768) == document["Image"]
    bad_variants = []
    for path, replacement in (
        (("NetworkSettings", "Ports", "5432/tcp"), [{"HostIp": "127.0.0.1", "HostPort": "5432"}]),
        (("Mounts",), [{"Type": "volume"}]),
        (("Config", "Labels", "com.anvil.cleanup-scope"), "OTHER"),
        (("HostConfig", "Tmpfs"), {}),
    ):
        copy_doc = copy.deepcopy(document)
        pointer = copy_doc
        for key in path[:-1]:
            pointer = pointer[key]
        pointer[path[-1]] = replacement
        bad_variants.append(copy_doc)
    for bad in bad_variants:
        stub(bad)
        with pytest.raises(AssertionError, match="F14_CONTAINER_ISOLATION_INVALID"):
            _inspect_isolated_container("anvil-f14-pg15-1b8211f", 32768)


def test_f14_cleanup_attempts_every_created_db_and_closes_after_first_failure():
    class Admin:
        closed = False
        attempted = []
        def execute(self, query):
            self.attempted.append(query.as_string())
            if '"anvil_f14_qa_15_first"' in self.attempted[-1]:
                raise RuntimeError("synthetic drop failure")
        def close(self):
            self.closed = True
    admin = Admin()
    with pytest.raises(AssertionError, match="F14_CLEANUP_FAILED:anvil_f14_qa_15_first"):
        _cleanup_created_databases(admin, ["anvil_f14_qa_15_third", "anvil_f14_qa_15_second",
                                           "anvil_f14_qa_15_first"])
    assert len(admin.attempted) == 3
    assert admin.closed


def test_f14_cleanup_retains_primary_failure_when_drop_also_fails():
    class Admin:
        closed = False
        def execute(self, _query):
            raise RuntimeError("synthetic cleanup failure")
        def close(self):
            self.closed = True
    admin = Admin()
    primary = ValueError("synthetic restore failure")
    with pytest.raises(ExceptionGroup, match="F14_PRIMARY_AND_CLEANUP_FAILED") as error:
        _cleanup_created_databases(admin, ["anvil_f14_qa_15_source"], primary)
    assert error.value.exceptions[0] is primary
    assert "anvil_f14_qa_15_source" in str(error.value.exceptions[1])
    assert admin.closed


def test_f14_derived_database_dsn_remains_sqlalchemy_and_psycopg_url():
    from sqlalchemy.engine import make_url
    from psycopg.conninfo import conninfo_to_dict
    derived = _database_url("postgresql://postgres:p%40ss@127.0.0.1:32768/postgres", "anvil_f14_qa_15_source")
    parsed = make_url(derived)
    assert parsed.drivername == "postgresql"
    assert parsed.database == "anvil_f14_qa_15_source"
    assert parsed.password == "p@ss"
    assert conninfo_to_dict(derived)["dbname"] == "anvil_f14_qa_15_source"


def test_pg15_and_pg18_require_separate_version_and_extension_evidence():
    assert check_migration_compatibility(150017, {"plpgsql", "vector"}, expected_major=15) == 15
    assert check_migration_compatibility(180004, {"plpgsql", "vector"}, expected_major=18) == 18
    with pytest.raises(RecoveryMismatch):
        check_migration_compatibility(150017, {"plpgsql", "vector"}, expected_major=18)
    with pytest.raises(RecoveryMismatch):
        check_migration_compatibility(180004, {"plpgsql"}, expected_major=18)


def test_migration_downgrade_refuses_to_drop_persisted_audit():
    path = Path(__file__).resolve().parents[2] / "migrations/versions/0016_operations_recovery.py"
    spec = util.spec_from_file_location("f14_migration", path)
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    class Result:
        def scalar_one(self):
            return 1
    class Bind:
        def execute(self, _query):
            return Result()
    class Guard:
        def __init__(self):
            self.drops = []
        def get_bind(self):
            return Bind()
        def drop_table(self, name):
            self.drops.append(name)
    guard = Guard()
    module.op = guard
    with pytest.raises(RuntimeError, match="DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"):
        module.downgrade()
    assert guard.drops == []


@pytest.mark.parametrize("major", [15, 18])
def test_f14_isolated_pg_dump_restore_six_lineages_and_migration_boundaries(major, monkeypatch):
    """Opt-in only: caller supplies a disposable, version-matched PostgreSQL container."""
    if os.environ.get("ANVIL_F14_ISOLATED_QA") is None:
        pytest.skip("F-14 isolated PostgreSQL QA is not enabled")
    container, admin_dsn = _isolated_target(major, os.environ)
    import psycopg
    from psycopg import sql

    expected_sha = os.environ["ANVIL_F14_EXPECTED_GIT_SHA"]
    head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    assert head == expected_sha, "F14_GIT_CHECKOUT_MISMATCH"
    expected_image = os.environ.get(f"ANVIL_F14_PG{major}_IMAGE_DIGEST", "")
    if expected_image:
        assert re.fullmatch(r"sha256:[0-9a-f]{64}", expected_image), "F14_IMAGE_DIGEST_INVALID"
    image = _inspect_isolated_container(container, {15: 32768, 18: 32769}[major], expected_image)
    for tool in ("pg_dump", "pg_restore"):
        version_text = _container_command(container, tool, "--version").decode()
        assert re.search(rf"\b{major}(?:\.|\s)", version_text), "F14_CLIENT_MAJOR_MISMATCH"

    def dsn_for(name):
        return _database_url(admin_dsn, name)

    nonce = uuid.uuid4().hex[:12]
    names = [f"anvil_f14_qa_{major}_{nonce}_{suffix}" for suffix in ("fresh", "source", "target")]
    admin = psycopg.connect(admin_dsn, autocommit=True)
    created = []
    try:
        server_version = int(admin.execute("SHOW server_version_num").fetchone()[0])
        assert server_version // 10000 == major, "F14_SERVER_MAJOR_MISMATCH"
        for name in names:
            admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
            created.append(name)
        fresh, source, target = map(dsn_for, names)
        _alembic_revision(fresh, "upgrade", "0016_operations_recovery", monkeypatch)
        _alembic_revision(fresh, "downgrade", "0015_agent_team_owner", monkeypatch)
        with psycopg.connect(fresh) as conn:
            assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "0015_agent_team_owner"

        _alembic_revision(source, "upgrade", "0015_agent_team_owner", monkeypatch)
        ids = {key: f"f14-{key}-{nonce}" for key in
               ("project", "task", "run", "approval", "progress", "event", "artifact")}
        ids["environment"] = f"f14-pg{major}"
        with psycopg.connect(source) as conn:
            conn.execute("INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                         "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                         (ids["task"], ids["project"], "synthetic-repository", "F14 synthetic task",
                          "isolated restore verification", "f14-qa", "DRAFT"))
            conn.execute("INSERT INTO runs(run_id,task_id,baseline_id,phase,status) VALUES (%s,%s,%s,%s,%s)",
                         (ids["run"], ids["task"], "f14-baseline", "F14_QA", "CREATED"))
        _alembic_revision(source, "upgrade", "0016_operations_recovery", monkeypatch)
        with psycopg.connect(source) as conn:
            assert conn.execute("SELECT count(*) FROM runs WHERE run_id=%s", (ids["run"],)).fetchone()[0] == 1
        _alembic_revision(source, "downgrade", "0015_agent_team_owner", monkeypatch)
        _alembic_revision(source, "upgrade", "0016_operations_recovery", monkeypatch)

        now = datetime.now(timezone.utc)
        content = b"F14 isolated synthetic artifact only"
        artifact_hash = _digest(content)
        with psycopg.connect(source) as conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            conn.execute("INSERT INTO anvil_metadata(key,value) VALUES ('f14_git_sha',%s)", (expected_sha,))
            conn.execute("INSERT INTO approval_records(approval_id,approval_type,subject_id,subject_hash,"
                         "approved_by,authenticated_human,approved_at,expires_at,status) "
                         "VALUES (%s,%s,%s,%s,%s,true,%s,%s,%s)",
                         (ids["approval"], "SYNTHETIC_QA", ids["task"], _digest(b"f14 approval"),
                          "f14-qa", now, now + timedelta(days=1), "APPROVED"))
            conn.execute("INSERT INTO run_events(event_id,run_id,sequence_no,event_type,actor_type,actor_id,"
                         "correlation_id,idempotency_key,expected_version,applied_version,request_hash,payload,created_at) "
                         "VALUES (%s,%s,1,%s,%s,%s,%s,%s,0,1,%s,%s::json,%s)",
                         (ids["event"], ids["run"], "TERMINAL_LEARNING", "SYSTEM", "f14-qa",
                          ids["event"], ids["event"], _digest(b"f14 terminal learning"),
                          '{"result":"SYNTHETIC"}', now))
            conn.execute("INSERT INTO progress_export_outbox(outbox_id,request_id,owner_type,owner_id,project_id,"
                         "event_id,event_sequence,idempotency_key,request_hash,payload_hash,export_uri,"
                         "progress_status,last_event_id,next_safe_action,outbox_status,retry_count,created_at) "
                         "VALUES (%s,%s,'PROJECT',%s,%s,%s,1,%s,%s,%s,%s,%s,%s,%s,'PENDING',0,%s)",
                         (ids["progress"], f"f14-request-{nonce}", ids["project"], ids["project"],
                          ids["event"], ids["progress"], _digest(b"f14 progress request"),
                          _digest(b"f14 progress payload"), "f14://synthetic", "IN_PROGRESS",
                          ids["event"], "none", now))
            conn.execute("INSERT INTO artifacts(artifact_id,artifact_type,content_hash,byte_size,media_type,"
                         "storage_ref,project_id,run_id,actor_id,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                         (ids["artifact"], "SYNTHETIC_QA", artifact_hash, len(content),
                          "application/octet-stream", f"sha256/{artifact_hash[7:9]}/{artifact_hash[7:]}",
                          ids["project"], ids["run"], "f14-qa", now))
            conn.execute("INSERT INTO operations_audit_heads(project_id,environment_id,next_sequence) "
                         "VALUES (%s,%s,2)", (ids["project"], ids["environment"]))
            conn.execute("INSERT INTO operations_audit_events(project_id,environment_id,sequence_no,payload) "
                         "VALUES (%s,%s,1,%s::json)",
                         (ids["project"], ids["environment"], '{"event":"SYNTHETIC_QA"}'))
        with pytest.raises(Exception, match="DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"):
            _alembic_revision(source, "downgrade", "0015_agent_team_owner", monkeypatch)
        with psycopg.connect(source) as conn:
            assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "0016_operations_recovery"
            assert conn.execute("SELECT count(*) FROM operations_audit_events").fetchone()[0] == 1

        dump = _container_command(container, "pg_dump", "--format=custom", "--no-owner", "--no-acl",
                                  f"--dbname={names[1]}")
        listing = _container_command(container, "pg_restore", "--list", content=dump)
        assert dump and listing, "F14_BACKUP_EMPTY"
        with psycopg.connect(source) as conn:
            source_obs = _observation(conn, ids, image=image, backup=_digest(dump), database_id=names[1])
        assert source_obs.pg_major == major and source_obs.migration_head == "0016_operations_recovery"
        assert source_obs.git_sha == expected_sha
        manifest = RecoveryManifest(project_id=ids["project"], environment_id=ids["environment"],
                                    git_sha=source_obs.git_sha, migration_head=source_obs.migration_head,
                                    pg_major=source_obs.pg_major, image_digest=image,
                                    extension_version=source_obs.extension_version, schema_hash=source_obs.schema_hash,
                                    event_sequence=source_obs.event_sequence,
                                    artifact_checksums=source_obs.artifact_checksums, created_at=now,
                                    actor_id="f14-qa", backup_digest=_digest(dump),
                                    source_lineage_hashes=source_obs.lineage_hashes)
        sidecar = encode_manifest(manifest)
        manifest = read_manifest(sidecar, _digest(sidecar))
        assert verify_backup(manifest, dump, tuple(listing.decode().splitlines())).restore_listed
        _container_command(container, "pg_restore", "--exit-on-error", "--no-owner", "--no-acl",
                           f"--dbname={names[2]}", content=dump)
        with psycopg.connect(target) as conn:
            target_obs = _observation(conn, ids, image=image, backup=_digest(dump), database_id=names[2])
        assert verify_restore(manifest, dict(source_obs.lineage_hashes), target_obs).status == "RESTORE_VERIFIED"
        with psycopg.connect(target) as conn:
            conn.execute("UPDATE tasks SET title='F14 mismatched target' WHERE task_id=%s", (ids["task"],))
        with psycopg.connect(target) as conn:
            altered = _observation(conn, ids, image=image, backup=_digest(dump), database_id=names[2])
        with pytest.raises(RecoveryMismatch, match="RESTORE_LINEAGE_MISMATCH"):
            verify_restore(manifest, dict(source_obs.lineage_hashes), altered)
    finally:
        # Preserve both the original failure and any cleanup failure for Main remediation.
        _cleanup_created_databases(admin, created, sys.exception())
