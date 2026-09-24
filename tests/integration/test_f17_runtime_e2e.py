"""Opt-in F17 real HTTP+PostgreSQL acceptance, run twice on distinct QA DBs.

Main owns process/container lifecycle. This test never creates/drops a database,
role, container, or network. It inserts only synthetic rows in a guarded QA DB.
Run phase `create`, restart API with the returned run ID in its test-session
allowlist, then run phase `events` against the SAME DB and API target.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlparse
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy" / "wsl"))
from f17_validation import ObservedCriterion, build_validation_records, validate_target
from packages.api.task_bootstrap import canonical_task_authority_hash

H = lambda char: "sha256:" + char * 64


def _live_config(env: dict[str, str]) -> dict[str, str]:
    required = ("ANVIL_F17_QA_DSN", "ANVIL_F17_API_URL", "ANVIL_F17_ENVIRONMENT",
                "ANVIL_F17_PROJECT_ID", "ANVIL_F17_TARGET_HASH", "ANVIL_F17_GIT_SHA",
                "ANVIL_F17_IMAGE_DIGEST", "ANVIL_F17_SESSION_TOKEN", "ANVIL_F17_PHASE", "ANVIL_F17_APP_ROLE", "ANVIL_F17_CA_FILE")
    if env.get("ANVIL_F17_ALLOW_LIVE") != "1" or any(not env.get(key) for key in required):
        raise ValueError("explicit F17 live QA configuration required")
    try:
        db = make_url(env["ANVIL_F17_QA_DSN"])
    except Exception:
        raise ValueError("invalid F17 QA DSN") from None
    if (db.host not in {"127.0.0.1", "localhost"} or db.database is None
            or not db.database.startswith("anvil_f17_") or db.database == "anvil"):
        raise ValueError("F17 dedicated loopback QA database required")
    api = urlparse(env["ANVIL_F17_API_URL"])
    expected_ports = {"f17-pg15": 5432, "f17-pg18": 32769}
    if env["ANVIL_F17_ENVIRONMENT"] not in expected_ports:
        raise ValueError("unknown F17 environment")
    expected_db_port = expected_ports[env["ANVIL_F17_ENVIRONMENT"]]
    if db.port != expected_db_port:
        raise ValueError("F17 environment database port mismatch")
    if api.scheme != "https" or api.hostname != "127.0.0.1" or api.port != 8443 or api.username or api.password or api.path not in {"", "/"}:
        raise ValueError("F17 HTTPS loopback proxy required")
    if not Path(env["ANVIL_F17_CA_FILE"]).is_file():
        raise ValueError("F17 temporary CA file required")
    if env["ANVIL_F17_PHASE"] not in {"create", "events"}:
        raise ValueError("unknown F17 phase")
    role = env["ANVIL_F17_APP_ROLE"]
    if db.username != role:
        raise ValueError("F17 QA DSN must authenticate as the runtime app role")
    if env["ANVIL_F17_ENVIRONMENT"] == "f17-pg15" and not role.startswith("anvil_f17_"):
        raise ValueError("dedicated F17 PG15 runtime role required")
    if env["ANVIL_F17_ENVIRONMENT"] == "f17-pg18" and role != "anvil_app":
        raise ValueError("isolated F17 PG18 runtime role required")
    return env


def _seed_lineage(connection, suffix: str, project: str) -> tuple[str, str]:
    ids = {key: f"f17-{key}-{suffix}" for key in ("spec", "baseline", "work", "iteration", "wi", "plan")}
    now = datetime.now(timezone.utc)
    connection.execute(text("INSERT INTO design_artifacts (artifact_id,revision,content_hash,actor_type,actor_id,artifact_type,source_refs) VALUES (:id,1,:hash,'AGENT','f17-qa','DESIGN_SPECIFICATION',CAST('[]' AS json))"), {"id": ids["spec"], "hash": H("9")})
    connection.execute(text("INSERT INTO design_baselines (artifact_id,revision,content_hash,actor_type,actor_id,specification_id,root_human_approval_id,approval_mode,scope,project_id) VALUES (:id,1,:hash,'HUMAN','f17-synthetic',:spec,:approval,'HUMAN_APPROVED',CAST('{}' AS json),:project)"), {"id": ids["baseline"], "hash": H("a"), "spec": ids["spec"], "approval": f"approval-spec-{suffix}", "project": project})
    connection.execute(text("INSERT INTO work_plans (artifact_id,revision,content_hash,design_baseline_id,design_baseline_hash,scope) VALUES (:id,1,:hash,:baseline,:hash_baseline,CAST('{}' AS json))"), {"id": ids["work"], "hash": H("b"), "baseline": ids["baseline"], "hash_baseline": H("a")})
    connection.execute(text("INSERT INTO iteration_plans (artifact_id,revision,content_hash,work_plan_id,work_plan_hash,sequence) VALUES (:id,1,:hash,:work,:hash_work,1)"), {"id": ids["iteration"], "hash": H("c"), "work": ids["work"], "hash_work": H("b")})
    connection.execute(text("INSERT INTO work_instructions (artifact_id,revision,content_hash,iteration_plan_id,iteration_plan_hash,allowed_paths,allowed_actions,completion_conditions) VALUES (:id,1,:hash,:iteration,:hash_iteration,CAST('[]' AS json),CAST('[]' AS json),CAST('[]' AS json))"), {"id": ids["wi"], "hash": H("d"), "iteration": ids["iteration"], "hash_iteration": H("c")})
    connection.execute(text("INSERT INTO execution_plans (plan_id,plan_hash,source_work_instruction_id,source_work_instruction_hash,baseline_analysis_hash,impact_analysis_hash,status) VALUES (:id,:hash,:wi,:hash_wi,:analysis,:impact,'APPROVED')"), {"id": ids["plan"], "hash": H("e"), "wi": ids["wi"], "hash_wi": H("d"), "analysis": H("f"), "impact": H("1")})
    for kind, key, digest in (("DESIGN_SPECIFICATION", "spec", H("9")), ("WORK_PLAN", "work", H("b")), ("WORK_INSTRUCTION", "wi", H("d")), ("EXECUTION_PLAN", "plan", H("e"))):
        connection.execute(text("INSERT INTO approval_records (approval_id,approval_type,subject_id,subject_hash,approved_by,authenticated_human,approved_at,expires_at,status) VALUES (:id,:kind,:subject,:digest,'f17-synthetic',true,:now,:expires,'ACTIVE')"), {"id": f"approval-{key}-{suffix}", "kind": kind, "subject": ids[key], "digest": digest, "now": now, "expires": now + timedelta(hours=1)})
    return ids["wi"], ids["plan"]


def _session(client: httpx.Client, token: str) -> str:
    response = client.post("/auth/session", headers={"authorization": f"Bearer {token}", "origin": str(client.base_url).rstrip("/")})
    assert response.status_code == 201, response.status_code
    assert token not in response.text
    return response.json()["data"]["csrf_token"]


def _headers(client: httpx.Client, csrf: str, target: str, version: int, suffix: str) -> dict[str, str]:
    return {"origin": str(client.base_url).rstrip("/"), "x-csrf-token": csrf,
            "idempotency-key": f"f17-{suffix}", "if-match": f'"{version}"',
            "x-target-hash": target, "x-permission-scope": "tasks:write",
            "x-reason": "F17 isolated synthetic QA"}


def _evidence_hash(payload: object) -> str:
    return "sha256:" + sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _assert_runtime_role(connection, expected_role: str) -> None:
    actual_role, database_create, schema_create = connection.execute(text(
        "SELECT current_user, "
        "has_database_privilege(current_user,current_database(),'CREATE'), "
        "has_schema_privilege(current_user,'public','CREATE')"
    )).one()
    assert actual_role == expected_role and not database_create and not schema_create


def _first_sse_event_id(client: httpx.Client, run_id: str) -> str:
    # Bounded streaming also works if a future host keeps the connection open.
    with client.stream("GET", f"/api/runs/{run_id}/events") as response:
        assert response.status_code == 200, response.status_code
        for line in response.iter_lines():
            if line.startswith("id: "):
                return line[4:]
    raise AssertionError("SSE response had no event ID")


@pytest.mark.parametrize("environment", ["f17-pg15", "f17-pg18"])
def test_real_task_run_events_against_guarded_qa(environment):
    if os.environ.get("ANVIL_F17_ALLOW_LIVE") != "1":
        pytest.skip("F17 live QA is Main-owned opt-in")
    config = _live_config(dict(os.environ))
    if config["ANVIL_F17_ENVIRONMENT"] != environment:
        pytest.skip("other F17 environment")
    target = validate_target(git_sha=config["ANVIL_F17_GIT_SHA"],
        published_sha=config["ANVIL_F17_GIT_SHA"], clean=True,
        image_digest=config["ANVIL_F17_IMAGE_DIGEST"],
        migration_head="0016_operations_recovery", environment_id=environment,
        target_hash=config["ANVIL_F17_TARGET_HASH"])
    stage = "connection"
    engine = None
    try:
        engine = create_engine(config["ANVIL_F17_QA_DSN"], pool_pre_ping=True)
        stage = "database preflight"
        with engine.connect() as connection:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0016_operations_recovery"
            server_version = connection.execute(text("SHOW server_version_num")).scalar_one()
            assert str(server_version).startswith("15" if environment == "f17-pg15" else "18")
            assert connection.execute(text("SELECT extversion FROM pg_extension WHERE extname='vector'")).scalar_one()
            assert connection.execute(text("SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector")).scalar_one() == 1.0
            _assert_runtime_role(connection, config["ANVIL_F17_APP_ROLE"])
            role = connection.execute(text("SELECT rolsuper,rolcreatedb,rolcreaterole,rolcanlogin FROM pg_roles WHERE rolname=:role"), {"role": config["ANVIL_F17_APP_ROLE"]}).one()
            assert tuple(role) == (False, False, False, True)
        with httpx.Client(base_url=config["ANVIL_F17_API_URL"], verify=config["ANVIL_F17_CA_FILE"], timeout=20) as client:
            stage = "same-origin readiness"
            ready = client.get("/api/health/ready")
            assert ready.status_code == 200, ready.status_code
            assert ready.json()["migration_head"] == "0016_operations_recovery"
            stage = "synthetic session"
            csrf = _session(client, config["ANVIL_F17_SESSION_TOKEN"])
            if config["ANVIL_F17_PHASE"] == "create":
                stage = "task and run creation"
                suffix = uuid4().hex[:12]
                project = config["ANVIL_F17_PROJECT_ID"]
                repository = f"f17-repo-{suffix}"
                with engine.begin() as connection:
                    connection.execute(text("INSERT INTO project_repositories (project_id,repository_id,target_environment,active,version) VALUES (:project,:repository,:environment,true,1)"), {"project": project, "repository": repository, "environment": environment})
                authority = canonical_task_authority_hash(project_id=project, repository_id=repository, target_environment=environment, mapping_version=1)
                response = client.post(f"/api/projects/{project}/tasks", headers=_headers(client, csrf, authority, 0, suffix), json={"objective": "F17 synthetic task", "targetEnvironment": environment, "conversationMessage": "F17 QA only"})
                assert response.status_code == 201, response.status_code
                task_id = response.json()["taskId"]
                read = client.get(f"/api/tasks/{task_id}")
                assert read.status_code == 200, read.status_code
                with engine.begin() as connection:
                    task = connection.execute(text("SELECT task_id,project_id,repository_id,status,version FROM tasks WHERE task_id=:id"), {"id": task_id}).mappings().one()
                    assert task["project_id"] == project and task["repository_id"] == repository and task["status"] == "DRAFT"
                    wi, plan = _seed_lineage(connection, suffix, project)
                    connection.execute(text("UPDATE tasks SET status='CONFIRMED', version=3 WHERE task_id=:id AND project_id=:project"), {"id": task_id, "project": project})
                run = client.post(f"/api/tasks/{task_id}/runs", headers=_headers(client, csrf, H("e"), 3, "run-" + suffix), json={"workInstructionId": wi, "executionPlanId": plan, "expectedStateVersion": 3, "priorRunId": None, "resumeCheckpointId": None})
                assert run.status_code == 202, run.status_code
                run_id = run.json()["runId"]
                with engine.connect() as connection:
                    db_run = connection.execute(text("SELECT run_id,task_id FROM runs WHERE run_id=:id"), {"id": run_id}).mappings().one()
                    events = connection.execute(text("SELECT event_id,event_type FROM run_events WHERE run_id=:id ORDER BY sequence_no"), {"id": run_id}).mappings().all()
                assert db_run["task_id"] == task_id
                assert [row["event_type"] for row in events] == ["TASK_CONFIRMED"]
                evidence = _evidence_hash({"target_hash": target.target_hash, "git": target.git_sha, "image": target.image_digest, "migration": target.migration_head, "db_version": server_version, "environment": environment, "task": task_id, "run": run_id, "events": [dict(row) for row in events], "http": [ready.status_code, response.status_code, read.status_code, run.status_code]})
                criterion = "AV-OPS-015" if environment == "f17-pg15" else "AV-OPS-025"
                records = build_validation_records(target, [ObservedCriterion(criterion, target.target_hash, environment, "PASS", "http+database", evidence, "Task/run HTTP and PostgreSQL rows agree")])
                assert len(records) == 1
                print(json.dumps({"environment": environment, "phase": "create", "task_id": task_id, "run_id": run_id, "evidence_hash": evidence}, sort_keys=True))
            else:
                stage = "SSE after restart"
                run_id = config.get("ANVIL_F17_RUN_ID")
                if not run_id:
                    raise ValueError("restart API with this exact run ID in ANVIL_TEST_SESSION_RUN_IDS")
                streamed_event_id = _first_sse_event_id(client, run_id)
                with engine.connect() as connection:
                    event = connection.execute(text("SELECT event_id,event_type FROM run_events WHERE run_id=:id ORDER BY sequence_no LIMIT 1"), {"id": run_id}).mappings().one()
                assert event["event_id"] == streamed_event_id
                evidence = _evidence_hash({"target_hash": target.target_hash, "git": target.git_sha, "image": target.image_digest, "migration": target.migration_head, "db_version": server_version, "environment": environment, "run": run_id, "event": dict(event), "http": [ready.status_code, 200]})
                criterion = "AV-OPS-015" if environment == "f17-pg15" else "AV-OPS-025"
                records = build_validation_records(target, [ObservedCriterion(criterion, target.target_hash, environment, "PASS", "http+database", evidence, "SSE event ID matched PostgreSQL after API restart")])
                assert len(records) == 1
                print(json.dumps({"environment": environment, "phase": "events", "run_id": run_id, "evidence_hash": evidence}, sort_keys=True))
    except Exception:
        raise AssertionError(f"F17 live QA failed at {stage}; details redacted") from None
    finally:
        if engine is not None:
            engine.dispose()


def test_live_config_rejects_shared_or_remote_database(tmp_path):
    ca = tmp_path / "f17-test-ca.pem"
    ca.write_text("synthetic placeholder; live TLS validates the actual CA", encoding="utf-8")
    base = dict(ANVIL_F17_ALLOW_LIVE="1", ANVIL_F17_QA_DSN="postgresql+psycopg://anvil_f17_qa:p@127.0.0.1:5432/anvil_f17_qa",
        ANVIL_F17_API_URL="https://127.0.0.1:8443", ANVIL_F17_ENVIRONMENT="f17-pg15", ANVIL_F17_PROJECT_ID="project-f17",
        ANVIL_F17_TARGET_HASH=H("a"), ANVIL_F17_GIT_SHA="b" * 40, ANVIL_F17_IMAGE_DIGEST=H("c"), ANVIL_F17_SESSION_TOKEN="synthetic", ANVIL_F17_PHASE="create", ANVIL_F17_APP_ROLE="anvil_f17_qa", ANVIL_F17_CA_FILE=str(ca))
    assert _live_config(base) is base
    for dsn in ("postgresql://u:p@127.0.0.1:5432/anvil", "postgresql://u:p@remote.invalid/anvil_f17_qa"):
        with pytest.raises(ValueError):
            _live_config({**base, "ANVIL_F17_QA_DSN": dsn})
    with pytest.raises(ValueError):
        _live_config({**base, "ANVIL_F17_QA_DSN": "postgresql://u:p@127.0.0.1:32769/anvil_f17_qa"})
    with pytest.raises(ValueError):
        _live_config({**base, "ANVIL_F17_ENVIRONMENT": "f17-pg18", "ANVIL_F17_QA_DSN": "postgresql://u:p@127.0.0.1:5432/anvil_f17_qa"})
    pg18 = {**base, "ANVIL_F17_ENVIRONMENT": "f17-pg18", "ANVIL_F17_APP_ROLE": "anvil_app",
            "ANVIL_F17_QA_DSN": "postgresql://anvil_app:p@127.0.0.1:32769/anvil_f17_qa", "ANVIL_F17_API_URL": "https://127.0.0.1:8443"}
    assert _live_config(pg18) is pg18
    with pytest.raises(ValueError):
        _live_config({**base, "ANVIL_F17_API_URL": "http://127.0.0.1:8301"})
    with pytest.raises(ValueError):
        _live_config({**base, "ANVIL_F17_CA_FILE": str(tmp_path / "missing.pem")})
    with pytest.raises(ValueError):
        _live_config({**base, "ANVIL_F17_QA_DSN": "postgresql://anvil_admin:p@127.0.0.1:5432/anvil_f17_qa"})


def test_runtime_role_check_rejects_admin_or_create_grant():
    class FakeConnection:
        def __init__(self, result):
            self.result = result

        def execute(self, statement):
            assert "current_user" in str(statement)
            return self

        def one(self):
            return self.result

    _assert_runtime_role(FakeConnection(("anvil_f17_app", False, False)), "anvil_f17_app")
    for result in (("anvil_admin", False, False), ("anvil_f17_app", True, False), ("anvil_f17_app", False, True)):
        with pytest.raises(AssertionError):
            _assert_runtime_role(FakeConnection(result), "anvil_f17_app")


def test_https_synthetic_session_uses_normal_secure_cookie_jar():
    def issue(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth/session":
            return httpx.Response(201, json={"data": {"csrf_token": "synthetic-csrf"}},
                headers={"set-cookie": "anvil_session=synthetic-session; Path=/; Secure; HttpOnly; SameSite=Strict"})
        assert request.headers.get("cookie") == "anvil_session=synthetic-session"
        return httpx.Response(200)
    with httpx.Client(base_url="https://127.0.0.1:8443", transport=httpx.MockTransport(issue)) as client:
        assert _session(client, "synthetic-bootstrap") == "synthetic-csrf"
        assert "cookie" not in client.headers
        assert client.get("/api/health/ready").status_code == 200
