"""Validate G-05 project progress, recovery, failure, revision, and DIR contracts."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Mapping

try:
    from scripts.evidence_portability import portable_hash, portable_row_matches
except ModuleNotFoundError:  # direct `python scripts/check_*.py`
    from evidence_portability import portable_hash, portable_row_matches


CHAPTER_15_MINIMUM_FIELDS = {
    "plan_version",
    "work_plan_hash",
    "design_baseline_hash",
    "current_phase",
    "current_work_package",
    "status",
    "completed_packages",
    "active_agent",
    "write_lease",
    "worker_lease",
    "budget_reservations",
    "valid_failure_count",
    "latest_evidence_refs",
    "latest_evidence_manifest_ref",
    "pending_approvals",
    "dir_review",
    "next_safe_action",
}

EXTENDED_PROGRESS_FIELDS = {
    "schema_version",
    "snapshot_id",
    "event_sequence",
    "snapshot_hash",
    "updated_at",
    "last_event_id",
    "root_human_approval_binding",
    "derived_baseline_binding",
    "repository",
    "active_work_instruction",
    "last_accepted_work_instruction",
    "reporting_decision",
    "registry_refs",
    "current_progress_evidence_ref",
}

BUNDLE_PATHS = {
    "progress": "docs/progress/build-progress.json",
    "handoff_text": "docs/progress/BUILD_HANDOFF.md",
    "failure_ledger": "docs/progress/failure-ledger.json",
    "nonsemantic": "docs/progress/non-semantic-revision-bindings.json",
    "dir_registry": "docs/progress/dir-checkpoints.json",
    "event_contract": "docs/progress/progress-event-contract.json",
    "events": "docs/progress/progress-events.json",
    "detached_digest": "docs/progress/progress-handoff-detached-digest.json",
    "schema_catalog": "docs/governance/schemas/schema-catalog.json",
}

REQUIRED_EVENT_TYPES = {
    "PACKAGE_STARTED",
    "PACKAGE_COMPLETED",
    "MAIN_PACKAGE_ACCEPTED",
    "PACKAGE_FAILED",
    "PACKAGE_INTERRUPTED",
    "PACKAGE_WAITING_APPROVAL",
    "PACKAGE_RESUMED",
    "HANDOFF_RECORDED",
    "FAILURE_REPORT_ACCEPTED",
    "FAILURE_REPORT_REJECTED",
    "WORKER_LEASE_ISSUED",
    "WORKER_LEASE_REVOKED",
    "WRITE_LEASE_ISSUED",
    "WRITE_LEASE_REVOKED",
    "FENCING_TOKEN_EXPIRED",
    "LEASE_TAKEOVER",
    "PHASE_GATE_DECIDED",
    "DIR_REACHED",
    "DIR_REPORTED",
    "DIR_OWNER_DIRECTION_RECORDED",
    "DIRX_TRIGGERED",
    "DIR_DECISION_REQUESTED",
    "BUDGET_RESERVED",
    "BUDGET_CONSUMED",
    "BUDGET_RECONCILED",
    "PRODUCT_VALIDATION_RECORDED",
    "DEFECT_RECORDED",
    "RELEASE_DECISION_RECORDED",
    "APPLY_APPROVAL_RECORDED",
    "DEPLOY_APPROVAL_RECORDED",
    "EVIDENCE_MANIFEST_CREATED",
    "EVIDENCE_MANIFEST_INVALIDATED",
    "RELEASE_MANIFEST_CREATED",
    "RELEASE_MANIFEST_INVALIDATED",
    "GIT_COMMIT",
    "GIT_PUSH",
    "DEPLOYMENT_STARTED",
    "DEPLOYMENT_COMPLETED",
    "MONITORING_BOUNDARY_RECORDED",
}

RESULT_STATUSES = {"COMPLETED", "FAILURE_REPORT", "INCOMPLETE", "BLOCKED", "CANCELLED"}
DIR_STATUSES = {"NOT_REACHED", "DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"}
DIR_VERDICTS = {None, "ALIGNED", "DRIFT_MINOR", "DRIFT_MAJOR", "DIVERGED"}
REPORTING_DECISIONS = {"AUTO_CONTINUE", "STOP_AND_REPORT_SCOPE_RISK", "STOP_AND_REPORT_DIR"}
SEMANTIC_CHANGE_CLASSES = {"FUNCTION_SCOPE_CHANGE", "REQUIREMENT_CHANGE", "IMPORTANT_RISK_CHANGE"}
CHANGE_CLASSIFICATION_ALIASES = {
    "FUNCTION_SCOPE_CHANGE": "FUNCTION_SCOPE_CHANGE",
    "FUNCTION_SCOPE_CHANGE_REQUIRED": "FUNCTION_SCOPE_CHANGE",
    "SCOPE_EXPANSION_REQUIRED": "FUNCTION_SCOPE_CHANGE",
    "REQUIREMENT_CHANGE": "REQUIREMENT_CHANGE",
    "REQUIREMENT_CHANGE_REQUIRED": "REQUIREMENT_CHANGE",
    "IMPORTANT_RISK_CHANGE": "IMPORTANT_RISK_CHANGE",
    "IMPORTANT_RISK_CHANGE_REQUIRED": "IMPORTANT_RISK_CHANGE",
    "NON_SEMANTIC": "NON_SEMANTIC",
}

VALIDATED_BASE_PROJECTION_MODE = "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT"
VALIDATED_BASE_PENDING_RELATION = "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT"
EVIDENCE_ONLY_PATH_PREFIXES = (
    "docs/approvals/",
    "docs/evidence/",
    "docs/progress/",
    "docs/test_reports/",
)
A01_COMPLETION_PATH_PREFIXES = (
    "docs/architecture/a01/",
    "docs/completion_reports/A-01_",
    "docs/validation/A-01_",
    "tests/fixtures/a01/",
)
A01_COMPLETION_EXACT_PATHS = {
    "scripts/check_a01_journey.py",
    "tests/tooling/test_a01_journey.py",
}
A02_COMPLETION_PATH_PREFIXES = (
    "docs/architecture/a02/",
    "docs/completion_reports/A-02_",
    "docs/validation/A-02_",
    "tests/fixtures/a02/",
)
A02_COMPLETION_EXACT_PATHS = {
    "scripts/check_a02_tokens.py",
    "tests/tooling/test_a02_tokens.py",
}
A03_COMPLETION_PATH_PREFIXES = (
    "docs/architecture/a03/",
    "docs/completion_reports/A-03_",
    "docs/validation/A-03_",
    "tests/fixtures/a03/",
)
A03_COMPLETION_EXACT_PATHS = {
    "scripts/check_a03_onboarding.py",
    "tests/tooling/test_a03_onboarding.py",
}
A04_COMPLETION_PATH_PREFIXES = (
    "docs/architecture/a04/",
    "docs/completion_reports/A-04_",
    "docs/validation/A-04_",
    "tests/fixtures/a04/",
)
A04_COMPLETION_EXACT_PATHS = {
    "scripts/check_a04_workbench.py",
    "tests/tooling/test_a04_workbench.py",
}
A05_COMPLETION_PATH_PREFIXES = ("docs/architecture/a05/", "docs/completion_reports/A-05_", "docs/validation/A-05_", "tests/fixtures/a05/")
A05_COMPLETION_EXACT_PATHS = {"scripts/check_a05_design_decisions.py", "tests/tooling/test_a05_design_decisions.py"}
A06_COMPLETION_PATH_PREFIXES = ("docs/architecture/a06/", "docs/completion_reports/A-06_", "docs/validation/A-06_", "tests/fixtures/a06/")
A06_COMPLETION_EXACT_PATHS = {"scripts/check_a06_planning_approvals.py", "tests/tooling/test_a06_planning_approvals.py"}
A07_COMPLETION_PATH_PREFIXES = ("docs/architecture/a07/", "docs/completion_reports/A-07_", "docs/validation/A-07_", "tests/fixtures/a07/")
A07_COMPLETION_EXACT_PATHS = {"scripts/check_a07_execution_control.py", "tests/tooling/test_a07_execution_control.py"}
A08_COMPLETION_PATH_PREFIXES = ("docs/architecture/a08/", "docs/completion_reports/A-08_", "docs/validation/A-08_", "tests/fixtures/a08/")
A08_COMPLETION_EXACT_PATHS = {"scripts/check_a08_completion_validation.py", "tests/tooling/test_a08_completion_validation.py"}
A09_COMPLETION_PATH_PREFIXES = ("docs/architecture/a09/", "docs/completion_reports/A-09_", "docs/validation/A-09_", "tests/fixtures/a09/")
A09_COMPLETION_EXACT_PATHS = {"scripts/check_a09_learning_automation.py", "tests/tooling/test_a09_learning_automation.py"}
A10_COMPLETION_PATH_PREFIXES = ("docs/architecture/a10/", "docs/completion_reports/A-10_", "docs/validation/A-10_", "tests/fixtures/a10/")
A10_COMPLETION_EXACT_PATHS = {"scripts/check_a10_provider_routing.py", "tests/tooling/test_a10_provider_routing.py"}
A11_COMPLETION_PATH_PREFIXES = ("docs/architecture/a11/", "docs/completion_reports/A-11_", "docs/validation/A-11_", "tests/fixtures/a11/")
A11_COMPLETION_EXACT_PATHS = {"scripts/check_a11_operations_monitoring.py", "tests/tooling/test_a11_operations_monitoring.py"}
A12_COMPLETION_PATH_PREFIXES = ("docs/architecture/a12/", "docs/completion_reports/A-12_", "docs/validation/A-12_", "tests/fixtures/a12/")
A12_COMPLETION_EXACT_PATHS = {"scripts/check_a12_screen_states.py", "tests/tooling/test_a12_screen_states.py"}
A13_COMPLETION_PATH_PREFIXES = ("docs/architecture/a13/", "docs/completion_reports/A-13_", "docs/validation/A-13_", "tests/fixtures/a13/", "packages/repository_intelligence/")
A13_COMPLETION_EXACT_PATHS = {"scripts/check_a13_repository_scan.py", "tests/tooling/test_a13_repository_scan.py"}
A14_COMPLETION_PATH_PREFIXES = ("apps/web/", "docs/architecture/a14/", "docs/completion_reports/A-14_", "docs/validation/A-14_", "tests/browser/a14/", "tests/fixtures/a14/")
A14_COMPLETION_EXACT_PATHS = {
    "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json",
    "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R3.json",
    "scripts/check_a14_workbench_prototype.py",
    "tests/tooling/test_a14_workbench_prototype.py",
}
A15_COMPLETION_PATH_PREFIXES = ("docs/architecture/a15/", "docs/completion_reports/A-15_", "docs/validation/A-15_", "tests/fixtures/a15/")
A15_COMPLETION_EXACT_PATHS = {"docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json", "scripts/check_a15_artifact_state_api_ui_trace.py", "tests/tooling/test_a15_artifact_state_api_ui_trace.py"}
EVIDENCE_ONLY_TOOLING_PATHS = {
    "scripts/evidence_portability.py",
    "scripts/check_g07_baseline.py",
    "scripts/check_project_progress.py",
    "tests/tooling/test_g07_baseline.py",
    "tests/tooling/test_project_progress.py",
    "scripts/check_phase_g_gate.py",
    "tests/tooling/test_phase_g_gate.py",
    "docs/work_orders/A-01_WORK_INSTRUCTION.md",
    "docs/work_orders/A-01_INVOCATION_PROMPT.md",
    "docs/work_orders/A-03_REWORK_WORK_INSTRUCTION_R2.md",
    "docs/work_orders/A-03_REWORK_INVOCATION_PROMPT_R2.md",
    "docs/work_orders/A-13_REWORK_WORK_INSTRUCTION_R2.md",
    "docs/work_orders/A-13_REWORK_INVOCATION_PROMPT_R2.md",
    "docs/work_orders/A-14_WORK_INSTRUCTION.md",
    "docs/work_orders/A-14_INVOCATION_PROMPT.md",
    "docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R2.md",
    "docs/work_orders/A-14_REWORK_INVOCATION_PROMPT_R2.md",
    "docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R3.md",
    "docs/work_orders/A-14_REWORK_INVOCATION_PROMPT_R3.md",
    "docs/work_orders/A-15_WORK_INSTRUCTION.md",
    "docs/work_orders/A-15_INVOCATION_PROMPT.md",
}


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def normalize_change_classification(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    return CHANGE_CLASSIFICATION_ALIASES.get(value)


def compute_snapshot_hash(progress: Mapping[str, Any]) -> str:
    material = dict(progress)
    material.pop("snapshot_hash", None)
    return hashlib.sha256(canonical_json_bytes(material)).hexdigest().upper()


def _sha256(path: Path) -> str:
    for root in (path.parent, *path.parents):
        if (root / ".git").exists():
            try:
                return portable_hash(root, path.relative_to(root).as_posix())
            except ValueError:
                break
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _tracked_clean(root: Path, relative: str) -> bool:
    tracked = subprocess.run(
        ["git", "ls-files", "--error-unmatch", "--", relative],
        cwd=root,
        capture_output=True,
        check=False,
    )
    dirty = subprocess.run(
        ["git", "status", "--porcelain=v1", "--", relative],
        cwd=root,
        capture_output=True,
        check=False,
    )
    return tracked.returncode == 0 and dirty.returncode == 0 and not dirty.stdout.strip()


def _a14_successor_live_rows(root: Path) -> dict[str, dict[str, Any]]:
    contracts = (
        (
            "A-14_A13_SUCCESSOR_*.json",
            "a13_successor_registry",
            "a13_successor_projection",
            "4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771",
        ),
        (
            "A-14_A14_SUCCESSOR_*.json",
            "a14_successor_registry",
            "a14_successor_projection",
            "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8",
        ),
    )
    rows: dict[str, dict[str, Any]] = {}
    manifest_root = root / "docs/evidence/manifests"
    for pattern, artifact_type, projection_key, predecessor_sha in contracts:
        for registry_path in sorted(manifest_root.glob(pattern)):
            relative = registry_path.relative_to(root).as_posix()
            if not _tracked_clean(root, relative):
                continue
            try:
                registry = json.loads(registry_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            projection = registry.get(projection_key, {})
            if (
                registry.get("artifact_type") != artifact_type
                or registry.get("self_reference") is not False
                or projection.get("predecessor_manifest_sha256") != predecessor_sha
            ):
                continue
            rows.update(
                {
                    str(row.get("path")): row
                    for row in projection.get("live_raw_checksums", [])
                    if isinstance(row, dict)
                }
            )
    return rows


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_detached_digest_path(progress: Mapping[str, Any]) -> str:
    reference = progress.get("current_progress_evidence_ref")
    if reference is None:
        return BUNDLE_PATHS["detached_digest"]
    if not isinstance(reference, dict):
        raise ValueError("CURRENT_PROGRESS_EVIDENCE_REF_INVALID")
    relative = reference.get("path")
    if not isinstance(relative, str) or not re.fullmatch(
        r"docs/progress/progress-handoff-detached-digest-[a-z0-9-]+\.json",
        relative,
    ):
        raise ValueError("CURRENT_PROGRESS_EVIDENCE_PATH_INVALID")
    return relative


def extract_handoff_summary(text: str) -> dict[str, Any]:
    match = re.search(r"```json anvil-recovery-summary\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match is None:
        raise ValueError("HANDOFF_MACHINE_SUMMARY_MISSING")
    return json.loads(match.group(1))


def load_bundle(root: Path) -> dict[str, Any]:
    resolved = root.resolve()
    bundle: dict[str, Any] = {"_root": resolved, "_file_hashes": {}}
    for key, relative in BUNDLE_PATHS.items():
        if key == "detached_digest":
            continue
        path = resolved / relative
        if key == "handoff_text":
            text = path.read_text(encoding="utf-8")
            bundle["handoff_text"] = text
            bundle["handoff"] = extract_handoff_summary(text)
        else:
            bundle[key] = _load_json(path)
        bundle["_file_hashes"][relative] = _sha256(path)
    detached_relative = resolve_detached_digest_path(bundle["progress"])
    detached_path = resolved / detached_relative
    bundle["detached_digest"] = _load_json(detached_path)
    bundle["_detached_digest_path"] = detached_relative
    bundle["_file_hashes"][detached_relative] = _sha256(detached_path)
    return bundle


def failure_projection(ledger: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    counts: defaultdict[str, int] = defaultdict(int)
    for entry in ledger.get("entries", []):
        is_valid = (
            entry.get("result_status") == "FAILURE_REPORT"
            and entry.get("accepted") is True
            and entry.get("counts_toward_valid_failure") is True
            and entry.get("validator_acceptance") is True
            and isinstance(entry.get("evidence_refs"), list)
            and bool(entry.get("evidence_refs"))
            and all(
                isinstance(reference, dict)
                and isinstance(reference.get("path"), str)
                and isinstance(reference.get("sha256"), str)
                for reference in entry.get("evidence_refs", [])
            )
        )
        if is_valid:
            key = f"{entry.get('step_lineage_id')}|{entry.get('failure_fingerprint')}"
            counts[key] += 1
    return {
        key: {
            "valid_failure_count": count,
            "takeover_status": "MAIN_AGENT_TAKEOVER_REQUIRED" if count >= 3 else "NOT_REQUIRED",
        }
        for key, count in counts.items()
    }


def _validate_failure_ledger(ledger: Mapping[str, Any], root: Path | None = None) -> list[str]:
    errors: list[str] = []
    if ledger.get("canonical_key") != ["step_lineage_id", "failure_fingerprint"]:
        errors.append("FAILURE_LINEAGE_KEY_INVALID")
    accepted_counts: defaultdict[str, int] = defaultdict(int)
    for entry in ledger.get("entries", []):
        result_status = entry.get("result_status")
        accepted = entry.get("accepted") is True
        counts = entry.get("counts_toward_valid_failure") is True
        validator = entry.get("validator_acceptance") is True
        evidence = entry.get("evidence_refs")
        lineage = entry.get("step_lineage_id")
        fingerprint = entry.get("failure_fingerprint")
        if result_status not in RESULT_STATUSES:
            errors.append("FAILURE_RESULT_STATUS_INVALID")
        evidence_is_structured = (
            isinstance(evidence, list)
            and bool(evidence)
            and all(
                isinstance(reference, dict)
                and isinstance(reference.get("path"), str)
                and isinstance(reference.get("sha256"), str)
                for reference in evidence
            )
        )
        valid = (
            result_status == "FAILURE_REPORT"
            and accepted
            and counts
            and validator
            and evidence_is_structured
            and isinstance(lineage, str)
            and bool(lineage)
            and isinstance(fingerprint, str)
            and bool(fingerprint)
        )
        if counts != valid or (accepted and result_status != "FAILURE_REPORT"):
            errors.append("FAILURE_COUNT_INVALID")
        if valid:
            key = f"{lineage}|{fingerprint}"
            accepted_counts[key] += 1
            if entry.get("accepted_sequence") != accepted_counts[key]:
                errors.append("FAILURE_ACCEPTED_SEQUENCE_INVALID")
            expected_takeover = (
                "MAIN_AGENT_TAKEOVER_REQUIRED" if accepted_counts[key] >= 3 else "NOT_REQUIRED"
            )
            if entry.get("takeover_status") != expected_takeover:
                errors.append("TAKEOVER_STATE_INVALID")
            if root is not None:
                for reference in evidence:
                    path = root / reference["path"]
                    if not path.is_file():
                        errors.append("FAILURE_EVIDENCE_MISSING")
                    elif _sha256(path) != reference["sha256"]:
                        errors.append("FAILURE_EVIDENCE_HASH_MISMATCH")
        else:
            if entry.get("accepted_sequence") is not None:
                errors.append("FAILURE_REJECTED_SEQUENCE_FORBIDDEN")
            if entry.get("takeover_status") != "NOT_REQUIRED":
                errors.append("TAKEOVER_STATE_INVALID")
    return errors


def _validate_failure_projection(bundle: Mapping[str, Any]) -> list[str]:
    projection = failure_projection(bundle["failure_ledger"])
    active_lineage = bundle["progress"].get("active_failure_lineage", {}).get("step_lineage_id")
    expected = sum(
        item.get("valid_failure_count", 0)
        for key, item in projection.items()
        if key.split("|", 1)[0] == active_lineage
    )
    if bundle["progress"].get("valid_failure_count") != expected:
        return ["FAILURE_PROJECTION_MISMATCH"]
    return []


def _parse_approval_artifact(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")

    def metadata(name: str) -> str | None:
        match = re.search(rf"^- {re.escape(name)}:\s*`?([^`\r\n]+)`?\s*$", text, re.MULTILINE)
        return match.group(1).strip() if match else None

    approved_artifacts = re.findall(r"^\| `([^`]+)` \| `[A-F0-9]{64}` \|$", text, re.MULTILINE)
    return {
        "approval_id": metadata("approval_id"),
        "subject_hash": metadata("subject_hash"),
        "scope": metadata("scope"),
        "approved_artifacts": approved_artifacts,
    }


def _validate_nonsemantic(registry: Mapping[str, Any], root: Path) -> list[str]:
    errors: list[str] = []
    for binding in registry.get("bindings", []):
        if not binding.get("root_human_approval_id"):
            errors.append("NSEM_ROOT_APPROVAL_MISSING")
        if binding.get("old_hash") == binding.get("new_hash"):
            errors.append("NSEM_HASH_UNCHANGED")
        classification = binding.get("semantic_diff_classification")
        if classification != "NON_SEMANTIC" or classification in SEMANTIC_CHANGE_CLASSES:
            errors.append("NSEM_SEMANTIC_DISGUISE")
        root_scope = binding.get("root_approval_scope")
        derived_scope = binding.get("derived_scope")
        if not isinstance(root_scope, str) or not isinstance(derived_scope, list):
            errors.append("NSEM_SCOPE_INVALID")
        approval_id = binding.get("root_human_approval_id")
        if approval_id:
            approval_path = root / "docs" / "approvals" / f"{approval_id}.md"
            try:
                approval = _parse_approval_artifact(approval_path)
            except OSError:
                errors.append("NSEM_APPROVAL_ARTIFACT_INVALID")
                continue
            if (
                approval.get("approval_id") != approval_id
                or approval.get("subject_hash") != binding.get("root_approval_subject_hash")
                or approval.get("scope") != root_scope
            ):
                errors.append("NSEM_APPROVAL_ARTIFACT_INVALID")
            approved_artifacts = set(approval.get("approved_artifacts", []))
            if not set(derived_scope).issubset(approved_artifacts):
                errors.append("NSEM_SCOPE_EXPANSION")
            if binding.get("artifact_path") not in set(derived_scope):
                errors.append("NSEM_SCOPE_EXPANSION")
    return errors


def _validate_dir(bundle: Mapping[str, Any]) -> list[str]:
    errors: list[str] = []
    registry = bundle["dir_registry"]
    progress = bundle["progress"]
    checkpoints = registry.get("checkpoints", [])
    by_name = {item.get("checkpoint"): item for item in checkpoints}
    if set(by_name) != {"DIR-1", "DIR-2", "DIR-3", "DIR-X"} or len(checkpoints) != 4:
        errors.append("DIR_CHECKPOINT_SET_INVALID")
    expected_triggers = {
        "DIR-1": "A-15_ACCEPTED",
        "DIR-2": "C-15_ACCEPTED",
        "DIR-3": "E-11_ACCEPTED",
        "DIR-X": "DIRX-LRN-CRITICAL",
    }
    events_by_id = {
        event.get("event_id"): event
        for event in bundle["events"].get("events", [])
        if isinstance(event, dict) and event.get("event_id")
    }
    for name, checkpoint in by_name.items():
        status = checkpoint.get("status")
        if status not in DIR_STATUSES:
            errors.append("DIR_STATUS_INVALID")
        if checkpoint.get("verdict") not in DIR_VERDICTS:
            errors.append("DIR_VERDICT_INVALID")
        if checkpoint.get("canonical_trigger") != expected_triggers.get(name):
            errors.append("DIRX_TRIGGER_INVALID" if name == "DIR-X" else "DIR_TRIGGER_INVALID")
        if status == "CLEARED" and not checkpoint.get("owner_direction_event_id"):
            errors.append("DIR_DIRECTION_EVENT_REQUIRED")
        if status != "NOT_REACHED":
            trigger = events_by_id.get(checkpoint.get("trigger_event_id"))
            if (
                trigger is None
                or trigger.get("event_type") != "DIR_REACHED"
                or trigger.get("subject_ref") != name
                or trigger.get("details", {}).get("checkpoint") != name
                or trigger.get("details", {}).get("subject_hash") != checkpoint.get("subject_hash")
            ):
                errors.append("DIR_TRIGGER_EVENT_INVALID")
        if status in {"WAITING_OWNER_DIRECTION", "CLEARED"}:
            report = events_by_id.get(checkpoint.get("report_event_id"))
            trigger = events_by_id.get(checkpoint.get("trigger_event_id"))
            if (
                report is None
                or report.get("event_type") != "DIR_REPORTED"
                or report.get("subject_ref") != name
                or report.get("details", {}).get("checkpoint") != name
                or report.get("details", {}).get("subject_hash") != checkpoint.get("subject_hash")
                or report.get("details", {}).get("report_ref") != checkpoint.get("report_ref")
            ):
                errors.append("DIR_REPORT_EVENT_INVALID")
            elif trigger is not None and report.get("sequence", 0) <= trigger.get("sequence", 0):
                errors.append("DIR_EVENT_CHAIN_INVALID")
        if status == "CLEARED":
            direction = events_by_id.get(checkpoint.get("owner_direction_event_id"))
            report = events_by_id.get(checkpoint.get("report_event_id"))
            if (
                direction is None
                or direction.get("event_type") != "DIR_OWNER_DIRECTION_RECORDED"
                or direction.get("actor") != "신산님"
                or direction.get("subject_ref") != name
                or direction.get("details", {}).get("checkpoint") != name
                or direction.get("details", {}).get("subject_hash") != checkpoint.get("subject_hash")
                or not direction.get("details", {}).get("direction")
            ):
                errors.append("DIR_DIRECTION_EVENT_INVALID")
            elif report is not None and direction.get("sequence", 0) <= report.get("sequence", 0):
                errors.append("DIR_EVENT_CHAIN_INVALID")
        if status in {"DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION"}:
            if progress.get("worker_lease") is not None or progress.get("write_lease") is not None:
                errors.append("DIR_HOLD_LEASE_FORBIDDEN")
            if checkpoint.get("lease_released") is not True:
                errors.append("DIR_HOLD_LEASE_FORBIDDEN")
            if not checkpoint.get("blocked_next_action"):
                errors.append("DIR_BLOCKED_NEXT_ACTION_REQUIRED")

    package_trigger_map = {"A-15": "DIR-1", "C-15": "DIR-2", "E-11": "DIR-3"}
    for event in bundle["events"].get("events", []):
        package = event.get("subject_ref")
        accepted = (
            (
                event.get("event_type") == "PACKAGE_COMPLETED"
                and event.get("details", {}).get("package_status") == "ACCEPTED"
            )
            or (
                event.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
                and event.get("details", {}).get("decision") == "ACCEPTED"
            )
        )
        if accepted and package in package_trigger_map:
            checkpoint = by_name.get(package_trigger_map[package])
            if checkpoint is None or checkpoint.get("status") == "NOT_REACHED":
                errors.append("DIR_TRIGGER_CHECKPOINT_MISSING")
    return errors


def recovery_projection(bundle: Mapping[str, Any]) -> dict[str, Any]:
    progress = bundle["progress"]
    decision = progress.get("reporting_decision", {})
    return {
        "root_human_approval_binding": progress.get("root_human_approval_binding"),
        "derived_baseline_binding": progress.get("derived_baseline_binding"),
        "completed_packages": progress.get("completed_packages"),
        "valid_failure_count": progress.get("valid_failure_count"),
        "current_work_package": progress.get("current_work_package"),
        "next_safe_action": progress.get("next_safe_action"),
        "repository": progress.get("repository"),
        "reporting_decision": decision.get("decision"),
        "reporting_reason_codes": decision.get("reason_codes"),
        "stop_before_dialogue_report": decision.get("stop_before_dialogue_report"),
    }


def _validate_reporting(progress: Mapping[str, Any]) -> list[str]:
    decision = progress.get("reporting_decision")
    if not isinstance(decision, dict) or decision.get("decision") not in REPORTING_DECISIONS:
        return ["RECOVERY_REPORTING_DECISION_INVALID"]
    name = decision["decision"]
    stop = decision.get("stop_before_dialogue_report")
    if name == "AUTO_CONTINUE" and stop is not False:
        return ["RECOVERY_ROUTINE_MUST_AUTO_CONTINUE"]
    if name == "STOP_AND_REPORT_SCOPE_RISK" and stop is not True:
        return ["RECOVERY_SCOPE_RISK_MUST_STOP"]
    if name == "STOP_AND_REPORT_DIR" and stop is not True:
        return ["RECOVERY_DIR_MUST_STOP"]
    if not isinstance(decision.get("reason_codes"), list) or not decision["reason_codes"]:
        return ["RECOVERY_REPORTING_REASON_REQUIRED"]
    return []


def _validate_reporting_state(bundle: Mapping[str, Any]) -> list[str]:
    progress = bundle["progress"]
    decision = progress.get("reporting_decision", {}).get("decision")
    pending_scope_risk = any(
        normalize_change_classification(item.get("change_classification"))
        in SEMANTIC_CHANGE_CLASSES
        for item in progress.get("pending_approvals", [])
        if isinstance(item, dict)
    )
    dir_stop = any(
        item.get("status") in {"DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION"}
        for item in bundle["dir_registry"].get("checkpoints", [])
    )
    if dir_stop and decision != "STOP_AND_REPORT_DIR":
        return ["RECOVERY_DIR_MUST_STOP"]
    if pending_scope_risk and decision != "STOP_AND_REPORT_SCOPE_RISK":
        return ["RECOVERY_SCOPE_RISK_MUST_STOP"]
    if not dir_stop and not pending_scope_risk and decision != "AUTO_CONTINUE":
        return ["RECOVERY_ROUTINE_MUST_AUTO_CONTINUE"]
    return []


def _validate_events(bundle: Mapping[str, Any]) -> list[str]:
    errors: list[str] = []
    stream = bundle["events"]
    events = stream.get("events", [])
    errors.extend(validate_event_stream(stream, bundle["event_contract"], bundle["progress"]))
    sequences = [event.get("sequence") for event in events]
    if not sequences or not all(isinstance(value, int) for value in sequences):
        errors.append("PRG_EVENT_SEQUENCE_INVALID")
        return errors
    progress = bundle["progress"]
    if progress.get("event_sequence") != sequences[-1]:
        errors.append("PRG_EVENT_SEQUENCE_MISMATCH")
    if progress.get("last_event_id") != events[-1].get("event_id"):
        errors.append("PRG_LAST_EVENT_MISMATCH")
    event_types = set(bundle["event_contract"].get("event_types", []))
    if not REQUIRED_EVENT_TYPES.issubset(event_types):
        errors.append("EVENT_CONTRACT_MISSING_TYPE")
    return errors


def validate_event_stream(
    stream: Mapping[str, Any],
    contract: Mapping[str, Any],
    progress: Mapping[str, Any] | None = None,
) -> list[str]:
    errors: list[str] = []
    if contract.get("append_only") is not True:
        errors.append("EVENT_CONTRACT_APPEND_ONLY_REQUIRED")
    event_types = set(contract.get("event_types", []))
    payload_contracts = contract.get("payload_contracts")
    if not isinstance(payload_contracts, dict) or set(payload_contracts) != event_types:
        errors.append("EVENT_PAYLOAD_CONTRACT_SET_INVALID")
        payload_contracts = {}
    events = stream.get("events", [])
    sequences = [event.get("sequence") for event in events if isinstance(event, dict)]
    repository_events = [
        event
        for event in events
        if isinstance(event, dict)
        and event.get("event_type") in {"GIT_PUSH", "REPOSITORY_RECONCILED"}
    ]
    projection_events = [
        event for event in events
        if isinstance(event, dict)
        and event.get("event_type") in {"PACKAGE_STARTED", "PACKAGE_COMPLETED", "PACKAGE_RESUMED", "MAIN_PACKAGE_ACCEPTED", "PHASE_GATE_DECIDED"}
        and isinstance(event.get("details"), dict)
        and event["details"].get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE
    ]
    current_repository_event = max(
        repository_events + projection_events,
        key=lambda event: event.get("sequence", 0),
        default=None,
    )
    if sequences:
        first = stream.get("first_sequence")
        expected = list(range(first, first + len(sequences))) if isinstance(first, int) else []
        if sequences != expected or stream.get("last_sequence") != sequences[-1]:
            errors.append("PRG_EVENT_SEQUENCE_REGRESSION")
    for event in events:
        if not isinstance(event, dict):
            errors.append("EVENT_ENVELOPE_INVALID")
            continue
        event_type = event.get("event_type")
        if event_type not in event_types:
            errors.append("EVENT_TYPE_UNREGISTERED")
            continue
        details = event.get("details")
        if isinstance(details, dict) and event_type == "WORKER_LEASE_ISSUED" and not details.get("subject_ref"):
            details = {**details, "subject_ref": event.get("subject_ref")}
        event_contract = payload_contracts.get(event_type, {})
        required = event_contract.get("required_details", [])
        if not isinstance(details, dict) or any(
            field not in details or details.get(field) is None or details.get(field) == ""
            for field in required
        ):
            errors.append("EVENT_PAYLOAD_MISSING")
        if not event_contract.get("effect"):
            errors.append("EVENT_EFFECT_CONTRACT_MISSING")
        if event_type == "GIT_PUSH" and isinstance(details, dict):
            evidence = details.get("evidence_ref")
            if not isinstance(evidence, dict) or not evidence.get("path") or not evidence.get("sha256"):
                errors.append("EVENT_PAYLOAD_MISSING")
        if (
            event is current_repository_event
            and event_type == "GIT_PUSH"
            and isinstance(details, dict)
            and progress is not None
        ):
            repository = progress.get("repository", {})
            if (
                details.get("remote_commit") != repository.get("remote_head")
                or details.get("local_commit") != repository.get("local_head")
                or details.get("branch") != repository.get("branch")
            ):
                errors.append("EVENT_EFFECT_MISMATCH")
        if (
            event is current_repository_event
            and event_type in {"PACKAGE_STARTED", "PACKAGE_COMPLETED", "PACKAGE_RESUMED", "MAIN_PACKAGE_ACCEPTED", "PHASE_GATE_DECIDED"}
            and isinstance(details, dict)
            and progress is not None
            and progress.get("event_sequence") != 207
        ):
            repository = progress.get("repository", {})
            observed_local = details.get("dispatch_head", details.get("completion_head", details.get("acceptance_head")))
            observed_remote = details.get("dispatch_upstream_head", details.get("completion_upstream_head", details.get("acceptance_upstream_head")))
            if (
                observed_local != repository.get("local_head")
                or observed_remote != repository.get("remote_head")
                or details.get("projection_mode") != repository.get("projection_mode")
                or details.get("validated_base_commit") != repository.get("validated_base_commit")
                or details.get("head_relation") != repository.get("head_relation")
                or details.get("exact_allowed_paths") != repository.get("exact_allowed_paths")
            ):
                errors.append("EVENT_EFFECT_MISMATCH")
        if (
            event is current_repository_event
            and event_type == "REPOSITORY_RECONCILED"
            and isinstance(details, dict)
            and progress is not None
        ):
            repository = progress.get("repository", {})
            projection_fields = ["branch", "local_head", "remote_head", "upstream"]
            if repository.get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE:
                projection_fields.extend(
                    [
                        "projection_mode",
                        "validated_base_commit",
                        "head_relation",
                        "exact_allowed_paths",
                    ]
                )
            if any(details.get(field) != repository.get(field) for field in projection_fields):
                errors.append("EVENT_EFFECT_MISMATCH")
    return sorted(set(errors))


def _validate_handoff(bundle: Mapping[str, Any]) -> list[str]:
    progress = bundle["progress"]
    handoff = bundle["handoff"]
    comparisons = {
        "event_sequence": ("event_sequence", "HANDOFF_SEQUENCE_MISMATCH"),
        "status": ("status", "HANDOFF_STATUS_MISMATCH"),
        "current_work_package": ("current_work_package", "HANDOFF_PACKAGE_MISMATCH"),
        "last_event_id": ("last_event_id", "HANDOFF_LAST_EVENT_MISMATCH"),
        "design_baseline_hash": ("design_baseline_hash", "HANDOFF_BASELINE_MISMATCH"),
        "valid_failure_count": ("valid_failure_count", "HANDOFF_FAILURE_COUNT_MISMATCH"),
        "next_safe_action": ("next_safe_action", "HANDOFF_NEXT_ACTION_MISMATCH"),
    }
    errors: list[str] = []
    for progress_field, (handoff_field, reason) in comparisons.items():
        if progress.get(progress_field) != handoff.get(handoff_field):
            errors.append(reason)
    if progress.get("dir_review", {}).get("status") != handoff.get("dir_status"):
        errors.append("HANDOFF_DIR_STATUS_MISMATCH")
    repository = progress.get("repository", {})
    if repository.get("local_head") != handoff.get("repository_head"):
        errors.append("HANDOFF_REPOSITORY_HEAD_MISMATCH")
    if repository.get("upstream") != handoff.get("repository_upstream"):
        errors.append("HANDOFF_REPOSITORY_UPSTREAM_MISMATCH")
    if repository.get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE:
        projection_comparisons = {
            "projection_mode": ("repository_projection_mode", "HANDOFF_REPOSITORY_PROJECTION_MISMATCH"),
            "validated_base_commit": ("repository_validated_base_commit", "HANDOFF_REPOSITORY_BASE_MISMATCH"),
            "head_relation": ("repository_head_relation", "HANDOFF_REPOSITORY_RELATION_MISMATCH"),
            "exact_allowed_paths": ("repository_exact_allowed_paths", "HANDOFF_REPOSITORY_PATH_SET_MISMATCH"),
        }
        for repository_field, (handoff_field, reason) in projection_comparisons.items():
            if repository.get(repository_field) != handoff.get(handoff_field):
                errors.append(reason)
    reporting = progress.get("reporting_decision", {}).get("decision")
    if reporting != handoff.get("reporting_decision"):
        errors.append("HANDOFF_REPORTING_DECISION_MISMATCH")
    return errors


def validate_schema_catalog(catalog: Mapping[str, Any], root: Path) -> list[str]:
    errors: list[str] = []
    entries = catalog.get("schemas")
    if not isinstance(entries, list) or len(entries) != 6:
        return ["SCHEMA_CATALOG_SET_INVALID"]
    names: set[str] = set()
    paths: set[str] = set()
    for entry in entries:
        name = entry.get("name")
        relative = entry.get("path")
        if name in names or relative in paths:
            errors.append("SCHEMA_CATALOG_DUPLICATE")
            continue
        names.add(name)
        paths.add(relative)
        try:
            schema = _load_json(root / relative)
        except (OSError, json.JSONDecodeError, TypeError):
            errors.append("SCHEMA_FILE_INVALID")
            continue
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            errors.append("SCHEMA_DRAFT_INVALID")
    return sorted(set(errors))


def _validate_registry_refs(bundle: Mapping[str, Any]) -> list[str]:
    progress = bundle["progress"]
    refs = progress.get("registry_refs")
    if not isinstance(refs, dict):
        return ["PRG_REGISTRY_REFS_MISSING"]
    errors: list[str] = []
    for reference in refs.values():
        if not isinstance(reference, dict):
            errors.append("PRG_REGISTRY_REF_INVALID")
            continue
        path = reference.get("path")
        actual = bundle.get("_file_hashes", {}).get(path)
        if actual is None or actual != reference.get("sha256"):
            errors.append("PRG_REGISTRY_HASH_MISMATCH")
    return errors


def validate_detached_progress_binding(bundle: Mapping[str, Any]) -> list[str]:
    digest = bundle.get("detached_digest")
    if not isinstance(digest, dict):
        return ["DETACHED_DIGEST_MISSING"]
    progress = bundle["progress"]
    handoff = bundle["handoff"]
    progress_binding = digest.get("progress", {})
    handoff_binding = digest.get("handoff", {})
    errors: list[str] = []
    expected_progress_path = BUNDLE_PATHS["progress"]
    expected_handoff_path = BUNDLE_PATHS["handoff_text"]
    if (
        digest.get("algorithm") != "SHA-256"
        or digest.get("event_sequence") != progress.get("event_sequence")
        or progress_binding.get("path") != expected_progress_path
        or handoff_binding.get("path") != expected_handoff_path
    ):
        errors.append("DETACHED_DIGEST_MISMATCH")
    progress_canonical = hashlib.sha256(canonical_json_bytes(progress)).hexdigest().upper()
    handoff_canonical = hashlib.sha256(canonical_json_bytes(handoff)).hexdigest().upper()
    if progress_binding.get("canonical_json_sha256") != progress_canonical:
        errors.append("DETACHED_DIGEST_MISMATCH")
    if handoff_binding.get("machine_summary_canonical_sha256") != handoff_canonical:
        errors.append("DETACHED_DIGEST_MISMATCH")
    root = bundle["_root"]
    try:
        progress_file_matches = portable_row_matches(
            root,
            expected_progress_path,
            progress_binding.get("bytes"),
            progress_binding.get("file_sha256"),
        )
        handoff_file_matches = portable_row_matches(
            root,
            expected_handoff_path,
            handoff_binding.get("bytes"),
            handoff_binding.get("file_sha256"),
        )
        if not progress_file_matches or not handoff_file_matches:
            errors.append("DETACHED_DIGEST_MISMATCH")
    except (OSError, TypeError):
        errors.append("DETACHED_DIGEST_MISMATCH")
    return sorted(set(errors))


def validate_manifest_progress_binding(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    relative = bundle.get("_detached_digest_path", BUNDLE_PATHS["detached_digest"])
    rows = [
        row
        for row in manifest.get("raw_checksums", [])
        if isinstance(row, dict) and row.get("path") == relative
    ]
    if len(rows) != 1:
        return ["MANIFEST_DETACHED_DIGEST_BINDING_MISSING"]
    row = rows[0]
    actual_hash = bundle.get("_file_hashes", {}).get(relative)
    try:
        actual_bytes = (bundle["_root"] / relative).stat().st_size
    except OSError:
        return ["MANIFEST_DETACHED_DIGEST_BINDING_MISSING"]
    if row.get("sha256") != actual_hash or row.get("bytes") != actual_bytes:
        return ["MANIFEST_DETACHED_DIGEST_BINDING_MISMATCH"]
    return []


def validate_a01_precondition_acceptance_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    manifest_relative = "docs/evidence/manifests/A-01_PRECONDITION_ACCEPTANCE_MANIFEST.json"
    prior_relative = "docs/evidence/manifests/A-01_PRECONDITION_TEST_ENTRY_MANIFEST.json"
    report_relative = "docs/test_reports/A-01_PRECONDITION_TEST_REPORT.md"
    expected_raw_paths = {
        "docs/approvals/APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001.md",
        "docs/baselines/A-01_PRECONDITION_DERIVED_BASELINE.md",
        prior_relative,
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-a01-precondition-acceptance.json",
        report_relative,
        "scripts/check_g07_baseline.py",
        "scripts/check_project_progress.py",
        "tests/tooling/test_g07_baseline.py",
        "tests/tooling/test_project_progress.py",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A01_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    canonical_rows: list[tuple[bytes, str]] = []
    seen: set[str] = set()
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("A01_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        relative = row.get("path")
        if relative == manifest_relative:
            errors.append("MANIFEST_SELF_REFERENCE_FORBIDDEN")
        if (
            not isinstance(relative, str)
            or relative in seen
            or relative.startswith("/")
            or "\\" in relative
            or ".." in Path(relative).parts
        ):
            errors.append("A01_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A01_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        checksum = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != checksum:
            errors.append("A01_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append(
            (
                relative.encode("utf-8"),
                f"{relative}\t{len(raw)}\t{checksum}",
            )
        )
    if seen != expected_raw_paths:
        errors.append("A01_ACCEPTANCE_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_content_bytes") != total_bytes
        or manifest.get("target_hash") != target
        or manifest.get("delivered_hash") != target
        or manifest.get("content_hash") != target
    ):
        errors.append("A01_ACCEPTANCE_TARGET_MISMATCH")
    try:
        prior_hash = _sha256(root / prior_relative)
        report_hash = _sha256(root / report_relative)
    except OSError:
        errors.append("A01_ACCEPTANCE_SOURCE_INVALID")
    else:
        prior = manifest.get("supersedes_artifact_ref", {})
        if prior.get("path") != prior_relative or prior.get("file_sha256") != prior_hash:
            errors.append("A01_ACCEPTANCE_SOURCE_INVALID")
        report = manifest.get("precondition_acceptance", {}).get("task4_test_report_ref", {})
        if report.get("path") != report_relative or report.get("sha256") != report_hash:
            errors.append("A01_ACCEPTANCE_TASK4_INVALID")
    progress = bundle["progress"]
    repository = progress.get("repository", {})
    manifest_repository = manifest.get("repository_projection", {})
    projection_fields = (
        "projection_mode",
        "validated_base_commit",
        "head_relation",
        "branch",
        "upstream",
        "exact_allowed_paths",
    )
    is_current_acceptance = (
        progress.get("current_progress_evidence_ref", {}).get("manifest_path") == manifest_relative
    )
    if is_current_acceptance and any(
        manifest_repository.get(field) != repository.get(field) for field in projection_fields
    ):
        errors.append("A01_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    acceptance = manifest.get("precondition_acceptance", {})
    progress_acceptance = progress.get("a01_precondition", {})
    if (
        acceptance.get("status") != "ACCEPTED"
        or acceptance.get("readiness") != "READY_FOR_A01_WI"
        or acceptance.get("status") != progress_acceptance.get("status")
        or acceptance.get("readiness") != progress_acceptance.get("readiness")
        or manifest.get("self_reference") is not False
    ):
        errors.append("A01_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a02_start_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Recompute the current A-02 start manifest and its fenced projection."""
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-a02-start.json",
        "docs/test_reports/A-01_TEST_REPORT_R2.md",
        "docs/work_orders/A-02_INVOCATION_PROMPT.md",
        "docs/work_orders/A-02_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A02_START_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("A02_START_RAW_CHECKSUMS_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen:
            errors.append("A02_START_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A02_START_RAW_CHECKSUMS_INVALID")
            continue
        actual_hash = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual_hash:
            errors.append("A02_START_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append(
            (relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual_hash}")
        )
    if seen != expected_paths:
        errors.append("A02_START_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_content_bytes") != total_bytes
        or manifest.get("target_hash") != target
        or manifest.get("delivered_hash") != target
        or manifest.get("content_hash") != target
    ):
        errors.append("A02_START_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    manifest_repository = manifest.get("repository_projection", {})
    fields = (
        "projection_mode",
        "validated_base_commit",
        "head_relation",
        "branch",
        "upstream",
        "exact_allowed_paths",
    )
    if any(manifest_repository.get(field) != repository.get(field) for field in fields):
        errors.append("A02_START_REPOSITORY_PROJECTION_MISMATCH")
    active_wi = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    lease_projection = manifest.get("lease_projection", {})
    if (
        manifest.get("package_id") != "A-02"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 46
        or progress.get("status") != "ACTIVE"
        or active_wi.get("artifact_id") != "WI-A-02-20260811-001"
        or active_wi.get("sha256") != "E98C59E23CA907993B250C663E69F9DCF93BA79DAD17BDADDD0EFF76429381F0"
        or worker.get("lease_id") != "worker-lease-a02-20260811-001"
        or write.get("lease_id") != "write-lease-a02-20260811-001"
        or write.get("worker_lease_id") != worker.get("lease_id")
        or lease_projection.get("execution_fencing_token")
        != worker.get("execution_fencing_token")
        or lease_projection.get("write_fencing_token") != write.get("write_fencing_token")
    ):
        errors.append("A02_START_FENCING_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a03_start_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Recompute the A-03 start record and require clean dispatch fencing."""
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-a03-start.json",
        "docs/test_reports/A-02_TEST_REPORT_R2.md",
        "docs/work_orders/A-03_INVOCATION_PROMPT.md",
        "docs/work_orders/A-03_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A03_START_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("A03_START_RAW_CHECKSUMS_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen:
            errors.append("A03_START_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A03_START_RAW_CHECKSUMS_INVALID")
            continue
        actual_hash = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual_hash:
            errors.append("A03_START_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual_hash}"))
    if seen != expected_paths:
        errors.append("A03_START_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_content_bytes") != total_bytes
        or manifest.get("target_hash") != target
        or manifest.get("delivered_hash") != target
        or manifest.get("content_hash") != target
    ):
        errors.append("A03_START_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    for field in ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "exact_allowed_paths"):
        if projection.get(field) != repository.get(field):
            errors.append("A03_START_REPOSITORY_PROJECTION_MISMATCH")
    dispatch = projection.get("dispatch_observation", {})
    active_wi = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    lease = manifest.get("lease_projection", {})
    if (
        manifest.get("package_id") != "A-03"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 60
        or progress.get("status") != "ACTIVE"
        or active_wi.get("artifact_id") != "WI-A-03-20260811-001"
        or active_wi.get("sha256") != "E85FD1D62A70C77E2A4A87AAFA9B727B94CBF428BAA52736975B1FEA572C079F"
        or worker.get("lease_id") != "worker-lease-a03-20260811-001"
        or write.get("lease_id") != "write-lease-a03-20260811-001"
        or write.get("worker_lease_id") != worker.get("lease_id")
        or lease.get("execution_fencing_token") != worker.get("execution_fencing_token")
        or lease.get("write_fencing_token") != write.get("write_fencing_token")
        or dispatch.get("local_head") != "39af6aa58670f8ed1eb72fb4b5e4b13e9abb6599"
        or dispatch.get("remote_head") != dispatch.get("local_head")
        or dispatch.get("worktree_status") != "CLEAN"
    ):
        errors.append("A03_START_FENCING_PROJECTION_MISMATCH")
    if manifest.get("implementation_evidence_present") is not False:
        errors.append("A03_START_IMPLEMENTATION_EVIDENCE_INVALID")
    return sorted(set(errors))


def validate_a02_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/completion_reports/A-02_COMPLETION_REPORT.md",
        "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/A-02_START_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a02-completion-test-review.json",
        "docs/work_orders/A-02_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A02_COMPLETION_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("A02_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen:
            errors.append("A02_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A02_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A02_COMPLETION_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append(
            (relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}")
        )
    if seen != expected_paths:
        errors.append("A02_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_content_bytes") != total_bytes
        or manifest.get("target_hash") != target
        or manifest.get("delivered_hash") != target
        or manifest.get("content_hash") != target
    ):
        errors.append("A02_COMPLETION_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    manifest_repository = manifest.get("repository_projection", {})
    fields = (
        "projection_mode", "validated_base_commit", "head_relation", "branch",
        "upstream", "remote_head", "push_status", "exact_allowed_paths",
    )
    if any(manifest_repository.get(field) != repository.get(field) for field in fields):
        errors.append("A02_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    if (
        manifest.get("package_id") != "A-02"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 49
        or progress.get("status") != "TEST_REVIEW"
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or wi.get("artifact_id") != "WI-A-02-20260811-001"
        or wi.get("package_status") != "TEST_REVIEW"
        or wi.get("result_status") != "COMPLETED"
        or wi.get("accepted") is not False
        or wi.get("independent_tester_status") != "PENDING"
    ):
        errors.append("A02_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a03_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Recompute A-03 completion projection and frozen Developer evidence."""
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/completion_reports/A-03_COMPLETION_REPORT.md",
        "docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/A-03_START_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a03-completion-test-review.json",
        "docs/work_orders/A-03_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A03_COMPLETION_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("A03_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen:
            errors.append("A03_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A03_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A03_COMPLETION_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A03_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_content_bytes") != total_bytes
        or manifest.get("target_hash") != target
        or manifest.get("delivered_hash") != target
        or manifest.get("content_hash") != target
    ):
        errors.append("A03_COMPLETION_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = (
        "projection_mode", "validated_base_commit", "head_relation", "branch",
        "upstream", "remote_head", "push_status", "exact_allowed_paths",
    )
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A03_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    developer = manifest.get("developer_evidence", {})
    if (
        manifest.get("package_id") != "A-03"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 63
        or progress.get("status") != "TEST_REVIEW"
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or wi.get("artifact_id") != "WI-A-03-20260811-001"
        or wi.get("package_status") != "TEST_REVIEW"
        or wi.get("result_status") != "COMPLETED"
        or wi.get("accepted") is not False
        or wi.get("independent_tester_status") != "PENDING"
        or developer.get("manifest_sha256") != "9C3E9C70B61C7D477736B15502F5F3061493A5C8718F26D0B091FE23CB66F1CC"
        or developer.get("target_hash") != "18DED6D1F1034044F7A8B55864AF35F507789BF08FE9B60C70806A6C190093CA"
        or developer.get("mutation") != "FORBIDDEN_FROZEN_PREDECESSOR"
    ):
        errors.append("A03_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a03_rework_start_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-03_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a03-rework-start.json",
        "docs/test_reports/A-03_TEST_REPORT.md",
        "docs/work_orders/A-03_REWORK_WORK_INSTRUCTION_R2.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A03_REWORK_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("A03_REWORK_RAW_CHECKSUMS_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen:
            errors.append("A03_REWORK_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A03_REWORK_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A03_REWORK_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A03_REWORK_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_content_bytes") != total_bytes
        or manifest.get("target_hash") != target
        or manifest.get("delivered_hash") != target
        or manifest.get("content_hash") != target
    ):
        errors.append("A03_REWORK_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A03_REWORK_REPOSITORY_PROJECTION_MISMATCH")
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    wi = progress.get("active_work_instruction") or {}
    lease = manifest.get("lease_projection", {})
    source = manifest.get("failure_source", {})
    if (
        manifest.get("package_id") != "A-03"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 67
        or progress.get("status") != "ACTIVE"
        or progress.get("valid_failure_count") != 1
        or wi.get("artifact_id") != "WI-A-03-20260811-002"
        or wi.get("result_status") != "REWORK_IN_PROGRESS"
        or wi.get("independent_tester_status") != "RETEST_REQUIRED"
        or worker.get("lease_epoch") != 2
        or write.get("write_epoch") != 2
        or write.get("worker_lease_id") != worker.get("lease_id")
        or lease.get("execution_fencing_token") != worker.get("execution_fencing_token")
        or lease.get("write_fencing_token") != write.get("write_fencing_token")
        or source.get("test_report_sha256") != "DD89EB18AB4F16FB46C752734870DBC125D11AC38512EC1F79B25D47EEDC00D6"
        or source.get("finding_ids") != ["A03-TST-BLK-001", "A03-TST-BLK-002"]
    ):
        errors.append("A03_REWORK_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a03_rework_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-03_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-a03-rework-completion-test-review.json",
        "docs/test_reports/A-03_TEST_REPORT.md",
        "docs/work_orders/A-03_REWORK_WORK_INSTRUCTION_R2.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A03_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A03_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A03_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A03_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A03_REWORK_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical),
        manifest.get("target_content_bytes") != total_bytes,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
    )):
        errors.append("A03_REWORK_COMPLETION_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A03_REWORK_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    developer = manifest.get("developer_evidence") or {}
    if (
        manifest.get("package_id") != "A-03"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 70
        or progress.get("status") != "TEST_REVIEW"
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or wi.get("artifact_id") != "WI-A-03-20260811-002"
        or wi.get("result_status") != "COMPLETED"
        or wi.get("accepted") is not False
        or wi.get("rework_revision") != 2
        or wi.get("finding_status") != "FIXED_AWAITING_INDEPENDENT_RETEST"
        or wi.get("independent_tester_status") != "R2_PENDING"
        or wi.get("developer_manifest_sha256") != "772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE"
        or wi.get("developer_target_hash") != "7D089D2EAC2ADF5899F041B6234B0A1393EA1256F2AC8395789CBE1EBF2CEA2A"
        or developer.get("manifest_sha256") != "772B609D003E162395FF983C0688F46C2B8857FA0EC40A0C1FCC0A66F4A2CFEE"
        or developer.get("target_hash") != "7D089D2EAC2ADF5899F041B6234B0A1393EA1256F2AC8395789CBE1EBF2CEA2A"
        or developer.get("mutation") != "FORBIDDEN_FROZEN_DEVELOPER_REVISION_2"
    ):
        errors.append("A03_REWORK_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a03_acceptance_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-03_EVIDENCE_MANIFEST_R2.json",
        "docs/evidence/manifests/A-03_REWORK_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a03-accepted.json",
        "docs/test_reports/A-03_TEST_REPORT_R2.md",
        "docs/work_orders/A-03_REWORK_WORK_INSTRUCTION_R2.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A03_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A03_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A03_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A03_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A03_ACCEPTANCE_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical),
        manifest.get("target_content_bytes") != total_bytes,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
    )):
        errors.append("A03_ACCEPTANCE_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A03_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester = manifest.get("tester_evidence") or {}
    if (
        manifest.get("package_id") != "A-03"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 71
        or progress.get("current_work_package") != "A-04"
        or progress.get("status") != "READY"
        or "A-03" not in progress.get("completed_packages", [])
        or progress.get("active_work_instruction") is not None
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or progress.get("valid_failure_count") != 0
        or progress.get("active_failure_lineage", {}).get("step_lineage_id") != "A-04"
        or progress.get("active_failure_lineage", {}).get("valid_failure_count") != 0
        or progress.get("historical_failure_counts_by_lineage", {}).get("A-03") != 1
        or tester.get("sha256") != "0D16D409B87B161F96811E9297A2F3877398B5124FA5D9D20D648C0235C07C2F"
        or tester.get("verdict") != "PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE"
        or tester.get("blocking_defects") != 0
        or tester.get("closed_findings") != ["A03-TST-BLK-001", "A03-TST-BLK-002"]
        or manifest.get("canonical_l7") != "RUNTIME_DEFERRED / NOT_EXECUTED"
    ):
        errors.append("A03_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a04_start_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-03_ACCEPTANCE_PROGRESS_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a04-start.json",
        "docs/test_reports/A-03_TEST_REPORT_R2.md",
        "docs/work_orders/A-04_INVOCATION_PROMPT.md",
        "docs/work_orders/A-04_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A04_START_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A04_START_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A04_START_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A04_START_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A04_START_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total_bytes, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target)):
        errors.append("A04_START_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A04_START_REPOSITORY_PROJECTION_MISMATCH")
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    wi = progress.get("active_work_instruction") or {}
    lease = manifest.get("lease_projection") or {}
    if (
        manifest.get("package_id") != "A-04"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 74
        or progress.get("current_work_package") != "A-04"
        or progress.get("status") != "ACTIVE"
        or progress.get("active_agent") != "developer-primary-a04"
        or progress.get("valid_failure_count") != 0
        or wi.get("artifact_id") != "WI-A-04-20260811-001"
        or wi.get("sha256") != "1B8CE8809EC6546ED483D0E48294CC547F0767A5D0D31D120B08787290ED753E"
        or wi.get("invocation_sha256") != "DE5A605C7CDB3F84725C4792F612B0455AC00E5C669E8509C1FFF6F0A3F62CDB"
        or wi.get("package_status") != "ACTIVE"
        or worker.get("lease_epoch") != 1
        or write.get("write_epoch") != 1
        or write.get("worker_lease_id") != worker.get("lease_id")
        or lease.get("execution_fencing_token") != worker.get("execution_fencing_token")
        or lease.get("write_fencing_token") != write.get("write_fencing_token")
        or manifest.get("canonical_l7") != "RUNTIME_DEFERRED / NOT_EXECUTED"
    ):
        errors.append("A04_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a04_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Recompute the A-04 TEST_REVIEW transition and frozen Developer evidence."""
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/completion_reports/A-04_COMPLETION_REPORT.md",
        "docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/A-04_START_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a04-completion-test-review.json",
        "docs/work_orders/A-04_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A04_COMPLETION_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A04_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A04_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A04_COMPLETION_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A04_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical),
        manifest.get("target_content_bytes") != total_bytes,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
    )):
        errors.append("A04_COMPLETION_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A04_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    developer = manifest.get("developer_evidence") or {}
    if (
        manifest.get("package_id") != "A-04"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 77
        or progress.get("current_work_package") != "A-04"
        or progress.get("status") != "TEST_REVIEW"
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or progress.get("valid_failure_count") != 0
        or wi.get("artifact_id") != "WI-A-04-20260811-001"
        or wi.get("package_status") != "TEST_REVIEW"
        or wi.get("result_status") != "COMPLETED"
        or wi.get("accepted") is not False
        or wi.get("independent_tester_status") != "PENDING"
        or developer.get("manifest_sha256") != "C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB"
        or developer.get("target_hash") != "D2ED622DD179611026D8B396392C84EB5A373986C7733D0ADA78C897D049464E"
        or developer.get("mutation") != "FORBIDDEN_FROZEN_PREDECESSOR"
        or manifest.get("canonical_l7") != "RUNTIME_DEFERRED / NOT_EXECUTED"
    ):
        errors.append("A04_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a04_acceptance_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-04_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/evidence/manifests/A-04_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a04-accepted.json",
        "docs/test_reports/A-04_TEST_REPORT.md",
        "docs/work_orders/A-04_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A04_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A04_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A04_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A04_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A04_ACCEPTANCE_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total_bytes, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target)):
        errors.append("A04_ACCEPTANCE_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A04_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester = manifest.get("tester_evidence") or {}
    if (
        manifest.get("package_id") != "A-04"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 78
        or progress.get("current_work_package") != "A-05"
        or progress.get("status") != "READY"
        or "A-04" not in progress.get("completed_packages", [])
        or progress.get("active_work_instruction") is not None
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or progress.get("valid_failure_count") != 0
        or progress.get("active_failure_lineage", {}).get("step_lineage_id") != "A-05"
        or progress.get("active_failure_lineage", {}).get("valid_failure_count") != 0
        or progress.get("historical_failure_counts_by_lineage", {}).get("A-04", 0) != 0
        or tester.get("sha256") != "3C809FF5F8C31ABB349A19CAFE5151F403437A9757D0C6FC4BA5BC4A1BC4C1B3"
        or tester.get("verdict") != "PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE"
        or tester.get("blocking_defects") != 0
        or manifest.get("canonical_l7") != "RUNTIME_DEFERRED / NOT_EXECUTED"
    ):
        errors.append("A04_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a05_start_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-04_ACCEPTANCE_PROGRESS_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a05-start.json",
        "docs/test_reports/A-04_TEST_REPORT.md",
        "docs/work_orders/A-05_INVOCATION_PROMPT.md",
        "docs/work_orders/A-05_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A05_START_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A05_START_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A05_START_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A05_START_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A05_START_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total_bytes, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target)):
        errors.append("A05_START_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A05_START_REPOSITORY_PROJECTION_MISMATCH")
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    wi = progress.get("active_work_instruction") or {}
    lease = manifest.get("lease_projection") or {}
    if (
        manifest.get("package_id") != "A-05"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 81
        or progress.get("current_work_package") != "A-05"
        or progress.get("status") != "ACTIVE"
        or progress.get("active_agent") != "developer-primary-a05"
        or progress.get("valid_failure_count") != 0
        or wi.get("artifact_id") != "WI-A-05-20260811-001"
        or wi.get("sha256") != "F80E1641704BD0FD436F220A13228463FFEC6E2585F083A0405075B2C5E8375C"
        or wi.get("invocation_sha256") != "68FC8350B726DE793A8F5DC8B6A988730A09E7B8C214579D49176D342B3C9F29"
        or wi.get("package_status") != "ACTIVE"
        or worker.get("lease_epoch") != 1
        or write.get("write_epoch") != 1
        or write.get("worker_lease_id") != worker.get("lease_id")
        or lease.get("execution_fencing_token") != worker.get("execution_fencing_token")
        or lease.get("write_fencing_token") != write.get("write_fencing_token")
        or manifest.get("canonical_l7") != "RUNTIME_DEFERRED / NOT_EXECUTED"
    ):
        errors.append("A05_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a05_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {"docs/completion_reports/A-05_COMPLETION_REPORT.md", "docs/evidence/manifests/A-05_EVIDENCE_MANIFEST.json", "docs/evidence/manifests/A-05_START_EVIDENCE_MANIFEST.json", "docs/progress/progress-handoff-detached-digest-a05-completion-test-review.json", "docs/work_orders/A-05_WORK_INSTRUCTION.md"}
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list): return ["A05_COMPLETION_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set(); canonical_rows: list[tuple[bytes, str]] = []; total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A05_COMPLETION_RAW_CHECKSUMS_INVALID"); continue
        seen.add(relative)
        try: raw = (root / relative).read_bytes()
        except OSError: errors.append("A05_COMPLETION_RAW_CHECKSUMS_INVALID"); continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual: errors.append("A05_COMPLETION_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw); canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths: errors.append("A05_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8"); target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total_bytes, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target)): errors.append("A05_COMPLETION_TARGET_MISMATCH")
    repository = progress.get("repository", {}); projection = manifest.get("repository_projection", {})
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields): errors.append("A05_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi = progress.get("active_work_instruction") or {}; developer = manifest.get("developer_evidence") or {}
    if (manifest.get("package_id") != "A-05" or manifest.get("self_reference") is not False or progress.get("event_sequence") != 84 or progress.get("status") != "TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("artifact_id") != "WI-A-05-20260811-001" or wi.get("package_status") != "TEST_REVIEW" or wi.get("result_status") != "COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status") != "PENDING" or developer.get("manifest_sha256") != "90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1" or developer.get("target_hash") != "974045F91F01FFDD342099BAA6CC2788C525FE8D74C7C8F5D0BDD31679E22266" or developer.get("mutation") != "FORBIDDEN_FROZEN_PREDECESSOR" or manifest.get("canonical_l7") != "RUNTIME_DEFERRED / NOT_EXECUTED"):
        errors.append("A05_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a05_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]; progress = bundle["progress"]; errors: list[str] = []
    expected = {"docs/evidence/manifests/A-05_COMPLETION_PROGRESS_MANIFEST.json", "docs/evidence/manifests/A-05_EVIDENCE_MANIFEST.json", "docs/progress/progress-handoff-detached-digest-a05-accepted.json", "docs/test_reports/A-05_TEST_REPORT.md", "docs/work_orders/A-05_WORK_INSTRUCTION.md"}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list): return ["A05_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    seen=set(); canonical=[]; total=0
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A05_ACCEPTANCE_RAW_CHECKSUMS_INVALID"); continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A05_ACCEPTANCE_RAW_CHECKSUMS_INVALID"); continue
        actual=hashlib.sha256(raw).hexdigest().upper(); total+=len(raw); canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A05_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A05_ACCEPTANCE_RAW_SET_INVALID")
    rawcanon="\n".join(v for _,v in sorted(canonical)).encode(); target="sha256:"+hashlib.sha256(rawcanon).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(rawcanon),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target)): errors.append("A05_ACCEPTANCE_TARGET_MISMATCH")
    projection=manifest.get("repository_projection") or {}; repository=progress.get("repository") or {}; fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths")
    if any(projection.get(field)!=repository.get(field) for field in fields): errors.append("A05_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {}
    if (progress.get("event_sequence")!=85 or progress.get("current_work_package")!="A-06" or progress.get("status")!="READY" or "A-05" not in progress.get("completed_packages",[]) or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("active_failure_lineage",{}).get("step_lineage_id")!="A-06" or tester.get("sha256")!="AA36A92E883DC8DA39ED01B2F5DF8E9855B166183386986B63B93BF0D79165BA" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or manifest.get("self_reference") is not False or manifest.get("canonical_l7")!="RUNTIME_DEFERRED / NOT_EXECUTED"): errors.append("A05_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))

def validate_a06_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]; expected={"docs/evidence/manifests/A-05_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a06-start.json","docs/test_reports/A-05_TEST_REPORT.md","docs/work_orders/A-06_INVOCATION_PROMPT.md","docs/work_orders/A-06_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["A06_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A06_START_RAW_CHECKSUMS_INVALID"); continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A06_START_RAW_CHECKSUMS_INVALID"); continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A06_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A06_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A06_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A06_START_REPOSITORY_PROJECTION_MISMATCH")
    w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};wi=progress.get("active_work_instruction") or {};lp=manifest.get("lease_projection") or {}
    if (progress.get("event_sequence")!=88 or progress.get("current_work_package")!="A-06" or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a06" or wi.get("artifact_id")!="WI-A-06-20260812-001" or wi.get("sha256")!="83B1F04472D28631CF73645486D8EC138BBB75B7F8EE8679BDA4F8B0C37AECC6" or wi.get("invocation_sha256")!="B4DBBD9937DEFD6F569585D0C3BDDCACD36262C199563E8A651E46B8E84765A1" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or manifest.get("self_reference") is not False): errors.append("A06_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a06_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-06_COMPLETION_REPORT.md","docs/evidence/manifests/A-06_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-06_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a06-completion-test-review.json","docs/work_orders/A-06_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A06_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A06_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A06_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A06_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A06_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A06_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A06_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=91 or progress.get("current_work_package")!="A-06" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("artifact_id")!="WI-A-06-20260812-001" or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449" or developer.get("target_hash")!="0CCF57584738B6CF38949D959297AF0877DC084070C352F7944C85AA0AF91258" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or manifest.get("canonical_l7")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("self_reference") is not False): errors.append("A06_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a06_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-06_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-06_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a06-accepted.json","docs/test_reports/A-06_TEST_REPORT.md","docs/work_orders/A-06_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A06_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A06_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A06_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A06_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A06_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A06_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A06_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {}
    if (progress.get("event_sequence")!=92 or progress.get("current_work_package")!="A-07" or progress.get("status")!="READY" or "A-06" not in progress.get("completed_packages",[]) or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("active_failure_lineage",{}).get("step_lineage_id")!="A-07" or tester.get("sha256")!="F27D15DA8068117710CE3551FAF839F3A4BA28AE9F3EF186DD39641F5E1CC560" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or manifest.get("self_reference") is not False or manifest.get("canonical_l7")!="RUNTIME_DEFERRED / NOT_EXECUTED"): errors.append("A06_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a07_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-06_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a07-start.json","docs/test_reports/A-06_TEST_REPORT.md","docs/work_orders/A-07_INVOCATION_PROMPT.md","docs/work_orders/A-07_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A07_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A07_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A07_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A07_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A07_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A07_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A07_START_REPOSITORY_PROJECTION_MISMATCH")
    w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};wi=progress.get("active_work_instruction") or {};lp=manifest.get("lease_projection") or {}
    if (progress.get("event_sequence")!=95 or progress.get("current_work_package")!="A-07" or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a07" or wi.get("artifact_id")!="WI-A-07-20260812-001" or wi.get("sha256")!="240371EB038AECE4F2613E83613871A737D4831B5FE9A832CB6534A558730799" or wi.get("invocation_sha256")!="1F6476D9F0B0D6EC571FA7456744160BC5CE04A4DBDB7A089A8E092289ABCD8F" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or manifest.get("self_reference") is not False or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED"): errors.append("A07_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a07_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-07_COMPLETION_REPORT.md","docs/evidence/manifests/A-07_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-07_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a07-completion-test-review.json","docs/work_orders/A-07_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A07_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A07_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A07_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A07_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A07_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A07_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A07_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=98 or progress.get("current_work_package")!="A-07" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("artifact_id")!="WI-A-07-20260812-001" or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7" or developer.get("target_hash")!="45633F09FF8690D56499B75C813D6F5000FF4EB0323742CB6C1AF820396ECB9B" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED" or manifest.get("self_reference") is not False): errors.append("A07_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a07_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-07_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-07_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a07-accepted.json","docs/test_reports/A-07_TEST_REPORT.md","docs/work_orders/A-07_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A07_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A07_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A07_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A07_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A07_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A07_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A07_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=99 or progress.get("current_work_package")!="A-08" or progress.get("status")!="READY" or "A-07" not in progress.get("completed_packages",[]) or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("active_failure_lineage",{}).get("step_lineage_id")!="A-08" or tester.get("sha256")!="A5352696B24E95FE8BD86E845AD8B4A0171C805B7521F21F3543461A8C628506" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or developer.get("sha256")!="796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7" or developer.get("target_hash")!="45633F09FF8690D56499B75C813D6F5000FF4EB0323742CB6C1AF820396ECB9B" or manifest.get("self_reference") is not False or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED"): errors.append("A07_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a08_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-07_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a08-start.json","docs/test_reports/A-07_TEST_REPORT.md","docs/work_orders/A-08_INVOCATION_PROMPT.md","docs/work_orders/A-08_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A08_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A08_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A08_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A08_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A08_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A08_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A08_START_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};lp=wi.get("lease_projection") or {}
    if (progress.get("event_sequence")!=102 or progress.get("current_work_package")!="A-08" or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a08" or wi.get("artifact_id")!="WI-A-08-20260812-001" or wi.get("sha256")!="E418BE54E9AC98BEF61F782B127A83332C75ADD1A60CCCFE8DA8766634CC489E" or wi.get("invocation_sha256")!="5BB5F8C23B7CD90CCB478E023F8ECE3A1867768FDE9D56941292E9D0FD0C11CF" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or manifest.get("self_reference") is not False or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("actual_product_validation_status")!="NOT_EXECUTED" or manifest.get("actual_release_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED"): errors.append("A08_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a08_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-08_COMPLETION_REPORT.md","docs/evidence/manifests/A-08_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-08_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a08-completion-test-review.json","docs/work_orders/A-08_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A08_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A08_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A08_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A08_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A08_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A08_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A08_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=105 or progress.get("current_work_package")!="A-08" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("artifact_id")!="WI-A-08-20260812-001" or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="73CC3936D3AF55674412C746B1CB95D53F08B3C8BDA927765286F3E60BE6C9A5" or developer.get("target_hash")!="0C10A4F557B2AAF6D90B5BA8C9320CFD694B4DCBF42C9FF3495E3B5D431DE52C" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("actual_product_validation_status")!="NOT_EXECUTED" or manifest.get("actual_release_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED" or manifest.get("self_reference") is not False): errors.append("A08_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a08_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-08_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-08_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a08-accepted.json","docs/test_reports/A-08_TEST_REPORT.md","docs/work_orders/A-08_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A08_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A08_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A08_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A08_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A08_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A08_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A08_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=106 or progress.get("current_work_package")!="A-09" or progress.get("status")!="READY" or "A-08" not in progress.get("completed_packages",[]) or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("active_failure_lineage",{}).get("step_lineage_id")!="A-09" or tester.get("sha256")!="74D97BB4CBA10151918EDBB49C859936FF2AB3835CAA60986BAFF5B21FFF155A" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or developer.get("sha256")!="73CC3936D3AF55674412C746B1CB95D53F08B3C8BDA927765286F3E60BE6C9A5" or developer.get("target_hash")!="0C10A4F557B2AAF6D90B5BA8C9320CFD694B4DCBF42C9FF3495E3B5D431DE52C" or manifest.get("self_reference") is not False or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("actual_product_validation_status")!="NOT_EXECUTED" or manifest.get("actual_release_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED"): errors.append("A08_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a09_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-08_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a09-start.json","docs/test_reports/A-08_TEST_REPORT.md","docs/work_orders/A-09_INVOCATION_PROMPT.md","docs/work_orders/A-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A09_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A09_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A09_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A09_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A09_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A09_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A09_START_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};lp=wi.get("lease_projection") or {}
    if (progress.get("event_sequence")!=109 or progress.get("current_work_package")!="A-09" or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a09" or wi.get("artifact_id")!="WI-A-09-20260812-001" or wi.get("sha256")!="5BB6F711EB22B8AF776CD04F5E51004B3DACB58D47B8E822BF55854650D152AC" or wi.get("invocation_sha256")!="539CD665C1194D8735AB118E84710C4F86F42CA0D4FE7E45DC93BC39BA479C7F" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or manifest.get("self_reference") is not False or manifest.get("actual_skill_activation_status")!="NOT_EXECUTED" or manifest.get("actual_hook_activation_status")!="NOT_EXECUTED" or manifest.get("actual_runtime_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED"): errors.append("A09_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a09_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-09_COMPLETION_REPORT.md","docs/evidence/manifests/A-09_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-09_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a09-completion-test-review.json","docs/work_orders/A-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A09_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A09_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A09_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A09_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A09_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A09_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A09_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=112 or progress.get("current_work_package")!="A-09" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("artifact_id")!="WI-A-09-20260812-001" or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="A917008E376E34F51BFADE8E74FE1B6E065D7FDBAC79C748D3DC0424A4E23EA3" or developer.get("target_hash")!="915B377C6390405664E8A2685DC502A65FE6305D8F327C80A46EFF457C4D4AA3" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("actual_skill_activation_status")!="NOT_EXECUTED" or manifest.get("actual_hook_activation_status")!="NOT_EXECUTED" or manifest.get("actual_runtime_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED" or manifest.get("self_reference") is not False): errors.append("A09_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a09_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-09_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-09_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a09-accepted.json","docs/test_reports/A-09_TEST_REPORT.md","docs/work_orders/A-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A09_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A09_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A09_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A09_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A09_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A09_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A09_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=113 or progress.get("current_work_package")!="A-10" or progress.get("status")!="READY" or "A-09" not in progress.get("completed_packages",[]) or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("active_failure_lineage",{}).get("step_lineage_id")!="A-10" or tester.get("sha256")!="99F0B25764286668F709D221BE294D1A1F21BA2638EDAF5F0A4D5D7909DCF98F" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or developer.get("sha256")!="A917008E376E34F51BFADE8E74FE1B6E065D7FDBAC79C748D3DC0424A4E23EA3" or developer.get("target_hash")!="915B377C6390405664E8A2685DC502A65FE6305D8F327C80A46EFF457C4D4AA3" or manifest.get("self_reference") is not False or manifest.get("canonical_l4")!="RUNTIME_DEFERRED / NOT_EXECUTED" or manifest.get("actual_skill_activation_status")!="NOT_EXECUTED" or manifest.get("actual_hook_activation_status")!="NOT_EXECUTED" or manifest.get("actual_runtime_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED"): errors.append("A09_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a10_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-09_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a10-start.json","docs/test_reports/A-09_TEST_REPORT.md","docs/work_orders/A-10_INVOCATION_PROMPT.md","docs/work_orders/A-10_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A10_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A10_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A10_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A10_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A10_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A10_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A10_START_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};lp=wi.get("lease_projection") or {}
    if (progress.get("event_sequence")!=116 or progress.get("current_work_package")!="A-10" or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a10" or wi.get("artifact_id")!="WI-A-10-20260812-001" or wi.get("sha256")!="A7D527B3AA9B50F30589526EDC1D790B75A778D96C47A959B7C966418BFECCF5" or wi.get("invocation_sha256")!="5E7A236BF98C80B881F6B9C4FEFDAD2C047EE0A4FF758FEE0289B42D2343AD9E" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or manifest.get("self_reference") is not False or manifest.get("actual_provider_status")!="NOT_EXECUTED" or manifest.get("actual_secret_status")!="NOT_EXECUTED" or manifest.get("actual_egress_status")!="NOT_EXECUTED" or manifest.get("actual_runtime_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED"): errors.append("A10_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a10_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-10_COMPLETION_REPORT.md","docs/evidence/manifests/A-10_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-10_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a10-completion-test-review.json","docs/work_orders/A-10_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A10_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A10_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A10_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A10_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A10_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A10_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A10_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {}
    statuses=("actual_provider_status","actual_secret_status","actual_egress_status","actual_api_status","actual_db_status","actual_event_status","actual_browser_status","actual_network_status","actual_runtime_status","actual_dir_status")
    if (progress.get("event_sequence")!=119 or progress.get("current_work_package")!="A-10" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("artifact_id")!="WI-A-10-20260812-001" or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="C9667081B8BEA555C32F8833D7F28BCF3528882324814CCE08CAAEAA27DE6A84" or developer.get("target_hash")!="C179BA2371401BB57CAA02B5148D96A58B094092BE52088E85C6BA9882CFA64A" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A10_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a10_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-10_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-10_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a10-accepted.json","docs/test_reports/A-10_TEST_REPORT.md","docs/work_orders/A-10_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A10_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A10_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A10_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A10_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A10_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A10_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A10_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {};developer=manifest.get("developer_evidence") or {}
    statuses=("actual_provider_status","actual_secret_status","actual_egress_status","actual_api_status","actual_db_status","actual_event_status","actual_browser_status","actual_network_status","actual_runtime_status","actual_dir_status")
    if (progress.get("event_sequence")!=120 or progress.get("current_work_package")!="A-11" or progress.get("status")!="READY" or "A-10" not in progress.get("completed_packages",[]) or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("active_failure_lineage",{}).get("step_lineage_id")!="A-11" or tester.get("sha256")!="B1B51F68561805B3C12355D6A7A939063EA1AB77EF45553C22E036F4D1682045" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or developer.get("sha256")!="C9667081B8BEA555C32F8833D7F28BCF3528882324814CCE08CAAEAA27DE6A84" or developer.get("target_hash")!="C179BA2371401BB57CAA02B5148D96A58B094092BE52088E85C6BA9882CFA64A" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A10_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a11_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-10_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a11-start.json","docs/test_reports/A-10_TEST_REPORT.md","docs/work_orders/A-11_INVOCATION_PROMPT.md","docs/work_orders/A-11_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A11_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A11_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A11_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A11_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A11_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A11_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A11_START_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};lp=wi.get("lease_projection") or {}
    statuses=("actual_operations_status","actual_api_status","actual_db_status","actual_event_status","actual_sse_status","actual_browser_status","actual_network_status","actual_deploy_status","actual_runtime_status","actual_dir_status")
    if (progress.get("event_sequence")!=123 or progress.get("current_work_package")!="A-11" or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a11" or wi.get("artifact_id")!="WI-A-11-20260812-001" or wi.get("sha256")!="CDDBF40709CCE174F79EBDF64408783AEFAC4F0F471238782A2A5637BF9C65F0" or wi.get("invocation_sha256")!="2A3CEF1D7FB9A3E045067E32276861FCBD324E59DE7AB5A6AB4A25F3D639D36B" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A11_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a11_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-11_COMPLETION_REPORT.md","docs/evidence/manifests/A-11_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-11_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a11-completion-test-review.json","docs/work_orders/A-11_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A11_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A11_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A11_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A11_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A11_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A11_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A11_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {};statuses=("actual_operations_status","actual_api_status","actual_db_status","actual_event_status","actual_sse_status","actual_browser_status","actual_network_status","actual_deploy_status","actual_runtime_status","actual_dir_status")
    if (progress.get("event_sequence")!=126 or progress.get("current_work_package")!="A-11" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="23280C4FD8EA6C3FCEF814D8D429A4BA45FA0BE940E88E8237008B60FDBADFC0" or developer.get("target_hash")!="911C537607FD64112782A6E6506EAAFF4877EBE3C37B46CE8085D0C4C9C40654" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A11_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a11_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-11_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-11_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a11-accepted.json","docs/test_reports/A-11_TEST_REPORT.md","docs/work_orders/A-11_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A11_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A11_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A11_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A11_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A11_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A11_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A11_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=127 or progress.get("current_work_package")!="A-12" or progress.get("status")!="READY" or "A-11" not in progress.get("completed_packages",[]) or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("active_failure_lineage",{}).get("step_lineage_id")!="A-12" or tester.get("sha256")!="1A4F7B02016E03A14F185CC8B847D496848EFADA3F4B6950C80640D99CA00275" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or tester.get("path_count_note")!="MINOR / non-blocking evidence-accounting inconsistency" or developer.get("sha256")!="23280C4FD8EA6C3FCEF814D8D429A4BA45FA0BE940E88E8237008B60FDBADFC0" or developer.get("target_hash")!="911C537607FD64112782A6E6506EAAFF4877EBE3C37B46CE8085D0C4C9C40654" or manifest.get("actual_runtime_status")!="NOT_EXECUTED" or manifest.get("actual_dir_status")!="NOT_EXECUTED" or manifest.get("self_reference") is not False): errors.append("A11_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a12_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-11_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a12-start.json","docs/test_reports/A-11_TEST_REPORT.md","docs/work_orders/A-12_INVOCATION_PROMPT.md","docs/work_orders/A-12_WORK_INSTRUCTION.md"};rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A12_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A12_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A12_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A12_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A12_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A12_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A12_START_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};lp=wi.get("lease_projection") or {}
    if (progress.get("event_sequence")!=130 or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a12" or wi.get("sha256")!="9D2061A6F62C3101A4138A32642DB4C4AC9178B38B421B2C77B3E3A2FF37840F" or wi.get("invocation_sha256")!="C36FD20AC9D39A756C90B61887640C0F05AC91140E604241D738826C9056070A" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or any(manifest.get(k)!="NOT_EXECUTED" for k in ("actual_browser_status","actual_api_status","actual_sse_status","actual_runtime_status","actual_dir_status")) or manifest.get("self_reference") is not False): errors.append("A12_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a12_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-12_COMPLETION_REPORT.md","docs/evidence/manifests/A-12_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-12_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a12-completion-test-review.json","docs/work_orders/A-12_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A12_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A12_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A12_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A12_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A12_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A12_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A12_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {};statuses=("actual_browser_status","actual_api_status","actual_sse_status","actual_runtime_status","actual_dir_status")
    if (progress.get("event_sequence")!=133 or progress.get("current_work_package")!="A-12" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="269F925328145C86F99B5B9622419DDCCAE1A37D50DEF78E5965FF0CCF282015" or developer.get("target_hash")!="DB3457D0B73882183CCD1163ED16E86B64C8749D6BBAFBF4CB59942AA475E2CF" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A12_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a12_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-12_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-12_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a12-accepted.json","docs/test_reports/A-12_TEST_REPORT.md","docs/work_orders/A-12_WORK_INSTRUCTION.md"};rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A12_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A12_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A12_ACCEPTANCE_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A12_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A12_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A12_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A12_ACCEPTANCE_REPOSITORY_PROJECTION_MISMATCH")
    tester=manifest.get("tester_evidence") or {};developer=manifest.get("developer_evidence") or {};statuses=("actual_browser_status","actual_api_status","actual_sse_status","actual_runtime_status","actual_dir_status")
    if (progress.get("event_sequence")!=134 or progress.get("current_work_package")!="A-13" or progress.get("status")!="READY" or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or tester.get("sha256")!="42BDCD1C71E6B0239E1A5313FE247D1491CF78692D5B6B6C4D815A5DEFD00583" or tester.get("verdict")!="PASS_STATIC_CONTRACT / READY_FOR_MAIN_ACCEPTANCE" or tester.get("blocking_defects")!=0 or developer.get("manifest_sha256")!="269F925328145C86F99B5B9622419DDCCAE1A37D50DEF78E5965FF0CCF282015" or developer.get("target_hash")!="DB3457D0B73882183CCD1163ED16E86B64C8749D6BBAFBF4CB59942AA475E2CF" or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A12_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a13_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-12_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a13-start.json","docs/test_reports/A-12_TEST_REPORT.md","docs/work_orders/A-13_INVOCATION_PROMPT.md","docs/work_orders/A-13_WORK_INSTRUCTION.md"};rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A13_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A13_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A13_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A13_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A13_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A13_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A13_START_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};lp=wi.get("lease_projection") or {};statuses=("actual_user_repository_status","actual_browser_status","actual_api_status","actual_db_status","actual_wsl_status","actual_production_status","actual_dir_status")
    if (progress.get("event_sequence")!=137 or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a13" or wi.get("sha256")!="88B142690358661F456C715378B9AFACE5340FC4EBED90D567E07C8B58384835" or wi.get("invocation_sha256")!="8894A6AD20D829908AFAE6FB3C641544E1DCC0A9710C921ABC3681906C1BE4D0" or w.get("lease_epoch")!=1 or wr.get("write_epoch")!=1 or wr.get("worker_lease_id")!=w.get("lease_id") or lp.get("execution_fencing_token")!=w.get("execution_fencing_token") or lp.get("write_fencing_token")!=wr.get("write_fencing_token") or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A13_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a13_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/completion_reports/A-13_COMPLETION_REPORT.md","docs/evidence/manifests/A-13_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-13_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a13-completion-test-review.json","docs/work_orders/A-13_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A13_COMPLETION_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A13_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A13_COMPLETION_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A13_COMPLETION_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A13_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A13_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A13_COMPLETION_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {};statuses=("actual_user_repository_status","actual_browser_status","actual_api_status","actual_db_status","actual_wsl_status","actual_production_status","actual_dir_status")
    if (progress.get("event_sequence")!=140 or progress.get("current_work_package")!="A-13" or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("package_status")!="TEST_REVIEW" or wi.get("result_status")!="COMPLETED" or wi.get("accepted") is not False or wi.get("independent_tester_status")!="PENDING" or developer.get("manifest_sha256")!="BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE" or developer.get("target_hash")!="1AEC2DC560F1AF41B234FEDA3603C25F88B62740E8FB19A83FA85B770D3BA733" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or any(manifest.get(k)!="NOT_EXECUTED" for k in statuses) or manifest.get("self_reference") is not False): errors.append("A13_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a13_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST.json","docs/evidence/manifests/A-13_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a13-rework-start.json","docs/test_reports/A-13_TEST_REPORT.md","docs/work_orders/A-13_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A13_REWORK_START_RAW_CHECKSUMS_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A13_REWORK_START_RAW_CHECKSUMS_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A13_REWORK_START_RAW_CHECKSUMS_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A13_REWORK_START_RAW_CHECKSUMS_INVALID")
    if seen!=expected: errors.append("A13_REWORK_START_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A13_REWORK_START_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A13_REWORK_START_REPOSITORY_PROJECTION_MISMATCH")
    wi=progress.get("active_work_instruction") or {};w=progress.get("worker_lease") or {};wr=progress.get("write_lease") or {};failure=manifest.get("failure_source") or {};pred=manifest.get("predecessor_evidence") or {}
    if (progress.get("event_sequence")!=144 or progress.get("status")!="ACTIVE" or progress.get("active_agent")!="developer-primary-a13" or progress.get("valid_failure_count")!=1 or wi.get("artifact_id")!="WI-A-13-20260812-002" or wi.get("sha256")!="A803A7A2C0810EB9E9F8521AEE1E5A66B99D71246888ECDAD193D233582EB46B" or wi.get("invocation_sha256")!="0AE9CFFFAB917EA9BC050598A2D3DABD5C2B76B190B78A311ADC860E813860ED" or wi.get("result_status")!="REWORK_IN_PROGRESS" or w.get("lease_epoch")!=2 or wr.get("write_epoch")!=2 or wr.get("worker_lease_id")!=w.get("lease_id") or failure.get("test_report_sha256")!="90765FDA6C240AE04A7548B265BC4E2506E9E1878F93DE353ECFEE1AD736A986" or failure.get("blocking_defect_count")!=2 or pred.get("developer_manifest_sha256")!="BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE" or pred.get("completion_manifest_sha256")!="56376C0DB64E840E1CB8145918F74291B413FFEFA681AD29DDE141D91681A854" or manifest.get("self_reference") is not False): errors.append("A13_REWORK_START_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a13_r2_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-13_EVIDENCE_MANIFEST_R2.json","docs/evidence/manifests/A-13_REWORK_START_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a13-r2-completion-test-review.json","docs/test_reports/A-13_TEST_REPORT.md","docs/work_orders/A-13_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A13_R2_COMPLETION_RAW_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A13_R2_COMPLETION_RAW_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A13_R2_COMPLETION_RAW_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A13_R2_COMPLETION_RAW_INVALID")
    if seen!=expected: errors.append("A13_R2_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total)): errors.append("A13_R2_COMPLETION_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A13_R2_COMPLETION_REPOSITORY_MISMATCH")
    wi=progress.get("active_work_instruction") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=147 or progress.get("status")!="TEST_REVIEW" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or wi.get("artifact_id")!="WI-A-13-20260812-002" or wi.get("result_status")!="COMPLETED" or wi.get("independent_tester_status")!="R2_PENDING" or wi.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST" or developer.get("manifest_sha256")!="4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771" or developer.get("target_hash")!="7629BE41F2174CEA6538B35C410A1E3DE7488A8BFD0BA166229F5C36DEB8A085" or developer.get("mutation")!="FORBIDDEN_FROZEN_PREDECESSOR" or manifest.get("self_reference") is not False): errors.append("A13_R2_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a13_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[];expected={"docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST_R2.json","docs/evidence/manifests/A-13_EVIDENCE_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-a13-r2-accepted.json","docs/test_reports/A-13_RETEST_REPORT_R2.md","docs/work_orders/A-13_REWORK_WORK_INSTRUCTION_R2.md"};rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["A13_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A13_ACCEPTANCE_RAW_INVALID");continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A13_ACCEPTANCE_RAW_INVALID");continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A13_ACCEPTANCE_RAW_INVALID")
    if seen!=expected: errors.append("A13_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("content_hash")!=target,manifest.get("delivered_hash")!=target)): errors.append("A13_ACCEPTANCE_TARGET_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths");mp=manifest.get("repository_projection") or {};rp=progress.get("repository") or {}
    if any(mp.get(f)!=rp.get(f) for f in fields): errors.append("A13_ACCEPTANCE_REPOSITORY_MISMATCH")
    tester=manifest.get("tester_evidence") or {};developer=manifest.get("developer_evidence") or {}
    if (progress.get("event_sequence")!=148 or progress.get("current_work_package")!="A-14" or progress.get("status")!="READY" or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or tester.get("sha256")!="277B7F55EED69C3FDA112C6D8033674B5FC9AD63D39CDD89C2133865CBF66B86" or tester.get("blocking_findings")!=0 or tester.get("closed_findings")!=["A13-TST-BLK-001","A13-TST-BLK-002"] or developer.get("manifest_sha256")!="4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771" or manifest.get("self_reference") is not False): errors.append("A13_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a14_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    errors: list[str] = []
    expected = {
        "docs/evidence/manifests/A-13_ACCEPTANCE_PROGRESS_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-a14-start.json",
        "docs/work_orders/A-14_INVOCATION_PROMPT.md",
    "docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R2.md",
    "docs/work_orders/A-14_REWORK_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/A-14_WORK_INSTRUCTION.md",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A14_START_RAW_INVALID"]
    seen: set[str] = set()
    canonical: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A14_START_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A14_START_RAW_INVALID")
            continue
        checksum = hashlib.sha256(raw).hexdigest().upper()
        total += len(raw)
        canonical.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{checksum}"))
        if row.get("bytes") != len(raw) or row.get("sha256") != checksum:
            errors.append("A14_START_RAW_INVALID")
    if seen != expected:
        errors.append("A14_START_RAW_SET_INVALID")
    canonical_bytes = "\n".join(value for _, value in sorted(canonical)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical_bytes), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("A14_START_TARGET_MISMATCH")
    projection = manifest.get("projection", {})
    instruction = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 151, progress.get("current_work_package") != "A-14", progress.get("status") != "ACTIVE", progress.get("active_agent") != "developer-primary-a14", instruction.get("artifact_id") != "WI-A-14-20260812-001", (progress.get("worker_lease") or {}).get("lease_epoch") != 1, (progress.get("write_lease") or {}).get("write_epoch") != 1, projection.get("product_artifact_count") != 0, manifest.get("actual_browser_status") != "NOT_EXECUTED", manifest.get("actual_dir_status") != "NOT_EXECUTED")):
        errors.append("A14_START_PROJECTION_MISMATCH")
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    manifest_repository = manifest.get("repository_projection") or {}
    progress_repository = progress.get("repository") or {}
    if any(manifest_repository.get(field) != progress_repository.get(field) for field in fields):
        errors.append("A14_START_REPOSITORY_MISMATCH")
    return sorted(set(errors))
def validate_a14_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/completion_reports/A-14_COMPLETION_REPORT.md","docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json","docs/evidence/manifests/A-14_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a14-completion-test-review.json","docs/work_orders/A-14_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["A14_COMPLETION_RAW_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str) or rel in seen: errors.append("A14_COMPLETION_RAW_INVALID"); continue
        seen.add(rel)
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A14_COMPLETION_RAW_INVALID"); continue
        actual=hashlib.sha256(raw).hexdigest().upper(); total+=len(raw); canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A14_COMPLETION_RAW_INVALID")
    if seen!=expected: errors.append("A14_COMPLETION_RAW_SET_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("self_reference") is not False)): errors.append("A14_COMPLETION_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {}; dev=manifest.get("developer_evidence") or {}
    if any((progress.get("event_sequence")!=154,progress.get("status")!="TEST_REVIEW",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("package_status")!="TEST_REVIEW",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",dev.get("manifest_sha256")!="B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8",dev.get("target_hash")!="985E6B205B38637B7EC74594B3C376DFF11C79EDEFF65A8930690F2B1206130B",manifest.get("actual_browser_status")!="NOT_EXECUTED",manifest.get("actual_network_status")!="NOT_EXECUTED")): errors.append("A14_COMPLETION_PROJECTION_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(f)!=(progress.get("repository") or {}).get(f) for f in fields): errors.append("A14_COMPLETION_REPOSITORY_MISMATCH")
    return sorted(set(errors))


def validate_a14_r2_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    rows=manifest.get("raw_checksums"); canonical=[]; total=0
    if not isinstance(rows,list): return ["A14_R2_COMPLETION_RAW_INVALID"]
    for row in rows:
        rel=row.get("path") if isinstance(row,dict) else None
        if not isinstance(rel,str): errors.append("A14_R2_COMPLETION_RAW_INVALID"); continue
        try: raw=(root/rel).read_bytes()
        except OSError: errors.append("A14_R2_COMPLETION_RAW_INVALID"); continue
        actual=hashlib.sha256(raw).hexdigest().upper();total+=len(raw);canonical.append((rel.encode(),f"{rel}\t{len(raw)}\t{actual}"))
        if row.get("bytes")!=len(raw) or row.get("sha256")!=actual: errors.append("A14_R2_COMPLETION_RAW_INVALID")
    can="\n".join(v for _,v in sorted(canonical)).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("self_reference") is not False)): errors.append("A14_R2_COMPLETION_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {}; dev=manifest.get("developer_revision2_evidence") or {}; pred=manifest.get("predecessor_evidence") or {}
    if any((progress.get("event_sequence")!=161,progress.get("status")!="TEST_REVIEW",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="R2_PENDING",dev.get("manifest_sha256")!="67AD9BD4AC3203900B97074B233DA751DC4FD75F7C772F955CA00BB2665EE58D",pred.get("manifest_sha256")!="B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8",manifest.get("actual_browser_status")!="ENVIRONMENT_BLOCKED")): errors.append("A14_R2_COMPLETION_PROJECTION_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(f)!=(progress.get("repository") or {}).get(f) for f in fields): errors.append("A14_R2_COMPLETION_REPOSITORY_MISMATCH")
    return sorted(set(errors))

def validate_a14_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]; progress = bundle["progress"]; errors: list[str] = []
    expected = {"docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST.json", "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json", "docs/progress/progress-handoff-detached-digest-a14-rework-start.json", "docs/test_reports/A-14_TEST_REPORT.md", "docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R2.md"}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list): return ["A14_REWORK_RAW_INVALID"]
    seen: set[str] = set(); canonical: list[tuple[bytes, str]] = []; total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A14_REWORK_RAW_INVALID"); continue
        seen.add(relative)
        try: raw = (root / relative).read_bytes()
        except OSError: errors.append("A14_REWORK_RAW_INVALID"); continue
        checksum = hashlib.sha256(raw).hexdigest().upper(); total += len(raw); canonical.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{checksum}"))
        if row.get("bytes") != len(raw) or row.get("sha256") != checksum: errors.append("A14_REWORK_RAW_INVALID")
    if seen != expected: errors.append("A14_REWORK_RAW_SET_INVALID")
    canonical_bytes = "\n".join(value for _, value in sorted(canonical)).encode("utf-8"); target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical_bytes), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)): errors.append("A14_REWORK_TARGET_MISMATCH")
    source = manifest.get("failure_source") or {}; lease = manifest.get("lease_projection") or {}; instruction = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 158, progress.get("current_work_package") != "A-14", progress.get("status") != "ACTIVE", progress.get("valid_failure_count") != 1, instruction.get("artifact_id") != "WI-A-14-20260812-002", instruction.get("result_status") != "REWORK_IN_PROGRESS", instruction.get("independent_tester_status") != "RETEST_REQUIRED", (progress.get("worker_lease") or {}).get("lease_epoch") != 2, (progress.get("write_lease") or {}).get("write_epoch") != 2, lease.get("execution_fencing_token") != (progress.get("worker_lease") or {}).get("execution_fencing_token"), lease.get("write_fencing_token") != (progress.get("write_lease") or {}).get("write_fencing_token"), source.get("test_report_sha256") != "6A53A135F7362563846252D223376692938317F3A0C4E3EF07B5C767A201C768", source.get("counted_finding_ids") != ["BLK-A14-002"], source.get("environment_blocked_finding_ids") != ["BLK-A14-001"], manifest.get("product_paths_frozen_count") != 17)): errors.append("A14_REWORK_PROJECTION_MISMATCH")
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths"); mr = manifest.get("repository_projection") or {}; pr = progress.get("repository") or {}
    if any(mr.get(field) != pr.get(field) for field in fields): errors.append("A14_REWORK_REPOSITORY_MISMATCH")
    return sorted(set(errors))

def validate_a14_r3_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]; progress = bundle["progress"]; errors: list[str] = []
    expected = {
        "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R2.json",
        "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json",
        "docs/progress/WSL_ENVIRONMENT_MIGRATION_HANDOFF_2026-08-12.md",
        "docs/progress/progress-handoff-detached-digest-a14-r3-rework-start.json",
        "docs/test_reports/A-14_RETEST_REPORT_R3.md",
        "docs/work_orders/A-14_REWORK_INVOCATION_PROMPT_R3.md",
        "docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R3.md",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list): return ["A14_R3_REWORK_RAW_INVALID"]
    seen: set[str] = set(); canonical: list[tuple[bytes, str]] = []; total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A14_R3_REWORK_RAW_INVALID"); continue
        seen.add(relative)
        try: raw = (root / relative).read_bytes()
        except OSError: errors.append("A14_R3_REWORK_RAW_INVALID"); continue
        checksum = hashlib.sha256(raw).hexdigest().upper(); total += len(raw)
        canonical.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{checksum}"))
        if row.get("bytes") != len(raw) or row.get("sha256") != checksum: errors.append("A14_R3_REWORK_RAW_INVALID")
    if seen != expected: errors.append("A14_R3_REWORK_RAW_SET_INVALID")
    canonical_bytes = "\n".join(value for _, value in sorted(canonical)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical_bytes), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("A14_R3_REWORK_TARGET_MISMATCH")
    source = manifest.get("failure_source") or {}; lease = manifest.get("lease_projection") or {}; instruction = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 165, progress.get("current_work_package") != "A-14", progress.get("status") != "ACTIVE", progress.get("valid_failure_count") != 2, instruction.get("artifact_id") != "WI-A-14-20260813-003", instruction.get("result_status") != "REWORK_IN_PROGRESS", instruction.get("independent_tester_status") != "RETEST_REQUIRED", (progress.get("worker_lease") or {}).get("lease_epoch") != 3, (progress.get("write_lease") or {}).get("write_epoch") != 3, lease.get("execution_fencing_token") != (progress.get("worker_lease") or {}).get("execution_fencing_token"), lease.get("write_fencing_token") != (progress.get("write_lease") or {}).get("write_fencing_token"), source.get("test_report_sha256") != "D40A0FA0A64CF7FDA8DFBEF5605A3434941464614FD0BB3D3838385B00A30C69", source.get("closed_finding_ids") != ["BLK-A14-001"], source.get("reopened_finding_ids") != ["BLK-A14-002"], manifest.get("product_paths_frozen_count") != 17, manifest.get("main_exact_path_count") != 20)):
        errors.append("A14_R3_REWORK_PROJECTION_MISMATCH")
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(field) != (progress.get("repository") or {}).get(field) for field in fields): errors.append("A14_R3_REWORK_REPOSITORY_MISMATCH")
    return sorted(set(errors))


def validate_a14_r3_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    errors: list[str] = []
    expected = {
        "docs/completion_reports/A-14_COMPLETION_REPORT.md",
        "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R3.json",
        "docs/evidence/manifests/A-14_REWORK_START_MANIFEST_R3.json",
        "docs/progress/progress-handoff-detached-digest-a14-r3-completion-test-review.json",
        "docs/test_reports/A-14_RETEST_REPORT_R3.md",
        "docs/validation/A-14_WORKBENCH_PROTOTYPE_VALIDATION.md",
        "docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R3.md",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A14_R3_COMPLETION_RAW_INVALID"]
    seen: set[str] = set()
    canonical: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A14_R3_COMPLETION_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A14_R3_COMPLETION_RAW_INVALID")
            continue
        checksum = hashlib.sha256(raw).hexdigest().upper()
        total += len(raw)
        canonical.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{checksum}"))
        if row.get("bytes") != len(raw) or row.get("sha256") != checksum:
            errors.append("A14_R3_COMPLETION_RAW_INVALID")
    if seen != expected:
        errors.append("A14_R3_COMPLETION_RAW_SET_INVALID")
    canonical_bytes = "\n".join(value for _, value in sorted(canonical)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical_bytes),
        manifest.get("target_content_bytes") != total,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
        manifest.get("self_reference") is not False,
    )):
        errors.append("A14_R3_COMPLETION_TARGET_MISMATCH")
    instruction = progress.get("active_work_instruction") or {}
    developer = manifest.get("developer_evidence") or {}
    if any((
        progress.get("event_sequence") != 168,
        progress.get("current_work_package") != "A-14",
        progress.get("status") != "TEST_REVIEW",
        progress.get("active_agent") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        instruction.get("artifact_id") != "WI-A-14-20260813-003",
        instruction.get("package_status") != "TEST_REVIEW",
        instruction.get("result_status") != "COMPLETED",
        instruction.get("independent_tester_status") != "R4_PENDING",
        developer.get("manifest_sha256") != "830A16580403C0A29AFC23DDD29F921AFF0BDF116538E5675F2011185213AE25",
        developer.get("target_hash") != "D9E78B29398209551E4AAE2A5AFE81FBAF6105BBDDD1517B9EC79DA5B5E01E64",
        manifest.get("actual_browser_status") != "NOT_EXECUTED",
        manifest.get("next_package_status") != "BLOCKED_PENDING_A14_ACCEPTANCE",
    )):
        errors.append("A14_R3_COMPLETION_PROJECTION_MISMATCH")
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(field) != (progress.get("repository") or {}).get(field) for field in fields):
        errors.append("A14_R3_COMPLETION_REPOSITORY_MISMATCH")
    return sorted(set(errors))


def validate_a14_main_takeover_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    errors: list[str] = []
    expected = {
        "docs/evidence/manifests/A-14_MAIN_TAKEOVER_EVIDENCE_R4.json",
        "docs/progress/progress-handoff-detached-digest-a14-main-takeover-completion-r4.json",
        "docs/test_reports/A-14_RETEST_REPORT_R4.md",
        "docs/work_orders/A-14_MAIN_TAKEOVER_PACKET_R4.md",
        "scripts/check_a13_repository_scan.py",
        "scripts/check_a14_workbench_prototype.py",
        "tests/tooling/test_a13_repository_scan.py",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A14_MAIN_TAKEOVER_COMPLETION_RAW_INVALID"]
    seen: set[str] = set()
    canonical: list[tuple[bytes, str]] = []
    total = 0
    successor_rows = _a14_successor_live_rows(root)
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A14_MAIN_TAKEOVER_COMPLETION_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A14_MAIN_TAKEOVER_COMPLETION_RAW_INVALID")
            continue
        checksum = hashlib.sha256(raw).hexdigest().upper()
        successor = successor_rows.get(relative)
        successor_matches = successor and portable_row_matches(
            root, relative, successor.get("bytes"), successor.get("sha256")
        )
        row_matches = portable_row_matches(root, relative, row.get("bytes"), row.get("sha256")) or successor_matches
        material_bytes = row.get("bytes") if row_matches else len(raw)
        material_hash = row.get("sha256") if row_matches else checksum
        total += material_bytes
        canonical.append((relative.encode("utf-8"), f"{relative}\t{material_bytes}\t{material_hash}"))
        if not row_matches:
            errors.append("A14_MAIN_TAKEOVER_COMPLETION_RAW_INVALID")
    if seen != expected:
        errors.append("A14_MAIN_TAKEOVER_COMPLETION_RAW_SET_INVALID")
    canonical_bytes = "\n".join(value for _, value in sorted(canonical)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical_bytes),
        manifest.get("target_content_bytes") != total,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
        manifest.get("self_reference") is not False,
        manifest.get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED",
    )):
        errors.append("A14_MAIN_TAKEOVER_COMPLETION_TARGET_MISMATCH")
    instruction = progress.get("active_work_instruction") or {}
    if any((
        progress.get("event_sequence") != 171,
        progress.get("current_work_package") != "A-14",
        progress.get("status") != "TEST_REVIEW",
        progress.get("valid_failure_count") != 3,
        progress.get("active_failure_lineage", {}).get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED",
        progress.get("active_agent") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        instruction.get("result_status") != "COMPLETED",
        instruction.get("independent_tester_status") != "R5_PENDING",
        manifest.get("next_package_status") != "BLOCKED_PENDING_A14_ACCEPTANCE",
        manifest.get("actual_browser_status") != "R4_EXECUTED_UI_FINDINGS_CLOSED",
        manifest.get("actual_provider_status") != "NOT_EXECUTED",
        manifest.get("actual_production_status") != "NOT_EXECUTED",
    )):
        errors.append("A14_MAIN_TAKEOVER_COMPLETION_PROJECTION_MISMATCH")
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(field) != (progress.get("repository") or {}).get(field) for field in fields):
        errors.append("A14_MAIN_TAKEOVER_COMPLETION_REPOSITORY_MISMATCH")
    return sorted(set(errors))


def validate_a14_portability_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or not rows:
        return ["A14_PORTABILITY_COMPLETION_RAW_INVALID"]
    errors: list[str] = []
    seen: set[str] = set()
    canonical: list[str] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A14_PORTABILITY_COMPLETION_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            matches = portable_row_matches(root, relative, row.get("bytes"), row.get("sha256"))
        except (OSError, TypeError):
            matches = False
        if not matches:
            errors.append("A14_PORTABILITY_COMPLETION_RAW_INVALID")
            continue
        total += int(row["bytes"])
        canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    canonical_bytes = "\n".join(sorted(canonical, key=lambda value: value.encode("utf-8"))).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical_bytes),
        manifest.get("target_content_bytes") != total,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("self_reference") is not False,
        manifest.get("source_report_sha256") != "3E0C98FDB01772F8446FAE7763C6D4EC786655AA32DD22BF73A37F338743667B",
    )):
        errors.append("A14_PORTABILITY_COMPLETION_TARGET_MISMATCH")
    instruction = progress.get("active_work_instruction") or {}
    if any((
        progress.get("event_sequence") != 174,
        progress.get("current_work_package") != "A-14",
        progress.get("status") != "TEST_REVIEW",
        progress.get("valid_failure_count") != 4,
        progress.get("active_failure_lineage", {}).get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED",
        progress.get("active_agent") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        instruction.get("independent_tester_status") != "R6_PENDING",
        manifest.get("actual_browser_status") != "R5_EXECUTED_UI_FINDINGS_CLOSED",
        manifest.get("next_package_status") != "BLOCKED_PENDING_A14_ACCEPTANCE",
    )):
        errors.append("A14_PORTABILITY_COMPLETION_PROJECTION_MISMATCH")
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(field) != (progress.get("repository") or {}).get(field) for field in fields):
        errors.append("A14_PORTABILITY_COMPLETION_REPOSITORY_MISMATCH")
    return sorted(set(errors))


