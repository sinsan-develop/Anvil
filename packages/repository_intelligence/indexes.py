"""Deterministic, read-only source indexes for Repository Intelligence.

Only syntax that can be understood conservatively with the Python standard
library is projected.  Unsupported or malformed input is surfaced as a
structured warning instead of being guessed.
"""
from __future__ import annotations

import ast
import posixpath
import re
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

from .inventory import canonical_sha256, is_reparse_point


_SOURCE = {".py", ".ts", ".tsx", ".js", ".jsx"}
_KNOWN_UNSUPPORTED_SOURCE = {
    ".c",
    ".cc",
    ".cpp",
    ".cs",
    ".go",
    ".java",
    ".kt",
    ".kts",
    ".php",
    ".rb",
    ".rs",
    ".swift",
}
_TS_IMPORT = re.compile(
    r"^\s*import\s+(?:(?:[^;\n]*?)\s+from\s+)?[\"']([^\"']+)[\"']\s*;?",
    re.M,
)
_REQUIRE = re.compile(r"\brequire\s*\(\s*[\"']([^\"']+)[\"']\s*\)")
_TS_SYMBOL = re.compile(
    r"^\s*(?:(?:export\s+)?(?:async\s+)?function|(?:export\s+)?class|"
    r"(?:export\s+)?interface|(?:export\s+)?type|(?:export\s+)?const|"
    r"(?:export\s+)?let|(?:export\s+)?var)\s+([A-Za-z_$][\w$]*)",
    re.M,
)
_TS_TEST = re.compile(r"^\s*(?:it|test|describe)\s*\(\s*[\"'`]([^\"'`]+)", re.M)
_PY_EXTERNAL = {
    "ast",
    "asyncio",
    "json",
    "os",
    "pathlib",
    "re",
    "sys",
    "typing",
    "unittest",
    "pytest",
}


def _encoded(value: object) -> bytes:
    return str(value).encode("utf-8", errors="surrogatepass")


def _row_sort(row: dict[str, Any]) -> tuple[bytes, int, bytes, bytes]:
    return (
        _encoded(row.get("path", "")),
        int(row.get("line", 0)),
        _encoded(row.get("target", "")),
        _encoded(row.get("name", "")),
    )


def _warning_sort(row: dict[str, Any]) -> tuple[bytes, bytes, bytes, int]:
    return (
        _encoded(row.get("path", "")),
        _encoded(row.get("kind", "")),
        _encoded(row.get("code", "")),
        int(row.get("line", 0)),
    )


def _canonical_inventory_path(raw_path: object) -> tuple[str, str | None]:
    value = str(raw_path).replace("\\", "/")
    segments = value.split("/")
    if ".." in segments:
        return value, "PATH_OUTSIDE_REPOSITORY"
    if (
        not value
        or value == "."
        or value.startswith("/")
        or re.match(r"^[A-Za-z]:", value)
        or any(segment in {"", "."} for segment in segments)
        or PurePosixPath(value).as_posix() != value
    ):
        return value, "PATH_NOT_CANONICAL_RELATIVE"
    return value, None


def _safe_source(repository: Path, relative: str) -> tuple[Path | None, str | None]:
    raw = repository
    for part in PurePosixPath(relative).parts:
        raw = raw / part
        try:
            path_stat = raw.lstat()
        except FileNotFoundError:
            break
        except OSError:
            return None, "PATH_UNREADABLE"
        if is_reparse_point(raw, path_stat):
            return None, "PATH_REPARSE_POINT_DENIED"
    candidate = raw.resolve(strict=False)
    root = repository.resolve(strict=True)
    try:
        if candidate.is_symlink() or (candidate != root and root not in candidate.parents):
            return None, "PATH_OUTSIDE_REPOSITORY"
        if not candidate.is_file():
            return None, "PATH_NOT_REGULAR_FILE"
        return candidate, None
    except OSError:
        return None, "PATH_UNREADABLE"


