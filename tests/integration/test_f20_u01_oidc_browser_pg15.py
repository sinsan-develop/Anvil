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
import stat
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

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
_TEST_ALERT = {"level": "critical", "related_entity_id": "r6-run",
               "cause": "Worker lease expiry observed", "next_action": "REVIEW_WORKER_LEASE",
               "deep_link": "/operations"}
_PG_DATA_PATH = "/var/lib/postgresql/data"
_EVIDENCE_FILES = ("pre-auth-error.png", "stored-critical.png", "revoked-blocked.png",
                   "page-requests.json")
_BROWSER_STAGES = frozenset({
    "BOOTSTRAP", "PLAYWRIGHT_REQUIRE", "BROWSER_LAUNCH", "BROWSER_CONTEXT",
    "ISSUER_CONTEXT", "PAGE_CREATE", "PRE_AUTH_DOCUMENT", "PRE_AUTH_CARD",
    "PRE_AUTH_RESPONSES", "PRE_AUTH_LOADING_REQUESTS", "PRE_AUTH_LOADING_DOM",
    "PRE_AUTH_KEYBOARD", "PRE_AUTH_LOADING_RELEASE",
    "PRE_AUTH_FETCH", "PRE_AUTH_CARD_CHECK", "OIDC_AUTH_REQUEST",
    "OIDC_ISSUER_REDIRECT", "OIDC_CALLBACK", "OIDC_SESSION", "OIDC_COOKIE",
    "EMPTY_ALERT_FETCH", "EMPTY_DASHBOARD_FETCH", "EMPTY_DOCUMENT", "EMPTY_CARD",
    "EMPTY_RESPONSES", "EMPTY_ASSERT", "SEED_CONTROL",
    "ERROR_DOCUMENT", "ERROR_CARD", "ERROR_RESPONSES", "ERROR_ASSERT",
    "STORED_ALERT_FETCH", "STORED_DOCUMENT", "STORED_CARD", "STORED_RESPONSES",
    "STORED_ALERT_WAIT", "STORED_NEXT_ACTION",
    "STORED_ROW", "REVOKE_CONTROL", "REVOKE_FETCH", "REVOKE_DOCUMENT",
    "REVOKE_CARD", "REVOKE_RESPONSES", "REVOKE_CLEAR", "NETWORK_REQUEST_FACTS",
    "NETWORK_RESPONSE_FACTS", "NETWORK_DOM", "NETWORK_IDP_STATE",
    "NETWORK_ASSERT", "EVIDENCE_PRE_AUTH", "EVIDENCE_STORED", "EVIDENCE_REVOKED",
    "ISSUER_DISPOSE", "BROWSER_CLOSE", "EVIDENCE_EXPORT",
})
_BROWSER_ERROR_CLASSES = frozenset({
    "AssertionError", "Error", "TypeError", "TimeoutError", "SyntaxError",
    "ReferenceError", "RangeError", "AggregateError", "TargetClosedError",
})
_RESPONSE_CATEGORIES = frozenset({
    "DOCUMENT", "ASSET", "ALERT_API", "HEALTH_API", "PROVIDER_API", "DASHBOARD_API",
    "EVENT_REPLAY_API", "OIDC_AUTH", "OTHER_API", "OTHER_APP", "UNKNOWN",
})
_RESPONSE_FAILURE_STAGES = frozenset({
    "PRE_AUTH_RESPONSES", "STORED_RESPONSES", "REVOKE_RESPONSES",
    "NETWORK_RESPONSE_FACTS",
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


def _last_browser_progress(output: bytes | str | None) -> str:
    if isinstance(output, bytes):
        output = output.decode("utf-8", errors="replace")
    if not isinstance(output, str):
        return "RUNNER"
    last = "RUNNER"
    for match in re.finditer(r"^R6_STAGE ([A-Z_]+)\r?$", output, flags=re.MULTILINE):
        if match.group(1) in _BROWSER_STAGES:
            last = match.group(1)
    return last


def _safe_response_diagnostic(output: str) -> str:
    detail = ""
    for match in re.finditer(
        r"^R6_(RESPONSE_CAPTURE|PHASE_RESPONSE)_FAILED category=([A-Z_]+) "
        r"status=([0-9]{1,3}) reason=([A-Z_]+)\r?$", output, flags=re.MULTILINE,
    ):
        kind, category, raw_status, reason = match.groups()
        status = int(raw_status)
        valid_reason = ((kind == "RESPONSE_CAPTURE" and reason in {"TIMEOUT", "UNREADABLE"})
                        or (kind == "PHASE_RESPONSE" and reason in {
                            "WAIT_TIMEOUT", "WAIT_ERROR", "CAPTURE_MISSING"}))
        if (category in _RESPONSE_CATEGORIES and (status == 0 or 100 <= status <= 599)
                and valid_reason):
            detail = f" category={category} status={status} reason={reason}"
    return detail


def _safe_probe_diagnostic(output: str) -> str:
    detail = ""
    for match in re.finditer(
        r"^R6_RESPONSE_PROBE category=PROVIDER_API status=401 "
        r"length=(MISSING|ZERO|POSITIVE|INVALID) "
        r"transfer=(MISSING|CHUNKED|OTHER) "
        r"finished=(DONE|ERROR|TIMEOUT) "
        r"native=(READABLE_401|EMPTY_BODY|OTHER_STATUS|ERROR|TIMEOUT)\r?$",
        output, flags=re.MULTILINE,
    ):
        length, transfer, finished, native = match.groups()
        detail = (f" length={length} transfer={transfer} finished={finished} "
                  f"native={native}")
    return detail


def _safe_network_diagnostic(output: str) -> str:
    return _safe_response_diagnostic(output) + _safe_probe_diagnostic(output)


def _safe_route_diagnostic(output: str) -> str:
    return (" R23_ROUTE_CONTINUE_FAILED"
            if re.search(r"^R23_ROUTE_CONTINUE_FAILED\r?$", output, flags=re.MULTILINE)
            else "")


def _safe_stored_diagnostic(output: str) -> str:
    detail = ""
    for match in re.finditer(
        r"^R24_STORED_UI_DIAG directStatus=([0-9]{1,3}) directActions=(INVALID|[0-9]{1,3}) "
        r"reloadStatus=([0-9]{1,3}) reloadActions=(INVALID|[0-9]{1,3}) "
        r"dom=(ROW|EMPTY|LOADING|BLOCKED|UNAVAILABLE|OTHER)\r?$",
        output, flags=re.MULTILINE,
    ):
        direct_status, direct_actions, reload_status, reload_actions, dom = match.groups()
        counts = (direct_actions, reload_actions)
        if (all(status == "0" or 100 <= int(status) <= 599
                for status in (direct_status, reload_status))
                and all(count == "INVALID" or int(count) <= 100 for count in counts)):
            detail = (f" directStatus={direct_status} directActions={direct_actions}"
                      f" reloadStatus={reload_status} reloadActions={reload_actions} dom={dom}")
    for match in re.finditer(
        r"^R24_STORED_COMPARE directExpected=(YES|NO|INVALID) "
        r"reloadExpected=(YES|NO|INVALID) domExpected=(YES|NO|INVALID) "
        r"domReload=(YES|NO|INVALID) rows=(INVALID|[0-9]{1,3}) "
        r"visible=(YES|NO|INVALID)\r?$", output, flags=re.MULTILINE,
    ):
        direct_expected, reload_expected, dom_expected, dom_reload, rows, visible = match.groups()
        if rows == "INVALID" or int(rows) <= 100:
            detail += (f" directExpected={direct_expected} reloadExpected={reload_expected}"
                       f" domExpected={dom_expected} domReload={dom_reload}"
                       f" rows={rows} visible={visible}")
    return detail


def _diagnostic_drain_mode() -> bool:
    value = os.environ.get("ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK")
    assert value in (None, "1"), "R6_DIAG_FLAG_INVALID"
    return value == "1"


def _requested_evidence_dir(value: str | None, sha7: str, *,
                            root: Path = Path("/tmp"), diagnostic: bool) -> Path | None:
    if value is None:
        return None
    expected = root / ("anvil-u01-r6-evidence-" + sha7)
    try:
        path = Path(value)
        details = path.lstat()
        owner = os.getuid() if hasattr(os, "getuid") else details.st_uid
        valid = (re.fullmatch(r"[0-9a-f]{7}", sha7) is not None
                 and not diagnostic and path.is_absolute() and path == expected
                 and root.resolve(strict=True) == root
                 and path.resolve(strict=True) == path
                 and stat.S_ISDIR(details.st_mode) and not path.is_symlink()
                 and details.st_uid == owner
                 and (os.name == "nt" or details.st_mode & 0o077 == 0)
                 and not any(path.iterdir()))
    except (OSError, RuntimeError, ValueError):
        valid = False
    if not valid:
        raise ValueError("R6_EVIDENCE_DIR_REJECTED") from None
    return expected


def _verify_evidence_artifacts(directory: Path, api_url: str, count: int) -> None:
    try:
        assert {item.name for item in directory.iterdir()} == set(_EVIDENCE_FILES)
        for name in _EVIDENCE_FILES[:3]:
            path = directory / name
            assert path.is_file() and not path.is_symlink()
            with path.open("rb") as stream:
                header = stream.read(24)
            assert (header[:16] == b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
                    and int.from_bytes(header[16:20], "big") == 1920
                    and int.from_bytes(header[20:24], "big") == 1080)
        manifest = directory / "page-requests.json"
        assert manifest.is_file() and not manifest.is_symlink()
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        assert isinstance(payload, dict) and set(payload) == {"scope", "pageRequestCount", "urls"}
        assert payload["scope"] == "R6B_LOOPBACK_QA_ONLY"
        urls = payload["urls"]
        assert (type(payload["pageRequestCount"]) is int and payload["pageRequestCount"] == count
                and isinstance(urls, list) and len(urls) == count and count > 0)
        for url in urls:
            assert isinstance(url, str) and url == urlsplit(url).geturl()
            parsed = urlsplit(url)
            assert (parsed.scheme == "https" and parsed.netloc == urlsplit(api_url).netloc
                    and parsed.path.startswith("/") and not parsed.query and not parsed.fragment
                    and parsed.username is None and parsed.password is None)
    except (AssertionError, OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise AssertionError("R6_EVIDENCE_ARTIFACT_REJECTED") from None


def _finish_r6_evidence(evidence: dict, *, diagnostic: bool) -> None:
    if diagnostic:
        assert evidence.get("diagnosticDrainMode") is True
        nonok = evidence.get("diagnosticNonOkDrainCount")
        provider = evidence.get("diagnosticProvider401DrainCount")
        assert (type(nonok) is int and type(provider) is int
                and nonok >= provider >= 1), "R6_DIAG_DRAIN_INCOMPLETE"
        print("R6_DIAGNOSTIC_EVIDENCE " + json.dumps({
            "nonOkDrainCount": nonok, "provider401DrainCount": provider,
        }, sort_keys=True))
        pytest.skip("R6_DIAGNOSTIC_ONLY_NOT_ACCEPTANCE")
    print("R6_E2E_EVIDENCE " + json.dumps(evidence, sort_keys=True))


def _r23_loading_evidence(evidence: dict) -> dict:
    expected = {
        "loadingCardCount": 6, "loadingNextActions": True,
        "loadingCriticalAlerts": True, "dashboardTabFocused": True,
        "sidebarEnterToggle": True, "heldRequestCount": 4,
        "individuallyReleased": True,
    }
    actual = {key: evidence.get(key) for key in expected}
    assert all(type(actual[key]) is type(value) and actual[key] == value
               for key, value in expected.items()), "R23_LOADING_BROWSER_EVIDENCE_MISMATCH"
    return actual


def _r25_task1_evidence(evidence: dict) -> dict:
    expected = ("r25PreAuthAccessible", "r25LoadingKeyboardStable")
    actual = {key: evidence.get(key) for key in expected}
    assert all(type(value) is bool and value is True for value in actual.values()), (
        "R25_TASK1_BROWSER_EVIDENCE_MISMATCH"
    )
    return actual


def _r25_task2_evidence(evidence: dict) -> dict:
    expected = ("r25EmptyErrorDistinct", "r25RevokedRowsInaccessible")
    actual = {key: evidence.get(key) for key in expected}
    assert all(type(value) is bool and value is True for value in actual.values()), (
        "R25_TASK2_BROWSER_EVIDENCE_MISMATCH"
    )
    return actual


def _r24_empty_evidence(evidence: dict) -> dict:
    expected = {"emptyCriticalAlerts": True, "emptyNextActions": True,
                "emptyIsObserved": True}
    actual = {key: evidence.get(key) for key in expected}
    assert all(type(actual[key]) is bool and actual[key] is True for key in expected), (
        "R24_EMPTY_BROWSER_EVIDENCE_MISMATCH"
    )
    return actual


def _r24_error_evidence(evidence: dict) -> dict:
    expected = {"errorIsNotZero": True, "independentCardsPreserved": True,
                "errorBodyHidden": True, "r23Regression": True}
    actual = {key: evidence.get(key) for key in expected}
    assert all(type(actual[key]) is bool and actual[key] is True for key in expected), (
        "R24_ERROR_BROWSER_EVIDENCE_MISMATCH"
    )
    return actual


def _r28_manual_evidence(evidence: dict, observed_at: str) -> dict:
    refresh = {"manualRefreshClicked": True, "manualRefreshRequestCount": 1,
               "manualRefreshObservedAt": observed_at, "independentCardsPreserved": True}
    expected = {**{key: value for key, value in refresh.items()
                   if key != "independentCardsPreserved"},
                "revokedManualRefreshStatus": 403,
                "revokedManualRefreshCleared": True, "revokedManualRefreshFromStored": True,
                "failedRefresh503": {"requestCount": 1, "responseStatus": 503,
                                     "failClosed": True},
                "failedRefreshInvalid": {"requestCount": 1, "responseStatus": 200,
                                         "failClosed": True},
                "keyboardRefreshEvidence": refresh.copy()}

    def exact(actual: object, required: dict) -> bool:
        return (type(actual) is dict and actual.keys() == required.keys()
                and all(type(actual[key]) is type(value)
                        and (exact(actual[key], value) if type(value) is dict
                             else actual[key] == value)
                        for key, value in required.items()))

    assert exact(evidence, expected), "R28_BROWSER_EVIDENCE_MISMATCH"
    return evidence


def _r24_seed_result(before_count: int, snapshot: list[dict]) -> dict:
    assert before_count == 0 and len(snapshot) == 1, "R24_PG_NOT_EMPTY"
    fields = ("code", "level", "cause", "related_entity_id", "next_action", "deep_link")
    return {"before_count": before_count, "seeded_count": len(snapshot),
            "stored_alert": {field: snapshot[0][field] for field in fields}}


def _node_flow(api_url: str, issuer_url: str, control_token: str,
               dsn: str, alert: dict, evidence_dir: Path | None = None) -> dict:
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
    if _diagnostic_drain_mode():
        environment["ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK"] = "1"
    if evidence_dir is not None:
        environment["ANVIL_F20_R6_EVIDENCE_DIR"] = str(evidence_dir)
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
    except subprocess.TimeoutExpired as error:
        stage = _last_browser_progress(error.stdout)
        stdout = (error.stdout.decode("utf-8", errors="replace") if isinstance(error.stdout, bytes)
                  else error.stdout if isinstance(error.stdout, str) else "")
        detail = _safe_network_diagnostic(stdout) if stage in _RESPONSE_FAILURE_STAGES else ""
        pytest.fail(f"R6_BROWSER_FAILED stage={stage} exit=TIMEOUT class=TimeoutExpired; "
                    f"MAIN_NAMED_CONTAINER_CLEANUP_REQUIRED{detail}", pytrace=False)
    except OSError:
        pytest.fail("R6_BROWSER_FAILED stage=RUNNER exit=LAUNCH class=OSError", pytrace=False)
    if result.returncode != 0:
        stage, error_class = _classify_browser_failure(result.stdout, result.stderr)
        detail = (_safe_network_diagnostic(result.stdout + "\n" + result.stderr)
                  if stage in _RESPONSE_FAILURE_STAGES else "")
        detail += _safe_route_diagnostic(result.stdout)
        if stage == "STORED_NEXT_ACTION":
            detail += _safe_stored_diagnostic(result.stdout)
        pytest.fail(f"R6_BROWSER_FAILED stage={stage} exit={result.returncode} "
                    f"class={error_class}{detail}", pytrace=False)
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

    diagnostic = _diagnostic_drain_mode()
    _guard_pg_container(url)
    evidence_dir = _requested_evidence_dir(
        os.environ.get("ANVIL_F20_R6_EVIDENCE_DIR"), url.database.removeprefix("anvil_f20_r3a_"),
        diagnostic=diagnostic,
    )
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
    seeded_alerts = []
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

        @issuer_app.post("/r6-control/seed")
        async def seed(request: Request):
            if not hmac.compare_digest(request.headers.get("x-r6-control-token", ""), control_token):
                return JSONResponse({"error": "forbidden"}, status_code=403)
            if seeded_alerts:
                return JSONResponse({"error": "already_seeded"}, status_code=409)
            with engine.connect() as db:
                count = db.execute(sa.text("SELECT count(*) FROM operations_audit_events")).scalar_one()
            assert count == 0 and owner.alerts() == [], "R24_PG_NOT_EMPTY"
            assert owner.detect() == 1, "R6_PG_ALERT_SEED_FAILED"
            snapshot = owner.alerts()
            assert [alert["code"] for alert in snapshot] == [_ALERT_CODE]
            result = _r24_seed_result(count, snapshot)
            seeded_alerts.append(snapshot)
            return result

        listeners.append(_listener(issuer_app, issuer_cert, issuer_key))
        issuer_url = listeners[0][3] + "/realms/anvil"
        with engine.begin() as db:
            db.execute(users.insert().values(actor_id="r6-actor", active=True))
            db.execute(roles.insert().values(role_code="operator", permissions=[
                "provider:read", "operations:alerts:read", "dashboard:read",
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
        assert owner.alerts() == [], "R24_PG_NOT_EMPTY"
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
                frozenset({"provider:read", "operations:alerts:read", "dashboard:read"}),
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
        evidence = _node_flow(api_url, issuer_url, control_token, dsn, _TEST_ALERT, evidence_dir)
        assert len(seeded_alerts) == 1, "R24_SEED_MISSING"
        before = seeded_alerts[0]
        loading_evidence = _r23_loading_evidence(evidence)
        r25_task1_evidence = _r25_task1_evidence(evidence)
        r25_task2_evidence = _r25_task2_evidence(evidence)
        empty_evidence = _r24_empty_evidence(evidence)
        error_evidence = _r24_error_evidence(evidence)
        assert evidence.get("pageRequestCount", 0) > 0, "R6_PAGE_NETWORK_EMPTY"
        assert evidence.get("appApiRequestCount", 0) > 0, "R6_API_NETWORK_EMPTY"
        diagnostic_keys = {"diagnosticDrainMode", "diagnosticNonOkDrainCount",
                           "diagnosticProvider401DrainCount"}
        artifact_keys = {"evidenceExported"}
        if diagnostic:
            assert evidence.get("diagnosticDrainMode") is True, "R6_DIAG_MODE_NOT_ACTIVE"
        else:
            assert not diagnostic_keys.intersection(evidence), "R6_DIAG_MODE_UNEXPECTED"
        if evidence_dir is not None:
            assert evidence.get("evidenceExported") is True, "R6_EVIDENCE_OUTPUT_MISSING"
        else:
            assert not artifact_keys.intersection(evidence), "R6_EVIDENCE_OUTPUT_UNEXPECTED"
        expected_legacy = {
            "preAuthStatus": 401, "authorizationStatus": 200, "callbackStatus": 200,
            "sessionAuthenticated": True, "cookieSecure": True, "cookieHttpOnly": True,
            "storedStatus": 200, "storedAlertCode": _ALERT_CODE, "visibleBeforeRevoke": True,
            "storedEntity": before[0]["related_entity_id"],
            "storedCause": before[0]["cause"], "rowMatches": True,
            "dashboardStatus": 200, "actionCount": 1, "alertApiDomMatch": True,
            "revokedDashboardStatus": 403, "revokedActionCount": 0,
            "revokedActionCleared": True,
            "revokedStatus": 403, "staleCleared": True,
            "allAppRequestsSameOrigin": True, "idpContextSeparate": True,
            "offOriginCredentialLeak": False, "secretExposure": False,
        }
        prior_keys = ({"pageRequestCount", "appApiRequestCount"}
                      | diagnostic_keys | artifact_keys | set(loading_evidence)
                      | set(r25_task1_evidence) | set(r25_task2_evidence)
                      | set(empty_evidence) | set(error_evidence))
        r28_candidate = {key: value for key, value in evidence.items()
                         if key not in prior_keys | set(expected_legacy)}
        r28_evidence = _r28_manual_evidence(r28_candidate, at.isoformat())
        checked = {key: value for key, value in evidence.items()
                   if key not in prior_keys | set(r28_evidence)}
        assert checked == expected_legacy, "R6_BROWSER_EVIDENCE_MISMATCH"
        assert revoke_count == [1], "R6_REVOKE_MISSING"
        assert len(token_requests) == 1, "R6_TOKEN_EXCHANGE_COUNT_INVALID"
        assert owner.alerts() == before, "R6_GET_MUTATED_AUDIT"
        with engine.connect() as db:
            assert db.execute(sa.select(sa.func.count()).select_from(oidc_sessions)).scalar_one() == 1
            assert db.execute(sa.select(sa.func.count()).select_from(oidc_pending_auth)).scalar_one() == 0
        if evidence_dir is not None:
            _verify_evidence_artifacts(evidence_dir, api_url, evidence["pageRequestCount"])
        _finish_r6_evidence(evidence, diagnostic=diagnostic)
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
        ("", f"R6_BROWSER_FAILED stage=PRE_AUTH_FETCH class=Error\n{secret}",
         ("PRE_AUTH_FETCH", "Error")),
        ("R6_NODE_STARTED\nR6_BROWSER_FAILED stage=PRE_AUTH_DOCUMENT class=TimeoutError\n", "",
         ("PRE_AUTH_DOCUMENT", "TimeoutError")),
        ("R6_NODE_STARTED\nR6_BROWSER_FAILED stage=PRE_AUTH_RESPONSES class=Error\n", "",
         ("PRE_AUTH_RESPONSES", "Error")),
        ("R6_BROWSER_FAILED stage=OIDC_AUTH_REQUEST class=AssertionError\n", "",
         ("OIDC_AUTH_REQUEST", "AssertionError")),
        ("R6_NODE_STARTED\nR6_BROWSER_FAILED stage=STORED_NEXT_ACTION class=TimeoutError\n", "",
         ("STORED_NEXT_ACTION", "TimeoutError")),
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


def test_r6_timeout_reports_last_whitelisted_progress_without_raw_output(monkeypatch):
    secret = "private-dsn-or-token"
    partial_stdout = ("R6_STAGE PRE_AUTH_DOCUMENT\n" + secret + "\n"
                      "R6_STAGE NETWORK_RESPONSE_FACTS\nR6_STAGE PRIVATE_SECRET\n"
                      "R6_RESPONSE_CAPTURE_FAILED category=ALERT_API status=200 "
                      "reason=TIMEOUT\n").encode()

    def timed_out(*_args, **_kwargs):
        raise subprocess.TimeoutExpired(cmd="browser", timeout=120, output=partial_stdout,
                                        stderr=secret.encode())

    monkeypatch.setattr(subprocess, "run", timed_out)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    alert = _TEST_ALERT
    with pytest.raises(pytest.fail.Exception) as failure:
        _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
                   "postgresql://isolated@127.0.0.1:5545/isolated", alert)
    message = str(failure.value)
    assert "stage=NETWORK_RESPONSE_FACTS exit=TIMEOUT class=TimeoutExpired" in message
    assert "category=ALERT_API status=200 reason=TIMEOUT" in message
    assert "MAIN_NAMED_CONTAINER_CLEANUP_REQUIRED" in message
    assert secret not in message
    assert "PRIVATE_SECRET" not in message


def test_r6_response_capture_failure_reports_only_safe_category_status(monkeypatch):
    secret = "private-dsn-or-token"
    stdout = ("R6_NODE_STARTED\nR6_STAGE NETWORK_RESPONSE_FACTS\n"
              "R6_RESPONSE_CAPTURE_FAILED category=ALERT_API status=200 reason=TIMEOUT\n"
              + secret)
    stderr = "R6_BROWSER_FAILED stage=NETWORK_RESPONSE_FACTS class=Error\n" + secret

    def failed(*_args, **_kwargs):
        return subprocess.CompletedProcess(args=["browser"], returncode=1,
                                           stdout=stdout, stderr=stderr)

    monkeypatch.setattr(subprocess, "run", failed)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    alert = _TEST_ALERT
    with pytest.raises(pytest.fail.Exception) as failure:
        _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
                   "postgresql://isolated@127.0.0.1:5545/isolated", alert)
    message = str(failure.value)
    assert "stage=NETWORK_RESPONSE_FACTS exit=1 class=Error" in message
    assert "category=ALERT_API status=200 reason=TIMEOUT" in message
    assert secret not in message


def test_r23_route_failure_reports_only_fixed_marker(monkeypatch):
    secret = "private-route-detail"

    def failed(*_args, **_kwargs):
        return subprocess.CompletedProcess(
            args=["browser"], returncode=1,
            stdout="R6_NODE_STARTED\nR6_STAGE PRE_AUTH_LOADING_RELEASE\n"
                   f"R23_ROUTE_CONTINUE_FAILED\n{secret}",
            stderr=f"R6_BROWSER_FAILED stage=PRE_AUTH_LOADING_RELEASE class=Error\n{secret}",
        )

    monkeypatch.setattr(subprocess, "run", failed)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    with pytest.raises(pytest.fail.Exception) as failure:
        _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
                   "postgresql://isolated@127.0.0.1:5545/isolated", _TEST_ALERT)
    message = str(failure.value)
    assert "stage=PRE_AUTH_LOADING_RELEASE exit=1 class=Error" in message
    assert "R23_ROUTE_CONTINUE_FAILED" in message
    assert secret not in message


def test_r24_stored_timeout_reports_only_whitelisted_diagnostic(monkeypatch):
    secret = "private-response-body"
    stdout = ("R6_NODE_STARTED\nR6_STAGE STORED_NEXT_ACTION\n"
              "R24_STORED_UI_DIAG directStatus=200 directActions=1 "
              "reloadStatus=200 reloadActions=1 dom=ROW\n"
              "R24_STORED_COMPARE directExpected=YES reloadExpected=NO "
              "domExpected=NO domReload=YES rows=1 visible=YES\n" + secret)

    def failed(*_args, **_kwargs):
        return subprocess.CompletedProcess(
            args=["browser"], returncode=1, stdout=stdout,
            stderr="R6_BROWSER_FAILED stage=STORED_NEXT_ACTION class=TimeoutError\n" + secret,
        )

    monkeypatch.setattr(subprocess, "run", failed)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    with pytest.raises(pytest.fail.Exception) as failure:
        _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
                   "postgresql://isolated@127.0.0.1:5545/isolated", _TEST_ALERT)
    message = str(failure.value)
    assert "stage=STORED_NEXT_ACTION exit=1 class=TimeoutError" in message
    assert "directStatus=200 directActions=1 reloadStatus=200 reloadActions=1 dom=ROW" in message
    assert ("directExpected=YES reloadExpected=NO domExpected=NO "
            "domReload=YES rows=1 visible=YES") in message
    assert secret not in message


@pytest.mark.parametrize(("stage", "marker", "expected"), [
    ("PRE_AUTH_RESPONSES",
     "R6_RESPONSE_CAPTURE_FAILED category=PROVIDER_API status=401 reason=TIMEOUT",
     "category=PROVIDER_API status=401 reason=TIMEOUT"),
    ("PRE_AUTH_RESPONSES",
     "R6_PHASE_RESPONSE_FAILED category=HEALTH_API status=0 reason=WAIT_TIMEOUT",
     "category=HEALTH_API status=0 reason=WAIT_TIMEOUT"),
    ("STORED_RESPONSES",
     "R6_PHASE_RESPONSE_FAILED category=ALERT_API status=200 reason=CAPTURE_MISSING",
     "category=ALERT_API status=200 reason=CAPTURE_MISSING"),
])
def test_r6_phase_response_failure_reports_only_safe_diagnostic(monkeypatch, stage, marker,
                                                               expected):
    secret = "private-dsn-or-token"

    def failed(*_args, **_kwargs):
        return subprocess.CompletedProcess(
            args=["browser"], returncode=1,
            stdout=f"R6_NODE_STARTED\nR6_STAGE {stage}\n{marker}\n{secret}",
            stderr=f"R6_BROWSER_FAILED stage={stage} class=Error\n{secret}",
        )

    monkeypatch.setattr(subprocess, "run", failed)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    alert = _TEST_ALERT
    with pytest.raises(pytest.fail.Exception) as failure:
        _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
                   "postgresql://isolated@127.0.0.1:5545/isolated", alert)
    message = str(failure.value)
    assert f"stage={stage} exit=1 class=Error" in message
    assert expected in message
    assert secret not in message


def test_r6_provider_401_probe_reports_only_fixed_facts(monkeypatch):
    secret = "private-dsn-or-token"

    def failed(*_args, **_kwargs):
        return subprocess.CompletedProcess(
            args=["browser"], returncode=1,
            stdout=("R6_NODE_STARTED\nR6_STAGE PRE_AUTH_RESPONSES\n"
                    "R6_RESPONSE_PROBE category=PROVIDER_API status=401 length=POSITIVE "
                    "transfer=CHUNKED finished=TIMEOUT native=READABLE_401\n"
                    "R6_RESPONSE_CAPTURE_FAILED category=PROVIDER_API status=401 "
                    f"reason=TIMEOUT\n{secret}"),
            stderr=f"R6_BROWSER_FAILED stage=PRE_AUTH_RESPONSES class=Error\n{secret}",
        )

    monkeypatch.setattr(subprocess, "run", failed)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    alert = _TEST_ALERT
    with pytest.raises(pytest.fail.Exception) as failure:
        _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
                   "postgresql://isolated@127.0.0.1:5545/isolated", alert)
    message = str(failure.value)
    assert "stage=PRE_AUTH_RESPONSES exit=1 class=Error" in message
    assert "category=PROVIDER_API status=401 reason=TIMEOUT" in message
    assert "length=POSITIVE transfer=CHUNKED finished=TIMEOUT native=READABLE_401" in message
    assert secret not in message


