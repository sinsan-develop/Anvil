# C-21 Lifecycle Runtime Progress

## LR-00 governance binding

- 판정: `ACTIVE / LR-01_DISPATCHED`
- 판단 이유: 신산님의 2026-09-03 명시 승인 문구를 `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`로 canonical binding 했다. 승인 범위는 lifecycle API runtime, production DB canonical C-21 test chain, test-session write scope·allowlist, 해당 변경 배포 및 검증용 외부 side effect 네 항목이며 C-01은 포함하지 않는다.
- 조치: `WI-C-21-LR-01-20260903-001`과 `developer-primary` 단일 worker/write lease를 발행한다. LR-01은 일반 Task bootstrap API runtime만 구현하며 production DB, test-session scope/allowlist, deployment, 외부 side effect는 실행하지 않는다.

## 시작 기준

- branch/HEAD: `codex/c21-lifecycle-runtime@1573e0242aa718d0f81f6b6fc936c754b7c75e60`
- historical event boundary: seq1~389 byte-for-byte preserved; successor events begin at seq390.
- C-01: `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`; WorkInstruction 발행·시작 금지.

## LR-00 검증 기록

- `\.venv\Scripts\python.exe scripts\check_project_progress.py`: exit `0`, `PASS sequence=393 reporting=AUTO_CONTINUE`.
- `\.venv\Scripts\python.exe -m pytest -p no:cacheprovider tests/tooling/test_project_progress.py -q`: exit `0`, `82 passed in 26.77s`.
- `git diff --check`: exit `0`.
- 변경 projection 관련 JSON Schema 4종(`build-progress`, `progress-events`, `non-semantic-revision-bindings`, C-21 detached digest): 모두 `True`.
- 참고: 전체 6종을 한 번에 검사했을 때 기존 `failure-ledger`와 `dir-checkpoints`가 schema 불일치로 exit `1`이었으며, 같은 두 파일의 `HEAD` 내용도 동일하게 `False`여서 이번 변경의 회귀가 아니다.

## LR-00 오류 및 인수 기록

- governance subagent의 no-upstream repository projection 오류가 반복되어 Main Agent가 문서 정합성 작업을 인수했다.
- 잘못 생성된 미커밋 seq390~394 draft는 신산님의 도구 승인 후 `progress-events.json` 한 파일만 `HEAD`(seq389)로 복원했다. historical seq1~389는 변경하지 않았다.
- 올바른 successor는 seq390 승인, seq391 worker lease, seq392 write lease, seq393 package resume 네 건뿐이다.
- Main 조치: feature branch upstream을 `origin/main`으로 설정하고, 신규 C-21 WorkInstruction/보고서의 exact evidence-only allowlist를 checker에 추가하고 현재 hashes를 재결박했다.
- 최종 오류 횟수: governance projection 계열 3회 후 Main 인수, 최종 checker PASS.

## 미검증 및 rollback

- 제품 코드/테스트/DB/서버/배포/외부 side effect는 LR-00에서 실행하지 않는다.
- rollback: LR-00의 append-only governance artifacts와 active lease를 후속 revoke event로 명시적으로 회수한다. seq1~389를 수정하거나 삭제하지 않는다.
# C-21 LR-01 — Canonical Task bootstrap runtime progress

## RED — 2026-09-03

- **판정:** `IN_PROGRESS / RED_CONFIRMED`
- **판단 이유:** `WI-C-21-LR-01-20260903-001`의 branch/HEAD `codex/c21-lifecycle-runtime@1573e0242aa718d0f81f6b6fc936c754b7c75e60`, `seq393`, ACTIVE worker/write lease 및 두 fencing token을 재확인했다. 새 API와 persistence 계약 테스트를 먼저 작성했으며, 구현 모듈이 없어서 정확히 실패했다.
- **명령:** `uv run python -m pytest tests/api/test_task_bootstrap.py tests/persistence/test_task_bootstrap_postgres.py -q`
- **종료 코드:** `2`
- **실제 실패:** `ModuleNotFoundError: No module named 'packages.api.task_bootstrap'`, `ModuleNotFoundError: No module named 'packages.persistence.task_bootstrap_repository'` (collection error 2건).
- **조치:** 새 일반 Task bootstrap port와 PostgreSQL repository만 구현한다. Main 결정에 따라 `projectId → repositoryId` 복사는 하지 않으며, `0013_task_bootstrap_authority`의 `project_repositories` mapping이 없거나 비활성/환경 불일치이면 `PROJECT_REPOSITORY_UNRESOLVED`로 fail-closed 한다. mapping을 만드는 public/admin API는 LR-01 범위 밖이다.
- **보호 경계:** `docs/progress/**`, `docs/approvals/**`, `docs/work_orders/**`, `docs/evidence/**`, UI/NPM/deploy/production DB/Telegram/Provider/Git commit·push는 변경·실행하지 않았다.

