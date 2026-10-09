"""Opt-in exact-SHA U-01 two-pair browser and isolated PostgreSQL 15 QA."""

import json
import os
import re
import subprocess
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

import packages.api  # noqa: F401  # Initialize API exports before persistence's cross-package import.
from apps.api.anvil_api.oidc_process import load_oidc_process_inputs
from packages.persistence.f19a_registration_repository import (
    F19ARegistrationRepository, pair_grants, registered_environments,
    registered_projects, registration_audit_events,
)
from packages.persistence.oidc_principal_directory import (
    DIRECTORY_METADATA, SqlAlchemyOidcPrincipalResolver, oidc_subject_bindings,
    roles, user_roles, users,
)
from packages.persistence.operations_repository import PostgresOperationsRepository


ROOT = Path(__file__).resolve().parents[2]


def _assert_exact_checkout(expected_sha: str, observed: dict) -> None:
    if (re.fullmatch(r"[0-9a-f]{40}", expected_sha) is None
            or observed != {"head": expected_sha, "branch": "codex/u01-dashboard-r2",
                            "private": expected_sha, "remote": expected_sha, "dirty": False}):
        raise AssertionError("U01_QA_EXACT_SOURCE_REJECTED")


def _validated_target(dsn: str, isolated: str, expected_db: str, expected_port: int = 5546):
    try:
        url = make_url(dsn)
        accepted = (isolated == "1"
                    and re.fullmatch(r"anvil_u01_qa_[0-9a-f]{1,12}", expected_db) is not None
                    and url.drivername in {"postgresql", "postgresql+psycopg"}
                    and url.host in {"127.0.0.1", "localhost"}
                    and url.port == expected_port
                    and url.database == expected_db and url.username == expected_db
                    and not url.query)
    except Exception:
        accepted = False
    if not accepted:
        raise AssertionError("U01_QA_PG_TARGET_REJECTED")
    return url.set(drivername="postgresql+psycopg")


def _operations_dsn(url) -> str:
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


def _assert_empty_pair_ledger(head: str, projects: int, environments: int,
                              grants: int, audits: int) -> None:
    if head != "0020_f19a_pair_grants":
        raise AssertionError("U01_QA_PG_HEAD_REJECTED")
    if any(value != 0 for value in (projects, environments, grants, audits)):
        raise AssertionError("U01_QA_PG_NOT_EMPTY")


def _validated_pairs(pair_a: tuple[str, str], pair_b: tuple[str, str]):
    identifier = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
    if (any(type(pair) is not tuple or len(pair) != 2 for pair in (pair_a, pair_b))
            or any(type(value) is not str or identifier.fullmatch(value) is None
                   for pair in (pair_a, pair_b) for value in pair)
            or pair_a[0] == pair_b[0] or pair_a[1] == pair_b[1]):
        raise AssertionError("U01_QA_PAIR_PLAN_REJECTED")
    return pair_a, pair_b


def _assert_phase_pairs(phase: str, observed: tuple, pair_a="A", pair_b="B") -> None:
    expected = {"granted": (pair_a, pair_b), "revoked": (pair_b,),
                "restored": (pair_a, pair_b), "other": ()}
    if phase not in expected or tuple(observed) != expected[phase]:
        raise AssertionError("U01_QA_PAIR_INVENTORY_MISMATCH")


def _validated_browser_command(raw: str, source_sha: str) -> tuple[str, ...]:
    """Permit only a pre-created, source-bound Docker browser container."""
    expected = ["docker", "exec", f"anvil-u01-qa-browser-{source_sha[:12]}", "node",
                "/workspace/tests/browser/u01-scoped-dashboard-two-pair.mjs"]
    try:
        if (re.fullmatch(r"[0-9a-f]{40}", source_sha) is None
                or json.loads(raw) != expected):
            raise ValueError("browser command")
    except (TypeError, ValueError):
        raise AssertionError("U01_QA_BROWSER_COMMAND_REJECTED") from None
    return tuple(expected)


def _validated_run_config(environment: dict) -> dict:
    prefix = "ANVIL_U01_QA_"
    required = ("SOURCE_SHA", "PG_ISOLATED", "DATABASE", "PG_DSN", "PHASE", "ADMIN_ACTOR",
                "READER_ACTOR", "OTHER_ACTOR", "ISSUER_URL", "APP_URL", "READER_SUBJECT",
                "OTHER_SUBJECT", "ADMIN_SUBJECT", "ADMIN_ROLE", "EXPECTED_ROLE", "OTHER_ROLE",
                "PAIR_A_JSON", "PAIR_B_JSON", "EVIDENCE_DIR", "BROWSER_COMMAND_JSON")
    try:
        values = {key.lower(): environment[prefix + key] for key in required}
        if any(type(value) is not str or not value for value in values.values()):
            raise ValueError("missing")
        if re.fullmatch(r"[0-9a-f]{40}", values["source_sha"]) is None:
            raise ValueError("sha")
        if values["phase"] not in {"granted", "revoked", "restored", "other"}:
            raise ValueError("phase")
        actors = (values["admin_actor"], values["reader_actor"], values["other_actor"])
        if len(set(actors)) != 3 or len({values["admin_subject"], values["reader_subject"],
                                       values["other_subject"]}) != 3:
            raise ValueError("actors")
        identifier = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
        if any(identifier.fullmatch(value) is None for value in actors + (
                values["admin_subject"], values["reader_subject"], values["other_subject"],
                values["admin_role"], values["expected_role"], values["other_role"])):
            raise ValueError("ids")
        suffix = values["source_sha"][:12]
        if (values["admin_actor"] != f"f19a_qa_admin_{suffix}"
                or values["admin_role"] != f"f19a_qa_bootstrap_{suffix}"
                or values["reader_actor"] != "f19a-qa-reader"
                or values["expected_role"] != "f19a-qa-reader-only"
                or values["other_actor"] != f"f19a_qa_other_{suffix}"
                or values["other_role"] != f"f19a_qa_other_{suffix}"):
            raise ValueError("qa roles")
        pairs = (json.loads(values["pair_a_json"]), json.loads(values["pair_b_json"]))
        if any(type(pair) is not dict or set(pair) != {
                "projectId", "environmentId", "projectName", "environmentName"}
               or any(type(value) is not str or not value or len(value) > 200
                      or any(ord(character) < 32 for character in value)
                      for value in pair.values())
               for pair in pairs):
            raise ValueError("pairs")
        _validated_pairs(*((pair["projectId"], pair["environmentId"]) for pair in pairs))
        if pairs[0]["projectId"] >= pairs[1]["projectId"]:
            raise ValueError("ordering")
        values["browser_command"] = _validated_browser_command(
            values["browser_command_json"], values["source_sha"])
        app, issuer = urlsplit(values["app_url"]), urlsplit(values["issuer_url"])
        if (app.scheme != "https" or issuer.scheme != "https"
                or app.hostname != "anvil-f18-qa.local" or issuer.hostname != app.hostname
                or app.port != issuer.port
                or app.path != "/" or issuer.path != "/realms/anvil"
                or app.username or issuer.username or app.query or issuer.query or app.fragment or issuer.fragment):
            raise ValueError("urls")
        values["pair_a"], values["pair_b"] = pairs
        return values
    except (KeyError, TypeError, ValueError, AssertionError):
        raise AssertionError("U01_QA_CONFIG_REJECTED") from None


