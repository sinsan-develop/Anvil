# UI02 공통 도구·환경 정의→프로젝트 사본 source 구현 결과

날짜: 2026-11-04 / Main 어울 / 승인 call_190a168be3ae4b5783502f5243c8e116.
기준 r3 SHA55759195fb6c8b4045ecc7a54b933d32f6551e677ae38a2c061034183456d747, WI3f3b85b95064363f83077c0a559cc221fbc176640bb639a759698c179d136d3e.

판정: **부분 구현·A 서버 공통 원형 구간 source 한정 검수. B 초안/생성 사본·비용 및 C 화면 미완료. 실제 사용/전체 UI02·계획 완료 아님.**

## A에서 연결한 것

portable TOOL/ENV/3slot exact schema와 기존 USER_COMMON dispatcher의 새2명령→본인 인증/client·원형 불변version/회수·command/receipt/audit·유한 비용 검산, 실제 등록 읽기 route→목록/keyset/고정 원문을 구현했다. 기존7연산 분기는 보존했다. 합성 PoolClient와 Fastify app.inject가 실제 handler/생산 코드를 소비하며 실제 PG/영속성·served API가 아니다.

새0075는 미적용 초안이다. 개인 owner/RLS/불변 version·역완결/계상·공개권한 회수·deferred command/도메인 guard source를 포함하고, DRAFT 선택/B 사본 producer/프로젝트 quota 연결은 아직 닫혀 있거나 미완료다. 실제 DB 설치/집행 증거로 쓰지 않는다.

## 실제 검증·오류

| 범위 | 증거 | 판정 한계 |
|---|---|---|
| 입력 exact/모델 원값·비밀/권위ref 거절·생략/null | Primary cf35f0 module RED·09271b 행동3P1F→8db7594PASS; Main1afa24 4PASS/155.519ms | parser만 |
| cursor 서명/actor-client/필터/30분/20ACTIVE·badscalar | Main4843723PASS 후 kind 강제변환 한정I1; Primaryf6c0d7 RED→0463da GREEN; Main5765284PASS/143.2074ms | 실제 DB page 경쟁 미검증 |
| writer/불변/재전송·회수·정확 기한·Unicode/숫자 원문 | c60d4c4PASS·4f41b0 canonical 행동RED→4655c8 5PASS | 메모리 PoolClient |
| 실제 등록 route/목록/고정조회·origin/CSRF/추가query·CAS/owner·quota/장애·결과 원문 | Primary d4afee harness 설정 오류를 실제 buildApp 옵션으로 정정→0a37ac8PASS; 7d7bc4 결과원문RED→3ee7489PASS | app.inject·합성만 |
| cost/projection·command 역완결·세션/개인한도/불변·bare delimiter | ec86ed1P2F→c40866 8PASS(당시범위); a9128e가 실제5줄 bare 달러 적발→e94425 직접2PASS | SQL 형상·실 PG 문법/RLS 아님 |
| 최종 동결 A 명령9+schema4 | Main6e40d6 신규13PASS/skip0/596.558ms | 전체 연결/실 DB 아님 |
| root noEmit | Primary bb06e3 exit0·이후3906a8 정확 마지막exit전파 exit0/4.2461초 | 포함 코드 범위만 |

불변 input4+변경된 cursor4+최종 commands/schema13의 Main 직접 확인은 총21검사이며 하나의 명령으로21개를 실행했다고 주장하지 않는다. root 전체회귀/실DB/HTTP listener·브라우저/Agent는 실행하지 않았다.

## 검토 보완과 현재 정확 경계

Main47389e가 보정 완료 보고와 달리 실제0075에 AS 단일달러/END 단일달러가 남아 있음을 읽기 확인했다. 원인은 JS replacement 문자열의 이중달러 축약이었다. 최초 생성/보정실패2회와 최종 callback literal 보정·실바이트 음성 검사를 구분한다. 원 실패/미완료를 소급 PASS하지 않는다.

JS canonical의 Unicode key/숫자 표기와 이전 fn01_json 재직렬화 불일치 위험은 새 snapshot/request/result canonical UTF8 text + JSONB 동일성·SHA·TS reader의 exact canonical 재계산으로 보완했다. 고정 charge projection은 원문 text를 계상하고 병행 JSONB 값/원문 동등성을 따로 검산한다. 기존 global canonical·과거 SQL/hash·사용자 모델 원문은 바꾸지 않았다.

최종 A 공유 SQL27235B SHA c77b0101384ab91dae7474dcdf8bc48881807c8ece9b18e321d1e792012696cb, storage 기대 checksum 동일·bare dollar 없음은 Main2883dd로 확인했다. 후속 B가 같은0075를 확장하면 새 hash로 재검산해야 하며 이 값은 A checkpoint 지문이다.

