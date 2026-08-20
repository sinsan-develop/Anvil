# B-11 Independent Test Report

- Package: `B-11`
- Tester result: `FAILURE_REPORT`
- Verdict: `REWORK_REQUIRED`
- Step lineage: `B-11`
- Failure fingerprint: `BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED`
- Severity: `CRITICAL`
- Tested commit: `main=origin/main=ce8179527a64128899df21542b24f1b7f85e35b1`, clean
- Progress state: `sequence=339`, `TEST_REVIEW`, no worker/write lease; B-12 remains `BLOCKED_PENDING_B11_ACCEPTANCE`

## Authority and frozen evidence

The current design, plan, matrix, test plan, operating rules, WorkInstruction, and Invocation hashes match the B-11 binding. WorkInstruction SHA-256 is `B015056A38BD70A995D6F886231BC1733988D6D0ECCD6C2B71E4EA0B04B4B45F`; Invocation SHA-256 is `1FCD913209A2B06EA0E88B752A760DC933F84656F3FCE03768C570FAA64C6A07`.

The Developer manifest SHA-256 is `BE11EA4C21FC34484CDF5B4CC924CAC03E9E64940A69EE014D9CE18D5D6A0C29`. All raw 16 artifact byte counts and SHA-256 values were independently recalculated with zero mismatch; its canonical projection is 1,567 bytes and target is `FCA6FB92BD092C68BA9F0C500B107E95198FE2B693C6F7F14E7C09680D2E29F5`.

The completion projection manifest SHA-256 is `4208EAD1D9153424DBEF6AAA018A7E3C88DDCA36DE7A131FE504EB6AC81C66CD`. All 12 raw checksum rows were independently recalculated with zero mismatch; its canonical projection is 1,335 bytes and target is `D8D912463EA9F859F313A8F54FA233751B31EC99C5E2F5D5B77D39BB2A924776`. Both manifests keep `self_reference=false`.

## Blocking finding

### BLK-B11-001 — project, environment, and role authorization is not enforced

**Contract.** The WorkInstruction requires Approval, artifact, SSE, and other endpoints to enforce project, environment, and role authorization on every request at the server boundary. Same-origin and authentication are explicitly not substitutes for authorization.

**Cause.** `packages/api/fastapi_app.py::_authorize` checks only whether `endpoint.permission` is present in `principal.permissions`. `SessionPrincipal.actor_role`, `project_ids`, and `environment_ids` are not inspected by this authorization path. Approval, artifact, and SSE handlers dispatch after that permission-only check.

**Independent hostile evidence.** Three principals were tested separately while retaining only the endpoint permission string:

| Variant | Approval POST | Artifact GET | SSE GET | Observed dispatch |
|---|---:|---:|---:|---|
| wrong role (`viewer`) with nominal project/environment | 200 | 200 | 200 | approval and artifact ports called; SSE journal read |
| empty project scope | 200 | 200 | 200 | approval and artifact ports called; SSE journal read |
| empty environment scope | 200 | 200 | 200 | approval and artifact ports called; SSE journal read |

The hostile assertion required `403/403/403` for each variant and exited `1`. Actual output was `SCOPE_VARIANTS [('wrong_role', 200, 200, 200, 2, 1), ('no_project', 200, 200, 200, 4, 1), ('no_environment', 200, 200, 200, 6, 1)]`; approval/artifact port side effects totalled six, and SSE read once per variant. A combined viewer plus empty-project plus empty-environment case independently produced `200/200/200`, two application-port calls, and one SSE read.

**Impact.** A principal with a matching permission label can cross the required role/project/environment boundary and reach sensitive approval, evidence, and event-stream operations. This violates the B-11 WorkInstruction security contract and blocks package acceptance. The narrower `AV-SAFE-029` Host/Origin/CSRF behavior itself passed and is not overstated as failed.

**Required rework.** Add a framework-neutral, explicit authorization decision that binds each request to the target project, environment, and allowed actor role before command/query/event-stream dispatch. Where a path ID cannot itself establish scope, resolve scope through a supplied authorization port; do not trust client-supplied scope as authority. Add independent tests for wrong role, cross/missing project, cross/missing environment, and approval/artifact/SSE pre-dispatch side-effect count zero. Main Agent must decide the exact WorkInstruction revision and rework allowlist; no product change was made by this Tester.

## Passing independent evidence

Current canonical worktree:

- focused API: `16 passed in 0.65s`
- canonical core: `117 passed, 6 existing DSN-gated skipped in 3.06s`
- tooling: `407 passed in 133.63s`
- canonical combined full excluding intentional browser/fixture repositories: `540 passed, 6 skipped in 140.88s`
- standalone A-13, G-07, Phase G, and project-progress checkers: all exit `0`; project progress reports sequence 339
- registry/OpenAPI equality: `83/83`; `git diff --check`: exit `0`

Fresh remote default clone at the same `ce817952` commit:

- focused API: `16 passed in 0.72s`
- canonical core: `117 passed, 6 skipped in 5.93s`
- tooling: `407 passed in 118.05s`
- canonical combined full: `540 passed, 6 skipped in 122.00s`
- the same four standalone checkers and `git diff --check`: exit `0`

The first fresh-clone focused attempt was interrupted while uv installed the new environment by a Windows PE-resource access error. It was an environment setup failure, not a test result; after dependency materialization the complete focused command was rerun and passed as recorded above.

Actual production-like loopback uvicorn evidence:

- authenticated unbound `GET /api/providers`: HTTP `501 CAPABILITY_NOT_AVAILABLE`, correlated request ID, CSP/HSTS/no-sniff present
- invalid CSRF, missing Origin, and hostile Host deployment mutations: each HTTP `403`; application command calls remained zero before the subsequent valid request
- valid deployment mutation: HTTP `200`, exactly one command call
- optimistic conflict: HTTP `409 OPTIMISTIC_VERSION_CONFLICT`, stable correlated request ID
- 64 concurrent unbound requests: all 64 returned the same stable `501/CAPABILITY_NOT_AVAILABLE` contract with 64 unique, body/header-matching request IDs
- SSE FI-08: three `Last-Event-ID: evt-1` reconnects returned byte-identical strict successors `evt-2, evt-3`; body SHA-256 was `6EF1925F4EFD660383B4D5F46E80BF105DFA7C1F9A6AD429B539B72863852696` for all three; cursor replay 0, gap 0, read count 3, new Run count 0
- runtime server terminated cleanly

## Browser and unexecuted boundaries

The in-app browser and connected Chrome were both attempted against `http://127.0.0.1:8765/api/providers`. Both surfaces returned `net::ERR_BLOCKED_BY_CLIENT`; the loopback server observed corresponding HTTP 403 requests, but neither browser exposed a navigable page or usable Network capture. Browser Network verification remains `ENVIRONMENT_BLOCKED`, not PASS. Product menu UI/bundle inspection is outside B-11 exact17.

PostgreSQL, WSL/shared DB, provider, ysna, production, and deployment were not executed and are outside this package. No B-12 work was started.

## Files, cleanup, and rollback

The Tester changed only `docs/test_reports/B-11_INDEPENDENT_TEST_REPORT.md`. Product, governance, progress/HANDOFF, manifests, Git index/refs, and predecessor evidence were not modified. The loopback server was stopped; the dedicated fresh clone and B-11 temporary uv caches were removed after their resolved paths were verified. Existing B-10 ACL residue was untouched.

Rollback is deletion of this single report before Main integration, or a normal revert of the eventual report commit. No database or external-state rollback is required.
