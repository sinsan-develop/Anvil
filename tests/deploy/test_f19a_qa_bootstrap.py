"""Local, disposable contract tests for the F-19A WSL-only QA bootstrap."""

from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

import packages.api  # noqa: F401 - Initialize the established API/persistence import order.
from packages.persistence.oidc_principal_directory import DIRECTORY_METADATA, users, roles, user_roles, oidc_subject_bindings
from packages.persistence.f19a_registration_repository import (
    REGISTRATION_METADATA, pair_grants, registered_projects, registered_environments,
    registration_audit_events,
)
SOURCE = Path(__file__).resolve().parents[2] / "deploy/wsl/f19a_qa_bootstrap.py"
SPEC = importlib.util.spec_from_file_location("f19a_qa_bootstrap", SOURCE)
bootstrap = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bootstrap)
QABootstrapRejected = bootstrap.QABootstrapRejected
validate_qa_manifest = bootstrap.validate_qa_manifest
validate_isolated_pg15_url = bootstrap.validate_isolated_pg15_url


SOURCE_SHA = "a" * 40
APPROVAL = "ADF11125667CA6C374F31462D2ABD7D55C425D7A86019CB7A8D4B9BA8D0A0AF5"
TRUSTED_PAIR = ("host", "test")  # Independent, fixture-owned OIDC host scope.


def apply_qa_bootstrap(*args, **kwargs):
    return bootstrap.apply_qa_bootstrap(*args, trusted_pair=TRUSTED_PAIR, **kwargs)


def check_qa_readiness(*args, **kwargs):
    desired = args[1]
    policy = SimpleNamespace(issuer=desired["issuer"],
        allowed_roles=frozenset({desired["role_code"], "qa-reader"}),
        allowed_permissions=frozenset(bootstrap.BOOTSTRAP_PERMISSIONS) | bootstrap.READINESS_PERMISSIONS)
    runtime = SimpleNamespace(principal_policy=policy,
        authorization_scope=SimpleNamespace(allowed_actor_roles=policy.allowed_roles))
    return bootstrap.check_qa_readiness(*args, trusted_pair=TRUSTED_PAIR,
                                        target_subject="f19a-qa-reader", runtime_inputs=runtime, **kwargs)


def decide_rollback(*args, **kwargs):
    return bootstrap.decide_rollback(*args, trusted_pair=TRUSTED_PAIR, **kwargs)


def manifest():
    return {
        "approval_sha256": APPROVAL, "source_sha": SOURCE_SHA,
        "database_name": "anvil_f19a_123abcd", "issuer": "https://anvil-f18-qa.local:8444/realms/anvil",
        "subject": "synthetic-subject-1", "actor_id": f"f19a_qa_admin_{SOURCE_SHA[:12]}",
        "role_code": f"f19a_qa_bootstrap_{SOURCE_SHA[:12]}",
        "project_id": "host", "environment_id": "test",
        "permissions": ["projects:register", "pair-grants:manage"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "revoke_after": "isolated-qa-cleanup",
    }


def other_manifest():
    return {**manifest(), "subject": "f19a-qa-other",
        "actor_id": f"f19a_qa_other_{SOURCE_SHA[:12]}",
        "role_code": f"f19a_qa_other_{SOURCE_SHA[:12]}",
        "permissions": ["dashboard:read"]}


def test_third_actor_exact_manifest_and_isolated_idempotent_seed(db):
    engine, factory = db
    admin, desired = manifest(), other_manifest()
    assert bootstrap.validate_other_manifest(desired, database_name=desired["database_name"],
        source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR) == desired
    apply_qa_bootstrap(factory, admin, database_name=admin["database_name"], source_sha=SOURCE_SHA)
    assert bootstrap.preflight_qa_other(factory, desired, database_name=desired["database_name"],
        source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR) == "CREATABLE"
    assert bootstrap.apply_qa_other(factory, desired, database_name=desired["database_name"],
        source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR) == "CREATED"
    assert bootstrap.apply_qa_other(factory, desired, database_name=desired["database_name"],
        source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR) == "UNCHANGED"
    with engine.connect() as connection:
        assert connection.execute(sa.select(roles.c.permissions).where(
            roles.c.role_code == desired["role_code"])).scalar_one() == ["dashboard:read"]
        assert connection.scalar(sa.select(sa.func.count()).select_from(pair_grants).where(
            pair_grants.c.actor_id == desired["actor_id"])) == 0
        assert connection.scalar(sa.select(sa.func.count()).select_from(users)) == 2


@pytest.mark.parametrize("change", [
    {"subject": "f19a-qa-reader"}, {"actor_id": "f19a_qa_admin_aaaaaaaaaaaa"},
    {"role_code": "shared-admin"}, {"permissions": ["dashboard:read", "pair-grants:manage"]},
    {"project_id": "other"}, {"expires_at": "2020-01-01T00:00:00+00:00"},
])
def test_third_actor_manifest_rejects_wrong_identity_scope_permission_or_expiry(change):
    desired = {**other_manifest(), **change}
    with pytest.raises(QABootstrapRejected):
        bootstrap.validate_other_manifest(desired, database_name=desired["database_name"],
            source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR)


@pytest.mark.parametrize("occupied", ["actor", "role", "binding", "grant"])
def test_third_actor_preflight_rejects_collision_and_grants_without_writes(db, occupied):
    engine, factory = db
    desired = other_manifest()
    with engine.begin() as connection:
        if occupied == "actor":
            connection.execute(users.insert().values(actor_id=desired["actor_id"], active=False))
        elif occupied == "role":
            connection.execute(roles.insert().values(role_code=desired["role_code"],
                permissions=["admin:all"]))
        elif occupied == "binding":
            connection.execute(users.insert().values(actor_id="someone-else", active=True))
            connection.execute(oidc_subject_bindings.insert().values(issuer=desired["issuer"],
                subject=desired["subject"], actor_id="someone-else", active=True))
        else:
            connection.execute(pair_grants.insert().values(actor_id=desired["actor_id"],
                project_id=desired["project_id"], environment_id=desired["environment_id"],
                permission_code="dashboard:read", active=True, granted_by_actor_id="someone-else",
                granted_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)))
    with pytest.raises(QABootstrapRejected):
        bootstrap.apply_qa_other(factory, desired, database_name=desired["database_name"],
            source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR)
    with engine.connect() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(user_roles)) == 0


