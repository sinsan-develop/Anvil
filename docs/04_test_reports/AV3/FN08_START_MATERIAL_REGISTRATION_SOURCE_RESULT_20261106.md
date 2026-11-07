# FN08 START 두 그룹 자료 등록 source 결과

2026-11-06 / Main 어울 / source-only 한정 인수 / 전체 작업계획 미완료

## 판정과 범위

승인된 FN08 START 등록 A안의 코드·미적용 SQL·합성 검증 범위를 인수한다. 기존 Primary가 정확 허용11을 작성하고 Main은 독립 검수·직접 검증·통합만 수행했다. 실제 기능은 부분 구현 상태다. 정식 DB 설치·현재 보호 원문 supplier·실행 권위·기본 app 연결·실제 Agent 전달·사용자 인수는 완료되지 않았다.

기준 branch는 codex/av3-stage-b, 작업 시작 및 Main 최종 검증 HEAD는 2663dea72a609a02f81d468682a02b7b9d41576a다. 최종 검증 전/후 허용11·보호3·WI 지문이 동일하고 index는 비어 있다. 기존 tracked 변경은 queue와 ledger, Main 현황 문서2뿐이며 신규9는 이 지시서 허용 파일이다. private push·원격 동일성·PR/main 병합·배포는 수행하지 않았다.

- 직접 승인 기록: docs/work_packages/FN08_FN09_START_PREPARATION_SOURCE_DIRECT_APPROVAL_20261106.md / SHA256 C82C16EB3AAE2035B8273392549130702167396ACD34095A4617E2D21B6A228B
- 채택 계약: docs/contracts/FN08_START_MATERIAL_REGISTRATION_CANDIDATE_20261106.md / SHA256 8AE16D6CAB5334FAC4548688777AE44560997BB0D0C78816CB340A114A7E4384
- WI r2: docs/work_packages/FN08_START_MATERIAL_REGISTRATION_SOURCE_IMPLEMENTATION_20261106.md / 10655B / SHA256 51F8FE9E78BB8E0FF3ED449B1C4B8A1236808E31FA269A7AB17AA271C554AC21

## 변경과 보존

원 START payload/queueIntent/ProjectResult·봉투·14필드 material·connector GET/오류 wire는 유지한다. 실제 registrar가 없으면 명확히 거절하며 기본 app/실환경에 성공 대역을 주입하지 않는다. 두 그룹 CONTEXT_BUNDLE→START_OPTIONS를 descriptor와 manifest 한 개로 묶고 실제 FN09 preparationRef와 Options 본문 bytes/hash를 구분한다.

원 authenticated Tx 안에서 source/current·descriptor 준비→원 receipt/envelope→실행/grant/예약/writer/outbox·manifest/material→최종 source/등록 완결을 연결한다. 불변 원 결과의 역사 replay는 원 저장 관계를 읽고 새 source/body/등록/charge를 만들지 않는다. 현재 로그인/controller/policy·원 actor/client/명령은 유지하며 fresh 부분 접근은 현재 세대·권한·최소기한을 계속 요구한다.

같은 proof의 receipt→정확 material binding→nonce 소비→마지막 current/bytes 검사를 소비한다. 이미 소비한 결과의 binding을 사후 보충하지 않는다. 기존 세 표의 SEND+START 전체 이력과 같은 grant ID의 모든 버전·credential 세대·만료 이력을 프로젝트 100000행/1GiB·grant 10000행/64MiB 합산에 포함한다. 원문 경로/본문/Secret을 metadata에 저장하지 않는다.

기존 공통 wrapper2와 0062 원문은 불변이다.

| 원본 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/executions/execution-instruction-material-store.ts | 8000 | 84B9842D3CE252D1578B1D586DA8238C9BE263EFCB45A290B0C77600B8D461DC |
| apps/server/modules/executions/execution-authenticated-materials.ts | 6907 | 0845D7AD5F303ECF88325B6D25175AADD2C5185D9E8E56C9F25F5D743F60DA12 |
| db/migrations/0062_execution_material_registration.sql.pending | 25033 | 4EFEF392105984B5B1969B480D2D9AF2F3EFEA4F0E855F1730A9152019E3987E |

새 SQL0078은 forward source이며 실제 적용하지 않았다. SEND 세 함수 rename/위임과 기존 INSERT/current/합산 guard·proof 완결을 재사용한다. 원 command/receipt/audit/grant/예약/writer/outbox·preparation/Options bytes·각 material의 원/역완결 및 deferred trigger 접점을 추가한다. 실제 SQL 설치 가능성을 정적 검사로 확정하지 않는다.

## TDD·검수·실제 Main 검증

최초 기존 queue의 적합 START가 등록 없이 성공하는 행동 RED를 Main040f7c에서 재현했다: 2시험 중1PASS/1FAIL, skip0, 616.421ms, 시험 exit1. 누락 module이나 fixture 준비 오류를 기능 RED로 세지 않았다.

