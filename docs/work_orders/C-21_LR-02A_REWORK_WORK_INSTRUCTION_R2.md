# WI-C-21-LR-02A-20260903-002 — Canonical deploy contract executable rework R2

## 1. Binding and classification

- Work Package: `C-21 / LR-02A`
- Baseline: `codex/c21-lifecycle-runtime@e57f008d0916953dab3c9425322a1e8942ed0379`
- Predecessor WI: `WI-C-21-LR-02A-20260903-001`, SHA-256 `B109FC5741D25D8DA285CAEFC7E5EE1D1EA10038E7A426D0EFA6353DA411618A`
- Predecessor invocation SHA-256: `9EC0E710A26C7B1021E8AA4D7F41E8183C21041E238F4A5ED15CDD3B709C18C9`
- Root approval: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- Revision: `MAIN_RECONFIRMED_NON_SEMANTIC`
- Scope change: `false`; requirement change: `false`; material-risk change: `false`
- Failure fingerprint: `LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`
- Independent evidence: `docs/04_test_reports/C-21_LR02A_INDEPENDENT_TEST_REPORT.md`, SHA-256 `A0F71304371042FB8FED7CF3841785121C2B6171913375BD8D4A487FE5A0BB5B`
- Executor: `developer-primary`

## 2. Required corrections

1. Restore `docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md` byte-for-byte from baseline `e57f008...`; its SHA-256 must again be `F3FB0C564BBE4D3E571529A2577B852BC87727531354FE69C04D192AF7F3B0EB`. Do not write new LR-02A content to that path.
2. Move the LR-02A R1 progress content to `docs/04_test_reports/C-21_LR02A_RUNTIME_READINESS_PROGRESS.md` and append R2 RED/GREEN evidence there.
3. Versioned bootstrap must pass or establish the explicit canonical deploy root `$HOME/deploy/anvil`; target `deploy.sh` must never infer it from the temporary script location.
4. Build the exact-SHA image once before database-head inspection. Head `0012_run_authority` upgrades exactly to `0013_task_bootstrap_authority`; head `0013_task_bootstrap_authority` is a no-op; every other head fails closed.
5. Correct verify/rollback root resolution and call `validate_release_manifest(repo, manifest_ref, expected)` in its declared order.
6. Preserve the previous distinct release SHA across same-SHA retries. Preserve versioned rollback compose/verify assets so rollback does not depend on an older checkout containing the new canonical files. Do not downgrade schema.
7. Verify bounded-time public UI, API, integrations, auth, OpenAPI and authenticated-SSE contract surfaces, readiness body migration head, running service and OCI revision. Evidence must reflect observed values and must not hardcode a PASS.
8. Make every DRAFT approval/status field consistently `NOT_APPROVED` and state the later approval requirement.
9. Add executable fake-command harness tests for bootstrap/deploy/verify/rollback; string-only assertions are insufficient for the corrected paths and state transitions.

## 3. R2 exact11 write scope

- `deploy/ysna/bootstrap-deploy.sh`
- `deploy/ysna/deploy.sh`
- `deploy/ysna/verify.sh`
- `deploy/ysna/rollback.sh`
- `deploy/ysna/ReleaseManifest.C21.DRAFT.json`
- `tests/deploy/test_public_deploy_pipeline.py`
- `tests/deploy/test_ysna_deployment_contract.py`
- `tests/deploy/test_ysna_scripts_contract.py`
- `docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md` (restore only)
- `docs/04_test_reports/C-21_LR02A_RUNTIME_READINESS_PROGRESS.md`
- `.superpowers/sdd/Anvil_작업계획서_v1/task-2-r2-report.md`

R1 changes to `apps/api/anvil_api/asgi.py`, `deploy/ysna/compose.production.yml`, `deploy/ysna/README.md`, and `tests/api/test_public_asgi_frontend.py` are frozen during R2.

## 4. Verification and boundaries

- RED must reproduce the executable-path, fresh-image, same-0013, rollback-baseline, verify-observation and draft-state failures before implementation.
- GREEN must include the executable fake-command harness, focused deploy tests, Task/Run/SSE/local-session/API regression, shell syntax, JSON parsing, Alembic head, project progress checker after Main rebinding, and `git diff --check`.
- Docker/SSH/DB mutation/NPM/DNS/secret/browser/deploy/Telegram/Provider calls and container removal remain `NOT_EXECUTED`.
- No commit, push, merge, deployment or path outside exact11 is allowed.
- C-01 remains `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`.

## 5. Result contract

Return exactly one of `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` with changed files, RED/GREEN commands and exit codes, unverified operational scope, residual risks, rollback, and progress-report update.
