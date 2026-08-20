"""Canonical Anvil v1 HTTP endpoint registry.

The registry is framework-neutral and is the only source used to install
FastAPI routes.  It intentionally includes capabilities that are implemented
in later packages; an unbound application port fails closed with HTTP 501.
"""

from __future__ import annotations

from dataclasses import dataclass
import re


_COMMAND = re.compile(r"^/api/(?:[^/]+/)*(?:\{[^{}]+\}|[^/:]+):[a-z][a-z0-9-]*$")


@dataclass(frozen=True, slots=True)
class EndpointSpec:
    method: str
    path: str
    permission: str
    source: str

    @property
    def key(self) -> str:
        return f"{self.method} {self.path}"

    @property
    def is_mutation(self) -> bool:
        return self.method != "GET"

    def __post_init__(self) -> None:
        if self.method not in {"GET", "POST"}:
            raise ValueError("canonical API supports GET and POST in v1")
        if not self.path.startswith("/api/") or "//" in self.path:
            raise ValueError("endpoint path must be a canonical /api path")
        if self.method == "POST" and self.path.rsplit("/", 1)[-1] in {
            "approve",
            "pause",
            "resume",
            "cancel",
            "rollback",
        }:
            raise ValueError("commands must use the /resource/{id}:verb form")
        if ":" in self.path and not _COMMAND.fullmatch(self.path):
            raise ValueError("command path is not canonical")
        if not self.permission or not self.source:
            raise ValueError("permission and source are required")


@dataclass(frozen=True, slots=True)
class ApiRegistry:
    endpoints: tuple[EndpointSpec, ...]

    def __post_init__(self) -> None:
        keys = [endpoint.key for endpoint in self.endpoints]
        if len(keys) != len(set(keys)):
            raise ValueError("canonical API registry contains a duplicate endpoint")

    def by_key(self, key: str) -> EndpointSpec:
        for endpoint in self.endpoints:
            if endpoint.key == key:
                return endpoint
        raise KeyError(key)


def _permission(method: str, path: str) -> str:
    exact = {
        "GET /api/providers": "provider:read",
        "GET /api/runs/{id}/events": "run:events:read",
        "POST /api/runs/{id}:pause": "run:pause",
        "POST /api/runs/{id}:resume": "run:resume",
        "POST /api/runs/{id}:cancel": "run:cancel",
        "POST /api/design-specifications/{id}:approve": "human:design:approve",
        "GET /api/evidence-manifests/{id}": "evidence:read",
    }
    key = f"{method} {path}"
    if key in exact:
        return exact[key]
    resource = path.removeprefix("/api/").split("/", 1)[0].replace("-", "_")
    verb = "read" if method == "GET" else path.rsplit(":", 1)[-1] if ":" in path else "write"
    return f"{resource}:{verb}"


