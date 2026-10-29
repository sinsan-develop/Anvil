# FN16 실행 명령·복구 허가·회수 이력 수집 작업지시서 초안

2026-10-29 / codex/av3-stage-b / 기준 17ddf0b5b3243365610b6a4d5b1acd2cfdd44da8 / **Main 검토 전·제품/시험 GO 아님**

**목표:** 실행 시작·후속 지시·중지 명령, 복구용 허가와 허가 회수의 연결 이력을 비밀 없는 metadata로 보존한다. 저장된 합성 계획을 실행·중지 성공이나 유효한 권한으로 복원하지 않는다.
**방법:** writing-plans로 범위를 고정하고 Main GO 뒤 기존 단독 Primary가 executing-plans/TDD로 RED→GREEN→type/diff를 연속 수행한다. Main은 집중 재검증·독립 검수·문서 동기화·Git 통합을 담당한다.
**기준:** WORK_PLAN/FUNCTION_WORK FN16, 설계서 §10.4 및 신산님의 실행·중단·회수 이력 source 구현 지시. 실제 키·DB·서비스 변경은 제외한다.

## 1. 논리 업무 분할·정확 허용 경로

0017~0024와0036/0047~48 전체는 HUMAN 명령 그래프, 단계 대기열/예산 정책, worker 관측이라는 서로 다른 생산자·증거 권위를 가진다. 다음 3단위로 나누며 **첫 단위만 이 문서의 구현 범위**다.

1. 실행 명령·복구 허가·회수 및 보류 outbox, 최초 실행의 공유 명령 그래프: 이번 단위.
2. 단계 실행/대기열과 한도 정책·사용량 전체 전이: stage_runs/queue_requests/limit_policy_versions/usage_reservations 전체 이력. 이번에는 명령이 직접 참조한 예약 v1만 국소 대조한다.
3. worker 관측·수신/ACK·이해 검토·실행/지시 permit: 0018/0019/0024 자료군. credential/challenge/proof의 비밀을 반출하지 않는 별도 수집 범위가 필요하다. 이번에는 참조 metadata만 외부 의존으로 기록한다.

전체 실행·중단·회수 이력 완료는 세 단위와 후속 조합 검수가 필요하다. 첫 단위를 전체 FN16·백업 실행 완료로 표시하지 않는다.

현재 쓰기는 이 WI 한 파일뿐이다. Main GO 이후 신규 허용은 정확 다음 3개다.

- apps/server/modules/backups/execution-control-inventory.ts
- tests/unit/FN16/execution-control-inventory.test.ts
- tests/unit/FN16/execution-control-inventory-schema.test.ts

기존 source/helper/시험/SQL·보호 untracked8·Git 쓰기 0. 실제 DB/FS/원문/키/서비스/Agent/P03/job·설정 발급·새 route 연결 0. 기존 collector 전체를 호출하거나 현재 execution resolver/store.current를 호출하지 않는다.

## 2. 공통 계약·실제 근거

OWNER 양끝 별도 RC·동일 신원/최단 세션기한·외부 COMMIT 뒤 기한/취소, 단일 RR READ ONLY·200 keyset·명시 projection/SQL row-size 억제·query마다 남은 timeout·BEGIN/COMMIT 불명과 cleanup503 우선은 FN16_CONTEXT_PREPARATION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §1과 연결 공통 WI를 그대로 따른다. 진행 중 query/pool을 Promise.race로 강제 종료하거나 조기 release하지 않는다.

실제 근거:

- db/migrations/0017_execution_authority.sql: 초기 6표 공유 명령 그래프·grant/intent/envelope 해시·writer와예약.
- db/migrations/0020_execution_recovery.sql,0021_execution_stop.sql,0022_execution_grant_revocation.sql: 복구 grant·STOP 명령·회수 별도 불변 행. 0024_execution_instruction_permits.sql은 SEND 참조 구조의 근거이나 permit 자체는 제외한다.
- apps/server/modules/executions/execution-commands.ts,execution-grants.ts,execution-command-record.ts: 최초 queue의 원 요청/영수증/공유 기록.
- 같은 디렉터리 execution-instruction-queue.ts/execution-instruction-store.ts,execution-stop.ts/execution-stop-store.ts,execution-recovery.ts/execution-recovery-store.ts,execution-grant-revocation.ts/execution-grant-revocation-store.ts: 각 원형·hash·정확 참조와 outbox 생산자.
- contracts/runtime/dispatch-envelope-v1.ts,server-execution-fact-v1.ts,source-scope-v1.ts: 원형 문법. DispatchEnvelopeV1은 ref·시각·scope·hash 구조이며 토큰/서명 필드가 없다. 그래도 원 봉투는 반환하지 않는다.
- db/migrations/0011_authorization.sql의 delivery_outbox 11열. 0034_assignment_parent_drafts.sql의 outbox guard도 현재 재실행하지 않는다.

