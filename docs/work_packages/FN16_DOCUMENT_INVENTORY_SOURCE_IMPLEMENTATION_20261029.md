# FN16 문서 metadata inventory 구현 계획

> **Agent 실행자:** 구현 시작 시 `superpowers:executing-plans`를 적용한다. 기존 Primary 단일 writer와 Main RED→제품 GO→독립 검수 절차를 유지한다. 새 agent 생성·Git 작업은 이 WI의 실행자 권한이 아니다.

**목표:** 프로젝트 문서의 모든 버전·이력을 같은 관측 기준에서 검증해 비복원 내부 inventory로 반환한다.
**구조:** 기존 AccessRepository의 시작/종료 인증 RC와 별도 단일 READ ONLY RR 자료 조회를 구분한다. 새 input/collector 두 파일에만 내부 DTO·검증·명시 SELECT를 두며 기존 route·writer를 연결하지 않는다.
**기술:** 기존 Node >=24.18.0 <25, TypeScript, pg, canonicalJson/contentHash, node:test. 새 의존성 0.
**기준:** `docs/contracts/FN16_DOCUMENT_INVENTORY_SOURCE_CANDIDATE_20261029.md` SHA256 `25E4F29C7D925BABD6919DFC5C446696B3D7A0920B758C3E4C1AD759730DD17E`; 코드 기준 `35cf7d049002bc901c29ef7cd468f155fbd8e819`, `codex/av3-stage-b`.
**PMO 결정:** 기존 위임 범위 판단 기록 SHA256 EC9A3C4D7865099F471ACCE398EB191C63B5D0D9D708F6DD243F87652F58C5F8. 실행권한 확대0.
**상태:** 계획 초안. PMO가 후보25E4F29C의 내부 SELECT source2+시험3을 기존 구현 구체화 범위로 판단했다. Main의 별도 TEST_ONLY/PRODUCT GO 전 구현·시험 착수 허가는 아니다. 실제 PG·파일·키·서비스·설정·공개 API·backup job·정책 저장·P03 실행 0.

## 전역 제약과 검토 초점

- 정확 제품 2/시험 3 신규 경로만 허용한다. 기존 소스·migration·runtime 공개 DTO·App·보호 untracked 자료는 변경하지 않는다.
- 전체 백업·복원 형식이 아니다. SELECTED_FILES_V1을 전체 정책 적합으로 승격하지 않는다.
- artifact bytes, 작성 기준 body_utf8, 보관경로, source relativePath, 인증 token/세션·정책 원문은 결과에 넣지 않는다. 파일을 읽거나 게시하지 않는다.
- 같은 RR에서 재조회해도 현재 회수를 알 수 없으므로 시작/종료 RC 인증을 분리한다. 마지막 확인 뒤 영구 사용권을 발급하지 않는다.
- 검토 초점: 마지막 인증 실패 후 결과 누출, 공통본 다른 사용자 소유권, JSON 속 필수 참조 누락, 뒤 페이지 실패를 빈 목록으로 처리, 경로 제거 투영에 원 hash를 잘못 붙이기. 아래 시험에 모두 결박한다.

## 정확 경로와 책임

개발 root: `C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil`.

1. 신규 `apps/server/modules/backups/document-inventory-input.ts`: 유한 입력·내부 DTO·행/참조·projection 크기 검증.
2. 신규 `apps/server/modules/backups/document-inventory.ts`: 인증/transaction 수명, 고정 SELECT와 keyset, 관계 closure·hash 대조, 결과 조립.
3. 신규 `tests/unit/FN16/document-inventory-input.test.ts`: 입력·한도·투영·합계 검증.
4. 신규 `tests/unit/FN16/document-inventory.test.ts`: 실제 collector를 소비하는 합성 pg/AccessRepository 경계 시험.
5. 신규 `tests/unit/FN16/document-inventory-schema.test.ts`: 실제 migration 열/PK와 명시 SELECT 명세의 정적 정합. DB 실행 시험 아님.

