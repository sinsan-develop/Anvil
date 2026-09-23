"""Authenticated F-13 Operations read port over a trusted scoped owner."""

from packages.observability.service import OperationsService
import re

from .common import ApiContractError, ApplicationRequest


class OperationsPort:
    _ALERTS = "GET /api/operations/alerts"
    _AUDIT = "GET /api/operations/audit"

    def __init__(self, owner: OperationsService):
        if type(owner) is not OperationsService:
            raise ValueError("TRUSTED_OPERATIONS_OWNER_REQUIRED")
        self._owner = owner

    def query_ports(self):
        return {self._ALERTS: self, self._AUDIT: self}

    def __call__(self, request: ApplicationRequest):
        if (request.authorized_project_id != self._owner.project_id
                or request.authorized_environment_id != self._owner.environment_id
                or self._owner.project_id not in request.principal.project_ids
                or self._owner.environment_id not in request.principal.environment_ids):
            raise ApiContractError("AUTHORIZATION_SCOPE_MISMATCH", "The Operations scope is not allowed.", 403)
        if request.endpoint_key == self._ALERTS:
            before = request.headers.get("x-alert-before-sequence")
            if before is not None and not re.fullmatch(r"[1-9][0-9]{0,17}", before):
                raise ApiContractError("ALERT_CURSOR_INVALID", "The alert cursor is invalid.", 400)
            return self._owner.alert_page(before_sequence=int(before) if before is not None else None)
        if request.endpoint_key == self._AUDIT:
            before = request.headers.get("x-audit-before-sequence")
            if before is not None and not re.fullmatch(r"[1-9][0-9]{0,17}", before):
                raise ApiContractError("AUDIT_CURSOR_INVALID", "The audit cursor is invalid.", 400)
            events = self._owner.audit(before_sequence=int(before) if before is not None else None)
            return {"events": events, "next_before_sequence": events[0]["sequence"]
                if events and events[0]["sequence"] > 1 else None}
        raise ApiContractError("CAPABILITY_NOT_AVAILABLE", "This API capability is not available.", 501)
