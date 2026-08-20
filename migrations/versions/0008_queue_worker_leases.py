"""Durable queue plus worker/write lease fencing."""

from alembic import op
import sqlalchemy as sa


revision = "0008_queue_worker_leases"
down_revision = "0007_progress_outbox"
branch_labels = None
depends_on = None


_TOKEN_CHECK = "VALUE ~ '^[A-Za-z0-9_-]{32,}$'"


def _token_constraint(column: str, name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(_TOKEN_CHECK.replace("VALUE", column), name=name)


def upgrade():
    op.create_table(
        "durable_queue_jobs",
        sa.Column("job_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_epoch", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("claimed_by_worker_id", sa.String(128)),
        sa.Column("execution_fencing_token", sa.String(128)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("status IN ('PENDING','CLAIMED','SUCCEEDED','QUARANTINED')", name="ck_queue_job_status"),
        sa.CheckConstraint("attempts >= 0 AND max_attempts >= 1 AND attempts <= max_attempts", name="ck_queue_job_attempts"),
        sa.CheckConstraint("lease_epoch >= 0", name="ck_queue_job_lease_epoch"),
        sa.CheckConstraint(
            "(status = 'CLAIMED') = (execution_fencing_token IS NOT NULL AND lease_expires_at IS NOT NULL)",
            name="ck_queue_job_claim_binding",
        ),
        _token_constraint("execution_fencing_token", "ck_queue_job_execution_token"),
    )
    op.create_index("ix_queue_claimable", "durable_queue_jobs", ["status", "available_at", "job_id"])
    op.create_table(
        "queue_quarantine",
        sa.Column("job_id", sa.String(128), sa.ForeignKey("durable_queue_jobs.job_id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("quarantined_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("attempts > 0", name="ck_quarantine_attempts"),
    )
    op.create_table(
        "worker_leases",
        sa.Column("worker_lease_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("worker_id", sa.String(128), nullable=False),
        sa.Column("lease_epoch", sa.BigInteger(), nullable=False),
        sa.Column("execution_fencing_token", sa.String(128), nullable=False, unique=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("lease_epoch > 0", name="ck_worker_lease_epoch"),
        sa.CheckConstraint("expires_at > issued_at", name="ck_worker_lease_expiry"),
        _token_constraint("execution_fencing_token", "ck_worker_execution_token"),
        sa.UniqueConstraint("run_id", "lease_epoch", name="uq_worker_lease_run_epoch"),
    )
    op.create_table(
        "write_leases",
        sa.Column("write_lease_id", sa.String(128), primary_key=True),
        sa.Column("worker_lease_id", sa.String(128), sa.ForeignKey("worker_leases.worker_lease_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("run_id", sa.String(128), nullable=False),
        sa.Column("repository_id", sa.String(512), nullable=False),
        sa.Column("canonical_repo_relative_path", sa.String(1024), nullable=False),
        sa.Column("repository_case_policy", sa.String(16), nullable=False),
        sa.Column("write_epoch", sa.BigInteger(), nullable=False),
        sa.Column("write_fencing_token", sa.String(128), nullable=False, unique=True),
        sa.Column("execution_fencing_token", sa.String(128), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("repository_case_policy IN ('SENSITIVE','INSENSITIVE')", name="ck_write_lease_case_policy"),
        sa.CheckConstraint("write_epoch > 0 AND expires_at > issued_at", name="ck_write_lease_epoch_expiry"),
        _token_constraint("write_fencing_token", "ck_write_fencing_token"),
        _token_constraint("execution_fencing_token", "ck_write_execution_token"),
        sa.UniqueConstraint("repository_id", "canonical_repo_relative_path", "repository_case_policy", "write_epoch", name="uq_write_scope_epoch"),
    )
    op.create_index("ix_write_conflict_scope", "write_leases", ["repository_id", "canonical_repo_relative_path", "repository_case_policy", "expires_at"])
    op.execute(
        """
        CREATE FUNCTION anvil_queue_claim_next(p_worker_id text, p_visibility_seconds integer)
        RETURNS durable_queue_jobs AS $$
        DECLARE claimed durable_queue_jobs%ROWTYPE;
        BEGIN
          UPDATE durable_queue_jobs SET status='QUARANTINED',
              execution_fencing_token=NULL, lease_expires_at=NULL,
              claimed_by_worker_id=NULL, last_error='MAX_ATTEMPTS_EXHAUSTED'
          WHERE status='PENDING' AND attempts>=max_attempts;
          INSERT INTO queue_quarantine(job_id,attempts,reason,quarantined_at)
          SELECT job_id,attempts,'MAX_ATTEMPTS_EXHAUSTED',CURRENT_TIMESTAMP
          FROM durable_queue_jobs WHERE status='QUARANTINED'
          ON CONFLICT (job_id) DO NOTHING;
          UPDATE durable_queue_jobs SET status = 'CLAIMED', attempts = attempts + 1,
              lease_epoch = lease_epoch + 1, claimed_by_worker_id = p_worker_id,
              execution_fencing_token = replace(gen_random_uuid()::text, '-', ''),
              lease_expires_at = CURRENT_TIMESTAMP + make_interval(secs => p_visibility_seconds)
          WHERE job_id = (SELECT job_id FROM durable_queue_jobs
                           WHERE status = 'PENDING' AND attempts < max_attempts
                             AND available_at <= CURRENT_TIMESTAMP
                           ORDER BY available_at, job_id FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING * INTO claimed;
          RETURN claimed;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("""
    CREATE FUNCTION anvil_queue_heartbeat(p_job_id text, p_epoch bigint, p_token text, p_seconds integer) RETURNS void AS $$
    BEGIN
      UPDATE durable_queue_jobs SET lease_expires_at=CURRENT_TIMESTAMP + make_interval(secs=>p_seconds)
      WHERE job_id=p_job_id AND status='CLAIMED' AND lease_epoch=p_epoch AND execution_fencing_token=p_token AND lease_expires_at>=CURRENT_TIMESTAMP;
      IF NOT FOUND THEN RAISE EXCEPTION 'STALE_FENCING_TOKEN'; END IF;
    END; $$ LANGUAGE plpgsql;
    CREATE FUNCTION anvil_queue_recover_orphans() RETURNS integer AS $$
    DECLARE n integer; quarantined integer;
    BEGIN
      UPDATE durable_queue_jobs SET status='QUARANTINED',
        execution_fencing_token=NULL, lease_expires_at=NULL,
        claimed_by_worker_id=NULL, last_error='VISIBILITY_TIMEOUT_MAX_ATTEMPTS'
      WHERE status='CLAIMED' AND lease_expires_at<CURRENT_TIMESTAMP
        AND attempts>=max_attempts;
      GET DIAGNOSTICS quarantined=ROW_COUNT;
      INSERT INTO queue_quarantine(job_id,attempts,reason,quarantined_at)
      SELECT job_id,attempts,'VISIBILITY_TIMEOUT_MAX_ATTEMPTS',CURRENT_TIMESTAMP
      FROM durable_queue_jobs WHERE status='QUARANTINED'
      ON CONFLICT (job_id) DO NOTHING;
      UPDATE durable_queue_jobs SET status='PENDING', available_at=CURRENT_TIMESTAMP,
        execution_fencing_token=NULL, lease_expires_at=NULL, claimed_by_worker_id=NULL
      WHERE status='CLAIMED' AND lease_expires_at<CURRENT_TIMESTAMP;
      GET DIAGNOSTICS n=ROW_COUNT;
      RETURN n + quarantined;
    END; $$ LANGUAGE plpgsql;
    CREATE FUNCTION anvil_queue_reclaim_orphan(p_job_id text, p_worker_id text, p_visibility_seconds integer)
    RETURNS durable_queue_jobs AS $$
    DECLARE current_job durable_queue_jobs%ROWTYPE; reclaimed durable_queue_jobs%ROWTYPE;
    BEGIN
      SELECT * INTO current_job FROM durable_queue_jobs
      WHERE job_id=p_job_id AND status='CLAIMED' AND lease_expires_at<CURRENT_TIMESTAMP
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'STALE_FENCING_TOKEN';
      END IF;
      IF current_job.attempts>=current_job.max_attempts THEN
        UPDATE durable_queue_jobs SET status='QUARANTINED',
          execution_fencing_token=NULL, lease_expires_at=NULL,
          claimed_by_worker_id=NULL, last_error='VISIBILITY_TIMEOUT_MAX_ATTEMPTS'
        WHERE job_id=p_job_id RETURNING * INTO reclaimed;
        INSERT INTO queue_quarantine(job_id,attempts,reason,quarantined_at)
        VALUES (reclaimed.job_id,reclaimed.attempts,'VISIBILITY_TIMEOUT_MAX_ATTEMPTS',CURRENT_TIMESTAMP)
        ON CONFLICT (job_id) DO NOTHING;
        RETURN reclaimed;
      END IF;
      UPDATE durable_queue_jobs SET attempts=attempts+1,
        lease_epoch = lease_epoch + 1, claimed_by_worker_id=p_worker_id,
        execution_fencing_token=replace(gen_random_uuid()::text, '-', ''),
        lease_expires_at=CURRENT_TIMESTAMP + make_interval(secs=>p_visibility_seconds)
      WHERE job_id=p_job_id AND lease_epoch=current_job.lease_epoch
      RETURNING * INTO reclaimed;
      RETURN reclaimed;
    END; $$ LANGUAGE plpgsql;
    CREATE FUNCTION anvil_require_current_write_lease(
      p_run_id text, p_execution_token text, p_write_epoch bigint,
      p_write_token text, p_repository_id text, p_path text, p_case_policy text
    ) RETURNS void AS $$
    BEGIN
      PERFORM 1 FROM write_leases wl
      JOIN worker_leases worker ON worker.worker_lease_id=wl.worker_lease_id
      WHERE wl.run_id=p_run_id
        AND wl.execution_fencing_token=p_execution_token
        AND wl.write_epoch=p_write_epoch
        AND wl.write_fencing_token=p_write_token
        AND wl.repository_id=p_repository_id
        AND wl.canonical_repo_relative_path=p_path
        AND wl.repository_case_policy=p_case_policy
        AND wl.expires_at>=CURRENT_TIMESTAMP
        AND worker.run_id=p_run_id
        AND worker.execution_fencing_token=p_execution_token
        AND worker.expires_at>=CURRENT_TIMESTAMP;
      IF NOT FOUND THEN RAISE EXCEPTION 'STALE_FENCING_TOKEN'; END IF;
    END; $$ LANGUAGE plpgsql;
    CREATE FUNCTION anvil_queue_complete(p_job_id text, p_epoch bigint, p_token text) RETURNS void AS $$
    BEGIN UPDATE durable_queue_jobs SET status='SUCCEEDED', execution_fencing_token=NULL, lease_expires_at=NULL WHERE job_id=p_job_id AND lease_epoch=p_epoch AND execution_fencing_token=p_token AND lease_expires_at>=CURRENT_TIMESTAMP; IF NOT FOUND THEN RAISE EXCEPTION 'STALE_FENCING_TOKEN'; END IF; END; $$ LANGUAGE plpgsql;
    CREATE FUNCTION anvil_queue_fail(p_job_id text, p_epoch bigint, p_token text, p_reason text) RETURNS void AS $$
    BEGIN UPDATE durable_queue_jobs SET status=CASE WHEN attempts>=max_attempts THEN 'QUARANTINED' ELSE 'PENDING' END,last_error=p_reason,execution_fencing_token=NULL,lease_expires_at=NULL,available_at=CURRENT_TIMESTAMP WHERE job_id=p_job_id AND lease_epoch=p_epoch AND execution_fencing_token=p_token AND lease_expires_at>=CURRENT_TIMESTAMP; IF NOT FOUND THEN RAISE EXCEPTION 'STALE_FENCING_TOKEN'; END IF; INSERT INTO queue_quarantine(job_id,attempts,reason,quarantined_at) SELECT job_id,attempts,p_reason,CURRENT_TIMESTAMP FROM durable_queue_jobs WHERE job_id=p_job_id AND status='QUARANTINED' ON CONFLICT DO NOTHING; END; $$ LANGUAGE plpgsql;
    """)


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS anvil_require_current_write_lease(text,text,bigint,text,text,text,text); DROP FUNCTION IF EXISTS anvil_queue_reclaim_orphan(text,text,integer); DROP FUNCTION IF EXISTS anvil_queue_fail(text,bigint,text,text); DROP FUNCTION IF EXISTS anvil_queue_complete(text,bigint,text); DROP FUNCTION IF EXISTS anvil_queue_recover_orphans(); DROP FUNCTION IF EXISTS anvil_queue_heartbeat(text,bigint,text,integer)")
    op.execute("DROP FUNCTION IF EXISTS anvil_queue_claim_next(text, integer)")
    op.drop_index("ix_write_conflict_scope", table_name="write_leases")
    op.drop_table("write_leases")
    op.drop_table("worker_leases")
    op.drop_table("queue_quarantine")
    op.drop_index("ix_queue_claimable", table_name="durable_queue_jobs")
    op.drop_table("durable_queue_jobs")
