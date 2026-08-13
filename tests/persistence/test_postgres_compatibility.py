import json
from pathlib import Path
import unittest
from packages.persistence.compatibility import CompatibilityError, evaluate_server

class CompatibilityTests(unittest.TestCase):
    def test_only_pg15_and_pg18_are_accepted_separately(self):
        self.assertEqual(15, evaluate_server(150012, {"plpgsql"}).major)
        self.assertEqual(18, evaluate_server(180001, {"plpgsql"}).major)
        with self.assertRaises(CompatibilityError): evaluate_server(160000, {"plpgsql"})
    def test_missing_extension_fails_closed(self):
        with self.assertRaises(CompatibilityError): evaluate_server(150000, set())

    def test_r2_evidence_uses_server_version_fields_not_port_semantics(self):
        path = Path(__file__).resolve().parents[2] / "docs/evidence/manifests/B-02_EVIDENCE_MANIFEST_R2.json"
        evidence = json.loads(path.read_text(encoding="utf-8"))
        runtime = evidence["postgresql_runtime_evidence"]
        self.assertEqual(150017, runtime["postgresql15_server_version_num"])
        self.assertEqual(180004, runtime["postgresql18_server_version_num"])
        self.assertNotIn("postgresql15_port", runtime)
        self.assertNotIn("postgresql18_port", runtime)

if __name__ == "__main__": unittest.main()
