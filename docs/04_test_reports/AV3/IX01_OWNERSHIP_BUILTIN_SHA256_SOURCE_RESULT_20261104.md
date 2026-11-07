# IX01 ownership SHA256 의존 source 보완 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_NOT_RUN

## 판정·변경
WI36BD1564BBDA5B6C7111678EB314DB8C36814A1BB89C04704F764C57BDE52FF1의 허용2경로만 보완했다. 기존Primary 단일writer 구현 후 Main이 source 범위 C0/I0/M0로 인수했다. 실제 PG 함수해석/해시 동등성·105전체설치·권한/RLS/API/UI 합격은 미검증이다.

미적용0039의 두 digest(bytea,'sha256')를 pg_catalog.sha256(동일bytea)로 바꿨다. 2hunk/+4B이며 encodehex·canonical UTF8·nonce translate/padding/decode·모든 guard·함수 속성/DDL/ACL은 그대로다. 원본CC583507로 역치환하면 raw byte동일이다. 확장설치·검색경로확대·새함수/권한변경은 없다.

PG15 공식 [내장 SHA256·encode](https://www.postgresql.org/docs/15/functions-binarystring.html)과 [pgcrypto digest](https://www.postgresql.org/docs/15/pgcrypto.html)는 두 함수가 동일 binary bytes의 SHA256 bytea를 반환함을 정의한다. 기존0017:312~313도 같은 canonical UTF8를 내장sha256으로 처리한다. 이 근거와 source 보존 검증은 실제 PG 실행 증거와 구분한다.

| source | bytes | SHA256 |
|---|---:|---|
|db/migrations/0039_ownership_authority.sql.pending|31920|D7ABFB411CA497CDB197574589AD34C15EF4172216312FC0E00C13D3365EEA66|
|tests/unit/FN06/ownership-sql-hash-source.test.ts|1698|CF6DA8FEF369DA770B42051E6AC12D0EA12D68A854E162762EC5B05F4912162F|

## 검증
- Primary323ea4: source 의존RED1·보존PASS1,exit1.
- Primary34116f: node --test tests/unit/FN06/ownership-sql-hash-source.test.ts tests/unit/FN06/ownership-ledger-contract.test.ts tests/unit/FN06/ownership-observation-contract.test.ts,신규2+기존7+4=13PASS/skip0/241.6562ms/exit0.
- Primaryf0b2c4: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json,exit0.
- Primary653573 diffcheck0·2hunk/+4B,7d2682 신규시험서식0.
- Primary0f9c00: 원before각1회/부모rawCC583507/역치환byte동일.
- Main71d7da: node --experimental-strip-types --test 위동일3파일,13PASS/skip0/187.9215ms/exit0. SQL두hunk와신규검사의 source한계를읽기검수했다.
- 실제 PG parser/함수hash/DDL 재실행은 하지 않았다. 자가 Nodehash 비교나 가짜 SQL interpreter를 PG 증거로 쓰지 않았다.

## 미검증·후속
소진 R5는0037 정의 통과 뒤0039/42883/FUNCTION digest에서 FAILED이며82c265 실행자원잔여0·감사보존이다. 과거 R4 FAILED/R3 UNKNOWN은 유지한다. 이번 보완을 R5 성공으로 소급하지 않는다.

실제 DB·SQL/확장·권한·키·WSL/Docker·실자료·서비스·Agent/P03R3·새QA실행0·추가오류0·writer반환/live0. Main동시코드쓰기0. 기존index/manifest/적용SQL은수정하지 않았다. 새SQL기준commit·새index/선택·namespace/정확실행안과 새직접승인 전 다음 QA를실행하지 않는다. rollback은 이번 SQL/test2만 부모와 대조하는 후속 정상commit이며 과거원문/감사를지우지않는다. 전체작업계획 미완료.
