# FN16 프로젝트 방법론 개정·검토·확정 역사 수집 작업지시서

2026-10-29 / codex/av3-stage-b / 기준 8b0391b0234600f2ec334e11be24acc468511b7b. 기존 FN16 역사보존 내부 source 범위. 기존 primary 단독 TEST_ONLY→Main RED→SOURCE_GO, 독립검수. 실제DB/원문/키/서비스/P03/Agent0. 새 공개API/SQL/권한/현재방법론적용0.

## 대상과 중복 제외
현재 document-inventory는 문서가 참조한 application/sourceRef만 수집하므로 미적용 개정본·방법론 검토/확정·미참조 적용 이력은 빠진다. 이번은 PROJECT 정의·전체 불변버전·검토·확정 역사만 추가한다. 전체 적용 이력은 별도이고 초기 DRAFT_CONFIRMED_SOURCE의 첫 application 증빙만 보조 조회한다. SYSTEM/USER_COMMON 전체 목록과 기존 document collector는 변경하지 않는다.
허용 신규3: apps/server/modules/backups/project-methodology-inventory.ts, tests/unit/FN16/project-methodology-inventory.test.ts, tests/unit/FN16/project-methodology-inventory-schema.test.ts. 기존제품/시험/SQL/보호8 수정0.

## 정확 수집 범위
collectProjectMethodologyInventory(access,token,value,signal). 기존 document-inventory-input의 유한한도, 양끝 READ COMMITTED 동일신원·OWNER/최소기한, 가운데 단일 RO REPEATABLE READ snapshot, 매 query timeout·SQL CASE row bytes cap/누적/응답한도, keyset200·회수/불명503·민감 비노출을 유지한다. 전체 pool/auth 시간 강제상한은 주장하지 않는다. 권한·표부재는 실패이고 빈성공으로 바꾸지 않는다.
1. methodology_definitions 9: id,scope,owner_user_id,project_id,system_code,name,purpose,head_version,created_at. SQL scope=PROJECT/projectId 필터, id key.
2. methodology_versions 10: definition_id,version,name,purpose,graph_json,content_hash,origin_ref_json,reason,created_by,created_at. 위 정의에 실제 JOIN해 프로젝트 범위를 고정하고 key definition_id/version. 다른공통본/프로젝트를 수집후버리는방식0.
3. content_reviews 21: id,scope_kind,scope_id,owner_user_id,project_id,draft_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id,created_at. PROJECT/projectId/METHODOLOGY SQL 필터, id key; 내부target 누락은손상.
4. methodology_reviews 12: id,definition_id,version,target_hash,validation_json,review_refs,decision,decided_by,decided_at,client_id,command_id,project_id. PROJECT/projectId 필터, id key. 기존PROJECT writer는CONFIRMED만저장한다.
5. project_methodologies 10: id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by,created_at. application_version=1과 실제 필요한초기 exactsourceRefs만. 다른모든application수집0·이번전체coverage아님.
6. commands 13: id,command_id,scope_kind,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id. PROJECT/projectId. review/confirmation의exact서버ID와 version마다 result.data.ref가exact일치하는 copyMethodology/saveMethodologyDraft 명령만 bounded 조회. JSONref 요청배열도200이하; 전체commands를읽지않는다. id key·조회union중복명령은동일행dedupe 후각consumption검증.
7. audit_events 4: event_id,project_id,command_id,server_sequence. 위명령의exact서버ID만·event_id key·각명령1개와project내순번유일·양의안전정수. 전체감사/hashchain 검증으로승격0.
실제schema: 0002_methodologies.sql, 0011_user_common_content_reviews.sql, 0011_user_common_method_reviews.sql, 0002_project_methodology_revisions.sql, 0011_authorization.sql. 적용실행0. 표·필드·writer이후추가조건은실제코드대조후Main에제시하고범위확대0.

