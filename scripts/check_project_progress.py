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
EVIDENCE_ONLY_TOOLING_PATHS = {
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
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


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
            event.get("event_type") == "PACKAGE_COMPLETED"
            and event.get("details", {}).get("package_status") == "ACCEPTED"
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
        and event.get("event_type") in {"PACKAGE_STARTED", "PACKAGE_COMPLETED", "PACKAGE_RESUMED", "MAIN_PACKAGE_ACCEPTED"}
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
            and event_type in {"PACKAGE_STARTED", "PACKAGE_COMPLETED", "PACKAGE_RESUMED", "MAIN_PACKAGE_ACCEPTED"}
            and isinstance(details, dict)
            and progress is not None
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
    file_hashes = bundle.get("_file_hashes", {})
    if progress_binding.get("file_sha256") != file_hashes.get(expected_progress_path):
        errors.append("DETACHED_DIGEST_MISMATCH")
    if handoff_binding.get("file_sha256") != file_hashes.get(expected_handoff_path):
        errors.append("DETACHED_DIGEST_MISMATCH")
    root = bundle["_root"]
    try:
        if progress_binding.get("bytes") != (root / expected_progress_path).stat().st_size:
            errors.append("DETACHED_DIGEST_MISMATCH")
        if handoff_binding.get("bytes") != (root / expected_handoff_path).stat().st_size:
            errors.append("DETACHED_DIGEST_MISMATCH")
    except OSError:
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
        or relative.startswith(EVIDENCE_ONLY_PATH_PREFIXES)
        or relative.startswith(A01_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A02_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A03_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A04_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A05_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A06_COMPLETION_PATH_PREFIXES)
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
    if any(not _is_evidence_only_path(path) for path in allowed):
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
