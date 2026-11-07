# FN16 worker 관측·ACK·고정 결과 이력 수집 작업지시서 초안

2026-10-29 / codex/av3-stage-b / **Main 검토 전, 제품·시험 GO 아님**

**목표:** worker가 보고한 관측, 모든 ACK 버전, proof 결과에 고정된 최초 ACK 관계를 내부 metadata로 보존한다. STARTED/STOPPED/heartbeat 주장을 실제 실행·중지·회수 성공으로 바꾸지 않는다.
**방법:** writing-plans로 범위를 고정하고 Main GO 뒤 기존 단독 Primary가 신규3파일의 RED→GREEN→type/diff를 연속 수행한다. Main은 독립 검수·집중 재검증·기록·Git 통합을 담당한다.
**근거:** 승인된 WORK_PLAN FN16/설계 §10.4와 실행·중단·회수 이력 지시. 실제 계약은 `0018_execution_observation.sql`, `execution-observations.ts`, `execution-observation-store.ts`, `execution-authenticated-observations.ts`, `execution-challenge-store.ts`다.

## 1. 분할과 허용 경로

실행 이력의 세 번째 자료군에는 서로 다른 생산자 두 묶음이 있다. 이번은 **관측→ACK→proof 결과의 고정 ACK** 한 업무다. `understanding_reviews`의 HUMAN AUTO 검토와 `execution_start_permits`/`execution_instruction_permits`의 일회 소비 이력은 별도 후속이다. 기존 실행 제어·단계 예산 collector 전체를 호출하거나 다시 구현하지 않는다.

현재 쓰기는 이 문서 하나뿐이다. Main GO 이후 신규3 경로만 허용한다.

- `apps/server/modules/backups/observation-inventory.ts`
- `tests/unit/FN16/observation-inventory.test.ts`
- `tests/unit/FN16/observation-inventory-schema.test.ts`

진입점: `collectObservationInventory(access: AccessRepository, token: string, value: unknown, signal: AbortSignal): Promise<ObservationInventory>`.
입력은 기존 `readDocumentInventoryInput` projectId/limits뿐이다. 외부 원장/actor/경로/proof를 입력으로 받지 않는다.

공통 OWNER 양끝 RC·동일 신원/최소 세션 기한·중간 RR READ ONLY·명시 projection CTE/CASE/row_bytes·200 keyset·query별 남은 timeout·최종 외부 COMMIT 후 취소/기한·BEGIN 불명/회수 우선·고정 오류·민감 투영·metadataBytes 고정점은 `FN16_STAGE_BUDGET_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md` 공통 규칙을 그대로 따른다. 기존 공유 helper/source/SQL/시험·보호8·Git 변경0. 실제 DB/RLS/원문 FS/키/서비스/Agent/P03/job·설정/route 연결0.

## 2. 비밀 없는 조회 범위

`execution_receipts`의 실제 `recordResult` snapshot은 kind/challengeRef/requestId/proofHash/recordedAt/credentialIssued/executionAuthorized/dispatchPerformed **8필드**다. 서명·nonce·토큰·공개/비밀 키가 없으므로 이번에는 observation result가 직접 가리킨 해시 metadata만 선택 조회한다. 이름에 proof가 있다는 이유로 조회를 금지하지 않으며, 이 해시를 검증된 서명으로도 승격하지 않는다.

**조회하지 않는 표:** execution_credentials, execution_challenges 및 host/provider 키·등록 credential 저장소. challenge raw/서명/nonce/키를 재구성하거나 결과에 넣지 않는다. `proofHash`는 원 불투명 해시로 보존하며 preimage/signature 검증은 NOT_PERFORMED다.

| 표 | 명시 열 | 조회·정렬 |
|---|---|---|
| execution_observations (11) | project_id,execution_id,generation,id,version,event_sequence,grant_id,grant_version,content_hash,snapshot_json,event_id | 프로젝트 전체, execution_id UUID/generation bigint/event_sequence bigint |
| execution_acknowledgements (9) | project_id,execution_id,generation,id,version,grant_id,grant_version,content_hash,snapshot_json | 프로젝트 전체, execution_id/generation/version |
| execution_observation_results (9) | project_id,execution_id,generation,proof_result_id,proof_result_version,ack_id,ack_version,content_hash,snapshot_json | 프로젝트 전체, execution_id/generation/proof_result_id/proof_result_version |
| execution_receipts (선택9) | project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json | results의 exact proofResultRef 집합만, id/version |
| execution_grants (선택7) | project_id,id,version,execution_id,generation,content_hash,snapshot_json | 관측/ACK/선택 receipt가 참조한 grant id/version만, id/version |
| execution_commands (선택13) | project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id,created_at | event의 exact 실행/세대/commandId/envelopeHash 집합만, id/version |

