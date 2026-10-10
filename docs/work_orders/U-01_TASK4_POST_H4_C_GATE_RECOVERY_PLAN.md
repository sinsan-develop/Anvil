# U-01 Task4 post-H4 C 단계 G-05 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 게시된 C의 G-05 실패를 불변 보존하고, 새 C2 단계에서 실제 clean/private exact-SHA G-05를 통과시키며 기존 U-01 미수락 경계를 유지한다.

**Architecture:** 기존 W2→A→C와 모든 역사 blob은 변경하지 않는다. C 뒤 진단 D1→새 WI W3→분리 lease A2→수정 코드 C2→활성 B2→회수 H2의 직접 부모·정확 경로를 새 비제품 route로 검증한다. D1/W3/A2의 RED는 준비 상태이고 C2/B2/H2의 각 게시 SHA에 대해서만 GREEN을 요구한다.

**Tech Stack:** Windows PowerShell/Git, Python pytest, JSON Event/progress/HANDOFF/detached digest, `ssh WSL-server`의 격리 Git QA checkout.

**Spec:** `docs/work_orders/U-01_TASK4_POST_H4_REPORT_TAIL_WORK_INSTRUCTION.md`, `docs/work_orders/U-01_TASK4_POST_H4_RECOVERY_PLAN.md`, `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01/G-05, `design_change.md` DC-U01-016.

## Global Constraints

- 기존 `codex/u01-dashboard-r2` 단일 branch/worktree만 사용하고 C `3e788ed25330910d2b55c932e3fe517e8661bd59`를 rewrite/force push하지 않는다.
- 개발은 로컬, 시험은 private Git push 후 `ssh WSL-server`에서 exact SHA로만 수행한다. ysna/Production·공유 DB·공유 서비스·새 branch는 제외한다.
- 제품/API/UI/DB/권한/Secret 변경0. 역사 H4→R→P→W→A→C→B→H→R2→D→W2→A→C 및 원문 Event prefix, approval/WI blob을 그대로 검증한다.
- C의 `U01_TASK4_POST_H4_TAIL_GIT_INVALID`를 기록하되 PASS로 바꾸지 않는다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`다.
- Main은 WI/lease/Event/progress/HANDOFF/digest/WORK_STATUS와 Git checkpoint를 소유하고, 유효 dual token의 단일 Developer만 지정된 검사기·테스트 두 경로를 수정한다.

## Review Focus

1. C 외 코드/제품 파일이 C2에 섞이면 거부한다 — Task 3의 extra-path 음성 테스트.
2. A2 worker/write의 epoch/token/만료 또는 write→worker 회수 순서가 바뀌면 거부한다 — Task 2/3의 Event 음성 테스트.
3. 역사 C 실패를 성공으로 재분류하거나 B2 성공으로 소급하면 거부한다 — Task 3의 상태 음성 테스트.
4. private ref가 로컬보다 앞서거나 뒤처지거나 unavailable이면 거부한다 — Task 3의 원격 음성 테스트.
5. H2 뒤 보고가 제품/검사기/기존 보고 blob을 변경하면 거부한다 — Task 4의 tail 음성 테스트.

### Task 1: 진단 D1과 새 WI W3

**Files:** D1에서 `docs/WORK_STATUS.md`, `design_change.md`, 이 계획서 정확3; W3에서 새 `docs/work_orders/U-01_TASK4_POST_H4_C_GATE_RECOVERY_WORK_INSTRUCTION.md`, 새 Invocation, `docs/WORK_STATUS.md` 정확3.

**Interfaces:** C SHA와 실제 G-05 exit1을 입력으로 받아 D1/W3의 직접 부모·정확 경로·각 SHA 및 새 WI/Invocation SHA256을 산출한다. 기존 WI hash는 바꾸지 않는다.

- [ ] **Step 1:** D1의 정확3경로·C 직접 부모·C 실패 원문을 검토하고 단일 commit/private push, local/private/clean을 확인한다.
- [ ] **Step 2:** W3 WI/Invocation에 아래 A2/C2/B2/H2의 범위·Event 순서·hash·검증·rollback을 확정하고 Main의 `MAIN_RECONFIRMED_NON_SEMANTIC` 부모 승인 binding을 기록한다.
- [ ] **Step 3:** W3 정확3경로·D1 직접 부모를 검토하고 단일 commit/private push한다. W3 G-05 RED는 PASS로 기록하지 않는다.

### Task 2: epoch112 분리 dual lease A2

