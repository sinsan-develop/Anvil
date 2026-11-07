# FN06 최초 거절 감사 의미값 source 채택 기록

- 기록일: 2026-11-05. Main 어울.
- 직접 결정: call_0c2cf3bd25cd47cebea0ae87888fafc4 item0. 답변: “A안 감사 의미값·source-only 구현 승인”.
- 채택 원문: docs/contracts/FN06_PHASE_DENIAL_AUDIT_SEMANTICS_CANDIDATE_20261105.md.
- 원문 SHA256: DC04B47E7A126B015AFF0BA7005D60DE52805E25D63AA11907B6239A85DF1436. Main b7ec64에서 현재 파일 일치 확인.
- 부모 첫수신 승인 패킷: 682A51DACA51FAD9525B4DB34AB62DCDD99B0D5DC63A2B1BCA1ACC211F2CA24E.
- 로컬 기준: codex/av3-stage-b, 94864985251a90f966b028c86a497617f708961b. 기존 Primary의 Binding 구현 변경은 보존한다.
- 이 delta 상태: ADOPTED / SOURCE_GO. 후보의 DRAFT/GO0 표기는 채택 전 이력으로 보존하고 후보 원문은 바꾸지 않는다.
- 수행자: 기존 Primary 한 명. Main은 관리·독립 검수·직접 최소 검증·통합을 맡는다. 진행 중 Binding 단위를 안정시킨 뒤 동일 담당자가 순차 구현하며 동시 writer는 추가하지 않는다.

승인된 네 의미값은 원 head.actor_id의 exact HUMAN actor_ref, 실제 원 CHALLENGE fullref target_ref, 실제 불변 Window.snapshot.policyRef, 고정 source_kind NATIVE_RECEIVE_PHASE_DENIAL이다. 원 사용자 귀속이며 잘못된 서명자의 host 신원이나 직접 클릭을 입증했다고 표시하지 않는다. 기존 client_ref·NULL command/operation/approval/correction, 실제 동일 Tx 시각·scope_digest·audit 전체 행 hash를 보존한다.

최초 허용 producer는 원 credential/SID·현재 auth/회원/제어/등록/profile/writer·원 ticket/Challenge/target/body·기한이 실제 검산된 뒤 P256에서 명확히 실패한 NATIVE_RECEIVE_PURPOSE_DENIED다. 같은 Tx의 PROOF_EVIDENCE·DENIED CONSUME_REPLAY·audit1·ticket REJECTED와 PHASE_DENIAL 계상을 결박한다. 일반 SQL/timeout/current 미확인·COMMIT/release 불명은 DENIED나 성공으로 바꾸지 않는다. 적법 동일 원문 재조회는 새 감사/nonce/효과0이며 UNKNOWN은 원 id/hash/hold를 보존한다.

CLOSE/STREAM의 거절 전용 역완결은 정상 성공 orphan 검사를 전면 완화하지 않는다. 거절 자체 성공효과/TERMINAL0과 이후 별도 정상 HUMAN close의 실제 command/receipt/audit·TERMINAL/CLOSED 허용을 구분한다. 실제 감사 네 필드·client·시각·hash·scope와 저장 참조를 역검산한다.

정확 허용 경로13은 다음과 같다.

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

기존 미완료 RED부터 TDD·직접 영향 회귀·타입/정적 검사·독립 검수를 수행한다. 새 table/행종류·공개 입력/HTTP/IPC/module export·권한·timeout·예약 상한을 추가하지 않는다. 실제 DB·권한 부여·키·서비스·Agent·C# 컴파일·J3/P03 R3·배포는 제외한다. ACK bodyHash 입력은 이 결정으로 채택되지 않는다. 이 기록은 구현/실제 환경 합격이나 전체 FN06·계획 완료 보고가 아니다.
