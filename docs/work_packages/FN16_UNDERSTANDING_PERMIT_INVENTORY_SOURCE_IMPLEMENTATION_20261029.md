# FN16 이해 검토·START/SEND permit 역사 수집 작업지시서 초안

2026-10-29 / codex/av3-stage-b / **Main 검토 전, 제품·시험 GO 아님**

## 1. 업무와 허용 경로

승인된 FN16 실행 이력 보존의 마지막 연결 묶음이다. HUMAN 이해 검토의 전체 버전과 worker START/SEND 일회 permit 소비 기록을 구분하여 내부 metadata로 수집한다. ACCEPTED/CONSUMED는 과거 저장 사실이며 현재 실행 허가·실제 Agent 수행 성공이 아니다.

현재 쓰기는 이 문서1뿐이다. Main GO 뒤 기존 Primary 단독 writer의 신규3 경로만 허용한다.

- `apps/server/modules/backups/understanding-permit-inventory.ts`
- `tests/unit/FN16/understanding-permit-inventory.test.ts`
- `tests/unit/FN16/understanding-permit-inventory-schema.test.ts`

함수: `collectUnderstandingPermitInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<UnderstandingPermitInventory>`.
입력은 기존 `readDocumentInventoryInput` projectId/limits. 외부 역사·권한·actor·경로·proof 입력0.

OWNER 양끝 RC/동일 신원·최소 세션 기한, 단일 RR READ ONLY, 명시 projection CTE/CASE/row_bytes, 200 keyset/선택집합200, query별 timeout, 최종 RC 외부 COMMIT 뒤 기한/취소, BEGIN 불명 client 폐기·회수 우선·고정 오류, metadataBytes 고정점은 `FN16_OBSERVATION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md` 공통 규칙을 따른다. 실제 DB/FS/키/서비스/Agent/P03/job·route·설정·Git 변경0. 기존 collector 전체 호출/공유 helper 변경0.

실제 근거: `0019_understanding_reviews.sql`, `0018_execution_observation.sql` START 부분, `0024_execution_instruction_permits.sql`, `execution-understanding.ts`/`execution-understanding-store.ts`, `execution-permits.ts`/`execution-permit-store.ts`, `execution-instruction-permits.ts`/`execution-instruction-permit-journal.ts`/`execution-instruction-permit-store.ts`.

## 2. 명시 조회 범위

| 표 | 명시 열 | 조회 및 keyset |
|---|---|---|
| understanding_reviews (11) | project_id,execution_id,generation,id,version,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체; execution_id,generation,version |
| execution_start_permits (9) | project_id,execution_id,generation,id,version,proof_result_id,proof_result_version,content_hash,snapshot_json | 프로젝트 전체; execution_id,generation,id,version |
| execution_instruction_permits (17) | project_id,execution_id,generation,id,version,command_id,command_record_id,command_record_version,grant_id,grant_version,reservation_id,reservation_version,proof_result_id,proof_result_version,envelope_hash,content_hash,snapshot_json | 프로젝트 전체; execution_id,generation,id,version |
| execution_commands (선택13) | project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id,created_at | permit.commandRef의 exact id/version; id,version |
| execution_grants (선택7) | project_id,id,version,execution_id,generation,content_hash,snapshot_json | permit.scope.grantRef; id,version |
| usage_reservations (선택10) | project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,policy_id,policy_version,created_command_id | SEND reservationRef만 exact reservation_id/version |
| execution_receipts (선택9) | project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json | 두 permit.proofRef만 exact id/version |
| commands (선택19) | id,command_id,scope_kind,scope_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id,payload_ref,completed_at,operation_id,request_hash | understanding_reviews.command_id만; id |
| authorization_receipts (선택9) | id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at | 선택 HUMAN command.authorization_receipt_id만; id |
| audit_events (선택16) | project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of | 선택 HUMAN command.id 집합; event_id |

모든 selected query는 project/scope와 exact ref 또는 command 집합에 한정하고 누락/중복/선택 밖 반환을 거절한다. UUID/bigint의 실제 형식·safe integer 한도를 검사한다. 모든 primary를 읽어 손상 version/중복을 발견하며 WHERE version=1, LIMIT1, latest 대체로 숨기지 않는다. 지원 표/열 부재는503이며 빈 결과 fallback0.

`execution_credentials`, `execution_challenges`, host/provider key 저장소는 조회0. `execution_receipts`에는 kind/challengeRef/requestId/proofHash/recordedAt/false3만 있으므로 그 선택 원형은 해시검사용으로 읽을 수 있다. 서명·nonce·private/public key 원문은 읽지 않는다. grant/command/currentFact에는 과거 subject·source path·fingerprint가 있으므로 메모리 검사 뒤 raw 반환0. 원 실행 명령의 HUMAN receipt/auth/audit/outbox 전체 그래프는 이번에 중복 수집하지 않으며 국소 ref/hash 관계와 미검증 표시를 분리한다.

