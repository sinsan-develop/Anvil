"""Opt-in exact-SHA OIDC/pair-grant QA against one disposable WSL PG15 DB.

Local runs skip: only Main may provision the isolated server and run this file.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import importlib.util
import os
from pathlib import Path
import re
import subprocess
from unittest.mock import patch

from alembic import command
from alembic.config import Config
import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

import packages.api  # noqa: F401 - Existing OIDC import order.
from packages.persistence.f19a_registration_repository import F19ARegistrationRepository, F19ARegistrationRejected
from packages.persistence.oidc_principal_directory import (
    SqlAlchemyOidcPrincipalResolver, users, roles, user_roles, oidc_subject_bindings,
)
from apps.api.anvil_api.oidc_process import load_oidc_process_inputs


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("f19a_qa_bootstrap", ROOT / "deploy/wsl/f19a_qa_bootstrap.py")
bootstrap = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bootstrap)


def test_qa_git_exact_checkout_guard_negative():
    expected = "a" * 40
    for scenario in ("positive", "stale_head", "dirty", "stale_private", "wrong_branch"):
        def output(command, *args, **kwargs):
            tail = command[1:]
            if tail == ["rev-parse", "HEAD"]:
                return (("b" * 40 if scenario == "stale_head" else expected) + "\n").encode()
            if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                return (("b" * 40 if scenario == "stale_private" else expected) + "\n").encode()
            if tail == ["branch", "--show-current"]:
                return ("main\n" if scenario == "wrong_branch" else "codex/f18-wsl-ops\n").encode()
            if tail == ["status", "--porcelain=v1", "-uall"]:
                return b"?? tmp.txt\n" if scenario == "dirty" else b""
            raise AssertionError(command)
        with patch.object(subprocess, "check_output", side_effect=output):
            if scenario == "positive":
                assert _assert_exact_checkout(expected) == expected
            else:
                with pytest.raises(AssertionError, match="F19A_QA_GIT_NOT_EXACT"):
                    _assert_exact_checkout(expected)


def _assert_exact_checkout(expected_sha: str):
    if not re.fullmatch(r"[0-9a-f]{40}", expected_sha):
        raise AssertionError("F19A_QA_GIT_NOT_EXACT")
    try:
        def git(*args):
            return subprocess.check_output(["git", *args], cwd=ROOT, stderr=subprocess.DEVNULL).decode().strip()
        head = git("rev-parse", "HEAD")
        private = git("rev-parse", "development/codex/f18-wsl-ops")
        branch = git("branch", "--show-current")
        dirty = git("status", "--porcelain=v1", "-uall")
        if head != expected_sha or private != expected_sha or branch != "codex/f18-wsl-ops" or dirty:
            raise AssertionError("F19A_QA_GIT_NOT_EXACT")
        return head
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError):
        raise AssertionError("F19A_QA_GIT_NOT_EXACT") from None


def _target():
    raw = os.environ.get("ANVIL_F19A_QA_PG_DSN")
    if not raw:
        pytest.skip("isolated WSL-server F-19A QA PG15 DSN not configured")
    url = make_url(raw)
    if (os.environ.get("ANVIL_F19A_QA_PG_ISOLATED") != "1"
            or url.drivername not in {"postgresql", "postgresql+psycopg"}
            or url.host not in {"127.0.0.1", "localhost"} or url.port != 5546
            or not url.database or re.fullmatch(r"anvil_f19a_[0-9a-f]{7}", url.database) is None
            or url.username != url.database or bool(url.query)):
        pytest.fail("F19A_QA_PG_TARGET_NOT_ISOLATED")
    return url.set(drivername="postgresql+psycopg")


@pytest.fixture(scope="module")
def qa_database():
    url = _target()
    source_sha = os.environ.get("ANVIL_F19A_QA_SOURCE_SHA", "")
    _assert_exact_checkout(source_sha)  # Before DB connection or migration.
    engine = sa.create_engine(url.render_as_string(hide_password=False))
    old = os.environ.get("ANVIL_DATABASE_URL")
    try:
        with engine.connect() as connection:
            assert 150000 <= int(connection.exec_driver_sql("SHOW server_version_num").scalar_one()) < 160000
            assert not sa.inspect(connection).has_table("alembic_version"), "F19A_QA_DB_NOT_EMPTY"
            assert connection.exec_driver_sql(
                "SELECT count(*) FROM pg_tables WHERE schemaname='public'").scalar_one() == 0
        config = Config(str(ROOT / "alembic.ini"))
        dsn = url.render_as_string(hide_password=False)
        config.set_main_option("sqlalchemy.url", dsn.replace("%", "%%"))
        os.environ["ANVIL_DATABASE_URL"] = dsn
        command.upgrade(config, "0020_f19a_pair_grants")
        with engine.connect() as connection:
            assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() \
                == "0020_f19a_pair_grants"
        yield engine, url.database
    finally:
        if old is None:
            os.environ.pop("ANVIL_DATABASE_URL", None)
        else:
            os.environ["ANVIL_DATABASE_URL"] = old
        engine.dispose()  # Main removes only this exact disposable DB after evidence capture.


def _manifest(database: str, pair: tuple[str, str]):
    source_sha = os.environ.get("ANVIL_F19A_QA_SOURCE_SHA", "")
    assert re.fullmatch(r"[0-9a-f]{40}", source_sha), "F19A_QA_EXACT_SOURCE_SHA_REQUIRED"
    return {
        "approval_sha256": bootstrap.APPROVAL_SHA, "source_sha": source_sha,
        "database_name": database, "issuer": "https://anvil-f18-qa.local:8444/realms/anvil",
        "subject": "synthetic-subject-1", "actor_id": f"f19a_qa_admin_{source_sha[:12]}",
        "role_code": f"f19a_qa_bootstrap_{source_sha[:12]}",
        "project_id": pair[0], "environment_id": pair[1], "permissions": bootstrap.BOOTSTRAP_PERMISSIONS,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "revoke_after": "isolated-qa-cleanup",
    }


def test_qa_oidc_bootstrap_registration_grant_revoke_and_fix_forward(qa_database):
    engine, database = qa_database
    inputs = load_oidc_process_inputs(os.environ)
    trusted_pair = (inputs.authorization_scope.project_id, inputs.authorization_scope.environment_id)
    project_id, environment_id = trusted_pair
    manifest = _manifest(database, trusted_pair)
    assert inputs.principal_policy.issuer == manifest["issuer"], "F19A_QA_ISSUER_MISMATCH"
    assert bootstrap.require_runtime_policy(inputs, manifest)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    assert bootstrap.apply_qa_bootstrap(factory, manifest, database_name=database,
        source_sha=manifest["source_sha"], trusted_pair=trusted_pair) == "CREATED"
    assert bootstrap.apply_qa_bootstrap(factory, manifest, database_name=database,
        source_sha=manifest["source_sha"], trusted_pair=trusted_pair) == "UNCHANGED"
    binding = SqlAlchemyOidcPrincipalResolver(factory).resolve(manifest["issuer"], manifest["subject"])
    assert binding is not None and binding.actor_id == manifest["actor_id"]
    assert binding.permissions == frozenset(bootstrap.BOOTSTRAP_PERMISSIONS)
    with engine.begin() as connection:
        connection.execute(users.insert().values(actor_id="f19a-qa-reader", active=True))
        connection.execute(roles.insert().values(role_code="f19a-qa-reader-only",
            permissions=sorted(bootstrap.READINESS_PERMISSIONS)))
        connection.execute(user_roles.insert().values(actor_id="f19a-qa-reader",
            role_code="f19a-qa-reader-only", project_id=project_id, environment_id=environment_id,
            step_up_required=False, active=True))
        connection.execute(oidc_subject_bindings.insert().values(issuer=manifest["issuer"],
            subject="f19a-qa-reader", actor_id="f19a-qa-reader", active=True))
    repo = F19ARegistrationRepository(factory)
    repo.register_project(manifest["actor_id"], project_id, "Host")
    repo.register_environment(manifest["actor_id"], project_id, environment_id, "Test")
    with pytest.raises(bootstrap.QABootstrapRejected):
        bootstrap.check_qa_readiness(factory, manifest, target_actor_id="f19a-qa-reader",
            target_subject="f19a-qa-reader", trusted_pair=trusted_pair, runtime_inputs=inputs)
    for permission in bootstrap.READINESS_PERMISSIONS:
        repo.set_pair_grant(manifest["actor_id"], "f19a-qa-reader", project_id, environment_id, permission, True)
    assert bootstrap.check_qa_readiness(factory, manifest, target_actor_id="f19a-qa-reader",
        target_subject="f19a-qa-reader", trusted_pair=trusted_pair, runtime_inputs=inputs)
    assert repo.list_dashboard_pairs("f19a-qa-reader")[0]["projectId"] == project_id
    with pytest.raises(bootstrap.QABootstrapRejected, match="FIX_FORWARD_REQUIRED"):
        bootstrap.decide_rollback(factory, manifest, target_sha="b" * 40,
                                  guarded_sha=manifest["source_sha"], trusted_pair=trusted_pair)
    repo.set_pair_grant(manifest["actor_id"], "f19a-qa-reader", project_id, environment_id,
                        "dashboard:read", False)
    assert repo.list_dashboard_pairs("f19a-qa-reader") == ()
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        repo.require_pair_grant("f19a-qa-reader", project_id, environment_id, "dashboard:read")
