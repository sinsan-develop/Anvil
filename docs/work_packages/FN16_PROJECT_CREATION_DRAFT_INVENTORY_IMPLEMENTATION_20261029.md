# FN16 본인 프로젝트 생성 초안·선택 귀속 metadata 내부 수집 WI — 2026-10-29

상태: 문서 초안·제품 GO 전. Main·독립 검토 뒤 별도 GO로 신규3코드만 착수한다. 기준 branch codex/av3-stage-b, 직전 보호참조 checkpoint ce9c79661f41cdc374eab110a3ba987bb2963a26. 이번 업무는 기존 FN16 프로젝트 보존 중 본인이 작성해 해당 프로젝트에 소비된 현재 생성 초안과 선택·귀속 metadata만이다. 미소비/타인 초안·개인 보존자료 전체 수집 또는 공개 조회 권한 변경이 아니다.

## 1. 역할·예정 허용3·금지

Main 어울은 관리·검수·통합, 기존 Primary 단독 writer, 독립 Reviewer 읽기다. 예정 신규경로는 apps/server/modules/backups/project-creation-draft-inventory.ts, tests/unit/FN16/project-creation-draft-inventory.test.ts, tests/unit/FN16/project-creation-draft-inventory-schema.test.ts다. 현재는 이 WI 한 문서 작성만 허용됐다.

기존 API/producer/parser/0042·기타 SQL/RLS/role·GRANT/권한/helper/기존23조합·보호8/Git 개발자쓰기0. 실제 DB·키·서비스·파일/catalog·Agent·원문 읽기/복사·원문검증·귀속/quota 변경0. fn01_lock_owner/definer 함수를 RO에서 대신 실행하거나 함수 권한을 우회하지 않는다. 기존23·보호참조 수집기 전수시험0.

실source 지문: projects/repository.ts 44BA4DE269695B17335D07BF04BCB7148BC9628DDCC05E6378DB127185889A41, projects/draft-artifacts.ts D7E2572F8083796FF291CFC6E0683BF63511E2B4457C10421CD7A78388F22141, contracts/draft-artifacts.ts D33E299929915CC72240FDD2EAB9032D11ECF85A19E54C5D9007572129EE0AD5, db/migrations/0042_draft_artifact_storage.sql.pending 76D16C972339359B839ADA8A27A466C1F60873B5734FC37303F042B75C2CAA87. 원승인 FN01 계약·WI는 docs/contracts/FN01_DRAFT_ARTIFACT_STORAGE_CANDIDATE.md 및 docs/work_packages/FN01_DRAFT_ARTIFACT_STORAGE_IMPLEMENTATION.md다.

## 2. 보호 범위·인증·현재성

기존 readDocumentInventoryInput의 정확 projectId/limits(metadataBytes,inputBytes,fileCount,deadlineMs 양의 안전정수)를 사용한다. 최초/최종 authenticated RC에서 동일 actor/client/authSession/credentialGeneration·현재 활성 OWNER·DBclock 최소 세션기한을 확인한다. actor/client는 입력/과거 행/ambient GUC로 대체하지 않는다. 최초 본문 SELECT부터 project_drafts.owner_user_id=검증된actor AND consumed_project_id=요청projectId를 SQL로 선필터한다. 다른 소유자·미소비·타project의 원문/건수·시각을 조회 후 걸러내지 않는다. 조회 가능한 본인 소비초안이 처음부터 없으면 빈 한정목록만 반환하며 프로젝트 전체 초안이 없다는 주장으로 바꾸지 않는다.

기존 getDraft는 같은 사용자 다른 client의 readonly를 허용한다. 이 수집기도 row.client_id==현재client를 강제하지 않되 현재 인증client가 유효해야 하고 과거 writer/client를 반환·복원하지 않는다. 수정/생성·POST replay의 원client 제한은 바꾸지 않는다. PROJECT OWNER는 원초안의 타인 소유를 우회하는 권한이 아니다.

수집은 별도 단일 READ ONLY REPEATABLE READ이며 isolation/read_only/snapshot과 현재 OWNER를 확인한다. 최초/최종 RC에서 같은 본인 초안 ID·version·consumed_project_id·현재 input 전체 fingerprint 및 아래 전체 guardSnapshot을 재확인한다. RR 자료·최종 RC 행의 동등성/최소기한·취소를 검사한다. 중간 변경/반쪽 귀속/최종행 소실·권한회수/UNKNOWN이면 ref/hash/부분건수를 응답하지 않고 전체를 고정404/503으로 닫는다. metadata의 시작/끝 현재성일 뿐 ABA 불가능·원자 snapshot·쓰기 fencing/WeakSet proof·실바이트 검증이라고 하지 않는다.

