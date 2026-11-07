# FN06 native 최초 수신·단일명령 위임·전달 계약 후보 R2

2026-11-03. **DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0**.

이 문서는 r1 기술검토9건과 후속 원형·원자성·대수 검토를 하나의 현재 후보 본문으로 통합한다. 새 공개 API·등록키 서명목적·교차-client 권한·보호 기록·통신 profile의 채택 전 제안이다. 기존 r2/r5 source 승인을 이 새 계약 승인으로 해석하지 않는다. 여기의 수치와 선택은 Main 권장안 또는 명시한 계산 조건이며 사용자 채택값이 아니다. 기술 하위 계산의 일치는 전체 계약 완결·구현 준비·실제 기능 성공이 아니다.

## 1. 기준과 보존

- 작성 기준 source HEAD d24ab749c2ad1578f58d1a9c4a00641d04141810, 기존 codex/av3-stage-b. 기존 제품·SQL·시험·원문은 변경하지 않는다.
- 원 r1: docs/contracts/FN06_NATIVE_RECEIVE_DELEGATION_DELIVERY_CANDIDATE_20261103.md, SHA F301A7B86EE0CE721F18B2872D69DA2B2FEE8437D5E41C649026388833D07176.
- 기술검토: docs/04_test_reports/AV3/FN06_NATIVE_RECEIVE_DELEGATION_TECH_REVIEW_20261103.md, SHA D5FDF6F9E1DCA779980B4324641221BF4507B8A7A9962A6D357E09794C707116.
- 후속 검토서 누적: SHA 93A5E76E4DF2AB14F5ABC99F49F68ADDF008AAECD41554E3645CC4A65EBA7D71. Main 소유 최신 누적이며 앞 D5FDF6F9 기준은 Git d24ab749에 보존한다. 이 문서는 검토서 원문을 수정하지 않는다.
- ARM/ACK 계산자료: docs/contracts/FN06_NATIVE_RECEIVE_ARM_ACK_SCHEMA_TECHNICAL_DRAFT_20261103.md, SHA 40030CE6F8ED11AF7D158B16B1DDB4547549B23EA45EE83DED7624BDEDBB124B.
- 기존 직접 승인 native r2 A SHA5C4AF434…E3085와 desktop trust r5 A SHAF6C8CB66…951E6는 부모 근거다. 기존 v1·등록·StatusOnly·flat/context 결과를 이 문서로 느슨하게 하지 않는다.
- WORK_PLAN/FUNCTION_WORK의 FN06/FN08/FN11/FN15/FN18 목표는 웹·모바일의 지시와 Anvil 소유 실행기 연결이다. 매 명령마다 PC 조작을 최종 해법으로 채택하지 않는다. 기존 native runtime 배송 source 검수는 실제 설치·보호 supplier·최초 전달·실행 증거가 아니다.

## 2. 목표·A/B·변경 경계

Main 권장 A는 명시적으로 허가된 유한 수신 절차, 서버의 정확 offer, 실행기의 소프트웨어 검산/단일 ARM, 원 native 명령, 최대1회 비밀 전달과 휘발 수용 ACK다. LLM 계정과 분리하며 프로젝트 권위·이력은 Anvil에 둔다. 꺼진 PC 앱을 모바일 명령으로 자동 시작하거나 재접속을 보장하지 않는다.

B는 사용자가 exact offerRef를 PC 로컬 화면에 넘기는 수동 handoff다. 최초 인증·위임은 A와 같고 발견 경로만 단순하다. 비교 대안이며 원격 자동 진행을 대체하지 않는다.

승인 경계는 다음과 같이 나눈다. supplier가 아직 없다는 사실만으로 기존 source 승인 전체를 재승인 대상으로 돌리지 않는다.

| 구분 | 범위 |
|---|---|
| 기존 채택 source의 내부 상세·재승인 불필요 | 고정 HTTPS supplier, 원 등록키 P256/기존 native proof, 별도 NativeOnly 비밀·최초 전달1회, CONFIRMED/UNCONFIRMED와 ackRef, 내부 Tx/CAS·불명 guard, 같은 계약의 정적 최대식·일반 구현 방법 |
| 새 결정 후보 | 현재 controller와 다른 recipient의 prelisten/단일명령 위임, 새 bootstrap/session/ARM/ACK의 등록키 서명 의미와 공개 wire, 새 profile 발급/회수 권위, 새 증거 저장·수명·계상·포화 의미 |
| 제외 | 실제 실행, 다른 사용자 위임, 옛 session 복구, 범용 기기 권한, writer 전환/옛 물리 증거 승격 |

내부 파일 배치·코딩 방식과 이미 채택된 supplier의 구체 구현은 Main 기술 판단 영역이다. 다만 새 공개·인증·저장 의미에 의존하는 부분은 그 결정과 분리해서 구현 완료를 주장하지 않는다. 실제 키·CA·권한·DB 적용·서비스·네트워크·C#/OS/Electron/helper·Agent·실자료·P03R3 실행 승인은 별개이며 이번 문서는 모두 요청하지 않는다.

## 3. 실제 닫힌 검사와 보존/대체 행렬

project-registration-reads.ts:40은 requested_by/client_id로 원 등록을 한정한다. :51~60 nativePreparationRecord는 현재 controller와 등록 control/credential 세대의 동일성을 요구한다. SQL0006:53~67 connector_basis_current는 원 user/client/session·OWNER·현재 제어의 client/control세대·등록 당시 policyRef·registerConnector 허용/DENY·기한을 검사한다. recent=false는 최근 재인증만 면제하며 나머지를 지우지 않는다.

