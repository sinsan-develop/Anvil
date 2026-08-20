# B-10 Independent Test Report

- Package: `B-10`
- Tester: implementation conversation-separated independent Tester
- Tested baseline: `main = origin/main = e9dd00983775a5b1b2849f6be35304e34ef4fa17`
- Tested projection: sequence `318`, `B-10 / TEST_REVIEW`, worker/write lease `null`, B-11 `BLOCKED_PENDING_B10_ACCEPTANCE`
- Tested at: `2026-08-21` (Asia/Seoul)
- Verdict: `REWORK_REQUIRED`
- Blocking finding count: `1`
- Write scope: this report only

## 1. Decision

### Decision

`REWORK_REQUIRED`

### Reason

Authority hashes, WorkInstruction/Invocation binding, frozen raw 14 artifacts, and target hash were independently recalculated successfully. Current checkout and a clean default fresh clone both passed focused B-10, canonical core, full tooling, and four standalone checkers. A unique isolated PostgreSQL 18.4 environment passed migration `0008_queue_worker_leases -> 0009_intervention_budget -> 0008_queue_worker_leases`, DSN-focused `12/12`, concurrent reservation, hostile timestamp/idempotency, rollback object removal, and exact cleanup.

However, `BLK-B10-IT-001 / CRITICAL` remains. When final usage is unknown, the reservation row retains its forecast amount but changes to `RECONCILIATION_REQUIRED`. Both the in-memory snapshot and PostgreSQL reservation function count only `RESERVED` rows against the hard limit. Therefore unresolved worst-case cost/token usage disappears from admission accounting and a later Provider request can reserve and send up to the full limit again. Under a cost/token hard limit of `50/500`, an unresolved `40/400` reservation and a new accepted `50/500` reservation coexisted. This violates the WorkInstruction contracts that unknown usage must not be treated as zero and that Provider dispatch must remain bounded by atomic hard-limit reservation.

### Action

Main Agent should keep B-10 unaccepted and issue a scoped rework instruction. `RECONCILIATION_REQUIRED` reservations must continue to consume worst-case reserved cost/tokens and concurrency until an authoritative final usage receipt resolves them or an explicitly governed adjustment is recorded. The fix must cover both the in-memory repository and PostgreSQL admission query, add local and DSN hostile regression tests, regenerate the frozen B-10 evidence, and return to independent retest. This Tester did not accept B-10, start B-11, commit, push, or deploy.

## 2. Baseline, authority, and frozen evidence

| Item | Result |
|---|---|
| HEAD / origin/main | `e9dd00983775a5b1b2849f6be35304e34ef4fa17` / equal |
| initial status | clean |
| progress | sequence `318`, `TEST_REVIEW`, leases `null` |
| WorkInstruction SHA-256 | `A1CE280DA209D0542C8F476C83B5DFB2A08A14086BA11F38C9D210C2E983B34F` |
| Invocation SHA-256 | `E8BF31253E56809A13F76DF7E51125A222A23919C498623093F29AE028D60351` |
| product manifest SHA-256 | `750AB971D95D860324656AE81CF8501C434AF78210386B277C26ACC5F791086F` |
| exact paths / raw artifacts | `15 / 14` |
| raw checksum errors | `0` |
| canonical bytes / content bytes | `1541 / 69490` |
| target hash | `0DDE236523F95C995A583C580108744A656717F4D285CFE30B1ED4FC5E46C43F`, match |
| self-reference | `false` |

Authority bytes matched the WorkInstruction baselines:

- design `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- plan `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- matrix `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- test plan `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- operating rules `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`

## 3. Current and fresh-clone regression

The fresh clone used `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\b10-it-clone-20260821-318`, verified the same HEAD and a clean status, and was removed by exact resolved path after testing.

| Verification | Current | Fresh clone |
|---|---:|---:|
| focused intervention/budget exact four files | `11 passed, 1 skipped` | `11 passed, 1 skipped` |
| canonical combined core with `--import-mode=importlib` | `113 passed, 3 skipped` | `113 passed, 3 skipped` |
| full `tests/tooling` | `379 passed` | `379 passed` |
| four standalone checkers | `4/4 PASS` | `4/4 PASS` |
| raw 14 / target recomputation | match | match |

The local/fresh skips were only DSN-gated B-09/B-10 PostgreSQL integration tests. The isolated DSN run separately passed B-10 focused `12/12`.

One initial over-broad core command collected three sample repositories under `tests/fixtures/repositories` and stopped with their intentionally isolated `src` imports. That command is not the canonical core set and was excluded from product results. It created exactly three ignored `__pycache__` directories at the same execution timestamp. The first tooling run then correctly reported `FIXTURE_SOURCE_INVENTORY_MISMATCH` (`3 failed, 376 passed`). The Tester verified those exact generated paths, removed only those three caches, enabled `PYTHONDONTWRITEBYTECODE=1`, and reran tooling to the current `379/379` PASS. No fixture source, manifest, checker, product, authority, progress, or HANDOFF file was changed.

Standalone outputs were:

- A-13 repository scan: `fixtures=8 zero_delta=8 hostile=15`
- G-07 baseline: `packages=108 av=255 uncovered=0 scenarios=20`
- Phase G Gate: `accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`
- project progress: `sequence=318 reporting=AUTO_CONTINUE`

## 4. Blocking finding

### BLK-B10-IT-001 — unresolved usage is released from admission accounting

- Severity: `CRITICAL`
- Status: `OPEN`
- Affected contracts: B-10 atomic hard-limit reservation, usage reconciliation, unknown usage not zeroed, Provider-before-send admission
- Affected paths: `packages/persistence/intervention_budget_repository.py`, `migrations/versions/0009_intervention_budget.py`; regression coverage in `tests/budget/test_quota_reconcile.py` and `tests/budget/test_atomic_reservation.py`

