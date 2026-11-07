# IX01 R4 정의 설치 진단 source 준비 결과

2026-11-04 · SOURCE_REVIEWED · ACTUAL_NOT_RUN · 실행 승인 아님

## 판정·범위

R4 전용 namespace·index 경로 결박만 준비했다. 실행 code는 cd6b832289716e686d263b7f62a80a18499fb566이며 SQL 기준은 0a647daa66103ada3bd5e949b64f407c3e7b5687이다. 실제 R4 자원은 아직 생성0·실행 미승인이다. 전체 IX01/작업계획 완료가 아니다.

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|33542|efb1c117e26cf3b57a1957c1342dbd1fda3c0a8190471eb7c66c4ad04a991189|
|tests/unit/IX01/schema-closure-controller.test.ts|37726|ba95b11848be9c76e2b0a612795da7bf8046a83a6960d4432b2ab08f1ff5db79|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R4.tsv|15981|d6b4b8abb1e070cfc70f1f6fe79034dae22d3fd0b3cd9982c73417d29e88a4da|

## 검증 증거

- Primary 5d57bc: source2 namespace·음성 변경 역치환 시 부모 raw 완전동일. R4 index는 R3 index와 raw 동일.
- Primary 1746ac: node --test tests/unit/IX01/schema-closure-controller.test.ts, 46PASS/skip0/894.5064ms/exit0.
- Primary 0f4a34: Git Bash --noprofile --norc -n scripts/qa-ix01-schema-closure.sh, exit0.
- Primary 97762e: 허용 source2 git diff --check 및 지문 수거, exit0. 향후 LF→CRLF 경고는 보존했고 설정은 바꾸지 않았다.
- Main d7ade0: driver namespace 역치환 동일·index raw 동일·SQL head 불변·hash/diff0.
- Main 04e09f: unit 차이는 namespace와 명시 과거 cwd 음성 결박뿐이다.
- Main 833829: 새 R4 집중1PASS/159.2744ms. 전체46 재실행 증거로 부풀리지 않는다.
- 타입 구조 변경0: 부모 준비판정의 Primary 790623 root noEmit exit0를 인용하며 반복하지 않았다. 원 명령은 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 이다.

## 부모 보완·역사

부모 I1/I2·실공유 run 경계 보완의 46PASS/독립 C0/I0/M0는 IX01_FINAL_SERVER_READINESS_SOURCE_RESULT_20261104.md를 참조한다. 최초44PASS는 trim/오류변환 경계를 놓친 보완 전 증거이며 실제 준비 성공으로 소급하지 않는다. R4는 readiness/run factory/안전진단·권한·기한·UNKNOWN·회수 로직을 변경하지 않았다. 정상 SQL 기준0a는 허용하고 과거 R3 cwd·구 R2 SQL 기준을 claim 전에 거절한다.

원 R3는 ROLE_PRISTINE/UNKNOWN·ddl UNKNOWN·cleanup NOT_ATTEMPTED였고 SQL105와 installer bootstrap 미도달이다. 원인 직접확정0이다. 별도 정리 승인 뒤 7735be에서 fullID/name/source 잔여0을 확인했고 58f52018에 기록을 보존했다. 원 R3 UNKNOWN과 감사는 유지한다. 이번 R4 준비를 원 R3 성공으로 바꾸지 않는다.

## index·미검증·소유 반환

index106은 표시용이며 적용순서가 아니다. 중복0031 pending을 제외한 명시105의 합계2376139B·order 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef를 유지한다. R1/R2/R3 index와 SQL·원장·packet·Main 문서·보호3을 수정하지 않았다.

실 image 내부 entrypoint/실 PID1 형식/PG·DDL105·권한/RLS/API/UI·IX01 사용자인수·실제 DB/WSL/Docker/role/키/서비스/Agent/P03R3는 NOT_RUN이다. source-only 준비 수행자의 live handle0·writer 반환. 실제 단1회 실행은 별도 새 승인 후 Main만 소유한다. rollback은 이번 R4 source3만 부모와 대조하며 원 감사는 삭제하지 않는다.
