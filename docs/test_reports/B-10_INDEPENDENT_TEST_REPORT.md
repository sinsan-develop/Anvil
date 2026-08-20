# B-10 Independent Retest Report — R3

- Package: `B-10`
- Retest revision: `R3`
- Tester: implementation conversation-separated independent Tester
- Tested baseline: `main = origin/main = d92a24ef3ecaa0d55a8c2d3ad0d43dea49748037`
- Tested projection: sequence `332`, `B-10 / TEST_REVIEW / PENDING_RETEST`
- Source R2 report SHA-256: `23865D1722B231F04C7087328874A41D19431E5EE28C90AC71A3FACDA9D4F854`
- Failure lineage: `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`
- Result contract: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Write scope: this report only

## 1. Decision

### Decision

`READY_FOR_MAIN_ACCEPTANCE`

### Reason

R3 closes the remaining B-10 failure lineage. An unresolved `RECONCILIATION_REQUIRED` reservation remains full cost, token, and concurrency exposure. After an authoritative final receipt is accepted, the reservation-level finalization is immutable: only the exact canonical receipt replays successfully, while a distinct receipt ID or changed identity, payload hash, actual usage, release amounts, abort status, retry count, rate-limit bucket, or provider provenance is rejected. Sequential and concurrent hostile attempts produced exactly one finalization and never released exposure twice. A new `49/490` reservation remained rejected under the tested hard `50/500` limit.

The same behavior was independently confirmed in the framework-neutral repository and in unique loopback-only PostgreSQL 18. Current and fresh-clone regression suites and both frozen raw-six manifest calculations passed. No blocker remains in the executed B-10 scope.

### Action

Main Agent may perform the separate B-10 acceptance decision using this report. This Tester did not accept B-10, start B-11, commit, push, or deploy.

## 2. Authority, projection, and manifests

| Item | Result |
|---|---|
| HEAD / origin/main | `d92a24ef3ecaa0d55a8c2d3ad0d43dea49748037` / equal |
| initial status | clean |
| progress | sequence `332`, `TEST_REVIEW / PENDING_RETEST` |
| R3 WorkInstruction SHA-256 | `193734C3AD871D8042C0440342763A289DDCA70E1F862A143B357A1B8AABCF2D` |
| R3 Invocation SHA-256 | `27D14DCAAF638FF6D0637A266BCCB64DB93D0D633925703F8C47ECC5F8E3A642` |
| R3 product manifest SHA-256 | `5F0922A70F63E19D51306CCF43B67902BF9B82354E1F229616404DB5C2DB02A8` |
| product projection | raw artifacts `6`, checksum errors `0`, canonical bytes `707` |
| product target | `5DEF1A06A2DC87BB074BA18F1BC346B098400B61741208BF1CF419B94BD21CD4`, match |
| R3 completion projection | raw artifacts `6`, checksum errors `0`, canonical bytes `771` |
| completion target | `0A438F6532179D1148F629579DADE07BC68A096ABDFFD7E01AAB2C7AD967303A`, match |

Both target calculations were repeated independently in the current checkout and the clean fresh clone. The calculations used raw artifact bytes and reported no missing file or checksum mismatch.

## 3. Current and fresh-clone regression

The independent fresh clone used the exact path `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\b10-r3-final-it-clone-20260821-332`, matched the tested commit, was initially clean, and was removed after its resolved absolute path and leaf name were checked.

| Verification | Current | Fresh clone |
|---|---:|---:|
| focused B-10/intervention budget | `15 passed, 4 skipped` | `15 passed, 4 skipped` |
| canonical core, `--import-mode=importlib` | `117 passed, 6 skipped` | `117 passed, 6 skipped` |
| full `tests/tooling` | `395 passed` | `395 passed` |
| standalone checkers | `4/4 PASS` | `4/4 PASS` |
| product raw-six target | match | match |
| completion raw-six target | match | match |

Standalone outputs were:

- A-13 repository scan: `fixtures=8 zero_delta=8 hostile=15`
- G-07 baseline: `packages=108 av=255 uncovered=0 scenarios=20`
- Phase G Gate: `accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`
- project progress: `sequence=332 reporting=AUTO_CONTINUE`

The skipped tests were explicit environment-gated cases outside the active command's configured backend. PostgreSQL-specific focused execution was run separately against the isolated PostgreSQL 18 DSN.

## 4. Failure-lineage closure

### Unresolved exposure and hard admission

