# FN16 보호참조 역사 최소 metadata 내부 수집 WI — 2026-10-29

상태: 문서 초안·독립 검토 전. 제품 source/시험 GO가 아니다. Main이 실제 지문·선행을 확인하고 별도 GO를 전달한 뒤에만 구현한다. PMO 한정 A 채택은 문서 `docs/approvals/FN16_BACKUP_REFERENCE_HISTORY_SENSITIVE_SCOPE_PMO_DECISION_20261029.json` 및 결정안 SHA256 `425D6502F104A373796B10D6792AA709A9D9401CB8A11A871FC6B21168163571`에 근거한다. 기존 OWNER·세션 범위의 source·합성만 채택됐으며 별도 민감자료 권한의 충족·완전 익명성·실제 사용 권한을 승인한 것이 아니다.

## 1. 담당·허용 경로·선행

Main 어울은 관리·검수·통합, 기존 Primary는 단독 writer, 독립 Reviewer는 읽기 검수다. 예정 제품 허용은 신규 3개뿐이다.

- `apps/server/modules/backups/backup-reference-history-inventory.ts`
- `tests/unit/FN16/backup-reference-history-inventory.test.ts`
- `tests/unit/FN16/backup-reference-history-inventory-schema.test.ts`

이 WI 작성만 현재 허가됐다. 기존 23개 수집기/조합/원문 helper/API/parser/SQL·RLS·정책·role·GRANT/공통 helper/보호8/Git은 구현자 쓰기 0이다. 실제 DB·키·서비스·파일 IO·catalog·대상 원문·Agent·반출·복원 실행 0이다. 기존 Notification은 자체 RLS 문맥을 이미 설정하므로 기존23 예방적 수정·전수 회귀를 수행하지 않는다.

실제 기준: `backup-reference-store.ts` SHA256 A86CC16149DCA20BAD84A14C03453ED08E993C94C1C00495FD0F300A37AB6C38, `0053_backup_references.sql.pending` SHA256 570031EA7B666F1AC82F65D7C804E3A217611453ED61D30BA2A27D706588D0FE. R2 승인 CA7774F7 및 설치자원 승인 5A6819E6은 참조 계약이며 실제 provider·별도 민감검사 충족으로 승격하지 않는다. 시작 HEAD/branch/status 및 정확3 시작 부재를 Main이 대조한다.

## 2. 입력·인증·새 RR의 RLS 문맥

외부 입력 형식을 새로 만들지 않고 기존 `readDocumentInventoryInput`의 정확 `{projectId,limits:{metadataBytes,inputBytes,fileCount,deadlineMs}}`를 사용한다. 모든 한도는 양의 안전 정수다. accessor/추가키/잘못된 UUID/무한수는 고정 INPUT_INVALID 400이다. 실제 파일 수집은 0이지만 입력 한도를 무시하거나 무한으로 바꾸지 않는다.

시작/마지막 RC에서 기존 authenticated token을 검증하고 동일 actorId/clientId/authSession/credentialGeneration·활성 프로젝트 OWNER를 확인한다. DB clock으로 얻은 세션 잔여시간과 요청 총 deadline의 최소값만 사용한다. 오래된 본인 세션·다른 client·세대·소유권 회수·UNKNOWN은 닫힌 실패이며 OWNER를 별도 민감검사로 대체하지 않는다.

별도 Pool connection에서 `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` 후, 어떤 역사 자료 SELECT보다 먼저 검증된 RC identity를 해당 connection에만 결박한다. 기존 bounded query/statement_timeout을 적용해 `SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)`를 실행하고, 별도 `SELECT current_setting('anvil.actor_id',true) AS actor_id,current_setting('anvil.client_id',true) AS client_id` 정확 1행을 읽어 UUID·값이 RC와 정확히 같은지 확인한다. Pool의 ambient/stale 값이나 다른 인증 transaction의 설정을 신뢰하지 않는다. actor/client는 caller 제공 문자열이나 providerBoolean으로 받지 않는다. local=true를 변경하지 않는다.

