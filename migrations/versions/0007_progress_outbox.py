"""Transactional progress outbox and immutable progress snapshots."""

from alembic import op
import sqlalchemy as sa


revision = "0007_progress_outbox"
down_revision = "0006_checkpoint_artifacts"
branch_labels = None
depends_on = None


_HASH_CHECK = "VALUE ~ '^sha256:[0-9a-f]{64}$'"


def _hash_constraint(column: str, name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(_HASH_CHECK.replace("VALUE", column), name=name)


def _owner_columns():
    return (
        sa.Column("owner_type", sa.String(16), nullable=False),
        sa.Column("owner_id", sa.String(128), nullable=False),
        sa.Column("project_id", sa.String(128)),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT")),
        sa.CheckConstraint("owner_type IN ('PROJECT','RUN')", name="ck_owner_type"),
        sa.CheckConstraint(
            "(owner_type = 'PROJECT' AND project_id = owner_id AND run_id IS NULL) OR "
            "(owner_type = 'RUN' AND run_id = owner_id AND project_id IS NULL)",
            name="ck_owner_binding",
        ),
    )


def upgrade():
    op.create_table(
        "progress_export_outbox",
        sa.Column("outbox_id", sa.String(128), primary_key=True),
        sa.Column("request_id", sa.String(128), nullable=False, unique=True),
        *_owner_columns(),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("event_sequence", sa.BigInteger(), nullable=False),
        sa.Column("idempotency_key", sa.String(200), nullable=False),
        sa.Column("request_hash", sa.String(71), nullable=False),
        sa.Column("payload_hash", sa.String(71), nullable=False),
        sa.Column("export_uri", sa.String(400), nullable=False),
        sa.Column("progress_status", sa.String(80), nullable=False),
        sa.Column("last_event_id", sa.String(128), nullable=False),
        sa.Column("next_safe_action", sa.Text(), nullable=False),
        sa.Column("outbox_status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("event_sequence > 0", name="ck_progress_outbox_positive_sequence"),
        sa.CheckConstraint("retry_count >= 0", name="ck_progress_outbox_nonnegative_retry"),
        sa.CheckConstraint("outbox_status IN ('PENDING','ACKNOWLEDGED','PERSISTENCE_ERROR')", name="ck_progress_outbox_status"),
        sa.CheckConstraint("(outbox_status = 'ACKNOWLEDGED') = (acknowledged_at IS NOT NULL)", name="ck_progress_outbox_ack_time"),
        _hash_constraint("request_hash", "ck_progress_outbox_request_hash"),
        _hash_constraint("payload_hash", "ck_progress_outbox_payload_hash"),
        sa.UniqueConstraint("owner_type", "owner_id", "event_sequence", name="uq_progress_outbox_owner_sequence"),
        sa.UniqueConstraint("owner_type", "owner_id", "idempotency_key", name="uq_progress_outbox_owner_idempotency"),
    )
    op.execute(
        """
        CREATE FUNCTION anvil_validate_progress_owner() RETURNS trigger AS $$
        BEGIN
          IF NEW.owner_type = 'PROJECT'
             AND NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = NEW.project_id) THEN
            RAISE EXCEPTION 'project progress owner does not exist in the current project-bearing schema';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER validate_progress_owner BEFORE INSERT ON progress_export_outbox FOR EACH ROW EXECUTE FUNCTION anvil_validate_progress_owner()")
    op.create_table(
        "progress_snapshots",
        sa.Column("snapshot_id", sa.String(128), primary_key=True),
        sa.Column("outbox_id", sa.String(128), sa.ForeignKey("progress_export_outbox.outbox_id", ondelete="RESTRICT"), nullable=False, unique=True),
        *_owner_columns(),
        sa.Column("event_sequence", sa.BigInteger(), nullable=False),
        sa.Column("payload_hash", sa.String(71), nullable=False),
        sa.Column("json_hash", sa.String(71), nullable=False),
        sa.Column("handoff_hash", sa.String(71), nullable=False),
        sa.Column("export_uri", sa.String(400), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("event_sequence > 0", name="ck_progress_snapshots_positive_sequence"),
        _hash_constraint("payload_hash", "ck_progress_snapshots_payload_hash"),
        _hash_constraint("json_hash", "ck_progress_snapshots_json_hash"),
        _hash_constraint("handoff_hash", "ck_progress_snapshots_handoff_hash"),
        sa.UniqueConstraint("owner_type", "owner_id", "event_sequence", name="uq_progress_snapshots_owner_sequence"),
    )
    op.execute(
        """
        CREATE FUNCTION anvil_validate_progress_snapshot() RETURNS trigger AS $$
        DECLARE source progress_export_outbox%ROWTYPE;
        BEGIN
          SELECT * INTO source FROM progress_export_outbox WHERE outbox_id = NEW.outbox_id FOR UPDATE;
          IF source.outbox_id IS NULL
             OR source.owner_type <> NEW.owner_type OR source.owner_id <> NEW.owner_id
             OR source.event_sequence <> NEW.event_sequence OR source.payload_hash <> NEW.payload_hash
             OR source.export_uri <> NEW.export_uri THEN
            RAISE EXCEPTION 'progress snapshot outbox binding mismatch';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER validate_progress_snapshot BEFORE INSERT ON progress_snapshots FOR EACH ROW EXECUTE FUNCTION anvil_validate_progress_snapshot()")
    op.execute(
        """
        CREATE FUNCTION anvil_guard_progress_outbox_update() RETURNS trigger AS $$
        BEGIN
          IF ROW(OLD.outbox_id, OLD.request_id, OLD.owner_type, OLD.owner_id, OLD.project_id, OLD.run_id,
                 OLD.event_id, OLD.event_sequence, OLD.idempotency_key, OLD.request_hash, OLD.payload_hash,
                 OLD.export_uri, OLD.progress_status, OLD.last_event_id, OLD.next_safe_action, OLD.created_at)
             IS DISTINCT FROM
             ROW(NEW.outbox_id, NEW.request_id, NEW.owner_type, NEW.owner_id, NEW.project_id, NEW.run_id,
                 NEW.event_id, NEW.event_sequence, NEW.idempotency_key, NEW.request_hash, NEW.payload_hash,
                 NEW.export_uri, NEW.progress_status, NEW.last_event_id, NEW.next_safe_action, NEW.created_at) THEN
            RAISE EXCEPTION 'progress outbox immutable binding changed';
          END IF;
          IF OLD.outbox_status = 'ACKNOWLEDGED' THEN
            RAISE EXCEPTION 'acknowledged progress outbox is immutable';
          END IF;
          IF NEW.retry_count < OLD.retry_count THEN
            RAISE EXCEPTION 'progress retry count cannot decrease';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER guard_progress_outbox_update BEFORE UPDATE ON progress_export_outbox FOR EACH ROW EXECUTE FUNCTION anvil_guard_progress_outbox_update()")
    op.execute(
        """
        CREATE FUNCTION anvil_forbid_progress_history_mutation() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'progress history is append-only';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER guard_progress_outbox_delete BEFORE DELETE ON progress_export_outbox FOR EACH ROW EXECUTE FUNCTION anvil_forbid_progress_history_mutation()")
    op.execute("CREATE TRIGGER guard_progress_snapshot_mutation BEFORE UPDATE OR DELETE ON progress_snapshots FOR EACH ROW EXECUTE FUNCTION anvil_forbid_progress_history_mutation()")


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS anvil_forbid_progress_history_mutation() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_guard_progress_outbox_update() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_validate_progress_snapshot() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_validate_progress_owner() CASCADE")
    op.drop_table("progress_snapshots")
    op.drop_table("progress_export_outbox")