def test_r6_diagnostic_drain_is_opt_in_and_passed_to_browser_only_when_enabled(monkeypatch):
    observed = []

    def succeeded(*_args, **kwargs):
        observed.append(kwargs["env"])
        return subprocess.CompletedProcess(args=["browser"], returncode=0,
                                           stdout='R6_RESULT {"diagnosticDrainMode":true}\n',
                                           stderr="")

    monkeypatch.setattr(subprocess, "run", succeeded)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    monkeypatch.delenv("ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK", raising=False)
    alert = _TEST_ALERT
    assert _diagnostic_drain_mode() is False
    _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
               "postgresql://isolated@127.0.0.1:5545/isolated", alert)
    assert "ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK" not in observed[-1]
    monkeypatch.setenv("ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK", "1")
    assert _diagnostic_drain_mode() is True
    _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
               "postgresql://isolated@127.0.0.1:5545/isolated", alert)
    assert observed[-1]["ANVIL_F20_R6_DIAGNOSTIC_DRAIN_NONOK"] == "1"


def test_r6_diagnostic_evidence_cannot_be_acceptance(capsys):
    evidence = {"diagnosticDrainMode": True, "diagnosticNonOkDrainCount": 3,
                "diagnosticProvider401DrainCount": 1}
    with pytest.raises(pytest.skip.Exception, match="R6_DIAGNOSTIC_ONLY_NOT_ACCEPTANCE"):
        _finish_r6_evidence(evidence, diagnostic=True)
    output = capsys.readouterr().out
    assert "R6_DIAGNOSTIC_EVIDENCE " in output
    assert "R6_E2E_EVIDENCE " not in output


