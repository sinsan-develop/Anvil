# B-11 R2 Scope Authorization Validation

- Package: `B-11`
- Result: `COMPLETED_PENDING_INDEPENDENT_RETEST`
- Failure fingerprint: `BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED`
- WorkInstruction: `WI-B-11-20260821-002`
- WorkInstruction SHA-256: `1B72ABC408EF8B4C8A3CAE657201F3D1C1A00D1000D1E417D61942F457941002`
- Invocation SHA-256: `DE63A51A7E1A1A7AAE0A0B865D0C3BF7483EA6860261F78A5DC4CD6C129CF094`
- Source Tester report SHA-256: `EFBE6313A9BFF589702149E7042FDA127DF99CA323FD864C8EC16EA72D07441C`
- Start: `main=origin/main=f1e3a6bc8c145ab1961fa2b9dcabdea68191074b`, clean
- Product baseline: `ce8179527a64128899df21542b24f1b7f85e35b1`
- Execution/write fencing: `b11-execution-fence-epoch-2-ce81795` / `b11-write-fence-epoch-2-ce81795`

## Defect reproduction and TDD

The independent finding was verified against the actual R1 code before modifying production behavior. A principal retaining the nominal Approval, artifact, and SSE permission labels but having a viewer role and empty project/environment sets reached all three sensitive boundaries.

### RED 1 — resolver absence

- Command: `$env:UV_CACHE_DIR='C:\tmp\anvil-b11-r2-uv-cache'; uv run python -m pytest -q tests/api/test_web_security.py -k authoritative_scope_resolver`
- Exit: `1`
- Actual: Approval `200`, artifact `200`, SSE `200`; both application ports were called and the journal read count was `1`.
- Expected: `403/403/403`, command/query calls `0`, journal reads `0`.

The minimal first change added an explicit server-supplied authorization resolver contract and made its absence or an unresolved/incomplete scope fail closed with stable HTTP 403 before application dispatch.

### RED 2 — role/project/environment membership

An authoritative resolver then returned `project-1`, `env-local`, and allowed role `owner`. Five hostile principals kept all nominal permission strings:

- wrong role `viewer` with matching project/environment;
- empty project scope;
- cross-project scope `project-2`;
- empty environment scope;
- cross-environment scope `env-other`.

- Command: `$env:UV_CACHE_DIR='C:\tmp\anvil-b11-r2-uv-cache'; uv run python -m pytest -q tests/api/test_web_security.py -k authoritative_scope_rejects_each`
- Exit: `1`
- Actual: all five variants produced Approval/artifact/SSE `200/200/200` before membership enforcement.
- Expected: each request `403`, application calls `0`, journal reads `0`.

The API boundary now checks, in order, the endpoint permission label, resolved scope completeness, endpoint-specific allowed roles, authoritative project membership, and authoritative environment membership. Stable denial codes are `AUTHORIZATION_SCOPE_UNRESOLVED`, `AUTHORIZATION_ROLE_DENIED`, `AUTHORIZATION_PROJECT_DENIED`, and `AUTHORIZATION_ENVIRONMENT_DENIED`. The resolver receives only the canonical endpoint specification and route path parameters; body, query, and headers cannot grant scope.

### GREEN

- Resolver absence plus all five independent hostile variants: `6 passed, 7 deselected`.
- Final focused API: `22 passed in 1.17s`.
- Canonical core: `117 passed, 6 existing DSN-gated skipped in 3.91s`.

The existing Host → authentication → authorization → mutation Origin/CSRF/idempotency/version/target-hash/permission-scope/reason order remains unchanged. Authorization completes before body parsing, command/query port calls, and SSE journal reads. R1 registry/OpenAPI, request ID, 409, BFF, SSE wire format, cookie, CORS, CSP, and proxy contracts were not changed.

## Actual production-like uvicorn evidence

A real local uvicorn process served the R2 app on `127.0.0.1:8766`. Its server-supplied resolver returned the fixed authoritative target `project-1 / env-local / owner`. Five distinct session principals represented wrong role, empty/cross project, and empty/cross environment. No TestClient or fabricated HTTP response was used.

