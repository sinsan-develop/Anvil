# FN06 native 최초 수신·한정 위임·전달 계약 후보 r1

2026-11-03. **DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0 / 독립 기술 검토 전**.
이 문서는 새 인증·공개 wire·보호 증거 저장의 결정 후보다. 기존 r2/r5 승인이나 작업계획 승인으로 이미 채택됐다고 해석하지 않는다. 실제 키·DB·권한·서비스·네트워크·Agent 실행을 요청하는 문서가 아니다.

## 1. 목표와 실제 차이

Anvil의 허가된 절차에서 일반 Web·모바일의 정확한 지시를 등록된 PC 실행기가 받아 처리할 수 있어야 한다. 작업마다 PC를 직접 조작하는 방법으로 원격 자동 진행을 대체하지 않는다. 이 계약의 목적은 native 준비 credential을 최초 보호 전달하는 것이며 coding Agent 실행 허가를 발급하지 않는다.

- 기준 branch codex/av3-stage-b, source b2178d200a65113a260a3d66f9b47f99254699e8, 결과 tail8f694f31c2aeeac8a2147c6878c1fd6550939ccc.
- 원 native r2 A 계약5C4AF434, trust r5 A 계약F6C8CB66, WORK_PLAN FN06/FN08/FN11/FN15의 사용자 흐름과 연결한다.
- project-native-preparations.ts:78~86,109~113은 원 command COMMIT→DELIVERY_ATTEMPTED 별도 COMMIT→최대1회 supplier/ACK→HUMAN 응답이다. 원 native 작업은10초이며 준비 전 대기시간으로 이를 연장하지 않는다.
- native-boundary-preparation-api.ts:34,42,44의 최종 ProjectCommand는 approvalRef 결박 때 전체 hash가 바뀐다. payloadHash만으로 동일 명령을 판단하지 않는다.
- remote WebContents에는 preload가 없고 기존4 trust IPC는 native 수신 준비를 표현하지 않는다. 기존 StatusOnly credential과 native bearer는 최초 수신 인증에 사용할 수 없다.
- project-registration-reads.ts:40,51~60, migration0006:53~67, native host current/consume, owner typed SIGN이 원 client/session/control을 현재 명령 주체와 같게 요구한다. 모바일 제어권 변경 뒤 원 ISSUED/TRUSTED 기록은 남지만 현재성은 닫힌다. 코드 몇 곳의 equality를 삭제해서 해결하지 않는다.
- 기존 native current/profile·delivery·slot은 실제 보호 공급자·수신 인증·ACK를 만들지 않는다. bootstrap 서명만으로 실제 물리 factory 지원이 검증됐다고 표시하지 않는다.

## 2. 대안과 Main 권장

**A — 목적 제한 수신 window·서버 exact offer·한 번의 ARM/전달**을 권장한다. 서버가 허가한 원명령 offer를 실행기가 소프트웨어로 검산한다. 고정 native HTTPS와 원 등록 P256키를 사용하되 수신 전용 인증 목적·위임·증거는 새로 정의한다. 기존 HUMAN/StatusOnly/native v1의 동작은 유지한다.

B — 사용자가 Web/모바일의 offerRef를 PC 로컬 설정에 직접 넘기는 수동 handoff는 비교 대안이다. 인증 경계는 A와 같고 발견 경로만 단순해지며, 원격 자동 진행의 최종 해법으로 채택하지 않는다.

아래 수치·이름·형식은 모두 **Main 권장 초안**이다. 신산님이 채택한 값이 아니며 기술 검토에서 원 요구·기존 계약과 대조한다.

## 3. 두 주체와 목적 한정 위임

명령 주체는 현재 HUMAN controller/user/client/session/control·credential 세대다. 수신 주체는 원 registration/connector/client/session/키·등록 세대다. 같은 사용자·같은 프로젝트·살아 있는 원 등록에 대한 정확한 명령 하나만 허용한다. 다른 사용자, 만료/회수된 등록·원 session 복구, 장기 범용 기기 권한은 포함하지 않는다.

