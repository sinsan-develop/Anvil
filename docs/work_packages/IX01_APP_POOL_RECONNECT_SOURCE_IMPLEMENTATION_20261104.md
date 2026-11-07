# IX01 접속·app 재생성 구현 계획

> **작업 Agent:** 기존 Primary가 superpowers:subagent-driven-development와 TDD 절차로 이 업무 단위를 구현한다. Main은 관리·독립 검수·통합을 맡는다.

**목표:** 기존 IX01 실제 저장 여정의 객체 재생성 검사를 넘어, 원 app/appPool을 확정 종료하고 새 Pool/AccessRepository/buildApp으로 원 세션·원 자료를 재조회하는 실행용 source를 준비한다.

**구조:** 같은 PostgreSQL/adminPool/artifact root를 유지하고 app 쪽 문맥만 1회 재생성한다. 자원 종료 promise를 소유 인스턴스별로 캐시해 명시 종료와 finally가 같은 정착을 기다리며 실제 close를 중복 호출하지 않는다. 제품 API·권한·저장 계약은 바꾸지 않는다. 이는 접속/app 재생성 source이며 실제 프로세스/화면 재시작 인수가 아니다.

**기술:** 기존 Node24·TypeScript·pg.Pool·AccessRepository·buildApp·Node test, 신규 의존성0.

**정본:** WORK_PLAN Stage B/IX01, work_packages/INTEGRATION_WORK.md IX01의 실제 영속/재조회·재시작 요구. Main 기술판단이며 새 사용자 설계 결정으로 가장하지 않는다.

## 고정 제약·읽기 근거

R9 raw105 정의 설치 f296d6 exit0/DEFINITIONS_INSTALLED/CLEANED·cfb564 별도잔여0·감사7 cd0d13b3 보존. 실제업무/DML/RLS/API/UI/사용자인수미검증·승인소진. 기존Primary읽기와Main51a9db/d3c1a8은158~159의서비스객체재생성만으로app/Pool재시작을증명하지못함을확인. 기존파일SHA256 7db320ac0781f9fd10d8ca94a77e8bb06a23ccdf3704d0c02886f2d29d7b34f8. 실제여정은pg.Pool/AccessRepository/app.inject를소비하므로fake로재작성하지않는다.

전체실행guard·host/private범위·목표DB/marker/sourcehash/manifest·기한10분·testtimeout90000·권한/세션/세대/불변·replay/음성검사는보존. 최초installationId와32B인증key는같은시험메모리값을두AccessRepository에공급해원token/CSRF/client를유지한다. 실제key/계정/정책변경/파일보관/출력0. 신규원문·제품기능·암묵권한추가0.

## 파일·단일 소유

기존Primary만다음3경로를쓴다. Main동시코드쓰기0/다른작업자변경·보호untracked3·Backup보존.
1. 수정 tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts
2. 신규 tests/integration/IX01/journey-context-lifecycle.ts
3. 신규 tests/unit/IX01/journey-context-lifecycle.test.ts

## 인터페이스·설계

- helper내보내기: JourneyOwnedResource {name:string;close:()=>Promise<unknown>}.
- registerJourneyClose(owned:JourneyOwnedResource[],name:string,close:()=>Promise<unknown>):()=>Promise<unknown>. 인스턴스를직접캡처한callback의한promise를캐시·등록·반환한다. sync throw도같은rejected promise로보존/재시도0.
- closeJourneyContext(current:{closeApp:()=>Promise<unknown>;closePool:()=>Promise<unknown>},fresh:()=>void):Promise<void>. fresh→app정착→fresh→pool정착→fresh. 실패/미정착/만료뒤반환성공/새생성0. 일반runner/framework로확장하지않는다.
- 실제시험은factory내rawPool생성즉시close를소유등록하고fence적용→AccessRepository→buildApp생성즉시app close등록. callbacks는그때인스턴스를캡처하며mutable app변수를나중에참조하지않는다. adminPool은그대로소유/종료등록한다.
- 원freshDocuments검사뒤·교차접근/만료음성앞에서원도메인자료와command/receipt/audit수를고정→closeJourneyContext확정→fresh→동일auth설정의새appPool/access/app생성. 기존ApiClient/send/get은현재app을소비하도록연결한다.
- 원token으로문서/계획/지식고정GET·정확ref/hash/저장내용·적용본/양방향trace를재확인하고도메인원문/물리행·명령/receipt/audit수가같은지비교한다. 현재observedAt처럼시점에따라달라지는값을영속원문으로잘못비교하지않는다.
- 원negative/replay/권한·기한검사와원실행오류+정리오류Aggregate보존. finally는모든owned를각각관측하되이미시도한close는같은promise만await/원동작재호출0. 부분생성오류에도새Pool소유등록누락0/미정착을정리성공으로표시0.

## 검토 초점

미정착·거절·각await뒤기한만료,old/new 인스턴스closure혼용,부분생성누락,새문맥이실transport에서미소비되는문제,원token/ref를새로그인/가짜자료로대체하는문제,기존음성/기준완화,비밀출력과실환경부작용을검토한다.

## 작업 순서·검증

- [ ] helper신규unit을먼저작성해모듈/기능부재RED를실행한다. 실제DB/키/파일없이메모리deferred 자원만사용.
- [ ] app미정착중pool/다음생성0·app뒤pool순서·양쪽확정뒤생성·app/pool거절과각await뒤만료의새생성0·명시/finally중복요청실close각1·부분factory실패소유유지·한close실패가다른정리시도를막지않음을검증한다.
- [ ] 최소helper와기존실시험소비선을구현. 원보호조건/90초/10분/음성·replay내용을삭제/완화하지않는다.
- [ ] 신규unit·필요noEmit/diffcheck만수행. 실제integration은옵트인없이1SKIP의NOT_RUN확인만가능하며이를PASS로계산하지않는다. 실행환경에서실제옵트인/계획/비밀변수를제거한경우에만그기본모드를관측하고실QA는절대기동하지않는다.
- [ ] 정확파일bytes/hash·명령/exit/수량·오류횟수/미검증·기존검사보존/실소비선·writer반환/live0을제출한다. Main은독립unit/소스검수후Git을보존한다.

실제DB/SQL/권한·키·서비스·Agent·WSL/Docker·실자료·P03R3·새QA자원/시각/실여정실행0,Git/새branch/worktree/thread/자동화/외부메시지0. 기존하네스56/환경50/native44/회원16전수반복0. 같은근본오류3회면중단/증거반환. 새실행준비기의source와실제접속/자격증명·artifact/seed/ledger·재접속검증은후속고정안/별도실행범위로분리한다. 전체계획미완료.
