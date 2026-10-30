# FN17 브라우저 중요 푸시 — 한정 계약 후보 r2

2026-10-31 · Main 어울 · 기준 3b13222d / 제품 a020931d · DRAFT / NOT_ADOPTED

## 목적과 기존 범위
WORK_PLAN FN17/UI13·INTERFACES §14.2의 registerPushPreference와 중요 사건의 브라우저 전달을 구체화한다. 이미 구현된 IN_APP 승인 알림9필드·requestApproval 원자성·10000건 상한·목록/읽음/클릭 링크는 바꾸지 않는다. 브라우저 지원 조회를 실제 전달로 표시하지 않는다.
이번 문서는 결정·독립 검토 후보다. 채택 전 구현 GO가 아니다. 실제 DB·migration 적용·권한 부여·키 생성/조회·브라우저 권한/구독 등록·외부 push 송신·서비스/Agent 실행은 제외한다. source-only 채택 시 코드·화면·미적용 forward SQL·합성 검증까지이며 실전달 검수는 별도 실행안이다.

## 신규 결정이 필요한 차이
현재 notification-input은 APPROVAL_REQUESTED/IN_APP만 받으며 push 구독/선호 저장·전달 시도 저장·실공급자 연결은 없다. 아래 신규 명령 payload·보호 저장·GET·미적용 schema·외부 전송 대상/비밀·불명 결과 규칙은 기존 목록/읽음 계약으로 대체할 수 없다. 기존 계획의 푸시 기능 자체를 다시 승인받는 것이 아니라 이 미정 상세 계약을 채택받는다.

## 권장 첫 연결 A
1. 첫 대상 사건은 이미 원자 저장된 본인 APPROVAL_REQUESTED/IN_APP 원행이다. 새 일반 진도/성공 사건·원승인 재생산·backfill은 없다. 푸시 실패/상한이 원승인 요청 또는 IN_APP 저장 성공을 소급 취소하지 않는다.
2. 현재 로그인·활성 OWNER 회원·현재 client·프로젝트 단독 제어·명시 registerPushPreference 정책·CSRF·정확 버전을 검사한다. 이 기준은 최초 쓰기 범위를 좁힌다. 이후 수신 때는 원수신자의 현재 활성 접근·선호·기기와 원승인 요청의 아직 필요한 조치 여부를 다시 검사한다. 수신이 제어권을 취득하지 않는다.
3. 브라우저는 사용자가 누른 별도 ‘이 기기 푸시 사용’에서만 권한 요청·service worker 등록·구독을 시도한다. permission 거절/미지원은 서버 저장 없이 앱 내 조회를 유지한다. permission을 Anvil이 자동 허용하지 않는다. service worker는 push/notificationclick만 다루고 fetch 가로채기·오프라인 cache를 하지 않는다.
4. 명령은 기존 PROJECT 외피 operation=registerPushPreference, payload={previousRef,enabled,subscriptionInput,reason}. 최초 previousRef=null/targetId=null/expectedVersion0, 개정은 같은 본인/client/project의 현재 정확 ref다. enabled=true이면 subscriptionInput={endpoint,expirationTime,p256dh,auth}, false이면 null이다. recipient/user/client는 입력받지 않고 인증에서 만든다. 별도 불변 버전/감사·명령 replay로 저장하며 같은 commandId에 다른 구독을 다시 붙이지 않는다.
5. endpoint는 최대4096자의 HTTPS·userinfo/fragment 없는 URL, 키는 엄격 base64url과 표준 길이/공개키 곡선 형식, expirationTime은 null 또는 유효한 미래 ms 정수로 제한한다. 구독 원문은 일반 audit/명령 hash 원문/영수증/GET/로그에 복사하지 않는다. 보호 저장 참조·원문 SHA256·사용자/client/project 귀속만 일반 metadata에 둔다. 평문 DB 저장·평문 키 반환은 금지한다.
6. 보호 저장은 목적이 고정된 서버 내부 resolver만 사용한다. endpoint/키 구독 원문은 서버가 봉인한 불변 값으로 보관하고, VAPID private key는 별도 운영 설정의 보호 ref에서만 소비한다. 해독/봉인/키 resolver가 미구성·미검증이면 저장/전달을 412로 막는다. 보호 ref 목적·공급자 어댑터 상세와 사용자 보유 키의 실제 생성/등록은 별도 채택·실행 선행이며 이번 후보가 이를 몰래 추가하지 않는다.
7. GET /api/v1/projects/:projectId/push-preferences/current 와 /push-preferences/:id/versions/:version 은 현재 본인/client만 허가한다. 출력은 ref,enabled,state(READY/UNVERIFIED/REVOKED/EXPIRED),protectedSubscriptionRef,endpointOrigin,expiresAt,updatedAt,reasonCode다. endpoint 경로/구독키·사용자 원문 reason·다른 기기 목록을 노출하지 않는다. READY는 필요한 구성의 검사가 끝났다는 뜻이며 전달/사용자 수신 완료가 아니다.

