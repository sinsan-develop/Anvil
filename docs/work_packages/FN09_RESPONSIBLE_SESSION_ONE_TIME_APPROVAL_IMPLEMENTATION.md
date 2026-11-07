# FN09/FN11/UI04 책임 역할 정의·Anvil 세션 예약의 일회 승인 연결

2026-10-27 · Main 어울 · 기준 `codex/av3-stage-b` / `658951cc5f3e76e2968cf7d77b9113f1874cba01`.

## 목적·계획·제외

FUNCTION_WORK FN09/FN11과 기존 defineProjectRole/bindResponsibleSession·UI04를 소비한다. 총괄(COORDINATOR) 정의→단계책임(STAGE_OWNER) 정의→확정 임무의 Anvil 책임 세션 예약·상태 조회는 AUTO로 저장되지만 REQUIRE_APPROVAL은 기존 미연결 guard로 차단된다. 같은 화면·buffer·0016 원장/복구 경계의 한 업무로 연결하되 **각 역할 정의·예약·후속 결박마다 별도 원명령과 승인**이다.

RESERVED/CANDIDATE_ONLY·externalSessionHandleRef=null·executionAuthorized/dispatchPerformed=false·기존 미확인 사유를 유지한다. 실제 외부 Agent 세션 생성·handle/native/도구 호출·실행 허가·슬롯 예약은 아니다. prepareExecution/reviewUnderstanding과 실제 CapabilityReport·응답/실행 귀속, 미채택 HUMAN R2/providerhandle은 이번 역할·예약 승인으로 열지 않는다. 실제 DB/SQL 적용·사용자 정책/권한 부여·GRANT·Secret/TLS/서비스·비용/Agent 실행0. 새 operation/API/공개DTO·역할종류·후보 영구 저장·표/role·의존성 추가0이다.

## 단일 writer 허용18경로

1. `apps/server/modules/access/project-command.ts`
2. `apps/server/modules/approvals/project-approvals.ts`
3. `apps/server/modules/approvals/approval-input.ts`
4. `apps/server/modules/assignments/responsible-sessions.ts`
5. `apps/web/src/features/workspace/responsible-session-api.ts`
6. `apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx`
7. 신규 `apps/web/src/features/workspace/responsible-session-approval.ts`
8. 신규 `apps/web/src/features/workspace/ResponsibleSessionApprovalEditor.tsx`
9. `apps/web/src/features/decisions/api.ts`
10. `apps/web/src/features/decisions/ApprovalsPage.tsx`
11. `apps/web/src/App.tsx` — 기존 assignmentBuffers[*].responsibleSession의 원명령 복귀 근거를 읽기 prop으로 전달하는 부분만. 새 저장소/다른 화면 재작성0.
12. 신규 `db/migrations/0049_responsible_session_one_time_approval.sql.pending` — 생성 전 번호 부재 재확인.
13. 신규 `tests/unit/FN09/responsible-session-approval-input.test.ts`
14. 신규 `tests/unit/FN09/responsible-session-approval-consumption.test.ts`
15. 신규 `tests/unit/UI04/responsible-session-approval-api.test.ts`
16. 신규 `tests/browser/UI04/responsible-session-one-time-approval.spec.ts`
17. `tests/unit/FN09/responsible-sessions.test.ts` — 직접 영향 guard 기대·실제 SELECT의 command/receipt/audit 원열 fixture만. 기존 AUTO·중복역할/현재성/후속세션·실패/쓰기0 기대 보존.
18. `tests/unit/FN09/responsible-session-web.test.ts` — 승인 전이와 원명령 검증에 직접 영향받는 기존 기대만 정확 갱신.

Main 제품 수정0·동시 writer1명. WorkspaceAssignments의 responsibleChange는 이미 함수형 갱신을 전달하므로 원칙적으로 수정 없이 소비한다. 기존 provider claim/이해조회·준비/실행·다른 dirty/보호 untracked8·0016/0048은 보존한다. 추가 경로가 필요하면 실제 직접 영향·최소 diff를 Main에 먼저 제시한다.

