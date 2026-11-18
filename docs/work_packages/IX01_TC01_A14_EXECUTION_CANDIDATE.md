# IX01 TC01 A14 격리 시험 후보

상태는 **SOURCE_ONLY_PREPARED / NOT_APPROVED_EXECUTION**이다. 기준 소스는 `e79fd97505eeaf18b8a7703f5c4090e68dc1c5fc`, 실행 sourceHead는 `700a100dbe3fd1ffadbf090446772848ea84b8fb`다. 실행기의 A14 전용 이름 일곱 개를 A13으로 역치환하면 기준 Git blob과 바이트가 일치한다. NETWORK 고정 8단계 진단과 기존 검사·기한·실패 보존은 그대로다. 이 문서는 실제 실행이나 외피 발급을 승인하지 않는다.

## 고정 대상

| 자원 | A14 값 |
| --- | --- |
| 소스 | `/home/daon/anvil-ix01-current-tc01-20261108-a14-qa` |
| 영수증 기준 | `/home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a14` |
| 산출물 | `/tmp/anvil-v3-ix01-current-tc01-20261108-a14` |
| 컨테이너 | `anvil-ix01-current-tc01-pg-20261108-a14` |
| 내부 네트워크 | `anvil-ix01-current-tc01-net-20261108-a14` |
| 격리 DB | `anvil_v3_ix01_current_tc01_20261108_a14` |
| 프로필·소유 라벨 | `IX01_CURRENT_TC01_20261108_A14` |

승인 외피는 영수증 기준에 `-plan.json`과 `-approval.json`을 각각 붙인 파일이다. 실행 의사·인계·결과·npm 임시 파일은 고정 실행기가 정의한 A14 경로만 사용한다. A1~A13 자원과 실행 기록은 보존한다.

## 고정 소스 원바이트

아래 14개 경로의 순서·길이·SHA256은 고정 실행 커밋의 Git blob 기준이다. Main이 실제 Git blob과 대조했다.

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| `scripts/qa-ix01-current-journey.ts` | 58365 | `71d790b1e69786b47084c124f0fc8c884052397deeb5dc097f322034573b33db` |
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
- 역사 TSV 105개와 추가 25개의 순서·길이·SHA256을 실제 Git 원바이트로 검산했다. SQL과 역사 TSV는 기준 커밋에서 변경하지 않았다.

## 승인 후 한 번만 수행할 절차

1. 지정된 WSL-server에서 기존 strict/BatchMode 연결을 사용한다. Git 원격은 `git@github-sinsan-develop:sinsan-develop/Anvil.git`으로 고정한다. A14 전용 경로와 컨테이너·네트워크의 부재, 대상 부모 경로의 소유·모드, 기존 도구·daemon·이미지 지문, 확정 Git sourceHead와 소스·SQL 원바이트를 검산한다.
2. 검산이 모두 통과하면 해당 sourceHead에 A14 전용 계획과 단회 승인 외피를 배타 발급한다. 기존 실행기의 **전체 30분, PG 10분, 직접 자식 90초**를 적용한다. 불일치하거나 준비 결과가 불명이면 발급과 실행을 중단한다.
3. 기존 고정 npm 환경·실행 스크립트 차단·권한 검사를 거쳐 A14 전용 PG와 내부망에서 SQL 130개와 원장을 검산한다. 0095의 전용 역할 두 개와 임시 ADMIN 멤버십 회수를 확인한 뒤 TC01 저장·재조회 경로를 실행한다. 실제 운영 자료는 사용하지 않는다.
4. 정상 결과와 자원 소유가 확인된 A14 전용 컨테이너·네트워크만 기존 절차로 정리한다. 실패·결과 불명·기한 소실 때는 후속 조회·재시도·재시작·자동 삭제 없이 보존한다. 결과 기록의 정착을 확인하지 못하면 그 상태도 미확인으로 표기한다.

복사 응답 실패 시 현재성·HTTP·크기·JSON·형상·참조·영수증·ID·해시의 고정 코드만 수거한다. 진단 기록은 원 인계·소유·기한을 검산한 경우에만 채택한다. 응답 본문·실제 상태값·예외 원문과 인증자료는 기록하지 않는다. 유효한 진단 기록이 없으면 기존 EXIT_STATUS를 사용하며 실패 결과는 여전히 UNKNOWN이다. 이 진단으로 과거 A12 원인을 소급 확정할 수 없다.

NETWORK 실패는 PRECHECK / CREATE / CREATE_VERIFY / NONE_VERIFY / DISCONNECT / DETACHED_VERIFY / CONNECT / ATTACHED_VERIFY의 고정 코드만 구분한다. 경계 밖의 실패는 기존 STOPPED_NETWORK를 유지한다. 원 예외·주소·출력은 기록하지 않는다. 이 코드로 과거 A13 실패 원인을 소급 확정하지 않는다.

## 검증과 미검증

- A14 프로필 RED 1529c9: 1실패. 보완 후 집중·인접 합성 3702f5: 4통과, 실패·건너뜀 0. A1~A13 원·혼합 외피 및 인계 거절, NETWORK 단계와 기존 START·불명 결과 정리 차단을 확인했다.
- source14 원바이트, SQL130 길이·SHA256 및 원장을 로컬 Git 자료로 검산했다. 전체 실행기 역치환 일치로 일곱 이름 외 기능 변경이 없음을 확인했다.
- 루트 타입 검사 eef54a → e52a6a: 종료 0. Main 집중 합성시험 4통과·실패/건너뜀0(742206), Git 원바이트 14개 및 실행기 역치환 일치와 A13 대비 DB 변경 없음(f51b65)을 확인했다.
- 실제 WSL-server·Docker·DB·서비스·Agent 접근, 외피 발급, 설치·실행·정리, A1~A13 조회는 하지 않았다. 실제 신규 자원 부재·도구 현재성·TC01 저장·재조회는 미검증이다.