이번 작성 허용은 이 WI 문서 한 파일뿐이다. 위 5경로는 후속 GO 때만 작성한다.

## 함수와 내부 DTO

```ts
interface InventoryLimits {
  metadataBytes:number; inputBytes:number; fileCount:number; deadlineMs:number;
}
interface DocumentInventoryRequest { projectId:string; limits:InventoryLimits }
function readDocumentInventoryInput(value:unknown):Readonly<DocumentInventoryRequest>;
async function collectDocumentInventory(
  access:AccessRepository, token:string, input:unknown, signal:AbortSignal
):Promise<DocumentInventory>;
```

입력은 own data의 닫힌 shape, UUID projectId, 4개 양의 유한 안전정수만 허용하고 first await 전에 복제한다. token·access·signal은 신뢰된 서버 호출 경계이며 결과에 복제하지 않는다. 비정상 getter/parse/DB 예외의 원문·cause는 반환하지 않는다. 신호는 이미 aborted이면 IO 전에 거절한다. limit 기본값·환경변수 fallback·실행 허가를 발급하지 않는다.

DTO의 닫힌 top-level 필드:
`kind:'DOCUMENT_INVENTORY_V1', scope:'DOCUMENT_HISTORY_ONLY', projectId, observation, documents, versions, artifactRefs, artifactLinks, imports, importSelections, proposals, proposalSelections, reviews, confirmations, events, sourceLinks, forms, standards, applications, methodologies, externalDependencies, issues, limits, usage, metadataComplete, blobVerification:'NOT_PERFORMED', fullProjectCoverage:false, restorable:false`.

- `observation={snapshot:string,startedAt:string,finishedAt:string,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'}`. snapshot은 PostgreSQL이 반환한 snapshot 문자열이며 인증 capability가 아니다.
- 각 collection은 아래 SQL 열을 검증해 camelCase로 투영한다. `projectId`는 최상위와 대조하고 항목에 중복할 필요 없다. createdBy/clientId/commandId/reviewer는 역사 식별자이며 인증 행이 아니다. 내부 임의 row 전체나 SELECT * 결과를 반환하지 않는다.
- 원 저장 hash가 있는 항목은 `sourceRef` 또는 정확 원 ref와 검증한 원 snapshot을 구분한다. hash 없는 review/event/confirmation에 가짜 불변 VersionRef를 발명하지 않는다.
- `sourceLinks={id,documentRef,headVersion,state,events:[{sourceRef,projection,projectionHash}]}`. projection은 projectId/documentRef/sourceRootId/sourceSnapshotRef/blobHash/kind/state/previousRef/recordedAt만 포함한다. 원 snapshot은 hash·계보 검사에만 사용하고 relativePath/reason을 결과에서 제외한다. `projectionHash=contentHash(canonicalJson(projection))`; sourceRef는 제거 전 snapshot의 원 ref다.
- `standards`는 `{ref,createdAt,bodyVerification:'NOT_PERFORMED'}`만. body_utf8/source_approval_json을 읽거나 원 hash 진위를 검증했다고 표시하지 않는다. 양식의 exact authoringStandardRef와 DB행의 ref 정합만 확인한다.
- `artifactRefs`는 `{artifactId,bytes,contentHash,mediaType,state,inspectionStatus,blobVerification:'NOT_PERFORMED'}`. 검사 metadata가 없거나 해석 불가하면 `inspectionStatus:'UNKNOWN'`; READY를 실제 bytes 검사 성공으로 승격하지 않는다.
- `artifactLinks`는 `{documentRef,artifactRef,kind:'BODY'|'ATTACHMENT'|'SOURCE'}[]`다. document_artifact_links의 모든 정확 문서 버전·원문 연결을 보존하며 documentRef.id/version, artifactRef.artifactId, kind 순으로 정렬한다. 같은 파일이 여러 문서·버전·kind에서 쓰이면 관계는 각각 남기고 fileCount/bytes만 중복 제거한다. SOURCE 연결을 content.body/attachments에 억지로 넣거나 누락하지 않는다.
- `externalDependencies`는 `{kind,ref,reasonCode}`의 중복 제거·정렬된 정확 참조다. 타 프로젝트·접근 불가 공통 원본·source root/snapshot·draftConfirmation은 따라 읽지 않는다. 단순히 ID 모양이라는 이유로 재귀 탐색하지 않고 아래 알려진 JSON 참조만 분류한다.
- `issues`는 `{code,kind,ref}`의 고정 사유만. 정상 metadata 관계가 완성돼도 blobs/작성 기준 원문 검사는 NOT_PERFORMED다. 격리·불명 artifact와 접근 불가 외부 출처는 metadataComplete=false의 부분 결과, 필수 내부 관계/해시 불일치는 오류다.