def _python_rows(
    text: str,
    path: str,
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    symbols: list[dict[str, Any]] = []
    reference_candidates: list[dict[str, Any]] = []
    dependencies: list[dict[str, Any]] = []
    tests: list[dict[str, Any]] = []
    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError as exc:
        warning = {
            "path": path,
            "kind": "parse_warning",
            "code": "PYTHON_SYNTAX_UNSUPPORTED",
            "message": "Python syntax could not be parsed",
            "line": exc.lineno or 0,
        }
        return [], [], [], [], [warning]

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            kind = "class" if isinstance(node, ast.ClassDef) else "function"
            symbols.append({"name": node.name, "kind": kind, "path": path, "line": node.lineno})
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_"):
                tests.append(
                    {
                        "name": node.name,
                        "kind": "test",
                        "path": path,
                        "line": node.lineno,
                        "targets": [],
                        "target_evidence": [],
                    }
                )
        elif isinstance(node, ast.Import):
            for alias in node.names:
                target = alias.name
                dependencies.append(
                    {
                        "path": path,
                        "target": target,
                        "kind": "import",
                        "unresolved": True,
                        "external": target.split(".", 1)[0] in _PY_EXTERNAL,
                        "line": node.lineno,
                    }
                )
        elif isinstance(node, ast.ImportFrom):
            prefix = "." * node.level
            base_target = prefix + node.module if node.module else None
            targets = (
                [(f"{base_target}.{alias.name}", base_target) for alias in node.names]
                if base_target
                else [(prefix + alias.name, None) for alias in node.names]
            )
            for target, fallback_target in targets:
                dependencies.append(
                    {
                        "path": path,
                        "target": target,
                        "fallback_target": fallback_target,
                        "kind": "import",
                        "unresolved": True,
                        "external": not prefix and (base_target or target).split(".", 1)[0] in _PY_EXTERNAL,
                        "line": node.lineno,
                    }
                )
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            reference_candidates.append(
                {"name": node.id, "kind": "reference", "path": path, "line": node.lineno}
            )
        elif isinstance(node, ast.Attribute) and isinstance(node.ctx, ast.Load):
            reference_candidates.append(
                {"name": node.attr, "kind": "reference", "path": path, "line": node.lineno}
            )
    return symbols, reference_candidates, dependencies, tests, []


def _normalized_module_base(source: str, target: str, *, python: bool) -> str | None:
    source_parent = PurePosixPath(source).parent.as_posix()
    raw = target.replace("\\", "/")
    if python:
        leading = len(raw) - len(raw.lstrip("."))
        module = raw[leading:].replace(".", "/")
        if leading:
            parent = source_parent
            for _ in range(max(0, leading - 1)):
                parent = posixpath.dirname(parent)
            raw = posixpath.join(parent, module)
        else:
            raw = module
    elif raw.startswith("."):
        raw = posixpath.join(source_parent, raw)
    normalized = posixpath.normpath(raw).replace("\\", "/")
    if normalized == ".." or normalized.startswith("../") or normalized.startswith("/"):
        return None
    return normalized.lstrip("./")


def _resolved_path(
    source: str,
    target: str,
    source_paths: set[str],
    *,
    python: bool,
) -> str | None:
    base = _normalized_module_base(source, target, python=python)
    if not base:
        return None
    suffixes = (".py",) if python else (".ts", ".tsx", ".js", ".jsx", ".py")
    candidates = [base]
    candidates.extend(base + suffix for suffix in suffixes)
    candidates.extend(base + "/__init__.py" for _ in (0,) if python)
    if not python:
        candidates.extend(base + "/index" + suffix for suffix in suffixes)
    for candidate in candidates:
        if candidate in source_paths:
            return candidate
    return None


def _is_test_path(path: str) -> bool:
    name = PurePosixPath(path).name
    return (
        path.startswith("tests/")
        or "/tests/" in f"/{path}"
        or name.startswith("test_")
        or ".test." in name
        or ".spec." in name
        or name.startswith("spec_")
    )


def _mask_ts_non_code(text: str) -> str:
    """Blank comments and string literals while preserving offsets/newlines."""

    masked = list(text)
    index = 0
    state = "code"
    quote = ""
    while index < len(text):
        current = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""
        if state == "code":
            if current in {"'", '"', "`"}:
                state = "string"
                quote = current
                masked[index] = " "
            elif current == "/" and following == "/":
                state = "line_comment"
                masked[index] = masked[index + 1] = " "
                index += 1
            elif current == "/" and following == "*":
                state = "block_comment"
                masked[index] = masked[index + 1] = " "
                index += 1
        elif state == "string":
            if current != "\n":
                masked[index] = " "
            if current == "\\" and following:
                if following != "\n":
                    masked[index + 1] = " "
                index += 1
            elif current == quote:
                state = "code"
        elif state == "line_comment":
            if current == "\n":
                state = "code"
            else:
                masked[index] = " "
        else:
            if current != "\n":
                masked[index] = " "
            if current == "*" and following == "/":
                masked[index + 1] = " "
                index += 1
                state = "code"
        index += 1
    return "".join(masked)


def _match_keyword_is_code(
    code_text: str,
    match: re.Match[str],
    keyword_pattern: str,
) -> bool:
    keyword = re.search(keyword_pattern, match.group(0))
    if keyword is None:
        return False
    start = match.start() + keyword.start()
    return code_text[start : start + len(keyword.group(0))] == keyword.group(0)


def build_indexes(
    repository: Path,
    inventory: Iterable[dict[str, Any]],
    impact: str | None = None,
) -> dict[str, Any]:
    """Build source/test/dependency/impact projections without writing files."""

    symbols: list[dict[str, Any]] = []
    reference_candidates: list[dict[str, Any]] = []
    dependencies: list[dict[str, Any]] = []
    tests: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    ts_sources: list[tuple[str, str]] = []
    ts_definition_spans: set[tuple[str, int, int, str]] = set()
    inventory_rows = [row for row in inventory if row.get("type") == "file"]
    raw_paths = sorted({str(row["path"]) for row in inventory_rows}, key=_encoded)
    paths: list[str] = []
    for raw_path in raw_paths:
        canonical, error = _canonical_inventory_path(raw_path)
        if error:
            warnings.append(
                {"path": canonical, "kind": "path_warning", "code": error, "message": error}
            )
        else:
            paths.append(canonical)
    files = [path for path in paths if PurePosixPath(path).suffix.lower() in _SOURCE]
    source_paths = set(files)

    for path in paths:
        suffix = PurePosixPath(path).suffix.lower()
        if suffix in _KNOWN_UNSUPPORTED_SOURCE:
            warnings.append(
                {
                    "path": path,
                    "kind": "language_warning",
                    "code": "UNSUPPORTED_LANGUAGE",
                    "message": "Source language is not supported",
                }
            )

    for path in files:
        full, error = _safe_source(repository, path)
        if error:
            warnings.append(
                {"path": path, "kind": "path_warning", "code": error, "message": error}
            )
            continue
        assert full is not None
        try:
            text = full.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            warnings.append(
                {
                    "path": path,
                    "kind": "read_warning",
                    "code": "SOURCE_DECODE_FAILED",
                    "message": "source could not be decoded",
                }
            )
            continue

        if full.suffix.lower() == ".py":
            py_symbols, py_refs, py_dependencies, py_tests, py_warnings = _python_rows(text, path)
            symbols.extend(py_symbols)
            reference_candidates.extend(py_refs)
            dependencies.extend(py_dependencies)
            tests.extend(py_tests)
            warnings.extend(py_warnings)
            continue

        ts_sources.append((path, text))
        code_text = _mask_ts_non_code(text)
        for match in _TS_SYMBOL.finditer(code_text):
            symbols.append(
                {
                    "name": match.group(1),
                    "kind": "symbol",
                    "path": path,
                    "line": text.count("\n", 0, match.start()) + 1,
                }
            )
            ts_definition_spans.add((path, match.start(1), match.end(1), match.group(1)))
        for match in _TS_IMPORT.finditer(text):
            if not _match_keyword_is_code(code_text, match, r"\bimport\b"):
                continue
            target = match.group(1)
            dependencies.append(
                {
                    "path": path,
                    "target": target,
                    "kind": "import",
                    "unresolved": True,
                    "external": False,
                    "line": text.count("\n", 0, match.start()) + 1,
                }
            )
        for match in _REQUIRE.finditer(text):
            if not _match_keyword_is_code(code_text, match, r"\brequire\b"):
                continue
            target = match.group(1)
            dependencies.append(
                {
                    "path": path,
                    "target": target,
                    "kind": "require",
                    "unresolved": True,
                    "external": not target.startswith("."),
                    "line": text.count("\n", 0, match.start()) + 1,
                }
            )
        for match in _TS_TEST.finditer(text):
            if not _match_keyword_is_code(code_text, match, r"\b(?:it|test|describe)\b"):
                continue
            tests.append(
                {
                    "name": match.group(1),
                    "kind": "test",
                    "path": path,
                    "line": text.count("\n", 0, match.start()) + 1,
                    "targets": [],
                    "target_evidence": [],
                }
            )

    defined_names = {str(row["name"]) for row in symbols}
    for path, text in ts_sources:
        code_text = _mask_ts_non_code(text)
        for name in sorted(defined_names, key=_encoded):
            pattern = re.compile(r"(?<![\w$])" + re.escape(name) + r"(?![\w$])")
            for match in pattern.finditer(code_text):
                if (path, match.start(), match.end(), name) in ts_definition_spans:
                    continue
                reference_candidates.append(
                    {
                        "name": name,
                        "kind": "reference",
                        "path": path,
                        "line": text.count("\n", 0, match.start()) + 1,
                    }
                )

    for row in dependencies:
        is_python = PurePosixPath(str(row["path"])).suffix.lower() == ".py"
        resolved = _resolved_path(
            str(row["path"]),
            str(row["target"]),
            source_paths,
            python=is_python,
        )
        fallback_target = row.pop("fallback_target", None)
        if resolved is None and fallback_target:
            fallback_resolved = _resolved_path(
                str(row["path"]),
                str(fallback_target),
                source_paths,
                python=is_python,
            )
            if fallback_resolved is not None or row.get("external"):
                row["target"] = fallback_target
                resolved = fallback_resolved
        if resolved is not None:
            row["resolved_path"] = resolved
            row["unresolved"] = False
        elif row.get("external"):
            row["resolved_path"] = None
            row["unresolved"] = False
        else:
            row["resolved_path"] = None

    dependencies = list(
        {
            (
                str(row["path"]),
                int(row["line"]),
                str(row["kind"]),
                str(row["target"]),
                row.get("resolved_path"),
            ): row
            for row in dependencies
        }.values()
    )

    defined = {str(row["name"]) for row in symbols}
    references = [row for row in reference_candidates if str(row["name"]) in defined]

    dependency_by_path: dict[str, list[dict[str, Any]]] = {}
    for row in dependencies:
        dependency_by_path.setdefault(str(row["path"]), []).append(row)
    for test in tests:
        evidence = {
            (
                str(row["resolved_path"]),
                int(row["line"]),
                "IMPORT_DEPENDENCY",
            )
            for row in dependency_by_path.get(str(test["path"]), [])
            if row.get("resolved_path") and row.get("resolved_path") != test["path"]
        }
        test["targets"] = sorted({path for path, _line, _reason in evidence}, key=_encoded)
        test["target_evidence"] = [
            {"line": line, "path": path, "reason": reason}
            for path, line, reason in sorted(evidence, key=lambda item: (_encoded(item[0]), item[1], _encoded(item[2])))
        ]

    symbols.sort(key=_row_sort)
    references = sorted(
        {
            (str(row["name"]), str(row["kind"]), str(row["path"]), int(row["line"]))
            for row in references
        },
        key=lambda item: (_encoded(item[2]), item[3], _encoded(item[0])),
    )
    references = [
        {"name": name, "kind": kind, "path": path, "line": line}
        for name, kind, path, line in references
    ]
    dependencies.sort(key=_row_sort)
    tests.sort(key=_row_sort)
    warnings.sort(key=_warning_sort)

    direct_files: set[str] = set()
    callers: set[str] = set()
    importers: set[str] = set()
    importer_hops: dict[str, int] = {}
    dependency_hops: set[tuple[int, str, str]] = set()
    related_tests: set[str] = set()
    query_kind = "none"
    normalized_impact = impact.replace("\\", "/") if impact else None
    if normalized_impact:
        if normalized_impact in source_paths:
            query_kind = "path"
            direct_files.add(normalized_impact)
        else:
            query_kind = "symbol"
            direct_files.update(
                str(row["path"])
                for row in symbols
                if str(row.get("name")) == normalized_impact
            )
            callers.update(
                str(row["path"])
                for row in references
                if str(row.get("name")) == normalized_impact
                and str(row["path"]) not in direct_files
            )
        seed_paths = direct_files | callers
        frontier = set(seed_paths)
        hop = 1
        while frontier:
            next_frontier: set[str] = set()
            for row in dependencies:
                resolved_path = row.get("resolved_path")
                importer = str(row["path"])
                if (
                    resolved_path not in frontier
                    or importer in seed_paths
                    or importer in importer_hops
                ):
                    continue
                dependency_hops.add((hop, importer, str(resolved_path)))
                importer_hops[importer] = hop
                importers.add(importer)
                next_frontier.add(importer)
            frontier = next_frontier
            hop += 1
        impacted_sources = direct_files | importers | callers
        related_tests.update(path for path in impacted_sources if _is_test_path(path))
        for test in tests:
            if set(test.get("targets", [])) & impacted_sources:
                related_tests.add(str(test["path"]))

    related_paths = sorted(direct_files | callers | importers | related_tests, key=_encoded)
    test_selection = []
    for path in sorted(related_tests, key=_encoded):
        reasons: list[str] = []
        if path in callers:
            reasons.append("IMPACT_REFERENCE")
        minimum_hop = importer_hops.get(path)
        if minimum_hop is not None:
            reasons.append(
                "DIRECT_IMPORT_DEPENDENCY"
                if minimum_hop == 1
                else "TRANSITIVE_IMPORT_DEPENDENCY"
            )
        selection: dict[str, Any] = {"path": path, "reasons": reasons}
        if minimum_hop is not None:
            selection["minimum_hop"] = minimum_hop
        test_selection.append(selection)
    risks = [
        {
            "code": "UNRESOLVED_DEPENDENCY",
            "path": row["path"],
            "target": row["target"],
            "severity": "medium",
        }
        for row in dependencies
        if row.get("unresolved")
    ]
    risks.extend(
        {
            "code": row["code"],
            "path": row["path"],
            "severity": "medium",
        }
        for row in warnings
    )
    risks.sort(key=lambda row: (_encoded(row["path"]), _encoded(row["code"]), _encoded(row.get("target", ""))))

    result = {
        "symbols": symbols,
        "references": references,
        "dependencies": dependencies,
        "tests": tests,
        "impact": {
            "query": impact,
            "query_kind": query_kind,
            "direct_files": sorted(direct_files, key=_encoded),
            "callers": sorted(callers, key=_encoded),
            "importers": sorted(importers, key=_encoded),
            "dependency_hops": [
                {
                    "from_path": from_path,
                    "hop": hop,
                    "reason": "IMPORT_DEPENDENCY",
                    "to_path": to_path,
                }
                for hop, from_path, to_path in sorted(
                    dependency_hops,
                    key=lambda item: (item[0], _encoded(item[1]), _encoded(item[2])),
                )
            ],
            "related_tests": sorted(related_tests, key=_encoded),
            "related_paths": related_paths,
            "test_selection": test_selection,
            "risk_evidence": risks,
        },
        "warnings": warnings,
    }
    result["index_sha256"] = canonical_sha256(result)
    return result
