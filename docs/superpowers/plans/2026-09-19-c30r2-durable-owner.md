# C30R2 Durable Owner Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the C22–C24 Team/MoA authority state to the C29 console through durable PostgreSQL-backed owner snapshots, trusted session mapping, and restart-safe entity/API verification.

**Architecture:** Keep `create_agent_console_app(service, resolve_authority, clock)` fail-closed by default. Add a persistence adapter that stores canonical owner snapshots, assignment generation/revocation, target/session/fence bindings, and projection receipts; construct the adapter only from server-owned runtime dependencies. Browser and HTTP callers never mint authority from headers or request bodies.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy/psycopg, Alembic, PostgreSQL 15, pytest, existing Team/MoA contracts.

**Spec:** `Anvil_작업계획서_v1.md` §19.7.2 C-30; `docs/work_orders/C-30_WORK_INSTRUCTION.md`; `docs/evidence/manifests/C-30_EVIDENCE_MANIFEST.json`.

## Global Constraints

- Canonical release migration target is `0013_task_bootstrap_authority`; do not use `alembic upgrade head` for C30 release evidence.
- Console defaults remain `503 OFFLINE` when server-owned service or authority resolution is unavailable.
- Request headers and bodies never create `ConsoleAuthority`.
- Existing Task/Run/Event repositories are not cast into RoleAssignment/Team/MoA authority rows.
- Provider, Telegram, Kakao, Oracle, and production calls remain unexecuted.
- Existing dirty/untracked files and unrelated containers/databases remain untouched.

## Review Focus

- Revoked or superseded assignment generation must fail closed after restart — test restore plus stale generation.
- A valid actor with a different session/context/target/fence must receive `403` without projection leakage — test each binding independently.
- Duplicate receipt/request IDs must be idempotent without aliasing canonical rows — test replay and mutation isolation.
- Concurrent readers/writers must not observe a mixed snapshot — test transaction boundary and optimistic version.
- Missing runtime owner/provider references must keep readiness and console responses explicit — test `503` reason and `counts_as_pass=false`.

### Task 1: Freeze the durable owner contract

**Files:**
- Create: `docs/work_orders/C-30R2_WORK_INSTRUCTION.md`
- Create: `docs/work_orders/C-30R2_INVOCATION_PROMPT.md`
- Test: `tests/integration/test_c30r2_contract.py`

**Interfaces:**
- Consumes: `ConsoleAuthority`, `ConsoleProjectionService`, `RolePolicyService`, `RoleResultService`.
- Produces: exact row fields and repository method signatures used by Tasks 2–4.

- [ ] Step 1: Write failing contract tests for snapshot, generation, revocation, fence, restart, and principal mapping.
- [ ] Step 2: Run `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q tests/integration/test_c30r2_contract.py`; expect failures because no repository exists.
- [ ] Step 3: Define the exact repository interface in the WorkInstruction: `save_owner_snapshot`, `load_current_owner`, `revoke_generation`, `save_receipt`, `load_receipt`, each accepting a SQLAlchemy session and immutable binding fields.
- [ ] Step 4: Re-run the contract test to validate only the contract fixture and hashes; no product mutation is allowed in this task.
- [ ] Step 5: Commit the WorkInstruction and contract fixture.

### Task 2: Implement PostgreSQL owner persistence

**Files:**
- Create: `packages/persistence/agent_team_owner_repository.py`
- Modify: `migrations/versions/0015_agent_team_owner.py`
- Test: `tests/persistence/test_agent_team_owner_repository.py`

**Interfaces:**
- Consumes: Task 1 row schema and existing SQLAlchemy session factory.
- Produces: transaction-safe owner snapshot and receipt repository with generation/revocation checks.

