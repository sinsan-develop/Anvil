# WI-E-08-R1-20260917-001 — Atomic budget reservation and capability routing

## Authority

- Baseline commit: `03878181590d13231fee3a47f7d43963d6a089c8`
- Branch: `codex/c09-execution-backends-r1`
- Design: `Anvil_설계서_v2.md` §27.2, §27.4, §47.8~47.9, §49.6
- Work plan: `Anvil_작업계획서_v1.md` E-08
- Validation: `AV-STAT-024`, `AV-STAT-025`, `AV-STAT-028`, `AV-STAT-036`, `AV-OPS-012`, `AV-OPS-019`, `AV-AGT-038`, `AV-FLOW-009`
- Project scope/requirements/material risk: unchanged. No new human approval is required.

## Objective

Complete the host-side E-08 budget reservation/router boundary on the existing B-10 atomic repository contract. Before every Provider send, reserve the maximum forecast for token, cost, and concurrency. Reconcile authoritative final usage and release only the proven remainder. Unknown or abort-pending usage remains full exposure and `USAGE_RECONCILIATION_REQUIRED`. A hard-limit or quota stop records `PAUSED_QUOTA`, checkpoint, incomplete Step, reset hint, and next safe action without counting a product failure. Capability routing may use only the frozen eligible/approved route set; no silent or unapproved fallback is permitted.

## Product write scope — exact6

1. `packages/budget/__init__.py`
2. `packages/budget/models.py`
3. `packages/budget/service.py`
4. `packages/budget/routing.py`
5. `tests/budget/test_budget_routing_e08.py`
6. `docs/04_test_reports/E-08_COMPLETION_REPORT.md`

No migration, SQL schema, API/UI, Provider network, credential, deployment, E-09 Gate, or unrelated file change is allowed. Existing B-10 PostgreSQL/in-memory adapters are dependencies, not a license to rewrite them.

## Required behavior

- Bind each forecast to budget/run/step/request/provider/model/pricing version and immutable capability-route revision.
- Execute `forecast maximum → atomic reserve → Provider send → final usage receipt → consume actual → release remainder` in that order.
- Reservation failure must produce zero Provider sends. Parallel requests immediately below a hard limit may send only for successful reservations.
- Abort/client disconnect never implies zero cost. Preserve request ID, abort status, retry-after, rate bucket, provenance, and final usage. Unknown usage retains the full reservation and blocks new exposure as applicable.
- Quota/hard-limit exhaustion is `PAUSED_QUOTA`, not `FAILED`; persist checkpoint reference, incomplete Step, reset hint, and next safe action. Do not auto-resume.
- Route only to a capability/privacy/price/context eligible primary. Fallback is allowed only for an explicitly approved trigger and approved equivalent candidate in the frozen route revision. Hard-limit/quota, approval expiry, capability drift, privacy mismatch, unknown failure, or unapproved Provider must never fallback.
- Keep all returned records detached/immutable, reject ID replay with changed content, and make concurrent duplicate delivery idempotent.
- External DB/provider/process/runtime integration that is not actually run must be reported `NOT_EXECUTED` or `NOT_INTEGRATED`, never PASS.

## Verification

- TDD RED then GREEN for all product behavior.
- Focused E-08 tests, existing `tests/budget`, relevant gateway/provider routing regression, syntax/compile, `git diff --check`, canonical progress checker.
- At least 100-way hard-limit reservation race with exact send-count equality; abort-before/after-send cases; unknown usage; quota checkpoint; no-fallback cases; replay/conflict; failure-atomic publication.
- Preserve Main-owned control files and do not stage, commit, push, or edit outside exact6.

## Completion report

Return `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` with exact commands/results, changed paths, RED/GREEN evidence, skipped/unverified layers, residual risks, rollback, and confirmation that Main control files were not modified.
