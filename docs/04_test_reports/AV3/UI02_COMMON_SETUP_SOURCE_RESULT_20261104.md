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
