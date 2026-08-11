#!/usr/bin/env python3
"""Fail-closed validation for the A-02 static screen-token contract."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any


CATALOG_REL = Path("docs/architecture/a02/A-02_TOKEN_CATALOG.json")
SPEC_REL = Path("docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md")
EXPLANATION_REL = Path("docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md")
SVG_REL = Path("docs/architecture/a02/A-02_STATIC_RENDER.svg")
A01_CATALOG_REL = Path("docs/architecture/a01/A-01_PATH_CATALOG.json")

EXPECTED_VIEWPORT = {"width_px": 1920, "height_px": 1080}
EXPECTED_TYPOGRAPHY = {
    "body_form_px": 12,
    "small_description_px": 10,
    "auxiliary_px": 9,
    "sidebar_title_px": 14,
    "screen_title_px": 16,
}
EXPECTED_LAYOUT = {
    "sidebar_expanded_px": 224,
    "sidebar_collapsed_px": 56,
    "header_px": 48,
    "context_drawer_px": 360,
    "context_drawer_mode": "ON_DEMAND",
    "base_padding_px": 16,
    "card_gap_px": 12,
}
EXPECTED_COLORS = {
    "canvas": "#0B1220",
    "surface": "#142033",
    "surface-raised": "#1B2A42",
    "text-primary": "#F7F9FC",
    "text-muted": "#B8C4D8",
    "border": "#60738F",
    "interactive": "#7DB4FF",
    "focus": "#F8D66D",
    "success": "#5EE3A1",
    "warning": "#FFD166",
    "danger": "#FF7B86",
    "blocked": "#C4A7FF",
    "info": "#74D7FF",
    "neutral": "#B8C4D8",
}
EXPECTED_EXPLANATION = {
    "entry_point": "i-icon",
    "short_content_surface": "tooltip",
    "complex_content_surface": "popover",
    "required_content": ["reason", "next_action"],
    "persistent_explanation_box_allowed": False,
    "hover_only_allowed": False,
    "focus_path_required": True,
    "keyboard_access_required": True,
    "escape_closes": True,
    "focus_returns_to_trigger": True,
}
EXPECTED_STATUS = {
    "color_only_allowed": False,
    "required_parts": ["icon", "status_label", "short_description"],
    "explanation_binding": "i-tooltip-popover",
}
EXPECTED_VERIFICATION = {
    "assigned_verification_ids": ["AV-UI-001", "AV-UI-002"],
    "required_levels": ["L4"],
    "required_methods": ["AE", "MI"],
    "required_evidence": ["E-SHOT", "E-ART", "E-MAN", "E-TEST"],
    "execution_classification": "STATIC_ONLY",
    "package_verdict": "STATIC_CONTRACT_PASS",
    "canonical_runtime_verdict": "RUNTIME_DEFERRED / NOT_EXECUTED",
    "evidence_acquisition_mode": "STATIC_RENDER",
    "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI",
    "canonical_runtime_owner": ["A-14", "A Gate"],
}
EXPECTED_MATRIX = [
    {
        "verification_id": "AV-UI-001",
        "level": "L4",
        "method": "AE",
        "evidence": "E-SHOT",
        "severity": "MAJOR",
    },
    {
        "verification_id": "AV-UI-002",
        "level": "L4",
        "method": "MI",
        "evidence": "E-SHOT",
        "severity": "MINOR",
    },
]
EXPECTED_A01_PRESENTATION = {
    "viewport": "1920x1080",
    "body_font_px": 12,
    "small_font_px": 10,
    "aux_font_px": 9,
    "sidebar_title_px": 14,
    "title_px": 16,
    "explanation_interface": "i-tooltip-popover",
    "persistent_explanation_box_allowed": False,
    "progressive_disclosure": True,
    "fixed_independent_screen_count": False,
}
EXPECTED_A01_SHA256 = "FC3A503E5038C86BFD841DA5F93826A3FC85B5EB2A020E1196385247C2B7DD69"
EXPECTED_R1_RAW_PATHS = {
    "docs/architecture/a02/A-02_TOKEN_CATALOG.json",
    "docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md",
    "docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md",
    "docs/architecture/a02/A-02_STATIC_RENDER.svg",
    "scripts/check_a02_tokens.py",
    "tests/tooling/test_a02_tokens.py",
    "tests/fixtures/a02/canonical-contract.json",
    "tests/fixtures/a02/mutation-catalog.json",
    "docs/validation/A-02_TOKEN_VALIDATION.md",
    "docs/completion_reports/A-02_COMPLETION_REPORT.md",
    "docs/architecture/a01/A-01_PATH_CATALOG.json",
    "docs/work_orders/A-02_WORK_INSTRUCTION.md",
}
EXPECTED_R2_RAW_PATHS = EXPECTED_R1_RAW_PATHS | {
    "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json",
    "docs/test_reports/A-02_TEST_REPORT.md",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def _dedupe(errors: list[str]) -> list[str]:
    return list(dict.fromkeys(errors))


def _color_map(catalog: dict[str, Any]) -> tuple[dict[str, str], list[str]]:
    items = catalog.get("semantic_colors", [])
    if not isinstance(items, list):
        return {}, []
    roles = [str(item.get("role", "")) for item in items if isinstance(item, dict)]
    return {
        str(item.get("role", "")): str(item.get("value", "")).upper()
        for item in items
        if isinstance(item, dict)
    }, roles


def validate_catalog(catalog: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if catalog.get("viewport") != EXPECTED_VIEWPORT:
        errors.append("VIEWPORT_CONTRACT_MISMATCH")
    if catalog.get("typography") != EXPECTED_TYPOGRAPHY:
        errors.append("TYPOGRAPHY_CONTRACT_MISMATCH")
    if catalog.get("layout") != EXPECTED_LAYOUT:
        errors.append("LAYOUT_CONTRACT_MISMATCH")

    explanation = catalog.get("explanation_interface", {})
    if explanation.get("persistent_explanation_box_allowed") is not False:
        errors.append("PERSISTENT_EXPLANATION_BOX_FORBIDDEN")
    if explanation.get("keyboard_access_required") is not True or explanation.get("focus_path_required") is not True:
        errors.append("EXPLANATION_KEYBOARD_PATH_REQUIRED")
    if explanation != EXPECTED_EXPLANATION:
        errors.append("EXPLANATION_INTERFACE_MISMATCH")
    if catalog.get("status_presentation") != EXPECTED_STATUS:
        errors.append("STATUS_PRESENTATION_MISMATCH")

    colors, roles = _color_map(catalog)
    if len(roles) != len(set(roles)):
        errors.append("SEMANTIC_COLOR_ROLE_DUPLICATE")
    if set(roles) - set(EXPECTED_COLORS):
        errors.append("SEMANTIC_COLOR_ROLE_UNKNOWN")
    if set(roles) != set(EXPECTED_COLORS) or colors != EXPECTED_COLORS:
        errors.append("SEMANTIC_COLOR_ROLE_MISMATCH")
    if catalog.get("additional_raw_colors") not in (None, []):
        errors.append("RAW_COLOR_BYPASS")

    verification = catalog.get("verification_contract", {})
    if verification.get("assigned_verification_ids") != EXPECTED_VERIFICATION["assigned_verification_ids"]:
        errors.append("VERIFICATION_RESPONSIBILITY_MISMATCH")
    if verification.get("evidence_qualifier") != "E-SHOT_STATIC_NOT_RUNTIME_UI":
        errors.append("STATIC_QUALIFIER_MISMATCH")
    if verification != EXPECTED_VERIFICATION:
        errors.append("VERIFICATION_CONTRACT_MISMATCH")
    if catalog.get("matrix_contract") != EXPECTED_MATRIX:
        errors.append("MATRIX_CONTRACT_MISMATCH")
    if catalog.get("path_policy") != {
        "product_scope": [
            "docs/architecture/a02/**",
            "scripts/check_a02_tokens.py",
            "tests/tooling/test_a02_tokens.py",
            "tests/fixtures/a02/**",
            "docs/validation/A-02_*",
            "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST*.json",
            "docs/completion_reports/A-02_COMPLETION_REPORT.md",
        ],
        "runtime_product_paths_forbidden": ["apps/**", "packages/**"],
        "dependency_mutation_forbidden": True,
    }:
        errors.append("PATH_POLICY_MISMATCH")
    return _dedupe(errors)


def _relative_luminance(hex_color: str) -> float:
    channels = [int(hex_color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast_ratio(first: str, second: str) -> float:
    light, dark = sorted((_relative_luminance(first), _relative_luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def validate_contrast(catalog: dict[str, Any]) -> list[str]:
    colors, _ = _color_map(catalog)
    errors: list[str] = []
    for pair in catalog.get("contrast_pairs", []):
        foreground = colors.get(str(pair.get("foreground_role", "")))
        background = colors.get(str(pair.get("background_role", "")))
        minimum = pair.get("minimum_ratio")
        if foreground is None or background is None or not isinstance(minimum, (int, float)):
            errors.append("CONTRAST_PAIR_INVALID")
            continue
        ratio = _contrast_ratio(foreground, background)
        if ratio + 1e-9 < float(minimum):
            errors.append("TEXT_CONTRAST_BELOW_4_5" if float(minimum) >= 4.5 else "NON_TEXT_CONTRAST_BELOW_3_0")
    expected_pairs = {
        ("text-primary", "canvas", 4.5),
        ("text-primary", "surface", 4.5),
        ("text-muted", "surface", 4.5),
        ("interactive", "surface", 4.5),
        ("focus", "canvas", 3.0),
        ("border", "canvas", 3.0),
    }
    actual_pairs = {
        (str(pair.get("foreground_role")), str(pair.get("background_role")), float(pair.get("minimum_ratio", 0)))
        for pair in catalog.get("contrast_pairs", [])
    }
    if actual_pairs != expected_pairs:
        errors.append("CONTRAST_PAIR_SET_MISMATCH")
    return _dedupe(errors)


def validate_document_alignment(root: Path, catalog: dict[str, Any]) -> list[str]:
    try:
        texts = [(root / SPEC_REL).read_text(encoding="utf-8"), (root / EXPLANATION_REL).read_text(encoding="utf-8")]
    except OSError:
        return ["DOCUMENT_MISSING"]
    spec_text, explanation_text = texts
    combined = "\n".join(texts)
    required_literals = [
        "STATIC_ONLY", "E-SHOT_STATIC_NOT_RUNTIME_UI", "RUNTIME_DEFERRED / NOT_EXECUTED",
        "AV-UI-001", "AV-UI-002",
    ]
    errors: list[str] = []
    if any(literal not in combined for literal in required_literals):
        errors.append("DOCUMENT_TOKEN_ALIGNMENT_MISMATCH")

    def table_rows(text: str) -> dict[str, str]:
        rows: dict[str, str] = {}
        for line in text.splitlines():
            match = re.fullmatch(r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", line.strip())
            if match is None:
                continue
            key = match.group(1).strip().strip("`")
            value = match.group(2).strip().strip("`")
            if key not in {"token", "role", "field", "---"} and not key.startswith("---"):
                rows[key] = value
        return rows

    screen_rows = table_rows(spec_text)
    viewport = catalog.get("viewport", {})
    typography = catalog.get("typography", {})
    layout = catalog.get("layout", {})
    expected_screen_rows = {
        "viewport": f'{viewport.get("width_px")}×{viewport.get("height_px")}',
        "body/form": f'{typography.get("body_form_px")}px',
        "small description": f'{typography.get("small_description_px")}px',
        "auxiliary": f'{typography.get("auxiliary_px")}px',
        "sidebar title": f'{typography.get("sidebar_title_px")}px',
        "screen title": f'{typography.get("screen_title_px")}px',
        "sidebar expanded/collapsed": f'{layout.get("sidebar_expanded_px")}px / {layout.get("sidebar_collapsed_px")}px',
        "header": f'{layout.get("header_px")}px',
        "context drawer": f'{layout.get("context_drawer_px")}px, {layout.get("context_drawer_mode")}',
        "base padding": f'{layout.get("base_padding_px")}px',
        "card gap": f'{layout.get("card_gap_px")}px',
    }
    if any(screen_rows.get(key) != value for key, value in expected_screen_rows.items()):
        errors.append("DOCUMENT_SCREEN_TOKEN_BINDING_MISMATCH")

    explanation_rows = table_rows(explanation_text)
    explanation = catalog.get("explanation_interface", {})
    expected_explanation_rows = {
        "entry_point": str(explanation.get("entry_point")),
        "short_content_surface": str(explanation.get("short_content_surface")),
        "complex_content_surface": str(explanation.get("complex_content_surface")),
        "required_content": " + ".join(explanation.get("required_content", [])),
        "persistent_explanation_box_allowed": str(explanation.get("persistent_explanation_box_allowed")).lower(),
        "hover_only_allowed": str(explanation.get("hover_only_allowed")).lower(),
        "focus_path_required": str(explanation.get("focus_path_required")).lower(),
        "keyboard_access_required": str(explanation.get("keyboard_access_required")).lower(),
        "escape_closes": str(explanation.get("escape_closes")).lower(),
        "focus_returns_to_trigger": str(explanation.get("focus_returns_to_trigger")).lower(),
    }
    if any(explanation_rows.get(key) != value for key, value in expected_explanation_rows.items()):
        errors.append("DOCUMENT_EXPLANATION_BINDING_MISMATCH")

    colors, _ = _color_map(catalog)
    for role, value in colors.items():
        if screen_rows.get(role) != value:
            errors.append("DOCUMENT_COLOR_ALIGNMENT_MISMATCH")
    found_hex = {match.upper() for match in re.findall(r"#[0-9A-Fa-f]{6}\b", combined)}
    if found_hex - set(EXPECTED_COLORS.values()):
        errors.append("DOCUMENT_RAW_COLOR_BYPASS")
    return _dedupe(errors)


def validate_svg(root: Path, catalog: dict[str, Any]) -> list[str]:
    path = root / SVG_REL
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return ["STATIC_RENDER_MISSING"]
    errors: list[str] = []
    if not all(literal in text for literal in ('width="1920"', 'height="1080"', 'viewBox="0 0 1920 1080"')):
        errors.append("SVG_VIEWPORT_MISMATCH")
    required = [
        "E-SHOT_STATIC_NOT_RUNTIME_UI", "RUNTIME_DEFERRED / NOT_EXECUTED", "i-icon", "tooltip",
        "popover", "reason", "next_action", "focus", "keyboard", "icon + status_label + short_description",
    ]
    if any(literal not in text for literal in required):
        errors.append("SVG_CONTRACT_QUALIFIER_MISSING")
    typography = catalog.get("typography", {})
    layout = catalog.get("layout", {})
    structured_literals = [
        f'body/form {typography.get("body_form_px")}px',
        f'small {typography.get("small_description_px")}px',
        f'auxiliary {typography.get("auxiliary_px")}px',
        f'sidebar title {typography.get("sidebar_title_px")}px',
        f'screen title {typography.get("screen_title_px")}px',
        f'sidebar {layout.get("sidebar_expanded_px")}px / collapsed {layout.get("sidebar_collapsed_px")}px',
        f'header {layout.get("header_px")}px',
        f'context drawer {layout.get("context_drawer_px")}px',
        f'base padding {layout.get("base_padding_px")}px',
        f'card gap {layout.get("card_gap_px")}px',
    ]
    if any(literal not in text for literal in structured_literals):
        errors.append("SVG_TOKEN_BINDING_MISMATCH")
    colors, _ = _color_map(catalog)
    for role, value in colors.items():
        if role not in text or value not in text:
            errors.append("SVG_COLOR_ALIGNMENT_MISMATCH")
    found_hex = {match.upper() for match in re.findall(r"#[0-9A-Fa-f]{6}\b", text)}
    if found_hex - set(EXPECTED_COLORS.values()):
        errors.append("SVG_RAW_COLOR_BYPASS")
    return _dedupe(errors)


def validate_a01_catalog(catalog: dict[str, Any]) -> list[str]:
    return [] if catalog.get("presentation_contract") == EXPECTED_A01_PRESENTATION else ["A01_PRESENTATION_CONTRACT_DRIFT"]


def validate_a01_presentation(root: Path) -> list[str]:
    path = root / A01_CATALOG_REL
    try:
        catalog = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ["A01_PRESENTATION_CONTRACT_DRIFT"]
    errors = validate_a01_catalog(catalog)
    if sha256_file(path) != EXPECTED_A01_SHA256:
        errors.append("A01_ACCEPTED_CATALOG_HASH_DRIFT")
    return _dedupe(errors)


def _apply_mutation(catalog: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(catalog)
    path = str(mutation.get("path", "")).split(".")
    target: Any = result
    operation = mutation.get("operation", "replace")
    traversal = path if operation == "append" else path[:-1]
    for segment in traversal:
        target = target[int(segment)] if isinstance(target, list) else target[segment]
    final = path[-1]
    if operation == "remove":
        if isinstance(target, list):
            target.pop(int(final))
        else:
            target.pop(final, None)
    elif operation == "append":
        target.append(mutation.get("value"))
    else:
        if isinstance(target, list):
            target[int(final)] = mutation.get("value")
        else:
            target[final] = mutation.get("value")
    return result


def validate_mutation_fixture(catalog: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    for mutation in fixture.get("mutations", []):
        mutation_id = str(mutation.get("mutation_id", ""))
        expected = str(mutation.get("expected_error_code", ""))
        if not mutation_id or mutation_id in seen_ids or not expected:
            errors.append("MUTATION_FIXTURE_INVALID")
            continue
        seen_ids.add(mutation_id)
        try:
            mutated = _apply_mutation(catalog, mutation)
        except (KeyError, IndexError, TypeError, ValueError):
            errors.append("MUTATION_FIXTURE_INVALID")
            continue
        actual = validate_catalog(mutated) + validate_contrast(mutated)
        if expected not in actual:
            errors.append("MUTATION_EXPECTED_REASON_NOT_OBSERVED")
    return _dedupe(errors)


def _manifest_target(raw_artifacts: list[dict[str, Any]]) -> str:
    projection = [
        {"path": str(item.get("path", "")), "sha256": str(item.get("sha256", ""))}
        for item in sorted(raw_artifacts, key=lambda item: str(item.get("path", "")))
    ]
    canonical = json.dumps(projection, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest().upper()


def _manifest_canonical_bytes(raw_artifacts: list[dict[str, Any]]) -> int:
    projection = [
        {"path": str(item.get("path", "")), "sha256": str(item.get("sha256", ""))}
        for item in sorted(raw_artifacts, key=lambda item: str(item.get("path", "")))
    ]
    canonical = json.dumps(projection, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return len(canonical.encode("utf-8"))


def validate_evidence_manifest(root: Path, manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    raw_artifacts = manifest.get("raw_artifacts", [])
    if not raw_artifacts:
        return ["EVIDENCE_RAW_ARTIFACTS_EMPTY"]
    artifact_id = manifest.get("artifact_id")
    expected_paths = (
        EXPECTED_R2_RAW_PATHS
        if artifact_id == "EVIDENCE-MANIFEST-A-02-20260811-002"
        else EXPECTED_R1_RAW_PATHS
    )
    if manifest.get("self_reference") is not False:
        errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    seen: set[str] = set()
    for item in raw_artifacts:
        relative = str(item.get("path", ""))
        if not relative or relative in seen:
            errors.append("EVIDENCE_RAW_PATH_INVALID")
            continue
        seen.add(relative)
        path = root / relative
        if not path.is_file():
            errors.append("EVIDENCE_RAW_ARTIFACT_MISSING")
            continue
        if item.get("bytes") != path.stat().st_size:
            errors.append("EVIDENCE_RAW_BYTES_MISMATCH")
        if item.get("sha256") != sha256_file(path):
            errors.append("EVIDENCE_RAW_HASH_MISMATCH")
    if seen != expected_paths:
        errors.append("EVIDENCE_RAW_PATH_SET_MISMATCH")
    manifest_path = (
        "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json"
        if artifact_id == "EVIDENCE-MANIFEST-A-02-20260811-002"
        else "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json"
    )
    if manifest_path in seen:
        errors.append("EVIDENCE_SELF_REFERENCE_FORBIDDEN")
    canonical_bytes = _manifest_canonical_bytes(raw_artifacts)
    if manifest.get("target_canonical_bytes") != canonical_bytes:
        errors.append("EVIDENCE_CANONICAL_BYTES_MISMATCH")
    content_bytes = sum(
        item.get("bytes", 0) for item in raw_artifacts if isinstance(item.get("bytes"), int)
    )
    if manifest.get("target_content_bytes") != content_bytes:
        errors.append("EVIDENCE_CONTENT_BYTES_MISMATCH")
    expected_target = _manifest_target(raw_artifacts)
    if manifest.get("target_hash") != expected_target or manifest.get("delivered_hash") != expected_target:
        errors.append("EVIDENCE_TARGET_HASH_MISMATCH")
    if manifest.get("assigned_verification_ids") != ["AV-UI-001", "AV-UI-002"]:
        errors.append("EVIDENCE_RESPONSIBILITY_MISMATCH")
    if manifest.get("execution_classification") != "STATIC_ONLY":
        errors.append("EVIDENCE_EXECUTION_CLASSIFICATION_MISMATCH")
    if manifest.get("runtime_status") != "RUNTIME_DEFERRED / NOT_EXECUTED":
        errors.append("EVIDENCE_RUNTIME_STATUS_MISMATCH")
    if manifest.get("evidence_qualifier") != "E-SHOT_STATIC_NOT_RUNTIME_UI":
        errors.append("EVIDENCE_STATIC_QUALIFIER_MISSING")
    if artifact_id == "EVIDENCE-MANIFEST-A-02-20260811-002":
        if manifest.get("supersedes_artifact_ref") != {
            "path": "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json",
            "sha256": "FC2D3BD61BA7014CB74635D96AF68C3CCEE970E9FEAC52327A020570A52E5269",
        }:
            errors.append("EVIDENCE_PREDECESSOR_BINDING_MISMATCH")
        if manifest.get("source_test_report_ref") != {
            "path": "docs/test_reports/A-02_TEST_REPORT.md",
            "sha256": "1732C036F79FBE05DF9EBF1BB59B67E621DAE8CC40259D30585714C01F73FAF8",
        }:
            errors.append("EVIDENCE_TEST_REPORT_BINDING_MISMATCH")
    return _dedupe(errors)


def validate_bundle(root: Path) -> list[str]:
    try:
        catalog = json.loads((root / CATALOG_REL).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return ["CATALOG_MISSING"]
    except json.JSONDecodeError:
        return ["CATALOG_JSON_INVALID"]
    errors = validate_catalog(catalog)
    errors.extend(validate_contrast(catalog))
    errors.extend(validate_document_alignment(root, catalog))
    errors.extend(validate_svg(root, catalog))
    errors.extend(validate_a01_presentation(root))
    try:
        mutation_fixture = json.loads((root / "tests/fixtures/a02/mutation-catalog.json").read_text(encoding="utf-8"))
        errors.extend(validate_mutation_fixture(catalog, mutation_fixture))
    except (OSError, json.JSONDecodeError):
        errors.append("MUTATION_FIXTURE_MISSING_OR_INVALID")
    manifest_path = root / "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST_R2.json"
    if not manifest_path.is_file():
        manifest_path = root / "docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        errors.append("EVIDENCE_MANIFEST_MISSING_OR_INVALID")
    else:
        errors.extend(validate_evidence_manifest(root, manifest))
    return _dedupe(errors)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    errors = validate_bundle(args.root.resolve())
    result = {
        "package_id": "A-02",
        "verification_ids": ["AV-UI-001", "AV-UI-002"],
        "execution_classification": "STATIC_ONLY",
        "runtime_status": "RUNTIME_DEFERRED / NOT_EXECUTED",
        "evidence_qualifier": "E-SHOT_STATIC_NOT_RUNTIME_UI",
        "verdict": "PASS" if not errors else "FAIL",
        "errors": errors,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"A-02 token validation: {result['verdict']}")
        for error in errors:
            print(f"- {error}")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
