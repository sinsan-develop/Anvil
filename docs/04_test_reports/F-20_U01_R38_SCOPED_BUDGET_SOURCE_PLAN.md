# F-20/U-01 R38 Scoped Budget Source Implementation Plan

> 담당: Main 어울의 canonical 통제, 단일 `developer-primary`의 제품 exact-path 구현. 기존 승인 설계 §29.2·작업계획 U-01의 내부 예산 자료 연결 절편이다. TDD RED→GREEN과 독립 Main 검토를 적용한다.

**Goal:** 현재 OIDC host의 고정 Project/Environment 범위에서 PostgreSQL 예산 원장·예약의 실제 읽기 값을 기존 F-13 Dashboard `budget`/`reservations` 필드에 연결한다.

**Architecture:** 새 persistence read adapter가 `budget_ledgers → runs → tasks`와 `budget_reservations`를 단일 read-only repeatable-read transaction에서 범위 제한·상한 검사한 뒤 불변 snapshot을 만든다. 현재 `load_queue_sources`는 기존 scope 선검증과 Queue read 뒤 이 adapter를 호출하여 `OperationsSources.budget/budget_ids/reservation_ids`에 넣는다. 공개 필드·권한·migration·UI는 그대로다.

**Tech Stack:** Python 3.12, SQLAlchemy 2, PostgreSQL 15, pytest, FastAPI TestClient. Main의 동일 SHA WSL-server opt-in은 격리 PG15로 수행한다.

