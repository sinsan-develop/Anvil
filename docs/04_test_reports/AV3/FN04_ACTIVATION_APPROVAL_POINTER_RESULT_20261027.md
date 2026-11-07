# FN04 설계 변경 승인·적용 기준 조회 — 구현·검수 진행 기록

## 현재 판정
**부분 구현 — 승인된 서버·화면·미적용 SQL·합성 핵심 검수 범위 완료.** 실제 DB/served·사용자 인수·실제 기준 전환·전체 FN04/WORK_PLAN 완료가 아니다.
신산님 직접 승인 call_fa997b24d02f4905b251e0f55c46ed63의 ‘위 범위 계약·구현 승인’에 따라 부모84C4AB82와보완92602F25를 함께 소비했다. 승인 기록CF12C717·WI69EF6664·초기manifestF5129CC1이 범위를 고정한다. source 기준0def97b7, 문서안전checkpoint59918bc9, branch codex/av3-stage-b. Main 어울은 제품 직접 수정0·관리/검수/통합, 초기작성 ui08_reported_download와 보존 인계 후 I1·Panel 한정보완 fn04_activation_context_fix는 순차 단일 작성자, p03_discovery_review는 독립 읽기검수다.

## 서버에서 연결한 범위
- 기존 exact5필드 입력·보관 관계 검사를 재사용했다. 새 activation 후보는 원 payload/hash·원요청 command/정책/주체/client/세대·change target/이전기준에 결박해 보관·보호 조회한다. reason은 기존 검사와 well-formed/NUL 방어로 보호하며 원값을 정규화하지 않는다.
- 공통 명령/정책/FN11 request·decision·authorize·consume에 해당 연산만 추가했다. 다른 연산의 빈 baselineRefs 조건·기존 caller 기본값은 보존했다. activate AUTO로 일회승인을 우회하지 못한다.
- 현재/고정 GET2는 현재 OWNER의 적용 사실만 조회한다. 원후보 이유는 계속 현재 OWNER+원요청자만 조회한다. NONE은pointer/history모두없을때만, schema/관계/유실/변조는503이다. 고정 과거는 정상 이력이며 최신으로 교체하지 않는다.
- 내부 ID예약 한 개로 snapshot의 실제 소비UUID와 receipt/consume를 결박한다. 원pointer 상태에서 최종 authorize/consume를 끝내고 같은transaction의 activation·AFFECTED 재확인·pointerCAS를 수행하는 저장 routine을 연결했다. 동일명령 소비replay는 현재auth/policy/control 후 신규CAS보다 먼저 반환한다.
- **생산 activate는 실제 관계의 unverified를 보존하고 §6 근거 부재로 항상412**다. 내부 합성 저장 port가 HTTP/DTO/생성자 준비flag로 노출되지 않는다. 후보 보관/조회·승인 결정은 이 실제 안전gate로 일괄 차단하지 않는다.
- 새0050_design_baseline_activations.sql.pending는4개표/원자귀속·이력/guard 보호의 미적용 소스다. 정식 migration manifest·기존SQL·사용자정책·실DB를 바꾸지 않았다.

## 소스 지문·변경 전후 근거
업무1은 서버8+시험5=13파일이다. 정확 경로·초기raw는 초기manifest에, 1차 최종raw는 FN04_ACTIVATION_SERVER_CANDIDATE_MANIFEST.json SHA02144303032D2941D79B170BE4031815060D8650BB9D4497E9B527F939D980A4에 있다. 검수round1의변경2개는 FN04_ACTIVATION_SERVER_REVIEW_R1.json SHA343FBACEA190EF423CC12C30595EAC7C253A95439A172FAE2C0DBE56170C5D51로결박했다.
최종 SQL raw824B1695CB77E8330C8CDBEB6D3FED28AF4E9CEC76433234DD4CD16EB579E855·read시험78C946778073A1A3E8ABDEB227949C8B81020530A5ADEB37E21BD3DEF8247517,나머지11raw는원packet과동일이다. Mainfce7c7은SQL의STABLE두선언을메모리에서원복하면원SQL65979FEC와완전동일임을확인했다. 현재성/clock/DMLguard·UI5/보호8은불변이다.
기존서버diff는공개연산한정등록/제한된서버내부예약·configured document reader 전달/해당후보·GET dispatch다. 기타공통권한·리팩토링·새의존성은추가하지않았다.