현재 getDraft 자체는 fn01_lock_owner를 호출하지 않는다. guardSnapshot/#visible은 SELECT만으로 아래 metadata 보호 조건을 확인한다. 따라서 해당 순수 조건을 한정 구현하며 quota 생성·잠금·fn01_active/lock_owner·prepareSelection/prepareCreation의 쓰기 함수를 호출하지 않는다. authenticated가 활성 계정/client/세대/세션을 확인하고 DBclock 기반 만료를 다시 확인한다. source상 app SELECT는 provision 기본권한과0042의 명시 SELECT grant로 허용되며 실제 적용/역할은 미검증이다. 0042 미적용·SELECT 거절·표 부재는503이며 빈 수집 PASS로 바꾸지 않는다. 대상표에 FORCE RLS가 추가된 것으로 가정하지 않는다. actor/client RLS context가 필요해지면 실제 근거를 보고하고 기존 role/정책은 수정하지 않는다.

### 전체 input.artifactRefs guard

출력에 선택할 일부 ref만 검사하지 않는다. 최초/최종 RC의 현재 input.artifactRefs 전체를 기존 readDraftArtifactRefs로 검증한다. 검산용 guard lookup은 own draft와 정확 artifact/serverCommand로 결박하고 상태 필터로 미리 숨기지 않는다. 원 upload intent와 artifacts의 bytes/hash/MIME tuple·원 draft·READY·소유·정확 key를 기존 #visible과 동일하게 확인한다. 기존 공개 guard는 본인 draft의 READY 미귀속 ref도 draft-blobs/draftId/artifactId key로 허용하며, 이를 권한 부족404로 바꾸지 않는다. 귀속 ref의 현재 projectMember와 project storage key 조건도 그대로 확인한다. 비READY/접근불가는 기존 guard의404, metadata tuple/hash 불일치는503으로 닫는다. 다음 별도 소비 provenance 단계에서 current input refs=생성 당시 selection refs=creation refs=adoption refs 및 요청 consumed project 귀속을 검산한다. 정상 commit은0042의 선택 기록·생성 commit과 소비후 수정 차단으로 이 동등성을 보장한다. 따라서 guard를 통과한 READY 미귀속 ref라도 소비 provenance와 불일치하면503이며, 기존 GET의 조회 권한을 강화한 것이 아니다. 반환/역사증빙 수집은 이 소비 선택·귀속의 FINALIZED upload만이고 미선택/UNKNOWN 목록 전체를 수집하지 않는다. 출력 밖 ref가 격리/UNKNOWN/다른 귀속이면 guard 또는 provenance의 정확 원인으로 전체 응답을 닫는다. 원 snapshot을 빈배열/다른 hash로 대체하지 않고 ref/hash/부분건수를 반환하지 않는다. 파일 byte·inspection 원문 재검사는 하지 않으며 원문사용·쓰기 허가를 발급하지 않는다.

## 3. 정확11표·141열·정렬·선택 범위

이 목록 외 auth/session token_digest·계정·Secret·개인quota·미선택/UNKNOWN intent·원문 바이트는 SELECT하지 않는다. 필요한 내부 storage key는 검산 중 메모리에서만 쓰고 반환/로그/cache0이다. 명시 열·WHERE 선필터·keyset200·행 row_bytes 서버반환한도 및 클라이언트 누적 metadata/최종DTO 한도·최소deadline/statement_timeout을 유지한다.

