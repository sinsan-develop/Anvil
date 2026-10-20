# FN02 명시 forward helper 실제 등록 — 최소 격리 검수

2026-10-20 / Main 어울 / 신규 code-only 채택 checkpoint2b105481 이후의 직접 검수 준비. 현재 실제 실행0·새 자원0이다.

## 새로 확인할 범위만

`scripts/qa-fn02-empty-application.ts --registration`은 새 `tests/integration/FN02/method-application-registration-isolated.test.ts`만 실행한다. 앞선 함수/workflow/UI/compatibility/history를 반복하지 않는다.

1. parent가 기존 고정52 선행만 새 빈 QA DB에 구성한다. 기존 모드와 달리0031을 사전 적용하지 않는다. 정확52 ID/checksum·초기 guard 정의를 확인한다.
2. 새 helper가 호출자의 BEGIN/advisory lock 아래 실제0031을 적용해 해당 TX에서53행이 된 후 ROLLBACK한다. 별도 연결에서 원52행/column0로 돌아왔는지 확인한다.
3. 새 TX가 동일 advisory lock 아래 helper를 먼저 적용하고 COMMIT 전 유지한다. 두 번째 명시 호출이 같은 advisory lock SQL에서 선행 backend를 기다리는 것을 실제 pg_blocking_pids·pg_stat_activity.query로 대조한다. 첫 COMMIT 후 두 번째는 applied=false/DDL0이어야 한다. 실제 전달된 SQL을 수거·계수하되 SQL/credential 원문은 출력하지 않는다.
   별도 음성에서는 대기 관찰 뒤 강제 실패를 주입한다. 종료 차단→leader rollback→pending 수렴→follower rollback/release 순서로 follower helper 시작/DDL/COMMIT0·외부52/column0 복원을 확인한다. 정리가 follower TX를 먼저 닫고 그 뒤 작업을 재개시키지 않게 각 query와 COMMIT 전 종료 상태도 검사한다.
4. 최종 정확53 ID/hash/신규 column1·과거52행/초기 guard 함수 정의 불변, users/projects/methodology catalog/QA fixtures0을 확인한다. parent도 최종53 hash/초기 guard를 독립 재조회한다.

**한계:** 새 helper의 실제 COMMIT/rollback·호출자 advisory lock 재호출에 한정한다. 정식 CLI의 config/대상 검사를 QA DB 이름으로 위장하지 않으므로 formalCliExecuted=false다. 정식46→53/누락6개 자동 적용·실제 사용자 자료/권한·서비스 재개·실제 Agent·모든 후속 DB 객체 정의/파일 교체 경쟁·전체 FN02/Stage 인수 증거가 아니다. 기존 후보의 실제 기능 검수와 새 runner의 실행 검수도 구분한다.

## 후보와 자원 고정

- 기존 formal/pending SQL E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6/53manifest92C6489DEBEF44DC978AAA5654F161349D8349303D7D48B60B7FD6BBC80ED7AE. helper190441A5 불변.
- 시험 초기1842FCD0/원 독립 C0/I1/M0(실패 정리 뒤 follower TX 밖 DDL 가능)을 보존한다. 위 종료/수렴 순서와 실제 강제 실패 음성 보완 후 시험F73C7F0E04FB4EE18879F90C60ED81C84263CF58AA06798868AA91E0D7711D6D, scoped C0/I0/M0·type0. runner8A5550A24B4EDB75E97E0366B82B446E772A34B42148D7EEC20744C21ABC1BE4. 최종 지문·정확 게시 SHA를 WORK_STATUS/commentary에 고정한다.
- 직접 영향 대조에서 이전 history 시험의 같은 실패 정리 순서도 source만 보완했다(A72CC9B1B80912F2C22861BE812311F48412F0E01070EFFD39760AEEC4E9B08D). 이전15e436ad의 실제 성공 경합은 당시 증거로 유지하고 보완된 history 실패 경로는 actual 미검증이다. 이번 --registration에서 그 시험을 함께 실행하거나 양성/음성 PASS를 소급하지 않는다.
- WSL-server/daon UID1000/Main 어울/owner AV3_FN02_EMPTY_APPLICATION_QA+새instance/daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e(SINSAN).
- 새 빈 Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`, 새0700 tmp `/tmp/anvil-v3-fn02-empty-application-01`, npm cache는 그 하위 npm-cache만. 이번 범위의 artifact 원문 생성0.
- PG `anvil-v3-fn02-empty-application-pg-01`, internal network `anvil-v3-fn02-empty-application-net-01`, DB `anvil_v3_fn02_empty_application_qa_01`.
- postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425 / imageID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f / data tmpfs256MiB/추가mount·volume0/publish0.
- 생성 직전 literal 경로/PG/network 부재, 부모 realpath/nonlink/owner·process, daemon/image·정식PG fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba state/Started/Finished/image/5546 정의 및 Windows3830/5546을 실제 대조한다.
- 수명20분/client10분/test90초/회수 별도2분. 성공/실패 모두 정확 ID/instance/owner/image/mount/port 확인 후 runner 회수, Git/cache는 exactSHA/clean·소유/link/process/hash/inode/dev 확인 후 개별 파일/빈 dir 회수·별도 SSH 잔여0와 정식PG/포트 불변 확인.

정식 DB 접속/기존 보호 config 사용·SQL 실행/서비스·실제 계정 정책/Secret/cert·OS helper/PATH_GUARD·Agent/비용·미채택 계약/기존 특정 거절 해제0. 명시된 새 격리 검수이지 정식DB 실행 승인이 아니다.
