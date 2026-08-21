# B-11 R2 Developer Completion Report

- Package: `B-11`
- Result: `COMPLETED`
- Status: `COMPLETED_PENDING_INDEPENDENT_RETEST`
- Failure fingerprint: `BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED`
- WorkInstruction: `WI-B-11-20260821-002`, SHA-256 `1B72ABC408EF8B4C8A3CAE657201F3D1C1A00D1000D1E417D61942F457941002`
- Invocation SHA-256: `DE63A51A7E1A1A7AAE0A0B865D0C3BF7483EA6860261F78A5DC4CD6C129CF094`
- Start: `main=origin/main=f1e3a6bc8c145ab1961fa2b9dcabdea68191074b`, clean; epoch-2 execution/write fencing and exact8 verified.

## Change

R2 adds a server-supplied authoritative authorization resolver to the FastAPI boundary. Every canonical endpoint now fails closed when the resolver is absent or cannot produce a complete project, environment, and endpoint-role target. A matching permission label is necessary but no longer sufficient: the authenticated principal's actor role, project membership, and environment membership must all match the resolved target before command/query dispatch or SSE journal read.

The resolver receives the canonical endpoint and route path parameters only. Caller-controlled body, query, or headers cannot grant scope. Existing Host/authentication/authorization/mutation-security ordering and all R1 registry/OpenAPI, HTTP error/request-ID/409, BFF, SSE, cookie/CORS/CSP/proxy contracts remain unchanged.

## TDD and verification

- RED 1: resolver absence reproduced Approval/artifact/SSE `200/200/200` with port/journal access instead of required `403` and zero access.
- RED 2: with a fixed authoritative resolver, wrong role, empty/cross project, and empty/cross environment each reproduced `200/200/200` across Approval/artifact/SSE.
- Hostile GREEN: resolver absence plus five independent hostile variants `6 passed`; each denied before application/journal access.
- Focused API: `22 passed`.
- Canonical core: `117 passed, 6 existing DSN-gated skipped`.
- Full tooling: `402 passed, 9 expected active-dirty governance projection failures`.
- Canonical combined full: `541 passed, 6 skipped, the same 9 expected active-dirty governance projection failures`.
- G-07 and Phase G standalone checkers: PASS; A-13 and project-progress retained the expected frozen-evidence/dirty-worktree failures.
- Actual uvicorn: all 15 hostile scope requests returned stable 403 and a status query proved command/query/journal `0/0/0`; Host/Origin/CSRF prechecks also retained `0/0/0`.
- Nominal uvicorn: Approval/artifact `200`, conflict `409`, and three byte-identical strict-successor SSE reconnects passed; final counters were `1/1/3`.
- Browser Network: `ENVIRONMENT_BLOCKED`; Chrome returned `ERR_BLOCKED_BY_CLIENT`, and the in-app browser binding was unavailable. This is not reported as PASS.

Detailed commands, observed codes, hashes, boundaries, and final regression results are in `docs/validation/B-11_COMMON_API_BFF_VALIDATION.md`.

## Files, impact, and handoff

Only R2 exact8 paths changed: `packages/api/fastapi_app.py`, four API test files, and the three B-11 validation/evidence/completion files. Scope authorization is enforced at the transport boundary; existing domain/application/persistence logic remains behind framework-neutral ports. No public endpoint, permission label, wire format, dependency, migration, database, or infrastructure contract changed.

Rollback before Main integration is restoration of these exact8 paths to start commit `f1e3a6bc8c145ab1961fa2b9dcabdea68191074b`. After integration, rollback is a normal revert of the eventual R2 commit. No database or external-state rollback is required.

Independent R2 retest and Main acceptance remain pending. progress/HANDOFF, checkers, failure ledger, Tester report, authority, Git index/refs, commit, push, B-12, WSL/shared DB, Provider, ysna, production, and deployment were not modified or started.
