from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


CATALOG_REL = "docs/architecture/a07/A-07_EXECUTION_CONTROL_CATALOG.json"
MANIFEST_REL = "docs/evidence/manifests/A-07_EVIDENCE_MANIFEST.json"
RUN_STATES = ["PLANNED", "RUNNING", "PAUSED_QUOTA", "BLOCKED", "COMPLETED", "CANCELLED"]
STEP_STATES = ["PLANNED", "READY", "RUNNING", "REPORTING", "COMPLETED", "FAILED", "BLOCKED_DEPENDENCY", "CANCELLED"]
AGENT_FIELDS = ["agent_id", "role", "scope", "permissions", "provider", "model", "token_usage", "cost", "status", "current_action", "heartbeat", "worker_lease", "write_lease", "checkpoint", "evidence", "authorized_stop"]
BUDGET_SEQUENCE = ["RESERVE", "PROVIDER_REQUEST", "USAGE_RECORD", "RECONCILE", "RELEASE_REMAINDER"]
FAILURE_CLASSES = ["VALID_FAILURE_REPORT", "INCOMPLETE", "BLOCKED", "QUOTA", "ENVIRONMENT", "TOOL_INTERRUPTION", "CANCELLED"]
EXCLUDED_FAILURES = ["INCOMPLETE", "BLOCKED", "QUOTA", "ENVIRONMENT", "TOOL_INTERRUPTION", "CANCELLED"]
RECOVERY_DIMENSIONS = ["checkpoint", "artifact_hashes", "event_sequence", "workspace", "worker_lease", "write_lease", "side_effects"]
TAKEOVER_PACKET_FIELDS = ["step_lineage_id", "failure_fingerprint", "valid_failure_count", "diff", "tests", "checkpoint", "evidence", "remaining_work", "revoked_worker_lease", "revoked_write_lease", "next_actor"]
DIR_STATES = ["DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"]
DIR_VERDICTS = ["ALIGNED", "DRIFT_MINOR", "DRIFT_MAJOR", "DIVERGED"]
EXPECTED_VERIFICATION = {"assigned_id": "AV-AGT-029", "level": "L4", "method": "AE", "evidence": "E-SHOT", "severity": "MAJOR", "execution_classification": "STATIC_ONLY", "package_verdict": "STATIC_CONTRACT_PASS", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "runtime_evidence_status": "E-SHOT NOT_EXECUTED"}

