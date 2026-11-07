# FN09 실행 준비본 일회 승인 source 구현 작업지시서 — 2026-10-30

## 1. 근거·담당·현재 기준
- 신산님 직접 A안 승인: docs/approvals/FN09_PREPARE_EXECUTION_SOURCE_DIRECT_APPROVAL_20261030.json SHA256 B50A77099F2EBAEE634FF7B6A10B3E766CCD5F5F92FC3A801C907194186455FE.
- 채택한 결정안 r2: docs/work_packages/FN09_PREPARE_EXECUTION_APPROVAL_DECISION_PACKET_20261030.md SHA256 4B8455AEECB0A200E97028573A08027F1F2954E546C6D7779FA89EB32B9CB49E. 결정안의 당시 DRAFT 문구는 이력이며 직접 승인 기록이 현재 권한이다.
- WORK_PLAN FN09/FN11/UI08의 실행 준비본 저장 승인 연결 업무. 전체 FN09/Stage/계획 완료를 대신하지 않는다.
- 시작 HEAD 73e1f9f95acd5b4eb0c07e8281331ce673593e80, 기존 codex/av3-stage-b. 단일 기존 Primary 구현, Main 관리·검수·통합, 기존 Reviewer 독립 읽기 검수. 새 세션·branch·작업공간·자동화 생성0.
- 기존 Main WORK_STATUS 변경·보호 untracked8 보존. Primary는 아래13경로만 코드·시험 쓰기, 문서/commit/push는 Main. Main은 writer 활성 중 같은 코드 수정0.

## 2. 완료할 사용자 동작과 불변 조건
prepareExecution 원 ExecutionIntent 11필드 전체를 승인 요청과 함께 불변 보관하고 보호 GET에서 원형 검산한다. UI08에서 정확7ref·mode·sourceScopes·reason·원명령/내용hash를 읽고 기존 별도 결정 절차를 거친다. 정확 원명령에만 승인 결박·일회 소비 후 준비본과 receipt/audit를 보관·재조회한다. UI04 준비 입력·유효 참조 생산자는 이번 범위가 아니며 임의 UUID 폼을 추가하지 않는다.
- ActionScope의 null/빈 목록은 준비본 저장 효과이며 실제 intent 환경·소스·예산은 payload 전체 hash와 UI 표시로 결박한다. 실행 허가로 표현하지 않는다.
- 현재 로그인·HUMAN/client/control·명시 정책·DENY·만료/회수·동일 원명령/기한·기존 임무/예약/맥락/연결/환경/소스 범위 검사를 보존한다.
- capability/budget는 문법/후보 무결성만 검증하며 실체 존재를 새로 검증한 것처럼 표시하지 않는다. NOT_AUTHORIZED/executionAuthorized=false/dispatchPerformed=false·기존 unresolved 전부 보존, WORK의 UNDERSTANDING_NOT_REVIEWED 보존. reviewUnderstanding 차단 유지.
- 기존 AUTO와 다른 연산·0049 역할/예약 승인 의미 불변. 과거 REJECTED/EXPIRED/CONSUMED 후보 원형 조회는 현재 승인 적격성 검사와 구분한다.
- 실제 DB 연결/DDL/SQL·권한/정책 적용·키/Secret/certificate·서비스/Agent/Job·비용·Oracle/운영 실행0. 미적용 SQL 파일 작성만 허용한다. HUMAN R2 미채택 유지.

## 3. 정확 쓰기 allowlist — 코드/시험13
### 기존6 (Main e7366e 선확인)
|경로|시작 SHA256|
|---|---|
|apps/server/modules/access/project-command.ts|FD31E0162304BB2ACC8AB1ED01FFF401F88F095E7CB34164C81A59E23762A456|
|apps/server/modules/approvals/approval-input.ts|D266C058E7163C2310251BFDBAF7F99B38FB13503DE45DC480EEED6B58DDE3AB|
|apps/server/modules/approvals/project-approvals.ts|A52619D7926BE1424A079D69C9AD13750437B1EFF50F0A3AB96EE9ACCBDBACE5|
|apps/server/modules/executions/project-execution-preparations.ts|6CA96DC45471882E55FE32406DC68BF21836534F5C6AFD8D0980E14212BEAEC0|
|apps/web/src/features/decisions/api.ts|770E1272A8F79B0D649AA8AC309613D56A4E35D955AB40C07118F2A9B308A2FF|
|apps/web/src/features/decisions/ApprovalsPage.tsx|87EBFCE224A7AF3B34CEA78422A1CB0F4F8F516E467D953A461805C018FB80A7|
### 신규7 (Main e7366e 부재 확인)
- apps/server/modules/approvals/execution-preparation-approval-candidate.ts
- apps/web/src/features/decisions/execution-preparation-approval-api.ts
- db/migrations/0055_execution_preparation_one_time_approval.sql.pending
- tests/unit/FN09/execution-preparation-approval.test.ts
- tests/unit/UI08/execution-preparation-approval-api.test.ts
- tests/browser/UI08/execution-preparation-approval-dom.test.ts
- tests/browser/UI08/execution-preparation-approval-dom-harness.tsx
routes.ts의 기존 준비 저장/GET 경로를 재사용한다. 새 route·기존 SQL 수정0. 범위 밖 파일이 꼭 필요하면 코드 쓰기 전에 Main에게 정확 소비선·이유를 보고한다.

