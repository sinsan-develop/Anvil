"""Immutable, canonical F-18 deployment approval subject."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass


_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")


@dataclass(frozen=True, slots=True)
class DeployApprovalSubject:
    environment_id: str
    release_manifest_hash: str
    migration_plan_hash: str
    rollback_plan_hash: str

    def __post_init__(self) -> None:
        if not isinstance(self.environment_id, str) or not self.environment_id.strip():
            raise ValueError("DEPLOY_ENVIRONMENT_INVALID")
        for field in ("release_manifest_hash", "migration_plan_hash", "rollback_plan_hash"):
            value = getattr(self, field)
            if not isinstance(value, str) or _DIGEST.fullmatch(value) is None:
                raise ValueError("DEPLOY_SUBJECT_DIGEST_INVALID")


def _canonical_bytes(subject: DeployApprovalSubject) -> bytes:
    if not isinstance(subject, DeployApprovalSubject):
        raise TypeError("DeployApprovalSubject required")
    payload = {
        "environment_id": subject.environment_id,
        "release_manifest_hash": subject.release_manifest_hash,
        "migration_plan_hash": subject.migration_plan_hash,
        "rollback_plan_hash": subject.rollback_plan_hash,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def subject_hash(subject: DeployApprovalSubject) -> str:
    return "sha256:" + hashlib.sha256(_canonical_bytes(subject)).hexdigest()


def approval_matches(approved: DeployApprovalSubject, observed: DeployApprovalSubject) -> bool:
    return _canonical_bytes(approved) == _canonical_bytes(observed)