## GREEN — 2026-09-03

- **판정:** `COMPLETED / MAIN_REVIEW_PENDING`
- **판단 이유:** 일반 `POST /api/projects/{projectId}/tasks`와 `GET /api/tasks/{taskId}`를 canonical registry/FastAPI/runtime에 결선했다. 서버 생성 Task ID, `DRAFT`/version 1, authenticated `requested_by`, common mutation guard, `tasks:write`/`tasks:read`, project/environment scope, same project idempotency replay/mismatch 거부를 구현했다. repository ID는 request body나 projectId 복사로 만들지 않고 `project_repositories` authority mapping에서만 읽는다. mapping 부재·inactive·environment mismatch는 `PROJECT_REPOSITORY_UNRESOLVED`로 fail-closed 한다.
- **변경 파일:** `packages/api/fastapi_app.py`, `packages/api/registry.py`, `packages/api/runtime.py`, `packages/api/task_bootstrap.py`, `packages/persistence/task_bootstrap_repository.py`, `migrations/versions/0013_task_bootstrap_authority.py`, `tests/api/test_task_bootstrap.py`, `tests/persistence/test_task_bootstrap_postgres.py`, 이 보고서, SDD task report.
- **GREEN 명령 / 종료 코드:**
  - `uv run python -m pytest tests/api/test_task_bootstrap.py tests/persistence/test_task_bootstrap_postgres.py -q` → `0` (`7 passed, 1 skipped`)
  - `uv run alembic heads` → `0` (`0013_task_bootstrap_authority (head)`)
  - `uv run python -m pytest tests/api/test_task_bootstrap.py tests/persistence/test_task_bootstrap_postgres.py tests/api/test_registry_openapi.py tests/api/test_runtime_app.py tests/api/test_run_creation_port.py tests/api/test_sse_resume.py tests/api/test_local_session.py -q` → `0` (`33 passed, 1 skipped`)
  - `uv run python scripts/check_project_progress.py` → `0` (`G-05 project progress contract: PASS sequence=393 reporting=AUTO_CONTINUE`)
  - `git diff --check` → `0`.
- **NOT_EXECUTED:** `ANVIL_TEST_POSTGRES_DSN` 미설정으로 `tests/persistence/test_task_bootstrap_postgres.py`는 skip되었다. migration 실제 apply/rollback, PostgreSQL concurrency, browser, WSL/production DB, deployment, Telegram/Provider/SSH 외부 호출은 실행하지 않았다.
- **잔여 위험:** project registration writer가 아직 mapping을 생성하지 않으면 create API는 의도적으로 403 `PROJECT_REPOSITORY_UNRESOLVED`를 반환한다. legacy Task는 0013의 all-or-legacy 제약을 유지하지만, active mapping 없이는 새 canonical read authorization을 통과하지 않는다.
- **조치 / rollback:** commit·merge·push·migration apply는 하지 않았다. Main review 후 이 WorkInstruction의 uncommitted exact-path 변경만 폐기하거나, 다음 승인된 rollback 절차에서 0013을 적용 전 제거한다.

## REWORK RED — independent review valid failure 1

