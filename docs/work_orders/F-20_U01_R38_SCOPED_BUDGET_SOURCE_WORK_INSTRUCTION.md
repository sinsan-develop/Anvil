# F-20/U-01 R38 Scoped Budget Source WorkInstruction

- 책임: 단일 `developer-primary`만 제품 writer. Main 어울은 canonical lease·독립 검토·Git·WSL-server 실제 QA·종료 통제를 소유한다.
- 기준: 승인된 `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_PLAN.md`. 현재 `codex/f18-wsl-ops` 한 브랜치와 유효한 R38 canonical worker/write fencing token·exact6를 mutation 직전에 확인한다.
- 목적: 고정 OIDC Project/Environment scope의 PostgreSQL budget ledger/reservation을 bounded read-only owner로 읽고 기존 F-13 Dashboard `budget`/`reservations` 필드에 연결한다. `forecast_cost`는 예약값이며 미래 예상 비용 초과 카드 수치가 아니다.
- 제품 write lease exact6: `packages/persistence/operations_budget_read.py`, `apps/api/anvil_api/oidc_process.py`, `tests/persistence/test_operations_budget_read.py`, `tests/api/test_f20_u01_r38_budget_host_binding.py`, `tests/integration/test_f20_u01_r38_budget_host_pg15.py`, `docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_RESULT.md`.
- 금지: exact6 밖 제품/테스트/문서 수정, 공개 Dashboard field/route/권한/UI, DB schema·migration·지속 데이터, Secret/DSN 노출, 외부 Provider 호출, 실제 비용 발생, Main progress/Event/control/WORK_STATUS, commit·push, WSL-server·ysna/Production 접근. 다른 Project/Environment 자료나 legacy NULL environment를 합산하지 않는다.
- TDD: 현재 host의 `budget=[]`/`reservations=[]`를 실제 RED로 먼저 확인한다. 기존 `BudgetSnapshot` active/consumed 정의를 literal fixture로 검증하고, 다른 scope·ledger/reservation Run 불일치·legacy·101행 초과·malformed row·DB 실패는 부분 수치 없이 stable unavailable/503을 확인한다. 정확한 scope 판정 전에 DB read를 하지 않는다.
- 로컬 검증: 집중 owner/host test, 인접 budget/Operations/OIDC/Dashboard/Provider/Run 회귀, Python compile, G-05, diff check. opt-in 실제 PG15은 Main 소유로 로컬 기본 suite에서 명시 SKIP하며 PASS로 집계하지 않는다. PG fixture는 정확 row cleanup과 전후 불변 검사를 준비한다.
- 완료보고: Work Package/branch/착수 HEAD·Git status, 기준 문서 hash·dual token, exact6 diff, 명령/exit/실측·오류 횟수, SKIP/미검증, 기존 기능 영향, rollback, Main status 보존을 판정→판단 이유→조치로 기록한다. `COMPLETED`, 유효 `FAILURE_REPORT`, `INCOMPLETE`, `BLOCKED`를 구분한다.
