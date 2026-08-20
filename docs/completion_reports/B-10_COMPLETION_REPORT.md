# B-10 R3 Developer Completion Report

- Package: `B-10`
- Result: `COMPLETED`
- Status: `COMPLETED_PENDING_INDEPENDENT_RETEST`
- WorkInstruction: `WI-B-10-20260821-003`, SHA-256 `193734C3AD871D8042C0440342763A289DDCA70E1F862A143B357A1B8AABCF2D`.
- Start: `main=origin/main=4cc75da50e9eb16988bc07ab7b1f237bd2b6b169`, clean; epoch-3 fencing tokens and exact7 verified.
- Finding: `BLK-B10-IT-001-R2` fixed, independent R3 retest pending.

## Change

Authoritative usage finalization is now immutable per reservation. The in-memory repository stores a reservation-level canonical final binding, and PostgreSQL enforces the same boundary with a partial unique index plus row-locking `anvil_budget_reconcile()`.

Exact canonical replay is idempotent. A different receipt identity, payload hash/fields, actual usage, or release is rejected without changing the reservation, snapshot, release count, or hard-limit exposure. Concurrent distinct receipt IDs choose one authoritative final. R2 unresolved exposure accounting and all R1 intervention/pause/cancel contracts remain unchanged.

## Verification

- Local RED: `2 failed`; distinct final accepted and concurrent winners `8` instead of `1`.
- PostgreSQL RED: authoritative-final schema identity and reconcile function absent, `2 failed`.
- Local quota/reconcile GREEN: `6 passed`.
- Local focused: `15 passed, 4 DSN-gated skipped`.
- PostgreSQL 18 focused: `19 passed`.
- Canonical core: `117 passed, 6 DSN-gated skipped`.
- Full tooling: `355 passed, 36 expected active-dirty projection failures`.
- Sequential and concurrent distinct-final identity, payload, actual/release, exact replay, new49 rejection, R2 unresolved exposure, and reservation concurrency: PASS.
- Migration and compatibility: pre-R3 `0009 -> 0008`, R3 `0008 -> 0009 -> 0008` PASS after the observed missing-index downgrade was made conditional.
- Final database objects: `0 tables / 0 functions`, head `0008_queue_worker_leases`.
- Exact Docker cleanup: PASS, post-filters blank.

Detailed commands, exit codes, hostile cases, tooling classification, and runtime boundary are in `docs/validation/B-10_INTERVENTION_BUDGET_VALIDATION.md`.

## Boundary and handoff

Only exact7 paths changed. progress/HANDOFF, Tester report, checkers, Git index/refs, commit, push, acceptance, B-11/B-12, Provider adapter, shared DB, ysna, production, and deployment were not modified or started.

Actual API/UI/browser/Provider/recovery/production behavior remains `NOT_EXECUTED`; the executed local and isolated-DB results prove only their scope. The raw6 manifest excludes itself and is frozen with `self_reference=false`. Main Agent review and an independent R3 retest are next.
