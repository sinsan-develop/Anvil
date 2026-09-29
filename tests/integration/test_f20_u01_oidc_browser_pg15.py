"""Opt-in R6 browser/OIDC/isolated PostgreSQL 15 integration evidence."""

from __future__ import annotations

import base64
import hashlib
import hmac
import importlib
import json
import os
import re
import secrets
import socket
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs

import certifi
import jwt
import pytest
import sqlalchemy as sa
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import sessionmaker

from packages.api.fastapi_app import AuthorizationScope
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.leases.service import LeaseService
from packages.observability.projection import OperationsSources
from packages.observability.service import OperationsService
from packages.persistence.oidc_principal_directory import (
    oidc_subject_bindings, roles, user_roles, users,
)
from packages.persistence.operations_repository import PostgresOperationsRepository
from tests.integration.f18_oidc_live_host import _certificate, _listener


_TEMP_NAME = ".anvil-f20-u01-r6-oidc-host"
_CERT_FILES = ("issuer.pem", "issuer.key", "api.pem", "api.key")
_ALERT_CODE = "WORKER_LEASE_EXPIRED"
_PG_DATA_PATH = "/var/lib/postgresql/data"
_BROWSER_STAGES = frozenset({
    "BOOTSTRAP", "BROWSER_LAUNCH", "PRE_AUTH", "OIDC_AUTH", "STORED_ALERT",
    "REVOKE", "NETWORK_AUDIT",
})
_BROWSER_ERROR_CLASSES = frozenset({
    "AssertionError", "Error", "TypeError", "TimeoutError", "SyntaxError",
    "ReferenceError", "RangeError", "AggregateError", "TargetClosedError",
})


def _validated_target(dsn: str | None, isolated: str | None) -> sa.engine.URL:
    try:
        url = sa.engine.make_url(dsn)
        valid = (
            isolated == "1" and url.get_backend_name() == "postgresql"
            and url.drivername in {"postgresql+psycopg", "postgresql+psycopg2", "postgresql"}
            and url.host == "127.0.0.1" and url.port is not None
            and 1024 < url.port != 5432 and not url.query
            and isinstance(url.database, str) and url.database.startswith("anvil_f20_r3a_")
            and isinstance(url.username, str) and url.username.startswith("anvil_f20_r3a_")
        )
    except (AttributeError, TypeError, ValueError, sa.exc.ArgumentError):
        valid = False
    if not valid:
        raise ValueError("R6_PG_TARGET_REJECTED stage=TARGET exit=REJECTED "
                         "class=InvariantError") from None
    return url


def _validate_container_snapshot(url: sa.engine.URL, sha7: str, snapshot: object) -> str:
    name = "anvil-u01-r6-pg-" + sha7
    db_name = "anvil_f20_r3a_" + sha7
    try:
        host = snapshot["HostConfig"]
        labels = snapshot["Config"]["Labels"]
        bindings = [{"HostIp": "127.0.0.1", "HostPort": "5545"}]
        tmpfs = host["Tmpfs"]
        tmpfs_options = tmpfs[_PG_DATA_PATH]
        mounts = snapshot["Mounts"]
        host_mounts = host.get("Mounts") or []
        valid = (
            re.fullmatch(r"[0-9a-f]{7}", sha7) is not None
            and url.port == 5545 and url.database == db_name and url.username == db_name
            and snapshot["Name"] == "/" + name
            and snapshot["State"]["Running"] is True
            and host["AutoRemove"] is True
            and snapshot["Config"]["Image"] == "postgres:15"
            and labels["anvil.qa.scope"] == "F-20/U-01/R6"
            and labels["anvil.qa.sha7"] == sha7
            and host["PortBindings"] == {"5432/tcp": bindings}
            and snapshot["NetworkSettings"]["Ports"] == {"5432/tcp": bindings}
            and not host.get("Binds") and not host.get("VolumesFrom")
            and set(tmpfs) == {_PG_DATA_PATH}
            and isinstance(tmpfs_options, str)
            and {"rw", "size=256m"} <= set(tmpfs_options.split(","))
            and isinstance(mounts, list) and isinstance(host_mounts, list)
            and all(item.get("Type") == "tmpfs" and item.get("Destination") == _PG_DATA_PATH
                    for item in mounts + host_mounts)
        )
    except (KeyError, TypeError, AttributeError, ValueError):
        valid = False
    if not valid:
        raise ValueError("R6_PG_CONTAINER_REJECTED stage=PRE_SEED_GUARD "
                         "exit=REJECTED class=InvariantError") from None
    return name


