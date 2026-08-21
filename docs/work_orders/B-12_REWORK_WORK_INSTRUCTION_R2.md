# B-12 R2 WorkInstruction — durable PostgreSQL recovery와 실제 fault boundary 보완

- artifact_id: `WI-B-12-20260821-002`
- revision: `R2 / FAILURE_REPORT_1`
- package/status: `B-12 / ACTIVE_REWORK`
- executor: `developer-primary-b12`
- baseline_git_commit: `e29ffcfc6e401af43bdb2672fd0817252792d652`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- source_tester_report_sha256: `224CC87D40496A09765551A317413832039C4BDBA2B67C22AC37C6E05681AF91`
- failure_fingerprint: `B-12/DURABLE_PROCESS_RECOVERY_AND_ACTUAL_SEND_BOUNDARY_GAP`
- findings: `BLK-B12-001-FI07-DURABLE-RECOVERY-DISCONNECTED`, `BLK-B12-002-FI0506-NOT-ACTUAL-FAULT-INJECTION`
- assigned: `AV-STAT-014/034/035/036/038/039, AV-OPS-005, AV-SAFE-031, AV-FLOW-010/011`
- environment: `ENV-LOCAL plus unique isolated PostgreSQL 18 only; no shared DB/deployment`

## 판정 → 판단 이유 → 조치

- 판정: `REWORK_REQUIRED / CRITICAL / valid failure 1`.
- 판단 이유: R1은 PostgreSQL resume fencing과 분류 unit contract는 검증했지만, 종료된 worker가 실제 durable recovery 상태와 연결되지 않았고 FI-05/06도 실제 send boundary 중단과 persisted counter/receipt lookup을 수행하지 않았다.
- 조치: 기능 범위·요구사항·중요 위험을 변경하지 않고 R1 exact15 안의 최소 exact10만 다시 열어 durable PostgreSQL adapter와 실제 process/send-boundary fault harness를 구현한다. B-12 acceptance, B Gate, C-01은 금지한다.

## R2 구현 계약

1. `RecoveryRepository`의 실제 PostgreSQL adapter는 migration의 recovery tables와 Run/checkpoint/Action/Event lineage를 사용해 recovery input, reconcile decision, audit와 immutable resume receipt를 저장하고 새 프로세스에서 다시 load해야 한다.
2. worker subprocess가 동일 isolated PostgreSQL과 progress/HANDOFF sequence에 `RUNNING` 및 Action 경계 상태를 실제 기록한 후 강제 종료되어야 한다. 새 Python process와 새 repository instance는 reseed 없이 동일 run을 읽어 `RUNNING → INTERRUPTED`, 완료 Step skip, 중단 Step만 resume하고 exact replay가 idempotent임을 증명한다.
3. FI-07은 위 durable lineage로 최소 3회 수행한다. 종료 뒤 테스트 프로세스가 in-memory fixture를 새로 seed하거나 종료 대상과 무관한 `sleep` process를 증거로 사용하지 않는다.
4. FI-05는 provider send 직전 실제 worker termination을 최소 3회 수행하고 persisted provider send count `0`, safe retry와 automatic retry contract를 검증한다.
5. FI-06은 send 완료 후 response/receipt 처리 전 실제 termination을 최소 3회 수행한다. persisted send count, authoritative receipt lookup count, automatic retry count와 duplicate request count로 자동 재송신 `0`과 receipt 기반 수렴을 증명한다.
6. PostgreSQL 18에서 migration `0009→0010→0009`, hostile constraints, stale worker/write fencing, concurrency single receipt와 cleanup을 다시 검증한다. no-DSN unit suite는 honest SKIP을 유지한다.
7. Secret reference-only, capability snapshot drift, B-11 API/security, target/version pre-side-effect, same-origin 및 기존 recovery contracts를 보존한다.

## Developer exact file-level write allowlist (10)

- `packages/recovery/models.py`
- `packages/recovery/service.py`
- `packages/persistence/recovery_repository.py`
- `migrations/versions/0010_recovery.py`
- `tests/recovery/test_action_reconcile.py`
- `tests/recovery/test_process_resume.py`
- `docs/validation/B-12_RECOVERY_VALIDATION.md`
- `docs/evidence/manifests/B-12_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-12_COMPLETION_REPORT.md`
- `tests/recovery/test_recovery_api.py`

위 exact10은 모두 승인된 R1 exact15 안에 있다. 나머지 R1 제품, authority, progress/HANDOFF, failure ledger, Tester report, checker, WorkInstruction/Invocation, Git index/refs는 Developer 수정 금지다.

## TDD·검증·보고

1. report/WI hash, epoch-2 execution/write token과 exact10을 확인한다.
2. durable adapter 부재, process-linked FI-07 부재, actual FI-05/06 부재를 각각 RED로 먼저 고정한다.
3. 최소 구현 후 local focused, actual isolated PostgreSQL 18 focused, canonical core, tooling, combined, compile/import, raw/exact/self-reference/diff와 standalone checkers를 실행한다.
4. EvidenceManifest는 exact10 중 manifest 자체를 제외한 raw9 target과 `self_reference=false`를 고정한다. 실제 subprocess PID/exit, DB lineage, send/retry/receipt/duplicate counters, migration/rollback/cleanup을 validation과 completion report에 기록한다.
5. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push/progress/HANDOFF는 수정하지 않는다.

B-12 acceptance, Phase B Gate와 C-01 시작은 R2 독립 재검증 전까지 금지한다.
