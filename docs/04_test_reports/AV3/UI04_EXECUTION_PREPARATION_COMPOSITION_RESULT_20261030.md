# UI04 실행 의도 준비본 작성·별도 승인·저장 연결 — 2026-10-30

## 판정·근거
승인된 WORK_PLAN UI04/FN09/FN11의 **기존 공개 계약 소비 소스 단위**를 구현·검수했다. 최종 독립 C0/I0이며 확인된 미해결 Critical/Important는 없다. 전체 UI04/FN09/FN11·Stage·작업계획서 완료가 아니다.

- WI `docs/work_packages/UI04_EXECUTION_PREPARATION_COMPOSITION_IMPLEMENTATION_20261030.md`, SHA256 `9D251E4B466458179646F6C0E3E4F7B0283DF3F48A208064018C51D6D3E6EA08`.
- 기존 직접 승인 FN09 prepare A `B50A77099F2EBAEE634FF7B6A10B3E766CCD5F5F92FC3A801C907194186455FE`, 결정안 `4B8455AEECB0A200E97028573A08027F1F2954E546C6D7779FA89EB32B9CB49E`, HUMAN r2의 고정 GET를 소비한다. 새 서버/API/승인·권한/SQL 계약을 만들지 않는다.
- 시작 HEAD `0f2426dadd11deac1eb774834392b6df9dc2f8c6`, 기존 `codex/av3-stage-b`. Main WORK_STATUS dirty·보호 untracked8을 보존했다. 기존 Primary 단일 writer, Main 관리·검수·문서·통합, 기존 Reviewer 읽기검수다. 제출 뒤 writer 해제했다.

## 변경 전후·사용자 흐름
이전에는 실제 역할binding/context/연결·환경후보/HUMAN보고/예산 생산자가 있어도 UI04 새 준비 작성·선택 연결이 없었다. 이를 실제능력/예산 미검증 때문에 의도보관까지 불가능한 것으로 보지 않도록 구분했다.

이제 확정임무 → 보관된 binding/context 명시선택 → 확정환경/예산·App의 실제 HUMAN 보관결과 선택 → 기존 보호 GET/fullref·hash·연결/환경 pair 검산 → 허용범위·mode·이유 → 원명령 동결 → AUTO 보관 또는 기존 UI08 별도 결정 → 정확 원명령 명시 재개 → 고정 readback으로 이어진다.

사람보고의 UNVERIFIED/CANDIDATE_ONLY·현재성 issues, 과거 예산의 현재head/가용량 미확인을 표시한다. 저장해도 기존7미충족과 조건별 추가 미충족·NOT_AUTHORIZED·executionAuthorized=false/dispatchPerformed=false는 유지한다. 준비 의도 보관은 실제 Agent 실행 허가가 아니다.

App 소유 buffer는 draft/선택ref·원명령/hash·승인 요청/결정·불명 결과를 보존한다. 명확 거절의 원명령·옛 승인 이력은 남기고 새 준비의 활성 승인만 분리한다. owner 상실 후 POST0, 초안보존 목록 재조회·확인 체크 초기화, 기존 저장임무를 null buffer에서 여는 실제 부모 콜백도 연결했다. 다른 임무·기능의 pending/초안을 덮지 않는다.

## 정확12경로·최종 지문
Main29e985가 실제 지문을 확인했고 수행자 제출과 일치했다.

|경로|SHA256|
|---|---|
|apps/web/src/App.tsx|CE8DD8E43E59ADB21A74EF0D02323DE39F7246970636D22E08169166D20CCBEA|
|apps/web/src/features/workspace/WorkspacePage.tsx|E298F66D3DE058ED591D0A2E3B8B611754EA5EB806A85B640DEA6D18CACCC44A|
|apps/web/src/features/workspace/WorkspaceAssignments.tsx|102CBD9CCB639499288E83A81CED36C89D19D0F7D41EFB4785723959079C9894|
|apps/web/src/features/workspace/AssignmentContentDecision.tsx|5FEBE7EC8BD6B13865D8BBDD68B886267B3FE2A401B5C5862EFE815103AEF6D2|
|apps/web/src/features/workspace/assignment-api.ts|DE5B3180FC36FF7CEA1608A044C57D43E98D1F422694AF6E7F832D3CCEC3BA60|
|apps/web/src/features/workspace/ExecutionPreparationEditor.tsx|6B1EC78F07A500E56BB3EC28D0090D410CE3E0DA74C10169FB0D0161BEA56B76|
|apps/web/src/features/workspace/execution-preparation-api.ts|50092898098C6E23900A7ADFC8296FA548D781149FA3409F96D78EF703F58FE7|
|apps/web/src/features/workspace/execution-preparation-approval.ts|7C9BDAB4DC61B61F56DA9EC9AC8A474EA7955CD6426DD15CB2FC1ADB424FE98C|
|tests/unit/UI04/execution-preparation-api.test.ts|C398C9FBAB0748561AFAC1CF74336B4AEECBA6A699DAEF4108ED426925F728B4|
|tests/unit/UI04/execution-preparation-approval.test.ts|849B57B4370AE7929BEBD6177E45B79C41FF818D032E338ADBAA508E8A1BC66D|
|tests/browser/UI04/execution-preparation-editor-dom.test.ts|34072DDC10C75BF73FB8D0BF491506D15B7CA68819A383F8B3911945EB17510D|
|tests/browser/UI04/execution-preparation-editor-dom-harness.tsx|03A711978540121B9431C0EB85A4CA5A874A821955F859149E2560E17F3B93D5|