def test_third_actor_cleanup_removes_exact_identity_only(db):
    engine, factory = db
    admin, desired = manifest(), other_manifest()
    apply_qa_bootstrap(factory, admin, database_name=admin["database_name"], source_sha=SOURCE_SHA)
    bootstrap.apply_qa_other(factory, desired, database_name=desired["database_name"],
        source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR)
    expired_cleanup_manifest = {**desired, "expires_at": (datetime.now(timezone.utc)
        - timedelta(minutes=1)).isoformat()}
    assert bootstrap.remove_qa_other(factory, expired_cleanup_manifest, database_name=desired["database_name"],
        source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR) == "REMOVED"
    assert bootstrap.remove_qa_other(factory, desired, database_name=desired["database_name"],
        source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR) == "ABSENT"
    with engine.connect() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(users)) == 1
        assert connection.scalar(sa.select(sa.func.count()).select_from(roles)) == 1
        assert connection.scalar(sa.select(sa.func.count()).select_from(oidc_subject_bindings)) == 1


def test_third_actor_runtime_policy_requires_dedicated_role_and_dashboard_permission():
    desired = other_manifest()
    policy = SimpleNamespace(issuer=desired["issuer"],
        allowed_roles=frozenset({desired["role_code"]}),
        allowed_permissions=frozenset({"dashboard:read"}))
    runtime = SimpleNamespace(principal_policy=policy,
        authorization_scope=SimpleNamespace(allowed_actor_roles=policy.allowed_roles))
    assert bootstrap.require_other_runtime_policy(runtime, desired)
    for bad in (
        SimpleNamespace(principal_policy=SimpleNamespace(issuer=desired["issuer"],
            allowed_roles=frozenset(), allowed_permissions=policy.allowed_permissions),
            authorization_scope=runtime.authorization_scope),
        SimpleNamespace(principal_policy=policy,
            authorization_scope=SimpleNamespace(allowed_actor_roles=frozenset())),
        SimpleNamespace(principal_policy=SimpleNamespace(issuer=desired["issuer"],
            allowed_roles=policy.allowed_roles, allowed_permissions=frozenset()),
            authorization_scope=runtime.authorization_scope),
    ):
        with pytest.raises(QABootstrapRejected, match="F19A_QA_RUNTIME_POLICY_NOT_READY"):
            bootstrap.require_other_runtime_policy(bad, desired)


@pytest.fixture
def db():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    DIRECTORY_METADATA.create_all(engine)
    REGISTRATION_METADATA.create_all(engine)
    yield engine, sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


