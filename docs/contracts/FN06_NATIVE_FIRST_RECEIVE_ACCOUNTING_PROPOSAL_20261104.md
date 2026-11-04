# FN06 같은-client 최초 수신 계상·감사 admission 제안

2026-11-04 · 읽기 조사 담당 어울 · Main 통합·독립 검토용

**DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0**

이 문서는 신규 수신 계약의 기술 제안이다. 제품·SQL·시험 구현, 실제 키·CA·권한·DB·서비스·Agent·외부 통신을 승인하지 않는다. HTTP/IPC/wire의 상세 소유자는 별도 담당자이며 여기서는 중복 정의하지 않는다. 기존 source·보호 guard·실제 NULL/종료시각·숫자 타입을 보존한다. 앞 검토에서 기각된 물리 숫자의 32자리 문자화, 미종료 closed_at에 가짜 시각 저장, 임의 60회 admission은 채택하지 않는다.

## 1. 기준과 실제 생산자

- 부모: FN06_NATIVE_SAME_CLIENT_CLOSURE_DETAIL_CANDIDATE_20261104.md, 최초 수거 SHA256 965288705a4209c4c08e6c3c342e806eb05bfc355205fce8264c1c2130c59c37와 같은 파일의 후속 기술 대조. 부모도 미채택이다.
- 기존 N: contracts/runtime/native-preparation-authority-v1.ts의 nativeLimits/eventFields/receipt parser; apps/server/modules/executions/native-preparation-store.ts의 capacity/insert/append/read.
- 실제 생산: project-native-preparations.ts:77~85의 원 명령/intent/receipt/writer/credential/authority; :99의 challenge; :104~106의 proof/consume; :109~113의 ATTEMPTED/terminal.
- SQL: 0071_native_preparation_authority.sql.pending의 두 N표·canonical_bytes·history/capacity/row/deferred guard. 기존 capacity는 현재 actual만 합산하며 N 전용 future producer가 없다.
- 공통 L: access/project-command.ts:159~174의 persistProjectReceipt, :176~181의 recordProjectDenial; 0011_authorization.sql의 commands/authorization_receipts/audit_events.
- 비교 근거: 0073_control_handoff_acceptance.sql.pending:260~299는 예약행 자기비용 actual과 미생성 metadata held를 나누고 물리 projection을 역검산한다. 그 함수의 허용 operation/권한을 receive에 전용하지 않는다.

행번호는 작성 시 읽기 위치이며 이후 수정 때 실제 symbol로 다시 찾는다. 제품 source의 기존 완료 판정이나 실PG 검증을 이 문서가 대신하지 않는다.

## 2. 계상 단위와 물리값 보존

B_N은 기존 nativeBytes가 사용하는 wrapper의 canonical UTF-8 bytes다. N actual의 정의와 기존 상한을 바꾸지 않는다.

B_P는 신규 R/L/reservation의 폐쇄된 행 projection의 canonical UTF-8 bytes다. projection은 table/schemaVersion과 필드 목록을 명시하며 물리 typed값을 보존한다. 숫자는 숫자, 실제 NULL은 NULL, 실제 종료시각은 종료 뒤 생긴 값으로 투영한다. 날짜만 명시된 공통 UTC 정밀도로 정규화한다. 이름·값을 덧붙인 자유 JSON으로 필드를 숨기거나 NULL을 미래시각으로 대체하지 않는다.

projection마다 필드 type/최대 UTF-8 길이·안전정수 범위·nullable 조건·허용 enum을 고정한다. 미래 상한 M(P)는 각 필드가 허용하는 가장 긴 canonical 표현을 합한 값이다. M은 물리값이 아니라 예약 검산용 식이다. 예를 들어 nullable ISO 시각은 현재 NULL을 그대로 B_P에 넣고, 미래 시각 표현과의 최대 차이만 held로 보유한다.

프로젝트 한도10GiB, 기존 N 10000행/64MiB와 event16, 기존 guard의 exact parser·원10초/min-only·전달1회·UNKNOWN 재시도0·자동삭제OFF를 유지한다. 신규 R의 한도/원형은 부모 미채택 제안으로 분리한다. 논리 계상량이 PostgreSQL heap/index/WAL의 물리 용량이라는 주장은 하지 않는다.

## 3. 초기 N7과 후속5의 선예약

현재 정상 생산선은 authority1와 AUTHORITY_CREATED, DELIVERY_ATTEMPTED, terminal1, CHALLENGE_ISSUED, REQUEST_PROOF_ACCEPTED, CONSUME_COMMITTED의 event6으로 총7행이다. 실패·미도달은 그 부분집합이며 미래 enum/생산자 추가는 별도 차분이다.

실제 authority/CREATED 저장 전에는 다음을 예약한다.

Q_N_initial = M(authorityWrapper) + M(createdEvent) + Q_N_afterCreated

authorityWrapper는 기존 {ref,snapshot,preparationRef,preparationIntent}, createdEvent는 기존 {ref,snapshot}다. 서버가 검산한 실제 intent/subject/sourceScopes·policy·등록·factory를 사용한다. 아직 생성되지 않은 UUID/hash/ISO는 기존 고정 폭, credentialGeneration은 양의 안전정수 최대16자리, RESERVED writer head ref version은 최대16자리로 길이만 상계한다. caller bytes/count/verified 입력을 받거나 가짜 authority를 발급하지 않는다.

writer.reserveNativePreparation은 원 command/receipt가 선재해야 한다. 따라서 기존 writer 생산순서를 바꾸지 않고, 원 native 명령/receipt·writer·credential producer 전 같은 인증 Tx/프로젝트 잠금에서 신규 receive reservation을 먼저 확보한다. 원 승인 소비를 미리 수행하지 않는다. 실제 producer 반환이 예약 범위/원 current를 넘으면 Tx를 거절한다.

권위와 CREATED가 실제 저장되면 그 실제 canonical_bytes를 actual로 전환하고 해당 계획 항목의 미래예약을 감액한다. actual+미래가 처음 예약한 최대치를 초과할 수 없다. 두 N행 COMMIT 불명은 새 발급/전달 없이 hold를 보존한다.

고정 authority의 profile/ref 길이 C, registration/ref G, writer/ref W, credentialGeneration 자릿수 g, ACK/ref 길이 A를 사용한 후속식은 다음과 같다.

Q_N_afterCreated = 7394 + sequence자릿수합 + 3C + 4G + 4g + A + 2W

현재 sequence2~6은 합5다. 기존 fullref 최대153B·g최대16이면 최대8993B/5slots다. 신규 ACK v1을 채택한 경우만 A=138로 8978B다. 각 append에서 미생성 사건의 typed 계획을 소비한다. terminal은 CONFIRMED/UNCONFIRMED 중 큰 한 행만 예약한다.

authority/CREATED의 M은 실제 fixed intent와 정확 원형을 canonical 계상하여 구한다. 각각 snapshot2MiB/SQL wrapper4MiB 등의 기존 검사를 함께 유지한다. 임의 16×4MiB나 새 통상상수로 대체하지 않는다. 앞 식에는 새 R/L·예약 자기비용·writer 별도 원장이 포함되지 않는다.

## 4. 서로 겹치지 않는 actual/held registry

신규 보호 계획은 (namespace,table,primaryKey,projectionVersion,ownerAttemptId,ownerOperationId)의 유일 항목으로 행 소유권을 지정한다. 이 registry 자체가 저장되면 R에 그 bytes/행을 포함한다. 계획 ref/hash만 보관해도 해당 물리열 비용을 생략하지 않는다.

- N actual: 기존 authority/event wrapper canonical_bytes. 기존 N행을 R/L actual에 재산입하지 않는다.
- R actual: receive head/snapshot/binding/ARM/ACK/terminal/challenge/evidence/replay/ticket/reservation 및 선택된 보안집계의 행 projection.
- L actual: 신규 세 HUMAN 연산의 공통 command/authorization_receipt/audit; 적격 거절 audit; 원 native 공통원장의 미계상 실제부분.
- Q_N/Q_R/Q_L: 아직 생기지 않은 위 namespace별 계획 행의 bytes/slots. 기존 held에 이미 포함한 부분은 다시 더하지 않는다.

offer에 원 native command를 한 번 보관해도, 기존 native result_ref의 commandSnapshot/intent 복제는 별도 물리행의 실제 bytes다. 반대로 같은 commands 행을 기존 used와 L 양쪽에 더하지 않는다. 모든 기존 collector가 소비하는 범위를 실제 표로 대조한 뒤 L_out을 확정한다.

신규 HUMAN 성공 세 연산은 기존 helper 기준 각각3행, 총9행이다. result_ref는 기존 envelope+보호 ref/닫힌 status만 반환하는 미채택 제안이며 원 request를 자동 복제하지 않는다. data에 원문을 넣으면 그 차분을 재계상한다.

## 5. reservation self의 비순환 실제량·미래량

예약행은 기존 typed 필드·NULL·실제 시각을 보존한다. 필요한 후보 필드는 project/attempt/owner·불변 plan/ref/hash·phase·namespace별 reserved/actual/remaining 값과 실제 created/settled 시각이다. 권장 이름·타입은 이 문서 §11의 단일 스키마안으로 구체화하며 wire 문서의 소유를 침범하지 않는다. namespace별 actual/remaining summary는 자식 N/R/L 항목만을 뜻하며 예약행 자기 actual을 그 물리행의 summary에 재귀적으로 포함하지 않는다. A_self는 collector가 원 예약행에서 계산하는 값이며 자기 actual/self hash 열을 이 제안의 물리행에 추가하지 않는다. 이를 별도 저장할 후속 요구가 생기면 본 비순환식을 자동 적용하지 않고 정확 차분을 재검토한다.

