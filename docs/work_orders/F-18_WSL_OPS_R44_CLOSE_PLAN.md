# F-18 R44 writer 회수 계획

- 기준: `codex/f18-wsl-ops` 제품 SHA `4e3ba7039894d182fe387420bf978d89f4faf24c`, canonical seq1667, epoch32의 worker/write lease ACTIVE. 지정 원격 SHA와 clean checkout, G-05 PASS 확인 후 진행한다.
- Developer exact3의 RED 1 FAIL(의도한 `MANIFEST_MIGRATION_INVALID`)→F-16 42 PASS→F-16/F-17/F-18 배포 회귀 253 PASS를 Main이 검토했다. Main 독립 F-16 42 PASS, `git diff HEAD^ HEAD --check` PASS다. 로컬 계약에 한정하며 F-18 인수는 아니다.
- 이 문서·종료 overlay·검증 테스트·checker dispatch·WORK_STATUS를 먼저 control QA commit으로 지정 원격에 게시한다. clean 원격 SHA에서만 seq1668 `WRITE_LEASE_REVOKED` → seq1669 `WORKER_LEASE_REVOKED`를 append한다. 두 lease를 null, 제품 write scope를 빈 배열로 결박하고 G-05 PASS와 원격 SHA를 확인한다.
- 다음은 Main 소유의 별도 WSL-server 격리 QA 계획과 worker lease다. `0019` 실제 서명 manifest, 동일 SHA/digest Test/Staging→격리 대상, pgvector PG18, OIDC 부정·브라우저 사용자 흐름, backup/restore/rollback은 아직 미검증이다. WSL-server 전용 자원은 생성 전 경로·owner·수명·정리를 기록한다. local WSL 및 ysna-server/Production은 범위 밖이다.
- F-18 `accepted=false`, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`; 새 branch/PR/main 병합은 하지 않는다. R44 제품 rollback은 exact3 commit의 정상 revert이며 현시점에는 수행하지 않는다.