def _guard_pg_container(url: sa.engine.URL) -> str:
    root = Path(__file__).resolve().parents[2]
    try:
        git = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], shell=False,
                             capture_output=True, text=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("R6_GIT_HEAD_REJECTED stage=GIT exit=UNAVAILABLE "
                         "class=ProcessError") from None
    head = git.stdout.strip()
    if git.returncode != 0 or re.fullmatch(r"[0-9a-f]{40}", head) is None:
        raise ValueError(f"R6_GIT_HEAD_REJECTED stage=GIT exit={git.returncode} "
                         "class=ProcessError") from None
    sha7 = head[:7]
    name = "anvil-u01-r6-pg-" + sha7
    try:
        inspected = subprocess.run(["docker", "inspect", "--type=container", name], shell=False,
                                   capture_output=True, text=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("R6_PG_CONTAINER_REJECTED stage=INSPECT exit=UNAVAILABLE "
                         "class=ProcessError") from None
    if inspected.returncode != 0:
        raise ValueError(f"R6_PG_CONTAINER_REJECTED stage=INSPECT "
                         f"exit={inspected.returncode} class=ProcessError") from None
    try:
        payload = json.loads(inspected.stdout)
    except (json.JSONDecodeError, TypeError):
        raise ValueError("R6_PG_CONTAINER_REJECTED stage=INSPECT "
                         "exit=MALFORMED class=DecodeError") from None
    if not isinstance(payload, list) or len(payload) != 1:
        raise ValueError("R6_PG_CONTAINER_REJECTED stage=INSPECT "
                         "exit=MALFORMED class=DecodeError") from None
    return _validate_container_snapshot(url, sha7, payload[0])


def _preflight(engine: sa.Engine, url: sa.engine.URL) -> None:
    with engine.connect() as db:
        version, database, role, superuser = db.execute(sa.text(
            "SELECT current_setting('server_version_num')::integer, current_database(), "
            "current_user, r.rolsuper FROM pg_roles r WHERE r.rolname=current_user"
        )).one()
        heads = db.execute(sa.text("SELECT version_num FROM alembic_version")).scalars().all()
        assert (version // 10000 == 15 and database == url.database
                and role == url.username and superuser is False
                and heads == ["0019_oidc_sessions"]), "R6_PG_TARGET_REJECTED"
        for table in (
            "users", "roles", "user_roles", "oidc_subject_bindings", "oidc_pending_auth",
            "oidc_sessions", "operations_audit_events", "operations_audit_heads",
        ):
            assert db.execute(sa.text("SELECT count(*) FROM " + table)).scalar_one() == 0, (
                "R6_PG_TARGET_REJECTED"
            )


def _classify_browser_failure(stdout: str, stderr: str) -> tuple[str, str]:
    output = stdout + "\n" + stderr
    for match in re.finditer(r"^R6_BROWSER_FAILED stage=([A-Z_]+) class=([A-Za-z]+)\r?$",
                             output, flags=re.MULTILINE):
        stage, error_class = match.groups()
        if stage in _BROWSER_STAGES:
            return stage, error_class if error_class in _BROWSER_ERROR_CLASSES else "NodeError"
    if re.search(r"^R6_NODE_STARTED\r?$", output, flags=re.MULTILINE):
        return "NODE_UNHANDLED", "UnhandledError"
    if re.search(r"^npm (?:ERR!|error)(?:\s|$)", output, flags=re.MULTILINE):
        return "NPM_INSTALL", "PackageManagerError"
    if re.search(r"^(?:docker: |Error response from daemon:)", output, flags=re.MULTILINE):
        return "CONTAINER_START", "ContainerError"
    return "PRE_NODE_UNKNOWN", "ProcessError"


def _node_flow(api_url: str, issuer_url: str, control_token: str,
               dsn: str, alert: dict) -> dict:
    script = Path(__file__).resolve().parents[1] / "browser" / "f20-u01-oidc-browser-pg15.mjs"
    assert script.is_file(), "R6_BROWSER_SCRIPT_MISSING"
    environment = {name: os.environ[name] for name in (
        "PATH", "HOME", "TMPDIR", "SYSTEMROOT", "ANVIL_PLAYWRIGHT_MODULE",
        "ANVIL_CHROMIUM_EXECUTABLE", "PLAYWRIGHT_BROWSERS_PATH", "LD_LIBRARY_PATH",
    ) if name in os.environ}
    environment.update(ANVIL_F20_R6_API_URL=api_url, ANVIL_F20_R6_ISSUER_URL=issuer_url,
                       ANVIL_F20_R6_ALERT_CODE=_ALERT_CODE,
                       ANVIL_F20_R6_CONTROL_TOKEN=control_token,
                       ANVIL_F20_R6_ALERT_ENTITY=alert["related_entity_id"],
                       ANVIL_F20_R6_ALERT_CAUSE=alert["cause"])
    password = sa.engine.make_url(dsn).password
    dsn_forms = {dsn, "postgresql://" + dsn.split("://", 1)[1]}
    sensitive = [*sorted(dsn_forms), control_token, "synthetic-client-secret",
                 "r6-private-fence"]
    if password:
        sensitive.append(password)
    environment["ANVIL_F20_R6_SECRET_VALUES_JSON"] = json.dumps(sensitive)
    runner = os.environ.get("ANVIL_F20_R6_BROWSER_COMMAND_JSON")
    if runner is None:
        command = [os.environ.get("ANVIL_F20_R6_NODE_BIN", "node"), str(script)]
    else:
        command = json.loads(runner)
        assert (isinstance(command, list) and command
                and all(isinstance(part, str) and part for part in command)
                and any("f20-u01-oidc-browser-pg15.mjs" in part for part in command)), (
                    "R6_BROWSER_COMMAND_INVALID"
                )
    try:
        result = subprocess.run(command, shell=False, env=environment, capture_output=True,
                                text=True, encoding="utf-8", timeout=120, check=False)
    except subprocess.TimeoutExpired:
        pytest.fail("R6_BROWSER_FAILED stage=RUNNER exit=TIMEOUT class=TimeoutExpired; "
                    "MAIN_NAMED_CONTAINER_CLEANUP_REQUIRED", pytrace=False)
    except OSError:
        pytest.fail("R6_BROWSER_FAILED stage=RUNNER exit=LAUNCH class=OSError", pytrace=False)
    if result.returncode != 0:
        stage, error_class = _classify_browser_failure(result.stdout, result.stderr)
        pytest.fail(f"R6_BROWSER_FAILED stage={stage} exit={result.returncode} "
                    f"class={error_class}", pytrace=False)
    result_lines = [line for line in result.stdout.splitlines() if line.startswith("R6_RESULT ")]
    assert len(result_lines) == 1, "R6_BROWSER_RESULT_MISSING"
    return json.loads(result_lines[0][len("R6_RESULT "):])


def _import_asgi_for_r6(api_url: str):
    with pytest.MonkeyPatch.context() as startup:
        startup.setenv("ANVIL_DATABASE_URL", "postgresql://isolated.invalid/anvil")
        startup.setenv("TELEGRAM_WEBHOOK_SECRET", "synthetic-telegram-secret")
        startup.setenv("TELEGRAM_INTERNAL_SIGNING_SECRET", "synthetic-signing-secret")
        startup.setenv("TELEGRAM_ALLOWED_IDENTITIES", "chat-1:user-1")
        startup.setenv("ANVIL_CONSOLE_BASE_URL", api_url)
        startup.setenv("ANVIL_PUBLIC_HOST", "127.0.0.1")
        return importlib.import_module("apps.api.anvil_api.asgi")


def _run_opt_in(dsn: str, url: sa.engine.URL) -> None:
    from packages.persistence.oidc_pending_auth import oidc_pending_auth
    from packages.persistence.oidc_session_store import oidc_sessions

    _guard_pg_container(url)
    frontend = Path(os.environ["ANVIL_F20_R6_FRONTEND_DIST"]).resolve(strict=True)
    expected_frontend = Path(__file__).resolve().parents[2] / "apps" / "web" / "dist"
    assert (frontend == expected_frontend and frontend.is_dir()
            and (frontend / "index.html").is_file()), "R6_FRONTEND_BUILD_REQUIRED"
    temp = Path(__file__).resolve().parent / _TEMP_NAME
    assert not temp.exists() and not temp.is_symlink(), "R6_TLS_PATH_NOT_EMPTY"
    engine = sa.create_engine(dsn, connect_args={"connect_timeout": 2})
    listeners = []
    app = None
    pending_socket = None
    created = False
    seeded = False
    revoke_count = [0]
    control_token = secrets.token_urlsafe(32)
    try:
        _preflight(engine, url)
        temp.mkdir()
        created = True
        issuer_cert, issuer_key = _certificate(temp, "issuer")
        api_cert, api_key = _certificate(temp, "api")
        signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing_key.public_key()))
        public.update(kid="r6-key", use="sig", alg="RS256")
        issued: dict[str, dict[str, str]] = {}
        token_requests = []
        issuer_app = FastAPI()

        @issuer_app.get("/realms/anvil/protocol/openid-connect/auth")
        async def authorize(request: Request):
            query = request.query_params
            code = "r6-code-" + str(len(issued) + 1)
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
                digest = hashlib.sha256(form["code_verifier"].encode()).digest()
                challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
                assert (client_id == form["client_id"] == item["client_id"] == "anvil-web"
                        and secret == "synthetic-client-secret"
                        and form["redirect_uri"] == item["redirect_uri"]
                        and form["grant_type"] == "authorization_code"
                        and challenge == item["code_challenge"])
            except (AssertionError, KeyError, ValueError, IndexError):
                return JSONResponse({"error": "invalid_grant"}, status_code=401)
            now = int(datetime.now(timezone.utc).timestamp())
            claims = {"iss": issuer_url, "aud": "anvil-web", "sub": "r6-subject",
                      "nonce": item["nonce"], "iat": now, "exp": now + 60}
            return {"id_token": jwt.encode(claims, signing_key, algorithm="RS256",
                                           headers={"kid": "r6-key"})}

        @issuer_app.post("/r6-control/revoke")
        async def revoke(request: Request):
            if not hmac.compare_digest(request.headers.get("x-r6-control-token", ""), control_token):
                return JSONResponse({"error": "forbidden"}, status_code=403)
            if revoke_count[0] != 0:
                return JSONResponse({"error": "already_released"}, status_code=409)
            with engine.begin() as db:
                db.execute(roles.update().where(roles.c.role_code == "operator").values(
                    permissions=["provider:read"],
                ))
            revoke_count[0] += 1
            return {"status": "revoked"}

        listeners.append(_listener(issuer_app, issuer_cert, issuer_key))
        issuer_url = listeners[0][3] + "/realms/anvil"
        with engine.begin() as db:
            db.execute(users.insert().values(actor_id="r6-actor", active=True))
            db.execute(roles.insert().values(role_code="operator", permissions=[
                "provider:read", "operations:alerts:read",
            ]))
            db.execute(user_roles.insert().values(
                actor_id="r6-actor", role_code="operator", project_id="project-1",
                environment_id="wsl-qa", step_up_required=False, active=True,
            ))
            db.execute(oidc_subject_bindings.insert().values(
                issuer=issuer_url, subject="r6-subject", actor_id="r6-actor", active=True,
            ))
        seeded = True
        repository_dsn = dsn
        for prefix in ("postgresql+psycopg://", "postgresql+psycopg2://"):
            if repository_dsn.startswith(prefix):
                repository_dsn = "postgresql://" + repository_dsn[len(prefix):]
                break
        leases = LeaseService(token_factory=lambda: "r6-private-fence")
        at = datetime(2026, 9, 28, tzinfo=timezone.utc)
        leases.issue_worker("r6-run", "r6-worker", at - timedelta(minutes=10), timedelta(minutes=1))
        owner = OperationsService("project-1", "wsl-qa",
            OperationsSources(leases=leases, lease_run_ids=("r6-run",)),
            repository=PostgresOperationsRepository(repository_dsn), clock=lambda: at)
        assert owner.detect() == 1, "R6_PG_ALERT_SEED_FAILED"
        before = owner.alerts()
        assert [alert["code"] for alert in before] == [_ALERT_CODE]
        api_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        pending_socket = api_socket
        api_socket.bind(("127.0.0.1", 0))
        api_port = api_socket.getsockname()[1]
        api_url = f"https://127.0.0.1:{api_port}"
        environment = {
            "ANVIL_AUTH_MODE": "OIDC", "ANVIL_PUBLIC_HOST": "127.0.0.1",
            "ANVIL_CONSOLE_BASE_URL": api_url, "ANVIL_OIDC_ISSUER": issuer_url,
            "ANVIL_OIDC_CLIENT_ID": "anvil-web", "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
            "ANVIL_DATABASE_URL": dsn, "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
            "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
            "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1", "UPSTAGE_API_KEY": "synthetic-presence",
        }
        asgi = _import_asgi_for_r6(api_url)
        app = asgi.create_configured_oidc_asgi_app(
            environment=environment, engine=engine, session_factory=sessionmaker(bind=engine),
            authorization_resolver=lambda _endpoint, _params: AuthorizationScope(
                "project-1", "wsl-qa", frozenset({"operator"})),
            principal_policy=OidcPrincipalPolicy(
                issuer_url, frozenset({"operator"}),
                frozenset({"provider:read", "operations:alerts:read"}),
                frozenset({"project-1"}), frozenset({"wsl-qa"})),
            pinned_jwks_json=json.dumps({"keys": [public]}),
            client_secret=lambda: "synthetic-client-secret", ca_bundle=str(issuer_cert),
            operations_owner=owner, operational_shell=True, frontend_directory=frontend,
        )
        try:
            listeners.append(_listener(app, api_cert, api_key, api_socket))
        except BaseException:
            api_socket.close()
            raise
        pending_socket = None
        assert listeners[1][3] == api_url
        evidence = _node_flow(api_url, issuer_url, control_token, dsn, before[0])
        assert evidence.get("pageRequestCount", 0) > 0, "R6_PAGE_NETWORK_EMPTY"
        assert evidence.get("appApiRequestCount", 0) > 0, "R6_API_NETWORK_EMPTY"
        checked = {key: value for key, value in evidence.items()
                   if key not in {"pageRequestCount", "appApiRequestCount"}}
        assert checked == {
            "preAuthStatus": 401, "authorizationStatus": 200, "callbackStatus": 200,
            "sessionAuthenticated": True, "cookieSecure": True, "cookieHttpOnly": True,
            "storedStatus": 200, "storedAlertCode": _ALERT_CODE, "visibleBeforeRevoke": True,
            "storedEntity": before[0]["related_entity_id"],
            "storedCause": before[0]["cause"], "rowMatches": True,
            "revokedStatus": 403, "staleCleared": True,
            "allAppRequestsSameOrigin": True, "idpContextSeparate": True,
            "offOriginCredentialLeak": False, "secretExposure": False,
        }, "R6_BROWSER_EVIDENCE_MISMATCH"
        print("R6_E2E_EVIDENCE " + json.dumps(evidence, sort_keys=True))
        assert revoke_count == [1], "R6_REVOKE_MISSING"
        assert len(token_requests) == 1, "R6_TOKEN_EXCHANGE_COUNT_INVALID"
        assert owner.alerts() == before, "R6_GET_MUTATED_AUDIT"
        with engine.connect() as db:
            assert db.execute(sa.select(sa.func.count()).select_from(oidc_sessions)).scalar_one() == 1
            assert db.execute(sa.select(sa.func.count()).select_from(oidc_pending_auth)).scalar_one() == 0
    finally:
        cleanup_errors = []
        if pending_socket is not None:
            pending_socket.close()
        for server, thread, listener, _ in reversed(listeners):
            server.should_exit = True
            thread.join(timeout=10)
            listener.close()
            if thread.is_alive():
                cleanup_errors.append("R6_HTTPS_LISTENER_REMAINS")
        try:
            if seeded:
                from tests.api.test_oidc_asgi_binding import _cleanup_r3a_oidc_rows
                _cleanup_r3a_oidc_rows(engine)
        except Exception:
            cleanup_errors.append("R6_IDENTITY_CLEANUP_FAILED")
        finally:
            if app is not None:
                app.state.database_engine.dispose()
            engine.dispose()
        if created:
            if temp.resolve(strict=True) != temp or temp.is_symlink():
                cleanup_errors.append("R6_TLS_PATH_UNSAFE")
            else:
                for name in _CERT_FILES:
                    path = temp / name
                    if path.is_symlink():
                        cleanup_errors.append("R6_TLS_LINK_UNSAFE")
                    elif path.exists():
                        try:
                            path.unlink()
                        except OSError:
                            cleanup_errors.append("R6_TLS_FILE_REMAINS")
                try:
                    temp.rmdir()
                except OSError:
                    cleanup_errors.append("R6_TLS_PATH_REMAINS")
        assert not cleanup_errors, ",".join(cleanup_errors)


