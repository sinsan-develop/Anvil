"""Fail-closed F-19A bootstrap for a disposable WSL-server QA database only.

No credentials belong in the manifest. This module does not create databases or
change shared roles. Callers must independently prove the isolated PG15 target.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # Standalone WSL CLI from exact checkout.
import packages.api  # noqa: F401 - Preserve the established API/persistence import order.
from packages.persistence.oidc_principal_directory import users, roles, user_roles, oidc_subject_bindings
from packages.persistence.f19a_registration_repository import (
    pair_grants, registered_projects, registered_environments, registration_audit_events,
)


APPROVAL_SHA = "ADF11125667CA6C374F31462D2ABD7D55C425D7A86019CB7A8D4B9BA8D0A0AF5"
BOOTSTRAP_PERMISSIONS = ["projects:register", "pair-grants:manage"]
OTHER_PERMISSIONS = ["dashboard:read"]
READINESS_PERMISSIONS = frozenset({"dashboard:read", "operations:alerts:read", "operations:alerts:acknowledge"})
MANIFEST_KEYS = frozenset({"approval_sha256", "source_sha", "database_name", "issuer", "subject",
    "actor_id", "role_code", "project_id", "environment_id", "permissions", "expires_at", "revoke_after"})
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
_DB = re.compile(r"anvil_f19a_[0-9a-f]{7}\Z")
_SHA = re.compile(r"[0-9a-f]{40}\Z")


class QABootstrapRejected(ValueError):
    """Stable, non-disclosing QA refusal code."""


def _reject(code: str = "F19A_QA_MANIFEST_INVALID"):
    raise QABootstrapRejected(code)


def validate_qa_manifest(manifest: dict, *, database_name: str, source_sha: str,
                         trusted_pair: tuple[str, str] | None = None,
                         now: datetime | None = None) -> dict:
    """Reject arbitrary targets, stale approval, wildcard scope and secret fields."""
    current = now or datetime.now(timezone.utc)
    if (type(manifest) is not dict or set(manifest) != MANIFEST_KEYS or current.tzinfo is None
            or type(database_name) is not str or _DB.fullmatch(database_name) is None
            or manifest.get("database_name") != database_name
            or type(source_sha) is not str or _SHA.fullmatch(source_sha) is None
            or manifest.get("source_sha") != source_sha
            or manifest.get("approval_sha256") != APPROVAL_SHA
            or manifest.get("permissions") != BOOTSTRAP_PERMISSIONS
            or type(trusted_pair) is not tuple or len(trusted_pair) != 2
            or manifest.get("project_id") != trusted_pair[0]
            or manifest.get("environment_id") != trusted_pair[1]
            or manifest.get("actor_id") != f"f19a_qa_admin_{source_sha[:12]}"
            or manifest.get("role_code") != f"f19a_qa_bootstrap_{source_sha[:12]}"
            or manifest.get("revoke_after") != "isolated-qa-cleanup"):
        _reject()
    for name in ("actor_id", "role_code", "project_id", "environment_id"):
        value = manifest[name]
        if type(value) is not str or _ID.fullmatch(value) is None:
            _reject()
    for name, limit in (("issuer", 2048), ("subject", 512)):
        value = manifest[name]
        if (type(value) is not str or not 1 <= len(value) <= limit or value != value.strip()
                or "*" in value or any(ord(character) < 32 for character in value)):
            _reject()
    if manifest["issuer"] != "https://anvil-f18-qa.local:8444/realms/anvil":
        _reject()
    try:
        expires = datetime.fromisoformat(manifest["expires_at"])
        if (expires.tzinfo is None or not current < expires <= current + timedelta(hours=24)):
            _reject()
    except (TypeError, ValueError):
        _reject()
    return dict(manifest)


def _rows(session, manifest: dict):
    actor, role = manifest["actor_id"], manifest["role_code"]
    queries = (
        sa.select(users).where(users.c.actor_id == actor),
        sa.select(roles).where(roles.c.role_code == role),
        sa.select(user_roles).where(user_roles.c.actor_id == actor),
        sa.select(oidc_subject_bindings).where(oidc_subject_bindings.c.issuer == manifest["issuer"],
            oidc_subject_bindings.c.subject == manifest["subject"]),
    )
    return [session.execute(query).mappings().first() for query in queries]


def _bootstrap_state(session, desired: dict) -> str:
    actor, role, membership, binding = _rows(session, desired)
    other_bindings = session.execute(sa.select(oidc_subject_bindings.c.subject).where(
        oidc_subject_bindings.c.actor_id == desired["actor_id"])).all()
    other_memberships = session.execute(sa.select(user_roles.c.actor_id).where(
        user_roles.c.role_code == desired["role_code"])).all()
    complete = all(row is not None for row in (actor, role, membership, binding))
    absent = all(row is None for row in (actor, role, membership, binding))
    exact = (complete and actor["active"] is True
        and role["permissions"] == BOOTSTRAP_PERMISSIONS
        and membership["role_code"] == desired["role_code"]
        and membership["project_id"] == desired["project_id"]
        and membership["environment_id"] == desired["environment_id"]
        and membership["active"] is True and membership["step_up_required"] is False
        and binding["actor_id"] == desired["actor_id"] and binding["active"] is True
        and len(other_bindings) == 1 and len(other_memberships) == 1)
    if exact:
        return "UNCHANGED"
    if not absent or other_bindings or other_memberships:
        _reject("F19A_QA_IDENTITY_CONFLICT")
    return "CREATABLE"


def preflight_qa_bootstrap(session_factory, manifest: dict, *, database_name: str,
                           source_sha: str, trusted_pair: tuple[str, str] | None = None) -> str:
    desired = validate_qa_manifest(manifest, database_name=database_name, source_sha=source_sha,
                                   trusted_pair=trusted_pair)
    if not callable(session_factory):
        _reject("F19A_QA_DATABASE_UNAVAILABLE")
    try:
        with session_factory() as session:
            return _bootstrap_state(session, desired)
    except QABootstrapRejected:
        raise
    except Exception:
        _reject("F19A_QA_DATABASE_UNAVAILABLE")


def apply_qa_bootstrap(session_factory, manifest: dict, *, database_name: str,
                       source_sha: str, trusted_pair: tuple[str, str] | None = None) -> str:
    """Seed one dedicated principal atomically, only if all four records are absent.

    Exact existing rows are idempotent. Any partial or colliding state is refused
    before the first mutation; database faults also fail closed.
    """
    desired = validate_qa_manifest(manifest, database_name=database_name, source_sha=source_sha,
                                   trusted_pair=trusted_pair)
    if not callable(session_factory):
        _reject("F19A_QA_DATABASE_UNAVAILABLE")
    try:
        with session_factory() as session:
            with session.begin():
                state = _bootstrap_state(session, desired)
                if state == "UNCHANGED":
                    return "UNCHANGED"
                session.execute(users.insert().values(actor_id=desired["actor_id"], active=True))
                session.execute(roles.insert().values(role_code=desired["role_code"],
                                                    permissions=BOOTSTRAP_PERMISSIONS))
                session.execute(user_roles.insert().values(actor_id=desired["actor_id"],
                    role_code=desired["role_code"], project_id=desired["project_id"],
                    environment_id=desired["environment_id"], step_up_required=False, active=True))
                session.execute(oidc_subject_bindings.insert().values(issuer=desired["issuer"],
                    subject=desired["subject"], actor_id=desired["actor_id"], active=True))
                return "CREATED"
    except QABootstrapRejected:
        raise
    except Exception:
        _reject("F19A_QA_DATABASE_UNAVAILABLE")


def validate_other_manifest(manifest: dict, *, database_name: str, source_sha: str,
                            trusted_pair: tuple[str, str] | None = None,
                            now: datetime | None = None, allow_expired_cleanup: bool = False) -> dict:
    """Bind the third QA principal to one fixed subject and one permission."""
    if (type(manifest) is not dict or type(source_sha) is not str or _SHA.fullmatch(source_sha) is None
            or manifest.get("subject") != "f19a-qa-other"
            or manifest.get("actor_id") != f"f19a_qa_other_{source_sha[:12]}"
            or manifest.get("role_code") != f"f19a_qa_other_{source_sha[:12]}"
            or manifest.get("permissions") != OTHER_PERMISSIONS):
        _reject()
    admin_shape = {**manifest, "subject": "synthetic-subject-1",
        "actor_id": f"f19a_qa_admin_{source_sha[:12]}",
        "role_code": f"f19a_qa_bootstrap_{source_sha[:12]}",
        "permissions": BOOTSTRAP_PERMISSIONS}
    validation_time = now or datetime.now(timezone.utc)
    if allow_expired_cleanup:
        try:
            expires = datetime.fromisoformat(manifest["expires_at"])
            if expires.tzinfo is None:
                _reject()
            if expires <= validation_time:
                validation_time = expires - timedelta(seconds=1)
        except (TypeError, ValueError, KeyError):
            _reject()
    validate_qa_manifest(admin_shape, database_name=database_name, source_sha=source_sha,
        trusted_pair=trusted_pair, now=validation_time)
    return dict(manifest)


def _other_state(session, desired: dict) -> str:
    actor, role, membership, binding = _rows(session, desired)
    actor_bindings = session.execute(sa.select(oidc_subject_bindings).where(
        oidc_subject_bindings.c.actor_id == desired["actor_id"])).mappings().all()
    actor_memberships = session.execute(sa.select(user_roles).where(
        user_roles.c.actor_id == desired["actor_id"])).mappings().all()
    role_memberships = session.execute(sa.select(user_roles).where(
        user_roles.c.role_code == desired["role_code"])).mappings().all()
    grants = session.scalar(sa.select(sa.func.count()).select_from(pair_grants).where(
        pair_grants.c.actor_id == desired["actor_id"]))
    complete = all(row is not None for row in (actor, role, membership, binding))
    absent = all(row is None for row in (actor, role, membership, binding))
    exact = (complete and actor["active"] is True and role["permissions"] == OTHER_PERMISSIONS
        and membership["role_code"] == desired["role_code"]
        and membership["project_id"] == desired["project_id"]
        and membership["environment_id"] == desired["environment_id"]
        and membership["active"] is True and membership["step_up_required"] is False
        and binding["actor_id"] == desired["actor_id"] and binding["active"] is True
        and len(actor_bindings) == len(actor_memberships) == len(role_memberships) == 1
        and grants == 0)
    if exact:
        return "UNCHANGED"
    if not absent or actor_bindings or actor_memberships or role_memberships or grants:
        _reject("F19A_QA_OTHER_IDENTITY_CONFLICT")
    return "CREATABLE"


def preflight_qa_other(session_factory, manifest: dict, *, database_name: str,
                       source_sha: str, trusted_pair: tuple[str, str] | None = None) -> str:
    desired = validate_other_manifest(manifest, database_name=database_name, source_sha=source_sha,
                                      trusted_pair=trusted_pair)
    if not callable(session_factory):
        _reject("F19A_QA_DATABASE_UNAVAILABLE")
    try:
        with session_factory() as session:
            return _other_state(session, desired)
    except QABootstrapRejected:
        raise
    except Exception:
        _reject("F19A_QA_DATABASE_UNAVAILABLE")


def apply_qa_other(session_factory, manifest: dict, *, database_name: str,
                   source_sha: str, trusted_pair: tuple[str, str] | None = None) -> str:
    """Seed only an absent third principal; never create a pair grant."""
    desired = validate_other_manifest(manifest, database_name=database_name, source_sha=source_sha,
                                      trusted_pair=trusted_pair)
    if not callable(session_factory):
        _reject("F19A_QA_DATABASE_UNAVAILABLE")
    try:
        with session_factory() as session:
            with session.begin():
                state = _other_state(session, desired)
                if state == "UNCHANGED":
                    return "UNCHANGED"
                session.execute(users.insert().values(actor_id=desired["actor_id"], active=True))
                session.execute(roles.insert().values(role_code=desired["role_code"],
                    permissions=OTHER_PERMISSIONS))
                session.execute(user_roles.insert().values(actor_id=desired["actor_id"],
                    role_code=desired["role_code"], project_id=desired["project_id"],
                    environment_id=desired["environment_id"], step_up_required=False, active=True))
                session.execute(oidc_subject_bindings.insert().values(issuer=desired["issuer"],
                    subject=desired["subject"], actor_id=desired["actor_id"], active=True))
                return "CREATED"
    except QABootstrapRejected:
        raise
    except Exception:
        _reject("F19A_QA_DATABASE_UNAVAILABLE")


def remove_qa_other(session_factory, manifest: dict, *, database_name: str,
                    source_sha: str, trusted_pair: tuple[str, str] | None = None) -> str:
    """Remove only a completely matched, grant-free third QA identity."""
    desired = validate_other_manifest(manifest, database_name=database_name, source_sha=source_sha,
                                      trusted_pair=trusted_pair, allow_expired_cleanup=True)
    if not callable(session_factory):
        _reject("F19A_QA_DATABASE_UNAVAILABLE")
    try:
        with session_factory() as session:
            with session.begin():
                if _other_state(session, desired) == "CREATABLE":
                    return "ABSENT"
                session.execute(oidc_subject_bindings.delete().where(
                    oidc_subject_bindings.c.issuer == desired["issuer"],
                    oidc_subject_bindings.c.subject == desired["subject"],
                    oidc_subject_bindings.c.actor_id == desired["actor_id"]))
                session.execute(user_roles.delete().where(
                    user_roles.c.actor_id == desired["actor_id"],
                    user_roles.c.role_code == desired["role_code"],
                    user_roles.c.project_id == desired["project_id"],
                    user_roles.c.environment_id == desired["environment_id"]))
                session.execute(roles.delete().where(roles.c.role_code == desired["role_code"]))
                session.execute(users.delete().where(users.c.actor_id == desired["actor_id"]))
                return "REMOVED"
    except QABootstrapRejected:
        raise
    except Exception:
        _reject("F19A_QA_DATABASE_UNAVAILABLE")


def validate_isolated_pg15_url(raw: str):
    """Reject every target except a dedicated local QA database before connecting."""
    try:
        url = make_url(raw)
        if (url.drivername not in {"postgresql", "postgresql+psycopg"}
                or url.host not in {"127.0.0.1", "localhost"} or url.port != 5546
                or type(url.database) is not str or _DB.fullmatch(url.database) is None
                or url.username != url.database or not url.password or bool(url.query)):
            _reject("F19A_QA_PG_TARGET_NOT_ISOLATED")
        return url.set(drivername="postgresql+psycopg")
    except (TypeError, ValueError):
        _reject("F19A_QA_PG_TARGET_NOT_ISOLATED")


def _read_manifest(path: Path):
    if not path.is_absolute():
        _reject()
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or (os.name != "nt" and info.st_mode & 0o077):
            _reject()
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        try:
            if not stat.S_ISREG(os.fstat(descriptor).st_mode):
                _reject()
            data = os.read(descriptor, 8193)
        finally:
            os.close(descriptor)
        if not data or len(data) > 8192:
            _reject()
        return json.loads(data)
    except (OSError, ValueError, UnicodeDecodeError):
        _reject()


def _checkout_sha():
    root = Path(__file__).resolve().parents[2]
    try:
        sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root,
            stderr=subprocess.DEVNULL).decode().strip()
        private = subprocess.check_output(["git", "rev-parse", "development/codex/f18-wsl-ops"], cwd=root,
            stderr=subprocess.DEVNULL).decode().strip()
        branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=root,
            stderr=subprocess.DEVNULL).decode().strip()
        status = subprocess.check_output(["git", "status", "--porcelain=v1", "-uall"], cwd=root,
            stderr=subprocess.DEVNULL)
        if _SHA.fullmatch(sha) is None or private != sha or branch != "codex/f18-wsl-ops" or status:
            _reject("F19A_QA_GIT_NOT_CLEAN")
        return sha
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError):
        _reject("F19A_QA_GIT_NOT_CLEAN")


def require_expected_sha(checkout_sha: str, expected_sha: str | None):
    """Bind the observed clean checkout to Main's separately fixed QA run SHA."""
    if (type(checkout_sha) is not str or _SHA.fullmatch(checkout_sha) is None
            or type(expected_sha) is not str or _SHA.fullmatch(expected_sha) is None
            or checkout_sha != expected_sha):
        _reject("F19A_QA_SOURCE_SHA_MISMATCH")
    return checkout_sha


