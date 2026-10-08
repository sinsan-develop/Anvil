# U-01 정확 조합·기간 Dashboard 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Anvil의 단일 Developer write lease, Main 문서·Git 소유, 독립 Tester gate가 우선한다.

**Goal:** 승인된 정확 Project·Environment 조합과 서울 달력일 기간을 선택해 Dashboard의 현재 상태·기간 발생을 근거와 함께 안전하게 보여준다.

**Architecture:** 기존 고정 Dashboard GET/ACK와 F-19A 목록은 그대로 둔다. 새 GET만 매 요청 인증→정확 pair 원장 검증→요청별 읽기 owner→완전성 검증→별도 응답 serializer를 통과한다. Web은 same-origin 상대 경로와 scope/request identity로 오래된 응답을 폐기한다.

**Tech Stack:** Python/FastAPI/SQLAlchemy/psycopg/PostgreSQL 15, React/TypeScript, pytest/Node tests, WSL-server OIDC/HTTPS/Chromium.

**Spec:** `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md` SHA-256 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`; 신산님 승인 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`.

## Global Constraints

- 기존 `GET /api/dashboard/project-environments`, `GET /api/dashboard/operations`, Critical ACK의 method/path/인가/응답 의미는 불변이다.
- 새 GET은 `/api/projects/{projectId}/environments/{environmentId}/dashboard?period=1d|7d|30d`이며 `period` 정확 1회 외 query는 400, envelope은 `data`와 `request_id`다.
- pair는 활성 Project·Environment와 정확 `(actor,project,environment,dashboard:read,active)` grant를 서버에서 같은 읽기 경계로 확인한다. 권한 부재 403, 원본 장애 503이다.
- 기간은 `Asia/Seoul` 오늘 포함 1/7/30 달력일 현지 자정→UTC `[startUtc,endUtc)`이고 미래 당일 실측은 `observedAt`으로 제한한다.
- 현재 상태와 기간 발생은 분리한다. 완전성 없는 숫자는 `null`/`UNAVAILABLE`, 미해결 Critical 전체를 보장 못하면 해당 current read는 503이다.
- 신규 migration/schema/지속 쓰기, 기존 감사 Event 변경, Secret 변경, ysna/Production 작업은 없다. 개발은 Windows 로컬, 정식 QA는 branch exact SHA를 `ssh WSL-server`가 Git으로 받아 수행한다.

## Review Focus

1. 독립적으로 허용된 project ID와 environment ID의 미허용 교차조합 → source 호출 전 403 (Task 1 API/DB 음성).
2. grant 철회·비활성·DB 오류와 동시에 요청된 오래된 응답 → 403/503 또는 화면 폐기, 타 조합 내용 0 (Task 1·3).
3. 월말·윤일·서울 자정·브라우저 타 timezone → 서버 UTC 경계와 `observedAt` 불변 (Task 2·3).
4. 감사 이벤트 누락·부분 페이지·100건 초과·중복 alert ID → 완전 증명 없으면 `UNAVAILABLE` 또는 503, 잘못된 0 금지 (Task 2).
5. 기간 밖에서 발생했지만 미해결인 Critical/Next Action → 현재 영역에 유지, 기간 발생 건수와 혼합 금지 (Task 2·3).

---

### Task 0: 승인·통제 시작

**Files:** `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`, 이 계획, `docs/work_orders/U-01_SCOPED_DASHBOARD_*WORK_INSTRUCTION.md`, `docs/progress/{progress-events.json,build-progress.json,BUILD_HANDOFF.md,progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json}`, `docs/WORK_STATUS.md`, `scripts/check_project_progress.py`, 통제 테스트.

**Interfaces:** 기존 epoch98 seq2279 CLOSED와 정확 branch/HEAD를 선행 기준으로 고정한다. Main은 WorkInstruction·invocation 해시, 새 worker/write lease의 서로 다른 fencing token·만료·정확 경로를 발급한다. Developer는 신규 active/closed G-05 경로를 RED→GREEN하고 Main은 안전 checkpoint·원격 일치·clean을 확인한다. 제품 write는 이 gate 전 0이다.

