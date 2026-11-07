# IX01 최종 서버 준비·역할 관측 진단 source 결과

2026-11-04 · SOURCE_REVIEWED / ACTUAL_VALIDATION_NOT_RUN

R3의ROLE_PRISTINE/UNKNOWN은직접원인미확정이다. Main은681d5e/PG15공식 https://www.postgresql.org/docs/15/app-pg-isready.html 및공식현재 https://raw.githubusercontent.com/docker-library/postgres/master/docker-entrypoint.sh 를대조해임시socketready가최종서버·정확DB접속완료를뜻하지않는경계를확인했다. 고정cache이미지내부코드/실프로세스형식일치는아직실검증하지않았다.

## 변경·권위
기존Primary가정확driver/controller시험2경로만구현했다. 최종PID1의고정/proc/1/comm 관측→기존pg_isready→목표DB의pristine역할읽기1회/strict검산으로결박한다. 초기화중은기존40회/250ms·전체기한/cleanup여유안에서유한관측,알수없는PID1/timeout/실패뒤role재조회·bootstrap·정리0. 별도성공용SELECT를추가하지않았다. 역할조회오류는원run경계의비공개class/고정enum만기존diagnostic으로남기며임의오류/SQL/Secret을반환하지않는다. migrationDDL parse/기타출력trim·CREATEROLE/회수/소진/UNKNOWN/기한·보안조건은보존한다.

| 파일 | bytes | 최종SHA256 |
|---|---:|---|
|scripts/qa-ix01-schema-closure.sh|33542|7A1E0065C007EF46A9B5A87D4CE9BA5A65E2DC6A463D7B4269790BB08FB8A520|
|tests/unit/IX01/schema-closure-controller.test.ts|37723|F14854C6497203A54EBDF31D684D0FAB555D12B9BF9618DE559902EBCD5B5155|

## RED·독립 검수·재보정
Primary1fbed2 신규5RED/205.3641ms→9c85ec 최초44PASS/433.313ms를보존한다. Main790222/1a8e21/501007은C0/I2를발견했다. actualrun.trim→newline필수PID1parser불일치와actualrun.parsePsqlFailure→역할원status/code소실이었다. 최초fixture는실정제/분류선을우회했으므로44PASS를실준비성공으로쓰지않았다.

같은Primary의877b15는실run표현식경계를소비해두문제RED/203.8397ms를재현했다. 674217 집중GREEN2→522aa6 최종46PASS/skip0/967.5311ms/exit0. 신규시험은actual run→docker→psql→roles/finalServer표현식을연속소비하고최하단exec만메모리대역으로바꾼다. PID1만raw보존,역할만원경계trusted진단,다른trim/DDL분류는유지한다. 124e94추출공백/CRLF준비오류와c66aec exact-parent공백불일치(쓰기전중단)는원실패로분리한다.

Main af6faa 최종46PASS/skip0/903.2594ms/exit0. d5d2ec의동일최종hash/diff/실호출선대조와diffcheck0으로I1/I2한정보완을검수했다. 현재scoped C0/I0/M0. Primary최종790623 noEmit0/776d02 Bash-n0/25a20b diff0을검수했고같은검사를불필요하게반복하지않았다. Git미래CRLF경고는보존/설정변경0이다.

## 한계·정리·다음
실image/실프로세스/PG/역할·DDL105/RLS/API/UI·IX01/사용자인수는NOT_RUN. 기존R3UNKNOWN직접원인은여전히미확정,보완코드를원R3성공으로소급하지않는다. 원R3QA는별도직접승인으로정리했고7735be에서실행자원잔여0/감사보존을확인했다. 이번source2는실환경에적용하지않았다. SQL/index/원R1R2R3감사/실행packet/보호3불변,Primarywriter반환/live0/Main코드쓰기0. rollback은이번source2만부모와대조한다. 다음실제단1회는새namespace·정확code/hash/계획동결과별도승인전에는수행하지않는다. 전체작업계획은미완료다.