- **판정:** `REWORK_IN_PROGRESS / RED_CONFIRMED / valid failure 1`
- **근본 원인:** mutation handler는 Host allowlist와 Origin allowlist를 별도 검사했지만 mutation path에서 Host–Origin authority 대조 `_origin()`을 호출하지 않았다. Task authority mapping은 version을 저장하지만 `X-Target-Hash`와 transaction mapping row를 결박하지 않았고, read SQL은 active mapping join 없이 task row만 조회했다. 마지막으로 Task projection/OpenAPI는 §28.2/28.3의 create/read 분리·lowercase `draft` schema를 선언하지 않았다.
- **RED 1 명령 / 종료 코드:** `uv run python -m pytest tests/api/test_task_bootstrap.py::test_mutation_rejects_a_different_allowed_origin_than_the_request_host -q` → `1`; 실제 결과 `201 Created`가 반환되어 예상 `403 ORIGIN_VALIDATION_FAILED`와 불일치했다.
- **RED 2 명령 / 종료 코드:** `uv run python -m pytest tests/api/test_task_bootstrap.py tests/persistence/test_task_bootstrap_postgres.py -q` → `2`; 실제 결과 `ImportError: cannot import name 'TaskBootstrapAuthorityMismatch'`였다. 이는 deterministic authority hash/mismatch contract가 아직 노출되지 않은 기대된 RED다.
- **조치:** exact10 경로만 사용해 mutation same-origin guard, public deterministic authority-hash helper, mapping version row-lock exact compare, active mapping join read, 분리 projection 및 OpenAPI schema를 보완한다. PostgreSQL DSN이 없으면 revoke/mismatch DB test는 `NOT_EXECUTED`로 유지한다.

## REWORK GREEN — independent review valid failure 1

- **판정:** `COMPLETED / MAIN_REVIEW_PENDING`; review valid failure는 `1`로 보존하며, developer의 동일 fingerprint 재실패는 `0`이다.
- **수정:** 모든 mutation은 `_mutation_security()`에서 required Origin을 `_origin()`으로 검사하여 실제 Host authority와 same-origin인지 대조한다. `canonical_task_authority_hash(projectId, repositoryId, targetEnvironment, mappingVersion)`를 public deterministic contract로 노출하고, POST create transaction은 `project_repositories` 활성 mapping row를 `FOR UPDATE`로 잠근 뒤 exact `X-Target-Hash`를 비교해 mismatch를 `409 TASK_TARGET_HASH_MISMATCH`로 fail-closed 한다. Task read SQL도 active mapping과 project/repository/environment/version을 join한다. POST는 `{taskId,status:"draft"}`만, GET은 별도 canonical projection을 반환하며 OpenAPI request/201/200 schema도 이를 분리해 선언한다.
- **후속 TDD RED 명령 / 종료 코드:** `uv run python -m pytest tests/api/test_task_bootstrap.py -q` → `1` (`6 failed, 4 passed`). canonical helper를 쓰도록 test helper를 갱신한 뒤에도 POST 모두 `400`이었다. 원인은 `_HASH`가 `\\Z` 리터럴을 요구해 유효한 sha256 hash를 거부한 단일 validation 구현 결함이었다.
- **GREEN 명령 / 종료 코드:**
  - `uv run python -m pytest tests/api/test_task_bootstrap.py tests/persistence/test_task_bootstrap_postgres.py -q` → `0` (`10 passed, 2 skipped`).
  - `uv run python -m pytest tests/api/test_task_bootstrap.py tests/persistence/test_task_bootstrap_postgres.py tests/api/test_registry_openapi.py tests/api/test_runtime_app.py tests/api/test_run_creation_port.py tests/api/test_sse_resume.py tests/api/test_local_session.py -q` → `0` (`36 passed, 2 skipped`).
  - `uv run alembic heads` → `0` (`0013_task_bootstrap_authority (head)`).
  - `git diff --check` → `0`.
