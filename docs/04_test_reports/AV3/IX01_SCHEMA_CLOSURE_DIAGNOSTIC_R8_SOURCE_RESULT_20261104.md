# IX01 R8 정의 설치 진단 source 준비 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_NOT_RUN

## 판정·고정 기준

실행 code 2224224fc1b1b02776258b2db2bde4bf7dd8c309와 SQL sourceHead fed86a515561d3f342859367d90d94e26b530248를 구분한다. instance 2224224fc1b1b02776258b2db2bde4bf는 code.slice(0,32)로 생산해32자리를 검산했다. 후행 문서 commit을 실행 code로 대체하지 않는다. 전체 IX01/계획 완료가 아니다.

| 파일 | bytes | SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|35588|e743b0f864673b67b7a958d87b9a2927139923e33af60f5e1c204701e2473b57|
|tests/unit/IX01/schema-closure-controller.test.ts|49264|d16a063b9d80f0c9d7a5871f275d8b2888a967da0ac83bdf0dc2969022bb08e3|
|docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R8.tsv|15981|0b4ec445d8eea7b169cbf65a73055b8651d52f2aaf146cda9b842787d1e5cb32|

## SQL 변경·기존 로직 보존

R7 SQL7adc 대비0071 감사 fullref 비교식의 correction_of))))를 correction_of)))로 고쳐 닫는 괄호 한 문자만 삭제했다. SQL0071 raw SHA256 B2F6870196E01CCC722A0EEED51E527B1D7D89DBD6D1C9B97AD4937E526D10EC/40917B이며 부모40918B 대비-1B다. 역삽입하면 부모11DCE811 raw와 완전히 동일하다. 감사 필드·hash 입력·canonical·시각·모든 guard/ACL/권한은 보존했다. 이전0069 wrapper/ACL 두 블록 순서와0039 내장SHA256 보완도 그대로 보존한다.

provider owner 준비·0037 원자Tx·role metadata·권한·기한·UNKNOWN·회수·격리는 R7 및 R5와 동일하다. R8 index는 header baseline과0071 hash/bytes만 변경했고 다른105행은 동일하다. 표시106/명시105/2376142B/order 09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef이다.

## 서로 다른 검증 분모

- 부모 provider source: Primary ba8bea56PASS/skip0/1056.8243ms·e4985a noEmit0; Main5de96f fresh56PASS/1094.703ms. 기존 증거이며 이번 재실행0.
- 이전0069 순서 source: f40ca7 직접/인접50PASS/skip0/5716.9251ms·898c9c noEmit0. 원문 역이동/ACL 보존 source 증거이며 이번 재실행0.
- 새0071 source: b0dacd 괄호 불균형RED1→7db50f 원handle60906→ce872a 수거 신규2+authority3+store39=44PASS/skip0/16026.664ms;2e4c9c noEmit0·aeac03 한hunk/-1B/역삽입 부모raw 동일. 실제 PG GREEN은 NOT_RUN이다. 최초 안내 언어 오류1회는 즉시 한국어로 정정했으며 제품 오류가 아니다.
- R8 source3:fd3017 직접3PASS/skip0/590.1264ms·a95774 Bash-n exit0·11e9e4 index/합계/원0071/공백 검산0. namespace·SQL기준·추가 음성을 분리한 역치환 부모raw 동일, index 세 필드 외 다른105행 동일. 준비/검증 오류0.
- Main5abeb7은 역치환/106 Git blob·선택 합계를 독립 검산했고 a17a01 변경음성1PASS/137.8831ms다. 부모56/noEmit·환경50·native44·R8직접3/Main1은 각기 다른 분모이며 전체 PG/IX01 PASS로 합치지 않는다.

직접3 명령:
```text
node --test --test-name-pattern='R8는 과거|0037선택만|actual controller→bootstrap' tests/unit/IX01/schema-closure-controller.test.ts
```
Bash 명령:
```text
& 'C:/Program Files/Git/bin/bash.exe' --noprofile --norc -n scripts/qa-ix01-schema-closure.sh
```
타입 구조 불변으로 이전 noEmit을 재사용했고 namespace 갱신에서 재실행하지 않았다.

## 실제 과거·미검증·반환

R7 실제 slot1은 code41f03757/SQL7adc72b4에서0071_native_preparation_authority.sql.pending 정의 설치가 SQLSTATE42601/diagnostic null/statementEndLine87로 FAILED/CLEANED였다. 오류 원문 전체는 미수집이므로 직접 원인행·메시지를 확정하지 않는다. Main c12a6a는2026-11-04T01:23:10.015Z 별도 exactID/name/source 부재와 감사 hash 동일·실행자원잔여0을 확인했다. 원R6의0069/42883 FAILED/CLEANED·c07b3e 정리0, 원R5의 최종PID1·0037 설치/회원 회수 통과 및0039 FAILED·잔여0, 원R4 FAILED·R3 UNKNOWN·R1/R2 실패와 감사를 보존한다.

R8는 NOT_APPROVED/자원 생성0·시각 발급0이다. 실제 PG/SQL·ACL/RLS·DB/권한/키·WSL/Docker·서비스·Agent/P03R3·API/UI/IX01·사용자인수는 NOT_RUN이다. 실행 후보의 plan18/owner6·SQL10 원문과 hash는 순수 module 생산·자체 검산으로만 확인한다. 문서2만 신규 작성했으며 code/test/index/WORK_STATUS/Git·기존 감사/packet/보호3은 변경하지 않았다. writer 반환/live0. rollback은 R8 source3만 부모와 대조하고 기존 감사·소진 이력을 보존한다.
