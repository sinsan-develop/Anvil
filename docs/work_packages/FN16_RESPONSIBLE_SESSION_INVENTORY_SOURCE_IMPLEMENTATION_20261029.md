# FN16 책임 역할·예약 세션·binding 이력 수집 작업지시서 초안

2026-10-29 / codex/av3-stage-b / **Main 검토 전·구현 GO 아님**

**목표:** 역할 정의와 예약 세션, 같은 세션에서 이어진 binding 전체 버전 및 AUTO/일회승인 원 증거를 한 업무 단위로 보존한다. 예약·과거 승인 이력을 현재 실행 허가로 승격하지 않는다.
**방법:** writing-plans 방식의 정확 경로·실제 producer 대조·Primary 연속 TDD RED→GREEN→Main 집중 검증·독립 검수. 구현 시 executing-plans를 적용하며 Main의 단일 writer 지시를 유지한다.
**기술/기준:** 기존 Node 24/TypeScript/pg/canonical, WORK_PLAN/FUNCTION_WORK FN16. 기존 직접 승인 안의 내부 metadata 수집이며 공개 API·schema·정책·runtime 연결을 추가하지 않는다.

## 1. 범위와 공통 경계

현재 쓰기는 이 문서 하나다. Main GO 이후 신규 허용 경로는 다음 3개뿐이다.

- apps/server/modules/backups/responsible-session-inventory.ts
- tests/unit/FN16/responsible-session-inventory.test.ts
- tests/unit/FN16/responsible-session-inventory-schema.test.ts

기존 source/helper/SQL/시험/보호 untracked8, 실제 DB/FS/키/서비스/Agent/P03/job·설정·Primary Git 쓰기 0. Main은 정본 동기화·현황·통합을 담당한다.

공통 접근·유한 한도·오류·회수는 FN16_ASSIGNMENT_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §2·3·6·7 및 그 참조 공통 WI를 적용한다. 현재 OWNER의 시작/종료 RC, 동일 신원·최단 세션기한, 단일 RR READ ONLY, query별 남은 timeout, 외부 COMMIT 뒤 취소/기한, BEGIN 응답 불명 client 정상 재사용 금지, 회수 실패 우선503을 유지한다. 무제한 query를 Promise.race로 취소했다고 주장하지 않는다. 기존 collector 전체 호출은 하지 않는다.

## 2. 실제 근거·함수·명시 열

- db/migrations/0016_execution_preparation.sql: 세 불변 표·예약 상태·원 receipt·버전 계보.
- db/migrations/0049_responsible_session_one_time_approval.sql.pending: 기존 표의 AUTO/일회승인 분기, 최초 session/binding 공유 명령과 완결성. 실제 적용 증거가 아니며 이 작업에서 SQL 적용 0.
- apps/server/modules/assignments/responsible-sessions.ts: define/bind 및 원 snapshot/요청. readProjectRole/readResponsibleSessionBinding의 순수 입력 검증만 재사용한다. readRole/readBinding/currentStage/current/connection read를 호출하지 않는다.
- apps/server/modules/approvals/project-approvals.ts request/decide/#history 및 approval-input.ts, 0011_authorization.sql·0011_one_time_approval_requests/decisions/consumption.sql: 선택된 원 승인 증거. 현재 authorize/read/consume 및 후보 현재성 함수를 호출하지 않는다.
- apps/server/modules/access/project-command.ts persistProjectReceipt: 원 명령·auth/audit 결박. 0013_assignment_confirmation.sql의 정확 확정 임무 원형을 선택 조회한다.

`collectResponsibleSessionInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<ResponsibleSessionInventory>`

입력은 readDocumentInventoryInput의 projectId/limits뿐이다. 외부 role/session/binding 배열, actor/client, 원문 경로, 실행 설정을 받지 않는다.

