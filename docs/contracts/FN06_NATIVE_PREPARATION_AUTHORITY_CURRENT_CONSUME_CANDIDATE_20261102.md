# FN06/FN08 native 준비 전용 권위·current/일회 소비 — 결정 후보 r2

2026-11-02 / Main 어울 / DRAFT_REVIEW_REQUIRED / 미채택 / 제품·SQL 구현 GO 아님

## 1. 왜 다음 선행인가

계획 FN06→FN08의 실제 코딩 Agent 작업을 완성하려면 합성 fact/grant/permit과 실제 권위를 구별해야 한다. writer B는 원장 source와 보호 조회를 구현했지만, 부모 B §6은 native PREPARE_CURRENT scope·신뢰된 current/consume 채널과 actual fact/permit을 후속으로 남겼다. 현재 실제 credential은 REGISTRATION_STATUS_ONLY뿐이며 execution credential/current/challenge/permit은 합성 전용이다.

실제 START grant만 먼저 붙이면 ‘ACTIVE여야 native 준비 가능 / native 관측이 있어야 ACTIVE’의 순환이 생긴다. 따라서 이 후보는 **RESERVED lease의 native 경계 준비만 검산·한 번 소비하는 권위 source**를 먼저 정의한다. 코딩 Agent START/SEND·업무 실행 권한을 주지 않는다. 이후 actual START의 fact/grant/permit/전달 직전 source 연결은 별도 남는 업무이며 이 후보로 완료하지 않는다.

정본 근거는 WORK_PLAN의 FN06/FN08·FUNCTION_WORK FN06/FN08, writer B 후보 BF19670DAF44B01D2EAA12CB4CB8661AB573A77CF6133A5B3EC4FBAD8885533D와 직접 승인63C7EECF, 현재 code77352ea8·UI458345a3 및 게시9cfb04536f5c7f3c0ec07292f7eef003a1f7829e다. 기존 후보의 미정 사항을 현재 사용자 승인으로 꾸미지 않는다.

## 2. 실제 코드 대조와 새 delta

| 기존 근거 | 재사용할 것 | 그대로 바꿀 수 없는 것 |
|---|---|---|
| registration-protocol.ts의 등록/세대/회수·키 지문 | 등록 원형·현재성 검산 | STATUS_ONLY의 grants:[]/실행false를 준비 권위로 사용 금지 |
| execution-proof.ts의 정확 target/P256/canonical 검산 | 저수준 서명·hash 연산 | 기존 EXECUTION_REQUEST_PROOF 목적/합성 grant context를 새 권위로 재명명 금지 |
| execution-challenges.ts의 nonce·원자 소비 패턴 | 정확 request/nonce·저장전후 current·원결과 보존 | 기존 SYNTHETIC_ONLY store/credential은 실제 준비 발급자가 아님 |
| D1 0039 정확5표와 원 preparation reader | 원 scope·command/receipt/audit·nativeFactory fullref 검산 | 기존 transport/정확 kind·payload·합성 표식을 actual로 승격 금지 |
| writer 0070 event/head 및 보호 current | 정확 head/epoch/lease·원 RESERVED·등록/scope·이력 | HUMAN GET은 host 인증 채널이 아니며 관측 proof는 준비 요청 허가가 아님 |

0039/0070은 기존 synthetic executions 행 FK를 요구하지 않는다. 따라서 동일 executionId/generation을 원 준비/lease에 먼저 고정할 수 있고, 실제 준비를 위해 가짜 합성 실행 행을 만들 필요가 없다. 기존0017/0018/0024는 합성 실행/grant/claim/held outbox·proof/permit을 복합 FK와 완결 guard로 묶는다. 후속 actual START 저장을 선택하려면 별도 버전/forward 분기를 검토해야 하며 이번에 이 제약을 변경하지 않는다.

새로 채택할 의미는 (a) 준비 전용 목적 credential의 발급·보호 전달 source, (b) 동일 RESERVED 원 근거의 current/nonce/한 번 소비, (c) 그 저장·조회/유한 한도다. 기존 writer B/A나 계획 일반 승인에 이미 포함됐다고 하지 않는다.

## 3. 대안과 Main 권장안

**A — 별도 준비 권위/사건 2표와 새 목적의 source 계약(권장).** 기존 D1 정확5표·writer2표·합성v1/0017~0024는 보존한다. 원 preparation 명령·실제 영수증을 부모로 같은 lease의 위임을 별도 보관하고 새 current/consume 입구에서만 소비한다. 새로운 인증·저장 계약 채택은 필요하다. 표가 생겨도 물리 supplier나 Agent가 연결되는 것은 아니다.

**B — 기존 D1 사건/준비 저장 계약 확장.** 기존 종류/payload·정확5표 guard·기존 reader·HUMAN 원결과와 준비/관측 의미를 함께 변경해야 한다. 새 표 수는 줄일 수 있으나 기존 합성/준비 증거와 신규 권위가 섞이고 영향이 넓다. B를 택한다면 그 전체 변경을 다시 고정해야 하며 Main이 이번에 임의 적용하지 않는다.

