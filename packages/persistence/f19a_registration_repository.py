"""F-19A persistent registration and exact actor/project/environment grants."""

from __future__ import annotations

from datetime import datetime, timezone
import re
import unicodedata
from typing import Callable
from uuid import uuid4

import sqlalchemy as sa

from packages.persistence.oidc_principal_directory import roles, user_roles, users


REGISTRATION_METADATA = sa.MetaData()
registered_projects = sa.Table(
    "registered_projects", REGISTRATION_METADATA,
    sa.Column("project_id", sa.String(128), primary_key=True),
    sa.Column("display_name", sa.String(200), nullable=False),
    sa.Column("registered_by_actor_id", sa.String(128), sa.ForeignKey(users.c.actor_id, ondelete="RESTRICT"),
              nullable=False),
    sa.Column("active", sa.Boolean(), nullable=False),
    sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("length(display_name) BETWEEN 1 AND 200", name="ck_f19a_project_display_name"),
)
registered_environments = sa.Table(
    "registered_environments", REGISTRATION_METADATA,
    sa.Column("project_id", sa.String(128), sa.ForeignKey(registered_projects.c.project_id, ondelete="RESTRICT"),
              primary_key=True),
    sa.Column("environment_id", sa.String(128), primary_key=True),
    sa.Column("display_name", sa.String(200), nullable=False),
    sa.Column("registered_by_actor_id", sa.String(128), sa.ForeignKey(users.c.actor_id, ondelete="RESTRICT"),
              nullable=False),
    sa.Column("active", sa.Boolean(), nullable=False),
    sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("length(display_name) BETWEEN 1 AND 200", name="ck_f19a_environment_display_name"),
)
pair_grants = sa.Table(
    "pair_grants", REGISTRATION_METADATA,
    sa.Column("actor_id", sa.String(128), sa.ForeignKey(users.c.actor_id, ondelete="RESTRICT"), primary_key=True),
    sa.Column("project_id", sa.String(128), primary_key=True),
    sa.Column("environment_id", sa.String(128), primary_key=True),
    sa.Column("permission_code", sa.String(128), primary_key=True),
    sa.Column("active", sa.Boolean(), nullable=False),
    sa.Column("granted_by_actor_id", sa.String(128), sa.ForeignKey(users.c.actor_id, ondelete="RESTRICT"),
              nullable=False),
    sa.Column("revoked_by_actor_id", sa.String(128), sa.ForeignKey(users.c.actor_id, ondelete="RESTRICT")),
    sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("revoked_at", sa.DateTime(timezone=True)),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(
        ["project_id", "environment_id"],
        [registered_environments.c.project_id, registered_environments.c.environment_id],
        name="fk_f19a_grant_exact_environment", ondelete="RESTRICT"),
    sa.CheckConstraint(
        "(active = true AND revoked_at IS NULL AND revoked_by_actor_id IS NULL) OR "
        "(active = false AND revoked_at IS NOT NULL AND revoked_by_actor_id IS NOT NULL)",
        name="ck_f19a_grant_status_times"),
    sa.CheckConstraint(
        "permission_code IN ('dashboard:read', 'operations:alerts:read', "
        "'operations:alerts:acknowledge')", name="ck_f19a_grant_permission"),
    sa.Index("ix_f19a_grant_actor_active_pair", "actor_id", "active", "project_id", "environment_id"),
)
registration_audit_events = sa.Table(
    "registration_audit_events", REGISTRATION_METADATA,
    sa.Column("event_id", sa.String(36), primary_key=True),
    sa.Column("event_type", sa.String(64), nullable=False),
    sa.Column("actor_id", sa.String(128), sa.ForeignKey(users.c.actor_id, ondelete="RESTRICT"), nullable=False),
    sa.Column("target_actor_id", sa.String(128)),
    sa.Column("project_id", sa.String(128), nullable=False),
    sa.Column("environment_id", sa.String(128)),
    sa.Column("permission_code", sa.String(128)),
    sa.Column("previous_active", sa.Boolean()),
    sa.Column("next_active", sa.Boolean(), nullable=False),
    sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("correlation_id", sa.String(36), nullable=False),
    sa.Index("ix_f19a_audit_pair_time", "project_id", "environment_id", "occurred_at"),
)

_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
_PAIR_PERMISSIONS = frozenset({"dashboard:read", "operations:alerts:read", "operations:alerts:acknowledge"})


class F19ARegistrationRejected(ValueError):
    """Stable, non-disclosing error code for the API adapter."""


def _identifier(value: object) -> str:
    if type(value) is not str or _ID.fullmatch(value) is None:
        raise F19ARegistrationRejected("REGISTRATION_INVALID_INPUT")
    return value


