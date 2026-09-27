# F-18 R10 OIDC HTTPS Token Transport Implementation Plan

> 담당: Main 통제 / developer-primary 단일 제품 writer. 승인된 F-18 OIDC 중 고정 issuer의 authorization-code 교환만 구현한다.

**Goal:** R8 code-flow가 WSL-server의 실제 HTTPS issuer token endpoint와 안전하게 통신할 수 있는 서버 전용 교환 port를 제공한다.

**Architecture:** R8의 `exchange_code(code, code_verifier, redirect_uri, client_id)` 주입 port에 `OidcIssuerTransport.exchange_code`를 연결한다. 생성 시 issuer·token endpoint·client ID·redirect URI를 고정하고, 매 호출 시 code/PKCE verifier만 form POST한다. `httpx.Client`는 TLS 검증, `trust_env=False`, redirect 금지, 짧은 timeout을 적용한다. 응답은 상한·JSON shape를 확인해 `id_token`만 R8에 반환한다. 선택적인 confidential-client Secret은 호출 시 주입된 provider에서만 취득하며 로그·repr·예외에 남기지 않는다.

**Tech Stack:** Python 3.12/3.13, 기존 잠금의 `httpx==0.28.1`, pytest, WSL-server의 잠긴 Python3.12 및 격리 Keycloak QA.

**Spec:** `Anvil_설계서_v2.md` 18.1/49.8, `Anvil_작업계획서_v1.md` F-18, `docs/WORK_STATUS.md` R9 종료 seq1548. OIDC Core `https://openid.net/specs/openid-connect-core-1_0.html`, Keycloak 공식 관리 가이드 `https://www.keycloak.org/docs/latest/server_admin/`.

## Global Constraints

- 단일 branch `codex/f18-wsl-ops`; 제품 exact6 외 수정 금지. 로컬 개발·검증 → 승인 SSH alias push → WSL-server exact SHA QA.
- `ysna-server`, Production, 기존 WSL 서비스·DB, 실제 사용자 credential은 제외한다. 임시 QA 자원은 생성 전 이름·수명·정리를 기록하고 종료 후 잔류0을 증명한다.
- 고정 HTTPS issuer와 그 하위 token endpoint만 허용한다. 동적 discovery, `jku`/redirect, 시스템 proxy, TLS 검증 비활성화, 응답·예외의 code/token/Secret 출력은 금지한다.
- R7 서명·issuer/audience/nonce/ACR 검증과 R8 state/PKCE/원자 consume이 신원 판정의 유일한 근거다. transport 응답 자체로 session·role·permission을 만들지 않는다.
- `httpx`는 기존 dev lock에 있으나 runtime 직접 선언·WSL runtime pin이 필요하다. 버전 범위 확대나 lock 전체 무근거 재생성을 하지 않는다.

## Review Focus

- token endpoint가 다른 host, 다른 realm, HTTP 또는 URL userinfo/query/fragment면 네트워크 요청 전 거부: `test_rejects_unpinned_endpoint_before_network`.
- redirect/timeout/5xx/과대 body/중복 JSON key/비JSON/ID Token 누락이면 안정적인 redacted 오류만 반환: `test_rejects_untrusted_token_response`.
- Basic client Secret과 authorization code가 HTTP 요청 이외의 repr/오류 문자열에 노출되지 않음: `test_confidential_secret_and_code_are_redacted`.
- caller의 client ID·redirect URI가 생성 시 고정값과 다르면 요청 전 거부: `test_rejects_exchange_binding_mismatch`.
- 실제 R8 `OidcCodeFlow.complete`와 R7 verifier에서 정상 ID Token만 성공하고 낮은 ACR/nonce 불일치는 거부: `test_transport_connects_to_existing_code_flow`.

## Task 1: HTTPS exchange port와 runtime dependency

**Files:** Create `packages/api/oidc_issuer_transport.py`, `tests/api/test_oidc_issuer_transport.py`; modify `pyproject.toml`, `uv.lock`, `deploy/wsl/requirements-runtime.txt`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:**