**Spec:** `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `docs/04_test_reports/F-20_U01_POST_R37_ACCEPTANCE_GAP_REVIEW.md`. 이 절편은 `예상 비용 초과` 카드 자체나 기간/완전성 집계를 구현하지 않는다.

## Global Constraints

- 현재 branch `codex/f18-wsl-ops` 하나만 사용하고 Main 직접 제품 write 없이 canonical dual lease의 exact-path 단일 Developer에게 맡긴다.
- 승인된 공개 Dashboard exact 필드·same-origin·OIDC/CSRF/권한, DB schema·지속 데이터, Secret, UI를 바꾸지 않는다.
- 100개 상한 초과·legacy NULL environment·scope/참조 불일치·malformed 값·DB 오류는 부분 수치 대신 안정적인 unavailable/503으로 닫는다. SQL/DSN/비밀은 노출하지 않는다.
- SQL read adapter는 non-superuser DB 권한과 `SET TRANSACTION READ ONLY`로 실제 row를 관측한다. 외부 Provider 호출과 DB write는 0건이다.
- 최초 fixture/local PASS를 WSL 실제 PG15, 브라우저 또는 F-20/U-01 ACCEPTED로 승격하지 않는다. C30 `OPEN_BLOCKING`/DEFER, ysna/Production 제외를 유지한다.

## File Structure

- Create `packages/persistence/operations_budget_read.py`: scoped read-only owner, bounded IDs, immutable budget/reservation observations, stable failure code.
- Modify `apps/api/anvil_api/oidc_process.py`: existing trusted fixed-scope host loader의 최소 주입만.
- Create `tests/persistence/test_operations_budget_read.py`: SQL scope·집계·오류·read-only 계약.
- Create `tests/api/test_f20_u01_r38_budget_host_binding.py`: 실제 OIDC host/Dashboard 공개 field·권한·기존 source 회귀.
- Create `tests/integration/test_f20_u01_r38_budget_host_pg15.py`: Main 실행 전용 opt-in 실제 PG15/OIDC host, 비관리자 role·전용 DB, read-only/cleanup.
- Create `docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_RESULT.md`: RED/GREEN/실측/미검증/rollback. Developer 제품 write exact6은 위 여섯 경로로 한정한다.

## Review Focus

1. 동일 Project에 다른 Environment의 예산이 있을 때 그 값이 공개되는가? adapter/host 음성 테스트에서 0행 또는 자기 scope만 확인한다.
2. reservation의 `run_id`가 ledger의 Run과 불일치하거나 legacy NULL environment일 때 일부 금액이 통과하는가? 전체 unavailable을 확인한다.
3. 101번째 budget 또는 reservation이 있을 때 처음 100개를 전체처럼 내보내는가? 상한 초과 fail-closed를 확인한다.
4. Decimal/토큰 집계와 `RESERVED`·`RECONCILIATION_REQUIRED`·`CONSUMED` 상태가 기존 in-memory `BudgetSnapshot` 의미와 다른가? 정확한 literal 합계·active 수를 확인한다.
5. OIDC 권한403·Queue 오류503·DB read 오류가 기존 예산/Run/Provider/Alert 자료를 부분 성공으로 노출하는가? host/API 음성 회귀로 확인한다.

---

### Task 1: 범위 결박 예산 read owner

**Interfaces:** `load_scoped_budget_source(engine: Engine, project_id: str, environment_id: str) -> ScopedBudgetSource`; 결과의 `budget_ids: tuple[str, ...]`, `reservation_ids: tuple[str, ...]`, `snapshot(budget_id) -> BudgetSnapshot`, `reservation(reservation_id) -> BudgetReservation`. `OperationsSources.request_ids`는 비워 두며 dispatch receipt를 꾸며내지 않는다.

- [ ] `test_operations_budget_read.py`에 빈 범위, 자기 범위 정확 금액/토큰·상태, 다른 Project/Environment 차단, legacy/참조 불일치, 101개 초과, malformed/DB 오류, read-only transaction을 먼저 작성한다.
- [ ] 집중 test를 실행해 연결 부재의 예상 RED를 확인한다.
- [ ] 단일 read-only repeatable-read transaction에서 ledger/reservation을 각각 `LIMIT 101`로 읽고 Run/Task scope 및 ledger↔reservation Run 일치를 검증한다. `BudgetSnapshot`의 active/consumed 합계는 기존 `InMemoryInterventionBudgetRepository._snapshot_unlocked`와 같은 정의를 사용한다. 오류는 `BUDGET_SOURCE_UNAVAILABLE`만 노출한다.
- [ ] 집중 및 인접 persistence/budget 회귀를 GREEN으로 확인한다.

### Task 2: 고정 scope OIDC host 결선

**Interfaces:** Task 1 source를 현재 `load_queue_sources`의 scope 선검증과 Queue 성공 후에만 호출해 기존 `OperationsSources`의 budget owner와 두 ID tuple에 결박한다. `OperationsPort._SNAPSHOT_FIELDS` 및 browser contract는 변경하지 않는다.

- [ ] host test에 무자료 `[]`, 실제 범위 자료/Decimal 문자열, 다른 범위 미노출, scope/role403, Queue·Budget 오류503, Provider9행/Run3상태/Alert 기존 응답 보존의 예상 RED를 작성한다.
- [ ] focused RED를 확인한 뒤 `oidc_process.py`의 최소 결선만 작성한다.
- [ ] OIDC/F-13/Dashboard/Provider/Run 관련 회귀·compile·G-05·diff check를 GREEN으로 확인한다.

### Task 3: 동일 SHA 실제 PG15·결과

- [ ] opt-in 테스트는 전용 host/PG15 경계가 없으면 기본 `SKIP`이며 PASS로 세지 않는다. Main이 지정한 WSL-server 전용 checkout, PG15 tmpfs container, non-superuser role/DB, migration head `0019_oidc_sessions`에서만 실행된다.
- [ ] 실제 OIDC 앱 401→200→권한 철회403과 자기/타 scope 예산·예약, read-only, DB 전후 row 불변을 검증한다. fixture는 finally로 정확 row를 정리한다.
- [ ] Developer는 로컬 관련 suite와 결과보고서까지만 수행한다. Main은 exact6 diff/독립 review 후 기존 branch/private commit·push, 동일 SHA WSL opt-in과 관련 회귀를 실행하고 전용 자원만 신원 확인 후 삭제·잔여0을 기록한다.
- [ ] Main은 append-only write→worker lease를 회수한다. 결과와 WORK_STATUS에 실행 명령·exit·SKIP/미검증·rollback을 기록하되 예상 비용 초과 카드, Provider 실연결, C30 사고, U-01/F-20 전체 수락은 미완료로 둔다.
