"""End-to-end local OIDC coordinator contract with signed tokens and SQLite stores."""

import hashlib
import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import sqlalchemy as sa
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy.orm import sessionmaker

from packages.api.oidc_code_flow import OidcCodeFlow
from packages.api.oidc_identity import OidcIdTokenVerifier
from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.persistence.oidc_pending_auth import (
    OIDC_PENDING_METADATA, SqlAlchemyPendingAuthStore, oidc_pending_auth,
)
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, OidcDirectoryRejected, SqlAlchemyOidcPrincipalResolver, oidc_subject_bindings,
    roles, user_roles, users,
)
from packages.persistence.oidc_session_store import (
    OIDC_SESSION_METADATA, SqlAlchemyOidcSessionStore, oidc_sessions,
)
from packages.api.oidc_session_coordinator import (
    OidcSessionCoordinator, OidcSessionRejected,
)


ISSUER = "https://issuer.example.test/realm"
CLIENT = "anvil-test-client"
REDIRECT = "https://anvil.example.test/oidc/callback"


@pytest.fixture
def context():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    OIDC_PENDING_METADATA.create_all(engine)
    DIRECTORY_METADATA.create_all(engine)
    OIDC_SESSION_METADATA.create_all(engine)
    factory = sessionmaker(bind=engine)
    with engine.begin() as db:
        db.execute(users.insert().values(actor_id="actor-1", active=True))
        db.execute(roles.insert().values(role_code="operator", permissions=["tasks:read"]))
        db.execute(user_roles.insert().values(
            actor_id="actor-1", role_code="operator", project_id="project-1",
            environment_id="wsl-qa", step_up_required=False, active=True,
        ))
        db.execute(oidc_subject_bindings.insert().values(
            issuer=ISSUER, subject="subject-1", actor_id="actor-1", active=True,
        ))
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public.update(kid="key-1", use="sig", alg="RS256")
    # SQLite CURRENT_TIMESTAMP has second precision; align the synthetic clock.
    now = [datetime.now(timezone.utc).replace(microsecond=0)]
    verifier = OidcIdTokenVerifier(
        json.dumps({"keys": [public]}), issuer=ISSUER, client_id=CLIENT,
        step_up_acr="urn:anvil:step-up", clock=lambda: now[0],
    )
    response = {"nonce": None, "step_up": False, "auth_age": 0, "fail": False}

    def exchange(_code, _verifier, _redirect, _client):
        if response["fail"]:
            raise RuntimeError("sensitive token endpoint payload")
        claims = dict(iss=ISSUER, aud=CLIENT, sub="subject-1",
                      exp=int(now[0].timestamp()) + 60,
                      iat=int(now[0].timestamp()), nonce=response["nonce"])
        if response["step_up"]:
            claims.update(acr="urn:anvil:step-up",
                          auth_time=int(now[0].timestamp()) - response["auth_age"])
        return {"id_token": jwt.encode(claims, private, algorithm="RS256",
                                       headers={"kid": "key-1"})}

    flow = OidcCodeFlow(
        ISSUER + "/authorize", client_id=CLIENT, redirect_uri=REDIRECT,
        verifier=verifier, pending_store=SqlAlchemyPendingAuthStore(factory),
        exchange_code=exchange, clock=lambda: now[0],
    )
    resolver = SqlAlchemyOidcPrincipalResolver(factory)
    policy = OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}), frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset({"wsl-qa"}),
    )
    store = SqlAlchemyOidcSessionStore(factory)
    coordinator = OidcSessionCoordinator(
        flow, resolver, policy, store, clock=lambda: now[0],
    )

    def issue(*, step_up=False):
        response["step_up"] = step_up
        request = coordinator.begin(require_step_up=step_up)
        with engine.connect() as db:
            response["nonce"] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
                oidc_pending_auth.c.state_digest == hashlib.sha256(
                    request.browser_state.encode("ascii")
                ).digest()
            )).scalar_one()
        return coordinator.complete(code="one-use-code", state=request.browser_state,
                                    browser_state=request.browser_state), request

    try:
        yield coordinator, issue, engine, now, response, flow, resolver, policy, store
    finally:
        engine.dispose()


