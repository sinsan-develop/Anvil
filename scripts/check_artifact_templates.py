"""Validate G-04 canonical artifact templates without third-party packages."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Mapping


ARTIFACT_STATUSES = {"draft", "proposed", "approved", "superseded", "rejected"}
PACKAGE_STATUSES = {"READY", "ACTIVE", "TEST_REVIEW", "ACCEPTED", "REWORK", "BLOCKED", "CANCELLED"}
ARTIFACT_TYPES = {
    "work_instruction",
    "invocation_prompt",
    "completion_report",
    "test_report",
    "product_validation",
    "defect_assessment",
    "release_decision",
    "evidence_manifest",
}
VERIFICATION_FIELDS = {
    "matrix_revision",
    "assigned_verification_ids",
    "required_levels",
    "required_evidence",
    "tester_entry_conditions",
    "package_exit_conditions",
    "regression_suite",
    "fixture_ids",
    "environment",
    "immediate_stop_conditions",
    "evidence_manifest_required",
    "product_validation_criteria",
    "blocking_defect_policy",
    "release_decision_required",
}
RECONSTRUCTION_FIELDS = {
    "contract_version",
    "projection_fields",
    "output_shape",
    "canonicalization",
    "hash_algorithm",
}
TARGET_ALGORITHM_V1 = {
    "algorithm_version": "1.0.0",
    "row_format": "path<TAB>decimal_bytes<TAB>uppercase_sha256_without_prefix",
    "path_normalization": "repository-relative POSIX slash",
    "sort": "UTF-8 byte ordinal ascending by normalized path",
    "row_separator": "LF (0x0A)",
    "final_newline": False,
    "encoding": "UTF-8",
    "bom": False,
    "hash_algorithm": "SHA-256",
}
COMMON_FIELDS = {
    "artifact_id",
    "artifact_type",
    "project_id",
    "version",
    "artifact_status",
    "content_hash",
    "source_artifact_ids",
    "source_evidence_ids",
    "created_by",
    "created_at",
    "supersedes_artifact_id",
    "artifact_path",
}
TYPE_FIELDS = {
    "work_instruction": {
        "package_id", "package_status", "revision", "supersedes_work_instruction_id",
        "design_baseline_ref", "work_plan_ref", "approval_ref", "owner", "executor",
        "goal", "preconditions", "included_scope", "excluded_scope", "protected_scope",
        "allowed_paths", "forbidden_paths", "allowed_actions", "forbidden_actions",
        "rollback_boundary", "completion_conditions", "result_contract", "report_contract",
        "verification_contract", "reconstruction_contract",
    },
    "invocation_prompt": {
        "invocation_id", "work_instruction_ref", "approval_subject_hash", "execution_mode",
        "agent_role", "completion_report_template_ref", "report_path", "instruction",
    },
    "completion_report": {
        "package_id", "run_id", "delegation_id", "work_instruction_ref", "result_status",
        "actor", "target_hash", "delivered_hash", "git_before", "git_after",
        "changed_paths", "diff_summary", "actions", "commands", "tests", "evidence_refs",
        "evidence_manifest_ref", "missing", "carryover", "skipped", "blocked", "unverified",
        "assumptions", "unresolved", "decision_request", "checkpoint", "handoff", "rollback",
        "started_at", "finished_at",
    },
    "test_report": {
        "verification_revision", "design_baseline_ref", "work_instruction_ref", "target_hash",
        "delivered_hash", "evidence_manifest_hash", "environment", "tester", "entry_criteria",
        "verifications", "result_counts", "defects", "unverified_scope", "verdict",
        "judgment_reason", "action", "retest_scope",
    },
    "product_validation": {
        "product_validation_id", "acceptance_criterion_id", "target_hash", "delivered_hash",
        "environment", "procedure", "expected", "observed", "evidence_refs", "result",
        "validated_by", "validated_at",
    },
    "defect_assessment": {
        "defect_id", "summary", "target_hash", "severity", "blocking", "status", "owner",
        "verification_id", "source_clause", "reason", "reproduction", "evidence_refs", "impact",
        "action", "retest_scope", "retest_evidence_refs", "carryover_ref", "owner_decision",
    },
    "release_decision": {
        "release_decision_id", "target_hash", "delivered_hash", "evidence_manifest_hash",
        "product_validation_refs", "required_product_validations_complete", "blocking_defect_refs",
        "blocking_defect_count", "decision", "conditions", "proposed_by", "decided_by_human",
        "decided_at", "reason", "next_transition", "guard_result", "defer_risk",
        "reconsider_at", "carryover_item_ref",
    },
    "evidence_manifest": {
        "manifest_id", "design_baseline_ref", "work_plan_ref", "work_instruction_ref",
        "target_hash", "delivered_hash", "git_head", "git_status_before", "git_status_after",
        "image_digest", "db_migration_head", "db_migration_set_hash", "db_profile", "db_version",
        "config_hash", "policy_hash", "provider_routing_hash", "environment", "toolchain",
        "commands", "verifications", "actors", "acquisition_mode", "raw_checksums", "skipped",
        "blocked", "unverified", "started_at", "finished_at", "manifest_creator",
        "manifest_created_at", "signature", "delivered_target_comparison",
        "target_algorithm", "target_canonical_bytes",
    },
}


def canonical_json_bytes(value: Any) -> bytes:
    """Return Anvil canonical JSON bytes: sorted, compact UTF-8, no BOM or newline."""
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    """Hash a JSON value after removing the envelope's self-referential content hash."""
    material = dict(value) if isinstance(value, dict) else value
    if isinstance(material, dict):
        material.pop("content_hash", None)
    return "sha256:" + hashlib.sha256(canonical_json_bytes(material)).hexdigest().upper()


