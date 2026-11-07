# FN06 ACK body hash 입력 보완 — 한정 채택·구현 지시 후보

상태: DRAFT / NOT_ADOPTED / ACK delta SOURCE_GO0. 2026-11-05, Main 어울.

## 1. 이번 결정의 정확한 변경점

부모 source-only 채택 패킷 682A51DACA51FAD9525B4DB34AB62DCDD99B0D5DC63A2B1BCA1ACC211F2CA24E와 기존 57 허용 경로는 보존한다. 기술 후보는 docs/contracts/FN06_ACK_CHALLENGE_BODY_HASH_DELTA_CANDIDATE_20261105.md, SHA256 272B2EED2471C66D2439FE55667F112AC35E5946669D3890E1593C5C5AFADB58이다. 독립 검토 C0/I0은 채택이나 구현 완료가 아니다.

권장 A안은 아직 배포하지 않은 schemaVersion1의 ACK challenge만 exact9키로 바꾸고 ackBodyHash를 필수로 추가한다. 다른 phase는 exact8키이며 이 필드를 거절한다. ackBodyHash는 같은 원 main의 실제 소유 slot이 단발 수용한 뒤 생산한 V<SlotReceipt>를 포함하는 불변 ACK7키 전체의 canonical SHA256 소문자64자리다. receipt ref hash·가짜 시간·빈 hash·caller의 수용 선언으로 대체하지 않는다. B안은 실제 receipt 전체 전달이며 A보다 원문 복제량이 커서 A를 권장한다.

이번 채택 대상은 이 공개 입력 변경과 아래 source 구현·검수뿐이다. 실제 DB·권한·키·서비스·Agent·C# 컴파일·J3/P03 R3·배포는 제외한다. 기존 부모 승인을 다시 받는 문서가 아니다.

## 2. 단일 writer·구현 경계

기존 Primary 한 명이 구현하고 Main은 검수·통합한다. 사람 채택 전 ACK delta 코드는 작성하지 않는다. 다른 승인된 phase/desktop 구현은 계속한다. 새 표·상한·timeout·권한·의존성을 추가하지 않고, 과거 SQL과 공용 인증 코드를 바꾸지 않는다.

직접 입력·저장 연결 6경로:

- contracts/runtime/native-first-receive-v1.ts
- apps/server/modules/executions/native-first-receive-input.ts
- apps/server/modules/executions/native-first-receive-store.ts
- apps/server/modules/executions/native-first-receive-service.ts
- apps/server/modules/executions/native-first-receive-routes.ts
- db/migrations/0076_native_first_receive.sql.pending

원 receiver의 private 생산선 8경로:

- apps/connector/runtime/native-first-receive-client.ts
- apps/desktop/src/native-first-receive-client.cjs
- apps/desktop/src/trust-enrollment-owner.cjs
- apps/desktop/src/trust-key-host-client.cjs
- apps/connector/native/DesktopTrustKeyHostSource.cs
- apps/desktop/scripts/native-proof-runtime-entry.mts
- apps/desktop/scripts/native-proof-runtime-build.cjs
- apps/desktop/src/shell.cjs

직접 시험 8경로:

- tests/unit/FN06/native-first-receive-contract.test.ts
- tests/unit/FN06/native-first-receive-store.test.ts
- tests/unit/FN06/native-first-receive-schema.test.ts
- tests/unit/FN06/native-first-receive-routes.test.ts
- tests/unit/FN06/native-first-receive-client.test.ts
- tests/desktop/native-first-receive-owner.test.cjs
- tests/desktop/native-proof-runtime-build.test.cjs
- tests/native/FN06/NativeFirstReceiveHostSourceTests.cs

위 22경로는 부모 허용 경로의 부분집합이며 추가 경로 허가는 아니다. 미작성 경로의 현재 존재나 구현 완료를 가정하지 않는다. 기존 native-preparation-credential-slot.ts는 읽기 참조만 한다. 새 client의 private adapter가 실제 소유 slot instance의 원 검산·단발 수용·current를 사용해야 한다. 임의 caller callback의 void 반환을 수용 증거로 인정하지 않는다. 실제 class 경로를 접합할 수 없으면 미완료로 반환한다.

## 3. 불변 생산선·재조회·원 operation 경계

실제 slot 수용 → 같은 원 main의 immutable SlotReceipt → ACK7키 불변 snapshot → 전체 canonical hash → ACK9키 challenge → 정확 typed proof/서명 → 같은 원 ACK body 전송 순서다. renderer에 credential/receipt/current/hash 주입 API를 추가하지 않는다. 기존 목적·method/path/queryHash·현재성·기한 검사는 유지한다.