## 실제 검수 명령·결과
1. TEST_ONLY source5 동결 뒤 Main dbe52f:

    node --test tests/unit/FN04/baseline-activations.test.ts tests/unit/FN04/baseline-activation-read.test.ts tests/unit/FN04/baseline-activation-routes.test.ts tests/unit/FN11/design-activation-approval.test.ts

19수집/2PASS17FAIL/skip0·3836.9905ms/exit1. 12건은정확신규module부재,5건은실GET/operation/generation/scope·targethash 미연결의기능RED였다. fixture·기존replay2는통과했다. 실DB금지pool/Fastifyinject이며listen0/실DB0이다.
2. 담당중간66PASS(신규24+인접42)와후속집중9는각구간증거로만기록한다. 이를최종67단일run로바꾸지않았다.
3. Main0fda5c는위신규4파일과다음인접8파일을같이실행해 **67PASS/0FAIL/skip0·1352.9022ms/exit0**를확인했다.

    tests/unit/FN11/approval-input.test.ts
    tests/unit/FN11/approval-list.test.ts
    tests/unit/FN11/work-plan-approval-candidate.test.ts
    tests/unit/FN11/work-plan-approval-consumption.test.ts
    tests/unit/FN11/source-detach-approval-target.test.ts
    tests/unit/FN11/source-detach-approval-consumption.test.ts
    tests/unit/FN01/baseline-approval-input.test.ts
    tests/unit/FN01/baseline-approval-consumption.test.ts

기존기준선·분리·계획승인/원명령/replay·목록·새생산activate412/쓰기0·실receipt예약UUID/oldcaller·합성인증GET와snapshot조회범위를확인했다. Maina9359c type0도별도확인했다.
4. 독립시험검토C0/I2는실activate호출누락과fixturerollback과장두곳이었다. 실제method/route연결·실persist/consume예약ID검사추가와시험표현한정으로해소했고서버검토에서확인했다. 합성배열복원을실DB전체rollback증거로보고하지않는다.
5. 독립서버검토C0/I1은SQL읽기함수기본VOLATILE로인한중첩snapshot공백이었다. Mainf06fd6의새정적반례1은0PASS1FAIL/skip0·118.1642ms/exit1. 같은담당이순수읽기history/candidate의header2곳만STABLE로보완했다. Main5ab38b는read.test6건 **6PASS/0FAIL/skip0·285.0675ms/exit0**,fbac39는추가된TS반례포함type0을확인했다. 이전67+후속6을최종68단일실행이라고하지않는다.

    node --test --test-name-pattern='읽기검증함수체인의STABLE선언' tests/unit/FN04/baseline-activation-read.test.ts
    node --test tests/unit/FN04/baseline-activation-read.test.ts
    node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json

독립한정재검수 원I1 ADDRESSED/C0I0·SQL역지문/순수함수체인IMMUTABLE/STABLE·다른clock/current/DMLguard불변을확인했다. 새검사는SQL설정의정적반례이며실PG동시성의증명이아니다.

## 오류와 제한
WI의필드수19오기는구현전18로정정·원계약불변/재검수C0I0다. 담당첫1107a2 14PASS3FAIL/type24c526은소유routes String.replace의dollar치환손상·schema오류503래핑누락·overflowfixture의previousnull모순으로분리했다. 소유routes를초기DF7833raw대조후자기변경만교정했고overflow409기대는유지한채정합참조만보완했다. 중간시험타입추론진단은명시타입으로보정했다.
부재canonical source읽기1·PS literal wildcard읽기3·편집EOL접점1은도구오류로기록하고같은방식재시도를중단했다. Mainf991bc sandboxGit읽기오류는1cf98a의정확승격읽기로대조했으며config/ACL변경0이다. 동일근본유효제품실패3회/인수조건은발생하지않았다.
실제PGcompile/DML/COMMIT/deferred제약/경합·정식DB저장/HTTPserved·실안전source·실기준전환·사용자인수는 **NOT_RUN**이다. 현재권한은실제정책을자동부여하지않으며user기능전체가사용가능하다고하지않는다. UI업무2도아직미구현으로남아있다.

