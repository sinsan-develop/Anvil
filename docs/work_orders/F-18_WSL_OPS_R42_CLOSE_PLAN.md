# F-18 R42 OIDC process bootstrap QA checkpoint close plan

> Main control-only stage. 제품 SHA `f169c22969adeb54950b4f3bf81f810301adb806`의 WSL-server 동일 SHA scoped 92 PASS/2 Git Bash SKIP과 로컬 94 PASS, 보고서-only commit `10801aa155f5d7c226c970de1303710ec09b4d2b` 및 Main WORK_STATUS를 게시한 뒤 실행한다.

**Goal:** R42 epoch26 write lease를 먼저, worker lease를 다음에 회수하고 F-18 `accepted=false` 기준선과 formal Compose/TLS host 후속 안전 조치를 유지한다.

**Scope:** control overlay/checker/test, R42 close digest/manifest, progress/events/HANDOFF, WORK_STATUS. 제품 exact4 재변경 금지. 신규 branch·PR·main 병합·Production 금지.

## TDD·검증

1. 종료 overlay의 모듈 부재 RED 테스트를 먼저 실행한다. 이어서 제품 SHA, 구분된 fence, seq1642/1643 회수 순서와 lease 재도입 거부를 검증한다.
2. control 준비 파일을 기존 branch에 commit/push한다. START projection에는 새 close 경로가 없어 이 준비 commit의 G-05 실패는 예상 전환 상태이며 PASS로 표시하지 않는다.
3. 보고서-only commit, WSL 결과·잔류0, clean 원격 HEAD에서 종료 projection을 materialize한다. seq1642 `WRITE_LEASE_REVOKED`→1643 `WORKER_LEASE_REVOKED`, actor Main, 두 lease null을 확인한다.
4. 종료 manifest/digest·control test·G-05를 확인해 checkpoint commit/push한다. 다음 안전 조치는 `PREPARE_F18_OIDC_FORMAL_COMPOSE_STAGE`다. 정식 Compose/TLS·브라우저·PG18/실제 issuer와 bare 전체 pytest의 기존 13 collection ERROR는 미검증/non-green으로 남긴다.

Rollback은 종료 control commit의 정상 revert 후 원격 checkpoint와 lease 상태를 재확인하는 것이다. 이전 lease token으로 제품 write를 재개하지 않는다.
