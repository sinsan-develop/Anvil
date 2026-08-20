# B-10 R2 WorkInstruction — unresolved usage admission accounting

- artifact_id: `WI-B-10-20260821-002`
- revision: `R2 / INDEPENDENT_TEST_REWORK`
- package/status: `B-10 / REWORK_IN_PROGRESS`
- executor: `developer-primary-b10`
- baseline_git_commit: `e9dd00983775a5b1b2849f6be35304e34ef4fa17`
- source_tester_report: `docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md`
- source_tester_report_sha256: `B1FDDE5244129A0E086E9F666A635955751A6D3A5A83DB582E23CC1EB90AEBBB`
- failure_fingerprint: `BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE`
- valid_failure_count: `1`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- assigned: `AV-SAFE-003, AV-SAFE-025, AV-STAT-030, AV-STAT-031, AV-STAT-032, AV-STAT-033, AV-STAT-037, AV-AGT-006`
- environment: `ENV-LOCAL plus unique isolated WSL PostgreSQL 18; shared DB/ysna/production/deployment forbidden`

## 판정 → 판단 이유 → 조치

**판정: R2 좁은 CRITICAL 결함 보완.** B-10은 합격이 아니며 `BLK-B10-IT-001`을 수정한 뒤 독립 재테스트가 필요하다. 기능 범위, 요구사항, 중요 위험은 바뀌지 않는다.

**판단 이유:** R1은 unknown final usage row의 forecast 값을 보존하지만 상태를 `RECONCILIATION_REQUIRED`로 바꾼 뒤 in-memory snapshot과 PostgreSQL admission 합계에서 제외한다. 그 결과 hard cost/token/concurrency 한도에 unresolved worst-case exposure가 남아 있는데도 새 Provider 요청이 전체 한도를 다시 예약할 수 있다.

**조치:** `RECONCILIATION_REQUIRED`를 authoritative final usage receipt 또는 명시적으로 governed adjustment가 확정할 때까지 active forecast exposure로 계산한다. in-memory와 PostgreSQL이 cost, token, concurrency를 동일하게 계산해야 하며 release/consume은 정확히 한 번만 반영한다.

## 수정 계약

1. in-memory snapshot은 `RESERVED`와 `RECONCILIATION_REQUIRED` 모두의 `reserved_cost`, `reserved_tokens`, active concurrency를 합산한다.
2. `anvil_budget_reserve()`의 잠금 안 admission query도 같은 두 상태를 worst-case exposure로 합산한다. unresolved `40/400`이 있는 hard limit `50/500`에서 새 `50/500` 예약은 거부되어야 한다.
3. authoritative final usage receipt가 들어오면 실제 usage를 한 번 consume하고 forecast remainder를 한 번 release한다. identical replay는 idempotent하고 changed replay는 거부한다.
4. unknown receipt replay, final receipt retry, reconcile/reserve 동시 실행에서도 double release, negative exposure, over-reservation이 없어야 한다.
5. Provider-before-send 계약을 유지한다. reservation 거부 요청은 Provider sender 호출 0건이어야 한다.
6. R1 intervention/pause/cancel 계약과 공개 API/schema compatibility를 유지한다. migration revision은 `0009_intervention_budget` 그대로 보완하며 새 revision을 만들지 않는다.
7. B-11 API/BFF/SSE/UI, B-12 recovery, provider adapter, dependency/config, shared DB, ysna, production, deployment는 시작하지 않는다.

## Developer exact file-level write allowlist (7)

- `packages/persistence/intervention_budget_repository.py`
- `migrations/versions/0009_intervention_budget.py`
- `tests/budget/test_atomic_reservation.py`
- `tests/budget/test_quota_reconcile.py`
- `docs/validation/B-10_INTERVENTION_BUDGET_VALIDATION.md`
- `docs/evidence/manifests/B-10_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-10_COMPLETION_REPORT.md`

이 7개는 모두 승인된 R1 exact15 안에 있다. 나머지 R1 제품 파일, authority, progress/HANDOFF, Tester report, checker, WorkInstruction/Invocation, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. report hash, `e9dd009` baseline, epoch-2 worker/write fencing token, exact7을 먼저 검증한다.
2. 다음 실패를 최소 회귀로 먼저 고정한다.
   - in-memory unknown usage 뒤 snapshot이 `40/400`, active `1`을 유지하고 두 번째 `50/500`을 거부한다.
   - PostgreSQL unknown 상태의 `40/400` row가 admission 합계에 남아 두 번째 `50/500`을 거부한다.
   - authoritative final receipt와 identical replay가 한 번만 consume/release한다.
   - concurrent reconcile/reserve에서도 hard cost/token/concurrency를 넘지 않는다.
3. RED 원인이 `BLK-B10-IT-001`임을 확인한 뒤 최소 수정하고 GREEN을 확인한다.
4. focused local, unique isolated PostgreSQL 18 DSN focused, canonical core, full tooling, four standalone checker를 실행한다.
5. EvidenceManifest는 exact7 중 manifest 자체를 제외한 raw6, target hash, self-reference false를 새로 고정한다. R1 manifest bytes를 보존한다고 주장하지 않는다.
6. CompletionReport와 validation에 정확한 명령, exit code, 실제 결과, 미실행 범위, rollback과 잔여 위험을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push/progress/HANDOFF는 수정하지 않는다.

B-10 acceptance와 B-11 시작은 금지하며 independent retest 전에는 완료로 승격하지 않는다.