def validate_a14_acceptance_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected = {
        "docs/evidence/manifests/A-14_PORTABILITY_COMPLETION_MANIFEST_R5.json",
        "docs/progress/progress-handoff-detached-digest-a14-accepted-r6.json",
        "docs/test_reports/A-14_RETEST_REPORT_R5.md",
        "docs/test_reports/A-14_RETEST_REPORT_R6.md",
        "scripts/check_a13_repository_scan.py",
        "scripts/check_a14_workbench_prototype.py",
        "scripts/check_g07_baseline.py",
        "scripts/check_phase_g_gate.py",
        "scripts/check_project_progress.py",
        "tests/tooling/test_a13_repository_scan.py",
        "tests/tooling/test_a14_workbench_prototype.py",
        "tests/tooling/test_g07_baseline.py",
        "tests/tooling/test_phase_g_gate.py",
        "tests/tooling/test_project_progress.py",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A14_ACCEPTANCE_RAW_INVALID"]
    errors: list[str] = []
    seen: set[str] = set()
    canonical: list[str] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A14_ACCEPTANCE_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            matches = portable_row_matches(root, relative, row.get("bytes"), row.get("sha256"))
        except (OSError, TypeError):
            matches = False
        if not matches:
            errors.append("A14_ACCEPTANCE_RAW_INVALID")
            continue
        total += int(row["bytes"])
        canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen != expected:
        errors.append("A14_ACCEPTANCE_RAW_SET_INVALID")
    canonical_bytes = "\n".join(sorted(canonical, key=lambda value: value.encode("utf-8"))).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical_bytes),
        manifest.get("target_content_bytes") != total,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
        manifest.get("self_reference") is not False,
    )):
        errors.append("A14_ACCEPTANCE_TARGET_MISMATCH")
    tester = manifest.get("tester_evidence") or {}
    projection = manifest.get("projection") or {}
    if any((
        progress.get("event_sequence") != 175,
        progress.get("current_work_package") != "A-15",
        progress.get("status") != "READY",
        progress.get("valid_failure_count") != 0,
        (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "A-15",
        (progress.get("active_failure_lineage") or {}).get("valid_failure_count") != 0,
        progress.get("active_agent") is not None,
        progress.get("active_work_instruction") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        projection.get("event_sequence") != 175,
        projection.get("accepted") is not True,
        tester.get("sha256") != "04EF9AE33F5823829A30E0E9C41EA35F594A00DB09610BD890E23414DB500792",
        tester.get("verdict") != "READY_FOR_MAIN_ACCEPTANCE",
        tester.get("blocking_findings") != 0,
        manifest.get("actual_browser_status") != "R5_EXECUTED_UI_FINDINGS_CLOSED",
        manifest.get("r6_iab_status") != "ENVIRONMENT_BLOCKED / NOT_EXECUTED",
        manifest.get("actual_provider_status") != "NOT_EXECUTED",
        manifest.get("actual_production_status") != "NOT_EXECUTED",
        manifest.get("next_package_status") != "READY",
    )):
        errors.append("A14_ACCEPTANCE_PROJECTION_MISMATCH")
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(field) != (progress.get("repository") or {}).get(field) for field in fields):
        errors.append("A14_ACCEPTANCE_REPOSITORY_MISMATCH")
    for name, predecessor, required in (
        ("a13_successor_projection", "4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771", {"scripts/check_a13_repository_scan.py", "tests/tooling/test_a13_repository_scan.py"}),
        ("a14_successor_projection", "B04648D6390D1AB069416BC07F09B3F8EFCF505ADD56706CFF1E4EE04A3D99C8", {"scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"}),
    ):
        successor = manifest.get(name) or {}
        indexed = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
        if successor.get("predecessor_manifest_sha256") != predecessor or set(indexed) != required:
            errors.append("A14_ACCEPTANCE_SUCCESSOR_INVALID")
            continue
        if any(not portable_row_matches(root, path, row.get("bytes"), row.get("sha256")) for path, row in indexed.items()):
            errors.append("A14_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_a15_start_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected = {
        "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json",
        "docs/progress/progress-handoff-detached-digest-a15-start.json",
        "docs/work_orders/A-15_INVOCATION_PROMPT.md",
        "docs/work_orders/A-15_WORK_INSTRUCTION.md",
        "scripts/check_a13_repository_scan.py",
        "scripts/check_a14_workbench_prototype.py",
        "tests/tooling/test_a13_repository_scan.py",
        "tests/tooling/test_a14_workbench_prototype.py",
    }
    developer_paths = {
        "docs/architecture/a15/A-15_ARTIFACT_STATE_API_UI_TRACE.md",
        "docs/architecture/a15/A-15_ARTIFACT_SCHEMA.json",
        "docs/architecture/a15/A-15_API_DRAFT.json",
        "docs/architecture/a15/A-15_FIELD_TRACE_MATRIX.json",
        "docs/architecture/a15/A-15_USER_UX_APPROVAL_REQUEST.md",
        "tests/fixtures/a15/canonical-trace-contract.json",
        "tests/fixtures/a15/trace-mutations.json",
        "scripts/check_a15_artifact_state_api_ui_trace.py",
        "tests/tooling/test_a15_artifact_state_api_ui_trace.py",
        "docs/validation/A-15_ARTIFACT_STATE_API_UI_TRACE_VALIDATION.md",
        "docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json",
        "docs/completion_reports/A-15_COMPLETION_REPORT.md",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A15_START_RAW_INVALID"]
    errors: list[str] = []
    seen: set[str] = set()
    canonical: list[str] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A15_START_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            matches = portable_row_matches(root, relative, row.get("bytes"), row.get("sha256"))
        except (OSError, TypeError):
            matches = False
        if not matches:
            errors.append("A15_START_RAW_INVALID")
            continue
        total += int(row["bytes"])
        canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen != expected:
        errors.append("A15_START_RAW_SET_INVALID")
    canonical_bytes = "\n".join(sorted(canonical, key=lambda value: value.encode("utf-8"))).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical_bytes),
        manifest.get("target_content_bytes") != total,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
        manifest.get("self_reference") is not False,
    )):
        errors.append("A15_START_TARGET_MISMATCH")
    projection = manifest.get("projection") or {}
    instruction = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    start_events = [
        event for event in bundle["events"]["events"]
        if 176 <= event.get("sequence", -1) <= 178
    ]
    if any((
        progress.get("event_sequence") != 178,
        progress.get("current_work_package") != "A-15",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-a15",
        instruction.get("artifact_id") != "WI-A-15-20260813-001",
        instruction.get("user_ux_approval_status") != "PENDING_USER_DECISION",
        worker.get("lease_epoch") != 1,
        write.get("write_epoch") != 1,
        write.get("worker_lease_id") != worker.get("lease_id"),
        set(write.get("paths", [])) != developer_paths,
        [event.get("event_type") for event in start_events]
        != ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
        projection.get("event_sequence") != 178,
        projection.get("product_artifact_count") != 0,
        projection.get("trace_artifact_count") != 0,
        manifest.get("user_ux_approval_status") != "PENDING_USER_DECISION",
        manifest.get("inherited_a14_browser_status") != "R5_EXECUTED_UI_FINDINGS_CLOSED",
        manifest.get("r6_iab_status") != "ENVIRONMENT_BLOCKED / NOT_EXECUTED",
        manifest.get("actual_provider_status") != "NOT_EXECUTED",
        manifest.get("actual_production_status") != "NOT_EXECUTED",
        manifest.get("actual_dir_status") != "NOT_REACHED",
        (progress.get("dir_review") or {}).get("status") != "NOT_REACHED",
    )):
        errors.append("A15_START_PROJECTION_MISMATCH")
    fields = (
        "projection_mode", "validated_base_commit", "head_relation", "branch",
        "upstream", "remote_head", "push_status", "exact_allowed_paths",
    )
    if any(
        (manifest.get("repository_projection") or {}).get(field)
        != (progress.get("repository") or {}).get(field)
        for field in fields
    ):
        errors.append("A15_START_REPOSITORY_MISMATCH")
    for name, predecessor, required in (
        ("a13_successor_projection", "4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771", {"scripts/check_a13_repository_scan.py", "tests/tooling/test_a13_repository_scan.py"}),
        ("a14_successor_projection", "910900E99464B00E362F1895BA55389550EF740DBE6177FB0A4E75D272A62C09", {"scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"}),
    ):
        successor = manifest.get(name) or {}
        indexed = {
            row.get("path"): row
            for row in successor.get("live_raw_checksums", [])
            if isinstance(row, dict)
        }
        if (
            successor.get("predecessor_manifest_sha256") != predecessor
            or set(indexed) != required
            or any(
                not portable_row_matches(root, path, row.get("bytes"), row.get("sha256"))
                for path, row in indexed.items()
            )
        ):
            errors.append("A15_START_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_a15_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_raw = {
        "docs/completion_reports/A-15_COMPLETION_REPORT.md",
        "docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/A-15_START_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a15-completion-test-review.json",
        "docs/work_orders/A-15_WORK_INSTRUCTION.md",
    }
    expected_paths = {
        "docs/architecture/a15/A-15_API_DRAFT.json",
        "docs/architecture/a15/A-15_ARTIFACT_SCHEMA.json",
        "docs/architecture/a15/A-15_ARTIFACT_STATE_API_UI_TRACE.md",
        "docs/architecture/a15/A-15_FIELD_TRACE_MATRIX.json",
        "docs/architecture/a15/A-15_USER_UX_APPROVAL_REQUEST.md",
        "docs/completion_reports/A-15_COMPLETION_REPORT.md",
        "docs/evidence/manifests/A-15_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-a15-completion-test-review.json",
        "docs/validation/A-15_ARTIFACT_STATE_API_UI_TRACE_VALIDATION.md",
        "scripts/check_a13_repository_scan.py",
        "scripts/check_a14_workbench_prototype.py",
        "scripts/check_a15_artifact_state_api_ui_trace.py",
        "scripts/check_g07_baseline.py",
        "scripts/check_phase_g_gate.py",
        "scripts/check_project_progress.py",
        "tests/fixtures/a15/canonical-trace-contract.json",
        "tests/fixtures/a15/trace-mutations.json",
        "tests/tooling/test_a13_repository_scan.py",
        "tests/tooling/test_a15_artifact_state_api_ui_trace.py",
        "tests/tooling/test_g07_baseline.py",
        "tests/tooling/test_phase_g_gate.py",
        "tests/tooling/test_project_progress.py",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A15_COMPLETION_RAW_INVALID"]
    seen: set[str] = set()
    canonical: list[str] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A15_COMPLETION_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            matches = portable_row_matches(root, relative, row.get("bytes"), row.get("sha256"))
        except (OSError, TypeError):
            matches = False
        if not matches:
            errors.append("A15_COMPLETION_RAW_INVALID")
            continue
        total += int(row["bytes"])
        canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen != expected_raw:
        errors.append("A15_COMPLETION_RAW_SET_INVALID")
    canonical_bytes = "\n".join(sorted(canonical, key=lambda value: value.encode("utf-8"))).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical_bytes),
        manifest.get("target_content_bytes") != total,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
        manifest.get("self_reference") is not False,
    )):
        errors.append("A15_COMPLETION_TARGET_MISMATCH")
    projection = manifest.get("projection") or {}
    instruction = progress.get("active_work_instruction") or {}
    completion_events = [
        event for event in bundle["events"]["events"]
        if 179 <= event.get("sequence", -1) <= 181
    ]
    developer = manifest.get("developer_evidence") or {}
    if any((
        progress.get("event_sequence") != 181,
        progress.get("current_work_package") != "A-15",
        progress.get("status") != "TEST_REVIEW",
        progress.get("active_agent") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        instruction.get("artifact_id") != "WI-A-15-20260813-001",
        instruction.get("package_status") != "TEST_REVIEW",
        instruction.get("result_status") != "COMPLETED",
        instruction.get("accepted") is not False,
        instruction.get("independent_tester_status") != "PENDING",
        instruction.get("user_ux_approval_status") != "PENDING_USER_DECISION",
        [event.get("event_type") for event in completion_events]
        != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
        projection.get("event_sequence") != 181,
        projection.get("accepted") is not False,
        projection.get("independent_tester_status") != "PENDING",
        developer.get("manifest_sha256") != "2AEEACFCF8DB666EA89B85EE7C07A071F7B56DF52B3373F222801065A7918B60",
        developer.get("target_hash") != "34FCA32938AB9DE68EFFE1C9F0E3FB57E994C5D74E172717D027F871DB3309AE",
        developer.get("changed_path_count") != 12,
        developer.get("mutation") != "FORBIDDEN_FROZEN_PREDECESSOR",
        manifest.get("user_ux_approval_status") != "PENDING_USER_DECISION",
        manifest.get("actual_dir_status") != "NOT_REACHED",
        (progress.get("dir_review") or {}).get("status") != "NOT_REACHED",
        manifest.get("next_package_status") != "BLOCKED_PENDING_A15_ACCEPTANCE_AND_DIR1",
    )):
        errors.append("A15_COMPLETION_PROJECTION_MISMATCH")
    runtime = manifest.get("runtime_boundary") or {}
    if any(runtime.get(key) != "NOT_EXECUTED" for key in (
        "actual_api", "actual_db", "actual_browser", "actual_network", "actual_provider",
        "actual_secret", "actual_egress", "actual_wsl", "actual_production", "actual_deployment",
    )):
        errors.append("A15_COMPLETION_RUNTIME_BOUNDARY_MISMATCH")
    repository = progress.get("repository") or {}
    repo_manifest = manifest.get("repository_projection") or {}
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(repo_manifest.get(field) != repository.get(field) for field in fields) or set(repository.get("exact_allowed_paths", [])) != expected_paths:
        errors.append("A15_COMPLETION_REPOSITORY_MISMATCH")
    for name, predecessor, required in (
        ("a13_successor_projection", "4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771", {"scripts/check_a13_repository_scan.py", "tests/tooling/test_a13_repository_scan.py"}),
        ("a14_successor_projection", "910900E99464B00E362F1895BA55389550EF740DBE6177FB0A4E75D272A62C09", {"scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a14_workbench_prototype.py"}),
    ):
        successor = manifest.get(name) or {}
        indexed = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
        if successor.get("predecessor_manifest_sha256") != predecessor or set(indexed) != required:
            errors.append("A15_COMPLETION_SUCCESSOR_INVALID")
            continue
        try:
            successor_rows_valid = all(
                portable_row_matches(root, path, row.get("bytes"), row.get("sha256"))
                for path, row in indexed.items()
            )
        except (OSError, TypeError):
            successor_rows_valid = False
        if not successor_rows_valid:
            errors.append("A15_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_a15_acceptance_dir1_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_raw = {
        "docs/approvals/APPROVAL-20260813-A15-UX-001.md",
        "docs/evidence/manifests/A-15_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a15-accepted-dir1.json",
        "docs/test_reports/A-15_INDEPENDENT_TEST_REPORT.md",
        "docs/test_reports/DIR-1_REPORT.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A15_ACCEPTANCE_DIR1_RAW_INVALID"]
    seen: set[str] = set()
    canonical: list[str] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("A15_ACCEPTANCE_DIR1_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            matches = portable_row_matches(root, relative, row.get("bytes"), row.get("sha256"))
        except (OSError, TypeError):
            matches = False
        if not matches:
            errors.append("A15_ACCEPTANCE_DIR1_RAW_INVALID")
            continue
        total += int(row["bytes"])
        canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen != expected_raw:
        errors.append("A15_ACCEPTANCE_DIR1_RAW_SET_INVALID")
    canonical_bytes = "\n".join(sorted(canonical, key=lambda value: value.encode("utf-8"))).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if any((
        manifest.get("target_canonical_bytes") != len(canonical_bytes),
        manifest.get("target_content_bytes") != total,
        manifest.get("target_hash") != target,
        manifest.get("delivered_hash") != target,
        manifest.get("content_hash") != target,
        manifest.get("self_reference") is not False,
    )):
        errors.append("A15_ACCEPTANCE_DIR1_TARGET_MISMATCH")
    events = bundle["events"]["events"]
    terminal = [event for event in events if 182 <= event.get("sequence", -1) <= 184]
    acceptance = terminal[0] if len(terminal) == 3 else {}
    checkpoint = next(
        (row for row in bundle["dir_registry"].get("checkpoints", []) if row.get("checkpoint") == "DIR-1"),
        {},
    )
    approval = manifest.get("human_approval") or {}
    tester = manifest.get("tester_evidence") or {}
    if any((
        manifest.get("package_id") != "A-15",
        progress.get("event_sequence") != 184,
        progress.get("current_work_package") != "A-15",
        progress.get("status") != "DIR_HOLD",
        "A-15" not in progress.get("completed_packages", []),
        progress.get("active_work_instruction") is not None,
        progress.get("active_agent") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        [event.get("event_type") for event in terminal]
        != ["MAIN_PACKAGE_ACCEPTED", "DIR_REACHED", "DIR_REPORTED"],
        acceptance.get("subject_ref") != "A-15",
        acceptance.get("details", {}).get("decision") != "ACCEPTED",
        acceptance.get("details", {}).get("user_ux_decision") != "APPROVED",
        approval.get("sha256") != "B33A5407D955B0CCB335CADB80E1EEA4C34227DB65FB6DADE2E03512AE86F144",
        approval.get("subject_hash") != "25BA91B86F06B6343F8E6388B6B18AAA5DB40BDE3BEA427ED89C2DD4763DBAEC",
        tester.get("sha256") != "F12CFEE0D7AE7A766C740CB89177F3DF13B345B8BF0DA372CDF99ACEA97B65EA",
        tester.get("verdict") != "READY_FOR_MAIN_ACCEPTANCE",
        tester.get("blocking_findings") != 0,
        checkpoint.get("status") != "WAITING_OWNER_DIRECTION",
        checkpoint.get("verdict") != "ALIGNED",
        (progress.get("dir_review") or {}).get("status") != "WAITING_OWNER_DIRECTION",
        (progress.get("phase_gate") or {}).get("decision") != "NOT_STARTED",
        (progress.get("phase_gate") or {}).get("checkpoint_status") != "BLOCKED_PENDING_DIR1_OWNER_DIRECTION",
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_DIR1_OWNER_DIRECTION",
        (progress.get("reporting_decision") or {}).get("decision") != "STOP_AND_REPORT_DIR",
        manifest.get("actual_dir_status") != "WAITING_OWNER_DIRECTION",
        manifest.get("actual_a_gate_status") != "NOT_STARTED / BLOCKED_PENDING_DIR1_OWNER_DIRECTION",
    )):
        errors.append("A15_ACCEPTANCE_DIR1_PROJECTION_MISMATCH")
    runtime = manifest.get("runtime_boundary") or {}
    if any(runtime.get(key) != "NOT_EXECUTED" for key in (
        "actual_api", "actual_db", "actual_browser", "actual_network", "actual_provider",
        "actual_secret", "actual_egress", "actual_wsl", "actual_production", "actual_deployment",
    )):
        errors.append("A15_ACCEPTANCE_DIR1_RUNTIME_BOUNDARY_MISMATCH")
    repository = progress.get("repository") or {}
    projection = manifest.get("repository_projection") or {}
    fields = ("projection_mode", "validated_base_commit", "head_relation", "branch", "upstream", "remote_head", "push_status", "exact_allowed_paths")
    if any(projection.get(field) != repository.get(field) for field in fields):
        errors.append("A15_ACCEPTANCE_DIR1_REPOSITORY_MISMATCH")
    successor = manifest.get("a13_successor_projection") or {}
    indexed = {row.get("path"): row for row in successor.get("live_raw_checksums", []) if isinstance(row, dict)}
    expected_successor = {"scripts/check_a13_repository_scan.py", "tests/tooling/test_a13_repository_scan.py"}
    try:
        live_valid = all(portable_row_matches(root, path, row.get("bytes"), row.get("sha256")) for path, row in indexed.items())
    except (OSError, TypeError):
        live_valid = False
    if successor.get("predecessor_manifest_sha256") != "4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771" or set(indexed) != expected_successor or not live_valid:
        errors.append("A15_ACCEPTANCE_DIR1_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_a_gate_decision_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/approvals/APPROVAL-20260813-DIR1-CONTINUE-001.md","docs/evidence/manifests/A-15_ACCEPTANCE_DIR1_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-a-gate-decision.json","docs/test_reports/A-GATE_TEST_REPORT.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["A_GATE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("A_GATE_RAW_INVALID"); continue
        seen.add(relative)
        try: matches=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): matches=False
        if not matches: errors.append("A_GATE_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("A_GATE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("A_GATE_TARGET_MISMATCH")
    terminal=[event for event in bundle["events"]["events"] if 185<=event.get("sequence",-1)<=186]
    checkpoint=next((row for row in bundle["dir_registry"].get("checkpoints",[]) if row.get("checkpoint")=="DIR-1"),{})
    if any((progress.get("event_sequence")!=186,progress.get("current_work_package")!="B-01",progress.get("status")!="READY",progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,[e.get("event_type") for e in terminal]!=["DIR_OWNER_DIRECTION_RECORDED","PHASE_GATE_DECIDED"],(terminal[0].get("actor") if terminal else None)!="신산님",(terminal[0].get("details",{}).get("direction") if terminal else None)!="CONTINUE",checkpoint.get("status")!="CLEARED",(progress.get("phase_gate") or {}).get("decision")!="ACCEPTED",(progress.get("phase_gate") or {}).get("b01_started") is not False,(progress.get("next_work_package") or {}).get("status")!="READY_NOT_STARTED",manifest.get("gate_verdict")!="PASS",manifest.get("blocking_findings")!=0)): errors.append("A_GATE_PROJECTION_MISMATCH")
    runtime=manifest.get("runtime_boundary") or {}
    if any(runtime.get(k)!="NOT_EXECUTED" for k in ("actual_api","actual_db","actual_provider","actual_secret","actual_egress","actual_wsl","actual_production","actual_deployment")): errors.append("A_GATE_RUNTIME_BOUNDARY_MISMATCH")
    repo=progress.get("repository") or {}; projection=manifest.get("repository_projection") or {}; fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths")
    if any(repo.get(f)!=projection.get(f) for f in fields): errors.append("A_GATE_REPOSITORY_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {}; indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}; expected_live={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    try: live_ok=all(portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())
    except (OSError,TypeError): live_ok=False
    if set(indexed)!=expected_live or not live_ok: errors.append("A_GATE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b01_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/A-GATE_DECISION_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b01-start.json","docs/work_orders/B-01_INVOCATION_PROMPT.md","docs/work_orders/B-01_WORK_INSTRUCTION.md","scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    developer_paths={"packages/domain/__init__.py","packages/domain/identifiers.py","packages/domain/states.py","packages/domain/events.py","packages/domain/reducer.py","tests/domain/test_identifiers.py","tests/domain/test_state_transitions.py","tests/domain/test_reducer.py","docs/validation/B-01_DOMAIN_CORE_VALIDATION.md","docs/evidence/manifests/B-01_EVIDENCE_MANIFEST.json","docs/completion_reports/B-01_COMPLETION_REPORT.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B01_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B01_START_RAW_INVALID"); continue
        seen.add(relative)
        try: matches=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): matches=False
        if not matches: errors.append("B01_START_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B01_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B01_START_TARGET_MISMATCH")
    instruction=progress.get("active_work_instruction") or {}; worker=progress.get("worker_lease") or {}; write=progress.get("write_lease") or {}; terminal=[e for e in bundle["events"]["events"] if 187<=e.get("sequence",-1)<=189]
    if any((progress.get("event_sequence")!=189,progress.get("current_work_package")!="B-01",progress.get("status")!="ACTIVE",progress.get("active_agent")!="developer-primary-b01",instruction.get("artifact_id")!="WI-B-01-20260813-001",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=developer_paths,[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],(progress.get("phase_gate") or {}).get("decision")!="ACCEPTED",(progress.get("dir_review") or {}).get("status")!="CLEARED",manifest.get("product_artifact_count")!=0)): errors.append("B01_START_PROJECTION_MISMATCH")
    fields=("projection_mode","validated_base_commit","head_relation","branch","upstream","remote_head","push_status","exact_allowed_paths")
    if any((manifest.get("repository_projection") or {}).get(f)!=(progress.get("repository") or {}).get(f) for f in fields): errors.append("B01_START_REPOSITORY_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {}; indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}; required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if successor.get("predecessor_manifest_sha256")!="4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771" or set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B01_START_SUCCESSOR_INVALID")
    runtime=manifest.get("runtime_boundary") or {}
    if any(runtime.get(k)!="NOT_EXECUTED" for k in ("actual_api","actual_db","actual_provider","actual_wsl","actual_production","actual_deployment")): errors.append("B01_START_RUNTIME_BOUNDARY_MISMATCH")
    return sorted(set(errors))


def validate_b01_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-01_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-01_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b01-completion-test-review.json","docs/work_orders/B-01_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B01_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B01_COMPLETION_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B01_COMPLETION_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B01_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda v:v.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B01_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 190<=e.get("sequence",-1)<=192]; wi=progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence")!=192,progress.get("current_work_package")!="B-01",progress.get("status")!="TEST_REVIEW",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B01_ACCEPTANCE",manifest.get("developer_manifest_sha256")!="BC89F69EF898B815DC0084D7373C0F8F833A8E371AEA4386A890F9FECD57DBED",manifest.get("developer_target_hash")!="DF891CEDE6A2DA1124A5BF3F9EB72D4A323E4E98476E2129A8803C3134400567")): errors.append("B01_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_b01_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-01_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/failure-ledger.json","docs/progress/progress-handoff-detached-digest-b01-rework-start-r2.json","docs/test_reports/B-01_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-01_REWORK_INVOCATION_PROMPT_R2.md","docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B01_R2_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B01_R2_START_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B01_R2_START_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B01_R2_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda v:v.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B01_R2_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 193<=e.get("sequence",-1)<=196]; worker=progress.get("worker_lease") or {}; write=progress.get("write_lease") or {}; wi=progress.get("active_work_instruction") or {}
    developer_paths={"packages/domain/reducer.py","tests/domain/test_reducer.py","docs/validation/B-01_DOMAIN_CORE_VALIDATION_R2.md","docs/evidence/manifests/B-01_EVIDENCE_MANIFEST_R2.json","docs/completion_reports/B-01_COMPLETION_REPORT_R2.md"}
    if any((progress.get("event_sequence")!=196,progress.get("status")!="ACTIVE",progress.get("active_agent")!="developer-primary-b01",progress.get("valid_failure_count")!=1,wi.get("artifact_id")!="WI-B-01-20260813-002",wi.get("result_status")!="REWORK_IN_PROGRESS",worker.get("lease_epoch")!=2,write.get("write_epoch")!=2,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=developer_paths,[e.get("event_type") for e in terminal]!=["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B01_ACCEPTANCE")): errors.append("B01_R2_START_PROJECTION_MISMATCH")
    if manifest.get("tester_report_sha256")!="3215F8C1BF8BDFCED692C7AE86B7ABE0D26A8712C41B9E31B7C8481474BEEED8" or manifest.get("failure_fingerprint")!="BLK-B01-001-RELEASE-GUARD-TYPE-AND-WHITESPACE-BYPASS": errors.append("B01_R2_START_FAILURE_BINDING_MISMATCH")
    return sorted(set(errors))


def validate_b01_rework_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R2.json","docs/evidence/manifests/B-01_EVIDENCE_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-b01-rework-completion-r2.json","docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B01_R2_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B01_R2_COMPLETION_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B01_R2_COMPLETION_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B01_R2_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B01_R2_COMPLETION_TARGET_MISMATCH")
    terminal=[event for event in bundle["events"]["events"] if 197<=event.get("sequence",-1)<=199]; wi=progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence")!=199,progress.get("status")!="TEST_REVIEW",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-01-20260813-002",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="R2_PENDING",wi.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST",[event.get("event_type") for event in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="DA32A7C2F2F3E38623BD691B876233A50E8267AC594E847E3108EE308A5E1AEF",manifest.get("developer_target_hash")!="E63009EE0F8386E670431F87EC6D2CE8C089D8D9C4ADCF51A5FC8B6D9D46373A")): errors.append("B01_R2_COMPLETION_PROJECTION_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {}; indexed={row.get("path"):row for row in successor.get("live_raw_checksums",[]) if isinstance(row,dict)}; required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,path,row.get("bytes"),row.get("sha256")) for path,row in indexed.items()): errors.append("B01_R2_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b01_r3_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json","docs/progress/failure-ledger.json","docs/progress/progress-handoff-detached-digest-b01-rework-start-r3.json","docs/test_reports/B-01_RETEST_REPORT_R2.md","docs/work_orders/B-01_REWORK_INVOCATION_PROMPT_R3.md","docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R3.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B01_R3_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B01_R3_START_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B01_R3_START_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B01_R3_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B01_R3_START_TARGET_MISMATCH")
    terminal=[event for event in bundle["events"]["events"] if 200<=event.get("sequence",-1)<=203]; worker=progress.get("worker_lease") or {}; write=progress.get("write_lease") or {}; wi=progress.get("active_work_instruction") or {}
    developer_paths={"packages/domain/reducer.py","tests/domain/test_reducer.py","docs/validation/B-01_DOMAIN_CORE_VALIDATION_R3.md","docs/evidence/manifests/B-01_EVIDENCE_MANIFEST_R3.json","docs/completion_reports/B-01_COMPLETION_REPORT_R3.md"}
    if any((progress.get("event_sequence")!=203,progress.get("status")!="ACTIVE",progress.get("active_agent")!="developer-primary-b01",progress.get("valid_failure_count")!=2,wi.get("artifact_id")!="WI-B-01-20260814-003",wi.get("result_status")!="REWORK_IN_PROGRESS",wi.get("independent_tester_status")!="R3_PENDING",worker.get("lease_epoch")!=3,write.get("write_epoch")!=3,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=developer_paths,[event.get("event_type") for event in terminal]!=["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B01_ACCEPTANCE")): errors.append("B01_R3_START_PROJECTION_MISMATCH")
    if manifest.get("tester_report_sha256")!="AAFD3A01443162A99821B0D10967F432C9C5C9EF7309483CEC506E2B1BD02C09" or manifest.get("failure_fingerprint")!="BLK-B01-002-NONCANONICAL-TARGET-PADDING-BYPASS" or manifest.get("closed_findings")!=["BLK-B01-001"]: errors.append("B01_R3_START_FAILURE_BINDING_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {}; indexed={row.get("path"):row for row in successor.get("live_raw_checksums",[]) if isinstance(row,dict)}; required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,path,row.get("bytes"),row.get("sha256")) for path,row in indexed.items()): errors.append("B01_R3_START_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b01_r3_rework_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R3.json","docs/evidence/manifests/B-01_EVIDENCE_MANIFEST_R3.json","docs/progress/progress-handoff-detached-digest-b01-rework-completion-r3.json","docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R3.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B01_R3_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B01_R3_COMPLETION_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B01_R3_COMPLETION_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B01_R3_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B01_R3_COMPLETION_TARGET_MISMATCH")
    terminal=[event for event in bundle["events"]["events"] if 204<=event.get("sequence",-1)<=206]; wi=progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence")!=206,progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=2,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-01-20260814-003",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="R3_PENDING",wi.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST",[event.get("event_type") for event in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="3BB34296CBCA18AB063EBA0752B3E98D60C6CD7FD2410D29F024421C13F3665F",manifest.get("developer_target_hash")!="49FB06F9454037B69D343C4FF82F5FAF66B012827241C6586278F5CDF05CDA82")): errors.append("B01_R3_COMPLETION_PROJECTION_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {}; indexed={row.get("path"):row for row in successor.get("live_raw_checksums",[]) if isinstance(row,dict)}; required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,path,row.get("bytes"),row.get("sha256")) for path,row in indexed.items()): errors.append("B01_R3_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b01_r3_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json","docs/progress/progress-handoff-detached-digest-b01-accepted-r3.json","docs/test_reports/B-01_RETEST_REPORT_R3.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B01_R3_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B01_R3_ACCEPTANCE_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B01_R3_ACCEPTANCE_RAW_INVALID"); continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B01_R3_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B01_R3_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==207]; historical=progress.get("historical_failure_counts_by_lineage") or {}
    if any((progress.get("event_sequence")!=207,progress.get("current_work_package")!="B-02",progress.get("status")!="READY","B-01" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-02",historical.get("B-01")!=2,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="C0E25D90FEC533AEBF34B81D6698C702D88D898949ECA74B58B96627F5A18CE0")): errors.append("B01_R3_ACCEPTANCE_PROJECTION_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)};required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,path,row.get("bytes"),row.get("sha256")) for path,row in indexed.items()): errors.append("B01_R3_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b02_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-01_ACCEPTANCE_PROGRESS_MANIFEST_R3.json","docs/progress/progress-handoff-detached-digest-b02-start.json","docs/work_orders/B-02_INVOCATION_PROMPT.md","docs/work_orders/B-02_WORK_INSTRUCTION.md","scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    developer_paths={"pyproject.toml","alembic.ini","packages/persistence/__init__.py","packages/persistence/config.py","packages/persistence/repositories.py","packages/persistence/compatibility.py","migrations/env.py","migrations/script.py.mako","migrations/versions/0001_base.py","tests/persistence/test_repository_contract.py","tests/persistence/test_migration_contract.py","tests/persistence/test_postgres_compatibility.py","docs/validation/B-02_DATABASE_FOUNDATION_VALIDATION.md","docs/evidence/manifests/B-02_EVIDENCE_MANIFEST.json","docs/completion_reports/B-02_COMPLETION_REPORT.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B02_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B02_START_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B02_START_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B02_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B02_START_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {}; worker=progress.get("worker_lease") or {}; write=progress.get("write_lease") or {}; terminal=[e for e in bundle["events"]["events"] if 208<=e.get("sequence",-1)<=210]
    if any((progress.get("event_sequence")!=210,progress.get("current_work_package")!="B-02",progress.get("status")!="ACTIVE",progress.get("active_agent")!="developer-primary-b02",wi.get("artifact_id")!="WI-B-02-20260814-001",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=developer_paths,[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],manifest.get("product_artifact_count")!=0)): errors.append("B02_START_PROJECTION_MISMATCH")
    runtime=manifest.get("runtime_boundary") or {}
    if any(runtime.get(k)!="NOT_EXECUTED" for k in ("actual_api","actual_db","actual_ui","actual_provider","actual_wsl","actual_production","actual_deployment")): errors.append("B02_START_RUNTIME_BOUNDARY_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {}; indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}; required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B02_START_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b02_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-02_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-02_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b02-completion-test-review.json","docs/work_orders/B-02_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B02_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B02_COMPLETION_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B02_COMPLETION_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B02_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B02_COMPLETION_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {}; terminal=[e for e in bundle["events"]["events"] if 211<=e.get("sequence",-1)<=213]
    if any((progress.get("event_sequence")!=213,progress.get("current_work_package")!="B-02",progress.get("status")!="TEST_REVIEW",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B02_ACCEPTANCE",manifest.get("developer_manifest_sha256")!="7D2C102C5ACAC4C49278D2B2262C863CEB459F4528FA789CAC8EEBD740E2B77E",manifest.get("developer_target_hash")!="B5AB576791132542F42F4102725E7159FE271600C1FAA87A0A8D44368CF011F9")): errors.append("B02_COMPLETION_PROJECTION_MISMATCH")
    runtime=manifest.get("runtime_boundary") or {}
    if any((runtime.get("actual_postgresql15")!="PASS",runtime.get("actual_postgresql18")!="PASS",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_ui")!="NOT_EXECUTED",runtime.get("actual_provider")!="NOT_EXECUTED",runtime.get("actual_production")!="NOT_EXECUTED",runtime.get("actual_deployment")!="NOT_EXECUTED")): errors.append("B02_COMPLETION_RUNTIME_BOUNDARY_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {}; indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}; required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B02_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b02_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-02_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/failure-ledger.json","docs/progress/progress-handoff-detached-digest-b02-rework-start-r2.json","docs/test_reports/B-02_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-02_REWORK_INVOCATION_PROMPT_R2.md","docs/work_orders/B-02_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B02_R2_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B02_R2_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B02_R2_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B02_R2_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B02_R2_START_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};terminal=[e for e in bundle["events"]["events"] if 214<=e.get("sequence",-1)<=217]
    if any((progress.get("event_sequence")!=217,progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=1,wi.get("artifact_id")!="WI-B-02-20260814-002",worker.get("lease_epoch")!=2,write.get("write_epoch")!=2,[e.get("event_type") for e in terminal]!=["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],manifest.get("tester_report_sha256")!="1B2F3A70056BB50AAA01229A86EC6D8A5B2B74B5A797B35FC4E505AAAED419F1",manifest.get("failure_fingerprint")!="BLK-B02-001-COMPLETION-RUNTIME-FIELD-SEMANTICS")): errors.append("B02_R2_START_PROJECTION_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)};required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B02_R2_START_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_a02_rework_start_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-02_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a02-rework-start.json",
        "docs/test_reports/A-02_TEST_REPORT.md",
        "docs/work_orders/A-02_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A02_REWORK_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("A02_REWORK_RAW_CHECKSUMS_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen:
            errors.append("A02_REWORK_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A02_REWORK_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A02_REWORK_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A02_REWORK_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_content_bytes") != total_bytes
        or manifest.get("target_hash") != target
        or manifest.get("delivered_hash") != target
        or manifest.get("content_hash") != target
    ):
        errors.append("A02_REWORK_TARGET_MISMATCH")
    repository = progress.get("repository", {})
    manifest_repository = manifest.get("repository_projection", {})
    fields = (
        "projection_mode", "validated_base_commit", "head_relation", "branch",
        "upstream", "remote_head", "push_status", "exact_allowed_paths",
    )
    if any(manifest_repository.get(field) != repository.get(field) for field in fields):
        errors.append("A02_REWORK_REPOSITORY_PROJECTION_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    if (
        manifest.get("package_id") != "A-02"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 53
        or progress.get("status") != "ACTIVE"
        or progress.get("valid_failure_count") != 1
        or wi.get("sha256") != "E98C59E23CA907993B250C663E69F9DCF93BA79DAD17BDADDD0EFF76429381F0"
        or wi.get("result_status") != "REWORK_IN_PROGRESS"
        or wi.get("source_test_report_sha256") != "1732C036F79FBE05DF9EBF1BB59B67E621DAE8CC40259D30585714C01F73FAF8"
        or worker.get("lease_epoch") != 2
        or write.get("write_epoch") != 2
        or write.get("worker_lease_id") != worker.get("lease_id")
    ):
        errors.append("A02_REWORK_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a02_rework_completion_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-a02-rework-completion-test-review.json",
        "docs/test_reports/A-02_TEST_REPORT.md",
        "docs/work_orders/A-02_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A02_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A02_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A02_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A02_REWORK_COMPLETION_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A02_REWORK_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total_bytes, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target)):
        errors.append("A02_REWORK_COMPLETION_TARGET_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    if (
        manifest.get("package_id") != "A-02"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 56
        or progress.get("status") != "TEST_REVIEW"
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
        or wi.get("developer_manifest_sha256") != "779A92F0E97BACB85BBA91CA825B0483B0D1CB65266EFA6AFA3A0FBC12445168"
        or wi.get("developer_target_hash") != "5600CF11BED593D1187C454B54CA5CD218E149724EC0A7955C512E0520839CFD"
        or wi.get("independent_tester_status") != "R2_PENDING"
    ):
        errors.append("A02_REWORK_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_a02_acceptance_manifest(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    expected_paths = {
        "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json",
        "docs/evidence/manifests/A-02_REWORK_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-a02-accepted.json",
        "docs/test_reports/A-02_TEST_REPORT_R2.md",
        "docs/work_orders/A-02_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["A02_ACCEPTANCE_RAW_CHECKSUMS_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen:
            errors.append("A02_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("A02_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("A02_ACCEPTANCE_RAW_CHECKSUMS_INVALID")
        total_bytes += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
    if seen != expected_paths:
        errors.append("A02_ACCEPTANCE_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total_bytes, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target)):
        errors.append("A02_ACCEPTANCE_TARGET_MISMATCH")
    if (
        manifest.get("package_id") != "A-02"
        or manifest.get("self_reference") is not False
        or progress.get("event_sequence") != 57
        or progress.get("current_work_package") != "A-03"
        or progress.get("status") != "READY"
        or progress.get("valid_failure_count") != 0
        or progress.get("active_work_instruction") is not None
        or progress.get("active_agent") is not None
        or progress.get("worker_lease") is not None
        or progress.get("write_lease") is not None
    ):
        errors.append("A02_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_historical_manifest_raw_checksums(
    manifest: Mapping[str, Any], root: Path
) -> list[str]:
    """Validate an accepted past manifest's frozen rows without comparing evolved files."""
    del root
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or not rows:
        return ["HISTORICAL_MANIFEST_RAW_CHECKSUMS_MISSING"]
    canonical_rows: list[tuple[bytes, str]] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            errors.append("HISTORICAL_MANIFEST_RAW_ROW_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative.startswith("/") or "\\" in relative or ".." in Path(relative).parts:
            errors.append("HISTORICAL_MANIFEST_RAW_PATH_INVALID")
            continue
        byte_count = row.get("bytes")
        checksum = row.get("sha256")
        if relative in seen or not isinstance(byte_count, int) or byte_count < 0 or not isinstance(checksum, str) or not re.fullmatch(r"[0-9A-F]{64}", checksum):
            errors.append("HISTORICAL_MANIFEST_RAW_ROW_INVALID")
            continue
        seen.add(relative)
        text = f"{relative}\t{byte_count}\t{checksum}"
        canonical_rows.append((relative.encode("utf-8"), text))
    canonical_rows.sort(key=lambda item: item[0])
    canonical = "\n".join(text for _, text in canonical_rows).encode("utf-8")
    calculated = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if (
        manifest.get("target_canonical_bytes") != len(canonical)
        or manifest.get("target_hash") != calculated
        or manifest.get("delivered_hash") != calculated
    ):
        errors.append("HISTORICAL_MANIFEST_TARGET_MISMATCH")
    return sorted(set(errors))


def validate_accepted_evidence_chain(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the one-way accepted R2 -> live snapshot -> canonical R3 chain."""
    root = bundle["_root"]
    progress = bundle["progress"]
    accepted_ref = progress.get("latest_evidence_manifest_ref")
    expected_r2_path = "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json"
    expected_test_path = "docs/test_reports/G-05_TEST_REPORT_R2.md"
    errors: list[str] = []
    if not isinstance(accepted_ref, dict) or accepted_ref.get("path") != expected_r2_path:
        return ["ACCEPTED_EVIDENCE_REF_INVALID"]
    try:
        r2_hash = _sha256(root / expected_r2_path)
        r2_manifest = _load_json(root / expected_r2_path)
        test_hash = _sha256(root / expected_test_path)
    except (OSError, json.JSONDecodeError):
        return ["ACCEPTED_EVIDENCE_REF_INVALID"]
    if accepted_ref.get("sha256") != r2_hash:
        errors.append("ACCEPTED_EVIDENCE_REF_INVALID")
    supersedes = manifest.get("supersedes_artifact_ref")
    if not isinstance(supersedes, dict) or (
        supersedes.get("artifact_id") != r2_manifest.get("artifact_id")
        or supersedes.get("path") != expected_r2_path
        or supersedes.get("file_sha256") != r2_hash
        or supersedes.get("content_hash") != r2_manifest.get("content_hash")
        or manifest.get("supersedes_artifact_id") != r2_manifest.get("artifact_id")
    ):
        errors.append("MANIFEST_REVISION_CHAIN_INVALID")
    if r2_manifest.get("artifact_id") not in manifest.get("source_artifact_ids", []):
        errors.append("MANIFEST_REVISION_CHAIN_INVALID")
    evidence_refs = manifest.get("source_evidence_refs")
    matches = [
        item
        for item in evidence_refs or []
        if isinstance(item, dict) and item.get("path") == expected_test_path
    ]
    if len(matches) != 1 or matches[0].get("sha256") != test_hash:
        errors.append("ACCEPTANCE_TEST_EVIDENCE_INVALID")
    if accepted_ref.get("path") == "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json":
        errors.append("MANIFEST_SELF_REFERENCE_FORBIDDEN")
    return sorted(set(errors))


def _validate_referenced_hashes(bundle: Mapping[str, Any]) -> list[str]:
    progress = bundle["progress"]
    root = bundle["_root"]
    references: list[Mapping[str, Any]] = []
    references.extend(
        item for item in progress.get("latest_evidence_refs", []) if isinstance(item, dict)
    )
    for key in (
        "latest_evidence_manifest_ref",
        "active_work_instruction",
        "last_accepted_work_instruction",
        "root_human_approval_binding",
        "derived_baseline_binding",
    ):
        item = progress.get(key)
        if isinstance(item, dict):
            references.append(item)
    errors: list[str] = []
    for reference in references:
        path = reference.get("path")
        expected = reference.get("sha256")
        if path is None or expected is None:
            continue
        try:
            actual = _sha256(root / path)
        except OSError:
            errors.append("PRG_REFERENCED_PATH_MISSING")
            continue
        if actual != expected:
            errors.append("PRG_REFERENCED_HASH_MISMATCH")
    authority_files = {
        "design_baseline_hash": "Anvil_설계서_v2.md",
        "work_plan_hash": "Anvil_작업계획서_v1.md",
    }
    for field, relative in authority_files.items():
        try:
            actual = _sha256(root / relative)
        except OSError:
            errors.append("PRG_REFERENCED_PATH_MISSING")
            continue
        if progress.get(field) != actual:
            errors.append("PRG_REFERENCED_HASH_MISMATCH")
    return errors

def validate_b02_rework_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    errors=[];root=bundle["_root"];progress=bundle["progress"]
    expected={"docs/evidence/manifests/B-02_REWORK_START_PROGRESS_MANIFEST_R2.json","docs/evidence/manifests/B-02_EVIDENCE_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-b02-rework-completion-r2.json","docs/work_orders/B-02_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums");seen=set();indexed={};total=0
    if not isinstance(rows,list): return ["B02_R2_COMPLETION_RAW_INVALID"]
    for row in rows:
        if not isinstance(row,dict): errors.append("B02_R2_COMPLETION_RAW_INVALID");continue
        relative=row.get("path")
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B02_R2_COMPLETION_RAW_INVALID");continue
        seen.add(relative);indexed[relative]=row
        try: data=(root/relative).read_bytes()
        except OSError: errors.append("B02_R2_COMPLETION_RAW_INVALID");continue
        if row.get("bytes")!=len(data) or row.get("sha256")!=hashlib.sha256(data).hexdigest().upper(): errors.append("B02_R2_COMPLETION_RAW_INVALID")
        total+=len(data)
    if seen!=expected: errors.append("B02_R2_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted((f"{p}\t{r.get('bytes')}\t{r.get('sha256')}" for p,r in indexed.items()),key=lambda value:value.encode())).encode();target=f"sha256:{hashlib.sha256(can).hexdigest().upper()}"
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B02_R2_COMPLETION_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {};terminal=[e for e in bundle["events"]["events"] if 218<=e.get("sequence",-1)<=220]
    if any((progress.get("event_sequence")!=220,progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=1,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-02-20260814-002",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="R2_PENDING",wi.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="9C0DC1AA38D2956D97D0D59C355FA590794812CE764E8B61CB3FC3CF1E27EB20",manifest.get("developer_target_hash")!="361EC1B007AAFC25CEB12238E7DCAA24B8902E4F3DBD33F443D8DBA31FC82E83",manifest.get("runtime_boundary",{}).get("actual_runtime_rerun")!="NOT_EXECUTED",manifest.get("runtime_boundary",{}).get("prior_actual_runtime_evidence")!="PRESERVED")): errors.append("B02_R2_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection",{});srows=successor.get("live_raw_checksums",[]);sidx={r.get("path"):r for r in srows if isinstance(r,dict)}
    if set(sidx)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in sidx.items()): errors.append("B02_R2_COMPLETION_SUCCESSOR_INVALID")
    return errors

def validate_b02_r2_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/evidence/manifests/B-02_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-b02-accepted-r2.json","docs/test_reports/B-02_RETEST_REPORT_R2.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B02_R2_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B02_R2_ACCEPTANCE_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B02_R2_ACCEPTANCE_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B02_R2_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B02_R2_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==221];historical=progress.get("historical_failure_counts_by_lineage") or {}
    if any((progress.get("event_sequence")!=221,progress.get("current_work_package")!="B-03",progress.get("status")!="READY","B-02" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-03",historical.get("B-02")!=1,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="D9C46F74959C4705C9099DF7DFEBDDABDE2A8D32F220E704DD582E7F05360054",manifest.get("semantic_scope")!="SERVER_VERSION_NUM_FIELDS_NO_PORT_KEYS",manifest.get("runtime_boundary",{}).get("actual_runtime_rerun")!="NOT_EXECUTED")): errors.append("B02_R2_ACCEPTANCE_PROJECTION_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)};required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B02_R2_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b03_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/evidence/manifests/B-02_ACCEPTANCE_PROGRESS_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-b03-start.json","docs/work_orders/B-03_INVOCATION_PROMPT.md","docs/work_orders/B-03_WORK_INSTRUCTION.md","scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B03_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B03_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B03_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B03_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B03_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 222<=e.get("sequence",-1)<=224];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {}
    if any((progress.get("event_sequence")!=224,progress.get("current_work_package")!="B-03",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-03-20260814-001",progress.get("active_agent")!="developer-primary-b03",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],manifest.get("product_artifact_count")!=0,manifest.get("runtime_boundary",{}).get("actual_l4")!="NOT_EXECUTED",manifest.get("runtime_boundary",{}).get("actual_l7")!="NOT_EXECUTED")): errors.append("B03_START_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B03_START_SUCCESSOR_INVALID")
    if manifest.get("predecessor_acceptance_ref",{}).get("sha256")!="3BF009A1610C7C4C0CCCC0581AC3C5DD9E1ECC7D32454D07E3BAA7BDBACD0996": errors.append("B03_START_PREDECESSOR_INVALID")
    return sorted(set(errors))


def validate_b03_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/evidence/manifests/B-03_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-03_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b03-completion-test-review.json","docs/work_orders/B-03_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B03_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B03_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B03_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B03_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B03_COMPLETION_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {};terminal=[e for e in bundle["events"]["events"] if 225<=e.get("sequence",-1)<=227];boundary=manifest.get("verification_boundary") or {}
    if any((progress.get("event_sequence")!=227,progress.get("current_work_package")!="B-03",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=0,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-03-20260814-001",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="F6E41000512F973D6CF2F3560E42AE6A9545A17C0F4FC8C1F0424DC67BAC8A48",manifest.get("developer_target_hash")!="FC033DF8B35C9DA19FEACD6FD8ECACA72A13985CBF2728624B53BA176D22F373",manifest.get("developer_mutation")!="FORBIDDEN_FROZEN_PREDECESSOR",boundary.get("av_flow_001_l4_l7")!="NOT_EXECUTED",boundary.get("independent_tester_verdict")!="PENDING_INDEPENDENT_ASSESSMENT",boundary.get("verdict_effect")!="NOT_PREDECIDED_BY_MAIN")): errors.append("B03_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B03_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def _git_value(root: Path, *arguments: str) -> str | None:
    result = subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.rstrip()


def _git_returncode(root: Path, *arguments: str) -> int:
    return subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        check=False,
        text=True,
    ).returncode


def _split_git_paths(output: str | None) -> list[str]:
    if not output:
        return []
    return sorted({line.strip().replace("\\", "/") for line in output.splitlines() if line.strip()})


def _working_tree_paths(output: str | None) -> list[str]:
    if not output:
        return []
    paths: set[str] = set()
    for line in output.splitlines():
        if len(line) < 4:
            continue
        relative = line[3:].strip().replace("\\", "/")
        if " -> " in relative:
            before, after = relative.split(" -> ", 1)
            paths.update((before, after))
        elif relative:
            paths.add(relative)
    return sorted(paths)


def _is_evidence_only_path(relative: str) -> bool:
    return (
        relative in EVIDENCE_ONLY_TOOLING_PATHS
        or relative in A01_COMPLETION_EXACT_PATHS
        or relative in A02_COMPLETION_EXACT_PATHS
        or relative in A03_COMPLETION_EXACT_PATHS
        or relative in A04_COMPLETION_EXACT_PATHS
        or relative in A05_COMPLETION_EXACT_PATHS
        or relative in A06_COMPLETION_EXACT_PATHS
        or relative in A07_COMPLETION_EXACT_PATHS
        or relative in A08_COMPLETION_EXACT_PATHS
        or relative in A09_COMPLETION_EXACT_PATHS
        or relative in A10_COMPLETION_EXACT_PATHS
        or relative in A11_COMPLETION_EXACT_PATHS
        or relative.startswith(EVIDENCE_ONLY_PATH_PREFIXES)
        or relative.startswith(A01_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A02_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A03_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A04_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A05_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A06_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A07_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A08_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A09_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A10_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A11_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A12_COMPLETION_PATH_PREFIXES)
        or relative in A12_COMPLETION_EXACT_PATHS
        or relative.startswith(A13_COMPLETION_PATH_PREFIXES)
        or relative in A13_COMPLETION_EXACT_PATHS
        or relative.startswith(A14_COMPLETION_PATH_PREFIXES)
        or relative in A14_COMPLETION_EXACT_PATHS
        or relative.startswith(A15_COMPLETION_PATH_PREFIXES)
        or relative in A15_COMPLETION_EXACT_PATHS
    )


def validate_repository_projection(
    repository: Mapping[str, Any],
    *,
    actual_head: str | None,
    actual_branch: str | None,
    actual_upstream: str | None,
    actual_remote_head: str | None,
    base_is_ancestor: bool,
    actual_changed_paths: list[str],
    working_tree_mode: bool,
) -> list[str]:
    errors: list[str] = []
    base = repository.get("validated_base_commit")
    allowed = repository.get("exact_allowed_paths")
    if (
        repository.get("projection_mode") != VALIDATED_BASE_PROJECTION_MODE
        or repository.get("head_relation") != VALIDATED_BASE_PENDING_RELATION
        or not isinstance(base, str)
        or not re.fullmatch(r"[0-9a-f]{40}", base)
        or not isinstance(allowed, list)
        or not allowed
        or any(not isinstance(path, str) or not path for path in allowed)
        or allowed != sorted(set(allowed))
    ):
        errors.append("GIT_DESCENDANT_PROJECTION_INVALID")
        return errors
    b01_start_projection = repository.get("validated_base_commit") == "11b79b98f9a7c042f897f090a75d3f912e436d60" and set(allowed) == {"docs/evidence/manifests/B-01_START_EVIDENCE_MANIFEST.json","docs/progress/BUILD_HANDOFF.md","docs/progress/build-progress.json","docs/progress/progress-events.json","docs/progress/progress-handoff-detached-digest-b01-start.json","docs/work_orders/B-01_INVOCATION_PROMPT.md","docs/work_orders/B-01_WORK_INSTRUCTION.md","scripts/check_a13_repository_scan.py","scripts/check_g07_baseline.py","scripts/check_phase_g_gate.py","scripts/check_project_progress.py","tests/tooling/test_a13_repository_scan.py","tests/tooling/test_g07_baseline.py","tests/tooling/test_phase_g_gate.py","tests/tooling/test_project_progress.py"}
    b01_completion_projection = repository.get("validated_base_commit") == "31656b934c225262a58f88f3411b57ea4839fc49" and "docs/evidence/manifests/B-01_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b01_rework_start_projection = repository.get("validated_base_commit") == "6735088c8ed919cba44256ded5c4c8d281e4a3f8" and "docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R2.json" in allowed
    b01_rework_completion_projection = repository.get("validated_base_commit") == "f74c3a1dccd7b9e2752c742baf597de062f8b779" and "docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json" in allowed
    b01_r3_rework_start_projection = repository.get("validated_base_commit") == "6226e7828e11c564b08de738ba46c5b028792a85" and "docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R3.json" in allowed
    b01_r3_rework_completion_projection = repository.get("validated_base_commit") == "10149bcd6569bce539fabc980087b0ccec0f8a01" and "docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json" in allowed
    b01_r3_acceptance_projection = repository.get("validated_base_commit") == "033938b7d907d2c5ff02c006c3048edbf6467c5c" and "docs/evidence/manifests/B-01_ACCEPTANCE_PROGRESS_MANIFEST_R3.json" in allowed
    b02_start_projection = repository.get("validated_base_commit") == "85730a48cdc71c06a67728bbd4640b1aeb7e5cb5" and "docs/evidence/manifests/B-02_START_EVIDENCE_MANIFEST.json" in allowed
    b02_completion_projection = repository.get("validated_base_commit") == "1871a53ecda15544757382ce13d30e3bb3f63f73" and "docs/evidence/manifests/B-02_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b02_rework_projection = repository.get("validated_base_commit") == "0abd0a830432956fc3da18740edbfd07488e3847" and "docs/evidence/manifests/B-02_REWORK_START_PROGRESS_MANIFEST_R2.json" in allowed
    b02_rework_completion_projection = repository.get("validated_base_commit") == "56f083509ebd04c6cc239af0008f1f76cd09c951" and "docs/evidence/manifests/B-02_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json" in allowed
    b02_r2_acceptance_projection = repository.get("validated_base_commit") == "31366334eec3b1c42b82bc9c76a1b2de1f7fafe7" and "docs/evidence/manifests/B-02_ACCEPTANCE_PROGRESS_MANIFEST_R2.json" in allowed
    b03_start_projection = repository.get("validated_base_commit") == "a589b17f26991432de5cf48cfe95c441cdd6da39" and "docs/evidence/manifests/B-03_START_EVIDENCE_MANIFEST.json" in allowed
    b03_completion_projection = repository.get("validated_base_commit") == "8f65b3e32aa9a45e18879aedca6add424df2ce2c" and "docs/evidence/manifests/B-03_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    if any(not _is_evidence_only_path(path) for path in allowed) and not b01_start_projection and not b01_completion_projection and not b01_rework_start_projection and not b01_rework_completion_projection and not b01_r3_rework_start_projection and not b01_r3_rework_completion_projection and not b01_r3_acceptance_projection and not b02_start_projection and not b02_completion_projection and not b02_rework_projection and not b02_rework_completion_projection and not b02_r2_acceptance_projection and not b03_start_projection and not b03_completion_projection:
        errors.append("GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN")
    if repository.get("branch") != actual_branch:
        errors.append("GIT_BRANCH_MISMATCH")
    if repository.get("upstream") != actual_upstream:
        errors.append("GIT_UPSTREAM_MISMATCH")
    if not base_is_ancestor:
        errors.append("GIT_VALIDATED_BASE_NOT_ANCESTOR")
    if sorted(set(actual_changed_paths)) != allowed:
        errors.append("GIT_DESCENDANT_PATH_SET_MISMATCH")
    if working_tree_mode:
        remote_lag_declared = (
            repository.get("push_status") == "PUSH_PENDING_MAIN"
            and repository.get("remote_head") == actual_remote_head
            and isinstance(actual_remote_head, str)
            and re.fullmatch(r"[0-9a-f]{40}", actual_remote_head) is not None
            and actual_remote_head != base
        )
        if actual_head != base or (actual_remote_head != base and not remote_lag_declared):
            errors.append("GIT_DESCENDANT_ORIGIN_MISMATCH")
    elif actual_remote_head != actual_head:
        errors.append("GIT_DESCENDANT_ORIGIN_MISMATCH")
    return sorted(set(errors))


def _validate_git_projection(bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]
    if not (root / ".git").exists():
        return []
    repository = bundle["progress"].get("repository", {})
    errors: list[str] = []
    actual_head = _git_value(root, "rev-parse", "HEAD")
    actual_branch = _git_value(root, "branch", "--show-current")
    actual_upstream = _git_value(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    actual_remote_head = _git_value(root, "rev-parse", "@{u}") if actual_upstream else None
    if repository.get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE:
        base = repository.get("validated_base_commit")
        working_tree_mode = actual_head == base
        if working_tree_mode:
            changed_paths = _working_tree_paths(
                _git_value(root, "status", "--porcelain=v1", "--untracked-files=all")
            )
            base_is_ancestor = True
        else:
            changed_paths = _split_git_paths(
                _git_value(root, "diff", "--name-only", f"{base}..{actual_head}")
                if isinstance(base, str) and actual_head
                else None
            )
            base_is_ancestor = bool(
                isinstance(base, str)
                and actual_head
                and _git_returncode(root, "merge-base", "--is-ancestor", base, actual_head) == 0
            )
            if _working_tree_paths(
                _git_value(root, "status", "--porcelain=v1", "--untracked-files=all")
            ):
                errors.append("GIT_DESCENDANT_WORKTREE_DIRTY")
        errors.extend(
            validate_repository_projection(
                repository,
                actual_head=actual_head,
                actual_branch=actual_branch,
                actual_upstream=actual_upstream,
                actual_remote_head=actual_remote_head,
                base_is_ancestor=base_is_ancestor,
                actual_changed_paths=changed_paths,
                working_tree_mode=working_tree_mode,
            )
        )
        if not repository.get("worktree_status"):
            errors.append("GIT_WORKTREE_STATUS_MISSING")
        return sorted(set(errors))
    if repository.get("local_head") != actual_head:
        errors.append("GIT_LOCAL_HEAD_MISMATCH")
    if repository.get("branch") != actual_branch:
        errors.append("GIT_BRANCH_MISMATCH")
    if repository.get("upstream") != actual_upstream:
        errors.append("GIT_UPSTREAM_MISMATCH")
    if repository.get("remote_head") != actual_remote_head:
        errors.append("GIT_REMOTE_HEAD_MISMATCH")
    if not repository.get("worktree_status"):
        errors.append("GIT_WORKTREE_STATUS_MISSING")
    return errors


def validate_bundle(bundle: Mapping[str, Any]) -> list[str]:
    errors: list[str] = []
    progress = bundle["progress"]
    for field in CHAPTER_15_MINIMUM_FIELDS:
        if field not in progress:
            errors.append("PRG_MINIMUM_FIELD_MISSING")
    for field in EXTENDED_PROGRESS_FIELDS:
        if field not in progress:
            errors.append("PRG_EXTENDED_FIELD_MISSING")
    if progress.get("snapshot_hash") != compute_snapshot_hash(progress):
        errors.append("PRG_SNAPSHOT_HASH_MISMATCH")

    evidence_by_path: dict[str, str] = {}
    for reference in progress.get("latest_evidence_refs", []):
        if not isinstance(reference, dict):
            errors.append("PRG_EVIDENCE_REF_INVALID")
            continue
        path = reference.get("path")
        checksum = reference.get("sha256")
        if path in evidence_by_path and evidence_by_path[path] != checksum:
            errors.append("PRG_DUPLICATE_EVIDENCE_HASH")
        evidence_by_path[path] = checksum

    errors.extend(_validate_events(bundle))
    errors.extend(_validate_handoff(bundle))
    errors.extend(_validate_failure_ledger(bundle["failure_ledger"], bundle["_root"]))
    errors.extend(_validate_failure_projection(bundle))
    errors.extend(_validate_nonsemantic(bundle["nonsemantic"], bundle["_root"]))
    errors.extend(_validate_dir(bundle))
    errors.extend(_validate_reporting(progress))
    errors.extend(_validate_reporting_state(bundle))
    errors.extend(_validate_registry_refs(bundle))
    errors.extend(_validate_referenced_hashes(bundle))
    errors.extend(_validate_git_projection(bundle))
    errors.extend(validate_detached_progress_binding(bundle))
    current_ref = progress.get("current_progress_evidence_ref") or {}
    current_manifest_relative = current_ref.get(
        "manifest_path", "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json"
    )
    manifest_path = bundle["_root"] / current_manifest_relative
    try:
        manifest = _load_json(manifest_path)
    except (OSError, json.JSONDecodeError):
        errors.append("MANIFEST_DETACHED_DIGEST_BINDING_MISSING")
    else:
        errors.extend(validate_manifest_progress_binding(manifest, bundle))
        if current_manifest_relative == "docs/evidence/manifests/A-01_PRECONDITION_ACCEPTANCE_MANIFEST.json":
            errors.extend(validate_a01_precondition_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-02_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a02_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-02_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a02_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-02_REWORK_START_MANIFEST.json":
            errors.extend(validate_a02_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-02_REWORK_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a02_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-02_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a02_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-03_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a03_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-03_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a03_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-03_REWORK_START_MANIFEST.json":
            errors.extend(validate_a03_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-03_REWORK_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a03_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-03_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a03_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-04_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a04_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-04_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a04_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-04_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a04_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-05_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a05_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-05_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a05_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-05_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a05_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-06_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a06_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-06_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a06_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-06_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a06_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-07_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a07_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-07_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a07_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-07_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a07_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-08_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a08_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-08_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a08_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-08_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a08_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-09_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a09_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-09_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a09_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-09_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a09_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-10_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a10_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-10_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a10_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-10_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a10_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-11_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a11_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-11_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a11_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-11_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a11_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-12_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a12_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-12_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a12_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-12_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_a12_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-13_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a13_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a13_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-13_REWORK_START_MANIFEST.json":
            errors.extend(validate_a13_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_a13_r2_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-13_ACCEPTANCE_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_a13_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a14_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a14_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_REWORK_START_MANIFEST.json":
            errors.extend(validate_a14_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_a14_r2_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_REWORK_START_MANIFEST_R3.json":
            errors.extend(validate_a14_r3_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_a14_r3_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_MAIN_TAKEOVER_COMPLETION_MANIFEST_R4.json":
            errors.extend(validate_a14_main_takeover_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_PORTABILITY_COMPLETION_MANIFEST_R5.json":
            errors.extend(validate_a14_portability_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json":
            errors.extend(validate_a14_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-15_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_a15_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-15_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a15_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-15_ACCEPTANCE_DIR1_PROGRESS_MANIFEST.json":
            errors.extend(validate_a15_acceptance_dir1_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/A-GATE_DECISION_PROGRESS_MANIFEST.json":
            errors.extend(validate_a_gate_decision_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-01_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b01_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-01_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b01_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b01_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b01_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b01_r3_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b01_r3_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-01_ACCEPTANCE_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b01_r3_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-02_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b02_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-02_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b02_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-02_REWORK_START_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b02_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-02_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b02_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-02_ACCEPTANCE_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b02_r2_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b03_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b03_completion_manifest(manifest, bundle))
    historical_g05_path = bundle["_root"] / "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json"
    try:
        historical_g05_manifest = _load_json(historical_g05_path)
    except (OSError, json.JSONDecodeError):
        errors.append("HISTORICAL_MANIFEST_MISSING")
    else:
        errors.extend(validate_historical_manifest_raw_checksums(historical_g05_manifest, bundle["_root"]))
        if progress.get("current_work_package") == "G-05":
            errors.extend(validate_accepted_evidence_chain(historical_g05_manifest, bundle))
    errors.extend(validate_schema_catalog(bundle["schema_catalog"], bundle["_root"]))
    return sorted(set(errors))


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    root = Path(arguments[0]).resolve() if arguments else Path.cwd()
    try:
        bundle = load_bundle(root)
        errors = validate_bundle(bundle)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"LOAD_ERROR:{exc}")
        return 1
    if errors:
        for reason_code in errors:
            print(reason_code)
        return 1
    print(
        "G-05 project progress contract: PASS "
        f"sequence={bundle['progress']['event_sequence']} "
        f"reporting={bundle['progress']['reporting_decision']['decision']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
