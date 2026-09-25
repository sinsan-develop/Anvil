"""Offline, bounded token-endpoint transport contract."""

import json
import tomllib
from datetime import datetime, timezone
from pathlib import Path

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from packages.api.oidc_issuer_transport import OidcIssuerRejected, OidcIssuerTransport
from packages.api.oidc_code_flow import OidcCodeFlow, OidcCodeFlowRejected
from packages.api.oidc_identity import OidcIdTokenVerifier


ISSUER = "https://issuer.example.test/realms/anvil"
ENDPOINT = ISSUER + "/protocol/openid-connect/token"
REDIRECT = "https://app.example.test/auth/callback"
CLIENT = "anvil-web"
VERIFIER = "a" * 43


def make_transport(handler, **kwargs):
    return OidcIssuerTransport(
        issuer=ISSUER, token_endpoint=ENDPOINT, client_id=CLIENT,
        redirect_uri=REDIRECT, transport=httpx.MockTransport(handler), **kwargs,
    )


@pytest.mark.parametrize("endpoint", [
    "http://issuer.example.test/realms/anvil/protocol/openid-connect/token",
    "https://evil.example.test/realms/anvil/protocol/openid-connect/token",
    "https://issuer.example.test/realms/other/protocol/openid-connect/token",
    ENDPOINT + "?redirect=https://evil.example.test",
    ENDPOINT + "#fragment",
    "https://user:pass@issuer.example.test/realms/anvil/protocol/openid-connect/token",
])
def test_rejects_unpinned_endpoint_before_network(endpoint):
    calls = []
    with pytest.raises(OidcIssuerRejected, match="^OIDC_ISSUER_NOT_VERIFIED$"):
        OidcIssuerTransport(
            issuer=ISSUER, token_endpoint=endpoint, client_id=CLIENT,
            redirect_uri=REDIRECT,
            transport=httpx.MockTransport(lambda request: calls.append(request)),
        )
    assert calls == []


def test_rejects_url_controls_before_network():
    with pytest.raises(OidcIssuerRejected, match="^OIDC_ISSUER_NOT_VERIFIED$"):
        OidcIssuerTransport(
            issuer=ISSUER.replace("/realms", "\n/realms"),
            token_endpoint=ENDPOINT.replace("/realms", "\n/realms"),
            client_id=CLIENT,
            redirect_uri=REDIRECT,
            transport=httpx.MockTransport(lambda request: pytest.fail("unexpected network")),
        )


@pytest.mark.parametrize("response", [
    httpx.Response(302, headers={"Location": "https://evil.example.test"}),
    httpx.Response(500, text="secret failure"),
    httpx.Response(200, text="not json"),
    httpx.Response(200, headers={"Content-Type": "text/plain"}, text='{"id_token":"abc"}'),
    httpx.Response(200, headers={"Content-Type": "application/json"}, text='{"id_token":"a","id_token":"b"}'),
    httpx.Response(200, headers={"Content-Type": "application/json"}, json={"access_token": "secret"}),
    httpx.Response(200, headers={"Content-Type": "application/json"}, content=b" " * 65537),
])
def test_rejects_untrusted_token_response(response):
    transport = make_transport(lambda request: response)
    with pytest.raises(OidcIssuerRejected, match="^OIDC_ISSUER_NOT_VERIFIED$"):
        transport.exchange_code("sensitive-code", VERIFIER, REDIRECT, CLIENT)


def test_confidential_secret_and_code_are_redacted():
    requests = []

    def handler(request):
        requests.append(request)
        raise httpx.ConnectError("sensitive-code secret-value", request=request)

    transport = make_transport(handler, client_secret=lambda: "secret-value")
    with pytest.raises(OidcIssuerRejected) as error:
        transport.exchange_code("sensitive-code", VERIFIER, REDIRECT, CLIENT)
    assert str(error.value) == "OIDC_ISSUER_NOT_VERIFIED"
    assert "sensitive-code" not in repr(error.value)
    assert "secret-value" not in repr(error.value)
    assert len(requests) == 1
    request = requests[0]
    assert request.headers["Authorization"].startswith("Basic ")
    assert b"secret-value" not in request.content
    assert b"sensitive-code" in request.content


def test_secret_provider_and_timeout_fail_redacted():
    def secret_provider():
        raise RuntimeError("secret-value")

    guarded = make_transport(lambda request: pytest.fail("unexpected network"),
                             client_secret=secret_provider)
    with pytest.raises(OidcIssuerRejected, match="^OIDC_ISSUER_NOT_VERIFIED$") as error:
        guarded.exchange_code("sensitive-code", VERIFIER, REDIRECT, CLIENT)
    assert error.value.__cause__ is None

    def timeout(request):
        raise httpx.ReadTimeout("sensitive-code", request=request)

    guarded = make_transport(timeout)
    with pytest.raises(OidcIssuerRejected, match="^OIDC_ISSUER_NOT_VERIFIED$") as error:
        guarded.exchange_code("sensitive-code", VERIFIER, REDIRECT, CLIENT)
    assert error.value.__cause__ is None


