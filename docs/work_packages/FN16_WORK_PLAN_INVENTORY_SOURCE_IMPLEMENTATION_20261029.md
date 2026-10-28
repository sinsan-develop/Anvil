# FN16 작업계획 이력 수집 작업지시서

## 기준·범위
2026-10-29. 부모 f4d3bf2bf55f39f4466a225ba31d5794a2e4333f / codex/av3-stage-b. 설계§10.4·FUNCTION_WORK FN16 및 신산님 신규 계약 source·합성 승인 안의 내부 자료군이다. 실제 DB/FS/키/서비스/P03/Agent/job0, 공개형식/schema/권한확대0. 기존 fn16_primary 단독 구현, fn16_review 독립 읽기 검수, Main 관리·검수·통합.
허용 신규3경로: apps/server/modules/backups/work-plan-inventory.ts, tests/unit/FN16/work-plan-inventory.test.ts, tests/unit/FN16/work-plan-inventory-schema.test.ts. 기존 수집기/업무 writer/helper/SQL/시험은 수정하지 않는다. TEST_ONLY→Main RED→source GO 순서.

## 입력·자료 수집
내부 collectWorkPlanInventory(access,token,value,signal). 기존 readDocumentInventoryInput의 projectId/유한limits 그대로. 외부 inventory/SQL/actor 입력0. 기존 collector의 최초/최종 RC 동일 actor/client/session/credential·OWNER/nonarchived·관측최소기한, 단일 RO RR의 실제isolation/readOnly/snapshot 대조·ROLLBACK반납·최종auth COMMIT뒤check 계약을 따른다. 실제 pool/auth 대기 전체의 강제시간상한을 보장하지 않는다.
모든자료 projectId 매개변수·명시열·정렬keyset 최대200·SQL CASE payload byte한도·누적metadata한도. 아래명시열을 실제migrations와schema시험에서 대조한다. 명시된 command/audit 외 다른자료를 따라읽지 않는다.
- work_plans: id,project_id,head_version,confirmed_version,created_by,created_at,updated_at; key id.
- work_plan_versions: project_id,plan_id,version,document_id,document_version,document_hash,design_id,design_version,design_hash,screen_review_refs,content_hash,version_json,created_by,client_id,command_id,created_at; key plan_id,version.
- plan_tasks: project_id,plan_id,plan_version,task_code,task_type,card_json,card_hash,owner_role; key plan_id,plan_version,task_code.
- plan_dependencies: project_id,plan_id,plan_version,task_code,dependency_task_code,phase; key plan_id,plan_version,task_code,dependency_task_code,phase.
- work_plan_confirmations: id,project_id,plan_id,version,target_hash,review_refs,validation_json,confirmed_by,client_id,command_id,created_at; key id.
- content_reviews: 기존 knowledge-inventory의 명시19열, PROJECT/scope_id=projectId/target_kind=WORK_PLAN만, key id. 같은target의 모든review를 수집하며 기존조회 LIMIT200 helper로 잘라내지 않는다.
- commands: id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id. 위save/review/confirm exact command IDs만 묶음조회.
- audit_events: event_id,project_id,command_id,server_sequence. review command의 exact증빙만. 전역감사/권한정책/현재receipt수집·권한복원0.

