# FN17 승인 요청 본인 in-app 알림 — 구현 선행 계약 후보

상태: **DRAFT / NOT_ADOPTED / NOT_ISSUED**, revision 2. 작성: 2026-10-27, 설계 담당 어울. 이 문서는 승인된 FN17의 다음 실제구현에 필요한 상세 후보이며, 구현 지시·FN17 완료·실제 DB/권한 변경 허가가 아니다. 기존 CapabilityReport R2의 질문을 복제하지 않는다. PMO 대기를 다음 작업 선정의 선행조건으로 만들지 않는 최신 Main 책임 경계를 적용하되 이 초안이 자동 채택되지는 않는다.

## 1. 범위·선행·기존 계약과의 관계

계획의 FN17 선행은 FN10/FN11/FN12다. 이 문서는 **실제 존재하는 requestApproval 신규 성공 사건 한 종류**의 in-app 보관·조회·읽음 상세를 준비한다. FN12 전체나 FN17 전체 선행 충족·Stage E 전체 착수를 선언하지 않는다. 미구현 완료/오류 사건 생산자를 만들지 않는다.

현재 requiredDecider는 `{kind:'HUMAN',userId:요청자}`다. 따라서 승인 요청자는 자기 요청을 자기 in-app에서 확인한다. 다른 담당자 지정·Agent 전달·임의 publish/event/user/channel/URL 입력은 없다. 이미 구현된 브라우저 지원 관측을 재개발하지 않는다.

INTERFACES의 FN17 명령표는 `markNotificationRead`를 명시 ProjectCommand로 분류한다. **권장안은 이 기존 분류를 유지한다.** GET/list는 현재 회원+수신자 본인, 변경은 기존 OWNER/current controller·현재 정책·CSRF·commandId/replay를 모두 검사한다. 개인 읽음을 이유로 이 공통 제어를 우회하지 않는다. 제어기기 변경 뒤 제어권 없는 본인의 읽음 허용은 이번 후보에 넣지 않는 향후 대안이다. 새 PUT·개인 command 원장·auth_actions 전용 사용도 없다.

| 구분 | 상세 내용 |
|---|---|
| 기존 계획 안의 Main 내부 상세화 후보 | 기존9필드 정형화, 기존 GET notifications, 표준 markNotificationRead의 payload/영수증·원사건 결박/멱등/최초 읽음 보존·현재회원+본인 필터 |
| 의미 변화가 있어 명시 채택해야 할 항목 | 알림 저장 실패가 기존 승인 성공까지 rollback하는 원자성, 신규 notification 한도·보존 적용값 |
| 이번에 하지 않는 별도 실행 경계 | 실제 DDL/GRANT/계정권한·DB 적용·서비스 교체·배포·송신/비용·Secret |
| 범위 밖 대안 | 제어권 없는 개인 변경 예외, 새 PUT/API 예외·원장, 타수신자/사건·push/SMTP/구독·알림 설정·과거 backfill |

## 2. 정확 Notification DTO와 원사건

아래는 계약 표기이며 제품 코드가 아니다. UUID·SHA256·UTC·VersionRef는 기존 형식을 소비한다. 공개 Notification은 INTERFACES §14.2의 **기존9필드**만 사용한다. 추가 top-level schemaVersion/ref/channel/createdAt을 넣지 않는다. eventRef 내부의 `occurredAt`과 channel은 원사건의 정형화다. 원문 reason/risks·details·제목·Secret·승인 token·URL은 복사하지 않는다.

```ts
type ApprovalRequestedNotification = {
  id: UUID;
  eventRef: {
    kind: 'APPROVAL_REQUESTED';
    serverCommandId: UUID; // commands.id, caller commandId가 아님
    requestRef: { id: UUID; version: 1; contentHash: Sha256 };
    channel: 'IN_APP';
    occurredAt: UtcTimestamp;
  };
  recipientRef: { kind: 'HUMAN'; userId: UUID };
  projectRef: { id: UUID };
  severity: 'ACTION_REQUIRED';
  reason: 'APPROVAL_REQUESTED';
  authenticatedTarget: { kind: 'APPROVAL_REQUEST'; projectId: UUID; approvalRequestId: UUID };
  deliveryState: 'STORED_IN_APP';
  readAt: UtcTimestamp | null;
};
```