모바일 제어로 이동하면 desktop의 ISSUED/TRUSTED 원사실은 남지만 위 현재성은 닫힌다. 다시 PC로 돌아와도 제어세대가 달라 자동복구되지 않는다. project-native-preparations.ts:96 host검사와 owner typed SIGN의 HUMAN scope.subject 대조도 같은 client/control을 요구하므로 options reader 한 곳 변경으로 닫히지 않는다.

| 검사 | 위임 경로의 제안 |
|---|---|
| 원 scope/hash·등록 생성 command/receipt·HUMAN 확인·키 지문·원 세대·ISSUED/TRUSTED·기한/회수 | 원값·이력 그대로 복원·검산 |
| 원 user/client/session 생존·사용자 credential세대·원 policyRef/정책 기한/명시 DENY | 그대로 보존. 만료 session/옛 정책을 위임으로 복구하지 않음 |
| 현재 actor.client와 원 등록 client 직접 동일 | 같은 사용자·정확 원 recipient의 단일명령 위임으로만 대체 |
| 현재 control세대와 등록 control세대 직접 동일 | 양쪽 원값 보존, 현재 controller의 한정 위임으로 연결 |
| 현재 HUMAN 인증/OWNER/제어/재인증/native 정책·원 일회 승인 | 현재 명령 조건으로 별도 검산; 사전준비가 native승인을 소비하지 않음 |
| writer head의 주체/세대·물리 관측·source scope | 실제 현재 유효해야 함. 수신 위임이 옛 head를 재작성·승격하지 않음 |

commandHuman, recipientHuman, writerHuman은 다른 역할이다. 앞 두 userId는 같아야 한다. writerHuman이 모바일 controller에 유효하지 않은 현재 source에서는 **수신 위임만으로 options/명령을 성공시킬 수 없다.** 원 관측을 보존한 별도 writer 선행을 정확히 해결해야 하며 본 후보가 이를 해결했다고 하지 않는다.

전용 ReceiverPrincipal/등록 projection reader는 원 등록의 무결성과 현재 위임의 대체 조건을 각각 검산한다. old HUMAN 객체를 현재 actor로 위장하거나 basis.current=false 전체를 무시하지 않는다. 일반 HUMAN GET·StatusOnly·connector_basis_current는 그대로다.

| 소비선 | 필요한 명시 증거 |
|---|---|
| recipient metadata/options | 현재 HUMAN 접근·목적 정책과 원 등록 projection·유효 writer/source/profile |
| offer/ARM | 최종 command와 내장 위임·원 recipient·현재 명령 주체·정확 stream |
| issuer/authority/binding | 원승인/receipt/audit·동일 Tx association·등록/물리 current |
| host current/consume | authority+binding+offer 위임·ACK/terminal·현재 양쪽 주체/기한 |
| local typed SIGN | 원 REGISTERED키/root/helper·offer/binding/delegatedCurrent·원 proof 문맥 |

## 4. 공통 typed 표기

모든 아래 객체는 exact keys/own data이며 추가키·getter·Proxy·부정확 prototype·중복 wire키를 거절하는 source 계약을 제안한다. canonical은 기존 규칙을 사용한다.

- Ref={id,version,contentHash}. UUID36·소문자hash64·양의 안전정수. version/nonce/키 세대를 혼동하지 않는다.
- Human={userId,clientId,humanSessionId,credentialGeneration,controlGeneration}.
- Recipient={installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,credentialGeneration,channelProfileRef}. 이 credentialGeneration은 원 등록세대다.
- Target={method,path,queryHash,bodyHash}. 고정 method/path·빈 queryHash·정확 canonical bodyHash만. 자기 proof/signature를 bodyHash에 넣지 않는다.
- nonce는32bytes의 canonical base64url43, 서명은 원 등록 P256/P1363의 canonical base64url86을 제안한다.
- hostPublicKeyFingerprint를 일관되게 사용한다. profile·CA·SPKI 원문을 R에 복제하지 않는다.
- authority는 기존 ref/snapshot, opaque는 별도43 ASCII bytes다. opaque/digest를 HUMAN/IPC/UI 응답에 반환하지 않는다. ACK의 공개 commitment는 별도 목적 보호 경계에서만 사용한다.

## 5. 시작 caller·session-first·발견·수명

실행기가 로컬의 명시 수신 준비(prelisten)를 시작할 때 등록키를 검산하고 **window 미결박 session**을 연다. renderer가 root/key/profile/origin을 고르지 못한다. 기존 REGISTERED 표시/trust-status IO0·앱 시작만으로 자동 수신을 시작하지 않는다. 모바일은 살아 있는 원 recipient에 대한 허가 window를 만들고, 그 실행기가 server의 유일한 정확 window를 검산해 결박한다. 임의 최신 pending command를 검색하지 않는다.

실제 local 버튼/typed IPC→main→보호 등록키→session→소유 stream, 일반 Web/모바일→HUMAN window/offer→지정 실행기까지가 필수 생산선이다. **기존4 trust IPC로 이 요청은 표현되지 않는다.** 새 method의 exact 요청/상태/epoch·닫기/취소를 고정해야 한다. remote preload 추가·cookie export·임의URL fetch·renderer좌표권위0. 실제 기본 supplier 부재는 UNAVAILABLE다. 종료된 앱 자동실행·무기한poll·silent 재접속은 없다.

