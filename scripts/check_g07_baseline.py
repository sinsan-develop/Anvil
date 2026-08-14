"""Independently normalize Anvil authority documents for G-07.

The checker parses the Markdown and JSON sources. Canonical counts are guards,
not returned success values: every count and trace is recalculated first.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping


AUTHORITY = {
    "Anvil_설계서_v2.md": ("v2.6", "246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5"),
    "Anvil_작업계획서_v1.md": ("v1.5", "A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A"),
    "Anvil_통합검증매트릭스_v1.md": ("v1.3", "982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A"),
    "Anvil_테스트계획서_v1.md": ("v1.4", "803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8"),
    "docs/governance/ANVIL_OPERATING_RULES.md": ("v1.6", "4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E"),
}
PHASE_ORDER = "GABCDEF P".replace(" ", "")
PACKAGE_RE = re.compile(r"\b([GABCDFEP])-(\d{2})(?:~(?:[GABCDFEP]-)?(\d{2}))?\b")
FULL_AV_RE = re.compile(r"AV-([A-Z]+)-(\d{3})(?:~(\d{3}))?")
BARE_AV_RE = re.compile(r"(?<![A-Z0-9-])(\d{3})(?:~(\d{3}))?")
AV_ID_RE = re.compile(r"^AV-([A-Z]+)-(\d{3})$")
EVIDENCE_RE = re.compile(r"\bE-[A-Z]+\b")
EXPECTED_DOMAIN_COUNTS = {
    "CON": 21, "SAFE": 30, "STAT": 39, "GATE": 26, "AGT": 38,
    "LRN": 28, "UI": 16, "OPS": 25, "FLOW": 25, "PLG": 7,
}
FINAL_TEST_REPORTS = {
    "G-01": "docs/test_reports/G-01_TEST_REPORT.md",
    "G-02": "docs/test_reports/G-02_TEST_REPORT_R3.md",
    "G-03": "docs/test_reports/G-03_TEST_REPORT_R4.md",
    "G-04": "docs/test_reports/G-04_TEST_REPORT_R2.md",
    "G-05": "docs/test_reports/G-05_TEST_REPORT_R2.md",
    "G-06": "docs/test_reports/G-06_TEST_REPORT_R2.md",
}
FINAL_MANIFESTS = {
    "G-01": "docs/evidence/manifests/G-01_EVIDENCE_MANIFEST.json",
    "G-02": "docs/evidence/manifests/G-02_EVIDENCE_MANIFEST.json",
    "G-03": "docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json",
    "G-04": "docs/evidence/manifests/G-04_EVIDENCE_MANIFEST.json",
    "G-05": "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json",
    "G-06": "docs/evidence/manifests/G-06_EVIDENCE_MANIFEST_R3.json",
}
VALIDATED_BASE_PROJECTION_MODE = "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT"
VALIDATED_BASE_PENDING_RELATION = "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT"
EVIDENCE_ONLY_PATH_PREFIXES = ("docs/approvals/", "docs/evidence/", "docs/progress/", "docs/test_reports/")
A01_COMPLETION_PATH_PREFIXES = ("docs/architecture/a01/", "docs/completion_reports/A-01_", "docs/validation/A-01_", "tests/fixtures/a01/")
A01_COMPLETION_EXACT_PATHS = {"scripts/check_a01_journey.py", "tests/tooling/test_a01_journey.py"}
A02_COMPLETION_PATH_PREFIXES = ("docs/architecture/a02/", "docs/completion_reports/A-02_", "docs/validation/A-02_", "tests/fixtures/a02/")
A02_COMPLETION_EXACT_PATHS = {"scripts/check_a02_tokens.py", "tests/tooling/test_a02_tokens.py"}
A03_COMPLETION_PATH_PREFIXES = ("docs/architecture/a03/", "docs/completion_reports/A-03_", "docs/validation/A-03_", "tests/fixtures/a03/")
A03_COMPLETION_EXACT_PATHS = {"scripts/check_a03_onboarding.py", "tests/tooling/test_a03_onboarding.py"}
A04_COMPLETION_PATH_PREFIXES = ("docs/architecture/a04/", "docs/completion_reports/A-04_", "docs/validation/A-04_", "tests/fixtures/a04/")
A04_COMPLETION_EXACT_PATHS = {"scripts/check_a04_workbench.py", "tests/tooling/test_a04_workbench.py"}
A05_COMPLETION_PATH_PREFIXES = ("docs/architecture/a05/", "docs/completion_reports/A-05_", "docs/validation/A-05_", "tests/fixtures/a05/")
A05_COMPLETION_EXACT_PATHS = {"scripts/check_a05_design_decisions.py", "tests/tooling/test_a05_design_decisions.py"}
A14_COMPLETION_PATH_PREFIXES = ("apps/web/", "docs/architecture/a14/", "docs/completion_reports/A-14_", "docs/validation/A-14_", "tests/browser/a14/", "tests/fixtures/a14/")
A14_COMPLETION_EXACT_PATHS = {"docs/evidence/manifests/A-14_EVIDENCE_MANIFEST.json", "docs/evidence/manifests/A-14_EVIDENCE_MANIFEST_R2.json", "docs/evidence/manifests/A-14_COMPLETION_PROGRESS_MANIFEST_R2.json", "scripts/check_a13_repository_scan.py", "scripts/check_a14_workbench_prototype.py", "tests/tooling/test_a13_repository_scan.py", "tests/tooling/test_a14_workbench_prototype.py"}
A15_COMPLETION_PATH_PREFIXES = ("docs/architecture/a15/", "docs/completion_reports/A-15_", "docs/validation/A-15_", "tests/fixtures/a15/")
A15_COMPLETION_EXACT_PATHS = {"docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json", "scripts/check_a15_artifact_state_api_ui_trace.py", "tests/tooling/test_a15_artifact_state_api_ui_trace.py"}
EVIDENCE_ONLY_TOOLING_PATHS = {
    "scripts/evidence_portability.py",
    "scripts/check_a11_operations_monitoring.py",
    "tests/tooling/test_a11_operations_monitoring.py",
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
    "scripts/check_a13_repository_scan.py",
    "tests/tooling/test_g07_baseline.py",
}


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def _canonical_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    return _sha256_bytes(raw)


def _section(text: str, start_pattern: str, end_pattern: str | None) -> str:
    start = re.search(start_pattern, text, flags=re.MULTILINE)
    if not start:
        return ""
    if end_pattern is None:
        return text[start.start():]
    end = re.search(end_pattern, text[start.end():], flags=re.MULTILINE)
    return text[start.start(): start.end() + end.start()] if end else text[start.start():]


def _cells(line: str) -> list[str]:
    if not line.startswith("|"):
        return []
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _expand_packages(value: str) -> list[str]:
    result: list[str] = []
    for match in PACKAGE_RE.finditer(value):
        phase, start_raw, end_raw = match.groups()
        start = int(start_raw)
        end = int(end_raw or start_raw)
        if end < start:
            continue
        result.extend(f"{phase}-{number:02d}" for number in range(start, end + 1))
    return result


def _expand_av(value: str) -> list[str]:
    result: list[str] = []
    domain: str | None = None
    cursor = 0
    while cursor < len(value):
        full = FULL_AV_RE.search(value, cursor)
        bare = BARE_AV_RE.search(value, cursor)
        candidates = [(match.start(), "full", match) for match in (full,) if match]
        candidates += [(match.start(), "bare", match) for match in (bare,) if match]
        if not candidates:
            break
        _, kind, match = min(candidates, key=lambda item: item[0])
        if kind == "full":
            domain, start_raw, end_raw = match.groups()
        else:
            if domain is None:
                cursor = match.end()
                continue
            start_raw, end_raw = match.groups()
        start = int(start_raw)
        end = int(end_raw or start_raw)
        if end >= start:
            result.extend(f"AV-{domain}-{number:03d}" for number in range(start, end + 1))
        cursor = match.end()
    return result


def _expand_enforcement(value: str) -> list[str]:
    normalized = re.sub(r"(?<!AV-)(?<![A-Z0-9-])([A-Z]+)-(\d{3})", r"AV-\1-\2", value)
    return _expand_av(normalized)


def _error(errors: list[dict[str, str]], code: str, path: str, detail: str) -> None:
    errors.append({"code": code, "path": path, "detail": detail})


def _read_text(root: Path, relative: str, overrides: Mapping[str, str]) -> str:
    return overrides.get(relative, (root / relative).read_text(encoding="utf-8"))


def _read_json(root: Path, relative: str, overrides: Mapping[str, Any]) -> Any:
    if relative in overrides:
        return overrides[relative]
    return json.loads((root / relative).read_text(encoding="utf-8"))


def _package_cycle(graph: Mapping[str, set[str]]) -> list[str]:
    visiting: set[str] = set()
    visited: set[str] = set()
    stack: list[str] = []

    def visit(node: str) -> list[str]:
        if node in visiting:
            index = stack.index(node)
            return stack[index:] + [node]
        if node in visited:
            return []
        visiting.add(node)
        stack.append(node)
        for dependency in graph.get(node, set()):
            cycle = visit(dependency)
            if cycle:
                return cycle
        stack.pop()
        visiting.remove(node)
        visited.add(node)
        return []

    for package in graph:
        cycle = visit(package)
        if cycle:
            return cycle
    return []


def _expected_scenario_gate(scenario_number: int, packages: set[str], gate_memberships: set[str]) -> str:
    if scenario_number == 1:
        return "A/C/E pre-Gate DIR checkpoint"
    if scenario_number == 2:
        return "DIR owner-direction Gate"
    phases = sorted({package[0] for package in packages}, key=PHASE_ORDER.index)
    labels: list[str] = []
    for phase in phases:
        if phase == "D":
            specific = sorted(label for label in gate_memberships if label.startswith("D-") and label != "D Gate")
            labels.append(specific[0].removesuffix(" Gate") if specific else "D")
        else:
            labels.append(phase)
    return "/".join(labels) + " Gate"


def _git(root: Path, *args: str) -> tuple[int, str]:
    process = subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    return process.returncode, process.stdout.rstrip()


def _git_name_only(output: str) -> list[str]:
    return sorted({line.strip().replace("\\", "/") for line in output.splitlines() if line.strip()})


def _git_worktree_paths(output: str) -> list[str]:
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
        or relative.startswith(EVIDENCE_ONLY_PATH_PREFIXES)
        or relative.startswith(A01_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A02_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A03_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A04_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A05_COMPLETION_PATH_PREFIXES)
        or relative.startswith(A14_COMPLETION_PATH_PREFIXES)
        or relative in A14_COMPLETION_EXACT_PATHS
        or relative.startswith(A15_COMPLETION_PATH_PREFIXES)
        or relative in A15_COMPLETION_EXACT_PATHS
    )


def validate_g07_manifest(root: Path | str, *, verify_live_raw: bool = True) -> list[str]:
    root = Path(root).resolve()
    path = root / "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST.json"
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["G07_MANIFEST_INVALID"]
    errors: list[str] = []
    rows = manifest.get("raw_checksums")
    if not isinstance(rows, list) or not rows:
        return ["G07_MANIFEST_RAW_CHECKSUMS_MISSING"]
    seen: set[str] = set()
    canonical_rows: list[tuple[bytes, str]] = []
    total_bytes = 0
    for row in rows:
        if not isinstance(row, dict):
            errors.append("G07_MANIFEST_RAW_ROW_INVALID")
            continue
        relative = row.get("path")
        if not isinstance(relative, str) or relative in seen or relative.startswith("/") or "\\" in relative or ".." in Path(relative).parts:
            errors.append("G07_MANIFEST_RAW_PATH_INVALID")
            continue
        seen.add(relative)
        if verify_live_raw:
            artifact = root / relative
            try:
                raw = artifact.read_bytes()
            except OSError:
                errors.append("G07_MANIFEST_RAW_PATH_MISSING")
                continue
            actual_bytes = len(raw)
            actual_hash = _sha256_bytes(raw)
            if row.get("bytes") != actual_bytes or row.get("sha256") != actual_hash:
                errors.append("G07_MANIFEST_RAW_CHECKSUM_MISMATCH")
        else:
            actual_bytes = row.get("bytes")
            actual_hash = row.get("sha256")
            if not isinstance(actual_bytes, int) or not isinstance(actual_hash, str):
                errors.append("G07_MANIFEST_RAW_ROW_INVALID")
                continue
        total_bytes += actual_bytes
        canonical_rows.append((relative.encode("utf-8"), f"{relative}\t{actual_bytes}\t{actual_hash}"))
    canonical = "\n".join(row for _, row in sorted(canonical_rows, key=lambda item: item[0])).encode("utf-8")
    target = _sha256_bytes(canonical)
    if manifest.get("target_hash") != f"sha256:{target}" or manifest.get("delivered_hash") != f"sha256:{target}":
        errors.append("G07_MANIFEST_TARGET_MISMATCH")
    if manifest.get("target_canonical_bytes") != len(canonical) or manifest.get("target_content_bytes") != total_bytes:
        errors.append("G07_MANIFEST_TARGET_BYTES_MISMATCH")
    material = dict(manifest)
    material.pop("content_hash", None)
    if manifest.get("content_hash") != f"sha256:{_canonical_hash(material)}":
        errors.append("G07_MANIFEST_CONTENT_HASH_MISMATCH")
    required_immutable = {
        "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json",
        "docs/progress/progress-handoff-detached-digest-g07.json",
        "docs/test_reports/G-07_TEST_REPORT.md",
    }
    if not required_immutable <= seen:
        errors.append("G07_MANIFEST_PROVENANCE_MISSING")
    if (
        manifest.get("artifact_status") != "approved"
        or manifest.get("package_status") != "ACCEPTED"
        or manifest.get("g_gate_status") != "NOT_DECIDED"
        or manifest.get("a01_start_allowed") is not False
    ):
        errors.append("G07_MANIFEST_FALSE_ACCEPTANCE")
    r2_path = root / "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json"
    test_path = root / "docs/test_reports/G-07_TEST_REPORT.md"
    try:
        r2 = json.loads(r2_path.read_text(encoding="utf-8"))
        r2_hash = _sha256_bytes(r2_path.read_bytes())
        test_hash = _sha256_bytes(test_path.read_bytes())
    except (OSError, json.JSONDecodeError):
        errors.append("G07_MANIFEST_ACCEPTANCE_CHAIN_INVALID")
    else:
        supersedes = manifest.get("supersedes_artifact_ref", {})
        evidence_refs = manifest.get("source_evidence_refs", [])
        if (
            manifest.get("supersedes_artifact_id") != r2.get("artifact_id")
            or supersedes.get("path") != "docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json"
            or supersedes.get("file_sha256") != r2_hash
            or supersedes.get("content_hash") != r2.get("content_hash")
            or not any(ref.get("path") == "docs/test_reports/G-07_TEST_REPORT.md" and ref.get("sha256") == test_hash for ref in evidence_refs if isinstance(ref, dict))
        ):
            errors.append("G07_MANIFEST_ACCEPTANCE_CHAIN_INVALID")
    if manifest.get("delivered_target_comparison") != "MATCH":
        errors.append("G07_MANIFEST_TARGET_MISMATCH")
    return sorted(set(errors))


def validate_repository(
    root: Path | str,
    *,
    text_overrides: Mapping[str, str] | None = None,
    json_overrides: Mapping[str, Any] | None = None,
    verify_hashes: bool = True,
    verify_git: bool = True,
) -> dict[str, Any]:
    root = Path(root).resolve()
    text_overrides = text_overrides or {}
    json_overrides = json_overrides or {}
    errors: list[dict[str, str]] = []
    texts = {path: _read_text(root, path, text_overrides) for path in AUTHORITY}
    authority_inventory: list[dict[str, str]] = []

    for path, (version, expected_hash) in AUTHORITY.items():
        content = texts[path]
        actual_hash = _sha256_bytes(content.encode("utf-8"))
        authority_inventory.append({"path": path, "version": version, "sha256": actual_hash})
        if version not in content.splitlines()[0]:
            _error(errors, "AUTHORITY_VERSION_MISMATCH", path, f"first heading does not contain {version}")
        if verify_hashes and actual_hash != expected_hash:
            _error(errors, "AUTHORITY_HASH_MISMATCH", path, f"expected={expected_hash} actual={actual_hash}")

    plan_path = "Anvil_작업계획서_v1.md"
    plan = texts[plan_path]
    package_rows: list[tuple[str, str]] = []
    for line in plan.splitlines():
        cells = _cells(line)
        if len(cells) == 5 and re.fullmatch(r"[GABCDFEP]-\d{2}", cells[0]):
            package_rows.append((cells[0], cells[4]))
    packages = [package for package, _ in package_rows]
    package_counter = Counter(packages)
    duplicate_packages = sorted(package for package, count in package_counter.items() if count > 1)
    if duplicate_packages:
        _error(errors, "PACKAGE_DUPLICATE", plan_path, ",".join(duplicate_packages))
    if len(packages) != 97 or len(package_counter) != 97:
        _error(errors, "PACKAGE_TOTAL_MISMATCH", plan_path, f"rows={len(packages)} unique={len(package_counter)}")
    actual_phase_counts = Counter(package[0] for package in packages)
    expected_phase_counts = {"G": 7, "A": 15, "B": 12, "C": 15, "D": 13, "E": 11, "F": 20, "P": 4}
    if dict(actual_phase_counts) != expected_phase_counts:
        _error(errors, "PACKAGE_PHASE_COUNT_MISMATCH", plan_path, f"actual={dict(actual_phase_counts)}")
    package_set = set(packages)
    dependency_graph: dict[str, set[str]] = {}
    for package, dependency_text in package_rows:
        dependencies = set(_expand_packages(dependency_text))
        dependency_tokens = set(re.findall(r"\b[A-Z]-\d{2}\b", dependency_text))
        unknown_tokens = sorted(dependency_tokens - package_set)
        if unknown_tokens:
            _error(errors, "PACKAGE_DEPENDENCY_UNKNOWN", plan_path, f"{package}:{','.join(unknown_tokens)}")
        unknown = sorted(dependencies - package_set)
        if unknown:
            _error(errors, "PACKAGE_DEPENDENCY_UNKNOWN", plan_path, f"{package}:{','.join(unknown)}")
        dependency_graph[package] = dependencies & package_set
    cycle = _package_cycle(dependency_graph)
    if cycle:
        _error(errors, "PACKAGE_DEPENDENCY_CYCLE", plan_path, " -> ".join(cycle))

    matrix_path = "Anvil_통합검증매트릭스_v1.md"
    matrix = texts[matrix_path]
    matrix_body = _section(matrix, r"^## 6\. 매트릭스 본문$", r"^## 7\.")
    av_rows: list[dict[str, Any]] = []
    for line in matrix_body.splitlines():
        cells = _cells(line)
        if cells and AV_ID_RE.fullmatch(cells[0]):
            domain = AV_ID_RE.fullmatch(cells[0]).group(1)  # type: ignore[union-attr]
            if domain == "CON" and len(cells) == 6:
                av_rows.append({
                    "id": cells[0], "domain": domain, "source": cells[2], "packages": [],
                    "evidence": [], "severity": cells[5], "enforcement": _expand_enforcement(cells[3]),
                })
            elif len(cells) == 8:
                av_rows.append({
                    "id": cells[0], "domain": domain, "source": cells[2],
                    "packages": _expand_packages(cells[3]),
                    "evidence": sorted(set(EVIDENCE_RE.findall(cells[6]))),
                    "severity": cells[7], "enforcement": [],
                })
            elif domain == "FLOW" and len(cells) == 7:
                av_rows.append({
                    "id": cells[0], "domain": domain, "source": cells[2],
                    "packages": _expand_packages(cells[3]),
                    "evidence": sorted(set(EVIDENCE_RE.findall(cells[5]))),
                    "severity": cells[6], "enforcement": [],
                })
            else:
                _error(errors, "AV_ROW_SHAPE_INVALID", matrix_path, cells[0])
    av_ids = [row["id"] for row in av_rows]
    av_counter = Counter(av_ids)
    duplicate_av = sorted(av for av, count in av_counter.items() if count > 1)
    if duplicate_av:
        _error(errors, "AV_ID_DUPLICATE", matrix_path, ",".join(duplicate_av))
    if len(av_ids) != 255 or len(av_counter) != 255:
        _error(errors, "AV_TOTAL_MISMATCH", matrix_path, f"rows={len(av_ids)} unique={len(av_counter)}")
    domain_counts = Counter(row["domain"] for row in av_rows)
    if dict(domain_counts) != EXPECTED_DOMAIN_COUNTS:
        _error(errors, "AV_DOMAIN_COUNT_MISMATCH", matrix_path, f"actual={dict(domain_counts)}")
    av_by_id = {row["id"]: row for row in av_rows}

    gate_body = _section(matrix, r"^## 7\. Phase Gate별", r"^## 8\.")
    gate_memberships: dict[str, set[str]] = defaultdict(set)
    for line in gate_body.splitlines():
        cells = _cells(line)
        if len(cells) == 3 and "Gate" in cells[0] and cells[0] != "Phase Gate":
            gate_label = cells[0].replace("**", "")
            for av_id in _expand_av(cells[1] + ", " + cells[2]):
                gate_memberships[av_id].add(gate_label)

    reverse_body = _section(matrix, r"^## 8\. Work Package", r"^## 9\.")
    reverse_rows: list[tuple[str, list[str]]] = []
    for line in reverse_body.splitlines():
        cells = _cells(line)
        if len(cells) == 2 and re.fullmatch(r"[GABCDFEP]-\d{2}", cells[0]):
            reverse_rows.append((cells[0], _expand_av(cells[1])))
    reverse_packages = [row[0] for row in reverse_rows]
    reverse_counter = Counter(reverse_packages)
    reverse_duplicates = sorted(package for package, count in reverse_counter.items() if count > 1)
    if reverse_duplicates:
        _error(errors, "REVERSE_PACKAGE_DUPLICATE", matrix_path, ",".join(reverse_duplicates))
    missing_reverse = sorted(package_set - set(reverse_packages))
    extra_reverse = sorted(set(reverse_packages) - package_set)
    if len(reverse_rows) != 97 or missing_reverse or extra_reverse:
        _error(errors, "REVERSE_PACKAGE_SET_MISMATCH", matrix_path, f"rows={len(reverse_rows)} missing={missing_reverse} extra={extra_reverse}")
    direct_assignments: dict[str, set[str]] = defaultdict(set)
    package_assignments: dict[str, list[str]] = {}
    for package, assigned in reverse_rows:
        package_assignments[package] = assigned
        for av_id in assigned:
            direct_assignments[av_id].add(package)
            if av_id not in av_by_id:
                _error(errors, "REVERSE_UNKNOWN_AV", matrix_path, f"{package}:{av_id}")

    a01_expected = ["AV-UI-005"]
    a01_actual = package_assignments.get("A-01", [])
    flow001_required_packages = ["A-05", "B-03"]
    flow001_actual_packages = sorted(direct_assignments.get("AV-FLOW-001", set()))
    flow001_gates = sorted(gate_memberships.get("AV-FLOW-001", set()))
    responsibility_guard = {
        "A-01": {"expected": a01_expected, "actual": a01_actual},
        "AV-FLOW-001": {
            "required_packages": flow001_required_packages,
            "actual_packages": flow001_actual_packages,
            "gates": flow001_gates,
        },
    }
    if a01_actual != a01_expected:
        _error(errors, "A01_RESPONSIBILITY_MISMATCH", matrix_path, f"expected={a01_expected} actual={a01_actual}")
    if "A-05" not in flow001_actual_packages:
        _error(errors, "FLOW001_A05_RESPONSIBILITY_MISSING", matrix_path, "AV-FLOW-001 must remain assigned to A-05")
    if "B-03" not in flow001_actual_packages:
        _error(errors, "FLOW001_B03_RESPONSIBILITY_MISSING", matrix_path, "AV-FLOW-001 must remain assigned to B-03")
    if "A Gate" not in flow001_gates:
        _error(errors, "FLOW001_A_GATE_MEMBERSHIP_MISSING", matrix_path, "AV-FLOW-001 must remain in A Gate")

    uncovered_av: list[str] = []
    for row in av_rows:
        if row["domain"] != "CON":
            if not direct_assignments.get(row["id"]):
                uncovered_av.append(row["id"])
        elif direct_assignments.get(row["id"]):
            continue
        else:
            enforcement = row["enforcement"]
            if not enforcement or any(item not in av_by_id or not direct_assignments.get(item) for item in enforcement):
                uncovered_av.append(row["id"])
    if uncovered_av:
        _error(errors, "AV_ID_UNCOVERED", matrix_path, ",".join(sorted(uncovered_av)))

    design_path = "Anvil_설계서_v2.md"
    design = texts[design_path]
    scenario_section = _section(design, r"^### 49\.17 ", r"^### 49\.18 ")
    design_scenarios = {int(number): body.strip() for number, body in re.findall(r"^(\d+)\. (.+)$", scenario_section, flags=re.MULTILINE)}
    if sorted(design_scenarios) != list(range(1, 21)):
        _error(errors, "DESIGN_SCENARIO_TOTAL_MISMATCH", design_path, f"numbers={sorted(design_scenarios)}")
    scenario_index_path = "tests/fault/scenario-index.json"
    scenario_index = _read_json(root, scenario_index_path, json_overrides)
    scenario_entries = scenario_index.get("scenarios", [])
    if len(scenario_entries) != 20:
        _error(errors, "SCENARIO_INDEX_TOTAL_MISMATCH", scenario_index_path, f"count={len(scenario_entries)}")
    scenario_traces: list[dict[str, Any]] = []
    for number, entry in enumerate(scenario_entries, 1):
        expected_id = f"S49-17-{number:02d}"
        path = entry.get("scenario_path", "")
        if entry.get("scenario_id") != expected_id:
            _error(errors, "SCENARIO_ID_SEQUENCE_MISMATCH", scenario_index_path, f"number={number} id={entry.get('scenario_id')}")
        try:
            scenario = _read_json(root, path, json_overrides)
        except (OSError, json.JSONDecodeError) as exc:
            _error(errors, "SCENARIO_FILE_INVALID", path, str(exc))
            continue
        if verify_hashes and path not in json_overrides:
            actual = _sha256_bytes((root / path).read_bytes())
            if actual != entry.get("sha256"):
                _error(errors, "SCENARIO_FILE_HASH_MISMATCH", path, f"expected={entry.get('sha256')} actual={actual}")
        av_id = scenario.get("verification_id", "")
        row = av_by_id.get(av_id)
        if scenario.get("scenario_id") != expected_id or scenario.get("source_clause") != f"49.17-{number}":
            _error(errors, "SCENARIO_SOURCE_TRACE_MISMATCH", path, f"expected={expected_id}/49.17-{number}")
        if row is None or f"49.17-{number}" not in row.get("source", ""):
            _error(errors, "SCENARIO_AV_TRACE_MISMATCH", path, f"av={av_id}")
            row = {"packages": [], "evidence": []}
        actual_packages = set(filter(None, str(scenario.get("responsible_package", "")).split(",")))
        expected_packages = set(row.get("packages", []))
        if actual_packages != expected_packages:
            _error(errors, "SCENARIO_PACKAGE_TRACE_MISMATCH", path, f"expected={sorted(expected_packages)} actual={sorted(actual_packages)}")
        actual_evidence = set(scenario.get("evidence_types", []))
        expected_evidence = set(row.get("evidence", []))
        if actual_evidence != expected_evidence:
            _error(errors, "SCENARIO_EVIDENCE_TRACE_MISMATCH", path, f"expected={sorted(expected_evidence)} actual={sorted(actual_evidence)}")
        expected_gate = _expected_scenario_gate(number, expected_packages, gate_memberships.get(av_id, set()))
        if scenario.get("gate") != expected_gate:
            _error(errors, "SCENARIO_GATE_TRACE_MISMATCH", path, f"expected={expected_gate} actual={scenario.get('gate')}")
        if scenario.get("implementation_status") != "DESIGN_LOCKED" or scenario.get("execution_status") != "NOT_EXECUTED":
            _error(errors, "SCENARIO_FALSE_PASS", path, f"implementation={scenario.get('implementation_status')} execution={scenario.get('execution_status')}")
        scenario_traces.append({
            "scenario_id": expected_id, "source_clause": f"49.17-{number}", "verification_id": av_id,
            "packages": sorted(actual_packages), "gate": scenario.get("gate"),
            "evidence": sorted(actual_evidence), "execution_status": scenario.get("execution_status"),
        })

    test_path = "Anvil_테스트계획서_v1.md"
    test_plan = texts[test_path]
    dir_rows: dict[str, dict[str, Any]] = {}
    for line in test_plan.splitlines():
        cells = _cells(line)
        if len(cells) >= 4 and re.fullmatch(r"\*\*DIR-[123X]\*\*", cells[0]):
            name = cells[0].replace("**", "")
            cumulative = re.search(r"(\d+)\s*/\s*97", cells[2])
            dir_rows[name] = {"timing": cells[1], "cumulative": int(cumulative.group(1)) if cumulative else None}
    package_position = {package: index + 1 for index, package in enumerate(packages)}
    expected_dirs = {"DIR-1": ("A-15", 22), "DIR-2": ("C-15", 49), "DIR-3": ("E-11", 73)}
    dir_contract: dict[str, Any] = {}
    for name, (package, expected_position) in expected_dirs.items():
        actual_position = package_position.get(package)
        actual_row = dir_rows.get(name, {})
        dir_contract[name] = {"package": package, "calculated_cumulative": actual_position, "declared_cumulative": actual_row.get("cumulative")}
        if actual_position != expected_position or actual_row.get("cumulative") != expected_position or package not in actual_row.get("timing", ""):
            _error(errors, "DIR_CONTRACT_MISMATCH", test_path, f"{name}:{dir_contract[name]}")
    dir_contract["DIR-X"] = {"conditional_trigger": "DIRX-LRN-CRITICAL", "preserves": "DIR-3"}
    dir_sources = plan + "\n" + matrix + "\n" + test_plan + "\n" + texts["docs/governance/ANVIL_OPERATING_RULES.md"]
    if "DIRX-LRN-CRITICAL" not in dir_sources or "AV-LRN-003~005" not in dir_sources or "DIR-3" not in dir_sources:
        _error(errors, "DIR_CONTRACT_MISMATCH", "authority-set", "conditional DIR-X trigger or DIR-3 preservation missing")
    states = "DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED"
    if states not in plan or states not in texts["docs/governance/ANVIL_OPERATING_RULES.md"]:
        _error(errors, "DIR_STATE_CONTRACT_MISMATCH", "authority-set", states)

    environment_required = {
        test_path: ["ENV-LOCAL", "ENV-WSL-STAGING", "ENV-WSL-PG18-RC", "ENV-PRODUCTION", "WSL-server", "ysna-server", "envil.sinsan.kr", "PostgreSQL 15", "PostgreSQL 18 호환성 Release Candidate"],
        plan_path: ["Local→WSL-server→ysna-server", "envil.sinsan.kr", "PostgreSQL 15", "PostgreSQL 18"],
        design_path: ["WSL-server", "ysna-server", "envil.sinsan.kr"],
    }
    for path, needles in environment_required.items():
        missing = [needle for needle in needles if needle not in texts[path]]
        if missing:
            _error(errors, "ENVIRONMENT_CONTRACT_MISMATCH", path, f"missing={missing}")
    deployment_phrases = {
        test_path: "배포는 Git 이력만 사용하며",
        plan_path: "서버 배포는 Git 승인 commit/tag와 불변 ReleaseManifest만 사용하고",
        design_path: "서버 배포는 항상 Git을 통한다",
    }
    for path, phrase in deployment_phrases.items():
        if phrase not in texts[path]:
            _error(errors, "DEPLOYMENT_CONTRACT_MISMATCH", path, f"missing={phrase}")

    progress_path = "docs/progress/build-progress.json"
    progress = _read_json(root, progress_path, json_overrides)
    completed = set(progress.get("completed_packages", []))
    prior_packages = {f"G-{number:02d}" for number in range(1, 7)}
    if not prior_packages <= completed:
        _error(errors, "PRIOR_ACCEPTANCE_MISSING", progress_path, f"missing={sorted(prior_packages - completed)}")
    provenance: list[dict[str, Any]] = []
    for package in sorted(prior_packages):
        report_path = FINAL_TEST_REPORTS[package]
        report_text = _read_text(root, report_path, text_overrides)
        verdict_region = "\n".join(report_text.splitlines()[:35])
        if "PASS" not in verdict_region:
            _error(errors, "PRIOR_TEST_PASS_MISSING", report_path, package)
        manifest_path = FINAL_MANIFESTS[package]
        manifest = _read_json(root, manifest_path, json_overrides)
        target = str(manifest.get("target_hash", "")).removeprefix("sha256:")
        delivered = str(manifest.get("delivered_hash", "")).removeprefix("sha256:")
        if not target or target != delivered:
            _error(errors, "PRIOR_MANIFEST_TARGET_MISMATCH", manifest_path, f"target={target} delivered={delivered}")
        provenance.append({
            "package_id": package, "test_report": report_path,
            "test_report_sha256": _sha256_bytes(report_text.encode("utf-8")),
            "manifest": manifest_path, "manifest_sha256": _sha256_bytes((root / manifest_path).read_bytes()) if manifest_path not in json_overrides else _canonical_hash(manifest),
            "target_hash": target,
        })
    events = _read_json(root, "docs/progress/progress-events.json", json_overrides).get("events", [])
    if progress.get("event_sequence") == 168:
        completion_events = [event for event in events if 166 <= event.get("sequence", -1) <= 168]
        if (
            progress.get("status") != "TEST_REVIEW"
            or progress.get("active_work_instruction", {}).get("independent_tester_status") != "R4_PENDING"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None
            or [event.get("event_type") for event in completion_events]
            != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]
        ):
            _error(errors, "A14_R3_COMPLETION_PROJECTION_MISMATCH", progress_path, "sequence=168")
    if progress.get("event_sequence") == 171:
        takeover_events = [event for event in events if 169 <= event.get("sequence", -1) <= 171]
        if (
            progress.get("status") != "TEST_REVIEW"
            or progress.get("valid_failure_count") != 3
            or progress.get("active_failure_lineage", {}).get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED"
            or progress.get("active_work_instruction", {}).get("independent_tester_status") != "R5_PENDING"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None
            or [event.get("event_type") for event in takeover_events]
            != ["FAILURE_REPORT_ACCEPTED", "PACKAGE_RESUMED", "PACKAGE_COMPLETED"]
        ):
            _error(errors, "A14_MAIN_TAKEOVER_COMPLETION_PROJECTION_MISMATCH", progress_path, "sequence=171")
    if progress.get("event_sequence") == 174:
        portability_events = [event for event in events if 172 <= event.get("sequence", -1) <= 174]
        if (
            progress.get("status") != "TEST_REVIEW"
            or progress.get("valid_failure_count") != 4
            or progress.get("active_failure_lineage", {}).get("takeover_status") != "MAIN_AGENT_TAKEOVER_COMPLETED"
            or progress.get("active_work_instruction", {}).get("independent_tester_status") != "R6_PENDING"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None
            or [event.get("event_type") for event in portability_events]
            != ["FAILURE_REPORT_ACCEPTED", "PACKAGE_RESUMED", "PACKAGE_COMPLETED"]
        ):
            _error(errors, "A14_PORTABILITY_COMPLETION_PROJECTION_MISMATCH", progress_path, "sequence=174")
    if progress.get("event_sequence") == 175:
        acceptance = events[-1] if events else {}
        if (
            progress.get("current_work_package") != "A-15"
            or progress.get("status") != "READY"
            or progress.get("valid_failure_count") != 0
            or (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "A-15"
            or (progress.get("active_failure_lineage") or {}).get("valid_failure_count") != 0
            or progress.get("active_work_instruction") is not None
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None
            or acceptance.get("sequence") != 175
            or acceptance.get("event_type") != "MAIN_PACKAGE_ACCEPTED"
            or acceptance.get("subject_ref") != "A-14"
            or acceptance.get("details", {}).get("decision") != "ACCEPTED"
            or acceptance.get("details", {}).get("blocking_findings") != 0
            or acceptance.get("details", {}).get("next_package_status") != "READY"
        ):
            _error(errors, "A14_ACCEPTANCE_PROJECTION_MISMATCH", progress_path, "sequence=175")
    if progress.get("event_sequence") == 178:
        start_events = [event for event in events if 176 <= event.get("sequence", -1) <= 178]
        instruction = progress.get("active_work_instruction") or {}
        worker = progress.get("worker_lease") or {}
        write = progress.get("write_lease") or {}
        if (
            progress.get("current_work_package") != "A-15"
            or progress.get("status") != "ACTIVE"
            or progress.get("valid_failure_count") != 0
            or (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "A-15"
            or instruction.get("artifact_id") != "WI-A-15-20260813-001"
            or instruction.get("user_ux_approval_status") != "PENDING_USER_DECISION"
            or worker.get("lease_epoch") != 1
            or write.get("write_epoch") != 1
            or write.get("worker_lease_id") != worker.get("lease_id")
            or [event.get("event_type") for event in start_events]
            != ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"]
            or (events[-1] if events else {}).get("subject_ref") != "A-15"
            or (progress.get("dir_review") or {}).get("status") != "NOT_REACHED"
        ):
            _error(errors, "A15_START_PROJECTION_MISMATCH", progress_path, "sequence=178")
    if progress.get("event_sequence") == 181:
        completion_events = [event for event in events if 179 <= event.get("sequence", -1) <= 181]
        instruction = progress.get("active_work_instruction") or {}
        if (
            progress.get("current_work_package") != "A-15"
            or progress.get("status") != "TEST_REVIEW"
            or progress.get("valid_failure_count") != 0
            or (progress.get("active_failure_lineage") or {}).get("step_lineage_id") != "A-15"
            or instruction.get("artifact_id") != "WI-A-15-20260813-001"
            or instruction.get("result_status") != "COMPLETED"
            or instruction.get("independent_tester_status") != "PENDING"
            or instruction.get("user_ux_approval_status") != "PENDING_USER_DECISION"
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None
            or [event.get("event_type") for event in completion_events]
            != ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]
            or (events[-1] if events else {}).get("subject_ref") != "A-15"
            or (progress.get("dir_review") or {}).get("status") != "NOT_REACHED"
        ):
            _error(errors, "A15_COMPLETION_PROJECTION_MISMATCH", progress_path, "sequence=181")
    if progress.get("event_sequence") == 184:
        terminal_events = [event for event in events if 182 <= event.get("sequence", -1) <= 184]
        phase_gate = progress.get("phase_gate") or {}
        if (
            progress.get("current_work_package") != "A-15"
            or progress.get("status") != "DIR_HOLD"
            or "A-15" not in progress.get("completed_packages", [])
            or progress.get("active_work_instruction") is not None
            or progress.get("active_agent") is not None
            or progress.get("worker_lease") is not None
            or progress.get("write_lease") is not None
            or [event.get("event_type") for event in terminal_events]
            != ["MAIN_PACKAGE_ACCEPTED", "DIR_REACHED", "DIR_REPORTED"]
            or terminal_events[0].get("subject_ref") != "A-15"
            or terminal_events[0].get("details", {}).get("user_ux_decision") != "APPROVED"
            or (progress.get("dir_review") or {}).get("checkpoint") != "DIR-1"
            or (progress.get("dir_review") or {}).get("status") != "WAITING_OWNER_DIRECTION"
            or phase_gate.get("gate") != "A Gate"
            or phase_gate.get("decision") != "NOT_STARTED"
            or phase_gate.get("checkpoint_status") != "BLOCKED_PENDING_DIR1_OWNER_DIRECTION"
        ):
            _error(errors, "A15_ACCEPTANCE_DIR1_PROJECTION_MISMATCH", progress_path, "sequence=184")
    if progress.get("event_sequence") == 186:
        terminal=[event for event in events if 185 <= event.get("sequence",-1) <= 186]
        if (progress.get("current_work_package")!="B-01" or progress.get("status")!="READY" or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or (progress.get("dir_review") or {}).get("status")!="CLEARED" or (progress.get("phase_gate") or {}).get("decision")!="ACCEPTED" or (progress.get("phase_gate") or {}).get("b01_started") is not False or [event.get("event_type") for event in terminal] != ["DIR_OWNER_DIRECTION_RECORDED","PHASE_GATE_DECIDED"]):
            _error(errors,"A_GATE_DECISION_PROJECTION_MISMATCH",progress_path,"sequence=186")
    if progress.get("event_sequence") == 189:
        terminal=[event for event in events if 187 <= event.get("sequence",-1) <= 189]
        if (progress.get("current_work_package")!="B-01" or progress.get("status")!="ACTIVE" or (progress.get("active_work_instruction") or {}).get("artifact_id")!="WI-B-01-20260813-001" or progress.get("active_agent")!="developer-primary-b01" or (progress.get("worker_lease") or {}).get("lease_epoch")!=1 or (progress.get("write_lease") or {}).get("write_epoch")!=1 or (progress.get("dir_review") or {}).get("status")!="CLEARED" or (progress.get("phase_gate") or {}).get("decision")!="ACCEPTED" or (progress.get("phase_gate") or {}).get("b01_started") is not True or [event.get("event_type") for event in terminal] != ["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"]):
            _error(errors,"B01_START_PROJECTION_MISMATCH",progress_path,"sequence=189")
    if progress.get("event_sequence") == 210:
        terminal=[event for event in events if 208 <= event.get("sequence",-1) <= 210]
        if (progress.get("current_work_package")!="B-02" or progress.get("status")!="ACTIVE" or (progress.get("active_work_instruction") or {}).get("artifact_id")!="WI-B-02-20260814-001" or progress.get("active_agent")!="developer-primary-b02" or (progress.get("worker_lease") or {}).get("lease_epoch")!=1 or (progress.get("write_lease") or {}).get("write_epoch")!=1 or [event.get("event_type") for event in terminal] != ["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"]):
            _error(errors,"B02_START_PROJECTION_MISMATCH",progress_path,"sequence=210")
    if progress.get("event_sequence") == 213:
        terminal=[event for event in events if 211 <= event.get("sequence",-1) <= 213]
        instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-02" or progress.get("status")!="TEST_REVIEW" or instruction.get("artifact_id")!="WI-B-02-20260814-001" or instruction.get("result_status")!="COMPLETED" or instruction.get("independent_tester_status")!="PENDING" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]):
            _error(errors,"B02_COMPLETION_PROJECTION_MISMATCH",progress_path,"sequence=213")
    if progress.get("event_sequence") == 217:
        terminal=[event for event in events if 214 <= event.get("sequence",-1) <= 217]; instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-02" or progress.get("status")!="ACTIVE" or progress.get("valid_failure_count")!=1 or instruction.get("artifact_id")!="WI-B-02-20260814-002" or instruction.get("result_status")!="REWORK_IN_PROGRESS" or progress.get("active_agent")!="developer-primary-b02" or (progress.get("worker_lease") or {}).get("lease_epoch")!=2 or (progress.get("write_lease") or {}).get("write_epoch")!=2 or [event.get("event_type") for event in terminal] != ["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"]):
            _error(errors,"B02_R2_START_PROJECTION_MISMATCH",progress_path,"sequence=217")
    if progress.get("event_sequence") == 220:
        terminal=[event for event in events if 218 <= event.get("sequence",-1) <= 220]; instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-02" or progress.get("status")!="TEST_REVIEW" or instruction.get("artifact_id")!="WI-B-02-20260814-002" or instruction.get("result_status")!="COMPLETED" or instruction.get("independent_tester_status")!="R2_PENDING" or instruction.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]):
            _error(errors,"B02_R2_COMPLETION_PROJECTION_MISMATCH",progress_path,"sequence=220")
    if progress.get("event_sequence") == 221:
        acceptance=[event for event in events if event.get("sequence")==221]
        historical=progress.get("historical_failure_counts_by_lineage") or {}
        if (progress.get("current_work_package")!="B-03" or progress.get("status")!="READY" or "B-02" not in progress.get("completed_packages",[]) or progress.get("valid_failure_count")!=0 or historical.get("B-02")!=1 or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or [event.get("event_type") for event in acceptance] != ["MAIN_PACKAGE_ACCEPTED"]):
            _error(errors,"B02_R2_ACCEPTANCE_PROJECTION_MISMATCH",progress_path,"sequence=221")
    if progress.get("event_sequence") == 224:
        terminal=[event for event in events if 222 <= event.get("sequence",-1) <= 224]; instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-03" or progress.get("status")!="ACTIVE" or instruction.get("artifact_id")!="WI-B-03-20260814-001" or progress.get("active_agent")!="developer-primary-b03" or (progress.get("worker_lease") or {}).get("lease_epoch")!=1 or (progress.get("write_lease") or {}).get("write_epoch")!=1 or progress.get("valid_failure_count")!=0 or (progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE" or [event.get("event_type") for event in terminal] != ["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED"]):
            _error(errors,"B03_START_PROJECTION_MISMATCH",progress_path,"sequence=224")
    if progress.get("event_sequence") == 227:
        terminal=[event for event in events if 225 <= event.get("sequence",-1) <= 227]; instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-03" or progress.get("status")!="TEST_REVIEW" or instruction.get("artifact_id")!="WI-B-03-20260814-001" or instruction.get("independent_tester_status")!="PENDING" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("valid_failure_count")!=0 or (progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE" or [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]):
            _error(errors,"B03_COMPLETION_PROJECTION_MISMATCH",progress_path,"sequence=227")
    if progress.get("event_sequence") == 230:
        terminal=[event for event in events if 228 <= event.get("sequence",-1) <= 230]; instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-03" or progress.get("status")!="ACTIVE" or instruction.get("artifact_id")!="WI-B-03-20260814-002" or progress.get("active_agent")!="developer-primary-b03" or (progress.get("worker_lease") or {}).get("lease_epoch")!=2 or (progress.get("write_lease") or {}).get("write_epoch")!=2 or progress.get("valid_failure_count")!=0 or (progress.get("next_work_package") or {}).get("status")!="BLOCKED_PENDING_B03_ACCEPTANCE" or [event.get("event_type") for event in terminal] != ["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"]):
            _error(errors,"B03_R2_START_PROJECTION_MISMATCH",progress_path,"sequence=230")
    if progress.get("event_sequence") == 233:
        terminal=[event for event in events if 231 <= event.get("sequence",-1) <= 233]; instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-03" or progress.get("status")!="TEST_REVIEW" or instruction.get("artifact_id")!="WI-B-03-20260814-002" or instruction.get("independent_tester_status")!="R2_PENDING" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or progress.get("valid_failure_count")!=0 or [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]):
            _error(errors,"B03_R2_COMPLETION_PROJECTION_MISMATCH",progress_path,"sequence=233")
    if progress.get("event_sequence") == 192:
        terminal=[event for event in events if 190 <= event.get("sequence",-1) <= 192]
        if (progress.get("current_work_package")!="B-01" or progress.get("status")!="TEST_REVIEW" or (progress.get("active_work_instruction") or {}).get("independent_tester_status")!="PENDING" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]):
            _error(errors,"B01_COMPLETION_PROJECTION_MISMATCH",progress_path,"sequence=192")
    if progress.get("event_sequence") == 196:
        terminal=[event for event in events if 193 <= event.get("sequence",-1) <= 196]
        if (progress.get("current_work_package")!="B-01" or progress.get("status")!="ACTIVE" or progress.get("valid_failure_count")!=1 or (progress.get("active_work_instruction") or {}).get("artifact_id")!="WI-B-01-20260813-002" or (progress.get("active_work_instruction") or {}).get("result_status")!="REWORK_IN_PROGRESS" or progress.get("active_agent")!="developer-primary-b01" or (progress.get("worker_lease") or {}).get("lease_epoch")!=2 or (progress.get("write_lease") or {}).get("write_epoch")!=2 or [event.get("event_type") for event in terminal] != ["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"]):
            _error(errors,"B01_R2_START_PROJECTION_MISMATCH",progress_path,"sequence=196")
    if progress.get("event_sequence") == 199:
        terminal=[event for event in events if 197 <= event.get("sequence",-1) <= 199]
        instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-01" or progress.get("status")!="TEST_REVIEW" or instruction.get("artifact_id")!="WI-B-01-20260813-002" or instruction.get("result_status")!="COMPLETED" or instruction.get("independent_tester_status")!="R2_PENDING" or instruction.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]):
            _error(errors,"B01_R2_COMPLETION_PROJECTION_MISMATCH",progress_path,"sequence=199")
    if progress.get("event_sequence") == 203:
        terminal=[event for event in events if 200 <= event.get("sequence",-1) <= 203]
        instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-01" or progress.get("status")!="ACTIVE" or progress.get("valid_failure_count")!=2 or instruction.get("artifact_id")!="WI-B-01-20260814-003" or instruction.get("result_status")!="REWORK_IN_PROGRESS" or instruction.get("independent_tester_status")!="R3_PENDING" or progress.get("active_agent")!="developer-primary-b01" or (progress.get("worker_lease") or {}).get("lease_epoch")!=3 or (progress.get("write_lease") or {}).get("write_epoch")!=3 or [event.get("event_type") for event in terminal] != ["FAILURE_REPORT_ACCEPTED","WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_RESUMED"]):
            _error(errors,"B01_R3_START_PROJECTION_MISMATCH",progress_path,"sequence=203")
    if progress.get("event_sequence") == 206:
        terminal=[event for event in events if 204 <= event.get("sequence",-1) <= 206]
        instruction=progress.get("active_work_instruction") or {}
        if (progress.get("current_work_package")!="B-01" or progress.get("status")!="TEST_REVIEW" or progress.get("valid_failure_count")!=2 or instruction.get("artifact_id")!="WI-B-01-20260814-003" or instruction.get("result_status")!="COMPLETED" or instruction.get("independent_tester_status")!="R3_PENDING" or instruction.get("finding_status")!="FIXED_AWAITING_INDEPENDENT_RETEST" or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or [event.get("event_type") for event in terminal] != ["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"]):
            _error(errors,"B01_R3_COMPLETION_PROJECTION_MISMATCH",progress_path,"sequence=206")
    if progress.get("event_sequence") == 207:
        acceptance=[event for event in events if event.get("sequence")==207]
        historical=progress.get("historical_failure_counts_by_lineage") or {}
        if (progress.get("current_work_package")!="B-02" or progress.get("status")!="READY" or "B-01" not in progress.get("completed_packages",[]) or progress.get("valid_failure_count")!=0 or (progress.get("active_failure_lineage") or {}).get("step_lineage_id")!="B-02" or historical.get("B-01")!=2 or progress.get("active_work_instruction") is not None or progress.get("active_agent") is not None or progress.get("worker_lease") is not None or progress.get("write_lease") is not None or [event.get("event_type") for event in acceptance] != ["MAIN_PACKAGE_ACCEPTED"]):
            _error(errors,"B01_R3_ACCEPTANCE_PROJECTION_MISMATCH",progress_path,"sequence=207")
    accepted_events = {event.get("subject_ref") for event in events if event.get("event_type") == "MAIN_PACKAGE_ACCEPTED" and event.get("details", {}).get("decision") == "ACCEPTED"}
    phase_g_gate_accepted = any(
        event.get("event_type") == "PHASE_GATE_DECIDED"
        and event.get("subject_ref") == "G Gate"
        and event.get("details", {}).get("verdict") == "ACCEPTED"
        for event in events
    )
    phase_g_checkpoint = next(
        (
            event for event in reversed(events)
            if event.get("event_type") == "GIT_PUSH"
            and event.get("subject_ref") == "PHASE_G_GATE"
            and event.get("details", {}).get("checkpoint_status") == "CLEARED"
            and event.get("details", {}).get("a01_start_allowed") is True
        ),
        None,
    )
    if not {"G-05", "G-06", "G-07"} <= accepted_events:
        _error(errors, "PRIOR_ACCEPTANCE_EVENT_MISSING", "docs/progress/progress-events.json", f"actual={sorted(accepted_events)}")

    failure_ledger = _read_json(root, "docs/progress/failure-ledger.json", json_overrides)
    valid_historical_failures = [
        entry for entry in failure_ledger.get("entries", [])
        if entry.get("result_status") == "FAILURE_REPORT"
        and entry.get("accepted") is True
        and entry.get("counts_toward_valid_failure") is True
        and entry.get("validator_acceptance") is True
    ]
    active_lineage_id = progress.get("active_failure_lineage", {}).get("step_lineage_id", "G-07")
    active_lineage_count = sum(1 for entry in valid_historical_failures if entry.get("step_lineage_id") == active_lineage_id)
    historical_failures = [entry for entry in valid_historical_failures if entry.get("step_lineage_id") != active_lineage_id]
    failure_counts = {
        "active_lineage": active_lineage_id,
        "active_lineage_valid_failure_count": active_lineage_count,
        "historical_accepted_failure_total": len(historical_failures),
        "historical_by_lineage": dict(sorted(Counter(entry.get("step_lineage_id") for entry in historical_failures).items())),
    }
    if progress.get("active_failure_lineage", {}).get("valid_failure_count") != active_lineage_count:
        _error(errors, "ACTIVE_FAILURE_PROJECTION_MISMATCH", progress_path, f"expected={active_lineage_count}")
    if progress.get("historical_accepted_failure_count") != len(historical_failures):
        _error(errors, "HISTORICAL_FAILURE_PROJECTION_MISMATCH", progress_path, f"expected={len(historical_failures)}")

    reconciliation_events = [event for event in events if event.get("event_type") == "REPOSITORY_RECONCILED"]
    repository_events = [
        event
        for event in events
        if event.get("event_type") in {"GIT_PUSH", "REPOSITORY_RECONCILED"}
    ]
    projection_events = [
        event for event in events
        if event.get("event_type") in {"PACKAGE_STARTED", "PACKAGE_COMPLETED", "PACKAGE_RESUMED", "MAIN_PACKAGE_ACCEPTED", "PHASE_GATE_DECIDED"}
        and isinstance(event.get("details"), dict)
        and event["details"].get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE
    ]
    reconciliation_event = max(
        repository_events + projection_events,
        key=lambda event: event.get("sequence", 0),
        default=phase_g_checkpoint,
    )
    reconciliation = reconciliation_event.get("details", {}) if reconciliation_event else {}
    if progress.get("event_sequence") == 207:
        acceptance = next((event for event in events if event.get("sequence") == 207), None)
        if acceptance is not None:
            reconciliation_event = acceptance
            reconciliation = dict(progress.get("repository", {}))
    if not reconciliation_events:
        _error(errors, "PROGRESS_RECONCILIATION_EVENT_MISSING", "docs/progress/progress-events.json", "REPOSITORY_RECONCILED")
    progress_reconciliation = {"event_type": reconciliation_event.get("event_type") if reconciliation_event else None, **reconciliation}

    git_evidence: dict[str, Any] = {"verified": False}
    if verify_git:
        rc_head, head = _git(root, "rev-parse", "HEAD")
        rc_upstream, upstream = _git(root, "rev-parse", "@{u}")
        rc_branch, branch = _git(root, "branch", "--show-current")
        git_evidence = {"verified": True, "branch": branch, "head": head, "upstream_head": upstream}
        is_push_projection = reconciliation_event and reconciliation_event.get("event_type") == "GIT_PUSH"
        if (
            rc_head
            or rc_upstream
            or rc_branch
            or branch != "main"
            or (is_push_projection and head != upstream)
        ):
            _error(errors, "GIT_PROVENANCE_MISMATCH", ".git", f"branch={branch} head={head} upstream={upstream}")
        repository_projection = progress.get("repository", {})
        if repository_projection.get("projection_mode") == VALIDATED_BASE_PROJECTION_MODE:
            base = repository_projection.get("validated_base_commit")
            allowed = repository_projection.get("exact_allowed_paths")
            projection_valid = (
                repository_projection.get("head_relation") == VALIDATED_BASE_PENDING_RELATION
                and isinstance(base, str)
                and re.fullmatch(r"[0-9a-f]{40}", base) is not None
                and isinstance(allowed, list)
                and bool(allowed)
                and all(isinstance(path, str) and path for path in allowed)
                and allowed == sorted(set(allowed))
            )
            if not projection_valid:
                _error(errors, "GIT_DESCENDANT_PROJECTION_INVALID", progress_path, str(repository_projection))
                allowed = []
            completion_developer_paths: set[str] = set()
            completion_subject = reconciliation_event.get("subject_ref")
            if (
                reconciliation_event.get("event_type") == "PACKAGE_COMPLETED"
                and completion_subject in {"A-06", "A-07", "A-08", "A-09", "A-10", "A-11", "A-12", "A-13"}
            ):
                manifest_relative = f"docs/evidence/manifests/{completion_subject}_EVIDENCE_MANIFEST.json"
                try:
                    completion_manifest = json.loads((root / manifest_relative).read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    completion_manifest = {}
                completion_developer_paths = {
                    row.get("path")
                    for row in completion_manifest.get("raw_artifacts", [])
                    if isinstance(row, dict) and isinstance(row.get("path"), str)
                }
                completion_developer_paths.add(manifest_relative)
            if (
                reconciliation_event.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
                and reconciliation_event.get("subject_ref") == "A-13"
            ):
                acceptance_relative = "docs/evidence/manifests/A-13_ACCEPTANCE_PROGRESS_MANIFEST_R2.json"
                try:
                    acceptance_manifest = json.loads((root / acceptance_relative).read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    acceptance_manifest = {}
                completion_developer_paths.update(
                    row.get("path")
                    for row in acceptance_manifest.get("developer_successor_projection", {}).get("live_raw_checksums", [])
                    if isinstance(row, dict) and isinstance(row.get("path"), str)
                )
            if (
                reconciliation_event.get("event_type") == "MAIN_PACKAGE_ACCEPTED"
                and reconciliation_event.get("subject_ref") == "A-14"
            ):
                acceptance_relative = "docs/evidence/manifests/A-14_ACCEPTANCE_PROGRESS_MANIFEST_R6.json"
                try:
                    acceptance_manifest = json.loads((root / acceptance_relative).read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    acceptance_manifest = {}
                for projection_name in ("a13_successor_projection", "a14_successor_projection"):
                    completion_developer_paths.update(
                        row.get("path")
                        for row in acceptance_manifest.get(projection_name, {}).get("live_raw_checksums", [])
                        if isinstance(row, dict) and isinstance(row.get("path"), str)
                    )
            non_evidence_paths = {path for path in allowed if not _is_evidence_only_path(path)}
            if reconciliation_event.get("event_type") == "PACKAGE_STARTED" and reconciliation_event.get("subject_ref") == "B-01" and reconciliation_event.get("sequence") == 189:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_COMPLETED" and reconciliation_event.get("subject_ref") == "B-01" and reconciliation_event.get("sequence") == 192:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_RESUMED" and reconciliation_event.get("subject_ref") == "B-01" and reconciliation_event.get("sequence") == 196:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_COMPLETED" and reconciliation_event.get("subject_ref") == "B-01" and reconciliation_event.get("sequence") == 199:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_RESUMED" and reconciliation_event.get("subject_ref") == "B-01" and reconciliation_event.get("sequence") == 203:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_COMPLETED" and reconciliation_event.get("subject_ref") == "B-01" and reconciliation_event.get("sequence") == 206:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_STARTED" and reconciliation_event.get("subject_ref") == "B-02" and reconciliation_event.get("sequence") == 210:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_COMPLETED" and reconciliation_event.get("subject_ref") == "B-02" and reconciliation_event.get("sequence") == 213:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_RESUMED" and reconciliation_event.get("subject_ref") == "B-02" and reconciliation_event.get("sequence") == 217:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_COMPLETED" and reconciliation_event.get("subject_ref") == "B-02" and reconciliation_event.get("sequence") == 220:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_STARTED" and reconciliation_event.get("subject_ref") == "B-03" and reconciliation_event.get("sequence") == 224:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_COMPLETED" and reconciliation_event.get("subject_ref") == "B-03" and reconciliation_event.get("sequence") == 227:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_RESUMED" and reconciliation_event.get("subject_ref") == "B-03" and reconciliation_event.get("sequence") == 230:
                completion_developer_paths.update(non_evidence_paths)
            if reconciliation_event.get("event_type") == "PACKAGE_COMPLETED" and reconciliation_event.get("subject_ref") == "B-03" and reconciliation_event.get("sequence") == 233:
                completion_developer_paths.update(non_evidence_paths)
            if non_evidence_paths and not non_evidence_paths <= completion_developer_paths:
                _error(errors, "GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN", progress_path, str(allowed))
            working_tree_mode = head == base
            if working_tree_mode:
                rc_changed, changed_output = _git(root, "status", "--porcelain=v1", "--untracked-files=all")
                changed_paths = _git_worktree_paths(changed_output)
                base_is_ancestor = True
            else:
                rc_ancestor, _ = _git(root, "merge-base", "--is-ancestor", str(base), head)
                rc_changed, changed_output = _git(root, "diff", "--name-only", f"{base}..{head}")
                changed_paths = _git_name_only(changed_output)
                base_is_ancestor = rc_ancestor == 0
            git_evidence.update(
                {
                    "validated_base_commit": base,
                    "working_tree_mode": working_tree_mode,
                    "changed_paths": changed_paths,
                }
            )
            if not base_is_ancestor:
                _error(errors, "GIT_VALIDATED_BASE_NOT_ANCESTOR", ".git", f"base={base} head={head}")
            if rc_changed or changed_paths != allowed:
                _error(errors, "GIT_DESCENDANT_PATH_SET_MISMATCH", ".git", f"allowed={allowed} actual={changed_paths}")
            remote_lag_declared = (
                working_tree_mode
                and repository_projection.get("push_status") == "PUSH_PENDING_MAIN"
                and repository_projection.get("remote_head") == upstream
                and isinstance(upstream, str)
                and re.fullmatch(r"[0-9a-f]{40}", upstream) is not None
                and upstream != base
            )
            expected_remote = upstream if remote_lag_declared else (base if working_tree_mode else head)
            if upstream != expected_remote:
                _error(errors, "GIT_DESCENDANT_ORIGIN_MISMATCH", ".git", f"expected={expected_remote} actual={upstream}")
            projection_fields = (
                "projection_mode",
                "validated_base_commit",
                "head_relation",
                "exact_allowed_paths",
                "branch",
                "upstream",
                "remote_head",
                "push_status",
            )
            if any(reconciliation.get(field) != repository_projection.get(field) for field in projection_fields):
                _error(errors, "PROGRESS_RECONCILIATION_MISMATCH", "docs/progress/progress-events.json", "validated-base projection fields differ")
        else:
            if repository_projection.get("local_head") != head or repository_projection.get("remote_head") != upstream:
                _error(errors, "PROGRESS_REPOSITORY_STALE", progress_path, f"projected={repository_projection} actual={head}/{upstream}")
            projected_local = reconciliation.get("local_commit") if is_push_projection else reconciliation.get("local_head")
            projected_remote = reconciliation.get("remote_commit") if is_push_projection else reconciliation.get("remote_head")
            if projected_local != head or projected_remote != upstream:
                _error(errors, "PROGRESS_RECONCILIATION_MISMATCH", "docs/progress/progress-events.json", f"event={reconciliation} actual={head}/{upstream}")
        for item in provenance:
            rc, commits = _git(root, "log", "--format=%H", "--", item["manifest"])
            if rc or not commits:
                _error(errors, "GIT_PROVENANCE_MISSING", item["manifest"], item["package_id"])

    regression = {
        "AV-FLOW-003": {"package": "G-04", "status": "PASS", "source": FINAL_TEST_REPORTS["G-04"]},
        "AV-STAT-015": {"package": "G-05", "status": "PASS", "source": FINAL_TEST_REPORTS["G-05"]},
        "AV-STAT-016": {"package": "G-05", "status": "PASS", "source": FINAL_TEST_REPORTS["G-05"]},
        "AV-CON-016(RV)": {"package": "G-01", "status": "PASS", "source": FINAL_TEST_REPORTS["G-01"]},
        "AV-GATE-026": {"package": "G-07", "status": "PASS", "source": "docs/test_reports/G-07_TEST_REPORT.md"},
    }
    mapping_material = {
        "package_order": packages,
        "dependencies": {key: sorted(value) for key, value in sorted(dependency_graph.items())},
        "package_assignments": {key: value for key, value in sorted(package_assignments.items())},
        "constitutional_enforcement": {row["id"]: row["enforcement"] for row in av_rows if row["domain"] == "CON"},
        "scenario_traces": scenario_traces,
        "dir_contract": dir_contract,
    }
    counts = {
        "package_total": len(packages),
        "unique_package_total": len(package_counter),
        "reverse_package_total": len(reverse_rows),
        "av_total": len(av_ids),
        "unique_av_total": len(av_counter),
        "executable_av_total": sum(1 for row in av_rows if row["domain"] != "CON"),
        "constitutional_av_total": domain_counts.get("CON", 0),
        "uncovered_av_total": len(uncovered_av),
        "scenario_total": len(scenario_traces),
    }
    return {
        "schema_version": "1.0.0",
        "package_id": "G-07",
        "authority_inventory": authority_inventory,
        "counts": counts,
        "domain_counts": dict(sorted(domain_counts.items())),
        "mapping_hash": _canonical_hash(mapping_material),
        "package_assignments": package_assignments,
        "responsibility_guard": responsibility_guard,
        "scenario_traces": scenario_traces,
        "dir_contract": dir_contract,
        "prior_acceptance_provenance": provenance,
        "git": git_evidence,
        "g_gate": {
            "regression": regression,
            "readiness": "A01_READY" if phase_g_checkpoint else ("PHASE_G_GATE_ACCEPTED_CHECKPOINT_PENDING" if phase_g_gate_accepted else "ACCEPTED_AWAITING_PHASE_G_GATE"),
            "developer_may_mark_gate_complete": False,
            "a01_start_allowed": bool(phase_g_checkpoint),
            "remaining_before_a01": [] if phase_g_checkpoint else (["GIT_GATE_CHECKPOINT"] if phase_g_gate_accepted else ["PHASE_G_GATE_RECORD"]),
        },
        "progress_reconciliation": progress_reconciliation,
        "failure_counts": failure_counts,
        "unverified": [
            "runtime_scenarios_20", "fault_injections_8", "product_api_ui_db_wsl_production",
            "g_gate_completion",
        ],
        "errors": errors,
        "status": "PASS" if not errors else "FAIL",
    }


def render_markdown(report: Mapping[str, Any]) -> str:
    counts = report["counts"]
    lines = [
        "# G-07 통합 기준선 독립 정규화 검증 보고서",
        "",
        f"- validator_status: `{report['status']}`",
        "- package_status: `ACCEPTED_AWAITING_PHASE_G_GATE`",
        f"- mapping_hash: `{report['mapping_hash']}`",
        f"- G Gate readiness: `{report['g_gate']['readiness']}`",
        "",
        "## 판정",
        "",
        "`ACCEPTED / GATE_REVIEW` — 독립 Tester PASS와 Main Agent 수락을 증거화했다. 별도 Phase G Gate 결정 전에는 Gate 완료 또는 A-01 READY가 아니다.",
        "",
        "## 재계산 결과",
        "",
        f"- Package: `{counts['package_total']}` / unique `{counts['unique_package_total']}` / 역색인 `{counts['reverse_package_total']}`",
        f"- AV: `{counts['av_total']}` / unique `{counts['unique_av_total']}` / executable `{counts['executable_av_total']}` / constitutional `{counts['constitutional_av_total']}`",
        f"- 미할당 또는 미집행 AV: `{counts['uncovered_av_total']}`",
        f"- §49.17 trace: `{counts['scenario_total']}/20`",
        "",
        "## 권위 기준선",
        "",
        "| path | version | SHA-256 |",
        "|---|---|---|",
    ]
    lines.extend(f"| `{item['path']}` | `{item['version']}` | `{item['sha256']}` |" for item in report["authority_inventory"])
    lines += [
        "",
        "## DIR·환경·배포",
        "",
        "- DIR-1=A-15 누적 22, DIR-2=C-15 누적 49, 조건부 DIR-X, DIR-3=E-11 누적 73을 parser로 대조했다.",
        "- Local→WSL-server PostgreSQL 15→격리 PostgreSQL 18 RC→ysna-server/`envil.sinsan.kr`와 Git-only 승격 계약을 대조했다.",
        "",
        "## G Gate 경계",
        "",
        "- G-04 `AV-FLOW-003`, G-05 `AV-STAT-015/016`, G-01 `AV-CON-016(RV)`의 기존 독립 PASS evidence를 재결박했다.",
        "- `AV-GATE-026`은 G-07 Developer 검증까지만 완료됐고 독립 Tester PASS와 Main ACCEPTED 전에는 Gate PASS로 집계하지 않는다.",
        "- §49.17 20건은 `DESIGN_LOCKED / NOT_EXECUTED`이며 runtime·제품 PASS가 아니다.",
        "",
        "## 오류",
        "",
    ]
    if report["errors"]:
        lines.extend(f"- `{item['code']}` `{item['path']}`: {item['detail']}" for item in report["errors"])
    else:
        lines.append("- 없음")
    lines += [
        "",
        "## 미검증 범위",
        "",
        *[f"- `{item}`" for item in report["unverified"]],
        "",
        "## 조치",
        "",
        "독립 Tester가 동일 revision을 적대 재검증한 뒤 Main Agent가 G-07 수락과 G Gate 판정을 별도로 수행한다. A-01은 시작하지 않는다.",
        "",
    ]
    return "\n".join(lines)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--json-output")
    parser.add_argument("--markdown-output")
    args = parser.parse_args(list(argv) if argv is not None else None)
    report = validate_repository(args.root)
    if args.json_output:
        Path(args.json_output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.markdown_output:
        Path(args.markdown_output).write_text(render_markdown(report), encoding="utf-8")
    print(
        f"G-07 baseline: {report['status']} packages={report['counts']['package_total']} "
        f"av={report['counts']['unique_av_total']} uncovered={report['counts']['uncovered_av_total']} "
        f"scenarios={report['counts']['scenario_total']} mapping={report['mapping_hash']}"
    )
    if report["errors"]:
        for item in report["errors"]:
            print(f"{item['code']} {item['path']} {item['detail']}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
