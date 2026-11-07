# IX01 R6 SQL 기준·namespace source 준비 지시서

2026-11-04 · SOURCE_ONLY / 실제 QA 미승인

## 기준
부모69bdb75a1db5d3557e55daa03f2415635b100e31은 미적용0039의두digest표현을동일bytea의pg_catalog.sha256로교체한검수된SQL기준이다. 기존R5 SQL0a647daa대비0039두hunk/+4B뿐(8035b1),원R5/이전FAILED·UNKNOWN/감사는보존한다. 소진R5승인을새실행에재사용하지않는다.

## 단일 writer·허용3경로
기존Primary만 다음을 수정하고 Main은 동시코드write0·문서/Git·독립검수를 소유한다. 다른작업자변경·보호untracked3을 되돌리지않는다.
1. scripts/qa-ix01-schema-closure.sh
2. tests/unit/IX01/schema-closure-controller.test.ts
3. docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R6.tsv 신규

## 정확 결박
- fixed SQL sourceHead와시험의정상baseline은69bdb75a1db5d3557e55daa03f2415635b100e31로고정.
- namespaceR6:source /home/daon/anvil-ix01-ddl-20261104-r6-qa,receipt /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r6,PG anvil-ix01-ddl-pg-20261104-r6-a[123],DB anvil_v3_ix01_ddl_20261104_r6_a[123],ownerIX01_DDL_20261104_R6,indexR6.tsv.
- 기존R5 indexraw를기초로headerbaseline과0039의hash D7ABFB411CA497CDB197574589AD34C15EF4172216312FC0E00C13D3365EEA66/bytes31920만정확바꾼다. Git show 새baseline:0039 원bytes로검산하고다른105row의path/id/hash/bytes는부모R5와동일함을증명한다. 표시106/명시105/중복0031pending제외/선택경로순서order09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef 불변,선택총bytes2376143이다.
- 과거R5 cwd와원R5 SQLbaseline0a647daa를claim/create전에거절하는음성을새R6에결박한다. 기존구R2 baseline음성도보존한다.
- provider0037고정raw hash/준비·검산·단일Tx·회수,모든기한/격리/정제환경/최종PID1/공개입력결과shape·UNKNOWN후조회mutation삭제0 로직은부모그대로다. 슬롯일반구조가새QA실행허가는아니다.

## 검수
source driver는namespace/SQLbaseline역치환시부모raw동일이어야한다. 시험diff는그정상binding/직전cwd·baseline음성뿐이다. index3종변경(header와0039hash/bytes)을부모와정확대조한다. 신규baseline/cwd음성과provider 실제호출연결 직접집중·Bash-n/diff를수행하고타입·로직불변noEmit/기존56전체반복은하지않는다. 로직변경이필요하면먼저Main에구체차이를반환한다. 원SQL69bdb와최신source13/부모56증거를구분한다.

## 제외·결과
실제DB·SQL·확장·role/권한·키·WSL/SSH/Docker·서비스·Agent·실자료·P03R3·새QA 실행0,새branch/worktree/세션/자동화/Git/추가문서쓰기0.
정확hash/bytes·index역대조·명령/exit·음성수량/오류·미검증·writer반환/live0을반환한다. Main인수/commit/privateexact후새실행code/instance32·생산SQL10/선택105·기한/UNKNOWN·정리를후속실행후보에동결하고새직접승인전실행하지않는다. 전체계획미완료.
