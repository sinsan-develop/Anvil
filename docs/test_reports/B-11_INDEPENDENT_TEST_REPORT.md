# B-11 R2 Independent Retest Report

- Package: `B-11`
- Tester result: `COMPLETED`
- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking findings: `0`
- Retested finding: `BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED / CLOSED`
- Tested commit: `main=origin/main=28bcf4742fee0536b09c75ce352e6f2ae505cebe`, clean
- Progress state: `sequence=346`, `TEST_REVIEW / PENDING_RETEST`, no worker/write lease
- Next package: `B-12 / BLOCKED_PENDING_B11_ACCEPTANCE`

## Authority and frozen evidence

The current design, work plan, validation matrix, test plan, and operating-rules hashes match the approved B-11 binding. R2 WorkInstruction `WI-B-11-20260821-002` SHA-256 is `1B72ABC408EF8B4C8A3CAE657201F3D1C1A00D1000D1E417D61942F457941002`; Invocation SHA-256 is `DE63A51A7E1A1A7AAE0A0B865D0C3BF7483EA6860261F78A5DC4CD6C129CF094`. The R2 instruction correctly binds the prior Tester report SHA-256 `EFBE6313A9BFF589702149E7042FDA127DF99CA323FD864C8EC16EA72D07441C` and the same failure fingerprint.

Developer R2 EvidenceManifest SHA-256 is `3F60EAE9A978EA8ED0ABB83CEB77EB0B1828251895AB0B323C5CC4C8481B8C23`. All raw 7 byte counts and hashes were independently recalculated with zero mismatch; canonical projection length is 750 bytes and target is `25167A1D9C951C9A3E032862F72A4F1D8F5EBCF310585812EE7DC7095F4B3ABA`.

R2 completion projection manifest SHA-256 is `0629AA77CCAE6D7AAD4A14D34E25D758B9CF732951DAFBC8518895CC79BC5CD5`. All raw 13 checksum rows were independently recalculated with zero mismatch; canonical projection length is 1,471 bytes and target is `E773FABE8A5D27E9F4539EF8C09855DBA0349BBAE948630F9FE666FDE43D7E3E`. Both manifests retain `self_reference=false`.

## BLK-B11-001 closure

The R2 boundary uses a server-supplied `AuthorizationResolver` to produce an authoritative project, environment, and allowed-role scope from the canonical endpoint and path parameters. A matching permission label is necessary but no longer sufficient. Resolver absence or incomplete/mismatched role, project, or environment scope fails closed before request body parsing, application command/query dispatch, or SSE journal access.

Independent ASGI hostile retest:

| Principal variant | Approval POST | Artifact GET | SSE GET | Command/query/journal access |
|---|---:|---:|---:|---:|
| resolver absent, nominal permission labels | 403 | 403 | 403 | `0/0/0` |
| wrong role | 403 | 403 | 403 | `0/0/0` |
| missing project | 403 | 403 | 403 | `0/0/0` |
| cross project | 403 | 403 | 403 | `0/0/0` |
| missing environment | 403 | 403 | 403 | `0/0/0` |
| cross environment | 403 | 403 | 403 | `0/0/0` |

The stable codes were `AUTHORIZATION_SCOPE_UNRESOLVED`, `AUTHORIZATION_ROLE_DENIED`, `AUTHORIZATION_PROJECT_DENIED`, and `AUTHORIZATION_ENVIRONMENT_DENIED` as applicable. Hostile caller-controlled project/environment values were also placed in body, query, and headers; they did not grant authorization. The nominal owner with authoritative `project-1 / env-local / owner` scope produced Approval/artifact/SSE `200/200/200` with the expected command/query/journal counters `1/1/1`.

An independent real uvicorn run repeated all five role/project/environment variants across the same three sensitive endpoints. All 15 requests returned the expected stable HTTP 403 codes, and the observed command/query/journal counters remained `0/0/0`. Therefore `BLK-B11-001` is closed.

## Security ordering and API contracts

