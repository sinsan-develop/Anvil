# IX01 TC01 A5 격리 시험 후보

상태: **SOURCE_ONLY_PREPARED / 실제 실행 미승인**. 로컬 준비 기준은 `4d3ff3a9e6acec690890311e14c5696fab4bcbc4`다. 실행 sourceHead는 **c5114624e4c9c6df1891e7961911cf94286addff**로 고정했다. 이 기준 커밋을 A5 실행 sourceHead로 대신하지 않는다. 본 문서는 승인 외피·intent·실행 권한을 발급하지 않는다.

## 고정 대상과 외피

| 자원 | A5 고정값 |
| --- | --- |
| 소스 | /home/daon/anvil-ix01-current-tc01-20261108-a5-qa |
| 영수증 기준 | /home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a5 |
| 산출물 | /tmp/anvil-v3-ix01-current-tc01-20261108-a5 |
| 컨테이너 | anvil-ix01-current-tc01-pg-20261108-a5 |
| 네트워크 | anvil-ix01-current-tc01-net-20261108-a5 |
| 격리 DB | anvil_v3_ix01_current_tc01_20261108_a5 |
| 프로필 및 소유 라벨 | IX01_CURRENT_TC01_20261108_A5 |

외피 경로는 영수증 기준에 각각 `-plan.json`, `-approval.json`을 붙인 정확 형제 파일이다. intent/handoff/child-result와 npm 설정·cache는 기존 runner대로 A5 영수증 하위에 한정한다. A1/A2/A3/A4 외피·인계는 거절하며 기존 자원·영수증·실행안은 조회하거나 재사용하지 않는다.

실행 소스 확정 및 별도 실제 실행 승인 후에만 기존 strict/BatchMode WSL-server 연결과 private remote `git@github-sinsan-develop:sinsan-develop/Anvil.git`을 사용한다. A5 소스·영수증·산출물·plan/approval 형제 파일·컨테이너·네트워크 부재, 부모 경로 신원/소유/권한과 원 고정 도구·daemon·image를 먼저 대조한다. 부재·신원·지문·기한 중 하나라도 불일치하거나 불명이면 신규 발급·실행0이다. 이름·인증 별칭·이미지를 자동 대체하지 않는다.

## 새 원바이트 검산

source14 순서는 현재 runner의 `currentRequiredSources` 그대로다. 아래 runner만 현재 수정본의 Git LF 후보 바이트이며 7개 A4 리터럴을 되돌리면 기준 Git 원바이트와 같다. 나머지 source13과 SQL130은 기준 커밋의 `git cat-file` 원바이트를 읽어 계산했다. Windows checkout CRLF를 원 SQL 지문으로 사용하지 않는다. 실행 외피 발급 전에 고정 sourceHead의 source14와 SQL130을 아래 값에 재대조해야 한다.

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| scripts/qa-ix01-current-journey.ts | 50270 | e2148e24edab447bd3a864da183eb48ba06932d03d001acd8601c6548db6ef61 |
| tests/integration/IX01/current-methodology-journey.test.ts | 5956 | 3e4de3fe9a45cc092431bbf52160a46b76ff933f3232ab44817da46c0adcb9a0 |
| scripts/qa-ix01-schema-closure.sh | 35588 | b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733 |
| docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv | 15807 | 0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd |
| docs/design/공식산출물_양식정의.md | 11130 | 622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13 |
| docs/design/문서작성_공통기준.md | 9067 | 85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07 |
| docs/design/기본방법론_상세검토안.md | 8533 | 1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1 |
| package.json | 943 | e61265b7bf4e9e31445be12048f574e0cb7940c5888922e7f087603e8b10eede |
| package-lock.json | 76254 | ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6 |
| tests/integration/IX01/current-schema-baseline.ts | 9378 | d10cdf4fb218675409882e6de3d1f5bb57059a3c34786b86886bbb72ec05f53a |
| tests/integration/IX01/current-schema-installation.ts | 3402 | 0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1 |
| tests/integration/IX01/methodology-copy-application-scenario.ts | 12887 | d27416d76b08a1e97eb8672c61615b36816a3ee43bb5fbd7642d946ae40fe3e7 |
| tests/integration/IX01/journey-context-lifecycle.ts | 694 | 90d4107fd6e7c15545333afcb0ebab2d06c44660605166233d1198dae91736c9 |
| tests/integration/FN12/result-qa-fence.ts | 1110 | 97308aeb2a45121be699c4ac2d07a6147efbe12534e3aacbcdc291bffa1f8224 |

