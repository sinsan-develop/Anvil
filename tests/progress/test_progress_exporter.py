from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from packages.outbox.models import OwnerType, ProgressExportRequest
from packages.outbox.service import InMemoryProgressOutboxRepository, TransactionalOutboxService
from packages.progress.exporter import AtomicProgressExporter, ProgressPersistenceError, UnsafeExportPath


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH = f"sha256:{'d' * 64}"


def request() -> ProgressExportRequest:
    return ProgressExportRequest(
        request_id="request-1",
        owner_type=OwnerType.RUN,
        owner_id="run-1",
        event_id="event-7",
        event_sequence=7,
        idempotency_key="run-1:7",
        payload_hash=HASH,
        export_uri="runs/run-1",
        status="PAUSED_USER",
        last_event_id="event-7",
        next_safe_action="wait for owner direction",
        created_at=NOW,
    )


class ProgressExporterTests(unittest.TestCase):
    def test_json_and_handoff_publish_same_event_before_snapshot_and_ack(self):
        with tempfile.TemporaryDirectory() as directory:
            repository = InMemoryProgressOutboxRepository()
            receipt = TransactionalOutboxService(repository).commit_event_and_enqueue(request())
            snapshot = AtomicProgressExporter(Path(directory), repository).export(receipt.outbox_id)

            json_path = Path(directory) / "runs/run-1/progress.json"
            handoff_path = Path(directory) / "runs/run-1/BUILD_HANDOFF.md"
            payload = json.loads(json_path.read_text(encoding="utf-8"))
            handoff = handoff_path.read_text(encoding="utf-8")
            self.assertEqual(7, payload["event_sequence"])
            self.assertEqual("event-7", payload["last_event_id"])
            for expected in ("run-1", "7", "PAUSED_USER", "event-7", HASH, "wait for owner direction"):
                self.assertIn(expected, handoff)
            self.assertEqual(7, snapshot.event_sequence)
            self.assertEqual("ACKNOWLEDGED", repository.outbox_by_id(receipt.outbox_id).status.value)

    def test_traversal_symlink_escape_and_target_alias_collision_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for export_uri in ("../escape", "runs/../run-1", "runs/run-1/progress.json"):
                repository = InMemoryProgressOutboxRepository()
                receipt = TransactionalOutboxService(repository).commit_event_and_enqueue(
                    replace(request(), request_id=export_uri, idempotency_key=export_uri, export_uri=export_uri)
                )
                with self.assertRaises(UnsafeExportPath):
                    AtomicProgressExporter(root, repository).export(receipt.outbox_id)
                self.assertEqual("PERSISTENCE_ERROR", repository.outbox_by_id(receipt.outbox_id).status.value)

            outside = root.parent / f"{root.name}-outside"
            outside.mkdir(exist_ok=True)
            link = root / "linked"
            try:
                link.symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest("symlink creation is unavailable")
            repository = InMemoryProgressOutboxRepository()
            receipt = TransactionalOutboxService(repository).commit_event_and_enqueue(
                replace(request(), export_uri="linked/run-1")
            )
            with self.assertRaises(UnsafeExportPath):
                AtomicProgressExporter(root, repository).export(receipt.outbox_id)

    def test_replace_or_snapshot_ack_failure_stops_without_false_ack_and_retries_same_outbox(self):
        with tempfile.TemporaryDirectory() as directory:
            repository = InMemoryProgressOutboxRepository()
            receipt = TransactionalOutboxService(repository).commit_event_and_enqueue(request())
            exporter = AtomicProgressExporter(Path(directory), repository)
            with patch("packages.progress.exporter.os.replace", side_effect=OSError("injected replace failure")):
                with self.assertRaises(ProgressPersistenceError):
                    exporter.export(receipt.outbox_id)
            failed = repository.outbox_by_id(receipt.outbox_id)
            self.assertEqual("PERSISTENCE_ERROR", failed.status.value)
            self.assertEqual(1, failed.retry_count)
            self.assertEqual((), repository.snapshots_for(OwnerType.RUN, "run-1"))

            repository.fail_next_ack = True
            with self.assertRaises(ProgressPersistenceError):
                exporter.export(receipt.outbox_id)
            self.assertEqual("PERSISTENCE_ERROR", repository.outbox_by_id(receipt.outbox_id).status.value)
            self.assertEqual((), repository.snapshots_for(OwnerType.RUN, "run-1"))

            snapshot = exporter.export(receipt.outbox_id)
            self.assertEqual(receipt.outbox_id, snapshot.outbox_id)
            self.assertEqual("ACKNOWLEDGED", repository.outbox_by_id(receipt.outbox_id).status.value)


if __name__ == "__main__":
    unittest.main()
