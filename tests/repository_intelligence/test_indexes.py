import json
from pathlib import Path

from packages.repository_intelligence.indexes import build_indexes
from packages.repository_intelligence.inventory import canonical_sha256
from packages.repository_intelligence.models import ScanLimits, ScanRequest, ScanResult


def _fixture():
    root = Path(__file__).parent / "fixtures"
    inventory = [{"path": p.relative_to(root).as_posix(), "type": "file"} for p in root.rglob("*") if p.is_file()]
    return root, inventory


def test_python_typescript_symbols_dependencies_tests_and_impact():
    root, rows = _fixture()
    result = build_indexes(root, rows, impact="greet")
    assert {row["name"] for row in result["symbols"]} >= {"greet", "prefix", "render"}
    assert any(row["kind"] == "reference" and row["name"] == "greet" for row in result["references"])
    assert any(row["target"] == "util" for row in result["dependencies"])
    assert any(row["name"] == "test_behavior" for row in result["tests"])
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


def test_unresolved_python_and_relative_require_are_explicit():
    root = Path(__file__).parent / "fixtures"
    rows = [{"path": "app.py", "type": "file"}, {"path": "ui.ts", "type": "file"}]
    result = build_indexes(root, rows)
    assert any(row["target"] == "util" and row["unresolved"] for row in result["dependencies"])
    assert any(row["target"] == "./app" and row["kind"] == "require" and not row["unresolved"] for row in result["dependencies"])


def test_python_relative_and_multiple_imports_are_individual_deterministic_dependencies():
    root, rows = _fixture()

    result = build_indexes(root, reversed(rows))
    app_dependencies = [
        (row["line"], row["target"], row["unresolved"], row.get("resolved_path"))
        for row in result["dependencies"]
        if row["path"] == "app.py"
    ]

    assert app_dependencies == [
        (1, "json", False, None),
        (1, "util", False, "util.py"),
        (2, ".util", False, "util.py"),
    ]


def test_path_impact_includes_direct_file_importers_and_import_linked_test():
    root, rows = _fixture()

    result = build_indexes(root, rows, impact="util.py")

    assert result["impact"]["direct_files"] == ["util.py"]
    assert result["impact"]["importers"] == ["app.py", "tests/spec_app.py"]
    assert result["impact"]["related_tests"] == ["tests/spec_app.py"]
    assert result["impact"]["related_paths"] == ["app.py", "tests/spec_app.py", "util.py"]
    test_row = next(row for row in result["tests"] if row["name"] == "test_behavior")
    assert test_row["targets"] == ["app.py", "util.py"]
    assert test_row["target_evidence"] == [
        {"line": 1, "path": "app.py", "reason": "IMPORT_DEPENDENCY"},
        {"line": 2, "path": "util.py", "reason": "IMPORT_DEPENDENCY"},
    ]


def test_typescript_side_effect_import_is_indexed():
    root, rows = _fixture()

    result = build_indexes(root, rows)

    assert any(
        row["path"] == "ui.ts"
        and row["line"] == 2
        and row["target"] == "./app"
        and row["kind"] == "import"
        and row["resolved_path"] == "app.py"
        for row in result["dependencies"]
    )


def test_python_comments_and_strings_do_not_create_symbol_references():
    root, rows = _fixture()

    result = build_indexes(root, rows)

    assert not any(
        row["path"] == "app.py" and row["line"] in {8, 9} and row["name"] in {"greet", "prefix"}
        for row in result["references"]
    )


def test_unsupported_language_syntax_decode_and_hostile_paths_warn_fail_closed(tmp_path):
    (tmp_path / "worker.go").write_text("package worker\n", encoding="utf-8")
    (tmp_path / "broken.py").write_text("def broken(:\n", encoding="utf-8")
    (tmp_path / "encoded.py").write_bytes(b"\xff\xfe\x00")
    rows = [
        {"path": "worker.go", "type": "file"},
        {"path": "broken.py", "type": "file"},
        {"path": "encoded.py", "type": "file"},
        {"path": "../outside.py", "type": "file"},
    ]

    result = build_indexes(tmp_path, rows)

    assert result["symbols"] == []
    assert result["references"] == []
    assert result["dependencies"] == []
    assert [
        (row["path"], row["kind"], row["code"])
        for row in result["warnings"]
    ] == [
        ("../outside.py", "path_warning", "PATH_OUTSIDE_REPOSITORY"),
        ("broken.py", "parse_warning", "PYTHON_SYNTAX_UNSUPPORTED"),
        ("encoded.py", "read_warning", "SOURCE_DECODE_FAILED"),
        ("worker.go", "language_warning", "UNSUPPORTED_LANGUAGE"),
    ]


def test_inventory_order_and_repeated_scan_produce_identical_projection_and_hash():
    root, rows = _fixture()

    forward = build_indexes(root, rows, impact="util.py")
    reverse = build_indexes(root, list(reversed(rows)), impact="util.py")
    repeated = build_indexes(root, rows, impact="util.py")

    assert forward == reverse == repeated
    assert forward["index_sha256"] == canonical_sha256(
        {key: value for key, value in forward.items() if key != "index_sha256"}
    )


def test_scan_result_public_contract_remains_json_safe_with_no_write_proof():
    indexes = {
        "symbols": [{"name": "greet", "kind": "function", "path": "app.py", "line": 4}],
        "references": [],
        "dependencies": [],
        "tests": [],
        "impact": {"query": None, "related_paths": [], "risk_evidence": []},
        "index_warnings": [],
    }
    result = ScanResult(
        success=True,
        status="SCANNED_READ_ONLY",
        no_write_proof={
            "algorithm": "IDENTICAL_PRE_POST_V1",
            "pre_snapshot_sha256": "A" * 64,
            "post_snapshot_sha256": "A" * 64,
            "identical": True,
            "deltas": [],
        },
        **indexes,
    )

    serialized = json.dumps(result.to_dict(), sort_keys=True, allow_nan=False)

    assert json.loads(serialized)["no_write_proof"]["identical"] is True
    assert set(ScanResult.schema_fields()) <= set(result.to_dict())


def test_scan_request_preserves_positional_contract_and_adds_optional_impact_query():
    positional = ScanRequest("repo", "root", None, None, ScanLimits(), "1.0.0")
    with_impact = ScanRequest("repo", "root", impact_query="src/app.py")

    assert positional.schema_version == "1.0.0"
    assert positional.impact_query is None
    assert with_impact.impact_query == "src/app.py"
