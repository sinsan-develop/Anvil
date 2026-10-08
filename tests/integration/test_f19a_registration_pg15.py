"""Opt-in F-19A migration and exact-pair checks on a disposable WSL PG15 DB."""

from __future__ import annotations

import os
import re

from alembic import command
from alembic.config import Config
import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

import packages.api  # Initialize the existing OIDC package import graph first.
from packages.persistence.f19a_registration_repository import (
    F19ARegistrationRepository, F19ARegistrationRejected,
    pair_grants, registered_projects, registered_environments, registration_audit_events,
)
from packages.persistence.oidc_principal_directory import roles, user_roles, users


def _isolated_dsn() -> str:
    value = os.environ.get("ANVIL_F19A_PG_DSN")
    if not value:
        pytest.skip("F-19A isolated WSL-server PostgreSQL 15 opt-in is not configured")
    url = make_url(value)
    database = url.database
    if (os.environ.get("ANVIL_F19A_PG_ISOLATED") != "1"
            or url.drivername not in {"postgresql", "postgresql+psycopg"}
            or url.host not in {"127.0.0.1", "localhost"} or url.port != 5545
            or bool(url.query) or not database
            or re.fullmatch(r"anvil_f19a_[0-9a-f]{7}", database) is None
            or url.username != database):
        pytest.fail("F19A_PG_TARGET_NOT_ISOLATED")
    return url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)


@pytest.fixture(scope="module")
def database():
    dsn = _isolated_dsn()
    engine = sa.create_engine(dsn)
    previous_database_url = os.environ.get("ANVIL_DATABASE_URL")
    try:
        with engine.connect() as connection:
            version = connection.exec_driver_sql("SHOW server_version_num").scalar_one()
            assert 150000 <= int(version) < 160000, "F19A_PG15_REQUIRED"
            assert not sa.inspect(connection).has_table("alembic_version"), "F19A_PG_NOT_EMPTY"
            assert connection.exec_driver_sql(
                "SELECT count(*) FROM pg_tables WHERE schemaname='public'").scalar_one() == 0, "F19A_PG_NOT_EMPTY"
        configuration = Config("alembic.ini")
        configuration.set_main_option("sqlalchemy.url", dsn.replace("%", "%%"))
        os.environ["ANVIL_DATABASE_URL"] = dsn  # env.py must use the already-validated isolated target.
        command.upgrade(configuration, "0020_f19a_pair_grants")
        with engine.connect() as connection:
            assert connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalar_one() \
                   == "0020_f19a_pair_grants"
        yield engine, configuration
    finally:
        if previous_database_url is None:
            os.environ.pop("ANVIL_DATABASE_URL", None)
        else:
            os.environ["ANVIL_DATABASE_URL"] = previous_database_url
        engine.dispose()  # Main owns exact disposable DB removal after the WSL run.


def _seed_actors(engine):
    with engine.begin() as connection:
        connection.execute(users.insert(), [
            {"actor_id": "f19a-admin", "active": True},
            {"actor_id": "f19a-reader", "active": True},
            {"actor_id": "f19a-other", "active": True},
        ])
        connection.execute(roles.insert(), [
            {"role_code": "f19a-admin", "permissions": ["projects:register", "pair-grants:manage"]},
            {"role_code": "f19a-reader", "permissions": ["dashboard:read"]},
        ])
        connection.execute(user_roles.insert(), [
            {"actor_id": "f19a-admin", "role_code": "f19a-admin", "project_id": "host",
             "environment_id": "test", "step_up_required": False, "active": True},
            {"actor_id": "f19a-reader", "role_code": "f19a-reader", "project_id": "host",
             "environment_id": "test", "step_up_required": False, "active": True},
            {"actor_id": "f19a-other", "role_code": "f19a-reader", "project_id": "host",
             "environment_id": "test", "step_up_required": False, "active": True},
        ])


def test_f19a_pg15_migration_constraints_exact_pair_and_revoke(database):
    engine, _ = database
    _seed_actors(engine)
    owner = F19ARegistrationRepository(sessionmaker(bind=engine, expire_on_commit=False))
    for project in ("f19a-a", "f19a-b"):
        owner.register_project("f19a-admin", project, project)
        owner.register_environment("f19a-admin", project, "test", project + " test")
    with engine.begin() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(registered_projects)) == 2
        assert connection.scalar(sa.select(sa.func.count()).select_from(registered_environments)) == 2
        assert connection.scalar(sa.select(sa.func.count()).select_from(pair_grants)) == 0
    owner.set_pair_grant("f19a-admin", "f19a-reader", "f19a-a", "test", "dashboard:read", True)
    assert tuple(item["projectId"] for item in owner.list_dashboard_pairs("f19a-reader")) == ("f19a-a",)
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.require_pair_grant("f19a-reader", "f19a-b", "test", "dashboard:read")
    assert owner.list_dashboard_pairs("f19a-other") == ()
    owner.set_pair_grant("f19a-admin", "f19a-reader", "f19a-a", "test", "dashboard:read", False)
    assert owner.list_dashboard_pairs("f19a-reader") == ()
    with engine.begin() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(registration_audit_events)) == 6
        with pytest.raises(sa.exc.IntegrityError):
            with connection.begin_nested():
                connection.execute(pair_grants.insert().values(
                    actor_id="f19a-reader", project_id="f19a-a", environment_id="missing",
                    permission_code="dashboard:read", active=True,
                    granted_by_actor_id="f19a-admin", granted_at=sa.func.now(), updated_at=sa.func.now()))


def test_f19a_pg15_audit_immutable_and_nonempty_downgrade_guard(database):
    engine, configuration = database
    with engine.begin() as connection:
        event_id = connection.scalar(sa.select(registration_audit_events.c.event_id).limit(1))
        assert event_id is not None
        with pytest.raises(sa.exc.DBAPIError):
            with connection.begin_nested():
                connection.execute(sa.text("UPDATE registration_audit_events SET event_type='FORGED' "
                                           "WHERE event_id=:event_id"), {"event_id": event_id})
    with pytest.raises(RuntimeError, match="DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"):
        command.downgrade(configuration, "0019_oidc_sessions")
    with engine.connect() as connection:
        assert connection.execute(sa.text("SELECT version_num FROM alembic_version")).scalar_one() \
               == "0020_f19a_pair_grants"
