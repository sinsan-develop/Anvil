# FN06 같은-client 최초 수신 wire 제안

상태: **PROPOSAL / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0**

작성 책임: 기존 Primary. 검토·계약 결정·통합 책임: Main. 이 문서 한 개만 작성하며 기존 계약·제품·시험·SQL은 변경하지 않는다. 새로운 HTTP/IPC·인증 목적·profile 권위·영속 상태·원장 접합은 모두 제안이다. 기존 source 승인이나 실제 QA 승인을 재사용하지 않는다.

부모: `FN06_NATIVE_SAME_CLIENT_CLOSURE_DETAIL_CANDIDATE_20261104.md`와 `FN06_NATIVE_SAME_CLIENT_RECEIVE_TECHNICAL_DRAFT_20261103.md`. 원 위임 후보 R2는 후속 교차-client 요구의 부모로 보존한다. 같은-client를 먼저 구현한다는 제안은 일반 브라우저·모바일·교차-client·지속 수신 요구의 삭제가 아니다.

## 1. 한 단위의 시작자와 불변 기준

로컬 신뢰 UI에서 사용자가 ‘다음 native 준비 명령 한 개 수신 준비’를 명시한다. main은 기존 REGISTERED binding의 project/등록/키/origin과 main 소유 원 Electron Session을 사용한다. renderer가 그 값이나 cookie·credential·profile CA를 공급하지 않는다. 이 첫 단위의 명령 작성·승인·POST 주체는 같은 설치의 main이 소유한 `persist:anvil-web` remoteSession을 사용하는 WebContentsView의 hosted Web이다. `anvil-local` localSession은 신뢰 UI 전용이며 HUMAN 조회/명령의 session으로 쓰지 않는다. 별도 Chrome·다른 기기에서 작성/승인/전송하는 흐름은 이번 같은-client 단위가 아니라 후속 교차-client 요구다. cookie 복사·자동 session 이전은 하지 않는다. 원격 hosted Web은 기존 `prepareNativeBoundary` 명령의 작성·필요 승인·명시 전송을 계속 담당한다. main이 원 명령을 대신 발행하지 않는다.

같은 사용자·원 auth session·client·credentialGeneration·controlGeneration·등록 fullref를 서버 내부에서 끝까지 비교한다. 원 등록의 `connector_registrations.session_id`도 같은 실제 auth session이어야 한다. 기존 OWNER/current control·최근 재인증·명시 정책/DENY·ISSUED/TRUSTED 등록·SPKI·물리 writer/current head·sourceScopeHash·만료/회수 검사를 유지한다. recipient 검산 boolean으로 기존 거절을 덮지 않는다.

기존 native command의 11키·payload·최종 approvalRef·canonical commandHash 및 기존 SIGN 목적은 변경하지 않는다. 새 offer/ARM은 명령 밖의 별도 참조다. 원 일회 승인은 실제 native 명령 Tx에서만 소비한다. 원 native 총10초·ATTEMPTED 선COMMIT·한 번 전달·부분전송/불명 재시도0을 보존한다. 최초 준비의 더 긴 기한을 native10초 연장에 사용하지 않는다.

## 2. 공통 wire 규칙

- 모든 JSON은 UTF-8·기존 canonical 규약·중복키/추가키/잘못된 Unicode/안전하지 않은 수 거절을 적용한다. 각 아래 원형은 표기한 키만 허용한다. 선택 필드는 없고 표의 nullable만 null을 허용한다.
- `Uuid`는 기존 UUID 검산, `Hash`는 소문자 SHA256 64hex, `Ref`는 exact `{id:Uuid,version:positiveSafeInteger,contentHash:Hash}`다. 신규 불변행은 version1이다. 원 writer/profile/등록 ref는 각 기존 version 규약을 따른다.
- `V<T>`는 exact `{ref:Ref,snapshot:T}`이며 원형 전체 canonical hash가 ref와 같아야 한다. 응답의 ref를 현재 grant로 해석하지 않는다.
- `At`은 서버 생성 UTC ISO 시각이다. 예시 고정 종료시각을 넣지 않는다. `Nonce`·휘발 credential은 기존 32바이트 난수의 canonical base64url43이다. nonce와 credential은 목적별 별개다. private key는 등록키 보호 host 밖으로 나오지 않는다.
- HUMAN 경로는 원 cookie·origin·CSRF·현재 인증을 사용한다. 비밀이 오가는 native 경로는 cookie/Origin/중복 인증 header를 거절하고 고정 HTTPS origin·CA·hostname·경로를 검산한다. redirect/압축/추가 frame/본문 상한 초과는 거절한다.
- 원 command canonical 상한2MiB를 유지한다. profile CA는 기존 channel source의64KiB 상한을 유지한다. 새 control/proof JSON은 최대8192 UTF-8 bytes, OPEN control metadata는16KiB로 제안한다. 이 control 상한은 원 명령 원문을 포함하지 않는 challenge/phase 요청에 적용한다. 새 offer 명령 외피는 원 command 자체의2MiB/깊이를 줄이지 않도록 분리 검산하고, 원형 외피 상한은 부모 후보와 같은 2MiB+192KiB로 제안한다. 새 offer의 서버 소유 외피는 원 command canonical bytes와 고정 metadata를 조합하며 원 command 자체의 깊이/크기 기준을 축소하지 않는다. 전역 canonical/기존 ProjectCommand 입력 한도를 넓히지 않고 새 offer 전용 endpoint에서 exact 외피와 원 command를 각각 검산·조합한다. 저장비용과 전체 wire/메모리 최대식의 채택은 별도 비용 계약을 선행으로 삼는다. 이 수치가 총 비용 증명은 아니다.

## 3. profile의 보호 생산권위

신규 별도 타입을 다음으로 제안한다. 기존 catalogue의 cast/서명 목적/권한을 전용하지 않는다.

```text
NativeChannelProfile={schemaVersion:1,purpose:'NATIVE_CHANNEL_PROFILE',
 profileId:Uuid,version:positiveSafeInteger,installationId:Uuid,origin:string,
 nativePrefix:'/api/v1/native-first-receive',caPem:string,caSha256:Hash,
 serverName:string,issuedAt:At,expiresAt:At}
ProfileHead={schemaVersion:1,purpose:'NATIVE_CHANNEL_PROFILE_HEAD',
 installationId:Uuid,profileRef:Ref,state:'ACTIVE'|'REVOKED',updatedAt:At}
ProfileRead={profile:V<NativeChannelProfile>,head:V<ProfileHead>,
 observedAt:At,executionAuthorized:false}
```

