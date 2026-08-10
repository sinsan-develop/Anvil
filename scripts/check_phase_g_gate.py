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
        progress = json.loads((root / PROGRESS_PATH).read_text(encoding="utf-8"))
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
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("GATE_CHECKPOINT_RAW_MISSING")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if row.get("bytes") != len(raw) or row.get("sha256") != actual:
            errors.append("GATE_CHECKPOINT_RAW_MISMATCH")
        total += len(raw)
        rows.append((relative.encode("utf-8"), f"{relative}\t{len(raw)}\t{actual}"))
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
    current_ref = progress.get("current_progress_evidence_ref", {})
    if current_ref != {"package_id": "A-01", "path": CHECKPOINT_DETACHED_PATH, "manifest_path": CHECKPOINT_MANIFEST_PATH}:
        errors.append("GATE_CHECKPOINT_PROGRESS_REF_INVALID")
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
        "next_conditional_package": "A-01" if "A-01" in progress.get("next_safe_action", "") and "A-01" in handoff else None,
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
    if progress_projection != ready_projection and not active_start_projection and not test_review_projection and not active_rework_projection:
        _error(errors, "GATE_FALSE_ADVANCEMENT", PROGRESS_PATH, repr(progress_projection))

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


if __name__ == "__main__":
    raise SystemExit(main())
