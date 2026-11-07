# FN06/FN08 — 관측 HTTPS wire·실제 전송 코드의 source-only 결정안

상태: 미채택 후보. 기존 구현 승인을 취소하거나 실제 실행을 요청하는 문서가 아니다. Project Main은 승인 계획의 구현을 주도하되, 아래 아직 고정되지 않은 공개 HTTP 형식만 PMO에 결정·지원을 요청한다.

## 1. 왜 이 결정이 필요한가
- UI01의 단계/담당/다음 행동은 현재 listProjects/getProject 응답에 없고 기존 원방법론·승인·초안 카드는 이미 연결됐다. 정의 그래프를 현재 실행상태로 꾸며 채우지 않는다.
- 새 FN07 SDK 객체 codec은 소스 검수를 마쳤지만, 기존 provider-session-claim-v1은 CODEX_APP_SERVER0.161.0/THREAD·TURN/RPC에 결박돼 있다. 이를 Claude session_id/uuid로 몰래 넓힐 수 없다.
- 범용 관측 event11필드는 공급자 독립적이지만 현재 spool→client→server router는 모두 SYNTHETIC_ONLY다. localRecordRef의 형태만 맞춰 새 가짜 원기록이나 합성 bridge를 추가하는 것은 실제 연결 구현이 아니다.
- 기존 FN06_FN08_EXECUTION_DISPATCH_PROPOSAL은 URL·challenge/서명 목적·canonical target·상한을 정의하지만, execution-routes.ts는 HTTP 헤더/리스너/실제 credential 발급을 만들지 않는 모델이라고 명시한다. 실제 origin/CA 처리 선례는 trust-https/source-read-https에 있다.
- 이번 차이는 새로운 업무가 아니라 기존 FN08 관측 전송의 HTTP 인증 포장과 응답 형식을 고정하는 것이다. 새 공개 header/DTO이므로 Main 내부 파일 배치 결정만으로 채택하지 않는다. 실제 DB·권한·키·서비스·Agent 실행 제외는 그대로다.

## 2. 실제 기준 증거
기준 branch codex/av3-stage-b / eea1fb500b8c06cc7e6e84c0bfd9c3287bc985f2.
- docs/contracts/FN06_FN08_EXECUTION_DISPATCH_PROPOSAL.md SHA256 D071CC6AA839E7D48B1A736B38F607D63737518367E3434DC90ED06A7335E327. 기존 C3 제공자 SYNTHETIC_ONLY 강제·P3 실행 경계를 보존한다.
- contracts/runtime/provider-session-claim-v1.ts SHA256 AEC3AF22AD06E821E77905BB4E53479029E0D57E7121314A646A72009C93950D.
- apps/server/modules/executions/execution-routes.ts SHA256 27B00B51C40C1A6D5F12F0976A1739224ED6831FBF0CF7E37649F434DFDF53AB.
- apps/connector/runtime/execution-client.ts SHA256 FEF66DEC8C2AD6A3186FA94B4BD33FF63408FDAF000E5466A67472004B931251.

## 3. 대안·권장
**A 권장 — 정상 EXECUTION 관측의 wire 계약과 실제 HTTPS 호출 코드만 source-only로 구현.** 아래4 신규파일의 코드·합성 HTTP 검수까지 채택한다. import/생성 시 네트워크0, 시험은 명시 request 대역만 사용한다. 기존 모델·생성자 guard를 바꾸지 않고 실제 provider/권한·서비스 등록을 열지 않는다. 장점은 FN06/07 공통의 실제 전송 경로 코드를 마련하는 것이다. 미완료는 실제 producer/보호 원기록·등록/서명 현재성·서버 production repository/공개 경로 등록·실환경 검증으로 남는다.

**B — 먼저 Claude 전용 보호 claim 계약을 채택.** 기존 CODEX v1과 분리한 비권한 준비/관측 참조를 먼저 상세화한다. Agent 교체의 의미는 분명해지지만 현재 전송 소비선이 합성 전용이라 실제 관측 전달 코드는 계속 빠진다. A 이후 별도 진행을 권장한다.

이 후보는 A/B 어느 쪽도 실제 실행 허가로 해석하지 않는다. 전송 코드가 생겼다고 연결 완료/실제 지원으로 보고하지 않는다.

