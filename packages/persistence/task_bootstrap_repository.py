"""PostgreSQL persistence adapter for canonical Task draft bootstrap."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
from typing import Any, Callable
from uuid import uuid4

from sqlalchemy import text

from packages.api.task_bootstrap import (
    ProjectRepositoryUnresolved,
    TaskBootstrapAuthorityMismatch,
    TaskBootstrapCommand,
    TaskBootstrapIdempotencyMismatch,
    TaskBootstrapReceipt,
    canonical_task_authority_hash,
)


def _hash(value: object) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + sha256(raw).hexdigest()


def _title(objective: str) -> str:
    return " ".join(objective.split())[:200]


@dataclass(frozen=True, slots=True)
class TaskBootstrapAuthority:
    project_id: str
    repository_id: str
    target_environment: str
    mapping_version: int


class SqlAlchemyTaskBootstrapRepository:
    def __init__(
        self,
        session_factory: Callable[[], Any],
        *,
        task_id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._sessions = session_factory
        self._task_id = task_id_factory or (lambda: str(uuid4()))

    def resolve_create_authority(
        self, project_id: str, environment_id: str
    ) -> TaskBootstrapAuthority | None:
        return self._authority(project_id, environment_id)

    def resolve_task_authority(self, task_id: str) -> TaskBootstrapAuthority | None:
        session = self._sessions()
        try:
            row = session.execute(
                text(
                    "SELECT task.project_id, task.repository_id, task.target_environment, mapping.version AS mapping_version "
                    "FROM tasks task JOIN project_repositories mapping "
                    "ON mapping.project_id = task.project_id "
                    "AND mapping.repository_id = task.repository_id "
                    "AND mapping.target_environment = task.target_environment "
                    "AND mapping.active = true "
                    "WHERE task.task_id = :task_id"
                ),
                {"task_id": task_id},
            ).mappings().one_or_none()
            return self._authority_from_row(row)
        finally:
            close = getattr(session, "close", None)
            if callable(close):
                close()

    def create(self, command: TaskBootstrapCommand) -> TaskBootstrapReceipt:
        fingerprint = _hash(
            {
                "projectId": command.project_id,
                "objective": command.objective,
                "targetEnvironment": command.target_environment,
                "conversationMessage": command.conversation_message,
                "requestedBy": command.requested_by,
                "expectedVersion": command.expected_version,
                "targetHash": command.target_hash,
                "reason": command.reason,
            }
        )
        session = self._sessions()
        try:
            with session.begin():
                replay = self._replay_in_transaction(
                    session, command.project_id, command.idempotency_key
                )
                if replay is not None:
                    if (
                        replay["creation_request_hash"] != fingerprint
                        or str(replay["target_environment"]) != command.target_environment
                    ):
                        raise TaskBootstrapIdempotencyMismatch(command.idempotency_key)
                    return self._create_receipt_from_row(replay, duplicate=True)
                authority = self._authority_in_transaction(
                    session, command.project_id, command.target_environment
                )
                if authority is None:
                    raise ProjectRepositoryUnresolved(command.project_id)
                if command.target_hash != canonical_task_authority_hash(
                    project_id=authority.project_id,
                    repository_id=authority.repository_id,
                    target_environment=authority.target_environment,
                    mapping_version=authority.mapping_version,
                ):
                    raise TaskBootstrapAuthorityMismatch(command.target_hash)
                replay = self._replay_in_transaction(
                    session, command.project_id, command.idempotency_key
                )
                if replay is not None:
                    if (
                        replay["creation_request_hash"] != fingerprint
                        or str(replay["target_environment"]) != command.target_environment
                    ):
                        raise TaskBootstrapIdempotencyMismatch(command.idempotency_key)
                    return self._create_receipt_from_row(replay, duplicate=True)
                task_id = self._task_id()
                session.execute(
                    text(
                        "INSERT INTO tasks "
                        "(task_id, project_id, repository_id, title, objective, requested_by, status, version, "
                        "target_environment, repository_mapping_version, conversation_message, idempotency_key, creation_request_hash) "
                        "VALUES (:task_id, :project_id, :repository_id, :title, :objective, :requested_by, "
                        "'DRAFT', 1, :target_environment, :mapping_version, :conversation_message, :idempotency_key, :request_hash)"
                    ),
                    {
                        "task_id": task_id,
                        "project_id": command.project_id,
                        "repository_id": authority.repository_id,
                        "title": _title(command.objective),
                        "objective": command.objective,
                        "requested_by": command.requested_by,
                        "target_environment": command.target_environment,
                        "mapping_version": authority.mapping_version,
                        "conversation_message": command.conversation_message,
                        "idempotency_key": command.idempotency_key,
                        "request_hash": fingerprint,
                    },
                )
                return TaskBootstrapReceipt(
                    task_id=task_id,
                    project_id=command.project_id,
                    repository_id=authority.repository_id,
                    objective=command.objective,
                    target_environment=command.target_environment,
                    conversation_message=command.conversation_message,
                    requested_by=command.requested_by,
                    status="DRAFT",
                    version=1,
                    duplicate=False,
                )
        finally:
            close = getattr(session, "close", None)
            if callable(close):
                close()

    def get(
        self, task_id: str, *, project_id: str, environment_id: str
    ) -> TaskBootstrapReceipt | None:
        session = self._sessions()
        try:
            return self._get_in_transaction(
                session, task_id, project_id, environment_id, duplicate=False
            )
        finally:
            close = getattr(session, "close", None)
            if callable(close):
                close()

    def _authority(self, project_id: str, environment_id: str) -> TaskBootstrapAuthority | None:
        session = self._sessions()
        try:
            return self._authority_in_transaction(session, project_id, environment_id)
        finally:
            close = getattr(session, "close", None)
            if callable(close):
                close()

    @staticmethod
    def _authority_from_row(row: Any) -> TaskBootstrapAuthority | None:
        if row is None:
            return None
        return TaskBootstrapAuthority(
            project_id=str(row["project_id"]),
            repository_id=str(row["repository_id"]),
            target_environment=str(row["target_environment"]),
            mapping_version=int(row["mapping_version"]),
        )

    def _authority_in_transaction(
        self, session: Any, project_id: str, environment_id: str
    ) -> TaskBootstrapAuthority | None:
        row = session.execute(
            text(
                "SELECT project_id, repository_id, target_environment, version AS mapping_version "
                "FROM project_repositories WHERE project_id = :project_id "
                "AND target_environment = :environment_id AND active = true FOR UPDATE"
            ),
            {"project_id": project_id, "environment_id": environment_id},
        ).mappings().one_or_none()
        return self._authority_from_row(row)

    @staticmethod
    def _replay_in_transaction(
        session: Any, project_id: str, idempotency_key: str
    ) -> Any:
        return session.execute(
            text(
                "SELECT task.task_id, task.project_id, task.repository_id, task.objective, "
                "task.target_environment, task.conversation_message, task.requested_by, task.status, "
                "task.version, task.creation_request_hash FROM tasks task "
                "WHERE task.project_id = :project_id AND task.idempotency_key = :idempotency_key"
            ),
            {"project_id": project_id, "idempotency_key": idempotency_key},
        ).mappings().one_or_none()

    @staticmethod
    def _receipt_from_row(row: Any, *, duplicate: bool) -> TaskBootstrapReceipt:
        return TaskBootstrapReceipt(
            task_id=str(row["task_id"]),
            project_id=str(row["project_id"]),
            repository_id=str(row["repository_id"]),
            objective=str(row["objective"]),
            target_environment=str(row["target_environment"]),
            conversation_message=str(row["conversation_message"]),
            requested_by=str(row["requested_by"]),
            status=str(row["status"]),
            version=int(row["version"]),
            duplicate=duplicate,
        )

    @staticmethod
    def _create_receipt_from_row(row: Any, *, duplicate: bool) -> TaskBootstrapReceipt:
        receipt = SqlAlchemyTaskBootstrapRepository._receipt_from_row(row, duplicate=duplicate)
        return TaskBootstrapReceipt(
            task_id=receipt.task_id,
            project_id=receipt.project_id,
            repository_id=receipt.repository_id,
            objective=receipt.objective,
            target_environment=receipt.target_environment,
            conversation_message=receipt.conversation_message,
            requested_by=receipt.requested_by,
            status="DRAFT",
            version=1,
            duplicate=duplicate,
        )

    @staticmethod
    def _get_in_transaction(
        session: Any,
        task_id: str,
        project_id: str,
        environment_id: str,
        *,
        duplicate: bool,
    ) -> TaskBootstrapReceipt | None:
        row = session.execute(
            text(
                "SELECT task.task_id, task.project_id, task.repository_id, task.objective, task.target_environment, "
                "task.conversation_message, task.requested_by, task.status, task.version FROM tasks task "
                "JOIN project_repositories mapping ON mapping.project_id = task.project_id "
                "AND mapping.repository_id = task.repository_id "
                "AND mapping.target_environment = task.target_environment "
                "AND mapping.version = task.repository_mapping_version "
                "AND mapping.active = true "
                "WHERE task.task_id = :task_id AND task.project_id = :project_id "
                "AND task.repository_id = mapping.repository_id "
                "AND task.target_environment = :environment_id"
            ),
            {
                "task_id": task_id,
                "project_id": project_id,
                "environment_id": environment_id,
            },
        ).mappings().one_or_none()
        if row is None:
            return None
        return SqlAlchemyTaskBootstrapRepository._receipt_from_row(row, duplicate=duplicate)


__all__ = ["SqlAlchemyTaskBootstrapRepository", "TaskBootstrapAuthority"]