실제 파일목록에서 0023 migration은 발견되지 않았다. 존재하지 않는 SQL을 근거로 만들거나 SEND의 실제 DB 적용을 보증하지 않는다. 이 단위는 현존 producer 원형/표를 읽는 source와 합성 검증이며 실제 guard 적용·RLS·SQL 실행은 NOT_RUN이다.

`collectExecutionControlInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<ExecutionControlInventory>`

입력은 readDocumentInventoryInput의 projectId/limits만 사용한다. 외부 배열·actor/client·grant·봉투·경로를 입력받지 않는다. 고정 오류는 기존 INPUT_INVALID400/NOT_FOUND404/권한401·403, INVENTORY_CANCELLED409, INVENTORY_LIMIT_EXCEEDED413, EXECUTION_CONTROL_INVENTORY_INTEGRITY_FAILED503, INVENTORY_CLEANUP_UNKNOWN503로 구분하며 원 DB/파서 오류·cause를 노출하지 않는다.

## 3. 명시 조회 열과 범위

| 표 | 허용 열 | 범위·keyset |
|---|---|---|
| executions (9) | project_id,id,generation,transport,state,created_by,client_id,command_id,created_at | 프로젝트 전체, (id UUID,generation bigint) |
| execution_grants (11) | project_id,id,version,execution_id,generation,content_hash,snapshot_json,created_by,client_id,command_id,created_at | 프로젝트 전체, (id UUID,version bigint) |
| writer_claims (12) | project_id,id,execution_id,generation,grant_id,grant_version,scope_json,expires_at,ownership_state,created_command_id,issued_at,reclaimed_at | 프로젝트 전체, id UUID |
| execution_commands (13) | project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id,created_at | 프로젝트 전체, (id UUID,version bigint) |
| execution_grant_revocations (13) | project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,snapshot_json,created_by,client_id,created_command_id,created_at | 프로젝트 전체, (id UUID,version bigint) |
| usage_reservations (선택10) | project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,policy_id,policy_version,created_command_id | START/SEND의 exact reservationRef와 해당 서버 명령의 예약 v1만 |
| delivery_outbox (11) | id,project_id,command_id,kind,destination_ref,payload_ref,scope_digest,state,attempt_count,next_attempt_at,last_error_code | 프로젝트의 EXECUTION_SYNTHETIC_ONLY/EXECUTION_INSTRUCTION_SYNTHETIC_ONLY/EXECUTION_STOP_SYNTHETIC_ONLY, id UUID |

command19/auth9/audit16의 정확 열은 FN16_RESPONSIBLE_SESSION_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md §2와 같다. 위 주표의 서버 command ID 집합에만 명시 조회한다. 보조 집합도200씩 읽고 동일 id로 추가 행/다른 scope를 숨기지 않는다. 사용자 command_id와 서버 commands.id를 혼동하지 않는다. SELECT *·OFFSET·최신200·현재 head로 역사 대체 금지. bigint는 canonical decimal safe integer, JSON timestamp는 유효값으로 정규화한다. 미지원 kind/state·표/열 부재는 고정503이며 raw fallback/조용한 누락은 없다.

선택 usage는 원 ref와 서버 명령의 v1 행을 양쪽 대조하여 추가/누락을 검출한다. 예약 전체 원장의 연속 sequence나 사용량 전이를 여기서 검증했다고 주장하지 않는다. 실행에 연결되지 않은 나머지 예약은 두 번째 단위의 NOT_COLLECTED다.

## 4. 원 hash·명령·관계

### 4.1 원형 검증과 초기 공유 그래프

