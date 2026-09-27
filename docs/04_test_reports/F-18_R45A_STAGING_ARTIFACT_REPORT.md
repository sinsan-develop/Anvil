# F-18 R45A WSL-server Test/Staging artifact 보고서

## 시작 판정

`NOT_STARTED`. R44 checkpoint `dfdbdcb95be53ff15bec7224864f759982e83525`, canonical seq1669, lease=null, G-05 PASS. R45A는 현재 Git revision의 Web/API/Worker 세 digest와 PG15 일반·pgvector-PG18 RC·signed manifest를 WSL-server 전용 자원에서 실측한다. R43D runtime 결과는 이전 SHA의 역사적 증거다.

## 사전 자원·보존 경계

전용 checkout `/home/daon/anvil-f18-r45a-staging`, material `/home/daon/anvil-f18-r45a-material`, Compose `anvil-f18-r45a`. 공유 `anvil-web`/`local-postgres`/기타 project와 cached pgvector image는 보존한다. epoch33 사전 inventory는 checkout/material 부재, project container/network/volume 0, 8454 free, 공유 Web ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running/healthy와 PG ID `99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c` running, pgvector-PG18 cache ID `sha256:5a9c2dbe6ab521f35e87c81124aa5137678992ddabb9c11ef46e04e5172af73c`였다. 첫 inventory 명령은 `local-postgres`에 Health map이 없는 것을 Docker template이 참조해 exit1; Health 없는 컨테이너의 Status만 읽도록 관측 명령을 한 곳 수정해 재실행 exit0/`R45A_COLLISION_FREE`. 제품/자원 실패가 아닌 Main QA 명령 오류 1회다.

QA tag `f18-wsl-r45a-qa` annotated object `973ac0ba719b076e91b279222abb6a48bc93960e`, peeled source SHA `d36de847842804ca93e405abe9bff687c1162a69`을 지정 원격에 게시·재확인했다. WSL-server `/home/daon/anvil-f18-r45a-staging`은 승인 SSH remote에서 exact tag로 clean detached 생성, owner `daon`, HEAD exact 확인; F-16 `verify_exact_checkout` 실제 호출 `F16_EXACT_CHECKOUT_PASS`/exit0. material·container·DB·Secret·브라우저는 생성0이다. PostgreSQL 15, MinIO, pgvector-PG18 cached image는 읽기 전용 ID만 관측했다.

실행 전 Compose source audit에서 최초 계획의 `8454`가 `compose.f18.oidc.yml`·Nginx·QA issuer의 고정 `8444`와 충돌함을 확인했다. Main 계획 오류 1회이며 임의 포트 우회나 서버 직접 patch 없이 내부 구현 방법을 8444로 비의미 수정하고 epoch33 worker를 회수→epoch34 새 WI hash/lease로 재결박한다. 위 Git checkout/tag는 exact 검증 후 같은 검증에 재사용한다. epoch34 G-05 PASS 전 image/DB/Secret/Compose 생성 금지. tag는 불변 검증 이력으로 보존한다.

## 결과·미검증

실측 전. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`.