비순환 규칙:
1. plan의 hash 입력에서 plan_hash 자체, 계산 결과 self_actual/self_max/total 같은 파생 summary를 제외한다.
2. M_self는 schema 필드별 최대식으로 산출한다. 파생 금액 필드는 실제 값 대신 기존 한도 안의 최대 숫자 자릿수로만 상계한다. 저장 타입을 text로 바꾸지 않는다.
3. plan entry 개수는 실제 typed 계획의 고정 최대행수로 상계한다. 자유 key·무제한 배열·자유 오류문자열을 금지한다.
4. 실제 예약행을 만들면 A_self=B_P(실제 물리행), H_self=M_self-A_self로 나눈다.
5. 현재 NULL인 settled_at/미래 phase·수치 길이 변동은 H_self의 책임이다. settled_at에 가짜값을 넣어 A_self를 고정하지 않는다.
6. 불변 plan을 유지한 정상 전이에서 새 A_self가 증가하면 같은 Tx에서 H_self가 감소한다. 허용 최대를 넘으면 성공0이다.
7. 총 추가점유는 A_self+H_self+다른 actual+다른 Q다. self를 R actual과 미래 Q에 중복으로 전액 더하지 않는다.

현재 self column의 값이 M_self를 직접 참조해도 식 계산은 그 값이 아니라 schema상 최대 자릿수에 의존하므로 수치고정점 반복이 필요 없다. plan에 자기 row hash를 내장하지 않는다. 검산용 self projection hash를 별도 저장할 경우에는 그 열도 고정 hash64의 비용을 포함하고 해당 자기 hash 필드만 hash 입력에서 제외하는 exact 투영을 별도로 명시해야 한다. 편의를 위해 새 hash열을 자동 추가하지 않는다.

최종 정착에서 물리행이 안정됐다는 근거·원 Tx/CAS·전부 actual/terminal/이력의 역완결을 확인한 경우에만 남은 self 여유를 반환할 수 있다. UNKNOWN·COMMIT 불명·미정착 IO에는 보유한다.


H_self는 이미 존재하는 예약행의 아직 발생하지 않은 표현 증가분으로서 Q_SELF라는 bytes 전용 분모로 구분한다. 새 물리행/행slot으로 세지 않으며 A_self를 다시 held에 넣지 않는다. 같은 row의 A_self가 이미 기존 used에 들어가면 R_out에서는 제외하고, Q_SELF가 기존 held에 들어가면 별도 합산하지 않는다. 검산 대상은 저장 summary가 아니라 실제 row projection의 A_self, 불변 schema/plan으로 재계산한 M_self, H_self=M_self-A_self>=0의 세 관계다.

collector 신규 접합은 필수다. 실제 account의 used는 각 disjoint actual projection 합계, held는 미생성 행의 Q_N/Q_R/Q_L와 Q_SELF의 합계에 정확히 대응해야 한다. head/row-count/별도 capacity callback만 성공시키지 않는다. 원 quota_complete 계열, environment/native capacity 계열, 신규 receive collector와 각 deferred 완결이 동일하게 이 관계를 재계산해야 한다. 다른 collector가 Q_SELF를 모르는 상태에서 선언 held를 임의로 가산하는 방식은 허용하지 않는다. 정산 후 NULL/실제시각/phase 변동으로 A_self가 바뀌면 원 account 잠금 아래 실제 row변경과 used 증감/held 반대 증감을 같은 Tx로 검산한다. 정확 schema와 기존 collector의 접합 diff가 없으면 이 자기비용안은 구현 준비 완료가 아니다.

## 6. 물리 역완결과 동일 Tx 전이

실제 namespace별 collector는 다음을 검산해야 한다.
- owner project/attempt/operation·원 principal·plan 항목과 실제 PK·정확 projection/hash/bytes.
- 중복 계획/actual, 계획 없는 actual, actual이 없는데 소비된 미래항목, actual과 Q 동시전액 산입을 거절.
- N의 기존 row/hash/history/deferred guard를 유지하고 새 R ACK와 N terminal의 cross-link를 별도 역검산.
- R binding과 원 native command/receipt/audit/authority가 동일 사실을 가리키는지 검산.
- L 성공/거절 audit와 R의 원 요청/hash·결과·phase ticket이 같은 소유인지 검산.
- head/phase/counter가 이력·실제행을 대체하지 않으며 새 표의 app raw수정/우회 helper로 guard를 열지 않음.

전이의 불변식은 actual_after+held_after<=예약전 확보한 총량이다. 실제 행 INSERT/기존 행 UPDATE, 실제 bytes 계상, 해당 Q의 소비·차감, head/CAS, audit/result와 정산을 같은 Tx에서 완료한다. append/정산 중 일부만 성공한 상태로 COMMIT하지 못하도록 실제 표와 command 쪽의 양방향 deferred 완결이 필요하다. 메모리 counter만으로 COMMIT거절을 증명하지 않는다.

## 7. phase에서 도출한 유한 ticket admission

새 수신의 고유 protocol ticket은 정확7개다.

OPEN, STREAM, ARM, ACK, STATE_1, STATE_2, CLOSE

한 ticket은 해당 phase의 challenge발급→proof소비→원결과를 소유한다. child HTTP 요청 수를 새 ticket으로 세지 않는다. 각 단계의 선재하지 않은 근거를 합성하지 않고, wire 담당자의 exact purpose/phase/null표와 대조한다. 일곱 ticket 외 임의 retry slot을 추가하지 않는다.

원 후보의 challenge 7회×5행은 issue-request evidence/challenge/issue replay/proof evidence/consume replay의35행이다. 권장 스키마는 §11.4의 독립 ticket7행으로 고정한다. 별도 ticket table을 선택하면 최대7행을 R에 추가하며 종전 R44를 그대로 유지했다고 하지 않는다. 이 문서는 독립 ticket행7개를 권장하는 미채택 분리안으로 둔다: 이전 부분합 R51(기존44+ticket7), L 성공9행에서 시작하되 현재 권장 전체 부분합은 Delivery/HUMAN거절을 포함한 §11.7의 R54/L19다. 실패감사/집계의 추가물리는 다음 절처럼 별도 명시한다.

HUMAN create-window/create-offer/close-window는 기존 후보 각1회의 별도 공통 명령이다. protocol ticket7과 혼합해 닫힌 것으로 세지 않는다. 그 원 request/result 재구성은 기존 R window/offer/terminal의 정확 metadata와 L command hash에서 검산하도록 제안한다. 생성 전 거절의 admission은 다음 절의 별도 선택이다.


7은 등록키 OPEN/STREAM/ARM/ACK/STATE_1/STATE_2/CLOSE의 프로토콜 논리 ticket 한도일 뿐이다. HUMAN window/offer/challenge/close 생산, 발급 요청 replay, 서명 proof evidence, nonce소비 replay의 물리행과 공통 원장이 자동으로7행에 들어가는 것은 아니다. 특히 HUMAN 최초 OPEN challenge와 등록키 challenge는 생산주체와 command/receipt/audit 생성 여부가 다를 수 있으므로 wire 원형/실제 handler 계약을 대조해 별도 계산한다.

| 생산 계열 | 별도 확인·계상해야 할 항목 |
|---|---|
| HUMAN window/offer/close | 기존 후보 각1의 원 command/receipt/audit 및 domain snapshot/head/terminal. 성공9행은 이 세 연산만의 조건부 L이다. |
| HUMAN 최초 challenge | 발급 command를 생산하는지, domain challenge·발급 replay·evidence를 어느 R항목에 소유하는지와 그 L여부. 원3연산에 포함하지 않음. |
| 등록키 phase별 challenge | 같은 ticket의 발급·소비 횟수 각각1이라는 제한과 실제 challenge/evidence/replay 행수를 따로 검산. |
| proof/nonce소비·응답 재구성 | 원 signature/requestHash/소비결과의 실제 저장행. 동일 요청 재조회는 원행 재구성이며 새행0이어야 함. |

따라서 기존 R44 및 별도ticket 추가 R51은 '일곱 phase가 각각 제시된5행으로 완결된다'는 부모 계산조건의 부분합이다. HUMAN challenge의 추가 생산/공통행과 denial/집계/새 registry projection이 닫히기 전 전체상한으로 사용하지 않는다. 이 문서는 HUMAN challenge를 제4의 성공 명령으로 자동 채택하지 않으며, 그 명령 존재 여부 자체를 wire 담당/Main의 미채택 결정으로 남긴다.

## 8. 인증후 적격 거절의 내구 감사

입장 검사는 원 인증·project/member/current·등록/profile·목적·기한·typed phase와 명확히 구분한다. 인증후 해당 수신을 다룰 적격이 있는 요청을 단순 무저장 4xx로 숨기지 않는다.

ticket 입장 전 또는 최초 사용 전에 원 phase의 성공/거절 중 하나를 마무리할 audit/replay 비용을 선예약한다. 정상 성공과 적격 거절은 상호배타 terminal 결과이므로 이 분기는 max(성공경로량,거절경로량)로 잡되 동일 request가 여러번 새 감사행을 만드는 경로는 금지한다.

