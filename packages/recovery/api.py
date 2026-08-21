"""B-11 application-port adapters for the recovery service."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Callable

from packages.api.common import ApiContractError, ApplicationRequest
from packages.api.fastapi_app import ApiPorts

from .read_model import recovery_read_model
from .service import RecoveryService


class RecoveryApi:
    def __init__(
        self,
        service: RecoveryService,
        *,
        observed_at: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._service = service
        self._observed_at = observed_at

    def ports(self) -> ApiPorts:
        return ApiPorts(
            queries={"GET /api/runs/{id}/progress": self.read_progress},
            commands={"POST /api/runs/{id}:reconcile": self.reconcile},
        )

    def read_progress(self, request: ApplicationRequest) -> dict[str, object]:
        decision = self._decision(request)
        return recovery_read_model(decision)

    def reconcile(self, request: ApplicationRequest) -> dict[str, object]:
        if request.resource_id is None:
            raise ApiContractError("RUN_ID_REQUIRED", "A Run identifier is required.")
        source = self._service.inspect(request.resource_id)
        if request.target_hash != source.target_hash:
            raise ApiContractError(
                "RECOVERY_TARGET_HASH_MISMATCH",
                "The recovery target hash does not match the current Run.",
                409,
            )
        if request.expected_version != source.db_event_sequence:
            raise ApiContractError(
                "OPTIMISTIC_VERSION_CONFLICT",
                "The resource changed. Refresh and retry with the current version.",
                409,
            )
        decision = self._decision(request)
        return recovery_read_model(decision)

    def _decision(self, request: ApplicationRequest):
        if request.resource_id is None:
            raise ApiContractError("RUN_ID_REQUIRED", "A Run identifier is required.")
        return self._service.reconcile(
            request.resource_id,
            actor_id=request.principal.actor_id,
            observed_at=self._observed_at(),
        )
