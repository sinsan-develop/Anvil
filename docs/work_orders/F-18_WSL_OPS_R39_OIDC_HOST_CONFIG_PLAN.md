# F-18 R39 OIDC host configuration Implementation Plan

> **For agentic workers:** 승인된 F-18 내부 Stage다. `developer-primary` 단일 writer가 canonical lease의 exact3 안에서 RED→GREEN을 수행하고 Main이 독립 검토·WSL 동일 SHA scoped QA를 소유한다. 단계별 실행은 현재 프로젝트의 단일 writer·lease 절차를 따른다.

**Goal:** 신뢰된 서버 호출자가 비밀이 아닌 OIDC host 설정을 구성해 R38의 명시적 ASGI factory에 안전하게 전달한다.

**Architecture:** `apps/api/anvil_api/asgi.py`에 `create_configured_oidc_asgi_app`를 추가한다. 이 함수는 읽기 전용 host environment의 `ANVIL_OIDC_ISSUER`, `ANVIL_OIDC_CLIENT_ID`, `ANVIL_OIDC_STEP_UP_ACR`만 받아 기존 console base URL에서 고정 callback path를 파생하고 `OidcRuntimeConfig`를 만든다. Pinned JWKS·principal policy·client-secret provider·DB Engine/session/resolver는 신뢰된 호출자가 명시적으로 주입하며 기존 `create_oidc_asgi_app`가 최종 검증과 결선을 수행한다. Module-level 기본 `app` 선택은 바꾸지 않는다.

**Tech Stack:** Python, FastAPI TestClient, SQLAlchemy SQLite, PyJWT/RSA, httpx.MockTransport, pytest.

**Spec:** `Anvil_설계서_v2.md` §49.11~49.12, `Anvil_작업계획서_v1.md` F-18, `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md`의 운영 유사 인증 경계, R37~R38 OIDC 제품 계약.

## Global Constraints

- 로컬 Windows에서 개발하고 지정 `development` SSH branch에 push한 동일 SHA만 `ssh WSL-server`의 전용 clean detached QA checkout에서 검증한다. `ysna-server`·Production은 작업 대상이 아니다.
- 유일한 branch `codex/f18-wsl-ops`를 유지한다. F-18 인수 전 새 branch·PR·main 병합 금지.
- 제품 exact3는 `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. 다른 제품 파일·Web·DB schema/migration·Compose·Secret 저장소·배포 변경 금지.
- 세 OIDC 환경값은 비밀이 아닌 server-only 설정이다. `ANVIL_OIDC_*` 중 이 셋 외의 키(특히 client secret/JWKS 값)는 시작 전에 고정 비식별 `OIDC_RUNTIME_NOT_CONFIGURED`로 거부한다. 필수 값은 printable ASCII·trimmed nonempty여야 하며 `ANVIL_CONSOLE_BASE_URL`에서 `/auth/oidc/callback`을 파생한다. 기존 R37/R38 URL·JWKS·policy·host/DB guard를 우회하지 않는다.
- 실제 JWKS 원격 조회·Secret 파일/환경 로더·module-level OIDC 활성화·TLS/Compose·실제 issuer/PG18·Web callback/브라우저는 R39 밖이다. 합성 TestClient PASS를 정식 운영 유사 통합 PASS로 승격하지 않는다.

## Review Focus

- 누락·공백·control 문자·unknown `ANVIL_OIDC_*`는 앱/라우트 노출 전, 값 반사 없이 거부한다.
- `ANVIL_OIDC_CLIENT_SECRET`/`ANVIL_OIDC_JWKS_JSON`을 환경에 넣어도 읽거나 로그/오류로 반사하지 않고 거부한다.
- HTTPS console origin에서 고정 callback URI만 파생하며 origin/port mismatch와 test-session 혼합은 기존 R38/R36 경계에서 거부한다.
- 주입한 secret provider는 앱 구성·authorization 때 미호출, code exchange에서만 호출되며 pinned JWKS와 policy는 신뢰된 입력으로 유지한다.
- 기본 `app`와 COOKIE/WSL_ACCEPTANCE 경로가 새 명시적 factory로 암묵 변경되지 않는다.

## Task 1: server-only OIDC host configuration assembly

**Files:** Modify `apps/api/anvil_api/asgi.py`; modify `tests/api/test_oidc_asgi_binding.py`; append `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:** `create_configured_oidc_asgi_app(*, environment: Mapping[str, str], engine: Engine, session_factory: Callable, authorization_resolver: AuthorizationResolver, principal_policy: OidcPrincipalPolicy, pinned_jwks_json: str, client_secret: Callable[[], str] | None = None, ca_bundle: str | None = None, transport: httpx.BaseTransport | None = None, operational_shell: bool = False, frontend_directory: Path | None = None) -> FastAPI`. It creates `OidcRuntimeConfig` and calls existing `create_oidc_asgi_app`; no new HTTP endpoint.

- [ ] **Step 1 RED:** Add tests for missing/invalid three fields, forbidden/unknown `ANVIL_OIDC_*`, hostile console URL, mode/test-session mismatch, and non-reflective fixed error. Run targeted tests and observe expected function-absence FAIL.
- [ ] **Step 2 RED:** With existing real SQLite stores and signed/JWKS TestClient fixture, assert configured app OIDC mode, fixed callback redirect URI, ready 200, unchanged module-level `app`, and lazy secret provider at construction/authorization. Run and confirm feature-absence FAIL.
- [ ] **Step 3 GREEN:** Implement the minimal nonsecret parser and delegate to R38 factory. No environment mutation or Secret value materialization.
- [ ] **Step 4 verify:** Run new and R37/R38 related API/ASGI/persistence regression, bare full pytest collection attempt, and `git diff --check`. Name every non-green result; known 13 collection errors remain non-green until fixed.
- [ ] **Step 5 checkpoint:** Commit exact3 and return SHA, commands/exits, rollback and unverified real issuer/PG18/Web/WSL scope to Main. Main obtains independent Critical/Important review, pushes the same branch, repeats scoped tests in WSL-server clean detached exact SHA, records/cleans one-use QA resources, then revokes write→worker lease.