- execution은 SYNTHETIC_ONLY/SYNTHETIC_QUEUED. grant/명령/회수 ref version=1. 각 프로젝트/실행ID/세대·grant ID/version/hash가 정확해야 한다.
- START는 readSyntheticQueuedCommandRecord, SEND는 readSyntheticInstructionQueueRecord, STOP은 readSyntheticStopCommandRecord, RECOVERY는 readSyntheticRecoveryRecord, 회수는 readSyntheticGrantRevocationRecord의 **과거 형식용 순수 함수**를 사용한다. 호출 시 현재 시각 대신 각 원형의 기록 시각을 사용하는 기존 parser 의미를 유지한다. 그 모듈의 command/read/current/append는 호출하지 않는다.
- START content_hash=H(snapshot에서 envelope 제외). SEND/STOP=H(snapshot에서 request와 envelope 제외). envelope_hash=H(envelope에서 envelopeHash 제외). grant/회수 content_hash=H(snapshot 전체). H는 기존 canonicalJson+contentHash다. 원 ref hash를 익명화 이후 재계산한 값으로 바꾸지 않는다.
- EXECUTION grant는 정확11필드 kind/state/transport/binding/allowedOperations/expiresAt/scopeDigest/factHash/plannedAt/executionAuthorized/dispatchPerformed다. binding은 readServerExecutionFactV1으로 형식 검증; factHash=H(binding), scopeDigest=H({binding,allowedOperations,expiresAt}). allowedOperations와 생성당시 checks/writerState/mode·read scope의 관계는 planSyntheticExecutionGrant/0017의 저장 형식으로 대조한다. 무작위 ref를 만드는 planner는 호출하지 않는다. 현재 session·정책·OS·registration을 재조회하지 않는다.
- 최초 execution+EXECUTION grant+START reservation v1+writer claim+START command+outbox는 **하나의 서버 command/receipt**를 공유한다. 각1개, 서로 exact ref·scope·subject·sourceScopes·기한·예약·등록 ref가 같고 START의 receipt target은 commandRef다. 같은 명령을 여섯 번의 중복 요청으로 세지 않는다. 고아/중복/누락 graph는503.
- usage.command_id는 사용자 요청 ID, usage.created_command_id는 서버 ID. 원9필드 snapshot hash/sequence/claim·RESERVED/usage null/previousRef null/evidenceRef null/false2를 대조한다. claim의 operation·assignment/stage/policy·demand 및 최초 attempts1/SEND0, calls양수·spoolBytes비음수·cost의 기존 유한 소수/통화 계약을 유지한다. SEND는 readSyntheticInstructionReservation으로 원 기록과 결박한다. subset에 전체 ledger를 호출하여 sequence1부터를 강제하지 않는다.
- writer는 최초 grant와 같은 scope_json/expiry·SYNTHETIC_CLAIM·서버 명령을 대조한다. 원래 불변 생산 범위에서 reclaimed_at null을 유지하며 회수 행 존재만으로 이 값을 수정하거나 writer 해제 성공으로 표시하지 않는다. 향후 다른 writer 해제 producer는 별도 범위다.

### 4.2 후속 지시·중지·복구·회수

- SEND는 기존 EXECUTION grant와 같은 실행세대, 새 예약1+명령1+outbox1을 같은 서버 명령으로 생성한다. 기존 grant/writer를 새로 만들지 않는다. STOP은 EXECUTION 또는 RECOVERY grant를 참조하며 명령1+outbox1만 생성한다. grantKind·exact ref·scope는 저장 원형과 실제 참조 grant에 맞아야 한다.
- RECOVERY는 execution_grants의 kind=RECOVERY이고 원 EXECUTION grant를 exact reference한다. 원 originalGrantState/lastServerAck/processIdentity/responsibleSessionRef·reason/purpose·allowedOperations는 당시 사실/주장을 유지한다. 같은 RR에서 원 grant의 hash/kind/실행세대를 대조하되 최신 ACK/현재 등록·신뢰·프로세스를 조회하지 않는다. ACK/process 등 외부 의존은 미검증이다. RECOVERY는 새 execution/writer/START/outbox가 아니다.
- 회수는 execution_grant_revocations 별도 행이고 원 grant snapshot을 갱신하지 않는다. grant별 회수 최대1, reference/kind/subject·sourceScopes/policy와 원 request/receipt를 대조한다. revocationEffectiveVerified/credentialRevocationVerified/writerReleaseVerified/executionAuthorized/dispatchPerformed=false를 그대로 보존한다.
- 저장된 현재성 문자열 ACTIVE/EXPIRED/VERIFIED_CURRENT/TRUSTED 등은 **생성 당시 값**이다. 현 시각 만료를 이유로 과거 원형을 제외하거나 최신 정책/ACK/owner와 같다고 요구하지 않는다. requester와 조회 OWNER가 달라도 정상이다. 요청자, grant subject, recovery reviewer의 역할은 구별하며 서로 같다는 조건은 해당 실제 parser/producer에 있는 경우만 적용한다.

