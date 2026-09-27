from __future__ import annotations

import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI
from fastapi.testclient import TestClient


def _git_repository(path: Path) -> None:
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    subprocess.run(["git", "-C", str(path), "config", "core.autocrlf", "false"], check=True)
    (path / "README.md").write_text("temporary scan fixture\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(path), "add", "README.md"], check=True)
    subprocess.run(
        ["git", "-C", str(path), "-c", "user.name=Anvil Test", "-c", "user.email=anvil@example.invalid", "commit", "-qm", "fixture"],
        check=True,
    )


def test_projects_scan_is_exposed_by_the_public_api_without_mutation() -> None:
    with TemporaryDirectory(dir=Path.cwd()) as temporary:
        root = Path(temporary)
        repository = root / "repository"
        repository.mkdir()
        _git_repository(repository)

        from apps.api.anvil_api.projects_scan import create_projects_scan_router

        app = FastAPI()
        app.include_router(create_projects_scan_router(repository, root))

        response = TestClient(app).get("/api/projects/scan")

        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is True
        assert payload["status"] == "READY"
        assert payload["repository"]["head"]
        assert payload["repository"]["trackedDirtyPaths"] == 0
        assert payload["mutationAllowed"] is False
        assert payload["noWriteProof"]["identical"] is True