## 3. 이해 검토 전체 역사와 AUTO 명령

원 snapshot13: scope,sequence,previousRef,request,requestHash,reviewer,policyRef,currentBinding,input,outcome,recordedAt,executionAuthorized,dispatchPerformed.

- 원 canonical 전체 hash를 먼저 검증. 실행/세대별 동일 id, version/sequence1..N≤1000, exact previousRef, 실제 `readUnderstandingHistory`의 전체 배열≤2MiB를 유지한다. 순수 함수만 재사용하며 store/current/requireAccepted 호출0.
- input6필드와 criteria6개, MATCH/MISMATCH/INSUFFICIENT, 이유, source/response refs, basis/required/received/response part 관계를 순수 역사 parser로 검사한다. 결과는 모든 MATCH면 ACCEPTED, 그 외 NOT_ACCEPTED. 순서를 보존하고 후속 NOT_ACCEPTED로 과거 ACCEPTED를 삭제하지 않는다.
- currentBinding13필드의 sourceState=AVAILABLE/responseSubject=EXTERNAL_AGENT는 당시 기록이다. 현재 원문/응답/기준을 다시 조회하지 않고 역사 parser의 형식·상호참조만 확인한다.
- **recordedAt 비감소는 실제0019와 역사 parser의 규칙이므로 유지**. 일반 사건 간 timestamp 조건을 추가하지 않는다. recordedAt은 clock_timestamp, 행 created_at·명령 completed_at·receipt.serverReceivedAt은 transaction 사건이므로 후자3만 millis 정규화 일치이며 recordedAt과 동일 강제0.
- row.created_by/client_id와 snapshot.reviewer, 원 request의 client/control/project/target execution/generation을 대조한다. 과거 reviewer가 현재 수집 OWNER와 달라도 정상이다. request는 reviewUnderstanding, baselineRefs=[], approvalRef=null, payload=input이고 requestHash=hash(원 request)=command.request_hash. scope PROJECT/project, state APPLIED, expectedVersion=generation, operationId/사용자 commandId/서버 command.id를 구별한다.
- AUTO 전용: command.approval_consumption_id/payload_ref=null; auth.approval_decision_ref=null. 현재 permission policy나 제어권을 재실행하지 않는다.
- receipt 정확형식은 persistProjectReceipt의 원 결과: status APPLIED, targetId=review.id/version, data `{ref,status:'SYNTHETIC_UNDERSTANDING_REVIEWED',snapshot}`, evidenceRefs/warnings=[]와 정확 operationId/request commandId/project. reasonCode `EXPLICIT_HUMAN_UNDERSTANDING_REVIEW`.
- auth scopeDigest=`hash({projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef})`, subject와policy, audit target/ref·operation·source HUMAN_COMMAND·APPLIED·approvalRef null·correctionOf null를 대조한다. `(project,actorId,commandId)` 유일성, 서버 명령/auth/audit 일대일, 중복 server_sequence0. 버전 인과관계는 exact previousRef와 실제 저장 순서이며 관계 없는 timestamp 순서를 만들지 않는다.
- 원 request/reviewer.userId/clientId/humanSessionId는 해시 검증 후 제거·익명화한다. input 이유·항목/원고정참조·currentBinding의 비개인 metadata는 보존하고 별도 projectionHash를 계산한다. 원 snapshot hash를 익명본으로 덮지 않는다.

## 4. 두 permit의 공통 국소 역사

두 표의 permit은 **새 HUMAN 명령을 만들지 않는다**. commandId는 원 실행 봉투의 사용자 명령 ID이고 commandRef는 execution_commands 서버 기록 ref다. 가짜 command/auth/audit 생성0.

