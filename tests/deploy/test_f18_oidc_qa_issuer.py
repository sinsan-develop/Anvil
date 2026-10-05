"""R43B1 QA-only issuer behavior and isolated image/Compose contract."""

import asyncio
import base64
import hashlib
import importlib.util
import json
import secrets
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
import yaml
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


ROOT = Path(__file__).resolve().parents[2]
ISSUER_MODULE = ROOT / "deploy/wsl/oidc_qa_issuer.py"
DOCKERFILE = ROOT / "deploy/wsl/Dockerfile.f18.oidc-qa"
OVERLAY = ROOT / "deploy/wsl/compose.f18.oidc.yml"
ISSUER = "https://anvil-f18-qa.local:8444/realms/anvil"
REDIRECT = "https://anvil-f18-qa.local:8444/"
VERIFIER = "v" * 43
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()


class ComposeLoader(yaml.SafeLoader):
    pass


ComposeLoader.add_constructor("!override", lambda loader, node: loader.construct_sequence(node))


def _issuer_module():
    assert ISSUER_MODULE.is_file(), "R43B1 issuer executable missing"
    spec = importlib.util.spec_from_file_location("f18_oidc_qa_issuer", ISSUER_MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def issuer_setup(tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    key_file = tmp_path / "signing.key"
    secret_file = tmp_path / "client-secret"
    key_file.write_bytes(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ))
    synthetic_secret = secrets.token_urlsafe(32)
    secret_file.write_text(synthetic_secret, encoding="ascii")
    now = [int(time.time())]
    module = _issuer_module()
    app = module.create_qa_issuer(
        key_file, secret_file, clock=lambda: now[0], code_factory=lambda: "qa-code-" + "x" * 32,
    )
    app.state.qa_test_secret = synthetic_secret
    return app, now, key.public_key()


async def _call(app, method, path, **kwargs):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://anvil-f18-qa.local:8444") as client:
        return await client.request(method, path, **kwargs)


def _auth_params(**changes):
    params = {
        "response_type": "code", "scope": "openid", "client_id": "anvil-web",
        "redirect_uri": REDIRECT, "state": "s" * 43, "nonce": "n" * 43,
        "code_challenge": CHALLENGE, "code_challenge_method": "S256",
    }
    params.update(changes)
    return params


def _code(app, **changes):
    response = asyncio.run(_call(
        app, "GET", "/realms/anvil/protocol/openid-connect/auth",
        params=_auth_params(**changes), follow_redirects=False,
    ))
    assert response.status_code == 302
    location = urlsplit(response.headers["location"])
    assert location._replace(query="").geturl() == REDIRECT
    return parse_qs(location.query)["code"][0]


def _token(app, code, **changes):
    data = {
        "grant_type": "authorization_code", "code": code,
        "code_verifier": VERIFIER, "redirect_uri": REDIRECT,
        "client_id": "anvil-web",
    }
    data.update(changes)
    return asyncio.run(_call(
        app, "POST", "/realms/anvil/protocol/openid-connect/token",
        data=data, auth=("anvil-web", app.state.qa_test_secret),
    ))


def test_issuer_exchanges_one_use_pkce_code_and_exposes_public_jwks(issuer_setup):
    app, now, public_key = issuer_setup
    code = _code(app)
    jwks = asyncio.run(_call(app, "GET", "/realms/anvil/protocol/openid-connect/certs"))
    assert jwks.status_code == 200
    jwk = jwks.json()["keys"][0]
    assert set(jwk) == {"kty", "n", "e", "kid", "use", "alg"}
    assert jwk["kty"] == "RSA" and jwk["alg"] == "RS256"
    token = _token(app, code)
    assert token.status_code == 200
    signed = token.json()["id_token"]
    assert jwt.get_unverified_header(signed) == {"alg": "RS256", "kid": jwk["kid"], "typ": "JWT"}
    claims = jwt.decode(signed, public_key, algorithms=["RS256"], audience="anvil-web", issuer=ISSUER)
    assert claims == {
        "iss": ISSUER, "aud": "anvil-web", "sub": "synthetic-subject-1",
        "nonce": "n" * 43, "iat": now[0], "exp": now[0] + 60,
    }
    assert _token(app, code).status_code == 401


@pytest.mark.parametrize("changes", [
    {"redirect_uri": "https://other.invalid/callback"},
    {"client_id": "other"},
    {"code_challenge_method": "plain"},
    {"code_challenge": "invalid"},
    {"scope": "profile"},
])
def test_authorize_rejects_untrusted_redirect_client_or_pkce(issuer_setup, changes):
    app, _, _ = issuer_setup
    response = asyncio.run(_call(
        app, "GET", "/realms/anvil/protocol/openid-connect/auth", params=_auth_params(**changes),
    ))
    assert response.status_code == 400
    assert "location" not in response.headers


@pytest.mark.parametrize("change", [
    {"code_verifier": "wrong" * 12},
    {"redirect_uri": "https://other.invalid/callback"},
    {"client_id": "other"},
])
def test_token_rejects_mismatched_code_binding(issuer_setup, change):
    app, _, _ = issuer_setup
    code = _code(app)
    assert _token(app, code, **change).status_code == 401
    assert _token(app, code).status_code == 401  # failed attempt consumed the code


def test_token_rejects_wrong_client_secret_without_reflection(issuer_setup):
    app, _, _ = issuer_setup
    code = _code(app)
    response = asyncio.run(_call(
        app, "POST", "/realms/anvil/protocol/openid-connect/token",
        data={"grant_type": "authorization_code", "code": code, "code_verifier": VERIFIER,
              "redirect_uri": REDIRECT, "client_id": "anvil-web"},
        auth=("anvil-web", "wrong-private-value"),
    ))
    assert response.status_code == 401
    assert "wrong-private-value" not in response.text
    assert _token(app, code).status_code == 401


def test_token_rejects_expired_code(issuer_setup):
    app, now, _ = issuer_setup
    code = _code(app)
    now[0] += 61
    assert _token(app, code).status_code == 401


def test_step_up_claims_emit_recent_acr_and_auth_time(issuer_setup):
    app, now, public_key = issuer_setup
    code = _code(app, claims=json.dumps({"id_token": {
        "acr": {"essential": True, "values": ["urn:anvil:step-up"]},
        "auth_time": {"essential": True},
    }}), max_age="300")
    token = _token(app, code)
    assert token.status_code == 200
    claims = jwt.decode(token.json()["id_token"], public_key, algorithms=["RS256"],
                        audience="anvil-web", issuer=ISSUER)
    assert claims["acr"] == "urn:anvil:step-up"
    assert claims["auth_time"] == now[0]


def test_issuer_rejects_missing_or_symlink_trust_material(tmp_path):
    module = _issuer_module()
    key = tmp_path / "missing.key"
    secret = tmp_path / "missing.secret"
    with pytest.raises(ValueError, match="^QA_ISSUER_NOT_CONFIGURED$"):
        module.create_qa_issuer(key, secret)
    real_key = tmp_path / "actual.key"
    real_key.write_text("not-a-key", encoding="ascii")
    key.symlink_to(real_key)
    with pytest.raises(ValueError, match="^QA_ISSUER_NOT_CONFIGURED$"):
        module.create_qa_issuer(key, secret)


def test_authorize_rejects_duplicate_parameters_and_malformed_step_up(issuer_setup):
    app, _, _ = issuer_setup
    params = list(_auth_params().items()) + [("client_id", "other")]
    assert asyncio.run(_call(
        app, "GET", "/realms/anvil/protocol/openid-connect/auth", params=params,
    )).status_code == 400
    assert asyncio.run(_call(
        app, "GET", "/realms/anvil/protocol/openid-connect/auth",
        params=_auth_params(claims="{}", max_age="300"),
    )).status_code == 400


def test_qa_image_and_compose_keep_secrets_out_of_image_and_host_ports():
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")
    assert "FROM python:3.12.8-slim-bookworm@sha256:2199a62885a12290dc9c5be3ca0681d367576ab7bf037da120e564723292a2f0" in dockerfile
    assert "COPY deploy/wsl/oidc_qa_issuer.py" in dockerfile
    assert "COPY deploy/wsl/requirements-runtime.txt" in dockerfile
    assert "COPY packages" not in dockerfile and "COPY apps" not in dockerfile
    assert "COPY .env" not in dockerfile and "COPY signing.key" not in dockerfile
    assert "USER 10001:10001" in dockerfile
    assert "ANVIL_RELEASE_COMMIT" in dockerfile
    overlay = yaml.load(OVERLAY.read_text(encoding="utf-8"), Loader=ComposeLoader)
    service = overlay["services"]["oidc-issuer"]
    assert set(service["networks"]) == {"internal"}
    assert "ports" not in service and "build" not in service
    assert service["read_only"] is True
    assert service["cap_drop"] == ["ALL"]
    assert service["security_opt"] == ["no-new-privileges:true"]
    mounts = {item["target"]: item for item in service["volumes"]}
    for filename in ("signing.key", "client-secret"):
        target = "/run/anvil-f18-oidc/" + filename
        assert mounts[target] == {
            "type": "bind",
            "source": "${ANVIL_F18_OIDC_MATERIAL_DIR:?dedicated synthetic material directory required}/" + filename,
            "target": target,
            "read_only": True,
        }
    assert all("SECRET" not in key.upper() for key in service.get("environment", {}))