- 같은 requestId/같은 canonical hash: 현재 접근을 검사한 뒤 원 stored result/audit ref만 반환, 새행0·nonce재개방0.
- 같은 requestId/다른 hash: 성공/원저장을 덮지 않는 충돌. 최초 충돌의 유한 보안집계 반영과 그 저장결과를 명시한다. 무한 개별 감사 보장은 하지 않는다.
- 다른 requestId로 같은 phase ticket 재사용: 신규 단계가 아니라 포화/재사용 요청. 새 protocol ticket·credential·nonce생산0.
- admitted 요청의 적격 거절: 그 ticket의 닫힌 오류code/requestHash/원 evidence/result·내구 audit를 원 Tx에서 저장한다. body/비밀/원문로그0.
- 감사/예약/COMMIT 불명: outcome UNKNOWN·원id/hash/hold보존, 새결과·자동 재요청0.
- 포화 전 거절 결과의 저장여유가 없으면 해당 효과의 입장을 허용하지 않는다. 처리성공후 감사실패를 숨기지 않는다.

protocol ticket당 최대한번의 rejection audit를 별도 L에 둔다면 protocol rejection audit의 조건부 상한은7행이다. 이는 성공 공통원장9행과 다른 분모이며, HUMAN 세 연산의 거절/충돌을 포함한 전체상한은 아니다. 각 HUMAN 연산에 유일한 admission slot1을 별도 계약으로 연결하면 그 거절 audit는 최대3행이나, 생성 전 요청을 어떻게 묶는지와 재작성 정책을 채택해야 한다. 기존 helper의 무조건 recordProjectDenial을 그대로 호출하면 이 상한은 성립하지 않는다.

## 9. 포화·범위밖 적격요청과 유한 보안집계 선택

유한 저장에서 공격자의 모든 인증후 요청·고유ID·충돌을 무기한 개별 audit로 보장할 수 없다. 이를 '감사완료'라고 표시하거나 전부 무저장으로 버리는 결정을 숨기지 않는다. 다음은 신산님 채택이 필요한 선택이다.

권장 후보:
- admitted 고유 phase/HUMAN operation의 원 성공·적격거절은 개별 내구 원장으로 보존한다.
- 포화·중복충돌·고유 ticket밖의 동일 보호범위 적격요청은 별도의 유한 보안집계로 기록한다.
- 인증/프로젝트/범위 자체를 확인하지 못한 외부 입력은 보호 원장에 body를 남기지 않고 기존 비밀없는 오류를 반환한다. 해당 트래픽까지 개별 내구 감사했다고 주장하지 않는다.
- 보안집계 공급자 부재·저장불명·포화는 SECURITY_AGGREGATE_UNAVAILABLE/UNKNOWN 같은 고정 의미로 드러내며 신규 권위·단계효과0이다. 정확 공개 code는 wire 담당과 결정한다.

보안집계 권장 PK는 §11.6의 (project_id,registration_id) 하나로 고정한다. 원attempt나설치전후는새PK가아니라그동일범위에서관측한사유다. 자유 client/user/requestId를 행 key로 받아 새행을 무제한 만들지 않는다. 오류 분류도 닫힌 enum별 고정 필드로 둔다. 실제 first/last 관측시각은 NULL/실시각 그대로 보관하고, 안전정수 count가 상한에 닿으면 saturated=true로 '최소 이만큼'만 보장한다. wrap/reset·새행분할0·정확 무한횟수 보장0이다. 마지막 원 request 본문·IP·비밀·공격 문자열을 저장하지 않는다.

집계행의 current 실제량과 phase/count/nullable 시각이 바뀌는 최대여유도 선예약한다. count overflow/UNKNOWN 때 aggregate를 새행으로 우회하지 않는다. 집계에 기록된 포화가 개별 사건의 순번·해시 원문감사와 동등하다는 주장을 하지 않는다.

집계의 namespace/cardinality·필드·설치전/원window전 귀속·포화/저장불가 의미는 §11.6의 단일 권장안이다. 이 신규 감사·집계 정책의 채택과 보호 조회 공개 범위는 사용자 결정으로 남긴다. 이 선택 없이 전체 L/R 행수나 '모든 적격거절 감사'를 닫힌 것으로 쓰지 않는다. 임의60 admission/rate 상수는 두지 않는다.

## 10. source 구현 전 Main 결정·독립 검토

1. 권장 물리 schema/projection은 §11~13의 단일안이다. 실제 typed/NULL/종료시각을 보존하고 독립 ticket7행·project/registration 집계1행을 선택한다. 구현때 정하도록 미루지 않는다.
2. wire 고정 원형과 ACK SlotReceipt·Window.writerHeadRef·Offer/Delivery 복제·STATE occurrence를 동일하게 검산한다. 새 공개 필드는 임의 추가하지 않는다.
3. 새 저장/admission/거절 감사·포화 집계 정책을 사용자 채택 대상으로 제출한다. 그 전 SOURCE_GO0이며 기존 승인으로 대체하지 않는다.
4. profile 물리 FK와 공유 원장 계상은 §14의 두 표 단일 권장안으로 구체화한다. 신규 후보이며 현재 repository/권위가 구현됐다고 하지 않는다.
5. 실제 모든 used/held/N/R/L collector와 양방향 deferred/CAS의 요구를 문서로 독립 검토한다. 이 문서에서 제품/SQL/시험을 실행하지 않는다.

이 문서는 세 잔여 문제의 미채택 기술 제안이다. Main이 독립 검토·새 권위의 정확 채택 결정을 관리한다.

## 11. 권장 구체 스키마 R1 — 이 문서의 단일 권장안

이 절은 앞 절의 '정확 schema/projection은 후속 확정' 문구를 대체하는 권장안이다. 여전히 미채택이며 SQL 실행 지시가 아니다. wire는 별도 FN06_NATIVE_FIRST_RECEIVE_WIRE_PROPOSAL_20261104.md의 담당자가 소유한다. 이 절은 공개 payload를 임의 개정하지 않고 그 원형을 보관하는 내부 표/검산을 고정한다.

### 11.1 공통 타입·projection 규칙

p=project_id uuid. 모든 FK는 ON DELETE RESTRICT다. 원문 JSON의 numeric/ref/NULL은 바꾸지 않는다. 신규 불변 record의 version은 smallint CHECK(version=1), hash는 text CHECK(소문자64hex), phase/종류는 아래 닫힌 enum text다. bigint 카운터/금액은 0..9007199254740991 중 별도 열상한도 만족한다. byte금액은 프로젝트 한도10737418240 이하, N slots<=7, R 자식 slots<=53(물리 R54 중 reservation 제외), L slots<=23이다. 기존 credential/control/ref version은 원 양의 안전정수 상한을 유지한다.

실제 timestamptz는 원 서버 관측값이며 NULL은 그대로 NULL이다. 행 계상용 projection에서만 UTC 6자리 소수초 ISO(문자열 길이27/JSON문자열29B)로 정규화한다. 새 wire At은 기존 isoV1의 ISO24로 검산한다. DB의 실제 microsecond를 가짜 millisecond/종료시각으로 덮지 않는다. 이 두 표현의 역할과 bytes를 혼용하지 않는다.

P_table(row)는 이 절에 열거한 모든 물리열을 정확 이름으로 갖는 object다. nullable 열도 키와 null을 포함한다. record_json은 record_canonical을 기존 canonical parser로 복원한 값과 같고 record_canonical은 실제 canonical 재직렬화와 같아야 한다. L의 result_ref도 helper가 실제 보관한 전체 object를 그대로 투영한다. JSONB 표현/숫자/Unicode의 차이를 근거 없이 SQL fn01_json 재직렬화로 치환하지 않는다. DB 검사와 TypeScript reader가 원 text/hash/typed JSON 동등성을 함께 검산한다.

행 자체의 canonical_bytes/self_actual/hash를 재귀적으로 자기 projection에 저장하지 않는다. actual은 collector가 원행에서 계산한다. row 하나의 P는 한 namespace에만 속한다. M_table은 각 열의 닫힌 최대형을 P에 대입한 유한식이며 저장값을 padding하거나 NULL을 바꾸지 않는다.

### 11.2 native_receive_heads — window당 가변 head1행

열 exact:
project_id uuid, window_id uuid, original_session_id uuid, actor_id uuid, client_id uuid, credential_generation bigint, control_generation bigint, registration_id uuid, registration_version bigint, registration_hash text, connector_id uuid, connector_version bigint, connector_hash text, profile_id uuid, profile_version bigint, profile_hash text, local_attempt_id uuid, phase text, revision bigint, broker_instance_id uuid NULL, operation_fence uuid NULL, stream_owned boolean, session_record_id uuid NULL, offer_record_id uuid NULL, arm_record_id uuid NULL, binding_record_id uuid NULL, delivery_record_id uuid NULL, ack_record_id uuid NULL, terminal_record_id uuid NULL, created_at timestamptz, expires_at timestamptz, settled_at timestamptz NULL.

PK(project_id,window_id). FK project_id->projects(id), original_session_id->auth_sessions(id), (actor_id,client_id)->clients(user_id,id), (project_id,registration_id)->connector_registrations(project_id,id), (project_id,connector_id)->connectors(project_id,id). window_id 및 각 *_record_id는 아래 records의 (project_id,record_id)를 참조하는 DEFERRABLE INITIALLY DEFERRED FK다. kind가 올바른지는 deferred proof가 exact 검산한다. profile의 (project_id,profile_id,profile_version,profile_hash)는 §14 native_channel_profile_versions의 UNIQUE(project_id,id,version,content_hash)를 실제 FK로 참조하고 deferred proof로 PROFILE kind/installation/hash/current 적격을 검산한다.

phase는 wire의 WINDOW_PREPARED/OPENED/STREAMING/OFFERED/ARMED/BOUND/ATTEMPTED/CONFIRMED/UNCONFIRMED/CLOSED만 허용한다. UNKNOWN은 저장phase가 아니다. 최초 tuple/created/expires는 불변, phase/revision/owner점유·누적ref/실제 settled_at만 CAS로 갱신한다. revision은 원 safeinteger 안에서만 증가한다. expires 연장0·ref 삭제/교체0·중단 뒤 원 broker 재사용0이다.

