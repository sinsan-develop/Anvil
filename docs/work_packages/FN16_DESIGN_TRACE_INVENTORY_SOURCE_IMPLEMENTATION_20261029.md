# FN16 설계·화면 위치·추적 관계 내부 수집 작업지시서

## 기준과 담당
2026-10-29 / codex/av3-stage-b / 부모 bc4376d6d4b94f5fa5a1a40917088660546f0c35. 설계 §10.4와 FN16 source·합성 직접 승인 안의 기존 자료 보존이다. 기존 fn16_primary 단독 writer, fn16_review 독립 검수, Main 관리·검수·통합. TEST_ONLY → Main RED → SOURCE_GO.
신규 허용 파일은 apps/server/modules/backups/design-trace-inventory.ts, tests/unit/FN16/design-trace-inventory.test.ts, tests/unit/FN16/design-trace-inventory-schema.test.ts 3개다. 기존 writer/helper/SQL/시험 수정0. 실제 DB/FS/키/서비스/P03/Agent/job0. 공개 형식·권한·schema 확대0.

## 수집 경계
내부 collectDesignTraceInventory(access,token,value,signal). 기존 readDocumentInventoryInput의 projectId/유한 limits 그대로. 최초/최종 RC 동일 actor/client/session/credential·현재 OWNER/nonarchived·관측 최소기한, 단일 RO RR 실제 isolation/readOnly/snapshot 대조, rollback/release와 최종 auth COMMIT 뒤 검사. pool/auth 대기 전체 강제 상한을 보장한다고 하지 않는다.
projectId 매개변수, 실제 명시열, id 순서 keyset 최대200, SQL CASE JSON byte 제한과 누적 metadata 제한. schema 시험으로 실제 migration 열 대조.
- design_items 14: id,project_id,design_document_id,document_version,document_hash,local_code,title,anchor,item_hash,item_json,created_by,client_id,command_id,created_at.
- screen_regions 15: id,project_id,design_item_id,screen_code,source_document_id,source_version,source_hash,artifact_id,anchor,region_hash,region_json,created_by,client_id,command_id,created_at.
- trace_edges 19: id,project_id,from_kind,from_id,from_version,from_code,to_kind,to_id,to_version,to_code,relation,design_refs,edge_json,edge_hash,reason,created_by,client_id,command_id,created_at.
- commands 11: id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id. 해당 indexDesignDocument/linkTrace의 deduplicated exact command ID만 묶음 조회.
외부 문서·계획·원문·감사 전체·정책·설계변경·활성기준을 따라 읽지 않는다.

## 무결성과 기존 writer 보존
1. item은 {id,documentRef,localCode,title,anchor,itemHash}. 원hash는 {documentRef,localCode,title,anchor} 4필드. UUID/ref/코드/제목/anchor와 분리열을 design-index.ts 저장 계약 그대로 검사한다.
2. region은 {id,designItemId,screenCode,documentRef,artifactRef,anchor,regionHash}. 원hash는 {designItemId,screenCode,documentRef,artifactRef,anchor} 5필드. 같은 명령의 내부 item과 연결하고 분리열/unique(designItemId,screenCode,anchor)를 검사한다. artifactRef는 기존 textArtifact의 정확4필드와 text MIME2/2MiB 계약이다. 원문 byte/anchor 현재성/상태는 미검증 외부 의존으로 보존한다.
3. 한 indexDesignDocument 명령은 items1~200/screens0~200을 공유한다. command 중복 자체를 거절하지 않는다. APPLIED/operation/actor/client/expectedVersion=documentRef.version/result target/ref/time을 대조하고 receipt.designItems/screenRegions 전체 집합과 그 command의 실제 모든 저장행을 대조한다. 누락/extra/다른명령 혼입 거절. result.commandId는 request ID이므로 DB id와 임의 동일시하지 않는다.
4. edge는 {id,from,to,relation,reason,designRefs,edgeHash,createdAt}. 원hash는 {from,to,relation,reason,designRefs} 5필드. 저장된 designRefs 순서 보존, 분리열과 원writer가 만든 정확 참조 집합/정렬 계약을 대조한다. 각 linkTrace command는 유일하며 APPLIED/actor/client/expectedVersion0/result ref version1·edgeHash·시각을 검사한다.
5. 현재 writer 허용 관계만: IMPLEMENTS PLAN_TASK→DESIGN_ITEM/SCREEN_REGION, REFINES SCREEN_REGION→DESIGN_ITEM 또는 DESIGN_ITEM→DOCUMENT_VERSION 또는 DOCUMENT_VERSION→DOCUMENT_VERSION, DEPENDS_ON 동종 PLAN_TASK/DESIGN_ITEM. VERIFIES enum만 보고 지원 확장0. from/to 동일ref 거절. 내부 DESIGN_ITEM/SCREEN_REGION 끝점은 수집행의 id/ref/code/anchor와 exact 검사. 외부 PLAN_TASK/DOCUMENT_VERSION 참조는 형식과 원hash만 검사하며 존재/현재성 미검증이다. 외부 endpoint를 읽지 않아 재계산할 수 없는 designRefs의 기여는 검증했다고 주장하지 않는다.
6. 모든 출력 텍스트/refs에 기존 known-pattern metadata 검사. 발견시 고정 오류, 완전 비밀탐지 주장0. 실제 user/client/session/token/storage 경로·SQL 오류본문 출력0. 원hash와 익명 투영hash 구분.

## 결과와 오류
kind DESIGN_TRACE_INVENTORY_V1/scope DESIGN_TRACE_HISTORY_ONLY. projectId/designItems/screenRegions/traceEdges/issues/externalDependencies/observation/usage/contentHash. 전체 hash는 projectId/designItems/screenRegions/traceEdges/issues/externalDependencies 6필드 canonical; 시각/usage/selfhash 제외. arrays 순서 결정적. 외부 원문 refs는 externalDependencies로 남기며 직접 fileCount/inputBytes=0, blobVerification=NOT_PERFORMED/executionEvidence=NOT_CONNECTED/fullProjectCoverage=false/restorable=false. 미검증 외부 의존이 있으면 metadataComplete=false. 결과 UTF8 bytes도 한도 검사.
AUTH_REQUIRED401/NOT_FOUND404/INPUT_INVALID400, DESIGN_TRACE_INVENTORY_CANCELLED409/DEADLINE·LIMIT413/INTEGRITY_FAILED·STORAGE_FAILED·SENSITIVE_METADATA503. 회수 불명은 동시 취소보다 storage503 우선, 미완료 query 정상 release0. 기준 완화·재시도·timeout 연장0.

## 검수
실제 collector + 메모리 PG로 공유명령 다중항목/화면·지원관계, 원hash/분리열/receipt 누락·extra·wrongcmd/내부끝점 변조, 200초과 paging, 한도·양끝권한·기한·취소·회수·민감metadata를 확인한다. 신규시험/type/diff와 독립 C/I 해결 후 정확파일만 게시한다. 기존 불변 collector 반복0. 실제DB/RLS/FS/키/서비스·wholearchive/복원/화면인수 NOT_RUN이며 FN16 전체 미완료.