Independent in-memory execution created a hard `50/500`, concurrency `1` budget and an unresolved reservation forecast at `40/400`. The snapshot retained `reserved_cost=40`, `reserved_tokens=400`, and `active_reservations=1`; a competing request was rejected without reducing that exposure.

The authoritative final receipt recorded actual `12/120` and release `28/280`. Its exact replay returned the same canonical result. The final reservation remained `CONSUMED` at `12/120`, and a new `49/490` reservation was rejected.

### Immutable reservation-level finalization

After the authoritative finalization, each of these mutations was independently rejected:

- different `usage_receipt_id` with otherwise equal content
- changed actual cost or token usage, both lower and higher variants
- changed release cost or release tokens
- changed request or reservation identity
- changed payload hash, abort status, retry count, rate-limit bucket, or provider provenance

Sixteen concurrent distinct final receipt attempts for one reservation produced exactly one winner. The winning canonical receipt replayed successfully; the other distinct receipts were rejected. Repository inspection after the race showed one usage receipt, one reservation finalization, and an immutable consumed state. No double finalization or double release occurred.

The R3 implementation stores the reservation-level canonical final binding and result under the same repository lock as reconciliation. Therefore serialization now enforces the final invariant instead of merely serializing mutable replacement.

## 5. Isolated PostgreSQL 18 evidence

- Container: `anvil-b10-r3-it-pg18-332`
- Network: `anvil-b10-r3-it-net-332`
- Runtime: `postgres:18-alpine`, PostgreSQL `18.4`, server number `180004`
- tmpfs: `/var/lib/postgresql`
- bind: loopback-only `127.0.0.1:32774`
- database/user: `anvil_b10_r3_it_332` / `anvil_b10_r3_it`
- shared DB / ysna / production / deployment: not accessed

Results:

1. `0008_queue_worker_leases -> R3 0009_intervention_budget` passed; Alembic head was `0009_intervention_budget`.
2. DSN-focused execution passed `19/19`.
3. An unresolved `40/400` reservation retained full exposure and rejected a competing `50/500` request.
4. Sixteen simultaneous distinct final receipts produced exactly one winner.
5. Exact winner replay returned the same canonical row.
6. Changed receipt ID, identity, payload hash, actual usage, release amounts, abort status, retry count, rate-limit bucket, and provenance all returned no result and left the final row unchanged.
7. A direct second authoritative-final insert was rejected by the partial unique reservation constraint.
8. Final state was `CONSUMED 12/120`, release `28/280`, authoritative-final row count `1`; a new `49/490` reservation was rejected.
9. `R3 0009_intervention_budget -> 0008_queue_worker_leases` passed. B-10 tables/functions were `0/0`, and Alembic head returned to `0008_queue_worker_leases`.
10. The exact container and network names were removed; exact-name post-cleanup filters were blank.

The migration's reconciliation function locks the reservation row and combines canonical replay validation, final receipt insertion, and reservation consumption in one transaction. The partial unique index independently prevents a second authoritative final row for the same reservation.

## 6. Isolation and cleanup

- The pre-existing Main-owned path `.fresh-b10-r3-completion-d92a24e/.pytest_cache` was not written or deleted by this Tester.
- This Tester used a different unique clone path. Before cleanup, its resolved absolute path was verified to remain under the intended `.worktrees` directory and its leaf name was checked exactly. Post-cleanup existence was `False`.
- The unique PostgreSQL container and network were loopback/tmpfs-only and were removed by exact name.
- No shared database, WSL-server application database, ysna-server, production resource, or deployment path was accessed.
- No product source, authority, WorkInstruction, progress/HANDOFF, or manifest was written.

## 7. Verification IDs and runtime boundary

The assigned intervention/cancel contracts remained green through current, fresh-clone, and focused regression:

- `AV-SAFE-003`, `AV-SAFE-025`
- `AV-STAT-030`, `AV-STAT-031`, `AV-STAT-032`, `AV-STAT-033`, `AV-STAT-037`
- `AV-AGT-006`

Executed evidence proves framework-neutral B-10 service/repository behavior, frozen manifest integrity, clean current/fresh regression, and isolated PostgreSQL 18 behavior only.

- `NOT_EXECUTED`: actual API, UI, browser/Network, real Provider/invoice, B-11 BFF/SSE, B-12 process/PC recovery, shared DB, ysna, production, deployment.
- Acceptance, commit, push, B-11 start: `NOT_EXECUTED`.
- Written file: `docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md` only.

Final result: `READY_FOR_MAIN_ACCEPTANCE`, blocking finding count `0`.