새 NATIVE_PREPARATION_RECEIVE_DELEGATION은 다음을 서버에서 복원해 불변 저장한다.

- installationId/projectId, registrationRef/connectorRef/원 scopeDigest/hostKeyFingerprint.
- 원 등록 userId/clientId/humanSessionId/credentialGeneration/controlGeneration.
- 현재 허가 userId/clientId/humanSessionId/credentialGeneration/controlGeneration.
- 최종 commandId/commandHash/payloadHash/approvalRef, nativeFactoryRef, expectedWriterHeadRef, sourceScopeHash, channelProfileRef.
- 허용 목적 NATIVE_PREPARATION_RECEIVE_ONLY, 현재 명시 policyRef, 발급·만료·회수와 외부 생성 command/receipt/audit fullref.

원 필드는 원 등록 command/receipt/행·HUMAN 확인에서, 현재 필드는 현재 인증 Tx에서 복원한다. caller의 actor 선언·hash·verified 플래그를 권위로 삼지 않는다.

| 경계 | 새 목적 경로에서의 처리 |
|---|---|
| 원 등록/키·scope·생성 command/receipt·HUMAN 확인·ISSUED/TRUSTED·비회수·기한 | 원형과 이력 검산을 그대로 보존 |
| 원 user/client/session 생존·사용자 credential 세대·원 policy 버전/기한/명시 DENY | 보존. 원 session 만료·계정 세대 변경을 위임으로 복구하지 않음 |
| 현재 actor.client = 원 등록 client | 같은 사용자·정확 recipient에 대한 검산된 위임 관계로만 대체 |
| 현재 controlGeneration = 원 등록 controlGeneration | 양쪽 원값을 보존하고 새 현재 controller의 한정 위임으로 연결 |
| 현재 HUMAN 제어/재인증/명시 정책/원 native 승인 | 별도 현재 조건으로 검산. 원 native 승인은 사전준비에서 소비하지 않음 |
| writer head·source scope·물리 증거 | 새 현재 명령에 실제 유효해야 함. 옛 head의 주체/시각을 바꾸거나 자동 승격하지 않음 |

기존 HUMAN reader·connector_basis_current·StatusOnly·원 등록 상태는 변경하지 않는다. 전용 ReceiverPrincipal/목적 reader를 추가한다. old HUMAN 세션 객체를 조작해 현재 actor로 위장하지 않는다. old basis=false를 통째로 무시하지 않고, 위 두 직접 동일 관계의 대체와 나머지 검산을 각각 코드·시험으로 증명한다. 같은 client 경로도 새 offer/위임을 쓸 때는 동일 계약을 적용한다.

## 4. 실제 시작점과 유한 window — 권장값

허가된 Anvil 절차가 createNativeReceiveWindow 명령으로 특정 등록·프로젝트·profile의 수신 window를 시작한다. 현재 controller의 명시 정책/필요 일회 승인을 검사한다. 이 window는 메시지 수신 범위이며 native 준비/Agent 실행 허가가 아니다. 자동 절차는 기존 허가된 작업의 정확한 호출선에서 이 명령을 사용해야 하며 단순 REGISTERED/기동/조회로 window를 만들지 않는다.

