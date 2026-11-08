# UI06 문서 전체 출처 명시 선택·저장·고정 조회 연결

상태: 준비안 / 서버 FN03 sourceRefs 인수 후 단일 Primary 순차 구현. Main은 검수·통합한다. 같은 codex/av3-fn03-document-sources 업무에서 서버와 화면을 연결한 뒤 통합하며 기존 구현을 되풀이하지 않는다.

## 기존 근거와 목표
INTERFACES600~675의 기존 SourceRef4종/DocumentContent/save/get를 소비한다. 기존문서·고정version조회,대화방/발언보호조회,보관import의READY텍스트원본선택이 이미 있다. 새endpoint·SourceRef필드·권한·지식쓰기/대화쓰기·upload를추가하지않는다. 문서전체출처이며항목별attribution·검토evidenceRefs·import/proposal의출처저장확대는이번업무아니다. 모든READYartifact의일반목록이있다고가정하지않고현재선택가능범위를화면에정확히표시한다.

## 정확 후속 소유
서버제품3/시험1을동결·writer반환한뒤아래8파일만순차Primary가소유한다. Main문서와다른담당자의변경을되돌리지않는다.
- apps/web/src/features/design-trace/editor-api.ts
- apps/web/src/features/design-trace/api.ts
- apps/web/src/features/design-trace/DocumentEditor.tsx
- apps/web/src/features/design-trace/DocumentsPage.tsx
- 신규 apps/web/src/features/design-trace/document-source-refs.ts
- 신규 apps/web/src/features/design-trace/DocumentSourceRefs.tsx
- 신규 tests/unit/UI06/document-source-refs.test.ts
- 신규 tests/unit/UI06/document-source-refs-ui.test.ts
필수추가경로가확인되면수정전Main에근거를반환한다. 실제DB/키/권한/서비스/Agent/SSH/실자료조사는제외하고제품/시험읽기·코드·메모리DOM·합성HTTP만허용한다.

## 화면과 동작
1. 기존문서편집기에서사용자가출처종류를선택한다. 문서목록→정확version보호조회로응답id/version/hash를선택하고현재head로자동대체하지않는다. 대화방→발언목록→실원문보호조회후SourceRef를선택한다. USER_INSTRUCTION은실제지시종류일때만선택가능하다. UUID/hash수기입력을정상사용흐름으로대체하지않는다.
2. 파일은기존보관import의READY텍스트≤2MiB와보호원문읽기를재사용한다. 모든파일형식/모든READYartifact탐색을지원한다고표시하지않는다. 보호조회실패/격리·불일치에는선택상태를만들지않고이유를기존오류표시로보인다.
3. 선택출처목록은종류/고정버전/사용자확인가능이름과명시해제로구성한다. 최대200/중복거절·exact4종형상을보존한다. 기존본문/첨부/양식/단계선택은유지하고새화면테마·dashboard·구조개편은하지않는다.
4. buffer.content.sourceRefs와pending고정사본·savecommand body/hash/정확UUID의명령결박을끝까지연결한다. pending/UNKNOWN/import/proposal이동작중이면선택변경을차단하고원packet을보존한다. 결과불명에서자동추가POST/새명령/재업로드를하지않는다.
5. 저장뒤기존readDocument가content와별도sourceRefs의형상/동일성·contentHash를검산한고정결과만표시한다. 출처목록·명시원문보기에서주체/client/project/generation/transport변경과선택ABA·늦은응답을차단한다. 대화sourceRef에conversationId가없으므로새자동역조회API를가정하지않는다. 필요한대화방을명시선택한뒤정확발언ID/hash를검산하며지식전용GET을문서참조에전용하지않는다. 무조건hover/렌더시에원문을자동수집하지않는다.
6. 기존API·same-origin·CSRF/권한·정확버전/문서출처분리열검산·명령재확인·양식/첨부/본문/확정동작은보존한다. 새검토/확정·실행권위나자동저장으로확대하지않는다.

## TDD·검증·증거
서버의고정4종문서GET/선택결과를현재Web판독/편집버퍼가거절하는RED부터재현한다. 정상4종선택→동일refs를savecommand에저장→고정GET표시를실제컴포넌트메모리DOM/기존합성transport로검산한다. hash/종류위장·추가키·중복·교차프로젝트·late/ABA/주체변경·UNKNOWN원packet보존·자동POST0·기존빈refs와문서편집직접인접을포함한다. 준비용가짜UI/제품export는추가하지않는다.

Primary가직접·필요인접/typecheck,Main이필요Web build를분담해중복실행하지않는다. 시험을지우거나기대값을낮추지않고원기준과달라져야하는부분은변경이유와원/새assert를명시한다. 동결파일/해시·실행명령/exit/오류·미검증과writer반환을보고한다. source/합성DOM은실DB·served브라우저·사용자인수/전체FN03완료가아니다. 서버+화면독립검수후commit/privatepush→PR필수검증→main→merged한정smoke/정리로진행한다.