def _digest(token):
    return hashlib.sha256(token.encode("ascii")).digest()


def test_signed_flow_issues_digest_only_and_replay_fails(context):
    coordinator, issue, engine, now, _, _, _, _, _ = context
    issued, request = issue()
    assert issued.max_age_seconds == 900
    assert now[0] < issued.expires_at <= now[0] + timedelta(seconds=900)
    assert len(issued.session_token) == len(issued.csrf_token) == 43
    assert issued.session_token != issued.csrf_token
    assert coordinator.authenticate(issued.session_token).csrf_token == issued.csrf_token
    with engine.connect() as db:
        row = db.execute(sa.select(oidc_sessions)).mappings().one()
    assert row["session_digest"] == _digest(issued.session_token)
    assert issued.session_token.encode() not in repr(dict(row)).encode()
    assert not {"role", "permissions", "project_id", "bearer"} & set(row)
    assert issued.session_token not in repr(issued)
    assert issued.csrf_token not in repr(issued)
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$"):
        coordinator.complete(code="one-use-code", state=request.browser_state,
                             browser_state=request.browser_state)


def test_two_sessions_remain_independent_and_revoke_is_scoped(context):
    coordinator, issue, *_ = context
    first, _ = issue()
    second, _ = issue()
    assert first.session_token != second.session_token
    assert coordinator.authenticate(first.session_token) is not None
    coordinator.revoke(first.session_token)
    assert coordinator.authenticate(first.session_token) is None
    assert coordinator.authenticate(second.session_token) is not None
    coordinator.revoke(first.session_token)


def test_expiry_and_authority_change_are_checked_on_every_authentication(context):
    coordinator, issue, engine, _, _, _, _, _, _ = context
    issued, _ = issue()
    assert coordinator.authenticate(issued.session_token).permissions == frozenset({"tasks:read"})
    with engine.begin() as db:
        db.execute(roles.update().values(permissions=["tasks:write"]))
    assert coordinator.authenticate(issued.session_token) is None
    with engine.begin() as db:
        db.execute(roles.update().values(permissions=["tasks:read"]))
        db.execute(users.update().values(active=False))
    assert coordinator.authenticate(issued.session_token) is None
    with engine.begin() as db:
        db.execute(users.update().values(active=True))
        db.execute(oidc_sessions.update().values(
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
        ))
    assert coordinator.authenticate(issued.session_token) is None


def test_binding_failure_writes_no_session_and_resolver_queried_once(context):
    coordinator, issue, engine, _, _, _, resolver, _, _ = context
    calls = []
    original = resolver.resolve

    def counted(issuer, subject):
        calls.append((issuer, subject))
        return original(issuer, subject)

    resolver.resolve = counted
    issued, _ = issue()
    assert len(calls) == 1
    assert coordinator.authenticate(issued.session_token) is not None
    assert len(calls) == 2
    with engine.begin() as db:
        db.execute(user_roles.update().values(step_up_required=True))
    request = coordinator.begin()
    with engine.connect() as db:
        nonce = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
            oidc_pending_auth.c.state_digest == _digest(request.browser_state)
        )).scalar_one()
    # The issuer callback uses the already created request nonce.
    context[4]["nonce"] = nonce
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$"):
        coordinator.complete(code="one-use-code", state=request.browser_state,
                             browser_state=request.browser_state)
    assert len(calls) == 3
    with engine.connect() as db:
        assert db.execute(sa.select(sa.func.count()).select_from(oidc_sessions)).scalar_one() == 1


def test_directory_unavailable_distinguished_from_denial(context):
    coordinator, issue, _, _, _, _, resolver, _, _ = context
    issued, _ = issue()
    resolver.resolve = lambda *_: (_ for _ in ()).throw(
        OidcDirectoryRejected("OIDC_DIRECTORY_NOT_AVAILABLE")
    )
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AVAILABLE$") as error:
        coordinator.authenticate(issued.session_token)
    assert error.value.__cause__ is None and error.value.__context__ is None
    resolver.resolve = lambda *_: (_ for _ in ()).throw(
        OidcDirectoryRejected("OIDC_DIRECTORY_NOT_AUTHORIZED")
    )
    assert coordinator.authenticate(issued.session_token) is None