- ref.version=1 및 snapshot 원hash/닫힌 형식, scope7필드(mode EXECUTION,credentialGeneration1,project/connector/execution/generation/grantRef), 원 상태·false2, timestamp 형식 검사. scope는 행·선택 grant/command/receipt와 정확히 같다. 회수된 grant/현재 만료는 역사 삭제나 재인가 근거로 사용하지 않는다.
- request4필드 envelopeHash/localAttemptRef/sourceObservationRefs/osOwnershipRef. 정확 원 requestHash, sourceObservationRefs의 원 순서·중복 제거 방식과 fact.intent.sourceScopes.observationRef 집합을 대조하고 osOwnershipRef가 당시 osFence.evidenceRefs에 포함됨을 확인한다. 실제 파일/OS 소유 확인이 아니다. SEND localAttemptRef.version1 제약을 START에 임의 복사하지 않는다.
- 선택 실행 명령은 기존 pure START/SEND record parser로 원 hash·봉투 해시·실행 scope를 검사한다. 원 row grant/authorization_ref·envelope context, permit.commandRef/commandId/request.envelopeHash와 결박한다. STOP record를 permit의 정상 분기로 확대하지 않는다.
- 선택 grant는 EXECUTION snapshot 닫힌 형식/원hash·factHash/scopeDigest 및 binding의 순수 `readServerExecutionFactV1`을 검사한다. permit.currentFact도 같은 pure parser로 검사하되 당시 writerState OWNED, non-understanding checks VERIFIED_CURRENT, WORK의 understanding ref/check와 CONTEXT_REVIEW의 READ-only는 기존 생산자의 역사조건을 보존한다.
- currentFact.understandingReviewRef가 있으면 이미 수집한 동일 scope의 exact review ref에 연결하고 WORK에 필요한 ACCEPTED 기록과 대조한다. 현재 latest 여부/현재 source 동일성은 재판정하지 않는다. 현재 resolver·permission·OS·grant deadline 함수 호출0.
- 선택 proof receipt는 관측 WI의 정확8필드 SYNTHETIC_PROOF_RESULT/원hash·version1/false3·row challenge id/version·grant scope 검사를 재사용한다. grant+challenge 중복0, 두 permit 집합의 동일 proofRef 재사용0. challengeRef/proofHash는 불투명 역사참조다. requestId는 반환0.
- challenge target/bodyHash/nonce consumption·signature·현재 credential/registration/grant 유효성·COMMIT 시점 원자성은 조회범위 밖이므로 NOT_PERFORMED. stored `proofExpiresAt`을 실제 challenge 조회로 검증했다고 주장하지 않는다.

## 5. START와 SEND의 서로 다른 고정식

### START

원 snapshot13: scope,commandId,commandRef,request,requestHash,proofRef,bindingHash,currentFact,state,issuedAt,expiresAt,executionAuthorized,dispatchPerformed.

- state SYNTHETIC_CONSUMED_NO_AUTHORITY. 실행/세대별 최대1행(0018 UNIQUE); 모든 행을 읽은 뒤 검사한다. 원 grant/command/proof 정확결박.
- `bindingHash=hash({scope,commandRef,authorizationReceiptRef:command.authorization_ref,fact:currentFact에서 checkedAt만 제외})`.
- `currentFact`에서 checkedAt/checks/expires/writerState를 제외한 값은 grant.binding의 같은 제외값과 동일(0018). 명령의 START payload/context/budget/source/human session/등록과 fact 관계는 기존 producer의 국소 조건을 확인한다.
- checkedAt≤issuedAt≤checkedAt+30초, issuedAt<expiresAt≤issuedAt+30초. expiresAt는 fact.expires 최소와 원 command envelope expiry·저장 grant expiry를 넘지 않는다. 실제 challenge expiry 및 현재 dynamic deadline은 미검증이다. START에 SEND의 checkedAt+30초 expiry 상한을 임의 추가하지 않는다.
- pure START ledger가 public export가 아니므로 이 역사형식/원식의 최소 로컬 검증을 구현한다. consume/current나 private 메서드 우회 호출0.

### SEND

원 snapshot18: scope,commandId,commandRef,request,requestHash,proofRef,authorizationReceiptRef,bindingHash,currentFact,reservationRef,state,issuedAt,expiresAt,commandExpiresAt,grantExpiresAt,proofExpiresAt,executionAuthorized,dispatchPerformed.

- state SYNTHETIC_INSTRUCTION_CONSUMED_NO_AUTHORITY. 실행/세대별 최대50, `{complete:true,permits:[...]}` canonical≤2MiB. record/원snapshot2MiB, id·commandId·proofRef 중복0. 같은 실행의 여러 SEND를 START1회와 혼동하지 않는다.
- `bindingHash=hash({scope,commandRef,authorizationReceiptRef,reservationRef,fact:currentFact에서 checkedAt/expires 제외})`.
- `currentFact`의 checkedAt/expires 제외값은 SEND command.currentBinding.fact에서 expires 제외값과 동일. authorizationReceiptRef와 원 command envelope/row authorization_ref가 같다. commandExpiresAt는 원 envelope expiry, grantExpiresAt는 SEND 원 binding.grantExpiresAt에 결박한다. 최초 grant expiry와 무조건 같다는 추가 조건0.
- 선택 예약은 exact ref, 실제지원 v1 RESERVED 원형이다. `readSyntheticInstructionReservation` 순수검사를 사용하고 row policy/command_id(사용자)/created_command_id(서버)·reservation id/version/hash를 대조한다. SEND 예약 ID는 fact.budgetReservationRef의 원 START 예약 ID와 달라야 하며 claim의 commandId/policyRef/assignmentRef는 해당 SEND 기록·fact에 정확히 결박한다. 당시 SEND fact의 policy를 최초 START policy로 바꾸지 않는다. 후속 usage 모델을 저장역사로 정상 승격0.
- `SyntheticInstructionPermits.readStoredLedger`는 pure static이므로 재사용 가능하다. 현재권한 판정용 now를 전달하지 않고 해당 scope의 유효한 stored issuedAt 최댓값을 형식검사 상한으로만 사용하거나 동일 역사조건을 로컬검사한다. 기록보다 현재 clock이 뒤로 갔다는 이유로 과거를 거절하지 않는다. 새로운 fabricated proof/current 공급0.
- 기존 ≤30초·fact.checkedAt+30초·fact.expires/commandExpiresAt/grantExpiresAt/proofExpiresAt 상한은 원 저장 값 사이 관계로 검사한다. 현재시각과 비교해 유효 permit로 반환하지 않는다.

