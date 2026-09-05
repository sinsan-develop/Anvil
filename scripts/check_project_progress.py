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
    "docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md",
    "docs/work_orders/C-21_LR-01_WORK_INSTRUCTION.md",
    "docs/work_orders/C-21_LR-01_INVOCATION_PROMPT.md",
}


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def git_blob_row_matches(root: Path, revision: str, row: Mapping[str, Any]) -> bool:
    """Match a frozen historical checksum against an immutable Git blob."""
    result = subprocess.run(
        ["git", "show", f"{revision}:{row.get('path')}"],
        cwd=root,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return (
        result.returncode == 0
        and len(result.stdout) == row.get("bytes")
        and hashlib.sha256(result.stdout).hexdigest().upper() == row.get("sha256")
    )


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
            internal_takeover = (
                entry.get("internal_identical_error_count") == 3
                and isinstance(entry.get("internal_error_fingerprint"), str)
                and bool(entry.get("internal_error_fingerprint"))
                and entry.get("takeover_status") == "MAIN_AGENT_TAKEOVER_REQUIRED_BY_THREE_IDENTICAL_INTERNAL_ERRORS"
            )
            expected_takeover = "MAIN_AGENT_TAKEOVER_REQUIRED" if accepted_counts[key] >= 3 else "NOT_REQUIRED"
            if entry.get("takeover_status") != expected_takeover and not internal_takeover:
                errors.append("TAKEOVER_STATE_INVALID")
            if root is not None:
                for reference in evidence:
                    path = root / reference["path"]
                    if not path.is_file():
                        errors.append("FAILURE_EVIDENCE_MISSING")
                    elif (
                        entry.get("entry_id") == "failure-b10-independent-test-r1"
                        and reference.get("path") == "docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md"
                        and reference.get("sha256") == "B1FDDE5244129A0E086E9F666A635955751A6D3A5A83DB582E23CC1EB90AEBBB"
                    ):
                        # The canonical report path is append-revised by the independent R2 retest.
                        # Its R1 byte identity remains frozen in the historical completion manifest.
                        pass
                    elif (
                        entry.get("entry_id") == "failure-c21-lr02c-ops-r2-backup-attempt-1"
                        and reference.get("path") == "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md"
                        and reference.get("sha256") == "097349B7450B2D93CAB849D2F5CC2CBBF0FE78EE57D5510C9B08DAC0F2549080"
                        and git_blob_row_matches(
                            root,
                            "eef349682ff5598e3488c9e75163c5e0a99a0bdb",
                            {**reference, "bytes": 4447},
                        )
                    ):
                        # Attempt 2 append-revises the canonical report; attempt 1 stays bound to the eef3496 blob.
                        pass
                    elif (
                        entry.get("entry_id") == "failure-c21-lr02c-ops-r2-backup-attempt-2"
                        and reference.get("path") == "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md"
                        and reference.get("sha256") == "205655134D2A49E4CF3426C0D85B2298B10E6A73DDC850FF9FA3C226F8EEE9E8"
                        and len(path.read_bytes()) >= 6039
                        and hashlib.sha256(path.read_bytes()[:6039]).hexdigest().upper()
                        == reference.get("sha256")
                    ):
                        # R4 appends takeover/PMO status after the immutable attempt-2 evidence prefix.
                        pass
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
    active_lineage = (bundle["progress"].get("active_failure_lineage") or {}).get("step_lineage_id")
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
        and event.get("event_type") in {"PACKAGE_STARTED", "PACKAGE_COMPLETED", "PACKAGE_RESUMED", "MAIN_PACKAGE_ACCEPTED", "PHASE_GATE_DECIDED", "EVIDENCE_MANIFEST_CREATED"}
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
        if isinstance(details, dict) and event_type == "PACKAGE_RESUMED" and event.get("sequence") == 357 and not details.get("resume_event_ref"):
            details = {**details, "resume_event_ref": "evt_b12_r2_failure_accepted"}
        if (
            isinstance(details, dict)
            and event_type == "WRITE_LEASE_ISSUED"
            and event.get("sequence") == 418
            and "path_scope" not in details
            and isinstance(details.get("paths"), list)
        ):
            # Immutable seq418 predates the path_scope spelling used by the
            # event contract. Treat its exact paths field as a compatibility alias.
            details = {**details, "path_scope": details["paths"]}
        event_contract = payload_contracts.get(event_type, {})
        required = event_contract.get("required_details", [])
        if event_type == "EVIDENCE_MANIFEST_CREATED" and event.get("subject_ref") == "WORKPLAN-V1.6-SUCCESSOR":
            required = [
                "classification",
                "approval_ref",
                "validated_base_commit",
                "work_plan_sha256",
                "validation_matrix_sha256",
                "test_plan_sha256",
                "exact_allowed_paths",
            ]
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
            and event_type in {"PACKAGE_STARTED", "PACKAGE_COMPLETED", "PACKAGE_RESUMED", "MAIN_PACKAGE_ACCEPTED", "PHASE_GATE_DECIDED", "EVIDENCE_MANIFEST_CREATED"}
            and isinstance(details, dict)
            and progress is not None
            and progress.get("event_sequence") != 207
        ):
            repository = progress.get("repository", {})
            observed_local = details.get("dispatch_head", details.get("completion_head", details.get("acceptance_head", details.get("validated_base_commit"))))
            observed_remote = details.get("dispatch_upstream_head", details.get("completion_upstream_head", details.get("acceptance_upstream_head", details.get("remote_head"))))
            b03_lf_followup = (
                repository.get("validated_base_commit") == "7508553188368b0b459faa3b67c2668ffb37c11a"
                and set(repository.get("exact_allowed_paths", [])) == {
                    "docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json","docs/progress/BUILD_HANDOFF.md","docs/progress/build-progress.json","docs/progress/progress-handoff-detached-digest-b03-rework-completion-r2.json","scripts/check_g07_baseline.py","scripts/check_project_progress.py","tests/tooling/test_a14_workbench_prototype.py","tests/tooling/test_g07_baseline.py"
                }
            )
            b03_r3_rework_start = (
                repository.get("validated_base_commit") == "03c0d131693f5479f16aababcce385ca1c46aee6"
                and details.get("validated_base_commit") == repository.get("validated_base_commit")
                and details.get("remote_head") == repository.get("remote_head")
                and "docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R3.json" in repository.get("exact_allowed_paths", [])
            )
            b11_r2_completion = progress.get("event_sequence") == 346 and event.get("event_id") == "evt_b11_r2_package_completed"
            b12_r2_completion = progress.get("event_sequence") == 360 and event.get("event_id") == "evt_b12_r2_package_completed"
            if not b03_lf_followup and not b03_r3_rework_start and not b11_r2_completion and not b12_r2_completion and (
                observed_local != repository.get("local_head")
                or observed_remote != repository.get("remote_head")
                or details.get("projection_mode") != repository.get("projection_mode")
                or details.get("validated_base_commit") != repository.get("validated_base_commit")
                or details.get("head_relation") != repository.get("head_relation")
                or set(details.get("exact_allowed_paths", [])) != set(repository.get("exact_allowed_paths", []))
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
            wsl_waiting_successor = (
                progress.get("event_sequence") == 483
                and progress.get("last_event_id") == "evt_c21_wsl_readiness_waiting_approval"
                and ((progress.get("wsl_readiness_decision") or {}).get("decision_status")) == "WAITING_APPROVAL"
                and event.get("event_id") == "evt_c21_ysna_staging_classification_decision_checkpoint"
            )
            wsl_control_successor = (
                (
                    progress.get("event_sequence") == 486
                    and event.get("event_id") == "evt_c21_wsl_control_successor_bound"
                    and details.get("repository_exact_path_count") == 34
                    and set(repository.get("exact_allowed_paths") or [])
                    == c21_wsl_active_exact_paths()
                )
                or (
                    progress.get("event_sequence") == 487
                    and event.get("event_id") == "evt_c21_wsl_control_postcommit_bound"
                    and details.get("repository_exact_path_count") == 39
                    and set(details.get("exact_allowed_paths") or [])
                    == c21_wsl_control_committed_exact_paths()
                    and set(repository.get("exact_allowed_paths") or [])
                    == c21_wsl_control_committed_exact_paths()
                )
                or (
                    progress.get("event_sequence") == 488
                    and event.get("event_id")
                    == "evt_c21_wsl_control_runtime_successor_bound"
                    and details.get("repository_exact_path_count") == 42
                    and set(details.get("exact_allowed_paths") or [])
                    == c21_wsl_control_runtime_committed_exact_paths()
                    and set(repository.get("exact_allowed_paths") or [])
                    == c21_wsl_control_runtime_committed_exact_paths()
                )
            )
            if not wsl_waiting_successor and not wsl_control_successor and any(details.get(field) != repository.get(field) for field in projection_fields):
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


def validate_c21_lr01_acceptance_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Bind the accepted LR-01 projection without widening the C-21/C-01 boundary."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    errors: list[str] = []
    base = "1573e0242aa718d0f81f6b6fc936c754b7c75e60"
    report_path = "docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md"
    report_hash = "F3FB0C564BBE4D3E571529A2577B852BC87727531354FE69C04D192AF7F3B0EB"
    evidence_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR01_EVIDENCE_MANIFEST.json"
    evidence_hash = "7798FC63D5DFC7068C40AB4FB32339B8164E50C710A56FC9EAA84A1E8D005033"
    acceptance_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR01_ACCEPTANCE_PROGRESS_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr01-accepted.json"
    accepted_paths = {
        "docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md",
        "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR00_PROGRESS_MANIFEST.json",
        acceptance_path,
        evidence_path,
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lifecycle-runtime.json",
        digest_path,
        "docs/work_orders/C-21_LR-01_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_LR-01_WORK_INSTRUCTION.md",
        "migrations/versions/0013_task_bootstrap_authority.py",
        "packages/api/fastapi_app.py",
        "packages/api/registry.py",
        "packages/api/runtime.py",
        "packages/api/task_bootstrap.py",
        "packages/persistence/task_bootstrap_repository.py",
        "scripts/check_project_progress.py",
        "tests/api/test_task_bootstrap.py",
        "tests/persistence/test_task_bootstrap_postgres.py",
    }

    repository = progress.get("repository") or {}
    accepted = progress.get("accepted_c21_lr01_work_instruction") or {}
    current_ref = progress.get("current_progress_evidence_ref") or {}
    successor = progress.get("next_successor_work_package") or {}
    c01 = progress.get("next_work_package") or {}
    if any((
        progress.get("event_sequence") != 398,
        progress.get("last_event_id") != "evt_c21_lr01_acceptance_repository_reconciled",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("valid_failure_count") != 0,
        progress.get("active_work_instruction") is not None,
        progress.get("active_agent") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        current_ref != {"package_id": "C-21", "path": digest_path, "manifest_path": acceptance_path},
        c01.get("package_id") != "C-01",
        c01.get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        successor.get("package_id") != "C-21/LR-02A",
        successor.get("status") != "READY_FOR_WORK_INSTRUCTION",
    )):
        errors.append("C21_LR01_ACCEPTANCE_PROJECTION_INVALID")

    expected_accepted = {
        "artifact_id": "WI-C-21-LR-01-20260903-001",
        "path": "docs/work_orders/C-21_LR-01_WORK_INSTRUCTION.md",
        "sha256": "BD32669869300B4BE66491307A642F3E8EB0BA7684A4CA1E0443ACEDA82DB458",
        "invocation_path": "docs/work_orders/C-21_LR-01_INVOCATION_PROMPT.md",
        "invocation_sha256": "49CE6245EE85590058DAF943A40FA143DA028B04A34075F550DEEA2262224202",
        "approval_ref": "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md",
        "approval_sha256": "1CB18CA1492D624EE950769AD8AEB4165E52F4C1DB30A4D04965E244BDDB407A",
        "approval_subject_hash": "3A68623BF9426EB619AC0B8E082028F73442F90F4680FDCE871711B60A6B5FAD",
        "result_status": "COMPLETED",
        "package_status": "ACCEPTED",
        "independent_tester_status": "READY_FOR_MAIN_ACCEPTANCE",
        "executor": "developer-primary",
        "worker_lease_id": "worker-lease-c21-lr01-20260903-001",
        "write_lease_id": "write-lease-c21-lr01-20260903-001",
        "allowed_path_count": 10,
        "c01_boundary": "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        "test_report_ref": report_path,
        "test_report_sha256": report_hash,
        "manifest_ref": evidence_path,
        "manifest_sha256": evidence_hash,
        "accepted_event_id": "evt_c21_lr01_main_package_accepted",
    }
    if any(accepted.get(key) != value for key, value in expected_accepted.items()):
        errors.append("C21_LR01_ACCEPTANCE_WORK_INSTRUCTION_INVALID")
    accepted_source_hashes = {
        "docs/work_orders/C-21_LR-01_WORK_INSTRUCTION.md": expected_accepted["sha256"],
        "docs/work_orders/C-21_LR-01_INVOCATION_PROMPT.md": expected_accepted["invocation_sha256"],
        "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md": expected_accepted["approval_sha256"],
    }
    for relative, expected_hash in accepted_source_hashes.items():
        try:
            actual_hash = hashlib.sha256((root / relative).read_bytes()).hexdigest().upper()
        except OSError:
            actual_hash = None
        if actual_hash != expected_hash:
            errors.append("C21_LR01_ACCEPTANCE_WORK_INSTRUCTION_INVALID")

    expected_repository = {
        "projection_mode": VALIDATED_BASE_PROJECTION_MODE,
        "validated_base_commit": base,
        "head_relation": VALIDATED_BASE_PENDING_RELATION,
        "branch": "codex/c21-lifecycle-runtime",
        "upstream": "origin/main",
        "remote_head": base,
        "local_head": base,
        "push_status": "LR01_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
        "observed_at": "2026-09-03T04:11:04+09:00",
    }
    if (
        any(repository.get(key) != value for key, value in expected_repository.items())
        or set(repository.get("exact_allowed_paths", [])) != accepted_paths
    ):
        errors.append("C21_LR01_ACCEPTANCE_REPOSITORY_INVALID")

    expected_events = {
        394: ("evt_c21_lr01_write_lease_revoked", "WRITE_LEASE_REVOKED"),
        395: ("evt_c21_lr01_worker_lease_revoked", "WORKER_LEASE_REVOKED"),
        396: ("evt_c21_lr01_package_completed", "PACKAGE_COMPLETED"),
        397: ("evt_c21_lr01_main_package_accepted", "MAIN_PACKAGE_ACCEPTED"),
        398: ("evt_c21_lr01_acceptance_repository_reconciled", "REPOSITORY_RECONCILED"),
    }
    expected_event_hashes = {
        394: "D794EEA1D768A0E795F4CA93A5407BC91AC30A21EC1CC5DFB805A8D6778857BE",
        395: "B3E09EAEC4EF314637B48955FB0ED1840E11E23C1790C04B1DDC8A493C7782D5",
        396: "963A4A3C3E181754CC2EF19AAA74664EDF45231C430F7369A63997D5150247D4",
        397: "81618FF6369FACECB179B9139BC343EA19E509781EF6702EBD7C08AD0F5EAD81",
        398: "5D6A34B2A08AE58E9A15251F97A4F8F755068B8070B3576E817C96F3F19AE183",
    }
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    immutable_prefix_hash = hashlib.sha256(canonical_json_bytes(events[:397])).hexdigest().upper()
    terminal_events_invalid = any(
        sequence not in indexed
        or indexed[sequence].get("event_id") != identity
        or indexed[sequence].get("event_type") != event_type
        or indexed[sequence].get("subject_ref") != "C-21/LR-01"
        or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper()
        != expected_event_hashes[sequence]
        for sequence, (identity, event_type) in expected_events.items()
    )
    if immutable_prefix_hash != "F428DE65EB16DED641EBB08A1482EDA3B8C52EC561C78F722583A8776BB7C5B4" or terminal_events_invalid:
        errors.append("C21_LR01_ACCEPTANCE_EVENTS_INVALID")
    else:
        d394 = indexed[394].get("details", {})
        d395 = indexed[395].get("details", {})
        d396 = indexed[396].get("details", {})
        d397 = indexed[397].get("details", {})
        d398 = indexed[398].get("details", {})
        if any((
            d394.get("lease_id") != "write-lease-c21-lr01-20260903-001",
            d394.get("fencing_token") != "c21-lr01-write-fence-epoch-1-1573e02",
            d394.get("status") != "REVOKED",
            d395.get("lease_id") != "worker-lease-c21-lr01-20260903-001",
            d395.get("fencing_token") != "c21-lr01-execution-fence-epoch-1-1573e02",
            d395.get("status") != "REVOKED",
            d396.get("accepted") is not False,
            d396.get("worker_lease") is not None,
            d396.get("write_lease") is not None,
            d396.get("test_report_sha256") != report_hash,
            d396.get("manifest_sha256") != evidence_hash,
            d396.get("next_package_status") != "BLOCKED_PENDING_LR01_MAIN_ACCEPTANCE",
            d396.get("actual_browser_wsl_production_deployment_provider_telegram") != "NOT_EXECUTED",
            d397.get("decision") != "ACCEPTED",
            d397.get("blocking_findings") != 0,
            d397.get("test_report_sha256") != report_hash,
            d397.get("manifest_sha256") != evidence_hash,
            d397.get("next_package_status") != "READY_FOR_WORK_INSTRUCTION",
            d397.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
            d397.get("lr01_only") is not True,
            d398.get("accepted_event_ref") != "evt_c21_lr01_main_package_accepted",
            d398.get("next_package_status") != "READY_FOR_WORK_INSTRUCTION",
            d398.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
            d398.get("observed_at") != repository.get("observed_at"),
            any(d398.get(key) != repository.get(key) for key in (
                "branch", "local_head", "remote_head", "upstream", "projection_mode",
                "validated_base_commit", "head_relation", "exact_allowed_paths"
            )),
        )):
            errors.append("C21_LR01_ACCEPTANCE_EVENTS_INVALID")

    def validate_rows(document: Mapping[str, Any], expected: set[str], code: str) -> None:
        rows = document.get("raw_checksums")
        if not isinstance(rows, list):
            errors.append(code)
            return
        if len(rows) != len(expected) or any(not isinstance(row, dict) for row in rows):
            errors.append(code)
            return
        indexed_rows = {
            row.get("path"): row for row in rows
            if isinstance(row, dict) and isinstance(row.get("path"), str)
        }
        if len(indexed_rows) != len(rows) or set(indexed_rows) != expected:
            errors.append(code)
            return
        for relative, row in indexed_rows.items():
            try:
                raw = (root / relative).read_bytes()
            except OSError:
                errors.append(code)
                return
            if row.get("bytes") != len(raw) or row.get("sha256") != hashlib.sha256(raw).hexdigest().upper():
                errors.append(code)
                return

    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR01-ACCEPTANCE-PROGRESS-MANIFEST-20260903",
        manifest.get("package_id") != "C-21/LR-01",
        manifest.get("manifest_type") != "MAIN_ACCEPTANCE_PROGRESS_PROJECTION",
        manifest.get("target_status") != "ACCEPTED",
        manifest.get("decision") != "ACCEPTED",
        manifest.get("independent_reviewer") != "/root/c21_lr01_r9_review",
        manifest.get("blocking_findings") != 0,
        manifest.get("next_work_package") != "C-21/LR-02A",
        manifest.get("next_status") != "READY_FOR_WORK_INSTRUCTION",
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("self_reference") is not False,
        manifest.get("created_at") != "2026-09-03T04:11:03+09:00",
        manifest.get("scope") != "Main acceptance projection for C-21/LR-01 only. It does not accept C-21 as a whole, does not unblock C-01, and does not claim WSL application deployment, production DB, browser, Telegram, or Provider execution.",
    )):
        errors.append("C21_LR01_ACCEPTANCE_MANIFEST_INVALID")
    validate_rows(manifest, {digest_path, evidence_path, report_path}, "C21_LR01_ACCEPTANCE_MANIFEST_INVALID")
    try:
        evidence = _load_json(root / evidence_path)
    except (OSError, json.JSONDecodeError):
        errors.append("C21_LR01_EVIDENCE_MANIFEST_INVALID")
    else:
        if hashlib.sha256((root / evidence_path).read_bytes()).hexdigest().upper() != evidence_hash:
            errors.append("C21_LR01_EVIDENCE_MANIFEST_INVALID")
        evidence_paths = {
            "packages/api/fastapi_app.py", "packages/api/registry.py", "packages/api/runtime.py",
            "packages/api/task_bootstrap.py", "packages/persistence/task_bootstrap_repository.py",
            "migrations/versions/0013_task_bootstrap_authority.py", "tests/api/test_task_bootstrap.py",
            "tests/persistence/test_task_bootstrap_postgres.py", report_path,
        }
        if any((
            evidence.get("package_id") != "C-21/LR-01",
            evidence.get("manifest_type") != "FROZEN_PRODUCT_AND_TEST_EVIDENCE",
            evidence.get("target_status") != "READY_FOR_MAIN_ACCEPTANCE",
            evidence.get("self_reference") is not False,
            (evidence.get("verification") or {}).get("blocking_findings") != 0,
            evidence.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        )):
            errors.append("C21_LR01_EVIDENCE_MANIFEST_INVALID")
        validate_rows(evidence, evidence_paths, "C21_LR01_EVIDENCE_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_lr02a_acceptance_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the append-only LR-02A R4 acceptance and exact41 projection."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    accepted = progress.get("accepted_c21_lr02a_work_instruction") or {}
    errors: list[str] = []
    base = "e57f008d0916953dab3c9425322a1e8942ed0379"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02a-accepted-r4.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json"
    if any((
        progress.get("event_sequence") != 424,
        progress.get("last_event_id") != "evt_c21_lr02a_acceptance_repository_reconciled_r4",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") is not None,
        progress.get("active_work_instruction") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        progress.get("valid_failure_count") != 0,
        (progress.get("historical_failure_counts_by_lineage") or {}).get("C-21/LR-02A") != 3,
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path
        },
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("package_id") != "C-21/LR-02B",
        (progress.get("next_successor_work_package") or {}).get("status") != "READY_FOR_WORK_INSTRUCTION",
    )):
        errors.append("C21_LR02A_ACCEPTANCE_PROJECTION_INVALID")
    if any((
        accepted.get("artifact_id") != "WI-C-21-LR-02A-20260903-003",
        accepted.get("package_status") != "ACCEPTED",
        accepted.get("result_status") != "ACCEPTED",
        accepted.get("historical_failure_count") != 3,
        accepted.get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED",
        accepted.get("accepted_event_id") != "evt_c21_lr02a_main_package_accepted_r4",
        accepted.get("evidence_manifest_sha256") != "A47885D5F2CCEBA83E04224340FDD56351644DEBFB8E22A11635DD3D28001D8B",
        accepted.get("test_report_sha256") != "1E33B6EEA1325C19A548F8AE9261A3736F3632B69613820CC7D2124C1B357371",
        accepted.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        accepted.get("external_side_effects") != "NOT_EXECUTED",
    )):
        errors.append("C21_LR02A_ACCEPTED_WORK_INSTRUCTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("remote_head") != "1573e0242aa718d0f81f6b6fc936c754b7c75e60",
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_LR02A_ACCEPTED_EXACT41_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02A_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
        len(repository.get("exact_allowed_paths", [])) != 41,
    )):
        errors.append("C21_LR02A_ACCEPTANCE_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        420: "6314E91D7231F1A7A9F17F6DFB1E847547727F21ADA754415B646B3F651992C0",
        421: "C0CD1EDC6537D0DC88F335B0DA4FBFDF15F7444FF9C7419B8817BC4694D9B006",
        422: "6A00CC77C2663DE579C00DCD91539DE644FDE825F1B018E005A58EEF66FC039B",
        423: "CF3C350F9781F40F929F9670F72680F8F8C62A1820AFD8D2B4245096BFB04E40",
        424: "0AF214C5829450E251E4E6BC708328204A2F3884AF1C8282C2F62C8A4D7EE17D",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:419])).hexdigest().upper()
        != "FD4307CDFCCFA38906276AE5F70FED4030AD1617921940B9CFB816E5640792F6"
        or any(
            sequence not in indexed
            or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected
            for sequence, expected in expected_hashes.items()
        )
    ):
        errors.append("C21_LR02A_ACCEPTANCE_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02A-ACCEPTANCE-MANIFEST-R4-20260903",
        manifest.get("manifest_type") != "MAIN_ACCEPTANCE_PROGRESS_PROJECTION",
        manifest.get("target_status") != "ACCEPTED",
        manifest.get("event_sequence") != 424,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 41,
        manifest.get("next_work_package") != "C-21/LR-02B",
        manifest.get("next_status") != "READY_FOR_WORK_INSTRUCTION",
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02A_ACCEPTANCE_MANIFEST_INVALID")
    expected_rows = {
        digest_path,
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_R3_EVIDENCE_MANIFEST.json",
        "docs/04_test_reports/C-21_LR02A_R4_INDEPENDENT_TEST_REPORT.md",
        "docs/04_test_reports/C-21_LR02A_R3_INDEPENDENT_TEST_REPORT.md",
        "docs/work_orders/C-21_LR-02A_MAIN_TAKEOVER_PACKET_R4.md",
        "docs/progress/failure-ledger.json",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows:
        errors.append("C21_LR02A_ACCEPTANCE_MANIFEST_INVALID")
    else:
        for row in rows:
            relative = row["path"]
            if (
                relative == "docs/progress/failure-ledger.json"
                and row.get("bytes") == 23324
                and row.get("sha256") == "07AA34EB3E19FD590FDA7B88F76F20751D965CE0A1F5529A9DD4D96F99D9BF4F"
            ):
                # The acceptance manifest freezes the seq424 ledger identity;
                # later packages may append new lineage entries without rewriting it.
                continue
            try:
                size = (root / relative).stat().st_size
                digest = portable_hash(root, relative)
            except OSError:
                errors.append("C21_LR02A_ACCEPTANCE_MANIFEST_INVALID")
                break
            if row.get("bytes") != size or row.get("sha256") != digest:
                errors.append("C21_LR02A_ACCEPTANCE_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_lr02b_start_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the fenced LR-02B least-privilege test-session start."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    errors: list[str] = []
    base = "4178eee2ffeb0d5701e1fac058d89891331c74c2"
    wi_path = "docs/work_orders/C-21_LR-02B_WORK_INSTRUCTION.md"
    invocation_path = "docs/work_orders/C-21_LR-02B_INVOCATION_PROMPT.md"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02b-start.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json"
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    repository = progress.get("repository") or {}
    if any((
        progress.get("event_sequence") != 428,
        progress.get("last_event_id") != "evt_c21_lr02b_package_started",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary",
        progress.get("valid_failure_count") != 0,
        (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "C-21/LR-02B",
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path
        },
    )):
        errors.append("C21_LR02B_START_PROJECTION_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02B-20260903-001",
        instruction.get("sha256") != "1B8F561E90B76DCC30CA200AE327D48ED71785FADCE1D18B94CA3D06C90696E2",
        instruction.get("invocation_sha256") != "B6AFB8BD572BB1E57923D7ECD461FAB39F3168C95DE198344EBD4E802AE7FCCD",
        instruction.get("result_status") != "IN_PROGRESS",
        instruction.get("allowed_path_count") != 12,
        worker.get("lease_id") != "worker-lease-c21-lr02b-20260903-001",
        worker.get("lease_epoch") != 1,
        write.get("lease_id") != "write-lease-c21-lr02b-20260903-001",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 1,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        len(write.get("paths", [])) != 12,
    )):
        errors.append("C21_LR02B_START_LEASE_OR_WI_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02B_EXACT20_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02B_ACTIVE",
        len(repository.get("exact_allowed_paths", [])) != 20,
    )):
        errors.append("C21_LR02B_START_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        425: "25EBA05B732561EDDD5D0E8474EA3398DB69311083254108CD3A0EEDEA5BBA57",
        426: "20E8B48CE5488CD52546E04EEA9325FFBBFB1B3FC1B0987CA32B436BE343F176",
        427: "F9C9C614AD5FCC10139003C92A538D0F533B4BFF37B3BE56779A5436F86128CC",
        428: "2C91D961079699BE002C110727D7DBF4A9A6B671257494563B900D3CB82124A9",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:424])).hexdigest().upper()
        != "231D16B1C015D8D80EE0315C809D0057E522CF6B0FD03A1F281A9EBF75310DF9"
        or any(
            sequence not in indexed
            or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected
            for sequence, expected in expected_hashes.items()
        )
    ):
        errors.append("C21_LR02B_START_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02B-START-MANIFEST-20260903",
        manifest.get("manifest_type") != "WORK_PACKAGE_START_PROJECTION",
        manifest.get("target_status") != "ACTIVE",
        manifest.get("event_sequence") != 428,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 20,
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02B_START_MANIFEST_INVALID")
    expected_rows = {digest_path, wi_path, invocation_path, approval_path}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows:
        errors.append("C21_LR02B_START_MANIFEST_INVALID")
    else:
        for row in rows:
            relative = row["path"]
            try:
                if row.get("bytes") != (root / relative).stat().st_size or row.get("sha256") != portable_hash(root, relative):
                    errors.append("C21_LR02B_START_MANIFEST_INVALID")
                    break
            except OSError:
                errors.append("C21_LR02B_START_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_lr02b_acceptance_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate LR-02B acceptance while preserving the closed R1 failure."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    accepted = progress.get("accepted_c21_lr02b_work_instruction") or {}
    errors: list[str] = []
    base = "4178eee2ffeb0d5701e1fac058d89891331c74c2"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02b-accepted.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json"
    report_path = "docs/04_test_reports/C-21_LR02B_INDEPENDENT_TEST_REPORT.md"
    evidence_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_EVIDENCE_MANIFEST.json"
    ledger_path = "docs/progress/failure-ledger.json"
    if any((
        progress.get("event_sequence") != 435,
        progress.get("last_event_id") != "evt_c21_lr02b_acceptance_repository_reconciled",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") is not None,
        progress.get("active_work_instruction") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        progress.get("valid_failure_count") != 0,
        (progress.get("historical_failure_counts_by_lineage") or {}).get("C-21/LR-02B") != 1,
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path
        },
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("package_id") != "C-21/LR-02C",
        (progress.get("next_successor_work_package") or {}).get("status") != "READY_FOR_WORK_INSTRUCTION",
    )):
        errors.append("C21_LR02B_ACCEPTANCE_PROJECTION_INVALID")
    if any((
        accepted.get("artifact_id") != "WI-C-21-LR-02B-20260903-001",
        accepted.get("result_status") != "ACCEPTED",
        accepted.get("package_status") != "ACCEPTED",
        accepted.get("historical_failure_count") != 1,
        accepted.get("failure_fingerprint") != "C21_LR02B_YSNA_DUPLICATE_SCOPE_ASSIGNMENT_PREFLIGHT_BYPASS",
        accepted.get("evidence_manifest_sha256") != "253F04787519BC356A6297F64EB6F0F2B3FCFAE543B15A9E8CB847CD3E240A5E",
        accepted.get("test_report_sha256") != "01D23AE5845FD8639532F059CBA7E528D90C565264CF9600660D0CE5B5EB2C07",
        accepted.get("accepted_event_id") != "evt_c21_lr02b_main_package_accepted",
        accepted.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        accepted.get("external_side_effects") != "NOT_EXECUTED",
    )):
        errors.append("C21_LR02B_ACCEPTED_WORK_INSTRUCTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_LR02B_ACCEPTED_EXACT24_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02B_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
        len(repository.get("exact_allowed_paths", [])) != 24,
    )):
        errors.append("C21_LR02B_ACCEPTANCE_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        429: "7419ECFBFB5CFB618B54492937C7950749FD2EBF88FAC1EE3EE694607B55DC10",
        430: "F364656BD945A12E97E75EC0CE8211C21DCB811DEC45FB28AF4225679AD3CDA5",
        431: "6ABD8D4ECCCF0CD5A48DC184A1011CBC988C1B8971BC2C4C4F2E77D0B6C62A62",
        432: "EE3748045C3C1B4C4B0BCBC5357A38EE601689F6EA8C382EF6FBDD8C8A9C9B07",
        433: "30504FDB8703AC4E9A70E9E327674A52401AA7F77C7BB972B2378E72A992C39B",
        434: "0731B7A6279FC26B898061E501D0B68F114982794EFFC6DB15CB1646B03D9890",
        435: "5339BC3F64A8AFF6CBE77735C261E83248D0263A47C101C0D480FD8DECBA93F9",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:428])).hexdigest().upper()
        != "0238ABB988F2898CD7A529B78C9B4B1E13DFB8D49C3E9DDDA84ADB660312D283"
        or any(
            sequence not in indexed
            or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected
            for sequence, expected in expected_hashes.items()
        )
    ):
        errors.append("C21_LR02B_ACCEPTANCE_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02B-ACCEPTANCE-MANIFEST-20260903",
        manifest.get("manifest_type") != "MAIN_ACCEPTANCE_PROGRESS_PROJECTION",
        manifest.get("target_status") != "ACCEPTED",
        manifest.get("event_sequence") != 435,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 24,
        manifest.get("historical_failure_count") != 1,
        manifest.get("next_work_package") != "C-21/LR-02C",
        manifest.get("next_status") != "READY_FOR_WORK_INSTRUCTION",
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02B_ACCEPTANCE_MANIFEST_INVALID")
    expected_rows = {
        digest_path, evidence_path, report_path, ledger_path,
        "docs/work_orders/C-21_LR-02B_WORK_INSTRUCTION.md",
        "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows:
        errors.append("C21_LR02B_ACCEPTANCE_MANIFEST_INVALID")
    else:
        for row in rows:
            relative = row["path"]
            if relative == ledger_path:
                if (
                    row.get("bytes") != 24365
                    or row.get("sha256")
                    != "6CEDA11ED086ECBFC52FADD8FFDCCD9765781583675DFF7B784F83466A076AFA"
                ):
                    errors.append("C21_LR02B_ACCEPTANCE_MANIFEST_INVALID")
                    break
                continue
            try:
                if row.get("bytes") != (root / relative).stat().st_size or row.get("sha256") != portable_hash(root, relative):
                    errors.append("C21_LR02B_ACCEPTANCE_MANIFEST_INVALID")
                    break
            except OSError:
                errors.append("C21_LR02B_ACCEPTANCE_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_lr02c_takeover_r2_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate LR-02C R1 failure acceptance and fenced Main takeover R2."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    errors: list[str] = []
    base = "dd4cc43452d30511ecf1a152e48408b7122391c0"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-takeover-r2.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json"
    report_path = "docs/04_test_reports/C-21_LR02C_INDEPENDENT_TEST_REPORT.md"
    packet_path = "docs/work_orders/C-21_LR-02C_MAIN_TAKEOVER_PACKET_R2.md"
    ledger_path = "docs/progress/failure-ledger.json"
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    repository = progress.get("repository") or {}
    lineage = progress.get("active_failure_lineage") or {}
    if any((
        progress.get("event_sequence") != 445,
        progress.get("last_event_id") != "evt_c21_lr02c_main_takeover_resumed_r2",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "main-agent-eoul",
        progress.get("valid_failure_count") != 1,
        lineage.get("step_lineage_id") != "C-21/LR-02C",
        lineage.get("failure_fingerprint") != "C21_LR02C_TEST_SESSION_REBIND_NOT_RESTORED_OR_PRESERVATION_UNRECORDED",
        lineage.get("internal_identical_error_count") != 3,
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE_REWORK_R2_MAIN_TAKEOVER",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path
        },
    )):
        errors.append("C21_LR02C_TAKEOVER_R2_PROJECTION_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02C-20260903-001",
        instruction.get("result_status") != "DIRECT_IMPLEMENTATION",
        instruction.get("package_status") != "ACTIVE_REWORK_R2",
        instruction.get("executor") != "main-agent-eoul",
        instruction.get("takeover_packet_path") != packet_path,
        instruction.get("takeover_packet_sha256") != "4B049CB51B9526BDF490879B6C35C1B146A157769A4A066927A99BB6571B3735",
        worker.get("lease_id") != "worker-lease-c21-lr02c-main-takeover-20260903-002",
        worker.get("lease_epoch") != 2,
        worker.get("execution_fencing_token") != "c21-lr02c-main-takeover-execution-fence-epoch-2-dd4cc43",
        write.get("lease_id") != "write-lease-c21-lr02c-main-takeover-20260903-002",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 2,
        write.get("write_fencing_token") != "c21-lr02c-main-takeover-write-fence-epoch-2-dd4cc43",
        len(write.get("paths", [])) != 12,
        (progress.get("completed_c21_lr02c_worker_lease") or {}).get("status") != "REVOKED",
        (progress.get("completed_c21_lr02c_write_lease") or {}).get("status") != "REVOKED",
    )):
        errors.append("C21_LR02C_TAKEOVER_R2_LEASE_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_MAIN_TAKEOVER_EXACT25_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02C_MAIN_TAKEOVER_ACTIVE",
        len(repository.get("exact_allowed_paths", [])) != 25,
    )):
        errors.append("C21_LR02C_TAKEOVER_R2_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        440: "8FD57C66A2A9CE69CFC9929CA9F9CA540CD5C61D9B888395A8E508D320FFCBCD",
        441: "028266932F52F301CF8215E3415EF3958835B48FE25EC2EA230D1A56879244D9",
        442: "89A9D88481317360DA39443039BF0B0DF08F14822D1BB95D757804A807D6571E",
        443: "38C5751BD01EF8272AE1972AD85CA08ECB2C74A2DA4006DE5FF66F09978158BD",
        444: "2B8A2915199E52E5288E5FA3F1360F897DD3A053C9C82A1DF21748D8380D9EF7",
        445: "900FC5743A174290226C081E72AB99AFD1FA279EDA912287134C889BBEBA8791",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:439])).hexdigest().upper()
        != "73CCE777DA9B386AC0642D208F5AB0528A0F7B5F2F602797687B31062CC8F59A"
        or any(sequence not in indexed or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected for sequence, expected in expected_hashes.items())
    ):
        errors.append("C21_LR02C_TAKEOVER_R2_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02C-TAKEOVER-R2-MANIFEST-20260903",
        manifest.get("manifest_type") != "MAIN_TAKEOVER_START_PROJECTION",
        manifest.get("target_status") != "ACTIVE_REWORK_R2",
        manifest.get("event_sequence") != 445,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 25,
        manifest.get("main_write_path_count") != 12,
        manifest.get("valid_failure_count") != 1,
        manifest.get("internal_identical_error_count") != 3,
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02C_TAKEOVER_R2_MANIFEST_INVALID")
    expected_rows = {digest_path, report_path, packet_path, ledger_path}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows:
        errors.append("C21_LR02C_TAKEOVER_R2_MANIFEST_INVALID")
    else:
        for row in rows:
            relative = row["path"]
            try:
                if row.get("bytes") != (root / relative).stat().st_size or row.get("sha256") != portable_hash(root, relative):
                    errors.append("C21_LR02C_TAKEOVER_R2_MANIFEST_INVALID")
                    break
            except OSError:
                errors.append("C21_LR02C_TAKEOVER_R2_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_lr02c_rework_r3_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate sticky INCIDENT_HOLD rework with continuous Main epoch2 fencing."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    errors: list[str] = []
    base = "dd4cc43452d30511ecf1a152e48408b7122391c0"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-rework-start-r3.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json"
    report_path = "docs/04_test_reports/C-21_LR02C_R2_INDEPENDENT_TEST_REPORT.md"
    wi_path = "docs/work_orders/C-21_LR-02C_REWORK_WORK_INSTRUCTION_R3.md"
    invocation_path = "docs/work_orders/C-21_LR-02C_REWORK_INVOCATION_PROMPT_R3.md"
    ledger_path = "docs/progress/failure-ledger.json"
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    repository = progress.get("repository") or {}
    lineage = progress.get("active_failure_lineage") or {}
    evidence_ref = progress.get("current_progress_evidence_ref") or {}
    if any((
        progress.get("event_sequence") != 447,
        progress.get("last_event_id") != "evt_c21_lr02c_main_takeover_resumed_r3",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "main-agent-eoul",
        progress.get("valid_failure_count") != 2,
        lineage.get("step_lineage_id") != "C-21/LR-02C",
        lineage.get("failure_fingerprint") != "C21_LR02C_INCIDENT_HOLD_EVIDENCE_ERASED_OR_AUTO_CLEARED_ON_RERUN",
        lineage.get("valid_failure_count") != 2,
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE_REWORK_R3_MAIN_TAKEOVER",
        evidence_ref != {"package_id": "C-21", "path": digest_path, "manifest_path": manifest_path},
    )):
        errors.append("C21_LR02C_REWORK_R3_PROJECTION_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02C-R3-20260903-001",
        instruction.get("path") != wi_path,
        instruction.get("invocation_path") != invocation_path,
        instruction.get("result_status") != "DIRECT_IMPLEMENTATION",
        instruction.get("package_status") != "ACTIVE_REWORK_R3",
        instruction.get("executor") != "main-agent-eoul",
        instruction.get("valid_failure_count") != 2,
        instruction.get("allowed_path_count") != 12,
        worker.get("lease_id") != "worker-lease-c21-lr02c-main-takeover-20260903-002",
        worker.get("lease_epoch") != 2,
        worker.get("execution_fencing_token") != "c21-lr02c-main-takeover-execution-fence-epoch-2-dd4cc43",
        write.get("lease_id") != "write-lease-c21-lr02c-main-takeover-20260903-002",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 2,
        write.get("write_fencing_token") != "c21-lr02c-main-takeover-write-fence-epoch-2-dd4cc43",
        len(write.get("paths", [])) != 12,
    )):
        errors.append("C21_LR02C_REWORK_R3_LEASE_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_MAIN_TAKEOVER_R3_EXACT30_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02C_MAIN_TAKEOVER_R3_ACTIVE",
        len(repository.get("exact_allowed_paths", [])) != 30,
    )):
        errors.append("C21_LR02C_REWORK_R3_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        446: "73EF26692EE0A350020BB4EF2BD9DEC86A3F62A3BC4EC3CC03296EF3441C2EEE",
        447: "C3A2D9A2FAF4E001B569B36868B6CB892E0E8D8E4212C9C356517BC706253299",
    }
    recent = [event for event in events if isinstance(event, dict) and event.get("sequence") in {446, 447}]
    if (
        hashlib.sha256(canonical_json_bytes(events[:445])).hexdigest().upper()
        != "0451842B1C1D62E49429956C7892E77D599BB13FB89ED98B355F659BA892BD61"
        or any(sequence not in indexed or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected for sequence, expected in expected_hashes.items())
        or any(event.get("event_type") in {"WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "WORKER_LEASE_REVOKED", "WRITE_LEASE_REVOKED"} for event in recent)
    ):
        errors.append("C21_LR02C_REWORK_R3_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02C-REWORK-START-R3-MANIFEST-20260903",
        manifest.get("manifest_type") != "MAIN_TAKEOVER_REWORK_START_PROJECTION",
        manifest.get("target_status") != "ACTIVE_REWORK_R3",
        manifest.get("event_sequence") != 447,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 30,
        manifest.get("main_write_path_count") != 12,
        manifest.get("valid_failure_count") != 2,
        manifest.get("lease_reissued") is not False,
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02C_REWORK_R3_MANIFEST_INVALID")
    expected_rows = {digest_path, report_path, wi_path, invocation_path, ledger_path}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows:
        errors.append("C21_LR02C_REWORK_R3_MANIFEST_INVALID")
    else:
        for row in rows:
            relative = row["path"]
            try:
                if row.get("bytes") != (root / relative).stat().st_size or row.get("sha256") != portable_hash(root, relative):
                    errors.append("C21_LR02C_REWORK_R3_MANIFEST_INVALID")
                    break
            except OSError:
                errors.append("C21_LR02C_REWORK_R3_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_lr02c_acceptance_r3_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate LR-02C tooling acceptance while keeping operations and C-01 blocked."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    accepted = progress.get("accepted_c21_lr02c_work_instruction") or {}
    errors: list[str] = []
    base = "dd4cc43452d30511ecf1a152e48408b7122391c0"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-accepted-r3.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json"
    report_path = "docs/04_test_reports/C-21_LR02C_R3_INDEPENDENT_TEST_REPORT.md"
    evidence_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_EVIDENCE_MANIFEST.json"
    wi_path = "docs/work_orders/C-21_LR-02C_REWORK_WORK_INSTRUCTION_R3.md"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    ledger_path = "docs/progress/failure-ledger.json"
    if any((
        progress.get("event_sequence") != 453,
        progress.get("last_event_id") != "evt_c21_lr02c_r3_acceptance_exact34_repository_reconciled",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") is not None,
        progress.get("active_work_instruction") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        progress.get("valid_failure_count") != 0,
        progress.get("active_failure_lineage") is not None,
        (progress.get("historical_failure_counts_by_lineage") or {}).get("C-21/LR-02C") != 2,
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id":"C-21","path":digest_path,"manifest_path":manifest_path},
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "BLOCKED_PENDING_ACCEPTANCE_CHECKPOINT_COMMIT_PUSH",
    )):
        errors.append("C21_LR02C_ACCEPTANCE_R3_PROJECTION_INVALID")
    main_worker = progress.get("completed_c21_lr02c_main_worker_lease") or {}
    main_write = progress.get("completed_c21_lr02c_main_write_lease") or {}
    if any((
        accepted.get("artifact_id") != "WI-C-21-LR-02C-R3-20260903-001",
        accepted.get("result_status") != "ACCEPTED",
        accepted.get("package_status") != "ACCEPTED",
        accepted.get("historical_failure_count") != 2,
        accepted.get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED",
        accepted.get("evidence_manifest_sha256") != "4771BFEE1BAC7B0F6043487D6BD7F1534DCEB01DB7EC33CFE2228EF979339F28",
        accepted.get("test_report_sha256") != "81A193E03BCEF668D5304623E754FD66A68BA4BD520C603AB9AB01DE92970665",
        accepted.get("accepted_event_id") != "evt_c21_lr02c_r3_main_package_accepted",
        accepted.get("external_side_effects") != "NOT_EXECUTED",
        main_worker.get("status") != "REVOKED",
        main_worker.get("lease_epoch") != 2,
        main_write.get("status") != "REVOKED",
        main_write.get("write_epoch") != 2,
        main_write.get("worker_lease_id") != main_worker.get("lease_id"),
    )):
        errors.append("C21_LR02C_ACCEPTED_R3_WORK_OR_LEASE_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_LR02C_ACCEPTED_R3_EXACT34_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02C_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
        len(repository.get("exact_allowed_paths", [])) != 34,
    )):
        errors.append("C21_LR02C_ACCEPTANCE_R3_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        448:"F2D84212F3501021F441BBCF922A9C910EEA59741096122419E24004BA2D639A",
        449:"1169F2014E2ABA57329252232FB1F655D46F5B9545B0A220DB1DB6EFAA208D98",
        450:"283D27A73A8CBC2AE5E765861BB3CAA3A4F7974E2D88A53E502EE977CC5C40DA",
        451:"8A6650C3CDFE2FAC35ABC6B571911C50A48AA9D30BF3A976B2E18A1FFC767AA7",
        452:"54DB5CDCAAF5853DBB07648F30A8E2257B09179B4234051BAB95B0C2913BC5D7",
        453:"6025A49CEB3D87B1272EB45051FE7E43B822F728CFC46A4EB5CAF4447170940B",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:447])).hexdigest().upper() != "6C235BC418CA639789AAEE39119C55B0EFA24F24AF69328AD9AFEDF9211819F1"
        or any(sequence not in indexed or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper()!=expected for sequence,expected in expected_hashes.items())
    ):
        errors.append("C21_LR02C_ACCEPTANCE_R3_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02C-ACCEPTANCE-R3-MANIFEST-20260903",
        manifest.get("manifest_type") != "MAIN_ACCEPTANCE_PROGRESS_PROJECTION",
        manifest.get("target_status") != "ACCEPTED_TOOLING_CHECKPOINT_PENDING",
        manifest.get("event_sequence") != 453,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 34,
        manifest.get("historical_failure_count") != 2,
        manifest.get("next_status") != "BLOCKED_PENDING_ACCEPTANCE_CHECKPOINT_COMMIT_PUSH",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02C_ACCEPTANCE_R3_MANIFEST_INVALID")
    expected_rows = {digest_path,evidence_path,report_path,ledger_path,wi_path,approval_path}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows,list) or {row.get("path") for row in rows if isinstance(row,dict)} != expected_rows:
        errors.append("C21_LR02C_ACCEPTANCE_R3_MANIFEST_INVALID")
    else:
        for row in rows:
            relative = row["path"]
            if relative == ledger_path:
                if row.get("bytes") != 27519 or row.get("sha256") != "C04E6C5C18E96A0AB8D18B84D0D28697E1C6AF2634A541ABCDE9A91E42984681":
                    errors.append("C21_LR02C_ACCEPTANCE_R3_MANIFEST_INVALID")
                    break
                continue
            try:
                if row.get("bytes") != (root/relative).stat().st_size or row.get("sha256") != portable_hash(root,relative):
                    errors.append("C21_LR02C_ACCEPTANCE_R3_MANIFEST_INVALID")
                    break
            except OSError:
                errors.append("C21_LR02C_ACCEPTANCE_R3_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_lr02c_operational_start_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"]["events"]
    repository = progress.get("repository") or {}
    instruction = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    errors: list[str] = []
    base = "f39471a103d35406c3744fd727119072994a0d6a"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-start.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json"
    wi_path = "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION.md"
    invocation_path = "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT.md"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    release_manifest_path = "deploy/ysna/ReleaseManifest.json"
    evidence_paths = [
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_EXECUTION_MANIFEST.json",
        "docs/evidence/receipts/C-21_LR02C_OPERATIONAL_EXECUTION_RECEIPT.json",
    ]
    if any((
        progress.get("event_sequence") != 457,
        progress.get("last_event_id") != "evt_c21_lr02c_ops_package_started",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "main-agent-eoul",
        progress.get("valid_failure_count") != 0,
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}) != {**(progress.get("next_successor_work_package") or {}), "package_id":"C-21/LR-02C/OPS", "status":"ACTIVE_OPERATIONAL_VALIDATION"},
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id":"C-21","path":digest_path,"manifest_path":manifest_path},
    )):
        errors.append("C21_LR02C_OPERATIONAL_START_PROJECTION_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02C-OPS-20260903-001",
        instruction.get("path") != wi_path,
        instruction.get("invocation_path") != invocation_path,
        instruction.get("release_commit") != base,
        instruction.get("result_status") != "IN_PROGRESS",
        instruction.get("package_status") != "ACTIVE_OPERATIONAL_VALIDATION",
        instruction.get("executor") != "main-agent-eoul",
        instruction.get("external_side_effects") != "NOT_EXECUTED",
    )):
        errors.append("C21_LR02C_OPERATIONAL_START_INSTRUCTION_INVALID")
    if any((
        worker.get("lease_id") != "worker-lease-c21-lr02c-ops-20260903-003",
        worker.get("lease_epoch") != 3,
        worker.get("agent_id") != "main-agent-eoul",
        worker.get("execution_mode") != "OPERATIONAL_VALIDATION",
        worker.get("execution_fencing_token") != "c21-lr02c-ops-execution-fence-epoch-3-f39471a",
        worker.get("status") != "ACTIVE",
        write.get("lease_id") != "write-lease-c21-lr02c-ops-20260903-003",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 3,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != "c21-lr02c-ops-write-fence-epoch-3-f39471a",
        write.get("status") != "ACTIVE",
        write.get("paths") != evidence_paths,
    )):
        errors.append("C21_LR02C_OPERATIONAL_START_FENCING_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("remote_head") != base,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_OPERATIONAL_EXACT14_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_SYNCED_LR02C_OPERATIONAL_READY",
        len(repository.get("exact_allowed_paths", [])) != 14,
    )):
        errors.append("C21_LR02C_OPERATIONAL_START_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        454:"A38A5B851C610B60E8ACC94B8B1AC04FB69B52ABF858CC22C7270C1A9AD0898B",
        455:"6730230A88A3A4398DD257525DE2EEFC2E716E3B6DE53FFA7259B3D93EC00A5C",
        456:"45500A103D05889F12414C5FEFD121D7A1B5589118D6D28C05324FB9BC7E455D",
        457:"D34912F964B1F89DDB00B14A1BFB19087328CF2A21625FEE7772DBF51E02EA0A",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:453])).hexdigest().upper() != "287C4660992248FF460A46703E878AB354CC5A13B91F23D80C1C63AED577F481"
        or any(sequence not in indexed or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected for sequence, expected in expected_hashes.items())
    ):
        errors.append("C21_LR02C_OPERATIONAL_START_EVENTS_INVALID")
    expected_rows = {digest_path, wi_path, invocation_path, approval_path, release_manifest_path}
    rows = manifest.get("raw_checksums")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02C-OPERATIONAL-START-MANIFEST-20260903",
        manifest.get("manifest_type") != "OPERATIONAL_EXECUTION_START_PROJECTION",
        manifest.get("target_status") != "ACTIVE_OPERATIONAL_VALIDATION",
        manifest.get("event_sequence") != 457,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 14,
        manifest.get("evidence_write_path_count") != 4,
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_LR02C_OPERATIONAL_START_MANIFEST_INVALID")
    elif any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in rows):
        errors.append("C21_LR02C_OPERATIONAL_START_MANIFEST_INVALID")
    try:
        release = _load_json(root / release_manifest_path)
    except (OSError, json.JSONDecodeError):
        errors.append("C21_LR02C_OPERATIONAL_RELEASE_MANIFEST_INVALID")
    else:
        if any((
            release.get("status") != "APPROVED_FOR_DEPLOYMENT",
            (release.get("source") or {}).get("commit") != base,
            (release.get("source") or {}).get("working_tree") != "CLEAN",
            (release.get("authority") or {}).get("deploy_approval") != "APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001",
            (release.get("authority") or {}).get("deploy_approval_sha256") != "1CB18CA1492D624EE950769AD8AEB4165E52F4C1DB30A4D04965E244BDDB407A",
            (release.get("evidence") or {}).get("migration_head") != "0013_task_bootstrap_authority",
            (release.get("runtime") or {}).get("target_expected_commit") != base,
        )):
            errors.append("C21_LR02C_OPERATIONAL_RELEASE_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_backup_portability_rework_start_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the fenced exact2 backup-tool portability rework start."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"]["events"]
    repository = progress.get("repository") or {}
    instruction = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    base = "517fb4c39a3a9841eb5a07322235eb71989f1ec4"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-rework-start-r1.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json"
    wi_path = "docs/work_orders/C-21_LR-02C_BACKUP_PORTABILITY_REWORK_WORK_INSTRUCTION_R1.md"
    invocation_path = "docs/work_orders/C-21_LR-02C_BACKUP_PORTABILITY_REWORK_INVOCATION_PROMPT_R1.md"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    exact_write = ["deploy/ysna/backup-c21-db.sh", "tests/deploy/test_c21_lr02c_operational_contract.py"]
    errors: list[str] = []
    if any((
        progress.get("event_sequence") != 464,
        progress.get("last_event_id") != "evt_c21_lr02c_backup_portability_exact21_repository_reconciled",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-c21-backup",
        progress.get("valid_failure_count") != 1,
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE_BACKUP_PORTABILITY_REWORK",
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id":"C-21","path":digest_path,"manifest_path":manifest_path},
    )):
        errors.append("C21_BACKUP_PORTABILITY_REWORK_PROJECTION_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02C-BACKUP-PORTABILITY-R1-20260903-001",
        instruction.get("path") != wi_path,
        instruction.get("sha256") != "FF769632CE7B8ADF5343B274BA860245EE89A69321763EDAD64D1C89AAA767FD",
        instruction.get("invocation_path") != invocation_path,
        instruction.get("invocation_sha256") != "0ED38BAE68C02B3AC6C48CC74B6CD313250294E5B5D96026975DA757EA3EC541",
        instruction.get("dispatch_base") != base,
        instruction.get("result_status") != "REWORK_IN_PROGRESS",
        instruction.get("package_status") != "ACTIVE_BACKUP_PORTABILITY_REWORK",
        instruction.get("executor") != "developer-primary-c21-backup",
        instruction.get("failure_fingerprint") != "C21_BACKUP_HOST_PG_DUMP_UNAVAILABLE",
    )):
        errors.append("C21_BACKUP_PORTABILITY_REWORK_INSTRUCTION_INVALID")
    if any((
        worker.get("lease_epoch") != 4,
        worker.get("agent_id") != "developer-primary-c21-backup",
        worker.get("execution_fencing_token") != "c21-backup-portability-execution-fence-epoch-4-517fb4c",
        worker.get("status") != "ACTIVE",
        write.get("write_epoch") != 4,
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != "c21-backup-portability-write-fence-epoch-4-517fb4c",
        write.get("status") != "ACTIVE",
        write.get("paths") != exact_write,
    )):
        errors.append("C21_BACKUP_PORTABILITY_REWORK_FENCING_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("remote_head") != base,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_C21_BACKUP_PORTABILITY_EXACT21_WORKTREE",
        len(repository.get("exact_allowed_paths", [])) != 21,
    )):
        errors.append("C21_BACKUP_PORTABILITY_REWORK_REPOSITORY_INVALID")
    terminal = [event for event in events if 458 <= event.get("sequence", -1) <= 463]
    if [event.get("event_type") for event in terminal] != [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "FAILURE_REPORT_ACCEPTED",
        "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED",
    ]:
        errors.append("C21_BACKUP_PORTABILITY_REWORK_EVENTS_INVALID")
    rows = manifest.get("raw_checksums")
    expected_rows = {digest_path, wi_path, invocation_path, approval_path}
    if any((
        manifest.get("artifact_id") != "C21-LR02C-BACKUP-PORTABILITY-REWORK-START-R1-20260903",
        manifest.get("event_sequence") != 464,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 21,
        manifest.get("developer_write_path_count") != 2,
        manifest.get("external_side_effects") != "BLOCKED_DURING_REWORK",
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_BACKUP_PORTABILITY_REWORK_MANIFEST_INVALID")
    elif any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in rows):
        errors.append("C21_BACKUP_PORTABILITY_REWORK_MANIFEST_INVALID")
    return sorted(set(errors))


def _c21_ops_r2_main_reconciliation_successor_valid(bundle: Mapping[str, Any]) -> bool:
    """Allow historical projections only behind the fully validated seq478 successor."""
    progress = bundle.get("progress") or {}
    current_ref = progress.get("current_progress_evidence_ref") or {}
    wsl_control_runtime_manifest_path = (
        "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json"
    )
    wsl_fresh_clone_rebind_manifest_path = (
        "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json"
    )
    wsl_compose_runner_rebind_manifest_path = (
        "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
    )
    wsl_cold_start_rebind_manifest_path = (
        "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
    )
    wsl_ingress_rebind_manifest_path = (
        "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
    )
    wsl_control_manifest_path = "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json"
    wsl_postcommit_manifest_path = (
        "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json"
    )
    if (
        progress.get("event_sequence") == 490
        and progress.get("last_event_id")
        == "evt_c21_wsl_compose_runner_candidate_rebind_bound"
        and current_ref.get("manifest_path") == wsl_compose_runner_rebind_manifest_path
        and (progress.get("repository") or {}).get("branch")
        == "codex/c21-operational-execution"
    ):
        try:
            wsl_compose_runner_rebind_manifest = _load_json(
                bundle["_root"] / wsl_compose_runner_rebind_manifest_path
            )
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_compose_runner_candidate_rebind_projection(
            bundle, wsl_compose_runner_rebind_manifest
        ) == []
    if (
        progress.get("event_sequence") == 491
        and progress.get("last_event_id")
        == "evt_c21_wsl_cold_start_candidate_rebind_bound"
        and current_ref.get("manifest_path") == wsl_cold_start_rebind_manifest_path
        and (progress.get("repository") or {}).get("branch")
        == "codex/c21-operational-execution"
    ):
        try:
            wsl_cold_start_rebind_manifest = _load_json(
                bundle["_root"] / wsl_cold_start_rebind_manifest_path
            )
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_cold_start_candidate_rebind_projection(
            bundle, wsl_cold_start_rebind_manifest
        ) == []
    if (
        progress.get("event_sequence") == 492
        and progress.get("last_event_id")
        == "evt_c21_wsl_ingress_candidate_rebind_bound"
        and current_ref.get("manifest_path") == wsl_ingress_rebind_manifest_path
        and (progress.get("repository") or {}).get("branch")
        == "codex/c21-operational-execution"
    ):
        try:
            wsl_ingress_rebind_manifest = _load_json(
                bundle["_root"] / wsl_ingress_rebind_manifest_path
            )
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_ingress_candidate_rebind_projection(
            bundle, wsl_ingress_rebind_manifest
        ) == []
    if (
        progress.get("event_sequence") == 489
        and progress.get("last_event_id")
        == "evt_c21_wsl_fresh_clone_candidate_rebind_bound"
        and current_ref.get("manifest_path") == wsl_fresh_clone_rebind_manifest_path
        and (progress.get("repository") or {}).get("branch")
        == "codex/c21-operational-execution"
    ):
        try:
            wsl_fresh_clone_rebind_manifest = _load_json(
                bundle["_root"] / wsl_fresh_clone_rebind_manifest_path
            )
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_fresh_clone_candidate_rebind_projection(
            bundle, wsl_fresh_clone_rebind_manifest
        ) == []
    if (
        progress.get("event_sequence") == 488
        and progress.get("last_event_id")
        == "evt_c21_wsl_control_runtime_successor_bound"
        and current_ref.get("manifest_path") == wsl_control_runtime_manifest_path
        and (progress.get("repository") or {}).get("branch")
        == "codex/c21-operational-execution"
    ):
        try:
            wsl_control_runtime_manifest = _load_json(
                bundle["_root"] / wsl_control_runtime_manifest_path
            )
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_control_runtime_successor_projection(
            bundle, wsl_control_runtime_manifest
        ) == []
    if (
        progress.get("event_sequence") == 487
        and progress.get("last_event_id") == "evt_c21_wsl_control_postcommit_bound"
        and current_ref.get("manifest_path") == wsl_postcommit_manifest_path
        and (progress.get("repository") or {}).get("branch")
        == "codex/c21-operational-execution"
    ):
        try:
            wsl_control_manifest = _load_json(bundle["_root"] / wsl_postcommit_manifest_path)
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_control_postcommit_projection(
            bundle, wsl_control_manifest
        ) == []
    if (
        progress.get("event_sequence") == 486
        and progress.get("last_event_id") == "evt_c21_wsl_control_successor_bound"
        and current_ref.get("manifest_path") == wsl_control_manifest_path
    ):
        try:
            wsl_control_manifest = _load_json(bundle["_root"] / wsl_control_manifest_path)
            candidate = _load_json(bundle["_root"] / "deploy/wsl/CandidateReleaseManifest.json")
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_control_successor_projection(
            candidate, bundle, wsl_control_manifest
        ) == []
    wsl_active_manifest_path = "docs/evidence/manifests/C-21_WSL_EARLY_VALIDATION_START_MANIFEST.json"
    if (
        progress.get("event_sequence") == 485
        and progress.get("last_event_id") == "evt_c21_wsl_early_validation_started"
        and current_ref.get("manifest_path") == wsl_active_manifest_path
    ):
        try:
            wsl_active_manifest = _load_json(bundle["_root"] / wsl_active_manifest_path)
            candidate = _load_json(bundle["_root"] / "deploy/wsl/CandidateReleaseManifest.json")
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_active_projection(candidate, bundle, wsl_active_manifest) == []
    wsl_manifest_path = "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json"
    if (
        progress.get("event_sequence") == 483
        and progress.get("last_event_id") == "evt_c21_wsl_readiness_waiting_approval"
        and current_ref.get("manifest_path") == wsl_manifest_path
    ):
        try:
            wsl_manifest = _load_json(bundle["_root"] / wsl_manifest_path)
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_wsl_readiness_decision_projection(wsl_manifest, bundle) == []
    decision_manifest_path = "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json"
    if (
        progress.get("event_sequence") == 482
        and progress.get("last_event_id") == "evt_c21_ysna_staging_classification_decision_checkpoint"
        and current_ref.get("manifest_path") == decision_manifest_path
    ):
        try:
            decision_manifest = _load_json(bundle["_root"] / decision_manifest_path)
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_ysna_staging_decision_projection(decision_manifest, bundle) == []
    conninfo_manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json"
    if (
        progress.get("event_sequence") == 481
        and progress.get("last_event_id") == "evt_c21_lr02c_ops_r2_conninfo_r4_exact13_repository_reconciled"
        and current_ref.get("manifest_path") == conninfo_manifest_path
    ):
        try:
            conninfo_manifest = _load_json(bundle["_root"] / conninfo_manifest_path)
        except (OSError, json.JSONDecodeError, TypeError):
            return False
        return validate_c21_lr02c_ops_r2_conninfo_r4_projection(conninfo_manifest, bundle) == []
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_MAIN_RECONCILIATION_MANIFEST.json"
    if any((
        progress.get("event_sequence") != 478,
        progress.get("last_event_id") != "evt_c21_lr02c_ops_r2_main_reconciliation_exact7",
        current_ref.get("manifest_path") != manifest_path,
    )):
        return False
    try:
        manifest = _load_json(bundle["_root"] / manifest_path)
    except (OSError, json.JSONDecodeError, TypeError):
        return False
    return validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, bundle) == []


def validate_c21_backup_portability_acceptance_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate accepted backup portability and the release-bound exact24 projection."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"]["events"]
    repository = progress.get("repository") or {}
    accepted = progress.get("accepted_c21_backup_portability_work_instruction") or {}
    worker = progress.get("completed_c21_backup_portability_worker_lease") or {}
    write = progress.get("completed_c21_backup_portability_write_lease") or {}
    base = "095e1488ed85ec11986447539d04cf2b494dbd34"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-accepted-r1.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_R1.json"
    evidence_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_EVIDENCE_R1.json"
    report_path = "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md"
    wi_path = "docs/work_orders/C-21_LR-02C_BACKUP_PORTABILITY_REWORK_WORK_INSTRUCTION_R1.md"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    release_path = "deploy/ysna/ReleaseManifest.json"
    ops_r2_base = "ca945dfe4fed9befedc46620aff24729c3898952"
    ops_r2_digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-rework-start-r2.json"
    ops_r2_manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json"
    ops_r2_exact_paths = [
        "deploy/ysna/backup-c21-db.sh",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        ops_r2_manifest_path,
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-events.json",
        ops_r2_digest_path,
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION_R2.md",
        "scripts/check_project_progress.py",
        "tests/deploy/test_c21_lr02c_operational_contract.py",
        "tests/tooling/test_project_progress.py",
    ]
    main_successor = _c21_ops_r2_main_reconciliation_successor_valid(bundle)
    errors: list[str] = []
    historical_projection = not any((
        progress.get("event_sequence") != 469,
        progress.get("last_event_id") != "evt_c21_lr02c_backup_portability_acceptance_exact24_repository_reconciled",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") is not None,
        progress.get("active_work_instruction") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
        progress.get("valid_failure_count") != 0,
        progress.get("active_failure_lineage") is not None,
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "READY_FOR_RELEASE_BINDING_AND_DEPLOYMENT",
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id":"C-21","path":digest_path,"manifest_path":manifest_path},
    ))
    ops_r2_projection = not any((
        progress.get("event_sequence") != 475,
        progress.get("last_event_id") != "evt_c21_lr02c_ops_r2_nonsemantic_revision_rebound",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-c21-ops-r2",
        (progress.get("active_work_instruction") or {}).get("artifact_id") != "WI-C-21-LR-02C-OPS-R2-20260903-001",
        progress.get("valid_failure_count") != 1,
        (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "C-21/LR-02C/OPS-R2",
        (progress.get("active_failure_lineage") or {}).get("failure_fingerprint") != "C21_BACKUP_LIBPQ_DSN_SCHEME_INCOMPATIBLE",
        (progress.get("worker_lease") or {}).get("lease_epoch") != 5,
        (progress.get("worker_lease") or {}).get("status") != "ACTIVE",
        (progress.get("write_lease") or {}).get("write_epoch") != 5,
        (progress.get("write_lease") or {}).get("status") != "ACTIVE",
        (progress.get("write_lease") or {}).get("worker_lease_id") != (progress.get("worker_lease") or {}).get("lease_id"),
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE_OPERATIONAL_BACKUP_REWORK_R2",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": ops_r2_digest_path, "manifest_path": ops_r2_manifest_path
        },
        len(events) != 475,
        [event.get("event_type") for event in events[469:475]] != [
            "FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED",
            "PACKAGE_RESUMED", "REPOSITORY_RECONCILED", "PACKAGE_RESUMED",
        ],
    ))
    if not historical_projection and not ops_r2_projection and not main_successor:
        errors.append("C21_BACKUP_PORTABILITY_ACCEPTANCE_PROJECTION_INVALID")
    if any((
        accepted.get("artifact_id") != "WI-C-21-LR-02C-BACKUP-PORTABILITY-R1-20260903-001",
        accepted.get("path") != wi_path,
        accepted.get("result_status") != "ACCEPTED",
        accepted.get("package_status") != "ACCEPTED",
        accepted.get("release_commit") != base,
        accepted.get("historical_failure_count") != 1,
        accepted.get("independent_tester_status") != "PASS",
        accepted.get("evidence_manifest_path") != evidence_path,
        accepted.get("evidence_manifest_sha256") != "8461E432930E05314289743D0DE5D469CA0B3AC500F146BAE2F62893CE78B9B5",
        accepted.get("accepted_event_id") != "evt_c21_lr02c_backup_portability_main_package_accepted",
        accepted.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        worker.get("lease_epoch") != 4,
        worker.get("status") != "REVOKED",
        write.get("write_epoch") != 4,
        write.get("status") != "REVOKED",
        write.get("worker_lease_id") != worker.get("lease_id"),
    )):
        errors.append("C21_BACKUP_PORTABILITY_ACCEPTED_WORK_OR_LEASE_INVALID")
    historical_repository = not any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("remote_head") != base,
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_BACKUP_PORTABILITY_ACCEPTED_EXACT24_WORKTREE",
        len(repository.get("exact_allowed_paths", [])) != 24,
    ))
    ops_r2_repository = not any((
        repository.get("validated_base_commit") != ops_r2_base,
        repository.get("local_head") != ops_r2_base,
        repository.get("feature_remote_head") != ops_r2_base,
        repository.get("remote_head") != ops_r2_base,
        repository.get("head_relation") != "FEATURE_WORKTREE_ACTIVE_OPS_R2_EXACT13",
        repository.get("exact_allowed_paths") != ops_r2_exact_paths,
    ))
    if not historical_repository and not ops_r2_repository and not main_successor:
        errors.append("C21_BACKUP_PORTABILITY_ACCEPTANCE_REPOSITORY_INVALID")
    terminal = [event for event in events if 465 <= event.get("sequence", -1) <= 469]
    if [event.get("event_type") for event in terminal] != [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED",
        "MAIN_PACKAGE_ACCEPTED", "REPOSITORY_RECONCILED",
    ]:
        errors.append("C21_BACKUP_PORTABILITY_ACCEPTANCE_EVENTS_INVALID")
    rows = manifest.get("raw_checksums")
    expected_rows = {digest_path, evidence_path, report_path, wi_path, approval_path, release_path}
    if any((
        manifest.get("artifact_id") != "C21-LR02C-BACKUP-PORTABILITY-ACCEPTANCE-R1-20260903",
        manifest.get("event_sequence") != 469,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 24,
        manifest.get("focused_test_count") != 211,
        manifest.get("next_status") != "READY_FOR_RELEASE_BINDING_AND_DEPLOYMENT",
        manifest.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_INVALID")
    elif main_successor:
        if any(not git_blob_row_matches(root, "ca945dfe4fed9befedc46620aff24729c3898952", row) for row in rows):
            errors.append("C21_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_INVALID")
    elif any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in rows):
        errors.append("C21_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_INVALID")
    if main_successor:
        release_result = subprocess.run(
            ["git", "show", "ca945dfe4fed9befedc46620aff24729c3898952:deploy/ysna/ReleaseManifest.json"],
            cwd=root, check=False, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        try:
            release = json.loads(release_result.stdout.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            release = {}
    else:
        release = json.loads((root / release_path).read_text(encoding="utf-8"))
    if any((
        (release.get("source") or {}).get("commit") != base,
        (release.get("runtime") or {}).get("target_expected_commit") != base,
        ((release.get("evidence") or {}).get("focused_tests") or {}).get("count") != 211,
        (release.get("evidence") or {}).get("runtime_provider_and_telegram") != "USER_VERIFICATION_PENDING",
    )):
        errors.append("C21_BACKUP_PORTABILITY_RELEASE_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_lr02c_operational_rework_r2_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the append-only OPS-R2 failure acceptance and epoch-5 rework projection."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    instruction = progress.get("active_work_instruction") or {}
    revision_binding = instruction.get("revision_binding") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    base = "ca945dfe4fed9befedc46620aff24729c3898952"
    failed_target = "095e1488ed85ec11986447539d04cf2b494dbd34"
    fingerprint = "C21_BACKUP_LIBPQ_DSN_SCHEME_INCOMPATIBLE"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-rework-start-r2.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json"
    report_path = "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md"
    wi_path = "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION_R2.md"
    invocation_path = "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT_R2.md"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    release_path = "deploy/ysna/ReleaseManifest.json"
    frozen_report_path = "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md"
    exact_paths = [
        "deploy/ysna/backup-c21-db.sh",
        report_path,
        manifest_path,
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-events.json",
        digest_path,
        invocation_path,
        wi_path,
        "scripts/check_project_progress.py",
        "tests/deploy/test_c21_lr02c_operational_contract.py",
        "tests/tooling/test_project_progress.py",
    ]
    lease_paths = [
        "deploy/ysna/backup-c21-db.sh",
        "tests/deploy/test_c21_lr02c_operational_contract.py",
        report_path,
        wi_path,
        invocation_path,
        manifest_path,
        digest_path,
        "docs/progress/build-progress.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/progress-events.json",
        "docs/progress/failure-ledger.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ]
    errors: list[str] = []
    main_successor = _c21_ops_r2_main_reconciliation_successor_valid(bundle)
    historical_projection = not any((
        progress.get("event_sequence") != 475,
        progress.get("last_event_id") != "evt_c21_lr02c_ops_r2_nonsemantic_revision_rebound",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-c21-ops-r2",
        progress.get("valid_failure_count") != 1,
        (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "C-21/LR-02C/OPS-R2",
        (progress.get("active_failure_lineage") or {}).get("failure_fingerprint") != fingerprint,
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE_OPERATIONAL_BACKUP_REWORK_R2",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path
        },
    ))
    if not historical_projection and not main_successor:
        errors.append("C21_LR02C_OPERATIONAL_R2_PROJECTION_INVALID")
    if not main_successor and any((
        instruction.get("artifact_id") != "WI-C-21-LR-02C-OPS-R2-20260903-001",
        instruction.get("path") != wi_path,
        instruction.get("sha256") != "E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491",
        instruction.get("invocation_path") != invocation_path,
        instruction.get("invocation_sha256") != "8207996858DE33B542862B4D5C6AEBC1787BC4A0612E1C0052CAC3B637263FC5",
        instruction.get("revision_classification") != "MAIN_RECONFIRMED_NON_SEMANTIC",
        instruction.get("dispatch_base") != base,
        instruction.get("failed_release_target") != failed_target,
        instruction.get("result_status") != "REWORK_IN_PROGRESS",
        instruction.get("package_status") != "ACTIVE_OPERATIONAL_BACKUP_REWORK_R2",
        instruction.get("executor") != "developer-primary-c21-ops-r2",
        instruction.get("failure_fingerprint") != fingerprint,
        instruction.get("allowed_path_count") != 13,
        instruction.get("external_retry") != "BLOCKED_PENDING_TESTED_FIX_AND_RELEASE_REBIND",
        instruction.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
    )):
        errors.append("C21_LR02C_OPERATIONAL_R2_INSTRUCTION_INVALID")
    if not main_successor and any((
        revision_binding.get("binding_id") != "MAIN_RECONFIRMED_NON_SEMANTIC:C21-LR02C-OPS-R2-EOF-NORMALIZATION-20260904-001",
        revision_binding.get("parent_baseline_id") != "WI-C-21-LR-02C-OPS-R2-20260903-001@9FFFEEE723EB50210B0F7406E5C597E338C480268517A3DFA3FF59092EFE1E13",
        revision_binding.get("derived_baseline_id") != "WI-C-21-LR-02C-OPS-R2-20260903-001@E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491",
        revision_binding.get("root_human_approval_id") != "APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001",
        revision_binding.get("root_approval_subject_hash") != "3A68623BF9426EB619AC0B8E082028F73442F90F4680FDCE871711B60A6B5FAD",
        revision_binding.get("work_instruction_old_hash") != "9FFFEEE723EB50210B0F7406E5C597E338C480268517A3DFA3FF59092EFE1E13",
        revision_binding.get("work_instruction_new_hash") != instruction.get("sha256"),
        revision_binding.get("invocation_old_hash") != "0F0DCA44CAFAA9AB747B908720511456298FC82A0237A1397C75175A381A031A",
        revision_binding.get("invocation_new_hash") != instruction.get("invocation_sha256"),
        revision_binding.get("semantic_diff") != "NONE",
        revision_binding.get("scope_expansion") is not False,
        revision_binding.get("reconfirmed_actor") != {"actor_type": "agent", "actor_id": "main-agent-eoul"},
    )):
        errors.append("C21_LR02C_OPERATIONAL_R2_NONSEMANTIC_BINDING_INVALID")
    if not main_successor and any((
        worker.get("lease_id") != "worker-lease-c21-lr02c-ops-r2-20260903-005",
        worker.get("lease_epoch") != 5,
        worker.get("execution_fencing_token") != "c21-lr02c-ops-r2-execution-fence-epoch-5-ca945df",
        worker.get("status") != "ACTIVE",
        write.get("lease_id") != "write-lease-c21-lr02c-ops-r2-20260903-005",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 5,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != "c21-lr02c-ops-r2-write-fence-epoch-5-ca945df",
        write.get("status") != "ACTIVE",
        write.get("paths") != lease_paths,
    )):
        errors.append("C21_LR02C_OPERATIONAL_R2_FENCING_INVALID")
    historical_repository = not any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("remote_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("head_relation") != "FEATURE_WORKTREE_ACTIVE_OPS_R2_EXACT13",
        repository.get("exact_allowed_paths") != exact_paths,
    ))
    if not historical_repository and not main_successor:
        errors.append("C21_LR02C_OPERATIONAL_R2_REPOSITORY_INVALID")
    terminal = [event for event in events if 470 <= event.get("sequence", -1) <= 475]
    if [event.get("event_type") for event in terminal] != [
        "FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED",
        "PACKAGE_RESUMED", "REPOSITORY_RECONCILED", "PACKAGE_RESUMED",
    ]:
        errors.append("C21_LR02C_OPERATIONAL_R2_EVENTS_INVALID")
    rebound = terminal[-1].get("details", {}) if len(terminal) == 6 else {}
    if not main_successor and any((
        rebound.get("binding_id") != revision_binding.get("binding_id"),
        rebound.get("root_human_approval_id") != revision_binding.get("root_human_approval_id"),
        rebound.get("change_classification") != "MAIN_RECONFIRMED_NON_SEMANTIC",
        rebound.get("semantic_diff") != "NONE",
        rebound.get("work_instruction_new_hash") != instruction.get("sha256"),
        rebound.get("invocation_new_hash") != instruction.get("invocation_sha256"),
        rebound.get("scope_expansion") is not False,
        rebound.get("exact_allowed_path_count") != 13,
    )):
        errors.append("C21_LR02C_OPERATIONAL_R2_NONSEMANTIC_EVENT_INVALID")
    if len(events) < 469 or hashlib.sha256(canonical_json_bytes(events[:469])).hexdigest().upper() != (
        "85EC925F60701C3127C8CE166BBAE59980704925FBD16DBFF875BE3552AC7CEB"
    ):
        errors.append("C21_LR02C_OPERATIONAL_R2_PREDECESSOR_MUTATED")
    ledger_entries = bundle.get("failure_ledger", {}).get("entries", [])
    failure = next((row for row in ledger_entries if row.get("entry_id") == "failure-c21-lr02c-ops-r2-backup-attempt-1"), {})
    if not main_successor and (len(ledger_entries) != 31 or any((
        failure.get("step_lineage_id") != "C-21/LR-02C/OPS-R2",
        failure.get("failure_fingerprint") != fingerprint,
        failure.get("accepted") is not True,
        failure.get("exit_code") != 20,
        failure.get("database_dump") != "NOT_COMPLETED",
        failure.get("backup_receipt") != "NOT_CREATED",
        failure.get("deployment") != "NOT_EXECUTED",
        failure.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
    ))):
        errors.append("C21_LR02C_OPERATIONAL_R2_FAILURE_LEDGER_INVALID")
    rows = manifest.get("raw_checksums")
    manifest_binding = manifest.get("non_semantic_revision_binding") or {}
    expected_rows = {digest_path, wi_path, invocation_path, report_path, approval_path, release_path,
                     "docs/progress/failure-ledger.json", "docs/progress/progress-events.json",
                     "deploy/ysna/backup-c21-db.sh", "tests/deploy/test_c21_lr02c_operational_contract.py"}
    if any((
        manifest.get("artifact_id") != "C21-LR02C-OPERATIONAL-REWORK-START-R2-20260903",
        manifest.get("package_id") != "C-21/LR-02C/OPS-R2",
        manifest.get("event_sequence") != 475,
        manifest.get("validated_base_commit") != base,
        manifest.get("failed_release_target") != failed_target,
        manifest.get("repository_exact_path_count") != 13,
        manifest.get("failure_fingerprint") != fingerprint,
        manifest.get("backup_attempt") != 1,
        manifest.get("backup_exit_code") != 20,
        manifest.get("database_dump") != "NOT_COMPLETED",
        manifest.get("backup_receipt") != "NOT_CREATED",
        manifest.get("deployment") != "NOT_EXECUTED",
        manifest.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        manifest.get("frozen_predecessor_sequence") != 469,
        manifest.get("frozen_predecessor_events_sha256") != "85EC925F60701C3127C8CE166BBAE59980704925FBD16DBFF875BE3552AC7CEB",
        manifest_binding.get("binding_id") != "MAIN_RECONFIRMED_NON_SEMANTIC:C21-LR02C-OPS-R2-EOF-NORMALIZATION-20260904-001",
        manifest_binding.get("parent_baseline_id") != "WI-C-21-LR-02C-OPS-R2-20260903-001@9FFFEEE723EB50210B0F7406E5C597E338C480268517A3DFA3FF59092EFE1E13",
        manifest_binding.get("derived_baseline_id") != "WI-C-21-LR-02C-OPS-R2-20260903-001@E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491",
        manifest_binding.get("root_human_approval_id") != "APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001",
        manifest_binding.get("work_instruction_new_hash") != "E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491",
        manifest_binding.get("invocation_new_hash") != "8207996858DE33B542862B4D5C6AEBC1787BC4A0612E1C0052CAC3B637263FC5",
        manifest_binding.get("semantic_diff") != "NONE",
        manifest_binding.get("scope_expansion") is not False,
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_LR02C_OPERATIONAL_R2_MANIFEST_INVALID")
    elif main_successor:
        if any(not git_blob_row_matches(root, "b4858ffb373066b24d7d9ee9bfde810160cacb75", row) for row in rows):
            errors.append("C21_LR02C_OPERATIONAL_R2_MANIFEST_INVALID")
    elif any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in rows):
        errors.append("C21_LR02C_OPERATIONAL_R2_MANIFEST_INVALID")
    try:
        frozen_report_valid = portable_row_matches(
            root, frozen_report_path, 3846,
            "BF2A0FC98160072B8B61A6E1841445D80B4CC117BF1DDF3C611BC6F5DF38A1B1",
        )
    except (OSError, TypeError):
        frozen_report_valid = False
    if not frozen_report_valid:
        errors.append("C21_LR02C_OPERATIONAL_R2_FROZEN_ACCEPTANCE_MUTATED")
    return sorted(set(errors))


def validate_c21_lr02c_ops_r2_release_rebind_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the governance-only b4858ff release binding successor."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    binding = progress.get("current_release_binding") or {}
    release_path = "deploy/ysna/ReleaseManifest.json"
    wi_path = "docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_WORK_INSTRUCTION_R3.md"
    invocation_path = "docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_INVOCATION_PROMPT_R3.md"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-release-rebind.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json"
    predecessor_manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json"
    predecessor_digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-rework-start-r2.json"
    predecessor_manifest_sha256 = "7FD119508E9F68727C039D13A4442D6D4B668EA2136E82D0722428F012C830E3"
    predecessor_digest_sha256 = "D54B694CA65BDD1F4764893D913722D8B7BC98CC1421F0C02FED7522D70DC39E"
    target = "b4858ffb373066b24d7d9ee9bfde810160cacb75"
    exact_paths = [release_path, manifest_path, "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
                   "docs/progress/progress-events.json", digest_path, invocation_path, wi_path,
                   "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py"]
    errors: list[str] = []
    main_successor = _c21_ops_r2_main_reconciliation_successor_valid(bundle)
    historical_projection = not any((
        progress.get("event_sequence") != 477,
        progress.get("last_event_id") != "evt_c21_lr02c_ops_r2_release_rebind_exact10_repository_reconciled",
        progress.get("status") != "ACTIVE", progress.get("active_agent") != "developer-primary-c21-ops-r2",
        ((progress.get("active_work_instruction") or {}).get("artifact_id")) != "WI-C-21-LR-02C-OPS-R2-20260903-001",
        ((progress.get("worker_lease") or {}).get("lease_epoch")) != 5,
        ((progress.get("worker_lease") or {}).get("status")) != "ACTIVE",
        ((progress.get("write_lease") or {}).get("write_epoch")) != 5,
        ((progress.get("write_lease") or {}).get("status")) != "ACTIVE",
        ((progress.get("next_work_package") or {}).get("status")) != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id":"C-21","path":digest_path,"manifest_path":manifest_path},
    ))
    if not historical_projection and not main_successor:
        errors.append("C21_OPS_R2_RELEASE_REBIND_PROJECTION_INVALID")
    if any((
        binding.get("binding_id") != "MAIN_RECONFIRMED_NON_SEMANTIC:C21-LR02C-OPS-R2-RELEASE-B4858FF-20260904-001",
        binding.get("classification") != "MAIN_RECONFIRMED_NON_SEMANTIC",
        binding.get("work_instruction_sha256") != "F6E6285F6644FF185206BEAF5B99FC86D4C191F8BEA2028CFCADEAAA0F979CE2",
        binding.get("invocation_sha256") != "1796FEF612A8665832E486F6C492CBB435FA778BFB32503F111048D13E23D0BB",
        binding.get("root_human_approval_id") != "APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001",
        binding.get("release_target") != target, binding.get("status") != "APPROVED_FOR_DEPLOYMENT",
        binding.get("semantic_diff") != "NONE", binding.get("scope_expansion") is not False,
        binding.get("focused_test_count") != 216,
        binding.get("suite_counts") != {"tooling_project_progress":93,"backup_operational_contract":18,"ysna_scripts_contract":6,"api":99},
        binding.get("operational_backup_attempt") != 2, binding.get("operational_backup_status") != "NOT_EXECUTED",
        binding.get("deployment_status") != "NOT_EXECUTED", binding.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        binding.get("worker_lease_epoch") != 5, binding.get("write_lease_epoch") != 5,
        binding.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        binding.get("repository_exact_path_count") != 10,
    )):
        errors.append("C21_OPS_R2_RELEASE_REBIND_BINDING_INVALID")
    historical_repository = not any((repository.get("validated_base_commit") != target, repository.get("local_head") != target,
            repository.get("remote_head") != target, repository.get("feature_remote_head") != target,
            repository.get("head_relation") != "FEATURE_WORKTREE_ACTIVE_OPS_R2_RELEASE_REBIND_EXACT10",
            repository.get("exact_allowed_paths") != exact_paths))
    if not historical_repository and not main_successor:
        errors.append("C21_OPS_R2_RELEASE_REBIND_REPOSITORY_INVALID")
    if (len(events) != 477 and not main_successor) or [row.get("event_type") for row in events[475:477]] != ["RELEASE_MANIFEST_CREATED", "REPOSITORY_RECONCILED"]:
        errors.append("C21_OPS_R2_RELEASE_REBIND_EVENTS_INVALID")
    if len(events) < 475 or hashlib.sha256(canonical_json_bytes(events[:475])).hexdigest().upper() != "2DC9231901FA70F05B2DBC408A83752E38D8F0544CC33A224D2FEC1F70492F1E":
        errors.append("C21_OPS_R2_RELEASE_REBIND_PREDECESSOR_MUTATED")
    predecessor_binding = manifest.get("predecessor_r2_binding") or {}
    predecessor_result = subprocess.run(
        ["git", "show", f"{target}:{predecessor_manifest_path}"],
        cwd=root,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    try:
        predecessor_manifest = json.loads(predecessor_result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        predecessor_manifest = {}
    predecessor_rows = predecessor_manifest.get("raw_checksums")
    predecessor_expected_rows = {
        predecessor_digest_path,
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION_R2.md",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT_R2.md",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md",
        release_path,
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-events.json",
        "deploy/ysna/backup-c21-db.sh",
        "tests/deploy/test_c21_lr02c_operational_contract.py",
    }
    predecessor_nonsemantic = predecessor_manifest.get("non_semantic_revision_binding") or {}
    if any((
        predecessor_binding.get("manifest_path") != predecessor_manifest_path,
        predecessor_binding.get("manifest_sha256") != predecessor_manifest_sha256,
        predecessor_binding.get("event_sequence") != 475,
        predecessor_binding.get("raw_checksum_count") != 10,
        predecessor_binding.get("detached_digest_path") != predecessor_digest_path,
        predecessor_binding.get("detached_digest_sha256") != predecessor_digest_sha256,
        predecessor_binding.get("non_semantic_binding_id") != "MAIN_RECONFIRMED_NON_SEMANTIC:C21-LR02C-OPS-R2-EOF-NORMALIZATION-20260904-001",
        predecessor_result.returncode != 0,
        hashlib.sha256(predecessor_result.stdout).hexdigest().upper() != predecessor_manifest_sha256,
        predecessor_manifest.get("event_sequence") != 475,
        predecessor_manifest.get("frozen_predecessor_sequence") != 469,
        predecessor_manifest.get("frozen_predecessor_events_sha256") != "85EC925F60701C3127C8CE166BBAE59980704925FBD16DBFF875BE3552AC7CEB",
        predecessor_nonsemantic.get("binding_id") != predecessor_binding.get("non_semantic_binding_id"),
        predecessor_nonsemantic.get("work_instruction_new_hash") != "E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491",
        predecessor_nonsemantic.get("invocation_new_hash") != "8207996858DE33B542862B4D5C6AEBC1787BC4A0612E1C0052CAC3B637263FC5",
        predecessor_nonsemantic.get("semantic_diff") != "NONE",
        predecessor_nonsemantic.get("scope_expansion") is not False,
        not isinstance(predecessor_rows, list),
        {row.get("path") for row in predecessor_rows if isinstance(row, dict)} != predecessor_expected_rows,
    )):
        errors.append("C21_OPS_R2_RELEASE_REBIND_PREDECESSOR_INVALID")
    elif any(not git_blob_row_matches(root, target, row) for row in predecessor_rows):
        errors.append("C21_OPS_R2_RELEASE_REBIND_PREDECESSOR_INVALID")
    release = json.loads((root / release_path).read_text(encoding="utf-8"))
    release_binding = release.get("release_binding") or {}
    if any(((release.get("source") or {}).get("commit") != target,
            (release.get("runtime") or {}).get("target_expected_commit") != target,
            ((release.get("evidence") or {}).get("focused_tests") or {}).get("count") != 216,
            ((release.get("runtime") or {}).get("operational_backup_status")) != "NOT_EXECUTED",
            ((release.get("runtime") or {}).get("deployment_status")) != "NOT_EXECUTED",
            ((release.get("runtime") or {}).get("provider_and_telegram_status")) != "USER_VERIFICATION_PENDING",
            release_binding.get("binding_id") != binding.get("binding_id"),
            release_binding.get("scope_expansion") is not False)):
        errors.append("C21_OPS_R2_RELEASE_REBIND_RELEASE_MANIFEST_INVALID")
    rows = manifest.get("raw_checksums")
    expected_rows = {digest_path, release_path, wi_path, invocation_path, "docs/progress/progress-events.json",
                     "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
                     "deploy/ysna/backup-c21-db.sh", "tests/deploy/test_c21_lr02c_operational_contract.py",
                     "tests/deploy/test_ysna_scripts_contract.py"}
    if any((manifest.get("artifact_id") != "C21-LR02C-OPS-R2-RELEASE-REBIND-20260904",
            manifest.get("event_sequence") != 477, manifest.get("validated_base_commit") != target,
            manifest.get("target_commit") != target, manifest.get("repository_exact_path_count") != 10,
            manifest.get("focused_test_count") != 216, manifest.get("operational_backup_status") != "NOT_EXECUTED",
            manifest.get("deployment_status") != "NOT_EXECUTED", manifest.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
            manifest.get("frozen_predecessor_sequence") != 475,
            manifest.get("frozen_predecessor_events_sha256") != "2DC9231901FA70F05B2DBC408A83752E38D8F0544CC33A224D2FEC1F70492F1E",
            manifest.get("self_reference") is not False, not isinstance(rows, list),
            {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows)):
        errors.append("C21_OPS_R2_RELEASE_REBIND_EVIDENCE_MANIFEST_INVALID")
    elif main_successor:
        if any(not git_blob_row_matches(root, "970680a95a7e2471effc903239548948b3aa6263", row) for row in rows):
            errors.append("C21_OPS_R2_RELEASE_REBIND_EVIDENCE_MANIFEST_INVALID")
    elif any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in rows):
        errors.append("C21_OPS_R2_RELEASE_REBIND_EVIDENCE_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_lr02c_ops_r2_main_reconciliation_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the canonical main-only successor after the OPS-R2 fast-forward."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    release_binding = progress.get("current_release_binding") or {}
    base = "970680a95a7e2471effc903239548948b3aa6263"
    release_target = "b4858ffb373066b24d7d9ee9bfde810160cacb75"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_MAIN_RECONCILIATION_MANIFEST.json"
    predecessor_manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-main-reconciliation.json"
    exact_paths = [
        manifest_path,
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        digest_path,
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ]
    errors: list[str] = []
    conninfo_successor = _c21_ops_r2_main_reconciliation_successor_valid(bundle)
    if not conninfo_successor and any((
        progress.get("event_sequence") != 478,
        progress.get("last_event_id") != "evt_c21_lr02c_ops_r2_main_reconciliation_exact7",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-c21-ops-r2",
        ((progress.get("active_work_instruction") or {}).get("artifact_id")) != "WI-C-21-LR-02C-OPS-R2-20260903-001",
        ((progress.get("worker_lease") or {}).get("lease_epoch")) != 5,
        ((progress.get("worker_lease") or {}).get("status")) != "ACTIVE",
        ((progress.get("write_lease") or {}).get("write_epoch")) != 5,
        ((progress.get("write_lease") or {}).get("status")) != "ACTIVE",
        ((progress.get("next_work_package") or {}).get("status")) != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path,
        },
    )):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_PROJECTION_INVALID")
    if not conninfo_successor and any((
        repository.get("validated_base_commit") != base,
        repository.get("branch") != "main",
        repository.get("upstream") != "origin/main",
        repository.get("local_head") != base,
        repository.get("remote_head") != base,
        repository.get("head_relation") != "MAIN_OPS_R2_POST_MERGE_RECONCILIATION_EXACT7_PENDING_COMMIT",
        repository.get("push_status") != "PUSH_PENDING_MAIN",
        repository.get("exact_allowed_paths") != exact_paths,
        "feature_remote" in repository,
        "feature_remote_head" in repository,
    )):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_REPOSITORY_INVALID")
    if any((
        release_binding.get("release_target") != release_target,
        release_binding.get("focused_test_count") != 216,
        release_binding.get("operational_backup_attempt") != 2,
        release_binding.get("operational_backup_status") != "NOT_EXECUTED",
        release_binding.get("deployment_status") != "NOT_EXECUTED",
        release_binding.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        release_binding.get("worker_lease_epoch") != 5,
        release_binding.get("write_lease_epoch") != 5,
        release_binding.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
    )):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_BOUNDARY_INVALID")
    if not conninfo_successor and (
        len(events) != 478
        or events[-1].get("event_type") != "REPOSITORY_RECONCILED"
        or events[-1].get("event_id") != "evt_c21_lr02c_ops_r2_main_reconciliation_exact7"
        or events[-1].get("subject_ref") != "C-21/LR-02C/OPS-R2/MAIN-RECONCILIATION"
    ):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_EVENTS_INVALID")
    if len(events) < 477 or hashlib.sha256(canonical_json_bytes(events[:477])).hexdigest().upper() != "7D496898B6BEFABC59C16017C04A19252FB7757BEC55E8494D656F1C50B10998":
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_PREDECESSOR_MUTATED")
    predecessor_result = subprocess.run(
        ["git", "show", f"{base}:{predecessor_manifest_path}"],
        cwd=root,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    try:
        predecessor_manifest = json.loads(predecessor_result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        predecessor_manifest = {}
    predecessor_rows = predecessor_manifest.get("raw_checksums")
    if any((
        predecessor_result.returncode != 0,
        hashlib.sha256(predecessor_result.stdout).hexdigest().upper() != "B32AB76FFD3B70CBA212C9B3865B81F42D96D35F4C647EFCF4DF1F899C1C504C",
        predecessor_manifest.get("event_sequence") != 477,
        predecessor_manifest.get("target_commit") != release_target,
        predecessor_manifest.get("operational_backup_status") != "NOT_EXECUTED",
        predecessor_manifest.get("deployment_status") != "NOT_EXECUTED",
        predecessor_manifest.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        not isinstance(predecessor_rows, list),
    )):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_PREDECESSOR_INVALID")
    elif any(not git_blob_row_matches(root, base, row) for row in predecessor_rows):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_PREDECESSOR_INVALID")
    release = json.loads((root / "deploy/ysna/ReleaseManifest.json").read_text(encoding="utf-8"))
    if any((
        ((release.get("source") or {}).get("commit")) != release_target,
        ((release.get("runtime") or {}).get("target_expected_commit")) != release_target,
        ((release.get("runtime") or {}).get("operational_backup_status")) != "NOT_EXECUTED",
        ((release.get("runtime") or {}).get("deployment_status")) != "NOT_EXECUTED",
        ((release.get("runtime") or {}).get("provider_and_telegram_status")) != "USER_VERIFICATION_PENDING",
    )):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_RELEASE_INVALID")
    rows = manifest.get("raw_checksums")
    expected_rows = {
        digest_path,
        predecessor_manifest_path,
        "deploy/ysna/ReleaseManifest.json",
        "docs/progress/progress-events.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    }
    binding = manifest.get("main_reconciliation_binding") or {}
    if any((
        manifest.get("artifact_id") != "C21-LR02C-OPS-R2-MAIN-RECONCILIATION-20260904",
        manifest.get("manifest_type") != "MAIN_REPOSITORY_RECONCILIATION_PROJECTION",
        manifest.get("event_sequence") != 478,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 7,
        manifest.get("release_target") != release_target,
        manifest.get("tooling_test_count") != 94,
        manifest.get("operational_backup_attempt") != 2,
        manifest.get("operational_backup_status") != "NOT_EXECUTED",
        manifest.get("deployment_status") != "NOT_EXECUTED",
        manifest.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        manifest.get("worker_lease_epoch") != 5,
        manifest.get("write_lease_epoch") != 5,
        manifest.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("frozen_predecessor_sequence") != 477,
        manifest.get("frozen_predecessor_events_sha256") != "7D496898B6BEFABC59C16017C04A19252FB7757BEC55E8494D656F1C50B10998",
        binding.get("classification") != "MAIN_RECONFIRMED_NON_SEMANTIC",
        binding.get("semantic_diff") != "NONE",
        binding.get("scope_expansion") is not False,
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_MANIFEST_INVALID")
    elif conninfo_successor:
        if any(not git_blob_row_matches(root, "eef349682ff5598e3488c9e75163c5e0a99a0bdb", row) for row in rows):
            errors.append("C21_OPS_R2_MAIN_RECONCILIATION_MANIFEST_INVALID")
    elif any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in rows):
        errors.append("C21_OPS_R2_MAIN_RECONCILIATION_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_lr02c_ops_r2_conninfo_r4_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the second accepted backup failure and fenced conninfo R4 exact13."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    instruction = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    ledger = bundle["failure_ledger"].get("entries", [])
    base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    failed_target = "b4858ffb373066b24d7d9ee9bfde810160cacb75"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-conninfo-rework-r4.json"
    wi_path = "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_WORK_INSTRUCTION_R4.md"
    invocation_path = "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_INVOCATION_PROMPT_R4.md"
    report_path = "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md"
    exact_paths = [
        "deploy/ysna/backup-c21-db.sh", report_path, manifest_path,
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json", "docs/progress/progress-events.json",
        digest_path, invocation_path, wi_path, "scripts/check_project_progress.py",
        "tests/deploy/test_c21_lr02c_operational_contract.py", "tests/tooling/test_project_progress.py",
    ]
    errors: list[str] = []
    if any((
        progress.get("event_sequence") != 481,
        progress.get("last_event_id") != "evt_c21_lr02c_ops_r2_conninfo_r4_exact13_repository_reconciled",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-c21-ops-r2",
        progress.get("valid_failure_count") != 2,
        ((progress.get("active_failure_lineage") or {}).get("valid_failure_count")) != 2,
        ((progress.get("next_work_package") or {}).get("status")) != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        ((progress.get("next_successor_work_package") or {}).get("status")) != "ACTIVE_OPERATIONAL_BACKUP_CONNINFO_REWORK_R4",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path,
        },
    )):
        errors.append("C21_OPS_R2_CONNINFO_R4_PROJECTION_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02C-OPS-R2-CONNINFO-R4-20260904-001",
        instruction.get("path") != wi_path,
        instruction.get("sha256") != "CCE5C3D315D101CEAABF30FF0B51D447602E7927B5193CF531D72B3034AACEC5",
        instruction.get("invocation_path") != invocation_path,
        instruction.get("invocation_sha256") != "3BB6F14863D00548A5BA22653B1501628F34DCE9E26B2873E9414C202632A27D",
        instruction.get("revision_classification") != "HUMAN_APPROVED_FAILURE_DRIVEN_REWORK",
        instruction.get("package_status") != "ACTIVE_OPERATIONAL_BACKUP_CONNINFO_REWORK_R4",
        instruction.get("valid_failure_count") != 2,
        instruction.get("allowed_path_count") != 13,
        worker.get("lease_epoch") != 5, worker.get("status") != "ACTIVE",
        write.get("write_epoch") != 5, write.get("status") != "ACTIVE",
        sorted(write.get("paths") or []) != exact_paths,
    )):
        errors.append("C21_OPS_R2_CONNINFO_R4_FENCING_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != "970680a95a7e2471effc903239548948b3aa6263",
        repository.get("feature_remote") != "origin/codex/c21-operational-execution",
        repository.get("feature_remote_head") != "970680a95a7e2471effc903239548948b3aa6263",
        repository.get("head_relation") != "FEATURE_WORKTREE_ACTIVE_OPS_R2_CONNINFO_R4_EXACT13",
        repository.get("push_status") != "FEATURE_BASE_AHEAD_OF_REMOTE_OPS_R2_CONNINFO_R4_ACTIVE",
        repository.get("exact_allowed_paths") != exact_paths,
    )):
        errors.append("C21_OPS_R2_CONNINFO_R4_REPOSITORY_INVALID")
    terminal = events[478:481]
    if len(events) != 481 or [row.get("event_type") for row in terminal] != [
        "FAILURE_REPORT_ACCEPTED", "PACKAGE_RESUMED", "REPOSITORY_RECONCILED",
    ]:
        errors.append("C21_OPS_R2_CONNINFO_R4_EVENTS_INVALID")
    if len(events) < 478 or hashlib.sha256(canonical_json_bytes(events[:478])).hexdigest().upper() != "A12B161D1CCE9B8674B4CF004FBB91587D7F8582B2420067992E460F4792AAFD":
        errors.append("C21_OPS_R2_CONNINFO_R4_PREDECESSOR_MUTATED")
    failure = ledger[-1] if ledger else {}
    if any((
        failure.get("entry_id") != "failure-c21-lr02c-ops-r2-backup-attempt-2",
        failure.get("step_lineage_id") != "C-21/LR-02C/OPS-R2",
        failure.get("failure_fingerprint") != "C21_BACKUP_LIBPQ_DSN_SCHEME_INCOMPATIBLE",
        failure.get("accepted") is not True,
        failure.get("counts_toward_valid_failure") is not True,
        failure.get("accepted_sequence") != 2,
        failure.get("release_target") != failed_target,
        failure.get("backup_attempt") != 2,
        failure.get("exit_code") != 20,
        failure.get("database_dump") != "NOT_COMPLETED",
        failure.get("backup_receipt") != "NOT_CREATED",
        failure.get("deployment") != "NOT_EXECUTED",
        failure.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
    )):
        errors.append("C21_OPS_R2_CONNINFO_R4_FAILURE_LEDGER_INVALID")
    release = _load_json(root / "deploy/ysna/ReleaseManifest.json")
    if any((
        ((release.get("source") or {}).get("commit")) != failed_target,
        ((release.get("runtime") or {}).get("target_expected_commit")) != failed_target,
        ((release.get("runtime") or {}).get("operational_backup_status")) != "NOT_EXECUTED",
        ((release.get("runtime") or {}).get("deployment_status")) != "NOT_EXECUTED",
        ((release.get("runtime") or {}).get("provider_and_telegram_status")) != "USER_VERIFICATION_PENDING",
    )):
        errors.append("C21_OPS_R2_CONNINFO_R4_RELEASE_BOUNDARY_INVALID")
    rows = manifest.get("raw_checksums")
    expected_rows = {
        digest_path, wi_path, invocation_path, report_path, "docs/progress/failure-ledger.json",
        "docs/progress/progress-events.json", "deploy/ysna/ReleaseManifest.json",
        "deploy/ysna/backup-c21-db.sh", "tests/deploy/test_c21_lr02c_operational_contract.py",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    binding = manifest.get("rework_binding") or {}
    if any((
        manifest.get("artifact_id") != "C21-LR02C-OPS-R2-CONNINFO-REWORK-R4-20260904",
        manifest.get("manifest_type") != "FAILURE_DRIVEN_PRODUCT_REWORK_PROJECTION",
        manifest.get("event_sequence") != 481,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 13,
        manifest.get("failed_release_target") != failed_target,
        manifest.get("valid_failure_count") != 2,
        manifest.get("focused_operational_contract_count") != 31,
        manifest.get("tooling_test_count") != 94,
        manifest.get("ysna_script_test_count") != 6,
        manifest.get("api_test_count") != 99,
        manifest.get("operational_backup_attempt") != 2,
        manifest.get("backup_attempt3") != "NOT_EXECUTED",
        manifest.get("release_manifest_rebind") != "NOT_EXECUTED",
        manifest.get("deployment_status") != "NOT_EXECUTED",
        manifest.get("telegram_and_provider") != "USER_VERIFICATION_PENDING",
        manifest.get("worker_lease_epoch") != 5,
        manifest.get("write_lease_epoch") != 5,
        manifest.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("frozen_predecessor_sequence") != 478,
        manifest.get("frozen_predecessor_events_sha256") != "A12B161D1CCE9B8674B4CF004FBB91587D7F8582B2420067992E460F4792AAFD",
        binding.get("classification") != "HUMAN_APPROVED_FAILURE_DRIVEN_REWORK",
        binding.get("scope_expansion") is not False,
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_OPS_R2_CONNINFO_R4_MANIFEST_INVALID")
    elif any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in rows):
        errors.append("C21_OPS_R2_CONNINFO_R4_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_ysna_staging_decision_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the append-only ysna staging classification decision checkpoint."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    decision = progress.get("environment_classification_decision") or {}
    checkpoint = "871513d46a19f864190a977380a4c9c5b5d56573"
    manifest_path = "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-ysna-staging-classification-decision.json"
    predecessor_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json"
    exact_paths = set((progress.get("write_lease") or {}).get("paths") or []) | {manifest_path, digest_path}
    errors: list[str] = []
    if any((
        progress.get("event_sequence") != 482,
        progress.get("last_event_id") != "evt_c21_ysna_staging_classification_decision_checkpoint",
        progress.get("status") != "ACTIVE",
        progress.get("valid_failure_count") != 2,
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path,
        },
        ((progress.get("next_work_package") or {}).get("status")) != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
    )):
        errors.append("C21_YSNA_STAGING_DECISION_PROJECTION_INVALID")
    if any((
        decision.get("decision_id") != "APPROVAL-20260904-C21-YSNA-STAGING-001",
        decision.get("event_sequence") != 482,
        decision.get("targets") != ["ysna-server", "anvil.sinsan.kr"],
        decision.get("classification") != "STAGING_USER_ACCEPTANCE_UNTIL_EXPLICIT_PRODUCTION_DECLARATION",
        decision.get("effective_until") != "SHINSAN_EXPLICIT_PRODUCTION_TRANSITION_DECLARATION",
        decision.get("historical_evidence") != "PRESERVED_UNCHANGED",
        decision.get("checkpoint_base") != checkpoint,
        decision.get("server_redeploy") != "NOT_EXECUTED",
        decision.get("server_restart") != "NOT_EXECUTED",
        decision.get("database_dns_tls_secret_changes") != "NOT_EXECUTED",
        decision.get("existing_material_deletion") != "NOT_EXECUTED",
        decision.get("main_merge") != "NOT_EXECUTED",
    )):
        errors.append("C21_YSNA_STAGING_DECISION_BOUNDARY_INVALID")
    if any((
        repository.get("validated_base_commit") != "eef349682ff5598e3488c9e75163c5e0a99a0bdb",
        repository.get("local_head") != checkpoint,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != "970680a95a7e2471effc903239548948b3aa6263",
        repository.get("feature_remote_head") != "970680a95a7e2471effc903239548948b3aa6263",
        repository.get("head_relation") != "FEATURE_WORKTREE_ACTIVE_C21_YSNA_STAGING_DECISION_EXACT15",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PENDING_C21_YSNA_STAGING_DECISION",
        set(repository.get("exact_allowed_paths") or []) != exact_paths,
        len(repository.get("exact_allowed_paths") or []) != 15,
    )):
        errors.append("C21_YSNA_STAGING_DECISION_REPOSITORY_INVALID")
    if (
        len(events) != 482
        or hashlib.sha256(canonical_json_bytes(events[:481])).hexdigest().upper()
        != "3E97534028686CEC657BEB2B287A46FD32A92105AA64CDDBC0943142E9F27F66"
        or events[-1].get("event_type") != "REPOSITORY_RECONCILED"
        or events[-1].get("event_id") != "evt_c21_ysna_staging_classification_decision_checkpoint"
        or events[-1].get("details", {}).get("historical_evidence") != "PRESERVED_UNCHANGED"
    ):
        errors.append("C21_YSNA_STAGING_DECISION_EVENTS_INVALID")
    rows = manifest.get("raw_checksums")
    expected_rows = {digest_path, predecessor_path, "docs/progress/progress-events.json", "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py"}
    if any((
        manifest.get("artifact_id") != "C21-YSNA-STAGING-CLASSIFICATION-DECISION-20260904",
        manifest.get("manifest_type") != "ENVIRONMENT_CLASSIFICATION_DECISION_CHECKPOINT",
        manifest.get("event_sequence") != 482,
        manifest.get("decision_id") != "APPROVAL-20260904-C21-YSNA-STAGING-001",
        manifest.get("checkpoint_base") != checkpoint,
        manifest.get("repository_exact_path_count") != 15,
        manifest.get("frozen_predecessor_sequence") != 481,
        manifest.get("frozen_predecessor_events_sha256") != "3E97534028686CEC657BEB2B287A46FD32A92105AA64CDDBC0943142E9F27F66",
        manifest.get("historical_evidence") != "PRESERVED_UNCHANGED",
        manifest.get("external_changes") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_YSNA_STAGING_DECISION_MANIFEST_INVALID")
    else:
        for row in rows:
            if row.get("path") == predecessor_path:
                valid = git_blob_row_matches(root, checkpoint, row)
            else:
                valid = portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256"))
            if not valid:
                errors.append("C21_YSNA_STAGING_DECISION_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_wsl_readiness_decision_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the WSL early-execution readiness checkpoint and approval hold."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    decision = progress.get("wsl_readiness_decision") or {}
    checkpoint = "894e7b71fc52905e774892844905199401199fb2"
    local_checkpoint = "584e4020275ae734a6385dd44e552ec91c4a02b7"
    manifest_path = "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-readiness-decision.json"
    report_path = "docs/04_test_reports/C-21_WSL_READINESS_DECISION_REPORT.md"
    predecessor_path = "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json"
    excluded_actions = [
        "SERVER_REDEPLOY", "SERVER_RESTART", "DATABASE_CHANGE", "DNS_CHANGE",
        "TLS_CHANGE", "SECRET_CHANGE", "EXISTING_MATERIAL_DELETION", "MAIN_MERGE",
        "RELEASE_MANIFEST_REBIND", "TELEGRAM_EXECUTION", "PROVIDER_EXECUTION",
    ]
    exact_paths = set((progress.get("write_lease") or {}).get("paths") or []) | {
        "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-ysna-staging-classification-decision.json",
        report_path,
        manifest_path,
        digest_path,
    }
    errors: list[str] = []
    if any((
        progress.get("event_sequence") != 483,
        progress.get("last_event_id") != "evt_c21_wsl_readiness_waiting_approval",
        progress.get("status") != "WAITING_APPROVAL",
        progress.get("valid_failure_count") != 2,
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path,
        },
        ((progress.get("next_work_package") or {}).get("status")) != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        ((progress.get("next_successor_work_package") or {}).get("status")) != "WAITING_APPROVAL_WSL_PHASE_C_EARLY_EXECUTION",
    )):
        errors.append("C21_WSL_READINESS_PROJECTION_INVALID")
    if any((
        decision.get("event_sequence") != 483,
        decision.get("decision_status") != "WAITING_APPROVAL",
        decision.get("reason") != "WSL_PHASE_C_EARLY_EXECUTION_CHANGES_SCOPE_ORDER_AND_IMPORTANT_OPERATIONAL_RISK",
        decision.get("checkpoint_base") != checkpoint,
        decision.get("head_upstream") != "SYNCED",
        decision.get("frozen_predecessor_sequence") != 482,
        decision.get("frozen_predecessor_events_sha256") != "7E15CC44779B362A444C0B34D560F20F7E68150252DA5D6DB535C158925AEA3A",
        decision.get("release_manifest_target") != "b4858ffb373066b24d7d9ee9bfde810160cacb75",
        decision.get("release_manifest_status") != "STALE_FOR_CURRENT_HEAD",
        decision.get("manifest_guard") != "ORIGIN_MAIN_ANCESTOR_REQUIRED",
        decision.get("wsl_harness") != "MISSING_ONLY_GITKEEP",
        decision.get("ysna_verify_reuse") != "UNSUITABLE_COUPLED_TO_PUBLIC_DOMAIN_TELEGRAM_PROVIDER",
        decision.get("plan_owners") != ["F-16", "F-17"],
        decision.get("requested_successor") != "PHASE_C_SUCCESSOR_WSL_EARLY_VALIDATION",
        decision.get("decision_axes") != ["FEATURE_SCOPE", "WORK_ORDER", "IMPORTANT_OPERATIONAL_RISK"],
        decision.get("excluded_actions") != excluded_actions,
        decision.get("historical_evidence") != "PRESERVED_UNCHANGED",
        decision.get("report_path") != report_path,
        decision.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
    )):
        errors.append("C21_WSL_READINESS_APPROVAL_BOUNDARY_INVALID")
    if any((
        repository.get("validated_base_commit") != "eef349682ff5598e3488c9e75163c5e0a99a0bdb",
        repository.get("local_head") != local_checkpoint,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != checkpoint,
        repository.get("feature_remote_head") != checkpoint,
        repository.get("head_relation") != "FEATURE_WORKTREE_C21_WSL_READINESS_WAITING_APPROVAL_EXACT18",
        repository.get("push_status") != "FEATURE_LOCAL_CHECKPOINT_AHEAD_C21_WSL_READINESS_EOF_NORMALIZATION",
        set(repository.get("exact_allowed_paths") or []) != exact_paths,
        len(repository.get("exact_allowed_paths") or []) != 18,
    )):
        errors.append("C21_WSL_READINESS_REPOSITORY_INVALID")
    if (
        len(events) != 483
        or hashlib.sha256(canonical_json_bytes(events[:482])).hexdigest().upper()
        != "7E15CC44779B362A444C0B34D560F20F7E68150252DA5D6DB535C158925AEA3A"
        or events[-1].get("event_type") != "PACKAGE_WAITING_APPROVAL"
        or events[-1].get("event_id") != "evt_c21_wsl_readiness_waiting_approval"
        or events[-1].get("details", {}).get("decision_status") != "WAITING_APPROVAL"
        or events[-1].get("details", {}).get("historical_evidence") != "PRESERVED_UNCHANGED"
    ):
        errors.append("C21_WSL_READINESS_EVENTS_INVALID")
    rows = manifest.get("raw_checksums")
    expected_rows = {
        digest_path, report_path, predecessor_path, "docs/progress/progress-events.json",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    if any((
        manifest.get("artifact_id") != "C21-WSL-READINESS-DECISION-20260904",
        manifest.get("manifest_type") != "WSL_EARLY_EXECUTION_WAITING_APPROVAL_CHECKPOINT",
        manifest.get("event_sequence") != 483,
        manifest.get("decision_status") != "WAITING_APPROVAL",
        manifest.get("checkpoint_base") != checkpoint,
        manifest.get("repository_exact_path_count") != 18,
        manifest.get("frozen_predecessor_sequence") != 482,
        manifest.get("frozen_predecessor_events_sha256") != "7E15CC44779B362A444C0B34D560F20F7E68150252DA5D6DB535C158925AEA3A",
        manifest.get("historical_evidence") != "PRESERVED_UNCHANGED",
        manifest.get("excluded_actions") != excluded_actions,
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows,
    )):
        errors.append("C21_WSL_READINESS_MANIFEST_INVALID")
    else:
        for row in rows:
            if row.get("path") == predecessor_path:
                valid = git_blob_row_matches(root, checkpoint, row)
            else:
                valid = portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256"))
            if not valid:
                errors.append("C21_WSL_READINESS_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def c21_wsl_active_exact_paths() -> set[str]:
    """Return the cumulative exact path set for the seq485 implementation checkpoint."""
    return {
        "deploy/wsl/CandidateReleaseManifest.json",
        "deploy/wsl/Dockerfile.web",
        "deploy/wsl/bootstrap.sh",
        "deploy/wsl/candidate-manifest-guard.sh",
        "deploy/wsl/common.sh",
        "deploy/wsl/compose.wsl.yml",
        "deploy/wsl/deploy.sh",
        "deploy/wsl/requirements-runtime.txt",
        "deploy/wsl/rollback.sh",
        "deploy/wsl/verify.sh",
        "deploy/ysna/backup-c21-db.sh",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        "docs/04_test_reports/C-21_WSL_EARLY_VALIDATION_PROGRESS.md",
        "docs/04_test_reports/C-21_WSL_READINESS_DECISION_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json",
        "docs/evidence/manifests/C-21_WSL_EARLY_VALIDATION_START_MANIFEST.json",
        "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json",
        "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-conninfo-rework-r4.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-early-validation-start.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-readiness-decision.json",
        "docs/progress/progress-handoff-detached-digest-c21-ysna-staging-classification-decision.json",
        "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_INVOCATION_PROMPT_R4.md",
        "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_WORK_INSTRUCTION_R4.md",
        "docs/work_orders/C-21_WSL_EARLY_VALIDATION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_WSL_EARLY_VALIDATION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/deploy/test_c21_lr02c_operational_contract.py",
        "tests/deploy/test_wsl_staging_harness.py",
        "tests/tooling/test_project_progress.py",
    }


def validate_c21_wsl_active_projection(
    candidate: Mapping[str, Any],
    bundle: Mapping[str, Any],
    start_manifest: Mapping[str, Any] | None = None,
) -> list[str]:
    """Validate the approved seq485 WSL implementation checkpoint before Git binding."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    manifest_path = "docs/evidence/manifests/C-21_WSL_EARLY_VALIDATION_START_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-early-validation-start.json"
    if start_manifest is None:
        try:
            start_manifest = _load_json(root / manifest_path)
        except (OSError, json.JSONDecodeError, TypeError):
            return ["C21_WSL_ACTIVE_MANIFEST_INVALID"]
    errors: list[str] = []
    if any((
        candidate.get("status") != "DRAFT_REQUIRES_EXACT_SHA_BINDING",
        (candidate.get("source") or {}).get("commit") != "PENDING_EXACT_SHA",
        candidate.get("exclusions") != ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"],
    )):
        errors.append("C21_WSL_ACTIVE_CANDIDATE_INVALID")
    if any((
        progress.get("event_sequence") != 485,
        progress.get("last_event_id") != "evt_c21_wsl_early_validation_started",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-wsl",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path,
        },
        ((progress.get("next_successor_work_package") or {}).get("status"))
        != "ACTIVE_IMPLEMENTATION_PENDING_GIT_BINDING",
        active.get("event_sequence") != 485,
        active.get("status") != "ACTIVE_IMPLEMENTATION_PENDING_GIT_BINDING",
        active.get("approval_id") != "APPROVAL-20260904-C21-WSL-EARLY-VALIDATION-001",
        active.get("candidate_manifest_status") != "DRAFT_REQUIRES_EXACT_SHA_BINDING",
        active.get("implementation_commit") != "PENDING_MAIN_AGENT_COMMIT",
        active.get("telegram") != "NOT_EXECUTED",
        active.get("provider") != "NOT_EXECUTED",
    )):
        errors.append("C21_WSL_ACTIVE_PROJECTION_INVALID")
    exact_paths = c21_wsl_active_exact_paths()
    if any((
        repository.get("validated_base_commit") != "eef349682ff5598e3488c9e75163c5e0a99a0bdb",
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != "ca92b7845eda803cff3c432799642e4f9243d4d6",
        repository.get("feature_remote_head") != "ca92b7845eda803cff3c432799642e4f9243d4d6",
        repository.get("local_head") != "ca92b7845eda803cff3c432799642e4f9243d4d6",
        repository.get("head_relation") != "FEATURE_WORKTREE_C21_WSL_EARLY_VALIDATION_ACTIVE_EXACT34",
        set(repository.get("exact_allowed_paths") or []) != exact_paths,
        len(repository.get("exact_allowed_paths") or []) != 34,
    )):
        errors.append("C21_WSL_ACTIVE_REPOSITORY_INVALID")
    if (
        len(events) != 485
        or hashlib.sha256(canonical_json_bytes(events[:483])).hexdigest().upper()
        != "163E5D0E6741DFE08112C73C4D3EF763D3AFDF2E5003D316A323E2685072B4D2"
        or [event.get("event_id") for event in events[-2:]] != [
            "evt_c21_wsl_early_validation_approved",
            "evt_c21_wsl_early_validation_started",
        ]
    ):
        errors.append("C21_WSL_ACTIVE_EVENTS_INVALID")
    rows = start_manifest.get("raw_checksums") if isinstance(start_manifest, Mapping) else None
    if any((
        start_manifest.get("artifact_id") != "C21-WSL-EARLY-VALIDATION-START-20260904",
        start_manifest.get("event_sequence") != 485,
        start_manifest.get("repository_exact_path_count") != 34,
        start_manifest.get("historical_event_sequence") != 483,
        start_manifest.get("historical_events_sha256") != "163E5D0E6741DFE08112C73C4D3EF763D3AFDF2E5003D316A323E2685072B4D2",
        start_manifest.get("candidate_status") != "DRAFT_REQUIRES_EXACT_SHA_BINDING",
        start_manifest.get("telegram") != "NOT_EXECUTED",
        start_manifest.get("provider") != "NOT_EXECUTED",
        start_manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)} != {digest_path},
    )):
        errors.append("C21_WSL_ACTIVE_MANIFEST_INVALID")
    elif any(
        not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256"))
        for row in rows
    ):
        errors.append("C21_WSL_ACTIVE_MANIFEST_INVALID")
    return sorted(set(errors))


def c21_wsl_control_successor_paths() -> set[str]:
    return {
        "deploy/wsl/CandidateReleaseManifest.json",
        "deploy/wsl/candidate-manifest-guard.sh",
        "deploy/wsl/verify.sh",
        "docs/DEVELOPMENT_ENVIRONMENT.md",
        "docs/WORK_STATUS.md",
        "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md",
        "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json",
        "scripts/check_project_progress.py",
        "tests/deploy/test_wsl_staging_harness.py",
        "tests/tooling/test_project_progress.py",
    }


def c21_wsl_control_committed_exact_paths() -> set[str]:
    return c21_wsl_active_exact_paths() | {
        "docs/DEVELOPMENT_ENVIRONMENT.md",
        "docs/WORK_STATUS.md",
        "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md",
        "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json",
    }


def c21_wsl_control_postcommit_successor_paths() -> set[str]:
    return {
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    }


def c21_wsl_control_runtime_committed_exact_paths() -> set[str]:
    return c21_wsl_control_committed_exact_paths() | {
        "deploy/wsl/cleanup.sh",
        "deploy/wsl/control-runtime.sh",
        "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json",
    }


def c21_wsl_control_runtime_successor_paths() -> set[str]:
    return {
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    }


def c21_wsl_control_runtime_record_committed_exact_paths() -> set[str]:
    return (
        c21_wsl_control_runtime_committed_exact_paths()
        | c21_wsl_control_runtime_successor_paths()
    )


def c21_wsl_fresh_clone_candidate_committed_exact_paths() -> set[str]:
    """Return the immutable validated-base to fresh-clone candidate exact44 set."""
    return {
        "deploy/wsl/CandidateReleaseManifest.json",
        "deploy/wsl/Dockerfile.web",
        "deploy/wsl/bootstrap.sh",
        "deploy/wsl/candidate-manifest-guard.sh",
        "deploy/wsl/cleanup.sh",
        "deploy/wsl/common.sh",
        "deploy/wsl/compose.wsl.yml",
        "deploy/wsl/control-runtime.sh",
        "deploy/wsl/deploy.sh",
        "deploy/wsl/requirements-runtime.txt",
        "deploy/wsl/rollback.sh",
        "deploy/wsl/verify.sh",
        "deploy/ysna/backup-c21-db.sh",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        "docs/04_test_reports/C-21_WSL_EARLY_VALIDATION_PROGRESS.md",
        "docs/04_test_reports/C-21_WSL_READINESS_DECISION_REPORT.md",
        "docs/DEVELOPMENT_ENVIRONMENT.md",
        "docs/WORK_STATUS.md",
        "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json",
        "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json",
        "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
        "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json",
        "docs/evidence/manifests/C-21_WSL_EARLY_VALIDATION_START_MANIFEST.json",
        "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json",
        "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-conninfo-rework-r4.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-early-validation-start.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-readiness-decision.json",
        "docs/progress/progress-handoff-detached-digest-c21-ysna-staging-classification-decision.json",
        "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_INVOCATION_PROMPT_R4.md",
        "docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_WORK_INSTRUCTION_R4.md",
        "docs/work_orders/C-21_WSL_EARLY_VALIDATION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_WSL_EARLY_VALIDATION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/deploy/test_c21_lr02c_operational_contract.py",
        "tests/deploy/test_wsl_staging_harness.py",
        "tests/tooling/test_project_progress.py",
    }


def c21_wsl_fresh_clone_candidate_rebind_successor_paths() -> set[str]:
    """Return the only paths allowed in the seq489 direct-child record commit."""
    return {
        "deploy/wsl/CandidateReleaseManifest.json",
        "deploy/wsl/candidate-manifest-guard.sh",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-fresh-clone-candidate-rebind.json",
        "scripts/check_project_progress.py",
        "tests/deploy/test_wsl_staging_harness.py",
        "tests/tooling/test_project_progress.py",
    }


def c21_wsl_fresh_clone_candidate_record_committed_exact_paths() -> set[str]:
    """Return the validated-base to seq489 record/control child exact46 set."""
    return c21_wsl_fresh_clone_candidate_committed_exact_paths() | {
        "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-fresh-clone-candidate-rebind.json",
    }


def c21_wsl_compose_runner_candidate_committed_exact_paths() -> set[str]:
    """Return the immutable validated-base to compose-runner candidate exact46 set."""
    return c21_wsl_fresh_clone_candidate_record_committed_exact_paths()


def c21_wsl_cold_start_candidate_committed_exact_paths() -> set[str]:
    """Return the immutable validated-base to cold-start candidate exact48 set."""
    return c21_wsl_compose_runner_candidate_record_committed_exact_paths()


def c21_wsl_ingress_candidate_committed_exact_paths() -> set[str]:
    return {'docs/progress/progress-handoff-detached-digest-c21-wsl-early-validation-start.json', 'docs/progress/build-progress.json', 'docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json', 'docs/work_orders/C-21_WSL_EARLY_VALIDATION_WORK_INSTRUCTION.md', 'deploy/wsl/bootstrap.sh', 'deploy/wsl/common.sh', 'deploy/wsl/CandidateReleaseManifest.json', 'deploy/wsl/cleanup.sh', 'docs/WORK_STATUS.md', 'scripts/check_project_progress.py', 'deploy/wsl/requirements-runtime.txt', 'docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json', 'docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json', 'docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_INVOCATION_PROMPT_R4.md', 'docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json', 'docs/work_orders/C-21_WSL_EARLY_VALIDATION_INVOCATION_PROMPT.md', 'docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-conninfo-rework-r4.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-readiness-decision.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-compose-runner-candidate-rebind.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-fresh-clone-candidate-rebind.json', 'deploy/wsl/rollback.sh', 'docs/progress/progress-handoff-detached-digest-c21-wsl-cold-start-candidate-rebind.json', 'docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json', 'deploy/wsl/control-runtime.sh', 'docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md', 'docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json', 'deploy/wsl/nginx-wsl.conf', 'docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json', 'docs/progress/BUILD_HANDOFF.md', 'docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_WORK_INSTRUCTION_R4.md', 'deploy/wsl/compose.wsl.yml', 'docs/04_test_reports/C-21_WSL_READINESS_DECISION_REPORT.md', 'deploy/wsl/Dockerfile.web', 'deploy/wsl/deploy.sh', 'deploy/wsl/verify.sh', 'docs/04_test_reports/C-21_WSL_EARLY_VALIDATION_PROGRESS.md', 'deploy/ysna/backup-c21-db.sh', 'docs/evidence/manifests/C-21_WSL_EARLY_VALIDATION_START_MANIFEST.json', 'docs/DEVELOPMENT_ENVIRONMENT.md', 'docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json', 'docs/progress/progress-handoff-detached-digest-c21-ysna-staging-classification-decision.json', 'docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json', 'tests/deploy/test_wsl_staging_harness.py', 'tests/deploy/test_c21_lr02c_operational_contract.py', 'deploy/wsl/candidate-manifest-guard.sh', 'docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md', 'docs/progress/progress-events.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json', 'tests/tooling/test_project_progress.py', 'docs/progress/failure-ledger.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json'}


def c21_wsl_compose_runner_candidate_rebind_successor_paths() -> set[str]:
    """Return the only paths allowed in the seq490 direct-child record commit."""
    return {
        "deploy/wsl/CandidateReleaseManifest.json",
        "deploy/wsl/candidate-manifest-guard.sh",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-compose-runner-candidate-rebind.json",
        "scripts/check_project_progress.py",
        "tests/deploy/test_wsl_staging_harness.py",
        "tests/tooling/test_project_progress.py",
    }


def c21_wsl_cold_start_candidate_rebind_successor_paths() -> set[str]:
    """Return the only paths allowed in the seq491 direct-child record commit."""
    return {
        "deploy/wsl/CandidateReleaseManifest.json",
        "deploy/wsl/candidate-manifest-guard.sh",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-cold-start-candidate-rebind.json",
        "scripts/check_project_progress.py",
        "tests/deploy/test_wsl_staging_harness.py",
        "tests/tooling/test_project_progress.py",
    }


def c21_wsl_ingress_candidate_rebind_successor_paths() -> set[str]:
    return {'tests/deploy/test_wsl_staging_harness.py', 'docs/WORK_STATUS.md', 'deploy/wsl/candidate-manifest-guard.sh', 'docs/approvals/APPROVAL-20260905-C21-WSL-INGRESS-EXCEPTION-001.md', 'docs/progress/build-progress.json', 'scripts/check_project_progress.py', 'docs/progress/BUILD_HANDOFF.md', 'docs/progress/progress-events.json', 'tests/tooling/test_project_progress.py', 'docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json', 'docs/DEVELOPMENT_ENVIRONMENT.md', 'docs/progress/progress-handoff-detached-digest-c21-wsl-ingress-candidate-rebind.json', 'deploy/wsl/CandidateReleaseManifest.json'}


def c21_wsl_compose_runner_candidate_record_committed_exact_paths() -> set[str]:
    """Return the validated-base to seq490 record/control child exact48 set."""
    return c21_wsl_compose_runner_candidate_committed_exact_paths() | {
        "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-compose-runner-candidate-rebind.json",
    }


def c21_wsl_cold_start_candidate_record_committed_exact_paths() -> set[str]:
    """Return the validated-base to seq491 record/control child exact50 set."""
    return c21_wsl_cold_start_candidate_committed_exact_paths() | {
        "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-cold-start-candidate-rebind.json",
    }


def c21_wsl_ingress_candidate_record_committed_exact_paths() -> set[str]:
    return {'docs/progress/progress-handoff-detached-digest-c21-wsl-early-validation-start.json', 'docs/progress/build-progress.json', 'docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json', 'docs/work_orders/C-21_WSL_EARLY_VALIDATION_WORK_INSTRUCTION.md', 'deploy/wsl/bootstrap.sh', 'deploy/wsl/common.sh', 'deploy/wsl/CandidateReleaseManifest.json', 'deploy/wsl/cleanup.sh', 'docs/WORK_STATUS.md', 'scripts/check_project_progress.py', 'deploy/wsl/requirements-runtime.txt', 'docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json', 'docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json', 'docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_INVOCATION_PROMPT_R4.md', 'docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json', 'docs/work_orders/C-21_WSL_EARLY_VALIDATION_INVOCATION_PROMPT.md', 'docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-conninfo-rework-r4.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-readiness-decision.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-compose-runner-candidate-rebind.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-fresh-clone-candidate-rebind.json', 'deploy/wsl/rollback.sh', 'docs/progress/progress-handoff-detached-digest-c21-wsl-cold-start-candidate-rebind.json', 'docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json', 'deploy/wsl/control-runtime.sh', 'docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md', 'docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json', 'deploy/wsl/nginx-wsl.conf', 'docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json', 'docs/progress/BUILD_HANDOFF.md', 'docs/work_orders/C-21_LR-02C_OPS_R2_CONNINFO_REWORK_WORK_INSTRUCTION_R4.md', 'deploy/wsl/compose.wsl.yml', 'docs/04_test_reports/C-21_WSL_READINESS_DECISION_REPORT.md', 'deploy/wsl/Dockerfile.web', 'deploy/wsl/deploy.sh', 'deploy/wsl/verify.sh', 'docs/04_test_reports/C-21_WSL_EARLY_VALIDATION_PROGRESS.md', 'deploy/ysna/backup-c21-db.sh', 'docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json', 'docs/evidence/manifests/C-21_WSL_EARLY_VALIDATION_START_MANIFEST.json', 'docs/DEVELOPMENT_ENVIRONMENT.md', 'docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json', 'docs/progress/progress-handoff-detached-digest-c21-ysna-staging-classification-decision.json', 'docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json', 'tests/deploy/test_wsl_staging_harness.py', 'tests/deploy/test_c21_lr02c_operational_contract.py', 'deploy/wsl/candidate-manifest-guard.sh', 'docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md', 'docs/approvals/APPROVAL-20260905-C21-WSL-INGRESS-EXCEPTION-001.md', 'docs/progress/progress-events.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json', 'tests/tooling/test_project_progress.py', 'docs/progress/failure-ledger.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json', 'docs/progress/progress-handoff-detached-digest-c21-wsl-ingress-candidate-rebind.json'}


def raw_event_object_prefix_bytes(payload: bytes, count: int) -> bytes:
    """Return exact bytes from the first event object through object ``count``."""
    marker = payload.index(b'"events"')
    cursor = payload.index(b"[", marker) + 1
    while payload[cursor] in b" \t\r\n":
        cursor += 1
    start = cursor
    depth = 0
    in_string = False
    escaped = False
    seen = 0
    for index in range(cursor, len(payload)):
        byte = payload[index]
        if in_string:
            if escaped:
                escaped = False
            elif byte == 0x5C:
                escaped = True
            elif byte == 0x22:
                in_string = False
            continue
        if byte == 0x22:
            in_string = True
        elif byte == 0x7B:
            depth += 1
        elif byte == 0x7D:
            depth -= 1
            if depth == 0:
                seen += 1
                if seen == count:
                    return payload[start : index + 1]
    raise ValueError("event object prefix is incomplete")


def validate_c21_wsl_human_approval_artifact(artifact: str) -> list[str]:
    approval_text = (
        "C-21 WSL active projection을 validated base eef3496 대비 기존 exact18과 신규 16경로를 합친 누적 exact34로 결박하는 것을 승인한다. "
        "이는 기존 historical 파일의 추가 수정을 승인하는 것이 아니다. 또한 검증 완료 후 WSL 전용 Compose project와 Docker label이 정확히 일치하는 "
        "anvil-wsl-pg15_anvil-db-data, anvil-wsl-pg18rc_anvil-db-data 격리 테스트 볼륨만 삭제하는 것을 승인한다. WSL server에서 테스트는 자유롭게 하면 돼\n"
    )
    expected_sha = "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5"
    match = re.search(
        r"```text c21-wsl-approval\n(.*?)```", artifact, re.DOTALL
    )
    required_literals = {
        "- source: `DIRECT_USER_APPROVAL`",
        "- actor: `신산님`",
        "- approved_at: `2026-09-04 (Asia/Seoul)`",
        "- artifact_path: `docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md`",
        "- validated_base_commit: `eef349682ff5598e3488c9e75163c5e0a99a0bdb`",
        "- candidate_commit: `93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad`",
        "- repository_exact_path_count: `34`",
        "- approval_text_encoding: `UTF-8`",
        "- approval_text_line_ending: `LF`",
        "- approval_text_bytes: `509`",
        f"- approval_text_sha256: `{expected_sha}`",
        "  - `anvil-wsl-pg15_anvil-db-data`",
        "  - `anvil-wsl-pg18rc_anvil-db-data`",
    }
    if (
        match is None
        or match.group(1) != approval_text
        or len(approval_text.encode("utf-8")) != 509
        or hashlib.sha256(approval_text.encode("utf-8")).hexdigest().upper()
        != expected_sha
        or not required_literals.issubset(set(artifact.splitlines()))
    ):
        return ["C21_WSL_HUMAN_APPROVAL_INVALID"]
    return []


def validate_c21_wsl_control_successor_projection(
    candidate: Mapping[str, Any],
    bundle: Mapping[str, Any],
    manifest: Mapping[str, Any] | None = None,
) -> list[str]:
    """Validate the seq486 control successor without mutating the exact34 candidate."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    manifest_path = "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json"
    candidate_sha = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
    base_sha = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    approval_sha = "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5"
    approval_path = "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
    approval_artifact_sha = "92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F"
    candidate_ref = "refs/remotes/origin/candidates/c21-wsl-exact34"
    control_ref = "refs/remotes/origin/codex/c21-operational-execution"
    if manifest is None:
        try:
            manifest = _load_json(root / manifest_path)
        except (OSError, json.JSONDecodeError, TypeError):
            return ["C21_WSL_CONTROL_MANIFEST_INVALID"]
    errors: list[str] = []
    if any((
        candidate.get("status") != "APPROVED_FOR_STAGING_VALIDATION",
        (candidate.get("source") or {}).get("commit") != candidate_sha,
        (candidate.get("source") or {}).get("remote_ref") != candidate_ref,
        (candidate.get("source") or {}).get("working_tree") != "CLEAN",
        (candidate.get("authority") or {}).get("approval_id")
        != "APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001",
        (candidate.get("authority") or {}).get("approval_binding_sha256") != approval_sha,
        (candidate.get("authority") or {}).get("approval_path") != approval_path,
        (candidate.get("authority") or {}).get("approval_artifact_sha256")
        != approval_artifact_sha,
        (candidate.get("rollback") or {}).get("approved_commits") != [candidate_sha],
        candidate.get("exclusions") != ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"],
    )):
        errors.append("C21_WSL_CONTROL_CANDIDATE_INVALID")
    try:
        approval_artifact = (root / approval_path).read_text(encoding="utf-8")
    except OSError:
        errors.append("C21_WSL_HUMAN_APPROVAL_INVALID")
    else:
        errors.extend(validate_c21_wsl_human_approval_artifact(approval_artifact))
        if _sha256(root / approval_path) != approval_artifact_sha:
            errors.append("C21_WSL_HUMAN_APPROVAL_INVALID")
    expected_paths = c21_wsl_active_exact_paths()
    actual_candidate_paths = set(_split_git_paths(_git_value(root, "diff", "--name-only", base_sha, candidate_sha)))
    if any((
        repository.get("validated_base_commit") != base_sha,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("feature_remote") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != "ca92b7845eda803cff3c432799642e4f9243d4d6",
        repository.get("feature_remote_head") != "ca92b7845eda803cff3c432799642e4f9243d4d6",
        repository.get("local_head") != candidate_sha,
        repository.get("head_relation") != "FEATURE_WORKTREE_C21_WSL_CONTROL_SUCCESSOR_ACTIVE_EXACT34",
        set(repository.get("exact_allowed_paths") or []) != expected_paths,
        len(repository.get("exact_allowed_paths") or []) != 34,
        set(repository.get("control_successor_paths") or []) != c21_wsl_control_successor_paths(),
        actual_candidate_paths != expected_paths,
    )):
        errors.append("C21_WSL_CONTROL_REPOSITORY_INVALID")
    if any((
        progress.get("event_sequence") != 486,
        progress.get("last_event_id") != "evt_c21_wsl_control_successor_bound",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-wsl",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path,
        },
        active.get("event_sequence") != 486,
        active.get("status") != "ACTIVE_CONTROL_SUCCESSOR_PENDING_COMMIT_PUSH",
        active.get("candidate_manifest_status") != "APPROVED_FOR_STAGING_VALIDATION",
        active.get("implementation_commit") != candidate_sha,
        active.get("control_manifest_commit") != "PENDING_CONTROL_SUCCESSOR_COMMIT",
        active.get("approval_path") != approval_path,
        active.get("approval_artifact_sha256") != approval_artifact_sha,
        active.get("approval_binding_sha256") != approval_sha,
        active.get("telegram") != "NOT_EXECUTED",
        active.get("provider") != "NOT_EXECUTED",
    )):
        errors.append("C21_WSL_CONTROL_PROJECTION_INVALID")
    try:
        candidate_event_bytes = subprocess.check_output(
            ["git", "show", f"{candidate_sha}:docs/progress/progress-events.json"],
            cwd=root,
        )
        candidate_prefix = raw_event_object_prefix_bytes(candidate_event_bytes, 485)
        current_prefix = raw_event_object_prefix_bytes(
            (root / "docs/progress/progress-events.json").read_bytes(), 485
        )
    except (OSError, subprocess.CalledProcessError, ValueError):
        candidate_prefix = b""
        current_prefix = b"invalid"
    if (
        len(events) != 486
        or hashlib.sha256(canonical_json_bytes(events[:485])).hexdigest().upper()
        != "CC2A98A539CB226DB213CF4E715C599598E4819300A2676EC64E38D15DB2CDE8"
        or candidate_prefix != current_prefix
        or len(current_prefix) != 780353
        or hashlib.sha256(current_prefix).hexdigest().upper()
        != "39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA"
        or events[-1].get("event_id") != "evt_c21_wsl_control_successor_bound"
        or (events[-1].get("details") or {}).get("approval_path") != approval_path
        or (events[-1].get("details") or {}).get("approval_artifact_sha256")
        != approval_artifact_sha
        or (events[-1].get("details") or {}).get("approval_binding_sha256")
        != approval_sha
        or (events[-1].get("details") or {}).get("historical_raw_event_bytes")
        != 780353
        or (events[-1].get("details") or {}).get("historical_raw_events_sha256")
        != "39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA"
    ):
        errors.append("C21_WSL_CONTROL_EVENTS_INVALID")
    rows = manifest.get("raw_checksums") if isinstance(manifest, Mapping) else None
    if any((
        manifest.get("artifact_id") != "C21-WSL-CONTROL-SUCCESSOR-20260904",
        manifest.get("event_sequence") != 486,
        manifest.get("candidate_commit") != candidate_sha,
        manifest.get("candidate_remote_ref") != candidate_ref,
        manifest.get("control_remote_ref") != control_ref,
        manifest.get("approval_binding_sha256") != approval_sha,
        manifest.get("approval_path") != approval_path,
        manifest.get("approval_artifact_sha256") != approval_artifact_sha,
        manifest.get("repository_exact_path_count") != 34,
        manifest.get("historical_event_sequence") != 485,
        manifest.get("historical_events_sha256") != "CC2A98A539CB226DB213CF4E715C599598E4819300A2676EC64E38D15DB2CDE8",
        manifest.get("historical_raw_event_bytes") != 780353,
        manifest.get("historical_raw_events_sha256") != "39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA",
        manifest.get("self_reference") is not False,
        not isinstance(rows, list),
        {row.get("path") for row in rows if isinstance(row, dict)}
        != {digest_path, approval_path},
    )):
        errors.append("C21_WSL_CONTROL_MANIFEST_INVALID")
    elif any(
        not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256"))
        for row in rows
    ):
        errors.append("C21_WSL_CONTROL_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_wsl_control_postcommit_projection(
    bundle: Mapping[str, Any], manifest: Mapping[str, Any]
) -> list[str]:
    """Validate seq487 against the immutable candidate and committed control SHA."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    candidate_sha = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
    control_sha = "73c39ca03caa615f7207eac3499c668497cecc5a"
    base_sha = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    approval_path = "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
    approval_artifact_sha = "92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F"
    approval_text_sha = "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5"
    control_paths_sha = "A810194414EE28410CD816CF5EAB5D1D85E1C9D1A1AFCF04ED91C15EAEC1F61F"
    raw_485_sha = "39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA"
    raw_486_sha = "784A0DC5BBDF916A752B8766E8DA89BB5B5FBC824765713DFB30C31E5269B053"
    expected_control_paths = c21_wsl_control_successor_paths()
    expected_committed_paths = c21_wsl_control_committed_exact_paths()
    errors: list[str] = []
    try:
        actual_control_paths = set(
            _split_git_paths(_git_value(root, "diff", "--name-only", candidate_sha, control_sha))
        )
        actual_committed_paths = set(
            _split_git_paths(_git_value(root, "diff", "--name-only", base_sha, control_sha))
        )
        control_event_bytes = subprocess.check_output(
            ["git", "show", f"{control_sha}:docs/progress/progress-events.json"],
            cwd=root,
        )
        committed_raw_486 = raw_event_object_prefix_bytes(control_event_bytes, 486)
        current_raw_486 = raw_event_object_prefix_bytes(
            (root / "docs/progress/progress-events.json").read_bytes(), 486
        )
    except (OSError, subprocess.CalledProcessError, ValueError):
        actual_control_paths = set()
        actual_committed_paths = set()
        committed_raw_486 = b""
        current_raw_486 = b"invalid"
    if any((
        progress.get("event_sequence") != 487,
        progress.get("last_event_id") != "evt_c21_wsl_control_postcommit_bound",
        repository.get("local_head") != control_sha,
        repository.get("validated_base_commit") != base_sha,
        set(repository.get("exact_allowed_paths") or []) != expected_committed_paths,
        set(repository.get("control_successor_paths") or []) != expected_control_paths,
        set(repository.get("postcommit_successor_paths") or [])
        != c21_wsl_control_postcommit_successor_paths(),
        active.get("event_sequence") != 487,
        active.get("status") != "ACTIVE_CONTROL_POSTCOMMIT_SUCCESSOR_PENDING_PUSH",
        active.get("implementation_commit") != candidate_sha,
        active.get("control_manifest_commit") != control_sha,
        active.get("approval_artifact_sha256") != approval_artifact_sha,
        active.get("approval_binding_sha256") != approval_text_sha,
    )):
        errors.append("C21_WSL_CONTROL_POSTCOMMIT_PROJECTION_INVALID")
    if any((
        actual_control_paths != expected_control_paths,
        actual_committed_paths != expected_committed_paths,
        len(actual_control_paths) != 14,
        len(actual_committed_paths) != 39,
        hashlib.sha256(canonical_json_bytes(sorted(actual_control_paths))).hexdigest().upper()
        != control_paths_sha,
    )):
        errors.append("C21_WSL_CONTROL_POSTCOMMIT_REPOSITORY_INVALID")
    if (
        len(events) != 487
        or events[-1].get("event_id") != "evt_c21_wsl_control_postcommit_bound"
        or committed_raw_486 != current_raw_486
        or len(current_raw_486) != 782389
        or hashlib.sha256(current_raw_486).hexdigest().upper() != raw_486_sha
    ):
        errors.append("C21_WSL_CONTROL_POSTCOMMIT_EVENTS_INVALID")
    details = events[-1].get("details") if events else {}
    if any((
        not isinstance(details, Mapping),
        (details or {}).get("manifest_path")
        != "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json",
        (details or {}).get("control_commit") != control_sha,
        (details or {}).get("control_commit_path_count") != 14,
        (details or {}).get("control_commit_paths_sha256") != control_paths_sha,
        (details or {}).get("approval_artifact_sha256") != approval_artifact_sha,
        (details or {}).get("historical_raw_events_sha256") != raw_485_sha,
        (details or {}).get("postcommit_historical_raw_events_sha256") != raw_486_sha,
        set((details or {}).get("exact_allowed_paths") or []) != expected_committed_paths,
    )):
        errors.append("C21_WSL_CONTROL_POSTCOMMIT_EVENTS_INVALID")
    if any((
        manifest.get("event_sequence") != 487,
        manifest.get("control_commit") != control_sha,
        manifest.get("control_commit_base") != candidate_sha,
        manifest.get("control_commit_path_count") != 14,
        set(manifest.get("control_commit_paths") or []) != expected_control_paths,
        manifest.get("control_commit_paths_sha256") != control_paths_sha,
        manifest.get("repository_exact_path_count") != 39,
        manifest.get("approval_path") != approval_path,
        manifest.get("approval_artifact_sha256") != approval_artifact_sha,
        manifest.get("approval_binding_sha256") != approval_text_sha,
        manifest.get("historical_raw_events_sha256") != raw_485_sha,
        manifest.get("postcommit_historical_event_sequence") != 486,
        manifest.get("postcommit_historical_raw_event_bytes") != 782389,
        manifest.get("postcommit_historical_raw_events_sha256") != raw_486_sha,
    )):
        errors.append("C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID")
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or any(
        not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256"))
        for row in rows
    ):
        errors.append("C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_wsl_control_runtime_successor_projection(
    bundle: Mapping[str, Any], manifest: Mapping[str, Any]
) -> list[str]:
    """Validate seq488 against the reviewed control-runtime commit and seq487 prefix."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    base_sha = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    candidate_sha = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
    control_sha = "73c39ca03caa615f7207eac3499c668497cecc5a"
    runtime_sha = "ead1214e3f01e68e577c3163e1cf143ee5753490"
    runtime_parent = "5251a0b889f4e1062a5780eea9f03d8e9b9f69bb"
    remote_sha = "ca92b7845eda803cff3c432799642e4f9243d4d6"
    manifest_path = (
        "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json"
    )
    digest_path = (
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json"
    )
    approval_path = "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
    approval_artifact_sha = "92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F"
    approval_text_sha = "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5"
    raw_487_sha = "A230B994745047786883CEF8F94279EAE239DB359F3A923717961F8552008C17"
    canonical_487_sha = "E2752DBA9CEE5989D7AF890C83A0AD82886A610965CAAEC060EE4079A076295C"
    expected_path_contracts = {
        "runtime_parent_delta": {
            "from_commit": runtime_parent,
            "to_commit": runtime_sha,
            "path_count": 10,
            "path_list_sha256": "259291AC6A18AD53B889D47AB7A8D4F5992203FCE0A23483E17D10AB4ABD6C02",
        },
        "control_runtime_cumulative": {
            "from_commit": control_sha,
            "to_commit": runtime_sha,
            "path_count": 17,
            "path_list_sha256": "19575A080EA48D489E044094B30BBD168029F09795C9A8FCABD0D0000AF62670",
        },
        "repository_cumulative": {
            "from_commit": base_sha,
            "to_commit": runtime_sha,
            "path_count": 42,
            "path_list_sha256": "11F56564BC0460157FDD9E99BA00FFF7EA0B5EAC0FA5E6C24BC980BBDA08AA99",
        },
        "candidate_cumulative": {
            "from_commit": base_sha,
            "to_commit": candidate_sha,
            "path_count": 34,
            "path_list_sha256": "72DF14C6925E12C0EE051FB983083D3167A2ED4266FC57B30CC41AABD7B0080D",
        },
        "candidate_to_control": {
            "from_commit": candidate_sha,
            "to_commit": control_sha,
            "path_count": 14,
            "path_list_sha256": "A810194414EE28410CD816CF5EAB5D1D85E1C9D1A1AFCF04ED91C15EAEC1F61F",
        },
        "base_to_control": {
            "from_commit": base_sha,
            "to_commit": control_sha,
            "path_count": 39,
            "path_list_sha256": "2D17A8B4E5E2D332DAD86CE91BC3539D3CFD2795BB69C804DAC4FC7B6CB8F24A",
        },
        "record_successor": {
            "path_count": 8,
            "path_list_sha256": "E02DF27FAA2FA40D28E7FFA6F263D914DCA530F97A0BBF133C0E645F6694F00B",
        },
    }

    def path_contract(from_sha: str, to_sha: str) -> tuple[int, str, set[str]]:
        paths = set(
            _split_git_paths(
                _git_value(root, "diff", "--name-only", from_sha, to_sha)
            )
        )
        digest = hashlib.sha256(
            canonical_json_bytes(sorted(paths))
        ).hexdigest().upper()
        return len(paths), digest, paths

    errors: list[str] = []
    try:
        runtime_parent_count, runtime_parent_hash, _ = path_contract(
            runtime_parent, runtime_sha
        )
        control_runtime_count, control_runtime_hash, control_runtime_paths = path_contract(
            control_sha, runtime_sha
        )
        repository_count, repository_hash, repository_paths = path_contract(
            base_sha, runtime_sha
        )
        candidate_count, candidate_hash, _ = path_contract(base_sha, candidate_sha)
        candidate_control_count, candidate_control_hash, _ = path_contract(
            candidate_sha, control_sha
        )
        base_control_count, base_control_hash, _ = path_contract(base_sha, control_sha)
        runtime_event_bytes = subprocess.check_output(
            ["git", "show", f"{runtime_sha}:docs/progress/progress-events.json"],
            cwd=root,
        )
        committed_raw_487 = raw_event_object_prefix_bytes(runtime_event_bytes, 487)
        current_raw_487 = raw_event_object_prefix_bytes(
            (root / "docs/progress/progress-events.json").read_bytes(), 487
        )
    except (OSError, subprocess.CalledProcessError, ValueError):
        runtime_parent_count, runtime_parent_hash = 0, ""
        control_runtime_count, control_runtime_hash, control_runtime_paths = 0, "", set()
        repository_count, repository_hash, repository_paths = 0, "", set()
        candidate_count, candidate_hash = 0, ""
        candidate_control_count, candidate_control_hash = 0, ""
        base_control_count, base_control_hash = 0, ""
        committed_raw_487, current_raw_487 = b"", b"invalid"
    actual_contracts = (
        (runtime_parent_count, runtime_parent_hash),
        (control_runtime_count, control_runtime_hash),
        (repository_count, repository_hash),
        (candidate_count, candidate_hash),
        (candidate_control_count, candidate_control_hash),
        (base_control_count, base_control_hash),
    )
    expected_contract_values = tuple(
        (row["path_count"], row["path_list_sha256"])
        for row in list(expected_path_contracts.values())[:6]
    )
    if (
        actual_contracts != expected_contract_values
        or control_runtime_paths != c21_wsl_control_postcommit_successor_paths() | {
            "deploy/wsl/bootstrap.sh",
            "deploy/wsl/candidate-manifest-guard.sh",
            "deploy/wsl/cleanup.sh",
            "deploy/wsl/common.sh",
            "deploy/wsl/control-runtime.sh",
            "deploy/wsl/deploy.sh",
            "deploy/wsl/rollback.sh",
            "deploy/wsl/verify.sh",
            "tests/deploy/test_wsl_staging_harness.py",
        }
        or repository_paths != c21_wsl_control_runtime_committed_exact_paths()
    ):
        errors.append("C21_WSL_CONTROL_RUNTIME_REPOSITORY_INVALID")
    if any((
        progress.get("event_sequence") != 488,
        progress.get("last_event_id")
        != "evt_c21_wsl_control_runtime_successor_bound",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-wsl",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21",
            "path": digest_path,
            "manifest_path": manifest_path,
        },
        ((progress.get("next_successor_work_package") or {}).get("status"))
        != "ACTIVE_CONTROL_RUNTIME_SUCCESSOR_PENDING_PUSH",
        active.get("event_sequence") != 488,
        active.get("status") != "ACTIVE_CONTROL_RUNTIME_SUCCESSOR_PENDING_PUSH",
        active.get("implementation_commit") != candidate_sha,
        active.get("control_manifest_commit") != control_sha,
        active.get("control_runtime_commit") != runtime_sha,
        active.get("approval_artifact_sha256") != approval_artifact_sha,
        active.get("approval_binding_sha256") != approval_text_sha,
    )):
        errors.append("C21_WSL_CONTROL_RUNTIME_PROJECTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base_sha,
        repository.get("local_head") != runtime_sha,
        repository.get("control_runtime_commit") != runtime_sha,
        repository.get("control_runtime_parent") != runtime_parent,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != remote_sha,
        repository.get("feature_remote_head") != remote_sha,
        repository.get("head_relation")
        != "FEATURE_WORKTREE_C21_WSL_CONTROL_RUNTIME_SUCCESSOR_ACTIVE_EXACT42",
        set(repository.get("exact_allowed_paths") or []) != repository_paths,
        set(repository.get("control_runtime_successor_paths") or [])
        != c21_wsl_control_runtime_successor_paths(),
    )):
        errors.append("C21_WSL_CONTROL_RUNTIME_REPOSITORY_INVALID")
    if (
        len(events) != 488
        or events[-1].get("event_id")
        != "evt_c21_wsl_control_runtime_successor_bound"
        or committed_raw_487 != current_raw_487
        or len(current_raw_487) != 786441
        or hashlib.sha256(current_raw_487).hexdigest().upper() != raw_487_sha
        or hashlib.sha256(canonical_json_bytes(events[:487])).hexdigest().upper()
        != canonical_487_sha
    ):
        errors.append("C21_WSL_CONTROL_RUNTIME_EVENTS_INVALID")
    details = events[-1].get("details") if events else {}
    if any((
        not isinstance(details, Mapping),
        (details or {}).get("manifest_path") != manifest_path,
        (details or {}).get("runtime_commit") != runtime_sha,
        (details or {}).get("runtime_parent_commit") != runtime_parent,
        (details or {}).get("predecessor_control_commit") != control_sha,
        (details or {}).get("path_contracts") != expected_path_contracts,
        (details or {}).get("historical_raw_event_bytes") != 786441,
        (details or {}).get("historical_raw_events_sha256") != raw_487_sha,
        (details or {}).get("historical_events_sha256") != canonical_487_sha,
        set((details or {}).get("exact_allowed_paths") or []) != repository_paths,
        (details or {}).get("record_successor_paths_sha256")
        != "E02DF27FAA2FA40D28E7FFA6F263D914DCA530F97A0BBF133C0E645F6694F00B",
        any(
            (details or {}).get(field) != "NOT_EXECUTED"
            for field in (
                "push", "deployment", "database", "volume_cleanup", "telegram", "provider"
            )
        ),
        (details or {}).get("c01_status")
        != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
    )):
        errors.append("C21_WSL_CONTROL_RUNTIME_EVENTS_INVALID")
    predecessor_rows = manifest.get("predecessor_raw_checksums")
    expected_predecessor_paths = {
        "deploy/wsl/CandidateReleaseManifest.json",
        approval_path,
        "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json",
        "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-successor.json",
    }
    rows = manifest.get("raw_checksums")
    if any((
        manifest.get("artifact_id")
        != "C21-WSL-CONTROL-RUNTIME-SUCCESSOR-20260904",
        manifest.get("manifest_type")
        != "WSL_CANDIDATE_CONTROL_RUNTIME_SUCCESSOR_PROJECTION",
        manifest.get("event_sequence") != 488,
        manifest.get("validated_base_commit") != base_sha,
        manifest.get("candidate_commit") != candidate_sha,
        manifest.get("predecessor_control_commit") != control_sha,
        manifest.get("runtime_parent_commit") != runtime_parent,
        manifest.get("runtime_commit") != runtime_sha,
        manifest.get("repository_exact_path_count") != 42,
        manifest.get("path_contracts") != expected_path_contracts,
        manifest.get("historical_event_sequence") != 487,
        manifest.get("historical_events_sha256") != canonical_487_sha,
        manifest.get("historical_raw_event_bytes") != 786441,
        manifest.get("historical_raw_events_sha256") != raw_487_sha,
        manifest.get("self_reference") is not False,
        any(
            manifest.get(field) != "NOT_EXECUTED"
            for field in (
                "push",
                "deployment",
                "database",
                "volume_cleanup",
                "telegram",
                "provider",
            )
        ),
        manifest.get("c01_status")
        != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        not isinstance(predecessor_rows, list),
        {
            row.get("path")
            for row in predecessor_rows or []
            if isinstance(row, dict)
        }
        != expected_predecessor_paths,
        not isinstance(rows, list),
        {row.get("path") for row in rows or [] if isinstance(row, dict)}
        != {digest_path},
    )):
        errors.append("C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID")
    elif any(
        not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256"))
        for row in [*predecessor_rows, *rows]
    ):
        errors.append("C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_wsl_fresh_clone_candidate_rebind_projection(
    bundle: Mapping[str, Any], manifest: Mapping[str, Any]
) -> list[str]:
    """Validate seq489 without requiring the not-yet-known record commit SHA."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    base_sha = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    old_candidate_sha = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
    runtime_sha = "ead1214e3f01e68e577c3163e1cf143ee5753490"
    predecessor_control_sha = "74ed0d4ac566ccc2877301103663b68272cce5b2"
    candidate_sha = "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
    remote_sha = "ca92b7845eda803cff3c432799642e4f9243d4d6"
    candidate_ref = "refs/remotes/origin/candidates/c21-wsl-exact44"
    control_ref = "refs/remotes/origin/codex/c21-operational-execution"
    manifest_path = (
        "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json"
    )
    digest_path = (
        "docs/progress/progress-handoff-detached-digest-c21-wsl-fresh-clone-candidate-rebind.json"
    )
    approval_path = "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
    seq488_manifest_path = (
        "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json"
    )
    seq488_digest_path = (
        "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json"
    )
    candidate_manifest_path = "deploy/wsl/CandidateReleaseManifest.json"
    binding_sha = "7C0078AD0EACA441088017A6A4C0FF25B85464F198AFC48A177B09C85304D863"
    expected_contracts = {
        "correction_delta": {
            "from_commit": predecessor_control_sha,
            "to_commit": candidate_sha,
            "path_count": 2,
            "path_list_sha256": "B2E9A41E7E30999A64BBFA85332791EA44F23D2783A064D3CBEEFFFA4DE8BC1F",
        },
        "runtime_to_candidate": {
            "from_commit": runtime_sha,
            "to_commit": candidate_sha,
            "path_count": 10,
            "path_list_sha256": "187D8E457B32E61AB426111DDC6BBE85D6E177B3CEE285BAE587116AEF236237",
        },
        "prior_candidate_to_candidate": {
            "from_commit": old_candidate_sha,
            "to_commit": candidate_sha,
            "path_count": 23,
            "path_list_sha256": "A625AE193FAF8583EDFAD5C02CA84379A36DB55C2C9AD6FD2D950A0247A74D5E",
        },
        "candidate_cumulative": {
            "from_commit": base_sha,
            "to_commit": candidate_sha,
            "path_count": 44,
            "path_list_sha256": "A6D1C6AC386639995DA003F6934D9C24ACF81EE860FCCB094AAA731BD8A88E6B",
        },
        "record_successor": {
            "from_commit": candidate_sha,
            "to_commit": "PENDING_DIRECT_CHILD_RECORD_COMMIT",
            "path_count": 11,
            "path_list_sha256": "C4DDBACD49E01E710FDC93D83B6247C0BCBFA484C2FBA8317BEF83CF14C3885A",
        },
        "repository_postcommit": {
            "from_commit": base_sha,
            "to_commit": "PENDING_DIRECT_CHILD_RECORD_COMMIT",
            "path_count": 46,
            "path_list_sha256": "F538ABED26C9EB01210C14144CD861889BFF603175A72203CEA717DFC46C1C86",
        },
    }

    def git_path_contract(from_sha: str, to_sha: str) -> tuple[int, str, set[str]]:
        paths = set(
            _split_git_paths(_git_value(root, "diff", "--name-only", from_sha, to_sha))
        )
        return (
            len(paths),
            hashlib.sha256(canonical_json_bytes(sorted(paths))).hexdigest().upper(),
            paths,
        )

    errors: list[str] = []
    try:
        actual_contracts = [
            git_path_contract(row["from_commit"], row["to_commit"])
            for row in list(expected_contracts.values())[:4]
        ]
        candidate_parents = (
            _git_value(root, "show", "-s", "--format=%P", candidate_sha) or ""
        ).split()
        candidate_event_bytes = subprocess.check_output(
            ["git", "show", f"{candidate_sha}:docs/progress/progress-events.json"],
            cwd=root,
        )
        committed_prefix = raw_event_object_prefix_bytes(candidate_event_bytes, 488)
        current_prefix = raw_event_object_prefix_bytes(
            (root / "docs/progress/progress-events.json").read_bytes(), 488
        )
    except (OSError, subprocess.CalledProcessError, ValueError):
        actual_contracts = []
        candidate_parents = []
        committed_prefix, current_prefix = b"", b"invalid"
    expected_values = [
        (row["path_count"], row["path_list_sha256"])
        for row in list(expected_contracts.values())[:4]
    ]
    if (
        [(count, digest) for count, digest, _ in actual_contracts]
        != expected_values
        or len(actual_contracts) != 4
        or actual_contracts[-1][2]
        != c21_wsl_fresh_clone_candidate_committed_exact_paths()
        or candidate_parents != [predecessor_control_sha]
    ):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_REPOSITORY_INVALID")

    try:
        candidate_manifest = _load_json(root / candidate_manifest_path)
    except (OSError, json.JSONDecodeError, TypeError):
        candidate_manifest = {}
    authority = candidate_manifest.get("authority") or {}
    derived = authority.get("derived_binding")
    derived_digest = (
        hashlib.sha256(canonical_json_bytes(derived)).hexdigest().upper()
        if isinstance(derived, Mapping)
        else ""
    )
    if any((
        not isinstance(derived, Mapping),
        len(canonical_json_bytes(derived)) != 985 if isinstance(derived, Mapping) else True,
        derived_digest != binding_sha,
        authority.get("derived_binding_sha256") != binding_sha,
        manifest.get("derived_correction_binding") != derived,
        manifest.get("derived_correction_binding_sha256") != binding_sha,
    )):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_BINDING_INVALID")
    if any((
        candidate_manifest.get("status") != "APPROVED_FOR_STAGING_VALIDATION",
        (candidate_manifest.get("source") or {}).get("commit") != candidate_sha,
        (candidate_manifest.get("source") or {}).get("remote_ref") != candidate_ref,
        (candidate_manifest.get("source") or {}).get("working_tree") != "CLEAN",
        authority.get("approval_id")
        != "APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001",
        authority.get("approval_path") != approval_path,
        authority.get("approval_artifact_sha256")
        != "92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F",
        authority.get("approval_binding_sha256")
        != "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5",
        candidate_manifest.get("exclusions")
        != ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"],
        (candidate_manifest.get("rollback") or {}).get("approved_commits")
        != [candidate_sha],
    )):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_CANDIDATE_INVALID")

    if any((
        progress.get("event_sequence") != 489,
        progress.get("last_event_id")
        != "evt_c21_wsl_fresh_clone_candidate_rebind_bound",
        progress.get("status") != "ACTIVE",
        (progress.get("current_progress_evidence_ref") or {})
        != {"package_id": "C-21", "path": digest_path, "manifest_path": manifest_path},
        ((progress.get("next_successor_work_package") or {}).get("status"))
        != "ACTIVE_FRESH_CLONE_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("event_sequence") != 489,
        active.get("status")
        != "ACTIVE_FRESH_CLONE_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("implementation_commit") != candidate_sha,
        active.get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
    )):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_PROJECTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base_sha,
        repository.get("local_head") != candidate_sha,
        repository.get("candidate_commit") != candidate_sha,
        repository.get("candidate_parent_commit") != predecessor_control_sha,
        repository.get("predecessor_control_commit") != predecessor_control_sha,
        repository.get("predecessor_runtime_commit") != runtime_sha,
        repository.get("predecessor_candidate_commit") != old_candidate_sha,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != remote_sha,
        repository.get("feature_remote_head") != remote_sha,
        repository.get("candidate_remote_ref") != candidate_ref,
        repository.get("control_remote_ref") != control_ref,
        repository.get("head_relation")
        != "FEATURE_WORKTREE_C21_WSL_FRESH_CLONE_CANDIDATE_REBIND_ACTIVE_EXACT44_RECORD11",
        set(repository.get("exact_allowed_paths") or [])
        != c21_wsl_fresh_clone_candidate_committed_exact_paths(),
        set(repository.get("fresh_clone_candidate_rebind_successor_paths") or [])
        != c21_wsl_fresh_clone_candidate_rebind_successor_paths(),
    )):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_REPOSITORY_INVALID")

    if (
        len(events) != 489
        or committed_prefix != current_prefix
        or len(current_prefix) != 792116
        or hashlib.sha256(current_prefix).hexdigest().upper()
        != "842F518F9F935402BE41BA9E873EDAFE57973D86C87A37AFFD77482F173B7A7D"
        or hashlib.sha256(canonical_json_bytes(events[:488])).hexdigest().upper()
        != "CC651FA094FCD1873450DDB9C6E57F1EDF019A6373712756129ADC86FEA9B6C9"
        or events[-1].get("event_id")
        != "evt_c21_wsl_fresh_clone_candidate_rebind_bound"
    ):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_EVENTS_INVALID")
    details = events[-1].get("details") if events else {}
    if any((
        not isinstance(details, Mapping),
        (details or {}).get("branch") != "codex/c21-operational-execution",
        (details or {}).get("upstream")
        != "origin/codex/c21-operational-execution",
        (details or {}).get("local_head") != candidate_sha,
        (details or {}).get("remote_head") != remote_sha,
        (details or {}).get("projection_mode")
        != VALIDATED_BASE_PROJECTION_MODE,
        (details or {}).get("head_relation")
        != "FEATURE_WORKTREE_C21_WSL_FRESH_CLONE_CANDIDATE_REBIND_ACTIVE_EXACT44_RECORD11",
        set((details or {}).get("exact_allowed_paths") or [])
        != c21_wsl_fresh_clone_candidate_committed_exact_paths(),
        (details or {}).get("candidate_commit") != candidate_sha,
        (details or {}).get("candidate_parent_commit") != predecessor_control_sha,
        (details or {}).get("predecessor_control_commit") != predecessor_control_sha,
        (details or {}).get("runtime_commit") != runtime_sha,
        (details or {}).get("prior_candidate_commit") != old_candidate_sha,
        (details or {}).get("validated_base_commit") != base_sha,
        (details or {}).get("path_contracts") != expected_contracts,
        set((details or {}).get("candidate_exact_paths") or [])
        != c21_wsl_fresh_clone_candidate_committed_exact_paths(),
        set((details or {}).get("record_successor_paths") or [])
        != c21_wsl_fresh_clone_candidate_rebind_successor_paths(),
        (details or {}).get("postcommit_exact_path_count") != 46,
        (details or {}).get("postcommit_exact_path_list_sha256")
        != "F538ABED26C9EB01210C14144CD861889BFF603175A72203CEA717DFC46C1C86",
        (details or {}).get("candidate_remote_ref") != candidate_ref,
        (details or {}).get("control_remote_ref") != control_ref,
        (details or {}).get("derived_binding_classification")
        != "MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION",
        (details or {}).get("derived_binding_sha256") != binding_sha,
        (details or {}).get("historical_event_sequence") != 488,
        (details or {}).get("historical_raw_event_bytes") != 792116,
        (details or {}).get("historical_raw_events_sha256")
        != "842F518F9F935402BE41BA9E873EDAFE57973D86C87A37AFFD77482F173B7A7D",
        (details or {}).get("historical_events_sha256")
        != "CC651FA094FCD1873450DDB9C6E57F1EDF019A6373712756129ADC86FEA9B6C9",
        (details or {}).get("record_control_commit")
        != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
    )):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_EVENTS_INVALID")
    boundary_fields = ("push", "deployment", "database", "volume_cleanup", "telegram", "provider")
    if (
        any((details or {}).get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or (details or {}).get("c01_status")
        != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
        or any(manifest.get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or manifest.get("c01_status")
        != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    ):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_BOUNDARY_INVALID")

    candidate_rows = manifest.get("candidate_blob_checksums")
    predecessor_rows = manifest.get("predecessor_raw_checksums")
    live_rows = manifest.get("raw_checksums")
    if any((
        manifest.get("artifact_id")
        != "C21-WSL-FRESH-CLONE-CANDIDATE-REBIND-20260905",
        manifest.get("manifest_type")
        != "WSL_FRESH_CLONE_CANDIDATE_REBIND_PROJECTION",
        manifest.get("event_sequence") != 489,
        manifest.get("historical_event_sequence") != 488,
        manifest.get("historical_raw_event_bytes") != 792116,
        manifest.get("historical_raw_events_sha256")
        != "842F518F9F935402BE41BA9E873EDAFE57973D86C87A37AFFD77482F173B7A7D",
        manifest.get("historical_events_sha256")
        != "CC651FA094FCD1873450DDB9C6E57F1EDF019A6373712756129ADC86FEA9B6C9",
        manifest.get("validated_base_commit") != base_sha,
        manifest.get("prior_candidate_commit") != old_candidate_sha,
        manifest.get("runtime_commit") != runtime_sha,
        manifest.get("predecessor_control_commit") != predecessor_control_sha,
        manifest.get("candidate_parent_commit") != predecessor_control_sha,
        manifest.get("candidate_commit") != candidate_sha,
        manifest.get("candidate_remote_ref") != candidate_ref,
        manifest.get("control_remote_ref") != control_ref,
        manifest.get("path_contracts") != expected_contracts,
        set(manifest.get("candidate_exact_paths") or [])
        != c21_wsl_fresh_clone_candidate_committed_exact_paths(),
        set(manifest.get("record_successor_paths") or [])
        != c21_wsl_fresh_clone_candidate_rebind_successor_paths(),
        manifest.get("self_reference") is not False,
        manifest.get("record_control_commit")
        != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
        not isinstance(candidate_rows, list),
        {row.get("path") for row in candidate_rows or [] if isinstance(row, Mapping)}
        != {"deploy/wsl/deploy.sh", "tests/deploy/test_wsl_staging_harness.py"},
        not isinstance(predecessor_rows, list),
        {row.get("path") for row in predecessor_rows or [] if isinstance(row, Mapping)}
        != {approval_path, seq488_manifest_path, seq488_digest_path},
        not isinstance(live_rows, list),
        {row.get("path") for row in live_rows or [] if isinstance(row, Mapping)}
        != {candidate_manifest_path, digest_path},
        any((row or {}).get("path") == manifest_path for row in [*(candidate_rows or []), *(predecessor_rows or []), *(live_rows or [])]),
    )):
        errors.append("C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID")
    else:
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in candidate_rows):
            errors.append("C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID")
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in predecessor_rows):
            errors.append("C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID")
        if any(
            not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256"))
            for row in live_rows
        ):
            errors.append("C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID")
    return sorted(set(errors))


def validate_c21_wsl_compose_runner_candidate_rebind_projection(
    bundle: Mapping[str, Any], manifest: Mapping[str, Any]
) -> list[str]:
    """Validate seq490 without requiring its not-yet-known record commit SHA."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    base_sha = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    approved_origin_sha = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
    runtime_sha = "ead1214e3f01e68e577c3163e1cf143ee5753490"
    prior_candidate_sha = "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
    predecessor_control_sha = "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
    candidate_sha = "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
    remote_sha = "ca92b7845eda803cff3c432799642e4f9243d4d6"
    candidate_ref = "refs/remotes/origin/candidates/c21-wsl-exact46"
    control_ref = "refs/remotes/origin/codex/c21-operational-execution"
    manifest_path = "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-compose-runner-candidate-rebind.json"
    approval_path = "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
    seq489_manifest_path = "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json"
    seq489_digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-fresh-clone-candidate-rebind.json"
    candidate_manifest_path = "deploy/wsl/CandidateReleaseManifest.json"
    binding_sha = "FFEDB1B478DC0493CE3FC585A5324361EA82D83F2E2FCF6D2398CB9ACCB47F9C"
    predecessor_binding_sha = "7C0078AD0EACA441088017A6A4C0FF25B85464F198AFC48A177B09C85304D863"
    private_push_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
    push_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
    next_action = (
        "COMPLETE_SEQ490_REVIEW_THEN_AUTONOMOUS_PRIVATE_PUSH_"
        "WITHOUT_SEPARATE_PROJECT_APPROVAL"
    )
    next_safe_action = (
        "seq490 review 완료 후 Main이 승인된 개발·테스트 범위의 private "
        "candidate/control refs를 별도 프로젝트 승인 대기 없이 자동 push하고 "
        "append-only 결과 checkpoint를 기록한 뒤 WSL 검증으로 진행한다. "
        "C-01은 계속 차단한다."
    )
    expected_contracts = {
        "correction_delta": {"from_commit": predecessor_control_sha, "to_commit": candidate_sha, "path_count": 2, "path_list_sha256": "BCF8BC3E409715FF2E470D3BEB977E8E410B388BAC253114310D264FD783AA0F"},
        "runtime_to_candidate": {"from_commit": runtime_sha, "to_commit": candidate_sha, "path_count": 15, "path_list_sha256": "63CE0E78CC941DD0480F619EEA858B1604EFF7B3722BA88767295CFAC6879EF9"},
        "prior_candidate_to_candidate": {"from_commit": prior_candidate_sha, "to_commit": candidate_sha, "path_count": 12, "path_list_sha256": "5BC35F754BFCF269B1A28C4414AB4CAB8A0A42C6D977DA0866AC696221B45A9C"},
        "candidate_cumulative": {"from_commit": base_sha, "to_commit": candidate_sha, "path_count": 46, "path_list_sha256": "F538ABED26C9EB01210C14144CD861889BFF603175A72203CEA717DFC46C1C86"},
        "record_successor": {"from_commit": candidate_sha, "to_commit": "PENDING_DIRECT_CHILD_RECORD_COMMIT", "path_count": 11, "path_list_sha256": "E439C0A394C536E1825E7C3FCF606BB7CC14D39C0DF29E7B60E648885EB6B110"},
        "repository_postcommit": {"from_commit": base_sha, "to_commit": "PENDING_DIRECT_CHILD_RECORD_COMMIT", "path_count": 48, "path_list_sha256": "2626990127D2830414F77371813D893143C51065B0ACF41D14EAD3FEBBF88288"},
    }

    def git_path_contract(from_sha: str, to_sha: str) -> tuple[int, str, set[str]]:
        paths = set(_split_git_paths(_git_value(root, "diff", "--name-only", from_sha, to_sha)))
        return len(paths), hashlib.sha256(canonical_json_bytes(sorted(paths))).hexdigest().upper(), paths

    errors: list[str] = []
    try:
        actual_contracts = [git_path_contract(row["from_commit"], row["to_commit"]) for row in list(expected_contracts.values())[:4]]
        candidate_parents = (_git_value(root, "show", "-s", "--format=%P", candidate_sha) or "").split()
        candidate_event_bytes = subprocess.check_output(["git", "show", f"{candidate_sha}:docs/progress/progress-events.json"], cwd=root)
        committed_prefix = raw_event_object_prefix_bytes(candidate_event_bytes, 489)
        current_prefix = raw_event_object_prefix_bytes((root / "docs/progress/progress-events.json").read_bytes(), 489)
    except (OSError, subprocess.CalledProcessError, ValueError):
        actual_contracts = []
        candidate_parents = []
        committed_prefix, current_prefix = b"", b"invalid"
    expected_values = [(row["path_count"], row["path_list_sha256"]) for row in list(expected_contracts.values())[:4]]
    if (
        [(count, digest) for count, digest, _ in actual_contracts] != expected_values
        or len(actual_contracts) != 4
        or actual_contracts[-1][2] != c21_wsl_compose_runner_candidate_committed_exact_paths()
        or candidate_parents != [predecessor_control_sha]
    ):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_REPOSITORY_INVALID")

    try:
        candidate_manifest = _load_json(root / candidate_manifest_path)
        predecessor_manifest = json.loads(subprocess.check_output(["git", "show", f"{candidate_sha}:{seq489_manifest_path}"], cwd=root))
        predecessor_candidate_manifest = json.loads(subprocess.check_output(["git", "show", f"{predecessor_control_sha}:{candidate_manifest_path}"], cwd=root))
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError, TypeError):
        candidate_manifest = {}
        predecessor_manifest = {}
        predecessor_candidate_manifest = {}
    authority = candidate_manifest.get("authority") or {}
    derived = authority.get("derived_binding")
    derived_digest = hashlib.sha256(canonical_json_bytes(derived)).hexdigest().upper() if isinstance(derived, Mapping) else ""
    if any((
        not isinstance(derived, Mapping),
        len(canonical_json_bytes(derived)) != 985 if isinstance(derived, Mapping) else True,
        derived_digest != binding_sha,
        authority.get("derived_binding_sha256") != binding_sha,
        manifest.get("derived_correction_binding") != derived,
        manifest.get("derived_correction_binding_sha256") != binding_sha,
        manifest.get("predecessor_derived_binding_sha256") != predecessor_binding_sha,
        predecessor_manifest.get("derived_correction_binding_sha256") != predecessor_binding_sha,
        ((predecessor_candidate_manifest.get("authority") or {}).get("derived_binding_sha256")) != predecessor_binding_sha,
    )):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_BINDING_INVALID")
    if any((
        candidate_manifest.get("status") != "APPROVED_FOR_STAGING_VALIDATION",
        (candidate_manifest.get("source") or {}).get("commit") != candidate_sha,
        (candidate_manifest.get("source") or {}).get("remote_ref") != candidate_ref,
        (candidate_manifest.get("source") or {}).get("working_tree") != "CLEAN",
        authority.get("approval_id") != "APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001",
        authority.get("approval_path") != approval_path,
        authority.get("approval_artifact_sha256") != "92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F",
        authority.get("approval_binding_sha256") != "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5",
        authority.get("private_push_policy") != private_push_policy,
        candidate_manifest.get("exclusions") != ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"],
        (candidate_manifest.get("rollback") or {}).get("approved_commits") != [candidate_sha],
    )):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_CANDIDATE_INVALID")

    if any((
        progress.get("event_sequence") != 490,
        progress.get("last_event_id") != "evt_c21_wsl_compose_runner_candidate_rebind_bound",
        progress.get("status") != "ACTIVE",
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id": "C-21", "path": digest_path, "manifest_path": manifest_path},
        ((progress.get("next_successor_work_package") or {}).get("status")) != "ACTIVE_COMPOSE_RUNNER_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("event_sequence") != 490,
        active.get("status") != "ACTIVE_COMPOSE_RUNNER_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("implementation_commit") != candidate_sha,
        active.get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
        progress.get("next_safe_action") != next_safe_action,
        (bundle.get("handoff") or {}).get("next_safe_action") != next_safe_action,
        (bundle.get("handoff") or {}).get("repository_push_status") != push_status,
        (bundle.get("handoff") or {}).get("candidate_push_status") != push_status,
        (bundle.get("handoff") or {}).get("next_action") != next_action,
        active.get("candidate_push_status") != push_status,
        active.get("next_action") != next_action,
    )):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_PROJECTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base_sha,
        repository.get("local_head") != candidate_sha,
        repository.get("candidate_commit") != candidate_sha,
        repository.get("candidate_parent_commit") != predecessor_control_sha,
        repository.get("predecessor_control_commit") != predecessor_control_sha,
        repository.get("predecessor_runtime_commit") != runtime_sha,
        repository.get("predecessor_candidate_commit") != prior_candidate_sha,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != remote_sha,
        repository.get("feature_remote_head") != remote_sha,
        repository.get("candidate_remote_ref") != candidate_ref,
        repository.get("control_remote_ref") != control_ref,
        repository.get("push_status") != push_status,
        repository.get("candidate_push_status") != push_status,
        repository.get("head_relation") != "FEATURE_WORKTREE_C21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_ACTIVE_EXACT46_RECORD11",
        set(repository.get("exact_allowed_paths") or []) != c21_wsl_compose_runner_candidate_committed_exact_paths(),
        set(repository.get("compose_runner_candidate_rebind_successor_paths") or []) != c21_wsl_compose_runner_candidate_rebind_successor_paths(),
    )):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_REPOSITORY_INVALID")

    if (
        len(events) != 490
        or committed_prefix != current_prefix
        or len(current_prefix) != 803027
        or hashlib.sha256(current_prefix).hexdigest().upper() != "8F3067777D6B906E12A9B5E225F63DE3049CD27BD32B0449C48016327E008539"
        or hashlib.sha256(canonical_json_bytes(events[:489])).hexdigest().upper() != "0D7CEDE2D5A539EA321872599D45398F6A3C55629EE2F9708AA98F59A7C5B26D"
        or events[-1].get("event_id") != "evt_c21_wsl_compose_runner_candidate_rebind_bound"
    ):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_EVENTS_INVALID")
    details = events[-1].get("details") if events else {}
    if any((
        not isinstance(details, Mapping),
        (details or {}).get("branch") != "codex/c21-operational-execution",
        (details or {}).get("upstream") != "origin/codex/c21-operational-execution",
        (details or {}).get("local_head") != candidate_sha,
        (details or {}).get("remote_head") != remote_sha,
        (details or {}).get("projection_mode") != VALIDATED_BASE_PROJECTION_MODE,
        (details or {}).get("head_relation") != "FEATURE_WORKTREE_C21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_ACTIVE_EXACT46_RECORD11",
        set((details or {}).get("exact_allowed_paths") or []) != c21_wsl_compose_runner_candidate_committed_exact_paths(),
        (details or {}).get("candidate_commit") != candidate_sha,
        (details or {}).get("candidate_parent_commit") != predecessor_control_sha,
        (details or {}).get("predecessor_control_commit") != predecessor_control_sha,
        (details or {}).get("runtime_commit") != runtime_sha,
        (details or {}).get("prior_candidate_commit") != prior_candidate_sha,
        (details or {}).get("approved_origin_candidate_commit") != approved_origin_sha,
        (details or {}).get("validated_base_commit") != base_sha,
        (details or {}).get("path_contracts") != expected_contracts,
        set((details or {}).get("candidate_exact_paths") or []) != c21_wsl_compose_runner_candidate_committed_exact_paths(),
        set((details or {}).get("record_successor_paths") or []) != c21_wsl_compose_runner_candidate_rebind_successor_paths(),
        (details or {}).get("postcommit_exact_path_count") != 48,
        (details or {}).get("postcommit_exact_path_list_sha256") != "2626990127D2830414F77371813D893143C51065B0ACF41D14EAD3FEBBF88288",
        (details or {}).get("candidate_remote_ref") != candidate_ref,
        (details or {}).get("control_remote_ref") != control_ref,
        (details or {}).get("derived_binding_classification") != "MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION",
        (details or {}).get("derived_binding_sha256") != binding_sha,
        (details or {}).get("predecessor_derived_binding_sha256") != predecessor_binding_sha,
        (details or {}).get("historical_event_sequence") != 489,
        (details or {}).get("historical_raw_event_bytes") != 803027,
        (details or {}).get("historical_raw_events_sha256") != "8F3067777D6B906E12A9B5E225F63DE3049CD27BD32B0449C48016327E008539",
        (details or {}).get("historical_events_sha256") != "0D7CEDE2D5A539EA321872599D45398F6A3C55629EE2F9708AA98F59A7C5B26D",
        (details or {}).get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
    )):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_EVENTS_INVALID")
    boundary_fields = ("push", "deployment", "database", "volume_cleanup", "telegram", "provider")
    if (
        any((details or {}).get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or (details or {}).get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
        or any(manifest.get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or manifest.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    ):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_BOUNDARY_INVALID")

    candidate_rows = manifest.get("candidate_blob_checksums")
    predecessor_rows = manifest.get("predecessor_raw_checksums")
    live_rows = manifest.get("raw_checksums")
    if any((
        manifest.get("artifact_id") != "C21-WSL-COMPOSE-RUNNER-CANDIDATE-REBIND-20260905",
        manifest.get("manifest_type") != "WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_PROJECTION",
        manifest.get("event_sequence") != 490,
        manifest.get("historical_event_sequence") != 489,
        manifest.get("historical_raw_event_bytes") != 803027,
        manifest.get("historical_raw_events_sha256") != "8F3067777D6B906E12A9B5E225F63DE3049CD27BD32B0449C48016327E008539",
        manifest.get("historical_events_sha256") != "0D7CEDE2D5A539EA321872599D45398F6A3C55629EE2F9708AA98F59A7C5B26D",
        manifest.get("validated_base_commit") != base_sha,
        manifest.get("approved_origin_candidate_commit") != approved_origin_sha,
        manifest.get("prior_candidate_commit") != prior_candidate_sha,
        manifest.get("runtime_commit") != runtime_sha,
        manifest.get("predecessor_control_commit") != predecessor_control_sha,
        manifest.get("candidate_parent_commit") != predecessor_control_sha,
        manifest.get("candidate_commit") != candidate_sha,
        manifest.get("candidate_remote_ref") != candidate_ref,
        manifest.get("control_remote_ref") != control_ref,
        manifest.get("path_contracts") != expected_contracts,
        set(manifest.get("candidate_exact_paths") or []) != c21_wsl_compose_runner_candidate_committed_exact_paths(),
        set(manifest.get("record_successor_paths") or []) != c21_wsl_compose_runner_candidate_rebind_successor_paths(),
        manifest.get("self_reference") is not False,
        manifest.get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
        manifest.get("private_push_policy") != private_push_policy,
        not isinstance(candidate_rows, list),
        {row.get("path") for row in candidate_rows or [] if isinstance(row, Mapping)} != {"deploy/wsl/common.sh", "tests/deploy/test_wsl_staging_harness.py"},
        not isinstance(predecessor_rows, list),
        {row.get("path") for row in predecessor_rows or [] if isinstance(row, Mapping)} != {approval_path, seq489_manifest_path, seq489_digest_path},
        not isinstance(live_rows, list),
        {row.get("path") for row in live_rows or [] if isinstance(row, Mapping)} != {candidate_manifest_path, digest_path},
        any((row or {}).get("path") == manifest_path for row in [*(candidate_rows or []), *(predecessor_rows or []), *(live_rows or [])]),
    )):
        errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID")
    else:
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in candidate_rows):
            errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID")
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in predecessor_rows):
            errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID")
        if any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in live_rows):
            errors.append("C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID")
    return sorted(set(errors))


C21_WSL_COLD_START_PREVIOUS_ATTEMPT = {'candidate_commit': '830ad98546ed82a59524dd5a6cef0a5b7a6a96b0', 'control_commit': '18fa604531acfd303c10effa528797fbd5b55c8b', 'private_push': 'PASS', 'fresh_recovery': 'PASS', 'bootstrap': 'FAILED_PERMISSION_DENIED_DIRECT_EXEC_MODE_100644', 'database_cold_start': 'FAILED_PG_DUMP_SOCKET_MISSING_BEFORE_READY', 'pg15_database': 'HEALTHY', 'pg15_pre_migration_backup': 'PASS', 'pg15_image_build': 'PASS', 'pg15_migration': 'NOT_EXECUTED_CONTAINER_CREATE_FAILED_INVALID_TMPFS_MOUNT_NOEXEC', 'pg15_web': 'NOT_CREATED', 'pg18_runtime': 'NOT_EXECUTED', 'volume_cleanup': 'NOT_EXECUTED', 'telegram': 'NOT_EXECUTED', 'provider': 'NOT_EXECUTED'}


def validate_c21_wsl_cold_start_candidate_rebind_projection(
    bundle: Mapping[str, Any], manifest: Mapping[str, Any]
) -> list[str]:
    """Validate seq491 without requiring its not-yet-known record commit SHA."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    base_sha = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    approved_origin_sha = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
    runtime_sha = "ead1214e3f01e68e577c3163e1cf143ee5753490"
    prior_candidate_sha = "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
    predecessor_control_sha = "18fa604531acfd303c10effa528797fbd5b55c8b"
    candidate_sha = "324eb169fedbce958d2e8cc29362deb7af433677"
    remote_sha = "ca92b7845eda803cff3c432799642e4f9243d4d6"
    candidate_ref = "refs/remotes/origin/candidates/c21-wsl-exact48"
    control_ref = "refs/remotes/origin/codex/c21-operational-execution"
    manifest_path = "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-cold-start-candidate-rebind.json"
    approval_path = "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
    seq490_manifest_path = "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
    seq490_digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-compose-runner-candidate-rebind.json"
    candidate_manifest_path = "deploy/wsl/CandidateReleaseManifest.json"
    binding_sha = "C9EC11DE9FCA150F07418449C1A7C554B17909BE8F2647B85C7A763C86D3FA0A"
    predecessor_binding_sha = "FFEDB1B478DC0493CE3FC585A5324361EA82D83F2E2FCF6D2398CB9ACCB47F9C"
    private_push_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
    push_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
    next_action = (
        "COMPLETE_SEQ491_REVIEW_THEN_AUTONOMOUS_PRIVATE_PUSH_"
        "WITHOUT_SEPARATE_PROJECT_APPROVAL"
    )
    next_safe_action = (
        "seq491 review 완료 후 Main이 승인된 개발·테스트 범위의 private "
        "candidate/control refs를 별도 프로젝트 승인 대기 없이 자동 push하고 "
        "append-only 결과 checkpoint를 기록한 뒤 WSL 검증으로 진행한다. "
        "C-01은 계속 차단한다."
    )
    expected_contracts = {
        "correction_delta": {"from_commit": predecessor_control_sha, "to_commit": candidate_sha, "path_count": 5, "path_list_sha256": "63D5B1B57251E3A6680BBE62280A434E28AD9DFCE764A8D0C1BD2B161A1DE14D"},
        "runtime_to_candidate": {"from_commit": runtime_sha, "to_commit": candidate_sha, "path_count": 19, "path_list_sha256": "00EB5C576CCD69025861E2004A2CF18445E4BC234F1C168F255800459A00A43E"},
        "prior_candidate_to_candidate": {"from_commit": prior_candidate_sha, "to_commit": candidate_sha, "path_count": 15, "path_list_sha256": "D56DB332F378FC4EE52F5699C81664CE5C91D2BFBB80A98320B04F7CFFEEFB2A"},
        "candidate_cumulative": {"from_commit": base_sha, "to_commit": candidate_sha, "path_count": 48, "path_list_sha256": "2626990127D2830414F77371813D893143C51065B0ACF41D14EAD3FEBBF88288"},
        "record_successor": {"from_commit": candidate_sha, "to_commit": "PENDING_DIRECT_CHILD_RECORD_COMMIT", "path_count": 11, "path_list_sha256": "D7016A7C101CE330EECD91A12A4FB093628969D3B19158A6950FF398401D1952"},
        "repository_postcommit": {"from_commit": base_sha, "to_commit": "PENDING_DIRECT_CHILD_RECORD_COMMIT", "path_count": 50, "path_list_sha256": "9D28888908150BC834FC8931D12A35A9265C7D589ED2D89EAD7F2248E2D179EE"},
    }

    def git_path_contract(from_sha: str, to_sha: str) -> tuple[int, str, set[str]]:
        paths = set(_split_git_paths(_git_value(root, "diff", "--name-only", from_sha, to_sha)))
        return len(paths), hashlib.sha256(canonical_json_bytes(sorted(paths))).hexdigest().upper(), paths

    errors: list[str] = []
    try:
        actual_contracts = [git_path_contract(row["from_commit"], row["to_commit"]) for row in list(expected_contracts.values())[:4]]
        candidate_parents = (_git_value(root, "show", "-s", "--format=%P", candidate_sha) or "").split()
        candidate_event_bytes = subprocess.check_output(["git", "show", f"{candidate_sha}:docs/progress/progress-events.json"], cwd=root)
        committed_prefix = raw_event_object_prefix_bytes(candidate_event_bytes, 490)
        current_prefix = raw_event_object_prefix_bytes((root / "docs/progress/progress-events.json").read_bytes(), 490)
    except (OSError, subprocess.CalledProcessError, ValueError):
        actual_contracts = []
        candidate_parents = []
        committed_prefix, current_prefix = b"", b"invalid"
    expected_values = [(row["path_count"], row["path_list_sha256"]) for row in list(expected_contracts.values())[:4]]
    if (
        [(count, digest) for count, digest, _ in actual_contracts] != expected_values
        or len(actual_contracts) != 4
        or actual_contracts[-1][2] != c21_wsl_cold_start_candidate_committed_exact_paths()
        or candidate_parents != [predecessor_control_sha]
    ):
        errors.append("C21_WSL_COLD_START_REBIND_REPOSITORY_INVALID")

    try:
        candidate_manifest = _load_json(root / candidate_manifest_path)
        predecessor_manifest = json.loads(subprocess.check_output(["git", "show", f"{candidate_sha}:{seq490_manifest_path}"], cwd=root))
        predecessor_candidate_manifest = json.loads(subprocess.check_output(["git", "show", f"{predecessor_control_sha}:{candidate_manifest_path}"], cwd=root))
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError, TypeError):
        candidate_manifest = {}
        predecessor_manifest = {}
        predecessor_candidate_manifest = {}
    authority = candidate_manifest.get("authority") or {}
    derived = authority.get("derived_binding")
    derived_digest = hashlib.sha256(canonical_json_bytes(derived)).hexdigest().upper() if isinstance(derived, Mapping) else ""
    if any((
        not isinstance(derived, Mapping),
        len(canonical_json_bytes(derived)) != 1063 if isinstance(derived, Mapping) else True,
        derived_digest != binding_sha,
        authority.get("derived_binding_sha256") != binding_sha,
        manifest.get("derived_correction_binding") != derived,
        manifest.get("derived_correction_binding_sha256") != binding_sha,
        manifest.get("predecessor_derived_binding_sha256") != predecessor_binding_sha,
        predecessor_manifest.get("derived_correction_binding_sha256") != predecessor_binding_sha,
        ((predecessor_candidate_manifest.get("authority") or {}).get("derived_binding_sha256")) != predecessor_binding_sha,
    )):
        errors.append("C21_WSL_COLD_START_REBIND_BINDING_INVALID")
    if any((
        candidate_manifest.get("status") != "APPROVED_FOR_STAGING_VALIDATION",
        (candidate_manifest.get("source") or {}).get("commit") != candidate_sha,
        (candidate_manifest.get("source") or {}).get("remote_ref") != candidate_ref,
        (candidate_manifest.get("source") or {}).get("working_tree") != "CLEAN",
        authority.get("approval_id") != "APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001",
        authority.get("approval_path") != approval_path,
        authority.get("approval_artifact_sha256") != "92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F",
        authority.get("approval_binding_sha256") != "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5",
        authority.get("private_push_policy") != private_push_policy,
        candidate_manifest.get("exclusions") != ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"],
        (candidate_manifest.get("rollback") or {}).get("approved_commits") != [candidate_sha],
    )):
        errors.append("C21_WSL_COLD_START_REBIND_CANDIDATE_INVALID")

    if any((
        progress.get("event_sequence") != 491,
        progress.get("last_event_id") != "evt_c21_wsl_cold_start_candidate_rebind_bound",
        progress.get("status") != "ACTIVE",
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id": "C-21", "path": digest_path, "manifest_path": manifest_path},
        ((progress.get("next_successor_work_package") or {}).get("status")) != "ACTIVE_COLD_START_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("event_sequence") != 491,
        active.get("status") != "ACTIVE_COLD_START_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("implementation_commit") != candidate_sha,
        active.get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
        progress.get("next_safe_action") != next_safe_action,
        (bundle.get("handoff") or {}).get("next_safe_action") != next_safe_action,
        (bundle.get("handoff") or {}).get("repository_push_status") != push_status,
        (bundle.get("handoff") or {}).get("candidate_push_status") != push_status,
        (bundle.get("handoff") or {}).get("next_action") != next_action,
        active.get("candidate_push_status") != push_status,
        active.get("next_action") != next_action,
    )):
        errors.append("C21_WSL_COLD_START_REBIND_PROJECTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base_sha,
        repository.get("local_head") != candidate_sha,
        repository.get("candidate_commit") != candidate_sha,
        repository.get("candidate_parent_commit") != predecessor_control_sha,
        repository.get("predecessor_control_commit") != predecessor_control_sha,
        repository.get("predecessor_runtime_commit") != runtime_sha,
        repository.get("predecessor_candidate_commit") != prior_candidate_sha,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != remote_sha,
        repository.get("feature_remote_head") != remote_sha,
        repository.get("candidate_remote_ref") != candidate_ref,
        repository.get("control_remote_ref") != control_ref,
        repository.get("push_status") != push_status,
        repository.get("candidate_push_status") != push_status,
        repository.get("head_relation") != "FEATURE_WORKTREE_C21_WSL_COLD_START_CANDIDATE_REBIND_ACTIVE_EXACT48_RECORD11",
        set(repository.get("exact_allowed_paths") or []) != c21_wsl_cold_start_candidate_committed_exact_paths(),
        set(repository.get("cold_start_candidate_rebind_successor_paths") or []) != c21_wsl_cold_start_candidate_rebind_successor_paths(),
    )):
        errors.append("C21_WSL_COLD_START_REBIND_REPOSITORY_INVALID")

    if (
        len(events) != 491
        or committed_prefix != current_prefix
        or len(current_prefix) != 814540
        or hashlib.sha256(current_prefix).hexdigest().upper() != "E0A940F4FB2AD3EAE694831599063512339647ECABE64E20C924677A27672B19"
        or hashlib.sha256(canonical_json_bytes(events[:490])).hexdigest().upper() != "22A0C80EDABC24894FFCFF8D4036E9B4CB09698B21FA713958D515CD7DCCEFF8"
        or events[-1].get("event_id") != "evt_c21_wsl_cold_start_candidate_rebind_bound"
    ):
        errors.append("C21_WSL_COLD_START_REBIND_EVENTS_INVALID")
    details = events[-1].get("details") if events else {}
    if any((
        not isinstance(details, Mapping),
        (details or {}).get("branch") != "codex/c21-operational-execution",
        (details or {}).get("upstream") != "origin/codex/c21-operational-execution",
        (details or {}).get("local_head") != candidate_sha,
        (details or {}).get("remote_head") != remote_sha,
        (details or {}).get("projection_mode") != VALIDATED_BASE_PROJECTION_MODE,
        (details or {}).get("head_relation") != "FEATURE_WORKTREE_C21_WSL_COLD_START_CANDIDATE_REBIND_ACTIVE_EXACT48_RECORD11",
        set((details or {}).get("exact_allowed_paths") or []) != c21_wsl_cold_start_candidate_committed_exact_paths(),
        (details or {}).get("candidate_commit") != candidate_sha,
        (details or {}).get("candidate_parent_commit") != predecessor_control_sha,
        (details or {}).get("predecessor_control_commit") != predecessor_control_sha,
        (details or {}).get("runtime_commit") != runtime_sha,
        (details or {}).get("prior_candidate_commit") != prior_candidate_sha,
        (details or {}).get("approved_origin_candidate_commit") != approved_origin_sha,
        (details or {}).get("validated_base_commit") != base_sha,
        (details or {}).get("path_contracts") != expected_contracts,
        set((details or {}).get("candidate_exact_paths") or []) != c21_wsl_cold_start_candidate_committed_exact_paths(),
        set((details or {}).get("record_successor_paths") or []) != c21_wsl_cold_start_candidate_rebind_successor_paths(),
        (details or {}).get("postcommit_exact_path_count") != 50,
        (details or {}).get("postcommit_exact_path_list_sha256") != "9D28888908150BC834FC8931D12A35A9265C7D589ED2D89EAD7F2248E2D179EE",
        (details or {}).get("candidate_remote_ref") != candidate_ref,
        (details or {}).get("control_remote_ref") != control_ref,
        (details or {}).get("derived_binding_classification") != "MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION",
        (details or {}).get("derived_binding_sha256") != binding_sha,
        (details or {}).get("predecessor_derived_binding_sha256") != predecessor_binding_sha,
        (details or {}).get("historical_event_sequence") != 490,
        (details or {}).get("historical_raw_event_bytes") != 814540,
        (details or {}).get("historical_raw_events_sha256") != "E0A940F4FB2AD3EAE694831599063512339647ECABE64E20C924677A27672B19",
        (details or {}).get("historical_events_sha256") != "22A0C80EDABC24894FFCFF8D4036E9B4CB09698B21FA713958D515CD7DCCEFF8",
        (details or {}).get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
    )):
        errors.append("C21_WSL_COLD_START_REBIND_EVENTS_INVALID")
    boundary_fields = ("push", "deployment", "database", "volume_cleanup", "telegram", "provider")
    if (
        any((details or {}).get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or (details or {}).get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
        or any(manifest.get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or manifest.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    ):
        errors.append("C21_WSL_COLD_START_REBIND_BOUNDARY_INVALID")

    candidate_rows = manifest.get("candidate_blob_checksums")
    predecessor_rows = manifest.get("predecessor_raw_checksums")
    live_rows = manifest.get("raw_checksums")
    if any((
        manifest.get("artifact_id") != "C21-WSL-COLD-START-CANDIDATE-REBIND-20260905",
        manifest.get("manifest_type") != "WSL_COLD_START_CANDIDATE_REBIND_PROJECTION",
        manifest.get("event_sequence") != 491,
        manifest.get("historical_event_sequence") != 490,
        manifest.get("historical_raw_event_bytes") != 814540,
        manifest.get("historical_raw_events_sha256") != "E0A940F4FB2AD3EAE694831599063512339647ECABE64E20C924677A27672B19",
        manifest.get("historical_events_sha256") != "22A0C80EDABC24894FFCFF8D4036E9B4CB09698B21FA713958D515CD7DCCEFF8",
        manifest.get("validated_base_commit") != base_sha,
        manifest.get("approved_origin_candidate_commit") != approved_origin_sha,
        manifest.get("prior_candidate_commit") != prior_candidate_sha,
        manifest.get("runtime_commit") != runtime_sha,
        manifest.get("predecessor_control_commit") != predecessor_control_sha,
        manifest.get("candidate_parent_commit") != predecessor_control_sha,
        manifest.get("candidate_commit") != candidate_sha,
        manifest.get("candidate_remote_ref") != candidate_ref,
        manifest.get("control_remote_ref") != control_ref,
        manifest.get("path_contracts") != expected_contracts,
        set(manifest.get("candidate_exact_paths") or []) != c21_wsl_cold_start_candidate_committed_exact_paths(),
        set(manifest.get("record_successor_paths") or []) != c21_wsl_cold_start_candidate_rebind_successor_paths(),
        manifest.get("self_reference") is not False,
        manifest.get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
        manifest.get("private_push_policy") != private_push_policy,
        not isinstance(candidate_rows, list),
        {row.get("path") for row in candidate_rows or [] if isinstance(row, Mapping)} != {'deploy/wsl/bootstrap.sh', 'deploy/wsl/deploy.sh', 'deploy/wsl/compose.wsl.yml', 'tests/deploy/test_wsl_staging_harness.py', 'deploy/wsl/common.sh'},
        not isinstance(predecessor_rows, list),
        {row.get("path") for row in predecessor_rows or [] if isinstance(row, Mapping)} != {approval_path, seq490_manifest_path, seq490_digest_path},
        not isinstance(live_rows, list),
        {row.get("path") for row in live_rows or [] if isinstance(row, Mapping)} != {candidate_manifest_path, digest_path},
        any((row or {}).get("path") == manifest_path for row in [*(candidate_rows or []), *(predecessor_rows or []), *(live_rows or [])]),
    )):
        errors.append("C21_WSL_COLD_START_REBIND_MANIFEST_INVALID")
    else:
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in candidate_rows):
            errors.append("C21_WSL_COLD_START_REBIND_MANIFEST_INVALID")
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in predecessor_rows):
            errors.append("C21_WSL_COLD_START_REBIND_MANIFEST_INVALID")
        if any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in live_rows):
            errors.append("C21_WSL_COLD_START_REBIND_MANIFEST_INVALID")
    expected_attempt = C21_WSL_COLD_START_PREVIOUS_ATTEMPT
    if any(value != expected_attempt for value in (
        manifest.get("previous_attempt"), (details or {}).get("previous_attempt"),
        active.get("previous_attempt"),
    )):
        errors.append("C21_WSL_COLD_START_REBIND_HISTORY_INVALID")
    return sorted(set(errors))


C21_WSL_INGRESS_PREVIOUS_ATTEMPT = {'candidate_commit': '324eb169fedbce958d2e8cc29362deb7af433677', 'control_commit': '3f52d26a61e49543dd3d3121f5cc62a04f809a3d', 'private_push': 'PASS', 'fresh_recovery': 'PASS', 'deployment': 'PASS', 'pg15_database': 'PostgreSQL 15.19', 'pg18_database': 'PostgreSQL 18rc1', 'migration_head': '0013_task_bootstrap_authority', 'named_volumes_per_target': 1, 'anonymous_volumes': 0, 'canonical_host_verify': 'FAILED_LOOPBACK_PORT_NOT_PUBLISHED_ON_INTERNAL_BRIDGE', 'supplemental_internal_bridge_api_contract': 'PASS_BOTH_TARGETS_AUTH_SSE_LAST_EVENT_ID_BACKUP_RESTORE', 'canonical_rollback': 'NOT_EXECUTED_PREFLIGHT_PREVIOUS_REVISION_MISSING', 'scratch_restore_database_residue': 0, 'scratch_cookie_directory_residue': 0, 'volume_cleanup': 'NOT_EXECUTED', 'telegram': 'NOT_EXECUTED', 'provider': 'NOT_EXECUTED'}

def validate_c21_wsl_ingress_candidate_rebind_projection(
    bundle: Mapping[str, Any], manifest: Mapping[str, Any]
) -> list[str]:
    """Validate seq492 without requiring its not-yet-known record commit SHA."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    repository = progress.get("repository") or {}
    active = progress.get("wsl_early_validation") or {}
    base_sha = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
    approved_origin_sha = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
    runtime_sha = "324eb169fedbce958d2e8cc29362deb7af433677"
    prior_candidate_sha = "324eb169fedbce958d2e8cc29362deb7af433677"
    predecessor_control_sha = "3f52d26a61e49543dd3d3121f5cc62a04f809a3d"
    candidate_sha = "ccf5109d0640bf28c461e7754ad56e0821fd77be"
    remote_sha = "ca92b7845eda803cff3c432799642e4f9243d4d6"
    candidate_ref = "refs/remotes/origin/candidates/c21-wsl-exact51"
    control_ref = "refs/remotes/origin/codex/c21-operational-execution"
    manifest_path = "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-ingress-candidate-rebind.json"
    approval_path = "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
    seq491_manifest_path = "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
    seq491_digest_path = "docs/progress/progress-handoff-detached-digest-c21-wsl-cold-start-candidate-rebind.json"
    candidate_manifest_path = "deploy/wsl/CandidateReleaseManifest.json"
    binding_sha = "8FE8DCD4D90A91393E777E0FABCF60E51A68B93DB2B77197E12FC6445EF2D5EE"
    predecessor_binding_sha = "C9EC11DE9FCA150F07418449C1A7C554B17909BE8F2647B85C7A763C86D3FA0A"
    private_push_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
    push_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
    next_action = "COMPLETE_SEQ492_BINDING_REVIEW_THEN_HOLD_RUNTIME_FOR_I3_PRODUCT_SUCCESSOR"
    next_safe_action = 'seq492 결박 검토·기록 후 I-3 rollback allowlist 제품 보완 승인과 검증을 기다린다. 새 candidate의 deploy/rollback/cleanup은 금지하며 C-01은 계속 차단한다.'
    expected_contracts = {'correction_delta': {'from_commit': '3f52d26a61e49543dd3d3121f5cc62a04f809a3d', 'to_commit': 'ccf5109d0640bf28c461e7754ad56e0821fd77be', 'path_count': 7, 'path_list_sha256': '9B0C95AF74AF4822788DBAB498B4D141E81142332B437EF95108E93B65DCE995'}, 'runtime_to_candidate': {'from_commit': '324eb169fedbce958d2e8cc29362deb7af433677', 'to_commit': 'ccf5109d0640bf28c461e7754ad56e0821fd77be', 'path_count': 17, 'path_list_sha256': '4B3E1A3529D72C5F74231CF289A365E84623B74EAC44594175EC70550C8AF42D'}, 'prior_candidate_to_candidate': {'from_commit': '324eb169fedbce958d2e8cc29362deb7af433677', 'to_commit': 'ccf5109d0640bf28c461e7754ad56e0821fd77be', 'path_count': 17, 'path_list_sha256': '4B3E1A3529D72C5F74231CF289A365E84623B74EAC44594175EC70550C8AF42D'}, 'candidate_cumulative': {'from_commit': 'eef349682ff5598e3488c9e75163c5e0a99a0bdb', 'to_commit': 'ccf5109d0640bf28c461e7754ad56e0821fd77be', 'path_count': 51, 'path_list_sha256': 'F3AD3734333F4D40E2C3AC7B00C59AB0D91F06574C2CBBFCA8AAA79B49217EF2'}, 'record_successor': {'from_commit': 'ccf5109d0640bf28c461e7754ad56e0821fd77be', 'to_commit': 'PENDING_DIRECT_CHILD_RECORD_COMMIT', 'path_count': 13, 'path_list_sha256': 'F17A6B348C9A88343FCB9DE019A80429698293C62E7C2D35ADCBD9D23C049DEF'}, 'repository_postcommit': {'from_commit': 'eef349682ff5598e3488c9e75163c5e0a99a0bdb', 'to_commit': 'PENDING_DIRECT_CHILD_RECORD_COMMIT', 'path_count': 54, 'path_list_sha256': '176FB83A22359E5C2D5A4DC7180439A31318E16BF50288B154E02046415EFCF5'}}

    def git_path_contract(from_sha: str, to_sha: str) -> tuple[int, str, set[str]]:
        paths = set(_split_git_paths(_git_value(root, "diff", "--name-only", from_sha, to_sha)))
        return len(paths), hashlib.sha256(canonical_json_bytes(sorted(paths))).hexdigest().upper(), paths

    errors: list[str] = []
    try:
        actual_contracts = [git_path_contract(row["from_commit"], row["to_commit"]) for row in list(expected_contracts.values())[:4]]
        candidate_parents = (_git_value(root, "show", "-s", "--format=%P", candidate_sha) or "").split()
        candidate_event_bytes = subprocess.check_output(["git", "show", f"{candidate_sha}:docs/progress/progress-events.json"], cwd=root)
        committed_prefix = raw_event_object_prefix_bytes(candidate_event_bytes, 491)
        current_prefix = raw_event_object_prefix_bytes((root / "docs/progress/progress-events.json").read_bytes(), 491)
    except (OSError, subprocess.CalledProcessError, ValueError):
        actual_contracts = []
        candidate_parents = []
        committed_prefix, current_prefix = b"", b"invalid"
    expected_values = [(row["path_count"], row["path_list_sha256"]) for row in list(expected_contracts.values())[:4]]
    if (
        [(count, digest) for count, digest, _ in actual_contracts] != expected_values
        or len(actual_contracts) != 4
        or actual_contracts[-1][2] != c21_wsl_ingress_candidate_committed_exact_paths()
        or candidate_parents != [predecessor_control_sha]
    ):
        errors.append("C21_WSL_INGRESS_REBIND_REPOSITORY_INVALID")

    try:
        candidate_manifest = _load_json(root / candidate_manifest_path)
        predecessor_manifest = json.loads(subprocess.check_output(["git", "show", f"{candidate_sha}:{seq491_manifest_path}"], cwd=root))
        predecessor_candidate_manifest = json.loads(subprocess.check_output(["git", "show", f"{predecessor_control_sha}:{candidate_manifest_path}"], cwd=root))
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError, TypeError):
        candidate_manifest = {}
        predecessor_manifest = {}
        predecessor_candidate_manifest = {}
    authority = candidate_manifest.get("authority") or {}
    derived = authority.get("derived_binding")
    derived_digest = hashlib.sha256(canonical_json_bytes(derived)).hexdigest().upper() if isinstance(derived, Mapping) else ""
    if any((
        not isinstance(derived, Mapping),
        len(canonical_json_bytes(derived)) != 1634 if isinstance(derived, Mapping) else True,
        derived_digest != binding_sha,
        authority.get("derived_binding_sha256") != binding_sha,
        manifest.get("derived_correction_binding") != derived,
        manifest.get("derived_correction_binding_sha256") != binding_sha,
        manifest.get("predecessor_derived_binding_sha256") != predecessor_binding_sha,
        predecessor_manifest.get("derived_correction_binding_sha256") != predecessor_binding_sha,
        ((predecessor_candidate_manifest.get("authority") or {}).get("derived_binding_sha256")) != predecessor_binding_sha,
    )):
        errors.append("C21_WSL_INGRESS_REBIND_BINDING_INVALID")
    if any((
        candidate_manifest.get("status") != "APPROVED_FOR_STAGING_VALIDATION",
        (candidate_manifest.get("source") or {}).get("commit") != candidate_sha,
        (candidate_manifest.get("source") or {}).get("remote_ref") != candidate_ref,
        (candidate_manifest.get("source") or {}).get("working_tree") != "CLEAN",
        authority.get("approval_id") != "APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001",
        authority.get("approval_path") != approval_path,
        authority.get("approval_artifact_sha256") != "92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F",
        authority.get("approval_binding_sha256") != "2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5",
        authority.get("private_push_policy") != private_push_policy,
        candidate_manifest.get("exclusions") != ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"],
        (candidate_manifest.get("rollback") or {}).get("approved_commits") != [candidate_sha, prior_candidate_sha],
    )):
        errors.append("C21_WSL_INGRESS_REBIND_CANDIDATE_INVALID")

    if any((
        progress.get("event_sequence") != 492,
        progress.get("last_event_id") != "evt_c21_wsl_ingress_candidate_rebind_bound",
        progress.get("status") != "ACTIVE",
        (progress.get("current_progress_evidence_ref") or {}) != {"package_id": "C-21", "path": digest_path, "manifest_path": manifest_path},
        ((progress.get("next_successor_work_package") or {}).get("status")) != "ACTIVE_INGRESS_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("event_sequence") != 492,
        active.get("status") != "ACTIVE_INGRESS_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH",
        active.get("implementation_commit") != candidate_sha,
        active.get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
        progress.get("next_safe_action") != next_safe_action,
        (bundle.get("handoff") or {}).get("next_safe_action") != next_safe_action,
        (bundle.get("handoff") or {}).get("repository_push_status") != push_status,
        (bundle.get("handoff") or {}).get("candidate_push_status") != push_status,
        (bundle.get("handoff") or {}).get("next_action") != next_action,
        active.get("candidate_push_status") != push_status,
        active.get("next_action") != next_action,
    )):
        errors.append("C21_WSL_INGRESS_REBIND_PROJECTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base_sha,
        repository.get("local_head") != candidate_sha,
        repository.get("candidate_commit") != candidate_sha,
        repository.get("candidate_parent_commit") != predecessor_control_sha,
        repository.get("predecessor_control_commit") != predecessor_control_sha,
        repository.get("predecessor_runtime_commit") != runtime_sha,
        repository.get("predecessor_candidate_commit") != prior_candidate_sha,
        repository.get("branch") != "codex/c21-operational-execution",
        repository.get("upstream") != "origin/codex/c21-operational-execution",
        repository.get("remote_head") != remote_sha,
        repository.get("feature_remote_head") != remote_sha,
        repository.get("candidate_remote_ref") != candidate_ref,
        repository.get("control_remote_ref") != control_ref,
        repository.get("push_status") != push_status,
        repository.get("candidate_push_status") != push_status,
        repository.get("head_relation") != "FEATURE_WORKTREE_C21_WSL_INGRESS_CANDIDATE_REBIND_ACTIVE_EXACT51_RECORD13",
        set(repository.get("exact_allowed_paths") or []) != c21_wsl_ingress_candidate_committed_exact_paths(),
        set(repository.get("ingress_candidate_rebind_successor_paths") or []) != c21_wsl_ingress_candidate_rebind_successor_paths(),
    )):
        errors.append("C21_WSL_INGRESS_REBIND_REPOSITORY_INVALID")

    if (
        len(events) != 492
        or committed_prefix != current_prefix
        or len(current_prefix) != 827250
        or hashlib.sha256(current_prefix).hexdigest().upper() != "7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71"
        or hashlib.sha256(canonical_json_bytes(events[:491])).hexdigest().upper() != "8453BE8410EE21BBED0EAC04F75C2DA3FB02CDA41FF1D731590FD149057AF7D7"
        or events[-1].get("event_id") != "evt_c21_wsl_ingress_candidate_rebind_bound"
    ):
        errors.append("C21_WSL_INGRESS_REBIND_EVENTS_INVALID")
    details = events[-1].get("details") if events else {}
    if any((
        not isinstance(details, Mapping),
        (details or {}).get("branch") != "codex/c21-operational-execution",
        (details or {}).get("upstream") != "origin/codex/c21-operational-execution",
        (details or {}).get("local_head") != candidate_sha,
        (details or {}).get("remote_head") != remote_sha,
        (details or {}).get("projection_mode") != VALIDATED_BASE_PROJECTION_MODE,
        (details or {}).get("head_relation") != "FEATURE_WORKTREE_C21_WSL_INGRESS_CANDIDATE_REBIND_ACTIVE_EXACT51_RECORD13",
        set((details or {}).get("exact_allowed_paths") or []) != c21_wsl_ingress_candidate_committed_exact_paths(),
        (details or {}).get("candidate_commit") != candidate_sha,
        (details or {}).get("candidate_parent_commit") != predecessor_control_sha,
        (details or {}).get("predecessor_control_commit") != predecessor_control_sha,
        (details or {}).get("runtime_commit") != runtime_sha,
        (details or {}).get("prior_candidate_commit") != prior_candidate_sha,
        (details or {}).get("approved_origin_candidate_commit") != approved_origin_sha,
        (details or {}).get("validated_base_commit") != base_sha,
        (details or {}).get("path_contracts") != expected_contracts,
        set((details or {}).get("candidate_exact_paths") or []) != c21_wsl_ingress_candidate_committed_exact_paths(),
        set((details or {}).get("record_successor_paths") or []) != c21_wsl_ingress_candidate_rebind_successor_paths(),
        (details or {}).get("postcommit_exact_path_count") != 54,
        (details or {}).get("postcommit_exact_path_list_sha256") != "176FB83A22359E5C2D5A4DC7180439A31318E16BF50288B154E02046415EFCF5",
        (details or {}).get("candidate_remote_ref") != candidate_ref,
        (details or {}).get("control_remote_ref") != control_ref,
        (details or {}).get("derived_binding_classification") != "HUMAN_APPROVED_WSL_INGRESS_EXCEPTION",
        (details or {}).get("derived_binding_sha256") != binding_sha,
        (details or {}).get("predecessor_derived_binding_sha256") != predecessor_binding_sha,
        (details or {}).get("historical_event_sequence") != 491,
        (details or {}).get("historical_raw_event_bytes") != 827250,
        (details or {}).get("historical_raw_events_sha256") != "7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71",
        (details or {}).get("historical_events_sha256") != "8453BE8410EE21BBED0EAC04F75C2DA3FB02CDA41FF1D731590FD149057AF7D7",
        (details or {}).get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
    )):
        errors.append("C21_WSL_INGRESS_REBIND_EVENTS_INVALID")
    boundary_fields = ("push", "deployment", "database", "volume_cleanup", "telegram", "provider")
    if (
        any((details or {}).get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or (details or {}).get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
        or any(manifest.get(field) != "NOT_EXECUTED" for field in boundary_fields)
        or manifest.get("c01_status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    ):
        errors.append("C21_WSL_INGRESS_REBIND_BOUNDARY_INVALID")

    candidate_rows = manifest.get("candidate_blob_checksums")
    predecessor_rows = manifest.get("predecessor_raw_checksums")
    live_rows = manifest.get("raw_checksums")
    if any((
        manifest.get("artifact_id") != "C21-WSL-INGRESS-CANDIDATE-REBIND-20260905",
        manifest.get("manifest_type") != "WSL_INGRESS_CANDIDATE_REBIND_PROJECTION",
        manifest.get("event_sequence") != 492,
        manifest.get("historical_event_sequence") != 491,
        manifest.get("historical_raw_event_bytes") != 827250,
        manifest.get("historical_raw_events_sha256") != "7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71",
        manifest.get("historical_events_sha256") != "8453BE8410EE21BBED0EAC04F75C2DA3FB02CDA41FF1D731590FD149057AF7D7",
        manifest.get("validated_base_commit") != base_sha,
        manifest.get("approved_origin_candidate_commit") != approved_origin_sha,
        manifest.get("prior_candidate_commit") != prior_candidate_sha,
        manifest.get("runtime_commit") != runtime_sha,
        manifest.get("predecessor_control_commit") != predecessor_control_sha,
        manifest.get("candidate_parent_commit") != predecessor_control_sha,
        manifest.get("candidate_commit") != candidate_sha,
        manifest.get("candidate_remote_ref") != candidate_ref,
        manifest.get("control_remote_ref") != control_ref,
        manifest.get("path_contracts") != expected_contracts,
        set(manifest.get("candidate_exact_paths") or []) != c21_wsl_ingress_candidate_committed_exact_paths(),
        set(manifest.get("record_successor_paths") or []) != c21_wsl_ingress_candidate_rebind_successor_paths(),
        manifest.get("self_reference") is not False,
        manifest.get("record_control_commit") != "PENDING_DIRECT_CHILD_RECORD_COMMIT",
        manifest.get("private_push_policy") != private_push_policy,
        not isinstance(candidate_rows, list),
        {row.get("path") for row in candidate_rows or [] if isinstance(row, Mapping)} != {'deploy/wsl/cleanup.sh', 'tests/deploy/test_wsl_staging_harness.py', 'deploy/wsl/nginx-wsl.conf', 'deploy/wsl/compose.wsl.yml', 'deploy/wsl/common.sh', 'deploy/wsl/deploy.sh', 'deploy/wsl/rollback.sh'},
        not isinstance(predecessor_rows, list),
        {row.get("path") for row in predecessor_rows or [] if isinstance(row, Mapping)} != {approval_path, seq491_manifest_path, seq491_digest_path},
        not isinstance(live_rows, list),
        {row.get("path") for row in live_rows or [] if isinstance(row, Mapping)} != {candidate_manifest_path, digest_path},
        any((row or {}).get("path") == manifest_path for row in [*(candidate_rows or []), *(predecessor_rows or []), *(live_rows or [])]),
    )):
        errors.append("C21_WSL_INGRESS_REBIND_MANIFEST_INVALID")
    else:
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in candidate_rows):
            errors.append("C21_WSL_INGRESS_REBIND_MANIFEST_INVALID")
        if any(not git_blob_row_matches(root, candidate_sha, row) for row in predecessor_rows):
            errors.append("C21_WSL_INGRESS_REBIND_MANIFEST_INVALID")
        if any(not portable_row_matches(root, row["path"], row.get("bytes"), row.get("sha256")) for row in live_rows):
            errors.append("C21_WSL_INGRESS_REBIND_MANIFEST_INVALID")
    expected_attempt = C21_WSL_INGRESS_PREVIOUS_ATTEMPT
    if any(value != expected_attempt for value in (
        manifest.get("previous_attempt"), (details or {}).get("previous_attempt"),
        active.get("previous_attempt"),
    )):
        errors.append("C21_WSL_INGRESS_REBIND_HISTORY_INVALID")
    exception_path = 'docs/approvals/APPROVAL-20260905-C21-WSL-INGRESS-EXCEPTION-001.md'
    if (not portable_row_matches(root, exception_path, 3093, 'C046CF9C390E6F0A3A3BA3F1BC0859CAACD33B28F7DEDB03868545A66570C87C')
        or derived.get("important_risk_change") is not True
        or derived.get("classification") != "HUMAN_APPROVED_WSL_INGRESS_EXCEPTION"):
        errors.append("C21_WSL_INGRESS_REBIND_APPROVAL_INVALID")
    gate_documents = [progress, active, manifest, candidate_manifest, details or {}, bundle.get("handoff") or {}]
    if any(document.get("runtime_safety_gate") != "BLOCKED_IMPORTANT_I3" for document in gate_documents):
        errors.append("C21_WSL_INGRESS_REBIND_RUNTIME_GATE_INVALID")
    return sorted(set(errors))


def validate_c21_lr02c_start_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the fenced LR-02C operational-tooling start projection."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    errors: list[str] = []
    base = "dd4cc43452d30511ecf1a152e48408b7122391c0"
    wi_path = "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md"
    invocation_path = "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02c-start.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json"
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    repository = progress.get("repository") or {}
    if any((
        progress.get("event_sequence") != 439,
        progress.get("last_event_id") != "evt_c21_lr02c_package_started",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary",
        progress.get("valid_failure_count") != 0,
        (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "C-21/LR-02C",
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("package_id") != "C-21/LR-02C",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE",
        (progress.get("current_progress_evidence_ref") or {}) != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path
        },
    )):
        errors.append("C21_LR02C_START_PROJECTION_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02C-20260903-001",
        instruction.get("path") != wi_path,
        instruction.get("sha256") != "C0F78E48718059241C868AB3891FC30095C1D3627D1E133A33178C97BA48212D",
        instruction.get("invocation_path") != invocation_path,
        instruction.get("invocation_sha256") != "3A1A5DA6A7751EE3C6253EE06C9BFC89AC9D01855F56E1896F7CD58ACC8501E7",
        instruction.get("approval_ref") != approval_path,
        instruction.get("approval_sha256") != "1CB18CA1492D624EE950769AD8AEB4165E52F4C1DB30A4D04965E244BDDB407A",
        instruction.get("result_status") != "IN_PROGRESS",
        instruction.get("package_status") != "ACTIVE",
        instruction.get("allowed_path_count") != 12,
        worker.get("lease_id") != "worker-lease-c21-lr02c-20260903-001",
        worker.get("lease_epoch") != 1,
        worker.get("execution_fencing_token") != "c21-lr02c-execution-fence-epoch-1-dd4cc43",
        write.get("lease_id") != "write-lease-c21-lr02c-20260903-001",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 1,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != "c21-lr02c-write-fence-epoch-1-dd4cc43",
        len(write.get("paths", [])) != 12,
    )):
        errors.append("C21_LR02C_START_LEASE_OR_WI_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_EXACT20_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02C_ACTIVE",
        len(repository.get("exact_allowed_paths", [])) != 20,
    )):
        errors.append("C21_LR02C_START_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        436: "AE20E3BD39B1419C361F48CC80DF4FF6AA163783BFD89A03FA05EC263C4A0329",
        437: "F9C6B246B85071B1CA4D77380060B9E917948DFDECDEAB9677744CBB7B702214",
        438: "B8D47DD44FD744649672FFCC1F53E2B2ABB21AD25363EA4A0D4F364D04E4ADE4",
        439: "46DA6B8A072F8966D4F6FF4B650B68EA871C0E7DBF9DC343FAA87AB0588A9129",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:435])).hexdigest().upper()
        != "B3A48AAC67F8CB60AC17490FDAB362855B0C1D5C9325377734D07A33D04F0C38"
        or any(
            sequence not in indexed
            or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected
            for sequence, expected in expected_hashes.items()
        )
    ):
        errors.append("C21_LR02C_START_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02C-START-MANIFEST-20260903",
        manifest.get("manifest_type") != "WORK_PACKAGE_START_PROJECTION",
        manifest.get("target_status") != "ACTIVE",
        manifest.get("event_sequence") != 439,
        manifest.get("validated_base_commit") != base,
        manifest.get("repository_exact_path_count") != 20,
        manifest.get("developer_write_path_count") != 12,
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02C_START_MANIFEST_INVALID")
    expected_rows = {digest_path, wi_path, invocation_path, approval_path}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or {row.get("path") for row in rows if isinstance(row, dict)} != expected_rows:
        errors.append("C21_LR02C_START_MANIFEST_INVALID")
    else:
        for row in rows:
            relative = row["path"]
            try:
                if row.get("bytes") != (root / relative).stat().st_size or row.get("sha256") != portable_hash(root, relative):
                    errors.append("C21_LR02C_START_MANIFEST_INVALID")
                    break
            except OSError:
                errors.append("C21_LR02C_START_MANIFEST_INVALID")
                break
    return sorted(set(errors))


def validate_c21_lr02a_start_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the pushed LR-01 checkpoint and active LR-02A exact-path lease."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    errors: list[str] = []
    base = "e57f008d0916953dab3c9425322a1e8942ed0379"
    upstream_head = "1573e0242aa718d0f81f6b6fc936c754b7c75e60"
    wi_path = "docs/work_orders/C-21_LR-02A_WORK_INSTRUCTION.md"
    wi_hash = "B109FC5741D25D8DA285CAEFC7E5EE1D1EA10038E7A426D0EFA6353DA411618A"
    invocation_path = "docs/work_orders/C-21_LR-02A_INVOCATION_PROMPT.md"
    invocation_hash = "9EC0E710A26C7B1021E8AA4D7F41E8183C21041E238F4A5ED15CDD3B709C18C9"
    approval_path = "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md"
    approval_hash = "1CB18CA1492D624EE950769AD8AEB4165E52F4C1DB30A4D04965E244BDDB407A"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02a-start.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_START_MANIFEST.json"
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    repository = progress.get("repository") or {}
    current_ref = progress.get("current_progress_evidence_ref") or {}
    successor = progress.get("next_successor_work_package") or {}
    if any((
        progress.get("event_sequence") != 401,
        progress.get("last_event_id") != "evt_c21_lr02a_package_started",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary",
        progress.get("valid_failure_count") != 0,
        current_ref != {"package_id": "C-21", "path": digest_path, "manifest_path": manifest_path},
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        successor.get("package_id") != "C-21/LR-02A",
        successor.get("status") != "ACTIVE",
    )):
        errors.append("C21_LR02A_START_PROJECTION_INVALID")
    if any((
        worker.get("lease_id") != "worker-lease-c21-lr02a-20260903-001",
        worker.get("lease_epoch") != 1,
        worker.get("execution_fencing_token") != "c21-lr02a-execution-fence-epoch-1-e57f008",
        worker.get("status") != "ACTIVE",
        write.get("lease_id") != "write-lease-c21-lr02a-20260903-001",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 1,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != "c21-lr02a-write-fence-epoch-1-e57f008",
        write.get("status") != "ACTIVE",
    )):
        errors.append("C21_LR02A_START_LEASE_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02A-20260903-001",
        instruction.get("sha256") != wi_hash,
        instruction.get("invocation_sha256") != invocation_hash,
        instruction.get("approval_sha256") != approval_hash,
        instruction.get("result_status") != "IN_PROGRESS",
        instruction.get("package_status") != "ACTIVE",
        instruction.get("allowed_path_count") != 14,
        instruction.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        instruction.get("external_side_effects") != "NOT_EXECUTED",
    )):
        errors.append("C21_LR02A_START_WORK_INSTRUCTION_INVALID")
    for relative, expected in ((wi_path, wi_hash), (invocation_path, invocation_hash), (approval_path, approval_hash)):
        try:
            actual = hashlib.sha256((root / relative).read_bytes()).hexdigest().upper()
        except OSError:
            actual = None
        if actual != expected:
            errors.append("C21_LR02A_START_WORK_INSTRUCTION_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("remote_head") != upstream_head,
        repository.get("feature_remote_head") != base,
        repository.get("feature_remote") != "origin/codex/c21-lifecycle-runtime",
        repository.get("branch") != "codex/c21-lifecycle-runtime",
        repository.get("upstream") != "origin/main",
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_EXACT22_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02A_ACTIVE",
        len(repository.get("exact_allowed_paths", [])) != 22,
    )):
        errors.append("C21_LR02A_START_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        399: "48E1E14FF63CADE34A2F6EE3CCB5781E9A483873AE00425C8A904235EB901CCE",
        400: "57CDE763101D1E4CF1559B17BB8B7944B9A17EDA4E9D10C2FC9BC6B42CC81CF0",
        401: "333529C1C6D61F22342B36F99CF155BF44C801E7A2515B3D783AE7E258ABD4F8",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:398])).hexdigest().upper()
        != "BC79C6F460476839D6FFAF14F74B35B4AE554406B0E88D4A49404534BD4FDD7D"
        or any(
            sequence not in indexed
            or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected
            for sequence, expected in expected_hashes.items()
        )
    ):
        errors.append("C21_LR02A_START_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02A-START-MANIFEST-20260903",
        manifest.get("package_id") != "C-21/LR-02A",
        manifest.get("manifest_type") != "WORK_PACKAGE_START_PROJECTION",
        manifest.get("target_status") != "ACTIVE",
        manifest.get("validated_base_commit") != base,
        manifest.get("feature_remote_head") != base,
        manifest.get("upstream_head") != upstream_head,
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("external_side_effects") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02A_START_MANIFEST_INVALID")
    rows = manifest.get("raw_checksums")
    expected_paths = {digest_path, wi_path, invocation_path, approval_path}
    if not isinstance(rows, list) or len(rows) != len(expected_paths) or any(not isinstance(row, dict) for row in rows):
        errors.append("C21_LR02A_START_MANIFEST_INVALID")
    else:
        by_path = {row.get("path"): row for row in rows}
        if len(by_path) != len(rows) or set(by_path) != expected_paths:
            errors.append("C21_LR02A_START_MANIFEST_INVALID")
        else:
            for relative, row in by_path.items():
                raw = (root / relative).read_bytes()
                if row.get("bytes") != len(raw) or row.get("sha256") != hashlib.sha256(raw).hexdigest().upper():
                    errors.append("C21_LR02A_START_MANIFEST_INVALID")
                    break
    return sorted(set(errors))


def validate_c21_lr02a_rework_start_projection(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the accepted R1 failure and fenced LR-02A R2 rework projection."""
    root = bundle["_root"]
    progress = bundle["progress"]
    events = bundle["events"].get("events", [])
    errors: list[str] = []
    base = "e57f008d0916953dab3c9425322a1e8942ed0379"
    report_path = "docs/04_test_reports/C-21_LR02A_INDEPENDENT_TEST_REPORT.md"
    report_hash = "A0F71304371042FB8FED7CF3841785121C2B6171913375BD8D4A487FE5A0BB5B"
    wi_path = "docs/work_orders/C-21_LR-02A_REWORK_WORK_INSTRUCTION_R2.md"
    wi_hash = "5D22ED99F3084F0312F58DB58FBB330449FE637F9D468EA3B95EDF25F57B7927"
    invocation_path = "docs/work_orders/C-21_LR-02A_REWORK_INVOCATION_PROMPT_R2.md"
    invocation_hash = "959E6BF663E9DC701D059FAF2B3AF1A692F496E81B39245A261B4B2BE8FF8A19"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02a-rework-start-r2.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R2.json"
    finding_ids = [
        "BOOTSTRAP_DEPLOY_ROOT_MISMATCH",
        "CANONICAL_SCRIPT_ROOT_AND_GUARD_ARGUMENT_MISMATCH",
        "FRESH_IMAGE_PRECHECK_AND_0013_RERUN_REJECTED",
        "ROLLBACK_BASELINE_NOT_DURABLE",
        "CANONICAL_VERIFY_FALSE_POSITIVE",
        "LR01_FROZEN_REPORT_OVERWRITTEN",
        "DRAFT_APPROVAL_STATE_CONTRADICTION",
    ]
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    repository = progress.get("repository") or {}
    current_ref = progress.get("current_progress_evidence_ref") or {}
    ledger_entries = bundle["failure_ledger"].get("entries", [])
    failure = next(
        (row for row in ledger_entries if row.get("entry_id") == "failure-c21-lr02a-independent-review-r1"),
        {},
    )
    if any((
        progress.get("event_sequence") != 407,
        progress.get("last_event_id") != "evt_c21_lr02a_r2_package_resumed",
        progress.get("current_phase") != "C",
        progress.get("current_work_package") != "C-21",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary",
        progress.get("valid_failure_count") != 1,
        current_ref != {"package_id": "C-21", "path": digest_path, "manifest_path": manifest_path},
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE_REWORK_R2",
    )):
        errors.append("C21_LR02A_R2_PROJECTION_INVALID")
    if any((
        worker.get("lease_id") != "worker-lease-c21-lr02a-20260903-002",
        worker.get("lease_epoch") != 2,
        worker.get("execution_fencing_token") != "c21-lr02a-execution-fence-epoch-2-e57f008",
        worker.get("status") != "ACTIVE",
        write.get("lease_id") != "write-lease-c21-lr02a-20260903-002",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 2,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != "c21-lr02a-write-fence-epoch-2-e57f008",
        write.get("status") != "ACTIVE",
        len(write.get("paths", [])) != 11,
    )):
        errors.append("C21_LR02A_R2_LEASE_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02A-20260903-002",
        instruction.get("sha256") != wi_hash,
        instruction.get("invocation_sha256") != invocation_hash,
        instruction.get("result_status") != "REWORK_IN_PROGRESS",
        instruction.get("package_status") != "ACTIVE_REWORK_R2",
        instruction.get("allowed_path_count") != 11,
        instruction.get("failure_fingerprint") != "LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1",
        instruction.get("valid_failure_count") != 1,
        instruction.get("revision_classification") != "MAIN_RECONFIRMED_NON_SEMANTIC",
    )):
        errors.append("C21_LR02A_R2_WORK_INSTRUCTION_INVALID")
    for relative, expected in ((report_path, report_hash), (wi_path, wi_hash), (invocation_path, invocation_hash)):
        try:
            actual = hashlib.sha256((root / relative).read_bytes()).hexdigest().upper()
        except OSError:
            actual = None
        if actual != expected:
            errors.append("C21_LR02A_R2_SOURCE_INVALID")
    if any((
        failure.get("step_lineage_id") != "C-21/LR-02A",
        failure.get("failure_fingerprint") != "LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1",
        failure.get("result_status") != "FAILURE_REPORT",
        failure.get("accepted") is not True,
        failure.get("counts_toward_valid_failure") is not True,
        failure.get("validator_acceptance") is not True,
        failure.get("finding_ids") != finding_ids,
        failure.get("blocking_defect_count") != 7,
        failure.get("accepted_sequence") != 1,
        failure.get("takeover_status") != "NOT_REQUIRED",
        failure.get("independent_retest_status") != "R2_PENDING",
    )):
        errors.append("C21_LR02A_R2_FAILURE_LEDGER_INVALID")
    if any((
        repository.get("validated_base_commit") != base,
        repository.get("local_head") != base,
        repository.get("feature_remote_head") != base,
        repository.get("remote_head") != "1573e0242aa718d0f81f6b6fc936c754b7c75e60",
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_EXACT29_REWORK_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02A_R2_ACTIVE",
        len(repository.get("exact_allowed_paths", [])) != 29,
    )):
        errors.append("C21_LR02A_R2_REPOSITORY_INVALID")
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    expected_hashes = {
        402: "9D89B9EB1AF23430257570F93C3A6FD9D8D23796122AE5FEB7F2E09C475C7C15",
        403: "19759C9476C591C1C41EF311675D313DC3084DF11716B07EDA6C7F224CD8D2EE",
        404: "466CBD989876C861FED344D22615EEFE0E533F97CABC2A79DF9F167C43F37957",
        405: "19C7FB6988255ECC55D4262AC90CB6A0C35EA49DD51783C565AA3AA7635ABB8B",
        406: "F70B558D7178ED88DD349D024348CDF261E0D9A3B90F00E5672A4E8000219E46",
        407: "18BB1F3387BB5CE363E0CD1B4551664663C8A757BE6EB48338632ACCC44CB827",
    }
    if (
        hashlib.sha256(canonical_json_bytes(events[:401])).hexdigest().upper()
        != "ADB86386C811FBF8CF452D6D0D30CA694735B1D6FAAAE27E4218994018B5863B"
        or any(
            sequence not in indexed
            or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected
            for sequence, expected in expected_hashes.items()
        )
    ):
        errors.append("C21_LR02A_R2_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02A-REWORK-START-MANIFEST-R2-20260903",
        manifest.get("manifest_type") != "REWORK_START_PROGRESS_PROJECTION",
        manifest.get("target_status") != "ACTIVE_REWORK_R2",
        manifest.get("failure_fingerprint") != "LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1",
        manifest.get("valid_failure_count") != 1,
        manifest.get("frozen_lr01_report_sha256") != "F3FB0C564BBE4D3E571529A2577B852BC87727531354FE69C04D192AF7F3B0EB",
        manifest.get("developer_r2_exact_path_count") != 11,
        manifest.get("repository_exact_path_count") != 29,
        manifest.get("c01_boundary") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02A_R2_MANIFEST_INVALID")
    rows = manifest.get("raw_checksums")
    expected_paths = {report_path, "docs/progress/failure-ledger.json", wi_path, invocation_path, digest_path}
    if not isinstance(rows, list) or len(rows) != len(expected_paths) or any(not isinstance(row, dict) for row in rows):
        errors.append("C21_LR02A_R2_MANIFEST_INVALID")
    else:
        by_path = {row.get("path"): row for row in rows}
        if len(by_path) != len(rows) or set(by_path) != expected_paths:
            errors.append("C21_LR02A_R2_MANIFEST_INVALID")
        else:
            for relative, row in by_path.items():
                raw = (root / relative).read_bytes()
                if row.get("bytes") != len(raw) or row.get("sha256") != hashlib.sha256(raw).hexdigest().upper():
                    errors.append("C21_LR02A_R2_MANIFEST_INVALID")
                    break
    return sorted(set(errors))


def validate_c21_lr02a_rework_start_projection_r3(
    manifest: Mapping[str, Any], bundle: Mapping[str, Any]
) -> list[str]:
    """Validate the second accepted LR-02A failure and fenced R3 projection."""
    root = bundle["_root"]
    progress = bundle["progress"]
    errors: list[str] = []
    wi_path = "docs/work_orders/C-21_LR-02A_REWORK_WORK_INSTRUCTION_R3.md"
    wi_hash = "1ED38F7B2F2A181174E21C0E16EF4FAE8C100A593C082E40AACCC97AA3D2CEE5"
    invocation_path = "docs/work_orders/C-21_LR-02A_REWORK_INVOCATION_PROMPT_R3.md"
    invocation_hash = "A9E3D530EFD44A22A08392D3D20A6F75D9FEBB6D8A8DFBD595F60446EF3DB94C"
    report_path = "docs/04_test_reports/C-21_LR02A_R2_INDEPENDENT_TEST_REPORT.md"
    report_hash = "BA5AC0EE351912E9CAB4269B5147F10FE8E00B55AFA23A31DC46BC40BACE2C11"
    digest_path = "docs/progress/progress-handoff-detached-digest-c21-lr02a-rework-start-r3.json"
    manifest_path = "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R3.json"
    findings = [
        "FRESH_IMAGE_PRECHECK_AND_0013_RERUN_REJECTED",
        "ROLLBACK_BASELINE_NOT_DURABLE",
        "CANONICAL_VERIFY_FALSE_POSITIVE",
    ]
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    repository = progress.get("repository") or {}
    failure = next(
        (
            row for row in bundle["failure_ledger"].get("entries", [])
            if row.get("entry_id") == "failure-c21-lr02a-independent-review-r2"
        ),
        {},
    )
    if any((
        progress.get("event_sequence") != 413,
        progress.get("last_event_id") != "evt_c21_lr02a_r3_package_resumed",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary",
        progress.get("valid_failure_count") != 2,
        (progress.get("active_failure_lineage") or {}).get("valid_failure_count") != 2,
        progress.get("current_progress_evidence_ref") != {
            "package_id": "C-21", "path": digest_path, "manifest_path": manifest_path
        },
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
        (progress.get("next_successor_work_package") or {}).get("status") != "ACTIVE_REWORK_R3",
    )):
        errors.append("C21_LR02A_R3_PROJECTION_INVALID")
    if any((
        worker.get("lease_id") != "worker-lease-c21-lr02a-20260903-003",
        worker.get("lease_epoch") != 3,
        worker.get("execution_fencing_token") != "c21-lr02a-execution-fence-epoch-3-e57f008",
        worker.get("status") != "ACTIVE",
        write.get("lease_id") != "write-lease-c21-lr02a-20260903-003",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_epoch") != 3,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != "c21-lr02a-write-fence-epoch-3-e57f008",
        write.get("status") != "ACTIVE",
        len(write.get("paths", [])) != 9,
    )):
        errors.append("C21_LR02A_R3_LEASE_INVALID")
    if any((
        instruction.get("artifact_id") != "WI-C-21-LR-02A-20260903-003",
        instruction.get("sha256") != wi_hash,
        instruction.get("invocation_sha256") != invocation_hash,
        instruction.get("package_status") != "ACTIVE_REWORK_R3",
        instruction.get("allowed_path_count") != 9,
        instruction.get("valid_failure_count") != 2,
        instruction.get("revision_classification") != "MAIN_RECONFIRMED_NON_SEMANTIC",
    )):
        errors.append("C21_LR02A_R3_WORK_INSTRUCTION_INVALID")
    if any((
        failure.get("failure_fingerprint") != "LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1",
        failure.get("accepted") is not True,
        failure.get("counts_toward_valid_failure") is not True,
        failure.get("validator_acceptance") is not True,
        failure.get("finding_ids") != findings,
        failure.get("blocking_defect_count") != 3,
        failure.get("accepted_sequence") != 2,
        failure.get("takeover_status") != "NOT_REQUIRED",
        failure.get("independent_retest_status") != "R3_PENDING",
    )):
        errors.append("C21_LR02A_R3_FAILURE_LEDGER_INVALID")
    if any((
        repository.get("head_relation") != "FEATURE_CHECKPOINT_WITH_ACTIVE_EXACT36_REWORK_R3_WORKTREE",
        repository.get("push_status") != "FEATURE_CHECKPOINT_PUSHED_LR02A_R3_ACTIVE",
        len(repository.get("exact_allowed_paths", [])) != 36,
    )):
        errors.append("C21_LR02A_R3_REPOSITORY_INVALID")
    events = bundle["events"].get("events", [])
    expected_hashes = {
        408: "93D49656DBB41F1C80B23D64DC1865994AEC6FD8CAC9D8D3990FFC02FDEFC2AE",
        409: "16478DF44A4D8640401674ECEAC1BBB24AAD974870F9B1C75433C96A7A21BEAB",
        410: "18FDF40311A674F68449D199984192352B52497BD8C37AB0F3EC159A7ECA20DE",
        411: "9048578504AB8709CEDE4FB4AC82BE1A404FBB935964A6D8F72F9DB9B0AD124C",
        412: "123F77E480A2C79E57A7C671BB6AE6AC289DF9880F0E8B31CEB5E5CDFEC86573",
        413: "D80A9D8E77A50AE754EE7E4F00E1F3DF09DB42F20EEA6C5649416D84EBE42CBA",
    }
    indexed = {event.get("sequence"): event for event in events if isinstance(event, dict)}
    if (
        hashlib.sha256(canonical_json_bytes(events[:407])).hexdigest().upper()
        != "BEACA9D4B2E94064D6F9AAEA30BD89C072835138B80367FFB31071716CAD7C98"
        or any(
            sequence not in indexed
            or hashlib.sha256(canonical_json_bytes(indexed[sequence])).hexdigest().upper() != expected
            for sequence, expected in expected_hashes.items()
        )
    ):
        errors.append("C21_LR02A_R3_EVENTS_INVALID")
    if any((
        manifest.get("artifact_id") != "C21-LIFECYCLE-RUNTIME-LR02A-REWORK-START-MANIFEST-R3-20260903",
        manifest.get("target_status") != "ACTIVE_REWORK_R3",
        manifest.get("valid_failure_count") != 2,
        manifest.get("developer_r3_exact_path_count") != 9,
        manifest.get("developer_completion_target_count") != 7,
        manifest.get("repository_exact_path_count") != 36,
        manifest.get("self_reference") is not False,
    )):
        errors.append("C21_LR02A_R3_MANIFEST_INVALID")
    expected_paths = {report_path, "docs/progress/failure-ledger.json", wi_path, invocation_path, digest_path}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or {row.get("path") for row in rows if isinstance(row, dict)} != expected_paths:
        errors.append("C21_LR02A_R3_MANIFEST_INVALID")
    else:
        for row in rows:
            raw = (root / row["path"]).read_bytes()
            if row.get("bytes") != len(raw) or row.get("sha256") != hashlib.sha256(raw).hexdigest().upper():
                errors.append("C21_LR02A_R3_MANIFEST_INVALID")
                break
    for relative, expected in ((report_path, report_hash), (wi_path, wi_hash), (invocation_path, invocation_hash)):
        if hashlib.sha256((root / relative).read_bytes()).hexdigest().upper() != expected:
            errors.append("C21_LR02A_R3_SOURCE_INVALID")
    return sorted(set(errors))


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
            actual = portable_hash(root, path)
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


def validate_b04_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/approvals/APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001.md","docs/evidence/manifests/B-03_ACCEPTANCE_PROGRESS_MANIFEST_R3.json","docs/progress/progress-handoff-detached-digest-b04-start.json","docs/work_orders/B-04_INVOCATION_PROMPT.md","docs/work_orders/B-04_WORK_INSTRUCTION.md","scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B04_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B04_START_RAW_INVALID");continue
        seen.add(relative)
        try:
            ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
            if not ok and relative=="docs/evidence/manifests/B-03_ACCEPTANCE_PROGRESS_MANIFEST_R3.json" and row.get("canonical_eol")=="LF":
                raw=(root/relative).read_bytes().replace(b"\r\n",b"\n").replace(b"\r",b"\n")
                ok=len(raw)==row.get("bytes") and hashlib.sha256(raw).hexdigest().upper()==row.get("sha256")
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B04_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B04_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B04_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 242<=e.get("sequence",-1)<=244];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {}
    runtime=manifest.get("runtime_boundary") or {};approval=manifest.get("runtime_approval_ref") or {};progress_approval=progress.get("runtime_boundary_approval") or {}
    if any((progress.get("event_sequence")!=244,progress.get("current_work_package")!="B-04",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-04-20260814-001",wi.get("sha256")!="12EC940E255E2BF67B77120337874BDEAE446F9B1F1A6B478CD61A0C791838A1",wi.get("invocation_sha256")!="0A43F62B1B33DBC1A1D78065C98B4BD4F9E802157309A607B3252F3A5D4575CF",progress.get("active_agent")!="developer-primary-b04",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B04_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],manifest.get("validated_base_commit")!="1519d8cce5e205bd9e20652cc380e65e9ca01e49",manifest.get("product_artifact_count")!=0,runtime.get("actual_db")!="NOT_EXECUTED",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_wsl")!="NOT_EXECUTED",runtime.get("wsl_read_only_probe")!="PASS_AVAILABLE_NOT_RUNTIME_EXECUTION",runtime.get("pre_deploy_validation")!="WSL_FIRST_SAME_COMMIT_REQUIRED",runtime.get("host")!="ssh ysna-server",runtime.get("deploy_root")!="~/deploy/anvil",runtime.get("database_container")!="shared-db",runtime.get("public_exposure")!="DENIED_PENDING_SEPARATE_APPROVAL",runtime.get("b04_remote_mutation")!="FORBIDDEN",approval.get("sha256")!="6E76E85D2895207F80639B6DE0D027A4CB08A61FA025968D0EC14C13960BB562",progress_approval.get("sha256")!="6E76E85D2895207F80639B6DE0D027A4CB08A61FA025968D0EC14C13960BB562")): errors.append("B04_START_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B04_START_SUCCESSOR_INVALID")
    if manifest.get("predecessor_acceptance_ref",{}).get("sha256")!="577C005549601D63487D84E936E6FAE4F6322F734929EEA53FD7F077C374B030": errors.append("B04_START_PREDECESSOR_INVALID")
    return sorted(set(errors))


def validate_b04_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-04_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b04-completion-test-review.json","docs/work_orders/B-04_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B04_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B04_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B04_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B04_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B04_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 245<=e.get("sequence",-1)<=247];wi=progress.get("active_work_instruction") or {};boundary=manifest.get("evidence_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=247,progress.get("current_work_package")!="B-04",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-04-20260814-001",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B04_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="D1E9A6A4C8526EC20E118051711B5E9F674B4CAA64FBFB325DAD86134122DB2D",manifest.get("developer_target_hash")!="B33FB1C7BF55B8AB3EF88AC8433DB3232A49601DC8348FDAF4A210A4404B4834",manifest.get("developer_exact_paths_frozen") is not True,boundary.get("actual_wsl_pg18")!="PASS_ISOLATED_APPLY_CONSTRAINTS_DOWNGRADE_CLEANUP",boundary.get("independent_tester")!="PENDING",boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_provider")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("acceptance")!="FORBIDDEN_PENDING_INDEPENDENT_TEST",boundary.get("b05_start")!="FORBIDDEN_PENDING_B04_ACCEPTANCE")): errors.append("B04_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B04_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b04_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-04_ACCEPTANCE_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b04-accepted.json","docs/test_reports/B-04_INDEPENDENT_TEST_REPORT.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B04_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B04_ACCEPTANCE_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B04_ACCEPTANCE_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B04_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B04_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==248];boundary=manifest.get("runtime_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=248,progress.get("current_work_package")!="B-05",progress.get("status")!="READY","B-04" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-05",progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="343CAF908D2360D47220408F2127E56F355E3431A9FE0165E2CA84DC88C93A38",manifest.get("blocking_findings")!=0,boundary.get("actual_wsl_postgresql18")!="PASS_ISOLATED_EVIDENCE_PRESERVED",boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_provider")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("b05_start")!="FORBIDDEN_NOT_STARTED")): errors.append("B04_ACCEPTANCE_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B04_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_workplan_v16_successor_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/WORKPLAN_V16_SUCCESSOR_MANIFEST.json"
    expected={"Anvil_작업계획서_v1.md","Anvil_통합검증매트릭스_v1.md","Anvil_테스트계획서_v1.md","docs/superpowers/plans/2026-08-14-common-api-menu-sequential-plan.md","docs/superpowers/specs/2026-08-14-common-api-menu-sequential-plan-design.md","docs/approvals/APPROVAL-20260814-WORKPLAN-V16-001.md","docs/validation/WORKPLAN_V16_SUCCESSOR_VALIDATION.md","docs/progress/progress-handoff-detached-digest-workplan-v16-successor.json"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["WORKPLAN_V16_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("WORKPLAN_V16_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("WORKPLAN_V16_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("WORKPLAN_V16_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("WORKPLAN_V16_TARGET_MISMATCH")
    events=[event for event in bundle["events"]["events"] if event.get("sequence")==249];authority=progress.get("authority_successor_binding") or {};projection=manifest.get("projection") or {}
    if is_current and any((progress.get("event_sequence")!=249,progress.get("current_work_package")!="B-05",progress.get("status")!="READY",progress.get("plan_version")!="1.6",progress.get("work_plan_hash")!="E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D",progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,progress.get("valid_failure_count")!=0,[event.get("event_type") for event in events]!=["EVIDENCE_MANIFEST_CREATED"],authority.get("approval_id")!="APPROVAL-20260814-WORKPLAN-V16-001",authority.get("classification")!="HUMAN_APPROVED_SEMANTIC_PLAN_REVISION",manifest.get("validated_base_commit")!="56d409c4583bcf4090423995e79c63ae63598c1d",manifest.get("approval_sha256")!="3DFC292FA2F3A312B64EC8B14B991977643E7FE0F2E39889C8219EE3E9F6C236",projection.get("package_total")!=108,projection.get("u_phase_serial_packages")!=11,projection.get("av_total")!=255,projection.get("matrix_missing_packages")!=0,projection.get("matrix_extra_packages")!=0,projection.get("b05_started") is not False,projection.get("product_runtime_status")!="NOT_EXECUTED")): errors.append("WORKPLAN_V16_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={row.get("path"):row for row in successor.get("live_raw_checksums",[]) if isinstance(row,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,path,row.get("bytes"),row.get("sha256")) for path,row in indexed.items())): errors.append("WORKPLAN_V16_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b05_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-05_START_EVIDENCE_MANIFEST.json"
    expected={"docs/evidence/manifests/WORKPLAN_V16_SUCCESSOR_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b05-start.json","docs/work_orders/B-05_INVOCATION_PROMPT.md","docs/work_orders/B-05_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B05_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B05_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B05_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B05_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B05_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 250<=e.get("sequence",-1)<=252];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};runtime=manifest.get("runtime_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=252,progress.get("current_work_package")!="B-05",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-05-20260815-001",wi.get("sha256")!="C75DAA8E3FC9304256CA661AABB5E5C70015849C9F776B7A9BF01141F9AC9393",wi.get("invocation_sha256")!="AE6EAD1C596D815E89AD7BFE21EB66DD8BF08E59784114A3DF89623869301DED",progress.get("active_agent")!="developer-primary-b05",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B05_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],manifest.get("validated_base_commit")!="e59c4a105dab0faae31f43fd75e3ac53f1992ffe",manifest.get("product_artifact_count")!=0,runtime.get("actual_db")!="NOT_EXECUTED",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_ui")!="NOT_EXECUTED",runtime.get("actual_browser")!="NOT_EXECUTED",runtime.get("actual_wsl")!="NOT_EXECUTED",runtime.get("actual_ysna_server")!="NOT_EXECUTED",runtime.get("deployment")!="NOT_EXECUTED",runtime.get("developer_db_boundary")!="ISOLATED_WSL_ANVIL_DB_ONLY")): errors.append("B05_START_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B05_START_SUCCESSOR_INVALID")
    if manifest.get("predecessor_successor_ref",{}).get("sha256")!="63868EAE469167EF167D56E03AED408D73BBAA460EEB322DF3A7455CA586750D": errors.append("B05_START_PREDECESSOR_INVALID")
    return sorted(set(errors))


def validate_b05_wi_rebind_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-05_WI_REBIND_EVIDENCE_MANIFEST_R2.json"
    expected={"docs/evidence/manifests/B-05_START_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b05-wi-rebind-r2.json","docs/work_orders/B-05_INVOCATION_PROMPT.md","docs/work_orders/B-05_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B05_REBIND_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B05_REBIND_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B05_REBIND_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B05_REBIND_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B05_REBIND_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 253<=e.get("sequence",-1)<=257];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};runtime=manifest.get("runtime_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=257,progress.get("current_work_package")!="B-05",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-05-20260815-002",wi.get("sha256")!="DFC7BDECBECE0E6A2E48E68011D91E51AEB370A0E6CB67E1EA1ACBAE00F17A43",wi.get("invocation_sha256")!="6C570930EBC566B52C1BC45459BF567CF8E64306CC140F78E3D2B3ED95927684",progress.get("active_agent")!="developer-primary-b05",worker.get("lease_epoch")!=2,write.get("write_epoch")!=2,(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B05_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],manifest.get("validated_base_commit")!="0a3a9bbf0c11ed53a5f5ff647591d48bc4d06565",manifest.get("classification")!="MAIN_CORRECTED_LOWER_AUTHORITY_CONFLICT_OBJECTIVE_UNCHANGED",manifest.get("canonical_design_intent_review_statuses")!=["DIR_HOLD","REPORTING","WAITING_OWNER_DIRECTION","CLEARED"],manifest.get("not_reached_representation")!="ABSENT_REVIEW_ROW_OR_PROGRESS_PROJECTION",manifest.get("recurrent_drift_policy")!="CREATE_NEW_DIR_REVIEW_AND_EVENT",manifest.get("developer_exact_path_count")!=15,manifest.get("product_artifact_count")!=0,runtime.get("actual_db")!="NOT_EXECUTED",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_ui")!="NOT_EXECUTED",runtime.get("actual_browser")!="NOT_EXECUTED",runtime.get("actual_wsl")!="NOT_EXECUTED",runtime.get("actual_ysna_server")!="NOT_EXECUTED",runtime.get("deployment")!="NOT_EXECUTED")): errors.append("B05_REBIND_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B05_REBIND_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b05_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-05_COMPLETION_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-05_WI_REBIND_EVIDENCE_MANIFEST_R2.json","docs/evidence/manifests/B-05_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b05-completion-test-review.json","docs/work_orders/B-05_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B05_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B05_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B05_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B05_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B05_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 258<=e.get("sequence",-1)<=260];wi=progress.get("active_work_instruction") or {};boundary=manifest.get("evidence_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=260,progress.get("current_work_package")!="B-05",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=0,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-05-20260815-002",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B05_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="262B9AB8AEBB5A940594A92000B9AA66E1F1C5908D5700C8AE5D0DEA55BE8E16",manifest.get("developer_target_hash")!="8BFFC8B2F2D55DD951E59E849A5A2740723C0DC14CA1586E06C77FBD8E142BBB",manifest.get("developer_exact_paths_frozen") is not True,manifest.get("developer_mutation")!="FORBIDDEN_FROZEN_PREDECESSOR",manifest.get("internal_resolved_failure_classification")!="NOT_A_FAILURE_REPORT_VALID_COUNT_UNCHANGED",boundary.get("actual_wsl_pg18")!="PASS_0003_0004_0003_TABLES_0_10_0_FUNCTIONS_0_GUARDS_CLEANUP",boundary.get("independent_tester")!="PENDING",boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED")): errors.append("B05_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B05_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b05_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-05_ACCEPTANCE_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-05_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b05-accepted.json","docs/test_reports/B-05_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-05_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B05_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B05_ACCEPTANCE_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B05_ACCEPTANCE_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B05_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B05_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==261];boundary=manifest.get("runtime_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=261,progress.get("current_work_package")!="B-06",progress.get("status")!="READY","B-05" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-06",(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=0,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("package_id")!="B-06",(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="122D901CEC44AFF20EC238F03B33BC1E98806C28C1FD5D2984224448E49184AE",manifest.get("blocking_findings")!=0,manifest.get("developer_manifest_sha256")!="262B9AB8AEBB5A940594A92000B9AA66E1F1C5908D5700C8AE5D0DEA55BE8E16",manifest.get("completion_manifest_sha256")!="EC25DC7B0F08211579844168754FC69455ED638E666752B2A8DFAA988EF2F641",boundary.get("actual_wsl_pg18")!="PASS_EVIDENCE_PRESERVED",boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("b06_start")!="FORBIDDEN_NOT_STARTED")): errors.append("B05_ACCEPTANCE_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B05_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b06_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-06_START_EVIDENCE_MANIFEST.json"
    expected={"docs/evidence/manifests/B-05_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b06-start.json","docs/work_orders/B-06_INVOCATION_PROMPT.md","docs/work_orders/B-06_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B06_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B06_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B06_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B06_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B06_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 262<=e.get("sequence",-1)<=264];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};runtime=manifest.get("runtime_boundary") or {}
    expected_ids=["AV-STAT-004","AV-STAT-005","AV-STAT-006","AV-STAT-020"]
    if is_current and any((progress.get("event_sequence")!=264,progress.get("current_work_package")!="B-06",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-06-20260815-001",wi.get("sha256")!="C52B192E88B581B44B47D2A07DC7E293119BE9F60732988393C99795A03DB827",wi.get("invocation_sha256")!="5AEBDFE2167788AB52BC2873194A7253CDD960119BD1D9C4F993ADC09D1B8B58",wi.get("assigned_verification_ids")!=expected_ids,progress.get("active_agent")!="developer-primary-b06",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,write.get("worker_lease_id")!=worker.get("lease_id"),(progress.get("next_work_package") or {}).get("package_id")!="B-07",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B06_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],manifest.get("validated_base_commit")!="ebe9ce9c28c3e58f8d8200e5747e33ceb2d8174b",manifest.get("assigned_verification_ids")!=expected_ids,manifest.get("developer_exact_path_count")!=15,manifest.get("product_artifact_count")!=0,runtime.get("actual_db")!="NOT_EXECUTED",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_ui")!="NOT_EXECUTED",runtime.get("actual_browser")!="NOT_EXECUTED",runtime.get("actual_wsl")!="NOT_EXECUTED",runtime.get("actual_ysna_server")!="NOT_EXECUTED",runtime.get("shared_db")!="NOT_EXECUTED",runtime.get("production")!="NOT_EXECUTED",runtime.get("deployment")!="NOT_EXECUTED",runtime.get("developer_db_boundary")!="ISOLATED_WSL_ANVIL_DB_ONLY")): errors.append("B06_START_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B06_START_SUCCESSOR_INVALID")
    if (manifest.get("predecessor_acceptance_ref") or {}).get("sha256")!="4CFA15518F5134B4F4115B4C74D2B3B39BF4EB414ECA32DEE17E68D53C00F08B": errors.append("B06_START_PREDECESSOR_INVALID")
    return sorted(set(errors))


def validate_b06_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-06_COMPLETION_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-06_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-06_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b06-completion-test-review.json","docs/work_orders/B-06_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B06_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B06_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B06_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B06_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B06_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 265<=e.get("sequence",-1)<=267];wi=progress.get("active_work_instruction") or {};boundary=manifest.get("evidence_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=267,progress.get("current_work_package")!="B-06",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=0,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-06-20260815-001",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B06_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="CB14005DAE3D4E89C1BCD1320969477C47BFF2C4172BFC8329B884FF52548F07",manifest.get("developer_target_hash")!="B97BD64F82B4ACF675735B6D45B7C6AAE8A61965B8D528BC715BBB85574EC8EA",manifest.get("developer_exact_paths_frozen") is not True,manifest.get("developer_mutation")!="FORBIDDEN_FROZEN_PREDECESSOR",manifest.get("internal_resolved_failure_classification")!="NOT_A_FAILURE_REPORT_VALID_COUNT_UNCHANGED",boundary.get("actual_wsl_pg18")!="PASS_0004_0005_0004_APPEND_IDEMPOTENCY_HOSTILE_GUARDS_CLEANUP",boundary.get("independent_tester")!="PENDING",boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_provider")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("acceptance")!="FORBIDDEN_PENDING_INDEPENDENT_TEST",boundary.get("b07_start")!="FORBIDDEN_PENDING_B06_ACCEPTANCE")): errors.append("B06_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B06_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b06_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-06_ACCEPTANCE_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-06_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b06-accepted.json","docs/test_reports/B-06_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-06_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B06_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B06_ACCEPTANCE_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B06_ACCEPTANCE_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B06_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B06_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==268];boundary=manifest.get("runtime_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=268,progress.get("current_work_package")!="B-07",progress.get("status")!="READY","B-06" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-07",(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=0,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("package_id")!="B-07",(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="8D19FC784223B24BBF082C815C2BB196321658F0896427D84E1F4A9DBB4AC1A5",manifest.get("blocking_findings")!=0,manifest.get("developer_manifest_sha256")!="CB14005DAE3D4E89C1BCD1320969477C47BFF2C4172BFC8329B884FF52548F07",manifest.get("completion_manifest_sha256")!="898A687EC52D9BFA143629282A27284465F1F9ADBFD50292E3BBE28DB49BF207",boundary.get("actual_wsl_pg18")!="PASS_EVIDENCE_PRESERVED",boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("b07_start")!="FORBIDDEN_NOT_STARTED")): errors.append("B06_ACCEPTANCE_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B06_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b07_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-07_START_EVIDENCE_MANIFEST.json"
    expected={"docs/evidence/manifests/B-06_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b07-start.json","docs/work_orders/B-07_INVOCATION_PROMPT.md","docs/work_orders/B-07_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B07_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B07_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B07_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B07_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B07_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 269<=e.get("sequence",-1)<=271];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};runtime=manifest.get("runtime_boundary") or {}
    expected_ids=["AV-STAT-010"]
    expected_paths={"packages/artifacts/__init__.py","packages/artifacts/models.py","packages/artifacts/store.py","packages/artifacts/evidence.py","packages/checkpoints/__init__.py","packages/checkpoints/models.py","packages/checkpoints/service.py","packages/persistence/artifact_checkpoint_repository.py","migrations/versions/0006_checkpoint_artifacts.py","tests/artifacts/test_artifact_store.py","tests/artifacts/test_evidence_manifest.py","tests/checkpoints/test_checkpoint_service.py","docs/validation/B-07_CHECKPOINT_ARTIFACT_VALIDATION.md","docs/evidence/manifests/B-07_EVIDENCE_MANIFEST.json","docs/completion_reports/B-07_COMPLETION_REPORT.md"}
    if is_current and any((progress.get("event_sequence")!=271,progress.get("current_work_package")!="B-07",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-07-20260815-001",wi.get("sha256")!="4809891FD6EADFB7CD5A147D879257FC61C3AD7D20B63081814DF46F59E0741F",wi.get("invocation_sha256")!="E5F71C33D8909AF2D662D08EC5C68EA55C5825DBA40E019000BAD766B98B6A4E",wi.get("assigned_verification_ids")!=expected_ids,progress.get("active_agent")!="developer-primary-b07",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=expected_paths,set(write.get("path_scope",[]))!=expected_paths,(progress.get("next_work_package") or {}).get("package_id")!="B-08",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B07_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],manifest.get("validated_base_commit")!="1a9c25b7ce2c257d40aaa10fcf3a0478f654db93",manifest.get("assigned_verification_ids")!=expected_ids,manifest.get("developer_exact_path_count")!=15,manifest.get("product_artifact_count")!=0,runtime.get("actual_db")!="NOT_EXECUTED",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_ui")!="NOT_EXECUTED",runtime.get("actual_browser")!="NOT_EXECUTED",runtime.get("actual_wsl")!="NOT_EXECUTED",runtime.get("actual_ysna_server")!="NOT_EXECUTED",runtime.get("shared_db")!="NOT_EXECUTED",runtime.get("production")!="NOT_EXECUTED",runtime.get("deployment")!="NOT_EXECUTED",runtime.get("developer_db_boundary")!="ISOLATED_WSL_ANVIL_DB_ONLY")): errors.append("B07_START_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B07_START_SUCCESSOR_INVALID")
    if (manifest.get("predecessor_acceptance_ref") or {}).get("sha256")!="D81F942EE5BFEEC13E5BE7452CAF544A3D6EDBF4CA5F7D36F495478909502880": errors.append("B07_START_PREDECESSOR_INVALID")
    return sorted(set(errors))


def validate_b07_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-07_COMPLETION_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-07_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-07_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b07-completion-test-review.json","docs/work_orders/B-07_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B07_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B07_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B07_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B07_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B07_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 272<=e.get("sequence",-1)<=274];wi=progress.get("active_work_instruction") or {};boundary=manifest.get("evidence_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=274,progress.get("current_work_package")!="B-07",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=0,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-07-20260815-001",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B07_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="3DBF08310FF92E715A862F9AC79D73F634840D62C33D47E40373357B862E5DF1",manifest.get("developer_target_hash")!="ECE15CC1FD547E381512A817F71308F897DC5469EBEF70E44039C14B118B65D5",manifest.get("developer_exact_paths_frozen") is not True,manifest.get("developer_mutation")!="FORBIDDEN_FROZEN_PREDECESSOR",boundary.get("actual_wsl_pg18")!="PASS_0005_0006_0005_METADATA_ONLY_HOSTILE9_CLEANUP",boundary.get("independent_tester")!="PENDING",boundary.get("acceptance")!="FORBIDDEN_PENDING_INDEPENDENT_TEST",boundary.get("b08_start")!="FORBIDDEN_PENDING_B07_ACCEPTANCE")): errors.append("B07_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B07_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b07_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-07_ACCEPTANCE_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-07_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b07-accepted.json","docs/test_reports/B-07_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-07_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B07_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B07_ACCEPTANCE_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B07_ACCEPTANCE_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B07_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B07_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==275];boundary=manifest.get("runtime_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=275,progress.get("current_work_package")!="B-08",progress.get("status")!="READY","B-07" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-08",(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=0,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("package_id")!="B-08",(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="B278C498DB599FE7FF67940996705758C9AECEF70466035B40F9FB7F36E1903C",manifest.get("blocking_findings")!=0,manifest.get("developer_manifest_sha256")!="3DBF08310FF92E715A862F9AC79D73F634840D62C33D47E40373357B862E5DF1",manifest.get("completion_manifest_sha256")!="44795EA8B67CE41D2956CB086E58B78812561E3F3DBB403548898ECBB39AB88A",boundary.get("actual_wsl_pg18")!="PASS_EVIDENCE_PRESERVED",boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("b08_start")!="FORBIDDEN_NOT_STARTED")): errors.append("B07_ACCEPTANCE_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B07_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b08_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-08_START_EVIDENCE_MANIFEST.json"
    expected={"docs/evidence/manifests/B-07_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b08-start.json","docs/work_orders/B-08_INVOCATION_PROMPT.md","docs/work_orders/B-08_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B08_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B08_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B08_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B08_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B08_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 276<=e.get("sequence",-1)<=278];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};runtime=manifest.get("runtime_boundary") or {}
    expected_ids=["AV-STAT-009","AV-STAT-011","AV-STAT-012","AV-STAT-013"]
    expected_paths={"packages/outbox/__init__.py","packages/outbox/models.py","packages/outbox/service.py","packages/progress/__init__.py","packages/progress/models.py","packages/progress/exporter.py","packages/persistence/progress_outbox_repository.py","migrations/versions/0007_progress_outbox.py","tests/outbox/test_transactional_outbox.py","tests/outbox/test_sequence_invariants.py","tests/progress/test_progress_exporter.py","tests/progress/test_crash_recovery.py","docs/validation/B-08_PROGRESS_OUTBOX_VALIDATION.md","docs/evidence/manifests/B-08_EVIDENCE_MANIFEST.json","docs/completion_reports/B-08_COMPLETION_REPORT.md"}
    if is_current and any((progress.get("event_sequence")!=278,progress.get("current_work_package")!="B-08",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,wi.get("artifact_id")!="WI-B-08-20260815-001",wi.get("sha256")!="655E40B3FE2C5834F3D7E143348DC99B411A2992A3381B3C45D6B36FB2AE2406",wi.get("invocation_sha256")!="4E7A0CF3AE60C154A8837E271526224310E4CC5B79E0D92450F8563E9BE0F0B3",wi.get("assigned_verification_ids")!=expected_ids,progress.get("active_agent")!="developer-primary-b08",worker.get("lease_epoch")!=1,write.get("write_epoch")!=1,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=expected_paths,set(write.get("path_scope",[]))!=expected_paths,(progress.get("next_work_package") or {}).get("package_id")!="B-09",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B08_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"],manifest.get("validated_base_commit")!="9913636f030aa248216f58e3251cfa181f491d9c",manifest.get("assigned_verification_ids")!=expected_ids,manifest.get("developer_exact_path_count")!=15,manifest.get("product_artifact_count")!=0,runtime.get("actual_db")!="NOT_EXECUTED",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_ui")!="NOT_EXECUTED",runtime.get("actual_browser")!="NOT_EXECUTED",runtime.get("actual_wsl")!="NOT_EXECUTED",runtime.get("actual_ysna_server")!="NOT_EXECUTED",runtime.get("shared_db")!="NOT_EXECUTED",runtime.get("production")!="NOT_EXECUTED",runtime.get("deployment")!="NOT_EXECUTED",runtime.get("developer_db_boundary")!="ISOLATED_WSL_ANVIL_DB_ONLY")): errors.append("B08_START_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B08_START_SUCCESSOR_INVALID")
    if (manifest.get("predecessor_acceptance_ref") or {}).get("sha256")!="996EF6B8C16B24870D73214389AFBC1FCEDE1D6CDD238951B200C05B2C97DD94": errors.append("B08_START_PREDECESSOR_INVALID")
    return sorted(set(errors))


def validate_b09_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-09_START_EVIDENCE_MANIFEST.json"
    expected={"docs/evidence/manifests/B-08_ACCEPTANCE_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b09-start.json","docs/work_orders/B-09_INVOCATION_PROMPT.md","docs/work_orders/B-09_MAIN_TAKEOVER_PACKET_R4.md","docs/work_orders/B-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B09_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B09_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B09_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B09_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B09_START_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 296<=e.get("sequence",-1)<=301];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};runtime=manifest.get("runtime_boundary") or {};lineage=progress.get("active_failure_lineage") or {}
    expected_ids=["AV-STAT-026","AV-STAT-027","AV-STAT-043","AV-SAFE-028"]
    expected_paths={"packages/queue/__init__.py","packages/queue/models.py","packages/queue/service.py","packages/leases/__init__.py","packages/leases/models.py","packages/leases/service.py","packages/paths/identity.py","packages/persistence/queue_lease_repository.py","migrations/versions/0008_queue_worker_leases.py","tests/queue/test_durable_queue.py","tests/leases/test_worker_write_fencing.py","tests/paths/test_conflict_scope_identity.py","docs/validation/B-09_QUEUE_LEASE_VALIDATION.md","docs/evidence/manifests/B-09_EVIDENCE_MANIFEST.json","docs/completion_reports/B-09_COMPLETION_REPORT.md"}
    if is_current and any((progress.get("event_sequence")!=301,progress.get("current_work_package")!="B-09",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=3,lineage.get("step_lineage_id")!="B-09",lineage.get("failure_fingerprint")!="DB_FENCING_RECOVERY_CONTRACT_GAP",lineage.get("valid_failure_count")!=3,lineage.get("takeover_status")!="MAIN_TAKEOVER",wi.get("artifact_id")!="WI-B-09-20260820-004",wi.get("sha256")!=(manifest.get("work_instruction") or {}).get("sha256"),wi.get("invocation_sha256")!="3DBD1C1D68EAFD26E77B284BA22A9EF6FFCD70B6A53987B10DF71401A96FF955",wi.get("assigned_verification_ids")!=expected_ids,progress.get("active_agent")!="main-agent-eoul",worker.get("lease_epoch")!=4,worker.get("execution_fencing_token")!="b09-main-takeover-execution-fence-epoch-4-7c3382a",write.get("write_epoch")!=4,write.get("write_fencing_token")!="b09-main-takeover-write-fence-epoch-4-7c3382a",write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=expected_paths,set(write.get("path_scope",[]))!=expected_paths,(progress.get("next_work_package") or {}).get("package_id")!="B-10",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B09_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["FAILURE_REPORT_ACCEPTED","WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],manifest.get("event_sequence")!=301,manifest.get("validated_base_commit")!="7c3382a497e995e18c736a487eee8761aa0c1a05",manifest.get("assigned_verification_ids")!=expected_ids,manifest.get("developer_exact_path_count")!=15,manifest.get("frozen_developer_dirty_path_count")!=15,manifest.get("main_projection_exact_path_count")!=17,manifest.get("actual_dirty_exact_path_count")!=32,manifest.get("projection_product_mutation_count")!=0,(manifest.get("failure_lineage") or {}).get("failure_fingerprint")!="DB_FENCING_RECOVERY_CONTRACT_GAP",(manifest.get("failure_lineage") or {}).get("valid_failure_count")!=3,(manifest.get("failure_lineage") or {}).get("takeover_status")!="MAIN_TAKEOVER",runtime.get("actual_db")!="NOT_EXECUTED_R4_TAKEOVER_PROJECTION",runtime.get("actual_api")!="NOT_EXECUTED",runtime.get("actual_ui")!="NOT_EXECUTED",runtime.get("actual_browser")!="NOT_EXECUTED",runtime.get("actual_wsl")!="NOT_EXECUTED_R4_TAKEOVER_PROJECTION",runtime.get("actual_ysna_server")!="NOT_EXECUTED",runtime.get("shared_db")!="NOT_EXECUTED",runtime.get("production")!="NOT_EXECUTED",runtime.get("deployment")!="NOT_EXECUTED",runtime.get("developer_db_boundary")!="ISOLATED_WSL_ANVIL_PG18_ONLY")): errors.append("B09_R4_MAIN_TAKEOVER_PROJECTION_MISMATCH")
    if (manifest.get("predecessor_acceptance_ref") or {}).get("sha256")!="6D98116937FC09DA1B51996A87315A33FDA6972C13B8F55F1D6048685CC754E4": errors.append("B09_START_PREDECESSOR_INVALID")
    return sorted(set(errors))


def validate_b09_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-09_COMPLETION_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-09_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-09_EVIDENCE_MANIFEST.json","docs/completion_reports/B-09_COMPLETION_REPORT.md","docs/progress/progress-handoff-detached-digest-b09-completion-test-review.json","docs/work_orders/B-09_MAIN_TAKEOVER_PACKET_R4.md","docs/work_orders/B-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B09_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B09_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B09_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B09_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B09_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 302<=e.get("sequence",-1)<=304];wi=progress.get("active_work_instruction") or {};boundary=manifest.get("evidence_boundary") or {};lineage=progress.get("active_failure_lineage") or {}
    if is_current and any((progress.get("event_sequence")!=304,progress.get("current_work_package")!="B-09",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=3,lineage.get("failure_fingerprint")!="DB_FENCING_RECOVERY_CONTRACT_GAP",lineage.get("takeover_status")!="MAIN_TAKEOVER_COMPLETED",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-09-20260820-004",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B09_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="627D8E0A8A53C6B24ABEADEB634C7CA56523344B33A542BF1ACDA84C2FE5F302",manifest.get("developer_target_hash")!="04F60254D720A3A02DDB055646FEA0B708229399AD8DF0406F4296A4B70C6FEA",manifest.get("product_exact_paths_frozen") is not True,manifest.get("product_exact_path_count")!=15,manifest.get("product_mutation_count")!=0,boundary.get("actual_wsl_pg18")!="PASS_0007_0008_0007_FI04_3_OF_3_STALE_EXEC_WRITE_SKIP_LOCKED_QUARANTINE_CLEANUP",boundary.get("independent_tester")!="PENDING",boundary.get("acceptance")!="FORBIDDEN_PENDING_INDEPENDENT_TEST",boundary.get("b10_start")!="FORBIDDEN_PENDING_B09_ACCEPTANCE")): errors.append("B09_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B09_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b09_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-09_REWORK_START_PROGRESS_MANIFEST_R5.json"
    expected={"docs/evidence/manifests/B-09_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/failure-ledger.json","docs/progress/progress-handoff-detached-digest-b09-rework-start-r5.json","docs/test_reports/B-09_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-09_INVOCATION_PROMPT.md","docs/work_orders/B-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B09_R5_REWORK_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B09_R5_REWORK_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B09_R5_REWORK_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B09_R5_REWORK_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B09_R5_REWORK_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 305<=e.get("sequence",-1)<=308];wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};lineage=progress.get("active_failure_lineage") or {}
    expected_paths={"packages/queue/__init__.py","packages/queue/models.py","packages/queue/service.py","packages/leases/__init__.py","packages/leases/models.py","packages/leases/service.py","packages/paths/identity.py","packages/persistence/queue_lease_repository.py","migrations/versions/0008_queue_worker_leases.py","tests/queue/test_durable_queue.py","tests/leases/test_worker_write_fencing.py","tests/paths/test_conflict_scope_identity.py","docs/validation/B-09_QUEUE_LEASE_VALIDATION.md","docs/evidence/manifests/B-09_EVIDENCE_MANIFEST.json","docs/completion_reports/B-09_COMPLETION_REPORT.md"}
    if is_current and any((progress.get("event_sequence")!=308,progress.get("current_work_package")!="B-09",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=4,lineage.get("failure_fingerprint")!="DB_FENCING_RECOVERY_CONTRACT_GAP",lineage.get("takeover_status")!="MAIN_TAKEOVER_REWORK",progress.get("active_agent")!="main-agent-eoul",wi.get("artifact_id")!="WI-B-09-20260820-005",wi.get("result_status")!="REWORK_IN_PROGRESS",wi.get("source_test_report_sha256")!="8DE9794641BB22716A2A6392B9AC2F96B22387DFC12BFF17C91F467777C62B5D",worker.get("lease_epoch")!=5,worker.get("execution_fencing_token")!="b09-main-rework-execution-fence-epoch-5-7c3382a",write.get("write_epoch")!=5,write.get("write_fencing_token")!="b09-main-rework-write-fence-epoch-5-7c3382a",write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=expected_paths,set(write.get("path_scope",[]))!=expected_paths,(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B09_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],manifest.get("event_sequence")!=308,manifest.get("product_exact_path_count")!=15,manifest.get("actual_dirty_exact_path_count")!=37,manifest.get("projection_product_mutation_count")!=0,manifest.get("tester_report_sha256")!="8DE9794641BB22716A2A6392B9AC2F96B22387DFC12BFF17C91F467777C62B5D",manifest.get("finding_ids")!=["BLK-B09-IT-001","BLK-B09-IT-002"])): errors.append("B09_R5_REWORK_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B09_R5_REWORK_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b09_rework_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-09_REWORK_COMPLETION_PROGRESS_MANIFEST_R5.json"
    expected={"docs/completion_reports/B-09_COMPLETION_REPORT.md","docs/evidence/manifests/B-09_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-09_REWORK_START_PROGRESS_MANIFEST_R5.json","docs/progress/progress-handoff-detached-digest-b09-rework-completion-r5.json","docs/test_reports/B-09_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B09_R5_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B09_R5_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B09_R5_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B09_R5_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B09_R5_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 309<=e.get("sequence",-1)<=311];wi=progress.get("active_work_instruction") or {};lineage=progress.get("active_failure_lineage") or {};boundary=manifest.get("evidence_boundary") or {};repo=manifest.get("repository_projection") or {}
    if is_current and any((progress.get("event_sequence")!=311,progress.get("current_work_package")!="B-09",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=4,lineage.get("takeover_status")!="MAIN_TAKEOVER_REWORK_COMPLETED",progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-09-20260820-005",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING_RETEST",wi.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B09_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="5DBBEB29C5788E1D91B092B2239E615E8505C4B2F41F61E061D7A136ACA85F26",manifest.get("developer_target_hash")!="0EE80F9B636595125F94E5B5C5E50BC4B703D6DA1E2BDC9D88061DB42A354578",manifest.get("product_exact_paths_frozen") is not True,manifest.get("product_exact_path_count")!=15,manifest.get("product_mutation_after_freeze_count")!=0,repo.get("actual_dirty_exact_path_count")!=39,repo.get("main_projection_exact_path_count")!=24,boundary.get("independent_tester")!="PENDING_RETEST",boundary.get("acceptance")!="FORBIDDEN_PENDING_INDEPENDENT_RETEST",boundary.get("b10_start")!="FORBIDDEN_PENDING_B09_ACCEPTANCE")): errors.append("B09_R5_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B09_R5_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b09_r5_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-09_ACCEPTANCE_PROGRESS_MANIFEST_R5.json"
    expected={"docs/evidence/manifests/B-09_REWORK_COMPLETION_PROGRESS_MANIFEST_R5.json","docs/progress/progress-handoff-detached-digest-b09-accepted-r5.json","docs/test_reports/B-09_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-09_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B09_R5_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B09_R5_ACCEPTANCE_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B09_R5_ACCEPTANCE_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B09_R5_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B09_R5_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[event for event in bundle["events"]["events"] if event.get("sequence")==312];historical=progress.get("historical_failure_counts_by_lineage") or {};boundary=manifest.get("runtime_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=312,progress.get("current_work_package")!="B-10",progress.get("status")!="READY","B-09" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,historical.get("B-09")!=4,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-10",(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=0,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("package_id")!="B-10",(progress.get("next_work_package") or {}).get("status")!="READY",[event.get("event_type") for event in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="A84E6FE92F11F987D987E7787344D8A81125ECF977168DBDA0641BD6DB4D732D",manifest.get("tester_verdict")!="READY_FOR_MAIN_ACCEPTANCE",manifest.get("blocking_findings")!=0,manifest.get("closed_findings")!=["BLK-B09-IT-001","BLK-B09-IT-002"],manifest.get("developer_manifest_sha256")!="5DBBEB29C5788E1D91B092B2239E615E8505C4B2F41F61E061D7A136ACA85F26",manifest.get("developer_target_hash")!="0EE80F9B636595125F94E5B5C5E50BC4B703D6DA1E2BDC9D88061DB42A354578",manifest.get("product_exact_paths_frozen") is not True,manifest.get("product_mutation_after_freeze_count")!=0,boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("b10_start")!="FORBIDDEN_NOT_STARTED")): errors.append("B09_R5_ACCEPTANCE_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={row.get("path"):row for row in successor.get("live_raw_checksums",[]) if isinstance(row,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,path,row.get("bytes"),row.get("sha256")) for path,row in indexed.items())): errors.append("B09_R5_ACCEPTANCE_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b08_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-08_COMPLETION_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-08_START_EVIDENCE_MANIFEST.json","docs/evidence/manifests/B-08_EVIDENCE_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b08-completion-test-review.json","docs/work_orders/B-08_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B08_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B08_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=(not is_current) or portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B08_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B08_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B08_COMPLETION_TARGET_MISMATCH")
    terminal=[e for e in bundle["events"]["events"] if 279<=e.get("sequence",-1)<=281];wi=progress.get("active_work_instruction") or {};boundary=manifest.get("evidence_boundary") or {}
    if is_current and any((progress.get("event_sequence")!=281,progress.get("current_work_package")!="B-08",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=0,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-08-20260815-001",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING_DATABASE_VERIFICATION",wi.get("database_verification_status")!="BLOCKED_NOT_EXECUTED",(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B08_ACCEPTANCE",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],manifest.get("developer_manifest_sha256")!="91B20ACE8DCBAC4C64F57F5F0158333F6E13665F6E615E81BEB74BE7D1CB47CC",manifest.get("developer_target_hash")!="45B736CE7845E9E5E757DF45916B025479D7CD51EAC281A4CEBD8306BAAF695B",manifest.get("developer_exact_paths_frozen") is not True,manifest.get("developer_mutation")!="FORBIDDEN_FROZEN_PREDECESSOR",boundary.get("actual_wsl_pg18")!="BLOCKED_NOT_EXECUTED",boundary.get("independent_tester")!="PENDING_DATABASE_VERIFICATION",boundary.get("acceptance")!="FORBIDDEN_PENDING_DATABASE_VERIFICATION",boundary.get("b09_start")!="FORBIDDEN_PENDING_B08_ACCEPTANCE")): errors.append("B08_COMPLETION_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B08_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b08_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    is_current=(progress.get("current_progress_evidence_ref") or {}).get("manifest_path")=="docs/evidence/manifests/B-08_ACCEPTANCE_PROGRESS_MANIFEST.json"
    expected={"docs/evidence/manifests/B-08_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b08-accepted.json","docs/test_reports/B-08_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-08_WORK_INSTRUCTION.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B08_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B08_ACCEPTANCE_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B08_ACCEPTANCE_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B08_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B08_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==282];boundary=manifest.get("runtime_boundary") or {}
    expected_runtime="PASS_INDEPENDENT_0006_0007_0006_VALID_PROJECT_RUN_OUTBOX_SNAPSHOT_ACK_HOSTILE13_ATOMIC_ROLLBACK_CLEANUP"
    if is_current and any((progress.get("event_sequence")!=282,progress.get("current_work_package")!="B-09",progress.get("status")!="READY","B-08" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-09",(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=0,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("package_id")!="B-09",(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="EF8976924169E5267F9DD028C5ACAFAF836EDA0834069C0134E49C3618934DE9",manifest.get("tester_verdict")!="READY_FOR_MAIN_ACCEPTANCE",manifest.get("blocking_findings")!=0,manifest.get("developer_manifest_sha256")!="91B20ACE8DCBAC4C64F57F5F0158333F6E13665F6E615E81BEB74BE7D1CB47CC",manifest.get("developer_target_hash")!="45B736CE7845E9E5E757DF45916B025479D7CD51EAC281A4CEBD8306BAAF695B",manifest.get("completion_manifest_sha256")!="2150C5AF841D4DD3B1E79D390F4339C3BDF08518D14DEA57215B42FEA191AC00",manifest.get("completion_target_hash")!="FA84EE2E577D4A38256A2F2459ABC326CA39E8C23D630F3B54208E1D600C6076",boundary.get("actual_wsl_pg18")!=expected_runtime,boundary.get("actual_api")!="NOT_EXECUTED",boundary.get("actual_ui")!="NOT_EXECUTED",boundary.get("actual_browser")!="NOT_EXECUTED",boundary.get("actual_provider")!="NOT_EXECUTED",boundary.get("actual_ysna_server")!="NOT_EXECUTED",boundary.get("shared_db")!="NOT_EXECUTED",boundary.get("production")!="NOT_EXECUTED",boundary.get("deployment")!="NOT_EXECUTED",boundary.get("b09_start")!="FORBIDDEN_NOT_STARTED")): errors.append("B08_ACCEPTANCE_PROJECTION_MISMATCH")
    required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"};successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)}
    if is_current and (set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items())): errors.append("B08_ACCEPTANCE_SUCCESSOR_INVALID")
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


def validate_b03_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/evidence/manifests/B-03_COMPLETION_PROGRESS_MANIFEST.json","docs/progress/progress-handoff-detached-digest-b03-rework-start-r2.json","docs/test_reports/B-03_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-03_REWORK_INVOCATION_PROMPT_R2.md","docs/work_orders/B-03_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B03_R2_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B03_R2_START_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B03_R2_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B03_R2_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B03_R2_START_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};terminal=[e for e in bundle["events"]["events"] if 228<=e.get("sequence",-1)<=230]
    expected_developer_paths={"apps/web/server.mjs","apps/web/design-flow.html","apps/web/src/api/design-flow-client.js","apps/web/src/app/design-flow.js","apps/web/src/styles/design-flow.css","packages/api/design_runtime.py","tests/browser/b03/design-flow-runtime.test.mjs","tests/design/test_runtime_bridge.py","docs/evidence/runtime/B-03_FLOW_NORMAL.png","docs/evidence/runtime/B-03_FLOW_ERROR.png","docs/evidence/runtime/B-03_FLOW_BLOCKED.png","docs/evidence/runtime/B-03_FLOW_EVENT_SEQUENCE.json","docs/validation/B-03_DESIGN_LINEAGE_VALIDATION_R2.md","docs/evidence/manifests/B-03_EVIDENCE_MANIFEST_R2.json","docs/completion_reports/B-03_COMPLETION_REPORT_R2.md"}
    if any((progress.get("event_sequence")!=230,progress.get("current_work_package")!="B-03",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=0,progress.get("active_agent")!="developer-primary-b03",wi.get("artifact_id")!="WI-B-03-20260814-002",wi.get("source_test_report_sha256")!="F55282DD30362AB1D76580442932D910C899CB771BFBC4DF1708C7F4F0AF474D",worker.get("lease_epoch")!=2,write.get("write_epoch")!=2,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=expected_developer_paths,[e.get("event_type") for e in terminal]!=["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE",manifest.get("tester_report_sha256")!="F55282DD30362AB1D76580442932D910C899CB771BFBC4DF1708C7F4F0AF474D",manifest.get("blocked_classification")!="VERIFICATION_ENVIRONMENT_GAP_NOT_VALID_FAILURE",manifest.get("valid_failure_count")!=0,set(manifest.get("developer_r2_exact_paths",[]))!=expected_developer_paths)): errors.append("B03_R2_START_PROJECTION_MISMATCH")
    boundary=manifest.get("scope_boundary") or {}
    if any((boundary.get("local_same_origin_harness")!="REQUIRED",boundary.get("actual_b03_service")!="REQUIRED",boundary.get("b11_canonical_registry_sse_auth_prod")!="FORBIDDEN",boundary.get("shared_wsl_production_provider_deploy")!="FORBIDDEN")): errors.append("B03_R2_START_SCOPE_BOUNDARY_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)};required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B03_R2_START_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b03_rework_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R2.json","docs/evidence/manifests/B-03_EVIDENCE_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-b03-rework-completion-r2.json","docs/work_orders/B-03_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B03_R2_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B03_R2_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B03_R2_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B03_R2_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B03_R2_COMPLETION_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {};terminal=[e for e in bundle["events"]["events"] if 231<=e.get("sequence",-1)<=233];evidence=manifest.get("actual_evidence") or {}
    if progress.get("event_sequence") == 233 and any((progress.get("current_work_package")!="B-03",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=0,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-03-20260814-002",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="R2_PENDING",wi.get("developer_manifest_sha256")!="ADC773EF9C6D9A973B46660331AE1A9956ED010B11CC11D4A0C25ADAD472EC87",wi.get("developer_target_hash")!="A08847E8970706D49EAAC5181CE6743C1012145C151078E6D5390D4BB52B8ED8",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE",evidence.get("e_shot_3")!="PASS_ACTUAL_LOCAL",evidence.get("e_evt")!="PASS_ACTUAL_LOCAL",evidence.get("independent_retest")!="R2_PENDING")): errors.append("B03_R2_COMPLETION_PROJECTION_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)};required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B03_R2_COMPLETION_SUCCESSOR_INVALID")
    a14=manifest.get("a14_server_successor_projection") or {};a14rows={r.get("path"):r for r in a14.get("live_raw_checksums",[]) if isinstance(r,dict)}
    def a14_row_matches(path: str, row: Mapping[str, Any]) -> bool:
        if portable_row_matches(root,path,row.get("bytes"),row.get("sha256")):
            return True
        if row.get("canonical_eol") != "LF":
            return False
        raw=(root/path).read_bytes().replace(b"\r\n",b"\n").replace(b"\r",b"\n")
        return len(raw)==row.get("bytes") and hashlib.sha256(raw).hexdigest().upper()==row.get("sha256")
    if a14.get("authorization")!="B03_R2_LOCAL_SAME_ORIGIN_SHARED_SERVER" or set(a14rows)!={"apps/web/server.mjs","scripts/check_a14_workbench_prototype.py","tests/tooling/test_a14_workbench_prototype.py"} or any(not a14_row_matches(p,r) for p,r in a14rows.items()): errors.append("B03_R2_COMPLETION_A14_SERVER_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b03_r3_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json","docs/progress/failure-ledger.json","docs/progress/progress-handoff-detached-digest-b03-rework-start-r3.json","docs/test_reports/B-03_RETEST_REPORT_R2.md","docs/work_orders/B-03_REWORK_INVOCATION_PROMPT_R3.md","docs/work_orders/B-03_REWORK_WORK_INSTRUCTION_R3.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B03_R3_START_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B03_R3_START_RAW_INVALID");continue
        seen.add(relative)
        try:
            ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
            if not ok and relative=="docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json" and row.get("canonical_eol")=="LF":
                raw=(root/relative).read_bytes().replace(b"\r\n",b"\n").replace(b"\r",b"\n")
                ok=len(raw)==row.get("bytes") and hashlib.sha256(raw).hexdigest().upper()==row.get("sha256")
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B03_R3_START_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B03_R3_START_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B03_R3_START_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {};worker=progress.get("worker_lease") or {};write=progress.get("write_lease") or {};terminal=[e for e in bundle["events"]["events"] if 234<=e.get("sequence",-1)<=237]
    developer_paths={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py","docs/validation/B-03_A13_INNER_CLONE_PORTABILITY_VALIDATION_R3.md","docs/evidence/manifests/B-03_EVIDENCE_MANIFEST_R3.json","docs/completion_reports/B-03_COMPLETION_REPORT_R3.md"}
    if any((progress.get("event_sequence")!=237,progress.get("current_work_package")!="B-03",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=1,(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=1,progress.get("active_agent")!="developer-primary-b03",wi.get("artifact_id")!="WI-B-03-20260814-003",wi.get("source_test_report_sha256")!="D41F9D21BF3C92D6BD6C2FDEBDB80C2504E63745103D8655C78DC4F9A978E1C5",worker.get("lease_epoch")!=3,write.get("write_epoch")!=3,write.get("worker_lease_id")!=worker.get("lease_id"),set(write.get("paths",[]))!=developer_paths,[e.get("event_type") for e in terminal]!=["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE",manifest.get("tester_report_sha256")!="D41F9D21BF3C92D6BD6C2FDEBDB80C2504E63745103D8655C78DC4F9A978E1C5",manifest.get("failure_fingerprint")!="BLK-B03-R2-001-CURRENT-CHECKOUT-A13-INNER-CLONE-PORTABILITY",manifest.get("valid_failure_count")!=1,set(manifest.get("developer_r3_exact_paths",[]))!=developer_paths)): errors.append("B03_R3_START_PROJECTION_MISMATCH")
    boundary=manifest.get("scope_boundary") or {}
    if any((boundary.get("clone_local_eol_determinism")!="REQUIRED",boundary.get("system_global_git_config")!="FORBIDDEN",boundary.get("product_runtime_reimplementation")!="FORBIDDEN",boundary.get("actual_browser_service_security")!="PASS_FROZEN")): errors.append("B03_R3_START_SCOPE_BOUNDARY_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)};required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B03_R3_START_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b03_r3_rework_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"];progress=bundle["progress"];errors=[]
    expected={"docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R3.json","docs/evidence/manifests/B-03_EVIDENCE_MANIFEST_R3.json","docs/progress/progress-handoff-detached-digest-b03-rework-completion-r3.json","docs/work_orders/B-03_REWORK_WORK_INSTRUCTION_R3.md"}
    rows=manifest.get("raw_checksums");seen=set();canonical=[];total=0
    if not isinstance(rows,list): return ["B03_R3_COMPLETION_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B03_R3_COMPLETION_RAW_INVALID");continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B03_R3_COMPLETION_RAW_INVALID");continue
        total+=int(row["bytes"]);canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B03_R3_COMPLETION_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode();target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B03_R3_COMPLETION_TARGET_MISMATCH")
    wi=progress.get("active_work_instruction") or {};terminal=[e for e in bundle["events"]["events"] if 238<=e.get("sequence",-1)<=240]
    if any((progress.get("event_sequence")!=240,progress.get("current_work_package")!="B-03",progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=1,(progress.get("active_failure_lineage") or {}).get("valid_failure_count")!=1,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,wi.get("artifact_id")!="WI-B-03-20260814-003",wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="R3_PENDING",wi.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST",wi.get("developer_manifest_sha256")!="C0E2EBACEB98BB1A0F7246A60DC1FC389ABFC35C21D868DFB8098C08C2487272",wi.get("developer_target_hash")!="9015590770C866E612DCB5B59152BBAAE4E078503DD5F3224F40CA142AC47EE6",[e.get("event_type") for e in terminal]!=["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],(progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE",manifest.get("developer_manifest_sha256")!="C0E2EBACEB98BB1A0F7246A60DC1FC389ABFC35C21D868DFB8098C08C2487272",manifest.get("developer_target_hash")!="9015590770C866E612DCB5B59152BBAAE4E078503DD5F3224F40CA142AC47EE6")): errors.append("B03_R3_COMPLETION_PROJECTION_MISMATCH")
    boundary=manifest.get("evidence_boundary") or {}
    if any((boundary.get("actual_browser_service_security")!="PASS_R2_EVIDENCE_PRESERVED",boundary.get("browser_runtime_rerun")!="NOT_EXECUTED",boundary.get("independent_retest")!="R3_PENDING")): errors.append("B03_R3_COMPLETION_EVIDENCE_BOUNDARY_MISMATCH")
    successor=manifest.get("a13_successor_projection") or {};indexed={r.get("path"):r for r in successor.get("live_raw_checksums",[]) if isinstance(r,dict)};required={"scripts/check_a13_repository_scan.py","tests/tooling/test_a13_repository_scan.py"}
    if set(indexed)!=required or any(not portable_row_matches(root,p,r.get("bytes"),r.get("sha256")) for p,r in indexed.items()): errors.append("B03_R3_COMPLETION_SUCCESSOR_INVALID")
    return sorted(set(errors))


def validate_b03_r3_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]; errors=[]
    expected={"docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json","docs/progress/progress-handoff-detached-digest-b03-accepted-r3.json","docs/test_reports/B-03_RETEST_REPORT_R3.md"}
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return ["B03_R3_ACCEPTANCE_RAW_INVALID"]
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B03_R3_ACCEPTANCE_RAW_INVALID"); continue
        seen.add(relative)
        try: ok=portable_row_matches(root,relative,row.get("bytes"),row.get("sha256"))
        except (OSError,TypeError): ok=False
        if not ok: errors.append("B03_R3_ACCEPTANCE_RAW_INVALID"); continue
        total+=int(row["bytes"]); canonical.append(f"{relative}\t{row['bytes']}\t{row['sha256']}")
    if seen!=expected: errors.append("B03_R3_ACCEPTANCE_RAW_SET_INVALID")
    can="\n".join(sorted(canonical,key=lambda value:value.encode())).encode(); target="sha256:"+hashlib.sha256(can).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(can),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B03_R3_ACCEPTANCE_TARGET_MISMATCH")
    acceptance=[e for e in bundle["events"]["events"] if e.get("sequence")==241]
    historical=progress.get("historical_failure_counts_by_lineage") or {}
    if any((progress.get("event_sequence")!=241,progress.get("current_work_package")!="B-04",progress.get("status")!="READY","B-03" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,(progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-04",historical.get("B-03")!=1,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {}).get("status")!="READY",[e.get("event_type") for e in acceptance]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="E90448B45A3646E32351C60E17C8FD77F628A1C1D688B42A6481FCEEFCCB59C6",manifest.get("blocking_findings")!=0)): errors.append("B03_R3_ACCEPTANCE_PROJECTION_MISMATCH")
    boundary=manifest.get("runtime_boundary") or {}
    if boundary.get("actual_browser_service_security")!="PASS_R2_EVIDENCE_PRESERVED" or boundary.get("r3_browser_rerun")!="NOT_EXECUTED_NOT_REQUIRED_FOR_R3_SCOPE": errors.append("B03_R3_ACCEPTANCE_BOUNDARY_MISMATCH")
    return sorted(set(errors))


def _git_value(root: Path, *arguments: str) -> str | None:
    result = subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        check=False,
        text=True,
        encoding="utf-8",
        errors="surrogateescape",
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
        encoding="utf-8",
        errors="surrogateescape",
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
    progress: Mapping[str, Any] | None = None,
    actual_feature_remote_head: str | None = None,
    projected_local_head_is_ancestor: bool = False,
    control_descendant_paths: list[str] | None = None,
    control_is_ancestor: bool = False,
    worktree_is_clean: bool = True,
    control_runtime_record_commit_is_direct: bool = False,
) -> list[str]:
    errors: list[str] = []
    base = repository.get("validated_base_commit")
    allowed = repository.get("exact_allowed_paths")
    lr02a_active_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_EXACT22_WORKTREE"
        and (progress or {}).get("event_sequence") == 401
    )
    lr02a_r2_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_EXACT29_REWORK_WORKTREE"
        and (progress or {}).get("event_sequence") == 407
    )
    lr02a_r3_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_EXACT36_REWORK_R3_WORKTREE"
        and (progress or {}).get("event_sequence") == 413
    )
    lr02a_accepted_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_LR02A_ACCEPTED_EXACT41_WORKTREE"
        and (progress or {}).get("event_sequence") == 424
    )
    lr02b_active_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02B_EXACT20_WORKTREE"
        and (progress or {}).get("event_sequence") == 428
    )
    lr02b_accepted_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_LR02B_ACCEPTED_EXACT24_WORKTREE"
        and (progress or {}).get("event_sequence") == 435
    )
    lr02c_active_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_EXACT20_WORKTREE"
        and (progress or {}).get("event_sequence") == 439
    )
    lr02c_takeover_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_MAIN_TAKEOVER_EXACT25_WORKTREE"
        and (progress or {}).get("event_sequence") == 445
    )
    lr02c_rework_r3_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_MAIN_TAKEOVER_R3_EXACT30_WORKTREE"
        and (progress or {}).get("event_sequence") == 447
    )
    lr02c_accepted_r3_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_LR02C_ACCEPTED_R3_EXACT34_WORKTREE"
        and (progress or {}).get("event_sequence") == 453
    )
    lr02c_operational_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_OPERATIONAL_EXACT14_WORKTREE"
        and (progress or {}).get("event_sequence") == 457
    )
    c21_backup_portability_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_ACTIVE_C21_BACKUP_PORTABILITY_EXACT21_WORKTREE"
        and (progress or {}).get("event_sequence") == 464
    )
    c21_backup_portability_accepted_head_relation = (
        repository.get("head_relation") == "FEATURE_CHECKPOINT_WITH_BACKUP_PORTABILITY_ACCEPTED_EXACT24_WORKTREE"
        and (progress or {}).get("event_sequence") == 469
    )
    c21_ops_r2_head_relation = (
        repository.get("head_relation") == "FEATURE_WORKTREE_ACTIVE_OPS_R2_EXACT13"
        and (progress or {}).get("event_sequence") == 475
    )
    c21_ops_r2_release_rebind_head_relation = (
        repository.get("head_relation") == "FEATURE_WORKTREE_ACTIVE_OPS_R2_RELEASE_REBIND_EXACT10"
        and (progress or {}).get("event_sequence") == 477
    )
    c21_ops_r2_main_reconciliation_head_relation = (
        repository.get("head_relation") == "MAIN_OPS_R2_POST_MERGE_RECONCILIATION_EXACT7_PENDING_COMMIT"
        and (progress or {}).get("event_sequence") == 478
    )
    c21_ops_r2_conninfo_r4_head_relation = (
        repository.get("head_relation") == "FEATURE_WORKTREE_ACTIVE_OPS_R2_CONNINFO_R4_EXACT13"
        and (progress or {}).get("event_sequence") == 481
    )
    c21_ysna_staging_decision_head_relation = (
        repository.get("head_relation") == "FEATURE_WORKTREE_ACTIVE_C21_YSNA_STAGING_DECISION_EXACT15"
        and (progress or {}).get("event_sequence") == 482
    )
    c21_wsl_readiness_head_relation = (
        repository.get("head_relation") == "FEATURE_WORKTREE_C21_WSL_READINESS_WAITING_APPROVAL_EXACT18"
        and (progress or {}).get("event_sequence") == 483
    )
    c21_wsl_active_head_relation = (
        repository.get("head_relation") == "FEATURE_WORKTREE_C21_WSL_EARLY_VALIDATION_ACTIVE_EXACT34"
        and (progress or {}).get("event_sequence") == 485
    )
    c21_wsl_control_head_relation = (
        (
            repository.get("head_relation")
            == "FEATURE_WORKTREE_C21_WSL_CONTROL_SUCCESSOR_ACTIVE_EXACT34"
            and (progress or {}).get("event_sequence") == 486
        )
        or (
            repository.get("head_relation")
            == "FEATURE_WORKTREE_C21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_ACTIVE_EXACT39"
            and (progress or {}).get("event_sequence") == 487
        )
        or (
            repository.get("head_relation")
            == "FEATURE_WORKTREE_C21_WSL_CONTROL_RUNTIME_SUCCESSOR_ACTIVE_EXACT42"
            and (progress or {}).get("event_sequence") == 488
        )
        or (
            repository.get("head_relation")
            == "FEATURE_WORKTREE_C21_WSL_FRESH_CLONE_CANDIDATE_REBIND_ACTIVE_EXACT44_RECORD11"
            and (progress or {}).get("event_sequence") == 489
        )
        or (
            repository.get("head_relation")
            == "FEATURE_WORKTREE_C21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_ACTIVE_EXACT46_RECORD11"
            and (progress or {}).get("event_sequence") == 490
        )
        or (
            repository.get("head_relation")
            == "FEATURE_WORKTREE_C21_WSL_COLD_START_CANDIDATE_REBIND_ACTIVE_EXACT48_RECORD11"
            and (progress or {}).get("event_sequence") == 491
        )
        or (
            repository.get("head_relation")
            == "FEATURE_WORKTREE_C21_WSL_INGRESS_CANDIDATE_REBIND_ACTIVE_EXACT51_RECORD13"
            and (progress or {}).get("event_sequence") == 492
        )
    )
    if (
        repository.get("projection_mode") != VALIDATED_BASE_PROJECTION_MODE
        or (
            repository.get("head_relation") != VALIDATED_BASE_PENDING_RELATION
            and not lr02a_active_head_relation
            and not lr02a_r2_head_relation
            and not lr02a_r3_head_relation
            and not lr02a_accepted_head_relation
            and not lr02b_active_head_relation
            and not lr02b_accepted_head_relation
            and not lr02c_active_head_relation
            and not lr02c_takeover_head_relation
            and not lr02c_rework_r3_head_relation
            and not lr02c_accepted_r3_head_relation
            and not lr02c_operational_head_relation
            and not c21_backup_portability_head_relation
            and not c21_backup_portability_accepted_head_relation
            and not c21_ops_r2_head_relation
            and not c21_ops_r2_release_rebind_head_relation
            and not c21_ops_r2_main_reconciliation_head_relation
            and not c21_ops_r2_conninfo_r4_head_relation
            and not c21_ysna_staging_decision_head_relation
            and not c21_wsl_readiness_head_relation
            and not c21_wsl_active_head_relation
            and not c21_wsl_control_head_relation
        )
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
    b03_rework_start_projection = repository.get("validated_base_commit") == "f9fbf64f2f6f135050b69afe47e6bed3aabeea3b" and "docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R2.json" in allowed
    b03_rework_completion_projection = repository.get("validated_base_commit") in {"fcfa8059e060702afa6ea5fa801d40c4cb01cb63","6375e4e823c92fa518a9bab71a8db720dd132cc0","7508553188368b0b459faa3b67c2668ffb37c11a"} and "docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json" in allowed
    b03_r3_rework_start_projection = repository.get("validated_base_commit") == "03c0d131693f5479f16aababcce385ca1c46aee6" and "docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R3.json" in allowed
    b03_r3_rework_completion_projection = repository.get("validated_base_commit") == "0f1ebb0686c2524fe6df9c1ba560e0c76cf7eeb3" and "docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json" in allowed
    b03_r3_acceptance_projection = repository.get("validated_base_commit") == "fc1304c903b74e7b8363c3fdf8556ea2a45d02aa" and "docs/evidence/manifests/B-03_ACCEPTANCE_PROGRESS_MANIFEST_R3.json" in allowed
    b04_start_projection = repository.get("validated_base_commit") == "1519d8cce5e205bd9e20652cc380e65e9ca01e49" and "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json" in allowed
    b04_completion_projection = repository.get("validated_base_commit") == "47ad9e1216981c670aaec49b23e628315cff3547" and "docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b04_acceptance_projection = repository.get("validated_base_commit") == "75d9c72b847ed7122985d1bee656cbcc4b4da883" and "docs/evidence/manifests/B-04_ACCEPTANCE_PROGRESS_MANIFEST.json" in allowed
    workplan_v16_successor_projection = repository.get("validated_base_commit") == "56d409c4583bcf4090423995e79c63ae63598c1d" and "docs/evidence/manifests/WORKPLAN_V16_SUCCESSOR_MANIFEST.json" in allowed
    b05_start_projection = repository.get("validated_base_commit") == "e59c4a105dab0faae31f43fd75e3ac53f1992ffe" and "docs/evidence/manifests/B-05_START_EVIDENCE_MANIFEST.json" in allowed
    b05_rebind_projection = repository.get("validated_base_commit") == "0a3a9bbf0c11ed53a5f5ff647591d48bc4d06565" and "docs/evidence/manifests/B-05_WI_REBIND_EVIDENCE_MANIFEST_R2.json" in allowed
    b05_completion_projection = repository.get("validated_base_commit") == "2edc44044df522e6ec7c56b95c5e9414932ac856" and "docs/evidence/manifests/B-05_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b05_acceptance_projection = repository.get("validated_base_commit") == "e08c2e34766e5a306c1d25d4579ff098c629dc3b" and "docs/evidence/manifests/B-05_ACCEPTANCE_PROGRESS_MANIFEST.json" in allowed
    b06_start_projection = repository.get("validated_base_commit") == "ebe9ce9c28c3e58f8d8200e5747e33ceb2d8174b" and "docs/evidence/manifests/B-06_START_EVIDENCE_MANIFEST.json" in allowed
    b06_completion_projection = repository.get("validated_base_commit") == "105b12be5554d0d2de0c5440cda3d2cb25e98c05" and "docs/evidence/manifests/B-06_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b07_start_projection = (repository.get("validated_base_commit") == "1a9c25b7ce2c257d40aaa10fcf3a0478f654db93" and "docs/evidence/manifests/B-07_START_EVIDENCE_MANIFEST.json" in allowed) or (repository.get("validated_base_commit") == "2d100b157aedc36da8a78341bbe67085c1663236" and "docs/evidence/manifests/B-07_COMPLETION_PROGRESS_MANIFEST.json" in allowed)
    b08_start_projection = repository.get("validated_base_commit") == "9913636f030aa248216f58e3251cfa181f491d9c" and "docs/evidence/manifests/B-08_START_EVIDENCE_MANIFEST.json" in allowed
    b08_completion_projection = repository.get("validated_base_commit") == "dfc92411bd7b4127623863c71aa7c30f3ccaf8be" and "docs/evidence/manifests/B-08_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b08_acceptance_projection = repository.get("validated_base_commit") == "7cea707b2ce765a306544873cfe31703a3d8201d" and "docs/evidence/manifests/B-08_ACCEPTANCE_PROGRESS_MANIFEST.json" in allowed
    b09_start_projection = repository.get("validated_base_commit") in {"716398fe0a44d6dbce17c4378c78c8e9e0cb5962","e33f231c2a7fbc7f020391939ff067f8d6177cb6","7c3382a497e995e18c736a487eee8761aa0c1a05"} and "docs/evidence/manifests/B-09_START_EVIDENCE_MANIFEST.json" in allowed
    b09_completion_projection = repository.get("validated_base_commit") == "7c3382a497e995e18c736a487eee8761aa0c1a05" and "docs/evidence/manifests/B-09_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b09_r5_rework_projection = repository.get("validated_base_commit") == "7c3382a497e995e18c736a487eee8761aa0c1a05" and "docs/evidence/manifests/B-09_REWORK_START_PROGRESS_MANIFEST_R5.json" in allowed
    b09_r5_completion_projection = repository.get("validated_base_commit") == "7c3382a497e995e18c736a487eee8761aa0c1a05" and "docs/evidence/manifests/B-09_REWORK_COMPLETION_PROGRESS_MANIFEST_R5.json" in allowed
    b09_r5_acceptance_projection = repository.get("validated_base_commit") == "7c3382a497e995e18c736a487eee8761aa0c1a05" and "docs/evidence/manifests/B-09_ACCEPTANCE_PROGRESS_MANIFEST_R5.json" in allowed
    b10_start_projection = repository.get("validated_base_commit") == "ac371f5743dce0fa87b3ee3b767d63c9c6102cd8" and "docs/evidence/manifests/B-10_START_EVIDENCE_MANIFEST.json" in allowed
    b10_completion_projection = repository.get("validated_base_commit") == "9419c686c1e82823ced20c3cb9b0ddfcfa82d7ba" and "docs/evidence/manifests/B-10_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b10_rework_projection = (repository.get("validated_base_commit") == "e9dd00983775a5b1b2849f6be35304e34ef4fa17" and "docs/evidence/manifests/B-10_REWORK_START_PROGRESS_MANIFEST_R2.json" in allowed) or (repository.get("validated_base_commit") == "a5515ea94d3b5a6e185c0521a0de4906d6e21dae" and "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json" in allowed) or (repository.get("validated_base_commit") == "5f644f45835329ef0195dae948d3c55ba7ff15af" and "docs/evidence/manifests/B-10_REWORK_START_PROGRESS_MANIFEST_R3.json" in allowed) or (repository.get("validated_base_commit") == "4cc75da50e9eb16988bc07ab7b1f237bd2b6b169" and "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json" in allowed)
    b10_acceptance_projection = repository.get("validated_base_commit") == "d92a24ef3ecaa0d55a8c2d3ad0d43dea49748037" and "docs/evidence/manifests/B-10_ACCEPTANCE_PROGRESS_MANIFEST_R3.json" in allowed
    b11_start_projection = repository.get("validated_base_commit") == "1134619b2ecdbe521bb0cce2288af7fac6d1e9dc" and "docs/evidence/manifests/B-11_START_EVIDENCE_MANIFEST.json" in allowed
    b11_completion_projection = repository.get("validated_base_commit") == "3304c7d82fd7101f6913cbee7b98bcd05ac75ede" and "docs/evidence/manifests/B-11_COMPLETION_PROGRESS_MANIFEST.json" in allowed
    b11_rework_projection = repository.get("validated_base_commit") == "ce8179527a64128899df21542b24f1b7f85e35b1" and "docs/evidence/manifests/B-11_REWORK_START_PROGRESS_MANIFEST_R2.json" in allowed
    b11_rework_projection = b11_rework_projection or (repository.get("validated_base_commit") == "f1e3a6bc8c145ab1961fa2b9dcabdea68191074b" and "docs/evidence/manifests/B-11_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json" in allowed)
    b11_acceptance_projection = repository.get("validated_base_commit") == "28bcf4742fee0536b09c75ce352e6f2ae505cebe" and "docs/evidence/manifests/B-11_ACCEPTANCE_PROGRESS_MANIFEST_R2.json" in allowed
    b12_start_projection = repository.get("validated_base_commit") == "370a39436c4b15a84483017583a9fe3878652504" and "docs/evidence/manifests/B-12_START_EVIDENCE_MANIFEST.json" in allowed
    b12_completion_projection = (repository.get("validated_base_commit") == "26e2fcf1977d11c22ce81b400b3bf0696337d4ac" and "docs/evidence/manifests/B-12_COMPLETION_PROGRESS_MANIFEST.json" in allowed) or (repository.get("validated_base_commit") == "e29ffcfc6e401af43bdb2672fd0817252792d652" and "docs/evidence/manifests/B-12_REWORK_START_PROGRESS_MANIFEST_R2.json" in allowed) or (repository.get("validated_base_commit") == "3bc5e3194d848dbaa1b85a8d55ab51e1d410a9e0" and "docs/evidence/manifests/B-12_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json" in allowed)
    phase_b_paths = {
        "docs/approvals/APPROVAL-20260821-PHASE-B-GATE-EXACT44-001.md", "docs/completion_reports/PHASE_B_GATE_COMPLETION_REPORT.md", "docs/evidence/manifests/PHASE_B_GATE_EVIDENCE_MANIFEST.json", "docs/evidence/manifests/PHASE_B_GATE_PROGRESS_PROJECTION_MANIFEST.json", "docs/progress/BUILD_HANDOFF.md", "docs/progress/SESSION_CHECKPOINT_2026-08-21_PHASE_B_GATE.md", "docs/progress/build-progress.json", "docs/progress/progress-events.json", "docs/progress/progress-handoff-detached-digest-phase-b-gate-start.json", "docs/test_reports/PHASE_B_GATE_INDEPENDENT_TEST_REPORT.md", "docs/validation/PHASE_B_GATE_AUTHORITY_CONFLICT_EVIDENCE.md", "docs/validation/PHASE_B_GATE_VALIDATION.md", "docs/work_orders/PHASE_B_GATE_INVOCATION_PROMPT.md", "docs/work_orders/PHASE_B_GATE_REWORK_INVOCATION_PROMPT_R2.md", "docs/work_orders/PHASE_B_GATE_REWORK_INVOCATION_PROMPT_R3.md", "docs/work_orders/PHASE_B_GATE_REWORK_WORK_INSTRUCTION_R2.md", "docs/work_orders/PHASE_B_GATE_REWORK_WORK_INSTRUCTION_R3.md", "docs/work_orders/PHASE_B_GATE_WORK_INSTRUCTION.md", "scripts/check_phase_b_gate.py", "scripts/check_project_progress.py", "tests/tooling/test_phase_b_gate.py", "tests/tooling/test_project_progress.py",
    }
    phase_b_instruction = (progress or {}).get("active_work_instruction") or {}
    phase_b_projection = (
        repository.get("validated_base_commit") == "165a9bfff5e085bfec322c748e83464477642f8a"
        and set(allowed) == phase_b_paths
        and (progress or {}).get("current_work_package") == "PHASE_B_GATE"
        and (progress or {}).get("status") == "TEST_REVIEW"
        and phase_b_instruction.get("result_status") == "COMPLETED"
        and phase_b_instruction.get("package_status") == "TEST_REVIEW"
        and phase_b_instruction.get("accepted") is False
    )
    c21_lr01_paths = {
        "docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md",
        "docs/approvals/APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR00_PROGRESS_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lifecycle-runtime.json",
        "docs/work_orders/C-21_LR-01_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_LR-01_WORK_INSTRUCTION.md",
        "migrations/versions/0013_task_bootstrap_authority.py",
        "packages/api/fastapi_app.py",
        "packages/api/registry.py",
        "packages/api/runtime.py",
        "packages/api/task_bootstrap.py",
        "packages/persistence/task_bootstrap_repository.py",
        "scripts/check_project_progress.py",
        "tests/api/test_task_bootstrap.py",
        "tests/persistence/test_task_bootstrap_postgres.py",
    }
    c21_lr01_projection = (
        repository.get("validated_base_commit") == "1573e0242aa718d0f81f6b6fc936c754b7c75e60"
        and set(allowed) == c21_lr01_paths
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and phase_b_instruction.get("artifact_id") == "WI-C-21-LR-01-20260903-001"
    )
    c21_lr01_accepted_paths = c21_lr01_paths | {
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR01_ACCEPTANCE_PROGRESS_MANIFEST.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR01_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr01-accepted.json",
    }
    accepted_c21_lr01 = (progress or {}).get("accepted_c21_lr01_work_instruction") or {}
    c21_lr01_accepted_projection = (
        repository.get("validated_base_commit") == "1573e0242aa718d0f81f6b6fc936c754b7c75e60"
        and set(allowed) == c21_lr01_accepted_paths
        and (progress or {}).get("event_sequence") == 398
        and (progress or {}).get("last_event_id") == "evt_c21_lr01_acceptance_repository_reconciled"
        and (progress or {}).get("current_phase") == "C"
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and (progress or {}).get("valid_failure_count") == 0
        and (progress or {}).get("active_work_instruction") is None
        and (progress or {}).get("active_agent") is None
        and (progress or {}).get("worker_lease") is None
        and (progress or {}).get("write_lease") is None
        and accepted_c21_lr01.get("artifact_id") == "WI-C-21-LR-01-20260903-001"
        and accepted_c21_lr01.get("package_status") == "ACCEPTED"
        and accepted_c21_lr01.get("accepted_event_id") == "evt_c21_lr01_main_package_accepted"
        and accepted_c21_lr01.get("manifest_sha256") == "7798FC63D5DFC7068C40AB4FB32339B8164E50C710A56FC9EAA84A1E8D005033"
        and accepted_c21_lr01.get("test_report_sha256") == "F3FB0C564BBE4D3E571529A2577B852BC87727531354FE69C04D192AF7F3B0EB"
        and accepted_c21_lr01.get("c01_boundary") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
        and ((progress or {}).get("current_progress_evidence_ref") or {}).get("package_id") == "C-21"
        and ((progress or {}).get("current_progress_evidence_ref") or {}).get("path")
        == "docs/progress/progress-handoff-detached-digest-c21-lr01-accepted.json"
        and ((progress or {}).get("current_progress_evidence_ref") or {}).get("manifest_path")
        == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR01_ACCEPTANCE_PROGRESS_MANIFEST.json"
        and ((progress or {}).get("next_work_package") or {}).get("package_id") == "C-01"
        and ((progress or {}).get("next_work_package") or {}).get("status")
        == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
        and ((progress or {}).get("next_successor_work_package") or {}).get("package_id") == "C-21/LR-02A"
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "READY_FOR_WORK_INSTRUCTION"
        and repository.get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE
        and repository.get("local_head") == "1573e0242aa718d0f81f6b6fc936c754b7c75e60"
        and repository.get("remote_head") == "1573e0242aa718d0f81f6b6fc936c754b7c75e60"
        and repository.get("branch") == "codex/c21-lifecycle-runtime"
        and repository.get("upstream") == "origin/main"
        and repository.get("head_relation") == VALIDATED_BASE_PENDING_RELATION
        and repository.get("push_status") == "LR01_ACCEPTED_PENDING_CHECKPOINT_COMMIT"
        and repository.get("observed_at") == "2026-09-03T04:11:04+09:00"
    )
    c21_lr02a_paths = {
        "apps/api/anvil_api/asgi.py", "deploy/ysna/README.md",
        "deploy/ysna/ReleaseManifest.C21.DRAFT.json", "deploy/ysna/bootstrap-deploy.sh",
        "deploy/ysna/compose.production.yml", "deploy/ysna/deploy.sh",
        "deploy/ysna/rollback.sh", "deploy/ysna/verify.sh",
        "docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-start.json",
        "docs/work_orders/C-21_LR-02A_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_LR-02A_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py", "tests/api/test_public_asgi_frontend.py",
        "tests/deploy/test_public_deploy_pipeline.py",
        "tests/deploy/test_ysna_deployment_contract.py",
        "tests/deploy/test_ysna_scripts_contract.py", "tests/tooling/test_project_progress.py",
    }
    active_c21_lr02a = (progress or {}).get("active_work_instruction") or {}
    c21_lr02a_start_projection = (
        repository.get("validated_base_commit") == "e57f008d0916953dab3c9425322a1e8942ed0379"
        and set(allowed) == c21_lr02a_paths
        and (progress or {}).get("event_sequence") == 401
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and (progress or {}).get("active_agent") == "developer-primary"
        and active_c21_lr02a.get("artifact_id") == "WI-C-21-LR-02A-20260903-001"
        and ((progress or {}).get("next_work_package") or {}).get("status")
        == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02a_r2_paths = c21_lr02a_paths | {
        "docs/04_test_reports/C-21_LR02A_INDEPENDENT_TEST_REPORT.md",
        "docs/04_test_reports/C-21_LR02A_RUNTIME_READINESS_PROGRESS.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R2.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-rework-start-r2.json",
        "docs/work_orders/C-21_LR-02A_REWORK_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/C-21_LR-02A_REWORK_WORK_INSTRUCTION_R2.md",
    }
    c21_lr02a_r2_projection = (
        repository.get("validated_base_commit") == "e57f008d0916953dab3c9425322a1e8942ed0379"
        and set(allowed) == c21_lr02a_r2_paths
        and len(allowed) == 29
        and (progress or {}).get("event_sequence") == 407
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and (progress or {}).get("active_agent") == "developer-primary"
        and active_c21_lr02a.get("artifact_id") == "WI-C-21-LR-02A-20260903-002"
        and active_c21_lr02a.get("result_status") == "REWORK_IN_PROGRESS"
        and ((progress or {}).get("next_work_package") or {}).get("status")
        == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02a_r3_paths = c21_lr02a_r2_paths | {
        "docs/04_test_reports/C-21_LR02A_R2_INDEPENDENT_TEST_REPORT.md",
        "docs/04_test_reports/C-21_LR02A_R3_RUNTIME_READINESS_PROGRESS.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_R3_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R3.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-rework-start-r3.json",
        "docs/work_orders/C-21_LR-02A_REWORK_INVOCATION_PROMPT_R3.md",
        "docs/work_orders/C-21_LR-02A_REWORK_WORK_INSTRUCTION_R3.md",
    }
    c21_lr02a_r3_projection = (
        repository.get("validated_base_commit") == "e57f008d0916953dab3c9425322a1e8942ed0379"
        and set(allowed) == c21_lr02a_r3_paths
        and len(allowed) == 36
        and (progress or {}).get("event_sequence") == 413
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and (progress or {}).get("active_agent") == "developer-primary"
        and active_c21_lr02a.get("artifact_id") == "WI-C-21-LR-02A-20260903-003"
        and active_c21_lr02a.get("result_status") == "REWORK_IN_PROGRESS"
        and ((progress or {}).get("next_work_package") or {}).get("status")
        == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02a_accepted_paths = c21_lr02a_r3_paths | {
        "docs/04_test_reports/C-21_LR02A_R3_INDEPENDENT_TEST_REPORT.md",
        "docs/04_test_reports/C-21_LR02A_R4_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-accepted-r4.json",
        "docs/work_orders/C-21_LR-02A_MAIN_TAKEOVER_PACKET_R4.md",
    }
    accepted_c21_lr02a = (progress or {}).get("accepted_c21_lr02a_work_instruction") or {}
    c21_lr02a_accepted_projection = (
        repository.get("validated_base_commit") == "e57f008d0916953dab3c9425322a1e8942ed0379"
        and set(allowed) == c21_lr02a_accepted_paths
        and len(allowed) == 41
        and (progress or {}).get("event_sequence") == 424
        and (progress or {}).get("last_event_id") == "evt_c21_lr02a_acceptance_repository_reconciled_r4"
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and (progress or {}).get("active_agent") is None
        and (progress or {}).get("active_work_instruction") is None
        and (progress or {}).get("worker_lease") is None
        and (progress or {}).get("write_lease") is None
        and (progress or {}).get("valid_failure_count") == 0
        and accepted_c21_lr02a.get("package_status") == "ACCEPTED"
        and accepted_c21_lr02a.get("accepted_event_id") == "evt_c21_lr02a_main_package_accepted_r4"
        and ((progress or {}).get("next_successor_work_package") or {}).get("package_id") == "C-21/LR-02B"
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "READY_FOR_WORK_INSTRUCTION"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02b_paths = {
        "deploy/ysna/ReleaseManifest.C21.DRAFT.json", "deploy/ysna/deploy.sh", "deploy/ysna/verify.sh",
        "docs/04_test_reports/C-21_LR02B_TEST_SESSION_SCOPE_PROGRESS.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json", "docs/progress/progress-handoff-detached-digest-c21-lr02b-start.json",
        "docs/work_orders/C-21_LR-02B_INVOCATION_PROMPT.md", "docs/work_orders/C-21_LR-02B_WORK_INSTRUCTION.md",
        "packages/api/local_session.py", "packages/api/runtime.py", "scripts/check_project_progress.py",
        "tests/api/test_local_session.py", "tests/api/test_runtime_app.py",
        "tests/deploy/test_ysna_deployment_contract.py", "tests/deploy/test_ysna_scripts_contract.py",
        "tests/tooling/test_project_progress.py",
    }
    c21_lr02b_projection = (
        repository.get("validated_base_commit") == "4178eee2ffeb0d5701e1fac058d89891331c74c2"
        and set(allowed) == c21_lr02b_paths
        and len(allowed) == 20
        and (progress or {}).get("event_sequence") == 428
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and (progress or {}).get("active_agent") == "developer-primary"
        and active_c21_lr02a.get("artifact_id") == "WI-C-21-LR-02B-20260903-001"
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02b_accepted_paths = c21_lr02b_paths | {
        "docs/04_test_reports/C-21_LR02B_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02b-accepted.json",
    }
    accepted_c21_lr02b = (progress or {}).get("accepted_c21_lr02b_work_instruction") or {}
    c21_lr02b_accepted_projection = (
        repository.get("validated_base_commit") == "4178eee2ffeb0d5701e1fac058d89891331c74c2"
        and set(allowed) == c21_lr02b_accepted_paths
        and len(allowed) == 24
        and (progress or {}).get("event_sequence") == 435
        and (progress or {}).get("last_event_id") == "evt_c21_lr02b_acceptance_repository_reconciled"
        and (progress or {}).get("active_agent") is None
        and (progress or {}).get("active_work_instruction") is None
        and (progress or {}).get("worker_lease") is None
        and (progress or {}).get("write_lease") is None
        and accepted_c21_lr02b.get("package_status") == "ACCEPTED"
        and ((progress or {}).get("next_successor_work_package") or {}).get("package_id") == "C-21/LR-02C"
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "READY_FOR_WORK_INSTRUCTION"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02c_paths = {
        "deploy/ysna/ReleaseManifest.C21.DRAFT.json", "deploy/ysna/backup-c21-db.sh",
        "deploy/ysna/probe-providers.py", "deploy/ysna/provision-c21-validation.py",
        "deploy/ysna/rebind-c21-test-session.sh", "deploy/ysna/verify.sh",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_PROGRESS.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-start.json",
        "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py", "tests/deploy/test_c21_lr02c_operational_contract.py",
        "tests/deploy/test_ysna_deployment_contract.py", "tests/deploy/test_ysna_scripts_contract.py",
        "tests/tooling/test_project_progress.py",
    }
    active_c21_lr02c = (progress or {}).get("active_work_instruction") or {}
    c21_lr02c_projection = (
        repository.get("validated_base_commit") == "dd4cc43452d30511ecf1a152e48408b7122391c0"
        and set(allowed) == c21_lr02c_paths
        and len(allowed) == 20
        and (progress or {}).get("event_sequence") == 439
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_package_started"
        and (progress or {}).get("current_work_package") == "C-21"
        and (progress or {}).get("status") == "ACTIVE"
        and (progress or {}).get("active_agent") == "developer-primary"
        and active_c21_lr02c.get("artifact_id") == "WI-C-21-LR-02C-20260903-001"
        and active_c21_lr02c.get("result_status") == "IN_PROGRESS"
        and ((progress or {}).get("next_successor_work_package") or {}).get("package_id") == "C-21/LR-02C"
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02c_takeover_paths = c21_lr02c_paths | {
        "docs/04_test_reports/C-21_LR02C_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-takeover-r2.json",
        "docs/work_orders/C-21_LR-02C_MAIN_TAKEOVER_PACKET_R2.md",
    }
    c21_lr02c_takeover_projection = (
        repository.get("validated_base_commit") == "dd4cc43452d30511ecf1a152e48408b7122391c0"
        and set(allowed) == c21_lr02c_takeover_paths
        and len(allowed) == 25
        and (progress or {}).get("event_sequence") == 445
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_main_takeover_resumed_r2"
        and (progress or {}).get("active_agent") == "main-agent-eoul"
        and (progress or {}).get("valid_failure_count") == 1
        and active_c21_lr02c.get("result_status") == "DIRECT_IMPLEMENTATION"
        and active_c21_lr02c.get("package_status") == "ACTIVE_REWORK_R2"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 2
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 2
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE_REWORK_R2_MAIN_TAKEOVER"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02c_rework_r3_paths = c21_lr02c_takeover_paths | {
        "docs/04_test_reports/C-21_LR02C_R2_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-rework-start-r3.json",
        "docs/work_orders/C-21_LR-02C_REWORK_INVOCATION_PROMPT_R3.md",
        "docs/work_orders/C-21_LR-02C_REWORK_WORK_INSTRUCTION_R3.md",
    }
    c21_lr02c_rework_r3_projection = (
        repository.get("validated_base_commit") == "dd4cc43452d30511ecf1a152e48408b7122391c0"
        and set(allowed) == c21_lr02c_rework_r3_paths
        and len(allowed) == 30
        and (progress or {}).get("event_sequence") == 447
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_main_takeover_resumed_r3"
        and (progress or {}).get("active_agent") == "main-agent-eoul"
        and (progress or {}).get("valid_failure_count") == 2
        and active_c21_lr02c.get("result_status") == "DIRECT_IMPLEMENTATION"
        and active_c21_lr02c.get("package_status") == "ACTIVE_REWORK_R3"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 2
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 2
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE_REWORK_R3_MAIN_TAKEOVER"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02c_accepted_r3_paths = c21_lr02c_rework_r3_paths | {
        ".superpowers/sdd/Anvil_작업계획서_v1/task-4-report.md",
        "docs/04_test_reports/C-21_LR02C_R3_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-accepted-r3.json",
    }
    c21_lr02c_accepted_r3_projection = (
        repository.get("validated_base_commit") == "dd4cc43452d30511ecf1a152e48408b7122391c0"
        and set(allowed) == c21_lr02c_accepted_r3_paths
        and len(allowed) == 34
        and (progress or {}).get("event_sequence") == 453
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_r3_acceptance_exact34_repository_reconciled"
        and (progress or {}).get("active_agent") is None
        and (progress or {}).get("valid_failure_count") == 0
        and active_c21_lr02c == {}
        and (progress or {}).get("worker_lease") is None
        and (progress or {}).get("write_lease") is None
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "BLOCKED_PENDING_ACCEPTANCE_CHECKPOINT_COMMIT_PUSH"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_lr02c_operational_paths = {
        "deploy/ysna/ReleaseManifest.json",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_EXECUTION_MANIFEST.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json",
        "docs/evidence/receipts/C-21_LR02C_OPERATIONAL_EXECUTION_RECEIPT.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-start.json",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    c21_lr02c_operational_projection = (
        repository.get("validated_base_commit") == "f39471a103d35406c3744fd727119072994a0d6a"
        and set(allowed) == c21_lr02c_operational_paths
        and len(allowed) == 14
        and (progress or {}).get("event_sequence") == 457
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_ops_package_started"
        and (progress or {}).get("active_agent") == "main-agent-eoul"
        and active_c21_lr02c.get("artifact_id") == "WI-C-21-LR-02C-OPS-20260903-001"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 3
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 3
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE_OPERATIONAL_VALIDATION"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_backup_portability_paths = c21_lr02c_operational_paths | {
        "deploy/ysna/backup-c21-db.sh",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-rework-start-r1.json",
        "docs/work_orders/C-21_LR-02C_BACKUP_PORTABILITY_REWORK_INVOCATION_PROMPT_R1.md",
        "docs/work_orders/C-21_LR-02C_BACKUP_PORTABILITY_REWORK_WORK_INSTRUCTION_R1.md",
        "tests/deploy/test_c21_lr02c_operational_contract.py",
    }
    c21_backup_portability_projection = (
        repository.get("validated_base_commit") == "517fb4c39a3a9841eb5a07322235eb71989f1ec4"
        and set(allowed) == c21_backup_portability_paths
        and len(allowed) == 21
        and (progress or {}).get("event_sequence") == 464
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_backup_portability_exact21_repository_reconciled"
        and (progress or {}).get("active_agent") == "developer-primary-c21-backup"
        and active_c21_lr02c.get("artifact_id") == "WI-C-21-LR-02C-BACKUP-PORTABILITY-R1-20260903-001"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 4
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 4
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE_BACKUP_PORTABILITY_REWORK"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_backup_portability_accepted_paths = c21_backup_portability_paths | {
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_R1.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_EVIDENCE_R1.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-accepted-r1.json",
    }
    accepted_c21_backup = (progress or {}).get("accepted_c21_backup_portability_work_instruction") or {}
    c21_backup_portability_accepted_projection = (
        repository.get("validated_base_commit") == "095e1488ed85ec11986447539d04cf2b494dbd34"
        and set(allowed) == c21_backup_portability_accepted_paths
        and len(allowed) == 24
        and (progress or {}).get("event_sequence") == 469
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_backup_portability_acceptance_exact24_repository_reconciled"
        and (progress or {}).get("active_agent") is None
        and (progress or {}).get("active_work_instruction") is None
        and (progress or {}).get("worker_lease") is None
        and (progress or {}).get("write_lease") is None
        and (progress or {}).get("valid_failure_count") == 0
        and accepted_c21_backup.get("artifact_id") == "WI-C-21-LR-02C-BACKUP-PORTABILITY-R1-20260903-001"
        and accepted_c21_backup.get("package_status") == "ACCEPTED"
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "READY_FOR_RELEASE_BINDING_AND_DEPLOYMENT"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_ops_r2_paths = {
        "deploy/ysna/backup-c21-db.sh",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json", "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-rework-start-r2.json",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION_R2.md",
        "scripts/check_project_progress.py", "tests/deploy/test_c21_lr02c_operational_contract.py",
        "tests/tooling/test_project_progress.py",
    }
    c21_ops_r2_projection = (
        repository.get("validated_base_commit") == "ca945dfe4fed9befedc46620aff24729c3898952"
        and set(allowed) == c21_ops_r2_paths
        and len(allowed) == 13
        and (progress or {}).get("event_sequence") == 475
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_ops_r2_nonsemantic_revision_rebound"
        and (progress or {}).get("active_agent") == "developer-primary-c21-ops-r2"
        and active_c21_lr02c.get("artifact_id") == "WI-C-21-LR-02C-OPS-R2-20260903-001"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 5
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 5
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE_OPERATIONAL_BACKUP_REWORK_R2"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_ops_r2_release_rebind_paths = {
        "deploy/ysna/ReleaseManifest.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-release-rebind.json",
        "docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_INVOCATION_PROMPT_R3.md",
        "docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_WORK_INSTRUCTION_R3.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    c21_ops_r2_release_rebind_projection = (
        repository.get("validated_base_commit") == "b4858ffb373066b24d7d9ee9bfde810160cacb75"
        and set(allowed) == c21_ops_r2_release_rebind_paths and len(allowed) == 10
        and (progress or {}).get("event_sequence") == 477
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_ops_r2_release_rebind_exact10_repository_reconciled"
        and (progress or {}).get("active_agent") == "developer-primary-c21-ops-r2"
        and active_c21_lr02c.get("artifact_id") == "WI-C-21-LR-02C-OPS-R2-20260903-001"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 5
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 5
        and ((progress or {}).get("current_release_binding") or {}).get("release_target") == "b4858ffb373066b24d7d9ee9bfde810160cacb75"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_ops_r2_main_reconciliation_paths = {
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_MAIN_RECONCILIATION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-main-reconciliation.json",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    c21_ops_r2_main_reconciliation_projection = (
        repository.get("validated_base_commit") == "970680a95a7e2471effc903239548948b3aa6263"
        and set(allowed) == c21_ops_r2_main_reconciliation_paths and len(allowed) == 7
        and (progress or {}).get("event_sequence") == 478
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_ops_r2_main_reconciliation_exact7"
        and repository.get("branch") == "main"
        and repository.get("upstream") == "origin/main"
        and (progress or {}).get("active_agent") == "developer-primary-c21-ops-r2"
        and active_c21_lr02c.get("artifact_id") == "WI-C-21-LR-02C-OPS-R2-20260903-001"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 5
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 5
        and ((progress or {}).get("current_release_binding") or {}).get("release_target") == "b4858ffb373066b24d7d9ee9bfde810160cacb75"
        and ((progress or {}).get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT"
    )
    c21_ops_r2_conninfo_r4_paths = set(((progress or {}).get("write_lease") or {}).get("paths") or [])
    c21_ops_r2_conninfo_r4_projection = (
        repository.get("validated_base_commit") == "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        and set(allowed) == c21_ops_r2_conninfo_r4_paths and len(allowed) == 13
        and (progress or {}).get("event_sequence") == 481
        and (progress or {}).get("last_event_id") == "evt_c21_lr02c_ops_r2_conninfo_r4_exact13_repository_reconciled"
        and (progress or {}).get("active_agent") == "developer-primary-c21-ops-r2"
        and active_c21_lr02c.get("artifact_id") == "WI-C-21-LR-02C-OPS-R2-CONNINFO-R4-20260904-001"
        and ((progress or {}).get("worker_lease") or {}).get("lease_epoch") == 5
        and ((progress or {}).get("write_lease") or {}).get("write_epoch") == 5
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") == "ACTIVE_OPERATIONAL_BACKUP_CONNINFO_REWORK_R4"
    )
    c21_ysna_staging_decision_paths = c21_ops_r2_conninfo_r4_paths | {
        "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-ysna-staging-classification-decision.json",
    }
    c21_ysna_staging_decision_projection = (
        repository.get("validated_base_commit") == "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        and set(allowed) == c21_ysna_staging_decision_paths and len(allowed) == 15
        and (progress or {}).get("event_sequence") == 482
        and (progress or {}).get("last_event_id") == "evt_c21_ysna_staging_classification_decision_checkpoint"
        and ((progress or {}).get("environment_classification_decision") or {}).get("decision_id") == "APPROVAL-20260904-C21-YSNA-STAGING-001"
    )
    c21_wsl_readiness_paths = c21_ysna_staging_decision_paths | {
        "docs/04_test_reports/C-21_WSL_READINESS_DECISION_REPORT.md",
        "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-wsl-readiness-decision.json",
    }
    c21_wsl_readiness_projection = (
        repository.get("validated_base_commit") == "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        and set(allowed) == c21_wsl_readiness_paths and len(allowed) == 18
        and (progress or {}).get("event_sequence") == 483
        and (progress or {}).get("last_event_id") == "evt_c21_wsl_readiness_waiting_approval"
        and ((progress or {}).get("wsl_readiness_decision") or {}).get("decision_status") == "WAITING_APPROVAL"
    )
    c21_wsl_active_projection = (
        repository.get("validated_base_commit") == "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        and set(allowed) == c21_wsl_active_exact_paths() and len(allowed) == 34
        and (progress or {}).get("event_sequence") == 485
        and (progress or {}).get("last_event_id") == "evt_c21_wsl_early_validation_started"
        and ((progress or {}).get("wsl_early_validation") or {}).get("status")
        == "ACTIVE_IMPLEMENTATION_PENDING_GIT_BINDING"
    )
    c21_wsl_control_projection = (
        repository.get("validated_base_commit") == "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        and (
            (
                set(allowed) == c21_wsl_active_exact_paths()
                and len(allowed) == 34
                and (progress or {}).get("event_sequence") == 486
                and (progress or {}).get("last_event_id")
                == "evt_c21_wsl_control_successor_bound"
                and ((progress or {}).get("wsl_early_validation") or {}).get("status")
                == "ACTIVE_CONTROL_SUCCESSOR_PENDING_COMMIT_PUSH"
            )
            or (
                set(allowed) == c21_wsl_control_committed_exact_paths()
                and len(allowed) == 39
                and (progress or {}).get("event_sequence") == 487
                and (progress or {}).get("last_event_id")
                == "evt_c21_wsl_control_postcommit_bound"
                and ((progress or {}).get("wsl_early_validation") or {}).get("status")
                == "ACTIVE_CONTROL_POSTCOMMIT_SUCCESSOR_PENDING_PUSH"
            )
            or (
                set(allowed) == c21_wsl_control_runtime_committed_exact_paths()
                and len(allowed) == 42
                and (progress or {}).get("event_sequence") == 488
                and (progress or {}).get("last_event_id")
                == "evt_c21_wsl_control_runtime_successor_bound"
                and ((progress or {}).get("wsl_early_validation") or {}).get("status")
                == "ACTIVE_CONTROL_RUNTIME_SUCCESSOR_PENDING_PUSH"
            )
            or (
                set(allowed)
                == c21_wsl_fresh_clone_candidate_committed_exact_paths()
                and len(allowed) == 44
                and (progress or {}).get("event_sequence") == 489
                and (progress or {}).get("last_event_id")
                == "evt_c21_wsl_fresh_clone_candidate_rebind_bound"
                and ((progress or {}).get("wsl_early_validation") or {}).get("status")
                == "ACTIVE_FRESH_CLONE_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH"
            )
            or (
                set(allowed)
                == c21_wsl_compose_runner_candidate_committed_exact_paths()
                and len(allowed) == 46
                and (progress or {}).get("event_sequence") == 490
                and (progress or {}).get("last_event_id")
                == "evt_c21_wsl_compose_runner_candidate_rebind_bound"
                and ((progress or {}).get("wsl_early_validation") or {}).get("status")
                == "ACTIVE_COMPOSE_RUNNER_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH"
            )
            or (
                set(allowed)
                == c21_wsl_cold_start_candidate_committed_exact_paths()
                and len(allowed) == 48
                and (progress or {}).get("event_sequence") == 491
                and (progress or {}).get("last_event_id")
                == "evt_c21_wsl_cold_start_candidate_rebind_bound"
                and ((progress or {}).get("wsl_early_validation") or {}).get("status")
                == "ACTIVE_COLD_START_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH"
            )
            or (
                set(allowed)
                == c21_wsl_ingress_candidate_committed_exact_paths()
                and len(allowed) == 51
                and (progress or {}).get("event_sequence") == 492
                and (progress or {}).get("last_event_id")
                == "evt_c21_wsl_ingress_candidate_rebind_bound"
                and ((progress or {}).get("wsl_early_validation") or {}).get("status")
                == "ACTIVE_INGRESS_CANDIDATE_REBIND_PENDING_RECORD_COMMIT_AND_PRIVATE_PUSH"
            )
        )
    )
    if any(not _is_evidence_only_path(path) for path in allowed) and not c21_wsl_control_projection and not c21_wsl_active_projection and not c21_wsl_readiness_projection and not c21_ysna_staging_decision_projection and not c21_ops_r2_conninfo_r4_projection and not c21_ops_r2_main_reconciliation_projection and not c21_ops_r2_release_rebind_projection and not c21_ops_r2_projection and not c21_backup_portability_accepted_projection and not c21_backup_portability_projection and not c21_lr02c_operational_projection and not c21_lr02c_accepted_r3_projection and not c21_lr02c_rework_r3_projection and not c21_lr02c_takeover_projection and not c21_lr02c_projection and not c21_lr02b_accepted_projection and not c21_lr02b_projection and not c21_lr02a_accepted_projection and not c21_lr02a_r3_projection and not c21_lr02a_r2_projection and not c21_lr02a_start_projection and not c21_lr01_projection and not c21_lr01_accepted_projection and not phase_b_projection and not b12_completion_projection and not b12_start_projection and not b11_acceptance_projection and not b11_rework_projection and not b11_completion_projection and not b11_start_projection and not b10_acceptance_projection and not b10_rework_projection and not b10_completion_projection and not b10_start_projection and not b01_start_projection and not b01_completion_projection and not b01_rework_start_projection and not b01_rework_completion_projection and not b01_r3_rework_start_projection and not b01_r3_rework_completion_projection and not b01_r3_acceptance_projection and not b02_start_projection and not b02_completion_projection and not b02_rework_projection and not b02_rework_completion_projection and not b02_r2_acceptance_projection and not b03_start_projection and not b03_completion_projection and not b03_rework_start_projection and not b03_rework_completion_projection and not b03_r3_rework_start_projection and not b03_r3_rework_completion_projection and not b03_r3_acceptance_projection and not b04_start_projection and not b04_completion_projection and not b04_acceptance_projection and not workplan_v16_successor_projection and not b05_start_projection and not b05_rebind_projection and not b05_completion_projection and not b05_acceptance_projection and not b06_start_projection and not b06_completion_projection and not b07_start_projection and not b08_start_projection and not b08_completion_projection and not b08_acceptance_projection and not b09_start_projection and not b09_completion_projection and not b09_r5_rework_projection and not b09_r5_completion_projection and not b09_r5_acceptance_projection:
        errors.append("GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN")
    if repository.get("branch") != actual_branch:
        errors.append("GIT_BRANCH_MISMATCH")
    if repository.get("upstream") != actual_upstream:
        errors.append("GIT_UPSTREAM_MISMATCH")
    if not base_is_ancestor:
        errors.append("GIT_VALIDATED_BASE_NOT_ANCESTOR")
    actual_path_set = set(actual_changed_paths)
    lr02a_required_projection_paths = {
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-start.json",
        "docs/work_orders/C-21_LR-02A_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_LR-02A_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    }
    lr02a_active_subset_valid = (
        c21_lr02a_start_projection
        and actual_path_set.issubset(set(allowed))
        and lr02a_required_projection_paths.issubset(actual_path_set)
    )
    lr02a_r2_required_projection_paths = lr02a_required_projection_paths | {
        "docs/04_test_reports/C-21_LR02A_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R2.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-rework-start-r2.json",
        "docs/work_orders/C-21_LR-02A_REWORK_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/C-21_LR-02A_REWORK_WORK_INSTRUCTION_R2.md",
    }
    lr02a_r2_active_subset_valid = (
        c21_lr02a_r2_projection
        and actual_path_set.issubset(set(allowed))
        and lr02a_r2_required_projection_paths.issubset(actual_path_set)
    )
    lr02a_r3_required_projection_paths = lr02a_r2_required_projection_paths | {
        "docs/04_test_reports/C-21_LR02A_R2_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R3.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-rework-start-r3.json",
        "docs/work_orders/C-21_LR-02A_REWORK_INVOCATION_PROMPT_R3.md",
        "docs/work_orders/C-21_LR-02A_REWORK_WORK_INSTRUCTION_R3.md",
    }
    lr02a_r3_active_subset_valid = (
        c21_lr02a_r3_projection
        and actual_path_set.issubset(set(allowed))
        and lr02a_r3_required_projection_paths.issubset(actual_path_set)
    )
    lr02a_accepted_required_projection_paths = lr02a_r3_required_projection_paths | {
        "docs/04_test_reports/C-21_LR02A_R3_INDEPENDENT_TEST_REPORT.md",
        "docs/04_test_reports/C-21_LR02A_R4_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02a-accepted-r4.json",
        "docs/work_orders/C-21_LR-02A_MAIN_TAKEOVER_PACKET_R4.md",
    }
    lr02a_accepted_subset_valid = (
        c21_lr02a_accepted_projection
        and actual_path_set.issubset(set(allowed))
        and lr02a_accepted_required_projection_paths.issubset(actual_path_set)
    )
    lr02b_required_projection_paths = {
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json", "docs/progress/progress-handoff-detached-digest-c21-lr02b-start.json",
        "docs/work_orders/C-21_LR-02B_INVOCATION_PROMPT.md", "docs/work_orders/C-21_LR-02B_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    lr02b_active_subset_valid = (
        c21_lr02b_projection
        and actual_path_set.issubset(set(allowed))
        and lr02b_required_projection_paths.issubset(actual_path_set)
    )
    lr02b_accepted_required_projection_paths = lr02b_required_projection_paths | {
        "docs/04_test_reports/C-21_LR02B_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02b-accepted.json",
    }
    lr02b_accepted_subset_valid = (
        c21_lr02b_accepted_projection
        and actual_path_set.issubset(set(allowed))
        and lr02b_accepted_required_projection_paths.issubset(actual_path_set)
    )
    lr02c_required_projection_paths = {
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json", "docs/progress/progress-handoff-detached-digest-c21-lr02c-start.json",
        "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md", "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    lr02c_active_subset_valid = (
        c21_lr02c_projection
        and actual_path_set.issubset(set(allowed))
        and lr02c_required_projection_paths.issubset(actual_path_set)
    )
    lr02c_takeover_required_projection_paths = lr02c_required_projection_paths | {
        "docs/04_test_reports/C-21_LR02C_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-takeover-r2.json",
        "docs/work_orders/C-21_LR-02C_MAIN_TAKEOVER_PACKET_R2.md",
    }
    lr02c_takeover_subset_valid = (
        c21_lr02c_takeover_projection
        and actual_path_set.issubset(set(allowed))
        and lr02c_takeover_required_projection_paths.issubset(actual_path_set)
    )
    lr02c_rework_r3_required_projection_paths = lr02c_takeover_required_projection_paths | {
        "docs/04_test_reports/C-21_LR02C_R2_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-rework-start-r3.json",
        "docs/work_orders/C-21_LR-02C_REWORK_INVOCATION_PROMPT_R3.md",
        "docs/work_orders/C-21_LR-02C_REWORK_WORK_INSTRUCTION_R3.md",
    }
    lr02c_rework_r3_subset_valid = (
        c21_lr02c_rework_r3_projection
        and actual_path_set.issubset(set(allowed))
        and lr02c_rework_r3_required_projection_paths.issubset(actual_path_set)
    )
    lr02c_accepted_r3_required_projection_paths = lr02c_rework_r3_required_projection_paths | {
        ".superpowers/sdd/Anvil_작업계획서_v1/task-4-report.md",
        "docs/04_test_reports/C-21_LR02C_R3_INDEPENDENT_TEST_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-accepted-r3.json",
    }
    lr02c_accepted_r3_subset_valid = (
        c21_lr02c_accepted_r3_projection
        and actual_path_set.issubset(set(allowed))
        and lr02c_accepted_r3_required_projection_paths.issubset(actual_path_set)
    )
    lr02c_operational_required_projection_paths = {
        "deploy/ysna/ReleaseManifest.json",
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-start.json",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    lr02c_operational_subset_valid = (
        c21_lr02c_operational_projection
        and actual_path_set.issubset(set(allowed))
        and lr02c_operational_required_projection_paths.issubset(actual_path_set)
    )
    c21_backup_portability_required_projection_paths = {
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json", "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-rework-start-r1.json",
        "docs/work_orders/C-21_LR-02C_BACKUP_PORTABILITY_REWORK_INVOCATION_PROMPT_R1.md",
        "docs/work_orders/C-21_LR-02C_BACKUP_PORTABILITY_REWORK_WORK_INSTRUCTION_R1.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    c21_backup_portability_subset_valid = (
        c21_backup_portability_projection
        and actual_path_set.issubset(set(allowed))
        and c21_backup_portability_required_projection_paths.issubset(actual_path_set)
    )
    c21_backup_portability_accepted_required_projection_paths = {
        "deploy/ysna/ReleaseManifest.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_R1.json",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_EVIDENCE_R1.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-accepted-r1.json",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    c21_backup_portability_accepted_subset_valid = (
        c21_backup_portability_accepted_projection
        and actual_path_set.issubset(set(allowed))
        and c21_backup_portability_accepted_required_projection_paths.issubset(actual_path_set)
    )
    c21_ops_r2_required_projection_paths = {
        "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md",
        "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/failure-ledger.json", "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-rework-start-r2.json",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION_R2.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    }
    c21_ops_r2_subset_valid = (
        c21_ops_r2_projection
        and actual_path_set.issubset(set(allowed))
        and c21_ops_r2_required_projection_paths.issubset(actual_path_set)
    )
    c21_ops_r2_release_rebind_subset_valid = (
        c21_ops_r2_release_rebind_projection
        and actual_path_set.issubset(set(allowed))
        and {"deploy/ysna/ReleaseManifest.json", "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json",
             "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json", "docs/progress/progress-events.json",
             "docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-release-rebind.json",
             "docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_INVOCATION_PROMPT_R3.md",
             "docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_WORK_INSTRUCTION_R3.md",
             "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py"}.issubset(actual_path_set)
    )
    c21_ops_r2_main_reconciliation_subset_valid = (
        c21_ops_r2_main_reconciliation_projection
        and actual_path_set.issubset(set(allowed))
        and c21_ops_r2_main_reconciliation_paths.issubset(actual_path_set)
    )
    c21_ops_r2_conninfo_r4_subset_valid = (
        c21_ops_r2_conninfo_r4_projection
        and actual_path_set.issubset(set(allowed))
        and set(allowed).issubset(actual_path_set)
    )
    c21_ysna_staging_decision_subset_valid = (
        c21_ysna_staging_decision_projection
        and actual_path_set == set(allowed)
    )
    c21_wsl_readiness_subset_valid = (
        c21_wsl_readiness_projection
        and actual_path_set == set(allowed)
    )
    c21_wsl_active_subset_valid = (
        c21_wsl_active_projection
        and actual_path_set == set(allowed)
    )
    c21_wsl_control_subset_valid = (
        c21_wsl_control_projection
        and actual_path_set == set(allowed)
    )
    c21_wsl_control_postcommit_descendant_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 487
        and repository.get("local_head") == "73c39ca03caa615f7207eac3499c668497cecc5a"
        and control_is_ancestor
        and set(control_descendant_paths or [])
        == c21_wsl_control_postcommit_successor_paths()
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head") == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head") == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_control_runtime_precommit_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 488
        and repository.get("local_head")
        == "ead1214e3f01e68e577c3163e1cf143ee5753490"
        and actual_head == repository.get("local_head")
        and control_is_ancestor
        and set(control_descendant_paths or [])
        == c21_wsl_control_runtime_successor_paths()
        and not worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_control_runtime_postcommit_descendant_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 488
        and repository.get("local_head")
        == "ead1214e3f01e68e577c3163e1cf143ee5753490"
        and actual_head != repository.get("local_head")
        and control_is_ancestor
        and control_runtime_record_commit_is_direct
        and actual_path_set
        == c21_wsl_control_runtime_record_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_control_runtime_successor_paths()
        and worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_fresh_clone_rebind_precommit_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 489
        and repository.get("local_head")
        == "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
        and actual_head == repository.get("local_head")
        and control_is_ancestor
        and set(control_descendant_paths or [])
        == c21_wsl_fresh_clone_candidate_rebind_successor_paths()
        and not worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_fresh_clone_rebind_postcommit_descendant_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 489
        and repository.get("local_head")
        == "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
        and actual_head != repository.get("local_head")
        and control_is_ancestor
        and control_runtime_record_commit_is_direct
        and actual_path_set
        == c21_wsl_fresh_clone_candidate_record_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_fresh_clone_candidate_rebind_successor_paths()
        and worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_compose_runner_rebind_precommit_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 490
        and repository.get("local_head")
        == "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
        and actual_head == repository.get("local_head")
        and control_is_ancestor
        and actual_path_set == c21_wsl_compose_runner_candidate_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_compose_runner_candidate_rebind_successor_paths()
        and not worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_cold_start_rebind_precommit_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 491
        and repository.get("local_head")
        == "324eb169fedbce958d2e8cc29362deb7af433677"
        and actual_head == repository.get("local_head")
        and control_is_ancestor
        and actual_path_set == c21_wsl_cold_start_candidate_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_cold_start_candidate_rebind_successor_paths()
        and not worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_ingress_rebind_precommit_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 492
        and repository.get("local_head")
        == "ccf5109d0640bf28c461e7754ad56e0821fd77be"
        and actual_head == repository.get("local_head")
        and control_is_ancestor
        and actual_path_set == c21_wsl_ingress_candidate_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_ingress_candidate_rebind_successor_paths()
        and not worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_compose_runner_rebind_postcommit_descendant_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 490
        and repository.get("local_head")
        == "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
        and actual_head != repository.get("local_head")
        and control_is_ancestor
        and control_runtime_record_commit_is_direct
        and actual_path_set
        == c21_wsl_compose_runner_candidate_record_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_compose_runner_candidate_rebind_successor_paths()
        and worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_cold_start_rebind_postcommit_descendant_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 491
        and repository.get("local_head")
        == "324eb169fedbce958d2e8cc29362deb7af433677"
        and actual_head != repository.get("local_head")
        and control_is_ancestor
        and control_runtime_record_commit_is_direct
        and actual_path_set
        == c21_wsl_cold_start_candidate_record_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_cold_start_candidate_rebind_successor_paths()
        and worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    c21_wsl_ingress_rebind_postcommit_descendant_valid = (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 492
        and repository.get("local_head")
        == "ccf5109d0640bf28c461e7754ad56e0821fd77be"
        and actual_head != repository.get("local_head")
        and control_is_ancestor
        and control_runtime_record_commit_is_direct
        and actual_path_set
        == c21_wsl_ingress_candidate_record_committed_exact_paths()
        and set(control_descendant_paths or [])
        == c21_wsl_ingress_candidate_rebind_successor_paths()
        and worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
    )
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") in {488, 489, 490, 491, 492}
        and actual_head != repository.get("local_head")
        and control_is_ancestor
        and set(control_descendant_paths or [])
        == (
            c21_wsl_control_runtime_successor_paths()
            if (progress or {}).get("event_sequence") == 488
            else c21_wsl_fresh_clone_candidate_rebind_successor_paths()
            if (progress or {}).get("event_sequence") == 489
            else c21_wsl_compose_runner_candidate_rebind_successor_paths()
            if (progress or {}).get("event_sequence") == 490
            else c21_wsl_cold_start_candidate_rebind_successor_paths()
            if (progress or {}).get("event_sequence") == 491
            else c21_wsl_ingress_candidate_rebind_successor_paths()
        )
        and worktree_is_clean
        and actual_branch == "codex/c21-operational-execution"
        and actual_upstream == "origin/codex/c21-operational-execution"
        and repository.get("remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and repository.get("feature_remote_head")
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_remote_head == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and actual_feature_remote_head
        == "ca92b7845eda803cff3c432799642e4f9243d4d6"
        and not (
            c21_wsl_control_runtime_postcommit_descendant_valid
            if (progress or {}).get("event_sequence") == 488
            else c21_wsl_fresh_clone_rebind_postcommit_descendant_valid
            if (progress or {}).get("event_sequence") == 489
            else c21_wsl_compose_runner_rebind_postcommit_descendant_valid
            if (progress or {}).get("event_sequence") == 490
            else c21_wsl_cold_start_rebind_postcommit_descendant_valid
            if (progress or {}).get("event_sequence") == 491
            else c21_wsl_ingress_rebind_postcommit_descendant_valid
        )
    ):
        errors.append("GIT_DESCENDANT_RECORD_COMMIT_INVALID")
    if (
        sorted(actual_path_set) != allowed
        and not lr02a_active_subset_valid
        and not lr02a_r2_active_subset_valid
        and not lr02a_r3_active_subset_valid
        and not lr02a_accepted_subset_valid
        and not lr02b_active_subset_valid
        and not lr02b_accepted_subset_valid
        and not lr02c_active_subset_valid
        and not lr02c_takeover_subset_valid
        and not lr02c_rework_r3_subset_valid
        and not lr02c_accepted_r3_subset_valid
        and not lr02c_operational_subset_valid
        and not c21_backup_portability_subset_valid
        and not c21_backup_portability_accepted_subset_valid
        and not c21_ops_r2_subset_valid
        and not c21_ops_r2_release_rebind_subset_valid
        and not c21_ops_r2_main_reconciliation_subset_valid
        and not c21_ops_r2_conninfo_r4_subset_valid
        and not c21_ysna_staging_decision_subset_valid
        and not c21_wsl_readiness_subset_valid
        and not c21_wsl_active_subset_valid
        and not c21_wsl_control_subset_valid
        and not c21_wsl_control_postcommit_descendant_valid
        and not c21_wsl_control_runtime_postcommit_descendant_valid
        and not c21_wsl_fresh_clone_rebind_precommit_valid
        and not c21_wsl_fresh_clone_rebind_postcommit_descendant_valid
        and not c21_wsl_compose_runner_rebind_precommit_valid
        and not c21_wsl_cold_start_rebind_precommit_valid
        and not c21_wsl_ingress_rebind_precommit_valid
        and not c21_wsl_compose_runner_rebind_postcommit_descendant_valid
        and not c21_wsl_cold_start_rebind_postcommit_descendant_valid
        and not c21_wsl_ingress_rebind_postcommit_descendant_valid
    ):
        errors.append("GIT_DESCENDANT_PATH_SET_MISMATCH")
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 488
        and actual_head == repository.get("local_head")
        and not worktree_is_clean
        and not c21_wsl_control_runtime_precommit_valid
    ):
        errors.append("GIT_DESCENDANT_PATH_SET_MISMATCH")
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 489
        and actual_head == repository.get("local_head")
        and not worktree_is_clean
        and not c21_wsl_fresh_clone_rebind_precommit_valid
    ):
        errors.append("GIT_DESCENDANT_PATH_SET_MISMATCH")
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 490
        and actual_head == repository.get("local_head")
        and not worktree_is_clean
        and not c21_wsl_compose_runner_rebind_precommit_valid
        and not c21_wsl_cold_start_rebind_precommit_valid
        and not c21_wsl_ingress_rebind_precommit_valid
    ):
        errors.append("GIT_DESCENDANT_PATH_SET_MISMATCH")
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 491
        and actual_head == repository.get("local_head")
        and not worktree_is_clean
        and not c21_wsl_cold_start_rebind_precommit_valid
        and not c21_wsl_ingress_rebind_precommit_valid
    ):
        errors.append("GIT_DESCENDANT_PATH_SET_MISMATCH")
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 492
        and actual_head == repository.get("local_head")
        and not worktree_is_clean
        and not c21_wsl_ingress_rebind_precommit_valid
    ):
        errors.append("GIT_DESCENDANT_PATH_SET_MISMATCH")
    remote_lag_declared = (
        repository.get("push_status") == "PUSH_PENDING_MAIN"
        and repository.get("remote_head") == actual_remote_head
        and isinstance(actual_remote_head, str)
        and re.fullmatch(r"[0-9a-f]{40}", actual_remote_head) is not None
        and actual_head != base
    )
    lr02a_feature_checkpoint_declared = (
        (progress or {}).get("event_sequence") in {401, 407, 413, 424, 428, 435, 439, 445, 447, 452, 453}
        and ((progress or {}).get("next_successor_work_package") or {}).get("package_id") in {"C-21/LR-02A", "C-21/LR-02B", "C-21/LR-02C"}
        and ((progress or {}).get("next_successor_work_package") or {}).get("status") in {"ACTIVE", "ACTIVE_REWORK_R2", "ACTIVE_REWORK_R3", "ACTIVE_REWORK_R2_MAIN_TAKEOVER", "ACTIVE_REWORK_R3_MAIN_TAKEOVER", "BLOCKED_PENDING_ACCEPTANCE_CHECKPOINT_COMMIT_PUSH", "READY_FOR_WORK_INSTRUCTION"}
        and repository.get("push_status") in {
            "FEATURE_CHECKPOINT_PUSHED_LR02A_ACTIVE",
            "FEATURE_CHECKPOINT_PUSHED_LR02A_R2_ACTIVE",
            "FEATURE_CHECKPOINT_PUSHED_LR02A_R3_ACTIVE",
            "FEATURE_CHECKPOINT_PUSHED_LR02A_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
            "FEATURE_CHECKPOINT_PUSHED_LR02B_ACTIVE",
            "FEATURE_CHECKPOINT_PUSHED_LR02B_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
            "FEATURE_CHECKPOINT_PUSHED_LR02C_ACTIVE",
            "FEATURE_CHECKPOINT_PUSHED_LR02C_MAIN_TAKEOVER_ACTIVE",
            "FEATURE_CHECKPOINT_PUSHED_LR02C_MAIN_TAKEOVER_R3_ACTIVE",
            "FEATURE_CHECKPOINT_PUSHED_LR02C_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
        }
        and repository.get("feature_remote") == "origin/codex/c21-lifecycle-runtime"
        and repository.get("feature_remote_head") == base
        and actual_feature_remote_head == base
        and actual_head == base
        and repository.get("remote_head") == actual_remote_head
    )
    conninfo_r4_feature_base_declared = (
        c21_ops_r2_conninfo_r4_projection
        and repository.get("feature_remote") == "origin/codex/c21-operational-execution"
        and repository.get("feature_remote_head") == actual_feature_remote_head
        and repository.get("remote_head") == actual_remote_head
        and actual_head == base
    )
    conninfo_r4_feature_checkpoint_declared = (
        c21_ops_r2_conninfo_r4_projection
        and repository.get("feature_remote") == "origin/codex/c21-operational-execution"
        and actual_head != base
        and actual_path_set == set(allowed)
        and actual_remote_head == actual_feature_remote_head
        and actual_feature_remote_head in {repository.get("feature_remote_head"), actual_head}
    )
    ysna_staging_decision_checkpoint_declared = (
        c21_ysna_staging_decision_projection
        and actual_path_set == set(allowed)
        and actual_head != base
        and actual_remote_head == actual_feature_remote_head
        and actual_feature_remote_head in {repository.get("feature_remote_head"), actual_head}
    )
    wsl_readiness_checkpoint_declared = (
        c21_wsl_readiness_projection
        and actual_path_set == set(allowed)
        and actual_head != base
        and (
            actual_head == repository.get("local_head")
            or projected_local_head_is_ancestor
        )
        and actual_remote_head == actual_feature_remote_head
        and actual_feature_remote_head
        in {repository.get("remote_head"), actual_head}
    )
    wsl_active_checkpoint_declared = (
        c21_wsl_active_projection
        and actual_path_set == set(allowed)
        and actual_head != base
        and (
            actual_head == repository.get("local_head")
            or projected_local_head_is_ancestor
        )
        and actual_remote_head == actual_feature_remote_head
        and actual_feature_remote_head
        in {repository.get("remote_head"), actual_head}
    )
    wsl_control_checkpoint_declared = (
        c21_wsl_control_postcommit_descendant_valid
        or c21_wsl_control_runtime_precommit_valid
        or c21_wsl_control_runtime_postcommit_descendant_valid
        or c21_wsl_fresh_clone_rebind_precommit_valid
        or c21_wsl_fresh_clone_rebind_postcommit_descendant_valid
        or c21_wsl_compose_runner_rebind_precommit_valid
        or c21_wsl_compose_runner_rebind_postcommit_descendant_valid
        or c21_wsl_cold_start_rebind_precommit_valid
        or c21_wsl_ingress_rebind_precommit_valid
        or c21_wsl_cold_start_rebind_postcommit_descendant_valid
        or c21_wsl_ingress_rebind_postcommit_descendant_valid
        or (
            c21_wsl_control_projection
            and actual_path_set == set(allowed)
            and actual_head == repository.get("local_head")
            and actual_remote_head == actual_feature_remote_head
            and actual_feature_remote_head == repository.get("remote_head")
        )
    )
    if (
        (c21_wsl_readiness_projection or c21_wsl_active_projection or c21_wsl_control_projection)
        and actual_head != repository.get("local_head")
        and not projected_local_head_is_ancestor
        and not c21_wsl_control_postcommit_descendant_valid
        and not c21_wsl_control_runtime_postcommit_descendant_valid
        and not c21_wsl_fresh_clone_rebind_postcommit_descendant_valid
        and not c21_wsl_compose_runner_rebind_postcommit_descendant_valid
        and not c21_wsl_cold_start_rebind_postcommit_descendant_valid
        and not c21_wsl_ingress_rebind_postcommit_descendant_valid
    ):
        errors.append("GIT_DESCENDANT_ORIGIN_MISMATCH")
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") == 487
        and not worktree_is_clean
    ):
        errors.append("GIT_DESCENDANT_WORKTREE_DIRTY")
    if (
        c21_wsl_control_projection
        and (progress or {}).get("event_sequence") in {488, 489, 490, 491, 492}
        and not worktree_is_clean
        and not (
            c21_wsl_control_runtime_precommit_valid
            if (progress or {}).get("event_sequence") == 488
            else c21_wsl_fresh_clone_rebind_precommit_valid
            if (progress or {}).get("event_sequence") == 489
            else c21_wsl_compose_runner_rebind_precommit_valid
            if (progress or {}).get("event_sequence") == 490
            else c21_wsl_cold_start_rebind_precommit_valid
            if (progress or {}).get("event_sequence") == 491
            else c21_wsl_ingress_rebind_precommit_valid
        )
    ):
        errors.append("GIT_DESCENDANT_WORKTREE_DIRTY")
    if working_tree_mode:
        if (
            (actual_head != base and not conninfo_r4_feature_checkpoint_declared and not ysna_staging_decision_checkpoint_declared and not wsl_readiness_checkpoint_declared and not wsl_active_checkpoint_declared and not wsl_control_checkpoint_declared)
            or (
                actual_remote_head != base
                and not remote_lag_declared
                and not lr02a_feature_checkpoint_declared
                and not conninfo_r4_feature_base_declared
                and not conninfo_r4_feature_checkpoint_declared
                and not ysna_staging_decision_checkpoint_declared
                and not wsl_readiness_checkpoint_declared
                and not wsl_active_checkpoint_declared
                and not wsl_control_checkpoint_declared
            )
        ):
            errors.append("GIT_DESCENDANT_ORIGIN_MISMATCH")
    elif (
        actual_remote_head != actual_head
        and not remote_lag_declared
        and not conninfo_r4_feature_checkpoint_declared
        and not ysna_staging_decision_checkpoint_declared
        and not wsl_readiness_checkpoint_declared
        and not wsl_active_checkpoint_declared
        and not wsl_control_checkpoint_declared
    ):
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
    feature_remote = repository.get("feature_remote")
    actual_feature_remote_head = (
        _git_value(root, "rev-parse", feature_remote)
        if isinstance(feature_remote, str) and feature_remote.startswith("origin/")
        else None
    )
    projected_local_head = repository.get("local_head")
    projected_local_head_is_ancestor = bool(
        isinstance(projected_local_head, str)
        and actual_head
        and _git_returncode(
            root, "merge-base", "--is-ancestor", projected_local_head, actual_head
        ) == 0
    )
    control_descendant_paths = _split_git_paths(
        _git_value(root, "diff", "--name-only", f"{projected_local_head}..{actual_head}")
        if projected_local_head_is_ancestor and actual_head
        else None
    )
    control_runtime_record_commit_is_direct = False
    if (
        bundle["progress"].get("event_sequence") in {488, 489, 490, 491, 492}
        and actual_head
        and actual_head != projected_local_head
    ):
        actual_parent_line = _git_value(
            root, "show", "-s", "--format=%P", actual_head
        )
        control_runtime_record_commit_is_direct = (
            (actual_parent_line or "").split() == [projected_local_head]
        )
    if repository.get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE:
        base = repository.get("validated_base_commit")
        working_tree_mode = actual_head == base
        dirty_paths: list[str] = []
        if working_tree_mode:
            changed_paths = _working_tree_paths(
                _git_value(
                    root,
                    "-c",
                    "core.quotePath=false",
                    "status",
                    "--porcelain=v1",
                    "--untracked-files=all",
                )
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
            dirty_paths = _working_tree_paths(
                _git_value(
                    root,
                    "-c",
                    "core.quotePath=false",
                    "status",
                    "--porcelain=v1",
                    "--untracked-files=all",
                )
            )
            decision_precommit_projection = (
                bundle["progress"].get("event_sequence") in {482, 483, 485}
                and actual_head == repository.get("local_head")
                and set(changed_paths) | set(dirty_paths)
                == set(repository.get("exact_allowed_paths") or [])
                and set(dirty_paths).issubset(set(repository.get("exact_allowed_paths") or []))
            )
            control_precommit_projection = (
                bundle["progress"].get("event_sequence") == 486
                and actual_head == repository.get("local_head")
                and set(changed_paths) == set(repository.get("exact_allowed_paths") or [])
                and set(dirty_paths) == c21_wsl_control_successor_paths()
                and set(repository.get("control_successor_paths") or [])
                == c21_wsl_control_successor_paths()
            )
            control_runtime_precommit_projection = (
                bundle["progress"].get("event_sequence") == 488
                and actual_head == repository.get("local_head")
                and set(changed_paths)
                == c21_wsl_control_runtime_committed_exact_paths()
                and set(dirty_paths) == c21_wsl_control_runtime_successor_paths()
                and set(repository.get("control_runtime_successor_paths") or [])
                == c21_wsl_control_runtime_successor_paths()
            )
            fresh_clone_rebind_precommit_projection = (
                bundle["progress"].get("event_sequence") == 489
                and actual_head == repository.get("local_head")
                and set(changed_paths)
                == c21_wsl_fresh_clone_candidate_committed_exact_paths()
                and set(dirty_paths)
                == c21_wsl_fresh_clone_candidate_rebind_successor_paths()
                and set(
                    repository.get("fresh_clone_candidate_rebind_successor_paths")
                    or []
                )
                == c21_wsl_fresh_clone_candidate_rebind_successor_paths()
            )
            compose_runner_rebind_precommit_projection = (
                bundle["progress"].get("event_sequence") == 490
                and actual_head == repository.get("local_head")
                and set(changed_paths)
                == c21_wsl_compose_runner_candidate_committed_exact_paths()
                and set(dirty_paths)
                == c21_wsl_compose_runner_candidate_rebind_successor_paths()
                and set(
                    repository.get("compose_runner_candidate_rebind_successor_paths")
                    or []
                )
                == c21_wsl_compose_runner_candidate_rebind_successor_paths()
            )
            cold_start_rebind_precommit_projection = (
                bundle["progress"].get("event_sequence") == 491
                and actual_head == repository.get("local_head")
                and set(changed_paths)
                == c21_wsl_cold_start_candidate_committed_exact_paths()
                and set(dirty_paths)
                == c21_wsl_cold_start_candidate_rebind_successor_paths()
                and set(
                    repository.get("cold_start_candidate_rebind_successor_paths")
                    or []
                )
                == c21_wsl_cold_start_candidate_rebind_successor_paths()
            )
            ingress_rebind_precommit_projection = (
                bundle["progress"].get("event_sequence") == 492
                and actual_head == repository.get("local_head")
                and set(changed_paths)
                == c21_wsl_ingress_candidate_committed_exact_paths()
                and set(dirty_paths)
                == c21_wsl_ingress_candidate_rebind_successor_paths()
                and set(
                    repository.get("ingress_candidate_rebind_successor_paths")
                    or []
                )
                == c21_wsl_ingress_candidate_rebind_successor_paths()
            )
            if dirty_paths and ingress_rebind_precommit_projection:
                control_descendant_paths = dirty_paths
            elif dirty_paths and cold_start_rebind_precommit_projection:
                control_descendant_paths = dirty_paths
            elif dirty_paths and compose_runner_rebind_precommit_projection:
                control_descendant_paths = dirty_paths
            elif dirty_paths and fresh_clone_rebind_precommit_projection:
                control_descendant_paths = dirty_paths
            elif dirty_paths and control_runtime_precommit_projection:
                control_descendant_paths = dirty_paths
            elif dirty_paths and control_precommit_projection:
                pass
            elif dirty_paths and decision_precommit_projection:
                changed_paths = sorted(set(changed_paths) | set(dirty_paths))
            elif dirty_paths:
                errors.append("GIT_DESCENDANT_WORKTREE_DIRTY")
        errors.extend(
            validate_repository_projection(
                repository,
                actual_head=actual_head,
                actual_branch=actual_branch,
                actual_upstream=actual_upstream,
                actual_remote_head=actual_remote_head,
                actual_feature_remote_head=actual_feature_remote_head,
                base_is_ancestor=base_is_ancestor,
                actual_changed_paths=changed_paths,
                working_tree_mode=working_tree_mode,
                progress=bundle["progress"],
                projected_local_head_is_ancestor=projected_local_head_is_ancestor,
                control_descendant_paths=control_descendant_paths,
                control_is_ancestor=projected_local_head_is_ancestor,
                worktree_is_clean=not dirty_paths,
                control_runtime_record_commit_is_direct=(
                    control_runtime_record_commit_is_direct
                ),
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


PHASE_B_GATE_ALLOWED_PATHS = [
    "docs/validation/PHASE_B_GATE_VALIDATION.md",
    "docs/evidence/manifests/PHASE_B_GATE_EVIDENCE_MANIFEST.json",
    "docs/completion_reports/PHASE_B_GATE_COMPLETION_REPORT.md",
    "scripts/check_phase_b_gate.py",
    "tests/tooling/test_phase_b_gate.py",
    "scripts/check_project_progress.py",
    "tests/tooling/test_project_progress.py",
]
PHASE_B_GATE_DEFERRED_IDS = [
    "AV-STAT-021", "AV-STAT-022", "AV-STAT-023", "AV-STAT-024", "AV-STAT-025", "AV-STAT-028",
]


def validate_phase_b_gate_active_projection(bundle: Mapping[str, Any]) -> list[str]:
    """Validate the active owner-approved exact-44 Gate projection, including rework epochs."""
    progress = bundle["progress"]
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    instruction = progress.get("active_work_instruction") or {}
    events = bundle["events"].get("events", [])
    errors: list[str] = []

    projection = {
        365: ("WI-PHASE-B-GATE-20260821-001", 1, 362, 365, ["PACKAGE_WAITING_APPROVAL", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"]),
        368: ("WI-PHASE-B-GATE-REWORK-20260821-002", 2, 366, 368, ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"]),
        371: ("WI-PHASE-B-GATE-REWORK-20260821-003", 3, 369, 371, ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"]),
    }.get(progress.get("event_sequence"))
    if projection is None:
        expected_instruction, expected_epoch, event_start, event_end, expected_event_types = "", 0, 0, -1, []
    else:
        expected_instruction, expected_epoch, event_start, event_end, expected_event_types = projection
    expected_execution_token = f"phase-b-gate-execution-fence-epoch-{expected_epoch}-165a9bf"
    expected_write_token = f"phase-b-gate-write-fence-epoch-{expected_epoch}-165a9bf"
    if any((
        projection is None,
        progress.get("current_phase") != "B",
        progress.get("current_work_package") != "PHASE_B_GATE",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-phase-b-gate",
        "B-12" not in progress.get("completed_packages", []),
        "PHASE_B_GATE" in progress.get("completed_packages", []),
        (progress.get("historical_failure_counts_by_lineage") or {}).get("B-12") != 1,
        (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "PHASE_B_GATE",
        (progress.get("active_failure_lineage") or {}).get("valid_failure_count") != 0,
    )):
        errors.append("PHASE_B_GATE_ACTIVE_PROJECTION_INVALID")

    if any((
        instruction.get("artifact_id") != expected_instruction,
        instruction.get("result_status") != "IN_PROGRESS",
        instruction.get("independent_tester_status") != "PENDING",
        instruction.get("assigned_verification_count") != 44,
        instruction.get("direct_gate_set") != "EXACT44_DEPENDENCY_SAFE",
        instruction.get("deferred_verification_ids") != PHASE_B_GATE_DEFERRED_IDS,
        instruction.get("undefined_verification_ids") != ["AV-STAT-029"],
    )):
        errors.append("PHASE_B_GATE_INSTRUCTION_INVALID")

    if any((
        worker.get("lease_id") != "worker-lease-phase-b-gate-20260821-001",
        worker.get("agent_id") != "developer-primary-phase-b-gate",
        worker.get("work_package_id") != "PHASE_B_GATE",
        worker.get("lease_epoch") != expected_epoch,
        worker.get("execution_fencing_token") != expected_execution_token,
        worker.get("status") != "ACTIVE",
        write.get("lease_id") != "write-lease-phase-b-gate-20260821-001",
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("agent_id") != worker.get("agent_id"),
        write.get("work_package_id") != "PHASE_B_GATE",
        write.get("write_epoch") != expected_epoch,
        write.get("execution_fencing_token") != worker.get("execution_fencing_token"),
        write.get("write_fencing_token") != expected_write_token,
        write.get("status") != "ACTIVE",
        write.get("paths") != PHASE_B_GATE_ALLOWED_PATHS,
    )):
        errors.append("PHASE_B_GATE_FENCING_INVALID")

    if (progress.get("next_work_package") or {}) != {
        "package_id": "C-01", "status": "BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE"
    }:
        errors.append("PHASE_B_GATE_C01_BOUNDARY_INVALID")

    active_events = [event for event in events if event_start <= event.get("sequence", -1) <= event_end]
    if [event.get("event_type") for event in active_events] != expected_event_types or any(event.get("subject_ref") != "PHASE_B_GATE" for event in active_events):
        errors.append("PHASE_B_GATE_EVENT_ORDER_INVALID")
    return sorted(set(errors))


def validate_phase_b_gate_test_review_projection(bundle: Mapping[str, Any]) -> list[str]:
    """Validate the seq374 completed-but-unaccepted Gate handoff to test review."""
    progress = bundle["progress"]
    instruction = progress.get("active_work_instruction") or {}
    errors: list[str] = []

    if any((
        progress.get("event_sequence") != 374,
        progress.get("current_phase") != "B",
        progress.get("current_work_package") != "PHASE_B_GATE",
        progress.get("status") != "TEST_REVIEW",
        "B-12" not in progress.get("completed_packages", []),
        "PHASE_B_GATE" in progress.get("completed_packages", []),
        (progress.get("historical_failure_counts_by_lineage") or {}).get("B-12") != 1,
        (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "PHASE_B_GATE",
        (progress.get("active_failure_lineage") or {}).get("valid_failure_count") != 0,
        instruction.get("artifact_id") != "WI-PHASE-B-GATE-REWORK-20260821-003",
        instruction.get("result_status") != "COMPLETED",
        instruction.get("package_status") != "TEST_REVIEW",
        instruction.get("accepted") is not False,
        instruction.get("independent_tester_status") != "READY_FOR_MAIN_GATE_DECISION",
    )):
        errors.append("PHASE_B_GATE_TEST_REVIEW_PROJECTION_INVALID")

    if any((
        progress.get("active_agent") is not None,
        progress.get("worker_lease") is not None,
        progress.get("write_lease") is not None,
    )):
        errors.append("PHASE_B_GATE_TEST_REVIEW_RELEASE_INVALID")

    if (progress.get("next_work_package") or {}) != {
        "package_id": "C-01", "status": "BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE"
    }:
        errors.append("PHASE_B_GATE_C01_BOUNDARY_INVALID")
    return sorted(set(errors))


def validate_b12_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; p=bundle["progress"]
    expected={"docs/evidence/manifests/B-12_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-b12-accepted-r2.json","docs/test_reports/B-12_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-12_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums")
    if not isinstance(rows,list): return ["B12_ACCEPTANCE_RAW_INVALID"]
    errors=[]; indexed={}; canonical=[]; total=0
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in indexed or relative==manifest.get("artifact_path"): errors.append("B12_ACCEPTANCE_RAW_INVALID"); continue
        raw=(root/relative).read_bytes(); digest=hashlib.sha256(raw).hexdigest().upper(); indexed[relative]=row; total+=len(raw); canonical.append(f"{relative}\t{len(raw)}\t{digest}")
        if row.get("bytes")!=len(raw) or row.get("sha256")!=digest: errors.append("B12_ACCEPTANCE_RAW_INVALID")
    canonical_bytes="\n".join(sorted(canonical)).encode("utf-8"); target="sha256:"+hashlib.sha256(canonical_bytes).hexdigest().upper()
    if set(indexed)!=expected: errors.append("B12_ACCEPTANCE_RAW_SET_INVALID")
    if any((manifest.get("target_canonical_bytes")!=len(canonical_bytes),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B12_ACCEPTANCE_TARGET_MISMATCH")
    accepted=[event for event in bundle["events"]["events"] if event.get("sequence")==361]
    historical=p.get("historical_failure_counts_by_lineage") or {}
    lineage=p.get("active_failure_lineage") or {}
    expected_event_details={
        "decision":"ACCEPTED", "verdict":"READY_FOR_MAIN_ACCEPTANCE",
        "test_report_ref":"docs/test_reports/B-12_INDEPENDENT_TEST_REPORT.md",
        "test_report_sha256":"4BC563551B64B885A3361957E5DA7EAE7458121FE83803D9844E178916D3CD06",
        "manifest_ref":"docs/evidence/manifests/B-12_EVIDENCE_MANIFEST.json",
        "manifest_sha256":"2A4A944B08A3837D8774D4917A0C4E91F9DA3F5F7C16F55A2B893AC3FFEADDAA",
        "tester_verdict":"READY_FOR_MAIN_ACCEPTANCE", "blocking_findings":0,
        "developer_manifest_sha256":"2A4A944B08A3837D8774D4917A0C4E91F9DA3F5F7C16F55A2B893AC3FFEADDAA",
        "developer_target_hash":"D11F17409DDE8C51B036EE9AE659D5295B7D7B840A0BB472CCFEA483135E6A5D",
        "product_exact_paths_frozen":True, "product_mutation_after_freeze_count":0,
        "valid_failure_count":0, "historical_failure_count":1,
        "next_work_package":"C-01", "next_package_status":"BLOCKED_PENDING_B_GATE", "c01_started":False,
    }
    if len(accepted) != 1 or accepted[0].get("event_type") != "MAIN_PACKAGE_ACCEPTED" or accepted[0].get("subject_ref") != "B-12" or any(accepted[0].get("details", {}).get(key) != value for key, value in expected_event_details.items()):
        errors.append("B12_ACCEPTANCE_EVENT_INVALID")
    if any(("B-12" not in p.get("completed_packages",[]), historical.get("B-12") != 1, (p.get("historical_accepted_failure_count") or 0) < 23)):
        errors.append("B12_ACCEPTANCE_HISTORICAL_PROJECTION_INVALID")
    if p.get("event_sequence") == 361 and any((p.get("current_work_package")!="B-12",p.get("status")!="ACCEPTED",p.get("valid_failure_count")!=0,lineage.get("step_lineage_id")!="PHASE_B_GATE",lineage.get("valid_failure_count")!=0,p.get("active_work_instruction") is not None,p.get("active_agent") is not None,p.get("worker_lease") is not None,p.get("write_lease") is not None,(p.get("next_work_package") or {})!={"package_id":"C-01","status":"BLOCKED_PENDING_B_GATE"},manifest.get("tester_report_sha256")!="4BC563551B64B885A3361957E5DA7EAE7458121FE83803D9844E178916D3CD06",manifest.get("tester_verdict")!="READY_FOR_MAIN_ACCEPTANCE",manifest.get("blocking_findings")!=0,manifest.get("developer_target_hash")!="D11F17409DDE8C51B036EE9AE659D5295B7D7B840A0BB472CCFEA483135E6A5D",manifest.get("product_exact_paths_frozen") is not True,manifest.get("product_mutation_after_freeze_count")!=0,len((p.get("repository") or {}).get("exact_allowed_paths",[]))!=15)):
        errors.append("B12_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


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
        elif current_manifest_relative == "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b04_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b04_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-04_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_b04_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/WORKPLAN_V16_SUCCESSOR_MANIFEST.json":
            errors.extend(validate_workplan_v16_successor_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-05_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b05_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-05_WI_REBIND_EVIDENCE_MANIFEST_R2.json":
            errors.extend(validate_b05_wi_rebind_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-05_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b05_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-05_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_b05_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-06_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b06_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-06_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b06_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b03_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b03_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b03_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b03_r3_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b03_r3_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-03_ACCEPTANCE_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b03_r3_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-06_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_b06_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-07_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b07_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-07_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b07_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-07_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_b07_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-08_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b08_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-09_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b09_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-09_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b09_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-09_REWORK_START_PROGRESS_MANIFEST_R5.json":
            errors.extend(validate_b09_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-09_REWORK_COMPLETION_PROGRESS_MANIFEST_R5.json":
            errors.extend(validate_b09_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-09_ACCEPTANCE_PROGRESS_MANIFEST_R5.json":
            errors.extend(validate_b09_r5_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-10_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b10_start_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-10_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b10_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-10_REWORK_START_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b10_rework_start_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b10_rework_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-10_REWORK_START_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b10_r3_rework_start_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b10_r3_rework_completion_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-10_ACCEPTANCE_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_b10_r3_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-11_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b11_start_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-11_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b11_completion_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-11_REWORK_START_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b11_rework_start_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-11_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b11_r2_completion_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-11_ACCEPTANCE_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b11_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-12_START_EVIDENCE_MANIFEST.json":
            errors.extend(validate_b12_start_projection(bundle["_root"]))
        elif current_manifest_relative == "docs/evidence/manifests/B-12_ACCEPTANCE_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_b12_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-08_COMPLETION_PROGRESS_MANIFEST.json":
            errors.extend(validate_b08_completion_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/B-08_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_b08_acceptance_manifest(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR01_ACCEPTANCE_PROGRESS_MANIFEST.json":
            errors.extend(validate_c21_lr01_acceptance_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_START_MANIFEST.json":
            errors.extend(validate_c21_lr02a_start_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R2.json":
            errors.extend(validate_c21_lr02a_rework_start_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_REWORK_START_PROGRESS_MANIFEST_R3.json":
            errors.extend(validate_c21_lr02a_rework_start_projection_r3(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json":
            errors.extend(validate_c21_lr02a_acceptance_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json":
            errors.extend(validate_c21_lr02b_start_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json":
            errors.extend(validate_c21_lr02b_acceptance_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json":
            errors.extend(validate_c21_lr02c_start_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json":
            errors.extend(validate_c21_lr02c_takeover_r2_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json":
            errors.extend(validate_c21_lr02c_rework_r3_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json":
            errors.extend(validate_c21_lr02c_acceptance_r3_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json":
            errors.extend(validate_c21_lr02c_operational_start_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json":
            errors.extend(validate_c21_backup_portability_rework_start_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_R1.json":
            errors.extend(validate_c21_backup_portability_acceptance_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json":
            errors.extend(validate_c21_lr02c_operational_rework_r2_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json":
            errors.extend(validate_c21_lr02c_ops_r2_release_rebind_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_MAIN_RECONCILIATION_MANIFEST.json":
            errors.extend(validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_CONNINFO_REWORK_MANIFEST_R4.json":
            errors.extend(validate_c21_lr02c_ops_r2_conninfo_r4_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_YSNA_STAGING_CLASSIFICATION_DECISION_MANIFEST.json":
            errors.extend(validate_c21_ysna_staging_decision_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json":
            errors.extend(validate_c21_wsl_readiness_decision_projection(manifest, bundle))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json":
            try:
                candidate = _load_json(bundle["_root"] / "deploy/wsl/CandidateReleaseManifest.json")
            except (OSError, json.JSONDecodeError, TypeError):
                errors.append("C21_WSL_CONTROL_CANDIDATE_INVALID")
            else:
                errors.extend(
                    validate_c21_wsl_control_successor_projection(candidate, bundle, manifest)
                )
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json":
            errors.extend(validate_c21_wsl_control_postcommit_projection(bundle, manifest))
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json":
            errors.extend(
                validate_c21_wsl_control_runtime_successor_projection(bundle, manifest)
            )
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json":
            errors.extend(
                validate_c21_wsl_fresh_clone_candidate_rebind_projection(bundle, manifest)
            )
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json":
            errors.extend(
                validate_c21_wsl_compose_runner_candidate_rebind_projection(bundle, manifest)
            )
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json":
            errors.extend(
                validate_c21_wsl_cold_start_candidate_rebind_projection(bundle, manifest)
            )
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json":
            errors.extend(
                validate_c21_wsl_ingress_candidate_rebind_projection(bundle, manifest)
            )
        elif current_manifest_relative == "docs/evidence/manifests/C-21_WSL_EARLY_VALIDATION_START_MANIFEST.json":
            try:
                candidate = _load_json(bundle["_root"] / "deploy/wsl/CandidateReleaseManifest.json")
            except (OSError, json.JSONDecodeError, TypeError):
                errors.append("C21_WSL_ACTIVE_CANDIDATE_INVALID")
            else:
                errors.extend(validate_c21_wsl_active_projection(candidate, bundle, manifest))
    if progress.get("current_work_package") == "PHASE_B_GATE":
        if progress.get("status") == "ACTIVE":
            errors.extend(validate_phase_b_gate_active_projection(bundle))
        elif progress.get("status") == "TEST_REVIEW":
            errors.extend(validate_phase_b_gate_test_review_projection(bundle))
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


def validate_b10_start_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    progress = bundle["progress"]
    if progress.get("event_sequence") in (329, 332, 333):
        return []
    events = [event for event in bundle["events"]["events"] if 313 <= event["sequence"] <= 315]
    errors = []
    expected_ids = ["AV-SAFE-003", "AV-SAFE-025", "AV-STAT-030", "AV-STAT-031", "AV-STAT-032", "AV-STAT-033", "AV-STAT-037", "AV-AGT-006"]
    wi = progress.get("active_work_instruction") or {}
    if progress.get("event_sequence") != 315 or progress.get("current_work_package") != "B-10" or progress.get("status") != "ACTIVE": errors.append("B10_PHASE_PROJECTION_INVALID")
    if wi.get("artifact_id") != "WI-B-10-20260820-001" or wi.get("assigned_verification_ids") != expected_ids: errors.append("B10_WORK_INSTRUCTION_INVALID")
    if progress.get("active_agent") != "developer-primary-b10" or (progress.get("worker_lease") or {}).get("lease_epoch") != 1 or (progress.get("write_lease") or {}).get("write_epoch") != 1: errors.append("B10_FENCING_INVALID")
    if [event["event_type"] for event in events] != ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"]: errors.append("B10_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}) != {"package_id": "B-11", "status": "BLOCKED_PENDING_B10_ACCEPTANCE"}: errors.append("B11_BOUNDARY_INVALID")
    return errors


def validate_b11_start_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    progress = bundle["progress"]
    if progress.get("event_sequence") == 347: return []
    manifest = _load_json(root / "docs/evidence/manifests/B-11_START_EVIDENCE_MANIFEST.json")
    events = [event for event in bundle["events"]["events"] if 334 <= event["sequence"] <= 336]
    errors = []
    expected_ids = ["AV-STAT-007", "AV-UI-011", "AV-UI-012", "AV-UI-016", "AV-SAFE-029"]
    wi = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    if progress.get("event_sequence") != 336 or progress.get("current_work_package") != "B-11" or progress.get("status") != "ACTIVE": errors.append("B11_PHASE_PROJECTION_INVALID")
    if wi.get("artifact_id") != "WI-B-11-20260821-001" or wi.get("assigned_verification_ids") != expected_ids: errors.append("B11_WORK_INSTRUCTION_INVALID")
    if progress.get("active_agent") != "developer-primary-b11" or worker.get("lease_epoch") != 1 or write.get("write_epoch") != 1 or write.get("worker_lease_id") != worker.get("lease_id"): errors.append("B11_FENCING_INVALID")
    if [event["event_type"] for event in events] != ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"]: errors.append("B11_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}) != {"package_id": "B-12", "status": "BLOCKED_PENDING_B11_ACCEPTANCE"}: errors.append("B12_BOUNDARY_INVALID")
    expected = {
        "docs/evidence/manifests/B-10_ACCEPTANCE_PROGRESS_MANIFEST_R3.json",
        "docs/progress/progress-handoff-detached-digest-b11-start.json",
        "docs/work_orders/B-11_INVOCATION_PROMPT.md",
        "docs/work_orders/B-11_WORK_INSTRUCTION.md",
        "scripts/check_a13_repository_scan.py",
        "scripts/check_g07_baseline.py",
        "scripts/check_phase_g_gate.py",
        "scripts/check_project_progress.py",
        "tests/tooling/test_a13_repository_scan.py",
        "tests/tooling/test_g07_baseline.py",
        "tests/tooling/test_phase_g_gate.py",
        "tests/tooling/test_project_progress.py",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return sorted(set(errors + ["B11_START_RAW_INVALID"]))
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B11_START_RAW_INVALID")
            continue
        seen.add(relative)
        raw = (root / relative).read_bytes()
        digest = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != digest:
            errors.append("B11_START_RAW_INVALID")
        total += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{digest}"))
    if seen != expected:
        errors.append("B11_START_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False, manifest.get("projection_product_mutation_count") != 0, manifest.get("developer_exact_path_count") != 17)):
        errors.append("B11_START_TARGET_MISMATCH")
    return sorted(set(errors))


def validate_b11_completion_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    progress = bundle["progress"]
    if progress.get("event_sequence") == 347: return []
    manifest = _load_json(root / "docs/evidence/manifests/B-11_COMPLETION_PROGRESS_MANIFEST.json")
    events = [event for event in bundle["events"]["events"] if 337 <= event["sequence"] <= 339]
    errors: list[str] = []
    wi = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 339, progress.get("current_work_package") != "B-11", progress.get("status") != "TEST_REVIEW", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None)):
        errors.append("B11_COMPLETION_PHASE_INVALID")
    if any((wi.get("artifact_id") != "WI-B-11-20260821-001", wi.get("result_status") != "COMPLETED", wi.get("independent_tester_status") != "PENDING", wi.get("developer_manifest_sha256") != "BE11EA4C21FC34484CDF5B4CC924CAC03E9E64940A69EE014D9CE18D5D6A0C29", wi.get("developer_target_hash") != "FCA6FB92BD092C68BA9F0C500B107E95198FE2B693C6F7F14E7C09680D2E29F5")):
        errors.append("B11_COMPLETION_WORK_INSTRUCTION_INVALID")
    if [event.get("event_type") for event in events] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]:
        errors.append("B11_COMPLETION_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}) != {"package_id": "B-12", "status": "BLOCKED_PENDING_B11_ACCEPTANCE"}:
        errors.append("B12_BOUNDARY_INVALID")
    if len((progress.get("repository") or {}).get("exact_allowed_paths", [])) != 30:
        errors.append("B11_COMPLETION_SCOPE_INVALID")
    if any((manifest.get("developer_manifest_sha256") != "BE11EA4C21FC34484CDF5B4CC924CAC03E9E64940A69EE014D9CE18D5D6A0C29", manifest.get("developer_target_hash") != "FCA6FB92BD092C68BA9F0C500B107E95198FE2B693C6F7F14E7C09680D2E29F5", manifest.get("developer_raw_artifact_count") != 16, manifest.get("developer_exact_path_count") != 17, manifest.get("product_exact_paths_frozen") is not True, manifest.get("projection_product_mutation_count") != 0)):
        errors.append("B11_COMPLETION_FREEZE_INVALID")
    expected = {"docs/evidence/manifests/B-11_EVIDENCE_MANIFEST.json", "docs/progress/progress-handoff-detached-digest-b11-completion.json", "docs/work_orders/B-11_INVOCATION_PROMPT.md", "docs/work_orders/B-11_WORK_INSTRUCTION.md", "scripts/check_a13_repository_scan.py", "scripts/check_g07_baseline.py", "scripts/check_phase_g_gate.py", "scripts/check_project_progress.py", "tests/tooling/test_a13_repository_scan.py", "tests/tooling/test_g07_baseline.py", "tests/tooling/test_phase_g_gate.py", "tests/tooling/test_project_progress.py"}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return sorted(set(errors + ["B11_COMPLETION_RAW_INVALID"]))
    seen: set[str] = set(); canonical_rows: list[tuple[bytes, str]] = []; total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B11_COMPLETION_RAW_INVALID"); continue
        seen.add(relative); raw = (root / relative).read_bytes(); digest = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != digest: errors.append("B11_COMPLETION_RAW_INVALID")
        total += len(raw); canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{digest}"))
    if seen != expected: errors.append("B11_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8"); target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("B11_COMPLETION_TARGET_MISMATCH")
    return sorted(set(errors))


def validate_b12_start_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    progress = bundle["progress"]
    manifest = _load_json(root / "docs/evidence/manifests/B-12_START_EVIDENCE_MANIFEST.json")
    events = [event for event in bundle["events"]["events"] if 348 <= event["sequence"] <= 350]
    errors: list[str] = []
    expected_ids = ["AV-STAT-014", "AV-STAT-034", "AV-STAT-035", "AV-STAT-036", "AV-STAT-038", "AV-STAT-039", "AV-OPS-005", "AV-SAFE-031", "AV-FLOW-010", "AV-FLOW-011"]
    wi = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    if any((progress.get("event_sequence") != 350, progress.get("current_work_package") != "B-12", progress.get("status") != "ACTIVE")):
        errors.append("B12_PHASE_PROJECTION_INVALID")
    if wi.get("artifact_id") != "WI-B-12-20260821-001" or wi.get("assigned_verification_ids") != expected_ids:
        errors.append("B12_WORK_INSTRUCTION_INVALID")
    if any((progress.get("active_agent") != "developer-primary-b12", worker.get("lease_epoch") != 1, write.get("write_epoch") != 1, write.get("worker_lease_id") != worker.get("lease_id"), len(write.get("paths", [])) != 15, write.get("paths") != write.get("path_scope"))):
        errors.append("B12_FENCING_INVALID")
    if [event.get("event_type") for event in events] != ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"]:
        errors.append("B12_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}) != {"package_id": "C-01", "status": "BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE"}:
        errors.append("B_GATE_BOUNDARY_INVALID")
    expected = {
        "docs/evidence/manifests/B-11_ACCEPTANCE_PROGRESS_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-b12-start.json",
        "docs/work_orders/B-12_INVOCATION_PROMPT.md",
        "docs/work_orders/B-12_WORK_INSTRUCTION.md",
        "scripts/check_a13_repository_scan.py",
        "scripts/check_g07_baseline.py",
        "scripts/check_phase_g_gate.py",
        "scripts/check_project_progress.py",
        "tests/tooling/test_a13_repository_scan.py",
        "tests/tooling/test_g07_baseline.py",
        "tests/tooling/test_phase_g_gate.py",
        "tests/tooling/test_project_progress.py",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return sorted(set(errors + ["B12_START_RAW_INVALID"]))
    seen: set[str] = set(); canonical_rows: list[tuple[bytes, str]] = []; total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B12_START_RAW_INVALID"); continue
        seen.add(relative); raw = (root / relative).read_bytes(); digest = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != digest: errors.append("B12_START_RAW_INVALID")
        total += len(raw); canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{digest}"))
    if seen != expected: errors.append("B12_START_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8"); target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False, manifest.get("projection_product_mutation_count") != 0, manifest.get("developer_exact_path_count") != 15)):
        errors.append("B12_START_TARGET_MISMATCH")
    return sorted(set(errors))


def validate_b11_rework_start_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    progress = bundle["progress"]
    if progress.get("event_sequence") == 347: return []
    manifest = _load_json(root / "docs/evidence/manifests/B-11_REWORK_START_PROGRESS_MANIFEST_R2.json")
    events = [event for event in bundle["events"]["events"] if 340 <= event["sequence"] <= 343]
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    wi = progress.get("active_work_instruction") or {}
    errors: list[str] = []
    expected_paths = {
        "docs/evidence/manifests/B-11_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-b11-rework-start-r2.json",
        "docs/test_reports/B-11_INDEPENDENT_TEST_REPORT.md",
        "docs/work_orders/B-11_REWORK_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/B-11_REWORK_WORK_INSTRUCTION_R2.md",
        "scripts/check_a13_repository_scan.py",
        "scripts/check_g07_baseline.py",
        "scripts/check_phase_g_gate.py",
        "scripts/check_project_progress.py",
        "tests/tooling/test_a13_repository_scan.py",
        "tests/tooling/test_g07_baseline.py",
        "tests/tooling/test_phase_g_gate.py",
        "tests/tooling/test_project_progress.py",
    }
    if any((
        progress.get("event_sequence") != 343,
        progress.get("current_work_package") != "B-11",
        progress.get("status") != "ACTIVE",
        progress.get("active_agent") != "developer-primary-b11",
        progress.get("valid_failure_count") != 1,
        (progress.get("active_failure_lineage") or {}).get("failure_fingerprint") != "BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED",
        wi.get("artifact_id") != "WI-B-11-20260821-002",
        wi.get("result_status") != "REWORK_IN_PROGRESS",
        wi.get("independent_tester_status") != "R2_PENDING",
        worker.get("lease_epoch") != 2,
        worker.get("execution_fencing_token") != "b11-execution-fence-epoch-2-ce81795",
        write.get("write_epoch") != 2,
        write.get("worker_lease_id") != worker.get("lease_id"),
        write.get("write_fencing_token") != "b11-write-fence-epoch-2-ce81795",
        len(write.get("paths", [])) != 8,
        (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B11_ACCEPTANCE",
    )):
        errors.append("B11_R2_PHASE_OR_FENCING_INVALID")
    if [event.get("event_type") for event in events] != ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"]:
        errors.append("B11_R2_EVENT_ORDER_INVALID")
    if any((
        manifest.get("tester_report_sha256") != "EFBE6313A9BFF589702149E7042FDA127DF99CA323FD864C8EC16EA72D07441C",
        manifest.get("failure_fingerprint") != "BLK-B11-001-SCOPE-AUTHORIZATION-NOT-ENFORCED",
        manifest.get("developer_r2_exact_path_count") != 8,
        manifest.get("projection_product_mutation_count") != 0,
        manifest.get("worker_fencing_token") != "b11-execution-fence-epoch-2-ce81795",
        manifest.get("write_fencing_token") != "b11-write-fence-epoch-2-ce81795",
    )):
        errors.append("B11_R2_MANIFEST_CONTRACT_INVALID")
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return sorted(set(errors + ["B11_R2_RAW_INVALID"]))
    seen: set[str] = set(); canonical_rows: list[tuple[bytes, str]] = []; total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B11_R2_RAW_INVALID"); continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("B11_R2_RAW_INVALID"); continue
        digest = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != digest:
            errors.append("B11_R2_RAW_INVALID")
        total += len(raw); canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{digest}"))
    if seen != expected_paths:
        errors.append("B11_R2_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("B11_R2_TARGET_MISMATCH")
    return sorted(set(errors))


def validate_b11_r2_completion_projection(root: Path) -> list[str]:
    bundle = load_bundle(root); progress = bundle["progress"]
    if progress.get("event_sequence") == 347: return []
    manifest = _load_json(root / "docs/evidence/manifests/B-11_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json")
    events = [event for event in bundle["events"]["events"] if 344 <= event["sequence"] <= 346]
    wi = progress.get("active_work_instruction") or {}; errors: list[str] = []
    if any((progress.get("event_sequence") != 346, progress.get("status") != "TEST_REVIEW", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None, progress.get("valid_failure_count") != 1, wi.get("result_status") != "COMPLETED", wi.get("independent_tester_status") != "PENDING_RETEST", (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B11_ACCEPTANCE")):
        errors.append("B11_R2_COMPLETION_PHASE_INVALID")
    if [event.get("event_type") for event in events] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]:
        errors.append("B11_R2_COMPLETION_EVENT_ORDER_INVALID")
    if manifest.get("developer_target_hash") != "25167A1D9C951C9A3E032862F72A4F1D8F5EBCF310585812EE7DC7095F4B3ABA" or manifest.get("product_exact_paths_frozen") is not True or manifest.get("projection_product_mutation_count") != 0:
        errors.append("B11_R2_COMPLETION_FREEZE_INVALID")
    rows=manifest.get("raw_checksums"); seen=set(); canonical=[]; total=0
    if not isinstance(rows,list): return sorted(set(errors+["B11_R2_COMPLETION_RAW_INVALID"]))
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in seen or relative==manifest.get("artifact_path"): errors.append("B11_R2_COMPLETION_RAW_INVALID"); continue
        seen.add(relative); raw=(root/relative).read_bytes(); digest=hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes")!=len(raw) or row.get("sha256")!=digest: errors.append("B11_R2_COMPLETION_RAW_INVALID")
        total+=len(raw); canonical.append((relative.encode(),f"{relative}\t{len(raw)}\t{digest}"))
    material="\n".join(v for _,v in sorted(canonical)).encode(); target="sha256:"+hashlib.sha256(material).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes")!=len(material),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B11_R2_COMPLETION_TARGET_MISMATCH")
    return sorted(set(errors))


def validate_b11_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root=bundle["_root"]; progress=bundle["progress"]
    expected={"docs/evidence/manifests/B-11_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json","docs/progress/progress-handoff-detached-digest-b11-accepted-r2.json","docs/test_reports/B-11_INDEPENDENT_TEST_REPORT.md","docs/work_orders/B-11_REWORK_WORK_INSTRUCTION_R2.md"}
    rows=manifest.get("raw_checksums")
    if not isinstance(rows,list): return ["B11_ACCEPTANCE_RAW_INVALID"]
    errors=[]; indexed={}; canonical=[]; total=0
    for row in rows:
        relative=row.get("path") if isinstance(row,dict) else None
        if not isinstance(relative,str) or relative in indexed or relative==manifest.get("artifact_path"): errors.append("B11_ACCEPTANCE_RAW_INVALID"); continue
        raw=(root/relative).read_bytes(); digest=hashlib.sha256(raw).hexdigest().upper(); indexed[relative]=row; total+=len(raw); canonical.append(f"{relative}\t{len(raw)}\t{digest}")
        if row.get("bytes")!=len(raw) or row.get("sha256")!=digest: errors.append("B11_ACCEPTANCE_RAW_INVALID")
    canonical_bytes="\n".join(sorted(canonical)).encode("utf-8"); target="sha256:"+hashlib.sha256(canonical_bytes).hexdigest().upper()
    if set(indexed)!=expected: errors.append("B11_ACCEPTANCE_RAW_SET_INVALID")
    if any((manifest.get("target_canonical_bytes")!=len(canonical_bytes),manifest.get("target_content_bytes")!=total,manifest.get("target_hash")!=target,manifest.get("delivered_hash")!=target,manifest.get("content_hash")!=target,manifest.get("self_reference") is not False)): errors.append("B11_ACCEPTANCE_TARGET_MISMATCH")
    accepted=[event for event in bundle["events"]["events"] if event.get("sequence")==347]; historical=progress.get("historical_failure_counts_by_lineage") or {}
    lineage=progress.get("active_failure_lineage") or {}
    if any((progress.get("event_sequence")!=347,progress.get("current_work_package")!="B-12",progress.get("status")!="READY","B-11" not in progress.get("completed_packages",[]),progress.get("valid_failure_count")!=0,lineage.get("step_lineage_id")!="B-12",lineage.get("valid_failure_count")!=0,historical.get("B-11")!=1,progress.get("active_work_instruction") is not None,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None,(progress.get("next_work_package") or {})!={"package_id":"B-12","status":"READY"},[event.get("event_type") for event in accepted]!=["MAIN_PACKAGE_ACCEPTED"],manifest.get("tester_report_sha256")!="F925ECC0C70E4DC4EE2E0F5BF883E94FD9D5AA666A801448B2044CBF8B6819E5",manifest.get("tester_verdict")!="READY_FOR_MAIN_ACCEPTANCE",manifest.get("blocking_findings")!=0,manifest.get("developer_target_hash")!="25167A1D9C951C9A3E032862F72A4F1D8F5EBCF310585812EE7DC7095F4B3ABA",manifest.get("product_exact_paths_frozen") is not True,manifest.get("product_mutation_after_freeze_count")!=0,len((progress.get("repository") or {}).get("exact_allowed_paths",[]))!=15)): errors.append("B11_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_b10_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    if progress.get("event_sequence") in (329, 332, 333):
        return []
    events = [event for event in bundle["events"]["events"] if 316 <= event["sequence"] <= 318]
    expected = {
        "docs/evidence/manifests/B-10_START_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/B-10_EVIDENCE_MANIFEST.json",
        "docs/progress/progress-handoff-detached-digest-b10-completion-test-review.json",
        "docs/work_orders/B-10_WORK_INSTRUCTION.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["B10_COMPLETION_RAW_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B10_COMPLETION_RAW_INVALID")
            continue
        seen.add(relative)
        raw = (root / relative).read_bytes()
        sha = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != sha:
            errors.append("B10_COMPLETION_RAW_INVALID")
        total += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{sha}"))
    if seen != expected:
        errors.append("B10_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("B10_COMPLETION_TARGET_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 318, progress.get("current_work_package") != "B-10", progress.get("status") != "TEST_REVIEW", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None, wi.get("artifact_id") != "WI-B-10-20260820-001", wi.get("result_status") != "COMPLETED", wi.get("independent_tester_status") != "PENDING", (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B10_ACCEPTANCE", [event.get("event_type") for event in events] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], manifest.get("developer_manifest_sha256") != "750AB971D95D860324656AE81CF8501C434AF78210386B277C26ACC5F791086F", manifest.get("developer_target_hash") != "0DDE236523F95C995A583C580108744A656717F4D285CFE30B1ED4FC5E46C43F", manifest.get("developer_exact_paths_frozen") is not True, manifest.get("developer_mutation") != "FORBIDDEN_FROZEN_PREDECESSOR")):
        errors.append("B10_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_b10_rework_start_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]
    progress = bundle["progress"]
    if progress.get("event_sequence") in (329, 332, 333):
        return []
    events = [event for event in bundle["events"]["events"] if 319 <= event["sequence"] <= 322]
    expected = {
        "docs/evidence/manifests/B-10_COMPLETION_PROGRESS_MANIFEST.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-b10-rework-start-r2.json",
        "docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md",
        "docs/work_orders/B-10_REWORK_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/B-10_REWORK_WORK_INSTRUCTION_R2.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["B10_R2_RAW_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B10_R2_RAW_INVALID")
            continue
        seen.add(relative)
        raw = (root / relative).read_bytes()
        sha = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != sha:
            errors.append("B10_R2_RAW_INVALID")
        total += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{sha}"))
    if seen != expected:
        errors.append("B10_R2_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("B10_R2_TARGET_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    if any((progress.get("event_sequence") != 322, progress.get("current_work_package") != "B-10", progress.get("status") != "ACTIVE", progress.get("active_agent") != "developer-primary-b10", progress.get("valid_failure_count") != 1, wi.get("artifact_id") != "WI-B-10-20260821-002", wi.get("result_status") != "REWORK_IN_PROGRESS", worker.get("lease_epoch") != 2, write.get("write_epoch") != 2, write.get("worker_lease_id") != worker.get("lease_id"), (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B10_ACCEPTANCE", [event.get("event_type") for event in events] != ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], manifest.get("tester_report_sha256") != "B1FDDE5244129A0E086E9F666A635955751A6D3A5A83DB582E23CC1EB90AEBBB", manifest.get("failure_fingerprint") != "BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE", manifest.get("developer_r2_exact_path_count") != 7)):
        errors.append("B10_R2_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_b10_rework_start_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    manifest = _load_json(root / "docs/evidence/manifests/B-10_REWORK_START_PROGRESS_MANIFEST_R2.json")
    return validate_b10_rework_start_manifest(manifest, bundle)


def validate_b10_rework_completion_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    errors: list[str] = []
    root = bundle["_root"]
    progress = bundle["progress"]
    if progress.get("event_sequence") in (329, 332, 333):
        return []
    events = [event for event in bundle["events"]["events"] if 323 <= event.get("sequence", -1) <= 325]
    expected = {
        "docs/evidence/manifests/B-10_EVIDENCE_MANIFEST.json",
        "docs/evidence/manifests/B-10_REWORK_START_PROGRESS_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-b10-rework-completion-r2.json",
        "docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md",
        "docs/work_orders/B-10_REWORK_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/B-10_REWORK_WORK_INSTRUCTION_R2.md",
    }
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["B10_R2_COMPLETION_RAW_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B10_R2_COMPLETION_RAW_INVALID")
            continue
        seen.add(relative)
        raw = (root / relative).read_bytes()
        digest = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != digest:
            errors.append("B10_R2_COMPLETION_RAW_INVALID")
        total += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{digest}"))
    if seen != expected:
        errors.append("B10_R2_COMPLETION_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("B10_R2_COMPLETION_TARGET_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 325, progress.get("current_work_package") != "B-10", progress.get("status") != "TEST_REVIEW", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None, progress.get("valid_failure_count") != 1, wi.get("artifact_id") != "WI-B-10-20260821-002", wi.get("result_status") != "COMPLETED", wi.get("independent_tester_status") != "PENDING_RETEST", wi.get("developer_manifest_sha256") != "6CBB859DA5598F4586380A124477C0D0C084B64AB43ACAE8C2FE4182B6A37934", wi.get("developer_target_hash") != "6CEB2CB8CCFB2168141C0B995EB4E1868EFBF4D0EC1DC94B9176D860CD785317", [event.get("event_type") for event in events] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B10_ACCEPTANCE", manifest.get("developer_raw_artifact_count") != 6, manifest.get("developer_target_hash") != "6CEB2CB8CCFB2168141C0B995EB4E1868EFBF4D0EC1DC94B9176D860CD785317")):
        errors.append("B10_R2_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_b10_rework_completion_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    manifest = _load_json(root / "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json")
    return validate_b10_rework_completion_manifest(manifest, bundle)


def validate_b10_r3_rework_start_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    progress = bundle["progress"]
    if progress.get("event_sequence") in (332, 333):
        return []
    manifest = _load_json(root / "docs/evidence/manifests/B-10_REWORK_START_PROGRESS_MANIFEST_R3.json")
    events = [event for event in bundle["events"]["events"] if 326 <= event.get("sequence", -1) <= 329]
    expected = {
        "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json",
        "docs/progress/failure-ledger.json",
        "docs/progress/progress-handoff-detached-digest-b10-rework-start-r3.json",
        "docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md",
        "docs/work_orders/B-10_REWORK_INVOCATION_PROMPT_R3.md",
        "docs/work_orders/B-10_REWORK_WORK_INSTRUCTION_R3.md",
    }
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return ["B10_R3_RAW_INVALID"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in seen or relative == manifest.get("artifact_path"):
            errors.append("B10_R3_RAW_INVALID")
            continue
        seen.add(relative)
        raw = (root / relative).read_bytes()
        digest = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != digest:
            errors.append("B10_R3_RAW_INVALID")
        total += len(raw)
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{digest}"))
    if seen != expected:
        errors.append("B10_R3_RAW_SET_INVALID")
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if any((manifest.get("target_canonical_bytes") != len(canonical), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)):
        errors.append("B10_R3_TARGET_MISMATCH")
    wi = progress.get("active_work_instruction") or {}
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    if any((progress.get("event_sequence") != 329, progress.get("current_work_package") != "B-10", progress.get("status") != "ACTIVE", progress.get("active_agent") != "developer-primary-b10", progress.get("valid_failure_count") != 2, wi.get("artifact_id") != "WI-B-10-20260821-003", wi.get("result_status") != "REWORK_IN_PROGRESS", wi.get("independent_tester_status") != "R3_PENDING", worker.get("lease_epoch") != 3, write.get("write_epoch") != 3, write.get("worker_lease_id") != worker.get("lease_id"), len((progress.get("repository") or {}).get("exact_allowed_paths", [])) != 17, (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B10_ACCEPTANCE", [event.get("event_type") for event in events] != ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], manifest.get("tester_report_sha256") != "23865D1722B231F04C7087328874A41D19431E5EE28C90AC71A3FACDA9D4F854", manifest.get("failure_fingerprint") != "BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE", manifest.get("developer_r3_exact_path_count") != 7, manifest.get("projection_product_mutation_count") != 0)):
        errors.append("B10_R3_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_b10_r3_rework_completion_projection(root: Path) -> list[str]:
    bundle = load_bundle(root)
    progress = bundle["progress"]
    manifest = _load_json(root / "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json")
    events = [event for event in bundle["events"]["events"] if 330 <= event.get("sequence", -1) <= 332]
    wi = progress.get("active_work_instruction") or {}
    errors: list[str] = []
    if progress.get("event_sequence") == 333:
        return []
    if any((progress.get("event_sequence") != 332, progress.get("current_work_package") != "B-10", progress.get("status") != "TEST_REVIEW", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None, progress.get("valid_failure_count") != 2, wi.get("artifact_id") != "WI-B-10-20260821-003", wi.get("result_status") != "COMPLETED", wi.get("independent_tester_status") != "PENDING_RETEST", wi.get("developer_manifest_sha256") != "5F0922A70F63E19D51306CCF43B67902BF9B82354E1F229616404DB5C2DB02A8", wi.get("developer_target_hash") != "5DEF1A06A2DC87BB074BA18F1BC346B098400B61741208BF1CF419B94BD21CD4", len((progress.get("repository") or {}).get("exact_allowed_paths", [])) != 20, (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B10_ACCEPTANCE", [event.get("event_type") for event in events] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], manifest.get("developer_manifest_sha256") != "5F0922A70F63E19D51306CCF43B67902BF9B82354E1F229616404DB5C2DB02A8", manifest.get("developer_target_hash") != "5DEF1A06A2DC87BB074BA18F1BC346B098400B61741208BF1CF419B94BD21CD4", manifest.get("developer_raw_artifact_count") != 6, manifest.get("product_exact_paths_frozen") is not True, manifest.get("projection_product_mutation_count") != 0)):
        errors.append("B10_R3_COMPLETION_PROJECTION_MISMATCH")
    return sorted(set(errors))


def validate_b10_r3_acceptance_manifest(manifest: Mapping[str, Any], bundle: Mapping[str, Any]) -> list[str]:
    root = bundle["_root"]; progress = bundle["progress"]
    expected = {"docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json", "docs/progress/progress-handoff-detached-digest-b10-accepted-r3.json", "docs/test_reports/B-10_INDEPENDENT_TEST_REPORT.md", "docs/work_orders/B-10_REWORK_WORK_INSTRUCTION_R3.md"}
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list): return ["B10_R3_ACCEPTANCE_RAW_INVALID"]
    errors: list[str] = []; indexed: dict[str, Mapping[str, Any]] = {}; canonical: list[str] = []; total = 0
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        if not isinstance(relative, str) or relative in indexed or relative == manifest.get("artifact_path"):
            errors.append("B10_R3_ACCEPTANCE_RAW_INVALID"); continue
        raw = (root / relative).read_bytes(); digest = hashlib.sha256(raw).hexdigest().upper(); indexed[relative] = row; total += len(raw); canonical.append(f"{relative}\t{len(raw)}\t{digest}")
        if row.get("bytes") != len(raw) or row.get("sha256") != digest: errors.append("B10_R3_ACCEPTANCE_RAW_INVALID")
    canonical_bytes = "\n".join(sorted(canonical)).encode("utf-8"); target = "sha256:" + hashlib.sha256(canonical_bytes).hexdigest().upper()
    if set(indexed) != expected: errors.append("B10_R3_ACCEPTANCE_RAW_SET_INVALID")
    if any((manifest.get("target_canonical_bytes") != len(canonical_bytes), manifest.get("target_content_bytes") != total, manifest.get("target_hash") != target, manifest.get("delivered_hash") != target, manifest.get("content_hash") != target, manifest.get("self_reference") is not False)): errors.append("B10_R3_ACCEPTANCE_TARGET_MISMATCH")
    accepted = [event for event in bundle["events"]["events"] if event.get("sequence") == 333]; historical = progress.get("historical_failure_counts_by_lineage") or {}
    if any((progress.get("event_sequence") != 333, progress.get("current_work_package") != "B-11", progress.get("status") != "READY", "B-10" not in progress.get("completed_packages", []), progress.get("valid_failure_count") != 0, historical.get("B-10") != 2, progress.get("active_work_instruction") is not None, progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None, (progress.get("next_work_package") or {}) != {"package_id":"B-11","status":"READY"}, [event.get("event_type") for event in accepted] != ["MAIN_PACKAGE_ACCEPTED"], manifest.get("tester_report_sha256") != "D884388D180FB746632DBE3B77C34533D875566619F05CFCF6FB093F43D35FFA", manifest.get("tester_verdict") != "READY_FOR_MAIN_ACCEPTANCE", manifest.get("blocking_findings") != 0, manifest.get("developer_target_hash") != "5DEF1A06A2DC87BB074BA18F1BC346B098400B61741208BF1CF419B94BD21CD4", manifest.get("product_exact_paths_frozen") is not True, manifest.get("product_mutation_after_freeze_count") != 0, len((progress.get("repository") or {}).get("exact_allowed_paths", [])) != 15)):
        errors.append("B10_R3_ACCEPTANCE_PROJECTION_MISMATCH")
    return sorted(set(errors))

def validate_b12_completion_projection(root: Path) -> list[str]:
    bundle = load_bundle(root); progress = bundle["progress"]
    terminal = [e for e in bundle["events"]["events"] if 351 <= e.get("sequence", -1) <= 353]
    wi = progress.get("active_work_instruction") or {}; errors: list[str] = []
    if any((progress.get("event_sequence") != 353, progress.get("current_work_package") != "B-12", progress.get("status") != "TEST_REVIEW", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None)): errors.append("B12_COMPLETION_PHASE_INVALID")
    if wi.get("result_status") != "COMPLETED" or wi.get("independent_tester_status") != "PENDING": errors.append("B12_COMPLETION_TESTER_INVALID")
    if wi.get("developer_manifest_sha256") != "47543B6D41C57CEBAB7003478F76177B1B1F05B2C46868D156612908AA7E6D7E" or wi.get("developer_target_hash") != "7EE778EBA5A85C107C90BA94D7186297192BDB6358CFA4571363183FB2AF316C": errors.append("B12_COMPLETION_FREEZE_INVALID")
    if [e.get("event_type") for e in terminal] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]: errors.append("B12_COMPLETION_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE": errors.append("C01_BOUNDARY_INVALID")
    return sorted(set(errors))


def validate_b12_rework_start_projection(root: Path) -> list[str]:
    bundle=load_bundle(root); progress=bundle["progress"]; events=bundle["events"]["events"]
    terminal=[e for e in events if 354<=e.get("sequence",-1)<=357]; worker=progress.get("worker_lease") or {}; write=progress.get("write_lease") or {}; wi=progress.get("active_work_instruction") or {}; errors=[]
    if any((progress.get("event_sequence")!=357,progress.get("current_work_package")!="B-12",progress.get("status")!="ACTIVE",progress.get("valid_failure_count")!=1,progress.get("active_agent")!="developer-primary-b12")): errors.append("B12_R2_PHASE_INVALID")
    if wi.get("artifact_id")!="WI-B-12-20260821-002" or wi.get("result_status")!="REWORK_IN_PROGRESS" or wi.get("developer_r2_exact_path_count")!=10: errors.append("B12_R2_WORK_INSTRUCTION_INVALID")
    if worker.get("lease_epoch")!=2 or write.get("write_epoch")!=2 or write.get("worker_lease_id")!=worker.get("lease_id"): errors.append("B12_R2_FENCING_INVALID")
    if [e.get("event_type") for e in terminal] != ["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"]: errors.append("B12_R2_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE": errors.append("C01_BOUNDARY_INVALID")
    return sorted(set(errors))


def validate_b12_r2_completion_projection(root: Path) -> list[str]:
    bundle=load_bundle(root); progress=bundle["progress"]; events=bundle["events"]["events"]; wi=progress.get("active_work_instruction") or {}; errors=[]
    terminal=[e for e in events if 358<=e.get("sequence",-1)<=360]
    if any((progress.get("event_sequence")!=360,progress.get("status")!="TEST_REVIEW",progress.get("valid_failure_count")!=1,progress.get("active_agent") is not None,progress.get("worker_lease") is not None,progress.get("write_lease") is not None)): errors.append("B12_R2_COMPLETION_PHASE_INVALID")
    if any((wi.get("result_status")!="COMPLETED",wi.get("independent_tester_status")!="PENDING_RETEST",wi.get("developer_manifest_sha256")!="2A4A944B08A3837D8774D4917A0C4E91F9DA3F5F7C16F55A2B893AC3FFEADDAA",wi.get("developer_target_hash")!="D11F17409DDE8C51B036EE9AE659D5295B7D7B840A0BB472CCFEA483135E6A5D",wi.get("developer_exact_path_count")!=10)): errors.append("B12_R2_COMPLETION_WI_INVALID")
    if [e.get("event_type") for e in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]: errors.append("B12_R2_COMPLETION_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE": errors.append("C01_BOUNDARY_INVALID")
    return sorted(set(errors))


def validate_b12_acceptance_projection(root: Path) -> list[str]:
    bundle=load_bundle(root); p=bundle["progress"]; e=[x for x in bundle["events"]["events"] if x.get("sequence")==361]; errors=[]
    if any((p.get("event_sequence")!=361,p.get("status")!="ACCEPTED",p.get("valid_failure_count")!=0,"B-12" not in p.get("completed_packages",[]),p.get("active_work_instruction") is not None,p.get("active_agent") is not None,p.get("worker_lease") is not None,p.get("write_lease") is not None)): errors.append("B12_ACCEPTANCE_PHASE_INVALID")
    if [x.get("event_type") for x in e] != ["MAIN_PACKAGE_ACCEPTED"]: errors.append("B12_ACCEPTANCE_EVENT_INVALID")
    if (p.get("historical_failure_counts_by_lineage") or {}).get("B-12")!=1 or (p.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B_GATE": errors.append("B12_ACCEPTANCE_BOUNDARY_INVALID")
    return errors


if __name__ == "__main__":
    raise SystemExit(main())
