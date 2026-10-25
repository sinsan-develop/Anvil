# FN15 인수 요청·조회·미확인 요약 내부 구현 지시

- 상태: SOURCE_ONLY_IMPLEMENTATION_ALLOWED / 실제 연결 NOT_CONNECTED.
- 근거: 승인 WORK_PLAN FN15·FUNCTION_WORK FN15·INTERFACES §13.6, 제안 `FN15_CONTROL_HANDOFF_CONTRACT_PROPOSAL.md` SHA256 `8EA266474A50F64B6618AD1318CAD5290C5F7EF096C71B340CABD254D2030F4D`.
- 2026-10-25 PMO 위임 판단: 기존 적격 참여자의 요청 의미를 유지하는 SELF 요청 보관·유한 조회·불변 WAITING/UNVERIFIED 요약의 내부 parser/validator/store/verifier port·미적용 SQL·합성 검증은 진행 가능. 제안 A 전체의 공개 API·실행 채택이 아니다.
- 담당: Main 어울 관리·검수·통합, 각 단위 한 명의 구현 subagent. 기준 branch `codex/av3-stage-b`, 시작 checkpoint `56615128a7c1349bffd1867f6e95e08de69f0c73`.

## 1. 경계와 연결 순서

기존 일반 명령의 OWNER/current-client/generation 집행은 수정하지 않는다. app/route/공유 ProjectCommand operation·실정책 목록·인증 기간은 수정하지 않는다. 실제 DB/격리 PG·정책 부여·멤버 변경·자동 OWNER 승격·제어 행/grant/generation 전환·accept·OS/서비스/Agent/Secret/비용은 실행하지 않는다. 실제 adapter 기본은 NOT_CONNECTED다.

FN15 전체를 SELF 요청으로 축소하지 않는다. 다른 사람 인계·실제 수락·제어 전환과 UI12/실제 검증은 미완료로 남긴다. Stage B의 실제 연결 선행은 WORK_STATUS에 분리하며 이 source-only 작업으로 완료하지 않는다.

## 2. 단위 1 — 요청 입력·불변 원문과 현재 사실 대조

허용 제품은 신규 `apps/server/modules/control-handoff/control-request-input.ts`, `control-request-snapshot.ts`; 시험은 신규 `tests/unit/FN15/control-request-input.test.ts`, `control-request-snapshot.test.ts`다.

- 입력 payload는 제안의 `targetActorRef:{userId}`, `targetClientRef:{userId,clientId}`, `baseControl:{actorId,clientId,generation,version}`, `reason`, `expiresAt`만 허용한다. actor/project/현재 시각은 내부 호출 문맥에서 받으며 payload의 주장으로 인증하지 않는다.
- plain JSON·정확 키·raw 문자열/정수/UUID/유효 시각·잘못된 prototype/accessor/cycle·2MiB·잘못된 Unicode를 기존 canonical helper로 검사한다. 이유는 원문을 보존하며 비밀 표식 검사를 재사용한다.
- 이 내부 후보 시험의 요청 수명은 최대 30분, 이유 1~20000 UTF16이다. 이를 기존 로그인 재인증 기간이나 최종 공개 API 정책으로 채택하지 않는다. 재인증은 현재 `reauthUntil > now`만 소비한다.
- 인증/회원/client/제어 관측은 별도 내부 port에서 얻을 사실이다. 순수 대조는 현재 활성 세션/자격·허용된 OWNER 또는 HANDOFF_ELIGIBLE·현재 actor/client와 SELF 대상 일치·현재 제어자/세대/version을 검사한다. VIEWER·타 프로젝트·회수/만료·옛 기준·이미 본인 현 client 제어·미확인 제어는 거절한다. 이 대조 자체가 실제 인증/실제 허가의 증거는 아니다.
- 요청 snapshot은 정확 id/version1/project/requestedBy/target/baseControl/reason/createdAt/expiresAt와 storedState=PENDING, executionAuthorized=false, controlTransferred=false를 불변 복제·canonical hash로 결박한다. verifier는 hash·중복 metadata·원입력 관계를 대조하며 원본 mutation을 하지 않는다.
- RED→GREEN은 정상 다른 client/적격 참여자와 모든 위 음성, 정확 만료 경계·재인증 경계, 잘못된 참조/형·비밀·변조·원배열 불변을 직접 확인한다. 실제 제어 변경은 0이다.