def require_runtime_policy(runtime_inputs, manifest: dict, *, target_role: str | None = None) -> bool:
    """Bound QA identities must be usable by the actual OIDC host, not DB-only."""
    try:
        policy = runtime_inputs.principal_policy
        roles = runtime_inputs.authorization_scope.allowed_actor_roles
        if (policy.issuer != manifest["issuer"]
                or manifest["role_code"] not in policy.allowed_roles
                or manifest["role_code"] not in roles
                or not set(BOOTSTRAP_PERMISSIONS) <= policy.allowed_permissions
                or (target_role is not None and (
                    target_role not in policy.allowed_roles or target_role not in roles
                    or not READINESS_PERMISSIONS <= policy.allowed_permissions))):
            _reject("F19A_QA_RUNTIME_POLICY_NOT_READY")
        return True
    except (AttributeError, KeyError, TypeError):
        _reject("F19A_QA_RUNTIME_POLICY_NOT_READY")


def require_other_runtime_policy(runtime_inputs, manifest: dict) -> bool:
    """The dedicated third role must be usable by the actual OIDC host."""
    try:
        policy = runtime_inputs.principal_policy
        roles = runtime_inputs.authorization_scope.allowed_actor_roles
        if (policy.issuer != manifest["issuer"]
                or manifest["role_code"] not in policy.allowed_roles
                or manifest["role_code"] not in roles
                or not set(OTHER_PERMISSIONS) <= policy.allowed_permissions):
            _reject("F19A_QA_RUNTIME_POLICY_NOT_READY")
        return True
    except (AttributeError, KeyError, TypeError):
        _reject("F19A_QA_RUNTIME_POLICY_NOT_READY")