## 무결성·역사 의미
1. work_plans head와 연속1..head 버전, 작성자/첫버전·시각·확정pointer를 대조한다. orphan/중복/다른project/불명참조/버전누락은 고정무결성실패다.
2. version_json 정확 `{ref,status,...snapshot}`. status DRAFT는 확정 후에도 그대로 보존한다. snapshot 정확 documentRef/designRef/screenReviewRefs/tasks/dependencies/reason/issues/relationalProjection 8필드만 canonical hash해 content_hash/ref와 대조한다. 분리열 document/design/screen refs도 exact검사. reason과issues는 유한·wellformed/닫힌형식. 원문을 다시읽어 과거issues를 재생성하지 않는다.
3. analyzeWorkPlanCards의 순수결과 tasks/dependencies·구조issues를 대조한다. source확인issue는 원snapshot/hash로 보존하고 현재원문판정으로 덮지 않는다. 구조ambiguity에 따른 STORED/ISSUES_ONLY는 실제writer 기준. STORED는 모든 card_json/hash/type/owner/code 및 START/ACCEPTANCE 관계 exact; ISSUES_ONLY는 tasks/dependencies 관계행0이어야 하며 그 자체가 손상/완료가 아니다.
4. saveWorkPlanDraft command APPLIED/operation/actor/client/expectedVersion=v-1, exactresult target/version/ref/workPlan/status/기록시각을 기존writer와 대조. result.commandId는 외부 request id이므로 DBcommands.id와 임의동일시하지 않는다.
5. 모든 WORK_PLAN review는 readWorkPlanReviewInput/workPlanReviewCriteria 재사용, target/ref/기준5/항목/평결·reviewer HUMAN/sameAsTargetRecorder·exactcommand/시각·audit순번을 내부 검증한다. 결과에서 실제user/client 식별자는 제외하고 역사 HUMAN/sameAsTargetRecorder만 남긴다.
6. confirmation은 exacttarget/version/hash, 중복0, named ACCEPTED reviewRefs·같은target·저장당시validation exact를 확인한다. validation은 validForConfirmation=true/issues=[]/sourceRefs=[documentRef,designRef]/screenReviewRefs 동일, 대상STORED/nonempty tasks, command confirmWorkPlan·APPLIED·정확result/confirmationId/reviewRefs/validation/activatedAsBaseline=false·actor/client/시각을 대조한다. 현재 최신review를 강제하는 acceptedWorkPlanReviews를 그대로 호출하지 않는다. 과거확정 뒤 새 REWORK도 보존하며 현재 유효/실행 가능으로 승격0. 역사validation은 당시결과이지 원문현재성 증명아님. confirmed_version은 보존된 해당확정과 연결하고 기존writer의 단조버전규칙에 맞는 최신확정pointer인지 검사한다.
7. 외부 exact 의존: AF04 documentRef, AF02 designRef, screenReviewRefs의 대상문서/ref, 각task designRefs/screenRefs. 관련 원문·공통양식/설계항목·trace edges·설계변경/baseline·실행증거는 이번에읽지 않는다. 미확인을빈배열/완료로숨기지않는다.
8. 허용파일 상대참조 등계획본문은자료로보존하며 실행경로로사용0. output의 모든텍스트/refs에 기존known-pattern metadata검사를 적용하고 발견시고정오류. 실제storage경로·토큰·사용자/client/session·Secret출력0, 완전비밀탐지주장0. 원본hash와 익명projectionHash구분.

## 결과·오류
kind WORK_PLAN_INVENTORY_V1/scope WORK_PLAN_HISTORY_ONLY. projectId/plans/versions/tasks/dependencies/reviews/confirmations/issues/externalDependencies/observation/usage/contentHash. 원문참조는문서외부의존으로남기며 fileCount/inputBytes=0, blobVerification=NOT_PERFORMED/executionEvidence=NOT_CONNECTED/fullProjectCoverage=false/restorable=false. metadataComplete는 unresolved외부참조/이슈가하나라도있으면false. 관측은기존RO RR+양끝RC형식. 전체contentHash는 projectId/plans/versions/tasks/dependencies/reviews/confirmations/issues/externalDependencies 9필드의canonical,시각/usage/selfhash제외. arrays순서고정·중복없음, 결과UTF8 metadataBytes도유한검사.
오류 AUTH_REQUIRED401/NOT_FOUND404/INPUT_INVALID400, WORK_PLAN_INVENTORY_CANCELLED409/DEADLINE·LIMIT413/INTEGRITY_FAILED·STORAGE_FAILED·SENSITIVE_METADATA503. DB/driver본문/cause/stack비밀노출0. 회수불명은동시취소보다503우선,미완료query중client정상반납0. 이미확인한실패를시간연장·기준완화·재시도로숨기지않는다.

## 최소 검증·제출
실제수집함수+메모리PG만. 정상2버전/STORED·START/ACCEPTANCE·과거확정후새REWORK, ISSUES_ONLY정상·관계행혼입거절, snapshot/ref/분리열/card/hash/관계누락/extra·command/review/audit변조·다른target/확정pointer, review200초과수집, 한도·양끝권한·중간/종료기한·취소·회수/비밀metadata거절. schema시험실제열검사. 신규시험+type/diff, 기존불변수집기시험반복0. 검토소견C/I해결·Main검증후정확파일만private게시/결과·WORK_STATUS·WORK_PLAN기록. 실제DB/FS/키/서비스·전체archive/복원/UI인수미검증유지.
