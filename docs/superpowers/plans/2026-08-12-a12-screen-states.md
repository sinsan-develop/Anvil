# A-12 Cross-Screen States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete A-03~A-11 cross-screen static state and semantic badge contract.

**Architecture:** One machine-readable matrix enumerates surfaces, required states, envelopes, transitions, and evidence semantics. Markdown/SVG specimens consume it, while a fail-closed checker and hostile fixtures validate coverage, visual semantics, guards, predecessors, and EvidenceManifest integrity.

**Tech Stack:** JSON, Markdown, SVG, Python `unittest`, SHA-256 EvidenceManifest.

## Global Constraints

- Required states are `LOADING,EMPTY,ERROR,BLOCKED,QUOTA,CANCEL,RECONNECT`; `PERMISSION_DENIED` is mandatory cross-cutting.
- Only actually executed qualifying evidence may display PASS; mock/fixture/static/SKIPPED/BLOCKED/NOT_EXECUTED never use positive PASS semantics.
- A-12 is STATIC_ONLY; actual L4/AE/AN/MI/E-SHOT and browser/API/SSE runtime are NOT_EXECUTED.
- A-03~A-11 accepted artifacts and authority are immutable; no apps/packages/runtime/dependency/API/DB/network mutation or Developer commit/push.

---

### Task 1: Complete state matrix and fail-closed semantic validation

**Files:** Create `docs/architecture/a12/**`, `scripts/check_a12_screen_states.py`, `tests/tooling/test_a12_screen_states.py`, `tests/fixtures/a12/**`, `docs/validation/A-12_SCREEN_STATES_VALIDATION.md`, `docs/evidence/manifests/A-12_EVIDENCE_MANIFEST.json`, `docs/completion_reports/A-12_COMPLETION_REPORT.md`.

**Interfaces:** Consumes accepted A-03~A-11 surface catalogs; produces state semantics for A-13~A-15 and A Gate.

- [ ] **Step 1:** Write failing artifact/coverage/hostile tests for every surface/state, envelope, non-PASS badge, quota/cancel/reconnect/permission, sensitive disclosure, static promotion, predecessor and manifest bypass.
- [ ] **Step 2:** Run RED with `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a12_screen_states` and record non-zero missing/fail-open results.
- [ ] **Step 3:** Implement minimal catalog, focused specs, 1920×1080 SVGs, checker, fixtures, validation, manifest, and CompletionReport.
- [ ] **Step 4:** Run focused GREEN, full tooling, A01-A12/project/G07/Phase-G checkers, matrix coverage, JSON/SVG, raw/target/self-ref, predecessor/exact-path and diff checks.
- [ ] **Step 5:** Freeze exact report without commit; runtime remains NOT_EXECUTED and Main owns completion, test, acceptance.
