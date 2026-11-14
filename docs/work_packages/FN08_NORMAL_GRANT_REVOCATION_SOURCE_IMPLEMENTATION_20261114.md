# FN08 normal 허가 회수 source 구현 지시서

상태: MAIN_SOURCE_ONLY_GO. 2026-11-14 신산님 직접 응답 계약·source-only 구현 채택.
부모 후보: docs/contracts/FN08_NORMAL_GRANT_REVOCATION_CANDIDATE_20261114.md
고정 SHA256: 462D92B2429701077E9B9A8BDE26DCC68ACE8F31323A87ABF685FBC8A4EFC542
부모 원문은 승인 지문 보존을 위해 수정하지 않는다. 이 문서가 채택 기록이다.
기준 HEAD: 8e9a70067c5724c0f433e8fcac86984bf1edcaec
branch: codex/av3-fn08-revocation-contract

## 소유·제외
기존 developer_primary 단일 제품 writer. Main은 문서·검수·통합 담당이며 같은 제품 경로에 쓰지 않는다. 다른 작업자의 변경을 되돌리지 않는다. 추가 agent 생성 금지. 실제 DB·권한·키·사용자 파일 조사·설치·서비스·C#·Agent 실행 금지. 제품 source와 시험 읽기·Node/TS RAM 합성 검증만 허용한다. commit/push/병합은 Main이 수행한다.

## 정확 허용 7경로
- apps/server/modules/executions/normal-grant-revocation.ts
- db/migrations/0096_normal_grant_revocation.sql.pending
- apps/server/modules/projects/routes.ts
- apps/server/app.ts
- tests/unit/FN08/normal-grant-revocation.test.ts
- tests/unit/FN08/normal-grant-revocation-sql.test.ts
- tests/unit/FN08/normal-grant-revocation-journey.test.ts

신규 경로의 부재/소유를 확인한다. 기존0022와synthetic 제품·시험 원문은 불변이다. 새role/table/endpoint/권한 추가 금지. 다른 경로가 꼭 필요하면 이유와 실제 diff 경계를 Main에게 반환한다.

## 구현·검수 순서
1. 기존 정상/합성 경로·정확 request/receipt·정책·transaction 확인 후 누락된 normal 회수와 실패 조건의 RED를 기록한다.
2. 현재 회수자 OWNER/session/control과 원 grant 발급 주체를 분리하고 normal EXECUTION ACTIVE/EXPIRED를 회수한다. 원 grant 만료나 발급자 로그아웃을 현재 회수 권한의 만료로 쓰지 않는다. 최신 PROJECT APPLIED budget·명시 정책/REQUIRE_APPROVAL 거절·approvalRef null 유지.
3. 원 grant fullref/hash/실행세대/sourceScopes 잠금과 기존 명령/허가/영수증/감사/회수행 원자 저장. 기존 합성 guard를 normal로 전용하지 않고 정확 transport/state/status 조합을 분기한다. 동일signature 함수의 forward 보완으로 기존 권한을 유지한다.
4. 부모 후보의 normal 표식3개와 APPLIED/5개false를 정확 보존한다. 합성 영수증은 원형 그대로 재조회. 같은 명령/hash의 현재권한 재검산 뒤 원결과만 반환; 다른명령 이중회수409. OS current 호출0·grant/credential/writer 수정0.
5. COMMIT 오류/비정상tag는 기존 AccessRepository 연결오류반납 및 app503 STORAGE_FAILED/reconcile-first를 유지. 새AuthFailure 포장/자동retry/성공승격0. 실패 거래의 감사도 확정 회수 효과로 주장하지 않는다.
6. 실제 normal grant 생산자→다른 OWNER→회수→원영수증 재조회→기존 normal challenge 거절 RAM 여정. 만료/교차ref/옛세대/정책철회/동시중복/부분rollback/COMMIT응답유실을 포함한다. OS current는 호출 즉시 실패하는 대역으로0회검산.
7. 직접·영향 합성회귀·root typecheck·diff 확인 후 exact파일/지문/명령/exit/실제사례/미실행/오류횟수/live handle0와 함께 쓰기를 반환한다. 실제 SQL 동시성·역할·Windows·Agent는 NOT_RUN이다.

기능 의미나 권한을 늘리지 않는 내부 구현 선택은 Main 판단으로 진행한다. 전체 계획 완료로 올리지 않는다. 독립 검수는 제출 후 별도로 수행한다.
