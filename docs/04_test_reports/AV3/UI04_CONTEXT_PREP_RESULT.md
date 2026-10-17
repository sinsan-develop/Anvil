# UI04 프로젝트 주 작업 원본 조회 연결 — 한정 결과

Main 어울, 2026-10-18. **부분 구현·새 번들/합성 API의 핵심 조회 확인**. 실제 served 반영·DB 여정·Agent 작업·전체 UI04 완료가 아니다.

## 의도·범위·변경

- 승인 S04/WORK_PLAN UI04·SCREEN_WORK UI04의 착수 선행 UI00/P01과 기존 프로젝트 detail GET을 소비했다. 프로젝트 목록의 workspace 링크가 미연결 안내로 끝나는 공백을 Main이 다음 미완료로 선정했다. PMO 다음 업무 배정을 기다리지 않았다.
- 기준 branch codex/av3-stage-b / local-private1707cd49035fcc34e4a1900ac0437632e2917076. 단일 writer Main, 실제 runtime은6781703a/N4이고 이 후보를 재시작·반영하지 않았다.
- 제품4: `apps/web/src/features/workspace/api.ts`(기존 GET의 ID·원본·적용 참조·읽기 권한/제어·준비 부족 검증), `WorkspacePage.tsx`(절차 참조/총괄 미연결/자료의 3영역), 기존 `apps/web/src/App.tsx`의 import·workspace 분기, `styles/app.css`의 국소 반응형 레이아웃이다. 다른 기존 화면·server/SQL/권한/설정·native는 불변이다.
- 직접 `tests/unit/UI04/context-api.test.ts`, `tests/browser/UI04/{bundle.ts,workspace.spec.ts}`. 기존 UI01 목록의 workspace 이동에 필요한 기존 detail 응답 fixture와 전용 bundle 선택만 추가했으며 기존 기대값/예상 밖 API 거절·비GET0 기준은 유지했다.
- 원본 이름·목적·원하는 결과·변경 버전, 고정 적용 **참조**·참여/원본 편집 제어, 준비 부족, 문서/방법론/지식/승인/도구 탐색을 표시한다. 원본 조회의 HELD/준비 부족 없음은 실행허가/READY가 아니다. 총괄/책임자 세션·graph/단계 순서·지시 전달·Agent/실행 결과는 미연결로 표시하고 전송 버튼을 비활성화한다. 새 API나 가짜 세션/상태를 만들지 않았다.
- 로그인/프로젝트/client 키로 화면을 분리하고 현재 effect가 폐기되면 지연 응답을 무시한다. 새 조회부터 이전 원본을 제거하고 401/403/404/503을 빈 성공·현재 원본으로 바꾸지 않는다.

## 최소 검증

1. 최초 `node --test tests/unit/UI04/context-api.test.ts`는 새 module 부재 `ERR_MODULE_NOT_FOUND`/exit1이다. **7개 행동 case가 실행된 RED는 아니다.** 구현 후7PASS, 인접1을 합친 아래 최종8PASS와 구별한다.
2. `node --test tests/unit/UI04/context-api.test.ts tests/unit/FN01/project-list.test.ts`: **8PASS/FAIL0/SKIP0/335.0044ms/exit0**. same-origin GET·잘못된 ID/타프로젝트·불완전 제어/적용hash/권한·만료/거절/네트워크 실패를 확인했다. transport만 가짜이고 실제 DB 접근/인증/정책 검증은 아니다.
3. `npm run typecheck`, `git diff --check`: exit0. 전체 회귀는 실행하지 않았으며 기존 코드 불변의 A3 35검사도 반복하지 않았다.
4. 전용 `vite build --config apps/web/vite.config.ts --outDir D:/tmp/anvil-v3-stage-b/ui04-context-01/dist`:124module/초기286ms·harness 보완 뒤262ms/exit0. >500kB 경고1은 최적화 작업으로 확장하지 않았다.
5. 명시 전용 `ANVIL_UI04_QA_DIST`로 새 bundle을 same-origin route.fulfill하고 기존 API 응답 fixture만 연결한 Edge Playwright UI04 3/UI01 2: **최종5PASS/FAIL0/SKIP0/4.1s/exit0**. 목록→원본, 자료 href/disabled 전송, 조회 거절 시 제거, 다른 프로젝트 이동 후 늦은 원 응답 미표시를 확인했다. UI04 직접 검사에서 예상 밖 API/비GET/off-origin/pageerror0이다. 실제 서비스/API/사용자 DB 여정 PASS로 승격하지 않는다.
6. 초기 browser5PASS 뒤 전용ENV 없는 일반 served 검사에서도 static이 차단되는 harness 문제를 발견했다. API 거절/off-origin 감시를 유지하면서 static 제공만 선택하게 보완한 뒤 최종5건을 재확인했다. 제품 불변이지만 시험이 변경됐으므로 이 재확인은 필요한 검증이었다. NO_COLOR/FORCE_COLOR 도구 경고1도 제품 실패와 분리한다.