## 4. A안 공개 wire 계약
### 4.1 대상·요청
정상 EXECUTION만 포함한다. RECOVERY/credential 교환/START/SEND/permit/material/commands/stop/heartbeat는 이번 단위에서 거절한다.
- POST /api/v1/connectors/:connectorId/executions/:executionId/challenges — EXECUTION_REQUEST challenge만.
- POST 같은 prefix /observations — 기존 event11필드의 {events,batchHash}만. event kind/reason·scope·sequence/ACK 의미는 기존 계약 그대로다. 실제 Agent의 발생 사실/허가는 별도다.
- connectorId/executionId는 현재 scope의 정확 UUID. query는 빈 객체이며 임의 query/중복·경로 인코딩 변형·redirect를 허용하지 않는다.

기존 서명/nonce/권한 규칙은 변경하지 않는다. challenge body는 기존 request 필드(requestId,purpose,grantRef,credentialGeneration,target,clientNonce,issuedAt)에 signature 한 필드를 붙인 canonical JSON이다. purpose는 EXECUTION_REQUEST, 서명 domain은 EXECUTION_CHALLENGE_REQUEST다. target은 다음 POST observations의 method/path/queryHash/bodyHash와 일치해야 한다. bodyHash는 기존 executionTarget처럼 parseWireJson→canonical JSON의 SHA256이며 raw whitespace의 hash로 바꾸지 않는다.

### 4.2 인증 header 포장(새 결정 부분)
- Authorization: Bearer av3ex1_… (기존50문자 규칙). 이 값은 명시 private 입력으로만 받으며 발급/읽기/보관/갱신을 자동 수행하지 않는다.
- Origin: 명시 설정된 같은 HTTPS origin. Cookie는 빈 값도 포함해 있으면 거절한다. HUMAN·등록/자료읽기/recovery credential fallback0이다.
- observations의 `Anvil-Execution-Auth`는 canonical JSON {schemaVersion:1,challengeRef,proof,signature}의 padding 없는 canonical base64url이다. decoded4KiB/encoded8KiB 이내. challengeRef와 기존 proof의 exact8필드(requestId,method,path,queryHash,bodyHash,grantRef,credentialGeneration,serverNonce)·64바이트 canonical base64 signature를 대조한다. 서명 목적은 기존 EXECUTION_REQUEST_PROOF이며 새 header 때문에 domain이나 서명 바이트를 바꾸지 않는다. JSON 중복키/알 수 없는키/BOM/불완전UTF8/비정상 수·버전/불일치 scope·target은 거절한다.
- challenge 요청에는 위 Auth header를 허용하지 않는다. signature는 4.1의 기존 body 필드로 받는다.
- rawHeaders에서 Authorization/Origin/Anvil-Execution-Auth/Content-Type의 중복·다중값을 검사한다. 인증 정보를 query/body의 다른 임의 위치로 대체하지 않는다.
- Content-Type application/json, POST만. 원문의 parseWireJson/canonical target 검산 뒤 본문을 다른 의미로 재작성하지 않는다.

### 4.3 응답 포장(새 결정 부분)
HTTP200은 {schemaVersion:1,data} exact envelope다. transport:SYNTHETIC_ONLY 모델을 production 응답으로 바꿔 치는 adapter는 금지한다.
- challenge data는 기존 issued 값과 같은 {ref,challenge,credentialIssued:false,nonceConsumed:false,executionAuthorized:false,dispatchPerformed:false}. challenge의 정확 필드는 id,requestId,purpose,grantRef,credentialGeneration,scopeDigest,serverNonce,clientNonce,issuedAt,expiresAt다. ref/id/requestId·grantRef/credentialGeneration·clientNonce 및 일반30초 기한을 고정 원요청과 대조한다. scopeDigest는 hash 형식/기대 원기준이 있으면 그 일치를 검사하되 grantRef만으로 그 값을 만들어내지 않는다. 공개 challenge에는 targetHash가 없으며 target 결박은 원 request/proof와 서버의 현재 저장 검증 책임으로 보존한다. ref.contentHash를 공개 challenge JSON hash로 잘못 재계산하지 않는다.
- observation data는 {proofResultRef,ack,nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false}. ack는 기존 ref/snapshot이고 snapshot은 execution{projectId,executionId,executionGeneration},highestContiguous,maxSequence,contiguousDigest,gaps,storedCount,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt다. 참조 hash/범위·정확 요청 scope와 대조한다.
- 응답 형식/hash 대조는 서버 영속 commit·현재 authority/SDK 발생 출처·실행/업무완료·회수/삭제 권한 증명이 아니다. client의 ackAudited/writerReleaseVerified/actualExecutionVerified/executionAuthorized/dispatchPerformed는 false다.
- non200/비정상형식/timeout/abort/단절은 유한 오류 코드만 반환하고 원 token·서명/원격 오류 원문은 노출하지 않는다. 3xx 추적/자동 retry0이다. 종료 불명은 원 request/proof/event 식별을 보존하고 새 UUID/nonce/허가를 발급하지 않는다.

