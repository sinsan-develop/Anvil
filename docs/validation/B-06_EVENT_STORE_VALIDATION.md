# B-06 Event Store Validation

## Binding and scope

- Work Package: `B-06`
- WorkInstruction: `WI-B-06-20260815-001`
- WorkInstruction SHA-256: `C52B192E88B581B44B47D2A07DC7E293119BE9F60732988393C99795A03DB827`
- Invocation SHA-256: `5AEBDFE2167788AB52BC2873194A7253CDD960119BD1D9C4F993ADC09D1B8B58`
- Start sequence/status: `264 / B-06 ACTIVE`
- Baseline: `HEAD=origin/main=105b12be5554d0d2de0c5440cda3d2cb25e98c05`, clean before mutation
- Worker/write lease: epoch 1, exact B-06 fencing tokens and exact 15-path allowlist verified
- Assigned verification: `AV-STAT-004`, `AV-STAT-005`, `AV-STAT-006`, `AV-STAT-020`

Only the WorkInstruction exact 15 paths were written. B-01 through B-05 sources, progress/HANDOFF, checkers, dependencies/configuration, Git refs/index, apps, API routes, and deployment files were not modified.

## TDD evidence

The four required test modules were created before production implementation. Each was executed independently and produced exit 1 because the new Event Store/API modules did not exist:

- `python -m unittest tests.events.test_event_store -v`
- `python -m unittest tests.events.test_transition_guard -v`
- `python -m unittest tests.events.test_idempotency -v`
- `python -m unittest tests.events.test_navigation_guard -v`

After the first GREEN, a standalone persistence Protocol import exposed a circular import. The test import order reproduced the failure, and a type-only import removed the cycle. A final TDD increment also fixed direct replay-gap and framework-neutral optimistic-conflict contracts: the focused module first failed on absent contracts, then passed after the minimal implementation.

## Implemented contracts

- Immutable `EventCommand`, `StoredEvent`, `RunProjection`, and `AppendReceipt` models with recursively frozen payloads.
- Append-only repository Protocol and in-memory implementation with per-Run ordered Event history.
- Canonical request hash and duplicate receipt behavior: identical `event_id` plus `idempotency_key` request returns the original Event/projection without a new sequence or reducer apply, including after Store instance restart by replaying repository history; changed identifier/payload/hash conflicts fail closed.
- B-01 canonical transition table reuse, optimistic expected-version guard, stored-Event-before-reducer ordering, and deterministic replay with gap/version/run rejection.
- `NAVIGATE`, `VIEW`, `OPEN`, and `SELECT` rejection before mutation; Event count, projection, and version remain unchanged.
- Exact nine-value B-01 `BlockedCode` vocabulary and `RUN_BLOCKED` projection behavior.
- Framework-neutral mutation request/result and conflict code. No HTTP status or framework route mapping was introduced.
- Reversible `0005_event_store` migration with `UNIQUE(run_id, sequence_no)`, `UNIQUE(run_id, idempotency_key)`, request hash/version/blocked-code checks, append-only trigger, and row-locked compare-and-append function.

## Local verification results

- `python -m unittest discover -s tests\events -v`: `14/14 PASS`.
- `python -m unittest discover -s tests\domain -v`: `14/14 PASS`.
- `python -m unittest discover -s tests\design -v`: `14/14 PASS`.
- `python -m unittest discover -s tests\planning -v`: `9/9 PASS`.
- `python -m unittest discover -s tests\persistence -v`: `7/7 PASS`.
- `python -m unittest discover -s tests\execution -v`: `11/11 PASS`.
- Combined core regression: `55/55 PASS`.
- `python -m py_compile` for all seven Python implementation paths and migration: PASS.
- Standalone `EventRepository` import: PASS.
- `git diff --check`: exit 0.

Tooling full execution ran 319 tests and reported 19 failures. They are not product failures and were not suppressed:

- 13 `test_a13_repository_scan` failures: 12 frozen predecessor manifest validations reported the exact active-diff codes `EVIDENCE_ACTUAL_DIFF_MISMATCH`, `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, and `EVIDENCE_RAW_HASH_MISMATCH`; one predecessor successor-selection assertion was absent because the live B-06 diff is outside that predecessor scope.
- 6 `test_project_progress` failures: only `GIT_DESCENDANT_WORKTREE_DIRTY`, expected while the authorized B-06 bytes are uncommitted.

## Isolated PostgreSQL 18 evidence

- Engine: PostgreSQL `18.4`, image `postgres:18-alpine`.
- Unique resources: container `anvil-b06-pg18-20260815-01`, network `anvil-b06-net-20260815-01`, loopback-only host port `55436`.
- Upgrade: Alembic `0004_execution_release → 0005_event_store`, current revision `0005_event_store`.
- Valid append: first receipt `sequence=1`, `applied_version=2`, `duplicate=false`.
- Identical resend: original `sequence=1`, `applied_version=2`, `duplicate=true`; Event count and run version remained `1` and `2`.
- Hostile cases all rejected with exit 1: stale expected version, Event UPDATE, Event DELETE, unknown blocked code, and reused idempotency key with different request.
- Post-hostile history remained `count:min:max = 1:1:1`.
- Downgrade: `0005_event_store → 0004_execution_release`; `run_events` and append function absence both `true`.
- Cleanup: the exact container and network were removed; independent filtered listings were blank.

An initial readiness probe intersected PostgreSQL's normal init-time temporary shutdown. A later direct readiness/log check confirmed the final server was healthy; this was an environment timing incident, not a product failure. A cleanup verification wrapper also had a PowerShell command-substitution syntax artifact after removal; the subsequent direct absence check exited 0 with blank listings.

## Runtime boundary and residual risk

Actual database validation is `PASS_ISOLATED_WSL_POSTGRESQL18_ONLY`. Actual FastAPI/auth/SSE/same-origin BFF, HTTP 409 mapping, external API, UI, browser Network, provider, ysna-server, shared-db, production, and deployment are `NOT_EXECUTED`. The repository remains a framework-neutral Protocol plus test in-memory adapter; durable application adapter and HTTP integration belong to later Packages.

## Rollback

For an approved Anvil-isolated database at `0005_event_store`, downgrade only to `0004_execution_release`. Source rollback is limited to the exact B-06 file set after Main review. Never apply this rollback to shared-db, ysna-server, or production without a separately approved migration plan.
