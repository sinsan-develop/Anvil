# C30R3 Owner Component Export/Restore Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define and implement a restart-safe, typed export/restore seam that reconnects persisted C30R2 owner snapshots to the real C22–C24 Role/Team/MoA components without fabricating authority.

**Architecture:** C30R3 adds a server-owned component adapter above the C30R2 repository. It accepts only exact typed snapshots, validates component hashes and assignment identity, restores real `RolePolicyService`, `RoleResultService`, `RoleTeamOrchestrator`, and `MoADeliberation` instances through one atomic factory, and returns a detached `OwnerComponentBundle`. Request headers, query strings, and arbitrary JSON never enter the restore path.

**Tech Stack:** Python 3.12, frozen dataclasses, SQLAlchemy 2, PostgreSQL 15, pytest, existing C22–C24 services.

**Spec:** `docs/work_orders/C-30R2_WORK_INSTRUCTION.md`, `docs/superpowers/plans/2026-09-19-c30r2-durable-owner.md`, `Anvil_작업계획서_v1.md` §19.7.2.

## Global Constraints

- C30 canonical release migration target remains `0013_task_bootstrap_authority`; `0015_agent_team_owner` is not release-applied by this plan.
- Restore consumes authenticated `PrincipalMapping` plus current repository snapshot; hash equality alone is not authentication.
- Revoked, superseded, stale, or fence-mismatched generations fail closed and never re-register authority.
- Existing C22–C24 services are restored only through explicit typed adapters; Task/Run/Event rows are never cast into owner components.
- Browser/request payloads cannot mint or alter owner state.
- Provider, Telegram, Kakao, Oracle, and production calls remain unexecuted.
- Formal PG15/browser/restart evidence is separate from local contract evidence and must remain explicitly labelled.

## Review Focus

- Component payload with a valid outer hash but an altered nested assignment must be rejected by recomputing the canonical component hash.
- A revoked generation or changed execution/write fence must fail before any C22–C24 object is constructed.
- Restore after a new process must produce detached real service objects, not the original object identity or a generic mapping proxy.
- Duplicate restore request IDs must be exact replay only; different payloads must be denied without changing the canonical row.
- Partial component construction or one invalid component must roll back the entire bundle and expose no projection.

### Task 1: Freeze component export contract

**Files:**
- Create: `docs/work_orders/C-30R3_WORK_INSTRUCTION.md`
- Create: `tests/integration/test_c30r3_owner_component_contract.py`

**Interfaces:**
- Consumes: `OwnerSnapshot`, `OwnerBinding`, `PrincipalMapping`, `ProjectionReceipt`.
- Produces: exact `OwnerComponentPayload`, `OwnerComponentBundle`, and `restore_owner_components(...)` signatures used by Tasks 2–4.

- [ ] Write failing fixtures for four components: role policy, role results, team orchestration, and MoA deliberation. Each fixture must include `component_type`, `schema_version`, `assignment_id`, `owner_version`, `component_hash`, and builtin-only payload.
- [ ] Define canonical hash bytes as sorted-key JSON with the outer `component_hash` omitted, UTF-8, no NaN/Infinity, and exact nested field allowlists.
- [ ] Define `OwnerComponentBundle` as a frozen typed value containing the four real service instances plus the binding/version/hash receipt; no generic `dict` return is allowed.
- [ ] Run the contract fixture and record RED before any product implementation.
- [ ] Commit only the WorkInstruction and contract test.

### Task 2: Implement typed component adapter

**Files:**
- Create: `packages/agent_team/owner_component_restore.py`
- Test: `tests/agent_team/test_owner_component_restore.py`

**Interfaces:**
- Consumes: frozen C22–C24 constructors and C30R2 repository `load_current_owner`.
- Produces: `restore_owner_components(snapshot, principal, *, session_factory, now) -> OwnerComponentBundle` and `export_owner_components(bundle) -> tuple[OwnerComponentPayload, ...]`.

- [ ] Add RED tests for nested hash drift, unknown fields, wrong component type, stale version, revoked generation, fence mismatch, duplicate component IDs, and detached-return mutation.
- [ ] Implement exact builtin validation before JSON/hash/callback execution; reject custom mappings, subclasses, pickle, and arbitrary callables.
- [ ] Construct the C22–C24 services only from validated payloads and enforce cross-component assignment/session/target/fence identity.
- [ ] Ensure any construction error discards all partially created services and returns `OwnerContractError` with a stable code.
- [ ] Run adapter tests and the existing C30R2 repository/runtime regressions.
- [ ] Commit adapter and tests.

### Task 3: Wire restart-safe runtime materializer

**Files:**
- Modify: `packages/api/runtime.py`
- Modify: `apps/api/anvil_api/asgi.py`
- Modify: `apps/api/anvil_api/routes/agent_console.py`
- Test: `tests/integration/test_c30r3_runtime_restore.py`

**Interfaces:**
- Consumes: `restore_owner_components`, authenticated `SessionPrincipal`, and C30R2 repository snapshot.
- Produces: server-only materializer used by `RuntimeConsoleOwner`; default construction remains fail-closed 503.

- [ ] Add RED tests proving request body/header/query cannot alter component payload or assignment identity.
- [ ] Resolve current persisted snapshot and principal mapping before materialization, then re-check authority before response and receipt write.
- [ ] Keep `NOT_INTEGRATED` when a durable component export is absent; do not fabricate a projection from an empty payload.
- [ ] Run runtime, C30R2, and route regressions; verify 503 reasons remain explicit.
- [ ] Commit runtime wiring and tests.

### Task 4: Formal restart/entity/browser verification

**Files:**
- Create: `tests/integration/test_c30r3_formal_entity.py`
- Modify: `docs/04_test_reports/C-30_COMPLETION_REPORT.md`
- Modify: `docs/progress/BUILD_HANDOFF.md`

**Interfaces:**
- Consumes: Tasks 1–3, disposable PG15 on WSL-server, exact temporary validation secrets, and a clean candidate image.
- Produces: entity commit/rollback/restart evidence, authenticated same-origin browser Network evidence, and explicit unexecuted-scope records.

- [ ] Run disposable PG15 migration to canonical `0013_task_bootstrap_authority`; record database writes and cleanup.
- [ ] Persist one owner snapshot and receipt, restart web, reload current owner, and prove revoked generation remains denied.
- [ ] Exercise all four console menus, control refusal, CSRF/high-risk refusal, empty/offline/error states, and relative browser URLs.
- [ ] Remove every disposable container, image, network, and temporary secret; verify unrelated services are unchanged.
- [ ] Keep C30 formal acceptance false until independent review and every required evidence item is present.

## Rollback

Remove only the C30R3 adapter/runtime/test/report deltas. Never delete or rewrite C30 historical manifest/events, and never downgrade or delete owner rows in a shared database.

## Self-review

- The plan separates typed component contract, adapter implementation, runtime wiring, and formal evidence.
- No task treats local SQLite or 503 smoke as PostgreSQL/browser/restart acceptance.
- Every restore path revalidates current authority and fences before constructing real service objects.
- The unresolved requirement is explicit: existing C22–C24 services currently have no public export/restore seam, so Task 1 must land before Task 2 implementation.
