"""Opt-in R48 two-instance ACK CAS against an isolated disposable PG15 DB."""

from concurrent.futures import ThreadPoolExecutor
import base64
from datetime import datetime, timezone
import hashlib
import inspect
import importlib
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import tempfile
from threading import Barrier
from urllib.parse import parse_qs, urlencode
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
import jwt
import pytest
from psycopg.conninfo import conninfo_to_dict
import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from cryptography.hazmat.primitives.asymmetric import rsa

from packages.api.fastapi_app import AuthorizationScope
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.observability.projection import OperationsSources
from packages.observability.service import OperationsError, OperationsService
from packages.persistence.operations_repository import PostgresOperationsRepository
from packages.persistence.oidc_principal_directory import (
    oidc_subject_bindings, roles, user_roles, users,
)
from tests.integration.f18_oidc_live_host import _certificate, _listener


HASH = "sha256:" + "a" * 64


def _isolated_dsn() -> str:
    dsn = os.environ.get("ANVIL_U01_R48_PG_DSN")
    if not dsn:
        pytest.skip("R48 isolated PostgreSQL 15 opt-in is not configured")
    url = make_url(dsn)
    database = url.database
    if (os.environ.get("ANVIL_U01_R48_PG_ISOLATED") != "1"
            or url.drivername not in {"postgresql", "postgresql+psycopg"}
            or url.host not in {"127.0.0.1", "localhost"} or url.port != 5545
            or bool(url.query)
            or not database or re.fullmatch(r"anvil_f20_r48_[0-9a-f]{7}", database) is None
            or url.username != database):
        pytest.fail("R48_PG_TARGET_NOT_ISOLATED")
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


def _sqlalchemy_dsn(libpq_dsn: str) -> str:
    return make_url(libpq_dsn).set(drivername="postgresql+psycopg").render_as_string(
        hide_password=False)


def _close_qa_resources(engine, listeners) -> None:
    """Close processes/connections; the entire isolated DB is discarded by Main."""
    primary = sys.exc_info()[1]
    errors = []
    for server, thread, listener, _ in reversed(listeners):
        try:
            server.should_exit = True
            thread.join(timeout=5)
            if thread.is_alive():
                raise RuntimeError("R48_LISTENER_RESIDUE")
        except Exception as error:
            errors.append(error)
        try:
            listener.close()
        except Exception as error:
            errors.append(error)
    try:
        engine.dispose()
    except Exception as error:
        errors.append(error)
    if errors and primary is not None:
        for error in errors:
            primary.add_note(f"R48_CLEANUP_ERROR:{type(error).__name__}")
    elif errors:
        raise errors[0]


_R48_SAFE_STAGES = frozenset({"BOOTSTRAP", "BROWSER_LAUNCH", "BROWSER_CONTEXT",
    "PREAUTH", "POPUP_OPEN", "CALLBACK", "REDIRECT_GET", "REDIRECT_HEADERS",
    "REDIRECT_SCRUB", "REDIRECT_REFERER", "ACK", "AUDIT", "DONE"})
_R48_SAFE_CODES = frozenset({"UNCLASSIFIED", "R48_SCENARIO_INVALID",
    "R48_CALLBACK_REJECTED", "R48_CSRF_MISSING", "R48_REDIRECT_GET_MISSING",
    "R48_REDIRECT_HEADER_REFERRER", "R48_REDIRECT_HEADER_CACHE",
    "R48_REDIRECT_URL_NOT_SCRUBBED", "R48_HISTORY_STATE_LEAK",
    "R48_DOM_SECRET_LEAK", "R48_REFERER_LEAK", "R48_POPUP_NOT_CLOSED",
    "R48_REFERER_CLEAN_ROOT", "R48_REFERER_CODE_OR_STATE",
    "R48_REFERER_OTHER", "R48_REFERER_HEADER_VIEW_MISMATCH",
    "R48_OPEN_ALERT_MISSING", "R48_ORIGIN_NOT_DENIED", "R48_CSRF_NOT_DENIED",
    "R48_ORIGIN_WRONG_DENIAL", "R48_CSRF_WRONG_DENIAL",
    "R48_PERMISSION_NOT_DENIED", "R48_PERMISSION_DENIAL_CODE",
    "R48_ACK_REJECTED", "R48_ACK_PAYLOAD_INVALID",
    "R48_AUDIT_PERMISSION_NOT_DENIED", "R48_AUDIT_DENIAL_CODE",
    "R48_ACK_RETRANSMITTED", "R48_AUDIT_PAGE_NOT_INTERCEPTED",
    "R48_FALSE_SUCCESS", "R48_BROWSER_API_NOT_SAME_ORIGIN"})


