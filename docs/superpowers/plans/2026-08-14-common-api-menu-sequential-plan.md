# Common Modules, API, and Sequential Menu Plan Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve completed G, A, and B-01~B-04 evidence while making the remaining canonical execution order common modules, common API/BFF, common UI shell, then the 11 menus one at a time.

**Architecture:** Keep historical Package IDs as immutable trace anchors. Reclassify remaining backend/API rows as foundation capability inventory, add an explicit canonical execution lane and 11 sequential menu delivery Packages, and move final release behind the last menu Gate. The plan revision changes scheduling and ownership without removing any design requirement or validation ID.

**Tech Stack:** Markdown authority documents, Git, Python unittest tooling, SHA-256 evidence binding.

## Global Constraints

- Do not modify completed G, A, or B-01~B-04 package definitions or evidence.
- Preserve all existing design requirements and verification IDs.
- Keep DIR-1, DIR-2, DIR-3, and DIR-X semantics.
- Browser code remains same-origin and operators do not use Python, DB, or internal CLI.
- Each menu owns its menu-specific service/API/UI/browser evidence and must be accepted before the next menu starts.
- Do not mutate `docs/progress` while B-04 has an active write lease; integrate the plan revision only at a safe Main Agent boundary.

---

### Task 1: Revision Metadata and Canonical Lane

**Files:**
- Modify: `Anvil_작업계획서_v1.md`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-08-14-common-api-menu-sequential-plan-design.md`
- Produces: plan v1.6 canonical execution lane and semantic revision record

- [ ] **Step 1: Record the approved semantic revision**

Change the title to v1.6, record the 2026-08-14 owner instruction, and explicitly preserve completed G, A, and B-01~B-04.

- [ ] **Step 2: Replace the top-level execution sequence**

Define the remaining order as `Common Modules → Common API/BFF → Common UI Shell → Dashboard → Workbench → Projects → Runs → Reviews → Quality → Knowledge → Agents & Automation → Environments → Operations → Settings → Final Release`.

- [ ] **Step 3: Add dependency rules**

State that a menu cannot start until the previous menu is `ACCEPTED`, and menu-specific exceptions cannot leak into foundation modules.

- [ ] **Step 4: Inspect the diff**

Run: `git diff -- Anvil_작업계획서_v1.md`

Expected: only metadata and canonical ordering sections changed.

### Task 2: Foundation Ownership and Existing Package Reclassification

**Files:**
- Modify: `Anvil_작업계획서_v1.md`

**Interfaces:**
- Consumes: existing B-05~F-20 requirements
- Produces: foundation capability inventory with no menu UI ownership

- [ ] **Step 1: Mark B-05~B-12 as common module/API foundation**

Keep IDs and requirements, but make B-11 the common API/BFF Gate and B-12 the recovery verification of that foundation.

- [ ] **Step 2: Reclassify distributed UI rows**

Limit C-04, D-12, E-02, F-12, and F-13 to framework-neutral service/API/projection contracts. Assign their actual menu UI delivery to the new menu Packages.

- [ ] **Step 3: Separate final release from reusable backend capability**

Keep F-01~F-19 as provider/environment/operations backend and deployment capability. Make final production release depend on the last menu Gate.

- [ ] **Step 4: Verify no requirement was deleted**

Run focused `rg` searches for `ProductValidation`, `EvidenceManifest`, `Skill`, `Hook`, `Provider`, `SSE`, `DIR`, `backup/restore`, and `ReleaseDecision`.

Expected: every term remains assigned.

### Task 3: Add the 11 Sequential Menu Packages

**Files:**
- Modify: `Anvil_작업계획서_v1.md`

**Interfaces:**
- Consumes: foundation domain/service/API contracts
- Produces: `U-01` through `U-11`, each a complete vertical menu delivery

- [ ] **Step 1: Add the Phase U table**

Add Packages in this exact order: Dashboard, Workbench, Projects, Runs, Reviews, Quality, Knowledge, Agents & Automation, Environments, Operations, Settings.

- [ ] **Step 2: Define each vertical completion boundary**

Each row must include menu-specific service completion, API/BFF, UI, accessibility, security, loading/empty/error/blocked states, actual browser clicks, Network evidence, regression, and rollback.

- [ ] **Step 3: Add strict serial dependencies**

Set `U-01` to depend on all foundation/backend readiness Gates and each later Package to depend on the immediately preceding `U-*` Package.

- [ ] **Step 4: Add the Phase U Gate**

Require all 11 menus, cross-menu regression, 1920×1080 consistency, same-origin Network evidence, and zero internal endpoint/secret exposure.

### Task 4: Reconcile Gates, Counts, Traceability, and Next Actions

**Files:**
- Modify: `Anvil_작업계획서_v1.md`

**Interfaces:**
- Consumes: new Package order and Phase U
- Produces: consistent summaries, DIR percentages, requirement trace, and startup sequence

- [ ] **Step 1: Update phase summary and package count**

Add Phase U with 11 Packages and change total from 97 to 108 without rewriting historical accepted counts.

- [ ] **Step 2: Update DIR cumulative percentages**

Keep historical completed numerators and recalculate percentages against 108; do not move the checkpoint triggers.

- [ ] **Step 3: Update requirement trace rows**

Point all menu UI evidence to `U-01~U-11`, while retaining original backend Package references.

- [ ] **Step 4: Update the full start sequence**

Record B-04 as the protected current boundary and B-05 as the first Package governed by v1.6 after safe integration.

### Task 5: Validate and Commit the Plan Revision

**Files:**
- Modify: `Anvil_작업계획서_v1.md`

**Interfaces:**
- Consumes: completed Tasks 1-4
- Produces: reviewed plan revision commit

- [ ] **Step 1: Scan for placeholders and stale totals**

Run:

```powershell
rg -n "TBD|TODO|97개|22 / 97|49 / 97|73 / 97" Anvil_작업계획서_v1.md
```

Expected: no placeholder and no stale active total; historical references must be explicitly labelled historical.

- [ ] **Step 2: Verify menu order and uniqueness**

Run a read-only script that asserts `U-01` through `U-11` appear once in order and each menu name maps to exactly one Package.

- [ ] **Step 3: Run document/tooling checks**

Run:

```powershell
git diff --check
C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p "test_*.py"
```

Record actual results. Existing hash-binding failures caused solely by the unintegrated semantic revision must be reported, not hidden.

- [ ] **Step 4: Review exact diff**

Confirm no product, progress, evidence, approval, matrix, or test-plan file changed.

- [ ] **Step 5: Commit**

```powershell
git add -- Anvil_작업계획서_v1.md
git commit -m "docs: reorder remaining work around common APIs and menus"
```

