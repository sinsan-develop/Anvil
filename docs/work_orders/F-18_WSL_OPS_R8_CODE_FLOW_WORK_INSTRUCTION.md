# F-18 WSL 운영 유사 R8 WorkInstruction — OIDC code-flow transaction

- `F-18_WSL_OPS_R8_CODE_FLOW_PLAN.md`의 목적·인터페이스·수락 경계를 따른다. 승인된 설계/계획의 OIDC·step-up 중 authorization-code/PKCE 내부 단위이며 같은 단일 branch를 유지한다.
- canonical R8 worker/write lease의 epoch6 token과 exact3을 확인한 뒤 `packages/api/oidc_code_flow.py`, `tests/api/test_oidc_code_flow.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`만 수정한다. 기존 R7 verifier와 runtime·웹·session/permission, DB schema, deploy 파일은 변경하지 않는다.
- HTTPS 고정 authorization endpoint, 고정 client_id/redirect_uri, 요청별 분리된 32-byte state·nonce·PKCE S256 verifier, 300초 pending TTL, browser state 상관관계, 원자적 consume/재생 거부를 구현한다. token 교환은 주입 port만 호출하고 반환 ID Token을 R7 verifier로 검증한다. 저장된 요청 목적만 step-up을 결정한다. 오류에 token/state/nonce/verifier/code/endpoint를 노출하지 않는다.
- fake pending store/transport는 테스트에서만 구현한다. 제품의 in-memory store를 운영 구현으로 추가하거나 실제 네트워크를 연결하지 않는다. TDD RED→GREEN, 로컬 잠금 회귀·전체 pytest 시도·diff-check·clean commit 후 Main에 보고한다. Main만 push, WSL QA, progress/HANDOFF를 처리한다.
- 실제 issuer discovery·HTTP token exchange·durable store·API/session/cookie·브라우저/step-up endpoint 실측은 후속 단위다. R8 단위만으로 OIDC capability나 F-18 전체 PASS라 하지 않는다. rollback은 exact3 제품 commit revert다.