def test_r24_seed_control_uses_actual_persisted_action_not_fixture():
    actual = {"code": _ALERT_CODE, "level": "critical", "cause": _TEST_ALERT["cause"],
              "related_entity_id": _TEST_ALERT["related_entity_id"],
              "next_action": "REVIEW_WORKER_TAKEOVER", "deep_link": "/operations/workers",
              "evidence_hash": "private-not-forwarded"}
    assert _r24_seed_result(0, [actual]) == {
        "before_count": 0, "seeded_count": 1,
        "stored_alert": {key: actual[key] for key in (
            "code", "level", "cause", "related_entity_id", "next_action", "deep_link")},
    }
    assert actual["next_action"] != _TEST_ALERT["next_action"]
    assert actual["deep_link"] != _TEST_ALERT["deep_link"]


def test_r24_node_does_not_forward_fixture_action_as_expected(monkeypatch):
    observed = []

    def succeeded(*_args, **kwargs):
        observed.append(kwargs["env"])
        return subprocess.CompletedProcess(args=["browser"], returncode=0,
                                           stdout='R6_RESULT {}\n', stderr="")

    monkeypatch.setattr(subprocess, "run", succeeded)
    monkeypatch.delenv("ANVIL_F20_R6_BROWSER_COMMAND_JSON", raising=False)
    alert = {"level": "critical", "cause": "Worker lease expiry observed",
             "related_entity_id": "r6-run", "next_action": "REVIEW_WORKER_LEASE",
             "deep_link": "/operations", "evidence_hash": "private-not-forwarded"}
    _node_flow("https://127.0.0.1:48123", "https://127.0.0.1:48124", "control-token",
               "postgresql://isolated@127.0.0.1:5545/isolated", alert)
    assert "ANVIL_F20_R6_EXPECTED_ACTION_JSON" not in observed[-1]
    assert "private-not-forwarded" not in json.dumps(observed[-1])


