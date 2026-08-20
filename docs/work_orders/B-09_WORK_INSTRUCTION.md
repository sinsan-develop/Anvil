# B-09 WorkInstruction — Durable Queue, Worker/Write Fencing, and Path Identity

- artifact_id: `WI-B-09-20260820-005`
- revision: `R5 / MAIN_TAKEOVER_REWORK / DB_FENCING_RECOVERY_CONTRACT_GAP`
- package/status: `B-09 / ACTIVE`
- executor: `main-agent-eoul`
- baseline_git_commit: `7c3382a497e995e18c736a487eee8761aa0c1a05`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b08_acceptance_manifest_sha256: `6D98116937FC09DA1B51996A87315A33FDA6972C13B8F55F1D6048685CC754E4`
- assigned: `AV-STAT-026, AV-STAT-027, AV-STAT-043, AV-SAFE-028`
- predecessors: `B-06~B-08 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL only at start; WSL Anvil isolated PostgreSQL 18 only during later implementation validation`
- authority_rebind: `APPROVAL-20260814-WORKPLAN-V16-001 / 3DFC... successor binding`; Operating Rules §2의 A1032/982B/8038 표는 해당 human-approved successor 이전 역사 기준선이며, 실제 설계·v1.6 plan·v1.4 matrix·v1.5 test plan과 승인 binding이 우선한다. 기능·요구사항·중요 위험·Developer exact15는 변경하지 않는다.
- failure_revision: 동일 유효 `FAILURE_REPORT` lineage `B-09/DB_FENCING_RECOVERY_CONTRACT_GAP` 3회에 따른 AGENTS §6 R4 Main 직접 인수. TakeoverPacket `docs/work_orders/B-09_MAIN_TAKEOVER_PACKET_R4.md`에 따라 Developer exact15의 path·bytes를 동결하고 epoch-3 lease 회수 후 Main epoch-4 lease로 순차 인수한다. 기능 범위·요구사항·중요 위험은 변경하지 않는다.
- r5_rework_revision: 독립 Tester report `docs/test_reports/B-09_INDEPENDENT_TEST_REPORT.md`의 `FAILURE_REPORT / REWORK_REQUIRED`, CRITICAL `BLK-B09-IT-001/002`를 같은 lineage의 네 번째 유효 실패로 수용한다. R4 Main takeover를 유지하고 완료 projection의 lease-null 상태에서 Main epoch-5 worker→write lease를 새로 발급한다. 제품 exact15, 기능 범위, 요구사항, 중요 위험은 변경하지 않는다.

## 목적과 완료 조건

PostgreSQL durable queue의 at-least-once claim, DB UTC 기반 worker/write lease epoch·fencing, poison quarantine, 그리고 Windows/WSL/Docker path alias를 하나의 conflict scope로 정규화하는 B-09 Foundation 1 범위를 구현한다. 정확히 한 번 실행을 주장하지 않고 idempotency·receipt·fencing으로 중복 부작용을 차단한다.

## 구현 계약