- window 절대수명 최대2시간, 원 등록/session/정책/profile 기한의 최소값. window당 offer 최대50개, 동시 ARM1개, registration/project별 활성 window1개.
- 실행기의 수신 절차는 시작한 window 하나에만 묶인다. 고정 origin의 유한 연결 하나를 사용하고 자동 재접속·갱신·무기한 poll은 하지 않는다. 끊김/만료는 상태와 필요한 조치를 표시한다.
- window의 발견은 목적 인증된 등록키에 대해 서버가 보관한 유일 활성 windowRef를 반환하는 방식이다. 임의 최신 pending command를 선택하지 않는다. 0이면 미준비, 복수이면 데이터 불일치로 닫는다.
- 일반 Web/모바일의 최초 window 생성과 등록 실행기의 window 발견/수신 시작의 **실제 생산·소비 호출선**을 구현·합성 종단에서 검증해야 한다. 새 IPC가 필요하면 main 소유 시작/상태/종료만 허용하고 remote renderer에 preload를 붙이지 않는다.
- 연결이 없으면 offer는 NOT_ARMED로 남고 native POST를 보내지 않는다. 사용자는 정확 상태를 조회·취소할 수 있다.
- 원 native POST가 시작된 뒤의 전체10초/min 기한은 기존대로 유지한다. 준비 단계가 그 시계를 재시작·연장하지 않는다.

## 5. offer·원명령 연결

HUMAN prepareNativeReceiveOffer는 최종 ProjectCommand 전체를 보관·검산한다. 원 native commandId/approvalRef는 바꾸지 않는다. 사전준비 자체의 명령/허가는 FN11 원 규칙을 사용하고 native 승인을 대신 소비하거나 두 연산에 재사용하지 않는다.

offer snapshot은 exact ref와 command 원본/hash, payloadHash, approvalRef, 현재 subject, recipient 원 등록 projection, 위임 fullref, window/session fullref, nativeFactoryRef/channelProfileRef/expectedWriterHeadRef/sourceScopeHash, issuedAt/expiresAt을 가진다. 최대수명120초 및 모든 부모 기한의 최소값을 권장한다. mutable 상태는 불변 사건 이력과 현재 head로 구분한다.

원 native commandRef는 사전준비 시 아직 없으므로 null이다. 가짜 fullref를 만들지 않는다. 실제 native authority 생성과 같은 Tx에서 별도 NativeReceiveCommandBinding을 기록한다.

- offerRef/delegationRef/authorityRef.
- 실제 authority.parent.commandRef/authorizationReceiptRef/auditRef와 최종 commandHash.
- recipient registrationRef/hostKeyFingerprint/channelProfileRef 및 원 window/session.
- binding ref/hash·발급/만료 및 동일 Tx 완결 증거.

authority별 binding1개. 원 command 행·requestHash·receipt/audit와 반드시 대조한다. ordinary evidenceRefs에 숨기지 않는다. 원 authority DTO를 유지할 경우에도 명시 association이 없는 위임 분기는 닫는다. current/consume와 로컬 SIGN 모두 같은 association을 확인해야 한다.

## 6. 공개 경계 후보

새 HUMAN 경계는 현재 로그인·제어·명시 정책과 same-origin/CSRF 원 규칙을 사용한다.

| 용도 | 후보 경로/연산 |
|---|---|
| 같은 사용자 recipient 후보 metadata | GET /api/v1/projects/:projectId/native-receive-recipient-options |
| window 시작·정확 조회/종료 | POST /api/v1/projects/:projectId/native-receive-windows, GET .../:windowId, 명시 closeNativeReceiveWindow |
| 최종 원명령 offer 보관 | POST /api/v1/projects/:projectId/native-receive-offers |
| 정확 offer 상태/취소 | GET .../native-receive-offers/:offerId, 명시 cancelNativeReceiveOffer |

후보 metadata reader도 새 목적/정책을 먼저 검사한다. 같은 사용자·현재 OWNER/제어·비회수 원 등록의 ID/fullref/키지문/제약만 반환한다. 이를 VERIFIED 물리 지원이나 실행 허가로 표시하지 않는다. 임의 cross-client 전체 자료 조회를 허용하지 않는다.

고정 native 경계는 cookie/StatusOnly/native bearer 없이 **등록키의 별도 목적 proof**를 검산한다. sessionId나 UUID만으로 인증하지 않는다.