준비 오류: sandbox Git128/권한은 환경과 분리, AuthFailure 비교식·invalid fixture의 reauthUntil string→Date·nullable/좁은 추론형·harness removeAdditional 설정과 마지막 shell exit 오인은 보정/별도 기록했다. 588ce7은 마지막 hash명령 exit0이어도 tsc 진단이 있어 타입 PASS로 세지 않았고3906a8의 정확 tsc exit0을 수거했다.

## 남은 작업과 복구

동일 Primary가 B의 draft 선택/저장·생성 원자 사본/출처·project used/held/역완결·정책/고정 조회와 C 실제 입력/선택/재진입/사본 화면을 이어간다. Main은 동일 코드 수정 없이 단계별 검수·통합한다.

실제 DB·권한·키·서비스·Agent·실자료 조사·J3 QA·P03 R3·기존 프로젝트 차단 해제는 제외/미실행이다. 소스 한정 결과를 실제 저장/기능 인수로 승격하지 않는다. rollback은 승인 branch의 해당 task source diff만 역적용하며 실제 DB rollback 실행은 없다. 보호3·Main docs·타 기능을 복원/삭제하지 않는다.


A staging 검산: Main378579의 엄격 raw 동일 검사는 신규 TS 시험2의 기존 Git CRLF→LF 필터 때문에 중단됐다. e3b1ad에서 그 두 파일은 오직 해당 줄바꿈 차이임을 확인했고 working/설정/과거 fixture를 수정하지 않았다. Git blob은 commands 시험15146B/d15822a0f4b872f85d9c091f1c33bf50cdc0413774adc3f34b9cc44d72bea6cb, schema 시험2317B/27b910a04dc04094fae326cc3981254810aad251cce71c32954ec1bf4789e1c2다. 다른 A13 source는 working/staged 완전 일치이며 고정0075 원바이트/hash도 동일하다. 이 비의미 필터 차이를 원 runtime 테스트 실패나 과거 원형 hash 변경으로 쓰지 않는다.


### 2026-11-04 Main 입력·codec 한정 독립 검증
Main da952f: `node --test tests/unit/FN01/common-setup-input.test.ts` exit0, 6PASS/skip0/560.8819ms. 실행 전후 runtime SHA256 `06361D84820AC70D791C4A0C14509D878E13192309BCA3564534E2836F59D83E` 동일. 원형 auto/JSON 보존·권위/추가키/getter/중복·2MiB초과 거절·outer/ref/민감입력·생략/null·NUL/key/literal/marker/Unicode/작은숫자·lexical token경계를 Node 생산함수에서 확인했다. 이는 pending SQL projection/실제 PG·원자 생성·사본 보호 GET·C 화면 통과가 아니며 해당 구간은 계속 미완료/검수 전이다.


### 2026-11-04 사본 조회 최종기한 보완 독립 확인
Primary a29125 fixture괄호준비오류1·4c4800 실제만료응답RED→39a341 보호GET/지연기한2PASS/899.8939ms를보고했다. Mainc27340에서 `node --test --test-name-pattern='보호|지연' tests/unit/FN01/project-setup-copies.test.ts` 직접2freshPASS/skip0/482.692ms를확인했다. copyhelper B77253FC8E4C90A6DA00DEAA8E17C91B8F18FC9343CDAB81E64D77A80D5D27FF/runtime06361D84/accessprojectcommand2C998021의실행전후지문이동일하다. 현재member/정확AUTO·DENY/일회승인/타project본문0 및SQL응답지연중session/policy만료본문0의Node/메모리증거이며실PG/RLS/동시권한회수·전체생성여정·C화면은미검증이다.
Primary는B실제createProject 전체성공/COMMITTED재진입·settle/adopt실패rollback의합성여정을작성중이며C는아직미구현이다. Main은완료된한정검사를반복하지않고해당전체producer여정과C의실제소비구현검수를이어간다. 단독writer·기존guard·실행제외불변,전체계획목표active/미완료를유지한다.


