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
import inspect
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


class LifecycleTargetMismatch(InvalidLifecycleTransition):
    pass


class LifecycleVersionMismatch(InvalidLifecycleTransition):
    pass


class ReadOnlyPolicyRejected(LifecycleError):
    pass


class ResumeRejected(LifecycleError):
    """A pause/resume command cannot be applied to the current session."""


_PRIVATE_CHECKPOINT_KEYS = frozenset({
    "authorization", "privatekey", "accesskey", "apikey", "credential",
    "credentials", "password", "secret", "token",
})


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


def _freeze_checkpoint(value: Any, *, _active: set[int] | None = None) -> Any:
    """Detach a checkpoint into deterministic, JSON-safe immutable values.

    Tuple/set compatibility is retained for the C-03 handoff contract, but set
    members are ordered by canonical JSON when projected.  Secret-shaped keys
    are rejected at ingress so a public checkpoint projection cannot leak a
    credential value accidentally.
    """
    if value is None or type(value) in {bool, int}:
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise ValueError("checkpoint state must contain only finite numbers")
        return value
    if type(value) is str:
        try:
            value.encode("utf-8")
        except UnicodeEncodeError as error:
            raise ValueError("checkpoint state text must be valid UTF-8") from error
        return value
    active = set() if _active is None else _active
    if isinstance(value, Mapping):
        identity = id(value)
        if identity in active:
            raise ValueError("checkpoint state must not contain cycles")
        active.add(identity)
        try:
            frozen: dict[str, Any] = {}
            for key, item in value.items():
                if type(key) is not str or not key or key != key.strip():
                    raise TypeError("checkpoint state mapping keys must be canonical strings")
                try:
                    key.encode("utf-8")
                except UnicodeEncodeError as error:
                    raise ValueError("checkpoint state keys must be valid UTF-8") from error
                normalized_key = re.sub(r"[^a-z0-9]", "", key.lower())
                if normalized_key in _PRIVATE_CHECKPOINT_KEYS:
                    raise ValueError(f"secret-shaped checkpoint key is not allowed: {key}")
                frozen[key] = _freeze_checkpoint(item, _active=active)
            return MappingProxyType(frozen)
        finally:
            active.remove(identity)
    if isinstance(value, (list, tuple, set, frozenset)):
        identity = id(value)
        if identity in active:
            raise ValueError("checkpoint state must not contain cycles")
        active.add(identity)
        try:
            items = tuple(_freeze_checkpoint(item, _active=active) for item in value)
            if isinstance(value, (set, frozenset)):
                items = tuple(sorted(
                    items,
                    key=lambda item: json.dumps(
                        _thaw(item), ensure_ascii=False, sort_keys=True,
                        separators=(",", ":"), allow_nan=False,
                    ),
                ))
            return items
        finally:
            active.remove(identity)
    raise TypeError("checkpoint state accepts only JSON-compatible values")


def _thaw(value: Any) -> Any:
    """Convert the internal immutable payload back to JSON-safe containers."""
    if isinstance(value, Mapping):
        return {str(key): _thaw(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_thaw(item) for item in value]
    if isinstance(value, (set, frozenset)):
        return sorted(
            (_thaw(item) for item in value),
            key=lambda item: json.dumps(
                item, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                allow_nan=False,
            ),
        )
    return value


def _public_text(value: str) -> str:
    """Return an already validated canonical identifier/path/operation."""
    return value


def _public_texts(values: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(_public_text(value) for value in values)


def _artifact_reference(
    value: str,
    *,
    packet_hash: str,
    json_pointer: str,
    index: int | None = None,
) -> Mapping[str, Any]:
    """Project packet text as a stable content-addressed reference, never raw."""
    digest = "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()
    reference: dict[str, Any] = {
        "artifact_hash": packet_hash,
        "json_pointer": json_pointer,
        "content_sha256": digest,
        "status": "REFERENCE_ONLY",
        "lookup": "U02_DEFERRED",
        "reference": f"delegation_packet:{packet_hash}#{json_pointer}",
    }
    if index is not None:
        reference["index"] = index
    return MappingProxyType(reference)


def _command_artifact_reference(value: str, fingerprint: str) -> Mapping[str, Any]:
    _require_hash(fingerprint, "command artifact hash")
    digest = "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()
    artifact_id = f"command:{fingerprint}"
    return MappingProxyType({
        "artifact_id": artifact_id,
        "artifact_hash": fingerprint,
        "json_pointer": "/payload/instruction",
        "content_sha256": digest,
        "status": "REFERENCE_ONLY",
        "lookup": "COMMAND_LEDGER",
        "reference": f"{artifact_id}#/payload/instruction",
    })


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
    baseline_hash: str | None = None
    context_snapshot_hash: str | None = None
    resume_epoch: int = 0
    delivered_commands: Mapping[str, str] = field(default_factory=dict)
    state_version: int = 0
    _content: bytes = field(init=False, repr=False)

    def __post_init__(self) -> None:
        for value, field in ((self.checkpoint_id, "checkpoint_id"), (self.session_id, "session_id"), (self.delegation_id, "delegation_id")):
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field} must be non-empty")
        _require_hash(self.checkpoint_hash, "checkpoint_hash")
        _require_hash(self.packet_hash, "packet_hash")
        if not isinstance(self.state, Mapping):
            raise TypeError("state must be a mapping")
        if (self.baseline_hash is None) != (self.context_snapshot_hash is None):
            raise ValueError("checkpoint baseline and context bindings must be provided together")
        if self.baseline_hash is not None:
            _require_hash(self.baseline_hash, "baseline_hash")
            _require_hash(self.context_snapshot_hash, "context_snapshot_hash")
        if type(self.resume_epoch) is not int or self.resume_epoch < 0:
            raise ValueError("resume_epoch must be a non-negative integer")
        if type(self.state_version) is not int or self.state_version < 0:
            raise ValueError("state_version must be a non-negative integer")
        if not isinstance(self.delivered_commands, Mapping):
            raise TypeError("delivered_commands must be a mapping")
        commands: dict[str, str] = {}
        for key, fingerprint in self.delivered_commands.items():
            if (
                type(key) is not str or not key or key != key.strip()
                or len(key) > 128
            ):
                raise ValueError("delivered command keys must be canonical")
            _require_hash(fingerprint, "delivered command fingerprint")
            commands[key] = fingerprint
        frozen_state = _freeze_checkpoint(self.state)
        object.__setattr__(self, "state", frozen_state)
        object.__setattr__(self, "delivered_commands", MappingProxyType(commands))
        payload = {
            "baseline_hash": self.baseline_hash,
            "context_snapshot_hash": self.context_snapshot_hash,
            "delegation_id": self.delegation_id,
            "delivered_commands": commands,
            "packet_hash": self.packet_hash,
            "resume_epoch": self.resume_epoch,
            "state_version": self.state_version,
            "session_id": self.session_id,
            "state": _thaw(frozen_state),
        }
        content = _canonical_json_bytes(payload)
        object.__setattr__(self, "_content", content)
        if self.baseline_hash is not None:
            expected = "sha256:" + hashlib.sha256(content).hexdigest()
            if self.checkpoint_hash != expected:
                raise ValueError("checkpoint_hash does not match canonical bound content")

    @classmethod
    def create(
        cls,
        *,
        checkpoint_id: str,
        state: Mapping[str, Any],
        session_id: str,
        delegation_id: str,
        packet_hash: str,
        baseline_hash: str,
        context_snapshot_hash: str,
        resume_epoch: int,
        delivered_commands: Mapping[str, str],
        state_version: int = 0,
    ) -> "CheckpointHandoff":
        frozen_state = _freeze_checkpoint(state)
        commands = dict(delivered_commands)
        content = _canonical_json_bytes({
            "baseline_hash": baseline_hash,
            "context_snapshot_hash": context_snapshot_hash,
            "delegation_id": delegation_id,
            "delivered_commands": commands,
            "packet_hash": packet_hash,
            "resume_epoch": resume_epoch,
            "state_version": state_version,
            "session_id": session_id,
            "state": _thaw(frozen_state),
        })
        return cls(
            checkpoint_id,
            "sha256:" + hashlib.sha256(content).hexdigest(),
            state,
            session_id,
            delegation_id,
            packet_hash,
            baseline_hash,
            context_snapshot_hash,
            resume_epoch,
            commands,
            state_version,
        )

    @property
    def content(self) -> bytes:
        return self._content

    def verify(self) -> bool:
        return (
            self.baseline_hash is not None
            and self.checkpoint_hash
            == "sha256:" + hashlib.sha256(self._content).hexdigest()
        )

    def to_dict(self) -> dict[str, Any]:
        value = {
            "checkpoint_id": self.checkpoint_id,
            "checkpoint_hash": self.checkpoint_hash,
            "session_id": self.session_id,
            "delegation_id": self.delegation_id,
            "packet_hash": self.packet_hash,
            "state": _thaw(self.state),
        }
        if self.baseline_hash is not None:
            value.update({
                "baseline_hash": self.baseline_hash,
                "context_snapshot_hash": self.context_snapshot_hash,
                "resume_epoch": self.resume_epoch,
                "delivered_commands": dict(self.delivered_commands),
                "state_version": self.state_version,
            })
        return value

    def public_dict(self) -> dict[str, Any]:
        """Return only allowlisted checkpoint metadata, never opaque runner state."""
        value = {
            "checkpoint_id": _public_text(self.checkpoint_id),
            "checkpoint_hash": self.checkpoint_hash,
            "session_id": _public_text(self.session_id),
            "delegation_id": _public_text(self.delegation_id),
            "packet_hash": self.packet_hash,
        }
        if self.baseline_hash is not None:
            value.update({
                "baseline_hash": self.baseline_hash,
                "context_snapshot_hash": self.context_snapshot_hash,
                "resume_epoch": self.resume_epoch,
                "state_version": self.state_version,
            })
        return value


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
    current_action: str | None = None
    state_version: int = 0


@dataclass(frozen=True, slots=True)
class LifecycleProjection:
    """Framework-neutral public projection for current/handoff views."""

    session_id: str
    delegation_id: str
    packet_hash: str
    status: LifecycleStatus
    next_instruction: Mapping[str, Any] | None
    checkpoint: CheckpointHandoff | None
    resume_epoch: int
    state_version: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": _public_text(self.session_id),
            "delegation_id": _public_text(self.delegation_id),
            "packet_hash": self.packet_hash,
            "status": self.status.value,
            "next_instruction": None if self.next_instruction is None else _thaw(self.next_instruction),
            "checkpoint": None if self.checkpoint is None else self.checkpoint.public_dict(),
            "resume_epoch": self.resume_epoch,
            "state_version": self.state_version,
        }


