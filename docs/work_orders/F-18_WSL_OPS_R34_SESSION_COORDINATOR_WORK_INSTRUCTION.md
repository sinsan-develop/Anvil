# F-18 R34 OIDC session coordinator WorkInstruction

- 담당: `developer-primary` 단일 writer. Main은 canonical worker/write lease 발행·검증 후 exact3 제품 write를 위임한다.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 승인 F-18 OIDC 검증의 내부 결합 Stage다. 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`; 공개 API·기능 범위·운영 권한 확대 없음. R33 checkpoint seq1598을 기준으로 R34 coordinator만 구현하고 API는 후속 Stage로 둔다.
- 제품 exact3: `packages/api/oidc_session_coordinator.py`, `tests/api/test_oidc_session_coordinator.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 다른 제품 파일, runtime/FastAPI/Web/migration/LocalTestSession 변경 금지.
- 목표·인터페이스·TDD RED→GREEN·거부 사례·검증·rollback은 `F-18_WSL_OPS_R34_SESSION_COORDINATOR_PLAN.md`를 따른다. 기존 R30~R33 제품 계약을 읽기 전용으로 사용한다.
- 보고: 시작 HEAD/branch/status, 기준 hash와 두 fencing token, exact3 diff, RED/GREEN·회귀·전체 pytest 명령/exit/결과, WSL-server same-SHA 결과(수행 시), 미검증 issuer/API/browser/Production, 기존 기능 유지·rollback·오류 횟수를 F-18 보고서에 누적한다. Main control/progress/HANDOFF·push는 수정하지 않는다.