Main 제안값(미채택): window≤2시간, offer≤120초, challenge≤30초; 모든 수명은 부모 등록/session/정책/profile의 최소기한. window당 offer≤50, 동시 ARM1, 등록/project별 활성window1, 수신session/stream1·미소비challenge1. 최초 proof 허용폭30초, 등록/키세대당 분당30·프로젝트 분당100도 제안일 뿐이며 시계오차·분모·원자 카운터·보존/예약 규칙은 미정이다. 서로 다른 요청으로 nonce/replay 원장을 소진하는 rate 공격을 단순 signature 확인으로 해결했다고 하지 않는다.

SessionSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_SESSION',sessionId,installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,channelProfileRef,localReceiveAttemptId,receiverPrincipal,policyRef,issuedAt,expiresAt}.

receiverPrincipal의 exact 필드는 미정이다. 최소한 원 recipient5키와 등록/connector/key 현재성의 실제 생산근거가 필요하며 임의 keyGeneration 필드를 기존 사실처럼 만들지 않는다.

ProofRequest={schemaVersion:1,purpose:'NATIVE_RECEIVE_SESSION_PROOF',phase,requestedPhase,requestId,installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,channelProfileRef,localReceiveAttemptId,sessionRef,windowRef,challengeRef,clientNonce,serverNonce,method,path,queryHash,bodyHash,issuedAt,expiresAt}; SignedRequest={request,signature}.

| phase | requestedPhase와 null 관계 |
|---|---|
| CHALLENGE/OPEN용 | requestedPhase='OPEN'; session/window/challenge/serverNonce는 아직 없으므로 null |
| OPEN | requestedPhase=null, 원 OPEN challenge만 소비; session/window는 아직 null |
| STREAM | requestedPhase=null; 원 session, 결박여부에 따른 window; OPEN 응답에서 생산한 STREAM nonce 사용 |
| CHALLENGE/STATE용 | requestedPhase='STATE'; exactsession·결박여부에 따른 window |
| STATE | requestedPhase=null; exactsession/window·STATE challenge |

phase=CHALLENGE만으로 목적을 추정하지 않고 requestedPhase를 서명한다. STREAM용 nonce를 OPEN에서 생산하는 선행은 저장행/예약에 포함해야 하며 뒤 §12의 별도 증명 대상이다. CLOSE는 위 enum에 아직 없으므로 종료 인증/요청 exact 원형은 미정이다. STREAM replay가 새 stream/secret replay를 열어서는 안 된다.

ChallengeSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_CHALLENGE',challengeId,requestId,requestHash,targetPhase,recipient:{installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,channelProfileRef,localReceiveAttemptId},sessionRef,windowRef,serverNonce,issuedAt,expiresAt}.

clientNonce/requestId/원 canonical 요청hash·서명·시각·등록 생존 검산이 최초 freshness 근거다. 같은ID/같은본문은 원 결과만, 같은ID/다른본문·다른ID/같은nonce는 충돌. 서명/형식 불량의 R생성0. 유효 서명 뒤에도 nonce/replay·rate·현재성·공간을 원자 검사한다. 과거 결과 접근에도 현재 인증을 검사하되 소비된 challenge를 재개방하지 않는다.

## 6. offer·typed 위임·원 명령 binding

최종 approvalRef가 결박된 ProjectCommand 전체를 보관한다. payloadHash만으로 동일성을 판단하지 않는다. approve 후 commandHash가 바뀌면 옛 offer/ARM을 사용할 수 없다. 사전준비는 별도의 허가명령이며 원 native 승인을 대신/중복 소비하지 않는다.

ReceiveDelegation={schemaVersion:1,purpose:'NATIVE_PREPARATION_RECEIVE_DELEGATION',installationId,projectId,commandHuman:Human,recipientHuman:Human,registrationRef,connectorRef,registrationScopeDigest,hostPublicKeyFingerprint,nativeCommandId,nativeCommandHash,payloadHash,approvalRef,nativeFactoryRef,expectedWriterHeadRef,sourceScopeHash,channelProfileRef,windowRef,receiveSessionRef,originalRegistrationPolicyRef,delegationPolicyRef,issuedAt,expiresAt,allowedPurpose:'NATIVE_PREPARATION_RECEIVE_ONLY'}.

OfferSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_OFFER',offerId,command,commandHash,delegation:ReceiveDelegation,issuedAt,expiresAt}; Offer={ref,snapshot}.

내장 위임에는 offerRef/delegationRef가 없다. offer 전체hash가 command와 위임을 결박한다. 독립 entity가 없는데 delegationRef를 합성하지 않는다. 원 등록 projection·현재 HUMAN·정책은 보호 Tx에서 복원하며 caller 선언으로 채우지 않는다.

CommandBindingSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_COMMAND_BINDING',bindingId,offerRef,windowRef,receiveSessionRef,authorityRef,nativeCommandHash,commandRef,authorizationReceiptRef,auditRef,registrationRef,connectorRef,hostPublicKeyFingerprint,channelProfileRef,issuedAt,expiresAt}; CommandBinding={ref,snapshot}.

사전준비에는 아직 authority.parent.commandRef가 없다. offer에 가짜 fullref를 만들지 않는다. 실제 authority 생성 Tx에서 원 server command/receipt/audit와 binding을 동시에 저장한다. offer의 commandHash=실제 command.requestHash, binding.commandRef=authority.parent.commandRef와 원 parent 두refs를 exact 대조한다. 외부 commandId와 server command ID를 구분한다. ordinary evidenceRefs에 숨기지 않는다. authority/offer당 binding1개이며 동일명령 replay는 새binding/authority/credential을 만들지 않는다.

