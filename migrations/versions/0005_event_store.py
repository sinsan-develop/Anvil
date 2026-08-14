"""Append-only Run Event Store with optimistic compare-and-append."""

from alembic import op
import sqlalchemy as sa


revision = "0005_event_store"
down_revision = "0004_execution_release"
branch_labels = None
depends_on = None


_BLOCKED_CODES = (
    "BASELINE_CONFLICT",
    "SCOPE_EXPANSION_REQUIRED",
    "PROTECTED_PATH_DENIED",
    "TOOLCHAIN_UNAVAILABLE",
    "VERIFICATION_ENV_UNAVAILABLE",
    "LLM_PROVIDER_UNAVAILABLE",
    "BUDGET_OR_QUOTA_EXCEEDED",
    "APPROVAL_EXPIRED",
    "WORKER_INTERRUPTED",
)


def upgrade():
    quoted_codes = ",".join(f"'{code}'" for code in _BLOCKED_CODES)
    op.create_table(
        "run_events",
        sa.Column("event_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("sequence_no", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False, index=True),
        sa.Column("actor_type", sa.String(20), nullable=False),
        sa.Column("actor_id", sa.String(200), nullable=False),
        sa.Column("correlation_id", sa.String(128), nullable=False),
        sa.Column("causation_event_id", sa.String(128)),
        sa.Column("idempotency_key", sa.String(200), nullable=False),
        sa.Column("expected_version", sa.Integer(), nullable=False),
        sa.Column("applied_version", sa.Integer(), nullable=False),
        sa.Column("request_hash", sa.String(71), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("blocked_code", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("sequence_no > 0", name="ck_run_events_positive_sequence"),
        sa.CheckConstraint("expected_version >= 0", name="ck_run_events_nonnegative_expected_version"),
        sa.CheckConstraint("applied_version = expected_version + 1", name="ck_run_events_version_step"),
        sa.CheckConstraint("request_hash ~ '^sha256:[0-9a-f]{64}$'", name="ck_run_events_request_hash"),
        sa.CheckConstraint(f"blocked_code IS NULL OR blocked_code IN ({quoted_codes})", name="ck_run_events_blocked_code"),
        sa.UniqueConstraint("run_id", "sequence_no", name="uq_run_events_run_sequence"),
        sa.UniqueConstraint("run_id", "idempotency_key", name="uq_run_events_run_idempotency"),
    )
    op.execute(
        """
        CREATE FUNCTION anvil_forbid_run_event_mutation() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'run_events are append-only';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        "CREATE TRIGGER guard_run_events_append_only BEFORE UPDATE OR DELETE ON run_events "
        "FOR EACH ROW EXECUTE FUNCTION anvil_forbid_run_event_mutation()"
    )
    op.execute(
        """
        CREATE FUNCTION anvil_append_run_event(
          p_event_id varchar(128),
          p_run_id varchar(128),
          p_event_type varchar(80),
          p_actor_type varchar(20),
          p_actor_id varchar(200),
          p_correlation_id varchar(128),
          p_causation_event_id varchar(128),
          p_idempotency_key varchar(200),
          p_expected_version integer,
          p_request_hash varchar(71),
          p_payload json,
          p_blocked_code varchar(100),
          p_created_at timestamptz
        ) RETURNS TABLE(out_event_id varchar(128), out_sequence_no bigint, out_applied_version integer, duplicate boolean) AS $$
        DECLARE
          current_version integer;
          current_event run_events%ROWTYPE;
          next_sequence bigint;
        BEGIN
          SELECT version INTO current_version FROM runs WHERE run_id = p_run_id FOR UPDATE;
          IF current_version IS NULL THEN
            RAISE EXCEPTION 'run does not exist';
          END IF;

          SELECT * INTO current_event
          FROM run_events
          WHERE event_id = p_event_id OR (run_id = p_run_id AND idempotency_key = p_idempotency_key)
          ORDER BY sequence_no
          LIMIT 1;
          IF FOUND THEN
            IF current_event.event_id <> p_event_id
               OR current_event.run_id <> p_run_id
               OR current_event.idempotency_key <> p_idempotency_key
               OR current_event.request_hash <> p_request_hash THEN
              RAISE EXCEPTION 'duplicate event identifier has a different canonical request';
            END IF;
            RETURN QUERY SELECT current_event.event_id, current_event.sequence_no, current_event.applied_version, true;
            RETURN;
          END IF;

          IF current_version <> p_expected_version THEN
            RAISE EXCEPTION 'optimistic version conflict: expected %, current %', p_expected_version, current_version
              USING ERRCODE = '40001';
          END IF;
          SELECT COALESCE(max(sequence_no), 0) + 1 INTO next_sequence FROM run_events WHERE run_id = p_run_id;

          INSERT INTO run_events (
            event_id, run_id, sequence_no, event_type, actor_type, actor_id, correlation_id,
            causation_event_id, idempotency_key, expected_version, applied_version, request_hash,
            payload, blocked_code, created_at
          ) VALUES (
            p_event_id, p_run_id, next_sequence, p_event_type, p_actor_type, p_actor_id, p_correlation_id,
            p_causation_event_id, p_idempotency_key, p_expected_version, p_expected_version + 1,
            p_request_hash, p_payload, p_blocked_code, p_created_at
          );
          UPDATE runs SET version = p_expected_version + 1
          WHERE run_id = p_run_id AND version = p_expected_version;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'optimistic version update failed' USING ERRCODE = '40001';
          END IF;
          RETURN QUERY SELECT p_event_id, next_sequence, p_expected_version + 1, false;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS anvil_append_run_event(varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, integer, varchar, json, varchar, timestamptz)")
    op.execute("DROP FUNCTION IF EXISTS anvil_forbid_run_event_mutation() CASCADE")
    op.drop_table("run_events")