`origin`은 원 등록과 같은 단일 HTTPS origin이며 userinfo/query/hash/path를 포함하지 않는다. `serverName`은 anchor가 허용한 hostname과 정확히 같다. `caSha256`은 caPem 원 UTF-8 bytes의 hash이며, 실제 TLS chain/hostname 검산을 대신하지 않는다.

최초 anchor는 검수된 설치 package의 별도 고정 native-profile 자료다. exact `{schemaVersion:1,purpose:'NATIVE_PROFILE_ANCHOR',installationId,origin,nativePrefix,caSha256,serverName,minimumProfileVersion}`를 제안한다. 기존 catalogue profile을 native anchor라고 해석하지 않는다. anchor 공급·package 무결성·현재성 검산의 producer/배포 책임을 별도로 채택해야 한다. 원격 profile 응답 자체가 최초 anchor를 정할 수 없다.

server-owned 보호 설정 producer가 불변 profile revision과 별도 current head/회수 이력을 만든다. renderer·Agent·일반 HUMAN에게 profile 쓰기/회수 API를 주지 않는다. 동일 ref/같은 version의 다른 bytes·head와 불일치·회수·기한초과·설치 하한 미만을 거절한다. origin/CA 변경은 head만 바꾸어 채택하지 않고 새 검수 package와 별도 변경 결정이 필요하다.

HUMAN 보호 GET은 `/api/v1/projects/:projectId/native-channel-profile`(query0/body0)로 제안한다. 요청 session/project/current 등록·정책을 검사해 ProfileRead를 반환한다. 기존 member 조회만으로 새 body 접근을 열지 않고 새 exact `readNativeChannelProfile` AUTO/DENY 정책의 생산·소비를 정의해야 한다. REQUIRE_APPROVAL GET은 이 단위에서 미지원 거절이다. main의 Session.fetch가 읽고 원문 CA는 main 메모리에서만 쓴다. Node bootstrap은 authority가 이미 필요한 기존 NativePreparationHttpsChannel을 생성하지 않고 기존 HTTPS driver의 TLS 검산 내부만 재사용한다.

## 4. HUMAN 명령·조회 경로

새 HUMAN 명령 세 개는 기존 exact ProjectCommand envelope를 재사용하는 제안이다.

```text
ProjectCommand={schemaVersion:1,projectId,commandId,clientId,controlGeneration,
 operation,targetId,expectedVersion,baselineRefs,approvalRef,payload}
```

추가/중복 키0. 아래 새 세 연산은 `baselineRefs:[]`, `approvalRef:null`, 명시 정책 AUTO/DENY만 지원한다. REQUIRE_APPROVAL이면 원형을 저장하거나 다음 단계로 진행하지 않고 거절한다. 이는 신규 준비 연산에 한정된 제안이며 원 `prepareNativeBoundary`의 REQUIRE_APPROVAL은 그대로다. 새 연산을 기존 operation allowlist에 이미 있다고 보고하지 않는다.

| HTTP | operation·target | exact payload·응답 |
|---|---|---|
| POST `/api/v1/projects/:projectId/native-receive-windows` | `prepareNativeReceiveWindow`; targetId:null/expectedVersion:0 | `{registrationRef,localReceiveAttemptId,profileRef}` → 기존 ProjectResult 외피의 `data:{ref:window.ref,status:'NATIVE_RECEIVE_WINDOW_PREPARED',window:V<Window>}` |
| POST `/api/v1/projects/:projectId/native-receive-offers` | `offerNativeReceiveCommand`; targetId:windowRef.id/expectedVersion:1 | `{windowRef,command}` → 같은 외피의 `data:{ref:offer.ref,status:'NATIVE_RECEIVE_OFFERED',offer:V<Offer>}` |
| POST `/api/v1/projects/:projectId/native-receive-windows/:windowId/close` | `closeNativeReceiveWindow`; targetId:windowRef.id/expectedVersion:1 | `{windowRef,reason:'USER_CANCELLED'}` → 같은 외피의 `data:{ref:terminalRef,status:'NATIVE_RECEIVE_CLOSED',state:ReceiveState}`. 진행 중이면 성공 receipt를 만들지 않고 `NATIVE_RECEIVE_IN_FLIGHT` 거절 |

성공 외피 exact는 `{operationId,commandId,projectId,status:'APPLIED',targetId,version,data,evidenceRefs:[],warnings:[],serverReceivedAt}`이며 기존 producer와 같다. targetId/version은 data.ref와 같아야 한다. 기존 ProjectResult의 command/receipt/audit 실물·현재성·idempotency를 검산한다. 같은 commandId+다른 원문은 충돌이다. 기존 result 형식에 임의 성공값을 추가하지 않는다. 새 operation의 기존 공통 명령 저장·거절 감사 접합은 비용 담당 계약의 확정이 필요하다.

추가 보호 GET은 다음으로 제안한다. 응답은 아래 ReceiveState이며 auth session ID나 비밀을 반환하지 않는다.

- `/api/v1/projects/:projectId/native-receive-windows` query exact `{registrationId,registrationVersion,registrationHash}`: 같은 원 session/client/control과 정확 등록에 매칭하는 활성 slot 한 개만 대상으로 ` {projectId,registrationRef,window:V<Window>|null,observedAt,executionAuthorized:false}`를 반환한다. 임의의 최신 pending을 선택하지 않는다. Web은 조회 결과의 fullref를 사용자가 명시적으로 선택해야 한다.
- `/api/v1/projects/:projectId/native-receive-windows/:windowId` query0/body0: 해당 window의 ReceiveState를 읽는다.
- `/api/v1/projects/:projectId/native-receive-offers/:offerId` query0/body0: 보호된 exact V<Offer>를 읽는다. command 원문은 같은 원 HUMAN 문맥에만 반환한다.

조회 operation은 exact `readNativeReceiveWindow`(window 검색/고정 STATE)와 `readNativeReceiveOffer`(원 offer)로 나누고, profile은 `readNativeChannelProfile`이다. 기존 OWNER 정책 editor와 서버가 이 새 literal의 AUTO/DENY를 명시 생산·소비하도록 제안하며 자동 ALLOW·HE 범위 확대0이다. 각 조회는 현재 login/session/member/control/등록·명시 read 정책을 검사한다. 활성 window 검색은 원 auth session까지 같아야 한다. 고정 window/offer의 역사 조회는 같은 user/client의 현재 유효 HUMAN 로그인과 현재 OWNER·read 정책을 허용하되 원 session과 다르면 current.reason=SESSION_CHANGED/current.usable=false이고 원 권위를 복구하지 않는다. 다른 사용자/client에게 원 command를 공개하지 않는다. STATE의 역사 저장값과 현재 guard 결과는 별개다. 조회 때문에 nonce/credential/slot/offer/ARM/binding/terminal을 새로 만들거나 기한을 갱신하지 않는다.

