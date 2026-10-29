# FN16 기능 기준선 이력의 실소유 내부 조합 연결 WI — 2026-10-29

상태: r2 사전검수/코드GO전. 기준 codex/av3-stage-b 7f749c0c150277e0b292cfd9f1682f7d3b917f6e. 계획 FN16 source-only 범위, Main 관리·검수·통합/기존 Primary 단독 구현/기존 Reviewer 읽기다. 기존24/직접원문consumer의기본동작을유지하며 실제Root내부연결만 추가한다. 공개route/API·DB/키/서비스/Agent/제품원문IO 실행·미채택정책/보호참조A/FN15 factory/gate 변경0이다.

## 1. 정확 허용3코드

- apps/server/modules/backups/project-inventory-composition.ts (원SHA391F2D705A8BFBF08E616ED7570A7856C8AB680FCE70946BE9CEA139B35DD99D): 선택 trusted internal baselineContext 및 고정2 actual class 수집 연결만.
- 신규 tests/unit/FN16/feature-baseline-composition.test.ts.
- 신규 tests/unit/FN16/feature-baseline-composition-schema.test.ts.

class2792F681/helper96497534/원consumer/기존수집기·보호8·기존시험파일·문서/Git 수행자변경0이다. 다른fixture/파일이실제로필요하면정확근거를Main에보고하고먼저범위를조정한다. 가짜함수반환/검증boolean으로범위를맞추지않는다.

## 2. context·실제 권한 경계

기존composeProjectInventory(access,token,value,signal)에선택5번째 {baselines:ProjectBaselines,csrf:string}만추가한다. undefined면기존24 호출/결과필드·hash·usage 의미와read-auth null-CSRF 경로를그대로유지한다. null/추가키/accessor/잘못된값·callback/provider 객체는DB전INPUT400으로닫는다. descriptor값은한번복사고정한다.

context가있을때만 access는실제AccessRepository,baselines는실제ProjectBaselines instanceof를확인하고 기존guarded proxy를class에전달하지않는다. Root실제초기/최종·feature직전경계는해당csrf로인증하고현재동일user/client/credentialGeneration/session·OWNER·최소기한을검사한다. Root가실제인증한4필드만expectedIdentity로고정하여각class실authenticateInTransaction 이후추가비교에사용한다. 신원/CSRF를원DTO/hash/로그에반출하지않고실제auth를대신하는proof로쓰지않는다.

기존24는원guarded.authenticated를통해그대로수집한다. 이후 FeatureBaselineDraftHistory→FeatureBaselineDecisionHistory를고정순서로직렬호출한다. 실제readDraftHistoryInventory/readDecisionHistoryInventory와원26/32 query/원source·docs/명령/승인검산을재사용한다. caller의임의수집함수/위조prototype/성공용reflection우회를넣지않는다. 이는내부접점이며routes/ProjectBackups/직접artifactconsumer는이번에이context로연결하지않는다.

## 3. 같은 genuine 예산·제한

기존24의고유선언bytes를먼저차감한잔여를maxBytes로genuine공통budget을생성한다. class별로새budget을만들거나counter를초기화하지않는다. 앞class실소비후rootgetter의증분과child.usage.inputBytes가일치하는지확인하고다음입력inputBytes는global잔여이하로준다. 각class의DB전binding/sameSignal/localcap·진입genuine기한/실auth최소TTL을보존하며Root도child전후·최종직렬화/반환에genuine상태를확인한다.

Root의남은기한은요청/실제auth관측최소와genuine budget의실단조기한중최솟값이다. 실제binding 반환만제한관측으로사용하고caller가준시각/권위값을받지않는다. rootremaining은순수산술로유지하여시작된query의handler부착전helperthrow를추가하지않는다. 모호한회수/poison503·known취소409/한도·기한413·비밀없는오류의기존우선순위를보존한다. 직렬사용전제/협력제한이며driver/OS강제회수보장0이다.

파일한도는기존24고유파일수+class1고유사전계수+class2고유사전계수의보수상한이다. class가실제refs를반출하지않으므로전체중복제거/실제읽은고유파일수라고주장하지않는다. 다음child전bytes/fileCount/metadata 잔여가0이면양수입력계약에따라413으로닫고빈성공/조용한생략0. 마지막child가한도에정확히맞춘뒤엔추가읽기가없으므로정상반환을거절하지않는다.

metadata budget은기존24 child DTO비용+feature child의실보고metadata비용+최종Root DTO를보수적으로차감한다. child.usage.metadataBytes는유한정수·해당DTO크기이상이어야한다. 기존24의전체DBraw비용을측정했다고주장하지않고회계범위를명시한다. 별도실읽기cap/외부비용설정·기한확대0이다.

## 4. hash·output·원 의미

