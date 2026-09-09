# C-21 WSL Acceptance Auth 독립 리뷰

## 판정

- 결과: `COMPLETED`
- 리뷰 대상: branch `codex/c21-wsl-acceptance-auth-r1`, base HEAD `676786eb51e93280aef029b67f2725b847e068a2`
- 검토 방식: 제품 파일은 읽기 전용으로 유지하고 이 리뷰 보고서만 작성했다.
- 결론: blocking finding은 없다. WSL acceptance 인증은 기본 비활성이고 지정된 WSL marker·private/loopback authority·manifest-bound test scope가 모두 있어야 활성화된다. Cookie 없는 trusted principal은 canonical Provider GET 3개와 allowlisted Run SSE GET 1개에서만 사용된다.

## 기준 계약

- 설계서 §18.1: 초기 단일 사용자도 인증 경계를 유지하고 운영 배포는 OIDC 또는 동등한 인증을 사용한다.
- 설계서 §49.8: same-origin은 인증 대체가 아니며 API는 매 요청마다 project/environment/role 권한을 확인한다.
- 작업계획서: `local owner session -> ysna-server 운영 OIDC·step-up authentication`을 분리하고 브라우저 Network에는 내부 주소와 secret이 없어야 한다.
- 이번 변경 목표: WSL Acceptance에서만 default-off server-trusted read identity를 허용하고 Provider 조회와 명시 Run SSE 이외의 권한을 부여하지 않는다.

## 확인된 보안·권한 경계

### 1. Default-off와 WSL 환경 제한

- `ANVIL_AUTH_MODE`가 없으면 `COOKIE`가 기본이며, cookie 없는 Provider GET은 401이다.
- 허용 mode는 `COOKIE`, `WSL_ACCEPTANCE`뿐이고 다른 값은 startup에서 거부된다.
- `WSL_ACCEPTANCE`는 `ANVIL_RUNTIME_ENVIRONMENT=WSL_SERVER_TEST_STAGING` exact match가 아니면 startup에서 거부된다.
- `ANVIL_PUBLIC_HOST`는 IP literal이어야 하고 private/loopback 범주가 아니면 거부된다. `ANVIL_CONSOLE_BASE_URL` hostname도 이 IP와 같아야 한다.
- `anvil.sinsan.kr`, public/mismatched/DNS authority 및 `PRODUCTION`, `ORACLE_CLOUD_ACCEPTANCE`, 빈 값, 공백이 붙은 WSL marker가 모두 적대적 테스트에서 거부된다.
- WSL mode는 manifest-bound `ANVIL_TEST_SESSION_*` 구성이 없으면 startup에서 거부된다.

### 2. Trusted principal 최소 권한

- principal은 서버 내부에서만 생성되며 actor는 `server:wsl-acceptance`, role은 `wsl_acceptance_reader`다.
- permission은 `provider:read`, `run:events:read` 두 개뿐이고 project/environment는 test session config의 exact scope 한 개다.
- trusted fallback을 전달하는 endpoint key는 다음 네 개로 코드에서 고정됐다.
  - `GET /api/providers`
  - `GET /api/providers/{providerId}`
  - `GET /api/providers/{providerId}/models`
  - `GET /api/runs/{id}/events`
- Provider mutation과 그 밖의 registry endpoint에는 trusted principal 자체가 전달되지 않는다. Cookie가 없으면 권한 검사 전 401이다.
- Run SSE는 `ANVIL_TEST_SESSION_RUN_IDS`에 포함된 ID만 resolver가 scope를 반환한다. 다른 Run은 `AUTHORIZATION_SCOPE_UNRESOLVED` 403이다.

### 3. Secret·actor 우회 차단

- 브라우저는 `/auth/session/status`를 포함한 same-origin 상대 경로만 호출하며 `credentials: include` 외에 Authorization/Bootstrap/API key를 보내지 않는다.
- WSL acceptance 화면 진입에는 browser secret이 필요 없다. bootstrap token은 server environment의 local test session 구성 검증에만 남고 HTML·JS·session status 응답에 노출되지 않는다.
- `actor_role`, `actor`, `token` query와 `x-actor-id`, `x-actor-role` header를 주입해도 server-generated principal이 바뀌지 않는다.
- `/auth/session/status` 응답은 `authenticated`, `mode`, `actor_role` 세 필드뿐이고 공통 security middleware가 `cache-control: no-store`를 적용한다.
- 변경된 production browser 코드에는 localhost, Docker 내부 주소, API key, bootstrap token 또는 Bearer credential 추가가 없다.

### 4. Fixture와 화면 표시

- production header의 정적 `AUTHENTICATED · SAME ORIGIN`은 `CHECKING · SAME ORIGIN` 초기 상태와 `/auth/session/status` 기반 동적 표시로 대체됐다.
- production sidebar의 fixture link는 제거됐다.
- `/fixture-workbench`와 `/fixture-workbench.html`은 기본 404이고 명시적 fixture flag가 있을 때만 제공된다.
- 401은 `AUTHENTICATION_REQUIRED`, 403은 `PERMISSION_DENIED`로 분리되어 사용자에게 표시된다.

