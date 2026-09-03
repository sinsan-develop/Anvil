"""Canonical Task draft create/read application port."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import re
from typing import Protocol

from .common import ApiContractError, ApplicationRequest, ApplicationResponse


_CREATE_KEYS = {"objective", "targetEnvironment", "conversationMessage"}
_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _text(value: object, field: str, maximum: int) -> str:
    if not isinstance(value, str) or not value.strip() or value != value.strip() or len(value) > maximum:
        raise ValueError(f"{field} is invalid")
    return value


def canonical_task_authority_hash(
    *,
    project_id: str,
    repository_id: str,
    target_environment: str,
    mapping_version: int,
) -> str:
    """Return the public deterministic authority hash for Task creation."""
    for value, field in (
        (project_id, "project_id"),
        (repository_id, "repository_id"),
        (target_environment, "target_environment"),
    ):
        _text(value, field, 128)
    if type(mapping_version) is not int or mapping_version < 1:
        raise ValueError("mapping_version is invalid")
    payload = json.dumps(
        {
            "mappingVersion": mapping_version,
            "projectId": project_id,
            "repositoryId": repository_id,
            "targetEnvironment": target_environment,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + sha256(payload).hexdigest()


@dataclass(frozen=True, slots=True)
class TaskBootstrapCommand:
    task_id: None
    project_id: str
    objective: str
    target_environment: str
    conversation_message: str
    requested_by: str
    expected_version: int
    idempotency_key: str
    target_hash: str
    reason: str

    def __post_init__(self) -> None:
        if self.task_id is not None:
            raise ValueError("task_id must be server generated")
        for value, field, maximum in (
            (self.project_id, "project_id", 128),
            (self.objective, "objective", 10_000),
            (self.target_environment, "target_environment", 128),
            (self.conversation_message, "conversation_message", 10_000),
            (self.requested_by, "requested_by", 128),
            (self.idempotency_key, "idempotency_key", 128),
            (self.reason, "reason", 200),
        ):
            _text(value, field, maximum)
        if type(self.expected_version) is not int or self.expected_version != 0:
            raise ValueError("expected_version must be zero for Task creation")
        if not isinstance(self.target_hash, str) or not _HASH.fullmatch(self.target_hash):
            raise ValueError("target_hash is invalid")


@dataclass(frozen=True, slots=True)
class TaskBootstrapReceipt:
    task_id: str
    project_id: str
    repository_id: str
    objective: str
    target_environment: str
    conversation_message: str
    requested_by: str
    status: str
    version: int
    duplicate: bool


class TaskBootstrapError(ValueError):
    pass


class TaskBootstrapIdempotencyMismatch(TaskBootstrapError):
    pass


class TaskBootstrapAuthorityMismatch(TaskBootstrapError):
    pass


class ProjectRepositoryUnresolved(TaskBootstrapError):
    pass


class TaskBootstrapNotFound(TaskBootstrapError):
    pass


class TaskBootstrapService(Protocol):
    def create(self, command: TaskBootstrapCommand) -> TaskBootstrapReceipt: ...

    def get(
        self, task_id: str, *, project_id: str, environment_id: str
    ) -> TaskBootstrapReceipt | None: ...


def _create_projection(receipt: TaskBootstrapReceipt) -> dict[str, object]:
    return {"taskId": receipt.task_id, "status": receipt.status.lower()}


def _read_projection(receipt: TaskBootstrapReceipt) -> dict[str, object]:
    return {
        "taskId": receipt.task_id,
        "projectId": receipt.project_id,
        "repositoryId": receipt.repository_id,
        "objective": receipt.objective,
        "targetEnvironment": receipt.target_environment,
        "status": receipt.status.lower(),
        "version": receipt.version,
        "requirements": [],
        "questions": [],
    }


class TaskBootstrapPort:
    def __init__(self, service: TaskBootstrapService):
        self._service = service

    def __call__(self, request: ApplicationRequest) -> ApplicationResponse:
        if request.endpoint_key == "POST /api/projects/{projectId}/tasks":
            return self._create(request)
        if request.endpoint_key == "GET /api/tasks/{taskId}":
            return self._get(request)
        raise ApiContractError("TASK_BOOTSTRAP_ROUTE_INVALID", "The Task route is invalid.")

    def _create(self, request: ApplicationRequest) -> ApplicationResponse:
        if set(request.body) != _CREATE_KEYS:
            raise ApiContractError("INVALID_TASK_BOOTSTRAP", "The Task creation body does not match the canonical contract.")
        if request.expected_version != 0:
            raise ApiContractError("TASK_CREATE_VERSION_CONFLICT", "A new Task must use expected version zero.", 409)
        if request.path_parameters.get("projectId") != request.authorized_project_id:
            raise ApiContractError("AUTHORIZATION_PROJECT_DENIED", "The project scope is not allowed for this resource.", 403)
        try:
            target_environment = _text(request.body.get("targetEnvironment"), "targetEnvironment", 128)
            if target_environment != request.authorized_environment_id:
                raise ApiContractError("AUTHORIZATION_ENVIRONMENT_DENIED", "The environment scope is not allowed for this resource.", 403)
            command = TaskBootstrapCommand(
                task_id=None,
                project_id=request.path_parameters["projectId"],
                objective=_text(request.body.get("objective"), "objective", 10_000),
                target_environment=target_environment,
                conversation_message=_text(request.body.get("conversationMessage"), "conversationMessage", 10_000),
                requested_by=request.principal.actor_id,
                expected_version=request.expected_version,
                idempotency_key=request.headers["idempotency-key"],
                target_hash=request.target_hash or "",
                reason=request.reason or "",
            )
        except ApiContractError:
            raise
        except (KeyError, TypeError, ValueError) as error:
            raise ApiContractError("INVALID_TASK_BOOTSTRAP", "The Task creation request is invalid.") from error
        try:
            receipt = self._service.create(command)
        except ProjectRepositoryUnresolved as error:
            raise ApiContractError(
                "PROJECT_REPOSITORY_UNRESOLVED",
                "The project repository authority could not be resolved.",
                403,
            ) from error
        except TaskBootstrapIdempotencyMismatch as error:
            raise ApiContractError(
                "TASK_IDEMPOTENCY_MISMATCH",
                "The idempotency key was already used with a different Task request.",
                409,
            ) from error
        except TaskBootstrapAuthorityMismatch as error:
            raise ApiContractError(
                "TASK_TARGET_HASH_MISMATCH",
                "The target hash does not match current project repository authority.",
                409,
            ) from error
        return ApplicationResponse(_create_projection(receipt), 201)

    def _get(self, request: ApplicationRequest) -> ApplicationResponse:
        receipt = self._service.get(
            request.path_parameters["taskId"],
            project_id=request.authorized_project_id,
            environment_id=request.authorized_environment_id,
        )
        if receipt is None:
            raise ApiContractError("TASK_NOT_FOUND", "The Task was not found.", 404)
        return ApplicationResponse(_read_projection(receipt), 200)


__all__ = [
    "ProjectRepositoryUnresolved",
    "TaskBootstrapAuthorityMismatch",
    "TaskBootstrapCommand",
    "TaskBootstrapIdempotencyMismatch",
    "TaskBootstrapNotFound",
    "TaskBootstrapPort",
    "TaskBootstrapReceipt",
    "TaskBootstrapService",
    "canonical_task_authority_hash",
]
