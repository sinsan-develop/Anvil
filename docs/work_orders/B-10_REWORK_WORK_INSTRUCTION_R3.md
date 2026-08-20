# B-10 R3 WorkInstruction — immutable reservation-level finalization

- artifact_id: `WI-B-10-20260821-003`
- revision: `R3 / SECOND_INDEPENDENT_RETEST_REWORK`
- package/status: `B-10 / REWORK_IN_PROGRESS`
- executor: `developer-primary-b10`
- baseline_git_commit: `5f644f45835329ef0195dae948d3c55ba7ff15af`
- source_tester_report: `docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md`
- source_tester_report_sha256: `23865D1722B231F04C7087328874A41D19431E5EE28C90AC71A3FACDA9D4F854`
- failure_fingerprint: `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`
- valid_failure_count: `2`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- assigned: `AV-SAFE-003, AV-SAFE-025, AV-STAT-030, AV-STAT-031, AV-STAT-032, AV-STAT-033, AV-STAT-037, AV-AGT-006`
- environment: `ENV-LOCAL plus unique isolated WSL PostgreSQL 18; shared DB/ysna/production/deployment forbidden`

## 판정 → 판단 이유 → 조치

**판정: R3 좁은 CRITICAL 결함 보완.** 동일 계보의 두 번째 유효 실패이며 takeover 조건에는 아직 도달하지 않았다. 기능 범위, 요구사항, 중요 위험은 바뀌지 않는다.

**판단 이유:** R2는 unresolved exposure를 보존했지만 reservation이 `CONSUMED`에 도달한 뒤 다른 `usage_receipt_id`가 동일 reservation의 authoritative final actual/release를 덮어쓸 수 있다. 이로 인해 이미 확정된 usage가 축소되고 새 reservation이 hard cost/token 한도를 초과해 승인될 수 있다.

**조치:** authoritative finalization identity를 reservation 단위로 한 번만 원자 확정한다. canonical final identity에는 reservation/request/usage receipt ID, payload/hash, actual cost/tokens와 release cost/tokens가 모두 포함된다. 이후 exact canonical replay만 기존 canonical receipt를 상태 변경 없이 반환하고, receipt ID를 포함한 어느 필드라도 다르면 fail closed한다.

## 수정 계약

1. reservation이 authoritative final 또는 `CONSUMED`에 도달하면 final identity와 actual/release 값은 불변이다.
2. 같은 reservation의 exact canonical final replay는 동일 canonical result를 반환하며 state, snapshot, release count를 바꾸지 않는다.
3. 다른 `usage_receipt_id`, payload/hash, actual cost/tokens 또는 release cost/tokens는 모두 거부한다. consumed row를 overwrite하거나 두 번 release하지 않는다.
4. PostgreSQL schema/constraint/function은 receipt-ID 유일성만이 아니라 reservation-level finalization identity를 원자적으로 강제한다. 서로 다른 receipt ID의 concurrent finalization에서 정확히 하나만 authoritative final이 될 수 있다.
5. in-memory repository와 PostgreSQL은 동일한 fail-closed 계약을 가진다. concurrent reconcile/reserve에서도 cost/token/concurrency hard limit, non-negative exposure와 Provider-before-send를 유지한다.
6. R2 unresolved worst-case exposure, R1 intervention/pause/cancel, 공개 API/schema compatibility를 유지한다. migration revision은 `0009_intervention_budget`를 보완하며 새 revision을 만들지 않는다.
7. B-11 API/BFF/SSE/UI, B-12 recovery, provider adapter, dependency/config, shared DB, ysna, production, deployment는 시작하지 않는다.

## Developer exact file-level write allowlist (7)

- `packages/persistence/intervention_budget_repository.py`
- `migrations/versions/0009_intervention_budget.py`
- `tests/budget/test_atomic_reservation.py`
- `tests/budget/test_quota_reconcile.py`
- `docs/validation/B-10_INTERVENTION_BUDGET_VALIDATION.md`
- `docs/evidence/manifests/B-10_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-10_COMPLETION_REPORT.md`

위 7개는 기존 B-10 exact15 안에 있다. 이외 제품·authority·progress/HANDOFF·Tester report·checker·WorkInstruction/Invocation·Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. report hash, `5f644f4` baseline, epoch-3 worker/write fencing token, exact7을 먼저 검증한다.
2. 최소 회귀를 제품 수정 전에 RED로 고정한다.
   - in-memory: first final 뒤 다른 receipt ID의 lower/equal/higher usage와 changed payload/hash/release가 모두 거부되고 snapshot이 불변이다.
   - idempotency: exact canonical replay는 canonical receipt equality와 단일 release를 유지한다.
   - concurrency: 서로 다른 receipt ID의 동시 finalization은 하나만 확정되고 loser는 거부되며 consumed state를 덮어쓰지 않는다.
   - PostgreSQL 18: reservation-level finalization identity와 concurrent distinct receipt ID를 schema/function이 원자 강제한다.
   - rejection 뒤 hard-limit admission은 첫 authoritative usage를 포함해 계산되며 over-reservation이 없다.
3. 각 RED가 `BLK-B10-IT-001`의 terminal-final overwrite 때문임을 확인하고 최소 구현만 수행해 GREEN으로 만든다.
4. focused local, unique isolated PostgreSQL 18 DSN focused, canonical core, full tooling, four standalone checker를 실행한다.
5. EvidenceManifest는 exact7 중 manifest 자체를 제외한 raw6, target hash, self-reference false를 새로 고정한다.
6. CompletionReport와 validation에 정확한 명령, exit code, 결과, 미실행 범위, rollback과 잔여 위험을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push/progress/HANDOFF는 수정하지 않는다.

B-10 acceptance와 B-11 시작은 금지하며 independent R3 retest 전에는 완료로 승격하지 않는다.
