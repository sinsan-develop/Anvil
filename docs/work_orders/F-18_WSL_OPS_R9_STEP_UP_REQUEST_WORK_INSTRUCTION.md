# F-18 WSL 운영 유사 R9 WorkInstruction — step-up 요청 계약

- `F-18_WSL_OPS_R9_STEP_UP_REQUEST_PLAN.md`의 목적·인터페이스·수락 경계를 따른다. canonical R9 worker/write lease의 epoch7 token과 exact4를 확인한 뒤에만 제품 파일을 수정한다.
- 허용 경로: `packages/api/oidc_identity.py`, `packages/api/oidc_code_flow.py`, `tests/api/test_oidc_code_flow.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 기존 runtime/web/session/permission, DB schema, Secret, deploy 및 control/progress/HANDOFF는 수정하지 않는다.
- 요청별 state·nonce·PKCE S256, 300초 pending TTL, browser state 상관관계, 원자적 consume/재생 거부는 유지한다. `require_step_up=True`에서만 고정 ACR essential claim과 `auth_time` essential claim, `max_age=300`을 issuer 요청에 넣는다. R7 verifier와 다른 ACR 공급원을 만들지 않고 반환 ID Token을 기존처럼 fail-closed 검증한다.
- 테스트에서 URL의 실제 query와 hand-checked JSON literal을 검사하며 낮은 ACR·stale 인증·ordinary unsolicited high-ACR을 거부한다. TDD RED→GREEN, 잠긴 관련 회귀와 전체 pytest 시도, diff-check, clean exact4 commit·완료보고까지 수행한다. Main만 push·WSL QA·control/progress를 처리한다.
- 실제 issuer/API/cookie/session/브라우저·Production은 미실행이다. R9 PASS만으로 F-18 전체 수락이나 OIDC 실측 PASS를 선언하지 않는다.
