# UI04 기존 참조의 명시 선택 → 실행 의도 준비본·별도 승인·저장 연결

## 1. 목적·권한·기준
- 승인 WORK_PLAN UI04/FN09/FN11의 기존 구현을 연결한다. 사용자 작업은 확정 임무의 실제 보관된 참조를 선택·재조회하고 실행 **의도 준비본**을 저장하는 것이다. 실제 Agent 실행이 아니다.
- 직접 채택 FN09 prepare A: docs/approvals/FN09_PREPARE_EXECUTION_SOURCE_DIRECT_APPROVAL_20261030.json SHAB50A77099F2EBAEE634FF7B6A10B3E766CCD5F5F92FC3A801C907194186455FE, 결정안4B8455AEECB0A200E97028573A08027F1F2954E546C6D7779FA89EB32B9CB49E. HUMAN r2 승인7B22897F/계약65468084·실제 구현f5fdaa90·UI05읽기0f2426da를 소비한다.
- 앞선 FN09 A WI의 UI04 제외는 당시 한정13경로 업무의 범위였으며 이번 작업이 그 승인을 새 계약으로 확대하는 것이 아니다. 현재 승인된 WORK_PLAN의 UI04 내부 소비를 Main이 별도 업무로 고정한다. 새 공개 API/저장·승인/권한·SQL 계약을 만들지 않는다. 예전 HUMAN 미채택은 이력이고 현재 정확r2만 채택됐다.
- 기준 HEAD0f2426dadd11deac1eb774834392b6df9dc2f8c6/기존 codex/av3-stage-b. Main WORK_STATUS dirty·보호untracked8 보존. 기존 Primary 단일 writer/기존 Reviewer 읽기검수/Main 관리·문서·검수·통합. 새세션/branch/자동화0·Main활성writer제품수정0·Primary문서/commit/push0.

## 2. 정확 allowlist12
기존5/Main325c99:
|경로|시작 SHA256|
|---|---|
|apps/web/src/App.tsx|E8BE957248CFD557238C6CD3E824E38233278F4CFB4FBADB717EE50683BEB1F2|
|apps/web/src/features/workspace/WorkspacePage.tsx|CB9B0C94830829C033898BCC2F8152C90EA5E06502E88E9C087DD9EAE633E0E1|
|apps/web/src/features/workspace/WorkspaceAssignments.tsx|03F3A2A0E0B4094DA156E99EF394E75221B755FB5D52F2617C74CE74826B884C|
|apps/web/src/features/workspace/AssignmentContentDecision.tsx|923C35264A0A138F187927F03C07A034C27BD1BBB2223273AC9E26393C8AED5A|
|apps/web/src/features/workspace/assignment-api.ts|EAA2E594E9BC83FEF308E7DC17C28A06EE98CDDAFD704F6EF5CBE5097ED32AB4|
신규7/Main1386ad 부재확인:
- apps/web/src/features/workspace/ExecutionPreparationEditor.tsx
- apps/web/src/features/workspace/execution-preparation-api.ts
- apps/web/src/features/workspace/execution-preparation-approval.ts
- tests/unit/UI04/execution-preparation-api.test.ts
- tests/unit/UI04/execution-preparation-approval.test.ts
- tests/browser/UI04/execution-preparation-editor-dom.test.ts
- tests/browser/UI04/execution-preparation-editor-dom-harness.tsx

기존 server/route/SQL·결정 UI08·generic prepareApprovalRequest·조회/보호helper·실행Authority/connector/native 변경0. 추가필수경로는 소비선/이유를Main에보고후허용. assignment-api는 App소유 buffer의 선택/입력/원명령/승인/불명결과를 위한 선택적 additive 상태만 추가하고 기존 미제공/빈값·후속저장/승인 의미는 보존한다.

