"""Action authorization primitives; no network, filesystem, or subprocess calls."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import hashlib
import ipaddress
import json
import re
from typing import Any, Mapping


class PolicyError(ValueError):
    """Malformed policy input is rejected rather than interpreted permissively."""


class ActionKind(str, Enum):
    PATCH = "patch"
    WRITE = "write"
    EXECUTE = "execute"


class Decision(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"


def _text(value: Any, name: str) -> None:
    if type(value) is not str or not value or value != value.strip():
        raise PolicyError(f"{name} must be a canonical non-empty string")


def _canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _safe_path(path: str) -> None:
    _text(path, "path")
    if path.startswith(("/", "~")) or "\\" in path or "\x00" in path:
        raise PolicyError("path must be a relative POSIX path")
    if any(part in {"", ".", ".."} for part in path.split("/")):
        raise PolicyError("path traversal is not allowed")


@dataclass(frozen=True, slots=True)
class FencingTokens:
    execution: str
    write: str

    def __post_init__(self) -> None:
        _text(self.execution, "execution token")
        _text(self.write, "write token")


@dataclass(frozen=True, slots=True)
class EgressSnapshot:
    """The approved egress observation captured before an action is evaluated."""
    snapshot_id: str
    host: str
    resolved_ips: tuple[str, ...]
    redirect_chain: tuple[str, ...] = ()
    metadata_access: bool = False

    def __post_init__(self) -> None:
        _text(self.snapshot_id, "snapshot_id")
        _text(self.host, "host")
        if type(self.resolved_ips) is not tuple or not self.resolved_ips:
            raise PolicyError("resolved_ips must be a non-empty tuple")
        if type(self.redirect_chain) is not tuple:
            raise PolicyError("redirect_chain must be a tuple")
        if type(self.metadata_access) is not bool:
            raise PolicyError("metadata_access must be bool")
        for value in (*self.resolved_ips, *self.redirect_chain):
            _text(value, "egress value")

    @property
    def fingerprint(self) -> str:
        body = {"snapshot_id": self.snapshot_id, "host": self.host,
                "resolved_ips": self.resolved_ips, "redirect_chain": self.redirect_chain,
                "metadata_access": self.metadata_access}
        return "sha256:" + hashlib.sha256(_canonical(body).encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class ActionRequest:
    action_id: str
    kind: ActionKind
    path: str
    permission: str
    tokens: FencingTokens
    expected_tokens: FencingTokens
    egress: EgressSnapshot
    command: str | None = None
    secret_read: bool = False
    destructive: bool = False
    metadata_access: bool = False
    approved_resolved_ips: tuple[str, ...] | None = None

    def __post_init__(self) -> None:
        _text(self.action_id, "action_id")
        if not isinstance(self.kind, ActionKind):
            raise PolicyError("kind must be ActionKind")
        _safe_path(self.path)
        _text(self.permission, "permission")
        if not isinstance(self.tokens, FencingTokens) or not isinstance(self.expected_tokens, FencingTokens):
            raise PolicyError("both fencing token sets are required")
        if not isinstance(self.egress, EgressSnapshot):
            raise PolicyError("egress snapshot is required")
        if self.command is not None:
            _text(self.command, "command")
        for value, name in ((self.secret_read, "secret_read"), (self.destructive, "destructive"), (self.metadata_access, "metadata_access")):
            if type(value) is not bool:
                raise PolicyError(f"{name} must be bool")
        if self.approved_resolved_ips is not None:
            if type(self.approved_resolved_ips) is not tuple or not self.approved_resolved_ips:
                raise PolicyError("approved_resolved_ips must be a non-empty tuple")
            for value in self.approved_resolved_ips:
                _text(value, "approved egress IP")


@dataclass(frozen=True, slots=True)
class ActionReceipt:
    action_id: str
    decision: Decision
    reason_code: str
    action_kind: str
    path: str
    egress_fingerprint: str
    execution_token_valid: bool
    write_token_valid: bool

    @property
    def receipt_sha256(self) -> str:
        body = {"action_id": self.action_id, "decision": self.decision.value,
                "reason_code": self.reason_code, "action_kind": self.action_kind,
                "path": self.path, "egress_fingerprint": self.egress_fingerprint,
                "execution_token_valid": self.execution_token_valid,
                "write_token_valid": self.write_token_valid}
        return "sha256:" + hashlib.sha256(_canonical(body).encode()).hexdigest()

    def to_dict(self) -> dict[str, Any]:
        return {"action_id": self.action_id, "decision": self.decision.value,
                "reason_code": self.reason_code, "action_kind": self.action_kind,
                "path": self.path, "egress_fingerprint": self.egress_fingerprint,
                "execution_token_valid": self.execution_token_valid,
                "write_token_valid": self.write_token_valid, "receipt_sha256": self.receipt_sha256}


class ActionPolicy:
    """Pure evaluator. Allowed paths are repository-relative prefixes."""
    _unsafe_command = re.compile(r"(?:\|\||&&|[;&|<>`]||\$\(|\b(?:sudo|rm|shutdown|reboot|curl|wget)\b)", re.I)

    def __init__(self, allowed_paths: tuple[str, ...]) -> None:
        if type(allowed_paths) is not tuple or not allowed_paths:
            raise PolicyError("allowed_paths must be a non-empty tuple")
        for path in allowed_paths:
            _safe_path(path)
        self._allowed_paths = allowed_paths

    def evaluate(self, request: ActionRequest) -> ActionReceipt:
        execution_ok = request.tokens.execution == request.expected_tokens.execution
        write_ok = request.tokens.write == request.expected_tokens.write
        reason = "ALLOWED"
        decision = Decision.ALLOW
        if not execution_ok or not write_ok:
            reason = "STALE_FENCING_TOKEN"
        elif not any(request.path == p or request.path.startswith(p + "/") for p in self._allowed_paths):
            reason = "PATH_NOT_ALLOWED"
        elif self._metadata_address(request.egress.host) or any(self._metadata_address(ip) for ip in request.egress.resolved_ips):
            reason = "METADATA_ADDRESS_DENIED"
        elif request.egress.metadata_access or request.metadata_access:
            reason = "METADATA_ACCESS_DENIED"
        elif len(request.egress.resolved_ips) != 1:
            reason = "DNS_REBINDING_DENIED"
        elif request.approved_resolved_ips is not None and request.egress.resolved_ips != request.approved_resolved_ips:
            reason = "DNS_REBINDING_DENIED"
        elif request.egress.redirect_chain:
            reason = "REDIRECT_DENIED"
        elif request.secret_read:
            reason = "SECRET_READ_DENIED"
        elif request.destructive:
            reason = "DESTRUCTIVE_ACTION_DENIED"
        elif request.kind is ActionKind.EXECUTE and (request.command is None or self._unsafe_command.search(request.command)):
            reason = "UNSAFE_COMMAND_DENIED"
        if reason != "ALLOWED":
            decision = Decision.DENY
        return ActionReceipt(request.action_id, decision, reason, request.kind.value, request.path,
                             request.egress.fingerprint, execution_ok, write_ok)

    @staticmethod
    def _metadata_address(value: str) -> bool:
        lowered = value.casefold().rstrip(".")
        if lowered in {"localhost", "metadata.google.internal", "metadata", "instance-data"}:
            return True
        try:
            address = ipaddress.ip_address(lowered)
        except ValueError:
            return False
        blocked = (
            ipaddress.ip_network("10.0.0.0/8"), ipaddress.ip_network("172.16.0.0/12"),
            ipaddress.ip_network("192.168.0.0/16"), ipaddress.ip_network("127.0.0.0/8"),
            ipaddress.ip_network("169.254.0.0/16"), ipaddress.ip_network("::1/128"),
            ipaddress.ip_network("fc00::/7"), ipaddress.ip_network("fe80::/10"),
        )
        return any(address in network for network in blocked) or address.is_unspecified
