"""S3 transport-boundary tests for the immutable ArtifactStore contract."""

from dataclasses import replace
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import tomllib

import pytest

from packages.artifacts.models import ArtifactWriteRequest
from packages.artifacts.store import ArtifactCollision, ArtifactIntegrityError, ArtifactPathViolation, ArtifactStore, ArtifactStoreError
from packages.artifacts.object_store import S3ArtifactStore


def digest(content: bytes) -> str:
    return "sha256:" + sha256(content).hexdigest()


def request(content: bytes, artifact_id: str = "artifact-1") -> ArtifactWriteRequest:
    return ArtifactWriteRequest(
        artifact_id=artifact_id, artifact_type="TEST_LOG", expected_content_hash=digest(content),
        expected_byte_size=len(content), media_type="text/plain", project_id="project-1",
        run_id="run-1", step_id="step-1", actor_id="tester-1",
        created_at=datetime(2026, 9, 25, tzinfo=timezone.utc), source_artifact_ids=(),
    )


class S3Error(Exception):
    def __init__(self, status: int, detail: str = "private-endpoint-and-secret") -> None:
        super().__init__(detail)
        self.response = {"ResponseMetadata": {"HTTPStatusCode": status}, "Error": {"Code": str(status)}}


class FakeS3:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.calls: list[tuple[str, dict]] = []
        self.put_error: Exception | None = None
        self.get_error: Exception | None = None

    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs))
        if self.put_error is not None:
            raise self.put_error
        key = kwargs["Key"]
        if key in self.objects:
            raise S3Error(412)
        self.objects[key] = kwargs["Body"]

    def get_object(self, **kwargs):
        self.calls.append(("get", kwargs))
        if self.get_error is not None:
            raise self.get_error
        return {"Body": BytesIO(self.objects[kwargs["Key"]])}


def test_put_is_conditional_content_addressed_and_read_verifies_bytes():
    client = FakeS3()
    store = S3ArtifactStore(client, bucket="artifact-bucket", prefix="f18-qa")
    content = b"immutable-result"
    metadata = store.put(request(content), content)
    key = f"f18-qa/sha256/{sha256(content).hexdigest()[:2]}/{sha256(content).hexdigest()}"
    assert isinstance(store, ArtifactStore)
    assert metadata.storage_ref == key
    assert client.calls[0] == ("put", {"Bucket": "artifact-bucket", "Key": key,
                                       "Body": content, "IfNoneMatch": "*", "ContentType": "text/plain"})
    assert store.read(metadata) == content
    assert client.calls[1] == ("get", {"Bucket": "artifact-bucket", "Key": key})


def test_hash_and_size_mismatch_fail_before_transport():
    client = FakeS3()
    store = S3ArtifactStore(client, bucket="artifact-bucket", prefix="f18-qa")
    content = b"actual"
    with pytest.raises(ArtifactIntegrityError):
        store.put(replace(request(content), expected_content_hash=digest(b"other")), content)
    with pytest.raises(ArtifactIntegrityError):
        store.put(replace(request(content), expected_byte_size=len(content) + 1), content)
    assert client.calls == []


def test_existing_identical_object_deduplicates_after_412_without_overwrite():
    client = FakeS3()
    store = S3ArtifactStore(client, bucket="artifact-bucket", prefix="f18-qa")
    first = store.put(request(b"same"), b"same")
    second = store.put(request(b"same", "artifact-2"), b"same")
    assert first.storage_ref == second.storage_ref
    assert second.artifact_id == "artifact-2"
    assert client.objects[first.storage_ref] == b"same"
    assert [name for name, _ in client.calls] == ["put", "put", "get"]


def test_existing_different_object_raises_collision_and_preserves_bytes():
    client = FakeS3()
    store = S3ArtifactStore(client, bucket="artifact-bucket", prefix="f18-qa")
    metadata = store.put(request(b"same"), b"same")
    client.objects[metadata.storage_ref] = b"collision"
    with pytest.raises(ArtifactCollision):
        store.put(request(b"same", "artifact-2"), b"same")
    assert client.objects[metadata.storage_ref] == b"collision"


def test_read_rejects_reference_tamper_and_corrupt_body():
    client = FakeS3()
    store = S3ArtifactStore(client, bucket="artifact-bucket", prefix="f18-qa")
    metadata = store.put(request(b"good"), b"good")
    before = len(client.calls)
    with pytest.raises(ArtifactPathViolation):
        store.read(replace(metadata, storage_ref="../other-bucket/key"))
    with pytest.raises(ArtifactPathViolation):
        store.read(replace(metadata, storage_ref=metadata.storage_ref.replace("f18-qa/", "other/")))
    assert len(client.calls) == before
    client.objects[metadata.storage_ref] = b"bad!"
    with pytest.raises(ArtifactIntegrityError):
        store.read(metadata)


@pytest.mark.parametrize("prefix", ["/absolute", "trailing/", "a//b", "a/../b", "a/./b", "a\\b"])
def test_prefix_must_be_canonical_and_not_traversable(prefix):
    with pytest.raises(ArtifactPathViolation):
        S3ArtifactStore(FakeS3(), bucket="artifact-bucket", prefix=prefix)


@pytest.mark.parametrize("status", [403, 409, 500])
def test_transport_and_conflict_errors_are_redacted_not_success(status):
    client = FakeS3()
    client.put_error = S3Error(status)
    store = S3ArtifactStore(client, bucket="artifact-bucket", prefix="f18-qa")
    with pytest.raises(ArtifactStoreError) as caught:
        store.put(request(b"content"), b"content")
    assert "private-endpoint-and-secret" not in str(caught.value)
    assert caught.value.__cause__ is None
    assert [name for name, _ in client.calls] == ["put"]


def test_dedupe_read_transport_error_is_redacted_and_never_returns_metadata():
    client = FakeS3()
    store = S3ArtifactStore(client, bucket="artifact-bucket", prefix="f18-qa")
    store.put(request(b"content"), b"content")
    client.get_error = S3Error(403)
    with pytest.raises(ArtifactStoreError) as caught:
        store.put(request(b"content", "artifact-2"), b"content")
    assert "private-endpoint-and-secret" not in str(caught.value)
    assert [name for name, _ in client.calls] == ["put", "put", "get"]


def test_boto3_is_locked_direct_runtime_dependency_and_image_requirement():
    root = Path(__file__).resolve().parents[2]
    project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    lock = tomllib.loads((root / "uv.lock").read_text(encoding="utf-8"))
    runtime = (root / "deploy/wsl/requirements-runtime.txt").read_text(encoding="utf-8").splitlines()
    assert any(row.startswith("boto3>=") for row in project["project"]["dependencies"])
    anvil = next(row for row in lock["package"] if row["name"] == "anvil")
    assert "boto3" in {row["name"] for row in anvil["dependencies"]}
    version = next(row["version"] for row in lock["package"] if row["name"] == "boto3")
    assert f"boto3=={version}" in runtime
