# FN10/FN11/UI11 한도 정책 저장·회수 원명령 일회 승인 연결

2026-10-27 · Main 어울 · 기준 `codex/av3-stage-b` / `75b7405bf87742a68f8b5a9a9d5ab79a819272ed`.

## 목적·범위

FUNCTION_WORK FN10/FN11·기존 INTERFACES와 UI11의 applyLimitPolicy/revokeLimitPolicy를 소비한다. 현재 신규/개정 한도 저장·회수·고정 조회는 AUTO에 연결돼 있으나 사전 정책 검사가 REQUIRE_APPROVAL을 미연결로 거절해 원명령 준비에도 도달하지 않는다. 기존 동결→사용자 별도 전송을 유지하고, 서버의 명확 APPROVAL_REQUIRED/412 후 각각 별도 승인 요청·결정·결박·원명령 저장에 연결한다.

두 연산은 같은 buffer·버전 원장·head CAS·복구 경계의 한 업무이나 **각 연산/버전/원명령별 별도 승인**이다. 저장 승인을 개정/회수나 실제 Agent 호출에 전파하지 않는다. 기존 유한 한도·scope·기한·비밀 방지와 현재 head/state 검사를 보존한다. 회수는 기존 의미만 유지하며 실행 중지·예약 해제·과금 취소를 추가하지 않는다. 새 한도 규칙·operation·공개 API/DTO·권한 예외·후보 영구 저장·표/role/GRANT·의존성/외부 비용 추가0. 실제 DB/SQL 적용·사용자 정책/권한 부여·실제 quota/호출·Secret/TLS/서비스·Agent/native 실행은 제외한다. 기존 EXECUTION 범위 미연결과 runtime 실행 허가 차단은 유지한다.

## 단일 writer 허용19경로

1. `apps/server/modules/access/project-command.ts`
2. `apps/server/modules/approvals/project-approvals.ts`
3. `apps/server/modules/approvals/approval-input.ts`
4. `apps/server/modules/executions/runtime-policy.ts` — 한도 자료 apply/revoke·역사 read만. 실행 허가/dispatch/reserve 함수 의미 변경0.
5. `apps/web/src/features/connections/limit-policy-api.ts`
6. `apps/web/src/features/connections/LimitPolicyPanel.tsx`
7. 신규 `apps/web/src/features/connections/limit-policy-approval.ts`
8. 신규 `apps/web/src/features/connections/LimitPolicyApprovalEditor.tsx`
9. `apps/web/src/features/decisions/api.ts`
10. `apps/web/src/features/decisions/ApprovalsPage.tsx`
11. `apps/web/src/App.tsx` — 기존 limitBuffers의 읽기 전용 원화면 복귀 prop만. 다른 상태/화면 재작성0.
12. 신규 `db/migrations/0048_limit_policy_one_time_approval.sql.pending` — 생성 전 번호 부재 재확인.
13. 신규 `tests/unit/FN10/limit-policy-approval-input.test.ts`
14. 신규 `tests/unit/FN10/limit-policy-approval-consumption.test.ts`
15. 신규 `tests/unit/UI11/limit-policy-approval-api.test.ts`
16. 신규 `tests/browser/UI11/limit-policy-one-time-approval.spec.ts`
17. `tests/unit/FN08/runtime-policy.test.ts` — 직접 guard 기대·강화된 SELECT의 command/receipt/audit 원열 fixture 정합만. 기존 정상/실패/부작용0 검사 보존.
18. `tests/unit/UI11/limit-policy-api.test.ts` — 사전 정책 사실/원명령 준비와 명시 승인 전이에 직접 영향받는 기존 기대만 정확히 갱신.
19. `tests/unit/FN08/runtime-permission.test.ts` — 마지막 runtime 정책 저장의 예산 fixture에 강화된 SELECT의 command/receipt/audit 원열만 보완한다. MISSING/TOO_LONG/CURRENT/DOCUMENT 기대·실제 RUNTIME_POLICY_EXCEEDS_BUDGET_EXPIRY와 실패 쓰기0을 유지하며 제품 runtime 정책 동작은 변경하지 않는다.

