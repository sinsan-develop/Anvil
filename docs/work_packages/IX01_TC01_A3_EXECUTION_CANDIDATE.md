# IX01 TC01 A3 격리 시험 후보

상태는 실행 승인 대기다. 실행 소스는 `54a499268b05757d74e39e6c4ac7fcb721e8b914`이며 A3 전용 이름과 현재 START 단계 진단을 포함한다. 이 문서의 커밋과 실행 소스는 별개다.

| 자원 | A3 고정값 |
| --- | --- |
| 소스 | `/home/daon/anvil-ix01-current-tc01-20261108-a3-qa` |
| 영수증 기준 | `/home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a3` |
| 산출물 | `/tmp/anvil-v3-ix01-current-tc01-20261108-a3` |
| 컨테이너 | `anvil-ix01-current-tc01-pg-20261108-a3` |
| 네트워크 | `anvil-ix01-current-tc01-net-20261108-a3` |
| 격리 DB | `anvil_v3_ix01_current_tc01_20261108_a3` |
| 프로필 및 소유 라벨 | `IX01_CURRENT_TC01_20261108_A3` |

승인 후 기존 허용 WSL 경로에서 위 대상과 승인 외피 형제 파일의 부재, 고정 이미지·daemon·실행 도구 지문 및 clean exact SHA를 먼저 확인한다. 불일치하거나 관측이 불명이면 발급 및 실행을 중단하고 보존한다. A1·A2와 기존 DB·권한·서비스는 접근 범위 밖이다.

검산한 소스 14개와 SQL 130개(4,004,520바이트)를 승인 외피와 결박한다. SQL 원장 SHA256은 `dbd89bb0db4d093f63b836be18d98b72fda2a94dfcea72eea5acb52ba6d0c7cd`다. 승인 후 새 UUID·실측 git/docker 지문·새 시각으로 기존 형식의 외피를 발급한다. 추가 의존성 준비는 기존 고정 registry·lock·integrity와 스크립트 미실행 조건의 A3 전용 npm 경로를 사용한다.

A3 전용 PG와 내부망에서 SQL 정의 설치·원장, 0095 두 NOLOGIN 역할과 임시 ADMIN 멤버십 생성·회수, 합성 사용자의 TC01 저장·재조회를 1회 검증한다. 전체 30분·PG 10분·자식 시험 90초를 기존 실행기에서 제한한다. 정상 결과와 소유를 검산한 뒤 A3 PG·내부망만 정리하고 감사 자료를 보존한다. 실패 또는 결과 불명 시 실행기 분류를 보존하고 후속 조회·자동 재실행·자동 삭제를 하지 않는다. A2 최초 START 원인과 전체 IX01 인수는 별도 미확인 상태다.

## 검산 근거

검산 세션 c029b4는 종료 0으로 실행 소스의 Git 원바이트를 확인했다. 아래는 실행기의 sourceFiles 순서이며, 길이와 SHA256은 외피 발급 시 같은 커밋에서 다시 계산해 대조한다.

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| scripts/qa-ix01-current-journey.ts | 49053 | c9b7a411fc2859b5772cfcea01f5191b2021c894a4d399a8882f04a88b19af5e |
| tests/integration/IX01/current-methodology-journey.test.ts | 5956 | 3e4de3fe9a45cc092431bbf52160a46b76ff933f3232ab44817da46c0adcb9a0 |
| scripts/qa-ix01-schema-closure.sh | 35588 | b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733 |
| docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv | 15807 | 0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd |
| docs/design/공식산출물_양식정의.md | 11130 | 622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13 |
| docs/design/문서작성_공통기준.md | 9067 | 85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07 |
| docs/design/기본방법론_상세검토안.md | 8533 | 1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1 |
| package.json | 943 | e61265b7bf4e9e31445be12048f574e0cb7940c5888922e7f087603e8b10eede |
| package-lock.json | 76254 | ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6 |
| tests/integration/IX01/current-schema-baseline.ts | 9378 | 1a09b52302f988cdc92e252ddc7b8996dada82845ff3717d71fe40373d0486f2 |
| tests/integration/IX01/current-schema-installation.ts | 3402 | 0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1 |
| tests/integration/IX01/methodology-copy-application-scenario.ts | 12887 | d27416d76b08a1e97eb8672c61615b36816a3ee43bb5fbd7642d946ae40fe3e7 |
| tests/integration/IX01/journey-context-lifecycle.ts | 694 | 90d4107fd6e7c15545333afcb0ebab2d06c44660605166233d1198dae91736c9 |
| tests/integration/FN12/result-qa-fence.ts | 1110 | 97308aeb2a45121be699c4ac2d07a6147efbe12534e3aacbcdc291bffa1f8224 |

정렬된 SQL 경로 배열의 JSON.stringify 결과 SHA256은 44d4e4f1133f03b99c7a86634682d56ff25485bcb014c65483bd691706414a12다.
