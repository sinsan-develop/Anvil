"""Framework-neutral metadata repository port for artifacts and checkpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from packages.artifacts.models import ArtifactMetadata
    from packages.checkpoints.models import Checkpoint


@runtime_checkable
class ArtifactCheckpointRepository(Protocol):
    def get_artifact(self, artifact_id: str) -> ArtifactMetadata | None: ...

    def save_artifact(self, artifact: ArtifactMetadata) -> None: ...

    def latest_checkpoint(self, run_id: str) -> Checkpoint | None: ...

    def has_event_sequence(self, run_id: str, sequence: int) -> bool: ...

    def save_checkpoint(self, checkpoint: Checkpoint) -> None: ...