DelegatedCurrent={schemaVersion:2,purpose:'NATIVE_PREPARATION_DELEGATED_CURRENT',authorityRef,bindingRef,offerRef,windowRef,receiveSessionRef,commandHuman,recipientHuman,registrationRef,connectorRef,channelProfileRef,writerHeadRef,sourceScopeHash,status:'CURRENT'|'CHANGED'|'UNAVAILABLE',checkedAt,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false}.

DelegatedSignFrame={schemaVersion:2,operation:'SIGN_DELEGATED_NATIVE_PREPARATION_PROOF',keyId,authority,challenge,request,offer,commandBinding,delegatedCurrent,remainingMs,callExpiresAt}.

원 proof 서명bytes는 기존 NATIVE_PREPARATION_REQUEST_PROOF 목적을 보존하는 제안이다. 다만 helper의 선행인가 frame은 새 typed branch가 필요하다. consume뒤factoryticket을 서명인가로 역사용하지 않는다. offer.command2MiB+authority2MiB+여러wrapper가 들어가므로 기존64KiB frame에 넣을 수 있다고 하지 않는다. **새 helper 총전송상한·읽기한도·고정 예산·키 Load뒤 min-only 검사**의 파생 최대식이 미정이다. native현재성의 v1 exactparser를 느슨하게 하지 않고 새 wrapper/version을 명시 소비한다.

## 7. 공개 경계와 profile

다음 경로는 신규 후보이며 아직 채택되지 않았다.

| 용도 | 고정 endpoint/operation 후보 |
|---|---|
| HUMAN recipient metadata | GET /api/v1/projects/:projectId/native-receive-recipient-options |
| window 생성/조회/종료 | POST /api/v1/projects/:projectId/native-receive-windows; GET .../:windowId; closeNativeReceiveWindow |
| offer 생성/조회/취소 | POST /api/v1/projects/:projectId/native-receive-offers; GET .../:offerId; cancelNativeReceiveOffer |
| 최초 목적 challenge/session | POST /api/v1/connector/native-receivers/challenges; POST .../sessions |
| 유한 stream | GET /api/v1/connector/native-receivers/:sessionId/stream |
| ARM/ACK | POST .../:sessionId/arms; POST .../:sessionId/acks |
| 정확 상태·보호자료 | GET .../:sessionId/offers/:offerId; authority/binding의 고정 보호조회 exact route 미정 |

HUMAN은 기존 same-origin/CSRF·현재 OWNER/controller/정책·필요승인을 검사한다. native 수신 경계는 cookie/StatusOnly/nativebearer 없이 등록키 전용proof를 사용한다. UUID/sessionId 자체는 인증이 아니다. 등록정보 조회가 cross-client 전체자료 조회나 물리 VERIFIED 지원 승격이 되지 않는다. 응답 exact키·오류 whitelist/status·본문 총한도·목록한도·권한command envelope는 아직 확정 필요다.

별도 NATIVE_PREPARATION_CHANNEL_PROFILE은 installation·고정HTTPSorigin·CA/hostname검사·허용목적·recipient/factory연결·fullref·발행/만료/회수/rollback하한·보호발급원 근거를 가진다. Main은 배포에 고정된 별도 목적 공개 envelope를 권장한다. r5 runtime catalogue는 코드 publisher 권위이며 그origin/CA를 통신허가로 자동 전용하지 않는다. renderer/env/rawJSON/연결URL로 선택0. 실제 고정profile producer가 없으면 default UNAVAILABLE다. 기존 고정 HTTPS/TLS supplier 구현 자체는 기채택 source 상세지만, 이 후보가 새로 제안하는 profile 발급·회수 권위와 공개 증거의 의미는 별도 결정이다. 발급원/개정·회수/설치소비 형식은 미정이며 새로운 실제CA/키생성은 source채택과 별개다.

## 8. ARM exact 원형

ArmBody={schemaVersion:1,purpose:'NATIVE_RECEIVE_ARM',armRequestId,recipient:Recipient,sessionRef,windowRef,offerRef,commandHash,recipientNonce,issuedAt,expiresAt}.

ArmChallengeRequest={schemaVersion:1,purpose:'NATIVE_RECEIVE_ARM_CHALLENGE_REQUEST',challengeRequestId,armBody:ArmBody,clientNonce,target:Target,issuedAt,expiresAt}.

ArmChallengeSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_ARM_CHALLENGE',challengeId,challengeRequestId,challengeRequestHash,armRequestId,armBodyHash,recipient:Recipient,sessionRef,windowRef,offerRef,commandHash,recipientNonce,target:Target,serverNonce,issuedAt,expiresAt}.

ArmProof={schemaVersion:1,purpose:'NATIVE_RECEIVE_ARM_PROOF',proofRequestId,challengeRef,armRequestId,armBodyHash,sessionRef,windowRef,offerRef,commandHash,recipientNonce,serverNonce,target:Target,issuedAt,expiresAt}; ArmRequest={body:ArmBody,proof:ArmProof,signature}.

ArmReceiptSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_ARM_RECEIPT',armId,armRequestId,requestHash,proofEvidenceRef,sessionRef,windowRef,offerRef,commandHash,recipientNonce,state:'ARMED',recordedAt,expiresAt}; ArmResponse={receipt:{ref,snapshot:ArmReceiptSnapshot}}.

