"""Isolated, real HTTPS loopback host for the R39 OIDC composition."""

from __future__ import annotations

import base64
import hashlib
import importlib
import ipaddress
import json
import os
import socket
import ssl
import tempfile
import threading
import time
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import sqlalchemy as sa
import uvicorn
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import sessionmaker

from packages.api.fastapi_app import AuthorizationScope
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, oidc_subject_bindings, roles, user_roles, users,
)
from packages.persistence.oidc_session_store import OIDC_SESSION_METADATA


@dataclass(frozen=True)
class LiveOidcEvidence:
    issuer_url: str
    api_url: str
    authorization_status: int
    callback_status: int
    session_status: int
    replay_status: int | None
    secret_calls: int
    issuer_token_requests: int
    cleanup_verified: bool


def _certificate(directory: Path, name: str) -> tuple[Path, Path]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "127.0.0.1")])
    now = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=1))
            .not_valid_after(now + timedelta(minutes=30))
            .add_extension(x509.SubjectAlternativeName([
                x509.IPAddress(ipaddress.ip_address("127.0.0.1"))
            ]), critical=False)
            .sign(key, hashes.SHA256()))
    cert_path, key_path = directory / f"{name}.pem", directory / f"{name}.key"
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ))
    return cert_path, key_path


def _listener(app: FastAPI, cert: Path, key: Path, listener: socket.socket | None = None) -> tuple[uvicorn.Server, threading.Thread, socket.socket, str]:
    if listener is None:
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    port = listener.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(
        app, host="127.0.0.1", port=port, ssl_certfile=str(cert), ssl_keyfile=str(key),
        log_config=None, access_log=False, lifespan="off",
    ))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started and thread.is_alive() and time.monotonic() < deadline:
        time.sleep(0.01)
    if not server.started:
        server.should_exit = True
        thread.join(timeout=5)
        listener.close()
        raise RuntimeError("OIDC loopback listener did not start")
    return server, thread, listener, f"https://127.0.0.1:{port}"


