# IX01 R5 정의 설치 진단 source 준비 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_NOT_RUN

## 판정·동결

R5 전용 namespace·index 경로와 직전 R4 cwd 거절 음성만 부모4fa524c2에서 변경했다. 실행 code는 21e9f48e538684c250c823be3af320c0c7f2f13b이며 후행 문서 commit으로 대체하지 않는다. SQL 기준0a647daa66103ada3bd5e949b64f407c3e7b5687·명시105/2376139B/order 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef는 불변이다. 전체 계획/IX01 완료가 아니다.

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|35588|ee1795da87cdd1a4824d2dca56bcf9235c43a64a1d7b5aad2fc5db633658c266|
|tests/unit/IX01/schema-closure-controller.test.ts|49076|d078d025ca3765945725df476aa8968797354fd04296714dc13c4f3b20fdea99|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R5.tsv|15981|d6b4b8abb1e070cfc70f1f6fe79034dae22d3fd0b3cd9982c73417d29e88a4da|

## 제출·독립 검수

Primary c94421은 source2 namespace 역치환 시 부모 raw byte 동일과 R5 index의 R4 raw 동일 복사를 확인했다. cb934d는 node --test --test-name-pattern=R5는과거/0037선택/actual-controller 연결의 직접3PASS/skip0/166.4829ms/exit0이다. 정확 실행 명령은 다음과 같다.
```text
node --test --test-name-pattern='R5는 과거|0037선택만|actual controller→bootstrap' tests/unit/IX01/schema-closure-controller.test.ts
```
Primary54ca29의 Git Bash --noprofile --norc -n scripts/qa-ix01-schema-closure.sh는 exit0,96af97의 허용 source2 git diff --check·지문 수거도 exit0이다. 미래 CRLF 경고는 보존하고 설정변경0이다.

Main0c5b71은 부모 대비 namespace/제목/직전 R4 cwd 음성만 byteexact 차이·신규index raw 동일을 독립 확인했다. Main7faee8은 변경 음성1PASS/326.7841ms/diff0이다. 신규 전체56을 재실행한 증거로 쓰지 않는다.

부모 provider 보완은 IX01_PROVIDER_OWNER_SETUP_SOURCE_RESULT_20261104.md를 참조한다. Primary ba8bea 기존46+신규10=56PASS/1056.8243ms·e4985a root noEmit0·0e325d Bash-n0·28ec28 diff0,Main5de96f fresh56PASS/1094.703ms·2fee27 exacthash/원46·SQL불변/생산SQL검산0·scopedC0/I0/M0를 보존한다. 타입/준비 로직이 불변이므로 부모 fresh56/noEmit을 인용하며 반복하지 않았다.

## 새 실행과 분리

0037 선택 시 별도 NOLOGIN/NOINHERIT provider owner와 migrator 임시 ADMIN membership을 원 계약대로 준비하고 exact path/hash를 psql --single-transaction에 연결하는 로직은 부모 그대로다. 준비 role·원자Tx·동적 metadata·회수·기한·UNKNOWN/보안 조건을 namespace 변경으로 완화하지 않았다. 원SQL/index 내용/선택순서는 변경하지 않았다.

R4 실제 FAILED(0037/42501/문장끝22)·R3 ROLE_PRISTINE/UNKNOWN과 원R1/R2 실패는 보존한다. R4는5b5593 최종 독립 fullID/name/source 잔여0·감사3 동일을 확인했고 보고서는 IX01_SCHEMA_CLOSURE_DIAGNOSTIC_R4_SLOT1_RESULT_20261104.md이다. R3는7735be 정리 잔여0/감사보존 이력을 유지한다. 현재 새 R5 자원 생성0·실행 NOT_APPROVED이다.

새 실제 QA의 provider role/GRANT 준비는 소진 R4 bootstrap 밖이므로 별도 정확 실행 승인 전 금지다. 원0037의 기승인 설치계약을 연결한 source 구현과 실제 권한 실행을 구분한다. 실 PG 원자성/role/ACL/RLS/API/UI/IX01·사용자인수,DB/키/WSL/Docker/서비스/Agent/P03R3·원장 생성은 NOT_RUN이다. source writer 반환/live0,문서2만 신규 추가. rollback은 R5 source3만 부모와 대조하며 기존 감사는 보존한다.
