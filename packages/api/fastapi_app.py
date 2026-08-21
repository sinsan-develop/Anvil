"""FastAPI adapter over framework-neutral application ports."""

from __future__ import annotations

from dataclasses import dataclass, field
import hmac
import inspect
import re
from typing import Any, Callable, Mapping

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from packages.events.transition_guard import OptimisticVersionConflict

from .common import ApiContractError, ApplicationRequest, SessionPrincipal, canonical_target_hash
from .registry import ApiRegistry, EndpointSpec, canonical_api_registry
from .security import WebSecurityConfig, effective_host, request_id, security_headers
from .sse import EmptyEventStream, EventStreamPort, encode_sse


ApplicationPort = Callable[[ApplicationRequest], Any]
Authenticator = Callable[[str], SessionPrincipal | None]
_IF_MATCH = re.compile(r'(?:W/)?"?([0-9]+)"?\Z')


@dataclass(frozen=True, slots=True)
class AuthorizationScope:
    project_id: str
    environment_id: str
    allowed_actor_roles: frozenset[str]


AuthorizationResolver = Callable[[EndpointSpec, Mapping[str, str]], AuthorizationScope | None]


@dataclass(frozen=True, slots=True)
class ApiPorts:
    commands: Mapping[str, ApplicationPort] = field(default_factory=dict)
    queries: Mapping[str, ApplicationPort] = field(default_factory=dict)

    def resolve(self, endpoint: EndpointSpec) -> ApplicationPort | None:
        return (self.commands if endpoint.is_mutation else self.queries).get(endpoint.key)


def _deny_authentication(_token: str) -> SessionPrincipal | None:
    return None


def _error_response(request: Request, error: ApiContractError) -> JSONResponse:
    rid = request.state.request_id
    return JSONResponse(
        {"error": {"code": error.code, "message": error.public_message, "request_id": rid}},
        status_code=error.status_code,
    )


def _resource_id(request: Request) -> str | None:
    for name in ("id", "taskId", "providerId"):
        if request.path_params.get(name):
            return str(request.path_params[name])
    return None


def _expected_version(request: Request, body: Mapping[str, Any]) -> int:
    header = request.headers.get("if-match")
    body_value = body.get("expected_state_version")
    if header is None and body_value is None:
        raise ApiContractError("EXPECTED_VERSION_REQUIRED", "An expected resource version is required.")
    parsed: int | None = None
    if header is not None:
        match = _IF_MATCH.fullmatch(header)
        if match is None:
            raise ApiContractError("INVALID_EXPECTED_VERSION", "The expected resource version is invalid.")
        parsed = int(match.group(1))
    if body_value is not None and (not isinstance(body_value, int) or isinstance(body_value, bool) or body_value < 0):
        raise ApiContractError("INVALID_EXPECTED_VERSION", "The expected resource version is invalid.")
    if parsed is not None and body_value is not None and parsed != body_value:
        raise ApiContractError("EXPECTED_VERSION_MISMATCH", "Expected resource versions do not match.", 409)
    return parsed if parsed is not None else body_value


async def _body(request: Request) -> Mapping[str, Any]:
    if not await request.body():
        return {}
    try:
        value = await request.json()
    except ValueError as error:
        raise ApiContractError("INVALID_JSON", "The request body must be valid JSON.") from error
    if not isinstance(value, Mapping):
        raise ApiContractError("INVALID_BODY", "The request body must be a JSON object.")
    return value


def _principal(request: Request, authenticate: Authenticator, config: WebSecurityConfig) -> SessionPrincipal:
    token = request.cookies.get(config.session_cookie_name)
    principal = authenticate(token) if token else None
    if principal is None:
        raise ApiContractError("AUTHENTICATION_REQUIRED", "Authentication is required.", 401)
    return principal


