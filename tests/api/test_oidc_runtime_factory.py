"""Trusted OIDC composition with real SQLite stores and a network-boundary fake."""

import hashlib
import json
from dataclasses import replace
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
import sqlalchemy as sa
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy.orm import sessionmaker

from packages.api.oidc_principal import OidcPrincipalPolicy
from packages.api.oidc_runtime_factory import (
    OidcRuntimeConfig, OidcRuntimeRejected, build_oidc_session_coordinator,
)
from packages.api.oidc_session_coordinator import OidcSessionCoordinator, OidcSessionRejected
from packages.persistence.oidc_pending_auth import OIDC_PENDING_METADATA, oidc_pending_auth
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, oidc_subject_bindings, roles, user_roles, users,
)
from packages.persistence.oidc_session_store import OIDC_SESSION_METADATA, oidc_sessions


ISSUER = "https://issuer.example.test/realms/anvil"
CLIENT = "anvil-web"
REDIRECT = "https://anvil.example.test/auth/oidc/callback"
ACR = "urn:anvil:step-up"


@pytest.fixture
def setup():
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    for metadata in (OIDC_PENDING_METADATA, DIRECTORY_METADATA, OIDC_SESSION_METADATA):
        metadata.create_all(engine)
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
    policy = OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}), frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset({"wsl-qa"}),
    )
    config = OidcRuntimeConfig(
        issuer=ISSUER, client_id=CLIENT, redirect_uri=REDIRECT,
        jwks_json=json.dumps({"keys": [public]}), step_up_acr=ACR,
        principal_policy=policy,
    )
    try:
        yield engine, sessionmaker(bind=engine), private, config
    finally:
        engine.dispose()


@pytest.mark.parametrize("change", [
    {"issuer": "http://issuer.example.test/realms/anvil"},
    {"issuer": ISSUER + "?secret=exposed"},
    {"issuer": "https://issuer.example.test:invalid/realms/anvil",
     "principal_policy": OidcPrincipalPolicy(
         "https://issuer.example.test:invalid/realms/anvil", frozenset({"operator"}),
         frozenset({"tasks:read"}), frozenset({"project-1"}), frozenset({"wsl-qa"}))},
    {"issuer": "https://issuer.example.test:65536/realms/anvil",
     "principal_policy": OidcPrincipalPolicy(
         "https://issuer.example.test:65536/realms/anvil", frozenset({"operator"}),
         frozenset({"tasks:read"}), frozenset({"project-1"}), frozenset({"wsl-qa"}))},
    {"client_id": ""},
    {"redirect_uri": "http://anvil.example.test/auth/oidc/callback"},
    {"jwks_json": '{"keys":[{'},
    {"step_up_acr": ""},
    {"principal_policy": OidcPrincipalPolicy(
        "https://other.example.test", frozenset({"operator"}), frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset({"wsl-qa"}))},
    {"principal_policy": OidcPrincipalPolicy(
        ISSUER, frozenset(), frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset({"wsl-qa"}))},
    {"principal_policy": OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}), frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset({"*"}))},
    {"principal_policy": OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}), frozenset(),
        frozenset({"project-1"}), frozenset({"wsl-qa"}))},
    {"principal_policy": OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}), frozenset({"tasks:read"}),
        frozenset(), frozenset({"wsl-qa"}))},
    {"principal_policy": OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}), frozenset({"tasks:read"}),
        frozenset({"project-1"}), frozenset())},
    {"ca_bundle": ""}, {"client_secret": "literal-secret"},
])
def test_invalid_config_rejected_before_runtime_or_network(setup, change):
    _, factory, _, config = setup
    bad = replace(config, **change)
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$") as error:
        build_oidc_session_coordinator(
            bad, factory, transport=httpx.MockTransport(
                lambda request: pytest.fail("configuration reached network")),
        )
    assert error.value.__cause__ is None
    assert error.value.__suppress_context__ is True


