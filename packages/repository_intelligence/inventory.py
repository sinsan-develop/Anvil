"""Deterministic, no-follow file inventory for integrity proof."""

from __future__ import annotations

import hashlib
import json
import os
import stat
from pathlib import Path
from typing import Any, Iterable

from .errors import ScanError, ScanRejected
from .models import ScanLimits


_REPARSE_ATTRIBUTE = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)


def canonical_sha256(value: Any) -> str:
    raw = json.dumps(
        value,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest().upper()


def is_reparse_point(path: Path, path_stat: os.stat_result | None = None) -> bool:
    current = path_stat if path_stat is not None else path.lstat()
    attributes = int(getattr(current, "st_file_attributes", 0))
    is_junction = getattr(os.path, "isjunction", lambda _path: False)
    return path.is_symlink() or bool(attributes & _REPARSE_ATTRIBUTE) or bool(is_junction(path))


def _safe_relative(path: Path, root: Path) -> str:
    return "." if path == root else path.relative_to(root).as_posix()


def _hash_regular_file(path: Path, before: os.stat_result, relative: str) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        after = path.lstat()
    except OSError as exc:
        raise ScanRejected(
            ScanError(
                code="SNAPSHOT_UNSTABLE",
                message="Repository changed or became unreadable during inventory.",
                details={"path": relative, "reason": type(exc).__name__},
            )
        ) from exc
    identity_before = (
        before.st_mode,
        before.st_size,
        before.st_mtime_ns,
        before.st_dev,
        before.st_ino,
    )
    identity_after = (
        after.st_mode,
        after.st_size,
        after.st_mtime_ns,
        after.st_dev,
        after.st_ino,
    )
    if identity_after != identity_before:
        raise ScanRejected(
            ScanError(
                code="SNAPSHOT_UNSTABLE",
                message="Repository changed while a file was being hashed.",
                details={"path": relative},
            )
        )
    return digest.hexdigest().upper()


def capture_tree_inventory(root: Path, limits: ScanLimits) -> list[dict[str, Any]]:
    """Inventory every directory and regular file without following links."""

    entries: list[dict[str, Any]] = []
    pending = [root]
    total_bytes = 0
    while pending:
        path = pending.pop()
        relative = _safe_relative(path, root)
        try:
            path_stat = path.lstat()
        except OSError as exc:
            raise ScanRejected(
                ScanError(
                    code="SNAPSHOT_UNSTABLE",
                    message="Repository entry became unreadable during inventory.",
                    details={"path": relative, "reason": type(exc).__name__},
                )
            ) from exc
        if is_reparse_point(path, path_stat):
            raise ScanRejected(
                ScanError(
                    code="REPOSITORY_REPARSE_POINT_DENIED",
                    message="Symlink, junction, or reparse-point entries are not scanned.",
                    details={"path": relative},
                )
            )
        if stat.S_ISDIR(path_stat.st_mode):
            entry_type = "directory"
            digest: str | None = None
            try:
                children = sorted(
                    (Path(item.path) for item in os.scandir(path)),
                    key=lambda item: item.name.encode("utf-8", errors="surrogatepass"),
                    reverse=True,
                )
            except OSError as exc:
                raise ScanRejected(
                    ScanError(
                        code="SNAPSHOT_UNSTABLE",
                        message="Repository directory became unreadable during inventory.",
                        details={"path": relative, "reason": type(exc).__name__},
                    )
                ) from exc
            pending.extend(children)
        elif stat.S_ISREG(path_stat.st_mode):
            entry_type = "file"
            if path_stat.st_size > limits.max_file_bytes:
                raise ScanRejected(
                    ScanError(
                        code="SCAN_FILE_LIMIT_EXCEEDED",
                        message="A repository file exceeds the configured scan limit.",
                        details={"path": relative, "bytes": path_stat.st_size},
                    )
                )
            total_bytes += path_stat.st_size
            if total_bytes > limits.max_total_bytes:
                raise ScanRejected(
                    ScanError(
                        code="SCAN_TOTAL_BYTES_LIMIT_EXCEEDED",
                        message="Repository bytes exceed the configured scan limit.",
                        details={"observed_bytes": total_bytes},
                    )
                )
            digest = _hash_regular_file(path, path_stat, relative)
        else:
            raise ScanRejected(
                ScanError(
                    code="REPOSITORY_SPECIAL_FILE_DENIED",
                    message="Special filesystem entries are not scanned.",
                    details={"path": relative},
                )
            )
        entries.append(
            {
                "path": relative,
                "type": entry_type,
                "size": path_stat.st_size,
                "mtime_ns": path_stat.st_mtime_ns,
                "sha256": digest,
                "mode": stat.S_IMODE(path_stat.st_mode),
            }
        )
        if len(entries) > limits.max_entries:
            raise ScanRejected(
                ScanError(
                    code="SCAN_ENTRY_LIMIT_EXCEEDED",
                    message="Repository entries exceed the configured scan limit.",
                    details={"observed_entries": len(entries)},
                )
            )
    return sorted(entries, key=lambda item: item["path"].encode("utf-8", errors="surrogatepass"))


def capture_named_files(paths: Iterable[tuple[str, Path]], limits: ScanLimits) -> list[dict[str, Any]]:
    """Capture explicitly named Git metadata paths with the same file algorithm."""

    rows: list[dict[str, Any]] = []
    total_bytes = 0
    for label, path in sorted(paths, key=lambda item: item[0].encode("utf-8")):
        if not path.exists():
            continue
        path_stat = path.lstat()
        if is_reparse_point(path, path_stat) or not stat.S_ISREG(path_stat.st_mode):
            raise ScanRejected(
                ScanError(
                    code="GIT_METADATA_PATH_TYPE_DENIED",
                    message="Git metadata must be a regular non-reparse file.",
                    details={"path": label},
                )
            )
        if path_stat.st_size > limits.max_file_bytes:
            raise ScanRejected(
                ScanError(
                    code="SCAN_FILE_LIMIT_EXCEEDED",
                    message="A Git metadata file exceeds the configured scan limit.",
                    details={"path": label, "bytes": path_stat.st_size},
                )
            )
        total_bytes += path_stat.st_size
        if total_bytes > limits.max_total_bytes:
            raise ScanRejected(
                ScanError(
                    code="SCAN_TOTAL_BYTES_LIMIT_EXCEEDED",
                    message="Git metadata bytes exceed the configured scan limit.",
                )
            )
        rows.append(
            {
                "path": label,
                "type": "file",
                "size": path_stat.st_size,
                "mtime_ns": path_stat.st_mtime_ns,
                "sha256": _hash_regular_file(path, path_stat, label),
                "mode": stat.S_IMODE(path_stat.st_mode),
            }
        )
    return rows
