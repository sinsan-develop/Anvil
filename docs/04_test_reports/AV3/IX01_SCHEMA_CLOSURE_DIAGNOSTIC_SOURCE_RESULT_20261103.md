# IX01 SQL 정의 의존 진단 도구 source 검수 결과
2026-11-03 · Main 어울 / 구현: 기존 Primary

판정: **SOURCE_PREPARED / ACTUAL_NOT_RUN**. 제품 기능·IX01 통합·환경 복구·전체 계획 완료가 아니다.

## 기준·변경
- branch codex/av3-stage-b, 시작/SQL 기준 d2f6ab8c74fad09f26319f77b3acb80afe3f927b. Main은 코드 쓰기0, 기존 Primary만 정확3 source/data를 작성 후 동결·반환했다.
- WI r1 BA51AE1F24D10D38A9FC68BE27A385E7E5821A6CCE6BC616CDC341DB594454F7 → r2 55212D93438EA39BAA0EE4040048D8561C84EC1A82133EB44A510D3103466D2C.
- 신규 scripts/qa-ix01-schema-closure.sh SHA2A5D422C89C564655360422962D2208A8240F38F2C6B99AA5E5C0586B4FB7F14.
- 신규 tests/unit/IX01/schema-closure-controller.test.ts SHACBE8B182D7A2F38D4CE694E48621244F5D9CE01082B8DC039D80575186F3F834.
- 신규 docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261103.tsv SHADC8B5FC0FC6FC980EC28C7C5DC367BEE2CBAF1B20F877C06FF6E97851D286045.
- 제품 API/UI/SQL 원문·기존 guard·합격 기준 변경0. 인덱스는 표시 목록이며 적용 순서를 자동 정하지 않는다. 새 의존성 설치0.

## 검수·재작업
- Main이 Tmpfs JSON 키 순서 비교, actual psql verbose/parser 불일치, 불필요한 QA 암호 전달을 발견해 기존 Primary에 보완했다. 이후 정제 child환경/빈 Docker config·부모FD 검산·안전 오류·daemon ID/Name 최소 수집·로그 driver none을 확인했다.
- RED 1543d9 2건 및 1a6de8 로그 격리 반례를 보존한다. 수정 전 실패를 PASS로 소급하지 않는다. 환경 오류95d959의 MSYS NtCreateDirectoryObject 0xC0000022는 별도이며 allowed 실행b383de에서 해결됐다. ACL/권한/설정 변경0.
- Primary 최종 f7d968:27PASS/0FAIL/skip0/2685.7247ms,617945→b3fbc0 noEmit exit0,b1bfef Bash-n exit0,d0ca54 diff/공백 exit0. 이전13/15/20/25 PASS는 이전 snapshot이다.
- **Main 독립5766b6**: node --test tests/unit/IX01/schema-closure-controller.test.ts, exit0/27PASS/0FAIL/skip0/319.7137ms. 실제 port를 fake한 기능 검사와 Bash source 효과0 검사이며 실제 Docker/PG/보안 인수 증거가 아니다.
- **Main 독립ada30b**: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 및 Git Bash --noprofile --norc -n scripts/qa-ix01-schema-closure.sh, exit0/4.9796초.
- **Main4509c1**: index106의 고정 Git raw SHA/bytes 전부 일치, 기존53 checksum 일치와105/96 명시 순서 digest 재계산 exit0. Git blob 읽기만 했고 SQL 실행0.

## 미실행·잔여
- --run/실제 WSL·Docker/PG/DDL·role/GRANT·원장/자원 생성/정리·키·서비스·Agent·사용자 자료·P03 R3 전부 NOT_RUN/0. 실제 테스트 결과서가 아니다.
- 기존53 prefix+후행52 전체105(orderHash09d2e7d5…3f24ef)는0066/0073 CREATEROLE 선행과 현재 NOCREATEROLE bootstrap이 충돌한다. 권한 상승/SQL 변경0이며 전체 설치 ready0이다.
- 0065까지96(orderHash98a6f1ba…1a26dc)은 한정 후보일 뿐 최신0073/0074 collector를 제외해 전체 IX01 선행을 충족하지 않는다. PMO에 역할 선행의 정확한 판단을 요청했고 미정 후보 실행0이다.
- UNKNOWN은 자동 정리하지 않으며 기한 뒤 자원이 남을 수 있다. 실제 허가안은 이 사실과 수동 소유 검토·종료/제거 범위를 명시해야 한다. 지금 QA 자원을 만들지 않았으므로 실제 정리 성공이라고 보고하지 않는다.

