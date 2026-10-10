# WI-U01-TASK4-POST-H4-REPORT-SUCCESSOR-20261010-001

## 판정·기준

승인된 U-01 Task4의 **비제품 진행 통제 재작업**이다. H4 `91fa68b0092ebf56d8118b285499a3c88269df51`는 당시 G-05 seq2334와 WSL 집중 26건 PASS였으나, 직접 자식 QA 보고 R `8c56ffc966c585fd8164ab7b7b6fde6e27e99fd3` 및 계획 checkpoint P `fed668c6d58d5e452b457e139ea2cbe45b1413b4`의 최신 G-05는 `U01_TASK4_H3_REGRESSION_GIT_INVALID`다. R은 결과보고·`design_change.md`·`WORK_STATUS` 정확3, P는 후속 계획·`WORK_STATUS` 정확2 경로만 변경했다. H4의 PASS를 R/P에 상속하지 않는다.

신산님 승인 계약 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`, Task4 구현 계획, `docs/work_orders/U-01_TASK4_POST_H4_RECOVERY_PLAN.md`에 따른 Main의 비의미 내부 재작업이다. 기능 범위·요구사항·공개 API·DB·보안·중요 위험 변경은 없다.

## 소유·정확 write 경계

- Main은 WI/Invocation, Event·worker/write lease·progress/HANDOFF/digest/WORK_STATUS, Git checkpoint/push, 독립 검토와 WSL-server QA·정리를 소유한다.
- 단일 Developer는 Main이 전달한 현재 epoch의 서로 다른 유효 execution/write fencing token과 WI hash, clean/private A checkpoint를 확인한 후 `scripts/check_project_progress.py`와 `tests/tooling/test_u01_postmerge_control_projection.py` **정확 두 파일**만 RED→GREEN으로 수정한다. Main은 활성 write lease 동안 이 두 파일에 쓰지 않는다.
- 제품/API/UI/DB/브라우저/Secret, 과거 H4/R/P/Event·승인 원문, WSL-server·ysna/Production, Git commit/push/PR/merge는 Developer write 범위 밖이다. 제품 write scope는 빈 목록이다.
- 기존 단일 `codex/u01-dashboard-r2` 외 새 branch/worktree를 만들지 않는다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`를 유지한다.

## 구현·실패 폐쇄 계약

1. 기존 epoch109 H4 closed validator 및 과거 Event·Git blob 검증을 완화하지 않는다. H4→R→P→W(이 WI/Invocation 기록)→A(dual lease)→코드 C→활성 B→회수 H의 직접 부모 계보와 각 leg의 정확 허용 경로·실원격 SHA·dirty0를 검증한다.
2. H4의 seq2334/완료 lease, R의 보고·DC·현황, P의 계획·현황, W의 WI/Invocation·현황을 각 시점 Git blob으로 고정한다. 과거 `WORK_STATUS`/`design_change.md`를 최신 bytes와 혼합하지 않는다. A/B/H는 Event raw append-only chain, seq/시간, worker→write 발급과 write→worker 회수, token/epoch/만료, progress/HANDOFF/registry/digest/snapshot을 fail-closed로 묶는다.
3. 보고·계획 blob 위조, H4/R/P 역사 변경, 원격 ref 삭제·전진·분기, merge·허용 외 경로·dirty, lease token 교환/만료/순서 역전, 거짓 U-01 수락·Release/Production/U-02 상태 변경은 GREEN이 아니다. 기존 오류를 무시하거나 검사 의미를 완화하지 않는다.

## 검증·인계

- 현재 P의 G-05 오류를 RED로 보존하고 새 허용·위조 거부 테스트를 먼저 실패시킨다. 최소 route 뒤 focused 및 epoch109/108/107/105 인접 pytest, 활성 A G-05, `git diff --check`의 정확 명령·exit·결과를 Main에 보고한다. 전체 suite 또는 Windows 기본 fd-capture 미실행을 분리한다.
- Main은 정확 diff와 독립 Critical/Important 0을 확인한 뒤 기존 branch의 C/B/H를 단계적으로 게시·검증한다. H의 exact-SHA WSL-server 격리 G-05/focused 및 QA 자원 잔여0을 별도 확인한다. 본 통제 PASS는 Foundation R6·E-NET/E-API/E-AUD·U-01 사용자 인수나 PR/main 허가가 아니다.
- rollback은 이번 successor commit만 정상 revert하고 H4/R/P 원문과 사설 원격 복구 ref를 보존한다. Developer의 같은 근본 원인 정식 실패 3회에서만 Main 인수한다.