## 시험 자원·정리

- 사전등록한 Main/현재사용자 소유 `D:\tmp\anvil-v3-stage-b\ui04-context-01`의 dist/temp/results만 사용. worker child TEMP/TMP는 전용 temp, OS 지속환경/ACL·현재 service dist/Node/relay/DB/Secret 변경0이다.
- build3파일/index **95F6917CD3D2B2170B5C3B9629F7B959B89B04B385F689BA65811943EFB219E9**, JS **7D5F4D9F5D3ECB865CB311924697D335682542A95B74C5EF54B5AC4F2693A09A**, CSS **1FFC9B57199672473A5E3D572A73E4F36AECF4413E97F49C44C19D8C1E342D11**. 결과 JSON·브라우저 debug log2파일과 빈폴더5를 정확 실경로/전체목록·현재사용자 owner/nonlink/비reparse·hash·QA프로세스0 확인 후 제거했다. 최초/보완후 모두 별도 Test-Path false. 기존 실패 자료/런타임/보호 자료는 건드리지 않았다.
- 초기 추정 시험/모듈 경로 읽기3건과 PowerShell glob os123은 실제 파일 검색으로 정정, ACL/권한 변경0. 새 module 부재 외 제품 실행 실패0이다.

## 검수·미완료·다음

- 원 독립 검수 C0/I1/M0: waitForResponse가 헤더만 보므로 원 본문/JSON 처리 전에 부재 검사가 참일 수 있는 시험 결함이다. 제품 오노출을 확인한 판정은 아니다. Main은 실제 Client.get→json→동기 검증→effect와 대조해 수용하고 시험만 한 번 보완했다. body finished/실JSON 보류·명시 해제/이후 event-loop barrier·2 render frame 뒤 원 프로젝트 부재와 현재 프로젝트 유지를 검사했다. **보완 후 최종5PASS/6.6s/type/diff0·격리 build124module/255ms**. 위4.1초는 보완 전 증거다. 새 독립 C0/I0로 승격하지 않는다.
- 판단 유보별 Main 분류: 실제 user/client 인증 교체·실API/DB는 후속 고위험 연결 검증에서 확인하고 key/cleanup 코드 검토를 actual 증거로 부르지 않는다. EXISTING 소스 상세는 현재 표시하지 않는 선언이며 실제 경로 접근을 추론하지 않는다. served 반영·시각적 배치·단계/세션/Agent·전체 UI04는 미완료/미검증으로 유지한다. 이번 최종 검사 후에도 정확5파일/빈5폴더·QA process0 정리/독립 root부재를 확인했다.
- 실제 served/사용자DB·graph/단계 선택/대화·임무/FN09·시작/중지/FN08~13·전달/실제 Agent·IX02/Stage/사용자 인수는 미완료다. 경로는 향후 해당 후보 반영 뒤 `#/projects/<허용 프로젝트 ID>/workspace`, 목록의 ‘프로젝트 열기’다. 현재 서비스에서 이 새 화면을 사용할 수 있다고 보고하지 않는다.
- Main은 독립 finding을 대조하고 필요한 한정 보정/최소 검증·안전 checkpoint를 진행한다. 그 사이 native compile-01은 PRECHECK_BLOCKED, 고정3 OS HardLink 예외/new compile-only 결정은 별도이며 UI04로 덮거나 재시도하지 않는다. rollback은 이 후보만 정상 후속 commit에서 되돌리는 방식이며 DB/서비스 rollback은 필요 없다.

## 2026-10-18 후속 — 기존 소스 사용자 선언 연결