설정/확인 실패·반쪽 값·다른 actor/client·빈/중복 readback은 자료 SELECT 0회로 고정503이다. 이어 실제 isolation=repeatable read/read_only=on/snapshot 형식과 OWNER를 확인하고 수집한다. 끝 RR/최종 RC에도 동일 신원·현재성/최소 기한을 검증한다. transaction-local 문맥은 rollback과 connection 정리로 회수하며 풀 재사용에 session 범위 상태를 남기지 않는다. BEGIN/rollback/release 불명은 503 우선이며 취소409·deadline/한도413으로 은폐하지 않는다. 기존 0039/0040 DENY·REVOKE를 해제하거나 누락 자료로 PASS 처리하지 않는다.

## 3. 정확 9표·116열과 keyset

모든 표는 명시 열·projectId 결박·keyset 최대200행·row_bytes 기반 반환 전 제한·수신 원형과 최종 DTO의 누적 metadataBytes를 적용한다. `SELECT *`·전표 원장 확대·임의 JOIN으로 중복 건수를 감추지 않는다.

1. backup_references 6: project_id,id,kind,head_version,created_by,created_at. 정렬 id.
2. backup_reference_versions 11: project_id,reference_id,version,snapshot_json,content_hash,previous_version,previous_hash,actor_id,client_id,command_id,created_at. 정렬 reference_id,version.
3. backup_reference_events 14: project_id,id,reference_id,reference_version,reference_hash,event_kind,reason,actor_id,client_id,command_id,created_at,version,snapshot_json,content_hash. 정렬 id.
4. 선택 commands 21: id,scope_kind,scope_id,project_id,draft_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,received_at,completed_at. 정렬 id.
5. 선택 authorization_receipts 9: id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at. 정렬 id.
6. 선택 audit_events 16: project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of. 정렬 server_sequence,event_id.
7. 선택 approval_requests 17: id,project_id,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,created_at,client_id,command_id,policy_ref,content_hash,request_json. 정렬 id.
8. 선택 approval_decisions 14: id,project_id,request_id,request_version,scope_digest,decision,reason,decided_by,client_id,control_generation,decided_at,command_id,content_hash,decision_json. 정렬 id.
9. 선택 approval_consumptions 8: id,project_id,decision_id,command_id,scope_digest,policy_id,policy_version,consumed_at. 정렬 id.

앞3표는 해당 프로젝트의 보존된 이력을 읽고, 뒤6표는 앞3표 원 command_id 및 그 approval_consumption_id에 연결된 증빙만 읽는다. 승인 표 전체·다른 명령 원장으로 확대하지 않는다. 최초 참조·반복 선택은 정확 ID 집합으로 중복 제거한다. head와 버전1..head·종류·최초 작성자 결박·이전 fullref·회수 대상 존재를 확인한다. 이후 역사 actor/client가 현재 호출자와 같다고 강제하지 않는다. 독립 사건 시각 단조·현재 만료/현재 정책에 따른 과거 삭제를 추가하지 않는다.

## 4. 원형·명령·승인·회수 검산

H는 기존 canonicalJson/contentHash다. 원 parser를 재사용해 snapshot 종류/정확 구조를 검증하되 실제 provider·파일/키·catalog를 부르지 않는다. 버전 원 ref의 hash는 H({projectId,id,version,snapshot,previousRef})다. 최초 previous null, 이후 정확 이전 버전/hash를 확인한다. head와 별개로 회수 snapshot의 원 referenceRef를 사용하며 현재 head로 치환하지 않는다.

REVOKED 사건 snapshot은 정확 eventId,version,eventKind,projectId,referenceRef,reason,actorId,clientId,clientCommandId,createdAt 10필드다. version=1·eventKind=REVOKED, 행의 project/id/원대상 fullref/이유/주체/시각과 일치하고 사건 ref=H(snapshot)여야 한다. row content_hash와 참조 버전 원hash를 검사한다. 한 대상 버전에 중복 회수 사건을 정상으로 숨기지 않는다.

`BackupReferenceStore.#receipt`의 확인 가능한 원명령 재구성을 생략하지 않는다. 원명령은 {schemaVersion:1,projectId,commandId:c.command_id,clientId,controlGeneration,operation,targetId,expectedVersion,baselineRefs:[],approvalRef,payload}이며 H(original)==c.request_hash다. 저장 operation=saveBackupReference, payload=snapshot, targetId는 최초 null/개정 id, expectedVersion=version-1. 회수 operation=revokeBackupReference, payload={referenceRef:사건의 원대상,reason}, targetId=원계열id, expectedVersion=c.expected_version이며 원 대상버전이나 현재head로 덮어쓰지 않는다.

