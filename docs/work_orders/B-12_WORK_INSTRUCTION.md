# B-12 WorkInstruction — Process/PC Recovery, Reconciliation, and Resume

- artifact_id: `WI-B-12-20260821-001`
- revision: `R1 / INITIAL`
- package/status: `B-12 / ACTIVE`
- executor: `developer-primary-b12`
- baseline_git_commit: `370a39436c4b15a84483017583a9fe3878652504`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b11_acceptance_manifest_sha256: `24DE9BF27412722A9D6E478A698688BBD75B0CE22AD60DA5CC420C5CA4B66395`
- assigned: `AV-STAT-014, AV-STAT-034, AV-STAT-035, AV-STAT-036, AV-STAT-038, AV-STAT-039, AV-OPS-005, AV-SAFE-031, AV-FLOW-010, AV-FLOW-011`
- predecessors: `B-08~B-11 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL + isolated WSL PostgreSQL 18 fault-injection validation; no shared DB, provider call, deployment, or real PC power-off`

## 목적과 완료 조건

process/PC 종료 뒤 DB Event, progress/HANDOFF, checkpoint, Action receipt, worker/write fencing, Secret version과 capability snapshot을 조정해 안전한 다음 행동을 공통 API로 복원한다. 완료 Step은 중복 실행하지 않고 미확정 부작용은 `confirmed_success | safe_retry | manual_review`로 분류하며 stale token, revoked Secret, capability drift는 재개 전에 차단한다.

## 구현 계약

- 새 Session은 DB Event sequence, progress/HANDOFF, checkpoint, Git/workspace와 외부 receipt를 읽어 동일 hash와 마지막 안전 지점 및 next action을 복원한다. 파일과 DB가 다르면 한쪽을 임의 덮어쓰지 않고 `RECONCILIATION_REQUIRED`로 fail-closed한다.
- `success` receipt가 있는 Step/Action은 건너뛰고 재실행 횟수 0을 보장한다. 중단 시 `RUNNING`은 `INTERRUPTED`로 조정하며 결과 미확정 Action은 `confirmed_success`, `safe_retry`, `manual_review` 중 정확히 하나로 분류한다.
- 외부 요청 송신 직전(FI-05)과 송신 후 응답 직전(FI-06)을 각각 최소 3회 재현한다. 송신 전은 증거가 있을 때만 safe retry, 송신 후는 authoritative receipt 조회 전 자동 재시도 금지이며 중복 요청 0건을 증명한다.
- process/PC 종료(FI-07)는 격리 subprocess/DB에서 최소 3회 수행한다. 실제 PC 전원 차단을 주장하지 않고 simulation evidence로 표시하며 완료 Step skip, 중단 Step만 안전 재개, DB/progress/HANDOFF Event sequence 일치를 검증한다.
- 이전 worker/write token의 늦은 Event/commit은 `STALE_FENCING_TOKEN`으로 거부한다. 증가 epoch/current token만 재개에 사용할 수 있다.
- Run snapshot의 Secret version이 revoked이면 secret 값을 읽거나 provider를 호출하지 않고 재개를 차단하며 actor/time/reference-only audit를 남긴다. 실제 secret 값은 DB, API, log, evidence에 쓰지 않는다.
- capability snapshot hash가 달라졌거나 필수 capability가 사라졌으면 자동 fallback 없이 재개를 차단한다. 동일 snapshot hash인 경우에만 기존 의미로 재개하며 drift는 새 Run/재계획 또는 승인 next action으로 돌린다.
- recovery read model/API는 B-11 framework-neutral port와 표준 error/request-ID/auth scope를 보존한다. 기존 endpoint 의미를 바꾸지 않고 recovery status, evidence hash, last safe checkpoint, blocked reason, next action만 노출한다.
- B Gate 판정, C-01 Agent/provider kernel, 실제 메뉴 UI, F-01 Secret Broker/provider capability 구현, shared DB/WSL 배포/ysna/production은 구현하지 않는다.

## Developer exact file-level write allowlist

- `packages/api/fastapi_app.py`
- `packages/recovery/__init__.py`
- `packages/recovery/models.py`
- `packages/recovery/service.py`
- `packages/recovery/read_model.py`
- `packages/recovery/api.py`
- `packages/persistence/recovery_repository.py`
- `migrations/versions/0010_recovery.py`
- `tests/recovery/test_action_reconcile.py`
- `tests/recovery/test_process_resume.py`
- `tests/recovery/test_secret_capability_recovery.py`
- `tests/recovery/test_recovery_api.py`
- `docs/validation/B-12_RECOVERY_VALIDATION.md`
- `docs/evidence/manifests/B-12_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-12_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-11 frozen evidence/source/test, 기존 migration, actual provider/secret store, UI, shared DB, deployment, Git refs/index는 Developer 수정 금지다. `packages/api/fastapi_app.py`는 B-12 recovery route adapter 연결만 허용하며 기존 B-11 route/security 계약은 변경하지 않는다.

## TDD·검증·보고

1. baseline/authority/B-11 acceptance, epoch-1 worker→write token과 exact15를 먼저 검증한다.
2. 네 제품 test 파일을 각각 독립 RED로 실행해 완료 Action 중복, 미확정 분류, FI-05/06/07, stale token, revoked Secret, capability drift, API scope/hash/next action 부재를 증명한다.
3. 최소 구현 후 각 RED를 GREEN으로 만들고 focused recovery/API tests와 기존 B core·tooling 회귀를 실행한다.
4. 격리 WSL PostgreSQL 18에서 `0009→0010→0009`, FI-05/06/07 각 3회, stale fencing과 concurrent resume hostile case를 검증한다. shared DB와 실제 PC 전원은 사용하지 않는다.
5. 공통 API는 local actual HTTP로 nominal/hostile auth, request ID, same hash/next action을 검증한다. 실제 브라우저/메뉴 UI는 B-12 PASS로 승격하지 않는다.
6. EvidenceManifest는 exact15, raw14 checksum, target hash, self-reference false를 고정한다. CompletionReport에는 변경 전/후 diff, 기존 B-11 계약 유지, 명령/exit code, 실제·simulation·미실행 범위, 잔여 위험과 rollback을 기록한다.
7. 같은 lineage/fingerprint의 증거 완비 `FAILURE_REPORT`만 유효 실패다. 1회 보완, 2회 revision, 3회 lease/tool 회수와 Main 순차 인수를 적용한다.

B-12 acceptance와 Phase B Gate 판정, C-01 시작, 실제 Provider/Secret Broker, 실제 메뉴 UI, shared DB/WSL/ysna/production/deployment는 이 WorkInstruction 범위가 아니다.