severity/reason/deliveryState의 위 literal은 이 한 종류의 **새 상세 제안**이다. ACTION_REQUIRED는 발생 당시 사건 분류이며 현재 PENDING/승인 가능을 보장하지 않는다. STORED_IN_APP은 OS 전달·사용자 확인이 아니다. UI 고정 문구는 “승인 요청이 보관되었습니다. 현재 상태는 요청 상세에서 확인하세요.”다. 원 승인 reason을 이 reason 필드로 바꾸어 싣지 않는다.

NotificationRef는 `{id,version:1,contentHash}`다. version1은 알림 불변 본체의 **새 상세 제안**이다. hash는 위9필드에서 readAt만 제외한 정확 canonical JSON의 SHA256이다. 같은 버전의 UI/서버가 이 공통 정규화로 ref를 구성한다. 새 공개 최상위 필드를 발명하지 않고 표준 명령 receipt의 data.ref에 이 ref를 싣는다. readAt 변경은 본체 version/hash를 바꾸지 않는다. 현재 구현용 브라우저 hash helper의 존재/재사용 가능 여부는 확인하지 않았으므로 구현 패킷에서 확인한다.

원사건 키는 `(projectId,serverCommandId,'APPROVAL_REQUESTED')`, 중복키는 사건+recipient user+IN_APP이다. 요청 본인의 `requiredDecider`와 정확 requestRef/version1/hash는 서버 원 snapshot에서만 유도한다. 동일 원 요청의 caller commandId는 receipt.id와 구별하며 FK로 쓰지 않는다.

## 3. GET/list와 표준 markNotificationRead

### 3.1 조회

| 기존 collection의 구체 경로 | strict 입력·성공 |
|---|---|
| GET `/api/v1/projects/:projectId/notifications` | query `limit?`,`cursor?`,`readState?`만. readState=`ALL/UNREAD/READ`, 생략 ALL. 200 Page<Notification> |
| GET `/api/v1/projects/:projectId/notifications/:id` | UUID path, query 없음. 200 Notification |

Page는 기존 `items,nextCursor,hasMore,observedAt,baselineVersion`을 따른다. baselineVersion은 알림이 프로젝트 기준선 적용을 뜻하지 않으므로 null을 쓰는 **상세 제안**이다. GET는 읽음을 쓰지 않는다. 모두 no-store이며 허가 오류를 빈 목록/200으로 바꾸지 않는다.

기본50/최대200은 TD-03 기존 정책이다. limit의 기존 strict 양의 십진문자열 검증을 소비한다. 정렬은 `(created_at DESC,id DESC)`, keyset `<(lastAt,lastId)`다. 임의 recipient/event/channel/query/sort는 열지 않는다. codec의 canonical filter에 `collection:'FN17_APPROVAL_IN_APP',projectId,recipientUserId,readState,order:'CREATED_DESC_ID_DESC'`와 limit를 결박한다. 기존 actorId·서명·version·기한 검사를 소비한다.

기존 ProjectListCodec의 cursor4096자·30분 수명을 이 collection에도 적용하는 것은 **새 적용 제안**이며 TD-03의 FN17 확정값이라고 하지 않는다. 새 서명키 없이 기존 서버 cursor 목적 prefix를 소비한다. 타사용자/project/collection/filter/limit·변조·만료는400이다. 매 페이지 세션·현재 회원·본인을 재검사한다.

한 페이지의 readState/readAt은 같은 statement snapshot에서 조회한다. 페이지 사이 다른 기기에서 READ가 바뀌면 결과도 변할 수 있고 전체 snapshot/총건수는 보장하지 않는다. 읽음 성공 후 첫 페이지를 명시 재조회한다. unread count·자동 polling/SSE·배치 기능을 추가하지 않는다.

### 3.2 표준 명령 요청·응답

기존 POST `/api/v1/projects/:projectId/commands`의 정확 ProjectCommand envelope를 소비한다.

```ts
{
  schemaVersion: 1,
  commandId: UUID,
  projectId: UUID, // path와 동일
  operation: 'markNotificationRead',
  targetId: UUID, // notificationRef.id
  expectedVersion: 1, // 불변 알림 본체 version
  clientId: UUID,
  controlGeneration: PositiveInteger,
  baselineRefs: [],
  approvalRef: null,
  payload: { notificationRef: { id: UUID, version: 1, contentHash: Sha256 } }
}
```

