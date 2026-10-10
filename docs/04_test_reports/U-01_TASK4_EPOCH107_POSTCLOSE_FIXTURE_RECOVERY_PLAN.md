# U-01 Task4 epoch107 종료 후 역사 fixture 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Anvil의 단일 `developer-primary`·dual fencing token·Main 문서/Git 소유 규칙이 실행 방식을 결정한다.

**Goal:** H2 이후 현재 상태를 과거 A로 읽는 focused fixture를 불변 Git 증거로 고치고, WSL 결과 R 및 후속 통제 이력을 G-05가 fail-closed로 검증하게 한다.

**Architecture:** 동결 H2 `d6cf8be5608eeb3ce438353a8184bb9b2e55cc20`의 정상 G-05와 보고 R `ee8647b2e6088e04099ab43fb38dfabd2e6048c5`의 예상 RED를 구분한다. Main이 별도 비제품 epoch108 WI/dual lease를 발급하고, 단일 Developer가 기존 검사기/통제 테스트 두 파일에서만 RED→GREEN을 수행한다. Main은 코드 checkpoint→문서 결박→순차 lease 회수 후 WSL-server 같은 SHA의 집중 시험과 자원 정리를 독립 확인한다.

**Tech Stack:** Python 3.12+/pytest, Git/SSH `development` private remote, Windows 로컬 개발, `ssh WSL-server` 격리 검증.

**Spec:** `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` Task 4, `docs/04_test_reports/U-01_TASK4_EPOCH107_G05_WSL_CONTROL_QA_RESULT.md`, `design_change.md` DC-U01-013, 승인 계약 B 및 프로젝트 `AGENTS.md`.

## Global Constraints

- 기존 단일 `codex/u01-dashboard-r2` branch만 사용한다. PR/main 병합·branch 삭제·신규 branch·U-02는 필수 gate GREEN 전 금지한다.
- 로컬 개발→private push→`ssh WSL-server` exact-SHA 테스트만 수행한다. ysna-server·Production, DB·Docker·브라우저·제품 파일은 이번 비제품 복구 범위 밖이다.
- Main만 WI/Event/lease/progress/HANDOFF/digest/현황/Git을 쓴다. Developer는 유효한 분리 dual token 뒤 정확 `scripts/check_project_progress.py`와 `tests/tooling/test_u01_postmerge_control_projection.py`만 쓴다.
- 과거 Event 원문, H2의 G-05 PASS, R의 focused FAIL, U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`를 보존한다. 새 route 전·미게시/dirty/원격 불일치는 GREEN이 아니다.
- `design_change.md` 기록은 이번 주기 미진 정리이지 테스트 PASS·제품 수락 증거가 아니다. Windows 기본 pytest fd-capture `WinError 6`과 전체 79건 미실행을 별도로 남긴다.

## Review Focus

1. 현재 H2의 null lease를 과거 A fixture에 섞는 입력 → A의 불변 Git archive만 사용하며 현재 HEAD를 바꿔도 fixture가 안정적이어야 한다(Developer Task 2 음성).
2. R 보고·DC 바이트 또는 H2 Event 원문 변조 → hash/raw prefix 불일치로 G-05 실패(Developer Task 2 음성).
3. 실원격 branch 삭제·전진·갈라짐 또는 local tracking stale → G-05 실패(Developer Task 2 음성).
4. 새 epoch lease token 혼용·만료·경로 외 쓰기·write/worker 회수 역순 → G-05 실패(Developer Task 2 음성).
5. U-01 거짓 수락·Release/Production 실행·U-02 해제 → G-05 실패(Developer Task 2 음성).

---

### Task 1: Main의 비제품 실행 경계 발급

**Files:** Create `docs/work_orders/U-01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_WORK_INSTRUCTION.md`, `docs/work_orders/U-01_TASK4_EPOCH107_POSTCLOSE_FIXTURE_INVOCATION.md`; modify canonical Event/progress/HANDOFF/digest/WORK_STATUS와 이 계획만.

**Interfaces:** Consumes H2 clean G-05 seq2324와 R 실원격 clean SHA·보고/DC hash. Produces epoch108 WI hash, actor, 서로 다른 worker/write fencing token과 정확 code2 path scope/product0.

- [ ] R SHA·clean·보고/DC 실제 hash·H2 조상·Event seq1~2324 원문을 대조한다.
- [ ] WI→worker→write 순서의 append-only Event, 24시간 lease, 실행 경계와 R/A/C/B/H3 허용 경로를 문서화한다.
- [ ] A 문서 내부 projection·hash·raw chain을 독립 확인하고 같은 branch/private에 checkpoint한다. 새 route 부재 G-05 RED를 PASS로 표시하지 않는다.

### Task 2: 역사 fixture와 G-05 successor RED→GREEN

**Files:** Modify `tests/tooling/test_u01_postmerge_control_projection.py`, `scripts/check_project_progress.py`만.

**Interfaces:** Consumes Task 1의 WI/hash·epoch108 dual token·A clean SHA; produces 불변 A fixture와 새 active/closed validator·Git collector(오류 목록 반환). Main이 실제 C/B/H3 게시를 검증한다.

- [ ] `test_published_a_validates_with_exact_new_events_and_active_lease` 및 B/H2 합성의 현재 H2 재현 RED와 위 Review Focus 5종 음성을 먼저 기록한다.
- [ ] 과거 epoch107 A `1b02af90491a957efaa3c95b90631d06f88d6a61`의 `git show <sha>:<path>`로 fixture를 고정한다. 현재 H2/R/후속 HEAD를 검사 자료로 혼용하지 않는다.
- [ ] H2→R→A→C→B→H3 단일 계보·정확 허용 파일·실원격 SHA·dirty·Event raw/lease/effect·HANDOFF/digest·미수락을 새 route에서 fail-closed 검증한다. 기존 route 오류 무시나 완화는 하지 않는다.
- [ ] focused와 인접 epoch107/105 회귀, 실제 A G-05, `git diff --check`의 명령·exit·실결과를 Main에 보고한다. 기본 fd-capture 실패와 전체 미실행은 별도 표기한다.

### Task 3: Main의 checkpoint·WSL-server 실증·종료

**Files:** Modify canonical Event/progress/HANDOFF/digest/WORK_STATUS와 필요한 `docs/04_test_reports` 결과만. 제품 파일 수정0.

**Interfaces:** Consumes Task 2 동결 두 파일·독립 Critical0/Important0; produces C 코드 checkpoint, B 결박, H3 순차 회수와 clean/private G-05, WSL exact-SHA 집중 검증/자원 잔여0.

- [ ] 코드 diff·focused/인접·실원격·독립 검토를 확인해 정확 두 파일 C를 commit/push한다.
- [ ] C SHA 결박 B를 게시·clean G-05로 확인한 뒤 Event write→worker 순서로 H3 회수하고 H3 clean G-05를 확인한다.
- [ ] WSL-server에 사전 등록한 단일 격리 checkout에서 같은 SHA·G-05와 epoch108/수정된 epoch107 focused를 실행하고 정확 자원만 정리한다. 실패는 결과보고·`design_change.md`에 남기며 PASS로 승격하지 않는다.
- [ ] Foundation R6 `STORED_ROW`는 별도 정확 WI/lease로 착수한다. 이번 비제품 통제 PASS만으로 U-01 수락·PR/main을 진행하지 않는다.
