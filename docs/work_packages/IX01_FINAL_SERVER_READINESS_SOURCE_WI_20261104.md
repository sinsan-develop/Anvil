# IX01 최종 서버 준비·역할 관측 진단 최소 소스 보완

2026-11-04 · Main 어울 · SOURCE_ONLY / 실제 실행 금지

R3 codefc59c4e8의단1회는ROLE_PRISTINE/UNKNOWN이며원문오류없어직접원인미확정. 남은QA의신호/삭제/DBexec/새role조회/재실행을금지하고정리만직접결정대기다. 이번작업은독립source2보완이며남은실QA에적용하지않는다.

## 근거·목표
Main681d5e는현재ready가socketpg_isready0만으로끝나고readRoles의모든실패가UNKNOWN으로합쳐지는것을확인했다. PG15공식 https://www.postgresql.org/docs/15/app-pg-isready.html 은잘못된db/user라도상태를얻을수있다고명시한다. 공식현재 https://raw.githubusercontent.com/docker-library/postgres/master/docker-entrypoint.sh 는임시socketserver→목표DB생성→임시stop→최종execpostgres경계다. 이현재source와고정cache이미지내부바이트의일치는아직미검증이며실제R3원인을단정하지않는다.

## 허용2경로·writer
- scripts/qa-ix01-schema-closure.sh (부모12459DF3203ED856021A5341FD0472894EE7DFF8716898EBA7C6C47629C7864E)
- tests/unit/IX01/schema-closure-controller.test.ts (부모BF64EC5496141C87122FB39DC3A52B9EAC2A210E0B38DC128E7D87C590859DFE)
기존Primary단일writer/Main동일source쓰기0. SQL/index/원R1R2R3원장·packet/보호3/Main문서보존.

## 최소 동작
1. 최종PID1 PostgreSQL로전환됐음을고정readonly관측으로확인하기전socketready를최종준비로받지않는다. 초기화중관측만기존40회/각관측상한·전체10분/cleanup60초여유안에서유한확인한다. 고정sleep추가/timeout확대·다음slot0. PID1확인은새합성QA의/proc/1/comm같은고정경로/고정command만허용하며명령/경로를입력으로받지않는다. exactfullID/기존daemon/image·parent검산유지. 알수없는관측/신원차이/timeout/응답유실은UNKNOWN이고자동재조회로덮지않는다. 초기임시server가pg_isready0이어도초기화단계로분리한다.
2. 최종server관측뒤목표DB/사용자의기존pristine역할읽기와strictmetadata검산을한번만수행한다. 이기존role질의가실제목표DB읽기접속근거이며pg_isready만으로DB접속완료라고하지않는다. 실패뒤재시도/role우회/reader선생성/관리자원SQL대신실행0.
3. 역할조회의timeout/명확조회거절/출력·metadata검산거절을기존결과키안의고정안전진단으로구분할수있다. 임의stderr/SQL/오류본문/DETAIL/Secret출력금지,defaultgenericUNKNOWN보존. 모든실패statusUNKNOWN/자동mutation·정리0은불변. 성공역할/CREATEROLE회수/소진O_EXCL/기한·보안기준변경0. 공개제품API/DB계약/사용자권한변경0인내부QA진단보완이다.

## TDD·검수
신규반례를먼저확인:임시ready0→final전환전bootstrap/SQL0,전환중stop→초기화,최종server+기존정확roles후에만bootstrap,불명/timeout/비정상comm/strictmetadata불일치뒤추가role조회·bootstrap·정리0. 실제builder/readonly관측parser와runtime호출선을pure시험으로연결해가짜포트통과만으로검수하지않는다. 실제Docker/OS/PG는시험하지않는다. 기존39·인접직접영향/타입/Bash-n/diffcheck를필요범위수행한다. 기준완화/시험삭제·정상흐름회귀금지. 결과제출은hash/diff/명령exit/실패이력/미검증을 한국어로기록하고writer반환한다.

원R3unknown직접원인/고정image프로세스실관측/새actual설치GREEN은NOT_RUN. 미래정확code·새resource·실행안과직접승인전새실QA생성/기존QA수정0.


## r2 — actual 공유 실행 경계 검수 보완
최초44PASS뒤Main C0/I2의출력trim/역할오류변환불일치를같은source2안에서보정했다. actualPorts.run을같은makeCommandRunner로연결해PID1만raw,역할만안전진단분류하고다른trim/DDLparse는유지한다. 실제run→docker→psql→역할/최종server표현식과최하단exec대역으로RED2→GREEN을검수한다. 추가실환경/SQL/index/권한계약변경0,부모실행승인을재사용하지않는다.
