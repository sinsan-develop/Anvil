"""Strict EOL-only portability for evidence generated before LF normalization."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

REGISTRY_REL = "docs/evidence/manifests/GIT_EOL_PORTABILITY_R1.json"
REGISTRY_SHA256 = "7DEC88AF047A14F3C7D11E12F4D247556075675A8E71C36143F698214184E3BE"


def _lf(raw: bytes) -> bytes:
    return raw.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def _registry(root: Path) -> dict[str, dict[str, object]]:
    path = root / REGISTRY_REL
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest().upper() != REGISTRY_SHA256:
        return {}
    payload = json.loads(raw.decode("utf-8"))
    if payload.get("self_reference") is not False or payload.get("canonical_eol") != "LF":
        return {}
    return {row["path"]: row for row in payload.get("entries", []) if isinstance(row, dict)}


def portable_hash(root: Path, relative: str, *, prefer_legacy: bool = True) -> str:
    raw = (root / relative).read_bytes()
    actual = hashlib.sha256(raw).hexdigest().upper()
    row = _registry(root).get(relative)
    if not row:
        return actual
    canonical = _lf(raw)
    if (
        len(canonical) != row.get("canonical_bytes")
        or hashlib.sha256(canonical).hexdigest().upper() != row.get("canonical_sha256")
    ):
        return actual
    return str(row.get("legacy_sha256") if prefer_legacy else row.get("canonical_sha256"))


def portable_row_matches(root: Path, relative: str, expected_bytes: int, expected_sha256: str) -> bool:
    raw = (root / relative).read_bytes()
    if len(raw) == expected_bytes and hashlib.sha256(raw).hexdigest().upper() == expected_sha256:
        return True
    row = _registry(root).get(relative)
    if not row or expected_bytes != row.get("legacy_bytes") or expected_sha256 != row.get("legacy_sha256"):
        return False
    canonical = _lf(raw)
    return (
        len(canonical) == row.get("canonical_bytes")
        and hashlib.sha256(canonical).hexdigest().upper() == row.get("canonical_sha256")
    )