### 4.3 원 요청과 국소 authorization/audit

- START 원 요청은 0017 check_initial_execution_graph의 식으로 복원한다: command의 user commandId/client/control, queueExecutionCommand, targetId null/expectedVersion0/baselineRefs[]/approvalRef null; payload는 grant.binding.preparationRef,executionId,generation,permissionPolicyRef,budgetPolicyRef,operation START_SESSION,queue payload. 원 request_hash와 일치해야 한다.
- SEND/STOP/RECOVERY/회수는 snapshot.request의 원형 hash를 검증한다. operations는 각각 queueExecutionCommand/requestExecutionStop/authorizeExecutionRecovery/revokeExecutionGrant. targetId=executionId,expectedVersion=실행세대,baselineRefs[],approvalRef null이다.
- 공통 명령은 PROJECT scope/project 동일·APPLIED, payload_ref/approval_consumption_id null인 기존 AUTO 경로다. 원 request/client/control·policy·result_ref/target/version 및 해당 저장 snapshot/intent가 정확해야 한다. 원 사용자 요청 유일키는 project+actor+commandId이며 operation을 넣어 중복을 허용하지 않는다.
- 국소 auth digest=H({projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef}); auth id/command/scope/subject/policy/approval null 및 audit command/operation/actor/client/target/policy/approval null/APPLIED/HUMAN_COMMAND/scopeDigest를 실제 receipt와 대조한다. envelope.context.authorizationReceiptRef와 execution_commands.authorization_ref는 {id:command.authorization_receipt_id,version:1,contentHash:auth.scope_digest}와 같다.
- grant row의 command는 RECOVERY일 때 grant를 target으로 삼고, 최초 EXECUTION일 때 START command를 target으로 삼는 공유 receipt임을 구분한다. 각 stored receipt.status와 snapshot은 실제 producer의 SYNTHETIC_QUEUE_STORED/SYNTHETIC_INSTRUCTION_QUEUE_STORED/SYNTHETIC_STOP_STORED/SYNTHETIC_RECOVERY_STORED/SYNTHETIC_GRANT_REVOCATION_STORED를 직접 대조하여 사용한다.
- timestamp 유효성·원 snapshot 내부의 기한 관계와 같은 사건 receipt/command 시각 관계만 검증한다. queuedAt/requestedAt/recordedAt/plannedAt는 clock_timestamp, created_at은 transaction 시작 기본값일 수 있으므로 모두 동일하게 강제하지 않는다. 서로 다른 사건의 timestamp 단조성도 추가하지 않는다. 현재 session/policy 재인증·과거 승인 재실행은 하지 않는다.

### 4.4 outbox

원 kind별 destination/payload는 producer 정확 shape로 검사한다. START의 digest는 grant.scopeDigest, STOP/SEND는 H({scope,commandRef,grantRef,envelopeHash})다. grantKind는 START destination에는 없고 STOP/SEND에 존재하므로 공통 shape로 강제하지 않는다.

각 명령의 outbox1과 역방향 고아 검사, HELD_SYNTHETIC_ONLY·attempt_count0·next_attempt_at/last_error_code null을 대조한다. 이 상태는 보류 기록이고 실제 전달/수신/중지 성공이 아니다. RECOVERY/회수에는 outbox를 발명하지 않는다.

## 5. 비밀 없는 반환·누락 경계

결과 kind=EXECUTION_CONTROL_INVENTORY_V1. observation/usage는 기존 공통 metadata 형식. canonical hash 대상은 정확9필드 kind,projectId,executions,grants,commands,reservations,writers,revocations,outbox이고 externalDependencies는 별도 정렬·projectionHash를 둔다. 각 항목은 원 ref/hash(있는 경우)와 명시 metadata 투영/해시를 구별한다.