def test_r6_rejects_nonisolated_database_target():
    with pytest.raises(ValueError, match="R6_PG_TARGET_REJECTED"):
        _validated_target("postgresql://operator@127.0.0.1:5432/shared", "1")
    with pytest.raises(ValueError, match="R6_PG_TARGET_REJECTED"):
        _validated_target("postgresql://operator@127.0.0.1:5545/shared", "1")


def test_r6_container_guard_rejects_shared_or_persistent_targets():
    sha7 = "4f06cee"
    name = "anvil-u01-r6-pg-" + sha7
    snapshot = {
        "Name": "/" + name,
        "State": {"Running": True},
        "HostConfig": {"AutoRemove": True, "Binds": None, "Mounts": [], "VolumesFrom": None,
                       "Tmpfs": {_PG_DATA_PATH: "rw,size=256m"},
                       "PortBindings": {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "5545"}]}},
        "NetworkSettings": {"Ports": {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "5545"}]}},
        "Config": {"Image": "postgres:15", "Labels": {
            "anvil.qa.scope": "F-20/U-01/R6", "anvil.qa.sha7": sha7,
        }},
        "Mounts": [],
    }
    dsn = f"postgresql://anvil_f20_r3a_{sha7}@127.0.0.1:5545/anvil_f20_r3a_{sha7}"
    assert _validate_container_snapshot(_validated_target(dsn, "1"), sha7, snapshot) == name
    from copy import deepcopy
    for mutate in (
        lambda item: item["State"].update(Running=False),
        lambda item: item["HostConfig"].update(AutoRemove=False),
        lambda item: item["Config"].update(Image="postgres:16"),
        lambda item: item["Config"]["Labels"].update({"anvil.qa.sha7": "other"}),
        lambda item: item["HostConfig"]["PortBindings"]["5432/tcp"][0].update(HostIp="0.0.0.0"),
        lambda item: item["HostConfig"].update(Tmpfs={}),
        lambda item: item["HostConfig"].update(Binds=["/shared:/var/lib/postgresql/data"]),
        lambda item: item["Mounts"].append({"Type": "volume", "Name": "shared"}),
    ):
        altered = deepcopy(snapshot)
        mutate(altered)
        with pytest.raises(ValueError, match="R6_PG_CONTAINER_REJECTED"):
            _validate_container_snapshot(_validated_target(dsn, "1"), sha7, altered)
    wrong_db = f"postgresql://anvil_f20_r3a_{sha7}@127.0.0.1:5545/anvil_f20_r3a_other"
    with pytest.raises(ValueError, match="R6_PG_CONTAINER_REJECTED"):
        _validate_container_snapshot(_validated_target(wrong_db, "1"), sha7, snapshot)


