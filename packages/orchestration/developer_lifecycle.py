"""Deterministic, read-only Developer Subagent lifecycle (C-03).

The runner is intentionally an in-memory fake.  It validates the C-02 packet,
never touches a repository or external service, and retains the raw result
envelope exactly as delivered by the runner.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType
from typing import Any, Mapping, Protocol

from .delegation import DelegationPacket, PacketValidationResult, validate_packet


class LifecycleStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    STOP_REQUESTED = "STOP_REQUESTED"
    COMPLETED = "COMPLETED"
    STOPPED = "STOPPED"
    FAILED = "FAILED"


class LifecycleError(RuntimeError):
    """Base error for a rejected lifecycle operation."""


class PacketRejected(LifecycleError):
    def __init__(self, validation: PacketValidationResult) -> None:
        self.validation = validation
        super().__init__("delegation packet rejected: " + ",".join(validation.reason_codes))


class InvalidLifecycleTransition(LifecycleError):
    pass


class ReadOnlyPolicyRejected(LifecycleError):
    pass


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, tuple):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, set):
        return frozenset(_freeze(item) for item in value)
    return value


def _thaw(value: Any) -> Any:
    """Convert the internal immutable payload back to JSON-safe containers."""
    if isinstance(value, Mapping):
        return {str(key): _thaw(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_thaw(item) for item in value]
    if isinstance(value, (set, frozenset)):
        return [_thaw(item) for item in value]
    return value


@dataclass(frozen=True, slots=True)
class RawResultEnvelope:
    """Opaque runner output.  Payload is copied on ingress/egress."""

    session_id: str
    status: LifecycleStatus
    payload: Mapping[str, Any]

    def __post_init__(self) -> None:
        if not self.session_id.strip():
            raise ValueError("session_id must be non-empty")
        if not isinstance(self.status, LifecycleStatus):
            raise TypeError("status must be LifecycleStatus")
        if not isinstance(self.payload, Mapping):
            raise TypeError("payload must be a mapping")
        object.__setattr__(self, "payload", _freeze(self.payload))

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "status": self.status.value,
            "payload": _thaw(self.payload),
        }


@dataclass(frozen=True, slots=True)
class DeveloperSession:
    session_id: str
    delegation_id: str
    packet_hash: str
    status: LifecycleStatus
    raw_result: RawResultEnvelope | None = None


class ReadOnlyPolicy:
    """Allow only packet-scoped reads; deny writes, secrets, and network."""

    _DENIED = frozenset({"write", "patch", "delete", "secret_read", "external_network", "network"})

    def authorize(self, action: str, *, path: str | None = None, packet: DelegationPacket | None = None) -> None:
        if not isinstance(action, str) or not action.strip():
            raise ReadOnlyPolicyRejected("action is required")
        normalized = action.strip().lower().replace("-", "_")
        if normalized in self._DENIED:
            raise ReadOnlyPolicyRejected(f"read-only policy denied action: {action}")
        if normalized not in {"read", "inspect", "list", "test"}:
            raise ReadOnlyPolicyRejected(f"unsupported read-only action: {action}")
        if path is not None and packet is not None and not self._path_allowed(path, packet.allowed_paths):
            raise ReadOnlyPolicyRejected(f"path outside packet scope: {path}")

    @staticmethod
    def _path_allowed(path: str, allowed_paths: tuple[str, ...]) -> bool:
        if not isinstance(path, str) or not path or path.startswith(("/", "\\")) or "\\" in path:
            return False
        if any(part in {"", ".", ".."} for part in path.split("/")):
            return False
        for pattern in allowed_paths:
            if pattern.endswith("/**") and path.startswith(pattern[:-3]):
                return True
            if pattern.endswith("/*") and path.startswith(pattern[:-2]) and "/" not in path[len(pattern) - 1:]:
                return True
            if pattern == path:
                return True
        return False


class DeveloperRunner(Protocol):
    def start(self, session_id: str, packet: DelegationPacket) -> None: ...
    def poll(self, session_id: str) -> RawResultEnvelope | None: ...
    def stop(self, session_id: str) -> None: ...


class DeterministicFakeDeveloperRunner:
    """A predictable two-poll runner: first poll is pending, second completes."""

    def __init__(self) -> None:
        self._sessions: dict[str, tuple[DelegationPacket, int, bool]] = {}

    def start(self, session_id: str, packet: DelegationPacket) -> None:
        if session_id in self._sessions:
            return
        self._sessions[session_id] = (packet, 0, False)

    def poll(self, session_id: str) -> RawResultEnvelope | None:
        packet, polls, stop_requested = self._sessions[session_id]
        if stop_requested:
            return RawResultEnvelope(session_id, LifecycleStatus.STOPPED, {"runner": "deterministic-fake", "delegation_id": packet.delegation_id})
        polls += 1
        self._sessions[session_id] = (packet, polls, stop_requested)
        if polls < 2:
            return None
        return RawResultEnvelope(session_id, LifecycleStatus.COMPLETED, {"runner": "deterministic-fake", "delegation_id": packet.delegation_id, "polls": polls})

    def stop(self, session_id: str) -> None:
        packet, polls, _ = self._sessions[session_id]
        self._sessions[session_id] = (packet, polls, True)


class DeveloperLifecycleService:
    """In-memory lifecycle coordinator with monotonic, idempotent commands."""

    def __init__(self, runner: DeveloperRunner | None = None, policy: ReadOnlyPolicy | None = None) -> None:
        self._runner = runner or DeterministicFakeDeveloperRunner()
        self._policy = policy or ReadOnlyPolicy()
        self._sessions: dict[str, DeveloperSession] = {}
        self._packets: dict[str, DelegationPacket] = {}

    @property
    def sessions(self) -> tuple[DeveloperSession, ...]:
        return tuple(self._sessions.values())

    def start(
        self, packet: DelegationPacket | Mapping[str, Any] | None, *, session_id: str,
        baseline_hash: str, permission_snapshot_hash: str, context_snapshot_hash: str,
        egress_snapshot_hash: str,
    ) -> DeveloperSession:
        existing = self._sessions.get(session_id)
        if existing is not None:
            return existing
        validation = validate_packet(packet, baseline_hash=baseline_hash, permission_snapshot_hash=permission_snapshot_hash, context_snapshot_hash=context_snapshot_hash, egress_snapshot_hash=egress_snapshot_hash)
        if not validation.valid:
            raise PacketRejected(validation)
        candidate = packet if isinstance(packet, DelegationPacket) else DelegationPacket.from_dict(packet)
        self._policy.authorize("inspect")
        self._runner.start(session_id, candidate)
        session = DeveloperSession(session_id, candidate.delegation_id, candidate.packet_hash, LifecycleStatus.PENDING)
        self._sessions[session_id] = session
        self._packets[session_id] = candidate
        return session

    def wait(self, session_id: str) -> DeveloperSession:
        current = self._require(session_id)
        if current.status in {LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED}:
            return current
        if current.status is LifecycleStatus.PENDING:
            current = self._replace(current, status=LifecycleStatus.RUNNING)
        result = self._runner.poll(session_id)
        if result is not None:
            expected = LifecycleStatus.STOPPED if current.status is LifecycleStatus.STOP_REQUESTED else result.status
            if expected not in {LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED}:
                raise InvalidLifecycleTransition("runner returned non-terminal result")
            current = self._replace(current, status=expected, raw_result=RawResultEnvelope(result.session_id, expected, result.payload))
        self._sessions[session_id] = current
        return current

    def stop(self, session_id: str) -> DeveloperSession:
        current = self._require(session_id)
        if current.status in {LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED}:
            return current
        if current.status is LifecycleStatus.STOP_REQUESTED:
            return current
        self._runner.stop(session_id)
        current = self._replace(current, status=LifecycleStatus.STOP_REQUESTED)
        self._sessions[session_id] = current
        return current

    def authorize(self, session_id: str, action: str, *, path: str | None = None) -> None:
        self._require(session_id)
        self._policy.authorize(action, path=path, packet=self._packets[session_id])

    def _require(self, session_id: str) -> DeveloperSession:
        try:
            return self._sessions[session_id]
        except KeyError as error:
            raise KeyError(f"unknown developer session: {session_id}") from error

    def _replace(self, session: DeveloperSession, **changes: Any) -> DeveloperSession:
        return DeveloperSession(changes.get("session_id", session.session_id), changes.get("delegation_id", session.delegation_id), changes.get("packet_hash", session.packet_hash), changes.get("status", session.status), changes.get("raw_result", session.raw_result))


ReadOnlyDeveloperRunner = DeterministicFakeDeveloperRunner
RawResult = RawResultEnvelope

__all__ = [
    "LifecycleStatus", "LifecycleError", "PacketRejected", "InvalidLifecycleTransition",
    "ReadOnlyPolicyRejected", "RawResultEnvelope", "RawResult", "DeveloperSession",
    "DeveloperRunner", "DeterministicFakeDeveloperRunner", "ReadOnlyDeveloperRunner",
    "DeveloperLifecycleService", "ReadOnlyPolicy",
]