ARM 이전에는 authority/binding/ATTEMPTED/deliveryId/commitment가 없으므로 필드 자체가 없다. null추가도 거절한다. 서명은 canonicalArmProof전체, target.bodyHash=hash(canonicalArmBody)다. challenge요청은 자기서명/hash를 bodyHash에 넣지 않는다. 같은 offer/head잠금에서 단일ARM/현재성/원hash·원기한을 검사한다. ARM은 명령승인·실행허가가 아니다.

## 9. ACK exact 원형과 소유 operation

AckBody={schemaVersion:1,purpose:'NATIVE_RECEIVE_VOLATILE_ACK',ackRequestId,recipient:Recipient,sessionRef,windowRef,offerRef,commandHash,armReceiptRef,bindingRef,authorityRef,deliveryAttemptRef,deliveryId,recipientNonce,opaqueCommitment:{algorithm:'SHA256',digest},nativeCallExpiresAt,issuedAt,expiresAt}.

AckChallengeRequest={schemaVersion:1,purpose:'NATIVE_RECEIVE_ACK_CHALLENGE_REQUEST',challengeRequestId,ackBody:AckBody,clientNonce,target:Target,nativeCallExpiresAt,issuedAt,expiresAt}.

AckChallengeSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_ACK_CHALLENGE',challengeId,challengeRequestId,challengeRequestHash,ackRequestId,ackBodyHash,sessionRef,windowRef,offerRef,commandHash,bindingRef,authorityRef,deliveryAttemptRef,deliveryId,recipientNonce,opaqueCommitment,target:Target,nativeCallExpiresAt,serverNonce,issuedAt,expiresAt}.

AckProof={schemaVersion:1,purpose:'NATIVE_RECEIVE_ACK_PROOF',proofRequestId,challengeRef,ackRequestId,ackBodyHash,sessionRef,windowRef,offerRef,commandHash,bindingRef,authorityRef,deliveryAttemptRef,deliveryId,recipientNonce,opaqueCommitment,target:Target,nativeCallExpiresAt,serverNonce,issuedAt,expiresAt}; AckRequest={body:AckBody,proof:AckProof,signature}.

AckSnapshot={schemaVersion:1,purpose:'NATIVE_RECEIVE_VOLATILE_ACK_RECORD',ackId,ackRequestId,requestHash,proofEvidenceRef,sessionRef,windowRef,offerRef,commandHash,armReceiptRef,bindingRef,authorityRef,deliveryAttemptRef,deliveryId,recipientNonce,opaqueCommitment,nativeCallExpiresAt,recordedAt,expiresAt}; AckResponse={ack:{ref,snapshot:AckSnapshot},terminalEventRef}.

서명은 canonicalAckProof전체, target.bodyHash=hash(canonicalAckBody)다. 선재하는 refs·deliveryId만 허용한다. commitment는 실제수용opaque43의SHA256을 서버credentialdigest와 비교한다. ACK는 현재 휘발수용·검산의 증거이며 내구설치·재시작복구·native실행·회수완료가 아니다. slot.accept 자체는 ACK가 아니다. slot 실제 수용→보호helper caller의 생산자는 아직 구현되지 않았다.

기존 deliver는 supplier반환뒤 terminalTx를 실행한다. supplier가 ACK HTTP성공을 기다리고 endpoint가 terminal완료를 기다리면 교착된다. 권장 내부순서는 다음과 같다.

1. 원operation이 exactoffer/authority/ATTEMPTED/stream·원단조deadline에 묶인 비공개ACK대기를 소유한다.
2. supplier는 최대1회전송 뒤 HTTP응답이 아닌 검산된 비공개ACK후보를 받는다.
3. endpoint는 인증·원행·nonce·기한을 검사하고 같은operation에 immutable후보를 전달한다. DB/프로젝트잠금·Tx를 유지한 채 완료를 기다리지 않는다.
4. 원operation이 후행Tx에서 원행/현재성/기한/유일성을 다시 검사하고 ACK증거·nonce소비·DELIVERY_CONFIRMED·대응offer terminal을 같이 저장한다.
5. COMMIT확인 뒤에만 ACKendpoint와 HUMAN응답을 완료한다.

후보는 module-private 소유값이며 아직 내구ackRef가 아니다. 후보ID/hash를 먼저 계산해도 공개/current/허가에 쓰지 않는다. 기존supplier의 CONFIRMED/ackRef를 미내구후보로 위장하지 말고 내부 결과형/소유대기port를 명시 변경해야 한다. 원operation부재·종료·기한뒤에는 endpoint가 새operation/terminal을 시작하지 않는다. 동작하는code·교착반례시험은 아직 없다.

## 10. Tx/CAS·원10초·불명 행렬

| 단계 | 같은 Tx의 사실·잠금 | 효과/불명 규칙 |
|---|---|---|
| 취소 | nativeTx와 동일offer/head잠금·expectedversion, binding없는사전상태→CANCELLED | 먼저COMMIT한쪽만승리 |
| 원nativeTx | ARMED→COMMAND_BOUND·원command/receipt/audit·authority·binding 동시COMMIT | 확인전 ROLLBACK추정0 |
| 전달시도Tx | authority당ATTEMPTED1·deliveryId/stream연결 | COMMIT확인전supplier0 |
| 실제전송 | 내구새사실없음 | 같은소유stream최대1회;부분write도재전달0 |
| 성공후행Tx | ACK/evidence/nonce소비·CONFIRMED·offerterminal·정산 동시COMMIT | 원현재성·기한·원시도·terminal부재CAS |
| 실패후행Tx | 허용된UNCONFIRMED·정산 | 원저장조건안에서만;실패하면ATTEMPTED만남을수있음 |