## 4. 구현 순서·필수 검증
1. 신규 서버 시험으로 기존 차단/후보 부재를 실제 관측하는 RED를 먼저 남긴다. 모듈 누락 자체와 실제 계약 실패를 구분한다.
2. prepare 전용 requestApproval candidatePayload 입력·문법/project/hash/현재 주체/명령 결박·요청과 후보 transaction 보관·불변 보호 GET 검산을 구현한다. 기존 연결 후보 fallback이나 hash만 보여주는 대체 구현 금지.
3. 실제 ProjectApprovals/ProjectExecutionPreparations와 원 authorize→consume 순서를 연결한다. 정상 요청→별도결정→원명령 소비/고정조회, 같은 명령 replay 추가 소비/저장0. 원 payload/7ref/hash/mode/sourceScopes·다른 project/user/client/control/command·만료/회수/후보 변조·부분 실패 반례를 확인한다. 기존 AUTO 정상 및 reviewUnderstanding 차단 쌍도 검사한다.
4. 미적용0055는0016의 기존 BEFORE guard 전체 검증을 보존하면서 승인 원ref의 request hash 재구성과 prepare 전용 허가를 추가한다. 기존0049 wrapper/소비체인은 prepare 외 위임을 유지한다. consume 시점에는 준비행이 아직 없으므로 선행 검사와 최종 완결을 분리한다. commands/authorization_receipts/audit_events/approval_consumptions/execution_preparations의 최종1:1 양방향 검사를 deferred로 구성하고 승인 요청/후보 누락 보관·CONSUMED 전환도 닫는다. 관련성은 operation 하나가 아니라 연결된 준비/요청/소비/감사에서도 찾고 사후 변조·불완전 그래프를 거절한다. AUTO의 승인/소비 없음 보존. 실제SQL 실행 없이 구조/정적 반례만 검증하며 DB COMMIT/RLS/경합 PASS 주장0.
5. 기존 ApiClient/실 decoder에서 전체 후보 검산을 연결한다. UI08 전체 원문·원명령/hash·참조 실체 미검증·실행 허가 아님을 표시한다. project/user/client/control/정확requestRef/후보명령에 표시를 결박하고 전환/403/late에서는 즉시 숨긴다. 기존 미확인 결정·다른 작성buffer 보존·자동 소비0. UI04 작성 버튼/가짜참조0.
6. 신규 집중 unit/합성 실제 DOM과 직접 영향 기존 FN08 준비 저장·FN11 승인 입력/계획/설계 후보·FN09 책임세션 승인·UI08 decoder를 실제 존재 경로로 골라 회귀한다. npm run typecheck, npm run build, git diff --check를 실행한다. 변경 없는 완료 기능 전체 반복0·기대값/기준 완화0.
7. Primary 결과/정확명령·exit·파일hash·diff·오류·미실행·회수 보고→writer 해제→독립 C/I 검수→필요보완→Main fresh 집중검증→정확 source-only checkpoint/private 게시. 실제 Stage gate 전 PR/main병합0.

## 5. 합성 QA 자원 사전등록
- 신규 전용 경로 D:/tmp/anvil-v3-stage-b/fn09-prepare-approval-20261030-01 (필요한 bundle/결과 하위만). Main e7366e 부재 확인. 각 실제 실행 직전 부재·realpath/부모·link·owner를 재확인한다.
- 소유 작업 FN09 A, 담당 기존 Primary/Main 순차 사용. 목적은 메모리 합성 transport·실제 UI08 DOM/Chromium 검증이며 서버 listener·DB·Agent 실행0. Node/Chromium은 해당 합성 시험 프로세스만 사용한다.
- 매 실행 신규 빈 경로·최대30분. 성공/실패 모두 finally에서 환경변수 복구·browser/context 회수·확인된 소유 파일/경로만 제거, 별도 잔여 부재 확인. 물리 launch/close 결과 불명은 강제 종료하지 않고 실패·보존·보고한다. 기존 UI10 회수 보완을 참고하되 완료 시험 재실행0.
- build 산출물은 기존 표준 npm run build 동작과 동일하며 source/실제 서비스 변경이 아니다. 합성 fixture를 정식 자료나 실제 Network/DB 증거로 승격하지 않는다.

## 6. 기록·오류·복구
Primary는 동일 원인 실패 횟수·정확 원인·변경/검증·미실행을 Main에게 보고한다. 동일 유효 실패3회면 같은 시도를 중단하고 Main 인수 절차로 전환한다. 모호한 경로는 inventory→정확 존재 문자열→Leaf검사→그 경로만 읽기, 추측/ACL 변경0.
Main은 WORK_STATUS/WORK_PLAN에 source 한정 상태와 실제 DB·served·사용자인수 미검증을 기록한다. 승인·WI·결과를 같은 checkpoint에 보존한다. rollback은 이13경로의 한정 Git revert이며 실제 DB/runtime 변경이 없으므로 환경 rollback은 없다. 보호8·기존 dirty를 복구 수단으로 삭제하거나 덮어쓰지 않는다.