def _r48_safe_failure(stderr: str) -> str:
    for line in stderr.splitlines():
        match = re.fullmatch(r"R48_SAFE_FAILURE scenario=(redirect|permission-denied|"
            r"audit-denied|audit-unreachable|normal|invalid) stage=([A-Z_]+) "
            r"code=([A-Z0-9_]+) name=(AssertionError|Error|TypeError|TimeoutError|"
            r"SyntaxError|ReferenceError|RangeError|AggregateError|TargetClosedError)", line)
        if match and match.group(2) in _R48_SAFE_STAGES and match.group(3) in _R48_SAFE_CODES:
            return line
    return "R48_DIAGNOSTIC_UNAVAILABLE"


def _r48_safe_referer_fact(stdout: str) -> str:
    for line in stdout.splitlines():
        if re.fullmatch(r"R48_REFERER_FACT headers=(ABSENT|CLEAN_ROOT|CODE_OR_STATE|OTHER) "
                r"all=(ABSENT|CLEAN_ROOT|CODE_OR_STATE|OTHER) "
                r"value=(ABSENT|CLEAN_ROOT|CODE_OR_STATE|OTHER)", line):
            return line
    return "R48_REFERER_FACT_UNAVAILABLE"


def test_r48_disposable_cleanup_does_not_mask_primary_or_delete_append_only_rows():
    class BrokenEngine:
        def dispose(self):
            raise RuntimeError("cleanup failed")

    with pytest.raises(ValueError, match="primary failed") as caught:
        try:
            raise ValueError("primary failed")
        finally:
            _close_qa_resources(BrokenEngine(), ())
    assert any("R48_CLEANUP_ERROR" in note for note in caught.value.__notes__)
    for flow in (test_two_service_instances_append_exactly_one_critical_ack,
                 test_r48_oidc_popup_and_ack_browser_with_isolated_pg15):
        source = inspect.getsource(flow)
        assert "DELETE FROM operations_audit" not in source
        assert "oidc_sessions.delete()" not in source


def test_r48_browser_diagnostic_accepts_only_static_safe_fields():
    line = ("R48_SAFE_FAILURE scenario=redirect stage=REDIRECT_HEADERS "
        "code=R48_REDIRECT_HEADER_REFERRER name=AssertionError")
    assert _r48_safe_failure(line + "\nprivate-code=secret") == line
    assert _r48_safe_failure(line.replace("R48_REDIRECT_HEADER_REFERRER",
        "R48_PRIVATE_CODE")) == "R48_DIAGNOSTIC_UNAVAILABLE"
    assert _r48_safe_failure(line + " private-token") == "R48_DIAGNOSTIC_UNAVAILABLE"
    fact = "R48_REFERER_FACT headers=CLEAN_ROOT all=CLEAN_ROOT value=CLEAN_ROOT"
    assert _r48_safe_referer_fact(fact + "\nprivate-code=secret") == fact
    assert _r48_safe_referer_fact(fact + " private-token") == "R48_REFERER_FACT_UNAVAILABLE"


def test_r48_isolated_dsn_keeps_psycopg3_and_denies_other_targets(monkeypatch):
    database = "anvil_f20_r48_abcdef0"
    monkeypatch.setenv("ANVIL_U01_R48_PG_ISOLATED", "1")
    for driver in ("postgresql", "postgresql+psycopg"):
        monkeypatch.setenv("ANVIL_U01_R48_PG_DSN",
            f"{driver}://{database}@127.0.0.1:5545/{database}")
        libpq_dsn = _isolated_dsn()
        assert libpq_dsn == f"postgresql://{database}@127.0.0.1:5545/{database}"
        assert conninfo_to_dict(libpq_dsn) == {"user": database, "host": "127.0.0.1",
            "port": "5545", "dbname": database}
        engine = sa.create_engine(_sqlalchemy_dsn(libpq_dsn), connect_args={"connect_timeout": 2})
        try:
            args, kwargs = engine.dialect.create_connect_args(engine.url)
            assert args == []
            assert kwargs["host"] == "127.0.0.1" and kwargs["port"] == 5545
            assert kwargs["user"] == database and kwargs["dbname"] == database
        finally:
            engine.dispose()
    for host, port, user, name in (
            ("remote.invalid", 5545, database, database),
            ("127.0.0.1", 5432, database, database),
            ("127.0.0.1", 5545, "other", database),
            ("127.0.0.1", 5545, database, "other")):
        monkeypatch.setenv("ANVIL_U01_R48_PG_DSN",
            f"postgresql+psycopg://{user}@{host}:{port}/{name}")
        with pytest.raises(pytest.fail.Exception, match="R48_PG_TARGET_NOT_ISOLATED"):
            _isolated_dsn()
    for override in ("host=remote.invalid", "dbname=other"):
        monkeypatch.setenv("ANVIL_U01_R48_PG_DSN",
            f"postgresql+psycopg://{database}@127.0.0.1:5545/{database}?{override}")
        with pytest.raises(pytest.fail.Exception, match="R48_PG_TARGET_NOT_ISOLATED"):
            _isolated_dsn()


