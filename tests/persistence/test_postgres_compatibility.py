import unittest
from packages.persistence.compatibility import CompatibilityError, evaluate_server

class CompatibilityTests(unittest.TestCase):
    def test_only_pg15_and_pg18_are_accepted_separately(self):
        self.assertEqual(15, evaluate_server(150012, {"plpgsql"}).major)
        self.assertEqual(18, evaluate_server(180001, {"plpgsql"}).major)
        with self.assertRaises(CompatibilityError): evaluate_server(160000, {"plpgsql"})
    def test_missing_extension_fails_closed(self):
        with self.assertRaises(CompatibilityError): evaluate_server(150000, set())

if __name__ == "__main__": unittest.main()