### 2026-11-04 B 실제생성 합성여정 제출·최종 refs 기한 검수
Primary가 신규 tests/integration/FN01/common-setup-synthetic.test.ts의5178e4 실제3PASS/skip0/583.3084ms를제출했다. Main3f3576/673216 읽기에서기존AccessRepository/ProjectsRepository/DraftArtifacts와메모리namespace 포트를소비하여원형→초안→동일TOOL두독립사본/정산/원quota채택→COMMITTED/상세ref재진입·회수원형의역사사본고정조회,settle/adopt거절rollback·원선택보존·회수/provider부재reserve/IO전거절을확인했다. 메모리포트는SQL함수/수치식/RLS를실행하지않으므로실PG/저장량수식통과로승격하지않고Mainfresh동작검수는coherent Bcheckpoint후수행한다.
별도quota읽기검수는0075E3A86FF2CA5D7763C3EBAD101610B63D238BC55FB2C5E9B677393C4A6AA587A2/storagechecksum동일에서부모0073기존manifest/receipt/audit·used/held·역완결·deferred정산·역사사본·권위/RLS/목적EXECUTE에추가finding0,ref조회반환전원session/member기한보호1건(C0/I1)을확인했다. body최종기한수정과같은방향으로이미Primary에배정한항목이며중복새지시/기존body검사반복0이다. metadata조회에새본문AUTO정책을요구하지않는다.
현재Primary는refs기한·B타입/legacy최소회귀후backend/runtime/SQL/B시험checkpoint를동결하고C web/API/selector/editor/buffer/생성후재조회로이어갈예정이다. 단독writer·Main제품쓰기0·실DB/권한/키/서비스/제품Agent/실자료/J3/P03R3제외유지·전체목표active/미완료다.


### 2026-11-04 B 서버/사본 source-only checkpoint 검수
Main 독립 c02e47의 6개 직접·인접 파일 44PASS/skip0/2061.5229ms와 변경scope18 전후지문 동일을 확인했다. Primary B25경로의 최종 noEmit·diff0을 수거했고, SQL 최종refs반환 직전 scope재검산·Node 최종session기한을 확인해 읽기/메모리 범위의 미해결 Critical/Important는 없다. 실제 PG문법·DDL·수치식·RLS/ACL/경합·실FS/served/browser는 NOT_RUN이며 C 화면/전체UI02·계획 완료가 아니다.
Main81798a는 B변경20경로+Main문서3 정확23만stage, C진행파일/보호3 제외를확인했다. 새0075 Gitblob SHA256 f9dd6b1730da8d5428c6ccb66b3169758baa0c0a5ecc789f7c426559171f472c는workingraw와동일하다. 기존*.ts LF규칙에따라다음9파일만CRLF→LF외차이0을검산했고working파일/기존규칙/과거fixture를바꾸지않았다. 해당Git정규화는실제원격QA실행증거가아니다.
정규화검산: [{"path":"contracts/runtime/user-common-setup-v1.ts","workingBytes":7836,"gitBytes":7835,"gitSha256":"20aa810591d3e65bdc9764d55941e8c1de512577416b8dba29b4296037460e57"},{"path":"apps/server/modules/projects/draft-common-setup.ts","workingBytes":4980,"gitBytes":4976,"gitSha256":"f3a20c4c844eb4d1daaa9e6bd5b8edcc3d57bd06be866b09efaa947aebaf6094"},{"path":"apps/server/modules/projects/project-setup-copies.ts","workingBytes":6807,"gitBytes":6804,"gitSha256":"cc0f06a56d9bc10b6cdc13b56b2ae7b8a9049976f11d953523bfa52a0099ce23"},{"path":"tests/unit/FN01/common-setup-input.test.ts","workingBytes":5753,"gitBytes":5751,"gitSha256":"44da6f1934417ea7213763d158369ec0b71fdc483a53aca270464011a6519c7d"},{"path":"tests/unit/FN01/common-setup-commands.test.ts","workingBytes":17055,"gitBytes":17051,"gitSha256":"be5d33110fa1efc6348dd20bb784025c9e981512e77426113c7ab9f1ea29fd07"},{"path":"tests/unit/FN01/common-setup-schema.test.ts","workingBytes":2867,"gitBytes":2865,"gitSha256":"db4f92b7448741fe55114d31b992f489d0c6433225b2e65ac143473358a7b2ac"},{"path":"tests/unit/FN01/draft-setup-selection.test.ts","workingBytes":7918,"gitBytes":7915,"gitSha256":"6850193d59e96f0fe7df5cacb01c760ecccbf392efe8f66c2cc1de922895e1a5"},{"path":"tests/unit/FN01/project-setup-copies.test.ts","workingBytes":10540,"gitBytes":10534,"gitSha256":"c8d51730c7d2fc591721686397b98d3b7beb9843d9eb3faf6165fa3e9ae2dc92"},{"path":"tests/integration/FN01/common-setup-synthetic.test.ts","workingBytes":18433,"gitBytes":18432,"gitSha256":"76b404485bdaebb28db828db4ed110aa3c39060e7695b91c930c129ddead2b64"}]