def _qa_detected_event(project_id: str, environment_id: str,
                       alert_id: str, at: str) -> dict:
    code = "QUEUE_JOB_QUARANTINED"
    entity = f"qa-{alert_id}"
    evidence_hash = "sha256:" + "a" * 64
    return {"action": "DETECTED", "alert_id": alert_id, "actor_id": "qa-detector",
            "at": at, "approval_id": None, "evidence_hash": evidence_hash,
            "alert": {"alert_id": alert_id, "level": "critical", "source": "orchestrator",
                "category": "backlog", "code": code, "related_entity_id": entity,
                "dedupe_key": f"f13-r2:{project_id}:{environment_id}:{code}:{entity}",
                "detector_rule_revision": "f13-r2", "cause": "Queue job reached quarantine",
                "impact": "Run cannot advance automatically", "next_action": "REVIEW_QUARANTINE",
                "deep_link": "/operations/queue", "evidence_hash": evidence_hash,
                "status": "open", "owner_id": None, "observed_at": at,
                "project_id": project_id, "environment_id": environment_id}}


def _git_output(*arguments: str) -> str:
    result = subprocess.run(["git", *arguments], cwd=ROOT, capture_output=True,
                            text=True, timeout=15, check=False)
    if result.returncode:
        raise AssertionError("U01_QA_EXACT_SOURCE_REJECTED")
    return result.stdout.strip()


def _observed_checkout() -> dict:
    try:
        remote = _git_output("ls-remote", "development", "refs/heads/codex/u01-dashboard-r2")
        remote_sha = remote.split()[0] if len(remote.split()) == 2 else ""
        return {"head": _git_output("rev-parse", "HEAD"),
                "branch": _git_output("branch", "--show-current"),
                "private": _git_output("rev-parse", "development/codex/u01-dashboard-r2"),
                "remote": remote_sha,
                "dirty": bool(_git_output("status", "--porcelain=v1", "-uall"))}
    except (OSError, subprocess.TimeoutExpired):
        raise AssertionError("U01_QA_EXACT_SOURCE_REJECTED") from None


def _count(connection, table) -> int:
    return connection.execute(sa.select(sa.func.count()).select_from(table)).scalar_one()


def _pair_rows(repo, actor_id: str) -> tuple[tuple[str, str], ...]:
    return tuple((row["projectId"], row["environmentId"])
                 for row in repo.list_dashboard_pairs(actor_id))


def _preflight_database(engine, config: dict) -> None:
    with engine.connect() as connection:
        server = int(connection.exec_driver_sql("SHOW server_version_num").scalar_one())
        if not 150000 <= server < 160000:
            raise AssertionError("U01_QA_PG_VERSION_REJECTED")
        head = connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
        if head != "0020_f19a_pair_grants":
            raise AssertionError("U01_QA_PG_HEAD_REJECTED")
        if config["phase"] == "granted":
            _assert_empty_pair_ledger(head, _count(connection, registered_projects),
                                      _count(connection, registered_environments),
                                      _count(connection, pair_grants),
                                      _count(connection, registration_audit_events))
            if (connection.exec_driver_sql("SELECT count(*) FROM operations_audit_events").scalar_one()
                    or connection.exec_driver_sql("SELECT count(*) FROM operations_audit_heads").scalar_one()):
                raise AssertionError("U01_QA_PG_NOT_EMPTY")


