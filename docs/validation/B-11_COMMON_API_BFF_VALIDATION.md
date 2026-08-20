# B-11 Canonical API, BFF, SSE, and Web Security Validation

- Package: `B-11`
- WorkInstruction: `WI-B-11-20260821-001`
- WorkInstruction SHA-256: `B015056A38BD70A995D6F886231BC1733988D6D0ECCD6C2B71E4EA0B04B4B45F`
- Invocation SHA-256: `1FCD913209A2B06EA0E88B752A760DC933F84656F3FCE03768C570FAA64C6A07`
- Start: `main=origin/main=3304c7d82fd7101f6913cbee7b98bcd05ac75ede`, clean
- Execution/write fencing: `b11-execution-fence-epoch-1-1134619` / `b11-write-fence-epoch-1-1134619`
- Result: `COMPLETED_PENDING_INDEPENDENT_TEST`

## Scope and implementation

The framework-neutral registry is the single source for 83 FastAPI v1 routes. It preserves the canonical colon-command and child-resource forms, exposes only `POST /api/tasks/{taskId}/runs` for Run creation, and returns a stable 501 error for an unbound future application port instead of a placeholder success.

FastAPI handlers authenticate and authorize every request before invoking a supplied query, command, or event-stream port. Mutation handlers validate Host, Origin, CSRF, idempotency key, expected version, canonical target hash, permission scope, and reason before any application-port side effect. Optimistic state conflicts map to the stable HTTP 409 envelope. Unexpected application-port errors are masked and correlated by request ID. Opaque list cursors are HMAC authenticated and bound to one resource.

The server-only BFF client accepts browser-facing same-origin `/api/...` paths, retains its internal absolute base only in server state, removes forwarded host/proto input, and does not put the internal base in response objects. The SSE port replays stored events strictly after `Last-Event-ID`; `?after=`, missing IDs, and cross-Run IDs fail closed. Common Web policy uses explicit Host/Origin allowlists, trusted-proxy-only forwarded host handling, credentialed CORS default deny, secure session-cookie construction, CSP without inline/eval, HSTS, `frame-ancestors 'none'`, and `object-src 'none'`.

No domain decision or repository access was added to the transport layer. Existing B-03 exports remain available. B-12 recovery, product menu UI, Provider/Secret/Egress capability, database migration, deployment, and provider calls were not implemented.

## TDD evidence

Dependencies and lock configuration were established first so tests could collect. The four exact test modules were then added before B-11 production modules.

1. Initial RED:
   - Command: `$env:UV_CACHE_DIR='C:\tmp\anvil-b11-uv-cache'; uv run python -m pytest -q tests/api`
   - Exit: `1`
   - Result: `15 failed`; all failures named missing B-11 API/BFF modules, not collection or environment errors.
2. First GREEN:
   - Same focused command.
   - Exit: `0`
   - Result: `15 passed`.
3. Contract-hardening RED:
   - Added assertions that all OpenAPI path placeholders are declared and that unexpected port exceptions do not expose raw paths/errors.
   - Exit: `1`
   - Result: `2 failed` for absent dynamic path declarations and an unmasked exception response.
4. Cookie-lifetime hardening RED:
   - Added the explicit short-lived session maximum assertion.
   - Exit: `1`.
   - Result: `1 failed`; an 86,400-second cookie was accepted before the 3,600-second maximum was enforced.
5. Final focused GREEN:
   - Command: `$env:UV_CACHE_DIR='C:\tmp\anvil-b11-uv-cache'; uv run python -m pytest -q tests/api --import-mode=importlib`
   - Exit: `0`
   - Result: `16 passed in 0.58s`.

The focused tests bind registry/OpenAPI equality and alias absence, future capability fail-closed, BFF same-origin separation, request-ID behavior, opaque cursor tamper/resource rejection, 409 mapping, internal-error masking, three identical SSE reconnects, cursor gap/cross-Run rejection, pre-side-effect CSRF/Origin/Host rejection, short-lived cookie/CSP/CORS/proxy policy, and per-request approval/artifact/SSE permission checks.

## Regression and tooling

- Canonical core:
  - Command: `$env:UV_CACHE_DIR='C:\tmp\anvil-b11-uv-cache'; uv run python -m pytest -q tests --ignore=tests/tooling --ignore=tests/browser --ignore=tests/api --ignore=tests/fixtures --import-mode=importlib`
  - Exit: `0`
  - Result: `117 passed, 6 skipped in 9.18s`; the six existing skips are DSN-gated tests.
