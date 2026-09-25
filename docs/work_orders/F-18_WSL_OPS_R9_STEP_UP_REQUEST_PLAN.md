# F-18 R9 Step-up Request Implementation Plan

> 담당: Main 통제 / developer-primary 제품 단일 writer. 승인된 F-18의 OIDC·step-up 중 인증 요청 계약만 보완한다.

**Goal:** 높은 인증을 요청한 트랜잭션만 issuer에 essential ACR과 최근 인증을 요청하며, 반환 ID Token의 높은 ACR·auth_time을 기존 R7 verifier로 검증한다.

**Architecture:** R7 verifier의 고정 `step_up_acr`을 읽기 전용 속성으로 공개해 R8 code-flow가 같은 단일 값을 요청·검증에 사용한다. `begin(require_step_up=True)`만 OIDC `claims`와 `max_age=300`을 URL에 더한다. `complete`의 one-use pending state·PKCE·nonce·서명 검증과 ordinary 요청의 비승격 규칙은 유지한다.

**Tech Stack:** Python 3.12/3.13, PyJWT(기존 lock), pytest, WSL-server의 잠긴 Python3.12 QA.

**Spec:** `Anvil_설계서_v2.md` 인증·step-up, `Anvil_작업계획서_v1.md` F-18, `docs/WORK_STATUS.md` R9 범위 결정. OIDC Core `https://openid.net/specs/openid-connect-core-1_0.html`; Keycloak step-up `https://www.keycloak.org/docs/latest/server_admin/`.

## Global Constraints

- branch는 `codex/f18-wsl-ops` 하나만 유지하고 제품 write lease exact4 밖을 수정하지 않는다.
- Local 개발 → 승인 Git alias push → WSL-server exact commit pull·격리 QA. `ysna-server`/Production은 제외한다.
- API·세션·권한·DB·Secret·실제 issuer·Docker는 이 단위에서 변경하지 않는다. R9 단위 PASS는 F-18 인수가 아니다.
- 오류 메시지에 code, token, state, nonce, verifier, issuer URL을 노출하지 않는다.

## Review Focus

- `require_step_up=False`에서 essential ACR 또는 `max_age`가 누출되지 않는가? `test_ordinary_request_does_not_ask_for_step_up`.
- `require_step_up=True`에서 ACR만 요청하고 최근 인증을 누락하지 않는가? `test_step_up_request_demands_essential_acr_and_recent_authentication`.
- 반환 토큰이 낮은 ACR 또는 오래된 `auth_time`이면 요청 URL이 높았어도 거부되는가? `test_saved_step_up_purpose_controls_verification` 확장.
- 보통 요청에 높은 ACR 토큰이 우연히 오더라도 `step_up_verified`가 false인가? 기존 ordinary 테스트 재실행.
- 요청 state/nonce/PKCE verifier와 URL challenge가 그대로 분리되고 일회성인가? 기존 R8 테스트 전체 재실행.

## Task 1: 고정 ACR 요청 계약

**Files:** `packages/api/oidc_identity.py`, `packages/api/oidc_code_flow.py`, `tests/api/test_oidc_code_flow.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interface:** `OidcIdTokenVerifier.step_up_acr: str`은 검증에 사용하는 고정 설정과 같은 값이다. `OidcCodeFlow.begin(require_step_up: bool)`은 높은 요청에만 `claims={"id_token":{"acr":{"essential":true,"values":[step_up_acr]},"auth_time":{"essential":true}}}`와 `max_age=300`을 추가한다.

- [ ] Step 1: 기존 fixture의 `require_step_up=True` 요청 URL을 parse하고 `claims` JSON literal·`max_age=["300"]`, ordinary 요청의 두 parameter 부재를 검사하는 실패 테스트를 먼저 작성한다. 반환 token의 낮은 ACR·stale `auth_time`도 같은 pending 목적에서 거부하는 테스트를 추가한다.
- [ ] Step 2: `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/api/test_oidc_code_flow.py`를 실행해 새 테스트의 의도된 RED를 확인한다.
- [ ] Step 3: verifier에 읽기 전용 ACR 속성을 두고 code-flow의 `begin`에서 높은 요청일 때만 canonical compact JSON `claims`와 `max_age`를 추가한다. verifier와 요청 설정의 중복 공급·임의 role mapping을 만들지 않는다.
- [ ] Step 4: 같은 focused 테스트 GREEN, R7 identity/local_session/web_security 관련 회귀, 잠긴 로컬 환경, 전체 pytest 시도, `git diff --check`를 실행하고 실제 결과·미검증을 보고한다.
- [ ] Step 5: exact4만 clean commit한다. Main이 독립 diff 검토·push·WSL-server 동일 SHA QA·임시자원 정리·canonical 종료 통제를 수행한다.

## Rollback

R9 exact4 제품 commit만 revert한다. 기존 issuer/API/DB/서비스·사용자 session은 이 단위에서 변경하지 않는다.