window/offer사전대기와 원native10초는 별도다. 원POST시작의 고정단조deadline과 wall상한을 모든원Tx·전송·ACK·후행Tx가 공유하고 등록/session/정책/profile/authority·위임기한으로 min-only축소한다. ACK요청에 새10초0. pending write/query는abort요청으로정착완료가되지않으며 buffer/DBlease/handle을정착전재사용·회수완료표시0.

| 상황 | 저장사실/조회 | 소비·재시도 |
|---|---|---|
| native/취소COMMIT불명 | exactoffer/head/command/binding재조회 | 새authority/취소성공추정0 |
| ATTEMPTED COMMIT불명 | 원시도존재조회전전송0 | 나중에시도발견해도supplier새호출0 |
| 부분write/단절/backpressure | ATTEMPTED만으로수용여부모름 | 새stream이어쓰기0 |
| 수용후ACK유실 | 휘발secret존재와terminal확정은다름 | exact조회만;자동ACK/secret재전달0 |
| 후행Tx COMMIT불명 | ACK+terminal함께존재하거나없음 | UNKNOWN,새terminal생성0 |
| terminal행부재 | 결과불명 관측,UNCONFIRMED행존재와다름 | 기한뒤가짜UNKNOWN행생성0 |
| 성공뒤현재성회수/만료 | 역사CONFIRMED보존·fresh비활성 | 소비0 |
| recipient재시작 | slot/stream/ARM휘발상태소실 | 서버성공으로secret복원0 |
| server재시작/secret소실 | 원DB행보존·inflight불명 | 재발급/재전달/operation재생성0 |

새 관측wrapper는 command/binding확인,attemptRef|null,ACK/terminal완결refs,현재사용가능성,관측불명사유를 구분해야 한다. exact키/enum은 미정이며 기존v1 DTO를완화하지않는다. 로컬소비는 살아있는원slot+정확ACK/terminal보호조회+현재양쪽주체/위임/등록/profile/writer·기한+기존localattempt/consume/factory단발을모두요구한다.

## 11. binary stream·고정보호조회

Main권장은 authority원문을비밀frame에넣지않고 등록키전용인증의exactoffer/authority/binding 고정보호조회로먼저검산하는안이다. nativebearer최초인증순환을만들지않는다. frame에는version/type/length·exactoffer/binding/authority/ATTEMPTED refs·기존deliverymetadata6와별도opaque43만넣는다. 기존내부exact6에deliveryId/ref를추가하지않고adapter가유일선커밋사건을보호조회해결박한다.

frame64KiB는미증명제안값,순간buffer4MiB/window누적100MiB도Main제안이다. 원authority2MiB+wrapper를총2MiB로축소하지않으며조회응답의별도총상한을파생해야한다. header/부분수신/거절bytes까지누적계상하고재접속으로초기화0. 길이검사전할당0,닫힌종류/순서/중복/잘못된UTF8/부분close를거절한다. 정확binary header/byte순서/개수·backpressure·streamflush종료·고정보호조회route/상한은미정이다.

session당소유stream1·ARM과동일instance고정·ATTEMPTED확정후전송·원deadline공유가필수다. write/callback/drain은ACK아니다. 실제serverstreamproducer와desktopconsumer·부분write/lateIO·원operation인계의code는아직없다.

## 12. R행 완결·nonce소비·replay

증거는 exact ProofEvidenceSnapshot={schemaVersion:1,purpose,evidenceId,request:해당typedrequest또는proof,signature,requestHash,hostPublicKeyFingerprint,verifiedAt}. purpose는SESSION/ARM_CHALLENGE/ARM/ACK_CHALLENGE/ACK의닫힌값으로최종확정필요다. verifiedAt은과거검산사실이지현재허가가아니다.

한challenge의필수보관제안:

| 전이 | 생성하는불변행 | 누적/미래슬롯 |
|---|---|---|
| challenge발급 | challenge요청evidence+ChallengeSnapshot+발급요청replay,같은Tx | actual3/미래소비2 |
| proof소비 | proof evidence+nonce-consumption/replay,원결과저장과같은Tx | 최대actual5/미래0 |
| 동일요청재조회 | 원행으로응답재구성 | 새행0 |
| 다른본문/소비nonce재사용 | 충돌 | 정상행증가0 |

NonceConsumptionReplay={schemaVersion,purpose,requestId,requestHash,challengeRef,proofEvidenceRef,outcomeCode,resultRef,resultHash,recordedAt}를제안한다. challengeRef에unique소비를두고challenge원문을수정하지않는다. 유효proof거절도nonce를소비할지여부와null조합은미정이다. challenge발급요청과소비요청은서로달라replay도2행이다. 원nonce/발급시각은ChallengeSnapshot,원session/receipt시각은각불변결과행에서재구성한다. STATE는당시정확headref/관측시각/결과코드를원replay에보관해최신값으로원결과를바꾸지않아야한다;해당exact확장과bytes는아직미정이다.

OPEN에서STREAMnonce를함께만드는제안은독립challenge원행과발급replay대응을누락할수있다. 5행식은각challenge의요청evidence가존재하는경우의상한이며,이특수생산의정확행/nonce생성시각/재구성방식을별도로고정한다. STREAM ID replay는새연결을열지않는다.