- Compile/import/diff:
  - `uv run python -m compileall -q packages/api packages/bff tests/api`: exit `0`.
  - Registry/OpenAPI count import check: `83 / 83`.
  - `git diff --check`: exit `0`.
- Full tooling:
  - Command: `$env:UV_CACHE_DIR='C:\tmp\anvil-b11-uv-cache'; uv run python -m pytest -q tests/tooling --import-mode=importlib`
  - Exit: `1`.
  - Result: `12 failed, 391 passed in 104.85s`.
  - Classification: expected active-worktree projection failures, not focused/core product regression. Six A-13 tests report the previous frozen EvidenceManifest raw/diff mismatch; three G-06 tests report fixture source inventory mismatch after authorized `tests/api` additions; three project-progress tests report `GIT_DESCENDANT_WORKTREE_DIRTY`. Developer is forbidden to update checkers, frozen predecessor manifests, fixture index, progress, or HANDOFF.
- Standalone checkers:
  - `uv run python scripts/check_a13_repository_scan.py .`: exit `1`, four expected frozen evidence raw/diff mismatch codes.
  - `uv run python scripts/check_g07_baseline.py .`: exit `0`, `PASS packages=108 av=255 uncovered=0 scenarios=20`.
  - `uv run python scripts/check_phase_g_gate.py .`: exit `0`, `PASS accepted=7 decisions=10 packages=108 av=255 scenarios=20 sync=7`.
  - `uv run python scripts/check_project_progress.py .`: exit `1`, expected `GIT_DESCENDANT_WORKTREE_DIRTY` during authorized exact17 implementation.

An earlier overbroad `pytest tests` invocation produced six collection-name/fixture errors because it included mutually exclusive tooling, browser, API, and fixture test surfaces. It was an invalid regression command, not a product result; the repository's canonical separated core/tooling commands above were then used.

## Actual production-like local HTTP and SSE

A local uvicorn process served the real FastAPI app on loopback `127.0.0.1:8765`, with an explicit loopback Host/Origin policy, a real session principal, an application port for deployment acceptance, and an in-memory stored-event port. No mock HTTP response or TestClient was used for these checks.

- Authenticated `GET /api/providers`: HTTP `501 CAPABILITY_NOT_AVAILABLE`, with correlated request ID plus CSP, HSTS, no-sniff, referrer, and cache headers. This proves future-port fail-closed at the actual HTTP boundary.
- `POST /api/deployments`, otherwise-valid envelope:
  - missing CSRF: HTTP `403 CSRF_VALIDATION_FAILED`, application-port calls `0`;
  - missing Origin: HTTP `403 ORIGIN_VALIDATION_FAILED`, application-port calls `0`;
  - valid Host/Origin/CSRF/idempotency/version/target/scope/reason: HTTP `200`, accepted response.
- `GET /api/runs/runtime-run/events` with `Last-Event-ID: runtime-evt-1`, repeated three times:
  - all responses HTTP `200`;
  - each body contains exactly `runtime-evt-2`, then `runtime-evt-3`;
  - all three body SHA-256 values are `54F32C7CBC18655D53EB795CE7EC7827476979F2729C14409ECA919F27A25495` (identical observed payloads);
  - no cursor event replay and no new Run creation.

The local runtime used only process memory and loopback HTTP; no database was required by this package. It did not contact WSL-server, ysna-server, a shared database, a provider, or deployment infrastructure.

## Browser boundary and limitations

Actual browser Network verification was attempted in both the in-app browser and connected Chrome against `http://127.0.0.1:8765/api/providers`. Both browser surfaces rejected navigation before the request with `net::ERR_BLOCKED_BY_CLIENT`. Therefore `AV-UI-011/012` have focused contract and actual HTTP evidence, but actual browser Network is `ENVIRONMENT_BLOCKED` and is not claimed PASS.

The following remain unexecuted or pending:

- independent B-11 Tester acceptance: `PENDING`;
- actual browser Network capture: `ENVIRONMENT_BLOCKED` by the browser client;
- actual product menu UI and browser bundle inspection: `NOT_IN_SCOPE` because `apps/web` is outside exact17;
- actual PostgreSQL/WSL/shared DB/provider/ysna/production/deployment: `NOT_EXECUTED` and out of scope;
- B-12 recovery and C+ capabilities: `NOT_STARTED`.

The developer did not modify progress/HANDOFF, checkers, fixture indexes, Git index/refs, or predecessor evidence, and did not commit or push. Main Agent review, evidence projection, independent test, acceptance, commit, and push remain separate steps.
