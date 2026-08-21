"""Durable process recovery inputs, decisions, audit, and fenced resume."""

from alembic import op
import sqlalchemy as sa


revision = "0010_recovery"
down_revision = "0009_intervention_budget"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "recovery_runs",
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("project_id", sa.String(128), nullable=False),
        sa.Column("environment_id", sa.String(128), nullable=False),
        sa.Column("db_event_sequence", sa.BigInteger(), nullable=False),
        sa.Column("progress_event_sequence", sa.BigInteger(), nullable=False),
        sa.Column("handoff_event_sequence", sa.BigInteger(), nullable=False),
        sa.Column("checkpoint_id", sa.String(128), nullable=False),
        sa.Column("checkpoint_hash", sa.String(71), nullable=False),
        sa.Column("target_hash", sa.String(71), nullable=False),
        sa.Column("git_head", sa.String(128), nullable=False),
        sa.Column("secret_reference", sa.String(512), nullable=False),
        sa.Column("secret_status", sa.String(16), nullable=False),
        sa.Column("capability_snapshot_hash", sa.String(71), nullable=False),
        sa.Column("current_capability_hash", sa.String(71), nullable=False),
        sa.Column("required_capabilities", sa.JSON(), nullable=False),
        sa.Column("current_capabilities", sa.JSON(), nullable=False),
        sa.CheckConstraint(
            "db_event_sequence>=0 AND progress_event_sequence>=0 AND handoff_event_sequence>=0",
            name="ck_recovery_sequences_nonnegative",
        ),
        sa.CheckConstraint(
            "secret_status IN ('ACTIVE','ROTATING','REVOKED','EXPIRED')",
            name="ck_recovery_secret_status",
        ),
        sa.CheckConstraint("secret_reference LIKE 'secret://%'", name="ck_recovery_secret_reference_only"),
    )
    op.create_table(
        "recovery_action_attempts",
        sa.Column("action_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("recovery_runs.run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False, unique=True),
        sa.Column("provider_receipt_ref", sa.String(256)),
        sa.CheckConstraint(
            "status IN ('SUCCESS','RUNNING','REQUEST_PREPARED','REQUEST_SENT')",
            name="ck_recovery_action_status",
        ),
    )
    op.create_index("ix_recovery_action_run_step", "recovery_action_attempts", ["run_id", "step_id"])
    op.create_table(
        "recovery_decisions",
        sa.Column("decision_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("recovery_runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_sequence", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("evidence_hash", sa.String(71), nullable=False),
        sa.Column("blocked_reason", sa.String(128)),
        sa.Column("next_action", sa.String(256), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("run_id", "event_sequence", "evidence_hash", name="uq_recovery_decision_evidence"),
    )
    op.create_table(
        "recovery_audit_events",
        sa.Column("audit_event_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("recovery_runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("secret_reference", sa.String(512)),
        sa.Column("reason", sa.String(128)),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "secret_reference IS NULL OR secret_reference LIKE 'secret://%'",
            name="ck_recovery_audit_reference_only",
        ),
    )
    op.create_table(
        "recovery_resume_receipts",
        sa.Column("run_id", sa.String(128), sa.ForeignKey("recovery_runs.run_id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("worker_lease_id", sa.String(128), sa.ForeignKey("worker_leases.worker_lease_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("write_lease_id", sa.String(128), sa.ForeignKey("write_leases.write_lease_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("worker_epoch", sa.BigInteger(), nullable=False),
        sa.Column("write_epoch", sa.BigInteger(), nullable=False),
        sa.Column("checkpoint_id", sa.String(128), nullable=False),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("worker_epoch>0 AND write_epoch>0", name="ck_recovery_resume_epochs"),
    )
    op.execute(
        """
        CREATE FUNCTION anvil_recovery_commit_resume(
          p_run_id text, p_worker_lease_id text, p_write_lease_id text,
          p_worker_epoch bigint, p_execution_token text,
          p_write_epoch bigint, p_write_token text, p_checkpoint_id text
        ) RETURNS recovery_resume_receipts AS $$
        DECLARE current_worker worker_leases%ROWTYPE;
        DECLARE current_write write_leases%ROWTYPE;
        DECLARE existing recovery_resume_receipts%ROWTYPE;
        DECLARE created recovery_resume_receipts%ROWTYPE;
        BEGIN
          SELECT * INTO current_worker FROM worker_leases
          WHERE worker_lease_id=p_worker_lease_id AND run_id=p_run_id
            AND lease_epoch=p_worker_epoch AND execution_fencing_token=p_execution_token
            AND expires_at>=CURRENT_TIMESTAMP
            AND lease_epoch=(SELECT max(lease_epoch) FROM worker_leases WHERE run_id=p_run_id)
          FOR UPDATE;
          IF NOT FOUND THEN RAISE EXCEPTION 'STALE_FENCING_TOKEN'; END IF;
          SELECT * INTO current_write FROM write_leases selected_write
          WHERE selected_write.write_lease_id=p_write_lease_id
            AND selected_write.worker_lease_id=p_worker_lease_id
            AND selected_write.run_id=p_run_id AND selected_write.write_epoch=p_write_epoch
            AND selected_write.write_fencing_token=p_write_token
            AND selected_write.execution_fencing_token=p_execution_token
            AND selected_write.expires_at>=CURRENT_TIMESTAMP
            AND selected_write.write_epoch=(
              SELECT max(candidate.write_epoch) FROM write_leases candidate
              WHERE candidate.run_id=selected_write.run_id
                AND candidate.repository_id=selected_write.repository_id
                AND candidate.canonical_repo_relative_path=selected_write.canonical_repo_relative_path
                AND candidate.repository_case_policy=selected_write.repository_case_policy
            )
          FOR UPDATE;
          IF NOT FOUND THEN RAISE EXCEPTION 'STALE_FENCING_TOKEN'; END IF;
          SELECT * INTO existing FROM recovery_resume_receipts WHERE run_id=p_run_id;
          IF FOUND THEN
            IF existing.worker_lease_id=p_worker_lease_id AND existing.write_lease_id=p_write_lease_id
               AND existing.worker_epoch=p_worker_epoch AND existing.write_epoch=p_write_epoch
               AND existing.checkpoint_id=p_checkpoint_id THEN RETURN existing; END IF;
            RAISE EXCEPTION 'STALE_FENCING_TOKEN';
          END IF;
          INSERT INTO recovery_resume_receipts(
            run_id,worker_lease_id,write_lease_id,worker_epoch,write_epoch,checkpoint_id
          ) VALUES (
            p_run_id,p_worker_lease_id,p_write_lease_id,p_worker_epoch,p_write_epoch,p_checkpoint_id
          ) RETURNING * INTO created;
          RETURN created;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS anvil_recovery_commit_resume(text,text,text,bigint,text,bigint,text,text)")
    op.drop_table("recovery_resume_receipts")
    op.drop_table("recovery_audit_events")
    op.drop_table("recovery_decisions")
    op.drop_index("ix_recovery_action_run_step", table_name="recovery_action_attempts")
    op.drop_table("recovery_action_attempts")
    op.drop_table("recovery_runs")
