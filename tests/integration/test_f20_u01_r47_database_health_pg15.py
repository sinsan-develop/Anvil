"""Opt-in R47 live PostgreSQL 15 Database Health source check.

This is not the R6 injected QA signal. The separate browser opt-in exercises
the actual OIDC process host and does not substitute for WSL acceptance.
Only an isolated, disposable, loopback PG15 database may run this test.
"""

import os
import re
import base64
import hashlib
import hmac
import json
import secrets
import socket
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs

from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse, RedirectResponse
import jwt
import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url
from cryptography.hazmat.primitives.asymmetric import rsa

from apps.api.anvil_api.oidc_process import create_oidc_process_app
from packages.persistence.oidc_principal_directory import (
    oidc_subject_bindings, roles, user_roles, users,
)
from tests.api.test_oidc_asgi_binding import _cleanup_r3a_oidc_rows
from tests.api.test_oidc_process import _environment, _trust
from tests.integration.f18_oidc_live_host import _certificate, _listener
from tests.integration.test_f20_u01_oidc_browser_pg15 import _import_asgi_for_r6


def _isolated_dsn() -> str:
    dsn = os.environ.get("ANVIL_U01_R47_PG_DSN")
    if not dsn:
        pytest.skip("R47 isolated PostgreSQL 15 opt-in is not configured")
    url = make_url(dsn)
    identity = url.database
    if (os.environ.get("ANVIL_U01_R47_PG_ISOLATED") != "1"
            or url.drivername not in {"postgresql", "postgresql+psycopg"}
            or url.host not in {"127.0.0.1", "localhost"} or url.port != 5545
            or not identity or re.fullmatch(r"anvil_f20_r47_[0-9a-f]{7}", identity) is None
            or url.username != identity):
        pytest.fail("R47_PG_TARGET_NOT_ISOLATED")
    return dsn


def test_r47_live_pg15_source_migration_and_scope(tmp_path):
    dsn = _isolated_dsn()
    inspection_engine = sa.create_engine(dsn)
    captured = []
    try:
        with inspection_engine.connect() as connection:
            facts = connection.execute(sa.text(
                "SELECT current_database(), current_user, "
                "current_setting('server_version_num')::integer"
            )).one()
            superuser = connection.execute(sa.text(
                "SELECT rolsuper FROM pg_roles WHERE rolname = current_user"
            )).scalar_one()
            heads = connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all()
        assert (facts[0], facts[1], facts[2] // 10000, superuser, heads) == (
            make_url(dsn).database, make_url(dsn).username, 15, False, ["0019_oidc_sessions"]
        ), "R47_PG_PREFLIGHT_REJECTED"

        trust, _, _ = _trust(tmp_path)
        environment = _environment(trust)
        environment["ANVIL_DATABASE_URL"] = dsn
        create_oidc_process_app(environment,
                                lambda **kwargs: captured.append(kwargs) or FastAPI())
        owner = captured[0]["operations_owner"]
        assert captured[0]["engine"] is captured[0]["session_factory"].kw["bind"]
        assert (owner.project_id, owner.environment_id) == ("project-1", "wsl-qa")
        positive = owner.snapshot()
        health = positive["health"]["database"]
        assert health["state"] == "HEALTHY" and health["error_count"] == 0
        assert health["detail_path"] == "/operations/health"
        assert health["evidence_ref"].startswith("sha256:")
        assert "database" not in positive["source_gaps"]
        assert all(positive["health"][name]["state"] == "UNKNOWN"
                   for name in ("queue", "worker", "provider", "backend", "artifact_store"))

        with pytest.raises(ValueError, match="^QUEUE_SOURCE_SCOPE_INVALID$"):
            owner._source_loader("foreign-project", "wsl-qa")

        try:
            with inspection_engine.begin() as connection:
                assert connection.execute(sa.text(
                    "UPDATE alembic_version SET version_num = '0016_operations_recovery' "
                    "WHERE version_num = '0019_oidc_sessions'"
                )).rowcount == 1
            mismatch = owner.snapshot()
            assert mismatch["health"]["database"]["state"] == "UNKNOWN"
            assert "database" in mismatch["source_gaps"]
        finally:
            with inspection_engine.begin() as connection:
                connection.execute(sa.text(
                    "UPDATE alembic_version SET version_num = '0019_oidc_sessions' "
                    "WHERE version_num = '0016_operations_recovery'"
                ))
        assert owner.snapshot()["health"]["database"]["state"] == "HEALTHY"
    finally:
        if captured:
            captured[0]["engine"].dispose()
        inspection_engine.dispose()