모든 selected query는 project 조건과 최대200 exact key를 사용한다. 명령 선택 key는 `(execution_id,generation,snapshot_json.envelope.commandId,envelope_hash)`의 정확 tuple이며 존재하지 않는 SQL column을 만들지 않는다. 명시 열 CTE를 JSON으로 감싼 크기를 SQL에서 먼저 검사하고, SELECT */OFFSET/latest LIMIT·version1 WHERE로 손상 이력 숨기기0. 누락·중복·선택 밖·교차 project/scope/ref를 거절한다. bigint는 canonical decimal safe-int만 허용한다. 없는 표/열은 고정503이며 빈 자료로 대체하지 않는다.

선택 grant/command의 원 JSON은 hash와 국소 연결을 검사하는 메모리 입력에만 쓴다. grant 원형·humanSessionId·subject/클라이언트·sourceScopes 경로·envelope·원 HUMAN 요청은 반환하지 않는다. 기존 전체 명령 receipt/auth/audit 그래프는 재조회하지 않고 `executionCommandEvidenceVerification=NOT_PERFORMED`로 구분한다. worker 관측/receipt에는 HUMAN command_id가 없으므로 가짜 명령/auth/audit를 만들지 않는다.

## 3. 관측 원형·명령 연결

원 snapshot 정확7필드: event,grantRef,credentialGeneration,mode,receivedAt,transport,verification. event 정확12필드: projectId,executionId,executionGeneration,sequence,eventId,type,commandId,envelopeHash,localRecordRef,processRef,occurredAt,reasonCode.

- ref.version=1, canonical snapshot hash, 행 project/execution/generation/event_sequence/event_id와 exact 일치. 동일 실행/세대에서 sequence·eventId·원 ref ID 중복0. sequence는1..10000 범위지만 **gap은 정상**이며 연속성 강제0.
- 실제0018 저장은 mode=EXECUTION, credentialGeneration=1, transport=SYNTHETIC_ONLY, verification=PROVIDER_CLAIM_ONLY다. 순수 모델의 RECOVERY 허용을 실제 저장 지원으로 확대하지 않는다. 지원되지 않는 원형은503으로 분리한다.
- type: RECEIVED/PREPARED/START_ATTEMPTED/PERMIT_RECORDED/PROVIDER_RESPONSE_RECEIVED/STARTED/REJECTED/UNKNOWN/STOP_REQUESTED/STOPPED/STOP_UNCONFIRMED/HEARTBEAT.
- reasonCode: NONE/UNVERIFIED_PROVIDER_CLAIM/PROVIDER_RESPONSE_LOST/RECORD_UNCERTAIN/STOP_UNCONFIRMED/REJECTED_BY_PROVIDER. localRecordRef는 exact VersionRef, processRef는 null 또는 exact VersionRef. timestamp 형식과 원 생산자의 event 64KiB 한도를 검사한다. 현재 시각·현재 grant 만료로 과거 자료를 재인가하지 않는다. 서로 다른 사건의 timestamp 순서를 임의로 추가하지 않는다.
- 실행/세대별 전체 event 수≤10000 및 실제0018의 canonical snapshot 합계≤16MiB 유지. 수집기의 metadata 누적 한도도 별도로 유지한다.
- row grant id/version와 snapshot.grantRef를 선택 grant의 원 hash에 연결하고 동일 실행/세대를 확인한다. 이번 실제 저장의 EXECUTION grant snapshot hash/닫힌 형태·binding의 순수 `readServerExecutionFactV1` 구조만 대조한다. 현재 credential/주체/OS/권한은 조회하지 않는다.
- event commandId/envelopeHash는 해당 실행/세대의 선택 execution command와 정확히 일치해야 한다. 기존 순수 START/SEND/STOP record parser로 원 record hash·envelope hash·scope를 검사한다. event의 grant와 해당 command 원 grant가 반드시 같다는 **추가 조건은 두지 않는다**(0018은 실행/세대/commandId/envelopeHash로 연결). event의 source claim이 최신 명령이라는 조건도 없다.

## 4. ACK 전체 역사와 최신 요약의 서로 다른 검증

원 ACK snapshot 정확10필드: execution,highestContiguous,maxSequence,contiguousDigest,gaps,storedCount,writerReleaseVerified,executionAuthorized,dispatchPerformed,recordedAt.

