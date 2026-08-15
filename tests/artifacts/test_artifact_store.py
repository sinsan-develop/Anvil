from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from hashlib import sha256
import os
from pathlib import Path
import tempfile
import unittest

from packages.artifacts.models import ArtifactWriteRequest
from packages.artifacts.store import (
    ArtifactCollision,
    ArtifactIntegrityError,
    ArtifactPathViolation,
    FileSystemArtifactStore,
)


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)


def digest(content: bytes) -> str:
    return f"sha256:{sha256(content).hexdigest()}"


def request(content: bytes, *, artifact_id: str = "artifact-1", run_id: str = "run-1") -> ArtifactWriteRequest:
    return ArtifactWriteRequest(
        artifact_id=artifact_id,
        artifact_type="TEST_LOG",
        expected_content_hash=digest(content),
        expected_byte_size=len(content),
        media_type="text/plain",
        project_id="project-1",
        run_id=run_id,
        step_id="step-1",
        actor_id="tester-1",
        created_at=NOW,
        source_artifact_ids=(),
    )


class ArtifactStoreTests(unittest.TestCase):
    def test_large_content_is_stored_outside_metadata_and_verified_on_read(self):
        content = b"x" * (2 * 1024 * 1024)
        with tempfile.TemporaryDirectory() as directory:
            store = FileSystemArtifactStore(Path(directory))
            metadata = store.put(request(content), content)
            self.assertEqual(digest(content), metadata.content_hash)
            self.assertEqual(len(content), metadata.byte_size)
            self.assertFalse(hasattr(metadata, "content"))
            self.assertEqual(content, store.read(metadata))
            self.assertTrue((Path(directory) / metadata.storage_ref).is_file())

    def test_hash_and_size_mismatch_fail_before_write(self):
        content = b"actual"
        with tempfile.TemporaryDirectory() as directory:
            store = FileSystemArtifactStore(Path(directory))
            with self.assertRaises(ArtifactIntegrityError):
                store.put(replace(request(content), expected_content_hash=digest(b"other")), content)
            with self.assertRaises(ArtifactIntegrityError):
                store.put(replace(request(content), expected_byte_size=len(content) + 1), content)
            self.assertEqual((), tuple(Path(directory).rglob("*")))

    def test_identical_content_deduplicates_and_collision_is_immutable(self):
        content = b"same-content"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = FileSystemArtifactStore(root)
            first = store.put(request(content), content)
            second = store.put(request(content, artifact_id="artifact-2"), content)
            self.assertEqual(first.storage_ref, second.storage_ref)
            self.assertEqual(1, len(tuple(path for path in root.rglob("*") if path.is_file())))
            (root / first.storage_ref).write_bytes(b"hostile-collision")
            with self.assertRaises(ArtifactCollision):
                store.put(request(content, artifact_id="artifact-3"), content)

    def test_caller_owned_source_lineage_is_copied_immutably(self):
        content = b"lineage"
        sources = ["source-1"]
        hostile_request = replace(request(content), source_artifact_ids=sources)  # type: ignore[arg-type]
        with tempfile.TemporaryDirectory() as directory:
            metadata = FileSystemArtifactStore(Path(directory)).put(hostile_request, content)
        sources.append("source-2")
        self.assertEqual(("source-1",), hostile_request.source_artifact_ids)
        self.assertEqual(("source-1",), metadata.source_artifact_ids)

    def test_path_traversal_and_symlink_root_escape_fail_closed(self):
        content = b"content"
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root = Path(directory)
            store = FileSystemArtifactStore(root)
            metadata = store.put(request(content), content)
            with self.assertRaises(ArtifactPathViolation):
                store.read(replace(metadata, storage_ref="../outside"))

            target = root / metadata.storage_ref
            target.unlink()
            outside_file = Path(outside) / "outside.bin"
            outside_file.write_bytes(content)
            try:
                os.symlink(outside_file, target)
            except OSError as error:
                self.fail(f"symlink precondition unavailable: {error}")
            with self.assertRaises(ArtifactPathViolation):
                store.read(metadata)


if __name__ == "__main__":
    unittest.main()
