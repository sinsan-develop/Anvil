"""Add a dedicated, short-lived OIDC session record table."""

from alembic import op
import sqlalchemy as sa


revision = "0019_oidc_sessions"
down_revision = "0018_oidc_principal_directory"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "oidc_sessions",
        sa.Column("session_digest", sa.LargeBinary(32), primary_key=True),
        sa.Column("issuer", sa.String(2048), nullable=False),
        sa.Column("subject", sa.String(512), nullable=False),
        sa.Column("csrf_token", sa.String(43), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("step_up_valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(session_digest) = 32", name="ck_oidc_session_digest_size"),
    )
    op.create_index("ix_oidc_sessions_expires_at", "oidc_sessions", ["expires_at"])


def downgrade():
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        connection.execute(sa.text("LOCK TABLE oidc_sessions IN ACCESS EXCLUSIVE MODE"))
    count = connection.execute(sa.text("SELECT count(*) FROM oidc_sessions")).scalar_one()
    if count:
        raise RuntimeError("DEPLOYMENT_ROLLBACK_DECISION_REQUIRED")
    op.drop_index("ix_oidc_sessions_expires_at", table_name="oidc_sessions")
    op.drop_table("oidc_sessions")