def test_r23_loading_browser_evidence_is_exact_and_fail_closed():
    expected = {"loadingCardCount": 6, "loadingNextActions": True,
                "loadingCriticalAlerts": True, "dashboardTabFocused": True,
                "sidebarEnterToggle": True, "heldRequestCount": 4,
                "individuallyReleased": True}
    assert _r23_loading_evidence(expected) == expected
    for key, bad in (("loadingCardCount", 5), ("loadingNextActions", False),
                     ("loadingCriticalAlerts", False), ("dashboardTabFocused", False),
                     ("sidebarEnterToggle", False), ("heldRequestCount", 3),
                     ("individuallyReleased", False)):
        with pytest.raises(AssertionError, match="R23_LOADING_BROWSER_EVIDENCE_MISMATCH"):
            _r23_loading_evidence({**expected, key: bad})
    with pytest.raises(AssertionError, match="R23_LOADING_BROWSER_EVIDENCE_MISMATCH"):
        _r23_loading_evidence({**expected, "loadingCardCount": True})


def test_r25_pre_auth_and_loading_keyboard_facts_are_strict_booleans():
    expected = {"r25PreAuthAccessible": True, "r25LoadingKeyboardStable": True}
    assert _r25_task1_evidence(expected) == expected
    for key in expected:
        with pytest.raises(AssertionError, match="R25_TASK1_BROWSER_EVIDENCE_MISMATCH"):
            _r25_task1_evidence({**expected, key: False})
        with pytest.raises(AssertionError, match="R25_TASK1_BROWSER_EVIDENCE_MISMATCH"):
            _r25_task1_evidence({**expected, key: 1})


