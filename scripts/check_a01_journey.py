#!/usr/bin/env python3
"""Validate the A-01 static journey artifacts without claiming runtime evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


CATALOG_REL = Path("docs/architecture/a01/A-01_PATH_CATALOG.json")
DOCUMENTS = {
    "journey": Path("docs/architecture/a01/A-01_USER_JOURNEY.md"),
    "screen": Path("docs/architecture/a01/A-01_SCREEN_MAP.md"),
    "rail": Path("docs/architecture/a01/A-01_PHASE_RAIL.md"),
    "decision": Path("docs/architecture/a01/A-01_DECISION_APPROVAL_MAP.md"),
}
STATIC_RENDER_REL = Path("docs/architecture/a01/A-01_STATIC_RENDER.svg")
EXPECTED_STEP_IDS = [f"STEP-{number:02d}" for number in range(1, 15)]
EXPECTED_PATH_IDS = {
    "PATH-NORMAL",
    "PATH-REJECT",
    "PATH-REVISE",
    "PATH-STOP",
    "PATH-RESUME",
}
EXPECTED_NON_PASS = {
    "NOT_EXECUTED",
    "BLOCKED",
    "SKIPPED",
    "INCOMPLETE",
    "CANCELLED",
    "fixture",
}
EXPECTED_APPROVAL_CHANGES = {
    "FUNCTION_SCOPE_CHANGE",
    "REQUIREMENT_CHANGE",
    "IMPORTANT_RISK_CHANGE",
}
DECISION_CONTRACT_FIELDS = (
    "decision_id",
    "step_id",
    "actor",
    "subject_artifact",
    "subject_hash_required",
    "allowed_results",
    "reject_result",
    "revise_result",
)
EXPECTED_DECISION_CONTRACTS = [
    {"decision_id": "DEC-CONCEPT", "step_id": "STEP-03", "actor": "human-owner", "subject_artifact": "ProposalSet", "subject_hash_required": True, "allowed_results": ["SELECT", "HOLD", "REJECT", "REVISE"], "reject_result": "TERMINAL-REJECTED", "revise_result": "STEP-02"},
    {"decision_id": "DEC-WI-APPROVAL", "step_id": "STEP-06", "actor": "human-owner-or-standing-approved-main", "subject_artifact": "WorkInstruction", "subject_hash_required": True, "allowed_results": ["APPROVE", "REJECT", "REVISE"], "reject_result": "TERMINAL-REJECTED", "revise_result": "STEP-05"},
    {"decision_id": "DEC-PRODUCT-VALIDATION", "step_id": "STEP-10", "actor": "human-owner", "subject_artifact": "ProductValidation", "subject_hash_required": True, "allowed_results": ["PASS", "FAIL", "INCOMPLETE"], "reject_result": "STEP-11", "revise_result": "STEP-11"},
    {"decision_id": "DEC-RELEASE", "step_id": "STEP-12", "actor": "human-owner", "subject_artifact": "ReleaseDecision", "subject_hash_required": True, "allowed_results": ["RELEASE", "REWORK", "DEFER", "REJECT"], "reject_result": "TERMINAL-REJECTED", "revise_result": "STEP-04"},
    {"decision_id": "DEC-ACTIVATION", "step_id": "STEP-14", "actor": "human-owner", "subject_artifact": "SkillOrHookCandidate", "subject_hash_required": True, "allowed_results": ["ACTIVATE", "REJECT", "ROLLBACK"], "reject_result": "candidate_retained_inactive", "revise_result": "STEP-13"},
]
EXPECTED_DECISION_EDGE_BINDINGS = {
    "DEC-CONCEPT": {"reject_edge_id": "EDGE-03-REJECT", "revise_edge_id": "EDGE-03-REVISE", "reject_path_id": "PATH-REJECT", "revise_path_id": "PATH-REVISE"},
    "DEC-WI-APPROVAL": {"reject_edge_id": "EDGE-06-REJECT", "revise_edge_id": "EDGE-06-REVISE", "reject_path_id": "PATH-REJECT", "revise_path_id": "PATH-REVISE"},
    "DEC-RELEASE": {"reject_edge_id": "EDGE-12-REJECT", "revise_edge_id": "EDGE-12-REVISE", "reject_path_id": "PATH-REJECT", "revise_path_id": "PATH-REVISE"},
}
EXPLICIT_NON_STATE_RESULTS = {"candidate_retained_inactive"}
EDGE_FIELDS = {
    "edge_id",
    "source_step_id",
    "target_step_id",
    "source_screen_id",
    "target_screen_id",
    "trigger",
    "guard",
    "result",
    "runtime_status",
}


def _duplicate_values(values: list[str]) -> set[str]:
    return {value for value in values if values.count(value) > 1}


def _by_id(items: list[dict[str, Any]], field: str) -> dict[str, dict[str, Any]]:
    return {str(item.get(field, "")): item for item in items}


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    """Return stable error codes for a catalog projection."""
    errors: list[str] = []
    steps = catalog.get("steps", [])
    step_ids = [str(step.get("step_id", "")) for step in steps]
    if step_ids != EXPECTED_STEP_IDS or _duplicate_values(step_ids):
        errors.append("STEP_SET_OR_ORDER_MISMATCH")

    screens = catalog.get("screens", [])
    screen_ids = [str(screen.get("screen_id", "")) for screen in screens]
    if not screen_ids or _duplicate_values(screen_ids):
        errors.append("SCREEN_ID_INVALID")
    screen_set = set(screen_ids)
    step_by_id = _by_id(steps, "step_id")
    terminal_ids = {
        str(terminal.get("terminal_id", "")) for terminal in catalog.get("terminals", [])
    }

    edges = catalog.get("edges", [])
    edge_ids = [str(edge.get("edge_id", "")) for edge in edges]
    if not edge_ids or _duplicate_values(edge_ids):
        errors.append("EDGE_ID_INVALID")
    edge_by_id = _by_id(edges, "edge_id")
    for edge in edges:
        if not EDGE_FIELDS.issubset(edge) or any(not edge.get(field) for field in EDGE_FIELDS):
            errors.append("EDGE_CONTRACT_INCOMPLETE")
            continue
        source = str(edge["source_step_id"])
        target = str(edge["target_step_id"])
        if source not in step_by_id and source not in terminal_ids:
            errors.append("EDGE_SOURCE_UNKNOWN")
        if target not in step_by_id and target not in terminal_ids:
            errors.append("EDGE_TARGET_UNKNOWN")
        if edge["source_screen_id"] not in screen_set or edge["target_screen_id"] not in screen_set:
            errors.append("EDGE_SCREEN_UNKNOWN")
        if edge["runtime_status"] != "RUNTIME_DEFERRED / NOT_EXECUTED":
            errors.append("EDGE_RUNTIME_STATUS_MISMATCH")

    paths = catalog.get("paths", [])
    path_ids = {str(path.get("path_id", "")) for path in paths}
    if path_ids != EXPECTED_PATH_IDS or len(paths) != len(EXPECTED_PATH_IDS):
        errors.append("PATH_SET_MISMATCH")
    for path in paths:
        current = str(path.get("start_step_id", ""))
        edge_sequence = path.get("edge_ids", [])
        if not edge_sequence:
            errors.append("PATH_EDGE_SEQUENCE_EMPTY")
            continue
        for edge_id in edge_sequence:
            edge = edge_by_id.get(str(edge_id))
            if edge is None:
                errors.append("PATH_EDGE_UNKNOWN")
                break
            if edge.get("source_step_id") != current:
                errors.append("PATH_EDGE_DISCONNECTED")
                break
            current = str(edge.get("target_step_id", ""))
        expected_terminal = str(path.get("terminal_id", ""))
        normal_completion = path.get("path_id") == "PATH-NORMAL" and current == "STEP-14"
        if current != expected_terminal and not (
            normal_completion and expected_terminal == "TERMINAL-COMPLETED"
        ):
            errors.append("PATH_TERMINAL_MISMATCH")

    if any(
        edge.get("source_step_id") == "STEP-05" and edge.get("target_step_id") == "STEP-07"
        for edge in edges
    ):
        errors.append("EXECUTION_APPROVAL_BYPASS")
    approval_edge = edge_by_id.get("EDGE-06-07", {})
    if "approval_subject_hash_matches" not in str(approval_edge.get("guard", "")):
        errors.append("EXECUTION_APPROVAL_GUARD_MISSING")

    path_by_id = _by_id(paths, "path_id")
    reject = path_by_id.get("PATH-REJECT", {})
    if reject.get("execution_auto_open_allowed") is not False:
        errors.append("REJECT_AUTO_EXECUTION_FORBIDDEN")
    revision = path_by_id.get("PATH-REVISE", {}).get("revision_policy", {})
    if revision.get("old_hash_reusable") is not False:
        errors.append("REWORK_OLD_HASH_REUSE")
    for field in ("new_revision_required", "impact_analysis_required"):
        if revision.get(field) is not True:
            errors.append("REWORK_REVISION_CONTRACT_INCOMPLETE")
    stop = path_by_id.get("PATH-STOP", {}).get("stop_contract", {})
    for field in (
        "checkpoint_required",
        "completed_steps_required",
        "stop_reason_required",
        "next_safe_action_required",
    ):
        if stop.get(field) is not True:
            errors.append(
                "STOP_CHECKPOINT_REQUIRED" if field == "checkpoint_required" else "STOP_CONTRACT_INCOMPLETE"
            )
    resume = path_by_id.get("PATH-RESUME", {}).get("resume_contract", {})
    if resume.get("duplicate_execution_allowed") is not False:
        errors.append("RESUME_DUPLICATE_EXECUTION_FORBIDDEN")
    for field in ("same_artifact_hash_required", "checkpoint_required", "completed_steps_restored"):
        if resume.get(field) is not True:
            errors.append("RESUME_CONTRACT_INCOMPLETE")

    separation = catalog.get("separation_contract", {})
    if separation.get("technical_pass_implies_product_validation") is not False:
        errors.append("TECHNICAL_PASS_PROMOTION")
    if separation.get("technical_pass_implies_release") is not False:
        errors.append("TECHNICAL_PASS_RELEASE_PROMOTION")
    for field in (
        "technical_test_distinct",
        "product_validation_distinct",
        "defect_assessment_distinct",
        "release_decision_distinct",
        "learning_review_distinct",
    ):
        if separation.get(field) is not True:
            errors.append("JOURNEY_STAGE_SEPARATION_MISSING")

    non_pass = set(catalog.get("status_policy", {}).get("non_pass_statuses", []))
    if non_pass != EXPECTED_NON_PASS:
        errors.append("NON_PASS_STATUS_POLICY_MISMATCH")

    verification = catalog.get("verification_contract", {})
    if verification.get("assigned_verification_ids") != ["AV-UI-005"]:
        errors.append("A01_RESPONSIBILITY_MISMATCH")
    if verification.get("runtime_deferred_verification_ids") != ["AV-FLOW-001"]:
        errors.append("A01_RUNTIME_DEFERRED_MISMATCH")
    if set(verification.get("runtime_owners", [])) != {"A-05", "B-03", "A Gate"}:
        errors.append("AV_FLOW_001_RUNTIME_OWNER_MISMATCH")
    if verification.get("runtime_status") != "RUNTIME_DEFERRED / NOT_EXECUTED":
        errors.append("A01_RUNTIME_STATUS_MISMATCH")
    if verification.get("execution_classification") != "STATIC_ONLY":
        errors.append("A01_EXECUTION_CLASSIFICATION_MISMATCH")

    decisions = catalog.get("decisions", [])
    if not decisions:
        errors.append("DECISION_SET_EMPTY")
    for decision in decisions:
        if not decision.get("actor"):
            errors.append("DECISION_ACTOR_MISSING")
        if not decision.get("subject_artifact") or decision.get("subject_hash_required") is not True:
            errors.append("DECISION_SUBJECT_HASH_MISSING")
        if not decision.get("allowed_results"):
            errors.append("DECISION_RESULT_MISSING")
        if "reject_result" not in decision or "revise_result" not in decision:
            errors.append("DECISION_OUTCOME_MAPPING_MISSING")

    approval_changes = catalog.get("approval_boundary", {}).get("human_approval_required_for", [])
    if (
        not isinstance(approval_changes, list)
        or len(approval_changes) != len(EXPECTED_APPROVAL_CHANGES)
        or set(approval_changes) != EXPECTED_APPROVAL_CHANGES
    ):
        errors.append("APPROVAL_BOUNDARY_MISMATCH")

    actual_decisions = {
        str(decision.get("decision_id", "")): {
            field: decision.get(field) for field in DECISION_CONTRACT_FIELDS
        }
        for decision in decisions
    }
    expected_decisions = {
        decision["decision_id"]: decision for decision in EXPECTED_DECISION_CONTRACTS
    }
    if actual_decisions != expected_decisions:
        errors.append("DECISION_CONTRACT_MISMATCH")

    valid_decision_targets = set(step_by_id) | terminal_ids | EXPLICIT_NON_STATE_RESULTS
    for decision in decisions:
        if (
            decision.get("reject_result") not in valid_decision_targets
            or decision.get("revise_result") not in valid_decision_targets
        ):
            errors.append("DECISION_TARGET_UNKNOWN")

    for decision_id, binding in EXPECTED_DECISION_EDGE_BINDINGS.items():
        decision = actual_decisions.get(decision_id, {})
        source_step = decision.get("step_id")
        catalog_decision = next(
            (item for item in decisions if item.get("decision_id") == decision_id), {}
        )
        for outcome in ("reject", "revise"):
            edge_field = f"{outcome}_edge_id"
            path_field = f"{outcome}_path_id"
            result_field = f"{outcome}_result"
            expected_edge_id = binding[edge_field]
            expected_path_id = binding[path_field]
            edge = edge_by_id.get(expected_edge_id)
            if (
                catalog_decision.get(edge_field) != expected_edge_id
                or edge is None
                or edge.get("source_step_id") != source_step
                or edge.get("target_step_id") != decision.get(result_field)
            ):
                errors.append("DECISION_EDGE_MISSING")
            path = path_by_id.get(expected_path_id, {})
            bound_edges = set(path.get("edge_ids", [])) | set(path.get("outcome_edge_ids", []))
            if (
                catalog_decision.get(path_field) != expected_path_id
                or expected_edge_id not in bound_edges
                or edge is None
            ):
                errors.append("DECISION_PATH_BINDING_MISSING")

    presentation = catalog.get("presentation_contract", {})
    expected_presentation = {
        "viewport": "1920x1080",
        "body_font_px": 12,
        "small_font_px": 10,
        "aux_font_px": 9,
        "sidebar_title_px": 14,
        "title_px": 16,
        "explanation_interface": "i-tooltip-popover",
        "persistent_explanation_box_allowed": False,
        "progressive_disclosure": True,
        "fixed_independent_screen_count": False,
    }
    if presentation != expected_presentation:
        errors.append("PRESENTATION_CONTRACT_MISMATCH")

    return list(dict.fromkeys(errors))


def validate_fixture_contract(root: Path) -> list[str]:
    """Keep the independent fixture exact contract aligned with checker literals."""
    path = root / "tests/fixtures/a01/canonical-contract.json"
    try:
        fixture = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["FIXTURE_DECISION_CONTRACT_MISSING"]
    errors: list[str] = []
    approval = fixture.get("human_approval_required_for", [])
    if len(approval) != 3 or set(approval) != EXPECTED_APPROVAL_CHANGES:
        errors.append("FIXTURE_APPROVAL_BOUNDARY_MISMATCH")
    if fixture.get("decision_contracts") != EXPECTED_DECISION_CONTRACTS:
        errors.append("FIXTURE_DECISION_CONTRACT_MISMATCH")
    if fixture.get("decision_edge_bindings") != EXPECTED_DECISION_EDGE_BINDINGS:
        errors.append("FIXTURE_DECISION_EDGE_BINDING_MISMATCH")
    return errors


def validate_document_alignment(root: Path, catalog: dict[str, Any]) -> list[str]:
    """Validate stable IDs and static/runtime qualifiers across human documents."""
    errors: list[str] = []
    try:
        texts = {
            name: (root / relative).read_text(encoding="utf-8")
            for name, relative in DOCUMENTS.items()
        }
    except FileNotFoundError:
        return ["DOCUMENT_MISSING"]

    for step in catalog.get("steps", []):
        step_id = str(step.get("step_id", ""))
        if step_id not in texts["journey"] or step_id not in texts["rail"]:
            errors.append("DOCUMENT_STEP_ALIGNMENT_MISMATCH")
    for screen in catalog.get("screens", []):
        if str(screen.get("screen_id", "")) not in texts["screen"]:
            errors.append("DOCUMENT_SCREEN_ALIGNMENT_MISMATCH")
    for decision in catalog.get("decisions", []):
        if str(decision.get("decision_id", "")) not in texts["decision"]:
            errors.append("DOCUMENT_DECISION_ALIGNMENT_MISMATCH")
    for path in catalog.get("paths", []):
        if str(path.get("path_id", "")) not in texts["journey"]:
            errors.append("DOCUMENT_PATH_ALIGNMENT_MISMATCH")
    for text in texts.values():
        if "AV-UI-005" not in text or "AV-FLOW-001" not in text:
            errors.append("DOCUMENT_RESPONSIBILITY_QUALIFIER_MISSING")
        if "RUNTIME_DEFERRED / NOT_EXECUTED" not in text:
            errors.append("DOCUMENT_RUNTIME_QUALIFIER_MISSING")
    return list(dict.fromkeys(errors))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _manifest_target(raw_artifacts: list[dict[str, Any]]) -> str:
    projection = [
        {"path": str(item.get("path", "")), "sha256": str(item.get("sha256", ""))}
        for item in sorted(raw_artifacts, key=lambda item: str(item.get("path", "")))
    ]
    canonical = json.dumps(projection, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest().upper()


def _is_historical_predecessor(root: Path, manifest: dict[str, Any]) -> bool:
    """Recognize an immutable predecessor bound by the current acceptance manifest."""
    acceptance_path = root / "docs/evidence/manifests/A-01_ACCEPTANCE_PROGRESS_MANIFEST.json"
    if not acceptance_path.is_file():
        return False
    try:
        acceptance = json.loads(acceptance_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    predecessor = acceptance.get("developer_manifest_predecessor", {})
    predecessor_path = root / str(predecessor.get("path", ""))
    return (
        manifest.get("artifact_status") == "developer_rework_completed_pending_independent_test"
        and
        acceptance.get("artifact_status") == "accepted"
        and acceptance.get("projection", {}).get("decision") == "ACCEPTED"
        and predecessor.get("path") == "docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json"
        and predecessor_path.is_file()
        and predecessor.get("file_sha256") == _sha256(predecessor_path)
    )


def validate_evidence_manifest(root: Path, manifest: dict[str, Any]) -> list[str]:
    """Validate raw artifact bytes and the non-self-referential target hash."""
    errors: list[str] = []
    raw_artifacts = manifest.get("raw_artifacts", [])
    if not raw_artifacts:
        return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    seen: set[str] = set()
    historical_predecessor = _is_historical_predecessor(root, manifest)
    for item in raw_artifacts:
        path_text = str(item.get("path", ""))
        if not path_text or path_text in seen:
            errors.append("EVIDENCE_RAW_PATH_INVALID")
            continue
        seen.add(path_text)
        path = root / path_text
        if not path.is_file():
            errors.append("EVIDENCE_RAW_ARTIFACT_MISSING")
            continue
        if not isinstance(item.get("bytes"), int) or item.get("bytes") <= 0:
            errors.append("EVIDENCE_RAW_BYTES_INVALID")
        if not historical_predecessor and item.get("sha256") != _sha256(path):
            errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    expected_target = _manifest_target(raw_artifacts)
    if manifest.get("target_hash") != expected_target or manifest.get("delivered_hash") != expected_target:
        errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    if manifest.get("assigned_verification_ids") != ["AV-UI-005"]:
        errors.append("EVIDENCE_RESPONSIBILITY_MISMATCH")
    if manifest.get("runtime_deferred_verification_ids") != ["AV-FLOW-001"]:
        errors.append("EVIDENCE_RUNTIME_DEFERRED_MISMATCH")
    if manifest.get("evidence_qualifier") != "E-SHOT_STATIC_NOT_RUNTIME_UI":
        errors.append("EVIDENCE_STATIC_QUALIFIER_MISSING")
    return list(dict.fromkeys(errors))


def validate_bundle(root: Path) -> list[str]:
    """Validate the repository A-01 bundle."""
    catalog_path = root / CATALOG_REL
    if not catalog_path.is_file():
        return ["CATALOG_MISSING"]
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ["CATALOG_JSON_INVALID"]
    errors = validate_catalog(catalog)
    errors.extend(validate_fixture_contract(root))
    errors.extend(validate_document_alignment(root, catalog))
    render = root / STATIC_RENDER_REL
    if not render.is_file():
        errors.append("STATIC_RENDER_MISSING")
    else:
        render_text = render.read_text(encoding="utf-8")
        if "E-SHOT_STATIC" not in render_text or "RUNTIME_DEFERRED / NOT_EXECUTED" not in render_text:
            errors.append("STATIC_RENDER_QUALIFIER_MISSING")
    return list(dict.fromkeys(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    errors = validate_bundle(args.root.resolve())
    result = {
        "package_id": "A-01",
        "verification_id": "AV-UI-005",
        "execution_classification": "STATIC_ONLY",
        "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED",
        "verdict": "PASS" if not errors else "FAIL",
        "errors": errors,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"A-01 journey validation: {result['verdict']}")
        for error in errors:
            print(f"- {error}")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