검수 중 다음 결함을 보완했다.

1. 배열 custom prototype의 inherited entries getter/빈 iterator로 descriptor 검산 우회: Main1f68d6 실제 trap1/accepted true 후 신규 반례 RED→GREEN·Main049456 5PASS, 독립 I1 해소.
2. project+외부 commandId만으로 manifest를 고른 actor별 이력 충돌: 내부 command fullref/created_command_id로 결박.
3. 역사 replay에 현재 봉투 만료·source/body 및 현재 credential 세대를 요구한 회귀: 역사 저장 관계와 fresh 전달 권위를 분리. Main32a89c 2PASS 및 c5812d 추가2PASS, 각각 독립 한정 재검수로 해소.
4. SQL Options SHA의 미선언 public.digest 의존: 기존0077과 같은 내장 sha256 한 곳만 사용. Main155917 정적4PASS·독립 역치환 이전 지문 일치로 다른 본문/권한 보존 확인.

원 ledger의 domain 및 기존14시험 본문/기대값은 Main cb9034에서 기준2663dea와 LF 정규화 후 각7680B/SHA256 7FC97B997FFF9D96152F6727DB73BC6EF6F0BD6340682E928E70BA7730644F38로 완전히 동일했다. 실제 registrar·Options compiler와 등록표/rollback·정상 COMMIT tag를 fixture에 연결하고 등록 중간 rollback1을 추가했다. 성공 registrar 메소드 대역·기대값 완화는 없다.

최종 Main 명령:

~~~powershell
node --experimental-transform-types --disable-warning=ExperimentalWarning --test tests/unit/FN08/execution-start-material-registration.test.ts tests/unit/FN08/execution-start-material-registration-store.test.ts tests/unit/FN08/execution-start-material-registration-schema.test.ts tests/unit/FN08/execution-start-material-registration-flow.test.ts tests/unit/FN08/execution-command-ledger.test.ts tests/unit/FN08/execution-material-registration.test.ts tests/unit/FN08/execution-material-registration-store.test.ts tests/unit/FN08/execution-material-registration-schema.test.ts tests/unit/FN08/execution-instruction-material-parts.test.ts tests/unit/FN08/execution-materials.test.ts tests/unit/FN08/execution-material-receiver.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
~~~

| Main 실행 | 실제 결과 |
|---|---|
| 4094a3 / 직접 영향11파일 | 106 PASS, fail0, skip0, cancelled0, 4238.1582ms, exit0 |
| a18e55 / TypeScript | exit0 |
| 243d6e / diff check | exit0 |
| c41704 / 검증 전 지문 | 허용11·보호3·WI·빈 index 고정 |
| 검증 후 지문 | 허용11·보호3·WI 동일, 기존 공통 wrapper2 불변 |

106에는 신규 parser5/store3/schema4/flow17, 기존 ledger14+추가1과 직접 인접 회귀가 포함된다. Primary의 이전104 및 추가2, Main의 부분5/2/2/4 등은 같은 시험의 부분 실행이므로 별도 합산하지 않는다. Main 출력은 중간 개별 PASS 줄이 도구 예산으로 일부 생략됐으나 실제 종료 코드와 전체 집계는 수거했다. 재실행 없이 원 결과로 기록한다. Web 제품 변경이 없어 이전 FN09 build를 반복하거나 이번 build 증거로 재사용하지 않았다.

독립 담당자는 parser/저장·역사/fresh/SQL/ledger/종단 및 최종 음성2를 각각 읽었고 지적 해소 후 한정 C0/I0/M0다. 최종 추가2는 유효 P256 서명이어도 다른 target/grant의 자료·nonce·binding·수신 효과0과 실제 registrar 쿼리 소비의 bytes cap/cap+1 rollback을 확인한다. 구체 DB 집계는 메모리 모델이다.

## 확인된 기존 제한·미검증

