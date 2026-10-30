# FN09 실행 준비본 저장 일회 승인 — 2026-10-30 source 검수 결과

## 판정 → 근거 → 조치
**source-only 범위 검수 통과 / 실제 기능 동작 미확인 / 전체 FN09·WORK_PLAN 미완료.**

직접 승인한 A안의 준비 후보 전체 보관·보호 조회, UI08 원문 표시·별도 결정, 정확 원명령 일회 소비·준비본 저장 연결을 구현했다. 기존 Primary가 구현하고 Main이 새 실행·변경/자원 대조, 기존 Reviewer가 독립 검수했다. 서버 비밀 검사·미적용 SQL NULL 검사·UI 같은client ABA의 실제 I1은 보완 후 해당 범위 C0/I0다. 초기 잘못된 검수 전제는 철회 이력으로 남겼다.

다음 조치는 기존 개발 branch의 source checkpoint 게시다. 실제 DB·서비스·Agent 연결이나 전체 완료 판정은 하지 않는다. 신산님이 접속 중인 기존 서비스에 반영한 화면으로 소개할 수 없다.

## 기준과 승인
- 시작 HEAD: 73e1f9f95acd5b4eb0c07e8281331ce673593e80, 기존 codex/av3-stage-b. main은 f976ed5e29e14b13e12729d5b1ccf98f050f2210 보존.
- 직접 승인: docs/approvals/FN09_PREPARE_EXECUTION_SOURCE_DIRECT_APPROVAL_20261030.json / B50A77099F2EBAEE634FF7B6A10B3E766CCD5F5F92FC3A801C907194186455FE.
- 채택 결정안 r2: docs/work_packages/FN09_PREPARE_EXECUTION_APPROVAL_DECISION_PACKET_20261030.md / 4B8455AEECB0A200E97028573A08027F1F2954E546C6D7779FA89EB32B9CB49E. 당시 DRAFT 문구는 이력이며 현재 직접 승인과 구분한다.
- WI: docs/work_packages/FN09_PREPARE_EXECUTION_APPROVAL_IMPLEMENTATION_20261030.md / 9E91E587D7B242D262E102633A819F321546DB1C0DECDE26F3F873F8CA11339E. 정확 코드/시험13경로, Main/Reviewer 코드 쓰기0, 기존 SQL·보호8 보존.

## 구현 및 검수 범위
|요구|현재 근거·한계|
|---|---|
|후보 원문|prepare 전용11필드 전체와7ref·mode/sourceScopes/reason·원명령/hash를 불변 후보로 저장·보호GET 검산. 실제 class 메모리 원장/decoder 검증. 실제 DB 저장은 미실행.|
|별도 승인|요청·사람 결정·원명령 결박/소비 분리, replay 추가소비/저장0·다른주체/기기/세대/명령/hash·만료/회수 거절. 현재 인증/ref reader는 합성 fixture.|
|원자 완결|신규0055 pending에 기존 BEFORE 보존·승인ref/hash·기존wrapper 위임·후보/요청/명령/receipt/audit/소비/준비 양방향 deferred와 사후 불변 검사. 실제 DDL/COMMIT/RLS/경합은 NOT_RUN.|
|UI08|전체 후보·원명령/hash를 텍스트로 표시, 능력/예산 실체 미검증·NOT_AUTHORIZED 명시. 별도 decideApproval만 전송·자동 준비 소비/Agent 전달0.|
|문맥·불명 명령|client/user/project/request 전환과 transport/json/실digest 반환대기, sameclient ABA epoch, 권한실패·변조 때 이전본문 숨김. 미확인 결정 원명령/이유 보존·자동재전송0.|
|기존 동작|AUTO 의미·다른 연산·역할/예약 승인·reviewUnderstanding 차단·기존 unresolved/두false 보존. UI04 유효 참조 공급자와 작성 화면은 이번 범위가 아님.|

## Main 새 검증
모든 명령은 기존 승인된 코드 위치에서 수행했다. 아래 실행은 서로 다른 범위이며 전체 계획 인수 숫자로 합산하지 않는다.

