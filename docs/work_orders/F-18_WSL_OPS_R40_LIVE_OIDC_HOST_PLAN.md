# F-18 R40 live OIDC host QA Implementation Plan

> **For agentic workers:** 승인된 F-18 내부 Stage다. canonical lease의 단일 `developer-primary`가 RED→GREEN으로 exact3를 구현하고 Main이 독립 리뷰·WSL-server 동일 SHA QA를 수행한다. 신산님 추가 승인을 반복하지 않으며 기능 범위·요구사항·중요 위험 변경 시에만 멈춘다.

**Goal:** R39의 명시적 OIDC ASGI factory를 합성 QA issuer와 함께 실제 루프백 HTTPS 서버에서 실행해 authorization→token exchange→callback·session 경계를 검증한다.

**Architecture:** 제품 runtime·모듈 기본 `app`·Compose·Secret 저장·인증 방식은 수정하지 않는다. `tests/integration/f18_oidc_live_host.py`는 격리된 SQLite migration/identity store, 일회성 자체서명 TLS와 RSA/JWKS, 실제 `uvicorn` issuer·API 루프백 서버를 소유하고 종료한다. `tests/integration/test_f18_oidc_live_host.py`는 실제 `httpx` 네트워크로 양 서버를 통과하며 R39 factory에 비밀이 아닌 host environment와 메모리 내 synthetic trusted inputs를 명시 주입한다. 모든 포트는 `127.0.0.1:0`에서 OS가 할당하고 실제 번호는 테스트 로그에 남긴다. WSL 동일 SHA 실행도 격리 QA일 뿐 정식 Compose/PG18 인수 증거는 아니다.

**Tech Stack:** pytest, FastAPI, uvicorn, httpx, SQLAlchemy SQLite, PyJWT, cryptography.

**Spec:** `Anvil_설계서_v2.md` §49.11~49.12, `Anvil_작업계획서_v1.md` F-18, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md` §인증·실제 증거, R37~R39 OIDC 제품 계약.

## Global Constraints

- 유일한 기존 branch `codex/f18-wsl-ops`를 유지한다. 새 branch·PR·main 병합은 F-18 인수 전 금지한다.
- 제품 exact3는 `tests/integration/f18_oidc_live_host.py`, `tests/integration/test_f18_oidc_live_host.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. 제품 runtime·`asgi.py`·Web·DB schema/migration·Compose·Secret 저장소·배포는 바꾸지 않는다.
- 외부 issuer·실제 Secret/계정·공개 주소를 사용하지 않는다. 합성 키/credential·일회성 TLS 파일은 각 테스트의 격리 temp 아래에서만 만들고, 서버는 loopback만 bind한다. 실제 token exchange는 `httpx.MockTransport` 없이 TLS 검증으로 통과한다.
- `ANVIL_AUTH_MODE=OIDC`, HTTPS console origin, 고정 callback, public host, singleton project/environment/role policy, 동일 DB Engine/session factory 결박을 유지한다. 기본 `app`과 COOKIE/WSL_ACCEPTANCE 경로를 변경하지 않는다.
- 프로세스·socket·temp/cert/키·DB를 `finally`에서 종료·삭제하고 테스트 후 잔류를 확인한다. 테스트 실패 시에도 다른 서비스·port·파일을 건드리지 않는다.
- 로컬 개발 뒤 안전한 commit·지정 원격 push, WSL-server 전용 clean detached 정확한 SHA 회귀 순서를 지킨다. WSL scoped PASS를 PG18·정식 운영 유사 target·Web 브라우저·Production PASS로 승격하지 않는다.

## Review Focus

- 테스트가 issuer/API를 실제 loopback TLS로 호출하는지, MockTransport·TestClient만의 false green이 아닌지.
- TLS 인증 실패·issuer/nonce/audience/서명 불일치·중복 state·잘못된 client secret이 고정 거부되고 token/secret이 오류·로그에 반사되지 않는지.
- authorization 시 secret provider 0회, token exchange 시 정확히 1회인지.
- 실패와 성공 양쪽에서 두 listener·thread·socket·certificate/key/temp·SQLite engine/session이 정리되는지.
- 실제 API Host/Origin/cookie/same-origin callback이 R38/R39 경계에 맞고 기본 `app`·WSL_ACCEPTANCE 회귀가 없는지.

## Task 1: loopback HTTPS OIDC host harness

**Files:** Create `tests/integration/f18_oidc_live_host.py`; create `tests/integration/test_f18_oidc_live_host.py`; append `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:** `run_live_oidc_host_flow(*, reject: str | None = None) -> LiveOidcEvidence` returns a frozen value with `issuer_url`, `api_url`, `authorization_status`, `callback_status`, `session_status`, `replay_status: int | None`, `secret_calls`, `issuer_token_requests`, `cleanup_verified`; it owns all temporary QA resources. `reject` accepts only `None | "bad_secret" | "wrong_nonce" | "wrong_audience" | "wrong_issuer" | "reused_state" | "invalid_tls"`. Do not return credential/token material.

- [ ] **Step 1 RED:** Add focused tests for successful HTTPS authorization→real token exchange→callback→session and each explicit rejection; import the absent harness and confirm expected module/function-absence FAIL.
- [ ] **Step 2 GREEN:** Implement the minimum live harness using R39 `create_configured_oidc_asgi_app`, real uvicorn listener pairs, generated synthetic keys/cert, real httpx TLS verification and existing SQLite OIDC store pattern. Do not change product code.
- [ ] **Step 3 verify:** Run new tests, R39 16-file API/persistence regression, bare full pytest collection attempt, and `git diff --check`. Record every non-green result and exact resource cleanup evidence.
- [ ] **Step 4 checkpoint:** Commit exact3 and return SHA, commands/exits, test outcomes, rollback and remaining PG18/Compose/Web/browser scope to Main. Main obtains independent Critical/Important review, pushes same branch, repeats new live tests plus selected regression in WSL-server clean detached same SHA, records/cleans one-use QA checkout, then revokes write→worker lease.
