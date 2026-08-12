"""Inert project/tool manifest discovery based only on inventory paths."""

from __future__ import annotations

import fnmatch
from typing import Any, Iterable


_RULES = (
    ("pyproject.toml", "python-project"),
    ("requirements*.txt", "python-requirements"),
    ("pytest.ini", "python-test-config"),
    ("mypy.ini", "python-typecheck-config"),
    ("package.json", "node-package"),
    ("package-lock.json", "node-lock"),
    ("npm-shrinkwrap.json", "node-lock"),
    ("yarn.lock", "node-lock"),
    ("pnpm-lock.yaml", "node-lock"),
    ("tsconfig*.json", "typescript-config"),
    ("go.mod", "go-module"),
    ("go.sum", "go-lock"),
    ("pubspec.yaml", "flutter-package"),
    ("analysis_options.yaml", "flutter-analysis"),
    ("Dockerfile*", "container-build"),
    ("compose*.yml", "container-compose"),
    ("compose*.yaml", "container-compose"),
    ("docker-compose*.yml", "container-compose"),
    ("docker-compose*.yaml", "container-compose"),
    ("nginx*.conf", "reverse-proxy"),
    ("alembic.ini", "database-migration"),
    ("schema.prisma", "database-schema"),
)


def detect_manifests(inventory: Iterable[dict[str, Any]]) -> list[dict[str, str]]:
    detections: list[dict[str, str]] = []
    for entry in inventory:
        if entry.get("type") != "file":
            continue
        path = str(entry["path"])
        name = path.rsplit("/", 1)[-1]
        kind = None
        if path.startswith(".github/workflows/") and (name.endswith(".yml") or name.endswith(".yaml")):
            kind = "ci-workflow"
        else:
            for pattern, candidate in _RULES:
                if fnmatch.fnmatchcase(name, pattern):
                    kind = candidate
                    break
        if kind is not None:
            detections.append(
                {"path": path, "kind": kind, "inspection": "FILENAME_ONLY_INERT"}
            )
    return sorted(detections, key=lambda item: item["path"].encode("utf-8"))
