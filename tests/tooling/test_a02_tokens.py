"""Executable tests for the A-02 static screen-token contract."""

from __future__ import annotations

import copy
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts" / "check_a02_tokens.py"
CATALOG_PATH = ROOT / "docs" / "architecture" / "a02" / "A-02_TOKEN_CATALOG.json"
MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "A-02_EVIDENCE_MANIFEST.json"
MANIFEST_R2_PATH = ROOT / "docs" / "evidence" / "manifests" / "A-02_EVIDENCE_MANIFEST_R2.json"
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "a02" / "canonical-contract.json"
MUTATION_PATH = ROOT / "tests" / "fixtures" / "a02" / "mutation-catalog.json"
REQUIRED_DOCUMENTS = (
    "A-02_SCREEN_TOKEN_SPEC.md",
    "A-02_EXPLANATION_INTERFACE.md",
    "A-02_STATIC_RENDER.svg",
)


def _load_checker():
    if not CHECKER_PATH.is_file():
        raise AssertionError("A-02 token checker is not implemented")
    spec = importlib.util.spec_from_file_location("a02_token_checker", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise AssertionError("A-02 token checker cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def _latest_manifest_path() -> Path:
    return MANIFEST_R2_PATH if MANIFEST_R2_PATH.is_file() else MANIFEST_PATH


def _copy_bundle_root() -> tempfile.TemporaryDirectory:
    temporary = tempfile.TemporaryDirectory()
    target_root = Path(temporary.name)
    manifest_path = _latest_manifest_path()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    paths = {str(item["path"]) for item in manifest["raw_artifacts"]}
    paths.update(
        {
            "docs/architecture/a02/A-02_TOKEN_CATALOG.json",
            "docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md",
            "docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md",
            "docs/architecture/a02/A-02_STATIC_RENDER.svg",
            "tests/fixtures/a02/mutation-catalog.json",
            str(manifest_path.relative_to(ROOT)).replace("\\", "/"),
        }
    )
    for relative in paths:
        source = ROOT / relative
        destination = target_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    return temporary


class A02PresenceTests(unittest.TestCase):
    def test_checker_and_required_static_artifacts_exist(self) -> None:
        self.assertTrue(CHECKER_PATH.is_file(), "A-02 token checker is not implemented")
        self.assertTrue(CATALOG_PATH.is_file(), "A-02 token catalog is not implemented")
        for name in REQUIRED_DOCUMENTS:
            with self.subTest(document=name):
                self.assertTrue(
                    (ROOT / "docs" / "architecture" / "a02" / name).is_file(),
                    f"missing static token artifact: {name}",
                )


class A02TokenContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = _load_checker()
        cls.canonical = _catalog()

    def test_exact_screen_tokens_and_static_verification_contract_pass(self) -> None:
        self.assertEqual(self.checker.validate_bundle(ROOT), [])
        self.assertEqual(self.canonical["viewport"], {"width_px": 1920, "height_px": 1080})
        self.assertEqual(
            self.canonical["typography"],
            {
                "body_form_px": 12,
                "small_description_px": 10,
                "auxiliary_px": 9,
                "sidebar_title_px": 14,
                "screen_title_px": 16,
            },
        )
        self.assertEqual(
            self.canonical["layout"],
            {
                "sidebar_expanded_px": 224,
                "sidebar_collapsed_px": 56,
                "header_px": 48,
                "context_drawer_px": 360,
                "context_drawer_mode": "ON_DEMAND",
                "base_padding_px": 16,
                "card_gap_px": 12,
            },
        )

    def test_hostile_catalog_mutations_fail_with_stable_reason_codes(self) -> None:
        cases: list[tuple[dict, str]] = []

        viewport = copy.deepcopy(self.canonical)
        viewport["viewport"]["width_px"] = 1919
        cases.append((viewport, "VIEWPORT_CONTRACT_MISMATCH"))

        typography = copy.deepcopy(self.canonical)
        typography["typography"]["body_form_px"] = 14
        cases.append((typography, "TYPOGRAPHY_CONTRACT_MISMATCH"))

        layout = copy.deepcopy(self.canonical)
        layout["layout"]["base_padding_px"], layout["layout"]["card_gap_px"] = 12, 16
        cases.append((layout, "LAYOUT_CONTRACT_MISMATCH"))

        persistent = copy.deepcopy(self.canonical)
        persistent["explanation_interface"]["persistent_explanation_box_allowed"] = True
        cases.append((persistent, "PERSISTENT_EXPLANATION_BOX_FORBIDDEN"))

        missing_reason = copy.deepcopy(self.canonical)
        missing_reason["explanation_interface"]["required_content"].remove("reason")
        cases.append((missing_reason, "EXPLANATION_INTERFACE_MISMATCH"))

        hover_only = copy.deepcopy(self.canonical)
        hover_only["explanation_interface"]["keyboard_access_required"] = False
        cases.append((hover_only, "EXPLANATION_KEYBOARD_PATH_REQUIRED"))

        color_only = copy.deepcopy(self.canonical)
        color_only["status_presentation"]["color_only_allowed"] = True
        cases.append((color_only, "STATUS_PRESENTATION_MISMATCH"))

        missing_color = copy.deepcopy(self.canonical)
        missing_color["semantic_colors"].pop()
        cases.append((missing_color, "SEMANTIC_COLOR_ROLE_MISMATCH"))

        duplicate_color = copy.deepcopy(self.canonical)
        duplicate_color["semantic_colors"].append(copy.deepcopy(duplicate_color["semantic_colors"][0]))
        cases.append((duplicate_color, "SEMANTIC_COLOR_ROLE_DUPLICATE"))

        unknown_color = copy.deepcopy(self.canonical)
        unknown_color["semantic_colors"].append(
            {"role": "brand-secret", "value": "#FFFFFF", "usage": "forbidden"}
        )
        cases.append((unknown_color, "SEMANTIC_COLOR_ROLE_UNKNOWN"))

        raw_bypass = copy.deepcopy(self.canonical)
        raw_bypass["additional_raw_colors"] = ["#FFFFFF"]
        cases.append((raw_bypass, "RAW_COLOR_BYPASS"))

        qualifier = copy.deepcopy(self.canonical)
        qualifier["verification_contract"]["evidence_qualifier"] = "E-SHOT"
        cases.append((qualifier, "STATIC_QUALIFIER_MISMATCH"))

        responsibility = copy.deepcopy(self.canonical)
        responsibility["verification_contract"]["assigned_verification_ids"] = ["AV-UI-001"]
        cases.append((responsibility, "VERIFICATION_RESPONSIBILITY_MISMATCH"))

        severity = copy.deepcopy(self.canonical)
        severity["matrix_contract"][0]["severity"] = "MINOR"
        cases.append((severity, "MATRIX_CONTRACT_MISMATCH"))

        for mutated, expected in cases:
            with self.subTest(expected=expected):
                self.assertIn(expected, self.checker.validate_catalog(mutated))

    def test_semantic_palette_meets_declared_contrast_guards(self) -> None:
        self.assertEqual(self.checker.validate_contrast(self.canonical), [])
        mutated = copy.deepcopy(self.canonical)
        next(item for item in mutated["semantic_colors"] if item["role"] == "text-muted")[
            "value"
        ] = "#60738F"
        self.assertIn("TEXT_CONTRAST_BELOW_4_5", self.checker.validate_contrast(mutated))

    def test_documents_svg_and_catalog_are_fail_closed_bound(self) -> None:
        self.assertEqual(self.checker.validate_document_alignment(ROOT, self.canonical), [])
        self.assertEqual(self.checker.validate_svg(ROOT, self.canonical), [])

        svg = (ROOT / "docs/architecture/a02/A-02_STATIC_RENDER.svg").read_text(encoding="utf-8")
        self.assertIn('width="1920"', svg)
        self.assertIn('height="1080"', svg)
        self.assertIn('viewBox="0 0 1920 1080"', svg)
        self.assertIn("E-SHOT_STATIC_NOT_RUNTIME_UI", svg)
        self.assertIn("RUNTIME_DEFERRED / NOT_EXECUTED", svg)

    def test_a01_presentation_contract_remains_immutable(self) -> None:
        self.assertEqual(self.checker.validate_a01_presentation(ROOT), [])
        a01 = json.loads(
            (ROOT / "docs/architecture/a01/A-01_PATH_CATALOG.json").read_text(encoding="utf-8")
        )
        a01["presentation_contract"]["body_font_px"] = 13
        self.assertIn(
            "A01_PRESENTATION_CONTRACT_DRIFT",
            self.checker.validate_a01_catalog(a01),
        )

    def test_fixture_catalog_declares_every_executable_hostile_mutation(self) -> None:
        fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        mutations = json.loads(MUTATION_PATH.read_text(encoding="utf-8"))
        self.assertEqual(fixture["fixture_id"], "A02-TOKEN-CANONICAL")
        self.assertEqual(fixture["catalog_sha256"], self.checker.sha256_file(CATALOG_PATH))
        self.assertGreaterEqual(len(mutations["mutations"]), 20)
        self.assertEqual(self.checker.validate_mutation_fixture(self.canonical, mutations), [])
        self.assertEqual(
            {item["expected_error_code"] for item in mutations["manifest_mutations"]},
            {
                "EVIDENCE_SELF_REFERENCE_FORBIDDEN",
                "EVIDENCE_CANONICAL_BYTES_MISMATCH",
                "EVIDENCE_CONTENT_BYTES_MISMATCH",
                "EVIDENCE_RAW_PATH_SET_MISMATCH",
                "EVIDENCE_RAW_BYTES_MISMATCH",
                "EVIDENCE_RAW_HASH_MISMATCH",
                "EVIDENCE_TARGET_HASH_MISMATCH",
            },
        )
        self.assertEqual(
            {item["expected_error_code"] for item in mutations["document_mutations"]},
            {"DOCUMENT_SCREEN_TOKEN_BINDING_MISMATCH"},
        )

    def test_manifest_binds_raw_bytes_target_and_static_only_boundary(self) -> None:
        manifest = json.loads(_latest_manifest_path().read_text(encoding="utf-8"))
        self.assertEqual(self.checker.validate_evidence_manifest(ROOT, manifest), [])
        self.assertEqual(manifest["assigned_verification_ids"], ["AV-UI-001", "AV-UI-002"])
        self.assertEqual(manifest["execution_classification"], "STATIC_ONLY")
        self.assertEqual(manifest["runtime_status"], "RUNTIME_DEFERRED / NOT_EXECUTED")
        self.assertEqual(manifest["evidence_qualifier"], "E-SHOT_STATIC_NOT_RUNTIME_UI")

        mutated = copy.deepcopy(manifest)
        mutated["raw_artifacts"][0]["sha256"] = "0" * 64
        self.assertIn(
            "EVIDENCE_RAW_HASH_MISMATCH",
            self.checker.validate_evidence_manifest(ROOT, mutated),
        )

    def test_manifest_fail_closed_guards_are_enforced_by_bundle_cli(self) -> None:
        manifest_path = _latest_manifest_path()
        canonical = json.loads(manifest_path.read_text(encoding="utf-8"))

        cases: list[tuple[dict, str]] = []
        self_reference = copy.deepcopy(canonical)
        self_reference["self_reference"] = True
        cases.append((self_reference, "EVIDENCE_SELF_REFERENCE_FORBIDDEN"))

        canonical_bytes = copy.deepcopy(canonical)
        canonical_bytes["target_canonical_bytes"] = 0
        cases.append((canonical_bytes, "EVIDENCE_CANONICAL_BYTES_MISMATCH"))

        content_bytes = copy.deepcopy(canonical)
        content_bytes["target_content_bytes"] = 0
        cases.append((content_bytes, "EVIDENCE_CONTENT_BYTES_MISMATCH"))

        arbitrary_path = copy.deepcopy(canonical)
        arbitrary_path["raw_artifacts"].append(
            {
                "path": "AGENTS.md",
                "bytes": (ROOT / "AGENTS.md").stat().st_size,
                "sha256": self.checker.sha256_file(ROOT / "AGENTS.md"),
                "evidence_type": "E-ART",
            }
        )
        arbitrary_target = self.checker._manifest_target(arbitrary_path["raw_artifacts"])
        arbitrary_path["target_hash"] = arbitrary_target
        arbitrary_path["delivered_hash"] = arbitrary_target
        cases.append((arbitrary_path, "EVIDENCE_RAW_PATH_SET_MISMATCH"))

        wrong_bytes = copy.deepcopy(canonical)
        wrong_bytes["raw_artifacts"][0]["bytes"] += 1
        cases.append((wrong_bytes, "EVIDENCE_RAW_BYTES_MISMATCH"))

        for mutated, expected in cases:
            with self.subTest(expected=expected):
                self.assertIn(expected, self.checker.validate_evidence_manifest(ROOT, mutated))

        with _copy_bundle_root() as temporary:
            target_root = Path(temporary)
            relative_manifest = manifest_path.relative_to(ROOT)
            bundle_manifest_path = target_root / relative_manifest
            bundle_manifest = json.loads(bundle_manifest_path.read_text(encoding="utf-8"))
            bundle_manifest["self_reference"] = True
            bundle_manifest_path.write_text(
                json.dumps(bundle_manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            self.assertIn(
                "EVIDENCE_SELF_REFERENCE_FORBIDDEN",
                self.checker.validate_bundle(target_root),
            )

    def test_markdown_screen_token_binding_rejects_semantic_value_swaps(self) -> None:
        with _copy_bundle_root() as temporary:
            target_root = Path(temporary)
            spec_path = target_root / "docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md"
            original = spec_path.read_text(encoding="utf-8")
            mutated = original.replace("| body/form | 12px |", "| body/form | 16px |")
            mutated = mutated.replace(
                "| sidebar expanded/collapsed | 224px / 56px |",
                "| sidebar expanded/collapsed | 56px / 224px |",
            )
            spec_path.write_text(mutated, encoding="utf-8")
            self.assertIn(
                "DOCUMENT_SCREEN_TOKEN_BINDING_MISMATCH",
                self.checker.validate_document_alignment(target_root, self.canonical),
            )


if __name__ == "__main__":
    unittest.main()