def test_r25_empty_error_and_revocation_facts_are_strict_booleans():
    expected = {"r25EmptyErrorDistinct": True, "r25RevokedRowsInaccessible": True}
    assert _r25_task2_evidence(expected) == expected
    for key in expected:
        with pytest.raises(AssertionError, match="R25_TASK2_BROWSER_EVIDENCE_MISMATCH"):
            _r25_task2_evidence({**expected, key: False})
        with pytest.raises(AssertionError, match="R25_TASK2_BROWSER_EVIDENCE_MISMATCH"):
            _r25_task2_evidence({**expected, key: 1})


def test_r24_empty_browser_evidence_requires_real_observed_zero():
    expected = {"emptyCriticalAlerts": True, "emptyNextActions": True,
                "emptyIsObserved": True}
    assert _r24_empty_evidence(expected) == expected
    for key in expected:
        with pytest.raises(AssertionError, match="R24_EMPTY_BROWSER_EVIDENCE_MISMATCH"):
            _r24_empty_evidence({**expected, key: False})
    with pytest.raises(AssertionError, match="R24_EMPTY_BROWSER_EVIDENCE_MISMATCH"):
        _r24_empty_evidence({**expected, "emptyCriticalAlerts": 1})


def test_r24_error_browser_evidence_requires_isolated_failure():
    expected = {"errorIsNotZero": True, "independentCardsPreserved": True,
                "errorBodyHidden": True, "r23Regression": True}
    assert _r24_error_evidence(expected) == expected
    for key in expected:
        with pytest.raises(AssertionError, match="R24_ERROR_BROWSER_EVIDENCE_MISMATCH"):
            _r24_error_evidence({**expected, key: False})
    with pytest.raises(AssertionError, match="R24_ERROR_BROWSER_EVIDENCE_MISMATCH"):
        _r24_error_evidence({**expected, "errorBodyHidden": 1})


