"""Canonical path identity and repository confinement checks."""

from __future__ import annotations

import os
from pathlib import Path

from .errors import ScanError, ScanRejected
from .models import ScanRequest


def _identity(path: Path) -> str:
    return os.path.normcase(os.path.realpath(os.fspath(path)))


def contains_path(parent: Path, child: Path) -> bool:
    parent_id = _identity(parent)
    child_id = _identity(child)
    try:
        return os.path.commonpath([parent_id, child_id]) == parent_id
    except ValueError:
        return False


def validate_scan_paths(request: ScanRequest) -> tuple[Path, Path, Path | None, Path | None]:
    """Resolve all paths and reject traversal, alias, and aux-path overlap."""

    allowed_root = Path(request.allowed_root).resolve(strict=True)
    repository = Path(request.repository_path).resolve(strict=True)
    if not allowed_root.is_dir() or not repository.is_dir() or not contains_path(allowed_root, repository):
        raise ScanRejected(
            ScanError(
                code="ROOT_OUTSIDE_ALLOWED",
                message="Repository is outside the configured allowed root.",
                field="repository_path",
            )
        )

    output = _resolve_future_path(request.output_path) if request.output_path else None
    temp_root = _resolve_future_path(request.temp_root) if request.temp_root else None
    for field_name, path in (("output_path", output), ("temp_root", temp_root)):
        if path is not None and contains_path(repository, path):
            raise ScanRejected(
                ScanError(
                    code="SCAN_AUX_PATH_INSIDE_REPOSITORY",
                    message="Scan output and temporary paths must be outside the repository.",
                    field=field_name,
                )
            )
    return repository, allowed_root, output, temp_root


def _resolve_future_path(value: str) -> Path:
    path = Path(value)
    if path.exists():
        return path.resolve(strict=True)
    parent = path.parent.resolve(strict=False)
    return parent / path.name
