# FN16 본인 수신 승인알림·최초 읽음 이력 수집 작업지시서

2026-10-29 / 기존 codex/av3-stage-b / Primary 단독 작성 초안

**목표:** 현재 프로젝트 OWNER 본인에게 저장된 IN_APP 승인요청 알림과 최초 읽음 기록을, 정확한 원요청·명령·receipt·감사 사건의 국소 관계와 함께 수집한다. 알림 조회는 승인 결정·소비·실행이나 권한 복원이 아니다.
**방식:** writing-plans 방식의 TEST_ONLY → Main RED → SOURCE_GO → 집중 검증 → 독립 검수. 현재 허용은 이 문서 한 파일이며 제품/시험 작성 GO는 Main이 별도로 전달한다.
**기준:** docs/WORK_PLAN.md, docs/work_packages/FUNCTION_WORK.md FN16, 기존 내부 inventory 승인 범위. 공개 archive/restore/API 계약이나 새 정책·migration을 만들지 않는다.

## 1. 정확한 후속 허용 경로

신규 3파일만 대상으로 한다.

- apps/server/modules/backups/notification-inventory.ts
- tests/unit/FN16/notification-inventory.test.ts
- tests/unit/FN16/notification-inventory-schema.test.ts

기존 notification writer/parser/reader·approval·AccessRepository·SQL·기존 inventory/시험과 보호 untracked 8은 변경하지 않는다. 실제 DB/RLS/원문 FS/키/서비스/Agent/P03/job·설정 발급·승인 생성/결정/소비·읽음 쓰기는 0이다. Main이 문서 동기화·현황·Git을 담당한다.

## 2. 실제 저장 근거와 경계

- db/migrations/0052_approval_in_app_notifications.sql.pending: notifications 14열, notification_reads 7열, 본인 recipient RLS, 원요청/읽음의 명령·auth receipt·audit 결박과 불변 trigger. pending 파일 존재는 실제 DB 적용 증거가 아니다.
- db/migrations/0011_authorization.sql 및 0011_one_time_approval_requests.sql: 요청 기본 12열+추가 5열, commands/authorization_receipts/audit_events. 승인 후 요청 행의 status/version은 변하지만 request_json은 최초 version=1/status=PENDING 원형이다.
- apps/server/modules/notifications/notification-input.ts: notificationFromRow/notificationRef 순수 검증. 원 알림 hash는 readAt을 제외한 원 DTO 전체이며 recipient의 실제 userId를 포함한다.
- apps/server/modules/notifications/approval-notification-producer.ts: requestApproval과 같은 transaction에서 본인 수신 알림 1개 저장. 현재 정책/기한/용량 검사와 함수 호출은 작성 당시 책임이며 collector에서 재실행하지 않는다.
- apps/server/modules/notifications/project-notifications.ts: read/#verify의 저장 관계, mark의 최초 읽음 insert. mark는 clock_timestamp로 readAt을 얻고 persistProjectReceipt는 transaction_timestamp를 사용한다. 같은 알림의 재호출은 새 receipt가 생겨도 최초 notification_reads.command_id를 변경하지 않는다.
- apps/server/modules/approvals/approval-input.ts의 readApprovalDetails는 순수 구조 검사로만 재사용 가능하다. 기존 read와 같이 역사 client/control 및 now=epoch를 전달하고 현재 정책/현재 만료로 과거 알림을 거절하지 않는다. helper 오류는 내부 자료 무결성 503으로 정규화한다.
- apps/server/modules/access/project-command.ts의 persistProjectReceipt는 원명령 hash·scope digest·receipt/audit 저장의 근거다. 이 쓰기 함수 자체를 호출하지 않는다.

## 3. 인터페이스와 명시 SELECT

`collectNotificationInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<NotificationInventory>`

value는 기존 readDocumentInventoryInput의 projectId/limits만 받는다. 외부 알림 목록·actor/client·원명령·권한·경로를 입력받지 않는다.