투영은 실행ID/세대, 각 ref/kind/상태/operation, 원 reason/purpose, 기록·만료 시각, 관련 exact VersionRef와 논리 부모, 예약 수치/원 상태, worker/writer 효과의 false, 익명화한 명령 증거만 포함한다. grant.binding/현재성 원형·request·envelope·authorization_ref·subject/reviewer/userId/clientId/humanSessionId·hostPublicKeyFingerprint·원 registration 객체·sourceScopes의 경로/target 목록은 반환하지 않는다. source scope는 sourceRoot/mapping/observation/baseline ref와 targetCount 및 원 scopeHash만 투영한다. 삭제/익명화된 원 해시는 projection hash로 덮지 않는다. raw metadata는 검증 중에만 쓰며 알려진 민감 표식은 고정503으로 거절한다.

execution_credentials/execution_challenges 및 proof/서명/비공개키/보호 저장 참조는 **조회 자체를 금지**한다. grant snapshot·봉투는 이번 국소 hash 검증 때문에 읽지만 원형 반환 금지다. 동적 키 이름 재귀복사 대신 DTO를 명시 생성한다. known-marker 검사만으로 완전한 비밀 탐지라고 주장하지 않는다.

externalDependencies에는 임무/문맥/준비/connection/environment/capability/source/등록·이해/ACK/process/정책 등의 정확 참조를 종류와 함께 보존한다. 내부 grant/command/ref가 누락되면 외부미검증으로 낮추지 않는다. 외부 원문/전체 policy·등록/권한 이력은 조회하지 않는다.

반환 한계: authorizationRestoration=false, executionAuthorized=false, dispatchPerformed=false, writerReleaseVerified=false, credentialRevocationVerified=false, atomicSnapshotVerified=false, fullProjectCoverage=false, restorable=false. 현재 권한/OS·서비스/Agent 효과와 외부 참조는 NOT_PERFORMED, 단계queue/한도정책 전체/usage전이/worker관측·ACK·permit·understanding 이력은 NOT_COLLECTED. 국소 snapshot/ref/hash/auth-audit 일치가 그 미검증을 대체하지 않는다.

## 6. TDD·검수

- [ ] 행동시험: 실제 pure parser를 통과하는 최초6표 공유 그래프, SEND, EXECUTION/RECOVERY STOP, 복구와원grant회수, 다른 과거actor, 현재만료된 과거계획,201 keyset을 포함한다. 최소fixture는 필요한 정확참조만 구성한다.
- [ ] 중요한 음성: intent/envelope hash 혼동·원 요청 hash·공유 receipt target 변조, grant/실행세대/예약/subject 불일치, 초기graph누락·고아outbox, 다른operation의 동일actor 요청ID재사용, 회수 false의 성공변조, token/서명 원형추가·민감 표식·projection 누출. 변형 뒤 관련 ref/receipt를 재결박하여 의도한 검사에 도달한다.
- [ ] OWNER/세션 변경·외부 COMMIT 뒤 취소/기한,200 초과·거대 row·누적 UTF8 metadata 한도,BEGIN/COMMIT/rollback/release 오류와cleanup우선. 과거 current source를 호출하지 않는 SQL/포트 관측을 포함한다.
- [ ] schema시험은 실제 migrations의 명시 열/PK·열수 및 forbidden credential/challenge/proof 조회0, SELECT*/OFFSET0을 대조한다. 없는0023/원본파일을 정상이라고 가정하지 않는다.
- [ ] 신규2시험 RED를 실제 기록한 뒤 source1만 구현하고 GREEN. 기존 기대값/생산자/SQL 변경0. 첫 RED가 미구현 진입 실패이면 각 후속 보안 반례를 실제 재현했다고 주장하지 않는다.
- [ ] `node --test tests/unit/FN16/execution-control-inventory.test.ts tests/unit/FN16/execution-control-inventory-schema.test.ts`, `npm run typecheck`, `git diff --check`를 각 exit와 함께 기록한다. 완료된 collector 전체 반복0.
- [ ] Main 신규 집중 검증·독립 C/I 검수 뒤 지문/미검증/rollback·WORK_STATUS·통합을 처리한다. 합성 PASS는 실제 PG/RLS/guard·runtime/백업/복원 PASS가 아니다. rollback은 신규3파일만 후속 Main Git 절차로 제거하며 지속 데이터는 변경하지 않는다.