```python
class OidcIssuerTransport:
    def __init__(self, *, issuer: str, token_endpoint: str, client_id: str,
                 redirect_uri: str, ca_bundle: str | None = None,
                 client_secret: Callable[[], str] | None = None,
                 transport: httpx.BaseTransport | None = None) -> None: ...
    def exchange_code(self, code: str, code_verifier: str,
                      redirect_uri: str, client_id: str) -> Mapping[str, object]: ...

class OidcIssuerRejected(ValueError): ...  # public string: OIDC_ISSUER_NOT_VERIFIED
```

- [ ] **Step 1: 실패 테스트 작성.** `httpx.MockTransport`를 사용하되 실제 `OidcIssuerTransport.exchange_code`를 호출한다. 고정 `https://issuer.example/realms/anvil`과 그 하위 `/protocol/openid-connect/token`, `https://app.example/auth/callback`, `anvil-web`을 사용한다. 정상 POST의 literal `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`, `client_id`와 `Accept: application/json`, redirect 미추적·proxy 미사용을 검증한다. `id_token`만 반환하며 `access_token`은 호출자에게 전달하지 않는다. 실패 행렬은 Review Focus의 각 입력을 파라미터화하고, 요청 횟수 0/1과 안정 오류 문자열을 검사한다.
- [ ] **Step 2: RED 확인.** `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/api/test_oidc_issuer_transport.py`가 새 모듈/계약 부재 때문에 의도대로 실패해야 한다.
- [ ] **Step 3: 최소 구현.** 생성 시 `urlsplit`로 고정 issuer와 token endpoint의 HTTPS·authority·realm prefix·userinfo/query/fragment 부재를 검증한다. `exchange_code`의 고정 client/redirect binding과 code/PKCE 형식을 확인한다. 매 호출마다 `httpx.Client(verify=ca_bundle or True, trust_env=False, follow_redirects=False, timeout=5.0, transport=transport)`를 열고 form POST한다. public client면 Secret header가 없고, confidential client면 provider 결과를 Basic header에만 쓴다. status 200·JSON content type·최대 65536 bytes·중복 key 없는 객체·길이 제한이 있는 nonempty `id_token`을 요구하고 나머지 필드는 버린다. HTTP/JSON/Secret provider 예외는 `OIDC_ISSUER_NOT_VERIFIED` 하나로 redaction한다.
- [ ] **Step 4: runtime 선언.** `pyproject.toml`의 `[project].dependencies`에 `httpx>=0.28,<1`을 이동하고 dev 그룹의 중복 직접 선언을 제거한다. `uv lock --check`로 잠긴 `httpx==0.28.1`을 유지한다. `deploy/wsl/requirements-runtime.txt`에 `httpx==0.28.1`을 추가한다. 불가피한 transitive lock 변경이 생기면 이유와 diff를 보고하고 Main 검토 전 범위를 넓히지 않는다.
- [ ] **Step 5: GREEN 및 회귀.** 동일 focused 테스트와 `tests/api/test_oidc_code_flow.py`, `tests/api/test_oidc_identity.py`, `tests/api/test_local_session.py`, `tests/api/test_web_security.py`, runtime declaration 관련 테스트를 실행한다. 잠긴 로컬 환경으로 재실행하고 전체 pytest도 시도한다. 전체 suite의 기존 collection ERROR는 별도 기록하고 PASS로 표시하지 않는다. `git diff --check`와 변경 exact6을 확인한다.
- [ ] **Step 6: 증거·commit.** 보고서에 시작 HEAD/branch/status, 설계·계획 hash, TDD RED/GREEN, 변경 diff, 실제 명령/exit, 미검증(실 issuer/API/browser/Production), rollback을 적고 exact6만 commit한다. Main이 독립 diff/회귀 후 push, WSL-server 동일 SHA QA, QA 자원 정리 및 canonical 종료 통제를 수행한다.

## Rollback

R10 exact6 제품 commit을 revert한다. R7~R9의 offline verifier/code-flow와 기존 local test session·DB·기존 WSL 서비스는 변경하지 않는다.