PROJECT scope/project/draft null/APPLIED·행 actor/client·command/clientCommand/operationId/expectedVersion/정확 policyRef·receipt subjectRef를 결박한다. 일반 digest=H({projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef:저장버전ref 또는 사건ref})를 receipt/audit와 대조한다. audit는 선택 명령당 정확1·HUMAN_COMMAND/APPLIED/correction null·원 target/policy/approval/actor/client/operationId와 원 저장/회수 reasonCode를 확인한다. 결과 정확 CommandResult 외피와 ref/status(REFERENCE_STORED/REFERENCE_REVOKED)/previousRef 또는 referenceRef/빈 evidenceRefs·warnings를 검산한다.

승인 null이면 consumption/payload_ref/receipt approval/audit approval 모두 null이어야 한다. nonnull이면 선택3표를 실제 조회해 used.command_id/project/id, APPROVE 결정·동일 command actor/client/control, request candidate_command_id/정확 request version·scope digest·policy, used policy_id/version와 command policy를 대조한다. payload_ref는 정확 {kind:ONE_TIME_APPROVAL_SCOPE,payloadHash:H(payload),scopeDigest:승인digest}다. 원 request_json/decision_json·content_hash가 존재하면 실제 승인 원형 공식·행 관계를 검산하고, 존재하지 않는 원형은 가짜ref/hash로 발명하지 않는다. 필요한 nonnull 승인 연결/원명령 검산이 불가능하면 조용히 통과시키지 않고 고정503으로 닫는다. request의 현 CONSUMED 상태만으로 원승인 현재 효력을 주장하지 않는다.

DB 열은 검수된 ledger의 private PG timestamp parser와 동일 규칙(연도1..9999/offset/최대6소수·마이크로초 보존)으로 정규화한다. 원 protocol createdAt/serverReceivedAt 등은 기존 strict isoV1(.sssZ)를 유지한다. 0053 정상 쓰기는 row.created_at=date_trunc('milliseconds',c.completed_at)이므로 이 연결만 정확 밀리초 절삭 후 비교한다. completed_at 원 micro는 보존하며 단순 문자열 exact 비교나 Date 절삭으로 전체 원hash를 바꾸지 않는다. snapshot createdAt/result.serverReceivedAt은 행의 정확 .sssZ와 일치해야 한다.

## 5. 최소 opaque 결과·미충족 경계

내부 kind=BACKUP_REFERENCE_HISTORY_INVENTORY_V1, scope=PROJECT_BACKUP_REFERENCE_OPAQUE_HISTORY_ONLY. 결과의 고정 핵심은 {kind,projectId,references,versions,events,evidence,issues,externalDependencies}이며 그 canonical H를 inventoryHash로 둔다. references는 {id,headVersion}만, versions는 {ref,previousRef}, events는 {ref,referenceRef}만 내보낸다. evidence는 원 명령·receipt·audit/승인 행의 opaque ID와 canonical 원행 derivedMetadataHash만 보존한다. hash 입력은 §3의 명시 열을 숫자/시각 정규화한 내부 행이며 원request/result checksum 또는 VersionRef로 표시하지 않는다. 버전·사건 원ref.contentHash와 derivedMetadataHash를 구분한다.

snapshot/spec/descriptor/target경로·URL/key handle/fingerprint·계정/actor/client/이유·자유문자열·정책 상세/시각/raw request/result를 반환하거나 로그/오류/issue에 넣지 않는다. 원 metadata는 구조·원hash 검산용 메모리에서만 사용하고 저장/cache/외부 전달하지 않는다. 알려진 Secret 표식은 원 metadata 검증 단계에서 기존 inspectArtifact로 고정503 거절하고 값·cause·SQL을 노출하지 않는다. opaque id/hash는 완전 익명이라는 주장을 하지 않는다. reference kind도 최소 결과에 추가하지 않는다.

externalDependencies는 새 provider를 발명하지 않는다. 원형 검산에 쓰인 policy/승인 관계는 내부에서 검증하며 결과에는 정책 상세 대신 opaque ID/hash만 남긴다. 필요 시 고정 ID-only 의존과 verification NOT_PERFORMED만 사용한다. 실제 자원 ref나 실행 capability로 승격하지 않는다.

