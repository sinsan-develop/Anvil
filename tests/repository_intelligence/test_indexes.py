import json
import os
from pathlib import Path

import pytest

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
    assert result["impact"]["importers"] == ["app.py", "tests/spec_app.py", "ui.ts"]
    assert result["impact"]["related_tests"] == ["tests/spec_app.py"]
    assert result["impact"]["related_paths"] == ["app.py", "tests/spec_app.py", "ui.ts", "util.py"]
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


def test_impact_walks_reverse_dependencies_to_fixed_point_with_hop_evidence(tmp_path):
    files = {
        "leaf.py": "def leaf():\n    return 'leaf'\n",
        "middle.py": "from leaf import leaf\ndef middle():\n    return leaf()\n",
        "top.py": "from middle import middle\ndef top():\n    return middle()\n",
        "tests/check_behavior.py": "from top import top\ndef test_behavior():\n    assert top()\n",
    }
    for relative, content in files.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    inventory = [{"path": path, "type": "file"} for path in files]

    result = build_indexes(tmp_path, inventory, impact="leaf.py")

    assert result["impact"]["importers"] == [
        "middle.py",
        "tests/check_behavior.py",
        "top.py",
    ]
    assert result["impact"]["dependency_hops"] == [
        {
            "from_path": "middle.py",
            "hop": 1,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "leaf.py",
        },
        {
            "from_path": "top.py",
            "hop": 2,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "middle.py",
        },
        {
            "from_path": "tests/check_behavior.py",
            "hop": 3,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "top.py",
        },
    ]
    assert result["impact"]["related_tests"] == ["tests/check_behavior.py"]
    assert result["impact"]["test_selection"] == [
        {
            "minimum_hop": 3,
            "path": "tests/check_behavior.py",
            "reasons": ["TRANSITIVE_IMPORT_DEPENDENCY"],
        }
    ]


def test_from_import_aliases_resolve_actual_absolute_relative_and_dotted_submodules(tmp_path):
    files = {
        "pkg/__init__.py": "",
        "pkg/mod.py": "def mod_value():\n    return 1\n",
        "pkg/other.py": "def other_value():\n    return 2\n",
        "pkg/nested/__init__.py": "",
        "pkg/nested/alpha.py": "ALPHA = 1\n",
        "pkg/nested/beta.py": "BETA = 2\n",
        "pkg/consumer.py": (
            "from pkg import mod, other\n"
            "from . import mod as relative_mod, other as relative_other\n"
            "from pkg.nested import alpha, beta\n"
        ),
    }
    for relative, content in files.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    inventory = [{"path": path, "type": "file"} for path in reversed(tuple(files))]

    result = build_indexes(tmp_path, inventory, impact="pkg/nested/alpha.py")
    observed = [
        (row["line"], row["target"], row["resolved_path"])
        for row in result["dependencies"]
        if row["path"] == "pkg/consumer.py"
    ]

    assert observed == [
        (1, "pkg.mod", "pkg/mod.py"),
        (1, "pkg.other", "pkg/other.py"),
        (2, ".mod", "pkg/mod.py"),
        (2, ".other", "pkg/other.py"),
        (3, "pkg.nested.alpha", "pkg/nested/alpha.py"),
        (3, "pkg.nested.beta", "pkg/nested/beta.py"),
    ]
    assert result["impact"]["importers"] == ["pkg/consumer.py"]


def test_typescript_references_are_two_pass_order_independent_and_ignore_non_code(tmp_path):
    files = {
        "a_consumer.ts": (
            "export function useWidget() { return Widget(); }\n"
            "const text = 'Widget'; // Widget\n"
            "/* Widget */\n"
        ),
        "z_definition.ts": "export function Widget() { return 1; }\n",
    }
    for relative, content in files.items():
        (tmp_path / relative).write_text(content, encoding="utf-8")
    forward_inventory = [{"path": path, "type": "file"} for path in files]
    reverse_inventory = list(reversed(forward_inventory))

    forward = build_indexes(tmp_path, forward_inventory, impact="Widget")
    reverse = build_indexes(tmp_path, reverse_inventory, impact="Widget")
    widget_refs = [row for row in forward["references"] if row["name"] == "Widget"]

    assert forward == reverse
    assert widget_refs == [
        {"kind": "reference", "line": 1, "name": "Widget", "path": "a_consumer.ts"}
    ]
    assert forward["impact"]["direct_files"] == ["z_definition.ts"]
    assert forward["impact"]["callers"] == ["a_consumer.ts"]


def test_paths_must_be_canonical_relative_and_nested_symlink_components_fail_closed(tmp_path):
    (tmp_path / "app.py").write_text("def app():\n    return 1\n", encoding="utf-8")
    target = tmp_path / "target"
    target.mkdir()
    (target / "linked.py").write_text("def linked():\n    return 1\n", encoding="utf-8")
    nested = tmp_path / "nested"
    nested.mkdir()
    link = nested / "link"
    try:
        os.symlink(target, link, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f"symlink creation unavailable: {exc}")
    inventory = [
        {"path": "app.py", "type": "file"},
        {"path": str((tmp_path / "app.py").resolve()), "type": "file"},
        {"path": "./app.py", "type": "file"},
        {"path": "nested/../app.py", "type": "file"},
        {"path": "nested/link/linked.py", "type": "file"},
    ]

    result = build_indexes(tmp_path, inventory)

    assert [row["path"] for row in result["symbols"]] == ["app.py"]
    assert [(row["path"], row["code"]) for row in result["warnings"]] == [
        ("./app.py", "PATH_NOT_CANONICAL_RELATIVE"),
        (str((tmp_path / "app.py").resolve()).replace("\\", "/"), "PATH_NOT_CANONICAL_RELATIVE"),
        ("nested/../app.py", "PATH_OUTSIDE_REPOSITORY"),
        ("nested/link/linked.py", "PATH_REPARSE_POINT_DENIED"),
    ]