def _display_name(value: object) -> str:
    if (type(value) is not str or not 1 <= len(value) <= 200 or not value.strip()
            or any(unicodedata.category(character) == "Cc" for character in value)):
        raise F19ARegistrationRejected("REGISTRATION_INVALID_INPUT")
    return value


def _boolean(value: object) -> bool:
    if type(value) is not bool:
        raise F19ARegistrationRejected("REGISTRATION_INVALID_INPUT")
    return value


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:  # SQLite local unit tests do not preserve a timezone suffix.
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _audit(session, *, event_type: str, actor_id: str, project_id: str,
           environment_id: str | None, target_actor_id: str | None, permission: str | None,
           previous_active: bool | None, next_active: bool, occurred_at: datetime) -> None:
    session.execute(registration_audit_events.insert().values(
        event_id=str(uuid4()), event_type=event_type, actor_id=actor_id,
        target_actor_id=target_actor_id, project_id=project_id, environment_id=environment_id,
        permission_code=permission, previous_active=previous_active, next_active=next_active,
        occurred_at=occurred_at, correlation_id=str(uuid4())))


def _has_action(session, actor_id: str, action: str) -> bool:
    permissions = session.execute(sa.select(roles.c.permissions).select_from(
        users.join(user_roles, users.c.actor_id == user_roles.c.actor_id)
             .join(roles, user_roles.c.role_code == roles.c.role_code)
    ).where(users.c.actor_id == actor_id, users.c.active.is_(True), user_roles.c.active.is_(True))).scalar_one_or_none()
    return type(permissions) is list and action in permissions


def _require_action(session, actor_id: str, action: str) -> None:
    if not _has_action(session, actor_id, action):
        raise F19ARegistrationRejected("AUTHORIZATION_SCOPE_MISMATCH")


def _unique_violation(error: sa.exc.IntegrityError) -> bool:
    origin = error.orig
    return (getattr(origin, "sqlstate", None) == "23505"
            or "UNIQUE constraint failed" in str(origin))


