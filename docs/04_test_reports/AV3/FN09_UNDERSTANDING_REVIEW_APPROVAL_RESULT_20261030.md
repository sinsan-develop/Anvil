# FN09 이해검토 일회 승인 연결 source 검수 결과 — 2026-10-30

## 판정·권한
- 직접 승인 r1 A안의 source/UI·미적용 SQL·합성 검증 범위 검수 완료, 독립 C0/I0. 실제 DB·서비스·Agent 기능/사용자인수·전체 FN09/FN11/UI05/UI08·Stage·작업계획서 완료는 아니다.
- 직접 승인 docs/approvals/FN09_UNDERSTANDING_REVIEW_SOURCE_DIRECT_APPROVAL_20261030.json SHA256 B7E7AE96EFD2E5CE1377D351FF56F1F5DDF346A8DD7A19A1238A9785B785FFAB.
- 결정안 r1 SHA256 6DA65EB62DCDF0BD08079F4F89513370AF77FECD5FE83B4ED331B03D554D2578, WI FN09_UNDERSTANDING_REVIEW_APPROVAL_IMPLEMENTATION_20261030.md SHA256 AB27C0E2FC64F2A3D23ADD31028DE5C44D40CF6BAB447063A2F0ED53B45228C1.
- 시작 HEADe87a6ebe85d4a85c8dc085ff1ed86dec48a16efc/기존 codex/av3-stage-b. Main WORK_STATUS dirty/보호untracked8 보존. 기존Primary 단일 구현·writer해제, 기존Reviewer 독립읽기·Main 실행/관리/통합. 실제DB·키·서비스·Agent/listener0.

## 변경 전·후
- 전: HUMAN 이해검토 AUTO/NULL 원명령만 허용하고 REQUIRE_APPROVAL를 차단했다. PG이력 JOIN/브라우저decoder도 승인관련NULL을 전제했다.
- 후: 전체 원command(null approvalRef)를 requestApproval의 candidatePayload로 보관하고 보호GET에서 원요청hash까지 검산한다. ActionScope.payloadHash/원commandHash/승인ref추가실commandHash/전체승인요청hash를 구분한다.
- reviewUnderstanding만 targetRef=null은 실행원형hash 미보유·expectedVersion은 양수generation이며, 고유candidateCommandId→불변원command의targetId/generation→원승인요청payload/hash로 정확 tuple를 결박한다. 가짜 fullExecutionRef 생성0·다른연산 의미불변.
- UI05에서 정확원명령 승인요청 보관→UI08 전체6판단/근거·실행ID/generation·hash미보유 확인/별도결정→원명령에승인ref만결박→사용자명시저장→이력재조회/replay를 연결했다. AUTO/기존입력·불명명령/현재정책·제어·전후currentBinding/수신/6기준·두false 보존, 실제WORK/Agent허가0.
- PG보호조회는 AUTO/approved의원명령·요청/결정·소비·receipt/audit를양형식검산하고연결누락을조용히없던행으로만들지않는다.0056은기존guard와타연산0055위임을보존하며최종8deferred 진입점/불변보호를작성했다. 미적용파일이며실DB적용0.

## Main 검증 — 각각 별도 실행
|근거|정확 명령·범위|실제 결과|
|---|---|---|
|882e35|node --test tests/unit/FN09/understanding-review-approval.test.ts (당시SQL사례추가전 서버10)|10PASS/0skip/754.823ms/exit0|
|2ff466|node --test tests/unit/FN08/execution-understanding.test.ts tests/unit/FN08/execution-understanding-store.test.ts tests/unit/FN08/understanding-history-routes.test.ts tests/unit/UI05/understanding-history-api.test.ts tests/unit/UI05/understanding-review-write.test.ts tests/unit/UI05/understanding-review-recovery.test.ts tests/unit/FN11/approval-input.test.ts tests/unit/FN09/execution-preparation-approval.test.ts tests/unit/UI08/execution-preparation-approval-api.test.ts|기존직접9파일61PASS/0skip/1396.3202ms/exit0|
|774f6c|node --test --test-name-pattern='0056 source preserves original guard and deferred bidirectional graph' tests/unit/FN09/understanding-review-approval.test.ts|신규SQL source1PASS/0skip/688.4638ms/exit0, 실제SQL아님|
|329164|node --test tests/unit/UI05/understanding-review-approval.test.ts tests/unit/UI08/understanding-review-approval-api.test.ts tests/unit/UI05/understanding-history-api.test.ts tests/unit/UI05/understanding-review-write.test.ts tests/unit/UI05/understanding-review-recovery.test.ts tests/unit/UI08/execution-preparation-approval-api.test.ts|UI변경후 신규5+기존영향20=25PASS/0skip/501.7055ms/exit0|
|49be87|node --test tests/unit/UI05/understanding-review-approval.test.ts tests/unit/UI08/understanding-review-approval-api.test.ts|helper첫await전복제보완뒤 영향신규5만PASS/0skip/279.4603ms/exit0|
|257b01|ANVIL_FN09_UNDERSTANDING_APPROVAL_DOM_QA=1, CASE미설정, node --test tests/browser/UI08/understanding-review-approval-dom.test.ts|5자식+부모Node6PASS/0skip/8648.7314ms/exit0|
|49be87|npm run build(내부typecheck), git diff --check|477modules/507ms/exit0, 기존500kBchunk경고 유지|
|49be87|git diff --exit-code HEAD -- 원0019/0011/0055·understanding-review-recovery.ts·projects/routes.ts|exit0·기존파일불변|
|330a07/92c286|별도QA/프로세스·최종코드18+보호8 SHA256 대조|경로부재/정확Edge0·26hash일치|