각feature원projection의정확필드는실제생산코드로대조하고kind/usage/inventoryHash를제외한projection hash가원inventoryHash와일치해야한다. kind/scope/false·명시배열/원고정ref/hash/usage를검사한다. metadataObservationHash는raw시각관측지문이지RR snapshot/복원proof가아니다. 신규2profile만observation=null·NOT_EXPORTED를표시하고기존24관측검사는완화하지않는다. 새가짜namespace/VersionRef provider·권한복원/현재합격을발급하지않는다.

component에는원hash/resultDigest/rowCounts·제한선언과현재원관측상태(MATCHED_METADATA/CHANGED/UNAVAILABLE)의필요한집계만보존한다. 현재상태집계는내용검토합격·과거명시채택/실행허가와구분한다. 원생산자reason/body/actor/client/session/credential원값을반출하지않는다.

기존usage.inputBytes/fileCount는24의고유선언의미로유지한다. context모드에만baselineReadBytes(실제반복읽기),inputBudgetCharge(선언+실제),fileCountUpperBound(위보수상한),metadataAccounting(24DTO+feature보고비용+finalDTO)의명시구분을추가하고compositionHash에해당선언을결박한다. default에이필드를0으로추가하지않는다. 양모드의atomic/fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed=false와미수집umbrella·전체blobVerification NOT_PERFORMED를유지한다.

## 5. RED→GREEN·검수

실제Root선택context와2고정class연결부재RED부터시작한다. 실제AccessRepository인스턴스/실ProjectBaselines와원save/review/confirm·원자료/receipt/선택승인/원문메모리ownedhandle을거치는정상/빈데이터를사용한다. context를성공callback/임의결과DTO로대체하지않는다. 실제DB/키서비스원문IO0이다.

필수반례: default24의필드/관측/원usage불변·context26고정실제호출/원projectionhash·부적합instance/위조context/accessorDB전거절·실CSRF/현재신원변경·class중간짧은TTL과Root최종기한·동일genuinecounter/첫소비유지·24선언차감/반복실읽기·최종정확한도와다음잔여0·파일중복보수상한·metadata누적/마지막직렬화·source UNAVAILABLE/과거채택/legacy 의미·false/미수집보존·poison/cleanup503을확인한다. 초기source/identity/한도실패후후속class실행0과성공반환0을검사한다.

새2시험+직접기존composition 행동/schema·project-inventory-artifact-verification 행동/schema의default회귀만선택하고type/diff·독립C0/I0·Main집중검증으로한정한다. 변경없는class29/48/58/201전수반복0·기존기준완화0. 정확3hash/명령exit·오류/미실행을제출하고writer해제한다. Main이정확code+소유문서만같은branch게시한다. 원칙상내부context접점만이며실사용Root호출/공개정책/실제DB·파일·Agent/백업복원/전체계획완료와구분한다.
## r2 — 명목타입과 새context 인증대기 경계

부모WI84EC376D. instanceof는정상내부인스턴스입력의명목타입검사이며constructor실행/악성host조작에대한보안증명이아니다. 위의위조prototype/성공용reflection금지는수행자가실제인스턴스대신Object.create/as/proxy로검산을우회하지말라는뜻이다. 원문호출의server-only선택context는신뢰된생성인스턴스를주입하는접점이고JSON/클라이언트wire입력이아니다. 불일치plain객체/callback/accessor·추가키의거절은검사하되악성동일process prototype/code변조까지탐지한다고주장하지않는다. 새constructorbrand/권한proof/AccessRepository·ProjectBaselines수정0,정상positivefixture도new실인스턴스·실auth/보호메서드를거쳐야한다.

Primary의repository.ts66~85대조에서기존access.authenticated는callback전connect/BEGIN/lockedSession에Root요청기한을주입하지않는다. 새context모드에한해composition안의caller-owned bounded RC controller로초기/최종/feature직전경계와기존24가호출하는guarded.authenticated를실행한다. 실제repo.pool·authenticateInTransaction·해당Root csrf와원토큰을사용하고실identity/최소TTL/OWNER를검사한다. 컨트롤러가발급한사용자bool/proof로실auth를대체하지않는다.

connect·시작된query/COMMIT·ROLLBACK·lateclient는유한statement/lock/idle/ownedtimer로관측·회수하고결과불명503/정확자기client폐기·late결과관측을보존한다. callback후시간검사만으로callback전pending을증명하지않는다. 요청/auth/genuine최소기한을재설정없이결박하며Root auth에서더짧아진TTL도기존genuine tighten에반영한다. old child의독립RR 검산과기존bounded source알고리즘은재작성하지않고전체driver/OS강제회수주장0이다.

default24는기존access.authenticated/read-null-CSRF·필드·동작을그대로보존한다. 새context의실CSRF/신원/기한/cleanup을위한private분기만추가하며publicAPI/인증정책/실DB/서비스변경은아니다. 실제auth前connect/lockedSession pending의Root제한·오류/회수불명503과late client정확관측을새반례로검사하고기존24 default회귀와분리한다. 정확3코드경로/다른제품수정0을유지한다.