"""Fail-closed, host-supplied observations for isolated database restore rehearsal."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
import json
import re
from types import MappingProxyType
from typing import Mapping


_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
_SHA = re.compile(r"[0-9a-f]{40}\Z")
_LINEAGE = frozenset({"project", "run", "approval", "progress", "terminal_learning", "audit"})


class RecoveryMismatch(ValueError):
    pass


def _valid_hash(value: str) -> bool:
    return type(value) is str and _HASH.fullmatch(value) is not None


@dataclass(frozen=True)
class RecoveryManifest:
    project_id: str
    environment_id: str
    git_sha: str
    migration_head: str
    pg_major: int
    image_digest: str
    extension_version: str
    schema_hash: str
    event_sequence: int
    artifact_checksums: Mapping[str, str]
    created_at: datetime
    actor_id: str
    backup_digest: str
    source_lineage_hashes: Mapping[str, str]

    def __post_init__(self):
        if (type(self.project_id) is not str or not self.project_id
                or type(self.environment_id) is not str or not self.environment_id
                or type(self.migration_head) is not str or not self.migration_head
                or type(self.git_sha) is not str or not _SHA.fullmatch(self.git_sha)
                or type(self.pg_major) is not int or self.pg_major not in (15, 18)
                or not _valid_hash(self.image_digest) or not _valid_hash(self.schema_hash)
                or type(self.extension_version) is not str or not self.extension_version
                or type(self.event_sequence) is not int or self.event_sequence < 0
                or type(self.artifact_checksums) not in (dict, MappingProxyType) or not self.artifact_checksums
                or any(type(key) is not str or not key or not _valid_hash(value)
                       for key, value in self.artifact_checksums.items())
                or type(self.created_at) is not datetime or self.created_at.tzinfo is None
                or type(self.actor_id) is not str or not self.actor_id
                or not _valid_hash(self.backup_digest)
                or type(self.source_lineage_hashes) not in (dict, MappingProxyType)
                or set(self.source_lineage_hashes) != _LINEAGE
                or any(not _valid_hash(value) for value in self.source_lineage_hashes.values())):
            raise RecoveryMismatch("RECOVERY_MANIFEST_INVALID")
        object.__setattr__(self, "artifact_checksums", MappingProxyType(dict(self.artifact_checksums)))
        object.__setattr__(self, "source_lineage_hashes", MappingProxyType(dict(self.source_lineage_hashes)))


@dataclass(frozen=True)
class RestoreObservation:
    target_database_id: str
    restored_from_digest: str
    git_sha: str
    migration_head: str
    pg_major: int
    image_digest: str
    extension_version: str
    schema_hash: str
    event_sequence: int
    artifact_checksums: dict[str, str]
    lineage_hashes: dict[str, str]
    replayed: bool
    project_id: str
    environment_id: str

    def __post_init__(self):
        if (type(self.artifact_checksums) not in (dict, MappingProxyType)
                or type(self.lineage_hashes) not in (dict, MappingProxyType)):
            raise RecoveryMismatch("RESTORE_OBSERVATION_INVALID")
        object.__setattr__(self, "artifact_checksums", MappingProxyType(dict(self.artifact_checksums)))
        object.__setattr__(self, "lineage_hashes", MappingProxyType(dict(self.lineage_hashes)))


@dataclass(frozen=True)
class RestoreVerification:
    status: str
    target_database_id: str
    verified_sequence: int
    evidence_hash: str


@dataclass(frozen=True)
class BackupVerification:
    digest: str
    byte_size: int
    restore_listed: bool


@dataclass(frozen=True)
class MigrationVerification:
    pg_major: int
    server_version_num: int
    extension_version: str
    image_digest: str
    evidence_hash: str


def verify_migration_observation(server_version_num: int, extensions: set[str],
                                 extension_version: str, image_digest: str,
                                 *, expected_major: int) -> MigrationVerification:
    major = check_migration_compatibility(server_version_num, extensions, expected_major=expected_major)
    if not extension_version or not _valid_hash(image_digest):
        raise RecoveryMismatch("MIGRATION_COMPATIBILITY_MISMATCH")
    evidence = "sha256:" + sha256(f"{server_version_num}:{extension_version}:{image_digest}".encode()).hexdigest()
    return MigrationVerification(major, server_version_num, extension_version, image_digest, evidence)


def verify_backup(manifest: RecoveryManifest, content: bytes,
                  restore_listing: tuple[str, ...]) -> BackupVerification:
    if (type(manifest) is not RecoveryManifest or type(content) is not bytes or not content
            or type(restore_listing) is not tuple or not restore_listing
            or any(type(row) is not str or not row for row in restore_listing)):
        raise RecoveryMismatch("BACKUP_NOT_VERIFIED")
    digest = "sha256:" + sha256(content).hexdigest()
    if digest != manifest.backup_digest:
        raise RecoveryMismatch("BACKUP_DIGEST_MISMATCH")
    return BackupVerification(digest, len(content), True)


def encode_manifest(manifest: RecoveryManifest) -> bytes:
    if type(manifest) is not RecoveryManifest:
        raise RecoveryMismatch("RECOVERY_MANIFEST_INVALID")
    data = {name: getattr(manifest, name) for name in manifest.__dataclass_fields__}
    data["created_at"] = manifest.created_at.isoformat()
    data["artifact_checksums"] = dict(manifest.artifact_checksums)
    data["source_lineage_hashes"] = dict(manifest.source_lineage_hashes)
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                      allow_nan=False).encode("utf-8")


def read_manifest(raw: bytes, expected_digest: str) -> RecoveryManifest:
    if (type(raw) is not bytes or len(raw) > 262144 or type(expected_digest) is not str
            or not _HASH.fullmatch(expected_digest)
            or "sha256:" + sha256(raw).hexdigest() != expected_digest):
        raise RecoveryMismatch("RECOVERY_MANIFEST_HASH_MISMATCH")
    try:
        def distinct(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise RecoveryMismatch("RECOVERY_MANIFEST_INVALID")
                result[key] = value
            return result
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=distinct)
        if type(data) is not dict or set(data) != set(RecoveryManifest.__dataclass_fields__):
            raise RecoveryMismatch("RECOVERY_MANIFEST_INVALID")
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        manifest = RecoveryManifest(**data)
        if encode_manifest(manifest) != raw:
            raise RecoveryMismatch("RECOVERY_MANIFEST_NONCANONICAL")
        return manifest
    except (UnicodeError, TypeError, ValueError, KeyError) as exc:
        if type(exc) is RecoveryMismatch:
            raise
        raise RecoveryMismatch("RECOVERY_MANIFEST_INVALID") from None


def verify_restore(manifest: RecoveryManifest, original_lineage: dict[str, str],
                   target: RestoreObservation) -> RestoreVerification:
    """Compare independent post-replay target observations; dump-list alone is insufficient."""
    if (type(manifest) is not RecoveryManifest or type(target) is not RestoreObservation
            or target.replayed is not True or not target.target_database_id
            or target.restored_from_digest != manifest.backup_digest
            or set(original_lineage) != _LINEAGE or set(target.lineage_hashes) != _LINEAGE
            or any(not _valid_hash(value) for value in original_lineage.values())
            or any(not _valid_hash(value) for value in target.lineage_hashes.values())
            or original_lineage != manifest.source_lineage_hashes
            or target.lineage_hashes != manifest.source_lineage_hashes):
        raise RecoveryMismatch("RESTORE_LINEAGE_MISMATCH")
    for name in ("project_id", "environment_id", "git_sha", "migration_head", "pg_major", "image_digest",
                 "extension_version", "schema_hash", "event_sequence", "artifact_checksums"):
        if getattr(manifest, name) != getattr(target, name):
            raise RecoveryMismatch("RESTORE_TARGET_MISMATCH")
    evidence = "sha256:" + sha256(encode_manifest(manifest) +
        json.dumps(dict(target.lineage_hashes), sort_keys=True, separators=(",", ":")).encode("utf-8") +
        target.target_database_id.encode("utf-8")).hexdigest()
    return RestoreVerification("RESTORE_VERIFIED", target.target_database_id,
                               target.event_sequence, evidence)


def check_migration_compatibility(server_version_num: int, extensions: set[str],
                                  *, expected_major: int) -> int:
    if (type(server_version_num) is not int or expected_major not in (15, 18)
            or server_version_num // 10000 != expected_major
            or not {"plpgsql", "vector"}.issubset(extensions)):
        raise RecoveryMismatch("MIGRATION_COMPATIBILITY_MISMATCH")
    return expected_major
