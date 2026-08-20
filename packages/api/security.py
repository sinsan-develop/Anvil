"""Common Web security policy for the same-origin FastAPI boundary."""

from __future__ import annotations

from dataclasses import dataclass, field
from http.cookies import SimpleCookie
import re
from uuid import uuid4


REQUEST_ID_HEADER = "x-request-id"
SESSION_COOKIE = "anvil_session"
SESSION_MAX_AGE_SECONDS = 3_600
_REQUEST_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")


@dataclass(frozen=True, slots=True)
class WebSecurityConfig:
    allowed_hosts: frozenset[str] = field(default_factory=lambda: frozenset({"anvil.local"}))
    allowed_origins: frozenset[str] = field(default_factory=lambda: frozenset({"https://anvil.local"}))
    trusted_proxy_ips: frozenset[str] = field(default_factory=frozenset)
    session_cookie_name: str = SESSION_COOKIE
    hsts_max_age_seconds: int = 31_536_000

    def __post_init__(self) -> None:
        if not self.allowed_hosts or "*" in self.allowed_hosts:
            raise ValueError("allowed_hosts must be an explicit non-empty allowlist")
        if "*" in self.allowed_origins:
            raise ValueError("credentialed CORS wildcard is forbidden")
        if self.hsts_max_age_seconds <= 0:
            raise ValueError("HSTS max age must be positive")


def request_id(value: str | None) -> str:
    if value is not None and _REQUEST_ID.fullmatch(value):
        return value
    return f"req_{uuid4().hex}"


def security_headers(config: WebSecurityConfig) -> dict[str, str]:
    csp = (
        "default-src 'self'; base-uri 'self'; object-src 'none'; "
        "frame-ancestors 'none'; script-src 'self'; style-src 'self'; "
        "img-src 'self' data:; font-src 'self'; connect-src 'self'"
    )
    return {
        "content-security-policy": csp,
        "strict-transport-security": f"max-age={config.hsts_max_age_seconds}; includeSubDomains",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "cache-control": "no-store",
    }


def build_session_cookie(token: str, *, max_age_seconds: int, name: str = SESSION_COOKIE) -> str:
    if not token or max_age_seconds <= 0:
        raise ValueError("session token and positive max age are required")
    if max_age_seconds > SESSION_MAX_AGE_SECONDS:
        raise ValueError("session cookies must be short-lived")
    cookie = SimpleCookie()
    cookie[name] = token
    morsel = cookie[name]
    morsel["path"] = "/"
    morsel["max-age"] = str(max_age_seconds)
    morsel["secure"] = True
    morsel["httponly"] = True
    morsel["samesite"] = "Strict"
    return morsel.OutputString()


def effective_host(headers: dict[str, str], client_ip: str | None, config: WebSecurityConfig) -> str:
    direct = headers.get("host", "").split(":", 1)[0].lower()
    if client_ip in config.trusted_proxy_ips:
        forwarded = headers.get("x-forwarded-host", "").split(",", 1)[0].strip().split(":", 1)[0].lower()
        return forwarded or direct
    return direct