- execution scope/행, 원 canonical hash, false3, 모든 정수·hash·gaps의 닫힌 `{from,to}` 형식을 검사한다. gaps는 범위·정렬·중복 없는 정상 구간이며 원 배열 순서를 보존한다.
- 동일 실행/세대에서 ACK ID 하나, version1..N 연속≤10000. 선택 grant 행의 scope/ref를 대조한다. 실제0018 guard가 요구하는 storedCount의 엄격 증가 및 recordedAt의 비감소는 유지한다. 이것은 일반 timestamp 단조 규칙의 복사가 아니라 해당 표의 실제 제약이다.
- **과거 ACK를 현재 전체 events로 summarize하지 않는다.** 각 과거 ACK는 원 hash·닫힌 형식·version/증가 관계를 보존하며 `historicalAckEventSetVerification=NOT_PERFORMED`다. 그때의 event 집합을 receivedAt 정렬이나 최신 자료로 추정하지 않는다.
- 해당 실행의 **마지막 ACK만** 현재 RR에서 수집한 전체 events로 `execution-observations.ts summarize`의 원 알고리즘을 적용한다: sequence 정렬, missing gaps, highest contiguous, max sequence, storedCount 및 digest를 계산한다. 초기 digest=hash([]), 연속 event마다 hash({previous:digest,eventHash:hash(event)}). 마지막 ACK의 recordedAt 제외9필드와 exact 비교한다. 요약은 원 event 기준이며 명령ID 제거 후 계산하지 않는다.
- 순수 `inspectStoredObservationJournal`는 전체 events+마지막 ACK의 형태·요약 참고 근거다. 클래스/store/current/ingest를 호출하거나 가짜 현재 허가를 공급하지 않는다. 현재 조회 시각으로 과거 상태를 재판정하지 않도록 역사 수집에 필요한 구조/요약 검사를 로컬 최소 함수로 구현할 수 있다. 공용 helper 변경0.
- events가 있으면 마지막 ACK 필수. events 없는 고아 ACK/빈 ACK 정상 승격0(실제 storedCount 첫값>0). 동일 실행의 gap을 채운 후 새 ACK, 동일 batch replay로 새 ACK 없이 같은 ACK를 가리키는 복수 결과 모두 정상이다.

## 5. 선택 receipt와 최초 ACK 고정 결과

receipt snapshot 정확8필드는 §2와 같다. kind=SYNTHETIC_PROOF_RESULT, version1, challengeRef.version1/행 challenge_id/version 일치, requestId UUID, proofHash 64hex, recordedAt 유효, false3, 원 snapshot hash를 검사한다. row grant의 exact scope/ref를 선택 grant에 연결한다. 같은 grant/challenge로 복수 receipt가 있는 손상은 기존 UNIQUE와 맞춰 거절한다. challengeRef 원 hash는 불투명 외부 참조로 보존하고 원 challenge 또는 signature를 읽어 검증했다고 주장하지 않는다.

result snapshot 정확7필드: transport,proofResultRef,ackRef,bodyHash,recordedAt,executionAuthorized,dispatchPerformed. 행에는 독립 UUID ref가 없으므로 가짜 ref를 만들지 않는다. scope+proofResultRef의 원 key와 `content_hash`를 출처 식별로 보존한다.

- transport SYNTHETIC_ONLY/false2, 원 hash, bodyHash, timestamp 및 exact proofResultRef·ackRef를 검사한다. 행 proof ID/version/ACK ID/version과 수집된 원본의 ID/version/hash가 모두 같아야 한다. receipt grant scope도 해당 result 실행/세대와 같다.
- 동일 proof result가 프로젝트의 여러 scope/result로 중복 사용되지 않는다. 선택 밖 receipt/ACK로 대체0. 누락과 원 hash 불일치는503이다.
- 최초 result가 ACK v1을 가리킨다면 이후 ACK v2가 있어도 **v1을 그대로 보존**한다. 현재 latest ACK로 바꾸지 않는다. 당시 result 생성 시점의 latest였는지는 별도 역사 권한/원자성 증거 없이 주장하지 않는다.
- bodyHash는 당시 challenge.target.bodyHash와 결박되지만 challenge 조회가 이번 범위 밖이므로 `challengeTargetBindingVerification=NOT_PERFORMED`. 원 요청 body가 없어 batch 원문/서명 preimage도 검증하지 않는다. receipt/result/ACK 서로 다른 clock 사건에 timestamp 동일/대소 조건을 추가하지 않는다.

