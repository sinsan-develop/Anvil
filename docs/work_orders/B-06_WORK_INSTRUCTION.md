# B-06 WorkInstruction — Event Store, transition guard, and optimistic version

- artifact_id: `WI-B-06-20260815-001`
- revision: `R1 / PLAN_ALIGNED_INITIAL`
- package/status: `B-06 / ACTIVE`
- executor: `developer-primary-b06`
- baseline_git_commit: `ebe9ce9c28c3e58f8d8200e5747e33ceb2d8174b`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D`
- source_matrix_sha256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- source_test_plan_sha256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b05_acceptance_manifest_sha256: `4CFA15518F5134B4F4115B4C74D2B3B39BF4EB414ECA32DEE17E68D53C00F08B`
- assigned: `AV-STAT-004`, `AV-STAT-005`, `AV-STAT-006`, `AV-STAT-020`
- predecessors: `B-01~B-05 ACCEPTED`, `A Gate ACCEPTED`, `DIR-1 CLEARED`
- environment: `ENV-LOCAL + ENV-WSL-STAGING isolated Anvil PostgreSQL only when implementation validation requires it`

## 목적과 완료 조건

Foundation 1의 append-only Event Store, framework-neutral reducer service, 결정론적 transition guard와 optimistic version 계약을 구현한다. 모든 상태 전이는 canonical Event를 먼저 저장하고 projection을 갱신하며, 동일 `event_id`와 `idempotency_key` 재전달은 중복 Event·Action·적용 없이 동일 결과를 반환한다. 화면 navigation 같은 read-only intent로는 상태 Event를 만들거나 aggregate version을 증가시킬 수 없다. 차단 전이는 설계서 27.2의 정확한 canonical `blocked_code` 9종 중 하나와 append-only Event를 남긴다.

## 구현 계약

- B-01 domain core와 B-05 execution aggregate를 재작성하지 않고 Event aggregate가 단방향으로 의존한다.
- Event는 `event_id`, aggregate/run ID, run 내부 `sequence_no`, `event_type`, actor, correlation/causation, idempotency key, expected/applied version, payload, created_at을 보존한다.
- DB는 append-only를 강제하고 `UNIQUE(run_id, sequence_no)`, 필요한 idempotency uniqueness와 optimistic version compare-and-append를 보장한다. update/delete로 과거 Event를 수정하지 않는다.
- reducer는 저장된 Event 순서로 같은 입력에 같은 projection을 만들며 navigation/read intent는 입력 Event로 허용하지 않는다.
- transition guard는 B-01 canonical transition table을 사용하고, 허용되지 않은 전이와 expected version 불일치를 fail-closed 한다. HTTP 409 route mapping은 B-11 책임이며 B-06은 framework-neutral conflict contract까지만 정의한다.
- 중복 `event_id` 또는 `idempotency_key`가 동일 canonical request를 재전달하면 최초 receipt/result를 반환하고 새 sequence·Action·projection apply를 생성하지 않는다. 같은 key의 다른 payload/hash 재사용은 충돌로 거부한다.
- navigation/view/open/select 같은 read-only intent는 Event Store mutation API에 진입하지 못하며 Event 수·상태·version이 모두 불변이다.
- 차단 Event의 `blocked_code`는 정확히 `BASELINE_CONFLICT | SCOPE_EXPANSION_REQUIRED | PROTECTED_PATH_DENIED | TOOLCHAIN_UNAVAILABLE | VERIFICATION_ENV_UNAVAILABLE | LLM_PROVIDER_UNAVAILABLE | BUDGET_OR_QUOTA_EXCEEDED | APPROVAL_EXPIRED | WORKER_INTERRUPTED`만 허용한다.
- API contract는 framework-neutral schema·입출력·오류만 정의한다. FastAPI route/auth/SSE/same-origin BFF는 B-11 범위다.
- migration/constraint 검증은 local isolated PostgreSQL 또는 WSL의 Anvil 전용 격리 DB·container·network만 허용한다. 기존 DB/role/schema/data, ysna/shared-db/production을 변경하지 않는다.
- 제품 API/UI/browser/provider/ysna/shared-db/public production/deployment는 금지하며 미실행을 PASS로 승격하지 않는다.

## Developer exact file-level write allowlist

- `packages/events/__init__.py`
- `packages/events/models.py`
- `packages/events/store.py`
- `packages/events/transition_guard.py`
- `packages/events/reducer.py`
- `packages/persistence/event_repository.py`
- `packages/api/event_contracts.py`
- `migrations/versions/0005_event_store.py`
- `tests/events/test_event_store.py`
- `tests/events/test_transition_guard.py`
- `tests/events/test_idempotency.py`
- `tests/events/test_navigation_guard.py`
- `docs/validation/B-06_EVENT_STORE_VALIDATION.md`
- `docs/evidence/manifests/B-06_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-06_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-05 산출물, 기존 migration/source/test, dependency/config, 다른 package/app, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline·authority·B-01~B-05 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다.
2. Event 누락, 금지 전이, optimistic version 충돌, 같은 key의 동일/상이 payload, navigation mutation, 잘못된 blocked_code를 먼저 RED test로 고정한다.
3. 최소 구현 후 events focused tests와 기존 domain/design/planning/persistence/execution/tooling 회귀를 실행한다.
4. DB constraint가 포함되므로 가능하면 WSL Anvil 전용 격리 PostgreSQL에서 revision `0005` upgrade/downgrade와 append-only/idempotency/version hostile constraint를 실제 검증한다. 불가능하면 `BLOCKED`/`NOT_EXECUTED`로 기록한다.
5. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
6. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-06 acceptance, B-07 시작, FastAPI/BFF/UI, ysna/shared-db mutation, provider, production과 deploy는 이 WorkInstruction 범위가 아니다.