## 3. 기능 단위·참조 공급
1. 현재 확정임무는 기존 readConfirmedAssignment/ConfirmedAssignmentView다. 현재 제어·정책·재인증은 기존 source 계약을 그대로 사용한다. 준비 원 payload는 기존 ExecutionIntent 11키/7ref·sourceScopes·2mode·reason이고 기존 A/null target/expected0·불변hash/원command 결박을 바꾸지 않는다.
2. roleBinding/connection은 기존 readResponsibleSessionState의 실제 RESERVED bindings를 표시하고 사용자가 명시 선택한다. 선택 binding을 기존 보호 GET로 재검산한다. 실제 binding에는 contextRef가 없으므로 binding.assignmentRef와 별도 선택 context.manifest.assignmentRef를 각각 현재 confirmed.ref와 exact 대조한다. 연결은 binding.connectionRef와 HUMAN보고의 connectionRef를 exact 대조하고 존재하지 않는 binding↔context 직접참조를 만들지 않는다. 첫 항목 자동선택·가짜 UUID·예약 생성0.
3. contextBundle은 기존 listContextPreparations의 실제 목록→명시선택→readContextPreparation을 사용한다. 현재 확정assignment fullref와 관계·원형/hash를 대조한다. missing/currentCheck는 그대로 표시하고 맥락이 완전하다고 승격하지 않는다.
4. environment/budget은 확정임무 definition.environmentRef/budgetRef를 기존 readCandidate/readLimitPolicy로 고정 검산한다. environment kind는 ENVIRONMENT_CANDIDATE이며 binding의 연결은 CONNECTION_CANDIDATE다. limit의 APPLIED/기한과 과거고정본이라는 의미를 표시하고 현재head/가용량/비용집행을 증명한다고 하지 않는다.
5. HUMAN은 App.capabilityReportBuffers의 현재 user/client/project에 귀속된 **저장receipt 뒤 정확GET까지 검산된 result ref**만 App→WorkspacePage→WorkspaceAssignments→AssignmentContentDecision→신규editor에 읽기 공급한다. 없으면 UI11 실제 보관 동선으로 안내한다. 새목록/임의ID폼/과거보고 자동추정/공통전역구조개편0. 해당ref도 명시선택 뒤 readCapabilityReport로 재검산하고 연결/환경 fullref를 선택binding/확정환경과 exact 비교한다. 서버 UNVERIFIED/CANDIDATE_ONLY·currentness issues를 보존하며 ‘HUMAN검증완료’로 실행권위를 만들지 않는다.
6. sourceScopes는 확정임무 허가범위의 exact 원값 또는 사용자 명시 부분집합만 허용한다. 저장/승인 전에 기존 A 문법/부분집합을 검산하고 확장·빈가짜scope0. mode는 기존 CONTEXT_REVIEW/WORK를 명시 선택하고 reason을 입력한다. WORK의 UNDERSTANDING_NOT_REVIEWED 등 기존7부족조건/NOT_AUTHORIZED/executionAuthorized=false/dispatchPerformed=false는 유지한다.
7. AUTO는 기존 prepareExecution POST로만 명시 저장한다. REQUIRE_APPROVAL은 기존 sendApprovalCommand/readApproval/validApprovalDetails와 validateExecutionPreparationCandidate를 재사용하는 **prepare전용 얇은 request/bind wrapper**로 연결한다. generic prepareApprovalRequest의 두후보 연산 범위를 느슨하게 하지 않는다. 원 intent 전체를 candidatePayload로, 기존 A details/actionScope nulltarget·expected0·빈scope/refs와 원payload hash/원commandId로 정확 결박한다. 필요 이유·기한·위험 등 기존 승인 필수필드를 그대로 충족한다. UI08에서 별도결정 뒤 원requestRef/decisionRef/기한·현재subject/client/control·후보hash를 재검산하고 사용자 명시 재개만 허용한다. 클릭을결정/승인소비로대체0.
8. 첫 await 이전 입력/confirmed/선택refs/원command/session을 깊은복사·고정한다. 현재owner/client/project/assignment/buffer.bindingId/epoch를 실제JSON/crypto 뒤·POST직전에 검사한다. App소유 executionPreparation buffer에 draft·pending 원command/hash·request/decision의 정확refs·uncertain/결과ref를 보존하며 화면이동/다른작성기능과충돌하지 않는다. 원입력/approval가불일치하면전송금지. 새명령 자동생성·불명자동재송신0.
9. 네트워크/불명결과는 원명령/입력/승인을 보존하고 명시 동일명령 확인만 허용한다. 명확거절은 거절원command/이유를 남긴 뒤 사용자 명시 수정·새준비를 구분한다. 실제권한부여/정책쓰기·문서확정·Agent실행0. 저장후 기존 준비 고정GET로 ref/hash/assignment/intent·NOT_AUTHORIZED/false를 재검산해야 ‘준비본 보관’으로 표시하며 읽기실패는 결과미확인으로 남긴다.