(project_id,registration_id)에 phase가 terminal이 아닌 head를 최대1로 유지하는 partial UNIQUE를 둔다. 만료시각을 unique predicate로 쓰지 않는다. UNKNOWN/기한경과도 terminal확정 전에는 그 슬롯을 계속 점유한다.

### 11.3 native_receive_records — 불변 R 원문/증거

열 exact:
project_id uuid, record_id uuid, record_kind text, version smallint, window_id uuid, profile_id uuid, profile_version bigint, profile_hash text, ticket_phase text NULL, ticket_occurrence smallint NULL, human_operation text NULL, external_command_id uuid NULL, request_hash text NULL, content_hash text, record_canonical text, record_json jsonb, accounting_version smallint, created_at timestamptz,
session_record_id uuid NULL, offer_record_id uuid NULL, arm_record_id uuid NULL, binding_record_id uuid NULL, delivery_record_id uuid NULL, ack_record_id uuid NULL, challenge_record_id uuid NULL, issue_evidence_record_id uuid NULL, proof_evidence_record_id uuid NULL, result_record_id uuid NULL, terminal_record_id uuid NULL,
native_authority_id uuid NULL, native_event_id uuid NULL, native_event_version smallint NULL, native_command_id uuid NULL, authorization_receipt_id uuid NULL, audit_event_id uuid NULL.

PK(project_id,record_id), UNIQUE(project_id,record_id,version,content_hash), UNIQUE(project_id,record_id,record_kind). (project_id,window_id)->heads DEFERRABLE.각 R *_record_id는 (project_id,record_id)의 deferred FK. native_authority_id는 기존 native_preparation_authorities의 UNIQUE(project_id,id)를 참조한다. native_event_id/version은 기존 events의 PK(project_id,id,version)에 deferred FK를 둔다. command/receipt/audit는 각각 commands(id)/authorization_receipts(id)/audit_events(event_id)의 FK이며 project/주체/operation/실제 hash와 역참조는 별도 완결검산한다. 다른 프로젝트의 scalar ID만 FK를 통과했다고 허가하지 않는다.

ticket_phase/occurrence는 둘 다 NULL이거나 tickets PK의 (project_id,window_id,phase,occurrence)를 참조한다. human_operation은 wire 세 operation 중 offerNativeReceiveCommand/closeNativeReceiveWindow의 거절원형에서만 허용하고 나머지 record는 NULL이다. 모든 선택적 scalar는 kind별 exact null표로 제한한다. 해당 JSON의 ref/hash와 scalar 열이 다르면 거절한다.

record_kind의 닫힌 집합과 최대행:
- WINDOW/SESSION/OFFER/ARM/BINDING/DELIVERY/ACK/TERMINAL 각1: 최대8행.
- CHALLENGE/ISSUE_EVIDENCE/ISSUE_REPLAY/PROOF_EVIDENCE/CONSUME_REPLAY 각 ticket별1: 7*5=35행.
- HUMAN_DENIAL_OUTCOME: window가 존재한 뒤 OFFER/CLOSE 각각 최대1: 2행.
총 records 최대45행. kind/domain/window별 partial UNIQUE, protocol kind/ticket별 UNIQUE, HUMAN_DENIAL_OUTCOME/human_operation별 UNIQUE로 강제한다. 물리 command 성공과 동일 command의 거절동시저장도 deferred proof로 거절한다.

WINDOW/SESSION/OFFER/ARM/BINDING은 wire의 exact snapshot을 보관한다. DELIVERY는 authority:V<기존 NativeAuthority>까지 포함한 wire exact snapshot을 저장한다. fullref 권위가 없는 가상 Delivery로 비용을 숨기지 않는다. 원 authority 원문이 여기 다시 저장되는 실제복제분도 R actual이다.

