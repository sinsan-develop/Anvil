"""Read-only server-owned OIDC issuer/subject to principal resolution."""

from __future__ import annotations

import re
from typing import Callable

import sqlalchemy as sa

from packages.api.oidc_principal import OidcPrincipalBinding


DIRECTORY_METADATA = sa.MetaData()
users = sa.Table(
    "users", DIRECTORY_METADATA,
    sa.Column("actor_id", sa.String(128), primary_key=True),
    sa.Column("active", sa.Boolean(), nullable=False),
)
roles = sa.Table(
    "roles", DIRECTORY_METADATA,
    sa.Column("role_code", sa.String(128), primary_key=True),
    sa.Column("permissions", sa.JSON(), nullable=False),
)
user_roles = sa.Table(
    "user_roles", DIRECTORY_METADATA,
    sa.Column("actor_id", sa.String(128), sa.ForeignKey("users.actor_id", ondelete="RESTRICT"),
              primary_key=True),
    sa.Column("role_code", sa.String(128), sa.ForeignKey("roles.role_code", ondelete="RESTRICT"),
              nullable=False),
    sa.Column("project_id", sa.String(128), nullable=False),
    sa.Column("environment_id", sa.String(128), nullable=False),
    sa.Column("step_up_required", sa.Boolean(), nullable=False),
    sa.Column("active", sa.Boolean(), nullable=False),
    sa.CheckConstraint("step_up_required IN (false, true)", name="ck_user_roles_step_up_boolean"),
)
oidc_subject_bindings = sa.Table(
    "oidc_subject_bindings", DIRECTORY_METADATA,
    sa.Column("issuer", sa.String(2048), primary_key=True),
    sa.Column("subject", sa.String(512), primary_key=True),
    sa.Column("actor_id", sa.String(128), sa.ForeignKey("users.actor_id", ondelete="RESTRICT"),
              nullable=False),
    sa.Column("active", sa.Boolean(), nullable=False),
)

_SCOPE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")


class OidcDirectoryRejected(ValueError):
    """Stable error without identity, SQL, or credential details."""


def _identity(value: object, limit: int) -> bool:
    return (type(value) is str and 0 < len(value) <= limit and value == value.strip()
            and "*" not in value and all(ord(character) >= 32 for character in value))


def _scope(value: object) -> bool:
    return type(value) is str and _SCOPE.fullmatch(value) is not None


def _permissions(value: object) -> frozenset[str]:
    if (type(value) is not list or not value or len(value) > 256
            or not all(_scope(item) for item in value)
            or len(set(value)) != len(value)):
        raise OidcDirectoryRejected("OIDC_DIRECTORY_NOT_AUTHORIZED")
    return frozenset(value)


class SqlAlchemyOidcPrincipalResolver:
    """One SELECT JOIN per lookup; session lifecycle remains caller-owned."""

    def __init__(self, session_factory: Callable):
        if not callable(session_factory):
            raise OidcDirectoryRejected("OIDC_DIRECTORY_NOT_AUTHORIZED")
        self._session_factory = session_factory

    def resolve(self, issuer: str, subject: str) -> OidcPrincipalBinding | None:
        if not _identity(issuer, 2048) or not _identity(subject, 512):
            raise OidcDirectoryRejected("OIDC_DIRECTORY_NOT_AUTHORIZED")
        failure = None
        try:
            query = sa.select(
                oidc_subject_bindings.c.issuer,
                oidc_subject_bindings.c.subject,
                users.c.actor_id,
                roles.c.role_code,
                roles.c.permissions,
                user_roles.c.project_id,
                user_roles.c.environment_id,
                user_roles.c.step_up_required,
            ).select_from(
                oidc_subject_bindings.join(users).join(user_roles).join(roles)
            ).where(
                oidc_subject_bindings.c.issuer == issuer,
                oidc_subject_bindings.c.subject == subject,
                oidc_subject_bindings.c.active.is_(True),
                users.c.active.is_(True),
                user_roles.c.active.is_(True),
            ).limit(2)
            with self._session_factory() as session:
                rows = session.execute(query).all()
            if not rows:
                return None
            if len(rows) != 1:
                raise OidcDirectoryRejected("OIDC_DIRECTORY_NOT_AUTHORIZED")
            row = rows[0]
            if (row.issuer != issuer or row.subject != subject
                    or not all(_scope(value) for value in (
                        row.actor_id, row.role_code, row.project_id, row.environment_id,
                    )) or type(row.step_up_required) is not bool):
                raise OidcDirectoryRejected("OIDC_DIRECTORY_NOT_AUTHORIZED")
            return OidcPrincipalBinding(
                issuer, subject, row.actor_id, row.role_code,
                _permissions(row.permissions), frozenset({row.project_id}),
                frozenset({row.environment_id}), row.step_up_required,
            )
        except OidcDirectoryRejected:
            raise
        except Exception:
            failure = "OIDC_DIRECTORY_NOT_AVAILABLE"
        if failure is not None:
            raise OidcDirectoryRejected(failure)
        return None


__all__ = [
    "DIRECTORY_METADATA", "OidcDirectoryRejected", "SqlAlchemyOidcPrincipalResolver",
    "users", "roles", "user_roles", "oidc_subject_bindings",
]
