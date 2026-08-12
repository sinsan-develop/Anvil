from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

try:
    from scripts.evidence_portability import portable_hash, portable_row_matches
except ModuleNotFoundError:  # direct `python scripts/check_*.py`
    from evidence_portability import portable_hash, portable_row_matches


CATALOG_REL = "docs/architecture/a11/A-11_OPERATIONS_MONITORING_CATALOG.json"
MANIFEST_REL = "docs/evidence/manifests/A-11_EVIDENCE_MANIFEST.json"
RAW_PATHS = {
    CATALOG_REL,
    "docs/architecture/a11/A-11_OPERATIONS_OVERVIEW.md",
    "docs/architecture/a11/A-11_QUEUE_WORKER_LEASE.md",
    "docs/architecture/a11/A-11_PROVIDER_ALERT.md",
    "docs/architecture/a11/A-11_BUDGET_DEPLOYMENT.md",
    "docs/architecture/a11/A-11_AUDIT_DETAILS.md",
    "docs/architecture/a11/A-11_OPERATIONS_STATIC_RENDER.svg",
    "docs/architecture/a11/A-11_QUEUE_ALERT_STATIC_RENDER.svg",
    "docs/architecture/a11/A-11_BUDGET_DEPLOYMENT_STATIC_RENDER.svg",
    "scripts/check_a11_operations_monitoring.py",
    "tests/tooling/test_a11_operations_monitoring.py",
    "tests/fixtures/a11/canonical-contract.json",
    "tests/fixtures/a11/mutation-catalog.json",
    "docs/validation/A-11_OPERATIONS_MONITORING_VALIDATION.md",
    "docs/completion_reports/A-11_COMPLETION_REPORT.md",
}
BUDGET_SEQUENCE = ["FORECAST", "RESERVED", "PROVIDER_REQUESTED", "FINAL_USAGE_RECORDED", "RECONCILED", "REMAINDER_RELEASED"]
DEPLOYMENT_SEQUENCE = ["PENDING", "APPROVED", "DEPLOYING", "SMOKE_TEST", "MONITORING", "RELEASED", "ROLLBACK_REQUIRED", "ROLLING_BACK", "ROLLED_BACK", "BLOCKED"]
REQUIRED_TRUE = {
    "anomaly_contract": {"system_detector_required": "MANUAL_ONLY_ANOMALY_PROMOTION_FORBIDDEN", "detector_evidence_required": "SYSTEM_DETECTOR_EVIDENCE_REQUIRED", "cause_required": "ANOMALY_CAUSE_REQUIRED", "impact_required": "ANOMALY_IMPACT_REQUIRED", "next_action_required": "ANOMALY_NEXT_ACTION_REQUIRED", "deep_link_required": "ANOMALY_DEEP_LINK_REQUIRED", "manual_only_promotion_forbidden": "MANUAL_ONLY_ANOMALY_PROMOTION_FORBIDDEN"},
    "health_contract": {"observed_at_required": "HEALTH_OBSERVED_AT_REQUIRED", "stale_threshold_required": "HEALTH_STALE_THRESHOLD_REQUIRED", "stale_signal_is_healthy_forbidden": "STALE_HEALTHY_SIGNAL_FORBIDDEN"},
    "alert_contract": {"dedupe_key_required": "ALERT_DEDUPE_KEY_REQUIRED", "acknowledge_is_not_resolve": "ALERT_ACK_RESOLVE_COLLAPSE_FORBIDDEN", "resolve_evidence_required": "ALERT_RESOLVE_EVIDENCE_REQUIRED", "detector_rule_revision_required": "ALERT_DETECTOR_EVIDENCE_REQUIRED"},
    "queue_contract": {"priority_dependency_visible": "QUEUE_PRIORITY_DEPENDENCY_REQUIRED", "attempt_max_visible": "QUEUE_ATTEMPT_MAX_REQUIRED", "retry_backoff_visible": "QUEUE_RETRY_BACKOFF_REQUIRED", "stale_fencing_rejected": "STALE_FENCING_REJECT_REQUIRED", "max_attempts_required": "INFINITE_RETRY_FORBIDDEN", "quarantine_required": "QUARANTINE_REQUIRED", "silent_poison_drop_forbidden": "SILENT_POISON_DROP_FORBIDDEN", "masked_token_reference_only": "MASKED_TOKEN_REFERENCE_REQUIRED"},
    "worker_lease_contract": {"worker_and_write_fencing_separated": "FENCING_LAYER_COLLAPSE_FORBIDDEN", "epoch_expiry_conflict_scope_visible": "LEASE_SCOPE_EPOCH_REQUIRED", "checkpoint_receipt_separated": "CHECKPOINT_RECEIPT_COLLAPSE_FORBIDDEN"},
    "budget_contract": {"reserve_before_provider_call": "BUDGET_RESERVE_ORDER_REQUIRED", "reservation_failure_blocks_provider_call": "BUDGET_RESERVATION_FAILURE_BYPASS", "unknown_usage_zero_forbidden": "UNKNOWN_USAGE_ZERO_FORBIDDEN", "quota_failed_is_not_success": "QUOTA_FAILURE_SUCCESS_PROMOTION_FORBIDDEN", "reconciliation_required": "BUDGET_RECONCILIATION_REQUIRED"},
    "provider_health_contract": {"provider_drift_visible": "PROVIDER_DRIFT_VISIBILITY_REQUIRED", "drift_blocks_unsafe_route": "PROVIDER_DRIFT_FAIL_CLOSED_REQUIRED", "health_staleness_visible": "PROVIDER_HEALTH_STALENESS_REQUIRED", "backend_health_visible": "BACKEND_HEALTH_VISIBILITY_REQUIRED"},
    "deployment_contract": {"smoke_alone_release_forbidden": "SMOKE_RELEASE_PROMOTION_FORBIDDEN", "monitoring_window_required": "DEPLOYMENT_MONITORING_WINDOW_REQUIRED", "critical_alert_zero_required": "DEPLOYMENT_CRITICAL_ALERT_GUARD_REQUIRED", "owner_confirmation_required": "DEPLOYMENT_OWNER_CONFIRMATION_REQUIRED", "automatic_data_loss_rollback_forbidden": "AUTOMATIC_DATA_LOSS_ROLLBACK_FORBIDDEN"},
    "enum_contract": {"independent_enums_required": "ENUM_COLLAPSE_FORBIDDEN", "health_alert_queue_run_deployment_separated": "ENUM_DOMAIN_COLLAPSE_FORBIDDEN", "force_success_control_forbidden": "FORCE_SUCCESS_CONTROL_FORBIDDEN"},
    "permission_contract": {"independent_permissions_required": "PERMISSION_COLLAPSE_FORBIDDEN", "observe_ack_resolve_deploy_rollback_separated": "OPERATION_PERMISSION_COLLAPSE_FORBIDDEN", "permission_expansion_forbidden": "PERMISSION_EXPANSION_FORBIDDEN"},
    "runtime_boundary": {"static_runtime_promotion_forbidden": "STATIC_RUNTIME_PROMOTION_FORBIDDEN"},
}
REQUIRED_FALSE = {"sensitive_data_contract": {"raw_fencing_token_visible": "RAW_FENCING_TOKEN_DISCLOSURE_FORBIDDEN", "secret_literal_visible": "SECRET_LITERAL_DISCLOSURE_FORBIDDEN", "raw_internal_endpoint_visible": "INTERNAL_ENDPOINT_DISCLOSURE_FORBIDDEN", "unbounded_log_visible": "UNBOUNDED_LOG_DISCLOSURE_FORBIDDEN"}}
DOCUMENTS = {
    "docs/architecture/a11/A-11_OPERATIONS_OVERVIEW.md": ["Operations Overview", "detector", "cause", "impact", "next action", "deep link"],
    "docs/architecture/a11/A-11_QUEUE_WORKER_LEASE.md": ["Queue", "stale", "fencing", "quarantine"],
    "docs/architecture/a11/A-11_PROVIDER_ALERT.md": ["Alert", "dedupe", "resolve", "drift"],
    "docs/architecture/a11/A-11_BUDGET_DEPLOYMENT.md": ["RESERVED", "RECONCILED", "MONITORING", "Owner"],
    "docs/architecture/a11/A-11_AUDIT_DETAILS.md": ["Audit", "masked", "permission"],
}
RENDERS = {
    "docs/architecture/a11/A-11_OPERATIONS_STATIC_RENDER.svg": "operations-overview,provider-backend-health",
    "docs/architecture/a11/A-11_QUEUE_ALERT_STATIC_RENDER.svg": "queue,worker-lease,alert-center,audit-details-drawer",
    "docs/architecture/a11/A-11_BUDGET_DEPLOYMENT_STATIC_RENDER.svg": "budget-quota,deployment-monitoring",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if catalog.get("package_id") != "A-11" or catalog.get("execution_classification") != "STATIC_ONLY" or catalog.get("package_verdict") != "STATIC_CONTRACT_PASS" or catalog.get("runtime_status") != "RUNTIME_DEFERRED / NOT_EXECUTED" or catalog.get("runtime_owner") != "F-13":
        errors.append("STATIC_CONTRACT_RUNTIME_BOUNDARY_MISMATCH")
    if catalog.get("surfaces") != ["operations-overview", "queue", "worker-lease", "provider-backend-health", "alert-center", "budget-quota", "deployment-monitoring", "audit-details-drawer"]:
        errors.append("OPERATIONS_SURFACE_CATALOG_MISMATCH")
    for section, checks in REQUIRED_TRUE.items():
        values = catalog.get(section, {})
        for field, code in checks.items():
            if values.get(field) is not True:
                errors.append(code)
    for section, checks in REQUIRED_FALSE.items():
        values = catalog.get(section, {})
        for field, code in checks.items():
            if values.get(field) is not False:
                errors.append(code)
    if catalog.get("health_contract", {}).get("states") != ["HEALTHY", "LATE", "EXPIRED", "UNKNOWN"]:
        errors.append("HEALTH_ENUM_MISMATCH")
    if catalog.get("alert_contract", {}).get("states") != ["open", "acknowledged", "resolved"]:
        errors.append("ALERT_ENUM_MISMATCH")
    if catalog.get("worker_lease_contract", {}).get("heartbeat_states") != ["HEALTHY", "LATE", "EXPIRED"] or catalog.get("worker_lease_contract", {}).get("drain_states") != ["requested", "draining", "drained"]:
        errors.append("WORKER_LEASE_ENUM_MISMATCH")
    if catalog.get("budget_contract", {}).get("sequence") != BUDGET_SEQUENCE:
        errors.append("BUDGET_SEQUENCE_MISMATCH")
    if catalog.get("deployment_contract", {}).get("sequence") != DEPLOYMENT_SEQUENCE:
        errors.append("DEPLOYMENT_SEQUENCE_MISMATCH")
    runtime = catalog.get("runtime_boundary", {})
    if any(runtime.get(key) != "NOT_EXECUTED" for key in ["actual_operations_status", "actual_api_status", "actual_db_status", "actual_event_status", "actual_sse_status", "actual_browser_status", "actual_network_status", "actual_deploy_status", "actual_dir_status"]):
        errors.append("ACTUAL_RUNTIME_PROMOTION_FORBIDDEN")
    contracts = catalog.get("verification_contracts")
    expected_contract = {"assigned_id": "AV-OPS-002", "level": "L4", "method": "FI", "evidence": "E-SHOT", "severity": "MAJOR", "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "runtime_owner": "F-13", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED"}
    if not isinstance(contracts, list) or len(contracts) != 1 or any(contracts[0].get(key) != value for key, value in expected_contract.items()):
        errors.append("VERIFICATION_CONTRACT_MISMATCH")
    return _dedupe(errors)


def validate_predecessors(root: Path) -> list[str]:
    try:
        catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["CATALOG_MISSING_OR_INVALID"]
    bindings = catalog.get("predecessor_bindings", [])
    if not isinstance(bindings, list) or [item.get("package_id") for item in bindings] != [f"A-{number:02d}" for number in range(1, 11)]:
        return ["PREDECESSOR_BINDING_SET_MISMATCH"]
    errors: list[str] = []
    for binding in bindings:
        path = root / str(binding.get("path", ""))
        relative = str(binding.get("path", ""))
        if not path.is_file() or binding.get("sha256") != portable_hash(root, relative):
            errors.append("PREDECESSOR_BINDING_MISMATCH")
    return _dedupe(errors)


def validate_documents(root: Path) -> list[str]:
    errors: list[str] = []
    for rel, required in DOCUMENTS.items():
        try:
            text = (root / rel).read_text(encoding="utf-8")
        except OSError:
            errors.append("FOCUSED_DOCUMENT_MISSING")
            continue
        if any(token not in text for token in required):
            errors.append("FOCUSED_DOCUMENT_SEMANTIC_BINDING_MISMATCH")
    return _dedupe(errors)


def validate_renders(root: Path) -> list[str]:
    allowed = {"#0B1220", "#142033", "#1B2A42", "#F7F9FC", "#B8C4D8", "#60738F", "#7DB4FF", "#F8D66D", "#5EE3A1", "#FF7B86"}
    errors: list[str] = []
    for rel, surfaces in RENDERS.items():
        try:
            text = (root / rel).read_text(encoding="utf-8")
            ET.fromstring(text)
        except (OSError, ET.ParseError):
            errors.append("STATIC_RENDER_MISSING_OR_INVALID")
            continue
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-surface-ids="{surfaces}"', "STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "NOT_EXECUTED"]
        if any(token not in text for token in required):
            errors.append("STATIC_RENDER_SEMANTIC_BINDING_MISMATCH")
        if {match.upper() for match in re.findall(r"#[0-9A-Fa-f]{6}\\b", text)} - allowed:
            errors.append("STATIC_RENDER_RAW_COLOR_BYPASS")
    return _dedupe(errors)


def _apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(document); target: Any = result
    parts = str(mutation["path"]).split(".")
    for part in parts[:-1]: target = target[int(part)] if isinstance(target, list) else target[part]
    key = parts[-1]
    if mutation["operation"] == "remove": target.pop(int(key)) if isinstance(target, list) else target.pop(key, None)
    elif isinstance(target, list): target[int(key)] = mutation.get("value")
    else: target[key] = mutation.get("value")
    return result


def validate_mutation_fixture(catalog: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    errors: list[str] = []; seen: set[str] = set()
    for mutation in fixture.get("mutations", []):
        mutation_id, expected = mutation.get("mutation_id"), mutation.get("expected_error_code")
        if not mutation_id or mutation_id in seen or not expected:
            errors.append("MUTATION_FIXTURE_INVALID"); continue
        seen.add(mutation_id)
        try: actual = validate_catalog(_apply_mutation(catalog, mutation))
        except (KeyError, IndexError, TypeError, ValueError): errors.append("MUTATION_FIXTURE_INVALID"); continue
        if expected not in actual: errors.append("MUTATION_EXPECTED_REASON_NOT_OBSERVED")
    return _dedupe(errors)


def _projection(raw: list[dict[str, Any]]) -> bytes:
    return json.dumps([{"path": str(item.get("path", "")), "sha256": str(item.get("sha256", ""))} for item in sorted(raw, key=lambda item: str(item.get("path", "")))], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def manifest_target(raw: list[dict[str, Any]]) -> str:
    return hashlib.sha256(_projection(raw)).hexdigest().upper()


def _tracked_clean(root: Path, relative: str) -> bool:
    tracked = subprocess.run(
        ["git", "ls-files", "--error-unmatch", "--", relative],
        cwd=root,
        capture_output=True,
        check=False,
    )
    dirty = subprocess.run(
        ["git", "status", "--porcelain=v1", "--", relative],
        cwd=root,
        capture_output=True,
        check=False,
    )
    return tracked.returncode == 0 and dirty.returncode == 0 and not dirty.stdout.strip()


def _successor_rows(root: Path) -> dict[str, dict[str, Any]]:
    predecessor = portable_hash(root, MANIFEST_REL, prefer_legacy=False)
    rows: dict[str, dict[str, Any]] = {}
    for registry_path in sorted((root / "docs/evidence/manifests").glob("A-14_A11_SUCCESSOR_*.json")):
        relative = registry_path.relative_to(root).as_posix()
        if not _tracked_clean(root, relative):
            continue
        try:
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        successor = registry.get("a11_successor_projection", {})
        if (
            registry.get("artifact_type") == "a11_successor_registry"
            and registry.get("self_reference") is False
            and successor.get("predecessor_manifest_sha256") == predecessor
        ):
            rows.update(
                {
                    str(row.get("path")): row
                    for row in successor.get("live_raw_checksums", [])
                    if isinstance(row, dict) and row.get("path") in RAW_PATHS
                }
            )
    return rows


def validate_evidence_manifest(root: Path, manifest: dict[str, Any]) -> list[str]:
    raw = manifest.get("raw_artifacts", [])
    if not isinstance(raw, list) or not raw: return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    errors: list[str] = []; paths: set[str] = set(); content_bytes = 0
    successor_rows = _successor_rows(root)
    if manifest.get("self_reference") is not False: errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    for item in raw:
        rel = str(item.get("path", "")); path = root / rel
        if not rel or rel in paths: errors.append("EVIDENCE_RAW_PATH_INVALID"); continue
        paths.add(rel)
        if not path.is_file(): errors.append("EVIDENCE_RAW_ARTIFACT_MISSING"); continue
        successor = successor_rows.get(rel)
        successor_valid = successor and portable_row_matches(
            root, rel, successor.get("bytes"), successor.get("sha256")
        )
        content_bytes += int(item.get("bytes", 0)) if successor_valid else path.stat().st_size
        if item.get("bytes") != path.stat().st_size and not successor_valid: errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != sha256_file(path) and not successor_valid: errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    if paths != RAW_PATHS: errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    projection = _projection(raw); target = manifest_target(raw)
    if manifest.get("target_canonical_bytes") != len(projection): errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    if manifest.get("target_content_bytes") != content_bytes: errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target: errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected = {"package_id": "A-11", "work_instruction_sha256": "CDDBF40709CCE174F79EBDF64408783AEFAC4F0F471238782A2A5637BF9C65F0", "assigned_verification_ids": ["AV-OPS-002"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED"}
    if any(manifest.get(key) != value for key, value in expected.items()): errors.append("EVIDENCE_RUNTIME_QUALIFIER_MISMATCH")
    return _dedupe(errors)


def validate_bundle(root: Path, require_manifest: bool = True) -> list[str]:
    try: catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): return ["CATALOG_MISSING_OR_INVALID"]
    errors = validate_catalog(catalog) + validate_predecessors(root) + validate_documents(root) + validate_renders(root)
    if require_manifest:
        try: manifest = json.loads((root / MANIFEST_REL).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError): errors.append("EVIDENCE_MANIFEST_MISSING_OR_INVALID")
        else: errors += validate_evidence_manifest(root, manifest)
    return _dedupe(errors)


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", type=Path, default=Path.cwd()); parser.add_argument("--json", action="store_true"); parser.add_argument("--without-manifest", action="store_true")
    args = parser.parse_args(); errors = validate_bundle(args.root.resolve(), require_manifest=not args.without_manifest)
    payload = {"status": "PASS" if not errors else "FAIL", "package_id": "A-11", "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-11 operations monitoring contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