- **governance checker:** `uv run python scripts/check_project_progress.py` → `1` (`GIT_DESCENDANT_PATH_SET_MISMATCH`). 현재 checker가 baseline `HEAD`와 repository projection의 Main-owned 10-path set을 비교하는 동안 LR-01 product/migration/test 파일은 uncommitted/untracked여서 발생했다. `scripts/check_project_progress.py`와 `docs/progress/**`는 Main-owned 및 lease 밖이므로 수정하지 않았고 Main에 전달했다.
- **미검증/잔여 위험:** `ANVIL_TEST_POSTGRES_DSN` 미설정으로 PostgreSQL mismatch/revoked-mapping fixture 2건은 skip이다. migration 실제 apply/rollback, concurrent DB writer, browser/WSL/production DB/deployment/Telegram/Provider는 `NOT_EXECUTED`다. mapping writer가 없으면 create 403은 의도된 fail-closed 동작이다.
- **rollback:** commit·merge·push·migration apply는 하지 않았다. Main review에서 이 WorkInstruction의 uncommitted exact-path 변경만 폐기하거나, 적용 후에는 `0013_task_bootstrap_authority`의 downgrade를 승인된 절차로 실행한다.

## R2 REWORK RED/GREEN — independent review valid failure 2

- **판정:** `COMPLETED_MAIN_REVIEW_PENDING`; independent review valid failure count는 `2`로 보존하고, R2 동일 fingerprint 재실패는 `0`이다.
- **RED 증거:**
  - `uv run python -m pytest tests/persistence/test_task_bootstrap_postgres.py --collect-only -q` → exit `2`: `packages.api.__init__ → runtime → task_bootstrap_repository → packages.api.task_bootstrap` 순환 import로 collection이 중단됐다.
  - Origin/offline SQL/lazy-runtime 계약 3건을 먼저 추가한 뒤 `uv run python -m pytest tests/api/test_task_bootstrap.py::test_mutation_rejects_allowlisted_http_origin_for_an_https_request tests/api/test_task_bootstrap.py::test_task_bootstrap_migration_renders_offline_upgrade_and_downgrade_sql tests/api/test_task_bootstrap.py::test_runtime_factory_binds_task_create_and_read_ports -q` → exit `1` (`3 failed`): HTTPS request + allowlisted `http://anvil.local` Origin이 `201`, 0013 upgrade가 `create_check_constraint() takes 4 positional arguments but 5 were given`, runtime이 top-level persistence reference를 계속 사용해 `500`이었다.
  - forwarded-host test는 처음 app Host middleware의 fail-closed 403을 관찰해 `_origin()` 함수 경계로 정정했다. 과거 `_origin()` 경로에서 `uv run python -m pytest tests/api/test_task_bootstrap.py::test_mutation_compares_origin_with_actual_request_host_not_forwarded_host -q` → exit `1`, `ApiContractError ORIGIN_VALIDATION_FAILED`였다.
- **수정:** `_origin()`은 request URL의 scheme/hostname/port만 Origin과 대조하여 `X-Forwarded-Host`를 endpoint authority로 쓰지 않는다. 0013은 `op.create_check_constraint(name, table, condition)`의 올바른 3-argument signature를 쓰고 downgrade에서 mapping-version check constraint도 drop한다. runtime의 Task repository import는 `create_runtime_app()` 내부 lazy import로 이동해 persistence 단독 import cycle을 제거했다.
- **GREEN 증거 / 종료 코드:**
  - Origin host/scheme/forwarded-host 3경로 → `3 passed` (exit `0`).
  - `uv run python -m pytest tests/api/test_task_bootstrap.py::test_task_bootstrap_migration_renders_offline_upgrade_and_downgrade_sql -q` → `1 passed` (exit `0`): 0012→0013 offline upgrade 및 `0013_task_bootstrap_authority:0012_run_authority` downgrade SQL 확인.
  - persistence standalone collection → `2 tests collected` (exit `0`); runtime lazy binding → `1 passed` (exit `0`).
  - Task/persistence/web-security focused → `26 passed, 2 skipped` (exit `0`); complete API/runtime regression → `52 passed, 2 skipped` (exit `0`).
  - `uv run alembic heads` → `0013_task_bootstrap_authority (head)` (exit `0`); `uv run python scripts/check_project_progress.py` → `PASS sequence=393 reporting=AUTO_CONTINUE` (exit `0`); `git diff --check` → exit `0`.