Main bc773d는 보호8 지문 불일치0을 별도 확인했다. 기존 서버/SQL·공통 승인 도우미·보호 reader·C1·connector/native·키/DB/서비스는 변경하지 않았다.

## Main 실제 검증
각 행은 별도 실행이며 수행자 실행·소스검토를 합산한 고유 사례 수가 아니다. 모두 exit0/0 SKIP이다.

|증거|정확 명령/범위|결과|
|---|---|---|
|369476|`node --test tests/unit/UI04/execution-preparation-api.test.ts tests/unit/UI04/execution-preparation-approval.test.ts`|신규unit10 PASS, 468.4776ms|
|fc3642→31e120→c56d49|`ANVIL_UI04_EXECUTION_PREPARATION_DOM_QA=1 node --test tests/browser/UI04/execution-preparation-editor-dom.test.ts`, CASE 미설정|최종9자식+부모 Node10 PASS, 18545.3859ms|
|2e708f|`node --test tests/unit/FN09/assignment-web.test.ts tests/unit/FN09/assignment-confirmation-web.test.ts`|실변경 임무/부모 직접인접15 PASS, 348.9491ms|
|e23e46|`npm run build`(내부 typecheck), `git diff --check`|type/build/diff0, 482modules/506ms·기존 큰chunk 경고 유지|

수행자는 직접인접4파일47 PASS를 별도 제출했다. Main은 실제 변경된 assignment API/부모 영향의 위2파일15만 fresh 검증했고, 불변 서버 전체나 그47 전부를 재실행했다고 하지 않는다.

DOM 번들 SHA256 `10041e2195545abd189349eeadfa1c7673ba93324207b00eb5bb776da713c110`. 실제 Editor·ApprovalsPage·WorkspaceAssignments 및 기존 보호 reader/native crypto를 사용하고 API/auth/receipt는 메모리 transport 대역이다. 전체 App 브라우저 여정은 아니다.

검증된 조건: 명시선택 AUTO 저장/원형 readback, 실제 UI08 별도 결정 후 동일원명령 재개, 유실/readback404/malformed412409의 원명령 불명 보존·자동재송신0, ABA/실client·clientId/project/fullassignment/owner 변경의 stale POST0·조작회복, 초안유지 재조회, 옛 승인 분리/이력보존 후 새 요청, ownerfalse 불명승인 재POST0, 실제 null 부모 저장임무→원초안/검토/확정 조회→새준비 콜백·재진입, 선택목록/정책/후속readback의 lateJSON 폐기와 다른 pending 보존이다.

## 오류·검수 보완
- API 모듈부재 REDfb279b는 동작조건0으로 구분한다. 실제 기존 예약widget의 새준비버튼부재 RED563c8d를 별도 확인한 뒤 구현했다.
- 타입 implicit-any1, 승인 unit 정책hash fixture1, 실제 context 생성 인자역전 fixture1, 단위 빈scope의 정상문법 정합화를 구분했다. 기준·검사기·서버 의미를 낮추지 않았다.
- UI가 sendApprovalCommand의 표준receipt를 result.ref로 읽은 것은 **제품 오류**다. 기존helper 반환 대조 뒤 result.data.ref2곳만 고쳐 실제 승인정상 GREEN7c5edb를 확인했다. 이를 fixture 오류로 숨기지 않는다.
- Main은 malformed 4xx/REQUEST_FAILED를 확정거절로 분류하지 않도록 기존helper를 대조했다. 독립 I1 옛 활성승인 잔존/I2 ownerfalse 재POST와 초안목록복구를 실제3조건 RED→GREEN으로 보완했다. null 부모 누락은 실제 부모 경로의 별도 회귀로 검증했다.
- 기존 policy matching 규칙·7ref/scope 문법을 새 helper 안에서 명시 검산하며 실제 서버 정책을 바꾸지 않았다. 동일 근본원인3회 반복이나 강제 Main 인수는 없었다. 최종 독립 C0/I0이다.

## QA·미검증·복구·다음
Main 실행 직전 등록 QA `D:/tmp/anvil-v3-stage-b/ui04-execution-preparation-20261030-01` 부재/전용Edge0을 확인했다. 생성2026-10-30T12:19:35.982Z 후 약19초 내 환경 복구true/QA_EXISTS false. e2276b 별도 조회에서도 경로false/Edge0이다. 소유 marker/link/realpath 확인 후 확정 자원만 회수했다.

**NOT_RUN:** 실제 HTTP API·인증/DB·SQL/권한/원자성/COMMIT·제품 원문 FS IO·실제 Agent/키/서비스·전체 App/served/사용자 인수·물리 회수불명. 현재 실행 서비스에 반영하지 않았다. 새준비 원형의 실제 DB 존재·적용 상태와 실제 실행능력·전체계획 완료를 주장하지 않는다.

rollback은 한정 source checkpoint의 정상 revert다. 실제 자료/DB/계정/키/서비스 삭제·자동down migration은 없다. 정확16경로(소스/시험12+WI/결과/WORK_PLAN/WORK_STATUS4) checkpoint/private 게시 후 다음 미완료 계획 단위를 이어간다. 필수 실제Stage gate 미달 PR/main병합0이다.