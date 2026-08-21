"""Validate the owner-approved dependency-safe Phase B exact-44 Gate scope."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping


WORK_INSTRUCTION_PATH = "docs/work_orders/PHASE_B_GATE_WORK_INSTRUCTION.md"
APPROVAL_PATH = "docs/approvals/APPROVAL-20260821-PHASE-B-GATE-EXACT44-001.md"
MATRIX_PATH = "Anvil_통합검증매트릭스_v1.md"
TEST_PLAN_PATH = "Anvil_테스트계획서_v1.md"
MANIFEST_PATH = "docs/evidence/manifests/PHASE_B_GATE_EVIDENCE_MANIFEST.json"
VALIDATION_PATH = "docs/validation/PHASE_B_GATE_VALIDATION.md"
COMPLETION_REPORT_PATH = "docs/completion_reports/PHASE_B_GATE_COMPLETION_REPORT.md"

DIRECT_VERIFICATION_IDS = tuple(
    [f"AV-STAT-{value:03d}" for value in range(1, 17)]
    + ["AV-STAT-020", "AV-STAT-026", "AV-STAT-027"]
    + [f"AV-STAT-{value:03d}" for value in range(30, 40)]
    + ["AV-STAT-043"]
    + [f"AV-SAFE-{value:03d}" for value in range(2, 6)]
    + ["AV-SAFE-025", "AV-SAFE-028", "AV-SAFE-029", "AV-SAFE-033"]
    + ["AV-UI-016", "AV-OPS-009", "AV-FLOW-002", "AV-FLOW-010", "AV-FLOW-011", "AV-FLOW-012"]
)
DEFERRED_VERIFICATION_IDS = (
    "AV-STAT-021", "AV-STAT-022", "AV-STAT-023", "AV-STAT-024", "AV-STAT-025", "AV-STAT-028",
)
UNDEFINED_VERIFICATION_IDS = ("AV-STAT-029",)


def _metadata(owner: str, level: str, evidence: str, severity: str) -> dict[str, str]:
    return {
        "owner_package": owner,
        "level": level,
        "required_evidence": evidence,
        "severity": severity,
    }


VERIFICATION_METADATA = {
    "AV-STAT-001": _metadata("B-01", "L1", "E-TEST", "CRITICAL"),
    "AV-STAT-002": _metadata("B-01/B-06", "L2", "E-ART", "MAJOR"),
    "AV-STAT-003": _metadata("B-01", "L1", "E-TEST", "CRITICAL"),
    "AV-STAT-004": _metadata("B-06", "L3", "E-EVT", "CRITICAL"),
    "AV-STAT-005": _metadata("B-06", "L3", "E-EVT", "CRITICAL"),
    "AV-STAT-006": _metadata("B-06", "L4", "E-EVT, E-SHOT", "MAJOR"),
    "AV-STAT-007": _metadata("B-11", "L2", "E-API", "MAJOR"),
    "AV-STAT-008": _metadata("B-05", "L2", "E-TEST", "MAJOR"),
    "AV-STAT-009": _metadata("B-08", "L3", "E-EVT, E-PRG", "CRITICAL"),
    "AV-STAT-010": _metadata("B-07", "L3", "E-ART", "MAJOR"),
    "AV-STAT-011": _metadata("B-08", "L3", "E-PRG, E-EVT", "CRITICAL"),
    "AV-STAT-012": _metadata("B-08", "L6", "E-PRG", "CRITICAL"),
    "AV-STAT-013": _metadata("B-08", "L6", "E-PRG, E-EVT", "CRITICAL"),
    "AV-STAT-014": _metadata("B-12/G-05", "L7", "E-PRG, E-DEC", "CRITICAL"),
    "AV-STAT-015": _metadata("G-05", "L2", "E-PRG", "MAJOR"),
    "AV-STAT-016": _metadata("G-05", "L3", "E-PRG", "MAJOR"),
    "AV-STAT-020": _metadata("B-06/C-10", "L3", "E-EVT", "CRITICAL"),
    "AV-STAT-026": _metadata("B-09", "L6", "E-EVT", "CRITICAL"),
    "AV-STAT-027": _metadata("B-09", "L6", "E-EVT, E-AUD", "CRITICAL"),
    "AV-STAT-030": _metadata("B-10", "L6", "E-EVT, E-ART", "CRITICAL"),
    "AV-STAT-031": _metadata("B-10", "L5", "E-EVT", "CRITICAL"),
    "AV-STAT-032": _metadata("B-10", "L3", "E-EVT", "MAJOR"),
    "AV-STAT-033": _metadata("B-10", "L5", "E-API", "CRITICAL"),
    "AV-STAT-034": _metadata("B-12", "L6", "E-EVT", "CRITICAL"),
    "AV-STAT-035": _metadata("B-12", "L3", "E-EVT", "CRITICAL"),
    "AV-STAT-036": _metadata("B-12/E-08", "L6", "E-API, E-EVT", "CRITICAL"),
    "AV-STAT-037": _metadata("B-10", "L5", "E-AUD", "CRITICAL"),
    "AV-STAT-038": _metadata("B-12", "L6", "E-PRG, E-EVT, E-GIT", "CRITICAL"),
    "AV-STAT-039": _metadata("B-12", "L6", "E-PRG, E-EVT", "CRITICAL"),
    "AV-STAT-043": _metadata("B-09", "L6", "E-EVT, E-AUD", "CRITICAL"),
    "AV-SAFE-002": _metadata("B-04", "L2", "E-API, E-AUD", "CRITICAL"),
    "AV-SAFE-003": _metadata("B-04/B-10", "L5", "E-EVT, E-AUD", "CRITICAL"),
    "AV-SAFE-004": _metadata("B-04", "L3", "E-EVT", "MAJOR"),
    "AV-SAFE-005": _metadata("B-04/C-14", "L2", "E-API, E-AUD", "MAJOR"),
    "AV-SAFE-025": _metadata("B-10", "L5", "E-EVT", "CRITICAL"),
    "AV-SAFE-028": _metadata("B-09/E-06", "L5", "E-EVT, E-AUD", "CRITICAL"),
    "AV-SAFE-029": _metadata("B-11/F-15", "L5", "E-API, E-AUD", "CRITICAL"),
    "AV-SAFE-033": _metadata("B-04", "L5", "E-API, E-AUD", "CRITICAL"),
    "AV-UI-016": _metadata("B-11", "L3", "E-EVT", "MAJOR"),
    "AV-OPS-009": _metadata("B-02/F-14", "L3", "E-CMD", "MAJOR"),
    "AV-FLOW-002": _metadata("B-03", "L3", "E-ART, E-AUD", "MAJOR"),
    "AV-FLOW-010": _metadata("B-12", "L6", "E-PRG, E-GIT", "CRITICAL"),
    "AV-FLOW-011": _metadata("B-12", "L6", "E-API, E-EVT", "CRITICAL"),
    "AV-FLOW-012": _metadata("B-04", "L5", "E-AUD", "CRITICAL"),
}


def _verification_map() -> list[dict[str, str]]:
    return [
        {
            "verification_id": verification_id,
            **VERIFICATION_METADATA[verification_id],
            "evidence_status": "REUSED_ACCEPTED_EVIDENCE_NOT_RERUN",
            "actual_execution_status": "NOT_EXECUTED",
        }
        for verification_id in DIRECT_VERIFICATION_IDS
    ]


def recalculate_selector(matrix_text: str) -> list[str]:
    """Expand the historical B Gate selector before applying the approved split."""
    match = re.search(r"\| \*\*B Gate\*\* \| (.*?) \|", matrix_text)
    if match is None:
        return []
    expanded: list[str] = []
    for item in match.group(1).split(","):
        token = item.strip()
        range_match = re.fullmatch(r"(AV-[A-Z]+-)(\d{3})~(\d{3})", token)
        if range_match is None:
            if re.fullmatch(r"AV-[A-Z]+-\d{3}", token):
                expanded.append(token)
            continue
        prefix, start, end = range_match.groups()
        expanded.extend(f"{prefix}{value:03d}" for value in range(int(start), int(end) + 1))
    return expanded


def _canonical_target(rows: Iterable[Mapping[str, Any]]) -> tuple[str, int, int]:
    canonical_rows: list[tuple[bytes, str]] = []
    total = 0
    for row in rows:
        path = row["path"]
        byte_count = row["bytes"]
        checksum = row["sha256"]
        canonical_rows.append((path.encode("utf-8"), f"{path}\t{byte_count}\t{checksum}"))
        total += byte_count
    canonical = "\n".join(text for _, text in sorted(canonical_rows)).encode("utf-8")
    return "sha256:" + hashlib.sha256(canonical).hexdigest().upper(), len(canonical), total


def _canonical_json_hash(value: Any) -> str:
    return "sha256:" + hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest().upper()


def validate_documents(*, validation_text: str, completion_text: str) -> list[str]:
    """Require the human-facing artifacts to state the same exact scope as the checker."""
    validation_required = (
        "| 51 | 50 | 44 | 6 | 1 |",
        "AV-STAT-021/022/023/024/025/028",
        "AV-STAT-029",
        "NOT_EXECUTED",
    )
    completion_required = (
        "51 slots / 50 defined / 44 direct / 6 deferred / 1 undefined",
        "AV-STAT-021/022/023/024/025/028",
        "AV-STAT-029",
        "NOT_EXECUTED",
        "IN_PROGRESS_NOT_ACCEPTED",
    )
    errors: list[str] = []
    if not all(item in validation_text for item in validation_required):
        errors.append("PHASE_B_GATE_VALIDATION_BOUNDARY_INVALID")
    if not all(item in completion_text for item in completion_required):
        errors.append("PHASE_B_GATE_COMPLETION_BOUNDARY_INVALID")
    return errors


def validate_selector_contract(
    *, direct_ids: Iterable[str], deferred_ids: Iterable[str], undefined_ids: Iterable[str]
) -> list[str]:
    errors: list[str] = []
    if tuple(direct_ids) != DIRECT_VERIFICATION_IDS or len(DIRECT_VERIFICATION_IDS) != 44:
        errors.append("PHASE_B_GATE_SELECTOR_INVALID")
    if tuple(deferred_ids) != DEFERRED_VERIFICATION_IDS:
        errors.append("PHASE_B_GATE_DEFERRED_BOUNDARY_INVALID")
    if tuple(undefined_ids) != UNDEFINED_VERIFICATION_IDS:
        errors.append("PHASE_B_GATE_UNDEFINED_BOUNDARY_INVALID")
    if set(DIRECT_VERIFICATION_IDS) & set(DEFERRED_VERIFICATION_IDS):
        errors.append("PHASE_B_GATE_SELECTOR_OVERLAP")
    if set(DIRECT_VERIFICATION_IDS) & set(UNDEFINED_VERIFICATION_IDS):
        errors.append("PHASE_B_GATE_UNDEFINED_PROMOTED")
    if set(VERIFICATION_METADATA) != set(DIRECT_VERIFICATION_IDS):
        errors.append("PHASE_B_GATE_METADATA_INCOMPLETE")
    return errors


def _validate_manifest(
    root: Path, verification_map: list[dict[str, str]], manifest_override: Mapping[str, Any] | None = None
) -> list[str]:
    path = root / MANIFEST_PATH
    try:
        manifest = dict(manifest_override) if manifest_override is not None else json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["PHASE_B_GATE_MANIFEST_INVALID"]
    errors: list[str] = []
    if any((
        manifest.get("package_id") != "PHASE_B_GATE",
        manifest.get("gate_status") != "IN_PROGRESS_NOT_ACCEPTED",
        manifest.get("direct_verification_ids") != list(DIRECT_VERIFICATION_IDS),
        manifest.get("deferred_verification_ids") != list(DEFERRED_VERIFICATION_IDS),
        manifest.get("undefined_verification_ids") != list(UNDEFINED_VERIFICATION_IDS),
        manifest.get("verification_map_contract") != "SCRIPT_RECALCULATED_EXACT44",
        manifest.get("verification_map_sha256") != _canonical_json_hash(verification_map),
        manifest.get("c01_status") != "BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE",
        manifest.get("actual_execution_boundary") != "NOT_EXECUTED",
        manifest.get("self_reference") is not False,
    )):
        errors.append("PHASE_B_GATE_MANIFEST_SCOPE_INVALID")
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list):
        return sorted(set(errors + ["PHASE_B_GATE_MANIFEST_RAW_INVALID"]))
    seen: set[str] = set()
    for row in rows:
        relative = row.get("path") if isinstance(row, dict) else None
        candidate = Path(relative) if isinstance(relative, str) else None
        resolved = (root / candidate).resolve() if candidate is not None and not candidate.is_absolute() else None
        if (
            not isinstance(relative, str)
            or relative in seen
            or relative == MANIFEST_PATH
            or candidate is None
            or candidate.is_absolute()
            or ".." in candidate.parts
            or resolved is None
            or not resolved.is_relative_to(root)
        ):
            errors.append("PHASE_B_GATE_MANIFEST_RAW_PATH_ESCAPE")
            errors.append("PHASE_B_GATE_MANIFEST_RAW_INVALID")
            continue
        seen.add(relative)
        try:
            raw = (root / relative).read_bytes()
        except OSError:
            errors.append("PHASE_B_GATE_MANIFEST_RAW_INVALID")
            continue
        if row.get("bytes") != len(raw) or row.get("sha256") != hashlib.sha256(raw).hexdigest().upper():
            errors.append("PHASE_B_GATE_MANIFEST_RAW_INVALID")
    target_hash, canonical_bytes, content_bytes = _canonical_target(rows)
    if any((
        manifest.get("target_hash") != target_hash,
        manifest.get("delivered_hash") != target_hash,
        manifest.get("target_canonical_bytes") != canonical_bytes,
        manifest.get("target_content_bytes") != content_bytes,
    )):
        errors.append("PHASE_B_GATE_MANIFEST_TARGET_INVALID")
    material = dict(manifest)
    material.pop("content_hash", None)
    content_hash = "sha256:" + hashlib.sha256(
        json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest().upper()
    if manifest.get("content_hash") != content_hash:
        errors.append("PHASE_B_GATE_MANIFEST_CONTENT_HASH_INVALID")
    return sorted(set(errors))


def validate_gate(root: Path | str, *, manifest_override: Mapping[str, Any] | None = None) -> dict[str, Any]:
    root = Path(root).resolve()
    verification_map = _verification_map()
    errors = validate_selector_contract(
        direct_ids=DIRECT_VERIFICATION_IDS,
        deferred_ids=DEFERRED_VERIFICATION_IDS,
        undefined_ids=UNDEFINED_VERIFICATION_IDS,
    )
    counts = {"selector_slots": 0, "defined": 0, "direct": 44, "deferred": 6, "undefined": 1}
    try:
        matrix = (root / MATRIX_PATH).read_text(encoding="utf-8")
    except OSError:
        errors.append("PHASE_B_GATE_MATRIX_UNREADABLE")
    else:
        selector_ids = recalculate_selector(matrix)
        counts["selector_slots"] = len(selector_ids)
        counts["defined"] = len([item for item in selector_ids if item not in UNDEFINED_VERIFICATION_IDS])
        if (
            len(selector_ids) != 51
            or len(set(selector_ids)) != 51
            or set(DIRECT_VERIFICATION_IDS) | set(DEFERRED_VERIFICATION_IDS) | set(UNDEFINED_VERIFICATION_IDS) != set(selector_ids)
        ):
            errors.append("PHASE_B_GATE_SELECTOR_SOURCE_INVALID")
    document_text: dict[str, str] = {}
    for required_path in (WORK_INSTRUCTION_PATH, APPROVAL_PATH, TEST_PLAN_PATH, VALIDATION_PATH, COMPLETION_REPORT_PATH):
        if not (root / required_path).is_file():
            errors.append("PHASE_B_GATE_REQUIRED_ARTIFACT_MISSING")
        elif required_path in (VALIDATION_PATH, COMPLETION_REPORT_PATH):
            document_text[required_path] = (root / required_path).read_text(encoding="utf-8")
    if VALIDATION_PATH in document_text and COMPLETION_REPORT_PATH in document_text:
        errors.extend(validate_documents(
            validation_text=document_text[VALIDATION_PATH], completion_text=document_text[COMPLETION_REPORT_PATH]
        ))
    errors.extend(_validate_manifest(root, verification_map, manifest_override))
    return {
        "errors": sorted(set(errors)),
        "counts": counts,
        "direct_verification_ids": list(DIRECT_VERIFICATION_IDS),
        "deferred_verification_ids": list(DEFERRED_VERIFICATION_IDS),
        "undefined_verification_ids": list(UNDEFINED_VERIFICATION_IDS),
        "verification_map": verification_map,
        "actual_execution_boundary": "NOT_EXECUTED",
        "gate_status": "IN_PROGRESS_NOT_ACCEPTED",
    }


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    report = validate_gate(Path(arguments[0]) if arguments else Path.cwd())
    if report["errors"]:
        print("\n".join(report["errors"]))
        return 1
    print("Phase B Gate exact-44 contract: PASS (IN_PROGRESS_NOT_ACCEPTED)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
