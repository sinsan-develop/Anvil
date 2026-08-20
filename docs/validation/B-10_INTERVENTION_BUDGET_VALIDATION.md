# B-10 R2 Unresolved Usage Admission Validation

## Authority and write boundary

- WorkInstruction: `WI-B-10-20260821-002`, SHA-256 `DFFCE00D420BC0DDC04C48B18856D111397C8DDC67155EE3DE702B8C379E6D21`.
- Invocation SHA-256: `489222E413D61AEBEC177E42CDBBCA88AE4380644F5A6534511BC5B12C0F9674`.
- Independent report SHA-256: `B1FDDE5244129A0E086E9F666A635955751A6D3A5A83DB582E23CC1EB90AEBBB`.
- Canonical start: `main=origin/main=a5515ea94d3b5a6e185c0521a0de4906d6e21dae`, clean. R2 product baseline `e9dd00983775a5b1b2849f6be35304e34ef4fa17` is its ancestor; the intervening diff contains only the approved R2 progress/report/WI/checker projection.
- Lease: epoch 2 execution token `b10-execution-fence-epoch-2-e9dd009`, write token `b10-write-fence-epoch-2-e9dd009`, Developer exact7.
- Finding: `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`.

Only the two budget implementation paths, two budget test paths, and three R2 evidence paths were written. The other R1 exact15 paths, authority, progress/HANDOFF, Tester report, checkers, Git index/refs, B-11/B-12, shared DB, ysna, production, and deployment remained read-only.

## Root cause and TDD evidence

Both admission implementations selected active forecast exposure only when status was `RESERVED`. An unknown final usage receipt retained `reserved_cost` and `reserved_tokens` on the row but changed status to `RECONCILIATION_REQUIRED`, so cost, tokens, and concurrency disappeared from the admission snapshot.

Regression tests were added before production changes.

1. In-memory RED:
   - Command: `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests\budget\test_quota_reconcile.py::QuotaReconcileTests::test_unknown_usage_remains_full_admission_exposure_until_final_receipt tests\budget\test_quota_reconcile.py::QuotaReconcileTests::test_final_receipt_replay_and_concurrent_reserve_release_exposure_once -q`
   - Result: exit `1`, `1 failed, 1 passed`.
   - Expected `reserved_cost=40.00`; actual was `0` after `ABORT_UNKNOWN`.
2. PostgreSQL 18 RED:
   - After actual `0008_queue_worker_leases -> 0009_intervention_budget`, the DSN test `test_postgres_unresolved_usage_remains_in_atomic_admission_totals` exited `1`.
   - The unresolved `40/400` row remained present, but the second reservation was accepted instead of returning `NULL`.

The minimal correction was limited to two filters:

- in-memory active exposure now includes `RESERVED` and `RECONCILIATION_REQUIRED`;
- `anvil_budget_reserve()` uses the same two statuses inside the ledger row lock.

Mutation boundary: removing either added status makes its corresponding local or PostgreSQL regression fail. No public model, service API, table, column, migration revision, or R1 intervention behavior changed.

## GREEN and regression results

- In-memory focused reconciliation after the fix: `4 passed`.
- Targeted PostgreSQL unresolved admission: `1 passed`; cost, token, and concurrency were exercised as three independent hard-limit scenarios.
- DSN-enabled focused intervention/budget suite: `15 passed`.
- Local focused without DSN: `13 passed, 2 skipped`; both skips are explicitly DSN-gated PostgreSQL tests.
- Canonical core with `--import-mode=importlib`: `115 passed, 4 skipped`; skips are only B-09/B-10 DSN-gated tests.
- Full tooling on the authorized active dirty R2 worktree: `347 passed, 36 failed`, exit `1`. Failures are confined to A-13 frozen raw/diff comparisons (`EVIDENCE_ACTUAL_DIFF_MISMATCH`, content/raw byte/hash mismatch) and project-progress `GIT_DESCENDANT_WORKTREE_DIRTY` plus `PRG_REFERENCED_HASH_MISMATCH`. The latter is expected because progress still references the frozen R1 Developer manifest while R2 replaces that manifest under its active write lease. These checks passed `379/379` on the clean R2 start baseline in the independent report. Prohibited checker/progress files were not changed to conceal the expected active-worktree projection.
- Standalone checkers on the active dirty worktree:
  - G-07 baseline: PASS, `packages=108 av=255 uncovered=0 scenarios=20`.
  - Phase G Gate: PASS, `accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`.
  - A-13 repository scan: expected active-dirty failure with the four raw/diff mismatch codes above.
  - project progress: expected active-rework failures `GIT_DESCENDANT_WORKTREE_DIRTY` and `PRG_REFERENCED_HASH_MISMATCH`.

The concurrent final-receipt test submits four identical authoritative receipts and five competing reservations through the real `RLock` repository. Identical final receipts return one canonical result, consumed usage remains exactly `12/120`, release remains exactly `28/280`, and cost/token/concurrency never exceed `50/500/1`. The unknown exposure test retains `40/400`, active count `1`, rejects a later `50/500`, and records Provider sender calls as `[]`.

## Isolated PostgreSQL 18 evidence

- Container/network: `anvil-b10-r2-pg18-322` / `anvil-b10-r2-net-322`.
- Runtime: `postgres:18-alpine`, server `18.4`, tmpfs `/var/lib/postgresql`, loopback-only `127.0.0.1:32771`, database `anvil_b10_r2_322`.
- Migration sequence: `0008 -> R1 0009` for SQL RED, then `0009 -> 0008 -> corrected 0009` for GREEN, followed by final `0009 -> 0008` rollback; all migration commands exited `0`.
- Eight concurrent `30/300` requests under `100/1000` admitted exactly three and retained totals `90/900`.
- Three independent unresolved scenarios proved cost, token, and concurrency each reject new admission while `RECONCILIATION_REQUIRED` retains the original forecast row.
- DSN focused result: `15/15 PASS`.
- Final rollback query: B-10 tables `0`, `anvil_budget_reserve` functions `0`, Alembic head `0008_queue_worker_leases`.
- Exact container and network removal returned both exact names; post-removal exact-name filters were blank.

One initial read-only post-rollback query command had PowerShell quoting errors after the Alembic downgrade had already succeeded. It was excluded from evidence and retried with a read-only `psycopg` query, which produced the `0 / 0 / 0008_queue_worker_leases` result above. No shared database or external environment was accessed.

## Runtime boundary, rollback, and residual risk

- Executed: framework-neutral local service logic and unique isolated PostgreSQL 18.
- Not executed: actual API, UI, browser/Network, real Provider/invoice, B-11 BFF/SSE, B-12 process/PC recovery, shared DB, ysna, production, deployment, acceptance, commit, and push.
- R2 fixes the independently reported admission-release defect. Package acceptance remains forbidden until conversation-separated independent retest.
- Rollback: revert only the exact7 R2 bytes. On an approved isolated database at `0009_intervention_budget`, downgrade only to `0008_queue_worker_leases`. Never apply this rollback to shared DB, ysna, or production without a separate approved deployment plan.
