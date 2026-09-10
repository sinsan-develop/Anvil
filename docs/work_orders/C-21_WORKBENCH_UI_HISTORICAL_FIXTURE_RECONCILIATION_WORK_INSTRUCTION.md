# WI-C-21-WORKBENCH-UI-HISTORICAL-FIXTURE-RECONCILIATION-20260907-001

## 목적

`d059e043ff642c9f5eb50da8dda8aaa8f4ed8408` 이후 Workbench UI 전체 tooling에서 드러난 historical current-root 시간결합 18건을 immutable accepted commit fixture로 교정한다.

## 범위

- test-only 4경로와 이 Package의 append-only progress/evidence/checker 경로만 수정한다.
- seq1~578, 제품 코드, historical evidence·manifest·checker·상수는 변경하지 않는다.
- 과거 기대 hash를 현재 파일 hash로 갱신하거나 검증을 skip하지 않는다.
- 실제 Provider·Telegram, WSL, ysna, main, DB·Secret, push는 실행하지 않는다.

## 검증

- historical test 177개와 seq578/584 전용 계약을 통과한다.
- 전체 tooling이 exit 0일 때만 `READY_FOR_INDEPENDENT_REVIEW`로 기록한다.
- exact16, 누적183, direct-child, clean worktree와 seq1~578 raw prefix를 검증한다.

## rollback

commit 전에는 exact16만 복원하고, commit 후에는 seq584 단일 successor commit을 revert한다.
