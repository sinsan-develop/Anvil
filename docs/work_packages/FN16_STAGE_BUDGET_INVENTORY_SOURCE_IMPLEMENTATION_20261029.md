# FN16 단계 대기열·한도 정책·예약 원장 이력 수집 구현 계획

> 담당 Primary는 `superpowers:executing-plans`와 TDD로 아래 한 업무를 수행한다. 현재는 WI 초안이며 Main 범위 검토 전 source/test 작성·실행은 하지 않는다. 신규 agent·Git 작업은 Main 담당이다.

**목표:** 기존 서버에 저장된 단계 시작/취소, 프로젝트 한도 정책 개정/회수, 전체 예약 원장을 누락 없이 읽고 당시 참조·명령 증거를 검증한 내부 메타데이터로 보존한다.

**구조:** 시작/종료 OWNER·동일 세션 RC와 중간 READ ONLY RR 한 개 안에서 명시 열을 수집한다. 첫 실행 제어 collector를 호출하거나 전체 graph를 재수집하지 않고 예약이 참조한 START/SEND 증거만 선택한다. 현재 정책·예산 가용성·실행 권한을 다시 판정하지 않는다.

**기술:** 기존 Node 24·TypeScript·pg 타입·canonicalJson/contentHash. 새 패키지·SQL·공개 API·실제 DB/키/파일/서비스 실행 0.

**근거:** 승인된 WORK_PLAN FN16, 설계 §10.4 및 `FN16_EXECUTION_CONTROL_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md`. 고유 저장 계약은 `0036_stage_queue.sql`, `0017_execution_authority.sql`, `0047_stage_start_one_time_approval.sql.pending`, `0048_limit_policy_one_time_approval.sql.pending`와 `scheduling/stage-queue.ts`, `executions/runtime-policy.ts`, `execution-budget.ts`, `execution-commands.ts`, `execution-instruction-store.ts`다. pending 파일은 실제 적용 증거가 아니다.

## 1. 업무 범위와 정확 허용 경로

신규 제품1/시험2만 허용한다.

- `apps/server/modules/backups/stage-budget-inventory.ts`
- `tests/unit/FN16/stage-budget-inventory.test.ts`
- `tests/unit/FN16/stage-budget-inventory-schema.test.ts`

진입점은 `collectStageBudgetInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<StageBudgetInventory>`다. 입력은 기존 `readDocumentInventoryInput`의 projectId/limits뿐이며 외부 원장·actor·경로·정책 설정은 받지 않는다.

공통 OWNER/동일신원·최소 세션 기한·query 직전 남은 timeout·명시 projection CTE/row_bytes/CASE·200 keyset·bigint canonical decimal·SQL JSON 시각·BEGIN 불명 회수·RR 종료 후 최종 RC/외부 COMMIT 후 취소/기한·고정 오류·민감 메타 거절·metadataBytes 고정점 계산은 첫 실행 제어 WI와 `FN16_RESPONSIBLE_SESSION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md`를 적용한다. 실제 PG timeout/cancel을 합성 결과로 증명하지 않는다. 진행 중 query를 Promise.race로 버리고 client를 정상 반납하지 않는다.

이번은 실행/중지/회수 자료 보존 3단위 중 두 번째다. 첫 단위의 grant/writer/outbox graph를 중복 출력하지 않는다. worker 관측/ACK/receipt/permit/이해검토 자료군, 전체 정책/승인 이력, 실제 backup collector/job/public profile·복원은 미완료다.

## 2. 전체 조회와 선택 증거

