# FN10/FN11/UI05 단계 시작 대기요청 원명령 일회 승인 연결

2026-10-27 · Main 어울 · 기준 branch `codex/av3-stage-b` / `be7802497a55f52ecc2e4f3ef46f42801a1121e5`.

## 목적·계획·한계

FUNCTION_WORK의 FN10/FN11, 기존 INTERFACES startStage와 UI05를 소비한다. 기존 CASE_BY_CASE/AUTO 시작 범위와 현재 방법론/예산 검사를 유지하며, 명확 REQUIRE_APPROVAL에서 기존 startStage 요청을 일회 승인 요청→UI08 별도 결정→원화면 명시 결박→같은 원명령 WAITING 저장·재조회로 연결한다. AUTO의 기존 대기 저장은 재구현하지 않는다.

이는 대기요청 보관만이다. assignmentRef=null, slotReserved/writerReservationPerformed/executionAuthorized/dispatchPerformed=false와 기존 readinessIssues를 유지한다. cancelQueuedRequest의 승인 차단·기존 AUTO 취소, 실제 scheduler/dispatch·Agent·native·슬롯/writer예약·한도 정책/알림 쓰기는 이번 구현에서 변경하지 않는다. 새 operation·공개 API/DTO·권한 예외·영구 후보 저장·표/role/GRANT·비용/의존성 추가0. 실제 DB/SQL 적용·정책/사용자 권한 부여·Secret/TLS/서비스·Agent/native 실행은 제외한다. 기존 승인 계획의 구현·시험 범위이며 별도 미채택 계약은 소비하지 않는다.

## 단일 writer 허용18경로

1. `apps/server/modules/access/project-command.ts`
2. `apps/server/modules/approvals/project-approvals.ts`
3. `apps/server/modules/approvals/approval-input.ts`
4. `apps/server/modules/scheduling/stage-queue.ts`
5. `apps/web/src/features/session-detail/stage-start-api.ts`
6. `apps/web/src/features/session-detail/StageStartPanel.tsx`
7. 신규 `apps/web/src/features/session-detail/stage-start-approval.ts`
8. 신규 `apps/web/src/features/session-detail/StageStartApprovalEditor.tsx`
9. `apps/web/src/features/decisions/api.ts`
10. `apps/web/src/features/decisions/ApprovalsPage.tsx`
11. `apps/web/src/App.tsx` — 기존 stageStartBuffers를 승인 화면의 읽기 전용 원화면 복귀 근거로 전달하는 prop만. 다른 상태/화면 재작성0.
12. 신규 `db/migrations/0047_stage_start_one_time_approval.sql.pending` — 생성 전 번호 부재 재확인.
13. 신규 `tests/unit/FN10/stage-start-approval-input.test.ts`
14. 신규 `tests/unit/FN10/stage-start-approval-consumption.test.ts`
15. 신규 `tests/unit/UI05/stage-start-approval-api.test.ts`
16. 신규 `tests/browser/UI05/stage-start-one-time-approval.spec.ts`
17. `tests/unit/FN10/stage-queue.test.ts` — 기존 미연결 guard 기대를 실제 malformed 승인 참조/정책 거절로 좁혀 갱신한다. 역사 조회 강화로 실제 SELECT에 추가되는 command/receipt/audit 원열은 같은 fakeDB 반환에 최소 반영한다. 기존 AUTO·취소·replay·권한·변조 기대와 부작용0은 유지하며 검사 생략/조건부 완화는 하지 않는다.
18. `tests/unit/UI05/stage-start-api.test.ts` — 같은 원명령의 명시 승인 전이·검증에 직접 영향받는 기존 기대만 갱신.

Main 제품 수정0·동시 code writer1명. 보호 untracked8, 특히 stage-queue-assignment.test.ts.pending는 수정/실행하지 않는다. 기존0036/0046과 다른 완료 소스는 보존한다. 추가 경로가 필요하면 실제 호출선·최소 diff를 먼저 제시한다.

## 원명령·현재 권한·원자 저장·역사 조회

1. 원 payload의 stageRef/methodologyApplicationRef/mode/startNodeRef/endBoundaryRef/baselineRefs/budgetRef/reason 전체를 보존한다. top-level 봉투는 targetId=null/expectedVersion=0/baselineRefs=[]다. 기존 ActionScope의 operation=startStage/targetRef=null/expectedVersion=0/baselineRefs=[]/environmentRef=null/sourceScopes=[]/limitsRef=null, 원 candidateCommandId·전체 raw payload hash·HUMAN user/client/control·현재 policy를 결박한다. payload의 budgetRef나 baselineRefs를 scope의 다른 필드로 이동하지 않는다.
2. 현재 projectMember/OWNER/client/control·명시 정책·세션 기한·현재 방법론 적용/graph·노드/모드·끝 경계 도달성·현재 예산을 유지한다. #authorize는 startStage에만 정확 승인 참조를 허용하며 cancelQueuedRequest null/AUTO 경계는 보존한다. 공통 exact replay는 신규 저장과 구분하고, 현재 제어 회수 후 replay로 자료를 노출하지 않는다.
3. persistProjectReceipt의 일회 소비·queue WAITING/version1·stage_runs/input_json·queue_requests snapshot/hash·receipt/audit를 같은 기존 transaction에서 결합한다. 기존 stage_runs.input_json/원 snapshot이 payload를 보존하므로 새 영구 후보를 만들지 않는다. 소비 전 원 payload가 필요하면 같은 transaction-local GUC를 한정 사용하고, SQL complete는 최종 불변 자료와 재대조한다. 누락/손상/mixed operation은 거절한다.
4. #view 및 실제 read 호출은 원 command/target/receipt/audit·정확 소비/당시 정책·scope를 재구성한다. 필요한 비동기 검사를 모든 호출에 await한다. 후속 합법 정책/control 변화로 과거 WAITING 이력을 위조로 취급하지 않되 현재 회원·조회권한은 유지한다. 기존 CANCELLED 이력은 기존 의미로 읽고 start 승인으로 취소를 허용하지 않는다.
5. 신규0047은 기존0036 AUTO/null 봉투를 startStage에 한정 확장하고0046 공통 승인 wrapper chain을 보존한다. 기본 source/graph/budget/manifest·false flags·감사검사는 유지한다. command 또는 scope 한쪽만 startStage인 mixed, 승인 흔적 일부/모두NULL, 자료 없는 APPLIED, receipt/audit 주체/source 불일치, UPDATE/DELETE 흔적 삭제를 fail-closed로 완결한다. AUTO 정상 INSERT/다른 연산/취소를 회귀 확인한다. 실제 compile/DML/COMMIT/RLS/경합은 NOT_RUN으로 구분한다.

