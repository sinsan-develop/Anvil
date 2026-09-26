# F-18 R42 OIDC process bootstrap implementation plan

> **For agentic workers:** 승인된 F-18 WorkInstruction의 단일 `developer-primary`가 exact4를 TDD로 구현한다. Main은 control·WSL 동일 SHA QA를 소유한다.

**Goal:** F-18 API process가 OIDC mode에서 신뢰된 서버 전용 설정을 결박해 기존 OIDC ASGI factory를 시작하고, COOKIE/WSL 기본 진입점은 그대로 유지한다.

**Architecture:** 기존 `asgi.py`의 함수·health/ready 구현과 기본 `app` 정의를 보존하고, 마지막 app 선택에서 OIDC mode에만 새 `oidc_process.py`의 신뢰 입력 로더를 사용한다. 로더는 서버 전용 JSON 문서와 별도 Secret 파일 경로를 strict allowlist·크기·경로 검사 후 기존 `create_configured_oidc_asgi_app`에 전달한다. 실제 Secret은 code exchange 시에만 읽으며, 오류는 비식별 고정 코드로 닫는다.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy, pytest.

**Spec:** `docs/work_orders/F-18_WSL_OPS_WORK_INSTRUCTION.md`, `Anvil_설계서_v2.md` §49.11~49.13, `Anvil_작업계획서_v1.md` F-18, approval `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`.

## Global Constraints

- 기존 `codex/f18-wsl-ops`, baseline `9d9bda6063887091fe154dd9cc11297e9ba9607f`; 새 branch/worktree 금지.
- Local 개발→commit·`development` push→`ssh WSL-server` exact SHA scoped QA. `ysna-server`/Production 실행 금지.
- 제품 exact4: `apps/api/anvil_api/asgi.py`, 새 `apps/api/anvil_api/oidc_process.py`, 새 `tests/api/test_oidc_process.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- `deploy/wsl/compose.f18.yml`, Dockerfile, DB schema/migration, Web, TLS/certificate, 실제 Secret·issuer 계정은 이 Stage에서 수정·생성하지 않는다.
- 실제 신뢰 설정은 후속 formal WSL target에서 전용 합성 자료로 만든다. 이 Stage의 파일 fixture는 보안/운영 credential 증거가 아니다.

## Review Focus

- OIDC mode에서 trust file 누락·symlink·상대 경로·초과 크기·unknown/누락 필드·잘못된 정책이 DB/route 구성 전에 거부되는가?
- client secret 원문이 오류·repr·로그에 반사되지 않고 code exchange 전에는 읽히지 않는가?
- `asgi.py`의 COOKIE/WSL module-level app과 기존 source/동적 import 계약이 변하지 않는가?
- OIDC 경로가 동일 Engine/session factory, DB의 issuer/subject binding 및 서버 소유 scope를 사용하고 0019 readiness를 유지하는가?
- `ANVIL_AUTH_MODE=OIDC`로 단순 전환한 경우 trust material 없이 조용히 COOKIE로 폴백하지 않고 startup을 거부하는가?

---

### Task 1: 엄격한 OIDC process 신뢰 입력과 선택적 진입점

**Files:** 새 `apps/api/anvil_api/oidc_process.py`, 새 `tests/api/test_oidc_process.py`; 수정 `apps/api/anvil_api/asgi.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:** `OidcProcessInputs`는 `principal_policy: OidcPrincipalPolicy`, `authorization_scope: AuthorizationScope`, `pinned_jwks_json: str`, `ca_bundle: str`, `client_secret: Callable[[], str]`를 담는 frozen dataclass다. `oidc_process.load_oidc_process_inputs(environment: Mapping[str,str]) -> OidcProcessInputs`는 전용 `ANVIL_F18_OIDC_TRUST_FILE`의 JSON을 strict parse한다. `oidc_process.create_oidc_process_app(environment: Mapping[str,str], host_factory: Callable[..., FastAPI]) -> FastAPI`는 단일 Engine/sessionmaker를 만들고 기존 `create_configured_oidc_asgi_app`에 전달하며 실패 시 Engine을 dispose한다. `oidc_process`는 `asgi`를 import하지 않는다.

Trust JSON의 exact key는 `pinned_jwks_json`(문자열), `allowed_roles`/`allowed_permissions`/`allowed_project_ids`/`allowed_environment_ids`/`scope_roles`(비어 있지 않은 문자열 배열), `scope_project_id`/`scope_environment_id`(문자열), `ca_bundle_file`/`client_secret_file`(absolute regular non-symlink 경로)다. issuer/client ID/step-up ACR 및 HTTPS console/public host는 이미 검증되는 기존 process environment에서 가져오며 JSON에서 중복 수용하지 않는다. Scope는 각 정책 집합 안에 있어야 한다. 읽은 JWKS/Secret 원문은 repr·예외·로그에 넣지 않는다.

- [ ] OIDC mode 기본 `asgi` import가 trust file 부재에서 안정적인 `OIDC_RUNTIME_NOT_CONFIGURED`로 실패하고 COOKIE/WSL 기본 경로는 기존대로라는 신규 테스트를 작성한다.
- [ ] trust file은 absolute regular non-symlink, 64KiB 이하 UTF-8 JSON object, exact key set만 허용하고 Secret은 별도 absolute non-symlink 파일에서 lazy 조회한다는 거부·허용 테스트를 작성한다. 정책·scope는 wildcard·빈 집합·불일치 거부를 요구한다.
- [ ] 신규 테스트를 실행해 기능 부재에 따른 RED를 확인한다. Secret 원문은 테스트 출력에 쓰지 않는다.
- [ ] `oidc_process.py`의 최소 로더·구성 함수를 구현하고 `asgi.py` 마지막 module-level app 선택에서 OIDC만 해당 경로를 사용한다. 기존 factory 함수·`create_asgi_app` 및 route/ready 본문을 이동하지 않는다.
- [ ] RED→GREEN 후 `tests/api/test_oidc_process.py`, `tests/api/test_oidc_asgi_binding.py`, `tests/api/test_public_asgi_frontend.py`, `tests/integration/test_f15_local_stack.py`, `tests/integration/test_f18_oidc_live_host.py`, `tests/deploy/test_ysna_scripts_contract.py`, `tests/deploy/test_ysna_deployment_contract.py`와 bare 전체 pytest를 실행해 결과를 구분한다.
- [ ] 변경 전·후 diff, 정확한 명령/exit, 미검증, Secret 비노출·rollback을 보고서에 기록하고 exact4만 commit한다.

Main은 제품 diff와 범위를 독립 검토하고 같은 SHA에서 WSL-server 격리 checkout의 scoped 회귀를 검증·정리한다. R42만으로 TLS/Compose/실제 issuer formal E2E를 PASS 처리하지 않는다.
