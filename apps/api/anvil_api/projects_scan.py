"""Read-only Projects repository scan exposed by the public API."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from packages.repository_intelligence import ScanRequest, scan_repository


def _configured_path(value: str | Path | None, env_name: str) -> Path | None:
    raw = value if value is not None else os.environ.get(env_name)
    if raw is None or not str(raw).strip():
        return None
    return Path(raw).expanduser().resolve()


def _projection(result: object) -> dict[str, object]:
    payload = result.to_dict()  # type: ignore[attr-defined]
    repository = payload.get("repository") or {}
    status = payload.get("status")
    return {
        "ok": payload.get("success") is True,
        "status": "READY" if payload.get("success") is True else str(status or "BLOCKED"),
        "repository": {
            "branch": repository.get("branch"),
            "head": repository.get("head"),
            "trackedDirtyPaths": len(repository.get("tracked_dirty_paths") or []),
            "untrackedPaths": len(repository.get("untracked_paths") or []),
        },
        "noWriteProof": payload.get("no_write_proof") or {},
        "mutationAllowed": False,
        "message": (
            "읽기 전용 repository scan이 완료됐습니다."
            if payload.get("success") is True
            else "repository 상태가 변경되어 baseline을 차단했습니다."
        ),
    }


def create_projects_scan_router(
    repository_path: str | Path | None = None,
    allowed_root: str | Path | None = None,
) -> APIRouter:
    """Create a route with server-configured paths; the browser cannot select a path."""
    router = APIRouter()

    @router.get("/api/projects/scan")
    def projects_scan() -> JSONResponse:
        repository = _configured_path(repository_path, "ANVIL_REPOSITORY_ROOT")
        root = _configured_path(allowed_root, "ANVIL_REPOSITORY_ALLOWED_ROOT")
        if repository is None or root is None or not repository.is_dir() or not root.is_dir():
            return JSONResponse(
                status_code=503,
                content={
                    "ok": False,
                    "status": "OFFLINE",
                    "repository": None,
                    "noWriteProof": {},
                    "mutationAllowed": False,
                    "message": "Repository scan이 구성되지 않았습니다.",
                    "nextAction": "ANVIL_REPOSITORY_ROOT와 ANVIL_REPOSITORY_ALLOWED_ROOT를 구성하세요.",
                },
            )
        try:
            result = scan_repository(ScanRequest(str(repository), str(root), output_path=None))
            projected = _projection(result)
            return JSONResponse(status_code=200 if projected["ok"] else 409, content=projected)
        except Exception:
            return JSONResponse(
                status_code=503,
                content={
                    "ok": False,
                    "status": "OFFLINE",
                    "repository": None,
                    "noWriteProof": {},
                    "mutationAllowed": False,
                    "message": "Repository scan을 실행할 수 없습니다.",
                },
            )

    return router

