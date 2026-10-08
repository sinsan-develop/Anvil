# F-20/U-01 R8 Scoped Queue Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 F-13 Operations projection이 사용할 수 있는 project/environment 범위 고정 PostgreSQL Queue 읽기 source를 만든다.

**Architecture:** 기존 `durable_queue_jobs`를 `runs`·`tasks`에 조인하여 인증된 한 project/environment의 행만 읽는다. 하나의 PostgreSQL read-only repeatable-read transaction에서 관측 시각·job·quarantine·legacy 미귀속 여부를 materialize하고, 기존 `OperationsSources.queue`가 요구하는 `get()`/`quarantine()`과 명시적 job ID 목록을 공급한다. 이 단위에서는 host 주입·공개 API·Dashboard UI를 변경하지 않는다.

**Tech Stack:** Python 3.13, SQLAlchemy, PostgreSQL 15, pytest.

**Spec:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` §13 U-01, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` Task 4, `docs/WORK_STATUS.md`의 `029b8754`·`d0d9447e` 감사.

## Global Constraints

- Local에서 개발·사설 branch push 후 `ssh WSL-server`의 격리 checkout에서 동일 SHA PostgreSQL 15을 검증한다. `ysna-server`/Production은 대상이 아니다.
- 단일 Developer writer·canonical worker/write lease·G-05가 제품 수정 전 유효해야 한다. 새 branch는 만들지 않는다.
- 새 공개 API·permission·DB migration·Secret·실행 claim/complete/fail 동작을 변경하지 않는다.
- Queue source가 없거나 스코프가 불완전하면 `UNAVAILABLE` 경계를 유지하며 빈 목록을 실제 0건 또는 HEALTHY로 승격하지 않는다.
- SQL과 projection에 payload·fencing token·credential을 출력하지 않는다. GET/읽기 경로는 audit와 queue를 변경하지 않는다.
- R8 PASS는 내부 source 계약에 한정한다. U-01/F-20 acceptance, C30 복구, 정식 E-SHOT/E-NET은 별도다.

## Review Focus

- 다른 project 또는 environment의 job/quarantine이 관측되지 않는지: Task 1의 cross-scope 테스트.
- environment_id가 NULL인 legacy run이 조용히 0건으로 처리되지 않는지: Task 1의 legacy 테스트.
- payload·execution/write fencing token이 결과나 오류에 노출되지 않는지: Task 1의 secret 테스트.
- 읽는 중 DB 행이 바뀌어 job 목록과 quarantine이 서로 다른 시점이 되지 않는지: Task 1의 snapshot 테스트.
- 대량 row에서 무한 조회·부분 결과를 완전한 것으로 표시하지 않는지: Task 1의 경계 테스트.

---

### Task 1: 범위 고정 Queue source snapshot

**Files:**
- Create: `packages/persistence/operations_queue_read.py`
- Create: `tests/persistence/test_f20_u01_r8_queue_read.py`
- Create: `docs/04_test_reports/F-20_U01_R8_QUEUE_READ_RESULT.md`

**Interfaces:**
- Consumes: trusted SQLAlchemy Engine, `tasks.project_id`, `runs.environment_id`, `durable_queue_jobs.run_id`, `queue_quarantine.job_id`, 기존 `OperationsSources(queue=..., queue_job_ids=...)`의 read contract.
- Produces: `load_scoped_queue_source(engine, project_id: str, environment_id: str) -> ScopedQueueSource`; `ScopedQueueSource.job_ids: tuple[str, ...]`, `get(job_id: str) -> QueueObservation`, `quarantine() -> tuple[QuarantinedJob, ...]`, `observed_at: datetime`, `legacy_unscoped_present: bool`. `QueueObservation`은 기존 projection의 `job_id/run_id/status/available_at/attempts/max_attempts/lease_epoch/lease_expires_at/dependency_ids/conflict_keys/input_verified`만 갖고 `payload`·token을 보유하지 않는다.

- [ ] **Step 1: 실패 테스트 작성.** 빈 scope, 동일 project의 타 environment, 타 project, NULL legacy, quarantine, payload/token 비노출, 101건 초과 fail-closed, snapshot 일관성, SQL read-only를 각각 이름 있는 테스트로 작성한다. 로컬 fake connection 테스트와 WSL-server 격리 PG15 실제 테스트를 구분한다.
- [ ] **Step 2: RED 확인.** 로컬 `.\.venv\Scripts\python.exe -m pytest tests/persistence/test_f20_u01_r8_queue_read.py -q --basetemp=.pytest_tmp_f20_u01_r8_queue_read`에서 owner 부재에 따른 예상 실패를 기록한다. Main은 실행 전 이 exact base의 부재·수명·정리를 `WORK_STATUS`에 기록한다.
- [ ] **Step 3: 최소 구현.** 범위 입력을 검증하고 한 read-only repeatable-read transaction에서 `runs → tasks` 조인으로 job/격리 quarantine/legacy flag를 materialize한다. 최대100건을 넘으면 예외로 거부하고 부분 목록을 반환하지 않는다. `get()`은 snapshot에 없는 ID를 거부한다. status·timestamp·dependency를 기존 projection 형식으로 변환하고 payload/token은 SELECT하지 않는다.
- [ ] **Step 4: GREEN 및 Developer 인계.** 같은 테스트와 기존 `tests/observability/test_f13_operations.py`, `tests/persistence/test_dag_queue_e04.py`, G-05를 실행한다. `project_operations(OperationsSources(queue=source, queue_job_ids=source.job_ids), ...)`가 범위 내부 row만 반환하고 health `UNKNOWN`을 유지하는지 검사한 뒤 exact3 변경·RED/GREEN·미검증을 Main에 보고한다.
- [ ] **Step 5: 동일 SHA WSL 실측.** Main 독립 diff/테스트/G-05 후 기존 branch에 commit/private push한다. WSL-server의 기존 격리 QA checkout을 exact SHA로 FF하고 전용 PG15/migration0019·합성 scope 데이터를 사용해 0/타 project/타 environment/legacy/quarantine·DB 불변을 검증한다. 결과보고서에 실제 명령·exit·row 수·미실행·자원 정리를 기록한다.
- [ ] **Step 6: 검증 checkpoint.** Main은 WSL 증거·임시 자원 잔여0·로컬/원격/WSL SHA를 확인해 동일 branch에 결과 checkpoint를 남긴다. host 주입/API/UI는 다음 WI로 남긴다.

## Self-review

- 본 계획은 Queue 읽기 source 한 단위만 다룬다. UI/공개 API/Worker·Budget·Provider는 포함하지 않는다.
- `legacy_unscoped_present`가 true이면 후속 host는 완전한 Queue 수치로 표시하지 못한다. 빈 `job_ids`만으로 건강을 주장하지 않는다.
- Task 1의 모든 위험 항목에 테스트를 배정했다. 계획 자체는 제품 구현·검증 PASS가 아니다.
