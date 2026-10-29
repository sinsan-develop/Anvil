# FN16 결과 검수 기준·검토·재작업 이력 수집 작업지시서 초안

2026-10-29 / codex/av3-stage-b / **미검토·제품/시험 GO 아님**

**목표:** 별도 등록된 검수 기준의 전체 버전, 결과 검토, 재작업 초안을 정확 참조로 연결해 보존한다. 검수·재작업을 지금 실행하거나 완료 수락으로 바꾸지 않는다.
**방법:** writing-plans의 명시 경로·실제 producer 대조·Primary TDD RED → GREEN → Main 집중 검증·독립 검수. 기존 결과제출 collector를 중복 호출하지 않고 필요한 원 결과만 같은 RR에서 선택 조회한다.
**기술:** 기존 Node 24/TypeScript·pg·canonical/pure validation. 새 패키지/공개 API/DB schema·정책·실행 계약 없음.
**기준:** docs/WORK_PLAN.md 및 docs/work_packages/FUNCTION_WORK.md FN16, 아래 실제 0026~0028 저장 계약. 결과제출 완료 기준선 415ddf5a66b5a2637fe952c5f7e0b31ba50ef541 이후의 내부 source-only 구체화다.

## 1. 허용 범위와 구분 가능한 업무

현재 쓰기는 이 문서 한 파일뿐이다. Main 범위 검토 후 Primary가 TDD로 연속 구현할 신규 3경로:

- apps/server/modules/backups/result-review-history-inventory.ts
- tests/unit/FN16/result-review-history-inventory.test.ts
- tests/unit/FN16/result-review-history-inventory-schema.test.ts

기준→검토→재작업은 동일 결과/기준/검토 참조를 대조해야 하는 하나의 연결 이력 업무다. 기존 결과제출 전체 수집·원문 검증·현재 assignment/role/binding·기준 활성·새 임무 작성/실행은 별도다. 기존 source/helper/SQL/시험/보호 untracked 8 변경 0. 실제 DB/FS/키/서비스/설정/Agent/P03/job 0, Primary Git 쓰기 0. Main이 문서 동기화·현황·통합을 맡는다.

0027/0028에는 검토 취소 상태/event가 없다. 없는 취소 이력을 합성하지 않는다. 같은 결과에 별도 검토 행이 여러 개 있으면 모두 보존하고 최신 검토로 과거를 대체하지 않는다. 취소 수집은 `NOT_SUPPORTED_BY_CURRENT_SCHEMA`로 명시한다.

## 2. 실제 producer와 재사용 경계

- db/migrations/0026_result_review_criteria.sql: 기준 13열(생성열 2개 포함), 전체 버전/baseRef, saveResultCriteria 국소 명령/receipt.
- db/migrations/0027_result_reviews.sql: 검토 11열, 결과·정확 기준 버전 FK, evaluateResult. REWORK/BLOCKED만 저장하고 합격/증거 검증/실패집계는 하지 않는다.
- db/migrations/0028_result_rework_drafts.sql: 초안 12열, 결과·검토·binding 참조, requestRework. immutable snapshot이며 새 임무/실행이 아니다.
- apps/server/modules/results/project-result-criteria.ts #view/#data/save, project-result-reviews.ts #view/#data/save, project-result-reworks.ts #snapshot/#data/read/save: 아래 원 요청·snapshot·receipt의 근거.
- apps/server/modules/results/result-criteria.ts prepareResultCriteria는 확정 assignment 원문을 요구한다. 이번 수집 범위에 없는 assignment를 만들어 호출하지 않는다. input/criteria snapshot/sourceBindings의 국소 구조와 관계만 직접 검사한다.
- apps/server/modules/results/result-review-input.ts prepareResultReview 및 reported-coverage.ts는 선택한 실제 원 결과 snapshot과 이번 수집 기준으로 순수 호출 가능하다. 결과의 WORKER_CLAIM/미검증 증거를 실제 검증으로 승격하지 않는다.
- apps/server/modules/results/result-submission-store.ts readSubmittedResultRecord는 선택 원 결과의 hash/형식 확인에만 사용한다. 기존 결과제출 전체 collector/readPgResultExecution은 호출하지 않는다.
- apps/server/modules/results/result-rework-input.ts prepareResultRework 및 project-result-rework-preparation.ts/ProjectResultReworks.read는 assignment/role/binding/현재 준비 조회를 포함하므로 호출 금지. 저장 snapshot 형식과 이번에 확보한 result/review/criteria 관계만 검사한다.
- contracts/runtime/source-scope-v1.ts readSourceScopesV1는 sourceScopes의 문법만 확인한다. 권한·원 assignment의 부분집합·실제 OS 경로 검증이 아니다.
- result-reviews.ts/result-reworks.ts의 SyntheticResultReview/Rework journal parser는 실제 PG snapshot과 다른 형식이다. 실제 행에 적용하거나 합성 journal을 진짜 이력으로 만들지 않는다.

