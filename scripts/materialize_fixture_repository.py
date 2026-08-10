"""Materialize immutable G-06 source templates as disposable Git repositories."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


FIXTURE_INDEX = Path("tests/fixtures/repositories/fixture-index.json")


class FixtureMaterializationError(RuntimeError):
    """Raised when a fixture cannot be reproduced honestly."""


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def fixture_manifest(root: Path, fixture_id: str) -> dict[str, Any]:
    index = _load_json(root / FIXTURE_INDEX)
    matches = [entry for entry in index["fixtures"] if entry["fixture_id"] == fixture_id]
    if len(matches) != 1:
        raise FixtureMaterializationError(f"fixture ID must resolve exactly once: {fixture_id}")
    return _load_json(root / matches[0]["manifest_path"])


def _run(command: list[str], cwd: Path, *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True, check=False)


def _require_success(result: subprocess.CompletedProcess[str], label: str) -> None:
    if result.returncode != 0:
        raise FixtureMaterializationError(
            f"{label} failed with exit {result.returncode}:\n{result.stdout}{result.stderr}"
        )


def _write_declared_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def materialize_fixture(
    root: Path,
    fixture_id: str,
    destination: Path,
    *,
    install_tools: bool = False,
) -> Path:
    """Create one disposable fixture repo; never mutate the source template."""
    root = root.resolve()
    destination = destination.resolve()
    manifest = fixture_manifest(root, fixture_id)
    source_root = root / manifest["source_root"]
    if destination.exists():
        raise FixtureMaterializationError(f"destination already exists: {destination}")
    shutil.copytree(source_root, destination)

    _require_success(_run(["git", "init", "-b", manifest["git"]["branch"]], destination), "git init")
    _require_success(_run(["git", "config", "user.name", "Anvil Fixture"], destination), "git config user.name")
    _require_success(_run(["git", "config", "user.email", "fixture@invalid.example"], destination), "git config user.email")
    _require_success(
        _run(["git", "config", "status.showUntrackedFiles", "all"], destination),
        "git config status.showUntrackedFiles",
    )
    _require_success(_run(["git", "add", "--all"], destination), "git add")
    commit_env = dict(os.environ)
    commit_env.update(
        {
            "GIT_AUTHOR_DATE": manifest["git"]["commit_time"],
            "GIT_COMMITTER_DATE": manifest["git"]["commit_time"],
        }
    )
    _require_success(
        _run(["git", "commit", "-m", manifest["git"]["commit_message"]], destination, env=commit_env),
        "git commit",
    )

    for item in manifest.get("post_commit_files", []):
        _write_declared_file(destination / item["path"], item["content"])

    if install_tools:
        if fixture_id != "FIX-TS-CLEAN":
            raise FixtureMaterializationError("tool installation is only defined for FIX-TS-CLEAN")
        npm_executable = "npm.cmd" if os.name == "nt" else "npm"
        result = _run([npm_executable, "ci", "--offline", "--ignore-scripts"], destination)
        if result.returncode != 0:
            raise FixtureMaterializationError(
                "TOOLCHAIN_UNAVAILABLE: npm ci --offline --ignore-scripts failed:\n"
                + result.stdout
                + result.stderr
            )
        outcome = check_local_typescript(destination, isolated_path=True)
        if outcome["status"] != "AVAILABLE" or outcome["version"] != "Version 5.9.3":
            raise FixtureMaterializationError(f"TOOLCHAIN_UNAVAILABLE: {outcome}")

    return destination


def check_local_typescript(repo: Path, *, isolated_path: bool) -> dict[str, Any]:
    executable = repo / "node_modules" / ".bin" / ("tsc.cmd" if os.name == "nt" else "tsc")
    if not executable.is_file():
        return {"status": "BLOCKED", "error_code": "TOOL_NOT_INSTALLED", "version": None}
    env = dict(os.environ)
    if isolated_path:
        env["PATH"] = str(executable.parent) + os.pathsep + env.get("PATH", "")
    result = _run([str(executable), "--version"], repo, env=env)
    if result.returncode != 0:
        return {
            "status": "BLOCKED",
            "error_code": "LOCAL_TOOL_EXECUTION_FAILED",
            "version": None,
        }
    return {"status": "AVAILABLE", "error_code": None, "version": result.stdout.strip()}


def snapshot_worktree(repo: Path) -> dict[str, dict[str, Any]]:
    """Snapshot only dirty/untracked files so read-only checks prove preservation."""
    result = _run(["git", "status", "--porcelain", "-z"], repo)
    _require_success(result, "git status")
    entries = [entry for entry in result.stdout.split("\0") if entry]
    snapshot: dict[str, dict[str, Any]] = {}
    for entry in entries:
        relative = entry[3:]
        path = repo / relative
        raw = path.read_bytes()
        stat = path.stat()
        snapshot[relative.replace("\\", "/")] = {
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest().upper(),
            "mtime_ns": stat.st_mtime_ns,
        }
    return snapshot


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture_id")
    parser.add_argument("destination", type=Path)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--install-tools", action="store_true")
    args = parser.parse_args(argv)
    try:
        repo = materialize_fixture(
            args.root,
            args.fixture_id,
            args.destination,
            install_tools=args.install_tools,
        )
    except FixtureMaterializationError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(repo)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
