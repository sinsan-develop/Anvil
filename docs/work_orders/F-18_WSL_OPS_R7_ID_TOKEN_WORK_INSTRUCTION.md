# F-18 WSL 운영 유사 R7 WorkInstruction — ID Token 검증 단위

- 승인 설계/작업계획의 OIDC·step-up 중 첫 단위만 구현한다. 목적·제약·수락 경계는 `F-18_WSL_OPS_R7_ID_TOKEN_PLAN.md`를 따른다. 같은 단일 branch와 기존 checkout을 유지한다.
- canonical R7 worker/write lease의 epoch5 token과 exact6을 확인한 뒤 제품 파일만 수정한다. `packages/api/oidc_identity.py`, `tests/api/test_oidc_identity.py`, `pyproject.toml`, `uv.lock`, `deploy/wsl/requirements-runtime.txt`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md` 밖 제품 mutation은 금지한다.
- `OidcIdTokenVerifier`는 사전 주입된 JWKS의 단일 RSA signing key와 고정 RS256·HTTPS issuer·단일 client audience, 요청별 nonce, 필수 `iss/aud/sub/exp/iat/nonce`를 검증한다. 최대 30초 시계 오차 외에는 fail-closed다. step-up 요청은 현재로부터 300초 이내(미래 최대 30초)의 `auth_time`과 고정 ACR allowlist가 함께 맞을 때만 인정한다. 검증 실패는 token/키/endpoint를 노출하지 않는 오류로 거부한다. `jku`/`x5u`/embedded key header 및 token role/project/scope 주장으로 신뢰·권한을 확장하지 않는다.
- 기존 runtime/auth route/session/permission mapping은 이 Task에서 변경하지 않는다. 테스트는 신규 실제 verifier를 호출하며 합성 RSA key는 메모리 fixture에만 생성한다. TDD RED→GREEN, Local 잠금 설치·관련 회귀·diff-check·clean commit 후 Main에 보고한다. Main만 push, WSL QA, progress/HANDOFF를 처리한다.
- 실제 WSL issuer의 discovery·authorization code·cookie·API·step-up 관측은 후속 R8이다. R7 완료만으로 OIDC capability나 F-18 전체를 PASS라 하지 않는다. rollback은 exact6 제품 commit revert다.
