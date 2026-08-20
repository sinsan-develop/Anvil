# B-10 WorkInstruction — Human Intervention, Atomic Budget, Quota, and Cancel

- artifact_id: `WI-B-10-20260820-001`
- revision: `R1 / INITIAL`
- package/status: `B-10 / ACTIVE`
- executor: `developer-primary-b10`
- baseline_git_commit: `ac371f5743dce0fa87b3ee3b767d63c9c6102cd8`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b09_acceptance_manifest_sha256: `AB4676DA7706B2351C30690C81592CDDDB6F2CD450A85BC532F9A19385B17672`
- assigned: `AV-SAFE-003, AV-SAFE-025, AV-STAT-030, AV-STAT-031, AV-STAT-032, AV-STAT-033, AV-STAT-037, AV-AGT-006`
- predecessors: `B-09 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL framework-neutral implementation; isolated WSL Anvil PostgreSQL 18 only for later DB validation`

## 목적과 완료 조건

사용자 입력을 최우선 Event로 수용하는 `HumanInterventionReceipt`, 안전 pause/resume, Provider 호출 전 원자 budget reservation, quota pause, usage reconcile, 7단계 cancel과 immutable `CANCELLED`/새 Run 계약을 Foundation 공통 모듈로 구현한다.

## 구현 계약

- 사용자 메시지는 `QUERY_PROGRESS | CONTEXT_SUPPLEMENT | PRIORITY_CHANGE | PLAN_CHANGE | STOP | CANCEL | TAKEOVER`로 분류한다. 둘 이상이 합리적이면 실행하지 않고 `WAITING_DECISION`으로 둔다.
- Receipt는 `requested_at`, `acknowledged_at`, `new_action_blocked_at`, `effective_at`, `target_action_status`, `irreversible_receipt_ref`를 분리하며 요청 접수와 실제 효력을 같은 시각·상태로 가장하지 않는다.
- STOP은 새 Action 예약을 즉시 차단하고 safe point·비가역 receipt를 확인한다. 사람 입력은 일반 queue보다 우선한다.
- cancel은 `CANCEL_REQUESTED Event → 새 Action 중지 → 정상 종료 신호 → 위험도 확인 후 강제 종료 → artifact 수집 → workspace 24시간 보존 → CANCELLED` 순서를 강제한다.
- `CANCELLED`는 immutable terminal이다. 계속 작업은 `prior_run_id`와 재사용 가능한 checkpoint/artifact를 참조하는 새 Run으로만 가능하다.
- 같은 Run의 resume은 `PAUSED_USER | PAUSED_QUOTA | INTERRUPTED`만 허용한다. 계획·baseline·정책 hash/version 변경 시 기존 binding을 무효화하고 승인 또는 Main 비의미 재확정 전 재개를 거부한다.
- Provider 호출 전 forecast maximum을 DB에서 원자 예약한다. 예약 실패 시 Provider request는 0건이어야 한다.
- final usage receipt로 실제 사용량을 consume하고 remainder를 release한다. request ID, abort status, final usage, retry-after, rate bucket, provenance를 보존하며 불명확한 usage는 `USAGE_RECONCILIATION_REQUIRED`다.
- quota 도달 전 신규 Agent/Action을 차단하고 checkpoint를 요구하며 도달 시 `PAUSED_QUOTA`, 미완료 Step, reset 예상, 다음 안전 Action을 기록한다. privacy/cost class가 다른 provider로 자동 전환하지 않는다.
- B-09 queue/lease/event/checkpoint/outbox는 read-only predecessor다. B-11 API/BFF/SSE/UI, B-12 PC/process recovery, provider adapter, deploy는 구현하지 않는다.
- 시작 projection에서 API/DB/UI/browser/provider/WSL/ysna/shared-db/production/deployment는 모두 `NOT_EXECUTED`다.

## Developer exact file-level write allowlist

- `packages/interventions/__init__.py`
- `packages/interventions/models.py`
- `packages/interventions/service.py`
- `packages/budget/__init__.py`
- `packages/budget/models.py`
- `packages/budget/service.py`
- `packages/persistence/intervention_budget_repository.py`
- `migrations/versions/0009_intervention_budget.py`
- `tests/interventions/test_human_intervention.py`
- `tests/interventions/test_pause_cancel_resume.py`
- `tests/budget/test_atomic_reservation.py`
- `tests/budget/test_quota_reconcile.py`
- `docs/validation/B-10_INTERVENTION_BUDGET_VALIDATION.md`
- `docs/evidence/manifests/B-10_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-10_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-09 산출물, 기존 migration/source/test, dependency/config, API/UI/provider/deployment, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline/authority/B-09 acceptance와 epoch-1 worker→write token 및 exact15를 먼저 검증한다.
2. ambiguous intervention, STOP 이후 새 Action, 취소 7단계/terminal, invalid resume, stale approval resume, concurrent over-reservation, quota checkpoint, abort/usage reconcile을 RED로 고정한다.
3. 최소 구현 후 intervention/budget focused, 기존 core와 tooling 회귀를 실행한다.
4. hard-limit 직전 동시 예약에서 성공 합계가 remaining을 넘지 않고 실패 요청의 Provider 송신이 0건임을 반복 검증한다.
5. EvidenceManifest는 exact15, raw checksum, target hash, self-reference false를 고정한다.
6. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
7. 같은 `(step_lineage_id, failure_fingerprint)`의 증거 완비 `FAILURE_REPORT`만 유효 실패다. 1회 보완, 2회 revision, 3회 lease/tool 회수와 Main 순차 인수를 적용하며 `BLOCKED`, quota, 권한·환경, internal retry는 횟수에서 제외한다.

B-10 acceptance, B-11 API/BFF/SSE/UI, B-12 recovery, provider, ysna/shared-db/production/deploy는 이 WorkInstruction 범위가 아니다.