## 전달 경계와 한도
- 실제 제공자 endpoint는 단순 임의 HTTPS로 송신하지 않는다. 승인된 공급자 profile의 정확 origin/포트·정적 또는 검증된 공개 DNS 목적지·연결 당시 주소를 결박하고 private/loopback/linklocal/metadata IP·DNS 재결박·redirect는 거절한다. profile이 없으면 UNSUPPORTED/UNVERIFIED이며 무조건 허용하지 않는다. 공급자 선택·실외부전송은 별도 실행 결정이다.
- payload는 고정 일반 문구 ‘Anvil에서 확인할 요청이 있습니다’와 비밀 없는 논리 알림 식별자만 포함한다. 프로젝트명·원승인 본문·사용자정보·승인 token·자동승인 URL은 넣지 않는다. click은 같은 origin의 기존 인증된 승인 상세로만 이동하며 로그인/권한/현재성을 다시 확인한다. service worker가 승인/읽음/제어인수 POST를 보내지 않는다.
- 원사건/수신자/client/채널/구독 버전으로 중복을 막고 전달 전 durable reservation을 만든다. 최초 명시 유효화 이후 사건만 선택한다. 프로젝트별 동시 송신1·분당10·일100·기기구독1·호출기한10초·payload4KiB 상한을 후보 기본값으로 둔다. 초과는 보류 상태와 이유를 보관하고 원승인 저장을 막지 않는다. 자동 보충 송신·무제한 재시도/삭제는 없다.
- 상태는 RESERVED→ATTEMPTED→PROVIDER_ACCEPTED 또는 REJECTED/UNKNOWN이다. PROVIDER_ACCEPTED는 수신/표시/읽음이 아니다. 송신 전 중단은 NOT_SENT, 전송 후 응답유실/기한초과/기록 실패는 UNKNOWN이며 0회/실패 미발송으로 되돌리거나 자동 재송신하지 않는다. 원 명령/시도는 재조회한다. 재전달은 이후 별도 상세 계약 전 미지원이다.
- 404/410은 해당 구독 버전 REVOKED로 기록하고 다른 기기/구독에 영향을 주지 않는다. 사용자 비활성화·프로젝트 접근 회수·기한 만료는 후속 송신을 차단한다. 이미 송신한 알림을 회수했다고 주장하지 않는다. 이력/원문 보호 자료를 자동 삭제하지 않는다.

## source-only 구현의 실제 결과·검수
- 사용자 흐름: 지원 조회→명시 사용/거절 안내→선호 저장 상태/고정 버전 재조회→본인 알림 상세 연결→명시 중지. 실실행 전에는 설정/실전달 미검증을 계속 표시한다.
- 닫힌 입력·소유/세대/CSRF·정확 버전/명령 replay·기한·보호 원문 노출0, 공급자 미구성/실행0, SSRF/redirect/DNS변경 거절을 반례로 확인한다.
- 동일 원사건 이중 예약·송신 후 기록/응답유실 UNKNOWN/자동재시도0·구독 교체/회수/접근상실·provider ACCEPTED와수신 구분을 합성 검증한다. 기존 승인알림9필드/10000상한·원요청 원자성·모바일 승인 상세를 직접 영향 범위만 회귀한다.
- 미적용 SQL은 과거 SQL을 수정하지 않고 별도 forward 후보로 보존한다. 실제 PG/RLS·동시성/실기기/권한창·키/암호화 공급자·실push·VPN/원격·서비스는 NOT_RUN이다. source-only 검수로 FN17/UI13 전체 완료를 선언하지 않는다.

## 선택과 남은 선행
권장 A는 위 첫 APPROVAL_REQUESTED 푸시 source 계약을 한정 채택하고, 보호 봉인/키 목적·공급자 profile의 정확 상세 계약을 다음 고정 선행으로 둔다. 미정 resolver를 임의 구현/외부송신·가짜 READY로 채우지 않는다. B는 앱 내 알림만 유지하고 푸시 상세화를 보류한다. 보호 공급자 미정 때문에 이 r1 자체를 완성 구현지시서로 사용하지 않는다. 채택 여부·정확 선행을 확인한 후에만 허용 파일과 구체 WI를 확정한다.
## r2 — 독립 Important 3건 보완
원 r1 SHA256 49EF0428BDEEF79DD97B718B888431642CE21810A3A811F4D0249F92A9DE8CFC의 C0/I3는 채택 전 계약 누락이다. 아래가 앞선 간략 문구를 구체화하며 미채택·미구현은 그대로다.