아래는 A의 구체적 source-only 채택 대상이다. 실제 발급·키/정책 적용·HTTPS/OS/native/Agent 실행 승인이 아니다. r2는 r1의 C0/I3 및 원 HUMAN 생산 경로 부재를 반영한 미채택 초안이다. 정확 계약 검토 뒤 최종 결정 범위를 요청한다.

## 4. 권위의 정확 대상과 수명

새 내부 namespace는 NATIVE_PREPARATION_AUTHORITY_V1, credential 목적은 NATIVE_PREPARATION_ONLY다. 허용 operation은 CHECK_NATIVE_PREPARATION_CURRENT와 CONSUME_NATIVE_PREPARATION뿐이다. Agent START/SEND/도구 승인·프로젝트 source 내용 쓰기·명령 실행·일반 파일 조사·권한 확대는 허용하지 않는다. 물리 boundary 설치가 별도 OS/권한 변경을 요구하면 해당 supplier는 그 승인/지원 없이는 UNAVAILABLE다.

불변 grant snapshot의 정확 필드:
- schemaVersion:1, purpose:NATIVE_PREPARATION_AUTHORITY, authorityId UUID, credentialId UUID, credentialGeneration 양의 안전 정수.
- scope: installationId/projectId/executionId UUID, executionGeneration/authorityEpoch 양의 안전 정수, leaseId UUID, writerHeadRef/registrationRef/preparationRef/nativeFactoryRef의 exact fullref, hostPublicKeyFingerprint/sourceScopeHash의 SHA256.
- subject: 기존 WriterSubject 정확5필드(userId/clientId/humanSessionId/controlGeneration/credentialGeneration).
- parent: 실제 원 preparation commandRef/authorizationReceiptRef/auditRef의 exact fullref. 외부 commandId와 server command ID를 혼동하지 않는다.
- policyRef, channelProfileRef의 exact fullref, allowedOperations의 정확2개, issuedAt/expiresAt의 ISO instant.
- codingAgentExecutionAuthorized:false, agentDispatchPerformed:false.

grant fullref는 별도 id/version1/contentHash이며 snapshot에 자기 fullref/hash·미래 사건/consume 결과를 넣지 않는다. credential digest는 snapshot/일반 응답 밖의 보호 열에만 두며 원문 token·키/DSN·사용자 원문은 grant/감사/로그에 넣지 않는다. 원문 command/receipt/audit를 새 JSON 선언으로 대체하지 않는다.

새 발급/current/최초 소비는 원 head가 정확 RESERVED이고 같은 subject/제어·등록·scope·원 preparation/nativeFactory를 현재 검산한 경우만 가능하다. head 세대·phase/lease·등록·원 주체가 달라지면 기존 row가 남아 있어도 새 행동은 거절한다. EMPTY_AT/ACTIVE/UNKNOWN/RECLAIM_PENDING/RECLAIMED_AT는 이 준비 권위로 쓰지 않는다.

expiresAt은 issuedAt+120초, 원 writer/head·준비·HUMAN/재인증·정책·등록·원 증거 기한의 최솟값이다. challenge/소비 proof는 추가로 최대30초이며 이 최소를 연장하지 않는다. 새 checkedAt으로 옛 증거를 갱신하거나 만료를 회수·빈 상태로 해석하지 않는다. lease 갱신·새 사용자/새 credential·새 authority 자동 발급0이다.

## 5. issuer·보호 전달·요청 proof

현재 prepareOwnershipAnchor의 PLAN·stage/store는 합성 전용이며 공개 HUMAN 생산 경로/정책 목록/승인 요청 producer와 제품 caller는 없다. 이 후보는 이를 완료된 경로로 가정하지 않는다. 새 HUMAN prepareNativeBoundary와 보호 읽기 readNativePreparationAuthority, 원 불변 NATIVE_BOUNDARY_PREPARATION_INTENT 및 명시 writer reserve 소비 분기를 함께 채택 대상으로 제안한다. 기존 D1v1/prepareOwnershipAnchor의 AUTO·approvalRef:null/합성 원형은 보존한다. AUTO만 지원하는 것으로 새 기능을 축소하지 않고 새 producer는 AUTO·REQUIRE_APPROVAL·DENY를 모두 기존 FN11 의미로 처리한다.

새 grant의 부모는 이 새 HUMAN 명령의 실제 command/authorization receipt/audit와 원 불변 intent다. 현재 로그인/OWNER·단독 제어·재인증·명시 prepareNativeBoundary 정책과 필요한 정확 일회 승인을 검사한다. 단순 host 등록/STATUS_ONLY·caller actor/phase/verified:true는 근거가 아니다. fresh 준비는 현재 EMPTY_AT/RECLAIMED_AT의 정확 old head에서만 시작한다. 새로운 intent는 그 old head/원 입력만 포함하고 미래 RESERVED head/authority hash를 넣지 않는다. 원 receipt를 intentRef에 결박→같은 Tx에서 새 intent를 검산하는 명시 reserve 분기로 RESERVED/head 생성→그 head를 가리키는 authority 생성 순서다. grant hash를 원 intent나 원 receipt target으로 역참조하지 않는다. issuer·예약·승인 소비·원 영수증·새 grant/사건이 일부만 commit되지 않도록 최종 완결을 검사한다.