def _authorize(
    principal: SessionPrincipal,
    endpoint: EndpointSpec,
    path_parameters: Mapping[str, str],
    resolve_authorization: AuthorizationResolver | None,
) -> None:
    if endpoint.permission not in principal.permissions:
        raise ApiContractError("PERMISSION_DENIED", "Permission is denied.", 403)
    if resolve_authorization is None:
        raise ApiContractError(
            "AUTHORIZATION_SCOPE_UNRESOLVED",
            "The authorization scope could not be resolved.",
            403,
        )
    scope = resolve_authorization(endpoint, path_parameters)
    if (
        not isinstance(scope, AuthorizationScope)
        or not isinstance(scope.project_id, str)
        or not scope.project_id.strip()
        or scope.project_id != scope.project_id.strip()
        or not isinstance(scope.environment_id, str)
        or not scope.environment_id.strip()
        or scope.environment_id != scope.environment_id.strip()
        or not isinstance(scope.allowed_actor_roles, frozenset)
        or not scope.allowed_actor_roles
        or any(
            not isinstance(role, str) or not role.strip() or role != role.strip()
            for role in scope.allowed_actor_roles
        )
    ):
        raise ApiContractError(
            "AUTHORIZATION_SCOPE_UNRESOLVED",
            "The authorization scope could not be resolved.",
            403,
        )
    if principal.actor_role not in scope.allowed_actor_roles:
        raise ApiContractError(
            "AUTHORIZATION_ROLE_DENIED",
            "The actor role is not allowed for this resource.",
            403,
        )
    if scope.project_id not in principal.project_ids:
        raise ApiContractError(
            "AUTHORIZATION_PROJECT_DENIED",
            "The project scope is not allowed for this resource.",
            403,
        )
    if scope.environment_id not in principal.environment_ids:
        raise ApiContractError(
            "AUTHORIZATION_ENVIRONMENT_DENIED",
            "The environment scope is not allowed for this resource.",
            403,
        )


def _host(request: Request, config: WebSecurityConfig) -> None:
    client_ip = request.client.host if request.client else None
    headers = {key.lower(): value for key, value in request.headers.items()}
    if effective_host(headers, client_ip, config) not in config.allowed_hosts:
        raise ApiContractError("HOST_VALIDATION_FAILED", "The request host is not allowed.", 403)


def _mutation_security(
    request: Request,
    endpoint: EndpointSpec,
    principal: SessionPrincipal,
    body: Mapping[str, Any],
    config: WebSecurityConfig,
) -> tuple[int, str, str]:
    origin = request.headers.get("origin")
    if origin is None or origin not in config.allowed_origins:
        raise ApiContractError("ORIGIN_VALIDATION_FAILED", "The request origin is not allowed.", 403)
    csrf = request.headers.get("x-csrf-token")
    if csrf is None or not hmac.compare_digest(csrf, principal.csrf_token):
        raise ApiContractError("CSRF_VALIDATION_FAILED", "The CSRF token is invalid.", 403)
    key = request.headers.get("idempotency-key")
    if key is None or not key.strip() or len(key) > 128:
        raise ApiContractError("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.")
    expected = _expected_version(request, body)
    target_hash = canonical_target_hash(request.headers.get("x-target-hash"))
    if request.headers.get("x-permission-scope") != endpoint.permission:
        raise ApiContractError("PERMISSION_SCOPE_MISMATCH", "The permission scope is invalid.", 403)
    reason = request.headers.get("x-reason") or body.get("reason") or body.get("comment")
    if not isinstance(reason, str) or not reason.strip() or reason != reason.strip():
        raise ApiContractError("REASON_REQUIRED", "A reason or comment is required.")
    return expected, target_hash, reason


def _endpoint_handler(
    endpoint: EndpointSpec,
    ports: ApiPorts,
    authenticate: Authenticator,
    config: WebSecurityConfig,
    resolve_authorization: AuthorizationResolver | None,
) -> Callable[[Request], Any]:
    async def handler(request: Request, **_path_parameters: str) -> Response:
        try:
            _host(request, config)
            principal = _principal(request, authenticate, config)
            _authorize(principal, endpoint, dict(request.path_params), resolve_authorization)
            body = await _body(request) if endpoint.is_mutation else {}
            expected = target_hash = reason = None
            if endpoint.is_mutation:
                expected, target_hash, reason = _mutation_security(request, endpoint, principal, body, config)
            port = ports.resolve(endpoint)
            if port is None:
                raise ApiContractError("CAPABILITY_NOT_AVAILABLE", "This API capability is not available.", 501)
            application_request = ApplicationRequest(
                endpoint.key,
                _resource_id(request),
                {key: str(value) for key, value in request.path_params.items()},
                body,
                {key.lower(): value for key, value in request.headers.items()},
                principal,
                request.state.request_id,
                expected,
                target_hash,
                reason,
            )
            result = port(application_request)
            if inspect.isawaitable(result):
                result = await result
            return JSONResponse({"data": result, "request_id": request.state.request_id})
        except OptimisticVersionConflict:
            return _error_response(
                request,
                ApiContractError(
                    "OPTIMISTIC_VERSION_CONFLICT",
                    "The resource changed. Refresh and retry with the current version.",
                    409,
                ),
            )
        except ApiContractError as error:
            return _error_response(request, error)
        except Exception:
            return _error_response(
                request,
                ApiContractError("INTERNAL_ERROR", "An internal error occurred.", 500),
            )

    handler.__name__ = "endpoint_" + re.sub(r"[^a-zA-Z0-9]", "_", endpoint.key)
    _declare_path_parameters(handler, endpoint.path)
    return handler


