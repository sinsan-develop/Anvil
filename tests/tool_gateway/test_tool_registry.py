import pytest

from packages.tool_gateway import ToolDefinition, ToolDefinitionRegistry, ToolGatewayRejected


def test_default_registry_contains_exact_c09_read_tools():
    registry = ToolDefinitionRegistry()
    assert set(registry.names) == {
        "repo.status", "repo.search", "repo.read_file", "repo.symbols", "git.diff"
    }
    assert all(definition.side_effect == "none" for definition in registry.definitions)
    assert registry.manifest_sha256 == "59d03fa90bea49350e931905af286fbcb0e3f49ea97aab4d42e8bfb7e9946195"


def test_duplicate_schema_drift_and_mutating_tool_fail_closed():
    registry = ToolDefinitionRegistry()
    with pytest.raises(ToolGatewayRejected):
        registry.register(ToolDefinition("repo.status", "anvil", "2", {}, {}, "read", "none", "low", ("git-worktree",)))
    with pytest.raises(ToolGatewayRejected):
        registry.register(ToolDefinition("exec.run", "anvil", "1", {}, {}, "execute", "write", "high", ("docker",)))


def test_canonical_definition_drift_and_exact_schema_are_rejected():
    registry=ToolDefinitionRegistry()
    canonical=registry.require("repo.status","git-worktree")
    drift=ToolDefinition("repo.status","untrusted","999",{}, {},"repository.read","none","low",("git-worktree",))
    with pytest.raises(ToolGatewayRejected): registry.validate_definition(drift)
    assert canonical.input_schema["additionalProperties"] is False
