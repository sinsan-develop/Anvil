# U-01 실제 승인 요청 원장 계약안 / 2026-10-14

상태: **PROPOSED / HUMAN_DECISION_REQUIRED / PRODUCT_WRITE_NOT_AUTHORIZED**. 작성자 Main 어울. 현재 지시의 수행 범위는 계약안 작성까지이며 승인 기록이 아니다. 기준 `codex/u01-dashboard-r2` / `3ee62694ab6508265dba5b79247909c32117d530`, seq2429·임대0. 마지막 확인 WSL은 M19/sourceC19·DB0020이며 이번에 서버를 변경하거나 재검증하지 않았다.

## 목표·사실·선행 문제

- 설계29.2/U-01의 실제 승인 대기 요청을 정확 Project·Environment별로 저장·조회해 화면에 연결한다. 이미 완성한 `승인 대기 Run`은 별도 관측 정보로 유지한다.
- `approval_records`/ApprovalRecord는 승인된 결정의 ACTIVE/INVALIDATED/REVOKED/SUPERSEDED 기록이며 대기 요청·조합·요청 시각 원장이 아니다. 상태 WAITING_APPROVAL나 EventType EXECUTION_PLAN_PROPOSED만으로 승인 요청 수를 만들지 않는다. 기존 reducer는 artifact 종류·조건을 확인하지만 요청 대상 hash·만료를 모두 강제하지 않는다.
- 특히 `SqlAlchemyRunCreationRepository._authority`는 Run 생성 전에 EXECUTION_PLAN 승인까지 요구한다. 최초 요청을 기존 Run에만 종속시키면 승인 전 Run이 없어 요청을 만들지 못하는 순환이 된다. 최초 실행계획 요청은 **Task에 소속되고 Run은 선택 참조**여야 한다. 초기 구현은 EXECUTION_PLAN 요청으로 제한하고 실행모드 snapshot hash도 함께 고정한다.
- 현재 scoped Dashboard 계약 승인은 신규 schema/migration/지속 쓰기를 명시 제외한다. 실제 요청 생성 원본은 U-02의 지시·계획 흐름과 닿으므로, 아래 최소 backend 선행 절편을 U-01에 허용하는 범위 결정이 필요하다. U-02 메뉴·승인/반려·실행 권한을 몰래 앞당기지 않는다.

## 선택지

| 선택 | 기능·영향 | 판단 |
|---|---|---|
| A. 최소 실제 요청 원장과 읽기 연결 | Task에 귀속된 실제 요청 저장·내역·만료·정확 조합 조회를 선행 절편으로 구현. DB/지속 데이터·내부 쓰기 인가·현재 응답 확장 승인 필요 | **권고**. 요청 자체를 저장하고 조회하는 수직 기능을 완성하되 사람 결정·실행은 분리 |
| B. 승인/반려 버튼과 Run 재개까지 함께 구현 | 새 사람 인증·결정 권한·CSRF/replay/해시 이중 결박과 U-02 선행 구현 필요 | 현재 U-01 범위를 크게 넘으므로 비권고·이번 승인 대상 아님 |
| C. 현 상태 유지 | Run 대기 상태만 표시하고 승인 객체 카드는 UNAVAILABLE | 변경 위험은 낮지만 실제 요청 기능은 미구현으로 남음 |

## 권고 A의 데이터·생성 계약

1. 새 `approval_requests`와 append-only `approval_request_events`를 추가하는 migration을 별도 WI에 고정한다. 기존 approval_records·Run/Task·권한 원장의 의미·과거 Event는 변경하지 않는다. 요청 원장은 승인 증거가 아니며 저장만으로 권한·실행을 부여하지 않는다.
2. 요청의 필수 고정값: 서버 생성 request_id, task_id, project_id, environment_id, request_kind=EXECUTION_PLAN, plan_id/plan_hash, source WorkInstruction id/hash, execution_mode_snapshot_id/고정 snapshot/hash, requested_at/expires_at(UTC), 신뢰된 요청 주체, idempotency_key 및 canonical request_hash. run_id는 NULL 또는 해당 Task/정확 조합의 실제 Run만 허용한다. hash는 기존 `sha256:`+소문자64자리 규약을 사용한다. 임의 prompt·코드·Secret·DSN 원문은 요청 요약에 저장/노출하지 않는다.
3. 내부 생성 port는 `create_execution_plan_request(command, trusted_authority)`로 제한한다. 서버가 검증한 실제 Task→Project·등록된 정확 environment pair, 유효 WorkInstruction/검증된 plan/mode snapshot·기준 해시와 요청 주체의 해당 Task에 대한 계획 작성 권위를 같은 트랜잭션에서 대조한다. 최초 요청은 Run이 없으므로 Run lease를 선행조건으로 삼지 않으며, Run 재계획 요청은 기존 Run 소유권/fencing도 추가 검증한다. 대시보드 `dashboard:read` 또는 브라우저가 보낸 actor/pair만으로 생성할 수 없다. 실제 계획 작성 권위의 영속 검증 공급원·호출 주체 매핑은 실행 WI 전에 고정한다. 기존 권위로 검증할 수 없어 새 permission/principal/Secret가 필요하면 현재 A로 자동 생성·권한부여하지 않고 정확 대상을 추가 승인받는다. 새 공개 POST·임의 클라이언트 생성은 추가하지 않는다.
4. 실제 계획 수립 서비스가 승인 전 검증된 계획을 확정하는 경계에서 위 port를 호출해 REQUESTED 감사 사건과 요청을 원자 저장한다. in-memory fake만 붙여 완료하지 않는다. 기존 서비스에 해당 영속 경계가 없으면 그 연결을 구현 범위·실패조건에 명시하며, 권위가 없는 대체 호출/가짜 Run으로 우회하지 않는다. 상세 파일/기존 서비스 인가 adapter는 승인 뒤 WI의 읽기 조사에서 고정하고 추가 인가가 필요하면 다시 경계를 보고한다.
5. 동일 Task/정확 조합/고정 subject·mode hash의 재시도는 같은 요청을 반환한다. 같은 idempotency_key에 다른 내용은 conflict, 동시 생성은 unique/트랜잭션으로 단1건. 같은 subject에 여러 미해결 요청을 자동 누적하지 않는다. 대상 해시 변경은 기존 요청의 SUPERSEDED 감사 후 새 request_id를 사용한다.
6. 만료는 설계10.4대로 요청 시각+1시간. DB 관측 시각으로 PENDING/EXPIRED를 판단한다. EXPIRED는 승인·Run 실패·자동 실행이 아니며, 동일 계획이라도 새 요청으로 재요청한다. CANCELLED/SUPERSEDED는 내부 인가된 lifecycle 사건으로만 기록하고 실제 Run 상태를 이번 절편에서 변경하지 않는다.
7. 기존 approval_records에서 **이 요청의 정확한 subject hash와 mode hash**에 대한 유효한 실제 사람 승인 증거가 모두 확인되면 읽기 상태를 SATISFIED로 분류할 수 있다. 요청 원장/조회자는 승인 기록을 만들거나 authenticated_human=true를 붙이지 않으며, SATISFIED도 Runner 실행 권한이 아니다. 대상 hash가 바뀌면 INVALIDATED, 필요한 원본이 읽히지 않으면 UNAVAILABLE로 구분한다.

