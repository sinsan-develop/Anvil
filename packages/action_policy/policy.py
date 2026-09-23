"""Action authorization primitives; no network, filesystem, or subprocess calls."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json
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
    connected_ip: str | None = None
    scheme: str = "https"
    port: int = 443

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
        if self.connected_ip is not None:
            _text(self.connected_ip, "connected_ip")
        _text(self.scheme, "scheme")
        if type(self.port) is not int:
            raise PolicyError("port must be int")

    @property
    def fingerprint(self) -> str:
        body = {"snapshot_id": self.snapshot_id, "host": self.host,
                "resolved_ips": self.resolved_ips, "redirect_chain": self.redirect_chain,
                "metadata_access": self.metadata_access, "connected_ip": self.connected_ip,
                "scheme": self.scheme, "port": self.port}
        return "sha256:" + hashlib.sha256(_canonical(body).encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class SecretRef:
    """Broker-owned metadata reference. It deliberately has no material/value field."""
    secret_ref_id: str
    project_id: str
    environment_id: str
    provider_id: str
    purpose: str
    version: int
    status: str
    expires_at: int
    last_rotated_at: int
    broker_policy_hash: str

    def __post_init__(self) -> None:
        for value, name in (
            (self.secret_ref_id, "secret_ref_id"), (self.project_id, "project_id"),
            (self.environment_id, "environment_id"), (self.provider_id, "provider_id"),
            (self.purpose, "purpose"), (self.status, "status"),
            (self.broker_policy_hash, "broker_policy_hash"),
        ):
            _text(value, name)
        if self.status not in {"ACTIVE", "ROTATING", "REVOKED", "EXPIRED"}:
            raise PolicyError("invalid secret ref status")
        if type(self.version) is not int or self.version < 1:
            raise PolicyError("secret ref version must be positive int")
        if type(self.expires_at) is not int or type(self.last_rotated_at) is not int:
            raise PolicyError("secret ref timestamps must be int")


@dataclass(frozen=True, slots=True)
class ActionRequest:
    action_id: str
    kind: ActionKind
    path: str | None
    permission: str | None
    tokens: FencingTokens | None
    expected_tokens: FencingTokens | None
    egress: EgressSnapshot | None
    command: str | None = None
    secret_read: bool = False
    destructive: bool = False
    metadata_access: bool = False
    approved_resolved_ips: tuple[str, ...] | None = None
    arguments: Mapping[str, Any] = field(default_factory=dict)
    ingress_error: str | None = None
    secret_ref: SecretRef | None = None

    def __post_init__(self) -> None:
        # Snapshot nested ingress before hashing/decision so caller mutation
        # cannot create a receipt/action TOCTOU split.
        from .admission import freeze
        ingress_error = self.ingress_error
        try:
            arguments = freeze(self.arguments)
            if not isinstance(arguments, Mapping):
                raise PolicyError("arguments must be a mapping")
        except Exception:
            arguments = freeze({})
            ingress_error = ingress_error or "INVALID_ACTION"
        object.__setattr__(self, "arguments", arguments)
        object.__setattr__(self, "ingress_error", ingress_error)


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
    risk: str = "medium"
    risk_factors: tuple[str, ...] = ()
    blocked_code: str | None = None
    request_sha256: str = ""
    policy_sha256: str = ""
    io_count: int = 0

    @property
    def receipt_sha256(self) -> str:
        body = {"action_id": self.action_id, "decision": self.decision.value,
                "reason_code": self.reason_code, "action_kind": self.action_kind,
                "path": self.path, "egress_fingerprint": self.egress_fingerprint,
                "execution_token_valid": self.execution_token_valid,
                "write_token_valid": self.write_token_valid, "risk": self.risk,
                "risk_factors": self.risk_factors, "blocked_code": self.blocked_code,
                "request_sha256": self.request_sha256, "policy_sha256": self.policy_sha256,
                "io_count": self.io_count}
        return "sha256:" + hashlib.sha256(_canonical(body).encode()).hexdigest()

    def to_dict(self) -> dict[str, Any]:
        return {"action_id": self.action_id, "decision": self.decision.value,
                "reason_code": self.reason_code, "action_kind": self.action_kind,
                "path": self.path, "egress_fingerprint": self.egress_fingerprint,
                "execution_token_valid": self.execution_token_valid,
                "write_token_valid": self.write_token_valid, "risk": self.risk,
                "risk_factors": self.risk_factors, "blocked_code": self.blocked_code,
                "request_sha256": self.request_sha256, "policy_sha256": self.policy_sha256,
                "io_count": self.io_count, "receipt_sha256": self.receipt_sha256}


class ActionPolicy:
    """Pure evaluator. Allowed paths are repository-relative prefixes."""

    def __init__(self, allowed_paths: tuple[str, ...], *, authority: Mapping[str, Any] | None = None) -> None:
        if type(allowed_paths) is not tuple or not allowed_paths:
            raise PolicyError("allowed_paths must be a non-empty tuple")
        for path in allowed_paths:
            _safe_path(path)
        self._allowed_paths = allowed_paths
        if authority is None:
            self._authority = None
        else:
            from .admission import freeze
            try:
                self._authority = freeze(authority)
            except Exception:
                self._authority = ()

    def evaluate(self, request: ActionRequest) -> ActionReceipt:
        from .admission import evaluate
        return evaluate(self._allowed_paths, self._authority, request)