## transaction·인증·반환 수명

1. 입력/신호 고정 후 `access.authenticated(token,null,callback)`로 시작 RC를 연다. callback에서 `current_setting('transaction_isolation')='read committed'` 확인, `projectMember(db,actor,pid,false)` OWNER/archived 검사, `clock_timestamp()`와 `notificationSessionDeadline`으로 기한을 잡는다. authSession 존재와 credentialGeneration을 검사하고 같은 actorId/clientId/authSession.id/credentialGeneration을 비공개 메모리 기준으로 저장한다. 기존 authenticated의 session FOR UPDATE를 그대로 사용하되 RR 안에서 호출하지 않는다.
2. `access.pool.connect()`의 별도 client에서 `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`; `current_setting('transaction_isolation')`, `current_setting('transaction_read_only')`, `pg_current_snapshot()::text`, `clock_timestamp()` 실제 응답을 검사한다. 프로젝트 OWNER를 같은 snapshot에서도 대조한다. 모든 자료 SELECT는 이 client만 사용한다.
3. 첫 SQL 전에 해당 transaction local `statement_timeout`을 남은 유한 deadline 이하로 설정한다(`set_config(...,true)`; DB 영속 쓰기 아님). 각 query/페이지/검증 전후 monotonic deadline·AbortSignal·행/누적량을 검사한다. 신호가 query 도중 발생하면 결과를 반환하지 않고 bounded statement 종료 후 ROLLBACK/release한다. 즉시 원격 cancel을 구현했다고 주장하지 않는다.
4. 수집 끝의 snapshot을 확인하고 READ ONLY transaction은 **ROLLBACK으로 종료**한다. COMMIT·명령·receipt·audit·replay 조회/쓰기 0. 실패도 rollback/release; rollback 불명은 client를 오류와 함께 release하고 고정 503으로 처리한다. 자료 client를 종료해야 마지막 auth와 pool 고갈 교착을 만들지 않는다.
5. 같은 기존 authenticated 경로의 별도 RC에서 신원 4요소·현재 OWNER·clock/deadline을 재확인한다. 실제 포함한 exact common/project 원출처의 접근 scope도 다시 조회한다. 시작/종료 actor/client/session/generation 불일치 또는 현재 권한 상실은 결과를 폐기한다. 둘 다 현재 승인/실행 허가를 대신하지 않는다.
6. 인증 callback만 아니라 authenticated가 외부 COMMIT을 반환한 뒤에도 deadline·취소를 검사하고 완성 결과를 반환한다. 마지막 currentness 확인 뒤의 외부 변경을 영구 방지한다고 주장하지 않는다. token/raw identity는 DTO·오류·로그에 넣지 않는다.

