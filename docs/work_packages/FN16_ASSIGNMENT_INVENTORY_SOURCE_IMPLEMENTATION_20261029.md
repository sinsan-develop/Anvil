# FN16 임무 초안·내용검토·별도확정 이력 수집 작업지시서 초안

2026-10-29 / codex/av3-stage-b / **미검토·구현 GO 아님**

**목표:** 프로젝트 임무의 초안 전체 버전, 내용검토, 별도확정과 부모 임무 계보를 원 참조·이유·미진 상태와 함께 보존한다. 현재 실행 준비나 권한으로 재판정하지 않는다.
**방법:** writing-plans 기준의 정확 경로·실제 producer 대조·Primary 연속 TDD RED → GREEN → Main 집중 검증·독립 검수. 기존 collector 공통 경계는 참조하고 임무 고유 관계만 추가한다.
**기술/기준:** 기존 Node 24/TypeScript·pg·canonical/pure parser, docs/WORK_PLAN.md 및 docs/work_packages/FUNCTION_WORK.md FN16. 공개 API·schema·권한·실행 계약을 추가하지 않는 내부 metadata 수집이다.

## 1. 허용 파일과 책임

현재 쓰기는 이 문서 한 파일뿐이다. Main 검토·GO 후 신규 구현 경로는 정확 다음 3개다.

- apps/server/modules/backups/assignment-inventory.ts
- tests/unit/FN16/assignment-inventory.test.ts
- tests/unit/FN16/assignment-inventory-schema.test.ts

기존 source/helper/SQL/시험/보호 untracked 8은 변경하지 않는다. 실제 DB/FS/원문/키/서비스/Agent/P03/job·설정 발급·Primary Git 쓰기 0. Main이 정본 동기화·현황·통합을 담당한다. 자료군 누락 보완과 사용자 백업 기능 연결을 구분한다. 이 단위는 createBackup/정책·전체 coverage·archive/restore를 연결하거나 완료하지 않는다.

## 2. 실제 근거와 호출 경계

- db/migrations/0012_assignment_drafts.sql: 초안 head/불변 버전 및 prepareAssignment 원 요청·receipt.
- db/migrations/0013_assignment_confirmation.sql: 내용검토/확정 및 원 명령·snapshot 정합.
- db/migrations/0034_assignment_parent_drafts.sql: 정확 확정 root 부모·자식 제약과 child draft-only 경계. 새 표는 없다.
- apps/server/modules/assignments/project-assignment-drafts.ts: save/#basis/#parent의 snapshot·부모 관계. 현재 plans/application/parents.decision을 호출하지 않는다.
- apps/server/modules/assignments/project-assignment-confirmations.ts: review/confirm/#reviews의 원형과 당시 선택 검토 조건. current/decision/현재 latest를 호출하지 않는다.
- assignment-input.ts의 readAssignmentDraftInput, assignment-confirmation-input.ts의 readAssignmentContentReview/readAssignmentConfirmation 및 source-scope-containment.ts의 inspectSourceScopeContainment는 실제 확보한 원형의 순수 검증에만 재사용한다. 다른 원문을 만들어 유효성 검사를 통과시키지 않는다.
- apps/server/modules/access/project-command.ts persistProjectReceipt: 원 command/auth/audit 결박. 실제 실행·policy/승인 재검증은 하지 않는다.

공통 규칙은 FN16_RESULT_REVIEW_HISTORY_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §3·6·8의 명시 projection, exact 증거 조회, RC/RR·한도·회수를 적용한다. 그 문서의 결과 자료군별 의미/반환은 이 문서로 대체하며 기존 결과 collector 자체는 호출하지 않는다.

## 3. 함수와 명시 조회

`collectAssignmentInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<AssignmentInventory>`

readDocumentInventoryInput(projectId/limits)만 받는다. 외부 임무 배열·actor/client·파일경로·실행 설정을 받지 않는다. 현재 OWNER 양끝 RC와 단일 RR READ ONLY를 사용한다.