### Offer 전송과 경로 한도의 별도 후보

Offer POST의 body는 앞 표의 exact ProjectCommand11이며 `payload:{windowRef,command:원 native ProjectCommand11}`다. 전송은 application/json UTF-8만 허용한다. 새 `/native-receive-offers` 경로에만 Fastify route-local `bodyLimit:2293760`(2MiB+192KiB)을 제안한다. Content-Encoding과 query는 거절하고 실제 수신 bytes를 같은 값으로 제한한다. 기존 native POST와 다른 모든 경로의 전역2MiB bodyLimit·공용 parser는 변경하지 않는다. 이 한도는 명시적인 신규 공개 경로 후보이며 기존 채택값이라고 표현하지 않는다.

새 경로 전용 strict parser는 중복/추가키·문법·UTF-8를 먼저 검산하고, `payload.command`의 token 원문과 외피를 분리 검산한다. 원 command는 기존 native 입력의 exact형식·canonical2MiB·원 깊이64를 그대로 적용한다. 이 command를 감싼 두 단계 때문에 허용 깊이를 줄이지 않으며 외피 일반 branch의 깊이/형식은 기존 기준을 유지한다. 원 command hash는 외피의 hash가 아니라 원 command canonical hash다. 서버가 만드는 Offer/result 외피는 검산된 원 command canonical bytes와 고정 metadata를 조합하고 정상 깊이에서 기존 canonical과 byte가 같아야 한다. 이 전용 구현을 이유로 전역 canonical 깊이·모든 명령 상한을 넓히지 않는다.

wire bodyLimit과 별도로 새 외피를 제외한 command 유효성 검산을 유지한다. 실제 유효 최대 command를 넣은 Offer의 수신·불변저장·L.result_ref 복제·고정조회 왕복 및 경로 한도 초과 거절이 source 검수 반례다. 원 nativecommand 상한/의미를 축소하여 전송을 맞추지 않는다. 실제 복제량은 비용 담당의 L/R projection에 같은 형상으로 계상한다.

## 5. Window·Offer·ARM·Binding 원형

```text
Human={userId:Uuid,clientId:Uuid,credentialGeneration:positiveSafeInteger,
 controlGeneration:positiveSafeInteger}
Window={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_WINDOW',windowId:Uuid,
 installationId:Uuid,projectId:Uuid,registrationRef:Ref,connectorRef:Ref,
 hostPublicKeyFingerprint:Hash,profileRef:Ref,localReceiveAttemptId:Uuid,
 human:Human,authBindingHash:Hash,writerHeadRef:Ref,policyRef:Ref,issuedAt:At,expiresAt:At}
Offer={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_OFFER',offerId:Uuid,
 windowRef:Ref,command:ProjectCommand,commandHash:Hash,issuedAt:At,expiresAt:At}
Arm={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_ARM',armId:Uuid,
 windowRef:Ref,receiveSessionRef:Ref,offerRef:Ref,commandHash:Hash,
 proofRef:Ref,issuedAt:At,expiresAt:At}
Binding={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_BINDING',bindingId:Uuid,
 windowRef:Ref,receiveSessionRef:Ref,offerRef:Ref,armRef:Ref,
 authorityRef:Ref,nativeCommandHash:Hash,commandRef:Ref,
 authorizationReceiptRef:Ref,auditRef:Ref,issuedAt:At,expiresAt:At}
```

`authBindingHash`는 서버가 원 auth session ID와 위 원 tuple의 canonical에 결박해 만든 불투명 commitment다. 새 recipient 필드·일반 hosted Web 응답·IPC·OPEN metadata에는 실제 auth session ID를 추가하지 않는다. 다만 기존 NativeAuthority의 필수 `subject.humanSessionId`는 기존 hash/parser와 함께 그대로 유지하며 **같은 원 main만 받는 보호 Delivery의 authority 전체** 안에서만 새 수신 경로의 명시적 예외로 허용한다. 이것은 cookie/인증 token 노출 허용이 아니다. 기존 보호 native 원문 GET 계약 자체는 변경하거나 새 수신 grant로 확대하지 않는다. commitment는 현재 session 검사를 대체하지 않는다.

Window.writerHeadRef는 현재 물리 writer/root fullref이며, 원 writer 주체의 user/client/HUMAN session/control도 실제 current source로 원 HUMAN과 같은지 검산한다. 불명/부재/current=false를 caller boolean으로 통과시키지 않는다. Offer.command는 기존 `prepareNativeBoundary` exact11 전체다. payload·baselineRefs·최종 approvalRef·기존 native reason/sourceScopes/ref를 그대로 보관한다. project/client/control/등록/profile/writer가 window와 같은지 검사한다. 승인 상태를 읽을 수는 있으나 ARM/offer에서 승인 소비0이다. 승인 후 command가 바뀌면 새 hash에 대한 새 offer/ARM이 필요하며 같은 window의 원 offer를 덮어쓰지 않는다. 한 window에는 최종 offer 한 개만 허용하므로 다른 command로 바꾸려면 전송 전 명확하게 닫고 새 사용자 준비가 필요하다. UNKNOWN window를 이 경로로 우회하지 않는다.

원 native POST에는 새 `X-Anvil-Native-Receive-Arm` header 한 개만 추가하는 제안이다. 값은 V<Arm> 전체가 아니라 exact Ref의 canonical UTF-8를 canonical base64url로 인코딩한 것이다. 중복·추가 native-receive header·query/body 추가 필드는 거절한다. 기존 Web의 원 command body/hash는 byte 그대로다. header 부재는 기존 legacy 동작을 유지하며, 같은-client 첫 수신 경로의 준비 완료로 오인하지 않는다.

실제 native command Tx 안에서 원 current/정책/승인·ARM·window·session·offer·commandHash·stream 소유를 재검산하고, authority/원 command/receipt/audit와 Binding을 함께 만든다. ARM을 CAS로 한 번 소비하고 반대 방향 closure도 검산한다. 어느 한쪽만 있으면 COMMIT 거절이다. 존재하지 않는 bindingRef를 원 native POST 전에 요구하지 않는다.

## 6. 등록키 typed proof와 null 조합