PREDECESSORS = {
    "G-04": ("docs/evidence/manifests/G-04_EVIDENCE_MANIFEST.json", "F2674994201407532D6E18A9F9A0A94B606BA94385DCD126C03AF7F8264B09C1"),
    "A-01": ("docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json", "BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4"),
    "A-02": ("docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json", "779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168"),
    "A-03": ("docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json", "772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE"),
    "A-04": ("docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json", "C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB"),
    "A-05": ("docs/evidence/manifests/A-05_EVIDENCE_MANIFEST.json", "90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1"),
    "A-06": ("docs/evidence/manifests/A-06_EVIDENCE_MANIFEST.json", "A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449"),
}
DOCUMENTS = [
    "docs/architecture/a07/A-07_EXECUTION_TASK_GRAPH.md",
    "docs/architecture/a07/A-07_AGENT_EXCEPTION.md",
    "docs/architecture/a07/A-07_RECOVERY_FENCING_BUDGET.md",
    "docs/architecture/a07/A-07_TAKEOVER_DIR.md",
]
RENDERS = {
    "docs/architecture/a07/A-07_EXECUTION_STATIC_RENDER.svg": "execution-control,task-graph",
    "docs/architecture/a07/A-07_AGENT_RECOVERY_STATIC_RENDER.svg": "agent-drawer,exception-inbox,recovery-center",
    "docs/architecture/a07/A-07_TAKEOVER_DIR_STATIC_RENDER.svg": "fencing-budget,takeover,dir-panel",
}
RAW_PATHS = {CATALOG_REL, *DOCUMENTS, *RENDERS.keys(), "scripts/check_a07_execution_control.py", "tests/tooling/test_a07_execution_control.py", "tests/fixtures/a07/canonical-contract.json", "tests/fixtures/a07/mutation-catalog.json", "docs/validation/A-07_EXECUTION_CONTROL_VALIDATION.md", "docs/completion_reports/A-07_COMPLETION_REPORT.md"}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def validate_catalog(c: dict[str, Any]) -> list[str]:
    e: list[str] = []
    if c.get("artifact_id") != "A-07-EXECUTION-CONTROL-CATALOG-001" or c.get("package_id") != "A-07": e.append("CATALOG_IDENTITY_MISMATCH")
    expected_pred = [{"package_id": key, "path": value[0], "sha256": value[1], "status": "ACCEPTED"} for key, value in PREDECESSORS.items()]
    if c.get("predecessor_bindings") != expected_pred: e.append("PREDECESSOR_BINDING_MISMATCH")
    execution = c.get("execution_control", {})
    if execution.get("run_states") != RUN_STATES or execution.get("run_step_state_separation") is not True or execution.get("safe_controls") != ["SAFE_STOP", "REDUCE_CONCURRENCY", "REQUEST_BUDGET_CHANGE", "REVIEW_FAILURES"] or execution.get("hash_guards_required") is not True: e.append("EXECUTION_CONTROL_MISMATCH")
    graph = c.get("task_graph", {})
    if graph.get("step_states") != STEP_STATES or graph.get("dag_cycle_rejected") is not True or graph.get("failed_dependency_blocks_run") is not True or graph.get("independent_failure_allows_overall_success") is not False or graph.get("node_fields") != ["step_id", "delegation_id", "dependencies", "input_hash", "output_hash", "path_scope", "capabilities", "worker_lease", "write_lease", "budget_reservation", "result_contract"]: e.append("TASK_GRAPH_GUARD_MISMATCH")
    agent = c.get("agent_drawer", {})
    if agent.get("fields") != AGENT_FIELDS: e.append("AGENT_REQUIRED_FIELD_MISSING")
    if agent.get("unauthorized_stop_disabled") is not True or agent.get("stop_reason_and_next_action_visible") is not True or agent.get("stop_blocks_new_action") is not True: e.append("AGENT_STOP_AUTHORITY_MISMATCH")
    inbox = c.get("exception_inbox", {})
    if inbox.get("failure_classes") != FAILURE_CLASSES or inbox.get("excluded_from_valid_count") != EXCLUDED_FAILURES or inbox.get("same_lineage_and_fingerprint_required") is not True or inbox.get("success_pollution_forbidden") is not True: e.append("FAILURE_CLASSIFICATION_MISMATCH")
    recovery = c.get("recovery_center", {})
    if recovery.get("reconciliation_dimensions") != RECOVERY_DIMENSIONS or recovery.get("exact_checkpoint_hash_required") is not True or recovery.get("side_effect_classification_required") is not True or recovery.get("duplicate_execution_forbidden") is not True or recovery.get("resume_after_stop_without_reconcile") is not False or recovery.get("side_effect_states") != ["CONFIRMED_SUCCESS", "SAFE_RETRY", "MANUAL_REVIEW"]: e.append("RECOVERY_GUARD_MISMATCH")
    fencing = c.get("fencing_budget", {})
    if fencing.get("worker_and_write_required_for_mutation") is not True or fencing.get("stale_token_commit_rejected") is not True or fencing.get("path_alias_conflict_rejected") is not True or fencing.get("heartbeat_expiry_blocks_execution") is not True or fencing.get("tokens_masked") is not True: e.append("FENCING_GUARD_MISMATCH")
    budget = fencing.get("budget", {})
    if budget.get("sequence") != BUDGET_SEQUENCE or budget.get("hard_limit_blocks") is not True or budget.get("usage_must_reconcile") is not True or budget.get("provider_request_before_reservation") is not False: e.append("BUDGET_RESERVATION_MISMATCH")
    takeover = c.get("takeover", {})
    if takeover.get("automatic_trigger_valid_failure_count") != 3 or takeover.get("same_lineage_and_fingerprint_required") is not True or takeover.get("human_override_record_required") is not True or takeover.get("leases_and_tools_revoked_before_actor_change") is not True or takeover.get("packet_fields") != TAKEOVER_PACKET_FIELDS: e.append("TAKEOVER_GUARD_MISMATCH")
    direction = c.get("dir_panel", {})
    if direction.get("lifecycle_states") != DIR_STATES or direction.get("verdicts") != DIR_VERDICTS or direction.get("state_and_verdict_separate") is not True or direction.get("owner_direction_required_to_clear") is not True or direction.get("auto_clear_allowed") is not False or direction.get("actual_dir_reached_in_a07") is not False or direction.get("a07_display_only") is not True: e.append("DIR_CONTRACT_MISMATCH")
    permission = c.get("permission_contract", {})
    if permission != {"view_execution": True, "manage_execution": False, "unauthorized_actions_disabled": True, "reason_and_next_action_visible": True, "permissions_never_widen_parent": True}: e.append("PERMISSION_BOUNDARY_MISMATCH")
    disclosure = c.get("disclosure_contract", {})
    if any(disclosure.get(k) is not False for k in ("secret_visible", "raw_fencing_token_visible", "raw_internal_endpoint_visible", "loopback_endpoint_visible")) or disclosure.get("masked_reference_allowed") is not True: e.append("SENSITIVE_DISCLOSURE_FORBIDDEN")
    if c.get("verification_contract") != EXPECTED_VERIFICATION: e.append("VERIFICATION_CONTRACT_MISMATCH")
    return _dedupe(e)


def validate_predecessors(root: Path) -> list[str]:
    errors: list[str] = []
    for path, expected in PREDECESSORS.values():
        try:
            if sha256_file(root / path) != expected: errors.append("PREDECESSOR_ARTIFACT_HASH_MISMATCH")
        except OSError: errors.append("PREDECESSOR_ARTIFACT_MISSING")
    return _dedupe(errors)


def validate_documents(root: Path) -> list[str]:
    required = ["STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "AV-AGT-029", "actual DIR NOT_EXECUTED", "reason", "next_action"]
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
        required = ['width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"', f'data-surface-ids="{surfaces}"', "STATIC_ONLY", "RUNTIME_DEFERRED / NOT_EXECUTED", "AV-AGT-029", "actual DIR NOT_EXECUTED"]
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
    expected = {"work_instruction_sha256": "240371EB038AECE4F2613E83613871A737D4831B5FE9A832CB6534A558730799", "assigned_verification_ids": ["AV-AGT-029"], "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "not_executed_evidence": ["L4", "AE", "E-SHOT", "AGENT_RUNTIME", "ACTUAL_DIR"]}
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
    payload = {"status": "PASS" if not errors else "FAIL", "package_id": "A-07", "execution_classification": "STATIC_ONLY", "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED", "errors": errors}
    print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else f"A-07 execution control contract: {payload['status']} ({len(errors)} errors)")
    return 0 if not errors else 1


if __name__ == "__main__": raise SystemExit(main())
