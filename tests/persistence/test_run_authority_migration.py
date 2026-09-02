from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_run_authority_migration_contains_fail_closed_lineage_and_concurrency_contracts():
    source = (ROOT / "migrations/versions/0012_run_authority.py").read_text(encoding="utf-8")
    for token in (
        'revision = "0012_run_authority"', 'down_revision = "0011_telegram_webhook_state"',
        '"execution_plans"', '"version"', '"work_instruction_id"', '"execution_plan_id"',
        '"idempotency_key"', '"prior_run_id"', '"resume_checkpoint_id"',
        'ck_runs_authority_all_or_legacy', 'uq_runs_task_idempotency', 'uq_runs_one_active_per_task',
        'postgresql_where', 'def downgrade',
    ):
        assert token in source