def _assert_qa_trust(config: dict, inputs, principals: dict) -> None:
    policy = inputs.principal_policy
    scope = inputs.authorization_scope
    roles = scope.allowed_actor_roles
    required = {"synthetic-subject-1", "f19a-qa-reader", "f19a-qa-other"}
    if ({config["admin_subject"], config["reader_subject"], config["other_subject"]} != required
            or policy.issuer != config["issuer_url"]):
        raise AssertionError("U01_QA_TRUST_REJECTED")
    for subject, actor, role, permissions in (
        (config["admin_subject"], config["admin_actor"], config["admin_role"],
         {"projects:register", "pair-grants:manage"}),
        (config["reader_subject"], config["reader_actor"], config["expected_role"],
         {"dashboard:read"}),
        (config["other_subject"], config["other_actor"], config["other_role"],
         {"dashboard:read"}),
    ):
        principal = principals.get(subject)
        if (principal is None or principal.actor_id != actor or principal.actor_role != role
                or not permissions <= principal.permissions or role not in policy.allowed_roles
                or role not in roles or not permissions <= policy.allowed_permissions
                or not principal.permissions <= policy.allowed_permissions
                or principal.issuer != config["issuer_url"] or principal.subject != subject
                or principal.project_ids != frozenset((scope.project_id,))
                or principal.environment_ids != frozenset((scope.environment_id,))
                or principal.step_up_required is not False
                or not principal.project_ids <= policy.allowed_project_ids
                or not principal.environment_ids <= policy.allowed_environment_ids
                or principal.permissions != permissions):
            raise AssertionError("U01_QA_TRUST_REJECTED")


def _preflight_principals(factory, config: dict, inputs) -> None:
    resolver = SqlAlchemyOidcPrincipalResolver(factory)
    try:
        principals = {subject: resolver.resolve(config["issuer_url"], subject)
                      for subject in (config["admin_subject"], config["reader_subject"],
                                      config["other_subject"])}
        _assert_qa_trust(config, inputs, principals)
    except Exception:
        raise AssertionError("U01_QA_TRUST_REJECTED") from None


def _seed_qa_principals(factory, config: dict, inputs) -> None:
    """Create only the three dedicated U-01 QA identities in one transaction."""
    try:
        _validated_target(config["pg_dsn"], config["pg_isolated"], config["database"])
        policy, scope = inputs.principal_policy, inputs.authorization_scope
        suffix = config["source_sha"][:12]
        principals = (
            ("synthetic-subject-1", f"f19a_qa_admin_{suffix}",
             f"f19a_qa_bootstrap_{suffix}", ("projects:register", "pair-grants:manage")),
            ("f19a-qa-reader", "f19a-qa-reader", "f19a-qa-reader-only",
             ("dashboard:read",)),
            ("f19a-qa-other", f"f19a_qa_other_{suffix}",
             f"f19a_qa_other_{suffix}", ("dashboard:read",)),
        )
        if (config["phase"] != "granted" or len(config["source_sha"]) != 40
                or re.fullmatch(r"[0-9a-f]{40}", config["source_sha"]) is None
                or config["issuer_url"] != "https://anvil-f18-qa.local:8444/realms/anvil"
                or policy.issuer != config["issuer_url"]
                or any((config[f"{name}_subject"], config[f"{name}_actor"],
                         config["expected_role" if name == "reader" else f"{name}_role"])
                       != (subject, actor, role)
                       for name, (subject, actor, role, _permissions) in
                       zip(("admin", "reader", "other"), principals, strict=True))
                or any(role not in policy.allowed_roles or role not in scope.allowed_actor_roles
                       or not set(permissions) <= policy.allowed_permissions
                       for _subject, _actor, role, permissions in principals)
                or scope.project_id not in policy.allowed_project_ids
                or scope.environment_id not in policy.allowed_environment_ids):
            raise AssertionError("U01_QA_TRUST_REJECTED")
        with factory() as session:
            with session.begin():
                if any(session.execute(sa.select(sa.func.count()).select_from(table)).scalar_one()
                       for table in (users, roles, user_roles, oidc_subject_bindings)):
                    raise AssertionError("U01_QA_TRUST_REJECTED")
                for subject, actor, role, permissions in principals:
                    session.execute(users.insert().values(actor_id=actor, active=True))
                    session.execute(roles.insert().values(role_code=role,
                                                         permissions=list(permissions)))
                    session.execute(user_roles.insert().values(
                        actor_id=actor, role_code=role, project_id=scope.project_id,
                        environment_id=scope.environment_id, step_up_required=False, active=True))
                    session.execute(oidc_subject_bindings.insert().values(
                        issuer=config["issuer_url"], subject=subject, actor_id=actor,
                        active=True))
    except Exception:
        raise AssertionError("U01_QA_TRUST_REJECTED") from None


def _seed_pair_data(repo, owner, config: dict) -> None:
    pairs = (config["pair_a"], config["pair_b"])
    admin, reader = config["admin_actor"], config["reader_actor"]
    for pair in pairs:
        repo.register_project(admin, pair["projectId"], pair["projectName"])
        repo.register_environment(admin, pair["projectId"], pair["environmentId"],
                                  pair["environmentName"])
        repo.set_pair_grant(admin, reader, pair["projectId"], pair["environmentId"],
                            "dashboard:read", True)
    now = datetime.now(timezone.utc) - timedelta(seconds=3)
    for pair, ages in zip(pairs, ((20, 4, 0), (8, 0)), strict=True):
        for sequence, age in enumerate(ages):
            event = _qa_detected_event(pair["projectId"], pair["environmentId"],
                                       f"u01-qa-{'a' if pair is pairs[0] else 'b'}-{sequence}",
                                       (now - timedelta(days=age)).isoformat())
            owner.append(pair["projectId"], pair["environmentId"], sequence, event)