- claim은 DB transaction의 조건부 update 또는 동등한 `FOR UPDATE SKIP LOCKED` 원자 연산이어야 하며 visibility timeout, retry backoff, max attempts, next execution time을 영속화한다.
- 매 claim은 증가 `lease_epoch`와 예측 불가능한 `execution_fencing_token`을 발급한다. heartbeat, renewal, state, Tool receipt, Step/Event/filesystem commit은 현재 execution token을 요구한다.
- 제품 파일 mutation은 종속 write lease의 증가 `write_epoch`와 `write_fencing_token`도 요구한다. Worker B 인수 후 Worker A의 늦은 Step·Tool·Event·filesystem commit은 `STALE_FENCING_TOKEN`으로 거부한다.
- heartbeat 만료 Worker는 재개 전에 orphan lease를 탐지·안전 회수한다. FI-04 Worker heartbeat 중단을 같은 fingerprint별 최소 3회 반복해 AV-STAT-026/027을 증명한다.
- poison job은 max attempt 후 무한 재시도하지 않고 quarantine/DLQ로 이동하며 상태와 근거를 읽기 모델에 남긴다.
- R5에서 만료된 `CLAIMED` job이 이미 `attempts >= max_attempts`이면 `PENDING`으로 되돌리지 않고 DB와 reference service 모두 원자적으로 quarantine한다. 해당 poison head가 다른 ready job의 claim forward progress를 막지 않는 hostile 회귀를 추가한다.
- `conflict_scope_key=(repository_id, canonical_repo_relative_path, repository_case_policy)`만 write conflict 판정에 사용한다. Windows drive, `/mnt`, case, symlink, junction, 8.3 alias는 동일 resource로 정규화하고 이중 write lease를 거부한다.
- R5 path identity는 실제 filesystem identity를 안전하게 해석해 symlink/junction/8.3 alias를 canonical repository-relative identity로 수렴시키고 repository 밖 absolute path는 fail closed 한다. lexical alias test만으로 실제 alias 계약을 대체하지 않는다.
- migration은 queue, worker lease, write lease, quarantine와 필요한 uniqueness/FK/check constraints를 만든다. B-06 Event Store, B-07 Artifact/Checkpoint, B-08 outbox/exporter는 read-only predecessor다.
- DB contract minimum: PostgreSQL 함수/trigger 또는 동등한 transactional SQL은 claim(`FOR UPDATE SKIP LOCKED`), DB UTC heartbeat renew, orphan recovery(epoch/token rotation), complete/fail stale execution fencing, product mutation write fencing, retry/max-attempts quarantine/DLQ, concurrent SKIP LOCKED, append/audit를 보장한다. stale execution/write는 SQLSTATE 또는 structured error `STALE_FENCING_TOKEN`으로 거부하고, downgrade는 생성한 모든 objects를 제거하며 DSN은 driver-prefix를 정규화한다.
- B-10 intervention/budget, B-11 API/BFF/SSE/UI, B-12 process/PC recovery orchestration, provider, ysna/shared-db/production/deploy는 구현하지 않는다.
- runtime 시작 경계는 API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment 전부 `NOT_EXECUTED`다. 실제 DB 검증은 이후 Anvil 전용 격리 WSL PostgreSQL 18에서만 허용하며 기존 DB/role/schema/data를 변경하지 않는다.

## Developer exact file-level write allowlist

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

그 밖의 authority, progress/HANDOFF, B-01~B-08 산출물, 기존 migration/source/test, dependency/config, 다른 package/app, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline·authority·B-08 acceptance, R4 completion의 lease-null 상태, Main epoch-5 worker→write fencing token과 동결 exact 15-path allowlist를 먼저 검증한다.
2. non-atomic claim, stale token, orphan recovery, poison retry, path alias double lease를 RED test로 고정한다.
3. 최소 구현 후 queue/lease/path focused tests와 기존 domain/design/planning/persistence/execution/events/artifacts/checkpoints/outbox/tooling 회귀를 실행한다.
4. FI-04는 동일 fingerprint별 최소 3회 실행한다. max-attempt expired orphan의 quarantine와 후속 ready job forward progress, worker heartbeat stop point, recovery Event, lease epoch/token을 raw evidence로 남긴다.
5. 실제 Windows junction/symlink와 가능한 8.3 alias, repository 밖 absolute path fail-closed hostile 회귀를 실행하고 생성한 임시 alias/path는 exact cleanup한다.
6. 격리 WSL PostgreSQL 18 검증은 구현 단계에서만 허용한다. 불가하면 `BLOCKED`/`NOT_EXECUTED`로 기록하며 시작 projection의 미실행 범위를 PASS로 승격하지 않는다.
7. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
8. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
9. 동일 `(step_lineage_id, failure_fingerprint)`의 증거 완비 `FAILURE_REPORT`만 유효 실패로 계산한다. 1회 보완, 2회 WorkInstruction revision, 3회 Developer lease/tool 회수와 Main sequential takeover 순서를 지킨다. `BLOCKED`, quota, 권한·환경, internal retry, tool interruption은 실패 횟수에 넣지 않는다.

B-09 acceptance, B-10 시작, intervention/budget, API/BFF/SSE/UI, process/PC recovery, provider, ysna/shared-db/production/deploy는 이 WorkInstruction 범위가 아니다.
