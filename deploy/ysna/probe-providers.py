#!/usr/bin/env python3
"""One-shot, read-only provider capability probes for C-21."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


PROVIDER_ORDER = (
    "CEREBRAS", "GROQ", "MISTRAL", "OPENROUTER", "UPSTAGE",
    "GEMINI", "ANTHROPIC", "OPENAI", "OLLAMA",
)
_DEFINITIONS: dict[str, dict[str, Any]] = {
    "CEREBRAS": {"credential": "CEREBRAS_API_KEY", "url": "https://api.cerebras.ai/v1/models", "header": "Authorization", "prefix": "Bearer "},
    "GROQ": {"credential": "GROQ_API_KEY", "url": "https://api.groq.com/openai/v1/models", "header": "Authorization", "prefix": "Bearer "},
    "MISTRAL": {"credential": "MISTRAL_API_KEY", "url": "https://api.mistral.ai/v1/models", "header": "Authorization", "prefix": "Bearer "},
    "OPENROUTER": {"credential": "OPENROUTER_API_KEY", "url": "https://openrouter.ai/api/v1/models", "header": "Authorization", "prefix": "Bearer "},
    # Upstage does not currently expose a release-approved metadata-only endpoint.
    "UPSTAGE": {"credential": "UPSTAGE_API_KEY", "url": None},
    "GEMINI": {"credential": "GEMINI_API_KEY", "url": "https://generativelanguage.googleapis.com/v1beta/models", "header": "x-goog-api-key", "prefix": ""},
    "ANTHROPIC": {"credential": "ANTHROPIC_API_KEY", "url": "https://api.anthropic.com/v1/models", "header": "x-api-key", "prefix": "", "extra_headers": {"anthropic-version": "2023-06-01"}},
    "OPENAI": {"credential": "OPENAI_API_KEY", "url": "https://api.openai.com/v1/models", "header": "Authorization", "prefix": "Bearer "},
    "OLLAMA": {"credential": None, "url_env": "OLLAMA_BASE_URL"},
}
_ALLOWED_HOSTS = {
    "api.cerebras.ai", "api.groq.com", "api.mistral.ai", "openrouter.ai",
    "generativelanguage.googleapis.com", "api.anthropic.com", "api.openai.com",
}
_ALLOWED_PATHS = {"/v1/models", "/openai/v1/models", "/api/v1/models", "/v1beta/models", "/api/tags"}


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def _ollama_url(source: Mapping[str, str]) -> str | None:
    base = source.get("OLLAMA_BASE_URL", "").strip().rstrip("/")
    return f"{base}/api/tags" if base else None


def _validate_url(url: str, *, provider: str) -> None:
    parsed = urlsplit(url)
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in _ALLOWED_PATHS:
        raise ValueError(f"{provider} metadata endpoint is not allowlisted")
    if provider == "OLLAMA":
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("OLLAMA metadata endpoint is invalid")
    elif parsed.scheme != "https" or parsed.hostname not in _ALLOWED_HOSTS:
        raise ValueError(f"{provider} metadata endpoint is not allowlisted")


def build_probe_plan(source: Mapping[str, str]) -> dict[str, dict[str, Any]]:
    plan: dict[str, dict[str, Any]] = {}
    for provider in PROVIDER_ORDER:
        definition = _DEFINITIONS[provider]
        credential_name = definition.get("credential")
        credential_present = bool(source.get(credential_name, "").strip()) if credential_name else True
        url = _ollama_url(source) if provider == "OLLAMA" else definition.get("url")
        if credential_name and not credential_present:
            status, reason = "NOT_CONFIGURED", "CREDENTIAL_ABSENT"
        elif not url:
            status, reason = "NOT_PROBED", "NO_APPROVED_METADATA_ENDPOINT"
        else:
            _validate_url(url, provider=provider)
            status, reason = "READY", None
        plan[provider] = {
            "method": "GET", "url": url, "status": status, "reason": reason,
            "follow_redirects": False, "timeout_seconds": 3, "response_cap_bytes": 65536,
        }
    return plan


def _probe(provider: str, item: Mapping[str, Any], source: Mapping[str, str]) -> dict[str, Any]:
    if item["status"] != "READY":
        return {key: value for key, value in item.items() if key != "url"} | {"endpoint": "OMITTED"}
    url = str(item["url"])
    definition = _DEFINITIONS[provider]
    headers = {"Accept": "application/json", "User-Agent": "anvil-c21-metadata-probe/1"}
    credential_name = definition.get("credential")
    if credential_name:
        headers[str(definition["header"])] = str(definition.get("prefix", "")) + source[credential_name]
    headers.update(definition.get("extra_headers", {}))
    request = Request(url, method="GET", headers=headers)
    try:
        with build_opener(_NoRedirect()).open(request, timeout=3) as response:
            body = response.read(65537)
            if len(body) > 65536:
                return {"status": "ERROR", "reason": "RESPONSE_CAP_EXCEEDED", "http_status": int(response.status), "endpoint": "OMITTED"}
            try:
                parsed = json.loads(body or b"{}")
            except json.JSONDecodeError:
                return {"status": "ERROR", "reason": "NON_JSON_RESPONSE", "http_status": int(response.status), "endpoint": "OMITTED"}
            model_count = len(parsed.get("data", parsed.get("models", []))) if isinstance(parsed, dict) else 0
            return {"status": "PROBED_OK", "reason": None, "http_status": int(response.status), "model_count": model_count, "endpoint": "OMITTED"}
    except HTTPError as error:
        return {"status": "ERROR", "reason": "HTTP_ERROR", "http_status": int(error.code), "endpoint": "OMITTED"}
    except (URLError, TimeoutError, socket.timeout, OSError):
        return {"status": "ERROR", "reason": "TRANSPORT_ERROR", "http_status": None, "endpoint": "OMITTED"}


def _write(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f".tmp.{os.getpid()}")
    temporary.write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    source = dict(os.environ)
    plan = build_probe_plan(source)
    results = {provider: _probe(provider, plan[provider], source) for provider in PROVIDER_ORDER}
    _write(Path(args.output), {
        "status": "COMPLETED", "providers": results, "provider_count": 9,
        "generation_requests": 0, "fallback_requests": 0,
        "created_at": datetime.now(timezone.utc).isoformat(), "secret_values": "omitted",
    })
    print("C-21 provider metadata probe completed: providers=9 secret_values=omitted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
