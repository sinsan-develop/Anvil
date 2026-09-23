"""Canonical F-12 API registry ports over trusted provider settings owners."""

from packages.knowledge.model_registry import ModelRegistryError
from packages.provider_catalog.models import CatalogRejected, PROVIDER_IDS
from packages.provider_settings.service import ProviderSettingsService, SettingsUnavailable

from .common import ApiContractError, ApplicationRequest


class ProviderSettingsPort:
    _READ = ("GET /api/providers", "GET /api/providers/{providerId}",
             "GET /api/providers/{providerId}/models", "GET /api/provider-routing",
             "GET /api/projects/{id}/data-egress-profile")
    _WRITE = ("POST /api/providers/{providerId}:configure", "POST /api/providers/{providerId}:test",
              "POST /api/providers/{providerId}:refresh-models", "POST /api/provider-routing:validate",
              "POST /api/provider-routing:activate", "POST /api/projects/{id}/data-egress-profile:revise",
              "POST /api/secrets/{id}:rotate", "POST /api/secrets/{id}:revoke")

    def __init__(self, service: ProviderSettingsService):
        if type(service) is not ProviderSettingsService:
            raise ValueError("TRUSTED_OWNER_REQUIRED")
        self._service = service

    def query_ports(self):
        return {key: self for key in self._READ}

    def command_ports(self):
        return {key: self for key in self._WRITE}

    def __call__(self, request: ApplicationRequest):
        project, environment = request.authorized_project_id, request.authorized_environment_id
        key = request.endpoint_key
        try:
            if key == "GET /api/projects/{id}/data-egress-profile":
                if request.path_parameters.get("id") != project:
                    raise ApiContractError("AUTHORIZATION_PROJECT_DENIED", "The project scope is not allowed.", 403)
                return self._service.egress(project, environment)
            if key == "GET /api/provider-routing":
                return self._service.routing(project, environment)
            if key in self._READ:
                rows = self._service.providers(project, environment)
                if key == "GET /api/providers":
                    return rows
                provider = request.path_parameters.get("providerId", "")
                if provider not in PROVIDER_IDS:
                    raise ApiContractError("PROVIDER_NOT_FOUND", "The provider was not found.", 404)
                row = next(row for row in rows if row["provider_id"] == provider)
                if key == "GET /api/providers/{providerId}/models":
                    return {"provider_id": provider, "models": row["models"],
                            "status": row["status"], "reason": row["reason"]}
                return row
            if key not in self._WRITE:
                raise ApiContractError("CAPABILITY_NOT_AVAILABLE", "This API capability is not available.", 501)
            if key.startswith("POST /api/providers/"):
                if request.path_parameters.get("providerId") not in PROVIDER_IDS:
                    raise ApiContractError("PROVIDER_NOT_FOUND", "The provider was not found.", 404)
            body = {name: value for name, value in request.body.items()
                    if name not in {"reason", "comment", "expectedStateVersion", "expected_state_version"}}
            context = dict(expected_version=request.expected_version, target_hash=request.target_hash,
                           reason=request.reason, actor_id=request.principal.actor_id)
            if key == "POST /api/provider-routing:activate":
                if set(body) != {"target"}:
                    raise ApiContractError("HOST_ACTIVATION_EVIDENCE_REQUIRED", "Host approval evidence is required.", 501)
                return self._service.activate(project, environment, target=body["target"], **context)
            if key == "POST /api/provider-routing:validate":
                if set(body) != {"routing"}:
                    raise ApiContractError("ROUTING_INPUT_INVALID", "Routing input is invalid.")
                return self._service.validate_routing(project, environment, routing_data=body["routing"], **context)
            if body:
                raise ApiContractError("BROWSER_EVIDENCE_FORBIDDEN", "Host evidence cannot be supplied by the browser.")
            if key == "POST /api/providers/{providerId}:configure":
                return self._service.configure(project, environment, request.path_parameters["providerId"], **context)
            if key == "POST /api/providers/{providerId}:test":
                return self._service.test_connection(project, environment, request.path_parameters["providerId"], **context)
            if key == "POST /api/providers/{providerId}:refresh-models":
                return self._service.refresh_models(project, environment, request.path_parameters["providerId"], **context)
            if key in {"POST /api/secrets/{id}:rotate", "POST /api/secrets/{id}:revoke"}:
                action = self._service.rotate_secret if key.endswith(":rotate") else self._service.revoke_secret
                return action(project, environment, request.path_parameters["id"], **context)
            if key == "POST /api/projects/{id}/data-egress-profile:revise":
                if request.path_parameters.get("id") != project:
                    raise ApiContractError("AUTHORIZATION_PROJECT_DENIED", "The project scope is not allowed.", 403)
                return self._service.revise_egress(project, environment, **context)
            # Owner capture APIs are host-only. No browser request can assert a probe,
            # credential, egress approval, Secret rotation or benchmark result.
            raise ApiContractError("HOST_EVIDENCE_REQUIRED", "Host evidence is required for this operation.", 501)
        except SettingsUnavailable as error:
            code = str(error)
            status = 403 if code == "AUTHORIZATION_SCOPE_MISMATCH" else 501 if code.startswith("HOST_") else 409
            raise ApiContractError(code, "The requested provider operation is unavailable.", status) from error
        except (ModelRegistryError, CatalogRejected) as error:
            raise ApiContractError("OWNER_VALIDATION_FAILED", "The provider owner rejected this operation.", 409) from error
