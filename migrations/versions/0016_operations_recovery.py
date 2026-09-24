"""Append-only Operations owner; existing recovery and artifact tables remain intact."""

from alembic import op
import sqlalchemy as sa


revision = "0016_operations_recovery"
down_revision = "0015_agent_team_owner"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "operations_audit_heads",
        sa.Column("project_id", sa.String(128), primary_key=True),
        sa.Column("environment_id", sa.String(128), primary_key=True),
        sa.Column("next_sequence", sa.BigInteger(), nullable=False, server_default="1"),
        sa.CheckConstraint("next_sequence > 0", name="ck_operations_next_sequence"),
    )
    op.create_table(
        "operations_audit_events",
        sa.Column("project_id", sa.String(128), primary_key=True),
        sa.Column("environment_id", sa.String(128), primary_key=True),
        sa.Column("sequence_no", sa.BigInteger(), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["project_id", "environment_id"],
                                ["operations_audit_heads.project_id", "operations_audit_heads.environment_id"],
                                ondelete="RESTRICT"),
        sa.CheckConstraint("sequence_no > 0", name="ck_operations_sequence_positive"),
    )
    op.execute("""
        CREATE FUNCTION anvil_operations_audit_immutable() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'operations audit is append-only';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("CREATE TRIGGER guard_operations_audit_immutable BEFORE UPDATE OR DELETE ON operations_audit_events "
               "FOR EACH ROW EXECUTE FUNCTION anvil_operations_audit_immutable()")


def downgrade():
    # Destructive schema rollback is a human-bound decision, not automatic.
    row = op.get_bind().execute(sa.text("SELECT count(*) FROM operations_audit_events")).scalar_one()
    if row:
        raise RuntimeError("DEPLOYMENT_ROLLBACK_DECISION_REQUIRED")
    op.drop_table("operations_audit_events")
    op.drop_table("operations_audit_heads")
    op.execute("DROP FUNCTION anvil_operations_audit_immutable()")
