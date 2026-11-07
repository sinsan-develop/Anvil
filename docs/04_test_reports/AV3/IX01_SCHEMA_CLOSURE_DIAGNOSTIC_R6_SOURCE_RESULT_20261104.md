# IX01 R6 정의 설치 진단 source 준비 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_NOT_RUN

## 판정·고정 기준

R6 source3은 SQL 기준·namespace·직전 R5 cwd/SQL 기준 거절 음성만 변경했다. 실행 code 435300939597162654f89ab3c85823dd25f31f4b와 SQL sourceHead 69bdb75a1db5d3557e55daa03f2415635b100e31를 구분한다. 후행 문서 commit을 실행 code로 대체하지 않는다. 전체 IX01/계획 완료가 아니다.

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|35588|409ab3c88cf6cfb8e5e3a236d6ed74c77a9f97d5084c61ff19f77d0996b692dc|
|tests/unit/IX01/schema-closure-controller.test.ts|49148|7dac1a7dc42292faa7ad1d7db7c3ba77dc0d3bd71f95d73910864ebbfa9dc371|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R6.tsv|15981|670dd8d25db93994fdfbc51e4a89ea0e20510630a61371d94c59e99114dac3c7|

## SQL 변경·기존 로직 보존

R5 SQL0a647daa 대비0039의 digest(bytea,sha256) 두 호출을 같은 bytea의 pg_catalog.sha256으로 바꾼2hunk/+4B뿐이다. 새0039 raw SHA256 D7ABFB411CA497CDB197574589AD34C15EF4172216312FC0E00C13D3365EEA66/31920B,원CC583507 역치환 raw 동일이다. canonical UTF8·nonce decode·hex·guard/DDL/ACL·권한은 보존했다. 확장 설치나 검색 경로 확대0이다.

provider owner 준비·원자0037 Tx·선택/단계별 role metadata·회수·기한·UNKNOWN·격리·정제환경은 R5와 동일하다. 역할 준비가 R5에 없었던 것처럼 기술하지 않는다. R6 index는 header baseline·0039 hash/bytes만 바뀌고 다른105행은 그대로다. 표시106/명시105/2376143B/order 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef이다.

## 서로 다른 검증 분모

- 부모 provider source: Primary ba8bea56PASS/skip0/1056.8243ms·e4985a root noEmit0. Main5de96f fresh56PASS/1094.703ms·2fee27 exacthash/생산SQL 검산·scopedC0/I0/M0. IX01_PROVIDER_OWNER_SETUP_SOURCE_RESULT_20261104.md 참조.
- 새0039 source: Primary323ea4 의존RED1/보존PASS1→34116f 신규2+ledger7/observation4=13PASS/skip0/241.6562ms·f0b2c4 noEmit0·653573 diff0. Main71d7da fresh13PASS/187.9215ms·부모역치환/+4B·scopedC0/I0/M0. IX01_OWNERSHIP_BUILTIN_SHA256_SOURCE_RESULT_20261104.md 참조.
- R6 namespace/baseline: d5f912 source2역치환 부모raw 동일·index3필드변경/다른105행동일·새Git0039raw 일치·선택합계 검산. af75c1 직접3PASS/skip0/169.2343ms·2e9423 Bash-n0·c0df11 diff0.
- Main ef6028은 R6의 정확변경/byte동일·index670DD8D2/0039 D7·합계2376143을 독립 확인했고 c5d000 변경음성1PASS/156.1404ms/diff0이다. Main2b29f0의 tuple/object 검산 준비 오류는 e813fb의 실제 tuple 확인으로 정정했으며 제품FAIL로 세지 않는다.

직접3 명령:
```text
node --test --test-name-pattern='R6는 과거|0037선택만|actual controller→bootstrap' tests/unit/IX01/schema-closure-controller.test.ts
```
Bash 검사는 Git Bash --noprofile --norc -n scripts/qa-ix01-schema-closure.sh 이다. 타입/준비 로직 불변으로 기존56/noEmit을 재사용했고 새SQL 직접13과 합쳐 전체 PG 결과로 만들지 않는다.

## 실제 과거·미검증·반환

R5 실제 a1d2f7은 최종PID1·pristine/bootstrap·0037 원자 정의 설치·provider ADMIN회원1→0을 통과했지만0039/42883/FUNCTION digest/문장끝100에서 ddlFAILED/CLEANED였다. 최종 installer CREATEROLE=false·systemHash동일,82c265 2026-11-04T00:14:07.488Z 별도 exactfullID/name/source 잔여0·감사보존이다. 원R4FAILED/R3UNKNOWN/R1R2실패도 보존한다. R6 보완을 원R5 성공으로 소급하지 않는다.

현재 R6 자원 생성0·실행 NOT_APPROVED이다. 실PG/hash 함수해석·정의105전체·ACL/RLS/API/UI/IX01·사용자인수·DB/role/권한/키·WSL/Docker·서비스·Agent/P03R3·새원장 생성은 NOT_RUN이다. 문서2만 신규 작성하고 source/SQL/index/WORK_STATUS/Git·기존 감사/packet/보호자료를 변경하지 않았다. writer 반환/live0. rollback은 이번 R6 source3만 부모와 대조하며 기존 감사는 보존한다.
