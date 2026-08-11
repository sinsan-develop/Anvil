#!/usr/bin/env python3
"""Fail-closed validator for the A-04 static Workbench contract."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


CATALOG_REL = Path("docs/architecture/a04/A-04_WORKBENCH_CATALOG.json")
MANIFEST_REL = Path("docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json")
PREDECESSORS = {
    "a01_catalog": (Path("docs/architecture/a01/A-01_PATH_CATALOG.json"), "FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69"),
    "a01_manifest": (Path("docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json"), "BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4"),
    "a02_catalog": (Path("docs/architecture/a02/A-02_TOKEN_CATALOG.json"), "1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207"),
    "a02_manifest": (Path("docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json"), "779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168"),
    "a03_catalog": (Path("docs/architecture/a03/A-03_ONBOARDING_CATALOG.json"), "464F785FB0A72C3E5571D30755EE3A107259D641A6035830B18343E5A0922093"),
    "a03_manifest": (Path("docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json"), "772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE"),
}
EXPECTED_PREDECESSOR_CONTRACT = {
    "a01_catalog_path": "docs/architecture/a01/A-01_PATH_CATALOG.json",
    "a01_catalog_sha256": PREDECESSORS["a01_catalog"][1],
    "a01_manifest_sha256": PREDECESSORS["a01_manifest"][1],
    "a02_catalog_path": "docs/architecture/a02/A-02_TOKEN_CATALOG.json",
    "a02_catalog_sha256": PREDECESSORS["a02_catalog"][1],
    "a02_manifest_sha256": PREDECESSORS["a02_manifest"][1],
    "a03_catalog_path": "docs/architecture/a03/A-03_ONBOARDING_CATALOG.json",
    "a03_catalog_sha256": PREDECESSORS["a03_catalog"][1],
    "a03_manifest_sha256": PREDECESSORS["a03_manifest"][1],
}
EXPECTED_PRESENTATION = {
    "viewport": {"width_px": 1920, "height_px": 1080},
    "typography": {"body_form_px": 12, "small_description_px": 10, "auxiliary_px": 9, "sidebar_title_px": 14, "screen_title_px": 16},
    "layout": {"sidebar_expanded_px": 224, "sidebar_collapsed_px": 56, "header_px": 48, "context_drawer_px": 360, "context_drawer_mode": "ON_DEMAND", "base_padding_px": 16, "card_gap_px": 12},
    "explanation_interface": {"entry_point": "i-icon", "short_content_surface": "tooltip", "complex_content_surface": "popover", "required_content": ["reason", "next_action"], "persistent_explanation_box_allowed": False, "hover_only_allowed": False, "focus_path_required": True, "keyboard_access_required": True, "escape_closes": True, "focus_returns_to_trigger": True},
    "status_presentation": {"color_only_allowed": False, "required_parts": ["icon", "status_label", "short_description"], "explanation_binding": "i-tooltip-popover"},
    "semantic_colors": {"canvas": "#0B1220", "surface": "#142033", "surface-raised": "#1B2A42", "text-primary": "#F7F9FC", "text-muted": "#B8C4D8", "border": "#60738F", "interactive": "#7DB4FF", "focus": "#F8D66D", "success": "#5EE3A1", "warning": "#FFD166", "danger": "#FF7B86", "blocked": "#C4A7FF", "info": "#74D7FF", "neutral": "#B8C4D8"},
}
EXPECTED_SURFACES = ["WORKBENCH_SESSION_SHELL", "CONVERSATION_REQUEST", "CONTEXT_DRAWER", "PHASE_RAIL", "CONTROL_MODE_CARD", "HUMAN_INTERVENTION_MAP", "STOP_RESUME_PANEL"]
EXPECTED_TOP_CONTEXT = ["project", "branch", "baseline", "environment"]
EXPECTED_PANES = ["Conversation", "Current Work", "Evidence·Decision"]
EXPECTED_CONTROLS = ["stop", "revision_request", "plan_approve", "apply_approve", "discard"]
EXPECTED_REQUIREMENT_FIELDS = ["objective", "acceptance_criteria", "included_scope", "excluded_scope", "protected_scope", "assumptions", "questions"]
EXPECTED_REQUIREMENT_ACTIONS = ["confirm", "edit", "reject", "hold", "view_evidence", "request_reanalysis", "confirm_requirements", "stop"]
EXPECTED_CONFIRM_GUARD = {"objective_required": True, "minimum_acceptance_criteria": 1, "mandatory_unanswered_count": 0, "all_assumptions_user_confirmed": True}
EXPECTED_DRAWER = {"width_px": 360, "mode": "ON_DEMAND", "fields": ["impact", "source", "evidence", "hash", "decision_history", "reason", "next_action"], "persistent_box_allowed": False, "hover_only_allowed": False, "keyboard_access_required": True, "focus_path_required": True, "escape_closes": True, "focus_returns_to_trigger": True}
EXPECTED_STEPS = [f"STEP-{number:02d}" for number in range(1, 15)]
EXPECTED_EDGES = ["EDGE-01-02", "EDGE-02-03", "EDGE-03-04", "EDGE-04-05", "EDGE-05-06", "EDGE-06-07", "EDGE-07-08", "EDGE-08-09", "EDGE-09-10", "EDGE-10-11", "EDGE-11-12", "EDGE-12-13", "EDGE-13-14", "EDGE-03-REJECT", "EDGE-03-REVISE", "EDGE-06-REJECT", "EDGE-06-REVISE", "EDGE-12-REJECT", "EDGE-12-REVISE", "EDGE-07-STOP", "EDGE-STOP-RESUME"]
EXPECTED_PATHS = ["PATH-NORMAL", "PATH-REJECT", "PATH-REVISE", "PATH-STOP", "PATH-RESUME"]
EXPECTED_HUMAN_POINTS = ["STEP-03", "STEP-06", "STEP-10", "STEP-12", "STEP-14"]
EXPECTED_PHASES = ["Idea", "Design", "Plan", "Execute", "Verify", "Validate", "Release", "Learn"]
EXPECTED_RAIL_STATES = ["CURRENT", "COMPLETED", "WAITING", "BLOCKED", "STOPPED", "RESUMING", "REWORK"]
EXPECTED_CONTROL = {
    "control_levels": ["LIGHT", "STANDARD", "CONTROLLED"],
    "execution_strategies": ["SINGLE_WORKER", "DELEGATED", "PARALLEL_BATCH"],
    "failure_policies": ["STOP", "CONTINUE_INDEPENDENT", "COLLECT_AND_REVIEW"],
    "axes_separated": True,
    "high_risk_triggers": ["AMBIGUITY", "MIGRATION", "AUTH", "SECRET", "PAYMENT", "PRODUCTION_DEPLOY", "DELETION", "SHARED_SCHEMA", "DIRECTION_CHANGE", "UNVERIFIED_INPUT"],
    "high_risk_override": {"control_level": "CONTROLLED", "failure_policy": "STOP"},
}
EXPECTED_EXECUTION_GUARD = {"approval_required": True, "worker_lease_required": True, "write_lease_required_for_mutation": True, "automatic_execute_without_guards": False}
EXPECTED_STOP_RESUME_FIELDS = ["interrupted_point", "last_completed_step", "checkpoint", "checkpoint_hash", "side_effect_reconciliation", "changed_conditions", "reason", "next_action"]
EXPECTED_RESUME_GUARD = {"same_subject_hash_required": True, "checkpoint_required": True, "completed_steps_restored": True, "changed_conditions_reviewed": True, "side_effect_reconciliation_required": True, "duplicate_execution_allowed": False}
EXPECTED_PERMISSION = {"capabilities": ["PROJECT_VIEW", "CONTROL_MODE_MANAGE", "APPROVAL_DECIDE", "APPLY_DECIDE", "SAFE_STOP", "SAFE_RESUME", "DISCARD_RESULT"], "capabilities_separated": True, "project_view_does_not_imply_mutation": True, "unauthorized_action_disabled": True, "reason_and_next_action_visible": True}
EXPECTED_MATRIX = [
    {"verification_id": "AV-UI-004", "level": "L7", "method": "MX", "evidence": "E-DEC", "severity": "MAJOR"},
    {"verification_id": "AV-UI-005", "level": "L7", "method": "MI", "evidence": "E-SHOT", "severity": "MAJOR"},
]
EXPECTED_VERIFICATION = {"assigned_verification_ids": ["AV-UI-004", "AV-UI-005"], "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "canonical_runtime_verdict": "RUNTIME_DEFERRED / NOT_EXECUTED", "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED", "runtime_owners": {"AV-UI-004": ["A-14", "A Gate"], "AV-UI-005": ["A Gate"]}, "environment": "ENV-LOCAL"}
DOCUMENTS = {
    Path("docs/architecture/a04/A-04_SESSION_WORKBENCH.md"): ["WORKBENCH_SESSION_SHELL", *EXPECTED_TOP_CONTEXT, *EXPECTED_REQUIREMENT_FIELDS, "confirm_requirements", "WAITING", "BLOCKED", "INTERRUPTED", "SKIPPED"],
    Path("docs/architecture/a04/A-04_CONVERSATION_CONTEXT.md"): ["CONVERSATION_REQUEST", "CONTEXT_DRAWER", "360px", "ON_DEMAND", "i-icon", "tooltip", "popover", "Escape", "focus", "reason", "next_action"],
    Path("docs/architecture/a04/A-04_PHASE_RAIL_CONTROL.md"): ["PHASE_RAIL", "CONTROL_MODE_CARD", "HUMAN_INTERVENTION_MAP", "STOP_RESUME_PANEL", *EXPECTED_HUMAN_POINTS, "CONTROLLED + STOP", "safe_resume", "duplicate execution"],
}
RENDERS = {
    Path("docs/architecture/a04/A-04_WORKBENCH_STATIC_RENDER.svg"): "WORKBENCH_SESSION_SHELL|CONVERSATION_REQUEST|CONTEXT_DRAWER|PHASE_RAIL",
    Path("docs/architecture/a04/A-04_CONTROL_STATIC_RENDER.svg"): "CONTROL_MODE_CARD|HUMAN_INTERVENTION_MAP|STOP_RESUME_PANEL",
}
EXPECTED_RAW_PATHS = {
    "docs/architecture/a04/A-04_WORKBENCH_CATALOG.json",
    "docs/architecture/a04/A-04_SESSION_WORKBENCH.md",
    "docs/architecture/a04/A-04_CONVERSATION_CONTEXT.md",
    "docs/architecture/a04/A-04_PHASE_RAIL_CONTROL.md",
    "docs/architecture/a04/A-04_WORKBENCH_STATIC_RENDER.svg",
    "docs/architecture/a04/A-04_CONTROL_STATIC_RENDER.svg",
    "scripts/check_a04_workbench.py",
    "tests/tooling/test_a04_workbench.py",
    "tests/fixtures/a04/canonical-contract.json",
    "tests/fixtures/a04/mutation-catalog.json",
    "docs/validation/A-04_WORKBENCH_VALIDATION.md",
    "docs/completion_reports/A-04_COMPLETION_REPORT.md",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(errors: list[str]) -> list[str]:
    return list(dict.fromkeys(errors))


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if catalog.get("predecessor_contract") != EXPECTED_PREDECESSOR_CONTRACT:
        errors.append("PREDECESSOR_BINDING_MISMATCH")
    if catalog.get("presentation") != EXPECTED_PRESENTATION:
        errors.append("A02_PRESENTATION_TOKEN_DRIFT")
    if catalog.get("surfaces") != EXPECTED_SURFACES:
        errors.append("WORKBENCH_SURFACE_CONTRACT_MISMATCH")
    workbench = catalog.get("workbench_contract", {})
    if workbench.get("top_context") != EXPECTED_TOP_CONTEXT:
        errors.append("TOP_CONTEXT_CONTRACT_MISMATCH")
    if workbench.get("panes") != EXPECTED_PANES:
        errors.append("WORKBENCH_PANE_CONTRACT_MISMATCH")
    if workbench.get("controls") != EXPECTED_CONTROLS or workbench.get("progressive_disclosure") is not True or workbench.get("fixed_independent_screen_count") is not False:
        errors.append("WORKBENCH_CONTROL_CONTRACT_MISMATCH")
    requirements = catalog.get("requirements_contract", {})
    if requirements.get("fields") != EXPECTED_REQUIREMENT_FIELDS:
        errors.append("REQUIREMENT_FIELD_CONTRACT_MISMATCH")
    if requirements.get("actions") != EXPECTED_REQUIREMENT_ACTIONS:
        errors.append("REQUIREMENT_ACTION_CONTRACT_MISMATCH")
    if requirements.get("confirm_guard") != EXPECTED_CONFIRM_GUARD:
        errors.append("REQUIREMENT_CONFIRM_GUARD_MISMATCH")
    if requirements.get("agent_guess_separated_from_confirmed_fact") is not True or requirements.get("impact_changing_guess_becomes_question") is not True:
        errors.append("REQUIREMENT_FACT_BOUNDARY_MISMATCH")
    drawer = catalog.get("context_drawer_contract", {})
    if any(drawer.get(key) != value for key, value in EXPECTED_DRAWER.items() if key not in {"hover_only_allowed", "keyboard_access_required", "focus_path_required", "escape_closes", "focus_returns_to_trigger"}):
        errors.append("CONTEXT_DRAWER_CONTRACT_MISMATCH")
    if any(drawer.get(key) != value for key, value in EXPECTED_DRAWER.items() if key in {"hover_only_allowed", "keyboard_access_required", "focus_path_required", "escape_closes", "focus_returns_to_trigger"}):
        errors.append("CONTEXT_DRAWER_ACCESSIBILITY_MISMATCH")
    rail = catalog.get("phase_rail_contract", {})
    if rail.get("phases") != EXPECTED_PHASES or rail.get("step_ids") != EXPECTED_STEPS or rail.get("edge_ids") != EXPECTED_EDGES or rail.get("path_ids") != EXPECTED_PATHS or rail.get("states") != EXPECTED_RAIL_STATES or rail.get("redefinition_allowed") is not False:
        errors.append("A01_RAIL_CONTRACT_MISMATCH")
    if rail.get("human_intervention_points") != EXPECTED_HUMAN_POINTS:
        errors.append("HUMAN_INTERVENTION_CONTRACT_MISMATCH")
    human = catalog.get("human_intervention_contract", {})
    if human.get("fields") != ["subject_artifact", "subject_hash", "actor", "capability", "allowed_decisions", "reason", "evidence", "status", "next_action"] or human.get("subject_hash_required") is not True or human.get("actor_and_capability_required") is not True:
        errors.append("HUMAN_INTERVENTION_CONTRACT_MISMATCH")
    control = catalog.get("control_contract", {})
    if control.get("axes_separated") is not True:
        errors.append("CONTROL_AXIS_SEPARATION_MISMATCH")
    if any(control.get(key) != EXPECTED_CONTROL[key] for key in ("control_levels", "execution_strategies", "failure_policies")):
        errors.append("CONTROL_AXIS_CONTRACT_MISMATCH")
    if control.get("high_risk_triggers") != EXPECTED_CONTROL["high_risk_triggers"] or control.get("high_risk_override") != EXPECTED_CONTROL["high_risk_override"]:
        errors.append("HIGH_RISK_STOP_CONTRACT_MISMATCH")
    if catalog.get("execution_guard") != EXPECTED_EXECUTION_GUARD:
        errors.append("EXECUTION_APPROVAL_LEASE_GUARD_MISMATCH")
    stop_resume = catalog.get("stop_resume_contract", {})
    if stop_resume.get("fields") != EXPECTED_STOP_RESUME_FIELDS:
        errors.append("STOP_RESUME_FIELD_MISMATCH")
    if stop_resume.get("actions") != ["safe_resume", "hold", "restart", "discard"] or stop_resume.get("resume_guard") != EXPECTED_RESUME_GUARD:
        errors.append("STOP_RESUME_GUARD_MISMATCH")
    status = catalog.get("status_contract", {})
    if status.get("phase_and_run_status_separated") is not True:
        errors.append("STATUS_SEPARATION_MISMATCH")
    if status.get("non_success_statuses") != ["WAITING", "BLOCKED", "INTERRUPTED", "SKIPPED"] or status.get("non_success_cannot_render_as_completed") is not True:
        errors.append("NON_SUCCESS_STATUS_CONTAMINATION")
    if catalog.get("permission_contract") != EXPECTED_PERMISSION:
        errors.append("PERMISSION_BOUNDARY_MISMATCH")
    preservation = catalog.get("preservation_contract", {})
    if preservation.get("draft_and_input_preserved_on_error") is not True:
        errors.append("DRAFT_PRESERVATION_MISMATCH")
    if preservation.get("tracked_dirty_and_untracked_separate") is not True or preservation.get("policy_and_protected_paths_visible") is not True or preservation.get("a03_unknown_and_conflict_fail_closed") is not True or preservation.get("unknown_or_conflict_promoted_to_ready") is not False:
        errors.append("A03_STATE_PRESERVATION_MISMATCH")
    disclosure = catalog.get("disclosure_contract", {})
    if any(disclosure.get(key) is not False for key in ("secret_value_visible", "raw_internal_endpoint_visible", "loopback_endpoint_visible", "unauthorized_full_path_visible", "shell_or_cli_default_visible")) or disclosure.get("masked_evidence_reference_allowed") is not True:
        errors.append("SENSITIVE_DISCLOSURE_FORBIDDEN")
    if catalog.get("matrix_contract") != EXPECTED_MATRIX:
        errors.append("MATRIX_CONTRACT_MISMATCH")
    if catalog.get("verification_contract") != EXPECTED_VERIFICATION:
        errors.append("VERIFICATION_CONTRACT_MISMATCH")
    return _dedupe(errors)


def validate_predecessors(root: Path) -> list[str]:
    errors: list[str] = []
    for path, expected_hash in PREDECESSORS.values():
        try:
            if sha256_file(root / path) != expected_hash:
                errors.append("PREDECESSOR_ARTIFACT_HASH_MISMATCH")
        except OSError:
            errors.append("PREDECESSOR_ARTIFACT_MISSING")
    return _dedupe(errors)


def validate_documents(root: Path, catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    common = ["STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "E-SHOT_STATIC_NOT_RUNTIME_UI", "E-DEC_NOT_EXECUTED", "reason", "next_action", "NOT_EXECUTED"]
    for path, required in DOCUMENTS.items():
        try:
            text = (root / path).read_text(encoding="utf-8")
        except OSError:
            errors.append("DOCUMENT_MISSING")
            continue
        if path.name == "A-04_SESSION_WORKBENCH.md":
            required = ["STATIC_CONTRACT_PASS", *required]
        if any(item not in text for item in common + required):
            errors.append("DOCUMENT_SEMANTIC_BINDING_MISMATCH")
    return _dedupe(errors)


def validate_renders(root: Path, catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    allowed_colors = set(EXPECTED_PRESENTATION["semantic_colors"].values())
    for path, surface_ids in RENDERS.items():
        try:
            text = (root / path).read_text(encoding="utf-8")
            ET.fromstring(text)
        except (OSError, ET.ParseError):
            errors.append("STATIC_RENDER_MISSING_OR_INVALID")
            continue
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-surface-ids="{surface_ids}"', "STATIC_ONLY", "E-SHOT_STATIC_NOT_RUNTIME_UI", "E-DEC_NOT_EXECUTED", "RUNTIME_DEFERRED / NOT_EXECUTED", "i-icon", "tooltip", "popover", "reason", "next_action", "NOT_EXECUTED"]
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
    for part in parts[:-1]:
        target = target[int(part)] if isinstance(target, list) else target[part]
    key = parts[-1]
    if mutation.get("operation") == "remove":
        target.pop(int(key)) if isinstance(target, list) else target.pop(key, None)
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
    expected = {"work_instruction_sha256": "1B8CE8809EC6546ED483D0E48294CC547F0767A5D0D31D120B08787290ED753E", "assigned_verification_ids": ["AV-UI-004", "AV-UI-005"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI / E-DEC_NOT_EXECUTED"}
    if any(manifest.get(key) != value for key, value in expected.items()):
        errors.append("EVIDENCE_RUNTIME_QUALIFIER_MISMATCH")
    return _dedupe(errors)


def validate_bundle(root: Path, require_manifest: bool = True) -> list[str]:
    try:
        catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["CATALOG_MISSING_OR_INVALID"]
    errors = validate_catalog(catalog) + validate_predecessors(root) + validate_documents(root, catalog) + validate_renders(root, catalog)
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
    payload = {"status": "PASS" if not errors else "FAIL", "package_id": "A-04", "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-04 Workbench contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