시간 보장 제한: `AccessRepository.#transaction/#lockedSession`에는 statement_timeout/query_timeout/lock_timeout 설정이 없다. 실제 main.ts의 `validateDevelopmentDbConfig`는 connectionTimeoutMillis=5000만 고정한다. 따라서 이번 변경의 deadlineMs는 성공 반환·후속 페이지의 상한이고 모든 pool.connect/기존 authenticated의 잠금 대기를 같은 시간 안에 강제 종료하는 보장이 아니다. RR SET LOCAL statement_timeout 적용 이후의 자료 query만 남은 시간으로 제한하며, connect/BEGIN/SET 자체·RC 인증/COMMIT/rollback·통신 단절 회수의 실제 시간 보장은 NOT_RUN/미보장이다. 대기 중 신호는 완료 뒤 확인해 결과를 폐기한다. Promise.race 후 진행 중 query의 client를 정상 release하지 않는다. connect가 늦게 끝나면 작업하지 않고 해당 client를 안전 회수하며, 실행 중 query가 끝나기 전 client 재사용0. 기존 auth/config를 몰래 수정하지 않는다. 실제 job 연결 전 이 제한과 실행 환경 DB timeout 근거를 별도 대조한다.
오류는 AuthFailure의 고정 코드로만 반환: 입력400, 인증401, 프로젝트 비회원/OWNER불가404, 취소409, 기한/한도413, 필수자료/무결성/transaction/DB읽기 불명503. 원 DB table명/SQL/secret/cause/stack을 결과에 담지 않는다. 실제 서비스 호출선은 아직 없다.

## 명시 SELECT 허용 열·정렬

프로젝트 표는 모두 `project_id=$1`을 직접 결박한다. JOIN도 project_id와 정확 id/version을 함께 결박한다. 표의 정렬은 ASC이고 후속 page는 동일 tuple `> lastTuple`, LIMIT 200이다. 200행이면 다음 page까지 조회하며 빈 마지막 page만 종료한다. 중복·역행·200초과는 오류. OFFSET·updated_at 기준 잘라내기·선행 LIMIT200으로 전체 완료를 주장하지 않는다.

| 표 | 허용 SELECT 열 | 프로젝트 고정 뒤 keyset |
|---|---|---|
| documents | id,project_id,title,head_version,confirmed_version,created_by,created_at,updated_at | id |
| document_versions | project_id,document_id,version,form_definition_id,form_version,form_hash,stage_ref_json,body_artifact_id,title,source_refs_json,content_json,content_hash,sections_json,author_ref_json,validation_json,reason,client_id,command_id,created_at | document_id,version |
| document_artifact_links | project_id,document_id,version,artifact_id,kind | document_id,version,artifact_id,kind |
| artifacts | id,project_id,bytes,content_hash,media_type,state,inspection_json | id; 수집한 exact artifact 집합만 |
| document_imports | id,project_id,original_artifact_id,form_definition_id,form_version,form_hash,candidate_json,content_hash,created_by,client_id,command_id,created_at | id |
| document_import_selections | id,project_id,import_id,document_id,version,created_by,client_id,command_id,created_at | id |
| document_proposals | id,project_id,document_id,base_version,base_hash,body_artifact_id,diff_artifact_id,content_json,proposal_json,content_hash,reason,created_by,client_id,command_id,created_at | id |
| document_proposal_selections | id,project_id,proposal_id,document_id,version,created_by,client_id,command_id,created_at | id |
| content_reviews | id,scope_kind,scope_id,project_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id,created_at | id; PROJECT/DOCUMENT/scope_id=pid 한정 |
| document_version_events | id,project_id,document_id,version,event_kind,review_ref,actor_ref,reason,command_id,created_at | id |
| document_confirmations | id,project_id,document_id,version,target_hash,form_ref,review_refs,validation_json,confirmed_by,client_id,command_id,created_at | id |
| document_source_links | project_id,id,document_id,version,source_root_id,relative_path,source_snapshot_ref,blob_hash,link_version,state,current_event_id,linked_at,updated_at | id |
| document_source_link_events | id,project_id,link_id,link_version,content_hash,snapshot_json,command_id,created_at | id; link/version 계보는 수집 후 별도 정렬 검사 |
| form_definitions + form_versions | d.id,d.scope,d.owner_user_id,d.project_id,d.form_code,d.name,v.version,v.definition_json,v.content_hash,v.authoring_standard_id,v.authoring_standard_version,v.authoring_standard_hash,v.authoring_standard_ref,v.origin_ref_json,v.created_by,v.created_at | d.id,v.version; exact 참조 집합만 |
| authoring_standard_versions | id,version,content_hash,created_at | id,version; exact 참조만, body_utf8 금지 |
| project_methodologies | id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by,created_at | id; stage가 실제 가리킨 applicationId만 |
| methodology_definitions + methodology_versions | d.id,d.scope,d.owner_user_id,d.project_id,d.system_code,v.version,v.name,v.purpose,v.graph_json,v.content_hash,v.origin_ref_json,v.reason,v.created_by,v.created_at | d.id,v.version; exact 출처만 |

