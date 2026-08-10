# A-01 AV-FLOW-001 Responsibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A-01의 실행 불가능한 `AV-FLOW-001` 배정을 제거하고 활성 기준선과 검증기를 새 책임 경계로 결박한다.

**Architecture:** 과거 승인 evidence는 불변으로 보존하고 새 사람 승인 파생 baseline을 만든다. 활성 권위 문서만 revision-up한 뒤 progress/HANDOFF와 live validator가 새 hash를 가리키게 한다.

**Tech Stack:** Markdown authority documents, JSON progress/event contracts, Python stdlib validators and unittest, Git SHA-256 evidence.

## Global Constraints

- `AV-FLOW-001`의 A Gate, A-05, B-03 책임은 유지한다.
- A-01은 `AV-UI-005`만 판정한다.
- Package 97, AV 255, executable 234, reverse index 97, uncovered 0을 유지한다.
- historical evidence와 accepted manifests는 수정하지 않는다.
- 기능 범위·요구사항·중요 위험의 추가 변경과 DIR 도달 시 중단한다.

---

### Task 1: Responsibility regression contract

**Files:**
- Modify: `tests/tooling/test_g07_baseline.py`
- Modify: `scripts/check_g07_baseline.py`
- Create: `docs/approvals/APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001.md`

**Interfaces:**
- Consumes: current matrix reverse-index parser.
- Produces: exact A-01/A-05/B-03/A-Gate responsibility guard.

- [ ] Write a failing test asserting A-01 equals `[AV-UI-005]`, A-05/B-03 include `AV-FLOW-001`, and A Gate still includes it.
- [ ] Run the targeted test and observe failure against the current A-01 row.
- [ ] Add the smallest validator rule with stable reason codes.
- [ ] Record the user's approval, exact old responsibility, exact new responsibility, no-scope-expansion statement, and superseded hash lineage.

### Task 2: Authority revision and hash binding

**Files:**
- Modify: `Anvil_통합검증매트릭스_v1.md`
- Modify: `Anvil_작업계획서_v1.md`
- Modify: `Anvil_테스트계획서_v1.md`
- Modify: `docs/governance/ANVIL_OPERATING_RULES.md`
- Modify: `scripts/check_g07_baseline.py` (active authority version/hash constants only)
- Modify: `tests/tooling/test_g07_baseline.py` only when the active authority revision assertion must change
- Create: `docs/baselines/A-01_PRECONDITION_DERIVED_BASELINE.md`

**Interfaces:**
- Consumes: approval artifact from Task 1.
- Produces: active matrix revision/hash and synchronized plan/test/operations references.

- [ ] Change only the A-01 reverse-index responsibility and add an explicit revision note.
- [ ] Compute the new matrix SHA-256.
- [ ] Update plan and test-plan revision headers, baseline references, and A-01 static-only/runtime-deferred wording.
- [ ] Compute new plan and test-plan SHA-256 values after all content is final.
- [ ] Update operating-rules version and active baseline table.
- [ ] Write a derived baseline containing old/new versions, hashes, approval ID, semantic classification, and affected responsibility only.

### Task 3: Active projection and onboarding

**Files:**
- Modify: `docs/onboarding/developer-primary-ack.md`
- Modify: `docs/progress/build-progress.json`
- Modify: `docs/progress/BUILD_HANDOFF.md`
- Modify: `docs/progress/progress-events.json`
- Modify: `docs/progress/progress-event-contract.json` only if a new event type is required.
- Create: `docs/evidence/manifests/A-01_PRECONDITION_EVIDENCE_MANIFEST.json`

**Interfaces:**
- Consumes: final authority hashes from Task 2 and actual `HEAD=origin/main` observation.
- Produces: A-01 READY projection with no active lease and a reproducible manifest target.

- [ ] Re-onboard against the complete active authority set and record exact bytes/hash.
- [ ] Append a non-retroactive approval/baseline reconciliation event.
- [ ] Keep A-01 `READY`, active WorkInstruction `null`, worker/write lease `null`.
- [ ] Bind progress/HANDOFF with a detached digest and evidence manifest without a hash cycle.

### Task 4: Fresh verification and independent review

**Files:**
- Create: `docs/test_reports/A-01_PRECONDITION_TEST_REPORT.md`

**Interfaces:**
- Consumes: all Task 1-3 artifacts.
- Produces: PASS/REWORK decision before A-01 WorkInstruction issuance.

- [ ] Run the responsibility mutation tests and complete tooling regression.
- [ ] Verify Package 97, AV 255, executable 234, reverse 97, uncovered 0.
- [ ] Verify historical accepted evidence hashes are unchanged.
- [ ] Have an independent Tester reproduce the checks and write the report.
- [ ] Only after independent PASS may Main commit/push and issue A-01 WorkInstruction.
