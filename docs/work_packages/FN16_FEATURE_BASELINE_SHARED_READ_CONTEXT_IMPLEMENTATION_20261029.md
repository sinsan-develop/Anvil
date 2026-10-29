# FN16 기준선 이력의 공유 읽기 제한·신원 추가제약 WI — 2026-10-29

상태: r2 사전검수/코드GO전. 기준 codex/av3-stage-b 4027ed88ddbe70e600f6e110583bc1e922ea8306, 기존 FN16 source-only 승인 범위. Main 관리·검수·통합, 기존 Primary 단독 writer, 기존 Reviewer 읽기 검수. 이번은 내부조합 연결의 안전 선행이며 새 조합 profile/public route/API/정책/SQL·실제키/DB/서비스/Agent/원문파일IO 실행0이다.

## 1. 정확 허용4코드

- apps/server/storage/artifact-backup-budget-read.ts (원SHA F4C25D6BC15B78975D3007C6D778AAC527615039B0AA28A3229AB1ACC0D81FB2): WeakMap 내부의 읽기전용 assertArtifactBackupReadBudgetBinding(budget,signal,maxAdditionalBytes) 1접점 추가만. 기존 reader/usage/기한 알고리즘·counter 수정0.
- apps/server/modules/projects/project-baselines.ts (원SHA 43BABDFB171A3990C03D15DA3F5854B3B46372951C36D2B187205165FB1ABB0C): readDraftHistoryInventory/readDecisionHistoryInventory에 아래 제한용 선택context만. 원 query/파싱/RC·RR·검산·FIFO/legacy/hash/기본의미는 보존한다.
- 신규 tests/unit/FN16/feature-baseline-shared-read-context.test.ts.
- 신규 tests/unit/FN16/artifact-backup-budget-binding.test.ts.

다른helper/수집기/24조합/원문consumer·보호8·문서/Git 수행자쓰기0. Main이 WI/결과/계획/현황과 정확Git게시를 소유한다.

## 2. 읽기전용 결박 검사

genuine은 WeakMap 발급만 뜻하고 signal/maxBytes 결박이 아니다. 다른 signal은 chunk 취소검사를 바꾸며 과대한 cap은 local 반복읽기 상한을 약화한다. helper 새기능0이라는 초기 읽기안은 철회하고 이 한정 접점을 둔다.

기존 genuine/cleanupUnknown/기한/취소/busy 검사를 먼저 재사용하여503/409/413 우선 의미를 보존한다. 동일 AbortSignal 객체와 양의 안전정수 maxAdditionalBytes를 확인하고 remaining=maxBytes-used가 0이상 안전정수이며 local 추가허용량 이하인지 검사한다. 상이signal/과대cap/잘못된형식은 알려진 INPUT400으로 거절한다. 이미음수로소진된상태는 알려진 LIMIT413으로 거절한다. 값/한도/기한/counter/busy 상태를 변경하거나 private state객체를 노출하지 않는다(아래r2의제한용기한관측만예외). 단순히 max를local값으로 바꿔 앞선소비를 이중차감하지 않는다.

## 3. 선택 context와 실제 인증

두 내부 이력메서드의 기존인자뒤 선택context는 정확 {expectedIdentity,budget}다. expectedIdentity는 {actorId,clientId,credentialGeneration,sessionId}의 현재Root 실제인증결과 비교용data이고 인증/OWNER/실행허가proof가 아니다. 원 실제 AccessRepository instanceof·authenticateInTransaction·CSRF·OWNER·원 receipt/선택승인·source/docs bytes 검사는 생략하지 않는다. 실제 재인증 이후마다 이4필드를 비교해 다르면 AUTH_REQUIRED401로 닫는다. 과거 저장 actor/client를 현재신원으로 강제하지 않는다.

context/expectedIdentity는 명시 data descriptor의 정확키/기본형식만 허용하고 accessor/추가키/가짜budget/형식오류는 raw cause/값 노출없이DB전400으로 거절한다. undefined이면기존동작을그대로유지하며 null/잘못된객체를 생략으로 취급하지 않는다. 실제 budget의 signal/local cap 검사는 DB/IO 전에 한다. 입력용신원/credential/session 원값을DTO/hash/metadata관측에넣지않는다.

genuine 공통budget은 시작시사용량을기록하고 기존각phase 실제인증에서관측한 더짧은TTL/남은요청기한으로 기존tightenArtifactBackupReadDeadline만 호출한다. caller기한으로늘리거나새budget으로대체/초기화하지않는다. 이미cleanupUnknown인budget은어떤새요청에서도503이다. root는향후같은budget을assert해숨은최소TTL을잃지않게되지만이번에는root를연결하지않는다.