def main(argv=None):
    parser = argparse.ArgumentParser(description="F-19A isolated WSL-server PG15 QA only")
    parser.add_argument("action", choices=("preflight", "seed", "readiness", "rollback-check",
        "other-preflight", "other-seed", "other-readiness", "other-cleanup"))
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--expected-sha", required=True)
    parser.add_argument("--target-actor-id")
    parser.add_argument("--target-subject")
    parser.add_argument("--target-sha")
    args = parser.parse_args(argv)
    engine = None
    try:
        url = validate_isolated_pg15_url(os.environ.get("ANVIL_F19A_QA_PG_DSN", ""))
        sha = require_expected_sha(_checkout_sha(), args.expected_sha)
        from apps.api.anvil_api.oidc_process import load_oidc_process_inputs
        runtime_inputs = load_oidc_process_inputs(os.environ)
        trusted_pair = (runtime_inputs.authorization_scope.project_id,
                        runtime_inputs.authorization_scope.environment_id)
        other_action = args.action.startswith("other-")
        manifest = (validate_other_manifest if other_action else validate_qa_manifest)(
            _read_manifest(args.manifest), database_name=url.database,
            source_sha=sha, trusted_pair=trusted_pair)
        (require_other_runtime_policy if other_action else require_runtime_policy)(runtime_inputs, manifest)
        engine = sa.create_engine(url.render_as_string(hide_password=False))
        with engine.connect() as connection:
            version = int(connection.exec_driver_sql("SHOW server_version_num").scalar_one())
            database = connection.exec_driver_sql("SELECT current_database()").scalar_one()
            role = connection.exec_driver_sql("SELECT current_user").scalar_one()
            migration = connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
            if (not 150000 <= version < 160000 or database != url.database or role != url.database
                    or migration != "0020_f19a_pair_grants"):
                _reject("F19A_QA_PG_NOT_READY")
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        if args.action == "preflight":
            result = preflight_qa_bootstrap(factory, manifest, database_name=url.database,
                                            source_sha=sha, trusted_pair=trusted_pair)
        elif args.action == "seed":
            result = apply_qa_bootstrap(factory, manifest, database_name=url.database,
                                        source_sha=sha, trusted_pair=trusted_pair)
        elif args.action == "readiness":
            result = "READY" if check_qa_readiness(factory, manifest,
                target_actor_id=args.target_actor_id, target_subject=args.target_subject,
                trusted_pair=trusted_pair, runtime_inputs=runtime_inputs) else "NOT_READY"
        elif args.action == "other-preflight":
            result = preflight_qa_other(factory, manifest, database_name=url.database,
                                        source_sha=sha, trusted_pair=trusted_pair)
        elif args.action == "other-seed":
            result = apply_qa_other(factory, manifest, database_name=url.database,
                                    source_sha=sha, trusted_pair=trusted_pair)
        elif args.action == "other-readiness":
            result = "READY" if preflight_qa_other(factory, manifest, database_name=url.database,
                source_sha=sha, trusted_pair=trusted_pair) == "UNCHANGED" else "NOT_READY"
        elif args.action == "other-cleanup":
            result = remove_qa_other(factory, manifest, database_name=url.database,
                                     source_sha=sha, trusted_pair=trusted_pair)
        else:
            result = decide_rollback(factory, manifest, target_sha=args.target_sha, guarded_sha=sha,
                                     trusted_pair=trusted_pair)
        print("F19A_QA_" + result)
        return 0
    except QABootstrapRejected as exc:
        print(str(exc))  # Stable code only, never a DSN, identity, or secret.
        return 2
    except Exception:
        print("F19A_QA_DATABASE_UNAVAILABLE")
        return 2
    finally:
        if engine is not None:
            engine.dispose()


