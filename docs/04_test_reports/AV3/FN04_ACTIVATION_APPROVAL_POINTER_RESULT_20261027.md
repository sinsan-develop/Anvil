# FN04 설계 변경 승인·적용 기준 조회 — 구현·검수 진행 기록

## 현재 판정
**부분 구현 — 서버 소스·합성 핵심 확인, UI 연결 진행 전.** 실제 DB/served·사용자 인수·실제 기준 전환·전체 FN04/WORK_PLAN 완료가 아니다.
신산님 직접 승인 call_fa997b24d02f4905b251e0f55c46ed63의 ‘위 범위 계약·구현 승인’에 따라 부모84C4AB82와보완92602F25를 함께 소비했다. 승인 기록CF12C717·WI69EF6664·초기manifestF5129CC1이 범위를 고정한다. source 기준0def97b7, 문서안전checkpoint59918bc9, branch codex/av3-stage-b. Main 어울은 제품 직접 수정0·관리/검수/통합, Primary ui08_reported_download는 단일 작성자, p03_discovery_review는 독립 읽기검수다.

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