class F19ARegistrationRepository:
    """One transaction per mutation and a fresh database read per authorization."""

    def __init__(self, session_factory: Callable):
        if not callable(session_factory):
            raise F19ARegistrationRejected("PAIR_AUTHORIZATION_UNAVAILABLE")
        self._sessions = session_factory

    def _read(self, action):
        try:
            with self._sessions() as session:
                return action(session)
        except F19ARegistrationRejected:
            raise
        except Exception as exc:
            raise F19ARegistrationRejected("PAIR_AUTHORIZATION_UNAVAILABLE") from exc

    def _write(self, action, *, conflict_on_integrity: bool = False):
        try:
            with self._sessions() as session:
                with session.begin():
                    return action(session)
        except F19ARegistrationRejected:
            raise
        except sa.exc.IntegrityError as exc:
            code = ("REGISTRATION_CONFLICT" if conflict_on_integrity and _unique_violation(exc)
                    else "PAIR_AUTHORIZATION_UNAVAILABLE")
            raise F19ARegistrationRejected(code) from exc
        except Exception as exc:
            raise F19ARegistrationRejected("PAIR_AUTHORIZATION_UNAVAILABLE") from exc

    def register_project(self, actor_id: str, project_id: str, display_name: str) -> dict:
        actor_id, project_id, display_name = _identifier(actor_id), _identifier(project_id), _display_name(display_name)

        def write(session):
            _require_action(session, actor_id, "projects:register")
            if session.execute(sa.select(registered_projects.c.project_id).where(
                    registered_projects.c.project_id == project_id)).first():
                raise F19ARegistrationRejected("REGISTRATION_CONFLICT")
            at = datetime.now(timezone.utc)
            session.execute(registered_projects.insert().values(
                project_id=project_id, display_name=display_name, registered_by_actor_id=actor_id,
                active=True, registered_at=at, updated_at=at))
            _audit(session, event_type="PROJECT_REGISTERED", actor_id=actor_id,
                   project_id=project_id, environment_id=None, target_actor_id=None,
                   permission=None, previous_active=None, next_active=True, occurred_at=at)
            return {"projectId": project_id, "displayName": display_name, "active": True,
                    "registeredBy": actor_id, "registeredAt": at}

        return self._write(write, conflict_on_integrity=True)

    def register_environment(self, actor_id: str, project_id: str,
                             environment_id: str, display_name: str) -> dict:
        actor_id, project_id = _identifier(actor_id), _identifier(project_id)
        environment_id, display_name = _identifier(environment_id), _display_name(display_name)

        def write(session):
            can_manage = _has_action(session, actor_id, "pair-grants:manage")
            can_register = _has_action(session, actor_id, "projects:register")
            if not (can_manage or can_register):
                raise F19ARegistrationRejected("AUTHORIZATION_SCOPE_MISMATCH")
            project = session.execute(sa.select(registered_projects).where(
                registered_projects.c.project_id == project_id).with_for_update()).mappings().first()
            if project is None or not project["active"]:
                raise F19ARegistrationRejected("REGISTRATION_NOT_FOUND")
            if not can_manage and not (can_register and project["registered_by_actor_id"] == actor_id):
                raise F19ARegistrationRejected("REGISTRATION_NOT_FOUND")
            if session.execute(sa.select(registered_environments.c.environment_id).where(
                    registered_environments.c.project_id == project_id,
                    registered_environments.c.environment_id == environment_id)).first():
                raise F19ARegistrationRejected("REGISTRATION_CONFLICT")
            at = datetime.now(timezone.utc)
            session.execute(registered_environments.insert().values(
                project_id=project_id, environment_id=environment_id, display_name=display_name,
                registered_by_actor_id=actor_id, active=True, registered_at=at, updated_at=at))
            _audit(session, event_type="ENVIRONMENT_REGISTERED", actor_id=actor_id,
                   project_id=project_id, environment_id=environment_id, target_actor_id=None,
                   permission=None, previous_active=None, next_active=True, occurred_at=at)
            return {"projectId": project_id, "environmentId": environment_id,
                    "displayName": display_name, "active": True, "registeredBy": actor_id, "registeredAt": at}

        return self._write(write, conflict_on_integrity=True)

    def set_registration_active(self, actor_id: str, project_id: str,
                                environment_id_or_none: str | None, active: bool) -> dict:
        actor_id, project_id, active = _identifier(actor_id), _identifier(project_id), _boolean(active)
        environment_id = (_identifier(environment_id_or_none) if environment_id_or_none is not None else None)

        def write(session):
            can_manage = _has_action(session, actor_id, "pair-grants:manage")
            can_register = _has_action(session, actor_id, "projects:register")
            if not (can_manage or can_register):
                raise F19ARegistrationRejected("AUTHORIZATION_SCOPE_MISMATCH")
            table = registered_projects if environment_id is None else registered_environments
            predicates = [table.c.project_id == project_id]
            if environment_id is not None:
                predicates.append(table.c.environment_id == environment_id)
            row = session.execute(sa.select(table).where(*predicates).with_for_update()).mappings().first()
            if row is None:
                raise F19ARegistrationRejected("REGISTRATION_NOT_FOUND")
            project_owner = (row["registered_by_actor_id"] if environment_id is None else
                             session.execute(sa.select(registered_projects.c.registered_by_actor_id).where(
                                 registered_projects.c.project_id == project_id)).scalar_one())
            if not can_manage and not (can_register and project_owner == actor_id):
                raise F19ARegistrationRejected("REGISTRATION_NOT_FOUND")
            at = datetime.now(timezone.utc)
            if row["active"] != active:
                session.execute(table.update().where(*predicates).values(active=active, updated_at=at))
                _audit(session, event_type=("PROJECT_ACTIVE_CHANGED" if environment_id is None
                                            else "ENVIRONMENT_ACTIVE_CHANGED"),
                       actor_id=actor_id, project_id=project_id, environment_id=environment_id,
                       target_actor_id=None, permission=None, previous_active=row["active"],
                       next_active=active, occurred_at=at)
            else:
                at = _utc(row["updated_at"])
            return {"projectId": project_id, **({"environmentId": environment_id} if environment_id else {}),
                    "active": active, "updatedAt": at}

        return self._write(write)

    def set_pair_grant(self, admin_actor_id: str, target_actor_id: str,
                       project_id: str, environment_id: str, permission: str, active: bool) -> dict:
        admin_actor_id, target_actor_id = _identifier(admin_actor_id), _identifier(target_actor_id)
        project_id, environment_id, active = _identifier(project_id), _identifier(environment_id), _boolean(active)
        if type(permission) is not str or permission not in _PAIR_PERMISSIONS:
            raise F19ARegistrationRejected("REGISTRATION_INVALID_INPUT")
        if admin_actor_id == target_actor_id:
            raise F19ARegistrationRejected("AUTHORIZATION_SCOPE_MISMATCH")

        def write(session):
            _require_action(session, admin_actor_id, "pair-grants:manage")
            target = session.execute(sa.select(users.c.active).where(
                users.c.actor_id == target_actor_id)).first()
            if target is None or (active and not target[0]):
                raise F19ARegistrationRejected("REGISTRATION_NOT_FOUND")
            if active:
                _require_action(session, target_actor_id, permission)
            project = session.execute(sa.select(registered_projects.c.active).where(
                registered_projects.c.project_id == project_id).with_for_update()).first()
            environment = session.execute(sa.select(registered_environments.c.active).where(
                registered_environments.c.project_id == project_id,
                registered_environments.c.environment_id == environment_id).with_for_update()).first()
            if (project is None or environment is None
                    or (active and (not project[0] or not environment[0]))):
                raise F19ARegistrationRejected("REGISTRATION_NOT_FOUND")
            predicates = (pair_grants.c.actor_id == target_actor_id,
                          pair_grants.c.project_id == project_id,
                          pair_grants.c.environment_id == environment_id,
                          pair_grants.c.permission_code == permission)
            row = session.execute(sa.select(pair_grants).where(*predicates).with_for_update()).mappings().first()
            if row is None and not active:
                raise F19ARegistrationRejected("REGISTRATION_NOT_FOUND")
            at = datetime.now(timezone.utc)
            if row is None:
                session.execute(pair_grants.insert().values(
                    actor_id=target_actor_id, project_id=project_id, environment_id=environment_id,
                    permission_code=permission, active=True, granted_by_actor_id=admin_actor_id,
                    revoked_by_actor_id=None, granted_at=at, revoked_at=None, updated_at=at))
            elif row["active"] != active:
                session.execute(pair_grants.update().where(*predicates).values(
                    active=active, granted_by_actor_id=(admin_actor_id if active else row["granted_by_actor_id"]),
                    revoked_by_actor_id=(None if active else admin_actor_id),
                    granted_at=(at if active else row["granted_at"]),
                    revoked_at=(None if active else at), updated_at=at))
            else:
                at = _utc(row["updated_at"])
            if row is None or row["active"] != active:
                _audit(session, event_type=("PAIR_GRANT_ACTIVATED" if active else "PAIR_GRANT_REVOKED"),
                       actor_id=admin_actor_id, project_id=project_id, environment_id=environment_id,
                       target_actor_id=target_actor_id, permission=permission,
                       previous_active=(row["active"] if row else None), next_active=active, occurred_at=at)
            return {"actorId": target_actor_id, "projectId": project_id,
                    "environmentId": environment_id, "permission": permission,
                    "active": active, "updatedAt": at}

        return self._write(write)

    def list_dashboard_pairs(self, actor_id: str) -> tuple[dict, ...]:
        actor_id = _identifier(actor_id)

        def read(session):
            _require_action(session, actor_id, "dashboard:read")
            query = sa.select(registered_projects.c.project_id,
                              registered_environments.c.environment_id,
                              registered_projects.c.display_name.label("project_name"),
                              registered_environments.c.display_name.label("environment_name")).select_from(
                pair_grants.join(registered_environments,
                    sa.and_(pair_grants.c.project_id == registered_environments.c.project_id,
                            pair_grants.c.environment_id == registered_environments.c.environment_id))
                .join(registered_projects,
                      registered_environments.c.project_id == registered_projects.c.project_id)
            ).where(pair_grants.c.actor_id == actor_id,
                    pair_grants.c.permission_code == "dashboard:read", pair_grants.c.active.is_(True),
                    registered_projects.c.active.is_(True), registered_environments.c.active.is_(True)
            ).order_by(registered_projects.c.project_id, registered_environments.c.environment_id)
            return tuple({"projectId": row.project_id, "environmentId": row.environment_id,
                          "projectName": row.project_name, "environmentName": row.environment_name}
                         for row in session.execute(query))

        return self._read(read)

    def require_pair_grant(self, actor_id: str, project_id: str,
                           environment_id: str, permission: str) -> bool:
        actor_id, project_id, environment_id = _identifier(actor_id), _identifier(project_id), _identifier(environment_id)
        if type(permission) is not str or permission not in _PAIR_PERMISSIONS:
            raise F19ARegistrationRejected("REGISTRATION_INVALID_INPUT")

        def read(session):
            _require_action(session, actor_id, permission)
            query = sa.select(pair_grants.c.actor_id).select_from(
                pair_grants.join(registered_environments,
                    sa.and_(pair_grants.c.project_id == registered_environments.c.project_id,
                            pair_grants.c.environment_id == registered_environments.c.environment_id))
                .join(registered_projects,
                      registered_environments.c.project_id == registered_projects.c.project_id)
            ).where(pair_grants.c.actor_id == actor_id,
                    pair_grants.c.project_id == project_id,
                    pair_grants.c.environment_id == environment_id,
                    pair_grants.c.permission_code == permission, pair_grants.c.active.is_(True),
                    registered_projects.c.active.is_(True), registered_environments.c.active.is_(True))
            if session.execute(query).first() is None:
                raise F19ARegistrationRejected("AUTHORIZATION_SCOPE_MISMATCH")
            return True

        return self._read(read)


__all__ = ["F19ARegistrationRepository", "F19ARegistrationRejected", "REGISTRATION_METADATA",
           "registered_projects", "registered_environments", "pair_grants", "registration_audit_events"]