| 표 | 명시 허용 열 | 조회·정렬 |
|---|---|---|
| project_roles (9) | project_id,role_id,version,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체, role_id UUID ASC |
| agent_sessions (10) | project_id,session_id,version,role_id,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체, session_id UUID ASC |
| role_bindings (13) | project_id,binding_id,version,role_id,session_id,assignment_id,assignment_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체, (binding_id UUID,version bigint) ASC |
| assignment_versions (선택 7) | project_id,assignment_id,version,content_hash,version_json,created_by,created_at | binding.assignmentRef exact 집합만 |
| approval_consumptions (8) | id,project_id,decision_id,command_id,scope_digest,policy_id,policy_version,consumed_at | 역할/binding의 서버 command ID 집합만; AUTO의 불법 추가 행도 검출 |
| approval_decisions (14) | id,project_id,request_id,request_version,scope_digest,decision,reason,decided_by,client_id,control_generation,decided_at,command_id,content_hash,decision_json | 소비가 참조한 exact ID만 |
| approval_requests (17) | id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,created_at,client_id,command_id,policy_ref,content_hash,request_json | 결정이 참조한 exact ID만 |
| commands (19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | 역할/binding 및 선택 승인 요청·결정의 exact 서버 ID만 |
| authorization_receipts (9) | id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at | 선택 command의 exact authorization_receipt_id만 |
| audit_events (16) | project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of | 선택 command ID만, event_id UUID ASC |

전체 표는 200 keyset, 보조 집합은 최대200씩 같은 RR에서 읽는다. 명시 projection CTE/row_bytes/CASE, 엄격 증가·고아/중복/누락·선택 집합 검사를 유지한다. SELECT *·OFFSET·최신200 제한·다른 프로젝트 fallback 0. bigint canonical decimal 안전정수 및 JSON timestamp의 유효성/밀리초 정규화를 적용한다. 표/열 부재는503이며 빈 이력으로 숨기지 않는다.

## 3. 역할·세션·binding 국소 관계

1. 원 ref는 각 행 id/version 및 canonical(snapshot_json) hash다. 0016/0049가 실제 제한하는 각 snapshot 2MiB를 지키며 원형을 검사한 뒤 익명 투영한다.
2. 역할 snapshot은 정확6필드: kind,stageRef,parentRoleRef,reason,definedBy,definedAt. 앞4필드는 readProjectRole로 검사한다. version1, definedBy는 원 행 actor다. COORDINATOR는 stage/parent null·프로젝트 내 최대1개; STAGE_OWNER는 exact stage/application/node와 같은 수집 안의 COORDINATOR parentRef를 가진다. 동일 stage 중복·고아 parent를 거절한다. 현재 적용 방법론 여부는 다시 판단하지 않는다.
3. 세션 snapshot 정확6필드: roleRef,connectionRef,state,externalSessionHandleRef,reservedBy,reservedAt. version1, 내부 role exact, RESERVED/null, 원 actor·같은 사건 시각. role당 세션1개이며 조회된 세션에는 첫 binding이 반드시 있다.
4. binding snapshot 정확14필드: assignmentRef,roleRef,connectionRef,existingSessionBindingRef,reason,sessionRef,generation,state,externalSessionHandleRef,connectionReadiness,executionAuthorized,dispatchPerformed,boundBy,boundAt. 원 앞5필드를 readResponsibleSessionBinding으로 검사한다. RESERVED/null/CANDIDATE_ONLY/false/false를 보존한다. generated assignment_id/version과 snapshot ref, role_id/session_id도 일치해야 한다.
5. role별 binding_id 하나, 버전/generation 1..N 연속. v1 previous=null, 후속은 직전 전체 ref. role/session/connectionRef는 같은 계보에서 유지하며 임무 ref는 원 producer처럼 변경 가능하다. 서로 다른 역할의 binding/session 혼합은 거절한다.
6. **최초 session과 binding v1은 같은 서버 command를 공유한다.** 그 명령 receipt의 target/ref는 session이 아니라 binding v1이다. data.snapshot.sessionRef가 세션 원 ref와 같고 actor/client/예약 시각도 공유한다. 후속 binding은 새 명령이며 새 세션 행을 만들지 않는다. define 명령은 역할1개·binding/session0개, bind 명령은 binding1개·최초 session1개 또는 후속0개여야 한다. 정상 공유를 중복 명령 오류로 세지 않는다.
7. 선택 assignment 원문 hash/정확 ref·확정 snapshot 형식/confirmedBy/confirmedAt을 검사하고 contentConfirmed=true, executionAuthorized/dispatchPerformed=false, definition.parentAssignmentRef=null을 요구한다. STAGE_OWNER의 applicationRef/nodeId는 실제 definition.taskRef와 같다. 원 draft/검토·확정 명령 전체는 재수집하지 않고 그 증거 검증은 NOT_PERFORMED로 표시한다. 현재 head/draft basis/현재 준비 적합성은 확인하지 않는다.
8. 국소 논리선후는 audit sequence로 parent 역할→자식 역할, 역할→첫 binding, 직전 binding→다음 binding을 대조한다. 세션은 첫 binding과 같은 감사 사건이다. 같은 사건의 행·snapshot·receipt·completed_at은 일치하지만 거래 간 timestamp 단조는 추가하지 않는다.

## 4. 원 요청·AUTO·일회승인 증거

역할 요청은 defineProjectRole/null/0/payload4, binding은 bindResponsibleSession/previous?.id/previous?.version 또는 null/0/payload5다. 최상위 baselineRefs=[]이며 승인 ref만 아래 분기로 결정한다. 원 요청 schemaVersion/projectId/사용자 commandId/client/control/operation/target/expected/baseline/approval/payload를 재구성하여 request_hash와 대조한다.

각 distinct 서버 명령의 PROJECT/scope_id/project/APPLIED·actor/client·정확 receipt/ref/snapshot·auth/audit는 공통 WI처럼 검사한다. 역할 status/reason은 PROJECT_ROLE_DEFINED/EXPLICIT_PROJECT_ROLE, binding은 RESPONSIBLE_SESSION_RESERVED/EXPLICIT_SESSION_RESERVATION_ONLY다. `(project_id,actor_id,사용자 command_id)`는 모든 distinct 역할/binding/승인 명령 사이에서 유일하다. operation을 유일키에 넣지 않는다. 공유 세션 명령은 동일 증거 한 번만 검사한다.

**AUTO**: command.approval_consumption_id/payload_ref=null, 선택 consumption0, auth.approval_decision_ref 및 audit.approval_ref=null, 원 approvalRef=null. 당시 정책 AUTO 적합성/현재 permission을 재실행하지 않는다.

**일회소비**:

- command당 consumption 정확1건, id=command.approval_consumption_id, command_id=서버 command.id. decision은 APPROVE/request_version1, request의 저장 현재 상태 CONSUMED/version3과 불변 request_json의 PENDING/version1을 구분한다. mutable 상태를 원 hash에 넣지 않는다.
- request hash는 request_json에서 id/version/status/createdAt을 뺀 원7필드, decision hash는 decision_json에서 id/decidedAt을 뺀 원9필드다. 행/원 JSON/ref·내용·원 actor/client/control/policy·시각을 대조한다.
- request.details의 닫힌 원형/위험/rollback/기한과 actionScope를 검사한다. readApprovalDetails를 재사용할 때 현재 시각이 아닌 형식 검증 기준(new Date(0))을 쓰고 당시 consume 기한은 별도 검사한다. actionScope hash=scopeDigest, payloadHash=원 역할/binding payload hash, candidateCommandId=실행 사용자 commandId, targetRef=previous/null, expected/control/subject/baseline 정확 일치. 원 payload가 있으므로 후보 preimage를 가짜로 만들지 않는다.
- requiredDecider 및 requestedBy/decidedBy는 원 실행 actor/client와 일치한다. consumption의 decisionId/scopeDigest/policyId/version 및 command.payload_ref={kind:ONE_TIME_APPROVAL_SCOPE,payloadHash,scopeDigest}, auth 결정 ID/audit approvalRef={requestId,decisionId,scopeDigest}를 정확 대조한다. 소비 시각은 실제 기존 검사대로 decidedAt 이상·expiresAt 미만이다. 현재 만료됐다는 이유로 과거 소비를 거절하지 않는다.
- 승인 요청/결정 원 command도 선택한다. requestApproval의 payload={details},targetnull/expected0,baseline[]/approvalnull, APPROVAL_REQUESTED/EXPLICIT_ONE_TIME_APPROVAL_REQUEST. decideApproval의 payload={requestId,expectedVersion:1,scopeDigest,decision:APPROVE,reason},targetrequestId/expected1,baseline[]/approvalnull, APPROVAL_DECIDED/EXPLICIT_HUMAN_APPROVAL_DECISION. 정확 원 요청 hash와 receipt/auth/audit를 같은 방식으로 검증하며 두 명령 자체의 소비/payload_ref는 null이다. 요청 감사→결정 감사→역할/binding 감사의 논리 순서를 대조한다.
- request/decision/consumption ID를 권한으로 복원하거나 재소비하지 않는다. 현재 policy·control·candidate·승인 권한 검사와 전체 승인 이력 coverage는 NOT_PERFORMED/NOT_COLLECTED다.

## 5. 반환·민감정보·미수집

내부 kind=RESPONSIBLE_SESSION_INVENTORY_V1, scope=PROJECT_RESPONSIBLE_SESSION_HISTORY_ONLY. roles/sessions/bindings와 선택 approvals의 익명 역사 투영, 원 ref/hash, 투영별 projectionHash, externalDependencies, 기존 observation/usage/verification을 반환한다. 전체 inventoryHash는 canonical `{kind,projectId,roles,sessions,bindings,approvals,externalDependencies}` 7필드만 대상으로 하며 시간/usage를 포함하지 않는다.

원 hash·명령 증거는 익명화 전에 검증한다. 정의/예약/결박/승인 이유·위험·rollback은 보존하되 actor/client 식별 원문은 내보내지 않는다. definedBy/reservedBy/boundBy/requestedBy/requiredDecider/decidedBy/requestedSubjectRef는 HUMAN·REDACTED 표식으로 투영하고 원 request/receipt/auth/audit JSON을 반환하지 않는다. 민감 표식·잘못된 메타자료는 고정503으로 거절하며 오류 cause/경로/토큰을 노출하지 않는다.

connectionRef는 exact 외부 참조만 남긴다. connection 후보 원문, provider 보호참조·host/키/credential·external session handle, source 경로는 조회/출력하지 않는다. applicationRef/assignmentRef/connectionRef/policyRef와 선택 승인 refs는 역사 의존성으로 분류하며 현재 사용 권한 증명으로 표시하지 않는다. 전체 assignment/approval·provider/실행 이력은 미수집이다.

currentConnectionVerification/currentPolicyVerification/assignmentEvidenceVerification=NOT_PERFORMED, executionAuthorized=false, dispatchPerformed=false, fullProjectCoverage=false, restorable=false. 원문 FS/DB 실제/RLS·0049 적용·사용자 백업 UI/실행·복원은 NOT_RUN. 현재 통합 호출선은 추가하지 않는다.

## 6. 한 업무 단위의 연속 TDD와 완료 기준

- [ ] 행동/schema 시험 작성. COORDINATOR+STAGE_OWNER·미결박 역할·초기공유 session/binding·후속 임무변경·과거 다른 actor·AUTO/일회소비·현재 만료된 승인 역사·201 pagination·거래 시각 역전 정상.
- [ ] 중요 음성: role/session/assignment/previous exact 손상·고아/중복·최초 공유 명령 누락/후속 불법 session·잘못된 stage/child assignment·원 hash/요청·auth/audit/approval consumption ID/subject/payload/기한 손상·교차 operation 사용자명령 재사용·논리 감사역전. 원 증거 재결박으로 해당 관계까지 도달하도록 한다.
- [ ] OWNER/세션 교체·종료 COMMIT 뒤 취소/기한·거대 row/누적 한도·민감 메타·BEGIN/release/회수 오류 핵심을 확인한다. schema 시험은 명시열·선택조회·순수 read 경계와 실제 열을 대조한다. 이미 완료된 collector 전수 반복 0.
- [ ] Main GO 뒤 Primary가 신규 source 부재 RED를 실제 실행·기록하고 같은 담당자가 신규 source GREEN까지 이어간다. 시험 기대를 제품에 맞춰 완화하지 않는다. fixture 오류는 실제 producer 근거/전후 diff를 보고한다.
- [ ] `node --test tests/unit/FN16/responsible-session-inventory.test.ts tests/unit/FN16/responsible-session-inventory-schema.test.ts`, `npm run typecheck`, `git diff --check` 각 exit/result·3파일 hash·diff·미검증을 제출한다. Main 집중 재검증·독립 C/I 검수 뒤 통합한다.

실행하지 않은 실제 DB/파일/키/서비스 검증을 PASS로 세지 않는다. rollback은 신규3파일의 해당 branch 변경만 되돌리는 source 범위이며 실제 데이터 rollback은 없다. 다음 자료군 문서/정책/runtime는 이 WI에 추가하지 않는다.