- Main 선정 UI04 미완료를 기존 승인 설계/계획과 기존 GET 계약 안에서 보완했다. 서버는 OWNER에게만 선언을 반환하고 VIEWER/HANDOFF_ELIGIBLE에게 null을 반환한다. 새 API/SQL/권한·서비스 변경은 없다. 현재 runtime678은 그대로다.
- 제품 변경 전: sourceDeclaration을 unknown으로 두고 표시/검증하지 않았다. 변경 후: 선언 필드·길이·불변 참조·USER_DECLARED/UNVERIFIED·정확 canonical SHA256와 모드/참여자 경계를 검사한 뒤 OWNER에게 접힌 상세 원문/버전을 표시한다. 다른 참여자는 원문 비노출 설명만 표시한다. 위치는 링크/실행 명령으로 사용하지 않고 실제 관측/쓰기·실행 권한이 아니라고 구분한다.
- unit 새3범주 중 정상1PASS/거절누락2RED→보완 후 같은 파일10PASS/271.4624ms·fail/skip0. 새 UI2는 요소 미구현으로2RED→화면 연결 뒤 UI04 직접5PASS/6.8s·fail/skip0, build124module/408ms·type/diff0. 기존 UI01/A3 검사 전수는 반복하지 않았다. >500kB·NO_COLOR 경고는 유지했다.
- 변경: workspace/api.ts·WorkspacePage.tsx, 직접 unit/UI04/context-api.test.ts·browser/UI04/workspace.spec.ts, 계획·현황·이 결과. 서버와 실제 인증/권한·DB·파일 관측은 변경/검증하지 않았다. 새부분은 Main 직접 검증이며 독립 재검수 완료로 쓰지 않는다.
- 전용 QA root의 모든 owner/nonlink·QAprocess0·5파일/5폴더 목록/hash를 대조해 정확 제거했고 별도 Test-Path false를 확인했다. 빌드 index C1FC8DFB48C23C16FCB04C22B94DE5FEBB1047E44E9360FE78B87C6CEB699E80 / JS3992D7DC7452A3159E95FE80300EE3AF53576A685AAFB887BD8DCF99D4D691E8 / CSS1FFC9B57199672473A5E3D572A73E4F36AECF4413E97F49C44C19D8C1E342D11. 재생성 가능한 임시 build/합성결과만 제거했고 기능 소스·실패동결자료·기존 서비스는 보존했다.
- 실제 served 반영·실계정/DB 여정·시각적 검수와 전체 UI04/Stage 완료는 미확인이다. 향후 해당 후보 반영 후 허용 프로젝트의 workspace→프로젝트 자료→‘기존 소스 사용자 선언’을 펼쳐 확인한다. 이번 후보를 현재 서비스에서 사용 가능하다고 보고하지 않는다. rollback은 이번 국소 소스 변경의 일반 후속 revert이며 DB/서비스 변경이 없어 해당 rollback은 없다.

## 2026-10-18 후속 — 주 작업 문서 조회 연결

- 기준50b03864·Main 단일 writer. 기존 listDocuments/readDocument와 file GET을 그대로 소비하는 WorkspaceDocuments.tsx를 추가하고 WorkspacePage.tsx의 자료 영역에 연결했다. 새 API/SQL/권한·서비스·Agent 실행은 없다. 적용 방법론 snapshot을 조회하는 API는 실제 없으므로 편집 정의를 적용본으로 대체하지 않고 별도 계약 결정에 남겼다.
- 명시 문서 조회→서버 cursor 다음 목록→선택한 조회 당시 head의 고정 버전→바이트 수·SHA256 검사→원문 텍스트 표시다. 문서 속 script/지시는 실행하지 않고 최신 실행/검증 상태로 승격하지 않는다. 새 목록부터 이전 목록/본문을 제거하고 거절·변조를 명확히 표시한다. unmount/선택 변경 뒤의 옛 응답은 무시하고 세션/user/client/project의 기존 Root key를 유지한다. 이 문서 버전에 저장된 단계 연결과 미연결을 구분하며 단계별 필터는 미구현이다.
- 새 UI3는 버튼 부재로3RED, 보완 후 변경영향 UI04 8PASS/8.0s·fail/skip0·새build125module/316ms·type/diff0. 제품/빌드가 같은 상태에서 cursor 다음 목록과 실제 digest 완료를 보류·해제한 옛 문서 지연 응답의 타프로젝트 무혼입만 추가2PASS/4.5s·type/diff0. 기대값 완화/기존 시험 삭제0이며 해당 최종2건 때 앞선8건은 반복하지 않았다. 합성 auth/API/원문 bytes만 사용해 실제 로그인·권한/DB/파일저장소 증거로 부르지 않는다.
- 직접 수정 시험은 UI04/workspace.spec.ts와 명시 QA root02 허용의 bundle.ts다. React 지침은 기존 API 직접 import와 좁은 조회 의존성/응답 폐기 경계에만 적용했고 의존성·최적화·구조 개편은 추가하지 않았다. >500kB·NO_COLOR 경고는 유지한다. 새 부분은 Main 자체 검증이며 독립 검수 완료 주장이 아니다.
- QA02 최종5파일/5폴더의 owner/nonlink·실경로/hash·관련process0을 확인해 정확 제거하고 별도 root 부재를 확인했다. index7FB04109C90DA67E9966F67EC90460BBC6C8E541F8A07F014F997284F9CE078A / JSA14FF1D5584AF9E3888867E2B7109D353870FE7F99BAAB129C57C4B09D522C1B / CSS1FFC9B57199672473A5E3D572A73E4F36AECF4413E97F49C44C19D8C1E342D11. 재생성 가능한 임시자료만 제거했고 원 실패 동결자료/기능 소스/기존 Node·relay·보호자료는 보존한다.
- 실제 served 반영·실제 자료 저장소/DB·로그인 여정·시각 검수/전체 UI04·Stage는 미확인/미완료다. 실제 서비스의 원문 보관소 설정 공백을 이 합성 시험으로 해소했다고 주장하지 않는다. 이후 반영된 후보의 workspace→프로젝트 자료→프로젝트 문서 조회→목록의 특정 버전으로 확인한다. 되돌리기는 이번 국소 UI/시험의 일반 후속 revert이며 DB/서비스 변경은 없다.

