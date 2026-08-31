"""Deterministic, read-only source indexes for Repository Intelligence.

The implementation deliberately uses only the standard library.  It is a
conservative index: syntax it cannot understand is represented as a warning,
never as a guessed dependency or symbol.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any, Iterable

from .inventory import canonical_sha256

_SOURCE = {".py", ".ts", ".tsx", ".js", ".jsx"}
_IMPORT = re.compile(r"^\s*(?:import\s+(.+?)\s+from\s+|import\s+)([\w./@-]+)", re.M)
_REQUIRE = re.compile(r"\brequire\s*\(\s*[\"']([^\"']+)[\"']\s*\)")
_TS_SYMBOL = re.compile(r"^\s*(?:(?:export\s+)?(?:async\s+)?function|(?:export\s+)?class|(?:export\s+)?interface|(?:export\s+)?type|(?:export\s+)?const|(?:export\s+)?let|(?:export\s+)?var)\s+([A-Za-z_$][\w$]*)", re.M)
_PY_TEST = re.compile(r"^\s*def\s+(test_[A-Za-z0-9_]*)\s*\(", re.M)
_TS_TEST = re.compile(r"^\s*(?:it|test|describe)\s*\(\s*[\"'`]([^\"'`]+)", re.M)


def _path_sort(row: dict[str, Any]) -> tuple[bytes, int, bytes]:
    return (str(row.get("path", "")).encode(), int(row.get("line", 0)), str(row.get("name", "")).encode())


def _safe_source(repository: Path, relative: str) -> tuple[Path | None, str | None]:
    raw = repository / Path(relative)
    try:
        if raw.is_symlink() or raw.lstat().st_ino != raw.stat().st_ino:
            return None, "PATH_REPARSE_POINT_DENIED"
    except FileNotFoundError:
        pass
    except OSError:
        return None, "PATH_UNREADABLE"
    candidate = raw.resolve(strict=False)
    root = repository.resolve(strict=True)
    try:
        if candidate.is_symlink() or candidate != root and root not in candidate.parents:
            return None, "PATH_OUTSIDE_REPOSITORY"
        if not candidate.is_file():
            return None, "PATH_NOT_REGULAR_FILE"
        return candidate, None
    except OSError:
        return None, "PATH_UNREADABLE"


def _python_rows(text: str, path: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    symbols: list[dict[str, Any]] = []
    dependencies: list[dict[str, Any]] = []
    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError as exc:
        return [], [{"path": path, "kind": "parse_warning", "message": "Python syntax could not be parsed", "line": exc.lineno or 0}]
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            symbols.append({"name": node.name, "kind": "class" if isinstance(node, ast.ClassDef) else "function", "path": path, "line": node.lineno})
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [a.name for a in node.names]
            module = node.module if isinstance(node, ast.ImportFrom) else names[0]
            dependencies.append({"path": path, "target": module, "kind": "import", "unresolved": False, "line": node.lineno})
    return symbols, dependencies


def build_indexes(repository: Path, inventory: Iterable[dict[str, Any]], impact: str | None = None) -> dict[str, Any]:
    """Build source/test/dependency/impact projections without writing files."""
    symbols: list[dict[str, Any]] = []
    references: list[dict[str, Any]] = []
    dependencies: list[dict[str, Any]] = []
    tests: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    files = sorted((str(row["path"]) for row in inventory if row.get("type") == "file" and Path(str(row["path"])).suffix.lower() in _SOURCE), key=lambda x: x.encode())
    known_stems = {Path(path).with_suffix("").as_posix() for path in files}
    for path in files:
        full, error = _safe_source(repository, path)
        if error:
            warnings.append({"path": path, "kind": "path_warning", "message": error})
            continue
        assert full is not None
        try:
            text = full.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            warnings.append({"path": path, "kind": "read_warning", "message": "source could not be decoded"})
            continue
        if full.suffix.lower() == ".py":
            rows, deps = _python_rows(text, path)
            symbols.extend(rows); dependencies.extend(deps)
            for match in _PY_TEST.finditer(text):
                tests.append({"name": match.group(1), "kind": "test", "path": path, "line": text.count("\n", 0, match.start()) + 1, "targets": []})
        else:
            for match in _TS_SYMBOL.finditer(text):
                symbols.append({"name": match.group(1), "kind": "symbol", "path": path, "line": text.count("\n", 0, match.start()) + 1})
            for match in _IMPORT.finditer(text):
                target = match.group(2)
                resolved = target in known_stems or any((Path(path).parent / target).as_posix() == stem for stem in known_stems)
                dependencies.append({"path": path, "target": target, "kind": "import", "unresolved": not resolved, "line": text.count("\n", 0, match.start()) + 1})
            for match in _REQUIRE.finditer(text):
                target = match.group(1)
                dependencies.append({"path": path, "target": target, "kind": "require", "unresolved": target not in known_stems, "line": text.count("\n", 0, match.start()) + 1})
            for match in _TS_TEST.finditer(text):
                tests.append({"name": match.group(1), "kind": "test", "path": path, "line": text.count("\n", 0, match.start()) + 1, "targets": []})
        if path.startswith("tests/") or ".test." in path or ".spec." in path:
            for row in tests:
                if row["path"] == path and not row["targets"]:
                    row["targets"] = sorted((p for p in files if p != path and Path(p).stem in Path(path).stem), key=lambda x: x.encode())
    # Resolve Python imports after the complete file set is known.
    for row in dependencies:
        if row["kind"] == "import" and row["target"] in known_stems:
            row["unresolved"] = False
    defined = {row["name"] for row in symbols}
    for path in files:
        full, error = _safe_source(repository, path)
        if not full or error:
            continue
        try: text = full.read_text(encoding="utf-8")
        except (OSError, UnicodeError): continue
        for name in sorted(defined):
            for match in re.finditer(r"\b" + re.escape(name) + r"\b", text):
                line = text.count("\n", 0, match.start()) + 1
                if not any(row["path"] == path and row["name"] == name and row["line"] == line and row["kind"] in {"function", "class", "symbol"} for row in symbols):
                    references.append({"name": name, "kind": "reference", "path": path, "line": line})
    symbols.sort(key=_path_sort); references.sort(key=_path_sort); dependencies.sort(key=_path_sort); tests.sort(key=_path_sort); warnings.sort(key=lambda x: (x["path"].encode(), x["kind"].encode()))
    related = set()
    if impact:
        related.update(row["path"] for row in symbols + references if row.get("name") == impact)
        related.update(row["path"] for row in dependencies if row.get("target") == impact)
        impacted_paths = set(related)
        for row in dependencies:
            if row.get("target") in impacted_paths or Path(str(row.get("target", ""))).stem in {Path(p).stem for p in impacted_paths}:
                related.add(row["path"])
        for row in tests:
            if set(row.get("targets", [])) & related or any(Path(p).stem in Path(row["path"]).stem for p in related):
                related.add(row["path"])
    related = sorted(related, key=lambda x: x.encode())
    risks = [{"code": "UNRESOLVED_DEPENDENCY", "path": row["path"], "target": row["target"], "severity": "medium"} for row in dependencies if row.get("unresolved")]
    result = {"symbols": symbols, "references": references, "dependencies": dependencies, "tests": tests, "impact": {"query": impact, "related_paths": related, "risk_evidence": sorted(risks, key=lambda x: (x["path"].encode(), x["target"].encode()))}, "warnings": warnings}
    result["index_sha256"] = canonical_sha256(result)
    return result