61의UI20은UI변경전이었으므로329164에서직접영향20만재검증했다. 신규helper복제후49be87은신규5만반복했다. 위실행들을하나의전수PASS/유일사례수로더하지않는다. 실ProjectApprovals/ProjectUnderstandingReviews/SyntheticPgUnderstandingStore·원형/hash/ApiClient를소비하지만인증·정책/current사실·DBquery/transaction은메모리대역이며실PG원자성/보안인수증거가아니다.

## 실제 DOM·QA
- 실제 UnderstandingReviewEditor/ApprovalsPage·ApiClient/nativeWebCrypto를사용하고API/정책/제어/저장·replay·이력은메모리transport다. 전체shell/SessionDetailPage·실서버통합아님.
- 정상요청→전체후보→별도결정→같은commandID/본문에승인ref만추가→명시저장/정확이력, 요청단절·저장후재조회불명각각고정명령보존/자동재전송0을확인했다.
- 같은Editor인스턴스/native digest실완료후반환hold에서sameclientABA(clientCount1)와실ApiClient교체(clientCount2)를각각POST0/원pending불변으로검증했다. UI08 ABA/lateJSON/실digest/403 및실client/clientId/project/다른실행ID/generation요청교체의옛본문숨김을확인했다.
- 최종bundle SHA256 7a4afcac94a1c609cc7d5932ea2d5129e5fbf0c764f34cefa2d34978e1ff46b6.
- 사전등록 QA D:/tmp/anvil-v3-stage-b/fn09-understanding-approval-20261030-01. Main시작2026-10-30T10:15:32.951Z(19:15:32KST),약9초내contextclose/환경복구·정확소유경로회수.330a07별도경로False/관련Edge0.실listener/DB/Agent생성0.
- launch/close물리결과불명은강제유발하지않아NOT_RUN.코드의시도/확정종료구분·불명보존을읽기확인했으며정상정리PASS와혼동하지않는다.

## 오류·독립 보완
- TDD: 최초서버3RED→같은3GREEN,SQL0056의도부재RED→sourceGREEN,UI05/08초기3RED→GREEN.부재RED는정확신규파일이며경로탐색오류와구분한다.
- 서버I1/I2: request/decision봉투id·version/status/시각검산누락과소비후승인GET의최종실commandhash비교누락을Main3aa504/0dd194로확인.87766b 각정합변조2RED→fe9569 동일2GREEN/453.9177ms,후속scoped독립C0/I0.원봉투PG시각은원서버의명시ISOms저장과일치시켜임의절삭허용0.
- SQL초안B982의scope_digest변수/열모호성은작성중E3EAE72B에서expected_digest로고쳤다.Main8088a5와독립scopedC0/I0.초안이력을현재미해소로누적하지않는다.
- UII1: inneractive가alive만검사해실digest대기중옛POST가능.Main647be0확인·b8a0f0 옛POST1 RED→current콜백2접점보완뒤075bab POST0 GREEN.93b3c0에실client교체보강·최종DOM에서도확인했다.독립최종변경부C0/I0.
- helper는첫await전에work/session/command를복제하도록마지막보완했고독립C0/I0·Main49be87 영향시험5PASS를확인했다.
- 신규fixture literal/optional/transport-null·Editor반환형/빈tuple·DOM Promise<void>타입오류는시험/정확타입보정으로해소.메모리fixture이름치환2회실패는읽기로좁혀수정·제품기준완화0.
- 모델capacity terminal1회는제품FAIL로세지않고dirty/진행위치를확인해동일Primary로재개했다.새agent/model/동시writer0. Main제품코드직접write0.

