# FN17 브라우저 중요 푸시 — 통합 계약 후보 r3

2026-11-02 / 기존 Reviewer 어울 / Main 상세화 요청
상태: DRAFT_REVIEW / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0.
현재 규범은 이 단일 본문이다. r1/r2의 원문과 지문은 Git 이력으로 보존하며 뒤 절의 덮어쓰기 방식으로 병존시키지 않는다. 이 문서만 작성하며 제품·SQL·시험·Git·WORK_STATUS·실제 구독/키/DB/서비스/외부 송신은 변경하거나 실행하지 않는다.

## 1. 목표·이미 승인된 기능·범위

사용자가 필요한 결정을 앱 밖에서도 발견하고, 현재 인증된 Anvil 원대상으로 돌아가 확인한다. 알림 클릭은 읽음/승인/명령 소비/제어권 인수가 아니다. 지원 조회·설정 저장·서버 송신 시도·공급자 접수·기기 수신/표시·사람 읽음은 각각 다른 사실이다.

첫 구현 후보 A는 이미 보관된 본인 APPROVAL_REQUESTED/IN_APP 사건에 대한 브라우저 푸시다. 이는 전체 FN17을 승인 요청 하나로 축소하는 선택이 아니다. §13의 입력 요구/중요 오류/안전·기록 공백/한도/완료 후보 생산자는 여전히 FN17 필수 잔여이며 원사건·수신자·중복 계약을 별도로 닫아야 한다.

보존할 기존 계약:
- INTERFACES §14.2의 알림9필드·현재 허가 목록·지원5상태와 기존 registerPushPreference 목적.
- 실제 notification-input.ts의 APPROVAL_REQUESTED/IN_APP 원형·notificationRef hash(readAt 제외).
- requestApproval 성공/원후보 capture·receipt·알림 생산의 동일 Tx, 프로젝트 누적10000행·자동삭제OFF, 알림 저장 실패 시 원승인 요청 rollback.
- 기존 GET/list/mark·본인/프로젝트 격리·원 source command/ref/hash/읽음 proof, UI08/모바일 ApprovalRequestLinks, 기존 명시 읽음 정책.
- 과거 replay/GET/mark는 새 IN_APP를 생산하지 않는다. 새 push 실패/한도/키 부재는 원승인/IN_APP 저장 성공을 소급 취소하지 않는다. 기존0052 본문을 수정하거나 푸시용으로 재해석하지 않는다.

근거:
apps/server/modules/notifications/notification-input.ts
apps/server/modules/notifications/project-notifications.ts
apps/server/modules/notifications/approval-notification-producer.ts
apps/web/src/notifications/project-notifications-api.ts
apps/web/src/notifications/ProjectNotificationsPanel.tsx
apps/web/src/notifications/browser-push-support.ts
apps/web/src/notifications/BrowserPushSupportPanel.tsx
apps/web/src/features/mobile/ApprovalRequestLinks.ts
apps/web/src/shell/routes.ts
docs/contracts/INTERFACES.md §14.2 및 2026-10-28 승인 요청 생산 source 채택 기록.

현재 네 Web 파일은 구독/worker/푸시 설정 저장을 하지 않는다. 실제 목록·상세→기존 승인 링크는 있으나 notificationId로 로그인 복귀/고정 조회하는 route 필드는 없다. source 존재를 실제 served/기기 수신 성공으로 올리지 않는다.

## 2. r2에서 추가로 결정하는 정확 delta

r2 payload={previousRef,enabled,subscriptionInput,reason}에 raw 구독을 바로 넣는 안을 아래의 두 단계로 대체하는 후보를 권장한다. 원문을 범용 inspectPending/capture/공통 command payload 저장에 넣지 않고, 기존 INTERFACES의 subscriptionProtectedRef 목적과 연결한다.
1. 원 commandId에 결박된 보호 입력 준비 endpoint에서 원문을 봉인하고 짧은 수명의 정확 protected inputRef를 생산한다.
2. 기존 PROJECT command의 registerPushPreference는 그 ref와 비밀 없는 metadata만 소비한다. 사용자는 같은 명시 동작 안에서 준비와 저장을 보되 두 결과·UNKNOWN을 구분한다.

새 공개 표면은 보호 입력 준비/상태·current/fixed preference·전달 목록/fixed GET·고정 공개 applicationServerKey profile·notification 선택 route와 service worker다.
새 보호 계약은 구독 원문의 봉인 목적/키 도메인·복호화 사용자, VAPID 전용 키 목적, outbound provider profile/목적지 검산, 지속 nonce/입력/시도 원장·cap·감소 전용 정지 경계다.
전부 미채택이며 기존 로그인/키 파일/백업 DEK·native P256 키/credential·STATUS_ONLY를 이 목적에 재사용하지 않는다.

## 3. 공통 exact 원형·권한

Ref={id:UUID,version:양의안전정수,contentHash:소문자SHA256hex64}. TypedRef={namespace,projectId,ref}.
신규 namespace 후보 PUSH_SUBSCRIPTION_INPUT_V1 / PUSH_PREFERENCE_V1 / PUSH_DELIVERY_V1 / PUSH_PROVIDER_PROFILE_V1 / PUSH_APPLICATION_KEY_PROFILE_V1.
같은 id/version 다른 namespace·hash를 혼용하지 않는다. hash는 기존 canonicalJson/contentHash의 명시 projection에만 적용하고 자기 ref/current 조회시각/미래 delivery ref를 넣지 않는다.

모든 JSON은 정상 UTF-8/Unicode·중복 키/unknown key/getter/추가 prototype 거절이다. UUID/ISO UTC밀리초·정수·canonical base64url을 엄격 검산한다. 일반 command body2MiB 이하, 보호 입력 body16KiB 이하, raw provider body는 일반 API에 반환하지 않는다.
오류는 기존 공통6필드 code/message/requestId/targetId/retryDisposition/commandId의 고정 DTO를 사용한다. raw endpoint/키/auth·세부 경로/query·exception/body/stack은 반환/로그0이다.

최초 준비/선호 저장은 현재 HUMAN 로그인·CSRF/Origin·활성 OWNER·현재 client·단독 제어/세대·명시 registerPushPreference 정책을 검사한다. DENY403, 무정책412, REQUIRE_APPROVAL 또는 nonnull approvalRef는 보호 입력/범용 후보 capture 전에412 PUSH_APPROVAL_NOT_CONNECTED로 거절한다. 일회승인 연결은 이후 별도 계약 전 미지원이다.
원 세션 idle/absolute·정책·profile·구독 기한의 최솟값을 사용하며 현재 reauth 요구가 기존 정책에 있으면 보존한다. 과거 receipt를 현재 허가로 쓰지 않는다.
GET은 현재 본인/current client·활성 OWNER의 프로젝트 접근을 검사하고 제어 보유를 요구하지 않는다. 다른 사용자/client 고정항목은404, 목록 필터로 임의 user/client를 받지 않는다. 새 readPushPreference/readPushDelivery 명시 read 정책 후보가 필요하며 기존 정책에 자동 추가0이다.

