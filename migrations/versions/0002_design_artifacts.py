"""Immutable design artifacts and approval lineage."""

from alembic import op
import sqlalchemy as sa


revision = "0002_design_artifacts"
down_revision = "0001_base"
branch_labels = None
depends_on = None


def _artifact_columns():
    return (
        sa.Column("artifact_id", sa.String(128), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(71), nullable=False),
        sa.Column("actor_type", sa.String(16), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def upgrade():
    op.create_table("design_artifacts", *_artifact_columns(), sa.Column("artifact_type", sa.String(64), nullable=False), sa.Column("source_refs", sa.JSON(), nullable=False))
    op.create_table("decision_records", *_artifact_columns(), sa.Column("proposal_set_id", sa.String(128), nullable=False), sa.Column("disposition", sa.String(32), nullable=False), sa.Column("selected_proposal_id", sa.String(128)), sa.Column("reason", sa.Text(), nullable=False), sa.Column("target_iteration_id", sa.String(128)))
    op.create_table("design_baselines", *_artifact_columns(), sa.Column("specification_id", sa.String(128), nullable=False), sa.Column("root_human_approval_id", sa.String(128), nullable=False), sa.Column("parent_baseline_id", sa.String(128)), sa.Column("approval_mode", sa.String(64), nullable=False), sa.Column("scope", sa.JSON(), nullable=False))
    op.create_table("nonsemantic_revision_bindings", *_artifact_columns(), sa.Column("parent_baseline_id", sa.String(128), nullable=False), sa.Column("root_human_approval_id", sa.String(128), nullable=False), sa.Column("old_content_hash", sa.String(71), nullable=False), sa.Column("new_content_hash", sa.String(71), nullable=False), sa.Column("semantic_diff", sa.String(64), nullable=False), sa.Column("impact", sa.Text(), nullable=False), sa.Column("reason", sa.Text(), nullable=False))
    op.create_table("carryover_items", *_artifact_columns(), sa.Column("source_decision_id", sa.String(128), nullable=False), sa.Column("target_id", sa.String(128), nullable=False), sa.Column("disposition", sa.String(32), nullable=False))


def downgrade():
    for table in ("carryover_items", "nonsemantic_revision_bindings", "design_baselines", "decision_records", "design_artifacts"):
        op.drop_table(table)

