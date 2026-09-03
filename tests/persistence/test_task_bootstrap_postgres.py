from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import os
from dataclasses import replace
import threading
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from packages.persistence.task_bootstrap_repository import (
    SqlAlchemyTaskBootstrapRepository,
    TaskBootstrapCommand,
    TaskBootstrapAuthorityMismatch,
    TaskBootstrapIdempotencyMismatch,
    canonical_task_authority_hash,
)


DSN = os.environ.get("ANVIL_TEST_POSTGRES_DSN")
requires_postgres = pytest.mark.skipif(not DSN, reason="ANVIL_TEST_POSTGRES_DSN is not configured")


class _Result:
    def __init__(self, row):
        self._row = row

    def mappings(self):
        return self

    def one_or_none(self):
        return self._row


class _ReplaySession:
    """Minimal transaction fixture that makes Task replay query order observable."""

    def __init__(self):
        self.mapping_version = 1
        self.mapping_active = True
        self.authority_queries = 0
        self.inserts = 0
        self._tasks_by_key = {}
        self._tasks_by_id = {}

    def begin(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def close(self):
        pass

    def execute(self, statement, parameters):
        query = str(statement)
        if "FROM tasks task WHERE task.project_id = :project_id" in query:
            return _Result(self._tasks_by_key.get((parameters["project_id"], parameters["idempotency_key"])))
        if "FROM project_repositories WHERE" in query:
            self.authority_queries += 1
            if not self.mapping_active:
                return _Result(None)
            return _Result(
                {
                    "project_id": parameters["project_id"],
                    "repository_id": "repository-1",
                    "target_environment": parameters["environment_id"],
                    "mapping_version": self.mapping_version,
                }
            )
        if "INSERT INTO tasks" in query:
            self.inserts += 1
            row = {
                "task_id": parameters["task_id"],
                "project_id": parameters["project_id"],
                "repository_id": parameters["repository_id"],
                "objective": parameters["objective"],
                "target_environment": parameters["target_environment"],
                "conversation_message": parameters["conversation_message"],
                "requested_by": parameters["requested_by"],
                "status": "DRAFT",
                "version": 1,
                "creation_request_hash": parameters["request_hash"],
            }
            self._tasks_by_key[(row["project_id"], parameters["idempotency_key"])] = row
            self._tasks_by_id[row["task_id"]] = row
            return _Result(None)
        if "FROM tasks task" in query:
            assert "JOIN project_repositories" not in query
            row = self._tasks_by_id.get(parameters["task_id"])
            if row is None or row["project_id"] != parameters["project_id"]:
                return _Result(None)
            if row["target_environment"] != parameters["environment_id"]:
                return _Result(None)
            return _Result(row)
        raise AssertionError(f"unexpected SQL: {query}")


def _command(
    *,
    idempotency_key="create-task-1",
    target_hash=None,
    objective="Reject unknown member ids with 404.",
    target_environment="env-local",
):
    return TaskBootstrapCommand(
        task_id=None,
        project_id="project-1",
        objective=objective,
        target_environment=target_environment,
        conversation_message="Preserve existing member responses.",
        requested_by="operator-1",
        expected_version=0,
        idempotency_key=idempotency_key,
        target_hash=target_hash
        or canonical_task_authority_hash(
            project_id="project-1",
            repository_id="repository-1",
            target_environment=target_environment,
            mapping_version=1,
        ),
        reason="create a task draft",
    )


def test_task_replay_precedes_current_mapping_lock_and_uses_stored_receipt():
    """Moving replay after mutable mapping validation must reject this v1-to-v2 retry."""
    session = _ReplaySession()
    repository = SqlAlchemyTaskBootstrapRepository(lambda: session, task_id_factory=lambda: "task-1")
    original = _command()

    created = repository.create(original)
    session.mapping_version = 2
    replay = repository.create(original)

    assert created.task_id == replay.task_id == "task-1"
    assert replay.duplicate is True
    assert session.inserts == 1
    assert session.authority_queries == 1
    with pytest.raises(TaskBootstrapIdempotencyMismatch):
        repository.create(_command(objective="Different payload for the stored key."))
    with pytest.raises(TaskBootstrapAuthorityMismatch):
        repository.create(_command(idempotency_key="create-task-2"))
    assert session.authority_queries == 2
    session.mapping_active = False
    inactive_replay = repository.create(original)
    assert inactive_replay.task_id == "task-1"
    assert inactive_replay.duplicate is True
    assert session.authority_queries == 2
    with pytest.raises(TaskBootstrapIdempotencyMismatch):
        repository.create(_command(target_environment="env-other"))


def test_task_replay_returns_the_immutable_creation_receipt_after_status_advances():
    """Using mutable Task status for POST replay must not replace the original draft receipt."""
    session = _ReplaySession()
    repository = SqlAlchemyTaskBootstrapRepository(
        lambda: session, task_id_factory=lambda: "task-1"
    )
    command = _command()

    created = repository.create(command)
    session._tasks_by_id["task-1"]["status"] = "COMPLETED"
    session._tasks_by_id["task-1"]["version"] = 7
    replay = repository.create(command)

    assert created.status == replay.status == "DRAFT"
    assert created.version == replay.version == 1
    assert replay.task_id == created.task_id == "task-1"
    assert replay.duplicate is True
    assert session.inserts == 1


@requires_postgres
def test_postgres_task_create_rejects_same_project_key_with_a_different_payload():
    """Replacing the persisted request hash check must fail this PostgreSQL contract."""
    suffix = uuid4().hex
    project_id = f"project-{suffix}"
    task_id = f"task-{suffix}"
    engine = create_engine(DSN, pool_pre_ping=True)
    repository = SqlAlchemyTaskBootstrapRepository(
        sessionmaker(bind=engine, expire_on_commit=False), task_id_factory=lambda: task_id
    )
    command = TaskBootstrapCommand(
        task_id=None,
        project_id=project_id,
        objective="Reject unknown member ids with 404.",
        target_environment="env-local",
        conversation_message="Preserve existing member responses.",
        requested_by="operator-1",
        expected_version=0,
        idempotency_key="create-task-1",
        target_hash=canonical_task_authority_hash(
            project_id=project_id,
            repository_id=f"repository-{suffix}",
            target_environment="env-local",
            mapping_version=1,
        ),
        reason="create a task draft",
    )
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO project_repositories "
                    "(project_id, repository_id, target_environment, active, version) "
                    "VALUES (:project_id, :repository_id, :target_environment, true, 1)"
                ),
                {
                    "project_id": project_id,
                    "repository_id": f"repository-{suffix}",
                    "target_environment": "env-local",
                },
            )

        created = repository.create(command)
        replay = repository.create(command)
        assert created.task_id == task_id
        assert replay.task_id == task_id
        assert replay.duplicate is True
        with pytest.raises(TaskBootstrapIdempotencyMismatch):
            repository.create(
                replace(command, objective="Return a different payload for the same key.")
            )
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM tasks WHERE task_id = :task_id"), {"task_id": task_id})
            connection.execute(
                text("DELETE FROM project_repositories WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
        engine.dispose()


@requires_postgres
def test_postgres_task_read_hides_a_task_after_its_authority_mapping_is_revoked():
    """A read query that omits the active mapping join must not return a revoked Task."""
    suffix = uuid4().hex
    project_id = f"project-{suffix}"
    task_id = f"task-{suffix}"
    engine = create_engine(DSN, pool_pre_ping=True)
    repository = SqlAlchemyTaskBootstrapRepository(
        sessionmaker(bind=engine, expire_on_commit=False), task_id_factory=lambda: task_id
    )
    command = TaskBootstrapCommand(
        task_id=None, project_id=project_id, objective="Read only an active mapping.",
        target_environment="env-local", conversation_message="Use mapping authority.",
        requested_by="operator-1", expected_version=0, idempotency_key="create-task-1",
        target_hash=canonical_task_authority_hash(
            project_id=project_id,
            repository_id=f"repository-{suffix}",
            target_environment="env-local",
            mapping_version=1,
        ), reason="create a mapped task draft",
    )
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO project_repositories "
                    "(project_id, repository_id, target_environment, active, version) "
                    "VALUES (:project_id, :repository_id, :target_environment, true, 1)"
                ),
                {"project_id": project_id, "repository_id": f"repository-{suffix}", "target_environment": "env-local"},
            )
        repository.create(command)
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE project_repositories SET active = false WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
        assert repository.get(task_id, project_id=project_id, environment_id="env-local") is None
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM tasks WHERE task_id = :task_id"), {"task_id": task_id})
            connection.execute(text("DELETE FROM project_repositories WHERE project_id = :project_id"), {"project_id": project_id})
        engine.dispose()