## 2026-10-18 후속 — 고정 적용 절차·단계 정의 조회

### 직접 승인 선택단계 문서 연결 후보 (최신)

- PMO AV3-PMO-UI04-STAGE-DOCUMENT-READ A는 신산님 실제 직접 ‘승인’이며 무응답 위임이 아니다. 기존 documents GET의 applicationId/nodeId 쌍 필터만 추가, actor/project/application/node/limit cursor결박·무필터응답/동작·회원/로그인/no-store를 유지했다. 현재회원·적용snapshot·문서head는 단일 CTE/LATERAL MVCC snapshot에서 읽고 반환전 기존과같은 snapshot/source/graph 검수·현재적용/정확node 대조를 거친다. 이 동일 검수 본문만 application-snapshot.ts로 추출해 기존 적용GET과 공유했으며 새SQL schema/도메인쓰기/권한은 없다.
- 화면의 로컬 정의 선택을 자료영역으로 전달하고 프로젝트/적용ref/선택node key로 목록·원문을 초기화한다. 명시 조회/다음cursor만 요청, 오류시 이전값제거·자동무필터/전체pagination없음, 기존 readDocument/bytehash 뒤 다른stage면 DOCUMENT_STAGE_CHANGED로 표시를거절한다. 문서누락은단계완료/안전판정아니며실제현재실행·세션/Agent는미연결이다.
- 새단위7범주중 미구현5RED/기존거절·무필터2PASS→최종직접/인접15PASS1656.2603ms·fail/skip0/type/diff0. 정상UI1건 버튼부재RED(기존15초)→신규3을포함한영향UI04 **20PASS19.3s/FAIL0/SKIP0/exit0**, build127module347ms다. 기존필터미연결 문구의기대1줄은승인구현전후에맞게갱신했으며기준완화/기존시험삭제·timeout연장0이다. 실제PG는아직미실행이며같은자료를반복시험하지않는다.
- 한정독립C0/I0/신규M1·정적후보한정채택가능. M1은409handler가query를기록하지않아이전handler의길이1만으로추가무필터재시도가없음을증명하지못하는시험관측공백이다. 실제제품fallback결함은발견되지않았고Main은Minor이월/제품·시험추가수정0으로판정했다. 기존두digestMinor도유지한다. Main판단유보는실PG문법/타입/MVCC·회원회수/RLS/성능, 실제로그인/served·지연요청/client교체, 전체UI04/Agent/사용자인수이며후속직접실행범위밖은미검증으로유지한다.
- 등록 ui04-stage-documents-01 최종5파일/5폴더·owner SINSAN\cyhuh/nonlink/관련process0 대조후정확제거·별도root부재0. index5A1F83EAB602C97004103D6F80A1AE721288B1DE31B83205A312A2CABCB7A77B/JS C6EEC7A1E22E6493B50C54356B2AB00C201A8701A3FFE7C96C1E087FCCFFF21F/CSS1FFC9B57199672473A5E3D572A73E4F36AECF4413E97F49C44C19D8C1E342D11. 기존실패자료/소스/서비스·DB/보호자료보존이다. 실제PG metadata합성시험12표의이름·수명/정확정리는WORK_STATUS에사전등록했으며검수/clean/private뒤실행한다. rollback은국소API/UI/시험의후속revert, schema/서비스변경없음이다.

