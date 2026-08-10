"""Check the G-03 apps → packages → domain dependency direction."""

from __future__ import annotations

import ast
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


STANDARD_LIBRARY_ROOTS = frozenset(getattr(sys, "stdlib_module_names", ())) | {"__future__"}


@dataclass(frozen=True)
class Violation:
    path: str
    line: int
    import_name: str
    reason: str


def check_paths(root: Path, paths: Iterable[Path]) -> list[Violation]:
    """Return all dependency-direction violations in the supplied Python files."""
    violations: list[Violation] = []
    for path in paths:
        relative_path = path.relative_to(root).as_posix()
        parts = Path(relative_path).parts
        if not _is_allowed_source(parts):
            violations.append(
                Violation(relative_path, 0, "<source-path>", "source must be under apps or packages")
            )
            continue

        tree = ast.parse(path.read_text(encoding="utf-8"), filename=relative_path)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    violations.extend(_check_import(parts, relative_path, node.lineno, alias.name))
            elif isinstance(node, ast.ImportFrom):
                violations.extend(_check_from_import(parts, relative_path, node))
    return sorted(violations, key=lambda item: (item.path, item.line, item.import_name))


def _is_allowed_source(parts: tuple[str, ...]) -> bool:
    return len(parts) >= 2 and parts[0] in {"apps", "packages"}


def _check_import(
    source_parts: tuple[str, ...], path: str, line: int, import_name: str
) -> list[Violation]:
    root_module = import_name.split(".", 1)[0]
    is_package = source_parts[0] == "packages"
    is_domain = is_package and source_parts[1] == "domain"

    if is_domain and not _is_allowed_domain_absolute_import(import_name, root_module):
        return [Violation(path, line, import_name, "domain must remain framework and outer-layer independent")]
    if is_package and (import_name == "apps" or import_name.startswith("apps.")):
        return [Violation(path, line, import_name, "packages must not import apps")]
    return []


def _check_from_import(
    source_parts: tuple[str, ...], path: str, node: ast.ImportFrom
) -> list[Violation]:
    if node.level == 0:
        return _check_import(source_parts, path, node.lineno, node.module or "")

    is_domain = source_parts[0] == "packages" and source_parts[1] == "domain"
    if is_domain and not _relative_target_stays_in_domain(source_parts, node.level, node.module):
        import_name = "." * node.level + (node.module or "")
        return [Violation(path, node.lineno, import_name, "domain relative import escapes packages.domain")]
    return []


def _is_allowed_domain_absolute_import(import_name: str, root_module: str) -> bool:
    if root_module in STANDARD_LIBRARY_ROOTS:
        return True
    return import_name == "packages.domain" or import_name.startswith("packages.domain.")


def _relative_target_stays_in_domain(
    source_parts: tuple[str, ...], level: int, module: str | None
) -> bool:
    package_parts = source_parts[:-1]
    ascents = level - 1
    if ascents >= len(package_parts):
        return False
    target_base = package_parts[: len(package_parts) - ascents]
    target_parts = target_base + tuple(module.split(".")) if module else target_base
    return len(target_parts) >= 2 and target_parts[:2] == ("packages", "domain")


def _python_sources(root: Path) -> list[Path]:
    sources: list[Path] = []
    for layer in (root / "apps", root / "packages"):
        if layer.is_dir():
            sources.extend(sorted(layer.rglob("*.py")))
    return sources


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    root = Path(arguments[0]).resolve() if arguments else Path.cwd()
    violations = check_paths(root, _python_sources(root))
    for violation in violations:
        print(f"{violation.path}:{violation.line}: {violation.import_name}: {violation.reason}")
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main())