@dataclass(frozen=True, slots=True)
class ResultHandoffProjection:
    session_id: str
    delegation_id: str
    status: LifecycleStatus
    checkpoint: CheckpointHandoff | None
    raw_result: RawResultEnvelope | None

    def to_dict(self) -> dict[str, Any]:
        raw_result = None
        if self.raw_result is not None:
            artifact = self.raw_result.artifact
            raw_result = {
                "session_id": _public_text(self.raw_result.session_id),
                "status": self.raw_result.status.value,
                "artifact": {
                    "sha256": artifact.sha256,
                    "media_type": artifact.media_type,
                    "size": len(artifact.content),
                },
            }
        return {
            "session_id": _public_text(self.session_id),
            "delegation_id": _public_text(self.delegation_id),
            "status": self.status.value,
            "checkpoint": None if self.checkpoint is None else self.checkpoint.public_dict(),
            "raw_result": raw_result,
        }


@dataclass(frozen=True, slots=True)
class WorkbenchProjection:
    role: str
    objective: Mapping[str, Any]
    in_scope: tuple[Mapping[str, Any], ...]
    out_of_scope: tuple[Mapping[str, Any], ...]
    permission: Mapping[str, Any]
    budget: Mapping[str, Any]
    cost_usage: Mapping[str, Any]
    status: LifecycleStatus
    current_action: str | None
    checkpoint: CheckpointHandoff | None
    evidence: tuple[Mapping[str, Any], ...]
    allowed_commands: tuple[str, ...]
    command_status: Mapping[str, Any]
    stop_authority: Mapping[str, Any]
    state_version: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "role": self.role,
            "objective": _thaw(self.objective),
            "in_scope": _thaw(self.in_scope),
            "out_of_scope": _thaw(self.out_of_scope),
            "permission": _thaw(self.permission),
            "budget": _thaw(self.budget),
            "cost_usage": _thaw(self.cost_usage),
            "status": self.status.value,
            "current_action": self.current_action,
            "checkpoint": None if self.checkpoint is None else self.checkpoint.public_dict(),
            "evidence": [_thaw(value) for value in self.evidence],
            "allowed_commands": list(self.allowed_commands),
            "command_status": _thaw(self.command_status),
            "stop_authority": _thaw(self.stop_authority),
            "state_version": self.state_version,
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
    def steer(self, session_id: str, instruction: str, idempotency_key: str) -> None: ...
    def request_checkpoint(self, session_id: str, idempotency_key: str) -> Mapping[str, Any]: ...
    def resume(
        self, session_id: str, checkpoint: CheckpointHandoff, idempotency_key: str,
    ) -> None: ...
    def stop(
        self, session_id: str, idempotency_key: str | None = None,
        reason: str | None = None,
    ) -> None: ...
    def restore(
        self, session_id: str, packet: DelegationPacket,
        checkpoint: CheckpointHandoff, idempotency_key: str,
    ) -> None: ...


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

    def steer(self, session_id: str, instruction: str, idempotency_key: str) -> None:
        self._sessions[session_id]

    def request_checkpoint(self, session_id: str, idempotency_key: str) -> Mapping[str, Any]:
        _, polls, _ = self._sessions[session_id]
        return {"polls": polls}

    def resume(
        self, session_id: str, checkpoint: CheckpointHandoff, idempotency_key: str,
    ) -> None:
        self._sessions[session_id]

    def stop(
        self, session_id: str, idempotency_key: str | None = None,
        reason: str | None = None,
    ) -> None:
        packet, polls, _ = self._sessions[session_id]
        self._sessions[session_id] = (packet, polls, True)

    def restore(
        self, session_id: str, packet: DelegationPacket,
        checkpoint: CheckpointHandoff, idempotency_key: str,
    ) -> None:
        if session_id in self._sessions:
            raise InvalidLifecycleTransition("runner session is already attached")
        polls = checkpoint.state.get("polls", 0)
        if type(polls) is not int or polls < 0:
            raise InvalidLifecycleTransition("runner checkpoint poll state is invalid")
        self._sessions[session_id] = (packet, polls, False)