위 payload가 상세 후보이며 임의 recipient/event/url/reason/읽음시각을 받지 않는다. readRef/version/hash는 현재 원본과 정확히 같아야 한다. 일반 envelope 필드/coercion/unknown field·body 검사는 기존 방식이다. 성공은200의 기존 OperationReceipt이며 data에 `{ref:NotificationRef,status:'NOTIFICATION_READ',readAt:최초서버시각}`를 둔다. 영수증은 명령 처리 결과이고 승인/전달/업무 완료가 아니다.

기존 `ProjectPolicyRepository.command`의 session/CSRF→currentProjectController→authorizeMaterial→projectReplay→domain callback을 유지한다. 현재 정책에서 markNotificationRead를 허용하지 않거나 정책이 없으면 기존 PROJECT_OPERATION_DENIED/PERMISSION_POLICY_UNCONFIGURED로 거절한다. 실사용자 정책에 rule을 자동 부여하지 않는다. REQUIRE_APPROVAL와 approvalRef 소비가 이 개인 상태 연산에 연결되지 않았다면 명시412 `NOTIFICATION_READ_APPROVAL_NOT_CONNECTED`로 거절하는 상세 후보이며 임의 승인을 만들어 우회하지 않는다. 일반 AUTO 허용 rule에서만 첫 구현을 연결한다.

명령 적용은 본인 알림/ref 검증→최초 읽음 조회/INSERT→`persistProjectReceipt`를 이용한 표준 commands/authorization_receipts/audit 저장을 같은 transaction에 묶는다. INSERT 순환을 피하려면 receipt를 먼저 생성하고 읽음 행의 command_id를 receipt.id로 연결한다. 그 뒤 실패하면 모두 rollback한다. 이미 읽었다면 최초 readAt을 그대로 가진 새 표준 명령 receipt를 저장하되 읽음 행을 UPDATE하지 않는다.

같은 commandId·같은 원 envelope는 기존 projectReplay가 같은 영수증을 반환하며 새 callback/읽음/감사를 만들지 않는다. 같은 commandId·다른 target/hash/body/operation은 기존409 IDEMPOTENCY_CONFLICT다. 다른 commandId로 같은 알림을 다시 읽어도 최초 readAt은 보존한다. 응답 유실은 원 commandId의 기존 operations 조회/replay로 조정하고 새 commandId를 자동 발급하지 않는다. 제어기기/정책이 변했으면 replay도 기존 현재성 선행검사를 우회하지 않는다.

## 4. 인증·본인·동시성·원문 보호

GET/list는 기존 AccessRepository.authenticated의 ACTIVE user·유효 client/session·회수·credentialGeneration·idle/absolute 만료와 projectMember를 소비하고 `recipient_user_id=actor.actorId`로 한정한다. 알림 보유가 현재 회원 자격을 대신하지 않는다. 타수신자/타project/비회원·회수/미존재는404다. OWNER/server owner/current controller도 타인의 개인 알림을 이 endpoint에서 조회하지 않는다. GET에는 제어권을 요구하지 않는다.

mark는 이 본인/회원 검사를 **기존 OWNER/current controller·현재정책 검사에 추가**한다. clientId는 인증 client와 동일하고 controlGeneration은 현재 세대여야 한다. 기존 host/origin·x-anvil-csrf 검증을 유지한다. 보관 project 변경은 기존 PROJECT_ARCHIVED로 거절한다. GET의 과거 이력은 기존 projectMember가 허용하는 범위에서만 읽으며 새 보관 예외를 추가하지 않는다.

잠금 순서는 기존 session의 user/session/client→project/member/current control·현재 policy를 유지한다. currentProjectController가 획득한 project/member 및 project_control 잠금은 domain callback과 같은 transaction 끝까지 유지된다. 그 기존 project 잠금 아래에서 원ref 검증·기존 read row 조회·최초 INSERT를 직렬화한다. notification 행 잠금이나 새 lock 명령을 추가하지 않는다. notification_reads의 복합 PK도 중복을 막고 불변 본체·최초 읽음·명령 영수증은 같은 transaction에 유지한다. 회수/제어 전환과 기존 project/member/control 잠금을 공유한다. 잠금 대기 뒤 DB 시각으로 세션·현재 회원/제어·정책 만료를 최종 확인하는 검증이 필요하다. 기존 helper가 이 최종 시각 보장을 충분히 주는지는 구현 전 확인하며, 이 문서로 이미 보장된 것처럼 쓰지 않는다.

