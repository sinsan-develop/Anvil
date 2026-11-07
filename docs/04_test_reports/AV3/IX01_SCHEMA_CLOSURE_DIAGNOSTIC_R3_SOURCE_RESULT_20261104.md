# IX01 R3 소스 준비 검수

2026-11-04 · SOURCE_VERIFIED / ACTUAL_R3_NOT_RUN

SQL기준0a647daa66103ada3bd5e949b64f407c3e7b5687의105정의를새r3이름에결박했다. driver는기준SHA/자원namespace/index경로변경뿐이며Main23278c는이를역치환해원R2driver와완전동일함을확인했다. 기한/installer권한/회수/UNKNOWN·보안감사기준불변. 원R1/R2index/실패/감사보존.

| source | SHA256 |
|---|---|
|driver|12459df3203ed856021a5341fd0472894ee7dff8716898eba7c6c47629c7864e|
|unit|bf64ec5496141c87122fb39dc3a52b9eac2a210e0b38dc128e7d87c590859dfe|
|index|d6b4b8abb1e070cfc70f1f6fe79034dae22d3fd0b3cd9982c73417d29e88a4da|

Main23278c:106개Gitblob해시/크기모두일치,선택105/2376139B/order09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef. Primaryab9be4 39PASS/395.4085ms,983f7f noEmit0,cd268c Bash-n0,c6b1af diff0. Main최종f2070c 39PASS/405.6222ms/skip0/exit0. 최초bf2206 38P1F는GitBash자식시작3221225794(stdout/stderr빈값)의sandbox환경실패이며동일코드일반환경검사로분리했다. f03dae의Main검수기count실패는주석2행+표머리1행을2행으로오독한도구오류로보존하고23278c에서정확형식으로검산했다. 시험/제품/기대값완화0.

중간R3(dc067SQL) source3와278469 39PASS는과거증거이며최종결과로대체하지않고현황에남긴다. Primarywriter반환/live0. 실제PG/role/권한/WSL/원장/키/서비스/Agent/P03R3실행0. 실제SQL105설치·RLS/API/UI/IX01/전체계획인수는미완료다. rollback은새source3만부모와대조하며원장/SQL보정/보호3을되돌리지않는다.
