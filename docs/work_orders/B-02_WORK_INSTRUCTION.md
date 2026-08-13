# B-02 WorkInstruction — PostgreSQL persistence foundation

- artifact_id: `WI-B-02-20260814-001`
- package/status: `B-02 / READY`
- executor: `developer-primary-b02`
- baseline_git_commit: `85730a48cdc71c06a67728bbd4640b1aeb7e5cb5`
- source_design_sha256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- source_plan_sha256: `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- source_matrix_sha256: `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- source_test_plan_sha256: `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- source_operating_rules_sha256: `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- developer_agent_definition_sha256: `DBA19287719B527112F1D4A1505D616259D4D013115ACD0CF7B4A647EE93FE77`
- predecessor_b01_acceptance_manifest_sha256: `B3E9F6C2AC07E60357021A6527A5365703B0ACA583BDE5E642A2F2034AED599E`
- assigned: `AV-OPS-009`
- environment: `ENV-LOCAL`

## 목적과 완료 조건

PostgreSQL persistence bootstrap, Alembic base migration, framework-independent Repository interface, PostgreSQL 15/18 compatibility profile을 구축한다. 새 격리 DB의 upgrade/downgrade, UTC와 server version 식별, PostgreSQL 15와 18의 schema·extension 차이 계약을 재현 가능한 테스트로 증명한다.

## 구현 계약

- B-01 domain core를 변경하지 않고 persistence adapter가 domain을 의존하는 단방향 경계를 유지한다.
- DB 접속 정보는 환경에서 주입하며 credential, 내부 주소, WSL/production 주소를 코드·문서·증거에 하드코딩하지 않는다.
- Repository interface는 domain이 SQLAlchemy/Alembic/driver를 import하지 않게 한다.
- base migration은 빈 DB upgrade와 downgrade를 모두 지원하고 모든 저장 시각은 timezone-aware UTC 계약을 가진다.
- compatibility profile은 server major version을 15 또는 18로 명시적으로 판별하고 schema·필수 extension capability 차이를 fail-closed로 보고한다. 한 버전의 PASS를 다른 버전 PASS로 재사용하지 않는다.
- Developer는 환경이 가용하면 승인된 WSL-server PostgreSQL 15 Anvil 전용 DB와 별도 격리 PostgreSQL 18 RC 인스턴스에서 실제 migration 계약을 각각 시도한다. 두 결과는 분리하며, 미가용은 PASS가 아니라 `BLOCKED` 또는 `NOT_EXECUTED`로 보고한다.
- production, shared DB, provider, API, UI, 서버 직접 patch, source 복사와 배포는 금지한다. 서버 검증은 승인 Git revision과 격리된 Anvil DB/role 경계만 사용한다.
- B-03 schema나 공개 API, durable queue, Event Store, runtime wiring은 범위 밖이다.

## Developer exact file-level write allowlist

- `pyproject.toml`
- `alembic.ini`
- `packages/persistence/__init__.py`
- `packages/persistence/config.py`
- `packages/persistence/repositories.py`
- `packages/persistence/compatibility.py`
- `migrations/env.py`
- `migrations/script.py.mako`
- `migrations/versions/0001_base.py`
- `tests/persistence/test_repository_contract.py`
- `tests/persistence/test_migration_contract.py`
- `tests/persistence/test_postgres_compatibility.py`
- `docs/validation/B-02_DATABASE_FOUNDATION_VALIDATION.md`
- `docs/evidence/manifests/B-02_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/B-02_COMPLETION_REPORT.md`

그 밖의 authority, progress/HANDOFF, B-01 산출물, 다른 package/app, deploy 설정, Git refs/index는 Developer 수정 금지다.

## TDD·검증·보고

1. baseline, authority hash, B-01 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다.
2. Repository interface dependency 방향, invalid DSN/credential leakage, UTC/version, migration upgrade/downgrade, PG15/18 compatibility 차이를 테스트로 먼저 작성하고 intended RED를 기록한다.
3. 최소 구현 후 focused persistence tests, dependency boundary checker, 기존 domain tests와 tooling 전체를 실행한다.
4. 격리 PostgreSQL 15와 18을 실제로 실행하지 못한 항목은 PASS로 승격하지 않고 `BLOCKED` 또는 `NOT_EXECUTED`로 분리한다.
5. EvidenceManifest는 exact 15 paths, raw checksum, target hash, self-reference false를 고정한다.
6. CompletionReport에 변경 파일·diff·명령/exit code·환경별 실제 결과·미실행 범위·잔여 위험·rollback을 기록한다.
7. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. commit/push와 progress/HANDOFF 수정은 하지 않는다.

B-02 acceptance, B-03 시작, production/shared DB/API/UI/provider/서버 직접 patch/deploy는 이 WorkInstruction 범위가 아니다.
