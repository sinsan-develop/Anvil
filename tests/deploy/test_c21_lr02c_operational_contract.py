from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile

import pytest


ROOT = Path(__file__).parents[2]
DEPLOY = ROOT / "deploy" / "ysna"


def _bash() -> Path:
    candidate = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "usr" / "bin" / "bash.exe"
    if not candidate.is_file():
        pytest.skip("Git Bash is required")
    return candidate


def _posix(path: Path) -> str:
    value = str(path).replace("\\", "/")
    return f"/{value[0].lower()}{value[2:]}" if len(value) > 2 and value[1] == ":" else value


def _executable(directory: Path, name: str, body: str) -> None:
    target = directory / name
    target.write_text("#!/bin/bash\n" + body.lstrip(), encoding="utf-8", newline="\n")
    target.chmod(0o755)


def _install_python3(fakebin: Path) -> None:
    _executable(fakebin, "python3", 'exec "$PYTHON_EXE" "$@"\n')


def _install_fake_shared_db_docker(fakebin: Path) -> None:
    _executable(
        fakebin,
        "docker",
        r'''
printf 'docker %s\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  "inspect --format {{.State.Running}} shared-db")
    printf '%s\n' "${SHARED_DB_RUNNING:-true}"
    ;;
  *"shared-db pg_dump --version"*)
    [[ "${SHARED_DB_PG_DUMP_AVAILABLE:-1}" == 1 ]] || exit 31
    printf 'pg_dump (PostgreSQL) 18.0\n'
    ;;
  *"shared-db pg_restore --version"*)
    [[ "${SHARED_DB_PG_RESTORE_AVAILABLE:-1}" == 1 ]] || exit 32
    printf 'pg_restore (PostgreSQL) 18.0\n'
    ;;
  *"shared-db sh -ceu"*)
    service="$(cat)"
    [[ "$service" == "$EXPECTED_SERVICE" ]] || exit 41
    [[ "$*" == *"PGSERVICEFILE=/dev/fd/3"* ]] || exit 46
    [[ "$*" == *"PGSERVICE=anvil_backup"* ]] || exit 47
    [[ "$*" != *"PGDATABASE"* ]] || exit 48
    [[ "${SHARED_DB_DUMP_FAIL:-0}" == 0 ]] || exit 42
    printf 'container-portable-backup'
    ;;
  *"shared-db pg_restore --list"*)
    [[ "$(cat)" == 'container-portable-backup' ]] || exit 43
    [[ "${SHARED_DB_RESTORE_FAIL:-0}" == 0 ]] || exit 44
    printf 'TABLE public tasks\n'
    ;;
  *) printf 'unexpected docker invocation\n' >&2; exit 45 ;;
esac
''',
    )