```powershell
node --test tests/unit/FN09/execution-preparation-approval.test.ts tests/unit/UI08/execution-preparation-approval-api.test.ts
```
18d413: 서버13+client4=17PASS/0skip/exit0, 458.4089ms. 서버 인증·하위 임무/draft/binding/context/candidate reader5개·SQL응답·transaction rollback은 메모리 fixture다. 실제 repository/class의 명령 소비·오류 전파를 검사하며 실제 인증/DB 트랜잭션 보장이 아니다. 비밀 재봉인 GET 반례는 후보class 직접 소비, client 재봉인 반례 일부는 전용validator 직접 소비다.

```powershell
node --test tests/unit/FN08/execution-preparation.test.ts tests/unit/FN11/approval-input.test.ts tests/unit/FN11/work-plan-approval-candidate.test.ts tests/unit/FN11/design-activation-approval.test.ts tests/unit/FN09/responsible-session-approval-input.test.ts tests/unit/UI08/work-plan-approval-api.test.ts tests/unit/UI08/design-activation-approval-api.test.ts
```
d048d1: 직접 영향7파일53PASS/0skip/exit0, 1175.1527ms. 이후 변경은 UI Page/합성DOM3뿐이므로 이 서버·decoder 회귀를 반복하지 않았다.

```powershell
$env:ANVIL_FN09_PREPARE_DOM_QA='1'
# ANVIL_FN09_DOM_CASE는 제거하여 전체 조건 실행
node --test tests/browser/UI08/execution-preparation-approval-dom.test.ts
```
a02b96: 최종 자식8+부모=Node9PASS/0skip/exit0, 6153.8112ms. 실제 Edge DOM/ApiClient이지만 API는 메모리 transport, HTML은 테스트 route로만 공급한다. DELAY_JSON도 합성 JSON 대기이며 실제 HTTP 응답 본문 검증이 아니다. 실제 원 WebCrypto digest 호출/완료 후 반환만 대기하고 원 함수 신원을 복구한다.
- 최종 bundle SHA256: 025e2b0003e5d078708671cac76b4a518862ceff3be0137bf61189a611108113.
- 기존 E02D Page 시점 bf4092 자식6+부모7PASS는 보완 전 이력이다. 최종9PASS에 혼합하지 않는다.

```powershell
npm run build
git diff --check
git diff --exit-code HEAD -- db/migrations/0016_execution_preparation.sql db/migrations/0049_responsible_session_one_time_approval.sql.pending
```
e65210: typecheck 포함 표준build exit0, 474modules/458ms, diff/기존SQL 불변0. 기존500k chunk 경고 유지·기준 완화/자동 최적화0.

## 오류·독립 검수·재작업
- 최초 RED cca8ab는 기존 실제 미연결412와 후보 모듈 부재를 분리했다. UI decoder RED도 별도 이력이다.
- 서버 I1: 후보 grammar-only 검사로 기존 비밀 reason 검사가 빠짐. 실제2RED→기존readExecutionPreparationInput 재사용2GREEN·독립C0/I0. 새 탐지정책 없음.
- SQL I1: JSONnull/scalar 타입 공백을 Main22d9ef 확인, 명시string/NULL failclosed로 보완. 정합hash JS parser 반례+SQL구조 검사·독립scopedC0/I0. 실제 PG 삼값논리 실행 증거 아님.
- 시험 TS 오류2회는 합성 read-port 부분 projection 반환형/null추론/assert.rejects 인자형식이었다. 테스트 constructor 타입만 보정·제품 기준 완화0.
- 도구 거절1/실행0은 Primary의 workdir 누락. 정확 cwd/대상 재검증 후 명시 cwd로 정상심사 보정, 우회0.
- 초기 DOM2PASS/3FAIL은 실제 버튼명·ABA복귀 정상새GET을 잘못 가정한 fixture 원인. 정상 부모·새GET을 보존해 수정, 분리 실행과 최종 전체를 혼합하지 않았다.
- 최종 UI 검토의 '초기buffer=null pending' 가정은 실제 lookup→update→load 순서와 달라 철회했다. 대신 정상후보 보관→sameclient B→A복귀 새GET pending의 옛body 재노출을 실제49f7c7 RED로 확인했다. 표시owner/load/결정capture에 전환 epoch를 묶어 보완, 실제transport/JSON/digest 경계 GREEN·독립최종scopedC0/I0. 철회된 전제와 실제 재현을 구분한다.