## 다음과복구
같은단일담당이신규UI시험4만TEST_ONLY로작성하며MainfreshRED전UI제품0/브라우저QA0이다. 실제App→UI07→UI08→UI07동선을검수하되위젯/합성응답을실DB여정으로승격하지않는다. UI07원입력/명령/버퍼·별도요청/결정/결박·412/유실·이력조회와이탈지연을보존한다.
rollback은이번소유서버/시험/미적용SQL의정상revert이며원자료/DB·승인/소비/보호8·P03소진원장은삭제하지않는다. 전체Stage게이트전PR/main병합·배포·전체완료0이다.


## 서버 checkpoint index 대조
Main6f53b1은정확19경로stage/보호8·UI5불변/cachedcheck0를확인했다. 서버/시험13중5는raw동일·아래8은CRLF→LF만이며working source/Git설정/기대값을바꾸지않았다. 문서6은raw/index동일이다. 실행한raw와게시index지문을구분하며의미동일EOL만으로동일검사를반복하지않는다.
| 파일 | 게시 index SHA256 |
|---|---|
| baseline-activation-record.ts | 65CECDB1581BA74FF9FFCB9921654463067EDE0A36943B5135FF4028EF9A3BBE |
| design-activation-approval-candidate.ts | 87D11CA45161303962758DD346AD42F76DF0E0A89B4AE8E414990503A75D4BA7 |
| 0050_design_baseline_activations.sql.pending | 0091AE0FFF925A086CA0912CE8B676100FC578944F40018254CE4E908981C928 |
| baseline-activation-fixture.ts | 569F567996B9E3917AD65714B64C0E32C2FE7EE3DBC56CC7DEA1D098FAFDD696 |
| baseline-activations.test.ts | 3BC0AC57616FA00DE95760311C1C955CF3ACCC2F3439CA4AD5E73D2A50CB807D |
| baseline-activation-read.test.ts | 2B8FA67E6F1015139E023521B66115AB42E84896221DC798EB74F90C3392608E |
| baseline-activation-routes.test.ts | 4111F36A71B51FFC695FDD29BE632859C674AB235695DF55DB798F6472535AF3 |
| design-activation-approval.test.ts | 9FB81808FD013BEC838268C984D54AFF8E868417B65960EAACBF6868D81E4E8B |

## UI 연결 단계 — Main 실패 관측과 구현 인계

- Main API `68a289`: 신규2파일10수집,0PASS/10FAIL/skip0,182.2153ms,exit1. 신규 UI API 부재9건과 기존 ApprovalView의 activation 후보 거절1건이다.
- Main 실제App 합성DOM `b6246b`: 1수집/0PASS1FAIL/skip0,7154.8549ms,exit1. 세션·기존 변경 보호원문·hash가 성공하고 예상외요청/pageerror가 없는 상태에서 `설계 변경 적용 준비` 버튼을 찾지 못했다(3500ms). bootstrap/fixture 실패가 아니다. 실행 DOM raw ABDD12E03A6A58EF05318BD6EB69087045C57315203424B81F710F9AF38E6A81.
- 등록 QA 생성 2026-10-27T12:17:56.857985Z, exact owner/link/creation/process 대조 후 `5f7a8c`에서227파일/81디렉터리/16013896bytes,PNG0 개별 회수. `49a61f` 12:18:42.2430313Z 별도조회 경로/관련프로세스0. 실제 서버·DB·Agent·사용자 브라우저0.
- Main 사전guard `a19349`의 manifest 키 오기(files 대신 실제 allowed)는 QA 생성 전에 중단했다. `66ecbd`에서 실제키/QA부재를 읽어 확인하고 키만 고쳐 실행했으며 제품 실패나 통과 증거에 합산하지 않는다.
- 독립 TEST_ONLY 검수 C0/I1: helper Scope 단위시험만으로 실제 UI07 선택 A→B→A 중 늦은 응답 회수를 증명할 수 없다. 동일 담당이 제품 작성 전에 DOM 반례1개를 추가, raw63E74BBA683B1F6A883C5A84286FCF9F910C543A6C672841CA87FC03EB452B28로 기록했다. 실제 반례 실행은 아직 NOT_RUN이며 기존 API2/harness/timeout/기대는 보존한다.
- 같은 단일 담당이 WI UI제품8경로를 구현중이다. Main 제품수정0. 최종 소스/독립 검수·fresh DOM GREEN·실제 PNG 검수는 아직 남았다. 합성 SUCCESS가 향후 통과해도 실제 기준 전환·PG/서비스·사용자 인수/전체계획 완료가 아니다.