기존 SIGN_PROOF와 SIGN_NATIVE_PREPARATION_PROOF는 그대로 둔다. 신규 key-host operation `SIGN_NATIVE_FIRST_RECEIVE_PROOF`와 별도 proof purpose를 제안한다. registered key ID·원 binding·보호 current·main sender/context를 검산한 owner만 호출한다. 범용 bytes 서명 포트나 renderer 입력 proof를 추가하지 않는다. 알고리즘·signature encoding은 원 등록키의 기존 검산 형식을 따르며 신규 알고리즘을 도입하지 않는다.

```text
ReceiveProof={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_PROOF',
 phase:'OPEN'|'STREAM'|'ARM'|'ACK'|'STATE'|'CLOSE',requestId:Uuid,
 installationId:Uuid,projectId:Uuid,registrationRef:Ref,connectorRef:Ref,
 hostPublicKeyFingerprint:Hash,profileRef:Ref,localReceiveAttemptId:Uuid,
 windowRef:Ref,receiveSessionRef:Ref|null,offerRef:Ref|null,armRef:Ref|null,
 deliveryRef:Ref|null,authorityRef:Ref|null,commandHash:Hash|null,
 authBindingHash:Hash,challengeRef:Ref,serverNonce:Nonce,
 target:{method:'GET'|'POST',path:string,queryHash:Hash,bodyHash:Hash},
 issuedAt:At,expiresAt:At}
Challenge={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_CHALLENGE',
 challengeId:Uuid,requestId:Uuid,phase:ReceiveProof.phase,windowRef:Ref,
 receiveSessionRef:Ref|null,offerRef:Ref|null,armRef:Ref|null,
 deliveryRef:Ref|null,authorityRef:Ref|null,commandHash:Hash|null,
 target:ReceiveProof.target,serverNonce:Nonce,issuedAt:At,expiresAt:At}
```

### OPEN 전용 current·signing 타입과 실제 producer

서버 설치 등록의 정확 종류는 기존 `scope.kind='HOST_TRUST_REGISTRATION'`, `credentialScope='REGISTRATION_STATUS_ONLY'`다. 현재성은 registration.state='ISSUED'와 connector.status='TRUSTED'를 구분한다. desktop owner의 로컬 REGISTERED 표시나 NATIVE_PREPARATION_ONLY authority를 이 종류로 대체하지 않는다. 등록의 status-only credential을 OPEN bearer로 전용하지 않는다.

추가 HUMAN 보호 GET `/api/v1/projects/:projectId/native-receive-windows/:windowId/signing-current`(query0/body0)을 제안한다. 정확 응답은 `{window:V<Window>,registration:RegistrationCurrent,profile:ProfileRead,observedAt:At,expiresAt:At}`다.

```text
RegistrationCurrent={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_REGISTRATION_CURRENT',
 installationId:Uuid,projectId:Uuid,registrationRef:Ref,connectorRef:Ref,
 registrationKind:'HOST_TRUST_REGISTRATION',credentialScope:'REGISTRATION_STATUS_ONLY',
 registrationState:'ISSUED',connectorState:'TRUSTED',hostPublicKeyFingerprint:Hash,
 human:Human,authBindingHash:Hash,policyRef:Ref,writerHeadRef:Ref,profileRef:Ref,
 observedAt:At,expiresAt:At}
PreAuthoritySigningFrame={operation:'SIGN_NATIVE_FIRST_RECEIVE_PROOF',keyId:string,
 window:V<Window>,current:RegistrationCurrent,challenge:V<Challenge>,
 request:ReceiveProof,body:object,remainingMs:positiveSafeInteger,
 contextEpoch:positiveSafeInteger}
```

keyId는 기존 보호 등록키 ID이며 HTTP/renderer 입력이 아니다. body는 해당 phase HTTP 표의 exact body이며 target.bodyHash와 같은지 검산한다. profile 본문/CA·cookie·receive credential·private key는 이 signing frame에 넣지 않는다. OPEN의 request.receiveSessionRef 및 authorityRef는 null이다. Window/challenge/current의 목적·전체 ref/hash/기한/원 subject/registration/profile/writer/authBindingHash가 서로 같아야 하며 원 Request target과 source별 관측을 검산한다.

서버 producer는 원 HUMAN auth Tx에서 window/원 auth session/user/client/control/project/registration/connector를 실물로 읽고 잠근다. connector_registrations.session_id=실제 actor.authSession.id·설치ID·scopeDigest·policyHead·세대·원 기한/회수를 검산한다. `ProjectRegistrationReads.nativePreparationRecord`의 원 OWNER/현재 control/readNativePreparationAuthority 정책/basis_current/ISSUED/TRUSTED/SPKI 검산을 보존하고, 그 함수가 반환하지 않는 원 session 일치·등록 kind/credentialScope는 같은 잠금 row에서 별도로 검산한다. 현재 물리 writer와 보호 profile source도 실제로 재조회한다. provider/관측 부재는 UNAVAILABLE이고 caller supplied current=true로 대체하지 않는다. 위 응답은 현재 관측이며 새로운 authority/grant 발급이나 저장행을 만들지 않는다.

main의 신규 receive 전용 client가 `remoteSession.fetch`의 원 receiver와 view/origin/generation/authEpoch/원 trust binding을 붙잡고 위 보호 GET을 수행한다. 각 await 뒤 receiver 함수/객체와 문맥·기한을 다시 검산한 **비공개 producer**만 PreAuthoritySigningFrame을 만든다. renderer는 current/frame/read callback을 주입하지 못한다. 서버 OPEN은 이 사전 관측만 믿지 않고 원 row/current를 다시 검산한다.

기존 `trust-enrollment-owner.createNativeProofSource`의 authorityRef/material.authority/current 의존 서명 source나 `NativePreparationProofSigner`/`NativePreparationHttpsChannel`을 **OPEN에서 호출하지 않는다**. 새 owner의 pre-authority method가 위 새 frame과 새 typed key-host operation을 소비하며 기존 native SIGN의 필수 authority·hash·parser 조건은 삭제하지 않는다. authority 이후 기존 native current/challenge/consume는 원 source를 사용한다. 새 ACK typed proof는 이 신규 수신 목적 안에서 실제 slot 수용·delivery/authority/command의 ref/hash와 원 current를 추가 검산하며 기존 SIGN 목적을 재사용하지 않는다.