이력 재확인은 현재 인증/프로젝트 OWNER·단독 제어/명시 read 정책으로 접근을 먼저 검사하고 정확 원요청/원 결과를 찾은 뒤 반환한다. 새 발급/fresh current/최초 consume에만 RESERVED/원 기한·fresh 재인증 조건을 적용한다. ACTIVE 전환/원 grant 만료가 역사 receipt를 새 결과로 바꾸지는 않는다. native credential 자체가 만료/회수돼 현재 접근 인증을 통과하지 못하면 host 재조회는 거절하고, 허가된 HUMAN 읽기에서 원 이력을 확인한다. replay는 새 nonce/token/delivery/callable capability를 만들지 않는다. 새 기능이 옛 미발급 RESERVED row에 발급을 소급 추가하거나 원 명령 replay에 새 효과를 보태지 않는다.

신뢰 채널의 제안은 고정 origin·현재 승인된 TLS trust profile에 결박된 HTTPS와 등록 host P256 요청 proof다. 새 서버 서명 키/CA를 자동 생성하지 않는다. channelProfileRef의 보호 공급자·현재 origin/등록/키 세대 검산·비밀 전달 경로가 없으면 issuer/client 모두 기본 미등록·UNAVAILABLE다. 실제 인증서를 읽거나 설치하는 실행은 포함하지 않는다.

credential의 비밀값은 향후 허가된 issuer에서만 새 유한 난수로 만들며 서버는 digest만 저장한다. 실제 source 검증은 고정 합성 값/공개 서명 벡터를 사용한다. 비밀은 명시 보호 delivery 포트로 정확 host에 최대1회 전달하며 일반 HTTP 결과·Git·대화·로그에 담지 않는다. 전달 시도는 먼저 내구 기록, 응답 불명은 DELIVERY_UNCONFIRMED로 남기고 자동 재전달·재발급하지 않는다. delivery 포트 없는 상태에 빈 성공 함수를 넣지 않는다.

새 proof request는 정확8필드 requestId,method,path,queryHash,bodyHash,authorityRef,credentialGeneration,serverNonce다. 서명 원문은 UTF-8 canonical({purpose:'NATIVE_PREPARATION_REQUEST_PROOF',request})로 고정한다. writer 관측 NUL domain/기존 EXECUTION_REQUEST_PROOF와 섞지 않는다. authorityRef는 이 namespace의 저장된 exact grant만 가리키며, key 지문·등록·scope·기한과 같은 target/body를 대조한다. serverNonce는 credential 비밀이 아닌 일회 challenge 값이다. 동일 challenge 재확인을 위해 보호 event 원문에 저장하며 일반 감사/오류에는 digest만 둔다. host에만 같은 원 challenge를 재조회하고 새 nonce로 바꾸지 않는다.

## 6. 한정 API·원자 소비와 factory 경계

새 입구는 source 기본 미등록이며 일반 Agent/브라우저 operation이 아니다.
- GET /api/v1/connector/native-preparations/:authorityId/current: 새 목적 credential과 현재 등록/원 HUMAN·grant/RESERVED tuple을 검산해 최소 상태/원 ref/고정 기한만 읽는다. current 조회는 token·challenge·factory 권한을 생성하지 않는다.
- POST /api/v1/connector/native-preparations/:authorityId/challenges: 준비 전용 credential/현재 tuple 아래 정확 target/bodyHash/requestId에 challenge1개만 보관한다. STATUS_ONLY/합성 execution credential은 거절한다.
- POST /api/v1/connector/native-preparations/:authorityId/consume: 새 목적 proof·원 challenge/current를 같은 transaction에서 일회 소비한다. 같은 request 재확인은 원 불변 소비 receipt만 반환하고 다른 request/target·nonce 재사용은 거절한다.
- GET /api/v1/projects/:projectId/native-boundary-preparation-options: 현재 HUMAN의 read 정책 아래 원 head와 현재 보호 등록/준비 공급자의 선택 가능 ref/label/sourceScopes·지원/기한만 읽는다. 호출자 선언이나 저장 HUMAN 능력 보고로 현재 지원을 만들지 않는다. 실제 supplier가 없으면503이며 기본 미등록이다.
- POST /api/v1/projects/:projectId/native-boundary-preparations: 새 prepareNativeBoundary 원명령을 FN11의 정확 입력/현재 정책·승인/영수증으로 생산한다. 요청/결과의 정확 형식은 §10이다. source 실행 의존성은 기본 미등록이며 코딩 Agent/native를 호출하지 않는다.
- GET /api/v1/projects/:projectId/native-boundary-preparations/:preparationId: 새 readNativePreparationAuthority 정책으로 원 intent/grant·내역/현재 사용 가능 여부를 읽는다. 역사 조회로 새 권한을 발급하지 않는다. 준비Id는 intentRef.id이며 host authorityId와 구분한다.