공통 표의 전역 스캔은 금지한다. form은 기존 조회 규칙인 SYSTEM 또는 USER_COMMON/actor소유만 포함한다. 미지원 PROJECT form은 공통 접근권을 새로 열지 않고 외부 의존으로 남긴다. methodology는 SYSTEM/본인 USER_COMMON 또는 같은 project의 PROJECT만 포함한다. 참조 집합도 정렬한 최대200 묶음으로 조회하며 반환된 row가 요청 집합 밖이면 오류다. rows0을 발견한 공통 exact ref는 접근 불가 외부 의존과 구분해 기록하고, 내부 project 필수행 rows0은 오류다. 다른 사용자 존재 유무를 추가 조회하지 않는다.

## 원 해시·JSON closure와 투영

- 문서: `hash(canonicalJson({title,formRef,stageNodeRef:stage_ref_json,content:content_json}))`; content.body와 body_artifact_id, content.sections와 sections_json, source_refs_json/content.sourceRefs 정합. 모든 head/confirmed pointer가 수집 버전에 존재해야 한다.
- 원문: body/attachments/SOURCE 링크 및 import originalRef/extractedContentRef, proposal body/diff/attachments를 합집합으로 만든다. 동일 artifactId의 hash/bytes/mediaType 충돌은 오류다. READY 등 상태는 원래대로 보존한다. 누락 BODY/ATTACHMENT 링크·artifact는 오류다.
- import: `hash(canonicalJson(candidate_json))`; candidate.id/originalRef와 SQL id/original_artifact_id, intendedFormRef와 nullable form3열 대조. selections가 가리킨 실제 document/version 존재 확인. FAILED/UNSUPPORTED 후보도 원래 상태로 포함한다.
- proposal: `hash(canonicalJson({proposal:proposal_json,content:content_json,reason}))`; baseRef와 SQL document_id/base_version/base_hash, body/diff artifact IDs와 JSON exact refs 대조. 선택되지 않은 제안도 포함하며 selections의 version과 content 연결을 대조한다.
- review: target exact 문서 버전, criteria_snapshot_json.formRef 및 criterion ID/criteria_version과 저장 items_json 형식 대조. evidenceRefs/review_ref 등은 지원하는 정확 ref만 처리하고 다른 종류는 외부 의존이다. 현재 검토 적합/승인으로 재판정하지 않는다. review 자체 원 content_hash가 없으므로 hash 검증했다고 말하지 않는다.
- confirmation: target_hash/form_ref/review_refs가 동일 문서 버전과 수집된 PROJECT/DOCUMENT review를 가리키는지 검사한다. latest만 선택하지 않고 모든 확정 이력을 포함한다. 새 확정이나 pointer 변경 0.
- source links: 기존 `readDocumentSourceLinkHistory`로 원 snapshot hash와 LINKED→DETACHED 계보를 검사하고 head/current_event_id·SQL source 필드를 대조한다. 상대 경로는 내부 검사 후 출력 제거. 앞의 sourceRef/projectionHash 분리를 지킨다.
- form: `hash(canonicalJson(definition_json))`; definition.authoringStandardRef와 SQL ref3열/authoring_standard_ref 대조. 기준 본문 hash는 읽지 않아 NOT_PERFORMED다. origin_ref_json은 알려진 exact ref만 외부 의존으로 투영한다.
- application: 기존 `readApplicationSnapshot(pid,[row])`를 재사용해 sourceRef/snapshot hash/graph hash/graph 구조를 검사한다. stage node가 존재하고 해당 form이 input/output에 연결되는지 `readStageNodeRef`/`nodeUsesForm`으로 검사한다. 현재 application을 대신 선택하지 않는다. graph의 input/output form refs도 closure에 넣는다.
- methodology: `hash(canonicalJson(graph_json))`; snapshot.sourceRef와 exact 원본 비교. 기존 project `row()`가 receipt/audit를 더 검사하는 점을 소유/출처 인증 완료로 가장하지 않는다. 이번 결과는 graph/source ref 정합이며 command/approval 역사 수집 단위가 아니다. 필요한 draft/origin/receipt 참조는 외부 의존으로 남긴다.
- 모든 자유 입력 metadata는 기존 `inspectArtifact(Buffer.from(canonicalJson(value)))` 알려진 표식 검사에 통과해야 한다. SUSPECTED면 원문·표식 일부를 반환하지 않고 고정503으로 거절한다. 자동 마스킹·완전 탐지 주장 0.

