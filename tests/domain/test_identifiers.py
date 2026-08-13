import unittest

from packages.domain.identifiers import AggregateId, EventId, IdentifierError, RunId


class IdentifierTests(unittest.TestCase):
    def test_typed_identifiers_preserve_kind_and_value(self):
        self.assertEqual("run_01", str(RunId("run_01")))
        self.assertNotEqual(RunId("same"), EventId("same"))
        self.assertIsInstance(RunId("run_01"), AggregateId)

    def test_empty_or_whitespace_identifier_is_rejected(self):
        for value in ("", " ", "\t\n"):
            with self.subTest(value=repr(value)), self.assertRaises(IdentifierError):
                RunId(value)

    def test_identifier_rejects_non_string(self):
        with self.assertRaises(IdentifierError):
            RunId(None)  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main()