서명 대상은 ReceiveProof 전체 canonical UTF-8 bytes다. phase/전체 target/모든 null/원 ref/hash/nonce/기한도 빠짐없이 서명한다. signature 자체는 원형 바깥의 `X-Anvil-Native-Receive-Signature`, proof는 `X-Anvil-Native-Receive-Proof`에 canonical base64url로 보낸다. challenge의 target은 실제 method/path 및 `{}` queryHash와 정확 bodyHash에 일치해야 한다. nonceDigest만 서명하거나 path를 caller가 바꾸는 형식을 허용하지 않는다.

| phase | receiveSessionRef | offerRef / armRef | deliveryRef / authorityRef / commandHash |
|---|---|---|---|
| OPEN | null | 모두 null | 모두 null |
| STREAM | 필수 | 모두 null | 모두 null |
| ARM | 필수 | offerRef 필수 / armRef null | delivery·authority null / commandHash 필수 |
| ACK | 필수 | 모두 필수 | 모두 필수 |
| STATE | 필수 | 모두 null | 모두 null |
| CLOSE | 필수 | 모두 null | 모두 null |

windowRef/challengeRef/원 tuple은 모든 phase에서 필수다. STATE/CLOSE는 window/session의 현재 head를 서버 내부에서 검산하므로 아직 없는 binding을 입력하게 하지 않는다. state 결과를 채워 서명 원문을 암묵 변경하지 않는다. ACK의 deliveryRef는 실제 최초 frame에 있는 exact delivery fullref다. phase 간 nonce 재사용0, 동일 nonce의 다른 원문0, 단발 소비 뒤 재서명·재발급0이다. 공개 phase STATE는 내부 occurrence1/2에 대응하며 최대 두 번이다. 서버가 lock/CAS로 다음 occurrence를 선택하고 같은 requestId는 같은 occurrence/challenge만 반환한다. caller가 occurrence를 선택하지 않는다. 나머지 phase의 challenge는 각 한 번이며 동일 요청 조회는 새행0·기한연장0이다.

## 7. OPEN·STREAM·ARM·ACK·STATE·CLOSE HTTP

OPEN challenge는 원 HUMAN Session으로만 POST `/api/v1/projects/:projectId/native-receive-windows/:windowId/open-challenge`에 exact `{schemaVersion:1,requestId}`를 보낸다. CSRF/current 검산 후 V<Challenge>를 반환한다. 원 window의 동일 tuple·OPEN target을 서버가 정한다. 아직 없는 receiveSessionRef를 요구하지 않는다. 이 challenge 발급/조회 재사용의 영속 비용·거절 admission은 별도 비용 계약에 연결한다.

Native endpoint는 고정 `/api/v1/native-first-receive` 아래다.

| HTTP | exact body·인증 | 성공 의미 |
|---|---|---|
| POST `/windows/:windowId/open` | `{schemaVersion:1,windowRef}` + OPEN typed proof. cookie/bearer 없음 | 원 HUMAN session/등록/current를 다시 검사하고 단발 CAS COMMIT 뒤 receive-only credential frame 한 번 반환 |
| POST `/sessions/:sessionId/challenges` | `{schemaVersion:1,requestId,phase,offerRef,armRef,deliveryRef,authorityRef,commandHash}` + receive-only bearer | 허용 phase의 위 null 표를 검사하고 exact target을 정한 V<Challenge>. OPEN phase 요청 금지 |
| GET `/sessions/:sessionId/stream` | query0/body0 + STREAM proof·receive-only bearer | 정확 하나의 수신 통로를 점유. 한 frame 후 종료. 재연결로 재전달하지 않음 |
| POST `/sessions/:sessionId/arm` | `{schemaVersion:1,windowRef,offerRef,commandHash}` + ARM proof·receive-only bearer | current·실제 stream·offer 원문/원 승인 현재성 검산 후 V<Arm>. 원 native authority/승인 소비는 아직0 |
| POST `/sessions/:sessionId/ack` | `{schemaVersion:1,windowRef,armRef,deliveryRef,authorityRef,commandHash,slotReceipt:V<SlotReceipt>}` + ACK proof·receive-only bearer | broker에 후보를 건넨 경우202 `{candidateRef,disposition:'CANDIDATE_ONLY',confirmed:false}`. CONFIRMED/COMMIT 증거가 아님 |
| POST `/sessions/:sessionId/state` | `{schemaVersion:1,windowRef}` + STATE proof·receive-only bearer | ReceiveState만 반환. credential·native secret 재반환0 |
| POST `/sessions/:sessionId/close` | `{schemaVersion:1,windowRef,reason:'USER_CANCELLED'}` + CLOSE proof·receive-only bearer | 아직 명령 소비/전송이 시작되지 않은 경우에만 확정 terminal. 진행 중/불명이면 닫기 성공을 주장하지 않고 거절 |

경로의 sessionId는 신규 ReceiveSession.sessionId이며 원 auth_sessions.id가 아니다. receive-only bearer는 `Authorization: AnvilReceive <base64url43>`로 제안하며 기존 NativeOnly Bearer/StatusOnly와 구분한다. 다른 목적 endpoint에서 거절한다. header 비밀을 로그/JSON error/IPC/감사에 기록하지 않는다. challenge 요청은 bearer만으로 해당 slot의 nonce를 요청하지만 STATE의 두 occurrence/그 외 phase별 한 번·원 current tuple·행수 한도를 지켜야 하며 typed proof 없이는 phase 실행0이다.

OPEN의 binary frame은 `uint32BE(metadata UTF-8 byteLength) || canonical metadata || receiveCredential43`다. metadata exact `{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_CREDENTIAL',windowRef,session:V<ReceiveSession>}`이며 ReceiveSession은 `{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_SESSION',sessionId,windowRef,credentialId,issuedAt,expiresAt}`다. Content-Type은 application/octet-stream, 압축0, 뒤따르는 bytes0이다. credential digest만 DB에 저장한다. 새 receive credential과 기존 native opaque43은 서로 다른 비밀이다. 비밀/COMMIT 반환 유실 뒤 frame 재구성·재발급0이다.