- SQL130 총량: **4,004,532바이트**.
- SQL 원장 지문: `0cfbe777d6f545e9122a3c9505ad3162885748a9d4b088b6bdb03eee5a6f3fb3`. 현재 manifest 순서의 `{id,checksum}` 배열을 기존 `canonicalJson`으로 직렬화한 SHA256이다.
- SQL 경로 배열의 `JSON.stringify` SHA256: `44d4e4f1133f03b99c7a86634682d56ff25485bcb014c65483bd691706414a12`.
- 역사105 TSV는 표의 원 길이·지문 그대로이며 current suffix25와 결합한다. 모든 SQL130의 길이·지문·순서는 `verifyCurrentSchemaSources`로 검산했다.
- 보완된 0077(+4바이트), 0078(+2), 0082(+4), 0083(+2)의 CASE 괄호 총12바이트가 포함된다. 과거 A4 SQL 원장 지문과 실행안 지문은 A5 근거로 재사용하지 않는다.

## 승인 후 단회 실행 순서와 한도

1. A5 exact 부재·도구·daemon·이미지 및 private Git의 확정 sourceHead/clean을 확인한다. 고정 source14·SQL130 지문이 맞아야 다음으로 진행한다.
2. 기존 형식의 새 approval UUID·실측 발급/만료 시각·원 tool 지문으로 A5 plan/approval을 배타 생성한다. 승인 외피 최대30분, PG 최대10분, 직접 TC01 자식 최대90초는 그대로다. 새 창으로 불명 결과를 재실행하지 않는다.
3. 기존 runner가 단회 intent를 선점하고 A5 전용 npm 설정/cache 및 exact lock/integrity를 사용한다. registry 고정, `--ignore-scripts --no-audit --no-fund`, 동기 npm 자식의 강화 umask와 복원, 원 경로/모드 거절은 유지한다.
4. A5 전용 PG의 CREATE/INSPECT/START/INSPECT/READINESS/BOOTSTRAP_ROLES, SQL130 설치·원장, 0095의 두 NOLOGIN 역할·임시 단일 ADMIN 멤버십 생성·검산·회수, 합성 TC01 저장·재조회를 기존 순서로 1회 수행한다. 기본 R9 검산, 실제 마운트/포트/네트워크 guard와 기동 후 none 검산은 바꾸지 않는다.
5. 원 정상 결과·소유 증명이 확인된 A5 컨테이너·내부망만 기존 정리 경로로 정리하고 감사 자료는 보존한다. 실패·기한 소실·결과 불명은 원 분류와 이미 생성된 자료를 보존한다. 후속 조회·재시도·재시작·자동 삭제는 하지 않는다. stdout 결과만으로 result.json의 정착을 추가 단정하지 않는다.

A1/A2/A3/A4와 기존 DB·권한·서비스·사용자 자료는 범위 밖이다. 정상 0095 전용 역할 검증 외의 권한 변경, 취약점 재현·검사 우회는 포함하지 않는다.

## 현재 증거와 미검증

- A5 원 리터럴 RED `cd265d`: 1FAIL. 보완 후 `602c92`: 선택 RAM 6PASS/0FAIL/0SKIP. A5 exact/구 프로필·혼합 거절, 기존 두 Docker 표현 호환, START 분류, SQL CASE 원바이트 회귀를 포함한다. 실제 Docker 호출은 없다.
- 타입 `c0626b`: exit0. 원 runner를 A4로 역치환한 원바이트 동일성 및 source14/SQL130 길이·지문은 `eb11b7` exit0에서 계산했다.
- 실제 A5 외피·자원·실행은 생성하지 않았다. 원격 도구/대상 부재와 PG15 설치·역할·실제 TC01·정리 결과는 미검증이다. pglast의 구문 검증은 catalog/권한/실제 DB 적용 검증을 대신하지 않는다.