## Findings

### MINOR-1 — Client session schema가 authenticated/role 의미 조합을 교차 검증하지 않는다

- 근거: `normalizeSessionStatus`는 타입과 exact key는 검사하지만 `authenticated=true, actor_role=null` 및 `authenticated=false, actor_role='owner'` 같은 모순 조합을 허용한다.
- 영향: 현재 server 응답은 일관되며 권한 결정은 전부 server-side라 보안 우회는 없다. 향후 응답 계약 회귀 때 header가 `null` role 또는 모순된 로그인 상태를 표시할 수 있다.
- 권장 조치: 후속 UI hardening에서 authenticated=true이면 canonical non-empty role, false이면 role=null을 강제하는 테스트를 추가한다.

### MINOR-2 — Private IP 판정이 RFC1918보다 넓다

- 근거: Python `ipaddress.is_private`는 현재 runtime에서 `0.0.0.0`, link-local, documentation/reserved 대역 일부도 true로 분류한다.
- 영향: public DNS hostname은 이미 차단되고 현재 지정 WSL IPv4 `172.27.253.53`은 정상 범위다. 다만 오류 메시지의 “private or loopback” 의미보다 허용 집합이 넓어 잘못된 test authority를 더 일찍 거부하지 못할 수 있다.
- 권장 조치: 후속 startup hardening에서 loopback 또는 RFC1918 IPv4만 명시적으로 허용하고 unspecified/link-local/reserved/multicast를 적대적 테스트로 고정한다.

두 finding은 현재 요구된 production 차단, read-only 범위, Run allowlist 또는 secret 비노출을 깨지 않으므로 blocking으로 판정하지 않았다.

## pytest 종료 지연 원인

- 재현: 신규 API 단일 테스트가 `PASSED`를 출력한 뒤 pytest process가 종료되지 않았다.
- faulthandler 증거: main thread가 `_pytest/cacheprovider.py::pytest_sessionfinish -> _ensure_cache_dir_and_supporting_files -> tempfile.mkdtemp`에서 대기했다.
- 원인 판정: TestClient/ASGI teardown이나 제품 thread가 아니라 pytest cache provider가 이 `D:\tmp` worktree에 cache support directory를 만들려다 현재 sandbox filesystem 경계에서 멈춘 환경 문제다. worktree에는 `.pytest_cache`가 존재하지 않았다.
- 분리 검증: `-p no:cacheprovider`로 같은 단일 테스트는 `1 passed in 1.16s`, exit 0으로 즉시 종료했다.
- 조치: 이 worktree의 검증 명령은 cache provider를 비활성화했다. 제품 코드 수정 사유가 아니다.

## 실행 명령과 결과

1. `git status --short --branch`, `git rev-parse HEAD`, `git diff --stat`, 전체 `git diff`
   - base HEAD와 tracked 변경 12개, developer/reviewer 보고서 2개 untracked를 확인했다.
2. faulthandler 단일 테스트 재현
   - 테스트 `PASSED` 후 pytest cacheprovider의 `tempfile.mkdtemp` 대기 traceback을 확인했다.
3. `D:\tmp\anvil-c21-operational-execution\.venv\Scripts\python.exe -m pytest -p no:cacheprovider -q tests/api/test_runtime_app.py tests/api/test_public_asgi_frontend.py tests/api/test_local_session.py tests/api/test_web_security.py tests/api/test_provider_status.py tests/api/test_sse_resume.py`
   - `71 passed in 3.38s`, exit 0.
4. `node --test apps/web/tests/*.test.mjs`
   - `21 passed`, fail 0, exit 0. 기존 module-type performance warning 1종만 있다.
5. authority/permission 적대적 재현과 source inspection
   - public/DNS/mismatched authority startup 거부, 다른 Run 403, mutation 401, query/header actor 주입 무효, exact trusted endpoint 4개를 확인했다.
6. 변경 제품 파일 secret/internal-address scan
   - browser product source에 bootstrap token, API key, Authorization/Bearer 또는 internal endpoint 추가 0건. Node 개발 server의 기존 loopback default와 테스트 fixture의 loopback 사용은 제품 browser endpoint 노출이 아니다.
7. `git diff --check`
   - PASS.

## 미검증

- 실제 WSL container·DB·브라우저 배포 검증은 이번 독립 코드 리뷰 범위에서 실행하지 않았다.
- Provider/Telegram 외부 호출은 실행하지 않았다.
- `COMPLETED`는 current diff의 독립 코드·계약 검토 판정이며 WSL 배포·사용자 인수 완료 판정이 아니다.

## 다음 조치

1. current diff를 안전한 candidate commit으로 고정한다.
2. WSL-server가 동일 exact commit을 Git fetch하여 정식 `anvil-web` 컨테이너만 교체한다.
3. 실제 화면에서 dynamic auth status, Provider 조회, allowlisted Run SSE/Last-Event-ID, 비허용 Run과 mutation 차단을 확인한다.
