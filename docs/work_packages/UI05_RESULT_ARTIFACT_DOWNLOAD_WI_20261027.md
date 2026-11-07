# UI05 등록 산출물 원본 다운로드 연결 WI

2026-10-27 · Main 어울 · WORK_PLAN Stage C UI05/FN12·기준 codex/av3-stage-b 20a807dd28fa5f537f8ac06fa004902220b0b567.

## 목적·현재 공백·결정
기존 ResultArtifactTexts는원제출 artifactRefs에결박된UTF-8텍스트/Markdown2MiB조회만제공한다. 같은결과의등록PDF/이미지등원본을받는사용자동작은없다. 이미있는INTERFACES의보호GET /api/v1/projects/:projectId/files/:artifactId 와 project-files.ts의현재인증/회원·격리/보호store bytes/hash검사를그대로소비한다. 새API/schema/권한/서버판정/실DB/서비스/Agent효과0이며기존승인계획안의미연결기능구현이다.
Ruling: 기존server의attachment/octet-stream을명시클릭으로bounded수집·선택fullref SHA256대조후파일다운로드로만연결한다. HTML/PDF/image미리보기·자동실행·새다운로드API/영구저장0. 실제파일이선택결과에선언됐는지와원본일치는검사하되결과주장·시험PASS/업무완료로승격하지않는다.

## 단일 writer 허용 정확6파일
1. apps/web/src/features/session-detail/result-artifact-api.ts
2. apps/web/src/features/session-detail/ResultArtifactDownloads.tsx (신규)
3. apps/web/src/features/session-detail/ResultReviewSources.tsx
4. tests/unit/UI05/result-artifact-download-api.test.ts (신규)
5. tests/browser/UI05/result-artifact-download-dom.test.ts (신규)
6. tests/browser/UI05/result-artifact-download-dom-harness.tsx (신규)
기존텍스트조회함수·UI08 ReportedResultIssue 소비는보존하고새다운로드component는UI05 ResultReviewSources에서criteria.session과함께명시연결한다. 공용ApiClient/서버/계약/SQL/다른화면/CSS/기존시험/보호8/PG·Node신뢰준비파일/approval/marker는수정0. Main은WI/현황/QA등록/결과/Git만관리한다. 새branch/worktree/채팅/자동화/임의commit/push0.

## 동작·검수 경계
- 원선택결과의projectId/ref/불변snapshot/hash(기존2MiB경계)와manifest.artifactRefs의단1동일id/version1/contentHash를복제·대조한다. 다른결과/미선언/중복/불일치·불지원version이면GET0. 표시path/filename/사용자입력URL로파일에접근하지않는다.
- 고정상대GET·credentials same-origin/redirect error/no-store/Accept octet-stream. 현재client.transport를사용하되서버실패를성공/빈파일로바꾸지않는다. 401/403/404를기존auth/access콜백과연결하며raw본문/원오류/헤더파일명을출력하지않는다. 412/기타오류도명시실패·자동재시도0이다.
- 원파일20MiB기존상한을header유무와무관하게stream누적검사한다. body/read오류·크기초과·UTF8가아닌데텍스트로변환·무한arrayBuffer수집을성공으로만들지않는다. 수집byte의SHA256은선언fullref와일치해야한다. binary/빈파일/상한은형식/내용을바꾸지않고지원한다. 실패·이탈은reader.cancel/release,응답무시를사용한다.
- 버튼은각선언ref의명시클릭에만GET. 자동load/원본다운로드는0이고기존텍스트보기는별개로유지한다. 생성하는파일명은검증UUID의artifact-ID.bin, Blob octet-stream·a.download로만보내며외부URL/inline/실행0. URL·임시DOM은자신이만든것만해제한다. 웹화면은브라우저에요청했다는상태만표시하며디스크저장성공을확정하지않는다.
- 컴포넌트는session user/client/필요한세션변경·ApiClient/transport·project/결과fullref·선택ref/요청generation을결박한다. 주체·결과·선택A→B→A/transport변경·unmount·권한거절뒤늦게도착한응답이파일/성공표시를만들지않는다. 현재선택이아니면새선택으로대체하거나다른파일을다운로드하지않는다. 원선택과대기/오류상태는구별한다.
- 기존결과화면의작업동선/스타일·표준font/접근성역할/키보드focus를유지한다. 새구조개편·꾸밈·원래설명/데이터변경0. 상태설명은짧게·오류는대상동작과복구방법을알린다. 수행자자료임을원문보기와같은경계로표시한다.

## TDD·선택 검증
TEST_ONLY먼저신규명시unit에입력/선택/manifest/hash·bytes/integrity·401/403/404/412·20MiB/초과·오염ContentType/stream실패·이탈을고정한다. MainfreshRED전제품3파일작성/수정0. 기존text ARTIFACT_TEXT3의기대는보존한다.
source작성뒤신규directunit·인접 result-artifact-api.test.ts·type/구문/변경Web메모리build·diff를선택수행한다. 실제UI검수는신규DOM파일만이며실제ResultReviewSources/새component/ApiClient·주입합성transport·설치msedge/headless/1920×1080에서명시선택→실제browser다운로드event/bytehash·오류/선택·주체전환을확인한다. fixture/소스기능과정식DB/API/served/실사용자/모바일의미검증을구분한다. 다른완료시험/전체회귀/PS/C#/실Agent/실DB는실행0.
DOM QA literal은 D:/tmp/anvil-v3-stage-b/ui05-result-artifact-download-20261027-01 이며Main의생성전등록/부재·owner·realpath/nonlink확인전브라우저실행0. 하위temp/browser/downloads/results만·TEMP/TMP=root/temp·실제filedownload는합성bytes만등록root에보관. 최초생성부터30분·개별60초/browser15초·retries0/worker1·전체10분·trace/video/screenshotOFF기본,검수용화면관측이필요하면Main이정확파일을추가등록한다. 성공/실패모두관련Node/msedge종료→owner/link/inventory→소유파일·빈dir개별정리→별도root/process부재. 불명은보존/보고·다른process/파일일괄삭제0.
담당은이번단계에서코드/합성unit/type/메모리build만수행하고DOM자원은준비만한다. Main이등록뒤직접실행을관리한다. 기존DOM/브라우저검사반복·negative test-name필터·실서비스접속0.

## 보고·복구
한번에한code writer·Main제품수정0. 제출은허용6파일rawhash·diff·정확명령/exit/실제결과·유효실패fingerprint/횟수·NOT_RUN·남은scope·rollback을구분한다. 독립검수는수행자와분리한다. 완료된기능반복이나합격기준완화0. 실제API/DB/사용자인수·전체UI05/FN12/계획은이번합성만으로완료가아니다. rollback은소유source의정상revert이며저장원문/PG/권한/승인기록삭제0이다.
