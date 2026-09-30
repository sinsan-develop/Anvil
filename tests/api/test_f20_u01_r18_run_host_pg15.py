"""Opt-in isolated PostgreSQL 15 test of the OIDC Operations Run host."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import sqlalchemy as sa
from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from apps.api.anvil_api.oidc_process import create_oidc_process_app
from packages.api.task_bootstrap import TaskBootstrapCommand, canonical_task_authority_hash
from packages.execution.run_creation import RunCreationCommand
from packages.observability.service import OperationsError
from packages.persistence.operations_run_read import load_scoped_run_source
from packages.persistence.run_creation_repository import SqlAlchemyRunCreationRepository
from packages.persistence.task_bootstrap_repository import SqlAlchemyTaskBootstrapRepository
from tests.api.test_oidc_process import _environment, _trust


_HASH = lambda char: "sha256:" + char * 64
_COUNT_TABLES = ("runs", "run_events", "durable_queue_jobs", "operations_audit_events")


def _validated_target(dsn: str | None, isolated: str | None) -> sa.engine.URL:
    try:
        url = sa.engine.make_url(dsn)
        valid = (
            isolated == "1"
            and url.drivername in {"postgresql", "postgresql+psycopg"}
            and url.host == "127.0.0.1"
            and url.port == 5548
            and url.username == "anvil_u01_r18"
            and url.database == "anvil_u01_r18"
            and not url.query
        )
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        raise ValueError("R18_PG_TARGET_REJECTED") from None
    return url


def _opt_in_target(environment: dict[str, str]):
    dsn = environment.get("ANVIL_U01_R18_PG_DSN")
    isolated = environment.get("ANVIL_U01_R18_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R18 isolated PostgreSQL 15 opt-in is absent")
    return _validated_target(dsn, isolated)


@pytest.mark.parametrize("dsn, isolated", [
    (None, "1"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/anvil_u01_r18", None),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/anvil_u01_r18", "0"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5432/anvil_u01_r18", "1"),
    ("postgresql://anvil_u01_r18@localhost:5548/anvil_u01_r18", "1"),
    ("postgresql://shared@127.0.0.1:5548/anvil_u01_r18", "1"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/shared", "1"),
    ("postgresql://anvil_u01_r18@127.0.0.1:5548/anvil_u01_r18?sslmode=disable", "1"),
    ("sqlite:///shared", "1"),
])
def test_partial_or_shared_target_rejected_before_database_access(dsn, isolated, monkeypatch):
    monkeypatch.setattr(sa, "create_engine", lambda *_a, **_kw: pytest.fail("DB accessed"))
    with pytest.raises(ValueError, match="^R18_PG_TARGET_REJECTED$"):
        _opt_in_target({"ANVIL_U01_R18_PG_DSN": dsn,
                        "ANVIL_U01_R18_PG_ISOLATED": isolated})


def test_validated_target_is_exact_and_credentials_are_never_reflected():
    url = _validated_target(
        "postgresql+psycopg://anvil_u01_r18:secret@127.0.0.1:5548/anvil_u01_r18", "1"
    )
    assert (url.drivername, url.host, url.port, url.username, url.database) == (
        "postgresql+psycopg", "127.0.0.1", 5548, "anvil_u01_r18", "anvil_u01_r18"
    )
    assert "secret" not in repr(url)


def test_absent_opt_in_is_explicit_skip(monkeypatch):
    monkeypatch.delenv("ANVIL_U01_R18_PG_DSN", raising=False)
    monkeypatch.delenv("ANVIL_U01_R18_PG_ISOLATED", raising=False)
    _opt_in_target(os.environ)


def _preflight(engine: sa.engine.Engine) -> None:
    """Fail closed before synthetic writes; this is an empty, dedicated QA DB."""
    with engine.connect() as connection:
        facts = connection.execute(sa.text(
            "SELECT current_database() AS db, current_user AS role, "
            "current_setting('server_version_num')::integer AS version"
        )).mappings().one()
        superuser = connection.execute(sa.text(
            "SELECT rolsuper FROM pg_roles WHERE rolname = current_user"
        )).scalar_one()
        heads = connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all()
        assert (facts["db"], facts["role"], facts["version"] // 10000,
                superuser, heads) == (
                    "anvil_u01_r18", "anvil_u01_r18", 15, False, ["0019_oidc_sessions"]
                ), "R18_PG_PREFLIGHT_REJECTED"
        for table in ("project_repositories", "tasks", "runs", "run_events",
                      "durable_queue_jobs", "operations_audit_events", "operations_audit_heads"):
            assert connection.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar_one() == 0, (
                "R18_PG_NOT_EMPTY"
            )


def _counts(engine: sa.engine.Engine) -> tuple[int, ...]:
    with engine.connect() as connection:
        return tuple(connection.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar_one()
                     for table in _COUNT_TABLES)


def _authority(engine: sa.engine.Engine, project: str, tag: str) -> tuple[str, str]:
    """Seed the approved artifact lineage needed by the normal Run repository."""
    ids = {key: f"r18-{key}-{tag}" for key in ("spec", "db", "wp", "ip", "wi", "plan")}
    now = datetime.now(timezone.utc)
    with engine.begin() as connection:
        connection.execute(sa.text(
            "INSERT INTO design_artifacts "
            "(artifact_id,revision,content_hash,actor_type,actor_id,artifact_type,source_refs) "
            "VALUES (:id,1,:hash,'AGENT','r18-qa','DESIGN_SPECIFICATION',CAST('[]' AS json))"
        ), {"id": ids["spec"], "hash": _HASH("9")})
        connection.execute(sa.text(
            "INSERT INTO design_baselines "
            "(artifact_id,revision,content_hash,actor_type,actor_id,specification_id,"
            "root_human_approval_id,approval_mode,scope,project_id) "
            "VALUES (:id,1,:hash,'HUMAN','r18-qa',:spec,:approval,'HUMAN_APPROVED',"
            "CAST('{}' AS json),:project)"
        ), {"id": ids["db"], "hash": _HASH("a"), "spec": ids["spec"],
            "approval": f"r18-approval-spec-{tag}", "project": project})
        connection.execute(sa.text(
            "INSERT INTO work_plans "
            "(artifact_id,revision,content_hash,design_baseline_id,design_baseline_hash,scope) "
            "VALUES (:id,1,:hash,:db,:dbh,CAST('{}' AS json))"
        ), {"id": ids["wp"], "hash": _HASH("b"), "db": ids["db"], "dbh": _HASH("a")})
        connection.execute(sa.text(
            "INSERT INTO iteration_plans "
            "(artifact_id,revision,content_hash,work_plan_id,work_plan_hash,sequence) "
            "VALUES (:id,1,:hash,:wp,:wph,1)"
        ), {"id": ids["ip"], "hash": _HASH("c"), "wp": ids["wp"], "wph": _HASH("b")})
        connection.execute(sa.text(
            "INSERT INTO work_instructions "
            "(artifact_id,revision,content_hash,iteration_plan_id,iteration_plan_hash,"
            "allowed_paths,allowed_actions,completion_conditions) "
            "VALUES (:id,1,:hash,:ip,:iph,CAST('[]' AS json),CAST('[]' AS json),CAST('[]' AS json))"
        ), {"id": ids["wi"], "hash": _HASH("d"), "ip": ids["ip"], "iph": _HASH("c")})
        connection.execute(sa.text(
            "INSERT INTO execution_plans "
            "(plan_id,plan_hash,source_work_instruction_id,source_work_instruction_hash,"
            "baseline_analysis_hash,impact_analysis_hash,status) "
            "VALUES (:id,:hash,:wi,:wih,:bah,:iah,'APPROVED')"
        ), {"id": ids["plan"], "hash": _HASH("e"), "wi": ids["wi"],
            "wih": _HASH("d"), "bah": _HASH("f"), "iah": _HASH("1")})
        for kind, key, hash_value in (("DESIGN_SPECIFICATION", "spec", _HASH("9")),
                                      ("WORK_PLAN", "wp", _HASH("b")),
                                      ("WORK_INSTRUCTION", "wi", _HASH("d")),
                                      ("EXECUTION_PLAN", "plan", _HASH("e"))):
            connection.execute(sa.text(
                "INSERT INTO approval_records "
                "(approval_id,approval_type,subject_id,subject_hash,approved_by,"
                "authenticated_human,approved_at,expires_at,status) "
                "VALUES (:approval,:kind,:subject,:hash,'r18-qa',true,:now,:expires,'ACTIVE')"
            ), {"approval": f"r18-approval-{key}-{tag}", "kind": kind,
                "subject": ids[key], "hash": hash_value, "now": now,
                "expires": now + timedelta(hours=2)})
    return ids["wi"], ids["plan"]


def _mapped_project(engine: sa.engine.Engine, project: str, environment: str, tag: str) -> str:
    repository = f"r18-repo-{tag}"
    with engine.begin() as connection:
        connection.execute(sa.text(
            "INSERT INTO project_repositories "
            "(project_id,repository_id,target_environment,active,version) "
            "VALUES (:project,:repository,:environment,true,1)"
        ), {"project": project, "repository": repository, "environment": environment})
    return repository


def _create_run(engine: sa.engine.Engine, project: str, environment: str,
                repository: str, wi: str, plan: str, tag: str,
                task_environment: str | None = None) -> str:
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    task_id = f"r18-task-{tag}"
    task_environment = task_environment or environment
    task_repo = SqlAlchemyTaskBootstrapRepository(sessions, task_id_factory=lambda: task_id)
    task_repo.create(TaskBootstrapCommand(
        task_id=None, project_id=project, objective="Synthetic R18 scoped Run observation",
        target_environment=task_environment, conversation_message="Isolated PG15 QA",
        requested_by="r18-qa", expected_version=0, idempotency_key=f"r18-task-key-{tag}",
        target_hash=canonical_task_authority_hash(
            project_id=project, repository_id=repository,
            target_environment=task_environment, mapping_version=1), reason="R18 QA Task"
    ))
    with engine.begin() as connection:
        connection.execute(sa.text(
            "UPDATE tasks SET status='CONFIRMED', version=3 "
            "WHERE task_id=:task AND project_id=:project AND status='DRAFT'"
        ), {"task": task_id, "project": project})
    run = SqlAlchemyRunCreationRepository(sessions).create(RunCreationCommand(
        None, task_id, wi, plan, 3, project, environment, _HASH("8"), None, None,
        "r18-qa", f"r18-request-{tag}", f"r18-run-key-{tag}", _HASH("e"), "R18 QA Run"
    ))
    assert len(run.event_ids) == 1 and not run.duplicate
    return run.run_id


def test_opt_in_postgres_run_host_two_observations_and_fail_closed(tmp_path, monkeypatch):
    url = _opt_in_target(os.environ)
    # The R18 DB is a fresh, single-purpose tmpfs instance; Main removes the
    # entire verified container after QA, preserving append-only run_events.
    engine = sa.create_engine(url.set(drivername="postgresql+psycopg"), pool_pre_ping=True)
    host_engine = None
    try:
        _preflight(engine)
        path, payload, _ = _trust(tmp_path)
        environment = _environment(path)
        environment["ANVIL_DATABASE_URL"] = url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
        observed = []

        def host(**kwargs):
            observed.append(kwargs)
            return FastAPI()

        create_oidc_process_app(environment, host)
        owner = observed[0]["operations_owner"]
        host_engine = observed[0]["engine"]
        assert (owner.project_id, owner.environment_id) == ("project-1", "wsl-qa")
        before = _counts(engine)
        assert owner.run_summary().observed_total == 0
        assert _counts(engine) == before
        assert owner.snapshot()["queue"] == []
        assert owner.alerts() == owner.audit() == []

        repo = _mapped_project(engine, "project-1", "wsl-qa", "main")
        wi, plan = _authority(engine, "project-1", "main")
        other_repo = _mapped_project(engine, "project-2", "wsl-qa", "other")
        other_wi, other_plan = _authority(engine, "project-2", "other")
        tag = uuid4().hex[:12]
        active = _create_run(engine, "project-1", "wsl-qa", repo, wi, plan, f"active-{tag}")
        waiting = _create_run(engine, "project-1", "wsl-qa", repo, wi, plan, f"waiting-{tag}")
        blocked = _create_run(engine, "project-1", "wsl-qa", repo, wi, plan, f"blocked-{tag}")
        other_project = _create_run(engine, "project-2", "wsl-qa", other_repo,
                                    other_wi, other_plan, f"other-project-{tag}")
        other_environment = _create_run(engine, "project-1", "other-env", repo,
                                        wi, plan, f"other-env-{tag}", task_environment="wsl-qa")
        other_hash = _request_hash(engine, other_environment)
        with engine.begin() as connection:
            waiting_update = connection.execute(sa.text(
                "UPDATE runs SET status='WAITING_APPROVAL' WHERE run_id=:run"
            ), {"run": waiting})
            blocked_update = connection.execute(
                sa.text("UPDATE runs SET status='BLOCKED' WHERE run_id=:run"),
                {"run": blocked})
            assert waiting_update.rowcount == blocked_update.rowcount == 1
        persisted = _counts(engine)
        assert persisted[:2] == (5, 5)
        assert set(load_scoped_run_source(engine, "project-1", "wsl-qa").run_ids) == {
            active, waiting, blocked
        }
        summary = owner.run_summary()
        assert (summary.observed_total, summary.active_runs,
                summary.waiting_approval_runs, summary.blocked_runs) == (3, 1, 1, 1)
        assert summary.observed_at.tzinfo is not None
        assert _counts(engine) == persisted
        assert owner.snapshot()["queue"] == []
        assert owner.alerts() == owner.audit() == []
        assert all(secret not in repr(summary) for secret in
                   (active, waiting, blocked, other_project, other_environment, "secret"))

        with monkeypatch.context() as patch:
            patch.setattr(host_engine, "connect", lambda: pytest.fail("scope reached DB"))
            with pytest.raises(ValueError, match="^RUN_SOURCE_SCOPE_INVALID$"):
                owner._run_summary_loader("project-2", "wsl-qa")

        # Fault injection is limited to the Run created above in this dedicated DB.
        with engine.begin() as connection:
            injected = connection.execute(sa.text(
                "UPDATE runs SET work_instruction_id=NULL,execution_plan_id=NULL,"
                "idempotency_key=NULL,creation_request_hash=NULL,environment_id=NULL,"
                "permission_snapshot_hash=NULL WHERE run_id=:run AND task_id IN "
                "(SELECT task_id FROM tasks WHERE project_id='project-1')"
            ), {"run": other_environment})
            assert injected.rowcount == 1
        with pytest.raises(OperationsError, match="^RUN_SUMMARY_UNAVAILABLE$"):
            owner.run_summary()
        with engine.begin() as connection:
            restored = connection.execute(sa.text(
                "UPDATE runs SET work_instruction_id=:wi,execution_plan_id=:plan,"
                "idempotency_key=:key,creation_request_hash=:hash,environment_id='other-env',"
                "permission_snapshot_hash=:permission WHERE run_id=:run"
            ), {"wi": wi, "plan": plan, "key": f"r18-run-key-other-env-{tag}",
                "hash": other_hash,
                "permission": _HASH("8"), "run": other_environment})
            assert restored.rowcount == 1
        assert owner.run_summary().observed_total == 3

        for index in range(98):
            _create_run(engine, "project-1", "wsl-qa", repo, wi, plan,
                        f"overflow-{tag}-{index:03d}")
        with pytest.raises(OperationsError, match="^RUN_SUMMARY_UNAVAILABLE$"):
            owner.run_summary()
        with monkeypatch.context() as patch:
            patch.setattr(host_engine, "connect", lambda: (_ for _ in ()).throw(
                RuntimeError("password=secret")))
            with pytest.raises(OperationsError, match="^RUN_SUMMARY_UNAVAILABLE$") as error:
                owner.run_summary()
            assert "secret" not in str(error.value)
        assert _counts(engine)[2:] == persisted[2:]
    finally:
        if host_engine is not None:
            host_engine.dispose()
        engine.dispose()


def _request_hash(engine: sa.engine.Engine, run_id: str) -> str:
    with engine.connect() as connection:
        return connection.execute(sa.text(
            "SELECT creation_request_hash FROM runs WHERE run_id=:run"
        ), {"run": run_id}).scalar_one()
