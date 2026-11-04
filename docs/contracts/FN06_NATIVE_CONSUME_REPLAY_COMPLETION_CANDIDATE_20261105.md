# FN06 STREAM·CLOSE 소비 원결과 재조회 상세 후보

상태: DRAFT / NOT_ADOPTED / 이 delta SOURCE_GO0. 2026-11-05 Main 어울.

## 1. 부모와 실제 공백

부모 채택 패킷682A51DACA51FAD9525B4DB34AB62DCDD99B0D5DC63A2B1BCA1ACC211F2CA24E, wire6D1A727FB60298C4ADCC37CE5066B4032F144E6F42B8A0B74F023D8AF56E83F4, 계상F8667E17830B60791D769A288EC77C82E34649A952BFF9FAF4AE688BB32C1597는 보존한다. 부모는 같은 requestId/canonical의 소비 원결과·audit ref 재조회와 STREAM frame 재전달0을 명시한다. 그러나 STREAM 재조회 HTTP 형식/status·resultKind 매핑, native CLOSE 결과 원형과 terminal 후 현재성 대체 조건은 고정하지 않았다. HUMAN close/역사 GET은 별도이며 이 요구의 대체물로 축소하지 않는다.

기존 CONSUME_REPLAY는 resultKind(REF/STATE/CANDIDATE_ONLY/SECRET_NOT_REPLAYABLE), resultRef, resultCanonical, auditRef를 갖는다. 비밀 없는 원 제어응답은 기존16KiB 안에 보관할 수 있다. 별도 STREAM snapshot/StreamRef를 새로 만들 근거는 없다. 이 문서는 기존 필드의 미정 매핑을 결정하는 후보이며 현재 이미 구현·인수됐다는 주장이 아니다.

## 2. A안 — 기존 ReceiveState를 원 제어결과로 고정

- STREAM 최초 성공은 기존 점유 전환 시점의 ReceiveState를 불변 제어결과로 CONSUME_REPLAY에 저장한다. resultKind=STATE, resultRef=null, resultCanonical은 그 정확 원문이다. 별도 StreamRef/행/필드를 만들지 않는다. 기존 실제 수신 통로는 binary 응답으로 단 한 번만 제공한다.
- 동일 STREAM의 적법한 소비 재조회는 같은 GET에서 HTTP200/application/json으로 저장한 원 ReceiveState만 반환한다. 새 통로·frame·credential·opaque를 반환하지 않는다. 실시간 최초 응답의 binary와 content-type으로 명확히 구분한다. ReceiveState의 executionAuthorized:false는 불변이다.
- native CLOSE 최초 성공과 적법한 replay도 HTTP200/application/json의 원 ReceiveState(CLOSED)를 반환한다. private {terminal,state}와 실제 TERMINAL 행/역완결을 유지하되 이를 새 공개 wrapper로 노출하지 않는다. resultKind=STATE/resultRef=null, resultCanonical은 최초 저장한 state 원문이다. terminalRef는 기존 state 내부 fullref와 실제 TERMINAL에서 검산한다.
- auditRef는 해당 producer에 이미 요구된 정확 원 ref/명시 null을 보존한다. 새 감사를 자동 생성하거나 auditRef를 임의 null로 대체하지 않는다. 내부 replay 행의 outcome=APPLIED는 과거 원결과이며 새 효과가 아니다.
- observedAt/expiresAt/current.checkedAt·hash 등 원 state의 어느 값도 replay 때 현재 관측값으로 덮지 않는다. 접근 검사는 새로 하지만 반환 결과는 역사 원문이다. native client/controller는 JSON을 비권위 역사 결과로만 분류하고 stream/slot 수용·ARM·서명·후속 실행을 자동 시작하지 않는다. 별도 새 공개 wrapper/header/IPC는 추가하지 않는다.

대안 B는 STREAM 재요청을 기존409로만 거절하는 방식이다. 비밀 재전달 방지는 단순하지만 부모의 원 stored result 반환 요구를 만족하지 못하므로 Main은 A를 권장한다. B를 선택하려면 기능 축소로 별도 명시해야 하며 이를 구현 편의를 위한 완료 기준으로 사용하지 않는다.

## 3. replay의 exact 접근·원문·현재성