def run_live_oidc_host_flow(*, reject: str | None = None) -> LiveOidcEvidence:
    """Exercise two network listeners; own and close every synthetic resource."""
    if reject not in {None, "bad_secret", "wrong_nonce", "wrong_audience",
                      "wrong_issuer", "reused_state", "invalid_tls"}:
        raise ValueError("unsupported rejection case")
    resources: list[tuple[uvicorn.Server, threading.Thread, socket.socket, str]] = []
    pending_socket = None
    engine = None
    result = None
    cleaned = False
    with tempfile.TemporaryDirectory(prefix=".anvil-f18-r40-", dir=Path(__file__).parent) as temporary:
        directory = Path(temporary)
        try:
            with patch.dict(os.environ, {
                "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
                "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
                "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
                "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
                "ANVIL_CONSOLE_BASE_URL": "https://127.0.0.1",
                "ANVIL_PUBLIC_HOST": "127.0.0.1",
            }):
                asgi = importlib.import_module("apps.api.anvil_api.asgi")
            issuer_cert, issuer_key = _certificate(directory, "issuer")
            api_cert, api_key = _certificate(directory, "api")
            other_cert, _ = _certificate(directory, "other")
            signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing_key.public_key()))
            jwk.update(kid="synthetic-key", use="sig", alg="RS256")
            issued: dict[str, dict[str, str]] = {}
            token_requests = []
            issuer_app = FastAPI()

            @issuer_app.get("/realms/anvil/protocol/openid-connect/auth")
            async def authorize(request: Request):
                query = request.query_params
                code = "synthetic-code-" + str(len(issued) + 1)
                issued[code] = {name: query[name] for name in (
                    "state", "nonce", "redirect_uri", "client_id", "code_challenge",
                )}
                return RedirectResponse(query["redirect_uri"] + "?code=" + code
                                        + "&state=" + query["state"], status_code=302)

            @issuer_app.post("/realms/anvil/protocol/openid-connect/token")
            async def token(request: Request):
                token_requests.append(True)
                form = {key: values[0] for key, values in parse_qs(
                    (await request.body()).decode("ascii")
                ).items()}
                try:
                    client_id, secret = base64.b64decode(
                        request.headers["authorization"].split(" ", 1)[1]
                    ).decode("ascii").split(":", 1)
                    item = issued.pop(form["code"])
                    verifier_digest = hashlib.sha256(form["code_verifier"].encode()).digest()
                    challenge = base64.urlsafe_b64encode(verifier_digest).rstrip(b"=").decode()
                    assert (client_id == form["client_id"] == item["client_id"] == "anvil-web"
                            and secret == "synthetic-client-secret"
                            and form["redirect_uri"] == item["redirect_uri"]
                            and form["grant_type"] == "authorization_code"
                            and challenge == item["code_challenge"])
                except (AssertionError, KeyError, ValueError, IndexError):
                    return JSONResponse({"error": "invalid_grant"}, status_code=401)
                issuer = resources[0][3] + "/realms/anvil"
                now = int(datetime.now(timezone.utc).timestamp())
                claims = {"iss": issuer, "aud": "anvil-web", "sub": "subject-1",
                          "nonce": item["nonce"], "iat": now, "exp": now + 60}
                if reject == "wrong_nonce":
                    claims["nonce"] = "wrong-nonce"
                elif reject == "wrong_audience":
                    claims["aud"] = "wrong-client"
                elif reject == "wrong_issuer":
                    claims["iss"] = "https://other.invalid/realms/anvil"
                signed = jwt.encode(claims, signing_key, algorithm="RS256",
                                    headers={"kid": "synthetic-key"})
                return {"id_token": signed}

            resources.append(_listener(issuer_app, issuer_cert, issuer_key))
            issuer_url = resources[0][3] + "/realms/anvil"
            engine = sa.create_engine("sqlite+pysqlite:///" + (directory / "oidc.sqlite").as_posix(),
                                      connect_args={"check_same_thread": False})
            for metadata in (OIDC_PENDING_METADATA, DIRECTORY_METADATA, OIDC_SESSION_METADATA):
                metadata.create_all(engine)
            with engine.begin() as db:
                db.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
                db.execute(sa.text("INSERT INTO alembic_version VALUES ('0013_task_bootstrap_authority')"))
                db.execute(users.insert().values(actor_id="actor-1", active=True))
                db.execute(roles.insert().values(role_code="operator", permissions=["provider:read"]))
                db.execute(user_roles.insert().values(
                    actor_id="actor-1", role_code="operator", project_id="project-1",
                    environment_id="wsl-qa", step_up_required=False, active=True,
                ))
                db.execute(oidc_subject_bindings.insert().values(
                    issuer=issuer_url, subject="subject-1", actor_id="actor-1", active=True,
                ))
            api_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            pending_socket = api_socket
            api_socket.bind(("127.0.0.1", 0))
            api_port = api_socket.getsockname()[1]
            api_url = f"https://127.0.0.1:{api_port}"
            secret_calls = []

            def secret():
                secret_calls.append(True)
                return "invalid-synthetic-secret" if reject == "bad_secret" else "synthetic-client-secret"

            environment = {
                "ANVIL_AUTH_MODE": "OIDC", "ANVIL_PUBLIC_HOST": "127.0.0.1",
                "ANVIL_CONSOLE_BASE_URL": api_url, "ANVIL_OIDC_ISSUER": issuer_url,
                "ANVIL_OIDC_CLIENT_ID": "anvil-web", "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
                "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
                "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
                "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
                "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1", "UPSTAGE_API_KEY": "synthetic-presence",
            }
            app = asgi.create_configured_oidc_asgi_app(
                environment=environment, engine=engine, session_factory=sessionmaker(bind=engine),
                authorization_resolver=lambda _endpoint, _params: AuthorizationScope(
                    "project-1", "wsl-qa", frozenset({"operator"})),
                principal_policy=OidcPrincipalPolicy(
                    issuer_url, frozenset({"operator"}), frozenset({"provider:read"}),
                    frozenset({"project-1"}), frozenset({"wsl-qa"})),
                pinned_jwks_json=json.dumps({"keys": [jwk]}), client_secret=secret,
                ca_bundle=str(other_cert if reject == "invalid_tls" else issuer_cert),
            )
            resources.append(_listener(app, api_cert, api_key, api_socket))
            pending_socket = None
            actual_api_url = resources[1][3]
            if actual_api_url != api_url:
                raise RuntimeError("API loopback port changed before bind")
            with httpx.Client(verify=ssl.create_default_context(cafile=str(api_cert)),
                              trust_env=False, timeout=5) as client:
                headers = {"origin": api_url}
                authorization = client.post(api_url + "/auth/oidc/authorization",
                                            headers=headers, json={})
                authorization.raise_for_status()
                assert not secret_calls and not token_requests
                payload = authorization.json()["data"]
                with httpx.Client(verify=ssl.create_default_context(cafile=str(issuer_cert)),
                                  trust_env=False, timeout=5) as issuer_client:
                    issuer_response = issuer_client.get(payload["authorization_url"],
                                                        follow_redirects=False)
                assert issuer_response.status_code == 302
                redirect = urlsplit(issuer_response.headers["location"])
                query = parse_qs(redirect.query)
                state = payload["browser_state"]
                assert redirect._replace(query="").geturl() == api_url + "/auth/oidc/callback"
                assert query["state"] == [state]
                if reject == "reused_state":
                    pre = client.post(api_url + "/auth/oidc/callback", headers=headers, json={
                        "code": query["code"][0], "state": state, "browser_state": state,
                    })
                    assert pre.status_code == 200
                    callback_state = state
                else:
                    callback_state = state
                callback = client.post(api_url + "/auth/oidc/callback", headers=headers, json={
                    "code": query["code"][0], "state": callback_state,
                    "browser_state": callback_state,
                })
                status = client.get(api_url + "/auth/session/status", headers=headers)
                replay = None
                if reject is None:
                    replay = client.post(api_url + "/auth/oidc/callback", headers=headers, json={
                        "code": query["code"][0], "state": state, "browser_state": state,
                    }).status_code
                assert state not in callback.text and query["code"][0] not in callback.text
                assert "synthetic-client-secret" not in callback.text
                assert (status.json()["authenticated"] is (reject in {None, "reused_state"}))
                if reject is None:
                    assert "anvil_session" in client.cookies
                    assert "HttpOnly" in callback.headers["set-cookie"]
                    assert "Secure" in callback.headers["set-cookie"]
                    assert len(token_requests) == 1
                else:
                    assert "synthetic-client-secret" not in status.text
                    assert "synthetic-code" not in status.text
                result = LiveOidcEvidence(
                    issuer_url, api_url, authorization.status_code, callback.status_code,
                    status.status_code, replay, len(secret_calls), len(token_requests), False,
                )
        finally:
            if pending_socket is not None:
                pending_socket.close()
            for server, thread, listener, _ in reversed(resources):
                server.should_exit = True
                thread.join(timeout=10)
                listener.close()
            if engine is not None:
                engine.dispose()
            cleaned = all(not thread.is_alive() and listener.fileno() == -1
                          for _, thread, listener, _ in resources)
    if result is None:
        raise RuntimeError("OIDC flow produced no evidence")
    return replace(result, cleanup_verified=cleaned and not directory.exists())
