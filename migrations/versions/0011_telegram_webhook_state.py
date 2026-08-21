"""Durable Telegram webhook replay, audit, and rate-limit state."""

from alembic import op
import sqlalchemy as sa

revision = "0011_telegram_webhook_state"
down_revision = "0010_recovery"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "telegram_webhook_updates",
        sa.Column("nonce", sa.String(256), primary_key=True),
        sa.Column("command_id", sa.String(256), nullable=False, unique=True),
        sa.Column("chat_id", sa.String(256), nullable=False),
        sa.Column("user_id", sa.String(256), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_telegram_webhook_updates_expires_at",
        "telegram_webhook_updates",
        ["expires_at"],
    )
    op.create_table(
        "telegram_webhook_audits",
        sa.Column("audit_id", sa.String(256), primary_key=True),
        sa.Column("command_id", sa.String(256), nullable=False),
        sa.Column("operator_id", sa.String(256), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("outcome", sa.String(64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "telegram_webhook_rate_limits",
        sa.Column("identity", sa.String(512), primary_key=True),
        sa.Column("window_start", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("request_count >= 0", name="ck_telegram_rate_count"),
    )
    op.create_index(
        "ix_telegram_webhook_rate_limits_window_start",
        "telegram_webhook_rate_limits",
        ["window_start"],
    )


def downgrade():
    op.drop_index("ix_telegram_webhook_rate_limits_window_start", table_name="telegram_webhook_rate_limits")
    op.drop_table("telegram_webhook_rate_limits")
    op.drop_table("telegram_webhook_audits")
    op.drop_index("ix_telegram_webhook_updates_expires_at", table_name="telegram_webhook_updates")
    op.drop_table("telegram_webhook_updates")
