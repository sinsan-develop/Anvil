# IX01 R5 고정 실행 source 준비 지시서

2026-11-04 · SOURCE_ONLY / 실제 QA 미승인

## 기준·목적
부모 4fa524c2dd2ec0c84ce15b00c61db716d4fe5122는 provider owner 준비·0037 원자 실행 source2의 독립 검수본이며 private 동일·tracked clean이다(보호 untracked3 별도). R4 실행 승인은 소진됐고 원 FAILED/감사/정리잔여0을 보존한다. 새 R5 전용 namespace를 source에 결박하는 준비만 수행한다.

## 단일 writer·허용3경로
기존 Primary가 다음 경로만 수정한다. Main은 동시 코드쓰기0·문서/Git/독립검수를 소유한다. 다른 사람 변경·보호 untracked3·제품·SQL·과거감사를 수정하지 않는다.
1. scripts/qa-ix01-schema-closure.sh
2. tests/unit/IX01/schema-closure-controller.test.ts
3. docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R5.tsv 신규(기존 R4 raw 동일 복사)

## 정확 변경
R4 고정 namespace를 R5로만 대체한다. source /home/daon/anvil-ix01-ddl-20261104-r5-qa,receipt /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r5,container anvil-ix01-ddl-pg-20261104-r5-a[123],database anvil_v3_ix01_ddl_20261104_r5_a[123],owner IX01_DDL_20261104_R5,index R5.tsv. 날짜·SQL sourceHead0a647daa/index106·명시105·2376139B/order09d2e7d5 불변. 실제 승인된 새 실행은 slot1 한 번만 가능하며 source의 기존 슬롯 일반 구조를 실행 승인으로 확대하지 않는다.

provider 준비/원자Tx·메타데이터/회수·고정SQLhash·기한·환경·UNKNOWN/정리 로직은 부모 그대로 보존한다. 과거 R4 cwd를 claim 전에 거절하는 음성 결박만 새 R5에 맞춘다. 원 R2 잘못된 baseline 음성은 유지하고 동일 correct0a647daa를 과거 R4라는 이유로 잘못 거절하지 않는다.

## 검수
원 driver namespace 역치환이 부모와 byte동일임을 확인한다. 시험 diff는 namespace/제목/직전 R4 cwd 음성만이어야 한다. 신규 index는 부모 R4 원 raw/크기/hash와 동일하다. 직접 namespace 음성·필요 집중/Bash-n/diff를 수행하고 원 source2의 fresh56/noEmit 증거를 재사용하되 로직 변경이 있으면 영향검증을 다시 선정한다. 불필요 전수 반복/타입불변 noEmit 반복은 하지 않는다.

## 실제 실행 제외·결과
새 PG/DB·역할/GRANT·키·권한·WSL/SSH/Docker·실자료·서비스·Agent/P03 R3·배포/비용 실행0. 현재 코드 준비는 새 실제 QA 승인이 아니다.
정확 파일/bytes/hash·역치환·음성검증·미실행·오류횟수·writer반환을 Main에 제출한다. Main 검수/commit/private exact 후 새 실행 code와 instance32,생산 bootstrap/회수 SQL 전부·명시105·환경/기한/UNKNOWN·정리 범위를 후속 후보 문서에 동결한다. 소진 R4 slot/원장/경로/승인을 재사용하지 않는다.
