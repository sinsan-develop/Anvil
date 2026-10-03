# F-20/U-01 R38B Budget Fixture Rework WorkInstruction

- 책임: 단일 `developer-primary`만 정확한 local test fixture writer. Main 어울은 canonical lease, Git, 독립 검증, WSL-server PG15 QA 및 종료 통제를 소유한다.
- 부모: 승인된 `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `docs/04_test_reports/F-20_U01_R38_SCOPED_BUDGET_SOURCE_PLAN.md`, R38 `INCOMPLETE` 결과보고서. 기능·요구사항·공개 계약·DB schema·권한은 변경하지 않는 비의미 테스트 fixture 보완이다.
- 재현: R38 WIP checkpoint `6e1826b8`의 관련 회귀 457P/7S/16F는 기존 SQLite host fixture가 새 PostgreSQL budget read source의 빈 관측을 주입하지 않아 fail-closed 503이 되는 동일 원인이다. 이 실패를 GREEN으로 보정하되 제품 DB 오류를 빈 성공으로 바꾸지 않는다.
- 제품 write lease exact6: `tests/observability/test_f20_u01_r17_run_host_binding.py`, `tests/observability/test_f20_u01_r36_agent_host_binding.py`, `tests/api/test_f20_u01_r9_oidc_queue_host.py`, `tests/api/test_f20_u01_r37_provider_host_binding.py`, `tests/integration/test_f20_u01_r37_provider_host_pg15.py`, `docs/04_test_reports/F-20_U01_R38B_BUDGET_FIXTURE_REWORK_RESULT.md`.
- 방법: 각 local SQLite host fixture에만 `load_scoped_budget_source`의 명시적 대역을 주입해 엔진·고정 Project/Environment 인자를 검사하고 `ScopedBudgetSource((), ())`를 반환한다. R37 PG15 실제 opt-in의 `_build_host`는 대역 처리하지 않는다. 기존 assertion, 실제 제품 source, auth·scope·Provider/Run/Agent 경계는 보존한다.
- 검증: 기존 16개 실패 node를 먼저 RED로 재현한 뒤 최소 fixture 수정, 원래 R38 전체 관련 명령과 focused/인접 회귀, R37 local/PG opt-in 기본 SKIP 분리, compile, G-05, diff check를 실행한다. opt-in 실제 PG15은 Main 소유로 SKIP을 PASS에 넣지 않는다.
- 금지: exact6 밖 파일 변경, Main progress/Event/HANDOFF/WORK_STATUS/control, commit·push, WSL-server·ysna/Production 접근, Secret/DSN 노출, DB schema/데이터·공개 API·UI·제품 예외 경로 변경.
- 완료보고: 새 epoch dual fencing token·기준 SHA/branch/status, 기준 문서·부모 결과 hash, exact6 diff, 명령/exit/실측/오류 횟수/SKIP·미검증/rollback을 판정→판단 이유→조치로 기록한다. 실패가 남으면 `INCOMPLETE`로 인계하며 임의 우회하지 않는다.
