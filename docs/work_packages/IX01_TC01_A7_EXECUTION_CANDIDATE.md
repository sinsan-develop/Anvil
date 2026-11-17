# IX01 TC01 A7 격리 시험 후보

상태: **SOURCE_ONLY_PREPARED / 실제 실행 미승인**. 준비 기준은 `9f6d4a55380305a6b568d9e0b81c368814e55fc7`다. 실행 **sourceHead는 d1b36f0e490cf4153e02b4943b6d41391c356102**로 고정한다. 이 문서는 승인 외피·intent·실행 권한을 발급하지 않는다.

## 고정 대상

| 자원 | A7 고정값 |
| --- | --- |
| 소스 | /home/daon/anvil-ix01-current-tc01-20261108-a7-qa |
| 영수증 기준 | /home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a7 |
| 산출물 | /tmp/anvil-v3-ix01-current-tc01-20261108-a7 |
| 컨테이너 | anvil-ix01-current-tc01-pg-20261108-a7 |
| 네트워크 | anvil-ix01-current-tc01-net-20261108-a7 |
| 격리 DB | anvil_v3_ix01_current_tc01_20261108_a7 |
| 프로필 및 소유 라벨 | IX01_CURRENT_TC01_20261108_A7 |

plan/approval은 영수증 기준에 각각 `-plan.json`, `-approval.json`을 붙인 형제 파일이다. intent/handoff/child-result·npm 설정/cache 등은 기존 runner의 A7 하위 경로만 사용한다. A1~A6의 외피·인계 및 혼합은 거절하며 보존 자원·실행안·자료는 조회하거나 재사용하지 않는다.

## source14 및 SQL130 원바이트

runner만 현재 A7 수정본의 Git LF 후보 바이트다. A7 리터럴 7개를 A6로 역치환하면 준비 기준의 Git 원바이트와 완전히 같다. 나머지 source13 및 SQL130은 준비 기준의 `git cat-file` 원바이트로 계산했다. 아래 source14 순서는 `currentRequiredSources`와 같다. 외피 발급 전에 Main이 확정한 sourceHead의 Git 바이트와 모두 대조해야 한다.

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| scripts/qa-ix01-current-journey.ts | 52769 | 400d3751ba6b946160fa35d7f1833e270975751bfdc599e6a9e5ac794be22ae0 |
| tests/integration/IX01/current-methodology-journey.test.ts | 5956 | 3e4de3fe9a45cc092431bbf52160a46b76ff933f3232ab44817da46c0adcb9a0 |
| scripts/qa-ix01-schema-closure.sh | 35588 | b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733 |
| docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv | 15807 | 0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd |
| docs/design/공식산출물_양식정의.md | 11130 | 622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13 |
| docs/design/문서작성_공통기준.md | 9067 | 85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07 |
| docs/design/기본방법론_상세검토안.md | 8533 | 1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1 |
| package.json | 943 | e61265b7bf4e9e31445be12048f574e0cb7940c5888922e7f087603e8b10eede |
| package-lock.json | 76254 | ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6 |
| tests/integration/IX01/current-schema-baseline.ts | 9378 | a9991593458d40ff7d2b8c405d7c93f834a7faf59df584ab9514e119531f08f4 |
| tests/integration/IX01/current-schema-installation.ts | 3402 | 0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1 |
| tests/integration/IX01/methodology-copy-application-scenario.ts | 12887 | d27416d76b08a1e97eb8672c61615b36816a3ee43bb5fbd7642d946ae40fe3e7 |
| tests/integration/IX01/journey-context-lifecycle.ts | 694 | 90d4107fd6e7c15545333afcb0ebab2d06c44660605166233d1198dae91736c9 |
| tests/integration/FN12/result-qa-fence.ts | 1110 | 97308aeb2a45121be699c4ac2d07a6147efbe12534e3aacbcdc291bffa1f8224 |

- SQL130 합계: **4,004,534바이트**. 역사105 TSV와 current suffix25의 순서·길이·지문을 `verifyCurrentSchemaSources`로 모두 검산했다.
- 원장 SHA256: `87ade27ede5e91adf12d83dc05e92668ccb8e27aa2f975cb211e649604fffdd3`. 현 manifest의 `{id,checksum}` 배열을 기존 `canonicalJson`으로 직렬화한 지문이다.
- SQL 경로 배열 `JSON.stringify` SHA256: `44d4e4f1133f03b99c7a86634682d56ff25485bcb014c65483bd691706414a12`.
- 0077의 729행 추가 CASE 괄호 2바이트와 앞선 0077/0078/0082/0083 보완이 기준에 포함된다. 이번 준비에서 SQL과 역사 TSV는 수정하지 않았다. 0077은 156,568B / SHA256 `a9f33cdc170b4483aa2f572c52b53272aba785ffd45facdd681151046f3ee174`이며 A6의 SQL 원장 `0cfbe777…`을 재사용하지 않는다. A7 runner/source14·수정 SQL 원장·새 실행 외피를 함께 결박한다.