## 3. 함수·명시 SQL 열

`collectResultReviewHistoryInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<ResultReviewHistoryInventory>`

기존 readDocumentInventoryInput(projectId/limits)을 소비한다. 외부 result/review/assignment 배열·actor/client·경로·실행 설정을 받지 않는다.

| 표 | 명시 허용 열 | 선택/정렬 |
|---|---|---|
| result_criteria_versions (13) | project_id,criteria_id,version,assignment_ref,assignment_id,assignment_version,content_hash,criteria_json,input_json,created_by,client_id,command_id,created_at | 프로젝트 전체, (criteria_id UUID,version bigint) ASC keyset |
| result_reviews (11) | project_id,id,result_id,criteria_id,criteria_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체, id UUID ASC |
| result_rework_drafts (12) | project_id,id,result_id,review_id,binding_id,binding_version,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체, id UUID ASC |
| result_submissions (6, 보조) | project_id,id,content_hash,snapshot_json,submitted_by,submitted_at | 위 review/rework가 참조한 정확 id 집합만 ≤200씩, id ASC |
| commands (19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | 세 주자료의 exact 서버 command ID 집합만, id ASC |
| authorization_receipts (9) | id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at | 위 명령의 exact receipt/command, id ASC |
| audit_events (16) | project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of | 위 명령의 exact ID만, event_id ASC |

페이지마다 LIMIT 200/strict cursor/중복·선택집합·누락 검사. 최근 20개·최신 기준으로 제한하지 않는다. 명시 열 CTE→octet_length/CASE로 큰 행 본문을 null 억제한다. SELECT */원행 전체 to_jsonb·OFFSET·전체 command/audit 스캔 금지. SQL JSON timestamp 문자열을 엄격 검증하고 bigint는 canonical decimal 안전정수만 허용한다. 원 표/열이 없거나 지원되지 않으면 503이며 빈 결과로 숨기지 않는다.

## 4. 기준 전체 버전의 국소 검증

1. project/id/version·원 서버 command 유일성, version 1..N 연속, v1 baseRef=null, 이후 baseRef는 같은 criteria_id의 정확 직전 ref다. assignment_ref=생성 assignment_id/version=input.assignmentRef=criteria_json.assignmentRef. writer가 다른 assignment로 기준을 개정하는 것을 별도로 금지하지 않으므로 버전 간 assignment 불변 조건을 새로 추가하지 않는다.
2. 기준 ref는 `{id:criteria_id,version,contentHash}`이며 hash는 원 criteria_json 전체다. snapshot은 정확 assignmentRef/baselineRefs/items 3필드다. baselineRefs는 비어 있지 않은 고유 exact refs ≤200. items 1..100은 criterionId/testId/kind/environmentRef/required 5필드, required=true, criterionId 고유·code 형식 `[A-Za-z0-9][A-Za-z0-9_.-]{0,79}`. kind는 BUILD/TYPECHECK/UNIT/INTEGRATION/BROWSER/AGENT/DEPLOYMENT/SECURITY만.
3. input은 assignmentRef/baseRef/items/reason 4필드. items의 각 5필드는 criterionId/testId/kind/environmentRef/sources, 순서와 앞 4값이 snapshot.items와 같다. sources 1..20의 각 항목은 field/index/contentHash: field=acceptanceCriteria|verificationRequirements, index는 0 이상 안전정수, hash는 형식 확인, item 내 field/index 중복 금지. reason은 비공백 ≤20,000자·민감 표식 검사. sourceBindings는 input.items 순서를 보존한 `{criterionId,sources}` 배열로만 산출해 원 receipt와 비교한다.
4. assignment 원문이 없으므로 source index의 실제 범위/원문 hash, 모든 원 요구사항 coverage, 원 baseline/environment와의 일치 재검증은 NOT_PERFORMED다. input/snapshot의 자기 정합을 이 검증으로 오인하지 않는다. 기준 등록만으로 적용/검토/완료/실행 false를 바꾸지 않는다.

## 5. 결과·검토·재작업의 정확 연결

### 5.1 선택 결과와 검토

- 선택 결과는 프로젝트/id·원 snapshot hash·submitted_by=snapshot.submittedByRef.id·submitted_at=snapshot.submittedAt를 대조하고 readSubmittedResultRecord로 실제 snapshot 형식을 검사한다. review/rework의 resultRef는 **snapshot hash ref**이지 별도 manifestRef가 아니다. 같은 id에 상충하는 ref, 필요한 원 결과 누락/다른 프로젝트는 손상503이다. 원 결과는 검증용으로만 보유하고 전체 manifest/제출자 정보를 결과 DTO에 중복 반환하지 않는다.
- 선택 결과의 원 command/auth/audit 전체 재검증은 기존 결과제출 수집의 별도 책임이다. 이번 결과 의존의 `submissionCommandEvidenceVerification:NOT_PERFORMED`를 명시한다. 이번 단위 자체 명령 증거와 혼합하지 않는다.
- 검토 snapshot 정확 10필드: scope,input,reviewedBy,sameAsSubmitter,reviewedAt,evidenceProvenanceVerified,completionAccepted,formalFailureCounted,executionAuthorized,dispatchPerformed. scope는 projectId/assignmentRef/executionRef. reviewedBy는 HUMAN/userId/clientId이며 행의 created_by/client_id와 같다. 원 hash를 먼저 확인한다.
- row result_id/criteria_id/criteria_version은 input의 exact resultRef/criteriaRef와 같다. criteriaRef는 이번 전체 기준 맵의 정확 ref여야 한다. 내부 참조 부재를 외부 미확인으로 낮추지 않는다.
- 실제 선택 result와 수집 criteria를 prepareResultReview에 입력하고 원 reviewedAt을 사용한다. 반환 scope/input은 저장 원형과 같아야 한다. input은 resultRef/criteriaRef/outcome/items/reason, outcome REWORK|BLOCKED, 모든 criterion을 한 번씩 포함, item criterionId/outcome/evidenceRefs/reason에서 evidenceRefs=[]이고 item outcome REWORK|BLOCKED, 전체 outcome과 같은 item이 하나 이상이다. 현재 기준/최신 검토/실제 증거는 다시 조회하지 않는다.
- sameAsSubmitter는 원 reviewedBy.userId와 선택 snapshot.submittedByRef.id의 비교값으로 검사한다. 현재 OWNER와 원 검토자가 달라도 정상이다. reviewedAt=row.created_at=receipt 시간, 다섯 false를 보존한다. 같은 결과에 여러 actor/기준 버전으로 작성한 검토를 모두 남긴다. 0027:90의 원 제출시각 및 선택 기준 created_at≤검토 created_at 경계를 모두 유지한다. 같은 기준의 다른 버전이나 다른 검토까지 시각 단조를 확대하지 않는다.

### 5.2 재작업 초안

- ref는 id/version1/원 snapshot hash. snapshot 정확 14필드: scope,input,criteriaRef,roleRef,stageSessionRef,remainingMissingItems,preservedItems,requestedBy,requestedAt,scopeVerification,completionAccepted,formalFailureCounted,executionAuthorized,dispatchPerformed.
- input 정확 resultRef/reviewRef/responsibleBindingRef/missingItems/sourceScopes/reason 6필드. exact refs 및 binding row id/version 대조. missingItems 1..100의 고유 code, reason 비공백·well-formed ≤20,000자, sourceScopes는 readSourceScopesV1의 기존 유한 형식을 사용한다.
- input.reviewRef는 수집된 정확 review, input.resultRef는 해당 review의 input.resultRef와 같고 scope도 원 result/review와 같다. snapshot.criteriaRef는 review.input.criteriaRef와 같아야 한다. missingItems는 그 검토의 REWORK/BLOCKED criterion 중에서만 선택한다. remainingMissingItems는 review.input.items 원 순서에서 선택 missingItems를 뺀 정확 배열이며 preservedItems=[]다.
- roleRef/stageSessionRef/responsibleBindingRef는 exact 형식을 보존하되 이번 외부 의존이다. 현재 binding/role/assignment·최신 plan/application·작성 당시 원 assignment sourceScopes 부분집합은 조회/재판정하지 않는다. scopeVerification은 원 `ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED`를 보존하고 `scopeVerificationRecheck:NOT_PERFORMED`로 구분한다.
- requestedBy HUMAN/userId/clientId는 행 actor/client와 같으며 requestedAt=row.created_at=receipt 시간이다. completionAccepted/formalFailureCounted/executionAuthorized/dispatchPerformed=false. receipt의 currentBindingVerified/currentAuthorityVerified=false도 유지한다.
- 실제 0028:163에서 강제한 연결 result.submitted_at/review.created_at≤rework.created_at는 보존한다. binding.created_at 비교는 외부 의존 미검증이다. 서로 다른 기준 버전·검토·재작업 행 사이 일반 시각 단조를 추가하지 않는다. 원 요청 이유와 sourceScopes 상대경로는 주장으로만 보존하고 실행/원문 파일 접근하지 않는다.

## 6. 세 주자료의 명령·receipt·감사

기존 결과제출 WI §4의 공통 19/9/16열 국소 증거 방식을 따른다. 선택 결과의 command를 여기 다시 수집하지 않는다.

| 자료 | operation | 원 targetId/expectedVersion | receipt status | 감사 reason |
|---|---|---|---|---|
| 기준 | saveResultCriteria | v1 null/0, 후속 criteria_id/(version-1) | RESULT_CRITERIA_STORED | EXPLICIT_RESULT_CRITERIA_REGISTRATION_ONLY |
| 검토 | evaluateResult | null/0 | RESULT_REVIEW_RECORDED | EXPLICIT_RESULT_REVIEW_NOT_ACCEPTANCE |
| 재작업 | requestRework | null/0 | RESULT_REWORK_DRAFT_STORED | EXPLICIT_REWORK_DRAFT_NOT_ASSIGNMENT |

- 세 자료 전체에서 서버 command ID 중복과 `(project_id,actor_id,command_id)` 중복을 거절한다. operation을 유일키에 섞지 않는다. PROJECT/scope_id/project, APPLIED/표의 operation, 원 created_by/client_id, expectedVersion/controlGeneration/policy/authorization 참조, completed_at 유효성, approval_consumption_id/payload_ref=null을 검사한다.
- 원 요청은 schemaVersion1/projectId/원 사용자 commandId/clientId/controlGeneration/표 operation·target·expected/baselineRefs[]/approvalRefnull/payload=각 원 input 전체를 canonical 재구성해 request_hash와 비교한다. 재구성 명령을 실행/반환하지 않는다.
- receipt 닫힌 10필드와 APPLIED/commandId/operationId/project/대상ref id/version/빈 evidenceRefs·warnings를 검사한다. row.created_at/receipt.serverReceivedAt/command.completed_at은 같은 사건의 밀리초 시각이다.
- 기준 data 정확 ref,status,snapshot,sourceBindings,registryStored,reviewStored,completionAccepted,executionAuthorized,dispatchPerformed 9필드. registryStored=true, 나머지 네 boolean=false.
- 검토 data 정확 ref,status,snapshot,reviewStored,completionAccepted,formalFailureCounted,evidenceProvenanceVerified,executionAuthorized,dispatchPerformed 9필드. reviewStored=true, 나머지 다섯 boolean=false.
- 재작업 data 정확 ref,status,snapshot,reworkStored,currentBindingVerified,currentAuthorityVerified,completionAccepted,formalFailureCounted,executionAuthorized,dispatchPerformed 10필드. reworkStored=true, 나머지 여섯 boolean=false.
- auth receipt의 exact id/command/PROJECT/scope_id·subject HUMAN 원actor/client·policy·approval_decision_ref=null. scope_digest는 `{projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef:각자료ref}`의 hash다.
- exact 감사 1건의 project/command/operationId·원 actor/client·targetRef/policy·approval_refnull·APPLIED·표 reason·HUMAN_COMMAND·scope_digest·correction_ofnull과 고유 양의 server_sequence/유효 recorded_at를 검사한다. 현재 policy/승인/전체 감사 chain은 검증하지 않는다.

## 7. 반환·부분 판정

- kind=RESULT_REVIEW_HISTORY_INVENTORY_V1, scope=PROJECT_RESULT_REVIEW_HISTORY_ONLY.
- `projectId,criteria[],reviews[],reworks[],issues[],externalDependencies[]`와 observation/usage를 반환한다. 전체 contentHash는 정확 이 여섯 필드의 canonical hash다.
- criteria 항목은 ref/snapshot/input/sourceBindings/createdBy:{kind:HUMAN}/registeredAt/sourceEvidence/projectionHash. reviews/reworks는 ref/익명 snapshot/sourceEvidence/projectionHash. sourceEvidence는 국소 serverSequence/authorizationReceiptRef다.
- 원 user/client를 포함한 hash·row·명령 관계를 검사한 뒤 reviewedBy/requestedBy를 `{kind:HUMAN}`으로 투영한다. sameAsSubmitter와 이유/미진 항목·선택 기준/범위는 보존한다. projectionHash는 자기 필드 제외 익명 항목 전체 hash이며 원 ref.contentHash를 덮지 않는다. 실제 actor/client/session/token·원 SQL/error/cause는 반환하지 않는다.
- 내부 exact 기준/검토/결과 참조는 연결 검사를 완료해야 하며 누락은503이다. 외부 의존은 assignment/execution/baseline/environment, role/binding/stageSession, sourceScopes의 sourceRoot/mapping/observation/baseline, policy/auth refs로 분류·중복 억제한다. 결과 참조는 선택 snapshot 검증 사실과 별도 command 증거 미검증을 함께 기록한다.
- `assignmentSourceVerification,scopeVerificationRecheck,bindingVerification,executionReferenceVerification,submissionCommandEvidenceVerification,evidenceProvenanceVerification,policyVerification,auditChainVerification,blobVerification:NOT_PERFORMED`.
- `reviewCancellationHistory:NOT_SUPPORTED_BY_CURRENT_SCHEMA`; `resultSubmissions:REFERENCE_SNAPSHOTS_ONLY`; 전체제출 이력을 수집했다고 표시하지 않는다.
- `evidenceProvenanceVerified,completionAccepted,formalFailureCounted,fullProjectCoverage,restorable,executionAuthorized,dispatchPerformed,atomicSnapshotVerified:false`, executionEvidence=NOT_CONNECTED. 외부 미검증을 가진 경우 metadataComplete=false. 빈 배열도 실제 검수/완료를 뜻하지 않는다.
- 원 자유문장/sourceScopes와 최종 metadata의 known-secret 표식은 기존 검사로 거절한다. 완전한 비밀/개인정보 탐지를 주장하지 않는다. fileCount/inputBytes=0, 최종 metadataBytes는 usage 자기 자리수까지 포함한 canonical UTF-8 실제 크기로 고정한다.

## 8. 공통 현재성·한도·회수

FN16_RESULT_SUBMISSION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §3/§6의 일반 RC/RR/입력/행크기/회수 규칙을 변경 없이 적용한다. 양끝 authenticated RC의 동일 actor/client/credentialGeneration/session·현재 OWNER/비보관 프로젝트, 단일 RR READ ONLY, 각 query 직전 총·최단세션 남은 timeout, 응답 뒤/외부 COMMIT 뒤 취소·기한 검사, BEGIN 응답 유실의 error release와 단발 회수·회수불명503 우선이다. 새 RLS GUC·권한 부여는 없다. 기존 auth/pool.connect의 전체 wall-clock 강제취소를 보장하지 않는다.

입력400·인증401·소유404·취소409·한도/기한413·저장무결성/민감/불명503을 고정하고 helper 원오류는 노출하지 않는다. 원 command/기준 등록/현재 준비/승인·재작업 실행은 호출하지 않는다.

## 9. 실행 순서·검수

- [ ] Main WI 고정·독립 preflight. 이 초안만으로 제품/시험 쓰기를 시작하지 않는다.
- [ ] 신규 행동/schema 시험 2파일 TEST_ONLY. 실제 parser가 수용하는 원 snapshot fixture를 만들고 부재 module을 PASS로 숨기지 않는다.
- [ ] Primary가 같은 두 시험으로 미구현 RED를 실행·기록한다. Main의 중복 RED 실행이나 단계별 재승인을 기다리지 않는다.
- [ ] RED 원인을 확인한 뒤 신규 collector 1파일을 연속 구현해 GREEN을 검증한다. 실제 producer 차이는 정확 보고하고 기존 기대·기준을 낮추지 않는다.
- [ ] 같은 신규 시험·`npm run typecheck`·`git diff --check`를 각 exit와 지문으로 제출한다. 완료된 결과제출/다른 자료군 전체 회귀는 반복하지 않는다.
- [ ] 독립 검수 → Main fresh 검증·현황·checkpoint. Primary commit/push 없음.

필수 합성 흐름은 빈 이력, 기준 2버전/별도 기준ID·과거 actor, 같은 결과의 REWORK/BLOCKED 재검토 여러 건과 각 정확 review를 지목한 재작업, sourceScopes/이유/remainingMissing 원 순서, 제출자와 같은/다른 검토자, 201개 paging 및 기준 버전 page 경계다. 일반 거래 시각 역전은 보존하되 실제 연결 result/review→rework·같은 사건 시간 불일치는 거절한다.

중요 음성: 내부 기준/결과/검토 누락·다른 project/hash/row ref, snapshot/input/sourceBindings 변조, 기준 baseRef 단절, criteria item 집합/검토 outcome·false 변조, missing/remaining/preserved·sourceScopes 형식 손상, 국소 command/requesthash/auth/audit·교차연산 요청ID 중복, 익명화 전 marker/과대row·표부재, OWNER/신원/최단세션·마지막 COMMIT 취소/BEGIN 회수불명. 기존 current/preparation reader를 호출하면 실패하는 SQL allowlist로 경계를 검사한다.

메모리 DB 시험은 실제 PostgreSQL/trigger/RLS/내구성 증거가 아니다. 실제 설정·키·원문·증거·검수·재작업·복원·화면 인수 미실행. rollback은 신규 3파일의 검토 revert이며 기존 이력 삭제가 아니다.

- Main 비의미 절차 조정: 신규 단위의 RED→GREEN은 동일 Primary가 연속 수행하고, Main은 최종 집중검증과 독립검수로 판정한다. 기능·허용경로·실제 실행 경계·시험 기준은 불변이다.