@pytest.mark.parametrize("factory,transport", [
    (None, None), ("not callable", None), (lambda: None, "not a transport"),
])
def test_untrusted_injection_rejected(setup, factory, transport):
    _, _, _, config = setup
    with pytest.raises(OidcRuntimeRejected, match="^OIDC_RUNTIME_NOT_CONFIGURED$"):
        build_oidc_session_coordinator(config, factory, transport=transport)


def test_config_repr_hides_jwks_and_secret_and_provider_is_lazy(setup):
    _, factory, _, config = setup
    calls = []

    def secret():
        calls.append("called")
        return "sensitive-client-secret"

    config = replace(config, client_secret=secret)
    assert "key-1" not in repr(config)
    assert "sensitive-client-secret" not in repr(config)
    coordinator = build_oidc_session_coordinator(config, factory,
        transport=httpx.MockTransport(lambda request: pytest.fail("unexpected exchange")))
    assert isinstance(coordinator, OidcSessionCoordinator)
    assert calls == []


def test_signed_exchange_binds_server_authority_and_revokes(setup):
    engine, factory, private, config = setup
    calls = []
    secret_calls = []
    nonce = [None]

    def secret():
        secret_calls.append(True)
        return "sensitive-client-secret"

    def handler(request):
        calls.append(request)
        now = int(datetime.now(timezone.utc).timestamp())
        token = jwt.encode({
            "iss": ISSUER, "aud": CLIENT, "sub": "subject-1", "nonce": nonce[0],
            "exp": now + 60, "iat": now,
        }, private, algorithm="RS256", headers={"kid": "key-1"})
        return httpx.Response(200, headers={"Content-Type": "application/json"},
                              json={"id_token": token, "access_token": "discard-me"})

    coordinator = build_oidc_session_coordinator(
        replace(config, client_secret=secret), factory,
        transport=httpx.MockTransport(handler),
    )
    assert secret_calls == []
    request = coordinator.begin()
    url = urlsplit(request.url)
    assert url._replace(query="").geturl() == ISSUER + "/protocol/openid-connect/auth"
    assert parse_qs(url.query)["client_id"] == [CLIENT]
    with engine.connect() as db:
        nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
            oidc_pending_auth.c.state_digest == hashlib.sha256(
                request.browser_state.encode("ascii")).digest(),
        )).scalar_one()
    issued = coordinator.complete(code="one-use-code", state=request.browser_state,
                                  browser_state=request.browser_state)
    assert secret_calls == [True]
    assert [str(call.url) for call in calls] == [ISSUER + "/protocol/openid-connect/token"]
    assert calls[0].method == "POST"
    assert calls[0].headers["Authorization"].startswith("Basic ")
    principal = coordinator.authenticate(issued.session_token)
    assert principal.actor_id == "actor-1"
    assert principal.actor_role == "operator"
    assert principal.permissions == frozenset({"tasks:read"})
    assert principal.project_ids == frozenset({"project-1"})
    assert principal.environment_ids == frozenset({"wsl-qa"})
    with engine.connect() as db:
        row = db.execute(sa.select(oidc_sessions)).mappings().one()
    assert row["session_digest"] == hashlib.sha256(issued.session_token.encode()).digest()
    assert issued.session_token not in repr(dict(row))
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$"):
        coordinator.complete(code="one-use-code", state=request.browser_state,
                             browser_state=request.browser_state)
    assert len(calls) == 1
    assert coordinator.authenticate(issued.session_token) is not None
    coordinator.revoke(issued.session_token)
    assert coordinator.authenticate(issued.session_token) is None
    with engine.connect() as db:
        assert db.execute(sa.select(oidc_sessions.c.revoked_at)).scalar_one() is not None


