"""Contract tests for the G-03 dependency-direction checker."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from scripts.check_dependency_boundaries import check_paths


class DependencyBoundaryTests(unittest.TestCase):
    def _write(self, root: Path, relative_path: str, content: str) -> Path:
        path = root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_allows_apps_to_import_packages_and_domain(self) -> None:
        """An apps module may depend on a package and the domain package."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            candidate = self._write(
                root,
                "apps/web/client.py",
                "import packages.policy\nfrom packages.domain import events\n",
            )

            self.assertEqual(check_paths(root, [candidate]), [])

    def test_rejects_python_source_outside_an_allowed_layer(self) -> None:
        """Only apps and packages source trees participate in this checker contract."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            candidate = self._write(root, "unsupported/module.py", "import packages.domain\n")

            violations = check_paths(root, [candidate])

            self.assertEqual(len(violations), 1)
            self.assertEqual(violations[0].path, "unsupported/module.py")
            self.assertEqual(violations[0].line, 0)
            self.assertEqual(violations[0].import_name, "<source-path>")

    def test_rejects_packages_importing_apps(self) -> None:
        """A package-to-apps import must report its source line and import name."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            candidate = self._write(
                root,
                "packages/policy/rules.py",
                "from apps.api import services\n",
            )

            violations = check_paths(root, [candidate])

            self.assertEqual(len(violations), 1)
            self.assertEqual(violations[0].path, "packages/policy/rules.py")
            self.assertEqual(violations[0].line, 1)
            self.assertEqual(violations[0].import_name, "apps.api")

    def test_rejects_domain_framework_and_outer_layer_imports(self) -> None:
        """Domain remains independent of apps, other packages, and forbidden SDKs."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            candidate = self._write(
                root,
                "packages/domain/model.py",
                "import fastapi\nimport pydantic\nimport sqlalchemy\nimport alembic\nimport psycopg\nimport openai\nimport docker\nimport packages.policy\nfrom apps.api import services\n",
            )

            violations = check_paths(root, [candidate])

            self.assertEqual(
                [(item.line, item.import_name) for item in violations],
                [
                    (1, "fastapi"),
                    (2, "pydantic"),
                    (3, "sqlalchemy"),
                    (4, "alembic"),
                    (5, "psycopg"),
                    (6, "openai"),
                    (7, "docker"),
                    (8, "packages.policy"),
                    (9, "apps.api"),
                ],
            )

    def test_rejects_all_canonical_provider_and_unknown_third_party_imports(self) -> None:
        """Domain default-denies every third-party root, including all provider samples."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            candidate = self._write(
                root,
                "packages/domain/provider_leaks.py",
                "import cerebras\nimport groq\nimport mistralai\nimport openrouter\nimport upstage\nimport google\nimport anthropic\nimport openai\nimport ollama\nimport unapproved_sdk\n",
            )

            violations = check_paths(root, [candidate])

            self.assertEqual(
                [item.import_name for item in violations],
                [
                    "cerebras",
                    "groq",
                    "mistralai",
                    "openrouter",
                    "upstage",
                    "google",
                    "anthropic",
                    "openai",
                    "ollama",
                    "unapproved_sdk",
                ],
            )

    def test_rejects_domain_relative_imports_that_escape_its_package(self) -> None:
        """Domain relative imports may not climb to another package layer."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            candidate = self._write(
                root,
                "packages/domain/model.py",
                "from ..policy import rules\nfrom .. import policy\n",
            )

            violations = check_paths(root, [candidate])

            self.assertEqual(
                [(item.line, item.import_name) for item in violations],
                [(1, "..policy"), (2, "..")],
            )

    def test_rejects_relative_imports_beyond_the_top_level_package(self) -> None:
        """Relative imports that climb past packages are always invalid, never slices."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            root_candidate = self._write(
                root,
                "packages/domain/model.py",
                "from ....domain import events\n",
            )
            nested_candidate = self._write(
                root,
                "packages/domain/sub/model.py",
                "from .....domain import events\n",
            )

            violations = check_paths(root, [root_candidate, nested_candidate])

            self.assertEqual(
                [(item.path, item.import_name) for item in violations],
                [
                    ("packages/domain/model.py", "....domain"),
                    ("packages/domain/sub/model.py", ".....domain"),
                ],
            )

    def test_allows_standard_library_and_domain_internal_imports(self) -> None:
        """The domain allowlist retains standard-library and resolved internal imports."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            candidate = self._write(
                root,
                "packages/domain/model.py",
                "import pathlib\nfrom packages.domain import events\nfrom . import local_events\nfrom ..domain import events\n",
            )
            nested_candidate = self._write(
                root,
                "packages/domain/sub/model.py",
                "from ...domain import events\n",
            )

            self.assertEqual(check_paths(root, [candidate, nested_candidate]), [])

    def test_cli_returns_nonzero_and_prints_every_violation(self) -> None:
        """The executable checker exposes all detected violations to its caller."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write(root, "packages/policy/bad.py", "import apps.web\n")
            self._write(root, "packages/domain/bad.py", "import pydantic\n")

            exit_code = __import__("subprocess").run(
                [sys.executable, "scripts/check_dependency_boundaries.py", str(root)],
                capture_output=True,
                check=False,
                cwd=Path(__file__).resolve().parents[2],
                text=True,
            )

            self.assertEqual(exit_code.returncode, 1)
            self.assertIn("packages/policy/bad.py:1: apps.web", exit_code.stdout)
            self.assertIn("packages/domain/bad.py:1: pydantic", exit_code.stdout)


if __name__ == "__main__":
    unittest.main()