def _load_provision_module():
    path = DEPLOY / "provision-c21-validation.py"
    spec = importlib.util.spec_from_file_location("c21_provision", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_probe_module():
    path = DEPLOY / "probe-providers.py"
    spec = importlib.util.spec_from_file_location("c21_probe", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("database_url", "expected_service"),
    [
        (
            "postgresql+psycopg2://secret-user:secret-pass@shared-db:5432/anvil?sslmode=disable",
            "[anvil_backup]\nuser='secret-user'\npassword='secret-pass'\nhost='shared-db'\nport='5432'\ndbname='anvil'\nsslmode='disable'",
        ),
        (
            "postgresql://secret-user:secret-pass@shared-db:5432/anvil?sslmode=disable",
            "[anvil_backup]\nuser='secret-user'\npassword='secret-pass'\nhost='shared-db'\nport='5432'\ndbname='anvil'\nsslmode='disable'",
        ),
        (
            "postgres://secret-user:secret-pass@shared-db:5432/anvil?sslmode=disable",
            "[anvil_backup]\nuser='secret-user'\npassword='secret-pass'\nhost='shared-db'\nport='5432'\ndbname='anvil'\nsslmode='disable'",
        ),
        (
            "postgresql://secret%2Duser:p%40ss%5Cword@shared-db:5432/anvil%2Ddb?sslmode=require&connect_timeout=7&application_name=backup%20job&options=-c%20statement_timeout%3D0",
            "[anvil_backup]\nuser='secret-user'\npassword='p@ss\\\\word'\nhost='shared-db'\nport='5432'\ndbname='anvil-db'\nsslmode='require'\nconnect_timeout='7'\napplication_name='backup job'\noptions='-c statement_timeout=0'",
        ),
    ],
)
def test_backup_host_path_uses_exact_fd3_service_without_uri_environment(
    database_url: str,
    expected_service: str,
) -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        _executable(
            fakebin,
            "pg_dump",
            'service="$(cat <&3)"\n'
            '[[ "$service" == "$EXPECTED_SERVICE" ]] || exit 41\n'
            '[[ "$PGSERVICEFILE" == /dev/fd/3 ]] || exit 42\n'
            '[[ "$PGSERVICE" == anvil_backup ]] || exit 43\n'
            '[[ -z "${PGDATABASE+x}" ]] || exit 44\n'
            'target="${@: -1}"; printf "portable-backup" > "${target#--file=}"\n',
        )
        _executable(fakebin, "pg_restore", '[[ "$1" == "--list" ]] && printf "TABLE public tasks\\n"\n')
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": database_url,
            "ANVIL_RELEASE_COMMIT": "a" * 40,
            "EXPECTED_SERVICE": expected_service,
            "PYTHON_EXE": _posix(Path(os.sys.executable)),
            "PATH": _posix(fakebin) + os.pathsep + os.environ.get("PATH", ""),
        }
        result = subprocess.run(
            [str(_bash()), str(DEPLOY / "backup-c21-db.sh")],
            env=env,
            text=True,
            capture_output=True,
        )

        assert result.returncode == 0, result.stderr
        receipt = json.loads((root / "evidence" / "c21-db-backup.json").read_text())
        assert receipt["status"] == "BACKUP_VERIFIED"
        assert receipt["release_commit"] == "a" * 40
        assert receipt["bytes"] == len(b"portable-backup")
        assert len(receipt["sha256"]) == 64
        assert receipt["restore_listable"] is True
        assert receipt["mode"] == "600"
        rendered = result.stdout + result.stderr + json.dumps(receipt)
        assert "secret-user" not in rendered
        assert "secret-pass" not in rendered


@pytest.mark.parametrize("missing_host_tool", ["pg_dump", "pg_restore"])
def test_backup_uses_running_shared_db_tools_when_a_host_client_is_unavailable(missing_host_tool: str) -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        docker_log = root / "docker.log"
        chmod_log = root / "chmod.log"
        _install_fake_shared_db_docker(fakebin)
        _executable(fakebin, "chmod", 'printf "chmod %s\\n" "$*" >> "$CHMOD_LOG"\nexec /usr/bin/chmod "$@"\n')
        present_host_tool = "pg_restore" if missing_host_tool == "pg_dump" else "pg_dump"
        _executable(fakebin, present_host_tool, "exit 91\n")
        dsn = "postgresql+psycopg2://secret-user:secret-pass@shared-db:5432/anvil?sslmode=disable"
        expected_service = "[anvil_backup]\nuser='secret-user'\npassword='secret-pass'\nhost='shared-db'\nport='5432'\ndbname='anvil'\nsslmode='disable'"
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": dsn,
            "ANVIL_RELEASE_COMMIT": "d" * 40,
            "DOCKER_LOG": _posix(docker_log),
            "CHMOD_LOG": _posix(chmod_log),
            "EXPECTED_SERVICE": expected_service,
            "PYTHON_EXE": _posix(Path(os.sys.executable)),
            "PATH": _posix(fakebin) + os.pathsep + _posix(_bash().parent),
        }

        result = subprocess.run(
            [str(_bash()), str(DEPLOY / "backup-c21-db.sh")],
            env=env,
            text=True,
            capture_output=True,
        )

        assert result.returncode == 0, result.stderr
        backup = root / "backups" / "c21" / ("d" * 40) / "anvil.dump"
        listing = root / "backups" / "c21" / ("d" * 40) / "anvil.restore-list.txt"
        receipt_path = root / "evidence" / "c21-db-backup.json"
        assert backup.read_bytes() == b"container-portable-backup"
        assert listing.read_text() == "TABLE public tasks\n"
        receipt = json.loads(receipt_path.read_text())
        assert receipt["status"] == "BACKUP_VERIFIED"
        assert receipt["release_commit"] == "d" * 40
        assert receipt["bytes"] == len(b"container-portable-backup")
        assert receipt["sha256"] == hashlib.sha256(b"container-portable-backup").hexdigest()
        assert receipt["restore_listable"] is True
        assert receipt["mode"] == "600"
        chmod_actions = chmod_log.read_text().splitlines()
        assert f"chmod 600 {_posix(backup)}" in chmod_actions
        assert f"chmod 600 {_posix(listing)}" in chmod_actions
        assert any(
            action.startswith(f"chmod 600 {_posix(receipt_path)}.tmp.")
            for action in chmod_actions
        )
        rendered = result.stdout + result.stderr + docker_log.read_text() + json.dumps(receipt)
        assert "secret-user" not in rendered
        assert "secret-pass" not in rendered
        assert "docker cp" not in rendered
        assert "docker compose" not in rendered