## 4. profile·브라우저 구독 준비

고정 공개 application-key profile은 서버 배포의 보호 VAPID key resolver에서 공개키만 투영한다.
ApplicationKeyProfile exact={schemaVersion:1,purpose:PUSH_APPLICATION_SERVER_KEY,ref,applicationServerKey,keyGeneration,providerProfileRefs,expiresAt,current}.
applicationServerKey는 uncompressed P-256 public point65bytes의 canonical base64url, keyGeneration 양의안전정수, providerProfileRefs 최대16 unique fullref다. private key·연락 주소 원문·서버 secret 참조/경로를 반환하지 않는다. current=AVAILABLE|UNAVAILABLE이며 검산되지 않은 설정을 AVAILABLE로 만들지 않는다.
GET /api/v1/projects/:projectId/push-application-key-profile 은 위 현재 보호 읽기 범위에서만 제공하는 신규 후보다. profile 부재는412 PUSH_PROVIDER_UNCONFIGURED이지 임의 기본키 생성이 아니다.

브라우저는 명시 ‘이 기기 푸시 사용’에서만 현재 profile·secure context/permission을 읽고 필요한 권한 요청·전용 service worker 등록·pushManager.subscribe({userVisibleOnly:true,applicationServerKey})를 수행하는 후보다. mount/지원 조회/서버 이벤트/일반 로그인에 자동 권한 요청0.
기존 getPushSupport의 SUPPORTED는 API+권한 관측일 뿐 실제 전달 지원/구독 검증이 아니다. permission 거절/미지원이면 서버 준비/선호 저장0, IN_APP 조회를 유지한다.
기존 다른 용도의 service worker를 덮지 않는다. 고정 script /anvil-push-worker.js·고정 scope / 를 사용할 수 있는지 Main이 source/build·기존 배포와 대조한다. 충돌/미지원이면 UNAVAILABLE이며 임의 새 scope나 worker takeover0.
pushsubscriptionchange에서 자동 서버 등록/재발급0. 원 구독 변경은 현재 화면의 명시 재준비/정확 previousRef CAS로만 저장한다.

SubscriptionInput exact={endpoint,expirationTime,p256dh,auth}.
endpoint 최대4096자의 HTTPS URL, userinfo/fragment0, query/path는 허용하되 보호 원문에만 보관한다. expirationTime은 null 또는 유효한 미래 ms 안전정수다.
p256dh는 canonical base64url65bytes uncompressed P256 point/곡선 검산, auth는 canonical base64url16bytes다. 단순 길이/문자열만으로 유효 point라 하지 않는다. 원문 전체 canonical16KiB를 넘으면 거절한다.
applicationServerKey/profile generation을 클라이언트가 임의 교체하지 못하게 prepared input과 server profile을 결박한다. 브라우저가 실제 protected recipient임을 원문 수용만으로 증명했다고 하지 않는다.

## 5. 보호 입력 준비·원문 비반출·봉인

신규 POST /api/v1/projects/:projectId/push-subscription-inputs
body exact={commandId,previousRef,providerProfileRef,applicationKeyProfileRef,reason,subscriptionInput}.
이 commandId는 부모 App이 준비 시작 전에 고정한 registerPushPreference 의도 ID다. 아직 inputRef가 없으므로 이때 최종 PROJECT body를 만들었다고 주장하지 않는다. previousRef 최초null/후속 현재 exact ref. recipient/user/client/세대/session은 서버 인증에서 도출한다. 현재 §3 정책·소유·기한을 먼저 검사한다.
응답 exact={inputRef,metadata,expiresAt,disposition:PREPARED|REPLAY_ONLY}.
metadata exact={endpointOrigin,subscriptionHash,providerProfileRef,applicationKeyProfileRef,subscriptionExpiresAt}. origin은 endpoint의 정규 origin만, path/query/키/auth 원문0. 구독 원문hash는 인증 증거가 아니며 용도/원command 귀속 검산에만 사용한다.
GET /api/v1/projects/:projectId/push-subscription-inputs/by-command/:commandId 는 현재 본인/client·동일 프로젝트의 exact 원준비 상태만 돌려주는 신규 보호 조회다. 원문/재봉인/새 nonce/새 inputRef0. command당 input1, 다른 원문/이전ref/profile의 재사용409, 최초 입력 기한120초·연장0이다.

저장 plaintext projection exact:
{schemaVersion:1,purpose:PUSH_SUBSCRIPTION_SECRET_V1,projectId,ownerUserId,clientId,authSessionId,credentialGeneration,controlGeneration,commandId,previousRef,providerProfileRef,applicationKeyProfileRef,reason,subscriptionInput,subscriptionHash,createdAt,expiresAt}.
이 projection은 봉인할 private 입력이며 공통 command/audit/후보·정상 GET/브라우저 buffer에 복제하지 않는다. 공통에는 inputRef·hash·소유/원command/profile/상태만 남긴다.
보호 저장 row는 암호문과 고정 AAD metadata를 보관하고 namespace/project/owner/client/원command를 복합 결박한다. DB의 일반 app raw SELECT/INSERT로 ciphertext나 metadata를 빼도 복호화/임의 대상 송신 권위를 얻지 못하도록 좁은 definer/목적 포트·RLS/ACL을 독립 검수한다.

봉인 resolver 목적 후보:
- sealSubscription(input,context) → SealedInput{sealedRef,ciphertext,keyGeneration,nonceReceiptRef,aadHash,plaintextHash}.
- useSubscription(sealedRef,deliveryPermit,callback) → typed outcome.
공개 plaintext getter/임의 bytes decrypt는 없다. callback은 보호 worker의 exact endpoint/암호화 대상 사용에만 제공되며 raw secret을 일반 서비스/로그에 반환하지 않는다.
context는 서버 내부 현재 인증/원command/프로젝트·profile·expiry이며 외부 caller가 verified:true/actor/purpose 문자열로 만들지 않는다. resolver 실제 producer는 현재 없다. 미구성은 준비/송신412로 닫는다.

