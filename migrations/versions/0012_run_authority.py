"""Bind normal Run creation to approved artifacts and durable idempotency."""

from alembic import op
import sqlalchemy as sa


revision = "0012_run_authority"
down_revision = "0011_telegram_webhook_state"
branch_labels = None
depends_on = None


_ACTIVE = (
    "QUEUED", "ACTIVE", "WAITING_APPROVAL", "BLOCKED", "INTERRUPTED",
    "PAUSED_USER", "PAUSE_REQUESTED", "PAUSED_QUOTA", "WAITING_DECISION",
    "AWAITING_EXCEPTION_REVIEW", "CANCEL_REQUESTED",
)


def upgrade():
    op.add_column("design_baselines", sa.Column("project_id", sa.String(128), nullable=True))
    op.create_index("ix_design_baselines_project_id", "design_baselines", ["project_id"])
    op.create_check_constraint(
        "ck_design_baselines_project_id_nonempty",
        "design_baselines",
        "project_id IS NULL OR length(btrim(project_id)) > 0",
    )

    op.add_column("tasks", sa.Column("version", sa.Integer(), nullable=True))
    op.execute("UPDATE tasks SET version = 1 WHERE version IS NULL")
    op.alter_column("tasks", "version", nullable=False, server_default="1")
    op.create_check_constraint("ck_tasks_positive_version", "tasks", "version > 0")

    op.create_table(
        "execution_plans",
        sa.Column("plan_id", sa.String(128), primary_key=True),
        sa.Column("plan_hash", sa.String(71), nullable=False),
        sa.Column("source_work_instruction_id", sa.String(128), sa.ForeignKey("work_instructions.artifact_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("source_work_instruction_hash", sa.String(71), nullable=False),
        sa.Column("baseline_analysis_hash", sa.String(71), nullable=False),
        sa.Column("impact_analysis_hash", sa.String(71), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("plan_hash ~ '^sha256:[0-9a-f]{64}$'", name="ck_execution_plans_hash"),
        sa.CheckConstraint("source_work_instruction_hash ~ '^sha256:[0-9a-f]{64}$'", name="ck_execution_plans_wi_hash"),
        sa.CheckConstraint("baseline_analysis_hash ~ '^sha256:[0-9a-f]{64}$'", name="ck_execution_plans_baseline_analysis_hash"),
        sa.CheckConstraint("impact_analysis_hash ~ '^sha256:[0-9a-f]{64}$'", name="ck_execution_plans_impact_analysis_hash"),
        sa.CheckConstraint("status IN ('DRAFT','VALIDATED','APPROVED','ACTIVE','RETIRED')", name="ck_execution_plans_status"),
    )

    for column in (
        sa.Column("work_instruction_id", sa.String(128), nullable=True),
        sa.Column("execution_plan_id", sa.String(128), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("creation_request_hash", sa.String(71), nullable=True),
        sa.Column("environment_id", sa.String(128), nullable=True),
        sa.Column("permission_snapshot_hash", sa.String(71), nullable=True),
        sa.Column("prior_run_id", sa.String(128), nullable=True),
        sa.Column("resume_checkpoint_id", sa.String(128), nullable=True),
    ):
        op.add_column("runs", column)
    op.create_foreign_key("fk_runs_work_instruction", "runs", "work_instructions", ["work_instruction_id"], ["artifact_id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_runs_execution_plan", "runs", "execution_plans", ["execution_plan_id"], ["plan_id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_runs_prior_run", "runs", "runs", ["prior_run_id"], ["run_id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_runs_resume_checkpoint", "runs", "checkpoints", ["resume_checkpoint_id"], ["checkpoint_id"], ondelete="RESTRICT")
    op.create_check_constraint(
        "ck_runs_authority_all_or_legacy", "runs",
        "(work_instruction_id IS NULL AND execution_plan_id IS NULL AND idempotency_key IS NULL AND creation_request_hash IS NULL AND environment_id IS NULL AND permission_snapshot_hash IS NULL) OR "
        "(work_instruction_id IS NOT NULL AND execution_plan_id IS NOT NULL AND idempotency_key IS NOT NULL AND creation_request_hash IS NOT NULL AND environment_id IS NOT NULL AND permission_snapshot_hash IS NOT NULL)",
    )
    op.create_check_constraint(
        "ck_runs_resume_pair", "runs",
        "(prior_run_id IS NULL AND resume_checkpoint_id IS NULL) OR (prior_run_id IS NOT NULL AND resume_checkpoint_id IS NOT NULL)",
    )
    op.create_check_constraint("ck_runs_creation_request_hash", "runs", "creation_request_hash IS NULL OR creation_request_hash ~ '^sha256:[0-9a-f]{64}$'")
    op.create_check_constraint("ck_runs_permission_snapshot_hash", "runs", "permission_snapshot_hash IS NULL OR permission_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'")
    op.create_unique_constraint("uq_runs_task_idempotency", "runs", ["task_id", "idempotency_key"])
    active_sql = ",".join(f"'{status}'" for status in _ACTIVE)
    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT task_id
                    FROM runs
                    WHERE status IN ({active_sql})
                    GROUP BY task_id
                    HAVING count(*) > 1
                ) THEN
                    RAISE EXCEPTION '0012_run_authority: duplicate active Runs require reconciliation';
                END IF;
            END
            $$
            """
        )
    )
    op.create_index(
        "uq_runs_one_active_per_task", "runs", ["task_id"], unique=True,
        postgresql_where=sa.text(f"status IN ({active_sql})"),
    )

    for column in (
        sa.Column("run_id", sa.String(128), nullable=True),
        sa.Column("step_id", sa.String(128), nullable=True),
        sa.Column("project_id", sa.String(128), nullable=True),
        sa.Column("execution_plan_id", sa.String(128), nullable=True),
        sa.Column("execution_plan_hash", sa.String(71), nullable=True),
        sa.Column("permission_snapshot_hash", sa.String(71), nullable=True),
    ):
        op.add_column("evidence_manifests", column)
    op.create_foreign_key("fk_evidence_manifests_run", "evidence_manifests", "runs", ["run_id"], ["run_id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_evidence_manifests_step", "evidence_manifests", "plan_steps", ["step_id"], ["step_id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_evidence_manifests_execution_plan", "evidence_manifests", "execution_plans", ["execution_plan_id"], ["plan_id"], ondelete="RESTRICT")
    op.create_check_constraint(
        "ck_evidence_manifests_run_authority_all_or_legacy", "evidence_manifests",
        "(run_id IS NULL AND step_id IS NULL AND project_id IS NULL AND execution_plan_id IS NULL AND execution_plan_hash IS NULL AND permission_snapshot_hash IS NULL) OR "
        "(run_id IS NOT NULL AND step_id IS NOT NULL AND project_id IS NOT NULL AND execution_plan_id IS NOT NULL AND execution_plan_hash IS NOT NULL AND permission_snapshot_hash IS NOT NULL)",
    )
    op.create_check_constraint("ck_evidence_manifests_project_nonempty", "evidence_manifests", "project_id IS NULL OR length(btrim(project_id)) > 0")
    op.create_check_constraint("ck_evidence_manifests_execution_plan_hash", "evidence_manifests", "execution_plan_hash IS NULL OR execution_plan_hash ~ '^sha256:[0-9a-f]{64}$'")
    op.create_check_constraint("ck_evidence_manifests_permission_snapshot_hash", "evidence_manifests", "permission_snapshot_hash IS NULL OR permission_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'")
    op.create_index("ix_evidence_manifests_run_step", "evidence_manifests", ["run_id", "step_id"])


def downgrade():
    op.drop_index("ix_evidence_manifests_run_step", table_name="evidence_manifests")
    for name in (
        "ck_evidence_manifests_permission_snapshot_hash",
        "ck_evidence_manifests_execution_plan_hash",
        "ck_evidence_manifests_project_nonempty",
        "ck_evidence_manifests_run_authority_all_or_legacy",
    ):
        op.drop_constraint(name, "evidence_manifests", type_="check")
    for name in ("fk_evidence_manifests_execution_plan", "fk_evidence_manifests_step", "fk_evidence_manifests_run"):
        op.drop_constraint(name, "evidence_manifests", type_="foreignkey")
    for name in ("permission_snapshot_hash", "execution_plan_hash", "execution_plan_id", "project_id", "step_id", "run_id"):
        op.drop_column("evidence_manifests", name)
    op.drop_index("uq_runs_one_active_per_task", table_name="runs")
    op.drop_constraint("uq_runs_task_idempotency", "runs", type_="unique")
    for name in ("ck_runs_permission_snapshot_hash", "ck_runs_creation_request_hash", "ck_runs_resume_pair", "ck_runs_authority_all_or_legacy"):
        op.drop_constraint(name, "runs", type_="check")
    for name in ("fk_runs_resume_checkpoint", "fk_runs_prior_run", "fk_runs_execution_plan", "fk_runs_work_instruction"):
        op.drop_constraint(name, "runs", type_="foreignkey")
    for name in ("resume_checkpoint_id", "prior_run_id", "permission_snapshot_hash", "environment_id", "creation_request_hash", "idempotency_key", "execution_plan_id", "work_instruction_id"):
        op.drop_column("runs", name)
    op.drop_table("execution_plans")
    op.drop_constraint("ck_tasks_positive_version", "tasks", type_="check")
    op.drop_column("tasks", "version")
    op.drop_constraint("ck_design_baselines_project_id_nonempty", "design_baselines", type_="check")
    op.drop_index("ix_design_baselines_project_id", table_name="design_baselines")
    op.drop_column("design_baselines", "project_id")
