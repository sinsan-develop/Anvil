# FN16 보호참조 등록·조회 첫 구현 상세 계약 후보 R2

2026-10-27 · Main 어울 · 기준 source24e70f71a865e3e4779f769a787000d9d6f77e98.
상태: PMO 상세화 방향을 반영한 **채택 요청본**. 코드·공개 API·미적용 SQL 구현 승인이 아니다. 기존 r1과 후보r2는 보존한다.

## 1. 첫 업무와 실제 한계

첫 업무는 UI14에서 보호참조의 등록·개정·정확 과거 버전 조회·신규 사용 회수를 저장/조회하는 범위다. 실제 설치 자원 공급자가 없는 현재 상태를 명시하고 합성 공급자는 시험에만 주입한다. 실제 대상·키 설정/백업 수집·암호화/job·복원 완료가 아니다.
기존 saveBackupPolicy({policy,reason})와 createBackup({policyRef,sourceSelection,reason}) payload는 변경하지 않으며 이번 단위에서 연결하지 않는다. 기존 선택 문서 반출 /backups와 ProjectBackupsPanel도 불변이다.
사용자 해제형 이식키의 준비/enroll/unlock/recovery-kit은 별도 계약 후보로 남긴다. 실제 키/adapter/Secret·DB 적용·정책/권한 부여·Agent/서비스·PG 복구는 포함하지 않는다.

## 2. 공통 wire

P=/api/v1/projects/:projectId. Ref는 기존 VersionRef 그대로: 소문자 UUID, 양의 안전정수 version, 소문자64자리 contentHash. hash는 기존 canonicalJson/contentHash로 서버가 계산한다. raw SHA 파일지문 표기와 wire 소문자를 혼동하지 않는다.
모든 DTO/query는 추가 필드·부정규 값·비유한 수를 거절한다. 중복 JSON key 거절은 새 조회/명령 경계에서 검증하며 기존 공통 parser의 지원 여부를 별도로 대조한다. 지원하지 않으면 strict라고 허위 보고하지 않는다. 현재 projects/routes.ts의 command 하위 scope가 사용하는 parseWireJson을 재사용하고 새 쓰기 연산을 그 scope 밖에 등록하지 않는다.
문자열은 displayName1~120/ reason1~2000 UTF-16 code unit을 제안하며 trim 후 빈문자·NUL/제어문자를 거절한다. 표시값을 실제 경로/명령으로 사용하지 않는다.
Current={eligible:boolean,reasonCodes:고정 코드 배열,observedAt:UTC}. immutable 상태와 현재 관측을 분리한다. 목록 Page<T>={items:T[],nextCursor:string|null,hasMore:boolean,observedAt:UTC}. 기본50/최대200, cursor4096자/30분을 제안한다.
cursor는 기존 서명 codec를 사용하되 domain/project/actor/client/kind/limit/order/expiry를 필터에 결박한다. 등록시각/id 내림차순; 목록 전체 snapshot은 보장하지 않는다. 잘못된 cursor는400이며 처음부터 성공으로 대체하지 않는다.
모든 조회 no-store. 현재 로그인·활성 프로젝트 OWNER와 민감자료 접근을 검사한다. 조회에는 제어권을 요구하지 않고 변경에는 현재 client/control을 요구하는 새 조회 경계로 명시 채택받는다. 다른 사용자/프로젝트 여부는 기존404 비노출 경계를 보존한다.
원경로·키·설치 내부 handle·비밀값은 응답/로그/Agent 맥락에 넣지 않는다.

## 3. 공개 객체·조회 4개

Resource={ref,kind:TARGET|ENCRYPTION_KEY,displayName,providerProfileRef:Ref,protectionEvidenceRef:Ref,verifiedAt:UTC,current:Current}. ref는 서버 공급 descriptor 전체의 지문이다. 설치 공급자가 이 descriptor를 실제로 제공·검증하지 못하면 자원을 합성하지 않는다.
ReferenceSnapshot={kind,displayName,spec,reason}. kind는 TARGET/ENCRYPTION_KEY/RETENTION/VERIFICATION.
TARGET와 ENCRYPTION_KEY spec={installationResourceRef:Ref}; RETENTION spec={automaticDeletion:false}; VERIFICATION spec={checks:고정검사ID배열,limitsRef:Ref}. arbitrary path/adapter/키 문자열 입력0.
ReferenceView={ref,snapshot:ReferenceSnapshot,previousRef:Ref|null,createdAt:UTC,commandRecordId:UUID,clientCommandId:UUID,operationId:UUID,auditEventId:UUID,current:Current}. 실제 commands/operation/감사 행의 같은 project·원명령·결과 대상 귀속을 확인해 식별자를 반환한다. authorizationReceiptRef는 권한 영수증이며 명령/감사 Ref로 바꾸지 않는다. 본문버전 contentHash는 canonicalJson({projectId,id,version,snapshot,previousRef})의 기존 contentHash로 고정하고 저장/재조회 때 대조한다.

