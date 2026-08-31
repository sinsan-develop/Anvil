"""Fail-closed, read-only repository file gateway."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import hashlib
import os
from typing import Any
from threading import RLock


class ToolGatewayRejected(PermissionError):
    pass


class ToolPermissionRegistry:
    """In-memory tool grants with fail-closed, idempotent revocation."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._grants: dict[str, frozenset[str]] = {}

    def grant(self, run_id: str, tools: set[str] | frozenset[str] | tuple[str, ...]) -> None:
        if not isinstance(run_id, str) or not run_id.strip():
            raise ToolGatewayRejected("run_id must be non-empty")
        normalized = frozenset(tools)
        if any(not isinstance(item, str) or not item.strip() for item in normalized):
            raise ToolGatewayRejected("tool names must be non-empty strings")
        with self._lock:
            self._grants[run_id] = normalized

    def require(self, run_id: str, tool: str) -> None:
        with self._lock:
            if tool not in self._grants.get(run_id, frozenset()):
                raise ToolGatewayRejected("tool permission is not active")

    def revoke(self, run_id: str) -> frozenset[str]:
        with self._lock:
            return self._grants.pop(run_id, frozenset())

    def active(self, run_id: str | None = None) -> dict[str, frozenset[str]]:
        with self._lock:
            if run_id is None:
                return dict(self._grants)
            return {run_id: self._grants[run_id]} if run_id in self._grants else {}


def _inside(root: Path, target: Path) -> bool:
    try:
        return os.path.commonpath((os.path.realpath(root), os.path.realpath(target))) == os.path.realpath(root)
    except ValueError:
        return False


@dataclass(frozen=True, slots=True)
class ToolReceipt:
    operation: str
    path: str
    result: Any
    read_only: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {"operation": self.operation, "path": self.path, "result": self.result,
                "read_only": self.read_only}


class ReadToolGateway:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve(strict=True)
        if not self.root.is_dir():
            raise ToolGatewayRejected("gateway root must be a directory")

    def _target(self, relative: str) -> Path:
        if not isinstance(relative, str) or not relative or relative.startswith(("/", "~")) or "\\" in relative or "\x00" in relative:
            raise ToolGatewayRejected("path must be a relative POSIX path")
        parts = Path(relative).parts
        if ".." in parts:
            raise ToolGatewayRejected("path traversal is not allowed")
        lexical = self.root.joinpath(*parts)
        if any(part.is_symlink() for part in (self.root / Path(relative)).parents if part != self.root):
            raise ToolGatewayRejected("symlink traversal is not allowed")
        if lexical.is_symlink():
            raise ToolGatewayRejected("symlink traversal is not allowed")
        target = lexical.resolve(strict=True)
        if not _inside(self.root, target):
            raise ToolGatewayRejected("path escapes gateway root")
        return target

    def list_files(self, relative: str = ".") -> ToolReceipt:
        target = self._target(relative)
        if not target.is_dir():
            raise ToolGatewayRejected("list target must be a directory")
        entries = []
        for item in sorted(target.iterdir(), key=lambda p: p.as_posix()):
            if item.is_symlink():
                raise ToolGatewayRejected("symlink traversal is not allowed")
            entries.append(item.relative_to(self.root).as_posix())
        return ToolReceipt("list-files", relative, tuple(entries))

    def metadata(self, relative: str) -> ToolReceipt:
        target = self._target(relative)
        if target.is_symlink():
            raise ToolGatewayRejected("symlink traversal is not allowed")
        stat = target.stat()
        return ToolReceipt("metadata", relative, {"kind": "directory" if target.is_dir() else "file",
            "size": stat.st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None})