## 읽기·화면·보안 계약

8. 새 공개 URL은 만들지 않고 기존 정확 pair Dashboard GET의 `current.approvalPending`에만 원장을 연결한다. 기존 envelope/기간/기존 GET·Critical ACK는 불변. 요청마다 기존 actor·dashboard:read·정확 pair active grant 재검사 뒤 조회한다. 비등록/철회/다른 조합은 원장을 읽기 전에 거부한다. 원장 writer 권한을 reader에게 주지 않는다.
9. 같은 DB read-only/repeatable-read 관측에서 현재 PENDING 전체 모집단과 근거를 읽는다. 요청 대상/Task scope/hash/누락·중복·수명 불일치나 100건 초과 등으로 완전성을 증명할 수 없으면 count:null/UNAVAILABLE. 정상 완전 원본의 0건만 0으로 표시한다. 과거 요청에 구간을 씌워 현재 대기를 숨기지 않는다. 전체 migration 전·원본 장애도 UNAVAILABLE다.
10. 기존 metric 형식을 유지하고 AVAILABLE 때 `source:"approval_request_ledger"`, 서버 observedAt/reason:null/count와 bounded items를 추가한다. items는 requestId/taskId/runId|null/requestKind/planId/planHash/requestedAt/expiresAt만 노출하고 plan·mode 원문/주체 식별·비밀은 제외한다. sourceCompleteness는 정확 pair/CURRENT_OBSERVATION/complete를 결박한다. UI는 `승인 요청 대기` 수·요약·요청/만료 시각을 표시하고 실제 원본 실패/만료 자료는 성공이나 0으로 바꾸지 않는다.
11. 승인/반려/삭제/배포 버튼·외부 알림·자동 재개·승인 만료 후 권한 부여·실행모드 권한 변경은 제외한다. 다음 U-02의 사람 결정 기능은 별도 정확 권한/해시/CSRF 계약 없이는 시작하지 않는다.

## 구현 승인 후 검증·복구 경계

단일 Primary·좁은 WI/유효 dual lease·TDD·독립 검토를 사용한다. 정상 실제 계획 경계→요청 원자 저장→DB→인가된 GET→UI 재조회까지 핵심 검증한다. 재시도/경합/1시간 경계/취소·대체/다른 pair·철회/주체위조/대상·mode hash변경/부분 원본·비밀 노출을 확인한다. 코드 불변 전수검사·다기기·부하 반복은 하지 않는다.

개발은 로컬→기존 private branch→WSL Git exact SHA 순서. 새 migration은 격리 PG15에서 먼저 확인하고, 정식 WSL 적용 전 현재 DB·image·migration과 암호화 backup·복원 수단을 재대조해 생성전 자원·수명·정리를 등록한다. 정식 검증 자료는 식별 가능한 QA 명명 규칙·멱등 입력으로 분리하며 실제 Secret을 복사하지 않는다. 실제 요청 생성 port 없이 DB fixture만 넣어 성공이라고 하지 않는다.

복구는 승인된 이전 Web/API image로 되돌리되 생성된 요청·감사 이력을 자동 삭제하거나 파괴적 downgrade하지 않는다. 신기능을 UNAVAILABLE로 격리하고 데이터를 보존한다. 데이터 삭제·migration 강제 rollback은 별도 승인이 필요하다. Oracle/ysna/Production/예약/외부비용/PR·main 병합·새 branch는 이번 범위가 아니다.

## 필요한 정확한 결정

**A의 최소 backend 선행 절편을 U-01 범위에 추가하여, 새 요청 원장 schema/migration·실제 계획 경계의 영속 생성과 내부 쓰기 인가·기존 scoped Dashboard 응답 확장을 로컬/WSL에서 구현하도록 승인할지** 결정이 필요하다. 이는 B의 실제 사람 승인/반려·권한 부여·실행이나 운영 배포 승인이 아니다. 승인 전에는 계약안 문서만 보존하며 제품 WI/lease·코드·DB·권한·서버 변경0이다.
