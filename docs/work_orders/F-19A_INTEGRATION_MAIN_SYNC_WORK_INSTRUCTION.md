# WI-F19A-INTEGRATION-MAIN-SYNC-20261008-001

## 판정·기준

F-19A 로컬·WSL-server 범위는 Event seq2254에서 수락되었고, R48 역사 회귀 보완은 seq2259에서 종료되었다. 기존 branch `codex/f18-wsl-ops`의 종료 HEAD/private `5aafbafd`는 clean·G-05 seq2259 PASS다. private `main` 최신 `462c2e5b27823de2c1184f56f0fa9908a2cea328`는 같은 branch의 과거 PR #38 병합 커밋이며 현재 branch의 조상이 아니다. `merge-base..main`의 tree diff는 비어 있으나, 현재 G-05 종료 경로는 어떤 후속 merge도 거부한다. 이는 통합을 위해 필요한 Git 이력 관계 보완이지 제품 계약 변경이 아니다.

설계서 SHA-256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획서 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, 검증매트릭스 `9EE200DCE480497C4DE068963B546129F73679745C27846D593688455B2D38E8`, 테스트계획서 `C9C208709E71DB7F8769757AD77B5B51E854B0AB3AECAE89C39298C0C2615C8A`를 고정한다.

## 소유·범위

- Main은 이 WI·invocation, Event/progress/HANDOFF/detached digest/WORK_STATUS, Git checkpoint/push/merge/PR·독립 판정을 소유한다. Main은 Developer 코드 lease 동안 코드 파일을 수정하지 않는다.
- Developer actor `developer-primary-f19a-pair-grant`의 제품 write scope는 `[]`, 통제 코드 허용 경로는 정확 `scripts/check_project_progress.py`, `tests/tooling/test_f20_u01_r48_close_projection.py`다. 제품 코드, 기존 R48 overlay, 설계·계획, DB, WSL-server, 브라우저, 다른 branch/worktree, 문서·Git commit/push는 금지한다.
- Main은 닫힌 seq2259·private HEAD·clean/G-05 확인 후 새 epoch95 `WORK_INSTRUCTION_ISSUED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED`를 append-only 발급한다. 서로 다른 24시간 execution/write fencing token, WI hash와 exact2 경로를 양 lease에 결박한다. A 문서-only checkpoint의 private 동일·clean 전 Developer write 금지.

## 구현·검증

1. Developer는 기존 종료 G-05가 `main`의 비조상 관계/후속 merge를 거부하는 RED를 보존한다. epoch95 A(문서)→C(정확2 코드)→B(문서)→write/worker 회수(문서)→정확 `main` 병합과 PR 전 branch gate를 fail-closed 검증하는 새 route와 양/음성 테스트를 만든다. 기존 seq1~2259 Event 원문, F-19A 수락, U-01 제품 write 잠금, F-20 미수락, Release DEFER, Production NOT_EXECUTED는 불변이다.
2. 허용할 Git 통합은 현재 private `main` SHA `462c2e5b27823de2c1184f56f0fa9908a2cea328`가 실제 원격 최신이고, merge-base부터 `main`의 tree diff가 비어 있으며, 기존 작업 브랜치의 지정 close checkpoint가 merge first parent, `main` SHA가 second parent인 단일 정상 merge로 한정한다. merge 결과 tree는 first parent와 byte-for-byte 같아야 하고 제품/설계·기타 파일을 바꾸지 않아야 한다. SHA·parent·tree·remote·dirty·branch 위조와 다른 merge를 거부한다. `main`이 이 사이 변경되면 임의 합치지 말고 Main에 판정 자료를 보고한다.
3. PR Broker가 `main` 조상 관계와 현재 branch G-05를 검사하므로, exact merge 후 clean/private 동일 branch에서 G-05 PASS가 가능해야 한다. 실제 PR/merge 이후에는 `main`의 PR merge commit와 결과 tree를 검증하는 read-only smoke 경계를 명시한다. 기존 branch 삭제·새 branch 생성은 Main이 merged main/원격 복구를 확인한 뒤에만 한다.
4. Developer는 RED→GREEN 집중 테스트, F-19A/R48 인접 회귀, `git diff --check`, Ruff 변경 구간 신규0, 실제 A G-05와 임시 잔여0을 보고한다. Main은 독립 리뷰·필수 통합 Gate와 Web 타입검사/lint/build/test를 확인한다. Ruff 전체 기존 진단 exit1은 GREEN으로 주장하지 않는다. 신산님에게 내부 진행 승인을 반복 요청하지 않는다.
5. Main은 C→B→lease 회수→`main` 정확 merge→private push→G-05→PR Broker→merged-main smoke 순서로 진행한다. 각 체크포인트는 원격 SHA/clean과 통제 보고를 남긴다. PR 전 필수 gate 또는 Important 이상 finding이 남으면 병합하지 않는다.

## 완료·rollback

이 WI는 branch 통합을 위한 비의미 Git·검증 통제에만 적용한다. F-20/U-01·Release·Production 수락 또는 새로운 branch를 승인하지 않는다. 실패 시 기존 검증된 seq2259 HEAD/원격 branch와 append-only Event를 보존하고, merge 전에는 정상 `git merge --abort`만 정확 상태 확인 후 사용한다. force push/history rewrite/main 직접 개발/서버 직접 patch는 금지한다. 동일 근본 원인의 유효 Developer FAILURE_REPORT 3회 때만 Main 직접 인수한다.
