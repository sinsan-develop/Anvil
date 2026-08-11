#!/usr/bin/env python3
"""Fail-closed validator for the A-03 static onboarding contract."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any


CATALOG_REL = Path("docs/architecture/a03/A-03_ONBOARDING_CATALOG.json")
A02_REL = Path("docs/architecture/a02/A-02_TOKEN_CATALOG.json")
MANIFEST_REL = Path("docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json")
DOCUMENTS = {
    "PROJECT_DASHBOARD": Path("docs/architecture/a03/A-03_PROJECT_DASHBOARD.md"),
    "PROJECT_REGISTER": Path("docs/architecture/a03/A-03_PROJECT_REGISTRATION.md"),
    "REPOSITORY_ONBOARDING": Path("docs/architecture/a03/A-03_REPOSITORY_ONBOARDING.md"),
}
RENDERS = {
    "PROJECT_DASHBOARD": Path("docs/architecture/a03/A-03_DASHBOARD_STATIC_RENDER.svg"),
    "PROJECT_REGISTER|REPOSITORY_ONBOARDING": Path("docs/architecture/a03/A-03_ONBOARDING_STATIC_RENDER.svg"),
    "ONBOARDING_REVIEW|PROJECT_DETAIL": Path("docs/architecture/a03/A-03_REPOSITORY_STATE_STATIC_RENDER.svg"),
}

EXPECTED_A02_SHA256 = "1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207"
EXPECTED_PRESENTATION = {
    "viewport": {"width_px": 1920, "height_px": 1080},
    "typography": {"body_form_px": 12, "small_description_px": 10, "auxiliary_px": 9, "sidebar_title_px": 14, "screen_title_px": 16},
    "layout": {"sidebar_expanded_px": 224, "sidebar_collapsed_px": 56, "header_px": 48, "context_drawer_px": 360, "context_drawer_mode": "ON_DEMAND", "base_padding_px": 16, "card_gap_px": 12},
    "explanation_interface": {"entry_point": "i-icon", "short_content_surface": "tooltip", "complex_content_surface": "popover", "required_content": ["reason", "next_action"], "persistent_explanation_box_allowed": False, "hover_only_allowed": False, "focus_path_required": True, "keyboard_access_required": True, "escape_closes": True, "focus_returns_to_trigger": True},
    "status_presentation": {"color_only_allowed": False, "required_parts": ["icon", "status_label", "short_description"], "explanation_binding": "i-tooltip-popover"},
    "semantic_colors": {"canvas": "#0B1220", "surface": "#142033", "surface-raised": "#1B2A42", "text-primary": "#F7F9FC", "text-muted": "#B8C4D8", "border": "#60738F", "interactive": "#7DB4FF", "focus": "#F8D66D", "success": "#5EE3A1", "warning": "#FFD166", "danger": "#FF7B86", "blocked": "#C4A7FF", "info": "#74D7FF", "neutral": "#B8C4D8"},
}
EXPECTED_SCREEN_FIELDS = {
    "PROJECT_DASHBOARD": {"project_filter", "environment_filter", "period_filter", "last_refreshed_at", "health_cards", "operations_cards", "success_rate", "next_actions", "critical_alerts"},
    "PROJECT_REGISTER": {"project_name", "project_slug", "description", "repository_source_type", "local_path", "remote_url", "default_branch"},
    "REPOSITORY_ONBOARDING": {"repository_kind", "canonical_root", "remote", "branch", "head_commit", "baseline_commit", "tracked_dirty", "tracked_dirty_count", "tracked_dirty_paths", "untracked_count", "untracked_paths", "manifests", "languages", "frameworks", "package_managers", "runtimes", "discovered_commands", "file_classification", "project_rules", "protected_paths", "allowed_environments", "secret_candidates_masked", "scan_step", "last_scan_at", "mutation_count", "uncertainty", "next_action"},
    "ONBOARDING_REVIEW": {"default_branch", "protected_paths", "project_rules", "allowed_environments", "baseline_id", "baseline_branch", "baseline_commit", "tracked_dirty", "tracked_dirty_count", "untracked_count", "baseline_created_at", "evidence_link", "isolation_status", "uncertainty", "next_action"},
    "PROJECT_DETAIL": {"overview", "repositories", "baselines", "rules", "toolchain", "environments", "members", "repository_status", "branch", "head_commit", "tracked_dirty", "tracked_dirty_count", "untracked_count", "last_scan_at", "read_only_rescan"},
}
EXPECTED_STATES = {
    "form": ["IDLE", "VALIDATING", "SUBMITTING"],
    "scan": ["QUEUED", "SCANNING_READ_ONLY", "REVIEW_REQUIRED", "READY_TO_REGISTER", "ERROR", "BLOCKED"],
    "repository": ["PENDING", "READY", "ERROR"],
    "baseline": ["CLEAN", "DIRTY", "CONFLICT", "NOT_CREATED", "UNKNOWN", "ISOLATION_DEGRADED"],
    "policy": ["LOADED", "CONFIRMATION_REQUIRED"],
    "health": ["NORMAL", "WARNING", "ERROR"],
}
EXPECTED_REASONS = ["ROOT_OUTSIDE_ALLOWED", "PATH_NOT_FOUND", "PERMISSION_DENIED", "NON_GIT_REVIEW_REQUIRED", "DIRTY_TRACKED_PRESENT", "UNTRACKED_PRESENT", "BASELINE_CONFLICT", "PROTECTED_PATH_POLICY_INVALID", "SCAN_MUTATION_DETECTED"]
EXPECTED_ERRORS = [
    {"http_status": 409, "code": "PROJECT_SLUG_EXISTS", "surface": "field:project_slug", "next_action": "choose_unique_slug"},
    {"http_status": 403, "code": "REPOSITORY_PATH_DENIED", "surface": "field:local_path", "next_action": "select_allowed_root_or_request_access"},
    {"http_status": 422, "code": "REPOSITORY_NOT_FOUND", "surface": "global", "next_action": "correct_repository_source"},
]
EXPECTED_PRESERVATION = {"scan_mode": "READ_ONLY", "source_write_allowed": False, "install_allowed": False, "format_allowed": False, "git_mutation_allowed": False, "automatic_cleanup_allowed": False, "tracked_dirty_and_untracked_separate": True, "user_owned_source_preserved": True, "unknown_fail_closed": True}
EXPECTED_PERMISSION = {"capabilities": ["PROJECT_VIEW", "PROJECT_MANAGE", "REPOSITORY_MANAGE"], "view_manage_separated": True, "unauthorized_actions_disabled": True, "disabled_reason_visible": True, "next_action_visible": True, "credential_display": "REFERENCE_OR_MASKED_ONLY", "unauthorized_local_full_path_visible": False}
EXPECTED_HEALTH = ["DATABASE", "QUEUE", "WORKER", "LLM_PROVIDERS", "EXECUTION_BACKENDS", "ARTIFACT_STORE"]
EXPECTED_OPERATIONS = ["RUNNING", "APPROVAL_PENDING", "BLOCKED", "REQUIRED_GATE_MISSING", "COST_OVERRUN", "BASELINE_CONFLICT"]
EXPECTED_MATRIX = [
    {"verification_id": "AV-UI-003", "level": "L7", "method": "MX", "evidence": "E-SHOT", "severity": "MAJOR"},
    {"verification_id": "AV-UI-004", "level": "L7", "method": "MX", "evidence": "E-DEC", "severity": "MAJOR"},
]
EXPECTED_VERIFICATION = {"assigned_verification_ids": ["AV-UI-003", "AV-UI-004"], "required_levels": ["L7"], "required_methods": ["MX"], "required_evidence": ["E-SHOT", "E-DEC", "E-ART", "E-MAN", "E-TEST"], "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "canonical_runtime_verdict": "RUNTIME_DEFERRED / NOT_EXECUTED", "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED", "runtime_owners": {"AV-UI-003": ["F-01", "F-12", "F Gate"], "AV-UI-004": ["A-04", "A-14", "A Gate"]}, "environment": "ENV-LOCAL"}
EXPECTED_RAW_PATHS = {
    "docs/architecture/a03/A-03_ONBOARDING_CATALOG.json",
    "docs/architecture/a03/A-03_PROJECT_DASHBOARD.md",
    "docs/architecture/a03/A-03_PROJECT_REGISTRATION.md",
    "docs/architecture/a03/A-03_REPOSITORY_ONBOARDING.md",
    "docs/architecture/a03/A-03_DASHBOARD_STATIC_RENDER.svg",
    "docs/architecture/a03/A-03_ONBOARDING_STATIC_RENDER.svg",
    "docs/architecture/a03/A-03_REPOSITORY_STATE_STATIC_RENDER.svg",
    "scripts/check_a03_onboarding.py",
    "tests/tooling/test_a03_onboarding.py",
    "tests/fixtures/a03/canonical-contract.json",
    "tests/fixtures/a03/mutation-catalog.json",
    "docs/validation/A-03_ONBOARDING_VALIDATION.md",
    "docs/completion_reports/A-03_COMPLETION_REPORT.md",
    "docs/architecture/a02/A-02_TOKEN_CATALOG.json",
    "docs/work_orders/A-03_WORK_INSTRUCTION.md",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(errors: list[str]) -> list[str]:
    return list(dict.fromkeys(errors))


def _screen_map(catalog: dict[str, Any]) -> dict[str, dict[str, Any]]:
    screens = catalog.get("screens", [])
    if not isinstance(screens, list):
        return {}
    return {str(item.get("screen_id", "")): item for item in screens if isinstance(item, dict)}


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    predecessor = catalog.get("predecessor_contract", {})
    if predecessor != {"a02_catalog_path": str(A02_REL).replace("\\", "/"), "a02_catalog_sha256": EXPECTED_A02_SHA256}:
        errors.append("A02_PREDECESSOR_BINDING_MISMATCH")
    if catalog.get("presentation") != EXPECTED_PRESENTATION:
        errors.append("A02_PRESENTATION_TOKEN_DRIFT")

    screens = _screen_map(catalog)
    if set(screens) != set(EXPECTED_SCREEN_FIELDS):
        errors.append("SCREEN_SET_MISMATCH")
    for screen_id, fields in EXPECTED_SCREEN_FIELDS.items():
        if set(screens.get(screen_id, {}).get("fields", [])) != fields:
            errors.append("SCREEN_FIELD_CONTRACT_MISMATCH")

    register = screens.get("PROJECT_REGISTER", {})
    if register.get("conditional_fields") != {"local": ["local_path"], "git": ["remote_url"]}:
        errors.append("SOURCE_CONDITIONAL_FIELD_MISMATCH")
    onboarding = screens.get("REPOSITORY_ONBOARDING", {})
    if onboarding.get("scan_steps") != ["PATH_POLICY", "GIT_STATUS", "MANIFESTS", "TOOLCHAIN", "FILE_CLASSIFICATION", "PROJECT_RULES", "PROTECTED_PATHS", "PROFILE"]:
        errors.append("READ_ONLY_SCAN_STEP_MISMATCH")
    if catalog.get("state_contract") != EXPECTED_STATES:
        errors.append("STATE_CONTRACT_MISMATCH")
    if catalog.get("reason_codes") != EXPECTED_REASONS:
        errors.append("REASON_CODE_CONTRACT_MISMATCH")
    if catalog.get("registration_errors") != EXPECTED_ERRORS:
        errors.append("REGISTRATION_ERROR_CONTRACT_MISMATCH")
    if catalog.get("preservation_contract") != EXPECTED_PRESERVATION:
        errors.append("SOURCE_PRESERVATION_CONTRACT_MISMATCH")
    if catalog.get("permission_contract") != EXPECTED_PERMISSION:
        errors.append("PERMISSION_BOUNDARY_MISMATCH")

    dashboard = catalog.get("dashboard_contract", {})
    if dashboard.get("health_cards") != EXPECTED_HEALTH:
        errors.append("DASHBOARD_HEALTH_CARD_SET_MISMATCH")
    if dashboard.get("operations_cards") != EXPECTED_OPERATIONS:
        errors.append("DASHBOARD_OPERATION_CARD_SET_MISMATCH")
    if dashboard.get("health_card_fields") != ["icon", "status_label", "short_description", "last_checked_at", "error_count", "detail_link"]:
        errors.append("DASHBOARD_HEALTH_FIELD_MISMATCH")
    if dashboard.get("success_rate_fields") != ["period", "sample_count", "pass_count", "skipped_count"] or dashboard.get("skipped_counts_as_success") is not False:
        errors.append("SUCCESS_RATE_COMPOSITION_MISMATCH")
    if dashboard.get("next_action_fields") != ["priority", "target", "reason", "elapsed", "deep_link"]:
        errors.append("NEXT_ACTION_DEEP_LINK_MISSING")

    transitions = catalog.get("transitions", [])
    transition_pairs = {(item.get("event"), item.get("to"), item.get("effect")) for item in transitions if isinstance(item, dict)}
    required_pairs = {
        ("DIRTY_OR_UNTRACKED_OR_NON_GIT_OR_UNKNOWN", "REVIEW_REQUIRED", "PRESERVE_SOURCE_AND_REQUIRE_REVIEW"),
        ("OUTSIDE_ROOT_OR_PERMISSION_OR_MUTATION", "BLOCKED", "STOP_WITH_REASON_AND_NEXT_ACTION"),
        ("READ_ONLY_RESCAN", "REVIEW_REQUIRED", "CREATE_NEW_PROFILE_AND_BASELINE_CANDIDATE_WITHOUT_SOURCE_MUTATION"),
    }
    if not required_pairs.issubset(transition_pairs):
        errors.append("FAIL_CLOSED_TRANSITION_MISMATCH")
    if catalog.get("matrix_contract") != EXPECTED_MATRIX:
        errors.append("MATRIX_CONTRACT_MISMATCH")
    if catalog.get("verification_contract") != EXPECTED_VERIFICATION:
        errors.append("VERIFICATION_CONTRACT_MISMATCH")
    return _dedupe(errors)


def validate_a02_predecessor(root: Path) -> list[str]:
    path = root / A02_REL
    try:
        catalog = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["A02_PREDECESSOR_BINDING_MISMATCH"]
    presentation = {
        "viewport": catalog.get("viewport"), "typography": catalog.get("typography"), "layout": catalog.get("layout"),
        "explanation_interface": catalog.get("explanation_interface"), "status_presentation": catalog.get("status_presentation"),
        "semantic_colors": {str(item.get("role")): str(item.get("value")).upper() for item in catalog.get("semantic_colors", [])},
    }
    return [] if sha256_file(path) == EXPECTED_A02_SHA256 and presentation == EXPECTED_PRESENTATION else ["A02_PREDECESSOR_BINDING_MISMATCH"]


def validate_documents(root: Path, catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    common = ["STATIC_ONLY", "STATIC_CONTRACT_PASS", "RUNTIME_DEFERRED / NOT_EXECUTED", "E-SHOT_STATIC_NOT_RUNTIME_UI", "E-DEC_NOT_EXECUTED", "i-icon", "tooltip", "popover", "reason", "next_action"]
    per_doc = {
        "PROJECT_DASHBOARD": EXPECTED_HEALTH + EXPECTED_OPERATIONS + ["period", "sample_count", "pass_count", "skipped_count", "deep_link"],
        "PROJECT_REGISTER": ["project_name", "project_slug", "repository_source_type", "local_path", "remote_url", "PROJECT_SLUG_EXISTS", "REPOSITORY_PATH_DENIED", "REPOSITORY_NOT_FOUND", "PROJECT_VIEW", "PROJECT_MANAGE", "REPOSITORY_MANAGE"],
        "REPOSITORY_ONBOARDING": ["SCANNING_READ_ONLY", "tracked_dirty_count", "untracked_count", "user-owned", "automatic cleanup forbidden", "source write forbidden", "install forbidden", "format forbidden", "Git mutation forbidden", "ROOT_OUTSIDE_ALLOWED", "SCAN_MUTATION_DETECTED", "protected_paths", "allowed_environments"],
    }
    for doc_id, path in DOCUMENTS.items():
        try:
            text = (root / path).read_text(encoding="utf-8")
        except OSError:
            errors.append("DOCUMENT_MISSING")
            continue
        if f"contract_screen_id: `{doc_id}`" not in text or any(item not in text for item in common + per_doc[doc_id]):
            errors.append("DOCUMENT_SEMANTIC_BINDING_MISMATCH")
    return _dedupe(errors)


def validate_renders(root: Path, catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    allowed_colors = set(EXPECTED_PRESENTATION["semantic_colors"].values())
    for screen_ids, path in RENDERS.items():
        try:
            text = (root / path).read_text(encoding="utf-8")
        except OSError:
            errors.append("STATIC_RENDER_MISSING")
            continue
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-screen-ids="{screen_ids}"', "E-SHOT_STATIC_NOT_RUNTIME_UI", "E-DEC_NOT_EXECUTED", "RUNTIME_DEFERRED / NOT_EXECUTED", "i-icon", "tooltip", "popover", "reason", "next_action", "icon + status_label + short_description", "body/form 12px", "screen title 16px"]
        if any(item not in text for item in required):
            errors.append("STATIC_RENDER_SEMANTIC_BINDING_MISMATCH")
        found_colors = {match.upper() for match in re.findall(r"#[0-9A-Fa-f]{6}\b", text)}
        if found_colors - allowed_colors:
            errors.append("STATIC_RENDER_RAW_COLOR_BYPASS")
    return _dedupe(errors)


def _apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(document)
    parts = str(mutation.get("path", "")).split(".")
    target: Any = result
    operation = mutation.get("operation", "replace")
    for part in parts[:-1]:
        target = target[int(part)] if isinstance(target, list) else target[part]
    key = parts[-1]
    if operation == "remove":
        target.pop(int(key)) if isinstance(target, list) else target.pop(key, None)
    elif operation == "append":
        target[key].append(mutation.get("value"))
    else:
        if isinstance(target, list):
            target[int(key)] = mutation.get("value")
        else:
            target[key] = mutation.get("value")
    return result


def validate_mutation_fixture(catalog: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for mutation in fixture.get("mutations", []):
        mutation_id = str(mutation.get("mutation_id", ""))
        expected = str(mutation.get("expected_error_code", ""))
        if not mutation_id or mutation_id in seen or not expected:
            errors.append("MUTATION_FIXTURE_INVALID")
            continue
        seen.add(mutation_id)
        try:
            actual = validate_catalog(_apply_mutation(catalog, mutation))
        except (KeyError, IndexError, TypeError, ValueError):
            errors.append("MUTATION_FIXTURE_INVALID")
            continue
        if expected not in actual:
            errors.append("MUTATION_EXPECTED_REASON_NOT_OBSERVED")
    return _dedupe(errors)


def _manifest_projection(raw_artifacts: list[dict[str, Any]]) -> bytes:
    projection = [{"path": str(item.get("path", "")), "sha256": str(item.get("sha256", ""))} for item in sorted(raw_artifacts, key=lambda item: str(item.get("path", "")))]
    return json.dumps(projection, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def manifest_target(raw_artifacts: list[dict[str, Any]]) -> str:
    return hashlib.sha256(_manifest_projection(raw_artifacts)).hexdigest().upper()


def validate_evidence_manifest(root: Path, manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    raw = manifest.get("raw_artifacts", [])
    if not isinstance(raw, list) or not raw:
        return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    if manifest.get("self_reference") is not False:
        errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    paths: set[str] = set()
    content_bytes = 0
    for item in raw:
        relative = str(item.get("path", ""))
        if not relative or relative in paths:
            errors.append("EVIDENCE_RAW_PATH_INVALID")
            continue
        paths.add(relative)
        path = root / relative
        if not path.is_file():
            errors.append("EVIDENCE_RAW_ARTIFACT_MISSING")
            continue
        content_bytes += path.stat().st_size
        if item.get("bytes") != path.stat().st_size:
            errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != sha256_file(path):
            errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    if paths != EXPECTED_RAW_PATHS:
        errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    projection = _manifest_projection(raw)
    target = manifest_target(raw)
    if manifest.get("target_canonical_bytes") != len(projection):
        errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    if manifest.get("target_content_bytes") != content_bytes:
        errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target:
        errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected_static = {"assigned_verification_ids": ["AV-UI-003", "AV-UI-004"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED"}
    if any(manifest.get(key) != value for key, value in expected_static.items()):
        errors.append("EVIDENCE_RUNTIME_QUALIFIER_MISMATCH")
    return _dedupe(errors)


def validate_bundle(root: Path, require_manifest: bool = True) -> list[str]:
    errors: list[str] = []
    try:
        catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["CATALOG_MISSING_OR_INVALID"]
    errors += validate_catalog(catalog)
    errors += validate_a02_predecessor(root)
    errors += validate_documents(root, catalog)
    errors += validate_renders(root, catalog)
    if require_manifest:
        try:
            manifest = json.loads((root / MANIFEST_REL).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            errors.append("EVIDENCE_MANIFEST_MISSING_OR_INVALID")
        else:
            errors += validate_evidence_manifest(root, manifest)
    return _dedupe(errors)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--without-manifest", action="store_true")
    args = parser.parse_args()
    errors = validate_bundle(args.root.resolve(), require_manifest=not args.without_manifest)
    payload = {"status": "PASS" if not errors else "FAIL", "package_id": "A-03", "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-03 onboarding contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
