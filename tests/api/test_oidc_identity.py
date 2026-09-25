"""Static, synthetic-key OIDC ID Token verifier contracts."""

import json
from datetime import datetime, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from packages.api.oidc_identity import OidcIdTokenVerifier, OidcTokenRejected


NOW = datetime(2026, 9, 25, 3, 0, tzinfo=timezone.utc)
ISSUER = "https://issuer.example.test/realm"
CLIENT = "anvil-test-client"
NONCE = "request-nonce"


@pytest.fixture
def signed():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public.update(kid="key-1", use="sig", alg="RS256")
    verifier = OidcIdTokenVerifier(
        json.dumps({"keys": [public]}), issuer=ISSUER, client_id=CLIENT,
        step_up_acr="urn:anvil:step-up", clock=lambda: NOW,
    )
    claims = dict(iss=ISSUER, aud=CLIENT, sub="user-1", exp=int(NOW.timestamp()) + 60,
                  iat=int(NOW.timestamp()), nonce=NONCE)

    def make(*, changes=None, headers=None, algorithm="RS256", key=None):
        payload = {**claims, **(changes or {})}
        return jwt.encode(payload, key or private, algorithm=algorithm,
                          headers={"kid": "key-1", **(headers or {})})

    return verifier, make, public, private


def test_verified_identity_is_not_an_authorization_principal(signed):
    verifier, make, _, _ = signed
    identity = verifier.verify(make(changes={"role": "admin", "project": "other", "scope": "*"}),
                               expected_nonce=NONCE)
    assert identity.subject == "user-1"
    assert identity.issuer == ISSUER
    assert identity.step_up_verified is False
    assert set(vars(identity)) == {"subject", "issuer", "auth_time", "acr", "step_up_verified"}


@pytest.mark.parametrize("changes", [
    {"iss": "https://other.example.test"}, {"aud": "other-client"},
    {"aud": [CLIENT]}, {"aud": [CLIENT, "other-client"]},
    {"nonce": "wrong"}, {"sub": ""}, {"exp": int(NOW.timestamp()) - 31},
    {"iat": int(NOW.timestamp()) + 31}, {"exp": True}, {"iat": False},
    {"exp": 1.5}, {"iat": 1.5}, {"exp": "9999999999"}, {"iat": "1"},
    {"nbf": int(NOW.timestamp()) + 31}, {"nbf": True},
])
def test_invalid_claims_rejected(signed, changes):
    verifier, make, _, _ = signed
    with pytest.raises(OidcTokenRejected):
        verifier.verify(make(changes=changes), expected_nonce=NONCE)


@pytest.mark.parametrize("missing", ["iss", "aud", "sub", "exp", "iat", "nonce"])
def test_required_claim_rejected(signed, missing):
    verifier, make, _, _ = signed
    # json encoding cannot remove a claim via the fixture's overlay.
    payload = dict(iss=ISSUER, aud=CLIENT, sub="user-1", exp=int(NOW.timestamp()) + 60,
                   iat=int(NOW.timestamp()), nonce=NONCE)
    payload.pop(missing)
    _, _, _, private = signed
    token = jwt.encode(payload, private, algorithm="RS256", headers={"kid": "key-1"})
    with pytest.raises(OidcTokenRejected):
        verifier.verify(token, expected_nonce=NONCE)


@pytest.mark.parametrize("header", [{"jku": "https://secret.example/key"},
                                    {"x5u": "https://secret.example/cert"},
                                    {"jwk": {"kty": "oct", "k": "secret"}},
                                    {"x5c": ["secret"]}, {"kid": "unknown"}])
def test_untrusted_header_cannot_change_key(signed, header):
    verifier, make, _, _ = signed
    with pytest.raises(OidcTokenRejected) as error:
        verifier.verify(make(headers=header), expected_nonce=NONCE)
    assert "secret" not in str(error.value)


def test_wrong_signature_and_algorithm_rejected(signed):
    verifier, make, _, _ = signed
    another = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    for token in (make(key=another),
                  jwt.encode({"sub": "user-1"}, "synthetic-hmac-key-for-qa-only-0001", algorithm="HS256", headers={"kid": "key-1"}),
                  jwt.encode({"sub": "user-1"}, key="", algorithm="none", headers={"kid": "key-1"})):
        with pytest.raises(OidcTokenRejected) as error:
            verifier.verify(token, expected_nonce=NONCE)
        assert "secret" not in str(error.value)


@pytest.mark.parametrize("mutation", [lambda key: {"keys": [key, key]},
                                     lambda key: {"keys": [{**key, "kty": "EC"}]},
                                     lambda key: {"keys": [{**key, "d": "secret"}]},
                                     lambda key: {"keys": [{**key, "use": "enc"}]},
                                     lambda key: {"keys": []}])
