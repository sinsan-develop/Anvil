# B-09 Main Takeover Completion Report

- Package: `B-09`
- Result: `COMPLETED`
- Package status: `COMPLETED_PENDING_INDEPENDENT_TEST`
- WorkInstruction: `WI-B-09-20260820-005` / SHA-256 `108E951F23FAAC8390D6B17D64A206C127FE73D2776126E8B518EB674166725D`
- Takeover/rework: Main takeover remained active; independent Tester findings `BLK-B09-IT-001/002` were accepted at sequence `308` with Main epoch-5 worker/write lease.
- Start: `main=origin/main=7c3382a497e995e18c736a487eee8761aa0c1a05`; exact product 15 paths preserved.

## Changes

Implemented framework-neutral durable queue models/service, worker and write lease models/service, canonical path conflict identity, QueueLeaseRepository persistence port, and reversible `0008_queue_worker_leases` migration. R5 closes max-attempt orphan head blocking by atomic quarantine and resolves existing symlink/junction aliases before fail-closed repository boundary checks.

## Evidence

- Three test modules were created first; feature-absent import RED was observed before product implementation.
- Focused B-09 final GREEN was local `9 passed, 2 skipped` and isolated PostgreSQL `11/11 PASS`; core regression was `102 passed, 2 skipped` without an isolated DSN.
- The migration syntax, persistence-port import and `git diff --check` passed.
- A fixed test token fixture originally reused one value for two claims, so it could not represent a stale token. The fixture was changed to deterministic distinct tokens; this was a test-input correction, not a product FAILURE_REPORT.
- Exact 15-path freeze and raw-14 evidence binding are recorded in `B-09_EVIDENCE_MANIFEST.json`; its self-reference is false.

## Database evidence and unexecuted scope

R5 isolated WSL PostgreSQL 18 passed `0007 -> 0008 -> 0007`, FI-04, stale execution/write rejection, concurrent `SKIP LOCKED`, max-attempt orphan quarantine with next-job progress, rollback object absence and exact resource cleanup. A real Windows junction and external absolute-path hostile test also passed. API/UI/browser/provider/ysna/shared-db/production/deployment remain `NOT_EXECUTED`.

## Rollback and handoff

Revert only the exact B-09 product paths. On an isolated database upgraded to `0008_queue_worker_leases`, downgrade only to `0007_progress_outbox`. Do not run against shared-db, ysna-server or production. B-10 was not started.