| 표 | 명시 허용 열 | 선택/정렬 |
|---|---|---|
| assignment_drafts (7) | project_id,id,head_version,created_by,client_id,created_at,updated_at | 프로젝트 전체, id UUID ASC |
| assignment_draft_versions (9) | project_id,draft_id,version,content_hash,version_json,created_by,client_id,command_id,created_at | 프로젝트 전체, (draft_id UUID,version bigint) ASC |
| assignment_content_reviews (11) | project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id,created_at | 프로젝트 전체, review_id UUID ASC |
| assignment_versions (10) | project_id,assignment_id,version,content_hash,version_json,created_by,client_id,command_id,confirmation_id,created_at | 프로젝트 전체, (assignment_id UUID,version bigint) ASC |
| commands (19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | 세 불변 자료의 exact 서버 command ID 집합만 |
| authorization_receipts (9) | id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at | 선택 command의 exact authorization_receipt_id만 |
| audit_events (16) | project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of | 선택 command의 exact ID만, event_id ASC |

LIMIT 200 keyset과 엄격 증가·중복·선택 집합·누락 검사, UUID/숫자 비교를 적용한다. 보조 ID 집합도 최대 200씩 조회한다. 명시 열 CTE와 row_bytes/CASE로 거대 행 본문을 SQL에서 억제하고 raw fallback을 두지 않는다. SELECT *·전체 command/audit 스캔·OFFSET·최신 200행만 수집 금지. JSON timestamp 문자열은 유효성 검사 후 밀리초 정규화, bigint는 canonical decimal 안전정수만 수용한다. 표/열 미지원·누락은 503이며 빈 결과로 숨기지 않는다.

## 4. 초안 전체 버전과 부모 계보

### 4.1 초안 원형

- head와 버전은 정확 project/id로 묶는다. 버전은 1..head_version 연속이며 고아 head/version을 거절한다. v1 previousRef=null, 후속은 같은 draft_id의 정확 직전 원 ref다. head의 created_by/client_id/created_at은 v1, updated_at은 head 버전의 같은 사건 시각과 대조한다. 다른 사건 간 시각 대소를 요구하지 않는다.
- version_json은 정확 9필드: definition,reason,previousRef,basis,readinessIssues,status,ready,executionAuthorized,dispatchPerformed. 원 ref={id:draft_id,version,contentHash:hash(원 version_json)}. status=DRAFT, 세 boolean=false.
- `{baseRef:previousRef,definition,reason}`를 readAssignmentDraftInput에 전달해 원 입력의 형식/비밀 표식·유한 크기를 검사한다. 불완전 초안의 빈 문자열/목록/allowedScopes는 기존 parser가 허용하는 대로 보존하고 확정 기준을 모든 초안에 강제하지 않는다.
- basis는 정확 planRef,applicationRef,designRef,taskCode,nodeId,taskCardHash 6필드다. definition.taskRef의 planRef/applicationRef/taskCode/nodeId와 대응하고 taskCardHash는 유효 hash다. 현재 plan/task/application 또는 외부 설계 원문으로 재계산하지 않는다.
- definition.baselineRefs는 원 basis의 planRef/applicationRef/designRef 안에 있어야 한다. readinessIssues는 pure 분석 결과의 원 순서에, basis.designRef가 baselineRefs에 없을 때 writer가 추가한 BASELINE_REFERENCE_MISSING/baselineRefs를 결합한 정확 배열이다. taskCardHash 원문 진위/현재 적용 적합성은 NOT_PERFORMED다.

### 4.2 부모의 실제 원문 국소 비교

- definition.parentAssignmentRef=null은 root 초안이다. nonnull은 이번 수집 안의 정확 assignment_versions 확정 ref여야 하며 자기 id 금지, 해당 부모의 parentAssignmentRef는 null이다. 부모 원문 누락/다른 프로젝트/잘못된 hash를 외부 미확인으로 낮추지 않는다.
- 같은 자식의 모든 버전은 parentAssignmentRef를 유지한다. 부모의 현재 head 여부는 검사하지 않는다.
- child/parent taskRef의 planRef/applicationRef/nodeId, environmentRef/budgetRef/recordingPolicyRef가 같아야 한다. taskCode 동일은 강제하지 않는다. child.baselineRefs는 부모 exact refs의 부분집합, child.requiredCapabilities는 부모 문자열의 부분집합이다.
- child.allowedScopes가 비어 있지 않으면 실제 두 원문으로 inspectSourceScopeContainment(parent.allowedScopes,child.allowedScopes).scopeContained=true를 요구한다. 빈 child scopes는 불완전 초안으로 보존한다. 이 검사는 source 참조/targets의 정확 부분집합이며 WRITE→READ 추정·경로 대소문자 동등성·실제 OS/권한 검증이 아니다.
- child는 초안만 허용하므로 그 자식 draft를 대상으로 한 review/confirmation은 거절한다. 부모의 현재 검토/현재 권한/OS 상태를 다시 조회하지 않는다.

## 5. 내용검토·부분 확정의 역사

### 5.1 내용검토

- review ref는 review_id/version1/원 review_json hash다. snapshot 정확 8필드: draftRef,criteriaVersion,items,outcome,reason,reviewedBy,reviewedAt,independence. 앞 5필드로 readAssignmentContentReview를 호출한다.
- row draft_id/draft_version/draft_hash는 snapshot.draftRef와 같고 정확 내부 초안 버전에 연결된다. reviewedBy={kind:HUMAN,userId:row.created_by}, independence=NOT_CLAIMED. reviewedAt·row.created_at·원 receipt/command 완료는 같은 사건 시각이다.
- parser의 6 criteria/항목 형식 및 ACCEPTED일 때 전 항목 ACCEPTED 조건을 유지한다. REWORK/BLOCKED/NOT_EXECUTED 원형과 증거 refs·이유를 보존한다. 현재 조회 OWNER와 과거 작성자가 다른 것을 거절하지 않는다. sameAuthor는 원 검토자와 해당 초안 버전 작성자 비교 후 익명화한다.

### 5.2 별도확정

- 확정 ref는 assignment_id/version/원 version_json hash다. id/version은 원 draftRef와 같아도 hash는 별도 확정 snapshot hash다. confirmation_id는 별도 UUID이며 프로젝트 내 고유다.
- snapshot 정확 11필드: draftRef,definition,reviewRefs,reason,confirmedBy,confirmedAt,contentConfirmed,readinessIssues,ready,executionAuthorized,dispatchPerformed. draftRef/definition/readinessIssues는 정확 내부 초안과 대조한다. confirmedBy는 원 행 actor, contentConfirmed=true, 나머지 세 boolean=false.
- readAssignmentConfirmation에 draftRef/reviewRefs/reason/acknowledged:true를 전달한다. 내용 필수 미진 REQUIRED_TEXT_MISSING/REQUIRED_LIST_MISSING/SOURCE_SCOPE_MISSING/BASELINE_REFERENCE_MISSING이 있으면 확정 손상으로 거절한다. runtime/context/budget 등 미검증 issue는 보존한다.
- 모든 선택 reviewRefs는 내부의 정확 같은 draft 버전·hash/ACCEPTED여야 한다. 각 review.auditSeq < confirmation.auditSeq. 같은 draftRef에서 확정 이전 auditSeq가 가장 큰 검토는 ACCEPTED이고 선택 목록에 포함돼야 한다. 확정 뒤의 REWORK/ACCEPTED로 과거 확정을 무효화하거나 재확정하지 않는다.
- 확정은 초안 버전 중 일부만 존재할 수 있다. draft v1/v2/v3 중 v1/v3만 확정된 정상 이력을 허용하며 확정 버전 1..N 연속을 요구하지 않는다. confirmedAt·행/receipt/command 같은 사건 시각은 일치해야 하나 서로 다른 검토/초안/확정 거래의 시각 단조를 추가하지 않는다.

## 6. 세 operation 원 요청과 국소 증거

| 자료 | operation | 원 targetId / expectedVersion | payload | receipt status / 감사 reason |
|---|---|---|---|---|
| 초안 | prepareAssignment | v1 null/0, 이후 draft_id/(version-1) | baseRef,definition,reason | ASSIGNMENT_DRAFT_STORED / EXPLICIT_ASSIGNMENT_DRAFT_ONLY |
| 검토 | reviewAssignmentContent | draft_id/draft_version | draftRef,criteriaVersion,items,outcome,reason | ASSIGNMENT_CONTENT_REVIEWED / EXPLICIT_ASSIGNMENT_CONTENT_REVIEW |
| 확정 | confirmAssignment | assignment_id/version | draftRef,reviewRefs,reason,acknowledged:true | ASSIGNMENT_CONTENT_CONFIRMED / EXPLICIT_ASSIGNMENT_CONTENT_ONLY |

- 원 request는 schemaVersion1/projectId/원 사용자 commandId/clientId/controlGeneration·표 operation/target/expected·baselineRefs=[]·approvalRef=null·표 payload다. canonical 재구성 hash를 commands.request_hash와 대조하며 실행/반환하지 않는다. 특히 prepareAssignment의 payload.definition.baselineRefs와 명령 최상위 baselineRefs=[]를 혼동하지 않는다.
- row.command_id는 서버 commands.id이며 사용자 commands.command_id와 다르다. 세 자료 전체에서 서버 command ID 및 `(project_id,actor_id,command_id)` 유일성을 검사하고 operation을 유일키에 넣지 않는다.
- commands의 PROJECT/scope_id/project·APPLIED·operation/expectedVersion·원 actor/client·controlGeneration/policy·operationId·authorization_receipt_id를 대조한다. approval_consumption_id/payload_ref는 null이다.
- receipt 닫힌 10필드 및 project/사용자 commandId/operationId/APPLIED·반환 targetId/version·빈 evidenceRefs/warnings를 검사한다. 검토 receipt target은 review_id/version1이며 원 요청 target인 draft_id/version과 다르다. receipt data는 초안/검토가 정확 ref,status,snapshot 3필드, 확정이 ref,status,confirmationId,snapshot 4필드다.
- row.created_at/receipt.serverReceivedAt/commands.completed_at과 reviewedAt/confirmedAt(해당 시)은 같은 사건의 밀리초 값이다. 거래 간 시각 대소는 추가하지 않는다.
- auth/audit는 참조 WI의 정확 9/16열 규칙으로 검사한다. scope_digest=hash({projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef:해당 원 ref}). auth exact id/command/project/subject/policy·approval_decision_ref=null, 감사 exact 1건/고유 양의 server_sequence·HUMAN_COMMAND/APPLIED/표 reason·actor/client/target/policy/digest·approval_ref/correction_of=null을 대조한다. 현재 policy/승인 권한·전체 감사 chain을 복원/검증하지 않는다.

## 7. 내부 반환과 미검증 경계

- kind=ASSIGNMENT_INVENTORY_V1, scope=PROJECT_ASSIGNMENT_HISTORY_ONLY.
- projectId,drafts[],draftVersions[],reviews[],confirmations[],issues[],externalDependencies[] 및 observation/usage. 전체 contentHash는 앞의 정확 7필드 canonical hash다.
- drafts는 id/headVersion/createdAt/updatedAt/createdBy:{kind:HUMAN}. 불변 항목은 ref/원형 또는 익명 snapshot/sourceEvidence/projectionHash, 확정은 confirmationId를 포함한다. review는 sameAuthor를 보존한다. sourceEvidence는 국소 serverSequence/authorizationReceiptRef다.
- 원 user/client 포함 hash·관계를 먼저 검사한 뒤 reviewedBy/confirmedBy/createdBy를 {kind:HUMAN}으로 투영한다. 원 ref.contentHash와 projectionHash를 구분하고 이유·불완전 issue·부모/검토 선택 순서·false 상태를 유지한다. projectionHash는 자기 필드 제외 익명 항목 전체의 hash다. actor/client/session/token·원 SQL/error/cause는 반환하지 않는다.
- 부모·draft·review는 내부 exact 관계이며 누락503이다. 외부 의존은 plan/application/design, environment/budget/recordingPolicy, review evidence, allowedScopes의 sourceRoot/mapping/observation/baseline, policy/auth refs를 실제 존재 ref만 분류·중복 억제한다. 가짜 VersionRef를 만들지 않는다.
- taskCardVerification,externalBaselineVerification,currentApplicationVerification,parentCurrentnessVerification,sourceOsVerification,policyVerification,auditChainVerification,blobVerification=NOT_PERFORMED. sourceScopeContainment은 실제 원문 국소 비교 사실만 표시한다.
- metadataComplete는 미확인 외부 의존이 있으면 false. fullProjectCoverage/restorable/atomicSnapshotVerified/ready/executionAuthorized/dispatchPerformed=false, executionEvidence=NOT_CONNECTED. 내용 확정 사실을 실행 준비로 승격하지 않는다.
- 자유문장/source scope/최종 투영은 기존 known-secret 검사로 거절하고 완전한 개인정보 탐지로 주장하지 않는다. fileCount/inputBytes=0. metadataBytes는 usage 자기 자리수까지 포함한 canonical UTF-8 실제 결과 크기다. 실제 파일 읽기/경로 실행은 없다.

## 8. 공통 경계와 검증 순서

참조 WI §8을 그대로 적용한다. 현재 OWNER/비보관 프로젝트·동일 actor/client/credentialGeneration/session의 양끝 authenticated RC, 자료의 단일 RR READ ONLY, 각 query 전 총/최단 세션 남은 statement_timeout, 응답 뒤 및 외부 COMMIT 뒤 취소·기한 검사, BEGIN 응답 유실 client 정상 재사용 금지·단발 회수·회수 실패503 우선. pool.connect/auth 내부 wall-clock 강제취소나 Promise.race 뒤 조기 release를 추가하지 않는다. 입력400/인증401/소유404/취소409/한도·기한413/무결성·민감·불명503의 고정 오류만 노출한다.

- [ ] Main 범위 검토 후 신규 시험 2개 작성. pure parser 유효 원형·실제 request/hash/auth/audit로 정상 fixture를 만들고 source 미구현 RED의 명령/exit/실제 실패를 보존한다.
- [ ] 신규 제품 1개만 구현해 같은 시험 GREEN까지 연속 수행한다. 기준을 바꾸는 fixture 수정은 원인/최소 diff를 먼저 보고한다. 같은 근본 원인 3회면 Main에 인계한다.
- [ ] `node --test tests/unit/FN16/assignment-inventory.test.ts tests/unit/FN16/assignment-inventory-schema.test.ts`, 별도 `npm run typecheck`, 별도 `git diff --check`의 exit를 확인한다. 기존 완료 collector 전체 검사를 반복하지 않는다.
- [ ] source/test 정확 hash·diff·실패 이력·실제 DB/FS NOT_RUN을 Main에 제출 후 동결. Main fresh 집중 검사와 독립 검수 후 판정/통합한다. rollback은 신규 3파일의 해당 변경만 대상으로 하며 보호 자료/기존 source를 복구하지 않는다.

필수 반례는 업무 단위로 묶는다: root 전체 버전과 v1/v3 부분 확정·확정 뒤 REWORK·다른 과거 actor·정상 부모 child draft·거래 시각 역전; 201행 paging/문자열 bigint; 원hash/이전ref/head 손상; 부모 누락·비root·부분집합 위반·child review/확정; 잘못된 draft/선택review·미래 auditSeq·당시 최신 검토 누락; 서버/사용자 명령 혼동·3operation 사이 요청 ID 재사용·auth/audit 불일치; 현재 OWNER 회수/세션 변경·기한/취소·거대 행/민감 투영·BEGIN/cleanup 불명. 같은 사건 시각 불일치 음성을 유지한다. 합성 PASS는 실제 PG/RLS/DB 자료/전체 백업/복원 PASS가 아니다.

## Main 국소 인과 보완 r2
독립 사전검수 C0/I1/M0의 내부 선후관계 누락을 실제 producer/0013·0034와 대조했다. 정확 직전 초안의 auditSeq < 다음 초안 auditSeq, 정확 부모 확정의 auditSeq < 해당 child 초안 auditSeq, 정확 대상 초안의 auditSeq < 내용검토 auditSeq를 검사한다. 검토→확정은 §5.2로 이미 결박되므로 초안→확정도 전이 보장한다. 정확 ref/hash는 일치하지만 이 순서만 뒤집고 관련 command/auth/audit를 재결박한 반례를 포함한다. 서로 다른 거래의 timestamp 대소, 확정버전 연속성, 현재 부모 head를 추가하지 않는다. 신규3경로/외부계약/실제효과제외/기존정상기준불변이다. Primary가 같은 TDD 진행에서 보완하며 별도 사용자 재승인 대기를 하지 않는다.