1. project_drafts 9: id,owner_user_id,client_id,version,step,input_json,consumed_project_id,created_at,updated_at. 정렬 id. 본인+소비project 선필터.
2. draft_artifact_selection_versions 6: draft_id,draft_version,refs_json,snapshot_hash,command_id,receipt_id. 정렬 draft_id,draft_version. 현재 consumed draft의 현재 version에 해당하는 1 snapshot만, 과거 모든 버전0.
3. draft_artifact_selections 6: draft_id,draft_version,artifact_id,upload_intent_id,ordinal,ref_json. 정렬 draft_id,draft_version,artifact_id. 같은 snapshot 선택만.
4. draft_artifact_adoptions 14: artifact_id,upload_intent_id,original_command_id,draft_id,draft_version,ref_json,source_key,target_key,project_id,creation_intent_id,create_command_id,actor_id,client_id,adopted_at. 정렬 artifact_id. 본인 소비draft의 현재 선택 artifact AND project_id=요청project만.
5. draft_creation_intents 17: id,draft_id,actor_id,client_id,external_command_id,expected_version,request_hash,request_json,target_project_id,refs_json,sources_json,selection_hash,state,attempt,project_command_id,result_json,created_at. 정렬 id. 그 draft/version/project의 COMMITTED 귀속 intent만. 미확정/다른시도 전부수집0.
6. draft_upload_intents 19: id,draft_id,actor_id,client_id,external_command_id,expected_version,request_hash,request_json,artifact_id,server_command_id,receipt_id,operation_id,ref_json,staging_key,final_key,state,attempt,result_json,created_at. 정렬 id. 현재 선택/귀속이 가리키는 FINALIZED 원 upload만.
7. artifacts 13: id,project_id,draft_id,bytes,content_hash,media_type,storage_key,state,created_by,client_id,command_id,created_at,inspection_json. 정렬 id. 전체 현재 guard ref 및 선택 귀속 ref만, project 정확결박.
8. 선택 commands 21: id,scope_kind,scope_id,project_id,draft_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,received_at,completed_at. 정렬 id.
9. 선택 authorization_receipts 9: id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at. 정렬 id.
10. 선택 draft_audit_events 11: draft_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,operation,outcome,reason_code,recorded_at. 정렬 draft_id,server_sequence.
11. 선택 audit_events 16: project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of. 정렬 server_sequence,event_id.

명령 ID 집합은 selection snapshot.command_id, 각 upload.server_command_id, creation.project_command_id 및 같은 external_command_id의 DRAFT/createProject로만 닫는다. 마지막 DRAFT 명령의 ID는 intent에 따로 없으므로 draft/actor/client/operation/create external command의 정확 조건으로 최대1건을 선택하고 복수는503이다. 다른 DRAFT 이력·PROJECT 전체 원장으로 확대하지 않는다. receipt/audit는 이 명령 집합에만 제한하며 DRAFT/PROJECT scope를 섞지 않는다.

## 4. 원 selection/adoption/create provenance

H=canonicalJson/contentHash다. selection snapshot.refs_json을 기존 parser로 엄격 검사하고 snapshot_hash=H(refs_json), 현재 input.artifactRefs와 순서까지 일치시킨다. selections의 ordinal은0..n-1·중복 없음이며 artifact/ref/upload가 각 위치와 일치해야 한다. 빈 snapshot도 명시 저장된 사실을 확인한다. project_drafts 자체에는 content_hash가 없으므로 {draftId,version,contentHash}의 원 VersionRef를 발급하지 않는다. derivedMetadataHash/inputHash/원 selection snapshot_hash를 구분한다.

선택 snapshot.command_id/receipt_id는 같은 DRAFT scope의 APPLIED createProjectDraft/saveProjectDraft와 결박한다. result.version==draft_version/result.input.artifactRefs==refs, actor=owner/client=원writer, expected_version=version-1을 확인한다. create/save 원 payload는 독립 저장되지 않았으므로 request_hash 전체 재구성을 발명하지 않는다. 저장 request_hash와 DRAFT digest/receipt/audit/결과 관계를 검산하고 원 request 재구성은 NOT_PERFORMED로 둔다. 현재 input 전체와 같은 version의 선택 command.result_ref.input도 일치해야 한다. 원 methodology/sourceDeclaration의 전체 버전 검증은 범위 밖이며 해당 본문을 반환하지 않고 hash만 남긴다.

각 FINALIZED upload의 request_json은 기존 validDraftUploadCommand로 검증한다. H({operation:uploadProjectDraftArtifact,draftId,command:request_json})==request_hash, ref_json={artifactId,...request.payload}와 exact bytes/hash/mediaType, expectedVersion/client/externalCommand를 대조한다. server command/receipt/operation UUID는 intent와 일치해야 한다. DRAFT upload receipt result는 scopeKind,draftId,commandId,clientId,version,status,data 정확7키, data는 artifactRef/status/inspection이다. 원 result_json==command.result_ref, status ARTIFACT_READY, inspection==현재 artifact.inspection_json을 확인한다. artifact.command_id/created_by/client_id는 원 upload 귀속을 유지하며 createProject command로 바꾸지 않는다.