ACK 저장 snapshot은 wire의 SlotReceipt 원형 그대로다. candidateRef=slotReceipt.ref이고 기존 N의 ACK fullref도 동일한 ref/hash를 사용한다. 별도 ACK_RECORD wrapper/ackId/공개 proofRef 필드는 추가하지 않는다. ACK JSON의 서명/nonce/binding/N terminal 관계는 아래 records의 서버 소유 물리 FK열과 exact deferred closure가 검산한다. 해당물리열과 NULL/실제시각 비용은 모두 P(row)에 포함하며 JSON hash를 바꾸지 않는다. 실제 opaque 수용은 원 private slot/owner 생산근거로 검산하고 caller의 true나 임의 commitment로 채우지 않는다.
TERMINAL snapshot 권장안 exact:
{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_TERMINAL',terminalId,windowRef,outcome:'CLOSED'|'CONFIRMED'|'UNCONFIRMED',nativeOutcomeRef:null|Ref,ackRef:null|Ref,commandRef:null|Ref,recordedAt}.
CLOSED에는 nativeOutcomeRef/ackRef가 NULL, CONFIRMED에는 실제 N CONFIRMED와 R ACK, UNCONFIRMED에는 실제 N UNCONFIRMED/ackRef:null을 요구한다. 원문 시각은 실제 후행 Tx/종료 시각이며 UNKNOWN을 terminal로 만들지 않는다.

ISSUE_EVIDENCE snapshot exact:
{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_ISSUE_EVIDENCE',evidenceId,windowRef,ticketId,requestId,requestHash,sourceKind:'HUMAN'|'RECEIVE',requestBody,recordedAt}.
requestBody는 wire의 해당 HUMAN OPEN challenge 또는 receive challenge exact body다. cookie/CSRF/bearer/원 session ID/비밀은 넣지 않는다. bearer 인증 사실은 원 head/principal 및 원 Tx 검사로 결박하며 서명되지 않은 발급 요청에 가짜 signature를 넣지 않는다.

ISSUE_REPLAY snapshot exact:
{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_ISSUE_REPLAY',replayId,windowRef,ticketId,requestId,requestHash,outcome:'ISSUED'|'DENIED',challengeRef:null|Ref,issueEvidenceRef:null|Ref,code:null|DenialCode,auditRef:null|Ref,recordedAt}.
정상발급은 실제 challenge/evidence, 거절은 code/내구감사 ref를 요구한다. evidence가 없을 수 있는 거절을 임의 정상값으로 채우지 않는다.

PROOF_EVIDENCE snapshot exact:
{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_PROOF_EVIDENCE',evidenceId,windowRef,ticketId,requestId,requestHash,proof,signature,recordedAt}.
proof는 wire ReceiveProof, signature는 P1363 64B의 canonical base64url86문자다. 저장 signature를 credential/secret과 혼동하지 않되 원문 일반로그/IPC에는 반환하지 않는다.

CONSUME_REPLAY snapshot exact:
{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_CONSUME_REPLAY',replayId,windowRef,ticketId,requestId,requestHash,outcome:'APPLIED'|'DENIED',code:null|DenialCode,resultKind:'REF'|'STATE'|'CANDIDATE_ONLY'|'SECRET_NOT_REPLAYABLE',resultRef:null|Ref,resultCanonical:null|string,auditRef:null|Ref,recordedAt}.
resultCanonical은 비밀없는 해당 원 제어응답/STATE의 canonical 원문으로 control 응답 최대16KiB를 넘지 않게 제안한다. OPEN credential/opaque43/frame원문은 넣지 않는다. 비밀은 재조회가 불가능하므로 OPEN replay는 원 session metadata ref와 SECRET_NOT_REPLAYABLE로 표현한다. 이 enum은 wire와 공유해야 하는 신규 선택이며 임의로 OPEN binary를 재구성하지 않는다.

HUMAN_DENIAL_OUTCOME snapshot exact:
{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_HUMAN_DENIAL',outcomeId,windowRef,operation,commandId,requestHash,code,auditRef,recordedAt}.
다른 새 command로 실패를 무한 재작성하지 않는다. OFFER/CLOSE의 최초 적격거절은 해당 logical attempt의 이 한 행을 점유하고 원형을 보존한다. 그 뒤 충돌/포화는 §11.6의 고정 집계다. 이 재작성 한계는 새 제품선택이며 기존 HUMAN 전역 정책을 바꾸지 않는다.

모든 record는 INSERT만 허용, UPDATE/DELETE/TRUNCATE는 app에 불허한다. ref.hash는 원 snapshot canonical에 결박하고 P(row)는 병행 record_canonical/record_json 및 모든 FK열의 비용을 모두 포함한다.

### 11.4 native_receive_tickets — 정확7행

열 exact:
project_id uuid,window_id uuid,phase text,occurrence smallint,ticket_id uuid,stage text,issue_request_id uuid NULL,issue_request_hash text NULL,consume_request_id uuid NULL,consume_request_hash text NULL,challenge_record_id uuid NULL,issue_evidence_record_id uuid NULL,issue_replay_record_id uuid NULL,proof_evidence_record_id uuid NULL,consume_replay_record_id uuid NULL,created_at timestamptz,finished_at timestamptz NULL.

PK(project_id,window_id,phase,occurrence), UNIQUE(project_id,ticket_id). FK window->head 및 위 record IDs는 deferred R FK다. phase는 공개 wire OPEN/STREAM/ARM/ACK/STATE/CLOSE이고 occurrence는 STATE만1/2, 나머지는1이다. 즉 공개 phase를 STATE_1/2로 바꾸지 않는다. stage는 UNUSED/CHALLENGE_ISSUED/CONSUMED/REJECTED의 닫힌 내부enum이다. 원 request id/hash 및 ref가 한번 생기면 교체0. finished_at은 실제 CONSUMED/REJECTED 때만 기록, 그 전 NULL이다. URI/body가 달라도 같은 ticket을 새로 만들지 않는다.

head 준비 때7행을 원 예약과 같은 Tx에서 생성하는 권장안이다. 티켓행7개와35개 자식행을 혼동하지 않는다. ISSUE_EVIDENCE와 replay까지 들어오는 것은 각 actual producer가 위45행중 해당slot을 실제 만들었을 때뿐이다.

### 11.5 native_receive_storage_reservations — 자기 actual 별도 계산

열 exact:
project_id uuid,window_id uuid,plan_version smallint,plan_json jsonb,plan_hash text,
n_reserved_bytes bigint,n_actual_bytes bigint,n_reserved_slots smallint,n_actual_slots smallint,
r_reserved_bytes bigint,r_actual_bytes bigint,r_reserved_slots smallint,r_actual_slots smallint,
l_reserved_bytes bigint,l_actual_bytes bigint,l_reserved_slots smallint,l_actual_slots smallint,
phase text,created_at timestamptz,settled_at timestamptz NULL.

PK(project_id,window_id), FK->head deferred. plan_version=1, phase=HELD/SETTLED, reserved>=actual>=0, 각 bytes<=10737418240, slots는 N<=7/R자식<=53/L<=23이다. UNKNOWN은 관측이므로 새 물리 phase를 추가하지 않고 HELD와 실제행을 보존한다. settled_at은 SETTLED 시 실제 DB시각, HELD는 NULL이다. actual summary는 자식행만 세고 예약행 자기 actual을 재귀 포함하지 않는다. self_actual/self_hash 물리열은 없다.

plan_json exact:
{schemaVersion:1,windowId,source:{authSessionId,userId,clientId,credentialGeneration,controlGeneration,registrationRef,connectorRef,profileRef},items:[{namespace:'N'|'R'|'L',table:ClosedTableName,slot:ClosedSlotName,occurrence:positiveSafeInteger,maxBytes:nonnegativeSafeInteger,maxSlots:0|1}]}.
items는 아래 부분합에 필요한 닫힌slot만 허용한다. N7 + R자식53(예약행 자기비용 제외) + L23 = 최대83항목이다. 미래 실제UUID는 slot별 guard/유일성으로 소유하며 caller의 임의PK/namespace를 받지 않는다. row 식별을 위해 새 자유 JSON registry 표를 추가하지 않는다. plan_hash는 이 불변 plan의 hash만이다.

M_res는 위열·items최대83개·닫힌 enum/최대scalar로 산출한다. 숫자는 bigint 원값을 보관하고 계상식에서만 최대11자리 byte금액/허용자리 slot을 사용한다. A_res=P(현재 row), H_res=M_res-A_res다. 실제 NULL/종료시각·phase/수치 길이 변동을 H_res가 담당한다.

head/ticket도 가변행이므로 같은 원리로 A_head/H_head 및 A_ticket/H_ticket을 보유한다. 별도 무제한 성장분을 숨기지 않는다. 수치 summary가 actual을 재귀 참조하지 않는지는 이 행뿐 아니라 head/ticket collector에도 적용한다.

### 11.6 native_receive_security_aggregates — window/설치 전 고정 귀속

열 exact:
project_id uuid,registration_id uuid,actor_id uuid,client_id uuid,accounting_version smallint,
pre_window_denials bigint,phase_denials bigint,request_conflicts bigint,ticket_exhausted bigint,owner_unavailable bigint,audit_capacity_failures bigint,unknown_observations bigint,other_denials bigint,
saturated_mask smallint,first_seen_at timestamptz NULL,last_seen_at timestamptz NULL,first_class text NULL,last_class text NULL,created_at timestamptz.

PK(project_id,registration_id). FK(project_id,registration_id)->기존connector_registrations(project_id,id), FK(actor_id,client_id)->clients(user_id,id). actor/client는 검산된 원 등록 requested_by/client_id와 정확일치하며 불변이다. accounting_version=1, count는0..MAX_SAFE_INTEGER, saturated_mask는0..255의 category별 bit다. class는 위8 counter에 대응하는 닫힌 8enum이며 자유 error/URI/사용자문자열을 넣지 않는다. first/last는 실제 관측시각, 최초미관측은 NULL이다. 첫값은 불변, last/수치는 같은 project/reg 잠금 아래 갱신한다. scope/principal을 caller JSON으로 선언하지 않는다.

신규 집계행은 현재 인증+실제 project membership+원 등록 owner/client·원 scope/hash/creation proof를 목적제한 reader로 검산한 후에만 해당 기존 project+registration PK에 만든다. 신뢰설치/localwindow 존재는 요구하지 않는다. 이전 auth session/등록이 회수된 사실을 감사할 수는 있어도 이 reader는 새 current/실행권위를 생산하지 않는다. 다른 project/등록의 원문·키를 열지 않고 기존 public guard를 완화하지 않는다. 원등록조차 검산되지 않은 입력은 이 보호집계의 적격범위가 아니다.

window 전 HUMAN prepare/OPEN challenge 준비의 적격거절은 이 PK의 pre_window_denials/해당class에 귀속한다. caller attemptId/commandId/시간bucket을 PK로 삼아 행을 늘리지 않는다. 같은 등록에 행1개, 프로젝트에는 실제 기존 등록 수와 R의10,000행/64MiB 중 작은 제한만 허용한다. 새로운 등록을 만드는 행위는 원 등록의 별도계약/비용을 거쳐야 하며 집계가 이를 생성하지 않는다.

집계 최초생성 전에 프로젝트계정/등록행을 잠그고 M_agg 전체여유를 확보한다. INSERT와 used+=A_agg, held+=M_agg-A_agg를 같은 Tx에 연결한다. window 예약표가 없다는 이유로 집계 성장예약을 생략하지 않는다. 해당 집계행 자체가 독립된 lifetime growth-reservation의 증거이고 account collector가 실행 가능한 private projection으로 M_agg/A_agg/H_agg를 재계산한다. 이후 집계갱신의 ΔA만큼 used와 held를 반대로 같은 Tx에서 조정한다.

카운터 최댓값에서는 그 필드와 bit를 유지/포화시킨다. wrap/reset·신규행 분할·기존감사 삭제0이다. 포화 후 정확 건수는 보장하지 않고 '최소 이 수 이상, 상세누락가능'을 명시한다. 저장불명·기한/계정검산불가에는 신규 효과0, N/R/L/집계 hold를 자동해제하지 않고 고정 SECURITY_AUDIT_UNAVAILABLE 또는 원 UNKNOWN 관측을 반환하는 신규 의미를 권장한다. 공개 code/status는 §13의 wire 고정code와 정착증거에 대응시킨다. 집계가 기록되지 않았는데 감사완료로 표시하지 않는다.

고정 집계행은 window R54와 별도이며 최초 등록당1행을 actual/growth에 더한다. 프로젝트 전체 row/bytes검사에서는 다른 receive 표와 합산한다. 기존 보안자료를 삭제하여 공간을 만드는 경로는 없다.

### 11.7 exact R/L 행수 부분합과 HUMAN challenge

한 window의 최대 R 물리행은 records45 + head1 + tickets7 + reservation1 =54행이다. 이54에는 위 domain Delivery1와 window뒤 HUMAN denial outcome2를 포함한다. project+registration 고정 집계1은 별도 공유분모다. 해당 집계가 이미 있으면 window당 다시 새행을 더하지 않는다.

HUMAN window/offer/close의 APPLIED 공통원장은 최대9행이다. wire가 Window/Offer V 전체를 result.data에 반환하는 권장안을 유지하므로 persistProjectReceipt가 그 원문, 특히 Offer.command를 L result_ref에 실제복제한다. ref-only라고 줄여 계산하지 않는다. 기존data.ref 중복도 실제외피에 포함한다.

HUMAN OPEN challenge body는 ProjectCommand envelope가 아니다. 이 권장안은 별도 commands/authorization_receipts를 위조하지 않고 R의 OPEN ISSUE_EVIDENCE/CHALLENGE/ISSUE_REPLAY를 생산한다. 이 인증후 mutation의 내구 HUMAN 발급감사1행은 audit_events에 source_kind='NATIVE_RECEIVE_HUMAN_CHALLENGE',command_id:null,operation_id:null,target_ref=실제challengeRef,scope_digest=서버가 원 session/window/requestHash/등록/profile을 결박한hash로 보관하는 새 목적제한 producer를 제안한다. 기존 일반 command guard나 임의 HUMAN grant를 우회하는 setter가 아니다. 현재 source에 이 producer가 없으므로 새목적 감사의 채택/정적접합이 필요하다.

protocol phase별 최초 적격거절 audit는 최대7행이고 ISSUE_REPLAY 또는 CONSUME_REPLAY 한곳만 그auditRef를 소유한다. window뒤 HUMAN OFFER/CLOSE 최초거절 audit는 최대2행이며 HUMAN_DENIAL_OUTCOME이 소유한다. 최초window전 거절은 고정집계로 귀속하므로 이2개에 포함하지 않는다. 반복ID/hash는 원결과 재조회만, 같은ID다른hash/새ID동일소진ticket은 집계다.

이로써 신규 L의 안전 부분상한은 성공9+HUMAN OPEN 발급감사1+protocol거절7+post-window HUMAN거절2=19행이다. 상호배타branch를 모두 더한 보수상한이다. 원 native command/receipt/audit3과 실제 승인소비가 있는 경우 기존 approval_consumptions1을 별도 L_out에 포함하면 최대23행이다. 원 approval request/decision이 이미 저장된 행은 다시새행으로 세지 않으며 consumed상태 변경의 실제차분을 기존 해당collector에 반영한다. 기존 writer 예약event/head의 actual/성장분은 writer namespace에 남기고 N7/L23에 포함됐다고 주장하지 않는다.

counter/집계가 담는 원window전 거절과 포화 후 반복공격을 개별L audit로 무한저장한다는 보장은 하지 않는다. 그 유한집계 전환 자체가 새감사정책의 채택대상이다.

### 11.8 canonical 최대폭과 Delivery 실제복제

모든 scalar 폭은 기존 UUID36/hash64/Ref(137+version자릿수)/positive safeinteger16/ISO24 및 계상timestamp ISO27로 닫는다. 새 record종류의 자유 reason은 허용하지 않고 wire 닫힌enum·기존 bounded native command만 소비한다. record_canonical은 아래 typed 원형의 실제 canonical text이며 그 자체를 임의16KiB로 절단하지 않는다.

- WINDOW/SESSION/ARM/BINDING/TERMINAL: wire/위exact storage원형의 각Ref·UUID·정수·시각·고정문자 합으로 M을 계산한다.
- OFFER: 원command canonical 최대2MiB + wire Offer 고정외피/refs/시각의 정확합. payload에추가로 원authority를 넣지 않는다.
- DELIVERY: 원 NativeAuthority snapshot2MiB를 보존한다. metadata6 M=312+g+G+C<=634B, authority없는 D0=1049+g+G+C<=1371B다. authority:V의 상한2,097,310B 및 키추가13B로 Delivery.snapshot<=2,098,694B, V<Delivery><=2,098,852B, uint32BE4+V+opaque43 frame<=2,098,899B다. 신규v1Ref/ISO24·기존G/C Ref<=153B 조건이며 Main 독립계산을요한다. 임의16KiB전체frame 제한으로 sourceScopes를 축소하지 않는다.
- ISSUE_EVIDENCE/PROOF_EVIDENCE: 원control/proof JSON의 실제 wire최대8192B + 서명86/식별/Ref/시각 exact외피. 이 외피까지 포함한 maximum을 계상하며 단순8192라고 쓰지 않는다.
- CHALLENGE/REPLAY/HUMAN_DENIAL_OUTCOME/ACK: 위exact 원형·wire SlotReceipt/STATE의 typed최대식. resultCanonical은 비밀없는 control결과 실제최대16KiB와 키/문자열escaping을 별도 산입한다. ACK202 candidateRef도 저장한 제어응답을 재구성할 때만 이범위에 포함하며 실제ACK/CONFIRMED증거와 혼동하지 않는다.

행 P에는 record_json object와 record_canonical text가 둘 다 존재한다. rawcanonical 길이 S를 그대로 하나의 물리JSON열 비용이라고 축약하지 않는다. canonical text는 그text를JSON문자열로계상할때 quote/backslash escaping이추가된다. 유효 canonical JSON text의 문자열 값길이 상계는 2S+2이며, 병행JSON object S와합쳐 최대3S+2+나머지typed열의고정합이다. 실제 collector는 원text를 실제JSON문자열로직렬화한정확길이를사용한다. authority를Delivery안에보관한S에도동일규칙을적용하여실복제·text/JSONB병행비용을누락하지않는다.

R54행의M은각kind고정개수와위typed식의합이다. R10,000행/64MiB·프로젝트10GiB에서 actual+future가상한을넘으면원형을축소하지않고시작전용량거절한다. 이절의값은논리canonical계상이며wire/buffer/heap/WAL의물리상한을동일시하지않는다.

### 11.9 collector/권한/실물완결 접점

신규 private 목적함수 후보:
- receive_projection(project,window): exact N/R/L 소유row registry와 P/B를 복원.
- receive_window_complete(project,window): plan/hash·모든FK/원문·실제소유·phase/역완결을 검산.
- receive_storage_totals(project): disjoint actual, 미생성slots/bytes, 가변행growth, reservation selfgrowth, securityaggregate actual/growth를 반환.
- receive_security_project_registration_scope(auth,project,registration): 위원등록전용audit principal을생산. caller bool/임의actor/유효current를반환하지않음.
이름은새 private기술후보이며공개API가아니다. app에범용raw SELECT/EXECUTE를열지않는다.

기존account used/held의소유분모와실제대조해이미계상된행을빼고receive소계만정확히연결한다. 접합대상은 NativePreparationStore.capacity,0071 native_preparation_capacity/connection_definition_capacity와environment_configuration_account관련최종collector,기존quota_complete계열·FN15계상,신규receive totals이다. 한곳의 callback만true로만들거나기존strict동등식에출처없는가산을하지않는다. 신규분모를모르는최종collector가하나라도남으면SOURCE구현인수0이다.

각새표 FORCE RLS,기존migrator소유·fixed search_path·PUBLIC EXECUTE회수원칙. app raw UPDATE/DELETE/TRUNCATE불허,records rawSELECT불허. command/HUMAN/등록키typed단일행동은동일auth원Tx와privateproducer에서최소권한으로만수행한다. 무제한 SECURITY DEFINER generic SQL이나raw principal setter는없다. 최종exact EXECUTE signature는구현WI에이목적하나씩매핑하고기존publicguard의조건을삭제하지않는다.

새records/head/ticket/reservation/aggregate와기존해당native/command/receipt/audit에양방향 DEFERRABLE INITIALLY DEFERRED 완결을연결한다. 원행만있고plan/증거가없는경우와반대도COMMIT거절이다. 실제role/RLS/잠금/DDL실행은이문서에서수행하지않는다.

## 12. Main/wire 공유 차이와 채택 경계

- 공개 STATE는하나이며DB ticket occurrence1/2로구별한다. wirephase를STATE_1/2로바꾸지않는다.
- wireWindow/Offer전체V 응답은L에실제복제한다. ref-only외피가정은폐기한다.
- Delivery에authority전체V를저장하므로R1행과그authority/text/JSONB실복제를추가한다. frame수치와ISO24·신규Refv1조건을wire담당과공유했다.
- wire ReceiveState/At·새 ACK저장record/CONSUME_REPLAY resultKind·신규 HUMAN challenge audit source_kind·SECURITY_AUDIT_UNAVAILABLE의공개매핑은Main이교차검토해야한다. 이문서가wire원문을수정하거나확정하지않는다.
- 권장표/컬럼/PK/FK·projection은위단일안으로구체화했으며'구현때정할것'으로넘기지않는다. profile물리FK와공유원장은§14의정확두표후보로대응시킨다. 기존권위나현재설치신뢰를추측하지않는다.
- 위신규저장/감사/유한집계정책과원window전거절의귀속은새제품채택대상이다. 신산님/Main 결정전DRAFT/NOT_ADOPTED/SOURCE_GO0/EXECUTION_GO0를유지한다.


## 13. wire 최종 정합과 폐쇄 plan enum 보완

이 절은 §11의 조건을 더 좁힌 단일 권장안이다. wire 담당이 반환한 고정본 SHA256 bfb77f2ff11211428f863836f04aa265efe07ff79a0c0b8da26e11ca1cd23762와 같은 계약의 Main 후속 정합을 기준으로 한다. 다른 담당자 파일은 수정하지 않았다.

Window의 writerHeadRef는 wire의 기존 Writer Ref로 실제 보관·L 재복제된다. 해당 M_Window에도 실제 ref 길이를 넣는다. Offer는 원 native command2MiB를 축소하지 않고 신규경로 외피 최대2293760B의 wire 제안을 보존한다. UNKNOWN 뒤에는 새 STATE/challenge mutation이 아니라 기존 HUMAN 고정 GET만 허용한다.

ACK 원형은 Main 권장에 따라 wire SlotReceipt snapshot 그대로다. candidateRef=slotReceipt.ref, 후행 N DELIVERY_CONFIRMED.ackRef도 그 실제 fullref다. ACK 별도 wrapper·새 ackId·공개 proofRef 키를 추가하지 않는다. 원 SlotReceipt contentHash를 바꾸지 않는다. 서버 소유 proof_evidence_record_id/challenge_record_id/binding_record_id/delivery_record_id/native_event_id 등의 물리열과 그 원행의 exact cross-proof를 ACK JSON 밖에서 결박하며 이 열들의 actual/nullable성장 비용을 P(row)에 포함한다. 미내구202 후보가 존재해도 ACK actual행은 원 후행 Tx COMMIT 전에는 없고 새서명/nonce소비로 재생산하지 않는다.

plan.items의 exact 열은 namespace,table,slot,phase,occurrence,maxBytes,maxSlots다. phase는 NULL 또는 OPEN/STREAM/ARM/ACK/STATE/CLOSE, occurrence는1이며 STATE 두번째만2다. 새 자유 table명·문자열slot·임의숫자를 caller에게 받지 않는다. 허용 조합은 다음 유한 product만이다.
- N: native_preparation_authorities/AUTHORITY1; native_preparation_authority_events의 CREATED/ATTEMPTED/TERMINAL/CHALLENGE/PROOF/CONSUME 각1, phase NULL.
- R: native_receive_records의 §11.3 kind45개 실제slot; native_receive_heads/HEAD1; native_receive_tickets/TICKET의 phase별7조합. reservation 자기행은 이자식항목에 넣지 않는다.
- L: HUMAN_WINDOW/HUMAN_OFFER/HUMAN_CLOSE는 commands/authorization_receipts/audit_events 각1; HUMAN_OPEN_CHALLENGE는 audit_events1; PHASE_DENIAL은 audit_events의 phase별7조합; HUMAN_OFFER_DENIAL/HUMAN_CLOSE_DENIAL은 audit_events 각1; NATIVE_COMMAND/RECEIPT/AUDIT는 해당 기존표 각1; NATIVE_APPROVAL_CONSUMPTION은 approval_consumptions0또는1.
위조합은 N7/R자식53/L23으로 최대83항목이다. 동일조합중복0이며 기존 U/O/N/R에 포함된 같은실제L행은 L_out에서 제외한다. maxBytes/maxSlots는 서버 typed식에서 재계산하고 선언값과 다르면 plan거절이다.

DenialCode의 닫힌 저장집합은 현재 wire 명확거절 code인 NATIVE_RECEIVE_INPUT_INVALID,AUTH_REQUIRED,NATIVE_RECEIVE_AUTH_REQUIRED,NATIVE_RECEIVE_PURPOSE_DENIED,NATIVE_RECEIVE_NOT_FOUND,NATIVE_RECEIVE_CONFLICT,NATIVE_RECEIVE_CONTEXT_CHANGED,NATIVE_RECEIVE_IN_FLIGHT,NATIVE_RECEIVE_EXPIRED,NATIVE_RECEIVE_REVOKED,NATIVE_RECEIVE_PROFILE_UNAVAILABLE,REAUTHENTICATION_REQUIRED,APPROVAL_BASIS_NOT_CURRENT,NATIVE_RECEIVE_WIRE_LIMIT,NATIVE_RECEIVE_ADMISSION_DENIED,NATIVE_RECEIVE_OWNER_UNAVAILABLE,NATIVE_RECEIVE_SOURCE_UNAVAILABLE다. 503계열은 실제효과전거절이증명된경우만 DENIED로기록한다. NATIVE_RECEIVE_OUTCOME_UNKNOWN은거절terminal이아니며 hold/원행을보존한다. 자유 SQL/예외message나 source body를 code로저장하지않는다. SECURITY_AUDIT_UNAVAILABLE이라는 내부설명은 공개code추가가아니며 wire의 NATIVE_RECEIVE_SOURCE_UNAVAILABLE/OUTCOME_UNKNOWN과 그증명된정착상태에 매핑하는 권장안이다.

필수 Main 선택은 새저장/집계·admission 감사정책의채택이다. profile물리repository와정적FK대응은§14의두표후보로구체화하며, 없는현재표를이미구현된것처럼보고하지않는다. 그외이문서가소유한head/records/tickets/reservation/aggregate의권장물리원형·PK/FK·projection은§11단일안으로고정했다. 실제구현GO나실DB적용을뜻하지않는다.

## 14. 보호 profile 두 표·공유 계상·회수 예약의 단일 권장안

상태는 DRAFT/NOT_ADOPTED/SOURCE_GO0/EXECUTION_GO0다. Primary와 Main이 검토 중인 보호 publisher/package anchor/불변 이력/CAS 원형을 이 절의 단일 후보로 대응한다. 두 문서는 상대 최종 hash를 재귀 포함하지 않고 최종 검토 패킷이 각각 고정한다. 새 공개 operation·공개 Profile/Head 필드는 추가하지 않는다. 실제 DDL/GRANT/키 발급·설치·서비스 실행은 하지 않았다.

### 14.1 정확 물리 원형과 관계

모든 NOT NULL/NULL은 다음과 같다. uuid는 기존 UUID, hash는 소문자64hex, version/generation/minimum은 1..9007199254740991 양의 안전정수다. DB timestamp의 실제 값은 §11.1의 UTC6 projection으로 계상한다. wire snapshot의 At은 기존 ISO24를 보존한다.

| 표 | exact 열(표시한 NULL 외 NOT NULL) | 키·성질 |
|---|---|---|
| native_channel_profile_versions | project_id uuid, installation_id uuid, record_kind text(PROFILE/HEAD), id uuid, version bigint, content_hash text, profile_id uuid, profile_version bigint, profile_content_hash text, state text NULL(ACTIVE/REVOKED), generation bigint NULL, previous_head_id uuid NULL, previous_head_version bigint NULL, previous_head_hash text NULL, anchor_canonical text, anchor_hash text, package_manifest_hash text, snapshot_canonical text, snapshot_json jsonb, created_at timestamptz | PK(project_id,id,version); UNIQUE(project_id,id,version,content_hash). 전 열 불변, UPDATE/DELETE/TRUNCATE 불허 |
| native_channel_profile_heads | project_id uuid, installation_id uuid, profile_id uuid, generation bigint, current_profile_version bigint, current_profile_hash text, current_head_id uuid, current_head_version bigint, current_head_hash text, minimum_profile_version bigint, anchor_hash text, package_manifest_hash text, created_at timestamptz, updated_at timestamptz | PK(project_id,installation_id); UNIQUE(project_id,profile_id). project/installation/profile/created_at 불변; 나머지는 검증된 publisher의 CAS만 허용 |

versions.PROFILE은 id=profile_id, version=profile_version, content_hash=profile_content_hash이며 state/generation/previous 세 열은 모두 NULL이다. HEAD는 새 id/version=1, state/generation 필수이고 previous 세 열은 전부 NULL 또는 전부 NOT NULL이다. ROOT HEAD는 generation=1/previous=NULL이며 후속 HEAD는 previous 필수다. 첫 publish는 PROFILE1+ACTIVE HEAD1+heads1, 후속 publish는 새 PROFILE1+ACTIVE HEAD1+기존 heads CAS, revoke는 REVOKED HEAD1+기존 heads CAS다. 제3 event표 없이 HEAD 불변행이 회수·교체 이력을 보존한다. 과거 ACTIVE 행을 UPDATE하여 회수한 것처럼 만들지 않는다.

실제 FK는 모두 ON DELETE RESTRICT, DEFERRABLE INITIALLY DEFERRED이며 다음 fullref를 받는다. kind/installation/generation/원문 동등성은 같은 Tx의 deferred exact closure로 추가 검산한다.

- versions.(project_id,profile_id,profile_version,profile_content_hash) -> versions.(project_id,id,version,content_hash), 대상 PROFILE. PROFILE 자신의 fullref도 이 관계를 만족한다.
- versions.(project_id,previous_head_id,previous_head_version,previous_head_hash) -> 같은 fullref UNIQUE, 대상 HEAD. NULL 그룹은 위 ROOT/PROFILE 규칙만 허용한다. 후속 previous는 동일 project/installation/profile의 직전 current HEAD이며 generation은 정확 +1이다.
- heads.(project_id,profile_id,current_profile_version,current_profile_hash) -> versions fullref, 대상 PROFILE.
- heads.(project_id,current_head_id,current_head_version,current_head_hash) -> versions fullref, 대상 HEAD. 해당 HEAD의 profile tuple/state/anchor/package/generation과 heads가 exact 일치해야 한다.
- native_receive_heads와 native_receive_records의 (project_id,profile_id,profile_version,profile_hash) -> versions fullref, 대상 PROFILE. records에는 §11.3의 NOT NULL profile_id/profile_version/profile_hash 세 열을 추가한다. 서버가 원 window tuple로 채우며 caller의 별도 profile 선택을 받지 않는다. records/root head/모든 해당 snapshot의 profileRef가 같아야 한다. 이 세 열의 실비용을 각 R actual/held에 포함한다. window R54 행수는 바뀌지 않는다.

project_id는 실제 projects FK다. installation은 새 native-profile 보호 설치 namespace의 id이며 runtime catalogue를 설치 권위로 재사용하지 않는다. 현재 후보에 별도 installation 물리표가 없으므로 존재하지 않는 installation FK를 꾸미지 않는다. 동일 project+installation의 유일 heads와 보호 package anchor 검증이 설치 tuple을 결박하는 권장안이며, 설치 namespace/발급·개정·회수 producer의 제품 채택이 필요하다.

### 14.2 공개 원형·보호 producer·완결

PROFILE.snapshot은 wire NativeChannelProfile 원형(schemaVersion,purpose,profileId,version,installationId,origin,nativePrefix,caPem,caSha256,serverName,issuedAt,expiresAt)을 그대로 보존한다. HEAD.snapshot은 wire NativeChannelProfileHead 원형(schemaVersion,purpose,installationId,profileRef,state,updatedAt) 그대로다. HEAD private generation/previous/fullref/anchor 열을 공개 snapshot에 추가하지 않는다. 공개 head ref.version=1과 private generation은 서로 다른 값이다. canonical text/hash/JSON 복원 동등성과 실제 typed 열을 모두 검산한다.

anchor_canonical은 보호 package가 제공한 실제 pinned native-profile 검증 anchor의 canonical 원문이다. anchor_hash와 package_manifest_hash는 그 원문 및 승인 package와 검산한 실제 값이다. 각 versions 행에 이 원문/두 hash를 실제 보관하므로 모든 복제 비용을 세며, logical shared라는 이유로 행간 중복 bytes를 공제하지 않는다. caller가 anchor/raw principal/권한 boolean을 지정하는 범용 발행 API는 없다. publisher 입력은 보호 package 검증자가 만든 typed 결과만 받는 후보이고 app/HUMAN/Agent의 직접 발행·개정·회수 권한은0이다.

새 PROFILE은 같은 Tx의 ACTIVE HEAD가 있어야 하며 orphan PROFILE COMMIT은 거절한다. 새 HEAD마다 정확 profile/previous, 현재 heads CAS, 계상 전환이 모두 있어야 한다. heads는 실제 최신 HEAD 한 행을 가리키며 generation 누락/분기/건너뛰기/옛 head 복귀는 거절한다. profile version 및 minimum floor는 단조 증가하고 이미 회수·교체된 같은 profile version의 재활성은0이다. floor/유효기간/current ACTIVE 검사는 신규 사용에서 수행한다. 과거 receive/history는 보관된 실제 PROFILE fullref를 읽으며 현재 member/읽기 정책을 별도로 검산한다. 원 owner와 현재 member를 같다고 가정하지 않는다. 회수 후 역사 FK와 이력행은 남는다.

각 표 FORCE RLS, 기존 migrator 소유·고정 search_path·PUBLIC EXECUTE 회수, app/HUMAN/Agent raw write0/raw SELECT0을 유지한다. 보호 publisher 전용 signature/최소 EXECUTE 매핑은 WI의 신규 후보이며 실제 권한 부여가 아니다. read도 기존 보호 reader의 검증된 project/registration/installation 및 현재 read 정책을 통하며 임의 public profile repository를 만들지 않는다.

### 14.3 모든 물리열의 canonical projection과 typed 최대식

P_versions와 P_profile_heads는 §14.1에 나열한 열 이름 전부를 exact key로 갖는 object다. NULL key도 포함한다. snapshot_json은 parse(snapshot_canonical)의 실제 typed JSON이므로 canonical string 비용과 object 비용을 각각 포함한다. anchor_canonical도 JSON 문자열 escape 후의 실제 비용이다. SQL page/TOAST 물리 저장량이 아니라 기존 quota의 canonical projection byte 분모이며 이를 실제 disk bytes라고 부르지 않는다.

B(x)=UTF8(canonical(x)).length, E(s)=B(s)로 정의한다. UUID JSON값38B, hash66B, 양의 안전정수 최대16B, NULL4B, 실제 UTC6 timestamp JSON값29B, wire ISO24 JSON값26B다. object 키/colon/comma/braces는 literal exact 키로 canonical serializer가 더한다. 따라서 raw text 길이에 상수를 더해 문자열 escaping 비용을 빼먹지 않는다. 각 immutable row actual A_v=B(P_versions(v))이며 불변행 자체의 future growth=0이다. 새 publish의 PROFILE 원문/anchor 입력은 보호 검증 뒤 실제 bytes를 admission에 넣는다. 아직 받지 않은 임의 미래 profile/CA에 근거 없는 최대치를 선언하지 않는다.

가변 heads의 M_h는 P_profile_heads의 고정 project/installation/profile/anchor_hash/package_manifest_hash/created_at을 그대로 두고, generation/current_profile_version/minimum_profile_version을 각각16자리 안전정수 폭, current_head_version=1, UUID/hash는 정확 고정폭, updated_at은29B로 투영한 최대형이다. actual A_h=B(P_profile_heads(h)); H_h=M_h-A_h>=0, future slot=0이다. anchor/package identity 변경은 이 후보의 같은 head에 암묵 허용하지 않으며 별도 보호 설치·개정 결정 대상이다. 기존 created_at/실제 updated_at을 padding/가짜 값으로 바꾸지 않는다.

Q_revoke의 최대형 T_revoke(h)는 실제 current ACTIVE HEAD/profile/anchor 원행만으로 재계산한다. P_versions의 project/installation/profile fullref/anchor_canonical/anchor_hash/package_manifest_hash는 실제 값, record_kind=HEAD, version=1, state=REVOKED, generation=h.generation+1, previous fullref=current HEAD exact 값이다. id는 UUID38B, content_hash는66B, created_at은29B로 bounded typed 값이다. snapshot_canonical과 snapshot_json은 원 wire HEAD를 state=REVOKED·updatedAt=ISO24로 만든 같은 canonical 원형이며 profileRef/installationId는 현재 값이다. fresh UUID/hash/시각의 구체값은 바뀌어도 위 JSON 길이는 고정이고 canonical 문자열 escape 비용도 serializer로 계산한다. M_revoke(h)=B(T_revoke(h)); Q_revoke(h)=(R slots1,R bytes M_revoke(h)). current generation+1이 안전정수 범위에 없으면 ACTIVE publish admission을 거절하여 회수 예약이 불가능한 상태를 만들지 않는다. 예약 때문에 공개 HEAD 원형을 변경하지 않는다.

### 14.4 공유 actual/held·포화 회수·used/held 역정산

V_p=해당 project의 versions 실제 모든 행, H_p=실제 heads 행으로 둔다. CurrentActive는 각 heads가 실제 FK로 가리킨 HEAD.state=ACTIVE인 집합이다. 과거 ACTIVE 이력 전체가 아니다.

R_shared.actualSlots=|V_p|+|H_p|.
R_shared.actualBytes=sum_v A_v+sum_h A_h.
R_shared.heldSlots=|CurrentActive|.
R_shared.heldBytes=sum_h H_h+sum_currentActive M_revoke(h).

이미 물리 보관된 row actual과 아직 없는 다음 revoke 한 행 held는 겹치지 않는다. Q_revoke는 추가 표/요약열 없이 실제 current HEAD/profile/anchor에서 collector가 계산하는 보존 불변식이다. 따라서 예약표 자체의 숨은 자기비용은0이다. 검산 가능한 실제 보호행을 잃으면 예약이 해제된 것으로 간주하지 않고 COMMIT 거절/UNKNOWN hold다. shared profile을 window reservation plan.items에 복제하거나 window마다 Q를 세지 않는다.

| 전이 | 실제/예약 변화와 동일 Tx 조건 |
|---|---|
| 첫 PUBLISH | PROFILE1+ACTIVE HEAD1+heads1 actual을 admission, heads growth와 Q_revoke 1slot/typedM을 먼저 확보한다. 실제 current CAS/완결·used 증가/held 증가가 같은 account lock/Tx다 |
| 후속 새 PUBLISH | 새 PROFILE1+ACTIVE HEAD1 actual과 변경 heads actual/growth 및 새 Q를 먼저 계산한다. 옛 current Q는 정확 새 current/history closure가 COMMIT되는 같은 Tx에서만 대체 반환한다. 원 행은 삭제하지 않는다. 무한 미래 publish 예약은0이다 |
| REVOKE | 이미 확보된 current Q_revoke만 소비하여 REVOKED HEAD1 actual을 만든다. 실제 bytes<=M_revoke를 검산, used에는 새 행 실제량과 heads actual 변화, held에는 oldQ 제거와 heads growth의 반대 변화를 같은 Tx로 반영한다. 미사용 oldQ byte 차액만 명확 COMMIT 후 반환한다 |
| UNKNOWN/실패 | 새 nonce/실제효과 재시도0, 외부 결과를 보고 선해제0. 원 current/예약/실제행을 보존하며 원 식별자의 고정 조회로 판정한다. DB 명확 rollback이면 기존 상태, COMMIT이면 완결된 새 상태만 허용한다 |

각 Tx에서 Δused=실제행 projection의 전후차, Δheld=위 held식의 전후차다. Δ(used+held)를 재검산하여 기존 project quota와 R 한도를 만족해야 한다. REVOKE는 새 자유 publish 입력을 수용하지 않고 예약한 한 HEAD만 전환하므로 quota가 이미 포화여도 선확보 reservation 안에서 수행한다. 예약이 실제 부족하거나 current/CAS/정산 불일치면 기존 자료 삭제·guard 완화로 통과시키지 않는다. reserve를 소비했지만 actual이 없거나 actual만 있고 reserve 해제가 누락된 COMMIT을 deferred closure가 거절한다. 조회 불명확은 UNKNOWN hold다.

### 14.5 기존 collector 접점·중복 배제·인수 조건

R10000행/64MiB의 project 분모는 기존 R 원장 + receive window 실제/held + 고정 security aggregate 실제/growth + 이 R_shared 실제/held를 각 물리 owner에 정확 한 번 더한 값이다. window R54는 window 물리행만이며 공유 profile 두 표/Q_revoke/aggregate를 포함한 새 window 상수로 부풀리지 않는다. project10GiB도 같은 shared actual/held를 project당 한 번만 더한다. Nactual/Q_N과 공통 L행의 기존 분모는 별도 원식을 보존한다. 여러 window가 같은 profileRef를 참조해도 profile row actual/Q는 추가되지 않는다. receive_records의 새 FK3열은 각 실제 R행에 실제 복제되므로 그 bytes는 window별로 센다.

기존 account collector의 strict used/held 동등식·quota_adopt_creation/quota_complete 계열·강제 deferred source completeness·최종 NativePreparationStore/0071/environment configuration 계열 collector 중 하나라도 새 shared 분모를 누락하면 인수0이다. 보호 publisher와 receive 소비자가 동일 project account lock에서 같은 private shared collector를 사용해야 한다. 사용 가능한 새 API/DB 구현이 이미 존재한다고 주장하지 않는다. WI는 profile actual/growth/Q_revoke의 실제 원행 열에서 재계산하고 app의 caller 금액·summary cache를 권위로 받지 않는 정확 source 접합을 소유한다.

검수는 (1) 각 fullref actual UNIQUE/FK/kind closure, (2) ROOT/후속/회수 이력 및 head CAS, (3) 원 profile·JSON/text·anchor 실복제 P, (4) ACTIVE당 revoke1 예약·같은 Tx used/held 역정산, (5) project 중복0·quota 포화 회수·미정산 COMMIT 거절, (6) 현재적격과 역사읽기 분리, (7) 보호 publisher/RLS/EXECUTE 경계를 대조한다. 본 작업에서는 문서 읽기/수정만 했으며 실제 PG/컴파일/시험/권한 실행은0이다. 신규 인증 권위·공개·저장 의미의 제품 채택은 Main/신산님 결정 전까지 미채택이다.