def test_step_up_auth_time_caps_session_and_expiry_never_downgrades(context):
    coordinator, issue, engine, now, response, *_ = context
    with engine.begin() as db:
        db.execute(user_roles.update().values(step_up_required=True))
    response["auth_age"] = 295
    issued, _ = issue(step_up=True)
    with engine.connect() as db:
        step_expiry = db.execute(sa.select(oidc_sessions.c.step_up_valid_until)).scalar_one()
    assert step_expiry <= datetime.fromtimestamp(int(now[0].timestamp()) - 295 + 300,
                                                 timezone.utc).replace(tzinfo=None)
    assert coordinator.authenticate(issued.session_token) is not None
    now[0] += timedelta(seconds=6)
    assert coordinator.authenticate(issued.session_token) is None


def test_step_up_at_300_seconds_is_not_issued_even_if_verifier_accepts(context):
    coordinator, issue, engine, _, response, *_ = context
    with engine.begin() as db:
        db.execute(user_roles.update().values(step_up_required=True))
    response["auth_age"] = 300
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$") as error:
        issue(step_up=True)
    assert error.value.__cause__ is None and error.value.__context__ is None
    with engine.connect() as db:
        assert db.execute(sa.select(sa.func.count()).select_from(oidc_sessions)).scalar_one() == 0


@pytest.mark.parametrize("token", ["", " ", "A" * 42, "+" + "A" * 42,
                                   "A" * 42 + "B", None, 123])
def test_malformed_bearer_skips_store(context, token):
    coordinator, _, _, _, _, _, _, _, store = context
    store.get = lambda _digest: pytest.fail("malformed token reached DB")
    assert coordinator.authenticate(token) is None


def test_failed_code_exchange_and_randomness_leave_no_session(context):
    coordinator, issue, engine, _, response, flow, resolver, policy, store = context
    response["fail"] = True
    request = coordinator.begin()
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$") as error:
        coordinator.complete(code="sensitive-code", state=request.browser_state,
                             browser_state=request.browser_state)
    assert error.value.__cause__ is None and error.value.__context__ is None
    response["fail"] = False
    bad = OidcSessionCoordinator(flow, resolver, policy, store,
                                 random_bytes=lambda n: b"A" * n)
    request = bad.begin()
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$"):
        bad.complete(code="sensitive-code", state=request.browser_state,
                     browser_state=request.browser_state)
    with engine.connect() as db:
        assert db.execute(sa.select(sa.func.count()).select_from(oidc_sessions)).scalar_one() == 0


def test_storage_and_resolver_outage_redacted_without_exception_chain(context):
    coordinator, issue, engine, _, _, flow, resolver, policy, store = context
    issued, _ = issue()
    store.get = lambda _digest: (_ for _ in ()).throw(RuntimeError("bearer SQL secret"))
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AVAILABLE$") as error:
        coordinator.authenticate(issued.session_token)
    assert error.value.__cause__ is None and error.value.__context__ is None
    store.get = SqlAlchemyOidcSessionStore(sessionmaker(bind=engine)).get
    resolver.resolve = lambda *_: (_ for _ in ()).throw(RuntimeError("CSRF SQL secret"))
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AVAILABLE$") as error:
        coordinator.authenticate(issued.session_token)
    assert error.value.__cause__ is None and error.value.__context__ is None
    assert "secret" not in repr(error.value)


def test_put_outage_does_not_expose_sensitive_inputs(context):
    coordinator, _, engine, _, response, _, _, _, store = context
    store.put = lambda *_: (_ for _ in ()).throw(RuntimeError("sensitive bearer SQL"))
    request = coordinator.begin()
    with engine.connect() as db:
        response["nonce"] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
            oidc_pending_auth.c.state_digest == _digest(request.browser_state)
        )).scalar_one()
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AVAILABLE$") as error:
        coordinator.complete(code="sensitive-code", state=request.browser_state,
                             browser_state=request.browser_state)
    assert error.value.__cause__ is None and error.value.__context__ is None
    assert "sensitive" not in repr(error.value)
