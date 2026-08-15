from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest

from packages.outbox.models import OwnerType, ProgressExportRequest
from packages.outbox.service import InMemoryProgressOutboxRepository, TransactionalOutboxService
from packages.progress.exporter import AtomicProgressExporter, CrashPoint, SimulatedCrash


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH = f"sha256:{'e' * 64}"


def request(iteration: int) -> ProgressExportRequest:
    return ProgressExportRequest(
        request_id=f"request-{iteration}",
        owner_type=OwnerType.RUN,
        owner_id=f"run-{iteration}",
        event_id=f"event-{iteration}",
        event_sequence=1,
        idempotency_key=f"run-{iteration}:1",
        payload_hash=HASH,
        export_uri=f"runs/run-{iteration}",
        status="ACTIVE",
        last_event_id=f"event-{iteration}",
        next_safe_action="continue",
        created_at=NOW,
    )


class CrashRecoveryTests(unittest.TestCase):
    def test_fi_01_02_03_recover_without_loss_duplicate_partial_or_early_schedule(self):
        for crash_point in CrashPoint:
            for iteration in range(3):
                with self.subTest(crash_point=crash_point.value, iteration=iteration):
                    with tempfile.TemporaryDirectory() as directory:
                        repository = InMemoryProgressOutboxRepository()
                        service = TransactionalOutboxService(repository)
                        receipt = service.commit_event_and_enqueue(request(iteration))
                        exporter = AtomicProgressExporter(Path(directory), repository)

                        if crash_point is CrashPoint.AFTER_DB_COMMIT_BEFORE_REPLACE:
                            with self.assertRaises(SimulatedCrash):
                                exporter.export(receipt.outbox_id, crash_at=crash_point)
                        else:
                            with self.assertRaises(SimulatedCrash):
                                exporter.export(receipt.outbox_id, crash_at=crash_point)

                        self.assertFalse(service.is_follow_up_allowed(OwnerType.RUN, f"run-{iteration}", 1))
                        snapshot = exporter.export(receipt.outbox_id)

                        target = Path(directory) / f"runs/run-{iteration}"
                        self.assertTrue((target / "progress.json").is_file())
                        self.assertTrue((target / "BUILD_HANDOFF.md").is_file())
                        self.assertEqual(1, len(repository.event_ids(OwnerType.RUN, f"run-{iteration}")))
                        self.assertEqual(1, len(repository.snapshots_for(OwnerType.RUN, f"run-{iteration}")))
                        self.assertEqual(1, snapshot.event_sequence)
                        self.assertTrue(service.is_follow_up_allowed(OwnerType.RUN, f"run-{iteration}", 1))


if __name__ == "__main__":
    unittest.main()
