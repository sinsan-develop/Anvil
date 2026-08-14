"""Execution attempts, human release decisions, and DIR guards."""

from alembic import op
import sqlalchemy as sa


revision = "0004_execution_release"
down_revision = "0003_planning_approvals"
branch_labels = None
depends_on = None


_HASH_CHECK = "VALUE ~ '^sha256:[0-9a-f]{64}$'"


def _hash_constraint(column: str, name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(_HASH_CHECK.replace("VALUE", column), name=name)


def upgrade():
    op.create_table(
        "tasks",
        sa.Column("task_id", sa.String(128), primary_key=True),
        sa.Column("project_id", sa.String(128), nullable=False, index=True),
        sa.Column("repository_id", sa.String(128), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("requested_by", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.CheckConstraint("status IN ('DRAFT','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED')", name="ck_tasks_status"),
    )
    op.create_table(
        "runs",
        sa.Column("run_id", sa.String(128), primary_key=True),
        sa.Column("task_id", sa.String(128), sa.ForeignKey("tasks.task_id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("baseline_id", sa.String(128), nullable=False),
        sa.Column("phase", sa.String(40), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("version > 0", name="ck_runs_positive_version"),
    )
    op.create_table(
        "plan_steps",
        sa.Column("step_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("step_lineage_id", sa.String(128), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.CheckConstraint("sequence > 0", name="ck_plan_steps_positive_sequence"),
        sa.UniqueConstraint("run_id", "sequence", name="uq_plan_steps_run_sequence"),
    )
    op.create_table(
        "step_attempts",
        sa.Column("attempt_id", sa.String(128), primary_key=True),
        sa.Column("plan_step_id", sa.String(128), sa.ForeignKey("plan_steps.step_id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("executor_kind", sa.String(32), nullable=False),
        sa.Column("target_hash", sa.String(71), nullable=False),
        sa.Column("takeover_reference", sa.String(128)),
        sa.Column("terminal_result_id", sa.String(128)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("attempt_number > 0", name="ck_step_attempts_positive_number"),
        sa.CheckConstraint("executor_kind IN ('SUBAGENT','MAIN_TAKEOVER')", name="ck_step_attempts_executor_kind"),
        sa.CheckConstraint("(executor_kind = 'SUBAGENT' AND takeover_reference IS NULL) OR (executor_kind = 'MAIN_TAKEOVER' AND takeover_reference IS NOT NULL)", name="ck_step_attempts_takeover_reference"),
        _hash_constraint("target_hash", "ck_step_attempts_target_hash"),
        sa.UniqueConstraint("plan_step_id", "attempt_number", name="uq_step_attempts_number"),
    )
    op.create_index(
        "uq_step_attempts_one_active_per_step",
        "step_attempts",
        ["plan_step_id"],
        unique=True,
        postgresql_where=sa.text("terminal_result_id IS NULL"),
    )
    op.create_table(
        "delegations",
        sa.Column("delegation_id", sa.String(128), primary_key=True),
        sa.Column("step_attempt_id", sa.String(128), sa.ForeignKey("step_attempts.attempt_id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.UniqueConstraint("step_attempt_id", name="uq_delegations_step_attempt"),
    )
    op.create_table(
        "results",
        sa.Column("result_id", sa.String(128), primary_key=True),
        sa.Column("step_attempt_id", sa.String(128), sa.ForeignKey("step_attempts.attempt_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("target_hash", sa.String(71), nullable=False),
        sa.Column("delivered_hash", sa.String(71), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("event_sequence", sa.BigInteger(), nullable=False),
        sa.CheckConstraint("status IN ('COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED')", name="ck_results_status"),
        sa.CheckConstraint("event_sequence > 0", name="ck_results_positive_event_sequence"),
        _hash_constraint("target_hash", "ck_results_target_hash"),
        _hash_constraint("delivered_hash", "ck_results_delivered_hash"),
        sa.UniqueConstraint("step_attempt_id", name="uq_results_step_attempt"),
        sa.UniqueConstraint("event_sequence", name="uq_results_event_sequence"),
    )
    op.create_table(
        "product_validations",
        sa.Column("validation_id", sa.String(128), primary_key=True),
        sa.Column("criterion_id", sa.String(128), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("target_hash", sa.String(71), nullable=False, index=True),
        sa.Column("delivered_hash", sa.String(71), nullable=False),
        sa.Column("verdict", sa.String(32), nullable=False),
        sa.Column("validated_by", sa.String(128), nullable=False),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("verdict IN ('SUITABLE','NEEDS_IMPROVEMENT','UNSUITABLE','BLOCKED')", name="ck_product_validations_verdict"),
        _hash_constraint("target_hash", "ck_product_validations_target_hash"),
        _hash_constraint("delivered_hash", "ck_product_validations_delivered_hash"),
        sa.UniqueConstraint("criterion_id", "target_hash", name="uq_product_validations_criterion_target"),
    )
    op.create_table(
        "defects",
        sa.Column("defect_id", sa.String(128), primary_key=True),
        sa.Column("target_hash", sa.String(71), nullable=False, index=True),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("blocking", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("owner_id", sa.String(128), nullable=False),
        sa.CheckConstraint("severity IN ('CRITICAL','MAJOR','MINOR')", name="ck_defects_severity"),
        sa.CheckConstraint("status IN ('OPEN','ACCEPTED','FIXING','READY_FOR_RETEST','CLOSED','DEFERRED','REJECTED')", name="ck_defects_status"),
        _hash_constraint("target_hash", "ck_defects_target_hash"),
    )
    op.create_table(
        "release_decisions",
        sa.Column("decision_id", sa.String(128), primary_key=True),
        sa.Column("target_hash", sa.String(71), nullable=False, index=True),
        sa.Column("decision", sa.String(16), nullable=False),
        sa.Column("decided_by", sa.String(128), nullable=False),
        sa.Column("authenticated_human", sa.Boolean(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("decision IN ('RELEASE','REWORK','DEFER','REJECT')", name="ck_release_decisions_decision"),
        sa.CheckConstraint("authenticated_human", name="ck_release_decisions_authenticated_human"),
        _hash_constraint("target_hash", "ck_release_decisions_target_hash"),
    )
    op.create_table(
        "design_intent_reviews",
        sa.Column("review_id", sa.String(128), primary_key=True),
        sa.Column("dir_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("subject_hash", sa.String(71), nullable=False),
        sa.Column("owner_direction_event_id", sa.String(128)),
        sa.Column("owner_direction_authenticated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("causation_event_id", sa.String(128)),
        sa.CheckConstraint("status IN ('DIR_HOLD','REPORTING','WAITING_OWNER_DIRECTION','CLEARED')", name="ck_design_intent_reviews_status"),
        sa.CheckConstraint("status <> 'CLEARED' OR (owner_direction_event_id IS NOT NULL AND owner_direction_authenticated)", name="ck_design_intent_reviews_owner_clear"),
        _hash_constraint("subject_hash", "ck_design_intent_reviews_subject_hash"),
    )

    op.execute(
        """
        CREATE FUNCTION anvil_validate_attempt_binding() RETURNS trigger AS $$
        DECLARE
          checked_attempt_id varchar(128);
          checked_executor varchar(32);
          delegation_count integer;
        BEGIN
          IF TG_TABLE_NAME = 'delegations' THEN
            IF TG_OP = 'DELETE' THEN
              checked_attempt_id := OLD.step_attempt_id;
            ELSE
              checked_attempt_id := NEW.step_attempt_id;
            END IF;
          ELSE
            IF TG_OP = 'DELETE' THEN
              checked_attempt_id := OLD.attempt_id;
            ELSE
              checked_attempt_id := NEW.attempt_id;
            END IF;
          END IF;
          SELECT executor_kind INTO checked_executor FROM step_attempts WHERE attempt_id = checked_attempt_id;
          IF checked_executor IS NULL THEN
            IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
          END IF;
          SELECT count(*) INTO delegation_count FROM delegations WHERE step_attempt_id = checked_attempt_id;
          IF checked_executor = 'SUBAGENT' AND delegation_count <> 1 THEN
            RAISE EXCEPTION 'SUBAGENT attempt requires exactly one delegation';
          END IF;
          IF checked_executor = 'MAIN_TAKEOVER' AND delegation_count <> 0 THEN
            RAISE EXCEPTION 'MAIN_TAKEOVER attempt forbids delegation';
          END IF;
          IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE CONSTRAINT TRIGGER ck_step_attempt_binding AFTER INSERT OR UPDATE ON step_attempts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil_validate_attempt_binding()")
    op.execute("CREATE CONSTRAINT TRIGGER ck_delegation_binding AFTER INSERT OR UPDATE OR DELETE ON delegations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil_validate_attempt_binding()")
    op.execute(
        """
        CREATE FUNCTION anvil_bind_terminal_result() RETURNS trigger AS $$
        DECLARE expected_hash varchar(71);
        BEGIN
          SELECT target_hash INTO expected_hash FROM step_attempts WHERE attempt_id = NEW.step_attempt_id FOR UPDATE;
          IF expected_hash IS NULL OR expected_hash <> NEW.target_hash THEN
            RAISE EXCEPTION 'result target hash does not match source attempt';
          END IF;
          UPDATE step_attempts SET terminal_result_id = NEW.result_id WHERE attempt_id = NEW.step_attempt_id AND terminal_result_id IS NULL;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'terminal result already exists for source attempt';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER bind_terminal_result BEFORE INSERT ON results FOR EACH ROW EXECUTE FUNCTION anvil_bind_terminal_result()")
    op.execute(
        """
        CREATE FUNCTION anvil_guard_release_decision() RETURNS trigger AS $$
        BEGIN
          IF NEW.decision = 'RELEASE' THEN
            IF NOT EXISTS (
              SELECT 1 FROM product_validations
              WHERE required AND target_hash = NEW.target_hash AND delivered_hash = NEW.target_hash AND verdict = 'SUITABLE'
            ) OR EXISTS (
              SELECT 1 FROM product_validations
              WHERE required AND target_hash = NEW.target_hash AND (delivered_hash <> NEW.target_hash OR verdict <> 'SUITABLE')
            ) THEN
              RAISE EXCEPTION 'required ProductValidation is incomplete, blocked, unsuitable, or hash-mismatched';
            END IF;
            IF EXISTS (
              SELECT 1 FROM defects
              WHERE target_hash = NEW.target_hash AND blocking AND severity IN ('CRITICAL','MAJOR') AND status NOT IN ('CLOSED','REJECTED')
            ) THEN
              RAISE EXCEPTION 'open blocking defect prevents release';
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER guard_release_decision BEFORE INSERT OR UPDATE ON release_decisions FOR EACH ROW EXECUTE FUNCTION anvil_guard_release_decision()")


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS anvil_guard_release_decision() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_bind_terminal_result() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_validate_attempt_binding() CASCADE")
    for table in (
        "design_intent_reviews",
        "release_decisions",
        "defects",
        "product_validations",
        "results",
        "delegations",
        "step_attempts",
        "plan_steps",
        "runs",
        "tasks",
    ):
        op.drop_table(table)
