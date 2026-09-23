"""Server-owned Ollama endpoint policy; DNS is checked before any HTTP send."""
from __future__ import annotations

from dataclasses import dataclass
import ipaddress
import re
from typing import Protocol
from urllib.parse import urlsplit

from .ollama_errors import reject

_BLOCKED_IPS = tuple(ipaddress.ip_network(value) for value in (
    "0.0.0.0/8", "169.254.0.0/16", "224.0.0.0/4", "240.0.0.0/4",
    "100.64.0.0/10", "192.0.0.0/24", "168.63.129.16/32", "::/128",
    "fe80::/10", "ff00::/8", "fec0::/10", "64:ff9b::/96", "64:ff9b:1::/48",
    "2002::/16", "2001::/32", "fd00:ec2::254/128",
))
_BLOCKED_HOSTS = frozenset({"metadata", "metadata.google.internal", "metadata.google",
                            "instance-data", "metadata.azure.internal"})


def canonical_ip(value: object) -> str:
    if type(value) is not str or value != value.strip() or "%" in value:
        reject("ENDPOINT_IP_INVALID")
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        reject("ENDPOINT_IP_INVALID")
    if str(ip) != value or (isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped):
        reject("ENDPOINT_IP_INVALID")
    if (ip.is_unspecified or ip.is_link_local or ip.is_multicast
            or (ip.is_reserved and not ip.is_loopback and not ip.is_private)
            or any(ip in net for net in _BLOCKED_IPS)):
        reject("ENDPOINT_IP_FORBIDDEN")
    return value


def _origin(url: str) -> tuple[str, str, int]:
    if type(url) is not str or url != url.strip() or any(ord(char) < 33 or ord(char) > 126 for char in url):
        reject("ENDPOINT_INVALID")
    try:
        parts = urlsplit(url)
        scheme, host, port = parts.scheme, parts.hostname, parts.port
    except ValueError:
        reject("ENDPOINT_INVALID")
    if (scheme not in {"http", "https"} or host is None or port is None
            or parts.path or parts.query or parts.fragment or parts.username is not None or parts.password is not None):
        reject("ENDPOINT_INVALID")
    if host in _BLOCKED_HOSTS or host.endswith(".metadata.google.internal"):
        reject("ENDPOINT_HOST_FORBIDDEN")
    try:
        parsed_ip = ipaddress.ip_address(host)
    except ValueError:
        parsed_ip = None
    if parsed_ip is None:
        if (not re.fullmatch(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", host) or ".." in host
                or host.endswith(".") or re.fullmatch(r"[0-9.]+", host)
                or re.fullmatch(r"0[xX][0-9a-fA-F]+", host)):
            reject("ENDPOINT_INVALID")
        rendered = host
    else:
        canonical_ip(host)
        rendered = f"[{host}]" if parsed_ip.version == 6 else host
    if parts.netloc != f"{rendered}:{port}" or url != f"{scheme}://{rendered}:{port}":
        reject("ENDPOINT_INVALID")
    return scheme, host, port


@dataclass(frozen=True, slots=True)
class EndpointPermit:
    environment: str
    scheme: str
    host: str
    port: int
    ips: tuple[str, ...]

    def __post_init__(self) -> None:
        if type(self.environment) is not str or not self.environment or type(self.ips) is not tuple or not self.ips:
            reject("ENDPOINT_PERMIT_INVALID")
        if type(self.port) is not int or not 1 <= self.port <= 65535:
            reject("ENDPOINT_PERMIT_INVALID")
        _origin(f"{self.scheme}://{self.host if ':' not in self.host else '[' + self.host + ']'}:{self.port}")
        if any(canonical_ip(ip) != ip for ip in self.ips) or len(set(self.ips)) != len(self.ips):
            reject("ENDPOINT_PERMIT_INVALID")


class Resolver(Protocol):
    def resolve(self, host: str) -> tuple[str, ...] | list[str]: ...


@dataclass(frozen=True, slots=True)
class AuthorizedEndpoint:
    scheme: str
    host: str
    port: int
    pinned_ip: str


class EndpointPolicy:
    def __init__(self, environment: str, permits: tuple[EndpointPermit, ...]) -> None:
        if type(environment) is not str or not environment or type(permits) is not tuple:
            reject("ENDPOINT_POLICY_INVALID")
        self.environment = environment
        self.permits = permits

    def authorize(self, url: str, resolver: Resolver) -> AuthorizedEndpoint:
        scheme, host, port = _origin(url)
        matches = [p for p in self.permits if (p.environment, p.scheme, p.host, p.port) ==
                   (self.environment, scheme, host, port)]
        if len(matches) != 1:
            reject("ENDPOINT_NOT_ALLOWED")
        try:
            answers = resolver.resolve(host)
        except Exception:
            reject("ENDPOINT_DNS_FAILURE")
        if type(answers) not in (tuple, list) or not answers:
            reject("ENDPOINT_DNS_INVALID")
        allowed = set(matches[0].ips)
        for address in answers:
            canonical_ip(address)
            if address not in allowed:
                reject("ENDPOINT_DNS_NOT_ALLOWED")
        return AuthorizedEndpoint(scheme, host, port, answers[0])