@pytest.mark.parametrize("values", [
    ("", VERIFIER, REDIRECT, CLIENT),
    ("code", "short", REDIRECT, CLIENT),
    ("code", VERIFIER, "https://evil.example.test/callback", CLIENT),
    ("code", VERIFIER, REDIRECT, "different-client"),
])
def test_rejects_exchange_binding_mismatch(values):
    calls = []
    transport = make_transport(lambda request: calls.append(request))
    with pytest.raises(OidcIssuerRejected, match="^OIDC_ISSUER_NOT_VERIFIED$"):
        transport.exchange_code(*values)
    assert calls == []


@pytest.mark.parametrize("scenario", ["valid", "nonce_mismatch", "low_acr"])
def test_transport_connects_to_existing_code_flow(scenario):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public.update(kid="test-key", use="sig", alg="RS256")
    now = datetime(2026, 9, 25, 7, 0, tzinfo=timezone.utc)
    verifier = OidcIdTokenVerifier(
        json.dumps({"keys": [public]}), issuer=ISSUER, client_id=CLIENT,
        step_up_acr="urn:anvil:step-up", clock=lambda: now,
    )
    pending = {}

    class Store:
        def put(self, digest, item):
            pending[digest] = item

        def consume(self, digest):
            return pending.pop(digest, None)

    calls = []

    def handler(request):
        calls.append(request)
        nonce = "different-nonce" if scenario == "nonce_mismatch" else issued_nonce[0]
        claims = {
            "iss": ISSUER, "aud": CLIENT, "sub": "subject-1",
            "exp": int(now.timestamp()) + 60, "iat": int(now.timestamp()),
            "nonce": nonce,
        }
        if scenario == "low_acr":
            claims.update(acr="urn:anvil:low", auth_time=int(now.timestamp()))
        token = jwt.encode(claims, private, algorithm="RS256", headers={"kid": "test-key"})
        return httpx.Response(200, headers={"Content-Type": "application/json"},
                              json={"id_token": token, "access_token": "discard-me"})

    transport = make_transport(handler)
    flow = OidcCodeFlow(
        ISSUER + "/protocol/openid-connect/auth", client_id=CLIENT,
        redirect_uri=REDIRECT, verifier=verifier, pending_store=Store(),
        exchange_code=transport.exchange_code, clock=lambda: now,
    )
    started = flow.begin(require_step_up=scenario == "low_acr")
    issued_nonce = [next(iter(pending.values())).nonce]
    issued_verifier = next(iter(pending.values())).code_verifier
    if scenario == "valid":
        assert flow.complete(code="code", state=started.browser_state,
                             browser_state=started.browser_state).subject == "subject-1"
    else:
        with pytest.raises(OidcCodeFlowRejected, match="^OIDC_CODE_FLOW_NOT_VERIFIED$"):
            flow.complete(code="code", state=started.browser_state,
                          browser_state=started.browser_state)
    assert len(calls) == 1
    request = calls[0]
    assert str(request.url) == ENDPOINT
    assert request.method == "POST"
    assert request.headers["Accept"] == "application/json"
    assert "Authorization" not in request.headers
    assert dict(httpx.QueryParams(request.content.decode())) == {
        "grant_type": "authorization_code", "code": "code",
        "code_verifier": issued_verifier,
        "redirect_uri": REDIRECT, "client_id": CLIENT,
    }


def test_strict_http_client_configuration(monkeypatch):
    original = httpx.Client
    options = []

    def capture(*args, **kwargs):
        options.append(kwargs)
        return original(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", capture)
    transport = make_transport(lambda request: httpx.Response(
        200, headers={"Content-Type": "application/json"},
        json={"id_token": "signed.token.value"}))
    transport.exchange_code("code", VERIFIER, REDIRECT, CLIENT)
    assert options[0]["verify"] is True
    assert options[0]["trust_env"] is False
    assert options[0]["follow_redirects"] is False
    assert options[0]["timeout"] == 5.0


def test_runtime_httpx_declarations_match_locked_version():
    root = Path(__file__).resolve().parents[2]
    project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    lock = tomllib.loads((root / "uv.lock").read_text(encoding="utf-8"))
    runtime = (root / "deploy/wsl/requirements-runtime.txt").read_text(encoding="utf-8")
    assert "httpx>=0.28,<1" in project["project"]["dependencies"]
    assert not any(value.startswith("httpx>") for value in project["dependency-groups"]["dev"])
    locked = next(package for package in lock["package"] if package["name"] == "httpx")
    assert locked["version"] == "0.28.1"
    assert "httpx==0.28.1" in runtime.splitlines()
