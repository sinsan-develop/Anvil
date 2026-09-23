"""E04 additive DAG constraints on the B09 durable queue owner."""
from alembic import op

revision = '0014_dag_queue'
down_revision = '0013_task_bootstrap_authority'
branch_labels = None
depends_on = None

CLAIM_SQL = """
CREATE OR REPLACE FUNCTION anvil_queue_claim_next(p_worker_id text, p_visibility_seconds integer)
RETURNS durable_queue_jobs AS $$
DECLARE claimed durable_queue_jobs%ROWTYPE; candidate durable_queue_jobs%ROWTYPE;
  conflict_key text; locks_acquired boolean; attempted_ids text[] := '{}';
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id))=0 OR p_visibility_seconds IS NULL OR p_visibility_seconds<=0
  THEN RAISE EXCEPTION 'QUEUE_CLAIM_INVALID'; END IF;
  -- Conflict locks are nonblocking and group-scoped: legacy independent rows
  -- retain B09 SKIP LOCKED behavior even while another claim is uncommitted.
  PERFORM anvil_queue_recover_orphans();
  UPDATE durable_queue_jobs SET status='QUARANTINED',execution_fencing_token=NULL,
    lease_expires_at=NULL,claimed_by_worker_id=NULL,last_error='MAX_ATTEMPTS_EXHAUSTED'
    WHERE status='PENDING' AND attempts>=max_attempts;
  INSERT INTO queue_quarantine(job_id,attempts,reason,quarantined_at)
    SELECT job_id,attempts,'MAX_ATTEMPTS_EXHAUSTED',CURRENT_TIMESTAMP FROM durable_queue_jobs
    WHERE status='QUARANTINED' ON CONFLICT(job_id) DO NOTHING;
  LOOP
    -- Query-FOR cursors can prefetch/lock multiple rows before the first RETURN.
    -- A bounded SELECT INTO locks only the candidate actually inspected.
    SELECT q.* INTO candidate FROM durable_queue_jobs q
    WHERE q.status='PENDING' AND q.attempts<q.max_attempts AND q.available_at<=CURRENT_TIMESTAMP
      AND NOT (q.job_id=ANY(attempted_ids))
      AND q.input_verified
      AND NOT EXISTS (
        SELECT 1 FROM unnest(q.dependency_ids) d(id)
        LEFT JOIN durable_queue_jobs parent ON parent.job_id=d.id
        WHERE parent.job_id IS NULL OR parent.status<>'SUCCEEDED'
          OR parent.run_id IS DISTINCT FROM q.run_id
          OR parent.graph_id IS DISTINCT FROM q.graph_id
          OR parent.graph_hash IS DISTINCT FROM q.graph_hash)
      AND NOT EXISTS (SELECT 1 FROM durable_queue_jobs busy
        WHERE busy.status='CLAIMED' AND busy.conflict_keys && q.conflict_keys)
    ORDER BY q.available_at,q.job_id FOR UPDATE SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN claimed; END IF;
    attempted_ids=array_append(attempted_ids,candidate.job_id);
    locks_acquired=true;
    FOREACH conflict_key IN ARRAY candidate.conflict_keys LOOP
      IF NOT pg_try_advisory_xact_lock(hashtextextended('anvil-queue-conflict:'||conflict_key,0))
      THEN locks_acquired=false; EXIT; END IF;
    END LOOP;
    IF NOT locks_acquired THEN CONTINUE; END IF;
    -- Fresh statement snapshot after taking group locks closes the commit race.
    IF EXISTS(SELECT 1 FROM durable_queue_jobs busy WHERE busy.status='CLAIMED'
      AND busy.conflict_keys && candidate.conflict_keys) THEN CONTINUE; END IF;
    UPDATE durable_queue_jobs SET status='CLAIMED',attempts=attempts+1,lease_epoch=lease_epoch+1,
      claimed_by_worker_id=p_worker_id,execution_fencing_token=replace(gen_random_uuid()::text,'-',''),
      lease_expires_at=CURRENT_TIMESTAMP+make_interval(secs=>p_visibility_seconds)
      WHERE job_id=candidate.job_id AND status='PENDING'
      RETURNING * INTO claimed;
    RETURN claimed;
  END LOOP;
  RETURN claimed;
END; $$ LANGUAGE plpgsql;
"""

