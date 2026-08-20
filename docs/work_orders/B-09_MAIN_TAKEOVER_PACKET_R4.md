# B-09 Main Takeover Packet R4

- package: `B-09`
- actor: `main-agent-eoul`
- trigger: third valid failure for `DB_FENCING_RECOVERY_CONTRACT_GAP`
- baseline: `main = origin/main = 7c3382a497e995e18c736a487eee8761aa0c1a05`
- prior state: `seq295 / B-09 ACTIVE / Developer epoch-3 worker+write leases ACTIVE`
- takeover status: `MAIN_TAKEOVER / DIRECT_IMPLEMENTATION`

## 판정

동일 `(step_lineage_id=B-09, failure_fingerprint=DB_FENCING_RECOVERY_CONTRACT_GAP)`의 증거 완비 실패가 세 번째로 확정됐다. AGENTS §6 순서에 따라 Developer를 중지하고 epoch-3 write/worker lease를 회수한 뒤 Main epoch-4 worker/write lease로 순차 인수한다. 기능 범위, 요구사항, 중요 위험과 Developer exact15는 변경하지 않는다.

## 세 실패 증거

1. R1 `BLK-B09-R1-001`: DB fencing/recovery contract gap, valid failure 1.
2. R2 `BLK-B09-R2-001`: 같은 fingerprint 재현, valid failure 2.
3. R3 `BLK-B09-R3-001`: `reclaim_orphan`과 product-mutation write guard 미완성, valid failure 3.

공통 증거는 `docs/completion_reports/B-09_COMPLETION_REPORT.md`이며 세 항목 모두 제품 exact15 안의 동일 contract gap 계보다.

## 동결 제품 exact15

- `packages/queue/__init__.py`
- `packages/queue/models.py`
- `packages/queue/service.py`
- `packages/leases/__init__.py`
- `packages/leases/models.py`
- `packages/leases/service.py`
- `packages/paths/identity.py`
- `packages/persistence/queue_lease_repository.py`
- `migrations/versions/0008_queue_worker_leases.py`
- `tests/queue/test_durable_queue.py`
- `tests/leases/test_worker_write_fencing.py`
- `tests/paths/test_conflict_scope_identity.py`
- `docs/validation/B-09_QUEUE_LEASE_VALIDATION.md`
- `docs/evidence/manifests/B-09_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-09_COMPLETION_REPORT.md`

이 projection에서는 위 15개 파일의 bytes를 수정하지 않는다.

## Main 인수 후 남은 구현

- DB-backed `reclaim_orphan`이 DB UTC 만료를 원자적으로 판정하고 epoch/token을 회전하도록 완성한다.
- 모든 product mutation commit이 current execution token과 종속 write epoch/token을 함께 검증하도록 guard를 완성한다.
- stale execution/write token은 `STALE_FENCING_TOKEN`으로 fail closed 한다.
- 기존 claim, retry/quarantine, path identity, FI-04 증거는 exact15 범위에서 회귀 검증한다.

## 복구 및 경계

- rollback: seq296 이후 projection을 별도 후속 event로 폐기하고 epoch-4 lease를 회수한다. 과거 event와 failure ledger는 재작성하지 않는다.
- B-10, shared-db, ysna, production, deploy, API/BFF/SSE/UI는 시작하지 않는다.
- 실제 DB/API/UI/browser/WSL/production 검증을 이 projection에서 PASS로 기록하지 않는다.