## 크기·기한·회수

각 숫자 bigint 문자열은 안전정수 범위인지 먼저 검사한다. artifactId 단위 중복 제거 후 fileCount와 선언 bytes를 합산하되 `next > MAX_SAFE_INTEGER` 또는 지정한도 초과를 더하기 전에 거절한다. 동일 ref 반복을 여러 파일로 세지 않는다. metadata 누적은 각 항목 canonical UTF8 크기로 조기 상한 검사하고 최종 DTO 전체 크기로 재검사한다. usage는 `{metadataBytes,inputBytes,fileCount}`이고 metadataBytes 자신의 자리수도 포함해 안정될 때까지 재계산한다(최대 안전정수의 16자리 이내 수렴, 한도 초과 시 즉시 거절). 최종 실제 JSON UTF8 크기와 usage.metadataBytes가 같아야 한다.

자료 page/row가 큰 경우 무제한 JSON 누적을 하지 않는다. SELECT에 반환 직렬화 크기의 SQL side 측정(`octet_length`/허용열 JSON projection) 선검사를 넣거나 query당 남은 한도보다 큰 row를 고정오류로 반환하는 방식으로 제한한다. 필드 원문을 오류에 넣지 않는다. 원 bytes는 끝까지 미읽기다. 부분 결과도 동일 size/deadline/권한 검사 후에만 반환한다.

## Task 1 — 입력/원 참조와 크기 검증

- [ ] **TEST_ONLY:** input 시험에 `inventoryInputClosed`(추가필드·getter·비정수/0한도 거절), `inventoryProjectionIdentity`(원 hash와 projectionHash 분리·relativePath/body/token 출력0), `inventoryUsageExact`(dedupe·충돌·overflow·최종UTF8자리수)를 작성한다. 기존 expectation 변경0.
- [ ] **Main RED:** `node --test tests/unit/FN16/document-inventory-input.test.ts`; 초기 미구현 실패와 개별 도달 실패를 구분한다.
- [ ] **PRODUCT GO 후:** input 파일의 위 signature/닫힌 DTO·검증기를 구현한다. 실제 DB/파일 호출0.
- [ ] **직접 확인:** 같은 시험과 `npm run typecheck`; exit0·skip0 실제 결과만 기록한다.

## Task 2 — 문서 전체 metadata 관측과 반환