결정·소비 뒤 현재 approval version2/3 또는 만료/회수는 알림 자동삭제 근거가 아니다. 알림은 원 사건의 이력이다. 클릭은 기존 PC `approvalRequestHref`/mobile `mobileApprovalRequestHref`에 정확 project/request ID만 넣는다. 승인 상세와 decideApproval의 requiredDecider/client/controlGeneration·원문 접근 검사·현재정책을 유지한다. 알림에서 원문/승인 token을 돌려주거나 클릭으로 자동 결정/제어 인수하지 않는다.

## 5. 기존 requestApproval transaction·원 v1/hash·replay

권장 위치는 기존 requestApproval의 원 receipt·approval_requests INSERT·필요한 기존 후보 capture 성공 뒤 같은 db transaction에서 목적별 notification INSERT다. 외부 publish endpoint를 만들지 않고 서버가 생성한 receipt.id·정확 requestRef·requiredDecider·createdAt만 넘긴다. 기존 request snapshot/ref/result 형식, 결정·소비 로직은 바꾸지 않는다.

- 기존 projectReplay는 callback 전에 반환하므로 동일 요청 replay에서 알림 재발행0이다. 채택 전 성공했던 요청 replay도 backfill0이다.
- 신규 callback만 정확 원 사건+본인+IN_APP을 INSERT한다. 중복은 기존 불변 값 전체가 같은 경우만 수렴하며, 다른 내용으로 upsert하지 않는다.
- 원 transaction rollback이면 receipt·승인요청·기존 후보 capture·알림 모두 commit0이다. commit 후 응답 유실은 기존 정확 commandId로 조회/조정한다. 알림 읽기 때 누락알림 생성·과거 audit 스캔은 없다.

`approval_requests.version/status`는 결정·소비에서 바뀐다. 원 requestRef.version=1을 현재 row.version과 결박하는 FK를 만들지 않는다. **실제 UNIQUE(project_id,id)를 FK로 사용하고 불변 request_json/content_hash를 별도 검증한다.** 생성·GET/list에서 기존 승인 reader의 초기 요청 검증을 의미 보존한 helper로 재사용하는 최소 분리는 가능하나, 기존 결정/소비 검증을 약화하지 않는다.

필수 검사는 원 command의 scope PROJECT·project/id/actor/client·operation=requestApproval·state=APPLIED·receipt status/data.status=APPROVAL_REQUESTED, receipt.data.ref/request와 row 원 request_json의 정확 일치다. request_json의 id/version1/PENDING/createdAt·snapshot.projectId/requestedBy/requiredDecider/policyRef/details/actionScope/scopeDigest/expiresAt을 기존 metadata와 대조한다. 기존처럼 id/version/status/createdAt을 제외한 snapshot canonical SHA256과 actionScope hash를 재계산한다. 현재 row.version2/3과 원 ref1을 혼동하지 않는다.

notification의 source_command_id는 approval_requests.command_id와 같고, requestRef/hash·recipient·project/target·occurredAt이 그 원본과 같아야 한다. requiredDecider와 requestedBy.userId가 같은 HUMAN인지도 확인한다. 자체 notification hash를 재검증한다. 원 reason/risks는 내부 대조만 하고 복사하지 않는다. 현재 정책 만료/기기전환은 과거 사건을 위조로 만들지는 않지만 새 mark/decide의 권한도 주지 않는다.

권한 검사를 먼저 해 타인 존재/무결성 정보를 숨긴다. 허가된 알림의 원본/hash 손상은503 NOTIFICATION_INTEGRITY_FAILED로 실패시키며 list에서 조용히 누락시키지 않는다.

## 6. 원자 저장과 outbox 대안

| 대안 | 정확 효과·위험 |
|---|---|
| **A. 원 request transaction의 in-app INSERT — 권장 후보** | 새 요청·알림이 함께 commit. worker/외부전송 없이 작다. **알림 표/guard/용량 실패가 기존 승인 요청까지 rollback하는 새 실패 의미**가 있으므로 명시 채택 필요 |
| B. 원 transaction outbox→별도 materialization | enqueue 실패는 여전히 기존 승인을 rollback한다. enqueue 뒤 알림 생성 실패만 분리할 수 있다. worker/claim·PENDING/실패/재처리·수명·권한이 추가된다. 기존 delivery_outbox에 이 사건용 계약이 이미 있다고 추정하지 않는다 |
| C. 원 승인 commit 뒤 best-effort INSERT | 알림 실패가 원 승인을 rollback하지 않는다. commit/INSERT 사이 crash 누락 가능. durable 복구/cutover 없이 무손실 보관이라 할 수 없고 자동 과거 backfill을 덧붙이지 않는다 |