| 표 | 명시 열 | 범위·keyset |
|---|---|---|
| stage_runs (8) | project_id,id,sequence,input_json,created_by,client_id,command_id,created_at | 프로젝트 전체, sequence bigint ASC |
| queue_requests (7) | project_id,request_id,version,sequence,content_hash,snapshot_json,command_id | 프로젝트 전체, request_id UUID/version bigint ASC |
| limit_policy_versions (10) | project_id,policy_id,version,content_hash,snapshot_json,scope_json,created_by,client_id,command_id,created_at | 프로젝트 전체, policy_id UUID/version bigint ASC |
| usage_reservations (10) | project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,policy_id,policy_version,created_command_id | **프로젝트 전체**, server_sequence bigint ASC; version/state 필터 금지 |
| execution_commands (선택13) | project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id,created_at | usage.created_command_id 정확 집합만 |
| execution_grants (선택7) | project_id,id,version,execution_id,generation,content_hash,snapshot_json | 선택 START의 grantRef 정확 집합만; 원형은 hash/원 요청 재구성에만 사용하고 반환 0 |
| approval_consumptions (8) | id,project_id,decision_id,command_id,scope_digest,policy_id,policy_version,consumed_at | stage/queue/policy 서버 command 집합만; AUTO 추가 행 탐지 포함 |
| approval_decisions (14) | id,project_id,request_id,request_version,scope_digest,decision,reason,decided_by,client_id,control_generation,decided_at,command_id,content_hash,decision_json | 소비가 가리킨 ID만 |
| approval_requests (17) | id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,created_at,client_id,command_id,policy_ref,content_hash,request_json | 결정이 가리킨 ID만 |
| commands (19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | 자료/선택 START·SEND 및 선택 승인 요청·결정의 서버 ID만 |
| authorization_receipts (9) | id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at | 선택 commands.authorization_receipt_id만 |
| audit_events (16) | project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of | 선택 command ID만 |

명시 열을 가진 CTE 결과만 직렬화하며 SELECT */OFFSET/최신 LIMIT로 역사 생략 0. 선택 집합은 최대200씩 조회하고 선택 밖 행/중복/누락을 거절한다. primary ID/버전, global sequence 유일·정렬과 generated scope/policy 열을 원 JSON과 대조한다. 없는 표/열은 503이며 빈 결과로 대신하지 않는다. credentials/challenges/proofs/provider 설정/키 보관소는 조회하지 않는다.

## 3. 단계 시작·취소 역사

- stage input 정확8필드: stageRef,methodologyApplicationRef,mode,startNodeRef,endBoundaryRef,baselineRefs,budgetRef,reason. `stage-queue.ts startInput`과 0036의 닫힌 형태·nodeId·모든 applicationRef 일치·stage=start·CASE_BY_CASE start=end·중복 없는 비어 있지 않은 baselineRefs≤200·reason·2MiB를 검사한다. AUTO 경로의 현재 graph 모드/도달성은 다시 계산하지 않고 외부 의존 미검증으로 남긴다.
- queue snapshot 정확18필드: projectId,requestId,version,sequence,state,input,assignmentRef,readinessIssues,queuedAt,cancelledAt,cancelledBy,cancellationReason,requestedBy,previousRef,slotReserved,writerReservationPerformed,executionAuthorized,dispatchPerformed. 원 canonical hash·행·stage.input/sequence·requestedBy를 대조하고 snapshot 2MiB 제한을 적용한다. assignmentRef=null, false4, 원 readiness 4개 순서를 그대로 보존한다.
- 각 stage는 queue v1 WAITING을 가진다. stage.sequence는 프로젝트 1..N이며 queue v1/v2에서 동일하다. v1 previous/cancellation3=null, stage.command_id=queue.command_id이며 동일 receipt target은 **queue ref**다. 공유 명령은 한 번만 검증한다.
- 선택적 v2 CANCELLED는 정확 v1 previousRef, version/state/cancelledAt/cancelledBy/cancellationReason/previousRef 이외 원형 동일, 새 command와 실제 취소자다. 취소 후 새 v3·재시작·추가 stage 생성으로 해석하지 않는다.
- queuedAt=stage.created_at이며 기존 코드/0036이 실제 요구하는 cancelledAt≥queuedAt은 유지한다. 두 시각은 clock_timestamp 기반이므로 receipt.serverReceivedAt/commands.completed_at의 transaction_timestamp와 동일 강제를 **추가하지 않는다**. 서로 다른 stage 간 시각 단조도 추가하지 않는다. 명령 내부 receipt/completed_at은 동일 사건으로 대조한다.
- start request는 startStage/null/0/기존 input, cancel은 cancelQueuedRequest/requestId/1/{requestRef,reason}; baselineRefs=[]다. receipt data는 {ref,queueState,snapshot}, reason은 각각 EXPLICIT_STAGE_QUEUE_WAITING / EXPLICIT_UNSTARTED_QUEUE_CANCELLATION이다. v1 감사→v2 감사의 논리 선후를 검사한다.
- input.budgetRef는 이번 수집 안의 exact 정책이며 당시 APPLIED, expiresAt>queuedAt을 대조한다. 현재 latest/만료/회수로 과거 시작을 거절하지 않는다. application/baseline 원자료는 재수집하지 않으며 검증 NOT_PERFORMED다.

## 4. 한도 정책 개정·회수

원 snapshot 정확11필드: limits,scope,reason,policyBaseVersion,state,previousRef,decidedBy,decidedAt,expiresAt,executionAuthorized,dispatchPerformed. 순수 `readLimitPolicyInput`/`readRevokeLimitPolicyInput`으로 원 payload를 검사할 수 있다. current resolver/작성 서비스는 호출하지 않는다.

- scope는 실제 지원 PROJECT/projectId만 허용한다. EXECUTION scope의 미연결 저장을 정상으로 승격하지 않는다. scope_json과 원 JSON을 대조한다.
- 프로젝트 scope의 policy ID 하나·1..N 연속, policyBaseVersion=version-1, v1 APPLIED/previous=null, 이후 직전 exact ref. APPLIED는 expiresAt=decidedAt+maxElapsedMs. REVOKED는 직전 APPLIED의 limits/expiresAt 그대로이며 연속 REVOKED는 거절한다. REVOKED 뒤 새 APPLIED는 실제 writer가 허용하므로 보존한다.
- limits는 기존 정수/유한 비용/통화 규칙 그대로: attempts≤3, elapsed≤7200000, calls≤50, concurrency=1, spool≤1073741824, offline≤min(300000,elapsed), 선택 maxCost/currency 쌍. reason/원 hash를 보존한다. 새 비용 계산 정책을 만들지 않는다.
- decidedBy=행 created_by=command actor, client 동일, decidedAt/행 created_at/receipt/completed_at은 transaction 시각으로 대조한다. **정책 버전 간 timestamp 단조를 추가하지 않는다.** 직전 정책 명령→다음 명령의 감사 선후를 검사한다.
- 원 요청은 applyLimitPolicy 또는 revokeLimitPolicy, target=previous?.id/null, expected=policyBaseVersion, baseline=[]다. apply payload4, revoke payload3. receipt status는 LIMIT_POLICY_APPLIED/LIMIT_POLICY_REVOKED, reason EXPLICIT_LIMIT_POLICY_AUTHORING이다.

## 5. 프로젝트 전체 usage와 실제 미지원 전이 경계

**전체 SELECT는 하지만 지금 실제 저장이 지원하는 것은 v1 RESERVED뿐이다.** 0017:482~487은 v1/RESERVED/usage·previousRef·evidenceRef=null을 초기 graph에 강제하고 deferred graph가 INSERT를 검사한다. `execution-instruction-store.ts`도 SEND version1만 저장한다. `advanceExecutionBudget`는 순수 모델이며 후속 전이를 저장하는 생산자/명령·receipt 계약은 없다.

따라서 version>1 또는 DISPATCHED/UNKNOWN/SETTLED/CANCELLED를 발견하면 `STAGE_BUDGET_INVENTORY_UNSUPPORTED_HISTORY` 503으로 전체 수집을 거절한다. 해당 행을 WHERE 조건으로 숨기거나 모델상 유효하다는 이유로 정상 DB 역사로 반환하지 않는다. 가짜 실행/관측 명령·receipt를 생성하지 않는다. **후속 전이 저장과 그 전체 보존은 미완료**다. 이 경계는 Main이 실제 코드/SQL 근거를 확인해 채택한 것이다.

지원 원장에서는 다음을 검사한다.

- snapshot 정확9필드(sequence,claim,state,usage,previousRef,checkedAt,evidenceRef,executionAuthorized,dispatchPerformed), 원 hash, 행 server_sequence=sequence·프로젝트 1..N, reservation/ref version1 및 중복 없는 commandId. claim 정확9필드와 demand5필드는 기존 execution-budget readClaim 규칙을 따른다. 행 command_id는 사용자 요청 ID, created_command_id는 서버 commands.id이며 혼동하지 않는다.
- policy_id/version는 claim.policyRef와 같고 수집한 exact 정책 hash·scope와 연결된다. 당시 policy APPLIED 및 decidedAt≤checkedAt<expiresAt은 예약 모델의 기존 조건이다. 현재 정책/잔여 예산/비용 청구를 다시 계산하지 않는다.
- 원 예약은 기존 실제 START/SEND의 exact execution_commands.snapshot.reservationRef와 일치해야 한다. 명령당 예약1개이며 command 사용자 ID·project·execution/generation·operation·assignment·policy와 연결한다. START 원 요청은 선택한 원 EXECUTION grant의 hash/fact를 이용해 재구성한다. SEND는 원 request와 currentBinding.fact/`readSyntheticInstructionReservation`을 사용한다. SEND 당시 policy가 최초 grant policy와 달라도 정상이며 당시 fact.intent.budgetPolicyRef와 대조한다.
- START/SEND 원 record parser·원 hash/봉투 hash·국소 receipt/auth/audit를 검사하지만 grant/writer/outbox 전체 graph를 재검증·복제하지 않는다. 그 부분은 `executionGraphVerification=NOT_PERFORMED`로 명시한다. 원 grant/fact/envelope/source path/subject는 출력하지 않는다.
- 최종 projection은 ref, sequence, claim의 비식별 task/stage/policy refs와 operation/demand, state/null3/checkedAt/false2만 남긴다. claim.commandId는 반환하지 않으며 원 ref.contentHash와 익명 projectionHash를 분리한다. 실제 비용·전송 성공 또는 실행 허가로 표시하지 않는다.

## 6. 명령·AUTO·일회승인 국소 증거

공통 commands19/auth9/audit16의 exact PROJECT·APPLIED·원 요청 hash·원 receipt target/data·원 actor/client/control/policy·scopeDigest·선택 집합·유일성 규칙은 책임 세션 WI §4를 따른다. distinct `(project_id,actor_id,사용자 commandId)`는 stage/policy/선택 queue/승인 증거를 통틀어 유일하다. 최초 stage+queue 공유만 같은 서버 증거로 한 번 처리한다. 원 취소자/정책 개정자/과거 실행자가 조회 OWNER와 달라도 정상이다.

- AUTO는 consumption/payload_ref/auth decision/audit approval 모두 null이며 선택 consumption0이다. 당시 정책 AUTO 여부를 현재 권한으로 재인가하지 않는다.
- 소비 지원은 startStage/applyLimitPolicy/revokeLimitPolicy뿐이며 cancelQueuedRequest와 선택 START/SEND는 AUTO다. 해당 서버 command의 exact consumption→decision→request만 같은 RR에서 선택한다. 전체 승인 수집기를 호출하지 않는다.
- mutable request status CONSUMED/version3과 불변 request_json PENDING/version1을 구분한다. request 원7필드/decision 원9필드 hash, 행/JSON/원 policy·actor/client/control·requiredDecider·scopeDigest·candidateCommandId·actionScope payloadHash와 실제 원 payload·targetRef/expectedVersion을 대조한다.
- command.approval_consumption_id·payload_ref, auth decision ID, audit approvalRef, consumption.command_id/decision/scope/policy를 결박한다. 정책 apply/revoke에만 runtime-policy의 consume≥decision.decidedAt 및 consume<request.details.expiresAt을 적용한다. startStage의 기존 readStageStartConsumption/#history/0047은 소비시각의 이 대소조건을 요구하지 않으므로 형식만 검사하고 정책 조건을 이월하지 않는다. 현재 시각 만료로 거절하지 않으며 요청 생성시각 하한 등 타 기능 조건을 복사하지 않는다.
- 승인 requestApproval/decideApproval 명령도 exact 요청/receipt/auth/audit를 검증한다. 요청→결정→실행의 감사 논리 선후를 유지한다. reason/위험/rollback/기한은 익명 역사로 보존하고 재소비·권한 복원하지 않는다.

## 7. 반환과 검증 범위

kind=STAGE_BUDGET_INVENTORY_V1. 전체 inventoryHash는 canonical `{kind,projectId,stageRuns,queueRequests,limitPolicies,usageReservations,approvals,externalDependencies}` 8필드다. 관측 시각/usage는 이 hash에서 제외한다. 각 원 ref/hash와 익명 metadata의 projectionHash를 따로 제공한다. stage run에는 독립 원 ref를 발명하지 않고 queue v1 원 ref와 inputHash로 출처를 식별한다.

개별 reason/cancellationReason/원 readiness와 APPLIED/REVOKED/WAITING/CANCELLED 이력을 보존한다. actor/client/user/session·명령 원문/실행 source 경로·grant/envelope 원형은 반환하지 않는다. 자료/승인 원 hash를 먼저 검증한 뒤 HUMAN/REDACTED로 투영한다. 원 metadata·투영 모두 기존 민감 표식 검사를 거친다.

verification에는 currentPolicyVerification/currentBudgetAvailability/providerChargesVerification/executionGraphVerification=NOT_PERFORMED, usageTransitionPersistence=NOT_IMPLEMENTED를 표시한다. slotReserved/writerReservationPerformed/executionAuthorized/dispatchPerformed/authorizationRestoration/atomicSnapshotVerified/fullProjectCoverage/restorable=false를 유지한다. 원문 bytes/파일은 읽지 않으므로 inputBytes/fileCount=0, metadataBytes는 실제 결과 직렬화 크기다. 실제 PG/RLS/0047·0048 적용/사용자 UI·백업/복원은 NOT_RUN이다.

## 8. 한 단위 TDD와 완료 검수

- [ ] 신규 행동/schema2 작성. 빈 자료, stage+queue v1 공유명령/다른 actor 취소v2, 한도 apply→revoke→apply와 시각 역전, AUTO/소비·과거 만료승인, 전체 v1 START/SEND 예약·당시 새 정책을 정상으로 구성한다. 정책/단계 history로 201 keyset를 검증하며 허용되지 않는 동시 초기 실행/초과 SEND fixture를 만들지 않는다.
- [ ] 음성은 원 hash/request/auth/audit 재결박 후 정확 관계까지 도달: stage/queue 공유명령/previous/불변필드·현재와 과거의 혼동, 정책 limits/expiry/revoke 계보, 지원되지 않는 usage 전이와 누락 sequence/정책ref/사용자·서버 command 혼동/고아 예약, approval 소비/원 payload·ID 재사용·감사역전. 원래 외부 현재성 검사와 국소 증거 검사를 혼동하지 않는다.
- [ ] OWNER·세션 교체, 최종 외부 COMMIT 뒤 취소/기한, 큰 row/누적 한도/민감 metadata, BEGIN/rollback/release 실패를 핵심만 검증한다. 실제 JSON timestamp 문자열과 bigint 문자열을 fixture에 포함한다. 실제 DB 또는 현재서비스처럼 부르는 fake는 금지한다.
- [ ] Main GO 뒤 Primary가 신규 source 부재 RED를 실행·보존하고 source1 GREEN까지 연속 수행한다. 기존 첫 collector 전수검증/수정 0. 신규 fixture의 저장 제약 오류는 구체적으로 보고하고 제품을 약화해 맞추지 않는다.
- [ ] `node --test tests/unit/FN16/stage-budget-inventory.test.ts tests/unit/FN16/stage-budget-inventory-schema.test.ts`, `npm run typecheck`, `git diff --check` 각 exit/result·변경3 hash·미검증을 제출한다. Main 집중 재검증과 독립 C/I 검수 후 기록·통합한다.

rollback은 신규3파일의 해당 branch source 변경만 대상으로 한다. 실제 데이터·권한 rollback은 없다. 이 WI로 usage 후속 전이 저장/실행/설정 발급을 구현하거나 전체 FN16 완료를 선언하지 않는다.
