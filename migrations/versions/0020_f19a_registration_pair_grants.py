"""Add F-19A registration, exact pair grant, and append-only audit ownership."""

from alembic import op
import sqlalchemy as sa


revision = "0020_f19a_pair_grants"
down_revision = "0019_oidc_sessions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "registered_projects",
        sa.Column("project_id", sa.String(128), primary_key=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("registered_by_actor_id", sa.String(128),
                  sa.ForeignKey("users.actor_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("length(display_name) BETWEEN 1 AND 200", name="ck_f19a_project_display_name"),
    )
    op.create_table(
        "registered_environments",
        sa.Column("project_id", sa.String(128),
                  sa.ForeignKey("registered_projects.project_id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("environment_id", sa.String(128), primary_key=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("registered_by_actor_id", sa.String(128),
                  sa.ForeignKey("users.actor_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("length(display_name) BETWEEN 1 AND 200", name="ck_f19a_environment_display_name"),
    )
    op.create_table(
        "pair_grants",
        sa.Column("actor_id", sa.String(128), sa.ForeignKey("users.actor_id", ondelete="RESTRICT"),
                  primary_key=True),
        sa.Column("project_id", sa.String(128), primary_key=True),
        sa.Column("environment_id", sa.String(128), primary_key=True),
        sa.Column("permission_code", sa.String(128), primary_key=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("granted_by_actor_id", sa.String(128),
                  sa.ForeignKey("users.actor_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("revoked_by_actor_id", sa.String(128),
                  sa.ForeignKey("users.actor_id", ondelete="RESTRICT"), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id", "environment_id"],
            ["registered_environments.project_id", "registered_environments.environment_id"],
            name="fk_f19a_grant_exact_environment", ondelete="RESTRICT"),
        sa.CheckConstraint(
            "(active = true AND revoked_at IS NULL AND revoked_by_actor_id IS NULL) OR "
            "(active = false AND revoked_at IS NOT NULL AND revoked_by_actor_id IS NOT NULL)",
            name="ck_f19a_grant_status_times"),
        sa.CheckConstraint(
            "permission_code IN ('dashboard:read', 'operations:alerts:read', "
            "'operations:alerts:acknowledge')", name="ck_f19a_grant_permission"),
    )
    op.create_index("ix_f19a_grant_actor_active_pair", "pair_grants",
                    ["actor_id", "active", "project_id", "environment_id"])
    op.create_table(
        "registration_audit_events",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("actor_id", sa.String(128), sa.ForeignKey("users.actor_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("target_actor_id", sa.String(128), nullable=True),
        sa.Column("project_id", sa.String(128), nullable=False),
        sa.Column("environment_id", sa.String(128), nullable=True),
        sa.Column("permission_code", sa.String(128), nullable=True),
        sa.Column("previous_active", sa.Boolean(), nullable=True),
        sa.Column("next_active", sa.Boolean(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("correlation_id", sa.String(36), nullable=False),
    )
    op.create_index("ix_f19a_audit_pair_time", "registration_audit_events",
                    ["project_id", "environment_id", "occurred_at"])
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        op.execute("""
            CREATE FUNCTION f19a_registration_audit_immutable() RETURNS trigger
            LANGUAGE plpgsql AS $$ BEGIN
              RAISE EXCEPTION 'REGISTRATION_AUDIT_IMMUTABLE';
            END $$
        """)
        op.execute("""
            CREATE TRIGGER trg_f19a_registration_audit_immutable
            BEFORE UPDATE OR DELETE ON registration_audit_events
            FOR EACH ROW EXECUTE FUNCTION f19a_registration_audit_immutable()
        """)


def downgrade():
    connection = op.get_bind()
    tables = ("registration_audit_events", "pair_grants",
              "registered_environments", "registered_projects")
    if connection.dialect.name == "postgresql":
        connection.execute(sa.text(
            "LOCK TABLE registration_audit_events, pair_grants, registered_environments, "
            "registered_projects IN ACCESS EXCLUSIVE MODE"))
    for table in tables:
        if connection.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar_one():
            raise RuntimeError("DEPLOYMENT_ROLLBACK_DECISION_REQUIRED")
    if connection.dialect.name == "postgresql":
        op.execute("DROP TRIGGER trg_f19a_registration_audit_immutable ON registration_audit_events")
        op.execute("DROP FUNCTION f19a_registration_audit_immutable()")
    op.drop_index("ix_f19a_audit_pair_time", table_name="registration_audit_events")
    op.drop_table("registration_audit_events")
    op.drop_index("ix_f19a_grant_actor_active_pair", table_name="pair_grants")
    op.drop_table("pair_grants")
    op.drop_table("registered_environments")
    op.drop_table("registered_projects")