- 구체 SyntheticPgChallengeStore는 credentialGeneration=1만 허용한다. Main308375/4103ef source와545c6c 메모리 spy에서 세대3의 연결/콜백 전 거절을 확인했다. 세대3 지원을 완료했다고 하지 않는다.
- HUMAN1의 실제 공통 PgInstructionMaterialStore→PgChallengeStore→P256→신규 basis/parts/results→기존 receiver.startOptions는 메모리 SQL 모델에서 소비했다. HUMAN3의 구조 포트 정상과 구체 adapter 사전 거절은 별도다. 세대1 성공을 전체 세대 지원으로 확대하지 않는다.
- 공통 wrapper 생성자의 SEND 전용 정적 반환형은 시험 조립 한 곳에서 실제 동일 START basis 인스턴스로 명시 연결했다. 공통 제품/타입·tsconfig·guard·메소드 대역은 바꾸지 않았다.
- 실제 PG/SQL 구문 설치·RLS/권한·trigger 순서·COMMIT/잠금/내구성·실제 집계/교착·서버 HTTPS/브라우저 Network·실제 원문 supplier/키/helper·SDK/Agent·서비스·사용자 인수는 NOT_RUN이다.
- 기본 app 등록·실행 권위·실제 source/current 공급은 미연결이다. 누락 source를 AVAILABLE/빈 성공으로 바꾸지 않는다.
- 기존 tests/integration/FN12/result-submission-isolated.test.ts 및 tests/integration/FN06/provider-claim-data-case-qa.ts의 직접 constructor fixture 연결은 미수정·미실행이며 후속 호환 검토가 필요하다.
- 과거 SQL/원문·사용자 권한/정책·키·서비스·실자료 조사는 변경하지 않았다. 기존 private push 실패·Git 인증 문제를 우회하거나 재시도하지 않았다.
- 시험 자원은 합성 메모리 DB/서명/수신 journal뿐이다. 신규 listener/컨테이너/DB/설치/파일 QA 자원 생성·정리 명령0. 실제 프로세스·서버 잔여0을 이번에 조회한 증거로 주장하지 않는다. Primary live/pending0이며 writer가 반환됐다.

## 오류와 기록

WORK_STATUS와 통제 문서 §251~261은 원 RED·보정·독립 검수·미실행을 보존한다. 신규 rollback fixture의 기존 denial audit 별도 정착 혼동,0077 basename 추정 OS2 1회 및 정확 rg 탐색, 보안환경 생성0x80070020·정상 escalation, SEND 전용 생성자 정적 타입 불일치는 제품 실패와 구분했다. Main의 메시지 schema 거절·문자 검증 거절은 dispatch/write0으로 보정했다. Main 기록 변환에서 btoa 미제공 ReferenceError1은 파일 쓰기 전에 발생했고 검증한 literal here-string으로 저장했다. 이 도구 오류를 정식 Developer FAILURE_REPORT나 제품 실패로 세지 않는다.

## 최종 raw manifest

최종 검증 전/후와 Primary 제출이 일치한다. 로컬 raw hash이며 Git/WSL 줄바꿈 지문이 같다는 주장은 아니다.

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/executions/execution-commands.ts | 15062 | E4DC8AEE49E7D40406D2413DD74BC986307C4754A4A92D8E734581E5B532C94F |
| apps/server/modules/executions/execution-start-material-registration-input.ts | 4887 | 30678AD817D5488CF361232C1588CD84E9E4D323AD71573497F00CA9E1F6B416 |
| apps/server/modules/executions/execution-start-material-registration-store.ts | 25954 | D9E9AD4A6619029661C1E6F0A09FBC3F5791C96080AB0DE6C67BD427DAA26C0F |
| apps/server/modules/executions/execution-start-material-parts.ts | 5046 | E2350947F7D67B8ADE9E3BF6B6E29DB03F05E0DFA1E8586CD67270E49ADF5C8B |
| apps/server/modules/executions/execution-start-material-basis.ts | 6309 | F9308ECBB2FBB8CA543B2608843D3E8DEDC5EDBF924D16A04146F7B5C11FE143 |
| db/migrations/0078_start_execution_material_registration.sql.pending | 27060 | 7A1B7EA71198E59B589A2DF3356D8F6488FE0C4A9615DAA4A135589D4A3D91FC |
| tests/unit/FN08/execution-command-ledger.test.ts | 24315 | CAA88794B36B42183974F9AEEE63B5E1ED05B12A0318DFECEC8075D51897214C |
| tests/unit/FN08/execution-start-material-registration.test.ts | 4477 | 5FE0F3335D7E3B23F0BBD2125E360C4C991619E3E67465BD0738F636E56D9B76 |
| tests/unit/FN08/execution-start-material-registration-store.test.ts | 1901 | F040ED97335D194D6CAE5EA5C9FE2B0A7313BB0340222E2B782519E3585980E4 |
| tests/unit/FN08/execution-start-material-registration-schema.test.ts | 4518 | 020D448D3E417AC414BBAECE4CB91C8ADDD5E93D38B8630831509272560A51BE |
| tests/unit/FN08/execution-start-material-registration-flow.test.ts | 45440 | 7DDAABF7DC8CA6755BD6154270375F7C115BB5B0173CD7339740301644ABAED4 |

## 복구와 다음 조치

이 source 단위만 되돌릴 경우 정확11과 해당 결과 문서의 정상 Git revert를 사용한다. 기존 자료/SQL·DB·권한·키·서비스 삭제나 history rewrite는 하지 않는다. 실제 rollback은 실행하지 않았다.

Main은 이 결과와 현황을 기존 branch의 local source checkpoint에 보존한다. 그 뒤 전체 작업계획의 다음 미완료 선행·실행 가능 범위를 대조한다. source-only 인수는 전체 FN08/Stage·실제 Agent 연결·작업계획 완료·PR/main 인수를 의미하지 않는다.