project lock→현재 writer head→원 준비/권한/예산·등록→authority/challenge 순서와 같은 PoolClient/transaction을 사용한다. 원 명령/영수증/audit·native authority·일회 nonce/소비의 앞뒤 current와 저장 await 뒤 최소기한을 검산한다. COMMIT 미확정은 성공/새시도로 바꾸지 않는다. 소비 receipt hash에 미래 native 결과/head hash를 역참조시키지 않는다.

CONSUME_COMMITTED는 허가된 factory 호출의 선행이며 native 생성 성공이 아니다. 첫 정상 응답에서만 신뢰된 channel/connector 내부 일회 capability를 만들 수 있고, 재조회/재시작/복원된 JSON·영수증 자체는 callable capability가 아니다. capability를 쓰기 전에 connector는 자기 원 시도 기록과 현재 tuple을 다시 검산한다. nativeFactoryRef의 원 공급자에 최대1회 전달하고 결과 불명에는 자동 재호출하지 않는다. 기존 SyntheticOwnershipPreparationStore/합성 factory를 actual로 이름만 바꾸지 않는다.

원 native 준비/두 LEASE_CURRENT 관측이 writer에 채택돼 ACTIVE가 된 뒤에만 후속 actual START 계약을 사용할 수 있다. 이 권위로 코딩 Agent 프로세스·세션/지시를 시작하지 않는다. 실제 factory/보호 local attempt·현재/consume supplier 미구현은 별도 남기며 HTTP JSON이나 원장 row 존재로 충족했다고 하지 않는다.

## 7. A의 새 저장과 한도 제안

1. native_preparation_authorities: project/authority 식별·불변 version1/hash/snapshot과 원 preparation intent의 별도 id/version1/hash/snapshot sidecar, credential digest 보호 열, 부모 원 command/receipt와 scope의 exact 결박. 같은 Tx에서 원 intent를 먼저 고정하고 RESERVED 뒤 grant를 완결한다. project/intentRef·원 serverCommand 및 project/lease·원 준비의 유일 발급 키를 둔다. 이 새 intent는 기존 D1 준비 사건인 척하지 않는다.
2. native_preparation_authority_events: authority별 append-only sequence/previous fullref/hash·project 전역 sequence·kind·원 request/nonce/proof/receipt/delivery ref·at/expiresAt. kinds는 AUTHORITY_CREATED,DELIVERY_ATTEMPTED,DELIVERY_CONFIRMED,DELIVERY_UNCONFIRMED,CHALLENGE_ISSUED,REQUEST_PROOF_ACCEPTED,CONSUME_COMMITTED,CONTEXT_INVALIDATED다. payload는 종류별 닫힌 필드로 고정하며 arbitrary JSON을 권위로 받지 않는다. challenge1/proof1/consume1/비밀 전달시도1을 exact authority에 한정하고 지연 완결 guard로 연결한다.

기본 RLS false/DML 거절·immutable/unique/FK·역방향 완결을 미적용 forward SQL로 정의한다. 기존 적용/미적용 SQL 원본·manifest·역할·정책을 수정/적용하지 않는다. 새 namespace가 기존 authority proof를 대체하지 않는다.

숫자는 **새 결정 제안**이며 writer A의 자동 전용이 아니다: 프로젝트 전체 epoch/lease의 두 표 record 합계10000, canonical wrapper 합계64MiB, 개별 snapshot/payload2MiB·전체event4MiB, 기존 project used/held와 합산10GiB를 제안한다. authority별 challenge/proof/consume/deliveryAttempt는각1이다. 만료/실패/소비완료도 누적 분모에 남고 자동 삭제/환급/초기화0이다. 실제 합산 공급자가 없으면 fresh 발급/소비는 미등록/거절한다.

별도 close 공간 예약은 이 r2에서 제안하지 않는다. 포화 시 fresh challenge/소비/불명 기록도 원자 거절할 수 있고, 이미 발급한 row/원영수증·보호 읽기/재확인은 보존한다. 기록을 못 남긴 실제 결과를 성공/회수로 만들지 않는다. 이는 source-only 저장 정책 제안이며 실제 native 실행에서 필요한 자원 회수/기록 가용성 검증이나 writer A의 포화 한계를 해결하지 않는다. 물리 활성화 전 그 미충족을 별도 gate로 남긴다.

## 8. 채택 시 source 구현·검수 범위

A를 채택하면 별도 상세 WI에 파일별 책임·정확 허용 경로를 고정하고 기존 Primary 한 명에게 새 HUMAN producer/선택·원명령·승인/역사 읽기 화면과 host current/consume의 코드·미적용 SQL·합성 검증을 맡긴다. 원 writer/D1/합성v1/저장/원영수증을 보존하면서 실제 issuer/current/challenge/consume 저장·보호 채널 client 및 일회 factory 소비 접점까지 연결한다. 미사용 parser만 추가하고 완료라고 하지 않는다. 기본 공급자는 미등록이며 실제 endpoint/credential/factory 활성화0이다.