def test_r28_manual_refresh_evidence_requires_exact_keys_values_and_observation():
    observed_at = "2026-09-28T00:00:00+00:00"
    refresh = {"manualRefreshClicked": True, "manualRefreshRequestCount": 1,
               "manualRefreshObservedAt": observed_at, "independentCardsPreserved": True}
    expected = {**{key: value for key, value in refresh.items()
                   if key != "independentCardsPreserved"},
                "revokedManualRefreshStatus": 403,
                "revokedManualRefreshCleared": True, "revokedManualRefreshFromStored": True,
                "failedRefresh503": {"requestCount": 1, "responseStatus": 503,
                                     "failClosed": True},
                "failedRefreshInvalid": {"requestCount": 1, "responseStatus": 200,
                                         "failClosed": True},
                "keyboardRefreshEvidence": refresh.copy()}
    assert _r28_manual_evidence(expected, observed_at) == expected
    shared = {"errorIsNotZero": True, "independentCardsPreserved": True,
              "errorBodyHidden": True, "r23Regression": True}
    assert _r24_error_evidence(shared)["independentCardsPreserved"] is True
    for bad in (False, 1, None):
        with pytest.raises(AssertionError, match="R24_ERROR_BROWSER_EVIDENCE_MISMATCH"):
            _r24_error_evidence({**shared, "independentCardsPreserved": bad})
    for key in expected:
        with pytest.raises(AssertionError, match="R28_BROWSER_EVIDENCE_MISMATCH"):
            _r28_manual_evidence({name: value for name, value in expected.items()
                                  if name != key}, observed_at)
    for changed in (
        {"manualRefreshClicked": 1}, {"manualRefreshRequestCount": True},
        {"manualRefreshRequestCount": 2}, {"manualRefreshObservedAt": "invalid"},
        {"independentCardsPreserved": False}, {"revokedManualRefreshStatus": 200},
        {"revokedManualRefreshCleared": 1}, {"revokedManualRefreshFromStored": False},
        {"failedRefresh503": {**expected["failedRefresh503"], "responseStatus": 200}},
        {"failedRefreshInvalid": {**expected["failedRefreshInvalid"], "failClosed": 1}},
        {"keyboardRefreshEvidence": {**refresh, "manualRefreshObservedAt": "other"}},
        {"failedRefresh503": {**expected["failedRefresh503"], "extra": True}},
        {"keyboardRefreshEvidence": {**refresh, "extra": True}},
        {"unexpectedManualEvidence": True},
    ):
        with pytest.raises(AssertionError, match="R28_BROWSER_EVIDENCE_MISMATCH"):
            _r28_manual_evidence({**expected, **changed}, observed_at)