## 3. 단위 2 — transaction port·원자 저장·보호 조회

후속 신규 제품은 `control-request-store.ts`, `control-request-summary.ts`; 시험은 각각 FN15 전용 단위로 둔다. 단위 1 검수 후 상세 인터페이스와 정확 파일을 고정한다.

### 3.1 단위 2A — 요청 보관·동일 명령·저장 완전성

단위 1의 `3e2e804aaeecbf91671c8e3d53e4d47394703515` 검수 후 진행한다. 신규 제품 `apps/server/modules/control-handoff/control-request-store.ts`, 신규 시험 `tests/unit/FN15/control-request-store.test.ts`와 필요시 같은 폴더의 `control-request-store-fixture.ts`만 허용한다. 기존 단위 1·일반 권한 코드·route는 수정하지 않는다.

- 내부 command는 schemaVersion=1/operation=requestControl/commandId/projectId/clientId/payload만 받는다. 인증자는 command가 아니라 아직 미연결인 transaction port의 현재 observation에서 얻는다. 기존 입력·관측·snapshot verifier를 그대로 소비한다.
- 기본 port는 NOT_CONNECTED로 실패한다. 연결 가능한 실제 adapter를 추가하지 않는다. fake port는 같은 transaction의 인증/회원/client/control/현재 시각 관측, 명령 키 잠금/조회, ID 할당, 요청·명령·receipt·audit 삽입, 전체 bundle 재조회만 제공한다. 제어를 갱신하는 메서드는 만들지 않는다.
- 새 요청은 현재 facts와 SELF를 먼저 검사하고, 입력·명령 hash/고정 requestRef와 현재 주체·client·기준을 결박한 네 종류의 저장을 모두 성공시킨다. 저장 전후 facts 재검사와 bundle의 원문/hash/중복 metadata/연결 참조/단일 명령·receipt·audit 양방향 완전성을 확인한 후에만 transaction 결과를 반환한다.
- 동일 commandId/정확 payload는 현재 인증·역할·client·기준과 요청 기한을 다시 검사한 후 같은 보관 결과만 반환한다. 다른 payload·주체·client·기준의 재사용은 거절한다. 기한이 지난 command 재전송은 새 성공으로 만들지 않고, 과거 원문의 보호 조회는 단위 2B에서 별도로 구현한다. 만료를 이유로 원문/영수증을 삭제하지 않는다.
- 어떤 저장 단계 실패·최종 검증 실패·확정된 commit 실패도 fake transaction에서 부분 저장을 남기지 않는다. commit 결과가 불명인 실패는 자동 재실행하지 않고 명령 식별자를 유지한 오류로 남긴다. fake가 보장한 rollback과 실제 DB rollback을 혼동하지 않는다.
- 시험은 기본 미연결, 정상 OWNER 다른 client/적격 참여자, 제어 원본 불변, 같은 command 동시 모사·재확인 부작용 0, payload/metadata/원문·receipt·audit 변조, 중간 실패·최종 재관측 회수/만료·기준 변경, 고아/부분 bundle 거절을 먼저 RED로 확인한다. 가짜 port의 직렬화는 실제 PG 경합 검증이 아니다.

단위 2B의 유한 보호 조회·cursor와 단위 2C의 미확인 요약은 2A 검수 후 정확 인터페이스를 고정한다. 2A만으로 조회·요약·UI12 또는 FN15 전체를 완료하지 않는다.

### 3.2 단위 2B — 고정 요청 원문·유한 목록의 보호 조회

