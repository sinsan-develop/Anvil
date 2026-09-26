"""Bind a previously verified OIDC identity to server-owned authorization.

This pure adapter does not verify tokens, persist mappings or issue sessions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .common import SessionPrincipal
from .oidc_identity import OidcIdentity


class OidcPrincipalRejected(ValueError):
    """Stable rejection without identity or credential details."""


def _reject() -> OidcPrincipalRejected:
    return OidcPrincipalRejected("OIDC_PRINCIPAL_NOT_AUTHORIZED")


def _canonical(value: object) -> bool:
    return isinstance(value, str) and bool(value) and value == value.strip() and "*" not in value


def _valid_set(value: object) -> bool:
    return isinstance(value, frozenset) and bool(value) and all(_canonical(item) for item in value)


@dataclass(frozen=True)
class OidcPrincipalBinding:
    issuer: str
    subject: str
    actor_id: str
    actor_role: str
    permissions: frozenset[str]
    project_ids: frozenset[str]
    environment_ids: frozenset[str]
    step_up_required: bool


@dataclass(frozen=True)
class OidcPrincipalPolicy:
    issuer: str
    allowed_roles: frozenset[str]
    allowed_permissions: frozenset[str]
    allowed_project_ids: frozenset[str]
    allowed_environment_ids: frozenset[str]


class OidcPrincipalResolver(Protocol):
    """Trusted server-side lookup, bound to issuer and subject by its owner."""

    def resolve(self, issuer: str, subject: str) -> OidcPrincipalBinding | None: ...


def bind_oidc_principal(
    identity: OidcIdentity, *, resolver: OidcPrincipalResolver,
    policy: OidcPrincipalPolicy, csrf_token: str,
) -> SessionPrincipal:
    """Return only server-bound authority within explicit environment policy."""
    try:
        if (not isinstance(identity, OidcIdentity) or not isinstance(policy, OidcPrincipalPolicy)
                or not _canonical(identity.issuer) or not _canonical(identity.subject)
                or type(identity.step_up_verified) is not bool or not _canonical(csrf_token)
                or not _canonical(policy.issuer) or identity.issuer != policy.issuer
                or not all(_valid_set(value) for value in (
                    policy.allowed_roles, policy.allowed_permissions,
                    policy.allowed_project_ids, policy.allowed_environment_ids,
                ))):
            raise _reject()
        binding = resolver.resolve(identity.issuer, identity.subject)
        if (not isinstance(binding, OidcPrincipalBinding)
                or not all(_canonical(value) for value in (
                    binding.issuer, binding.subject, binding.actor_id, binding.actor_role,
                ))
                or binding.issuer != identity.issuer or binding.subject != identity.subject
                or not all(_valid_set(value) for value in (
                    binding.permissions, binding.project_ids, binding.environment_ids,
                ))
                or type(binding.step_up_required) is not bool
                or binding.actor_role not in policy.allowed_roles
                or not binding.permissions <= policy.allowed_permissions
                or not binding.project_ids <= policy.allowed_project_ids
                or not binding.environment_ids <= policy.allowed_environment_ids
                or (binding.step_up_required and not identity.step_up_verified)):
            raise _reject()
        return SessionPrincipal(
            actor_id=binding.actor_id, actor_role=binding.actor_role,
            csrf_token=csrf_token, permissions=binding.permissions,
            project_ids=binding.project_ids, environment_ids=binding.environment_ids,
        )
    except Exception:
        raise _reject() from None
