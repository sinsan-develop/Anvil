"""Read-only repository scan orchestration and zero-delta enforcement."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .errors import ScanError, ScanRejected
from .git_readonly import collect_git_state
from .inventory import canonical_sha256, capture_named_files, capture_tree_inventory
from .manifests import detect_manifests
from .models import ScanRequest, ScanResult
from .path_guard import contains_path, validate_scan_paths
from .profile import infer_profile
from .indexes import build_indexes


def _git_metadata_paths(git_dir: Path, common_dir: Path) -> list[tuple[str, Path]]:
    roots = (("git_dir", git_dir), ("git_common_dir", common_dir))
    selected: dict[str, Path] = {}
    for prefix, root in roots:
        for name in ("HEAD", "index", "config", "config.worktree", "packed-refs"):
            path = root / name
            selected[f"{prefix}/{name}"] = path
        refs = root / "refs"
        if refs.is_dir():
            for path in refs.rglob("*"):
                if path.is_file() or path.is_symlink():
                    selected[f"{prefix}/refs/{path.relative_to(refs).as_posix()}"] = path
        for path in root.rglob("*.lock"):
            if path.is_file() or path.is_symlink():
                selected[f"{prefix}/locks/{path.relative_to(root).as_posix()}"] = path
    return list(selected.items())


def _capture_snapshot(repository: Path, allowed_root: Path, request: ScanRequest) -> dict[str, Any]:
    # Inventory first so a repository-controlled reparse point cannot influence
    # even an otherwise read-only Git command.
    inventory = capture_tree_inventory(repository, request.limits)
    git = collect_git_state(repository, allowed_root, request.limits)
    metadata_paths = _git_metadata_paths(git["git_dir"], git["git_common_dir"])
    for _label, path in metadata_paths:
        if not contains_path(allowed_root, path):
            raise ScanRejected(
                ScanError(
                    code="GIT_METADATA_OUTSIDE_ALLOWED_ROOT",
                    message="Git metadata resolves outside the configured allowed root.",
                )
            )
    metadata = capture_named_files(metadata_paths, request.limits)
    stable_git = {
        "head": git["head"],
        "branch": git["branch"],
        "status": git["status"],
        "remotes": git["remotes"],
    }
    material = {"git": stable_git, "inventory": inventory, "git_metadata": metadata}
    return {
        **material,
        "snapshot_sha256": canonical_sha256(material),
        "git_command_evidence": git["git_command_evidence"],
    }


def _map_by_path(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row["path"]): row for row in rows}


def _deltas(pre: dict[str, Any], post: dict[str, Any]) -> list[dict[str, Any]]:
    deltas: list[dict[str, Any]] = []
    for field in ("head", "branch", "status", "remotes"):
        if pre["git"][field] != post["git"][field]:
            deltas.append({"section": "git", "field": field})
    for section in ("inventory", "git_metadata"):
        before = _map_by_path(pre[section])
        after = _map_by_path(post[section])
        for path in sorted(set(before) | set(after), key=lambda value: value.encode("utf-8")):
            if path not in before:
                deltas.append({"section": section, "path": path, "change": "ADDED"})
            elif path not in after:
                deltas.append({"section": section, "path": path, "change": "REMOVED"})
            elif before[path] != after[path]:
                deltas.append({"section": section, "path": path, "change": "MODIFIED"})
    return deltas


def _repository_projection(snapshot: dict[str, Any], command_evidence: list[dict[str, Any]]) -> dict[str, Any]:
    status = snapshot["git"]["status"]
    return {
        "head": snapshot["git"]["head"],
        "branch": snapshot["git"]["branch"],
        "tracked_dirty_paths": status["tracked_dirty_paths"],
        "untracked_paths": status["untracked_paths"],
        "ignored_paths": status["ignored_paths"],
        "status_porcelain_v2_sha256": status["raw_sha256"],
        "remotes": snapshot["git"]["remotes"],
        "git_command_evidence": command_evidence,
        **infer_profile(snapshot["inventory"]),
    }


def _write_output(output: Path, result: ScanResult, repository: Path) -> None:
    if output.exists():
        raise ScanRejected(
            ScanError(
                code="OUTPUT_ALREADY_EXISTS",
                message="The scan output path already exists and will not be overwritten.",
                field="output_path",
            )
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    resolved_parent = output.parent.resolve(strict=True)
    if contains_path(repository, resolved_parent):
        raise ScanRejected(
            ScanError(
                code="SCAN_AUX_PATH_INSIDE_REPOSITORY",
                message="Scan output must remain outside the repository.",
                field="output_path",
            )
        )
    output.write_text(
        json.dumps(result.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
        newline="\n",
    )


def scan_repository(request: ScanRequest) -> ScanResult:
    """Scan a Git repository and reject the result unless pre/post state is identical."""

    repository: Path | None = None
    output: Path | None = None
    try:
        repository, allowed_root, output, _temp_root = validate_scan_paths(request)
        pre = _capture_snapshot(repository, allowed_root, request)
        manifests = detect_manifests(pre["inventory"])
        indexes = build_indexes(repository, pre["inventory"])
        post = _capture_snapshot(repository, allowed_root, request)
        deltas = _deltas(pre, post)
        proof = {
            "algorithm": "IDENTICAL_PRE_POST_V1",
            "pre_snapshot_sha256": pre["snapshot_sha256"],
            "post_snapshot_sha256": post["snapshot_sha256"],
            "identical": not deltas and pre["snapshot_sha256"] == post["snapshot_sha256"],
            "deltas": deltas,
            "covered_sections": ["HEAD", "branch", "porcelain_v2", "remotes", "full_inventory", "index_refs_config_locks"],
        }
        if not proof["identical"]:
            result = ScanResult(
                success=False,
                status="REJECTED",
                repository=_repository_projection(
                    pre,
                    pre["git_command_evidence"] + post["git_command_evidence"],
                ),
                inventory=pre["inventory"],
                manifests=manifests,
                symbols=indexes["symbols"], references=indexes["references"], dependencies=indexes["dependencies"], tests=indexes["tests"], impact=indexes["impact"], index_warnings=indexes["warnings"], index_sha256=indexes["index_sha256"],
                no_write_proof=proof,
                errors=(
                    ScanError(
                        code="SCAN_MUTATION_DETECTED",
                        message="Repository state changed during the read-only scan.",
                        details={"delta_count": len(deltas)},
                    ),
                ),
            )
        else:
            result = ScanResult(
                success=True,
                status="SCANNED_READ_ONLY",
                repository=_repository_projection(
                    pre,
                    pre["git_command_evidence"] + post["git_command_evidence"],
                ),
                inventory=pre["inventory"],
                manifests=manifests,
                symbols=indexes["symbols"], references=indexes["references"], dependencies=indexes["dependencies"], tests=indexes["tests"], impact=indexes["impact"], index_warnings=indexes["warnings"], index_sha256=indexes["index_sha256"],
                no_write_proof=proof,
            )
        if output is not None:
            _write_output(output, result, repository)
        return result
    except (FileNotFoundError, NotADirectoryError):
        result = ScanResult(
            success=False,
            status="REJECTED",
            errors=(
                ScanError(
                    code="PATH_NOT_FOUND",
                    message="A required scan path does not exist.",
                ),
            ),
        )
        return result
    except ScanRejected as exc:
        return ScanResult(success=False, status="REJECTED", errors=(exc.error,))
