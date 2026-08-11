#!/usr/bin/env python3
"""Fail-closed validator for A-06 planning, instruction, and approval artifacts."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


CATALOG_REL = Path("docs/architecture/a06/A-06_PLANNING_APPROVAL_CATALOG.json")
MANIFEST_REL = Path("docs/evidence/manifests/A-06_EVIDENCE_MANIFEST.json")
PREDECESSORS = {
    "a01": (Path("docs/architecture/a01/A-01_PATH_CATALOG.json"), "FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69"),
    "a02": (Path("docs/architecture/a02/A-02_TOKEN_CATALOG.json"), "1709D227BB9C44480085CB10B53881B1613AED914F868B629F8B2C3D03D23207"),
    "a03": (Path("docs/architecture/a03/A-03_ONBOARDING_CATALOG.json"), "464F785FB0A72C3E5571D30755EE3A107259D641A6035830B18343E5A0922093"),
    "a04": (Path("docs/architecture/a04/A-04_WORKBENCH_CATALOG.json"), "230E32C99256F80904660735BA8B4A8BF95F9068164D8906E9E872EEE96AFE73"),
    "a05": (Path("docs/architecture/a05/A-05_DESIGN_DECISION_CATALOG.json"), "83A8987AED3C1442FBAFF4D2237185FC3BCAEEDC2C352C2F794B91091A4F138B"),
}
EXPECTED_PREDECESSORS = {key: {"path": str(path).replace("\\", "/"), "sha256": digest} for key, (path, digest) in PREDECESSORS.items()}
WORK_PLAN_FIELDS = ["artifact_id", "version", "status", "content_hash", "baseline_ref", "objective", "roles", "included_scope", "excluded_scope", "protected_scope", "dependency_graph", "iterations", "preconditions", "deliverables", "completion_conditions", "verification_contract", "risks", "budget", "approval_ref"]
ITERATION_FIELDS = ["iteration_id", "parent_plan_ref", "parent_plan_hash", "sequence", "status", "included_scope", "excluded_scope", "preconditions", "deliverables", "completion_conditions", "verification_contract", "risks", "carryover", "dependencies"]
G04_WI_FIELDS = ["artifact_id", "artifact_type", "project_id", "version", "artifact_status", "content_hash", "source_artifact_ids", "source_evidence_ids", "created_by", "created_at", "supersedes_artifact_id", "artifact_path", "package_id", "package_status", "revision", "supersedes_work_instruction_id", "design_baseline_ref", "work_plan_ref", "approval_ref", "owner", "executor", "goal", "preconditions", "included_scope", "excluded_scope", "protected_scope", "allowed_paths", "forbidden_paths", "allowed_actions", "forbidden_actions", "rollback_boundary", "completion_conditions", "result_contract", "report_contract", "reconstruction_contract", "verification_contract"]
APPROVAL_TYPES = ["PLAN", "SCOPE_CHANGE", "APPLY", "DEPLOY", "DESTRUCTIVE"]
APPROVAL_RECORD_FIELDS = ["approval_id", "approval_type", "subject_artifact_id", "subject_hash", "scope", "requested_by", "decided_by", "decision", "reason", "requested_at", "decided_at", "expires_at", "invalidated_at", "supersedes_approval_id"]
NONSEMANTIC_FIELDS = ["binding_id", "parent_baseline_id", "root_human_approval_id", "old_hash", "new_hash", "semantic_diff", "impact", "rationale", "actor", "recorded_at", "scope_before", "scope_after", "scope_expanded"]
PERMISSIONS = ["PROJECT_VIEW", "PLAN_EDIT", "PLAN_APPROVE", "ITERATION_MANAGE", "WI_EDIT", "WI_APPROVE", "APPROVAL_DECIDE", "NON_SEMANTIC_RECONFIRM", "APPLY_DECIDE", "DEPLOY_DECIDE", "DESTRUCTIVE_DECIDE"]
EXPECTED_VERIFICATION = {"assigned_verification_ids": ["AV-SAFE-005", "AV-FLOW-003"], "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "required_evidence": ["E-ART"], "not_executed_evidence": ["E-API", "E-AUD", "E-SHOT", "E-EVT"], "runtime_owners": ["B-04", "C-14"], "environment": "ENV-LOCAL"}
DOCUMENTS = [
    Path("docs/architecture/a06/A-06_WORKPLAN_ITERATION.md"),
    Path("docs/architecture/a06/A-06_WORK_INSTRUCTION_INVOCATION.md"),
    Path("docs/architecture/a06/A-06_APPROVAL_CENTER.md"),
    Path("docs/architecture/a06/A-06_NONSEMANTIC_BASELINE.md"),
]
RENDERS = {
    Path("docs/architecture/a06/A-06_WORKPLAN_STATIC_RENDER.svg"): "WORKPLAN_OVERVIEW|ITERATION_BOARD",
    Path("docs/architecture/a06/A-06_INSTRUCTION_STATIC_RENDER.svg"): "WORK_INSTRUCTION_REVIEW|INVOCATION_PREVIEW",
    Path("docs/architecture/a06/A-06_APPROVAL_STATIC_RENDER.svg"): "APPROVAL_CENTER|NONSEMANTIC_BASELINE",
}
RAW_PATHS = {
    "docs/architecture/a06/A-06_PLANNING_APPROVAL_CATALOG.json", "docs/architecture/a06/A-06_WORKPLAN_ITERATION.md", "docs/architecture/a06/A-06_WORK_INSTRUCTION_INVOCATION.md", "docs/architecture/a06/A-06_APPROVAL_CENTER.md", "docs/architecture/a06/A-06_NONSEMANTIC_BASELINE.md",
    "docs/architecture/a06/A-06_WORKPLAN_STATIC_RENDER.svg", "docs/architecture/a06/A-06_INSTRUCTION_STATIC_RENDER.svg", "docs/architecture/a06/A-06_APPROVAL_STATIC_RENDER.svg", "scripts/check_a06_planning_approvals.py", "tests/tooling/test_a06_planning_approvals.py",
    "tests/fixtures/a06/canonical-contract.json", "tests/fixtures/a06/mutation-catalog.json", "docs/validation/A-06_PLANNING_APPROVAL_VALIDATION.md", "docs/completion_reports/A-06_COMPLETION_REPORT.md",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(errors: list[str]) -> list[str]:
    return list(dict.fromkeys(errors))


def validate_catalog(c: dict[str, Any]) -> list[str]:
    e: list[str] = []
    if c.get("predecessor_contract") != EXPECTED_PREDECESSORS: e.append("PREDECESSOR_BINDING_MISMATCH")
    plan = c.get("work_plan_contract", {})
    if plan.get("fields") != WORK_PLAN_FIELDS or plan.get("hash_bound_required") is not True or plan.get("approved_immutable") is not True: e.append("WORK_PLAN_CONTRACT_MISMATCH")
    if plan.get("required_graph_properties") != {"acyclic": True, "all_iterations_reachable": True, "predecessors_exist": True}: e.append("WORK_PLAN_GRAPH_INVALID")
    iteration = c.get("iteration_contract", {})
    if iteration.get("fields") != ITERATION_FIELDS or iteration.get("parent_scope_subset_required") is not True or iteration.get("parent_hash_exact_required") is not True: e.append("ITERATION_CONTRACT_MISMATCH")
    wi = c.get("work_instruction_contract", {})
    if wi.get("g04_template_sha256") != "6E6663FC339D3FA60DE5DAA8326721A247287096991A020958736670AE789177" or wi.get("template_fields") != G04_WI_FIELDS: e.append("WORK_INSTRUCTION_TEMPLATE_MISMATCH")
    if wi.get("allowed_forbidden_disjoint_required") is not True or wi.get("rollback_required") is not True or wi.get("completion_required") is not True or wi.get("result_report_required") is not True or wi.get("reconstruction_and_verification_required") is not True: e.append("WORK_INSTRUCTION_GUARD_MISSING")
    if set(wi.get("sample_allowed_paths", [])) & set(wi.get("sample_forbidden_paths", [])): e.append("WORK_INSTRUCTION_SCOPE_OVERLAP")
    inv = c.get("invocation_contract", {})
    expected_inv = ["invocation_id", "work_instruction_id", "work_instruction_sha256", "approval_subject_hash", "execution_mode", "agent_role", "completion_report_path", "instruction"]
    if inv.get("fields") != expected_inv or inv.get("duplicated_work_instruction_sections") != [] or inv.get("duplicated_section_count") != 0: e.append("INVOCATION_DUPLICATION_OR_FIELD_MISMATCH")
    if inv.get("reference_only") is not True or inv.get("work_instruction_hash_change_marks_stale") is not True or inv.get("approval_subject_hash_change_marks_stale") is not True or inv.get("stale_blocks_execution") is not True: e.append("INVOCATION_STALE_GUARD_MISSING")
    approval = c.get("approval_contract", {})
    if approval.get("types") != APPROVAL_TYPES or approval.get("record_fields") != APPROVAL_RECORD_FIELDS: e.append("APPROVAL_TYPE_OR_RECORD_MISMATCH")
    if any(approval.get(k) is not True for k in ("independent_lanes", "cross_substitution_forbidden", "cross_record_reuse_forbidden", "expiry_blocks", "artifact_hash_change_invalidates", "baseline_hash_change_invalidates", "work_instruction_hash_change_invalidates")): e.append("APPROVAL_INDEPENDENCE_GUARD_MISSING")
    if approval.get("approval_triggers_execution") is not False or len(approval.get("sample_records", [])) != 5 or [x.get("approval_type") for x in approval.get("sample_records", [])] != APPROVAL_TYPES: e.append("APPROVAL_COLLAPSE_OR_AUTORUN")
    if any(set(x) != set(APPROVAL_RECORD_FIELDS) for x in approval.get("sample_records", [])): e.append("APPROVAL_RECORD_FIELD_MISSING")
    ns = c.get("nonsemantic_baseline_contract", {})
    if ns.get("fields") != NONSEMANTIC_FIELDS or ns.get("root_and_parent_chain_required") is not True or ns.get("old_new_hash_required") is not True: e.append("NONSEMANTIC_LINEAGE_INVALID")
    sample = ns.get("sample_binding", {})
    if set(sample) != set(NONSEMANTIC_FIELDS) or sample.get("semantic_diff") != "NONE": e.append("NONSEMANTIC_MISCLASSIFIED")
    if sample.get("scope_expanded") is not False or sample.get("scope_before") != sample.get("scope_after") or ns.get("scope_nonexpansion_required") is not True: e.append("NONSEMANTIC_SCOPE_EXPANSION")
    if ns.get("material_change_requires_human_approval") is not True or ns.get("main_reconfirm_cannot_replace_human_material_approval") is not True: e.append("MATERIAL_CHANGE_HUMAN_GUARD_MISSING")
    permission = c.get("permission_contract", {})
    if permission.get("capabilities") != PERMISSIONS or any(permission.get(k) is not True for k in ("capabilities_separated", "unauthorized_action_disabled", "reason_and_next_action_visible")): e.append("PERMISSION_BOUNDARY_MISMATCH")
    execution = c.get("execution_guard", {})
    if execution != {"apply_open_in_a06": False, "deploy_open_in_a06": False, "destructive_open_in_a06": False, "approval_auto_runs": False, "static_review_only": True}: e.append("A06_EXECUTION_BOUNDARY_BREACH")
    disclosure = c.get("disclosure_contract", {})
    if any(disclosure.get(k) is not False for k in ("secret_visible", "raw_internal_endpoint_visible", "loopback_endpoint_visible", "unauthorized_full_path_visible")) or disclosure.get("masked_reference_allowed") is not True: e.append("SENSITIVE_DISCLOSURE_FORBIDDEN")
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
    required = ["STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "E-API NOT_EXECUTED", "E-AUD NOT_EXECUTED", "reason", "next_action"]
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
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-surface-ids="{surfaces}"', "STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "E-API NOT_EXECUTED", "E-AUD NOT_EXECUTED"]
        if any(item not in text for item in required): errors.append("STATIC_RENDER_SEMANTIC_BINDING_MISMATCH")
        if {m.upper() for m in re.findall(r"#[0-9A-Fa-f]{6}\b", text)} - allowed: errors.append("STATIC_RENDER_RAW_COLOR_BYPASS")
    return _dedupe(errors)


def _apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(document); target: Any = result; parts = str(mutation["path"]).split(".")
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


def manifest_target(raw: list[dict[str, Any]]) -> str:
    return hashlib.sha256(_projection(raw)).hexdigest().upper()


def validate_evidence_manifest(root: Path, manifest: dict[str, Any]) -> list[str]:
    raw = manifest.get("raw_artifacts", []); errors = []
    if not isinstance(raw, list) or not raw: return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    if manifest.get("self_reference") is not False: errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
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
    if manifest.get("target_canonical_bytes") != len(projection): errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    if manifest.get("target_content_bytes") != content_bytes: errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target: errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected = {"work_instruction_sha256": "83B1F04472D28631CF73645486D8EC138BBB75B7F8EE8679BDA4F8B0C37AECC6", "assigned_verification_ids": ["AV-SAFE-005", "AV-FLOW-003"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "not_executed_evidence": ["E-API", "E-AUD", "E-SHOT", "E-EVT"]}
    if any(manifest.get(k) != v for k, v in expected.items()): errors.append("EVIDENCE_RUNTIME_QUALIFIER_MISMATCH")
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
    payload = {"status": "PASS" if not errors else "FAIL", "package_id": "A-06", "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-06 planning approval contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__": raise SystemExit(main())
