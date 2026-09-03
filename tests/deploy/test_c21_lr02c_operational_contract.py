from __future__ import annotations

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


def test_backup_receipt_proves_dump_restore_listability_and_redacts_dsn() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _executable(fakebin, "pg_dump", 'target="${@: -1}"; printf "portable-backup" > "${target#--file=}"\n')
        _executable(fakebin, "pg_restore", '[[ "$1" == "--list" ]] && printf "TABLE public tasks\\n"\n')
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": "postgresql://secret-user:secret-pass@shared-db/anvil",
            "ANVIL_RELEASE_COMMIT": "a" * 40,
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


def test_backup_failure_never_writes_success_receipt() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        fakebin = root / "fakebin"
        fakebin.mkdir()
        _executable(fakebin, "pg_dump", "exit 17\n")
        env = os.environ | {
            "ANVIL_DEPLOY_ROOT": _posix(root),
            "ANVIL_DATABASE_URL": "postgresql://secret.invalid/anvil",
            "ANVIL_RELEASE_COMMIT": "b" * 40,
            "PATH": _posix(fakebin) + os.pathsep + os.environ.get("PATH", ""),
        }
        result = subprocess.run([str(_bash()), str(DEPLOY / "backup-c21-db.sh")], env=env, text=True, capture_output=True)
        assert result.returncode != 0
        assert not (root / "evidence" / "c21-db-backup.json").exists()


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