#### In-memory reproduction

1. Create hard limit `cost=50`, `tokens=500`.
2. Reserve forecast `40/400`.
3. Reconcile an `ABORT_UNKNOWN` receipt with `actual_cost=None`, `actual_tokens=None`.
4. The row becomes `RECONCILIATION_REQUIRED` and still stores `reserved_cost=40`.
5. The snapshot reports `reserved_cost=0`, `active_requests=0`.
6. A second forecast reservation of `50/500` is accepted.

Observed output:

```text
AFTER_UNKNOWN status=RECONCILIATION_REQUIRED row_reserved=40 snapshot_reserved=0 active=0
SECOND_RESERVATION=ACCEPTED
BudgetSnapshot(... reserved_cost=Decimal('50'), reserved_tokens=500, consumed_cost=Decimal('0'), active_requests=1 ...)
```

Root cause is `_snapshot_unlocked()` selecting active reservations only when `status is ReservationStatus.RESERVED`. `RECONCILIATION_REQUIRED` preserves row values but is omitted from cost, token, and concurrency admission totals.

#### PostgreSQL 18 reproduction

The isolated database reproduced the same accounting boundary. After a valid `40/400` reservation, the row was moved to the schema's `RECONCILIATION_REQUIRED` status to represent unresolved final usage. `anvil_budget_reserve()` then accepted a new `50/500` reservation under the same `50/500` ledger:

```text
FIRST ('r1-...',)
ALTERED_IDEMPOTENCY (None,)
SECOND_AFTER_UNKNOWN ('r2-...',)
ROWS [('RECONCILIATION_REQUIRED', Decimal('40.00000000'), 400),
      ('RESERVED', Decimal('50.00000000'), 500)]
```

Root cause is the SQL admission query filtering active forecast totals and concurrency with `status='RESERVED'`, while unresolved rows have zero consumed usage. The two layers therefore share the same defect.

## 5. PostgreSQL 18 and hostile verification

- Container: `anvil-b10-it-pg18-318`
- Network: `anvil-b10-it-net-318`
- Image/version: `postgres:18-alpine`, PostgreSQL `18.4`, server number `180004`
- tmpfs: `/var/lib/postgresql`
- bind: loopback-only `127.0.0.1:32770`
- shared-db / ysna / production / deployment: not accessed

Successful evidence:

1. `0008_queue_worker_leases -> 0009_intervention_budget` passed.
2. DSN-focused B-10 suite passed `12/12`.
3. Eight simultaneous forecast reservations of `30/300` under `100/1000` admitted exactly three, totaling `90/900`.
4. Changed forecast replay for an existing reservation ID returned `(None,)`; the original binding remained singular.
5. Equal request/effective timestamps were rejected by `ck_human_intervention_time_order`; a later effective timestamp was accepted.
6. Separate in-memory hostile checks rejected cost, token, and concurrency over-limit attempts before the sender; the sender list contained only the first admitted request.
7. Identical usage receipt replay was idempotent; changed content under the same usage receipt ID was rejected.
8. `0009_intervention_budget -> 0008_queue_worker_leases` passed; five B-10 tables and `anvil_budget_reserve` were `0 / 0` and Alembic current was `0008_queue_worker_leases`.
9. Exact container/network removal succeeded and exact-name filtered listings were blank.

The first cleanup call encountered a WSL `E_ACCESSDENIED` before Docker execution. It was excluded from cleanup PASS; the same exact-name cleanup was retried through the approved execution path, returned both removed resource names, and blank post-filters.

## 6. Intervention and assigned-ID result

Independent hostile service checks confirmed:

- human input was dequeued before a system Event even when requested later;
- STOP immediately made new scheduling false;
- ambiguous STOP/CANCEL became `WAITING_DECISION`;
- cancel accepted only the seven canonical steps in order;
- `CANCELLED` resume and status mutation were rejected;
- continuation used a new Run with `prior_run_id` and a reusable checkpoint;
- drifted plan/baseline/policy bindings without reapproval were rejected;
- same-Run resume stayed restricted to `PAUSED_USER`, `PAUSED_QUOTA`, and `INTERRUPTED`.

| ID | Result | Evidence |
|---|---|---|
| `AV-SAFE-003` | PASS | binding drift without new approval/reconfirmation rejected |
| `AV-SAFE-025` | PASS | STOP blocked new Action scheduling immediately |
| `AV-STAT-030` | PASS | seven-step cancel order and out-of-order rejection |
| `AV-STAT-031` | PASS | `CANCELLED` terminal mutation/resume rejected |
| `AV-STAT-032` | PASS | continuation only through a new Run with `prior_run_id` |
| `AV-STAT-033` | PASS | resume allowlist enforced |
| `AV-STAT-037` | PASS | binding drift required reapproval reference |
| `AV-AGT-006` | PASS | human Event priority over system Event |

These assigned-ID results do not override `BLK-B10-IT-001`; the package-level budget and reconcile completion contract remains failed.

## 7. Runtime boundary and final status

- Actual local framework-neutral services: executed.
- Actual isolated PostgreSQL 18: executed.
- Actual API, UI, browser, Network, real Provider/invoice, B-11 BFF/SSE, B-12 process/PC recovery, shared-db, ysna, production, deployment: `NOT_EXECUTED`.
- Acceptance, commit, push, B-11 start: `NOT_EXECUTED`.
- Product, authority, progress/HANDOFF, checker writes: `0`.
- Written file: `docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md` only.

Final verdict: `REWORK_REQUIRED`, blocking finding count `1`.
