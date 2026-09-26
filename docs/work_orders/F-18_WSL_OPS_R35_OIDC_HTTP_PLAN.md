# F-18 R35 OIDC same-origin HTTP adapter 계획

> 승인된 F-18 OIDC 인증 범위의 다음 내부 Stage. 기준은 설계서 §49.8, F-18 작업계획·WorkInstruction, R30~R34 계약과 seq1603 checkpoint다. 새로운 인증 방식이나 운영 배포를 추가하지 않는다. R35는 FastAPI 주입 경계와 HTTP 계약만 구현하며 runtime 환경 결선, 실제 issuer, Web callback 화면, WSL 통합 배포와 Production은 후속으로 분리한다.

**목표:** 검증된 R34 coordinator를 same-origin `/auth/oidc/*`에서만 사용할 수 있게 하되, Host·Origin·CSRF·cookie·오류 비식별 경계를 유지한다. OIDC coordinator가 명시적으로 주입되지 않으면 새 경로는 노출하지 않고 기존 `LocalTestSessionService`와 `/auth/session/status` 동작을 보존한다.

**제품 exact3:** `packages/api/fastapi_app.py`, `tests/api/test_oidc_http.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Developer 단일 writer는 canonical worker/write lease가 유효해진 뒤 이 세 파일만 수정한다. Main은 control/progress만 소유한다.

## HTTP 계약

- `create_app(..., oidc_session_coordinator: OidcSessionCoordinator | None = None)`의 명시적 주입만 허용한다. `session_issuer`와 동시 활성화는 fail-closed한다. `authenticate`와 다른 인증자로 인해 OIDC 발급 cookie가 무효화되지 않도록 주입 시 coordinator의 `authenticate`를 사용하고, `trusted_read_principal`로 인증 실패를 가리지 않는다. 기존 기본값은 바꾸지 않는다.
- `POST /auth/oidc/authorization`: 유효한 Host와 필수 동일 출처 Origin을 먼저 검사한다. JSON object는 선택적 `require_step_up: bool`만 받으며 예상 외 필드·비정상 타입·과대 body는 거부한다. `coordinator.begin`의 HTTPS authorization URL과 browser_state를 JSON으로 반환한다. state는 URL query와 browser_state에만 있고 로그·예외·캐시에 남기지 않는다. 브라우저는 browser_state를 세션 전용 저장소에 보관할 후속 Stage 책임이다.
- `POST /auth/oidc/callback`: Host·동일 출처 Origin을 검사하고 `{code,state,browser_state}`의 정확한 문자열 입력만 허용한다. `coordinator.complete` 성공 시 R34 bearer를 기존 `build_session_cookie`의 Secure/HttpOnly/SameSite=Strict, 최대 900초로 설정하고 CSRF·expiry만 JSON에 반환한다. code/state/bearer는 응답 body·request ID·오류·로그에 반영하지 않는다. IdP의 top-level redirect는 이 POST를 직접 수행하지 않으며 후속 Web callback이 same-origin POST를 담당한다.
- `POST /auth/oidc/logout`: Host·동일 출처 Origin·유효한 session cookie와 `X-CSRF-Token`의 constant-time 일치를 확인한 뒤 해당 세션만 revoke하고 동일 cookie path를 Max-Age=0으로 지운다. malformed/미인증/CSRF 불일치에서는 revoke하지 않는다. coordinator 내부 불능은 성공으로 숨기지 않는다.
- R34 `OIDC_SESSION_NOT_AUTHORIZED`/`NOT_AVAILABLE`을 고정된 비식별 API 오류로 매핑한다. 미처리 예외의 원문을 HTTP로 반사하지 않는다. 인증 mutation은 `Cache-Control: no-store`와 기존 security headers/CORS 계약을 유지한다.

## TDD와 검증

1. 기존 FastAPI/session 회귀를 기준선으로 실행한다. 새 주입·세 경로의 정상/거부/동시 구성·상태 연계 테스트를 먼저 RED로 확인한다. HTTP 테스트는 실제 R34 coordinator 또는 명시적 test double로 호출·쿠키·오류를 관찰하며 단순 문자열 검색으로 PASS를 만들지 않는다.
2. 최소 구현 후 targeted `tests/api/test_oidc_http.py`, 기존 `tests/api/test_local_session.py`, `tests/api/test_runtime_app.py`, R34 coordinator test를 실행한다. 전체 pytest는 별도 시도하고 기존 collection 오류를 새 실패와 구분한다. `git diff --check`와 독립 review Critical/Important 0을 확인한다.
3. Main이 제품 SHA를 지정 SSH 원격에 push하고 `ssh WSL-server`에서 clean detached 같은 SHA의 scoped 테스트만 반복한다. 임시 checkout·venv·pytest temp는 생성 전 이름·소유·수명·정리 계획을 WORK_STATUS에 쓰고 exact 대상만 정리한다. 이 테스트는 실제 issuer, Web callback, 브라우저 Network, PostgreSQL coordinator 결합, 정식 WSL E2E를 증명하지 않는다.
4. Main이 증거 확인 후 write→worker lease를 회수하고 G-05·원격 checkpoint를 확인한다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`를 유지한다.

**Rollback:** R35 제품 commit만 정상 revert한다. DB migration·기존 session 행·실제 issuer 설정·운영 환경은 변경하지 않는다.