보호 봉인 알고리즘 권장 후보는 AES-256-GCM/tag16·12byte nonce·32byte 전용 sealing key, envelope exact={schemaVersion:1,purpose:PUSH_SUBSCRIPTION_SEALED_V1,keyGeneration,nonce,aadHash,ciphertext,tag}이며 최대32KiB다. nonce/tag/ciphertext는 canonical base64url이다.
AAD는 위 목적·namespace·프로젝트/owner/client·원command/input ID·previousRef·profile refs·plaintextHash·createdAt/expiresAt의 canonical bytes다. final 인증과 exact AAD가 모두 맞기 전 원문을 사용하지 않는다. epoch/revision 이름 변경이 동일 실키 nonce 도메인을 나누지 않는다.
동일 실키의 독점 사용/이력·지속 nonce 예약/사용량을 검산하는 보호 key manager가 없으면 실제 seal을 거절한다. backup key envelope/사용자 DEK·등록/native 서명키를 가져다 쓰지 않는다. 정확 key 보관/회전·유실·회수/backup 정책은 §14의 새 결정이다. 암호명만 적어 이미 구현됐다고 하지 않는다.

원자성 순서:
1. 최신 현재 권한/previousRef/profile/원 hash를 검사하고 짧은 준비 식별자를 고정한다.
2. 보호 key manager가 원 input/command와 결박한 nonce를 독립 지속 예약·COMMIT 확인한다. 상위 project lock을 보유한 채 같은 project lock을 요구하는 별도 Tx를 중첩하지 않는다. key manager는 별도 key-domain lock만 사용한다. 예약 결과 불명은 재사용/새 nonce 자동발급0이다.
3. 명시 원예산 안에서 seal한 뒤 현재 identity/정책/기한·원입력을 다시 검사한다.
4. 같은 준비 Tx에서 sealed row·input metadata·원준비 감사/상태를 원자 저장한다. cipher 평문은 DB에 넣지 않는다. 이 준비 성공이 preference 활성화/송신은 아니다.
5. 준비 COMMIT 불명이면 원 commandId 조회만 허용한다. nonce 예약은 소모/held로 남고 원문을 재봉인하지 않는다. 정상 재조회는 같은 inputRef를 반환한다.
6. registerPushPreference Tx가 exact prepared input·현재 권한/기한·원commandHash를 검산하고 한 번 소비 표시·불변 preference version/head·공통receipt/audit를 함께 저장한다. 다른 명령/input 중복 소비·마지막단계 누락·고아 ciphertext를 지연완결/reverse guard로 거절한다.
input 저장 뒤 final command 전 crash는 미활성 prepared 이력으로 보존하며 자동 preference 생성0. DB/state와 외부 key manager의 전역 원자성을 주장하지 않는다. 만료/회수·nonce 소모는 raw 원문 자동삭제 권한이 아니다.

## 6. 선호 명령·GET·replay·UI 원명령

기존 PROJECT 외피 operation=registerPushPreference, payload 후보:
{previousRef,enabled,subscriptionProtectedRef,providerProfileRef,applicationKeyProfileRef,reason}.
enabled=true는 보호 준비 exact inputRef와 두 profile이 필수, false는 세 ref null이다. 최초 previousRef/targetId null·expectedVersion0, 개정은 현재 본인/client/project exact previousRef와 그version. baselineRefs는 profile/원선호의 정렬 unique refs로 고정하고 approvalRef는null이다.
reason 정상 Unicode1..2000자·민감 내용 검사는 기존 원칙, raw endpoint/키를 reason으로 받지 않는다. subscriptionProtectedRef는 §5의 원 commandId와 같아야 한다. disable은 명시 감소 경계 §10을 우선 제공하며 이 일반 command의 정책을 완화하지 않는다.

PreferenceSnapshot exact={schemaVersion:1,purpose:PUSH_PREFERENCE_V1,projectId,ownerUserId,clientId,credentialGeneration,authSessionId,enabled,previousRef,subscriptionProtectedRef,endpointOrigin,providerProfileRef,applicationKeyProfileRef,activationWatermark,createdAt,expiresAt,reason}.
activationWatermark={notificationSequence,activatedAt}는 서버에서 생성한다. 최초 활성화 이전 IN_APP/backfill을 push하지 않는다. enabled=false에는 subscription/profile/origin/watermark null, expiresAt=createdAt로 닫아 새 전달권위0이다.
preference ref hash는 immutable snapshot 전체·원command/receipt의 검산된 연결에 결박하며 current/revocation/stop 표시는 별도 current projection이다. 과거 version의 expiry/enable을 바꿔 현재화하지 않는다.

신규 GET /api/v1/projects/:projectId/push-preferences/current
및 /push-preferences/:id/versions/:version
DTO exact={ref,snapshot:metadata,current,observedAt}.
metadata exact={enabled,subscriptionProtectedRef,endpointOrigin,providerProfileRef,applicationKeyProfileRef,createdAt,expiresAt}; rawreason/endpointpath/query/키/auth·원 sessionID는 반환하지 않는다.
current exact={state:READY|UNVERIFIED|REVOKED|EXPIRED|STOPPED,reasonCode,observedAt}. READY는 key/profile/current 검사 성공·전달 가능 후보일 뿐 실제 송신/수신/표시 성공은 아니다. 미검증 resolver는 READY0이다.
공개 ref hash는 저장 원 snapshot 검산을 서버에서 수행한 결과이며 metadata 투영을 원 snapshot처럼 hash 재계산하지 않는다. 브라우저 검산이 필요한 경우 명시 metadataHash를 별도 제공하는 개정이 필요하고 이를 같은 hash로 위장하지 않는다.
rawreason 없는 metadata ref와 원 snapshot ref의 의미/브라우저 validation은 정확 schema 시험에서 고정한다.

공통 command receipt는 기존6필드/ProjectCommandResult envelope를 유지하고 data={status:PUSH_PREFERENCE_STORED,preferenceRef,enabled,completedDelivery:false}만 반환한다. 보호 입력 성공/선호 저장 성공/후속 GET 실패를 구분한다.
현재 auth·CSRF·정책/주체/이전ref를 replay 앞에서 검사한다. replay는 원receipt를 반환하고 input 재봉인/구독 재등록·새 version/송신0이다. 오래된 receipt로 현재 STOPPED/REVOKED·expired 상태를 덮지 않는다.

App CAS buffer에는 비밀 없는 원command/body·inputRef·receipt만 보관한다. subscriptionInput은 준비 호출 동안 private 일시 메모리에만 두고 성공/오류/문맥폐기 뒤 참조 해제한다. JS/브라우저 메모리 전체 소거를 보장하지 않는다. 원문이 사라진 준비 UNKNOWN은 자동 새준비 대신 by-command 조회한다.
project/user/client/session/CSRF/API/동일객체 transport/route·닫기/unmount·A→B→A ticket을 모든 await/JSON/digest/POST 직전에 재검사한다. 옛401/403은 현재 로그인·buffer를 지우지 않고 옛finally가 새 latch를 풀지 않는다. 명시 같은 원명령 재확인만 가능하고 자동 POST0이다.

