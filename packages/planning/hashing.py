"""Deterministic content hashes for immutable planning artifacts."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_content_hash(content: Any) -> str:
    """Return a SHA-256 hash for canonical JSON-compatible content."""
    encoded = json.dumps(
        content,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()