COMPLETE_SQL = """
CREATE OR REPLACE FUNCTION anvil_queue_complete(p_job_id text,p_epoch bigint,p_token text)
RETURNS void AS $$
DECLARE current_job durable_queue_jobs%ROWTYPE; token_hash text;
BEGIN
  token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  SELECT * INTO current_job FROM durable_queue_jobs WHERE job_id=p_job_id FOR UPDATE;
  IF FOUND AND current_job.status='SUCCEEDED' AND current_job.lease_epoch=p_epoch
    AND current_job.completed_token_hash=token_hash THEN RETURN; END IF;
  UPDATE durable_queue_jobs SET status='SUCCEEDED',completed_token_hash=token_hash,
    execution_fencing_token=NULL,lease_expires_at=NULL,claimed_by_worker_id=NULL
    WHERE job_id=p_job_id AND status='CLAIMED' AND lease_epoch=p_epoch
      AND execution_fencing_token=p_token AND lease_expires_at>=CURRENT_TIMESTAMP;
  IF NOT FOUND THEN RAISE EXCEPTION 'STALE_FENCING_TOKEN'; END IF;
END; $$ LANGUAGE plpgsql;
"""


def upgrade():
    op.execute("""
    ALTER TABLE durable_queue_jobs
      ADD COLUMN graph_id varchar(128),
      ADD COLUMN graph_hash varchar(71),
      ADD COLUMN dependency_ids text[] NOT NULL DEFAULT '{}',
      ADD COLUMN conflict_keys text[] NOT NULL DEFAULT '{}',
      ADD COLUMN input_verified boolean NOT NULL DEFAULT true,
      ADD COLUMN completed_token_hash varchar(64),
      ADD CONSTRAINT ck_queue_graph_binding CHECK ((graph_id IS NULL)=(graph_hash IS NULL)),
      ADD CONSTRAINT ck_queue_graph_hash CHECK (graph_hash ~ '^sha256:[0-9a-f]{64}$'),
      ADD CONSTRAINT ck_queue_self_dependency CHECK (NOT job_id=ANY(dependency_ids));
    CREATE INDEX ix_queue_graph ON durable_queue_jobs(graph_id);
    """)
    op.execute(CLAIM_SQL)
    op.execute(COMPLETE_SQL)


def downgrade():
    # Never silently discard live DAG authority. Operator must drain/remove E04 jobs first.
    # Match register's advisory-before-table order; reversing it can deadlock a
    # registering transaction. Alembic's PostgreSQL DDL transaction retains both
    # locks through the recheck, function restoration, column DROP, and commit.
    # ACCESS EXCLUSIVE also fences direct SQL writers that bypass the adapter.
    op.execute("""
    SELECT pg_advisory_xact_lock(17004001);
    LOCK TABLE durable_queue_jobs IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM durable_queue_jobs WHERE graph_id IS NOT NULL)
      THEN RAISE EXCEPTION 'E04_DAG_ROWS_REQUIRE_EXPLICIT_ROLLBACK'; END IF;
    END $$;""")
    # Restore the original owner function definitions, without running its table migration.
    import ast
    from pathlib import Path
    tree=ast.parse((Path(__file__).with_name('0008_queue_worker_leases.py')).read_text(encoding='utf-8'))
    for item in ast.walk(tree):
        if not isinstance(item,ast.Call) or not isinstance(item.func,ast.Attribute) or item.func.attr!='execute' or not item.args:continue
        if not isinstance(item.args[0],ast.Constant) or not isinstance(item.args[0].value,str):continue
        sql=item.args[0].value
        for name in ('anvil_queue_claim_next','anvil_queue_complete'):
            marker='CREATE FUNCTION '+name
            if marker in sql:
                section=sql[sql.index(marker):]
                section=section[:section.index('$$ LANGUAGE plpgsql;')+len('$$ LANGUAGE plpgsql;')]
                op.execute(section.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1))
    op.execute("""DROP INDEX ix_queue_graph;
    ALTER TABLE durable_queue_jobs DROP CONSTRAINT ck_queue_graph_binding,
      DROP CONSTRAINT ck_queue_graph_hash,DROP CONSTRAINT ck_queue_self_dependency,
      DROP COLUMN graph_id,DROP COLUMN graph_hash,DROP COLUMN dependency_ids,
      DROP COLUMN conflict_keys,DROP COLUMN input_verified,DROP COLUMN completed_token_hash;""")
