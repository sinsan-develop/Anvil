"""Durable owner sidecar. Creation is not C30 release0013 application approval."""
from alembic import op
import sqlalchemy as sa

revision = "0015_agent_team_owner"
down_revision = "0014_dag_queue"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "agent_owner_heads",
        sa.Column("scope_key", sa.String(71), primary_key=True),
        sa.Column("project_id", sa.String(128), nullable=False),
        sa.Column("environment_id", sa.String(128), nullable=False),
        sa.Column("session_id", sa.String(128), nullable=False),
        sa.Column("assignment_id", sa.String(128), nullable=False),
        sa.Column("generation", sa.BigInteger(), nullable=False),
        sa.Column("owner_version", sa.BigInteger(), nullable=False),
        sa.Column("revoked_through", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("snapshot_hash", sa.String(71), nullable=False),
        sa.Column("snapshot_json", sa.Text(), nullable=False),
        sa.UniqueConstraint("project_id", "environment_id", "session_id", "assignment_id", name="uq_agent_owner_identity"),
        sa.CheckConstraint("generation > 0 AND owner_version > 0 AND revoked_through >= 0 AND revoked_through <= generation", name="ck_agent_owner_counters"),
    )
    op.create_table(
        "agent_owner_history",
        sa.Column("scope_key", sa.String(71), sa.ForeignKey("agent_owner_heads.scope_key"), primary_key=True),
        sa.Column("owner_version", sa.BigInteger(), primary_key=True),
        sa.Column("snapshot_hash", sa.String(71), nullable=False),
        sa.Column("snapshot_json", sa.Text(), nullable=False),
        sa.CheckConstraint("owner_version > 0", name="ck_agent_owner_history_version"),
    )
    op.create_table(
        "agent_owner_requests",
        sa.Column("scope_key", sa.String(71), sa.ForeignKey("agent_owner_heads.scope_key"), primary_key=True),
        sa.Column("request_id", sa.String(128), primary_key=True),
        sa.Column("operation", sa.String(16), nullable=False),
        sa.Column("request_hash", sa.String(71), nullable=False),
        sa.Column("receipt_id", sa.String(128), nullable=True),
        sa.Column("response_json", sa.Text(), nullable=False),
        sa.UniqueConstraint("scope_key", "receipt_id", name="uq_agent_owner_receipt"),
        sa.CheckConstraint("operation IN ('SNAPSHOT','REVOKE','RECEIPT')", name="ck_agent_owner_operation"),
    )


def downgrade():
    # Same lock order as the repository: global schema guard before row access.
    # Refuse data destruction; this is not an automatic production rollback.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("SELECT pg_advisory_xact_lock(17015001)")
        op.execute("LOCK TABLE agent_owner_heads IN ACCESS EXCLUSIVE MODE")
    if op.get_bind().execute(sa.text("SELECT count(*) FROM agent_owner_heads")).scalar_one():
        raise RuntimeError("OWNER_DATA_PRESENT")
    op.drop_table("agent_owner_requests")
    op.drop_table("agent_owner_history")
    op.drop_table("agent_owner_heads")
