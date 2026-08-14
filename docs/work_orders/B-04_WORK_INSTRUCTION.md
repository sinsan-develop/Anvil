# B-04 WorkInstruction — planning artifact and approval-hash contracts

- artifact_id: `WI-B-04-20260814-001`
- package/status: `B-04 / ACTIVE`
- executor: `developer-primary-b04`
- baseline_git_commit: `1519d8cce5e205bd9e20652cc380e65e9ca01e49`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- source_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- source_test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b03_acceptance_manifest_sha256: `577C005549601D63487D84E936E6FAE4F6322F734929EEA53FD7F077C374B030`
- runtime_approval_ref: `docs/approvals/APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001.md`
- runtime_design_sha256: `862765B3F637C3AE451A5EAD3A2E61962430B6C7F2A282B63A2C015C04611C99`
- runtime_plan_sha256: `B50B1DA49DAD346E67C745F0D4DCFB30DCEAEDA3A5D27A731B39C776FB51562D`
- assigned: `AV-SAFE-002`, `AV-SAFE-003`, `AV-SAFE-004`, `AV-SAFE-005`, `AV-SAFE-033`, `AV-STAT-002`, `AV-FLOW-012`
- environment: `ENV-LOCAL + ENV-WSL-STAGING (integration first); ysna persistent deployment deferred to approved deployment plan`

## 목적과 완료 조건

`WorkPlan`, `IterationPlan`, `WorkInstruction`과 종류별 `Approval` binding의 canonical content-hash 계약을 schema, service, framework-neutral API contract로 구현한다. 승인된 content hash가 바뀌면 종속 승인을 항상 무효화하고, semantic 변경은 인증된 사람의 새 승인 없이는 진행하지 못하며, 비의미 변경은 root human approval 범위를 넓히지 않는 DB guard와 `MAIN_RECONFIRMED_NON_SEMANTIC` binding으로만 재확정됨을 증명한다.

## 구현 계약

- B-01 domain, B-02 persistence foundation, B-03 design lineage를 변경하지 않고 planning/approval aggregate가 단방향으로 의존한다.
- WorkPlan은 승인된 DesignBaseline을, IterationPlan은 WorkPlan revision을, WorkInstruction은 정확한 IterationPlan과 허용 경로·행동·도구·완료조건을 hash로 결박한다.
- canonical serialization과 content hash 계산은 결정론적이며 content 1글자 변경도 새 revision과 기존 approval binding 무효화를 유발한다.
- `PLAN`, `SCOPE_CHANGE`, `APPLY`, `DEPLOY`, `DESTRUCTIVE` 승인은 서로 대체하거나 재사용할 수 없는 독립 record다.
- 승인 만료 기본값은 1시간이며 만료는 실패가 아니라 `BLOCKED`; 만료·revoked·superseded·subject hash 불일치 상태에서는 자동 실행·재개를 금지한다.
- `MAIN_RECONFIRMED_NON_SEMANTIC`은 root human approval, parent binding, old/new hash, semantic diff, 영향, 근거, actor/time을 필수로 하고 scope·요구사항·중요 위험 확대를 거부한다.
- 기능 범위·요구사항·중요 위험 변경은 semantic으로 분류하고 인증된 사람의 새 승인 없이는 fail-closed 한다. LLM/Main이 hard risk를 낮추거나 사람 승인을 대체할 수 없다.
- API contract는 입력/출력·오류·guard만 framework-neutral하게 고정한다. FastAPI route/auth/BFF/공개 API registry는 B-11 범위다.
- migration 또는 DB guard 검증은 local isolated PostgreSQL 또는 WSL의 Anvil 전용 격리 DB에서 수행한다. WSL을 사용할 때 기존 `local-postgres`의 다른 DB·role·schema·data를 변경하지 않고 Anvil 전용 자원만 사용한다. 환경이 없으면 `BLOCKED`/`NOT_EXECUTED`로 정직히 분리한다.
- `ysna-server:~/deploy/anvil` localhost-only 지속 배포와 `shared-db` 내부 Anvil 전용 DB·role 사용은 신산님 승인 및 별도 배포 계획에 결박되어 있으나 B-04 Developer 구현·실행 범위가 아니다. WSL에서 검증한 동일 full Git SHA 전에는 ysna mutation을 금지한다.
- 실제 provider, 외부 API, 운영 UI, ysna mutation, 공개 production, deployment, 서버 직접 patch는 금지한다.

## Developer exact file-level write allowlist

- `packages/planning/__init__.py`
- `packages/planning/models.py`
- `packages/planning/hashing.py`
- `packages/planning/approval.py`
- `packages/planning/service.py`
- `packages/persistence/planning_repository.py`
- `packages/api/planning_contracts.py`
- `migrations/versions/0003_planning_approvals.py`
- `tests/planning/test_models.py`
- `tests/planning/test_hash_invalidation.py`
- `tests/planning/test_approval_guard.py`
- `tests/planning/test_repository.py`
- `docs/validation/B-04_PLANNING_APPROVAL_VALIDATION.md`
- `docs/evidence/manifests/B-04_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-04_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01~B-03 산출물, 기존 migration/source/test, dependency/config, 다른 package/app, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline, authority hash, B-03 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다.
2. content 1글자 변경, wrong approval type 재사용, subject hash mismatch, 만료 후 resume, root approval 누락, scope/risk 확대의 nonsemantic 위장, parent/binding 불일치를 먼저 RED test로 고정한다.
3. 최소 구현 후 focused planning tests, 기존 design/domain/persistence/tooling 회귀를 실행한다.
4. DB guard가 포함되면 local isolated PostgreSQL 또는 WSL Anvil 전용 격리 DB에서 실제 migration/constraint를 검증하고, 미실행 범위를 PASS로 승격하지 않는다.
5. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
6. CompletionReport에 변경 파일·diff·명령/exit code·실제/미실행 범위·잔여 위험·rollback을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-04 acceptance, B-05 시작, B-11 공개 API/auth/BFF, ysna/shared-db mutation, provider, 외부 API, 운영 UI와 deploy는 이 WorkInstruction 범위가 아니다.
