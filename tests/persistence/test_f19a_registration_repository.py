"""F-19A Task1 local persistence contract; real PG15 runs only on WSL-server."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

import packages.api  # Existing API package initializes OIDC imports before direct directory import.
from packages.persistence.oidc_principal_directory import DIRECTORY_METADATA, roles, user_roles, users
from packages.persistence.f19a_registration_repository import (
    F19ARegistrationRepository,
    F19ARegistrationRejected,
    REGISTRATION_METADATA,
    pair_grants,
    registered_environments,
    registered_projects,
    registration_audit_events,
)


@pytest.fixture
def repository():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")

    @sa.event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    DIRECTORY_METADATA.create_all(engine)
    REGISTRATION_METADATA.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions.begin() as session:
        session.execute(users.insert(), [
            {"actor_id": "admin", "active": True},
            {"actor_id": "reader", "active": True},
            {"actor_id": "other", "active": True},
            {"actor_id": "manager", "active": True},
            {"actor_id": "registrar", "active": True},
        ])
        session.execute(roles.insert(), [
            {"role_code": "admin", "permissions": ["projects:register", "pair-grants:manage"]},
            {"role_code": "reader", "permissions": ["dashboard:read"]},
            {"role_code": "manager", "permissions": ["pair-grants:manage"]},
            {"role_code": "registrar", "permissions": ["projects:register"]},
        ])
        session.execute(user_roles.insert(), [
            {"actor_id": "admin", "role_code": "admin", "project_id": "host", "environment_id": "test",
             "step_up_required": False, "active": True},
            {"actor_id": "reader", "role_code": "reader", "project_id": "host", "environment_id": "test",
             "step_up_required": False, "active": True},
            {"actor_id": "other", "role_code": "reader", "project_id": "host", "environment_id": "test",
             "step_up_required": False, "active": True},
            {"actor_id": "manager", "role_code": "manager", "project_id": "host", "environment_id": "test",
             "step_up_required": False, "active": True},
            {"actor_id": "registrar", "role_code": "registrar", "project_id": "host", "environment_id": "test",
             "step_up_required": False, "active": True},
        ])
    yield F19ARegistrationRepository(sessions), sessions, engine
    engine.dispose()


def test_registration_records_actor_utc_time_and_never_auto_grants(repository):
    owner, sessions, _ = repository
    project = owner.register_project("admin", "project-a", "Project A")
    environment = owner.register_environment("admin", "project-a", "test", "Test")
    assert project["projectId"] == "project-a" and project["registeredBy"] == "admin"
    assert environment["environmentId"] == "test" and environment["registeredBy"] == "admin"
    assert project["registeredAt"].tzinfo is not None
    assert project["registeredAt"].utcoffset().total_seconds() == 0
    assert environment["registeredAt"].tzinfo is not None
    with sessions() as session:
        assert session.scalar(sa.select(sa.func.count()).select_from(registered_projects)) == 1
        assert session.scalar(sa.select(sa.func.count()).select_from(registered_environments)) == 1
        assert session.scalar(sa.select(sa.func.count()).select_from(pair_grants)) == 0
        assert session.scalar(sa.select(sa.func.count()).select_from(registration_audit_events)) == 2
    assert owner.list_dashboard_pairs("reader") == ()


def test_manager_only_can_register_environment_and_change_registration_active(repository):
    owner, _, _ = repository
    owner.register_project("admin", "project-a", "A")
    environment = owner.register_environment("manager", "project-a", "test", "Test")
    assert environment["registeredBy"] == "manager"
    assert owner.set_registration_active("manager", "project-a", "test", False)["active"] is False
    assert owner.set_registration_active("admin", "project-a", "test", True)["active"] is True
    assert owner.set_registration_active("manager", "project-a", None, False)["active"] is False
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.register_project("manager", "project-b", "B")


def test_nonowner_registrar_cannot_distinguish_hidden_from_missing_registration(repository):
    owner, _, _ = repository
    for project in ("project-a", "project-b"):
        owner.register_project("admin", project, project)
        owner.register_environment("admin", project, "test", "Test")
    for project in ("project-a", "project-b", "absent"):
        with pytest.raises(F19ARegistrationRejected, match="REGISTRATION_NOT_FOUND"):
            owner.register_environment("registrar", project, "new-env", "New")
        with pytest.raises(F19ARegistrationRejected, match="REGISTRATION_NOT_FOUND"):
            owner.set_registration_active("registrar", project, None, False)
        with pytest.raises(F19ARegistrationRejected, match="REGISTRATION_NOT_FOUND"):
            owner.set_registration_active("registrar", project, "test", False)
    assert owner.set_registration_active("manager", "project-a", "test", False)["active"] is False


def test_no_coarse_action_returns_uniform_denial_without_project_disclosure(repository):
    owner, _, _ = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_environment("admin", "project-a", "test", "Test")
    for project in ("project-a", "absent"):
        with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
            owner.register_environment("reader", project, "new-env", "New")
        with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
            owner.set_registration_active("reader", project, None, False)


def test_composite_fk_and_same_environment_id_in_two_projects(repository):
    owner, sessions, _ = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_project("admin", "project-b", "B")
    owner.register_environment("admin", "project-a", "test", "A Test")
    owner.register_environment("admin", "project-b", "test", "B Test")
    with sessions() as session:
        assert session.scalar(sa.select(sa.func.count()).select_from(registered_environments)) == 2
        with pytest.raises(sa.exc.IntegrityError):
            session.execute(pair_grants.insert().values(
                actor_id="reader", project_id="project-a", environment_id="prod",
                permission_code="dashboard:read", active=True, granted_by_actor_id="admin",
                granted_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)))


def test_database_rejects_permission_outside_approved_three_codes(repository):
    owner, sessions, _ = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_environment("admin", "project-a", "test", "Test")
    with sessions() as session:
        with pytest.raises(sa.exc.IntegrityError):
            session.execute(pair_grants.insert().values(
                actor_id="reader", project_id="project-a", environment_id="test",
                permission_code="unknown", active=True, granted_by_actor_id="admin",
                granted_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)))


def test_cross_pair_and_actor_isolation_with_exact_grant(repository):
    owner, _, _ = repository
    for project in ("project-a", "project-b"):
        owner.register_project("admin", project, project)
        owner.register_environment("admin", project, "test", project + " test")
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.require_pair_grant("reader", "project-a", "test", "dashboard:read")
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    assert owner.require_pair_grant("reader", "project-a", "test", "dashboard:read") is True
    assert tuple(item["projectId"] for item in owner.list_dashboard_pairs("reader")) == ("project-a",)
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.require_pair_grant("reader", "project-b", "test", "dashboard:read")
    assert owner.list_dashboard_pairs("other") == ()


def test_grant_and_audit_are_one_transaction(repository):
    owner, sessions, engine = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_environment("admin", "project-a", "test", "Test")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TRIGGER deny_f19a_grant_audit BEFORE INSERT ON registration_audit_events "
                               "WHEN NEW.event_type = 'PAIR_GRANT_ACTIVATED' BEGIN SELECT RAISE(FAIL, 'audit down'); END")
    with pytest.raises(F19ARegistrationRejected, match="PAIR_AUTHORIZATION_UNAVAILABLE"):
        owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    with sessions() as session:
        assert session.scalar(sa.select(sa.func.count()).select_from(pair_grants)) == 0


def test_revoke_and_registration_deactivate_take_effect_next_read(repository):
    owner, sessions, _ = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_environment("admin", "project-a", "test", "Test")
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    assert len(owner.list_dashboard_pairs("reader")) == 1
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", False)
    assert owner.list_dashboard_pairs("reader") == ()
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.require_pair_grant("reader", "project-a", "test", "dashboard:read")
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    owner.set_registration_active("admin", "project-a", None, False)
    assert owner.list_dashboard_pairs("reader") == ()
    with sessions() as session:
        assert session.scalar(sa.select(sa.func.count()).select_from(registration_audit_events)) == 6


def test_inactive_project_allows_revocation_but_never_new_activation(repository):
    owner, _, _ = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_environment("admin", "project-a", "test", "Test")
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    owner.set_registration_active("admin", "project-a", None, False)
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", False)
    owner.set_registration_active("admin", "project-a", None, True)
    assert owner.list_dashboard_pairs("reader") == ()
    owner.set_registration_active("admin", "project-a", None, False)
    with pytest.raises(F19ARegistrationRejected, match="REGISTRATION_NOT_FOUND"):
        owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)


def test_admin_permission_self_grant_invalid_permission_and_inactive_pair_fail_closed(repository):
    owner, _, _ = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_environment("admin", "project-a", "test", "Test")
    for args in (
        ("reader", "other", "project-a", "test", "dashboard:read", True),
        ("admin", "admin", "project-a", "test", "dashboard:read", True),
        ("admin", "reader", "project-a", "test", "unknown", True),
    ):
        with pytest.raises(F19ARegistrationRejected):
            owner.set_pair_grant(*args)
    owner.set_registration_active("admin", "project-a", "test", False)
    with pytest.raises(F19ARegistrationRejected):
        owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)


def test_grant_cannot_exceed_target_role_permission_and_identical_put_has_no_new_audit(repository):
    owner, sessions, _ = repository
    owner.register_project("admin", "project-a", "A")
    owner.register_environment("admin", "project-a", "test", "Test")
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.set_pair_grant("admin", "reader", "project-a", "test", "operations:alerts:read", True)
    first = owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    second = owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    assert second == first
    with sessions() as session:
        assert session.scalar(sa.select(sa.func.count()).select_from(registration_audit_events)) == 3


def test_registration_audit_failure_rolls_back_and_is_unavailable_not_conflict(repository):
    owner, sessions, engine = repository
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TRIGGER deny_f19a_registration_audit "
                               "BEFORE INSERT ON registration_audit_events "
                               "WHEN NEW.event_type = 'PROJECT_REGISTERED' "
                               "BEGIN SELECT RAISE(FAIL, 'audit down'); END")
    with pytest.raises(F19ARegistrationRejected, match="PAIR_AUTHORIZATION_UNAVAILABLE"):
        owner.register_project("admin", "project-a", "A")
    with sessions() as session:
        assert session.scalar(sa.select(sa.func.count()).select_from(registered_projects)) == 0


def test_database_unavailable_is_not_empty_or_authorized():
    def unavailable():
        raise OSError("database unavailable")

    owner = F19ARegistrationRepository(unavailable)
    with pytest.raises(F19ARegistrationRejected, match="PAIR_AUTHORIZATION_UNAVAILABLE"):
        owner.list_dashboard_pairs("reader")
    with pytest.raises(F19ARegistrationRejected, match="PAIR_AUTHORIZATION_UNAVAILABLE"):
        owner.require_pair_grant("reader", "project-a", "test", "dashboard:read")


def test_require_dashboard_pair_reads_exact_active_grant_and_names_in_one_read(repository):
    owner, _, _ = repository
    for project, name in (("project-a", "Project A"), ("project-b", "Project B")):
        owner.register_project("admin", project, name)
        owner.register_environment("admin", project, "test", name + " Test")
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    assert owner.require_dashboard_pair("reader", "project-a", "test") == {
        "projectId": "project-a", "projectName": "Project A",
        "environmentId": "test", "environmentName": "Project A Test",
    }
    for actor, project in (("reader", "project-b"), ("other", "project-a")):
        with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
            owner.require_dashboard_pair(actor, project, "test")
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", False)
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.require_dashboard_pair("reader", "project-a", "test")
    owner.set_pair_grant("admin", "reader", "project-a", "test", "dashboard:read", True)
    owner.set_registration_active("admin", "project-a", "test", False)
    with pytest.raises(F19ARegistrationRejected, match="AUTHORIZATION_SCOPE_MISMATCH"):
        owner.require_dashboard_pair("reader", "project-a", "test")


def test_require_dashboard_pair_database_fault_is_unavailable():
    def unavailable():
        raise OSError("database unavailable")

    with pytest.raises(F19ARegistrationRejected, match="PAIR_AUTHORIZATION_UNAVAILABLE"):
        F19ARegistrationRepository(unavailable).require_dashboard_pair("reader", "project-a", "test")