def test_manifest_exact_binding_and_no_credentials():
    expected = manifest()
    assert validate_qa_manifest(expected, database_name=expected["database_name"], source_sha=SOURCE_SHA,
                                trusted_pair=TRUSTED_PAIR) == expected
    for field, value in (("database_name", "shared"), ("source_sha", "b" * 40),
                         ("permissions", ["projects:register", "pair-grants:manage", "admin:*"]),
                         ("approval_sha256", "0" * 64), ("expires_at", "2000-01-01T00:00:00+00:00"),
                         ("issuer", "https://anvil-f18-qa.local:8444/realms/other")):
        bad = {**expected, field: value}
        with pytest.raises(QABootstrapRejected):
            validate_qa_manifest(bad, database_name=expected["database_name"], source_sha=SOURCE_SHA,
                                 trusted_pair=TRUSTED_PAIR)
    with pytest.raises(QABootstrapRejected):
        validate_qa_manifest({**expected, "password": "secret"}, database_name=expected["database_name"],
                             source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR)
    for bad in ({**expected, "role_code": "shared-admin"}, {**expected, "actor_id": "admin"},
                {**expected, "environment_id": "other"}):
        with pytest.raises(QABootstrapRejected):
            validate_qa_manifest(bad, database_name=expected["database_name"],
                                 source_sha=SOURCE_SHA, trusted_pair=TRUSTED_PAIR)
    with pytest.raises(QABootstrapRejected):
        validate_qa_manifest(expected, database_name=expected["database_name"], source_sha=SOURCE_SHA)


def test_isolated_pg15_url_rejects_shared_target_before_connect():
    good = "postgresql+psycopg://anvil_f19a_123abcd:secret@127.0.0.1:5546/anvil_f19a_123abcd"
    assert validate_isolated_pg15_url(good).database == "anvil_f19a_123abcd"
    for bad in (good.replace("5546", "5432"), good.replace("127.0.0.1", "db.internal"),
                good.replace("/anvil_f19a_123abcd", "/postgres"),
                good.replace("anvil_f19a_123abcd:secret", "postgres:secret"), good + "?sslmode=disable"):
        with pytest.raises(QABootstrapRejected):
            validate_isolated_pg15_url(bad)


def test_expected_sha_is_independent_required_binding():
    assert bootstrap.require_expected_sha(SOURCE_SHA, SOURCE_SHA) == SOURCE_SHA
    for bad in ("b" * 40, "", None):
        with pytest.raises(QABootstrapRejected):
            bootstrap.require_expected_sha(SOURCE_SHA, bad)


def test_runtime_oidc_policy_caps_dedicated_bootstrap_before_db_seed():
    desired = manifest()
    policy = SimpleNamespace(issuer=desired["issuer"], allowed_roles=frozenset({desired["role_code"]}),
        allowed_permissions=frozenset(bootstrap.BOOTSTRAP_PERMISSIONS))
    runtime = SimpleNamespace(principal_policy=policy,
        authorization_scope=SimpleNamespace(allowed_actor_roles=frozenset({desired["role_code"]})))
    assert bootstrap.require_runtime_policy(runtime, desired) is True
    for bad in (SimpleNamespace(principal_policy=SimpleNamespace(**{**vars(policy),
                    "allowed_roles": frozenset({"operator"})}), authorization_scope=runtime.authorization_scope),
                SimpleNamespace(principal_policy=SimpleNamespace(**{**vars(policy),
                    "allowed_permissions": frozenset({"projects:register"})}),
                    authorization_scope=runtime.authorization_scope),
                SimpleNamespace(principal_policy=SimpleNamespace(**{**vars(policy),
                    "issuer": "https://other.invalid"}), authorization_scope=runtime.authorization_scope),
                SimpleNamespace(principal_policy=policy,
                    authorization_scope=SimpleNamespace(allowed_actor_roles=frozenset({"operator"})))):
        with pytest.raises(QABootstrapRejected):
            bootstrap.require_runtime_policy(bad, desired)


def test_bootstrap_idempotent_and_conflicts_prewrite(db):
    engine, factory = db
    desired = manifest()
    assert apply_qa_bootstrap(factory, desired, database_name=desired["database_name"], source_sha=SOURCE_SHA) == "CREATED"
    assert apply_qa_bootstrap(factory, desired, database_name=desired["database_name"], source_sha=SOURCE_SHA) == "UNCHANGED"
    with engine.connect() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(users)) == 1
        assert connection.scalar(sa.select(sa.func.count()).select_from(roles)) == 1
        assert connection.scalar(sa.select(sa.func.count()).select_from(oidc_subject_bindings)) == 1
    with engine.begin() as connection:
        connection.execute(roles.update().where(roles.c.role_code == desired["role_code"])
                           .values(permissions=["projects:register", "pair-grants:manage", "admin:all"]))
    with pytest.raises(QABootstrapRejected):
        apply_qa_bootstrap(factory, desired, database_name=desired["database_name"], source_sha=SOURCE_SHA)
    with engine.connect() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(users)) == 1


