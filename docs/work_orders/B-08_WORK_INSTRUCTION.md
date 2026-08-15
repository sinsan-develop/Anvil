# B-08 WorkInstruction — Transactional Progress Outbox and Atomic HANDOFF Export

- artifact_id: `WI-B-08-20260815-001`
- revision: `R1 / PLAN_ALIGNED_INITIAL`
- package/status: `B-08 / ACTIVE`
- executor: `developer-primary-b08`
- baseline_git_commit: `9913636f030aa248216f58e3251cfa181f491d9c`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b07_acceptance_manifest_sha256: `996EF6B8C16B24870D73214389AFBC1FCEDE1D6CDD238951B200C05B2C97DD94`
- assigned: `AV-STAT-009, AV-STAT-011, AV-STAT-012, AV-STAT-013`
- predecessors: `B-06~B-07 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL + ENV-WSL-STAGING isolated Anvil PostgreSQL only when implementation validation requires it`

## 목적과 완료 조건

Foundation 1의 상태 변경 Event와 Project/Run progress·HANDOFF export를 동일 sequence로 연결하는 transactional outbox, filesystem atomic writer, crash-safe exporter를 구현한다. 상태 변경과 outbox row는 한 DB transaction에서 commit되고, exporter는 같은 Event sequence의 JSON·Markdown 임시 파일을 완성·검증한 뒤 atomic replace하며, `ProgressSnapshot` 기록과 outbox ack가 끝나기 전에는 다음 phase·Step scheduling을 허용하지 않는다.

## 구현 계약

- framework-neutral `ProgressExportRequest`, `ProgressSnapshot`, outbox status/receipt와 repository port를 정의한다. owner는 Project 또는 Run만 허용하고 owner ID, Event sequence, payload hash, export URI, retry count와 timestamp를 정규화·검증한다.
- 동일 owner의 Event sequence는 단조 증가한다. 같은 idempotency key와 canonical payload의 재요청은 같은 receipt로 멱등 처리하고, 같은 ID/sequence의 다른 payload, sequence 후퇴·건너뜀, Project/Run 간 owner 혼합은 fail-closed 한다.
- 상태 Event와 outbox enqueue는 한 repository transaction 경계에서 성공하거나 함께 rollback되어야 한다. Event만 commit되거나 outbox만 생긴 상태를 정상으로 표시하지 않는다.
- exporter는 같은 sequence의 JSON progress와 Markdown HANDOFF를 모두 임시 파일에 기록하고 flush/fsync·checksum 검증을 완료한 후 같은 filesystem 안에서 `os.replace`에 해당하는 atomic replace로 교체한다. 임시 파일은 target sibling에 두고 path traversal, symlink/root 이탈, target alias 충돌을 거부한다.
- JSON과 Markdown은 동일 owner, Event sequence, status, last Event ID, next safe action과 payload hash를 나타내야 한다. 하나라도 불일치하면 snapshot이나 ack를 생성하지 않는다.
- 순서는 `DB commit → JSON/Markdown atomic replace → ProgressSnapshot 기록 → outbox ack`로 고정한다. ack 전에는 후속 scheduling guard가 `PROGRESS_EXPORT_PENDING`으로 차단한다.
- FI-01(DB commit 직후/replace 전), FI-02(replace 도중), FI-03(replace 후/ack 전)를 각 최소 3회 반복해 같은 outbox가 재처리되고 Event·sequence 유실·중복, 부분 파일, 잘못된 ack, 조기 scheduling이 0건임을 증명한다.
- replace 또는 snapshot/ack 실패는 이미 commit된 Event를 rollback했다고 표시하지 않고 `PROGRESS_PERSISTENCE_ERROR`로 중지한다. 재시도는 같은 outbox와 payload hash를 사용하며 이미 교체된 동일 파일은 검증 후 멱등 ack한다.
- migration은 `progress_snapshots`와 `progress_export_outbox`의 owner/sequence/hash/status/retry/export binding, 유일성·FK·check constraint 및 필요한 append/history guard를 구현한다. B-06 Event Store와 B-07 Artifact/Checkpoint/EvidenceManifest는 read-only predecessor이며 수정하지 않는다.
- B-09 durable queue·Worker/write lease scheduler, B-10 intervention/budget, B-11 API/BFF/SSE/UI, B-12 process/PC recovery orchestration은 구현하지 않는다.
- 실제 DB 검증은 local isolated PostgreSQL 또는 WSL의 Anvil 전용 격리 DB·container·network만 허용한다. 기존 DB/role/schema/data, ysna/shared-db/production을 변경하지 않는다.
- 제품 API/UI/browser/provider/ysna/shared-db/public production/deployment는 금지하며 미실행을 PASS로 승격하지 않는다.

## Developer exact file-level write allowlist

- `packages/outbox/__init__.py`
- `packages/outbox/models.py`
- `packages/outbox/service.py`
- `packages/progress/__init__.py`
- `packages/progress/models.py`
- `packages/progress/exporter.py`
- `packages/persistence/progress_outbox_repository.py`
- `migrations/versions/0007_progress_outbox.py`
- `tests/outbox/test_transactional_outbox.py`
- `tests/outbox/test_sequence_invariants.py`
- `tests/progress/test_progress_exporter.py`
- `tests/progress/test_crash_recovery.py`
- `docs/validation/B-08_PROGRESS_OUTBOX_VALIDATION.md`
- `docs/evidence/manifests/B-08_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-08_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-07 산출물, 기존 migration/source/test, dependency/config, 다른 package/app, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline·authority·B-06~B-07 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다.
2. Event/outbox 비원자 commit, sequence 후퇴·건너뜀·payload 충돌, owner 혼합, path/symlink 이탈, JSON/Markdown 불일치, 부분 replace, ack 전 scheduling을 먼저 RED test로 고정한다.
3. 최소 구현 후 outbox/progress focused tests와 기존 domain/design/planning/persistence/execution/events/artifacts/checkpoints/tooling 회귀를 실행한다.
4. DB constraint가 포함되므로 가능하면 WSL Anvil 전용 격리 PostgreSQL에서 revision `0007` upgrade/downgrade와 transaction/constraint를 실제 검증한다. 불가능하면 `BLOCKED`/`NOT_EXECUTED`로 기록한다.
5. FI-01/FI-02/FI-03은 각각 최소 3회 실행하고 crash point, 재처리 횟수, 최종 Event/file/snapshot/ack sequence와 조기 scheduling 0건을 raw evidence로 남긴다.
6. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
7. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
8. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-08 acceptance, B-09 시작, durable queue/scheduler/fencing, intervention/budget, FastAPI/BFF/SSE/UI, process/PC recovery orchestration, provider, ysna/shared-db/production/deploy는 이 WorkInstruction 범위가 아니다.
