# C-21/LR-02C 운영 실행 작업현황

- 단계: backup portability rework 구현·독립 검증 완료
- 담당 agent: `developer-primary-c21-backup` (구현), `main-agent-eoul` (조정), `backup-portability-review` (독립 검토)
- 상태: `ACTIVE / BACKUP_PORTABILITY_REWORK_VERIFIED_PENDING_CHECKPOINT`
- release commit: `f39471a103d35406c3744fd727119072994a0d6a`
- worker/write lease: epoch 4 active, 완료 projection에서 회수 예정
- 외부 side effect: Git fetch와 versioned backup script 임시 추출만 실행; DB dump·Git checkout·Docker·HTTP·Telegram·Provider는 `NOT_EXECUTED`
- 오류 횟수: projection 회귀 보정 1회 (`PRG_REFERENCED_HASH_MISMATCH` 1 lineage, 재결박 후 해소); 원격 wrapper 인용 오류 2회; 정식 운영 실패 1회 (`C21_BACKUP_HOST_PG_DUMP_UNAVAILABLE`)
- 미검증: ysna deploy, production DB backup/migration, UI/API/health, authenticated SSE/Last-Event-ID; Telegram signed POST와 9 Provider probe는 신산님 검증 대기
- 다음 조치: exact2 구현 checkpoint를 commit·push하고 release binding을 갱신한 뒤, Git 기반 backup/deploy/verify를 다시 시작한다.
- C-01: `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`
- Telegram signed POST 및 9 Provider probe: 신산님 직접 검증 범위로 변경, repository/runtime 실행에서는 `USER_VERIFICATION_PENDING`

## 안전 경계

- 기존 `INCIDENT_HOLD` 발견 시 외부 호출 전에 중단한다.
- Telegram 불확실 결과는 재시도하지 않는다.
- NPM·DNS·secret 정책은 변경하지 않는다.
- 이전 evidence는 덮어쓰지 않는다.

## 준비 projection 검증

- `python scripts/check_project_progress.py`: PASS, sequence 457, `AUTO_CONTINUE`
- 집중 회귀: 215 passed, 1 warning
- `git diff --check`: PASS
- 독립 read-only 검토: PASS; exact14 allowlist와 현재 required 11-path subset 일치
- 회귀 중 발견한 historical reconstruction 4건과 후속 hash mismatch 3건은 동일 준비 projection 안에서 보정했으며, 운영 외부 side effect는 아직 실행하지 않았다.

## 운영 실행 시도 1

- `INCIDENT_HOLD`: ABSENT
- 배포 루트: `/home/ubuntu/deploy/anvil`
- 시작 runtime: `8ba679e72f53e20561e2063f3cdf01c10981a67b`, `anvil-web` healthy, listener `3770/tcp`
- `origin/main`: `517fb4c`까지 fetch 확인
- backup 결과: FAIL before dump, `pg_dump: command not found`
- 영향: backup 파일/receipt 미생성, DB·migration·runtime·public API·Telegram·Provider 미변경
- 잔여 임시물: 없음 (`/home/ubuntu/deploy/anvil/runtime/backup-c21-f39471a.sh` 제거 확인)

## Backup portability rework 결과

- 변경 파일: `deploy/ysna/backup-c21-db.sh`, `tests/deploy/test_c21_lr02c_operational_contract.py`
- 호스트에 `pg_dump`와 `pg_restore`가 모두 있으면 기존 host 경로를 사용한다.
- 둘 중 하나라도 없으면 실행 중인 정확한 `shared-db`의 PostgreSQL 도구를 사용해 dump stdout을 host temp로 스트리밍하고, host dump를 stdin으로 `pg_restore --list` 검증한다.
- DSN은 container argv·로그·receipt에 노출하지 않으며, host dump 실패 후 container fallback은 수행하지 않는다.
- developer 검증: focused pytest 15 PASS, `bash -n` PASS, exact2 `git diff --check` PASS.
- main 독립 재실행: focused pytest 15 PASS, `bash -n` PASS, exact2 `git diff --check` PASS.
- read-only reviewer: PASS, blocking finding 0; 초기 테스트 보완 권고 2건(컨테이너 도구 각각 부재, 0600·listing·receipt 무결성)은 반영 후 종료.
- 오류 기록: Python PATH 부재 1회, sandbox temp ACL 1회, Windows CP949 decode 1회는 실행환경 문제로 제품 정식 실패에 포함하지 않는다. 동일 제품 실패 추가 발생 없음.
- 외부 실행: SSH·Docker 실환경·DB·HTTP·Telegram·Provider·배포·commit·push `NOT_EXECUTED`.
