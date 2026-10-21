# FN11 작업계획 초안 저장 일회 승인 구현 계획

> 실행: Main 단일 writer가 executing-plans/TDD로 수행하고 기존 reviewer는 마지막 한정 독립 검토만 한다. 새 세션/agent 생성0.

**목표:** 기존 saveWorkPlanDraft 한 연산을 준비→정확 입력 보관/요청→별도 결정→명시 일회 저장→재조회에 연결한다.
**구조:** 기존 ProjectCommand/승인 endpoint·정책/영수증 transaction을 소비한다. 요청 시 immutable candidate를 보관하고 새 forward0035만 작성한다.
**기술:** 기존 Node/TypeScript/Fastify/PostgreSQL 계약·React, 새 의존성0.
**기준:** `../contracts/FN11_WORK_PLAN_DRAFT_APPROVAL_PROPOSAL.md` SHA256 BD8DE5F2D391D66DC378C3BC8AE07B378D58BA76EEF504D1765BB1E8873EE0EA. 신산님의2026-10-21 정확 직접 승인(코드·화면·미적용SQL·합성 검증, 실제DB/정책/Agent 제외)을 이 카드의 채택 근거로 삼고 원 DRAFT 파일/hash는 이력으로 보존한다.

## 공통 제약·검토 초점

- 코드 허용은 한 연산만. 기존 AUTO/DENY/다른 승인·목표/기준/본문을 암묵적으로 바꾸지 않는다. 신규 endpoint/의존성/실제DB/정책/서비스/Agent0.
- 사용자 입력은 준비/승인/저장을 분리하고 유실은 같은 최종 명령만 확인한다. late 응답/주체 전환에서 다른 버퍼를 덮지 않는다.
- 원 payload와 서버 정규화 결과를 구별한다. 구버전/과거 결정은 보존하고 승인으로 계획 확정/실행하지 않는다.
- 새SQL의 컴파일/COMMIT·직접DML/잠금 경합은 실제PG 미실행으로 남긴다. fake/DOM PASS로 SQL 성공이라 하지 않는다.
- review focus: 현재권한 후 exact replay/신규CAS, 요청시 입력과 결정시 원문 동일성, 미적용 저장의503/비밀없는오류, 양방향receipt/소비/계획·감사 완결성, UI유실/주체이탈/2MiB 초과입력보존.

## Task 1 서버 승인 후보·요청/조회/소비 연결

- 파일: 새 `apps/server/modules/approvals/work-plan-approval-candidate.ts`, 기존 `project-approvals.ts`, 필요한 최소 work-plans/project-command 연결; 새 `tests/unit/FN11/work-plan-approval-candidate.test.ts` 및 소비 회귀.
- 인터페이스: `readWorkPlanApprovalPayload(value,expectedHash)` exact 원payload clone; `WorkPlanApprovalCandidates.assertCurrent(db,pid,scope,payload)` target/원문기준 검사; `.capture` 요청/receipt/policy 귀속 불변 저장; `.read` OWNER+요청자만 hash/원명령 귀속 검증 후 candidatePlan 반환.
- [ ] 신규/개정·변조/추가필드·타프로젝트/OWNER제한·정규화와원payload구분·저장503의 실패 검사를 먼저 작성, `node --test tests/unit/FN11/work-plan-approval-candidate.test.ts`로 RED 확인.
- [ ] 최소 구현 후 같은 검사 GREEN. 기존 approval-input/source-detach-target/consumption·work-plan 직접인접 검사와 typecheck/diff를 실행해 기존연산 보존 확인.
- [ ] 현재권한/정책→동일소비명령 replay→신규만target/CAS 및 원문귀속을 제어하고 요청/결정/소비 callback을 테스트. 소유 파일만 checkpoint.

## Task 2 미적용 SQL 집행 보호

- 파일: 신규 `db/migrations/0035_work_plan_draft_approval.sql`; 기존 적용SQL 수정0.
- 인터페이스: `work_plan_approval_candidates` immutable/request FK; 기존 one_time 소비·request/receipt guard에 한 연산 분기만 추가. 기존원함수 연산조건은 그대로 보존한다.
- [ ] 후보 row의 정확원payload/hash/target·요청command/receipt/감사와 양방향 deferred 검사, 실제저장 command/receipt/소비/원payloadhash·계획head/version/tasks/dependencies와 원자 결박.
- [ ] orphan/누락/변조·두명령재사용/직접DML·정책/세대/기한 및 후속합법개정 규칙을 코드와 대조한다. 실제SQL 실행0/미검증을 기록하고 기존001~0033 지문보존을 확인한다.

## Task 3 UI06/UI08 연결·한정 검수

- 파일: 기존 `decisions/api.ts`·`ApprovalsPage.tsx`, `design-trace/work-plan-api.ts`·`WorkPlanEditor.tsx`; 새 `decisions/work-plan-approval-api.ts` 및 관련 단위/브라우저 검사.
- 인터페이스: 기존 승인 work buffer에 exact 후보·요청 유실명령을 보존, `candidatePlan={candidateCommandId,payloadHash,payload}` 검증. 승인 binding은 아직전송하지않은 저장명령에만 명시 적용한다.
- [ ] 준비/요청/결정/저장 분리·정확입력표시·변조거절·유실동일body/ID·거절후새후보·late전환보존·2MiB/서버413 입력보존을 먼저 RED로 확인한다.
- [ ] 같은범위 GREEN·직접인접 검사·type/build·diff 확인, 기존 reviewer가 변경범위 전체를 독립 정적 검토한다. 실제QA결과폴더는 생성전 WORK_STATUS/코멘터리에 이름/소유/수명/정리를 등록한다.
- [ ] 구현/합성/미적용SQL/실제미검증을 WORK_PLAN/WORK_STATUS에 구분해 기록·정리잔여 확인·private exact게시. 실제DB·실정책·서비스·Agent/전체Stage 완료라 하지 않는다.

## 실행 기록

정본 ledger는 `docs/WORK_STATUS.md`를 사용한다. 새 임의 자동화/별도복구정본을 만들지 않는다. 단계별 RED/GREEN·오류·diff·미검증과 다음 행동을 거기에 누적한다. 일부가 미완료면 COMPLETED라 하지 않고 해당 상태로 보존한다.