필수 검수는 원 예약/parent refs·서명 목적/다른 target·STATUS_ONLY/합성 credential 거절·현재 subject/control/등록/head 변화·최소기한·await 저장 뒤 변화·nonce/중복/원 replay·비밀 전달 불명/COMMIT 불명 재발급 금지·factory 호출1회·포화/원행 보존이다. 고정 합성 proof/메모리 transaction/제한 client·factory 대역을 사용하며 실제 발급/키·DB·서비스·Agent·실자료·P03 R3·OS/native/compiler는 실행하지 않는다. 실제 provider와 전용 TLS/보호 delivery/local attempt·OS 회수의 미구현을 테스트 대역 PASS로 덮지 않는다.

## 9. 결정과 미포함

필요 결정은 A의 새 HUMAN prepareNativeBoundary/readNativePreparationAuthority·원 intent/명시 writer reserve 분기·UI11 선택/승인/이력 소비와 준비 전용 권위2표/한도·scope/namespace/proof/current/원자소비 source 계약을 함께 채택할지다. 이것은 기존 B의 재승인 요청이 아니라, B가 미정으로 남긴 새 목적 credential/current/consume·저장 계약이다. 실제 사용자 권한 부여/키 생성·신뢰 변경/DB 적용·물리 native·Agent 실행/P03 R3는 승인 대상이 아니다.

actual START의 별도 fact/grant/permit/전달·actual SEND/STOP/회수/관측 ACK·장기 lease 갱신·사용자 인수와 전체계획은 남는다. 실제 공급자가 없는 상태에서 실제 권위를 발급·지원했다고 표시하지 않는다. 독립 검토로 r1의 미정·모순을 보완한 뒤 필요 결정·지원만 PMO에 요청하고 영향받지 않는 기존 승인 작업은 계속한다.
## 10. r2의 정확 wire·내부 포트와 로컬 시도

### 10.1 HUMAN 생산·선택·원 결과

새 prepareNativeBoundary 요청은 기존 ProjectCommand 정확11필드다. operation만 새 이름이며 projectId는 경로와 동일, targetId/expectedVersion은 payload.expectedWriterHeadRef의 id/version, baselineRefs는 정확 [expectedWriterHeadRef]다. payload는 정확 {registrationRef,nativeFactoryRef,sourceScopes,expectedWriterHeadRef,reason}. 세 ref는 exact fullref, sourceScopes는 기존 SourceScopeV1·targets200/2MiB 제한, reason은 기존 이유 검사/최대20000자다. actor/session/credential 세대·executionId/generation/leaseId·시각은 HTTP 선언으로 받지 않는다. 서버가 현재 인증/제어·저장된 등록/허용 factory/현재 source 근거에서 생산·대조하고 고정한다.

REQUIRE_APPROVAL은 새 operation을 명시한 기존 ApprovalRef·원 payload hash/target/버전/기한에만 일회 소비한다. AUTO에 임의 승인을 끼워 넣거나 DENY를 우회하지 않는다. 원 HUMAN 결과는 기존 ProjectCommandResult와 data의 정확 {ref:preparationRef,status:'NATIVE_BOUNDARY_PREPARATION_RECORDED',preparationIntent,commandSnapshot,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false}다. 이 결과의 authority 발급/기존 원장 RESERVED·사건 완결이 같은 transaction에서 성공해야 응답한다. 미래 authorityRef를 결과에 억지로 역참조하지 않으며, 후속 명시 GET은 preparationId로 authority를 조회한다. 원 결과 replay의 data/ref/hash/시각은 유지한다.

새 preparationIntent snapshot은 정확 {schemaVersion:1,purpose:'NATIVE_BOUNDARY_PREPARATION_INTENT',intentId,scope,subject,sourceScopes,expectedWriterHeadRef,policyRef,at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false}. scope는 정확 {installationId,projectId,executionId,executionGeneration,authorityEpoch,leaseId,registrationRef,nativeFactoryRef,sourceScopeHash}. IDs/세대/ref/hash는 §4의 형식이며 subject는 WriterSubject다. expectedWriterHeadRef는 준비 직전 old head다. 이 intent/ref를 새 native authority sidecar에 보관하고 새 reserve 소비 분기는 그 원 command/receipt/audit와 현재 EMPTY_AT/RECLAIMED_AT를 검산한다. 기존 reserveWriterAuthority의 D1v1/합성 소비를 변경하거나 자동 승격하지 않는다.

options 응답은 정확 {schemaVersion:1,projectId,writerHead,items,observedAt,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false}. writerHead는 기존 WriterHead exact/hash이며 EMPTY_AT/RECLAIMED_AT만 선택 가능, items는 최대200의 {registrationRef,nativeFactoryRef,label,sourceScopes,support,evidenceRefs,expiresAt}다. label은 검증한200자이하텍스트, support는 VERIFIED_PREPARATION_SUPPORTED/UNVERIFIED/UNSUPPORTED, evidenceRefs는 최대200의 고유 fullref다. VERIFIED는 보호 current 공급자의 같은 등록/factory/source/기한 검산 없이는 만들지 않는다. rows없음은 준비 가능이 아니다. 전체 canonical 응답2MiB 초과·공급자 없음은 닫힌 오류다.

