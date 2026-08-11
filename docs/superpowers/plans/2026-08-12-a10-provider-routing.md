# A-10 Provider Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the A-10 static contract for canonical provider settings, capability-aware routing, egress, secret status, and drift blocking.

**Architecture:** A single machine-readable catalog is the source of truth. Focused Markdown and 1920×1080 SVG renders consume that catalog, while a fail-closed Python checker and hostile fixtures verify exact states, edges, permissions, predecessor hashes, and evidence integrity.

**Tech Stack:** JSON, Markdown, SVG, Python `unittest`, repository-native SHA-256 EvidenceManifest.

## Global Constraints

- Canonical provider order is `CEREBRAS,GROQ,MISTRAL,OPENROUTER,UPSTAGE,GEMINI,ANTHROPIC,OPENAI,OLLAMA`.
- A-10 is `STATIC_ONLY / STATIC_CONTRACT_PASS`; actual L3/L5, AI/AN, E-AUD/E-TEST and runtime are `NOT_EXECUTED`.
- Browser-facing artifacts must not contain credential values, API keys, tokens, raw internal endpoints, provider raw errors, or unauthorized full paths.
- Existing A-01~A-09 accepted artifacts and authority documents are immutable.
- No apps/packages/dependency/config/runtime/API/DB/network/deploy mutation and no Developer commit/push.

---

### Task 1: Provider routing contract and fail-closed validation

**Files:**
- Create: `docs/architecture/a10/**`
- Create: `scripts/check_a10_provider_routing.py`
- Create: `tests/tooling/test_a10_provider_routing.py`
- Create: `tests/fixtures/a10/canonical-contract.json`
- Create: `tests/fixtures/a10/mutation-catalog.json`
- Create: `docs/validation/A-10_PROVIDER_ROUTING_VALIDATION.md`
- Create: `docs/evidence/manifests/A-10_EVIDENCE_MANIFEST.json`
- Create: `docs/completion_reports/A-10_COMPLETION_REPORT.md`

**Interfaces:**
- Consumes: accepted A-01~A-09 manifests, A-02 token/explanation contract, A-04 Execution Mode shell, A-07 permission model, A-09 learning/runtime boundary.
- Produces: canonical provider/model/routing/egress/secret/drift catalog for A-11~A-15 and D-11/F-02 runtime implementation.

- [ ] **Step 1: Write the failing tests**

Assert required artifacts and checker are missing, then add hostile cases for provider reorder/removal, unavailable hiding, capability guessing, route activation without probe/benchmark, secret or endpoint disclosure, egress expansion without approval, silent fallback, revoked secret use, snapshot drift bypass, permission collapse, static runtime promotion, and manifest bypass.

- [ ] **Step 2: Run RED**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a10_provider_routing`

Expected: non-zero exit caused by the missing A-10 checker/artifacts and each newly introduced fail-open mutation.

- [ ] **Step 3: Implement the minimal static contract**

Create one catalog, focused specifications, 1920×1080 SVG specimens, and checker validation for exact provider order, states, model evidence, routing guards, DataEgressProfile, SecretRef, drift blocking, permissions, static qualifiers, predecessor bindings, and EvidenceManifest raw/target/self-reference checks.

- [ ] **Step 4: Run GREEN and regressions**

Run the focused A-10 unittest, A-10 checker, full `tests/tooling` discovery, project/G07/Phase-G checkers, JSON/SVG parse checks, manifest recomputation, predecessor immutability checks, exact-path verification, and `git diff --check`.

- [ ] **Step 5: Report without committing**

Freeze the exact allowed paths and hashes in `A-10_COMPLETION_REPORT.md`. Report actual Provider/Secret/Egress/API/DB/Event/browser/network/runtime as `NOT_EXECUTED`; Main performs completion projection, commit/push, independent testing, and acceptance.