def _run_browser(config: dict, evidence_dir: Path) -> None:
    allowed = ("PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR", "TEMP", "TMP")
    env = {key: os.environ[key] for key in allowed if key in os.environ}
    env.update(ANVIL_U01_QA_PHASE=config["phase"],
               ANVIL_U01_QA_APP_URL=config["app_url"],
               ANVIL_U01_QA_ISSUER_URL=config["issuer_url"],
               ANVIL_U01_QA_PAIR_A_JSON=json.dumps(config["pair_a"]),
               ANVIL_U01_QA_PAIR_B_JSON=json.dumps(config["pair_b"]),
               ANVIL_U01_QA_EXPECTED_ROLE=(config["other_role"] if config["phase"] == "other"
                                          else config["expected_role"]),
               ANVIL_U01_QA_READER_ROLE=config["expected_role"],
               ANVIL_U01_QA_EVIDENCE_DIR=str(evidence_dir))
    command = _validated_browser_command(json.dumps(config["browser_command"]),
                                         config["source_sha"])
    docker_env = [part for key, value in env.items() if key.startswith("ANVIL_U01_QA_")
                  for part in ("--env", f"{key}={value}")]
    result = subprocess.run(["docker", "exec", *docker_env, *command[2:]], cwd=ROOT,
                            env={key: env[key] for key in allowed if key in env},
                            capture_output=True, text=True, timeout=180, check=False)
    if result.returncode or f"U01_TWO_PAIR_{config['phase'].upper()}_PASS" not in result.stdout:
        code = next((line for line in result.stderr.splitlines()
                     if re.fullmatch(r"U01_QA_[A-Z_]+", line)), "U01_QA_BROWSER_FAILED")
        raise AssertionError(code)


def _phase_plan(phase: str) -> tuple[tuple[str, ...], tuple[str, ...], int]:
    states = {"granted": ((), ("A", "B"), 6),
              "revoked": (("A", "B"), ("B",), 7),
              "restored": (("B",), ("A", "B"), 8),
              "other": (("A", "B"), ("A", "B"), 8)}
    if phase not in states:
        raise AssertionError("U01_QA_PHASE_REJECTED")
    return states[phase]


def _assert_prior_ledger(phase: str, pair_a: dict, pair_b: dict, admin: str, reader: str,
                         projects: tuple, environments: tuple, grants: tuple) -> None:
    _phase_plan(phase)
    if phase == "granted":
        expected_projects = expected_environments = expected_grants = ()
    else:
        pairs = (pair_a, pair_b)
        expected_projects = tuple((pair["projectId"], pair["projectName"], admin, True)
                                  for pair in pairs)
        expected_environments = tuple((pair["projectId"], pair["environmentId"],
                                       pair["environmentName"], admin, True) for pair in pairs)
        expected_grants = tuple((reader, pair["projectId"], pair["environmentId"],
                                 "dashboard:read", phase != "restored" or index == 1)
                                for index, pair in enumerate(pairs))
    if (tuple(projects) != expected_projects or tuple(environments) != expected_environments
            or tuple(grants) != expected_grants):
        raise AssertionError("U01_QA_PAIR_LEDGER_MISMATCH")


def _preflight_pair_ledger(engine, config: dict) -> None:
    with engine.connect() as connection:
        projects = tuple(tuple(row) for row in connection.execute(sa.select(
            registered_projects.c.project_id, registered_projects.c.display_name,
            registered_projects.c.registered_by_actor_id, registered_projects.c.active,
        ).order_by(registered_projects.c.project_id)))
        environments = tuple(tuple(row) for row in connection.execute(sa.select(
            registered_environments.c.project_id, registered_environments.c.environment_id,
            registered_environments.c.display_name,
            registered_environments.c.registered_by_actor_id, registered_environments.c.active,
        ).order_by(registered_environments.c.project_id, registered_environments.c.environment_id)))
        grants = tuple(tuple(row) for row in connection.execute(sa.select(
            pair_grants.c.actor_id, pair_grants.c.project_id, pair_grants.c.environment_id,
            pair_grants.c.permission_code, pair_grants.c.active,
        ).order_by(pair_grants.c.project_id, pair_grants.c.environment_id)))
    _assert_prior_ledger(config["phase"], config["pair_a"], config["pair_b"],
                         config["admin_actor"], config["reader_actor"],
                         projects, environments, grants)


@pytest.mark.parametrize(
    ("source_sha", "branch", "private_sha", "remote_sha", "dirty", "accepted"),
    [
        ("a" * 40, "codex/u01-dashboard-r2", "a" * 40, "a" * 40, False, True),
        ("a" * 40, "other", "a" * 40, "a" * 40, False, False),
        ("a" * 40, "codex/u01-dashboard-r2", "b" * 40, "a" * 40, False, False),
        ("a" * 40, "codex/u01-dashboard-r2", "a" * 40, "b" * 40, False, False),
        ("a" * 40, "codex/u01-dashboard-r2", "a" * 40, "a" * 40, True, False),
        ("bad", "codex/u01-dashboard-r2", "bad", "bad", False, False),
    ],
)
def test_preflight_guard_rejects_wrong_source_or_dirty_checkout(
    source_sha, branch, private_sha, remote_sha, dirty, accepted,
):
    observed = {"head": source_sha, "branch": branch, "private": private_sha,
                "remote": remote_sha, "dirty": dirty}
    if accepted:
        assert _assert_exact_checkout(source_sha, observed) is None
    else:
        with pytest.raises(AssertionError, match="U01_QA_EXACT_SOURCE_REJECTED"):
            _assert_exact_checkout(source_sha, observed)


@pytest.mark.parametrize(
    ("dsn", "isolated", "expected_db", "accepted"),
    [
        ("postgresql://anvil_u01_qa_1:secret@127.0.0.1:5546/anvil_u01_qa_1",
         "1", "anvil_u01_qa_1", True),
        ("postgresql://anvil_u01_qa_1:secret@shared:5546/anvil_u01_qa_1",
         "1", "anvil_u01_qa_1", False),
        ("postgresql://anvil_u01_qa_1:secret@127.0.0.1:5546/anvil_u01_qa_1",
         "0", "anvil_u01_qa_1", False),
        ("postgresql://anvil_u01_qa_1:secret@127.0.0.1:5546/anvil_u01_qa_1",
         "1", "shared", False),
    ],
)
def test_preflight_guard_rejects_nonisolated_database(dsn, isolated, expected_db, accepted):
    if accepted:
        assert _validated_target(dsn, isolated, expected_db).database == expected_db
    else:
        with pytest.raises(AssertionError, match="U01_QA_PG_TARGET_REJECTED"):
            _validated_target(dsn, isolated, expected_db)


