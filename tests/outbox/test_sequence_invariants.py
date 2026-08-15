from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
import unittest

from packages.outbox.models import OwnerType, ProgressExportRequest
from packages.outbox.service import (
    DuplicateProgressRequestConflict,
    InMemoryProgressOutboxRepository,
    ProgressSequenceError,
    TransactionalOutboxService,
)


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH = f"sha256:{'b' * 64}"


def request(sequence: int = 1) -> ProgressExportRequest:
    return ProgressExportRequest(
        request_id=f"request-{sequence}",
        owner_type=OwnerType.PROJECT,
        owner_id="project-1",
        event_id=f"event-{sequence}",
        event_sequence=sequence,
        idempotency_key=f"project-1:{sequence}",
        payload_hash=HASH,
        export_uri="projects/project-1",
        status="ACTIVE",
        last_event_id=f"event-{sequence}",
        next_safe_action="continue",
        created_at=NOW,
    )


class SequenceInvariantTests(unittest.TestCase):
    def test_sequence_must_increase_without_regression_or_gap(self):
        service = TransactionalOutboxService(InMemoryProgressOutboxRepository())
        service.commit_event_and_enqueue(request(1))
        for hostile in (replace(request(1), request_id="other"), request(3)):
            with self.assertRaises(ProgressSequenceError):
                service.commit_event_and_enqueue(hostile)

    def test_canonical_duplicate_returns_same_receipt_and_conflicts_fail_closed(self):
        service = TransactionalOutboxService(InMemoryProgressOutboxRepository())
        original = service.commit_event_and_enqueue(request())
        duplicate = service.commit_event_and_enqueue(request())
        self.assertEqual(original.outbox_id, duplicate.outbox_id)
        self.assertEqual(original.request_hash, duplicate.request_hash)
        self.assertTrue(duplicate.duplicate)

        with self.assertRaises(DuplicateProgressRequestConflict):
            service.commit_event_and_enqueue(replace(request(), payload_hash=f"sha256:{'c' * 64}"))
        with self.assertRaises(DuplicateProgressRequestConflict):
            service.commit_event_and_enqueue(replace(request(), owner_type=OwnerType.RUN))

    def test_owner_and_hash_fields_are_canonical(self):
        with self.assertRaises(ValueError):
            replace(request(), owner_id=" project-1 ")
        with self.assertRaises(ValueError):
            replace(request(), payload_hash="not-a-hash")
        with self.assertRaises(ValueError):
            replace(request(), owner_type="WORKSPACE")


if __name__ == "__main__":
    unittest.main()