## 7. provider profile·외부 목적지 검증

ProviderProfile exact 후보:
{schemaVersion:1,purpose:PUSH_PROVIDER_PROFILE,ref,origin,pathPrefixes,port,tls,applicationKeyProfileRef,limits,expiresAt}.
origin은 고정 HTTPS 정규 origin, port443만 초기 지원한다. pathPrefixes는 최대16의 고정 ASCII absolute path prefix이며 경계 slash까지 대조한다. endpoint query는 보호 전달하되 리다이렉트/userinfo/fragment0이다. string prefix로 host를 비교하지 않는다.
tls={minimumVersion:TLSv1.2,systemChain:true,hostnameCheck:true,redirect:false,agentReuse:false}.
limits={requestMs:10000,responseBytes:16384,ciphertextBytes:4096,ttlSeconds:300,dnsAnswerCount:8}.
이 수치는 신규 후보값이며 provider/운영 지원과 호환되는지 Main의 공식 문서·source 대조가 필요하다. 현재 공급자 origin/profile은 선정·등록되지 않았으며 임의 endpoint를 profile로 자동 만들지 않는다.

준비 시 URL 구조/origin/profile/key 결박을 검사하고 전달 직전에 동일 profile ref/current/기한과 endpoint를 다시 검사한다. DNS resolver는 최대8개 답·그중 public global unicast만 허용하고 loopback/private/linklocal/unspecified/multicast/IPv4-mapped private·클라우드 metadata 대역·혼합 불가 답을 거절한다. 문자열 부분 일치로 IP를 판정하지 않는다. 정확 주소 분류 table/IPv6 처리와 profile 실제 RRset은 WI에서 고정한다.
검산한 단일 주소/family를 요청의 lookup/연결 목적지에 pin하고 TLS servername/인증 hostname은 원 provider hostname이다. 실제 peer address도 pin과 대조한다. 검산 후 기본 DNS 재조회/HTTP proxy/env proxy/fallback·redirect·새 origin·자동 retry0이다.
환경/임의 CA가 검증되었다는 선언을 받지 않는다. 새로운 custom CA/SPKI pin을 도입하려면 별도 exact profile 결정이다. default 실제 request driver는 미등록이며 source 시험은 명시 request/DNS/TLS 대역만 사용한다.

## 8. 목적별 키·표준 Web Push 사용

세 기능을 분리한다.
1. 구독 보호 봉인/해제: PUSH_SUBSCRIPTION_SEAL 전용 서버 보호키/유한 nonce 사용.
2. Web Push 메시지 암호화: RFC8291의 aes128gcm·해당 표준의 구독키/auth 사용. at-rest AES256 envelope와 같은 wire가 아니다.
3. application server 식별: RFC8292 VAPID 전용 P256/ES256·공개 applicationServerKey와 일치하는 private key의 보호 sign.
기존 등록/native HostProof P256 또는 backup portable key를 목적만 바꾸어 쓰지 않는다. private key/raw secret을 일반 API·브라우저·로그에 반환하는 resolver는 금지한다.

키 resolver 후보는 typed sign/encrypt/seal/use 메서드와 exact job/ref/purpose/원예산만 받는다. caller arbitrary bytes/purpose를 signing oracle로 열지 않는다. VAPID aud는 검산한 provider origin, exp는 요청10초·해당 profile/key/구독/세션 원기한을 넘지 않는 짧은 창으로 생성하며 실제 표준 상한도 검산한다. subject/contact는 운영 고정 profile이고 user 입력을 넣지 않는다.
key rotation은 새 generation/ref와 공개 profile을 만들고 기존 subscription의 applicationServerKey 결박을 유지한다. 옛 구독을 새키로 조용히 전환하지 않는다. key 회수/유실/서명 불가는 새송신 중단·이력 보존이며 provider가 이미 접수한 알림을 회수했다고 하지 않는다. 필요시 사용자가 새 profile로 명시 구독교체한다.
키 생성/등록·저장 위치/서비스/backup·회수 운영은 현재 없으며 새 결정/실행 선행이다. candidate profile/key 문자열이나 fake source 성공을 실제 키 보유/암호 지원으로 세지 않는다.

