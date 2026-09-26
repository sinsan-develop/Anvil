# F-18 R43A OIDC 정적 host checkpoint 종료

- 제품 결선 SHA `c787f7817284fa99f5e91b2654ac200789f523de`, Developer WSL config 보고서-only SHA `a8e12e69a80497ab48267f6ec8aa172d2f6d61a3`. Main 독립 리뷰 Critical/Important 0, 로컬 관련 117 PASS, WSL-server clean detached 제품 SHA의 실제 Compose config/정규화 assertion PASS, 전용 checkout 잔여 0에 한정한다.
- R43A는 WSL 정적·Compose 정규화 결선만 통과했다. 실제 image ID/digest, TLS `nginx -t`, OIDC issuer/code exchange, PG18, 브라우저, Secret/cert 파일 권한은 R43B 후속이며 F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED다.
- 동일 epoch27의 write lease를 먼저, worker lease를 다음으로 회수한다. R43A 제품 write scope를 비우고 Main 소유로 돌린다. 종료 이벤트는 seq1647~1648, 기존 seq1~1646 원문 보존. R43B 신규 lease는 다음 별도 WorkInstruction/control gate 뒤에만 발급한다.
- Main은 현재 WORK_STATUS의 QA 자원 생성·정리, 첫 실제 Compose 오류와 보정, QA assertion 오류와 해소를 보존한다. 종료 control exact 파일만 commit/push 후 clean 원격 HEAD에서 materialize하고 G-05를 확인한다. 이전 R43A start manifest나 event를 소급 변경하지 않는다.