- **FN04 I1 actualApprovalsPage Main RED·보완GO**:새담당TEST_ONLY harness47777654/DOMBCD34A76 type·메모리build0뒤Main335f43 새선택case는1수집/0PASS1FAIL/skip0·2357.533ms/exit1, user준비해시문맥교체POST0기대에서actual1로실누락을재현했다. 최초생성12:50:13.100239Z의등록새빈QA는68f07c185files/60dirs/13952561bytes·PNG0/process0개별회수→e4be2c 12:50:51.9309425Z별도root/process0. 같은새단일담당에게I1한정제품GO,원후보command별최초scopecapture보존/현재render epoch·helper해시후검사/기존pending직전·늦은수집후속GET검사를보완한다. 새capture로같은옛work를문맥교체뒤부활시키지않으며원명령/불명전송상태·같은문맥수동확인보존·다른승인불변이다. Main제품write0/정식DB·서비스·Agent0·전체계획미완료.

- **FN04 I1 보완1 Main 검수·후속GET 잔여**:Main6797de 신규12+직접인접23=35PASS/FAIL0/skip0·513.9676ms,5004ba type0. 독립5raw일치·원준비/pending POST/늦은POST영수증경계해소이나load내readApproval JSON/hash후alive/sequence만검사하여same-mounted문맥교체뒤원후보reason수집가능한잔여I1을확인했다. 같은담당은제품동결후이미시작한보호GET/JSON/hash중교체DOM반례를별도case로작성한다. MainfreshRED·exactQA정리/독립0뒤그수집선만한정수정·다른승인불변/실DB0으로이어간다.
- Main문서check의혼합CR경고는8a4868의현재추가hunk/정본동일대조후1e24fa에서추가줄의CR만STATUS16/RESULT11줄제거,논리내용동일/기존이력바이트보존·diffcheck0로정리했다. f6caa1의rawHEADprefix단순비교실패는읽기guard이며초기6행Main메타변경때문에append-only전체prefix가아니었고제품/이력복구0이다.

- **FN04 I1 후속 보호GET actualRED·정리**:TEST_ONLY harnessA8901DE1/DOM E62BF876·type/memorybuild0 뒤Main3f8c05의선택case1수집/0PASS1FAIL/skip0·7438.2545ms/exit1은get/user교체후이전원문수집0기대actual1을확인했다. 시작된원문GET의실수집누락이며초기bootstrap실패가아니다. 생성12:58:47.9946173Z의등록새빈QA는98f27c182files/60dirs/13795002bytes·PNG0/process0개별회수→e85e3e12:59:18.3096228Z별도root/process0. 동일단일담당에게load내JSON/hash후setView/onChange/오류반영전scope검사/자동selectedId보호만GO·다른승인불변·기대/상한유지. 제품실패기록보존/실DB·서비스·Agent0·Main제품write0·전체계획미완료다.