## 화면·상태 보존

1. 기존 StageStartStorage는 App에 이미 있다. 새 후보 저장소를 만들지 않고 같은 buffer에 승인 요청/원명령 결박·명시 종료 이력만 추가한다. 복귀에 필요한 원 draft fullref는 confirmed.snapshot.draftRef의 로컬 부가정보로 보존·validate한다. 공개 payload/DTO에 넣지 않는다.
2. 명확한 APPROVAL_REQUIRED/412 뒤에만 요청을 준비한다. 원명령 UNKNOWN/응답 유실 뒤412는 새 승인으로 우회하지 않는다. 요청·결정·보호 GET·결박만으로 WAITING 저장0. 별도 명시 등록에서 같은 commandId/payload에 approvalRef만 한 번 전이한다.
3. UI08은 저장된 정확 candidateCommandId·현재 owner/client/project와 일치하는 기존 App buffer의 원 임무 상세로 돌아가는 링크를 제공한다. 원명령 부재/다른 계정·기기는 임의 복구하지 않고 기존 일반 탐색으로 안내한다. 링크는 권한 부여가 아니다.
4. API/session/transport/프로젝트·임무/입력 ABA·이탈·늦은 응답을 차단한다. pending→uncertain→성공의 정상 연속 갱신은 binding/전체 command·예상 이전 단계로 대조하고 단순 객체 identity로 버리지 않는다. 원입력·미확인 명령·현재 선택을 보존한다.
5. 무소비·비UNKNOWN인 거절/수정/만료·같은 현재 제어의 정책 개정 회수는 보호 GET 재확인 후 사용자 명시 종료로 입력에 복귀한다. 원명령/요청/종결 이력은 보존하고 자동 POST0. 로컬 종료와 실행 정책 검사를 혼합해 영구 잠금을 만들지 않는다. 현재 제어/주체가 다르거나 승인 소비/불확실성이 있으면 해제하지 않는다.
6. 성공 영수증·정확 ref를 보존하고 기존 queue 조회에서 동일 WAITING 자료를 명시 재조회한다. GET 실패는 새 POST로 우회하지 않는다. 승인 필요·거절·미확인·현재성 문제를 READY/RUNNING으로 표시하지 않는다.

## TDD·검수·자원

- 우선 신규 소비 시험만 작성하고 제품/SQL 불변의 실제 STAGE_QUEUE_APPROVAL_NOT_CONNECTED guard를 기대 APPROVAL_REQUIRED/412로 대조하는 RED를 Main이 확인한다. 모듈 부재는 기능 RED로 계산하지 않는다. 이후 단일 writer가 허용18 구현·pure unit/type·메모리 build를 수행한다.
- 정상 CASE/AUTO의 요청→별도 승인→명시 결박→같은 원명령 WAITING/version1→기존 queue 보호 GET을 확인한다. 승인 단계 저장0, command/payload/hash·원ref/sequence·false flags·독립 취소 경계를 대조한다.
- 중요 음성: 현재 회원/주체/client/control/policy·기한·methodology/graph/budget 변경, 다른 command/payload/scope/fullref, 소비 재사용, UNKNOWN 후412, 요청/원명령 응답 유실·후속GET 실패, 이탈/ABA·늦은 응답. 기존 stage-queue/routes·UI05 start/queue·FN11 및 이전 승인 wrapper의 직접 영향만 검사한다. 기존 테스트 삭제/일반 assert.rejects로 기준 완화0·불변 전수 반복0.
- Main만 실제 App/Edge를 실행한다. fixture는 실제 POST/보호 GET DTO를 구분하고 actual role/name을 먼저 대조한다. 제품 번들+합성 API 결과를 실제 DB/served로 승격하지 않는다.
- QA 사전등록: 신규 `D:/tmp/anvil-v3-stage-b/ui05-stage-start-approval-20261027-01`의 dist/results/temp/config.mjs만, owner SINSAN\cyhuh·생성별 최대30분·기존 browser/listener/PG0. env `ANVIL_UI05_STAGE_START_APPROVAL_DIST`는 exact dist만 허용한다. 생성 직전 부재/parent owner/realpath/nonlink를 확인하고, write:false bundle·headless Edge 합성만 실행한다. 실패·종료 모두 exact 소유 항목/관련 process0·link/realpath 확인 뒤 회수하고 독립 잔여0을 확인한다. writer 자원 생성0.
- 독립 C/I 해소·Main fresh 검증 뒤 소유 파일만 기존 branch checkpoint/private 게시한다. 소스 rollback은 후속 revert이며 실제 DB/자료 복원·삭제는 실행하지 않는다. 전체 FN10/FN11/UI05·Stage/계획 완료로 표시하지 않는다.