공식 근거(2026-11-02 공개 문서 읽기, 실제 브라우저/서버 실행 아님):
- [RFC8291](https://www.rfc-editor.org/rfc/rfc8291): Web Push 메시지 암호화 형식 근거.
- [RFC8292](https://www.rfc-editor.org/rfc/rfc8292): VAPID application-server 식별과 구독 결박 근거.
- [W3C Push API 2026-10-05 Working Draft](https://www.w3.org/TR/2026/WD-push-api-20261005/): 구독/사용자 권한·service worker API 범위 참고. 확정 Recommendation 또는 모든 브라우저 실지원 근거라고 부르지 않는다.
표준 API/문서가 본 후보의 키 보관·목적 권한·provider 선택·수치를 승인하는 것은 아니다. crypto 라이브러리/버전·표준 벡터/상호운용 codec은 후속 WI에서 고정하며 직접 암호 알고리즘을 발명하지 않는다.

## 9. 지속 reservation·단발 전달·UNKNOWN·재시작

첫 소스 사건은 기존 ProjectNotifications reader의 원 source request/command/ref/hash·recipient를 전부 검산한 APPROVAL_REQUESTED다. source notification 저장 Tx에 push를 끼워 원요청을 지연/rollback시키지 않는다. 후속 명시/한정 dispatcher가 보관 원행을 읽고 activationWatermark 이후·현재 미결 조치가 있는 경우만 선택한다. source user/client를 caller 입력으로 받지 않는다.

송신 전:
- 현재 preference owner/client·원 credentialGeneration/authSessionId의 활성/기한, 프로젝트 현재 OWNER/read 접근·현재 정책·source 승인 요청의 유효/미결/대상·exact preference/ref/profile/key/secret을 다시 검사한다.
- 초기 권장안은 등록 때의 활성 Anvil 세션에 결박한다. 세션 만료/로그아웃 뒤 새송신0이다. 앱이 비활성이어도 유효세션 창에서는 시도할 수 있으나 장기 로그아웃 후 전달은 약속하지 않는다. 장기 background delivery authority는 후속 별도 정책이며 HUMAN token을 worker가 위장하지 않는다.
- server private deliveryPermit={projectId,notificationRef,preferenceRef,inputRef,providerProfileRef,applicationKeyProfileRef,recipient/client identity refs,deadline,fence}를 실제 DB 현재 검사 후 모듈 private ticket으로 발급한다. public JSON/bool/과거 receipt로 재생성0이다.

원장:
delivery unique=(sourceNotificationRef,recipientUserId,clientId,channel:PUSH,preferenceRef), 프로젝트 sequence 연속·attemptId/fence는 server 발급.
RESERVED는 보호 원문 해제/암호화 전 원 source/ref·현재 preference·카운터/원예산·입력/current proof와 함께 독립 Tx COMMIT 확인한다.
한 delivery의 ATTEMPTED(fence 소비)도 별도 지속 COMMIT 확인 뒤 driver를 최대1회 호출한다. COMMIT 불명 시 driver0·UNKNOWN 보존이며 재조회로 새 시도0이다. source/current는 해제·DNS·서명·암호화 await 뒤와 마지막 전송 직전에 다시 검사한다.
ATTEMPTED 표식은 네트워크 도달의 증거가 아니다. attemptCount=0/1은 지속 시도권 소비 횟수로 정의하며 raw socket 호출/수신 횟수로 표시하지 않는다. 송신 사실은 networkState=NOT_STARTED|STARTED|UNVERIFIED와 별도 기록한다. crash/정착 불명은 UNVERIFIED이다.
FIRST reservation/attempt를 동시 worker가 중복 소비할 수 없고, 프로세스 재시작의 CLAIMED/ATTEMPTED는 UNKNOWN·자동 재송신0으로 닫는다. 원행/sequence/최종 proof가 누락되면 성공/빈 목록0이다.

상태:
RESERVED → ATTEMPTED → PROVIDER_ACCEPTED 또는 REJECTED/UNKNOWN.
송신 시작 전 명확 취소/기한/권한상실/한도는 NOT_SENT, 전송 후 응답유실/timeout/기록 실패/정착 불명은 UNKNOWN. 실행 도중 current 취소를 받으면 후속 전송·효과 채택을 중단하되 이미 전달된 메시지의 회수를 주장하지 않는다.
검산한 provider2xx만 PROVIDER_ACCEPTED·‘공급자 접수·수신 미확인’, 404/410은 해당 구독 버전만 REVOKED로 기록한다. 429/5xx/redirect·다른 상태는 고정 이유와 재전송0, raw 응답본문0이다. 요청/응답 stream을 원10초/키·profile·세션/정책의 최소 기한과16KiB 응답 cap으로 제한한다.
driver가 전송 뒤 오류를 숨기거나 응답을 못 받으면 실패 미송신으로 되돌리지 않는다. 늦은 error listener/소유 socket/미정착 crypto·IO는 정착까지 관측하고 timer/active 회수와 구분한다. 다른 프로세스를 열거/kill/자동 정리하지 않는다.

## 10. 유한 cap·취소·감소 경계

기존 IN_APP10000행은 그대로이며 새 push 누적과 합산해 원승인 저장을 막지 않는다. 새 누적 cap 후보:
- project 보호입력 최대10000개/암호문+canonical metadata 합64MiB, prepared 동시1/client·수명120초.
- project preference/head/version/stop proof·delivery/event/candidate·nonce metadata 합10000행/64MiB. expired/revoked/not_sent/unknown/이전버전 포함, replay/GET 추가0, 자동삭제/상향0.
- nonce 사용의 전체 실제 key-domain cap은 project cap과 별도이며 alias/설치/rotation으로 초기화하지 않는다. 실제 키 관리자 원장이 미정이면 봉인/발송0.
- 기기당 활성 preference1, 프로젝트 동시 전송1·분당10·UTC일100 예약/시도권. window 만료 카운터/과거 예약도 원이력은 보존한다. RESERVED/UNKNOWN을 재시작으로0 취급하지 않는다.
- rate cap 도달은 원알림은 유지하고 새 전달 NOT_SENT/LIMIT_REACHED; 보류 무한queue나 나중 자동 보충 전송0이다. provider TTL은300초 이하/원 최소기한과 연동한다. 실제 provider 전달/표시 시각을 이 수치로 보장하지 않는다.
수치들은 신규 후보 정책이다. cap 계산은 정수/SQL exact aggregate·project 잠금·최종행/교체head bytes 대수·같은Tx로 검사하고 후속 모든 writer·stop/event/nonce 경로도 보호한다. missing/불명0 처리0. 물리DB/WAL·전역 disk 무제한 안전을 주장하지 않는다.

취소/정지 권장 후보:
신규 POST /api/v1/projects/:projectId/push-preferences/:id/stop
body={preferenceRef,expectedStopGeneration}; 현재 로그인한 본인/current client·같은project·원 preference 소유·CSRF/Origin을 검사한다. 제어/명시 write정책 상실·알림 cap 포화를 정지의 선행으로 요구하지 않는 감소 전용 신규 권한 delta다. 다른 사용자/client/version을 막지 않는다.
서버가 지속 STOPPED fence를 먼저 원자 적용하고 generation을 올린다. 전송자는 매 await/송신직전 이 fence를 재검산한다. 감사/표시 기록 실패는 정지를 rollback하지 않으며 stopFact와 auditState=RECORDED|UNKNOWN을 분리한다. DB stop 저장 자체가 불명이면 응답은 UNKNOWN·원request 재조회이며 ‘중지됨’ 성공을 만들지 않는다.
활성화 때 exact stop/fence 행·최대1회 감소 event 공간을 미리 cap에 예약한다. enable 거절/롤백 뒤에도 이 예약이 가짜로 사라지지 않도록 forward 완결을 검산한다. stop 반복은 새 event0이다. 이 제한 감소 공간을 전체 cap 밖 무한 원장으로 만들지 않는다.
구독 교체는 old active를 먼저 사용불가로 만들고 새 exact generation을 채택하는 동일Tx CAS다. 전송중 old permit은 취소/UNKNOWN 원이력을 보존한다.
서버 stop 뒤 브라우저 unsubscribe는 별도 명시 로컬 단계다. unsubscribe 실패가 서버 STOPPED를 되돌리지 않고, 로컬 unsubscribe만으로 서버 stop 성공을 표시하지 않는다. 사용자 브라우저 설정의 실제 권한을 코드가 자동 변경하지 않는다.
감소 endpoint를 채택하지 않는 대안은 기존 registerPushPreference(false)의 현재 control/AUTO 조건을 유지하되 권한상실 시 즉시 서버정지가 불가한 한계를 명시하는 것이다. §14에서 사용자가 선택할 정책으로 분리한다.

## 11. 보호 전달 이력·클릭·사용자 화면

신규 GET /api/v1/projects/:projectId/push-deliveries?limit=1..50&cursor
및 /push-deliveries/:id
현재 본인/client·OWNER/read 정책, 다른고정항목404. cursor는 actor/client/project·정렬/snapshot·filter에 결박,30분/4096자, 입력 extra0.
DeliveryView exact={ref,sourceNotificationRef,preferenceRef,state,reasonCode,reservedAt,attemptedAt,settledAt,attemptCount,networkState}.
시각은 실제 서버 원행의 ISO 또는 null, count0/1은 §9의 시도권 소비이며 네트워크/수신 수가 아니다. ref는 원 immutable delivery/event projection fullref이고, current 표시를 원 hash로 재봉인하지 않는다.
reasonCode는 SOURCE_ACTION_STALE/PREFERENCE_STOPPED/PREFERENCE_CHANGED/ACCESS_LOST/SESSION_EXPIRED/KEY_UNAVAILABLE/PROVIDER_UNCONFIGURED/TARGET_REJECTED/LIMIT_REACHED/DEADLINE/PROVIDER_REJECTED/PROVIDER_ACCEPTED/OUTCOME_UNKNOWN/INTEGRITY_FAILED로 닫는다.
Page={items,hasMore,nextCursor,observedAt}. list50*2048B+4096B·fixed8192B·preference/current16384B·profile2MiB 상한을 stream/파서와 DTO builder에서 검사한다. endpoint/path/query·키/auth/봉인원문/원응답·user reason/stack0. 이력 조회는 예약·송신·IN_APP 읽음 생성0이다.

Web Push application payload는 canonical {projectId,notificationId} 두 UUID와 고정 일반 문구를 표시하기 위한 formatVersion:1만 포함한다. 프로젝트명/사용자정보·원승인본문/승인 token/임의URL0이다. 암호화 message body 전체4096B 이하를 codec이 실측한다. fixed 문구는 ‘Anvil에서 확인할 요청이 있습니다’이며 provider 접수와 표시 사실을 구분한다.
worker는 push/notificationclick만 처리하고 fetch 가로채기·cache/offline 기능·읽음/승인/제어 POST0이다. 지원하지 않는 payload·비정규 UUID는 표시/이동0이며 rawdata를 URL로 열지 않는다.
클릭 hint는 같은origin의 #/projects/<projectId>/settings/notifications/<notificationId>로 고정하는 신규 route 후보다. 로그인 복귀 후 원 project/notification ID를 보존하고 기존 보호 GET /api/v1/projects/:projectId/notifications/:notificationId로 본인·귀속·원source/hash를 다시 검산한다. 그 응답의 authenticatedTarget만 기존 ApprovalRequestLinks로 연다. 일반 notificationId 역조회API/직접승인ID route를 push에서 만들지 않는다.
현재 routes.ts와 Panel은 이 route/hint 소비가 없으므로 실제 App 로그인/선택/fixedread 연결을 새 source 작업에 포함한다. hint 자체가 권한·원문·현재 명령이 아니며 401/404/로그인계정교체·현재권한상실/원본불일치는 상세를 숨긴다. 원 approval buffer/pending은 변경하지 않는다.

UI14 기존 본인알림 영역 옆 접힌 ‘이 기기 브라우저 푸시’:
지원 조회→명시 권한/worker/구독→보호입력 준비→원선호 명시저장→receipt/fixed current→본인 시도 목록/선택 상세→원알림→UI08/모바일의 같은 원요청.
설정상태는 미설정/준비중/원문준비확인/저장됨·전달미검증/중지/만료/권한상실/UNKNOWN으로 구분한다. ‘전달 성공’ 버튼/표시를 provider2xx만으로 만들지 않는다.
준비 전 부모ACK는 원 commandId·previousRef·reason·profile 선택의 불변 의도에 결박한다. inputRef 수신/검산 후 최종 PROJECT payload/body를 새로 완성하고 별도 부모ACK를 확인한 뒤에만 POST한다. 이미 전송한 최종 body의 재작성은 금지한다. inputRef는 commandId·불변 의도/hash에 결박되며 같은 ID의 reason/profile/input 교체를 거절한다. 입력준비/저장/후속GET 각 실패를 분리하고 UNKNOWN을 지워 새등록을 자동 만들지 않는다. 닫기·문맥 ABA·늦은 응답/401·현재 작업 latch 회복·실제App부모 연계를 직접 검수한다. 실제 Notification 권한창/기기수신은 source 메모리 시험과 별도다.

## 12. 저장 원형·원자 완결·RLS/ACL·재시작

새 논리 표 후보는 subscription_input_metadata/sealed_payload, push_preferences/head+versions, preference_stop/fence, push_deliveries/head+events, send_window_counters, secret_key_nonce/use_ledger다. 실제 forward 번호/정확 표명은 채택 후 목록과 WI에서 고정한다. 기존0052 IN_APP표/producer·기존 승인 요청/정책/읽음 원형을 바꾸지 않는다.

보호 metadata projection exact 제안:
{schemaVersion:1,namespace:PUSH_SUBSCRIPTION_INPUT_V1,id,projectId,ownerUserId,clientId,commandId,intentHash,subscriptionHash,previousRef,providerProfileRef,applicationKeyProfileRef,keyGeneration,nonceReceiptRef,sealedRef,createdAt,expiresAt,state,consumedBy}.
state=PREPARED|CONSUMED|EXPIRED|UNKNOWN, consumedBy는 null 또는 실제 원 common command/authorizationReceipt fullref다. ref contentHash는 이 불변 준비 projection에서 state/consumedBy를 제외한 원자료로 계산하고 소비/만료는 별도 event로 보존한다. public metadataHash가 필요하면 원원문hash와 별도 명시한다.
intentHash는 §5의 private subscriptionInput을 제외한 고정 의도+subscriptionHash의 canonical hash다. 원문 해제 시 AAD/원 commandID·owner/client/project·정확 secret hash와 다시 대조한다.

delivery 최초 snapshot exact:
{schemaVersion:1,namespace:PUSH_DELIVERY_V1,id,projectId,sourceNotificationRef,preferenceRef,inputRef,recipientUserId,clientId,sourceSessionRef,sourcePolicyRef,providerProfileRef,applicationKeyProfileRef,createdAt,deadlineAt,fence}.
후속 event exact={deliveryRef,sequence,previousEventRef,state,reasonCode,at,networkState,attemptCount,proofRef}. actual provider 응답의 비밀 없는 status/시각·원 driver 시도 식별자가 proofRef에 결박돼야 하며 일반 caller 선언만으로 PROVIDER_ACCEPTED를 만들지 않는다. body/헤더 원문은 proof에 넣지 않는다.
head는 최종 event/count/fence·bytes를 검산한 CAS만 허용한다. 불변 event UPDATE/DELETE0, source/ref/원 preference/소유·namespace 복합FK와 양방향 지연완결/reverse guard를 두어 half row/소비누락/뒤늦은 원source 변조를 거절한다.

키 nonce 예약 저장은 보호 key manager만, 그 외 metadata+공통 receipt/audit·정확 input 소비·선호 버전은 같은 최종 Tx다. reservation/ATTEMPTED는 외부송신 전 독립 확인이며 최종 result 저장과 네트워크의 원자성은 주장하지 않는다.
ciphertext DB 저장을 초기 후보로 택해 임의 파일 경로/파일 publish의 추가 실패창을 만들지 않는다. at-rest key는 DB와 같은 평문 row에 두지 않는다. 새 외부 secret 파일/vault 채택이 필요하면 source profile과 실제 실행 결정을 따로 받는다.
FORCE RLS·현재 authenticated identity/프로젝트·read/write 정책·소유·내부 fence를 검사한 최소 접점, definer 고정search_path/PUBLIC실행회수·목적별최소ACL을 고정한다. raw app DML/임의actor/purpose GUC나 internal:true 인자로 우회하지 않는다. 실PG/role/RLS/경합은NOT_RUN이다.

재시작:
- PREPARED는 원기한/동일command 조회만 가능하며 자동final저장0.
- preference 과거 enabled=true는 session/policy/profile/stop/key current 검사 전 READY0.
- RESERVED는 원기한·원fence를 검산해도 자동송신하지 않는다. 작업자가 이미 시작됐는지 확인할 수 없는 claim은 UNKNOWN으로 보존한다. 초기 source 구현은 재시작 delivery 자동재개를 지원하지 않는다.
- ATTEMPTED/정착미확인은 UNKNOWN·driver재호출0. late ACK가 실제 저장되면 관측 이력으로만 추가할 수 있고 새송신0이다.
- key/봉인원문/nonce원장 유실은 UNAVAILABLE/INTEGRITY_FAILED, metadata만으로 원문/키/사용량을 복구했다고 하지 않는다. 기존 protected rows/원IN_APP를 자동삭제0이다.

## 13. 전체 FN17 중요사건과 실제 선행·미완료

아래는 계획 기능을 빠뜨리지 않기 위한 producer 지도다. 첫 승인 push를 끝내도 이 표의 잔여는 남는다. 다른 사건을 기존 ApprovalNotification의 kind만 바꾸어 저장하거나 기존0052 enum을 조용히 넓히지 않는다.

| 필수 사용자 조치 사건 | 실제 현재 근거·제품 경로 | 부족한 producer/계약·다음 내부 업무 |
|---|---|---|
| 승인 요청 | approval-notification-producer.ts가 원 request/receipt/capture와 같은Tx의 APPROVAL_REQUESTED/IN_APP를 생산. ProjectNotifications가 원request/hash를 재검산 | 첫 A는 이 원행을 재사용. 신규 backfill/승인 재생산0 |
| 입력 요구 | apps/server/modules/scheduling/next-actions.ts와 stage-queue.ts에 다음행동/대기 이유가 있음 | 실행 중 실제 입력요구의 고정 source event/ref·수신자·한 번 전이·현재 취소/기한이 아직 notification producer로 연결되지 않음. 일반 WAITING/승인대기를 모두 새알림으로 만들지 않음 |
| 중요 오류/거부 | apps/server/modules/results/execution-issues.ts, stored-issue-basis.ts의 분류·보관근거가 있음 | 현재 저장 합성 claim 분류는 실제 중요장애 producer가 아님. 원관측 assurance/정식분류·중요성/동일원인group·대상·수신자/중복 기준을 source로 확정해야 함 |
| 안전/기록 공백 | 관측 ACK/gap·stored-issue-basis.ts가 실제 저장된 합성 gap을 제공 | gap의 최초생성/확대/해소 revision·현재 실제 관측원·수신자·알림반복 억제·원대상 GET 정확계약 필요. gap을 원인확정/실제 안전회수 사실로 바꾸지 않음 |
| 자동 한도 도달 | scheduling/stage-queue.ts와 관련 한도/사용량·예약 source에 차단 사유가 있음 | 정책ref·사용량/예약 원행·도달사건 version·수신자·재시작중복/해소 기준이 notification producer에 연결되지 않음. 공급자과금실측과 합성한도 분리 필요 |
| 프로젝트 최종 완료 후보 | apps/server/modules/results/project-result-reviews.ts는 저장된 개별 결과 검토를 제공 | 프로젝트 전체완료/사용자인수 producer가 아님. 확정 계획 전체·필수검수·미완료0·후속승인/Agent종결과 구분한 최종완료후보 source와 수신자/재개정/중복키가 필요. 한 result PASS를 PROJECT_COMPLETED로 자동변환0 |

Main은 기존 설계/카드·현재 source를 읽어 각 사건의 실제 authoritative producer·필드/수신자/중복/원자 저장을 상세화한다. 이 사실조사·목록책임을 사용자에게 넘기지 않는다. 새 event public union·저장/읽기 확장·수신자 정책처럼 의미를 바꾸는 부분만 정확 후보로 결정받는다.
제안 후속은 별도 NotificationV2/typed event namespace로 설계해 기존 승인9필드/ref/hash를 보존하는 것이다. 최초 A에는 새 중요한 사건을 fake fixture로 만들어 넣지 않고 모든 UI/결과에 ‘승인요청 push만 지원·다른 중요사건 미연결’을 명시한다.
전체 FN17 완료 조건은 지원 사건의 원생산→목록/보호 상세→설정/선호→한 번 전달/불명조회→동일 조치 화면과 미지원 대체경로까지다. actual provider/기기수신/사용자인수는 별도 필수다.

## 14. 결정·대안과 source 구현 준비도

| 선택 | 권장 후보 A | 대안/영향 | 상태 |
|---|---|---|---|
| 원문 수용/공개표면 | 보호입력 준비→metadata-only registerPushPreference·현재/fixed/by-command 조회 | r2 raw subscriptionInput을 일반 command로 보내는 방식은 공통저장/승인 원문유출 경계가 커 배제 | 새 endpoint/원형/정책 delta·미채택 |
| 봉인/키 목적 | DB ciphertext·전용 sealing key·지속nonce·typed use-without-return | 기존backup/native 키 재사용은 목적확대라 배제. 별도 vault adapter는 보호저장/운영의 실제선택 필요 | exact key-profile/생산자·회전/nonce 원장/현재성 WI 필요 |
| provider/VAPID | 고정 승인 origin/path·DNS/peer pin·표준WebPush/VAPID·목적키 분리 | 임의HTTPS/CA/provider fallback은 불허. 공급자 선택은 Main 공식자료/배포조건 조사 후 정확profile로 제시 | 현재 미선정·실키/송신0 |
| 지속전달/한도 | 외부송신 전 지속예약/ATTEMPTED·한 번 driver·UNKNOWN 보존·별도누적cap | 자동재송신/무한보충queue/IN_APP한도합산은 배제 | 신규자료/수치/포화·감소공간 정책 미채택 |
| 사용자 정지 | 본인/current client의 감소전용stop·선예약 공간·감사실패와정지분리 | 일반control/AUTO필요 disable만 유지하면 권한상실시 즉시서버정지불가 | 감소전용권한은 정확새결정, 일반쓰기권한확대0 |
| 세션 수명 | 초기 preference는 원활성Anvil세션 창 이내, 만료/로그아웃뒤 새송신0 | 장기 background authority는 유용하나 새수신/회수·동의/권한수명 필요 | 한계를 숨기지 않고 이 후보의 선택으로 검토 |
| 전체사건 | 승인요청 첫A+§13 나머지producer를별도채택/연결 | 첫A만전체FN17완료로 선언하는 축소는 배제 | 후속사실상세는Main업무, 새사건/수신자계약은미채택 |

현재 r3는 r2보다 구체적인 검토안이지만 **완성 WI/제품 GO는 아니다.**
우선 Main이 추가로 고정할 기술자료: 실제 사용가능한 서버 보호key resolver·exact at-rest key profile/실키 nonce 사용량 도메인과 유한한도, 공급자공식endpoint/TLS/DNS지원·VAPID 공개키 배포, 기존 app/auth/정책/common command/예산에 맞는 정확 source 목록과 proof/DDL 접점, service worker scope/route/build 충돌 여부.
이는 기술·사실조사이며 사용자에게 ‘목록을 알아오라’고 요청하지 않는다. 그 결과에서 새 보호저장/키목적·공개API/수신자·취소권한/수명/상한처럼 의미가 달라지는 선택만 승인대상으로 정리한다.
source 채택 후 만들 것은 실제 원행검산/봉인state·current·선호/stop/원장·표준codec·HTTPdriver/목적지검산·실제App/worker 소비 source다. 비활성 parser/미사용 wrapper만 추가해 사용자기능진도로 세지 않는다. 실제 공급자 부재는 미구현·UNCONFIGURED로 남긴다.

## 15. 후속 구현 표면·직접 검수·제외

다음은 채택 후 exact WI에 묶을 후보 표면이며 현재 write allowlist가 아니다. 기존 단일writer를 유지하고 새 파일 존재/명칭·migration 순번은 실제 목록에서 고정한다.

- 신규 runtime push-contract/secret input/profile/delivery codec·server notifications의 input/store/key-use/provider/delivery/reservation/routes·forward pending SQL.
- 기존 project-command/approval dispatch의 registerPushPreference raw 차단과 새 metadata-only 분기, 접근/세션현재성·공통receipt/audit 최소연결. 기존 승인producer/notification DTO/list/mark의 정상/거절 기준 보존.
- 신규 Web PushPreferencePanel/push-api·고정service worker, 기존 App/ProjectNotificationsPanel/routes/로그인복귀의 정확notificationId 소비와 부모CAS. 기존지원4파일을재사용하되권한조회/설정/실전달분리.
- 신규 명시 fake key/nonce/DNS/TLS/driver/DB/브라우저port 시험. import/constructor/mount 효과0·기본실제request/키/FSfallback0.
- 실제 서버정책/SQL/권한·키생성/보호저장/브라우저구독·외부송신/실수신/서비스배포·Agent/실자료는 source 승인에 자동 포함0.

필수 source 반례:
1. 원IN_APP·10000 cap/원승인 rollback/replay 불변, push실패가 원요청 소급취소0.
2. secret raw가 공통command/candidate/audit/log/URL/에러/브라우저storage에 없음. namespace/project/owner/client/원command/hash/AAD·키generation변조 거절, final 인증전원문사용0.
3. 준비COMMIT·최종preference/소비·nonce예약 누락/중복/rollback/응답유실·재시작 UNKNOWN·같은command 새봉인0.
4. DNSrebinding/IPv6 private/mixed주소·wrongTLS·redirect/임의CA/proxy·endpoint교체·현재profile회수·key/stop/세션만료 뒤driver0.
5. 두 worker 동시 동일source/preference·ATTEMPTED COMMIT전driver0·COMMIT불명/late/크래시재시도0·provider2xx와사람수신분리.
6. cap-1/cap/cap+1·역사산입/교체head bytes·분/일 경계·clock후퇴/DBforward·nonce alias/import/실키도메인·포화stop 감소공간/타인stop0.
7. 실제App CAS·준비intent/finalbody 두ACK·원pending/UNKNOWN·receipt후GET실패·프로젝트/세션/CSRF/transportABA·닫기/옛401·현재명시회복.
8. 실제routeparser→로그인복귀→기존보호notificationGET→원ApprovalRequestLinks. 임의URL/notification존재누출·click POST0·serviceworker fetch가로채기0.
9. 표준 벡터/독립 예상bytes·암호화와at-rest/VAPID 목적분리·key provider미구성failclosed. 표준/fixture roundtrip만을실제지원/배포로표시0.
10. 한국어상태/오류·지원/permission·설정/예약/시도권/네트워크/접수/수신미확인·원알림읽음 구분.

정적/모델·메모리React/App/build/driver대역과 실제 PG/RLS/동시성·키보호/TLS/권한창/기기구독·provider접수/실수신·사용자인수는 결과에서 분리한다. 이미 완료한 IN_APP 전체시험을 반복하며진도를만들지 않고 직접영향범위만 선정한다.

## 16. 이력·현재 미수행·복구

- r1 SHA49EF0428BDEEF79DD97B718B888431642CE21810A3A811F4D0249F92A9DE8CFC: 최초 푸시후보·중요누락3.
- r2 SHACEDD2A34215931D4BC67BBF5246D45B658E2DC68D967D29ECEB685A8FC6580D2: AUTO/기존승인차단·정확클릭대상·전달이력보완. resolver/profile/원자저장은미정이었음.
- r3: 단일본문으로통합. 보호입력/metadata명령·목적키/봉인원자성·provider/DNS/한번시도원장·정지/한도·현재App/route공백·다른중요사건잔여를구체화. 여전히미채택/구현GO0.

이번 변경은 이 후보문서 한 개뿐이며 정본/source 동일bytes다. 기존제품/SQL/시험/Git/WORK_STATUS·정책부여·키/구독/외부송신/실자료조사0. 후보가보류돼도 기존IN_APP기능과원사건/승인/이력을보존한다. 문서 rollback은 Main이정상Git revert로수행할수있고실제자료/서비스복구는발생하지않았다.
