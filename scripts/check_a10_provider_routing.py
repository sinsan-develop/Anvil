from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


CATALOG_REL = "docs/architecture/a10/A-10_PROVIDER_ROUTING_CATALOG.json"
MANIFEST_REL = "docs/evidence/manifests/A-10_EVIDENCE_MANIFEST.json"
PROVIDERS = ["cerebras", "groq", "mistral", "openrouter", "upstage", "gemini", "anthropic", "openai", "ollama"]
EGRESS_MODES = ["local_only", "metadata_only", "approved_paths", "masked_content"]
PROVIDER_STATES = ["NOT_CONFIGURED", "CHECKING", "AVAILABLE", "DEGRADED", "UNAVAILABLE", "DISABLED"]
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
    "A-09": ("docs/evidence/manifests/A-09_EVIDENCE_MANIFEST.json", "A917008E376E34F51BFADE8E74FE1B6E065D7FDBAC79C748D3DC0424A4E23EA3"),
}
DOCUMENTS = [
    "docs/architecture/a10/A-10_PROVIDER_CATALOG.md", "docs/architecture/a10/A-10_PROVIDER_MODEL_DETAIL.md",
    "docs/architecture/a10/A-10_CREDENTIAL_EGRESS.md", "docs/architecture/a10/A-10_ROLE_ROUTING.md",
    "docs/architecture/a10/A-10_CAPABILITY_EVIDENCE.md",
]
RENDERS = {
    "docs/architecture/a10/A-10_PROVIDER_STATIC_RENDER.svg": "provider-catalog,provider-detail,credential-drawer",
    "docs/architecture/a10/A-10_ROUTING_STATIC_RENDER.svg": "execution-mode,role-routing,egress-profile",
    "docs/architecture/a10/A-10_EVIDENCE_STATIC_RENDER.svg": "capability-drift,evidence-audit,blocked-state",
}
RAW_PATHS = {CATALOG_REL, *DOCUMENTS, *RENDERS, "scripts/check_a10_provider_routing.py", "tests/tooling/test_a10_provider_routing.py", "tests/fixtures/a10/canonical-contract.json", "tests/fixtures/a10/mutation-catalog.json", "docs/validation/A-10_PROVIDER_ROUTING_VALIDATION.md", "docs/completion_reports/A-10_COMPLETION_REPORT.md"}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if catalog.get("artifact_id") != "A-10-PROVIDER-ROUTING-CATALOG-001" or catalog.get("package_id") != "A-10":
        errors.append("CATALOG_IDENTITY_MISMATCH")
    if catalog.get("authority_hashes") != AUTHORITY:
        errors.append("AUTHORITY_BINDING_MISMATCH")
    expected_predecessors = [{"package_id": key, "path": value[0], "sha256": value[1], "status": "ACCEPTED"} for key, value in PREDECESSORS.items()]
    if catalog.get("predecessor_bindings") != expected_predecessors:
        errors.append("PREDECESSOR_BINDING_MISMATCH")

    providers = catalog.get("provider_catalog")
    if not isinstance(providers, list) or [row.get("provider_id") for row in providers] != PROVIDERS:
        errors.append("PROVIDER_CATALOG_ORDER_MISMATCH")
    elif any(row.get("sort_order") != index + 1 or row.get("status") not in PROVIDER_STATES for index, row in enumerate(providers)):
        errors.append("PROVIDER_CATALOG_STATUS_MISMATCH")
    elif any(row.get("unavailable_reason_visible") is not True or row.get("credential_ref_visible") is not True or row.get("credential_value_visible") is not False or row.get("raw_endpoint_visible") is not False for row in providers):
        errors.append("UNAVAILABLE_STATE_HIDDEN")

    snapshot = catalog.get("capability_snapshot", {})
    if snapshot.get("probe_required") is not True:
        errors.append("CAPABILITY_PROBE_REQUIRED")
    if snapshot.get("benchmark_required") is not True:
        errors.append("CAPABILITY_BENCHMARK_REQUIRED")
    if snapshot.get("capability_guessing_forbidden") is not True or snapshot.get("verified_snapshot_required_for_route") is not True:
        errors.append("GUESSED_OR_STALE_CAPABILITY_FORBIDDEN")
    if snapshot.get("activation_next_snapshot_only") is not True:
        errors.append("ROUTING_ACTIVATION_SNAPSHOT_BYPASS")
    if snapshot.get("required_fields") != ["provider_id", "model_ref", "model_revision", "privacy_class", "cost_class", "probe_revision", "benchmark_revision", "ttl", "snapshot_hash"]:
        errors.append("CAPABILITY_SNAPSHOT_FIELD_MISMATCH")

    routing = catalog.get("role_routing", {})
    if routing.get("roles") != ["main", "developer", "reviewer", "tester", "reflection"]:
        errors.append("ROLE_ROUTING_ROLE_SET_MISMATCH")
    if routing.get("capability_match_required") is not True or routing.get("privacy_match_required") is not True:
        errors.append("ROUTING_CAPABILITY_PRIVACY_MATCH_BYPASS")
    if routing.get("egress_match_required") is not True:
        errors.append("ROUTING_EGRESS_MATCH_BYPASS")
    if routing.get("activation_requires_probe_and_benchmark") is not True:
        errors.append("ROUTE_ACTIVATION_WITHOUT_VERIFICATION")

    egress = catalog.get("data_egress_profile", {})
    if egress.get("modes") != EGRESS_MODES or egress.get("provider_allowlist_required") is not True or egress.get("excluded_paths_required") is not True:
        errors.append("EGRESS_PROFILE_CONTRACT_MISMATCH")
    if egress.get("expansion_requires_human_approval") is not True:
        errors.append("EGRESS_EXPANSION_APPROVAL_BYPASS")
    if egress.get("effective_from_next_snapshot_only") is not True:
        errors.append("EGRESS_RETROACTIVE_ACTIVATION_BYPASS")

    fallback = catalog.get("fallback_policy", {})
    if fallback.get("allowed_reasons") != ["rate_limit", "provider_timeout", "transient_5xx"] or fallback.get("unsafe_fallback_blocked") is not True:
        errors.append("UNSAFE_FALLBACK_NOT_BLOCKED")
    if fallback.get("restricted_changes_require_reapproval") != ["privacy_class", "local_only_to_cloud", "tool_capability", "context_loss", "high_risk_reviewer"]:
        errors.append("FALLBACK_REAPPROVAL_CONTRACT_MISMATCH")

    secret = catalog.get("secret_contract", {})
    if secret.get("reference_only") is not True or secret.get("revoked_or_expired_blocks_routing") is not True:
        errors.append("REVOKED_SECRET_ROUTE_BYPASS")
    if secret.get("allowed_statuses") != ["ACTIVE", "ROTATING"] or secret.get("forbidden_statuses") != ["REVOKED", "EXPIRED"]:
        errors.append("SECRET_STATUS_CONTRACT_MISMATCH")
    disclosure = catalog.get("disclosure_contract", {})
    if disclosure.get("secret_literal_visible") is not False:
        errors.append("SECRET_LITERAL_DISCLOSURE_FORBIDDEN")
    if disclosure.get("raw_internal_endpoint_visible") is not False or disclosure.get("provider_raw_error_visible") is not False:
        errors.append("INTERNAL_ENDPOINT_DISCLOSURE_FORBIDDEN")
    if disclosure.get("masked_reference_allowed") is not True:
        errors.append("MASKED_REFERENCE_CONTRACT_MISMATCH")

    drift = catalog.get("capability_drift", {})
    if drift.get("blocked_code") != "BLOCKED_CAPABILITY_DRIFT" or drift.get("new_run_blocked") is not True:
        errors.append("CAPABILITY_DRIFT_FAIL_CLOSED_REQUIRED")
    if drift.get("revalidation_required") != ["probe", "benchmark", "required_approval"]:
        errors.append("CAPABILITY_DRIFT_REVALIDATION_MISMATCH")
    permissions = catalog.get("permission_contract", {})
    if permissions.get("independent_permissions_required") is not True or permissions.get("provider_secret_egress_audit_separated") is not True:
        errors.append("PERMISSION_COLLAPSE_FORBIDDEN")
    if permissions.get("permission_expansion_forbidden") is not True:
        errors.append("PERMISSION_EXPANSION_FORBIDDEN")

    expected_verification = [
        {"assigned_id": "AV-OPS-010", "level": "L3", "method": "AI", "evidence": "E-AUD", "severity": "MAJOR", "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "runtime_owner": "F-02", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED"},
        {"assigned_id": "AV-LRN-028", "level": "L5", "method": "AN", "evidence": "E-AUD,E-TEST", "severity": "CRITICAL", "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "runtime_owner": "D-11,F-02", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED"},
    ]
    if catalog.get("verification_contracts") != expected_verification:
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