stream의 Delivery는 `{ref,snapshot}`이며 snapshot exact `{schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_DELIVERY',deliveryId,bindingRef,armRef,authorityRef,authority,commandHash,metadata,issuedAt,expiresAt}`다. `authority`는 원 native authority의 기존 exact 원형 전체이며 authority.ref=authorityRef이고 Binding의 authorityRef 및 metadata.authorityRef와 같아야 한다. main은 이를 검산해 authority가 필요한 기존 slot을 생성한다. 권위가 아직 없는 OPEN에서 slot/NativePreparationHttpsChannel을 생성하지 않는다. `metadata`는 기존 native 정확6키 그대로이고 opaque43은 기존처럼 별도 protected bytes로 전달한다. frame은 `uint32BE(canonical Delivery bytes) || canonical Delivery || opaque43`, 뒤따르는 bytes0이다. 원 authority snapshot의 기존2,097,152B 상한을 그대로 보존한다. 비용 담당의 수기 typed 전개는 metadata6 M=312+g+G+C≤634B, authority 없는 D0=737+M≤1371B다. g≤16자리, 등록/profile Ref G/C≤153B, 신규 v1Ref138B, UUID 문자열38B·hash 문자열66B·기존 isoV1 시각 문자열26B 조건이다. authority:V 추가는13+2,097,310B이므로 Delivery snapshot≤2,098,694B, V<Delivery>≤2,098,852B, uint32BE4+V+opaque43 frame≤2,098,899B를 제안 상한으로 고정한다. 새16KiB 전체 frame 제한은 두지 않는다. Main이 별도로 수거한 순수 메모리 산술도 같은 값과 일치했다. 이는 PG·실제 TLS/전송 PASS가 아니다. 신규 Delivery snapshot에는 별도 typed cap2,098,694B를 적용하고 원 NativeAuthority snapshot에는 기존2MiB를 그대로 적용한다. 원 native snapshot 공용검사를 전체적으로 넓히거나 이 새 외피에 잘못 재사용하지 않는다. frame2,098,899B는 명시한 uint32/Delivery V/opaque43만 포함하며 추가 manifest·구분자·HTTP header·ACK·L.result_ref 복제·원장 자기비용은 포함하지 않는다. 프레임에 추가 필드를 넣으면 이 고정식을 재검토해야 한다. 기존 opaque나 command 원문은 추가 복제하지 않는다.

## 8. slot 수용 proof와 비공개 broker

```text
SlotReceipt={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_SLOT_ACCEPTED',
 receiptId:Uuid,windowRef:Ref,receiveSessionRef:Ref,bindingRef:Ref,armRef:Ref,
 deliveryRef:Ref,authorityRef:Ref,commandHash:Hash,
 metadataHash:Hash,acceptedAt:At,expiresAt:At}
```

slot.accept(void)를 호출했다는 이유만으로 SlotReceipt를 만들지 않는다. receiver adapter가 기존 slot의 exact metadata·authority/current·기한과 새 delivery/binding/ARM/command 결박을 검산하고, 실제 정상 단발 수용이 끝난 뒤 같은 main 소유 수신 instance에서만 receipt를 만든다. typed ACK가 그 ref/hash를 서명한다. 이는 휘발 수용 증거이며 Agent 실행·영속 설치·실행 성공이 아니다. metadataHash는 기존6키 canonical의 hash이며 opaque 비밀의 hash를 공개 대체표식으로 추가하지 않는다.

원 native operation은 비공개 broker waiter를 소유한다. stream과 operation이 같은 server process의 owner instance라는 실물 조건을 검사한다. 서버 내부 head에는 brokerInstanceId·operation fence·stream 점유를 저장하고 shared CAS로 한 번만 binding한다. 메모리 broker만으로 다중 process/restart 단발성을 보장한다고 하지 않는다. 다른 process가 해당 broker를 인수하거나 재시작한 operation을 이어서 전송하지 않는다. owner process가 다르면 기존 효과 전 `NATIVE_RECEIVE_OWNER_UNAVAILABLE`로 거절하며 transparent forwarding/RPC를 이 제안에 숨기지 않는다. 실제 다중 process 가용성·라우팅 방식은 후속 채택 조건이다.

202의 candidateRef는 입력 slotReceipt.ref 그대로다. 후행 Tx가 승인할 ACK 불변행의 원문은 SlotReceipt 그대로이며, 전달 proof/서명·nonce 소비행은 그 ref/hash와 별도로 결박한다. 별도의 이름뿐인 ACK 원형을 발명하지 않는다. ACK endpoint는 원 operation의 DB lock을 잡고 operation 완료를 기다리지 않는다. 검산된 후보를 아직 살아 있는 exact waiter에 전달하고202를 반환한다. supplier도 ACK HTTP 응답을 기다린 뒤 원 operation을 풀어주는 순환을 만들지 않는다. 원 operation만 남은 원10초 안에서 ACK 후보·등록/current/물리행을 검산하고, nonce 소비·ACK 불변행·기존 DELIVERY_CONFIRMED의 ackRef·terminal·예약 정산을 **같은 후행 Tx**로 COMMIT한다. 검산된 후보라도 해당 COMMIT 전에는 확인 완료가 아니다.

원 Tx가 명확히 거절되면 후보를 성공으로 쓰지 않는다. timeout/COMMIT 불명/owner 소실 뒤 ACK handler가 별도 Tx로 성공·terminal을 대신 만들지 않는다. 이미 COMMIT된 동일 ACK의 명시 결과 조회는 역사 hash/물리 closure를 검산하는 read이며 새 effect를 만들지 않는다. 동일 nonce의 다른 ACK는 충돌이다.

## 9. 상태·기한·CLOSE·UNKNOWN

영속 head의 유효 phase는 `WINDOW_PREPARED → OPENED → STREAMING → OFFERED → ARMED → BOUND → ATTEMPTED → CONFIRMED|UNCONFIRMED`다. STREAMING 상태에서만 offer가 가능하도록 제안한다. 닫기는 WINDOW_PREPARED/OPENED/STREAMING/OFFERED/ARMED에서 명확한 current CAS로만 CLOSED가 된다. BOUND 이후에는 명령 Tx/전송/후행 저장과 경합하므로 user CLOSE로 성공 회수를 약속하지 않는다. 첫 terminal 뒤 다른 terminal 추가0이다.

UNKNOWN은 임의로 기록하는 성공/terminal phase가 아니라 **관측 결과**다. 저장 phase가 ARMED/ATTEMPTED인 채 operation 정착을 알 수 없으면 query가 그 역사와 현재 가용성을 분리해 반환한다. 시각이 지났다는 이유로 terminal/hold 해제를 자동 생성하지 않는다. 현재성 만료는 새 효과0을 뜻하며 과거 성공을 소급 부정하지 않는다.

