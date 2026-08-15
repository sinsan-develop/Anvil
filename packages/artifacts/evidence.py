"""Immutable EvidenceManifest bound to one target and environment."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from types import MappingProxyType
from typing import Mapping

from .models import require_hash, require_text, require_utc


class EvidenceBindingError(ValueError):
    pass


class AcquisitionMode(str, Enum):
    REAL = "real"
    FIXTURE = "fixture"
    MOCK = "mock"
    STATIC = "static"


@dataclass(frozen=True, slots=True)
class RawArtifactChecksum:
    path: str
    bytes: int
    sha256: str
    target_hash: str
    environment_id: str

    def __post_init__(self) -> None:
        require_text(self.path, "path")
        if type(self.bytes) is not int or self.bytes < 0:
            raise ValueError("bytes must be a non-negative integer")
        require_hash(self.sha256, "sha256")
        require_hash(self.target_hash, "target_hash")
        require_text(self.environment_id, "environment_id")


@dataclass(frozen=True, slots=True)
class EvidenceManifest:
    manifest_id: str
    manifest_path: str
    design_baseline_hash: str
    work_plan_hash: str
    work_instruction_hash: str
    git_head: str
    git_status_before_ref: str
    git_status_after_ref: str
    target_hash: str
    delivered_artifact_hash: str
    container_image_digest: str
    db_migration_head: str
    config_revision_hash: str
    policy_hash: str
    provider_routing_snapshot_hash: str
    environment_id: str
    toolchain_versions: Mapping[str, str]
    commands: tuple[str, ...]
    started_at: datetime
    finished_at: datetime
    actor_id: str
    actor_role: str
    acquisition_mode: AcquisitionMode
    raw_artifact_checksums: tuple[RawArtifactChecksum, ...]
    skipped_or_blocked: tuple[str, ...]
    unverified_scope: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "commands", tuple(self.commands))
        object.__setattr__(self, "raw_artifact_checksums", tuple(self.raw_artifact_checksums))
        object.__setattr__(self, "skipped_or_blocked", tuple(self.skipped_or_blocked))
        object.__setattr__(self, "unverified_scope", tuple(self.unverified_scope))
        for value, field in (
            (self.manifest_id, "manifest_id"),
            (self.manifest_path, "manifest_path"),
            (self.git_head, "git_head"),
            (self.git_status_before_ref, "git_status_before_ref"),
            (self.git_status_after_ref, "git_status_after_ref"),
            (self.db_migration_head, "db_migration_head"),
            (self.environment_id, "environment_id"),
            (self.actor_id, "actor_id"),
            (self.actor_role, "actor_role"),
        ):
            require_text(value, field)
        for value, field in (
            (self.design_baseline_hash, "design_baseline_hash"),
            (self.work_plan_hash, "work_plan_hash"),
            (self.work_instruction_hash, "work_instruction_hash"),
            (self.target_hash, "target_hash"),
            (self.delivered_artifact_hash, "delivered_artifact_hash"),
            (self.container_image_digest, "container_image_digest"),
            (self.config_revision_hash, "config_revision_hash"),
            (self.policy_hash, "policy_hash"),
            (self.provider_routing_snapshot_hash, "provider_routing_snapshot_hash"),
        ):
            require_hash(value, field)
        if self.target_hash != self.delivered_artifact_hash:
            raise EvidenceBindingError("target and delivered artifact hashes must match")
        if not isinstance(self.acquisition_mode, AcquisitionMode):
            raise TypeError("acquisition_mode must be AcquisitionMode")
        require_utc(self.started_at, "started_at")
        require_utc(self.finished_at, "finished_at")
        if self.finished_at < self.started_at:
            raise EvidenceBindingError("finished_at cannot precede started_at")
        if not self.commands:
            raise EvidenceBindingError("commands must not be empty")
        for command in self.commands:
            require_text(command, "command")
        if not self.raw_artifact_checksums:
            raise EvidenceBindingError("raw artifact checksums must not be empty")
        paths = tuple(item.path for item in self.raw_artifact_checksums)
        if len(paths) != len(set(paths)):
            raise EvidenceBindingError("raw artifact paths must be unique")
        if self.manifest_path in paths:
            raise EvidenceBindingError("manifest cannot contain a checksum of itself")
        if any(item.target_hash != self.target_hash for item in self.raw_artifact_checksums):
            raise EvidenceBindingError("raw artifact target hash mismatch")
        if any(item.environment_id != self.environment_id for item in self.raw_artifact_checksums):
            raise EvidenceBindingError("raw artifact environment mismatch")
        for value in self.skipped_or_blocked:
            require_text(value, "skipped_or_blocked")
        for value in self.unverified_scope:
            require_text(value, "unverified_scope")
        frozen_toolchain: dict[str, str] = {}
        for key, value in self.toolchain_versions.items():
            require_text(key, "toolchain name")
            require_text(value, "toolchain version")
            frozen_toolchain[key] = value
        object.__setattr__(self, "toolchain_versions", MappingProxyType(frozen_toolchain))