Main 제품 수정0·동시 writer1명. ConnectionsPage는 이미 함수형 LimitBufferChange를 전달하므로 원칙적으로 수정 없이 소비한다. 보호 untracked8·이전0047/0017·다른 완료 소스는 보존한다. 추가 경로는 실제 호출선/최소 diff를 Main에게 먼저 제시한다.

## 원명령·현재성·역사

1. 기존 limits/scope/reason/policyBaseVersion payload와 revoke의 기존 limits/expiresAt 보존 의미를 유지한다. 신규 apply는 targetRef=null/expectedVersion0, 개정 apply·revoke는 **원 base.ref 전체**와 expectedVersion을 결박한다. policyBaseVersion만으로 hash 대조를 대신하지 않는다. 원 candidateCommandId·raw payload hash·top 봉투·HUMAN user/client/control/현재 permission policy ref를 결박하고 payload/한도 자료 ref를 임의 scope 필드로 이동하지 않는다.
2. limitPolicyAccess는 현재 회원/OWNER/client/control·명시 정책·DENY/기한 검사를 유지하되 REQUIRE 여부는 사실로 구분해 원명령을 동결할 수 있게 한다. 이를 로컬 APPROVAL_REQUIRED로 위장하거나 승인 없이 저장 허가로 바꾸지 않는다. 원명령을 사용자가 실제 전송해 서버의 명확412를 받은 뒤에만 요청 준비를 연다. UNKNOWN 후412는 새 승인으로 우회하지 않는다.
3. 서버는 현재 제어/명시 정책→exact replay→신규만 실제 base fullref/current head·허용 한도/scope/state/기한 재검사→정확 승인 소비·불변 버전/receipt/audit를 기존 transaction에서 저장한다. 신규/개정 apply와 revoke의 기존 CAS·동시성 조건을 유지하며, 각 명령은 별도 승인이다.
4. 기존 역사 reader는 approvalRef:null로 request_hash를 재구성하므로 정확 당시 승인·소비/receipt/audit로 원명령을 재구성하도록 연결한다. 실제 command/operation 원열과 영수증 commandId/operationId·raw snapshot/hash·주체/client/control·대상/기준을 대조한다. 누락 receipt/감사나 중복이 INNER JOIN/DISTINCT에 숨지 않게 한다. 현재 member와 과거 권위를 구분하며 합법 policy/control/head 개정만으로 과거 승인본을 위조 취급하지 않는다. 현재 resolveCurrent의 head/APPLIED/기한 검사는 유지한다.
5. 신규0048은 현재0047 wrapper chain을 이어 두 한도 연산만 확장한다. 기존0017 한도/scope/state/current head·출처 검사는 보존한다. 후보 원문을 새 영구 표에 저장하지 않으며 필요한 소비 전 raw payload는 기존 저장 원문 또는 한정 transaction-local GUC로 대조한다. 최종 자료/소비/command/receipt/audit를 원자 완결하고, mixed operation·allNULL/receipt-only·자료없는APPLIED·주체/source 불일치·UPDATE/DELETE 흔적 삭제를 거절한다. 정상 AUTO/null과 다른 연산·EXECUTION 차단·기존0047까지 chain은 회귀 확인한다. 실제 compile/DML/COMMIT/RLS/경합은 미실행으로 명시한다.

## 화면·동작