단위 2A checkpoint `d7738384d13ea558227c1f531d11b2e39da354e7` 뒤에 진행한다. 신규 제품 `control-request-read.ts`, `control-request-cursor.ts`와 FN15의 각 직접 시험·필요한 읽기 fixture만 추가한다. 기존 `control-request-store.ts`는 내부 bundle verifier의 export/호출 이름 연결만 허용하며 저장 로직·일반 권한·route는 변경하지 않는다.

- 내부 상세 입력은 projectId/정확 requestRef, 목록은 projectId/view(OWN 또는 CONTROLLER)/limit/cursor다. 사용자·client·현재 권한은 입력이 아니라 미연결 read transaction port의 현재 관측에서 얻는다. 기본 NOT_CONNECTED·TEST_FAKE 명시 모드만 허용하고 실제 adapter/키·계정·DB·네트워크를 만들지 않는다.
- OWN은 현재 활성 OWNER/HANDOFF_ELIGIBLE 회원의 본인 actor가 작성한 요청만 읽는다. CONTROLLER는 현재 활성 OWNER와 제어 actor/client가 정확히 일치할 때만 같은 프로젝트의 요청을 조회한다. VIEWER·타 프로젝트·회수·만료 세션/client는 원문/부분 상태를 받지 않는다. 다른 client에서 본인 원문을 읽을 때도 현재 client 소유·세션을 검사하며 cursor는 새 client로 재사용하지 않는다.
- 일반 읽기는 새 요청 작성처럼 재인증·요청 기한을 강요하지 않는다. 만료된 과거 요청은 생성시점 verifier로 보존 검증하고, 현재 만료/기준 변경/불명은 원 storedState=PENDING과 분리해 표시한다. OWN 조회는 현재 제어 불명만으로 과거 원문을 삭제하지 않으며 CONTROLLER는 현재 제어 불명이면 거절한다. 요청자와 현재 제어자의 조회권이 summary 생성권이나 제어 전환권이 되지 않는다.
- 정확 ref/hash·원문/metadata·command/receipt/audit 4종을 기존 verifier로 대조한다. 입력에 없는 새 요청이나 command를 합성·저장하지 않는다. 조회 전후 현재 인증/회원/client·선택 view를 재검사하며, CONTROLLER의 제어 세대/버전 변경 또는 원문 권한 회수 시 전체 결과를 폐기한다. 늦은 부분 결과를 반환하지 않는다.
- 목록 기본50/최대200, 최신 createdAt/id 내림차순 keyset이며 최대 limit+1만 읽는다. port 반환의 중복/순서/다른 프로젝트·주체·변조/과다 항목을 조용히 필터링하지 않고 거절한다. 목록에는 reason/원문 body 없이 최소 참조·시각·당시 상태와 현재 확인 상태만 보인다.
- cursor는 canonical payload와 port 제공 서명으로 actor/client/credentialGeneration/project/view/limit/CONTROLLER 기준·마지막 정확 ref/createdAt·발급/만료를 결박한다. 고정 도메인 분리와 유한 30분·4KiB token은 내부 후보 시험 조건이며 인증 기간/최종 공개 API 정책을 변경하지 않는다. 변조·재인코딩 불일치·타 주체/기기/프로젝트/view/limit·만료/미래 발급·옛 controller 기준을 거절한다. 실제 서명 키는 생성하지 않고 시험용 signer만 사용한다.
- RED/GREEN: 본인·현재 controller·과거 만료 원문 정상, 타인/VIEWER·회수/만료·교차 프로젝트·hash/4종 변조, 권한/제어 변경 중 지연 조회의 전체 미노출, 목록 유한성·안정 순서·다음 페이지/빈 끝, cursor 모든 결박 음성을 직접 확인한다. 쓰기/ID 할당/제어 변경·실제 HTTP/DB는 0이며 단위 2C 요약·실제 인수는 미완료다.

