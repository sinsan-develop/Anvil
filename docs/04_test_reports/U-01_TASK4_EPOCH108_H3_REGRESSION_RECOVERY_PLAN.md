# U-01 Task4 epoch108 H3 집중 회귀 복구 계획

## 판정·목적

승인된 U-01 Task4 검증의 비제품 재작업이다. H3 `37323c39839f119137fc9b22502464034086189f`의 exact-SHA G-05 seq2329 PASS와 WSL focused `1 failed, 13 passed`를 분리한다. 보고 checkpoint `4c9aa475df4888e267e61e283424b0ebf9dc908c` 이후에도 실제 제품·사용자 인수는 `NOT_ACCEPTED`다. 목표는 합성 B/H3 fixture의 실제 registry hash를 맞추고 후속 보고/DC 기록을 과거 R 원문과 구분하는 fail-closed G-05 successor를 검증하는 것이다.

## 경계

- 기존 `codex/u01-dashboard-r2` 한 branch·기존 격리 worktree만 사용한다. 새 branch, PR/main, U-02, ysna/Production은 금지한다.
- Main은 계획·WI/Invocation·canonical Event/lease/progress/HANDOFF/digest·WORK_STATUS·Git/WSL QA를 소유한다. Developer는 새 유효 worker/write fencing token 발급 및 clean/private 문서 checkpoint 뒤 정확 `scripts/check_project_progress.py`와 `tests/tooling/test_u01_postmerge_control_projection.py`만 수정한다. 제품 write scope 0이다.
- 과거 R/H3 blob과 Event seq1~2329는 Git archive에서 원문 그대로 확인한다. 현재 `design_change.md`를 과거 R hash와 직접 비교하지 않는다. 대신 후속 보고/DC commit의 부모·정확 파일·내용 hash·실원격 head·dirty를 새 route에서 검사한다.
- 검사기 오류 무시·기존 route 완화·hash mock만으로 full-dispatch PASS 만들기를 금지한다. 테스트 fixture는 합성 Event 파일 SHA를 `_file_hashes`에 실제 결박하고 H3 registry mock을 제거한다.
- U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`; 전체 87건/기본 Windows fd-capture, Foundation R6 `STORED_ROW`, 전체 E-NET/E-API/E-AUD·사용자 인수는 별도 검증이다. `design_change.md` 기록은 이번 주기 진도 정리일 뿐 PASS가 아니다.

## 순서와 완료 조건

1. Main: 현재 문서 진단 보완을 정확 파일로 checkpoint/private push하고 clean SHA를 고정한다. H3→보고 R1→보완 R2의 단일 부모·정확 경로·원문 hash와 이전 H2→R→A→C→B→H3 계보를 확인한다. 새 WI/Invocation은 이 R2를 기준으로 동결한다.
2. Main: append-only Event에 WI→worker→write를 순서대로 기록하고 24시간·서로 다른 epoch109 fencing token·정확 코드2·제품0의 dual lease를 발급한다. progress/HANDOFF/digest/registry/snapshot을 일치시킨 A 문서 checkpoint를 기존 private branch에 게시한다. 새 route 전 A G-05 RED를 PASS로 표시하지 않는다.
3. Developer: 기존 WSL/로컬 실패를 RED로 재현하고, B/H3 합성 `registry_refs`와 `_file_hashes`를 실제 bytes로 일치시킨다. 이후 후속 보고 R1/R2→A→코드 C→결박 B→순차 회수 H4의 경로를 기존 fail-closed 보장과 충돌 없이 구현한다. 과거 R/H3를 Git archive로 검사하며 현재 보고/DC는 별도 leg로만 허용한다. 음성: 문서/과거 blob 변조, 잘못된 원격·dirty·허용 외 파일·lease/이벤트 순서·제품 수락 위조.
4. Main: Developer RED→GREEN·인접 회귀·독립 Critical0/Important0을 확인해 정확 코드2 C를 commit/push한다. C를 결박한 B의 clean G-05, write→worker 회수 H4의 clean G-05를 순서대로 확인한다.
5. Main: `ssh WSL-server`에 사전 등록한 단일 0700 격리 Git QA checkout에서 H4 exact SHA·G-05·집중 회귀를 실행한다. owner/realpath/process/clean을 확인해 해당 임시 checkout만 제거하고 잔여0을 기록한다. 실패하면 결과·`design_change.md`에 정확히 남기고 PASS로 승격하지 않는다. Foundation R6 `STORED_ROW`는 별도 정확 WI/lease로 이어간다.

## Rollback

후속 비제품 commit만 정상 revert하고 H3, R1/R2, 과거 H2/R/A/C/B 및 사설 원격 복구 ref를 보존한다. 과거 Event·보고서·승인 원문은 삭제·재작성하지 않는다.