| 용도 | 후보 경로 |
|---|---|
| 목적 nonce challenge | POST /api/v1/connector/native-receivers/challenges |
| 유한 session 시작 | POST /api/v1/connector/native-receivers/sessions |
| 고정 window/정확 offer·한 번 비밀 전달 stream | GET /api/v1/connector/native-receivers/:sessionId/stream |
| 정확 offer ARM | POST /api/v1/connector/native-receivers/:sessionId/arms |
| 휘발 수용 ACK | POST /api/v1/connector/native-receivers/:sessionId/acks |
| 비밀 없는 정확 원 상태 조회 | GET /api/v1/connector/native-receivers/:sessionId/offers/:offerId |

기존 v1 endpoint는 동작을 유지한다. 새 current 위임 표현은 schemaVersion/purpose로 구분된 별도 wrapper 또는 고정 조회를 사용해야 하며, v1 exact parser를 느슨하게 하거나 위임 없는 v1 권위를 묵시 승인하지 않는다. **위임 wrapper의 exact 원형은 기술 검토에서 확정할 필수 항목**이다.

## 7. proof와 native 통신 profile

P256/P1363과 32byte client/server nonce를 권장한다. 등록키는 기존 키를 사용하되 다음 닫힌 목적만 새 helper caller에서 허용한다. 일반 bytes signer는 추가하지 않는다.

- NATIVE_RECEIVE_SESSION_PROOF: CHALLENGE/OPEN/STREAM/STATE의 닫힌 phase, installation/registration/key/window/session·고정 method/path/query/body hash·requestId·nonce·기한.
- NATIVE_RECEIVE_ARM_PROOF: 정확 session/offer/delegation/최종 commandHash·recipient nonce·기한.
- NATIVE_RECEIVE_ACK_PROOF: 정확 session/offer/delegation/command binding/authority·원 deliveryAttemptRef·수용 opaque commitment·recipient nonce·기한.

최초 challenge도 fresh key-possession proof를 요구해 caller 선언으로 보호 원장을 소진하지 않게 한다. challenge nonce 최대30초·동일 ID/동일 본문 원 결과만·다른 본문 충돌·consumed nonce의 재개방0을 권장한다. nonce/proof 검산과 원 결과 replay 순서는 코드/시험으로 고정해야 한다. query/임의 URL/redirect·cookie export·secret 로그0이다.

별도 NATIVE_PREPARATION_CHANNEL_PROFILE은 installation, 고정 HTTPS origin/CA·hostname 검증 기준, profile fullref/발급·만료·회수·rollback 하한, 허용 목적, recipient/factory·발급자 근거를 고정한다. Main은 **배포 시 고정되는 별도 목적의 검증된 공개 envelope**를 권장한다. publisher catalogue의 코드 origin/CA를 자동 전용하지 않는다. renderer/env/임의 JSON이 profile을 선택하지 못하게 하고 실제 보호 producer가 없으면 default UNAVAILABLE다. 실제 CA/키 생성·신뢰 저장소·서버 설정 변경은 이번 source 채택과 분리한다.

## 8. 전달·ACK·유실

기존 내부 deliver의 exact6 metadata+별도 opaque43·ATTEMPTED 선행 COMMIT·호출1회·CONFIRMED/UNCONFIRMED 계약을 유지한다. 전송 프레임은 새 native 전용 binary length framing을 권장하며 HUMAN JSON/IPC/UI로 비밀을 보내지 않는다. 프레임은 authority 원형·고정 binding·기존 metadata 및 별도 opaque를 구분하고 총2MiB/대기 buffer4MiB를 넘기지 않는다.

원 deliveryId/ATTEMPTED fullref는 기존 exact6에 임의 필드를 섞지 않는다. server adapter가 같은 authority의 유일한 선커밋 원 사건을 보호 조회해 wire/ACK와 결박한다. 복수/부재/문맥 변경은 전달 전에 닫는다.

recipient는 authority.parent.commandRef와 offer의 최종 commandHash·recipient/profile/위임을 확인한 뒤 해당 authority의 휘발 slot에 수용한다. ACK는 원 bytes commitment와 그 시점의 검산을 증명할 뿐 내구 저장·재시작 복원·native/Agent 실행을 증명하지 않는다. ACK snapshot과 signature를 비밀 없이 저장하고 그것으로만 ackRef를 만든다.

