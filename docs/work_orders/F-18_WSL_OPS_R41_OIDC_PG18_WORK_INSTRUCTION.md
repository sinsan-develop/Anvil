# F-18 R41 OIDC PG18 integration WorkInstruction

- 담당: `developer-primary` 단일 writer. Main의 신규 canonical worker/write lease와 G-05 확인 전 제품 write 금지.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`; F-18 기본 WorkInstruction 및 R40 seq1633 checkpoint의 후속 내부 검증이다. OIDC 인증 정책·Secret 저장·공개 API·DB schema를 바꾸지 않는다.
- allowed_paths exact5: `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `tests/integration/f18_oidc_live_host.py`, `tests/integration/test_f18_oidc_pg18.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Main control/progress/HANDOFF, Web, migration/Compose, Secret 파일 수정 금지.
- 목표, 기존 0013/0016 회귀 보호, RED→GREEN, opt-in PG18 guard, 검증·자원 수명·rollback은 `F-18_WSL_OPS_R41_OIDC_PG18_PLAN.md`를 따른다. 로컬 PG18 SKIP이나 SQLite PASS를 실제 PG18 PASS로 승격하지 않는다.
- Developer는 로컬 구현·기본 검증·보고서와 제품 commit까지만 수행한다. Main이 push, WSL-server 전용 PG18 생성/검증/정리, 독립 검토와 lease 회수를 소유한다.
- 완료보고: 시작 HEAD/branch/status, 문서 hash, 두 fencing token, exact5 diff, RED/GREEN·회귀·bare full pytest 명령/exit, SKIP/BLOCKED, Secret 비노출·임시자원 정리, 잔여 위험, rollback, 오류 횟수, 제품 commit SHA.