```text
ReceiveState={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_STATE',windowRef:Ref,
 phase:'WINDOW_PREPARED'|'OPENED'|'STREAMING'|'OFFERED'|'ARMED'|'BOUND'|
       'ATTEMPTED'|'CONFIRMED'|'UNCONFIRMED'|'CLOSED',
 receiveSessionRef:Ref|null,offerRef:Ref|null,armRef:Ref|null,bindingRef:Ref|null,
 deliveryRef:Ref|null,authorityRef:Ref|null,ackRef:Ref|null,terminalRef:Ref|null,
 current:{checkedAt:At,usable:boolean,reason:'CURRENT'|'EXPIRED'|'REVOKED'|
 'SESSION_CHANGED'|'CONTROL_CHANGED'|'WRITER_CHANGED'|'OWNER_UNAVAILABLE'},
 observedAt:At,expiresAt:At,executionAuthorized:false}
```

phase별 null은 앞 단계 ref가 모두 존재하는 누적 규칙이다. WINDOW_PREPARED에는 windowRef만, OPENED/STREAMING에는 sessionRef까지, OFFERED에는 offerRef까지, ARMED에는 armRef까지, BOUND에는 binding/authorityRef까지, ATTEMPTED에는 deliveryRef까지 필수다. CONFIRMED는 ackRef/terminalRef 필수, UNCONFIRMED는 ackRef:null/terminalRef 필수다. CLOSED는 terminalRef 필수이고 그 전까지 확정된 참조는 보존한다. current.usable은 CURRENT일 때만 true이며 원 command 실행권을 뜻하지 않는다. 새 권위가 필요한 필드는 usable 하나로 우회하지 않고 각각 원 current 검산을 수행한다.

window/session/offer의 제안 최대 수명은120초이며 각각 원 window·auth session idle/absolute·재인증·정책·등록·profile 기한의 최솟값만 사용한다. challenge는 그 부모의 남은 기한과30초 중 최솟값이다. ARM도 원 window를 넘지 않는다. native 명령 진입 후 delivery/ACK/후행 COMMIT은 원 native10초와 모든 부모의 최소기한 안이어야 한다. 조회·재연결·중복 요청으로 issuedAt/expiresAt/원 monotonic 예산을 갱신하지 않는다.

OPEN 비밀 유실, ATTEMPTED COMMIT 불명, 부분 write, ACK 유실, 후행 COMMIT 불명, broker/slot process 종료는 원 HUMAN 고정 GET 결과 조회만 허용한다. native STATE는 challenge 발급/서명 검산·단발 원장 소비를 수반하므로 순수 읽기라고 표현하지 않으며 결과불명 뒤에는 새 challenge·STATE POST도 호출하지 않는다. native secret/receive credential 재발급·전달 재호출·이어쓰기·자동 재정산·새 window로 같은 명령 우회0이다. 확정 결과 조회 실패를 실제 성공 또는 명확 실패로 임의 변경하지 않는다.

## 10. 로컬 IPC exact 원형

localReceiveAttemptId는 begin을 받은 main이 새로 만드는 휘발 수신시도 UUID이며 renderer가 입력하지 않는다. IPC attemptId는 기존 로컬 등록 attempt ID다. 같은 이름의 auth session/receive session/등록 attempt를 혼동하지 않는다. IPC는 기존 local trust UI sender만 허용하고 remoteWeb/preload에 새 능력을 주지 않는다. 아래 이름/입력은 신규 제안이다. project/registration/key/origin/authSessionId/CA/token/command 본문을 입력으로 받지 않는다.

| channel | exact 입력 | 의미 |
|---|---|---|
| `anvil:native-receive-begin` | `{requestId,attemptId,epoch}` | 원 REGISTERED trust attempt에 대한 일회 준비. attemptId는 서버 session/window ID가 아니라 기존 로컬 등록 attempt다 |
| `anvil:native-receive-status` | `{attemptId,epoch}` | main 현재 시도 표시. 네트워크 조회는 별도 명시 refresh에서만 수행 |
| `anvil:native-receive-refresh` | `{requestId,attemptId,epoch}` | 원 window/offer의 보호 GET을 명시 수행. nonce/새 시도 발급0 |
| `anvil:native-receive-arm` | `{requestId,attemptId,epoch,offerRef,confirmed:true}` | main이 보호 GET으로 같은 offer 원문을 다시 읽고 hash/current를 검산한 뒤 typed ARM. renderer 제공 ref만으로 채택0 |
| `anvil:native-receive-close` | `{requestId,attemptId,epoch,confirmed:true}` | main의 원 시도를 명시 종료 요청. 진행 중/불명 회수를 성공으로 바꾸지 않음 |

성공 IPC 응답은 exact `{ok:true,value:{attemptId,epoch,phase,windowRef,offerRef,armRef,commandId,commandHash,expiresAt,outcome}}`다. phase는 main 표시 `IDLE|PREPARING|WAITING_COMMAND|OFFERED|ARMED|RECEIVING|CONFIRMED|UNCONFIRMED|CLOSED|UNKNOWN`이고, ref/commandId/hash/기한은 아직 없는 단계에서 null이다. outcome은 `NONE|CONFIRMED|UNCONFIRMED|UNKNOWN`이다. IDLE은 모두 null/NONE, OFFERED부터 offer/commandId/hash 필수, ARMED부터 armRef 필수다. UNKNOWN은 이전 확정 metadata를 보존하며 성공으로 채우지 않는다.

실패 IPC 응답은 exact `{ok:false,error:{code}}`이며 code는 `INPUT_INVALID|IPC_DENIED|BUSY|CONTEXT_CHANGED|PROTECTION_UNAVAILABLE|EXPIRED|OUTCOME_UNKNOWN` 중 하나다. 오류에 원 body/서명/키/credential/CA/SQL/경로를 넣지 않는다. epoch와 원 owner/view/origin/authEpoch가 바뀌면 늦은 응답 채택0이며 이전 시도·미정착 hold를 새 시도로 덮어쓰지 않는다.

첫 구현의 로컬 명시 수신·ARM 확인은 일회 수직 경로다. 매 명령 PC 조작을 최종 제품완료 해법이라고 주장하지 않는다. 일반 수신 시작·원격/mobile·교차-client 위임은 후속 미완료 요구로 유지한다.

## 11. 저장·비용 담당 계약과 연결점