def test_preflight_guard_rejects_wrong_head_or_existing_pair_rows():
    with pytest.raises(AssertionError, match="U01_QA_PG_NOT_EMPTY"):
        _assert_empty_pair_ledger("0020_f19a_pair_grants", 0, 1, 0, 0)
    with pytest.raises(AssertionError, match="U01_QA_PG_HEAD_REJECTED"):
        _assert_empty_pair_ledger("0019_oidc_sessions", 0, 0, 0, 0)
    assert _assert_empty_pair_ledger("0020_f19a_pair_grants", 0, 0, 0, 0) is None


def test_two_pair_plan_rejects_cross_combination_and_duplicate_pair():
    pair_a = ("u01-project-a", "u01-environment-a")
    pair_b = ("u01-project-b", "u01-environment-b")
    assert _validated_pairs(pair_a, pair_b) == (pair_a, pair_b)
    for wrong_b in (pair_a, (pair_a[0], pair_b[1]), (pair_b[0], pair_a[1])):
        with pytest.raises(AssertionError, match="U01_QA_PAIR_PLAN_REJECTED"):
            _validated_pairs(pair_a, wrong_b)


@pytest.mark.parametrize("phase,expected", [
    ("granted", ("A", "B")), ("revoked", ("B",)),
    ("restored", ("A", "B")), ("other", ()),
])
def test_phase_requires_exact_pair_inventory(phase, expected):
    assert _assert_phase_pairs(phase, expected) is None
    with pytest.raises(AssertionError, match="U01_QA_PAIR_INVENTORY_MISMATCH"):
        _assert_phase_pairs(phase, ("A",)) if phase != "revoked" else _assert_phase_pairs(phase, ("A", "B"))


def test_opt_in_requires_complete_trusted_run_configuration():
    supplied = {"ANVIL_U01_QA_SOURCE_SHA": "a" * 40, "ANVIL_U01_QA_PG_ISOLATED": "1",
                "ANVIL_U01_QA_DATABASE": "anvil_u01_qa_1",
                "ANVIL_U01_QA_PG_DSN": "postgresql://anvil_u01_qa_1:secret@127.0.0.1:5546/anvil_u01_qa_1",
                "ANVIL_U01_QA_PHASE": "granted",
                "ANVIL_U01_QA_ADMIN_ACTOR": "f19a_qa_admin_aaaaaaaaaaaa",
                "ANVIL_U01_QA_READER_ACTOR": "f19a-qa-reader",
                "ANVIL_U01_QA_OTHER_ACTOR": "f19a_qa_other_aaaaaaaaaaaa",
                "ANVIL_U01_QA_ISSUER_URL": "https://anvil-f18-qa.local:8444/realms/anvil",
                "ANVIL_U01_QA_APP_URL": "https://anvil-f18-qa.local:8444/",
                "ANVIL_U01_QA_ADMIN_SUBJECT": "synthetic-subject-1",
                "ANVIL_U01_QA_ADMIN_ROLE": "f19a_qa_bootstrap_aaaaaaaaaaaa",
                "ANVIL_U01_QA_READER_SUBJECT": "f19a-qa-reader",
                "ANVIL_U01_QA_OTHER_SUBJECT": "f19a-qa-other",
                "ANVIL_U01_QA_EXPECTED_ROLE": "f19a-qa-reader-only",
                "ANVIL_U01_QA_OTHER_ROLE": "f19a_qa_other_aaaaaaaaaaaa",
                "ANVIL_U01_QA_PAIR_A_JSON": '{"projectId":"project-a","environmentId":"test-a",'
                                             '"projectName":"A","environmentName":"Test A"}',
                "ANVIL_U01_QA_PAIR_B_JSON": '{"projectId":"project-b","environmentId":"test-b",'
                                             '"projectName":"B","environmentName":"Test B"}',
                "ANVIL_U01_QA_EVIDENCE_DIR": "u01-two-pair-qa-run",
                "ANVIL_U01_QA_BROWSER_COMMAND_JSON": json.dumps([
                    "docker", "exec", "anvil-u01-qa-browser-aaaaaaaaaaaa", "node",
                    "/workspace/tests/browser/u01-scoped-dashboard-two-pair.mjs"])}
    assert _validated_run_config(supplied)["phase"] == "granted"
    for key in ("ANVIL_U01_QA_SOURCE_SHA", "ANVIL_U01_QA_READER_SUBJECT",
                "ANVIL_U01_QA_PAIR_B_JSON"):
        with pytest.raises(AssertionError, match="U01_QA_CONFIG_REJECTED"):
            _validated_run_config({name: value for name, value in supplied.items() if name != key})
    with pytest.raises(AssertionError, match="U01_QA_CONFIG_REJECTED"):
        _validated_run_config({**supplied, "ANVIL_U01_QA_ADMIN_ROLE": "shared-admin"})


def test_qa_critical_audit_seed_is_canonical_and_pair_scoped():
    from packages.persistence.operations_repository import _safe_event

    event = _qa_detected_event("project-a", "test-a", "critical-a",
                               "2026-03-01T00:00:00+00:00")
    assert _safe_event(event, "project-a", "test-a") == event
    with pytest.raises(ValueError, match="AUDIT_EVENT_INVALID"):
        _safe_event(event, "project-b", "test-b")


