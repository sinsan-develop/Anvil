"""Add server-owned OIDC principal directory without changing existing tables."""

from alembic import op
import sqlalchemy as sa


revision = "0018_oidc_principal_directory"
down_revision = "0017_oidc_pending_auth"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("actor_id", sa.String(128), primary_key=True),
        sa.Column("active", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "roles",
        sa.Column("role_code", sa.String(128), primary_key=True),
        sa.Column("permissions", sa.JSON(), nullable=False),
    )
    op.create_table(
        "user_roles",
        sa.Column("actor_id", sa.String(128), sa.ForeignKey("users.actor_id", ondelete="RESTRICT"),
                  primary_key=True),
        sa.Column("role_code", sa.String(128), sa.ForeignKey("roles.role_code", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("project_id", sa.String(128), nullable=False),
        sa.Column("environment_id", sa.String(128), nullable=False),
        sa.Column("step_up_required", sa.Boolean(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.CheckConstraint("step_up_required IN (false, true)", name="ck_user_roles_step_up_boolean"),
    )
    op.create_table(
        "oidc_subject_bindings",
        sa.Column("issuer", sa.String(2048), primary_key=True),
        sa.Column("subject", sa.String(512), primary_key=True),
        sa.Column("actor_id", sa.String(128), sa.ForeignKey("users.actor_id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
    )


def downgrade():
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        # Block writes to every owned table until all empty checks and drops commit.
        connection.execute(sa.text(
            "LOCK TABLE users, roles, user_roles, oidc_subject_bindings IN ACCESS EXCLUSIVE MODE"
        ))
    for table_name in ("oidc_subject_bindings", "user_roles", "roles", "users"):
        count = connection.execute(sa.text(f"SELECT count(*) FROM {table_name}")).scalar_one()
        if count:
            raise RuntimeError("DEPLOYMENT_ROLLBACK_DECISION_REQUIRED")
    for table_name in ("oidc_subject_bindings", "user_roles", "roles", "users"):
        op.drop_table(table_name)