def test_r6_container_rejection_precedes_any_database_connection(monkeypatch):
    dsn = "postgresql://anvil_f20_r3a_4f06cee@127.0.0.1:5545/anvil_f20_r3a_4f06cee"
    calls = []

    def rejected(_url):
        calls.append("inspect")
        raise ValueError("R6_PG_CONTAINER_REJECTED")

    def forbidden_engine(*_args, **_kwargs):
        calls.append("db")
        raise AssertionError("DB connection must not be constructed")

    monkeypatch.setitem(globals(), "_guard_pg_container", rejected)
    monkeypatch.setattr(sa, "create_engine", forbidden_engine)
    with pytest.raises(ValueError, match="R6_PG_CONTAINER_REJECTED"):
        _run_opt_in(dsn, _validated_target(dsn, "1"))
    assert calls == ["inspect"]


def test_r6_asgi_import_uses_test_console_origin_without_host_environment():
    environment = os.environ.copy()
    for name in ("ANVIL_AUTH_MODE", "ANVIL_CONSOLE_BASE_URL", "ANVIL_PUBLIC_HOST"):
        environment.pop(name, None)
    child = subprocess.run([
        sys.executable, "-B", "-c",
        "from tests.integration.test_f20_u01_oidc_browser_pg15 "
        "import _import_asgi_for_r6; "
        "assert _import_asgi_for_r6('https://127.0.0.1:48123').app is not None",
    ], shell=False, cwd=Path(__file__).resolve().parents[2], env=environment,
       capture_output=True, text=True, timeout=20, check=False)
    assert child.returncode == 0, "R6_ASGI_IMPORT_CONSOLE_BASE_URL_MISSING"