@requires_postgres
def test_postgres_concurrent_same_key_same_fingerprint_returns_one_duplicate_receipt():
    """Removing the post-lock replay check must expose a unique-key error to one writer."""
    suffix = uuid4().hex
    project_id = f"project-{suffix}"
    repository_id = f"repository-{suffix}"
    engine = create_engine(DSN, pool_pre_ping=True)
    repository = SqlAlchemyTaskBootstrapRepository(
        sessionmaker(bind=engine, expire_on_commit=False),
        task_id_factory=lambda: f"task-{uuid4().hex}",
    )
    command = TaskBootstrapCommand(
        task_id=None,
        project_id=project_id,
        objective="Create one task under a concurrent retry.",
        target_environment="env-local",
        conversation_message="Both writers use the exact same canonical command.",
        requested_by="operator-1",
        expected_version=0,
        idempotency_key="concurrent-create-task-1",
        target_hash=canonical_task_authority_hash(
            project_id=project_id,
            repository_id=repository_id,
            target_environment="env-local",
            mapping_version=1,
        ),
        reason="verify concurrent idempotent task creation",
    )
    first_replay_barrier = threading.Barrier(2)
    replay_threads: set[int] = set()
    replay_threads_lock = threading.Lock()

    def synchronize_initial_replay(
        _connection, _cursor, statement, _parameters, _context, _executemany
    ):
        normalized = " ".join(statement.lower().split())
        if "from tasks task where task.project_id" not in normalized or "idempotency_key" not in normalized:
            return
        thread_id = threading.get_ident()
        with replay_threads_lock:
            if thread_id in replay_threads:
                return
            replay_threads.add(thread_id)
        first_replay_barrier.wait(timeout=15)

    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO project_repositories "
                    "(project_id, repository_id, target_environment, active, version) "
                    "VALUES (:project_id, :repository_id, :target_environment, true, 1)"
                ),
                {
                    "project_id": project_id,
                    "repository_id": repository_id,
                    "target_environment": "env-local",
                },
            )

        event.listen(engine, "after_cursor_execute", synchronize_initial_replay)
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="task-bootstrap") as executor:
            futures = [executor.submit(repository.create, command) for _ in range(2)]
            receipts = [future.result(timeout=30) for future in futures]
        event.remove(engine, "after_cursor_execute", synchronize_initial_replay)

        assert receipts[0].task_id == receipts[1].task_id
        assert sorted(receipt.duplicate for receipt in receipts) == [False, True]
        with engine.begin() as connection:
            count = connection.execute(
                text(
                    "SELECT count(*) FROM tasks "
                    "WHERE project_id = :project_id AND idempotency_key = :idempotency_key"
                ),
                {"project_id": project_id, "idempotency_key": command.idempotency_key},
            ).scalar_one()
        assert count == 1
    finally:
        if event.contains(engine, "after_cursor_execute", synchronize_initial_replay):
            event.remove(engine, "after_cursor_execute", synchronize_initial_replay)
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM tasks WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
            connection.execute(
                text("DELETE FROM project_repositories WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
        engine.dispose()
