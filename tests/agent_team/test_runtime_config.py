from packages.agent_team.runtime_config import credential_reference, runtime_catalog


def test_runtime_catalog_only_reports_presence_and_keeps_keys() -> None:
    rows = runtime_catalog({"UPSTAGE_API_KEY": "secret-value", "OLLAMA_BASE_URL": "http://ollama:11434"})
    upstage = next(row for row in rows if row.provider_id == "UPSTAGE")
    ollama = next(row for row in rows if row.provider_id == "OLLAMA")
    assert upstage.configured is True
    assert ollama.configured is True
    assert "secret-value" not in repr(rows)
    assert credential_reference("UPSTAGE") == "UPSTAGE_API_KEY"
