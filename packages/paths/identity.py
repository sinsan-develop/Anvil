"""Cross-platform repository path identity for write conflict fencing."""

from __future__ import annotations

import posixpath
import re
from pathlib import Path


_MNT_DRIVE = re.compile(r"^/mnt/([a-zA-Z])(?:/|$)")
_DRIVE = re.compile(r"^([a-zA-Z]):(?:/|$)")


def _normalise(path: str, *, case_policy: str) -> str:
    value = path.replace("\\", "/")
    matched = _MNT_DRIVE.match(value)
    if matched:
        value = f"{matched.group(1)}:" + value[6:]
    value = posixpath.normpath(value)
    if case_policy == "INSENSITIVE":
        value = value.casefold()
    return value.rstrip("/") or "/"


def _resolve_existing(path: str) -> str:
    candidate = Path(path)
    try:
        if candidate.exists():
            return candidate.resolve(strict=True).as_posix()
    except OSError as exc:
        raise ValueError("path identity cannot be resolved safely") from exc
    return path


def conflict_scope_key(repository_id: str, path: str, repository_case_policy: str) -> tuple[str, str, str]:
    """Return only the canonical repository-relative identity used for conflicts."""

    if repository_case_policy not in {"SENSITIVE", "INSENSITIVE"}:
        raise ValueError("repository_case_policy must be SENSITIVE or INSENSITIVE")
    repository_lexical = _normalise(repository_id, case_policy=repository_case_policy)
    repository = _normalise(_resolve_existing(repository_lexical), case_policy=repository_case_policy)
    candidate_lexical = _normalise(path, case_policy=repository_case_policy)
    candidate_is_absolute = bool(_DRIVE.match(candidate_lexical) or candidate_lexical.startswith("/"))
    if not candidate_is_absolute:
        candidate_lexical = _normalise(
            repository_lexical + "/" + candidate_lexical,
            case_policy=repository_case_policy,
        )
    candidate = _normalise(_resolve_existing(candidate_lexical), case_policy=repository_case_policy)
    prefix = repository + "/"
    if candidate == repository:
        relative = "."
    elif candidate.startswith(prefix):
        relative = candidate[len(prefix):]
    else:
        raise ValueError("path must remain within the repository")
    if relative == ".." or relative.startswith("../"):
        raise ValueError("path must remain within the repository")
    return repository, relative, repository_case_policy