새 window/head/session/offer/ARM/binding/Delivery/challenge/ACK/terminal/reservation은 원 native authority/event와 별도 목적이다. Window/Offer 전체 V를 ProjectResult.data로 반환하므로 원 command가 L.result_ref에도 실제 복제된다. 그 복제와 기존 공통 data.ref도 비용에서 제거하지 않는다. Delivery 불변행 한 개를 R에 보관하고 authority 전체의 실제 복제·canonical text/JSONB 병행 저장분을 계상한다. 공개 STATE의 내부 occurrence1/2는 앞 표의 두 검증 ticket과 같은 건이며 별도 무한 발생으로 해석하지 않는다. 원 명령·영수증·감사를 그대로 두고 fullref로 연결하며 비용 때문에 존재하는 실물 복제분을 지워 계산하지 않는다. 실제 저장 표의 책임은 receive head의 원 tuple/활성 slot unique·불변 snapshots/events의 fullref/hash·phase challenge occurrence unique·원자 binding/terminal CAS·실물 reservation이다. 구체 DDL/FORCE RLS/SD reader/정확 EXECUTE·role·역완결 구현은 이 wire와 비용 담당의 exact 저장 schema를 함께 소비해야 하며 기존 SQL 수정이나 실제 적용을 이 문서로 허용하지 않는다.

비용 담당자가 확정할 사항은 다음 접점이다. 이 문서는 임의 비용식·자리수·고정 종료시각을 만들지 않는다.

1. window/challenge 발급 전 종료·불명 상태 유지분의 사전예약.
2. offer/ARM 시 원 command 실제 bytes와 native 발급/후행/공통 원장 미래량 예약.
3. authority/Binding 동일 Tx와 ATTEMPTED/ACK 후행 Tx에서 actual 증가·미래예약 감소의 정확 한 번 전환.
4. OPEN 반환 소실·거절 admission·동일 요청 조회/충돌·STATE/CLOSE 최대횟수의 실제행/미래행 비용.
5. 자동 삭제0·UNKNOWN hold 자동반환0·명확 종료만 정산하는 역완결과 기존 account collector 전 소비선.

각 예약은 caller bytes/count가 아니라 검산된 원형·물리행으로 산출해야 한다. 이 접점과 profile 권위가 닫히기 전 SOURCE_GO0을 해제하지 않는다.


## 12. 새 endpoint의 고정 오류 원형

새 receive/profile endpoint의 실패는 exact `{code,requestId,outcome}`로 제안한다. requestId는 검산된 UUID가 있으면 그 값, 없으면 null이며 원 body/임의 예외를 반사하지 않는다. outcome은 `REJECTED|UNKNOWN`이다. 기존 native endpoint의 오류 DTO는 변경하지 않는다.

| HTTP | 고정 code | outcome |
|---|---|---|
| 400 | `NATIVE_RECEIVE_INPUT_INVALID` | REJECTED |
| 401 | `AUTH_REQUIRED` 또는 `NATIVE_RECEIVE_AUTH_REQUIRED` | REJECTED |
| 403 | `NATIVE_RECEIVE_PURPOSE_DENIED` | REJECTED |
| 404 | `NATIVE_RECEIVE_NOT_FOUND` | REJECTED |
| 409 | `NATIVE_RECEIVE_CONFLICT`, `NATIVE_RECEIVE_CONTEXT_CHANGED`, `NATIVE_RECEIVE_IN_FLIGHT` | 실제 비즈니스 효과 전에 명확하게 거절된 경우만 REJECTED |
| 412 | `NATIVE_RECEIVE_EXPIRED`, `NATIVE_RECEIVE_REVOKED`, `NATIVE_RECEIVE_PROFILE_UNAVAILABLE`, `REAUTHENTICATION_REQUIRED`, `APPROVAL_BASIS_NOT_CURRENT` | 명확 거절만 REJECTED |
| 413 | `NATIVE_RECEIVE_WIRE_LIMIT` | 파싱/효과 진입 전 REJECTED |
| 429 | `NATIVE_RECEIVE_ADMISSION_DENIED` | 비용 담당의 유한 admission 거절. 원문 감사 자동추가0 |
| 503 | `NATIVE_RECEIVE_OWNER_UNAVAILABLE`, `NATIVE_RECEIVE_SOURCE_UNAVAILABLE` | 효과 진입 전 거절이 증명되면 REJECTED, 아니면 UNKNOWN |
| 503 | `NATIVE_RECEIVE_OUTCOME_UNKNOWN` | UNKNOWN |

같은 code라도 성공·정착을 추측하지 않는다. 알 수 없는 예외/SQL·COMMIT·네트워크 timeout은 raw 원문을 버리고 마지막503/UNKNOWN으로 응답한다. known REJECTED의 고정 감사/거절 ticket 비용과 비즈니스 효과0은 구분하며, 무한 공통 denial INSERT로 대체하지 않는다. UNKNOWN은 자동 재전송 허가가 아니다.
## 13. 검수 범위와 채택 전 선택

source 구현을 채택한다면 실제 controller/route/client/key-host adapter/slot/broker/shared validator를 소비하는 반례가 필요하다. 원 cookie만 OPEN 시도·다른 session/client/control·회수 등록/profile·phase/null/target 변조·동일 nonce 다른 원문·ARM 전 승인 소비·다른 명령으로 바꾼 offer·binding 단독행·ATTEMPTED 불명 뒤 전송·slot.accept void를 ACK로 승격·CLOSE와 늦은 ACK 경합·다른 process/restart·원10초 초과·늦은401/403·비밀 JSON/IPC 반환을 거절해야 한다. 기존 source helper만 다시 검사하거나 bool current 대역으로 실제 연결 완료를 대신하지 않는다.

남은 사람 결정은 이 제안의 새 경로/세 연산/정책·typed purpose·서명범위·profile anchor 생산/배포권위·OPEN binary 반환/유실·ARM header·상태/CLOSE·단일 broker 가용성 제한·120초/30초 및 control 상한을 묶어 채택할지 여부다. 비용/거절 감사 exact 계약은 별도 담당 결과와 합쳐 모순을 검사해야 한다. 어느 항목도 과거 native 승인의 자동 상속이 아니다.

검토용 문서만 작성했다. 코드/시험/SQL·실제 DB·role/권한·키/CA·서비스·Agent·SSH/WSL·새 QA·실자료 조회·승인시각 발급은0이다. 현재 same-client wire 제안은 전체 FN06/계획 완료가 아니다.

## 14. 부모 후보의 한정 보완 이력

부모 wire SHA256 bfb77f2ff11211428f863836f04aa265efe07ff79a0c0b8da26e11ca1cd23762는 역사로 보존한다. Main 독립 I3에 따라 기존 authority.subject.humanSessionId의 보호 Delivery 한정 예외, OPEN 전용 HOST_TRUST_REGISTRATION current/PreAuthoritySigningFrame·producer, 같은 remoteSession hosted Web 명령 시작자를 명시했다. 기존 authority 필드/hash/parser를 redaction하거나 authority-dependent signer를 OPEN에 재사용하지 않는다. 이 수정도 미채택 계약 제안이며 source/실행 GO가 아니다.
