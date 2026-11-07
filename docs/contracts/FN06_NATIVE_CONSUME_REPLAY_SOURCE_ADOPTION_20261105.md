# FN06 STREAM·CLOSE 재조회 source 채택 기록

- 기록일: 2026-11-05. Main 어울.
- 직접 결정: call_5bce820e2f5c4d7499a408630d3165cf item0. 답변: “A안 재조회 계약·source-only 구현 승인”.
- 채택 원문: docs/contracts/FN06_NATIVE_CONSUME_REPLAY_COMPLETION_CANDIDATE_20261105.md.
- 원문 SHA256: 45BA40D3BB98D3C88F4CB852F3A02325BF9C00F430E0924EBEDF80F95426C279. Main c1549d에서 일치 확인.
- 로컬 source 기준: codex/av3-stage-b, 5fb30d6bbb0359043d7771fb8d52bd7aff51bdf5.
- 이 delta 상태: ADOPTED / SOURCE_GO. 원 후보의 DRAFT/GO0 표기는 채택 전 이력으로 보존하며 원문을 덮어쓰지 않는다.
- 수행자: 기존 Primary 한 명. Main은 검수·통합·현황 기록을 맡고 같은 소스를 동시에 수정하지 않는다.

STREAM은 최초 점유의 원 ReceiveState를 기존 CONSUME_REPLAY의 STATE/null/resultCanonical에 보관한다. 적법 재조회는 같은 GET200 JSON으로 원 상태만 반환하며 stream·frame·비밀을 재전달하거나 slot·ARM·실행을 자동 시작하지 않는다. CLOSE 최초와 재조회는 원 CLOSED ReceiveState를 반환하며 실제 TERMINAL과 private 결과의 역완결을 보존한다.

원 request/proof/signature·효과·결과 원문·원 auth/정책/세대/등록/profile/writer·모든 부모 최소기한과 이미 존재하는 Binding/Delivery의 원 10초를 검산한다. STREAM 후속 비terminal과 CLOSE의 정확 CLOSED 예외는 채택 원문 §3에 한정한다. 적법 동일 원문 재조회는 새행·nonce 소비·효과·정산·감사 쓰기 0이다. 위조/충돌은 기존 유한 거절 계약을 유지한다. UNKNOWN을 성공으로 바꾸거나 원문/기한을 재발급하지 않는다.

정확 허용 경로 13개는 다음과 같다.

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

TDD·직접 영향 회귀·타입/파일 출력 없는 빌드와 독립 검수를 수행한다. 새 필드·행·상한·timeout·module export·IPC·권한은 추가하지 않는다. 실제 DB·권한 부여·키·서비스·Agent·C# 컴파일·J3/P03 R3·배포는 제외한다. ACK bodyHash 입력 후보는 이 결정으로 채택되지 않는다.

현재 C# source 단위를 안정 지점에서 구분한 뒤 같은 Primary가 순차 구현한다. 완료한 기존 기능은 재구현하지 않는다. 이 기록은 구현·실제 환경 합격이나 전체 FN06/계획 완료 보고가 아니다.