## 6. 반환·미수집 경계

kind=`OBSERVATION_INVENTORY_V1`. 전체 inventoryHash는 canonical `{kind,projectId,observations,acknowledgements,observationResults,proofResults,externalDependencies}` 정확7필드다. observation/usage는 제외한다. 각 원 hash/ref를 보존하고 비식별 metadata마다 projectionHash를 따로 계산한다.

관측 metadata는 event commandId를 선택 commandRef로 대체하고 eventId/type/sequence/envelopeHash/localRecordRef/processRef/시각/reasonCode·grantRef 및 PROVIDER_CLAIM_ONLY를 보존한다. 원 event/원 snapshot hash는 그 투영으로 재계산하지 않는다. ACK에는 원 요약과 원 ref/recordedAt을 보존한다. result에는 고정 proofResultRef/ackRef/bodyHash/recordedAt/false를 보존한다. proofResults에는 ref/challengeRef/proofHash/recordedAt/false만 반환하며 requestId는 원형 해시 검증 후 투영에서 제외한다. grant/command의 원 subject·source path/envelope/request·키/nonce/서명 반환0.

검증/범위 표시는 다음과 같다.

- `verification=PROVIDER_CLAIM_ONLY`, `proofSignatureVerification/challengeTargetBindingVerification/historicalAckEventSetVerification/executionCommandEvidenceVerification/currentAuthorityVerification=NOT_PERFORMED`.
- `understandingHistory/startPermitHistory/instructionPermitHistory/otherProofReceipts/credentialHistory/challengeHistory=NOT_COLLECTED`.
- `writerReleaseVerified/executionAuthorized/dispatchPerformed/credentialIssued/authorizationRestoration/atomicSnapshotVerified/fullProjectCoverage/restorable=false`.
- inputBytes/fileCount=0, metadataBytes는 실제 결과 canonical UTF8 크기. 실행·중지·회수 전체 자료군 완료/실제 backup·복원 완료 아님.

## 7. 연속 TDD·완료 증거

1. 신규 행동/schema2에서 실제 열·producer shape를 대조한다. 정상: gap이 있는 event3개→과거 ACK v1과 gap 보완 v2, v1/v2로 고정된 여러 results, 서로 다른 command 참조, 한 scope의201 events paging, 빈 프로젝트. 존재하지 않는 HUMAN command/auth/audit fixture0. receipt에는 공개 합성 hash만 사용하고 서명/nonce/키를 넣지 않는다.
2. 핵심 음성: 원 hash 재봉인 후 행 event sequence/id/scope/ref 불일치; 같은 sequence/eventId; 없는 exact command/envelope; ACK version/ID·실제 storedCount/recordedAt 역행; 마지막 요약/digest/gap 불일치; 과거 ACK를 최신으로 바꾼 result; receipt/ref/hash/중복 proof; mode/false/원형 손상. latest로 바꾼 result는 원hash만 바꿔도 무조건 손상으로 판정하지 않으며 **행 ack_id/version과 snapshot의 불일치** 또는 선택 고정조회 변조를 명확히 재현한다. 모두 함께 바뀐 당시 최신 선택의 진위는 NOT_PERFORMED 경계다.
3. 큰 row·총 metadata·민감 표식·cross-project·OWNER/신원 회수·외부COMMIT 후 취소/기한·BEGIN/rollback/release 불명은 기존 pattern으로 최소 확인. 모든 fake SQL은 명시 SELECT/200 keyset와 금지 표 조회0을 관측한다. 과거 ACK를 현재전체events로 검증하지 않는 정상 반례를 반드시 포함한다.
4. Main GO 뒤 신규 미구현 RED를 보존하고 제품1 GREEN까지 연속 진행한다. 새 fixture 오류는 실제 계약 근거로 교정하되 제품 조건을 낮추지 않는다. `node --test tests/unit/FN16/observation-inventory.test.ts tests/unit/FN16/observation-inventory-schema.test.ts`, `npm run typecheck`, `git diff --check`의 각 exit/result와3 SHA를 제출한다. 기존 완료 collector 전수 재실행0.

실제 PG/RLS/서명/원자성/키/서비스/Agent/UI/백업·복원은 NOT_RUN. Main 집중 재검증·독립 C/I 해소 후 이 단위만 통합한다. rollback은 신규3 source 변경만이며 데이터/권한 변경 없음. 남는 다음 연결 업무는 이해검토·START/SEND permit 역사이며 별도 정확 WI 뒤 수행한다.
