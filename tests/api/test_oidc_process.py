"""Server-owned OIDC process configuration and ASGI selection."""

import json
import os
from pathlib import Path
import subprocess
import sys

import pytest
import sqlalchemy as sa
from fastapi import FastAPI

from packages.api.oidc_runtime_factory import OidcRuntimeRejected


ROOT = Path(__file__).resolve().parents[2]
ISSUER = "https://issuer.example.test/realms/anvil"


def _environment(path):
    return {
        "ANVIL_AUTH_MODE": "OIDC",
        "ANVIL_F18_OIDC_TRUST_FILE": str(path),
        "ANVIL_OIDC_ISSUER": ISSUER,
        "ANVIL_OIDC_CLIENT_ID": "anvil-web",
        "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil.example.test",
        "ANVIL_PUBLIC_HOST": "anvil.example.test",
        "ANVIL_DATABASE_URL": "postgresql://isolated.invalid/anvil",
    }


def _trust(tmp_path):
    ca = tmp_path / "ca.pem"
    secret = tmp_path / "secret"
    ca.write_text("synthetic CA")
    secret.write_text("synthetic-client-secret")
    payload = {
        "pinned_jwks_json": '{"keys":[]}',
        "allowed_roles": ["operator"],
        "allowed_permissions": ["provider:read"],
        "allowed_project_ids": ["project-1"],
        "allowed_environment_ids": ["wsl-qa"],
        "scope_roles": ["operator"],
        "scope_project_id": "project-1",
        "scope_environment_id": "wsl-qa",
        "ca_bundle_file": str(ca),
        "client_secret_file": str(secret),
    }
    path = tmp_path / "trust.json"
    path.write_text(json.dumps(payload))
    return path, payload, secret


def _rejected(environment):
    from apps.api.anvil_api.oidc_process import load_oidc_process_inputs

    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        load_oidc_process_inputs(environment)
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_oidc_module_import_fails_closed_without_trust():
    env = os.environ.copy()
    for key in tuple(env):
        if key.startswith("ANVIL_") or key.startswith("TELEGRAM_"):
            env.pop(key)
    env["ANVIL_AUTH_MODE"] = "OIDC"
    run = subprocess.run(
        [sys.executable, "-B", "-c", "import apps.api.anvil_api.asgi"],
        cwd=ROOT, env=env, capture_output=True, text=True, timeout=30,
    )
    assert run.returncode != 0
    assert "OIDC_RUNTIME_NOT_CONFIGURED" in run.stderr


def test_loader_accepts_exact_trust_and_reads_secret_lazily(tmp_path, monkeypatch):
    from apps.api.anvil_api.oidc_process import load_oidc_process_inputs

    path, _, secret = _trust(tmp_path)
    original = Path.read_text

    def guarded_read(self, *args, **kwargs):
        if self == secret:
            pytest.fail("secret read during startup")
        return original(self, *args, **kwargs)

    with monkeypatch.context() as patch:
        patch.setattr(Path, "read_text", guarded_read)
        inputs = load_oidc_process_inputs(_environment(path))
    assert inputs.principal_policy.issuer == ISSUER
    assert inputs.authorization_scope.project_id == "project-1"
    assert inputs.authorization_scope.allowed_actor_roles == frozenset({"operator"})
    assert inputs.ca_bundle == str(tmp_path / "ca.pem")
    assert inputs.client_secret() == "synthetic-client-secret"
    assert "synthetic-client-secret" not in repr(inputs)


@pytest.mark.parametrize("change", [
    {"allowed_roles": []},
    {"allowed_roles": ["*"]},
    {"allowed_roles": ["operator", "operator"]},
    {"scope_roles": ["other"]},
    {"scope_project_id": "other"},
    {"scope_environment_id": "other"},
    {"extra": "unknown"},
    {"allowed_permissions": None},
])
def test_loader_rejects_invalid_policy_or_unknown_key(tmp_path, change):
    path, payload, _ = _trust(tmp_path)
    payload.update(change)
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))


def test_loader_rejects_missing_key_duplicate_key_and_oversize(tmp_path):
    path, payload, _ = _trust(tmp_path)
    del payload["allowed_roles"]
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))
    path.write_text('{"x":1,"x":2}')
    _rejected(_environment(path))
    path.write_text(" " * (65536 + 1))
    _rejected(_environment(path))


def test_loader_rejects_relative_and_symlink_paths(tmp_path):
    path, payload, secret = _trust(tmp_path)
    _rejected(_environment(Path("relative.json")))
    link = tmp_path / "link"
    link.symlink_to(path)
    _rejected(_environment(link))
    payload["client_secret_file"] = "relative.secret"
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))
    payload["client_secret_file"] = str(tmp_path / "secret-link")
    (tmp_path / "secret-link").symlink_to(secret)
    path.write_text(json.dumps(payload))
    _rejected(_environment(path))


def test_secret_read_failure_is_stable_and_nonreflective(tmp_path):
    from apps.api.anvil_api.oidc_process import load_oidc_process_inputs

    path, _, secret = _trust(tmp_path)
    inputs = load_oidc_process_inputs(_environment(path))
    secret.unlink()
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        inputs.client_secret()
    assert error.value.__cause__ is None and error.value.__context__ is None


def test_process_factory_binds_one_engine_and_disposes_on_host_failure(tmp_path, monkeypatch):
    from apps.api.anvil_api import oidc_process

    path, _, _ = _trust(tmp_path)
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    made = []
    disposed = []
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_kw: made.append(engine) or engine)
    monkeypatch.setattr(engine, "dispose", lambda: disposed.append(True))

    def host(**kwargs):
        assert kwargs["engine"] is engine
        with kwargs["session_factory"]() as session:
            assert session.get_bind() is engine
        assert kwargs["authorization_resolver"](None, {}).project_id == "project-1"
        return FastAPI()

    assert isinstance(oidc_process.create_oidc_process_app(_environment(path), host), FastAPI)
    assert made == [engine] and disposed == []

    def failing_host(**_kwargs):
        raise RuntimeError("sensitive path and DSN")

    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        oidc_process.create_oidc_process_app(_environment(path), failing_host)
    assert error.value.__cause__ is None and error.value.__context__ is None
    assert made == [engine, engine] and disposed == [True]


@pytest.mark.parametrize("flag,expected", [("1", True), ("0", False), ("true", False)])
def test_process_factory_preserves_operational_shell_flag(tmp_path, monkeypatch, flag, expected):
    from apps.api.anvil_api import oidc_process

    path, _, _ = _trust(tmp_path)
    environment = _environment(path)
    environment["ANVIL_F15_OPERATIONAL_SHELL"] = flag
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    monkeypatch.setattr(oidc_process, "create_engine", lambda *_a, **_kw: engine)
    observed = []

    def host(**kwargs):
        observed.append(kwargs.get("operational_shell"))
        return FastAPI()

    try:
        oidc_process.create_oidc_process_app(environment, host)
        assert observed == [expected]
    finally:
        engine.dispose()