## QA·보존·미실행
- 전용 D:/tmp/anvil-v3-stage-b/fn09-prepare-approval-20261030-01, 실행별 새 빈 경로·owner SINSAN\cyhuh·부모link0·수명30분 이내. Main 최종 생성2026-10-30T02:55:05.789Z(한국시각11:55:05), 약5초 내 정상close/env복구/정확회수. ab864c와 최종 별도조회로 경로 부재/관련Edge0을 확인한다. 물리 launch/close 불명 실패는 이번 실행에서 발생하지 않았고 그 회수 보장은 미실행이다.
- 실제 DB 접속/DDL·GRANT/정책·keys/Secret/certificate·서비스·Agent/Job·UI04생산자·HUMAN R2·능력/예산 실체·실HTTP API/served/WSL·Oracle/운영·사용자인수 NOT_RUN. 이를 PASS나 클라우드 정밀검증으로 숨기지 않는다.
- main 병합/PR/branch정리 gate 미충족. 기존 보호 untracked8·Main현황 이력 보존. 원래 실패·미검증을 소급 PASS로 바꾸지 않는다.
- rollback: 이13코드 경로의 한정 Git revert. 실제 DB/runtime 변경이 없어 환경 rollback을 실행하지 않았다.

## 최종 코드/시험 SHA256
|경로|SHA256|
|---|---|
|apps/server/modules/access/project-command.ts|5A49F4AB8A131198FB3CAD8004981AFBBAB39C7241997D9A78053AD10C703AA3|
|apps/server/modules/approvals/approval-input.ts|F8B1CAF1CF21EC6D69673F2C6EEAAA3ED7C202ADF70634663B89647E18EAFF72|
|apps/server/modules/approvals/project-approvals.ts|B6A8CF7432A66E6EDC513FA3547A721605E5088FAB4DD41FB24EFCCE826F9CE2|
|apps/server/modules/executions/project-execution-preparations.ts|BAF8F69C6E178C0D502D469756E086326E2E990B44436D163BA956DC051901CE|
|apps/web/src/features/decisions/api.ts|1E48AB49B0BE40F52404FCD8323E4C8A38A34C569DD39EF0878DDC3364DBC8BC|
|apps/web/src/features/decisions/ApprovalsPage.tsx|06AC5CCC3815A04891331AA7BFC04094CA8B75C746CF9677DF414802CD708B8F|
|apps/server/modules/approvals/execution-preparation-approval-candidate.ts|2F45FA52B6C5E9EEB64CD48A6C236177D91572D372D4B9B7E0015A7EB4829589|
|apps/web/src/features/decisions/execution-preparation-approval-api.ts|FE48B10F7189FEFF6515319D3CCF2DA26C1929D6655C8354D4E5EA3BC0A017F0|
|db/migrations/0055_execution_preparation_one_time_approval.sql.pending|F699F53884DC17EF02CE725EC320B0473F8694F97FC4FB9735F53ACC189DBA1D|
|tests/unit/FN09/execution-preparation-approval.test.ts|16F024449E5DA0AD1D1FD9994407D1410C43C0A68227341911D4380798B31950|
|tests/unit/UI08/execution-preparation-approval-api.test.ts|C6E11E598A6BC697C1DAF73CBD7F2EF55BC345FFC0BE63D89CB05F4DE9FEE185|
|tests/browser/UI08/execution-preparation-approval-dom.test.ts|9C4CA5286C2DEAFCC3C1ED0309856FBB7AA2BF566442F1058E37C9B8B22EBDCF|
|tests/browser/UI08/execution-preparation-approval-dom-harness.tsx|A38728214947CC092665836DB66707DE807A93AA93F85CDC234C04EB199E5502|
