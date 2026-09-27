# F-18 R29 network writer 종료 계획

- R29 제품 exact3 commit `07b9cdbc6e699c8ba5efca1df25ea63c8d605463` 및 보완 commit `a9550612084aa0b85c75e2c49844ba0367701d5a`는 같은 승인 branch에 게시됐고 독립 review에서 로컬 정적 계약 `Spec PASS/quality Approved`다.
- Main의 WSL-server 전용 clean detached `a955061` source 및 세 OCI image 동일 revision에서 PG18 migration/readiness·제품 Web→API/Worker→API HTTP·내부망/host port/capability·외부 direct socket 거부가 bounded PASS였고 정확한 QA 자원 잔류0을 기록했다. 이는 F-18 전체 accepted 판정이 아니다.
- canonical R29 epoch13 writer lease 두 개를 `WRITE_LEASE_REVOKED`→`WORKER_LEASE_REVOKED` 순서로 회수한다. 제품 파일 추가 변경, 새 branch, F-19 착수, Production·ysna 작업은 없다. `F-18 accepted=false`, F-19 차단, Production NOT_EXECUTED를 유지한다.
- control QA commit을 기준으로 revocation event·snapshot·handoff·detached digest·manifest를 투영하고 G-05 및 로컬/원격 HEAD 일치를 확인한다. 이후에야 다른 exact-path 제품 lease를 발행한다.
