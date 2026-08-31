from pathlib import Path

from packages.repository_intelligence.indexes import build_indexes
from packages.repository_intelligence.inventory import canonical_sha256


def _fixture():
    root = Path(__file__).parent / "fixtures"
    inventory = [{"path": p.relative_to(root).as_posix(), "type": "file"} for p in root.rglob("*") if p.is_file()]
    return root, inventory


def test_python_typescript_symbols_dependencies_tests_and_impact():
    root, rows = _fixture()
    result = build_indexes(root, rows, impact="greet")
    assert {row["name"] for row in result["symbols"]} >= {"greet", "prefix", "render"}
    assert any(row["target"] == "util" for row in result["dependencies"])
    assert any(row["name"] == "test_greet" for row in result["tests"])
    assert "app.py" in result["impact"]["related_paths"]
    assert result["index_sha256"] == build_indexes(root, rows, impact="greet")["index_sha256"]


def test_unsupported_and_hostile_paths_are_reported_without_reading():
    root = Path(__file__).parent / "fixtures"
    result = build_indexes(root, [{"path": "../secret.py", "type": "file"}, {"path": "secret.txt", "type": "file"}])
    assert result["symbols"] == []
    assert result["dependencies"] == []
    assert result["warnings"][0]["message"] == "PATH_OUTSIDE_REPOSITORY"


def test_hash_is_canonical():
    assert canonical_sha256({"b": 2, "a": 1}) == canonical_sha256({"a": 1, "b": 2})