서버는 commitment를 원 ISSUE_EVIDENCE.requestBody·canonical 원문과 requestHash에 결박한다. 같은 requestId/같은 canonical9는 원 challenge만 반환하고 행·nonce·기한 증가0이다. 변경 commitment/ref는 충돌이다. 최종 ACK에서 실제 body hash·receipt 전체·current·proof·서명·nonce를 다시 검산하므로 commitment만으로 수용이나 CONFIRMED를 만들지 않는다.

R binding/delivery의 선COMMIT 가시성·owner/fence/waiter·N 선예약·후행 closure는 별도 부모 범위의 미완료 접합이다. 입력 delta만으로 전체 ACK 완료라고 표시하지 않는다. 기존 ATTEMPTED 선COMMIT → 잠금 해제 후 외부 단발 전달 → 별도 원 operation 후행 Tx 순서를 지킨다. ACK endpoint는 CANDIDATE_ONLY/confirmed:false의202이며 원 operation 결과를 기다리지 않는다. 원 operation 후행 Tx만 nonce 소비·불변 receipt·DELIVERY_CONFIRMED·예약 정산을 함께 COMMIT한다. timeout/불명 뒤 별도 성공 생성이나 재전달은0이다.

후행 전체 접합은 기존 승인 경로인 project-native-preparations.ts, native-preparation-store.ts, native-preparation-current-source.ts, native-preparation-routes.ts, server main.ts/app.ts와 receive service/store/SQL에서 별도 검수한다. 이 문서는 그 생산자가 이미 구현됐다고 주장하지 않는다.

## 4. 오류와 계상 — 기존 의미 유지

| 조건 | 정확 대응 |
|---|---|
| ACK hash 누락·형식 오류·다른 phase 추가키 | INPUT_INVALID / 400 |
| receive credential 부재·불일치 | NATIVE_RECEIVE_AUTH_REQUIRED / 401 |
| 형상은 맞지만 proof 목적·서명·nonce·receipt 결박 불일치 | NATIVE_RECEIVE_PURPOSE_DENIED / 403 |
| 동일 requestId의 다른 원문·중복 phase 소비 | NATIVE_RECEIVE_CONFLICT / 409 |
| 원 instance/current/세대·등록 변경 | NATIVE_RECEIVE_CONTEXT_CHANGED / 409 |
| 원 최소기한 만료 | NATIVE_RECEIVE_EXPIRED / 412 |
| 필수 source 또는 owner/waiter 부재 | NATIVE_RECEIVE_SOURCE_UNAVAILABLE / 503 |
| 효과·후행 COMMIT 결과 불명 | NATIVE_RECEIVE_OUTCOME_UNKNOWN / 503 |

새 공개 OWNER_UNAVAILABLE 코드는 추가하지 않는다. SQLSTATE만 보고 위 오류를 추정하지 않고 정확 producer의 거절 원인을 대응시킨다. 결과 불명은 재시도/새 nonce/별도 성공으로 바꾸지 않는다.

기존 ISSUE_EVIDENCE의 JSON/canonical 이중 projection을 유지할 때 A 입력의 IE 논리 증분은166B다. 이는 전체 프로젝트 정산액이 아니다. 기존 requestBody8192B 상계와 issue3행은 유지하며 실제 used/held·자기 projection 숫자 폭은 같은 Tx의 refresh/collector로 다시 계산한다. 새 상한이나 PG 물리 크기를 이 숫자로 정하지 않는다.

## 5. 검수 조건·미검증

- TDD: ACK9 정상, 누락/형식/다른 phase 추가키 거절, 동일 replay의 행/nonce/기한 증가0, 변경 commitment 충돌.
- 실제 class를 소비하는 source 합성 반례: slot 거절/다른 instance/늦은 current/변조 body·receipt·acceptedAt·proof·nonce·기한을 거절한다. 임의 성공 대역만으로 전체 연결을 통과시키지 않는다.
- 202 뒤 원 후행 Tx 실패·유실이면 CONFIRMED0, 별도 성공·중복 effect0이다. 기존 원 native10초의 최소기한·UNKNOWN·보안 검사를 유지한다.
- 직접 검사·필요 인접 회귀·type/build와 독립 scoped 검수를 수행한다. 이전 검사 기준·보호 사용자 파일·기존 원문은 보존한다.
- 실제 PG/RLS/동시성·TLS·브라우저·slot/키-host·Agent 실행은 NOT_RUN이다. source-only 결과로 실제 인수나 전체 계획 완료를 선언하지 않는다.