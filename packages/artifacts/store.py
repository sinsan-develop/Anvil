"""Filesystem adapter for immutable content-addressed artifacts."""

from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from typing import Protocol, runtime_checkable

from .models import ArtifactMetadata, ArtifactWriteRequest


class ArtifactStoreError(ValueError):
    pass


class ArtifactIntegrityError(ArtifactStoreError):
    pass


class ArtifactCollision(ArtifactStoreError):
    pass


class ArtifactPathViolation(ArtifactStoreError):
    pass


@runtime_checkable
class ArtifactStore(Protocol):
    def put(self, request: ArtifactWriteRequest, content: bytes) -> ArtifactMetadata: ...

    def read(self, metadata: ArtifactMetadata) -> bytes: ...


class FileSystemArtifactStore:
    def __init__(self, root: Path) -> None:
        if not isinstance(root, Path):
            raise TypeError("root must be pathlib.Path")
        root.mkdir(parents=True, exist_ok=True)
        self._root = root.resolve(strict=True)

    def _safe_path(self, storage_ref: str, *, strict: bool) -> Path:
        relative = Path(storage_ref)
        if relative.is_absolute() or ".." in relative.parts:
            raise ArtifactPathViolation("artifact reference must stay below configured root")
        candidate = self._root / storage_ref
        resolved = candidate.resolve(strict=strict)
        if not resolved.is_relative_to(self._root):
            raise ArtifactPathViolation("artifact path escapes configured root")
        return resolved

    @staticmethod
    def _content_hash(content: bytes) -> str:
        return f"sha256:{sha256(content).hexdigest()}"

    def put(self, request: ArtifactWriteRequest, content: bytes) -> ArtifactMetadata:
        if not isinstance(content, bytes):
            raise TypeError("artifact content must be bytes")
        actual_hash = self._content_hash(content)
        if actual_hash != request.expected_content_hash or len(content) != request.expected_byte_size:
            raise ArtifactIntegrityError("artifact content hash or byte size mismatch")
        digest = actual_hash.removeprefix("sha256:")
        storage_ref = f"sha256/{digest[:2]}/{digest}"
        path = self._safe_path(storage_ref, strict=False)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() or path.is_symlink():
            if path.is_symlink():
                raise ArtifactPathViolation("artifact path must not be a symbolic link")
            if path.read_bytes() != content:
                raise ArtifactCollision("content-addressed reference contains different bytes")
        else:
            try:
                with path.open("xb") as stream:
                    stream.write(content)
                    stream.flush()
            except FileExistsError:
                if path.is_symlink():
                    raise ArtifactPathViolation("artifact path must not be a symbolic link")
                if path.read_bytes() != content:
                    raise ArtifactCollision("concurrent immutable artifact collision")
        return ArtifactMetadata(
            artifact_id=request.artifact_id,
            artifact_type=request.artifact_type,
            content_hash=actual_hash,
            byte_size=len(content),
            media_type=request.media_type,
            storage_ref=storage_ref,
            project_id=request.project_id,
            run_id=request.run_id,
            step_id=request.step_id,
            actor_id=request.actor_id,
            created_at=request.created_at,
            source_artifact_ids=request.source_artifact_ids,
        )

    def read(self, metadata: ArtifactMetadata) -> bytes:
        try:
            path = self._safe_path(metadata.storage_ref, strict=True)
        except FileNotFoundError as error:
            raise ArtifactIntegrityError("artifact content is missing") from error
        if path.is_symlink():
            raise ArtifactPathViolation("artifact path must not be a symbolic link")
        content = path.read_bytes()
        if len(content) != metadata.byte_size or self._content_hash(content) != metadata.content_hash:
            raise ArtifactIntegrityError("stored artifact no longer matches metadata")
        return content
