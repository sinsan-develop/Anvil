"""Task 내부 권위·요청 및 append-only 감사. 기존 행·권한은 변경하지 않는다."""
from alembic import op
import sqlalchemy as sa

revision = "0021_approval_requests"
down_revision = "0020_f19a_pair_grants"
branch_labels = None
depends_on = None


def _binding():
    return [sa.Column(k, sa.String(71 if k.endswith("hash") else 128), nullable=False)
        for k in ("task_id", "project_id", "environment_id", "plan_id", "plan_hash", "wi_id", "wi_hash", "mode_id", "mode_hash")]


def upgrade():
    op.create_table("task_planning_authorities",
        sa.Column("authority_id", sa.String(36), primary_key=True), *_binding(),
        sa.Column("actor_id", sa.String(128), nullable=False), sa.Column("role", sa.String(32), nullable=False),
        sa.Column("permission", sa.String(64), nullable=False), sa.Column("capability_hash", sa.String(71), nullable=False),
        sa.Column("authority_event_hash", sa.String(71), nullable=False), sa.Column("epoch", sa.Integer, nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("task_id", "epoch", name="uq_task_planning_authority_epoch"),
        sa.CheckConstraint("epoch>0 AND expires_at>issued_at", name="ck_task_planning_lifetime"),
        sa.CheckConstraint("actor_id='anvil-internal-planning-main' AND role='INTERNAL_MAIN' AND permission='approval-requests:create'", name="ck_task_planning_role"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["project_id", "environment_id"], ["registered_environments.project_id", "registered_environments.environment_id"], ondelete="RESTRICT"))
    op.create_table("approval_requests",
        sa.Column("request_id", sa.String(36), primary_key=True), *_binding(),
        sa.Column("request_kind", sa.String(32), nullable=False), sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT")),
        sa.Column("authority_id", sa.String(36), sa.ForeignKey("task_planning_authorities.authority_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("requested_by", sa.String(128), nullable=False), sa.Column("mode_snapshot", sa.JSON, nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False), sa.Column("request_hash", sa.String(71), nullable=False),
        sa.Column("idempotency_keys", sa.JSON, nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.UniqueConstraint("task_id", "idempotency_key", name="uq_approval_request_retry"),
        sa.CheckConstraint("request_kind='EXECUTION_PLAN'", name="ck_approval_request_kind"),
        sa.CheckConstraint("status IN ('PENDING','SUPERSEDED','CANCELLED','INVALIDATED')", name="ck_approval_request_status"),
        sa.CheckConstraint("expires_at>requested_at", name="ck_approval_request_lifetime"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["plan_id"], ["execution_plans.plan_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["wi_id"], ["work_instructions.artifact_id"], ondelete="RESTRICT"))
    op.create_index("uq_approval_request_pending_subject", "approval_requests",
        ["task_id", "project_id", "environment_id", "request_kind"], unique=True,
        postgresql_where=sa.text("status='PENDING'"), sqlite_where=sa.text("status='PENDING'"))
    op.create_index("ix_approval_request_pair", "approval_requests", ["project_id", "environment_id", "status", "expires_at"])
    for name, owner, key in (("task_planning_authority_events", "task_planning_authorities", "authority_id"),
                             ("approval_request_events", "approval_requests", "request_id")):
        op.create_table(name,
            sa.Column("event_id", sa.String(36), primary_key=True),
            sa.Column(key, sa.String(36), sa.ForeignKey(f"{owner}.{key}", ondelete="RESTRICT"), nullable=False),
            sa.Column("sequence", sa.Integer, nullable=False), sa.Column("event_type", sa.String(32), nullable=False),
            sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False), sa.Column("payload", sa.JSON, nullable=False),
            sa.Column("content_hash", sa.String(71), nullable=False),
            sa.UniqueConstraint(key, "sequence", name=f"uq_{name}_sequence"),
            sa.CheckConstraint("sequence>0", name=f"ck_{name}_sequence"))
    if op.get_bind().dialect.name == "postgresql":
        for table in ("task_planning_authorities", "approval_requests"):
            for column in ("plan_hash", "wi_hash", "mode_hash"):
                op.create_check_constraint(f"ck_{table}_{column}", table, f"{column} ~ '^sha256:[0-9a-f]{{64}}$'")
        op.create_check_constraint("ck_task_authority_max_lifetime", "task_planning_authorities", "expires_at<=issued_at+interval '1 hour'")
        op.create_check_constraint("ck_request_exact_lifetime", "approval_requests", "expires_at=requested_at+interval '1 hour'")
        op.execute("""CREATE FUNCTION approval_ledger_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'APPROVAL_AUDIT_IMMUTABLE'; END $$""")
        for table in ("approval_request_events", "task_planning_authority_events"):
            op.execute(f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION approval_ledger_audit_immutable()")
    elif op.get_bind().dialect.name == "sqlite":
        for table in ("approval_request_events", "task_planning_authority_events"):
            for action in ("UPDATE", "DELETE"):
                op.execute(f"CREATE TRIGGER {table}_{action.lower()} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'APPROVAL_AUDIT_IMMUTABLE'); END")


def downgrade():
    raise RuntimeError("APPROVAL_LEDGER_PRESERVE_ROWS_NO_DOWNGRADE")