HUMAN 고정 조회는 정확 {preparationRef,preparationIntent,authority:{ref,snapshot},events,currentStatus,observedAt}. events는 아래 typed event의 exact ref/snapshot 최대16개, 전체 응답4MiB 이내이며 credential digest/비밀값은 포함하지 않는다. currentStatus는 RECORDED/DELIVERY_UNCONFIRMED/ELIGIBLE_FOR_NATIVE_CONSUME/CONSUMED/EXPIRED/CONTEXT_CHANGED/UNAVAILABLE다. 이는 새 factory 실행 결과가 아니다. read 정책이 없거나 타 프로젝트면 존재를 은폐한404다. UI11은 보호 options로 제공된 등록/factory/source 범위만 선택하고 raw token·물리 경로·임의 actor/ID 입력으로 채우지 않는다. 원 명령/승인/미확인 결과를 보존하며 소비/확정/실제 실행은 별도다.

### 10.2 host 입력·응답과 replay 순서

모든 native endpoint는 Authorization: Bearer의 새 목적 opaque credential만 받는다. query/cookie·STATUS_ONLY/합성 실행 credential은 거절한다. credential 원문을 URL/일반 응답/로그에 담지 않는다. 고정 origin과 channelProfileRef의 pinned TLS를 재검산하며 redirect0이다.

current는 GET, query/body없음이며 성공 응답은 정확 {authorityRef,writerHeadRef,registrationRef,scopeHash,phase:'RESERVED',checkedAt,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false}다. 고정 grant 기한보다 넓은 current 응답을 내지 않는다. 이는 consume/factory capability가 아니다.

challenge POST 본문은 정확 {schemaVersion:1,requestId,authorityRef,localAttemptRef,target:{method:'POST',path,queryHash,bodyHash}}. requestId는UUID, localAttemptRef는 §10.3의 실제 PREPARED fullref다. path는 해당 authority의 consume 경로·queryHash는 빈 query의 기존 executionTarget 규칙이다. bodyHash는 정확 consumeBody={schemaVersion:1,authorityRef,localAttemptRef}의 canonical hash와 대조한다. 같은 requestId/원본문 재조회는 같은 nonce/challengeRef를 읽고, 다른 내용은409다. 성공 응답은 정확 {challengeRef,requestId,authorityRef,localAttemptRef,target,serverNonce,issuedAt,expiresAt}. 이 값의 원 snapshot과 nonce를 보호 저장해 정상 재확인을 보장한다. 새nonce 재발급/자동갱신은 없다.

consume POST 본문은 위 consumeBody와 같고, 새 proof 요청8필드/requestHash·P256서명은 전용 보호 header에 전달한다. 정확 header명은 x-anvil-native-proof(8필드의 canonical JSON을 base64url), x-anvil-native-signature(P256 P1363 signature base64url)이며 중복/확장/잘못된base64url을거절한다. proof.method/path/queryHash/bodyHash/authorityRef/credentialGeneration/serverNonce는 원 challenge와 일치해야 한다.

consume의 성공 응답은 정확 {receipt,recordRef,disposition,factoryPermit}. recordRef는 아래 CONSUME_COMMITTED 사건의 exact fullref다. receipt는 exact fullref/snapshot, snapshot은 {schemaVersion:1,purpose:'NATIVE_PREPARATION_CONSUME_RECEIPT',authorityRef,preparationRef,writerHeadRef,requestId,requestHash,challengeRef,proofEventRef,localAttemptRef,at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false}다. receipt를 hash한 뒤 이를 포함한 첫 factoryPermit을 만든다. receipt에 미래 permit hash를 넣지 않는다.

첫 정상 commit의 disposition은 FIRST_COMMIT, factoryPermit은 exact {ref,snapshot}. permit snapshot은 {schemaVersion:1,purpose:'NATIVE_FACTORY_SINGLE_USE',authorityRef,consumeReceiptRef,consumeRecordRef,preparationRef,writerHeadRef,localAttemptRef,requestId,requestHash,scopeHash,issuedAt,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false}. factoryPermit은 신뢰된 첫 응답에서 내부 capability를 만들기 위한 자료이지 raw JSON 자체가 callable 권한은 아니다. native factory가 이 객체를 임의 인자로 받지 않도록 소유 client/consumer의 비공개 일회 capability만 받는다. 서버 response는 실제 COMMIT 성공 이후에만 송신한다.

동일 exact consume 요청의 후속 응답은 disposition REPLAY_ONLY와 factoryPermit:null이며 같은 receipt/recordRef를 반환한다. 현재 등록/credential·프로젝트/scope 접근 검사는 하되, 원 완료 결과를 반환하는 경로는 fresh RESERVED/원 업무기한 검사보다 앞이다. native credential 자체가 현재 만료/회수돼 인증 불가면401/403이며 HUMAN 보호 조회에서 이력을 확인한다. ACTIVE 전환을 이유로 원 receipt를 새 consume 성공으로 만들거나 capability를 재생성하지 않는다. 동시 요청도 첫 commit만 FIRST_COMMIT이며 나머지는 REPLAY_ONLY다.

