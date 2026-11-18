# IX01 TC01 A9 격리 시험 후보

상태: **SOURCE_ONLY_PREPARED / NOT_APPROVED_EXECUTION**. 준비 기준은 `2957fd80dae59509995d5ecbe652a46f4267f705`다. **실행 sourceHead는 cbe5e285767ac477591d8982771d50a85bc5feeb로 고정**이며, 이 문서는 승인 외피·intent·실행 권한을 발급하지 않는다.

## 고정 대상

| 자원 | A9 고정값 |
| --- | --- |
| 소스 | /home/daon/anvil-ix01-current-tc01-20261108-a9-qa |
| 영수증 기준 | /home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a9 |
| 산출물 | /tmp/anvil-v3-ix01-current-tc01-20261108-a9 |
| 컨테이너 | anvil-ix01-current-tc01-pg-20261108-a9 |
| 네트워크 | anvil-ix01-current-tc01-net-20261108-a9 |
| 격리 DB | anvil_v3_ix01_current_tc01_20261108_a9 |
| 프로필 및 소유 라벨 | IX01_CURRENT_TC01_20261108_A9 |

plan/approval은 영수증 기준에 각각 `-plan.json`, `-approval.json`을 붙인 형제 파일이다. intent/handoff/child-result·npm 설정/cache는 기존 runner의 A9 하위 경로만 사용한다. A1~A8 외피·인계와 혼합은 거절한다. 과거 자원·외피·실행안은 보존하며 조회하거나 재사용하지 않는다.

## source14 및 SQL130 원바이트

runner만 A9 수정본의 Git LF 후보 바이트다. 리터럴 7개를 A8로 역치환하면 준비 기준 Git 원바이트와 완전히 같다. 나머지 source13과 SQL130은 준비 기준의 `git cat-file` 원바이트다. 아래 순서는 `currentRequiredSources`와 같다. 실행 전 Main이 확정한 sourceHead의 원바이트와 전부 재대조해야 한다.

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| scripts/qa-ix01-current-journey.ts | 53803 | 27a0fd43c694bb44c09037a421f715baaba5c5d5998e36e547e4048fa68887e8 |
| tests/integration/IX01/current-methodology-journey.test.ts | 5956 | 3e4de3fe9a45cc092431bbf52160a46b76ff933f3232ab44817da46c0adcb9a0 |
| scripts/qa-ix01-schema-closure.sh | 35588 | b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733 |
| docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv | 15807 | 0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd |
| docs/design/공식산출물_양식정의.md | 11130 | 622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13 |
| docs/design/문서작성_공통기준.md | 9067 | 85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07 |
| docs/design/기본방법론_상세검토안.md | 8533 | 1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1 |
| package.json | 943 | e61265b7bf4e9e31445be12048f574e0cb7940c5888922e7f087603e8b10eede |
| package-lock.json | 76254 | ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6 |
| tests/integration/IX01/current-schema-baseline.ts | 9378 | 6c574464a72cc64fb9f44476d1da6252a69fef2bce2157e95725a864b32d4f9c |
| tests/integration/IX01/current-schema-installation.ts | 3402 | 0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1 |
| tests/integration/IX01/methodology-copy-application-scenario.ts | 12887 | d27416d76b08a1e97eb8672c61615b36816a3ee43bb5fbd7642d946ae40fe3e7 |
| tests/integration/IX01/journey-context-lifecycle.ts | 694 | 90d4107fd6e7c15545333afcb0ebab2d06c44660605166233d1198dae91736c9 |
| tests/integration/FN12/result-qa-fence.ts | 1110 | 97308aeb2a45121be699c4ac2d07a6147efbe12534e3aacbcdc291bffa1f8224 |

- SQL130 합계: **4,004,568바이트**. 역사105 TSV와 current suffix25의 순서·길이·지문을 `verifyCurrentSchemaSources`로 검산했다.
- 원장 SHA256: `546e8409e4313901597bcfdb71ce91efcd4f9eb6a54bdad99e5f439a017c324c`. 현 manifest의 `{id,checksum}` 배열을 기존 `canonicalJson`으로 직렬화한 지문이다.
- SQL 경로 배열 `JSON.stringify` SHA256: `44d4e4f1133f03b99c7a86634682d56ff25485bcb014c65483bd691706414a12`.
- 기준에는 0082의 CASE 괄호 및 변수 `"grant"` 인용 보완이 포함된다. 0082는 230,277B / SHA256 `3f32acd0f6f402e823bd3805b1948ae8f48d7ec98300e8dbdc2925923d49cfdf`다. 이번 준비에서는 SQL·baseline·역사 TSV를 수정하지 않았다. SQL 원장은 A8과 동일하며 A9의 변경된 runner/source14와 새 외피를 별도로 결박한다.

