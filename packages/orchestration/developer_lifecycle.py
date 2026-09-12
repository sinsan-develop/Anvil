"""Deterministic, read-only Developer Subagent lifecycle (C-03).

The runner is intentionally an in-memory fake.  It validates the C-02 packet,
never touches a repository or external service, and retains the raw result
envelope exactly as delivered by the runner.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from threading import RLock
from types import MappingProxyType
from typing import Any, Mapping, Protocol
import hashlib
import json
import math
import re

from .delegation import (
    DataEgressProfile, DelegationPacket, PacketValidationResult,
    PermissionSnapshot, validate_packet,
)


class LifecycleStatus(StrEnum):
    STARTING = "STARTING"
    START_AMBIGUOUS = "START_AMBIGUOUS"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    STOP_REQUESTED = "STOP_REQUESTED"
    PAUSED = "PAUSED"
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


class ResumeRejected(LifecycleError):
    """A pause/resume command cannot be applied to the current session."""


def _require_hash(value: str, field: str) -> None:
    if not isinstance(value, str) or re.fullmatch(r"sha256:[0-9a-f]{64}", value) is None:
        raise ValueError(f"{field} must be a canonical sha256 hash")


def _freeze(value: Any, *, _active: set[int] | None = None) -> Any:
    """Validate and detach one strict JSON value into immutable containers."""
    if value is None or type(value) in {bool, int}:
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise ValueError("raw result payload must contain only finite numbers")
        return value
    if type(value) is str:
        try:
            value.encode("utf-8")
        except UnicodeEncodeError as error:
            raise ValueError("raw result payload text must be valid UTF-8") from error
        return value
    active = set() if _active is None else _active
    if isinstance(value, Mapping):
        identity = id(value)
        if identity in active:
            raise ValueError("raw result payload must not contain cycles")
        active.add(identity)
        try:
            frozen: dict[str, Any] = {}
            for key, item in value.items():
                if type(key) is not str:
                    raise TypeError("raw result payload mapping keys must be strings")
                try:
                    key.encode("utf-8")
                except UnicodeEncodeError as error:
                    raise ValueError("raw result payload keys must be valid UTF-8") from error
                frozen[key] = _freeze(item, _active=active)
            return MappingProxyType(frozen)
        finally:
            active.remove(identity)
    if type(value) is list:
        identity = id(value)
        if identity in active:
            raise ValueError("raw result payload must not contain cycles")
        active.add(identity)
        try:
            return tuple(_freeze(item, _active=active) for item in value)
        finally:
            active.remove(identity)
    raise TypeError(
        "raw result payload accepts only JSON-compatible scalar, list, and mapping values"
    )


def _freeze_checkpoint(value: Any) -> Any:
    """Preserve the established C-04 checkpoint snapshot compatibility."""
    if isinstance(value, Mapping):
        return MappingProxyType({
            str(key): _freeze_checkpoint(item) for key, item in value.items()
        })
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_checkpoint(item) for item in value)
    if isinstance(value, set):
        return frozenset(_freeze_checkpoint(item) for item in value)
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


def _canonical_json_bytes(value: Mapping[str, Any]) -> bytes:
    try:
        return json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as error:
        raise ValueError("raw result artifact must be canonical UTF-8 JSON") from error


@dataclass(frozen=True, slots=True)
class RawResultArtifact:
    """Immutable, content-addressed bytes captured from one runner result."""

    content: bytes
    sha256: str
    media_type: str = "application/json"

    def __post_init__(self) -> None:
        if type(self.content) is not bytes:
            raise TypeError("raw result artifact content must be bytes")
        _require_hash(self.sha256, "sha256")
        expected = "sha256:" + hashlib.sha256(self.content).hexdigest()
        if self.sha256 != expected:
            raise ValueError("raw result artifact sha256 does not match content")
        if self.media_type != "application/json":
            raise ValueError("raw result artifact media_type must be application/json")


@dataclass(frozen=True, slots=True)
class RawResultEnvelope:
    """Opaque runner output.  Payload is copied on ingress/egress."""

    session_id: str
    status: LifecycleStatus
    payload: Mapping[str, Any]
    _artifact: RawResultArtifact = field(init=False, repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self.session_id, str):
            raise TypeError("session_id must be a string")
        if not self.session_id.strip():
            raise ValueError("session_id must be non-empty")
        if not isinstance(self.status, LifecycleStatus):
            raise TypeError("status must be LifecycleStatus")
        if not isinstance(self.payload, Mapping):
            raise TypeError("payload must be a mapping")
        frozen_payload = _freeze(self.payload)
        object.__setattr__(self, "payload", frozen_payload)
        content = _canonical_json_bytes({
            "session_id": self.session_id,
            "status": self.status.value,
            "payload": _thaw(frozen_payload),
        })
        object.__setattr__(self, "_artifact", RawResultArtifact(
            content=content,
            sha256="sha256:" + hashlib.sha256(content).hexdigest(),
        ))

    @property
    def artifact(self) -> RawResultArtifact:
        return self._artifact

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "status": self.status.value,
            "payload": _thaw(self.payload),
        }


@dataclass(frozen=True, slots=True)
class CheckpointHandoff:
    """Opaque, immutable state needed to resume the same delegation."""

    checkpoint_id: str
    checkpoint_hash: str
    state: Mapping[str, Any]
    session_id: str
    delegation_id: str
    packet_hash: str

    def __post_init__(self) -> None:
        for value, field in ((self.checkpoint_id, "checkpoint_id"), (self.session_id, "session_id"), (self.delegation_id, "delegation_id")):
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field} must be non-empty")
        _require_hash(self.checkpoint_hash, "checkpoint_hash")
        _require_hash(self.packet_hash, "packet_hash")
        if not isinstance(self.state, Mapping):
            raise TypeError("state must be a mapping")
        object.__setattr__(self, "state", _freeze_checkpoint(self.state))

    def to_dict(self) -> dict[str, Any]:
        return {
            "checkpoint_id": self.checkpoint_id,
            "checkpoint_hash": self.checkpoint_hash,
            "session_id": self.session_id,
            "delegation_id": self.delegation_id,
            "packet_hash": self.packet_hash,
            "state": _thaw(self.state),
        }


@dataclass(frozen=True, slots=True)
class DeveloperSession:
    session_id: str
    delegation_id: str
    packet_hash: str
    status: LifecycleStatus
    raw_result: RawResultEnvelope | None = None
    next_instruction: str | None = None
    checkpoint: CheckpointHandoff | None = None
    resume_epoch: int = 0


@dataclass(frozen=True, slots=True)
class LifecycleProjection:
    """Framework-neutral public projection for current/handoff views."""

    session_id: str
    delegation_id: str
    packet_hash: str
    status: LifecycleStatus
    next_instruction: str | None
    checkpoint: CheckpointHandoff | None
    resume_epoch: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "delegation_id": self.delegation_id,
            "packet_hash": self.packet_hash,
            "status": self.status.value,
            "next_instruction": self.next_instruction,
            "checkpoint": None if self.checkpoint is None else self.checkpoint.to_dict(),
            "resume_epoch": self.resume_epoch,
        }


class ReadOnlyPolicy:
    """Allow only packet-scoped reads; deny writes, secrets, and network."""

    _DENIED = frozenset({"write", "patch", "delete", "secret_read", "external_network", "network"})

    def authorize(self, action: str, *, path: str | None = None, packet: DelegationPacket | None = None) -> None:
        if not isinstance(action, str) or not action.strip():
            raise ReadOnlyPolicyRejected("action is required")
        if action != action.strip() or action != action.lower() or "-" in action:
            raise ReadOnlyPolicyRejected(f"action must use an exact canonical name: {action}")
        if action in self._DENIED:
            raise ReadOnlyPolicyRejected(f"read-only policy denied action: {action}")
        if action not in {"read", "inspect", "list", "test"}:
            raise ReadOnlyPolicyRejected(f"unsupported read-only action: {action}")
        if packet is not None:
            permission = getattr(packet, "permission_snapshot", None)
            packet_denied = getattr(packet, "prohibited_actions", None)
            if not isinstance(permission, PermissionSnapshot) or not isinstance(packet_denied, tuple):
                raise ReadOnlyPolicyRejected("packet permission snapshot is missing or malformed")
            if action in permission.prohibited_actions or action in packet_denied:
                raise ReadOnlyPolicyRejected(f"packet explicitly denied action: {action}")
            if action not in permission.allowed_actions:
                raise ReadOnlyPolicyRejected(f"action outside packet permission snapshot: {action}")
        if path is not None:
            if packet is None:
                raise ReadOnlyPolicyRejected("a packet is required for scoped path access")
            if not self._path_allowed(path, packet.allowed_paths):
                raise ReadOnlyPolicyRejected(f"path outside packet scope: {path}")

    @staticmethod
    def _path_allowed(path: str, allowed_paths: tuple[str, ...]) -> bool:
        path_parts = ReadOnlyPolicy._path_parts(path)
        if path_parts is None:
            return False
        for pattern in allowed_paths:
            if not isinstance(pattern, str):
                continue
            recursive = pattern.endswith("/**")
            single = not recursive and pattern.endswith("/*")
            base = pattern[:-3] if recursive else pattern[:-2] if single else pattern
            if "*" in base:
                continue
            base_parts = ReadOnlyPolicy._path_parts(base)
            if base_parts is None:
                continue
            if recursive and len(path_parts) >= len(base_parts) and path_parts[:len(base_parts)] == base_parts:
                return True
            if single and len(path_parts) == len(base_parts) + 1 and path_parts[:len(base_parts)] == base_parts:
                return True
            if not recursive and not single and path_parts == base_parts:
                return True
        return False

    @staticmethod
    def _path_parts(path: str) -> tuple[str, ...] | None:
        if (
            not isinstance(path, str)
            or not path
            or path.startswith(("/", "\\"))
            or "\\" in path
            or "*" in path
        ):
            return None
        parts = tuple(path.split("/"))
        if any(part in {"", ".", ".."} or ":" in part for part in parts):
            return None
        return parts


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
        self._lock = RLock()
        self._sessions: dict[str, DeveloperSession] = {}
        self._packets: dict[str, DelegationPacket] = {}
        self._bindings: dict[str, tuple[str, str]] = {}
        self._polling: set[str] = set()
        self._stopping: set[str] = set()
        self._stop_delivered: set[str] = set()

    @property
    def sessions(self) -> tuple[DeveloperSession, ...]:
        with self._lock:
            return tuple(self._sessions.values())

    def start(
        self, packet: DelegationPacket | Mapping[str, Any] | None, *, session_id: str,
        baseline_hash: str, context_snapshot_hash: str,
        parent_permission_snapshot: PermissionSnapshot | Mapping[str, Any] | None = None,
        parent_egress_profile: DataEgressProfile | Mapping[str, Any] | None = None,
    ) -> DeveloperSession:
        if not isinstance(session_id, str) or not session_id.strip():
            raise ValueError("session_id must be non-empty")
        validation = validate_packet(
            packet, baseline_hash=baseline_hash, context_snapshot_hash=context_snapshot_hash,
            parent_permission_snapshot=parent_permission_snapshot,
            parent_egress_profile=parent_egress_profile,
        )
        if not validation.valid:
            raise PacketRejected(validation)
        candidate = packet if isinstance(packet, DelegationPacket) else DelegationPacket.from_dict(packet)
        binding = (candidate.packet_hash, baseline_hash)
        self._policy.authorize("inspect")
        with self._lock:
            existing = self._sessions.get(session_id)
            if existing is not None:
                if self._bindings[session_id] != binding:
                    raise InvalidLifecycleTransition(
                        "session binding requires the identical packet and baseline"
                    )
                return existing
            nonterminal = {
                LifecycleStatus.STARTING, LifecycleStatus.START_AMBIGUOUS,
                LifecycleStatus.PENDING, LifecycleStatus.RUNNING,
                LifecycleStatus.STOP_REQUESTED, LifecycleStatus.PAUSED,
            }
            if any(session.status in nonterminal for session in self._sessions.values()):
                raise InvalidLifecycleTransition(
                    "only one developer-primary session may be nonterminal"
                )
            reservation = DeveloperSession(
                session_id, candidate.delegation_id, candidate.packet_hash,
                LifecycleStatus.STARTING,
            )
            self._sessions[session_id] = reservation
            self._packets[session_id] = candidate
            self._bindings[session_id] = binding
        try:
            self._runner.start(session_id, candidate)
        except Exception:
            with self._lock:
                current = self._sessions[session_id]
                if current is reservation:
                    current = self._replace(
                        current, status=LifecycleStatus.START_AMBIGUOUS,
                    )
                    self._sessions[session_id] = current
            raise
        with self._lock:
            current = self._sessions[session_id]
            if current is reservation:
                current = self._replace(current, status=LifecycleStatus.PENDING)
                self._sessions[session_id] = current
            return current

    def wait(self, session_id: str) -> DeveloperSession:
        with self._lock:
            current = self._require(session_id)
            if current.status in {
                LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED,
                LifecycleStatus.FAILED, LifecycleStatus.PAUSED,
            }:
                return current
            if current.status is LifecycleStatus.STARTING or session_id in self._polling:
                return current
            prior = current
            if current.status in {
                LifecycleStatus.PENDING, LifecycleStatus.START_AMBIGUOUS,
            }:
                current = self._replace(current, status=LifecycleStatus.RUNNING)
                self._sessions[session_id] = current
            observed = current
            self._polling.add(session_id)
        try:
            result = self._runner.poll(session_id)
            if result is not None:
                if not isinstance(result, RawResultEnvelope):
                    raise InvalidLifecycleTransition("runner returned an invalid raw result")
                if result.session_id != session_id:
                    raise InvalidLifecycleTransition("runner result session_id mismatch")
                if result.status not in {
                    LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED,
                    LifecycleStatus.FAILED,
                }:
                    raise InvalidLifecycleTransition("runner returned non-terminal result")
        except Exception:
            with self._lock:
                self._polling.discard(session_id)
                if self._sessions.get(session_id) is observed:
                    self._sessions[session_id] = prior
            raise
        with self._lock:
            self._polling.discard(session_id)
            latest = self._require(session_id)
            # A concurrent intervention replaces the immutable session, not its
            # runner binding. Merge a one-shot result into that latest snapshot.
            if latest.status in {
                LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
            }:
                return latest
            if result is None:
                return latest
            expected = (
                LifecycleStatus.STOPPED
                if latest.status is LifecycleStatus.STOP_REQUESTED
                else result.status
            )
            captured = (
                result if expected is result.status else RawResultEnvelope(
                    result.session_id, expected, result.to_dict()["payload"],
                )
            )
            latest = self._replace(
                latest, status=expected, raw_result=captured,
            )
            self._sessions[session_id] = latest
            return latest

    def stop(self, session_id: str) -> DeveloperSession:
        with self._lock:
            current = self._require(session_id)
            if current.status in {
                LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
            }:
                return current
            if session_id in self._stopping or session_id in self._stop_delivered:
                return current
            if current.status not in {LifecycleStatus.RUNNING, LifecycleStatus.STOP_REQUESTED}:
                raise InvalidLifecycleTransition("stop requires a RUNNING session")
            current = self._replace(current, status=LifecycleStatus.STOP_REQUESTED)
            self._sessions[session_id] = current
            self._stopping.add(session_id)
        try:
            self._runner.stop(session_id)
        except Exception:
            with self._lock:
                # Delivery is ambiguous: retain stop intent and permit retry.
                # Only a terminal poll may declare the runner stopped.
                self._stopping.discard(session_id)
            raise
        with self._lock:
            self._stop_delivered.add(session_id)
            self._stopping.discard(session_id)
            return self._require(session_id)

    def steer(self, session_id: str, instruction: str) -> DeveloperSession:
        """Record the next approved instruction while the session is running."""
        with self._lock:
            current = self._require(session_id)
            if current.status is not LifecycleStatus.RUNNING:
                raise InvalidLifecycleTransition("steer requires a RUNNING session")
            if not isinstance(instruction, str) or not instruction.strip():
                raise ValueError("instruction must be non-empty")
            current = self._replace(current, next_instruction=instruction.strip())
            self._sessions[session_id] = current
            return current

    def pause(self, session_id: str, checkpoint: CheckpointHandoff) -> DeveloperSession:
        """Pause without terminating the runner and bind an immutable checkpoint."""
        if not isinstance(checkpoint, CheckpointHandoff):
            raise TypeError("checkpoint must be CheckpointHandoff")
        with self._lock:
            current = self._require(session_id)
            if current.status is LifecycleStatus.PAUSED:
                if current.checkpoint == checkpoint:
                    return current
                raise ResumeRejected("paused session already has a different checkpoint")
            if current.status in {LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED}:
                raise ResumeRejected("cannot pause a terminal session")
            if current.status is not LifecycleStatus.RUNNING:
                raise InvalidLifecycleTransition("pause requires a RUNNING session")
            if (checkpoint.session_id, checkpoint.delegation_id, checkpoint.packet_hash) != (
                current.session_id, current.delegation_id, current.packet_hash
            ):
                raise ResumeRejected("checkpoint identity does not match the current session")
            current = self._replace(current, status=LifecycleStatus.PAUSED, checkpoint=checkpoint)
            self._sessions[session_id] = current
            return current

    def resume(self, session_id: str, packet_hash: str) -> DeveloperSession:
        """Resume only the packet that produced the stored checkpoint."""
        with self._lock:
            current = self._require(session_id)
            if packet_hash != current.packet_hash:
                raise ResumeRejected("packet hash does not match the checkpoint session")
            if current.status is LifecycleStatus.RUNNING:
                return current
            if current.status is not LifecycleStatus.PAUSED:
                raise ResumeRejected("cannot resume a terminal or non-paused session")
            current = self._replace(current, status=LifecycleStatus.RUNNING, resume_epoch=current.resume_epoch + 1)
            self._sessions[session_id] = current
            return current

    def current(self, session_id: str) -> LifecycleProjection:
        with self._lock:
            current = self._require(session_id)
            return LifecycleProjection(current.session_id, current.delegation_id, current.packet_hash,
                                       current.status, current.next_instruction, current.checkpoint,
                                       current.resume_epoch)

    def handoff(self, session_id: str) -> CheckpointHandoff | None:
        with self._lock:
            return self._require(session_id).checkpoint

    def authorize(self, session_id: str, action: str, *, path: str | None = None) -> None:
        with self._lock:
            self._require(session_id)
            packet = self._packets[session_id]
        self._policy.authorize(action, path=path, packet=packet)

    def _require(self, session_id: str) -> DeveloperSession:
        try:
            return self._sessions[session_id]
        except KeyError as error:
            raise KeyError(f"unknown developer session: {session_id}") from error

    def _replace(self, session: DeveloperSession, **changes: Any) -> DeveloperSession:
        return DeveloperSession(
            changes.get("session_id", session.session_id),
            changes.get("delegation_id", session.delegation_id),
            changes.get("packet_hash", session.packet_hash),
            changes.get("status", session.status),
            changes.get("raw_result", session.raw_result),
            changes.get("next_instruction", session.next_instruction),
            changes.get("checkpoint", session.checkpoint),
            changes.get("resume_epoch", session.resume_epoch),
        )


ReadOnlyDeveloperRunner = DeterministicFakeDeveloperRunner
RawResult = RawResultEnvelope

__all__ = [
    "LifecycleStatus", "LifecycleError", "PacketRejected", "InvalidLifecycleTransition",
    "ReadOnlyPolicyRejected", "ResumeRejected", "RawResultArtifact", "RawResultEnvelope", "RawResult", "CheckpointHandoff", "DeveloperSession", "LifecycleProjection",
    "DeveloperRunner", "DeterministicFakeDeveloperRunner", "ReadOnlyDeveloperRunner",
    "DeveloperLifecycleService", "ReadOnlyPolicy",
]