| 실제전이 | 원사실행·head |
|---|---|
| session/window/offer생성 | 각snapshot,head/예약;권한명령L별도 |
| ARM | receipt가전이증거;별도같은사실사건필수아님 |
| nativebinding | 불변binding+Nauthority·L원명령;headCAS |
| 전달시도/실패terminal | 기존N사건을정확ref로소비;같은사실R복제필수아님 |
| ACK | ACKsnapshot+NCONFIRMED·nonce소비같은후행Tx |
| 취소/만료/회수/명시종료 | 첫확정불변terminal+headCAS·정산 |
| 단절 | 휘발연결회수;내구단절사실이필요하면전용사건별도예약 |
| 응답유실/COMMIT불명/재시작 | 그사실만으로행추가0;원상태조회·불명관측 |

head는state/lastTransitionRef/version등투영만이며불변이력을숨기지않는다. binding전취소·만료·회수는상호배타첫terminal;binding뒤는원ACK/Nterminal또는terminal미관측불명이다. terminal뒤별도회수이력을요구할지·허용횟수는미정이다. window종료를offer50개취소로위장하지않고각필요offer종료행/정산을선예약한다.

**session26/window9/offer58row·STATE8/event12는인수상수가아니다.** 앞5행식은기존challenge당4행가정의발급replay누락을보완한다. 8회STATE의소비를일반event12에몰아넣으면ARM/ACK와시작/결과/종료를합쳐초과할수있다. nonce소비는전용replay행으로분리하고의미적phase/STATE/terminal후회수횟수를먼저결정한다. CLOSE인증원형이아직없고원권한L도미정이므로총행수확정불가다.

## 13. 단일accounting·종료여유

총점유=U+H+O+N+R+L_out+Q를제안한다.

| 분모 | 의미·중복방지 |
|---|---|
| U/H | 기존used/held,기존operation원형그대로 |
| O | U에들어있지않은기존정의/환경등소계 |
| N | 기존nativeauthority/events actualcanonicalbytes |
| R | 새session/window/offer·증거/nonce/replay·ACK·head/예약 actualbytes |
| L_out | U/O/N/R에없는추가command/result_ref·receipt/audit/승인소비등공통원장actual비용 |
| Q | 아직미생성인N/R/L미래bytes·슬롯예약 |

L은공통원장전체의분류이고 L_out은그중U/O/N/R에포함되지않은실제행의소계다. L이현재U에자동계상된다는근거는없다. 같은실제행의disjoint registry와전이별정산표가필수이며,기존U일치guard를우회해임의가산하지않는다. 기존quota의ARTIFACT/CHECKPOINT/ADOPTION·operation닫힘을임의해제하지않고새목적actual/held소계를동일account잠금아래추가한다. N/R/L_out저장과같은bytes의Q감액은동일Tx. collector는원형/해시/정산대응·미생성슬롯을복원하며R을U에도넣지않는다. 기존native-preparation-store.capacity의환경account used/held·prior+nativebytes,SQLnative/정의/환경guard가모두동일합계식을소비해야한다.

기존10GiB·새R누적10000/64MiB·기존N10000/64MiB·자동삭제OFF는늘리지않는다. actual행+예약미생성슬롯+신규필요≤각record상한이며N/R분모를혼합하지않는다. 종료여유는bytes뿐아니라slot도소유예약한다. UNKNOWN/COMMIT불명/미정착IO/terminal부재에서Q자동해제0.확인된내구정산뒤미사용미래여유반환은exact완결조건/원예약/CAS를필요로한다.

R슬롯의정본은고정58이아닌다음symbolic식이다.

Rslots=필수snapshot/head/예약+3×발급challenge수+2×소비가능challenge수+필수결박/결과/terminal행.

각challenge발급전최대5행을선예약하고발급후actual3+미래2로전환한다. ARMreceipt·binding·ACK·고정window/종료행등은식의별도필수결과분모다. endpoint/rate의유한최대횟수와최악동시보존branch를확정하지않으면totalbudget을완료라하지않는다.

window없는prelisten/session최초발급에도project별quota/예약잠금이필요하다. 기존environment_configuration_account/quota_account등은HUMAN session/현재제어문맥을요구할수있으므로ReceiverPrincipal을HUMAN actor로위장해호출하지않는다. 새목적accounting caller는원project/등록/user/client/session생존·등록키possession·허가된prelisten목적·최소기한을보호reader로검산한경우에만해당projectaccount를같은잠금순서로읽고예약하도록한정해야한다. 이최소권한과발급전요청상한은새prelisten계약의일부이며현재그producer/SQL접점은없다. exactprincipal→기존account접점의불변조건·동시발급/포화/회수/불명합성검증이필수다. 출처없는coverage=true나controller/dbactor위조로닫지않는다.

## 14. 기존N·조건부R·별도L의바이트근거

기존N의정적보수증명은4,249,198bytes/17slots다:2×2,097,152+350+16×3,409. 일반ref153/version1ref138,ISO24/안전정수/닫힌ASCII·고정target·receipt를포함한다. actualINSERT계상은authority={ref,snapshot:authority,preparationRef,preparationIntent:intent},event={ref,snapshot}다. intent누락/event이중계상0. SQL0071authority행canonical_bytes≤4MiB이므로두snapshot상한+외피전체가저장가능하다는뜻은아니며안전과대예약이다. CONTEXT_INVALIDATED는단일kind unique가없어event16예약을유지한다. N을새ACK/proof서명frame비용으로전용하지않는다.

R계산조건:목적/enum은escaping불필요한닫힌ASCII64이하,fixedpathASCII256이하,method4이하. 기존commandcanonical≤2MiB유지. 일반ref153/Human232/approvalRef185. endpoint실상한·receiverPrincipal·종료/nonce소비원형이바뀌면재계산한다.