- 첫사용의 CHALLENGE_ISSUED 검산은 그대로 둔다. 별도 read-only 목적 replay 경로만 CONSUMED ticket의 정확 원결과를 읽는다. caller의 '소비 완료' 선언을 받지 않는다.
- SESSION 원행의 credential digest·원 불변 SID/actor/client/project/Window/generation을 관측하고 기존 auth family를 product 전에 잠근다. 기존 유효 로그인·OWNER/명시 정책·credential/control 세대·원 등록/profile/writer 관계와 기한을 검사한다. 첫사용의 권한 검사를 일반적으로 생략하지 않는다.
- 같은 원 ticket/requestId·canonical request/proof hash·원 PROOF_EVIDENCE의 signature bytes·challenge/target/body/fullrefs·CONSUME_REPLAY/resultCanonical/audit·실제 효과/TERMINAL 역완결을 다시 검산한다. 다른 signature의 재서명·다른 원문·다른 ID 소비는 허용하지 않는다.
- 원 Window/SESSION/challenge 및 해당 Offer/Arm·등록/profile/writer/HUMAN 허가의 기존 최소기한을 모두 지킨다. Binding/Delivery가 이미 있으면 그 원 만료와 원 native10초의 최소 경계도 유지하고, metadata replay로 이를 연장하거나 UNKNOWN 뒤 native 재요청을 허용하지 않는다. replay를 위해 nonce/서명/기한을 재발급하지 않는다. 부모기한이나 현재 접근이 불가하면 원 성공을 추정하지 않고 기존 고정 오류로 거절한다.
- STREAM replay는 최초 점유 전 OPENED/stream_owned=false 조건을 다시 요구하지 않는다. 그 조건 대신 정확 원 STREAM ticket 소비·점유 효과와 저장 결과의 closure를 검산한다. 현재 head는 같은 원 Window의 적법한 후속 비terminal phase(STREAMING/OFFERED/ARMED/BOUND/ATTEMPTED)여야 하며 후속 ref/효과의 역완결과 원 인증·등록/profile/writer·세대·최소기한을 유지한다. replay 때문에 stream_owned를 true로 돌리거나 통로/frame을 재개방하지 않는다. CONFIRMED/UNCONFIRMED/CLOSED 등 terminal에서 STREAM native replay를 새로 허용하지 않으며 그 역사는 기존 HUMAN 고정 GET 범위로 남긴다. 이는 본 후보의 명시적 현재성 선택이지 원 계약에서 자동 도출된 승인이 아니다.
- CLOSE replay에서만 첫사용의 active lifecycle 요구를 정확 CLOSED head+원 TERMINAL/result closure 검산으로 대체한다. close가 끝낸 stream_owned·수신 waiter의 생존을 실행 권위로 요구하거나 되살리지 않는다. 원 auth/정책/등록/profile/writer 세대·부모기한은 유지한다. 이 terminal read 분기는 새 첫사용·challenge 발급·키/원문 전달 권위가 아니다.
- 같은 실제 Pool Tx 소유·최종 현재성/기한 재대조를 유지한다. 적법한 동일 원문 replay는 새로운 nonce/ticket 소비·phase 효과·정산·감사/행 쓰기0이다. 위조·충돌·새 ID의 소진 ticket 시도는 기존 유한 거절 집계·감사 계약을 유지하며 생략하지 않는다. 원 소비와 경쟁 중인 불명은 별도 성공을 만들어 덮지 않는다. UNKNOWN 뒤 허용된 HUMAN 고정 GET 원칙도 바꾸지 않는다.

## 4. 저장·계상·오류·제외

기존 CONSUME_REPLAY의 STATE/canonical 저장과16KiB 상계를 사용한다. 행 수·표·입력 키·예약 typed maximum·timeout을 늘리지 않는다. 실제 canonical/JSON 이중 projection·used/held와 자기 숫자 폭은 기존 collector/refresh가 계산하며, 이 문서는 비용0을 단정하지 않는다. 기존 typed 상계에 들지 않으면 구현 전에 근거를 반환한다. OPEN의 SECRET_NOT_REPLAYABLE와 ACK CANDIDATE_ONLY는 변경하지 않는다.

공개 오류는 이미 채택된 wire §12의 exact {code,requestId,outcome}·고정 표를 따른다. 알 수 없는 예외·SQL/COMMIT/timeout은 OUTCOME_UNKNOWN503/UNKNOWN이며 원문을 반사하지 않는다. 이 기존 오류 준수 보완은 새 사람 결정 사항이 아니다.

코드·미적용 SQL·메모리 합성 검증만 제안한다. 실제 DB·권한 부여·키·서비스·Agent·C# 컴파일·J3/P03 R3·배포는 제외한다. 첫사용 네 phase·명시된 ARM/STATE replay와 ACK 이외의 기존 승인 구현은 계속한다. 이 후보와 ACK 입력 delta는 각각 별도 미채택이다.

## 5. 채택 시 단일 writer·정확 경로

기존 Primary 한 명이 구현하고 Main이 검수·통합한다. 아래13경로는 기존57의 부분집합이다. 추가 경로/새 module export/IPC/설정 권한은 허가하지 않는다.

- contracts/runtime/native-first-receive-v1.ts
- apps/server/modules/executions/native-first-receive-store.ts
- apps/server/modules/executions/native-first-receive-service.ts
- apps/server/modules/executions/native-first-receive-routes.ts
- db/migrations/0076_native_first_receive.sql.pending
- apps/connector/runtime/native-first-receive-client.ts
- apps/desktop/src/native-first-receive-client.cjs
- tests/unit/FN06/native-first-receive-contract.test.ts
- tests/unit/FN06/native-first-receive-store.test.ts
- tests/unit/FN06/native-first-receive-routes.test.ts
- tests/unit/FN06/native-first-receive-schema.test.ts
- tests/unit/FN06/native-first-receive-client.test.ts
- tests/desktop/native-first-receive-owner.test.cjs

## 6. 직접 검수 조건

정상 최초 소비와 동일 원문 재조회, 다른 request/proof/signature/target·원 state 위조, terminal closure 누락·회수/세대/기한 변경을 구분한다. replay의 새행·nonce·효과·기한 연장0과 저장 원문 동일을 검증한다. STREAM binary와 JSON metadata는 혼동하지 않고 JSON→frame/slot/자동 실행0을 확인한다. CLOSE replay는 정확 CLOSED에서만 허용하고 BOUND/ATTEMPTED/UNKNOWN을 CLOSED 성공으로 바꾸지 않는다. commit 유실을 재조회 성공으로 덮지 않는다.

TDD·직접 영향 회귀·type/build·독립 scoped 검수만 수행하고, 실제 PG/동시성/RLS·TLS·키-host/slot·Agent는 NOT_RUN으로 남긴다. source 합격을 전체FN06/계획 완료로 승격하지 않는다. 현재는 작성·검토 후보이며 사람 채택 전 이 delta 구현은0이다.