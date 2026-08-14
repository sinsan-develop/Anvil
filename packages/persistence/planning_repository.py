"""Framework-independent persistence port for planning aggregates."""

from typing import Protocol

from packages.planning.approval import ApprovalRecord
from packages.planning.models import WorkPlan


class PlanningRepository(Protocol):
    def get_work_plan(self, artifact_id: str) -> WorkPlan | None: ...

    def save_work_plan(self, work_plan: WorkPlan) -> None: ...

    def get_approval(self, approval_id: str) -> ApprovalRecord | None: ...

    def save_approval(self, approval: ApprovalRecord) -> None: ...

    def invalidate_subject(self, subject_id: str, current_hash: str) -> int: ...
