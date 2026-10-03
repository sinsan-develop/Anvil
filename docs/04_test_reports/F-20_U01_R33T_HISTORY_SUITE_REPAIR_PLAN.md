# F-20/U-01 R33T 역사 전체 검증 계약 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WSL-server 동일 SHA 전체 pytest의 역사 시점/현재 기준선 결합 18건을 기존 보안·수락 차단을 유지하며 GREEN으로 복구한다.

**Architecture:** 제품 runtime, 공개 API, checker/overlay, 과거 Event·manifest는 수정하지 않는다. 역사 투영의 유효 시각은 테스트 안에서 고정하고 현재 canonical smoke는 현행 sequence·계약으로 검증한다. 단일 `developer-primary`가 정식 dual lease의 정확한 테스트 경로에만 쓴다.

**Tech Stack:** Python 3.14, pytest 8.4.2, Git 역사 fixture, WSL-server exact-SHA QA.

**Spec:** `Anvil_작업계획서_v1.md` U-01/F-20, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md`, `docs/WORK_STATUS.md`의 SHA `b9967980` 전체 suite 기록.

## Global Constraints

- 기존 `codex/f18-wsl-ops` 브랜치·worktree만 사용한다. 현재 브랜치를 main에 병합·삭제하기 전 새 브랜치 금지.
- Main이 append-only control Event와 WorkInstruction을 발행해 worker/write lease를 유효화하기 전 테스트 파일 쓰기 금지.
- C30 `OPEN_BLOCKING`, F-20/U-01 `REWORK_IN_PROGRESS`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED` 유지.
- 원본 Event bytes, frozen manifest, 제품 API, live 만료 검사, 보안 거부 assertion을 바꾸지 않는다. skip/xfail/전체 테스트 제외 금지.
- 로컬 개발 commit/push의 정확한 SHA를 `ssh WSL-server`의 격리 checkout으로 받아 테스트하고, 전용 임시 경로만 확인 후 정리한다. 공유 DB/Docker/서비스·ysna-server 제외.

## Review Focus

- 역사 lease 시작 직전·만료 시각·만료 후를 각각 검사하여 고정 시계가 실제 만료 권한 허용으로 번지지 않는지 확인한다(Task 1·2).
- 위조 predecessor/fencing/hash/authority가 고정 역사 시각에도 계속 거부되는지 확인한다(Task 1·2).
- 현행 G-05가 역사 시퀀스와 달라져도 실제 current progress/Event sequence를 확인하고 R20 역사 검사도 독립 유지한다(Task 3).
- R33 CLOSE의 progress/digest/manifest/handoff 변조가 각각 정확한 현행 오류로 차단되는지 확인한다(Task 3).
- 승인되지 않은 임의 OpenAPI 경로가 C01 역사 projection의 허용 목록에 들어가지 않으며 parent hash가 유지되는지 확인한다(Task 4).

---

### Task 1: R2/R2b 역사 lease 시계

**Files:** `tests/tooling/test_f20_u01_r2_projection.py`, `tests/tooling/test_f20_u01_r2b_projection.py`.

**Interfaces:** 기존 `overlay.materialize(root, base, at, nonce)`와 `overlay.validate_control(root, bundle, at)`를 그대로 사용한다. public `checker.validate_bundle(bundle)`의 해당 역사 route 테스트에서만 overlay `validate_control`을 테스트의 고정 시각으로 격리한다.

- [ ] 현재 `datetime.now()`가 2026-09-28 만료 역사 lease를 거부하는 8개 RED를 재현한다.
- [ ] R2는 predecessor `2026-09-28T07:55:16Z..19:55:16Z`, R2b는 `10:27:01Z..22:27:01Z` 안의 고정 UTC를 선택한다. 테스트 고정 시각의 전후 만료 경계와 위조 predecessor/fencing/hash 거부를 별도 assertion으로 확인한다.
- [ ] 두 파일의 현재시간 fixture를 고정 시각으로 바꾸고 public route 긍정 검사만 해당 시각으로 격리한다. 제품 overlay/checker는 수정하지 않는다.
- [ ] 두 파일 전체 테스트·인접 G-05를 실행해 PASS와 만료/위조 거부 유지 결과를 기록한다.

### Task 2: R3b~R8 public 역사 dispatcher

**Files:** `tests/tooling/test_f20_u01_r3b_projection.py`, `test_f20_u01_r4_projection.py`, `test_f20_u01_r5_projection.py`, `test_f20_u01_r6_projection.py`, `test_f20_u01_r6b_projection.py`, `test_f20_u01_r7_projection.py`, `test_f20_u01_r8_projection.py` (모두 `tests/tooling/`).

