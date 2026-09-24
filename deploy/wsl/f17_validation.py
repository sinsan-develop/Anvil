"""F-17 evidence binding; not a ProductValidation API or release decision.

The caller must acquire observations from the real HTTP/DB harness. These
records are in-memory verification artifacts, never persisted by this module.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Iterable

from packages.verification.gates import ProductValidation

_SHA = re.compile(r"sha256:[0-9a-f]{64}\Z")
_GIT = re.compile(r"[0-9a-f]{40}\Z")


class EvidenceError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class VerifiedTarget:
    git_sha: str
    image_digest: str
    migration_head: str
    environment_id: str
    target_hash: str


@dataclass(frozen=True, slots=True)
class ObservedCriterion:
    criterion_id: str
    target_hash: str
    environment_id: str
    status: str
    acquisition: str
    evidence_hash: str
    observation: str


def validate_target(*, git_sha: str, published_sha: str, clean: bool,
                    image_digest: str, migration_head: str,
                    environment_id: str, target_hash: str) -> VerifiedTarget:
    if not (_GIT.fullmatch(git_sha) and git_sha == published_sha and clean is True):
        raise EvidenceError("exact published clean checkout required")
    if not _SHA.fullmatch(image_digest) or not _SHA.fullmatch(target_hash):
        raise EvidenceError("invalid image or target digest")
    if migration_head != "0016_operations_recovery":
        raise EvidenceError("migration 0016 required")
    if environment_id not in {"f17-pg15", "f17-pg18"}:
        raise EvidenceError("unknown F17 environment")
    return VerifiedTarget(git_sha, image_digest, migration_head, environment_id, target_hash)


def build_validation_records(target: VerifiedTarget,
                             observations: Iterable[ObservedCriterion]) -> tuple[ProductValidation, ...]:
    rows = []
    seen = set()
    for observation in observations:
        if (observation.criterion_id not in {"AV-OPS-015", "AV-OPS-025"}
                or observation.criterion_id in seen
                or observation.target_hash != target.target_hash
                or observation.environment_id != target.environment_id
                or observation.status != "PASS"
                or observation.acquisition != "http+database"
                or not _SHA.fullmatch(observation.evidence_hash)
                or not observation.observation.strip()):
            raise EvidenceError("unbound, duplicate, or unexecuted criterion")
        seen.add(observation.criterion_id)
        rows.append(ProductValidation(
            criterion_id=observation.criterion_id,
            target_hash=target.target_hash,
            verdict="NEEDS_IMPROVEMENT",
            validated_by="f17-real-evidence-harness",
            environment_id=target.environment_id,
            evidence_refs=(observation.evidence_hash,),
            acquisition_mode="real",
            observed=observation.observation + "; partial HTTP+DB observation only",
        ))
    return tuple(rows)
