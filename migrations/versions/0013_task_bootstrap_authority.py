"""Add authoritative project-repository bindings for canonical Task drafts."""

from alembic import op
import sqlalchemy as sa


revision = "0013_task_bootstrap_authority"
down_revision = "0012_run_authority"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_repositories",
        sa.Column("project_id", sa.String(128), primary_key=True),
        sa.Column("repository_id", sa.String(128), nullable=False),
        sa.Column("target_environment", sa.String(128), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("length(btrim(project_id)) > 0", name="ck_project_repositories_project_id"),
        sa.CheckConstraint("length(btrim(repository_id)) > 0", name="ck_project_repositories_repository_id"),
        sa.CheckConstraint("length(btrim(target_environment)) > 0", name="ck_project_repositories_environment"),
        sa.CheckConstraint("version > 0", name="ck_project_repositories_positive_version"),
    )
    op.add_column("tasks", sa.Column("target_environment", sa.String(128), nullable=True))
    op.add_column("tasks", sa.Column("repository_mapping_version", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("conversation_message", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("idempotency_key", sa.String(128), nullable=True))
    op.add_column("tasks", sa.Column("creation_request_hash", sa.String(71), nullable=True))
    op.create_check_constraint(
        "ck_tasks_bootstrap_fields_all_or_legacy",
        "tasks",
        "(target_environment IS NULL AND repository_mapping_version IS NULL AND conversation_message IS NULL AND idempotency_key IS NULL AND creation_request_hash IS NULL) OR "
        "(target_environment IS NOT NULL AND repository_mapping_version IS NOT NULL AND conversation_message IS NOT NULL AND idempotency_key IS NOT NULL AND creation_request_hash IS NOT NULL)",
    )
    op.create_check_constraint(
        "ck_tasks_repository_mapping_version",
        "tasks",
        "repository_mapping_version IS NULL OR repository_mapping_version > 0",
    )
    op.create_check_constraint(
        "ck_tasks_target_environment_nonempty",
        "tasks",
        "target_environment IS NULL OR length(btrim(target_environment)) > 0",
    )
    op.create_check_constraint(
        "ck_tasks_idempotency_key_nonempty",
        "tasks",
        "idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0",
    )
    op.create_check_constraint(
        "ck_tasks_creation_request_hash",
        "tasks",
        "creation_request_hash IS NULL OR creation_request_hash ~ '^sha256:[0-9a-f]{64}$'",
    )
    op.create_unique_constraint("uq_tasks_project_idempotency", "tasks", ["project_id", "idempotency_key"])


def downgrade():
    op.drop_constraint("uq_tasks_project_idempotency", "tasks", type_="unique")
    for name in (
        "ck_tasks_creation_request_hash",
        "ck_tasks_idempotency_key_nonempty",
        "ck_tasks_target_environment_nonempty",
        "ck_tasks_repository_mapping_version",
        "ck_tasks_bootstrap_fields_all_or_legacy",
    ):
        op.drop_constraint(name, "tasks", type_="check")
    for column in ("creation_request_hash", "idempotency_key", "conversation_message", "repository_mapping_version", "target_environment"):
        op.drop_column("tasks", column)
    op.drop_table("project_repositories")
