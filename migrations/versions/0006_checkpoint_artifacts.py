"""Artifact metadata, Event-bound checkpoints, and EvidenceManifest metadata."""

from alembic import op
import sqlalchemy as sa


revision = "0006_checkpoint_artifacts"
down_revision = "0005_event_store"
branch_labels = None
depends_on = None


_HASH_CHECK = "VALUE ~ '^sha256:[0-9a-f]{64}$'"


def _hash_constraint(column: str, name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(_HASH_CHECK.replace("VALUE", column), name=name)


def upgrade():
    op.create_table(
        "artifacts",
        sa.Column("artifact_id", sa.String(128), primary_key=True),
        sa.Column("artifact_type", sa.String(80), nullable=False, index=True),
        sa.Column("content_hash", sa.String(71), nullable=False, index=True),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("media_type", sa.String(200), nullable=False),
        sa.Column("storage_ref", sa.String(400), nullable=False, index=True),
        sa.Column("project_id", sa.String(128), nullable=False, index=True),
        sa.Column("run_id", sa.String(128), sa.ForeignKey("runs.run_id", ondelete="RESTRICT"), index=True),
        sa.Column("step_id", sa.String(128), sa.ForeignKey("plan_steps.step_id", ondelete="RESTRICT"), index=True),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_artifact_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.CheckConstraint("byte_size >= 0", name="ck_artifacts_nonnegative_byte_size"),
        _hash_constraint("content_hash", "ck_artifacts_content_hash"),
        sa.CheckConstraint("storage_ref ~ '^sha256/[0-9a-f]{2}/[0-9a-f]{64}$'", name="ck_artifacts_storage_ref_shape"),
        sa.CheckConstraint(
            "storage_ref = 'sha256/' || substring(content_hash from 8 for 2) || '/' || substring(content_hash from 8)",
            name="ck_artifacts_ref_matches_hash",
        ),
    )
    op.create_table(
        "checkpoints",
        sa.Column("checkpoint_id", sa.String(128), primary_key=True),
        sa.Column("run_id", sa.String(128), nullable=False, index=True),
        sa.Column("thread_id", sa.String(128), nullable=False, index=True),
        sa.Column("graph_version", sa.String(40), nullable=False),
        sa.Column("state_schema_version", sa.Integer(), nullable=False),
        sa.Column("source_event_sequence", sa.BigInteger(), nullable=False),
        sa.Column("next_nodes", sa.JSON(), nullable=False),
        sa.Column("pending_writes", sa.JSON(), nullable=False),
        sa.Column("state_artifact_id", sa.String(128), sa.ForeignKey("artifacts.artifact_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("state_artifact_hash", sa.String(71), nullable=False),
        sa.Column("binding_hashes", sa.JSON(), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["run_id", "source_event_sequence"],
            ["run_events.run_id", "run_events.sequence_no"],
            name="fk_checkpoints_source_event",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("state_schema_version > 0", name="ck_checkpoints_positive_schema_version"),
        sa.CheckConstraint("source_event_sequence > 0", name="ck_checkpoints_positive_event_sequence"),
        _hash_constraint("state_artifact_hash", "ck_checkpoints_state_artifact_hash"),
        sa.UniqueConstraint("run_id", "source_event_sequence", name="uq_checkpoints_run_event_sequence"),
    )
    op.create_table(
        "evidence_manifests",
        sa.Column("manifest_id", sa.String(128), primary_key=True),
        sa.Column("manifest_path", sa.String(400), nullable=False),
        sa.Column("design_baseline_hash", sa.String(71), nullable=False),
        sa.Column("work_plan_hash", sa.String(71), nullable=False),
        sa.Column("work_instruction_hash", sa.String(71), nullable=False),
        sa.Column("git_head", sa.String(64), nullable=False),
        sa.Column("git_status_before_ref", sa.String(128), nullable=False),
        sa.Column("git_status_after_ref", sa.String(128), nullable=False),
        sa.Column("target_hash", sa.String(71), nullable=False),
        sa.Column("delivered_artifact_hash", sa.String(71), nullable=False),
        sa.Column("container_image_digest", sa.String(71), nullable=False),
        sa.Column("db_migration_head", sa.String(128), nullable=False),
        sa.Column("config_revision_hash", sa.String(71), nullable=False),
        sa.Column("policy_hash", sa.String(71), nullable=False),
        sa.Column("provider_routing_snapshot_hash", sa.String(71), nullable=False),
        sa.Column("environment_id", sa.String(128), nullable=False),
        sa.Column("toolchain_versions", sa.JSON(), nullable=False),
        sa.Column("commands", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("actor_role", sa.String(80), nullable=False),
        sa.Column("acquisition_mode", sa.String(16), nullable=False),
        sa.Column("skipped_or_blocked", sa.JSON(), nullable=False),
        sa.Column("unverified_scope", sa.JSON(), nullable=False),
        sa.CheckConstraint("target_hash = delivered_artifact_hash", name="ck_evidence_manifest_target_match"),
        sa.CheckConstraint("finished_at >= started_at", name="ck_evidence_manifest_time_order"),
        sa.CheckConstraint("acquisition_mode IN ('real','fixture','mock','static')", name="ck_evidence_manifest_acquisition"),
    )
    for column in (
        "design_baseline_hash",
        "work_plan_hash",
        "work_instruction_hash",
        "target_hash",
        "delivered_artifact_hash",
        "container_image_digest",
        "config_revision_hash",
        "policy_hash",
        "provider_routing_snapshot_hash",
    ):
        op.create_check_constraint(f"ck_evidence_manifest_{column}", "evidence_manifests", _HASH_CHECK.replace("VALUE", column))
    op.create_table(
        "evidence_raw_artifacts",
        sa.Column("manifest_id", sa.String(128), sa.ForeignKey("evidence_manifests.manifest_id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("path", sa.String(400), primary_key=True),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("content_hash", sa.String(71), nullable=False),
        sa.Column("target_hash", sa.String(71), nullable=False),
        sa.Column("environment_id", sa.String(128), nullable=False),
        sa.CheckConstraint("byte_size >= 0", name="ck_evidence_raw_nonnegative_byte_size"),
        _hash_constraint("content_hash", "ck_evidence_raw_content_hash"),
        _hash_constraint("target_hash", "ck_evidence_raw_target_hash"),
    )
    op.execute(
        """
        CREATE FUNCTION anvil_forbid_artifact_history_mutation() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION '% is immutable append-only metadata', TG_TABLE_NAME;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for table in ("artifacts", "checkpoints", "evidence_manifests", "evidence_raw_artifacts"):
        op.execute(
            f"CREATE TRIGGER guard_{table}_immutable BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION anvil_forbid_artifact_history_mutation()"
        )
    op.execute(
        """
        CREATE FUNCTION anvil_validate_artifact_run_binding() RETURNS trigger AS $$
        DECLARE step_run varchar(128);
        BEGIN
          IF NEW.step_id IS NOT NULL THEN
            SELECT run_id INTO step_run FROM plan_steps WHERE step_id = NEW.step_id;
            IF NEW.run_id IS NULL OR step_run <> NEW.run_id THEN
              RAISE EXCEPTION 'artifact step belongs to a different run';
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER validate_artifact_run_binding BEFORE INSERT ON artifacts FOR EACH ROW EXECUTE FUNCTION anvil_validate_artifact_run_binding()")
    op.execute(
        """
        CREATE FUNCTION anvil_validate_checkpoint_binding() RETURNS trigger AS $$
        DECLARE artifact_run varchar(128); artifact_hash varchar(71); artifact_type varchar(80); latest_sequence bigint;
        BEGIN
          SELECT run_id, content_hash, artifacts.artifact_type
            INTO artifact_run, artifact_hash, artifact_type
            FROM artifacts WHERE artifact_id = NEW.state_artifact_id;
          IF artifact_run IS NULL OR artifact_run <> NEW.run_id OR artifact_hash <> NEW.state_artifact_hash OR artifact_type <> 'CHECKPOINT_STATE' THEN
            RAISE EXCEPTION 'checkpoint state artifact binding mismatch';
          END IF;
          SELECT max(source_event_sequence) INTO latest_sequence FROM checkpoints WHERE run_id = NEW.run_id;
          IF latest_sequence IS NOT NULL AND NEW.source_event_sequence <= latest_sequence THEN
            RAISE EXCEPTION 'checkpoint source event sequence cannot move backward or repeat';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER validate_checkpoint_binding BEFORE INSERT ON checkpoints FOR EACH ROW EXECUTE FUNCTION anvil_validate_checkpoint_binding()")
    op.execute(
        """
        CREATE FUNCTION anvil_validate_raw_evidence_binding() RETURNS trigger AS $$
        DECLARE parent_target varchar(71); parent_environment varchar(128); parent_path varchar(400);
        BEGIN
          SELECT target_hash, environment_id, manifest_path INTO parent_target, parent_environment, parent_path
            FROM evidence_manifests WHERE manifest_id = NEW.manifest_id;
          IF parent_target IS NULL OR NEW.target_hash <> parent_target OR NEW.environment_id <> parent_environment OR NEW.path = parent_path THEN
            RAISE EXCEPTION 'raw evidence target, environment, or self-reference mismatch';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER validate_raw_evidence_binding BEFORE INSERT ON evidence_raw_artifacts FOR EACH ROW EXECUTE FUNCTION anvil_validate_raw_evidence_binding()")
    op.execute(
        """
        CREATE FUNCTION anvil_require_raw_evidence() RETURNS trigger AS $$
        DECLARE checked_manifest varchar(128);
        BEGIN
          checked_manifest := CASE WHEN TG_TABLE_NAME = 'evidence_manifests' THEN COALESCE(NEW.manifest_id, OLD.manifest_id) ELSE COALESCE(NEW.manifest_id, OLD.manifest_id) END;
          IF EXISTS (SELECT 1 FROM evidence_manifests WHERE manifest_id = checked_manifest)
             AND NOT EXISTS (SELECT 1 FROM evidence_raw_artifacts WHERE manifest_id = checked_manifest) THEN
            RAISE EXCEPTION 'evidence manifest requires at least one raw checksum';
          END IF;
          RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE CONSTRAINT TRIGGER require_manifest_raw_evidence AFTER INSERT ON evidence_manifests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil_require_raw_evidence()")
    op.execute("CREATE CONSTRAINT TRIGGER retain_manifest_raw_evidence AFTER DELETE ON evidence_raw_artifacts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil_require_raw_evidence()")


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS anvil_require_raw_evidence() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_validate_raw_evidence_binding() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_validate_checkpoint_binding() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_validate_artifact_run_binding() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS anvil_forbid_artifact_history_mutation() CASCADE")
    for table in ("evidence_raw_artifacts", "evidence_manifests", "checkpoints", "artifacts"):
        op.drop_table(table)
