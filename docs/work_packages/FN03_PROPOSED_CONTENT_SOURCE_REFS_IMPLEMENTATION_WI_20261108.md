# FN03 제안된 문서 내용의 출처 보존 구현

## 근거·목표·허용
현재main339fdad926f9a0ad2593cfe75dd71758cda9d2c3/branch codex/av3-fn03-proposal-content-sources. INTERFACES603의DocumentContent.sourceRefs와657의제안상세proposedContent/정확반영에이미있는4종출처를 prepare→store→상세GET→명시선택→문서GET까지연결한다. 최상위payload.sourceRefs=[]의기존제한은유지한다. ImportCandidate/Proposal자체의새상세sourceRefs는미채택패킷e59592e3과별개이며그결정을기다려현재업무를멈추지않는다. 새공개필드·endpoint·SQL/migration·권한/비용목적0이다.

기존Primary단일writer/Main관리·검수·통합. 제품/시험읽기·코드·합성HTTP/메모리FS·DOM만허용,실제DB/권한·키·서비스·Agent·SSH·사용자자료조사는제외한다.

## 정확 쓰기 소유
제품4:
- apps/server/modules/documents/project-proposals.ts
- apps/server/modules/documents/project-documents.ts
- apps/web/src/features/design-trace/proposal-api.ts
- apps/web/src/features/design-trace/DocumentEditor.tsx
시험3:
- 신규 tests/unit/FN03/document-proposal-content-sources.test.ts
- 기존 tests/unit/UI06/proposal-api.test.ts
- 신규 tests/unit/UI06/document-proposal-content-sources-ui.test.ts
공통SourceRef판독기/SourceRefs선택컴포넌트는재사용하고임의수정하지않는다. 필수추가경로는쓰기전Main에근거를반환한다. 다른담당자의변경·Main문서를되돌리지않는다.

## 상세 구현
1. server Content의sourceRefs를기존4종으로정합화하고진입사본을고정한다. prepareDocumentProposalMaterial의두배열동시거절을분리해최상위비빈sourceRefs는계속412로거절하고proposedContent의refs만기존판독기로정확검사한다. 제안근거와문서출처를합치지않는다.
2. genuine ProjectDocuments.proposeCommand의quota.prepare내원base/plan검산,실제propose의동일diff/원WeakSet재검산과상세proposal GET에서같은Tx·actor/pid로private #verifySources를실행한다. 원ArtifactStore/원메서드·같은200공유예산·getter/Proxy/await변이거절을유지한다. 새public검증proof·가짜성공callback·형단언으로원보호경로를대체하지않는다.
3. 기존quota.prepare→reserve→start→policies.command→publish→receipt/store→settle를우회하지않는다. 실제diff Buffer의변경bytes를기존목적의예약/정산으로계상하고새metadata비용분모/예약목적을만들지않는다. replay/UNKNOWN·현재제어/정책·원명령·기한·원plan동일성을보존한다. 검산실패단계에따른기존fail/unknown/보존의미를바꾸지않는다.
4. 기존content_json/hash({proposal,content,reason})·diff의afterContent에refs를그대로보존한다. 상세GET은반환전에원출처를재검산하고형상/분리저장/원문손상은기존무결성오류와구분한다. checkProposalSelection의exact content일치와구버전/stale/기존선택제한을유지한다. 누락/변조refs를자동복원하지않는다.
5. Web의기존snapshot·명령·diff/metadata비교·보관제안재개·명시반영에refs고정사본과strict판독을연결한다. Editor의반영완료시sourceRefs=[]초기화를검산된proposedContent refs보존으로맞춘다. root문서저장과같은원ref선보존/완료CAS·epoch/주체/transport·UNKNOWN원packet보존과추가POST0을유지한다. 새출처선택UI는기존DocSourceRefs를사용하며새공개상세배열은추가하지않는다.
6. 기존0003_document_proposals guard는receipt/proposal·원본문/diff·선택content_json정확일치를수용하며proposedContent refs빈배열조건이없다. 원SQL/ACL/owner/search_path·0073import제약·0072native관측제약은변경하지않는다. native source관측producer의기존빈refs동작은직접인접으로보존한다.

## TDD와 검수
현재4종proposedContent가412/클라이언트거절·반영시출처삭제로실패하는RED부터재현한다. 새서버시험은genuinequota경로를거친actualroute/Access/Policy/ProjectDocs/ArtifactStore를메모리경계에서소비한다. FN13 project-storage-quota-writers.test.ts의diffFixture는private이므로그파일을import해기존전체시험을자동실행하지말고필요한fixture만출처명시해지역재사용한다. private WeakSet에수동진입하거나직접createDocumentProposal만호출해정상증거를만들지않는다.

4종 prepare→저장→상세GET→명시반영→문서GET의sameTx/정확refs/hash/본문,최상위비빈412,출처권한/교차project/실지시kind/hash/격리·손상,누락/변조선택409,await사본/200한도,stale·중복선택·replay/UNKNOWN추가효과0을검사한다. 실제Editor의보관제안재개·반영후고정GET과실패시원ref보존을메모리DOM으로검산한다. 기존빈refs/승인·upload·제안·native source생산경로를필요인접만실행하고기대값완화/시험삭제0을유지한다.

Primary는집중/선택한직접인접/typecheck·diff,Main은필요Webmemorybuild를분담한다. 최초RED/중간준비오류/정식실패횟수/최종명령·exit·동결SHA/미검증/writer반환을구분한다. 합성통과는실DB/RLS/COMMIT/served브라우저·사용자인수/전체FN03완료가아니다. 독립검수후동일branch게시→PR필수검증/main→merged한정smoke/정리를수행하고다음미완료항목으로이어간다. 코드회귀는정상revert하며원문·역사/감사를지우지않는다.

## 독립 문서 그래프 예산의 정확 배치
base문서는기존version호출의전체200회예산으로검산하고,proposedContent는별도의전체200회예산으로검산한다. 두독립문서내용의적법한200개출처를같이썼다는이유로합계200에서거절하지않는다. 각그래프의전이/전종류는공유200회이며그래프깊이/문서마다리셋하지않는다. prepare와실제publish전재계산은각각새검산을수행하고성공/권한cache로대체하지않는다. 따라서phase당두그래프의최대합계400회로유한하고새사용자정책·quota예약목적은추가하지않는다. base200/proposed200정상과proposed전이201거절을구분해검사한다.
