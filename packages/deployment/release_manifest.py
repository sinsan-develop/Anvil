"""Strict F-16 detached Ed25519 ReleaseManifest verification.

This module is for host preflight only. Private signing keys never enter this module.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
from dataclasses import dataclass
from typing import Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, load_pem_public_key
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
_COMMIT = re.compile(r"[0-9a-f]{40}\Z")
_TAG = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,126}\Z")
_ADAPTER_VERSION = re.compile(r"(?:adapter-v|v)?[0-9]+(?:[._+-][A-Za-z0-9]+){0,4}\Z")
_FIELDS = frozenset({
    "source_git_remote", "source_commit", "release_tag", "image_digests",
    "lockfile_hash", "sbom_ref", "db_migration_head", "config_schema_revision",
    "provider_adapter_versions", "evidence_manifest_hash", "verification_report_hash",
})
_PROVIDERS = frozenset({
    "cerebras", "groq", "mistral", "openrouter", "upstage", "gemini",
    "anthropic", "openai", "ollama",
})


class ManifestVerificationError(ValueError):
    """Preflight stopped without exposing manifest values or credentials."""


@dataclass(frozen=True)
class ReleaseExpectations:
    source_git_remote: str
    source_commit: str
    release_tag: str
    image_digests: Mapping[str, str]
    lockfile_hash: str
    sbom_ref: str
    db_migration_head: str
    config_schema_revision: str
    provider_adapter_versions: Mapping[str, str]
    evidence_manifest_hash: str
    verification_report_hash: str


@dataclass(frozen=True)
class VerifiedRelease:
    source_commit: str
    release_tag: str
    subject_hash: str
    image_digests: tuple[tuple[str, str], ...]


def _digest(value: object) -> bool:
    return isinstance(value, str) and _HASH.fullmatch(value) is not None


def _safe_text(value: object) -> bool:
    return isinstance(value, str) and bool(value) and len(value) <= 256 and all(32 <= ord(c) < 127 for c in value)


def _validate_subject(subject: object) -> dict:
    if not isinstance(subject, dict) or set(subject) != _FIELDS:
        raise ManifestVerificationError("MANIFEST_SUBJECT_FIELDS_INVALID")
    if not _safe_text(subject["source_git_remote"]) or not subject["source_git_remote"].startswith("git@"):
        raise ManifestVerificationError("MANIFEST_REMOTE_INVALID")
    if not isinstance(subject["source_commit"], str) or _COMMIT.fullmatch(subject["source_commit"]) is None:
        raise ManifestVerificationError("MANIFEST_COMMIT_INVALID")
    tag = subject["release_tag"]
    if not isinstance(tag, str) or _TAG.fullmatch(tag) is None or ".." in tag or tag.endswith((".", ".lock")):
        raise ManifestVerificationError("MANIFEST_TAG_INVALID")
    images = subject["image_digests"]
    if not isinstance(images, dict) or set(images) != {"web", "api", "worker"} or not all(map(_digest, images.values())):
        raise ManifestVerificationError("MANIFEST_IMAGES_INVALID")
    for field in ("lockfile_hash", "sbom_ref", "config_schema_revision", "evidence_manifest_hash", "verification_report_hash"):
        if not _digest(subject[field]):
            raise ManifestVerificationError("MANIFEST_DIGEST_INVALID")
    if subject["db_migration_head"] != "0016_operations_recovery":
        raise ManifestVerificationError("MANIFEST_MIGRATION_INVALID")
    providers = subject["provider_adapter_versions"]
    if not isinstance(providers, dict) or set(providers) != _PROVIDERS or not all(
        isinstance(v, str) and _ADAPTER_VERSION.fullmatch(v) is not None for v in providers.values()
    ):
        raise ManifestVerificationError("MANIFEST_PROVIDERS_INVALID")
    return subject


def canonical_subject_bytes(subject: object) -> bytes:
    """Return the sole signing payload, after strict schema validation."""
    _validate_subject(subject)
    return json.dumps(subject, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def _unique_pairs(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ManifestVerificationError("MANIFEST_DUPLICATE_KEY")
        result[key] = value
    return result


def verify_release_manifest(
    raw_manifest: bytes, *, trusted_public_key_pem: bytes,
    trusted_fingerprint: str, expected: ReleaseExpectations,
) -> VerifiedRelease:
    """Verify signature, independent trust and every observed deployment input."""
    if not isinstance(raw_manifest, bytes) or len(raw_manifest) > 16384:
        raise ManifestVerificationError("MANIFEST_SIZE_INVALID")
    try:
        envelope = json.loads(raw_manifest.decode("utf-8"), object_pairs_hook=_unique_pairs)
    except (ValueError, UnicodeError) as error:
        raise ManifestVerificationError("MANIFEST_JSON_INVALID") from error
    if not isinstance(envelope, dict) or set(envelope) != {
        "schema_version", "subject", "subject_hash", "public_key_fingerprint", "signature"
    } or envelope["schema_version"] != 1 or isinstance(envelope["schema_version"], bool):
        raise ManifestVerificationError("MANIFEST_ENVELOPE_INVALID")
    payload = canonical_subject_bytes(envelope["subject"])
    digest = "sha256:" + hashlib.sha256(payload).hexdigest()
    if envelope["subject_hash"] != digest:
        raise ManifestVerificationError("MANIFEST_HASH_MISMATCH")
    if not _digest(trusted_fingerprint) or not isinstance(trusted_public_key_pem, bytes):
        raise ManifestVerificationError("MANIFEST_TRUST_INVALID")
    try:
        public = load_pem_public_key(trusted_public_key_pem)
    except (ValueError, TypeError) as error:
        raise ManifestVerificationError("MANIFEST_TRUST_INVALID") from error
    if not isinstance(public, Ed25519PublicKey):
        raise ManifestVerificationError("MANIFEST_KEY_TYPE_INVALID")
    public_der = public.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    actual_fingerprint = "sha256:" + hashlib.sha256(public_der).hexdigest()
    if actual_fingerprint != trusted_fingerprint or envelope["public_key_fingerprint"] != trusted_fingerprint:
        raise ManifestVerificationError("MANIFEST_FINGERPRINT_MISMATCH")
    try:
        signature = base64.b64decode(envelope["signature"], validate=True)
        if len(signature) != 64:
            raise ManifestVerificationError("MANIFEST_SIGNATURE_INVALID")
        public.verify(signature, payload)
    except (binascii.Error, InvalidSignature, TypeError, ValueError) as error:
        raise ManifestVerificationError("MANIFEST_SIGNATURE_INVALID") from error
    observed = {field: getattr(expected, field) for field in _FIELDS}
    if envelope["subject"] != observed:
        raise ManifestVerificationError("MANIFEST_OBSERVATION_MISMATCH")
    return VerifiedRelease(
        source_commit=envelope["subject"]["source_commit"],
        release_tag=envelope["subject"]["release_tag"],
        subject_hash=digest,
        image_digests=tuple(sorted(envelope["subject"]["image_digests"].items())),
    )
