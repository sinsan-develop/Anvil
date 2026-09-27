# F-18 R45A WSL-server Test/Staging artifact 보고서

## 시작 판정

`NOT_STARTED`. R44 checkpoint `dfdbdcb95be53ff15bec7224864f759982e83525`, canonical seq1669, lease=null, G-05 PASS. R45A는 현재 Git revision의 Web/API/Worker 세 digest와 PG15 일반·pgvector-PG18 RC·signed manifest를 WSL-server 전용 자원에서 실측한다. R43D runtime 결과는 이전 SHA의 역사적 증거다.

## 사전 자원·보존 경계

전용 checkout `/home/daon/anvil-f18-r45a-staging`, material `/home/daon/anvil-f18-r45a-material`, Compose `anvil-f18-r45a`, loopback `127.0.0.1:8454`만 계획했다. 공유 `anvil-web`/`local-postgres`/기타 project와 cached pgvector image는 보존한다. 생성·tag·image build·DB/브라우저/Secret 자원은 아직 0이다. 실제 시작 전 inventory 및 정확한 resource ID를 추가한다.

## 결과·미검증

실측 전. F-18 accepted=false, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`.