- 같은 transaction에서 현재 인증/회원/client/제어를 재관측한 다음 요청 전용 명령·snapshot·receipt·audit를 모두 저장한다. 동일 commandId·payload만 replay하고, replay 전에도 현재 접근을 검사한다.
- 기본 실제 adapter는 거절하며 fake transaction만으로 원자성·rollback·COMMIT 양방향 완전성·현재 권한 회수·기준 변경을 시험한다. 기존 일반 OWNER 검사에 예외를 덧붙이지 않는다.
- 조회는 본인 요청 또는 현재 controller만 최소 원문을 얻는다. actor/project/filter/limit/기한 결박 cursor, 정확 version/hash, 누락/변조·다른 주체의 원문/민감 상태 일부 노출 0을 검사한다. 목록의 최대 200 등 수치는 내부 후보 조건이며 공개 조회권을 새로 확정하지 않는다.
- 요약 생성은 현재 제어자의 정확 actor/client/generation 및 유효 reauthUntil을 같은 transaction에서 확인한 경우만 허용한다. SELF 요청자라는 이유로 생성 권한을 얻지 않는다. 수집 전후 현재 세션/회원/client/control과 요청의 baseControl을 다시 대조하고 변경·불명은 거절하거나 미확인으로 보존한다. 조회 권한과 생성 권한을 혼동하지 않는다.
- 안전 요약의 실수집 미연결을 빈 안전 배열로 숨기지 않는다. 불변 WAITING/UNVERIFIED와 gap·acceptanceEnabled=false를 보존한다. 요약 수명 30초는 내부 후보 시험값이다. 과거 요약을 현재 안전·실수락 허가로 승격하지 않는다.

### 3.3 단위 2C — 현재 제어자의 불변 미확인 안전 요약

단위 2B checkpoint `d7ec1323bdccc6eed19915f5d4e76ae1c1ad8995` 다음이다. 신규 제품 `control-handoff-summary.ts`, `control-handoff-summary-store.ts`, FN15의 각 직접 시험·필요 fixture를 허용한다. 기존 read 모듈은 내부 `currentAccess/canController/checkStable/verifiedBundle`의 export만 허용하고 조회 로직·일반 권한·route는 수정하지 않는다.

