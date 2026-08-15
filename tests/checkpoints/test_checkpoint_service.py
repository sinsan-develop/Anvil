from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import tempfile
import unittest

from packages.artifacts.models import ArtifactMetadata, ArtifactWriteRequest
from packages.artifacts.store import FileSystemArtifactStore
from packages.checkpoints.models import CheckpointRequest
from packages.checkpoints.service import (
    ArtifactBindingError,
    CheckpointService,
    EventSequenceError,
)
from packages.persistence.artifact_checkpoint_repository import ArtifactCheckpointRepository


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)


class MemoryRepository:
    def __init__(self) -> None:
        self.artifacts: dict[str, ArtifactMetadata] = {}
        self.checkpoints: list[object] = []
        self.events: set[tuple[str, int]] = set()

    def get_artifact(self, artifact_id: str):
        return self.artifacts.get(artifact_id)

    def save_artifact(self, artifact: ArtifactMetadata) -> None:
        self.artifacts[artifact.artifact_id] = artifact

    def latest_checkpoint(self, run_id: str):
        matching = [item for item in self.checkpoints if item.run_id == run_id]
        return matching[-1] if matching else None

    def has_event_sequence(self, run_id: str, sequence: int) -> bool:
        return (run_id, sequence) in self.events

    def save_checkpoint(self, checkpoint) -> None:
        self.checkpoints.append(checkpoint)


def state_request(content: bytes, *, run_id: str = "run-1") -> ArtifactWriteRequest:
    return ArtifactWriteRequest(
        artifact_id="state-artifact-1",
        artifact_type="CHECKPOINT_STATE",
        expected_content_hash=f"sha256:{sha256(content).hexdigest()}",
        expected_byte_size=len(content),
        media_type="application/json",
        project_id="project-1",
        run_id=run_id,
        step_id=None,
        actor_id="worker-1",
        created_at=NOW,
        source_artifact_ids=(),
    )


def checkpoint_request(metadata: ArtifactMetadata, *, sequence: int = 2, run_id: str = "run-1") -> CheckpointRequest:
    return CheckpointRequest(
        checkpoint_id=f"checkpoint-{sequence}",
        run_id=run_id,
        thread_id="thread-1",
        graph_version="2.1.0",
        state_schema_version=4,
        source_event_sequence=sequence,
        next_nodes=("verify",),
        pending_writes=(),
        state_artifact_id=metadata.artifact_id,
        state_artifact_hash=metadata.content_hash,
        binding_hashes={"work_instruction": f"sha256:{'a' * 64}"},
        actor_id="worker-1",
        created_at=NOW,
    )


class CheckpointServiceTests(unittest.TestCase):
    def test_checkpoint_binds_verified_state_artifact_and_existing_event_sequence(self):
        with tempfile.TemporaryDirectory() as directory:
            store = FileSystemArtifactStore(Path(directory))
            repository = MemoryRepository()
            self.assertIsInstance(repository, ArtifactCheckpointRepository)
            metadata = store.put(state_request(b'{"state":1}'), b'{"state":1}')
            repository.artifacts[metadata.artifact_id] = metadata
            repository.events.add(("run-1", 2))

            checkpoint = CheckpointService(repository, store).create(checkpoint_request(metadata))

            self.assertEqual(2, checkpoint.source_event_sequence)
            self.assertEqual(metadata.content_hash, checkpoint.state_artifact_hash)
            self.assertEqual(("verify",), checkpoint.next_nodes)
            self.assertEqual(1, len(repository.checkpoints))

    def test_caller_owned_checkpoint_collections_are_copied_immutably(self):
        with tempfile.TemporaryDirectory() as directory:
            store = FileSystemArtifactStore(Path(directory))
            repository = MemoryRepository()
            metadata = store.put(state_request(b"state"), b"state")
            repository.save_artifact(metadata)
            repository.events.add(("run-1", 2))
            nodes = ["verify"]
            pending = ["write-1"]
            bindings = {"work_instruction": f"sha256:{'a' * 64}"}
            request_value = replace(
                checkpoint_request(metadata),
                next_nodes=nodes,
                pending_writes=pending,
                binding_hashes=bindings,
            )
            checkpoint = CheckpointService(repository, store).create(request_value)
            nodes.append("mutated")
            pending.clear()
            bindings.clear()
            self.assertEqual(("verify",), checkpoint.next_nodes)
            self.assertEqual(("write-1",), checkpoint.pending_writes)
            self.assertEqual(("work_instruction",), tuple(checkpoint.binding_hashes))

    def test_sequence_regression_or_missing_event_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            store = FileSystemArtifactStore(Path(directory))
            repository = MemoryRepository()
            metadata = store.put(state_request(b"state"), b"state")
            repository.artifacts[metadata.artifact_id] = metadata
            repository.events.update({("run-1", 1), ("run-1", 2)})
            service = CheckpointService(repository, store)
            service.create(checkpoint_request(metadata, sequence=2))
            with self.assertRaises(EventSequenceError):
                service.create(checkpoint_request(metadata, sequence=1))
            with self.assertRaises(EventSequenceError):
                service.create(checkpoint_request(metadata, sequence=3))
            self.assertEqual(1, len(repository.checkpoints))

    def test_unstored_hash_mismatched_or_other_run_artifact_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            store = FileSystemArtifactStore(Path(directory))
            repository = MemoryRepository()
            metadata = store.put(state_request(b"state"), b"state")
            repository.events.add(("run-1", 2))
            service = CheckpointService(repository, store)
            hostile = (
                checkpoint_request(metadata),
                replace(checkpoint_request(metadata), state_artifact_hash=f"sha256:{'b' * 64}"),
            )
            with self.assertRaises(ArtifactBindingError):
                service.create(hostile[0])
            repository.artifacts[metadata.artifact_id] = replace(metadata, run_id="run-other")
            with self.assertRaises(ArtifactBindingError):
                service.create(hostile[1])
            self.assertEqual((), tuple(repository.checkpoints))


if __name__ == "__main__":
    unittest.main()
