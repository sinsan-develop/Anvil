"""Fail-closed verifier for the A-15 Artifact/section-49/API/UI trace bundle."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from typing import Any


SCHEMA_REL = "docs/architecture/a15/A-15_ARTIFACT_SCHEMA.json"
API_REL = "docs/architecture/a15/A-15_API_DRAFT.json"
MATRIX_REL = "docs/architecture/a15/A-15_FIELD_TRACE_MATRIX.json"
TRACE_REL = "docs/architecture/a15/A-15_ARTIFACT_STATE_API_UI_TRACE.md"
APPROVAL_REL = "docs/architecture/a15/A-15_USER_UX_APPROVAL_REQUEST.md"
CONTRACT_REL = "tests/fixtures/a15/canonical-trace-contract.json"
MUTATIONS_REL = "tests/fixtures/a15/trace-mutations.json"
TEST_REL = "tests/tooling/test_a15_artifact_state_api_ui_trace.py"
CHECKER_REL = "scripts/check_a15_artifact_state_api_ui_trace.py"
VALIDATION_REL = "docs/validation/A-15_ARTIFACT_STATE_API_UI_TRACE_VALIDATION.md"
MANIFEST_REL = "docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json"
COMPLETION_REL = "docs/completion_reports/A-15_COMPLETION_REPORT.md"
PREDECESSOR_REL = "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json"
PREDECESSOR_SHA = "910900E99464B00E362F1895BA55389550EF740DBE6177FB0A4E75D272A62C09"
WI_SHA = "B46E3D3A17C6050759A5EB22DF9D5B0F4484D9C59893CD0DA4A7483687077A1A"

EXACT_WRITE_PATHS = {
    TRACE_REL, SCHEMA_REL, API_REL, MATRIX_REL, APPROVAL_REL, CONTRACT_REL,
    MUTATIONS_REL, CHECKER_REL, TEST_REL, VALIDATION_REL, MANIFEST_REL,
    COMPLETION_REL,
}
RAW_PATHS = EXACT_WRITE_PATHS - {MANIFEST_REL}
REQUIRED_AGGREGATES = {
    "product_validations", "defects", "release_decisions", "apply_approvals",
    "deploy_approval_subjects", "design_intent_reviews", "worker_leases",
    "write_leases", "budget_reservations", "data_egress_profiles", "secret_refs",
    "evidence_manifests", "release_manifests", "deployment_runs", "monitoring_policies",
}
REQUIRED_DOMAINS = {
    "ProductValidation", "Defect", "ReleaseDecision", "ApplyDeployApproval", "DIR",
    "WorkerWriteFencing", "BudgetReservation", "DataEgressProfile", "SecretRef",
    "EvidenceManifest", "ReleaseManifest", "DeploymentRun", "Monitoring",
}
REQUIRED_TRACE_FIELDS = {
    "artifact_field", "source_kind", "canonical_source", "source_reference",
    "api_request_field", "api_response_field", "ui_surface", "ui_state",
    "permission", "evidence_or_av_id", "runtime_boundary",
}
MUTATION_ENVELOPE = {
    "actor_id", "actor_role", "Idempotency-Key", "If-Match",
    "expected_state_version", "target_hash", "permission_scope", "reason", "audit_event",
}
REQUIRED_ENDPOINTS = {
    "POST /api/projects/{id}/brainstorming-decision-sets",
    "POST /api/brainstorming-decision-sets/{id}:approve",
    "POST /api/projects/{id}/design-intent-reviews",
    "GET /api/design-intent-reviews/{id}",
    "POST /api/design-intent-reviews/{id}:report",
    "POST /api/design-intent-reviews/{id}:continue",
    "POST /api/product-validations",
    "POST /api/defects/{id}:accept",
    "POST /api/defects/{id}:ready-for-retest",
    "POST /api/defects/{id}:close",
    "POST /api/release-decisions",
    "POST /api/release-manifests",
    "POST /api/release-manifests/{id}:verify",
    "POST /api/deploy-approvals",
    "POST /api/deployments",
    "POST /api/deployments/{id}:rollback",
    "GET /api/projects/{id}/data-egress-profile",
    "POST /api/projects/{id}/data-egress-profile:revise",
    "POST /api/secrets/{id}:rotate",
    "POST /api/secrets/{id}:revoke",
    "GET /api/evidence-manifests/{id}",
    "GET /api/learning-sources/{id}/revocation-impact",
    "POST /api/learning-sources/{id}:revoke",
}
HUMAN_ENDPOINTS = {
    "POST /api/brainstorming-decision-sets/{id}:approve",
    "POST /api/design-intent-reviews/{id}:continue",
    "POST /api/release-decisions",
    "POST /api/deploy-approvals",
    "POST /api/projects/{id}/data-egress-profile:revise",
}


def dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("root must be an object")
    return value


def validate_schema(schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if schema.get("classification") != "STATIC_TRACE_CONTRACT_ONLY":
        errors.append("SCHEMA_CLASSIFICATION_MISMATCH")
    aggregates = schema.get("aggregates", {})
    if not isinstance(aggregates, dict) or not REQUIRED_AGGREGATES.issubset(aggregates):
        errors.append("AGGREGATE_SET_INCOMPLETE")
    for name in REQUIRED_AGGREGATES & set(aggregates if isinstance(aggregates, dict) else {}):
        item = aggregates[name]
        if not isinstance(item, dict) or not item.get("source") or not item.get("fields"):
            errors.append("AGGREGATE_SOURCE_OR_FIELDS_MISSING")
    try:
        dir_states = aggregates["design_intent_reviews"]["enums"]["status"]
    except (KeyError, TypeError):
        dir_states = None
    if dir_states != ["DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"]:
        errors.append("DIR_ENUM_MISMATCH")
    human = schema.get("human_decision_contract", {})
    if human.get("decision_status") != "PENDING_USER_DECISION" or human.get("approval_record_created") is not False:
        errors.append("HUMAN_DECISION_FORGED")
    if human.get("required_actor_type") != "authenticated_human" or human.get("agent_may_propose_only") is not True:
        errors.append("HUMAN_DECISION_GUARD_MISSING")
    if human.get("dir_status") != "NOT_REACHED":
        errors.append("DIR_PREMATURELY_CREATED")
    guards = schema.get("fail_closed_contract", {})
    required_guards = {
        "source_required", "source_kind_required", "canonical_write_from_ui_forbidden",
        "target_environment_binding_required", "cross_target_evidence_reuse_forbidden",
        "cross_environment_evidence_reuse_forbidden", "stale_fencing_write_forbidden",
        "human_decision_forgery_forbidden",
    }
    if any(guards.get(key) is not True for key in required_guards):
        errors.append("FAIL_CLOSED_GUARD_MISSING")
    runtime = schema.get("runtime_boundary", {})
    if runtime.get("actual_dir") != "NOT_REACHED" or any(
        runtime.get(key) != "NOT_EXECUTED"
        for key in ("actual_api", "actual_db", "actual_browser", "actual_provider", "actual_deployment")
    ):
        errors.append("RUNTIME_BOUNDARY_PROMOTION")
    return dedupe(errors)


def validate_api(api: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if api.get("runtime_boundary") != "DRAFT_ONLY / NOT_IMPLEMENTED / NOT_EXECUTED":
        errors.append("RUNTIME_BOUNDARY_PROMOTION")
    if api.get("base_path") != "/api" or api.get("same_origin_only") is not True:
        errors.append("SAME_ORIGIN_BOUNDARY_VIOLATION")
    if set(api.get("common_mutation_envelope", [])) != MUTATION_ENVELOPE:
        errors.append("MUTATION_ENVELOPE_MISMATCH")
    endpoints = api.get("endpoints", [])
    keyed = {
        str(item.get("method")) + " " + str(item.get("path")): item
        for item in endpoints if isinstance(item, dict)
    }
    if set(keyed) != REQUIRED_ENDPOINTS:
        errors.append("API_ENDPOINT_SET_MISMATCH")
    for key, item in keyed.items():
        path = str(item.get("path", ""))
        if not path.startswith("/api/") or "http://" in path or "https://" in path:
            errors.append("SAME_ORIGIN_BOUNDARY_VIOLATION")
        if not item.get("permission") or item.get("source") != "49.15":
            errors.append("API_PERMISSION_OR_SOURCE_MISSING")
        if key in HUMAN_ENDPOINTS and item.get("human_only") is not True:
            errors.append("HUMAN_ENDPOINT_GUARD_MISSING")
    approval = api.get("approval_guards", {})
    if approval.get("final_user_decision_status") != "PENDING_USER_DECISION" or approval.get("agent_decision_forbidden") is not True:
        errors.append("HUMAN_DECISION_FORGED")
    return dedupe(errors)


def validate_matrix(matrix: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if matrix.get("classification") != "STATIC_TRACE_CONTRACT_ONLY / NOT ACTUAL PASS":
        errors.append("TRACE_CLASSIFICATION_MISMATCH")
    predecessor = matrix.get("predecessor", {})
    if predecessor.get("path") != PREDECESSOR_REL or predecessor.get("sha256") != PREDECESSOR_SHA:
        errors.append("PREDECESSOR_BINDING_MISMATCH")
    domains = set(matrix.get("required_domains", []))
    rows = matrix.get("rows", [])
    row_domains = {row.get("domain") for row in rows if isinstance(row, dict)}
    if domains != REQUIRED_DOMAINS or row_domains != REQUIRED_DOMAINS or len(rows) != len(REQUIRED_DOMAINS):
        errors.append("TRACE_DOMAIN_COVERAGE_MISMATCH")
    for row in rows:
        if not isinstance(row, dict):
            errors.append("TRACE_ROW_INVALID"); continue
        if not REQUIRED_TRACE_FIELDS.issubset(row):
            errors.append("TRACE_FIELD_SET_INCOMPLETE")
        if not row.get("canonical_source") or not row.get("source_reference"):
            errors.append("TRACE_SOURCE_MISSING")
        if row.get("source_kind") not in {"canonical_aggregate", "projection"}:
            errors.append("TRACE_SOURCE_KIND_INVALID")
        if not str(row.get("source_reference", "")).startswith("Anvil_설계서_v2.md#49."):
            errors.append("TRACE_SOURCE_REFERENCE_INVALID")
        api_field = str(row.get("api_request_field", ""))
        if "http://" in api_field or "https://" in api_field or "localhost" in api_field or "127.0.0.1" in api_field:
            errors.append("SAME_ORIGIN_BOUNDARY_VIOLATION")
        if not row.get("permission") or not row.get("evidence_or_av_id") or not row.get("runtime_boundary"):
            errors.append("TRACE_PERMISSION_EVIDENCE_BOUNDARY_MISSING")
    invariants = "\n".join(matrix.get("invariants", []))
    for phrase in ("canonical aggregate", "target/environment", "PENDING_USER_DECISION", "does not create DIR-1"):
        if phrase not in invariants:
            errors.append("TRACE_INVARIANT_MISSING")
    runtime = matrix.get("runtime_boundary", {})
    if runtime.get("a15_actual_dir") != "NOT_REACHED" or any(
        runtime.get(key) != "NOT_EXECUTED"
        for key in ("a15_actual_browser", "a15_actual_api", "a15_actual_db", "a15_actual_provider", "a15_actual_deployment")
    ):
        errors.append("RUNTIME_BOUNDARY_PROMOTION")
    return dedupe(errors)


def validate_contract(root: Path, matrix: dict[str, Any]) -> list[str]:
    try:
        contract = load_json(root / CONTRACT_REL)
    except (OSError, json.JSONDecodeError, ValueError):
        return ["CANONICAL_FIXTURE_MISSING_OR_INVALID"]
    errors: list[str] = []
    if set(contract.get("required_domains", [])) != REQUIRED_DOMAINS:
        errors.append("CANONICAL_FIXTURE_DOMAIN_MISMATCH")
    if set(contract.get("required_trace_fields", [])) != REQUIRED_TRACE_FIELDS:
        errors.append("CANONICAL_FIXTURE_FIELD_MISMATCH")
    if contract.get("human_decision_status") != "PENDING_USER_DECISION" or contract.get("dir_status") != "NOT_REACHED":
        errors.append("CANONICAL_FIXTURE_DECISION_MISMATCH")
    if contract.get("runtime_classification") != matrix.get("classification"):
        errors.append("CANONICAL_FIXTURE_CLASSIFICATION_MISMATCH")
    return errors


def apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(document)
    target: Any = result
    parts = str(mutation["path"]).split(".")
    for part in parts[:-1]:
        target = target[int(part)] if isinstance(target, list) else target[part]
    key = parts[-1]
    if mutation["operation"] == "remove":
        target.pop(int(key)) if isinstance(target, list) else target.pop(key, None)
    elif isinstance(target, list):
        target[int(key)] = mutation["value"]
    else:
        target[key] = mutation["value"]
    return result


def validate_hostile_fixtures(root: Path, schema: dict[str, Any], api: dict[str, Any], matrix: dict[str, Any]) -> list[str]:
    try:
        fixture = load_json(root / MUTATIONS_REL)
    except (OSError, json.JSONDecodeError, ValueError):
        return ["HOSTILE_FIXTURE_MISSING_OR_INVALID"]
    validators = {"schema": validate_schema, "api": validate_api, "matrix": validate_matrix}
    documents = {"schema": schema, "api": api, "matrix": matrix}
    errors: list[str] = []
    seen: set[str] = set()
    for mutation in fixture.get("mutations", []):
        mutation_id = mutation.get("id")
        document_name = mutation.get("document")
        expected = mutation.get("expected_error")
        if not mutation_id or mutation_id in seen or document_name not in documents or not expected:
            errors.append("HOSTILE_FIXTURE_INVALID"); continue
        seen.add(mutation_id)
        try:
            observed = validators[document_name](apply_mutation(documents[document_name], mutation))
        except (KeyError, IndexError, TypeError, ValueError):
            errors.append("HOSTILE_FIXTURE_INVALID"); continue
        if expected not in observed:
            errors.append("HOSTILE_MUTATION_NOT_REJECTED")
    if len(seen) < 12:
        errors.append("HOSTILE_FIXTURE_COVERAGE_INSUFFICIENT")
    return dedupe(errors)


def validate_documents(root: Path) -> list[str]:
    requirements = {
        TRACE_REL: ["STATIC_TRACE_CONTRACT_ONLY", "PENDING_USER_DECISION", "NOT_REACHED", "FIXTURE / NOT ACTUAL PASS"],
        APPROVAL_REL: ["PENDING_USER_DECISION", "승인 | 보완 | 반려", "NOT ACTUAL PASS", "DIR-1: `NOT_REACHED`"],
        VALIDATION_REL: ["AV-UI-015", "AV-STAT-041", "AV-STAT-042", "NOT_EXECUTED"],
        COMPLETION_REL: ["COMPLETED_PENDING_INDEPENDENT_TEST", "USER_UX_APPROVAL_PENDING", "NOT_REACHED", "rollback"],
    }
    errors: list[str] = []
    for rel, tokens in requirements.items():
        try:
            text = (root / rel).read_text(encoding="utf-8")
        except OSError:
            errors.append("DOCUMENT_MISSING"); continue
        if any(token not in text for token in tokens):
            errors.append("DOCUMENT_CONTRACT_MISMATCH")
    try:
        approval = (root / APPROVAL_REL).read_text(encoding="utf-8")
    except OSError:
        approval = ""
    if "USER_UX_APPROVED" in approval or "결정 상태: `APPROVED`" in approval:
        errors.append("HUMAN_DECISION_FORGED")
    return dedupe(errors)


def canonical_rows(raw: list[dict[str, Any]]) -> bytes:
    rows = [f"{item['path']}\t{item['bytes']}\t{item['sha256']}" for item in sorted(raw, key=lambda item: item["path"].encode("utf-8"))]
    return "\n".join(rows).encode("utf-8")


def validate_manifest_document(root: Path, manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if manifest.get("self_reference") is not False:
        errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    if set(manifest.get("exact_write_paths", [])) != EXACT_WRITE_PATHS:
        errors.append("EVIDENCE_EXACT_PATH_SET_MISMATCH")
    raw = manifest.get("raw_artifacts", [])
    if not isinstance(raw, list):
        return ["EVIDENCE_RAW_SET_INVALID"]
    paths: set[str] = set()
    content_bytes = 0
    for item in raw:
        rel = str(item.get("path", "")); path = root / rel
        if not rel or rel in paths:
            errors.append("EVIDENCE_RAW_PATH_INVALID"); continue
        paths.add(rel)
        if not path.is_file():
            errors.append("EVIDENCE_RAW_ARTIFACT_MISSING"); continue
        content_bytes += path.stat().st_size
        if item.get("bytes") != path.stat().st_size:
            errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != sha256_file(path):
            errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    if paths != RAW_PATHS:
        errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    try:
        canonical = canonical_rows(raw)
    except (KeyError, TypeError, AttributeError):
        return dedupe(errors + ["EVIDENCE_RAW_SET_INVALID"])
    target = hashlib.sha256(canonical).hexdigest().upper()
    if manifest.get("target_canonical_bytes") != len(canonical) or manifest.get("target_content_bytes") != content_bytes:
        errors.append("EVIDENCE_SIZE_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target or manifest.get("content_hash") != target:
        errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected = {
        "package_id": "A-15", "work_instruction_sha256": WI_SHA,
        "assigned_verification_ids": ["AV-UI-015", "AV-STAT-041", "AV-STAT-042"],
        "execution_classification": "STATIC_TRACE_CONTRACT_ONLY",
        "user_ux_approval_status": "PENDING_USER_DECISION", "actual_dir_status": "NOT_REACHED",
    }
    if any(manifest.get(key) != value for key, value in expected.items()):
        errors.append("EVIDENCE_QUALIFIER_MISMATCH")
    runtime = manifest.get("runtime_boundary", {})
    if any(runtime.get(key) != "NOT_EXECUTED" for key in ("actual_api", "actual_db", "actual_browser", "actual_provider", "actual_deployment")):
        errors.append("RUNTIME_BOUNDARY_PROMOTION")
    return dedupe(errors)


def validate_manifest(root: Path) -> list[str]:
    try:
        manifest = load_json(root / MANIFEST_REL)
    except (OSError, json.JSONDecodeError, ValueError):
        return ["EVIDENCE_MANIFEST_MISSING_OR_INVALID"]
    return validate_manifest_document(root, manifest)


def validate_bundle(root: Path, include_manifest: bool = True, include_fixtures: bool = True) -> list[str]:
    try:
        schema = load_json(root / SCHEMA_REL)
        api = load_json(root / API_REL)
        matrix = load_json(root / MATRIX_REL)
    except (OSError, json.JSONDecodeError, ValueError):
        return ["TRACE_BUNDLE_MISSING_OR_INVALID"]
    errors = validate_schema(schema) + validate_api(api) + validate_matrix(matrix)
    errors += validate_contract(root, matrix) + validate_documents(root)
    predecessor = root / PREDECESSOR_REL
    if not predecessor.is_file() or sha256_file(predecessor) != PREDECESSOR_SHA:
        errors.append("PREDECESSOR_INTEGRITY_MISMATCH")
    if include_fixtures:
        errors += validate_hostile_fixtures(root, schema, api, matrix)
    if include_manifest:
        errors += validate_manifest(root)
    return dedupe(errors)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--without-manifest", action="store_true")
    parser.add_argument("--verify-fixtures", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    if args.verify_fixtures:
        try:
            schema = load_json(root / SCHEMA_REL); api = load_json(root / API_REL); matrix = load_json(root / MATRIX_REL)
        except (OSError, json.JSONDecodeError, ValueError):
            print("hostile fixtures FAIL: TRACE_BUNDLE_MISSING_OR_INVALID"); return 1
        errors = validate_hostile_fixtures(root, schema, api, matrix)
        print("hostile fixtures rejected" if not errors else "hostile fixtures FAIL: " + ",".join(errors))
        return 0 if not errors else 1
    errors = validate_bundle(root, include_manifest=not args.without_manifest)
    print(f"A-15 artifact/state/API/UI trace: {'PASS' if not errors else 'FAIL'} ({len(errors)} errors)")
    if errors:
        print("\n".join(errors))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