**Interfaces:** 각 파일의 기존 고정 `AT`, 해당 overlay `validate_control(root, bundle, now)`, public `checker.validate_bundle(bundle)`.

- [ ] 7개 public positive assertion의 `TRANSITION_INVALID` RED를 재현한다.
- [ ] 해당 public 호출에서만 overlay module의 `validate_control`을 고정 `AT` 직후 시각으로 감싸고, 이후 원상복구되는 테스트 격리를 사용한다. 경계 밖 시각의 직접 overlay 검사와 기존 변조 음성은 유지한다.
- [ ] 각 파일 전체 테스트와 만료 후 public 거부를 실행해 live checker/overlay 수정 없이 PASS를 확인한다.

### Task 3: R20 역사 G-05와 현재 R33 CLOSE 오류 계약

**Files:** `tests/tooling/test_f20_u01_r20_prep_projection.py`, `tests/tooling/test_project_progress.py`.

**Interfaces:** R20 역사 Git checkpoint `2302980694acaf214b213d8e6728b294ca172a9a`(seq1914), `ebd102f217ee1b5d63d72f2ef63cd0d3c45daf54`(seq1918); 현행 `checker.validate_bundle(bundle)`.

- [ ] 현재 ROOT에서 역사 시퀀스 1914/1918을 기대하는 RED와 R33 CLOSE 위조 오류 불일치 RED를 재현한다.
- [ ] R20은 정확한 역사 checkpoint의 독립 Git fixture에서 해당 당시 G-05를 확인한다. 현재 ROOT smoke는 `build-progress.json`의 현재 sequence와 Event 마지막 sequence가 같은지 별도로 확인한다. 숫자 OR을 단순 추가하지 않는다.
- [ ] R33 CLOSE에서 progress/digest는 `F20_U01_R33_CLOSE_PROJECTION_INVALID`, handoff는 `HANDOFF_NEXT_ACTION_MISMATCH`, manifest는 `F20_U01_R33_CLOSE_F-20_U01_R33_OPERATING_CARDS_SHELL_CLOSE_MANIFEST.JSON_INVALID`로 매핑한다. 다른 route의 기존 오류 기대는 보존한다.
- [ ] 두 파일 전체 테스트와 현재 G-05를 실행해 PASS를 확인한다.

### Task 4: C01 역사 OpenAPI successor 한정

**Files:** `tests/verification/test_c01_l3_independent_acceptance.py`.

**Interfaces:** 기존 `APPROVED_SUCCESSOR_OPENAPI_OPERATIONS`, `_c01_historical_schema`, `_parent_openapi_hash`.

- [ ] 현재 `GET /api/dashboard/operations`만 extra로 보고한 RED를 재현한다.
- [ ] R10 WorkInstruction의 승인된 읽기 전용 경로 **하나만** successor 허용 목록에 추가한다. 원 C01 execute permission/schema/parent hash는 그대로 검사한다.
- [ ] 임의 추가 route는 여전히 실패함을 검증하고 C01 전체 테스트·R10 Dashboard permission/503 회귀를 실행한다.

### Task 5: 통합·기록·정리

**Files:** 위 정확한 테스트 12개, 신규 결과 보고서 `docs/04_test_reports/F-20_U01_R33T_HISTORY_SUITE_REPAIR_RESULT.md`, `docs/WORK_STATUS.md`(Main 기록).

- [ ] 단일 writer의 정확한 diff, 12개 파일 집중 pytest, G-05, `git diff --check`를 검토한다. 다른 파일 변경은 분리한다.
- [ ] 안전한 commit/private push 후 WSL-server에서 **동일 SHA**와 역사 Git 객체를 준비하고 전체 비 opt-in suite를 실행한다. PASS/FAIL/SKIP/warning/exit를 원문 수치로 기록한다.
- [ ] WSL 격리 checkout/pytest/venv/프로세스 잔여0과 공유 자원 불변을 확인한다. 전체 GREEN만으로 U-01/F-20 수락이나 C30 사고 종결로 승격하지 않는다.

## Self-review

- 요구 범위: 18건의 다섯 실패군, 12개 테스트 경로, 만료·위조 음성, C30 차단, 동일 SHA WSL 전체 suite 포함. 제품/API/원장 수정 없음.
- 단계 경계: Task 1~4는 서로 다른 테스트 경로라 독립 검토 가능; Task 5는 통합 증거·정리. 동일 writer가 직렬 실행.
- 실행 방식: 신산님의 기존 계획 완료 지시와 프로젝트의 `developer-primary` 단일 writer/dual lease 규칙을 따른다. 계획 검토를 이유로 추가 계속 승인을 요청하지 않는다.
