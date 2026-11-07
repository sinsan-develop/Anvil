# FN16 결과제출 전체 이력 metadata 수집 작업지시서 초안

2026-10-29 / 기존 codex/av3-stage-b / **미검토·제품/시험 GO 아님**

**목표:** 프로젝트에 보존된 결과제출 원주장·manifest·제출 사건의 국소 증거를 전체 이력으로 수집한다. 제출 상태 COMPLETED와 실제 검수·완료 수락을 구분한다. 결과 검토·검수 기준·재작업 자료군은 별도다.
**방법:** writing-plans의 명시 경로·실제 producer 대조·TEST_ONLY → Main RED → SOURCE_GO → 독립 검수. 새 공개 archive/restore/API, 정책·DB schema·실행 권한 계약을 만들지 않는다.
**기준:** docs/WORK_PLAN.md, docs/work_packages/FUNCTION_WORK.md FN16과 아래 실제 저장 계약. 현재 승인된 내부 수집 source-only의 업무 구체화다.

## 1. 허용 범위

현재 작성은 이 WI 한 파일이다. Main 검토 후 별도 GO 대상 신규 파일은 다음 3개다.

- apps/server/modules/backups/result-submission-inventory.ts
- tests/unit/FN16/result-submission-inventory.test.ts
- tests/unit/FN16/result-submission-inventory-schema.test.ts

기존 source·SQL·pure helper·시험·보호 untracked 8 변경 0. 실제 DB/RLS·원문 FS·키·서비스·설정·Agent/P03/job·제출/승인/검토 쓰기 0. Main이 문서 동기화·WORK_STATUS·Git을 담당한다. 이번 문서는 제품이나 시험 착수 GO가 아니다.

## 2. 실제 구현 근거

- db/migrations/0025_result_submissions.sql: 결과 표 15열, (project_id,id)/(project_id,command_id) UNIQUE, 불변 trigger. 저장 시 실제 execution/현재 권한 검사는 작성 당시 책임이며 이번 collector에서 재실행하지 않는다.
- apps/server/modules/results/project-result-submissions.ts submit/#entry: prepareSubmittedResult → manifestRef → persistProjectReceipt → snapshot/hash → row. 기존 read/list/page는 readPgResultExecution과 현재 assignment 조회를 포함하므로 직접 재사용하지 않는다.
- apps/server/modules/results/result-submission-store.ts readSubmittedResultRecord: 원 snapshot 13필드·원 hash·SYNTHETIC_ONLY/WORKER_CLAIM·false 증거/완료/실행 플래그·manifestHash·2MiB 경계를 검사하는 순수 함수.
- apps/server/modules/results/result-submission.ts prepareSubmittedResult: scope 3필드/manifest 12필드 및 상세 변경·명령 결과·시험 결과·참조·미실행·위험·rollback의 저장형식, 알려진 민감 표식과 canonical hash를 검사한다. 원본 wire/file byte 검증은 아니다.
- db/migrations/0011_authorization.sql 및 0011_project_policy_control.sql, apps/server/modules/access/project-command.ts: commands/auth receipt/audit와 프로젝트 요청 ID 유일성, 원요청/receipt 생성 근거.

## 3. 함수와 명시 열

`collectResultSubmissionInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<ResultSubmissionInventory>`

기존 readDocumentInventoryInput(projectId/limits)을 그대로 소비한다. 외부 submission 배열·actor/client·실행 범위·경로를 받지 않는다.