def test_qa_trust_preflight_rejects_subject_role_and_permission_mismatch():
    config = {"issuer_url": "https://anvil-f18-qa.local:8444/realms/anvil",
              "admin_actor": "qa-admin", "admin_role": "qa-admin-role",
              "reader_actor": "qa-reader", "expected_role": "qa-reader-role",
              "other_actor": "qa-other", "other_role": "qa-other-role",
              "admin_subject": "synthetic-subject-1", "reader_subject": "f19a-qa-reader",
              "other_subject": "f19a-qa-other"}
    principals = {
        subject: SimpleNamespace(issuer=config["issuer_url"], subject=subject,
                                 actor_id=actor, actor_role=role,
                                 permissions=frozenset(permissions),
                                 project_ids=frozenset(("qa-host-project",)),
                                 environment_ids=frozenset(("qa-host-environment",)),
                                 step_up_required=False)
        for subject, actor, role, permissions in (
            ("synthetic-subject-1", "qa-admin", "qa-admin-role",
             ("pair-grants:manage", "projects:register")),
            ("f19a-qa-reader", "qa-reader", "qa-reader-role", ("dashboard:read",)),
            ("f19a-qa-other", "qa-other", "qa-other-role", ("dashboard:read",)),
        )
    }
    policy = SimpleNamespace(issuer=config["issuer_url"],
                             allowed_roles=frozenset(("qa-admin-role", "qa-reader-role",
                                                      "qa-other-role")),
                             allowed_permissions=frozenset(("pair-grants:manage", "projects:register",
                                                            "dashboard:read")),
                             allowed_project_ids=frozenset(("qa-host-project",)),
                             allowed_environment_ids=frozenset(("qa-host-environment",)))
    scope = SimpleNamespace(allowed_actor_roles=policy.allowed_roles,
                            project_id="qa-host-project", environment_id="qa-host-environment")
    inputs = SimpleNamespace(principal_policy=policy, authorization_scope=scope)
    assert _assert_qa_trust(config, inputs, principals) is None
    bad = dict(principals)
    bad["f19a-qa-other"] = SimpleNamespace(**{**vars(principals["f19a-qa-other"]),
                                             "actor_id": "qa-reader"})
    with pytest.raises(AssertionError, match="U01_QA_TRUST_REJECTED"):
        _assert_qa_trust(config, inputs, bad)
    bad = dict(principals)
    bad["f19a-qa-other"] = SimpleNamespace(**{**vars(principals["f19a-qa-other"]),
                                             "permissions": frozenset(("dashboard:read",
                                                                       "pair-grants:manage"))})
    with pytest.raises(AssertionError, match="U01_QA_TRUST_REJECTED"):
        _assert_qa_trust(config, inputs, bad)
    bad = dict(principals)
    bad["f19a-qa-reader"] = SimpleNamespace(**{**vars(principals["f19a-qa-reader"]),
                                              "permissions": frozenset(("dashboard:read",
                                                                        "pair-grants:manage"))})
    with pytest.raises(AssertionError, match="U01_QA_TRUST_REJECTED"):
        _assert_qa_trust(config, inputs, bad)
    bad = dict(principals)
    bad["f19a-qa-reader"] = SimpleNamespace(**{**vars(principals["f19a-qa-reader"]),
                                              "project_ids": frozenset(("other-project",))})
    with pytest.raises(AssertionError, match="U01_QA_TRUST_REJECTED"):
        _assert_qa_trust(config, inputs, bad)
    with pytest.raises(AssertionError, match="U01_QA_TRUST_REJECTED"):
        _assert_qa_trust(config, SimpleNamespace(principal_policy=policy,
                         authorization_scope=SimpleNamespace(allowed_actor_roles=frozenset(),
                             project_id="qa-host-project", environment_id="qa-host-environment")), principals)


def _principal_seed_case():
    sha = "a" * 40
    issuer = "https://anvil-f18-qa.local:8444/realms/anvil"
    config = {"source_sha": sha, "phase": "granted", "pg_isolated": "1",
              "database": "anvil_u01_qa_1",
              "pg_dsn": "postgresql://anvil_u01_qa_1:secret@127.0.0.1:5546/anvil_u01_qa_1",
              "issuer_url": issuer,
              "admin_actor": f"f19a_qa_admin_{sha[:12]}",
              "reader_actor": "f19a-qa-reader",
              "other_actor": f"f19a_qa_other_{sha[:12]}",
              "admin_role": f"f19a_qa_bootstrap_{sha[:12]}",
              "expected_role": "f19a-qa-reader-only",
              "other_role": f"f19a_qa_other_{sha[:12]}",
              "admin_subject": "synthetic-subject-1",
              "reader_subject": "f19a-qa-reader", "other_subject": "f19a-qa-other"}
    policy = SimpleNamespace(issuer=issuer,
        allowed_roles=frozenset((config["admin_role"], config["expected_role"],
                                 config["other_role"])),
        allowed_permissions=frozenset(("projects:register", "pair-grants:manage",
                                       "dashboard:read")),
        allowed_project_ids=frozenset(("qa-host-project",)),
        allowed_environment_ids=frozenset(("qa-host-environment",)))
    scope = SimpleNamespace(project_id="qa-host-project", environment_id="qa-host-environment",
                            allowed_actor_roles=policy.allowed_roles)
    inputs = SimpleNamespace(principal_policy=policy, authorization_scope=scope)
    engine = sa.create_engine("sqlite://")
    DIRECTORY_METADATA.create_all(engine)
    return engine, sessionmaker(bind=engine), config, inputs


