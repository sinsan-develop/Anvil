from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


CATALOG_REL = "docs/architecture/a09/A-09_LEARNING_AUTOMATION_CATALOG.json"
MANIFEST_REL = "docs/evidence/manifests/A-09_EVIDENCE_MANIFEST.json"
SOURCE_FIELDS = ["source_id", "locator", "content_hash", "provenance", "license", "confidentiality", "exclusions", "security_scan", "status"]
LEARNING_STATES = ["SOURCE_CAPTURED", "CANDIDATE", "EVALUATED", "APPROVED", "ACTIVE", "APPLIED", "ROLLED_BACK", "REVOKED"]
SKILL_STATES = ["DRAFT", "PILOT", "ACTIVE", "DEPRECATED", "ARCHIVED"]
SELECTION_TRACE_FIELDS = ["run_id", "matched_evidence", "selected_skill_version", "selection_reason", "rejected_candidates", "loaded_resources", "precondition_results", "result"]
PROGRESSIVE_DISCLOSURE = ["L0_CATALOG_MATCH", "L1_FULL_SKILL_AFTER_SELECTION", "L2_REFERENCE_ON_DEMAND"]
HOOK_STATES = ["OBSERVED", "DRAFT", "STATIC_VALIDATED", "SHADOW", "PILOT", "TRUST_REVIEW", "ACTIVE", "QUARANTINED", "RETIRED"]
HOOK_PRECEDENCE = ["DENY", "ASK", "MODIFY", "ALLOW"]