def test_r6_evidence_directory_is_exact_empty_owned_and_diagnostic_off(tmp_path):
    sha7 = "c3a7626"
    directory = tmp_path / ("anvil-u01-r6-evidence-" + sha7)
    directory.mkdir(mode=0o700)
    assert _requested_evidence_dir(str(directory), sha7, root=tmp_path,
                                   diagnostic=False) == directory
    assert _requested_evidence_dir(None, sha7, root=tmp_path, diagnostic=False) is None
    for value in ("relative/evidence", str(tmp_path / "other"),
                  str(tmp_path / "anvil-u01-r6-evidence-other")):
        with pytest.raises(ValueError, match="R6_EVIDENCE_DIR_REJECTED"):
            _requested_evidence_dir(value, sha7, root=tmp_path, diagnostic=False)
    with pytest.raises(ValueError, match="R6_EVIDENCE_DIR_REJECTED"):
        _requested_evidence_dir(str(directory), sha7, root=tmp_path, diagnostic=True)
    (directory / "occupied").write_text("not ours", encoding="utf-8")
    with pytest.raises(ValueError, match="R6_EVIDENCE_DIR_REJECTED"):
        _requested_evidence_dir(str(directory), sha7, root=tmp_path, diagnostic=False)
    (directory / "occupied").unlink()
    if os.name != "nt":
        directory.chmod(0o755)
        with pytest.raises(ValueError, match="R6_EVIDENCE_DIR_REJECTED"):
            _requested_evidence_dir(str(directory), sha7, root=tmp_path, diagnostic=False)
        directory.chmod(0o700)
        directory.rmdir()
        directory.symlink_to(tmp_path, target_is_directory=True)
        with pytest.raises(ValueError, match="R6_EVIDENCE_DIR_REJECTED"):
            _requested_evidence_dir(str(directory), sha7, root=tmp_path, diagnostic=False)


