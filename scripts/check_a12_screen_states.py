"""Fail-closed verifier for the A-12 cross-screen state catalog."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

CATALOG_REL = "docs/architecture/a12/A-12_SCREEN_STATE_CATALOG.json"
MANIFEST_REL = "docs/evidence/manifests/A-12_EVIDENCE_MANIFEST.json"
REQUIRED_STATES = ["LOADING", "EMPTY", "ERROR", "BLOCKED", "QUOTA", "CANCEL", "RECONNECT"]
BADGES = ["PASS", "FAIL", "SKIPPED", "BLOCKED", "ERROR", "NOT_EXECUTED", "MOCK", "FIXTURE", "STATIC"]
EXPECTED_SURFACE_COUNT = 48
RAW_PATHS = {
    CATALOG_REL, "docs/architecture/a12/A-12_SCREEN_STATES.md",
    "docs/architecture/a12/A-12_SCREEN_STATES_STATIC_RENDER.svg",
    "scripts/check_a12_screen_states.py", "tests/tooling/test_a12_screen_states.py",
    "tests/fixtures/a12/hostile-mutations.json", "docs/validation/A-12_SCREEN_STATES_VALIDATION.md",
    "docs/completion_reports/A-12_COMPLETION_REPORT.md",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if (catalog.get("package_id"), catalog.get("execution_classification"), catalog.get("package_verdict"), catalog.get("runtime_status")) != ("A-12", "STATIC_ONLY", "STATIC_CONTRACT_PASS", "RUNTIME_DEFERRED / NOT_EXECUTED"):
        errors.append("STATIC_BOUNDARY_MISMATCH")
    if catalog.get("required_states") != REQUIRED_STATES:
        errors.append("STATE_SET_MISMATCH")
    required_fields = set(catalog.get("required_envelope_fields", []))
    if len(required_fields) != 21:
        errors.append("ENVELOPE_FIELD_SET_MISMATCH")
    envelopes = catalog.get("state_envelopes", [])
    if not isinstance(envelopes, list) or [item.get("state") for item in envelopes] != REQUIRED_STATES:
        errors.append("STATE_ENVELOPE_SET_MISMATCH")
    else:
        by_state = {item["state"]: item for item in envelopes}
        for item in envelopes:
            if not required_fields.issubset(set(item.get("envelope_fields", []))):
                errors.append("COMMON_ENVELOPE_INCOMPLETE")
        if not by_state["LOADING"].get("stale_previous_success_current_forbidden") or not by_state["LOADING"].get("bounded_wait_and_cancel_visible"):
            errors.append("STALE_LOADING_GUARD_MISSING")
        if not by_state["EMPTY"].get("neutral") or not by_state["EMPTY"].get("verification_success_forbidden"):
            errors.append("EMPTY_SUCCESS_PROMOTION")
        if not by_state["ERROR"].get("safe_message_required") or not by_state["ERROR"].get("raw_stack_secret_path_forbidden"):
            errors.append("ERROR_DISCLOSURE_GUARD_MISSING")
        if not by_state["BLOCKED"].get("reason_and_unblock_action_required") or not by_state["BLOCKED"].get("skipped_or_error_collapse_forbidden"):
            errors.append("BLOCKED_SEMANTIC_COLLAPSE")
        quota = by_state["QUOTA"]
        if quota.get("run_status") != "PAUSED_QUOTA" or not all(quota.get(key) is True for key in ("checkpoint_required", "incomplete_steps_required", "reset_hint_required", "reconcile_required", "failed_or_pass_promotion_forbidden", "unsafe_fallback_forbidden")):
            errors.append("QUOTA_FAIL_CLOSED_GUARD_MISSING")
        cancel = by_state["CANCEL"]
        if cancel.get("request_state") != "CANCEL_REQUESTED" or cancel.get("terminal_state") != "CANCELLED" or not all(cancel.get(key) is True for key in ("receipt_and_effective_timing_separated", "terminal_run_reuse_forbidden", "new_run_required")):
            errors.append("CANCEL_TERMINAL_CONFLATION")
        reconnect = by_state["RECONNECT"]
        if not all(reconnect.get(key) is True for key in ("last_event_id_required", "gap_replay_order_dedupe_required", "stale_banner_required", "new_run_creation_forbidden")):
            errors.append("RECONNECT_REPLAY_GUARD_MISSING")
    surfaces = catalog.get("surfaces", [])
    if not isinstance(surfaces, list) or len(surfaces) != EXPECTED_SURFACE_COUNT or len({item.get("id") for item in surfaces}) != EXPECTED_SURFACE_COUNT:
        errors.append("SURFACE_SET_MISMATCH")
    else:
        for surface in surfaces:
            if surface.get("states") != REQUIRED_STATES:
                errors.append("SURFACE_STATE_COVERAGE_MISSING")
            if surface.get("permission_guard") != "PERMISSION_DENIED":
                errors.append("PERMISSION_GUARD_MISSING")
    badges = catalog.get("badge_catalog", [])
    by_badge = {item.get("status"): item for item in badges} if isinstance(badges, list) else {}
    if set(by_badge) != set(BADGES):
        errors.append("BADGE_SET_MISMATCH")
    else:
        if not by_badge["PASS"].get("counts_as_pass") or not by_badge["PASS"].get("requires_actual_execution"):
            errors.append("PASS_EVIDENCE_REQUIREMENT_MISSING")
        for status in set(BADGES) - {"PASS"}:
            badge = by_badge[status]
            if badge.get("counts_as_pass") or badge.get("color_semantic") == "success" or badge.get("icon") == "check":
                errors.append("NON_PASS_PROMOTION_FORBIDDEN")
    transition = catalog.get("transition_contract", {})
    if not all(transition.get(key) is True for key in ("optimistic_version_required", "idempotency_key_required", "terminal_immutability_required", "client_state_mutation_forbidden", "server_receipt_required")):
        errors.append("TRANSITION_INTEGRITY_GUARD_MISSING")
    permission = catalog.get("permission_contract", {})
    if permission.get("state") != "PERMISSION_DENIED" or not all(permission.get(key) is True for key in ("independent_from_blocked", "detail_masking_required", "secret_raw_path_stack_forbidden", "permission_expansion_forbidden")):
        errors.append("PERMISSION_LEAK_GUARD_MISSING")
    if set(permission.get("required_fields", [])) != {"required_permission", "actor_role", "masked_resource", "request_access_action"}:
        errors.append("PERMISSION_ENVELOPE_MISMATCH")
    runtime = catalog.get("runtime_boundary", {})
    if not runtime.get("static_to_runtime_promotion_forbidden") or any(runtime.get(key) != "NOT_EXECUTED" for key in ("actual_browser", "actual_api", "actual_db", "actual_event", "actual_sse", "actual_network", "actual_dir")):
        errors.append("RUNTIME_PROMOTION_FORBIDDEN")
    return dedupe(errors)


def validate_predecessors(root: Path, catalog: dict[str, Any]) -> list[str]:
    bindings = catalog.get("predecessor_bindings", [])
    if [item.get("package_id") for item in bindings] != [f"A-{number:02d}" for number in range(3, 12)]:
        return ["PREDECESSOR_SET_MISMATCH"]
    errors = []
    for binding in bindings:
        path = root / str(binding.get("path", ""))
        if not path.is_file() or binding.get("sha256") != sha256_file(path):
            errors.append("PREDECESSOR_INTEGRITY_MISMATCH")
    return dedupe(errors)


def validate_documents(root: Path) -> list[str]:
    docs = {"docs/architecture/a12/A-12_SCREEN_STATES.md": ["LOADING", "PAUSED_QUOTA", "Last-Event-ID", "PERMISSION_DENIED", "NOT_EXECUTED"]}
    errors = []
    for rel, tokens in docs.items():
        try:
            text = (root / rel).read_text(encoding="utf-8")
        except OSError:
            errors.append("FOCUSED_DOCUMENT_MISSING"); continue
        if any(token not in text for token in tokens):
            errors.append("FOCUSED_DOCUMENT_SEMANTIC_MISMATCH")
    return dedupe(errors)


def validate_render(root: Path) -> list[str]:
    path = root / "docs/architecture/a12/A-12_SCREEN_STATES_STATIC_RENDER.svg"
    try:
        text = path.read_text(encoding="utf-8"); ET.fromstring(text)
    except (OSError, ET.ParseError):
        return ["STATIC_RENDER_MISSING_OR_INVALID"]
    required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', "STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "PAUSED_QUOTA", "PERMISSION_DENIED"]
    return [] if all(token in text for token in required) else ["STATIC_RENDER_SEMANTIC_MISMATCH"]


def apply_mutation(document: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(document); target: Any = result
    parts = str(mutation["path"]).split(".")
    for part in parts[:-1]: target = target[int(part)] if isinstance(target, list) else target[part]
    key = parts[-1]
    if mutation["operation"] == "remove": target.pop(int(key)) if isinstance(target, list) else target.pop(key, None)
    elif isinstance(target, list): target[int(key)] = mutation["value"]
    else: target[key] = mutation["value"]
    return result


def validate_hostile_fixtures(root: Path, catalog: dict[str, Any]) -> list[str]:
    try: fixture = json.loads((root / "tests/fixtures/a12/hostile-mutations.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): return ["HOSTILE_FIXTURE_MISSING_OR_INVALID"]
    errors = []; seen: set[str] = set()
    for mutation in fixture.get("mutations", []):
        mutation_id, expected = mutation.get("id"), mutation.get("expected_error")
        if not mutation_id or mutation_id in seen or not expected: errors.append("HOSTILE_FIXTURE_INVALID"); continue
        seen.add(mutation_id)
        try: observed = validate_catalog(apply_mutation(catalog, mutation))
        except (KeyError, IndexError, TypeError, ValueError): errors.append("HOSTILE_FIXTURE_INVALID"); continue
        if expected not in observed: errors.append("HOSTILE_MUTATION_NOT_REJECTED")
    if len(seen) < 14: errors.append("HOSTILE_FIXTURE_COVERAGE_INSUFFICIENT")
    return dedupe(errors)


def projection(raw: list[dict[str, Any]]) -> bytes:
    return json.dumps([{ "path": item.get("path"), "sha256": item.get("sha256") } for item in sorted(raw, key=lambda item: str(item.get("path")))], ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def validate_manifest_document(root: Path, manifest: dict[str, Any]) -> list[str]:
    raw = manifest.get("raw_artifacts", []); errors = []; paths: set[str] = set(); content_bytes = 0
    if manifest.get("self_reference") is not False: errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    for item in raw:
        rel = str(item.get("path", "")); file = root / rel
        if not rel or rel in paths: errors.append("EVIDENCE_RAW_PATH_INVALID"); continue
        paths.add(rel)
        if not file.is_file(): errors.append("EVIDENCE_RAW_ARTIFACT_MISSING"); continue
        content_bytes += file.stat().st_size
        if item.get("bytes") != file.stat().st_size: errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != sha256_file(file): errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    target = hashlib.sha256(projection(raw)).hexdigest().upper()
    if paths != RAW_PATHS: errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    if manifest.get("target_canonical_bytes") != len(projection(raw)) or manifest.get("target_content_bytes") != content_bytes: errors.append("EVIDENCE_SIZE_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target: errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected = {"package_id": "A-12", "work_instruction_sha256": "9D2061A6F62C3101A4138A32642DB4C4AC9178B38B421B2C77B3E3A2FF37840F", "assigned_verification_ids": ["AV-UI-006", "AV-UI-007", "AV-GATE-005"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED"}
    if any(manifest.get(key) != value for key, value in expected.items()): errors.append("EVIDENCE_QUALIFIER_MISMATCH")
    return dedupe(errors)


def validate_manifest(root: Path) -> list[str]:
    try: manifest = json.loads((root / MANIFEST_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): return ["EVIDENCE_MANIFEST_MISSING_OR_INVALID"]
    return validate_manifest_document(root, manifest)


def validate_bundle(root: Path, include_manifest: bool = True, include_fixtures: bool = True) -> list[str]:
    try: catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): return ["CATALOG_MISSING_OR_INVALID"]
    errors = validate_catalog(catalog) + validate_predecessors(root, catalog) + validate_documents(root) + validate_render(root)
    if include_fixtures: errors += validate_hostile_fixtures(root, catalog)
    if include_manifest: errors += validate_manifest(root)
    return dedupe(errors)


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", type=Path, default=Path.cwd()); parser.add_argument("--without-manifest", action="store_true"); parser.add_argument("--verify-fixtures", action="store_true")
    args = parser.parse_args(); root = args.root.resolve()
    if args.verify_fixtures:
        catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8")); errors = validate_hostile_fixtures(root, catalog)
        print("hostile fixtures rejected" if not errors else "hostile fixtures FAIL: " + ",".join(errors)); return 0 if not errors else 1
    errors = validate_bundle(root, include_manifest=not args.without_manifest)
    print(f"A-12 screen-state contract: {'PASS' if not errors else 'FAIL'} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
