# B-09 Durable Queue and Fencing Validation

## Binding and write boundary

- WorkInstruction: `WI-B-09-20260820-005` / SHA-256 `108E951F23FAAC8390D6B17D64A206C127FE73D2776126E8B518EB674166725D`
- TakeoverPacket: `docs/work_orders/B-09_MAIN_TAKEOVER_PACKET_R4.md`; sequence `308`, Main epoch-5 rework after independent Tester findings `BLK-B09-IT-001/002`.
- Start baseline: `main=origin/main=7c3382a497e995e18c736a487eee8761aa0c1a05`; product implementation remained inside the exact 15 paths.
- Tokens: `b09-main-rework-execution-fence-epoch-5-7c3382a` and `b09-main-rework-write-fence-epoch-5-7c3382a`.
- Assigned IDs: `AV-STAT-026`, `AV-STAT-027`, `AV-STAT-043`, `AV-SAFE-028`; FI-04 requires three same-fingerprint heartbeat-stop repetitions.

Only the Developer exact 15 paths were written. Authority, progress/HANDOFF, checkers, Git index, B-10, ysna/shared-db, production, deployment and API/UI were not changed.

## TDD and local verification

- RED: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.queue.test_durable_queue tests.leases.test_worker_write_fencing tests.paths.test_conflict_scope_identity` exited `1` with expected absent-module imports for `packages.queue`, `packages.leases`, and `packages.paths`.
- GREEN: the R5 focused suite exited `0`; local-only `9 passed, 2 skipped`, then isolated PostgreSQL integration `11/11 PASS`.
- Core regression with importlib collection: `102 passed, 2 skipped`; the two skips are the intentionally DSN-gated PostgreSQL tests when no isolated DSN is supplied.
- Migration syntax compile, standalone QueueLeaseRepository import, and `git diff --check` exited `0`.

The queue reference service provides at-least-once claim/retry, monotonic job lease epochs, execution-token checks for heartbeat/complete/fail, expired-claim recovery, and max-attempt quarantine. The lease service prevents concurrent worker/write ownership and rejects stale execution/write token pairs with `STALE_FENCING_TOKEN`. Conflict scope identity normalizes Windows drive, `/mnt`, case policy, lexical aliases and relative path traversal into `(repository_id, canonical_repo_relative_path, repository_case_policy)`.

## PostgreSQL 18 boundary

Actual isolated WSL PostgreSQL 18 verification passed in the dedicated `anvil-b09-main-pg18-7c3382` container and `anvil-b09-main-net-7c3382` network on loopback port `32768`.

- Alembic `0007_progress_outbox -> 0008_queue_worker_leases -> 0007_progress_outbox` passed; rollback left all four B-09 tables absent and matching functions count `0`.
- FI-04 ran three independent expired-worker cases. Each atomic `anvil_queue_reclaim_orphan` call observed DB UTC expiry, changed worker ownership, incremented epoch `1 -> 2`, rotated the execution token, and rejected the old heartbeat with `STALE_FENCING_TOKEN`.
- `anvil_require_current_write_lease` accepted the exact current execution/write token, write epoch and canonical scope, and rejected stale write epoch fail-closed.
- Two concurrent connections claimed different jobs through `FOR UPDATE SKIP LOCKED`; max-attempt poison processing created one quarantine record.
- The exact container/network were removed and filtered post-checks were blank. shared-db, ysna, production and deploy were untouched.

API/UI/browser/provider/ysna/shared-db/production/deployment remain `NOT_EXECUTED`.

## R5 independent-test blocker closure

- `BLK-B09-IT-001`: expired `attempts >= max_attempts` jobs now move atomically to quarantine before claim. The local and PostgreSQL hostile tests prove the queue advances to the next ready job without a constraint loop.
- `BLK-B09-IT-002`: existing filesystem aliases are resolved before repository-relative comparison. A real Windows junction converges to the canonical scope, while an absolute path outside the repository fails closed.
- R5 used a new isolated PostgreSQL 18 container/network on loopback `32769`; `0007 -> 0008 -> 0007`, focused `11/11`, rollback objects `0`, and exact resource cleanup passed.

## Residual risk and rollback

The reversible migration defines queue, quarantine, worker lease and write lease tables plus DB-time claim, heartbeat, orphan reclaim, completion/failure and current-write guard functions. Source rollback is limited to the B-09 exact 15 paths after Main review. On an approved isolated database at `0008_queue_worker_leases`, downgrade only to `0007_progress_outbox`; never use shared-db, ysna-server, or production.