## 보존·다음
- 기존 dirty/보호 untracked3/main은 변경하지 않는다. source3+Main 소유 문서만 검수 checkpoint하며 정상 private branch push를 수행한다. Git 게시 SHA/증거는 WORK_STATUS에 추가한다.
- rollback은 source-only 신규 경로3의 후속 정상 revert이며 reset/force/사용자 파일 삭제를 하지 않는다. 실제 환경 rollback은 이번 대상0이다.
- 실제 실행 packet은 구체적인 code SHA/선택/입력/자원/수명/정리와 별도 허가를 갖추기 전까지 NOT_READY_TO_RUN이다. FN06 신규 native 계약 미채택과 기존 계획의 다른 미완료를 유지한다.

## r3 — 원 SQL의 전용 installer 선행 source 검수
- 직접 실제 실행 제외는 유지하며 PMO 기술 권장에 따라 기존 Primary의 driver/unit 정확2경로만 보완했다. source 기준10a00aad9b40a37f13a7a56b83d3b19824bf1833, WI r3 CA669BECF46C5FE62402984C14CF6C2E3662733C7CD250209E120FC45F2CDEF0. 원 index106/DC8B5FC0·모든 SQL/제품은 불변이다.
- 최초 RED1bdc94는 기존 bootstrap의 NOCREATEROLE이0066/0073 명시 선행과 다른 반례이다. 기존 source의 비특권 기대를 말없이 낮춘 것이 아니라 새 빈 cluster installer에만 필요한 조건과 회수·검산을 WI r3에 명시했다. 실제 해당 권한은 부여하지 않았다.
- 최종 driver SHA4750BAD4F26616807C7325E6967AA08212E3B4BE53ADFA3527D515D469BCB6D9, unit SHA2FDCA333CC22D1DBAD856C09AF423801B42400144335E7902EBAE8F5EC635B62. 원27은 전 snapshot이며 최종은34개이다.
- Main e4aa3d/c47b5d 독립 diff·actual psql -A/-t/builder→동일 역할 metadata parser→bootstrap 전후/정착 후 회수 전후와 기존 원SQL의 reader membership 회수 소비를 확인했다. 이 두 source의 scope/spec 정적 미해결 Critical/Important0이며 실제 PG/보안 인수를 뜻하지 않는다.
- **Main08fb80** node --test tests/unit/IX01/schema-closure-controller.test.ts, exit0/34PASS/0FAIL/skip0/398.5456ms. 잘못된 role·superuser/BYPASS/예상밖 membership, 선생성 reader, 설치 완료/부분정착/rollback, 회수 COMMIT불명·사후 metadata차이에서 후속 mutation/정리0을 검산했다. 실제 PG가 아닌 공유 controller/builder의 fake ports이다.
- **Main a9c9f2** root tsc --noEmit -p tsconfig.base.json 및 Git Bash --noprofile --norc -n scripts/qa-ix01-schema-closure.sh, exit0/7.276초. Primary649bf4 34PASS/327.4776ms·24efc5 noEmit0·c7d75b Bash-n0와 별도이다.
- **Main b476d4** 동결 source에서 함수만 추출해 bootstrap/metadata/회수 SQL 원문과 hash를 독립 계산했다. a1 bootstrap496caf4e72938b8129b8b52354afc7c0a8c8db8f2c39ed598716247b758ece8c, metadata23237b193e7c863d1d2b0e1c30eb29d9c5d62fc4d93129b97e525aff499812e1. 이 계산에서 default plan 정보 actualExecuted:false만 함께 출력됐고 실제 port/DB/role은0이다.
- source가 의도하는 설치 구간은 migrator만 CREATEROLE/NOSUPERUSER/NOCREATEDB/NOREPLICATION/NOBYPASSRLS, app/reader는 비특권이다. 원SQL정착 후 정확 새 cluster fullID/속성/멤버십을 재검산하고 CREATEROLE 및 남은 정확 reader membership을 회수한다. 불명/metadata차이는 UNKNOWN이며 추가 mutation·정리·다음slot0이다.
- 실제 WSL/runtime/PG parser/DDL/role/GRANT/회수·DB·키·서비스·Agent·자원/원장 생성·정리0/NOT_RUN을 유지한다. 새 QA의 정확 실제 실행은 아직 NOT_APPROVED이다. 판정 SOURCE_PREPARED_ACTUAL_NOT_RUN, IX01/기능/전체 계획 미완료다.
