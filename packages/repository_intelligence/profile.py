"""Inert repository profile inference from already-hashed path metadata."""

from __future__ import annotations

from collections import Counter
from typing import Any, Iterable


_RULE_NAMES = {"AGENTS.md", "CLAUDE.md", "GEMINI.md", ".cursorrules"}
_SOURCE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".dart", ".java", ".rs"}
_LANGUAGE_BY_EXTENSION = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".go": "Go",
    ".dart": "Dart",
    ".java": "Java",
    ".rs": "Rust",
}


def _classify(path: str) -> str:
    lower = path.lower()
    suffix = "." + lower.rsplit(".", 1)[-1] if "." in lower.rsplit("/", 1)[-1] else ""
    if lower.startswith("tests/") or "/test" in lower or lower.rsplit("/", 1)[-1].startswith("test_"):
        return "test"
    if lower.startswith(".github/workflows/") or "dockerfile" in lower or "compose" in lower or "nginx" in lower:
        return "deploy"
    if suffix in _SOURCE_EXTENSIONS:
        return "source"
    if lower.rsplit("/", 1)[-1] in {
        "pyproject.toml", "package.json", "package-lock.json", "go.mod", "pubspec.yaml", "tsconfig.json"
    }:
        return "config"
    return "other"


def infer_profile(inventory: Iterable[dict[str, Any]]) -> dict[str, Any]:
    files = [str(entry["path"]) for entry in inventory if entry.get("type") == "file"]
    languages = set()
    package_managers = set()
    project_rules = []
    hook_paths = []
    secret_candidate_count = 0
    classifications: Counter[str] = Counter()
    for path in files:
        name = path.rsplit("/", 1)[-1]
        lower = path.lower()
        suffix = "." + name.lower().rsplit(".", 1)[-1] if "." in name else ""
        language = _LANGUAGE_BY_EXTENSION.get(suffix)
        if language:
            languages.add(language)
        if name == "package-lock.json":
            package_managers.add("npm")
        elif name == "yarn.lock":
            package_managers.add("yarn")
        elif name == "pnpm-lock.yaml":
            package_managers.add("pnpm")
        elif name == "go.mod":
            package_managers.add("go-modules")
        elif name == "pubspec.yaml":
            package_managers.add("pub")
        elif name.startswith("requirements") and name.endswith(".txt"):
            package_managers.add("pip-compatible")
        if name in _RULE_NAMES or lower.startswith(".codex/") or lower.startswith(".claude/"):
            project_rules.append(path)
        if lower.startswith(".git/hooks/"):
            hook_paths.append(path)
        if name.lower().startswith(".env") or name.lower() in {"credentials", "credentials.json", "secrets.yaml", "secrets.yml"}:
            secret_candidate_count += 1
        classifications[_classify(path)] += 1
    return {
        "languages": sorted(languages),
        "package_managers": sorted(package_managers),
        "runtime_probe_status": "NOT_EXECUTED_INFERRED_ONLY",
        "project_rule_paths": sorted(project_rules, key=lambda value: value.encode("utf-8")),
        "rules_execution_status": "NOT_EXECUTED_UNTRUSTED",
        "hook_paths": sorted(hook_paths, key=lambda value: value.encode("utf-8")),
        "hooks_execution_status": "NOT_EXECUTED_UNTRUSTED",
        "secret_candidates_masked": {
            "count": secret_candidate_count,
            "paths": ["<masked>"] * secret_candidate_count,
        },
        "file_classification": dict(sorted(classifications.items())),
        "protected_path_policy_status": "NOT_LOADED_UNTRUSTED",
    }