AUTHORITY = {
    "design": "246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5",
    "work_plan": "A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A",
    "validation_matrix": "982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A",
    "test_plan": "803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8",
    "operating_rules": "4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E",
}
PREDECESSORS = {
    "A-01": ("docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json", "BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4"),
    "A-02": ("docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json", "779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168"),
    "A-03": ("docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json", "772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE"),
    "A-04": ("docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json", "C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB"),
    "A-05": ("docs/evidence/manifests/A-05_EVIDENCE_MANIFEST.json", "90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1"),
    "A-06": ("docs/evidence/manifests/A-06_EVIDENCE_MANIFEST.json", "A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449"),
    "A-07": ("docs/evidence/manifests/A-07_EVIDENCE_MANIFEST.json", "796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7"),
    "A-08": ("docs/evidence/manifests/A-08_EVIDENCE_MANIFEST.json", "73CC3936D3AF55674412C746B1CB95D53F08B3C8BDA927765286F3E60BE6C9A5"),
}
DOCUMENTS = [
    "docs/architecture/a09/A-09_SOURCE_CANDIDATE.md",
    "docs/architecture/a09/A-09_ACTIVATION_ROLLBACK.md",
    "docs/architecture/a09/A-09_SKILL_SELECTION.md",
    "docs/architecture/a09/A-09_HOOK_REPLAY.md",
    "docs/architecture/a09/A-09_AGENT_DEFINITION.md",
]
RENDERS = {
    "docs/architecture/a09/A-09_LEARNING_STATIC_RENDER.svg": "source,candidate,evaluation,activation,applied-run,rollback",
    "docs/architecture/a09/A-09_SKILL_STATIC_RENDER.svg": "skill-catalog,selection-trace,progressive-disclosure,pilot",
    "docs/architecture/a09/A-09_HOOK_AGENT_STATIC_RENDER.svg": "hook-catalog,replay,trust,agent-definition",
}
RAW_PATHS = {CATALOG_REL, *DOCUMENTS, *RENDERS.keys(), "scripts/check_a09_learning_automation.py", "tests/tooling/test_a09_learning_automation.py", "tests/fixtures/a09/canonical-contract.json", "tests/fixtures/a09/mutation-catalog.json", "docs/validation/A-09_LEARNING_AUTOMATION.md", "docs/completion_reports/A-09_COMPLETION_REPORT.md"}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def validate_catalog(c: dict[str, Any]) -> list[str]:
    e: list[str] = []
    if c.get("artifact_id") != "A-09-LEARNING-AUTOMATION-CATALOG-001" or c.get("package_id") != "A-09": e.append("CATALOG_IDENTITY_MISMATCH")
    if c.get("authority_hashes") != AUTHORITY: e.append("AUTHORITY_BINDING_MISMATCH")
    expected_pred = [{"package_id": k, "path": v[0], "sha256": v[1], "status": "ACCEPTED"} for k, v in PREDECESSORS.items()]
    if c.get("predecessor_bindings") != expected_pred: e.append("PREDECESSOR_BINDING_MISMATCH")
    source = c.get("learning_source", {})
    if source.get("required_fields") != SOURCE_FIELDS or source.get("unverified_positive_exemplar_forbidden") is not True or source.get("revoked_blocks_new_use") is not True or source.get("affected_runs_isolated_and_reported") is not True or source.get("derived_artifacts_quarantined") is not True: e.append("SOURCE_PROVENANCE_REVOKE_MISMATCH")
    lifecycle = c.get("learning_lifecycle", {})
    if lifecycle.get("states") != LEARNING_STATES or lifecycle.get("candidate_fields") != ["candidate_id", "source_refs", "diff", "reason", "scope", "risk", "evaluation_ref", "approval_ref", "trust_ref", "no_change_reason"] or lifecycle.get("activation_binding") != ["candidate_id", "version", "content_hash", "approval_id", "applies_from_snapshot"] or lifecycle.get("current_run_snapshot_immutable") is not True or lifecycle.get("rollback_preserves_lineage") is not True or lifecycle.get("candidate_evaluated_approved_active_applied_distinct") is not True: e.append("LEARNING_LIFECYCLE_SNAPSHOT_MISMATCH")
    skill = c.get("skill_contract", {})
    if skill.get("lifecycle") != SKILL_STATES or skill.get("minimum_representative_pilots") != 3 or skill.get("reproducibility_required") is not True or skill.get("human_approval_required_for_new_skill") is not True or skill.get("selection_trace_fields") != SELECTION_TRACE_FIELDS or skill.get("progressive_disclosure") != PROGRESSIVE_DISCLOSURE or skill.get("unselected_skill_not_loaded") is not True or skill.get("precondition_failure_blocks_execution") is not True: e.append("SKILL_PILOT_SELECTION_DISCLOSURE_MISMATCH")
    hook = c.get("hook_contract", {})
    if hook.get("contract") != ["EVENT", "MATCHER", "PROGRAM", "RESULT_OR_FAULT_POLICY"] or hook.get("lifecycle") != HOOK_STATES or hook.get("trust_binding") != ["hook_version_id", "definition_hash", "principal_id"] or hook.get("program_trust_binding") != ["program_version_id", "program_hash", "permission_profile_id", "principal_id"] or hook.get("changed_hash_invalidates_trust") is not True or hook.get("shadow_side_effect_forbidden") is not True or hook.get("pilot_replay_required") is not True or hook.get("decision_precedence") != HOOK_PRECEDENCE: e.append("HOOK_TRUST_SHADOW_PILOT_MISMATCH")
    safety = hook.get("safety", {})
    if safety.get("timeout_policies") != ["FAIL_OPEN", "FAIL_CLOSED"] or safety.get("timeout_policy_visible_in_ui_and_audit") is not True or safety.get("permission_profile_hash_bound") is not True or safety.get("recursion_guard_required") is not True or safety.get("recursion_max_depth") != 1 or safety.get("modify_conflict_blocks_without_merge") is not True or safety.get("all_matching_hooks_execute") is not True or safety.get("hook_subagent_spawn_forbidden") is not True: e.append("HOOK_SAFETY_PRECEDENCE_MISMATCH")
    agent = c.get("agent_definition", {})
    if agent.get("definition_instance_separated") is not True or agent.get("permission_mode") != "inherit_and_narrow" or agent.get("permission_expansion_forbidden") is not True or agent.get("persistent_memory_default") != "none" or agent.get("hook_subagent_spawn_forbidden") is not True or agent.get("effective_permission_diff_visible") is not True: e.append("AGENT_PERMISSION_BOUNDARY_MISMATCH")
    disclosure = c.get("disclosure_contract", {})
    if any(disclosure.get(k) is not False for k in ("secret_visible", "credential_literal_visible", "raw_internal_endpoint_visible", "loopback_endpoint_visible")) or disclosure.get("masked_reference_allowed") is not True: e.append("SENSITIVE_DISCLOSURE_FORBIDDEN")
    expected_verification = [
        {"assigned_id":"AV-LRN-018","level":"L4","method":"AE","evidence":"E-SHOT","severity":"MAJOR","execution_classification":"STATIC_ONLY","package_verdict":"STATIC_CONTRACT_PASS","runtime_owner":"D-12","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED"},
        {"assigned_id":"AV-LRN-024","level":"L4","method":"MX","evidence":"E-SHOT,E-AUD","severity":"MAJOR","execution_classification":"STATIC_ONLY","package_verdict":"STATIC_CONTRACT_PASS","runtime_owner":"D-12","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED"},
    ]
    if c.get("verification_contracts") != expected_verification: e.append("VERIFICATION_CONTRACT_MISMATCH")
    return _dedupe(e)