오류는 exact {code,requestId}의 비밀 없는 고정 코드만 사용한다. 형식400, 현재 인증/목적401/403, 타 scope/존재은폐404, 같은ID다른본문·이미다른요청소비/현재head변경409, 정책/원근거/기한·한도412, 공급자/완결/COMMIT불명503이다. 코드 enum은 INPUT_INVALID,NATIVE_AUTH_REQUIRED,NATIVE_PURPOSE_DENIED,NATIVE_AUTHORITY_NOT_FOUND,NATIVE_REQUEST_CONFLICT,NATIVE_CONTEXT_CHANGED,NATIVE_SOURCE_EXPIRED,NATIVE_CAPACITY_EXCEEDED,NATIVE_SOURCE_UNAVAILABLE,NATIVE_OUTCOME_UNKNOWN이다. requestId는 검산된 공개 UUID 또는 null이며 raw 예외를 담지 않는다. 503 결과를 자동 재요청/새 권위 발급으로 바꾸지 않는다.

### 10.3 내부 issuer/delivery와 factory 원 시도

issuer의 내부 입력은 같은 PoolClient/현재 AuthenticatedIdentity/검산된 새 ProjectCommand와 서버가 선택한 exact native current 근거다. body에서 주체·nativeFactory·source 사실을 받아서 바로 신뢰하지 않는다. 반환은 원 common receipt와 보관 authority/preparation ref뿐이다. token 생성·보호 전달 source는 등록/목적·channel readiness가 없으면 호출하지 않는다.

delivery 내부 입력은 exact {authorityRef,credentialId,credentialGeneration,registrationRef,channelProfileRef,expiresAt}와 별도 비밀 인자이며 일반 JSON 기록에 비밀 인자를 합치지 않는다. 출력은 exact {state:'CONFIRMED',ackRef} 또는 {state:'UNCONFIRMED',reason}. reason은 CHANNEL_UNAVAILABLE/DEADLINE/RESPONSE_UNKNOWN/CONTEXT_CHANGED다. 호출 전 DELIVERY_ATTEMPTED를 내구 commit하고 공급자에 최대1회 전달한다. 원 결과 재조회에 delivery를 다시 부르지 않는다. 현재 비밀 전달 supplier/credential issuer는 미구현·기본 미등록이며 채택 source에서 닫힌 기본값을 유지한다.

connector는 원 권위/기한/등록·scope와 current 응답을 대조한 뒤 challenge 전에 실제 보호 로컬 journal의 PREPARED record를 append/flush/readback한다. record snapshot은 exact {schemaVersion:1,purpose:'NATIVE_PREPARATION_LOCAL_ATTEMPT',authorityRef,preparationRef,writerHeadRef,scopeHash,requestId,at,expiresAt,state:'PREPARED'}이며 ref/hash를 만든다. 같은 authority에는 하나의 localAttemptRef만 있다. 이 원 ref가 challenge/body/proof/consume receipt/permit까지 같다.

factory 호출 전 같은 보호 journal에 {state:'FACTORY_ATTEMPTED',localAttemptRef,consumeReceiptRef,factoryPermitRef,at}를 append/flush/readback하고 현재/기한·원 tuple을 다시 검사한다. 실제 공급자는 raw JSON/fullref가 아닌 소유된 한 번 capability를 consume한다. factory 호출 결과는 KNOWN_NOT_CREATED/CREATED_OBSERVED/UNKNOWN으로 구분한다. CREATED_OBSERVED도 coding Agent 시작이나 writer ACTIVE가 아니며, 원 물리 증거가 별도 writer 관측 채택을 통과해야 한다.

재시작/응답 유실/COMMIT불명에서 journal이 ATTEMPTED/UNKNOWN이거나 서버가 CONSUMED인데 원 첫 응답의 소유 capability를 잃었으면 factory를 다시 부르지 않는다. 원 receipt/현재상태를 읽고 미확인으로 남긴다. 로컬 journal·durable readback/current/factory supplier 부재/불완전 history는 UNAVAILABLE다. 메모리중복검사나 서버소비만으로 로컬실행at-most-once검증완료라고하지않는다. 실제 local store/native 실행은 이번 채택 후보의 source 설계/합성 검증과 미래 실행 승인을 구분한다.

### 10.4 새 사건의 닫힌 payload와 한도

모든 새 사건 snapshot은 exact {schemaVersion:1,purpose:'NATIVE_PREPARATION_AUTHORITY_EVENT',projectId,authorityRef,sequence,previousRef,kind,actor,payload,at,expiresAt}다. actor는 {kind:'HUMAN',subject:WriterSubject} 또는 {kind:'REGISTERED_HOST',registrationRef,credentialId,credentialGeneration} 또는 {kind:'SERVER',channelProfileRef}의 닫힌 분기다. host 소비를 HUMAN이 직접 실행한 것으로 감사에 위조하지 않는다. 부모 HUMAN command/receipt/audit는 grant에 유지하고 native 사건은 보호 조회 가능한 별도 감사 이력이다.