With a valid resolver and principal, hostile Host, missing Origin, and invalid CSRF Approval requests returned `HOST_VALIDATION_FAILED`, `ORIGIN_VALIDATION_FAILED`, and `CSRF_VALIDATION_FAILED`, all HTTP 403. Command/query/journal counters remained `0/0/0` before the nominal requests, proving pre-side-effect ordering was preserved.

The actual uvicorn nominal boundary then produced:

- valid Approval and artifact: HTTP `200`, command/query counters `1/1`;
- optimistic conflict: HTTP `409 OPTIMISTIC_VERSION_CONFLICT`, correlated `req-409`, internal conflict detail absent;
- unbound Provider capability: HTTP `501 CAPABILITY_NOT_AVAILABLE`, correlated `req-501`;
- 32 concurrent unbound requests: all stable 501 envelopes, 32 unique request IDs matching body and header;
- SSE FI-08: three `Last-Event-ID: evt-1` reconnects returned byte-identical strict successors `evt-2, evt-3`; cursor replay 0, gap 0, duplicate 0, new Run 0, journal reads 3;
- each SSE body SHA-256: `6EF1925F4EFD660383B4D5F46E80BF105DFA7C1F9A6AD429B539B72863852696`.

The canonical registry and OpenAPI remain equal at `83/83`. Existing same-origin server-only BFF, stable HMAC cursor, request/error envelope, cookie/CORS/CSP/trusted-proxy, and `Last-Event-ID` tests passed unchanged.

## Current and fresh-clone regression

Current canonical worktree:

- focused API: `22 passed in 0.88s`;
- canonical core: `117 passed, 6 existing DSN-gated skipped in 3.42s`;
- full tooling: `415 passed in 145.26s`;
- canonical combined full excluding intentional browser/fixture repositories: `554 passed, 6 skipped in 151.45s`;
- A-13, G-07, Phase G, and project-progress standalone checkers: all exit `0`, with progress sequence 346;
- compile/import, registry/OpenAPI 83/83, and `git diff --check`: exit `0`.

Fresh remote default clone at the same `28bcf474` commit:

- focused API: `22 passed in 1.90s`;
- canonical core: `117 passed, 6 skipped in 5.42s`;
- full tooling: `415 passed in 138.08s`;
- canonical combined full: `554 passed, 6 skipped in 130.44s`;
- the same four standalone checkers, compile/import, registry/OpenAPI 83/83, and `git diff --check`: exit `0`;
- fresh clone remained clean.

## Browser and execution boundary

Connected Chrome was retried against `http://127.0.0.1:8766/api/providers` and returned `net::ERR_BLOCKED_BY_CLIENT`; the server observed an HTTP 403 request but the browser did not expose a usable page or Network capture. The prior in-app browser binding was unavailable, and fresh automatic selection chose connected Chrome rather than an in-app surface. Browser Network remains `ENVIRONMENT_BLOCKED`, not PASS. This does not reopen the server/API evidence above.

PostgreSQL, WSL/shared DB, Provider, ysna, production, deployment, actual menu UI, and B-12 were not executed and remain outside B-11 R2 exact8. Acceptance, commit, push, and B-12 start remain Main Agent responsibilities.

## Files, cleanup, risk, and rollback

The Tester replaced only `docs/test_reports/B-11_INDEPENDENT_TEST_REPORT.md`. Product, governance, progress/HANDOFF, manifests, Git index/refs, predecessor evidence, and B-12 were not modified. Both uvicorn runs were stopped; port 8766 has no listener. The dedicated fresh clone and R2 temporary uv caches were removed after their resolved paths were verified. Existing B-10 ACL residue was untouched.

Residual risk is limited to the unavailable browser Network capture and later environment/deployment integration that this package does not claim. No acceptance-blocking finding remains in the executed B-11 R2 scope.

Rollback is restoration of the prior Tester report before Main integration, or a normal revert of the eventual report commit. No database or external-state rollback is required.
