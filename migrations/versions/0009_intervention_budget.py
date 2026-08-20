"""Human intervention receipts and atomic provider budget reservation."""

from alembic import op
import sqlalchemy as sa


revision = "0009_intervention_budget"
down_revision = "0008_queue_worker_leases"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "human_intervention_receipts",
        sa.Column("receipt_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("new_action_blocked_at", sa.DateTime(timezone=True)),
        sa.Column("effective_at", sa.DateTime(timezone=True)),
        sa.Column("target_action_status", sa.String(64)),
        sa.Column("irreversible_receipt_ref", sa.String(256)),
        sa.CheckConstraint(
            "kind IN ('QUERY_PROGRESS','CONTEXT_SUPPLEMENT','PRIORITY_CHANGE','PLAN_CHANGE','STOP','CANCEL','TAKEOVER')",
            name="ck_human_intervention_kind",
        ),
        sa.CheckConstraint(
            "(acknowledged_at IS NULL OR acknowledged_at >= requested_at) AND "
            "(new_action_blocked_at IS NULL OR (acknowledged_at IS NOT NULL AND new_action_blocked_at >= acknowledged_at)) AND "
            "(effective_at IS NULL OR (new_action_blocked_at IS NOT NULL AND effective_at > new_action_blocked_at "
            "AND effective_at > requested_at))",
            name="ck_human_intervention_time_order",
        ),
    )
    op.create_index(
        "ix_human_intervention_run_requested",
        "human_intervention_receipts",
        ["run_id", "requested_at", "receipt_id"],
    )
    op.create_table(
        "budget_ledgers",
        sa.Column("budget_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("hard_cost_limit", sa.Numeric(20, 8), nullable=False),
        sa.Column("hard_token_limit", sa.BigInteger(), nullable=False),
        sa.Column("max_concurrent_requests", sa.Integer(), nullable=False),
        sa.Column("new_action_allowed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "hard_cost_limit >= 0 AND hard_token_limit >= 0 AND max_concurrent_requests > 0",
            name="ck_budget_ledger_limits",
        ),
    )
    op.create_table(
        "budget_reservations",
        sa.Column("reservation_id", sa.String(128), primary_key=True),
        sa.Column("budget_id", sa.String(128), sa.ForeignKey("budget_ledgers.budget_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("step_id", sa.String(128), nullable=False),
        sa.Column("request_id", sa.String(128), nullable=False, unique=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model", sa.String(256), nullable=False),
        sa.Column("pricing_version", sa.String(128), nullable=False),
        sa.Column("reserved_cost", sa.Numeric(20, 8), nullable=False),
        sa.Column("reserved_tokens", sa.BigInteger(), nullable=False),
        sa.Column("consumed_cost", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("consumed_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("released_cost", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("released_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="RESERVED"),
        sa.Column("provider_receipt_ref", sa.String(256)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("reconciled_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "reserved_cost >= 0 AND reserved_tokens >= 0 AND consumed_cost >= 0 AND consumed_tokens >= 0 "
            "AND released_cost >= 0 AND released_tokens >= 0",
            name="ck_budget_reservation_usage_nonnegative",
        ),
        sa.CheckConstraint(
            "status IN ('RESERVED','CONSUMED','RECONCILIATION_REQUIRED')",
            name="ck_budget_reservation_status",
        ),
    )
    op.create_index("ix_budget_reservation_active", "budget_reservations", ["budget_id", "status"])
    op.create_table(
        "budget_usage_receipts",
        sa.Column("usage_receipt_id", sa.String(128), primary_key=True),
        sa.Column("reservation_id", sa.String(128), sa.ForeignKey("budget_reservations.reservation_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("request_id", sa.String(128), nullable=False),
        sa.Column("abort_status", sa.String(64), nullable=False),
        sa.Column("actual_cost", sa.Numeric(20, 8)),
        sa.Column("actual_tokens", sa.BigInteger()),
        sa.Column("retry_after", sa.String(128)),
        sa.Column("rate_bucket", sa.String(128)),
        sa.Column("provenance", sa.String(256), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "(actual_cost IS NULL OR actual_cost >= 0) AND (actual_tokens IS NULL OR actual_tokens >= 0)",
            name="ck_budget_usage_nonnegative",
        ),
    )
    op.create_table(
        "quota_pauses",
        sa.Column("budget_id", sa.String(128), sa.ForeignKey("budget_ledgers.budget_id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("incomplete_step_id", sa.String(128), nullable=False),
        sa.Column("checkpoint_ref", sa.String(256), nullable=False),
        sa.Column("reset_hint", sa.String(256), nullable=False),
        sa.Column("next_safe_action", sa.String(256), nullable=False),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("status = 'PAUSED_QUOTA'", name="ck_quota_pause_status"),
    )
    op.execute(
        """
        CREATE FUNCTION anvil_budget_reserve(
          p_reservation_id text, p_budget_id text, p_run_id text, p_step_id text,
          p_request_id text, p_provider text, p_model text, p_pricing_version text,
          p_forecast_cost numeric, p_forecast_tokens bigint
        ) RETURNS budget_reservations AS $$
        DECLARE ledger budget_ledgers%ROWTYPE;
        DECLARE existing budget_reservations%ROWTYPE;
        DECLARE created budget_reservations%ROWTYPE;
        DECLARE active_cost numeric;
        DECLARE active_tokens bigint;
        DECLARE active_count integer;
        BEGIN
          SELECT * INTO ledger FROM budget_ledgers WHERE budget_id=p_budget_id FOR UPDATE;
          IF NOT FOUND OR ledger.run_id<>p_run_id OR NOT ledger.new_action_allowed THEN RETURN NULL; END IF;
          SELECT * INTO existing FROM budget_reservations WHERE reservation_id=p_reservation_id;
          IF FOUND THEN
            IF existing.budget_id=p_budget_id AND existing.run_id=p_run_id AND existing.step_id=p_step_id
               AND existing.request_id=p_request_id AND existing.provider=p_provider AND existing.model=p_model
               AND existing.pricing_version=p_pricing_version AND existing.reserved_cost=p_forecast_cost
               AND existing.reserved_tokens=p_forecast_tokens THEN RETURN existing; END IF;
            RETURN NULL;
          END IF;
          SELECT COALESCE(sum(reserved_cost),0),COALESCE(sum(reserved_tokens),0),count(*)
          INTO active_cost,active_tokens,active_count
          FROM budget_reservations WHERE budget_id=p_budget_id AND status='RESERVED';
          SELECT active_cost + COALESCE(sum(consumed_cost),0),
                 active_tokens + COALESCE(sum(consumed_tokens),0)
          INTO active_cost,active_tokens
          FROM budget_reservations WHERE budget_id=p_budget_id;
          IF p_forecast_cost<0 OR p_forecast_tokens<0
             OR active_cost+p_forecast_cost>ledger.hard_cost_limit
             OR active_tokens+p_forecast_tokens>ledger.hard_token_limit
             OR active_count>=ledger.max_concurrent_requests THEN RETURN NULL; END IF;
          INSERT INTO budget_reservations(
            reservation_id,budget_id,run_id,step_id,request_id,provider,model,pricing_version,
            reserved_cost,reserved_tokens
          ) VALUES (
            p_reservation_id,p_budget_id,p_run_id,p_step_id,p_request_id,p_provider,p_model,p_pricing_version,
            p_forecast_cost,p_forecast_tokens
          ) RETURNING * INTO created;
          RETURN created;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS anvil_budget_reserve(text,text,text,text,text,text,text,text,numeric,bigint)")
    op.drop_table("quota_pauses")
    op.drop_table("budget_usage_receipts")
    op.drop_index("ix_budget_reservation_active", table_name="budget_reservations")
    op.drop_table("budget_reservations")
    op.drop_table("budget_ledgers")
    op.drop_index("ix_human_intervention_run_requested", table_name="human_intervention_receipts")
    op.drop_table("human_intervention_receipts")