- 기존 App limitBuffers(user/client/project)와 LimitBufferChange를 소비한다. 원 buffer·draft·base·pending/pendingHash를 보존하고 정확 명시 결박 때 같은 commandId/payload에 approvalRef를 한 번 추가해 새 command hash를 대조한다. 승인 전 참조를 null로 되돌리거나 사라진 원후보를 hash만으로 복원하지 않는다.
- 신규 apply→보호 GET의 정확 ref, 개정 apply→현재 base fullref, revoke→그 다음 현재 fullref 각각에서 명확412→요청→UI08 별도 결정→동일 owner/client/project/candidateCommandId의 기존 buffer가 있을 때 connections 복귀→보호 GET·명시 결박→별도 저장/회수→고정 재조회다. 각 단계는 별도 사용자 동작이며 승인/결박만으로 자료 저장0이다.
- API/session/transport/프로젝트·입력 ABA·이탈·늦은 응답을 차단한다. 정상 pending→uncertain→성공의 이전 예상 단계는 binding/전체 원명령으로 대조하며 객체 identity만으로 정상 완료를 버리지 않는다. 응답 유실은 같은 command, GET 실패는 영수증을 유지한 수동 재조회다. 실제 POST/GET DTO와 현재 표시 ref를 분리한다.
- 거절/수정/만료·같은 현재 제어에서 policy만 개정돼 회수된 미소비 요청은 보호 GET을 다시 확인한 사용자 명시 로컬 종료로 입력에 복귀한다. 원명령/요청/종결 이력과 입력을 보존하고 이력 안내는 pending=null 뒤에도 보이게 한다. 실행용 현 정책 검사와 로컬 종료를 혼합하지 않는다. 다른 제어/주체·소비·UNKNOWN은 잠금 유지다.
- 기존 한도 수치/유한 상한·비용 미확인·사용량/공급자 청구 미검증·executionAuthorized/dispatchPerformed=false를 유지한다. 정책 저장을 실제 사용량/실행/비용 보장으로 표시하지 않는다.

## TDD·검수·자원

- 먼저 신규 소비 시험1파일만 작성해 제품/SQL 불변의 실제 LIMIT_POLICY_APPROVAL_NOT_CONNECTED guard와 기대 APPROVAL_REQUIRED/412 기능 RED를 Main이 확인한다. 모듈 부재/도구·fixture 오류는 기능 RED로 세지 않는다. 그 뒤 단일 writer가 허용19를 구현하며 pure/type·메모리 build만 수행한다.
- 신규/개정 apply·revoke의 별도 승인/원명령·같은 저장 ref와 역사 재조회, AUTO/null 회귀, 다른 operation/fullref/hash·head 경합·현재 권한/기한·소비 재사용·원명령/요청 응답 유실·UNKNOWN 후412·GET 실패·중간 실패 rollback·이탈/ABA·종결 복귀를 확인한다. 기존 runtime-policy/limit-policy-api/FN11·직전 stage/context 승인의 직접 영향만 검사하고 불변 전수 반복0. 기존 테스트/기준 완화0.
- Main만 실제 App/Edge를 실행한다. 신규 spec은 실제 저장 가능한 permission policy DTO(대상 REQUIRE, request/decide 별도 AUTO), 정확 POST/보호 GET·role/name·왕복 뒤 사용자 확인을 대조한다. 실제 DB/서비스 증거로 합성 결과를 승격하지 않는다. 기존 공용 bundle helper를 변경하지 않고 신규 exact env만 소비한다.
- 신규 QA 사전등록 `D:/tmp/anvil-v3-stage-b/ui11-limit-policy-approval-20261027-01`의 dist/results/temp/config.mjs만, env `ANVIL_UI11_LIMIT_POLICY_APPROVAL_DIST`=exact dist. owner SINSAN\cyhuh·각 생성30분·기존browser/listener/PG0. 생성 직전 부재/부모owner/realpath/nonlink·write:false bundle·headless Edge 합성, 실패/종료 때 정확 소유 항목/해당 process0/link/realpath 확인 후 회수·독립 잔류0. writer 자원 생성0.
- 독립 C/I 해소·Main fresh 검증 뒤 소유 파일만 기존 branch checkpoint/private 게시한다. 소스 rollback은 후속 revert이며 실제 DB/자료 복구·삭제는 하지 않는다. 전체 FN10/FN11/UI11·Stage/계획 완료로 표시하지 않는다.