- **FN04 최종DOM 부분통과·정상화2건**:Main733039→동일handle23935/1a6efd는3수집/2PASS1FAIL/skip0·11594.4422ms. 준비/pending/늦은POST및보호GET/JSON/hash문맥회수2case는통과했고actualApp초기render는새Panel의undefined ref→ordered JSON.parse 오류로실패했다. Maine948b3가동일빈선택식으로SyntaxError를재현한뒤동일담당이ref2곳만null보완(C4127EB9),Mainc7e6d1역치환원7BA91raw일치를검증했다. 해당QA9298f5 243files81dirs15408138bytes/PNG0회수→68964c별도0. Mainbf68b7는foreach의in공백오기PS파싱오류로생성전중단이며그후공백만교정했다.
- 후속c7e6d1 normalcase1FAIL/skip0·7344.0171ms는요청→승인→결박→412/유실같은명령→합성SUCCESS/현재/고정·과거이력까지진행한뒤전역첫hash선택자가닫힌details의hiddenpre를집은시험선택문맥충돌이다.590efc 실제fixedregion p에정확hash표시확인·제품그대로/시험구문만해당region p로한정지시. 부분흐름PNG2를직접보았고00CBF4F5/8BCDA738 지문은실패이력에보존하되최종PASS로승격0. f153d4 230files81dirs27681736bytes/PNG2회수→81e1bf13:09:40.2543449Z별도root/process0. 실제DB/서비스/Agent/전체계획완료0이며정상case남은음성·최종PNG는아직미검증이다.

## UI 승인 범위 한정 최종 검수

- Main6797de: 신규12+직접인접23=35 PASS/FAIL0/skip0,513.9676ms. 최종 Main31658c 프로젝트type·UI12지문·scoped diff/trailing-space0. 담당의메모리build/type결과는Main실DOM의실제Vite write:false 빌드와구분했다.
- Main733039→1a6efd: 실제ApprovalsPage 문맥회수2case PASS,정상App초기render1FAIL(보존). 이후Panel2null/기존양식class1외불변을역지문으로확인했고,정상App의숨은hash/중복heading선택문맥2곳만범위한정해같은문구·fullhash·visible·timeout을유지했다. 최종Main13e933 선택normal1case PASS/FAIL0/skip0·5162.5283ms. **2+1의분리실행증거이며최종단일3PASS로합성하지않는다.**
- normal실제App는UI07후보고정→UI08요청/별도APPROVE→UI07원명령결박→412무소비/유실동일명령→합성영수증/current/fixed/과거이력→불일치후보/403/선택ABA·이탈뒤늦은current후속GET0을확인했다. controlled2case는준비·유실재전송·늦은POST와보호GET/JSON/hash의주체/문맥교체수집0을검사했다. 독립원I1/후속I1및Panel3literal검수는모두ADDRESSED/C0I0다.
- 최종PNG2 Main31658c 보존/직접시각확인: [UI07](FN04_ACTIVATION_UI07_20261027.png) 70104bytes SHA D677AEFEA89E8DD2CBE1E7D3790EFEF6FE8821F0D01A7D0794142F98AC442186; [UI08](FN04_ACTIVATION_UI08_20261027.png) 24447bytes SHA F3958EF91746CC2984E8CEE9F3EEAAD085CCE3EDE0FBB8E910D8CFFE90644AD7. 합성자료이며실서비스/사용자인수가아니다.
- QA생성13:14:20.1962889Z,ff1602에서189files/60dirs/26302788bytes·PNG2·관련process0을정확개별회수했고8baa53 13:15:38.9040901Z별도root/process0을확인했다. 이전모든실패인스턴스도각정리증거를보존했다.
- **실제DB/0050실행/COMMIT·RLS·경합/정식API·served/실기준전환/실제Agent·사용자인수는NOT_RUN**. 생산§6실안전gap412유지·정책/권한/Secret/서비스변경0. 이번직접승인의source/UI/pendingSQL/합성검수범위만한정인수하며전체FN04/UI07/UI08/Stage/WORK_PLAN은미완료다. 후속은P03실복구·정식DB/계약적용및실안전공급자/기존FN16미결과분리해대조한다.

- Main exact19 index 검수: 허용 UI12+소유 문서/PNG7만 stage,보호8 지문·HEAD62972/기존main 확인·cached diff0. working/index 차이는 CRLF→LF만이며 지문을 UI candidate manifest의 indexSha256에 별도 보존했다. 제품 바이트/기대·Git설정 수정과 반복시험0.