- **미검증/잔여 위험:** `ANVIL_TEST_POSTGRES_DSN` 미설정으로 PostgreSQL fixture 2건은 skip이다. migration 실제 apply/rollback과 concurrent DB writer, browser/WSL/production DB/deployment/Telegram/Provider는 `NOT_EXECUTED`다. project registration writer가 mapping을 만들기 전 create 403은 fail-closed 정상이다.
- **rollback:** commit·merge·push·migration apply는 하지 않았다. Main review에서 exact-path uncommitted diff만 폐기하거나, 승인된 실제 적용 후 0013 downgrade를 실행한다.

## R3 REWORK RED/GREEN — independent review valid failure 3

- **판정:** `COMPLETED_MAIN_REVIEW_PENDING`; 이것은 R1/R2 반복이 아닌 idempotency ordering의 신규 independent review finding이다. canonical valid-failure projection과 3회 규칙 판단은 Main 소유이며, R3 replay fingerprint 재실패는 `0`이다.
- **RED:** mapping version 1에서 생성한 Task의 mapping을 active version 2로 바꾼 뒤 같은 command/key를 재시도하는 transaction fixture를 먼저 추가했다. `uv run python -m pytest tests/persistence/test_task_bootstrap_postgres.py::test_task_replay_precedes_current_mapping_lock_and_uses_stored_receipt -q` → exit `1`; 기존 `create()`가 mapping `FOR UPDATE` 및 v2 authority hash 검증을 replay lookup보다 먼저 하여 `TaskBootstrapAuthorityMismatch`를 냈다.
- **수정:** transaction 시작 직후 `tasks(project_id,idempotency_key)`의 stored row를 mapping join 없이 먼저 조회한다. stored fingerprint 또는 stored target environment가 command와 다르면 `TaskBootstrapIdempotencyMismatch`; exact match면 mutable mapping의 active/version과 무관하게 stored row로 duplicate receipt를 반환하고 write·mapping query를 하지 않는다. receipt가 없을 때만 active mapping을 `FOR UPDATE`한 뒤 canonical authority hash를 검증하고 insert한다. 일반 `GET`의 active mapping join 규칙은 유지한다.
- **GREEN / 종료 코드:**
  - R3 repository ordering test → `1 passed` (exit `0`): v1→v2 exact replay, inactive mapping exact replay, same-key payload/environment mismatch, new-key stale hash reject, insert 1회와 replay mapping query 0회를 확인했다.
  - Task/persistence/web-security focused → `27 passed, 2 skipped` (exit `0`); complete API/runtime regression → `53 passed, 2 skipped` (exit `0`).
  - `uv run alembic heads` → `0013_task_bootstrap_authority (head)` (exit `0`); `uv run python scripts/check_project_progress.py` → `PASS sequence=393 reporting=AUTO_CONTINUE` (exit `0`); `git diff --check` → exit `0`.
- **미검증/잔여 위험:** `ANVIL_TEST_POSTGRES_DSN` 미설정으로 actual PostgreSQL fixture 2건은 skip이며, concurrent PostgreSQL retry race·migration apply/downgrade, browser/WSL/production DB/deploy/Telegram/Provider는 `NOT_EXECUTED`다. mapping writer 부재의 새 request는 계속 403 fail-closed다.
- **rollback:** commit·merge·push·migration apply는 하지 않았다. Main review에서 exact-path uncommitted diff를 폐기하거나 승인된 실제 적용 후 0013 downgrade를 실행한다.

## R4 REWORK GREEN — 신규 replay/scope/response-contract finding

