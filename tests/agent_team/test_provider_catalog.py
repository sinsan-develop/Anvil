from unittest import TestCase

from packages.agent_team.provider_catalog import (
    PRIMARY_PROVIDER, PROVIDER_CREDENTIAL_KEYS, SUPPORTED_PROVIDERS,
    catalog_entries, ordered_candidates,
)


class ProviderCatalogTests(TestCase):
    def test_supported_order_and_upstage_primary(self):
        self.assertEqual(
            SUPPORTED_PROVIDERS,
            ("CEREBRAS", "GROQ", "MISTRAL", "OPENROUTER", "UPSTAGE",
             "GEMINI", "ANTHROPIC", "OPENAI", "OLLAMA"),
        )
        self.assertEqual(PRIMARY_PROVIDER, "UPSTAGE")
        self.assertEqual(tuple(row.provider_id for row in catalog_entries()), SUPPORTED_PROVIDERS)

    def test_primary_and_deterministic_fallback_order(self):
        eligible = ["OPENAI", "OLLAMA", "UPSTAGE", "GROQ"]
        self.assertEqual(ordered_candidates(eligible), ("UPSTAGE", "GROQ", "OPENAI", "OLLAMA"))
        self.assertEqual(ordered_candidates(["OPENAI", "GROQ"]), ("GROQ", "OPENAI"))

    def test_explicit_provider_overrides_primary(self):
        self.assertEqual(
            ordered_candidates(["UPSTAGE", "ANTHROPIC", "OPENAI"], explicit_provider="ANTHROPIC"),
            ("ANTHROPIC", "UPSTAGE", "OPENAI"),
        )
        with self.assertRaises(LookupError):
            ordered_candidates(["UPSTAGE", "OPENAI"], explicit_provider="GEMINI")

    def test_credential_contract_contains_names_only(self):
        self.assertEqual(set(PROVIDER_CREDENTIAL_KEYS), set(SUPPORTED_PROVIDERS))
        self.assertTrue(all(value.endswith(("_API_KEY", "_BASE_URL")) for value in PROVIDER_CREDENTIAL_KEYS.values()))
        self.assertTrue(all(row.configured is False for row in catalog_entries()))


if __name__ == "__main__":
    import unittest
    unittest.main()