- [ ] **Step 1:** 승인 문서·계획·WI·invocation을 문서 hash에 결박하고 Event/lease를 append-only 발행한다.
- [ ] **Step 2:** `tests/tooling/`에 옛 seq2279 보존, 새 lease/token/scope, Git·Event·snapshot·digest 변조 음성을 먼저 추가해 RED 확인한다.
- [ ] **Step 3:** `scripts/check_project_progress.py`의 정확 successor route만 구현해 active G-05와 인접 회귀를 GREEN으로 만든다. 기존 fail-closed route는 완화하지 않는다.
- [ ] **Step 4:** Main 독립 검토·정확 파일 `git diff --check`, 통제 checkpoint commit/push와 원격 SHA·clean·G-05를 확인한다.

### Task 1: 요청별 정확 pair 인증과 새 API shell

**Files:** `packages/persistence/f19a_registration_repository.py`, `packages/api/f19a_registration.py`(필요한 Protocol만), `packages/api/registry.py`, `packages/api/fastapi_app.py`, `apps/api/anvil_api/asgi.py`, `apps/api/anvil_api/oidc_process.py`, `tests/persistence/test_f19a_registration_repository.py`, `tests/api/test_f19a_registration_api.py`, 신규 scoped Dashboard API 테스트.

**Interfaces:** 같은 원장 읽기에서 권한과 표시명 네 필드를 반환하는 `require_dashboard_pair(actor_id: str, project_id: str, environment_id: str) -> dict`를 노출한다. 새 route는 인증·coarse `dashboard:read`·정확 pair 확인 뒤에만 `scoped_dashboard_reader(project_id, environment_id, period_key, observed_at)`를 호출한다. Reader 미주입은 503이며 기존 host 고정 port로 fallback하지 않는다.

- [ ] **Step 1:** API/DB 테스트에 exact pair 성공, 교차조합·철회·비활성·미등록·다른 actor 403, DB/reader 장애 503, source 선호출 0, query 누락·중복·초과·비정규 400, 기존 GET/ACK 불변을 RED로 추가한다.
- [ ] **Step 2:** 같은 SQL read 경계의 `require_dashboard_pair`와 새 registry/handler의 순서·오류 envelope을 최소 구현한다. pair 이름을 별도 목록 호출로 재조회하지 않는다.
- [ ] **Step 3:** 집중 pytest와 기존 F-19A/OIDC/Operations API 회귀 및 OpenAPI 경로·권한 검사로 GREEN을 확인한다.

### Task 2: 요청별 읽기 owner·기간·완전성

**Files:** 새 `packages/api/scoped_dashboard.py`(응답 serializer·기간 계산), `packages/observability/service.py`(필요한 read-only 전체 alert/기간 읽기), `packages/persistence/operations_repository.py`(pair 범위 감사 완전성), `apps/api/anvil_api/oidc_process.py`(검증 후 요청별 owner), 해당 unit/API/PG15 integration tests.

**Interfaces:** Task 1의 `scoped_dashboard_reader`가 호출하는 구현 `read_scoped_dashboard(project_id: str, environment_id: str, period_key: str, observed_at: datetime) -> dict`는 `current`, `occurrences`, `sourceCompleteness`를 반환한다. 기간 계산은 `1d/7d/30d`와 UTC aware `observed_at`만 받는다. 감사 `DETECTED` critical은 같은 pair의 전체 sequence/범위가 증명될 때만 고유 alert ID 수를 제공한다.