- [ ] **TEST_ONLY:** 합성 정상 fixture는 문서2개, 각 복수 버전, head/confirmed, BODY/첨부/SOURCE, 동일 파일의 복수 문서 연결, READY/FAILED import, 미선택/선택 proposal, 복수 review/확정, stage와 서로 다른 application 고정본, SYSTEM/본인공통 form, source LINKED/DETACHED를 포함한다. 실제 collector 함수를 호출하고 모든 자료가 동일 RR client에서 나오는지 검사한다. `artifactLinks`의 각 연결 유지와 `artifactRefs`/usage에서만 중복 제거되는 것을 별도로 검증한다.
- [ ] **핵심 음성:** `inventoryAuthBoundary`(시작거절·마지막 actor/client/session/generation 변경·현재OWNER회수·기한·취소에서 결과0), `inventoryClosure`(누락 head/body/link/내부version/form ref·변조hash·잘못된review target), `inventoryCommonBoundary`(다른소유 공통본 조회0·접근불가부분결과·과다반환거절), `inventoryPages`(201개→200+1+종료, 중복/역행/뒤query실패·table부재·RR/readOnly불일치 거절), `inventoryPartial`(격리/STAGING/FAILED/inspection불명은 bytes0·부분명시), `inventoryLimitsAndCleanup`(용량/overflow·rollback불명·마지막인증COMMIT실패는정상반환0)를 작성한다.
- [ ] **Main RED:** `node --test tests/unit/FN16/document-inventory.test.ts`; factory/기대 미구현과 fixture오류를 분리한다.
- [ ] **PRODUCT GO 후:** collector만 구현한다. 기존 blob readers를 가짜 빈 read로 호출하지 않고 위 명시 SELECT를 사용한다. SQL write/명령/replay/권한부여0.
- [ ] **검증:** 신규 input+collector 두 시험 및 typecheck. Main이 결과를 대조하고 reviewer는 권한·소유·현재성·closure/부분판정 독립 검수한다. 오류3회 규칙을 지키고 원결과를 보존한다.

## Task 3 — schema 정합과 동결 인계

- [ ] **시험 작성:** `document-inventory-schema.test.ts`가 실제 0002_methodologies.sql, 0003_documents.sql, 0003_project_documents.sql, 0003_project_artifacts.sql, 0003_document_imports.sql, 0003_document_proposals.sql, 0003_document_confirmations.sql, 0011_user_common_content_reviews.sql, 0005_artifact_quarantine.sql, 0032_document_source_links.sql, 0003_project_document_reviews.sql을 읽어 사용열/PK의 존재와 source projection 금지열 제외를 대조한다. 문자열 존재만으로 실제 SQL/RLS 실행PASS를 주장하지 않는다. fixture query는 명시열·pid/owner/exactref·page순서를 검사하고 미등록 query를 즉시 실패시킨다.
- [ ] **Main 집중검증:** `node --test tests/unit/FN16/document-inventory-input.test.ts tests/unit/FN16/document-inventory.test.ts tests/unit/FN16/document-inventory-schema.test.ts`; `npm run typecheck`; `git diff --check`.
- [ ] **독립 검수:** 미해결 Critical/Important 0과 실제 실행 경계0을 확인한다. 수정한 경우 관련 신규 시험만 재검증한다. native/reader/bootstrap/UI/브라우저 전수 재실행0.
- [ ] **제출/통합:** Primary는 정확5파일 diff/hash·명령/exit·실패이력·미검증을 제출한다. Main만 WORK_STATUS/결과 기록과 필요한 checkpoint를 수행한다. subagent commit/push0. 계획/전체FN16 완료표현0.

미검증: 실제 PostgreSQL RR/RLS/쿼리계획·동시 회수·원문 파일·전체수집·암호화·복원·사용자 인수는 NOT_RUN. rollback은 신규5파일의 검토된 revert이며 원자료/DB/서비스 삭제·수정이 아니다.

## 미정 및 실행 전 확인

PMO 위임 범위 판단은 수신했고 Main의 WI 검토/고정과 TEST_ONLY GO가 남았다. 구현 범위·상한·공개 의미를 바꾸는 미정 기술선택은 없다. project review 확장의 실제 경로는 열거 및 본문 확인한 db/migrations/0003_project_document_reviews.sql이다. 작성 기준 bytebody 및 원 hash 진위는 의도된 NOT_PERFORMED이며 collector 완료를 전체 백업 적합으로 해석하지 않는다.
