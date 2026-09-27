# F-18 R39 OIDC host configuration WorkInstruction

- 담당: `developer-primary` 단일 제품 writer. Main의 새 canonical worker/write lease·G-05 확인 전 제품 write 금지.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, F-18 기본 WorkInstruction 및 R38 seq1623 checkpoint의 내부 host 구성 단계다. 기능·요구사항·중요 위험을 넓히지 않는다.
- 제품 exact3: `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 다른 OIDC 코어, Web, DB/migration, deploy, Secret 파일과 Main control/progress/HANDOFF는 수정하지 않는다.
- 목표·계약·RED→GREEN·검증·rollback은 `F-18_WSL_OPS_R39_OIDC_HOST_CONFIG_PLAN.md`를 따른다. 합성 TestClient/SQLite/MockTransport를 실제 issuer·PG18·브라우저·정식 WSL 통합 PASS로 대체하지 않는다.
- 완료보고: 시작 HEAD/branch/status, 기준 문서 hash, 두 fencing token, exact3 diff, RED/GREEN·회귀·bare full pytest 명령/exit, SKIP/BLOCKED, Secret 비식별/기본 ASGI 경계, 잔여 위험, rollback, 오류 횟수, 제품 commit SHA. Main이 push·WSL·lease 회수를 소유한다.
