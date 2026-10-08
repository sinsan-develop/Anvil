"""Stable repository and cross-backend path identities.

The legacy :func:`conflict_scope_key` signature is intentionally retained for
B-09 callers.  C-09 callers use :class:`RepositoryIdentity`, where the stable
identifier is never inferred from a host path or remote URL.
"""
from __future__ import annotations

from dataclasses import dataclass
import os
import posixpath
import re
from pathlib import Path
from threading import RLock

from packages.domain.identifiers import validate_operational_identifier

_MNT_DRIVE = re.compile(r"^/mnt/([a-zA-Z])(?:/|$)")
_DRIVE = re.compile(r"^([a-zA-Z]):(?:/|$)")
_DEVICE = re.compile(r"^(?:\\\\[.?]\\|//[.?]/)")


def _normalise(path: str, *, case_policy: str) -> str:
    if not isinstance(path, str) or not path.strip() or "\x00" in path:
        raise ValueError("path must be a non-empty string")
    value = path.replace("\\", "/")
    if value.startswith("//") or _DEVICE.match(path):
        raise ValueError("UNC and device paths are not supported")
    matched = _MNT_DRIVE.match(value)
    if matched:
        value = f"{matched.group(1)}:" + value[6:]
    value = posixpath.normpath(value)
    if re.fullmatch(r"[a-zA-Z]:", value):
        value += "/"
    if case_policy == "INSENSITIVE":
        value = value.casefold()
    if re.fullmatch(r"[a-zA-Z]:/", value):
        return value
    return value.rstrip("/") or "/"


def _resolve_deepest(path: str) -> str:
    """Resolve existing aliases while preserving a safe missing suffix."""
    # A drive-qualified Windows path is virtual on POSIX hosts.  A real
    # /mnt/<drive> input is not: it must pass the filesystem link checks below
    # before being mapped to that same drive namespace.
    if os.name != "nt" and _DRIVE.match(path.replace("\\", "/")):
        return _normalise(path, case_policy="SENSITIVE")
    candidate = Path(path)
    missing: list[str] = []
    cursor = candidate
    try:
        while not cursor.exists():
            if cursor.parent == cursor:
                return path
            if cursor.is_symlink():
                raise ValueError("broken link is not a valid path identity")
            missing.append(cursor.name)
            cursor = cursor.parent
        resolved = cursor.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ValueError("path identity cannot be resolved safely") from exc
    for part in reversed(missing):
        if part in {"", ".", ".."} or "/" in part or "\\" in part:
            raise ValueError("unsafe missing path suffix")
        resolved = resolved / part
    return resolved.as_posix()


def _relative(root: str, path: str, policy: str) -> str:
    root_lexical = _normalise(root, case_policy=policy)
    root_value = _normalise(_resolve_deepest(root_lexical), case_policy=policy)
    candidate_lexical = _normalise(path, case_policy=policy)
    absolute = bool(_DRIVE.match(candidate_lexical) or candidate_lexical.startswith("/"))
    if not absolute:
        candidate_lexical = _normalise(root_lexical + "/" + candidate_lexical, case_policy=policy)
    native_mounted_path = os.name != "nt" and _MNT_DRIVE.match(path.replace("\\", "/"))
    resolution_input = path.replace("\\", "/") if native_mounted_path else candidate_lexical
    candidate = _normalise(_resolve_deepest(resolution_input), case_policy=policy)
    prefix = root_value.rstrip("/") + "/"
    if candidate == root_value:
        return "."
    if not candidate.startswith(prefix):
        raise ValueError("path must remain within the repository")
    relative = candidate[len(prefix):]
    if relative == ".." or relative.startswith("../"):
        raise ValueError("path must remain within the repository")
    return relative


def _lexical_relative(root: str, path: str, policy: str) -> str:
    """Map a virtual/container namespace without consulting the host filesystem."""
    root_value = _normalise(root, case_policy=policy)
    candidate = _normalise(path, case_policy=policy)
    if not (_DRIVE.match(candidate) or candidate.startswith("/")):
        candidate = _normalise(root_value.rstrip("/") + "/" + candidate, case_policy=policy)
    prefix = root_value.rstrip("/") + "/"
    if candidate == root_value: return "."
    if not candidate.startswith(prefix): raise ValueError("path must remain within the mapping")
    relative = candidate[len(prefix):]
    if relative == ".." or relative.startswith("../"): raise ValueError("path must remain within the mapping")
    return relative


