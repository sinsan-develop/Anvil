import inspect
import unittest

from packages.persistence.config import (
    ConfigurationError,
    DatabaseSettings,
    normalize_postgresql_dsn,
)
from packages.persistence.repositories import Repository


class RepositoryContractTests(unittest.TestCase):
    def test_repository_is_framework_independent_protocol(self):
        self.assertTrue(getattr(Repository, "_is_protocol", False))
        self.assertEqual({"get", "save"}, {n for n, v in inspect.getmembers(Repository, inspect.isfunction) if not n.startswith("_")})

    def test_settings_require_postgresql_env_dsn_without_secret_disclosure(self):
        with self.assertRaises(ConfigurationError): DatabaseSettings.from_environment({})
        with self.assertRaises(ConfigurationError): DatabaseSettings("sqlite:///x")
        settings = DatabaseSettings("postgresql+psycopg://user:secret@db/anvil")
        self.assertNotIn("secret", repr(settings))

    def test_unqualified_postgresql_dsn_uses_psycopg3_dialect(self):
        settings = DatabaseSettings("postgresql://user:secret@db/anvil")
        self.assertEqual("postgresql+psycopg://user:secret@db/anvil", settings.dsn)

    def test_psycopg2_postgresql_dsn_uses_psycopg3_dialect(self):
        settings = DatabaseSettings("postgresql+psycopg2://user:secret@db/anvil")
        self.assertEqual("postgresql+psycopg://user:secret@db/anvil", settings.dsn)

    def test_dsn_normalization_preserves_other_dialects(self):
        self.assertEqual(
            "postgresql+psycopg://user:secret@db/anvil",
            normalize_postgresql_dsn("postgresql+psycopg://user:secret@db/anvil"),
        )
        self.assertEqual("sqlite:///anvil.db", normalize_postgresql_dsn("sqlite:///anvil.db"))

if __name__ == "__main__": unittest.main()
