import inspect
import unittest

from packages.persistence.config import ConfigurationError, DatabaseSettings
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

if __name__ == "__main__": unittest.main()