def validate_documents(root: Path) -> list[str]:
    required = ["STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "AV-OPS-010", "AV-LRN-028", "D-11", "F-02", "actual Provider/Secret/Egress/API/DB/Event/browser/network/runtime/DIR: NOT_EXECUTED", "reason", "next_action"]
    errors: list[str] = []
    for rel in DOCUMENTS:
        try:
            text = (root / rel).read_text(encoding="utf-8")
        except OSError:
            errors.append("DOCUMENT_MISSING")
            continue
        if any(item not in text for item in required):
            errors.append("DOCUMENT_SEMANTIC_BINDING_MISMATCH")
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
        if any(item not in text for item in required):
            errors.append("STATIC_RENDER_SEMANTIC_BINDING_MISMATCH")
        if {match.upper() for match in re.findall(r"#[0-9A-Fa-f]{6}\\b", text)} - allowed:
            errors.append("STATIC_RENDER_RAW_COLOR_BYPASS")
    return _dedupe(errors)


def _apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(document)
    target: Any = result
    parts = str(mutation["path"]).split(".")
    for part in parts[:-1]:
        target = target[int(part)] if isinstance(target, list) else target[part]
    key = parts[-1]
    if mutation["operation"] == "remove":
        target.pop(int(key)) if isinstance(target, list) else target.pop(key, None)
    elif isinstance(target, list):
        target[int(key)] = mutation.get("value")
    else:
        target[key] = mutation.get("value")
    return result


def validate_mutation_fixture(catalog: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for mutation in fixture.get("mutations", []):
        mutation_id = mutation.get("mutation_id")
        expected = mutation.get("expected_error_code")
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


def _projection(raw: list[dict[str, Any]]) -> bytes:
    return json.dumps([{"path": str(item.get("path", "")), "sha256": str(item.get("sha256", ""))} for item in sorted(raw, key=lambda item: str(item.get("path", "")))], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def manifest_target(raw: list[dict[str, Any]]) -> str:
    return hashlib.sha256(_projection(raw)).hexdigest().upper()


def validate_evidence_manifest(root: Path, manifest: dict[str, Any]) -> list[str]:
    raw = manifest.get("raw_artifacts", [])
    if not isinstance(raw, list) or not raw:
        return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    errors: list[str] = []
    if manifest.get("self_reference") is not False:
        errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    paths: set[str] = set(); content_bytes = 0
    for item in raw:
        rel = str(item.get("path", ""))
        if not rel or rel in paths:
            errors.append("EVIDENCE_RAW_PATH_INVALID")
            continue
        paths.add(rel); path = root / rel
        if not path.is_file():
            errors.append("EVIDENCE_RAW_ARTIFACT_MISSING")
            continue
        content_bytes += path.stat().st_size
        if item.get("bytes") != path.stat().st_size:
            errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != sha256_file(path):
            errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    if paths != RAW_PATHS:
        errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    projection = _projection(raw); target = manifest_target(raw)
    if manifest.get("target_canonical_bytes") != len(projection): errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    if manifest.get("target_content_bytes") != content_bytes: errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target: errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected = {"work_instruction_sha256": "A7D527B3AA9B50F30589526EDC1D790B75A778D96C47A959B7C966418BFECCF5", "assigned_verification_ids": ["AV-OPS-010", "AV-LRN-028"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "not_executed_evidence": ["L3", "L5", "AI", "AN", "E-AUD", "E-TEST", "ACTUAL_PROVIDER", "ACTUAL_SECRET", "ACTUAL_EGRESS", "RUNTIME", "ACTUAL_DIR"]}
    if any(manifest.get(key) != value for key, value in expected.items()):
        errors.append("EVIDENCE_RUNTIME_QUALIFIER_MISMATCH")
    return _dedupe(errors)


def validate_bundle(root: Path, require_manifest: bool = True) -> list[str]:
    try:
        catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["CATALOG_MISSING_OR_INVALID"]
    errors = validate_catalog(catalog) + validate_predecessors(root) + validate_documents(root) + validate_renders(root)
    if require_manifest:
        try:
            manifest = json.loads((root / MANIFEST_REL).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            errors.append("EVIDENCE_MANIFEST_MISSING_OR_INVALID")
        else:
            errors += validate_evidence_manifest(root, manifest)
    return _dedupe(errors)


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", type=Path, default=Path.cwd()); parser.add_argument("--json", action="store_true"); parser.add_argument("--without-manifest", action="store_true")
    args = parser.parse_args(); errors = validate_bundle(args.root.resolve(), require_manifest=not args.without_manifest)
    payload = {"status": "PASS" if not errors else "FAIL", "package_id": "A-10", "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-10 provider routing contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