def test_r47_live_pg15_oidc_https_chromium_database_health(tmp_path):
    """Real process owner -> authenticated HTTPS API -> Chromium DOM, never R35 QA fixture."""
    dsn = _isolated_dsn()
    frontend = Path(os.environ.get("ANVIL_F20_R47_FRONTEND_DIST", ""))
    expected = Path(__file__).resolve().parents[2] / "apps" / "web" / "dist"
    assert (frontend.is_absolute() and frontend.resolve(strict=True) == expected
            and (frontend / "index.html").is_file()), "R47_FRONTEND_BUILD_REQUIRED"
    engine = sa.create_engine(dsn, connect_args={"connect_timeout": 2})
    listeners = []
    app = None
    api_socket = None
    seeded = False
    control = secrets.token_urlsafe(32)
    try:
        with engine.connect() as db:
            facts = db.execute(sa.text("SELECT current_database(), current_user, "
                "current_setting('server_version_num')::integer")).one()
            superuser = db.execute(sa.text(
                "SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).scalar_one()
            target = make_url(dsn)
            assert (facts[0], facts[1], facts[2] // 10000, superuser) == (
                target.database, target.username, 15, False), "R47_BROWSER_PG_TARGET_INVALID"
            assert db.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all() == [
                "0019_oidc_sessions"], "R47_BROWSER_PG_HEAD_INVALID"
            for table in ("users", "roles", "user_roles", "oidc_subject_bindings",
                          "oidc_pending_auth", "oidc_sessions", "operations_audit_events"):
                assert db.execute(sa.text("SELECT count(*) FROM " + table)).scalar_one() == 0, (
                    "R47_BROWSER_PG_NOT_EMPTY")
        issuer_cert, issuer_key = _certificate(tmp_path, "r47-issuer")
        api_cert, api_key = _certificate(tmp_path, "r47-api")
        secret_file = tmp_path / "r47-client-secret"
        secret_file.write_text("synthetic-client-secret", encoding="utf-8")
        signing = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing.public_key()))
        public.update(kid="r47-key", use="sig", alg="RS256")
        issued = {}
        issuer_app = FastAPI()

        @issuer_app.get("/realms/anvil/protocol/openid-connect/auth")
        async def authorize(request: Request):
            values = request.query_params
            code = "r47-code-" + str(len(issued) + 1)
            issued[code] = {name: values[name] for name in (
                "state", "nonce", "redirect_uri", "client_id", "code_challenge")}
            return RedirectResponse(values["redirect_uri"] + "?code=" + code
                                    + "&state=" + values["state"], status_code=302)

        @issuer_app.post("/realms/anvil/protocol/openid-connect/token")
        async def token(request: Request):
            form = {key: values[0] for key, values in parse_qs(
                (await request.body()).decode("ascii")).items()}
            try:
                client, secret = base64.b64decode(request.headers["authorization"].split(" ", 1)[1]
                    ).decode("ascii").split(":", 1)
                item = issued.pop(form["code"])
                challenge = base64.urlsafe_b64encode(hashlib.sha256(
                    form["code_verifier"].encode()).digest()).rstrip(b"=").decode()
                assert (client == form["client_id"] == item["client_id"] == "anvil-web"
                        and secret == "synthetic-client-secret"
                        and form["redirect_uri"] == item["redirect_uri"]
                        and form["grant_type"] == "authorization_code"
                        and challenge == item["code_challenge"])
            except (AssertionError, KeyError, ValueError, IndexError):
                return JSONResponse({"error": "invalid_grant"}, status_code=401)
            now = int(datetime.now(timezone.utc).timestamp())
            return {"id_token": jwt.encode({"iss": issuer_url, "aud": "anvil-web",
                "sub": "r47-subject", "nonce": item["nonce"], "iat": now, "exp": now + 60},
                signing, algorithm="RS256", headers={"kid": "r47-key"})}

        def control_allowed(request: Request) -> bool:
            return hmac.compare_digest(request.headers.get("x-r47-control-token", ""), control)

        @issuer_app.post("/r47-control/mismatch")
        async def mismatch(request: Request):
            if not control_allowed(request):
                return JSONResponse({"error": "forbidden"}, status_code=403)
            with engine.begin() as db:
                changed = db.execute(sa.text("UPDATE alembic_version "
                    "SET version_num='0016_operations_recovery' "
                    "WHERE version_num='0019_oidc_sessions'")).rowcount
            return {"updated": changed} if changed == 1 else JSONResponse(
                {"error": "wrong_state"}, status_code=409)

        @issuer_app.post("/r47-control/restore")
        async def restore(request: Request):
            if not control_allowed(request):
                return JSONResponse({"error": "forbidden"}, status_code=403)
            with engine.begin() as db:
                changed = db.execute(sa.text("UPDATE alembic_version "
                    "SET version_num='0019_oidc_sessions' "
                    "WHERE version_num='0016_operations_recovery'")).rowcount
            return {"updated": changed} if changed == 1 else JSONResponse(
                {"error": "wrong_state"}, status_code=409)

        @issuer_app.post("/r47-control/revoke")
        async def revoke(request: Request):
            if not control_allowed(request):
                return JSONResponse({"error": "forbidden"}, status_code=403)
            with engine.begin() as db:
                changed = db.execute(roles.update().where(roles.c.role_code == "r47-operator")
                    .values(permissions=["provider:read"])).rowcount
            return {"updated": changed} if changed == 1 else JSONResponse(
                {"error": "wrong_state"}, status_code=409)

        listeners.append(_listener(issuer_app, issuer_cert, issuer_key))
        issuer_url = listeners[0][3] + "/realms/anvil"
        with engine.begin() as db:
            db.execute(users.insert().values(actor_id="r47-actor", active=True))
            db.execute(roles.insert().values(role_code="r47-operator", permissions=[
                "provider:read", "operations:alerts:read", "dashboard:read"]))
            db.execute(user_roles.insert().values(actor_id="r47-actor", role_code="r47-operator",
                project_id="project-1", environment_id="wsl-qa", active=True,
                step_up_required=False))
            db.execute(oidc_subject_bindings.insert().values(issuer=issuer_url,
                subject="r47-subject", actor_id="r47-actor", active=True))
        seeded = True
        api_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        api_socket.bind(("127.0.0.1", 0))
        api_url = f"https://127.0.0.1:{api_socket.getsockname()[1]}"
        trust = tmp_path / "r47-trust.json"
        trust.write_text(json.dumps({"pinned_jwks_json": json.dumps({"keys": [public]}),
            "allowed_roles": ["r47-operator"],
            "allowed_permissions": ["provider:read", "operations:alerts:read", "dashboard:read"],
            "allowed_project_ids": ["project-1"], "allowed_environment_ids": ["wsl-qa"],
            "scope_roles": ["r47-operator"], "scope_project_id": "project-1",
            "scope_environment_id": "wsl-qa", "ca_bundle_file": str(issuer_cert),
            "client_secret_file": str(secret_file)}), encoding="utf-8")
        environment = {"ANVIL_AUTH_MODE": "OIDC", "ANVIL_F18_OIDC_TRUST_FILE": str(trust),
            "ANVIL_F15_OPERATIONAL_SHELL": "1", "ANVIL_PUBLIC_HOST": "127.0.0.1",
            "ANVIL_CONSOLE_BASE_URL": api_url, "ANVIL_OIDC_ISSUER": issuer_url,
            "ANVIL_OIDC_CLIENT_ID": "anvil-web", "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
            "ANVIL_DATABASE_URL": dsn, "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
            "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
            "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1", "UPSTAGE_API_KEY": "synthetic-presence"}
        asgi = _import_asgi_for_r6(api_url)
        app = create_oidc_process_app(environment, lambda **kwargs:
            asgi.create_configured_oidc_asgi_app(frontend_directory=frontend, **kwargs))
        listeners.append(_listener(app, api_cert, api_key, api_socket))
        api_socket = None
        script = Path(__file__).resolve().parents[1] / "browser" / "f20-u01-oidc-browser-pg15.mjs"
        assert script.is_file(), "R47_BROWSER_SCRIPT_MISSING"
        browser_environment = {name: os.environ[name] for name in (
            "PATH", "HOME", "TMPDIR", "ANVIL_PLAYWRIGHT_MODULE", "PLAYWRIGHT_BROWSERS_PATH",
            "LD_LIBRARY_PATH") if name in os.environ}
        browser_environment.update(ANVIL_F20_R47_MODE="1", ANVIL_F20_R47_API_URL=api_url,
            ANVIL_F20_R47_ISSUER_URL=issuer_url, ANVIL_F20_R47_CONTROL_TOKEN=control,
            ANVIL_F20_R47_SECRET_VALUES_JSON=json.dumps([dsn, control,
                "synthetic-client-secret", "synthetic-telegram-secret"]))
        result = subprocess.run([os.environ.get("ANVIL_F20_R6_NODE_BIN", "node"), str(script)],
            shell=False, env=browser_environment, capture_output=True, text=True,
            timeout=120, check=False)
        assert result.returncode == 0, "R47_BROWSER_RUN_FAILED"
        rows = [line.removeprefix("R47_RESULT ") for line in result.stdout.splitlines()
                if line.startswith("R47_RESULT ")]
        assert len(rows) == 1, "R47_BROWSER_RESULT_MISSING"
        evidence = json.loads(rows[0])
        assert (evidence.keys() == {"positive", "mismatch", "restored", "revoked",
                "sameOrigin", "secretFree", "pageRequestCount", "evidenceRef"}
                and all(evidence[key] is True for key in (
                    "positive", "mismatch", "restored", "revoked", "sameOrigin", "secretFree"))
                and type(evidence["pageRequestCount"]) is int and evidence["pageRequestCount"] > 0
                and re.fullmatch(r"sha256:[0-9a-f]{64}", evidence["evidenceRef"])), (
            "R47_BROWSER_EVIDENCE_INVALID")
    finally:
        cleanup_errors = []
        if api_socket is not None:
            api_socket.close()
        for server, thread, listener, _ in reversed(listeners):
            server.should_exit = True
            thread.join(timeout=10)
            listener.close()
            if thread.is_alive():
                cleanup_errors.append("R47_HTTPS_LISTENER_REMAINS")
        try:
            with engine.begin() as db:
                db.execute(sa.text("UPDATE alembic_version SET version_num='0019_oidc_sessions' "
                    "WHERE version_num='0016_operations_recovery'"))
        except Exception:
            cleanup_errors.append("R47_MIGRATION_HEAD_RESTORE_FAILED")
        if seeded:
            try:
                _cleanup_r3a_oidc_rows(engine)
            except Exception:
                cleanup_errors.append("R47_IDENTITY_CLEANUP_FAILED")
        if app is not None:
            app.state.database_engine.dispose()
        engine.dispose()
        for name in ("r47-issuer.pem", "r47-issuer.key", "r47-api.pem", "r47-api.key",
                     "r47-client-secret", "r47-trust.json"):
            child = tmp_path / name
            if child.is_symlink():
                cleanup_errors.append("R47_TLS_LINK_UNSAFE")
            elif child.is_file():
                try:
                    child.unlink()
                except OSError:
                    cleanup_errors.append("R47_TEMP_FILE_REMAINS")
        assert not cleanup_errors, ",".join(cleanup_errors)