def _principal_counts(engine):
    with engine.connect() as connection:
        return tuple(_count(connection, table) for table in
                     (users, roles, user_roles, oidc_subject_bindings))


def test_granted_seeds_three_exact_qa_principals_atomically():
    engine, factory, config, inputs = _principal_seed_case()
    try:
        _seed_qa_principals(factory, config, inputs)
        assert _principal_counts(engine) == (3, 3, 3, 3)
        _preflight_principals(factory, config, inputs)
        resolver = SqlAlchemyOidcPrincipalResolver(factory)
        for subject, actor, role, permissions in (
            ("synthetic-subject-1", config["admin_actor"], config["admin_role"],
             frozenset(("projects:register", "pair-grants:manage"))),
            ("f19a-qa-reader", "f19a-qa-reader", "f19a-qa-reader-only",
             frozenset(("dashboard:read",))),
            ("f19a-qa-other", config["other_actor"], config["other_role"],
             frozenset(("dashboard:read",))),
        ):
            principal = resolver.resolve(config["issuer_url"], subject)
            assert (principal.actor_id, principal.actor_role, principal.permissions) == (
                actor, role, permissions)
    finally:
        engine.dispose()


def test_granted_seed_rejects_wrong_db_trust_role_subject_and_existing_rows_without_write():
    for mutation in ("db", "issuer", "role", "subject", "partial"):
        engine, factory, config, inputs = _principal_seed_case()
        try:
            if mutation == "db":
                config["database"] = "anvil_f19a_1234567"
            elif mutation == "issuer":
                inputs.principal_policy.issuer = "https://wrong.invalid"
            elif mutation == "role":
                config["other_role"] = "shared-admin"
            elif mutation == "subject":
                config["reader_subject"] = "wrong-subject"
            else:
                with engine.begin() as connection:
                    connection.execute(users.insert().values(actor_id=config["reader_actor"],
                                                             active=True))
            before = _principal_counts(engine)
            with pytest.raises(AssertionError, match="U01_QA_TRUST_REJECTED"):
                _seed_qa_principals(factory, config, inputs)
            assert _principal_counts(engine) == before
        finally:
            engine.dispose()