| route | strict 입력 | 응답 |
|---|---|---|
| GET P/backup-resources | kind 필수(TARGET/ENCRYPTION_KEY),limit?,cursor? | {state:CONFIGURED|UNCONFIGURED|UNVERIFIED,page:Page<Resource>} |
| GET P/backup-resources/:id/versions/:version | query 없음 | Resource |
| GET P/backup-references | kind?,limit?,cursor? | Page<ReferenceView> |
| GET P/backup-references/:id/versions/:version | query 없음 | ReferenceView |

공급자 부재 목록은 UNCONFIGURED+빈page이며 실제 구성 완료가 아니다. fixed resource GET은 허가 확인 뒤 없으면404. 실제 공급자·보호증거가 미확인인 TARGET/KEY 저장은412 BACKUP_RESOURCE_PROVIDER_NOT_CONNECTED 또는 KEY_PROTECTION_UNVERIFIED. DPAPI·기존 exportRoot·임의UUID를 공급자로 쓰지 않는다.
RETENTION의 자동삭제OFF 설정만 별도 저장 가능하다. VERIFICATION은 실제 등록 checks/limits 공급 전412 REFERENCE_UNAVAILABLE이다. 저장 성공을 실제 백업 실행 가능으로 승격하지 않는다.
Current의 초기 고정 reasonCodes는 REFERENCE_REVOKED,RESOURCE_PROVIDER_NOT_CONNECTED,RESOURCE_UNVERIFIED,RESOURCE_VERSION_UNAVAILABLE,VERIFICATION_NOT_CONNECTED이다. 새 코드가 필요하면 계약에 명시 추가한다. 검증 불가를 eligible=true로 처리하지 않는다.
정책/job/manifest 조회 route는 이번 단위에 등록하지 않는다. 후속 계약 없이 빈 성공 endpoint를 만들지 않는다.

## 4. 기존 PROJECT 외피의 신규 연산 2개

현재 인증·OWNER·단독 client/controlGeneration·명시 PROJECT 정책·기한·CSRF·정확 command/hash·감사·receipt를 재사용한다. DENY/정책부재 거절. REQUIRE_APPROVAL은 FN11의 실제 검증/소비가 같은 저장 transaction에 연결된 경우만 허용한다. 실제 사용자에게 정책을 자동 부여하지 않는다.

| 연산 | payload | targetId/expectedVersion | receipt data |
|---|---|---|---|
| saveBackupReference | {kind,displayName,spec,reason} | 신규null/0, 개정계열id/현재head.version | {status:REFERENCE_STORED,ref:Ref,previousRef:Ref|null} |
| revokeBackupReference | {referenceRef:Ref,reason} | 참조계열id/현재본문head.version | {status:REFERENCE_REVOKED,ref:회수eventRef,referenceRef:정확대상Ref} |

개정은 같은 kind만 허용하고 새 불변 버전/이전ref를 저장한다. head CAS와 원본/hash·공급자 현재성 확인 후 저장한다.
**회수의 정확 구분:** outer/ActionScope.targetRef는 현재 본문 head 전체 ref, expectedVersion=head.version이다. payloadHash가 실제 회수할 과거/현재 referenceRef를 결박한다. 동일 transaction에서 현재head 잠금·대조, payload exact 원본/hash/project/계열·미회수를 검사한 뒤 불변 회수event를 저장한다. 공통 ActionScope의 targetRef.version=expectedVersion 검사는 완화하지 않는다.
회수 때문에 본문head/version을 개정하지 않는다. 같은 exact 버전의 회수event UNIQUE로 중복을 차단한다. 과거 유효 버전도 신규 사용을 차단할 수 있으며, 기존 백업 복호화 키·과거자료 삭제/사용불가로 자동 확대하지 않는다.
동일 원commandID/동일본문은 현재 접근 재검사 후 기존receipt/event replay로 두번째승인소비0. 같은ID/다른본문409 COMMAND_CONFLICT. 다른commandID로 이미 회수된 같은 exact 버전은409 REFERENCE_ALREADY_REVOKED·새성공event/승인소비0.
head가 바뀐 승인/외피는409 VERSION_CONFLICT; 새head로 명령/승인 재준비한다. currentRef를 조용히 바꾸거나 자동재전송하지 않는다.

## 5. 상태저장·미적용SQL

