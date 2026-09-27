# F-20 증거 결박·재작업 통제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 잘못 수락된 F-20 증거를 과거 Event 변경 없이 무효화하고, 검증된 재작업 lease를 발급하기 전에는 제품 파일을 수정하지 않는다.

**Architecture:** seq1714 이후 append-only 정정 Event와 새 projection을 사용한다. 과거 보고서·manifest·Event bytes는 그대로 둔다. G-05는 현재 상태와 원본 해시 불일치를 검출하고, 새 정정 상태에서는 명시적으로 무효화된 수락만 허용한다.

**Tech Stack:** Python 3, pytest, JSON Event stream, Markdown handoff.

**Spec:** `Anvil_작업계획서_v1.md` §14 F-20, `AGENTS.md` §4~8·§13, `docs/progress/progress-event-contract.json`.

## Global Constraints

- 개발은 로컬, 실제 테스트는 `ssh WSL-server`이며 Production·`ysna-server`는 제외한다.
- 현재 `codex/f18-wsl-ops` 브랜치가 main에 병합·삭제되기 전 새 작업 브랜치를 만들지 않는다.
- seq1714 및 기존 F-20 보고서·manifest의 bytes를 수정하지 않는다.
- 유효한 `worker_lease`와 종속 `write_lease`가 투영되기 전 제품 파일을 수정하지 않는다.
- F-20의 11개 메뉴 기능 smoke·중단/재개와 기존 WSL 실패 테스트가 통과하기 전 `MAIN_PACKAGE_ACCEPTED`를 다시 발행하지 않는다.

## Review Focus

- 보고서 해시만 맞고 manifest 해시가 틀린 경우에도 수락 상태를 거부하는지 Task 1에서 검증한다.
- 무효화 Event가 다른 Package·manifest를 가리키면 거부하는지 Task 2에서 검증한다.
- 이전 lease token을 새 epoch에 재사용하면 거부하는지 Task 2에서 검증한다.
- 과거 Event bytes를 변경하면 거부하는지 Task 2에서 검증한다.
- 미실행 WSL 재검증을 PASS로 투영하지 않는지 Task 2에서 검증한다.

---

### Task 1: F-20 완료 증거 결박 검사

**Files:**
- Create: `tests/tooling/test_f20_evidence_binding.py`
- Create: `scripts/f20_evidence_binding.py`
- Modify: `scripts/check_project_progress.py`

**Interfaces:**
- Consumes: seq1714 `details.test_report_ref`/`test_report_sha256`, `manifest_ref`/`manifest_sha256`, 현재 파일 bytes.
- Produces: `validate_f20_acceptance_binding(root: Path, events: list[dict]) -> list[str]`. 보고서·manifest 해시가 실제 파일과 다르면 `F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH`를 반환한다.

- [x] **Step 1:** 현재 checkout의 보고서·manifest SHA를 읽는 테스트를 작성하고 두 불일치 모두 검출되는지 단정한다.
- [x] **Step 2:** 전용 Python으로 해당 테스트를 실행해 RED를 확인한다.
- [x] **Step 3:** 순수 해시 검사 함수를 별도 module에 구현하고 G-05의 F-20 수락 projection에 연결한다. 역사적 파일은 변경하지 않는다.
- [x] **Step 4:** 같은 테스트에서 GREEN을 확인하고 G-05는 이 checkout에서 기대대로 FAIL인지 확인한다.
- [x] **Step 5:** 테스트·검사기만 별도 commit한다.

### Task 2: Append-only 무효화와 재작업 projection

**Files:**
- Create: `docs/work_orders/F-20_REWORK_R1_WORK_INSTRUCTION.md`
- Create: `tests/tooling/test_f20_rework_projection.py`
- Modify: `docs/progress/progress-events.json`, `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`, `scripts/check_project_progress.py`
- Create: F-20 R1 전용 detached digest와 evidence manifest (정확한 파일명은 WorkInstruction에 고정).

**Interfaces:**
- Consumes: seq1714, Task 1의 해시 검사, 현재 브랜치 HEAD.
- Produces: `EVIDENCE_MANIFEST_INVALIDATED` → 재작업 지시 → `WORKER_LEASE_ISSUED` → `WRITE_LEASE_ISSUED` → `PACKAGE_RESUMED` 순서의 새 Event 및 일치하는 progress/handoff/digest/manifest.

- [ ] **Step 1:** 과거 seq1714 보존, 대상 manifest 고정, 서로 다른 fencing token과 정확한 제품 경로 범위를 요구하는 RED 테스트를 작성한다.
- [x] **Step 2:** 재작업 WorkInstruction에 Git 쓰기 오류 형식, 11개 메뉴 실제 기능 검증, 중단/재개, WSL 환경 및 제외 범위를 기록한다.
- [ ] **Step 3:** 새 Event와 파생 projection만 생성하고 신규 lease를 검사한다.
- [ ] **Step 4:** G-05·projection 테스트 GREEN, `git diff --check`, 과거 Event/보고서/manifest의 byte 동등성을 확인한다.
- [ ] **Step 5:** 통제 상태를 commit·push하고 원격 SHA를 확인한다.

## 후속 구현 경계

이 계획은 통제 상태 복구까지만 다룬다. Task 2가 GREEN이고 유효한 lease가 확인된 뒤에만 `packages/agent_team/worktree_writes.py:469`와 `tests/agent_team/test_worktree_writes_e06.py`의 오류 형식 회귀를 RED→GREEN으로 수정한다. 11개 메뉴 실제 기능·중단/재개·same-origin Network·WSL 전체 suite는 별도 F-20 R1 WorkInstruction의 완료조건이며, 미실행이나 실패를 PASS로 기록하지 않는다. `P-01` 착수, `MAIN_PACKAGE_ACCEPTED` 재발행 및 main 병합은 그 완료조건 전까지 금지한다.