_V1_ENDPOINTS: tuple[tuple[str, str, str], ...] = (
    ("POST", "/api/projects/{id}/intents", "47.13"),
    ("GET", "/api/projects/{id}/progress", "47.13"),
    ("POST", "/api/projects/{id}/proposal-sets:generate", "47.13"),
    ("POST", "/api/proposal-sets/{id}/decisions", "47.13"),
    ("POST", "/api/projects/{id}/design-specifications", "47.13"),
    ("POST", "/api/design-specifications/{id}:approve", "47.13"),
    ("POST", "/api/design-baselines/{id}:reopen", "47.13"),
    ("POST", "/api/projects/{id}/work-plans", "47.13"),
    ("POST", "/api/work-plans/{id}:approve", "47.13"),
    ("POST", "/api/work-plans/{id}:reopen", "47.13"),
    ("POST", "/api/work-plans/{id}/iteration-plans", "47.13"),
    ("POST", "/api/iterations/{id}/work-instructions", "47.13"),
    ("POST", "/api/work-instructions/{id}:approve", "47.13"),
    ("POST", "/api/work-instructions/{id}/invocation-prompt", "47.13"),
    ("POST", "/api/execution-plans:generate", "47.13"),
    ("POST", "/api/execution-plans/{id}:validate", "47.13"),
    ("POST", "/api/execution-plans/{id}:activate", "47.13"),
    ("GET", "/api/execution-plans/{id}/graph", "47.13"),
    ("POST", "/api/tasks/{taskId}/runs", "47.13"),
    ("GET", "/api/runs/{id}/progress", "47.13"),
    ("GET", "/api/runs/{id}/events", "47.13"),
    ("POST", "/api/runs/{id}:pause", "47.13"),
    ("POST", "/api/runs/{id}:resume", "47.13"),
    ("POST", "/api/runs/{id}:cancel", "47.13"),
    ("POST", "/api/runs/{id}:reconcile", "47.13"),
    ("POST", "/api/runs/{id}/interventions", "47.13"),
    ("POST", "/api/runs/{id}/priorities", "47.13"),
    ("GET", "/api/providers", "47.13"),
    ("GET", "/api/providers/{providerId}", "47.13"),
    ("POST", "/api/providers/{providerId}:configure", "47.13"),
    ("POST", "/api/providers/{providerId}:test", "47.13"),
    ("POST", "/api/providers/{providerId}:refresh-models", "47.13"),
    ("GET", "/api/providers/{providerId}/models", "47.13"),
    ("GET", "/api/provider-routing", "47.13"),
    ("POST", "/api/provider-routing:validate", "47.13"),
    ("POST", "/api/provider-routing:activate", "47.13"),
    ("GET", "/api/runs/{id}/budget", "47.13"),
    ("POST", "/api/runs/{id}/budget:revise", "47.13"),
    ("GET", "/api/runs/{id}/exceptions", "47.13"),
    ("POST", "/api/exceptions/{id}/decision", "47.13"),
    ("GET", "/api/runs/{id}/progress-export", "47.13"),
    ("POST", "/api/runs/{id}/completion-reports", "47.13"),
    ("POST", "/api/completion-reports/{id}/decisions", "47.13"),
    ("POST", "/api/technical-test-runs", "47.13"),
    ("POST", "/api/product-validations", "47.13"),
    ("POST", "/api/defects", "47.13"),
    ("POST", "/api/release-decisions", "47.13"),
    ("GET", "/api/runs/{id}/learning-review", "47.13"),
    ("GET", "/api/tasks/{id}/learning-snapshot", "47.13"),
    ("POST", "/api/learning-sources", "47.13"),
    ("POST", "/api/learning-sources/{id}:scan", "47.13"),
    ("POST", "/api/learning-sources/{id}:extract", "47.13"),
    ("GET", "/api/learning-sources/{id}/candidates", "47.13"),
    ("GET", "/api/code-patterns", "47.13"),
    ("GET", "/api/code-patterns/{id}", "47.13"),
    ("GET", "/api/learning-candidates", "47.13"),
    ("GET", "/api/learning-candidates/{id}/diff", "47.13"),
    ("POST", "/api/learning-candidates/{id}:approve", "47.13"),
    ("POST", "/api/learning-candidates/{id}:reject", "47.13"),
    ("POST", "/api/learning-activations/{id}:rollback", "47.13"),
    ("GET", "/api/projects/{id}/timeline", "47.13"),
    ("GET", "/api/projects/{id}/lineage", "47.13"),
    ("POST", "/api/projects/{id}/brainstorming-decision-sets", "49.15"),
    ("POST", "/api/brainstorming-decision-sets/{id}:approve", "49.15"),
    ("POST", "/api/projects/{id}/design-intent-reviews", "49.15"),
    ("GET", "/api/design-intent-reviews/{id}", "49.15"),
    ("POST", "/api/design-intent-reviews/{id}:report", "49.15"),
    ("POST", "/api/design-intent-reviews/{id}:continue", "49.15"),
    ("POST", "/api/defects/{id}:accept", "49.15"),
    ("POST", "/api/defects/{id}:ready-for-retest", "49.15"),
    ("POST", "/api/defects/{id}:close", "49.15"),
    ("POST", "/api/release-manifests", "49.15"),
    ("POST", "/api/release-manifests/{id}:verify", "49.15"),
    ("POST", "/api/deploy-approvals", "49.15"),
    ("POST", "/api/deployments", "49.15"),
    ("POST", "/api/deployments/{id}:rollback", "49.15"),
    ("GET", "/api/projects/{id}/data-egress-profile", "49.15"),
    ("POST", "/api/projects/{id}/data-egress-profile:revise", "49.15"),
    ("POST", "/api/secrets/{id}:rotate", "49.15"),
    ("POST", "/api/secrets/{id}:revoke", "49.15"),
    ("GET", "/api/evidence-manifests/{id}", "49.15"),
    ("GET", "/api/learning-sources/{id}/revocation-impact", "49.15"),
    ("POST", "/api/learning-sources/{id}:revoke", "49.15"),
)


_CANONICAL = ApiRegistry(
    tuple(
        EndpointSpec(method, path, _permission(method, path), source)
        for method, path, source in _V1_ENDPOINTS
    )
)


def canonical_api_registry() -> ApiRegistry:
    return _CANONICAL