def test_backup_rejects_unsupported_database_scheme_without_invoking_clients() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        client_log = root / "client.log"
        _executable(fakebin, "pg_dump", 'printf "pg_dump called" >> "$CLIENT_LOG"\n')
        _executable(fakebin, "pg_restore", 'printf "pg_restore called" >> "$CLIENT_LOG"\n')
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": "mysql://secret-user:secret-pass@shared-db/anvil",
            "ANVIL_RELEASE_COMMIT": "2" * 40,
            "CLIENT_LOG": _posix(client_log),
            "PYTHON_EXE": _posix(Path(os.sys.executable)),
            "PATH": _posix(fakebin) + os.pathsep + os.environ.get("PATH", ""),
        }

        result = subprocess.run(
            [str(_bash()), str(DEPLOY / "backup-c21-db.sh")],
            env=env,
            text=True,
            capture_output=True,
        )

        assert result.returncode != 0
        assert result.stderr.strip() == "ANVIL_DATABASE_URL must use a PostgreSQL scheme"
        assert not client_log.exists()
        assert not (root / "evidence" / "c21-db-backup.json").exists()
        assert not (root / "backups" / "c21" / ("2" * 40) / "anvil.dump").exists()
        rendered = result.stdout + result.stderr
        assert "secret-user" not in rendered
        assert "secret-pass" not in rendered


@pytest.mark.parametrize(
    "database_url",
    [
        "postgresql://:secret-pass@shared-db/anvil",
        "postgresql:///anvil",
        "postgresql://secret-user:secret-pass@shared-db/",
        "postgresql://secret-user:secret-pass@shared-db:70000/anvil",
        "postgresql://secret-user:secret%00pass@shared-db/anvil",
        "postgresql://secret-user:secret%0Apass@shared-db/anvil",
        "postgresql://secret-user:secret-pass@shared-db/anvil#fragment",
        "postgresql://secret-user:secret-pass@shared-db/anvil?sslmode=require&sslmode=disable",
        "postgresql://secret-user:secret-pass@shared-db/anvil?unknown=value",
        "postgresql://secret-user:secret-pass@shared-db/anvil?dbname=other",
        "postgresql://secret%ZZuser:secret-pass@shared-db/anvil",
    ],
)
def test_backup_rejects_invalid_or_ambiguous_conninfo_before_any_client(database_url: str) -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        client_log = root / "client.log"
        _executable(fakebin, "pg_dump", 'printf "pg_dump" >> "$CLIENT_LOG"\n')
        _executable(fakebin, "pg_restore", 'printf "pg_restore" >> "$CLIENT_LOG"\n')
        _executable(fakebin, "docker", 'printf "docker" >> "$CLIENT_LOG"\n')
        result = subprocess.run(
            [str(_bash()), str(DEPLOY / "backup-c21-db.sh")],
            env=os.environ | {
                "ANVIL_DEPLOY_ROOT": _posix(root),
                "ANVIL_DATABASE_URL": database_url,
                "ANVIL_RELEASE_COMMIT": "3" * 40,
                "CLIENT_LOG": _posix(client_log),
                "PYTHON_EXE": _posix(Path(os.sys.executable)),
                "PATH": _posix(fakebin) + os.pathsep + _posix(_bash().parent),
            },
            text=True,
            capture_output=True,
        )
        assert result.returncode != 0
        assert "ANVIL_DATABASE_URL is invalid" in result.stderr
        assert not client_log.exists()
        assert not (root / "evidence" / "c21-db-backup.json").exists()
        assert not list((root / "backups").rglob("*.tmp.*"))


