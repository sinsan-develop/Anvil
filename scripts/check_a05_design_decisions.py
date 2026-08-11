#!/usr/bin/env python3
"""Fail-closed validator for A-05 Proposal, Decision, and Design Baseline artifacts."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


CATALOG_REL = Path("docs/architecture/a05/A-05_DESIGN_DECISION_CATALOG.json")
MANIFEST_REL = Path("docs/evidence/manifests/A-05_EVIDENCE_MANIFEST.json")
PREDECESSORS = {
    "a01_catalog": (Path("docs/architecture/a01/A-01_PATH_CATALOG.json"), "FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69"),
    "a01_manifest": (Path("docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json"), "BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4"),
    "a02_catalog": (Path("docs/architecture/a02/A-02_TOKEN_CATALOG.json"), "1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207"),
    "a02_manifest": (Path("docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json"), "779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168"),
    "a03_catalog": (Path("docs/architecture/a03/A-03_ONBOARDING_CATALOG.json"), "464F785FB0A72C3E5571D30755EE3A107259D641A6035830B18343E5A0922093"),
    "a03_manifest": (Path("docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json"), "772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE"),
    "a04_catalog": (Path("docs/architecture/a04/A-04_WORKBENCH_CATALOG.json"), "230E32C99256F80904660735BA8B4A8BF95F9068164D8906E9E872EEE96AFE73"),
    "a04_manifest": (Path("docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json"), "C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB"),
}
EXPECTED_PREDECESSOR = {
    "a01_catalog_path": "docs/architecture/a01/A-01_PATH_CATALOG.json", "a01_catalog_sha256": PREDECESSORS["a01_catalog"][1], "a01_manifest_sha256": PREDECESSORS["a01_manifest"][1],
    "a02_catalog_path": "docs/architecture/a02/A-02_TOKEN_CATALOG.json", "a02_catalog_sha256": PREDECESSORS["a02_catalog"][1], "a02_manifest_sha256": PREDECESSORS["a02_manifest"][1],
    "a03_catalog_path": "docs/architecture/a03/A-03_ONBOARDING_CATALOG.json", "a03_catalog_sha256": PREDECESSORS["a03_catalog"][1], "a03_manifest_sha256": PREDECESSORS["a03_manifest"][1],
    "a04_catalog_path": "docs/architecture/a04/A-04_WORKBENCH_CATALOG.json", "a04_catalog_sha256": PREDECESSORS["a04_catalog"][1], "a04_manifest_sha256": PREDECESSORS["a04_manifest"][1],
}
PROPOSAL_SET_FIELDS = ["proposal_set_id", "version", "status", "subject_hash", "source_intent_ref"]
PROPOSAL_FIELDS = ["proposal_id", "title", "summary", "pros", "cons", "fit_conditions", "cost", "uncertainty", "risks", "evidence_refs", "assumptions"]
PROPOSAL_STATES = ["DRAFT", "GENERATING", "READY", "REVISION_REQUIRED", "HELD", "ERROR", "BLOCKED", "PERMISSION_DENIED"]
PROPOSAL_ACTIONS = ["SELECT", "REQUEST_REVISION", "HOLD", "REQUEST_DIFFERENT_APPROACH", "VIEW_EVIDENCE"]
DECISION_STATES = ["DECISION_REQUIRED", "CONFIRMED", "HOLD", "FUTURE_EXTENSION", "REVIEW", "SUPERSEDED"]
DECISION_FIELDS = ["decision_id", "required", "subject_ref", "subject_hash", "question", "input", "options", "selected_option", "reason", "evidence_refs", "impact", "actor_id", "actor_role", "status", "decided_at", "supersedes_id", "lineage", "next_action"]
SPEC_FIELDS = ["specification_id", "version", "status", "content_hash", "source_decision_refs", "scope", "out_of_scope", "screen_flow", "operational_flow", "testable_completion_conditions", "unresolved_required_decisions", "source_evidence_valid"]
BASELINE_FIELDS = ["baseline_id", "version", "baseline_hash", "specification_id", "specification_hash", "approved_by", "approved_at", "invalidated_at"]
DESIGN_STATES = ["PROPOSED", "REFINING", "REVIEW_READY", "APPROVAL_BLOCKED", "APPROVED", "REJECTED", "INVALIDATED"]
PERMISSIONS = ["PROJECT_VIEW", "PROPOSAL_REVIEW", "DECISION_DECIDE", "DESIGN_EDIT", "DESIGN_APPROVE"]
EXPECTED_VERIFICATION = {"assigned_verification_ids": ["AV-FLOW-001"], "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "canonical_runtime_verdict": "RUNTIME_DEFERRED / NOT_EXECUTED", "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED", "runtime_owners": ["B-03", "A-14", "A Gate"], "environment": "ENV-LOCAL"}
DOCUMENTS = [Path("docs/architecture/a05/A-05_PROPOSAL_COMPARE.md"), Path("docs/architecture/a05/A-05_DECISION_BOARD.md"), Path("docs/architecture/a05/A-05_DESIGN_BASELINE.md")]
RENDERS = {Path("docs/architecture/a05/A-05_PROPOSAL_STATIC_RENDER.svg"): "PROPOSAL_COMPARE|CONTEXT_DRAWER", Path("docs/architecture/a05/A-05_DECISION_STATIC_RENDER.svg"): "DECISION_BOARD|DESIGN_BASELINE"}
RAW_PATHS = {
    "docs/architecture/a05/A-05_DESIGN_DECISION_CATALOG.json", "docs/architecture/a05/A-05_PROPOSAL_COMPARE.md", "docs/architecture/a05/A-05_DECISION_BOARD.md", "docs/architecture/a05/A-05_DESIGN_BASELINE.md",
    "docs/architecture/a05/A-05_PROPOSAL_STATIC_RENDER.svg", "docs/architecture/a05/A-05_DECISION_STATIC_RENDER.svg", "scripts/check_a05_design_decisions.py", "tests/tooling/test_a05_design_decisions.py",
    "tests/fixtures/a05/canonical-contract.json", "tests/fixtures/a05/mutation-catalog.json", "docs/validation/A-05_DESIGN_DECISION_VALIDATION.md", "docs/completion_reports/A-05_COMPLETION_REPORT.md",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(errors: list[str]) -> list[str]:
    return list(dict.fromkeys(errors))


def validate_catalog(c: dict[str, Any]) -> list[str]:
    e: list[str] = []
    if c.get("predecessor_contract") != EXPECTED_PREDECESSOR: e.append("PREDECESSOR_BINDING_MISMATCH")
    p = c.get("proposal_contract", {})
    if p.get("proposal_set_fields") != PROPOSAL_SET_FIELDS or p.get("states") != PROPOSAL_STATES or p.get("actions") != PROPOSAL_ACTIONS: e.append("PROPOSAL_CONTRACT_MISMATCH")
    if p.get("minimum_proposals") != 2 or len(p.get("sample_proposals", [])) < 2: e.append("PROPOSAL_MINIMUM_NOT_MET")
    if p.get("proposal_fields") != PROPOSAL_FIELDS or any(set(item) != set(PROPOSAL_FIELDS) for item in p.get("sample_proposals", [])): e.append("PROPOSAL_FIELD_MISSING")
    if any(not item.get("evidence_refs") for item in p.get("sample_proposals", [])) or p.get("readiness_guard") != {"minimum_count_enforced": True, "all_fields_required": True, "evidence_refs_required": True, "subject_hash_required": True}: e.append("PROPOSAL_EVIDENCE_MISSING")
    rec = p.get("agent_recommendation", {})
    if rec.get("is_selected") is not False or rec.get("is_approved") is not False or not rec.get("reason"): e.append("RECOMMENDATION_DECISION_CONTAMINATION")
    d = c.get("decision_contract", {})
    if d.get("states") != DECISION_STATES or d.get("fields") != DECISION_FIELDS: e.append("DECISION_CONTRACT_MISMATCH")
    if d.get("confirmation_guard") != {"authenticated_human_required": True, "exact_subject_hash_required": True, "selected_option_required": True, "reason_required": True, "agent_can_confirm": False}: e.append("HUMAN_HASH_CONFIRMATION_GUARD_MISMATCH")
    carry = d.get("carryover_contract", {})
    if carry.get("required_for_hold_and_future_extension") is not True or carry.get("statuses") != ["HOLD", "FUTURE_EXTENSION"] or "target_revision" not in carry.get("fields", []): e.append("CARRYOVER_MISSING")
    lineage = d.get("lineage_contract", {})
    if lineage != {"acyclic_required": True, "superseded_preserved": True, "subject_hash_continuity_required": True, "carryover_target_must_exist": True}: e.append("DECISION_LINEAGE_INVALID")
    b = c.get("design_baseline_contract", {})
    if b.get("specification_fields") != SPEC_FIELDS or b.get("baseline_fields") != BASELINE_FIELDS or b.get("states") != DESIGN_STATES: e.append("DESIGN_BASELINE_CONTRACT_MISMATCH")
    if b.get("approval_guard") != {"unresolved_required_decisions": 0, "source_evidence_valid_required": True, "authenticated_human_required": True, "exact_spec_hash_required": True, "reason_and_next_action_when_disabled": True}: e.append("DESIGN_APPROVAL_BLOCKED")
    if b.get("immutability_contract") != {"approved_baseline_immutable": True, "spec_change_invalidates_approval": True, "hash_change_invalidates_approval": True, "new_revision_and_approval_required": True, "historical_baseline_preserved": True}: e.append("APPROVED_BASELINE_MUTATION")
    if c.get("context_drawer_contract") != {"source": "A-04", "width_px": 360, "mode": "ON_DEMAND", "fields": ["impact", "source", "evidence", "hash", "decision_history", "reason", "next_action"], "persistent_box_allowed": False}: e.append("A04_DRAWER_CONTRACT_MISMATCH")
    edge = c.get("edge_contract", {})
    if edge.get("hold_revision_different_keep_execute_closed") is not True or edge.get("unresolved_or_invalid_evidence_blocks_approval") is not True or len(edge.get("edges", [])) != 8: e.append("DECISION_EDGE_CONTRACT_MISMATCH")
    if c.get("execution_guard") != {"execute_open_in_a05": False, "human_select_opens_design_refinement_only": True, "selection_is_not_apply_approval": True, "unresolved_decision_blocks_execute": True}: e.append("EXECUTION_GUARD_MISMATCH")
    perm = c.get("permission_contract", {})
    if perm.get("capabilities") != PERMISSIONS or any(perm.get(k) is not True for k in ("capabilities_separated", "project_view_does_not_imply_decision_or_approval", "unauthorized_action_disabled", "reason_and_next_action_visible")): e.append("PERMISSION_BOUNDARY_MISMATCH")
    disclosure = c.get("disclosure_contract", {})
    if any(disclosure.get(k) is not False for k in ("secret_value_visible", "raw_internal_endpoint_visible", "loopback_endpoint_visible", "unauthorized_full_path_visible")) or disclosure.get("masked_evidence_reference_allowed") is not True: e.append("SENSITIVE_DISCLOSURE_FORBIDDEN")
    if c.get("verification_contract") != EXPECTED_VERIFICATION: e.append("VERIFICATION_CONTRACT_MISMATCH")
    return _dedupe(e)


def validate_predecessors(root: Path) -> list[str]:
    errors = []
    for path, expected in PREDECESSORS.values():
        try:
            if sha256_file(root / path) != expected: errors.append("PREDECESSOR_ARTIFACT_HASH_MISMATCH")
        except OSError: errors.append("PREDECESSOR_ARTIFACT_MISSING")
    return _dedupe(errors)


def validate_documents(root: Path) -> list[str]:
    required = ["STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "NOT_EXECUTED", "reason", "next_action"]
    errors = []
    for path in DOCUMENTS:
        try: text = (root / path).read_text(encoding="utf-8")
        except OSError: errors.append("DOCUMENT_MISSING"); continue
        if any(item not in text for item in required): errors.append("DOCUMENT_SEMANTIC_BINDING_MISMATCH")
    return _dedupe(errors)


def validate_renders(root: Path) -> list[str]:
    allowed = {"#0B1220", "#142033", "#1B2A42", "#F7F9FC", "#B8C4D8", "#60738F", "#7DB4FF", "#F8D66D", "#5EE3A1", "#FFD166", "#FF7B86", "#C4A7FF", "#74D7FF"}
    errors = []
    for path, surfaces in RENDERS.items():
        try: text = (root / path).read_text(encoding="utf-8"); ET.fromstring(text)
        except (OSError, ET.ParseError): errors.append("STATIC_RENDER_MISSING_OR_INVALID"); continue
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-surface-ids="{surfaces}"', "STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "E-SHOT_STATIC_NOT_RUNTIME_UI", "E-EVT_NOT_EXECUTED", "NOT_EXECUTED"]
        if any(x not in text for x in required): errors.append("STATIC_RENDER_SEMANTIC_BINDING_MISMATCH")
        if {m.upper() for m in re.findall(r"#[0-9A-Fa-f]{6}\b", text)} - allowed: errors.append("STATIC_RENDER_RAW_COLOR_BYPASS")
    return _dedupe(errors)


def _apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(document); parts = str(mutation["path"]).split("."); target: Any = result
    for part in parts[:-1]: target = target[int(part)] if isinstance(target, list) else target[part]
    key = parts[-1]
    if mutation["operation"] == "remove": target.pop(int(key)) if isinstance(target, list) else target.pop(key, None)
    elif isinstance(target, list): target[int(key)] = mutation.get("value")
    else: target[key] = mutation.get("value")
    return result


def validate_mutation_fixture(catalog: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    errors = []; seen = set()
    for mutation in fixture.get("mutations", []):
        mid, expected = mutation.get("mutation_id"), mutation.get("expected_error_code")
        if not mid or mid in seen or not expected: errors.append("MUTATION_FIXTURE_INVALID"); continue
        seen.add(mid)
        try: actual = validate_catalog(_apply_mutation(catalog, mutation))
        except (KeyError, IndexError, TypeError, ValueError): errors.append("MUTATION_FIXTURE_INVALID"); continue
        if expected not in actual: errors.append("MUTATION_EXPECTED_REASON_NOT_OBSERVED")
    return _dedupe(errors)


def _projection(raw: list[dict[str, Any]]) -> bytes:
    return json.dumps([{"path": str(x.get("path", "")), "sha256": str(x.get("sha256", ""))} for x in sorted(raw, key=lambda x: str(x.get("path", "")))], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def manifest_target(raw: list[dict[str, Any]]) -> str: return hashlib.sha256(_projection(raw)).hexdigest().upper()


def validate_evidence_manifest(root: Path, m: dict[str, Any]) -> list[str]:
    raw = m.get("raw_artifacts", []); errors = []
    if not isinstance(raw, list) or not raw: return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    if m.get("self_reference") is not False: errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    paths = set(); content_bytes = 0
    for item in raw:
        rel = str(item.get("path", ""))
        if not rel or rel in paths: errors.append("EVIDENCE_RAW_PATH_INVALID"); continue
        paths.add(rel); path = root / rel
        if not path.is_file(): errors.append("EVIDENCE_RAW_ARTIFACT_MISSING"); continue
        content_bytes += path.stat().st_size
        if item.get("bytes") != path.stat().st_size: errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != sha256_file(path): errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    if paths != RAW_PATHS: errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    projection = _projection(raw); target = manifest_target(raw)
    if m.get("target_canonical_bytes") != len(projection): errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    if m.get("target_content_bytes") != content_bytes: errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    if m.get("target_hash") != target or m.get("delivered_hash") != target: errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected = {"work_instruction_sha256": "F80E1641704BD0FD436F220A13228463FFEC6E2585F083A0405075B2C5E8375C", "assigned_verification_ids": ["AV-FLOW-001"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI / E-EVT_NOT_EXECUTED"}
    if any(m.get(k) != v for k, v in expected.items()): errors.append("EVIDENCE_RUNTIME_QUALIFIER_MISMATCH")
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
    parser = argparse.ArgumentParser(); parser.add_argument("--root", type=Path, default=Path.cwd()); parser.add_argument("--json", action="store_true"); parser.add_argument("--without-manifest", action="store_true"); args = parser.parse_args()
    errors = validate_bundle(args.root.resolve(), require_manifest=not args.without_manifest)
    payload = {"status": "PASS" if not errors else "FAIL", "package_id": "A-05", "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-05 design decision contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__": raise SystemExit(main())
