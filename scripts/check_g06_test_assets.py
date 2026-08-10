"""Validate G-06 fixture, golden, scenario, and fault assets without dependencies."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Mapping


FIXTURE_IDS = {
    "FIX-PY-CLEAN", "FIX-PY-DIRTY", "FIX-PY-REDFAIL", "FIX-TS-CLEAN",
    "FIX-TS-NOTOOL", "FIX-PROTECTED", "FIX-LARGE", "FIX-CONFLICT",
}
SCENARIO_AUTHORITY_MAP = {
    "S49-17-01": {"verification_id": "AV-STAT-041", "responsible_packages": ("A-15", "C-15", "E-11"), "evidence_types": ("E-EVT", "E-PRG")},
    "S49-17-02": {"verification_id": "AV-STAT-042", "responsible_packages": ("A-15", "C-15", "D-13", "E-11"), "evidence_types": ("E-DEC", "E-EVT", "E-PRG")},
    "S49-17-03": {"verification_id": "AV-FLOW-024", "responsible_packages": ("E-09",), "evidence_types": ("E-API", "E-AUD")},
    "S49-17-04": {"verification_id": "AV-FLOW-025", "responsible_packages": ("E-09",), "evidence_types": ("E-DEC", "E-EVT")},
    "S49-17-05": {"verification_id": "AV-STAT-043", "responsible_packages": ("B-09",), "evidence_types": ("E-AUD", "E-EVT")},
    "S49-17-06": {"verification_id": "AV-SAFE-028", "responsible_packages": ("B-09", "E-06"), "evidence_types": ("E-AUD", "E-EVT")},
    "S49-17-07": {"verification_id": "AV-AGT-038", "responsible_packages": ("E-08",), "evidence_types": ("E-API", "E-AUD", "E-EVT")},
    "S49-17-08": {"verification_id": "AV-OPS-019", "responsible_packages": ("E-08",), "evidence_types": ("E-API", "E-AUD", "E-EVT")},
    "S49-17-09": {"verification_id": "AV-SAFE-029", "responsible_packages": ("B-11", "F-15"), "evidence_types": ("E-API", "E-AUD")},
    "S49-17-10": {"verification_id": "AV-SAFE-030", "responsible_packages": ("F-01", "F-11"), "evidence_types": ("E-AUD", "E-NET")},
    "S49-17-11": {"verification_id": "AV-SAFE-031", "responsible_packages": ("B-12", "F-01"), "evidence_types": ("E-AUD", "E-EVT")},
    "S49-17-12": {"verification_id": "AV-SAFE-032", "responsible_packages": ("F-01", "F-02"), "evidence_types": ("E-AUD", "E-NET")},
    "S49-17-13": {"verification_id": "AV-LRN-027", "responsible_packages": ("D-03", "D-06"), "evidence_types": ("E-AUD", "E-EVT")},
    "S49-17-14": {"verification_id": "AV-LRN-028", "responsible_packages": ("D-11", "F-02"), "evidence_types": ("E-AUD", "E-TEST")},
    "S49-17-15": {"verification_id": "AV-GATE-025", "responsible_packages": ("E-09", "F-20"), "evidence_types": ("E-AUD", "E-MAN")},
    "S49-17-16": {"verification_id": "AV-OPS-020", "responsible_packages": ("F-18",), "evidence_types": ("E-AUD", "E-GIT", "E-MAN")},
    "S49-17-17": {"verification_id": "AV-OPS-021", "responsible_packages": ("F-16", "F-18"), "evidence_types": ("E-AUD", "E-CMD", "E-GIT")},
    "S49-17-18": {"verification_id": "AV-OPS-022", "responsible_packages": ("F-14", "F-20"), "evidence_types": ("E-DEC", "E-EVT")},
    "S49-17-19": {"verification_id": "AV-OPS-023", "responsible_packages": ("F-20",), "evidence_types": ("E-NET", "E-SHOT")},
    "S49-17-20": {"verification_id": "AV-OPS-024", "responsible_packages": ("F-20",), "evidence_types": ("E-DEC", "E-EVT", "E-MAN")},
}
SCENARIO_MAP = {
    scenario_id: contract["verification_id"]
    for scenario_id, contract in SCENARIO_AUTHORITY_MAP.items()
}
FAULT_MAP = {
    "FI-01": ["AV-STAT-013"], "FI-02": ["AV-STAT-012"],
    "FI-03": ["AV-STAT-013"], "FI-04": ["AV-STAT-026", "AV-STAT-027"],
    "FI-05": ["AV-STAT-036"], "FI-06": ["AV-STAT-036"],
    "FI-07": ["AV-STAT-038", "AV-STAT-039"], "FI-08": ["AV-UI-016"],
}
ACTUAL_SECRET_PATTERNS = (
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)
GOLDEN_HASH_PREFIX = "sha256:"
GOLDEN_BASELINE_PATH = "tests/fixtures/golden/golden-baseline-candidate.json"
GOLDEN_ANCHOR_PATH = "docs/baselines/G-06_GOLDEN_BASELINE_ANCHOR.md"
GOLDEN_ROOT_APPROVAL = "APPROVAL-20260810-INTEGRATED-BASELINE-001"
GOLDEN_ROOT_APPROVAL_PATH = "docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md"
GOLDEN_ROOT_APPROVAL_SUBJECT_HASH = "C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8"
GOLDEN_ROOT_APPROVAL_FILE_SHA256 = "94A82676DB9BF0EE23B55B0A59CBAC706AF7D8617B61BBB9887357E300FDFDC7"
GOLDEN_ROOT_APPROVAL_SCOPE = "설계서 v2.6, 작업계획서 v1.3, 검증문서 v1.1, 운영규칙 v1.3, D1~D10 진행 기준"
GOLDEN_ORIGIN_WORK_INSTRUCTION = {
    "artifact_id": "WI-G-06-20260810-002",
    "content_hash": "sha256:F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E",
}


def _json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def content_hash(value: Mapping[str, Any], field: str) -> str:
    material = dict(value)
    material.pop(field, None)
    return GOLDEN_HASH_PREFIX + hashlib.sha256(canonical_json_bytes(material)).hexdigest().upper()


def stable_failure_fingerprint(output: str, fixture_root: Path) -> str:
    """Hash stable unittest failure identity, not timing, paths, or object addresses."""
    normalized = output.replace("\r\n", "\n").replace("\r", "\n")
    root_variants = {str(fixture_root), fixture_root.as_posix()}
    for root in sorted(root_variants, key=len, reverse=True):
        if root:
            normalized = normalized.replace(root, "<FIXTURE_ROOT>")
    normalized = re.sub(r"0x[0-9A-Fa-f]+", "<ADDRESS>", normalized)
    header_pattern = re.compile(r"^(FAIL|ERROR):\s+(.+?)(?:\s+\(([^)]+)\))?\s*$")
    exception_pattern = re.compile(
        r"^([A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception|Failure))(?::\s?(.*))?$"
    )
    lines = normalized.split("\n")
    records: list[dict[str, str]] = []
    for index, line in enumerate(lines):
        header = header_pattern.match(line)
        if not header:
            continue
        outcome, short_id, qualified_id = header.groups()
        exception_type = ""
        exception_message = ""
        for candidate in lines[index + 1 :]:
            if header_pattern.match(candidate) or candidate.startswith("Ran "):
                break
            match = exception_pattern.match(candidate.strip())
            if match:
                exception_type = match.group(1)
                exception_message = match.group(2) or ""
        if not exception_type:
            raise ValueError(f"FAILURE_EXCEPTION_IDENTITY_MISSING:{qualified_id or short_id}")
        records.append(
            {
                "exception_message": exception_message,
                "exception_type": exception_type,
                "outcome": outcome,
                "test_id": qualified_id or short_id,
            }
        )
    if not records:
        raise ValueError("FAILURE_TEST_IDENTITY_MISSING")
    material = {"schema_version": "1.0.0", "failures": sorted(records, key=lambda item: tuple(item.values()))}
    return hashlib.sha256(canonical_json_bytes(material)).hexdigest().upper()


def _canonical_package_set(value: Any) -> set[str]:
    if isinstance(value, str):
        return {part.strip() for part in value.split(",") if part.strip()}
    if isinstance(value, list):
        return {str(part).strip() for part in value if str(part).strip()}
    return set()


def canonical_golden_case_hash_bytes(case_hashes: list[Mapping[str, Any]]) -> bytes:
    rows = []
    for entry in case_hashes:
        case_id = entry.get("case_id")
        golden_hash = entry.get("golden_content_hash")
        if not isinstance(case_id, str) or not case_id or not isinstance(golden_hash, str):
            raise ValueError("GOLDEN_BASELINE_CASE_ENTRY_INVALID")
        rows.append(f"{case_id}\t{golden_hash}")
    if len(rows) != len(set(rows)):
        raise ValueError("GOLDEN_BASELINE_CASE_DUPLICATE")
    return "\n".join(sorted(rows, key=lambda row: row.encode("utf-8"))).encode("utf-8")


def validate_golden_baseline_candidate(
    baseline: Mapping[str, Any],
    index: Mapping[str, Any],
    lock: Mapping[str, Any],
    cases: list[Mapping[str, Any]],
) -> list[str]:
    errors: list[str] = []
    required = {
        "schema_version", "baseline_id", "artifact_status", "origin_approval_ref",
        "origin_work_instruction_ref", "lineage_policy", "case_hash_algorithm",
        "case_hashes", "aggregate_hash", "subject_hash", "immutable_anchor",
    }
    errors.extend(f"GOLDEN_BASELINE_FIELD_REQUIRED:{field}" for field in sorted(required - set(baseline)))
    if baseline.get("artifact_status") != "CANDIDATE_AWAITING_MAIN_APPROVAL":
        errors.append("GOLDEN_BASELINE_STATUS_INVALID")
    if baseline.get("origin_approval_ref") != GOLDEN_ROOT_APPROVAL:
        errors.append("GOLDEN_BASELINE_ROOT_APPROVAL_INVALID")
    if baseline.get("origin_work_instruction_ref") != GOLDEN_ORIGIN_WORK_INSTRUCTION:
        errors.append("GOLDEN_BASELINE_ORIGIN_WORK_INSTRUCTION_INVALID")
    if baseline.get("lineage_policy") != "IMMUTABLE_ORIGIN_ROOT_APPROVAL_NO_CURRENT_WI_REHASH":
        errors.append("GOLDEN_BASELINE_LINEAGE_POLICY_INVALID")
    if baseline.get("case_hash_algorithm") != {
        "row_format": "case_id<TAB>golden_content_hash",
        "sort": "UTF-8 byte ordinal",
        "row_separator": "LF",
        "final_newline": False,
        "hash_algorithm": "SHA-256",
    }:
        errors.append("GOLDEN_BASELINE_ALGORITHM_INVALID")
    case_hashes = baseline.get("case_hashes")
    if not isinstance(case_hashes, list):
        return sorted(set(errors + ["GOLDEN_BASELINE_CASES_REQUIRED"]))
    try:
        aggregate = GOLDEN_HASH_PREFIX + hashlib.sha256(canonical_golden_case_hash_bytes(case_hashes)).hexdigest().upper()
    except ValueError as exc:
        return sorted(set(errors + [str(exc)]))
    if baseline.get("aggregate_hash") != aggregate:
        errors.append("GOLDEN_BASELINE_AGGREGATE_MISMATCH")
    if baseline.get("subject_hash") != content_hash(baseline, "subject_hash"):
        errors.append("GOLDEN_BASELINE_SUBJECT_HASH_MISMATCH")
    if baseline.get("immutable_anchor") != {
        "path": GOLDEN_ANCHOR_PATH,
        "required_author": "main-agent-eoul",
        "required_subject_field": "subject_hash",
        "evidence_class": "IMMUTABLE_EVIDENCE_WITHIN_EXISTING_HUMAN_APPROVAL",
    }:
        errors.append("GOLDEN_BASELINE_ANCHOR_CONTRACT_INVALID")

    baseline_map = {entry.get("case_id"): entry.get("golden_content_hash") for entry in case_hashes}
    index_ids = {entry.get("case_id") for entry in index.get("cases", []) if isinstance(entry, dict)}
    lock_map = {
        entry.get("case_id"): entry.get("golden_content_hash")
        for entry in lock.get("case_locks", []) if isinstance(entry, dict)
    }
    observed_map = {case.get("case_id"): case.get("golden_content_hash") for case in cases}
    if set(baseline_map) != index_ids or len(baseline_map) != 8:
        errors.append("GOLDEN_BASELINE_CASE_SET_MISMATCH")
    if baseline_map != lock_map or baseline_map != observed_map:
        errors.append("GOLDEN_BASELINE_CASE_HASH_MISMATCH")
    if lock.get("owner_approval_ref") != baseline.get("origin_approval_ref"):
        errors.append("GOLDEN_BASELINE_LOCK_LINEAGE_MISMATCH")
    if {
        case.get("owner_approval_ref") for case in cases
    } != {baseline.get("origin_approval_ref")}:
        errors.append("GOLDEN_BASELINE_CASE_LINEAGE_MISMATCH")
    if lock.get("work_instruction_id") != GOLDEN_ORIGIN_WORK_INSTRUCTION["artifact_id"] or lock.get(
        "work_instruction_sha256"
    ) != GOLDEN_ORIGIN_WORK_INSTRUCTION["content_hash"].removeprefix("sha256:"):
        errors.append("GOLDEN_BASELINE_LOCK_ORIGIN_WI_MISMATCH")
    if {json.dumps(case.get("work_instruction_ref"), sort_keys=True) for case in cases} != {
        json.dumps(GOLDEN_ORIGIN_WORK_INSTRUCTION, sort_keys=True)
    }:
        errors.append("GOLDEN_BASELINE_CASE_ORIGIN_WI_MISMATCH")
    return sorted(set(errors))


def validate_golden_baseline_anchor(root: Path, baseline: Mapping[str, Any]) -> list[str]:
    anchor = baseline.get("immutable_anchor") or {}
    if anchor.get("path") != GOLDEN_ANCHOR_PATH:
        return ["GOLDEN_BASELINE_ANCHOR_PATH_INVALID"]
    anchor_path = root / GOLDEN_ANCHOR_PATH
    if not anchor_path.is_file():
        return ["GOLDEN_BASELINE_ANCHOR_MISSING"]
    root_approval_path = root / GOLDEN_ROOT_APPROVAL_PATH
    if not root_approval_path.is_file():
        return ["GOLDEN_BASELINE_PARENT_HUMAN_APPROVAL_MISSING"]
    root_text = root_approval_path.read_text(encoding="utf-8")
    root_matches = re.findall(r"(?m)^- ([a-z_]+): (?:`([^`]+)`|(.+))\s*$", root_text)
    root_fields = {key: backtick or plain for key, backtick, plain in root_matches}
    errors = []
    if root_fields.get("approval_id") != GOLDEN_ROOT_APPROVAL:
        errors.append("GOLDEN_BASELINE_PARENT_HUMAN_APPROVAL_ID_MISMATCH")
    if root_fields.get("subject_hash") != GOLDEN_ROOT_APPROVAL_SUBJECT_HASH:
        errors.append("GOLDEN_BASELINE_PARENT_HUMAN_APPROVAL_HASH_MISMATCH")
    if root_fields.get("scope") != GOLDEN_ROOT_APPROVAL_SCOPE:
        errors.append("GOLDEN_BASELINE_PARENT_HUMAN_APPROVAL_SCOPE_MISMATCH")
    actual_root_file_hash = hashlib.sha256(root_approval_path.read_bytes()).hexdigest().upper()
    if actual_root_file_hash != GOLDEN_ROOT_APPROVAL_FILE_SHA256:
        errors.append("GOLDEN_BASELINE_PARENT_HUMAN_APPROVAL_FILE_HASH_MISMATCH")

    candidate_path = root / GOLDEN_BASELINE_PATH
    actual_candidate_hash = hashlib.sha256(candidate_path.read_bytes()).hexdigest().upper()
    fields = dict(re.findall(r"(?m)^- ([a-z0-9_]+): `([^`]+)`\s*$", anchor_path.read_text(encoding="utf-8")))
    expected = {
        "anchor_type": "MAIN_AUTHORED_GOLDEN_BASELINE_ANCHOR",
        "recorded_by": "main-agent-eoul",
        "evidence_class": "IMMUTABLE_EVIDENCE_WITHIN_EXISTING_HUMAN_APPROVAL",
        "scope_effect": "NO_SCOPE_EXPANSION_NO_NEW_APPROVAL",
        "parent_human_approval_id": GOLDEN_ROOT_APPROVAL,
        "parent_human_approval_hash": GOLDEN_ROOT_APPROVAL_SUBJECT_HASH,
        "parent_human_approval_scope": GOLDEN_ROOT_APPROVAL_SCOPE,
        "parent_human_approval_file_sha256": GOLDEN_ROOT_APPROVAL_FILE_SHA256,
        "candidate_path": GOLDEN_BASELINE_PATH,
        "candidate_file_sha256": actual_candidate_hash,
        "aggregate_hash": str(baseline.get("aggregate_hash")),
        "exact_subject_hash": str(baseline.get("subject_hash")),
    }
    if not fields.get("anchor_id"):
        errors.append("GOLDEN_BASELINE_ANCHOR_ID_MISSING")
    for field, value in expected.items():
        if fields.get(field) != value:
            errors.append(f"GOLDEN_BASELINE_ANCHOR_{field.upper()}_MISMATCH")
    return sorted(set(errors))


def validate_hashed_index(
    root: Path,
    index: Mapping[str, Any],
    collection: str,
    path_field: str,
) -> list[str]:
    entries = index.get(collection)
    if not isinstance(entries, list):
        return [f"INDEX_COLLECTION_INVALID:{collection}"]
    errors: list[str] = []
    seen_paths: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append(f"INDEX_ENTRY_INVALID:{collection}")
            continue
        path = entry.get(path_field)
        if not isinstance(path, str) or not path or path in seen_paths:
            errors.append(f"INDEX_PATH_INVALID:{collection}")
            continue
        seen_paths.add(path)
        try:
            actual = hashlib.sha256((root / path).read_bytes()).hexdigest().upper()
        except OSError:
            errors.append(f"INDEX_FILE_MISSING:{path}")
            continue
        if entry.get("sha256") != actual:
            errors.append(f"INDEX_FILE_HASH_MISMATCH:{path}")
    return sorted(set(errors))


def validate_fixture_index(index: Mapping[str, Any]) -> list[str]:
    entries = index.get("fixtures")
    if not isinstance(entries, list):
        return ["FIXTURE_INDEX_LIST_REQUIRED"]
    ids = [entry.get("fixture_id") for entry in entries if isinstance(entry, dict)]
    errors: list[str] = []
    if len(ids) != len(set(ids)):
        errors.append("FIXTURE_ID_DUPLICATE")
    if set(ids) != FIXTURE_IDS or len(ids) != 8:
        errors.append("FIXTURE_ID_SET_MISMATCH")
    paths = [entry.get("manifest_path") for entry in entries if isinstance(entry, dict)]
    if len(paths) != len(set(paths)):
        errors.append("FIXTURE_MANIFEST_PATH_DUPLICATE")
    return sorted(errors)


def validate_fixture_manifest(root: Path, manifest: Mapping[str, Any]) -> list[str]:
    required = {
        "fixture_id", "schema_version", "purpose", "verification_ids", "source_root",
        "source_hash", "materializer_version", "materializer_hash", "git", "tracked_state",
        "dirty_state", "untracked_state", "toolchain", "protected_paths",
        "synthetic_secret_rule", "source_files", "expected_test", "expected_gate",
        "reset_cleanup", "actual_secret_count", "external_systems_allowed",
    }
    errors = [f"FIXTURE_FIELD_REQUIRED:{field}" for field in sorted(required - set(manifest))]
    if manifest.get("fixture_id") not in FIXTURE_IDS:
        errors.append("FIXTURE_ID_INVALID")
    if manifest.get("actual_secret_count") != 0 or manifest.get("external_systems_allowed") is not False:
        errors.append("FIXTURE_EXTERNAL_OR_SECRET_FORBIDDEN")
    marker = (manifest.get("synthetic_secret_rule") or {}).get("marker", "")
    if any(pattern.search(marker) for pattern in ACTUAL_SECRET_PATTERNS):
        errors.append("ACTUAL_LOOKING_SECRET")
    toolchain = manifest.get("toolchain") or {}
    if toolchain.get("allow_global_fallback") is not False:
        errors.append("TS_GLOBAL_FALLBACK_FORBIDDEN")
    files = manifest.get("source_files")
    if not isinstance(files, list) or not files:
        return sorted(set(errors + ["FIXTURE_SOURCE_FILES_REQUIRED"]))
    source_root = root / str(manifest.get("source_root", ""))
    rows: list[str] = []
    seen: set[str] = set()
    for item in files:
        path = item.get("path", "")
        if path in seen:
            errors.append("FIXTURE_SOURCE_PATH_DUPLICATE")
            continue
        seen.add(path)
        full_path = source_root / path
        try:
            raw = full_path.read_bytes()
        except OSError:
            errors.append(f"FIXTURE_SOURCE_MISSING:{path}")
            continue
        actual = hashlib.sha256(raw).hexdigest().upper()
        if item.get("bytes") != len(raw):
            errors.append(f"FIXTURE_SOURCE_BYTES_MISMATCH:{path}")
        if item.get("sha256") != actual:
            errors.append(f"FIXTURE_SOURCE_HASH_MISMATCH:{path}")
        if any(pattern.search(raw.decode("utf-8", errors="ignore")) for pattern in ACTUAL_SECRET_PATTERNS):
            errors.append(f"ACTUAL_LOOKING_SECRET:{path}")
        rows.append(f"{path}\t{len(raw)}\t{actual}")
    actual_paths = {
        path.relative_to(source_root).as_posix()
        for path in source_root.rglob("*")
        if path.is_file()
    } if source_root.is_dir() else set()
    if actual_paths != seen:
        errors.append("FIXTURE_SOURCE_INVENTORY_MISMATCH")
    calculated_source = "sha256:" + hashlib.sha256("\n".join(sorted(rows)).encode("utf-8")).hexdigest().upper()
    if manifest.get("source_hash") != calculated_source:
        errors.append("FIXTURE_SOURCE_AGGREGATE_MISMATCH")
    materializer = root / "scripts/materialize_fixture_repository.py"
    if materializer.is_file():
        actual_materializer = hashlib.sha256(materializer.read_bytes()).hexdigest().upper()
        if manifest.get("materializer_hash") != "sha256:" + actual_materializer:
            errors.append("FIXTURE_MATERIALIZER_HASH_MISMATCH")
    return sorted(set(errors))


def validate_golden_case(case: Mapping[str, Any]) -> list[str]:
    required = {
        "case_id", "fixture_id", "source_requirement", "verification_ids", "action",
        "work_instruction_ref", "precondition", "acquisition_mode", "expected_result_status",
        "expected_changed_paths", "forbidden_paths", "expected_diff_hash", "expected_tests",
        "gate_results", "preserved_paths", "expected_event", "expected_blocked_error_code",
        "evidence_manifest_skeleton", "forbidden_side_effects", "fail_if", "frozen_at",
        "frozen_by", "golden_content_hash", "supersedes", "owner_approval_ref",
    }
    errors = [f"GOLDEN_FIELD_REQUIRED:{field}" for field in sorted(required - set(case))]
    if case.get("fixture_id") not in FIXTURE_IDS:
        errors.append("GOLDEN_FIXTURE_INVALID")
    if case.get("acquisition_mode") != "fixture":
        errors.append("GOLDEN_ACQUISITION_INVALID")
    if case.get("owner_approval_ref") != "APPROVAL-20260810-INTEGRATED-BASELINE-001":
        errors.append("GOLDEN_APPROVAL_INVALID")
    if case.get("frozen_by") != "main-agent-eoul":
        errors.append("GOLDEN_FREEZER_INVALID")
    if case.get("golden_content_hash") != content_hash(case, "golden_content_hash"):
        errors.append("GOLDEN_HASH_MISMATCH")
    return sorted(set(errors))


def validate_golden_lock(
    index: Mapping[str, Any],
    lock: Mapping[str, Any],
    cases: list[Mapping[str, Any]],
) -> list[str]:
    errors: list[str] = []
    index_map = {
        entry.get("case_id"): entry.get("case_path")
        for entry in index.get("cases", [])
        if isinstance(entry, dict)
    }
    locked = {
        entry.get("case_id"): (entry.get("case_path"), entry.get("golden_content_hash"))
        for entry in lock.get("case_locks", [])
        if isinstance(entry, dict)
    }
    observed = {
        case.get("case_id"): case.get("golden_content_hash")
        for case in cases
    }
    if set(index_map) != set(locked) or set(index_map) != set(observed) or len(index_map) != 8:
        errors.append("GOLDEN_LOCK_CASE_SET_MISMATCH")
    for case_id, case_path in index_map.items():
        locked_path, locked_hash = locked.get(case_id, (None, None))
        if locked_path != case_path:
            errors.append(f"GOLDEN_LOCK_CASE_PATH_MISMATCH:{case_id}")
        if locked_hash != observed.get(case_id):
            errors.append(f"GOLDEN_LOCK_CASE_HASH_MISMATCH:{case_id}")
    if lock.get("work_instruction_sha256") != "F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E":
        errors.append("GOLDEN_LOCK_WORK_INSTRUCTION_MISMATCH")
    if lock.get("owner_approval_ref") != "APPROVAL-20260810-INTEGRATED-BASELINE-001":
        errors.append("GOLDEN_LOCK_APPROVAL_INVALID")
    return sorted(set(errors))


def validate_scenario(scenario: Mapping[str, Any]) -> list[str]:
    required = {
        "scenario_id", "source_clause", "verification_id", "responsible_package", "gate",
        "level", "method", "environment", "fixture_refs", "golden_refs", "precondition",
        "injection_action", "expected_state", "expected_blocked_error_code",
        "forbidden_side_effects", "evidence_types", "reset_cleanup", "repeat_count",
        "execution_phase", "implementation_status", "execution_status",
    }
    errors = [f"SCENARIO_FIELD_REQUIRED:{field}" for field in sorted(required - set(scenario))]
    scenario_id = scenario.get("scenario_id")
    authority = SCENARIO_AUTHORITY_MAP.get(scenario_id)
    if authority is None or authority["verification_id"] != scenario.get("verification_id"):
        errors.append("SCENARIO_AV_TRACE_MISMATCH")
    if authority is not None and set(authority["responsible_packages"]) != _canonical_package_set(
        scenario.get("responsible_package")
    ):
        errors.append("SCENARIO_PACKAGE_TRACE_MISMATCH")
    evidence = scenario.get("evidence_types")
    observed_evidence = {str(item) for item in evidence} if isinstance(evidence, list) else set()
    if authority is not None and set(authority["evidence_types"]) != observed_evidence:
        errors.append("SCENARIO_EVIDENCE_TRACE_MISMATCH")
    if scenario.get("implementation_status") != "DESIGN_LOCKED":
        errors.append("SCENARIO_IMPLEMENTATION_STATUS_INVALID")
    execution = scenario.get("execution_status")
    if execution == "PASS":
        errors.append("SCENARIO_FALSE_PASS")
    elif execution != "NOT_EXECUTED":
        errors.append("SCENARIO_EXECUTION_STATUS_INVALID")
    if not scenario.get("responsible_package"):
        errors.append("SCENARIO_PACKAGE_REQUIRED")
    if not scenario.get("gate"):
        errors.append("SCENARIO_GATE_REQUIRED")
    if not scenario.get("evidence_types"):
        errors.append("SCENARIO_EVIDENCE_REQUIRED")
    return sorted(set(errors))


def validate_fault_contract(contract: Mapping[str, Any]) -> list[str]:
    required = {
        "fault_id", "source_clause", "verification_ids", "fault_domain", "injection_point",
        "precondition", "injection_action", "expected_state", "forbidden_side_effects",
        "evidence_types", "reset_cleanup", "minimum_repeat_count", "execution_phase",
        "implementation_status", "execution_status",
    }
    errors = [f"FAULT_FIELD_REQUIRED:{field}" for field in sorted(required - set(contract))]
    fault_id = contract.get("fault_id")
    if FAULT_MAP.get(fault_id) != contract.get("verification_ids"):
        errors.append("FAULT_AV_TRACE_MISMATCH")
    if contract.get("implementation_status") != "DESIGN_LOCKED":
        errors.append("FAULT_IMPLEMENTATION_STATUS_INVALID")
    if contract.get("execution_status") != "NOT_EXECUTED":
        errors.append("FAULT_FALSE_EXECUTION_STATUS")
    if contract.get("minimum_repeat_count") != 3:
        errors.append("FAULT_REPEAT_COUNT_INVALID")
    return sorted(set(errors))


def inspect_materialized_fixture(repo: Path, fixture_id: str) -> list[str]:
    """Observe state through Git without writing fixture files."""
    result = subprocess.run(
        ["git", "status", "--porcelain"], cwd=repo, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        return ["MATERIALIZED_GIT_STATUS_FAILED"]
    if fixture_id == "FIX-PY-DIRTY" and result.stdout.splitlines() != [
        " M src/calc.py", "?? notes/local-note.txt"
    ]:
        return ["MATERIALIZED_DIRTY_STATE_MISMATCH"]
    return []


def validate_bundle(root: Path) -> list[str]:
    errors: list[str] = []
    fixture_index = _json(root / "tests/fixtures/repositories/fixture-index.json")
    errors.extend(validate_fixture_index(fixture_index))
    errors.extend(validate_hashed_index(root, fixture_index, "fixtures", "manifest_path"))
    for entry in fixture_index.get("fixtures", []):
        errors.extend(validate_fixture_manifest(root, _json(root / entry["manifest_path"])))

    golden_index = _json(root / "tests/fixtures/golden/golden-index.json")
    golden_lock = _json(root / "tests/fixtures/golden/golden-lock.json")
    golden_baseline = _json(root / GOLDEN_BASELINE_PATH)
    cases = [_json(root / entry["case_path"]) for entry in golden_index.get("cases", [])]
    if len(cases) != 8 or {case.get("fixture_id") for case in cases} != FIXTURE_IDS:
        errors.append("GOLDEN_FIXTURE_COVERAGE_MISMATCH")
    for case in cases:
        errors.extend(validate_golden_case(case))
    errors.extend(validate_golden_lock(golden_index, golden_lock, cases))
    errors.extend(validate_golden_baseline_candidate(golden_baseline, golden_index, golden_lock, cases))
    errors.extend(validate_golden_baseline_anchor(root, golden_baseline))

    scenario_index = _json(root / "tests/fault/scenario-index.json")
    errors.extend(validate_hashed_index(root, scenario_index, "scenarios", "scenario_path"))
    scenarios = [_json(root / entry["scenario_path"]) for entry in scenario_index.get("scenarios", [])]
    observed_scenarios = {item.get("scenario_id"): item.get("verification_id") for item in scenarios}
    if observed_scenarios != SCENARIO_MAP or len(scenarios) != 20:
        errors.append("SCENARIO_COVERAGE_MISMATCH")
    if len({item.get("source_clause") for item in scenarios}) != 20:
        errors.append("SCENARIO_SOURCE_CLAUSE_DUPLICATE")
    for scenario in scenarios:
        errors.extend(validate_scenario(scenario))

    fault_index = _json(root / "tests/fault/fault-injection-index.json")
    errors.extend(validate_hashed_index(root, fault_index, "fault_injections", "contract_path"))
    contracts = [_json(root / entry["contract_path"]) for entry in fault_index.get("fault_injections", [])]
    observed_faults = {item.get("fault_id"): item.get("verification_ids") for item in contracts}
    if observed_faults != FAULT_MAP or len(contracts) != 8:
        errors.append("FAULT_COVERAGE_MISMATCH")
    for contract in contracts:
        errors.extend(validate_fault_contract(contract))
    schema_index = _json(root / "tests/fixtures/schemas/schema-index.json")
    errors.extend(validate_hashed_index(root, schema_index, "schemas", "path"))
    if len(schema_index.get("schemas", [])) != 4:
        errors.append("SCHEMA_INDEX_COUNT_MISMATCH")
    for entry in schema_index.get("schemas", []):
        schema = _json(root / entry["path"])
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            errors.append(f"SCHEMA_DRAFT_INVALID:{entry['path']}")
    return sorted(set(errors))


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    root = Path(args[0]).resolve() if args else Path.cwd()
    try:
        errors = validate_bundle(root)
    except (OSError, json.JSONDecodeError, KeyError) as exc:
        errors = [f"BUNDLE_LOAD_ERROR:{exc}"]
    if errors:
        for error in errors:
            print(error)
        return 1
    print("G-06 test assets: fixtures=8 golden=8 scenarios=20 fault_injections=8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