## 역사 무결성·기존 producer 계약
- 정의PROJECT/owner=null/systemCode=null·전체version1..head 연속·각graph 원hash=canonical graph만. 정의name/purpose는최초행이며개정writer가 head만바꾸므로 최신version과이름일치를강제하지않고v1과대조한다. 같은사건시각/receipt는일치,서로다른transaction의시각단조금지.
- graph는 validateMethodologyGraph(graph,[])에서INPUT_INVALID만거절한다. 저장가능한 미완성 graph의 다른 issue는보존한다. 현재form목록으로과거draft/확정을재판정0. graph formRef/limitPolicyRef는exact외부의존,실제양식/현재실행연결NOT_PERFORMED.
- origin USER_AUTHORED/COPY(parentRef)/REVISION(parentRef)/DRAFT_CONFIRMED_SOURCE(draftRef,confirmationId,sourceRefs)를기존producer와대조. REVISION은같은id직전exactref, COPY는현재프로젝트밖이면외부참조만보존한다. 원문hash가graph만이므로name/purpose/reason/origin은원명령snapshot과도대조한다.
- copy/save명령은exactref별1개, APPLIED/actor=row.created_by/expectedVersion=version-1/기존명령snapshot 및receipt ref/target/version·sameevent시각·validation 기록검사. 요청/서버ID구분,policy/authreceipt는역사외부참조로보존하며전체정책/승인결박검증0.
- DRAFT_CONFIRMED_SOURCE 최초v1은정상적으로copy/save명령이없다. 이경우만해당project 첫application의sourceRef/hash/name/purpose/graph·created_by·같은생성시각·snapshot draftConfirmationRef와origin을대조한다. readApplicationSnapshot 순수parser를사용하되이것을현재적용으로표시하지않는다. 초기 draft/confirmation/sourceRefs 원증빙은외부미검증. 저장명령있음/없음을혼합해모순을숨기지않는다.
- 내용검토는 readProjectMethodReview/고정 methodContentReviewCriteria·원target·reviewerSubject(sameAsTargetRecorder포함)·행/receipt/command exact. 기존 source_kind HUMAN_REVIEW만. 익명화전실actor/client일치대조,투영은kind와sameAsTargetRecorder만보존한다.
- 확정은해당version의CONFIRMED·validation_json=receipt.validation/validForConfirmation=true 기록·1~200유일reviewRefs의ACCEPTED exacttarget을대조한다. 감사순번상해당확정보다앞선최신검토가ACCEPTED이고선택refs에포함되어야한다. 그뒤REWORK는과거확정삭제사유가아니다. 여러확정이력을전부보존한다. 검토·명령·감사중복/고아/누락은실패.
- 모든보존문자열/참조/이유·graph는known secret marker 검사,감지시고정503·원문출력0. 완전비밀탐지/OS소거주장0. USER_COMMON원문조회/자동공유/현재권한복원0.

## 반환과 시험
kind PROJECT_METHODOLOGY_INVENTORY_V1/scope PROJECT_METHODOLOGY_HISTORY_ONLY. projectId/definitions/versions/reviews/confirmations/issues/externalDependencies의7필드canonical contentHash(시각/usage제외); 원graphRef/hash와익명snapshot projectionHash구분. 외부의존존재시metadataComplete=false. file/input0,fullProjectCoverage=false/restorable=false/executionAuthorized=false/dispatchPerformed=false,blobVerification/authorizationBindingVerification/formAvailabilityVerification=NOT_PERFORMED,executionEvidence=NOT_CONNECTED. 전체applicationHistory는NOT_COLLECTED로명시한다.
AUTH401/NOT_FOUND404/INPUT400,PROJECT_METHODOLOGY_INVENTORY_CANCELLED409/DEADLINE·LIMIT413/INTEGRITY_FAILED·STORAGE_FAILED·SENSITIVE_METADATA503. 회수불명503우선/자동재시도0.
정상복수정의/버전/이름변경/미완성graph·초기초안생성본·COPY/REVISION·확정뒤REWORK·시각역전,201이상keyset/의도적공통본미포함,원hash/명령/검토·확정·감사손상,초기예외악용·누락application,다른project/양끝권한/신원/만료·취소/row/응답한도/cleanup 음성을메모리PG로검증한다. 전체기존불변시험반복0. 실제PG/RLS/原文FS/키/서비스·전체백업/복원/UI인수NOT_RUN. 결과·오류·지문은Main이WORK_STATUS/계획에기록한다. rollback은신규source검토revert이며원데이터삭제0.

## r2 확정이 선택한 모든 검토의 감사 순서
- 독립 I1: 확정 당시 최신 검토만이 아니라 선택된 모든 reviewRefs의 감사순번이 해당확정의 감사순번보다작아야한다. 실제writer는확정시이미존재한검토만선택하므로 미래ACCEPTED 혼입은거절한다. timestamp대소가아닌기존감사순번관계이며 새범위아니다. 정상최신ref와미래ACCEPTED를함께넣는음성1개를추가한다.
