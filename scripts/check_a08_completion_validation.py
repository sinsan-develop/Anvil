from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


CATALOG_REL = "docs/architecture/a08/A-08_COMPLETION_VALIDATION_CATALOG.json"
MANIFEST_REL = "docs/evidence/manifests/A-08_EVIDENCE_MANIFEST.json"
PLAN_ACTUAL_FIELDS = ["plan_item_id", "planned_scope", "actual_scope", "status", "difference", "reason", "impact", "evidence_refs", "next_action"]
RESULT_LAYERS = ["DEVELOPER_RESULT", "MAIN_PRELIMINARY_ACCEPT", "INDEPENDENT_TECHNICAL_VERIFICATION", "PRODUCT_VALIDATION", "DEFECT_ASSESSMENT", "HUMAN_RELEASE_DECISION", "APPLY_DEPLOY_ELIGIBILITY"]
TECHNICAL_RESULTS = ["PASS", "FAIL", "SKIPPED", "BLOCKED", "ERROR"]
PV_VERDICTS = ["SUITABLE", "NEEDS_IMPROVEMENT", "UNSUITABLE", "BLOCKED"]
PV_CRITERION_FIELDS = ["criterion_id", "required", "target_hash", "delivered_hash", "verdict", "evidence_refs", "validator_actor", "validated_at", "reason", "next_action"]
DEFECT_LIFECYCLE = ["OPEN", "ACCEPTED", "FIXING", "READY_FOR_RETEST", "CLOSED"]
RELEASE_DECISIONS = ["RELEASE", "REWORK", "DEFER", "REJECT"]
RELEASE_GUARDS = ["ALL_REQUIRED_PV_COMPLETE", "NO_REQUIRED_PV_BLOCKED", "NO_REQUIRED_PV_UNSUITABLE", "NO_BLOCKING_DEFECT", "TARGET_DELIVERED_HASH_MATCH", "EVIDENCE_HASH_CURRENT", "AUTHENTICATED_HUMAN_DECISION"]
REWORK_EFFECT = {"pause_successor": True, "wi_revision_required": True, "fresh_validation_required": True}
DEFER_EFFECT = {"reason_required": True, "risk_required": True, "review_at_required": True, "carryover_required": True, "downstream_disabled": True}
REJECT_EFFECT = {"downstream_disabled": True, "apply_forbidden": True, "deploy_forbidden": True, "new_human_decision_required": True}
INVALIDATED_OBJECTS = ["TECHNICAL_EVIDENCE", "PRODUCT_VALIDATION", "DEFECT_RETEST", "MAIN_ACCEPTANCE", "RELEASE_DECISION", "APPLY_ELIGIBILITY", "DEPLOY_ELIGIBILITY"]