모든 DRAFT 명령은 scope_kind=DRAFT/scope_id=draft_id/project_id null/draft_id 정확, control_generation/policy_ref/payload_ref/approval_consumption_id null, APPLIED를 검사한다. receipt는 같은 scope/id/command/subjectRef={kind:HUMAN,userId:actor}·approval null이다. digest=H({kind:DRAFT,draftId,operation,actorId,clientId,requestHash})를 대조한다. draft_audit는 같은 draft/command/operation/operationId/actor/client/APPLIED를 검사한다. upload는 event_id=operation_id/reason EXPLICIT_DRAFT_FILE_UPLOAD, create/save/createProject는 OWNED_DRAFT_ONLY를 확인한다. 선택 증빙의 명시 누락/중복/다른 scope는 거절하고, 무관한 감사 sequence gap이나 독립 사건 시각 단조 조건을 추가하지 않는다.

creation은 COMMITTED, expected_version==draft.version, target_project_id==consumed_project_id, actor_id==owner, client_id==원 draft.client_id, refs_json==selection.refs_json, selection_hash==snapshot_hash를 검사한다. sources_json은 각 exact ref/uploadId의 대응과 정확히 일치해야 한다. request_json은 {schemaVersion:1,commandId,clientId,draftId,draftVersion}, H(request_json)==request_hash다. project_command_id의 PROJECT/createProject/APPLIED는 같은 actor/client/externalCommand/원 request_hash/expected0/control1, target project의 bare {id,version:1}와 결박한다. receipt/audit digest=H({operation:createProject,draftId,draftVersion,projectId,actorId,clientId,requestHash})를 검산한다. PROJECT subjectRef는 {kind:HUMAN,userId,clientId}, audit는 FIRST_PROJECT_FROM_OWNED_DRAFT/HUMAN_COMMAND/APPLIED/correction null·target bare ref다. 일반 CommandResult/versionHash 형식을 강제하지 않는다. 같은 externalCommand의 DRAFT/createProject result, PROJECT result, creation.result_json의 정확 일치를 검사한다. 현재 제어 세대1이나 현재 방법론 초판을 과거 이력의 현재 유지 조건으로 강제하지 않는다.

adoption은 artifact PK·선택 refs·draft/version·uploadId/original_command_id·creationId/create_command_id/project·actor/client를 결박하며 sources 전체와 건수/내용이 일치해야 한다. source_key=draft-blobs/draftId/artifactId, target_key=blobs/projectId/artifactId, upload.staging_key=draft-staging/draftId/uploadId/body, upload.final_key=source_key를 내부에서만 대조한다. 현재 artifact.draft_id=null/project_id 정확/storage_key=target_key여야 한다. 새 복사·귀속 가능성을 발급하지 않는다.

DB 정수는 안전 정수, PG 시각은 검수된 private parser와 같은 offset/최대6소수·micro 보존·연도1..9999 규칙으로 정규화하고 derivedMetadataHash 입력을 고정한다. 원 프로토콜 ISO 형식을 완화하지 않는다. 원 snapshot_hash/ref.contentHash와 derived row hash를 구분한다.

## 5. 내부 DTO·비노출·미수집

kind PROJECT_CREATION_DRAFT_INVENTORY_V1/scope OWN_CONSUMED_PROJECT_DRAFT_SELECTED_ADOPTIONS_ONLY다. core {kind,projectId,drafts,selections,adoptions,artifacts,evidence,issues,externalDependencies}의 H를 inventoryHash로 둔다. drafts는 id/version/step/consumedProjectId/inputHash/derivedMetadataHash만 반환한다. selections는 draftId/draftVersion/원 selectionHash/선택 ArtifactRef와 ordinal이다. adoptions는 exact ArtifactRef와 opaque draft/creation/upload/command ID·익명 provenance·derivedMetadataHash만 반환한다. artifacts는 선택 ref와 현재 state/inspection의 고정 상태·blobVerification NOT_PERFORMED다. evidence는 ID와 원 request_hash/원 selectionHash/derivedMetadataHash, 원 scope 종류·검증 한계만 반환한다.

input/name/purpose/sourceDeclaration/pathHint·방법론 본문·request/result 자유 원문·actor/client UUID·storage key/OS path·계정/Secret은 출력/issue/error/log/cache에 넣지 않는다. 알려진 Secret 검사는 사용하는 metadata 원문 단계에서 수행해 고정503으로 닫고 원값/cause를 반환하지 않는다. ID/hash를 완전 익명이라고 하지 않는다. 원 protected ref를 새 VersionRef로 발명하지 않는다. 원문·권한을 제공하는 provider를 호출하지 않는다.

