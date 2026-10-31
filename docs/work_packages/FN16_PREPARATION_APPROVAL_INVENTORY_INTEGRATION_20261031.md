# FN16 일회 승인 실행준비 이력 — 내부 통합 WI

2026-10-31 / dispatch 전 독립 경계검토 / 기준 codex/av3-stage-b 6ecef26ca8a022c989402c8ca475722c4042c66b.
사용자 승인된 FN09 prepareExecution A안(source 직접승인 B50A7709, WI9E91E587) 및 WORK_PLAN FN16의 원문·승인·실행준비 이력 보존에 따른 내부 정합 보완이다.

## 1. 실제 충돌·범위
현재 context-preparation-inventory.ts는 buildTaskContext 승인만 해석하고 requestApproval 원 payload를 {details}로 재구성한다.
prepareExecution의 승인 source는 기존 execution_preparation_approval_candidates에 intent를 보관하며 {details,candidatePayload:intent}를 원요청에 결박한다.
준비 loop는 승인 인자 없이 evidence를 호출하므로 정상 approved 원형을 hash/consumption 불일치503으로 거절한다.
변경은 같은 내부 이력 DTO에서 승인된 준비 원형을 정확 보존하는 것뿐이다.
새 공개 endpoint/DTO필드·표·SQL·approval producer·권한·실행 허가·실제 backup/복원 지원을 추가하지 않는다. 전체 coverage412와 기존 프로젝트 차단을 유지한다.

## 2. 역할·정확2경로
기존 Primary 단일 writer, Main 문서·검수·통합, 기존 Reviewer 읽기. Main 같은 코드 수정0.
1. apps/server/modules/backups/context-preparation-inventory.ts
시작 SHA256 A00EA72847F006C51E4AF12351E264858637DF16E140EDCA48E396234B49DF46
2. tests/unit/FN16/context-preparation-approval-inventory.test.ts
신규, 시작 때 부재 확인.
기존 context inventory/schema 및 FN09 prepare approval 시험은 수정 없이 회귀한다. 다른 collector/shared helper/producer·원SQL/pending·UI·보호3·WORK_STATUS·Git은 Primary 수정 범위 밖이다.
실제 필요가 확인된 추가 변경은 정확 경로/근거를 Main에 보고하며 해당 변경 전 범위를 확정한다.

## 3. 같은 RR의 후보 원문 검산
- 기존 RR/read-only와 양끝 현재 OWNER/신원·기한/한도·해제/불명 처리는 그대로다.
- 후보는 승인된 prepare 원명령에 연결된 request ID만 유한 선택 조회한다. 대상이 없으면 새 표를 무조건 스캔하지 않는다. 프로젝트 전체 후보·무관 PENDING 후보를 새로 수집했다고 주장하지 않는다.
- 기존0055 source의 명시11열만 읽는다: project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,created_at.
- 같은 db/현재 actor를 사용하며 공개 candidate.read의 본인용 제한을 피하려고 creator actor/client로 위장하거나 별도 authenticated transaction을 중첩하지 않는다. 현재 OWNER와 과거 원작성자를 구분한다.
- project/request ID·서버 request command ID·외부 candidate command ID·원작성자/client/controlGeneration·request policyRef·원시각을 실제 원행과 대조한다. 숫자/UUID/정확 keys와 duplicate/missing/extra selected row를 거절한다.
- readExecutionPreparationApprovalPayload 같은 기존 순수 payload 검산을 재사용해 payload hash·프로젝트·준비 intent 원형을 확인한다. 현재 assertCurrent나 원권한·기한을 과거 사실에 재적용하지 않는다.
- row_bytes/metadata·기한·선택집합/정렬/최대200 페이지 등 기존 유한 검산을 유지한다. 표 없음/불명/대상 누락을 AUTO/null 승인·빈 성공으로 바꾸지 않는다.

## 4. 기존 승인 검산 재사용
- approvalFor의 operation은 고정 caller의 buildTaskContext 또는 prepareExecution으로 닫는다. DB에서 읽은 임의 operation을 그대로 allowedOperations로 쓰지 않는다.
- buildTaskContext 원형 {details}·기존 정상/거절 동작은 보존한다. prepareExecution만 후보 intent와 연결한 {details,candidatePayload}로 requestApproval 원형/hash를 검산한다.
- 준비 source evidence는 정확 approvalRef·원request/decision/consumption·candidate hash/tuple·payload_ref를 사용한다. 원명령/receipt/audit·scope digest·사건 논리 순서/정확 consumed linkage·중복 소비 검산을 생략하지 않는다.
- policy 관계는 현재 producer/consume의 실제 규칙과 대조한다. 기존 helper의 equality를 이유 없이 제거하지 않는다.
- 사용한 후보/요청/결정/소비가 서로 맞고, 기존 dangling/unused consumption 거절은 유지한다. 무관 approval을 준비본에 결박하지 않는다.
- 현재 root/child 실행 차단·NOT_AUTHORIZED·executionAuthorized=false/dispatchPerformed=false·자료 원hash/익명 투영·NOT_PERFORMED는 그대로다.
- 후보 원문을 검산에 사용했다는 사실과 모든 후보 원문을 공개 백업 자료로 완전 반출/복원했다는 주장을 구분한다. 현재 내부 DTO 필드는 늘리지 않는다.

## 5. TDD·검수
실제 승인 요청→별도 결정→승인 결박 준비 저장 source가 생산한 원문/영수증을 수집하는 RED부터 확인한다.
가능하면 실제 request/capture/decision/prepare/persist 함수를 합성 포트에서 소비하며 대역 auth/policy/DB 범위를 보고한다.
정상 approved 준비·AUTO·기존 buildTaskContext 승인과, 과거에 만료됐어도 당시 정상 소비된 이력·원작성자와 다른 현재 OWNER의 정상 역사 수집을 확인한다. 현재 비OWNER·현재 세션/수집기한 실패와 원후보/intent/hash/주체/세대·원command/request/decision/receipt/audit·소비/순번의 변조·누락/중복, 현재 한도 초과·회수 불명은 거절한다. 현재 정책을 과거 내용에 재적용하지 않으며 현재 읽기 접근 보호는 기존대로 유지한다.
독립 손상 fixture로 구조검사에 도달할 수는 있지만 정상 producer 결과를 재봉인해 검산을 억지 통과시키지 않는다. 준비 오류와 제품 RED를 구분한다.
기존3 직접 회귀·typecheck/diff만 선택한다. 완료된 child35/이해scope38과 전체회귀/UI·실DB 검사를 반복하지 않는다.
최종 정확2지문/최소diff·명령/exit/결과·남은 범위·writer 반환을 보고한다.

## 6. 실제 제외·복구
실제 DB/SQL/RLS/권한·키/사용자파일조사·서비스/Agent·실백업/복원·프로젝트 차단 해제0, 새QA0.
합성 결과를 실제 COMMIT/경합·백업 성공으로 승격하지 않는다. 전체 FN16/계획 미완료를 유지한다.
rollback은 정상 source commit revert이며 실제 원문/DB 삭제·down migration0. main 병합/배포0.
