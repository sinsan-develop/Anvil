# B-05 Execution, Release, and DIR Validation

## Scope and boundary

- WorkInstruction: `WI-B-05-20260815-002`, SHA-256 `DFC7BDECBECE0E6A2E48E68011D91E51AEB370A0E6CB67E1EA1ACBAE00F17A43`
- Validation ID: `AV-STAT-008`
- Baseline: `HEAD=origin/main=2edc44044df522e6ec7c56b95c5e9414932ac856`
- Lease: epoch-2 `worker-lease-b05-20260815-002` and `write-lease-b05-20260815-002`; epoch-1 tokens were not used.
- Product scope is limited to framework-neutral execution/release/DIR models, guards, repository/API contracts, migration `0004`, and deterministic tests.
- FastAPI routes/auth/SSE/BFF, UI/browser, provider calls, ysna/shared-db, production, and deployment were not executed.

## TDD and regression evidence

| Stage | Command | Result |
|---|---|---|
| RED | `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/execution -q` | exit 1; all 11 tests failed because `packages.execution` and `packages.api.execution_contracts` did not exist. |
| GREEN | `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/execution -q` | exit 0; 11 passed. |
| Compile | `C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages/execution packages/persistence/execution_repository.py packages/api/execution_contracts.py migrations/versions/0004_execution_release.py` | exit 0. |
| Core regression | `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/domain tests/design tests/planning tests/persistence tests/execution -q --import-mode=importlib` | exit 0; 55 passed in 0.60s. |
| Diff check | `git diff --check` | exit 0. |

One initial combined pytest command without `--import-mode=importlib` stopped during collection because existing test directories reuse module basenames such as `test_models.py`. Each suite then passed independently (`14 + 14 + 9 + 7 + 11 = 55`), and the combined importlib run passed 55/55. This was a runner collection-mode issue, not a product failure.

The tests prove immutable typed aggregates, parent identity, positive attempt sequence, one unfinished attempt per PlanStep, exact SUBAGENT delegation, delegation-free MAIN_TAKEOVER with takeover reference, source-attempt/target-hash binding, one terminal Result, authenticated-human-only ReleaseDecision, required suitable same-hash ProductValidation, blocking defect release denial, exact canonical DIR states, owner direction enforcement, and recurrent drift as a new DIR review.

## Isolated PostgreSQL 18 evidence

Only temporary Anvil resources were used:

- Network: `anvil-b05-net-2edc440`
- Container: `anvil-b05-pg18-2edc440`
- Image/runtime: `postgres:18`, PostgreSQL `18.4`
- Exposure: `127.0.0.1:32768` to container `5432`; no public bind
- Database/user: B-05-specific ephemeral test database and role

Alembic applied `0003_planning_approvals → 0004_execution_release`. Revision readback was `0004_execution_release (head)` and all ten B-05 tables existed. The first hostile SUBAGENT insert exposed a migration trigger row-shape defect: a shared trigger referenced a column absent from one trigger relation. The actual PostgreSQL failure was retained as the failing integration test, the trigger was changed once to select the attempt ID by `TG_TABLE_NAME` and `TG_OP`, and `0004` was downgraded/reapplied before the full hostile suite.

Post-fix hostile and valid-path results:

1. SUBAGENT without Delegation was rejected at deferred constraint time.
2. SUBAGENT with exactly one matching Delegation committed.
3. A second unfinished attempt for the same PlanStep was rejected by `uq_step_attempts_one_active_per_step`.
4. MAIN_TAKEOVER with Delegation was rejected; takeover reference is required by check constraint.
5. Result target-hash mismatch was rejected.
6. A second terminal Result for the same StepAttempt was rejected.
7. Non-human ReleaseDecision was rejected by `ck_release_decisions_authenticated_human`.
8. RELEASE without suitable required ProductValidation was rejected.
9. RELEASE with an open blocking MAJOR defect was rejected; after independent state was represented as `CLOSED`, the same-hash RELEASE insert succeeded.
10. DIR `CLEARED` without authenticated owner direction was rejected; a valid owner direction succeeded.
11. Recurrent drift was represented by a new `DIR_HOLD` review and causation Event while the original review remained `CLEARED`.

Alembic then downgraded `0004 → 0003`; B-05 table count returned to `0` and B-05 trigger-function count returned to `0`. The exact container and network were removed and post-checked absent. Existing WSL databases, roles, schemas, data, `shared-db`, and ysna-server were not accessed or changed.

Two WSL command invocations encountered transient WSL service timeout/transport errors, and one diagnostic loop was malformed by PowerShell pre-expanding shell syntax. Read-only health checks showed the isolated container remained healthy with restart count `0`; these tool/environment incidents were retried without code changes and are not counted as valid product failures.

## Tooling boundary

`C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py'` ran 307 tests in 143.438 seconds and reported 16 failures. Ten are expected A-13/evidence-manifest live-diff checksum failures while the Developer exact paths are dirty, and six are `GIT_DESCENDANT_WORKTREE_DIRTY` projection failures. No out-of-scope checker, progress, fixture, authority, or historical evidence file was changed to suppress them.

## Result

Developer result is `COMPLETED_PENDING_INDEPENDENT_TEST` for the exact B-05 implementation, focused/core verification, and isolated migration evidence. B-05 acceptance, progress projection, commit/push, B-06, API/UI/browser, and deployment remain outside this result.
