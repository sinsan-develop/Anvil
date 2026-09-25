"""Offline authorization-code transaction tests with synthetic RSA tokens."""

import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from packages.api.oidc_code_flow import OidcCodeFlow, OidcCodeFlowRejected
from packages.api.oidc_identity import OidcIdTokenVerifier


NOW = datetime(2026, 9, 25, 4, 0, tzinfo=timezone.utc)
ISSUER = "https://issuer.example.test/realm"
CLIENT = "anvil-test-client"
REDIRECT = "https://anvil.example.test/oidc/callback"


class AtomicFakeStore:
    def __init__(self):
        self.values = {}
        self.consumes = 0

    def put(self, digest, pending):
        assert isinstance(digest, bytes) and len(digest) == 32
        assert digest not in self.values
        self.values[digest] = pending

    def consume(self, digest):
        self.consumes += 1
        return self.values.pop(digest, None)


@pytest.fixture
def setup_flow():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public.update(kid="key-1", use="sig", alg="RS256")
    current = [NOW]
    verifier = OidcIdTokenVerifier(
        json.dumps({"keys": [public]}), issuer=ISSUER, client_id=CLIENT,
        step_up_acr="urn:anvil:step-up", clock=lambda: current[0],
    )
    store = AtomicFakeStore()
    exchanges = []
    claims_override = {}
    response = {}

    def exchange(code, code_verifier, redirect_uri, client_id):
        exchanges.append((code, code_verifier, redirect_uri, client_id))
        if response.get("raise"):
            raise ValueError("secret token endpoint failure")
        pending = next(iter(store.values.values()), None)
        # complete consumes first, so capture nonce via test-supplied response.
        nonce = response.get("nonce", pending.nonce if pending else None)
        payload = dict(iss=ISSUER, aud=CLIENT, sub="subject-1",
                       exp=int(current[0].timestamp()) + 60,
                       iat=int(current[0].timestamp()), nonce=nonce,
                       **claims_override)
        token = jwt.encode(payload, private, algorithm="RS256", headers={"kid": "key-1"})
        return {"id_token": token} if not response.get("missing") else {}

    # The token port needs the nonce from the consumed request only to simulate
    # an issuer; tests set it explicitly after begin, never in product logic.
    flow = OidcCodeFlow(
        ISSUER + "/authorize", client_id=CLIENT, redirect_uri=REDIRECT,
        verifier=verifier, pending_store=store, exchange_code=exchange,
        clock=lambda: current[0],
    )
    return flow, store, current, exchanges, response, claims_override


def _begin(flow, store, response, *, step_up=False):
    request = flow.begin(require_step_up=step_up)
    response["nonce"] = next(iter(store.values.values())).nonce
    return request