def test_r6_evidence_artifacts_require_three_1920x1080_pngs_and_safe_full_urls(tmp_path):
    names = ("pre-auth-error.png", "stored-critical.png", "revoked-blocked.png")
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
           + (1920).to_bytes(4, "big") + (1080).to_bytes(4, "big"))
    for name in names:
        (tmp_path / name).write_bytes(png)
    urls = ["https://127.0.0.1:48123/", "https://127.0.0.1:48123/api/providers"]
    manifest = tmp_path / "page-requests.json"
    manifest.write_text(json.dumps({"scope": "R6B_LOOPBACK_QA_ONLY",
                                    "pageRequestCount": 2, "urls": urls}), encoding="utf-8")
    _verify_evidence_artifacts(tmp_path, "https://127.0.0.1:48123", 2)
    manifest.write_text(json.dumps({"scope": "R6B_LOOPBACK_QA_ONLY",
                                    "pageRequestCount": 2,
                                    "urls": [urls[0], urls[1] + "?code=private"]}), encoding="utf-8")
    with pytest.raises(AssertionError, match="R6_EVIDENCE_ARTIFACT_REJECTED"):
        _verify_evidence_artifacts(tmp_path, "https://127.0.0.1:48123", 2)


def test_r6_node_evidence_writer_uses_only_the_opt_in_empty_directory(tmp_path):
    directory = tmp_path / "anvil-u01-r6-evidence-c3a7626"
    directory.mkdir()
    environment = os.environ.copy()
    environment["ANVIL_F20_R6_SELFTEST_EVIDENCE_DIR"] = str(directory)
    script = Path(__file__).resolve().parents[1] / "browser" / "f20-u01-oidc-browser-pg15.mjs"
    result = subprocess.run(["node", str(script), "--audit-self-test"], shell=False,
                            env=environment, capture_output=True, text=True, timeout=15, check=False)
    assert result.returncode == 0, "R6_EVIDENCE_SELFTEST_FAILED"
    assert {item.name for item in directory.iterdir()} == set(_EVIDENCE_FILES)
    payload = json.loads((directory / "page-requests.json").read_text(encoding="utf-8"))
    assert payload == {"scope": "R6B_LOOPBACK_QA_ONLY", "pageRequestCount": 3,
                       "urls": ["https://127.0.0.1:9/",
                                "https://127.0.0.1:9/api/operations/alerts",
                                "https://127.0.0.1:9/api/operations/alerts"]}
    assert "private-token" not in result.stdout + result.stderr
    assert "https://127.0.0.1:9" not in result.stdout + result.stderr


def test_opt_in_r6_oidc_browser_pg15():
    dsn = os.environ.get("ANVIL_F20_R6_PG_DSN")
    isolated = os.environ.get("ANVIL_F20_R6_PG_ISOLATED")
    if dsn is None and isolated is None:
        pytest.skip("R6 isolated PG15 browser opt-in not configured; E2E unverified")
    url = _validated_target(dsn, isolated)
    _run_opt_in(dsn, url)
