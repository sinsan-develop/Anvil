"""HTTP application port for credential-safe Provider status reads."""

from __future__ import annotations

from collections.abc import Mapping

from packages.agent_team.provider_status import ProviderStatusService

from .common import ApiContractError, ApplicationRequest


class ProviderStatusPort:
    LIST_KEY = "GET /api/providers"
    DETAIL_KEY = "GET /api/providers/{providerId}"
    MODELS_KEY = "GET /api/providers/{providerId}/models"

    __slots__ = ("_service",)

    def __init__(self, environment: Mapping[str, str]) -> None:
        self._service = ProviderStatusService(environment)

    def query_ports(self):
        return {
            self.LIST_KEY: self,
            self.DETAIL_KEY: self,
            self.MODELS_KEY: self,
        }

    def __call__(self, request: ApplicationRequest):
        if request.endpoint_key == self.LIST_KEY:
            return [status.as_public_dict() for status in self._service.list()]
        provider_id = request.path_parameters.get("providerId", "")
        try:
            status = self._service.get(provider_id)
        except LookupError as error:
            raise ApiContractError(
                "PROVIDER_NOT_FOUND", "The provider was not found.", 404
            ) from error
        if request.endpoint_key == self.DETAIL_KEY:
            return status.as_public_dict()
        if request.endpoint_key == self.MODELS_KEY:
            return {
                "provider_id": status.provider_id,
                "models": list(status.models),
                "moa_eligible": status.moa_eligible,
            }
        raise ApiContractError(
            "CAPABILITY_NOT_AVAILABLE", "This API capability is not available.", 501
        )


__all__ = ["ProviderStatusPort"]
