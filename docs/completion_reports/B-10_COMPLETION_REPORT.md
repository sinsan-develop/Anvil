# B-10 R2 Developer Completion Report

- Package: `B-10`
- Result: `COMPLETED`
- Status: `COMPLETED_PENDING_INDEPENDENT_RETEST`
- WorkInstruction: `WI-B-10-20260821-002`, SHA-256 `DFFCE00D420BC0DDC04C48B18856D111397C8DDC67155EE3DE702B8C379E6D21`.
- Start: `main=origin/main=a5515ea94d3b5a6e185c0521a0de4906d6e21dae`, clean; epoch-2 execution/write tokens and exact7 verified.
- Finding: `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE` fixed, awaiting independent retest.

## Change and impact

`RECONCILIATION_REQUIRED` reservations now remain full worst-case cost, token, and concurrency exposure until an authoritative final receipt resolves them. The in-memory snapshot and PostgreSQL admission function use the same active-status set. An unresolved `40/400` reservation therefore keeps snapshot `40/400`, active count `1`, and rejects a new reservation that would exceed any hard limit before Provider dispatch.

Authoritative final usage still consumes actual usage and releases the forecast remainder exactly once. Identical receipt replay is idempotent, changed content remains rejected, and concurrent final reconcile/reserve cannot double-release, create negative exposure, or over-reserve. The implementation change is two status-filter edits; no public API/schema or migration revision changed.

## Verification

- TDD in-memory RED: `1 failed, 1 passed`; expected unresolved `40`, actual `0`.
- TDD PostgreSQL 18 RED: second reservation incorrectly accepted beside unresolved `40/400`.
- In-memory reconciliation GREEN: `4 passed`.
- Local focused: `13 passed, 2 DSN-gated skipped`.
- Isolated PostgreSQL 18 focused: `15 passed`.
- Canonical core: `115 passed, 4 DSN-gated skipped`.
- PostgreSQL concurrent admission: exactly three of eight accepted, totals `90/900`.
- Independent PostgreSQL unresolved cost/token/concurrency scenarios: all rejected the second reservation.
- Full tooling: `347 passed, 36 expected active-dirty projection failures`.
- Four standalone checkers: G-07 and Phase G PASS; A-13 and project-progress returned only the expected frozen-evidence/dirty-worktree codes.
- Migration: `0008 -> 0009 -> 0008` PASS; final B-10 objects `0 tables / 0 functions`, head `0008_queue_worker_leases`.
- Exact isolated Docker cleanup: PASS, post-filters blank.

Exact commands, exit codes, failure classification, and runtime boundary are recorded in `docs/validation/B-10_INTERVENTION_BUDGET_VALIDATION.md`.

## Scope and handoff

Only the R2 exact7 paths changed. R1 intervention/pause/cancel behavior and the other R1 exact15 paths remain unchanged. progress/HANDOFF, Tester report, checkers, Git index/refs, commit, push, acceptance, B-11/B-12, Provider adapter, shared DB, ysna, production, and deployment were not modified or started.

Actual API/UI/browser/Provider/recovery/production behavior remains `NOT_EXECUTED`; passing framework-neutral and isolated-DB tests prove only their executed scope. Main Agent review and a separate independent retest are next. The raw6 EvidenceManifest excludes itself and freezes the delivered R2 bytes with `self_reference=false`.
