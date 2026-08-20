# B-10 R3 Immutable Reservation Finalization Validation

## Authority and boundary

- WorkInstruction: `WI-B-10-20260821-003`, SHA-256 `193734C3AD871D8042C0440342763A289DDCA70E1F862A143B357A1B8AABCF2D`.
- Invocation SHA-256: `27D14DCAAF638FF6D0637A266BCCB64DB93D0D633925703F8C47ECC5F8E3A642`.
- Independent R2 retest report SHA-256: `23865D1722B231F04C7087328874A41D19431E5EE28C90AC71A3FACDA9D4F854`.
- Start: `main=origin/main=4cc75da50e9eb16988bc07ab7b1f237bd2b6b169`, clean. Product baseline `5f644f45835329ef0195dae948d3c55ba7ff15af` is an ancestor; the intervening paths are the approved R3 progress/report/WI/checker projection and contain no product mutation.
- Lease: epoch 3 execution token `b10-execution-fence-epoch-3-5f644f4`, write token `b10-write-fence-epoch-3-5f644f4`, Developer exact7.
- Finding: `BLK-B10-IT-001-R2`, lineage `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`, valid failure count `2`.

Only the R3 exact7 paths were written. Other R1/B-10 paths, authority, progress/HANDOFF, Tester report, checkers, Git index/refs, B-11/B-12, Provider adapter, shared DB, ysna, production, and deployment stayed read-only.

## Root cause and minimal change

R2 keyed final receipt idempotency only by `usage_receipt_id`. A distinct receipt ID for the same already consumed reservation therefore bypassed `_usage`, recalculated release, and overwrote terminal consumed state. PostgreSQL had atomic reservation admission but no reservation-level authoritative-final identity or reconcile function.

R3 makes authoritative finalization a reservation terminal:

- the in-memory repository binds one immutable `(UsageReceipt, ReconciliationReceipt)` pair per reservation under its existing `RLock`;
- exact full canonical replay returns that same result without mutation;
- different receipt ID, request/payload fields, actual usage, or derived release fails closed;
- PostgreSQL adds backward-compatible receipt columns, a partial unique authoritative-final index per reservation, and `anvil_budget_reconcile()`;
- the function locks the reservation row, validates actual plus release against the forecast, stores one final identity, and returns `NULL` for any noncanonical replay.

The migration revision remains `0009_intervention_budget`. R2 unresolved `RECONCILIATION_REQUIRED` exposure remains active in cost/token/concurrency accounting.

## TDD RED

Production bytes were unchanged when these commands ran.

1. Local:
   - `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests\budget\test_quota_reconcile.py::QuotaReconcileTests::test_consumed_reservation_rejects_distinct_final_identity_and_preserves_new49_exposure tests\budget\test_quota_reconcile.py::QuotaReconcileTests::test_concurrent_distinct_final_receipts_choose_one_immutable_canonical_final -q`
   - Exit `1`, `2 failed`: distinct final was accepted; concurrent distinct receipts produced eight winners instead of one.
2. Actual PostgreSQL 18:
   - After `0008_queue_worker_leases ->` pre-R3 `0009_intervention_budget`, the two new PG tests exited `1`, `2 failed`.
   - The authoritative-final schema column and `anvil_budget_reconcile()` were both absent.

The failures matched the reported terminal-final overwrite, not a fixture or environment error.

## GREEN and regression

- Local quota/reconcile module: `6 passed`.
- Local focused without DSN: `15 passed, 4 skipped`; all skips are explicit B-10 PostgreSQL gates.
- Isolated PostgreSQL focused: `19 passed`.
- Canonical core with `--import-mode=importlib`: `117 passed, 6 skipped`; skips are only B-09/B-10 PostgreSQL gates.
- Full tooling on the active dirty R3 projection: `355 passed, 36 failed`, exit `1`. Failures were confined to frozen A-13 raw/diff evidence and project-progress dirty projection checks. The independent clean R3 start predecessor passed `387/387`; prohibited checker/progress files were not edited.

Local hostile coverage proves:

- first canonical final `u1` records `12/120` consumed and `28/280` released;
- exact `u1` replay returns the canonical result;
- distinct ID with equal, lower, or higher usage and changed retry/rate/provenance payload all fail;
- snapshot and terminal reservation remain `12/120` and `28/280`;
- new `49/490` is rejected because authoritative exposure is still `12/120`;
- eight concurrent distinct receipt IDs produce exactly one winner; loser calls cannot overwrite or release twice.

PostgreSQL hostile coverage independently proves:

- partial unique authoritative-final identity rejects a second final row for the same reservation;
- eight concurrent distinct receipt IDs through `anvil_budget_reconcile()` produce exactly one winner;
- exact winning identity replay returns the same row;
- changed receipt identity, payload hash, and actual/release each return `NULL` independently;
- final reservation stays `CONSUMED`, `12/120`, release `28/280`, with one authoritative receipt;
- new `49/490` returns `NULL`;
- R2 unresolved cost/token/concurrency cases and existing eight-way reservation admission remain green.

## Isolated PostgreSQL 18 and rollback

- Resource: `anvil-b10-r3-pg18-329` / `anvil-b10-r3-net-329`.
- Runtime: `postgres:18-alpine`, PostgreSQL `18.4`, tmpfs `/var/lib/postgresql`, loopback-only `127.0.0.1:32773`, database `anvil_b10_r3_329`.
- Migration sequence: `0008 -> pre-R3 0009` for RED; then pre-R3 `0009 -> 0008 -> R3 0009` for GREEN; final `R3 0009 -> 0008` rollback.
- The first pre-R3 downgrade attempt exposed a same-revision compatibility issue: the new downgrade tried to remove an index absent from the installed pre-R3 schema. That actual failure was fixed with `DROP INDEX IF EXISTS`; the same database then completed the full sequence. This was one migration fix attempt, not a product retry loop.
- Final rollback query: B-10 tables `0`, both `anvil_budget_reserve` and `anvil_budget_reconcile` functions `0`, Alembic head `0008_queue_worker_leases`.
- Exact container/network removal returned both resource names; post-removal exact filters were blank.

The first WSL readiness query hit a transient WSL service error before Docker execution and was excluded. An approved identical retry confirmed PostgreSQL `18.4` and the loopback port. shared DB, ysna, production, and deployment were never accessed.

## Exact verification commands and runtime limit

- Focused: `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests\interventions tests\budget -q`.
- Core: the canonical package list ending in `tests\interventions tests\budget -q --import-mode=importlib`.
- Tooling: `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests\tooling -q --import-mode=importlib`.
- Standalone: the four scripts `check_a13_repository_scan.py`, `check_g07_baseline.py`, `check_phase_g_gate.py`, and `check_project_progress.py`.
- Static: `compileall`, supported public imports, manifest JSON/raw6 recomputation, exact7 status comparison, and `git diff --check`.

Executed scope is local framework-neutral logic and unique isolated PostgreSQL 18 only. Actual API, UI, browser/Network, real Provider/invoice, B-11/B-12, process/PC recovery, shared DB, ysna, production, deployment, acceptance, commit, and push are `NOT_EXECUTED`. R3 remains pending conversation-separated independent retest.

Rollback is limited to the exact7 bytes and, only on an approved isolated database, `0009_intervention_budget -> 0008_queue_worker_leases`. No shared or production rollback is authorized.