신규 후보 db/migrations/0050_backup_references.sql.pending (현재빈번호 확인; 작성 직전 재확인). 기존 적용SQL/0043/0044/0049 등 후속정의 불변.
- backup_references: project_id,id,kind,head_version,created_by,created_at. 복합PK/project귀속·head CAS.
- backup_reference_versions: project_id,reference_id,version,snapshot_json,content_hash,previous_version,previous_hash,actor_id,client_id,command_id,created_at. 버전/hash 복합유일성·이전버전FK·UPDATE/DELETE 거절.
- backup_reference_events: project_id,id,reference_id,reference_version,reference_hash,event_kind=REVOKED,reason,actor_id,client_id,command_id,created_at. exact대상FK·동일버전REVOKED UNIQUE·UPDATE/DELETE 거절.
실제 enum/trigger/RLS/권한보호·receipt ref의 행 형식은 위 계약과 현재guard를 대조해 새forward에 작성한다. 오래된 guard 통복사로 다른 승인연산을 잃지 않는다. 원문version/event·감사·receipt·일회승인소비는 같은DB transaction이며 실패시 rollback. 회수 event는 version=1·snapshot_json/content_hash를 저장한다. 정확 event snapshot={eventId,version:1,eventKind:REVOKED,projectId,referenceRef,reason,actorId,clientId,clientCommandId,createdAt}이며 createdAt은 접수 transaction에서 정한 서버 UTC 시각이다. contentHash(canonicalJson(snapshot))로 eventRef={id:eventId,version:1,contentHash}를 만들고 재조회에서 검증한다. 미래 receipt/감사/다른hash는 snapshot에 넣지 않아 순환참조가 없다. 실제migration/GRANT/DML 실행은 별도 경계다.

## 6. 첫 구현 정확 허용파일 후보

기존8: apps/server/modules/access/project-command.ts; apps/server/modules/projects/routes.ts; apps/server/modules/approvals/approval-input.ts; apps/server/modules/approvals/project-approvals.ts; apps/web/src/features/connections/policy-editor-profile.ts; apps/web/src/features/decisions/api.ts; apps/web/src/features/decisions/ApprovalsPage.tsx; apps/web/src/App.tsx.
신규12: contracts/runtime/backup-references-v1.ts; apps/server/modules/backups/backup-resource-provider.ts; apps/server/modules/backups/backup-reference-store.ts; apps/server/modules/backups/backup-reference-routes.ts; apps/web/src/features/backups/backup-reference-api.ts; apps/web/src/features/backups/BackupReferencePanel.tsx; db/migrations/0050_backup_references.sql.pending; tests/unit/FN16/backup-reference-input.test.ts; tests/unit/FN16/backup-reference-store.test.ts; tests/unit/FN16/backup-reference-routes.test.ts; tests/unit/UI14/backup-reference-api.test.ts; tests/browser/UI14/backup-reference.spec.ts.
기존 VersionRef/runtime검증을 재사용하며 catalog/generated-types/생성script변경0. key cache/logout hook·collector/crypto/job/reconcile·기존선택반출·native/OS·실DB는 제외한다. 위 목록은 채택 요청용이며 자체로 write 허가가 아니다.

## 7. 화면·검수·rollback

UI14에는 보호참조 목록·명시 고정버전조회·설치자원 상태·새등록/개정/정확버전 회수 확인을 연결한다. 공급자없음/미확인·빈목록·403/409/412/503을 구분한다. 원명령 buffer/dirty·uncertain·늦은응답/주체ABA를 기존화면 기준으로 보호한다. 결정만으로 실행하지 않고 원명령에 명시 돌아가 재확인한다.
검수: 신규/개정 저장·정확원본재조회·과거버전 회수·head변경CAS·동일명령replay/다른본문충돌·중복회수·정책없음/DENY/승인미결/만료·타project/client/control·공급자부재/위조ref·저장503 atomic rollback. 합성DB/주입provider와 실제App합성API를 분리해 검증한다. 실제DB/공급자·백업/복원 사용 가능은 NOT_RUN/미구현으로 유지한다.
rollback은 소유source후속revert와 미적용SQL 비적용이다. 원문·회수event·키·사본 삭제나 실제정책회수로 해석하지 않는다.

## 8. PMO에 필요한 정확 판단

이 최초 등록/개정/회수/고정조회/UI14의 새계약·코드/화면/미적용SQL/합성검증20경로를 위임범위에서 채택할지 판단 요청한다. 공개route/조회권한과 headCAS+exact대상회수는 r1의 모호함을 좁힌 명시 변경이다. 실제DB/권한/공급자/키/서비스/Agent·OS/PG 실행은 요청하지 않는다. 미채택 상태에서 제품구현하지 않는다.
