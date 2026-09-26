# F-18 R35 OIDC same-origin HTTP WorkInstruction

- 담당: `developer-primary` 단일 제품 writer. Main의 canonical worker/write lease 발행과 G-05 확인 전 제품 write 금지.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 승인 F-18의 OIDC 제품 API 연결에 한정한다. 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, 시작 checkpoint seq1603. 새 인증 방식·권한·운영 배포는 추가하지 않는다.
- 제품 exact3: `packages/api/fastapi_app.py`, `tests/api/test_oidc_http.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. runtime, Web, DB/migration, Nginx, R30~R34 코어, LocalTestSession 변경 금지.
- 목표·HTTP 계약·TDD RED→GREEN·거부 사례·검증·rollback은 `F-18_WSL_OPS_R35_OIDC_HTTP_PLAN.md`를 따른다. 실제 issuer·Web callback·WSL E2E를 테스트 더블 PASS로 대체하지 않는다.
- 완료보고: 시작 HEAD/branch/status, 기준 문서 hash, 두 fencing token, exact3 diff, RED/GREEN·회귀·전체 pytest 명령과 종료 코드, 미실행/SKIP/BLOCKED, cookie/Origin/Host/CSRF/상태 연계 증거, 기존 동작 유지, 남은 위험, rollback, 오류 횟수, 제품 commit SHA. Main control/progress/HANDOFF·push·병합은 수정하지 않는다.