def test_two_service_instances_append_exactly_one_critical_ack():
    dsn = _isolated_dsn()
    engine = sa.create_engine(_sqlalchemy_dsn(dsn))
    project = "r48-" + uuid4().hex
    environment = "qa"
    alert_id = "alert-" + uuid4().hex
    observed = datetime.now(timezone.utc).isoformat()
    repository = PostgresOperationsRepository(dsn)
    alert = {"alert_id": alert_id, "level": "critical", "source": "worker",
        "category": "availability", "code": "WORKER_LEASE_EXPIRED",
        "related_entity_id": "run-1",
        "dedupe_key": f"f13-r2:{project}:{environment}:WORKER_LEASE_EXPIRED:run-1",
        "detector_rule_revision": "f13-r2", "cause": "Worker lease expiry observed",
        "impact": "Run ownership cannot be trusted", "next_action": "REVIEW_WORKER_TAKEOVER",
        "deep_link": "/operations/workers", "evidence_hash": HASH,
        "status": "open", "owner_id": None, "observed_at": observed,
        "project_id": project, "environment_id": environment}
    detected = {"action": "DETECTED", "alert_id": alert_id,
        "actor_id": "system:detector", "at": observed, "approval_id": None,
        "evidence_hash": HASH, "alert": alert}
    try:
        repository.append(project, environment, 0, detected)
        barrier = Barrier(2)

        def attempt(index: int) -> str:
            service = OperationsService(project, environment, OperationsSources(),
                repository=PostgresOperationsRepository(dsn))
            barrier.wait()
            try:
                service.acknowledge_critical(alert_id, actor_id="qa-operator",
                    expected_sequence=1, evidence_hash=HASH,
                    receipt=f"ack:attempt-{index}")
                return "committed"
            except OperationsError as error:
                return str(error)

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(attempt, (1, 2)))
        assert sorted(outcomes) == ["ACK_CONFLICT", "committed"]
        events = repository.load(project, environment)
        assert [event["action"] for event in events] == ["DETECTED", "ACKNOWLEDGED"]
        assert events[-1]["approval_id"].startswith("ack:")
    finally:
        _close_qa_resources(engine, ())