- **판정:** `COMPLETED_MAIN_REVIEW_PENDING`; R4는 R1~R3와 다른 scope/replay race/response projection finding이다.
- **수정:** runtime POST Task scope는 injected resolver의 project/environment/role scope만 사용하며 current mapping lookup으로 replay를 선차단하지 않는다. GET mapping authority lookup은 유지한다. repository create는 initial receipt lookup 뒤 miss일 때만 mapping `FOR UPDATE`·hash 검증을 하고, lock 뒤 receipt를 재조회해 exact duplicate는 immutable `DRAFT`/version 1 create receipt로 반환하고 mismatch는 fail-closed한다. FastAPI는 Task POST/GET `ApplicationResponse`의 status/body를 OpenAPI exact schema와 대조해 invalid status/type/enum/extra field를 `API_RESPONSE_CONTRACT_INVALID` 500으로 닫는다.
- **GREEN / 종료 코드:** `uv run python -m pytest tests/api/test_task_bootstrap.py tests/persistence/test_task_bootstrap_postgres.py -q` → `15 passed, 2 skipped` (0); full API/runtime regression → `54 passed, 2 skipped` (0); `uv run alembic heads` → 0013 head (0); progress checker PASS (0); `git diff --check` (0).
- **미검증/rollback:** actual PostgreSQL fixture 2건, concurrent DB race, migration apply/downgrade, browser/WSL/production/deploy/Telegram/Provider는 `NOT_EXECUTED`. commit·push·apply 없음; Main review에서 exact-path uncommitted diff를 폐기하거나 승인된 적용 후 0013 downgrade를 사용한다.

## R5 REWORK GREEN

- **판정:** `COMPLETED_MAIN_REVIEW_PENDING`. TLS termination backend HTTP의 allowlisted HTTPS Origin은 유지하고 HTTPS request의 HTTP downgrade는 차단했다. POST path projectId와 authorized scope를 exact compare하며 Task raw/non-ApplicationResponse 및 nested requirements/questions scalar를 `API_RESPONSE_CONTRACT_INVALID` 500으로 fail-closed한다.
- **검증:** focused(error_concurrency 포함) `32 passed, 2 skipped`; 전체 `tests/api`+Task persistence `73 passed, 2 skipped`; Alembic head, progress checker, diff-check 모두 exit `0`.
- **미검증/rollback:** PostgreSQL fixture 2건, 실제 DB/server/deploy/외부 연동은 `NOT_EXECUTED`; commit/push/apply 없음.

## R6 DURABILITY REWORK — durable API boundary와 실제 PostgreSQL concurrency

- **판정:** `COMPLETED_MAIN_REVIEW_PENDING`. R6는 R1~R5와 다른 HTTP adapter scope-binding 내구성 finding이며 동일 fingerprint 3회 반복이 아니다.
- **TDD RED:** durable API regression을 실제 test file에 먼저 추가한 뒤 `uv run python -m pytest tests/api/test_task_bootstrap.py -q`를 실행했다. exit `1`, `3 failed, 18 passed`였다. 이 중 port mismatch 1건은 endpoint host middleware가 origin 검증보다 먼저 닫은 test-harness 경계여서 `_origin()` 직접 contract로 정정했다. 제품 결함 2건은 resolver가 path `project-1`과 다른 authorized `project-2`, body `env-local`과 다른 authorized `env-other`를 반환해도 raw Task port가 호출되고 `201`을 반환한 것이다.
- **수정:** `POST /api/projects/{projectId}/tasks` HTTP adapter는 authorization 완료 직후 path `projectId == authorization_scope.project_id`와 body `targetEnvironment == authorization_scope.environment_id`를 exact compare한다. mismatch는 각각 `403 AUTHORIZATION_PROJECT_DENIED`, `403 AUTHORIZATION_ENVIRONMENT_DENIED`로 port 호출 전에 fail-closed한다. TLS termination의 backend HTTP + public HTTPS Origin은 허용하고, HTTPS→HTTP downgrade, host/port mismatch는 계속 거부한다. Task POST/GET raw mapping, GET `requirements`/`questions` scalar도 `500 API_RESPONSE_CONTRACT_INVALID`로 닫는 durable tests를 보존했다.
- **격리 PostgreSQL 16 Main 증거:** WSL Ubuntu Docker의 기존 `postgres:16-alpine`, 임시 전용 container `anvil-c21-lr01-pg-20260903`, loopback `127.0.0.1:55433`, 전용 DB/user를 사용했다(credential 비공개). 최초 plain `postgresql://` DSN은 `psycopg2` 미설치로 `2 failed, 1 passed`였고, 제품 결함이 아닌 DSN driver 선택 오류로 분류해 `postgresql+psycopg://<redacted>`로 교정했다. `alembic upgrade head` exit `0`; 기존 PostgreSQL test `3 passed in 0.74s`; `alembic downgrade base` exit `0` → `alembic upgrade head` exit `0` → 기존 test `3 passed in 0.81s`. 신규 concurrent same project/idempotency-key/same fingerprint writer 2개 barrier test까지 포함한 최신 실행은 exit `0`, `4 passed in 0.79s`다. 두 writer 모두 정상 종료하고 같은 Task ID, 정확히 하나의 duplicate receipt, DB row 정확히 1개를 확인하며 `IntegrityError`/500 노출은 허용하지 않는다.
- **GREEN/회귀:** API durable `21 passed` (exit `0`); API+Task persistence focused `22 passed, 3 skipped` (exit `0`, local shell DSN 미설정); 전체 `tests/api`+Task persistence `80 passed, 3 skipped` (exit `0`); offline 0012→0013 upgrade/explicit downgrade SQL `1 passed` (exit `0`); `uv run alembic heads`는 `0013_task_bootstrap_authority (head)` (exit `0`); progress checker `PASS sequence=393 reporting=AUTO_CONTINUE` (exit `0`); `git diff --check` exit `0`.
- **미검증/잔여 위험:** browser, WSL staging runtime 배포, production DB chain, test-session scope/allowlist, ysna deployment, Telegram/Provider side effect는 이 LR-01 writer 범위에서 `NOT_EXECUTED`다. `apps/api/anvil_api/asgi.py`의 migration ready metadata는 exact10 밖이라 수정하지 않았다.
- **rollback:** commit·merge·push·server/production mutation은 하지 않았다. Main review에서 이번 exact-path uncommitted diff만 폐기하거나, 승인된 실제 migration 적용 이후에는 검증된 0013 downgrade 경계를 사용한다.