- 내부 명령은 schemaVersion=1/operation=prepareControlHandoff/commandId/projectId/clientId/payload:{requestRef}만 받는다. 현재 활성 OWNER·정확 현재 control actor/client·generation/version과 유효 reauthUntil을 같은 transaction에서 소비한다. SELF 요청자나 HANDOFF_ELIGIBLE이라는 이유만으로 생성하지 않는다. 원 요청의 project/ref/hash/4종 자료·PENDING·현재 요청 기한·baseControl을 수집 전후 다시 대조한다.
- 포트의 현재 인증·요청 검증·요청별 버전 잠금·관측 수집·재관측·summary/command/receipt/audit 저장·전체 bundle 확인은 한 transaction 안에서 수행한다. 수집 중 회원/client 회수·reauth/요청 만료·제어 기준/원문 변동은 전체 rollback이다. 기존 grant/control/세대 변경 메서드를 제공하지 않는다. 기본 NOT_CONNECTED/TEST_FAKE만이며 실제 수집자·키·DB·OS·Agent는 연결하지 않는다.
- 수집 자료는 같은 project의 activeExecutions/pendingCommands/pendingApprovals/sourceCheckpointRefs와 각 범주의 상태·관측시각·안전한 이유 코드다. 참조에는 project와 정확 version/hash를 결박하고 범주당 최대200·전체2MiB로 제한한다. 타 프로젝트·잘못된 ref/형식은 거절한다. 미연결·누락·수집 예외·한도 초과는 명시적 UNVERIFIED/gap으로 남기며 빈 안전 결과로 감추지 않는다. raw 예외·Secret·명령 본문은 저장/로그에 싣지 않는다.
- body는 고정 requestRef/요청별 version/controller·baseControl/observedAt/validUntil/네 범주/각 확인 상태/gaps/safetyState를 가진다. sourceMode=SYNTHETIC_ONLY·realCollectorsConnected=false·acceptanceEnabled=false·executionAuthorized=false·controlTransferred=false를 항상 보존한다. 알려진 미결 작업이 있으면 WAITING, 그 외도 UNVERIFIED이며 SAFE를 생성하지 않는다. 실수집 미연결과 대상 현재 자격 미확인은 항상 gap으로 공개한다.
- validUntil은 관측 후 최대30초이며 원 요청 만료를 넘기지 않는다. 이는 내부 관측 갱신 기한이고 실행·재인증 허가 기간이 아니다. summaryRef의 id는 requestRef.id, version은 요청별 양의 순번, hash는 자기 참조 없는 body canonical hash다. 새 버전은 이전 summary 원문을 덮지 않는다. source validator/verifier는 중복 metadata·명령/영수증/감사·request/summary ref의 양방향 완전성을 검사한다.
- 동일 명령의 정확 재확인은 새 version/수집/쓰기 없이 현재 controller·재인증·원 요청 기준을 다시 검사해 원 보관 결과를 반환한다. 과거 validUntil을 연장하지 않는다. 다른 내용/주체/client/기준 재사용·부분/고아 저장·확정 commit 실패는 거절/rollback, commit 결과 불명은 원 commandId를 보존하고 자동 재실행하지 않는다.
- 고정 summary 읽기는 현재 활성 본인 요청자 또는 현재 controller의 일반 읽기 권한으로만 가능하다. 만료 원문을 새 생성처럼 거절하지 않고 현재 expired/base 상태를 분리한다. 원 요청/요약/4종 ref/hash·version을 다시 대조하고, 조회 전후 권한 회수·scope 변경 시 결과 전체를 숨긴다. 조회만으로 summary 생성/수락·새 writer를 허가하지 않는다.
- 시험은 requester 생성 거절/currentcontroller+reauth 정상, unknown/부분/한도·예외 공개, 알려진 미결 WAITING/빈 합성자료 UNVERIFIED, SAFE/true flag·교차/미래/잘못 ref 거절, 전후 회수·만료·base 변경 rollback, 새 version/구버전 불변·동일 명령 부작용0, 4종 누락/변조·고아·응답 유실, 일반 읽기·expired/권한 변경을 직접 확인한다. 실제 PG·실수집·회수/제어 안전성은 이 fake 검증으로 증명하지 않는다.

## 4. 단위 3 — 미적용 SQL 후보와 합성 통합

정확 번호의 충돌·기존 migration 집합·loader를 확인한 뒤 새 `*.sql.pending` 파일만 추가한다. 기존 SQL·적용 manifest·실 DB는 수정하지 않는다. 요청·원문/버전·요약·명령/receipt/audit의 FK·불변 guard·중복 방지·완전성 요구를 소스 검수하고 fake/in-process로 검증한다. SQL/실 DB 동시성은 실행하지 않았으면 미검증이다.

### 4.1 후속 연결 후보 — 정확 경로·인증·PG source 포트 (미채택)

2026-10-26 PMO의 후속 상세화 요청에 따른 검토 후보다. 단위3은 계속하며 이 절만으로 route 등록·POSTGRES_SOURCE 허용·공개 DTO·DB/서비스 활성화를 승인하지 않는다. 기능의 부모는 INTERFACES §13.6/설계 §9.3/FN15 카드이며 acceptControl과 사람·기기 실제 제어 전환은 제외한다. 결정 대상은 아래 정확 wiring delta이고 전체 FN15 재승인이 아니다.