def test_r48_oidc_popup_and_ack_browser_with_isolated_pg15():
    dsn = _isolated_dsn()
    frontend = Path(__file__).resolve().parents[2] / "apps" / "web" / "dist"
    if not (frontend / "index.html").is_file():
        pytest.fail("R48_FRONTEND_BUILD_REQUIRED")
    engine = sa.create_engine(_sqlalchemy_dsn(dsn), connect_args={"connect_timeout": 2})
    with engine.connect() as connection:
        database, username, version = connection.execute(sa.text(
            "SELECT current_database(), current_user, current_setting('server_version_num')::integer"
        )).one()
    assert database == username == make_url(dsn).database and 150000 <= version < 160000
    project, environment = "r48-project", "r48-qa"
    actor, role, subject = "r48-actor", "r48-operator", "r48-subject"
    alert_id = "alert-" + uuid4().hex
    listeners = []
    issuer_url = None
    try:
        with tempfile.TemporaryDirectory(prefix="anvil-r48-") as temporary:
            directory = Path(temporary)
            issuer_cert, issuer_key = _certificate(directory, "issuer")
            api_cert, api_key = _certificate(directory, "api")
            signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing_key.public_key()))
            public.update(kid="r48-key", use="sig", alg="RS256")
            issued = {}
            issuer = FastAPI()

            @issuer.get("/realms/anvil/protocol/openid-connect/auth")
            async def authorize(request: Request):
                query = request.query_params
                if (query.get("response_type") != "code" or query.get("client_id") != "anvil-web"
                        or query.get("redirect_uri") != api_url + "/"
                        or not query.get("state") or not query.get("nonce")
                        or query.get("code_challenge_method") != "S256"):
                    return JSONResponse({"error": "invalid_request"}, status_code=400)
                code = "r48-code-" + secrets.token_urlsafe(16)
                issued[code] = {key: query[key] for key in (
                    "state", "nonce", "redirect_uri", "client_id", "code_challenge")}
                return RedirectResponse(api_url + "/?" + urlencode({
                    "code": code, "state": query["state"]}), status_code=302)

            @issuer.post("/realms/anvil/protocol/openid-connect/token")
            async def token(request: Request):
                form = {key: values[0] for key, values in parse_qs(
                    (await request.body()).decode("ascii")).items()}
                try:
                    client, secret = base64.b64decode(request.headers["authorization"].split(" ", 1)[1]
                        ).decode("ascii").split(":", 1)
                    saved = issued.pop(form["code"])
                    challenge = base64.urlsafe_b64encode(hashlib.sha256(
                        form["code_verifier"].encode()).digest()).rstrip(b"=").decode()
                    assert (client == form["client_id"] == saved["client_id"] == "anvil-web"
                        and secret == "synthetic-client-secret"
                        and form["redirect_uri"] == saved["redirect_uri"] == api_url + "/"
                        and challenge == saved["code_challenge"])
                except (AssertionError, KeyError, ValueError, IndexError):
                    return JSONResponse({"error": "invalid_grant"}, status_code=401)
                now = int(datetime.now(timezone.utc).timestamp())
                return {"id_token": jwt.encode({"iss": issuer_url, "aud": "anvil-web",
                    "sub": subject, "nonce": saved["nonce"], "iat": now, "exp": now + 60},
                    signing_key, algorithm="RS256", headers={"kid": "r48-key"})}

            listeners.append(_listener(issuer, issuer_cert, issuer_key))
            issuer_url = listeners[0][3] + "/realms/anvil"
            api_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            api_socket.bind(("127.0.0.1", 0))
            api_url = f"https://127.0.0.1:{api_socket.getsockname()[1]}"
            with engine.begin() as connection:
                connection.execute(users.insert().values(actor_id=actor, active=True))
                connection.execute(roles.insert().values(role_code=role, permissions=[
                    "operations:alerts:read", "operations:alerts:acknowledge",
                    "operations:audit:read", "dashboard:read"]))
                connection.execute(user_roles.insert().values(actor_id=actor, role_code=role,
                    project_id=project, environment_id=environment,
                    step_up_required=False, active=True))
                connection.execute(oidc_subject_bindings.insert().values(
                    issuer=issuer_url, subject=subject, actor_id=actor, active=True))
            repository = PostgresOperationsRepository(dsn)
            def seed_critical() -> None:
                nonlocal alert_id
                alert_id = "alert-" + uuid4().hex
                observed = datetime.now(timezone.utc).isoformat()
                sequence = len(repository.load(project, environment))
                alert = {"alert_id": alert_id, "level": "critical", "source": "worker",
                    "category": "availability", "code": "WORKER_LEASE_EXPIRED",
                    "related_entity_id": alert_id,
                    "dedupe_key": f"f13-r2:{project}:{environment}:WORKER_LEASE_EXPIRED:{alert_id}",
                    "detector_rule_revision": "f13-r2", "cause": "Worker lease expiry observed",
                    "impact": "Run ownership cannot be trusted",
                    "next_action": "REVIEW_WORKER_TAKEOVER", "deep_link": "/operations/workers",
                    "evidence_hash": HASH, "status": "open", "owner_id": None,
                    "observed_at": observed, "project_id": project,
                    "environment_id": environment}
                repository.append(project, environment, sequence, {"action": "DETECTED",
                    "alert_id": alert_id, "actor_id": "system:detector", "at": observed,
                    "approval_id": None, "evidence_hash": HASH, "alert": alert})

            seed_critical()
            owner = OperationsService(project, environment, OperationsSources(),
                repository=repository)
            environment_vars = {"ANVIL_AUTH_MODE": "OIDC", "ANVIL_PUBLIC_HOST": "127.0.0.1",
                "ANVIL_CONSOLE_BASE_URL": api_url, "ANVIL_OIDC_ISSUER": issuer_url,
                "ANVIL_OIDC_CLIENT_ID": "anvil-web", "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
                "ANVIL_DATABASE_URL": dsn,
                "TELEGRAM_WEBHOOK_SECRET": "synthetic-telegram-secret",
                "TELEGRAM_INTERNAL_SIGNING_SECRET": "synthetic-signing-secret",
                "TELEGRAM_ALLOWED_IDENTITIES": "chat-1:user-1",
                "UPSTAGE_API_KEY": "synthetic-presence"}
            with pytest.MonkeyPatch.context() as startup:
                startup.setenv("ANVIL_DATABASE_URL", "postgresql://isolated.invalid/anvil")
                startup.setenv("TELEGRAM_WEBHOOK_SECRET", "synthetic-telegram-secret")
                startup.setenv("TELEGRAM_INTERNAL_SIGNING_SECRET", "synthetic-signing-secret")
                startup.setenv("TELEGRAM_ALLOWED_IDENTITIES", "chat-1:user-1")
                startup.setenv("ANVIL_CONSOLE_BASE_URL", api_url)
                startup.setenv("ANVIL_PUBLIC_HOST", "127.0.0.1")
                asgi = importlib.import_module("apps.api.anvil_api.asgi")
            app = asgi.create_configured_oidc_asgi_app(
                environment=environment_vars, engine=engine,
                session_factory=sessionmaker(bind=engine),
                authorization_resolver=lambda _endpoint, _params: AuthorizationScope(
                    project, environment, frozenset({role})),
                principal_policy=OidcPrincipalPolicy(issuer_url, frozenset({role}),
                    frozenset({"operations:alerts:read", "operations:alerts:acknowledge",
                        "operations:audit:read", "dashboard:read"}),
                    frozenset({project}), frozenset({environment})),
                pinned_jwks_json=json.dumps({"keys": [public]}),
                client_secret=lambda: "synthetic-client-secret",
                ca_bundle=str(issuer_cert), operations_owner=owner,
                operational_shell=True, frontend_directory=frontend)
            listeners.append(_listener(app, api_cert, api_key, api_socket))
            assert all(server.config.access_log is False for server, _, _, _ in listeners)
            script = Path(__file__).resolve().parents[1] / "browser" / "f20-u01-oidc-browser-pg15.mjs"
            process_environment = {name: value for name, value in os.environ.items()
                if name in {"PATH", "HOME", "TMPDIR", "ANVIL_PLAYWRIGHT_MODULE",
                    "PLAYWRIGHT_BROWSERS_PATH", "LD_LIBRARY_PATH"}}
            process_environment.update(ANVIL_F20_R48_MODE="1", ANVIL_F20_R6_API_URL=api_url,
                ANVIL_F20_R6_ISSUER_URL=issuer_url, ANVIL_F20_R6_ALERT_CODE="WORKER_LEASE_EXPIRED")
            all_permissions = ["operations:alerts:read", "operations:alerts:acknowledge",
                "operations:audit:read", "dashboard:read"]
            scenarios = ("redirect", "permission-denied", "audit-denied",
                "audit-unreachable", "normal")
            for scenario in scenarios:
                if scenario in {"audit-unreachable", "normal"}:
                    seed_critical()
                permissions = [permission for permission in all_permissions
                    if not (scenario == "permission-denied" and permission == "operations:alerts:acknowledge")
                    and not (scenario == "audit-denied" and permission == "operations:audit:read")]
                with engine.begin() as connection:
                    connection.execute(roles.update().where(roles.c.role_code == role).values(
                        permissions=permissions))
                before = repository.load(project, environment)
                process_environment["ANVIL_F20_R48_SCENARIO"] = scenario
                result = subprocess.run([os.environ.get("ANVIL_F20_R6_NODE_BIN", "node"), str(script)],
                    env=process_environment, text=True, capture_output=True, timeout=90, check=False)
                assert result.returncode == 0, (f"R48_BROWSER_{scenario.upper().replace('-', '_')}_FAILED "
                    + _r48_safe_failure(result.stderr) + " "
                    + _r48_safe_referer_fact(result.stdout))
                lines = [line for line in result.stdout.splitlines() if line.startswith("R48_RESULT ")]
                assert len(lines) == 1
                evidence = json.loads(lines[0].removeprefix("R48_RESULT "))
                assert evidence.pop("scenario") == scenario
                after = repository.load(project, environment)
                if scenario == "redirect":
                    assert evidence == {"scrubbed": True, "headersSafe": True,
                        "refererSafe": True}
                    assert after == before
                elif scenario == "permission-denied":
                    assert evidence == {"blocked": True, "postCount": 1}
                    assert after == before
                else:
                    assert [event["action"] for event in after[len(before):]] == ["ACKNOWLEDGED"]
                    assert after[-1]["alert_id"] == alert_id
                    assert evidence["ackSequence"] == len(after)
                    if scenario == "normal":
                        assert evidence == {"ackSequence": len(after), "popupClosed": True,
                            "auditConfirmed": True, "postCount": 1, "csrfOriginDenied": True}
                    else:
                        assert evidence == {"ackSequence": len(after), "blocked": True,
                            "postCount": 1}
    finally:
        _close_qa_resources(engine, listeners)
