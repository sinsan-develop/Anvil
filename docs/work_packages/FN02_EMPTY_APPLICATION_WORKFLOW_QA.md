# FN02 빈 프로젝트 적용 — 실제 workflow 격리 검수

2026-10-20 / Main 어울 / 기존 Stage B FN02. 준비 상태이며 아직 실행하지 않았다.

## 앞선 시험과 차이

첫 함수 시험(d9a56d1a)은 53 SQL 컴파일·함수의 한정 PASS이며 종료 자원은 회수됐다. 같은 canonical/graph 시험은 반복하지 않는다. 이번에는 동일 E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6 미적용 SQL을 새 빈 격리 DB에 구성하고 **실제 인증·Fastify API → 검토·확정 → 별도 적용 COMMIT → Web 조회 소비**를 확인한다. 정식 runner 등록·개발 DB 적용·서비스 변경은 없다.

- 실행기: `scripts/qa-fn02-empty-application.ts --workflow`, 시험: `tests/integration/FN02/empty-application-workflow-isolated.test.ts`.
- 기존 비관리자 app와 migrator의 임시 비밀은 이번 프로세스 메모리와 child env에만 전달한다. 두 합성 사용자와 세 로그인 client, 합성 project와 AUTO 정책은 새 QA DB 안에서만 생성한다. 실제 사용자 정책은 변경하지 않는다.
- 정책 부재, 미확정, 다른 사용자/client, stale source/세대, 중복 적용과 명령 내용 변경을 거절해야 한다. 확정만으로 적용하지 않는다.
- 정상 첫 적용/재시도 동일 결과·새 버전 두 명령 경합에서 단일 append·과거 snapshot 보존·현재 정책 회수 뒤 replay 거절을 실제 확인한다.
- 영수증만 저장한 transaction의 deferred COMMIT 실패/rollback, 적용 행만 직접 삽입 및 적용 행/명령 사후 변경 거절을 확인한다.
- 마지막에 적용본 2개와 7개 실행 관련 원장·outbox 0을 확인한다. 실제 Agent 호출은 없다.

## 생성 전 등록 자원·회수

이전 회수된 이름은 생성 직전 부재를 다시 확인하고 **새 빈 자원**으로만 사용한다. 소유 Main 어울/daon UID1000, label `AV3_FN02_EMPTY_APPLICATION_QA`와 새 instance nonce.

- Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`: 승인 private branch의 게시 exact SHA만 detached checkout한다.
- cache `/tmp/anvil-v3-fn02-empty-application-01`: 새0700 전용 npm cache. `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/anvil-v3-fn02-empty-application-01/npm-cache`만 사용한다. 이전 기본 공용 cache를 다시 쓰거나 정리하지 않는다.
- PG `anvil-v3-fn02-empty-application-pg-01`, network `anvil-v3-fn02-empty-application-net-01`, DB `anvil_v3_fn02_empty_application_qa_01`.
- image `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`, 실 ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e`/SINSAN.
- PG tmpfs256MiB·추가 mount/volume0·internal network·host port0. 정식 PG `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba` state/StartedAt/image/port와 Windows3830/5546은 전후 읽기로 비교한다.
- 수명20분/client10분/회수 별도2분. 성공·실패 모두 instance/정확 ID·image·mount·port·owner·realpath/nonlink/process를 대조한 등록 전용 자원만 회수하고 독립 조회 잔여0을 기록한다. 새 cache 경로는 필요하므로 실행기는 부재 대신 정확 UID0700/비링크 경계와 npm-cache 외 미등록 항목 부재를 검사한다.

## 제외·판정

이 시험의 양성도 실제 served UI·정식 개발 DB·초기 createProject 실행 회귀·7원장 각각의 직접 INSERT 경합·전체 FN02 완료가 아니다. 이들은 후속 핵심 검수와 화면 연결로 이어간다. 기존 특정 거절/0029/미채택 r2·권한/Secret/certificate/OS·운영/Oracle·실제 Agent/비용 변경은 없다. 실행 전 코드·SQL·시험 hash와 private exact SHA를 고정해 PMO에 위임 범위 판단을 요청하고, 그동안 source 보완을 계속한다.
