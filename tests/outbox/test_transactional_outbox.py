from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import unittest

from packages.outbox.models import OwnerType, ProgressExportRequest
from packages.outbox.service import (
    InMemoryProgressOutboxRepository,
    ProgressExportPending,
    TransactionalOutboxService,
)


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH = f"sha256:{'a' * 64}"


def request(*, request_id: str = "request-1", sequence: int = 1) -> ProgressExportRequest:
    return ProgressExportRequest(
        request_id=request_id,
        owner_type=OwnerType.RUN,
        owner_id="run-1",
        event_id=f"event-{sequence}",
        event_sequence=sequence,
        idempotency_key=f"run-1:{sequence}",
        payload_hash=HASH,
        export_uri="runs/run-1",
        status="ACTIVE",
        last_event_id=f"event-{sequence}",
        next_safe_action="continue",
        created_at=NOW,
    )


class TransactionalOutboxTests(unittest.TestCase):
    def test_event_and_outbox_commit_or_rollback_together(self):
        repository = InMemoryProgressOutboxRepository()
        service = TransactionalOutboxService(repository)

        receipt = service.commit_event_and_enqueue(request())

        self.assertEqual(("event-1",), repository.event_ids(OwnerType.RUN, "run-1"))
        self.assertEqual(receipt, repository.outbox_by_request_id("request-1"))

        repository.fail_next_enqueue = True
        with self.assertRaises(RuntimeError):
            service.commit_event_and_enqueue(request(request_id="request-2", sequence=2))
        self.assertEqual(("event-1",), repository.event_ids(OwnerType.RUN, "run-1"))
        self.assertIsNone(repository.outbox_by_request_id("request-2"))

    def test_ack_is_required_before_follow_up_scheduling(self):
        repository = InMemoryProgressOutboxRepository()
        service = TransactionalOutboxService(repository)
        receipt = service.commit_event_and_enqueue(request())

        with self.assertRaises(ProgressExportPending) as caught:
            service.require_export_acknowledged(OwnerType.RUN, "run-1", 1)
        self.assertEqual("PROGRESS_EXPORT_PENDING", caught.exception.code)

        repository.record_snapshot_and_ack(receipt.outbox_id, HASH, NOW)
        service.require_export_acknowledged(OwnerType.RUN, "run-1", 1)

    def test_migration_references_only_existing_predecessor_owner_schema(self):
        root = Path(__file__).resolve().parents[2]
        migration = (root / "migrations/versions/0007_progress_outbox.py").read_text(encoding="utf-8")
        self.assertNotIn('ForeignKey("projects.project_id"', migration)
        self.assertIn("SELECT 1 FROM tasks WHERE project_id = NEW.project_id", migration)


if __name__ == "__main__":
    unittest.main()
