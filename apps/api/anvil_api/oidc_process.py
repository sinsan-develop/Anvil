"""Fail-closed server-only OIDC process bootstrap."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import re
import stat

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from packages.api.fastapi_app import AuthorizationScope
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.oidc_runtime_factory import OidcRuntimeRejected
from packages.persistence.config import DatabaseSettings


_KEYS = frozenset({
    "pinned_jwks_json", "allowed_roles", "allowed_permissions",
    "allowed_project_ids", "allowed_environment_ids", "scope_roles",
    "scope_project_id", "scope_environment_id", "ca_bundle_file",
    "client_secret_file",
})
_POLICY = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z", re.ASCII)


def _reject() -> OidcRuntimeRejected:
    return OidcRuntimeRejected("OIDC_RUNTIME_NOT_CONFIGURED")


def _regular_path(value: object) -> Path:
    if type(value) is not str or not value or "\x00" in value:
        raise _reject()
    path = Path(value)
    if not path.is_absolute() or not stat.S_ISREG(path.lstat().st_mode):
        raise _reject()
    return path


def _read_bounded(path: Path, limit: int) -> bytes:
    if path.stat().st_size > limit:
        raise _reject()
    # O_NOFOLLOW closes the final-component replacement window on POSIX.
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise _reject()
        contents = os.read(descriptor, limit + 1)
        if len(contents) > limit:
            raise _reject()
        return contents
    finally:
        os.close(descriptor)


def _set(value: object) -> frozenset[str]:
    if (type(value) is not list or not value
            or any(type(item) is not str or _POLICY.fullmatch(item) is None for item in value)
            or len(set(value)) != len(value)):
        raise _reject()
    return frozenset(value)


def _value(value: object) -> str:
    if type(value) is not str or _POLICY.fullmatch(value) is None:
        raise _reject()
    return value


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise _reject()
        result[key] = value
    return result


@dataclass(frozen=True)
class OidcProcessInputs:
    principal_policy: OidcPrincipalPolicy
    authorization_scope: AuthorizationScope
    pinned_jwks_json: str = field(repr=False)
    ca_bundle: str
    client_secret: Callable[[], str] = field(repr=False)


def _load_oidc_process_inputs(environment: Mapping[str, str]) -> OidcProcessInputs:
    try:
        if not isinstance(environment, Mapping):
            raise _reject()
        path = _regular_path(environment.get("ANVIL_F18_OIDC_TRUST_FILE"))
        document = json.loads(_read_bounded(path, 65536).decode("utf-8"),
                              object_pairs_hook=_unique_pairs)
        if type(document) is not dict or set(document) != _KEYS:
            raise _reject()
        if type(document["pinned_jwks_json"]) is not str or not document["pinned_jwks_json"]:
            raise _reject()
        roles = _set(document["allowed_roles"])
        permissions = _set(document["allowed_permissions"])
        projects = _set(document["allowed_project_ids"])
        environments = _set(document["allowed_environment_ids"])
        scope_roles = _set(document["scope_roles"])
        scope_project = _value(document["scope_project_id"])
        scope_environment = _value(document["scope_environment_id"])
        if (not scope_roles <= roles or scope_project not in projects
                or scope_environment not in environments):
            raise _reject()
        ca = _regular_path(document["ca_bundle_file"])
        secret_path = _regular_path(document["client_secret_file"])
        issuer = environment.get("ANVIL_OIDC_ISSUER")
        if type(issuer) is not str or not issuer:
            raise _reject()

        def client_secret() -> str:
            try:
                _regular_path(str(secret_path))
                value = _read_bounded(secret_path, 4096).decode("utf-8")
                if not value or value != value.strip() or any(ord(ch) < 33 for ch in value):
                    raise _reject()
            except Exception:
                value = None
            if value is None:
                raise _reject()
            return value

        return OidcProcessInputs(
            OidcPrincipalPolicy(issuer, roles, permissions, projects, environments),
            AuthorizationScope(scope_project, scope_environment, scope_roles),
            document["pinned_jwks_json"], str(ca), client_secret,
        )
    except Exception:
        return None


def load_oidc_process_inputs(environment: Mapping[str, str]) -> OidcProcessInputs:
    """Load exact server trust without reading the code-exchange secret."""
    inputs = _load_oidc_process_inputs(environment)
    if inputs is None:
        raise _reject()
    return inputs


def create_oidc_process_app(
    environment: Mapping[str, str], host_factory: Callable[..., FastAPI],
) -> FastAPI:
    """Bind one Engine and session factory to the existing OIDC ASGI host."""
    inputs = load_oidc_process_inputs(environment)
    engine = None
    try:
        settings = DatabaseSettings.from_environment(environment)
        engine = create_engine(settings.dsn, pool_pre_ping=True)
        sessions = sessionmaker(bind=engine, expire_on_commit=False)
        scope = inputs.authorization_scope
        return host_factory(
            environment=environment, engine=engine, session_factory=sessions,
            authorization_resolver=lambda _endpoint, _params: scope,
            principal_policy=inputs.principal_policy,
            pinned_jwks_json=inputs.pinned_jwks_json,
            client_secret=inputs.client_secret, ca_bundle=inputs.ca_bundle,
            operational_shell=environment.get("ANVIL_F15_OPERATIONAL_SHELL") == "1",
        )
    except Exception:
        if engine is not None:
            engine.dispose()
    raise _reject()
