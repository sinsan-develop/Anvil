"""Pure artifact preflight for a private rehearsal; no deployment capability."""

from __future__ import annotations

import hashlib
import importlib.util
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from packages.deployment.deploy_approval import DeployApprovalSubject, approval_matches, subject_hash
from packages.deployment.release_manifest import ReleaseExpectations, VerifiedRelease, verify_release_manifest


_F16_PATH = Path(__file__).resolve().parents[2] / "deploy" / "wsl" / "f16_staging.py"
_F16_SPEC = importlib.util.spec_from_file_location("f18_f16_staging", _F16_PATH)
if _F16_SPEC is None or _F16_SPEC.loader is None:
    raise ImportError("F16_STAGING_UNAVAILABLE")
_F16 = importlib.util.module_from_spec(_F16_SPEC)
_F16_SPEC.loader.exec_module(_F16)
APPROVED_DEVELOPMENT_REMOTE = _F16.APPROVED_DEVELOPMENT_REMOTE
GitPreflightError = _F16.GitPreflightError
verify_exact_checkout = _F16.verify_exact_checkout


_COMMIT = re.compile(r"[0-9a-f]{40}\Z")
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")


@dataclass(frozen=True, slots=True)
class PreflightDecision:
    ready: bool
    reason_code: str
    subject_hash: str | None


@dataclass(frozen=True, slots=True)
class VerifiedApprovalRelease:
    release: VerifiedRelease
    envelope_hash: str
    source_git_remote: str


def verify_approval_release(
    raw_manifest: bytes, *, trusted_public_key_pem: bytes,
    trusted_fingerprint: str, expected: ReleaseExpectations,
) -> VerifiedApprovalRelease:
    """Verify through F-16 and bind the exact signed envelope bytes for approval."""
    release = verify_release_manifest(
        raw_manifest, trusted_public_key_pem=trusted_public_key_pem,
        trusted_fingerprint=trusted_fingerprint, expected=expected,
    )
    return VerifiedApprovalRelease(
        release, "sha256:" + hashlib.sha256(raw_manifest).hexdigest(), expected.source_git_remote
    )


def _digest(value: object) -> bool:
    return isinstance(value, str) and _DIGEST.fullmatch(value) is not None


def validate_promotion(
    verified_release: VerifiedApprovalRelease,
    wsl_evidence: Mapping[str, object],
    approval_subject: DeployApprovalSubject,
    observed_environment_id: str,
    migration_plan_hash: str,
    rollback_plan_hash: str,
) -> PreflightDecision:
    """Compare verified inputs only; ``ready`` permits no production action."""
    blocked = lambda reason: PreflightDecision(False, reason, None)
    if not isinstance(verified_release, VerifiedApprovalRelease) or not isinstance(approval_subject, DeployApprovalSubject):
        return blocked("EVIDENCE_TARGET_MISMATCH")
    if not isinstance(verified_release.release, VerifiedRelease) or not _digest(verified_release.envelope_hash):
        return blocked("EVIDENCE_TARGET_MISMATCH")
    if not isinstance(wsl_evidence, Mapping):
        return blocked("EVIDENCE_TARGET_MISMATCH")
    commit = wsl_evidence.get("git_commit")
    runtime = wsl_evidence.get("runtime_image_digest")
    if not isinstance(commit, str) or _COMMIT.fullmatch(commit) is None or not _digest(runtime):
        return blocked("EVIDENCE_TARGET_MISMATCH")
    if not isinstance(observed_environment_id, str) or not observed_environment_id.strip() or not _digest(migration_plan_hash) or not _digest(rollback_plan_hash):
        return blocked("DEPLOY_APPROVAL_SUBJECT_MISMATCH")
    observed = DeployApprovalSubject(
        observed_environment_id, verified_release.envelope_hash, migration_plan_hash, rollback_plan_hash
    )
    if not approval_matches(approval_subject, observed):
        return blocked("DEPLOY_APPROVAL_SUBJECT_MISMATCH")
    bound_hash = subject_hash(observed)
    try:
        release_images = dict(verified_release.release.image_digests)
    except (TypeError, ValueError):
        return blocked("EVIDENCE_TARGET_MISMATCH")
    if set(release_images) != {"web", "api", "worker"} or not all(map(_digest, release_images.values())):
        return blocked("EVIDENCE_TARGET_MISMATCH")
    if commit != verified_release.release.source_commit or runtime != release_images["api"]:
        return blocked("DEPLOY_ARTIFACT_MISMATCH")
    evidence_images = wsl_evidence.get("image_digests")
    if evidence_images is None:
        return PreflightDecision(False, "WEB_IMAGE_NOT_VERIFIED", bound_hash)
    if not isinstance(evidence_images, Mapping) or not all(map(_digest, evidence_images.values())):
        return blocked("EVIDENCE_TARGET_MISMATCH")
    if "web" not in evidence_images:
        return PreflightDecision(False, "WEB_IMAGE_NOT_VERIFIED", bound_hash)
    if set(evidence_images) != {"web", "api", "worker"}:
        return blocked("EVIDENCE_TARGET_MISMATCH")
    if any(evidence_images[role] != release_images[role] for role in ("web", "api", "worker")):
        return blocked("DEPLOY_ARTIFACT_MISMATCH")
    return PreflightDecision(True, "READY_FOR_PRIVATE_REHEARSAL", bound_hash)


def validate_existing_checkout(
    verified_release: VerifiedApprovalRelease,
    wsl_evidence: Mapping[str, object],
    approval_subject: DeployApprovalSubject,
    observed_environment_id: str,
    migration_plan_hash: str,
    rollback_plan_hash: str,
    checkout: Path,
    approved_remote: str = APPROVED_DEVELOPMENT_REMOTE,
) -> PreflightDecision:
    """Read-only Git gate after all existing artifact and approval checks pass."""
    decision = validate_promotion(
        verified_release, wsl_evidence, approval_subject,
        observed_environment_id, migration_plan_hash, rollback_plan_hash,
    )
    if not decision.ready:
        return decision
    if verified_release.source_git_remote != approved_remote:
        return PreflightDecision(False, "GIT_CHECKOUT_NOT_VERIFIED", None)
    try:
        verify_exact_checkout(
            checkout, approved_remote=approved_remote,
            source_commit=verified_release.release.source_commit,
            release_tag=verified_release.release.release_tag,
        )
    except (GitPreflightError, OSError, ValueError, TypeError):
        return PreflightDecision(False, "GIT_CHECKOUT_NOT_VERIFIED", None)
    return decision