### 선택한 단계의 고정 양식 원본 연결 후보

- 한정 독립결과 C0/I0/신규M0: 검수자는 새양식읽기 경계의 코드/직접시험을 읽었고 제품/시험/자원 변경0이다. Main은 이 범위만 채택한다. 실제served/API·DB권한, 원문hash재계산 무결성, 실제 지연 양식요청/사용자-client교체, 전체UI04/Agent 수용을 미검증·후속실연결 대상으로 남긴다. key/current 정적 방어·현재합성시험이 이를 전부 증명하지 않으며 기존 두digest Minor는 유지한다.

- Main 선정 UI04 입력/출력 양식 원본 읽기다. 새 WorkspaceForm.tsx는 기존 getPinnedForm/GET만 명시 클릭으로 소비해 정확 ref의 항목/필수·반복 필드·작성/검수 규칙·작성 역할/선행 자료·공통 기준을 텍스트로 표시한다. WorkspaceMethodology의 단계·입출력·item/ref key로 이전 양식 화면을 분리하고 재조회 시작/거절/다른 버전이면 이전 본문을 치운다. API/DB/권한·서비스·문서작성/확정·Agent 변경0이다.
- 직접 browser/UI04 새3범주(정상 고정 원문/단계전환 제거,403,다른버전)를 추가했다. 구현 전 정상1건은 양식버튼 부재로 기존15초상한에서 RED, 연결 후 영향범위 **17PASS/18.7s/FAIL0/SKIP0/exit0**·type/diff0·build127module428ms다. 다른 새2건의 구현 전 별도 RED나 실제DB/served 증거는 주장하지 않는다. 기존실제PG/컴파일러·전체Stage 검사 반복0,500kB/NO_COLOR경고는 유지했다.
- 합성API/Edge만이며 실제 사용자 세션/양식 원문 접근·서비스 반영은 미확인이다. 기존 getPinnedForm은 정확 ref/표시구조 대조이지 클라이언트의 원문bytes hash재계산 증거가 아니다. UI도 조회를 단계 산출물 확정/현재 실행준비로 승격하지 않는다. 독립검수는 기존검수자에게 이 새읽기 경계만 의뢰했으며 현재 제품동결/판정대기다. 기존 두digest Minor는 고치거나 새PASS로 덮지 않았다.
- 등록 D:\tmp\anvil-v3-stage-b\ui04-forms-01의 최종5파일/5폴더(owner SINSAN\cyhuh/nonlink/관련process0) 대조 후 정확개별정리·별도부재 확인0이다. index B3D274A6EEFF9272F279986F02FFA21A4A547FB35B68EE1DD31E49C92810C775 / JS A4F3FA23D95C649C397D6CD6D7FA2A628A2AA37AA5D84B46C11E48B5CAF2EB72 / CSS1FFC9B57199672473A5E3D572A73E4F36AECF4413E97F49C44C19D8C1E342D11. 시험결과 metadata와cv_debug.log만 함께제거, 기능소스/기존실패동결/서비스/보호자료보존이다. rollback은이번UI/직접시험의일반후속revert며DB/서비스rollback없음.

### 정식 WSL PostgreSQL 핵심 확인 (후속)

