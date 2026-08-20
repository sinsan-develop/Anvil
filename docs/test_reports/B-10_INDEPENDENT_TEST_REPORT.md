# B-10 Independent Retest Report — R2

- Package: `B-10`
- Retest revision: `R2`
- Tester: implementation conversation-separated independent Tester
- Tested baseline: `main = origin/main = 5f644f45835329ef0195dae948d3c55ba7ff15af`
- Tested projection: sequence `325`, `B-10 / TEST_REVIEW / PENDING_RETEST`, worker/write lease `null`, B-11 `BLOCKED_PENDING_B10_ACCEPTANCE`
- Source report SHA-256: `B1FDDE5244129A0E086E9F666A635955751A6D3A5A83DB582E23CC1EB90AEBBB`
- Failure fingerprint: `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`
- Result contract: `FAILURE_REPORT`
- Verdict: `REWORK_REQUIRED`
- Blocking finding count: `1`
- Write scope: this report only

## 1. Decision

### Decision

`REWORK_REQUIRED / FAILURE_REPORT`

### Reason

R2 closes the originally reported admission-filter defect: an unresolved `RECONCILIATION_REQUIRED` reservation now remains full cost, token, and concurrency exposure in both the in-memory repository and PostgreSQL `anvil_budget_reserve()`. Current and fresh-clone regression, independent local hostile execution, and isolated PostgreSQL 18 all confirmed that boundary.

The same failure fingerprint is nevertheless not fully closed. After an authoritative final receipt has consumed and released a reservation, a second final receipt with a different `usage_receipt_id` but the same reservation/request is accepted. It overwrites the already final consumed and released amounts. Under a hard limit of `50/500`, the first final receipt recorded actual `12/120` and release `28/280`; a second distinct-ID receipt changed the final state to actual `1/10` and release `39/390`, after which a new `49/490` reservation was accepted. The first authoritative usage plus the new reservation is `61/610`, exceeding both hard limits.

This violates the R2 WorkInstruction's explicit requirements that authoritative final usage consume/release exactly once, identical replay be idempotent, changed replay be rejected, and concurrent reconciliation never release exposure twice.

### Action

Main Agent must keep B-10 unaccepted and issue a scoped R3 rework for the same failure lineage. Once a reservation is `CONSUMED`, its authoritative final receipt binding and amounts must be immutable. Only the exact canonical final replay may return the existing result; any distinct receipt ID or changed content for the same consumed reservation must fail closed. The check and write must remain atomic under concurrent reconcile/reserve. Add regression cases for a different receipt ID with lower, equal, and higher final usage after consumption, including concurrent attempts and hard-limit admission after rejection. Then regenerate the frozen evidence and return to independent retest.

This Tester did not accept B-10, start B-11, commit, push, or deploy.

## 2. Authority, projection, and manifests

| Item | Result |
|---|---|
| HEAD / origin/main | `5f644f45835329ef0195dae948d3c55ba7ff15af` / equal |
| initial status | clean |
| progress | sequence `325`, `TEST_REVIEW / PENDING_RETEST`, leases `null` |
| R2 WorkInstruction SHA-256 | `DFFCE00D420BC0DDC04C48B18856D111397C8DDC67155EE3DE702B8C379E6D21` |
| R2 Invocation SHA-256 | `489222E413D61AEBEC177E42CDBBCA88AE4380644F5A6534511BC5B12C0F9674` |
| Developer manifest SHA-256 | `6CBB859DA5598F4586380A124477C0D0C084B64AB43ACAE8C2FE4182B6A37934` |
| Developer raw artifacts | `6`, checksum errors `0` |
| Developer canonical/content bytes | `705 / 46545` |
| Developer target | `6CEB2CB8CCFB2168141C0B995EB4E1868EFBF4D0EC1DC94B9176D860CD785317`, match |
| R2 completion projection raw artifacts | `6`, checksum errors `0` |
| R2 completion projection target | `B427A9090D4C9CA4BF19CFB2F7E1F2353CAF4AD07A35F144F620276A1632CAAD`, match |
| R1 completion historical raw artifacts | `4`, checksum errors `0` at `e9dd009` |
| R1 completion historical target | `585CA850332F1E18352A700D9A65CAF95D8497C3AFB7C21F7C2ABF13B394BA83`, match |

The historical raw-four calculation used the clean disposable clone detached at `e9dd00983775a5b1b2849f6be35304e34ef4fa17`; it did not compare the frozen R1 projection to the intentionally replaced R2 live manifest bytes.

## 3. Current and fresh-clone regression

The clean fresh clone used `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\b10-r2-it-clone-20260821-325`, initially matched `5f644f4`, and was removed by its exact resolved path after testing.

| Verification | Current | Fresh clone |
|---|---:|---:|
| focused intervention/budget | `13 passed, 2 skipped` | `13 passed, 2 skipped` |
| canonical core, `--import-mode=importlib` | `115 passed, 4 skipped` | `115 passed, 4 skipped` |
| full tooling | `387 passed` | `387 passed` |
| standalone checkers | `4/4 PASS` | `4/4 PASS` |
| Developer raw6/target | match | match |

The skips were only explicitly DSN-gated B-09/B-10 PostgreSQL tests. With the isolated B-10 DSN, the focused suite passed `15/15`.

Standalone outputs were:

- A-13 repository scan: `fixtures=8 zero_delta=8 hostile=15`
- G-07 baseline: `packages=108 av=255 uncovered=0 scenarios=20`
- Phase G Gate: `accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`
- project progress: `sequence=325 reporting=AUTO_CONTINUE`

