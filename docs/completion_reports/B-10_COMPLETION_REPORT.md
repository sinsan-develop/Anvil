# B-10 Developer Completion Report

- Package: `B-10`
- Result: `COMPLETED`
- Package status: `COMPLETED_PENDING_INDEPENDENT_TEST`
- WorkInstruction: `WI-B-10-20260820-001` / SHA-256 `A1CE280DA209D0542C8F476C83B5DFB2A08A14086BA11F38C9D210C2E983B34F`
- Start: `main=origin/main=9419c686c1e82823ced20c3cb9b0ddfcfa82d7ba`, clean; epoch-1 execution/write fencing tokens and exact15 verified.

## Changes and impact

Added framework-neutral human intervention and Run-control models/services, atomic budget/quota models/service, persistence port with a thread-safe reference adapter, reversible `0009_intervention_budget`, and exact four focused test modules. Existing B-06 Event, B-08 outbox/checkpoint, and B-09 fencing artifacts were read-only predecessors and were not modified.

The implementation separates request, acknowledgement, new-action block, and effective Receipt times; prioritizes human input; fail-closes ambiguous commands; prevents new Actions after STOP/cancel; enforces seven cancel stages and immutable `CANCELLED`; restricts same-Run resume to the three allowed statuses; requires reapproval/reconfirmation after binding drift; and permits continuation only as a new Run with `prior_run_id` and reusable checkpoint/artifact references.

Budget reservation is atomic and precedes Provider dispatch. Hard cost/token/concurrency limits fail closed with Provider send count zero. Reconciliation is idempotent, consumes actual usage, releases the remainder, preserves abort/request/retry/rate/provenance, and never turns unknown usage into zero. Quota pause records checkpoint, incomplete Step, reset hint, and next action.

## Verification evidence

- TDD exact4 feature-absent RED: `8 expected failures` across four independent commands before implementation.
- Final local focused: `11 passed, 1 isolated-DSN skipped`.
- Final isolated PostgreSQL 18 focused: `12/12 PASS`.
- Core regression: `113 passed, 3 isolated-DSN skipped`.
- Full tooling: `341 passed, 34 expected active-dirty projection failures`; no product regression was identified and prohibited checkers/progress were not edited.
- Final migration: `0008 -> 0009 -> 0008` PASS; rollback B-10 objects `0 tables / 0 functions`.
- Concurrent hard-limit reservation, Receipt timestamp hostile case, canonical idempotency conflict, compile/import, diff check, and exact Docker cleanup: PASS.

Exact commands, environment boundary, expected tooling failure classification, and PostgreSQL evidence are in `docs/validation/B-10_INTERVENTION_BUDGET_VALIDATION.md`. The EvidenceManifest binds raw14 checksums and `self_reference=false`.

## Unexecuted scope and residual risk

API/UI/browser/Network, real Provider requests/invoices, B-11 BFF/SSE, B-12 process/PC recovery, ysna-server, shared-db, production, deployment, commit, push, B-10 acceptance, and B-11 start are `NOT_EXECUTED`.

The framework-neutral reference services do not claim production process abort or invoice integration. Those boundaries remain assigned to later provider/recovery packages. The observed Windows Docker loopback proxy instability was isolated from PostgreSQL product evidence and did not affect the final fresh-resource PASS.

## Rollback and handoff

Revert only the B-10 exact15 paths. On an approved isolated database at `0009_intervention_budget`, downgrade to `0008_queue_worker_leases`. Developer did not update progress/HANDOFF, revoke leases, stage, commit, push, accept B-10, or start B-11. Main Agent review and independent testing are next.