def test_authority_change_denies_unrevoked_session(setup):
    engine, factory, private, config = setup
    nonce = [None]

    def handler(request):
        now = int(datetime.now(timezone.utc).timestamp())
        token = jwt.encode({"iss": ISSUER, "aud": CLIENT, "sub": "subject-1",
                            "nonce": nonce[0], "exp": now + 60, "iat": now},
                           private, algorithm="RS256", headers={"kid": "key-1"})
        return httpx.Response(200, headers={"Content-Type": "application/json"},
                              json={"id_token": token})

    coordinator = build_oidc_session_coordinator(config, factory,
                                                  transport=httpx.MockTransport(handler))
    request = coordinator.begin()
    with engine.connect() as db:
        nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
            oidc_pending_auth.c.state_digest == hashlib.sha256(
                request.browser_state.encode("ascii")).digest(),
        )).scalar_one()
    issued = coordinator.complete(code="one-use-code", state=request.browser_state,
                                  browser_state=request.browser_state)
    assert coordinator.authenticate(issued.session_token) is not None
    with engine.begin() as db:
        db.execute(roles.update().values(permissions=["tasks:write"]))
    assert coordinator.authenticate(issued.session_token) is None
    with engine.connect() as db:
        assert db.execute(sa.select(oidc_sessions.c.revoked_at)).scalar_one() is None


@pytest.mark.parametrize("claim_change", [
    {"iss": "https://other.example.test"}, {"aud": "other-client"},
    {"sub": "unbound-subject"}, {"signature": "other-key"},
])
def test_signed_token_wrong_identity_never_issues_session(setup, claim_change):
    engine, factory, private, config = setup
    nonce = [None]

    def handler(request):
        now = int(datetime.now(timezone.utc).timestamp())
        claims = {"iss": ISSUER, "aud": CLIENT, "sub": "subject-1", "nonce": nonce[0],
                  "exp": now + 60, "iat": now}
        if "signature" not in claim_change:
            claims.update(claim_change)
        signer = (rsa.generate_private_key(public_exponent=65537, key_size=2048)
                  if "signature" in claim_change else private)
        return httpx.Response(200, headers={"Content-Type": "application/json"},
                              json={"id_token": jwt.encode(
                                  claims, signer, algorithm="RS256", headers={"kid": "key-1"})})

    coordinator = build_oidc_session_coordinator(config, factory,
                                                  transport=httpx.MockTransport(handler))
    request = coordinator.begin()
    with engine.connect() as db:
        nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
            oidc_pending_auth.c.state_digest == hashlib.sha256(
                request.browser_state.encode("ascii")).digest(),
        )).scalar_one()
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$"):
        coordinator.complete(code="one-use-code", state=request.browser_state,
                             browser_state=request.browser_state)
    with engine.connect() as db:
        assert db.execute(sa.select(sa.func.count()).select_from(oidc_sessions)).scalar_one() == 0


@pytest.mark.parametrize("binding_change", [
    {"role_code": "unapproved"},
    {"project_id": "unapproved-project"},
    {"environment_id": "unapproved-environment"},
])
def test_server_binding_outside_policy_never_issues_session(setup, binding_change):
    engine, factory, private, config = setup
    if "role_code" in binding_change:
        with engine.begin() as db:
            db.execute(roles.insert().values(role_code="unapproved", permissions=["tasks:read"]))
    with engine.begin() as db:
        db.execute(user_roles.update().values(**binding_change))
    nonce = [None]

    def handler(request):
        now = int(datetime.now(timezone.utc).timestamp())
        token = jwt.encode({"iss": ISSUER, "aud": CLIENT, "sub": "subject-1",
                            "nonce": nonce[0], "exp": now + 60, "iat": now},
                           private, algorithm="RS256", headers={"kid": "key-1"})
        return httpx.Response(200, headers={"Content-Type": "application/json"},
                              json={"id_token": token})

    coordinator = build_oidc_session_coordinator(config, factory,
                                                  transport=httpx.MockTransport(handler))
    request = coordinator.begin()
    with engine.connect() as db:
        nonce[0] = db.execute(sa.select(oidc_pending_auth.c.nonce).where(
            oidc_pending_auth.c.state_digest == hashlib.sha256(
                request.browser_state.encode("ascii")).digest(),
        )).scalar_one()
    with pytest.raises(OidcSessionRejected, match="^OIDC_SESSION_NOT_AUTHORIZED$"):
        coordinator.complete(code="one-use-code", state=request.browser_state,
                             browser_state=request.browser_state)
    with engine.connect() as db:
        assert db.execute(sa.select(sa.func.count()).select_from(oidc_sessions)).scalar_one() == 0