def _is_placeholder(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("__REQUIRED_") and value.endswith("__")


def _missing_fields(value: Mapping[str, Any], required: set[str], prefix: str = "") -> list[str]:
    return [f"{prefix}{field}: required" for field in sorted(required - set(value))]


def _validate_actor(value: Any, field: str, template_mode: bool) -> list[str]:
    if not isinstance(value, dict):
        return [f"{field}: actor object required"]
    errors = _missing_fields(value, {"actor_type", "actor_id"}, f"{field}.")
    actor_type = value.get("actor_type")
    if not (template_mode and _is_placeholder(actor_type)) and actor_type not in {"human", "agent", "service"}:
        errors.append(f"{field}.actor_type: invalid actor type")
    return errors


def validate_artifact(artifact: Mapping[str, Any], template_mode: bool = False) -> list[str]:
    """Validate one artifact's required fields, enums, and cross-field guards."""
    errors = _missing_fields(artifact, COMMON_FIELDS)
    artifact_type = artifact.get("artifact_type")
    if artifact_type not in ARTIFACT_TYPES:
        return errors + ["artifact_type: unsupported"]
    errors.extend(_missing_fields(artifact, TYPE_FIELDS[artifact_type]))

    status = artifact.get("artifact_status")
    if status not in ARTIFACT_STATUSES:
        errors.append("artifact_status: must use artifact enum, not Package status")
    if artifact.get("package_status") in ARTIFACT_STATUSES:
        errors.append("package_status: must use Package enum, not artifact status")
    if "package_status" in artifact and artifact.get("package_status") not in PACKAGE_STATUSES:
        errors.append("package_status: invalid Package status")
    errors.extend(_validate_actor(artifact.get("created_by"), "created_by", template_mode))

    if not template_mode:
        for field, value in artifact.items():
            if _is_placeholder(value):
                errors.append(f"{field}: unresolved placeholder")

    if artifact_type == "work_instruction":
        contract = artifact.get("verification_contract")
        if not isinstance(contract, dict):
            errors.append("verification_contract: object required")
        else:
            errors.extend(_missing_fields(contract, VERIFICATION_FIELDS, "verification_contract."))
            extra = set(contract) - VERIFICATION_FIELDS
            errors.extend(f"verification_contract.{field}: unsupported" for field in sorted(extra))
        reconstruction = artifact.get("reconstruction_contract")
        if not isinstance(reconstruction, dict):
            errors.append("reconstruction_contract: object required")
        else:
            errors.extend(_missing_fields(reconstruction, RECONSTRUCTION_FIELDS, "reconstruction_contract."))
            extra = set(reconstruction) - RECONSTRUCTION_FIELDS
            errors.extend(f"reconstruction_contract.{field}: unsupported" for field in sorted(extra))
            projection_fields = reconstruction.get("projection_fields")
            if not isinstance(projection_fields, list) or not projection_fields:
                errors.append("reconstruction_contract.projection_fields: non-empty list required")
            elif "content_hash" not in projection_fields:
                errors.append("reconstruction_contract.projection_fields: content_hash required")
            if reconstruction.get("output_shape") != "flat_json_object":
                errors.append("reconstruction_contract.output_shape: flat_json_object required")

    if artifact_type == "invocation_prompt":
        reference = artifact.get("work_instruction_ref")
        if not isinstance(reference, dict):
            errors.append("work_instruction_ref: object required")
        else:
            errors.extend(_missing_fields(reference, {"artifact_id", "content_hash"}, "work_instruction_ref."))
        forbidden_copies = {
            "goal", "preconditions", "included_scope", "excluded_scope", "protected_scope",
            "allowed_paths", "forbidden_paths", "completion_conditions", "forbidden_actions",
            "verification_contract",
        }
        for field in sorted(forbidden_copies & set(artifact)):
            errors.append(f"invocation_prompt_body_duplication:{field}")

    if artifact_type in {"completion_report", "test_report", "product_validation", "release_decision", "evidence_manifest"}:
        for field in ("target_hash", "delivered_hash"):
            if field not in artifact:
                continue
            if artifact.get(field) in {None, ""}:
                errors.append(f"{field}: required binding")

    if artifact_type == "defect_assessment":
        severity = artifact.get("severity")
        blocking = artifact.get("blocking")
        if severity == "CRITICAL" and blocking is not True:
            errors.append("critical_defect_must_block")
        if not (template_mode and _is_placeholder(severity)) and severity not in {"CRITICAL", "MAJOR", "MINOR"}:
            errors.append("severity: invalid")
        defect_status = artifact.get("status")
        allowed = {"OPEN", "ACCEPTED", "FIXING", "READY_FOR_RETEST", "CLOSED", "DEFERRED", "REJECTED"}
        if not (template_mode and _is_placeholder(defect_status)) and defect_status not in allowed:
            errors.append("status: invalid defect lifecycle state")

    if artifact_type == "release_decision":
        decision = artifact.get("decision")
        allowed_decisions = {"RELEASE", "REWORK", "DEFER", "REJECT"}
        if not (template_mode and _is_placeholder(decision)) and decision not in allowed_decisions:
            errors.append("decision: invalid; BLOCKED is a guard result, not a decision")
        if decision in allowed_decisions:
            actor = artifact.get("decided_by_human")
            if not isinstance(actor, dict) or actor.get("actor_type") != "human":
                errors.append("release_requires_authenticated_human")
        if decision == "RELEASE":
            if artifact.get("blocking_defect_count") != 0 or artifact.get("blocking_defect_refs"):
                errors.append("release_blocked_by_defect")
            if artifact.get("required_product_validations_complete") is not True:
                errors.append("release_requires_product_validation")
        if decision == "DEFER":
            for field in ("defer_risk", "reconsider_at", "carryover_item_ref"):
                if artifact.get(field) in {None, ""}:
                    errors.append(f"{field}: required for DEFER")

    if artifact_type == "evidence_manifest":
        target = artifact.get("target_hash")
        delivered = artifact.get("delivered_hash")
        if target and delivered and not _is_placeholder(target) and target != delivered:
            errors.append("delivered_target_comparison:EVIDENCE_TARGET_MISMATCH")
        if not template_mode and "target_algorithm" in artifact:
            errors.extend(validate_manifest_target(artifact))

    return sorted(set(errors))


def validate_evidence_reuse(manifest: Mapping[str, Any], expected: Mapping[str, Any]) -> list[str]:
    """Reject PASS evidence when any identity-bearing binding differs."""
    fields = {
        "target_hash", "environment", "git_head", "image_digest",
        "db_migration_set_hash", "provider_routing_hash",
    }
    return [
        f"EVIDENCE_TARGET_MISMATCH:{field}"
        for field in sorted(fields)
        if manifest.get(field) != expected.get(field)
    ]


def semantic_projection(work_instruction: Mapping[str, Any]) -> dict[str, Any]:
    """Project the complete execution meaning needed by a context-free session."""
    contract = work_instruction.get("reconstruction_contract")
    if not isinstance(contract, dict):
        raise ValueError("source WorkInstruction lacks reconstruction_contract")
    fields = contract.get("projection_fields")
    if not isinstance(fields, list) or not fields:
        raise ValueError("reconstruction_contract.projection_fields must be a non-empty list")
    if len(fields) != len(set(fields)):
        raise ValueError("reconstruction_contract.projection_fields contains duplicates")
    missing = [field for field in fields if field not in work_instruction]
    if missing:
        raise ValueError(f"projection fields missing from source: {missing}")
    if contract.get("output_shape") != "flat_json_object":
        raise ValueError("only flat_json_object output_shape is supported")
    return {field: work_instruction[field] for field in fields}


def canonical_target_bytes(raw_checksums: list[Mapping[str, Any]]) -> bytes:
    """Build deterministic target bytes from the manifest checksum rows only."""
    rows: list[tuple[bytes, str]] = []
    seen_paths: set[str] = set()
    for item in raw_checksums:
        path = item.get("path")
        byte_count = item.get("bytes")
        checksum = item.get("sha256")
        if not isinstance(path, str) or not path or "\\" in path or path.startswith("/"):
            raise ValueError("raw checksum path must be repository-relative POSIX")
        if path in seen_paths:
            raise ValueError(f"duplicate raw checksum path: {path}")
        if not isinstance(byte_count, int) or isinstance(byte_count, bool) or byte_count < 0:
            raise ValueError(f"invalid byte count for {path}")
        if not isinstance(checksum, str):
            raise ValueError(f"invalid SHA-256 for {path}")
        normalized_checksum = checksum.removeprefix("sha256:")
        if len(normalized_checksum) != 64 or any(character not in "0123456789ABCDEF" for character in normalized_checksum):
            raise ValueError(f"SHA-256 must be uppercase hex without prefix for {path}")
        seen_paths.add(path)
        row = f"{path}\t{byte_count}\t{normalized_checksum}"
        rows.append((path.encode("utf-8"), row))
    rows.sort(key=lambda item: item[0])
    return "\n".join(row for _, row in rows).encode("utf-8")


def canonical_target_sha256(raw_checksums: list[Mapping[str, Any]]) -> str:
    """Return the prefixed uppercase SHA-256 of canonical target bytes."""
    return "sha256:" + hashlib.sha256(canonical_target_bytes(raw_checksums)).hexdigest().upper()


def validate_manifest_target(manifest: Mapping[str, Any], root: Path | None = None) -> list[str]:
    """Recompute the target from raw checksums and optionally verify workspace bytes."""
    errors: list[str] = []
    if manifest.get("target_algorithm") != TARGET_ALGORITHM_V1:
        errors.append("target_algorithm: unsupported or incomplete")
    raw_checksums = manifest.get("raw_checksums")
    if not isinstance(raw_checksums, list):
        return errors + ["raw_checksums: list required"]
    try:
        target_bytes = canonical_target_bytes(raw_checksums)
        target_hash = canonical_target_sha256(raw_checksums)
    except ValueError as exc:
        return errors + [f"raw_checksums:{exc}"]
    if manifest.get("target_canonical_bytes") != len(target_bytes):
        errors.append("target_canonical_bytes: recomputed value mismatch")
    if manifest.get("target_hash") != target_hash:
        errors.append("target_hash: recomputed raw_checksums mismatch")
    if manifest.get("delivered_hash") != target_hash:
        errors.append("delivered_hash: recomputed raw_checksums mismatch")
    if root is not None:
        for item in raw_checksums:
            path = root / item["path"]
            try:
                content = path.read_bytes()
            except OSError as exc:
                errors.append(f"raw_checksum_file:{item['path']}:{exc}")
                continue
            if len(content) != item["bytes"]:
                errors.append(f"raw_checksum_bytes:{item['path']}")
            actual_hash = hashlib.sha256(content).hexdigest().upper()
            if actual_hash != item["sha256"]:
                errors.append(f"raw_checksum_sha256:{item['path']}")
    return sorted(errors)


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_template_set(root: Path) -> list[str]:
    """Validate catalog, Draft 2020-12 schema, and every registered template."""
    errors: list[str] = []
    catalog_path = root / "docs" / "templates" / "artifact-catalog.json"
    schema_path = root / "docs" / "templates" / "artifact-schema.json"
    try:
        catalog = _load_json(catalog_path)
        schema = _load_json(schema_path)
    except (OSError, json.JSONDecodeError) as exc:
        return [f"catalog_or_schema:{exc}"]
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        errors.append("schema:$schema must be Draft 2020-12")
    entries = catalog.get("templates", [])
    if len(entries) != 8:
        errors.append(f"catalog:expected 8 templates, got {len(entries)}")
    registered = {entry.get("artifact_type") for entry in entries}
    if registered != ARTIFACT_TYPES:
        errors.append("catalog:artifact type set mismatch")
    for entry in entries:
        relative_path = entry.get("artifact_path", "")
        path = root / relative_path
        try:
            raw = path.read_bytes()
            artifact = json.loads(raw.decode("utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            errors.append(f"{relative_path}:{exc}")
            continue
        if raw.startswith(b"\xef\xbb\xbf"):
            errors.append(f"{relative_path}:UTF-8 BOM forbidden")
        if b"\r\n" in raw:
            errors.append(f"{relative_path}:CRLF forbidden")
        if artifact.get("artifact_type") != entry.get("artifact_type"):
            errors.append(f"{relative_path}:catalog artifact_type mismatch")
        errors.extend(f"{relative_path}:{error}" for error in validate_artifact(artifact, template_mode=True))
    return sorted(errors)


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    root = Path(arguments[0]).resolve() if arguments else Path.cwd()
    errors = validate_template_set(root)
    if errors:
        for error in errors:
            print(error)
        return 1
    print("G-04 artifact contract: 8 templates validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
