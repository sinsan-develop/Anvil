# C-21 / LR-02A R2 runtime readiness progress

- Result: `COMPLETED` (Main review pending)
- Baseline: `codex/c21-lifecycle-runtime@e57f008d0916953dab3c9425322a1e8942ed0379`
- Lease: execution `c21-lr02a-execution-fence-epoch-2-e57f008`, write `c21-lr02a-write-fence-epoch-2-e57f008`.

## R2 correction evidence

- First restored the frozen LR-01 report byte-for-byte from `e57f008`; SHA-256 is `F3FB0C564BBE4D3E571529A2577B852BC87727531354FE69C04D192AF7F3B0EB`.
- RED: pre-R2 focused deployment regression returned exit `1`, `2 failed, 35 passed`; legacy assertions exposed the changed explicit-root and fresh-build migration behavior.
- GREEN: `uv run python -m pytest tests/deploy/test_public_deploy_pipeline.py tests/deploy/test_ysna_deployment_contract.py tests/deploy/test_ysna_scripts_contract.py -q` returned exit `0`, `37 passed in 58.95s`.
- Executable bootstrap fake-command harness: `uv run python -m pytest tests/deploy/test_public_deploy_pipeline.py::test_bootstrap_fake_git_harness_passes_the_canonical_deploy_root -q` returned exit `0`, `1 passed`.
- Task/Run/SSE/local-session/API regression returned exit `0`, `54 passed in 5.93s`.
- Shell syntax, DRAFT JSON parse, Alembic head `0013_task_bootstrap_authority`, progress checker `PASS sequence=407 reporting=AUTO_CONTINUE`, and `git diff --check` all returned exit `0`.

## Implemented boundary

- Bootstrap passes `ANVIL_DEPLOY_ROOT`; deploy no longer infers the root from its temporary extracted path.
- The exact target image is built before head inspection. `0012_run_authority` upgrades to 0013, same 0013 is a no-op, and every other head fails closed.
- A distinct previous SHA preserves versioned rollback compose/verify assets; rollback never downgrades the schema.
- Verify uses the declared manifest-guard argument order, checks running service/OCI revision/readiness body, and performs bounded public UI/API/integrations/auth/OpenAPI/SSE probes.
- The DRAFT manifest declares deployment approval as required and consistently not approved.

## Not executed and rollback

Docker/SSH/DB/NPM/DNS/secret/browser/deploy/Telegram/Provider side effects and container removal are `NOT_EXECUTED`. No commit/push/merge occurred. A later approved rollback uses the preserved application assets and retains migration 0013.
