"""Anvil framework-neutral API contracts and FastAPI adapter."""

from .design_contracts import ApproveDesignRequest, ApproveDesignResponse, ContractError, ContractErrorCode
from .common import ApiContractError, ApplicationRequest, SessionPrincipal, StableCursorCodec
from .fastapi_app import ApiPorts, create_app
from .registry import ApiRegistry, EndpointSpec, canonical_api_registry

__all__ = [
    "ApiContractError",
    "ApiPorts",
    "ApiRegistry",
    "ApplicationRequest",
    "ApproveDesignRequest",
    "ApproveDesignResponse",
    "ContractError",
    "ContractErrorCode",
    "EndpointSpec",
    "SessionPrincipal",
    "StableCursorCodec",
    "canonical_api_registry",
    "create_app",
]