PREDECESSORS = {
    "G-04": ("docs/evidence/manifests/G-04_EVIDENCE_MANIFEST.json", "F2674994201407532D6E18A9F9A0A94B606BA94385DCD126C03AF7F8264B09C1"),
    "A-01": ("docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json", "BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4"),
    "A-02": ("docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json", "779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168"),
    "A-03": ("docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json", "772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE"),
    "A-04": ("docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json", "C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB"),
    "A-05": ("docs/evidence/manifests/A-05_EVIDENCE_MANIFEST.json", "90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1"),
    "A-06": ("docs/evidence/manifests/A-06_EVIDENCE_MANIFEST.json", "A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449"),
    "A-07": ("docs/evidence/manifests/A-07_EVIDENCE_MANIFEST.json", "796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7"),
}
DOCUMENTS = [
    "docs/architecture/a08/A-08_COMPLETION_PLAN_ACTUAL.md",
    "docs/architecture/a08/A-08_TECHNICAL_PRODUCT_VALIDATION.md",
    "docs/architecture/a08/A-08_DEFECT_RETEST.md",
    "docs/architecture/a08/A-08_RELEASE_DECISION.md",
]
RENDERS = {
    "docs/architecture/a08/A-08_COMPLETION_STATIC_RENDER.svg": "completion-summary,plan-actual,technical-test",
    "docs/architecture/a08/A-08_VALIDATION_DEFECT_STATIC_RENDER.svg": "product-validation,defect-board,evidence-drawer",
    "docs/architecture/a08/A-08_RELEASE_STATIC_RENDER.svg": "release-decision,release-guards,apply-deploy",
}
RAW_PATHS = {CATALOG_REL, *DOCUMENTS, *RENDERS.keys(), "scripts/check_a08_completion_validation.py", "tests/tooling/test_a08_completion_validation.py", "tests/fixtures/a08/canonical-contract.json", "tests/fixtures/a08/mutation-catalog.json", "docs/validation/A-08_COMPLETION_VALIDATION.md", "docs/completion_reports/A-08_COMPLETION_REPORT.md"}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def validate_catalog(c: dict[str, Any]) -> list[str]:
    e: list[str] = []
    if c.get("artifact_id") != "A-08-COMPLETION-VALIDATION-CATALOG-001" or c.get("package_id") != "A-08": e.append("CATALOG_IDENTITY_MISMATCH")
    expected_pred = [{"package_id": key, "path": value[0], "sha256": value[1], "status": "ACCEPTED"} for key, value in PREDECESSORS.items()]
    if c.get("predecessor_bindings") != expected_pred: e.append("PREDECESSOR_BINDING_MISMATCH")
    completion = c.get("completion", {})
    if completion.get("plan_actual_fields") != PLAN_ACTUAL_FIELDS or completion.get("result_layers") != RESULT_LAYERS or completion.get("package_accepted_means_release") is not False or completion.get("differences_never_hidden") is not True: e.append("PLAN_ACTUAL_LAYER_MISMATCH")
    technical = c.get("technical_test", {})
    if technical.get("results") != TECHNICAL_RESULTS or technical.get("static_mock_build_never_functional_pass") is not True or technical.get("non_executed_never_pass") is not True or technical.get("skipped_blocked_error_have_reason") is not True: e.append("TECHNICAL_RESULT_PROMOTION_FORBIDDEN")
    pv = c.get("product_validation", {})
    if pv.get("verdicts") != PV_VERDICTS or pv.get("criterion_fields") != PV_CRITERION_FIELDS or pv.get("all_required_criteria_required") is not True or pv.get("target_and_delivered_hash_must_match") is not True or pv.get("criterion_omission_fail_closed") is not True or pv.get("actual_pv_executed_in_a08") is not False: e.append("PRODUCT_VALIDATION_CONTRACT_MISMATCH")
    defect = c.get("defect", {})
    if defect.get("lifecycle") != DEFECT_LIFECYCLE or defect.get("developer_close_forbidden") is not True or defect.get("independent_retest_required") is not True or defect.get("same_target_hash_required") is not True or defect.get("severity_downgrade_owner_only") is not True or defect.get("deferred_rejected_owner_only") is not True or defect.get("invalid_transition_rejected") is not True: e.append("DEFECT_LIFECYCLE_RETEST_MISMATCH")
    release = c.get("release_decision", {})
    if release.get("decisions") != RELEASE_DECISIONS or release.get("authenticated_human_actor_required") is not True or release.get("developer_decision_forbidden") is not True or release.get("actual_release_executed_in_a08") is not False: e.append("HUMAN_RELEASE_AUTHORITY_MISMATCH")
    guards = release.get("guards", {})
    if any(guards.get(k) != RELEASE_GUARDS for k in ("release", "apply", "deploy")): e.append("RELEASE_APPLY_DEPLOY_GUARD_MISMATCH")
    effects = release.get("effects", {})
    if effects.get("REWORK") != REWORK_EFFECT or effects.get("DEFER") != DEFER_EFFECT or effects.get("REJECT") != REJECT_EFFECT: e.append("RELEASE_NONRELEASE_EFFECT_MISMATCH")
    invalidation = c.get("hash_invalidation", {})
    if invalidation.get("invalidated_objects") != INVALIDATED_OBJECTS or invalidation.get("fail_closed_until_fresh_evidence") is not True or invalidation.get("hash_reuse_allowed") is not False: e.append("HASH_INVALIDATION_MISMATCH")
    permission = c.get("permission_contract", {})
    expected_permission = {"view_completion": True, "record_technical_result": True, "record_product_validation": False, "developer_close_defect": False, "developer_release_decision": False, "authenticated_human_release_decision": True, "unauthorized_actions_disabled": True, "reason_and_next_action_visible": True}
    if permission != expected_permission: e.append("PERMISSION_BOUNDARY_MISMATCH")
    disclosure = c.get("disclosure_contract", {})
    if any(disclosure.get(k) is not False for k in ("secret_visible", "credential_literal_visible", "raw_internal_endpoint_visible", "loopback_endpoint_visible")) or disclosure.get("masked_reference_allowed") is not True: e.append("SENSITIVE_DISCLOSURE_FORBIDDEN")
    expected_verification = [
        {"assigned_id":"AV-UI-008","level":"L4","method":"MI","evidence":"E-SHOT","severity":"CRITICAL","execution_classification":"STATIC_ONLY","package_verdict":"STATIC_CONTRACT_PASS","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED"},
        {"assigned_id":"AV-UI-009","level":"L4","method":"AE","evidence":"E-SHOT","severity":"MAJOR","execution_classification":"STATIC_ONLY","package_verdict":"STATIC_CONTRACT_PASS","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED"},
        {"assigned_id":"AV-FLOW-025","level":"L5+L7","method":"E-EVT+E-DEC","evidence":"E-EVT,E-DEC","severity":"CRITICAL","execution_classification":"STATIC_ONLY","package_verdict":"STATIC_CONTRACT_PASS","runtime_owner":"E-09","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED"},
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
    required = ["STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "AV-UI-008", "AV-UI-009", "AV-FLOW-025", "ProductValidation NOT_EXECUTED", "Release NOT_EXECUTED", "Package ACCEPTED is not RELEASE", "reason", "next_action"]
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
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-surface-ids="{surfaces}"', "STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "ProductValidation NOT_EXECUTED", "Release NOT_EXECUTED"]
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
    expected = {"work_instruction_sha256":"E418BE54E9AC98BEF61F782B127A83332C75ADD1A60CCCFE8DA8766634CC489E","assigned_verification_ids":["AV-UI-008","AV-UI-009","AV-FLOW-025"],"execution_classification":"STATIC_ONLY","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED","not_executed_evidence":["L4","L5","L7","MI","AE","E-SHOT","E-EVT","E-DEC","PRODUCT_VALIDATION","RELEASE","APPLY","DEPLOY","ACTUAL_DIR"]}
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
    payload = {"status":"PASS" if not errors else "FAIL","package_id":"A-08","execution_classification":"STATIC_ONLY","runtime_status":"RUNTIME_DEFERRED / NOT_EXECUTED","errors":errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-08 completion validation contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__": raise SystemExit(main())
