from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import unittest


class E04LegacyQueueCompatibilityTests(unittest.TestCase):
    def test_legacy_row_defaults_and_idempotent_success(self):
        from datetime import datetime, timedelta, timezone
        from packages.queue.models import QueueJob, QueueStatus
        from packages.queue.service import DurableQueue, QueueTokenError
        now=datetime(2026,9,17,tzinfo=timezone.utc)
        q=DurableQueue();job=QueueJob('legacy-e04','run','legacy payload',now,2)
        self.assertIsNone(job.graph_id);self.assertEqual((),job.dependency_ids)
        q.enqueue(job);claim=q.claim('worker',now,visibility_timeout=timedelta(seconds=2))
        first=q.complete(job.job_id,claim.execution_fencing_token,now)
        self.assertEqual(first,q.complete(job.job_id,claim.execution_fencing_token,now))
        self.assertEqual(QueueStatus.SUCCEEDED,first.status)
        with self.assertRaises(QueueTokenError):q.complete(job.job_id,'foreign',now)
import uuid

from packages.queue.models import QueueJob, QueueStatus
from packages.queue.service import DurableQueue, QueueTokenError


NOW = datetime(2026, 8, 20, tzinfo=timezone.utc)


class DurableQueueTests(unittest.TestCase):
    def test_migration_records_the_claiming_worker_in_the_atomic_claim(self):
        migration = (Path(__file__).resolve().parents[2] / "migrations/versions/0008_queue_worker_leases.py").read_text(encoding="utf-8")
        self.assertIn('sa.Column("claimed_by_worker_id"', migration)
        self.assertIn("claimed_by_worker_id = p_worker_id", migration)

    def test_migration_has_db_time_fencing_recovery_and_quarantine_contracts(self):
        migration = (Path(__file__).resolve().parents[2] / "migrations/versions/0008_queue_worker_leases.py").read_text(encoding="utf-8")
        for required in ("anvil_queue_heartbeat", "anvil_queue_recover_orphans", "anvil_queue_complete", "anvil_queue_fail", "STALE_FENCING_TOKEN", "FOR UPDATE SKIP LOCKED", "queue_quarantine"):
            self.assertIn(required, migration)

    def test_claim_is_single_owner_and_expired_claim_is_recovered(self):
        queue = DurableQueue(token_factory=iter(("token-1", "token-2")).__next__)
        queue.enqueue(QueueJob("job-1", "run-1", "payload", NOW, max_attempts=3))

        first = queue.claim("worker-a", NOW, visibility_timeout=timedelta(seconds=10))
        self.assertIsNotNone(first)
        self.assertEqual(1, first.lease_epoch)
        self.assertEqual("token-1", first.execution_fencing_token)
        self.assertIsNone(queue.claim("worker-b", NOW, visibility_timeout=timedelta(seconds=10)))

        recovered = queue.recover_expired(NOW + timedelta(seconds=11))
        self.assertEqual(("job-1",), recovered)
        second = queue.claim("worker-b", NOW + timedelta(seconds=11), visibility_timeout=timedelta(seconds=10))
        self.assertEqual(2, second.lease_epoch)
        with self.assertRaises(QueueTokenError) as caught:
            queue.complete("job-1", first.execution_fencing_token, NOW + timedelta(seconds=11))
        self.assertEqual("STALE_FENCING_TOKEN", caught.exception.code)
        queue.complete("job-1", second.execution_fencing_token, NOW + timedelta(seconds=11))
        self.assertEqual(QueueStatus.SUCCEEDED, queue.get("job-1").status)

    def test_poison_job_moves_to_quarantine_after_max_attempts(self):
        queue = DurableQueue(token_factory=lambda: "token")
        queue.enqueue(QueueJob("job-poison", "run-1", "payload", NOW, max_attempts=2))
        first = queue.claim("worker-a", NOW, visibility_timeout=timedelta(seconds=1))
        queue.fail("job-poison", first.execution_fencing_token, NOW, "transient")
        second = queue.claim("worker-a", NOW + timedelta(seconds=1), visibility_timeout=timedelta(seconds=1))
        queue.fail("job-poison", second.execution_fencing_token, NOW + timedelta(seconds=1), "poison")

        job = queue.get("job-poison")
        self.assertEqual(QueueStatus.QUARANTINED, job.status)
        self.assertEqual("poison", queue.quarantine()[0].reason)

    def test_expired_max_attempt_job_is_quarantined_without_blocking_next_claim(self):
        queue = DurableQueue(token_factory=lambda: "next-token")
        queue.enqueue(
            QueueJob(
                "00-expired-max",
                "run-1",
                "payload",
                NOW,
                max_attempts=1,
                status=QueueStatus.CLAIMED,
                attempts=1,
                lease_epoch=1,
                execution_fencing_token="old-token",
                lease_expires_at=NOW,
            )
        )
        queue.enqueue(QueueJob("01-forward-progress", "run-1", "payload", NOW, max_attempts=2))

        recovered = queue.recover_expired(NOW + timedelta(seconds=1))
        self.assertEqual(("00-expired-max",), recovered)
        self.assertEqual(QueueStatus.QUARANTINED, queue.get("00-expired-max").status)
        self.assertEqual("VISIBILITY_TIMEOUT_MAX_ATTEMPTS", queue.quarantine()[0].reason)
        claim = queue.claim("worker-next", NOW + timedelta(seconds=1), visibility_timeout=timedelta(seconds=5))
        self.assertEqual("01-forward-progress", claim.job_id)

    @unittest.skipUnless(os.environ.get("ANVIL_B09_PG18_DSN"), "isolated PostgreSQL 18 DSN not configured")
    def test_postgres_skip_locked_and_poison_quarantine(self):
        import psycopg

        suffix = uuid.uuid4().hex[:12]
        task_id = f"task-queue-{suffix}"
        run_id = f"run-queue-{suffix}"
        dsn = os.environ["ANVIL_B09_PG18_DSN"]
        with psycopg.connect(dsn, autocommit=True) as setup:
            setup.execute(
                "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                "VALUES (%s,'project-b09','repo-b09','B09','B09','main-agent-eoul','IN_PROGRESS')",
                (task_id,),
            )
            setup.execute(
                "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
                "VALUES (%s,%s,'baseline-b09','B','ACTIVE',1)",
                (run_id, task_id),
            )
            for job_id in (f"claim-a-{suffix}", f"claim-b-{suffix}"):
                setup.execute(
                    "INSERT INTO durable_queue_jobs(job_id,run_id,payload,status,attempts,max_attempts,available_at) "
                    "VALUES (%s,%s,'{}','PENDING',0,3,CURRENT_TIMESTAMP)",
                    (job_id, run_id),
                )

        with psycopg.connect(dsn) as first, psycopg.connect(dsn, autocommit=True) as second:
            first_claim = first.execute(
                "SELECT job_id FROM anvil_queue_claim_next('worker-first',30)"
            ).fetchone()[0]
            second_claim = second.execute(
                "SELECT job_id FROM anvil_queue_claim_next('worker-second',30)"
            ).fetchone()[0]
            self.assertNotEqual(first_claim, second_claim)
            first.commit()

        poison_id = f"poison-{suffix}"
        with psycopg.connect(dsn, autocommit=True) as connection:
            connection.execute(
                "INSERT INTO durable_queue_jobs(job_id,run_id,payload,status,attempts,max_attempts,available_at) "
                "VALUES (%s,%s,'{}','PENDING',0,1,CURRENT_TIMESTAMP - interval '1 minute')",
                (poison_id, run_id),
            )
            claim = connection.execute(
                "SELECT job_id,lease_epoch,execution_fencing_token FROM anvil_queue_claim_next('worker-poison',30)"
            ).fetchone()
            self.assertEqual(poison_id, claim[0])
            connection.execute(
                "SELECT anvil_queue_fail(%s,%s,%s,'poison')",
                (claim[0], claim[1], claim[2]),
            )
            status = connection.execute(
                "SELECT status FROM durable_queue_jobs WHERE job_id=%s", (poison_id,)
            ).fetchone()[0]
            quarantine = connection.execute(
                "SELECT attempts,reason FROM queue_quarantine WHERE job_id=%s", (poison_id,)
            ).fetchone()
            self.assertEqual("QUARANTINED", status)
            self.assertEqual((1, "poison"), quarantine)

            max_orphan = f"00-max-orphan-{suffix}"
            forward = f"01-forward-{suffix}"
            connection.execute(
                "INSERT INTO durable_queue_jobs(job_id,run_id,payload,status,attempts,max_attempts,available_at,"
                "lease_epoch,claimed_by_worker_id,execution_fencing_token,lease_expires_at) "
                "VALUES (%s,%s,'{}','CLAIMED',1,1,CURRENT_TIMESTAMP,1,'crashed-worker',%s,"
                "CURRENT_TIMESTAMP - interval '1 second')",
                (max_orphan, run_id, "expired-token-" + ("x" * 32)),
            )
            connection.execute(
                "INSERT INTO durable_queue_jobs(job_id,run_id,payload,status,attempts,max_attempts,available_at) "
                "VALUES (%s,%s,'{}','PENDING',0,2,CURRENT_TIMESTAMP)",
                (forward, run_id),
            )
            connection.execute("SELECT anvil_queue_recover_orphans()")
            self.assertEqual(
                "QUARANTINED",
                connection.execute(
                    "SELECT status FROM durable_queue_jobs WHERE job_id=%s", (max_orphan,)
                ).fetchone()[0],
            )
            self.assertEqual(
                forward,
                connection.execute(
                    "SELECT job_id FROM anvil_queue_claim_next('worker-forward',30)"
                ).fetchone()[0],
            )


if __name__ == "__main__":
    unittest.main()