def test_backup_fails_closed_before_clients_when_python3_is_unavailable() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        client_log = root / "client.log"
        _executable(fakebin, "pg_dump", 'printf "pg_dump" >> "$CLIENT_LOG"\n')
        _executable(fakebin, "pg_restore", 'printf "pg_restore" >> "$CLIENT_LOG"\n')
        result = subprocess.run(
            [str(_bash()), str(DEPLOY / "backup-c21-db.sh")],
            env=os.environ | {
                "ANVIL_DEPLOY_ROOT": _posix(root),
                "ANVIL_DATABASE_URL": "postgresql://secret-user:secret-pass@shared-db/anvil",
                "ANVIL_RELEASE_COMMIT": "4" * 40,
                "CLIENT_LOG": _posix(client_log),
                "PATH": _posix(fakebin) + os.pathsep + _posix(_bash().parent),
            },
            text=True,
            capture_output=True,
        )
        assert result.returncode != 0
        assert result.stderr.strip() == "database backup requires python3 for safe connection parsing"
        assert not client_log.exists()


def test_backup_fails_closed_when_shared_db_is_not_running() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        docker_log = root / "docker.log"
        _install_fake_shared_db_docker(fakebin)
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": "postgresql://secret-user:secret-pass@shared-db/anvil",
            "ANVIL_RELEASE_COMMIT": "e" * 40,
            "DOCKER_LOG": _posix(docker_log),
            "SHARED_DB_RUNNING": "false",
            "PYTHON_EXE": _posix(Path(os.sys.executable)),
            "PATH": _posix(fakebin) + os.pathsep + _posix(_bash().parent),
        }

        result = subprocess.run([str(_bash()), str(DEPLOY / "backup-c21-db.sh")], env=env, text=True, capture_output=True)

        assert result.returncode != 0
        assert "running shared-db container" in result.stderr
        assert not (root / "evidence" / "c21-db-backup.json").exists()
        assert not list((root / "backups").rglob("*.tmp.*"))


@pytest.mark.parametrize(
    ("availability_flag", "expected_error"),
    [
        ("SHARED_DB_PG_DUMP_AVAILABLE", "shared-db pg_dump is unavailable"),
        ("SHARED_DB_PG_RESTORE_AVAILABLE", "shared-db pg_restore is unavailable"),
    ],
)
def test_backup_fails_closed_when_a_shared_db_postgresql_tool_is_unavailable(
    availability_flag: str,
    expected_error: str,
) -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        docker_log = root / "docker.log"
        _install_fake_shared_db_docker(fakebin)
        release = "1" * 40
        dsn = "postgresql://secret-user:secret-pass@shared-db/anvil"
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": dsn,
            "ANVIL_RELEASE_COMMIT": release,
            "DOCKER_LOG": _posix(docker_log),
            "EXPECTED_SERVICE": "[anvil_backup]\nuser='secret-user'\npassword='secret-pass'\nhost='shared-db'\ndbname='anvil'",
            "PYTHON_EXE": _posix(Path(os.sys.executable)),
            availability_flag: "0",
            "PATH": _posix(fakebin) + os.pathsep + _posix(_bash().parent),
        }

        result = subprocess.run(
            [str(_bash()), str(DEPLOY / "backup-c21-db.sh")],
            env=env,
            text=True,
            capture_output=True,
        )

        assert result.returncode != 0
        assert result.stderr.strip() == expected_error
        assert not (root / "evidence" / "c21-db-backup.json").exists()
        assert not (root / "backups" / "c21" / release / "anvil.dump").exists()
        assert not (root / "backups" / "c21" / release / "anvil.restore-list.txt").exists()
        assert not list((root / "backups").rglob("*.tmp.*"))
        rendered = result.stdout + result.stderr + docker_log.read_text()
        assert "secret-user" not in rendered
        assert "secret-pass" not in rendered