@pytest.mark.parametrize("occupied", ["actor", "role", "binding"])
def test_existing_identity_collision_rejected_without_partial_write(db, occupied):
    engine, factory = db
    desired = manifest()
    with engine.begin() as connection:
        if occupied == "actor":
            connection.execute(users.insert().values(actor_id=desired["actor_id"], active=False))
        elif occupied == "role":
            connection.execute(roles.insert().values(role_code=desired["role_code"], permissions=["admin:all"]))
        else:
            connection.execute(users.insert().values(actor_id="other", active=True))
            connection.execute(oidc_subject_bindings.insert().values(
                issuer=desired["issuer"], subject=desired["subject"], actor_id="other", active=True))
    with pytest.raises(QABootstrapRejected):
        apply_qa_bootstrap(factory, desired, database_name=desired["database_name"], source_sha=SOURCE_SHA)
    with engine.connect() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(user_roles)) == 0


def test_readiness_exact_three_and_no_cross_pair(db):
    engine, factory = db
    desired = manifest()
    apply_qa_bootstrap(factory, desired, database_name=desired["database_name"], source_sha=SOURCE_SHA)
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(users.insert().values(actor_id="qa-reader", active=True))
        connection.execute(roles.insert().values(role_code="qa-reader", permissions=sorted(bootstrap.READINESS_PERMISSIONS)))
        connection.execute(user_roles.insert().values(actor_id="qa-reader", role_code="qa-reader",
            project_id="host", environment_id="test", step_up_required=False, active=True))
        connection.execute(oidc_subject_bindings.insert().values(
            issuer=desired["issuer"], subject="f19a-qa-reader", actor_id="qa-reader", active=True))
        now = datetime.now(timezone.utc)
        connection.execute(registered_projects.insert().values(
            project_id="host", display_name="Host", registered_by_actor_id=desired["actor_id"],
            active=True, registered_at=now, updated_at=now))
        connection.execute(registered_environments.insert().values(
            project_id="host", environment_id="test", display_name="Test",
            registered_by_actor_id=desired["actor_id"], active=True, registered_at=now, updated_at=now))
        connection.execute(pair_grants.insert(), [
            dict(actor_id="qa-reader", project_id="host", environment_id="test", permission_code=permission,
                 active=True, granted_by_actor_id=desired["actor_id"], granted_at=datetime.now(timezone.utc),
                 updated_at=datetime.now(timezone.utc))
            for permission in ("dashboard:read", "operations:alerts:read", "operations:alerts:acknowledge")])
        connection.execute(registration_audit_events.insert(), [
            dict(event_id=f"event-{index}", event_type="PAIR_GRANT_ACTIVATED", actor_id=desired["actor_id"],
                 target_actor_id="qa-reader", project_id="host", environment_id="test",
                 permission_code=permission, previous_active=None, next_active=True,
                 occurred_at=now, correlation_id=f"correlation-{index}")
            for index, permission in enumerate(sorted(bootstrap.READINESS_PERMISSIONS))])
    assert check_qa_readiness(factory, desired, target_actor_id="qa-reader") is True
    admin_only = SimpleNamespace(principal_policy=SimpleNamespace(
        issuer=desired["issuer"], allowed_roles=frozenset({desired["role_code"]}),
        allowed_permissions=frozenset(bootstrap.BOOTSTRAP_PERMISSIONS) | bootstrap.READINESS_PERMISSIONS),
        authorization_scope=SimpleNamespace(allowed_actor_roles=frozenset({desired["role_code"]})))
    with pytest.raises(QABootstrapRejected):
        bootstrap.check_qa_readiness(factory, desired, target_actor_id="qa-reader",
            target_subject="f19a-qa-reader", trusted_pair=TRUSTED_PAIR, runtime_inputs=admin_only)
    with engine.begin() as connection:
        connection.execute(oidc_subject_bindings.update().where(
            oidc_subject_bindings.c.subject == "f19a-qa-reader").values(active=False))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(oidc_subject_bindings.update().where(
            oidc_subject_bindings.c.subject == "f19a-qa-reader").values(active=True))
        connection.execute(oidc_subject_bindings.insert().values(
            issuer=desired["issuer"], subject="forged-subject", actor_id="qa-reader", active=True))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(oidc_subject_bindings.delete().where(
            oidc_subject_bindings.c.subject == "forged-subject"))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, {**desired, "password": "secret"}, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(roles.update().where(roles.c.role_code == "qa-reader")
                           .values(permissions=["dashboard:read"]))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(roles.update().where(roles.c.role_code == "qa-reader")
                           .values(permissions=sorted(bootstrap.READINESS_PERMISSIONS)))
        connection.execute(registration_audit_events.delete().where(
            registration_audit_events.c.permission_code == "dashboard:read"))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(registration_audit_events.insert().values(
            event_id="event-restore", event_type="PAIR_GRANT_ACTIVATED", actor_id=desired["actor_id"],
            target_actor_id="qa-reader", project_id="host", environment_id="test",
            permission_code="dashboard:read", previous_active=None, next_active=True,
            occurred_at=now, correlation_id="correlation-restore"))
        connection.execute(registration_audit_events.insert().values(
            event_id="event-duplicate", event_type="PAIR_GRANT_ACTIVATED", actor_id=desired["actor_id"],
            target_actor_id="qa-reader", project_id="host", environment_id="test",
            permission_code="dashboard:read", previous_active=None, next_active=True,
            occurred_at=now, correlation_id="correlation-duplicate"))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(registration_audit_events.delete().where(
            registration_audit_events.c.event_id == "event-duplicate"))
        connection.execute(pair_grants.insert().values(
            actor_id="qa-reader", project_id="other", environment_id="test",
            permission_code="dashboard:read", active=False,
            granted_by_actor_id=desired["actor_id"], revoked_by_actor_id=desired["actor_id"],
            granted_at=now, revoked_at=now, updated_at=now))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")
    with engine.begin() as connection:
        connection.execute(pair_grants.delete().where(pair_grants.c.project_id == "other"))
    with engine.begin() as connection:
        connection.execute(pair_grants.update().where(pair_grants.c.permission_code == "dashboard:read")
                           .values(project_id="other"))
    with pytest.raises(QABootstrapRejected):
        check_qa_readiness(factory, desired, target_actor_id="qa-reader")


