# F-18 R40 live OIDC host QA WorkInstruction

- 담당: `developer-primary` 단일 writer. Main의 새 canonical worker/write lease·G-05 확인 전 제품 write 금지.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, F-18 기본 WorkInstruction 및 R39 seq1628 checkpoint의 합성 live OIDC host 검증 단계다. 제품 인증·Secret 저장·배포 계약을 바꾸지 않는다.
- exact3: `tests/integration/f18_oidc_live_host.py`, `tests/integration/test_f18_oidc_live_host.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 제품 runtime/ASGI, Web, DB/migration, Compose, Secret 파일과 Main control/progress/HANDOFF는 수정하지 않는다.
- 목표·계약·RED→GREEN·검증·자원 수명/정리·rollback은 `F-18_WSL_OPS_R40_LIVE_OIDC_HOST_PLAN.md`를 따른다. QA 합성 issuer/SQLite/루프백 HTTPS PASS를 정식 WSL 격리 운영 유사 target·PG18·브라우저·Production PASS로 승격하지 않는다.
- 완료보고: 시작 HEAD/branch/status, 기준 문서 hash, 두 fencing token, exact3 diff, RED/GREEN·회귀·bare full pytest 명령/exit, SKIP/BLOCKED, listener/TLS/temp/DB 정리, 잔여 위험, rollback, 오류 횟수, 제품 commit SHA. Main이 push·WSL·lease 회수를 소유한다.
