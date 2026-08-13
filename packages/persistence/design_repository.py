"""Persistence port for immutable design artifacts."""

from typing import Protocol

from packages.design.models import DecisionRecord


class DesignArtifactRepository(Protocol):
    def get(self, artifact_id: str) -> object | None: ...

    def save(self, artifact: object) -> None: ...

    def list_decisions(self, proposal_set_id: str) -> tuple[DecisionRecord, ...]: ...