def _sse_handler(
    endpoint: EndpointSpec,
    stream: EventStreamPort,
    authenticate: Authenticator,
    config: WebSecurityConfig,
    resolve_authorization: AuthorizationResolver | None,
) -> Callable[[Request], Any]:
    async def handler(request: Request, **_path_parameters: str) -> Response:
        try:
            _host(request, config)
            principal = _principal(request, authenticate, config)
            _authorize(principal, endpoint, dict(request.path_params), resolve_authorization)
            if "after" in request.query_params:
                raise ApiContractError(
                    "SSE_QUERY_CURSOR_FORBIDDEN",
                    "Use the Last-Event-ID header to resume the event stream.",
                )
            events = stream.events_after(str(request.path_params["id"]), request.headers.get("last-event-id"))
            return Response(
                encode_sse(events),
                media_type="text/event-stream",
                headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
            )
        except ApiContractError as error:
            return _error_response(request, error)

    handler.__name__ = "endpoint_GET_api_runs_id_events"
    _declare_path_parameters(handler, endpoint.path)
    return handler


def _declare_path_parameters(handler: Callable[..., Any], path: str) -> None:
    """Expose dynamic registry path parameters to FastAPI and OpenAPI."""
    names = re.findall(r"\{([^{}]+)\}", path)
    parameters = [
        inspect.Parameter(
            "request",
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            annotation=Request,
        )
    ]
    parameters.extend(
        inspect.Parameter(
            name,
            inspect.Parameter.KEYWORD_ONLY,
            annotation=str,
        )
        for name in names
    )
    handler.__signature__ = inspect.Signature(parameters, return_annotation=Response)


def create_app(
    *,
    registry: ApiRegistry | None = None,
    ports: ApiPorts | None = None,
    event_stream: EventStreamPort | None = None,
    authenticate: Authenticator | None = None,
    security_config: WebSecurityConfig | None = None,
    authorization_resolver: AuthorizationResolver | None = None,
    recovery_ports: ApiPorts | None = None,
) -> FastAPI:
    api_registry = registry or canonical_api_registry()
    base_ports = ports or ApiPorts()
    if recovery_ports is None:
        application_ports = base_ports
    else:
        duplicate_commands = set(base_ports.commands) & set(recovery_ports.commands)
        duplicate_queries = set(base_ports.queries) & set(recovery_ports.queries)
        if duplicate_commands or duplicate_queries:
            raise ValueError("recovery ports must not replace an existing application port")
        application_ports = ApiPorts(
            commands={**base_ports.commands, **recovery_ports.commands},
            queries={**base_ports.queries, **recovery_ports.queries},
        )
    stream = event_stream or EmptyEventStream()
    authenticator = authenticate or _deny_authentication
    config = security_config or WebSecurityConfig()
    app = FastAPI(title="Anvil Control API", version="1.0.0", docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def common_web_security(request: Request, call_next: Callable[[Request], Any]) -> Response:
        request.state.request_id = request_id(request.headers.get("x-request-id"))
        origin = request.headers.get("origin")
        if request.method == "OPTIONS" and request.headers.get("access-control-request-method"):
            if origin not in config.allowed_origins:
                response: Response = _error_response(
                    request, ApiContractError("CORS_ORIGIN_DENIED", "The CORS origin is not allowed.", 403)
                )
            else:
                response = Response(status_code=204)
                response.headers["access-control-allow-origin"] = origin
                response.headers["access-control-allow-credentials"] = "true"
                response.headers["access-control-allow-methods"] = "GET, POST, OPTIONS"
                response.headers["access-control-allow-headers"] = (
                    "Content-Type, Idempotency-Key, If-Match, Last-Event-ID, X-CSRF-Token, "
                    "X-Permission-Scope, X-Reason, X-Request-ID, X-Target-Hash"
                )
                response.headers["vary"] = "Origin"
        else:
            response = await call_next(request)
            if origin in config.allowed_origins:
                response.headers["access-control-allow-origin"] = origin
                response.headers["access-control-allow-credentials"] = "true"
                response.headers.append("vary", "Origin")
        response.headers["x-request-id"] = request.state.request_id
        for name, value in security_headers(config).items():
            response.headers[name] = value
        return response

    for endpoint in api_registry.endpoints:
        handler = (
            _sse_handler(endpoint, stream, authenticator, config, authorization_resolver)
            if endpoint.key == "GET /api/runs/{id}/events"
            else _endpoint_handler(
                endpoint,
                application_ports,
                authenticator,
                config,
                authorization_resolver,
            )
        )
        app.add_api_route(endpoint.path, handler, methods=[endpoint.method], tags=[endpoint.source])
    return app