def test_granted_seed_rolls_back_all_principals_on_late_insert_failure():
    engine, factory, config, inputs = _principal_seed_case()
    def fail_binding(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.startswith("INSERT INTO oidc_subject_bindings"):
            raise RuntimeError("synthetic binding insert fault")
    sa.event.listen(engine, "before_cursor_execute", fail_binding)
    try:
        with pytest.raises(AssertionError, match="U01_QA_TRUST_REJECTED"):
            _seed_qa_principals(factory, config, inputs)
        assert _principal_counts(engine) == (0, 0, 0, 0)
    finally:
        sa.event.remove(engine, "before_cursor_execute", fail_binding)
        engine.dispose()


def test_browser_command_requires_exact_isolated_docker_exec_and_rejects_host_fallback():
    sha = "a" * 40
    command = ["docker", "exec", f"anvil-u01-qa-browser-{sha[:12]}", "node",
               "/workspace/tests/browser/u01-scoped-dashboard-two-pair.mjs"]
    assert _validated_browser_command(json.dumps(command), sha) == tuple(command)
    for bad in (["node", str(ROOT / "tests/browser/u01-scoped-dashboard-two-pair.mjs")],
                ["sh", "-c", "node test.mjs"],
                ["docker", "run", command[2], "node", command[4]],
                ["docker", "exec", "shared-browser", "node", command[4]],
                ["docker", "exec", command[2], "node", "/tmp/other.mjs"],
                command + ["--extra"]):
        with pytest.raises(AssertionError, match="U01_QA_BROWSER_COMMAND_REJECTED"):
            _validated_browser_command(json.dumps(bad), sha)


def test_browser_exec_passes_only_nonsecret_qa_values_into_isolated_container(monkeypatch, tmp_path):
    sha = "a" * 40
    command = ["docker", "exec", f"anvil-u01-qa-browser-{sha[:12]}", "node",
               "/workspace/tests/browser/u01-scoped-dashboard-two-pair.mjs"]
    config = {"source_sha": sha, "phase": "granted", "app_url": "https://anvil-f18-qa.local:8444/",
              "issuer_url": "https://anvil-f18-qa.local:8444/realms/anvil",
              "pair_a": {"projectId": "project-a", "environmentId": "test-a"},
              "pair_b": {"projectId": "project-b", "environmentId": "test-b"},
              "expected_role": "f19a-qa-reader-only", "other_role": f"f19a_qa_other_{sha[:12]}",
              "browser_command": tuple(command)}
    observed = {}
    def capture(argv, **kwargs):
        observed.update(argv=argv, options=kwargs)
        return SimpleNamespace(returncode=0, stdout="U01_TWO_PAIR_GRANTED_PASS", stderr="")
    monkeypatch.setattr(subprocess, "run", capture)
    monkeypatch.setenv("ANVIL_DATABASE_URL", "postgresql://secret@private.invalid/db")
    _run_browser(config, tmp_path)
    assert observed["argv"][:2] == ["docker", "exec"]
    assert observed["argv"][-3:] == command[-3:]
    assert any(arg == "ANVIL_U01_QA_PHASE=granted" for arg in observed["argv"])
    assert all("secret" not in arg and "ANVIL_DATABASE_URL" not in arg
               for arg in observed["argv"])
    assert "ANVIL_DATABASE_URL" not in observed["options"]["env"]


def test_phase_plan_requires_clean_before_and_exact_after_inventory():
    assert _phase_plan("granted") == ((), ("A", "B"), 6)
    assert _phase_plan("revoked") == (("A", "B"), ("B",), 7)
    assert _phase_plan("restored") == (("B",), ("A", "B"), 8)
    assert _phase_plan("other") == (("A", "B"), ("A", "B"), 8)
    with pytest.raises(AssertionError, match="U01_QA_PHASE_REJECTED"):
        _phase_plan("unplanned")


def test_prior_pair_ledger_rejects_extra_rows_before_any_phase_write():
    pair_a = {"projectId": "project-a", "environmentId": "test-a",
              "projectName": "A", "environmentName": "Test A"}
    pair_b = {"projectId": "project-b", "environmentId": "test-b",
              "projectName": "B", "environmentName": "Test B"}
    projects = (("project-a", "A", "qa-admin", True),
                ("project-b", "B", "qa-admin", True))
    environments = (("project-a", "test-a", "Test A", "qa-admin", True),
                    ("project-b", "test-b", "Test B", "qa-admin", True))
    grants = (("qa-reader", "project-a", "test-a", "dashboard:read", False),
              ("qa-reader", "project-b", "test-b", "dashboard:read", True))
    assert _assert_prior_ledger("restored", pair_a, pair_b, "qa-admin", "qa-reader",
                                projects, environments, grants) is None
    with pytest.raises(AssertionError, match="U01_QA_PAIR_LEDGER_MISMATCH"):
        _assert_prior_ledger("restored", pair_a, pair_b, "qa-admin", "qa-reader",
                             projects, environments, grants + (("qa-other", "project-b", "test-b",
                                                               "dashboard:read", False),))


def test_operations_connection_uses_libpq_dsn_not_sqlalchemy_driver_name():
    target = _validated_target("postgresql+psycopg://anvil_u01_qa_1:secret@127.0.0.1:5546/"
                               "anvil_u01_qa_1", "1", "anvil_u01_qa_1")
    assert _operations_dsn(target).startswith("postgresql://")
    assert "+psycopg" not in _operations_dsn(target)


def test_opt_in_u01_two_pair_oidc_https_pg15():
    """Main runs four sequential phases against one recorded, isolated QA lifetime."""
    if "ANVIL_U01_QA_SOURCE_SHA" not in os.environ:
        pytest.skip("U01 two-pair WSL PG15/OIDC/HTTPS/Chromium opt-in not configured")
    config = _validated_run_config(os.environ)
    _assert_exact_checkout(config["source_sha"], _observed_checkout())
    url = _validated_target(config["pg_dsn"], config["pg_isolated"], config["database"])
    evidence_dir = Path(config["evidence_dir"])
    if (not evidence_dir.is_dir() or evidence_dir.is_symlink()
            or not evidence_dir.name.startswith("u01-two-pair-qa-")):
        raise AssertionError("U01_QA_EVIDENCE_DIR_REJECTED")
    try:
        inputs = load_oidc_process_inputs(os.environ)
    except Exception:
        raise AssertionError("U01_QA_TRUST_REJECTED") from None
    engine = sa.create_engine(url, pool_pre_ping=True,
                              connect_args={"connect_timeout": 3, "tcp_user_timeout": 4000})
    try:
        factory = sessionmaker(bind=engine)
        _preflight_database(engine, config)
        if config["phase"] == "granted":
            _seed_qa_principals(factory, config, inputs)
        _preflight_principals(factory, config, inputs)
        _preflight_pair_ledger(engine, config)
        repo = F19ARegistrationRepository(factory)
        owner = PostgresOperationsRepository(_operations_dsn(url))
        pair_a = (config["pair_a"]["projectId"], config["pair_a"]["environmentId"])
        pair_b = (config["pair_b"]["projectId"], config["pair_b"]["environmentId"])
        before, after, audit_count = _phase_plan(config["phase"])
        identities = {"A": pair_a, "B": pair_b}
        observed = _pair_rows(repo, config["reader_actor"])
        if observed != tuple(identities[name] for name in before):
            raise AssertionError("U01_QA_PAIR_INVENTORY_MISMATCH")
        if _pair_rows(repo, config["other_actor"]):
            raise AssertionError("U01_QA_OTHER_ACTOR_GRANT_REJECTED")
        with engine.connect() as connection:
            prior_audits = _count(connection, registration_audit_events)
        expected_prior = {"granted": 0, "revoked": 6, "restored": 7, "other": 8}[config["phase"]]
        if prior_audits != expected_prior:
            raise AssertionError("U01_QA_AUDIT_INVENTORY_MISMATCH")
        if config["phase"] == "granted":
            _seed_pair_data(repo, owner, config)
        elif config["phase"] in {"revoked", "restored"}:
            repo.set_pair_grant(config["admin_actor"], config["reader_actor"], *pair_a,
                                "dashboard:read", config["phase"] == "restored")
        if _pair_rows(repo, config["reader_actor"]) != tuple(identities[name] for name in after):
            raise AssertionError("U01_QA_PAIR_INVENTORY_MISMATCH")
        if _pair_rows(repo, config["other_actor"]):
            raise AssertionError("U01_QA_OTHER_ACTOR_GRANT_REJECTED")
        with engine.connect() as connection:
            if _count(connection, registration_audit_events) != audit_count:
                raise AssertionError("U01_QA_AUDIT_INVENTORY_MISMATCH")
        for pair, expected_count in ((pair_a, 3), (pair_b, 2)):
            rows = owner.load_complete(*pair)
            if len(rows) != expected_count or any(
                event.get("action") != "DETECTED" or event.get("alert", {}).get("project_id") != pair[0]
                or event.get("alert", {}).get("environment_id") != pair[1]
                for _sequence, event in rows
            ):
                raise AssertionError("U01_QA_OPERATIONS_AUDIT_MISMATCH")
        _run_browser(config, evidence_dir)
    finally:
        engine.dispose()
