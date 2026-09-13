"""Canonical C-09 read tools and C-13 compatible atomic permission fence."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
from threading import RLock
from typing import Callable, TypeVar

from packages.execution_backends.models import canonical_bytes, thaw
from .models import ToolDefinition, ToolGatewayRejected

_BACKENDS = ("git-worktree", "docker")
_OUTPUT = {"type": "string"}


def _object(properties=None, required=()):
    return {"type": "object", "properties": properties or {},
            "required": list(required), "additionalProperties": False}


_CANONICAL = {
    "repo.status": _object(),
    "git.diff": _object(),
    "repo.read_file": _object({"path": {"type": "string", "minLength": 1, "maxLength": 1024}}, ("path",)),
    "repo.search": _object({"query": {"type": "string", "minLength": 1, "maxLength": 512}}, ("query",)),
    "repo.symbols": _object({"path": {"type": "string", "minLength": 1, "maxLength": 1024}}),
}


def _definition(name: str) -> ToolDefinition:
    return ToolDefinition(name, "anvil", "1.0.0", _CANONICAL[name], _OUTPUT,
                          "repository.read", "none", "low", _BACKENDS)


@dataclass(frozen=True, slots=True)
class ToolReservation:
    session_id: str
    tool_name: str
    generation: int
    reservation_id: int


T = TypeVar("T")


class ToolPermissionRegistry:
    def __init__(self) -> None:
        self._lock = RLock()
        self._grants: dict[str, frozenset[str]] = {}
        self._generation: dict[str, int] = {}
        self._reservation_serial = 0
        self._reservations: dict[int, tuple[str, str]] = {}

    def grant(self, run_id: str, tools) -> None:
        if not isinstance(run_id, str) or not run_id.strip(): raise ToolGatewayRejected("INVALID_SESSION_ID")
        normalized = frozenset(tools)
        if any(not isinstance(item, str) or not item.strip() for item in normalized):
            raise ToolGatewayRejected("INVALID_TOOL_NAME")
        with self._lock:
            self._generation[run_id] = self._generation.get(run_id, 0) + 1
            self._grants[run_id] = normalized

    def require(self, run_id: str, tool: str) -> None:
        with self._lock:
            if tool not in self._grants.get(run_id, frozenset()):
                raise ToolGatewayRejected("TOOL_PERMISSION_DENIED", "tool permission is not active")

    def reserve(self, session_id: str, tool: str) -> ToolReservation:
        with self._lock:
            self.require(session_id, tool)
            self._reservation_serial += 1
            reservation = ToolReservation(session_id, tool, self._generation.get(session_id, 0),
                                          self._reservation_serial)
            self._reservations[reservation.reservation_id] = (session_id, "PENDING")
            return reservation

    def authorize_io(self, reservation: ToolReservation, mark_io: Callable[[], None]) -> None:
        with self._lock:
            if (self._reservations.get(reservation.reservation_id) != (reservation.session_id, "PENDING") or
                    reservation.generation != self._generation.get(reservation.session_id, 0) or
                    reservation.tool_name not in self._grants.get(reservation.session_id, frozenset())):
                self._reservations.pop(reservation.reservation_id, None)
                raise ToolGatewayRejected("TOOL_PERMISSION_DENIED")
            self._reservations.pop(reservation.reservation_id, None)
            mark_io()

    def dispatch_reserved(self, reservation: ToolReservation, operation: Callable[[], T]) -> T:
        self.authorize_io(reservation, lambda: None)
        return operation()

    def revoke(self, run_id: str) -> frozenset[str]:
        with self._lock:
            prior = self._grants.pop(run_id, frozenset())
            self._generation[run_id] = self._generation.get(run_id, 0) + 1
            for reservation_id, (session_id, state) in tuple(self._reservations.items()):
                if session_id == run_id and state == "PENDING":
                    self._reservations.pop(reservation_id, None)
            return prior

    def active(self, run_id: str | None = None) -> dict[str, frozenset[str]]:
        with self._lock:
            if run_id is None: return dict(self._grants)
            return {run_id: self._grants[run_id]} if run_id in self._grants else {}


class ToolDefinitionRegistry:
    def __init__(self, definitions=None) -> None:
        self._definitions: dict[str, ToolDefinition] = {}
        for definition in definitions or tuple(_definition(name) for name in sorted(_CANONICAL)):
            self.register(definition)

    @property
    def names(self): return tuple(sorted(self._definitions))

    @property
    def definitions(self): return tuple(self._definitions[name] for name in self.names)

    @property
    def manifest_sha256(self) -> str:
        payload = [{
            "name": item.name, "provider": item.provider, "version": item.version,
            "input_schema": thaw(item.input_schema), "output_schema": thaw(item.output_schema),
            "capability": item.capability, "side_effect": item.side_effect,
            "risk": item.risk, "supported_backends": item.supported_backends,
        } for item in self.definitions]
        return hashlib.sha256(canonical_bytes(payload)).hexdigest()

    def validate_definition(self, definition: ToolDefinition) -> None:
        canonical = _definition(definition.name) if definition.name in _CANONICAL else None
        if canonical is None or definition != canonical:
            raise ToolGatewayRejected("INVALID_TOOL_DEFINITION")

    def register(self, definition: ToolDefinition) -> None:
        if definition.name in self._definitions: raise ToolGatewayRejected("INVALID_TOOL_DEFINITION")
        self.validate_definition(definition)
        self._definitions[definition.name] = definition

    def require(self, name: str, backend_id: str) -> ToolDefinition:
        definition = self._definitions.get(name)
        if definition is None: raise ToolGatewayRejected("UNKNOWN_TOOL")
        if backend_id not in definition.supported_backends: raise ToolGatewayRejected("BACKEND_NOT_SUPPORTED")
        return definition


__all__ = ["ToolDefinitionRegistry", "ToolPermissionRegistry", "ToolReservation"]
