# F-20/U-01 R36 Scoped Agent Owner Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. This project uses one `developer-primary` with a canonical dual lease; no new branch is created before the current branch is merged and removed.

**Goal:** R13의 실제 범위 지정 Agent owner 읽기를 Dashboard가 나중에 사용할 수 있는 내부 요약과 OIDC 호스트의 지연 조회로 결선한다.

**Architecture:** 기존 `ScopedAgentOwnerSource`만 입력으로 받는 순수 요약이 ACTIVE/REVOKED/EXPIRED 수를 산출한다. `OperationsService`는 별도 optional loader를 지연 호출하고, OIDC 호스트는 고정 인가 Project/Environment와 같은 Engine에서만 R13 읽기를 호출한다. 공개 Dashboard JSON/route, 화면, 권한, DB schema는 그대로 둔다.

**Tech Stack:** Python 3.12+, SQLAlchemy 기존 read-only 포트, pytest, 기존 FastAPI OIDC 호스트, WSL-server PostgreSQL15.

**Spec:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `docs/04_test_reports/F-20_U01_R13_SCOPED_AGENT_OWNER_PLAN.md`, `docs/04_test_reports/F-20_U01_POST_R35_SOURCE_BOUNDARY_REVIEW.md`.

## Global Constraints

- 한 시점에 제품 writer는 `developer-primary` 한 명이며 유효 worker/write fencing lease의 정확 경로만 쓴다.
- 로컬 개발→동일 SHA 사설 Git push→SSH 별칭 `WSL-server`의 격리 PG15 검증→정확 임시자원 정리 순서다.
- R36은 **내부 읽기**만 다룬다. 공개 API/BFF/JSON·브라우저·인증·권한·migration·지속 자료·ysna/Production 변경0.
- C30 `OPEN_BLOCKING`, F-20/U-01 `REWORK_IN_PROGRESS`, ReleaseDecision `DEFER`; R36 GREEN은 U-01 수락이 아니다.

## Review Focus

- 100행 경계/101행·부분 조회: 101행은 R13에서 오류이며, 요약도 위조된 101개 입력을 거부한다(Task 1).
- 중복·잘못된 status/시각/identity: 숫자 0이나 건강으로 바꾸지 않고 안정적인 unavailable을 반환한다(Task 1).
- 다른 Project/Environment: DB 조회 전에 host loader가 거부하고 scope 값이나 DSN을 오류에 노출하지 않는다(Task 2).
- 조회 부재/예외·재시도: Agent 요약만 unavailable; 기존 Queue·Run/Alert는 변하지 않는다(Task 2).
- source 수정/민감정보: snapshot·fence·permission·session ID를 공개 응답이나 오류에 추가하지 않는다(Task 1, 2).

---

### Task 1: 범위 지정 Agent owner의 내부 상태 요약

**Files:**
- Create: `packages/observability/agent_owner_summary.py`
- Create: `tests/observability/test_f20_u01_r36_agent_owner_summary.py`

**Interfaces:**
- Consumes: `packages.persistence.operations_agent_owner_read.ScopedAgentOwnerSource`와 `AgentOwnerObservation`.
- Produces: frozen `ScopedAgentOwnerSummary(observed_at: datetime, observed_total: int, active_owners: int, revoked_owners: int, expired_owners: int)`와 `summarize_scoped_agent_owners(source: ScopedAgentOwnerSource) -> ScopedAgentOwnerSummary`.

- [ ] **Step 1:** 테스트에 빈 0행, ACTIVE/REVOKED/EXPIRED 혼합, 100행을 넣고 정확한 필드·관측시각·입력 불변·민감 ID 비노출을 단언한다.
- [ ] **Step 2:** `python -B -m pytest -q -p no:cacheprovider tests/observability/test_f20_u01_r36_agent_owner_summary.py`를 실행해 모듈 부재 RED를 확인한다.
- [ ] **Step 3:** 정확한 type/aware 시각, 100행 이하, 중복 session/assignment, 각 row 관측시각 일치, 양의 generation/version, 세 상태만 허용한다. 불완전/위조 입력은 `RuntimeError("AGENT_OWNER_SUMMARY_UNAVAILABLE")`로 원인·비밀 없이 닫는다.
- [ ] **Step 4:** 동일 테스트를 GREEN으로 실행하고 101행·중복·미래/naive 시간·잘못된 enum/identity·loader가 반환하지 않은 임의 객체 음성을 추가 검증한다.

### Task 2: OIDC 호스트의 고정 범위 지연 결선

**Files:**
- Modify: `packages/observability/service.py`
- Modify: `apps/api/anvil_api/oidc_process.py`
- Create: `tests/observability/test_f20_u01_r36_agent_host_binding.py`
- Create: `tests/integration/test_f20_u01_r36_agent_host_pg15.py` (명시 opt-in, Main 실행)
- Create: `docs/04_test_reports/F-20_U01_R36_SCOPED_AGENT_SUMMARY_RESULT.md`

**Interfaces:**
- Consumes: Task 1의 `ScopedAgentOwnerSummary`, `summarize_scoped_agent_owners`, 기존 `load_scoped_agent_owner_source(engine, project_id, environment_id)`.
- Produces: `OperationsService(..., agent_owner_summary_loader: Callable[[str, str], ScopedAgentOwnerSummary] | None = None)` 및 `agent_owner_summary() -> ScopedAgentOwnerSummary`; host closure는 생성 때 DB를 읽지 않고 호출 때만 고정 `(scope.project_id, scope.environment_id)`를 검증한다.

- [ ] **Step 1:** owner 미주입/잘못된 반환/예외는 `OperationsError("AGENT_OWNER_SUMMARY_UNAVAILABLE")`; `snapshot()/detect()/alerts()/audit()`는 loader 미호출; 명시 호출만 정확 scope 1회 조회를 단언하는 RED를 쓴다.
- [ ] **Step 2:** host test에 in-memory Engine 및 monkeypatch R13 loader를 사용해 첫 호출 0행, 재호출 혼합 3행, 외부 scope 거부·DB 미조회·기존 Queue/Run 경로 무변경을 RED로 확인한다.
- [ ] **Step 3:** service optional loader와 host closure를 최소 구현한다. 공개 `OperationsPort`와 `project_operations`의 snapshot 필드에는 Agent 수를 추가하지 않는다.
- [ ] **Step 4:** 집중 테스트와 기존 R13/R16/R17, OIDC process/API/Operations 회귀를 GREEN으로 실행한다. Python compile, G-05, diff check도 실행한다. opt-in PG15 test는 전용 DB에서 범위 일치 0/3건·철회/만료와 외부 범위 거부를 확인하되 로컬에서는 SKIPPED로 정확히 표시한다.
- [ ] **Step 5:** Main 독립 diff 검토 후 정확 제품 경로·결과보고서만 기존 branch에 checkpoint/private push한다. WSL-server의 전용 PG15/정확 SHA에서 opt-in 실제 R13 저장·철회·만료 및 R36 지연 host read를 확인하고 생성 자원을 정확히 제거한다. 종료 Event는 write→worker 순으로 append-only 기록한다.

## Self-review

설계 §29.2의 Agent 실제 read model 연결을 위한 내부 선행 단계만 구현한다. UI/공개 응답에 수를 표시하는 일, Project/Environment/기간 선택, Gate·비용·baseline·Critical 확인과 C30 원장 복구는 별도 후속 절편이며 이 계획의 PASS로 주장하지 않는다. Task 1 출력 type과 Task 2 입력 type은 동일하다. Task별 RED/GREEN과 음성 경계를 명시했고 기존 단일 worktree/branch 규칙을 유지한다.