**2026-10-26 PMO 한정 source 수용:** 부모 후보 SHA256 7AC890EEB49D7D7563EBBA45DD8A7300ECDABF01DE1F1C930A466DC9B441F6F2를 대조한 PMO가 정확 다섯 경로/FN15 전용 행렬/동일 PoolClient POSTGRES_SOURCE adapter/cursor wrapper의 기본 미등록·비활성 **소스 구현과 합성 검증**을 기존 승인 계획 안으로 판단했다. 전체 공개 계약·수치와 실제 활성화의 채택은 아니다. 일반 OWNER/ProjectCommand/정책·로그인/재인증 기간/키는 불변이며, 기본 OFF에서는 pool.connect/query도 0이어야 한다. 실제 등록/설정 활성화·DB/격리QA·migration/GRANT/정책·실계정/키·서비스/Agent/비용·accept/control/grant/generation 변경 및 기존 특정 거절은 해제하지 않는다. 이후 구현은 이 절의 소유파일/검증·rollback 경계만 따른다.
**경로·입출력 후보** — 기존 `/api/v1/projects/:projectId/commands`를 사용하지 않는 FN15 별도 리소스다. 모든 UUID/ref/hash/version·정확 키·경로/본문 동일성을 검사하고 타 actor/filter 입력을 받지 않는다. 프로젝트 ID는 경로와 본문이 같아야 한다.

| 메서드·정확 경로 | 입력·결과·접근 |
|---|---|
| POST `/api/v1/projects/:projectId/control-requests` | 기존 내부 `{schemaVersion:1,operation:'requestControl',commandId,projectId,clientId,payload:{targetActorRef,targetClientRef,baseControl,reason,expiresAt}}`와 동일한 정확 DTO. 현재 인증 client와 body clientId·targetClientRef가 같고 targetActorRef는 현재 사용자다. 원 source request result/ref/snapshot/receipt·false flags를 반환하며 실제 제어 변경0 |
| GET `/api/v1/projects/:projectId/control-requests` | query는 view=OWN 또는 CONTROLLER, 선택 limit/cursor만. 결과는 기존 유한 목록 DTO 그대로이며 reason/body 제외, actor/client/기준은 서버 인증으로 고정 |
| GET `/api/v1/projects/:projectId/control-requests/:requestId/versions/:requestVersion` | query contentHash 필수, requestVersion=1. 정확 원문/ref/현재 만료·기준 상태를 반환하며 본인 요청자 또는 정확 현재 controller만 가능 |
| POST `/api/v1/projects/:projectId/control-requests/:requestId/versions/:requestVersion/handoff-summaries` | 내부 prepareControlHandoff 명령 DTO 그대로이고 payload.requestRef와 경로가 같아야 함. 현재 OWNER controller+재인증만 생성. 요약/정확 ref/receipt·WAITING 또는 UNVERIFIED·기존 false flags를 반환 |
| GET `/api/v1/projects/:projectId/control-requests/:requestId/versions/:requestVersion/handoff-summaries/:summaryVersion` | query requestHash/summaryHash 필수. 원 requestRef와 summaryRef를 모두 고정, summaryRef.id=requestId. 기존 보호 읽기 결과 그대로, current.expired는 원 요청 만료·body.validUntil은 요약 관측기한. 본인/현재 controller만 조회 |

reason 최대20,000자·본문2MiB, 요청 최대30분, 목록 기본50/최대200·cursor30분/4KiB는 내부 시험 조건을 공개 계약으로 **채택할지 이번 절에서 명시 판단받는 후보**다. 재인증 5분/절대만료, 로그인 미사용/최대수명은 변경하지 않는다. 원문/요약의 현재 미확인·실수집 미연결/대상 현재자격 미확인 gap·acceptanceEnabled/executionAuthorized/controlTransferred=false를 유지하고 SAFE/실인수 허가를 추가하지 않는다. 실제 저장소 연결과 실제 관측자의 근거 검증은 다르다.

**동일 PoolClient 인증·잠금 후보**

