# B-05 WorkInstruction — execution, release, and DIR foundation schemas

- artifact_id: `WI-B-05-20260815-001`
- package/status: `B-05 / ACTIVE`
- executor: `developer-primary-b05`
- baseline_git_commit: `e59c4a105dab0faae31f43fd75e3ac53f1992ffe`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_workplan_successor_manifest_sha256: `63868EAE469167EF167D56E03AED408D73BBAA460EEB322DF3A7455CA586750D`
- assigned: `AV-STAT-008`
- predecessors: `B-02 ACCEPTED`, `A-15 ACCEPTED`, `B-04 ACCEPTED`, workplan v1.6 successor accepted
- environment: `ENV-LOCAL + ENV-WSL-STAGING isolated Anvil PostgreSQL only when implementation validation requires it`

## 목적과 완료 조건

Foundation 1의 `Task`, `Run`, `PlanStep`, `StepAttempt`, `Delegation`, `Result`와 `ProductValidation`, `Defect`, `ReleaseDecision`, `DIR` schema·repository·framework-neutral contract를 구현한다. `PlanStep 1:N StepAttempt`, `StepAttempt 1:0..1 Delegation` 무결성, 인증된 사람만 가능한 ReleaseDecision, blocking defect와 미완료 ProductValidation의 release 차단, DIR `NOT_REACHED | WAITING_OWNER_DIRECTION | CLEARED | REOPENED` 및 owner direction guard를 결정론적 test와 실제 DB constraint로 증명한다.

## 구현 계약

- B-01 domain과 B-02 persistence foundation을 재작성하지 않고 execution aggregate가 단방향으로 의존한다.
- `PlanStep`은 논리 단위이며 재시도·재위임·Main takeover마다 새 `StepAttempt`를 생성한다. 활성 terminal 결과 없는 attempt는 Step당 최대 하나다.
- `executor_kind=SUBAGENT`이면 Delegation이 정확히 하나 필요하고 `MAIN_TAKEOVER`이면 Delegation은 없으며 takeover reference가 필수다.
- Result는 source attempt, target/delivered hash, actor, event sequence와 결박하고 terminal result 중복을 거부한다.
- ProductValidation은 criterion과 target/delivered hash를 결박하며 Technical PASS나 Main preliminary acceptance를 대체하지 않는다.
- ReleaseDecision은 인증된 사람 actor만 생성한다. 동일 subject hash, 필수 ProductValidation 완료·적합, 열린 blocking CRITICAL/MAJOR defect 0건이 아니면 `RELEASE`를 fail-closed 한다.
- DIR은 canonical 4상태만 허용한다. `WAITING_OWNER_DIRECTION`에서 인증된 owner direction Event 없이 `CLEARED`로 갈 수 없고, drift가 재발하면 `REOPENED`로 전이한다.
- API contract는 framework-neutral schema·입출력·오류만 정의한다. FastAPI route/auth/SSE/same-origin BFF는 B-11 범위다.
- migration/constraint 검증은 local isolated PostgreSQL 또는 WSL의 Anvil 전용 격리 DB·container·network만 허용한다. 기존 DB/role/schema/data, ysna/shared-db/production을 변경하지 않는다.
- 제품 API/UI/browser/provider/ysna/shared-db/public production/deployment는 금지하며 미실행을 PASS로 승격하지 않는다.

## Developer exact file-level write allowlist

- `packages/execution/__init__.py`
- `packages/execution/models.py`
- `packages/execution/integrity.py`
- `packages/execution/release.py`
- `packages/execution/dir_guard.py`
- `packages/persistence/execution_repository.py`
- `packages/api/execution_contracts.py`
- `migrations/versions/0004_execution_release.py`
- `tests/execution/test_models.py`
- `tests/execution/test_attempt_integrity.py`
- `tests/execution/test_release_guard.py`
- `tests/execution/test_dir_guard.py`
- `docs/validation/B-05_EXECUTION_RELEASE_VALIDATION.md`
- `docs/evidence/manifests/B-05_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-05_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-04 산출물, 기존 migration/source/test, dependency/config, 다른 package/app, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline·authority·predecessor acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다.
2. 중복 활성 attempt, SUBAGENT 무위임, MAIN_TAKEOVER 위임, 중복 terminal result, 비인증 ReleaseDecision, hash mismatch, 미완료/BLOCKED ProductValidation, blocking defect, owner direction 없는 DIR clear를 먼저 RED test로 고정한다.
3. 최소 구현 후 execution focused tests와 기존 domain/design/planning/persistence/tooling 회귀를 실행한다.
4. DB constraint가 포함되므로 가능하면 WSL Anvil 전용 격리 PostgreSQL에서 revision `0004` upgrade/downgrade와 hostile constraint를 실제 검증한다. 불가능하면 `BLOCKED`/`NOT_EXECUTED`로 기록한다.
5. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
6. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-05 acceptance, B-06 시작, FastAPI/BFF/UI, ysna/shared-db mutation, provider, production과 deploy는 이 WorkInstruction 범위가 아니다.