@pytest.mark.parametrize(
    ("failure_flag", "expected_error"),
    [
        ("SHARED_DB_DUMP_FAIL", "backup failed using shared-db"),
        ("SHARED_DB_RESTORE_FAIL", "restore-list validation failed using shared-db"),
    ],
)
def test_shared_db_backup_failure_never_publishes_success(
    failure_flag: str,
    expected_error: str,
) -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        docker_log = root / "docker.log"
        _install_fake_shared_db_docker(fakebin)
        dsn = "postgresql://secret-user:secret-pass@shared-db/anvil"
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": dsn,
            "ANVIL_RELEASE_COMMIT": "f" * 40,
            "DOCKER_LOG": _posix(docker_log),
            "EXPECTED_SERVICE": "[anvil_backup]\nuser='secret-user'\npassword='secret-pass'\nhost='shared-db'\ndbname='anvil'",
            "PYTHON_EXE": _posix(Path(os.sys.executable)),
            failure_flag: "1",
            "PATH": _posix(fakebin) + os.pathsep + _posix(_bash().parent),
        }

        result = subprocess.run([str(_bash()), str(DEPLOY / "backup-c21-db.sh")], env=env, text=True, capture_output=True)

        assert result.returncode != 0
        assert expected_error in result.stderr
        assert not (root / "evidence" / "c21-db-backup.json").exists()
        assert not (root / "backups" / "c21" / ("f" * 40) / "anvil.dump").exists()
        assert not list((root / "backups").rglob("*.tmp.*"))
        rendered = result.stdout + result.stderr + docker_log.read_text()
        assert "secret-user" not in rendered
        assert "secret-pass" not in rendered


def test_backup_failure_never_writes_success_receipt() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _install_python3(fakebin)
        _executable(fakebin, "pg_dump", "exit 17\n")
        _executable(fakebin, "pg_restore", "exit 0\n")
        _executable(fakebin, "docker", 'printf "called" > "$DOCKER_LOG"; exit 99\n')
        docker_log = root / "docker.log"
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": "postgresql://secret.invalid/anvil",
            "ANVIL_RELEASE_COMMIT": "b" * 40,
            "DOCKER_LOG": _posix(docker_log),
            "PYTHON_EXE": _posix(Path(os.sys.executable)),
            "PATH": _posix(fakebin) + os.pathsep + os.environ.get("PATH", ""),
        }
        result = subprocess.run([str(_bash()), str(DEPLOY / "backup-c21-db.sh")], env=env, text=True, capture_output=True)
        assert result.returncode != 0
        assert not (root / "evidence" / "c21-db-backup.json").exists()
        assert not docker_log.exists()


def test_rebind_is_single_assignment_atomic_and_restorable_without_secret_reflection() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        runtime = root / "runtime"
        runtime.mkdir()
        env_file = runtime / "anvil.env"
        env_file.write_text(
            "ANVIL_DATABASE_URL=postgresql://secret.invalid/anvil\n"
            "ANVIL_TEST_SESSION_RUN_IDS=old-run\n"
            "ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read\n",
            encoding="utf-8",
            newline="\n",
        )
        env_file.chmod(0o600)
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_RELEASE_COMMIT": "c" * 40,
            "ANVIL_C21_RUN_ID": "new-run",
        }

        applied = subprocess.run([str(_bash()), str(DEPLOY / "rebind-c21-test-session.sh"), "apply"], env=env, text=True, capture_output=True)
        assert applied.returncode == 0, applied.stderr
        text = env_file.read_text()
        assert text.count("ANVIL_TEST_SESSION_RUN_IDS=") == 1
        assert "ANVIL_TEST_SESSION_RUN_IDS=new-run" in text
        assert text.count("ANVIL_TEST_SESSION_PERMISSION_SCOPES=") == 1
        assert "secret.invalid" not in applied.stdout + applied.stderr
        receipt = json.loads((root / "evidence" / "c21-test-session-rebind.json").read_text())
        assert receipt["status"] == "APPLIED"
        assert receipt["backup_mode"] == "600"
        assert "new-run" not in json.dumps(receipt)

        restored = subprocess.run([str(_bash()), str(DEPLOY / "rebind-c21-test-session.sh"), "restore"], env=env, text=True, capture_output=True)
        assert restored.returncode == 0, restored.stderr
        assert "ANVIL_TEST_SESSION_RUN_IDS=old-run" in env_file.read_text()