- 커밋전 gitleaks5046ef는합성비밀거절fixture98행 generic-api-key 오탐1건으로차단/커밋0. redacted017b48에서대상을확인하고Primary가같은password패턴/길이거절을유지한명백한저엔트로피더미literal1곳만보정했다. Main9294ab가staged이전원문과의단일literal교체를검산·같은정확시험1PASS/0skip/345.7919ms·staged gitleaks no leaks(exit0)를확인했다. 제품/기대값/규칙/ignore/allowcomment/skip/Hook변경0. 이후정상커밋검사를다시거치며기존실패를숨기지않는다.

## 최종 지문 — 정확18
|경로|SHA256|
|---|---|
|apps/server/modules/access/project-command.ts|6DE5B3D31FEA8D953D8E49A418C0EE14720B7E760EA71C57354FF8CE5DF09318|
|apps/server/modules/approvals/approval-input.ts|DF56D836388B3BF02284C62B7024EEECFC5C3CD61867299C3901CBD94EB87881|
|apps/server/modules/approvals/project-approvals.ts|552B86FC46CC3C6606F55C8A1194929968E1DE23210EF778D80F23F5EBC9249C|
|apps/server/modules/executions/execution-understanding.ts|3591F00BDA890D7A6287674E1540E4E76CDFD55BDAC45058DC24C470BB753F48|
|apps/server/modules/executions/execution-understanding-store.ts|430B4F8221095ECA0C273BDC26F16495B7EC6E8E885D8A3C1597674D13495C9A|
|apps/server/modules/approvals/understanding-review-approval-candidate.ts|209CDE33126F2CDFDDA5844FEA9BD6CB3C66DDD43B4028602F346C4269020608|
|apps/web/src/features/session-detail/understanding-review-write.ts|D3097619D0A637C659F144E0E31262CC034502F5CF2CB80569D7F2D22A1B5A97|
|apps/web/src/features/session-detail/understanding-history-api.ts|2B867E93F09909C6E4C5C30384071DDF6D7B8604A1222C848FC47021F4D0BC89|
|apps/web/src/features/session-detail/UnderstandingReviewEditor.tsx|E3188742D376CE0B7EC6F284EDF3F263190A49078A3F05E714A197339C1B5DFA|
|apps/web/src/features/decisions/api.ts|23C259C563176AF80F6CA1AB716C70ACE0DFF979AE2877E946300B6C8553EA42|
|apps/web/src/features/decisions/ApprovalsPage.tsx|005102613714995542D645FBE8D63394E2A2729E0F2A40C8138E8865AD4DB3A1|
|apps/web/src/features/decisions/understanding-review-approval-api.ts|9C0986D41E84173A4FDD13D3DF33B686F7B19E170B576CA4C68DC80BB48D6E2E|
|db/migrations/0056_understanding_review_one_time_approval.sql.pending|E3EAE72B0C58277EEB223F238BE3C672D8D835ED1FA40E332730C14A06707E29|
|tests/unit/FN09/understanding-review-approval.test.ts|B050088081A64584F62BDD9CE256BA63F99EEF57759D826A715286C94FE1237D|
|tests/unit/UI05/understanding-review-approval.test.ts|91378225869D5CF2DEF6AB111108F01D20669D62E6F23BDEEAB161A32A7FDE74|
|tests/unit/UI08/understanding-review-approval-api.test.ts|F3B47392BBF840E68E22CBE6C7D44EB2605B461F667956C3112C8EF292F7D51E|
|tests/browser/UI08/understanding-review-approval-dom.test.ts|CE40171DC6922D8EF0DE5C97882E2A56CC07BD9B8756859F7D136EDCBB7FA58B|
|tests/browser/UI08/understanding-review-approval-dom-harness.tsx|19CA682C0FDC2AF150ADE8E18E3BEB250E694FC404654880D0D1D668711C0ED7|

## 미검증·가역성·다음
실제HTTP/PG접속·DDL/BEGIN·COMMIT/RLS·deferred 원자성/경합·실제source/응답/부분수신producer·OS/Agent·물리launch불명·전체shell/served·사용자인수는NOT_RUN.0056은미적용·실제GRANT/정책/계정/키/Secret/인증서/서비스/Agent/비용/Oracle운영변경0.실행tuple의존재·현재성을합성사실이나hash형식으로증명하지않으며FN06 HUMAN R2/다른후보를자동채택하지않는다.
rollback은한정18경로Gitrevert이며실제DB/runtime변경이없어환경rollback없음.기존dirty·보호8/원실패보존.전체Stagegate미충족이므로PR/main병합·branch정리0.다음은WORK_PLAN의남은기능과기존미채택계약/실공급자·현재실환경제외를분리하여선정한다.완료기능재개발·반복전수검사를개발진도로대신하지않는다.