- 새 PG port가 PoolClient 한 개를 BEGIN부터 COMMIT/ROLLBACK까지 소유한다. `AccessRepository.authenticateInTransaction(db,token,csrf)`(access/repository.ts:37~49)로 기존 cookie의 actor/client/session·credentialGeneration/reauthUntil을 얻는다. HTTP의 actor/role/serverOwner/now를 신뢰하지 않고 token/CSRF/이유/DSN을 로그에 넣지 않는다. 자체 transaction을 여는 `authenticated()`를 이 내부에 중첩하지 않는다.
- source observe는 기존 helper가 잠그는 user/session/client 뒤 project→현재 actor의 project_members→project_control 순서로 잠근다. 요청별 변경은 이어서 commandId 중복 잠금→request행→요청별 요약 version 잠금 순서다. 여러 request를 한 연산에서 묶지 않는다. source 최초/마지막 관측은 같은 행 순서를 다시 읽고 잠금 대기 후 DB clock_timestamp를 사용한다. 명령 ID 경합은 유일 제약+현재 접근 재확인 뒤 정확 replay, 충돌·기한/세대 변경은 전체 rollback이다. 기존 다른 연산과의 실제 경합/교착은 실PG 검증 전 미확인으로 남긴다.
- helper의 인증 결과는 active 세션을 증명하는 입력일 뿐 FN15 권한이 아니다. 세션의 idle/absolute/revocation/credential, 사용자·client 상태와 회원/제어 원자료를 같은 transaction에서 source observation에 정확 투영한다. 종료 직전에도 현재 사실/DB시각을 재검사한다. 접근 회수/요청 원문·기준 변경은 부분 응답 없이 거절한다.
- 기존 `POST /api/v1/auth/reauthenticate` 및 `reauth_until`을 소비한다(access/routes.ts:47~51, repository.ts:159~179). 새 비밀번호 검증/재인증 endpoint/키/기간을 만들지 않는다.

| 행위 | 허용 후보 | 거절/불변 |
|---|---|---|
| SELF 요청 | 현재 활성 OWNER의 다른 client 또는 HANDOFF_ELIGIBLE, 정확 본인·현재 client·baseControl·유효 재인증 | VIEWER/타인·다른 client 위조/현재와 같은 actor+client/만료·회수·옛 기준 거절. 요청으로 OWNER/grant 발급0 |
| OWN 읽기·목록 | 활성 OWNER/HANDOFF_ELIGIBLE의 본인 요청 | 타인의 원문/이유/민감 목록0. 과거 요청 만료만으로 원문 삭제0, 새 작성 재인증 요구0 |
| CONTROLLER 읽기·목록 | 활성 OWNER이면서 현재 actor/client·세대/version 일치 | 현재 제어 불명·다른 client/세대 거절, VIEWER0 |
| 요약 생성 | 정확 현재 OWNER controller+reauth, 원 요청/PENDING/ref/hash/기한/base 동일 | 요청자라는 이유만의 생성0, HANDOFF_ELIGIBLE 승격0, 미수락 제어 이전0 |

**일반 권한·route·저장 delta 후보**