## 별도 승인 후 단회 순서와 기존 한도

1. 기존 strict/BatchMode WSL-server 연결과 private remote `git@github-sinsan-develop:sinsan-develop/Anvil.git`만 사용한다. A7 exact 소스·영수증·산출물·plan/approval·컨테이너·네트워크 부재, 부모 경로 신원/소유/권한, runner의 고정 도구·daemon·image 및 확정 sourceHead/clean을 확인한다. 불일치·불명이면 신규 발급/실행0, 자동 대체0이다.
2. source14/SQL130 검산 후 기존 형식의 새 approval UUID·실측 발급/만료·도구 지문으로 A7 plan/approval을 배타 발급한다. 전체 **30분 / PG 10분 / 직접 자식 90초**와 단회 intent를 유지한다. 기존 승인을 새 창으로 자동 연장하지 않는다.
3. 기존 npm 고정 registry/lock/integrity·`--ignore-scripts --no-audit --no-fund`·동기 자식 umask 강화/복원 및 경로/모드 guard를 유지한다. 전용 PG CREATE/INSPECT/START/INSPECT/READINESS/BOOTSTRAP_ROLES → SQL130/원장 → 0095 두 NOLOGIN 역할과 임시 단일 ADMIN 멤버십 생성·검산·회수 → TC01 저장·재조회 전체가 목적이다. 진단 수집만의 대체 시나리오가 아니다.
4. 기존 정상 결과와 소유 증명이 확인된 A7 전용 컨테이너·내부망만 기존 정리 경로로 처리하며 감사 자료는 보존한다. 실패·UNKNOWN·기한 소실 뒤 후속 조회/재시도/재시작/자동 삭제0이다. stdout만으로 결과 파일 정착을 단정하지 않는다. 원 마운트·네트워크·권한·정리 guard 및 두 Docker 표현 호환 보정은 그대로다.

실패 시 기존 RUNTIME/START 고정 코드와 INSTALL의 기존 `DDL_REJECTED`/`UNKNOWN` 분류를 유지한다. 실제 legacy `parsePsqlFailure`/`DdlFailure`에서 검산된 경우만 선택적인 `ddlFailure`에 SQLSTATE·한정 RELATION/FUNCTION/COLUMN 식별자·statementEndLine을 보존한다. 불명/현재성 소실은 진단을 승격하지 않는다. raw stderr·SQL·경로·env·Secret·stack을 출력하지 않는다. A6에서는 SQLSTATE42601/끝행778을 관측했고 해당 함수의 CASE 괄호 누락을 로컬 파서로 확인했다. 이번 수정의 실제 PG 설치 성공은 아직 확인하지 않았다.

## 로컬 검증과 미검증

- RED `67d6d4`: `node --test --test-name-pattern='IX01 A7 고정 프로필 RAM' tests/unit/IX01/current-journey-controller.test.ts` → 1FAIL/exit1(기존 A6 리터럴).
- GREEN `e63d23`: `node --test --test-name-pattern='IX01 A7 고정 프로필 RAM|IX01 생성 none RAM|IX01 HostConfig Mounts RAM|IX01 START 고정 진단 RAM|IX01 INSTALL 안전 진단 RAM|IX01 0077 CASE 구문 RAM|IX01 후속 CASE 구문 RAM' tests/unit/IX01/current-journey-controller.test.ts` → **9PASS/0FAIL/0SKIP, exit0**. 로컬 Git 원바이트와 RAM만 사용하고 timeout/실제 실행기 자식 시험은 선택하지 않았다.
- 타입 `91eb21`: `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false` → exit0.
- 원바이트 산출 `b94c91`: Git batch 원문 읽기, runner 역치환 동일성, source14와 SQL130 검산 → exit0.
- 기존 로컬 pglast 근거: 0077 외부88문장·원 PLpgSQL12/SQL본문6·RAM row-type 치환20함수 파싱. trigger3은 원 raw parser 반환 뒤 JSON 직렬화 오류를 RAM에서 구분했다(그중1개는 row-type9개 치환). 이는 catalog·타입·PG15 적용 성공 증명이 아니다.
- 실제 외피/intent·원격/도구 현재성·자원 부재·PG15 SQL 설치·역할·TC01·정리·결과 정착은 미검증이다. DB/SSH/Docker/설치/서비스 및 A1~A6 접근은 수행하지 않았다. 실행 핸들0.
- 되돌림은 Main이 검토한 이번 리터럴/시험/후보 변경만 대상으로 하며, 과거 보존 자원 및 원 진단 구현은 변경하지 않는다.
