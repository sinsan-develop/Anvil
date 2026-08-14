"""Planning artifacts and approval bindings."""

from alembic import op
import sqlalchemy as sa


revision = "0003_planning_approvals"
down_revision = "0002_design_artifacts"
branch_labels = None
depends_on = None


def _artifact_columns():
    return (
        sa.Column("artifact_id", sa.String(128), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(71), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def upgrade():
    op.create_table("work_plans", *_artifact_columns(), sa.Column("design_baseline_id", sa.String(128), nullable=False), sa.Column("design_baseline_hash", sa.String(71), nullable=False), sa.Column("scope", sa.JSON(), nullable=False))
    op.create_table("iteration_plans", *_artifact_columns(), sa.Column("work_plan_id", sa.String(128), nullable=False), sa.Column("work_plan_hash", sa.String(71), nullable=False), sa.Column("sequence", sa.Integer(), nullable=False))
    op.create_table("work_instructions", *_artifact_columns(), sa.Column("iteration_plan_id", sa.String(128), nullable=False), sa.Column("iteration_plan_hash", sa.String(71), nullable=False), sa.Column("allowed_paths", sa.JSON(), nullable=False), sa.Column("allowed_actions", sa.JSON(), nullable=False), sa.Column("completion_conditions", sa.JSON(), nullable=False))
    op.create_table("approval_records", sa.Column("approval_id", sa.String(128), primary_key=True), sa.Column("approval_type", sa.String(32), nullable=False), sa.Column("subject_id", sa.String(128), nullable=False), sa.Column("subject_hash", sa.String(71), nullable=False), sa.Column("approved_by", sa.String(128), nullable=False), sa.Column("authenticated_human", sa.Boolean(), nullable=False), sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("status", sa.String(32), nullable=False), sa.CheckConstraint("authenticated_human", name="ck_approval_records_authenticated_human"), sa.CheckConstraint("expires_at > approved_at", name="ck_approval_records_expiry_after_approval"))
    op.create_table("nonsemantic_reconfirmations", sa.Column("binding_id", sa.String(128), primary_key=True), sa.Column("root_human_approval_id", sa.String(128), nullable=False), sa.Column("parent_approval_id", sa.String(128), nullable=False), sa.Column("old_content_hash", sa.String(71), nullable=False), sa.Column("new_content_hash", sa.String(71), nullable=False), sa.Column("semantic_diff", sa.String(64), nullable=False), sa.Column("impact", sa.Text(), nullable=False), sa.Column("reason", sa.Text(), nullable=False), sa.Column("actor_id", sa.String(128), nullable=False), sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False), sa.Column("functional_scope_changed", sa.Boolean(), nullable=False), sa.Column("requirements_changed", sa.Boolean(), nullable=False), sa.Column("critical_risk_changed", sa.Boolean(), nullable=False), sa.CheckConstraint("semantic_diff = 'NONE' AND NOT functional_scope_changed AND NOT requirements_changed AND NOT critical_risk_changed", name="ck_nonsemantic_reconfirmations_scope_and_risk"))


def downgrade():
    for table in ("nonsemantic_reconfirmations", "approval_records", "work_instructions", "iteration_plans", "work_plans"):
        op.drop_table(table)
