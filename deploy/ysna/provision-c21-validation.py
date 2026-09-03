#!/usr/bin/env python3
"""Fail-closed C-21 production validation authority provisioning.

This is deliberately not a general Task confirmation API.  It creates one
release-bound authority lineage and confirms only the API-created DRAFT/v1
Task named by the operator.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from typing import Any, Mapping


_SHA = re.compile(r"[0-9a-f]{40}\Z")
_HASH = re.compile(r"sha256:[0-9a-f]{64}\Z")
APPROVAL_TYPES = (
    "DESIGN_SPECIFICATION",
    "WORK_PLAN",
    "WORK_INSTRUCTION",
    "EXECUTION_PLAN",
)

CONFIRM_TASK_SQL = """
UPDATE tasks
SET status='CONFIRMED', version=2
WHERE task_id=%s AND project_id=%s AND repository_id=%s
  AND target_environment=%s AND repository_mapping_version=1
  AND status='DRAFT' AND version=1
RETURNING task_id, status, version
""".strip()


def _canonical_hash(value: object) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return "sha256:" + sha256(raw).hexdigest()


def _identifier(prefix: str, short: str) -> str:
    clean = re.sub(r"[^a-z0-9-]+", "-", prefix.lower()).strip("-")
    if not clean or len(clean) > 100:
        raise ValueError("authority identifier prefix is invalid")
    return f"{clean}-{short}"


def build_authority_plan(release_commit: str, project_prefix: str, repository_prefix: str, environment_id: str) -> dict[str, Any]:
    if not _SHA.fullmatch(release_commit):
        raise ValueError("release commit is invalid")
    if not environment_id or environment_id != environment_id.strip() or len(environment_id) > 128:
        raise ValueError("environment id is invalid")
    short = release_commit[:12]
    project_id = _identifier(project_prefix, short)
    repository_id = _identifier(repository_prefix, short)
    artifact_ids = {
        "design_specification": f"c21-design-spec-{short}",
        "design_baseline": f"c21-design-baseline-{short}",
        "work_plan": f"c21-work-plan-{short}",
        "iteration_plan": f"c21-iteration-plan-{short}",
        "work_instruction": f"c21-work-instruction-{short}",
        "execution_plan": f"c21-execution-plan-{short}",
    }
    hashes = {
        name: _canonical_hash({
            "artifact": name,
            "artifact_id": artifact_id,
            "environment_id": environment_id,
            "project_id": project_id,
            "release_commit": release_commit,
            "repository_id": repository_id,
        })
        for name, artifact_id in artifact_ids.items()
    }
    approval_subjects = {
        "DESIGN_SPECIFICATION": {"subject_id": artifact_ids["design_specification"], "subject_hash": hashes["design_specification"]},
        "WORK_PLAN": {"subject_id": artifact_ids["work_plan"], "subject_hash": hashes["work_plan"]},
        "WORK_INSTRUCTION": {"subject_id": artifact_ids["work_instruction"], "subject_hash": hashes["work_instruction"]},
        "EXECUTION_PLAN": {"subject_id": artifact_ids["execution_plan"], "subject_hash": hashes["execution_plan"]},
    }
    task_authority_hash = _canonical_hash({
        "mappingVersion": 1,
        "projectId": project_id,
        "repositoryId": repository_id,
        "targetEnvironment": environment_id,
    })
    return {
        "release_commit": release_commit,
        "project_id": project_id,
        "repository_id": repository_id,
        "environment_id": environment_id,
        "artifact_ids": artifact_ids,
        "hashes": hashes,
        "task_authority_hash": task_authority_hash,
        "approval_subjects": approval_subjects,
    }


def _parse_time(value: object, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"approval {field} is invalid")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"approval {field} is invalid") from error
    if parsed.tzinfo is None:
        raise ValueError(f"approval {field} is invalid")
    return parsed.astimezone(timezone.utc)


def validate_approval_receipt(receipt: Mapping[str, Any], plan: Mapping[str, Any], *, now: str | None = None) -> dict[str, Any]:
    try:
        if receipt.get("authenticated_human") is not True or receipt.get("status") != "ACTIVE":
            raise ValueError
        approved_by = receipt["approved_by"]
        if not isinstance(approved_by, str) or not approved_by.strip() or len(approved_by) > 128:
            raise ValueError
        approved_at = _parse_time(receipt["approved_at"], "approved_at")
        expires_at = _parse_time(receipt["expires_at"], "expires_at")
        current = _parse_time(now, "now") if now else datetime.now(timezone.utc)
        if not approved_at < expires_at or current >= expires_at:
            raise ValueError
        subjects = receipt["subjects"]
        if set(subjects) != set(APPROVAL_TYPES):
            raise ValueError
        normalized: dict[str, Any] = {}
        for approval_type in APPROVAL_TYPES:
            value = subjects[approval_type]
            expected = plan["approval_subjects"][approval_type]
            if (
                not isinstance(value.get("approval_id"), str)
                or not value["approval_id"].strip()
                or len(value["approval_id"]) > 128
                or value.get("subject_id") != expected["subject_id"]
                or value.get("subject_hash") != expected["subject_hash"]
            ):
                raise ValueError
            normalized[approval_type] = dict(value)
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("approval receipt does not match release-bound authority") from error
    return {
        "approved_by": approved_by,
        "approved_at": approved_at,
        "expires_at": expires_at,
        "subjects": normalized,
    }


def _assert_existing(cursor: Any, table: str, key_column: str, key: str, expected: Mapping[str, Any]) -> None:
    columns = list(expected)
    cursor.execute(
        f"SELECT {','.join(columns)} FROM {table} WHERE {key_column}=%s",  # identifiers are static constants
        (key,),
    )
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError(f"existing {table} payload mismatch")
    actual = dict(zip(columns, row, strict=True))
    for column, value in tuple(actual.items()):
        expected_value = expected[column]
        if isinstance(value, (dict, list)) and isinstance(expected_value, str):
            try:
                expected_value = json.loads(expected_value)
            except json.JSONDecodeError:
                pass
        if value != expected_value:
            raise RuntimeError(f"existing {table} payload mismatch")


def _insert_exact(cursor: Any, table: str, key_column: str, values: Mapping[str, Any]) -> str:
    columns = list(values)
    placeholders = ",".join(["%s"] * len(columns))
    cursor.execute(
        f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders}) ON CONFLICT ({key_column}) DO NOTHING",
        tuple(values[column] for column in columns),
    )
    inserted = cursor.rowcount == 1
    _assert_existing(cursor, table, key_column, str(values[key_column]), values)
    return "CREATED" if inserted else "REPLAYED"


def prepare_authority(connection: Any, plan: Mapping[str, Any], approval: Mapping[str, Any]) -> dict[str, str]:
    ids = plan["artifact_ids"]
    hashes = plan["hashes"]
    project_id = plan["project_id"]
    repository_id = plan["repository_id"]
    environment_id = plan["environment_id"]
    results: dict[str, str] = {}
    with connection.transaction():
        cursor = connection.cursor()
        cursor.execute("SELECT version_num FROM alembic_version")
        if cursor.fetchone() != ("0013_task_bootstrap_authority",):
            raise RuntimeError("migration head mismatch")
        results["project_repository"] = _insert_exact(cursor, "project_repositories", "project_id", {
            "project_id": project_id, "repository_id": repository_id,
            "target_environment": environment_id, "active": True, "version": 1,
        })
        results["design_specification"] = _insert_exact(cursor, "design_artifacts", "artifact_id", {
            "artifact_id": ids["design_specification"], "revision": 1,
            "content_hash": hashes["design_specification"], "actor_type": "HUMAN",
            "actor_id": approval["approved_by"], "artifact_type": "DESIGN_SPECIFICATION",
            "source_refs": json.dumps({"release_commit": plan["release_commit"]}, separators=(",", ":")),
        })
        design_approval = approval["subjects"]["DESIGN_SPECIFICATION"]
        for approval_type in APPROVAL_TYPES:
            subject = approval["subjects"][approval_type]
            results[f"approval_{approval_type.lower()}"] = _insert_exact(cursor, "approval_records", "approval_id", {
                "approval_id": subject["approval_id"], "approval_type": approval_type,
                "subject_id": subject["subject_id"], "subject_hash": subject["subject_hash"],
                "approved_by": approval["approved_by"], "authenticated_human": True,
                "approved_at": approval["approved_at"], "expires_at": approval["expires_at"], "status": "ACTIVE",
            })
        results["design_baseline"] = _insert_exact(cursor, "design_baselines", "artifact_id", {
            "artifact_id": ids["design_baseline"], "revision": 1,
            "content_hash": hashes["design_baseline"], "actor_type": "HUMAN",
            "actor_id": approval["approved_by"], "specification_id": ids["design_specification"],
            "root_human_approval_id": design_approval["approval_id"], "parent_baseline_id": None,
            "approval_mode": "HUMAN_CONFIRMED", "scope": json.dumps({"project_id": project_id}, separators=(",", ":")),
            "project_id": project_id,
        })
        results["work_plan"] = _insert_exact(cursor, "work_plans", "artifact_id", {
            "artifact_id": ids["work_plan"], "revision": 1, "content_hash": hashes["work_plan"],
            "design_baseline_id": ids["design_baseline"], "design_baseline_hash": hashes["design_baseline"],
            "scope": json.dumps({"purpose": "C-21 production validation"}, separators=(",", ":")),
        })
        results["iteration_plan"] = _insert_exact(cursor, "iteration_plans", "artifact_id", {
            "artifact_id": ids["iteration_plan"], "revision": 1, "content_hash": hashes["iteration_plan"],
            "work_plan_id": ids["work_plan"], "work_plan_hash": hashes["work_plan"], "sequence": 1,
        })
        results["work_instruction"] = _insert_exact(cursor, "work_instructions", "artifact_id", {
            "artifact_id": ids["work_instruction"], "revision": 1, "content_hash": hashes["work_instruction"],
            "iteration_plan_id": ids["iteration_plan"], "iteration_plan_hash": hashes["iteration_plan"],
            "allowed_paths": json.dumps([], separators=(",", ":")),
            "allowed_actions": json.dumps(["VALIDATE"], separators=(",", ":")),
            "completion_conditions": json.dumps(["TASK_CONFIRMED_EVENT_SEQ1"], separators=(",", ":")),
        })
        results["execution_plan"] = _insert_exact(cursor, "execution_plans", "plan_id", {
            "plan_id": ids["execution_plan"], "plan_hash": hashes["execution_plan"],
            "source_work_instruction_id": ids["work_instruction"],
            "source_work_instruction_hash": hashes["work_instruction"],
            "baseline_analysis_hash": _canonical_hash({"release_commit": plan["release_commit"], "kind": "baseline"}),
            "impact_analysis_hash": _canonical_hash({"release_commit": plan["release_commit"], "kind": "impact"}),
            "status": "APPROVED",
        })
    return results


def confirm_task(connection: Any, plan: Mapping[str, Any], approval: Mapping[str, Any], task_id: str) -> dict[str, Any]:
    if not task_id or task_id != task_id.strip() or len(task_id) > 128:
        raise ValueError("task id is invalid")
    with connection.transaction():
        cursor = connection.cursor()
        for approval_type in APPROVAL_TYPES:
            subject = approval["subjects"][approval_type]
            cursor.execute(
                "SELECT count(*) FROM approval_records WHERE approval_id=%s AND approval_type=%s "
                "AND subject_id=%s AND subject_hash=%s AND authenticated_human=true AND status='ACTIVE' "
                "AND expires_at>CURRENT_TIMESTAMP",
                (subject["approval_id"], approval_type, subject["subject_id"], subject["subject_hash"]),
            )
            if cursor.fetchone() != (1,):
                raise RuntimeError("approval binding is missing or expired")
        cursor.execute(CONFIRM_TASK_SQL, (
            task_id, plan["project_id"], plan["repository_id"], plan["environment_id"],
        ))
        row = cursor.fetchone()
        if cursor.rowcount != 1 or row is None:
            raise RuntimeError("Task DRAFT/v1 confirmation CAS did not affect exactly one row")
    return {"task_id": str(row[0]), "status": str(row[1]), "version": int(row[2])}


def telegram_status(connection: Any, command_id: str) -> dict[str, Any]:
    if not command_id or command_id != command_id.strip() or len(command_id) > 256:
        raise ValueError("Telegram command id is invalid")
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM telegram_webhook_updates WHERE command_id=%s", (command_id,))
        update_count = int(cursor.fetchone()[0])
        cursor.execute(
            "SELECT outcome FROM telegram_webhook_audits WHERE command_id=%s ORDER BY occurred_at ASC",
            (command_id,),
        )
        outcomes = [str(row[0]) for row in cursor.fetchall()]
    return {"command_id": command_id, "update_count": update_count, "audit_count": len(outcomes), "outcomes": outcomes}


def _load_json_0600(path: Path) -> Mapping[str, Any]:
    mode = path.stat().st_mode & 0o777
    if mode not in (0o600, 0o400):
        raise RuntimeError("approval receipt must be mode 0600 or stricter")
    return json.loads(path.read_text(encoding="utf-8"))


def _write_receipt(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f".tmp.{os.getpid()}")
    temporary.write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("plan", "prepare", "confirm", "telegram-status"))
    parser.add_argument("--release", default=os.environ.get("ANVIL_RELEASE_COMMIT"))
    parser.add_argument("--project-prefix", default=os.environ.get("ANVIL_C21_PROJECT_PREFIX", "c21-validation-project"))
    parser.add_argument("--repository-prefix", default=os.environ.get("ANVIL_C21_REPOSITORY_PREFIX", "c21-validation-repository"))
    parser.add_argument("--environment", default=os.environ.get("ANVIL_TEST_SESSION_ENVIRONMENT_ID", "ysna-production"))
    parser.add_argument("--approval", default=os.environ.get("ANVIL_C21_APPROVAL_RECEIPT_FILE"))
    parser.add_argument("--task-id", default=os.environ.get("ANVIL_C21_TASK_ID"))
    parser.add_argument("--telegram-command-id", default=os.environ.get("ANVIL_C21_TELEGRAM_COMMAND_ID"))
    parser.add_argument("--output", default=os.environ.get("ANVIL_C21_PROVISION_RECEIPT", "c21-provision.json"))
    args = parser.parse_args()
    plan = build_authority_plan(args.release or "", args.project_prefix, args.repository_prefix, args.environment)
    if args.action == "plan":
        _write_receipt(Path(args.output), {"status": "PLAN", **plan, "secret_values": "omitted"})
        return 0
    if args.action != "telegram-status" and not args.approval:
        raise RuntimeError("approval receipt file is required")
    approval = validate_approval_receipt(_load_json_0600(Path(args.approval)), plan) if args.approval else None
    dsn = os.environ.get("ANVIL_DATABASE_URL")
    if not dsn:
        raise RuntimeError("ANVIL_DATABASE_URL is required")
    import psycopg

    with psycopg.connect(dsn) as connection:
        if args.action == "prepare":
            result: Mapping[str, Any] = {"artifacts": prepare_authority(connection, plan, approval)}  # type: ignore[arg-type]
        elif args.action == "confirm":
            result = confirm_task(connection, plan, approval, args.task_id or "")  # type: ignore[arg-type]
        else:
            result = telegram_status(connection, args.telegram_command_id or "")
    _write_receipt(Path(args.output), {
        "status": {"prepare": "PREPARED", "confirm": "TASK_CONFIRMED", "telegram-status": "TELEGRAM_STATUS"}[args.action],
        "release_commit": plan["release_commit"], "project_id": plan["project_id"],
        "repository_id": plan["repository_id"], "environment_id": plan["environment_id"],
        "authority_hash": _canonical_hash(plan), "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(), "secret_values": "omitted",
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