def test_rollback_guard_blocks_old_sha_after_first_grant(db):
    engine, factory = db
    desired = manifest()
    assert decide_rollback(factory, desired, target_sha="b" * 40, guarded_sha=SOURCE_SHA) == "PRE_GRANT_ONLY"
    with engine.begin() as connection:
        connection.execute(users.insert(), [dict(actor_id="admin", active=True), dict(actor_id="reader", active=True)])
        connection.execute(pair_grants.insert().values(
            actor_id="reader", project_id="host", environment_id="test", permission_code="dashboard:read",
            active=True, granted_by_actor_id="admin", granted_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)))
    with pytest.raises(QABootstrapRejected, match="FIX_FORWARD_REQUIRED"):
        decide_rollback(factory, desired, target_sha="b" * 40, guarded_sha=SOURCE_SHA)
    assert decide_rollback(factory, desired, target_sha=SOURCE_SHA, guarded_sha=SOURCE_SHA) == "GUARDED_SHA"
    with pytest.raises(QABootstrapRejected):
        decide_rollback(factory, desired, target_sha="b" * 40, guarded_sha="b" * 40)


def test_rollback_guard_blocks_after_registration_before_grant(db):
    engine, factory = db
    desired = manifest()
    with engine.begin() as connection:
        connection.execute(users.insert().values(actor_id=desired["actor_id"], active=True))
        now = datetime.now(timezone.utc)
        connection.execute(registered_projects.insert().values(
            project_id=desired["project_id"], display_name="Host", registered_by_actor_id=desired["actor_id"],
            active=True, registered_at=now, updated_at=now))
    with pytest.raises(QABootstrapRejected, match="FIX_FORWARD_REQUIRED"):
        decide_rollback(factory, desired, target_sha="b" * 40, guarded_sha=SOURCE_SHA)
    with pytest.raises(QABootstrapRejected):
        decide_rollback(factory, {**desired, "password": "secret"}, target_sha="b" * 40,
                        guarded_sha=SOURCE_SHA)


def test_rollback_guard_blocks_other_project_state(db):
    engine, factory = db
    desired = manifest()
    with engine.begin() as connection:
        connection.execute(users.insert().values(actor_id=desired["actor_id"], active=True))
        now = datetime.now(timezone.utc)
        connection.execute(registered_projects.insert().values(
            project_id="other", display_name="Other", registered_by_actor_id=desired["actor_id"],
            active=True, registered_at=now, updated_at=now))
    with pytest.raises(QABootstrapRejected, match="FIX_FORWARD_REQUIRED"):
        decide_rollback(factory, desired, target_sha="b" * 40, guarded_sha=SOURCE_SHA)