class DeveloperLifecycleService:
    """In-memory lifecycle coordinator with monotonic, idempotent commands."""

    def __init__(self, runner: DeveloperRunner | None = None, policy: ReadOnlyPolicy | None = None) -> None:
        self._runner = runner or DeterministicFakeDeveloperRunner()
        self._policy = policy or ReadOnlyPolicy()
        self._lock = RLock()
        self._sessions: dict[str, DeveloperSession] = {}
        self._packets: dict[str, DelegationPacket] = {}
        self._bindings: dict[str, tuple[str, str, str]] = {}
        self._polling: set[str] = set()
        self._stopping: set[str] = set()
        self._stop_delivered: set[str] = set()
        self._commands: dict[
            str, dict[str, tuple[str, str, str, Mapping[str, Any]]]
        ] = {}
        self._command_generations: dict[str, dict[str, int]] = {}
        self._command_resolutions: dict[str, Mapping[str, Any]] = {}
        self._next_command_generation = 0
        self._restore_commands: dict[
            str, tuple[str, str, str, Mapping[str, Any]]
        ] = {}
        self._restore_contexts: dict[
            str, tuple[DelegationPacket, CheckpointHandoff, str, str]
        ] = {}
        self._admission: tuple[str, str] | None = None

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
        binding = (candidate.packet_hash, baseline_hash, context_snapshot_hash)
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
            self._assert_admission_available()
            if any(
                session.delegation_id == candidate.delegation_id
                for session in self._sessions.values()
            ):
                raise InvalidLifecycleTransition(
                    "delegation already has a canonical developer session"
                )
            reservation = DeveloperSession(
                session_id, candidate.delegation_id, candidate.packet_hash,
                LifecycleStatus.STARTING,
            )
            self._sessions[session_id] = reservation
            self._packets[session_id] = candidate
            self._bindings[session_id] = binding
            self._commands[session_id] = {}
            self._command_generations[session_id] = {}
            self._command_resolutions.pop(session_id, None)
            self._admission = ("START", session_id)
        try:
            self._runner.start(session_id, candidate)
        except Exception:
            with self._lock:
                current = self._sessions[session_id]
                if current is reservation:
                    current = self._replace(
                        current, status=LifecycleStatus.START_AMBIGUOUS,
                        state_version=current.state_version + 1,
                    )
                    self._sessions[session_id] = current
                # The ambiguous start is already tracked and blocks new sessions.
                self._admission = None
            raise
        with self._lock:
            current = self._sessions[session_id]
            if current is reservation:
                current = self._replace(
                    current, status=LifecycleStatus.PENDING,
                    state_version=current.state_version + 1,
                )
                self._sessions[session_id] = current
            self._admission = None
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
                current = self._replace(
                    current, status=LifecycleStatus.RUNNING,
                    state_version=current.state_version + 1,
                )
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
                    self._sessions[session_id] = self._replace(
                        prior, state_version=observed.state_version + 1,
                    )
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
            if latest.status is LifecycleStatus.PAUSED:
                latest = self._replace(
                    latest, raw_result=result,
                    state_version=latest.state_version + 1,
                )
                self._sessions[session_id] = latest
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
                state_version=latest.state_version + 1,
            )
            self._sessions[session_id] = latest
            return latest

    def stop(
        self, session_id: str, *, idempotency_key: str | None = None,
        reason: str | None = None, audit_reason: str | None = None,
        target_hash: str | None = None,
        expected_state_version: int | None = None,
    ) -> DeveloperSession:
        c04_command = reason is not None or audit_reason is not None
        if c04_command:
            if not isinstance(reason, str) or not reason.strip() or reason != reason.strip():
                raise ValueError("C-04 stop reason must be a canonical non-empty string")
            if audit_reason is None:
                audit_reason = reason
            if not isinstance(audit_reason, str) or not audit_reason.strip() or audit_reason != audit_reason.strip():
                raise ValueError("C-04 stop audit reason must be a canonical non-empty string")
            self._runner_operation(
                "stop", require_idempotency=True, require_reason=True,
            )
        with self._lock:
            current = self._require(session_id)
            payload = {} if not c04_command else {
                "reason": reason, "audit_reason": audit_reason,
            }
            key, fingerprint, deliver = self._prepare_command(
                session_id, "STOP", payload, idempotency_key,
                allow_legacy_in_flight_replay=not c04_command,
                reserve=False,
                exclusive=expected_state_version is not None or target_hash is not None,
            )
            if deliver:
                self._assert_mutation_preconditions(
                    current, target_hash=target_hash,
                    expected_state_version=expected_state_version,
                )
            if current.status in {
                LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
            }:
                if c04_command and deliver:
                    raise InvalidLifecycleTransition("cannot deliver a new stop command to a terminal session")
                return current
            if current.status not in {
                LifecycleStatus.RUNNING, LifecycleStatus.PAUSED,
                LifecycleStatus.STOP_REQUESTED,
            }:
                raise InvalidLifecycleTransition("stop requires a RUNNING or PAUSED session")
            if c04_command and session_id in self._stopping:
                raise InvalidLifecycleTransition("stop command delivery is already in flight")
            if c04_command and deliver and session_id in self._stop_delivered:
                raise InvalidLifecycleTransition("stop command was already delivered")
            if not deliver or session_id in self._stopping or session_id in self._stop_delivered:
                return current
            self._reserve_command(session_id, key, fingerprint, "STOP", payload)
            current = self._replace(
                current, status=LifecycleStatus.STOP_REQUESTED, current_action="STOP",
                state_version=current.state_version + 1,
            )
            self._sessions[session_id] = current
            self._stopping.add(session_id)
        try:
            self._deliver_runner(
                "stop", session_id, idempotency_key=key,
                require_idempotency=idempotency_key is not None, reason=reason,
            )
        except Exception:
            with self._lock:
                if c04_command:
                    self._unknown_command(session_id, key, fingerprint)
                else:
                    # C-03 compatibility: its legacy runner has no delivery key.
                    self._retry_legacy_command(session_id, key, fingerprint)
                self._stopping.discard(session_id)
            raise
        with self._lock:
            self._complete_command(session_id, key, fingerprint)
            self._stop_delivered.add(session_id)
            self._stopping.discard(session_id)
            current = self._require(session_id)
            current = self._replace(
                current, state_version=current.state_version + 1,
            )
            self._sessions[session_id] = current
            return current

    def steer(
        self, session_id: str, instruction: str, *, idempotency_key: str | None = None,
        reason: str | None = None,
        target_hash: str | None = None,
        expected_state_version: int | None = None,
    ) -> DeveloperSession:
        """Record the next approved instruction while the session is running."""
        if not isinstance(instruction, str) or not instruction.strip():
            raise ValueError("instruction must be non-empty")
        instruction = instruction.strip()
        if reason is not None and (
            not isinstance(reason, str) or not reason.strip() or reason != reason.strip()
        ):
            raise ValueError("steer reason must be a canonical non-empty string")
        self._runner_operation("steer", require_idempotency=True)
        with self._lock:
            current = self._require(session_id)
            key, fingerprint, deliver = self._prepare_command(
                session_id, "STEER", {"instruction": instruction, "reason": reason},
                idempotency_key,
                reserve=False,
                exclusive=expected_state_version is not None or target_hash is not None,
            )
            if not deliver:
                return current
            self._assert_mutation_preconditions(
                current, target_hash=target_hash,
                expected_state_version=expected_state_version,
            )
            if current.status is not LifecycleStatus.RUNNING:
                raise InvalidLifecycleTransition("steer requires a RUNNING session")
            self._reserve_command(
                session_id, key, fingerprint, "STEER",
                {"instruction": instruction, "reason": reason},
            )
        try:
            self._deliver_runner(
                "steer", session_id, instruction, idempotency_key=key,
            )
        except Exception:
            with self._lock:
                self._unknown_command(session_id, key, fingerprint)
            raise
        with self._lock:
            self._complete_command(session_id, key, fingerprint)
            current = self._require(session_id)
            if current.status not in {
                LifecycleStatus.RUNNING, LifecycleStatus.PAUSED,
                LifecycleStatus.STOP_REQUESTED,
                LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
            }:
                raise InvalidLifecycleTransition("steer raced with an invalid lifecycle state")
            current = self._replace(
                current,
                next_instruction=instruction,
                state_version=current.state_version + 1,
                current_action=(
                    "STEER"
                    if current.status is LifecycleStatus.RUNNING
                    else current.current_action
                ),
            )
            self._sessions[session_id] = current
            return current

    def request_checkpoint(
        self, session_id: str, *, idempotency_key: str,
    ) -> CheckpointHandoff:
        """Ask the runner for one canonical checkpoint and pause atomically."""
        self._runner_operation("request_checkpoint", require_idempotency=True)
        with self._lock:
            current = self._require(session_id)
            command_payload = {"resume_epoch": current.resume_epoch}
            command_fingerprint = self._command_fingerprint(
                "CHECKPOINT_PAUSE", command_payload,
            )
            command_key = self._command_key(
                "CHECKPOINT_PAUSE", command_fingerprint, idempotency_key,
            )
            key, fingerprint, deliver = self._prepare_command(
                session_id,
                "CHECKPOINT_PAUSE",
                command_payload,
                idempotency_key,
                reserve=False,
            )
            if not deliver:
                if current.checkpoint is None:
                    raise InvalidLifecycleTransition("checkpoint delivery is incomplete")
                return current.checkpoint
            if current.status is not LifecycleStatus.RUNNING:
                raise InvalidLifecycleTransition("checkpoint pause requires a RUNNING session")
            if any(
                state != "DELIVERED" and key != command_key
                for key, (_, state, _, _) in self._commands[session_id].items()
            ):
                raise InvalidLifecycleTransition(
                    "checkpoint requires prior command outcome reconciliation"
                )
            reservation_generation = self._reserve_command(
                session_id, key, fingerprint, "CHECKPOINT_PAUSE", command_payload,
            )
            prior = current
            current = self._replace(
                current, status=LifecycleStatus.PAUSED,
                current_action="CHECKPOINT_PAUSE",
                state_version=current.state_version + 1,
            )
            self._sessions[session_id] = current
        try:
            state = self._deliver_runner(
                "request_checkpoint", session_id, idempotency_key=key,
            )
            if not isinstance(state, Mapping):
                raise InvalidLifecycleTransition("runner checkpoint state must be a mapping")
            frozen_state = _freeze_checkpoint(state)
        except Exception:
            with self._lock:
                latest_before_unknown = self._require(session_id)
                record = self._commands[session_id].get(key)
                owns_reservation = (
                    self._command_generations[session_id].get(key)
                    == reservation_generation
                    and record is not None
                    and record[0] == fingerprint
                    and record[2] == "CHECKPOINT_PAUSE"
                )
                self._unknown_command(session_id, key, fingerprint)
                latest = self._require(session_id)
                if owns_reservation and latest.status is LifecycleStatus.STOP_REQUESTED:
                    pass
                elif owns_reservation and latest.raw_result is not None:
                    self._sessions[session_id] = self._replace(
                        latest,
                        status=latest.raw_result.status,
                        checkpoint=prior.checkpoint,
                        current_action=prior.current_action,
                    )
                elif owns_reservation:
                    self._sessions[session_id] = self._replace(
                        prior, raw_result=latest.raw_result,
                        checkpoint=prior.checkpoint,
                        current_action=prior.current_action,
                        state_version=latest.state_version,
                    )
            raise
        with self._lock:
            self._complete_command(session_id, key, fingerprint)
            current = self._require(session_id)
            _, baseline_hash, context_snapshot_hash = self._bindings[session_id]
            commands = {
                command_key: command_fingerprint
                for command_key, (command_fingerprint, state, _, _)
                in self._commands[session_id].items()
                if state == "DELIVERED"
            }
            checkpoint_version = current.state_version + 1
            checkpoint = CheckpointHandoff.create(
                checkpoint_id=f"checkpoint:{session_id}:{current.resume_epoch}",
                state=_thaw(frozen_state),
                session_id=session_id,
                delegation_id=current.delegation_id,
                packet_hash=current.packet_hash,
                baseline_hash=baseline_hash,
                context_snapshot_hash=context_snapshot_hash,
                resume_epoch=current.resume_epoch,
                delivered_commands=commands,
                state_version=checkpoint_version,
            )
            current = self._replace(
                current, checkpoint=checkpoint, state_version=checkpoint_version,
            )
            self._sessions[session_id] = current
            return checkpoint

    def pause(
        self, session_id: str, checkpoint: CheckpointHandoff,
        *, idempotency_key: str | None = None,
    ) -> DeveloperSession:
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
            current = self._replace(
                current, status=LifecycleStatus.PAUSED, checkpoint=checkpoint,
                current_action="CHECKPOINT_PAUSE", state_version=current.state_version + 1,
            )
            self._sessions[session_id] = current
            return current

    def resume(
        self,
        session_id: str,
        packet_hash: str,
        *,
        expected_resume_epoch: int | None = None,
        idempotency_key: str | None = None,
        reason: str | None = None,
        target_hash: str | None = None,
        expected_state_version: int | None = None,
    ) -> DeveloperSession:
        """Resume only the packet that produced the stored checkpoint."""
        self._runner_operation("resume", require_idempotency=True)
        with self._lock:
            current = self._require(session_id)
            expected = current.resume_epoch if expected_resume_epoch is None else expected_resume_epoch
            if type(expected) is not int or expected < 0:
                raise ResumeRejected("expected resume epoch is invalid")
            if reason is not None and (
                not isinstance(reason, str) or not reason.strip() or reason != reason.strip()
            ):
                raise ValueError("resume reason must be a canonical non-empty string")
            key, fingerprint, deliver = self._prepare_command(
                session_id,
                "RESUME",
                {"packet_hash": packet_hash, "expected_resume_epoch": expected, "reason": reason},
                idempotency_key,
                reserve=False,
                exclusive=expected_state_version is not None or target_hash is not None,
            )
            if not deliver:
                return current
            self._assert_mutation_preconditions(
                current, target_hash=target_hash,
                expected_state_version=expected_state_version,
            )
            if packet_hash != current.packet_hash:
                raise ResumeRejected("packet hash does not match the checkpoint session")
            if current.status is not LifecycleStatus.PAUSED:
                raise ResumeRejected("cannot resume a terminal or non-paused session")
            if expected != current.resume_epoch:
                raise ResumeRejected("stale resume epoch")
            checkpoint = current.checkpoint
            if checkpoint is None:
                raise ResumeRejected("paused session has no checkpoint")
            c04_command = any(value is not None for value in (
                idempotency_key, reason, target_hash, expected_state_version,
            ))
            if c04_command and checkpoint.baseline_hash is None:
                raise ResumeRejected("C-04 resume requires a canonical bound checkpoint")
            if checkpoint.baseline_hash is not None and not checkpoint.verify():
                raise ResumeRejected("checkpoint content hash is invalid")
            if c04_command or checkpoint.baseline_hash is not None:
                if (checkpoint.session_id, checkpoint.delegation_id, checkpoint.packet_hash) != (
                    current.session_id, current.delegation_id, current.packet_hash,
                ):
                    raise ResumeRejected("checkpoint identity does not match the current session")
                _, baseline_hash, context_snapshot_hash = self._bindings[session_id]
                if checkpoint.baseline_hash != baseline_hash:
                    raise ResumeRejected("checkpoint baseline drift detected")
                if checkpoint.context_snapshot_hash != context_snapshot_hash:
                    raise ResumeRejected("checkpoint context drift detected")
                if checkpoint.resume_epoch != current.resume_epoch:
                    raise ResumeRejected("stale checkpoint resume epoch")
            self._reserve_command(
                session_id, key, fingerprint, "RESUME",
                {"packet_hash": packet_hash, "expected_resume_epoch": expected,
                 "reason": reason},
            )
        try:
            self._deliver_runner(
                "resume", session_id, checkpoint, idempotency_key=key,
            )
        except Exception:
            with self._lock:
                self._unknown_command(session_id, key, fingerprint)
            raise
        with self._lock:
            self._complete_command(session_id, key, fingerprint)
            current = self._require(session_id)
            if current.status is LifecycleStatus.PAUSED:
                terminal = current.raw_result
                current = self._replace(
                    current,
                    status=(terminal.status if terminal is not None else LifecycleStatus.RUNNING),
                    resume_epoch=current.resume_epoch + 1,
                    current_action="RESUME",
                    state_version=current.state_version + 1,
                )
            elif current.status in {
                LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
            }:
                current = self._replace(
                    current, state_version=current.state_version + 1,
                )
            elif current.status is LifecycleStatus.STOP_REQUESTED:
                current = self._replace(
                    current, state_version=current.state_version + 1,
                )
            else:
                raise ResumeRejected("resume raced with a lifecycle transition")
            self._sessions[session_id] = current
            return current

    def restore(
        self,
        packet: DelegationPacket | Mapping[str, Any] | None,
        checkpoint: CheckpointHandoff,
        *,
        expected_session_id: str,
        idempotency_key: str,
        baseline_hash: str,
        context_snapshot_hash: str,
        parent_permission_snapshot: PermissionSnapshot | Mapping[str, Any] | None = None,
        parent_egress_profile: DataEgressProfile | Mapping[str, Any] | None = None,
    ) -> DeveloperSession:
        """Restore a bound checkpoint into a fresh service instance."""
        if (
            not isinstance(expected_session_id, str)
            or not expected_session_id
            or expected_session_id != expected_session_id.strip()
        ):
            raise ResumeRejected("expected session authority is invalid")
        if not isinstance(checkpoint, CheckpointHandoff) or not checkpoint.verify():
            raise ResumeRejected("checkpoint content hash is invalid")
        if checkpoint.session_id != expected_session_id:
            raise ResumeRejected("checkpoint session authority mismatch")
        if baseline_hash != checkpoint.baseline_hash:
            raise ResumeRejected("checkpoint baseline drift detected")
        if context_snapshot_hash != checkpoint.context_snapshot_hash:
            raise ResumeRejected("checkpoint context drift detected")
        validation = validate_packet(
            packet,
            baseline_hash=baseline_hash,
            context_snapshot_hash=context_snapshot_hash,
            parent_permission_snapshot=parent_permission_snapshot,
            parent_egress_profile=parent_egress_profile,
        )
        if not validation.valid:
            raise ResumeRejected("checkpoint identity cannot be validated")
        candidate = packet if isinstance(packet, DelegationPacket) else DelegationPacket.from_dict(packet)
        if candidate.packet_hash != checkpoint.packet_hash:
            raise ResumeRejected("checkpoint identity drift detected")
        if candidate.delegation_id != checkpoint.delegation_id:
            raise ResumeRejected("checkpoint identity drift detected")
        operation = self._runner_operation("restore", require_idempotency=True)
        restore_payload = {
            "session_id": expected_session_id,
            "checkpoint_hash": checkpoint.checkpoint_hash,
            "packet_hash": candidate.packet_hash,
            "resume_epoch": checkpoint.resume_epoch,
        }
        restore_fingerprint = self._command_fingerprint("RESTORE", restore_payload)
        restore_key = self._command_key("RESTORE", restore_fingerprint, idempotency_key)
        with self._lock:
            existing = self._restore_commands.get(restore_key)
            if existing is not None:
                if existing[0] != restore_fingerprint:
                    raise InvalidLifecycleTransition(
                        "restore idempotency key was used for a different checkpoint"
                    )
                if existing[1] == "IN_FLIGHT":
                    raise InvalidLifecycleTransition("restore delivery is already in flight")
                if existing[1] == "OUTCOME_UNKNOWN":
                    raise InvalidLifecycleTransition(
                        "restore outcome unknown; reconcile or manual outcome is required"
                    )
                if existing[1] == "DELIVERED" and expected_session_id in self._sessions:
                    return self._require(expected_session_id)
                raise InvalidLifecycleTransition("checkpoint is already restored")
            self._assert_admission_available()
            if self._sessions:
                raise InvalidLifecycleTransition("restore requires a fresh service instance")
            self._restore_commands[restore_key] = (
                restore_fingerprint, "IN_FLIGHT", "RESTORE",
                _freeze(restore_payload),
            )
            self._restore_contexts[restore_key] = (
                candidate, checkpoint, baseline_hash, context_snapshot_hash,
            )
            self._admission = ("RESTORE", restore_key)
        try:
            operation(
                expected_session_id, candidate, checkpoint,
                idempotency_key=restore_key,
            )
        except Exception:
            with self._lock:
                self._restore_commands[restore_key] = (
                    restore_fingerprint, "OUTCOME_UNKNOWN", "RESTORE",
                    _freeze(restore_payload),
                )
            raise
        with self._lock:
            if self._sessions:
                self._restore_commands[restore_key] = (
                    restore_fingerprint, "OUTCOME_UNKNOWN", "RESTORE",
                    _freeze(restore_payload),
                )
                raise InvalidLifecycleTransition("restore raced with another service session")
            return self._install_restored_session(
                restore_key, restore_fingerprint, candidate, checkpoint,
                baseline_hash, context_snapshot_hash, restore_payload,
            )

    def reconcile_restore_outcome(
        self,
        *,
        expected_session_id: str,
        checkpoint_hash: str,
        idempotency_key: str,
        outcome: str,
        receipt: Mapping[str, Any] | None = None,
    ) -> DeveloperSession | None:
        """Resolve an ambiguous RESTORE before a service session exists."""
        if outcome not in {"RESOLVED_SUCCESS", "SAFE_RETRY"}:
            raise ValueError("restore outcome must be RESOLVED_SUCCESS or SAFE_RETRY")
        with self._lock:
            record = self._restore_commands.get(idempotency_key)
            if (
                record is None or record[1] != "OUTCOME_UNKNOWN"
                or record[2] != "RESTORE"
                or record[3].get("session_id") != expected_session_id
                or record[3].get("checkpoint_hash") != checkpoint_hash
            ):
                raise InvalidLifecycleTransition(
                    "restore outcome is not awaiting reconciliation"
                )
            if outcome == "SAFE_RETRY":
                self._restore_commands.pop(idempotency_key)
                self._restore_contexts.pop(idempotency_key, None)
                self._admission = None
                return None
            expected_receipt = {
                "operation": "RESTORE",
                "outcome": "DELIVERED",
                "session_id": expected_session_id,
                "checkpoint_hash": checkpoint_hash,
                "idempotency_key": idempotency_key,
            }
            if not isinstance(receipt, Mapping) or dict(receipt) != expected_receipt:
                raise InvalidLifecycleTransition(
                    "RESOLVED_SUCCESS requires the exact canonical restore receipt"
                )
            try:
                candidate, checkpoint, baseline_hash, context_snapshot_hash = (
                    self._restore_contexts[idempotency_key]
                )
            except KeyError as error:
                raise InvalidLifecycleTransition(
                    "restore reconciliation context is unavailable"
                ) from error
            if self._sessions:
                raise InvalidLifecycleTransition(
                    "restore reconciliation requires a fresh service instance"
                )
            return self._install_restored_session(
                idempotency_key, record[0], candidate, checkpoint,
                baseline_hash, context_snapshot_hash, record[3],
            )

    def _install_restored_session(
        self,
        restore_key: str,
        restore_fingerprint: str,
        candidate: DelegationPacket,
        checkpoint: CheckpointHandoff,
        baseline_hash: str,
        context_snapshot_hash: str,
        restore_payload: Mapping[str, Any],
    ) -> DeveloperSession:
        session = DeveloperSession(
            checkpoint.session_id,
            checkpoint.delegation_id,
            checkpoint.packet_hash,
            LifecycleStatus.PAUSED,
            checkpoint=checkpoint,
            resume_epoch=checkpoint.resume_epoch,
            current_action="CHECKPOINT_PAUSE",
            state_version=checkpoint.state_version,
        )
        self._sessions[checkpoint.session_id] = session
        self._packets[checkpoint.session_id] = candidate
        self._bindings[checkpoint.session_id] = (
            candidate.packet_hash, baseline_hash, context_snapshot_hash,
        )
        self._commands[checkpoint.session_id] = {
            key: (
                fingerprint, "DELIVERED", "RESTORED_HISTORY",
                MappingProxyType({}),
            )
            for key, fingerprint in checkpoint.delivered_commands.items()
        }
        self._commands[checkpoint.session_id][restore_key] = (
            restore_fingerprint, "DELIVERED", "RESTORE", MappingProxyType({}),
        )
        self._command_generations[checkpoint.session_id] = {}
        self._command_resolutions.pop(checkpoint.session_id, None)
        self._restore_commands[restore_key] = (
            restore_fingerprint, "DELIVERED", "RESTORE",
            _freeze(dict(restore_payload)),
        )
        self._restore_contexts.pop(restore_key, None)
        self._admission = None
        return session

    def _assert_admission_available(self) -> None:
        """Check the shared start/restore reservation while holding the lock."""
        if self._admission is None:
            return
        operation, key = self._admission
        if operation == "RESTORE":
            record = self._restore_commands[key]
            detail = "outcome unknown" if record[1] == "OUTCOME_UNKNOWN" else "in flight"
            raise InvalidLifecycleTransition(
                f"restore {detail}; reconcile or manual outcome is required"
            )
        raise InvalidLifecycleTransition("developer session admission is already in flight")

    def current(self, session_id: str) -> LifecycleProjection:
        with self._lock:
            current = self._require(session_id)
            next_instruction = self._next_instruction_reference(session_id, current)
            return LifecycleProjection(
                current.session_id, current.delegation_id, current.packet_hash,
                current.status, next_instruction, current.checkpoint,
                current.resume_epoch, current.state_version,
            )

    def session(self, session_id: str) -> DeveloperSession:
        with self._lock:
            return self._require(session_id)

    def handoff(self, session_id: str) -> CheckpointHandoff | None:
        with self._lock:
            return self._require(session_id).checkpoint

    def handoff_projection(self, session_id: str) -> ResultHandoffProjection:
        with self._lock:
            current = self._require(session_id)
            return ResultHandoffProjection(
                current.session_id,
                current.delegation_id,
                current.status,
                current.checkpoint,
                current.raw_result,
            )

    def workbench(self, session_id: str) -> WorkbenchProjection:
        with self._lock:
            current = self._require(session_id)
            packet = self._packets[session_id]
            allowed = {
                LifecycleStatus.RUNNING: ("STEER", "CHECKPOINT_PAUSE", "STOP"),
                LifecycleStatus.PAUSED: ("RESUME", "STOP"),
                LifecycleStatus.STOP_REQUESTED: ("STOP",),
            }.get(current.status, ())
            if session_id in self._stop_delivered:
                allowed = tuple(command for command in allowed if command != "STOP")
            unknown_operations = tuple(sorted({
                operation for _, state, operation, _ in self._commands[session_id].values()
                if state == "OUTCOME_UNKNOWN"
            }))
            blocked_commands = {
                "STEER": "STEER", "CHECKPOINT_PAUSE": "CHECKPOINT_PAUSE",
                "RESUME": "RESUME", "STOP": "STOP",
            }
            unresolved_operations = tuple(sorted({
                operation for _, state, operation, _ in self._commands[session_id].values()
                if state != "DELIVERED"
            }))
            blocked = {blocked_commands.get(operation) for operation in unresolved_operations}
            if unresolved_operations:
                blocked.add("CHECKPOINT_PAUSE")
            if "CHECKPOINT_PAUSE" in unresolved_operations:
                blocked.add("RESUME")
            allowed = tuple(
                command for command in allowed
                if command not in blocked
            )
            permission = MappingProxyType({
                "profile_id": _public_text(packet.permission_profile_id),
                "allowed_paths": _public_texts(packet.permission_snapshot.allowed_paths),
                "allowed_actions": _public_texts(packet.permission_snapshot.allowed_actions),
                "allowed_tools": _public_texts(packet.permission_snapshot.allowed_tools),
                "allowed_backends": _public_texts(packet.permission_snapshot.allowed_backends),
                "prohibited_paths": _public_texts(packet.permission_snapshot.prohibited_paths),
                "protected_paths": _public_texts(packet.permission_snapshot.protected_paths),
                "prohibited_actions": _public_texts(packet.permission_snapshot.prohibited_actions),
            })
            resolution = self._command_resolutions.get(session_id)
            command_status = (
                MappingProxyType({
                    "status": "OUTCOME_UNKNOWN",
                    "operations": unknown_operations,
                    "resolution": "SERVICE_LEVEL_MANUAL_OUTCOME_REQUIRED",
                })
                if unknown_operations else resolution or MappingProxyType({
                    "status": "READY", "operations": (), "resolution": None,
                })
            )
            return WorkbenchProjection(
                role="developer",
                objective=_artifact_reference(
                    packet.objective,
                    packet_hash=packet.packet_hash,
                    json_pointer="/objective",
                ),
                in_scope=tuple(
                    _artifact_reference(
                        value,
                        packet_hash=packet.packet_hash,
                        json_pointer=f"/in_scope/{index}",
                        index=index,
                    )
                    for index, value in enumerate(packet.in_scope)
                ),
                out_of_scope=tuple(
                    _artifact_reference(
                        value,
                        packet_hash=packet.packet_hash,
                        json_pointer=f"/out_of_scope/{index}",
                        index=index,
                    )
                    for index, value in enumerate(packet.out_of_scope)
                ),
                permission=permission,
                budget=MappingProxyType({
                    "status": "REFERENCE_ONLY",
                    "reference": _public_text(packet.budget_ref),
                }),
                cost_usage=MappingProxyType({
                    "status": "UNKNOWN",
                    "cost": None, "input_tokens": None,
                    "output_tokens": None, "total_tokens": None,
                }),
                status=current.status,
                current_action=current.current_action,
                checkpoint=current.checkpoint,
                evidence=tuple(
                    _artifact_reference(
                        value,
                        packet_hash=packet.packet_hash,
                        json_pointer=f"/required_evidence/{index}",
                        index=index,
                    )
                    for index, value in enumerate(packet.required_evidence)
                ),
                allowed_commands=allowed,
                command_status=command_status,
                stop_authority=MappingProxyType({
                    "status": "NOT_BOUND",
                    "actor": None,
                    "allowed": None,
                }),
                state_version=current.state_version,
            )

    def _next_instruction_reference(
        self, session_id: str, current: DeveloperSession,
    ) -> Mapping[str, Any] | None:
        if current.next_instruction is None:
            return None
        for fingerprint, state, operation, payload in reversed(
            tuple(self._commands[session_id].values())
        ):
            if (
                state == "DELIVERED" and operation == "STEER"
                and payload.get("instruction") == current.next_instruction
            ):
                return _command_artifact_reference(
                    current.next_instruction, fingerprint,
                )
        raise InvalidLifecycleTransition(
            "next instruction has no canonical command artifact"
        )

    def reconcile_command_outcome(
        self,
        session_id: str,
        operation: str,
        idempotency_key: str,
        *,
        outcome: str,
        checkpoint: CheckpointHandoff | None = None,
    ) -> DeveloperSession:
        """Resolve an ambiguous runner acknowledgement at service level only."""
        if outcome not in {"RESOLVED_SUCCESS", "SAFE_RETRY"}:
            raise ValueError("manual outcome must be RESOLVED_SUCCESS or SAFE_RETRY")
        if not isinstance(operation, str) or not operation or operation != operation.strip():
            raise ValueError("operation must be a canonical non-empty string")
        with self._lock:
            current = self._require(session_id)
            records = self._commands[session_id]
            record = records.get(idempotency_key)
            if record is None or record[1] != "OUTCOME_UNKNOWN" or record[2] != operation:
                raise InvalidLifecycleTransition("command outcome is not awaiting reconciliation")
            if outcome == "RESOLVED_SUCCESS":
                current = self._apply_reconciled_effect(
                    current, operation, record[3], checkpoint=checkpoint,
                    idempotency_key=idempotency_key,
                    command_fingerprint=record[0],
                )
                records[idempotency_key] = (
                    record[0], "DELIVERED", operation, record[3],
                )
            else:
                records.pop(idempotency_key)
                current = self._replace(
                    current,
                    current_action=(
                        current.current_action
                        if self._has_authoritative_status(current.status)
                        else f"{operation}_{outcome}"
                    ),
                    state_version=current.state_version + 1,
                )
            self._command_resolutions[session_id] = MappingProxyType({
                "status": "RECONCILED",
                "operations": (operation,),
                "resolution": outcome,
            })
            self._sessions[session_id] = current
            return current

    def _apply_reconciled_effect(
        self,
        current: DeveloperSession,
        operation: str,
        payload: Mapping[str, Any],
        *,
        checkpoint: CheckpointHandoff | None,
        idempotency_key: str,
        command_fingerprint: str,
    ) -> DeveloperSession:
        values = _thaw(payload)
        version = current.state_version + 1
        if operation == "STEER":
            instruction = values.get("instruction")
            if not isinstance(instruction, str) or not instruction:
                raise InvalidLifecycleTransition("stored steer payload is invalid")
            return self._replace(
                current, next_instruction=instruction,
                current_action=(
                    current.current_action
                    if self._has_authoritative_status(current.status)
                    else "STEER_RESOLVED_SUCCESS"
                ),
                state_version=version,
            )
        if operation == "RESUME":
            expected = values.get("expected_resume_epoch")
            packet_hash = values.get("packet_hash")
            if packet_hash != current.packet_hash or expected != current.resume_epoch:
                raise InvalidLifecycleTransition("stored resume authority is stale")
            if current.checkpoint is None or not current.checkpoint.verify():
                raise InvalidLifecycleTransition("stored resume checkpoint is unavailable")
            status = current.status
            if status is LifecycleStatus.PAUSED:
                status = (
                    current.raw_result.status
                    if current.raw_result is not None else LifecycleStatus.RUNNING
                )
            elif status not in {
                LifecycleStatus.STOP_REQUESTED, LifecycleStatus.COMPLETED,
                LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
            }:
                raise InvalidLifecycleTransition("stored resume effect cannot be projected")
            return self._replace(
                current, status=status, resume_epoch=current.resume_epoch + 1,
                current_action=(
                    current.current_action
                    if self._has_authoritative_status(status)
                    else "RESUME_RESOLVED_SUCCESS"
                ),
                state_version=version,
            )
        if operation == "STOP":
            if current.status not in {
                LifecycleStatus.STOP_REQUESTED, LifecycleStatus.STOPPED,
                LifecycleStatus.COMPLETED, LifecycleStatus.FAILED,
            }:
                raise InvalidLifecycleTransition("stored stop effect cannot be projected")
            self._stop_delivered.add(current.session_id)
            return self._replace(
                current, current_action=(
                    current.current_action
                    if current.status in {
                        LifecycleStatus.COMPLETED, LifecycleStatus.STOPPED,
                        LifecycleStatus.FAILED,
                    }
                    else "STOP_RESOLVED_SUCCESS"
                ),
                state_version=version,
            )
        if operation == "CHECKPOINT_PAUSE":
            if checkpoint is None:
                raise InvalidLifecycleTransition(
                    "CHECKPOINT_PAUSE RESOLVED_SUCCESS requires a canonical checkpoint receipt"
                )
            if not checkpoint.verify():
                raise InvalidLifecycleTransition("canonical checkpoint receipt hash is invalid")
            _, baseline_hash, context_snapshot_hash = self._bindings[current.session_id]
            if (
                checkpoint.session_id != current.session_id
                or checkpoint.delegation_id != current.delegation_id
                or checkpoint.packet_hash != current.packet_hash
                or checkpoint.baseline_hash != baseline_hash
                or checkpoint.context_snapshot_hash != context_snapshot_hash
                or checkpoint.resume_epoch != current.resume_epoch
            ):
                raise InvalidLifecycleTransition("canonical checkpoint receipt authority mismatch")
            expected_history = {
                key: fingerprint
                for key, (fingerprint, state, _, _) in self._commands[current.session_id].items()
                if state == "DELIVERED"
            }
            expected_history[idempotency_key] = command_fingerprint
            if dict(checkpoint.delivered_commands) != expected_history:
                raise InvalidLifecycleTransition(
                    "canonical checkpoint receipt command history mismatch"
                )
            reconciled_checkpoint = CheckpointHandoff.create(
                checkpoint_id=checkpoint.checkpoint_id,
                state=checkpoint.to_dict()["state"],
                session_id=current.session_id,
                delegation_id=current.delegation_id,
                packet_hash=current.packet_hash,
                baseline_hash=baseline_hash,
                context_snapshot_hash=context_snapshot_hash,
                resume_epoch=current.resume_epoch,
                delivered_commands=checkpoint.delivered_commands,
                state_version=version,
            )
            status = (
                current.status
                if current.status in {
                    LifecycleStatus.STOP_REQUESTED, LifecycleStatus.COMPLETED,
                    LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
                }
                else LifecycleStatus.PAUSED
            )
            return self._replace(
                current, status=status, checkpoint=reconciled_checkpoint,
                current_action=(
                    current.current_action
                    if self._has_authoritative_status(status)
                    else "CHECKPOINT_PAUSE_RESOLVED_SUCCESS"
                ),
                state_version=version,
            )
        raise InvalidLifecycleTransition("unknown command operation cannot be reconciled")

    @staticmethod
    def _has_authoritative_status(status: LifecycleStatus) -> bool:
        return status in {
            LifecycleStatus.STOP_REQUESTED, LifecycleStatus.COMPLETED,
            LifecycleStatus.STOPPED, LifecycleStatus.FAILED,
        }

    def session_id_for_delegation(self, delegation_id: str) -> str:
        with self._lock:
            matches = [
                session_id for session_id, session in self._sessions.items()
                if session.delegation_id == delegation_id
            ]
            if len(matches) != 1:
                raise KeyError(f"unknown developer delegation: {delegation_id}")
            return matches[0]

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

    @staticmethod
    def _command_fingerprint(operation: str, payload: Mapping[str, Any]) -> str:
        content = _canonical_json_bytes({"operation": operation, "payload": dict(payload)})
        return "sha256:" + hashlib.sha256(content).hexdigest()

    @staticmethod
    def _command_key(
        operation: str, fingerprint: str, idempotency_key: str | None,
    ) -> str:
        if idempotency_key is None:
            return f"legacy-{operation.lower()}-{fingerprint[7:23]}"
        if (
            type(idempotency_key) is not str
            or not idempotency_key
            or idempotency_key != idempotency_key.strip()
            or len(idempotency_key) > 128
        ):
            raise ValueError("idempotency key must be a canonical non-empty string")
        return idempotency_key

    def _prepare_command(
        self,
        session_id: str,
        operation: str,
        payload: Mapping[str, Any],
        idempotency_key: str | None,
        *,
        allow_legacy_in_flight_replay: bool = False,
        reserve: bool = True,
        exclusive: bool = False,
    ) -> tuple[str, str, bool]:
        fingerprint = self._command_fingerprint(operation, payload)
        key = self._command_key(operation, fingerprint, idempotency_key)
        records = self._commands[session_id]
        existing = records.get(key)
        if existing is not None:
            if existing[0] != fingerprint:
                raise InvalidLifecycleTransition(
                    "idempotency key was already used for a different command",
                )
            if existing[1] == "DELIVERED":
                return key, fingerprint, False
            if existing[1] == "IN_FLIGHT" and allow_legacy_in_flight_replay:
                return key, fingerprint, False
            if existing[1] == "IN_FLIGHT":
                raise InvalidLifecycleTransition("command delivery is already in flight")
            raise InvalidLifecycleTransition(
                "command delivery outcome unknown; reconcile or manual outcome is required"
            )
        if exclusive and operation != "STOP" and any(
            state == "IN_FLIGHT" for _, state, _, _ in records.values()
        ):
            raise InvalidLifecycleTransition(
                "another lifecycle command delivery is already in flight"
            )
        unresolved_same_operation = tuple(
            state
            for _, state, recorded_operation, _ in records.values()
            if recorded_operation == operation and state != "DELIVERED"
        )
        if "OUTCOME_UNKNOWN" in unresolved_same_operation:
            raise InvalidLifecycleTransition(
                f"{operation} outcome unknown; reconcile or manual outcome is required"
            )
        if "IN_FLIGHT" in unresolved_same_operation:
            raise InvalidLifecycleTransition(f"{operation} command delivery is already in flight")
        if reserve:
            self._reserve_command(session_id, key, fingerprint, operation, payload)
        return key, fingerprint, True

    def _reserve_command(
        self, session_id: str, key: str, fingerprint: str, operation: str,
        payload: Mapping[str, Any],
    ) -> int:
        records = self._commands[session_id]
        if key in records:
            raise InvalidLifecycleTransition("command reservation raced with another owner")
        records[key] = (
            fingerprint, "IN_FLIGHT", operation,
            _freeze(dict(payload)),
        )
        self._command_resolutions.pop(session_id, None)
        self._next_command_generation += 1
        generation = self._next_command_generation
        self._command_generations[session_id][key] = generation
        return generation

    @staticmethod
    def _assert_mutation_preconditions(
        current: DeveloperSession,
        *,
        target_hash: str | None,
        expected_state_version: int | None,
    ) -> None:
        if target_hash is None and expected_state_version is None:
            return
        if target_hash != current.packet_hash:
            raise LifecycleTargetMismatch(
                "delegation target hash does not match the current packet"
            )
        if (
            type(expected_state_version) is not int
            or expected_state_version != current.state_version
        ):
            raise LifecycleVersionMismatch(
                "delegation state version is stale or invalid"
            )

    def _complete_command(self, session_id: str, key: str, fingerprint: str) -> None:
        _, _, operation, payload = self._commands[session_id][key]
        self._commands[session_id][key] = (
            fingerprint, "DELIVERED", operation, payload,
        )

    def _unknown_command(self, session_id: str, key: str, fingerprint: str) -> None:
        _, _, operation, payload = self._commands[session_id][key]
        self._commands[session_id][key] = (
            fingerprint, "OUTCOME_UNKNOWN", operation, payload,
        )
        current = self._require(session_id)
        action = f"{operation}_OUTCOME_UNKNOWN"
        if (
            operation != "STOP"
            and current.status in {
                LifecycleStatus.STOP_REQUESTED,
                LifecycleStatus.COMPLETED,
                LifecycleStatus.STOPPED,
                LifecycleStatus.FAILED,
            }
        ):
            # The acknowledgement remains unresolved in the command ledger,
            # but a later human stop/terminal observation owns the visible
            # lifecycle action and must not be overwritten by this rollback.
            action = current.current_action
        self._sessions[session_id] = self._replace(
            current,
            current_action=action,
            state_version=current.state_version + 1,
        )

    def _retry_legacy_command(self, session_id: str, key: str, fingerprint: str) -> None:
        existing = self._commands[session_id].get(key)
        if existing is not None and existing[:2] == (fingerprint, "IN_FLIGHT"):
            self._commands[session_id].pop(key)

    def _runner_operation(
        self,
        method: str,
        *,
        require_idempotency: bool,
        require_reason: bool = False,
    ) -> Any:
        operation = getattr(self._runner, method, None)
        if not callable(operation):
            raise InvalidLifecycleTransition(
                f"runner does not support the {method} capability",
            )
        parameters = inspect.signature(operation).parameters.values()
        names = {parameter.name for parameter in parameters}
        accepts_kwargs = any(
            parameter.kind is inspect.Parameter.VAR_KEYWORD
            for parameter in parameters
        )
        if require_idempotency and "idempotency_key" not in names and not accepts_kwargs:
            raise InvalidLifecycleTransition(
                f"runner {method} capability must accept an idempotency key",
            )
        if require_reason and "reason" not in names and not accepts_kwargs:
            raise InvalidLifecycleTransition(
                f"runner {method} capability must accept the canonical reason",
            )
        return operation

    def _deliver_runner(
        self, method: str, *args: Any, idempotency_key: str,
        require_idempotency: bool = True,
        reason: str | None = None,
    ) -> Any:
        operation = self._runner_operation(
            method,
            require_idempotency=require_idempotency,
            require_reason=reason is not None and require_idempotency,
        )
        if not require_idempotency:
            return operation(*args)
        if reason is None:
            return operation(*args, idempotency_key=idempotency_key)
        return operation(*args, idempotency_key=idempotency_key, reason=reason)

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
            changes.get("current_action", session.current_action),
            changes.get("state_version", session.state_version),
        )


ReadOnlyDeveloperRunner = DeterministicFakeDeveloperRunner
RawResult = RawResultEnvelope

__all__ = [
    "LifecycleStatus", "LifecycleError", "PacketRejected", "InvalidLifecycleTransition", "LifecycleTargetMismatch", "LifecycleVersionMismatch",
    "ReadOnlyPolicyRejected", "ResumeRejected", "RawResultArtifact", "RawResultEnvelope", "RawResult", "CheckpointHandoff", "DeveloperSession", "LifecycleProjection", "ResultHandoffProjection", "WorkbenchProjection",
    "DeveloperRunner", "DeterministicFakeDeveloperRunner", "ReadOnlyDeveloperRunner",
    "DeveloperLifecycleService", "ReadOnlyPolicy",
]