## 4. UI04 화면 단위 상세
- 확정 임무 영역에 **실행 의도 준비본** 섹션을 두고 ‘보관해도 실행 허가가 아닙니다’ 상태를 표시한다. 실제참조생산자·원형조회로검산된 항목만 사용한다. UI04의 옛 ‘입력공급자 미연결’ 문구를 이 실제 form으로 교체하되 미가용입력은 구체적으로 남긴다.
- 1행: 임무 id/version/hash·현재구성·허용source범위. 2행: 예약binding 목록/선택 및 선택context목록/고정원문조회. 빈목록/로딩/권한·원형실패/다른임무/현재성부족을 구분한다.
- 3행: 확정환경·연결·예산 exactref/hash/기한을 재검산 표시하고, UI11에서 실제 보관된 HUMAN보고 후보의 ‘이 보고 사용’ 명시 선택·보호GET 원주장/UNVERIFIED/issue와 pair대조 결과를 보여준다. 없으면 ‘먼저 UI11에서 이 연결·환경에 대한 사람보고를 보관하세요’와 기존 connections 화면 이동을 제공한다. 가짜data/자동선택0.
- 4행: source허용범위 선택(기본명시확인 전 저장불가)·mode·reason. 요약에는 정확7ref/mode/범위/원payload hash와 기한/미확인·허가불가를 표시한다. 설명은 기존i/접힘표준을 유지한다.
- 저장영역: ‘의도 준비·입력 확인’→명시 ‘준비본 보관’ 또는 ‘준비본 보관 승인 요청’. 승인요청 고정원형/해시·요청ID·UI08별도결정 안내·명시결정재조회/재개를 구분한다. 이미있던 다른승인·미확인명령buffer는덮지않는다.
- 결과영역: 정확준비ref·intent 원문/기준버전·7부족조건과 NOT_AUTHORIZED/false, 명시 고정 재조회. ‘실행/Agent호출/시작’버튼·자동준비·자동승인결정0. 원형미확인/기한/권한/거절/불명/회수·원문불일치는 다른상태로 표시한다.
- owner/project/fullassignment/실client객체/clientId·같은인스턴스ABA·원선택변경·닫기·lateJSON/native digest 후 이전원문/오류/POST가새문맥에나타나지않는다. 원draft/pending은기존귀속buffer에보존하고다른소유자에게숨긴다. key강제remount를실문맥시험대신쓰지않는다.

## 5. TDD·독립/Main 검수
- 최초 실제UI 부재 또는 정상 기존서버계약의 클라이언트 연결 부재를 RED로 실행한다. 신규모듈부재는 동작조건0으로 구분한다. 정합 fixture는 실제producer 응답/ref/hash·연결·context/assignment관계를 구성하고 없는provider를 fake UUID로 정상처럼 채우지 않는다.
- unit/DOM으로 AUTO 원명령 저장·원형readback, REQUIRE_APPROVAL 요청→별도결정→동일원명령재개·정확일회ref전파, 무정책/DENY/만료·후보/임무/context/binding/pair/범위불일치·원형/hash오류·다른user/client/control·후속승인재사용차단·읽기실패불명/같은명령확인·다른buffer보존을 확인한다. 기존fixture의실제서버정책/승인검사를통과했다고표현하지않는다.
- 실제editor+필요부모App buffer 전달의 실Edge DOM·메모리 Response API에서 producer명시선택/명령POST0초기·전체payload/hash/원문검산·별도결정/재개·실client/ABA/lateJSON/nativecrypto 후 POST0·전환후조작회복·다른pending보존을 확인한다. 실제 DB/HTTP/전체App·실Agent 검증과 구분한다.
- 기존직접 영향 assignment/context/responsible/prepare승인 unit/DOM은 실제경로를 inventory→Leaf로 확정해 필요한 범위만 선택한다. 표준 npm run build(typecheck포함)/git diff --check. 같은불변기능 전수반복/기대값완화·gitleaks/hook우회0. 비밀음성은명백한더미로쓴다.
- Primary exact12hash/diff/명령·exit·RED/GREEN/오류·미검증·QA회수 제출→writer해제→독립C/I→같은담당한정보완→Mainfresh검증/별도잔여0→기존branch checkpoint/private. 필수실제Stagegate미달 PR/main병합0.

## 6. QA 사전등록·실행 제외
- 신규 literal `D:/tmp/anvil-v3-stage-b/ui04-execution-preparation-20261030-01`, Main1386ad 부재확인. 담당Primary/Main 순차·매실행새빈경로/최대30분, 메모리bundle/실Edge/메모리API·listener/port0. flag ANVIL_UI04_EXECUTION_PREPARATION_DOM_QA=1.
- 매생성직전부재/parent realpath/link/owner·전용Edge0 재확인·setup전체outertry/finally·launch전불명표식·확정context/browserclose·env원형복구·marker/realpath/link/소유확인후자원만회수·별도경로/프로세스잔여0. 불명launch/close는강제kill/삭제0·보존/실패/보고한다.
- 실제DB/SQL/GRANT/정책·계정·권한·키Secret/인증서·서비스/Agent/Job·비용·Oracle/운영·제품원문FS IO0. C1/권위/실행부족항목삭제0. 물리불명/실서버/served/사용자인수NOT_RUN. rollback은정확소스checkpoint 정상revert·실자료/DB삭제0. 같은근본실패3회는추가지시중단/Main판단, 전체산출물한국어.