외부 전송 없는 한 종류에는 A를 권장한다. “알림 실패가 승인 성공을 바꾸지 않는다”가 우선이면 A를 채택할 수 없으며 B도 enqueue 실패 위험을 없애지는 않는다. 그 경우 별도 결정을 받아 후속 계약을 정한다. 원자성 차이를 단순 내부 구현 방법으로 숨기지 않는다.

## 7. 신규 저장 표·PK/FK/constraints·roles 제안

DDL은 작성·적용하지 않는다. 신규 SQL 번호/파일명을 예약하지 않고 당시 실제 집합 대조 뒤 forward-only로 배정한다. 과거 FILE_MAP 0017_notifications 명칭을 사용하거나 현재0017 실행권한·기존 SQL을 바꾸지 않는다.

### notifications: 불변 본체

- `id uuid PK`, `UNIQUE(project_id,id)`, `UNIQUE(project_id,id,recipient_user_id)`.
- NOT NULL: project_id,source_command_id,approval_request_id,recipient_user_id; request_version CHECK=1; request_content_hash/content_hash SHA256 형식; created_at timestamptz.
- event_kind/channel/severity/reason_code/delivery_state는 위 DTO의 단일 literal CHECK. target는 project/request FK에서 생성하며 임의 JSON/URL·원문 사본을 저장하지 않는다.
- `UNIQUE(project_id,source_command_id,event_kind,recipient_user_id,channel)` 및 `UNIQUE(project_id,approval_request_id,recipient_user_id,channel)`.
- FK `(project_id,source_command_id)→commands(project_id,id)`, `(project_id,approval_request_id)→approval_requests(project_id,id)`, `(project_id,recipient_user_id)→project_members(project_id,user_id)`, `recipient_user_id→users(id)`. 모두 ON DELETE RESTRICT.
- index `(project_id,recipient_user_id,created_at DESC,id DESC)`. created_at은 원 request.createdAt이며 클라이언트 clock이 아니다.
- FK만으로 exact source/request/recipient/hash가 증명되지 않는다. INSERT guard는 현재 원 command context·원 row/receipt·requiredDecider·불변 필드 결박을 검증하고 서버는 canonical hash를 검증한다. UPDATE/DELETE를 거절한다.

### notification_reads: 최초 읽음 한 행

- `PRIMARY KEY(project_id,notification_id,recipient_user_id)`; 이 복합 FK→notifications(project_id,id,recipient_user_id), ON DELETE RESTRICT.
- `client_id uuid NOT NULL`, `(recipient_user_id,client_id)→clients(user_id,id)`, ON DELETE RESTRICT.
- `command_id uuid NOT NULL UNIQUE`, `(project_id,command_id)→commands(project_id,id)`, ON DELETE RESTRICT. 최초 mark의 서버 receipt.id이며 caller commandId가 아니다.
- notification_content_hash SHA256 형식·read_at timestamptz NOT NULL. read_at은 최초 transaction의 서버 시각이며 notification.created_at 이상.
- INSERT guard는 정확 markNotificationRead 원 command/receipt·현재 actor/client/member/control/policy·자기 notification/ref를 검증한다. UPDATE/DELETE 금지. 이미 READ이면 새 command receipt만 기록하고 이 최초 행은 유지한다.

기존 migration 소유자와 anvil_v3_app을 사용하는 최소 후보다. 새 계정/credential/NOLOGIN owner를 만들지 않는다. app에는 신규표 SELECT·필요 INSERT만, UPDATE/DELETE/TRUNCATE는 부여하지 않는 제안이다. PUBLIC에 불필요 권한을 부여하지 않는다. notification 생성은 기존 receipt가 설정하는 anvil.actor_id/client_id/command_id와 결박한다. read도 표준 receipt의 같은 context를 소비한다. 공유 app credential 자체 탈취까지 SQL context가 막는다고 주장하지 않는다. 서버 인증+기존 trusted app 경계+DB 제약/guard 모델을 유지한다.