- 정확 후보8c539c7a206bc5be1bf221d55f44ede3b5adb5b7(제품은683ec950과 동일), 시험 SHA256 d46a177ffe5a9c90be0f006ee0afed378e7b3662d51e260b70c6e491526e6b98. 정식 /home/daon/deploy/anvil-v3 clean·Git origin 승인URL·Node24.21.0·package/lock/migration 집합 불변을 확인했다. 초기 development remote 추정은 fetch 전 중단→실제origin을 읽어 정정했으며 설정 변경0이다.
- 실제 명령: 보호 app/migrator 참조와 APPLICATION_READ_01·등록기한을 지정한 `node --test --test-reporter=spec tests/integration/FN02/application-read.test.ts`. **1PASS/FAIL0/SKIP0/exit0, case1767.749362ms·전체2410.818229ms**. 10조건은 OWNER/VIEWER 고정본/no-store, 미적용null쌍, 타project/없는/회수회원404, query400, 실제 Web조회함수↔PG ref, 최신행/두GET경합과 재조회, snapshot변조503, 만료401, 옛credential401, domain명령·control·dispatch쓰기0이다. 비관리자/rolsuper=false/rolbypassrls=false를 확인했지만 RLS 정책 전체 검증으로 부르지 않는다.
- 합성 seed는 고정 사용자2/프로젝트3/적용본3과 연결자료만 사용했다. 실제 applyMethodology 전환·사용자 UI 여정이 아니며 제품 변경/강제 RED 복원/기존검사 반복0이다. 시험 finally 정확8표 정리 후 독립 **BEGIN READ ONLY** 조회도 각0·migration46, 전체 migration ID/checksum 전후 동일. auth audit identity 순번은 reset하지 않았다. 새 OS 파일/서비스/port/권한/Secret파일·Agent·추가compiler0이다.
- 전용 PG ID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba/image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f/StartedAt2026-10-15T18:53:33.435483583Z/restart0 불변. WSL app.json hash56af9676…17299/migrator.json a78daab0…6497 전후 동일, Windows auth/db-app/N4receipt3hash 기대값일치·Node54212/relay26052 exe/start/단일127.0.0.1:3830 불변이다. 최초 PowerShell 혼합표의 누락표시는 구조화출력과 기대값검사로만 보완했으며 DB 시험은 반복하지 않았다.
- **미검증/판정:** 실제 PG 회원·인증거절/조회무결성은 이 범위에서 확인했다. 실제 socket HTTP/TLS·브라우저/현재서비스 반영·RLS전체·양식 현재 접근/확정·실제 세션/단계 수행/Agent·전체UI04/Stage 완료는 아니다. 기존 두digest 시험증명 Minor는 유지하며 실제 혼입결함으로 단정하지 않는다. rollback은 source 국소 후속 revert, 이번 합성자료는 정리됐고 기존 서비스/DB schema는 그대로다.

- 안전 checkpoint: 683ec95065ce46110b47f2a5609c6f849c7d1168, 부모5a488f8f·정확14경로·private branch 동일/clean·main f976ed5e 불변. 이후 제품수정/완료검사 반복 없이 실제 PG 핵심조회용 직접 integration1건을 준비한다. WORK_STATUS에 등록한 고정 QA 사용자2/프로젝트3/적용본3·연결자료8표만 사용/정리하며, 새 서비스/파일/권한·schema/Secret0이다. 타입 검사는0이고 actual은 아직 미실행이다.