def validate_predecessors(root: Path) -> list[str]:
    errors: list[str] = []
    for path, expected in PREDECESSORS.values():
        try:
            if sha256_file(root / path) != expected: errors.append("PREDECESSOR_ARTIFACT_HASH_MISMATCH")
        except OSError: errors.append("PREDECESSOR_ARTIFACT_MISSING")
    return _dedupe(errors)


def validate_documents(root: Path) -> list[str]:
    required = ["STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "AV-LRN-018", "AV-LRN-024", "D-12", "Skill activation NOT_EXECUTED", "Hook activation NOT_EXECUTED", "actual Run", "reason", "next_action"]
    errors: list[str] = []
    for path in DOCUMENTS:
        try: text = (root / path).read_text(encoding="utf-8")
        except OSError: errors.append("DOCUMENT_MISSING"); continue
        if any(item not in text for item in required): errors.append("DOCUMENT_SEMANTIC_BINDING_MISMATCH")
    return _dedupe(errors)


def validate_renders(root: Path) -> list[str]:
    allowed = {"#0B1220", "#142033", "#1B2A42", "#F7F9FC", "#B8C4D8", "#60738F", "#7DB4FF", "#F8D66D", "#5EE3A1", "#FFD166", "#FF7B86", "#C4A7FF", "#74D7FF"}
    errors: list[str] = []
    for path, surfaces in RENDERS.items():
        try: text = (root / path).read_text(encoding="utf-8"); ET.fromstring(text)
        except (OSError, ET.ParseError): errors.append("STATIC_RENDER_MISSING_OR_INVALID"); continue
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-surface-ids="{surfaces}"', "STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "Skill activation NOT_EXECUTED", "Hook activation NOT_EXECUTED", "actual Run"]
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
    errors: list[str] = []; seen: set[str] = set()
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
    raw = manifest.get("raw_artifacts", []); errors: list[str] = []
    if not isinstance(raw, list) or not raw: return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    if manifest.get("self_reference") is not False: errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    paths: set[str] = set(); content_bytes = 0
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
    expected = {"work_instruction_sha256":"5BB6F711EB22B8AF776CD04F5E51004B3DACB58D47B8E822BF55854650D152AC","assigned_verification_ids":["AV-LRN-018","AV-LRN-024"],"execution_classification":"STATIC_ONLY","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED","not_executed_evidence":["L4","AE","MX","E-SHOT","E-AUD","SKILL_ACTIVATION","HOOK_ACTIVATION","RUNTIME","ACTUAL_DIR"]}
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
    payload = {"status":"PASS" if not errors else "FAIL","package_id":"A-09","execution_classification":"STATIC_ONLY","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED","errors":errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-09 learning automation contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__": raise SystemExit(main())
