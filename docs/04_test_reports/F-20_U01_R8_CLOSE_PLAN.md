# F-20/U-01 R8 Scoped Queue Source Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** R8 Queue source 내부 검증 뒤 canonical worker/write lease를 순서대로 회수하되 F-20/U-01 수락을 주장하지 않는다.

**Architecture:** R7 close의 append-only Event/progress/HANDOFF/digest/manifest 형식을 재사용하되 R8 발급 Event seq1840과 검증 기록 commit `b0752d89cfb5a7d8583eea6294f2fc3fd38878ca`를 predecessor로 고정한다. `WRITE_LEASE_REVOKED` 다음 `WORKER_LEASE_REVOKED`를 추가해 seq1842를 만들고 G-05의 새 mode에서 이 전이와 Git exact scope를 검증한다.

**Tech Stack:** Python 3.13, pytest, Git, G-05.

**Spec:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` §13 U-01, `docs/04_test_reports/F-20_U01_R8_SCOPED_QUEUE_SOURCE_PLAN.md`, `docs/04_test_reports/F-20_U01_R8_QUEUE_READ_RESULT.md`.

## Global Constraints

- 기존 `codex/f18-wsl-ops` 브랜치·격리 worktree만 사용한다. 새 브랜치, main 병합, ysna/Production 없음.
- R8 제품 세 경로는 변경하지 않는다. Main은 control/progress/status만 기록한다.
- 기존 seq1~1840 원문 byte 보존, R8 epoch21 정확한 token·lease ID와 동일 SHA 검증 증거를 확인한 뒤 회수한다.
- C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, F-20/U-01 미수락을 유지한다.
- 테스트 임시 자원은 이름·소유·수명·정리를 `WORK_STATUS`에 먼저 기록한다.

## Review Focus

- 잘못된 R8 token 또는 타 lease를 회수하는 전이를 거부한다: Task 1 전이/변조 테스트.
- seq1840 이전 Event 원문 변경을 거부한다: Task 1 prefix 테스트.
- F-20 완료나 C30 차단 해제 위조를 거부한다: Task 1 상태 위조 테스트.
- 검증되지 않은 Git descendant·범위 밖 dirty 파일을 거부한다: Task 1 Git 음성 테스트.
- 기한 만료·다른 checkout에서 회수를 실행하지 않는다: Task 1 preflight 테스트.

---

### Task 1: R8 canonical lease close

**Files:**
- Create: `scripts/f20_u01_r8_close_overlay.py`
- Create: `tests/tooling/test_f20_u01_r8_close_projection.py`
- Modify: `scripts/check_project_progress.py`
- Modify: `scripts/f20_u01_r8_overlay.py` (새 close control 파일만 허용)
- Generate: `docs/progress/progress-events.json`, `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`, R8 close digest·manifest
- Modify: `docs/WORK_STATUS.md`

**Interfaces:**
- Consumes: R8 `validate_control`, predecessor Git SHA `b0752d89...`, Event seq1840, epoch21 worker/write lease.
- Produces: `materialize(root, dispatch_head, at)`, `validate_control(root,bundle,now)`, `collect_git(root,progress)`; G-05 mode `F20_U01_R8_SCOPED_QUEUE_SOURCE_CLOSE`.

- [ ] **Step 1:** 전이·원문·차단 상태·Git 경계·G-05 route 테스트를 작성한다.
- [ ] **Step 2:** R8 close overlay 부재로 예상 RED를 확인한다.
- [ ] **Step 3:** R7 close 패턴의 최소 append-only overlay와 G-05 route를 구현한다. seq1841 write→1842 worker 회수, `active_agent=main-agent-eoul`, product scope 빈 목록, 완료한 R8 lease snapshot, 후속 U-01 작업만 표시한다.
- [ ] **Step 4:** focused 및 인접 R7/R8 control 테스트 GREEN, G-05·diff check를 확인한다.
- [ ] **Step 5:** predecessor local/private/WSL 동일 SHA·clean·lease 유효시간·C30 차단을 확인하고 materialize한다. G-05 PASS 뒤 기존 branch commit/private push, WSL 격리 checkout 동일 SHA G-05 확인한다.
- [ ] **Step 6:** 종료 결과·오류·미검증·다음 안전 행동을 `WORK_STATUS`에 checkpoint한다. U-01/F-20 전체 수락은 하지 않는다.

## Self-review

- 외부 공개 계약·DB·제품·권한 확대가 아닌 기존 R8 lease의 관리 종료다.
- 완료 판정은 이 내부 WI 종료에만 적용한다. R8 PG15 증거를 정식 E-SHOT/E-NET 또는 F-20 수락으로 승격하지 않는다.
