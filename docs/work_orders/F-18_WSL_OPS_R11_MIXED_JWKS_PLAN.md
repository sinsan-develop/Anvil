# F-18 R11 Mixed-Use JWKS Compatibility Implementation Plan

> 담당: Main 통제 / developer-primary 단일 제품 writer. 승인된 F-18 OIDC 검증 범위의 실제 issuer 호환성 결함만 고친다.

**Goal:** Keycloak처럼 서명 키와 암호화 키를 함께 게시하는 JWKS에서 RS256 서명 키만 신뢰 후보로 사용하면서 기존 fail-closed 검증을 유지한다.

**Architecture:** `OidcIdTokenVerifier.__init__`는 JWK 배열에서 `use=sig`, `alg=RS256`, `kty=RSA` 후보만 보관한다. 비서명/비지원 알고리즘 키는 신뢰 후보로 사용하지 않는다. 후보가 하나도 없거나 후보 구조·개인키 필드·중복 `kid`가 잘못됐으면 전체 JWKS를 거부한다. 실제 ID Token의 `alg=RS256`·`kid`·서명·issuer/audience/nonce 검사는 그대로 유지한다.

**Tech Stack:** Python 3.12/3.13, PyJWT, pytest, WSL-server Keycloak 26.7.4 격리 QA.

**Spec:** `Anvil_설계서_v2.md` 49.8, `Anvil_작업계획서_v1.md` F-18, `docs/WORK_STATUS.md` 2026-09-25 실제 issuer QA root cause. Keycloak의 공개 JWKS는 RS256 signing RSA 1개와 RSA-OAEP encryption RSA 1개를 포함했다. 전체 입력은 현재 `OIDC_ID_TOKEN_NOT_VERIFIED`, signing subset은 수용됐다.

## Global Constraints

- 단일 branch `codex/f18-wsl-ops`; 제품 exact3 외 수정 금지. 로컬 개발·TDD → Main push → WSL-server exact SHA QA. `ysna-server`, Production, 기존 WSL 서비스·DB·사용자 credential 제외.
- 임의 `jku`·원격 키 동적 수용, 알고리즘 완화, EC/HMAC 신뢰, 개인키 JWK 수용, JWT claim/step-up/권한 의미 변경 금지.
- 비후보 키를 신뢰하지 않아야 하며, 유효 후보 최소 하나·후보 `kid` 유일성을 유지한다. 기존 암호화 키만 있는 JWKS 거부 테스트는 유지한다.

## Review Focus

- mixed `RS256 sig` + `RSA-OAEP enc` JWKS는 생성·정상 서명 검증 성공; `test_mixed_use_jwks_accepts_only_rs256_signing_key`.
- 암호화 키의 `kid`를 헤더에 쓴 토큰은 거부; 같은 테스트의 부정 분기.
- 후보 `kid` 중복·개인키 필드·잘못된 RSA 값은 enc 키가 섞여 있어도 거부; `test_mixed_use_jwks_rejects_malformed_signing_candidate`.
- `enc` 또는 비지원 signing alg만 있는 JWKS는 거부; `test_mixed_use_jwks_requires_rs256_signer`.
- 토큰의 HS256/none/jku/issuer/audience/nonce 거부와 step-up 판정이 기존 회귀에서 불변; 관련 기존 테스트 재실행.

## Task 1: 신뢰 후보 필터링

**Files:** Modify `packages/api/oidc_identity.py`, `tests/api/test_oidc_identity.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.

**Interfaces:** 기존 `OidcIdTokenVerifier(jwks_json, *, issuer, client_id, step_up_acr, clock)` 및 `verify(token, *, expected_nonce, require_step_up=False)` 유지. 새 공개 API 없음.

- [ ] **Step 1: 실패 테스트.** 기존 synthetic RSA 서명 키 fixture에 다음 실제 응답 shape를 추가하고 정상 토큰 검증·enc `kid` 거부를 검사한다. `enc` 키는 별도 RSA 공개키로 만들며 `use="enc"`, `alg="RSA-OAEP"`, 고유 `kid`를 부여한다.

```python
_, make, public, _ = signed  # 기존 test_oidc_identity.py의 signed fixture
other_public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(
    rsa.generate_private_key(public_exponent=65537, key_size=2048).public_key()))
signing = {**public, "kid": "key-1", "use": "sig", "alg": "RS256"}
encryption = {**other_public, "kid": "enc-1", "use": "enc", "alg": "RSA-OAEP"}
verifier = OidcIdTokenVerifier(json.dumps({"keys": [signing, encryption]}),
                                issuer=ISSUER, client_id=CLIENT,
                                step_up_acr="urn:anvil:step-up", clock=lambda: NOW)
assert verifier.verify(make(), expected_nonce=NONCE).subject == "user-1"
with pytest.raises(OidcTokenRejected):
    verifier.verify(make(headers={"kid": "enc-1"}), expected_nonce=NONCE)
```

- [ ] **Step 2: RED.** `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/api/test_oidc_identity.py -k mixed_use`에서 현 생성자가 정상 혼합 JWKS를 거부하는 실제 실패를 확인한다.
- [ ] **Step 3: 최소 구현.** JWK 순회 초기에 비후보를 건너뛰고, 후보는 기존 구조/개인키/중복 `kid` 검사를 그대로 실행한다. 순회 뒤 후보 dict가 비면 거부한다. 에러 메시지는 기존 `OIDC_ID_TOKEN_NOT_VERIFIED`만 사용한다.
- [ ] **Step 4: GREEN.** 동일 focused 테스트와 `tests/api/test_oidc_identity.py`, `tests/api/test_oidc_code_flow.py`, `tests/api/test_oidc_issuer_transport.py`, `tests/api/test_local_session.py`, `tests/api/test_web_security.py`를 실행한다. 잘못된 후보·암호화 키 only·비지원 signing alg·중복 `kid` 부정 테스트를 포함한다.
- [ ] **Step 5: 잠금·전체 검증.** 잠긴 로컬 환경의 위 회귀, `uv lock --check --offline`, `git diff --check`, 전체 pytest 시도를 실행한다. 기존 13 collection ERROR를 전체 PASS로 표시하지 않는다.
- [ ] **Step 6: 증거·commit.** 보고서에 시작 HEAD/branch/status·기준 hash·RED/GREEN·정확 명령/exit·diff·미검증(실 issuer 재QA/API/browser/Production)·rollback을 적고 exact3만 clean commit한다. Main이 독립 검토·push·WSL-server 동일 SHA QA·실제 issuer 재시험·종료 통제를 수행한다.

## Rollback

R11 exact3 제품 commit만 revert한다. 기존 R7~R10 검증기·transport 및 WSL 기존 서비스·DB는 변경하지 않는다.
