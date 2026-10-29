# FN09 실행 준비본 저장 일회 승인 결정안 r2

상태: DRAFT / NOT_ADOPTED / 구현 GO 없음. 기준 a3982052ad04561ca9f9573494c05d5954fef49d / 기존 codex/av3-stage-b. 작성 Main 어울, 실제 코드 대조 기존 Primary. 이 문서는 기존 승인 확대나 코드·DB 실행 허가가 아니다.

## 필요한 판단

**권장 A:** 준비할 내용 전체를 승인 요청에 불변 보관하고 UI08에서 읽은 뒤 정확한 원명령에 한 번만 쓰는 준비본 저장 계약·source-only 구현을 채택한다. 실제 Agent 실행/권한 부여는 포함하지 않는다.
**B:** 해당 REQUIRE_APPROVAL 경로의 현재 차단을 유지한다. 기존 AUTO 정책의 준비본 저장 의미는 유지하며 미완료로 남긴다.

기존 신산님 승인 WI FN09_RESPONSIBLE_SESSION_ONE_TIME_APPROVAL_IMPLEMENTATION.md SHA73DD668F29B3F20B3B52F6FC892F4AA84513029E803B800785FDC0764077B447는 “prepareExecution/reviewUnderstanding과 실제 CapabilityReport … 이번 역할·예약 승인으로 열지 않는다”를 명시한다. 따라서 이번에 바뀌는 공개 승인 입력/조회·소비·후보 저장 계약은 그 승인으로 구현할 수 없다. 승인된 전체 계획의 다음 상세 계약이며 계획 목표를 축소하거나 추가 Agent 제품을 만드는 안이 아니다.

## 현재 사실

- ProjectExecutionPreparations.save: prepareExecution/targetId=null/expectedVersion=0, approvalRef 비null 또는 baselineRefs 비어있지 않으면412. AUTO 정책은 현재도 저장 가능하다. 모든 준비 저장이 차단된 것은 아니다.
- 현재 HUMAN·client/control·명시 정책·만료·DENY는 바깥 명령 처리/현재 제어 검사와 authorizeMaterial의 전체 경로에서 확인하고 REQUIRE_APPROVAL 준비 경로만 EXECUTION_PREPARATION_APPROVAL_NOT_CONNECTED로 거절한다.
- ProjectApprovals.consumableOperations에는 prepareExecution이 없다. 일반 requestApproval 입력은 {details}뿐이고, 기존 계획/설계적용 연산만 {candidatePayload,details}를 받고 전용 불변 후보를 보관·보호 조회한다.
- ExecutionIntentV1은 projectId,정확7ref(assignment/roleBinding/contextBundle/connection/environment/capability/budgetPolicy),sourceScopes,mode,reason 11필드다. capability/budget ref의 실체는 현재 저장에서 검증하지 않는다. 준비 결과는 필수 미확인7조건과 NOT_AUTHORIZED/executionAuthorized=false/dispatchPerformed=false를 유지한다. WORK에는 UNDERSTANDING_NOT_REVIEWED를 더한다.
- 연결/환경 후보 현재성, 확정임무·최신예약·맥락 exact ref·허용 소스 범위 등 기존 검사는 보존해야 한다. 현재 context 미완성/현재성 차이는 원래 저장된 미확인 조건이며 이를 임의로 검증 완료로 바꾸지 않는다.
- db/migrations/0016_execution_preparation.sql은 AUTO·소비없음 및 approvalRef=null 원명령 hash를 요구한다. server guard만 제거해 연결할 수 없다. 기존0049의 역할/예약·다른연산 보호도 보존해야 한다. 현재 source migration 최대는0054 pending이다.
- WorkspaceResponsibleSessions는 준비 조회/미연결 안내, WorkspaceExecutionPreparation는 실제로 AssignmentSourceSelection이며 준비 입력 화면이 아니다. 유효 capability/budget 참조 selector·producer의 승인된 연결은 확인하지 못했다. 이번 안에 임의 UUID 폼을 만들지 않는다.

읽기 증거: Main3122b2/cb44b5/1251bd/4c5a1e/89dde3·기존 Primary 최종 mapping. 승인 UI 실제 경로는 apps/web/src/features/decisions/ApprovalsPage.tsx이다.

## A안 계약

1. **정확 후보 보관:** prepareExecution에서만 requestApproval 입력을 {candidatePayload,details}로 확장한다. candidatePayload는 원 ExecutionIntent 전체이며 projectId·실제 스키마·payloadHash=H(canonicalJson(payload))·candidateCommandId·현재 HUMAN/client/control·정책·기한에 결박한다. 다른 operation/extra key·다른 project/주체/세대/명령·hash 불일치를 거절한다. 승인 요청 저장과 불변 후보 보관은 한 transaction이다.
2. **사람이 읽는 내용:** 보호 승인 조회에 prepare 전용 검산 후보를 반환한다. 7ref·mode·sourceScopes·reason 전체를 UI08에서 확인한다. 후보 조회/검산 실패는 정상 상세로 대체하지 않는다. 실제 개인정보/Secret 값·Agent 계정/자격증명은 입력으로 추가하지 않는다.
3. **한정 승인 범위:** ActionScope의 operation=prepareExecution,targetRef=null,expectedVersion=0,environmentRef=null,sourceScopes=[],limitsRef=null,baselineRefs=[]는 준비본 저장의 효과를 나타낸다. 실행 임무에 담긴 실제 environmentRef/sourceScopes/budgetPolicyRef는 payload에 있으며 화면에 따로 표시한다. 이를 “환경·요청범위가 없다”거나 “소스 쓰기 권한이 발급됐다”고 표현하지 않는다.
4. **검증/결정/소비 분리:** 기존 명시 policy·DENY·현재 인증/제어/기한을 유지한다. 승인은 자동 결정되지 않고 기존 별도 결정 절차를 따른다. 결박/authorize/consume 시 보관한 후보와 실제 원명령 payload 전체·commandId를 재비교한다. 후보 보관 때 확인한 사항은 승인 시점/저장 시점에 필요한 현재성 검사와 구분하며, 기존 현재성·범위 검사를 줄이지 않는다.
5. **저장 완결:** prepareExecution만 기존 authorize→consume 경로로 연결한다. baselineRefs=[]·기존 임무/예약/맥락/연결·환경/소스 검사를 보존한다. 정확 승인 소비1·준비본1·명령/receipt/audit의 일치를 미적용 forward SQL0055로 보호한다. 기존0016/0049/다른 pending SQL은 수정하지 않는다. 중간 실패 시 소비/준비본/영수증 부분 저장0, 같은 원명령 replay 추가 소비0이다.
6. **실행 상태 불변:** NOT_AUTHORIZED·모든 원래 unresolved·executionAuthorized=false·dispatchPerformed=false를 유지한다. reviewUnderstanding의 차단은 유지한다. 실제 capability 검증·예산 예약·OS writer fence·Agent/Job 실행·세션 생성·사용자 정책 자동 부여는 포함하지 않는다.

