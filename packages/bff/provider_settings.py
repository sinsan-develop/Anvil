"""F-12 server BFF: same-origin browser URL and explicit response fields."""

import json
import re

from .client import BffResponse, ServerBffClient, browser_api_url


_PROVIDER = re.compile(r"/api/providers(?:/[a-z]+(?:/models|:configure|:test|:refresh-models)?)?\Z")
_EGRESS = re.compile(r"/api/projects/[A-Za-z0-9_.-]+/data-egress-profile(?::revise)?\Z")
_SECRET = re.compile(r"/api/secrets/[A-Za-z0-9_.-]+:(?:rotate|revoke)\Z")
_ROUTING = frozenset({"/api/provider-routing", "/api/provider-routing:validate", "/api/provider-routing:activate"})
_ROW = frozenset({"provider_id", "display_name", "sort_order", "provider_type", "status", "enabled",
                  "reason", "next_action", "credential", "model_count", "models", "eligible_model_snapshot_hash"})
_MODEL = frozenset({"model_id", "model_revision", "snapshot_hash", "capabilities", "context_tokens",
                    "privacy_class", "probe_revision", "benchmark_revision", "availability_reason"})
_CREDENTIAL = frozenset({"reference_id", "version", "status", "masked"})
_EGRESS_FIELDS = frozenset({"status", "reason", "mode", "provider_allowlist", "approved_path_count",
                            "excluded_path_count", "profile_hash", "applies_from", "version", "selection_hash"})
_ROUTING_FIELDS = frozenset({"version", "activation_hash", "applies_from", "provider_ids", "roles"})
_SENSITIVE = re.compile(r"(?:https?://|(?:\d{1,3}\.){3}\d{1,3}|api[_-]?key|bearer\s|secret[_-]?value)", re.IGNORECASE)


def _safe_values(value):
    if type(value) is str:
        if _SENSITIVE.search(value):
            raise ValueError("SENSITIVE_PROVIDER_RESPONSE")
    elif type(value) is dict:
        for item in value.values():
            _safe_values(item)
    elif type(value) is list:
        for item in value:
            _safe_values(item)


def _fields(data, allowed):
    if type(data) is not dict:
        raise ValueError("INVALID_PROVIDER_RESPONSE")
    return {key: data[key] for key in allowed if key in data}


def _row(data):
    row = _fields(data, _ROW)
    row["credential"] = _fields(row["credential"], _CREDENTIAL) if row.get("credential") is not None else None
    row["models"] = [_fields(model, _MODEL) for model in row.get("models", [])]
    return row


def _public(path, data):
    if path == "/api/providers":
        return [_row(row) for row in data]
    if path.endswith(":refresh-models"):
        return _fields(data, _MODEL)
    if path.endswith(":configure"):
        return {"provider_id": data["provider_id"], "status": data["status"],
                "credential": _fields(data["credential"], _CREDENTIAL)}
    if path.endswith(":test"):
        return _fields(data, {"provider_id", "status", "reason", "route_eligible"})
    if path.startswith("/api/secrets/"):
        return _fields(data, _CREDENTIAL)
    if path.endswith("/models"):
        return {"provider_id": data["provider_id"], "models": [_fields(model, _MODEL) for model in data["models"]],
                "status": data["status"], "reason": data["reason"]}
    if path.startswith("/api/providers/"):
        return _row(data)
    if path.startswith("/api/projects/"):
        return _fields(data, _EGRESS_FIELDS)
    if path.endswith(":validate"):
        return _fields(data, {"id", "version", "content_hash", "baseline_version"})
    if path.endswith(":activate"):
        return _fields(data, {"version", "activation_hash", "applies_from", "approval_mode"})
    return _fields(data, _ROUTING_FIELDS)


class ProviderSettingsBff:
    def __init__(self, client: ServerBffClient):
        if type(client) is not ServerBffClient:
            raise ValueError("SERVER_BFF_REQUIRED")
        self._client = client

    def browser_url(self, path):
        result = browser_api_url(path)
        if not (_PROVIDER.fullmatch(result) or _EGRESS.fullmatch(result) or _SECRET.fullmatch(result) or result in _ROUTING):
            raise ValueError("F12_ROUTE_NOT_ALLOWED")
        return result

    def request(self, method, path, *, headers=None, body=None):
        relative = self.browser_url(path)
        if method.upper() not in {"GET", "POST"}:
            raise ValueError("F12_METHOD_NOT_ALLOWED")
        upstream = self._client.request(method, relative, headers=headers, body=body)
        try:
            source = json.loads(upstream.body)
            if 200 <= upstream.status_code < 300:
                public = {"data": _public(relative, source["data"]), "request_id": source["request_id"]}
                _safe_values(public)
            else:
                # Do not relay owner/provider raw errors from a misconfigured internal API.
                public = {"error": {"code": "PROVIDER_REQUEST_FAILED", "message": "Provider request failed."}}
            return BffResponse(upstream.status_code, {"content-type": "application/json"},
                               json.dumps(public, sort_keys=True, separators=(",", ":")).encode())
        except (ValueError, KeyError, TypeError):
            return BffResponse(502, {"content-type": "application/json"},
                               b'{"error":{"code":"INVALID_PROVIDER_RESPONSE","message":"Provider response unavailable."}}')
