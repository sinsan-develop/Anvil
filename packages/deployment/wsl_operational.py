"""Pure WSL rehearsal capability gate; no server or deployment operations."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
from pathlib import Path
from typing import Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.exceptions import UnsupportedAlgorithm
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, load_pem_public_key

from packages.deployment.deploy_approval import DeployApprovalSubject
from packages.deployment.promotion_preflight import (
    APPROVED_DEVELOPMENT_REMOTE, PreflightDecision, VerifiedApprovalRelease,
    validate_existing_checkout,
)


_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
_ROLES = frozenset({"web", "api", "worker"})
_CAPABILITIES = frozenset({"oidc", "object_storage", "network", "pg18"})
_PAYLOAD_FIELDS = frozenset({
    "collector_id", "environment_id", "source_commit", "release_manifest_hash",
    "image_digests", "capabilities",
})
_ENVELOPE_FIELDS = frozenset({
    "schema_version", "payload", "payload_hash", "public_key_fingerprint", "signature",
})


def _digest(value: object) -> bool:
    return isinstance(value, str) and _DIGEST.fullmatch(value) is not None


def _unique_pairs(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate key")
        result[key] = value
    return result


def _reject_constant(value: str) -> None:
    raise ValueError("non-JSON number")


def _canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def _verified_payload(
    raw: bytes, trusted_public_key_pem: bytes, trusted_fingerprint: str,
) -> dict | None:
    if not isinstance(raw, bytes) or not raw or len(raw) > 16384:
        return None
    if not isinstance(trusted_public_key_pem, bytes) or not _digest(trusted_fingerprint):
        return None
    try:
        envelope = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_pairs, parse_constant=_reject_constant)
        if not isinstance(envelope, dict) or set(envelope) != _ENVELOPE_FIELDS:
            return None
        if envelope["schema_version"] != 1 or isinstance(envelope["schema_version"], bool):
            return None
        payload = envelope["payload"]
        if not isinstance(payload, dict) or set(payload) != _PAYLOAD_FIELDS:
            return None
        body = _canonical(payload)
        if envelope["payload_hash"] != "sha256:" + hashlib.sha256(body).hexdigest():
            return None
        key = load_pem_public_key(trusted_public_key_pem)
        if not isinstance(key, Ed25519PublicKey):
            return None
        der = key.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
        fingerprint = "sha256:" + hashlib.sha256(der).hexdigest()
        if fingerprint != trusted_fingerprint or envelope["public_key_fingerprint"] != fingerprint:
            return None
        signature = base64.b64decode(envelope["signature"], validate=True)
        if len(signature) != 64:
            return None
        key.verify(signature, body)
        return payload
    except (ValueError, TypeError, UnicodeError, binascii.Error, InvalidSignature, UnsupportedAlgorithm, RecursionError):
        return None


def validate_wsl_operational(
    verified_release: VerifiedApprovalRelease,
    wsl_evidence: Mapping[str, object],
    approval_subject: DeployApprovalSubject,
    observed_environment_id: str,
    migration_plan_hash: str,
    rollback_plan_hash: str,
    checkout: Path,
    capability_envelope: bytes,
    *,
    trusted_public_key_pem: bytes,
    trusted_fingerprint: str,
    expected_collector_id: str,
    approved_remote: str = APPROVED_DEVELOPMENT_REMOTE,
) -> PreflightDecision:
    """Require a trusted, target-bound observation after the existing Git gate."""
    base = validate_existing_checkout(
        verified_release, wsl_evidence, approval_subject, observed_environment_id,
        migration_plan_hash, rollback_plan_hash, checkout, approved_remote,
    )
    if not base.ready:
        return base
    blocked = PreflightDecision(False, "CAPABILITY_NOT_VERIFIED", None)
    payload = _verified_payload(capability_envelope, trusted_public_key_pem, trusted_fingerprint)
    if payload is None or not isinstance(expected_collector_id, str) or not expected_collector_id:
        return blocked
    if not isinstance(verified_release, VerifiedApprovalRelease) or not isinstance(approval_subject, DeployApprovalSubject):
        return blocked
    try:
        expected_images = dict(verified_release.release.image_digests)
    except (TypeError, ValueError, AttributeError):
        return blocked
    images = payload["image_digests"]
    if (payload["collector_id"] != expected_collector_id
            or payload["environment_id"] != observed_environment_id
            or payload["source_commit"] != verified_release.release.source_commit
            or payload["release_manifest_hash"] != verified_release.envelope_hash
            or payload["release_manifest_hash"] != approval_subject.release_manifest_hash
            or not isinstance(images, dict) or set(images) != _ROLES
            or not all(_digest(value) for value in images.values())
            or images != expected_images):
        return blocked
    capabilities = payload["capabilities"]
    if not isinstance(capabilities, dict) or set(capabilities) != _CAPABILITIES:
        return blocked
    for observed in capabilities.values():
        if (not isinstance(observed, dict)
                or set(observed) != {"status", "acquisition", "evidence_hash"}
                or observed["status"] != "PASS"
                or observed["acquisition"] != "real-wsl-observation"
                or not _digest(observed["evidence_hash"])):
            return blocked
    return PreflightDecision(True, "READY_FOR_WSL_REHEARSAL", base.subject_hash)