originalDraftContentHash=NOT_STORED, sourceDeclarationHistory/wholeDraftHistory/unselectedUploads/privateQuota=NOT_COLLECTED, originalSourceBytes/blobVerification/creationWriteProof/authorizationRestorationVerification=NOT_PERFORMED다. fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed/atomicSnapshotVerified는 false다. 기존23에 연결하지 않으며 PROJECT_DRAFT_ATTACHMENTS_CONTROL_HANDOFF_BASELINE_DRAFTS와 다른 global missing은 전부 유지한다. 기존 문서가 참조하는 동일 artifact는 같은 tuple 사실로 구분하되 원문을 중복 검증했다거나 문서 작성이 완료됐다고 하지 않는다.

## 6. 필수 반례·검수·rollback

신규 source 부재 RED→같은 Primary의 GREEN/type/diff까지 진행한다. 현재는 아직 제품 GO가 아니다.

- 본인+소비 project 정상·빈 선택 snapshot·여러 첨부·다른 유효 readonly client 정상, 타 creator/미소비/다른 project/미선택 UNKNOWN이 SQL 선필터로 제외되는지 확인한다. 뒤에서 걸러낸 행을 건수나 usage로 누설하지 않는다.
- 현재 input에 출력 subset 밖 ref를 추가해 격리/다른 project/다른 draft/tuple 불일치로 만들면 최초/최종 RC에서 모두 전체 응답을 닫는다. owner/소비 project/version/전체 input/선택/귀속의 중간 변경·인증 세대/권한/기한 회수·UNKNOWN에서 ref/hash/부분건수 반환0을 확인한다.
- selection 원 H/ordinal/command/receipt, upload requestH/원 artifact command, DRAFT scope/subject/digest/audit, creation requestH/두 scope result, adoption exact tuple/원·새 key/현재 project 관계를 하나씩 독립 재봉인한 반례로 검증한다. bare project target의 원 contentHash를 발명하지 않는다.
- 정확11표141열·명시 SELECT·SQL LIMIT200·비정상201행 응답 거절/중복/누락/다른 scope, 후속 evidence·최종 DTO의 누적 metadata 한도, 최소 기한/취소·rollback/release 불명503 우선을 검증한다. DB 미적용/SELECT 거절을 빈 PASS로 바꾸지 않는다.
- PII/자유 원문/pathHint/내부 key/Secret 출력 누출0, 알려진 Secret 고정503, SQL/예외 cause 비노출, provider/file/quota/definer 실행0과 정확 입력 검사를 확인한다.
- 동일 artifact가 기존 문서에도 나타나는 사실은 metadata 중복으로만 확인하며 완료된 기존 collector·원문 helper 시험을 재실행하지 않는다.

예정 정확 명령은 node --test tests/unit/FN16/project-creation-draft-inventory.test.ts tests/unit/FN16/project-creation-draft-inventory-schema.test.ts, npm run typecheck, git diff --check다. 신규2 합성 PASS를 PG/RLS/0042 적용·경합/ABA·실파일·브라우저·복원 PASS로 승격하지 않는다. 독립 C/I0 및 Main fresh 뒤 3hash/정확 명령/exit/시간/RED/오류/미검증과 writer 해제를 제출한다. rollback은 신규3의 검토된 revert와 미연결 유지이며 자료/권한/키 삭제0이다. 전체 WORK_PLAN은 미완료다.

Main checkpoint는 신규3+WI/결과/WORK_STATUS/WORK_PLAN 정확7경로다. 생성초안 자체의 원 content_hash가 없다는 한계와 guard/provenance 분리를 최종보고에 남긴다.

도메인 검수 보완: 0042의 creation.target_project_id UNIQUE 및 선택 최대20 때문에 한 프로젝트의 정상 소비자료로 단일 표201행을 만들지 않는다. SQL LIMIT200과 keyset 형태·비정상201행 거절을 확인하고, 실제 정상 선택20/초과21 경계를 검증한다. 반환 selected ArtifactRef는 중복을 제거한 선언 bytes/수로 inputBytes/fileCount 한도를 지키며 실제 바이트 검증은 NOT_PERFORMED다. guard용 일시 조회와 반환 selected budget은 구분한다. 제품 상한/권한/정상 범위를 느슨하게 바꾸지 않는다.

실제 creation.sources_json 순서 보완: 0042 fn01_reserve_creation은 artifact_id 순으로 sources_json을 저장한다. 선택 refs/ordinal과 원 selection snapshot_hash의 사용자 순서는 유지하고, creation sources/manifest를 대조할 대응 목록만 artifactId 순으로 정렬한다. 역순으로 선택한 정상2첨부와 실제 artifact 정렬 creation snapshot을 이용해 RED→GREEN을 확인한다. 선택 원형이나 원 hash를 정렬해 바꾸지 않는다.