def test_invalid_trust_jwks_rejected(signed, mutation):
    _, _, public, _ = signed
    with pytest.raises(OidcTokenRejected) as error:
        OidcIdTokenVerifier(json.dumps(mutation(public)), issuer=ISSUER,
                            client_id=CLIENT, step_up_acr="urn:anvil:step-up")
    assert "secret" not in str(error.value)


def _encryption_public():
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(other.public_key()))
    return {**public, "kid": "enc-1", "use": "enc", "alg": "RSA-OAEP"}


def test_mixed_use_jwks_accepts_only_rs256_signing_key(signed):
    _, make, signing, _ = signed
    encryption = _encryption_public()
    verifier = OidcIdTokenVerifier(
        json.dumps({"keys": [signing, encryption]}), issuer=ISSUER,
        client_id=CLIENT, step_up_acr="urn:anvil:step-up", clock=lambda: NOW,
    )
    assert verifier.verify(make(), expected_nonce=NONCE).subject == "user-1"
    with pytest.raises(OidcTokenRejected, match="^OIDC_ID_TOKEN_NOT_VERIFIED$"):
        verifier.verify(make(headers={"kid": "enc-1"}), expected_nonce=NONCE)


@pytest.mark.parametrize("mutation", [
    lambda key: [key, {**key}],
    lambda key: [{**key, "d": "private-secret"}],
    lambda key: [{**key, "n": "bad*base64"}],
    lambda key: [{**key, "kty": "EC"}],
])
def test_mixed_use_jwks_rejects_malformed_signing_candidate(signed, mutation):
    _, _, signing, _ = signed
    with pytest.raises(OidcTokenRejected, match="^OIDC_ID_TOKEN_NOT_VERIFIED$") as error:
        OidcIdTokenVerifier(
            json.dumps({"keys": [_encryption_public(), *mutation(signing)]}),
            issuer=ISSUER, client_id=CLIENT, step_up_acr="urn:anvil:step-up",
        )
    assert "private-secret" not in str(error.value)


@pytest.mark.parametrize("keys", [
    lambda enc: [enc],
    lambda enc: [{**enc, "use": "sig", "alg": "RS512"}],
    lambda enc: [enc, {**enc, "use": "sig", "alg": "RS512"}],
])
def test_mixed_use_jwks_requires_rs256_signer(keys):
    with pytest.raises(OidcTokenRejected, match="^OIDC_ID_TOKEN_NOT_VERIFIED$"):
        OidcIdTokenVerifier(
            json.dumps({"keys": keys(_encryption_public())}), issuer=ISSUER,
            client_id=CLIENT, step_up_acr="urn:anvil:step-up",
        )


@pytest.mark.parametrize("age,accepted", [(0, True), (300, True), (301, False),
                                          (-30, True), (-31, False)])
def test_step_up_auth_time_window(signed, age, accepted):
    verifier, make, _, _ = signed
    token = make(changes={"acr": "urn:anvil:step-up", "auth_time": int(NOW.timestamp()) - age})
    if accepted:
        identity = verifier.verify(token, expected_nonce=NONCE, require_step_up=True)
        assert identity.step_up_verified is True
    else:
        with pytest.raises(OidcTokenRejected):
            verifier.verify(token, expected_nonce=NONCE, require_step_up=True)


@pytest.mark.parametrize("changes", [{"acr": "wrong", "auth_time": int(NOW.timestamp())},
                                      {"acr": "urn:anvil:step-up"},
                                      {"auth_time": int(NOW.timestamp())},
                                      {"acr": "urn:anvil:step-up", "auth_time": "9999999999"}])
def test_step_up_needs_acr_and_recent_integer_auth_time(signed, changes):
    verifier, make, _, _ = signed
    with pytest.raises(OidcTokenRejected):
        verifier.verify(make(changes=changes), expected_nonce=NONCE, require_step_up=True)


def test_noncanonical_configuration_and_nonce_rejected(signed):
    verifier, make, public, _ = signed
    for issuer, client, acr in (("http://issuer.example", CLIENT, "acr"),
                                (ISSUER, " client ", "acr"), (ISSUER, CLIENT, " ")):
        with pytest.raises(OidcTokenRejected):
            OidcIdTokenVerifier(json.dumps({"keys": [public]}), issuer=issuer,
                                client_id=client, step_up_acr=acr)
    for nonce in ("", " request-nonce", "other"):
        with pytest.raises(OidcTokenRejected):
            verifier.verify(make(), expected_nonce=nonce)