- [ ] **Step 1:** 서울 자정·월말·윤일, `[start,end)` 경계와 미래 제외, 현재/발생 분리, 완전/부분/누락/100+ 감사, 중복 alert, 기간 밖 미해결 Critical, source gap의 RED 테스트를 추가한다.
- [ ] **Step 2:** 기존 DB 원본을 읽는 요청별 owner와 별도 serializer를 구현한다. 전체 미해결 Critical을 보장하지 못하면 503, 다른 불완전 카드/발생값은 `UNAVAILABLE/count:null`과 원본·scope·사유를 준다.
- [ ] **Step 3:** API/PG15 실제 row·기존 GET/ACK 회귀, Ruff 변경 줄 신규 진단0 및 diff check0을 확인한다. 무한·부분 조회를 완전한 수치로 승격하지 않는다.

### Task 3: Dashboard 필터·상태·오래된 응답 차단

**Files:** `apps/web/src/console/App.tsx`, 기존 Dashboard feature/style 파일 중 실제 사용 경로, `apps/web/tests/f15-console.test.mjs`, 필요한 browser harness.

**Interfaces:** 서버 목록의 한 정확 pair와 `1d|7d|30d`만 선택한다. 브라우저 fetch는 `/api/...` 상대 경로만 사용한다. 목록 재조회·pair/기간 전환·권한 실패 시 이전 response/cache를 폐기하고 request identity/AbortController 양쪽으로 늦은 응답을 차단한다.

- [ ] **Step 1:** 정상 두 pair, 철회 후 재선택, 역순 응답, 현재/발생 별도 근거, `UNAVAILABLE`·오류·loading·empty·keyboard의 RED UI 테스트를 추가한다.
- [ ] **Step 2:** 기존 Dashboard 카드 동작과 GET/ACK 회귀를 보존하며 필터·표시·same-origin 호출을 구현한다. 근거 없는 0·PASS와 내부 주소 노출은 거부한다.
- [ ] **Step 3:** `npm run web:test`, Web typecheck/lint/build와 기존 콘솔/API 회귀를 실행해 결과를 구분해 기록한다.

### Task 4: 동일 SHA WSL-server 실측·독립 인수·병합

**Files:** `docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md`, `docs/evidence/manifests/`의 U-01 evidence, `docs/WORK_STATUS.md`와 canonical progress/HANDOFF.

**Interfaces:** 로컬 clean exact SHA를 기존 개발 원격에 push한 뒤 `ssh WSL-server`에서 Git fetch/checkout한다. 독립 Tester가 `AV-SAFE-034`·`AV-OPS-027`·`AV-UI-017`과 U-01 공통 ID를 현재 코드·실제 증거로 판정한다.

- [ ] **Step 1:** 격리 자원 이름·범위·수명·정리 방법을 사전 기록하고 WSL-server PG15/OIDC/HTTPS/Chromium에서 두 pair→철회→재선택, 기간 경계, DB row/API/화면/Network를 동일 SHA로 검증한다.
- [ ] **Step 2:** 1920×1080·12px, 키보드, 상태/error, E-SHOT/E-NET/E-API/E-AUD와 내부주소·secret 노출0, 기존 Foundation 회귀를 독립 검토한다. 미실행은 PASS가 아니다.
- [ ] **Step 3:** 전용 process/container/DB/임시 profile을 정확 대상으로 정리하고 잔여0을 확인한다. 제품·통제 lease 순차 회수, G-05와 U-01 acceptance를 기록한다.
- [ ] **Step 4:** 필수 gate가 모두 GREEN일 때만 PR 목적·영향·검증·미검증·rollback을 기록해 main 병합, merged-main smoke, 기존 branch/worktree 삭제 후 U-02를 시작한다. ysna/Production은 실행하지 않는다.

## 계획 자체 점검

승인 제안의 목록·API·기간·현재/발생·완전성·정확 인가·무 schema·로컬/WSL/rollback을 Task 0~4에 각각 배정했다. 인접 Tasks는 같은 단일 writer가 순차 수행하며 제품/검증 범위를 통제 완료 전에 열지 않는다. 실제 원본이 없는 발생 지표는 허위 수치 대신 `UNAVAILABLE`이다.