## R7 REWORK — canonical Task lifecycle status read contract

- **판정:** `COMPLETED_MAIN_REVIEW_PENDING`. R7은 GET response/OpenAPI가 canonical Task lifecycle의 정상 후속 상태를 거부한 신규 status-contract finding이며, 이전 fingerprint의 반복이 아니다.
- **TDD RED:** `CONFIRMED` version 2와 `IN_PROGRESS` version 3 Task GET durable cases를 먼저 추가했다. selected suite는 exit `1`, `3 failed, 1 passed`; 두 GET case는 기존 draft-only validator 때문에 각각 HTTP `500`이었다. OpenAPI test의 최초 status expectation 위치 오류는 POST가 아닌 GET schema로 즉시 정정했다. DB row status/version을 `COMPLETED`/7로 변경한 후 같은 POST command/key를 replay하는 immutable receipt test는 기존 구현에서 `DRAFT`/1, duplicate true로 통과해 그 계약을 영구 보존했다.
- **수정:** `packages/execution/models.py`의 canonical `TaskStatus` 5종에서 lowercase read status tuple을 생성한다. GET response validator와 GET OpenAPI enum만 `draft`, `confirmed`, `in_progress`, `completed`, `cancelled`를 허용한다. POST create response validator/OpenAPI는 `{taskId,status:'draft'}` 전용을 유지했다.
- **GREEN/회귀:** selected status/OpenAPI/immutable replay `4 passed` (exit `0`); 전체 `tests/api`+Task persistence local 실행 `83 passed, 3 skipped` (exit `0`, local shell DSN 미설정); offline migration 왕복 test `1 passed` (exit `0`); `uv run alembic heads`는 `0013_task_bootstrap_authority (head)` (exit `0`); progress checker `PASS sequence=393 reporting=AUTO_CONTINUE` (exit `0`).
- **격리 PostgreSQL 16:** 동일 임시 전용 container와 `postgresql+psycopg://<redacted>` DSN으로 최신 persistence file을 재실행해 exit `0`, `5 passed in 0.85s`를 확인했다. immutable replay와 concurrent same-key test를 모두 포함한다.
- **미검증/rollback:** browser, WSL staging runtime 배포, production DB chain, test-session scope/allowlist, ysna deploy, Telegram/Provider는 `NOT_EXECUTED`. `apps/api/anvil_api/asgi.py`와 deploy script는 수정하지 않았다. commit·push 없음; Main review에서 exact-path diff를 폐기하거나 승인된 0013 downgrade를 사용한다.