### 정책·승인과 replay
- 최초 연결은 기존 명시 AUTO/null approvalRef만 허용한다. DENY는403, REQUIRE_APPROVAL 또는 non-null approvalRef는 일반 inspectPending/capture/승인 후보 저장 전에412로 닫는다. raw 구독을 기존 범용 승인 후보에 넣는 경로를 만들지 않는다. 이후 일회승인 연결은 별도 계약 전 미지원이다.
- 현재 로그인/CSRF·프로젝트 활성 OWNER·현재 client·단독 제어/세대·현재 명시 정책·유한 session/정책 기한을 재확인한 뒤 같은 최종 명령의 receipt를 반환한다. replay는 구독을 다시 등록/교체하거나 송신하지 않는다. 원receipt와 현재 선호 사용 가능 여부는 구분하며 옛 receipt로 현재 REVOKED/권한상실을 덮지 않는다. 권한 검사를 replay로 건너뛰지 않는다.
- 공통 명령/감사 저장은 기존 payloadHash·비밀 없는 metadata만 사용한다. raw 구독을 공용 payload 컬럼에 복제하는 새 schema는 금지한다. 봉인 원문/보호 참조 생성·transaction의 원자성/실패 보존은 정확 resolver 계약이 채택된 뒤 WI에 고정한다. 미구성 상태는 저장 불가이지 가짜 성공이 아니다.

### 클릭 후 정확 원대상 조회
- 암호화 push의 식별자는 {projectId,notificationId} 두 UUID로 고정한다. 프로젝트명/승인ID·본문/권한 token은 넣지 않는다. 두 ID는 접근 권한이 아니다.
- 클릭은 같은 origin의 기존 프로젝트 알림 화면으로 projectId/notificationId 선택 힌트만 전달한다. 해당 화면은 로그인 후 기존 보호 GET /api/v1/projects/:projectId/notifications/:notificationId를 다시 호출한다. 서버가 본인/프로젝트 귀속을 확인한 응답의 authenticatedTarget을 기존 ApprovalRequestLinks로만 연다. 미로그인/404/접근상실/원본불일치면 상세를 열지 않고 현재 오류를 표시한다. 알림ID 전역 역조회 endpoint를 새로 만들지 않는다.
- service worker는 선택 힌트 경로의 고정 origin/UUID만 구성하고 요청 데이터에 든 URL을 그대로 열지 않는다. 앱의 기존 route parser/로그인 복귀 소비선이 실제로 없는 경우 해당 내부 화면 연결을 먼저 구현·검수하며, 존재한다고 추정하지 않는다. 이 클릭은 read/approve/제어인수 POST가 아니다.

### 보호된 전달 시도 재조회
- 새 GET /api/v1/projects/:projectId/push-deliveries?limit=1..50&cursor=... 및 /push-deliveries/:id 를 정의한다. 현재 로그인·활성 OWNER의 본인/current client만 허가하며 임의 user/client 필터는 없다. cursor는 이 범위·정렬/고정 snapshot·필터에 결박하고 다른 프로젝트·사용자·기기로 재사용하면 거절한다. 타인/다른 client의 고정항목은404로 닫는다.
- DTO는 {ref,sourceNotificationRef,preferenceRef,state,reasonCode,reservedAt,attemptedAt,settledAt,attemptCount}만 허용한다. ref는 불변 시도 ID·버전·내용hash, 세 시각은 실제 존재하는 서버 시각 또는 null이며 attemptCount는실제예약/송신사실에따른0또는1이다. UNKNOWN은 송신 시도 후 반환이 없거나 기록 결과가 불명인 경우이며 count0으로 소급하지 않는다. delivery와 원IN_APP의 deliveryState를 별개로 둔다.
- endpoint/key/protected 원문·원응답본문·사용자 원문 reason·stack은 노출하지 않는다. PROVIDER_ACCEPTED는 ‘공급자 접수·수신 미확인’, UNKNOWN은 ‘전달 결과 불명·자동 재송신 안 함’으로 표시한다. GET/list/replay가 새 예약/송신을 하지 않는다. 설정 화면에 본인 전달 이력·고정 재조회와 기존 앱 내 원알림 링크를 연결한다.
- 최신 metadata만으로 응답유실 시도를 NOT_SENT로 지우지 않는다. durable reservation/attempt 전후 원자 상태·현재 활성 구독 확인/최단기한·실제 한 번 송신 결박은 구현 WI에서 실제 저장 구조와 함께 독립 검수한다. 종료 불명·예약 후 crash는 UNKNOWN/보존이며 새시도/자동회수로 재전송하지 않는다.