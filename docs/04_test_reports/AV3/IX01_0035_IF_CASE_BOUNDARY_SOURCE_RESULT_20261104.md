# IX01 0035 IF/CASE 경계 최소 보정

2026-11-04 · Primary구현/Main독립검수 · SOURCE_REVIEWED / ACTUAL_PG_NOT_RUN

R2의42601/statementEndLine338은 check_work_plan_approval_command 함수 끝이다. 오류문장원문은 없으므로 아래 보정이 실제 실패의 유일한 직접 원인임은 확정하지 않는다.

Primary읽기조사는308행의 IF 조건 안 괄호없는 CASE를 좁혔다. PostgreSQL15 공식 pl_gram.y의 stmt_if1130·expr_until_then2303~2304는K_THEN까지 읽고,read_sql_construct2584~2596은parenlevel0의종료토큰에서끝난다. 이 코드상 내부CASE의THEN이IF조건경계로수집되는정적문제를확인했다. 공식원문: https://raw.githubusercontent.com/postgres/postgres/REL_15_STABLE/src/pl/plpgsql/src/pl_gram.y . 이는소스분석근거이며현재pin이미지의실제parser재현결과는아니다.

변경: db/migrations/0035_work_plan_draft_approval.sql:308에서 CASE…END만(CASE…END)로 묶었다.1hunk/+2B,37828→37830B. 비교값·분기값·정책·권한·주체·승인·감사guard와다른SQL은보존한다. 부모7EE0D5D3DF15101F2DB9C5EE0584712A78CD7D3B1CC6427F6AE64507CF31698D,최종E7CD07F130DF9FB458E7D4690154543DC740ABD6D96C6295CE516B2F632DE9C3.

Primary9935d5/a208a9은정확before1개·역치환부모raw동일, b6dc3a diffcheck0. Main73bed0은최종hash/+2B/정확after1개/역치환부모raw동일·diff/검사0을독립확인했다. 구현기대문자열을복제하는시험은추가하지않았다. 기존Node시험은SQL설치를실행하지않으므로반복하지않았다. 실제PG구문GREEN·SQL105완료·함수/RLS/API/UI·IX01인수는미검증이다.

Primarywriter반환/live0,실제추가DB·권한·WSL·컨테이너·Agent·P03R3실행0. Main문서와본SQL1개만기록한다. rollback은정확1hunk를부모와대조해되돌릴수있다. 원R1/R2FAILED·감사·index·driver불변. 재검증용새실행계약은별도로작성하고소진된승인을재사용하지않는다.