실제 owner/default privilege/trigger·grant/경쟁은 미확인이다. 표준 commands/authorization_receipts/audit를 수정해 새 scope를 만들지 않는다. 구체 변경 표면은 위 신규 두 표/guard·기존 operation allowlist의 예정 FN17 연결이며, 실DB/GRANT 실행은 별도 정확 허가다.

## 8. 한도·오류·보존

기본 page50/최대200, 기존 HTTP app bodyLimit2MiB와 strict DTO를 소비한다. TD-03 본문2MiB/파일20MiB/프로젝트 원본·첨부10GiB를 알림 metadata quota로 전용하지 않는다. 이벤트64KiB/batch1MiB/spool1GiB도 알림 본문·retry/TTL·읽음빈도 한도가 아니다. 자유본문·batch·송신·자동재처리는 없다.

**새 제안 숫자:** notifications 프로젝트당10,000행을 첫 상한 후보로 둔다. 기존 project 잠금 안에서 신규 INSERT 전 검사하며 초과는429 NOTIFICATION_CAPACITY_EXCEEDED다. A 원자안을 택하면 원 승인도 commit0이다. 기존 replay·GET·READ는 상한 후에도 가능하다. notification_reads는 알림당 본인1행이며 새 command 원장은 만들지 않고 표준 command 보존 정책을 따른다. 이 상한은 승인값/실측값이 아니고 Main의 채택 검토 대상이다. 실제 바이트/부하는 후속 측정이다.

보존은 기존 자동삭제 OFF·참조/원문 보호·Secret 제외를 따른다. 보존기간은 미확정이며 무기한 보존을 보장하지 않는다. 만료/소비된 승인이라고 알림을 자동삭제하지 않는다. 용량 부족은 명시하고 원문 quota 축소·자동삭제로 숨기지 않는다.

| HTTP/code | 의미 |
|---|---|
| 400 INPUT_INVALID/CURSOR_INVALID | strict schema·path/query·unknown field·서명/범위/만료 오류 |
| 401 AUTH_REQUIRED | 기존 세션/user/client 만료·회수·세대 불일치 |
| 403 기존 ORIGIN_INVALID/CSRF_INVALID/PROJECT_WRITE_DENIED/PROJECT_CONTROL_REQUIRED/PROJECT_OPERATION_DENIED | 기존 표준 명령 권한·기기·정책 실패, 상태변경0 |
| 404 NOT_FOUND | 미존재/타project·타수신자/비회원·회수 |
| 409 IDEMPOTENCY_CONFLICT/CONTROL_GENERATION_CONFLICT/NOTIFICATION_REF_CONFLICT | 기존 command 충돌·옛 제어세대, 또는 자기 알림 exact ref/hash 불일치 |
| 412 기존 PROJECT_ARCHIVED/PERMISSION_POLICY_UNCONFIGURED·NOTIFICATION_READ_APPROVAL_NOT_CONNECTED 후보 | 표준 선행 미충족, 새 정책/승인 자동생성0 |
| 413 기존 body 크기 오류 | 기존 ceiling 초과, 절단/부분처리0 |
| 429 NOTIFICATION_CAPACITY_EXCEEDED 후보 | 위 신규 제안 상한·A면 원 승인 rollback |
| 503 NOTIFICATION_INTEGRITY_FAILED/STORAGE_FAILED | 허가된 원사건 손상/저장 실패. 원문·SQL/stack 노출0 |

오류/응답 유실은 기존 reconcile-first·원 commandId 조회 규칙을 따른다. 현재 제어권·정책 실패를 retry로 우회하지 않는다. 실제 빈도정책이 없는 상태에 새 rate limit이 이미 있다고 하지 않는다.

## 9. 최소 UI 흐름·필수 검수

UI14의 기존 지원 관측 옆에서 본인 in-app 명시 조회·재조회/다음 페이지와 고정 안내·시각·읽음·기존 요청 상세 링크만 연결한다. UI13은 동일 DTO/reader와 기존 모바일 승인 경로를 소비한다. 알림 설정 저장·지원 상태→실제 전달 PASS 전환은 없다. 조회/카드/링크 클릭은 읽음 자동변경0이다. 현재 제어·정책이 허용하는 기기에서 명시 읽음만 활성화하고, 다른 기기는 조회/원 요청 링크와 기존 제어 인수 안내를 유지한다. 인수/승인 자동실행0이다.

