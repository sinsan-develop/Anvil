# U-01 Task4 H4 후속 통제·Foundation R6 원인 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Track each check with `- [ ]` and retain exact command/exit evidence.

**Goal:** H4 검증 결과를 최신 Git 상태의 fail-closed G-05에 결박하고, 별도 Foundation R6 `STORED_ROW` 실패의 정확한 단언을 확인한다.

**Architecture:** 기존 `codex/u01-dashboard-r2` 단일 브랜치의 H4→보고 R 계보를 보존한다. 먼저 비제품 G-05 successor를 별도 dual lease로 복구하고 종료한 뒤, 별도 WI/lease와 새 격리 WSL-server QA로 R6 원인을 분리한다. 두 작업 모두 U-01 인수와 독립이다.

**Tech Stack:** Python G-05/pytest, Git, Node/Playwright, WSL-server의 격리 PG15·OIDC·HTTPS·Chromium.

**Spec:** `Anvil_작업계획서_v1.md` U-01, `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` Task 4, `design_change.md` DC-U01-007/012/014.

## Global Constraints

- 로컬 개발 → 기존 브랜치 push → `ssh WSL-server`의 Git exact SHA 수신·격리 검증만 수행한다. `ysna-server`/Production/U-02/새 브랜치/PR/main 병합은 필수 gate GREEN 전 금지한다.
- 기존 H4 `91fa68b0092ebf56d8118b285499a3c88269df51`의 G-05 seq2334·WSL focused26 PASS와 최신 보고 R `8c56ffc966c585fd8164ab7b7b6fde6e27e99fd3`의 `U01_TASK4_H3_REGRESSION_GIT_INVALID`를 구별한다.
- 보고 R의 정확 변경 세 파일은 `design_change.md`, `docs/WORK_STATUS.md`, `docs/04_test_reports/U-01_TASK4_EPOCH109_H4_WSL_CONTROL_QA_RESULT.md`다. 보고 내용·과거 Event 원문·승인 계약은 수정하지 않는다.
- Main은 WI/Event/lease/상태/Git/WSL을 소유한다. 단일 Developer만 유효한 서로 다른 worker/write fencing token으로 허가된 code path를 수정한다. 제품 write scope는 후속 통제 Task에서 0이다.
- 실제로 실행하지 않은 전체97/Windows 기본 fd-capture, Foundation R6, E-NET/E-API/E-AUD와 사용자 인수는 PASS가 아니다.

## Review Focus

1. 보고 R을 H4 원문으로 위조하거나 보고 SHA를 바꾸면 G-05가 거부해야 한다: Task 1 음성 테스트.
2. 원격 ref 삭제·전진, merge·허용 외 파일·dirty 상태는 거부해야 한다: Task 1 음성 테스트.
3. lease 만료·token 교환·Event 순서 역전은 거부해야 한다: Task 1 음성 테스트.
4. R6 저장 경고가 `open`이고 화면에 ACK 버튼이 있으면 역사 control0 단언과 충돌한다: Task 2 정확 단언 진단.
5. R6 실패 단언 수정이 ACK·인가·감사 요구를 약화하면 안 된다: Task 2 회귀·독립 리뷰.

---

### Task 1: H4 보고 R의 G-05 successor

**Files:** Main의 신규 WI/Invocation·canonical Event/progress/HANDOFF/digest/WORK_STATUS; Developer의 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` 정확 두 경로.

**Interfaces:** frozen H4→직접 자식 R의 Git blob과 보고 세 파일 SHA-256을 입력으로 받는다. 활성 A→C→B→회수 H의 단일 부모·정확 변경 경로, Event raw/chain, lease, 실원격 SHA를 검사하는 새 G-05 route를 산출한다. 기존 route를 완화하지 않는다.

- [ ] **Step 1:** Main이 실제 branch/HEAD/private ref, H4→R 부모·세 파일 diff, 기준 문서 hash, active lease 0을 재확인하고 WI/Invocation·정확 통제 scope를 기록한다.
- [ ] **Step 2:** Main이 append-only Event로 별도 worker/write lease를 발급하고 A 문서 checkpoint를 기존 branch/private에 게시·clean 상태를 확인한다.
- [ ] **Step 3:** Developer가 보고 R에서 현재 오류를 재현하고, 새 route의 허용·위조 거부 테스트를 먼저 RED로 추가한다. 정확 두 code path만 수정한다.
- [ ] **Step 4:** Developer가 최소 successor route를 구현하고 focused/인접 pytest, `git diff --check`, A G-05를 GREEN으로 확인해 Main에 정확 명령·exit·diff를 전달한다.
- [ ] **Step 5:** Main이 독립 Critical/Important 0·회귀를 확인해 C/B checkpoint를 게시하고 write→worker lease 순서로 회수한다. 최신 H의 local/private clean G-05를 확인한다.
- [ ] **Step 6:** WSL-server에는 사전 등록한 단일 격리 Git checkout만 생성해 exact SHA G-05/focused를 실행하고 신원·realpath·symlink·process·clean 검증 후 그 checkout만 제거·잔여0을 기록한다.

### Task 2: Foundation R6 `STORED_ROW` 정확 실패 원인

**Files:** Main의 별도 WI/Invocation·증거/상태·lease; Developer가 후속 WI에 한정해 수정할 `tests/browser/f20-u01-oidc-browser-pg15.mjs` 및 필요한 정확 대응 test 경로. 제품 변경 여부는 진단 결과로 판정한다.

**Interfaces:** Task 1의 최신 clean G-05 SHA를 선행 조건으로 삼는다. 기존 WSL 실패 `R6_BROWSER_FAILED stage=STORED_ROW class=AssertionError`를 단언별로 구분하되 비밀·URL·원문 응답을 출력하지 않는다. 역사 기대와 현재 승인된 ACK 계약을 대조한다.

- [ ] **Step 1:** Main이 별도 WI/dual lease 전에 line 2247~2254의 세 단언, 현재 `CriticalAlertsCard`의 open 행 ACK 렌더, 설계 §29.2의 확인 버튼을 읽기 전용 대조하고 가설/미확정을 구분한다.
- [ ] **Step 2:** Developer가 단언별 안전한 고정 진단 marker 또는 실패를 식별하는 최소 회귀를 RED로 추가한다. 비밀·응답 본문·인증 토큰은 기록하지 않는다.
- [ ] **Step 3:** 새 exact SHA를 WSL-server의 사전 등록 격리 PG15/OIDC/HTTPS/Chromium에서 실행해 실패 단언을 확정한다. 실패는 PASS로 바꾸지 않고 자원을 정확히 정리한다.
- [ ] **Step 4:** 역사 단언이 현재 계약과 충돌한다면 실제 ACK 존재·권한/감사/Network 계약을 유지하는 최소 하네스 보정을 RED→GREEN으로 한다. 제품 회귀라면 제품 원인을 별도 판정하고 허가 scope 밖 수정은 하지 않는다.
- [ ] **Step 5:** Main의 독립 검토와 fresh exact-SHA WSL 재실행, 증거·자원 정리, lease 회수·G-05를 완료한다. 전체 U-01/E-* 인수는 별도 필수 증거가 모두 충족될 때까지 `NOT_ACCEPTED`로 유지한다.

## 현재 판정

이 계획의 작성은 Task 1/2 실행·검증 PASS가 아니다. 두 작업의 code write·WSL 자원은 아직 시작하지 않았다. Task 1 뒤 Task 2를 순서대로 진행하며 실패·미실행 범위는 `design_change.md`와 `docs/WORK_STATUS.md`에 실제 결과로 갱신한다.
