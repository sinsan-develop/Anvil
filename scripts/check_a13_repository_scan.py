"""Validate the reusable A-13 read-only scanner against all G-06 fixtures."""

from __future__ import annotations

import importlib.util
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


FIXTURE_IDS = (
    "FIX-PY-CLEAN",
    "FIX-PY-DIRTY",
    "FIX-PY-REDFAIL",
    "FIX-TS-CLEAN",
    "FIX-TS-NOTOOL",
    "FIX-PROTECTED",
    "FIX-LARGE",
    "FIX-CONFLICT",
)
EXPECTED_COMMAND_IDS = {
    "is_inside_work_tree",
    "repository_root",
    "git_dir",
    "git_common_dir",
    "head",
    "branch",
    "status_porcelain_v2",
    "remotes",
}
EXPECTED_RESULT_FIELDS = {
    "schema_version",
    "success",
    "status",
    "repository",
    "inventory",
    "manifests",
    "no_write_proof",
    "errors",
    "evidence_types",
}
EVIDENCE_REL = "docs/evidence/manifests/A-13_EVIDENCE_MANIFEST.json"
EVIDENCE_R2_REL = "docs/evidence/manifests/A-13_EVIDENCE_MANIFEST_R2.json"
RAW_PATHS = {
    "docs/architecture/a13/A-13_REPOSITORY_SCAN.md",
    "docs/architecture/a13/A-13_REPOSITORY_SCAN_CONTRACT.json",
    "docs/completion_reports/A-13_COMPLETION_REPORT.md",
    "docs/validation/A-13_REPOSITORY_SCAN_VALIDATION.md",
    "packages/repository_intelligence/__init__.py",
    "packages/repository_intelligence/errors.py",
    "packages/repository_intelligence/git_readonly.py",
    "packages/repository_intelligence/inventory.py",
    "packages/repository_intelligence/manifests.py",
    "packages/repository_intelligence/models.py",
    "packages/repository_intelligence/path_guard.py",
    "packages/repository_intelligence/profile.py",
    "packages/repository_intelligence/scanner.py",
    "scripts/check_a13_repository_scan.py",
    "tests/fixtures/a13/hostile-cases.json",
    "tests/tooling/test_a13_repository_scan.py",
}
DECLARED_CHANGED_PATHS = RAW_PATHS | {EVIDENCE_REL}
R2_RAW_PATHS = {
    "docs/completion_reports/A-13_COMPLETION_REPORT.md",
    "docs/evidence/manifests/A-13_EVIDENCE_MANIFEST.json",
    "docs/test_reports/A-13_TEST_REPORT.md",
    "docs/validation/A-13_REPOSITORY_SCAN_VALIDATION.md",
    "docs/work_orders/A-13_REWORK_INVOCATION_PROMPT_R2.md",
    "docs/work_orders/A-13_REWORK_WORK_INSTRUCTION_R2.md",
    "scripts/check_a13_repository_scan.py",
    "tests/tooling/test_a13_repository_scan.py",
}
R2_CHANGED_PATHS = {
    "docs/completion_reports/A-13_COMPLETION_REPORT.md",
    EVIDENCE_R2_REL,
    "docs/validation/A-13_REPOSITORY_SCAN_VALIDATION.md",
    "scripts/check_a13_repository_scan.py",
    "tests/tooling/test_a13_repository_scan.py",
}