For every hostile principal, each of the following was called separately:

- `POST /api/design-specifications/design-1:approve`;
- `GET /api/evidence-manifests/evidence-1`;
- `GET /api/runs/runtime-run/events`.

All 15 requests returned HTTP `403`. Wrong-role responses used `AUTHORIZATION_ROLE_DENIED`; empty/cross project used `AUTHORIZATION_PROJECT_DENIED`; empty/cross environment used `AUTHORIZATION_ENVIRONMENT_DENIED`. A subsequent authenticated status query observed `command=0`, `query=0`, `journal_reads=0`.

Hostile Host, missing Origin, and missing CSRF Approval requests each returned the original stable `403` code (`HOST_VALIDATION_FAILED`, `ORIGIN_VALIDATION_FAILED`, `CSRF_VALIDATION_FAILED`). The same subsequent status observation remained `0/0/0`, proving the pre-dispatch ordering was preserved.

Nominal evidence:

- valid Approval: HTTP `200`, correlated request ID `req-r2-approval`;
- valid artifact query: HTTP `200`;
- optimistic conflict: HTTP `409 OPTIMISTIC_VERSION_CONFLICT`, correlated request ID `req-r2-conflict`, raw conflict detail absent;
- FI-08 SSE: three HTTP `200` reconnects with `Last-Event-ID: runtime-evt-1`; each body contained exactly `runtime-evt-2`, then `runtime-evt-3`;
- all three SSE bodies had SHA-256 `54F32C7CBC18655D53EB795CE7EC7827476979F2729C14409ECA919F27A25495`;
- final counters: `command=1`, `query=1`, `journal_reads=3`; no cursor replay, gap, duplicate, or new Run.

The runtime process was stopped and port 8766 was verified no longer listening.

## Browser and execution boundary

Connected Chrome was retried against `http://127.0.0.1:8766/api/providers` and returned `net::ERR_BLOCKED_BY_CLIENT` before a usable Network capture. The existing in-app browser binding was unavailable. Browser Network remains `ENVIRONMENT_BLOCKED`, not PASS.

PostgreSQL, WSL/shared DB, Provider, ysna, production, deployment, actual menu UI, and B-12 were not executed and remain outside R2 exact8. No progress/HANDOFF, checker, failure ledger, Tester report, authority, Git index/ref, commit, or push was modified.

## Regression, tooling, and artifact integrity

- Focused API: `22 passed`.
- Canonical core: `117 passed, 6 existing DSN-gated skipped`.
- Full tooling: `402 passed, 9 failed in 109.91s`.
- Canonical combined full excluding intentional browser/fixture repositories: `541 passed, 6 skipped, 9 failed in 118.77s`.

The nine failures are active-dirty governance projections, not focused/core product failures. Six A-13 tests reject the authorized replacement of the frozen R1 EvidenceManifest with the R2 exact8/raw7 artifact using `EVIDENCE_ACTUAL_DIFF_MISMATCH`, `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, and `EVIDENCE_RAW_HASH_MISMATCH`. Three project-progress tests reject the authorized active exact8 worktree with `GIT_DESCENDANT_WORKTREE_DIRTY`. Developer cannot change predecessor completion projection, progress/HANDOFF, or checker logic.

Standalone checkers:

- `uv run python scripts/check_a13_repository_scan.py .`: exit `1`, the same four frozen R1 evidence mismatch codes;
- `uv run python scripts/check_g07_baseline.py .`: exit `0`, `PASS packages=108 av=255 uncovered=0 scenarios=20`;
- `uv run python scripts/check_phase_g_gate.py .`: exit `0`, `PASS accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`;
- `uv run python scripts/check_project_progress.py .`: exit `1`, expected active `GIT_DESCENDANT_WORKTREE_DIRTY`.

Final compile/import/diff, exact8 path comparison, and raw7 manifest recomputation are performed after this report is frozen. The manifest excludes itself with `self_reference=false`; any unavailable or failing governance projection is retained as observed rather than promoted to PASS.