**Files:** `docs/progress/progress-events.json`, `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json`, `docs/WORK_STATUS.md` 정확5.

**Interfaces:** W3 SHA/WI hash와 기존 epoch111 active token·만료를 입력으로 seq2343 write revoke→2344 worker revoke→2345 WI issued→2346 worker issued→2347 write issued, epoch112 서로 다른 token·24시간·제품 scope0·검사기/통제 테스트 정확2 경로를 산출한다.

- [ ] **Step 1:** 원격·HEAD·dirty, Event raw prefix/chain, epoch111 token/만료와 새 WI SHA를 확인한다. 불일치 시 Event를 쓰지 않는다.
- [ ] **Step 2:** seq2343~2347을 append-only로 투영하고 snapshot/registry/HANDOFF/digest를 실제 byte에 재결박한다.
- [ ] **Step 3:** A2 정확5경로·W3 직접 부모·lease 순서/토큰/제품0을 독립 검토하고 단일 commit/private push한다. 새 route 전 G-05 RED는 준비 상태로 보존한다.

### Task 3: C2 실게시 단계와 활성 B2

**Files:** Developer 수정은 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` 정확2; B2는 progress/HANDOFF/digest/WORK_STATUS 정확4.

**Interfaces:** checker의 새 route는 frozen C/D1/W3/A2를 직접 부모·정확 경로·역사 blob으로 검사하고, C2에서는 canonical A2 projection이라도 HEAD=private C2 및 A2→C2 정확2 경로를 허용한다. B2에서는 `control_checkpoint=C2`와 C2→B2 정확4를 검사한다. 두 단계 모두 Event/lease/digest·미수락 상태를 별도 검증한다.

- [ ] **Step 1:** Developer가 C2 clean positive와 비C·extra-path·원격 불일치·역사 blob 위조 negative 테스트를 먼저 작성하고 실제 RED를 확인한다.
- [ ] **Step 2:** 같은 두 code 경로에서 최소 검사기 수정 후 focused/인접 회귀 GREEN, `git diff --check`, Main 독립 리뷰 Critical0/Important0을 확인한다.
- [ ] **Step 3:** C2 정확2경로·A2 직접 부모 단일 commit/private push 뒤 실제 local/private clean exact-SHA G-05 exit0을 확인한다. 실패 시 B2를 만들지 않는다.
- [ ] **Step 4:** B2 정확4문서에 C2 SHA·활성 seq2347 lease·미수락 상태를 결박하고 단일 commit/private push 후 B2 exact-SHA G-05 exit0을 확인한다.

### Task 4: H2 회수·WSL-server 동일 SHA 검증

**Files:** H2는 Event/progress/HANDOFF/digest/WORK_STATUS 정확5; 결과 보고는 신규 `docs/04_test_reports/U-01_TASK4_*.md`, `docs/WORK_STATUS.md`, 필요한 `design_change.md`만 별도 tail.

**Interfaces:** B2 G-05 PASS를 선행조건으로 seq2348 write revoke→2349 worker revoke, active lease0 및 U-01 미수락을 산출한다. H2 뒤 tail은 각 직접 자손의 WORK_STATUS 수정 필수·신규 보고 추가만 허용한다.

- [ ] **Step 1:** seq2348~2349를 append-only로 투영하고 B2 직접 부모/정확5/완료 lease·digest를 검토한다.
- [ ] **Step 2:** H2 단일 commit/private push 뒤 local/private clean exact-SHA G-05 exit0과 focused 회귀를 확인한다.
- [ ] **Step 3:** WSL-server 사전 등록 단일 격리 Git QA checkout에서 H2 exact SHA G-05/focused를 실행한다. 생성 전 이름·owner·수명·정리법을 WORK_STATUS에 기록한다. 실경로·symlink·process·dirty 확인 후 정확 checkout만 제거하고 잔여0을 확인한다.
- [ ] **Step 4:** 보고 tail 자체의 실제 private exact-SHA G-05를 재검증한다. Foundation R6 `STORED_ROW`와 전체 U-01 인수는 별도 작업으로 유지한다.

## Self-review

제품 범위 확대0, C RED 보존, code writer 단일화, 역사 Git/Event 불변, positive와 주요 위조 negative, 로컬·원격·WSL 동일 SHA 및 QA 자원 정리를 각 Task에 배치했다. 현재 문서는 실행 계획이며 D1/W3/A2/C2/B2/H2의 PASS 또는 승인 변경 자체가 아니다.