@dataclass(frozen=True, slots=True)
class RepositoryIdentity:
    repository_id: str
    source_root: str
    case_policy: str
    mapping_revision: str

    def __post_init__(self) -> None:
        validate_operational_identifier(self.repository_id, "repository_id")
        validate_operational_identifier(self.mapping_revision, "mapping_revision")
        if self.case_policy not in {"SENSITIVE", "INSENSITIVE"}:
            raise ValueError("case_policy must be SENSITIVE or INSENSITIVE")
        canonical = _normalise(_resolve_deepest(self.source_root), case_policy=self.case_policy)
        object.__setattr__(self, "source_root", canonical)

    def canonical_relative(self, path: str) -> str:
        return _relative(self.source_root, path, self.case_policy)

    def conflict_key(self, path: str) -> tuple[str, str, str]:
        return self.repository_id, self.canonical_relative(path), self.case_policy


@dataclass(frozen=True, slots=True)
class RepositoryPathMapping:
    identity: RepositoryIdentity
    workspace_id: str
    backend_id: str
    workspace_root: str
    container_root: str | None = None

    def __post_init__(self) -> None:
        validate_operational_identifier(self.workspace_id, "workspace_id")
        validate_operational_identifier(self.backend_id, "backend_id")
        workspace = _normalise(_resolve_deepest(self.workspace_root), case_policy=self.identity.case_policy)
        source = self.identity.source_root.rstrip("/")
        if workspace == source or workspace.startswith(source + "/") or source.startswith(workspace.rstrip("/") + "/"):
            raise ValueError("workspace and source roots must not overlap")
        object.__setattr__(self, "workspace_root", workspace)
        if self.container_root is not None:
            container = _normalise(self.container_root, case_policy="SENSITIVE")
            if not container.startswith("/") or container == "/":
                raise ValueError("container root must be an unambiguous absolute subdirectory")
            object.__setattr__(self, "container_root", container)

    def container_to_source(self, path: str) -> str:
        if self.container_root is None:
            raise ValueError("container mapping is not configured")
        relative = _lexical_relative(self.container_root, path, "SENSITIVE")
        source = self.identity.source_root.rstrip("/")
        return source if relative == "." else f"{source}/{relative}"

    def workspace_to_source(self, path: str) -> str:
        relative = _relative(self.workspace_root, path, self.identity.case_policy)
        source = self.identity.source_root.rstrip("/")
        return source if relative == "." else f"{source}/{relative}"


class RepositoryPathMappingRegistry:
    """Fail-closed registry for unique, non-overlapping physical workspaces."""
    def __init__(self) -> None:
        self._lock = RLock()
        self._mappings: dict[tuple[str, str, str], RepositoryPathMapping] = {}

    def register(self, mapping: RepositoryPathMapping) -> RepositoryPathMapping:
        key = (mapping.identity.repository_id, mapping.workspace_id, mapping.backend_id)
        with self._lock:
            prior = self._mappings.get(key)
            if prior is not None:
                if prior == mapping: return prior
                raise ValueError("mapping identity is already registered")
            root = _normalise(_resolve_deepest(mapping.workspace_root),
                              case_policy=mapping.identity.case_policy)
            for item in self._mappings.values():
                other = _normalise(_resolve_deepest(item.workspace_root),
                                   case_policy=item.identity.case_policy)
                if root == other or root.startswith(other.rstrip("/") + "/") or other.startswith(root.rstrip("/") + "/"):
                    raise ValueError("workspace mappings must not overlap")
            self._mappings[key] = mapping
            return mapping

    def require(self, repository_id: str, workspace_id: str,
                backend_id: str) -> RepositoryPathMapping:
        with self._lock:
            try: return self._mappings[(repository_id, workspace_id, backend_id)]
            except KeyError as exc: raise ValueError("mapping is not registered") from exc


def conflict_scope_key(repository_id: str | RepositoryIdentity, path: str,
                       repository_case_policy: str | None = None) -> tuple[str, str, str]:
    """Return the canonical conflict key.

    ``str`` input is the legacy B-09 adapter where the root path doubled as the
    identity.  Runtime C-09 code passes ``RepositoryIdentity`` explicitly.
    """
    if isinstance(repository_id, RepositoryIdentity):
        if repository_case_policy not in {None, repository_id.case_policy}:
            raise ValueError("case policy conflicts with repository identity")
        return repository_id.conflict_key(path)
    if repository_case_policy not in {"SENSITIVE", "INSENSITIVE"}:
        raise ValueError("repository_case_policy must be SENSITIVE or INSENSITIVE")
    relative = _relative(repository_id, path, repository_case_policy)
    canonical_root = _normalise(_resolve_deepest(_normalise(repository_id, case_policy=repository_case_policy)),
                                case_policy=repository_case_policy)
    return canonical_root, relative, repository_case_policy


__all__ = ["RepositoryIdentity", "RepositoryPathMapping", "RepositoryPathMappingRegistry",
           "conflict_scope_key"]
