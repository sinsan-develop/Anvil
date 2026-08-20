# B-10 Human Intervention and Atomic Budget Validation

## Binding and write boundary

- WorkInstruction: `WI-B-10-20260820-001` / SHA-256 `A1CE280DA209D0542C8F476C83B5DFB2A08A14086BA11F38C9D210C2E983B34F`.
- Invocation: SHA-256 `E8BF31253E56809A13F76DF7E51125A222A23919C498623093F29AE028D60351`.
- Canonical start: `main=origin/main=9419c686c1e82823ced20c3cb9b0ddfcfa82d7ba`, clean; product predecessor baseline `ac371f5743dce0fa87b3ee3b767d63c9c6102cd8` plus B-10 start projection.
- Lease: `developer-primary-b10`, execution token `b10-execution-fence-epoch-1-ac371f5`, write token `b10-write-fence-epoch-1-ac371f5`, exact 15 paths.
- Assigned IDs: `AV-SAFE-003`, `AV-SAFE-025`, `AV-STAT-030~033`, `AV-STAT-037`, `AV-AGT-006`.

Authority, progress/HANDOFF, checkers, Git index, B-01~B-09 artifacts, B-11/B-12, API/UI/provider/deployment paths were not modified.

## TDD and local verification

The exact four test files were created before product modules. Each file was executed independently and observed expected feature-absent RED: two failures per file, eight failures total. The worktree `.venv` lacked pytest, so that environment error was excluded; the established Anaconda Python runtime ran the valid RED/GREEN cycles.

Additional RED cycles caught the absent `0009` migration, equal request/effective timestamp acceptance, and non-identical reservation replay. Minimal fixes made each behavior GREEN. Two PostgreSQL fixture corrections were recorded without changing product behavior: composite `NULL` is returned as `(None,)`, and globally unique request IDs require the fixture suffix.

Final local results:

- Focused: `11 passed, 1 skipped`; the single skip is the isolated `ANVIL_B10_PG18_DSN` integration test and is not counted as PASS.
- Core regression with `--import-mode=importlib`: `113 passed, 3 skipped`; the three skips are DSN-gated B-09/B-10 PostgreSQL tests.
- Compile/import: PASS, including `B10_IMPORT_OK`.
- `git diff --check`: PASS.
- Full tooling: `341 passed, 34 failed`. All failures were confined to historical A-13 evidence and project-progress checkers that intentionally reject an active dirty Developer worktree (`EVIDENCE_ACTUAL_DIFF_MISMATCH`/raw-byte mismatch and `GIT_DESCENDANT_WORKTREE_DIRTY`). No checker or progress file was changed to hide this expected active-package projection.

The services enforce human-event priority, ambiguous-input `WAITING_DECISION`, immediate STOP scheduling block, distinct Receipt stages, safe-point effectiveness, pause/resume allowlist, binding-drift reapproval, ordered seven-step cancel, immutable terminal status, and `prior_run_id` continuation through a new Run. Budget admission reserves forecast maximum before the sender callback; concurrent failures never call the sender. Final usage consumes actual, releases remainder, preserves request/abort/retry/rate/provenance fields, is idempotent, and leaves unknown usage reserved as `USAGE_RECONCILIATION_REQUIRED`. Quota warning/pause blocks new actions and records checkpoint, incomplete Step, reset hint, and next safe action.

## Isolated PostgreSQL 18 verification

Final-byte verification used unique container `anvil-b10-dev-pg18-315-c`, network `anvil-b10-dev-net-315-c`, image `postgres:18-alpine`, tmpfs `/var/lib/postgresql`, and loopback-only `127.0.0.1:32773`. shared-db, ysna-server, production, and deployment were never accessed.

- `0008_queue_worker_leases -> 0009_intervention_budget` exited `0`.
- DSN-enabled focused suite: `12/12 PASS`.
- Eight concurrent SQL reservations at cost `30`/tokens `300` under cost `100`/tokens `1000` admitted exactly three; active totals were cost `90`, tokens `900`.
- Reusing one reservation ID with changed forecast returned `NULL`; the original row count stayed `1`.
- An equal requested/effective timestamp Receipt was rejected by `ck_human_intervention_time_order`; a later effective timestamp was accepted.
- `0009_intervention_budget -> 0008_queue_worker_leases` exited `0`; five B-10 tables and the reservation function were `0/0`, Alembic head was `0008_queue_worker_leases`.
- Exact container/network cleanup succeeded; filtered remaining resources were blank.

An earlier isolated `a` resource passed the first concurrency run, then Windows Docker loopback port forwarding became unreliable under repeated connection establishment while PostgreSQL remained running with no OOM/restart. This environment-only observation was excluded from PASS aggregation; final evidence comes from the fresh `c` resource above.

## Runtime boundary, residual risk, and rollback

- Actual local service and isolated PostgreSQL 18: PASS within the executed scope.
- Actual API, UI, browser, real Provider, B-11 SSE/BFF, B-12 process/PC recovery, ysna/shared-db, production, deployment: `NOT_EXECUTED`.
- In-memory services are framework-neutral reference implementations; production request abort and Provider invoice adapters remain later-package responsibilities.
- Rollback is limited to the exact B-10 paths. On an approved isolated database at `0009_intervention_budget`, downgrade only to `0008_queue_worker_leases`. Never apply this rollback to shared-db, ysna-server, or production without a separately approved deployment plan.
