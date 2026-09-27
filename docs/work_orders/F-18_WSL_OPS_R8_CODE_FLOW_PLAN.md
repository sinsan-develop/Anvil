# F-18 R8 OIDC Authorization Code + PKCE Implementation Plan

> **For agentic workers:** 승인된 F-18 범위와 canonical lease 안에서 developer-primary가 TDD로 실행한다. 별도 branch를 만들지 않는다.

**Goal:** WSL-server 격리 OIDC issuer 연결에 필요한 서버 측 일회성 authorization-code 요청·콜백 상관관계를 fail-closed로 구현한다.

**Architecture:** `OidcCodeFlow`는 HTTPS issuer authorization endpoint와 고정 client/redirect를 사용해 요청별 state·nonce·PKCE S256 verifier를 생성한다. caller가 제공한 원자적 `PendingAuthStore`에 state digest와 요청 목적을 저장하고, callback에서는 브라우저 결박 state를 대조한 후 단 한 번 consume한다. token 교환은 caller가 제공한 좁은 transport port로 실행하고, 응답 ID Token은 R7 `OidcIdTokenVerifier`로만 검증한다. 이 단위는 cookie/session/권한을 생성하지 않는다.

**Tech Stack:** Python 3.12+, 표준 `secrets`·`hashlib`·`urllib.parse`, 기존 PyJWT 기반 R7 verifier, pytest, `uv.lock`.

**Spec:** `Anvil_설계서_v2.md` §18.1/§49.8, `Anvil_작업계획서_v1.md` F-18, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md`; [OIDC Core Authorization Code Flow](https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth), [PKCE RFC 7636](https://www.rfc-editor.org/rfc/rfc7636).

## Global Constraints

- 현재 단일 `codex/f18-wsl-ops` branch를 유지한다. 로컬 개발→승인 SSH Git push→WSL-server exact Git checkout/Python3.12 테스트를 지킨다. `ysna-server`/Production은 대상이 아니다.
- R8 제품 exact3은 `packages/api/oidc_code_flow.py`, `tests/api/test_oidc_code_flow.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. R7 verifier와 기존 runtime/auth/session/permission/web route는 변경하지 않는다.
- 요청·토큰·state·nonce·PKCE verifier·client secret 원문을 로그·오류·보고서·Git에 기록하지 않는다. token endpoint·issuer URL은 token/header에서 동적으로 채택하지 않는다.
- 실제 issuer HTTP, durable pending store, cookie/session issuance, 권한 mapping, browser, step-up endpoint 실측은 후속 단위다. R8 단위 PASS로 F-18 인수나 OIDC capability PASS를 주장하지 않는다.

## Review Focus

- callback의 state와 브라우저 결박 state가 다르면 token 교환 없이 거부해야 한다.
- 상태가 만료되거나 소비됐으면 동일 code/state 재생을 거부해야 한다.
- PKCE verifier와 challenge는 요청별 독립·고엔트로피·S256이고 `plain`으로 강등되지 않아야 한다.
- token 응답에 ID Token이 없거나 R7 서명/issuer/audience/nonce 검증이 실패하면 신원 결과를 반환하지 않아야 한다.
- caller의 `require_step_up` 인수가 아니라 저장된 요청 목적만이 R7 step-up 요구를 결정해야 한다.

## Task 1: OIDC code-flow transaction

**Files:** 신규 `packages/api/oidc_code_flow.py`, 신규 `tests/api/test_oidc_code_flow.py`, 기존 `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:** `OidcCodeFlow(authorization_endpoint, *, client_id, redirect_uri, verifier: OidcIdTokenVerifier, pending_store, exchange_code, clock=..., random_bytes=...)`; `begin(*, require_step_up=False) -> OidcAuthorizationRequest(url, browser_state)`; `complete(*, code, state, browser_state) -> OidcIdentity`. `PendingAuthStore.put(state_digest: bytes, pending: PendingOidcRequest) -> None`와 `.consume(state_digest: bytes) -> PendingOidcRequest | None`는 원자적 일회성 port다. `exchange_code(code, code_verifier, redirect_uri, client_id) -> Mapping[str, object]`는 caller 소유 token transport이며 이 단위에 네트워크 호출은 없다.

- [ ] **Step 1: RED** — 메모리 fake store와 합성 RSA signer로 실제 `OidcCodeFlow.begin/complete`를 호출하는 테스트를 먼저 작성한다. 없는 모듈 import 실패를 확인한다. 기대 URL의 `response_type=code`, `scope=openid`, `state`, `nonce`, `code_challenge_method=S256`과 hand-computed SHA256 challenge를 검사한다.
- [ ] **Step 2: GREEN** — `secrets.token_bytes(32)` 기본값으로 state·nonce·verifier를 각각 생성하고 `base64url(SHA256(verifier_ascii))` challenge를 구성한다. state는 SHA-256 digest만 store key로 전달한다. 300초 TTL과 단일 consume을 적용한다.
- [ ] **Step 3: 거부 사례 RED→GREEN** — 다른 browser state·만료/재생·빈/잘못된 code·transport 오류·ID Token 누락/잘못된 nonce·일반 요청의 위조 step-up·step-up 요청의 부족 ACR/auth_time을 모두 실제 flow 호출로 거부한다. 실패 메시지는 고정 redacted 문자열만 사용한다.
- [ ] **Step 4: 회귀** — 잠긴 로컬 환경에서 신규 테스트와 `tests/api/test_oidc_identity.py`, `tests/api/test_local_session.py`, `tests/api/test_web_security.py`를 실행하고 전체 pytest도 시도해 결과/기존 실패를 보고한다. `git diff --check`와 exact3 path diff를 확인한다.
- [ ] **Step 5: 증거·커밋** — 로컬 실행 명령·exit·PASS/FAIL, 실제 issuer/API/WSL 미검증, rollback을 보고서에 기록하고 clean 제품 commit을 Main에 전달한다. Main만 push·WSL QA·progress/HANDOFF를 처리한다.

## 수락 경계

Main은 exact3 diff와 동일 게시 SHA의 WSL-server 잠긴 Python3.12 회귀를 독립 확인한다. `OidcCodeFlow`는 token transport와 durable pending store를 제공받는 내부 보안 단위일 뿐, 현재 runtime API/브라우저에서 호출되지 않는다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다.