## 5. A안 내부 전송 코드·상한
명시 origin/공개CA/scope·원요청/서명/정확 credential 입력만 사용한다. HTTPS·기존 제품 port3830·origin 일치·hostname/CA 검증(rejectUnauthorized:true)·agent:false를 고정하며 실제 환경 설정/CA를 읽거나 만들지 않는다. import/constructor는 IO0이고, 실제 method 호출의 default driver는 node:https.request다. 자동 호출/서비스 등록/모델 성공 port를 실제 driver로 주입하는 fallback은 없다. 단위시험은 request 대역만 사용한다.

전체 request deadline10초 이내/원요청·challenge·credential 명시기한 중 최단으로 제한한다. challenge 요청/응답16KiB, observations 요청1MiB·응답1MiB, Auth header4KiB decoded, 유한 event/ACK 범위는 기존 계약 상한을 유지한다. raw response/header·비밀 값을 로그하지 않고 buffer 회수/abort 시 정확 자기 request만 destroy한다. 물리 JS 문자열/GC 소거·OS quota는 보증하지 않는다.

client는 credential·key·서명·UUID/nonce·관측 원기록/권한을 생성하지 않는다. 현재 권한 verifier/서명 producer·원기록 journal이 없으면 외부 caller의 준비가 미완료이며 코드로 성공을 만들어내지 않는다. 네트워크 수신 성공은 별도 관측 결과일 뿐 서버 ACK의 실제 내구성이나 provider 발생 사실이 아니다.

## 6. 정확 구현 범위·검수·되돌리기
채택 후 Main이 별도 WI로 허용 source/test 신규4를 결박한다.
1. contracts/runtime/execution-observation-http-v1.ts
2. apps/connector/runtime/execution-observation-https.ts
3. tests/unit/FN08/execution-observation-http.test.ts
4. tests/unit/FN08/execution-observation-https.test.ts

기존 provider-session-claim-v1/primary·C3 모델/가짜 성공 guard·등록/권한·SQL·서비스 main/실행 mode는 변경하지 않는다. 별도 적용/등록은 이 결정에 포함하지 않는다. 공개 계약 정본의 채택 기록과 WORK_STATUS는 Main이 쓴다.

합성 request 대역으로 정상 challenge/observations 포장·기존 canonical target/body/서명 바이트 불변·중복 header/query/권한종류/다른scope/기한/버전/크기·오류 누출/redirect/retry/abort·응답 불명과 동일 원식별 보존을 시험한다. actual TLS/서버PG/서명키·등록 권한/원기록·SDK/Agent/사용자 인수는 NOT_RUN이다. 기존 모델과의 합성 타입 대응을 실제 연동으로 부르지 않는다. 독립검토·Main 변경범위 검사 후 소유 파일만 기존 branch에 통합한다. rollback은 source 정상 revert이며 실제 자산/환경 변경이 없다.

## 7. PMO에 필요한 정확 결정
A안의 **새 HTTP header/응답 포장 계약과 코드·합성 검수**만 채택할지 결정해 달라. 명시 제외(실제 사용자/백업 자료 조사·키/credential 생성·DB/권한·실제 socket/API/서비스·Agent·기존 project 차단 해제)는 유지한다. A를 채택하지 않으면 기존 계약으로 구현 가능한 다른 업무는 계속하되, 합성 bridge를 실제 연결의 대체물로 더 만들지 않는다.