# F-18 R41 OIDC PG18 integration QA checkpoint close plan

> Main control-only stage. 제품 SHA `629858cfe1a4d17767cf484432be910e5c5282c7`의 WSL-server 동일 SHA scoped QA 59 PASS와 로컬 관련 회귀 456 PASS 뒤 보고서 전용 commit을 게시한 다음 실행한다.

**Goal:** R41 epoch25 write lease를 먼저, worker lease를 다음에 회수하고 F-18 `accepted=false` 기준선과 다음 안전 조치를 유지한다.

**Scope:** control overlay/checker/test, R41 close digest/manifest, progress/events/HANDOFF, WORK_STATUS. 제품 exact5 재변경 금지. 신규 branch·PR·main 병합·Production 금지.

## TDD·검증

1. 종료 overlay의 모듈 부재 RED 테스트를 먼저 실행한다. 이어서 제품 SHA, 서로 다른 fence, seq1637/1638 회수 순서와 lease 재도입 거부를 검증한다.
2. control 준비 파일을 동일 branch에 commit/push한다. START projection에는 새 close 경로가 없어 이 준비 commit의 G-05 실패는 예상 전환 상태이며 PASS로 표시하지 않는다.
3. 보고서-only commit, WSL 결과, 잔류0, clean 원격 HEAD에서 종료 projection을 materialize한다. seq1637 `WRITE_LEASE_REVOKED`→1638 `WORKER_LEASE_REVOKED`, actor Main, 두 lease null을 확인한다.
4. 종료 manifest/digest와 control test/G-05를 확인해 checkpoint commit/push한다. 다음 안전 조치는 `PREPARE_F18_OIDC_FORMAL_HOST_STAGE`다. 정식 Compose·브라우저·Production과 bare 전체 pytest의 기존 13 collection ERROR는 미검증/non-green으로 남긴다.

Rollback은 종료 control commit의 정상 revert 후 원격 checkpoint와 lease 상태를 재확인하는 것이며 이전 lease token의 제품 write는 허용하지 않는다.
