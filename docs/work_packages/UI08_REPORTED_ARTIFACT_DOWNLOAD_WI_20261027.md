# UI08 중요 문제 보고의 등록 원본 다운로드 WI

2026-10-27 · Main 어울 · WORK_PLAN UI08/FN12의 근거 확인 · branch codex/av3-stage-b / 기준585ea34ae4704621634a4db7b6dad125cbca4231.

## 목적과 범위
읽기검수는 App→ApprovalsPage(session 보유)→ReportedResultIssue에서 마지막session전달과보관결과의원본다운로드만미연결임을입증했다. SCREEN_WORK S08은정확범위/영향/근거확인을요구한다. 보고를검토하는자리에서PDF/이미지등등록원본을받도록기존 ResultArtifactDownloads를재사용한다. 기존텍스트보기/문제원문/승인·거절입력은보존한다. UI05기능/byte엔진·서버API·schema·권한·공용client를새로만들거나다시수정하지않는다.
Ruling: 현재DocumentSession을실제상위호출에서전달하고,검증된shown.value가있을때만원본component를연결한다. session/client/transport/선택문맥이바뀌면이전보고원문을회수하여재조회전파일동작이불가능하도록한다. 승인/분류/제어전환·Agent행동은추가하지않는다. 이는승인된계획안의내부화면연결로새사람승인질문이아니다.

## 단일 writer 허용 정확5파일
1. apps/web/src/features/decisions/ApprovalsPage.tsx
2. apps/web/src/features/decisions/ReportedResultIssue.tsx
3. tests/browser/UI08/reported-issue-artifact-dom-harness.tsx — 기존호출에필수session fixture전달만,기존시험/행동기대보존
4. tests/browser/UI08/reported-artifact-download-dom.test.ts (신규)
5. tests/browser/UI08/reported-artifact-download-dom-harness.tsx (신규)
실제파일명은ApprovalsPage이며가칭DecisionsPage를추정읽지않는다. UI05제품/단위/기존DOM·서버/SQL/권한/다른화면/CSS/P03후보/approval/소비기록/보호8·정본현황을담당이수정하지않는다. Main은WI/QA/결과/계획/현황/Git만관리한다. 새branch/worktree/채팅/자동화/commit/push0.

## 동작·검수 기준
- ApprovalsPage의현재session을ReportedResultIssue로정확전달한다. 하드코딩/다른역할/클라이언트·임의현재사용자추정0. 필수session prop을추가해모든실소비선을typecheck하고현재실호출목록밖으로범위를확장하지않는다.
- 기존검증된선택결과shown.value에서만기존ResultArtifactDownloads에client/result/session과동일auth/access회수callback을전달한다. 자동다운로드/다른결과·파일대체·inline0. 정확원본확인후버튼이명시클릭에만기존보호GET을한다.
- ReportedResultIssue의문맥키에현재session의user/client/세션표식과client/별도보관transport를반영해선택/주체/transport A→B→A도이전원문을유효하게하지않는다. 재조회전원본영역숨김·pending/거절/닫기/unmount지연응답의다운로드0. 원문재조회·현재권한/해시검사는보존한다.
- 다운로드401/403/404는기존callback을통해보고원문과파일동작을회수·401은인증상실연결한다. 412/hash/type/loss도실패를성공/빈파일로바꾸지않는다. useraction/재조회없이자동새GET/재시도0. error원문·Secret·임의URL을보여주지않는다.
- UI05에서검수한20MiB/byteshash/원본선택엔진은그대로소비하며같은단위검사를반복하지않는다. 새시험은UI08상위session연결·보고원문과같은결과/권한거절회수·주체/선택/transport·닫기/이탈늦은응답만검사한다. 기존텍스트경로가남고다운로드가자동시작되지않는인접회귀를같은UI08흐름에포함한다.
- 기존UI08문제원문/승인·거절입력/순서·접근성/스타일을유지한다. 새모니터링/현재원인확정/완료판정·기본보고분류추가0. 수행자등록원문은근거열람일뿐실행/시험PASS/승인완료로승격하지않는다.

## TDD와 QA
TEST_ONLY먼저신규DOM test/harness2파일만작성한다. 실제 ReportedResultIssue·ApiClient와주입합성기존GET응답을사용해원문조회성공뒤등록원본다운로드영역/명시다운로드를기대하며현재제품미연결에서RED가나야한다. 기존harness fixture/제품2는MainfreshRED전변경0. 타입선행에서미래privateprop 때문에실패하는것을실동작RED로대체하지않으며Vite메모리transpile로실제기존parent를검사한다.
DOM은설치Edge/headless/1920x1080·메모리Vite/기존tokens.css+app.css 메모리적용·dummyhttps문서만허용·외부요청/pageerror0·합성파일만. 새 test는실제downloadevent·saveAs byteshash/기존텍스트·권한회수·지연/문맥ABA·닫기/unmount를검사한다. App→ApprovalsPage실session전달은type와정적호출선검수로별도증명하며위젯검수만으로전체승인화면의실DB여정을PASS로부르지않는다.
등록literal D:/tmp/anvil-v3-stage-b/ui08-reported-artifact-download-20261027-01 / ownerSINSAN/cyhuh. root/temp/browser/downloads/results만Main이생성전부재/부모·실경로/소유/link를확인해만든다. ENV ANVIL_UI08_REPORTED_ARTIFACT_DOWNLOAD_DOM_QA=1·TEMP/TMP=root/temp. 최초생성30분·시험60초/browser15초·전체10분·retries0/worker1. 실서비스/실DB·Secret·사용자브라우저/Agent/PS/C#/새OS도구0.
Main등록전브라우저/QA생성0. RED실행후에도정확소유정리/독립부재확인뒤제품GO이며GREEN은새빈instance에서실행한다. Root경로는같되생성시각/inventory를각instance로기록하고기존존재시재사용0. 정상GREEN영역PNG1개만results/ui08-reported-artifact-download.png로허용·trace/video/다른스크린샷0. 성공/실패모두context종료→관련Node/Edge0/owner/nonlink/inventory→등록파일/빈dir개별정리→별도root/process부재,불명보존/보고·공유processkill/일괄recursive delete0.

## 검수·보고·복구
같은writer가허용5만수행하고Main제품직접수정0. freshRED/정확자료제출뒤MainGO에서만구현한다. type/메모리Web·신규DOM build/변경diff를선택하고UI05완료14검사를반복하지않는다. 기존UI08harness의session fixture 보완은기대·행동불변을읽기대조하고필요회귀만선정한다. 동결rawhash/전후diff·명령/exit/실제결과·오류/NOT_RUN·QA생성0를보고하고독립검수후Main이실브라우저/Git통합한다. 실제API/DB/served/모바일/사용자인수·전체UI08/계획은미검증으로남긴다. rollback은소유화면연결/시험의정상revert이며보관원문/DB/권한/승인·소비기록삭제0이다.
