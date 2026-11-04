# IX01 R9 정의 설치 진단 source 준비 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_NOT_RUN

## 판정·고정 기준

실행 code a7527b79b3d4db38f82838abdbbf03ded103205e와 SQL sourceHead a3a12bd3e4fbf430d997c8d1c764c4de30b27ffb를 구분한다. instance a7527b79b3d4db38f82838abdbbf03de는 code.slice(0,32)로 생산해32자리를 검산했다. 후행 문서 commit을 실행 code로 대체하지 않는다. 전체 IX01/계획 완료가 아니다.

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|35588|b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733|
|tests/unit/IX01/schema-closure-controller.test.ts|49322|314c7adbecbce4d306b8134946b10e328cca723d17cd5811183a73b7b057175a|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R9.tsv|15981|4c186b4cae4d54124af89bace1c955ab2db8c80605360bb908f212dd3b339aa8|

## SQL 변경·기존 로직 보존

R8 SQLfed86 대비0074 회원 완결식의 old.content_hash)))))));를 old.content_hash))))));로 고쳐 닫는 괄호 한 문자만 삭제했다. SQL0074 raw SHA256 E3DBD7FA537705C94CB34BC5D93AA643D6CA4B7E4C6E6C5155F186EE88416941/33601B이며 부모33602B 대비-1B다. 역삽입하면 부모67696FDD raw와 완전히 동일하다. 서비스 project-memberships.ts의 membershipChecksum은 정확 새SQL hash literal 하나만 갱신했고 원 행수1/동일값/64길이 검사·guard는 불변이다. 이는 source 갱신일 뿐 실제 schema_migrations·서버·DB에 적용하지 않았다. 이전0071 한 문자·0069 wrapper/ACL 순서·0039 내장SHA256 보완을 보존한다.

provider owner 준비·0037 원자Tx·role metadata·권한·기한·UNKNOWN·회수·격리는 R8 및 R5와 동일하다. R9 index는 header baseline과0074 hash/bytes만 변경했고 다른105행은 동일하다. 표시106/명시105/2376141B/order 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef이다.

## 서로 다른 검증 분모

- 부모 provider source: Primary ba8bea56PASS/skip0/1056.8243ms·e4985a noEmit0; Main5de96f fresh56PASS/1094.703ms.
- 이전환경0069 순서 source: f40ca7 직접/인접50PASS/skip0/5716.9251ms·898c9c noEmit0.
- 이전native0071 source: b0dacd RED1→7db50f/ce872a 신규2+authority3+store39=44PASS/skip0/16026.664ms·2e4c9c noEmit0.
- 새회원0074 source: a27d83 괄호 불균형RED1→68ea7d schema/input/memberships16PASS/skip0/596.4837ms;673089 원handle46912→760f23 noEmit exit0·99bad8 SQL/서비스 역치환 부모raw 동일·기존 시험보존·두 단일hunk 검산0. 실제 PG GREEN은 NOT_RUN이다.
- R9 source3:200c70 직접3PASS/skip0/163.9382ms·4af119 Bash-n exit0·81b4e2 index/합계/원0074/공백 검산0. 추가 음성을 분리한 driver/test 역치환 부모raw 동일·index header/0074 hash/bytes 외 다른105행 동일.
- Main826ac6 역치환/106 Git blob·선택 합계 독립 검산0·aadd42 변경음성1PASS/136.7425ms. 이전56/noEmit·환경50·native44·회원16·R9직접3/Main1은 서로 다른 분모이며 합쳐 전체 PG/IX01 PASS로 표시하지 않는다. 기존 검사는 재실행하지 않았고 이번 R9 source 준비 오류0이다.

직접3 명령:
```text
node --test --test-name-pattern='R9는 과거|0037선택만|actual controller→bootstrap' tests/unit/IX01/schema-closure-controller.test.ts
```
Bash 명령:
```text
& 'C:/Program Files/Git/bin/bash.exe' --noprofile --norc -n scripts/qa-ix01-schema-closure.sh
```
타입 구조 불변으로 이전 noEmit을 재사용했고 namespace 갱신에서 재실행하지 않았다.

## 실제 과거·미검증·반환

원 R8 실제 slot1은2ed711 exit1/code2224224f/SQLfed86a51에서0074_project_membership_versions.sql.pending 정의 설치가 SQLSTATE42601/diagnostic null/statementEndLine110로 FAILED/CLEANED였다. 오류 원문 전체는 미수집이므로 직접 원인행·메시지를 확정하지 않는다. Main5aac01은2026-11-04T01:44:14.320Z 별도 exactID/name/source 부재·실행자원잔여0 및 감사 보존을 확인했다. 원R7의0071/42601 FAILED/CLEANED·c12a6a 잔여0, 원R6의0069/42883 FAILED/CLEANED·c07b3e 잔여0, 원R5의 최종PID1·0037 설치/회원 회수 통과 및0039 FAILED·잔여0, 원R4 FAILED·R3 UNKNOWN·R1/R2 실패와 감사를 보존한다.

R9은 NOT_APPROVED/자원 생성0·시각 발급0이다. 실제 PG/SQL·ACL/RLS·DB/권한/키·WSL/Docker·서비스·Agent/P03R3·API/UI/IX01·사용자인수는 NOT_RUN이다. 실행 후보의 plan18/owner6·SQL10 원문과 hash는 순수 module 생산·자체 검산으로만 확인한다. 문서2만 신규 작성했으며 code/test/index/WORK_STATUS/Git·기존 감사/packet/보호3은 변경하지 않았다. writer 반환/live0. rollback은 R9 source3만 부모와 대조하고 기존 감사·소진 이력을 보존한다.
