"""Framework-neutral C-04 developer delegation lifecycle application port."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from packages.orchestration import (
    DeveloperLifecycleService,
    InvalidLifecycleTransition,
    LifecycleTargetMismatch,
    LifecycleVersionMismatch,
    ResumeRejected,
)

from .common import ApiContractError, ApplicationRequest, ApplicationResponse


_READ = "GET /api/delegations/{id}"
_STEER = "POST /api/delegations/{id}:steer"
_CANCEL = "POST /api/delegations/{id}:cancel"
_RESUME = "POST /api/delegations/{id}:resume"
_ROUTES = frozenset({_READ, _STEER, _CANCEL, _RESUME})
_PERMISSIONS = {
    _READ: "delegation:read",
    _STEER: "delegation:steer",
    _CANCEL: "delegation:cancel",
    _RESUME: "delegation:resume",
}


def _canonical_string(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ApiContractError(
            "INVALID_DELEGATION_COMMAND",
            f"{field} must be a canonical non-empty string.",
        )
    return value


def _exact_body(body: Mapping[str, Any], fields: frozenset[str]) -> None:
    if frozenset(body) != fields:
        raise ApiContractError(
            "INVALID_DELEGATION_COMMAND",
            "The delegation command body does not match its canonical contract.",
        )


class DelegationLifecyclePort:
    """Translate canonical HTTP-shaped requests to the lifecycle service."""

    def __init__(self, service: DeveloperLifecycleService) -> None:
        self._service = service

    def __call__(self, request: ApplicationRequest) -> ApplicationResponse:
        if request.endpoint_key not in _ROUTES:
            raise ApiContractError(
                "DELEGATION_ROUTE_INVALID",
                "The delegation lifecycle route is not canonical.",
                404,
            )
        self._authorize(request)
        delegation_id = request.path_parameters.get("id")
        if delegation_id != request.resource_id or not isinstance(delegation_id, str):
            raise ApiContractError(
                "DELEGATION_NOT_FOUND",
                "The developer delegation was not found.",
                404,
            )
        try:
            session_id = self._service.session_id_for_delegation(delegation_id)
        except KeyError as error:
            raise ApiContractError(
                "DELEGATION_NOT_FOUND",
                "The developer delegation was not found.",
                404,
            ) from error

        if request.endpoint_key == _READ:
            _exact_body(request.body, frozenset())
            body = self._service.workbench(session_id).to_dict()
            body["handoff"] = self._service.handoff_projection(session_id).to_dict()
            return ApplicationResponse(body, 200)

        idempotency_key = self._idempotency_key(request.headers)
        if request.target_hash is None or request.expected_version is None:
            raise ApiContractError(
                "INVALID_DELEGATION_COMMAND",
                "Delegation mutations require target_hash and expected_version.",
            )
        if (
            not isinstance(request.reason, str)
            or not request.reason.strip()
            or request.reason != request.reason.strip()
        ):
            raise ApiContractError(
                "DELEGATION_REASON_REQUIRED",
                "A canonical delegation command reason is required.",
            )
        reason = request.reason
        try:
            if request.endpoint_key == _STEER:
                _exact_body(request.body, frozenset({"instruction"}))
                self._service.steer(
                    session_id,
                    _canonical_string(request.body["instruction"], "instruction"),
                    idempotency_key=idempotency_key,
                    reason=reason,
                    target_hash=request.target_hash,
                    expected_state_version=request.expected_version,
                )
                return ApplicationResponse(self._service.workbench(session_id).to_dict(), 200)

            if request.endpoint_key == _CANCEL:
                _exact_body(request.body, frozenset({"reason"}))
                body_reason = _canonical_string(request.body["reason"], "reason")
                result = self._service.stop(
                    session_id, idempotency_key=idempotency_key,
                    reason=body_reason, audit_reason=reason,
                    target_hash=request.target_hash,
                    expected_state_version=request.expected_version,
                )
                return ApplicationResponse(self._service.current(result.session_id).to_dict(), 202)

            _exact_body(request.body, frozenset({"packetHash", "expectedResumeEpoch"}))
            packet_hash = _canonical_string(request.body["packetHash"], "packetHash")
            expected_epoch = request.body["expectedResumeEpoch"]
            if type(expected_epoch) is not int or expected_epoch < 0:
                raise ApiContractError(
                    "INVALID_DELEGATION_COMMAND",
                    "expectedResumeEpoch must be a non-negative integer.",
                )
            result = self._service.resume(
                session_id,
                packet_hash,
                expected_resume_epoch=expected_epoch,
                idempotency_key=idempotency_key,
                reason=reason,
                target_hash=request.target_hash,
                expected_state_version=request.expected_version,
            )
            return ApplicationResponse(self._service.current(result.session_id).to_dict(), 200)
        except ApiContractError:
            raise
        except LifecycleTargetMismatch as error:
            raise ApiContractError(
                "DELEGATION_TARGET_MISMATCH", str(error), 409,
            ) from error
        except LifecycleVersionMismatch as error:
            raise ApiContractError(
                "DELEGATION_VERSION_MISMATCH", str(error), 409,
            ) from error
        except InvalidLifecycleTransition as error:
            raise ApiContractError(
                "DELEGATION_COMMAND_CONFLICT", str(error), 409,
            ) from error
        except ResumeRejected as error:
            raise ApiContractError(
                "DELEGATION_RESUME_REJECTED", str(error), 409,
            ) from error
        except (TypeError, ValueError) as error:
            raise ApiContractError(
                "INVALID_DELEGATION_COMMAND", str(error), 400,
            ) from error

    @staticmethod
    def _idempotency_key(headers: Mapping[str, str]) -> str:
        value = headers.get("idempotency-key")
        if not isinstance(value, str) or not value.strip() or value != value.strip():
            raise ApiContractError(
                "IDEMPOTENCY_KEY_REQUIRED",
                "A canonical idempotency key is required.",
            )
        return value

    @staticmethod
    def _authorize(request: ApplicationRequest) -> None:
        permission = _PERMISSIONS[request.endpoint_key]
        if permission not in request.principal.permissions:
            raise ApiContractError(
                "DELEGATION_PERMISSION_DENIED",
                "The principal cannot perform this delegation operation.",
                403,
            )
        if (
            request.authorized_project_id not in request.principal.project_ids
            or request.authorized_environment_id not in request.principal.environment_ids
        ):
            raise ApiContractError(
                "DELEGATION_SCOPE_DENIED",
                "The authorized project or environment is outside the principal scope.",
                403,
            )


__all__ = ["DelegationLifecyclePort"]
