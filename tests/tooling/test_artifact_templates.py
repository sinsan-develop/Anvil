"""Executable contract tests for the G-04 artifact templates."""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHECKER_PATH = ROOT / "scripts" / "check_artifact_templates.py"
CATALOG_PATH = ROOT / "docs" / "templates" / "artifact-catalog.json"
SCHEMA_PATH = ROOT / "docs" / "templates" / "artifact-schema.json"
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "g04" / "work-instruction.json"
EXPECTED_PROJECTION_PATH = (
    ROOT / "tests" / "fixtures" / "g04" / "expected-semantic-projection.json"
)


def _load_checker():
    if not CHECKER_PATH.is_file():
        raise AssertionError(f"missing checker: {CHECKER_PATH.relative_to(ROOT)}")
    spec = importlib.util.spec_from_file_location("g04_artifact_checker", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise AssertionError("checker module could not be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class ArtifactTemplateContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.checker = _load_checker()
        self.catalog = _load_json(CATALOG_PATH)
        self.templates = {
            entry["artifact_type"]: _load_json(ROOT / entry["artifact_path"])
            for entry in self.catalog["templates"]
        }

    def test_catalog_registers_exactly_eight_canonical_templates(self) -> None:
        expected_types = {
            "work_instruction",
            "invocation_prompt",
            "completion_report",
            "test_report",
            "product_validation",
            "defect_assessment",
            "release_decision",
            "evidence_manifest",
        }

        self.assertEqual(self.catalog["schema_version"], "1.0.0")
        self.assertEqual(set(self.templates), expected_types)
        self.assertEqual(len(self.catalog["templates"]), 8)
        self.assertEqual(_load_json(SCHEMA_PATH)["$schema"], "https://json-schema.org/draft/2020-12/schema")

    def test_all_templates_satisfy_schema_and_guard_contracts(self) -> None:
        self.assertEqual(self.checker.validate_template_set(ROOT), [])

    def test_work_instruction_has_all_fourteen_verification_fields(self) -> None:
        required_fields = {
            "matrix_revision",
            "assigned_verification_ids",
            "required_levels",
            "required_evidence",
            "tester_entry_conditions",
            "package_exit_conditions",
            "regression_suite",
            "fixture_ids",
            "environment",
            "immediate_stop_conditions",
            "evidence_manifest_required",
            "product_validation_criteria",
            "blocking_defect_policy",
            "release_decision_required",
        }

        self.assertEqual(
            set(self.templates["work_instruction"]["verification_contract"]),
            required_fields,
        )

    def test_invocation_prompt_references_instruction_without_copying_contract(self) -> None:
        invocation = self.templates["invocation_prompt"]

        self.assertIn("work_instruction_ref", invocation)
        self.assertIn("artifact_id", invocation["work_instruction_ref"])
        self.assertIn("content_hash", invocation["work_instruction_ref"])
        self.assertNotIn("goal", invocation)
        self.assertNotIn("included_scope", invocation)
        self.assertNotIn("completion_conditions", invocation)
        self.assertNotIn("forbidden_actions", invocation)

        copied = copy.deepcopy(invocation)
        copied["goal"] = "copied goal"
        errors = self.checker.validate_artifact(copied, template_mode=True)
        self.assertTrue(any("invocation_prompt_body_duplication" in error for error in errors))

        missing_hash = copy.deepcopy(invocation)
        del missing_hash["work_instruction_ref"]["content_hash"]
        errors = self.checker.validate_artifact(missing_hash, template_mode=True)
        self.assertTrue(any("content_hash" in error for error in errors))

    def test_negative_mutations_are_rejected(self) -> None:
        mutations: list[tuple[str, dict, str]] = []

        instruction = copy.deepcopy(self.templates["work_instruction"])
        del instruction["verification_contract"]["matrix_revision"]
        mutations.append(("verification field", instruction, "matrix_revision"))

        report = copy.deepcopy(self.templates["completion_report"])
        del report["target_hash"]
        mutations.append(("target binding", report, "target_hash"))

        test_report = copy.deepcopy(self.templates["test_report"])
        del test_report["evidence_manifest_hash"]
        mutations.append(("manifest binding", test_report, "evidence_manifest_hash"))

        critical = copy.deepcopy(self.templates["defect_assessment"])
        critical["severity"] = "CRITICAL"
        critical["blocking"] = False
        mutations.append(("critical blocking", critical, "critical_defect_must_block"))

        mixed_status = copy.deepcopy(self.templates["work_instruction"])
        mixed_status["artifact_status"] = "ACTIVE"
        mutations.append(("status enum separation", mixed_status, "artifact_status"))

        for name, artifact, expected_error in mutations:
            with self.subTest(name=name):
                errors = self.checker.validate_artifact(artifact, template_mode=True)
                self.assertTrue(
                    any(expected_error in error for error in errors),
                    f"{expected_error!r} not found in {errors}",
                )

    def test_release_guards_require_human_and_complete_validation(self) -> None:
        decision = copy.deepcopy(self.templates["release_decision"])
        decision.update(
            {
                "decision": "RELEASE",
                "decided_by_human": {"actor_type": "agent", "actor_id": "main-agent"},
                "blocking_defect_count": 0,
                "blocking_defect_refs": [],
                "required_product_validations_complete": True,
            }
        )
        self.assertTrue(
            any(
                "release_requires_authenticated_human" in error
                for error in self.checker.validate_artifact(decision)
            )
        )

        decision["decided_by_human"]["actor_type"] = "human"
        decision["blocking_defect_count"] = 1
        decision["blocking_defect_refs"] = ["DEF-001"]
        self.assertTrue(
            any(
                "release_blocked_by_defect" in error
                for error in self.checker.validate_artifact(decision)
            )
        )

        decision["blocking_defect_count"] = 0
        decision["blocking_defect_refs"] = []
        decision["required_product_validations_complete"] = False
        self.assertTrue(
            any(
                "release_requires_product_validation" in error
                for error in self.checker.validate_artifact(decision)
            )
        )

    def test_defer_requires_risk_reconsideration_and_carryover(self) -> None:
        decision = copy.deepcopy(self.templates["release_decision"])
        decision.update(
            {
                "decision": "DEFER",
                "decided_by_human": {"actor_type": "human", "actor_id": "owner"},
                "defer_risk": None,
                "reconsider_at": None,
                "carryover_item_ref": None,
            }
        )

        errors = self.checker.validate_artifact(decision)

        self.assertTrue(any("defer_risk" in error for error in errors))
        self.assertTrue(any("reconsider_at" in error for error in errors))
        self.assertTrue(any("carryover_item_ref" in error for error in errors))

    def test_evidence_reuse_requires_identical_binding(self) -> None:
        manifest = copy.deepcopy(self.templates["evidence_manifest"])
        manifest.update(
            {
                "target_hash": "sha256:" + "1" * 64,
                "delivered_hash": "sha256:" + "1" * 64,
                "environment": "ENV-LOCAL",
                "git_head": "a" * 40,
                "image_digest": "sha256:" + "2" * 64,
                "db_migration_set_hash": "sha256:" + "3" * 64,
                "provider_routing_hash": "sha256:" + "4" * 64,
            }
        )
        expected = {
            key: manifest[key]
            for key in (
                "target_hash",
                "environment",
                "git_head",
                "image_digest",
                "db_migration_set_hash",
                "provider_routing_hash",
            )
        }

        self.assertEqual(self.checker.validate_evidence_reuse(manifest, expected), [])
        for key in expected:
            with self.subTest(binding=key):
                mismatched = dict(expected)
                mismatched[key] = "mismatch"
                errors = self.checker.validate_evidence_reuse(manifest, mismatched)
                self.assertTrue(any(key in error for error in errors))

    def test_canonical_json_is_sorted_compact_lf_utf8_without_bom(self) -> None:
        value = {"한글": "값", "b": [2, 1], "a": {"z": True}}

        encoded = self.checker.canonical_json_bytes(value)

        self.assertEqual(encoded, '{"a":{"z":true},"b":[2,1],"한글":"값"}'.encode("utf-8"))
        self.assertFalse(encoded.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", encoded)
        self.assertNotIn(b"\n", encoded)
        self.assertEqual(self.checker.canonical_sha256(value), self.checker.canonical_sha256(copy.deepcopy(value)))

    def test_reconstruction_fixture_has_zero_semantic_diff(self) -> None:
        instruction = _load_json(FIXTURE_PATH)
        expected = _load_json(EXPECTED_PROJECTION_PATH)

        actual = self.checker.semantic_projection(instruction)

        self.assertEqual(actual, expected)
        self.assertEqual(
            self.checker.canonical_json_bytes(actual),
            self.checker.canonical_json_bytes(expected),
        )
        self.assertEqual(
            self.checker.canonical_sha256(actual),
            self.checker.canonical_sha256(expected),
        )

    def test_reconstruction_contract_is_self_describing_and_drives_projection(self) -> None:
        instruction = _load_json(FIXTURE_PATH)

        self.assertIn("reconstruction_contract", instruction)
        contract = instruction["reconstruction_contract"]
        self.assertEqual(contract["contract_version"], "1.0.0")
        self.assertEqual(contract["output_shape"], "flat_json_object")
        self.assertIn("content_hash", contract["projection_fields"])
        self.assertEqual(contract["hash_algorithm"], "SHA-256")

        altered = copy.deepcopy(instruction)
        altered["reconstruction_contract"]["projection_fields"] = ["goal", "artifact_id"]
        self.assertEqual(
            list(self.checker.semantic_projection(altered)),
            ["goal", "artifact_id"],
        )

    def test_target_algorithm_uses_sorted_raw_checksums_as_its_only_input(self) -> None:
        self.assertTrue(hasattr(self.checker, "canonical_target_bytes"))
        self.assertTrue(hasattr(self.checker, "canonical_target_sha256"))
        raw_checksums = [
            {"path": "z/file.json", "bytes": 2, "sha256": "B" * 64},
            {"path": "a/file.json", "bytes": 1, "sha256": "A" * 64},
        ]
        expected = (
            "a/file.json\t1\t" + "A" * 64 + "\n"
            "z/file.json\t2\t" + "B" * 64
        ).encode("utf-8")

        self.assertEqual(self.checker.canonical_target_bytes(raw_checksums), expected)
        self.assertEqual(
            self.checker.canonical_target_sha256(raw_checksums),
            "sha256:" + __import__("hashlib").sha256(expected).hexdigest().upper(),
        )

    def test_manifest_target_is_recomputed_from_raw_checksums(self) -> None:
        self.assertTrue(hasattr(self.checker, "validate_manifest_target"))
        manifest = _load_json(ROOT / "docs" / "evidence" / "manifests" / "G-04_EVIDENCE_MANIFEST.json")

        self.assertEqual(self.checker.validate_manifest_target(manifest), [])

        mutated = copy.deepcopy(manifest)
        mutated["raw_checksums"][0]["bytes"] += 10_000
        errors = self.checker.validate_manifest_target(mutated)
        self.assertTrue(any("target_canonical_bytes" in error for error in errors))
        self.assertTrue(any("target_hash" in error for error in errors))

    def test_cli_reports_clean_template_set(self) -> None:
        result = subprocess.run(
            [sys.executable, str(CHECKER_PATH), str(ROOT)],
            capture_output=True,
            check=False,
            cwd=ROOT,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("8 templates validated", result.stdout)


if __name__ == "__main__":
    unittest.main()