| exact원형 | canonicalwrapper상한bytes |
|---|---:|
| OfferSnapshot내장위임 | commandbytes+3524 |
| CommandBinding | 2245 |
| ARMchallenge/evidence2 | 7980/3행 |
| ACKchallenge/evidence2 | 9619/3행 |
| ARMreceipt | 1361 |
| ACKrecord | 2245 |

ARM묶음8KiB는조건부성립,ACK8KiB는불성립이므로ACK묶음12KiB를권장했다. evidence는해당challenge요청또는proof1번이며최종ArmRequest/AckRequest전체를추가복제하지않는다. 각각의body는challenge요청evidence내에있다. opaque/CA/SPKI/profile원문0. 비공개ACK후보는R행이아니고실제저장ACK/증거/nonce/terminal만계상한다.

이전조건부offer58행의항목합은command+140942였고192KiB여유55666이었다. 그러나발급요청replay·새nonce소비/state원결과/종료누락을닫기전**192KiB충분·58행완결이라고표시하지않는다.** STATE8/event12도미채택이다. 원형조건부반복계산은이표로대체하며총량은symbolic식으로재구성해야한다.

L_out은별도분모다. 기존native result_ref에commandSnapshot과intent가복제된다. command크기C/intent크기I이면그부분만C+I+657의보수부분상한이검토됐다. 이것은원command행·authorizationreceipt·audit·승인소비/참조/정산원문을포함한L전체가아니다. 새window/offer/cancel/close권한명령의payload/receipt·원문문자열escaping·최대bytes가미정이다. raw reason등임의문자열이R에추가되지않아도L에서JSON/UTF8최대식을계산해야한다. 원본과복제본은실제별도저장량이므로각각계상하되동일저장행을N/R/L에중복하지않는다.

R포화시새발급만차단하고정확과거조회/예약된안전종료는유지한다. N매offer최대4249198을예약하는빈64MiB분모는15개까지만가능하며R계산의큰개수와동시보장하지않는다. 기존used/held·과거누적·L·기한/단일writer/head때문에더줄어든다. 실제작은원명령기반Nfuture를엄밀히파생할수있으나한도를줄여맞추는것과구별한다.

## 15. 기술검토9건의R2추적·남은닫힘

| 항목 | R2반영 | 미해결/정확다음증명 |
|---|---|---|
| A01 위임/소비 | §3/6행렬·내장위임/current/frame | 원등록전용reader exact결과·writerHuman선행·각소비분기코드설계 |
| A02 최초발견/caller | §5session-first/prelisten/requestedPhase | localIPC/main생산자·window생성/발견/결박원형·꺼진앱제외 |
| A03 nonce/freshness | §5/8/9/12목적분리·5행 | rate/clock오차·유효거절nonce소비·CLOSE·STREAMnonce생산·STATE횟수 |
| B01 accounting | §13 U/H/O/N/R/L/Q | forward예약/정산/collector exactschema·disjoint L_out·모든guard동일식·ReceiverPrincipal account caller권한 |
| B02 headroom | §12/14불변결과/종료·symbolic행식 | 최악branch별종료행·정산·phase/cap·원응답재구성·슬롯증명 |
| B03 frame | §6/11분리보호조회 | binaryheader/응답·helper총전송상한·할당전검사·예산 |
| B04 ACK불명 | §9/10동일후행Tx·후보분리 | 소유port/COMMIT불명/current관측exact원형·고정오류 |
| B05 취소경합 | §10같은offer잠금/CAS | commandbinding유일성/역완결·취소승자·replay접근순서 |
| B06 stream소유 | §9/11동일instance·단발전송 | 실제producer/consumer·부분IO/late정착·정리소유·교착반례 |

profile발급원·보호설치소비·typedhelper의실제slot수용근거도필수미구현선행이다. Main제안값을선택하는사용자결정과exact필드/대수/파일배치의기술완결을혼동하지않는다. 이문서는Important9해소판정이나구현준비완료가아니다.

## 16. 채택준비·후속구현의완료조건

채택검토전:§15미정중새공개/권한/보호저장선택과기술적으로닫을항목을분리하고,원형/수명/rate/최대phase·종료branch·L/R/N예약·profile/caller·helper/frame총한도를한정본문으로고정한다. 동일보완안을독립재검토해미해결C/I와지원한계를명시한다. 기존r1및검토이력은보존하되위임자가옛delegationRef/불완전표를현재원형으로구현하지않게본R2를구분한다.

채택후sourceWI는미사용codec/port만완료라하지않고실제prelisten등록키→session/window/offer→ARM→원nativeTx/binding→ATTEMPTED→부분IO포함단발전송→소유ACK후보→ACK+CONFIRMED원후행Tx→고정조회→typedSIGN/current/consume까지한정된생산소비를증명해야한다. 정상Web/모바일·같은client/교차client·원정책DENY·원session회수·oldwriter·hash/approval변경·nonce충돌·다른stream·취소CAS·포화/종료여유·각COMMIT불명·양쪽재시작·늦은IO·ACKHTTP교착음성을검증한다. mock/고정키/메모리PASS를실제DB/TLS/CNG/설치/물리writer·Agent실행으로승격하지않는다.

이문서작성은후보정리만이며제품·SQL·시험수정0,실제키/DB/권한/서비스/네트워크/컴파일/OS/helper/Agent·실자료/새QA/P03R3실행0이다. Git/WORK_STATUS/게시·채택판정은Main소유다.
