# WI-C-01-L3-REWORK-20260911-001

## Authority and immutable baseline

- Human approval: 신산님 approved the public API addition on 2026-09-11.
- Dispatch/control parent: `0f39bad30e7f4ab865077530cbbd29d902d1485d`.
- Final independent review: `.superpowers/sdd/Anvil_작업계획서_v1/task-C-01-final-branch-review-report.md`, SHA-256 `E9D8A4B643C9FDAEF97B06FABDB0159527B6CD506B1238AC9F8BA9ED859A9B46`.
- Preserve committed progress event sequence 1 through 715 and every historical evidence byte. The seq715 fixture-scope acceptance is invalidated for C-01 L3 acceptance, not rewritten.
- Worker lease: `worker-lease-c01-l3-rework-20260911-001`.
- Execution fencing token: `c01-l3-rework-execution-fence-epoch-5-0f39bad`.
- Write lease: `write-lease-c01-l3-rework-20260911-001`.
- Write fencing token: `c01-l3-rework-write-fence-epoch-5-0f39bad`.

## Approved API and persistence contract

- Add `POST /api/runs/{id}/steps/{stepId}:execute` with required permission `run:execute`.
- Use real PostgreSQL for budget reservation/reconciliation and Event persistence.
- Reuse migrations `0005_event_store` and `0009_intervention_budget`; no new migration is allowed.
- Inject a deterministic backend. Provider network calls, Telegram calls, credential access, and cost-incurring calls are prohibited.
- Success returns HTTP 200 with request, reservation, run, step, backend, result, final usage, and provenance, plus persisted Event receipts.
- Unknown usage preserves the reservation as `RECONCILIATION_REQUIRED`, persists a structured `USAGE_RECONCILIATION_REQUIRED` Event, and returns HTTP 409 with the canonical error code and request/reservation correlation.
- Persisted Event data must support E-EVT using id, type, sequence, timestamp, actor, correlation, causation, and idempotency fields. Event payloads must exclude prompt text and credentials.
- E-API evidence must contain raw request/response and normalized OpenAPI before/after diff.

## Exact product and test write lease

- `packages/api/registry.py`
- `packages/api/fastapi_app.py`
- `packages/api/runtime.py`
- `packages/api/step_execution.py`
- `packages/orchestration/kernel.py`
- `packages/budget/models.py`
- `packages/persistence/intervention_budget_repository.py`
- `packages/persistence/event_repository.py`
- `packages/events/reducer.py`
- `packages/events/transition_guard.py`
- `tests/api/test_c01_step_execution.py`
- `tests/persistence/test_c01_step_execution_postgres.py`
- `tests/llm_gateway/test_c01_kernel.py`
- `tests/events/test_event_store.py`
- `tests/api/test_registry_openapi.py`
- `tests/api/test_runtime_app.py`
- `tests/verification/test_c01_l3_independent_acceptance.py`

No path outside this exact set may be changed without a Main ledger ruling. Historical C-01 evidence, seq1-715 control records, migrations, deployment files, and unrelated product/tests are read-only.

## TDD and completion conditions

1. Write and run focused contract tests first; record an expected RED caused by missing L3 behavior.
2. Implement only the minimum approved behavior, then make the focused tests GREEN.
3. Verify real PostgreSQL reservation/reconciliation and persisted ordered/idempotent Event receipts for success and unknown usage.
4. Verify HTTP 200 success and HTTP 409 `USAGE_RECONCILIATION_REQUIRED` at the actual API boundary under `run:execute`.
5. Produce raw request/response and normalized OpenAPI before/after diff without prompt or credential leakage.
6. Record exact changed paths, exact commands and exit codes, hashes, unexecuted scopes, residual risk, and rollback.
7. Do not call Provider, Telegram, credentials, or external network; do not add a migration; do not push, create a PR, deploy, or claim user/production acceptance.

Completion is implementation handoff for independent L3 review only. C-01 remains unaccepted and C-02 remains blocked until that independent review and Main acceptance complete.