def check_qa_readiness(session_factory, manifest: dict, *, target_actor_id: str,
                       target_subject: str | None = None,
                       trusted_pair: tuple[str, str] | None = None, runtime_inputs=None) -> bool:
    """Require the exact three operational grants and no other active pair."""
    desired = validate_qa_manifest(manifest, database_name=(manifest.get("database_name")
        if type(manifest) is dict else None), source_sha=(manifest.get("source_sha")
        if type(manifest) is dict else None), trusted_pair=trusted_pair)
    if (type(target_actor_id) is not str or _ID.fullmatch(target_actor_id) is None
            or type(target_subject) is not str or not target_subject or target_subject == desired["subject"]
            or not callable(session_factory)):
        _reject("F19A_QA_READINESS_INVALID")
    try:
        with session_factory() as session:
            if _bootstrap_state(session, desired) != "UNCHANGED":
                _reject("F19A_QA_READINESS_INVALID")
            bindings = session.execute(sa.select(oidc_subject_bindings.c.issuer,
                oidc_subject_bindings.c.subject, oidc_subject_bindings.c.active).where(
                oidc_subject_bindings.c.actor_id == target_actor_id)).all()
            authority = session.execute(sa.select(roles.c.role_code, roles.c.permissions).select_from(
                users.join(user_roles, users.c.actor_id == user_roles.c.actor_id)
                     .join(roles, user_roles.c.role_code == roles.c.role_code)).where(
                users.c.actor_id == target_actor_id, users.c.active.is_(True), user_roles.c.active.is_(True),
                user_roles.c.project_id == desired["project_id"],
                user_roles.c.environment_id == desired["environment_id"])).first()
            project = session.execute(sa.select(registered_projects.c.active).where(
                registered_projects.c.project_id == desired["project_id"])).first()
            environment = session.execute(sa.select(registered_environments.c.active).where(
                registered_environments.c.project_id == desired["project_id"],
                registered_environments.c.environment_id == desired["environment_id"])).first()
            rows = session.execute(sa.select(pair_grants.c.actor_id, pair_grants.c.project_id,
                pair_grants.c.environment_id, pair_grants.c.permission_code, pair_grants.c.active)).all()
            audited = session.execute(sa.select(registration_audit_events.c.actor_id,
                registration_audit_events.c.target_actor_id, registration_audit_events.c.project_id,
                registration_audit_events.c.environment_id, registration_audit_events.c.permission_code,
                registration_audit_events.c.next_active).where(
                registration_audit_events.c.event_type == "PAIR_GRANT_ACTIVATED")).all()
        expected = {(target_actor_id, desired["project_id"], desired["environment_id"], permission, True)
                    for permission in READINESS_PERMISSIONS}
        expected_audit = {(desired["actor_id"], target_actor_id, desired["project_id"],
            desired["environment_id"], permission, True) for permission in READINESS_PERMISSIONS}
        if (authority is None or type(authority[1]) is not list
                or not READINESS_PERMISSIONS <= set(authority[1])
                or bindings != [(desired["issuer"], target_subject, True)]
                or project is None or project[0] is not True or environment is None or environment[0] is not True
                or len(rows) != 3 or set(rows) != expected
                or len(audited) != 3 or set(audited) != expected_audit):
            _reject("F19A_QA_READINESS_INVALID")
        require_runtime_policy(runtime_inputs, desired, target_role=authority[0])
        return True
    except QABootstrapRejected:
        raise
    except Exception:
        _reject("F19A_QA_DATABASE_UNAVAILABLE")