## 정확 대상·권한·저장

1. define payload `{kind,stageRef,parentRoleRef,reason}`의 COORDINATOR/STAGE_OWNER 각각 target=null/expectedVersion0이다. 최초 bind의 `{assignmentRef,roleRef,connectionRef,existingSessionBindingRef:null,reason}`도 null/0, 같은 Anvil 세션의 후속 결박은 existingSessionBindingRef **전체 ref**와 expectedVersion을 결박한다. ActionScope는 기존 봉투/원 payload hash·candidateCommandId·HUMAN user/client/control/current permission policy를 소비하며 payload의 임무/단계/연결 ref를 다른 scope 필드로 이동하지 않는다. top baselineRefs=[]·environmentRef=null/sourceScopes=[]/limitsRef=null을 보존한다.
2. 현재 회원/OWNER/client/control·명시 정책·기한→exact replay→신규 현재 방법론 단계/부모 역할·확정 임무/현재 초안·역할/연결 후보 exact ref와 head/만료·같은 단계/도구·자식 DRAFT_ONLY를 유지한다. 기존 PROJECT_ROLE_ALREADY_DEFINED·SESSION_REPLACEMENT_REQUIRED 의미를 바꾸지 않는다. 역할 정의 승인을 예약에 상속하지 않고 다른 도구 세션으로 교체하는 계약을 추가하지 않는다.
3. 역할 정의는 역할 원장1건, 최초 예약은 Anvil session1건+binding1건, 후속 결박은 **같은 sessionRef**에 binding 새 버전만 저장하는 기존 의미다. command/정확 소비/receipt/audit와 같은 transaction에서 원자 저장한다. exact replay가 추가 역할/session/binding을 만들지 않게 한다.
4. #roleView/#bindingView·readRole/readBinding/readState 및 기존 session 원장 검증을 당시 command/payload/hash·승인 소비·영수증/감사 원열에 연결한다. 필요한 async를 모든 호출에서 await한다. 현재 member와 과거 권위를 분리하고 합법 policy/control 변화만으로 과거 원장을 위조 취급하지 않는다. 원 receipt commandId/operationId·주체/client/control/policy/target/source/outcome/digest·카디널리티와 누락/중복을 검사한다. INNER JOIN/DISTINCT로 손상 행을 숨기지 않는다.
5. 신규0049는 현재0048까지 target/소비 wrapper chain을 보존하며 두 연산만 확장한다. 기존0016의 역할·session·binding·현재성·미확인/false 검사를 보존하고 null승인으로 raw request_hash를 구성하던 최초 session guard도 정확 승인에 연결한다. 새 영구 후보 표 없이 기존 snapshot/명령과 한정 transaction-local payload를 대조한다. 최종 command/정확 소비/자료/receipt/audit를 공통 완결하며 승인/AUTO 모두 actor/client/target/policy·서버와 같은 scope digest를 대조한다. mixed operation·allNULL/receipt-only·자료없는APPLIED·부분 session/binding·UPDATE/DELETE 흔적 삭제는 거절한다. 정상 AUTO/기존 다른 연산·prepareExecution 차단은 유지한다. 실제 compile/DML/COMMIT/RLS/경합은 NOT_RUN으로 구분한다.

## 화면·상태

