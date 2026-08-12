"""A-15 Artifact/section-49/API/UI trace contract tests (test-first)."""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "docs/architecture/a15/A-15_ARTIFACT_SCHEMA.json"
API = ROOT / "docs/architecture/a15/A-15_API_DRAFT.json"
MATRIX = ROOT / "docs/architecture/a15/A-15_FIELD_TRACE_MATRIX.json"
APPROVAL = ROOT / "docs/architecture/a15/A-15_USER_UX_APPROVAL_REQUEST.md"
CHECKER = ROOT / "scripts/check_a15_artifact_state_api_ui_trace.py"
MANIFEST = ROOT / "docs/evidence/manifests/A-15_EVIDENCE_MANIFEST.json"


def load_checker():
    spec = importlib.util.spec_from_file_location("check_a15_trace", CHECKER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class A15ArtifactStateApiUiTraceTests(unittest.TestCase):
    def test_required_artifacts_exist(self) -> None:
        for path in (SCHEMA, API, MATRIX, APPROVAL, CHECKER):
            self.assertTrue(path.is_file(), str(path))

    def test_schema_has_required_section49_aggregates_and_guards(self) -> None:
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        required = {
            "product_validations", "defects", "release_decisions",
            "apply_approvals", "deploy_approval_subjects", "design_intent_reviews",
            "worker_leases", "write_leases", "budget_reservations",
            "data_egress_profiles", "secret_refs", "evidence_manifests",
            "release_manifests", "deployment_runs", "monitoring_policies",
        }
        self.assertTrue(required.issubset(schema["aggregates"]))
        self.assertEqual(
            ["DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"],
            schema["aggregates"]["design_intent_reviews"]["enums"]["status"],
        )
        self.assertEqual("authenticated_human", schema["human_decision_contract"]["required_actor_type"])
        self.assertTrue(schema["fail_closed_contract"]["source_required"])
        self.assertTrue(schema["fail_closed_contract"]["target_environment_binding_required"])

    def test_api_draft_has_section49_endpoints_and_mutation_envelope(self) -> None:
        api = json.loads(API.read_text(encoding="utf-8"))
        paths = {item["method"] + " " + item["path"] for item in api["endpoints"]}
        self.assertIn("POST /api/release-decisions", paths)
        self.assertIn("POST /api/design-intent-reviews/{id}:continue", paths)
        self.assertIn("POST /api/deployments/{id}:rollback", paths)
        self.assertIn("GET /api/evidence-manifests/{id}", paths)
        self.assertEqual(
            {"actor_id", "actor_role", "Idempotency-Key", "If-Match", "expected_state_version", "target_hash", "permission_scope", "reason", "audit_event"},
            set(api["common_mutation_envelope"]),
        )
        self.assertEqual("DRAFT_ONLY / NOT_IMPLEMENTED / NOT_EXECUTED", api["runtime_boundary"])

    def test_matrix_traces_every_required_domain_end_to_end(self) -> None:
        matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
        required_domains = set(matrix["required_domains"])
        self.assertEqual(required_domains, {row["domain"] for row in matrix["rows"]})
        required_fields = {
            "artifact_field", "source_kind", "canonical_source", "source_reference",
            "api_request_field", "api_response_field", "ui_surface", "ui_state",
            "permission", "evidence_or_av_id", "runtime_boundary",
        }
        for row in matrix["rows"]:
            self.assertTrue(required_fields.issubset(row))
            self.assertIn(row["source_kind"], {"canonical_aggregate", "projection"})
            self.assertTrue(row["canonical_source"])
            self.assertTrue(row["source_reference"].startswith("Anvil_설계서_v2.md#49."))
            self.assertNotIn("http://", row["api_request_field"])
            self.assertNotIn("https://", row["api_request_field"])

    def test_user_decision_and_dir_are_not_forged(self) -> None:
        text = APPROVAL.read_text(encoding="utf-8")
        self.assertIn("PENDING_USER_DECISION", text)
        self.assertIn("승인 | 보완 | 반려", text)
        self.assertIn("NOT ACTUAL PASS", text)
        self.assertIn("DIR-1: `NOT_REACHED`", text)
        self.assertNotIn("USER_UX_APPROVED", text)

    def test_checker_rejects_hostile_mutations(self) -> None:
        result = subprocess.run(
            [sys.executable, str(CHECKER), "--verify-fixtures"], cwd=ROOT,
            text=True, capture_output=True, check=False,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("hostile fixtures rejected", result.stdout)

    def test_checker_fails_closed_on_tamper(self) -> None:
        checker = load_checker()
        matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
        tampered = copy.deepcopy(matrix)
        tampered["rows"][0]["canonical_source"] = ""
        self.assertIn("TRACE_SOURCE_MISSING", checker.validate_matrix(tampered))
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        schema["human_decision_contract"]["decision_status"] = "APPROVED"
        self.assertIn("HUMAN_DECISION_FORGED", checker.validate_schema(schema))

    def test_complete_bundle_and_manifest_pass(self) -> None:
        result = subprocess.run(
            [sys.executable, str(CHECKER)], cwd=ROOT,
            text=True, capture_output=True, check=False,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("A-15 artifact/state/API/UI trace: PASS", result.stdout)
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertFalse(manifest["self_reference"])
        self.assertEqual("PENDING_USER_DECISION", manifest["user_ux_approval_status"])
        self.assertEqual("NOT_REACHED", manifest["actual_dir_status"])


if __name__ == "__main__":
    unittest.main()