ACK 저장과 기존 DELIVERY_CONFIRMED/UNCONFIRMED 사건 COMMIT을 구분한다. 로컬 실제 소비는 원 서버 terminal 사건/current를 검산한 뒤에만 시작한다. callback/stream 알림은 권위가 아니며 별도 readback을 대신하지 않는다. 알림·ACK·COMMIT 유실은 UNKNOWN/UNCONFIRMED, 원 attempt 유지·자동 비밀 재전달/재발급0이다. recipient 재시작은 window/ARM/opaque를 비활성으로 두고 새 키·credential로 조용히 복구하지 않는다.

## 9. 새 보호 기록·한도·상태 — 권장안

windows/sessions/offers/command-bindings/acks/events의6종 보호 기록과 forward SQL을 제안한다. row 원형/불변 ref·정확 버전/상태 head/부모 FK를 정의한다. 원 registration/authority·과거 SQL/이력은 보존한다. 원 command-binding 완결과 정확 native 실행기한을 DB guard와 현재 reader가 함께 검산한다.

- 프로젝트 누적 새 기록10000개·canonical metadata64MiB, 기존 프로젝트10GiB에 collector로 포함. 자동 삭제 OFF.
- 생성 전 기존 지속 예약 원장과 같은 Tx에서 실제 payload+최대 lifecycle metadata를 예약한다. window 안전 종료용 여유와 offer당 terminal/취소·회수 기록 여유를 선예약하며, 부족하면 새 window/offer만 거절한다. 결과 불명은 사용량0으로 해제하지 않는다.
- window당 offer50개/동시ARM1·session1, frame2MiB/buffer4MiB·window 총수신100MiB. 동일 요청/정확 version·원 commandHash·한정 recipient를 검산한다.
- 포화 시 과거 조회·기존 안전 종료/회수는 예약된 범위에서 유지하고 신규 발급은 차단한다. 기존 프로젝트 차단을 자동 해제하지 않는다.

상태: OFFERED→ARMED→COMMAND_BOUND→DELIVERY_ATTEMPTED→ACK_CONFIRMED 또는 UNCONFIRMED/UNKNOWN. 원 COMMIT 전 CANCELLED/EXPIRED와 이후 결과 불명을 구분한다. 정확 schema·record/event byte 대수·collector 중복 집계 방지는 기술 검토에서 닫아야 한다.

## 10. 채택 전 반드시 닫을 사항·검수

r1은 의도적으로 다음을 기술 검토 항목으로 남긴다. 미정 항목을 승인된 값으로 구현하지 않는다.

1. createWindow→고정 실행기의 window 발견/실제 시작·종료 caller와 일반 Web/모바일 정상 흐름.
2. 모든 새 proof·profile·위임 current wrapper·ACK/command-binding·사건의 exact schema와 nonce/replay 순서.
3. old policy/current 검사 중 controller 동일 관계만 대체하는 정확 source/SQL predicate 행렬. 원 정책의 독립 DENY를 제어권 변경과 혼동하지 않음.
4. binary framing/서버 terminal 알림·ACK 저장과 original delivery 결과의 원자 경계.
5. 기록/예약/collector 원형과 종료 headroom의 실제 최대 byte·개수 대수.

기술 검토 후 의미 범위/새 위험을 정리해 신산님께 source-only 채택을 요청한다. 채택 전 sourceGO0다. 이후 검수는 실제 producer→offer/ARM→원 native command→전달/ACK→원 private signing/current/consume의 정상과 중요한 거절·유실을 메모리/합성 저장에서 확인한다. 실제 DB·정책·키·서비스·C#/OS·Agent/운영·Oracle 실행은 별도 제외다. 이 계약만으로 작업계획서 전체 완료나 실제 기존 Agent 연결 완료를 주장하지 않는다.
