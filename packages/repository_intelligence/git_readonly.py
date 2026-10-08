"""Allowlisted, network-free Git observations with optional locks disabled."""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from .errors import ScanError, ScanRejected
from .models import ScanLimits
from .path_guard import contains_path


@dataclass(frozen=True, slots=True)
class GitCommand:
    command_id: str
    arguments: tuple[str, ...]
    allowed_returncodes: tuple[int, ...] = (0,)


_COMMANDS = (
    GitCommand("is_inside_work_tree", ("rev-parse", "--is-inside-work-tree")),
    GitCommand("repository_root", ("rev-parse", "--show-toplevel")),
    GitCommand("git_dir", ("rev-parse", "--absolute-git-dir")),
    GitCommand("git_common_dir", ("rev-parse", "--path-format=absolute", "--git-common-dir")),
    GitCommand("head", ("rev-parse", "--verify", "HEAD")),
    GitCommand("branch", ("symbolic-ref", "--quiet", "--short", "HEAD"), (0, 1)),
    GitCommand(
        "status_porcelain_v2",
        ("status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all", "--ignore-submodules=none"),
    ),
    GitCommand("remotes", ("remote", "-v")),
)


def _environment(repository: Path) -> dict[str, str]:
    environment = dict(os.environ)
    environment.update(
        {
            "GIT_OPTIONAL_LOCKS": "0",
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_PAGER": "cat",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_SYSTEM": os.devnull,
            "GIT_CONFIG_GLOBAL": os.devnull,
            # Container-mounted repositories are commonly owned by root while
            # the API runs as an unprivileged user. Allow only this exact
            # server-selected work tree, without enabling global trust.
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": "safe.directory",
            "GIT_CONFIG_VALUE_0": str(repository),
        }
    )
    return environment


def _argv(command: GitCommand) -> list[str]:
    return [
        "git",
        "--no-optional-locks",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
        *command.arguments,
    ]


def _run(command: GitCommand, repository: Path, limits: ScanLimits) -> tuple[bytes, dict[str, Any]]:
    try:
        completed = subprocess.run(
            _argv(command),
            cwd=repository,
            env=_environment(repository),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            check=False,
            timeout=limits.git_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        raise ScanRejected(
            ScanError(
                code="GIT_COMMAND_TIMEOUT",
                message="A read-only Git observation exceeded its time limit.",
                details={"command_id": command.command_id},
            )
        ) from exc
    except OSError as exc:
        raise ScanRejected(
            ScanError(
                code="GIT_COMMAND_UNAVAILABLE",
                message="The required Git executable could not be invoked.",
                details={"command_id": command.command_id, "reason": type(exc).__name__},
            )
        ) from exc
    if completed.returncode not in command.allowed_returncodes:
        code = "NOT_A_GIT_REPOSITORY" if command.command_id == "is_inside_work_tree" else "GIT_READ_FAILED"
        raise ScanRejected(
            ScanError(
                code=code,
                message="A read-only Git observation failed.",
                details={"command_id": command.command_id, "exit_code": completed.returncode},
            )
        )
    evidence = {
        "command_id": command.command_id,
        "argv": _argv(command),
        "environment": {"GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0"},
        "network_allowed": False,
        "writes_allowed": False,
        "exit_code": completed.returncode,
    }
    return completed.stdout, evidence


def _decode(raw: bytes) -> str:
    return raw.decode("utf-8", errors="surrogateescape")


def _mask_remote(value: str) -> str:
    stripped = value.strip()
    if "://" in stripped:
        parsed = urlsplit(stripped)
        host = parsed.hostname or ""
        if parsed.port:
            host = f"{host}:{parsed.port}"
        if parsed.username or parsed.password:
            host = f"***@{host}"
        return urlunsplit((parsed.scheme, host, parsed.path, "", ""))
    if "@" in stripped and ":" in stripped.split("@", 1)[1]:
        return "***@" + stripped.split("@", 1)[1]
    return stripped.split("?", 1)[0]


def _parse_status(raw: bytes) -> dict[str, Any]:
    tokens = [token for token in _decode(raw).split("\0") if token]
    tracked: list[str] = []
    untracked: list[str] = []
    ignored: list[str] = []
    branch_headers: dict[str, str] = {}
    index = 0
    while index < len(tokens):
        token = tokens[index]
        if token.startswith("# "):
            key, _, value = token[2:].partition(" ")
            branch_headers[key] = value
        elif token.startswith("? "):
            untracked.append(token[2:])
        elif token.startswith("! "):
            ignored.append(token[2:])
        elif token[:2] in {"1 ", "2 ", "u "}:
            fields = token.split(" ")
            minimum = 9 if token.startswith("1 ") else 10
            path = " ".join(fields[minimum - 1 :])
            tracked.append(path)
            if token.startswith("2 "):
                index += 1
        index += 1
    return {
        "branch_headers": branch_headers,
        "tracked_dirty_paths": sorted(tracked, key=lambda item: item.encode("utf-8", errors="surrogatepass")),
        "untracked_paths": sorted(untracked, key=lambda item: item.encode("utf-8", errors="surrogatepass")),
        "ignored_paths": sorted(ignored, key=lambda item: item.encode("utf-8", errors="surrogatepass")),
        "raw_sha256": __import__("hashlib").sha256(raw).hexdigest().upper(),
    }


def collect_git_state(repository: Path, allowed_root: Path, limits: ScanLimits) -> dict[str, Any]:
    """Run the fixed read-only command set and parse only bounded observations."""

    outputs: dict[str, bytes] = {}
    evidence: list[dict[str, Any]] = []
    for command in _COMMANDS:
        raw, command_evidence = _run(command, repository, limits)
        outputs[command.command_id] = raw
        evidence.append(command_evidence)
    if _decode(outputs["is_inside_work_tree"]).strip() != "true":
        raise ScanRejected(
            ScanError(code="NOT_A_GIT_REPOSITORY", message="The selected path is not a Git work tree.")
        )
    repository_root = Path(_decode(outputs["repository_root"]).strip()).resolve(strict=True)
    if os.path.normcase(os.path.realpath(repository_root)) != os.path.normcase(os.path.realpath(repository)):
        raise ScanRejected(
            ScanError(
                code="REPOSITORY_ROOT_MISMATCH",
                message="The selected path is not the canonical Git work-tree root.",
            )
        )
    git_dir = Path(_decode(outputs["git_dir"]).strip()).resolve(strict=True)
    common_dir = Path(_decode(outputs["git_common_dir"]).strip()).resolve(strict=True)
    for label, path in (("git_dir", git_dir), ("git_common_dir", common_dir)):
        if not contains_path(allowed_root, path):
            raise ScanRejected(
                ScanError(
                    code="GIT_METADATA_OUTSIDE_ALLOWED_ROOT",
                    message="Git metadata resolves outside the configured allowed root.",
                    details={"metadata_root": label},
                )
            )
    remotes = []
    for line in _decode(outputs["remotes"]).splitlines():
        name, separator, remainder = line.partition("\t")
        if not separator:
            continue
        url, _, direction = remainder.rpartition(" ")
        remotes.append({"name": name, "url_masked": _mask_remote(url), "direction": direction.strip("()")})
    status = _parse_status(outputs["status_porcelain_v2"])
    return {
        "repository_root": repository_root,
        "git_dir": git_dir,
        "git_common_dir": common_dir,
        "head": _decode(outputs["head"]).strip(),
        "branch": _decode(outputs["branch"]).strip() or None,
        "status": status,
        "remotes": remotes,
        "git_command_evidence": evidence,
    }