계정/project 전환 시 목록을 지우고 늦은 응답의 scope가 달라지면 표시하지 않는다. READ 성공을 낙관 확정하지 않고 실패/미확인은 보존한다. 검수는 후속 정확 패킷에서 다음을 각각 증명한다. **이번 문서 작성에서는 전부 NOT RUN이다.**

1. 신규 실제 requestApproval→정확 receipt/id·원 v1/hash·본인 알림1행→list/GET→표준 mark→최초 readAt·기존 PC/mobile 동일 request 링크. 원 reason/risks/Secret 복사0.
2. 원 승인 동일 command replay/동시 요청/응답 유실·기존요청 replay backfill0. 실패 request 알림0. 알림 INSERT/guard/상한 실패면 receipt/request/후보 capture 포함 원transaction commit0.
3. approval 결정 version2/소비 version3 뒤 원 알림 ref1/hash 유지. 원본/알림 변조는503이며 본인 범위 검사 전 타인에게 오류정보 노출0.
4. GET의 현재회원+수신자·제어권 없음 허용과 mark의 OWNER/current client/controlGeneration/현재policy·CSRF 유지. 미설정/거절/회수/타수신자·타project·보관/만료/기기변경 거절. 실제 정책 자동부여0.
5. 동일 mark command replay 감사/읽음 중복0, 같은 commandId 다른 본문409, 다른 commandId 같은 알림의 최초 readAt 보존. 동시 mark/회수/제어 전환·잠금대기 뒤 만료를 확인.
6. page50/max200·동률 keyset·필터/주체/project cursor 재사용·만료/변조·READ 변경 후 재조회. 실제 허가 빈 목록과401/404/503 구분.
7. 실제 PG FK/guard·동시 commit·앱 UPDATE/DELETE/TRUNCATE 거절, browser Network same-origin·PC/mobile 최소 클릭을 별도 증명. 단위/fixture/build를 실제 DB/served·실기기·OS push PASS로 올리지 않음.

## 10. 미확정·실제 제외·rollback

Main이 내부 상세로 검토할 항목은 기존9필드 nested DTO/ref canonical 구성·표준 mark payload/receipt·cursor 상세·두 표/guard·최소UI다. 명시 의미 선택은 A 원자성의 새 rollback 조건과 새 행 상한이다. 표준 원본 정책의 조회/원문 보호를 바꾸는 권한 예외는 이 후보에 없다. 구현 시 canonical helper/최종시각 확인의 실제 재사용 방법과 DB guard/권한 세부는 미확정이므로 현재 보장이라고 하지 않는다.

제외: 실제push/SMTP/구독·알림settings·외부전송/비용·일반진도/가짜완료/오류·타수신자·과거backfill·provider/credential/실DB·계정권한·서비스/Agent/Secret·배포. FN17 나머지 사건/설정/전달·UI13 전체·Stage 전체는 미구현/미완료다.

현재 rollback은 미채택 문서1개 철회뿐이다. 후속 적용 뒤에는 신규 UI/API 경로와 원 승인 알림 hook을 이전 검증 source로 되돌리되 저장한 알림/read·원 승인/receipt를 보존한다. DROP/reset·기존 SQL 변경·자동삭제·과거backfill0이다. rollback 뒤 신규 승인 알림 공백을 기록한다. 실제 schema/권한 forward 보정·서비스 rollback은 그때 정확 실행허가와 증거에 따른다.

## 11. 직접 읽은 근거와 SHA256

제공된 source 기준은 branch `codex/av3-stage-b`, commit `672af50cea3eb6c4de32fc9f959bb9bfd6b67f97`다. 이번 담당자는 Git 명령을 실행하지 않았으므로 HEAD 재검증값으로 보고하지 않는다. 내부 실행공간 경로/이름은 기재하지 않는다.