- 기준5a488f8f9f8287195c96a604d33de413bd99537d·Main 단일 writer. 별도 PMO 결정 AV3-PMO-UI04-METHODOLOGY-APPLICATION-READ A(사용자게시20:59:26Z→21:11:46Z/12분20초·최신5turn 새중지/답변없음 확인)에 따라 INTERFACES의 새 읽기 GET을 구현했다. 현재 로그인/회원·격리·no-store와 기존 거절을 유지하고 기존 project_methodologies 최신1행의 row/source/snapshot/graph hash·고정 그래프 구조만 읽는다. 새 SQL/도메인쓰기·적용 전환·권한/Secret·서비스/Agent 실행은 없다.
- 적용ref와 원 정의ref를 구분하고 기존 project GET 참조와 정확 일치할 때만 UI04 왼쪽에 단계·연결/분기 조건·입출력 양식참조·완료/승인/상황기록 정의를 표시한다. 로컬 단계 선택과 실제 실행/세션/현재 진행 상태를 분리한다. 불일치·변조·거절은 앞선 절차를 치우고 실패/프로젝트 재조회를 요구하며 편집 정의 fallback/자동 적용0이다. 양식 참조의 고정 구조 검수는 현재 원문 접근·확정/실행 준비를 증명하지 않는다.
- 변경 제품: server methodologies/project-methodologies.ts 새readApplication·projects/routes.ts 새route, web workspace/api.ts 새readWorkspaceMethodology·WorkspaceMethodology.tsx·WorkspacePage.tsx 연결. 직접 새서버/클라이언트 시험과 browser/UI04 새4건·QA03 선택만 보완했다. 기존 문서/소스 선언·서버 변경 명령은 수정하지 않았다.
- 서버 신규6의 첫 실행 중5건은 메서드 미구현으로 분기 미도달, route1건은 실제404vs401 RED였다. 구현 후 신규6+단계참조/방법론입력 인접4=10PASS/1158.0212ms·fail/skip0. client5도 초기 진입함수 미구현과 구현 후5PASS/234.14ms를 구분한다. fake SQL transport는 쓰기SQL을 거절하며 Fastify inject는 실제 신규 등록·401/403/400/no-store를 확인하지만 실제 DB/RLS/세션을 검증한 것은 아니다.
- 새 UI 정상1은 버튼 미구현 RED→변경영향 UI04 전체14PASS/12.5s·fail/skip0·build126module/309ms·type/diff0. 새4건은 정의/로컬 선택·두조회 사이 ref변경/내용제거·snapshot변조/fallback없음·실digest 보류/해제와 이후timer/2frame까지 기다린 옛적용본 타project 무혼입이다. synthetic auth/API/snapshot뿐이며 실제 권한/DB·served/Agent·시각 검수로 승격하지 않는다. 기존 A3/전수 시험은 반복하지 않았다.
- QA03 준비1회는 UTC DateTime Kind 비교 차이로 생성전 차단되어 자원0이었다. 같은 절대창을 DateTimeOffset으로만 고쳐 진행했다(연장0). grep의 전체제목 접두사1회 미수집은 RED/PASS가 아니며 같은 빌드에서 제목 검색만 정정했다. 문서header 추정 patch1회는 적용전 거절→실제header 대조 후 한정 삽입, 기존 기록을 보존했다. >500kB·NO_COLOR 경고는 유지했다.
- QA03 최종5파일/5폴더·owner/nonlink/목록/hash·관련process0 대조 뒤 정확 제거하고 별도 root 부재를 확인했다. indexAFA8935494BDED347652BEFE00D5B22769CDC5746F13811D582ABCF7BAE5B779 / JS594C504218B31E999B8D31389CC8A99104DAD6FEC705B75449F4C058E5D4F723 / CSS1FFC9B57199672473A5E3D572A73E4F36AECF4413E97F49C44C19D8C1E342D11. 기능 소스·원 실패 동결자료·기존서비스/DB/보호자료는 보존했다.
- 새 공개 읽기 계약의 권한·무결성/조회 경합·옛응답/시험 경계만 기존 read-only 검수자가 한정 검토하여 **C0/I0/M1·정의 조회 후보 한정 채택 가능**으로 판정했다. 실제 WSL/DB·로그인·서비스 반영·양식 원문 접근/현재 유효성·실제 책임세션/진행·단계 문서 필터/Agent·전체UI04/Stage는 미완료/미확인이다. 그 범위를 한정 검수로 승격하지 않는다. 이후 실제 반영된 후보의 workspace→적용 절차 조회→정의 선택으로 확인하며, rollback은 이번 국소 API/UI/시험의 일반 후속 revert다(새 DB/서비스 변경 없음).
- 이월 Minor: 새 옛적용본 음성은 snapshot digest 한 개 반환 뒤 timer/2frame을 기다리지만 제품 Promise.all의 graph digest 완료까지 보장하지 않는다. 실제 혼입 결함 발견은 아니며 두 digest 전체와 후속 소비 완료의 결정적 증명으로 부르지 않는다. 앞선 ‘digest 완료를 기다렸다’는 범위를 이 한계로 정정한다. Main은 경미 시험 증명 한계로 기록하고 기능·기준을 변경하거나 전체 검사/재검수 반복을 하지 않았다.
- 판단 유보에 대한 Main 처리: 실제 PostgreSQL/RLS·동시 적용 변경·로그인/served 경계는 실제 WSL 고위험 핵심 검증 전까지 미확인(클라우드로 넘겨 완료 처리하지 않음), user/client 실제 교체 여정은 기존 key 정적 검토와 구분해 미확인, 모든 JOIN/REWORK 시각·양식 원문 현재 접근/확정은 전체 UI04/관련 화면의 남은 확인, 실제 진행·세션·시작/Agent는 FN08~13/IX02~03 미구현·부분 구현에 남긴다. 작성자 PASS/정리 증거의 독립 재현은 이번 검수 범위 밖이고 Main의 실제 명령 관측과 구분한다.