def test_provision_plan_is_release_bound_and_rejects_incomplete_or_mismatched_approval() -> None:
    module = _load_provision_module()
    release = "d" * 40
    plan = module.build_authority_plan(release, "project-c21", "repo-c21", "ysna-production")
    assert plan["release_commit"] == release
    assert plan["project_id"].endswith(release[:12])
    assert plan["repository_id"].endswith(release[:12])
    assert plan["artifact_ids"]["design_specification"].endswith(release[:12])
    assert plan["hashes"]["execution_plan"].startswith("sha256:")

    with pytest.raises(ValueError, match="approval"):
        module.validate_approval_receipt({}, plan, now="2026-09-03T00:00:00+00:00")
    receipt = {
        "authenticated_human": True,
        "approved_by": "owner-1",
        "approved_at": "2026-09-02T00:00:00+00:00",
        "expires_at": "2099-01-01T00:00:00+00:00",
        "status": "ACTIVE",
        "subjects": {
            kind: {
                "approval_id": f"approval-{kind.lower()}-{release[:12]}",
                "subject_id": plan["approval_subjects"][kind]["subject_id"],
                "subject_hash": plan["approval_subjects"][kind]["subject_hash"],
            }
            for kind in ("DESIGN_SPECIFICATION", "WORK_PLAN", "WORK_INSTRUCTION", "EXECUTION_PLAN")
        },
    }
    receipt["subjects"]["WORK_PLAN"]["subject_hash"] = "sha256:" + "0" * 64
    with pytest.raises(ValueError, match="approval"):
        module.validate_approval_receipt(receipt, plan, now="2026-09-03T00:00:00+00:00")


def test_cas_confirmation_sql_is_exact_draft_v1_transition_and_parameterized() -> None:
    module = _load_provision_module()
    sql = module.CONFIRM_TASK_SQL
    assert "status='DRAFT'" in sql
    assert "version=1" in sql
    assert "status='CONFIRMED'" in sql
    assert "version=2" in sql
    assert ":task_id" in sql or "%s" in sql
    assert "RETURNING" in sql
    assert "DELETE" not in sql.upper()


def test_provider_plan_has_nine_read_only_providers_and_fail_closed_statuses() -> None:
    module = _load_probe_module()
    plan = module.build_probe_plan({})
    assert list(plan) == [
        "CEREBRAS", "GROQ", "MISTRAL", "OPENROUTER", "UPSTAGE",
        "GEMINI", "ANTHROPIC", "OPENAI", "OLLAMA",
    ]
    assert all(item["method"] in {"GET", "HEAD"} for item in plan.values())
    assert all(item["status"] in {"NOT_CONFIGURED", "NOT_PROBED", "READY"} for item in plan.values())
    assert all(item.get("follow_redirects") is False for item in plan.values())
    rendered = json.dumps(plan).lower()
    for unsafe in ("/chat/", "/completions", "/embeddings"):
        assert unsafe not in rendered


def test_provider_probe_without_credentials_performs_no_network_and_reports_all_nine(tmp_path: Path) -> None:
    output = tmp_path / "provider.json"
    result = subprocess.run(
        [os.fspath(Path(os.sys.executable)), str(DEPLOY / "probe-providers.py"), "--output", str(output)],
        env={key: value for key, value in os.environ.items() if not key.endswith("_API_KEY") and key != "OLLAMA_BASE_URL"},
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    receipt = json.loads(output.read_text())
    assert len(receipt["providers"]) == 9
    assert receipt["generation_requests"] == 0
    assert "credential" not in result.stdout.lower()


def test_verify_preflight_refuses_external_work_without_verified_backup() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        (root / "runtime").mkdir()
        result = subprocess.run(
            [str(_bash()), str(DEPLOY / "verify.sh"), "e" * 40],
            env=os.environ | {"ANVIL_DEPLOY_ROOT": _posix(root)},
            text=True,
            capture_output=True,
        )
        assert result.returncode != 0
        assert "verified C-21 database backup" in result.stderr
