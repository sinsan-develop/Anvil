"""Verify the historical F-20 acceptance binds to immutable evidence bytes."""

from __future__ import annotations

import hashlib
from pathlib import Path


ERROR = "F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH"


def validate_f20_acceptance_binding(root: Path, events: list[dict]) -> list[str]:
    accepted = [
        event for event in events
        if event.get("sequence") == 1714
        and event.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
        and event.get("work_package_id") == "F-20"
    ]
    if len(accepted) != 1:
        return [ERROR]

    root = root.resolve()
    details = accepted[0].get("details") or {}
    for path_key, hash_key in (
        ("test_report_ref", "test_report_sha256"),
        ("manifest_ref", "manifest_sha256"),
    ):
        reference, expected = details.get(path_key), details.get(hash_key)
        if not isinstance(reference, str) or not isinstance(expected, str):
            return [ERROR]
        path = (root / reference).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            return [ERROR]
        if hashlib.sha256(path.read_bytes()).hexdigest().upper() != expected.upper():
            return [ERROR]
    return []
