# WI-U01-TASK4-EPOCH107-POSTCLOSE-FIXTURE-20261010-001

## 판정과 기준선

승인 계약 B의 U-01 Task4 비제품 통제 복구다. 이전 epoch107 H2 `d6cf8be5608eeb3ce438353a8184bb9b2e55cc20`은 local/private와 WSL-server 동일 SHA의 G-05 seq2324 PASS였으나, 그 뒤 R `ee8647b2e6088e04099ab43fb38dfabd2e6048c5`의 WSL 결과 기록은 새 route가 없어 예상 RED다. R의 `U-01_TASK4_EPOCH107_G05_WSL_CONTROL_QA_RESULT.md` SHA-256 `32916FC16B3EC587297B00A690DD996DB913AA0A3A428C3CBFA5ACCEC14C8E17`, `design_change.md` SHA-256 `691250099C27782E4F2350089C226D673E376530B87692EAB4ACEB3A1DEDA8AE`를 불변 기준으로 삼는다. 현재 H2의 회수 lease를 과거 A의 활성 lease로 읽는 fixture 오류를 수리한다. 이 내부 수리는 기능 범위·요구사항·중요 위험을 변경하지 않는다.

## 소유·경계

- Main은 WI/Invocation, canonical Event·lease·progress·HANDOFF·digest·WORK_STATUS, Git checkpoint/push, 독립 판정과 WSL-server exact-SHA 검증·정리를 소유한다.
- 단일 Developer actor `developer-primary-u01-task4-epoch107-postclose-fixture`는 Main이 전달한 서로 다른 유효 worker/write fencing token, WI hash, clean/private A checkpoint와 정확 path scope를 확인한 뒤 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`만 수정한다. 이전 token이나 문서 미게시 상태에서 쓰지 않는다. Main은 유효 write lease 동안 이 두 파일을 수정하지 않는다.
- 제품/API/UI/DB/브라우저/Secret, WSL-server·ysna-server/Production, 과거 Event·보고서·설계변경, Git commit/push/PR/merge는 Developer write 범위 밖이다. 제품 write scope는 0이다.
- 기존 단일 `codex/u01-dashboard-r2`만 사용한다. 새 branch·PR/main 병합·U-02는 Task4 필수 검증과 수락 전 금지한다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`를 유지한다.

## 실패 폐쇄 계약

1. H2 seq2324/원문·Event chain·회수 두 lease/활성0, H2→R의 단일 조상과 R의 정확 보고/DC blob·실원격 SHA를 고정한다. R 이후 A의 WI→worker→write 순서, 24시간 분리 token/정확2/제품0을 검사한다. A 문서와 코드 C, C를 결박하는 B, write→worker 회수 H3는 각 commit의 허용 path, parent, 실원격 branch, dirty 상태, snapshot/registry/HANDOFF/digest 일치를 fail-closed로 판정한다.
2. epoch107 A `1b02af90491a957efaa3c95b90631d06f88d6a61`의 역사 fixture는 `git show <sha>:<path>`로 당시 입력을 읽는다. 현재 H2/R/후속 HEAD의 `load_bundle(ROOT)`이나 현재 lease를 과거 A 기대값에 섞지 않는다.
3. Event 원문 변조/누락/순서/이전 hash, token·actor·epoch·만료·경로 위조, H2/R blob 변조, 허용 외 path/merge·원격 삭제/불일치/전진·dirty, 거짓 제품 수락/Release/Production/U-02 해제 음성을 RED→GREEN 검증한다. 새 route 전 G-05 RED는 PASS가 아니며 오류 무시나 기존 validator 완화는 금지한다.

## 검증·종료

- Developer는 재현 RED, focused와 epoch105/107 인접 회귀, 활성 A G-05, `git diff --check`의 정확 명령·exit·결과를 Main에 보고한다. Main은 diff·실원격·독립 Critical0/Important0을 확인하고 C→B→H3 순서로 결박한다.
- 이후 WSL-server의 사전 등록 단일 격리 checkout에서 동일 SHA G-05와 focused를 실행하고 자원 잔여0을 확인한다. 전체79/기본 Windows fd-capture, Foundation R6 `STORED_ROW`, 전체 E-NET/E-API/E-AUD와 사용자 인수는 별도 검증이며 이번 통제 PASS로 대체하지 않는다.
- rollback은 이 successor만 정상 revert하고 H2/R·승인 계약·원격 복구 ref를 보존한다. 동일 정식 `FAILURE_REPORT` 3회면 Main 직접 인수한다.
