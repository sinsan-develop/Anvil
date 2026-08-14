# B-04 Planning and Approval Validation

## Scope and boundary

- WorkInstruction: `WI-B-04-20260814-001`
- Validation IDs: `AV-SAFE-002`, `AV-SAFE-003`, `AV-SAFE-004`, `AV-SAFE-005`, `AV-SAFE-033`, `AV-STAT-002`, `AV-FLOW-012`
- Product scope is limited to immutable planning artifacts, deterministic hashes, approval bindings, framework-neutral contracts, and migration `0003`.
- Actual API routes/auth/BFF, UI/browser, providers, ysna/shared-db mutation, production, and deployment were not executed.

## TDD evidence

| Stage | Command | Result |
|---|---|---|
| RED-1 | `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/planning -p test_hash_invalidation.py -v` | exit 1; missing `packages.planning` was observed as an assertion failure. |
| RED-2 | `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/planning -v` | exit 1; 4 missing aggregate/guard/contract behaviors failed, 1 hash test passed. |
| RED-3 | `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/planning -p test_hash_invalidation.py -v` | exit 1; invalidated approval state was not observable. |
| RED-4 | `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/planning -p test_repository.py -v` | exit 1; migration DB guards were absent. |
| RED-5 | `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/planning -p test_approval_guard.py -v` | exit 1; valid reconfirmation could not authorize its new hash and duplicate binding IDs were accepted. |
| GREEN | `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/planning -v` | exit 0; 9 tests passed. |
| Contract regression | `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/domain tests/design tests/persistence tests/planning -q --import-mode=importlib` | exit 0; 44 passed in 0.50s. |

The tests prove deterministic one-character hash distinction, invalidation of an existing binding, typed parent hash links, independent approval types, hash mismatch denial, expiry-to-`BLOCKED`, and rejection of scope/risk-expanding nonsemantic reconfirmation. A valid nonsemantic binding supersedes the old hash and authorizes only its new hash with the inherited approval type and expiry; duplicate, same-hash, and at/after-expiry bindings fail closed. Migration guards require authenticated human approval, expiry after approval, and `semantic_diff='NONE'` without scope, requirement, or critical-risk expansion.

## Isolated PostgreSQL 18 migration evidence

WSL used only the temporary Anvil resources `anvil-b04-pg18-1519d8c` and `anvil-b04-net-1519d8c`. From a clean `0002_design_artifacts` state, Alembic applied `0003_planning_approvals`: revision readback was `0003_planning_approvals` and the five B-04 tables existed. Hostile inserts with `authenticated_human=false` and `semantic_diff='REQUIREMENT_CHANGE'` were each rejected by their named PostgreSQL check constraints. `alembic downgrade 0002_design_artifacts` then read back revision `0002_design_artifacts` with zero B-04 tables remaining. The exact temporary container and network were removed and post-checked absent.

Existing WSL databases, roles, schemas, data, `shared-db`, and ysna-server were not accessed or changed.

## Tooling boundary

The canonical tooling command `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p test_*.py` completed 287 tests in 119.011 seconds with 16 failures. They are dirty-worktree projection failures: five A-13 evidence checks, five fixture inventory checks, and six `GIT_DESCENDANT_WORKTREE_DIRTY` checks. The developer did not modify the out-of-scope checker, fixture, authority, or progress paths to suppress them.

## Result

Developer result: `COMPLETED` for the approved implementation and focused/contract/isolated-migration checks. B-04 acceptance and independent Tester validation remain outside this report.