kind별 payload는 다음 exact 필드다.
- AUTHORITY_CREATED: preparationRef,writerHeadRef,commandRef,authorizationReceiptRef,auditRef.
- DELIVERY_ATTEMPTED: deliveryId UUID,channelProfileRef,registrationRef,credentialId,credentialGeneration.
- DELIVERY_CONFIRMED: deliveryId,ackRef. DELIVERY_UNCONFIRMED: deliveryId,reason(위 enum).
- CHALLENGE_ISSUED: requestId,localAttemptRef,target,serverNonce,nonceDigest,issuedAt,expiresAt.
- REQUEST_PROOF_ACCEPTED: challengeRef,requestId,requestHash,signatureDigest,localAttemptRef.
- CONSUME_COMMITTED: challengeRef,proofEventRef,requestId,requestHash,localAttemptRef,writerHeadRef,receipt. receipt는 §10.2의 exact ref/snapshot이다. receipt를 먼저 hash해 payload에 넣고, 사건/recordRef를 hash한 뒤에만 첫 factoryPermit을 만든다. receiptSnapshot은 미래 recordRef/permitRef를 넣지 않고 사건 payload도 미래 permitRef를 넣지 않는다. 따라서 receipt→사건→첫 permit의 단방향이며 원 replay는 같은 receipt/recordRef와 null permit이다.
- CONTEXT_INVALIDATED: reason=REGISTRATION_REVOKED/CONTROL_CHANGED/HEAD_CHANGED/EXPIRED,sourceRef(실제검산한원fullref). current GET이이사건을자동생성하지않는다.

authority별 사건 최대16, credential전달시도1/challenge1/proof1/consume1을고정한다. 동일challenge 재조회는원nonce를보존하며기한지난challenge를새nonce로바꾸지않는다. 이후명시재준비/회수·재등록의성공경로는아직이후보로정의하지않았으므로자동재발급하지않는다. 최대2표 record10000/64MiB·project합산10GiB/포화한계는§7과같다. legacy D1/0070/v1 원문을확장하지않으며 source reserve의새intent입구/정책·승인원형만명시delta로추가한다.

## 11. 검토 이력·정확한 남은 경계

r1 SHA8ADA3D8A6B58768A596F38DC16A912E4FF4D8DE78DB857D49BA4C43D3B94AD85의 독립 C0/I3(역사 replay/fresh 조건 충돌, factory 원시도 결박 누락, exact wire/포트 누락)을 r2에보완했다. 추가 source 대조로 원 HUMAN 공개생산 경로부재·합성 AUTO전용원형을발견해새HUMANproducer/intent·정책/승인/명시reserve분기를후보에추가했다. 기존단계를이미완료했다고전제하지않는다.

이 후보가 actual 활성화의 최우선 전체선행을 해결한다는 뜻은 아니다. 초기 EMPTY_AT를 만들 실제 writer bootstrap evidence credential issuer/관측 supplier·신뢰 채널도 현재 미구현이다. 이 source 작업은 채택된 writer 모델/보호 근거를 소비하지만 실제 그런 상태가 이미검증됐다고가정하지않는다. 실제source/OS강제·키/전용credential발급·원nativefactory·목적별관측·성공회수·장기수명·actualSTART/SEND/STOP/ACK는여전히별도미구현/미검증이다.

A선택은2표와위HUMAN/host/read/UI·새purpose/정확한소비source계약만의채택이며, 실제DB/권한/키/인증서/서비스/실자료/native/Agent/P03R3실행승인이아니다. 이 r2를독립재검토한뒤필요결정을PMO로연결한다. 새구현GO/실행은아직0이다.
### 10.5 시간·전역 범위와 잔여 gate

원 current/consume/issuer/delivery 호출은 단계별 대기를 새로10초씩 늘리지 않고 해당 원 작업 전체 예산 최대10초와 최소기한 중 작은 값으로 묶는다. 네트워크 응답은 current/challenge/consume 최대2MiB, HUMAN fixed view 최대4MiB, redirect0·고정상대경로·중복JSON키/headers 거절이다. 응답/COMMIT 뒤 기한 소진이나 supplier 함수/등록·channel 변경도 거절·UNKNOWN이며 callable 결과를 반환하지 않는다. 중단을 요청했다는 사실만으로 외부 작업 종료를 주장하지 않는다.

connector는 원 요청 시작/응답의 단조 시각을 보관한다. permit의 server issuedAt/expiresAt 구간에서 전체 왕복 elapsed를 보수적으로 빼고, 원 grant/head/준비/채널의남은기한보다확대하지않는단조deadline을 만든다. 로컬 UTC 역행이나 새 current 응답으로 TTL을연장하지않는다. factory호출전·로컬저장await뒤·소유capabilityconsume직전에그deadline과current를검산한다. 실제강제만료/자원회수는검증된native공급자없이는지원으로표시하지않는다.

현재서비스/DB/권한·키/CA·Agent/native실행은여전히제외다. writer bootstrap용목적credential issuer·물리관측, native준비권위 issuer/delivery·보호localjournal·실제factory, actualSTART grant/permit/후속SEND·STOP는각실제미구현을구분한다. 새source구현시필요한내부생산·저장·보호소비코드까지연결하되공급자부재를빈성공으로대체하지않고기본미등록/거절을유지한다. 실제발급/실행은별도정확실행안·자원·지원/회수검수후에만가능하다.