## 별도 승인 후 단회 순서와 기존 한도

1. 기존 strict/BatchMode WSL-server 연결과 private remote `git@github-sinsan-develop:sinsan-develop/Anvil.git`만 사용한다. A9 exact 소스·영수증·산출물·plan/approval·컨테이너·네트워크 부재, 부모 경로 신원/소유/권한, 고정 도구·daemon·image 및 확정 sourceHead/clean을 검산한다. 불일치·불명이면 신규 발급/실행0, 자동 대체0이다.
2. source14/SQL130 검산 뒤 기존 형식의 새 approval UUID·실측 발급/만료·도구 지문으로 A9 plan/approval을 배타 발급한다. 전체 **30분 / PG 10분 / 직접 자식 90초**, 단회 intent를 유지한다. 기존 승인·기한을 자동 연장하지 않는다.
3. 고정 npm registry/lock/integrity·`--ignore-scripts --no-audit --no-fund`·동기 자식 umask 강화/복원·경로/모드 guard를 유지한다. 전용 PG CREATE/INSPECT/START/INSPECT/READINESS/BOOTSTRAP_ROLES → SQL130/원장 → 0095 두 NOLOGIN 역할과 임시 단일 ADMIN 멤버십 생성·검산·회수 → TC01 저장·재조회 전체가 목적이다.
4. 정상 결과와 소유 증명이 확인된 A9 전용 컨테이너·내부망만 기존 정리 경로로 처리하고 감사 자료는 보존한다. 실패·UNKNOWN·기한 소실 뒤 후속 조회/재시도/재시작/자동 삭제0이다. stdout만으로 결과 파일 정착을 단정하지 않는다. 기존 마운트·네트워크·권한·정리 guard와 두 Docker 표현 호환 보정은 유지한다.

자식 환경에서는 고정 Node의 `NODE_TEST_WORKER_ID='1'`만 추가 허용하며 부모의 빈 환경 검산은 그대로다. CHILD는 `ATTACHED_HOST/CURRENT/ARTIFACT/HANDOFF/OWNER/SOURCES/SPAWN/CURRENT_AFTER_SPAWN/EXIT/RESULT_READ/OUTPUT_VERIFY`의 고정 실패 코드만 보존한다. 원 예외·자식 stdout/stderr는 진단으로 출력하지 않고 미분류/기한·현재성 실패는 기존 `STOPPED_CHILD`로 남긴다. A8 실제 CHILD 실패의 최초 원인은 미확정이다.

기존 RUNTIME/START 고정 코드와 INSTALL의 `DDL_REJECTED`/UNKNOWN 분류를 유지한다. 기존 `parsePsqlFailure`/`DdlFailure`에서 검산된 경우만 선택적인 `ddlFailure`에 SQLSTATE·한정 RELATION/FUNCTION/COLUMN 식별자·statementEndLine을 보존한다. 불명/현재성 소실은 진단을 승격하지 않으며 raw stderr·SQL·env·Secret·stack을 출력하지 않는다.

## 로컬 검증·미검증·복구

- RED `567b05`: `node --test --test-name-pattern='IX01 A9 고정 프로필 RAM' tests/unit/IX01/current-journey-controller.test.ts` → 1FAIL/exit1(기존 A8 리터럴).
- GREEN `b28019`: `node --test --test-name-pattern='IX01 A9 고정 프로필 RAM|IX01 자식 Node 환경 RAM|IX01 CHILD 고정 진단 RAM|IX01 CHILD 출력 진단 RAM|IX01 현재 격리 합성 제어는' tests/unit/IX01/current-journey-controller.test.ts` → **5PASS/0FAIL/0SKIP, exit0**. A1~A8 원/혼합 외피·인계 거절, Node 자식 환경과 CHILD 안전 진단 및 정상 순서를 확인했다.
- 타입 `aaa236`: `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false` → exit0.
- 원바이트 `894abc`: Git batch 원문 읽기·runner A9→A8 역치환·source14/SQL130 검산 → exit0.
- timeout/실제 실행기 자식 시험 및 추가 SQL 구문 감사는 수행하지 않았다. 기존 parser 근거는 catalog·타입·실제 PG15 설치 성공을 증명하지 않는다.
- 실제 외피/intent, 원격 도구 현재성·자원 부재, PG15 설치·역할·TC01·정리·결과 정착은 미검증이다. 실제 DB/SSH/Docker/설치/서비스 및 A1~A8 접근0, 실행 핸들0.
- 복구는 Main이 검토한 runner의 7개 리터럴·해당 시험·이 후보만 대상으로 하며 과거 보존 자원과 기존 진단 구현은 변경하지 않는다.