## 4. R2 original finding retest

### Admission exposure — closed sub-boundary

Independent in-memory execution confirmed:

```text
UNRESOLVED 40 400 1 SECOND_BLOCKED True SENT []
FINAL 12 120 28 280 SNAP 38 380 12 120 1 RESERVE_SUCCESS 1 REPLAY_EQUAL True
CHANGED_REPLAY=REJECTED
```

Thus unresolved forecast `40/400`, concurrency `1` remains active; a second `50/500` request is rejected before sender invocation. Four exact final receipt replays returned one canonical result. Concurrent final reconciliation and five competing `38/380` reservations admitted only one reservation and kept total exposure at `50/500/1`.

The existing `CHANGED_REPLAY=REJECTED` check uses the same `usage_receipt_id`; it does not cover a distinct-ID second final receipt for the same reservation.

### PostgreSQL admission exposure — closed sub-boundary

In PostgreSQL 18, three independent unresolved scenarios retained `40/400` and rejected the second request by cost, token, and concurrency respectively. A separate unresolved-plus-concurrent race started with one `30/300` unresolved row under `100/1000/concurrency 3`; eight simultaneous `30/300` attempts admitted exactly two, leaving three active exposure rows totaling `90/900`.

## 5. Blocking finding — authoritative final can be replaced

### BLK-B10-IT-001-R2

- Severity: `CRITICAL`
- Status: `OPEN`
- Lineage: same `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`
- Affected contract: definitive final release exactly once; changed replay rejection; no double release/under-accounting
- Affected implementation: `packages/persistence/intervention_budget_repository.py::reconcile`
- Missing regression: different `usage_receipt_id` after the reservation is already `CONSUMED`

Independent reproduction:

1. Hard limit `50/500`, reserve forecast `40/400`.
2. Reconcile authoritative receipt `u1` with actual `12/120`.
3. Observe consumed `12/120`, released `28/280`.
4. Submit receipt `u2` for the same reservation/request with actual `1/10`.
5. R2 accepts `u2`, overwriting consumed to `1/10` and released to `39/390`.
6. A new `49/490` reservation is accepted.

Observed output:

```text
FIRST 12 28 BudgetSnapshot(... consumed_cost=Decimal('12'), consumed_tokens=120 ...)
SECOND_DISTINCT_ID=ACCEPTED 1 39 BudgetSnapshot(... consumed_cost=Decimal('1'), consumed_tokens=10 ...)
NEW49=ACCEPTED BudgetSnapshot(... reserved_cost=Decimal('49'), reserved_tokens=490,
                              consumed_cost=Decimal('1'), consumed_tokens=10 ...)
```

Root cause: `_usage` provides idempotency only by `usage_receipt_id`. `reconcile()` does not reject a new receipt ID after the reservation has reached `CONSUMED`, so the second call replaces the reservation's final values and creates a second canonical-looking reconciliation result. The global `RLock` serializes the operations but cannot enforce an absent terminal-final guard.

An initial one-off harness invocation used the wrong result attribute name (`actual_cost` instead of `consumed_cost`) and stopped before the second receipt. It was excluded from product evidence. The corrected command produced the output above.

## 6. Isolated PostgreSQL 18 evidence

- Container: `anvil-b10-r2-it-pg18-325`
- Network: `anvil-b10-r2-it-net-325`
- Runtime: `postgres:18-alpine`, PostgreSQL `18.4`, server number `180004`
- tmpfs: `/var/lib/postgresql`
- bind: loopback-only `127.0.0.1:32772`
- database: `anvil_b10_r2_it_325`
- shared DB / ysna / production / deployment: not accessed

Results:

1. `0008_queue_worker_leases -> corrected 0009_intervention_budget` passed.
2. DSN-focused B-10 passed `15/15`.
3. Cost, token, and concurrency unresolved admission each rejected the second request.
4. Unresolved/concurrent race admitted only two new requests and retained total exposure `3 / 90 / 900`.
5. `0009_intervention_budget -> 0008_queue_worker_leases` passed.
6. Final B-10 tables/functions were `0/0`; Alembic head was `0008_queue_worker_leases`.
7. Exact container/network removal returned both names; exact-name post-filters were blank.

The PostgreSQL migration supplies atomic admission but no PostgreSQL reconciliation function/adapter in this package. Therefore the distinct-final replacement was proven against the actual framework-neutral repository that owns R2 reconciliation. API, Provider, and later adapter behavior were not inferred from it.

## 7. Verification IDs and runtime boundary

The R1 intervention/cancel contracts remained green through current and fresh regression:

- `AV-SAFE-003`, `AV-SAFE-025`
- `AV-STAT-030`, `AV-STAT-031`, `AV-STAT-032`, `AV-STAT-033`, `AV-STAT-037`
- `AV-AGT-006`

These PASS results do not override the package-level CRITICAL budget reconciliation blocker.

- Executed: framework-neutral local service logic; clean current/fresh regression; unique isolated PostgreSQL 18.
- `NOT_EXECUTED`: actual API, UI, browser/Network, real Provider/invoice, B-11 BFF/SSE, B-12 process/PC recovery, shared DB, ysna, production, deployment.
- Acceptance, commit, push, B-11 start: `NOT_EXECUTED`.
- Product, authority, progress/HANDOFF, checker writes: `0`.
- Written file: `docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md` only.

Final result: `FAILURE_REPORT / REWORK_REQUIRED`, blocking finding count `1`.
