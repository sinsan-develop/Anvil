from __future__ import annotations

from contextlib import contextmanager
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url


DSN = os.environ.get("ANVIL_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="isolated PostgreSQL DSN required")
ROOT = Path(__file__).resolve().parents[2]


@contextmanager
def _scratch_database():
    source = make_url(DSN)
    name = f"anvil_migration_{uuid4().hex}"
    admin = create_engine(source.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    try:
        yield source.set(database=name).render_as_string(hide_password=False)
    finally:
        with admin.connect() as connection:
            connection.execute(
                text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=:name AND pid<>pg_backend_pid()"),
                {"name": name},
            )
            connection.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()


def _alembic(dsn: str, *arguments: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["ANVIL_DATABASE_URL"] = dsn
    environment["PYTHONPATH"] = str(ROOT)
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *arguments],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    return result


def _revision(engine) -> str:
    with engine.connect() as connection:
        return connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def test_run_authority_migration_round_trip_on_fresh_postgres_database():
    with _scratch_database() as dsn:
        _alembic(dsn, "upgrade", "0012_run_authority")
        engine = create_engine(dsn)
        assert _revision(engine) == "0012_run_authority"
        assert "project_id" in {column["name"] for column in inspect(engine).get_columns("design_baselines")}
        assert {
            "work_instruction_id", "execution_plan_id", "idempotency_key", "creation_request_hash",
            "environment_id", "permission_snapshot_hash", "prior_run_id", "resume_checkpoint_id",
        } <= {column["name"] for column in inspect(engine).get_columns("runs")}
        assert {
            "run_id", "step_id", "project_id", "execution_plan_id", "execution_plan_hash",
            "permission_snapshot_hash",
        } <= {column["name"] for column in inspect(engine).get_columns("evidence_manifests")}
        engine.dispose()

        _alembic(dsn, "downgrade", "0011_telegram_webhook_state")
        engine = create_engine(dsn)
        assert _revision(engine) == "0011_telegram_webhook_state"
        assert "project_id" not in {column["name"] for column in inspect(engine).get_columns("design_baselines")}
        assert "execution_plans" not in inspect(engine).get_table_names()
        assert "environment_id" not in {column["name"] for column in inspect(engine).get_columns("runs")}
        assert "run_id" not in {column["name"] for column in inspect(engine).get_columns("evidence_manifests")}
        assert "version" not in {column["name"] for column in inspect(engine).get_columns("tasks")}
        engine.dispose()


def test_run_authority_migration_preflight_rolls_back_all_ddl_for_duplicate_active_runs():
    with _scratch_database() as dsn:
        _alembic(dsn, "upgrade", "0011_telegram_webhook_state")
        engine = create_engine(dsn)
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO tasks (task_id,project_id,repository_id,title,objective,requested_by,status) VALUES ('task-preflight','project-1','repo-1','title','objective','owner','CONFIRMED')"))
            connection.execute(text("INSERT INTO runs (run_id,task_id,baseline_id,phase,status,version) VALUES ('run-preflight-a','task-preflight','baseline-1','ANALYZING','ACTIVE',1),('run-preflight-b','task-preflight','baseline-1','ANALYZING','QUEUED',1)"))
        result = _alembic(dsn, "upgrade", "0012_run_authority", check=False)
        assert result.returncode != 0
        assert "duplicate active Runs require reconciliation" in result.stderr
        assert _revision(engine) == "0011_telegram_webhook_state"
        assert "project_id" not in {column["name"] for column in inspect(engine).get_columns("design_baselines")}
        assert "execution_plans" not in inspect(engine).get_table_names()
        assert "version" not in {column["name"] for column in inspect(engine).get_columns("tasks")}
        engine.dispose()