def _load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"MODULE_LOAD_FAILED:{path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _projection(raw_artifacts: list[dict[str, Any]]) -> bytes:
    projected = [
        {"path": item.get("path"), "sha256": item.get("sha256")}
        for item in sorted(raw_artifacts, key=lambda item: str(item.get("path")))
    ]
    return json.dumps(
        projected,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _git_changed_paths(root: Path) -> set[str]:
    completed = subprocess.run(
        ["git", "--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
        cwd=root,
        check=True,
        capture_output=True,
        env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
    )
    entries = completed.stdout.decode("utf-8", errors="surrogateescape").split("\0")
    return {entry[3:].replace("\\", "/") for entry in entries if len(entry) >= 4}


def _successor_projection(root: Path, changed_paths: set[str]) -> dict[str, dict[str, object]] | None:
    """Validate the Main-owned completion successor for frozen Developer tooling."""
    try:
        progress = _load_json(root / "docs/progress/build-progress.json")
        completion = _load_json(root / "docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST.json")
        predecessor_sha = hashlib.sha256((root / EVIDENCE_REL).read_bytes()).hexdigest().upper()
    except (OSError, json.JSONDecodeError):
        return None
    successor = completion.get("developer_successor_projection", {})
    rows = successor.get("live_raw_checksums", [])
    allowed = {"scripts/check_a13_repository_scan.py", "tests/tooling/test_a13_repository_scan.py"}
    indexed = {row.get("path"): row for row in rows if isinstance(row, dict)}
    completion_paths = set(completion.get("repository_projection", {}).get("exact_allowed_paths", []))
    committed_clean = not changed_paths
    uncommitted_completion = (
        set(progress.get("repository", {}).get("exact_allowed_paths", [])) == changed_paths
        and completion_paths == changed_paths
        and DECLARED_CHANGED_PATHS <= changed_paths
        and progress.get("event_sequence") == 140
        and progress.get("current_work_package") == "A-13"
        and progress.get("status") == "TEST_REVIEW"
        and progress.get("worker_lease") is None
        and progress.get("write_lease") is None
        and progress.get("current_progress_evidence_ref", {}).get("manifest_path")
        == "docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST.json"
    )
    if not (
        (committed_clean or uncommitted_completion)
        and successor.get("predecessor_manifest_sha256") == predecessor_sha
        and set(indexed) == allowed
    ):
        return None
    for path, row in indexed.items():
        payload = (root / path).read_bytes()
        if row.get("bytes") != len(payload) or row.get("sha256") != hashlib.sha256(payload).hexdigest().upper():
            return None
    return indexed


def _validate_revision2_manifest(
    root: Path,
    manifest: dict[str, Any],
    changed_paths: set[str],
) -> list[str]:
    errors: list[str] = []
    raw = manifest.get("raw_artifacts", [])
    if not isinstance(raw, list) or not raw:
        return ["EVIDENCE_RAW_ARTIFACTS_INVALID"]
    if manifest.get("self_reference") is not False:
        errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    completion_successor = _revision2_completion_successor(root, changed_paths)
    observed_paths: set[str] = set()
    content_bytes = 0
    for item in raw:
        path = str(item.get("path", ""))
        file_path = root / path
        if not path or path in observed_paths or path == EVIDENCE_R2_REL:
            errors.append("EVIDENCE_RAW_PATH_INVALID")
            continue
        observed_paths.add(path)
        if not file_path.is_file():
            errors.append("EVIDENCE_RAW_ARTIFACT_MISSING")
            continue
        payload = file_path.read_bytes()
        successor_bound = path in (completion_successor or {})
        content_bytes += item.get("bytes", 0) if successor_bound else len(payload)
        if item.get("bytes") != len(payload) and not successor_bound:
            errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != hashlib.sha256(payload).hexdigest().upper() and not successor_bound:
            errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    projection = _projection(raw)
    target = hashlib.sha256(projection).hexdigest().upper()
    if observed_paths != R2_RAW_PATHS:
        errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    if manifest.get("declared_changed_paths") != sorted(R2_CHANGED_PATHS):
        errors.append("EVIDENCE_DECLARED_DIFF_MISMATCH")
    if changed_paths not in (set(), R2_CHANGED_PATHS) and completion_successor is None:
        errors.append("EVIDENCE_ACTUAL_DIFF_MISMATCH")
    if manifest.get("target_canonical_bytes") != len(projection):
        errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    if manifest.get("target_content_bytes") != content_bytes:
        errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target:
        errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    predecessor = manifest.get("supersedes_artifact_ref")
    expected_predecessor = {
        "path": EVIDENCE_REL,
        "sha256": "BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE",
    }
    try:
        actual_predecessor = hashlib.sha256((root / EVIDENCE_REL).read_bytes()).hexdigest().upper()
    except OSError:
        actual_predecessor = ""
    if predecessor != expected_predecessor or actual_predecessor != expected_predecessor["sha256"]:
        errors.append("EVIDENCE_PREDECESSOR_BINDING_MISMATCH")
    expected_report = {
        "path": "docs/test_reports/A-13_TEST_REPORT.md",
        "sha256": "90765FDA6C240AE04A7548B265BC4E2506E9E1878F93DE353ECFEE1AD736A986",
    }
    try:
        actual_report = hashlib.sha256((root / expected_report["path"]).read_bytes()).hexdigest().upper()
    except OSError:
        actual_report = ""
    if manifest.get("source_test_report_ref") != expected_report or actual_report != expected_report["sha256"]:
        errors.append("EVIDENCE_TEST_REPORT_BINDING_MISMATCH")
    expected = {
        "artifact_id": "EVIDENCE-MANIFEST-A-13-20260812-002",
        "package_id": "A-13",
        "work_instruction_sha256": "A803A7A2C0810EB9E9F8521AEE1E5A66B99D71246888ECDAD193D233582EB46B",
        "assigned_verification_ids": ["AV-SAFE-010", "AV-SAFE-012"],
        "execution_classification": "FIXTURE_INTEGRATION_ONLY",
        "runtime_status": "ACTUAL_RUNTIME / NOT_EXECUTED",
        "finding_closure_claims": ["A13-TST-BLK-001", "A13-TST-BLK-002"],
    }
    if any(manifest.get(key) != value for key, value in expected.items()):
        errors.append("EVIDENCE_QUALIFIER_MISMATCH")
    return sorted(set(errors))


def _revision2_completion_successor(root: Path, changed_paths: set[str]) -> dict[str, dict[str, object]] | None:
    try:
        completion = _load_json(root / "docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST_R2.json")
        progress = _load_json(root / "docs/progress/build-progress.json")
        acceptance_path = root / "docs/evidence/manifests/A-13_ACCEPTANCE_PROGRESS_MANIFEST_R2.json"
        acceptance = _load_json(acceptance_path) if acceptance_path.is_file() else {}
        start_path = root / "docs/evidence/manifests/A-14_START_EVIDENCE_MANIFEST.json"
        start = _load_json(start_path) if start_path.is_file() else {}
        a14_completion_path = root / 'docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST.json'
        a14_completion = _load_json(a14_completion_path) if a14_completion_path.is_file() else {}
        a14_rework_path = root / 'docs/evidence/manifests/A-14_REWORK_START_MANIFEST.json'
        a14_rework = _load_json(a14_rework_path) if a14_rework_path.is_file() else {}
        a14_rework_evidence_path = root / 'docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json'
        a14_rework_evidence = (
            _load_json(a14_rework_evidence_path) if a14_rework_evidence_path.is_file() else {}
        )
        a14_r2_completion_path = root / 'docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R2.json'
        a14_r2_completion = _load_json(a14_r2_completion_path) if a14_r2_completion_path.is_file() else {}
        a14_r3_rework_path = root / 'docs/evidence/manifests/A-14_REWORK_START_MANIFEST_R3.json'
        a14_r3_rework = _load_json(a14_r3_rework_path) if a14_r3_rework_path.is_file() else {}
        a14_r3_completion_path = root / 'docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R3.json'
        a14_r3_completion = _load_json(a14_r3_completion_path) if a14_r3_completion_path.is_file() else {}
        a14_r3_evidence_path = root / 'docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R3.json'
        a14_r3_evidence = _load_json(a14_r3_evidence_path) if a14_r3_evidence_path.is_file() else {}
        a14_r4_takeover_path = root / 'docs/evidence/manifests/A-14_MAIN_TAKEOVER_EVIDENCE_R4.json'
        a14_r4_takeover = _load_json(a14_r4_takeover_path) if a14_r4_takeover_path.is_file() else {}
        a14_r4_completion_path = root / 'docs/evidence/manifests/A-14_MAIN_TAKEOVER_COMPLETION_MANIFEST_R4.json'
        a14_r4_completion = _load_json(a14_r4_completion_path) if a14_r4_completion_path.is_file() else {}
        a14_acceptance_path = root / 'docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json'
        a14_acceptance = _load_json(a14_acceptance_path) if a14_acceptance_path.is_file() else {}
        a15_start_path = root / 'docs/evidence/manifests/A-15_START_EVIDENCE_MANIFEST.json'
        a15_start = _load_json(a15_start_path) if a15_start_path.is_file() else {}
        a15_completion_path = root / 'docs/evidence/manifests/A-15_COMPLETION_PROGRESS_MANIFEST.json'
        a15_completion = _load_json(a15_completion_path) if a15_completion_path.is_file() else {}
        a15_acceptance_dir1_path = root / 'docs/evidence/manifests/A-15_ACCEPTANCE_DIR1_PROGRESS_MANIFEST.json'
        a15_acceptance_dir1 = (
            _load_json(a15_acceptance_dir1_path) if a15_acceptance_dir1_path.is_file() else {}
        )
        a_gate_path = root / 'docs/evidence/manifests/A-GATE_DECISION_PROGRESS_MANIFEST.json'
        a_gate = _load_json(a_gate_path) if a_gate_path.is_file() else {}
        b01_start_path = root / 'docs/evidence/manifests/B-01_START_EVIDENCE_MANIFEST.json'
        b01_start = _load_json(b01_start_path) if b01_start_path.is_file() else {}
        b01_completion_path = root / 'docs/evidence/manifests/B-01_COMPLETION_PROGRESS_MANIFEST.json'
        b01_completion = _load_json(b01_completion_path) if b01_completion_path.is_file() else {}
        b01_rework_path = root / 'docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R2.json'
        b01_rework = _load_json(b01_rework_path) if b01_rework_path.is_file() else {}
        b01_r2_completion_path = root / 'docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json'
        b01_r2_completion = _load_json(b01_r2_completion_path) if b01_r2_completion_path.is_file() else {}
        b01_r3_rework_path = root / 'docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R3.json'
        b01_r3_rework = _load_json(b01_r3_rework_path) if b01_r3_rework_path.is_file() else {}
        b01_r3_completion_path = root / 'docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json'
        b01_r3_completion = _load_json(b01_r3_completion_path) if b01_r3_completion_path.is_file() else {}
        b01_r3_acceptance_path = root / 'docs/evidence/manifests/B-01_ACCEPTANCE_PROGRESS_MANIFEST_R3.json'
        b01_r3_acceptance = _load_json(b01_r3_acceptance_path) if b01_r3_acceptance_path.is_file() else {}
        b02_start_path = root / 'docs/evidence/manifests/B-02_START_EVIDENCE_MANIFEST.json'
        b02_start = _load_json(b02_start_path) if b02_start_path.is_file() else {}
        b02_completion_path = root / 'docs/evidence/manifests/B-02_COMPLETION_PROGRESS_MANIFEST.json'
        b02_completion = _load_json(b02_completion_path) if b02_completion_path.is_file() else {}
        b02_rework_path = root / 'docs/evidence/manifests/B-02_REWORK_START_PROGRESS_MANIFEST_R2.json'
        b02_rework = _load_json(b02_rework_path) if b02_rework_path.is_file() else {}
        b02_r2_completion_path = root / 'docs/evidence/manifests/B-02_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json'
        b02_r2_completion = _load_json(b02_r2_completion_path) if b02_r2_completion_path.is_file() else {}
        b02_r2_acceptance_path = root / 'docs/evidence/manifests/B-02_ACCEPTANCE_PROGRESS_MANIFEST_R2.json'
        b02_r2_acceptance = _load_json(b02_r2_acceptance_path) if b02_r2_acceptance_path.is_file() else {}
        b03_start_path = root / 'docs/evidence/manifests/B-03_START_EVIDENCE_MANIFEST.json'
        b03_start = _load_json(b03_start_path) if b03_start_path.is_file() else {}
        b03_completion_path = root / 'docs/evidence/manifests/B-03_COMPLETION_PROGRESS_MANIFEST.json'
        b03_completion = _load_json(b03_completion_path) if b03_completion_path.is_file() else {}
        b03_rework_path = root / 'docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R2.json'
        b03_rework = _load_json(b03_rework_path) if b03_rework_path.is_file() else {}
        b03_r2_completion_path = root / 'docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json'
        b03_r2_completion = _load_json(b03_r2_completion_path) if b03_r2_completion_path.is_file() else {}
        b03_r3_rework_path = root / 'docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R3.json'
        b03_r3_rework = _load_json(b03_r3_rework_path) if b03_r3_rework_path.is_file() else {}
        b03_r3_evidence_path = root / 'docs/evidence/manifests/B-03_EVIDENCE_MANIFEST_R3.json'
        b03_r3_evidence = _load_json(b03_r3_evidence_path) if b03_r3_evidence_path.is_file() else {}
        b03_r3_completion_path = root / 'docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json'
        b03_r3_completion = _load_json(b03_r3_completion_path) if b03_r3_completion_path.is_file() else {}
        a14_r4_report_path = root / 'docs/test_reports/A-14_RETEST_REPORT_R4.md'
        a14_r4_packet_path = root / 'docs/work_orders/A-14_MAIN_TAKEOVER_PACKET_R4.md'
        predecessor_sha = hashlib.sha256((root / EVIDENCE_R2_REL).read_bytes()).hexdigest().upper()
    except (OSError, json.JSONDecodeError):
        return None

    live_paths = {"scripts/check_a13_repository_scan.py", "tests/tooling/test_a13_repository_scan.py"}
    completion_paths = set(completion.get("repository_projection", {}).get("exact_allowed_paths", []))
    acceptance_paths = set(acceptance.get("repository_projection", {}).get("exact_allowed_paths", []))
    start_paths = set(start.get("repository_projection", {}).get("exact_allowed_paths", []))
    committed_clean = not changed_paths
    current_completion = (
        progress.get("event_sequence") == 147
        and progress.get("current_work_package") == "A-13"
        and progress.get("status") == "TEST_REVIEW"
        and progress.get("worker_lease") is None
        and progress.get("write_lease") is None
        and progress.get("current_progress_evidence_ref", {}).get("manifest_path") == "docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST_R2.json"
        and set(progress.get("repository", {}).get("exact_allowed_paths", [])) == changed_paths
        and completion_paths == changed_paths
        and R2_CHANGED_PATHS <= changed_paths
    )
    current_acceptance = (
        progress.get("event_sequence") == 148
        and progress.get("current_work_package") == "A-14"
        and progress.get("status") == "READY"
        and progress.get("active_work_instruction") is None
        and progress.get("worker_lease") is None
        and progress.get("write_lease") is None
        and progress.get("current_progress_evidence_ref", {}).get("manifest_path") == "docs/evidence/manifests/A-13_ACCEPTANCE_PROGRESS_MANIFEST_R2.json"
        and set(progress.get("repository", {}).get("exact_allowed_paths", [])) == changed_paths
        and acceptance_paths == changed_paths
        and live_paths <= changed_paths
    )

    current_start = (
        progress.get("event_sequence") == 151
        and progress.get("current_work_package") == "A-14"
        and progress.get("status") == "ACTIVE"
        and progress.get("active_work_instruction", {}).get("artifact_id") == "WI-A-14-20260812-001"
        and progress.get("current_progress_evidence_ref", {}).get("manifest_path") == "docs/evidence/manifests/A-14_START_EVIDENCE_MANIFEST.json"
        and (
            committed_clean
            or (
                set(progress.get("repository", {}).get("exact_allowed_paths", [])) == changed_paths
                and start_paths == changed_paths
            )
        )
    )

    current_a14_completion = (progress.get('event_sequence') == 154 and progress.get('status') == 'TEST_REVIEW' and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST.json' and set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    rework_projection_paths = set(progress.get('repository', {}).get('exact_allowed_paths', []))
    rework_evidence_rel = 'docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json'
    current_a14_rework = (
        progress.get('event_sequence') == 158
        and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-A-14-20260812-002'
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-14_REWORK_START_MANIFEST.json'
        and changed_paths == rework_projection_paths | live_paths | {rework_evidence_rel}
    )
    current_a14_r2_completion = (
        progress.get('event_sequence') == 161
        and progress.get('status') == 'TEST_REVIEW'
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R2.json'
        and (
            committed_clean
            or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths
        )
    )
    current_a14_r3_rework = (
        progress.get('event_sequence') == 165
        and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-A-14-20260813-003'
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-14_REWORK_START_MANIFEST_R3.json'
        and (
            committed_clean
            or (
                live_paths <= changed_paths
                and changed_paths
                <= set(progress.get('write_lease', {}).get('paths', []))
                | {'docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R3.json'}
            )
        )
    )
    current_a14_r3_completion = (
        progress.get('event_sequence') == 168
        and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-A-14-20260813-003'
        and progress.get('active_work_instruction', {}).get('independent_tester_status') == 'R4_PENDING'
        and progress.get('worker_lease') is None
        and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R3.json'
        and (
            committed_clean
            or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths
        )
    )
    completion_developer_binding_valid = (
        not a14_r3_completion
        or a14_r3_completion.get('developer_evidence', {}).get('manifest_sha256')
        == hashlib.sha256(a14_r3_evidence_path.read_bytes()).hexdigest().upper()
    )
    a14_r4_takeover_paths = live_paths | {
        'docs/evidence/manifests/A-14_MAIN_TAKEOVER_EVIDENCE_R4.json',
        'docs/test_reports/A-14_RETEST_REPORT_R4.md',
        'docs/work_orders/A-14_MAIN_TAKEOVER_PACKET_R4.md',
    }
    current_a14_r4_takeover = (
        (committed_clean or (live_paths <= changed_paths <= a14_r4_takeover_paths))
        and bool(a14_r4_takeover)
        and a14_r4_report_path.is_file()
        and a14_r4_packet_path.is_file()
        and progress.get('event_sequence') == 168
        and progress.get('status') == 'TEST_REVIEW'
        and a14_r4_takeover.get('source_report_sha256')
        == hashlib.sha256(a14_r4_report_path.read_bytes()).hexdigest().upper()
        and a14_r4_takeover.get('takeover_packet_sha256')
        == hashlib.sha256(a14_r4_packet_path.read_bytes()).hexdigest().upper()
    )
    current_a14_r4_completion = (
        bool(a14_r4_completion)
        and progress.get('event_sequence') == 171
        and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('independent_tester_status') == 'R5_PENDING'
        and progress.get('worker_lease') is None
        and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-14_MAIN_TAKEOVER_COMPLETION_MANIFEST_R4.json'
        and (
            committed_clean
            or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths
        )
        and a14_r4_completion.get('takeover_status') == 'MAIN_AGENT_TAKEOVER_COMPLETED'
        and a14_r4_completion.get('source_report_sha256')
        == hashlib.sha256(a14_r4_report_path.read_bytes()).hexdigest().upper()
        and a14_r4_completion.get('takeover_packet_sha256')
        == hashlib.sha256(a14_r4_packet_path.read_bytes()).hexdigest().upper()
    )
    current_a14_acceptance = (
        bool(a14_acceptance)
        and progress.get('event_sequence') == 175
        and progress.get('current_work_package') == 'A-15'
        and progress.get('status') == 'READY'
        and progress.get('active_work_instruction') is None
        and progress.get('worker_lease') is None
        and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json'
        and (
            committed_clean
            or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths
        )
    )
    current_a15_start = (
        bool(a15_start)
        and progress.get('event_sequence') == 178
        and progress.get('current_work_package') == 'A-15'
        and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id')
        == 'WI-A-15-20260813-001'
        and progress.get('worker_lease', {}).get('lease_epoch') == 1
        and progress.get('write_lease', {}).get('write_epoch') == 1
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-15_START_EVIDENCE_MANIFEST.json'
        and (
            committed_clean
            or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths
        )
    )
    current_a15_completion = (
        bool(a15_completion)
        and progress.get('event_sequence') == 181
        and progress.get('current_work_package') == 'A-15'
        and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('artifact_id')
        == 'WI-A-15-20260813-001'
        and progress.get('active_work_instruction', {}).get('independent_tester_status') == 'PENDING'
        and progress.get('worker_lease') is None
        and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-15_COMPLETION_PROGRESS_MANIFEST.json'
        and (
            committed_clean
            or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths
        )
        and a15_completion.get('developer_evidence', {}).get('manifest_sha256')
        == hashlib.sha256((root / 'docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json').read_bytes()).hexdigest().upper()
    )
    current_a15_acceptance_dir1 = (
        bool(a15_acceptance_dir1)
        and progress.get('event_sequence') == 184
        and progress.get('current_work_package') == 'A-15'
        and progress.get('status') == 'DIR_HOLD'
        and progress.get('active_work_instruction') is None
        and progress.get('active_agent') is None
        and progress.get('worker_lease') is None
        and progress.get('write_lease') is None
        and progress.get('dir_review', {}).get('checkpoint') == 'DIR-1'
        and progress.get('dir_review', {}).get('status') == 'WAITING_OWNER_DIRECTION'
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-15_ACCEPTANCE_DIR1_PROGRESS_MANIFEST.json'
        and (
            committed_clean
            or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths
        )
    )
    current_a_gate = (
        bool(a_gate)
        and progress.get('event_sequence') == 186
        and progress.get('current_work_package') == 'B-01'
        and progress.get('status') == 'READY'
        and progress.get('active_work_instruction') is None
        and progress.get('active_agent') is None
        and progress.get('worker_lease') is None
        and progress.get('write_lease') is None
        and progress.get('dir_review', {}).get('status') == 'CLEARED'
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path')
        == 'docs/evidence/manifests/A-GATE_DECISION_PROGRESS_MANIFEST.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b01_start = (
        bool(b01_start)
        and progress.get('event_sequence') == 189
        and progress.get('current_work_package') == 'B-01'
        and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-01-20260813-001'
        and progress.get('worker_lease', {}).get('lease_epoch') == 1
        and progress.get('write_lease', {}).get('write_epoch') == 1
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-01_START_EVIDENCE_MANIFEST.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b01_completion = (
        bool(b01_completion) and progress.get('event_sequence') == 192
        and progress.get('current_work_package') == 'B-01' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-01_COMPLETION_PROGRESS_MANIFEST.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b01_rework = (
        bool(b01_rework) and progress.get('event_sequence') == 196
        and progress.get('current_work_package') == 'B-01' and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-01-20260813-002'
        and progress.get('worker_lease', {}).get('lease_epoch') == 2
        and progress.get('write_lease', {}).get('write_epoch') == 2
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R2.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b01_r2_completion = (
        bool(b01_r2_completion) and progress.get('event_sequence') == 199
        and progress.get('current_work_package') == 'B-01' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b01_r3_rework = (
        bool(b01_r3_rework) and progress.get('event_sequence') == 203
        and progress.get('current_work_package') == 'B-01' and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-01-20260814-003'
        and progress.get('worker_lease', {}).get('lease_epoch') == 3
        and progress.get('write_lease', {}).get('write_epoch') == 3
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-01_REWORK_START_PROGRESS_MANIFEST_R3.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b01_r3_completion = (
        bool(b01_r3_completion) and progress.get('event_sequence') == 206
        and progress.get('current_work_package') == 'B-01' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-01-20260814-003'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-01_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b01_r3_acceptance = (
        bool(b01_r3_acceptance) and progress.get('event_sequence') == 207
        and progress.get('current_work_package') == 'B-02' and progress.get('status') == 'READY'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-01_ACCEPTANCE_PROGRESS_MANIFEST_R3.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b02_start = (
        bool(b02_start) and progress.get('event_sequence') == 210
        and progress.get('current_work_package') == 'B-02' and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-02-20260814-001'
        and progress.get('worker_lease', {}).get('lease_epoch') == 1
        and progress.get('write_lease', {}).get('write_epoch') == 1
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-02_START_EVIDENCE_MANIFEST.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b02_completion = (
        bool(b02_completion) and progress.get('event_sequence') == 213
        and progress.get('current_work_package') == 'B-02' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-02-20260814-001'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-02_COMPLETION_PROGRESS_MANIFEST.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b02_rework = (
        bool(b02_rework) and progress.get('event_sequence') == 217
        and progress.get('current_work_package') == 'B-02' and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-02-20260814-002'
        and progress.get('worker_lease', {}).get('lease_epoch') == 2
        and progress.get('write_lease', {}).get('write_epoch') == 2
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-02_REWORK_START_PROGRESS_MANIFEST_R2.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b02_r2_completion = (
        bool(b02_r2_completion) and progress.get('event_sequence') == 220
        and progress.get('current_work_package') == 'B-02' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-02_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b02_r2_acceptance = (
        bool(b02_r2_acceptance) and progress.get('event_sequence') == 221
        and progress.get('current_work_package') == 'B-03' and progress.get('status') == 'READY'
        and progress.get('active_work_instruction') is None and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-02_ACCEPTANCE_PROGRESS_MANIFEST_R2.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b03_start = (
        bool(b03_start) and progress.get('event_sequence') == 224
        and progress.get('current_work_package') == 'B-03' and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-03-20260814-001'
        and progress.get('worker_lease', {}).get('lease_epoch') == 1
        and progress.get('write_lease', {}).get('write_epoch') == 1
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-03_START_EVIDENCE_MANIFEST.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    current_b03_completion = (
        bool(b03_completion) and progress.get('event_sequence') == 227
        and progress.get('current_work_package') == 'B-03' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-03-20260814-001'
        and progress.get('active_work_instruction', {}).get('independent_tester_status') == 'PENDING'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-03_COMPLETION_PROGRESS_MANIFEST.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    candidates: list[dict[str, Any]] = []
    current_b03_r2_completion = (
        bool(b03_r2_completion) and progress.get('event_sequence') == 233
        and progress.get('current_work_package') == 'B-03' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-03-20260814-002'
        and progress.get('active_work_instruction', {}).get('independent_tester_status') == 'R2_PENDING'
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R2.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    if current_b03_r2_completion:
        candidates.append(b03_r2_completion.get('a13_successor_projection', {}))
    current_b03_r3_rework = (
        bool(b03_r3_rework) and progress.get('event_sequence') == 237
        and progress.get('current_work_package') == 'B-03' and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-03-20260814-003'
        and progress.get('valid_failure_count') == 1
        and progress.get('worker_lease', {}).get('lease_epoch') == 3
        and progress.get('write_lease', {}).get('write_epoch') == 3
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R3.json'
        and (committed_clean or set(progress.get('write_lease', {}).get('paths', [])) == changed_paths)
    )
    if current_b03_r3_rework:
        if (
            b03_r3_evidence
            and set(b03_r3_evidence.get('exact_write_paths', [])) == changed_paths
            and b03_r3_evidence.get('self_reference') is False
        ):
            candidates.append(b03_r3_evidence.get('a13_successor_projection', {}))
        candidates.append(b03_r3_rework.get('a13_successor_projection', {}))
    current_b03_r3_completion = (
        bool(b03_r3_completion) and progress.get('event_sequence') == 240
        and progress.get('current_work_package') == 'B-03' and progress.get('status') == 'TEST_REVIEW'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-03-20260814-003'
        and progress.get('active_work_instruction', {}).get('independent_tester_status') == 'R3_PENDING'
        and progress.get('valid_failure_count') == 1
        and progress.get('worker_lease') is None and progress.get('write_lease') is None
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-03_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    if current_b03_r3_completion:
        candidates.append(b03_r3_completion.get('a13_successor_projection', {}))
    current_b03_rework = (
        bool(b03_rework) and progress.get('event_sequence') == 230
        and progress.get('current_work_package') == 'B-03' and progress.get('status') == 'ACTIVE'
        and progress.get('active_work_instruction', {}).get('artifact_id') == 'WI-B-03-20260814-002'
        and progress.get('valid_failure_count') == 0
        and progress.get('worker_lease', {}).get('lease_epoch') == 2
        and progress.get('write_lease', {}).get('write_epoch') == 2
        and progress.get('current_progress_evidence_ref', {}).get('manifest_path') == 'docs/evidence/manifests/B-03_REWORK_START_PROGRESS_MANIFEST_R2.json'
        and (committed_clean or set(progress.get('repository', {}).get('exact_allowed_paths', [])) == changed_paths)
    )
    if current_b03_rework:
        candidates.append(b03_rework.get('a13_successor_projection', {}))
    if current_b03_completion:
        candidates.append(b03_completion.get('a13_successor_projection', {}))
    if current_b03_start:
        candidates.append(b03_start.get('a13_successor_projection', {}))
    if current_b02_r2_acceptance:
        candidates.append(b02_r2_acceptance.get('a13_successor_projection', {}))
    if current_b02_r2_completion:
        candidates.append(b02_r2_completion.get('a13_successor_projection', {}))
    if current_b02_rework:
        candidates.append(b02_rework.get('a13_successor_projection', {}))
    if current_b02_completion:
        candidates.append(b02_completion.get('a13_successor_projection', {}))
    if current_b02_start:
        candidates.append(b02_start.get('a13_successor_projection', {}))
    if current_b01_r3_acceptance:
        candidates.append(b01_r3_acceptance.get('a13_successor_projection', {}))
    if current_b01_r3_completion:
        candidates.append(b01_r3_completion.get('a13_successor_projection', {}))
    if current_b01_r3_rework:
        candidates.append(b01_r3_rework.get('a13_successor_projection', {}))
    if current_b01_r2_completion:
        candidates.append(b01_r2_completion.get('a13_successor_projection', {}))
    if current_b01_rework:
        candidates.append(b01_rework.get('a13_successor_projection', {}))
    if current_b01_completion:
        candidates.append(b01_completion.get('a13_successor_projection', {}))
    if current_b01_start:
        candidates.append(b01_start.get('a13_successor_projection', {}))
    if current_a_gate:
        candidates.append(a_gate.get('a13_successor_projection', {}))
    if current_a15_acceptance_dir1:
        candidates.append(a15_acceptance_dir1.get('a13_successor_projection', {}))
    if current_a15_completion:
        candidates.append(a15_completion.get('a13_successor_projection', {}))
    if current_a15_start:
        candidates.append(a15_start.get('a13_successor_projection', {}))
    if current_a14_acceptance:
        candidates.append(a14_acceptance.get('a13_successor_projection', {}))
    if committed_clean:
        for registry_path in sorted(
            (root / 'docs/evidence/manifests').glob('A-14_A13_SUCCESSOR_*.json'),
            reverse=True,
        ):
            try:
                registry = _load_json(registry_path)
            except (OSError, json.JSONDecodeError):
                continue
            if (
                registry.get('self_reference') is False
                and registry.get('package_id') == 'A-14'
                and registry.get('artifact_type') == 'a13_successor_registry'
            ):
                candidates.append(registry.get('a13_successor_projection', {}))
    if current_a14_r4_completion:
        candidates.append(a14_r4_completion.get('a13_successor_projection', {}))
    if current_a14_r4_takeover:
        candidates.append(a14_r4_takeover.get('a13_successor_projection', {}))
    if current_a14_r3_completion and completion_developer_binding_valid:
        candidates.append(a14_r3_completion.get('a13_successor_projection', {}))
        candidates.append(a14_r3_evidence.get('a13_successor_projection', {}))
    if current_a14_r3_rework:
        if completion_developer_binding_valid:
            candidates.append(a14_r3_completion.get('a13_successor_projection', {}))
        candidates.append(a14_r3_evidence.get('a13_successor_projection', {}))
        candidates.append(a14_r3_rework.get('a13_successor_projection', {}))
    if current_a14_r2_completion:
        candidates.append(a14_r2_completion.get('a13_successor_projection', {}))
        candidates.append(a14_rework_evidence.get('developer_successor_projection', {}))
        candidates.append(a14_r2_completion.get('developer_revision2_evidence', {}))
    if current_a14_rework:
        candidates.append(a14_rework_evidence.get('developer_successor_projection', {}))
        candidates.append(a14_rework.get('developer_successor_projection', {}))
    if current_a14_completion:
        candidates.append(a14_completion.get('developer_successor_projection', {}))
    if current_start:
        candidates.append(start.get("developer_successor_projection", {}))
    if committed_clean or current_acceptance:
        candidates.append(acceptance.get("developer_successor_projection", {}))
    if committed_clean or current_completion:
        candidates.append(completion.get("developer_successor_projection", {}))
    for successor in candidates:
        rows = successor.get("live_raw_checksums", [])
        indexed = {row.get("path"): row for row in rows if isinstance(row, dict)}
        if successor.get("predecessor_manifest_sha256") != predecessor_sha or not live_paths <= set(indexed):
            continue
        valid = True
        for path, row in indexed.items():
            payload = (root / path).read_bytes()
            if row.get("bytes") != len(payload) or row.get("sha256") != hashlib.sha256(payload).hexdigest().upper():
                valid = False
                break
        if valid:
            return indexed
    return None

def validate_evidence_manifest(root: Path) -> list[str]:
    root = root.resolve()
    errors: list[str] = []
    manifest_path = root / EVIDENCE_R2_REL
    if manifest_path.is_file():
        try:
            manifest = _load_json(manifest_path)
            changed_paths = _git_changed_paths(root)
        except (OSError, json.JSONDecodeError):
            return ["EVIDENCE_MANIFEST_MISSING_OR_INVALID"]
        except subprocess.SubprocessError:
            return ["EVIDENCE_GIT_STATUS_UNAVAILABLE"]
        return _validate_revision2_manifest(root, manifest, changed_paths)
    try:
        manifest = _load_json(root / EVIDENCE_REL)
    except (OSError, json.JSONDecodeError):
        return ["EVIDENCE_MANIFEST_MISSING_OR_INVALID"]
    raw = manifest.get("raw_artifacts", [])
    if not isinstance(raw, list) or not raw:
        return ["EVIDENCE_RAW_ARTIFACTS_INVALID"]
    if manifest.get("self_reference") is not False:
        errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    try:
        changed_paths = _git_changed_paths(root)
    except (OSError, subprocess.SubprocessError):
        changed_paths = set()
        errors.append("EVIDENCE_GIT_STATUS_UNAVAILABLE")
    try:
        completion = _load_json(root / "docs/evidence/manifests/A-13_COMPLETION_PROGRESS_MANIFEST.json")
        successor_predecessor = completion.get("developer_successor_projection", {}).get(
            "predecessor_manifest_sha256"
        )
        actual_predecessor = hashlib.sha256((root / EVIDENCE_REL).read_bytes()).hexdigest().upper()
        if successor_predecessor != actual_predecessor:
            errors.append("EVIDENCE_PREDECESSOR_BINDING_MISMATCH")
    except (OSError, json.JSONDecodeError):
        errors.append("EVIDENCE_PREDECESSOR_BINDING_MISMATCH")
    successor = _successor_projection(root, changed_paths)
    observed_paths: set[str] = set()
    content_bytes = 0
    for item in raw:
        path = str(item.get("path", ""))
        file_path = root / path
        if not path or path in observed_paths or path == EVIDENCE_REL:
            errors.append("EVIDENCE_RAW_PATH_INVALID")
            continue
        observed_paths.add(path)
        if not file_path.is_file():
            errors.append("EVIDENCE_RAW_ARTIFACT_MISSING")
            continue
        payload = file_path.read_bytes()
        successor_bound = path in (successor or {})
        content_bytes += item.get("bytes", 0) if successor_bound else len(payload)
        if item.get("bytes") != len(payload) and not successor_bound:
            errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != hashlib.sha256(payload).hexdigest().upper() and not successor_bound:
            errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    projection = _projection(raw)
    target = hashlib.sha256(projection).hexdigest().upper()
    if observed_paths != RAW_PATHS:
        errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    if manifest.get("declared_changed_paths") != sorted(DECLARED_CHANGED_PATHS):
        errors.append("EVIDENCE_DECLARED_DIFF_MISMATCH")
    if changed_paths != DECLARED_CHANGED_PATHS and successor is None:
        errors.append("EVIDENCE_ACTUAL_DIFF_MISMATCH")
    if manifest.get("target_canonical_bytes") != len(projection):
        errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    if manifest.get("target_content_bytes") != content_bytes:
        errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    if manifest.get("target_hash") != target or manifest.get("delivered_hash") != target:
        errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    expected = {
        "package_id": "A-13",
        "work_instruction_sha256": "88B142690358661F456C715378B9AFACE5340FC4EBED90D567E07C8B58384835",
        "assigned_verification_ids": ["AV-SAFE-010", "AV-SAFE-012"],
        "execution_classification": "FIXTURE_INTEGRATION_ONLY",
        "runtime_status": "ACTUAL_RUNTIME / NOT_EXECUTED",
    }
    if any(manifest.get(key) != value for key, value in expected.items()):
        errors.append("EVIDENCE_QUALIFIER_MISMATCH")
    return sorted(set(errors))


def validate_bundle(root: Path) -> dict[str, Any]:
    root = root.resolve()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    from packages.repository_intelligence import ScanRequest, ScanResult, scan_repository

    errors = validate_evidence_manifest(root)
    if errors:
        return {
            "errors": sorted(set(errors)),
            "fixture_count": 0,
            "zero_delta_count": 0,
            "hostile_case_count": 0,
        }
    contract_path = root / "docs/architecture/a13/A-13_REPOSITORY_SCAN_CONTRACT.json"
    hostile_path = root / "tests/fixtures/a13/hostile-cases.json"
    materializer_path = root / "scripts/materialize_fixture_repository.py"
    try:
        contract = _load_json(contract_path)
        hostile = _load_json(hostile_path)
        materializer = _load_module(materializer_path, "a13_checker_materializer")
    except (OSError, json.JSONDecodeError, RuntimeError) as exc:
        return {
            "errors": [f"BUNDLE_LOAD_ERROR:{type(exc).__name__}"],
            "fixture_count": 0,
            "zero_delta_count": 0,
            "hostile_case_count": 0,
        }

    if set(contract.get("result_fields", [])) != EXPECTED_RESULT_FIELDS:
        errors.append("RESULT_SCHEMA_MISMATCH")
    if set(contract.get("git_command_ids", [])) != EXPECTED_COMMAND_IDS:
        errors.append("GIT_COMMAND_ALLOWLIST_MISMATCH")
    if contract.get("inventory_fields") != ["path", "type", "size", "mtime_ns", "sha256", "mode"]:
        errors.append("INVENTORY_SCHEMA_MISMATCH")
    if set(ScanResult.schema_fields()) != EXPECTED_RESULT_FIELDS:
        errors.append("PUBLIC_RESULT_SCHEMA_MISMATCH")
    cases = hostile.get("cases")
    if not isinstance(cases, list) or len(cases) != 15:
        errors.append("HOSTILE_CASE_COUNT_MISMATCH")
        cases = []
    if len({case.get("case_id") for case in cases}) != len(cases):
        errors.append("HOSTILE_CASE_DUPLICATE")
    if any(case.get("network_allowed") is not False for case in cases):
        errors.append("HOSTILE_NETWORK_POLICY_MISMATCH")
    if any(case.get("project_execution_allowed") is not False for case in cases):
        errors.append("HOSTILE_PROJECT_EXECUTION_POLICY_MISMATCH")

    zero_delta_count = 0
    with tempfile.TemporaryDirectory(prefix="anvil-a13-") as temp:
        temp_root = Path(temp)
        for fixture_id in FIXTURE_IDS:
            try:
                repo = materializer.materialize_fixture(root, fixture_id, temp_root / fixture_id)
                before_dirty = materializer.snapshot_worktree(repo)
                result = scan_repository(
                    ScanRequest(
                        repository_path=str(repo),
                        allowed_root=str(temp_root),
                        temp_root=str(temp_root / "scanner-temp"),
                    )
                )
                after_dirty = materializer.snapshot_worktree(repo)
            except Exception as exc:  # checker must report all fixtures, not stop at the first
                errors.append(f"FIXTURE_SCAN_EXCEPTION:{fixture_id}:{type(exc).__name__}")
                continue
            if not result.success:
                errors.append(f"FIXTURE_SCAN_REJECTED:{fixture_id}:{result.errors[0].code}")
                continue
            if before_dirty != after_dirty:
                errors.append(f"FIXTURE_DIRTY_STATE_CHANGED:{fixture_id}")
            if not result.no_write_proof.get("identical"):
                errors.append(f"FIXTURE_ZERO_DELTA_FAILED:{fixture_id}")
            else:
                zero_delta_count += 1
            observed_commands = {
                entry.get("command_id")
                for entry in (result.repository or {}).get("git_command_evidence", [])
            }
            if observed_commands != EXPECTED_COMMAND_IDS:
                errors.append(f"FIXTURE_GIT_COMMAND_SET_MISMATCH:{fixture_id}")
            if any(
                entry.get("environment", {}).get("GIT_OPTIONAL_LOCKS") != "0"
                or entry.get("network_allowed") is not False
                or entry.get("writes_allowed") is not False
                for entry in (result.repository or {}).get("git_command_evidence", [])
            ):
                errors.append(f"FIXTURE_GIT_POLICY_MISMATCH:{fixture_id}")

    return {
        "errors": sorted(set(errors)),
        "fixture_count": len(FIXTURE_IDS),
        "zero_delta_count": zero_delta_count,
        "hostile_case_count": len(cases),
    }


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    root = Path(arguments[0]).resolve() if arguments else Path.cwd()
    report = validate_bundle(root)
    if report["errors"]:
        for error in report["errors"]:
            print(error)
        return 1
    print(
        "A-13 repository scan: "
        f"fixtures={report['fixture_count']} "
        f"zero_delta={report['zero_delta_count']} "
        f"hostile={report['hostile_case_count']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
