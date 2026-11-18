# IX01 TC01 A13 격리 시험 후보

상태는 **SOURCE_ONLY_PREPARED / NOT_APPROVED_EXECUTION**이다. 실행 소스는 `f8a869d100487a803da8f20f9222de3d32b11278`로 고정한다. 기준 소스 `370e53372ed8b5a829f7487c22b7934fb403e3fc`에서 실행기에 A13 전용 자원 이름 일곱 개를 적용했다. 실행기에서 일곱 이름을 A12로 되돌리면 기준 커밋과 바이트가 일치한다. A13의 실행 권한은 별도로 승인한다.

## 고정 대상

| 자원 | A13 값 |
| --- | --- |
| 소스 | `/home/daon/anvil-ix01-current-tc01-20261108-a13-qa` |
| 영수증 기준 | `/home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a13` |
| 산출물 | `/tmp/anvil-v3-ix01-current-tc01-20261108-a13` |
| 컨테이너 | `anvil-ix01-current-tc01-pg-20261108-a13` |
| 내부 네트워크 | `anvil-ix01-current-tc01-net-20261108-a13` |
| 격리 DB | `anvil_v3_ix01_current_tc01_20261108_a13` |
| 프로필·소유 라벨 | `IX01_CURRENT_TC01_20261108_A13` |

승인 외피는 영수증 기준에 `-plan.json`과 `-approval.json`을 각각 붙인 파일이다. 실행 의사·인계·결과·npm 임시 파일은 고정 실행기가 정의한 A13 경로만 사용한다. A1~A12 자원과 실행 기록은 보존한다.

## 고정 소스 원바이트

아래 14개 경로의 순서·길이·SHA256은 실행 커밋의 Git blob 기준이다.

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| `scripts/qa-ix01-current-journey.ts` | 57779 | `2b80c3fe79a2e111a1afd1a977093c998ed1bbfa876a2cf8834fe4d2ec3967d8` |
| `tests/integration/IX01/current-methodology-journey.test.ts` | 6112 | `72c72febbf33393cadb6d64dfc123ecc06eb73903bc5fc52ae1ec0c8f113b63d` |
| `scripts/qa-ix01-schema-closure.sh` | 35588 | `b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733` |
| `docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv` | 15807 | `0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd` |
| `docs/design/공식산출물_양식정의.md` | 11130 | `622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13` |
| `docs/design/문서작성_공통기준.md` | 9067 | `85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07` |
| `docs/design/기본방법론_상세검토안.md` | 8533 | `1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1` |
| `package.json` | 943 | `e61265b7bf4e9e31445be12048f574e0cb7940c5888922e7f087603e8b10eede` |
| `package-lock.json` | 76254 | `ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6` |
| `tests/integration/IX01/current-schema-baseline.ts` | 9378 | `6c574464a72cc64fb9f44476d1da6252a69fef2bce2157e95725a864b32d4f9c` |
| `tests/integration/IX01/current-schema-installation.ts` | 3402 | `0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1` |
| `tests/integration/IX01/methodology-copy-application-scenario.ts` | 13680 | `6e75c35c52b10a0b8c5580ab9c24f34dab84aa69713eecc2ee2270f6723b85df` |
| `tests/integration/IX01/journey-context-lifecycle.ts` | 694 | `90d4107fd6e7c15545333afcb0ebab2d06c44660605166233d1198dae91736c9` |
| `tests/integration/FN12/result-qa-fence.ts` | 1110 | `97308aeb2a45121be699c4ac2d07a6147efbe12534e3aacbcdc291bffa1f8224` |

- SQL 130개 전체 **4,004,568바이트**. 원장 SHA256 `546e8409e4313901597bcfdb71ce91efcd4f9eb6a54bdad99e5f439a017c324c`.
- SQL 경로 배열의 SHA256 `44d4e4f1133f03b99c7a86634682d56ff25485bcb014c65483bd691706414a12`.
- 역사 TSV 105개와 추가 25개의 순서·원바이트·지문을 검산했다. SQL은 A12 기준과 동일하다.

## 승인 후 한 번만 수행할 절차

1. 지정된 WSL-server에서 기존 strict/BatchMode 연결을 사용한다. Git 원격은 `git@github-sinsan-develop:sinsan-develop/Anvil.git`으로 고정한다. A13 전용 경로와 컨테이너·네트워크의 부재, 대상 부모 경로의 소유·모드, 기존 도구·daemon·이미지 지문, 확정 Git sourceHead와 소스·SQL 원바이트를 검산한다.
2. 검산이 모두 통과하면 해당 sourceHead에 A13 전용 계획과 단회 승인 외피를 배타 발급한다. 기존 실행기의 **전체 30분, PG 10분, 직접 자식 90초**를 적용한다. 불일치하거나 준비 결과가 불명이면 발급과 실행을 중단한다.
3. 기존 고정 npm 환경·실행 스크립트 차단·권한 검사를 거쳐 A13 전용 PG와 내부망에서 SQL 130개와 원장을 검산한다. 0095의 전용 역할 두 개와 임시 ADMIN 멤버십 회수를 확인한 뒤 TC01 저장·재조회 경로를 실행한다. 실제 운영 자료는 사용하지 않는다.
4. 정상 결과와 자원 소유가 확인된 A13 전용 컨테이너·네트워크만 기존 절차로 정리한다. 실패·결과 불명·기한 소실 때는 후속 조회·재시도·재시작·자동 삭제 없이 보존한다. 결과 기록의 정착을 확인하지 못하면 그 상태도 미확인으로 표기한다.

복사 응답 실패 시 현재성·HTTP·크기·JSON·형상·참조·영수증·ID·해시의 고정 코드만 수거한다. 진단 기록은 원 인계·소유·기한을 검산한 경우에만 채택한다. 응답 본문·실제 상태값·예외 원문과 인증자료는 기록하지 않는다. 유효한 진단 기록이 없으면 기존 EXIT_STATUS를 사용하며 실패 결과는 여전히 UNKNOWN이다. 이 진단으로 과거 A12 원인을 소급 확정할 수 없다.

## 검증과 미검증

- 집중 RED 988620 1실패 뒤 developer_primary의 직접·인접 합성시험 9통과(726a19), 타입 aa9a61 종료 0.
- Main 직접·인접 합성시험 9통과, 실패·건너뜀 0(455526). A1~A12의 원·혼합 승인 및 인계 거절과 고정 COPY 코드, 기존 UNKNOWN 및 정리 차단을 확인했다.
- Main이 `f8a869d100487a803da8f20f9222de3d32b11278`의 source14·SQL130 Git 원바이트를 대조했다. 직전 기준과 달라진 실행 파일은 A13 이름을 적용한 실행기 한 개다.
- WSL-server·Docker·PG에 접근하거나 외피를 발급하거나 A13을 실행하지 않았다. 실제 자원 부재·도구 현재성·저장·재조회는 미확인이다.