각메서드 usage.inputBytes는 이호출의실제추가읽기량(finalUsed-entryUsed)으로보고한다. 기본privatebudget경로는entry0으로기존결과와동일하다. 공유전체누적량은helper가원상태로보존하며caller는getter로만읽는다. 메서드fileCount는기존고유사전계수의미유지, 전체중복제거/실읽기파일수로승격0. class1뒤class2를같은budget으로이어도같은signal/누적/최소TTL이유지돼야한다.

## 4. TDD·검수·제외

helper접점/선택인자미연결 RED부터 시작한다. genuine/가짜·다른signal·과대cap/local하한·소비된budget의정확remaining·busy/cleanupUnknown우선·현재used유지·기한단축/연장0·취소중실메모리owned-handle차단을검증한다. context잘못된data/accessor/추가key는DB전거절,실제auth신원불일치는인증후자료query전거절한다.

실제원save/review/confirm과두이력메서드/query adapter·원source/docs/선택승인검산을거치는메모리fixture로, 같은budget의양메서드호출·이전소비보존·각usage delta·Root읽기한도누적·class1에서발견한짧은TTL이뒤class2/최종assert까지유지됨을검사한다. 단순성공boolean/prototype authority injection0. 과거actor/소비승인/legacy/currentCheck/false/원hash 검산보존과 기본context없음도필요한직접범위만확인한다.

검증은신규2시험+기존reader/전달/context영향의직접반례를선택하고type/diff·원기본본문/의미diff·독립C0/I0·Main집중검증으로제한한다. 기존전체201/48/58/67전수반복0·기존기준완화0. 실제PG/SQL/FS/키서비스/Agent/브라우저/백업복원/사용자인수미검증·전체FN16/WORK_PLAN미완료다. 결과에는정확hash/명령exit·오류횟수/원인·미실행을기록후writer해제하며,이후실소유Root조합/보수적한도계약은별도단위로이어간다.
## r2 — 숨은 공유기한의 마지막 metadata·DB pending 결박

부모WI CD20F087. Main a2002c/독립소스대조와 수행자 a5ef6d의 late-empty RED에서 shared기한20ms 진입유효→뒤actualauth/request100000ms→마지막DTO에서21ms가되면성공반환함을확인했다. '뒤메서드진입전만료'만으로최종반환경계를증명하지않는다. 중간24P는초기동결시점증거이며최종합격아니다.

최소보완은 기존binding1접점의 반환을 readonly {deadlineMonotonicMs:number}로확장하여 genuineWeakMap의유한 resource기한(started+deadlineMs)만관측하는것이다. 원 signal/maxBytes/state객체/권한을노출하지않고 cap/counter/시작점/기한을변경하지않는다. 인증/OWNER/실행proof가아닌보수적제한값이다. 반환은freeze된data이며 무한/NaN은거절한다. 별도helper/observer/callback/허가토큰0.

context진입의DB전binding검사로받은실제공유기한을local에고정하고두method remaining=min(원요청기한,원auth최소기한,진입genuine공유기한)로결박한다. 이값은정확같은performance monotonic기준이다. 이후자기phase가발견한더짧은실auth기한은기존local authDeadline/min과기존tighten에동시에반영한다. 직렬class1→class2 사용전제이며외부동시소비의개별귀속/외부동시단축을실시간강제할새lease는이번범위밖이다.

일반 metadata 전후/최종직렬화/성공반환의 check는shared가있으면기존assert도검사하여최소기한/poison을성공으로낮추지않는다. 다만 remaining/cleanup timer 계산은새throw를만들지않게고정된기한의순수산술로유지한다. 이미시작한db.query를tracked에넘긴뒤remaining의helper assert가throw해 pending handler부착전에누락되는구현은금지한다. 회수불명503우선/원FIFO·late client관측을보존한다.

추가반례는late-empty metadata/마지막DTO20→21ms의실RED→GREEN과,진입시공유20ms·뒤auth/request장기에서도statement/lock/idle/ownedpendingtimer가실공유기한이하로결박됨을검사한다. caller가준가짜시각/Root향후postassert/반환경계검사만으로pending bound를대체하지않는다. 실제driver/OS강제회수보장이아닌기존bounded추적·불명503이다. 새정확4코드경로는유지하며원registry/hash/default·원reader알고리즘·Root/공개API/실환경변경0이다.