def test_r6_browser_failure_classification_never_returns_raw_output():
    secret = "private-dsn-or-token"
    cases = (
        ("", f"R6_BROWSER_FAILED stage=PRE_AUTH class=Error\n{secret}",
         ("PRE_AUTH", "Error")),
        ("R6_BROWSER_FAILED stage=OIDC_AUTH class=AssertionError\n", "",
         ("OIDC_AUTH", "AssertionError")),
        ("R6_NODE_STARTED\n", secret, ("NODE_UNHANDLED", "UnhandledError")),
        ("", f"npm error code EAI_AGAIN\n{secret}",
         ("NPM_INSTALL", "PackageManagerError")),
        ("", f"docker: Error response from daemon\n{secret}",
         ("CONTAINER_START", "ContainerError")),
        ("", secret, ("PRE_NODE_UNKNOWN", "ProcessError")),
        ("R6_NODE_STARTED\nR6_BROWSER_FAILED stage=LEAK class=Secret\n", secret,
         ("NODE_UNHANDLED", "UnhandledError")),
    )
    for stdout, stderr, expected in cases:
        actual = _classify_browser_failure(stdout, stderr)
        assert actual == expected
        assert secret not in " ".join(actual)


def test_opt_in_r6_oidc_browser_pg15():
    dsn = os.environ.get("ANVIL_F20_R6_PG_DSN")
    isolated = os.environ.get("ANVIL_F20_R6_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R6 isolated PG15 browser opt-in not configured; E2E unverified")
    url = _validated_target(dsn, isolated)
    _run_opt_in(dsn, url)
