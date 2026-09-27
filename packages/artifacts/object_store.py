"""Immutable content-addressed ArtifactStore over an injected S3 client."""

from __future__ import annotations

from hashlib import sha256
import re

from .models import ArtifactMetadata, ArtifactWriteRequest
from .store import ArtifactCollision, ArtifactIntegrityError, ArtifactPathViolation, ArtifactStoreError


_BUCKET = re.compile(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\Z")
_PREFIX_PART = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\Z")


def _status(error: Exception) -> int | None:
    response = getattr(error, "response", None)
    if not isinstance(response, dict):
        return None
    metadata = response.get("ResponseMetadata")
    if isinstance(metadata, dict) and type(metadata.get("HTTPStatusCode")) is int:
        return metadata["HTTPStatusCode"]
    detail = response.get("Error")
    if isinstance(detail, dict):
        code = detail.get("Code")
        if code in ("PreconditionFailed", "412"):
            return 412
        if code in ("ConditionalRequestConflict", "409"):
            return 409
    return None


class S3ArtifactStore:
    """Use a fixed bucket and canonical prefix; never select either from a request."""

    def __init__(self, client: object, *, bucket: str, prefix: str = "") -> None:
        if not isinstance(bucket, str) or _BUCKET.fullmatch(bucket) is None:
            raise ArtifactPathViolation("invalid artifact bucket")
        if not isinstance(prefix, str) or (prefix and not all(
            _PREFIX_PART.fullmatch(part) for part in prefix.split("/"))):
            raise ArtifactPathViolation("invalid artifact prefix")
        self._client = client
        self._bucket = bucket
        self._prefix = prefix

    def _key(self, content_hash: str) -> str:
        digest = content_hash.removeprefix("sha256:")
        relative = f"sha256/{digest[:2]}/{digest}"
        return f"{self._prefix}/{relative}" if self._prefix else relative

    def _get_bytes(self, key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
            body = response["Body"]
            try:
                content = body.read()
            finally:
                body.close()
        except Exception:
            raise ArtifactStoreError("object store read failed") from None
        if not isinstance(content, bytes):
            raise ArtifactIntegrityError("object store returned non-bytes content")
        return content

    def put(self, request: ArtifactWriteRequest, content: bytes) -> ArtifactMetadata:
        if not isinstance(request, ArtifactWriteRequest):
            raise TypeError("ArtifactWriteRequest required")
        if not isinstance(content, bytes):
            raise TypeError("artifact content must be bytes")
        content_hash = "sha256:" + sha256(content).hexdigest()
        if content_hash != request.expected_content_hash or len(content) != request.expected_byte_size:
            raise ArtifactIntegrityError("artifact content hash or byte size mismatch")
        key = self._key(content_hash)
        try:
            self._client.put_object(
                Bucket=self._bucket, Key=key, Body=content,
                IfNoneMatch="*", ContentType=request.media_type,
            )
        except Exception as error:
            if _status(error) != 412:
                raise ArtifactStoreError("object store conditional write failed") from None
            if self._get_bytes(key) != content:
                raise ArtifactCollision("content-addressed object contains different bytes") from None
        return ArtifactMetadata(
            artifact_id=request.artifact_id, artifact_type=request.artifact_type,
            content_hash=content_hash, byte_size=len(content), media_type=request.media_type,
            storage_ref=key, project_id=request.project_id, run_id=request.run_id,
            step_id=request.step_id, actor_id=request.actor_id, created_at=request.created_at,
            source_artifact_ids=request.source_artifact_ids,
        )

    def read(self, metadata: ArtifactMetadata) -> bytes:
        if not isinstance(metadata, ArtifactMetadata):
            raise TypeError("ArtifactMetadata required")
        if metadata.storage_ref != self._key(metadata.content_hash):
            raise ArtifactPathViolation("artifact reference does not match configured object key")
        content = self._get_bytes(metadata.storage_ref)
        if len(content) != metadata.byte_size or "sha256:" + sha256(content).hexdigest() != metadata.content_hash:
            raise ArtifactIntegrityError("stored artifact no longer matches metadata")
        return content
