"""Real loopback TLS OIDC host flow, with isolated synthetic trust material."""

import pytest

from tests.integration.f18_oidc_live_host import run_live_oidc_host_flow


def test_live_oidc_host_success():
    evidence = run_live_oidc_host_flow()
    assert evidence.issuer_url.startswith("https://127.0.0.1:")
    assert evidence.api_url.startswith("https://127.0.0.1:")
    assert evidence.issuer_url != evidence.api_url
    assert evidence.authorization_status == 200
    assert evidence.callback_status == 200
    assert evidence.session_status == 200
    assert evidence.replay_status == 401
    assert evidence.secret_calls == 1
    assert evidence.issuer_token_requests == 1
    assert evidence.cleanup_verified


@pytest.mark.parametrize("reject", [
    "bad_secret", "wrong_nonce", "wrong_audience", "wrong_issuer",
    "reused_state", "invalid_tls",
])
def test_live_oidc_host_rejection(reject):
    evidence = run_live_oidc_host_flow(reject=reject)
    assert evidence.authorization_status == 200
    assert evidence.callback_status == 401
    assert evidence.session_status == 200
    assert evidence.cleanup_verified
    assert evidence.secret_calls == 1
    assert evidence.issuer_token_requests == (0 if reject == "invalid_tls" else 1)