def decide_rollback(session_factory, manifest: dict, *, target_sha: str, guarded_sha: str,
                    trusted_pair: tuple[str, str] | None = None) -> str:
    """Never request a pre-guard binary after the first active or revoked grant."""
    desired = validate_qa_manifest(manifest, database_name=(manifest.get("database_name")
        if type(manifest) is dict else None), source_sha=(manifest.get("source_sha")
        if type(manifest) is dict else None), trusted_pair=trusted_pair)
    if (type(target_sha) is not str or _SHA.fullmatch(target_sha) is None
            or type(guarded_sha) is not str or _SHA.fullmatch(guarded_sha) is None
            or guarded_sha != desired["source_sha"]
            or not callable(session_factory)):
        _reject("F19A_QA_ROLLBACK_INVALID")
    if target_sha == guarded_sha:
        return "GUARDED_SHA"
    try:
        with session_factory() as session:
            project_count = session.scalar(sa.select(sa.func.count()).select_from(registered_projects))
            environment_count = session.scalar(sa.select(sa.func.count()).select_from(registered_environments))
            grant_count = session.scalar(sa.select(sa.func.count()).select_from(pair_grants))
            audit_count = session.scalar(sa.select(sa.func.count()).select_from(registration_audit_events))
        if project_count or environment_count or grant_count or audit_count:
            _reject("FIX_FORWARD_REQUIRED")
        return "PRE_GRANT_ONLY"
    except QABootstrapRejected:
        raise
    except Exception:
        _reject("F19A_QA_DATABASE_UNAVAILABLE")


if __name__ == "__main__":
    raise SystemExit(main())
