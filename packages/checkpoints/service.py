"""Checkpoint creation bound to verified artifacts and Event sequence."""

from __future__ import annotations

from packages.artifacts.store import ArtifactStore
from packages.persistence.artifact_checkpoint_repository import ArtifactCheckpointRepository

from .models import Checkpoint, CheckpointRequest


class CheckpointError(ValueError):
    pass


class ArtifactBindingError(CheckpointError):
    pass


class EventSequenceError(CheckpointError):
    pass


class CheckpointService:
    def __init__(self, repository: ArtifactCheckpointRepository, artifact_store: ArtifactStore) -> None:
        self._repository = repository
        self._artifact_store = artifact_store

    def create(self, request: CheckpointRequest) -> Checkpoint:
        artifact = self._repository.get_artifact(request.state_artifact_id)
        if artifact is None:
            raise ArtifactBindingError("state artifact must already be stored")
        if artifact.artifact_type != "CHECKPOINT_STATE":
            raise ArtifactBindingError("state artifact has the wrong type")
        if artifact.run_id != request.run_id:
            raise ArtifactBindingError("state artifact belongs to a different run")
        if artifact.content_hash != request.state_artifact_hash:
            raise ArtifactBindingError("state artifact hash mismatch")
        self._artifact_store.read(artifact)
        if not self._repository.has_event_sequence(request.run_id, request.source_event_sequence):
            raise EventSequenceError("source Event sequence does not exist")
        latest = self._repository.latest_checkpoint(request.run_id)
        if latest is not None and request.source_event_sequence <= latest.source_event_sequence:
            raise EventSequenceError("checkpoint source Event sequence cannot move backward or repeat")
        checkpoint = Checkpoint.from_request(request)
        self._repository.save_checkpoint(checkpoint)
        return checkpoint
