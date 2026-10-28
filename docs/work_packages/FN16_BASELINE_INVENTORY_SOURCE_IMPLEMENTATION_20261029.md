# FN16 활성 기준 역사 내부 수집 작업지시서

## 범위·착수
2026-10-29 / codex/av3-stage-b. 기존 FN16 설계§10.4/승인 source·합성 범위의 자료 보존이다. 직전 설계변경 수집 검수·게시 후 WORK_STATUS에 HEAD를 고정하고 기존 primary TEST_ONLY→Main RED→SOURCE_GO, reviewer 독립검수한다. 이 문서는 제품 GO가 아니다.
허용 신규3: apps/server/modules/backups/baseline-inventory.ts, tests/unit/FN16/baseline-inventory.test.ts, tests/unit/FN16/baseline-inventory-schema.test.ts. 기존 source/시험/SQL 수정0·실제DB/FS/키/서비스/P03/Agent/job0. pending0050 적용0. 현재 활성화 생산경로 차단을 유지하고 synthetic 이력을 실제 활성화로 보고하지 않는다.

## 수집·권한
collectBaselineInventory(access,token,value,signal), 기존 readDocumentInventoryInput 유한limits/양끝RC 동일 신원·OWNER·관측최소기한/단일 RO RR 실제isolation/readOnly/snapshot/rollback반납/최종COMMIT뒤검사. pool/auth 전체강제상한 주장0.
projectId 매개변수/명시열/최대200keyset/SQL CASE payload byte cap/누적metadata. 표부재·권한부재는실패이며빈목록성공0.
- baseline_activations 11: project_id,id,generation,content_hash,snapshot_json,previous_activation_id,command_id,approval_consumption_id,created_by,client_id,created_at. key generation,id.
- baseline_activation_current 3: project_id,activation_id,activation_ref. 해당project단일행만 bounded조회,0~1.
- baseline_activation_rechecks 7: project_id,activation_id,plan_id,plan_version,plan_hash,task_code,impact_ref. key activation_id,plan_id,plan_version,task_code. task_code의SQL cursor/내·외 정렬 모두 COLLATE C와동일비교;DB설정변경0.
- commands 13: id,command_id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id,approval_consumption_id. 참조된exact서버명령ID만중복없는묶음조회, schema대조.
후술외부증빙은조회0. current/readStoredDesignActivationRelations/fn04_activation_history_valid는다른자료·현재판정의존이있으므로호출0.

## 역사 무결성과 명시적 검증 한계
1. readBaselineActivationRecord 순수parser로 원snapshot18필드전체hash를검증한다. generation1..n 연속·각activationId유일·previousRef/id정확·최신currentpointer와same ref,역사0이면pointer0/rechecks0. 과거를current로적용하거나current권한으로복원0.
2. 분리열 project/id/generation/hash/previous/servercommand/consumption/actor/client/time검사. snapshot.commandId는외부요청UUID이며commands.command_id/result.commandId와대조,행command_id는commands.id와대조. 혼동금지. snapshot recordedBy user/client는검증후 kind HUMAN만투영,원hash와projectionHash분리.
3. exact명령은activateDesignChange/APPLIED,expectedVersion=snapshot.changeRef.version,actor/client/controlGeneration/policyRef동일. receipt target/version은기존persist결과의activationRef, data는 ref/status DESIGN_BASELINE_ACTIVATED/snapshot/executionAuthorized=false/dispatchPerformed=false를기존writer와대조하며시각동일. 서버명령·요청명령·소비ID 재사용거절.
4. recheck는activation내부존재·planRef/version/hash/taskcode형식/unique키·impactRef=snapshot.impactRef대조. 해당impact의AFFECTED PLAN_TASK 전체집합은이번에읽지않으므로누락/추가검증완료로주장0. 반환 recheckCoverageVerification=NOT_PERFORMED,외부의존에 exactimpact포함. 새 작업을재개하거나재검토상태를발급0.
5. 승인소비→decision/request/candidate/authorization_receipt/audit 전체결박과현재실행안전은이번에조회/검증0. approvalBindingVerification=NOT_PERFORMED를고정하고snapshot의approvalRef/consumptionId/policyRef/candidatePayloadHash 등은역사참조로만보존. 존재만으로일회승인검증성공이라하지않는다. 이한계를internal metadata그룹의완료와분리한다.
6. 외부의존: change/impact/approvedDesign/confirmedPlan exactref, approval/consumption/policy/authorizationreceipt/candidatepayloadhash,각recheck plan. 미확인증빙이있으면metadataComplete=false. 권한표·candidate전체목록·원문·Secret조회/반출0.
7. 모든투영문자열/refs known-pattern검사·발견시고정오류,실제user/client/session/token/storage본문출력0. 원본snapshot을익명projection과같다고하지않는다. 완전비밀탐지주장0.

## 결과·검수
kind BASELINE_INVENTORY_V1/scope BASELINE_HISTORY_ONLY, projectId/activations/current/rechecks/issues/externalDependencies/observation/usage/contentHash. hash는 projectId/activations/current/rechecks/issues/externalDependencies6필드 canonical,시각/usage제외. 배열결정적·투영별projectionHash. fileCount/inputBytes0,blobVerification NOT_PERFORMED/executionEvidence NOT_CONNECTED/fullProjectCoverage=false/restorable=false/executionAuthorized=false/dispatchPerformed=false. 위승인·집합검증2종NOT_PERFORMED,결과UTF8한도.
AUTH401/NOT_FOUND404/INPUT400, BASELINE_INVENTORY_CANCELLED409/DEADLINE·LIMIT413/INTEGRITY_FAILED·STORAGE_FAILED·SENSITIVE_METADATA503,회수불명503우선·재시도/기준완화0.
신규메모리PG시험: 정상세대2·과거/current·서버/요청ID구별·익명원hash·외부승인미검증표시·200초과세대/ASCII코드paging, pointer/parent/분리열/명령/recheck변조,ID재사용,표부재,권한/한도/기한/취소/회수. type/diff·독립검수,기존불변시험반복0. 실제PG/RLS/키/서비스/전체backup/복원/UI인수NOT_RUN. 전체FN16미완료.

## r2 기존 명령의 소비 ID 국소 대조
- Main eca3d3와 독립 검토에서 기존 persist가 snapshot/activation행/commands에 동일 reserved consumptionId를 저장함을 확인했다. 명령13번째열 approval_consumption_id도 동일UUID로 대조한다. NULL/다른UUID 모순은거절한다. 실제consumption→decision/request/audit의 외부결박은여전히 NOT_PERFORMED이며 새table조회/권한발급0. 기존12열시험을13열로보강하고새반례를제품착수전동결한다.