## 화면 상세안 — 기존 UI08 안의 읽기 영역

- 기존 요청 상태/원명령ID/결정·만료·승인/거절 버튼을 유지한다.
- ‘실행 준비 내용 저장 승인’ 안에 임무/역할예약/맥락의 고정ref, 연결/환경ref, 능력/예산 선언ref를 각각 ID·version·hash로 구분한다. capability/budget는 ‘참조 실체 미검증’으로 표시한다.
- 모드·이유와 sourceScopes의 sourceRoot/mapping/observation/baseline ref 및 요청 target/path/access 전체를 읽기 전용으로 표시한다. 원문 hash/후보 원명령도 함께 제공한다.
- 준비본 저장 승인 범위와 실행 허가가 별도임을 명시하고, 이미 있는 승인만으로 자동 소비·실행하지 않는다. 다른 프로젝트/로그인/세대·늦은 응답·권한 실패에서는 이전 후보를 숨기며 미확인 원명령은 보존한다.
- UI04 신규 준비 작성·유효 참조 공급자는 이번 A의 구현 완료로 계산하지 않는다. 적절한 실제 producer/계약 전에는 여전히 미구현·미연결이다. 임의값 입력 폼으로 대체하지 않는다.

## 제안 업무 분해·영향

- 후보 입력/불변 보관·보호 조회: approval-input.ts / project-approvals.ts 및 준비 전용 candidate module·미적용 migration0055. 공개 승인 DTO가 prepare 후보를 포함하게 되므로 계약 채택이 필요하다.
- 정확 승인 소비/저장: project-command.ts / project-execution-preparations.ts의 prepare 한정 분기·후보 비교·서버/SQL 원자 완결. reviewUnderstanding·다른연산은 불변.
- UI08: ApprovalsPage.tsx와 준비 후보 전용 client decoder의 검산·원문 표시. 실제 UI04 입력 생성·실행은 제외한다.
- 합성 검증: 기존 실제 class/ApiClient·현재성/권한 검사를 통과하는 positive·negative와 새 SQL의 정적/구조 검수. 실제 PG에서 DDL/COMMIT/RLS/경합 PASS로 승격하지 않는다.
- 채택 후 Main이 실제 시작 HEAD·정확 파일 allowlist·위임 WI를 고정한다. 새 branch/worktree/세션/자동화를 만들지 않고 기존 단일 Primary만 구현한다. Main 검수·독립 C/I·최소회귀·private 게시까지 수행하되 Stage실게이트전 main병합0.

## 필수 검증·금지·복구

AUTO 기존 의미/다른연산 보존, 후보 보관→별도 결정→동일 원명령 결박→소비/준비 재조회, replay 추가 소비/저장0, 7ref의 문법·원 payload 변조·기존 실체 검증 ref의 관계/현재성, hash/mode/sourceScopes/주체/client/control/command·만료/회수·후보 변경 거절, 부분 실패 rollback·UI 원문/늦은응답/미확인 명령 보존을 검증한다. capability/budget ref의 존재·유효성을 새로 검증했다고 주장하지 않는다. 원래 미검증 ref를 검증된 것으로 만들거나 missingConditions를 줄이지 않는다.

A채택도 실제 DB 적용·GRANT 실행/사용자 정책·계정/키·certificate·서비스·Agent·OS Job·비용·Oracle/운영 변경을 승인하지 않는다. 합성 QA는 실제 실행 전에 이름/owner/수명/정리를 등록한다. 미채택 HUMAN R2(65468084)와 기존 질문은 그대로이며 이번 결정과 합쳐 채택하지 않는다. 물리 능력/이해검토/dispatch를 PASS로 보고하지 않는다.

가역성: 코드/미적용 SQL은 한정 Git revert로 복구 가능하다. 실제 schema/데이터를 적용하지 않아 runtime rollback은 발생하지 않는다. 잔여 위험: 실제DB/동시성/능력·예산·OS 공급자·UI04 연결과 Agent 전체 여정은 계속 미검증/미완료다. A안의 부분완료를 전체 FN09 또는 작업계획서 완료로 보고하지 않는다.

## r2 표현 정확화
- C25BFCE7 사전양측C0/I0의보완의견에따라client/control은상위명령처리와현재제어·authorizeMaterial전체경로의검사임을명시했고7ref음성은문법/변조·기존실체검증대상관계에한정했다. 능력/예산실체검증발명0·A/B계약/제외·codeGO0은불변이다.
