# A-13 Read-Only Repository Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a reusable repository scan adapter that produces baseline/status/tool JSON while proving zero repository mutation.

**Architecture:** A stdlib-only package separates request/schema validation, canonical path guards, read-only Git collection, file inventory, manifest detection, and identical pre/post no-write proofs. Tests use immutable G-06 fixtures and disposable materializations; output and temporary state live outside scanned repositories.

**Tech Stack:** Python stdlib, `unittest`, Git porcelain-v2 with `GIT_OPTIONAL_LOCKS=0`, JSON/SHA-256 evidence.

## Global Constraints

- Scanner must not write, touch, chmod, delete, move, normalize, index, checkout, install, execute project commands/hooks, or use network.
- Any file/mtime/mode/index/ref/HEAD/branch/dirty/untracked delta rejects the scan.
- G-06 fixtures/golden and A-03/A-12 accepted artifacts are immutable.
- Actual user repo/browser/API/DB/WSL/production remain NOT_EXECUTED; no Developer commit/push.

---

### Task 1: Production read-only scan adapter and no-write evidence

**Files:** Create `packages/repository_intelligence/**`, `tests/tooling/test_a13_repository_scan.py`, `scripts/check_a13_repository_scan.py`, narrowly scoped `tests/fixtures/a13/**`, `docs/architecture/a13/**`, `docs/validation/A-13_REPOSITORY_SCAN_VALIDATION.md`, `docs/evidence/manifests/A-13_EVIDENCE_MANIFEST.json`, `docs/completion_reports/A-13_COMPLETION_REPORT.md`.

**Interfaces:** Consumes G-06 fixture catalog, A-03 onboarding schema, A-12 states; produces versioned scan request/result/no-write proof for A-14/A-15 and C-08.

- [ ] **Step 1:** Write failing API/schema and hostile no-write tests before implementation.
- [ ] **Step 2:** Run RED with `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a13_repository_scan`; expect missing package/checker failures.
- [ ] **Step 3:** Implement request/result schemas, canonical path guard, read-only Git collector, full inventory, manifest detector, pre/post proof comparator, structured errors, and external-output guard.
- [ ] **Step 4:** Run all 8 G-06 fixtures and hostile outside-root/symlink/write/hook/tool/network/limit cases; independently verify fixture pre/post content+mtime+Git identity zero delta.
- [ ] **Step 5:** Run focused/full tooling, A01-A13/project/G07/Phase-G checkers, JSON/manifest/raw-target/self-ref/exact diff and diff-check; report executed L3/L5 only, no commit.
