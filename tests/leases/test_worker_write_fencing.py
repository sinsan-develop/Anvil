from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import unittest
import uuid

from packages.leases.service import LeaseService, StaleFencingToken


NOW = datetime(2026, 8, 20, tzinfo=timezone.utc)


class WorkerWriteFencingTests(unittest.TestCase):
    def test_migration_has_write_fence_and_epoch_rotating_orphan_reclaim(self):
        migration = (Path(__file__).resolve().parents[2] / "migrations/versions/0008_queue_worker_leases.py").read_text(encoding="utf-8")
        self.assertIn("anvil_queue_reclaim_orphan", migration)
        self.assertIn("anvil_require_current_write_lease", migration)
        self.assertIn("STALE_FENCING_TOKEN", migration)
        self.assertIn("write_fencing_token", migration)
        self.assertIn("lease_epoch = lease_epoch + 1", migration)
        self.assertIn("write_epoch=p_write_epoch", migration)

    def test_takeover_rejects_stale_worker_and_write_tokens(self):
        service = LeaseService(token_factory=iter(("exec-1", "write-1", "exec-2", "write-2")).__next__)
        first_worker = service.issue_worker("run-1", "worker-a", NOW, timedelta(seconds=5))
        first_write = service.issue_write(first_worker, "repo-1:path.py:INSENSITIVE", NOW, timedelta(seconds=5))
        second_worker = service.take_over_expired("run-1", "worker-b", NOW + timedelta(seconds=6), timedelta(seconds=5))
        second_write = service.issue_write(second_worker, "repo-1:path.py:INSENSITIVE", NOW + timedelta(seconds=6), timedelta(seconds=5))

        with self.assertRaises(StaleFencingToken) as caught:
            service.require_current(
                "run-1", first_worker.execution_fencing_token, first_write.write_fencing_token, NOW + timedelta(seconds=6)
            )
        self.assertEqual("STALE_FENCING_TOKEN", caught.exception.code)
        service.require_current(
            "run-1", second_worker.execution_fencing_token, second_write.write_fencing_token, NOW + timedelta(seconds=6)
        )

    @unittest.skipUnless(os.environ.get("ANVIL_B09_PG18_DSN"), "isolated PostgreSQL 18 DSN not configured")
    def test_postgres_orphan_reclaim_and_write_guard_fail_closed(self):
        import psycopg

        suffix = uuid.uuid4().hex[:12]
        task_id = f"task-{suffix}"
        run_id = f"run-{suffix}"
        old_token = "old-execution-token-" + ("a" * 32)
        current_execution = f"current-execution-token-{suffix}-" + ("b" * 32)
        current_write = f"current-write-token-{suffix}-" + ("c" * 32)
        repository_id = f"repo-b09-{suffix}"
        dsn = os.environ["ANVIL_B09_PG18_DSN"]

        with psycopg.connect(dsn, autocommit=True) as connection:
            connection.execute(
                "INSERT INTO tasks(task_id,project_id,repository_id,title,objective,requested_by,status) "
                "VALUES (%s,'project-b09','repo-b09','B09','B09','main-agent-eoul','IN_PROGRESS')",
                (task_id,),
            )
            connection.execute(
                "INSERT INTO runs(run_id,task_id,baseline_id,phase,status,version) "
                "VALUES (%s,%s,'baseline-b09','B','ACTIVE',1)",
                (run_id, task_id),
            )

            for iteration in range(3):
                job_id = f"orphan-{suffix}-{iteration}"
                connection.execute(
                    "INSERT INTO durable_queue_jobs(job_id,run_id,payload,status,attempts,max_attempts,available_at,"
                    "lease_epoch,claimed_by_worker_id,execution_fencing_token,lease_expires_at) "
                    "VALUES (%s,%s,'{}','CLAIMED',1,4,CURRENT_TIMESTAMP,1,'crashed-worker',%s,"
                    "CURRENT_TIMESTAMP - interval '1 second')",
                    (job_id, run_id, old_token),
                )
                reclaimed = connection.execute(
                    "SELECT lease_epoch,claimed_by_worker_id,execution_fencing_token "
                    "FROM anvil_queue_reclaim_orphan(%s,%s,30)",
                    (job_id, f"recovery-worker-{iteration}"),
                ).fetchone()
                self.assertEqual(2, reclaimed[0])
                self.assertEqual(f"recovery-worker-{iteration}", reclaimed[1])
                self.assertNotEqual(old_token, reclaimed[2])
                with self.assertRaises(psycopg.Error) as stale_execution:
                    connection.execute("SELECT anvil_queue_heartbeat(%s,1,%s,30)", (job_id, old_token))
                self.assertIn("STALE_FENCING_TOKEN", str(stale_execution.exception))

            worker_lease_id = f"worker-lease-{suffix}"
            connection.execute(
                "INSERT INTO worker_leases(worker_lease_id,run_id,worker_id,lease_epoch,execution_fencing_token,issued_at,expires_at) "
                "VALUES (%s,%s,'main-agent-eoul',4,%s,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '5 minutes')",
                (worker_lease_id, run_id, current_execution),
            )
            connection.execute(
                "INSERT INTO write_leases(write_lease_id,worker_lease_id,run_id,repository_id,canonical_repo_relative_path,"
                "repository_case_policy,write_epoch,write_fencing_token,execution_fencing_token,issued_at,expires_at) "
                "VALUES (%s,%s,%s,%s,'packages/queue/service.py','INSENSITIVE',4,%s,%s,CURRENT_TIMESTAMP,"
                "CURRENT_TIMESTAMP + interval '5 minutes')",
                (f"write-lease-{suffix}", worker_lease_id, run_id, repository_id, current_write, current_execution),
            )
            connection.execute(
                "SELECT anvil_require_current_write_lease(%s,%s,4,%s,%s,'packages/queue/service.py','INSENSITIVE')",
                (run_id, current_execution, current_write, repository_id),
            )
            with self.assertRaises(psycopg.Error) as stale_write:
                connection.execute(
                    "SELECT anvil_require_current_write_lease(%s,%s,3,%s,%s,'packages/queue/service.py','INSENSITIVE')",
                    (run_id, current_execution, current_write, repository_id),
                )
            self.assertIn("STALE_FENCING_TOKEN", str(stale_write.exception))


if __name__ == "__main__":
    unittest.main()