- 기존 AUTO 버튼의 명시 저장 의미는 유지한다. REQUIRE에서는 역할/예약 클릭으로 기존 원명령이 실제 서버 명확 APPROVAL_REQUIRED/412를 받은 뒤에만 요청을 준비한다. 로컬 오류를 서버 거절로 위장하지 않는다. 원 pending/원입력/connectionRef·현재 선택과 UNKNOWN을 보존하며 UNKNOWN 후412는 새 승인으로 우회하지 않는다.
- UI08 별도 결정→같은 owner/client/project·assignmentRef와 원 candidateCommandId의 기존 buffer가 있을 때 workspace 복귀→필요한 기존 확정 원본 명시 재조회→명시 결박→같은 원명령의 별도 저장/예약→정확 상태 재조회다. 임무 confirmed ref를 draft URL에 대입하거나 사라진 원후보를 hash만으로 복원하지 않는다. 승인/결박만으로 자료 저장0·실Agent 호출0이다.
- pending→uncertain→성공은 안정 원명령 경계와 각 요청의 정확 before 상태로 대조한다. nested approval 전체의 옛 closure 비교로 정상 연속 전이를 버리지 않는다. 저장용 전체 CAS·다른 request/API/session/transport/주체/제어/임무·ABA/이탈/late 응답 보호는 유지한다. POST 전에 App의 원명령 uncertain을 저장하고, 이전 UNKNOWN을 늦은 확정 거절로 해제하지 않는다.
- 성공 후 GET 실패는 receipt·정확 저장 ref/상태를 보존하고 사용자 수동 재조회로 복구한다. role/binding 상태의 신규 저장과 단순 조회를 구분한다. 원 상태 조회를 실제 세션 가동/이해/준비 허가로 표시하지 않는다.
- 거절/수정/만료·같은 현재 제어의 policy 개정 회수는 보호 GET을 재확인한 명시 로컬 종료로 입력에 복귀한다. 원명령/요청/종결 이력을 보존하고 pending=null 뒤에도 이력 안내를 표시한다. 현재 실행용 정책과 로컬 종료를 혼합해 영구 잠금을 만들지 않으며, 소비/UNKNOWN/다른 주체·제어는 해제하지 않는다.

## TDD·검수·자원

- 먼저 신규소비시험1파일만 작성해 제품/SQL 불변의 실제 EXECUTION_PREPARATION_APPROVAL_NOT_CONNECTED와 기대 APPROVAL_REQUIRED/412 기능 RED를 Main이 확인한다. 그 뒤 단일 writer가 허용18을 구현한다. writer는 pure/type·write:false 메모리 build만, 실제 파일/브라우저QA는 Main만 수행한다.
- 정상 총괄→단계 역할→첫 예약 각각 별도 승인·원명령/조회, 같은 세션 후속 결박과 false flags·handle null/같은sessionRef를 확인한다. AUTO/null도 유지한다. 중요한 실패는 중복역할/현재 단계·확정 임무/연결 head·만료/다른 도구/fullref/hash/연산·소비 재사용/원명령·요청 유실/UNKNOWN 후412/GET 실패/부분저장 rollback·현재 제어/이탈·late·종결 복귀다. 기존 책임세션·FN11과 공유 승인 guard의 직접 영향만 회귀하고 기준/timeout·기대 완화0·불변 전수 반복0.
- actual App fixture는 실제 저장 가능한 정책(대상 REQUIRE/request·decide 별도AUTO)·정확 POST/보호GET·실제role/name/전체status 문구와 왕복 후 사용자 확인을 대조한다. 비동기 재전송은 실제 POST 건수 도착을 관측한 뒤 동일 전체 명령·저장1회를 검사하며 임의sleep을 넣지 않는다. 실제DB/Agent/served로 합성 결과를 승격하지 않는다.
- 신규QA `D:/tmp/anvil-v3-stage-b/ui04-responsible-session-approval-20261027-01`의 dist/results/temp/config.mjs만, env `ANVIL_UI04_RESPONSIBLE_SESSION_APPROVAL_DIST`=exact dist. owner SINSAN\cyhuh·각 생성30분·기존browser/listener/PG0. 생성 전 부재/부모owner/realpath/nonlink·write:false bundle/합성AppEdge, 실패·종료 후 정확 소유 항목/link/path/관련process0 대조→회수·독립 잔류0. writer 자원 생성0.
- 독립 C/I 해소·Main fresh 검증 후 소유 파일만 기존 branch checkpoint/private 게시한다. rollback은 소스 후속 revert이며 실제 자료 복원·삭제는 실행하지 않는다. 전체 FN09/FN11/UI04·Stage/계획 완료로 표시하지 않는다.
