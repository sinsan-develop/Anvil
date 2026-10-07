"""F-19A registration HTTP contract over the exact-pair repository."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Protocol

from .common import ApiContractError, SessionPrincipal
from packages.persistence.f19a_registration_repository import F19ARegistrationRejected


REGISTRATION_ENDPOINT_KEYS = frozenset({
    "POST /api/registration/projects",
    "POST /api/registration/projects/{projectId}/environments",
    "PATCH /api/registration/projects/{projectId}",
    "PATCH /api/registration/projects/{projectId}/environments/{environmentId}",
    "PUT /api/authorization/pair-grants/{actorId}/{projectId}/{environmentId}/{permission}",
    "GET /api/dashboard/project-environments",
})


class RegistrationRepository(Protocol):
    def register_project(self, actor_id: str, project_id: str, display_name: str) -> dict: ...
    def register_environment(self, actor_id: str, project_id: str, environment_id: str, display_name: str) -> dict: ...
    def set_registration_active(self, actor_id: str, project_id: str, environment_id_or_none: str | None, active: bool) -> dict: ...
    def set_pair_grant(self, admin_actor_id: str, target_actor_id: str, project_id: str, environment_id: str, permission: str, active: bool) -> dict: ...
    def list_dashboard_pairs(self, actor_id: str) -> tuple[dict, ...]: ...


_REJECTION = {
    "REGISTRATION_INVALID_INPUT": (400, "The registration input is invalid."),
    "REGISTRATION_CONFLICT": (409, "The registration already exists."),
    "REGISTRATION_NOT_FOUND": (404, "The registration was not found."),
    "AUTHORIZATION_SCOPE_MISMATCH": (403, "The action is not allowed."),
    "PAIR_AUTHORIZATION_UNAVAILABLE": (503, "Pair authorization is unavailable."),
}


def _body_keys(body: Mapping[str, Any], required: set[str]) -> None:
    if set(body) != required:
        raise ApiContractError("REGISTRATION_INVALID_INPUT", "The registration input is invalid.", 400)


def _wire(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, dict):
        return {key: _wire(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_wire(item) for item in value]
    return value


def dispatch_registration(
    key: str,
    repository: RegistrationRepository | None,
    principal: SessionPrincipal,
    path: Mapping[str, str],
    body: Mapping[str, Any],
) -> tuple[int, dict[str, Any]]:
    """Resolve a route without trusting the principal's independent ID sets."""
    if repository is None:
        raise ApiContractError("PAIR_AUTHORIZATION_UNAVAILABLE", "Pair authorization is unavailable.", 503)
    action = ("dashboard:read" if key.startswith("GET ") else
              "pair-grants:manage" if key.startswith("PUT ") else None)
    if action is not None and action not in principal.permissions:
        raise ApiContractError("AUTHORIZATION_SCOPE_MISMATCH", "The action is not allowed.", 403)
    if key.startswith("POST /api/registration/projects") and not (
        "projects:register" in principal.permissions or
        ("/environments" in key and "pair-grants:manage" in principal.permissions)
    ):
        raise ApiContractError("AUTHORIZATION_SCOPE_MISMATCH", "The action is not allowed.", 403)
    if key.startswith("PATCH ") and not (
        {"projects:register", "pair-grants:manage"} & principal.permissions
    ):
        raise ApiContractError("AUTHORIZATION_SCOPE_MISMATCH", "The action is not allowed.", 403)

    try:
        if key == "POST /api/registration/projects":
            _body_keys(body, {"projectId", "displayName"})
            result = repository.register_project(principal.actor_id, body["projectId"], body["displayName"])
            status = 201
        elif key == "POST /api/registration/projects/{projectId}/environments":
            _body_keys(body, {"environmentId", "displayName"})
            result = repository.register_environment(principal.actor_id, path["projectId"],
                                                     body["environmentId"], body["displayName"])
            status = 201
        elif key == "PATCH /api/registration/projects/{projectId}":
            _body_keys(body, {"active"})
            result = repository.set_registration_active(principal.actor_id, path["projectId"], None, body["active"])
            status = 200
        elif key == "PATCH /api/registration/projects/{projectId}/environments/{environmentId}":
            _body_keys(body, {"active"})
            result = repository.set_registration_active(principal.actor_id, path["projectId"],
                                                        path["environmentId"], body["active"])
            status = 200
        elif key == "PUT /api/authorization/pair-grants/{actorId}/{projectId}/{environmentId}/{permission}":
            _body_keys(body, {"active"})
            result = repository.set_pair_grant(principal.actor_id, path["actorId"], path["projectId"],
                                               path["environmentId"], path["permission"], body["active"])
            status = 200
        elif key == "GET /api/dashboard/project-environments":
            result = {"items": repository.list_dashboard_pairs(principal.actor_id),
                      "observedAt": datetime.now(timezone.utc)}
            status = 200
        else:
            raise ApiContractError("CAPABILITY_NOT_AVAILABLE", "This API capability is not available.", 501)
    except F19ARegistrationRejected as error:
        code = str(error)
        response_status, message = _REJECTION.get(code, _REJECTION["PAIR_AUTHORIZATION_UNAVAILABLE"])
        raise ApiContractError(code if code in _REJECTION else "PAIR_AUTHORIZATION_UNAVAILABLE",
                               message, response_status) from None
    except ApiContractError:
        raise
    except Exception:
        raise ApiContractError("PAIR_AUTHORIZATION_UNAVAILABLE", "Pair authorization is unavailable.", 503) from None
    return status, _wire(result)
