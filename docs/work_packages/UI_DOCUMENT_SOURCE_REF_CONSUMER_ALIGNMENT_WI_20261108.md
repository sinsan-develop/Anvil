# 문서 출처의 기존 UI 소비 정합화

상태: 구현 배정. PR69의 main e9d0c132816eb54ef3554a8d2fc8071da41016d0에서 codex/av3-document-source-consumers를 생성·즉시 원격 게시했다. 앞 proposedContent 업무의 검수·병합·merged smoke36PASS·완료 branch 정리를 마친 뒤 기존 Primary 한 명에게 순차 배정한다. 별도 새 공개상세 A 결정과 독립이다.

## 기존 계약과 실제 누락
PR68로정상문서에4종sourceRefs가보존되지만UI07의 readChangeRequestDocumentSource/storedChangeDocumentSource는비어있지않다는이유로거절한다. 서버FN04의DOCUMENT_VERSION출처계약은문서/version/hash·원문을보호검산하며문서자체출처의빈배열을요구하지않는다(INTERFACES370). UI06 MaterialLibrary의import사용문서원문도실제content.sourceRefs를버리고빈배열로hash를재구성해정상문서를거절한다. 이는기존문서전체content계약소비누락이며새출처·정책을만드는업무가아니다.

## 정확 후보 소유
제품3:
- apps/web/src/features/design-change/change-request-document-source.ts
- apps/web/src/features/design-change/stored-change-document-source.ts
- apps/web/src/features/design-trace/materials-api.ts
시험3:
- tests/unit/UI07/change-request-document-source.test.ts
- tests/unit/UI07/stored-change-document-source.test.ts
- 신규 tests/unit/UI06/import-usage-source-refs.test.ts
정확경로는Main19d55d의rg --files로확인했다. 배정시같은파일인지재검산하며추측경로에서수정하지않는다. Main문서외코드동시쓰기0/다른담당자변경되돌리기0이다.

## 구현·검증
1. 기존readDocument의strict4종/분리열·content hash검산을그대로사용하고정상content전체를기존documentDraftHash로대조한다. refs를빈배열로치환하거나문서의출처를설계변경요청출처에자동병합하지않는다.
2. 변경요청의정확출처귀속·원source kind/id/version/hash와공개보호GET·current/late/선택ABA·원본문무결성조건을유지한다. 새역조회/권한/endpoint·SourceRef필드0이다.
3. import사용문서는기존candidate ID·원original첨부·정확명시선택/문서version·사용자scope를보존하면서실제content refs로hash를계산한다. 미채택ImportCandidate.sourceRefs상세를열거나그필드를가정하지않는다.
4. 먼저현재정상비빈4종문서를선택/보관재조회/사용문서원문보기에서거절하는RED를재현한다. 정상4종과빈배열,refs/hash·추가키/종류오염·타대상/귀속누락/교차scope·late/ABA 본문0·후속GET0을새/기존실helper로검산한다. 그냥length검사를삭제해오염도통과시키지않는다.
5. 실제메뉴를새로설계하지않고기존DesignChangeRequest→helper,StoredChangeSources→helper,MaterialLibrary→helper 소비를유지한다. browser import-usage-original.spec.ts는현재코드/패턴읽기근거이며실served환경없이실행PASS로기록하지않는다.
6. 실제DB/키/권한/서비스·Agent/SSH/실자료조사는제외하고제품/시험읽기·코드·합성transport검증만허용한다. proposedContent의현재다른writer파일·native0072의명시빈refs제약·context/knowledge/backup의이미정상인경로는수정하지않는다.

Primary집중/직접인접/typecheck·diff,Main필요Webmemorybuild/독립검수·통합을분담한다. 정확명령·exit·RED/GREEN·오류·동결SHA·미검증·writer반환을보고하고통과기준/기존assert를몰래완화하지않는다. source·합성검증은실DB/served브라우저·전체Stage완료가아니다. 승인된기존범위의검수/게시/PR/main/mergedsmoke/정리후다음미완료업무를이어간다.

## 인수·검수 기준 보강
기존 Primary 읽기에서 정상4종 fixture는 content.sourceRefs와 반환 sourceRefs를 함께 넣고 canonical hash를 재산출해야 실제 소비자 RED임을 확인했다. UI07 보관 fixture는 문서 source hash→변경요청 hash→영향 원장 hash 관계도 정확히 만든다. 기존 오염 사례와 [] 정상은 그대로 유지한다. 직접 인접은 UI07/design-change-request.test.ts, UI07/stored-change-sources-view.test.ts, UI06/import-api.test.ts에서 영향을 받는 범위만 실행한다. 기존 view 표시는 실제 클릭이나 served 브라우저 증거가 아니다. 준비 WI40573b9b…135e7a 독립C0/I0/M0를 재사용하고 이번 기준선/배정·fixture검산 명시는 기존 범위의 비의미 실행 구체화다.
