"""Server-side BFF transport that never exposes its internal base to browsers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Mapping
from urllib.parse import urlsplit


@dataclass(frozen=True, slots=True)
class BffResponse:
    status_code: int
    headers: Mapping[str, str]
    body: bytes


Transport = Callable[[str, str, dict[str, str], bytes | None], BffResponse]


def browser_api_url(path: str) -> str:
    parsed = urlsplit(path)
    if parsed.scheme or parsed.netloc or not path.startswith("/api/") or path.startswith("//"):
        raise ValueError("browser API calls must use a same-origin /api path")
    return path


@dataclass(frozen=True, slots=True)
class ServerBffClient:
    _base_url: str = field(repr=False)
    _transport: Transport = field(repr=False)

    def __post_init__(self) -> None:
        parsed = urlsplit(self._base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("BFF internal base URL must be an absolute HTTP(S) server URL")
        if parsed.query or parsed.fragment:
            raise ValueError("BFF internal base URL cannot contain query or fragment")
        object.__setattr__(self, "_base_url", self._base_url.rstrip("/"))

    def request(
        self,
        method: str,
        path: str,
        *,
        headers: Mapping[str, str] | None = None,
        body: bytes | None = None,
    ) -> BffResponse:
        relative = browser_api_url(path)
        forwarded = {
            key.lower(): value
            for key, value in (headers or {}).items()
            if key.lower() not in {"host", "forwarded", "x-forwarded-host", "x-forwarded-proto"}
        }
        return self._transport(method.upper(), f"{self._base_url}{relative}", forwarded, body)
