# F-18 R39 OIDC host configuration checkpoint close plan

> Main control-only stage. 제품 SHA `51f3964fae64f20907726f73c8c2fd83cce3fa5d`의 WSL-server 동일 SHA scoped QA 435 PASS와 독립 리뷰 C0/I0/M0 뒤 보고서 전용 commit을 지정 원격에 게시한 다음 실행한다.

**Goal:** R39 epoch23 write lease를 먼저, worker lease를 다음에 회수하고 F-18 `accepted=false` 기준선과 다음 안전 조치를 유지한다.

**Scope:** control overlay/checker/test, R39 close digest/manifest, progress/events/HANDOFF, WORK_STATUS. 제품 exact3 재변경 금지. 신규 branch·PR·main 병합·Production 금지.

## TDD·검증

1. 종료 overlay의 모듈 부재 RED 테스트를 먼저 실행한다. 후속 제어 테스트는 제품 SHA·두 서로 다른 fence·seq1627/1628 순서·유효하지 않은 lease 재도입을 검증한다.
2. 종료 준비 파일을 작성하고 독립 control test를 PASS시킨다. 준비 단계 dirty 상태의 start G-05 실패를 PASS로 왜곡하지 않는다.
3. 준비 control diff를 확인해 동일 branch에 commit/push한다. Start projection은 새 close 경로를 아직 허용하지 않으므로 준비 commit의 G-05는 `F18_LOCAL_START_GIT_INVALID`가 예상된다. 이는 PASS가 아니며 즉시 clean 원격 HEAD에서 close projection으로 전환한다.
4. 보고서-only commit과 WSL 결과·잔류0을 확인한 clean 원격 HEAD에서 `materialize`한다. seq1627 `WRITE_LEASE_REVOKED`→1628 `WORKER_LEASE_REVOKED`, `active_agent=main-agent-eoul`, 두 lease null, F-18 accepted=false/F-19 blocked/Production NOT_EXECUTED다.
5. 종료 manifest/digest와 control test/G-05를 확인해 checkpoint commit/push한다. 후속 안전 조치는 `PREPARE_F18_OIDC_HOST_ACTIVATION_STAGE`이며 실제 issuer·PG18·Web/browser·전체 pytest 13 collection ERROR는 미검증이다.

Rollback은 종료 control commit의 정상 revert 후 원격 checkpoint와 lease 상태를 재확인하는 것이며, 오래된 lease token으로 제품 write를 허용하지 않는다.
