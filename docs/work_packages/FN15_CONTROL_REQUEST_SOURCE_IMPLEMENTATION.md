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

## 5. 검수·증거·복구

각 단위는 writer의 RED→GREEN, Main 집중/직접 영향 타입 검사, 독립 spec·quality 검수 후 소유 경로만 같은 branch에 checkpoint한다. 서버-only이면 Web 전체 빌드는 반복하지 않는다. 완료 시험은 코드가 바뀌지 않으면 다시 하지 않는다. 기록은 기존 WORK_STATUS·WORK_PLAN의 한정 상태로 유지한다. 제품 사용 가능·FN15 전체 완료·Stage 완료로 보고하지 않는다. rollback은 소유 commit의 일반 revert이며 실제 저장 원문/제어를 삭제하거나 되돌리는 명령이 아니다.
