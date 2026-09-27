# F-18 R38 OIDC host binding Implementation Plan

> **For agentic workers:** 승인된 F-18 내부 Stage다. `developer-primary` 단일 writer가 canonical lease의 exact3 안에서 TDD RED→GREEN을 수행하고 Main이 독립 검토·WSL 동일 SHA 재검증을 소유한다. 설계 근거는 `Anvil_설계서_v2.md` §49.11~49.12, `Anvil_작업계획서_v1.md` F-18, `F-18_WSL_OPS_WORK_INSTRUCTION.md`, R35~R37의 OIDC 제품 계약이다.

**Goal:** 신뢰된 서버 호출자가 R37의 실제 DB-backed OIDC coordinator를 기존 `create_runtime_app`과 `create_asgi_app`에 단일 결선하도록 한다.

**Architecture:** `apps/api/anvil_api/asgi.py`에 명시적 `create_oidc_asgi_app` host factory를 추가한다. 입력은 고정된 `OidcRuntimeConfig`, 같은 SQLAlchemy `Engine`과 `session_factory`, 호출 가능한 업무 `AuthorizationResolver`, 읽기 전용 host environment이며, 테스트에서만 `httpx.BaseTransport`를 주입할 수 있다. 이 함수는 R37 factory→R36 runtime→기존 ASGI shell을 호출하지만 module-level 기본 `app` 선택·환경변수/Secret 파일 읽기·Compose·브라우저 코드는 바꾸지 않는다.

**Tech Stack:** Python, FastAPI TestClient, PyJWT/RSA, httpx.MockTransport, SQLAlchemy SQLite, pytest.

## Global Constraints

- 현재 작업은 Windows 로컬 개발→지정 `development` SSH branch push→`ssh WSL-server`의 clean detached 동일 SHA scoped QA다. `ysna-server`/Production은 실행하지 않는다.
- 유일한 branch `codex/f18-wsl-ops`를 유지한다. 새 branch·PR·main 병합은 F-18 필수 gate 완료 전 금지한다.
- 제품 exact3: `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 다른 제품 파일·DB schema/migration·Web·deploy·Secret 저장소 변경 금지.
- `create_oidc_asgi_app`는 `ANVIL_AUTH_MODE=OIDC`와 HTTPS `ANVIL_CONSOLE_BASE_URL`의 origin이 `OidcRuntimeConfig.redirect_uri`의 origin과 정확히 같고 `ANVIL_PUBLIC_HOST`가 그 host와 일치하는지 시작 전에 검사한다. 불일치·누락은 URL/Secret/JWKS를 반사하지 않는 고정 구성 오류로 거부한다. OIDC와 LocalTestSessionService 혼용은 기존 runtime 경계에서 거부한다.
- 실제 issuer/JWKS의 원격 조회, Secret 파일/환경 로더, PostgreSQL 18, module-level ASGI 활성화, Compose/TLS ingress, Web callback·브라우저 Network는 R38 밖이다. R38 PASS를 실제 OIDC 로그인/정식 WSL 운영 유사 통합 PASS로 승격하지 않는다.

## Review Focus

- OIDC가 아닌 host mode 또는 부분 test-session 변수: 앱/라우트 노출 전 거부.
- redirect와 console의 scheme·host·port mismatch: 앱/라우트 노출 전 비식별 거부.
- client secret provider: 앱 구성·authorization 때 호출하지 않고 code exchange 때만 호출.
- API와 ASGI shell의 같은 coordinator: 합성 서명 token으로 callback→opaque cookie→session status·권한 검사·logout을 실제 DB store에서 확인.
- 같은 DB `Engine`이 runtime readiness에 전달되고, 정상 migration head에서 `/health/ready`가 200이며 head 불일치에서는 503인지 확인.
- 기존 기본 `app`/COOKIE·WSL_ACCEPTANCE 경로: 명시적 OIDC host factory 추가로 암묵 변경하지 않음.

## Task 1: 명시적 OIDC ASGI host 결선

**Files:** Modify `apps/api/anvil_api/asgi.py`; create `tests/api/test_oidc_asgi_binding.py`; append `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces (R38 review revision):** `create_oidc_asgi_app(*, oidc_config: OidcRuntimeConfig, engine: Engine, session_factory: Callable, authorization_resolver: AuthorizationResolver, environment: Mapping[str, str], transport: httpx.BaseTransport | None = None, operational_shell: bool = False, frontend_directory: Path | None = None) -> FastAPI`. Validate that the injected engine is an `Engine` and the provided SQLAlchemy session factory is bound to that same engine before exposing routes. Pass `engine` to existing `create_runtime_app`. Calls existing `build_oidc_session_coordinator`, `create_runtime_app`, `create_asgi_app`. No new public HTTP endpoint or environment schema.

- [ ] **Step 1 RED:** Write tests for invalid mode/host/redirect origins and partial test-session config, proving fixed non-secret failure before any issuer exchange.
- [ ] **Step 2 RED:** Write an integration test using signed RSA/JWKS, real SQLite pending/directory/session stores and `httpx.MockTransport` only at token network boundary. Through the ASGI TestClient, assert authorization URL, callback, opaque cookie/session status, allowed and denied API scope, one-use state and logout revoke. A secret provider must remain lazy until exchange.
- [ ] **Step 3 GREEN:** Implement the minimal host factory with early non-reflective config validation, reuse the existing coordinator/runtime/shell composition, and leave module-level `app = create_asgi_app(create_runtime_app())` unchanged.
- [ ] **Step 4 verify:** Run the new test, related R35~R37/API/ASGI/persistence regression, bare full pytest collection attempt, and `git diff --check`. Name all failures; existing 13 collection errors remain non-green until actually fixed.
- [ ] **Step 5 checkpoint:** Commit exact3 and return SHA, actual commands/exits, rollback, remaining real issuer/PG18/Web/WSL scope to Main. Main obtains independent Critical/Important review, pushes same branch, repeats scoped tests in WSL-server clean detached exact SHA, records/cleans one-use QA resources, then revokes write→worker lease.

## Main nonsemantic review revision — 2026-09-26

독립 리뷰 Important 2건은 R38의 기존 host binding·fail-closed 목표를 구현상 완성하는 보완이다. 첫째, 기존 `create_runtime_app`은 외부 `session_factory`가 주입되면 자체 `engine`을 만들지 않아 readiness가 항상 503이었다. 신뢰된 호스트가 같은 DB Engine을 명시적으로 전달하고 정상 migration head의 ready 200·불일치 503을 테스트한다. 둘째, `urlsplit` 전에 URL 내부 제어문자를 거부하여 구성 단계에서 고정 비식별 오류가 발생하도록 한다. 이 revision은 제품 exact3·외부 HTTP 계약·DB schema·Secret·deploy·실제 issuer 범위를 변경하지 않는다. 기존 lease epoch22와 별도 human approval을 유지하되 Main이 근거와 변경 hash를 WORK_STATUS에 기록한다.
