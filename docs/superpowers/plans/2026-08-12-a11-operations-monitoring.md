# A-11 Operations Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the A-11 static operations contract for system-detected health, queue/worker fencing, alerts, budget reconciliation, and deployment monitoring.

**Architecture:** A machine-readable operations catalog drives focused Markdown and 1920×1080 SVG specimens. A fail-closed Python checker and hostile fixtures validate exact state separation, evidence, guards, permissions, predecessor hashes, and EvidenceManifest integrity.

**Tech Stack:** JSON, Markdown, SVG, Python `unittest`, SHA-256 EvidenceManifest.

## Global Constraints

- A-11 is `STATIC_ONLY / STATIC_CONTRACT_PASS`; actual L4/FI/E-SHOT and operational runtime are `NOT_EXECUTED`.
- Every anomaly must show system detector evidence, cause, impact, next action, and deep link.
- Queue/worker/write fencing, budget reservation, and deployment monitoring state sequences remain distinct and fail-closed.
- Existing A-01~A-10 accepted artifacts and authority documents are immutable.
- No apps/packages/dependency/runtime/API/DB/Event/SSE/browser/network/deploy mutation and no Developer commit/push.

---

### Task 1: Operations monitoring contract and validation

**Files:**
- Create: `docs/architecture/a11/**`
- Create: `scripts/check_a11_operations_monitoring.py`
- Create: `tests/tooling/test_a11_operations_monitoring.py`
- Create: `tests/fixtures/a11/canonical-contract.json`
- Create: `tests/fixtures/a11/mutation-catalog.json`
- Create: `docs/validation/A-11_OPERATIONS_MONITORING_VALIDATION.md`
- Create: `docs/evidence/manifests/A-11_EVIDENCE_MANIFEST.json`
- Create: `docs/completion_reports/A-11_COMPLETION_REPORT.md`

**Interfaces:**
- Consumes: accepted A-01~A-10 manifests, A-07 fencing/agent contract, A-08 result layers, A-10 provider/routing states.
- Produces: operations/health/monitoring catalog for A-12~A-15 and F-13 runtime implementation.

- [ ] **Step 1: Write failing tests** for missing artifacts and hostile stale health, manual-only anomaly, missing cause/impact/next action/deep link, alert transition, stale fencing, poison retry, budget ordering/reconcile, provider drift, deployment monitoring/rollback, enum conflation, permission/sensitive/static promotion, and manifest bypass.
- [ ] **Step 2: Run RED** with `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a11_operations_monitoring`; expect non-zero missing-contract and fail-open mutation results.
- [ ] **Step 3: Implement minimal catalog, focused specs, 1920×1080 SVGs, checker, fixtures, validation, manifest, and CompletionReport** with exact fields/states/edges/errors/permissions and accepted predecessor bindings.
- [ ] **Step 4: Run GREEN and regressions**: focused unittest/checker, full tooling, A01-A11/project/G07/Phase-G checkers, JSON/SVG parse, raw/target/self-reference, predecessor/exact-path checks, and `git diff --check`.
- [ ] **Step 5: Freeze report without commit** and mark actual operations runtime `NOT_EXECUTED`; Main owns completion projection, commit/push, independent testing, and acceptance.