| 표 | 명시 허용 열 | 범위·keyset |
|---|---|---|
| result_submissions (15) | project_id,id,execution_id,generation,assignment_ref,execution_ref,manifest_ref,manifest_hash,submission_state,submitted_by,client_id,command_id,content_hash,snapshot_json,submitted_at | 프로젝트 일치, id UUID ASC, LIMIT 200. 최근 20건/현재 assignment로 제한하지 않는다 |
| commands (19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | 위 결과의 exact 서버 command ID만 배열 ≤200, PROJECT/scope_id/project_id 및 submitResult, id ASC |
| authorization_receipts (9) | id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at | 수집 명령의 exact receipt ID/command 결박, PROJECT/scope_id, id ASC |
| audit_events (16) | project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of | 수집 서버 command ID만, project 일치, event_id ASC |

각 자료 SQL은 명시 열 CTE와 octet_length/CASE로 큰 행 본문을 null 억제한다. 남은 metadataBytes를 넘으면 고정 413이다. SELECT */전체 원행 to_jsonb·OFFSET·전체 commands/audit 스캔 금지. 응답 ≤200·strict cursor 진행·정확 선택집합/누락/중복을 검증한다. JSON timestamp는 문자열임을 반영해 유효 Date/ISO로 검증하고 bigint는 canonical decimal 안전정수만 변환한다. 실제 표·열/권한 부재는 고정 503이며 조용한 빈 목록 fallback은 없다.

## 4. 원본 hash와 저장 관계

1. 각 결과는 id/project/원 서버 command가 유일하다. generation은 양의 안전정수이며 execution_id/generation이 execution_ref.id/version과 같다. assignment/execution refs는 정확 형식으로 원 scope와 같아야 한다. 다른 제출 간 시각 단조·실행 세대 연속·최신 제출 강제는 하지 않는다.
2. `ref={id,version:1,contentHash:row.content_hash}`는 **snapshot 전체 hash**다. `manifestRef={id,version:1,contentHash:row.manifest_hash}`는 **manifest hash**다. 둘을 대체하거나 같은 hash라고 가정하지 않는다. snapshot hash 확인 뒤 순수 readSubmittedResultRecord를 실제 저장 scope와 RR DB 관측 시각으로 호출한다. prepareSubmittedResult의 manifest canonical hash/형식도 기존 helper 소비선으로 확인한다.
3. snapshot은 정확 13필드: transport,scope,submittedByRef,authorizationReceiptRef,manifest,manifestHash,submittedAt,sourceKind,evidenceProvenanceVerified,completionAccepted,formalFailureCounted,executionAuthorized,dispatchPerformed. transport=SYNTHETIC_ONLY, sourceKind=WORKER_CLAIM와 다섯 false를 원형 보존한다. manifest 안에 선언된 CONNECTOR_OBSERVED/TEST_ARTIFACT/REVIEWER_CONFIRMED를 진짜 관측으로 승격하거나 지우지 않는다.
4. manifest는 정확 12필드: assignmentRef,executionRef,baselineRefs,submissionState,changes,commandResults,testResults,artifactRefs,unexecuted,risks,rollback,checkpointRef. 기존 parser의 각 배열·문자열·2MiB 상한/상태·경로·argv/시간 형식을 유지한다. 새 검수 기준이나 현재 provenance를 적용해 과거 주장을 합격/실패로 다시 판정하지 않는다.
5. row assignment_ref/execution_ref/manifest_ref/manifest_hash/submission_state/submitted_at은 snapshot/manifest와 정확히 일치한다. submitted_by는 snapshot.submittedByRef.id, client_id는 유효 UUID다. 과거 제출자/기기를 현재 조회 OWNER와 같게 강제하지 않는다. 원 submittedByRef의 credentialGeneration/session preimage는 기록에 없으므로 hash 형식·row ID 결박까지만 검사하고 `submitterIdentityVerification:NOT_PERFORMED`다. 과거 session/계정 조회로 원 hash를 추측 재구성하지 않는다.
6. 정확 서버 command는 PROJECT/scope_id/project, APPLIED/submitResult, actor_id=row.submitted_by, client_id=row.client_id, expected_version=0, 유효 양의 control_generation/policy/authorization id, approval_consumption_id/payload_ref=null이어야 한다. 사용자 요청 command_id와 서버 id를 구별하고 `(project_id,actor_id,command_id)` 중복을 거절한다.
7. 원 요청 hash는 실제 writer의 `{schemaVersion:1,projectId,commandId:commands.command_id,clientId:commands.client_id,controlGeneration,operation:'submitResult',targetId:row.id,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{scope:snapshot.scope,submissionId:row.id,manifest:snapshot.manifest}}`를 canonical 재구성해 대조한다. 재구성 객체를 반환·실행하지 않는다.
8. 일반 receipt의 닫힌 10필드·commandId/operationId/project/APPLIED/targetId=row.id/version1·빈 evidenceRefs/warnings를 검사한다. data는 정확 ref,status,manifest,sourceKind,completionAccepted,executionAuthorized,dispatchPerformed 7필드이며 ref=manifestRef, status=RESULT_SUBMITTED, manifest 원형, sourceKind=WORKER_CLAIM, false 3개가 같아야 한다.
9. row.submitted_at/snapshot.submittedAt/receipt.serverReceivedAt와 command.completed_at은 같은 제출 transaction 사건이다. PostgreSQL 원 microsecond completed_at은 JS Date 밀리초 관측으로 정규화해 producer와 대조한다. 제출 사이 transaction 시각 대소는 강제하지 않는다. readSubmittedResultRecord의 미래 submittedAt 거절은 유효 RR clock 기준으로 유지한다.
10. 정확 authorization receipt는 id/command/PROJECT/scope_id/policy, 원 actor/client subject, approval_decision_ref=null이다. scope_digest는 `{projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef:manifestRef}`의 hash다. snapshot.authorizationReceiptRef는 `{id,version:1,contentHash:scope_digest}`와 같다. 이 대조는 저장된 국소 관계이며 현재 허가/정책 검증이 아니다.
11. 정확 감사 사건 1개는 project/command/operationId·원 actor/client·targetRef=manifestRef·policy·approval_ref=null·outcome=APPLIED·reason_code=EXPLICIT_RESULT_CLAIM_ONLY·source_kind=HUMAN_COMMAND·scope_digest와 일치한다. correction_of=null, 유효 기록시각과 고유 양의 server_sequence를 확인한다. 전체 감사 chain이나 현재 권한은 검증하지 않는다.

## 5. 외부 의존과 반환

`kind:RESULT_SUBMISSION_INVENTORY_V1`, `scope:PROJECT_RESULT_SUBMISSION_HISTORY_ONLY`.

- projectId, submissions[], issues[], externalDependencies[] 및 observation/usage를 반환한다.
- submission: 원 ref, manifestRef, 익명 snapshot, sourceEvidence(serverSequence/authorizationReceiptRef), projectionHash. snapshot.submittedByRef는 원 hash 검증 후 `{kind:HUMAN}`으로만 투영하고 실제 user/client/session ID는 반환하지 않는다. 원 snapshot contentHash와 익명 projectionHash는 구분한다. 원 manifest 내용/선언된 증거/미실행·위험·rollback은 그대로 보존한다.
- 전체 contentHash는 정확 `{projectId,submissions,issues,externalDependencies}` 4필드 canonical hash, projectionHash는 자기 필드 제외 익명 submission 전체 hash다. 원 hash를 익명 결과로 덮지 않는다.
- externalDependencies는 exact scope.assignmentRef/executionRef, manifest.baselineRefs/artifactRefs/checkpointRef, changes.diffRef, commandResults.profileRef/cwdRef/hostRef/executionRef/outputRef, testResults.baselineRefs, 각 evidence.ref/environmentRef, policy/auth receipt를 종류별로 중복 억제해 기록한다. evidence.contentHash/recordedAt/sourceKind의 선언은 원 manifest에 남긴다. VersionRef를 임의로 ArtifactRef/OS path로 해석하지 않는다.
- readPgResultExecution/현재 execution/assignment·검토/기준/재작업/현재 policy·등록 evidence·artifact 원문 조회는 금지한다. 해당 진위/접근 가능성은 NOT_PERFORMED다. manifest 상대 path/argv는 **제출된 주장 텍스트**로만 보존하며 해석·명령 실행·파일 접근을 하지 않는다.
- snapshot/manifest/반환 metadata의 알려진 민감 표식은 기존 pure 검사와 필요시 inspectArtifact로 거절한다. 원 SQL/error/cause·actor/client/session/token·실제 내부 보관 경로는 반환하지 않는다. 자유 문장의 모든 개인정보/비밀을 완전히 탐지한다고 주장하지 않는다.
- `executionReferenceVerification,evidenceProvenanceVerification,submitterIdentityVerification,policyVerification,auditChainVerification,blobVerification:NOT_PERFORMED`; `resultReviews,resultCriteria,resultReworks:NOT_COLLECTED`.
- `evidenceProvenanceVerified,completionAccepted,formalFailureCounted,fullProjectCoverage,restorable,executionAuthorized,dispatchPerformed,atomicSnapshotVerified:false`, executionEvidence=NOT_CONNECTED. sourceKind=WORKER_CLAIM. 빈 목록이어도 성공 검수/전체 백업으로 표시하지 않는다.
- metadataComplete는 미수집 증거/외부 의존이 있으면 false. fileCount/inputBytes=0. 최종 canonical UTF-8 metadataBytes는 usage 자기 자리수를 포함해 유한 고정한다.

## 6. 현재성·자원 규칙

직전 FN16_NOTIFICATION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §4의 **일반** RC/RR·신원 snapshot·deadline/회수 규칙을 재사용한다. 이 업무는 본인 알림 RLS가 아니므로 recipient 필터나 알림용 actor/client GUC를 추가하지 않는다.

양끝 RC authenticated의 동일 actor/client/credentialGeneration/session·현재 OWNER/비보관 프로젝트, 단일 RR READ ONLY의 자료 snapshot, query별 총/최단 세션 남은 timeout, 응답 후와 최종 외부 COMMIT 뒤 취소/기한 검사, BEGIN 응답 유실의 error release·단발 rollback/release·회수불명503 우선을 유지한다. 실제 pool.connect/기존 auth 전체 wall-clock 강제 중단은 보장하지 않는다. 전체 row_bytes 누적/개별 큰row CASE 억제/최종 metadataBytes를 각각 제한한다. 기존 helper 오류는 고정 무결성503, 입력400·인증401·소유404·취소409·한도/기한413·저장/민감503으로 분리한다.

## 7. 다음 검수 절차와 필수 합성 사례

- [ ] Main WI 검토/고정과 독립 preflight. 이 초안만으로 제품/시험 착수하지 않는다.
- [ ] TEST_ONLY는 신규 행동/schema 2파일만. 실제 pure parser를 통과하는 최소 fixture를 만들고 collector import 부재를 PASS로 숨기지 않는다.
- [ ] Main RED 명령: `node --test tests/unit/FN16/result-submission-inventory.test.ts tests/unit/FN16/result-submission-inventory-schema.test.ts`.
- [ ] SOURCE_GO 후 신규 source 1파일 구현. 기존 writer/parser/SQL은 바꾸지 않는다.
- [ ] 신규 시험·`npm run typecheck`·`git diff --check`의 각 exit/지문·미검증을 보고한다. 완료된 자료군 전체검사는 반복하지 않는다.
- [ ] 독립 검수 후 Main fresh 검증·기록·checkpoint. Primary Git 쓰기 0.

핵심 fixture: 빈 프로젝트; 서로 다른 과거 제출자/기기의 5종 submissionState; 같은 assignment/execution에 여러 불변 제출; 201개 paging; 세대/제출 사건 간 시각 역전; 원 snapshot hash와 별도 manifestRef/hash 차이; manifest의 PASS/COMPLETED/REVIEWER_CONFIRMED 선언을 보존하되 완료·provenance false; 원 submittedByRef·row·command·auth/audit 관계, 요청 ID 중복; execution/assignment/manifest/ref/hash/동일사건시각 변조; 잘못된 출처/false 플래그; 민감 argv/위험/rollback·잘못된 상대path·형식/과대row·표부재; 현재 execution·policy·검토를 조회하면 실패하는 query allowlist; OWNER 회수·신원 ABA·최단 세션/최종 COMMIT 취소·한도·BEGIN/회수 불명.

메모리 DB는 실제 PostgreSQL/trigger/RLS/내구성 증거가 아니다. 실제 원문·실행 증거·승인·검수·복원은 미실행이다. rollback은 신규 source/test의 검토 revert이며 기존 결과 자료 삭제가 아니다.