## R8 REWORK — direct-port authorization error preservation

- **판정:** `COMPLETED_MAIN_REVIEW_PENDING`. fingerprint `TASK_PORT_AUTH_ERROR_SHADOWED_BY_VALUEERROR`의 두 번째 확인이다. 동일 오류 3회 인수 조건에는 아직 도달하지 않았다.
- **TDD RED:** direct `TaskBootstrapPort`에 authorized environment `env-other`, body `env-local`을 전달하고 repository create 0회와 정확한 `403 AUTHORIZATION_ENVIRONMENT_DENIED`를 요구했다. `uv run python -m pytest tests/api/test_task_bootstrap.py::test_task_port_preserves_environment_authorization_error_before_repository_create -q`는 exit `1`; 실제 code는 `400 INVALID_TASK_BOOTSTRAP`이었다. 원인은 `ApiContractError`가 `ValueError`를 상속하며 `_create()`의 validation catch에 다시 포획된 것이다.
- **수정:** `packages/api/task_bootstrap.py` validation catch 앞에 `except ApiContractError: raise`를 추가해 이미 분류된 authorization 오류의 code/status를 보존한다. 입력 `KeyError`/`TypeError`/일반 `ValueError`는 기존 `400 INVALID_TASK_BOOTSTRAP` 경계를 유지한다.
- **GREEN/회귀:** direct-port와 HTTP adapter environment mismatch `2 passed` (exit `0`); 전체 `tests/api`+Task persistence `84 passed, 3 skipped` (exit `0`, local shell DSN 미설정); offline migration `1 passed` (exit `0`); Alembic head `0013_task_bootstrap_authority` (exit `0`); progress checker `PASS sequence=393 reporting=AUTO_CONTINUE` (exit `0`); progress tooling `82 passed` (exit `0`); `git diff --check` exit `0`.
- **PostgreSQL/잔여 경계:** R7 동일 persistence code/test 기준 격리 PostgreSQL 16 `5 passed in 0.85s` 증거는 유지된다. R8은 application port error mapping만 변경해 DB mutation은 실행하지 않았다. browser/WSL runtime/production chain/test-session allowlist/ysna deploy/Telegram/Provider는 `NOT_EXECUTED`; `apps/api/anvil_api/asgi.py`와 deploy script 미수정, commit/push 없음.
- **격리 검증 자원 정리:** Main은 latest persistence `5 passed` 및 전체 `100 passed` 검증 후 전용 임시 container `anvil-c21-lr01-pg-20260903` (`postgres:16-alpine`, loopback `127.0.0.1:55433`)를 `docker rm -f`로 제거했다. exact-name filter 재조회 결과는 0건이며 별도 volume은 생성하지 않아 격리 PostgreSQL 검증 잔여물은 0이다.

## R9 independent review — PASS

- **판정:** 독립 reviewer `/root/c21_lr01_r9_review`는 `PASS / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0으로 판정했다. reviewer 파일 변경은 0이며 별도 report file 없이 대화 evidence로 전달됐다.
- **검증:** direct Task port environment mismatch `403`, ordinary invalid input `400`, repository create 0회를 확인했다. Task focused `26 passed, 3 skipped`; full `98 passed, 20 skipped`; selected regression `12 passed`; offline migration `1 passed`; Alembic head `0013_task_bootstrap_authority`; standalone imports PASS; progress checker `PASS sequence=393`; progress tooling `82 passed`; `git diff --check` PASS다.
- **Main 최종:** 같은 latest tree를 실제 격리 PostgreSQL 16까지 포함한 full suite에서 `100 passed, 17 skipped`로 확인했다. 검증 container 제거와 exact filter 0건·volume 미생성 증거는 위 격리 자원 정리 항목에 기록했다.