- [ ] Step 1: Add failing PostgreSQL repository tests for insert, current-generation lookup, revocation, stale-fence rejection, duplicate receipt idempotency, and rollback.
- [ ] Step 2: Run the focused repository tests against disposable PostgreSQL 15; record the expected missing-table failure.
- [ ] Step 3: Add migration `0015_agent_team_owner` with unique keys for `(session_id, assignment_id, generation)`, immutable target/session/fence fields, revocation timestamp, and receipt uniqueness.
- [ ] Step 4: Implement parameterized SQLAlchemy queries with transaction boundaries and optimistic version checks; reject stale generation/fence before returning a projection.
- [ ] Step 5: Re-run focused tests and verify migration target `0013` remains the C30 release target unless a separate release migration decision is recorded.
- [ ] Step 6: Commit migration, repository, and tests.

### Task 3: Connect trusted runtime owner resolution

**Files:**
- Modify: `packages/api/runtime.py`
- Modify: `apps/api/anvil_api/asgi.py`
- Modify: `apps/api/anvil_api/routes/agent_console.py`
- Test: `tests/integration/test_c30r2_runtime_owner.py`

**Interfaces:**
- Consumes: Task 2 repository, existing `LocalTestSessionService`, `SessionPrincipal`, and canonical Team/MoA services.
- Produces: server-only `ConsoleProjectionService` and request-to-authority resolver; unauthenticated construction remains fail-closed.

- [ ] Step 1: Add failing tests proving default ASGI construction returns 503, authenticated server-owned resolution returns a projection, and request payload/header spoofing cannot alter authority.
- [ ] Step 2: Run the focused runtime-owner tests and capture the failures before wiring.
- [ ] Step 3: Construct console dependencies only from runtime-owned services and repository-loaded snapshots; never instantiate Team/MoA state from request data.
- [ ] Step 4: Resolve `ConsoleAuthority` from the authenticated principal plus the current persisted assignment/session/target/fence row; return `AUTHORITY_REQUIRED` or `AUTHORITY_DENIED` on mismatch.
- [ ] Step 5: Re-run route, runtime, and readiness tests; verify explicit `503` reasons and no fake `200` data.
- [ ] Step 6: Commit the runtime wiring and tests.

### Task 4: Execute formal entity and browser verification

**Files:**
- Modify: `tests/integration/test_c30_console_e2e.py`
- Modify: `tests/integration/test_c30_contract_matrix.py`
- Create: `tests/integration/test_c30r2_formal_entity.py`
- Modify: `docs/04_test_reports/C-30_COMPLETION_REPORT.md`
- Modify: `docs/progress/BUILD_HANDOFF.md`
- Modify: `docs/progress/build-progress.json`
- Modify: `docs/progress/progress-events.json`

**Interfaces:**
- Consumes: Tasks 1–3 and a disposable PG15 database migrated to the canonical C30 target.
- Produces: exact session/task/actor/target/fence, committed receipt, rollback, restart, same-origin browser Network, and independent-review evidence.

- [ ] Step 1: Run the focused entity suite against disposable PG15 and record the initial red result if any.
- [ ] Step 2: Run the authenticated HTTP matrix for all four menus and control refusal; record bounded response hashes without secrets.
- [ ] Step 3: Run browser verification for relative URLs, CSRF/high-risk refusal, empty/offline/error states, and target checksum.
- [ ] Step 4: Restart the web process and prove the owner snapshot, revocation, and receipt state are restored.
- [ ] Step 5: Run the required C30 regression, compile, diff-check, and independent review; record unexecuted Provider/Telegram/Kakao/Oracle scopes explicitly.
- [ ] Step 6: Commit the evidence and update the release/readiness decision without claiming completion if any formal check is unverified.

## Self-review

- C30 formal DB/container/entity/browser requirements are covered by Tasks 2–4.
- Process-local Role/Team/MoA state is not treated as durable until Task 2 persistence and Task 3 restore tests pass.
- No task silently changes the canonical C30 release migration target or calls external providers.
- Every task ends with a focused test and commit boundary; no placeholder implementation is permitted.