| 근거 파일·절/행 | SHA256 |
|---|---|
| docs/WORK_PLAN.md FN17/UI13/UI14 행1277~1295 | 4FBD37428FD79193BC0F34A9B85DDFB4B2FC5D169DCF8CF3E69D858B1B859011 |
| docs/contracts/INTERFACES.md 공개명령/GET·§14.2 행1052~1056 | D527F5EA098A7F560E60490FA18179AF535BCFC3AD532B818314999C4E1C73E2 |
| docs/contracts/DATA_MODEL.md 승인/알림 행266~271/405 | 9BB979923EDF36D37EB114398B28F6CD2BFB09FB8A3722D8A5753CF1B3FDE1DC |
| docs/contracts/TECH_DECISIONS.md TD-02/TD-03 §12 행150~167 | 2048226A20B4BB8922F53E2840367423B1C27158CB1BD1EDF16ECD167A4B0FE4 |
| docs/work_packages/FN17_IN_APP_APPROVAL_NOTIFICATION_DESIGN_PREFLIGHT.md | A46F2A20C0B9CA98F45D2C2C01C1C5CCF5A07A626B5CC763F602BFCC1B41194F |
| apps/server/modules/approvals/project-approvals.ts request 행46~70·decide/read 초기hash | 97425BC8AE899DAD0979C3F7F8111C58CAB5C02D06623BCDBF8A0508CE3C84B8 |
| apps/server/modules/access/project-command.ts member/controller/replay 행52~96·callback123~134 | FFD8A12A41381D407AAECBA3145C2BE88B0786549BC46E5935C7BBAD2F9FDC60 |
| apps/server/modules/access/repository.ts 인증/transaction44~75·회수101~102 | 48ACE9A3B6BE563C7FB25A6552E3EB38E50352C6DCD3DA4FECBF56EB3FD48CC5 |
| apps/server/modules/projects/service.ts strict page/서명cursor | BA306FE1918330FBF1AB508E7FC34E7BB6FD4E9F2E9C29DACECBB7E525FA2FAB |
| db/migrations/0011_authorization.sql 실제 PK/FK·commands/outbox | B5922FE31715076E7CDB1F6485F9EA5AF4554C90FB957FB3B3A2C42EA22B9A21 |
| db/migrations/0001_projects_access.sql users/clients·project_members | 353D28D657794D47B84DB0C8A4D9481C8EBC9BF73278614578C6CF5CFD4C3643 |
| apps/web/src/shell/routes.ts PC/mobile 요청 행20~29/47~54 | C0ABC61A9864F18E9CC0296B14DA648633034D5FA88F8DF981E217656C920806 |
| apps/server/modules/projects/routes.ts CSRF71·approval 연결248/252 | 9B0B8D6B953EBF7F93BDA1B39774F32337B6210ABFF882D1AA3251AF82FED515 |
| apps/server/app.ts bodyLimit/strict ajv20 | CEFDC345B3F3D849E5F215E02EEB9C054B654B212B0BE5AC236C240C8EB0EF71 |

추가 대조는 PMO AGENTS→project AGENTS v3·최신Main책임 경계, WORK_STATUS의2026-10-26 FN17 preflight, DEVELOPMENT_ENVIRONMENT, 설계§11.14~15, 최초0011 요청guard 및 현재SQL 파일목록이다. 기존자료는 읽기만 했다.

이번 작업: 후보문서1개 작성. 제품/SQL/시험/Git/DB·서비스/Agent·계정권한/Secret·외부송신 실행·변경0, 정식실패0. 검증은 문서·실제 source/PK/FK·파일hash 읽기대조뿐이다. SQL구문/constraint/role·API·transaction·browser·실DB/served/기기/전달은 NOT RUN이다. WORK_STATUS/WORK_PLAN/기존preflight는 이담당자 허용범위밖이므로 Main이 통합기록한다. 후보작성은 채택/기능완료 증거가 아니다.

### revision 2 — 독립 검토 I1 조치

이전 후보 SHA256은 `F9B9EFEBB91286B63A0B5B8584F9C3458D32486A7D81B78A49C275A6A3DD977B`다. 독립 검토 C0/I1/M0은 notification FOR UPDATE가 app SELECT/INSERT만 부여하는 최소 권한 후보와 충돌함을 지적했다. PostgreSQL15의 해당 행 잠금은 최소 열 UPDATE 권한이 필요하다. Main과 검토자가 확인한 기존 project/member/control 잠금의 동일 transaction 유지 근거를 받아 notification 행 잠금을 제거하고 기존 project 잠금 아래 최초 읽음 조회/INSERT 직렬화로 정정했다. UPDATE 권한·새 lock 명령·표/PK/불변·영수증 원자성 변경0이다. 이번 조치는 문서1개만 수정했으며 추가 source 조사·SQL·시험·Git·DB·서비스 실행0이다. 실제 검증은 여전히 NOT RUN이고 재검토 판정은 Main이 기록한다.