고정 선언: sensitiveAccessCheck=NOT_PERFORMED, sensitiveAccessRequirement=UNRESOLVED, resourceAvailabilityVerification=NOT_PERFORMED, currentPermissionVerification=NOT_PERFORMED, sourceSnapshot=NOT_EXPORTED. fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed/atomicSnapshotVerified는 모두 false. 별도 민감검사가 구현되지 않았다는 사실을 OWNER 성공으로 감추지 않는다. 기존23 조합에 연결하지 않고 EXPORT_BACKUP_PROTECTED_REFERENCE_HISTORY 및 전체 미수집 목록을 그대로 유지한다. 설치자원·실제 export/backup 실행 이력 전체를 보존했다고 하지 않는다.

## 6. 필수 TDD·검수·미검증·rollback

신규 source 부재 RED를 보존한 뒤 같은 Primary가 GREEN/type/diff까지 이어간다. 신규2 시험만 실행하며 기존23 완료시험을 반복하지 않는다.

- 실제 memory DB fixture의9표116열 정상 빈/비어있지 않음, TARGET/ENCRYPTION_KEY/RETENTION/VERIFICATION 4kind 각각의 정상 구조·다중버전·다른 과거 작성자·옛버전 회수와 현재head 차이·null/nonnull 승인 정상. RETENTION은 {automaticDeletion:false}의 원hash·명령·결과 정상과 true 거절을 독립 반례로 확인한다.
- 원hash/previous/head/event row·대상hash·명령 재구성/request_hash·payloadHash·receipt/audit scope·승인3표/원형·주체/client/control/ID 혼합·중복을 각각 독립 재봉인해503 검출. 다른 선행 실패에 가려진 음성을 통과 증거로 삼지 않는다.
- ms-trunc 정상 micro completed_at과 row .sssZ, 절삭한 밀리초 자체 불일치503, 원 protocol micro/offset 위반503, 원행 derivedMetadataHash의 정확 기대식·서로 다른 보존 micro의 hash 차이.
- RLS-aware fake는 actor가 없거나 다르면 자료를 숨기되 새 collector는 verifiedRC→새RR local set_config/readback을 수행한 경우에만 실제 행을 읽는다. 별도 Pool·stale ambient actor/client·정상 rollback 후 다른 사용자 재사용·설정/확인 오류·한쪽 불일치에서 자료 SELECT0을 관측한다. fixture를 항상 모든 행 반환하도록 만들어 RLS 경계를 가리지 않는다.
- free text/PII/경로/descriptor/키 표식 비노출과 known Secret 고정오류, 원형/정책/시각/actor가 최종DTO·issues·오류에 없음을 확인. provider/file/catalog 호출은0이다.
- 201행 keyset/잘못된 정렬·다른project/범위밖 선택ID/중복·메타 누적413(원조회·후속 승인·최종DTO 각각)/한도·기한·취소·마지막 RC 변경/UNKNOWN/rollback·release 불명503 우선·DB 부재실패.

정확 예정 명령: `node --test tests/unit/FN16/backup-reference-history-inventory.test.ts tests/unit/FN16/backup-reference-history-inventory-schema.test.ts`, `npm run typecheck`, `git diff --check`. 실제 PG/RLS/권한·migration 적용·provider·키·파일·서비스·UI/Agent·archive/복원은 NOT_RUN이며 합성 PASS로 승격하지 않는다. 독립 C/I0와 Main fresh 검수 전 완료로 판정하지 않는다. 구현자는3지문/명령·exit·시간·오류/미검증/writer 해제를 제출한다. rollback은 신규3 검토된 revert와 미연결 유지이며 실제 자료·권한·키 삭제0이다. 전체 WORK_PLAN은 미완료다.

기준 branch는 codex/av3-stage-b, 현재 문서 checkpoint dd47e7c7ffea24033bb5ca3c7a6ecb63cfe392ec다. Main만 신규3+이WI/PMO A승인기록/결과/WORK_STATUS/WORK_PLAN 정확8경로를 checkpoint한다. 코드·자료·권한 변경과 문서 전용 checkpoint를 구분한다.