def test_begin_s256_and_complete_once(setup_flow):
    flow, store, _, exchanges, response, _ = setup_flow
    request = _begin(flow, store, response)
    query = parse_qs(urlsplit(request.url).query)
    assert urlsplit(request.url).scheme == "https"
    assert {key: value[0] for key, value in query.items() if key in
            {"response_type", "scope", "client_id", "redirect_uri", "code_challenge_method"}} == {
                "response_type": "code", "scope": "openid", "client_id": CLIENT,
                "redirect_uri": REDIRECT, "code_challenge_method": "S256"}
    assert query["state"] == [request.browser_state]
    pending = next(iter(store.values.values()))
    assert list(store.values) == [hashlib.sha256(request.browser_state.encode("ascii")).digest()]
    assert pending.expires_at == NOW + timedelta(seconds=300)
    expected_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(pending.code_verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    assert query["code_challenge"] == [expected_challenge]
    assert query["nonce"] == [pending.nonce]
    assert len({request.browser_state, pending.nonce, pending.code_verifier}) == 3
    assert all(len(value) == 43 for value in (request.browser_state, pending.nonce, pending.code_verifier))
    identity = flow.complete(code="code-1", state=request.browser_state,
                             browser_state=request.browser_state)
    assert identity.subject == "subject-1"
    assert identity.step_up_verified is False
    assert exchanges == [("code-1", pending.code_verifier, REDIRECT, CLIENT)]
    with pytest.raises(OidcCodeFlowRejected):
        flow.complete(code="code-1", state=request.browser_state,
                      browser_state=request.browser_state)
    assert len(exchanges) == 1


def test_each_begin_has_independent_random_material(setup_flow):
    flow, store, _, _, _, _ = setup_flow
    first = flow.begin()
    second = flow.begin()
    assert first.browser_state != second.browser_state
    assert len(store.values) == 2
    values = list(store.values.values())
    assert values[0].nonce != values[1].nonce
    assert values[0].code_verifier != values[1].code_verifier


def test_mismatched_browser_state_never_consumes_or_exchanges(setup_flow):
    flow, store, _, exchanges, response, _ = setup_flow
    request = _begin(flow, store, response)
    with pytest.raises(OidcCodeFlowRejected):
        flow.complete(code="code", state=request.browser_state, browser_state="other-browser-state")
    assert store.consumes == 0
    assert exchanges == []


@pytest.mark.parametrize("elapsed", [300, 301])
def test_expired_state_cannot_exchange(setup_flow, elapsed):
    flow, store, current, exchanges, response, _ = setup_flow
    request = _begin(flow, store, response)
    current[0] += timedelta(seconds=elapsed)
    with pytest.raises(OidcCodeFlowRejected):
        flow.complete(code="code", state=request.browser_state,
                      browser_state=request.browser_state)
    assert exchanges == []
    assert store.consumes == 1


@pytest.mark.parametrize("code", ["", " code ", None])
def test_invalid_code_rejected_before_consume(setup_flow, code):
    flow, store, _, exchanges, response, _ = setup_flow
    request = _begin(flow, store, response)
    with pytest.raises(OidcCodeFlowRejected):
        flow.complete(code=code, state=request.browser_state,
                      browser_state=request.browser_state)
    assert exchanges == []
    assert store.consumes == 0


@pytest.mark.parametrize("failure", ["raise", "missing", "nonce"])
def test_token_exchange_or_verification_failure_is_redacted(setup_flow, failure):
    flow, store, _, exchanges, response, _ = setup_flow
    request = _begin(flow, store, response)
    response[failure] = "wrong-nonce" if failure == "nonce" else True
    with pytest.raises(OidcCodeFlowRejected) as error:
        flow.complete(code="secret-code", state=request.browser_state,
                      browser_state=request.browser_state)
    assert str(error.value) == "OIDC_CODE_FLOW_NOT_VERIFIED"
    assert len(exchanges) == 1
    assert store.consumes == 1


def test_saved_step_up_purpose_controls_verification(setup_flow):
    flow, store, _, _, response, claims = setup_flow
    ordinary = _begin(flow, store, response)
    claims.update(acr="urn:anvil:step-up", auth_time=int(NOW.timestamp()))
    identity = flow.complete(code="code", state=ordinary.browser_state,
                             browser_state=ordinary.browser_state)
    assert identity.step_up_verified is False  # Ordinary request cannot claim step-up.
    claims.clear()
    step_up = _begin(flow, store, response, step_up=True)
    with pytest.raises(OidcCodeFlowRejected):
        flow.complete(code="code", state=step_up.browser_state,
                      browser_state=step_up.browser_state)


def test_ordinary_request_does_not_ask_for_step_up(setup_flow):
    flow, store, _, _, response, _ = setup_flow
    request = _begin(flow, store, response)
    query = parse_qs(urlsplit(request.url).query)
    assert "claims" not in query
    assert "max_age" not in query
    assert "acr_values" not in query


def test_step_up_request_demands_essential_acr_and_recent_authentication(setup_flow):
    flow, store, _, _, response, _ = setup_flow
    request = _begin(flow, store, response, step_up=True)
    query = parse_qs(urlsplit(request.url).query)
    assert flow._verifier.step_up_acr == "urn:anvil:step-up"
    assert flow._verifier.step_up_max_age_seconds == 300
    assert query["max_age"] == ["300"]
    assert query["claims"] == [
        '{"id_token":{"acr":{"essential":true,"values":["urn:anvil:step-up"]},'
        '"auth_time":{"essential":true}}}'
    ]
    with pytest.raises(AttributeError):
        flow._verifier.step_up_acr = "urn:forged:acr"
    pending = next(iter(store.values.values()))
    assert pending.require_step_up is True
    assert query["state"] == [request.browser_state]
    assert query["nonce"] == [pending.nonce]
    expected_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(pending.code_verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    assert query["code_challenge"] == [expected_challenge]
    assert query["code_challenge_method"] == ["S256"]


@pytest.mark.parametrize("acr,age,accepted", [
    ("urn:anvil:step-up", 300, True),
    ("urn:anvil:step-up", 301, False),
    ("urn:other:acr", 0, False),
])
def test_step_up_return_requires_matching_acr_and_recent_auth_time(
    setup_flow, acr, age, accepted
):
    flow, store, _, _, response, claims = setup_flow
    request = _begin(flow, store, response, step_up=True)
    claims.update(acr=acr, auth_time=int(NOW.timestamp()) - age)
    if accepted:
        identity = flow.complete(code="code", state=request.browser_state,
                                 browser_state=request.browser_state)
        assert identity.step_up_verified is True
    else:
        with pytest.raises(OidcCodeFlowRejected):
            flow.complete(code="code", state=request.browser_state,
                          browser_state=request.browser_state)


@pytest.mark.parametrize("endpoint,redirect,client", [
    ("http://issuer.example/authorize", REDIRECT, CLIENT),
    ("https://user:password@issuer.example/authorize", REDIRECT, CLIENT),
    (ISSUER + "/authorize?scope=admin", REDIRECT, CLIENT),
    (ISSUER + "/authorize#fragment", REDIRECT, CLIENT),
    (ISSUER + "/authorize", "http://anvil.example/callback", CLIENT),
    (ISSUER + "/authorize", REDIRECT + "?code=forged", CLIENT),
    (ISSUER + "/authorize", REDIRECT, " client "),
])
def test_noncanonical_fixed_configuration_rejected(setup_flow, endpoint, redirect, client):
    flow, store, current, _, _, _ = setup_flow
    with pytest.raises(OidcCodeFlowRejected):
        OidcCodeFlow(endpoint, client_id=client, redirect_uri=redirect,
                     verifier=flow._verifier, pending_store=store,
                     exchange_code=lambda *args: {}, clock=lambda: current[0])


@pytest.mark.parametrize("parts", [
    [b"too-short"] * 3,
    [b"A" * 32] * 3,
    ["A" * 32] * 3,
])
def test_invalid_random_source_rejected_without_pending_state(setup_flow, parts):
    flow, store, current, _, _, _ = setup_flow
    calls = iter(parts)
    bad = OidcCodeFlow(ISSUER + "/authorize", client_id=CLIENT,
                       redirect_uri=REDIRECT, verifier=flow._verifier,
                       pending_store=store, exchange_code=lambda *args: {},
                       clock=lambda: current[0], random_bytes=lambda n: next(calls))
    with pytest.raises(OidcCodeFlowRejected):
        bad.begin()
    assert store.values == {}


@pytest.mark.parametrize("id_token", [None, False, 5, "", " invalid "])
def test_invalid_id_token_response_rejected(setup_flow, id_token):
    flow, store, _, exchanges, response, _ = setup_flow
    request = _begin(flow, store, response)
    flow._exchange = lambda *args: {"id_token": id_token}
    with pytest.raises(OidcCodeFlowRejected) as error:
        flow.complete(code="secret-code", state=request.browser_state,
                      browser_state=request.browser_state)
    assert str(error.value) == "OIDC_CODE_FLOW_NOT_VERIFIED"
    assert store.consumes == 1
    assert exchanges == []
