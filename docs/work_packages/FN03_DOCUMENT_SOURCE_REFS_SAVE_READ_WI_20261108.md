# FN03 문서 전체 출처 저장·조회 연결 작업지시서

## 근거·목적·상태
WORK_PLAN FN03/UI06의 문서 원문·출처 저장/보호조회 구현이다. INTERFACES §SourceRef(600행),DocumentContent(603행),save/import/proposal 보존(670~675행)의 기존4종 형상을 유지한다. 최초구현의빈배열전용412는최종목표가아니다. 이번 업무는 saveDocumentDraft→불변 document version→기존 GET의 기존계약 연결이며 import/proposal/UI선택은후속미완료로명시한다. 항목별attribution/evidenceRefs·새endpoint/표/권한/과금계약을추가하지않는다.

기준 main ef933a870424c392512b2bbba2eceff9bf8a4405, branch codex/av3-fn03-document-sources. 기존 Primary 단일 code writer/Main관리검수. 실제 DB·권한·키·서비스·Agent·SSH·사용자자료조사는금지하고제품/시험파일읽기·합성검증만허용한다.

## 정확 소유 파일
- 신규 apps/server/modules/documents/document-source-refs.ts
- 기존 apps/server/modules/documents/project-documents.ts
- 기존 apps/server/modules/knowledge/conversations.ts (readMessage optional backupBudget 및 아래 원메서드 고정 한정)
- 기존 apps/server/modules/documents/project-proposals.ts (type-only SourceRef import 및 BaseDocument.content 실제 반환형 정합화만)
- 신규 tests/unit/FN03/document-source-refs.test.ts
필요경로가다르면쓰기전에Main에근거를반환한다. 기존다른작업을되돌리지않는다. Main은본WI/WORK_STATUS/결과문서만소유한다.

## 상세 구현
1. 기존 SourceRef4종 exact kind/id/version/hash 형상·현재프로젝트귀속·중복·최대200을 대조한다. caller객체/getter/proxy/await중변이를 통한검산우회는거절하거나진입시불변사본으로고정한다. 새공개형상을발명하지않는다.
2. 같은 PoolClient/actor/project에서 DOCUMENT_VERSION은정확과거version/contentHash·보호원문,ARTIFACT는같은프로젝트READY·정확hash/원문,CONVERSATION/USER_INSTRUCTION은기존 ProjectConversations 보호readMessage의원hash·실지시종류를확인한다. FN05지식저장·가짜KnowledgeEntry·새authenticated/pool/권한발급으로우회하지않는다. 기존권한/current검사를보존한다.
3. ProjectDocuments.save의빈배열전용412를실보호검산으로대체하고 content.sourceRefs의고정사본과source_refs_json을함께저장한다. contentHash는기존 canonical content 구조를그대로사용한다. 기존본문·첨부·양식·단계·정책·receipt·expectedVersion/replay검사를유지한다. 검산실패시새domain/receipt/원문정착0이어야한다.
4. 기존version GET은content.sourceRefs와source_refs_json의형상·동일성을확인하고정확출처의보호원문을다시검산한경우에만반환한다. 과거버전을현재head로대체하거나역사출처를숨기지않는다. 문서간연쇄는호출단위예산/방문경로로유한하게검산한다. 내부총검산예산은최상위호출하나당출처참조200회로고정하며모든종류와전이참조를함께계상하고새문서읽기마다초기화하지않는다. 최상위문서자체는출처참조회수에포함하지않는다. cycle·예산소진은fail-closed한다. 원권한/무결성검사를cache성공값으로대체하지않으며backupBudget과기존protectedreader지문/호출계약을보존한다. 구체내부유한검산방식이기존보호reader와충돌하면구현전근거를반환한다.
5. 현재일반save의DBguard는비어있지않은출처를막지않는다(0003 guard_document_draft_write,0073 document_command_authorized/ordinary save분기). 기존SQL변경/미적용migration추가0. import만별도0073의빈배열조건이있으므로이번범위에서열지않는다. native0072관측의빈배열조건도보존한다.
6. 기존quota는본문artifact업로드비용을계상하고일반document metadata JSON을새분모로세지않는다. 이번출처연결로원문bytes를중복계상하거나새예약/비용목적을추가하지않는다. metadata분모의기존범위는결과에명시한다.

