"""Binding assumes OidcCodeFlow.complete already verified the identity.

This adapter never verifies a token or grants authority from token claims.
"""

from dataclasses import replace

import pytest

from packages.api.common import SessionPrincipal
from packages.api.oidc_identity import OidcIdentity
from packages.api.oidc_principal import (
    OidcPrincipalBinding,
    OidcPrincipalPolicy,
    OidcPrincipalRejected,
    bind_oidc_principal,
)


ISSUER = "https://issuer.example.test"


class Resolver:
    def __init__(self, binding):
        self.binding = binding

    def resolve(self, issuer, subject):
        if (issuer, subject) != (ISSUER, "sub-1"):
            return None
        return self.binding


def inputs():
    identity = OidcIdentity("sub-1", ISSUER, 123, "mfa", True)
    binding = OidcPrincipalBinding(
        ISSUER, "sub-1", "actor-1", "operator",
        frozenset({"tasks:read"}), frozenset({"project-1"}),
        frozenset({"wsl-qa"}), True,
    )
    policy = OidcPrincipalPolicy(
        ISSUER, frozenset({"operator"}), frozenset({"tasks:read", "tasks:write"}),
        frozenset({"project-1", "project-2"}), frozenset({"wsl-qa"}),
    )
    return identity, binding, policy


def bind(identity=None, binding=None, policy=None, resolver=None, csrf_token="csrf-1"):
    good_identity, good_binding, good_policy = inputs()
    return bind_oidc_principal(
        good_identity if identity is None else identity,
        resolver=Resolver(good_binding if binding is None else binding) if resolver is None else resolver,
        policy=good_policy if policy is None else policy,
        csrf_token=csrf_token,
    )


def assert_rejected(**kwargs):
    with pytest.raises(OidcPrincipalRejected) as error:
        bind(**kwargs)
    assert str(error.value) == "OIDC_PRINCIPAL_NOT_AUTHORIZED"


def test_server_binding_within_policy_creates_exact_session_principal():
    assert bind() == SessionPrincipal(
        actor_id="actor-1", actor_role="operator", csrf_token="csrf-1",
        permissions=frozenset({"tasks:read"}),
        project_ids=frozenset({"project-1"}),
        environment_ids=frozenset({"wsl-qa"}),
    )


@pytest.mark.parametrize("returned", [None, object(), {"actor_role": "operator"}])
def test_unregistered_or_malformed_resolver_result_is_redacted(returned):
    assert_rejected(resolver=Resolver(returned))


def test_resolver_exception_is_redacted():
    class BrokenResolver:
        def resolve(self, issuer, subject):
            raise RuntimeError("sensitive resolver detail")

    assert_rejected(resolver=BrokenResolver())


@pytest.mark.parametrize("field,value", [
    ("issuer", "https://other.example.test"), ("subject", "sub-2"),
    ("issuer", "*"), ("subject", " sub-1"),
])
def test_identity_mismatch_or_noncanonical_value_is_rejected(field, value):
    identity, _, _ = inputs()
    assert_rejected(identity=replace(identity, **{field: value}))


@pytest.mark.parametrize("field,value", [
    ("issuer", "https://other.example.test"), ("subject", "sub-2"),
    ("actor_id", " "), ("actor_role", "*"),
])
def test_binding_mismatch_or_noncanonical_value_is_rejected(field, value):
    _, binding, _ = inputs()
    assert_rejected(binding=replace(binding, **{field: value}))


@pytest.mark.parametrize("field,value", [
    ("issuer", "https://other.example.test"), ("allowed_roles", frozenset({"*"})),
    ("allowed_permissions", frozenset()),
])
def test_policy_mismatch_or_invalid_allowlist_is_rejected(field, value):
    _, _, policy = inputs()
    assert_rejected(policy=replace(policy, **{field: value}))


@pytest.mark.parametrize("field,value", [
    ("actor_role", "admin"), ("permissions", frozenset({"tasks:delete"})),
    ("project_ids", frozenset({"project-3"})),
    ("environment_ids", frozenset({"production"})),
    ("permissions", frozenset()), ("project_ids", frozenset()),
    ("environment_ids", frozenset()),
    ("permissions", frozenset({"*"})),
    ("project_ids", {"project-1"}),
])
def test_binding_outside_policy_or_invalid_set_is_rejected(field, value):
    _, binding, _ = inputs()
    assert_rejected(binding=replace(binding, **{field: value}))


def test_step_up_requirement_rejects_ordinary_verified_identity():
    identity, _, _ = inputs()
    assert_rejected(identity=replace(identity, step_up_verified=False))


@pytest.mark.parametrize("value", ["", "*", " csrf", 123])
def test_invalid_csrf_token_is_redacted(value):
    assert_rejected(csrf_token=value)


def test_invalid_step_up_flag_is_rejected():
    _, binding, _ = inputs()
    assert_rejected(binding=replace(binding, step_up_required=1))
