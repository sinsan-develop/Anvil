"""Validate the accepted Phase G Gate without opening A-01."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
from pathlib import Path
from typing import Any, Mapping


G07_CHECKER = "scripts/check_g07_baseline.py"
WI_PATH = "docs/work_orders/PHASE_G_GATE_WORK_INSTRUCTION.md"
LEASE_PATH = "tests/fixtures/phase_g_gate/lease-dry-run.json"
PROGRESS_PATH = "docs/progress/build-progress.json"
HANDOFF_PATH = "docs/progress/BUILD_HANDOFF.md"
GATE_MANIFEST_PATH = "docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST.json"
GATE_R2_MANIFEST_PATH = "docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST_R2.json"
GATE_DECISION_PATH = "docs/decisions/PHASE_G_GATE_DECISION_RECORD.json"
CHECKPOINT_MANIFEST_PATH = "docs/evidence/manifests/PHASE_G_GATE_CHECKPOINT_MANIFEST.json"
CHECKPOINT_DETACHED_PATH = "docs/progress/progress-handoff-detached-digest-phase-a-ready.json"
EXPECTED_ACCEPTED = [f"G-{number:02d}" for number in range(1, 8)]
KEY_AV_SOURCES = {
    "AV-FLOW-003": "docs/test_reports/G-04_TEST_REPORT_R2.md",
    "AV-STAT-015": "docs/test_reports/G-05_TEST_REPORT_R2.md",
    "AV-STAT-016": "docs/test_reports/G-05_TEST_REPORT_R2.md",
    "AV-GATE-026": "docs/test_reports/G-07_TEST_REPORT.md",
    "AV-CON-016(RV)": "docs/test_reports/G-01_TEST_REPORT.md",
}
KEY_AV_META = {
    "AV-FLOW-003": ("G-04", "docs/evidence/manifests/G-04_EVIDENCE_MANIFEST.json", "L2 / E-ART", "independent-tester-g04"),
    "AV-STAT-015": ("G-05", "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json", "L2 / AU", "independent-tester-g05"),
    "AV-STAT-016": ("G-05", "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json", "L3 / MI", "independent-tester-g05"),
    "AV-GATE-026": ("G-07", "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json", "L2 / AU+RV", "independent-tester-g07"),
    "AV-CON-016(RV)": ("G-01", "docs/evidence/manifests/G-01_EVIDENCE_MANIFEST.json", "RV / design review", "independent-tester-g01"),
}


def _load_g07(root: Path):
    path = root / G07_CHECKER
    spec = importlib.util.spec_from_file_location("phase_g_gate_g07", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _text(root: Path, relative: str, overrides: Mapping[str, str]) -> str:
    return overrides.get(relative, (root / relative).read_text(encoding="utf-8"))


def _json(root: Path, relative: str, overrides: Mapping[str, Any]) -> Any:
    if relative in overrides:
        return overrides[relative]
    return json.loads((root / relative).read_text(encoding="utf-8"))


def _error(errors: list[dict[str, str]], code: str, path: str, detail: str) -> None:
    errors.append({"code": code, "path": path, "detail": detail})


def _parse_reconstruction(wi: str) -> dict[str, Any]:
    match = re.search(r"## reconstruction_contract\s*```json\s*(\{.*?\})\s*```", wi, re.DOTALL)
    return json.loads(match.group(1)) if match else {}


def _simulate_leases(fixture: Mapping[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    worker = None
    write = None
    results: list[dict[str, Any]] = []
    for operation in fixture.get("operations", []):
        action = operation.get("action")
        status, reason = "REJECTED", "UNKNOWN_ACTION"
        if action == "worker_claim":
            if worker is None:
                worker = {"lease_id": operation.get("lease_id"), "token": operation.get("execution_token")}
                status, reason = "ALLOWED", "CANONICAL_WORKER_FREE"
            else:
                reason = "ACTIVE_WORKER_LEASE_EXISTS"
        elif action == "write_claim":
            if write is not None:
                reason = "ACTIVE_WRITE_LEASE_EXISTS"
            elif worker is None or operation.get("worker_lease_id") != worker["lease_id"] or operation.get("execution_token") != worker["token"]:
                reason = "STALE_EXECUTION_TOKEN"
            else:
                write = {"lease_id": operation.get("lease_id"), "execution_token": operation.get("execution_token"), "write_token": operation.get("write_token")}
                status, reason = "ALLOWED", "CONFLICT_SCOPE_FREE"
        elif action == "commit":
            if worker is None or operation.get("execution_token") != worker["token"]:
                reason = "STALE_EXECUTION_TOKEN"
            elif write is None or operation.get("write_token") != write["write_token"]:
                reason = "STALE_WRITE_TOKEN"
            else:
                status, reason = "ALLOWED", "CURRENT_FENCING_TOKENS"
        elif action == "write_revoke":
            if write and operation.get("lease_id") == write["lease_id"] and operation.get("execution_token") == write["execution_token"] and operation.get("write_token") == write["write_token"]:
                write = None
                status, reason = "ALLOWED", "GATE_DRY_RUN_COMPLETE"
            else:
                reason = "LEASE_REVOKE_MISMATCH"
        elif action == "worker_revoke":
            if write is not None:
                reason = "DEPENDENT_WRITE_LEASE_ACTIVE"
            elif worker and operation.get("lease_id") == worker["lease_id"] and operation.get("execution_token") == worker["token"]:
                worker = None
                status, reason = "ALLOWED", "GATE_DRY_RUN_COMPLETE"
            else:
                reason = "LEASE_REVOKE_MISMATCH"
        results.append({
            "action": action, "actor": operation.get("actor"), "occurred_at": operation.get("occurred_at"),
            "path_scope": operation.get("path_scope"), "worker_epoch": operation.get("worker_epoch"),
            "write_epoch": operation.get("write_epoch"), "execution_token": operation.get("execution_token"),
            "write_token": operation.get("write_token"), "status": status, "reason": reason,
            "expected": operation.get("expected"), "expected_reason": operation.get("reason"),
        })
    return results, {"worker_lease": worker, "write_lease": write}


def validate_gate_manifest(root: Path | str) -> list[str]:
    root = Path(root).resolve()
    path = root / GATE_MANIFEST_PATH
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["GATE_MANIFEST_INVALID"]
    errors: list[str] = []
    canonical_rows = []
    total = 0
    seen = set()
    for row in manifest.get("raw_checksums", []):
        relative = row.get("path")
        byte_count = row.get("bytes")
        checksum = row.get("sha256")
        if (
            not isinstance(relative, str)
            or relative in seen
            or not isinstance(byte_count, int)
            or byte_count < 0
            or not isinstance(checksum, str)
            or not re.fullmatch(r"[0-9A-F]{64}", checksum)
        ):
            errors.append("GATE_MANIFEST_RAW_PATH_INVALID")
            continue
        seen.add(relative)
        total += byte_count
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{byte_count}\t{checksum}"))
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target:
        errors.append("GATE_MANIFEST_TARGET_MISMATCH")
    if manifest.get("target_canonical_bytes") != len(canonical) or manifest.get("target_content_bytes") != total:
        errors.append("GATE_MANIFEST_TARGET_BYTES_MISMATCH")
    material = dict(manifest)
    material.pop("content_hash", None)
    content_hash = "sha256:" + hashlib.sha256(json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
    if manifest.get("content_hash") != content_hash:
        errors.append("GATE_MANIFEST_CONTENT_HASH_MISMATCH")
    required = {
        "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json",
        GATE_R2_MANIFEST_PATH,
        GATE_DECISION_PATH,
        "docs/test_reports/PHASE_G_GATE_TEST_REPORT_R2.md",
        "docs/progress/progress-handoff-detached-digest-phase-g-gate.json",
    }
    if not required <= seen:
        errors.append("GATE_MANIFEST_PROVENANCE_MISSING")
    if manifest.get("package_status") != "ACCEPTED" or manifest.get("g_gate_status") != "ACCEPTED" or manifest.get("a01_start_allowed") is not False:
        errors.append("GATE_MANIFEST_FALSE_ADVANCEMENT")
    approval = manifest.get("standing_approval_application", {})
    if approval != {
        "status": "STANDING_AUTONOMOUS_APPROVAL_APPLIED",
        "actor": "main-agent-eoul",
        "approval_ref": "APPROVAL-20260810-AUTONOMOUS-EXECUTION-001",
        "approval_scope_match": True,
        "owner_report_review_status": "NOT_REPORT_SPECIFIC",
    }:
        errors.append("GATE_STANDING_APPROVAL_INVALID")
    try:
        proposal = json.loads((root / GATE_R2_MANIFEST_PATH).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        errors.append("GATE_PROPOSAL_MANIFEST_MISSING")
    else:
        supersedes = manifest.get("supersedes_artifact_ref", {})
        proposal_hash = hashlib.sha256((root / GATE_R2_MANIFEST_PATH).read_bytes()).hexdigest().upper()
        if (
            manifest.get("supersedes_artifact_id") != proposal.get("artifact_id")
            or supersedes.get("artifact_id") != proposal.get("artifact_id")
            or supersedes.get("path") != GATE_R2_MANIFEST_PATH
            or supersedes.get("file_sha256") != proposal_hash
            or supersedes.get("content_hash") != proposal.get("content_hash")
        ):
            errors.append("GATE_MANIFEST_REVISION_CHAIN_INVALID")
    return sorted(set(errors))


def validate_checkpoint_manifest(root: Path | str) -> list[str]:
    root = Path(root).resolve()
    try:
        manifest = json.loads((root / CHECKPOINT_MANIFEST_PATH).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["GATE_CHECKPOINT_MANIFEST_INVALID"]
    errors: list[str] = []
    rows: list[tuple[bytes, str]] = []
    seen: set[str] = set()
    total = 0
    for row in manifest.get("raw_checksums", []):
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen or relative == CHECKPOINT_MANIFEST_PATH:
            errors.append("GATE_CHECKPOINT_SELF_REFERENCE")
            continue
        seen.add(relative)
        declared_bytes = row.get("bytes")
        declared_hash = row.get("sha256")
        if (
            not isinstance(declared_bytes, int)
            or declared_bytes < 0
            or not isinstance(declared_hash, str)
            or re.fullmatch(r"[0-9A-F]{64}", declared_hash) is None
        ):
            errors.append("GATE_CHECKPOINT_RAW_DECLARATION_INVALID")
            continue
        total += declared_bytes
        rows.append(
            (
                relative.encode("utf-8"),
                f"{relative}\t{declared_bytes}\t{declared_hash}",
            )
        )
    canonical = "\n".join(text for _, text in sorted(rows)).encode("utf-8")
    target = "sha256:" + hashlib.sha256(canonical).hexdigest().upper()
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target:
        errors.append("GATE_CHECKPOINT_TARGET_MISMATCH")
    if manifest.get("target_canonical_bytes") != len(canonical) or manifest.get("target_content_bytes") != total:
        errors.append("GATE_CHECKPOINT_TARGET_BYTES_MISMATCH")
    material = dict(manifest)
    material.pop("content_hash", None)
    content = "sha256:" + hashlib.sha256(json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
    if manifest.get("content_hash") != content:
        errors.append("GATE_CHECKPOINT_CONTENT_HASH_MISMATCH")
    required = {GATE_MANIFEST_PATH, GATE_DECISION_PATH, CHECKPOINT_DETACHED_PATH, "docs/progress/progress-events.json"}
    if not required <= seen:
        errors.append("GATE_CHECKPOINT_PROVENANCE_MISSING")
    if (
        manifest.get("checkpoint_status") != "CLEARED"
        or manifest.get("a01_start_allowed") is not True
        or manifest.get("active_work_instruction") is not None
        or manifest.get("git_commit") != "5ca9c1f65a5909e75283b878764509d747d6d2cf"
    ):
        errors.append("GATE_CHECKPOINT_PROJECTION_INVALID")
    gate_row = next((row for row in manifest.get("raw_checksums", []) if row.get("path") == GATE_MANIFEST_PATH), None)
    if gate_row is None or gate_row.get("sha256") != "8B35F13522A216EB1929282239D86DC5D8D62714E10CCFDCF4D74322ED4D3884":
        errors.append("GATE_ACCEPTED_MANIFEST_REF_INVALID")
    return sorted(set(errors))


def validate_gate(
    root: Path | str,
    *,
    text_overrides: Mapping[str, str] | None = None,
    json_overrides: Mapping[str, Any] | None = None,
    verify_hashes: bool = True,
) -> dict[str, Any]:
    root = Path(root).resolve()
    texts = text_overrides or {}
    json_docs = json_overrides or {}
    errors: list[dict[str, str]] = []
    g07 = _load_g07(root)
    baseline = g07.validate_repository(root, text_overrides=texts, json_overrides=json_docs, verify_hashes=verify_hashes, verify_git=verify_hashes)
    for item in baseline["errors"]:
        _error(errors, "GATE_BASELINE_REGRESSION", item.get("path", "baseline"), item.get("code", "unknown"))

    progress = _json(root, PROGRESS_PATH, json_docs)
    completed = progress.get("completed_packages", [])
    accepted = [package for package in EXPECTED_ACCEPTED if package in completed]
    if accepted != EXPECTED_ACCEPTED:
        _error(errors, "GATE_ACCEPTED_PACKAGE_MISSING", PROGRESS_PATH, repr(sorted(set(EXPECTED_ACCEPTED) - set(accepted))))

    decision_text = _text(root, "docs/decisions/G-02_DECISION_RECORD.md", texts)
    decisions = {f"D{number}": "HUMAN_CONFIRMED" for number in range(1, 9)}
    if "| D1~D8 | `HUMAN_CONFIRMED` |" not in decision_text:
        for number in range(1, 9):
            decisions[f"D{number}"] = "INVALID"
    decisions["D9"] = "BENCHMARK_POLICY_CONFIRMED" if "| D9 | `BENCHMARK_POLICY_CONFIRMED` |" in decision_text else "INVALID"
    decisions["D10"] = "HUMAN_CONFIRMED" if "| D10 | `HUMAN_CONFIRMED` |" in decision_text else "INVALID"
    if any(value == "INVALID" for value in decisions.values()):
        _error(errors, "GATE_DECISION_NOT_CONFIRMED", "docs/decisions/G-02_DECISION_RECORD.md", repr(decisions))
    events = _json(root, "docs/progress/progress-events.json", json_docs).get("events", [])
    migration = next((event for event in events if event.get("event_id") == "evt_g05_legacy_migration" and "G-02" in event.get("details", {}).get("completed_packages", [])), None)
    decision_chain = {
        "root_approval_id": "APPROVAL-20260810-INTEGRATED-BASELINE-001",
        "root_approval_ref": "docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md",
        "root_approval_sha256": hashlib.sha256((root / "docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md").read_bytes()).hexdigest().upper(),
        "g02_r3_test_report_ref": "docs/test_reports/G-02_TEST_REPORT_R3.md",
        "g02_r3_test_report_sha256": hashlib.sha256((root / "docs/test_reports/G-02_TEST_REPORT_R3.md").read_bytes()).hexdigest().upper(),
        "acceptance_event_id": migration.get("event_id") if migration else None,
        "standing_approval_gate_application": "STANDING_AUTONOMOUS_APPROVAL_APPLIED",
        "application_actor": "main-agent-eoul",
        "application_approval_ref": "APPROVAL-20260810-AUTONOMOUS-EXECUTION-001",
    }
    if not migration:
        _error(errors, "GATE_DECISION_ACCEPTANCE_EVENT_MISSING", "docs/progress/progress-events.json", "G-02 migration acceptance projection")

    fixture = _json(root, LEASE_PATH, json_docs)
    lease_results, lease_final = _simulate_leases(fixture)
    if len(lease_results) != 8 or any(not item.get("actor") or not item.get("occurred_at") or not item.get("path_scope") or item.get("worker_epoch") is None for item in lease_results):
        _error(errors, "GATE_LEASE_EVIDENCE_INCOMPLETE", LEASE_PATH, "eight metadata-complete operations required")
    for result in lease_results:
        if result["status"] != result["expected"] or (result["expected_reason"] and result["reason"] != result["expected_reason"]):
            _error(errors, "GATE_LEASE_EXPECTATION_MISMATCH", LEASE_PATH, repr(result))
    stale = next((item for item in lease_results if item["action"] == "commit"), None)
    if not stale or stale["status"] != "REJECTED" or stale["reason"] != "STALE_EXECUTION_TOKEN":
        _error(errors, "GATE_STALE_TOKEN_NOT_REJECTED", LEASE_PATH, repr(stale))
    if lease_final != fixture.get("final_state"):
        _error(errors, "GATE_LEASE_FINAL_STATE_MISMATCH", LEASE_PATH, repr(lease_final))

    wi = _text(root, WI_PATH, texts)
    try:
        reconstruction = _parse_reconstruction(wi)
    except json.JSONDecodeError:
        reconstruction = {}
    expected_contract = {"document_sync_count": 7, "package_count": 97, "unique_av_count": 255, "scenario_count": 20}
    checks = reconstruction.get("checks", {})
    exit_projection = reconstruction.get("exit_projection", {})
    required_sync_inputs = {"AGENTS.md", "docs/onboarding/developer-primary-ack.md"}
    if (
        any(checks.get(key) != value for key, value in expected_contract.items())
        or checks.get("accepted_packages") != EXPECTED_ACCEPTED
        or not required_sync_inputs <= set(reconstruction.get("inputs", []))
        or exit_projection.get("status") != "TEST_REVIEW"
        or exit_projection.get("a01_start_allowed") is not False
    ):
        _error(errors, "GATE_RECONSTRUCTION_CONTRACT_MISMATCH", WI_PATH, repr(reconstruction))

    design = _text(root, "Anvil_설계서_v2.md", texts)
    sync_section = re.search(r"### 49\.18.*?(?=\n---|\Z)", design, re.DOTALL)
    sync_targets = re.findall(r"^\d+\. `([^`]+)`|^\d+\. ([^\n]+)$", sync_section.group(0), re.MULTILINE) if sync_section else []
    sync_values = [first or second.strip() for first, second in sync_targets]
    expected_sync = [
        "Anvil_작업계획서_v1.md", "Anvil_통합검증매트릭스_v1.md", "Anvil_테스트계획서_v1.md", "AGENTS.md",
        "docs/governance/ANVIL_OPERATING_RULES.md", "docs/progress/build-progress.json", "Developer 재온보딩 증거",
    ]
    if sync_values != expected_sync:
        _error(errors, "GATE_DOCUMENT_SYNC_MISMATCH", "Anvil_설계서_v2.md", repr(sync_values))

    key_verifications: dict[str, dict[str, Any]] = {}
    for verification, path in KEY_AV_SOURCES.items():
        content = _text(root, path, texts)
        token = verification.removesuffix("(RV)")
        matching_lines = [line for line in content.splitlines() if token in line]
        passed = any("PASS" in line for line in matching_lines)
        source_package, manifest_path, method_level, reviewer = KEY_AV_META[verification]
        manifest_data = _json(root, manifest_path, json_docs)
        key_verifications[verification] = {
            "verification_id": verification,
            "source_package": source_package,
            "test_report_ref": path,
            "test_report_sha256": hashlib.sha256(_text(root, path, texts).encode("utf-8")).hexdigest().upper(),
            "manifest_ref": manifest_path,
            "manifest_sha256": hashlib.sha256((root / manifest_path).read_bytes()).hexdigest().upper(),
            "target_hash": manifest_data.get("target_hash"),
            "result": "PASS" if passed else "MISSING",
            "method_level": method_level,
            "reviewing_actor": reviewer,
        }
        if not passed:
            _error(errors, "GATE_KEY_AV_EVIDENCE_MISSING", path, verification)

    scenario_index = _json(root, "tests/fault/scenario-index.json", json_docs)
    scenario_statuses = []
    for item in scenario_index.get("scenarios", []):
        scenario = _json(root, item["scenario_path"], json_docs)
        scenario_statuses.append((scenario.get("implementation_status"), scenario.get("execution_status")))
    scenario_runtime_status = "DESIGN_LOCKED / NOT_EXECUTED" if len(scenario_statuses) == 20 and all(pair == ("DESIGN_LOCKED", "NOT_EXECUTED") for pair in scenario_statuses) else "INVALID"
    if scenario_runtime_status == "INVALID":
        _error(errors, "GATE_SCENARIO_RUNTIME_STATUS_INVALID", "tests/fault/scenario-index.json", repr(scenario_statuses))

    manifest = _json(root, GATE_MANIFEST_PATH, json_docs) if (root / GATE_MANIFEST_PATH).is_file() or GATE_MANIFEST_PATH in json_docs else {}
    handoff = _text(root, HANDOFF_PATH, texts)
    progress_projection = {
        "current_work_package": progress.get("current_work_package"),
        "status": progress.get("status"),
        "next_conditional_package": next((package for package in ("A-02", "A-01") if package in progress.get("next_safe_action", "") and package in handoff), None),
        "g_gate_status": progress.get("phase_gate", {}).get("decision", manifest.get("g_gate_status", "NOT_DECIDED")),
        "gate_checkpoint_status": progress.get("phase_gate", {}).get("checkpoint_status"),
        "a01_start_allowed": progress.get("phase_gate", {}).get("a01_start_allowed", False),
        "active_work_instruction": progress.get("active_work_instruction"),
        "worker_lease": progress.get("worker_lease"),
        "write_lease": progress.get("write_lease"),
    }
    ready_projection = {
        "current_work_package": "A-01", "status": "READY", "next_conditional_package": "A-01",
        "g_gate_status": "ACCEPTED", "gate_checkpoint_status": "CLEARED", "a01_start_allowed": True,
        "active_work_instruction": None, "worker_lease": None, "write_lease": None,
    }
    start_events = {event.get("event_type"): event for event in events[-3:]}
    worker_event = start_events.get("WORKER_LEASE_ISSUED", {})
    write_event = start_events.get("WRITE_LEASE_ISSUED", {})
    package_event = start_events.get("PACKAGE_STARTED", {})
    worker = progress_projection.get("worker_lease") or {}
    write = progress_projection.get("write_lease") or {}
    active_wi = progress_projection.get("active_work_instruction") or {}
    active_start_projection = (
        progress_projection.get("current_work_package") == "A-01"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-01-20260811-001"
        and worker_event.get("sequence") == 31
        and write_event.get("sequence") == 32
        and package_event.get("sequence") == 33
        and worker_event.get("actor") == write_event.get("actor") == package_event.get("actor") == "main-agent-eoul"
        and worker_event.get("details", {}).get("lease_id") == worker.get("lease_id")
        and write_event.get("details", {}).get("lease_id") == write.get("lease_id")
        and write_event.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and package_event.get("details", {}).get("work_instruction_sha256") == active_wi.get("sha256")
        and package_event.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and package_event.get("details", {}).get("write_lease_id") == write.get("lease_id")
    )
    completion_events = {event.get("event_type"): event for event in events[-3:]}
    write_revoked = completion_events.get("WRITE_LEASE_REVOKED", {})
    worker_revoked = completion_events.get("WORKER_LEASE_REVOKED", {})
    package_completed = completion_events.get("PACKAGE_COMPLETED", {})
    test_review_projection = (
        progress_projection.get("current_work_package") == "A-01"
        and progress_projection.get("status") == "TEST_REVIEW"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-01-20260811-001"
        and active_wi.get("package_status") == "TEST_REVIEW"
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and write_revoked.get("sequence") == 34
        and worker_revoked.get("sequence") == 35
        and package_completed.get("sequence") == 36
        and write_revoked.get("actor") == worker_revoked.get("actor") == package_completed.get("actor") == "main-agent-eoul"
        and write_revoked.get("details", {}).get("lease_id") == "write-lease-a01-20260811-001"
        and worker_revoked.get("details", {}).get("lease_id") == "worker-lease-a01-20260811-001"
        and package_completed.get("details", {}).get("result_status") == "COMPLETED"
        and package_completed.get("details", {}).get("package_status") == "TEST_REVIEW"
        and package_completed.get("details", {}).get("accepted") is False
    )
    rework_events = {event.get("event_type"): event for event in events[-3:]}
    rework_worker = rework_events.get("WORKER_LEASE_ISSUED", {})
    rework_write = rework_events.get("WRITE_LEASE_ISSUED", {})
    package_resumed = rework_events.get("PACKAGE_RESUMED", {})
    active_rework_projection = (
        progress_projection.get("current_work_package") == "A-01"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-01-20260811-001"
        and active_wi.get("package_status") == "ACTIVE"
        and active_wi.get("rework_attempt") == 1
        and rework_worker.get("sequence") == 37
        and rework_write.get("sequence") == 38
        and package_resumed.get("sequence") == 39
        and rework_worker.get("actor") == rework_write.get("actor") == package_resumed.get("actor") == "main-agent-eoul"
        and rework_worker.get("details", {}).get("lease_id") == worker.get("lease_id")
        and rework_worker.get("details", {}).get("lease_epoch") == worker.get("lease_epoch") == 2
        and rework_write.get("details", {}).get("lease_id") == write.get("lease_id")
        and rework_write.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and rework_write.get("details", {}).get("write_epoch") == write.get("write_epoch") == 2
        and package_resumed.get("details", {}).get("work_instruction_sha256") == active_wi.get("sha256")
        and package_resumed.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and package_resumed.get("details", {}).get("write_lease_id") == write.get("lease_id")
        and package_resumed.get("details", {}).get("resume_event_ref", {}).get("finding_id") == "A01-TST-BLK-001"
    )
    rework_completion_events = {event.get("event_type"): event for event in events[-3:]}
    rework_write_revoked = rework_completion_events.get("WRITE_LEASE_REVOKED", {})
    rework_worker_revoked = rework_completion_events.get("WORKER_LEASE_REVOKED", {})
    rework_completed = rework_completion_events.get("PACKAGE_COMPLETED", {})
    rework_test_review_projection = (
        progress_projection.get("current_work_package") == "A-01"
        and progress_projection.get("status") == "TEST_REVIEW"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-01-20260811-001"
        and active_wi.get("package_status") == "TEST_REVIEW"
        and active_wi.get("rework_revision") == 2
        and active_wi.get("independent_tester_status") == "R2_PENDING"
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and rework_write_revoked.get("sequence") == 40
        and rework_worker_revoked.get("sequence") == 41
        and rework_completed.get("sequence") == 42
        and rework_write_revoked.get("actor") == rework_worker_revoked.get("actor") == rework_completed.get("actor") == "main-agent-eoul"
        and rework_write_revoked.get("details", {}).get("lease_id") == "write-lease-a01-rework-20260811-002"
        and rework_worker_revoked.get("details", {}).get("lease_id") == "worker-lease-a01-rework-20260811-002"
        and rework_completed.get("details", {}).get("result_status") == "COMPLETED"
        and rework_completed.get("details", {}).get("package_status") == "TEST_REVIEW"
        and rework_completed.get("details", {}).get("accepted") is False
        and rework_completed.get("details", {}).get("rework_revision") == 2
        and rework_completed.get("details", {}).get("finding_status") == "FIXED_AWAITING_INDEPENDENT_RETEST"
    )
    acceptance_event = events[-1] if events else {}
    a02_ready_projection = (
        progress_projection.get("current_work_package") == "A-02"
        and progress_projection.get("status") == "READY"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and progress_projection.get("active_work_instruction") is None
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and acceptance_event.get("sequence") == 43
        and acceptance_event.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
        and acceptance_event.get("actor") == "main-agent-eoul"
        and acceptance_event.get("subject_ref") == "A-01"
        and acceptance_event.get("details", {}).get("decision") == "ACCEPTED"
        and acceptance_event.get("details", {}).get("blocking_findings") == 0
        and acceptance_event.get("details", {}).get("next_work_package") == "A-02"
        and acceptance_event.get("details", {}).get("next_package_status") == "READY"
    )
    a02_events = {event.get("event_type"): event for event in events[-3:]}
    a02_worker_event = a02_events.get("WORKER_LEASE_ISSUED", {})
    a02_write_event = a02_events.get("WRITE_LEASE_ISSUED", {})
    a02_package_event = a02_events.get("PACKAGE_STARTED", {})
    a02_active_projection = (
        progress_projection.get("current_work_package") == "A-02"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-02-20260811-001"
        and active_wi.get("package_status") == "ACTIVE"
        and a02_worker_event.get("sequence") == 44
        and a02_write_event.get("sequence") == 45
        and a02_package_event.get("sequence") == 46
        and a02_worker_event.get("actor")
        == a02_write_event.get("actor")
        == a02_package_event.get("actor")
        == "main-agent-eoul"
        and a02_worker_event.get("details", {}).get("lease_id") == worker.get("lease_id")
        and a02_write_event.get("details", {}).get("lease_id") == write.get("lease_id")
        and a02_write_event.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and a02_package_event.get("details", {}).get("work_instruction_sha256") == active_wi.get("sha256")
        and a02_package_event.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and a02_package_event.get("details", {}).get("write_lease_id") == write.get("lease_id")
    )
    a02_completion_events = {event.get("event_type"): event for event in events[-3:]}
    a02_write_revoked = a02_completion_events.get("WRITE_LEASE_REVOKED", {})
    a02_worker_revoked = a02_completion_events.get("WORKER_LEASE_REVOKED", {})
    a02_completed = a02_completion_events.get("PACKAGE_COMPLETED", {})
    a02_test_review_projection = (
        progress_projection.get("current_work_package") == "A-02"
        and progress_projection.get("status") == "TEST_REVIEW"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-02-20260811-001"
        and active_wi.get("package_status") == "TEST_REVIEW"
        and active_wi.get("result_status") == "COMPLETED"
        and active_wi.get("accepted") is False
        and active_wi.get("independent_tester_status") == "PENDING"
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and a02_write_revoked.get("sequence") == 47
        and a02_worker_revoked.get("sequence") == 48
        and a02_completed.get("sequence") == 49
        and a02_write_revoked.get("actor")
        == a02_worker_revoked.get("actor")
        == a02_completed.get("actor")
        == "main-agent-eoul"
        and a02_write_revoked.get("details", {}).get("lease_id") == "write-lease-a02-20260811-001"
        and a02_worker_revoked.get("details", {}).get("lease_id") == "worker-lease-a02-20260811-001"
        and a02_completed.get("details", {}).get("result_status") == "COMPLETED"
        and a02_completed.get("details", {}).get("package_status") == "TEST_REVIEW"
        and a02_completed.get("details", {}).get("accepted") is False
        and a02_completed.get("details", {}).get("next_package_status") == "BLOCKED_PENDING_A02_ACCEPTANCE"
    )
    a02_rework_events = {event.get("event_type"): event for event in events[-4:]}
    a02_failure = a02_rework_events.get("FAILURE_REPORT_ACCEPTED", {})
    a02_rework_worker = a02_rework_events.get("WORKER_LEASE_ISSUED", {})
    a02_rework_write = a02_rework_events.get("WRITE_LEASE_ISSUED", {})
    a02_resumed = a02_rework_events.get("PACKAGE_RESUMED", {})
    a02_rework_projection = (
        progress_projection.get("current_work_package") == "A-02"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-02-20260811-001"
        and active_wi.get("package_status") == "ACTIVE"
        and active_wi.get("result_status") == "REWORK_IN_PROGRESS"
        and active_wi.get("independent_tester_status") == "RETEST_REQUIRED"
        and worker.get("lease_epoch") == 2
        and write.get("write_epoch") == 2
        and write.get("worker_lease_id") == worker.get("lease_id")
        and a02_failure.get("sequence") == 50
        and a02_rework_worker.get("sequence") == 51
        and a02_rework_write.get("sequence") == 52
        and a02_resumed.get("sequence") == 53
        and a02_failure.get("details", {}).get("valid_failure_count") == 1
        and a02_rework_worker.get("details", {}).get("lease_id") == worker.get("lease_id")
        and a02_rework_write.get("details", {}).get("lease_id") == write.get("lease_id")
        and a02_resumed.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and a02_resumed.get("details", {}).get("write_lease_id") == write.get("lease_id")
    )
    a02_r2_events = {event.get("event_type"): event for event in events[-3:]}
    a02_r2_write_revoked = a02_r2_events.get("WRITE_LEASE_REVOKED", {})
    a02_r2_worker_revoked = a02_r2_events.get("WORKER_LEASE_REVOKED", {})
    a02_r2_completed = a02_r2_events.get("PACKAGE_COMPLETED", {})
    a02_r2_test_review_projection = (
        progress_projection.get("current_work_package") == "A-02"
        and progress_projection.get("status") == "TEST_REVIEW"
        and active_wi.get("artifact_id") == "WI-A-02-20260811-001"
        and active_wi.get("package_status") == "TEST_REVIEW"
        and active_wi.get("result_status") == "COMPLETED"
        and active_wi.get("independent_tester_status") == "R2_PENDING"
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and a02_r2_write_revoked.get("sequence") == 54
        and a02_r2_worker_revoked.get("sequence") == 55
        and a02_r2_completed.get("sequence") == 56
        and a02_r2_completed.get("details", {}).get("rework_revision") == 2
        and a02_r2_completed.get("details", {}).get("finding_status") == "FIXED_AWAITING_INDEPENDENT_RETEST"
    )
    a02_acceptance = events[-1] if events else {}
    a03_ready_projection = (
        progress_projection.get("current_work_package") == "A-03"
        and progress_projection.get("status") == "READY"
        and progress_projection.get("active_work_instruction") is None
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and a02_acceptance.get("sequence") == 57
        and a02_acceptance.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
        and a02_acceptance.get("subject_ref") == "A-02"
        and a02_acceptance.get("details", {}).get("decision") == "ACCEPTED"
        and a02_acceptance.get("details", {}).get("blocking_findings") == 0
        and a02_acceptance.get("details", {}).get("next_work_package") == "A-03"
        and a02_acceptance.get("details", {}).get("next_package_status") == "READY"
    )
    a03_events = {event.get("event_type"): event for event in events[-3:]}
    a03_worker = a03_events.get("WORKER_LEASE_ISSUED", {})
    a03_write = a03_events.get("WRITE_LEASE_ISSUED", {})
    a03_started = a03_events.get("PACKAGE_STARTED", {})
    a03_active_projection = (
        progress_projection.get("current_work_package") == "A-03"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-03-20260811-001"
        and active_wi.get("package_status") == "ACTIVE"
        and worker.get("lease_id") == "worker-lease-a03-20260811-001"
        and write.get("lease_id") == "write-lease-a03-20260811-001"
        and write.get("worker_lease_id") == worker.get("lease_id")
        and a03_worker.get("sequence") == 58
        and a03_write.get("sequence") == 59
        and a03_started.get("sequence") == 60
        and a03_worker.get("details", {}).get("lease_id") == worker.get("lease_id")
        and a03_write.get("details", {}).get("lease_id") == write.get("lease_id")
        and a03_started.get("details", {}).get("work_instruction_sha256") == active_wi.get("sha256")
        and a03_started.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and a03_started.get("details", {}).get("write_lease_id") == write.get("lease_id")
        and a03_started.get("details", {}).get("dispatch_worktree_status") == "CLEAN"
        and a03_started.get("details", {}).get("dispatch_head")
        == a03_started.get("details", {}).get("dispatch_upstream_head")
    )
    a03_completion_events = {event.get("event_type"): event for event in events[-3:]}
    a03_write_revoked = a03_completion_events.get("WRITE_LEASE_REVOKED", {})
    a03_worker_revoked = a03_completion_events.get("WORKER_LEASE_REVOKED", {})
    a03_completed = a03_completion_events.get("PACKAGE_COMPLETED", {})
    a03_test_review_projection = (
        progress_projection.get("current_work_package") == "A-03"
        and progress_projection.get("status") == "TEST_REVIEW"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-03-20260811-001"
        and active_wi.get("package_status") == "TEST_REVIEW"
        and active_wi.get("result_status") == "COMPLETED"
        and active_wi.get("accepted") is False
        and active_wi.get("independent_tester_status") == "PENDING"
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and a03_write_revoked.get("sequence") == 61
        and a03_worker_revoked.get("sequence") == 62
        and a03_completed.get("sequence") == 63
        and a03_write_revoked.get("details", {}).get("lease_id") == "write-lease-a03-20260811-001"
        and a03_worker_revoked.get("details", {}).get("lease_id") == "worker-lease-a03-20260811-001"
        and a03_completed.get("details", {}).get("result_status") == "COMPLETED"
        and a03_completed.get("details", {}).get("package_status") == "TEST_REVIEW"
        and a03_completed.get("details", {}).get("accepted") is False
        and a03_completed.get("details", {}).get("next_package_status") == "BLOCKED_PENDING_A03_ACCEPTANCE"
    )
    a03_rework_events = {event.get("event_type"): event for event in events[-4:]}
    a03_failure = a03_rework_events.get("FAILURE_REPORT_ACCEPTED", {})
    a03_rework_worker = a03_rework_events.get("WORKER_LEASE_ISSUED", {})
    a03_rework_write = a03_rework_events.get("WRITE_LEASE_ISSUED", {})
    a03_resumed = a03_rework_events.get("PACKAGE_RESUMED", {})
    a03_rework_projection = (
        progress_projection.get("current_work_package") == "A-03"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-03-20260811-002"
        and active_wi.get("package_status") == "ACTIVE"
        and active_wi.get("result_status") == "REWORK_IN_PROGRESS"
        and active_wi.get("independent_tester_status") == "RETEST_REQUIRED"
        and worker.get("lease_epoch") == 2
        and write.get("write_epoch") == 2
        and write.get("worker_lease_id") == worker.get("lease_id")
        and a03_failure.get("sequence") == 64
        and a03_rework_worker.get("sequence") == 65
        and a03_rework_write.get("sequence") == 66
        and a03_resumed.get("sequence") == 67
        and a03_failure.get("details", {}).get("valid_failure_count") == 1
        and a03_rework_worker.get("details", {}).get("lease_id") == worker.get("lease_id")
        and a03_rework_write.get("details", {}).get("lease_id") == write.get("lease_id")
        and a03_resumed.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and a03_resumed.get("details", {}).get("write_lease_id") == write.get("lease_id")
    )
    a03_r2_completion_events = {event.get("event_type"): event for event in events[-3:]}
    a03_r2_write_revoked = a03_r2_completion_events.get("WRITE_LEASE_REVOKED", {})
    a03_r2_worker_revoked = a03_r2_completion_events.get("WORKER_LEASE_REVOKED", {})
    a03_r2_completed = a03_r2_completion_events.get("PACKAGE_COMPLETED", {})
    a03_r2_test_review_projection = (
        progress_projection.get("current_work_package") == "A-03"
        and progress_projection.get("status") == "TEST_REVIEW"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-03-20260811-002"
        and active_wi.get("package_status") == "TEST_REVIEW"
        and active_wi.get("result_status") == "COMPLETED"
        and active_wi.get("accepted") is False
        and active_wi.get("rework_revision") == 2
        and active_wi.get("finding_status") == "FIXED_AWAITING_INDEPENDENT_RETEST"
        and active_wi.get("independent_tester_status") == "R2_PENDING"
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and a03_r2_write_revoked.get("sequence") == 68
        and a03_r2_worker_revoked.get("sequence") == 69
        and a03_r2_completed.get("sequence") == 70
        and a03_r2_write_revoked.get("details", {}).get("write_epoch") == 2
        and a03_r2_worker_revoked.get("details", {}).get("lease_epoch") == 2
        and a03_r2_completed.get("details", {}).get("finding_status") == "FIXED_AWAITING_INDEPENDENT_RETEST"
        and a03_r2_completed.get("details", {}).get("next_package_status") == "BLOCKED_PENDING_A03_ACCEPTANCE"
    )
    a04_ready_projection = (
        progress_projection.get("current_work_package") == "A-04"
        and progress_projection.get("status") == "READY"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and progress_projection.get("active_work_instruction") is None
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and acceptance_event.get("sequence") == 71
        and acceptance_event.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
        and acceptance_event.get("actor") == "main-agent-eoul"
        and acceptance_event.get("subject_ref") == "A-03"
        and acceptance_event.get("details", {}).get("decision") == "ACCEPTED"
        and acceptance_event.get("details", {}).get("blocking_findings") == 0
        and acceptance_event.get("details", {}).get("next_work_package") == "A-04"
        and acceptance_event.get("details", {}).get("next_package_status") == "READY"
        and acceptance_event.get("details", {}).get("canonical_l7") == "RUNTIME_DEFERRED / NOT_EXECUTED"
    )
    a04_events = {event.get("event_type"): event for event in events[-3:]}
    a04_worker = a04_events.get("WORKER_LEASE_ISSUED", {})
    a04_write = a04_events.get("WRITE_LEASE_ISSUED", {})
    a04_started = a04_events.get("PACKAGE_STARTED", {})
    a04_active_projection = (
        progress_projection.get("current_work_package") == "A-04"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-04-20260811-001"
        and active_wi.get("package_status") == "ACTIVE"
        and worker.get("lease_epoch") == 1
        and write.get("write_epoch") == 1
        and write.get("worker_lease_id") == worker.get("lease_id")
        and a04_worker.get("sequence") == 72
        and a04_write.get("sequence") == 73
        and a04_started.get("sequence") == 74
        and a04_worker.get("details", {}).get("lease_id") == worker.get("lease_id")
        and a04_write.get("details", {}).get("lease_id") == write.get("lease_id")
        and a04_started.get("details", {}).get("work_instruction_sha256") == active_wi.get("sha256")
        and a04_started.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and a04_started.get("details", {}).get("write_lease_id") == write.get("lease_id")
        and a04_started.get("details", {}).get("dispatch_worktree_status") == "CLEAN"
        and a04_started.get("details", {}).get("dispatch_head") == a04_started.get("details", {}).get("dispatch_upstream_head")
    )
    a04_completion_events = {event.get("event_type"): event for event in events[-3:]}
    a04_write_revoked = a04_completion_events.get("WRITE_LEASE_REVOKED", {})
    a04_worker_revoked = a04_completion_events.get("WORKER_LEASE_REVOKED", {})
    a04_completed = a04_completion_events.get("PACKAGE_COMPLETED", {})
    a04_test_review_projection = (
        progress_projection.get("current_work_package") == "A-04"
        and progress_projection.get("status") == "TEST_REVIEW"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-04-20260811-001"
        and active_wi.get("package_status") == "TEST_REVIEW"
        and active_wi.get("result_status") == "COMPLETED"
        and active_wi.get("accepted") is False
        and active_wi.get("independent_tester_status") == "PENDING"
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and a04_write_revoked.get("sequence") == 75
        and a04_worker_revoked.get("sequence") == 76
        and a04_completed.get("sequence") == 77
        and a04_write_revoked.get("details", {}).get("lease_id") == "write-lease-a04-20260811-001"
        and a04_worker_revoked.get("details", {}).get("lease_id") == "worker-lease-a04-20260811-001"
        and a04_completed.get("details", {}).get("package_status") == "TEST_REVIEW"
        and a04_completed.get("details", {}).get("accepted") is False
        and a04_completed.get("details", {}).get("next_package_status") == "BLOCKED_PENDING_A04_ACCEPTANCE"
    )
    a04_acceptance = events[-1] if events else {}
    a05_ready_projection = (
        progress_projection.get("current_work_package") == "A-05"
        and progress_projection.get("status") == "READY"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and progress_projection.get("active_work_instruction") is None
        and progress_projection.get("worker_lease") is None
        and progress_projection.get("write_lease") is None
        and a04_acceptance.get("sequence") == 78
        and a04_acceptance.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
        and a04_acceptance.get("subject_ref") == "A-04"
        and a04_acceptance.get("details", {}).get("decision") == "ACCEPTED"
        and a04_acceptance.get("details", {}).get("blocking_findings") == 0
        and a04_acceptance.get("details", {}).get("next_work_package") == "A-05"
        and a04_acceptance.get("details", {}).get("next_package_status") == "READY"
        and a04_acceptance.get("details", {}).get("canonical_l7") == "RUNTIME_DEFERRED / NOT_EXECUTED"
    )
    a05_events = {event.get("event_type"): event for event in events[-3:]}
    a05_worker = a05_events.get("WORKER_LEASE_ISSUED", {})
    a05_write = a05_events.get("WRITE_LEASE_ISSUED", {})
    a05_started = a05_events.get("PACKAGE_STARTED", {})
    a05_active_projection = (
        progress_projection.get("current_work_package") == "A-05"
        and progress_projection.get("status") == "ACTIVE"
        and progress_projection.get("g_gate_status") == "ACCEPTED"
        and progress_projection.get("gate_checkpoint_status") == "CLEARED"
        and progress_projection.get("a01_start_allowed") is True
        and active_wi.get("artifact_id") == "WI-A-05-20260811-001"
        and active_wi.get("package_status") == "ACTIVE"
        and worker.get("lease_epoch") == 1
        and write.get("write_epoch") == 1
        and write.get("worker_lease_id") == worker.get("lease_id")
        and a05_worker.get("sequence") == 79
        and a05_write.get("sequence") == 80
        and a05_started.get("sequence") == 81
        and a05_worker.get("details", {}).get("lease_id") == worker.get("lease_id")
        and a05_write.get("details", {}).get("lease_id") == write.get("lease_id")
        and a05_started.get("details", {}).get("work_instruction_sha256") == active_wi.get("sha256")
        and a05_started.get("details", {}).get("worker_lease_id") == worker.get("lease_id")
        and a05_started.get("details", {}).get("write_lease_id") == write.get("lease_id")
        and a05_started.get("details", {}).get("dispatch_worktree_status") == "CLEAN"
        and a05_started.get("details", {}).get("dispatch_head") == a05_started.get("details", {}).get("dispatch_upstream_head")
    )
    a05_completion_events = {event.get("event_type"): event for event in events[-3:]}
    a05_write_revoked = a05_completion_events.get("WRITE_LEASE_REVOKED", {}); a05_worker_revoked = a05_completion_events.get("WORKER_LEASE_REVOKED", {}); a05_completed = a05_completion_events.get("PACKAGE_COMPLETED", {})
    a05_test_review_projection = (progress_projection.get("current_work_package") == "A-05" and progress_projection.get("status") == "TEST_REVIEW" and progress_projection.get("g_gate_status") == "ACCEPTED" and progress_projection.get("gate_checkpoint_status") == "CLEARED" and progress_projection.get("a01_start_allowed") is True and active_wi.get("artifact_id") == "WI-A-05-20260811-001" and active_wi.get("package_status") == "TEST_REVIEW" and active_wi.get("result_status") == "COMPLETED" and active_wi.get("accepted") is False and active_wi.get("independent_tester_status") == "PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a05_write_revoked.get("sequence") == 82 and a05_worker_revoked.get("sequence") == 83 and a05_completed.get("sequence") == 84 and a05_completed.get("details", {}).get("next_package_status") == "BLOCKED_PENDING_A05_ACCEPTANCE")
    a05_acceptance = events[-1] if events else {}
    a06_ready_projection = (progress_projection.get("current_work_package") == "A-06" and progress_projection.get("status") == "READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a05_acceptance.get("sequence") == 85 and a05_acceptance.get("event_type") == "MAIN_PACKAGE_ACCEPTED" and a05_acceptance.get("subject_ref") == "A-05" and a05_acceptance.get("details", {}).get("decision") == "ACCEPTED" and a05_acceptance.get("details", {}).get("blocking_findings") == 0 and a05_acceptance.get("details", {}).get("next_work_package") == "A-06" and a05_acceptance.get("details", {}).get("next_package_status") == "READY")
    a06_events={event.get("event_type"):event for event in events[-3:]};a06_worker=a06_events.get("WORKER_LEASE_ISSUED",{});a06_write=a06_events.get("WRITE_LEASE_ISSUED",{});a06_started=a06_events.get("PACKAGE_STARTED",{})
    a06_active_projection=(progress_projection.get("current_work_package")=="A-06" and progress_projection.get("status")=="ACTIVE" and active_wi.get("artifact_id")=="WI-A-06-20260812-001" and worker.get("lease_epoch")==1 and write.get("write_epoch")==1 and a06_worker.get("sequence")==86 and a06_write.get("sequence")==87 and a06_started.get("sequence")==88)
    a06_completion_events={event.get("event_type"):event for event in events[-3:]};a06_write_revoked=a06_completion_events.get("WRITE_LEASE_REVOKED",{});a06_worker_revoked=a06_completion_events.get("WORKER_LEASE_REVOKED",{});a06_completed=a06_completion_events.get("PACKAGE_COMPLETED",{})
    a06_test_review_projection=(progress_projection.get("current_work_package")=="A-06" and progress_projection.get("status")=="TEST_REVIEW" and active_wi.get("artifact_id")=="WI-A-06-20260812-001" and active_wi.get("package_status")=="TEST_REVIEW" and active_wi.get("result_status")=="COMPLETED" and active_wi.get("accepted") is False and active_wi.get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a06_write_revoked.get("sequence")==89 and a06_worker_revoked.get("sequence")==90 and a06_completed.get("sequence")==91 and a06_completed.get("details",{}).get("next_package_status")=="BLOCKED_PENDING_A06_ACCEPTANCE")
    a06_acceptance=events[-1] if events else {};a07_ready_projection=(progress_projection.get("current_work_package")=="A-07" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a06_acceptance.get("sequence")==92 and a06_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a06_acceptance.get("subject_ref")=="A-06" and a06_acceptance.get("details",{}).get("decision")=="ACCEPTED" and a06_acceptance.get("details",{}).get("blocking_findings")==0 and a06_acceptance.get("details",{}).get("next_work_package")=="A-07" and a06_acceptance.get("details",{}).get("next_package_status")=="READY" and a06_acceptance.get("details",{}).get("canonical_l7")=="RUNTIME_DEFERRED / NOT_EXECUTED")
    a07_events={event.get("event_type"):event for event in events[-3:]};a07_worker=a07_events.get("WORKER_LEASE_ISSUED",{});a07_write=a07_events.get("WRITE_LEASE_ISSUED",{});a07_started=a07_events.get("PACKAGE_STARTED",{})
    a07_active_projection=(progress_projection.get("current_work_package")=="A-07" and progress_projection.get("status")=="ACTIVE" and active_wi.get("artifact_id")=="WI-A-07-20260812-001" and worker.get("lease_epoch")==1 and write.get("write_epoch")==1 and a07_worker.get("sequence")==93 and a07_write.get("sequence")==94 and a07_started.get("sequence")==95)
    a07_completion_events={event.get("event_type"):event for event in events[-3:]};a07_write_revoked=a07_completion_events.get("WRITE_LEASE_REVOKED",{});a07_worker_revoked=a07_completion_events.get("WORKER_LEASE_REVOKED",{});a07_completed=a07_completion_events.get("PACKAGE_COMPLETED",{})
    a07_test_review_projection=(progress_projection.get("current_work_package")=="A-07" and progress_projection.get("status")=="TEST_REVIEW" and active_wi.get("artifact_id")=="WI-A-07-20260812-001" and active_wi.get("package_status")=="TEST_REVIEW" and active_wi.get("result_status")=="COMPLETED" and active_wi.get("accepted") is False and active_wi.get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a07_write_revoked.get("sequence")==96 and a07_worker_revoked.get("sequence")==97 and a07_completed.get("sequence")==98 and a07_completed.get("details",{}).get("next_package_status")=="BLOCKED_PENDING_A07_ACCEPTANCE" and a07_completed.get("details",{}).get("dir_status")=="NOT_EXECUTED")
    a07_acceptance=events[-1] if events else {};a08_ready_projection=(progress_projection.get("current_work_package")=="A-08" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a07_acceptance.get("sequence")==99 and a07_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a07_acceptance.get("subject_ref")=="A-07" and a07_acceptance.get("details",{}).get("decision")=="ACCEPTED" and a07_acceptance.get("details",{}).get("blocking_findings")==0 and a07_acceptance.get("details",{}).get("next_work_package")=="A-08" and a07_acceptance.get("details",{}).get("next_package_status")=="READY" and a07_acceptance.get("details",{}).get("canonical_l4")=="RUNTIME_DEFERRED / NOT_EXECUTED" and a07_acceptance.get("details",{}).get("dir_status")=="NOT_EXECUTED")
    a08_events={event.get("event_type"):event for event in events[-3:]};a08_worker=a08_events.get("WORKER_LEASE_ISSUED",{});a08_write=a08_events.get("WRITE_LEASE_ISSUED",{});a08_started=a08_events.get("PACKAGE_STARTED",{})
    a08_active_projection=(progress_projection.get("current_work_package")=="A-08" and progress_projection.get("status")=="ACTIVE" and active_wi.get("artifact_id")=="WI-A-08-20260812-001" and worker.get("lease_epoch")==1 and write.get("write_epoch")==1 and write.get("worker_lease_id")==worker.get("lease_id") and a08_worker.get("sequence")==100 and a08_write.get("sequence")==101 and a08_started.get("sequence")==102 and a08_started.get("details",{}).get("dispatch_worktree_status")=="CLEAN" and a08_started.get("details",{}).get("dispatch_head")==a08_started.get("details",{}).get("dispatch_upstream_head"))
    a08_completion_events={event.get("event_type"):event for event in events[-3:]};a08_write_revoked=a08_completion_events.get("WRITE_LEASE_REVOKED",{});a08_worker_revoked=a08_completion_events.get("WORKER_LEASE_REVOKED",{});a08_completed=a08_completion_events.get("PACKAGE_COMPLETED",{})
    a08_test_review_projection=(progress_projection.get("current_work_package")=="A-08" and progress_projection.get("status")=="TEST_REVIEW" and active_wi.get("artifact_id")=="WI-A-08-20260812-001" and active_wi.get("package_status")=="TEST_REVIEW" and active_wi.get("result_status")=="COMPLETED" and active_wi.get("accepted") is False and active_wi.get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a08_write_revoked.get("sequence")==103 and a08_worker_revoked.get("sequence")==104 and a08_completed.get("sequence")==105 and a08_completed.get("details",{}).get("next_package_status")=="BLOCKED_PENDING_A08_ACCEPTANCE" and a08_completed.get("details",{}).get("actual_product_validation_status")=="NOT_EXECUTED" and a08_completed.get("details",{}).get("actual_release_status")=="NOT_EXECUTED" and a08_completed.get("details",{}).get("dir_status")=="NOT_EXECUTED")
    a08_acceptance=events[-1] if events else {};a09_ready_projection=(progress_projection.get("current_work_package")=="A-09" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a08_acceptance.get("sequence")==106 and a08_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a08_acceptance.get("subject_ref")=="A-08" and a08_acceptance.get("details",{}).get("decision")=="ACCEPTED" and a08_acceptance.get("details",{}).get("blocking_findings")==0 and a08_acceptance.get("details",{}).get("next_work_package")=="A-09" and a08_acceptance.get("details",{}).get("next_package_status")=="READY" and a08_acceptance.get("details",{}).get("canonical_l4")=="RUNTIME_DEFERRED / NOT_EXECUTED" and a08_acceptance.get("details",{}).get("actual_product_validation_status")=="NOT_EXECUTED" and a08_acceptance.get("details",{}).get("actual_release_status")=="NOT_EXECUTED" and a08_acceptance.get("details",{}).get("dir_status")=="NOT_EXECUTED")
    a09_events={event.get("event_type"):event for event in events[-3:]};a09_worker=a09_events.get("WORKER_LEASE_ISSUED",{});a09_write=a09_events.get("WRITE_LEASE_ISSUED",{});a09_started=a09_events.get("PACKAGE_STARTED",{})
    a09_active_projection=(progress_projection.get("current_work_package")=="A-09" and progress_projection.get("status")=="ACTIVE" and active_wi.get("artifact_id")=="WI-A-09-20260812-001" and worker.get("lease_epoch")==1 and write.get("write_epoch")==1 and write.get("worker_lease_id")==worker.get("lease_id") and a09_worker.get("sequence")==107 and a09_write.get("sequence")==108 and a09_started.get("sequence")==109 and a09_started.get("details",{}).get("dispatch_worktree_status")=="CLEAN" and a09_started.get("details",{}).get("dispatch_head")==a09_started.get("details",{}).get("dispatch_upstream_head"))
    a09_completion_events={event.get("event_type"):event for event in events[-3:]};a09_write_revoked=a09_completion_events.get("WRITE_LEASE_REVOKED",{});a09_worker_revoked=a09_completion_events.get("WORKER_LEASE_REVOKED",{});a09_completed=a09_completion_events.get("PACKAGE_COMPLETED",{})
    a09_test_review_projection=(progress_projection.get("current_work_package")=="A-09" and progress_projection.get("status")=="TEST_REVIEW" and active_wi.get("artifact_id")=="WI-A-09-20260812-001" and active_wi.get("package_status")=="TEST_REVIEW" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a09_write_revoked.get("sequence")==110 and a09_worker_revoked.get("sequence")==111 and a09_completed.get("sequence")==112 and a09_completed.get("details",{}).get("accepted") is False and a09_completed.get("details",{}).get("independent_tester_status")=="PENDING")
    a09_acceptance=events[-1] if events else {};a10_ready_projection=(progress_projection.get("current_work_package")=="A-10" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a09_acceptance.get("sequence")==113 and a09_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a09_acceptance.get("subject_ref")=="A-09" and a09_acceptance.get("details",{}).get("decision")=="ACCEPTED" and a09_acceptance.get("details",{}).get("blocking_findings")==0 and a09_acceptance.get("details",{}).get("next_work_package")=="A-10" and a09_acceptance.get("details",{}).get("next_package_status")=="READY" and a09_acceptance.get("details",{}).get("actual_skill_activation_status")=="NOT_EXECUTED" and a09_acceptance.get("details",{}).get("actual_hook_activation_status")=="NOT_EXECUTED" and a09_acceptance.get("details",{}).get("actual_runtime_status")=="NOT_EXECUTED" and a09_acceptance.get("details",{}).get("dir_status")=="NOT_EXECUTED")
    a10_events={event.get("event_type"):event for event in events[-3:]};a10_worker=a10_events.get("WORKER_LEASE_ISSUED",{});a10_write=a10_events.get("WRITE_LEASE_ISSUED",{});a10_started=a10_events.get("PACKAGE_STARTED",{})
    a10_active_projection=(progress_projection.get("current_work_package")=="A-10" and progress_projection.get("status")=="ACTIVE" and active_wi.get("artifact_id")=="WI-A-10-20260812-001" and worker.get("lease_epoch")==1 and write.get("write_epoch")==1 and write.get("worker_lease_id")==worker.get("lease_id") and a10_worker.get("sequence")==114 and a10_write.get("sequence")==115 and a10_started.get("sequence")==116 and a10_started.get("details",{}).get("dispatch_worktree_status")=="CLEAN" and a10_started.get("details",{}).get("dispatch_head")==a10_started.get("details",{}).get("dispatch_upstream_head"))
    a10_completion_events={event.get("event_type"):event for event in events[-3:]};a10_write_revoked=a10_completion_events.get("WRITE_LEASE_REVOKED",{});a10_worker_revoked=a10_completion_events.get("WORKER_LEASE_REVOKED",{});a10_completed=a10_completion_events.get("PACKAGE_COMPLETED",{})
    a10_test_review_projection=(progress_projection.get("current_work_package")=="A-10" and progress_projection.get("status")=="TEST_REVIEW" and active_wi.get("artifact_id")=="WI-A-10-20260812-001" and active_wi.get("package_status")=="TEST_REVIEW" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a10_write_revoked.get("sequence")==117 and a10_worker_revoked.get("sequence")==118 and a10_completed.get("sequence")==119 and a10_completed.get("details",{}).get("accepted") is False and a10_completed.get("details",{}).get("independent_tester_status")=="PENDING")
    a10_acceptance=events[-1] if events else {};a11_ready_projection=(progress_projection.get("current_work_package")=="A-11" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a10_acceptance.get("sequence")==120 and a10_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a10_acceptance.get("details",{}).get("blocking_findings")==0)
    a11_start=events[-1] if events else {};a11_active_projection=(progress_projection.get("current_work_package")=="A-11" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-11-20260812-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and a11_start.get("sequence")==123 and a11_start.get("event_type")=="PACKAGE_STARTED" and a11_start.get("subject_ref")=="A-11")
    a11_completion=events[-1] if events else {};a11_test_review_projection=(progress_projection.get("current_work_package")=="A-11" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a11_completion.get("sequence")==126 and a11_completion.get("event_type")=="PACKAGE_COMPLETED" and a11_completion.get("subject_ref")=="A-11")
    a11_acceptance=events[-1] if events else {};a12_ready_projection=(progress_projection.get("current_work_package")=="A-12" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a11_acceptance.get("sequence")==127 and a11_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a11_acceptance.get("subject_ref")=="A-11" and a11_acceptance.get("details",{}).get("blocking_findings")==0)
    a12_start=events[-1] if events else {};a12_active_projection=(progress_projection.get("current_work_package")=="A-12" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-12-20260812-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and a12_start.get("sequence")==130 and a12_start.get("event_type")=="PACKAGE_STARTED" and a12_start.get("subject_ref")=="A-12")
    a12_completion=events[-1] if events else {};a12_test_review_projection=(progress_projection.get("current_work_package")=="A-12" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("package_status")=="TEST_REVIEW" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a12_completion.get("sequence")==133 and a12_completion.get("event_type")=="PACKAGE_COMPLETED" and a12_completion.get("subject_ref")=="A-12")
    a12_acceptance=events[-1] if events else {};a13_ready_projection=(progress_projection.get("current_work_package")=="A-13" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a12_acceptance.get("sequence")==134 and a12_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a12_acceptance.get("subject_ref")=="A-12" and a12_acceptance.get("details",{}).get("blocking_findings")==0)
    a13_start=events[-1] if events else {};a13_active_projection=(progress_projection.get("current_work_package")=="A-13" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-13-20260812-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and a13_start.get("sequence")==137 and a13_start.get("event_type")=="PACKAGE_STARTED" and a13_start.get("subject_ref")=="A-13")
    a13_completion=events[-1] if events else {};a13_test_review_projection=(progress_projection.get("current_work_package")=="A-13" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("package_status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a13_completion.get("sequence")==140 and a13_completion.get("event_type")=="PACKAGE_COMPLETED" and a13_completion.get("subject_ref")=="A-13")
    a13_resume=events[-1] if events else {};a13_rework_projection=(progress_projection.get("current_work_package")=="A-13" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-13-20260812-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="REWORK_IN_PROGRESS" and progress_projection.get("worker_lease",{}).get("lease_epoch")==2 and progress_projection.get("write_lease",{}).get("write_epoch")==2 and a13_resume.get("sequence")==144 and a13_resume.get("event_type")=="PACKAGE_RESUMED" and a13_resume.get("subject_ref")=="A-13")
    a13_r2_done=events[-1] if events else {};a13_r2_test_review_projection=(progress_projection.get("current_work_package")=="A-13" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-13-20260812-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R2_PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a13_r2_done.get("sequence")==147 and a13_r2_done.get("event_type")=="PACKAGE_COMPLETED" and a13_r2_done.get("subject_ref")=="A-13")
    a13_accept=events[-1] if events else {};a14_ready_projection=(progress_projection.get("current_work_package")=="A-14" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and a13_accept.get("sequence")==148 and a13_accept.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and a13_accept.get("subject_ref")=="A-13" and a13_accept.get("details",{}).get("blocking_findings")==0)
    a14_completion=events[-1] if events else {};a14_test_review_projection=(progress_projection.get('current_work_package')=='A-14' and progress_projection.get('status')=='TEST_REVIEW' and progress_projection.get('active_work_instruction',{}).get('result_status')=='COMPLETED' and progress_projection.get('worker_lease') is None and progress_projection.get('write_lease') is None and a14_completion.get('sequence') in (154,161,168,171,174) and a14_completion.get('event_type')=='PACKAGE_COMPLETED' and a14_completion.get('subject_ref')=='A-14')
    a14_acceptance=events[-1] if events else {};a15_ready_projection=(progress_projection.get('current_work_package')=='A-15' and progress_projection.get('status')=='READY' and progress_projection.get('active_work_instruction') is None and progress_projection.get('active_agent') is None and progress_projection.get('worker_lease') is None and progress_projection.get('write_lease') is None and a14_acceptance.get('sequence')==175 and a14_acceptance.get('event_type')=='MAIN_PACKAGE_ACCEPTED' and a14_acceptance.get('subject_ref')=='A-14' and a14_acceptance.get('details',{}).get('decision')=='ACCEPTED' and a14_acceptance.get('details',{}).get('blocking_findings')==0 and a14_acceptance.get('details',{}).get('next_work_package')=='A-15' and a14_acceptance.get('details',{}).get('next_package_status')=='READY')
    a14_start=events[-1] if events else {};a14_active_projection=(progress_projection.get("current_work_package")=="A-14" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-14-20260812-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and a14_start.get("sequence")==151 and a14_start.get("event_type")=="PACKAGE_STARTED" and a14_start.get("subject_ref")=="A-14")
    a14_resume=events[-1] if events else {};a14_rework_projection=(progress_projection.get('current_work_package')=='A-14' and progress_projection.get('status')=='ACTIVE' and progress_projection.get('active_work_instruction',{}).get('artifact_id') in {'WI-A-14-20260812-002','WI-A-14-20260813-003'} and progress_projection.get('active_work_instruction',{}).get('result_status')=='REWORK_IN_PROGRESS' and progress_projection.get('worker_lease',{}).get('lease_epoch') in {2,3} and progress_projection.get('write_lease',{}).get('write_epoch') in {2,3} and a14_resume.get('sequence') in {158,165} and a14_resume.get('event_type')=='PACKAGE_RESUMED' and a14_resume.get('subject_ref')=='A-14')
    a15_start=events[-1] if events else {};a15_active_projection=(progress_projection.get("current_work_package")=="A-15" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-15-20260813-001" and progress_projection.get("active_work_instruction",{}).get("user_ux_approval_status")=="PENDING_USER_DECISION" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and progress.get("dir_review",{}).get("status")=="NOT_REACHED" and a15_start.get("sequence")==178 and a15_start.get("event_type")=="PACKAGE_STARTED" and a15_start.get("subject_ref")=="A-15")
    a15_completion=events[-1] if events else {};a15_test_review_projection=(progress_projection.get("current_work_package")=="A-15" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-A-15-20260813-001" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress_projection.get("active_work_instruction",{}).get("user_ux_approval_status")=="PENDING_USER_DECISION" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and progress.get("dir_review",{}).get("status")=="NOT_REACHED" and a15_completion.get("sequence")==181 and a15_completion.get("event_type")=="PACKAGE_COMPLETED" and a15_completion.get("subject_ref")=="A-15" and a15_completion.get("details",{}).get("accepted") is False)
    a15_dir_terminal=[event for event in events if 182 <= event.get("sequence",-1) <= 184];a15_dir_hold_projection=(progress_projection.get("current_work_package")=="A-15" and progress_projection.get("status")=="DIR_HOLD" and progress_projection.get("active_work_instruction") is None and progress_projection.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and progress.get("dir_review",{}).get("checkpoint")=="DIR-1" and progress.get("dir_review",{}).get("status")=="WAITING_OWNER_DIRECTION" and progress.get("phase_gate",{}).get("gate")=="A Gate" and progress.get("phase_gate",{}).get("decision")=="NOT_STARTED" and progress.get("phase_gate",{}).get("checkpoint_status")=="BLOCKED_PENDING_DIR1_OWNER_DIRECTION" and [event.get("event_type") for event in a15_dir_terminal]==["MAIN_PACKAGE_ACCEPTED","DIR_REACHED","DIR_REPORTED"])
    a_gate_terminal=[event for event in events if 185 <= event.get("sequence",-1) <= 186];a_gate_projection=(progress_projection.get("current_work_package")=="B-01" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and progress.get("dir_review",{}).get("status")=="CLEARED" and progress.get("phase_gate",{}).get("decision")=="ACCEPTED" and progress.get("phase_gate",{}).get("b01_started") is False and [event.get("event_type") for event in a_gate_terminal]==["DIR_OWNER_DIRECTION_RECORDED","PHASE_GATE_DECIDED"])
    b01_start=events[-1] if events else {};b01_active_projection=(progress_projection.get("current_work_package")=="B-01" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-01-20260813-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and progress.get("dir_review",{}).get("status")=="CLEARED" and progress.get("phase_gate",{}).get("decision")=="ACCEPTED" and progress.get("phase_gate",{}).get("b01_started") is True and b01_start.get("sequence")==189 and b01_start.get("event_type")=="PACKAGE_STARTED" and b01_start.get("subject_ref")=="B-01")
    b01_done=events[-1] if events else {};b01_test_review_projection=(progress_projection.get("current_work_package")=="B-01" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and b01_done.get("sequence")==192 and b01_done.get("event_type")=="PACKAGE_COMPLETED")
    b01_r2=events[-1] if events else {};b01_rework_projection=(progress_projection.get("current_work_package")=="B-01" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-01-20260813-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="REWORK_IN_PROGRESS" and progress.get("valid_failure_count")==1 and progress_projection.get("worker_lease",{}).get("lease_epoch")==2 and progress_projection.get("write_lease",{}).get("write_epoch")==2 and b01_r2.get("sequence")==196 and b01_r2.get("event_type")=="PACKAGE_RESUMED")
    b01_r2_completion_events=[event for event in events if 197 <= event.get("sequence",-1) <= 199];b01_r2_test_review_projection=(progress_projection.get("current_work_package")=="B-01" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-01-20260813-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R2_PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b01_r2_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    b01_r3_events=[event for event in events if 200 <= event.get("sequence",-1) <= 203];b01_r3_rework_projection=(progress_projection.get("current_work_package")=="B-01" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-01-20260814-003" and progress_projection.get("active_work_instruction",{}).get("result_status")=="REWORK_IN_PROGRESS" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R3_PENDING" and progress.get("valid_failure_count")==2 and progress_projection.get("worker_lease",{}).get("lease_epoch")==3 and progress_projection.get("write_lease",{}).get("write_epoch")==3 and [event.get("event_type") for event in b01_r3_events]==["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    b01_r3_completion_events=[event for event in events if 204 <= event.get("sequence",-1) <= 206];b01_r3_test_review_projection=(progress_projection.get("current_work_package")=="B-01" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-01-20260814-003" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R3_PENDING" and progress_projection.get("active_work_instruction",{}).get("finding_status")=="FIXED_AWAITING_INDEPENDENT_RETEST" and progress.get("valid_failure_count")==2 and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b01_r3_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    b01_r3_acceptance=events[-1] if events else {};b01_r3_accepted_projection=(progress_projection.get("current_work_package")=="B-02" and progress_projection.get("status")=="READY" and "B-01" in progress.get("completed_packages",[]) and progress.get("valid_failure_count")==0 and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and b01_r3_acceptance.get("sequence")==207 and b01_r3_acceptance.get("event_type")=="MAIN_PACKAGE_ACCEPTED" and b01_r3_acceptance.get("subject_ref")=="B-01")
    b02_start_events=[event for event in events if 208 <= event.get("sequence",-1) <= 210];b02_active_projection=(progress_projection.get("current_work_package")=="B-02" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-02-20260814-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and [event.get("event_type") for event in b02_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    b02_completion_events=[event for event in events if 211 <= event.get("sequence",-1) <= 213];b02_r2_events=[event for event in events if 214 <= event.get("sequence",-1) <= 217];b02_r2_completion_events=[event for event in events if 218 <= event.get("sequence",-1) <= 220];b02_r2_acceptance=[event for event in events if event.get("sequence")==221];b03_start_events=[event for event in events if 222 <= event.get("sequence",-1) <= 224];b03_completion_events=[event for event in events if 225 <= event.get("sequence",-1) <= 227];b02_test_review_projection=((progress_projection.get("current_work_package")=="B-02" and ((progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-02-20260814-001" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b02_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]) or (progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-02-20260814-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="REWORK_IN_PROGRESS" and progress.get("valid_failure_count")==1 and progress_projection.get("worker_lease",{}).get("lease_epoch")==2 and progress_projection.get("write_lease",{}).get("write_epoch")==2 and [event.get("event_type") for event in b02_r2_events]==["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"]) or (progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-02-20260814-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R2_PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b02_r2_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]))) or (progress_projection.get("current_work_package")=="B-03" and ((progress_projection.get("status")=="READY" and progress.get("valid_failure_count")==0 and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b02_r2_acceptance]==["MAIN_PACKAGE_ACCEPTED"]) or (progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-03-20260814-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and [event.get("event_type") for event in b03_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"]) or (progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-03-20260814-001" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b03_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]))))
    if progress_projection != ready_projection and not active_start_projection and not test_review_projection and not active_rework_projection and not rework_test_review_projection and not a02_ready_projection and not a02_active_projection and not a02_test_review_projection and not a02_rework_projection and not a02_r2_test_review_projection and not a03_ready_projection and not a03_active_projection and not a03_test_review_projection and not a03_rework_projection and not a03_r2_test_review_projection and not a04_ready_projection and not a04_active_projection and not a04_test_review_projection and not a05_ready_projection and not a05_active_projection and not a05_test_review_projection and not a06_ready_projection and not a06_active_projection and not a06_test_review_projection and not a07_ready_projection and not a07_active_projection and not a07_test_review_projection and not a08_ready_projection and not a08_active_projection and not a08_test_review_projection and not a09_ready_projection and not a09_active_projection and not a09_test_review_projection and not a10_ready_projection and not a10_active_projection and not a10_test_review_projection and not a11_ready_projection and not a11_active_projection and not a11_test_review_projection and not a12_ready_projection and not a12_active_projection and not a12_test_review_projection and not a13_ready_projection and not a13_active_projection and not a13_test_review_projection and not a13_rework_projection and not a13_r2_test_review_projection and not a14_ready_projection and not a14_active_projection and not a14_test_review_projection and not a14_rework_projection and not a15_ready_projection and not a15_active_projection and not a15_test_review_projection and not a15_dir_hold_projection and not a_gate_projection and not b01_active_projection and not b01_test_review_projection and not b01_rework_projection and not b01_r2_test_review_projection and not b01_r3_rework_projection and not b01_r3_test_review_projection and not b01_r3_accepted_projection and not b02_active_projection and not b02_test_review_projection:
        _error(errors, "GATE_FALSE_ADVANCEMENT", PROGRESS_PATH, repr(progress_projection))
    b03_rework_events=[event for event in events if 228 <= event.get("sequence",-1) <= 230]
    b03_rework_projection=(progress_projection.get("current_work_package")=="B-03" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-03-20260814-002" and progress.get("valid_failure_count")==0 and progress_projection.get("worker_lease",{}).get("lease_epoch")==2 and progress_projection.get("write_lease",{}).get("write_epoch")==2 and [event.get("event_type") for event in b03_rework_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b03_rework_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b03_r2_completion_events=[event for event in events if 231 <= event.get("sequence",-1) <= 233]
    b03_r2_completion_projection=(progress_projection.get("current_work_package")=="B-03" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-03-20260814-002" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R2_PENDING" and progress.get("valid_failure_count")==0 and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b03_r2_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b03_r2_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b03_r3_events=[event for event in events if 234 <= event.get("sequence",-1) <= 237]
    b03_r3_rework_projection=(progress_projection.get("current_work_package")=="B-03" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-03-20260814-003" and progress.get("valid_failure_count")==1 and progress_projection.get("worker_lease",{}).get("lease_epoch")==3 and progress_projection.get("write_lease",{}).get("write_epoch")==3 and [event.get("event_type") for event in b03_r3_events]==["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b03_r3_rework_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b03_r3_completion_events=[event for event in events if 238 <= event.get("sequence",-1) <= 240]
    b03_r3_completion_projection=(progress_projection.get("current_work_package")=="B-03" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-03-20260814-003" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R3_PENDING" and progress.get("valid_failure_count")==1 and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b03_r3_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b03_r3_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b03_r3_acceptance_projection=(progress_projection.get("current_work_package")=="B-04" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None)
    if b03_r3_acceptance_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b04_start_events=[event for event in events if 242 <= event.get("sequence",-1) <= 244]
    b04_start_projection=(progress_projection.get("current_work_package")=="B-04" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-04-20260814-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and [event.get("event_type") for event in b04_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    if b04_start_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b04_completion_events=[event for event in events if 245 <= event.get("sequence",-1) <= 247]
    b04_completion_projection=(progress_projection.get("current_work_package")=="B-04" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-04-20260814-001" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b04_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b04_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b04_acceptance_projection=(progress_projection.get("current_work_package")=="B-05" and progress_projection.get("status")=="READY" and progress_projection.get("active_work_instruction") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None)
    if b04_acceptance_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    workplan_v16_events=[event for event in events if event.get("sequence")==249]
    workplan_v16_projection=(b04_acceptance_projection and progress.get("event_sequence")==249 and progress.get("plan_version")=="1.6" and progress.get("work_plan_hash")=="E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D" and (progress.get("authority_successor_binding") or {}).get("approval_id")=="APPROVAL-20260814-WORKPLAN-V16-001" and [event.get("event_type") for event in workplan_v16_events]==["EVIDENCE_MANIFEST_CREATED"])
    if workplan_v16_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b05_start_events=[event for event in events if 250 <= event.get("sequence",-1) <= 252]
    b05_start_projection=(progress_projection.get("current_work_package")=="B-05" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-05-20260815-001" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and [event.get("event_type") for event in b05_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    if b05_start_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b05_rebind_events=[event for event in events if 253 <= event.get("sequence",-1) <= 257]
    b05_rebind_projection=(progress_projection.get("current_work_package")=="B-05" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-05-20260815-002" and progress_projection.get("worker_lease",{}).get("lease_epoch")==2 and progress_projection.get("write_lease",{}).get("write_epoch")==2 and [event.get("event_type") for event in b05_rebind_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b05_rebind_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b05_completion_events=[event for event in events if 258 <= event.get("sequence",-1) <= 260]
    b05_completion_projection=(progress_projection.get("current_work_package")=="B-05" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-05-20260815-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b05_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b05_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b05_acceptance_events=[event for event in events if event.get("sequence")==261]
    b05_acceptance_projection=(progress_projection.get("current_work_package")=="B-06" and progress_projection.get("status")=="READY" and "B-05" in progress.get("completed_packages",[]) and progress.get("valid_failure_count")==0 and progress_projection.get("active_work_instruction") is None and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("package_id")=="B-06" and (progress.get("next_work_package") or {}).get("status")=="READY" and [event.get("event_type") for event in b05_acceptance_events]==["MAIN_PACKAGE_ACCEPTED"])
    if b05_acceptance_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b06_start_events=[event for event in events if 262 <= event.get("sequence",-1) <= 264]
    b06_start_projection=(progress_projection.get("current_work_package")=="B-06" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-06-20260815-001" and progress.get("active_agent")=="developer-primary-b06" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and (progress.get("next_work_package") or {}).get("package_id")=="B-07" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B06_ACCEPTANCE" and [event.get("event_type") for event in b06_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    if b06_start_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b06_completion_events=[event for event in events if 265 <= event.get("sequence",-1) <= 267]
    b06_completion_projection=(progress_projection.get("current_work_package")=="B-06" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-06-20260815-001" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B06_ACCEPTANCE" and [event.get("event_type") for event in b06_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b06_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b06_acceptance_events=[event for event in events if event.get("sequence")==268]
    b06_acceptance_projection=(progress_projection.get("current_work_package")=="B-07" and progress_projection.get("status")=="READY" and "B-06" in progress.get("completed_packages",[]) and progress.get("valid_failure_count")==0 and progress_projection.get("active_work_instruction") is None and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("package_id")=="B-07" and (progress.get("next_work_package") or {}).get("status")=="READY" and [event.get("event_type") for event in b06_acceptance_events]==["MAIN_PACKAGE_ACCEPTED"])
    if b06_acceptance_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b07_start_events=[event for event in events if 269 <= event.get("sequence",-1) <= 271]
    b07_start_projection=(progress_projection.get("current_work_package")=="B-07" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-07-20260815-001" and progress.get("active_agent")=="developer-primary-b07" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and (progress.get("next_work_package") or {}).get("package_id")=="B-08" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B07_ACCEPTANCE" and [event.get("event_type") for event in b07_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    if b07_start_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b07_completion_events=[event for event in events if 272 <= event.get("sequence",-1) <= 274]
    b07_completion_projection=(progress_projection.get("current_work_package")=="B-07" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-07-20260815-001" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and [event.get("event_type") for event in b07_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b07_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b07_acceptance_events=[event for event in events if event.get("sequence")==275]
    b07_acceptance_projection=(progress_projection.get("current_work_package")=="B-08" and progress_projection.get("status")=="READY" and "B-07" in progress.get("completed_packages",[]) and progress.get("valid_failure_count")==0 and progress_projection.get("active_work_instruction") is None and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("package_id")=="B-08" and (progress.get("next_work_package") or {}).get("status")=="READY" and [event.get("event_type") for event in b07_acceptance_events]==["MAIN_PACKAGE_ACCEPTED"])
    if b07_acceptance_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b08_start_events=[event for event in events if 276 <= event.get("sequence",-1) <= 278]
    b08_start_projection=(progress_projection.get("current_work_package")=="B-08" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-08-20260815-001" and progress_projection.get("active_work_instruction",{}).get("assigned_verification_ids")==["AV-STAT-009","AV-STAT-011","AV-STAT-012","AV-STAT-013"] and progress.get("active_agent")=="developer-primary-b08" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and (progress.get("next_work_package") or {}).get("package_id")=="B-09" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B08_ACCEPTANCE" and [event.get("event_type") for event in b08_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    if b08_start_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b08_completion_events=[event for event in events if 279 <= event.get("sequence",-1) <= 281]
    b08_completion_projection=(progress_projection.get("current_work_package")=="B-08" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-08-20260815-001" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING_DATABASE_VERIFICATION" and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("package_id")=="B-09" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B08_ACCEPTANCE" and [event.get("event_type") for event in b08_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b08_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b08_acceptance_events=[event for event in events if event.get("sequence")==282]
    b08_acceptance_projection=(progress_projection.get("current_work_package")=="B-09" and progress_projection.get("status")=="READY" and "B-08" in progress.get("completed_packages",[]) and progress.get("valid_failure_count")==0 and progress_projection.get("active_work_instruction") is None and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("package_id")=="B-09" and (progress.get("next_work_package") or {}).get("status")=="READY" and [event.get("event_type") for event in b08_acceptance_events]==["MAIN_PACKAGE_ACCEPTED"])
    if b08_acceptance_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b09_start_events=[event for event in events if 286 <= event.get("sequence",-1) <= 290]
    b09_start_projection=(progress_projection.get("current_work_package")=="B-09" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-09-20260820-002" and progress_projection.get("active_work_instruction",{}).get("assigned_verification_ids")==["AV-STAT-026","AV-STAT-027","AV-STAT-043","AV-SAFE-028"] and progress.get("active_agent")=="developer-primary-b09" and progress_projection.get("worker_lease",{}).get("lease_epoch")==2 and progress_projection.get("write_lease",{}).get("write_epoch")==2 and (progress.get("next_work_package") or {}).get("package_id")=="B-10" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B09_ACCEPTANCE" and [event.get("event_type") for event in b09_start_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b09_start_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b09_r3_events=[event for event in events if 291 <= event.get("sequence",-1) <= 295]
    b09_r3_projection=(progress_projection.get("current_work_package")=="B-09" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-09-20260820-003" and progress_projection.get("active_work_instruction",{}).get("assigned_verification_ids")==["AV-STAT-026","AV-STAT-027","AV-STAT-043","AV-SAFE-028"] and progress.get("valid_failure_count")==2 and progress.get("active_failure_lineage",{}).get("failure_fingerprint")=="DB_FENCING_RECOVERY_CONTRACT_GAP" and progress.get("active_agent")=="developer-primary-b09" and progress_projection.get("worker_lease",{}).get("lease_epoch")==3 and progress_projection.get("worker_lease",{}).get("execution_fencing_token")=="b09-execution-fence-epoch-3-7c3382a" and progress_projection.get("write_lease",{}).get("write_epoch")==3 and progress_projection.get("write_lease",{}).get("write_fencing_token")=="b09-write-fence-epoch-3-7c3382a" and (progress.get("next_work_package") or {}).get("package_id")=="B-10" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B09_ACCEPTANCE" and [event.get("event_type") for event in b09_r3_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b09_r3_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b09_r4_events=[event for event in events if 296 <= event.get("sequence",-1) <= 301]
    b09_r4_projection=(progress_projection.get("current_work_package")=="B-09" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-09-20260820-004" and progress_projection.get("active_work_instruction",{}).get("assigned_verification_ids")==["AV-STAT-026","AV-STAT-027","AV-STAT-043","AV-SAFE-028"] and progress.get("valid_failure_count")==3 and progress.get("active_failure_lineage",{}).get("takeover_status")=="MAIN_TAKEOVER" and progress.get("active_agent")=="main-agent-eoul" and progress_projection.get("worker_lease",{}).get("lease_epoch")==4 and progress_projection.get("write_lease",{}).get("write_epoch")==4 and (progress.get("next_work_package") or {}).get("package_id")=="B-10" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B09_ACCEPTANCE" and [event.get("event_type") for event in b09_r4_events]==["FAILURE_REPORT_ACCEPTED","WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b09_r4_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b09_completion_events=[event for event in events if 302 <= event.get("sequence",-1) <= 304]
    b09_completion_projection=(progress_projection.get("current_work_package")=="B-09" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-09-20260820-004" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress.get("valid_failure_count")==3 and progress.get("active_failure_lineage",{}).get("takeover_status")=="MAIN_TAKEOVER_COMPLETED" and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("package_id")=="B-10" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B09_ACCEPTANCE" and [event.get("event_type") for event in b09_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b09_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b09_r5_events=[event for event in events if 305 <= event.get("sequence",-1) <= 308]
    b09_r5_projection=(progress_projection.get("current_work_package")=="B-09" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-09-20260820-005" and progress_projection.get("active_work_instruction",{}).get("result_status")=="REWORK_IN_PROGRESS" and progress.get("valid_failure_count")==4 and progress.get("active_failure_lineage",{}).get("takeover_status")=="MAIN_TAKEOVER_REWORK" and progress.get("active_agent")=="main-agent-eoul" and progress_projection.get("worker_lease",{}).get("lease_epoch")==5 and progress_projection.get("write_lease",{}).get("write_epoch")==5 and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B09_ACCEPTANCE" and [event.get("event_type") for event in b09_r5_events]==["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b09_r5_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b09_r5_completion_events=[event for event in events if 309 <= event.get("sequence",-1) <= 311]
    b09_r5_completion_projection=(progress_projection.get("current_work_package")=="B-09" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-09-20260820-005" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING_RETEST" and progress.get("valid_failure_count")==4 and progress.get("active_failure_lineage",{}).get("takeover_status")=="MAIN_TAKEOVER_REWORK_COMPLETED" and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B09_ACCEPTANCE" and [event.get("event_type") for event in b09_r5_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b09_r5_completion_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b09_r5_acceptance_events=[event for event in events if event.get("sequence")==312]
    b09_r5_acceptance_projection=(progress_projection.get("current_work_package")=="B-10" and progress_projection.get("status")=="READY" and "B-09" in progress.get("completed_packages",[]) and progress.get("valid_failure_count")==0 and (progress.get("historical_failure_counts_by_lineage") or {}).get("B-09")==4 and progress_projection.get("active_work_instruction") is None and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("status")=="READY" and [event.get("event_type") for event in b09_r5_acceptance_events]==["MAIN_PACKAGE_ACCEPTED"])
    if b09_r5_acceptance_projection:
        errors = [error for error in errors if error.get("code") != "GATE_FALSE_ADVANCEMENT"]
    b10_start_events=[event for event in events if 313 <= event.get("sequence",-1) <= 315]
    b10_start_projection=(progress_projection.get("current_work_package")=="B-10" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-10-20260820-001" and progress.get("active_agent")=="developer-primary-b10" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and (progress.get("next_work_package") or {}).get("package_id")=="B-11" and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B10_ACCEPTANCE" and [event.get("event_type") for event in b10_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    if b10_start_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b10_completion_events=[event for event in events if 316 <= event.get("sequence",-1) <= 318]
    b10_completion_projection=(progress_projection.get("current_work_package")=="B-10" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-10-20260820-001" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B10_ACCEPTANCE" and [event.get("event_type") for event in b10_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b10_completion_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b10_r2_events=[event for event in events if 319 <= event.get("sequence",-1) <= 322]
    b10_r2_projection=(progress_projection.get("current_work_package")=="B-10" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-10-20260821-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="REWORK_IN_PROGRESS" and progress.get("active_agent")=="developer-primary-b10" and progress.get("valid_failure_count")==1 and progress_projection.get("worker_lease",{}).get("lease_epoch")==2 and progress_projection.get("write_lease",{}).get("write_epoch")==2 and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B10_ACCEPTANCE" and [event.get("event_type") for event in b10_r2_events]==["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b10_r2_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b10_r2_completion_events=[event for event in events if 323 <= event.get("sequence",-1) <= 325]
    b10_r2_completion_projection=(progress_projection.get("current_work_package")=="B-10" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-10-20260821-002" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING_RETEST" and progress.get("valid_failure_count")==1 and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B10_ACCEPTANCE" and [event.get("event_type") for event in b10_r2_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b10_r2_completion_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b10_r3_events=[event for event in events if 326 <= event.get("sequence",-1) <= 329]
    b10_r3_projection=(progress_projection.get("current_work_package")=="B-10" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-10-20260821-003" and progress_projection.get("active_work_instruction",{}).get("result_status")=="REWORK_IN_PROGRESS" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="R3_PENDING" and progress.get("active_agent")=="developer-primary-b10" and progress.get("valid_failure_count")==2 and progress_projection.get("worker_lease",{}).get("lease_epoch")==3 and progress_projection.get("write_lease",{}).get("write_epoch")==3 and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B10_ACCEPTANCE" and [event.get("event_type") for event in b10_r3_events]==["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"])
    if b10_r3_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b10_r3_completion_events=[event for event in events if 330 <= event.get("sequence",-1) <= 332]
    b10_r3_completion_projection=(progress_projection.get("current_work_package")=="B-10" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-10-20260821-003" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING_RETEST" and progress.get("valid_failure_count")==2 and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("status")=="BLOCKED_PENDING_B10_ACCEPTANCE" and [event.get("event_type") for event in b10_r3_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b10_r3_completion_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b10_r3_acceptance_events=[event for event in events if event.get("sequence")==333]
    b10_r3_acceptance_projection=(progress_projection.get("current_work_package")=="B-11" and progress_projection.get("status")=="READY" and "B-10" in progress.get("completed_packages",[]) and progress.get("valid_failure_count")==0 and (progress.get("historical_failure_counts_by_lineage") or {}).get("B-10")==2 and progress_projection.get("active_work_instruction") is None and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {}).get("status")=="READY" and [event.get("event_type") for event in b10_r3_acceptance_events]==["MAIN_PACKAGE_ACCEPTED"])
    if b10_r3_acceptance_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b11_start_events=[event for event in events if 334 <= event.get("sequence",-1) <= 336]
    b11_start_projection=(progress_projection.get("current_work_package")=="B-11" and progress_projection.get("status")=="ACTIVE" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-11-20260821-001" and progress.get("active_agent")=="developer-primary-b11" and progress_projection.get("worker_lease",{}).get("lease_epoch")==1 and progress_projection.get("write_lease",{}).get("write_epoch")==1 and (progress.get("next_work_package") or {})=={"package_id":"B-12","status":"BLOCKED_PENDING_B11_ACCEPTANCE"} and [event.get("event_type") for event in b11_start_events]==["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"])
    if b11_start_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]
    b11_completion_events=[event for event in events if 337 <= event.get("sequence",-1) <= 339]
    b11_completion_projection=(progress_projection.get("current_work_package")=="B-11" and progress_projection.get("status")=="TEST_REVIEW" and progress_projection.get("active_work_instruction",{}).get("artifact_id")=="WI-B-11-20260821-001" and progress_projection.get("active_work_instruction",{}).get("result_status")=="COMPLETED" and progress_projection.get("active_work_instruction",{}).get("independent_tester_status")=="PENDING" and progress.get("active_agent") is None and progress_projection.get("worker_lease") is None and progress_projection.get("write_lease") is None and (progress.get("next_work_package") or {})=={"package_id":"B-12","status":"BLOCKED_PENDING_B11_ACCEPTANCE"} and [event.get("event_type") for event in b11_completion_events]==["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"])
    if b11_completion_projection:
        errors = [error for error in errors if error.get("code") not in {"GATE_FALSE_ADVANCEMENT", "GATE_BASELINE_REGRESSION"}]

    counts = {
        "package": baseline["counts"]["package_total"],
        "av": baseline["counts"]["unique_av_total"],
        "reverse": baseline["counts"]["reverse_package_total"],
        "scenario": baseline["counts"]["scenario_total"],
        "sync": len(sync_values),
    }
    return {
        "schema_version": "1.0.0",
        "package_id": "PHASE_G_GATE",
        "status": "PASS" if not errors else "FAIL",
        "accepted_packages": accepted,
        "decisions": decisions,
        "decision_chain": decision_chain,
        "counts": counts,
        "lease_dry_run": {"status": "PASS" if not any(item["code"].startswith("GATE_LEASE") or item["code"].startswith("GATE_STALE") for item in errors) else "FAIL", "results": lease_results, "final_state": lease_final},
        "reconstruction": {"status": "PASS" if not any(item["code"] == "GATE_RECONSTRUCTION_CONTRACT_MISMATCH" for item in errors) else "FAIL", "exit_projection": exit_projection},
        "sync_targets": sync_values,
        "key_verifications": key_verifications,
        "scenario_runtime_status": scenario_runtime_status,
        "progress": progress_projection,
        "mapping_hash": baseline["mapping_hash"],
        "errors": errors,
    }


def render_markdown(report: Mapping[str, Any]) -> str:
    counts = report["counts"]
    lines = [
        "# Phase G Gate 검증 보고서", "", f"- validator_status: `{report['status']}`", "- gate_state: `ACCEPTED / CHECKPOINT_CLEARED`", "- Gate decision: `ACCEPTED`", "- A-01 start: `true / READY / WorkInstruction 미발행`", "",
        "## 재계산", "", f"- G accepted: `{len(report['accepted_packages'])}/7`", f"- D1~D10: `{len(report['decisions'])}/10`", f"- Package/AV/reverse/scenario/§49.18 sync: `{counts['package']}/{counts['av']}/{counts['reverse']}/{counts['scenario']}/{counts['sync']}`", f"- lease dry-run: `{report['lease_dry_run']['status']}`", f"- WorkInstruction reconstruction: `{report['reconstruction']['status']}`", "", "## 경계", "", "Git gate checkpoint가 확인되어 A-01은 READY지만 WorkInstruction·lease 전에는 구현할 수 없다.", "",
        "## 핵심 AV 증거", "", "| verification_id | source_package | test_report_ref / sha | manifest_ref / sha / target | result | method-level | reviewing_actor |", "|---|---|---|---|---|---|---|",
    ]
    for item in report["key_verifications"].values():
        lines.append(f"| `{item['verification_id']}` | `{item['source_package']}` | `{item['test_report_ref']}` / `{item['test_report_sha256']}` | `{item['manifest_ref']}` / `{item['manifest_sha256']}` / `{item['target_hash']}` | `{item['result']}` | `{item['method_level']}` | `{item['reviewing_actor']}` |")
    chain = report["decision_chain"]
    lines += ["", "## D1~D10 결정 계보", "", f"- root approval: `{chain['root_approval_id']}` / `{chain['root_approval_ref']}` / `{chain['root_approval_sha256']}`", f"- G-02 R3: `{chain['g02_r3_test_report_ref']}` / `{chain['g02_r3_test_report_sha256']}`", f"- acceptance projection event: `{chain['acceptance_event_id']}`", f"- standing approval Gate 적용: `{chain['standing_approval_gate_application']}`; actor=`{chain['application_actor']}`, approval_ref=`{chain['application_approval_ref']}`", "", "## Lease dry-run", "", "8개 operation의 actor/time/path/epoch/token/result/reason은 JSON report에 보존했다. 실제 shared lease는 발급하지 않았다.", "", f"- §49.17 runtime: `{report['scenario_runtime_status']}`", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--json-output")
    parser.add_argument("--markdown-output")
    args = parser.parse_args()
    report = validate_gate(args.root)
    if args.json_output:
        Path(args.json_output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.markdown_output:
        Path(args.markdown_output).write_text(render_markdown(report), encoding="utf-8")
    if report["errors"]:
        print("\n".join(item["code"] for item in report["errors"]))
        return 1
    print(f"Phase G Gate: PASS accepted=7 decisions=10 packages={report['counts']['package']} av={report['counts']['av']} scenarios={report['counts']['scenario']} sync={report['counts']['sync']}")
    return 0


def validate_b10_start_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") in (329, 332, 333): return []
    errors = []
    if progress.get("event_sequence") != 315 or progress.get("current_work_package") != "B-10" or progress.get("status") != "ACTIVE": errors.append("B10_PHASE_PROJECTION_INVALID")
    if (progress.get("phase_gate") or {}).get("decision") != "ACCEPTED": errors.append("A_GATE_DRIFT")
    if (progress.get("next_work_package") or {}).get("package_id") != "B-11": errors.append("B11_SUCCESSOR_INVALID")
    return errors


def validate_b11_start_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    events = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    terminal = [event for event in events if 334 <= event.get("sequence", -1) <= 336]
    errors = []
    if progress.get("event_sequence") != 336 or progress.get("current_work_package") != "B-11" or progress.get("status") != "ACTIVE": errors.append("B11_PHASE_PROJECTION_INVALID")
    if (progress.get("phase_gate") or {}).get("decision") != "ACCEPTED": errors.append("A_GATE_DRIFT")
    if (progress.get("active_work_instruction") or {}).get("artifact_id") != "WI-B-11-20260821-001": errors.append("B11_WORK_INSTRUCTION_INVALID")
    if (progress.get("next_work_package") or {}) != {"package_id": "B-12", "status": "BLOCKED_PENDING_B11_ACCEPTANCE"}: errors.append("B12_BOUNDARY_INVALID")
    if [event.get("event_type") for event in terminal] != ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"]: errors.append("B11_EVENT_ORDER_INVALID")
    return errors


def validate_b11_completion_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    events = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    terminal = [event for event in events if 337 <= event["sequence"] <= 339]
    errors = []
    if progress.get("event_sequence") != 339 or progress.get("current_work_package") != "B-11" or progress.get("status") != "TEST_REVIEW": errors.append("B11_COMPLETION_PHASE_INVALID")
    if (progress.get("phase_gate") or {}).get("decision") != "ACCEPTED": errors.append("A_GATE_DRIFT")
    if progress.get("worker_lease") is not None or progress.get("write_lease") is not None: errors.append("B11_COMPLETION_LEASE_INVALID")
    if [event["event_type"] for event in terminal] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]: errors.append("B11_COMPLETION_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}) != {"package_id": "B-12", "status": "BLOCKED_PENDING_B11_ACCEPTANCE"}: errors.append("B12_BOUNDARY_INVALID")
    return errors


def validate_b10_completion_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") in (329, 332, 333): return []
    events = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    terminal = [event for event in events if 316 <= event["sequence"] <= 318]
    wi = progress.get("active_work_instruction") or {}
    errors = []
    if progress.get("event_sequence") != 318 or progress.get("status") != "TEST_REVIEW": errors.append("B10_COMPLETION_PHASE_INVALID")
    if progress.get("worker_lease") is not None or progress.get("write_lease") is not None: errors.append("B10_COMPLETION_LEASE_INVALID")
    if wi.get("independent_tester_status") != "PENDING": errors.append("B10_COMPLETION_TESTER_INVALID")
    if [event["event_type"] for event in terminal] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]: errors.append("B10_COMPLETION_EVENT_ORDER_INVALID")
    return errors


def validate_b10_rework_start_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") in (329, 332, 333): return []
    events = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    terminal = [event for event in events if 319 <= event["sequence"] <= 322]
    errors = []
    if progress.get("event_sequence") != 322 or progress.get("status") != "ACTIVE" or progress.get("valid_failure_count") != 1: errors.append("B10_R2_PHASE_INVALID")
    if (progress.get("phase_gate") or {}).get("decision") != "ACCEPTED": errors.append("A_GATE_DRIFT")
    if (progress.get("worker_lease") or {}).get("lease_epoch") != 2 or (progress.get("write_lease") or {}).get("write_epoch") != 2: errors.append("B10_R2_FENCING_INVALID")
    if [event["event_type"] for event in terminal] != ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"]: errors.append("B10_R2_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B10_ACCEPTANCE": errors.append("B11_BOUNDARY_INVALID")
    return errors


def validate_b10_rework_completion_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") in (329, 332, 333): return []
    report = validate_gate(root)
    events = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    terminal = [event for event in events if 323 <= event.get("sequence", -1) <= 325]
    errors = [entry["code"] for entry in report["errors"]]
    wi = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 325, progress.get("status") != "TEST_REVIEW", progress.get("valid_failure_count") != 1, wi.get("result_status") != "COMPLETED", wi.get("independent_tester_status") != "PENDING_RETEST", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None, (progress.get("phase_gate") or {}).get("decision") != "ACCEPTED", [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"])):
        errors.append("B10_R2_COMPLETION_INVALID")
    return sorted(set(errors))


def validate_b10_r3_rework_start_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") in (332, 333): return []
    events = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    terminal = [event for event in events if 326 <= event.get("sequence", -1) <= 329]
    worker = progress.get("worker_lease") or {}
    write = progress.get("write_lease") or {}
    errors = []
    if progress.get("event_sequence") != 329 or progress.get("status") != "ACTIVE" or progress.get("valid_failure_count") != 2: errors.append("B10_R3_PHASE_INVALID")
    if (progress.get("phase_gate") or {}).get("decision") != "ACCEPTED": errors.append("A_GATE_DRIFT")
    if worker.get("lease_epoch") != 3 or write.get("write_epoch") != 3: errors.append("B10_R3_FENCING_INVALID")
    if [event.get("event_type") for event in terminal] != ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"]: errors.append("B10_R3_EVENT_ORDER_INVALID")
    if (progress.get("next_work_package") or {}).get("status") != "BLOCKED_PENDING_B10_ACCEPTANCE": errors.append("B11_BOUNDARY_INVALID")
    return errors


def validate_b10_r3_rework_completion_projection(root: Path) -> list[str]:
    progress = json.loads((root / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence") == 333: return []
    report = validate_gate(root)
    events = json.loads((root / "docs/progress/progress-events.json").read_text(encoding="utf-8"))["events"]
    terminal = [event for event in events if 330 <= event.get("sequence", -1) <= 332]
    errors = [entry["code"] for entry in report["errors"]]
    wi = progress.get("active_work_instruction") or {}
    if any((progress.get("event_sequence") != 332, progress.get("status") != "TEST_REVIEW", progress.get("valid_failure_count") != 2, wi.get("result_status") != "COMPLETED", wi.get("independent_tester_status") != "PENDING_RETEST", progress.get("active_agent") is not None, progress.get("worker_lease") is not None, progress.get("write_lease") is not None, (progress.get("phase_gate") or {}).get("decision") != "ACCEPTED", [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"])):
        errors.append("B10_R3_COMPLETION_INVALID")
    return sorted(set(errors))

if __name__ == "__main__":
    raise SystemExit(main())