| 표 | 명시 허용 열 | 범위·정렬 |
|---|---|---|
| notifications (14) | id,project_id,source_command_id,approval_request_id,request_version,request_content_hash,recipient_user_id,event_kind,channel,severity,reason_code,delivery_state,created_at,content_hash | project_id와 최초 인증 recipient 일치. id UUID keyset ASC, 200행 |
| notification_reads (7) | project_id,notification_id,recipient_user_id,client_id,command_id,notification_content_hash,read_at | 같은 project/recipient. notification_id UUID keyset ASC, 200행. 수집 알림 없는 고아 기록도 감지 |
| approval_requests (17) | id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,created_at,client_id,command_id,policy_ref,content_hash,request_json | 알림의 정확 request ID 집합 ≤200씩, project 일치. id keyset ASC |
| commands (19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | 원 알림 서버 command ID와 최초 읽음 command ID만, project/scope PROJECT 및 requestApproval 또는 markNotificationRead. id keyset ASC |
| authorization_receipts (9) | id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at | 해당 명령의 정확 receipt ID/command ID/project scope만. id keyset ASC |
| audit_events (16) | project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of | 해당 서버 command ID만, project 일치. event_id keyset ASC |

모든 참조 집합 query는 배열 ≤200, 응답 ≤200과 strict keyset 진행을 검증한다. 기존 UI list/read의 LIMIT·현재성·전체행 조회를 우회 호출하지 않고 위 명시 SQL을 작성한다. SELECT */전체 원행 to_jsonb/전체 commands·audit·approval 스캔은 금지한다. 명시 허용 projection CTE의 octet_length와 CASE로 남은 metadataBytes를 초과한 행 본문은 null로 억제하고 고정 한도 오류로 거절한다. bigint 값은 canonical decimal 안전정수만 수용한다.

## 4. 본인 RLS와 현재성

1. 최초 RC authenticated에서 프로젝트 비보관/OWNER 및 유효 DB clock Date를 확인하고 actor/client/credentialGeneration/session을 snapshot한다. 외부 입력 actor를 사용하지 않는다.
2. 별도 자료 transaction은 REPEATABLE READ READ ONLY로 시작한다. **notifications/notification_reads SQL 전에**, 최초 인증 신원을 사용해 기존 조회와 동일한 `SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)`를 실행한다. transaction-local context일 뿐 grant/명령 허가가 아니다. anvil.command_id 설정·RLS 우회·owner DB role 전환은 하지 않는다.
3. SQL WHERE에서도 project/recipient를 제한하고 반환 행을 재검사한다. OWNER여도 타인 알림은 수집하지 않는다. 설정 실패/표·열 미적용/권한 오류는 503이며 빈 성공으로 바꾸지 않는다. RLS가 실제로 올바르게 적용됐는지 합성 시험만으로 증명하지 않는다.
4. 같은 RR에서 읽기 snapshot/isolation/readOnly를 대조한다. 최초/종료 RC는 동일 신원을 SQL 전에 확인하고 현재 OWNER·프로젝트 상태를 다시 확인한다. RR 종료·반납 후 최종 RC, 그 외부 COMMIT 뒤 취소/기한을 다시 검사한다.
5. 각 query 전에 총 deadline 및 관측한 최단 세션 만료의 남은 시간을 statement_timeout에 반영한다. 이전 짧은 만료를 뒤의 긴 값으로 늘리지 않는다. query 후에도 검사한다.
6. BEGIN 전송 시작/확정 성공을 구분한다. BEGIN 응답 유실은 정상 client 재사용 금지. 단발 rollback/release와 오류 반납을 관리하고 회수 불명 503을 취소/기한보다 우선한다. 진행 중 query를 Promise.race로 버려 정상 반납하지 않는다. pool.connect/기존 authenticated 내부 전체 시간을 강제 취소한다고 주장하지 않는다.

## 5. 저장 무결성·역사 보존

### 5.1 알림과 원 요청

- 알림 id/프로젝트/recipient·상수 event/channel/severity/reason/delivery·Date 형식을 검사하고 notificationFromRow/notificationRef로 **실제 recipient가 들어 있는 원 hash부터** 검증한다. 읽음은 별도 행을 정확히 연결해 readAt으로 전달한다.
- 원 요청 id/project/created_by/client/source command 및 notification.eventRef의 requestRef(id/1/hash)를 연결한다. 요청 행의 현재 version은 양의 안전정수, status는 기존 7종 enum으로 기록한다. 행 version을 1로 제한하거나 현재 status를 PENDING으로 강제하지 않는다. 결정/소비에 맞는 현재 version-status 대응을 이번에 새로 판정하지 않는다.
- request_json은 정확 최초 11필드(id,version,status,projectId,details,scopeDigest,requiredDecider,policyRef,requestedBy,controlGeneration,createdAt)이며 version1/PENDING이다. id/version/status/createdAt을 뺀 7필드 snapshot의 canonical hash가 row.content_hash 및 notification.request_content_hash와 같아야 한다.
- snapshot.details/actionScope/requiredDecider/policyRef/requestedBy/controlGeneration/candidateCommandId/expiresAt와 저장 열을 정확 비교한다. scopeDigest는 원 actionScope canonical hash다. requestedBy·requiredDecider·actionScope.requestedSubjectRef는 수신 본인과 원 요청 client에 결박한다. 원 client를 현재 조회 client와 같게 강제하지 않는다.
- row.created_at, request_json.createdAt, 알림 occurredAt은 같은 요청 사건으로 일치해야 한다. 원 command receipt의 request/ref/프로젝트/target/version/APPLIED·APPROVAL_REQUESTED도 정확 일치한다. 기존 producer의 같은 사건 completed_at/serverReceivedAt은 원 요청 시각과 일치한다.

### 5.2 최초 읽음

- reads의 composite 키/command_id 유일성, 본인 recipient/project, exact notification hash, 유효 readAt 및 기존 `readAt >= occurredAt`을 검사한다. 고아/중복 reads는 거절한다.
- 최초 reads.command_id에만 연결한다. 같은 알림을 다시 읽어 생긴 다른 mark receipt를 최신으로 찾거나 최초 이력을 덮지 않는다. 전체 반복 읽음 명령 이력은 NOT_COLLECTED다.
- mark 명령은 target notificationRef, expectedVersion1, APPLIED, 본인 actor/reads.client, scope PROJECT/project, 유효 control/policy와 결박한다. payload_ref와 approval_consumption_id는 null이다.
- 원명령 canonical hash는 `{schemaVersion:1,projectId,commandId:commands.command_id,clientId:commands.client_id,controlGeneration,operation:'markNotificationRead',targetId:notification.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{notificationRef}}`로 재구성한다.
- receipt.data는 정확 ref/status=NOTIFICATION_READ/readAt이며 readAt은 reads.read_at의 ISO와 같다. **readAt을 receipt.serverReceivedAt/completed_at/authorized_at/recorded_at과 같게 강제하지 않는다.** receipt.serverReceivedAt와 command.completed_at 같은 명령 기록의 일치는 유지한다. 서로 다른 사건의 시각 대소·감사순번을 임의로 추가하지 않는다.

### 5.3 명령·허가 receipt·감사 국소 증거

- 서버 commands.id와 사용자 요청 commands.command_id를 구분한다. 원 요청과 최초 읽음에 각각 명령 1개, 정확 authorization receipt 1개, 감사 사건 1개가 필요하다. 잘못된 project/scope_id/operation/state/actor/client/operationId·중복/누락은 실패한다.
- 원 requestApproval 명령은 expectedVersion0, payload_ref/approval_consumption_id null이며 저장 policy/control 및 receipt ref가 요청과 같다. 일반 receipt 닫힌 10필드, 빈 evidenceRefs/warnings, 유효 timestamp를 검사한다.
- authorization_receipts는 정확 id/command_id, PROJECT/scope_id, policy, subject={HUMAN,원 actor/client}, approval_decision_ref=null을 대조한다. scope_digest는 `{projectId,actorId,clientId,controlGeneration,requestHash:commands.request_hash,policyRef,targetRef}`의 canonical hash다. targetRef는 원 요청/읽음 각각의 exact ref다.
- audit는 server command/operationId, actor/client, target/policy, approval_ref=null, outcome=APPLIED, source_kind=HUMAN_COMMAND, reason_code가 원 요청 EXPLICIT_ONE_TIME_APPROVAL_REQUEST 또는 읽음 EXPLICIT_NOTIFICATION_READ, 같은 scope digest와 일치한다. correction_of=null, 유효 날짜 및 고유 양의 server_sequence를 확인한다. 전체 감사 chain은 검증하지 않는다.
- requestApproval의 전체 request_hash preimage는 이번 범위에서 재구성하지 않는다. 0052 origin 함수는 saveWorkPlanDraft/activateDesignChange의 candidatePayload를 별도 표에서 읽기 때문이다. 해당 후보 원문을 추가 수집하거나 details-only 명령으로 잘못 재계산하지 않는다. 원 request snapshot/hash·receipt·scope digest 결박과 구분해 `originCommandPreimageVerification:NOT_PERFORMED`로 명시한다. mark의 재구성 성공을 원 승인 전체 검증으로 승격하지 않는다.
- 현재 policy/현재 source/현재 승인 결정·소비를 조회·재실행하지 않는다. auth receipt id/scope digest는 역사 증거이며 복원 가능한 실행 권한이 아니다.

## 6. 반환·익명화·한도

`kind:NOTIFICATION_INVENTORY_V1`, `scope:OWN_APPROVAL_IN_APP_NOTIFICATIONS_AND_FIRST_READS_ONLY`.

- projectId, notifications[], issues[], externalDependencies[] 및 observation/usage.
- notification 항목은 원 ref·원 event/target·severity/reason/delivery/occurredAt, recipient={kind:HUMAN}, 원 요청 ref와 익명 request snapshot, observedRequestState={version,status}, 최초 read 또는 null, 원요청/읽음 audit 순번·역사 auth receipt ref를 보존한다. 최초 read에는 readAt과 익명 reader={kind:HUMAN}을 둔다.
- 요청은 reason/risks/rollback/기한/원 target·baseline·scope 해시 등 역사 의미를 보존하되 requestedBy·requiredDecider·actionScope.requestedSubjectRef의 userId/clientId를 제거해 `{kind:HUMAN}`으로 투영한다. 원 actionScope/snapshot hash는 익명 내용으로 다시 계산해 덮지 않는다. 원 commands/auth/audit 행이나 실행 가능한 원명령 객체는 반환하지 않는다.
- notification.projectionHash는 자신의 projectionHash를 제외한 전체 익명 notification 항목의 canonical hash다. 전체 contentHash는 정확 `{projectId,notifications,issues,externalDependencies}` 4필드 canonical hash이며 observation/usage는 제외한다.
- 외부 target/baseline/policy ref와 auth receipt는 exact 역사 참조로만 분류한다. ID-only 후보 command를 가짜 VersionRef로 만들지 않는다. 현재 승인 결정·소비·후보 원문 검증이 빠졌음을 issues에 명시한다.
- 모든 보존 문자열·JSON/ref 투영에 알려진 민감 표식을 검사한다. user/client/session/token·원 SQL/오류/cause·내부 경로는 출력하지 않는다. 이유 등 자유 문장 속 모든 개인정보를 자동 익명화한다고 주장하지 않는다. 알려진 표식 탐지는 완전 탐지가 아니다.
- SQL row_bytes 누적과 최종 canonical UTF-8 metadataBytes를 각각 제한하고 usage 자기 자리수를 포함해 유한 반복으로 크기를 고정한다. fileCount/inputBytes=0. 빈 목록도 OWNER/현재성/관측을 끝까지 확인한다.
- `otherRecipients,notificationSettings,repeatedReadCommands,approvalDecisionHistory,approvalConsumptionHistory:NOT_COLLECTED`.
- `originCommandPreimageVerification,policyVerification,approvalBindingVerification,auditChainVerification,blobVerification:NOT_PERFORMED`.
- `fullProjectCoverage,restorable,executionAuthorized,dispatchPerformed,atomicSnapshotVerified:false`; `executionEvidence:NOT_CONNECTED`. metadataComplete는 미수집 증거/외부 의존이 있으면 false이며 전체 백업 완료가 아니다.
- 오류: 입력400, AUTH_REQUIRED401, NOT_FOUND404, NOTIFICATION_INVENTORY_CANCELLED409, DEADLINE/LIMIT413, INTEGRITY_FAILED/STORAGE_FAILED/SENSITIVE_METADATA503. DB/helper 원오류를 고정 표면으로 바꾸며 회수 실패는 503이다.

## 7. 실행·검수 순서와 핵심 반례

- [ ] 실제 schema 열과 producer를 먼저 대조하고 위 신규 행동/schema 시험만 작성한다. import 부재를 PASS로 숨기지 않는다.
- [ ] Main RED: `node --test tests/unit/FN16/notification-inventory.test.ts tests/unit/FN16/notification-inventory-schema.test.ts`.
- [ ] Main SOURCE_GO 후 신규 source 한 파일만 구현한다. 실제 RLS GUC와 명시 SELECT 구조를 합성 DB가 관측한다. 실제 RLS 통과라고 보고하지 않는다.
- [ ] 동일 신규 시험, `npm run typecheck`, `git diff --check`의 개별 exit/지문/미검증을 제출한다. 완료된 다른 자료군 전체 검사는 반복하지 않는다.
- [ ] 독립 검수는 명시 열·본인 scope/GUC 순서·원 hash/익명화·mutable request 관측·최초 읽음·명령/auth/audit·회수 경계를 실제 writer와 대조한다. Main이 fresh 검증·기록·게시한다.

필수 사례는 하나의 실제 논리 자료군에 집중한다: 빈 목록; 읽지 않은 요청과 최초 읽음; 원 request_json은 PENDING/v1이나 현재 요청은 APPROVED/CONSUMED; 과거 요청/읽음 client가 현재 조회 client와 다른 정상; readAt이 receipt보다 늦거나 서로 다르되 occurredAt 이상인 정상; 재읽음의 새 receipt를 수집하지 않고 최초 command 유지; 201행 paging; GUC가 없거나 다른 actor이면 자료 SQL 차단; 타 project/recipient·고아 reads·request ref/hash·receipt/command ID 혼동·auth scope digest/audit 귀속 변조; readAt<occurredAt; mutable version을 원 ref에 섞는 오류; 민감 reason/metadata·SQL 거대row·표 미적용·한도; OWNER 회수/세션 ABA/최단 세션 만료·최종 COMMIT 뒤 취소/기한·BEGIN/rollback/release 불명.

원 승인 candidate payload·현재 정책·승인 결정/소비 표를 읽지 않는지 fake query allowlist로 확인한다. 원 알림 hash와 익명 projectionHash는 다른 값이며 두 계산 범위를 독립 확인한다. 실제 DB/RLS·운영 조회·백업/복원·UI 연결은 NOT_RUN이다. rollback은 신규 source/test의 검토 revert이며 기존 알림/읽음 데이터 삭제가 아니다.
