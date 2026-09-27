# F-18 R7 ID Token 검증 Implementation Plan

> **For agentic workers:** 승인된 F-18 WorkInstruction과 canonical lease만 따라 단일 제품 writer가 수행한다. 각 단계는 테스트 RED→GREEN으로 검증한다.

**Goal:** WSL-server 격리 OIDC 인증의 첫 단위로, 신뢰 키가 사전 고정된 ID Token을 fail-closed 검증한다.

**Architecture:** 네트워크 접근 없는 `OidcIdTokenVerifier`가 caller 제공 신뢰 JWKS·고정 issuer/client ID와 요청별 nonce를 사용한다. 검증 결과는 식별자·최근 재인증 여부뿐이며 기존 cookie/session/권한 resolver에는 연결하지 않는다. 실제 issuer·API·step-up 경로의 관측은 후속 R8에서 같은 Git artifact로 확인한다.

**Tech Stack:** Python 3.12+, PyJWT 2.x, 기존 `cryptography`, pytest, `uv.lock`.

**Spec:** `Anvil_설계서_v2.md` §18.1/§49.8, `Anvil_작업계획서_v1.md` F-18, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md`.

## Global Constraints

- 같은 `codex/f18-wsl-ops` branch, Local 개발→승인 Git push→`ssh WSL-server` clean detached QA. `ysna-server`/Production 제외.
- 현재 `LocalTestSessionService`, `create_runtime_app`, 공개 API·cookie·권한 resolver는 변경하지 않는다.
- 제품 exact6은 `packages/api/oidc_identity.py`, `tests/api/test_oidc_identity.py`, `pyproject.toml`, `uv.lock`, `deploy/wsl/requirements-runtime.txt`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`만 허용한다.
- 신뢰 JWKS는 caller가 주입한다. token header의 `jku`/`x5u` 등에서 URL을 읽어 fetch하지 않는다. 실제 Secret·private key는 Git/보고서에 두지 않는다.

## Review Focus

- `alg=none`·HS256·header key URL로 신뢰 경계가 바뀌지 않아야 한다.
- 같은 `kid`가 중복되거나 잘못된 key type이면 성공 대신 거부해야 한다.
- issuer·audience·nonce·만료·발행 시각 변조는 서명이 맞아도 거부해야 한다.
- `auth_time`이 없거나 오래됐거나 미래면 step-up으로 승격하지 않아야 한다.
- 토큰의 role/project/scope 주장만으로 `SessionPrincipal` 또는 승인 권한을 생성하지 않아야 한다.

## Task 1: 고정 신뢰 ID Token verifier

**Files:** 위 exact6.

**Interfaces:** `OidcIdTokenVerifier(jwks_json, *, issuer, client_id, step_up_acr, clock=...)`; `verify(token, *, expected_nonce, require_step_up=False) -> OidcIdentity`. 반환값은 `subject`, `issuer`, `auth_time`, `acr`, `step_up_verified` 인증 사실만 포함하고 운영 권한은 포함하지 않는다. `issuer`는 고정 HTTPS 식별자, `client_id`·nonce는 canonical 비공백 문자열, JWKS는 1개 이상의 서로 다른 `kid`를 가진 RSA public signing key다. ID Token은 정확히 한 client audience만 허용한다. 시계 오차는 최대 30초, step-up `auth_time`은 현재로부터 300초 이내이며 미래 30초 초과는 거부한다.

- [ ] **Step 1: RED** — 테스트에서 RSA QA key로 ID Token을 생성하고 없는 `oidc_identity` import를 실패시킨다. 공개 key만 verifier에 주입한다. 테스트 private key는 매 실행 메모리에서 생성한다.
- [ ] **Step 2: GREEN** — PyJWT의 고정 `algorithms=["RS256"]`와 필수 `iss/aud/sub/exp/iat/nonce` 검증, 신뢰 JWKS의 단일 RSA signing `kid` 선택, 요청별 nonce 비교를 최소 구현한다. `jku`/`x5u`/embedded key header는 거부하고 네트워크 fetch는 없다.
- [ ] **Step 3: 거부 사례 RED→GREEN** — 알고리즘/키/issuer/audience/nonce/시간/step-up ACR·auth_time 및 오류 메시지 비밀 노출 여부를 실제 verifier 호출로 검사한다.
- [ ] **Step 4: 잠금·회귀** — `PyJWT>=2.8,<3` 직접 runtime 의존성과 lock, Web runtime pin을 일치시키고 기존 `tests/api/test_local_session.py`·`tests/api/test_web_security.py` 및 신규 테스트를 잠긴 환경에서 실행한다.
- [ ] **Step 5: 증거·커밋** — 보고서에 Local 범위·미검증 issuer/API/WSL·rollback을 기록하고 exact6 diff-check·clean commit을 Main에 전달한다. Main만 push·WSL 실측·control/progress 갱신을 한다.

## 검토·수락 경계

Main은 exact6 diff와 G-05, 같은 게시 SHA의 WSL-server 잠긴 Python3.12 단위 회귀를 확인한다. R7 verifier PASS는 실제 OIDC issuer·API 요청·세션 cookie·권한·step-up endpoint PASS가 아니며 F-18 `accepted=false`, F-19 차단을 유지한다.