## TDD·검수
먼저4종정상저장→기존GET의refs/hash/분리열보존이현412에서실패함을재현한다. 그뒤필요최소제품변경만수행한다.
- 정확과거문서버전/4종보호원문/빈배열정상;현재head전용대체금지.
- cross-project/없는ref/hash변조/격리·미지원원문/USER_MESSAGE지시위장거절.
- 추가키·중복·201개·getter/proxy·await중caller변이음성.
- 저장뒤출처열/본문/원문손상·격리시GET성공금지;연쇄cycle·유한예산검산.
- 기존본문/첨부·검토/확정·replay 및backup/protectedreader소비직접인접을선택검증. 기준/기대값완화·기존시험삭제0.

집중시험은신규test1,직접인접은현재호출영향을보고최소선택한다. typecheck는Primary가담당하며Main중복실행0. 명령/exit/결과/동결SHA/정식실패횟수·미검증을반환하고writer반환을명시한다. 합성PASS를실DB/화면/전체FN03완료로올리지않는다. Main독립검수→commit/privatepush→PR→필수검증/main→mergedsmoke/정리후다음기존계약소비를진행한다.

## 내부 예산 전달 보완
ProjectConversations.readMessage는현재5인자로호출되며originalText에backupBudget를전달하지않는다. genuine reader/문서객체를유지하기위해기존5인자와외부응답은그대로두고선택적6번째 ArtifactBackupReadBudget를전파한다. budget이주어지면진입/await경계에서기존assertArtifactBackupReadBudget로확인하고originalText의기존4번째인자로넘긴다. budget없는기존caller동작은불변이다. fake문서adapter나전체ProjectDocuments형단언으로진짜reader를대체하지않는다. 추가허용은conversations.ts의해당범위뿐이며공개HTTP/권한/영속schema변경0이다. 신규시험에서대화출처의동일budget전파와만료거절을검산하고기존대화/지식·보호plan직접인접을필요범위만확인한다.

## 순환 초기화와 원메서드 고정 보완
실제 Conversations 선import 순서에서 Documents의top-level캡처가TDZ RED5a13c5로실패했다. 최초사용lazy pin만으로는그이전prototype교체를거절할수없으므로이를원함수증거로삼지않는다. conversations.ts 자체class정의직후lexical const로원readMessage를고정하고, constructor의선택적내부모드 DOCUMENT_SOURCE_REFS에서만그원함수를bound own data method로고정한다. undefined의기존ordinary생성과기존readMessage5인자는유지한다. 알수없는모드는거절한다. Documents는genuine생성자의해당모드객체에서고정own descriptor의함수만소비하며새export/staticproof/권한발급·HTTP필드는추가하지않는다. 이것은원메서드소비를보존하는내부조립방식이며그mode자체를권한proof로사용하지않는다. 원모듈선import/실App import와최초호출전prototype변조·getter교체/추가호출후교체음성을검산한다. 저장refs형상손상은GET의기존DOCUMENT_INTEGRITY_FAILED503으로구분하며원출처권한/hash오류는유지한다.

## 읽은 기준 문서 타입 정합화
현재Documents.version의content.sourceRefs가실제기존4종으로확장돼기존BaseDocument.content의빈배열타입과세호출점에서TS2345가발생했다. project-proposals.ts의type-only SourceRef import와BaseDocument.content를 Omit<Content,sourceRefs> 및 SourceRef[]의교차형으로맞추는정확타입보완만허용한다. proposed Content의빈배열/prepare412·함수본문·SQL·원import/proposal실행제한은변경하지않는다. 타입단언으로실제출처를빈배열로위조하지않으며새공개형상을추가하지않는다.

## I1 원문 reader 후행 검산 보완
실반례aa6383에서genuine대화원행/hash/kind가정상이어도호출자Documents.originalText getter와가짜함수가실행돼APPLIED가반환됐다. HTTP에서함수교체권한이있다는주장이아니며내부원reader보존모형의실패다. 메시지출처검산분기에서만부작용없는 new ProjectDocuments()를만들고그own originalText를lexical readProtectedPlanText.bind(원Documents receiver)로 readonly/nonconfigurable data descriptor에고정해전용genuine ProjectConversations에공급한다. 새객체의다른문서기능/빈store를권한proof로쓰지않으며실읽기는원receiver의실store/privateguard/원budget를그대로소비한다. 새root/파일/권한/키/실행생성·fake전체형단언·외부callback/export0이다. 원호출자getter/함수는호출전/원행await중교체해도실행0이며원문hash/격리/기한검산을통과한자료만수용한다. constructor무root가IO를일으키지않는것도검산한다.
