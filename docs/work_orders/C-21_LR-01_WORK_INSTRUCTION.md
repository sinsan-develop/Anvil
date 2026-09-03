# WI-C-21-LR-01-20260903-001 — Canonical Task bootstrap API runtime

## 1. 결박 기준

- Work Package: `C-21 / LR-01`
- 기준 branch/HEAD: `codex/c21-lifecycle-runtime@1573e0242aa718d0f81f6b6fc936c754b7c75e60`
- 설계 baseline SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 통합검증매트릭스 SHA-256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- 테스트계획서 SHA-256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001` (`subject_hash=3A68623BF9426EB619AC0B8E082028F73442F90F4680FDCE871711B60A6B5FAD`)
- 단일 executor: `developer-primary`

## 2. 목표

설계서 28.2/28.3의 일반 `POST /api/projects/{projectId}/tasks`와 `GET /api/tasks/{taskId}`를 PostgreSQL 기반 unified runtime에 결선한다. C-21 전용 seed·fixture·우회 endpoint는 만들지 않는다.

## 3. 필요한 동작

1. `POST /api/projects/{projectId}/tasks`는 `objective`, `targetEnvironment`, `conversationMessage`를 받고 서버 생성 Task ID와 initial `DRAFT` 상태를 저장한다.
2. authenticated actor를 `requested_by`로 저장하고 project/environment authorization 및 `tasks:write`를 fail-closed로 검사한다.
3. 공통 mutation guard(same-origin, CSRF, idempotency, version, target-hash, permission scope, reason)를 유지한다. 같은 project/idempotency key의 동일 payload는 같은 결과를 반환하며 mismatch는 거부한다.
4. `GET /api/tasks/{taskId}`는 Task ID, project/repository, objective, target environment, status, version을 반환하고 `tasks:read` 및 project/environment scope를 fail-closed로 검사한다.
5. 현 migration을 보존하며 필요한 column/constraint가 없을 때에만 forward-only `0013` migration을 추가한다. 기존 Run 생성/SSE runtime을 회귀시키지 않는다.
6. canonical registry/OpenAPI에 두 endpoint를 반영한다.

## 4. 단일 writer exact path set

다음 경로만 `developer-primary`가 이 lease 동안 수정할 수 있다. 목록 밖 파일은, 필요한 것처럼 보여도 Main Agent에 `BLOCKED`로 보고한다.

- `packages/api/fastapi_app.py`
- `packages/api/registry.py`
- `packages/api/runtime.py`
- `packages/api/task_bootstrap.py`
- `packages/persistence/task_bootstrap_repository.py`
- `migrations/versions/0013_task_bootstrap_authority.py`
- `tests/api/test_task_bootstrap.py`
- `tests/persistence/test_task_bootstrap_postgres.py`
- `docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md`
- `.superpowers/sdd/Anvil_작업계획서_v1/task-1-report.md`

## 5. 금지 및 protected scope

- C-01, UI, NPM, 배포, production DB mutation, test-session scope/allowlist 변경, Telegram/Provider 외부 호출, server/SSH 호출, Git commit/merge/push를 실행하지 않는다.
- `docs/progress/**`, `docs/approvals/**`, `docs/work_orders/**`, `docs/evidence/**`, 기존 tests/product/evidence는 Main-owned라 수정하지 않는다.
- 기존 사용자 dirty/untracked 파일을 수정·삭제·stage하지 않는다.

## 6. TDD와 완료 조건

1. API contract, authorization 실패, persistence idempotency mismatch의 RED test를 먼저 작성하고 정확한 command/exit/failure reason을 report에 기록한다.
2. 최소 구현 후 focused tests와 기존 registry/OpenAPI, Run creation, SSE, local-session 회귀를 실행한다.
3. PostgreSQL 환경이 없으면 해당 검증만 `NOT_EXECUTED`로 기록한다. unit/contract PASS를 PostgreSQL·browser·production PASS로 승격하지 않는다.
4. 변경 파일, diff, 모든 명령과 exit code, `git diff --check`, 미검증, 잔여 위험, rollback을 보고한다.

## 7. 결과 계약과 rollback

결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다. `task-1-report.md`와 `docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md`에 판정 → 판단 이유 → 조치 순서로 기록한다.

코드 commit은 금지된다. rollback은 이 WorkInstruction의 uncommitted exact-path 변경만 Main review 후 폐기하거나 다음 승인된 rollback 절차에 따라 수행하며, migration이 생성됐더라도 적용·downgrade하지 않는다.
