# FN06 최초 적격 거절 감사 의미값 한정 후보

상태: DRAFT / NOT_ADOPTED / 이 의미값 저장 SOURCE_GO0. 2026-11-05 Main 어울.

## 1. 기존 승인과 미정 범위

부모 첫 수신 패킷 682A51DACA51FAD9525B4DB34AB62DCDD99B0D5DC63A2B1BCA1ACC211F2CA24E와 계상 F8667E17830B60791D769A288EC77C82E34649A952BFF9FAF4AE688BB32C1597는 admitted phase 최초 적격 거절의 evidence·DENIED replay·내구 audit·ticket REJECTED를 같은 Tx에서 보존하도록 정한다. phase당 첫 audit 최대1과 기존 PHASE_DENIAL 예약/분모를 유지한다.

현재 fn76_ticket_finished_complete는 audit command_id/operation_id/correction_of NULL, outcome DENIED, reason_code=닫힌 거절 code, 원 client_ref, 정확 scope_digest와 실제 audit row 전체 hash를 요구한다. 그러나 actor_ref/target_ref/policy_ref/source_kind의 정확 의미값은 고정하지 않는다. 기존 HUMAN challenge 성공 감사와 typed 최대형을 자동 전용하지 않는다. 새 감사 action 컬럼도 만들지 않는다.

## 2. A안 권장 — 검증된 원 HUMAN 귀속과 원 Challenge 대상

| 필드 | 정확 제안 |
|---|---|
| actor_ref | exact {kind:'HUMAN',userId:원 head.actor_id}. 실제 유효 원 HUMAN auth session·client·세대·회원·정책과 원 receive 귀속을 검산한 경우에만 사용 |
| target_ref | ticket이 실제 가리키는 원 CHALLENGE fullref(id/version1/contentHash) |
| policy_ref | 실제 불변 Window.snapshot.policyRef. 원 현재성 재검산과 일치해야 함 |
| source_kind | 고정 문자열 NATIVE_RECEIVE_PHASE_DENIAL |

actor_ref는 원 수신을 허가한 사용자 귀속이다. 거절된 서명의 소유자가 암호학적으로 입증됐다는 뜻이나 사용자가 직접 클릭했다는 주장은 아니다. source_kind가 native 수신 phase 거절을 구분한다. 새 등록 주체나 새 권한을 발급하지 않는다.

기존 client_ref는 원 head.client_id, approval_ref는 NULL을 명시하고, command_id/operation_id/correction_of도 NULL을 유지한다. recorded_at은 거절 실제 Tx 관측시각으로 ticket.finished_at·evidence/replay와 일치시킨다. scope_digest는 기존 exact {windowRef,ticketId,requestId,requestHash,phase,occurrence}의 canonical hash다. auditRef는 실제 저장 audit row 전체의 기존 canonical hash로 만든다. 원 request/비밀/nonce/signature를 audit 본문에 복제하지 않는다.

B안은 별도 REGISTERED_HOST actor를 정의하는 방식이다. 최초 서명 거절에서 host 신원을 검증했다고 잘못 읽힐 수 있고 receive credential과 기존 native authority credential의 의미도 다르므로 이번에는 권장하지 않는다. B를 선택하면 actor 상세 계약을 추가로 정해야 한다.

## 3. 적격·생산·역완결 경계

이번 첫 구현의 허용 거절은 원 receive credential/SID·현재 auth·project/member/control·등록/profile/writer·원 ticket/CHALLENGE·target/body·기한을 실제로 확인한 뒤 첫사용 P256 검증에서 명확히 실패한 NATIVE_RECEIVE_PURPOSE_DENIED다. 일반 SQL/timeout/도구 예외나 current 미확인을 DENIED로 바꾸지 않는다. 다른 닫힌 거절 code의 producer는 각각 기존 계약과 적격성을 검토한 후 같은 의미값을 소비한다.

첫 거절은 같은 원 Tx에 원 PROOF_EVIDENCE·DENIED CONSUME_REPLAY·audit1을 저장하고 ticket을 REJECTED로 단발 전이한다. 원 protocol 성공 효과는0이며 같은 원문은 과거 결과만 읽고 새 감사/nonce/효과를 만들지 않는다. quota·예약과 PHASE_DENIAL 성장량은 기존 actual/future collector로 정산한다. 감사/SQL/COMMIT/release 불명은 UNKNOWN·원 id/hash/hold 보존이며 자동 재요청하지 않는다.

CLOSE/STREAM 역완결은 원 REJECTED/DENIED/audit closure 및 실제 CHALLENGE/proof/evidence 결박을 확인하는 별도 분기로 구분한다. 그 거절 자체가 protocol 성공효과나 TERMINAL을 만들지 않아야 한다는 뜻이며, 같은 Window에 영구히 TERMINAL이 없어야 한다는 뜻은 아니다. 이후 별도 정상 HUMAN closeNativeReceiveWindow가 수행되면 기존 command/receipt/audit·TERMINAL/CLOSED의 실물 closure를 검산해 허용한다. native 거절을 이유로 기존 HUMAN 종료 권한을 제거하지 않는다. 정상 성공 orphan 보호를 전면 완화하지 않는다. 전체 audit 행의 네 의미값·client·시각·hash·scope와 저장된 record 참조를 역검산한다.

## 4. 범위와 수치

새 table/행종류/공개입력/HTTP/IPC/module export/권한/timeout은 추가하지 않는다. source_kind 한 literal의 의미와 기존 audit 필드 결박만 추가한다. actor HUMAN 원형과 27자 source 문자열은 기존 typed 최대형보다 작지만 실제 canonical/JSON projection·used/held·자기 숫자폭은 구현 시 기존 collector로 검산한다. 기존 예약/상한을 조용히 늘리거나 실제량을0으로 주장하지 않는다.

기존 Primary 한 명이 아래 기존 승인13경로 중 필요한 부분만 코드·미적용 SQL·합성시험으로 구현하고 Main은 독립 검수·통합한다.

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

실제 DB·권한 부여·키·서비스·Agent·C# 컴파일·J3/P03 R3·배포는 제외한다. 미채택 ACK 입력과 무관한 기존 N current/owner 연결은 계속한다. 승인 전 이 네 의미값의 제품 저장 구현은0이다.