## 6. 결과와 미검증

kind=`UNDERSTANDING_PERMIT_INVENTORY_V1`. 전체 inventoryHash는 canonical 정확7필드 `{kind,projectId,understandingReviews,startPermits,instructionPermits,proofResults,externalDependencies}`. observation/usage는 제외한다.

이해 검토는 sourceRef/익명 snapshot/원 requestHash/국소 sourceEvidence를 보존한다. permit은 ref·scope의 비밀없는 실행/connector/grant metadata·원 commandRef/requestHash/허용 request refs·bindingHash·state·issued/expiry·false를 반환한다. 원 commandId는 commandRef로 대체, raw currentFact/grant/envelope/source paths/actor/session/fingerprint는 반환0. currentFact의 순수 metadata projection이 필요한 경우 고정 assignment/context/budget/understanding refs 및 원 currentFactHash만 유지한다. proofResults는 ref/challengeRef/proofHash/recordedAt/false3만 보존한다. 각 투영 projectionHash와 원 ref/hash를 구별한다.

`currentAuthorityVerification/proofSignatureVerification/challengeTargetBindingVerification/nonceAtomicConsumptionVerification/executionCommandEvidenceVerification/sourceContentVerification/osOwnershipVerification=NOT_PERFORMED`. 당시 HUMAN 검토 국소 auth/audit 검사는 전체 감사체인 검증이 아니므로 auditChainVerification=NOT_PERFORMED.
`credentialHistory/challengeHistory/otherProofReceipts=NOT_COLLECTED`; 실행/credential 발급·권한복원·원자snapshot·전체projectcoverage·복원가능성 false. inputBytes/fileCount0. 메타 수집기의 합성 PASS는 전체 백업/복원·현재실행 허가 완료가 아니다.

## 7. 연속 TDD와 인계

Main GO 뒤 신규 behavior/schema2 RED→source1 GREEN→type/diff를 연속 수행한다. 기존 완료 collector 검사를 반복하지 않는다.

- 정상: 같은 scope 이해 ACCEPTED→NOT_ACCEPTED/다른 reviewer·원정책, 과거 ACCEPTED를 가리킨 START 및 별도 SEND 여러개, 서로 다른 scope, 빈 프로젝트, 프로젝트 합계201행 paging(단일scope 50/1000/START1한도는 초과하지 않음). 만료된 기록 보존·clock/transaction시각 차이.
- 원hash/receipt/auth/audit까지 재봉인한 exact parent/sequence/request/actor·AUTO 위반, 결과/criteria 불일치·국소명령 재사용을 검사한다. 현재 latest 판정을 추가해서 정상 과거를 거절하지 않는다.
- START/SEND branch별 bindingHash 제외필드 차이, command/proof/grant/reservation row↔snapshot exactref/hash·scope 불일치, 재사용 proof/command, START2/ SEND51, state/false·expiry 원상한 위반. 단순 상위hash실패로 후단관계 검사를 통과했다고 주장하지 않는다.
- 민감 metadata·row CASE 억제·누적한도, OWNER/신원 회수·COMMIT뒤 취소/기한·query/BEGIN/회수 오류 최소반례. 실제키/challenge/credential 조회가 발생하면 fake가 즉시거절한다.
- 명령: `node --test tests/unit/FN16/understanding-permit-inventory.test.ts tests/unit/FN16/understanding-permit-inventory-schema.test.ts`, `npm run typecheck`, `git diff --check`. 정확 exit/RED원인/GREEN·3SHA·미실행을 제출한다. 실제PG/RLS·서명/nonce 원자성·Agent/UI/운영·백업/복원 NOT_RUN.

Main 독립 C/I 해소·집중검증 후 이 단위만 통합한다. rollback은 신규3파일 소스만이며 지속데이터·권한 변경 없음. 제품의 사용자용 backup 호출선/미채택 정책·전체manifest 조합은 별도 미완료로 남긴다.