def test_symbol_callers_seed_reverse_dependency_chain_and_test_selection(tmp_path):
    files = {
        "leaf.py": "def leaf():\n    return 'leaf'\n",
        "caller.py": "def call_leaf():\n    return leaf()\n",
        "wrapper.py": "from caller import call_leaf\ndef wrap():\n    return call_leaf()\n",
        "tests/test_leaf_flow.py": "from wrapper import wrap\ndef test_flow():\n    assert wrap()\n",
    }
    for relative, content in files.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    inventory = [{"path": path, "type": "file"} for path in files]

    result = build_indexes(tmp_path, inventory, impact="leaf")

    assert result["impact"]["direct_files"] == ["leaf.py"]
    assert result["impact"]["callers"] == ["caller.py"]
    assert result["impact"]["importers"] == ["tests/test_leaf_flow.py", "wrapper.py"]
    assert result["impact"]["dependency_hops"] == [
        {
            "from_path": "wrapper.py",
            "hop": 1,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "caller.py",
        },
        {
            "from_path": "tests/test_leaf_flow.py",
            "hop": 2,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "wrapper.py",
        },
    ]
    assert result["impact"]["test_selection"] == [
        {
            "minimum_hop": 2,
            "path": "tests/test_leaf_flow.py",
            "reasons": ["TRANSITIVE_IMPORT_DEPENDENCY"],
        }
    ]


def test_typescript_dependency_and_test_regex_accept_only_code_spans(tmp_path):
    files = {
        "app.ts": "export function real() { return 1; }\n",
        "consumer.test.ts": (
            "/*\n"
            "import './comment-ghost';\n"
            "const commentLoaded = require('./comment-phantom');\n"
            "test('comment fake', () => {});\n"
            "*/\n"
            "const decoy = `\n"
            "import './string-ghost';\n"
            "require('./string-phantom');\n"
            "test('string fake', () => {});\n"
            "`;\n"
            "import './app';\n"
            "const loaded = require('./app');\n"
            "test('real behavior', () => real());\n"
        ),
    }
    for relative, content in files.items():
        (tmp_path / relative).write_text(content, encoding="utf-8")
    inventory = [{"path": path, "type": "file"} for path in files]

    result = build_indexes(tmp_path, inventory, impact="app.ts")

    assert [
        (row["kind"], row["target"], row["unresolved"], row["resolved_path"])
        for row in result["dependencies"]
        if row["path"] == "consumer.test.ts"
    ] == [
        ("import", "./app", False, "app.ts"),
        ("require", "./app", False, "app.ts"),
    ]
    assert [row["name"] for row in result["tests"]] == ["real behavior"]
    assert not any(
        row["code"] == "UNRESOLVED_DEPENDENCY"
        and row["path"] == "consumer.test.ts"
        for row in result["impact"]["risk_evidence"]
    )


def test_dependency_cycle_records_only_each_importers_minimum_hop_edge(tmp_path):
    files = {
        "leaf.py": "def leaf():\n    return 1\n",
        "a.py": "import b\nfrom leaf import leaf\ndef a():\n    return leaf()\n",
        "b.py": "import a\ndef b():\n    return a.a()\n",
        "tests/test_cycle.py": "import b\ndef test_cycle():\n    assert b.b()\n",
    }
    for relative, content in files.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    inventory = [{"path": path, "type": "file"} for path in files]

    result = build_indexes(tmp_path, inventory, impact="leaf.py")

    assert result["impact"]["importers"] == ["a.py", "b.py", "tests/test_cycle.py"]
    assert result["impact"]["dependency_hops"] == [
        {
            "from_path": "a.py",
            "hop": 1,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "leaf.py",
        },
        {
            "from_path": "b.py",
            "hop": 2,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "a.py",
        },
        {
            "from_path": "tests/test_cycle.py",
            "hop": 3,
            "reason": "IMPORT_DEPENDENCY",
            "to_path": "b.py",
        },
    ]
    assert result["impact"]["test_selection"] == [
        {
            "minimum_hop": 3,
            "path": "tests/test_cycle.py",
            "reasons": ["TRANSITIVE_IMPORT_DEPENDENCY"],
        }
    ]


def test_typescript_multiline_named_and_type_imports_are_deterministic_dependencies(tmp_path):
    files = {
        "app.ts": "export function real() { return 1; }\nexport type Alias = string;\n",
        "types.ts": "export interface Shape { value: string; }\n",
        "consumer.ts": (
            "import {\n"
            "  real,\n"
            "  type Alias,\n"
            "} from './app';\n"
            "import type {\n"
            "  Shape,\n"
            "} from './types';\n"
            "import defaultValue from './app';\n"
            "import { real as renamed } from './app';\n"
            "import './app';\n"
        ),
    }
    for relative, content in files.items():
        (tmp_path / relative).write_text(content, encoding="utf-8")
    forward_inventory = [{"path": path, "type": "file"} for path in files]
    reverse_inventory = list(reversed(forward_inventory))

    forward = build_indexes(tmp_path, forward_inventory, impact="app.ts")
    reverse = build_indexes(tmp_path, reverse_inventory, impact="app.ts")

    assert forward == reverse
    assert forward["index_sha256"] == reverse["index_sha256"]
    assert [
        (row["line"], row["target"], row["resolved_path"])
        for row in forward["dependencies"]
        if row["path"] == "consumer.ts"
    ] == [
        (1, "./app", "app.ts"),
        (5, "./types", "types.ts"),
        (8, "./app", "app.ts"),
        (9, "./app", "app.ts"),
        (10, "./app", "app.ts"),
    ]