- FN15 전용 행렬을 적용하며 일반 `currentProjectController`/ProjectPolicyRepository.command/ProjectCommand operation·현재 permission policy 목록은 변경하지 않는다. 기존 정책을 우회하는 일반 명령 예외를 추가하지 않는다. 이 FN15 전용 요청/읽기·요약의 권한 행렬이 기존 부모의 구현에 해당하는지는 이번 후보의 PMO 판단 대상이다. 서버 OWNER라는 사실만으로 프로젝트 회원·제어를 대신하지 않는다.
- 허용 변경 후보: 신규 `apps/server/modules/control-handoff/control-handoff-pg.ts`, `routes.ts`; 기존 `control-request-store.ts`, `control-request-read.ts`, `control-handoff-summary-store.ts`의 mode/port 결합만; `apps/server/modules/access/repository.ts`의 cursor 전용 고정도메인 sign/verify wrapper만(원 키 반환0·새 키0·기존 로그인/세션 의미 변경0); `apps/server/app.ts`의 명시적 선택 등록만. 관련 신규 in-process HTTP/fake PoolClient 시험 최대3파일. 단위3 pending 및 소유 문서 외 기존SQL/manifest·projects/routes.ts·project-command.ts·정책·서비스 설정은 변경0이다.
- 후보 PG sourceMode는 `'POSTGRES_SOURCE'`로 TEST_FAKE와 분리하고 가짜 PG를 TEST_FAKE로 포장하지 않는다. 새 생성자는 pool/auth와 명시 `enabled:false`를 기본으로 받으며 enabled가 없거나 schema준비 확인 실패면 NOT_CONNECTED/503이다. 앱은 후속 명시 옵션 없으면 등록하지 않는다. 실제 enabled=true 등록·migration적용·runtime교체·DB접속은 이 source 구현 결정과 별도이며 이번 후보에 포함하지 않는다. 테스트 fake PoolClient는 in-process 합성 시험이라는 표시를 보존한다.
- 요청·요약·전용 command/receipt/audit는 단위3 0041 pending의 5표에 대응한다. 일반 commands/authorization_receipts/audit_events에 같은 명령을 이중 저장하거나 기존 command를 변조하지 않는다. 각 operation의 ref/hash·actor/client·base/요약 version·원문/metadata·정확 명령/영수증/감사 연결과 commit 역방향 완전성을 재검사한다. COMMIT 결과 불명은 commandId와 reconcile-first만 남겨 자동 재실행0이다. SQL 실행/TS canonical과 execution_json_hash 동등성·실FK/동시성·권한 적용은 NOT_RUN이면 통과라 하지 않는다.
- 기존 프로젝트 route와 같은 host/origin·정확 JSON·cookie parsing/same-origin을 적용하고 다섯 endpoint 모두 x-anvil-csrf를 검사하는 후보다. 기존 GET 계약을 전역 변경하지 않는다. 새 cursor는 기존 인증 키의 비공개 wrapper와 FN15 고정 도메인에만 결박하며 타 기능 서명 domain을 재사용하지 않는다. 오류는 원문 없는 기존 envelope(code/message/requestId/targetId/retryDisposition/details)를 사용한다. INPUT_INVALID400, AUTH_REQUIRED401, CSRF_INVALID/권한거절403 또는 타자료NOT_FOUND404, command/ref/base충돌409, 재인증/요청기한412, 한도413, NOT_CONNECTED/저장실패/commit불명503을 구분하고 commandId만 reconcile에 남긴다. token/비밀번호/Secret/SQL원예외/요청이유는 응답·로그에 넣지 않는다.

**검증·rollback 후보**

- in-process Fastify.inject와 fake PoolClient로 정확 다섯 경로·DTO/경로불일치/위조actor·client·원문hash/cursor scope·쿠키/CSRF/origin/content-type·만료/회수/옛 세대·타 프로젝트/주체·정확controller·전후 재검사·부분쓰기 rollback/고아/중복·응답유실/replay·등록기본OFF를 검증한다. 이 합성 PASS를 실제 HTTP/TLS·PostgreSQL/정식schema·로그인/화면/Agent 검증으로 승격하지 않는다.
- Main의 source 타입·직접 영향 검사/독립 검수·소유 commit 이후 기본 미등록 상태를 보존한다. rollback은 소유 commit의 일반 revert 또는 등록 옵션 비활성이다. 원문/DB/기존 권한 삭제·현재 제어 grant/세대 되돌림을 실행하지 않는다. 실DB·격리QA·정식migration·실계정/키·서비스/Agent/비용·acceptControl·control전환은 제외 그대로다.

## 5. 검수·증거·복구

각 단위는 writer의 RED→GREEN, Main 집중/직접 영향 타입 검사, 독립 spec·quality 검수 후 소유 경로만 같은 branch에 checkpoint한다. 서버-only이면 Web 전체 빌드는 반복하지 않는다. 완료 시험은 코드가 바뀌지 않으면 다시 하지 않는다. 기록은 기존 WORK_STATUS·WORK_PLAN의 한정 상태로 유지한다. 제품 사용 가능·FN15 전체 완료·Stage 완료로 보고하지 않는다. rollback은 소유 commit의 일반 revert이며 실제 저장 원문/제어를 삭제하거나 되돌리는 명령이 아니다.
