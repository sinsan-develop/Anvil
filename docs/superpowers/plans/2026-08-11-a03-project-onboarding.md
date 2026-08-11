# A-03 Project Dashboard·Repository Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project 등록·Repository read-only onboarding·Dashboard 상태를 정적 화면과 fail-closed field/state 계약으로 확정한다.

**Architecture:** 단일 JSON catalog가 screen, field, state, transition, reason code의 정본이다. Markdown 3개와 1920×1080 SVG 3개는 catalog를 해설·시각화하고, stdlib checker와 hostile fixtures가 semantic binding과 static/runtime 경계를 검증한다.

**Tech Stack:** Markdown, JSON, SVG, Python stdlib `unittest`

## Global Constraints

- A-03 verdict는 `STATIC_CONTRACT_PASS`; canonical L7는 `RUNTIME_DEFERRED / NOT_EXECUTED`다.
- `AV-UI-003` runtime owner는 F-01/F-12/F Gate, `AV-UI-004` runtime owner는 A-14/A Gate다.
- A-02의 1920×1080·12px·semantic token·tooltip/popover 계약을 exact predecessor로 사용한다.
- Repository scan은 read-only이며 dirty/untracked를 자동 정리·이동·삭제하지 않는다.
- 제품 runtime, browser, API, DB, scanner, dependency, server, deploy를 구현하지 않는다.

---

### Task 1: WorkInstruction과 실행 fencing

**Files:**
- Create: `docs/work_orders/A-03_WORK_INSTRUCTION.md`
- Create: `docs/work_orders/A-03_INVOCATION_PROMPT.md`
- Modify: `docs/progress/**`

**Interfaces:**
- Consumes: A-01 journey, A-02 token catalog, progress seq57 A-03 READY
- Produces: approved WI hash, active worker/write lease, start manifest

- [ ] 권위 hash와 `HEAD=origin/main`, clean worktree를 검증한다.
- [ ] A-03 exact scope, staged AV 판정, hostile mutations를 WorkInstruction에 고정한다.
- [ ] worker/write lease와 `PACKAGE_STARTED` Event를 발급한다.
- [ ] detached digest와 start manifest를 one-way로 결박한다.
- [ ] project/G-07/Phase-G checker와 diff-check를 실행한다.

### Task 2: RED — screen·field·state 계약

**Files:**
- Create: `tests/tooling/test_a03_onboarding.py`
- Create: `tests/fixtures/a03/canonical-contract.json`
- Create: `tests/fixtures/a03/mutation-catalog.json`

**Interfaces:**
- Consumes: WorkInstruction exact contracts
- Produces: `validate_bundle(root: Path) -> dict`, stable reason-code expectations

- [ ] checker와 artifact가 없는 상태에서 presence test RED를 관찰한다.
- [ ] screen, field, state, transition, reason-code exact tests를 작성한다.
- [ ] local/git conditional field, 409/403/422 error, view/manage permission tests를 작성한다.
- [ ] dirty/untracked preservation과 read-only scan mutation tests를 작성한다.
- [ ] A-02 token 및 static/runtime qualifier tests를 작성한다.
- [ ] hostile fixture 전량이 fail-open 상태에서 RED임을 확인한다.

### Task 3: GREEN — catalog·문서·static renders

**Files:**
- Create: `docs/architecture/a03/A-03_ONBOARDING_CATALOG.json`
- Create: `docs/architecture/a03/A-03_PROJECT_DASHBOARD.md`
- Create: `docs/architecture/a03/A-03_PROJECT_REGISTRATION.md`
- Create: `docs/architecture/a03/A-03_REPOSITORY_ONBOARDING.md`
- Create: `docs/architecture/a03/A-03_DASHBOARD_STATIC_RENDER.svg`
- Create: `docs/architecture/a03/A-03_ONBOARDING_STATIC_RENDER.svg`
- Create: `docs/architecture/a03/A-03_REPOSITORY_STATE_STATIC_RENDER.svg`
- Create: `scripts/check_a03_onboarding.py`

**Interfaces:**
- Consumes: `canonical-contract.json`, A-01/A-02 predecessor hashes
- Produces: `validate_catalog`, `validate_documents`, `validate_renders`, `validate_bundle`

- [ ] catalog에 canonical screens, fields, states, transitions, reason codes를 구현한다.
- [ ] Markdown 3개를 catalog stable IDs·values에 결박한다.
- [ ] 정상 Dashboard, onboarding, warning/blocked repository state SVG를 1920×1080로 작성한다.
- [ ] checker가 exact semantic binding과 SVG/token/static qualifier를 검증하게 한다.
- [ ] targeted tests와 checker를 GREEN으로 만든다.

### Task 4: Developer evidence와 TEST_REVIEW

**Files:**
- Create: `docs/validation/A-03_ONBOARDING_VALIDATION.md`
- Create: `docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json`
- Create: `docs/completion_reports/A-03_COMPLETION_REPORT.md`
- Modify: `docs/progress/**`

**Interfaces:**
- Consumes: immutable A-03 artifacts/checker/tests
- Produces: target/delivered manifest, CompletionReport, TEST_REVIEW projection

- [ ] raw artifact bytes/hash와 deterministic target을 결박한다.
- [ ] RED→GREEN, hostile result, 미실행 runtime, rollback을 기록한다.
- [ ] Main이 leases를 회수하고 `PACKAGE_COMPLETED / TEST_REVIEW`로 전환한다.
- [ ] A-03·progress·G-07·Phase-G 회귀와 diff-check를 fresh 실행한다.

### Task 5: 독립 Tester와 Main acceptance

**Files:**
- Create: `docs/test_reports/A-03_TEST_REPORT.md`
- Modify: `docs/progress/**`

**Interfaces:**
- Consumes: frozen Developer manifest와 Main completion manifest
- Produces: independent verdict, A-03 ACCEPTED, A-04 READY

- [ ] Tester가 exact catalog·document·SVG·manifest와 independent hostile mutations를 재검증한다.
- [ ] blocking defect가 있으면 동일 Developer에게 scoped rework를 지시한다.
- [ ] PASS면 Main이 `MAIN_PACKAGE_ACCEPTED`, A-04 READY를 materialize한다.
- [ ] full focused regression, four CLI checkers, manifest, Git status를 fresh 검증한다.
- [ ] accepted state를 commit하고 `origin/main`에 push한다.
