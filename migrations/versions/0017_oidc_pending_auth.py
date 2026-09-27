"""Add a dedicated one-use OIDC pending request table; preserve existing data."""

from alembic import op
import sqlalchemy as sa


revision = "0017_oidc_pending_auth"
down_revision = "0016_operations_recovery"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "oidc_pending_auth",
        sa.Column("state_digest", sa.LargeBinary(32), primary_key=True),
        sa.Column("nonce", sa.String(43), nullable=False),
        sa.Column("code_verifier", sa.String(43), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("require_step_up", sa.Boolean(), nullable=False),
        sa.CheckConstraint("length(state_digest) = 32", name="ck_oidc_pending_digest_size"),
    )
    op.create_index("ix_oidc_pending_expires_at", "oidc_pending_auth", ["expires_at"])


def downgrade():
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        # Hold this lock through COUNT and DROP: a concurrent INSERT must not
        # commit after the empty check and be silently removed by DROP TABLE.
        connection.execute(sa.text("LOCK TABLE oidc_pending_auth IN ACCESS EXCLUSIVE MODE"))
    row_count = connection.execute(sa.text("SELECT count(*) FROM oidc_pending_auth")).scalar_one()
    if row_count:
        raise RuntimeError("DEPLOYMENT_ROLLBACK_DECISION_REQUIRED")
    op.drop_index("ix_oidc_pending_expires_at", table_name="oidc_pending_auth")
    op.drop_table("oidc_pending_auth")
